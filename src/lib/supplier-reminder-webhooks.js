import { createHash } from 'node:crypto';

import { Resend } from 'resend';

const STATUS_BY_EVENT = new Map([
  ['email.delivery_delayed', 'DELIVERY_DELAYED'],
  ['email.delivered', 'DELIVERED'],
  ['email.bounced', 'BOUNCED'],
  ['email.complained', 'COMPLAINED'],
  ['email.failed', 'DELIVERY_FAILED'],
  ['email.suppressed', 'SUPPRESSED'],
]);
const NEGATIVE_STATUSES = new Set(['BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED']);

export class SupplierReminderWebhookError extends Error {
  constructor(message, code = 'SUPPLIER_REMINDER_WEBHOOK_INVALID', status = 400) {
    super(message);
    this.name = 'SupplierReminderWebhookError';
    this.code = code;
    this.status = status;
  }
}

function header(headers, name, max = 500) {
  const value = String(headers.get(name) || '').trim();
  if (!value || value.length > max) throw new SupplierReminderWebhookError('Firma de webhook incompleta.');
  return value;
}

export function verifyResendWebhook({
  rawBody,
  headers,
  webhookSecrets = [],
  webhookSecret = null,
  ResendClass = Resend,
}) {
  if (typeof rawBody !== 'string' || rawBody.length === 0 || rawBody.length > 256 * 1024) {
    throw new SupplierReminderWebhookError('Payload de webhook invalido.');
  }
  const id = header(headers, 'svix-id', 190);
  const timestamp = header(headers, 'svix-timestamp');
  const signature = header(headers, 'svix-signature');
  const secrets = [...new Set([...(Array.isArray(webhookSecrets) ? webhookSecrets : []), webhookSecret].filter(Boolean))];
  for (const secret of secrets) {
    try {
      const client = new ResendClass('re_webhook_verification_only');
      const event = client.webhooks.verify({
        payload: rawBody,
        headers: { id, timestamp, signature },
        webhookSecret: secret,
      });
      return { id, event };
    } catch {
      // Try the previous secret during a controlled key-rotation window.
    }
  }
  throw new SupplierReminderWebhookError(
    'Firma de webhook invalida.',
    'SUPPLIER_REMINDER_WEBHOOK_SIGNATURE_INVALID',
    401,
  );
}

function eventInstant(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new SupplierReminderWebhookError('Fecha de evento invalida.');
  return date;
}

function sameInstant(left, right) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function allowedCurrentStatuses(nextStatus) {
  if (nextStatus === 'DELIVERY_DELAYED') return ['PROVIDER_ACCEPTED'];
  if (nextStatus === 'DELIVERED') return ['PROVIDER_ACCEPTED', 'DELIVERY_DELAYED'];
  if (NEGATIVE_STATUSES.has(nextStatus)) {
    return ['PROVIDER_ACCEPTED', 'DELIVERY_DELAYED', 'DELIVERED', ...NEGATIVE_STATUSES];
  }
  return [];
}

async function applyStoredEvent(transaction, delivery, storedEvent) {
  const nextStatus = STATUS_BY_EVENT.get(storedEvent.type);
  if (!nextStatus) return { applied: false, nextStatus };
  if (delivery.status === nextStatus) {
    await transaction.supplierReminderDelivery.updateMany({
      where: {
        id: delivery.id,
        organizationId: delivery.organizationId,
        projectId: delivery.projectId,
        status: nextStatus,
        OR: [{ providerStatusAt: null }, { providerStatusAt: { lte: storedEvent.occurredAt } }],
      },
      data: { providerStatusAt: storedEvent.occurredAt },
    });
    return { applied: false, nextStatus };
  }
  const updated = await transaction.supplierReminderDelivery.updateMany({
    where: {
      id: delivery.id,
      organizationId: delivery.organizationId,
      projectId: delivery.projectId,
      status: { in: allowedCurrentStatuses(nextStatus) },
      OR: [{ providerStatusAt: null }, { providerStatusAt: { lte: storedEvent.occurredAt } }],
    },
    data: {
      status: nextStatus,
      providerStatusAt: storedEvent.occurredAt,
      ...(NEGATIVE_STATUSES.has(nextStatus) ? { lastError: `RESEND_${nextStatus}` } : {}),
    },
  });
  return { applied: updated.count === 1, nextStatus };
}

function deliverySelect() {
  return {
    id: true,
    organizationId: true,
    projectId: true,
    status: true,
    providerStatusAt: true,
  };
}

