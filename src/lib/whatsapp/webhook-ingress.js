import {
  scopedWebhookExternalId,
  serializeWebhookPayload,
} from '../webhook-queue.js';
import { subscriptionAllowsWrites } from '../plans.js';
import { resolveWhatsAppConnectionScopesBulk } from './webhook-scope.js';

// Meta documents a maximum of 1,000 updates in one webhook POST. An update is
// one item in an entry's changes array, not one normalized message/status row.
export const META_WEBHOOK_MAX_UPDATES = 1_000;
// Meta's current webhook contract caps a delivery at 3 MiB. Reject anything
// larger before HMAC parsing so an oversized request cannot consume JSON/queue
// capacity that the provider itself does not legitimately need.
export const META_WEBHOOK_MAX_BODY_BYTES = 3 * 1024 * 1024;

export class MetaWebhookBatchError extends Error {
  constructor(message, { code = 'META_WEBHOOK_BATCH_INVALID', status = 400 } = {}) {
    super(message);
    this.name = 'MetaWebhookBatchError';
    this.code = code;
    this.status = status;
  }
}

export function countMetaWebhookUpdates(payload) {
  if (!Array.isArray(payload?.entry)) return 0;
  return payload.entry.reduce((count, entry) => (
    count + (Array.isArray(entry?.changes) ? entry.changes.length : 0)
  ), 0);
}

export function assertMetaWebhookBatchLimit(
  payload,
  { maxUpdates = META_WEBHOOK_MAX_UPDATES } = {},
) {
  const updateCount = countMetaWebhookUpdates(payload);
  if (updateCount > maxUpdates) {
    throw new MetaWebhookBatchError(
      `Meta webhook contains ${updateCount} updates; maximum is ${maxUpdates}.`,
      { code: 'META_WEBHOOK_BATCH_TOO_LARGE', status: 413 },
    );
  }
  return updateCount;
}

const WEBHOOK_SUBSCRIPTION_BLOCKED = 'WEBHOOK_SUBSCRIPTION_BLOCKED';

function webhookRow(event, scope, { subscriptionBlocked = false } = {}) {
  return {
    projectId: scope.projectId,
    provider: event.provider,
    externalId: scopedWebhookExternalId(scope.projectId, event.externalId),
    eventType: event.eventType,
    payload: subscriptionBlocked
      ? { version: 1, redacted: true }
      : serializeWebhookPayload({ ...event, phoneNumberId: scope.phoneNumberId }, scope),
    ...(subscriptionBlocked ? {
      status: 'FAILED',
      lastError: `[${WEBHOOK_SUBSCRIPTION_BLOCKED}] La suscripción no permite procesar mensajes de WhatsApp.`,
      nextAttemptAt: null,
    } : {}),
  };
}

/**
 * Persist every tenant-scoped normalized event using one scope lookup and one
 * idempotent insert. Only durable persistence belongs on the webhook ACK path;
 * all business processing happens after the response or via recovery cron.
 */
export async function persistDurableMetaWebhookBatch(
  prisma,
  events = [],
  { now = new Date() } = {},
) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      accepted: 0,
      duplicate: 0,
      unknownConnections: 0,
      projectIds: [],
    };
  }

  const scopesByEvent = await resolveWhatsAppConnectionScopesBulk(prisma, events);
  const uniqueRows = new Map();
  const projectIds = new Set();
  let scopedEventCount = 0;
  let unknownConnections = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const scopes = scopesByEvent[index] || [];
    if (scopes.length === 0) {
      unknownConnections += 1;
      continue;
    }

    for (const scope of scopes) {
      const subscriptionBlocked = event.eventType === 'message'
        && !subscriptionAllowsWrites(scope.subscriptionOrganization, now);
      const row = webhookRow(event, scope, { subscriptionBlocked });
      scopedEventCount += 1;
      if (!subscriptionBlocked) projectIds.add(scope.projectId);
      uniqueRows.set(`${row.provider}\u0000${row.externalId}`, row);
    }
  }

  let accepted = 0;
  if (uniqueRows.size > 0) {
    const result = await prisma.webhookEvent.createMany({
      data: [...uniqueRows.values()],
      skipDuplicates: true,
    });
    accepted = Number(result?.count || 0);
  }

  return {
    accepted,
    duplicate: Math.max(0, scopedEventCount - accepted),
    unknownConnections,
    projectIds: [...projectIds].sort(),
  };
}
