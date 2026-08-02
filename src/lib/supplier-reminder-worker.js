import { sendResendEmail } from './email/resend.js';
import { lockProjectTransaction } from './project-write-policy.js';
import { civilDateKey, todayInTimezone } from './supplier-commitments.js';
import {
  reconcileEarlySupplierReminderWebhooks,
  reconcileSupplierReminderWebhooks,
} from './supplier-reminder-webhooks.js';

const MAX_ATTEMPTS = 6;
const DEFAULT_LIMIT = 4;
const LEASE_MINUTES = 5;
const DEFAULT_RUN_BUDGET_MS = 45_000;
const ACTIVE_COMMITMENT_STATUSES = new Set(['CONFIRMED', 'AT_RISK']);

function boundedLimit(value) {
  return Math.min(10, Math.max(1, Math.trunc(Number(value) || DEFAULT_LIMIT)));
}

function errorCode(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^[A-Z0-9_:-]{1,120}$/.test(normalized) ? normalized : 'SUPPLIER_REMINDER_PROVIDER_FAILURE';
}

export async function recoverExpiredSupplierReminderLeases(prisma, {
  now = new Date(),
  leaseMinutes = LEASE_MINUTES,
} = {}) {
  const cutoff = new Date(now.getTime() - Math.max(1, Number(leaseMinutes) || LEASE_MINUTES) * 60_000);
  const recoveredClaims = await prisma.supplierReminderDelivery.updateMany({
    where: { status: 'CLAIMED', leasedAt: { lte: cutoff } },
    data: {
      status: 'PENDING',
      leasedAt: null,
      nextAttemptAt: now,
      lastError: 'CLAIM_LEASE_RECOVERED_BEFORE_PROVIDER_BOUNDARY',
    },
  });
  const uncertainDispatches = await prisma.supplierReminderDelivery.updateMany({
    where: { status: 'DISPATCHING', leasedAt: { lte: cutoff } },
    data: {
      status: 'UNCERTAIN',
      leasedAt: null,
      lastError: 'DISPATCH_LEASE_EXPIRED_AFTER_PROVIDER_BOUNDARY',
    },
  });
  return {
    recoveredClaims: Number(recoveredClaims.count || 0),
    recoveredUncertain: Number(uncertainDispatches.count || 0),
  };
}

export async function claimDueSupplierReminders(prisma, {
  now = new Date(),
  limit = 1,
} = {}) {
  const take = boundedLimit(limit);
  if (typeof prisma.$queryRawUnsafe !== 'function') {
    throw new Error('Atomic supplier reminder claim is unavailable.');
  }
  return prisma.$queryRawUnsafe(`
    WITH candidates AS (
      SELECT delivery."id"
        FROM "SupplierReminderDelivery" AS delivery
       WHERE delivery."status" IN ('PENDING', 'FAILED')
         AND delivery."nextAttemptAt" <= $1
         AND delivery."attempts" < ${MAX_ATTEMPTS}
       ORDER BY delivery."nextAttemptAt" ASC, delivery."createdAt" ASC, delivery."id" ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $2
    )
    UPDATE "SupplierReminderDelivery" AS delivery
       SET "status" = 'CLAIMED',
           "leasedAt" = $1,
           "updatedAt" = $1
      FROM candidates
     WHERE delivery."id" = candidates."id"
    RETURNING delivery.*
  `, now, take);
}

function reminderInclude() {
  return {
    project: { select: { id: true, status: true } },
    commitment: {
      include: { supplier: { select: { id: true, email: true, active: true } } },
    },
  };
}

async function prepareSupplierReminderDispatch(prisma, claim, now) {
  return prisma.$transaction(async (transaction) => {
    await lockProjectTransaction(transaction, claim.projectId);
    const row = await transaction.supplierReminderDelivery.findFirst({
      where: { id: claim.id, status: 'CLAIMED', leasedAt: claim.leasedAt },
      include: reminderInclude(),
    });
    if (!row) return { deliver: false, cancelled: false, code: 'REMINDER_CLAIM_SUPERSEDED' };
    const commitment = row.commitment;
    let scheduleIsCurrent = false;
    try {
      scheduleIsCurrent = civilDateKey(commitment?.endsOn) >= todayInTimezone(commitment?.timezone, now);
    } catch {
      scheduleIsCurrent = false;
    }
    const currentSupplierEmail = typeof commitment?.supplier?.email === 'string'
      ? commitment.supplier.email.trim().toLowerCase()
      : '';
    const commitmentStatusMatches = row.kind === 'CANCELLED'
      ? commitment?.status === 'CANCELLED'
      : ACTIVE_COMMITMENT_STATUSES.has(commitment?.status);
    const scheduleWindowMatches = row.kind === 'CANCELLED' || scheduleIsCurrent;
    const valid = commitment
      && commitment.scheduleRevision === row.scheduleRevision
      && commitmentStatusMatches
      && scheduleWindowMatches
      && commitment.reminderEnabled === true
      && commitment.reminderEmail === row.recipientEmail
      && currentSupplierEmail === row.recipientEmail
      && commitment.reminderEmailConfirmedAt
      && commitment.reminderEmailConfirmedById
      && commitment.supplier?.active === true
      && ['PLANNING', 'ACTIVE'].includes(row.project?.status);
    const suppressed = valid ? await transaction.supplierReminderDelivery.count({
      where: {
        organizationId: row.organizationId,
        recipientEmail: row.recipientEmail,
        status: { in: ['BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED'] },
      },
    }) : 0;
    if (!valid || suppressed > 0) {
      const code = valid ? 'REMINDER_DESTINATION_SUPPRESSED' : 'REMINDER_FENCE_STALE';
      const cancelled = await transaction.supplierReminderDelivery.updateMany({
        where: { id: row.id, status: 'CLAIMED', leasedAt: row.leasedAt },
        data: { status: 'CANCELLED', leasedAt: null, lastError: code },
      });
      return { deliver: false, cancelled: cancelled.count === 1, code };
    }
    const prepared = await transaction.supplierReminderDelivery.updateMany({
      where: { id: row.id, status: 'CLAIMED', leasedAt: row.leasedAt },
      data: { status: 'DISPATCHING', attempts: { increment: 1 }, leasedAt: now, lastError: null },
    });
    if (prepared.count !== 1) return { deliver: false, cancelled: false, code: 'REMINDER_CLAIM_SUPERSEDED' };
    return {
      deliver: true,
      row: { ...row, status: 'DISPATCHING', attempts: Number(row.attempts) + 1, leasedAt: now },
    };
  }, { isolationLevel: 'ReadCommitted' });
}

