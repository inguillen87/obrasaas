import { createHmac, randomUUID } from 'node:crypto';

const DEFAULT_CLERK_WEBHOOK_LEASE_MS = 120_000;
export const CLERK_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;

const CLERK_WEBHOOK_BODY_EVIDENCE_VERSION = 1;
const CLERK_WEBHOOK_BODY_EVIDENCE_ALGORITHM = 'hmac-sha256';
const CLERK_WEBHOOK_BODY_EVIDENCE_DOMAIN = 'obrasaas:clerk-webhook:verified-body:v1';
const CLERK_WEBHOOK_EVIDENCE_KEY_ID_PATTERN = /^clerk-webhook-evidence-v[1-9][0-9]{0,5}$/;
const CLERK_INSTANCE_ID_PATTERN = /^ins_[A-Za-z0-9]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class ClerkWebhookEvidenceError extends Error {
  constructor(message, { code = 'CLERK_WEBHOOK_EVIDENCE_INVALID', status = 500 } = {}) {
    super(message);
    this.name = 'ClerkWebhookEvidenceError';
    this.code = code;
    this.status = status;
  }
}

function evidenceError(message, code, status = 500) {
  return new ClerkWebhookEvidenceError(message, { code, status });
}

function evidenceInput(value, name, maxLength) {
  const normalized = typeof value === 'string' ? value : '';
  if (!normalized || normalized.length > maxLength || normalized.includes('\0')) {
    throw evidenceError(
      `Valid Clerk webhook ${name} is required.`,
      'CLERK_WEBHOOK_EVIDENCE_INPUT_INVALID',
      400,
    );
  }
  return normalized;
}

export function createClerkWebhookBodyEvidence(rawBody, {
  instanceId,
  eventId,
  eventType,
  evidenceSecret = process.env.CLERK_WEBHOOK_EVIDENCE_SECRET,
  evidenceKeyId = process.env.CLERK_WEBHOOK_EVIDENCE_KEY_ID,
  signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET,
} = {}) {
  if (!(rawBody instanceof Uint8Array) || rawBody.byteLength > CLERK_WEBHOOK_MAX_BODY_BYTES) {
    throw evidenceError(
      'Valid bounded Clerk webhook body bytes are required.',
      'CLERK_WEBHOOK_EVIDENCE_INPUT_INVALID',
      400,
    );
  }
  const secret = typeof evidenceSecret === 'string' ? evidenceSecret : '';
  const signingKey = typeof signingSecret === 'string' ? signingSecret : '';
  const keyId = typeof evidenceKeyId === 'string' ? evidenceKeyId : '';
  if (
    secret.length < 32
    || !CLERK_WEBHOOK_EVIDENCE_KEY_ID_PATTERN.test(keyId)
    || (signingKey && secret === signingKey)
  ) {
    throw evidenceError(
      'Independent Clerk webhook evidence key configuration is unavailable.',
      'CLERK_WEBHOOK_EVIDENCE_CONFIGURATION_INVALID',
      503,
    );
  }
  const normalizedInstanceId = evidenceInput(instanceId, 'instance ID', 191);
  if (!CLERK_INSTANCE_ID_PATTERN.test(normalizedInstanceId)) {
    throw evidenceError(
      'Valid Clerk webhook instance ID is required.',
      'CLERK_WEBHOOK_EVIDENCE_INPUT_INVALID',
      400,
    );
  }
  const normalizedEventId = evidenceInput(eventId, 'event ID', 256);
  const normalizedEventType = evidenceInput(eventType, 'event type', 120);
  const digest = createHmac('sha256', secret)
    .update(`${CLERK_WEBHOOK_BODY_EVIDENCE_DOMAIN}\0`, 'utf8')
    .update(`${keyId}\0${normalizedInstanceId}\0${normalizedEventId}\0${normalizedEventType}\0`, 'utf8')
    .update(rawBody)
    .digest('hex');
  return {
    version: CLERK_WEBHOOK_BODY_EVIDENCE_VERSION,
    algorithm: CLERK_WEBHOOK_BODY_EVIDENCE_ALGORITHM,
    domain: CLERK_WEBHOOK_BODY_EVIDENCE_DOMAIN,
    keyId,
    instanceId: normalizedInstanceId,
    digest,
  };
}

function normalizedClerkWebhookBodyEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Valid Clerk webhook body evidence is required.');
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 6
    || keys[0] !== 'algorithm'
    || keys[1] !== 'digest'
    || keys[2] !== 'domain'
    || keys[3] !== 'instanceId'
    || keys[4] !== 'keyId'
    || keys[5] !== 'version'
    || value.version !== CLERK_WEBHOOK_BODY_EVIDENCE_VERSION
    || value.algorithm !== CLERK_WEBHOOK_BODY_EVIDENCE_ALGORITHM
    || value.domain !== CLERK_WEBHOOK_BODY_EVIDENCE_DOMAIN
    || typeof value.keyId !== 'string'
    || !CLERK_WEBHOOK_EVIDENCE_KEY_ID_PATTERN.test(value.keyId)
    || typeof value.instanceId !== 'string'
    || !CLERK_INSTANCE_ID_PATTERN.test(value.instanceId)
    || typeof value.digest !== 'string'
    || !SHA256_PATTERN.test(value.digest)
  ) {
    throw new TypeError('Valid Clerk webhook body evidence is required.');
  }
  return {
    version: value.version,
    algorithm: value.algorithm,
    domain: value.domain,
    keyId: value.keyId,
    instanceId: value.instanceId,
    digest: value.digest,
  };
}

function redactedClerkWebhookPayload(bodyEvidence) {
  return {
    version: 1,
    redacted: true,
    bodyEvidence: normalizedClerkWebhookBodyEvidence(bodyEvidence),
  };
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

export async function completeClerkWebhookEvent(database, {
  eventId,
  leaseToken,
  bodyEvidence,
  now = new Date(),
}) {
  const payload = redactedClerkWebhookPayload(bodyEvidence);
  const result = await database.webhookEvent.updateMany({
    where: {
      provider: 'clerk',
      externalId: eventId,
      status: 'PROCESSING',
      leaseToken,
    },
    data: {
      status: 'PROCESSED',
      payload,
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
