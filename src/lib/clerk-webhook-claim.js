import { randomUUID } from 'node:crypto';

const DEFAULT_CLERK_WEBHOOK_LEASE_MS = 120_000;

function redactedClerkWebhookPayload() {
  return { version: 1, redacted: true };
}

export function clerkWebhookRetryResponse(message, { retryAfter = 5 } = {}) {
  return new Response(message, {
    status: 503,
    headers: { 'Retry-After': String(retryAfter) },
  });
}

export async function claimClerkWebhookEvent(database, {
  eventId,
  eventType,
  payload,
  now = new Date(),
  leaseMs = DEFAULT_CLERK_WEBHOOK_LEASE_MS,
  leaseToken = randomUUID(),
}) {
  if (!eventId || !eventType) throw new Error('Clerk webhook event ID and type are required.');
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  await database.webhookEvent.createMany({
    data: [{
      provider: 'clerk',
      externalId: eventId,
      eventType,
      status: 'PENDING',
      attempts: 0,
      payload,
      nextAttemptAt: now,
    }],
    skipDuplicates: true,
  });

  const claimed = await database.webhookEvent.updateMany({
    where: {
      provider: 'clerk',
      externalId: eventId,
      OR: [
        { status: 'PENDING' },
        { status: 'FAILED' },
        { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
      ],
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
      lastError: null,
      leaseToken,
      leaseExpiresAt,
      nextAttemptAt: null,
    },
  });
  const event = await database.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'clerk', externalId: eventId } },
  });
  if (!event) throw new Error('Clerk webhook claim disappeared after persistence.');
  if (claimed.count === 1) return { state: 'claimed', event, leaseToken };
  if (event.status === 'PROCESSED') return { state: 'processed', event, leaseToken: null };
  return { state: 'in_progress', event, leaseToken: null };
}

export async function completeClerkWebhookEvent(database, { eventId, leaseToken, now = new Date() }) {
  const result = await database.webhookEvent.updateMany({
    where: {
      provider: 'clerk',
      externalId: eventId,
      status: 'PROCESSING',
      leaseToken,
    },
    data: {
      status: 'PROCESSED',
      payload: redactedClerkWebhookPayload(),
      processedAt: now,
      leaseToken: null,
      leaseExpiresAt: null,
      lastError: null,
    },
  });
  return result.count === 1;
}

export async function failClerkWebhookEvent(database, {
  eventId,
  leaseToken,
  error,
  now = new Date(),
}) {
  const lastError = error instanceof Error ? error.message.slice(0, 2_000) : 'Unknown error';
  const result = await database.webhookEvent.updateMany({
    where: {
      provider: 'clerk',
      externalId: eventId,
      status: 'PROCESSING',
      leaseToken,
    },
    data: {
      status: 'FAILED',
      lastError,
      leaseToken: null,
      leaseExpiresAt: null,
      nextAttemptAt: now,
    },
  });
  return result.count === 1;
}
