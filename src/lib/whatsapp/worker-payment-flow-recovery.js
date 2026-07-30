import { createAuditLog } from '../audit-log.js';

export const WORKER_PAYMENT_FLOW_RECOVERY_LIMITS = Object.freeze({
  batchSize: 50,
  maxBatchSize: 200,
  staleGraceMs: 5 * 60 * 1_000,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export class WorkerPaymentFlowRecoveryError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_FLOW_RECOVERY_UNAVAILABLE') {
    super(message);
    this.name = 'WorkerPaymentFlowRecoveryError';
    this.code = code;
    this.status = 503;
  }
}

function recoveryError(message, code) {
  return new WorkerPaymentFlowRecoveryError(message, code);
}

function boundedInteger(value, name, { min, max }) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw recoveryError(
      `Invalid worker-payment Flow recovery ${name}.`,
      'WORKER_PAYMENT_FLOW_RECOVERY_INPUT_INVALID',
    );
  }
  return parsed;
}

function requiredIdentifier(value, name, pattern = null) {
  const normalized = String(value || '').trim();
  if (!normalized || (pattern && !pattern.test(normalized))) {
    throw recoveryError(
      `Invalid worker-payment Flow recovery ${name}.`,
      'WORKER_PAYMENT_FLOW_RECOVERY_STATE_INVALID',
    );
  }
  return normalized;
}

function requiredDate(value, name) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw recoveryError(
      `Invalid worker-payment Flow recovery ${name}.`,
      'WORKER_PAYMENT_FLOW_RECOVERY_STATE_INVALID',
    );
  }
  return date;
}

function candidateRow(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const flowSessionId = requiredIdentifier(row.flowSessionId, 'session identity', UUID_PATTERN)
    .toLowerCase();
  const reservationId = requiredIdentifier(
    row.submissionReservationId,
    'reservation identity',
    UUID_PATTERN,
  ).toLowerCase();
  return {
    flowSessionId,
    organizationId: requiredIdentifier(row.organizationId, 'organization identity'),
    projectId: requiredIdentifier(row.projectId, 'project identity'),
    workerId: requiredIdentifier(row.workerId, 'worker identity'),
    reservationId,
    fingerprintKeyId: requiredIdentifier(
      row.submissionFingerprintKeyId,
      'HMAC key identity',
      KEY_ID_PATTERN,
    ),
    reservedAt: requiredDate(row.submissionReservedAt, 'reservation clock'),
    expiresAt: requiredDate(row.expiresAt, 'expiry clock'),
    revision: boundedInteger(row.revision, 'revision', { min: 0, max: 2_147_483_646 }),
  };
}

function assertPersistence(prisma) {
  if (typeof prisma?.$transaction !== 'function') {
    throw recoveryError('Worker-payment Flow recovery persistence is unavailable.');
  }
}

/**
 * Conservatively fences sessions stranded by a process crash. Eligibility and
 * clocks are owned by PostgreSQL, rows are locked with SKIP LOCKED, and the
 * only permitted outcome is PROCESSING -> UNCERTAIN. No form value or HMAC
 * secret is read, and no provider/local submission is retried.
 */
export async function recoverExpiredWorkerPaymentFlowSubmissions(
  prisma,
  {
    batchSize = WORKER_PAYMENT_FLOW_RECOVERY_LIMITS.batchSize,
    staleGraceMs = WORKER_PAYMENT_FLOW_RECOVERY_LIMITS.staleGraceMs,
  } = {},
) {
  assertPersistence(prisma);
  const boundedBatchSize = boundedInteger(batchSize, 'batch size', {
    min: 1,
    max: WORKER_PAYMENT_FLOW_RECOVERY_LIMITS.maxBatchSize,
  });
  const boundedGraceMs = boundedInteger(staleGraceMs, 'grace window', {
    min: 60_000,
    max: 60 * 60 * 1_000,
  });

  return prisma.$transaction(async (transaction) => {
    if (
      typeof transaction?.$queryRawUnsafe !== 'function'
      || typeof transaction?.workerPaymentFlowSession?.updateMany !== 'function'
      || typeof transaction?.auditLog?.create !== 'function'
    ) {
      throw recoveryError('Worker-payment Flow recovery persistence is unavailable.');
    }
    const rows = await transaction.$queryRawUnsafe(
      `SELECT
         payment_session."flowSessionId",
         payment_session."organizationId",
         payment_session."projectId",
         payment_session."workerId",
         payment_session."submissionReservationId",
         payment_session."submissionFingerprintKeyId",
         payment_session."submissionReservedAt",
         payment_session."expiresAt",
         payment_session."revision"
       FROM "WorkerPaymentFlowSession" AS payment_session
       INNER JOIN "WhatsAppFlowSession" AS base_session
         ON base_session."id" = payment_session."flowSessionId"
       WHERE payment_session."submissionStatus" = 'PROCESSING'
         AND payment_session."submissionReservedAt" IS NOT NULL
         AND payment_session."expiresAt" <= statement_timestamp()
         AND base_session."expiresAt" <= statement_timestamp()
         AND payment_session."submissionReservedAt"
           <= statement_timestamp() - ($1::bigint * INTERVAL '1 millisecond')
       ORDER BY payment_session."submissionReservedAt" ASC,
                payment_session."flowSessionId" ASC
       LIMIT $2::int
       FOR UPDATE OF payment_session SKIP LOCKED`,
      boundedGraceMs,
      boundedBatchSize,
    );
    if (!Array.isArray(rows)) {
      throw recoveryError(
        'Worker-payment Flow recovery returned an invalid candidate set.',
        'WORKER_PAYMENT_FLOW_RECOVERY_STATE_INVALID',
      );
    }

    let recovered = 0;
    let auditRows = 0;
    for (const rawRow of rows) {
      const row = candidateRow(rawRow);
      const update = await transaction.workerPaymentFlowSession.updateMany({
        where: {
          flowSessionId: row.flowSessionId,
          submissionStatus: 'PROCESSING',
          submissionReservationId: row.reservationId,
          submissionFingerprintKeyId: row.fingerprintKeyId,
          revision: row.revision,
        },
        data: {
          submissionStatus: 'UNCERTAIN',
          // The ALWAYS trigger replaces this host value with statement_timestamp().
          submissionUncertainAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (update?.count !== 1) continue;
      recovered += 1;
      await createAuditLog(transaction, {
        organizationId: row.organizationId,
        actorId: null,
        action: 'worker.payment_flow.processing_expired_uncertain',
        entityType: 'WorkerPaymentFlowSession',
        entityId: row.flowSessionId,
        correlationId: `wpf-recovery:${row.flowSessionId}`,
        metadata: {
          projectId: row.projectId,
          workerId: row.workerId,
          reservationId: row.reservationId,
          fingerprintKeyId: row.fingerprintKeyId,
          previousStatus: 'PROCESSING',
          status: 'UNCERTAIN',
          reason: 'STALE_PROCESSING_AFTER_EXPIRY',
          reservedAt: row.reservedAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
        },
      });
      auditRows += 1;
    }
    return {
      scanned: rows.length,
      recovered,
      auditRows,
      hasMore: rows.length === boundedBatchSize,
    };
  }, { maxWait: 3_000, timeout: 10_000 });
}