export async function applySupplierReminderWebhook(prisma, { id, event, rawBody }) {
  const type = typeof event?.type === 'string' ? event.type : '';
  const providerMessageId = typeof event?.data?.email_id === 'string' ? event.data.email_id.trim() : '';
  if (!type.startsWith('email.') || type.length > 64 || !providerMessageId || providerMessageId.length > 190) {
    return { accepted: true, persisted: false, matched: false, applied: false };
  }
  const occurredAt = eventInstant(event.created_at || event.data?.created_at);
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.supplierReminderWebhookEvent.findUnique({
      where: { id },
      include: { application: true },
    });
    if (existing && (
      existing.payloadHash !== payloadHash
      || existing.type !== type
      || existing.providerMessageId !== providerMessageId
      || !sameInstant(existing.occurredAt, occurredAt)
    )) {
      throw new SupplierReminderWebhookError(
        'El identificador del webhook fue reutilizado con otro contenido.',
        'SUPPLIER_REMINDER_WEBHOOK_REPLAY_MISMATCH',
        409,
      );
    }
    const delivery = await transaction.supplierReminderDelivery.findFirst({
      where: { provider: 'resend', providerMessageId },
      select: deliverySelect(),
    });
    const storedEvent = existing || await transaction.supplierReminderWebhookEvent.create({
      data: {
        id,
        providerMessageId,
        type,
        occurredAt,
        payloadHash,
      },
    });
    if (!delivery) {
      // The provider can notify before the send response is committed. Keeping
      // this append-only inbox row lets settlement reconcile the early event.
      return { accepted: true, persisted: true, matched: false, applied: false, replayed: Boolean(existing) };
    }
    if (existing?.application) {
      return { accepted: true, persisted: true, matched: true, applied: false, replayed: true };
    }
    const result = await applyStoredEvent(transaction, delivery, storedEvent);
    await transaction.supplierReminderWebhookApplication.create({
      data: {
        eventId: storedEvent.id,
        organizationId: delivery.organizationId,
        projectId: delivery.projectId,
        deliveryId: delivery.id,
        appliedStatus: result.applied ? result.nextStatus : null,
      },
    });
    return { accepted: true, persisted: true, matched: true, applied: result.applied, replayed: Boolean(existing) };
  });
}

export async function reconcileSupplierReminderWebhooks(prisma, {
  deliveryId,
  providerMessageId,
} = {}) {
  if (!deliveryId || !providerMessageId) return { matched: false, applied: 0 };
  return prisma.$transaction(async (transaction) => {
    const delivery = await transaction.supplierReminderDelivery.findFirst({
      where: { id: deliveryId, provider: 'resend', providerMessageId },
      select: deliverySelect(),
    });
    if (!delivery) return { matched: false, applied: 0 };
    const events = await transaction.supplierReminderWebhookEvent.findMany({
      where: { providerMessageId, application: null },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    let applied = 0;
    let current = delivery;
    for (const event of events) {
      const result = await applyStoredEvent(transaction, current, event);
      await transaction.supplierReminderWebhookApplication.create({
        data: {
          eventId: event.id,
          organizationId: delivery.organizationId,
          projectId: delivery.projectId,
          deliveryId: delivery.id,
          appliedStatus: result.applied ? result.nextStatus : null,
        },
      });
      if (result.applied) {
        applied += 1;
        current = await transaction.supplierReminderDelivery.findFirst({
          where: { id: delivery.id },
          select: deliverySelect(),
        });
      }
    }
    return { matched: true, applied };
  });
}

export async function reconcileEarlySupplierReminderWebhooks(prisma, { limit = 100 } = {}) {
  const events = await prisma.supplierReminderWebhookEvent.findMany({
    where: { application: null },
    select: { providerMessageId: true },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    take: Math.min(500, Math.max(1, Number(limit) || 100)),
  });
  const providerIds = [...new Set(events.map((event) => event.providerMessageId))];
  let matched = 0;
  let applied = 0;
  for (const providerMessageId of providerIds) {
    const delivery = await prisma.supplierReminderDelivery.findFirst({
      where: { provider: 'resend', providerMessageId },
      select: { id: true },
    });
    if (!delivery) continue;
    const result = await reconcileSupplierReminderWebhooks(prisma, {
      deliveryId: delivery.id,
      providerMessageId,
    });
    matched += result.matched ? 1 : 0;
    applied += result.applied;
  }
  return { inspected: events.length, matched, applied };
}

export function supplierReminderWebhookErrorResponse(error) {
  if (!(error instanceof SupplierReminderWebhookError)) return null;
  return Response.json({ ok: false, code: error.code }, { status: error.status });
}