async function settleAccepted(prisma, row, result, now) {
  return prisma.supplierReminderDelivery.updateMany({
    where: { id: row.id, status: 'DISPATCHING', leasedAt: row.leasedAt },
    data: {
      status: 'PROVIDER_ACCEPTED',
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      providerStatusAt: now,
      sentAt: now,
      leasedAt: null,
      lastError: null,
    },
  });
}

async function settleUncertain(prisma, row, result) {
  return prisma.supplierReminderDelivery.updateMany({
    where: { id: row.id, status: 'DISPATCHING', leasedAt: row.leasedAt },
    data: {
      status: 'UNCERTAIN',
      leasedAt: null,
      lastError: errorCode(result.code),
    },
  });
}

async function settleConflict(prisma, row, result) {
  return prisma.supplierReminderDelivery.updateMany({
    where: { id: row.id, status: 'DISPATCHING', leasedAt: row.leasedAt },
    data: {
      status: 'CONFLICT',
      leasedAt: null,
      lastError: errorCode(result.code),
    },
  });
}

function deterministicRetryAt(row, now) {
  const base = Math.min(6 * 60 * 60_000, 5 * 60_000 * 2 ** Math.min(Number(row.attempts) || 1, 6));
  const jitter = [...String(row.id)].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 60_000;
  return new Date(now.getTime() + base + jitter);
}

async function settleDefinitiveFailure(prisma, row, result, now) {
  const terminal = result.retryable !== true || Number(row.attempts) >= MAX_ATTEMPTS;
  const providerRetryAt = result.retryAt instanceof Date && result.retryAt > now ? result.retryAt : null;
  return prisma.supplierReminderDelivery.updateMany({
    where: { id: row.id, status: 'DISPATCHING', leasedAt: row.leasedAt },
    data: {
      status: terminal ? 'DEAD_LETTER' : 'FAILED',
      nextAttemptAt: providerRetryAt || deterministicRetryAt(row, now),
      leasedAt: null,
      lastError: errorCode(result.code),
    },
  });
}

export async function processSupplierReminders(prisma, {
  config,
  now = new Date(),
  limit = DEFAULT_LIMIT,
  runBudgetMs = DEFAULT_RUN_BUDGET_MS,
  sendEmail = sendResendEmail,
} = {}) {
  const startedAt = Date.now();
  const recovered = await recoverExpiredSupplierReminderLeases(prisma, { now });
  const reconciled = await reconcileEarlySupplierReminderWebhooks(prisma, { limit: 100 });
  const metrics = {
    ...recovered,
    reconciledWebhooks: reconciled.applied,
    claimed: 0,
    providerAccepted: 0,
    retryableFailed: 0,
    deadLetter: 0,
    uncertain: 0,
    conflict: 0,
    cancelled: 0,
  };
  const maxRows = boundedLimit(limit);
  for (let index = 0; index < maxRows; index += 1) {
    if (Date.now() - startedAt >= Math.max(1_000, Number(runBudgetMs) || DEFAULT_RUN_BUDGET_MS)) break;
    const [claim] = await claimDueSupplierReminders(prisma, { now, limit: 1 });
    if (!claim) break;
    metrics.claimed += 1;
    const prepared = await prepareSupplierReminderDispatch(prisma, claim, now);
    if (!prepared.deliver) {
      metrics.cancelled += prepared.cancelled ? 1 : 0;
      continue;
    }
    const row = prepared.row;
    const result = await sendEmail({ config, delivery: row, now });
    if (result?.outcome === 'accepted') {
      const settled = await settleAccepted(prisma, row, result, now);
      metrics.providerAccepted += Number(settled.count || 0);
      if (settled.count === 1) {
        const replay = await reconcileSupplierReminderWebhooks(prisma, {
          deliveryId: row.id,
          providerMessageId: result.providerMessageId,
        });
        metrics.reconciledWebhooks += replay.applied;
      }
      continue;
    }
    if (result?.outcome === 'definitive_failure') {
      const settled = await settleDefinitiveFailure(prisma, row, result, now);
      if (settled.count === 1) {
        if (result.retryable === true && Number(row.attempts) < MAX_ATTEMPTS) metrics.retryableFailed += 1;
        else metrics.deadLetter += 1;
      }
      continue;
    }
    if (result?.outcome === 'conflict') {
      const settled = await settleConflict(prisma, row, result);
      metrics.conflict += Number(settled.count || 0);
      continue;
    }
    const settled = await settleUncertain(prisma, row, result || {});
    metrics.uncertain += Number(settled.count || 0);
  }
  const dueRemaining = await prisma.supplierReminderDelivery.count({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
  });
  const healthRows = await prisma.supplierReminderDelivery.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  return {
    ...metrics,
    hasMore: dueRemaining > 0,
    health: Object.fromEntries(healthRows.map((row) => [row.status, row._count._all])),
  };
}
