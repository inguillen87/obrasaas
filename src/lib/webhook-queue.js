import { projectWhatsAppFlowReplyForPersistence } from './whatsapp/flows.js';

export const WEBHOOK_MAX_ATTEMPTS = 8;
export const WEBHOOK_LEASE_MS = 120_000;
export const WEBHOOK_RETRY_BASE_MS = 5_000;
export const WEBHOOK_RETRY_CAP_MS = 15 * 60_000;

const TERMINAL_WEBHOOK_CODES = new Set([
  "FIELD_WORKER_UNKNOWN",
  "FIELD_WORKER_AMBIGUOUS",
  "FIELD_WORKER_CANONICAL_BLOCKED",
  "FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT",
  "FIELD_WORKER_INVALID_PHONE",
  "WEBHOOK_PAYLOAD_INVALID",
  "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
  "WEBHOOK_OUTCOME_INVALID",
  "WEBHOOK_SUBSCRIPTION_BLOCKED",
  "WHATSAPP_FLOW_REPLY_INVALID",
  "WHATSAPP_FLOW_SESSION_CONFLICT",
  "WHATSAPP_FLOW_SESSION_EXPIRED",
  "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
  "WHATSAPP_FLOW_SESSION_INVALID",
  "WHATSAPP_FLOW_SESSION_USED",
  "WHATSAPP_AUTOMATIC_DELIVERY_REJECTED",
  "WHATSAPP_AUTOMATIC_DELIVERY_UNKNOWN",
  // Media uploads use a deterministic private-storage identity. Once the
  // lifecycle ledger classifies an attempt as terminal or uncertain it must
  // be cleaned up, not dispatched again by the generic webhook retry loop.
  "WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN",
  "WHATSAPP_MEDIA_ASSET_UPLOAD_FAILED",
  "WHATSAPP_MEDIA_ASSET_IDEMPOTENCY_REUSED",
  "WHATSAPP_MEDIA_ASSET_STORAGE_SCOPE",
  "WHATSAPP_MEDIA_ASSET_STORAGE_INVALID",
  "WHATSAPP_MEDIA_ASSET_PROVIDER_DRIFT",
  "WHATSAPP_MEDIA_ASSET_SIZE_MISMATCH",
  "WHATSAPP_MEDIA_ASSET_MIME_MISMATCH",
  "WHATSAPP_MEDIA_ASSET_KIND_MIME_MISMATCH",
  "WHATSAPP_MEDIA_ASSET_RESOURCE_TYPE_MISMATCH",
  "WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID",
  "WHATSAPP_MEDIA_ASSET_RETENTION_EXPIRED",
  "WHATSAPP_MEDIA_ASSET_DESCRIPTOR_INVALID",
  "WHATSAPP_MEDIA_ASSET_NOT_AVAILABLE",
  "WHATSAPP_MEDIA_ASSET_EXPIRED",
  "WHATSAPP_MEDIA_ASSET_ALREADY_CLAIMED",
  "WHATSAPP_MEDIA_ASSET_MESSAGE_SCOPE_MISMATCH",
  "WHATSAPP_MEDIA_ASSET_CLAIM_CONFLICT",
]);

const MESSAGE_OUTCOME_VERSION = 1;
const MAX_WHATSAPP_TEXT_LENGTH = 4_096;
const FLOW_PROMPT_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const FLOW_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROGRESS_EVIDENCE_LOCATION_DELIVERY_VERSION = 1;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PAYMENT_DESTINATION_TEXT_MARKER = '[destino de cobro restringido]';
const PAYMENT_ALIAS_DISCLOSURE_PATTERN = /\bmi\s+alias(?:\s+(?:bancario|de\s+cobro))?\s*(?:es|:)\s*[a-z0-9][a-z0-9.-]{0,63}(?![a-z0-9.-])/iu;
const PAYMENT_ACCOUNT_DISCLOSURE_PATTERN = /\b(?:mi\s+)?(?:cbu|cvu)(?:\s+(?:bancario|de\s+cobro))?\s*(?:es|:)\s*[0-9][0-9\s.-]{5,63}/iu;

function invalidWebhookOutcome() {
  const error = new Error("Stored webhook outcome is not a supported delivery envelope.");
  error.code = "WEBHOOK_OUTCOME_INVALID";
  return error;
}

export function createMessageWebhookOutcome({
  reply,
  flowPrompt = null,
  flowSessionId = null,
  progressEvidenceLocationDelivery = null,
} = {}) {
  if (typeof reply !== "string" || !reply.trim()) throw invalidWebhookOutcome();
  const normalizedFlowPrompt = flowPrompt === null || flowPrompt === undefined || flowPrompt === ""
    ? null
    : String(flowPrompt).trim();
  if (normalizedFlowPrompt && !FLOW_PROMPT_PATTERN.test(normalizedFlowPrompt)) {
    throw invalidWebhookOutcome();
  }
  const normalizedFlowSessionId = flowSessionId === null
    || flowSessionId === undefined
    || flowSessionId === ""
    ? null
    : String(flowSessionId).trim().toLowerCase();
  if (
    normalizedFlowSessionId
    && (
      !normalizedFlowPrompt
      || !FLOW_SESSION_ID_PATTERN.test(normalizedFlowSessionId)
    )
  ) {
    throw invalidWebhookOutcome();
  }
  const normalizedProgressEvidenceLocationDelivery = normalizeProgressEvidenceLocationDelivery(
    progressEvidenceLocationDelivery,
  );
  if (normalizedProgressEvidenceLocationDelivery && normalizedFlowPrompt) {
    throw invalidWebhookOutcome();
  }
  return {
    version: MESSAGE_OUTCOME_VERSION,
    type: "message",
    reply: reply.slice(0, MAX_WHATSAPP_TEXT_LENGTH),
    flowPrompt: normalizedFlowPrompt,
    ...(normalizedFlowSessionId ? { flowSessionId: normalizedFlowSessionId } : {}),
    ...(normalizedProgressEvidenceLocationDelivery
      ? { progressEvidenceLocationDelivery: normalizedProgressEvidenceLocationDelivery }
      : {}),
  };
}

function normalizeProgressEvidenceLocationDelivery(value) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidWebhookOutcome();
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 2
    || keys[0] !== "sessionId"
    || keys[1] !== "version"
    || value.version !== PROGRESS_EVIDENCE_LOCATION_DELIVERY_VERSION
  ) {
    throw invalidWebhookOutcome();
  }
  const sessionId = typeof value.sessionId === "string"
    ? value.sessionId.trim().toLowerCase()
    : "";
  if (!FLOW_SESSION_ID_PATTERN.test(sessionId)) throw invalidWebhookOutcome();
  return {
    version: PROGRESS_EVIDENCE_LOCATION_DELIVERY_VERSION,
    sessionId,
  };
}

export function readAppliedMessageWebhookOutcome(webhookEvent) {
  if (!webhookEvent?.appliedAt) return null;
  const outcome = webhookEvent.outcome;
  if (
    !outcome
    || outcome.version !== MESSAGE_OUTCOME_VERSION
    || outcome.type !== "message"
    || typeof outcome.reply !== "string"
    || !outcome.reply.trim()
    || outcome.reply.length > MAX_WHATSAPP_TEXT_LENGTH
    || (
      outcome.flowPrompt !== null
      && outcome.flowPrompt !== undefined
      && (
        typeof outcome.flowPrompt !== "string"
        || !FLOW_PROMPT_PATTERN.test(outcome.flowPrompt)
      )
    )
    || (
      outcome.flowSessionId !== null
      && outcome.flowSessionId !== undefined
      && (
        typeof outcome.flowSessionId !== "string"
        || !outcome.flowPrompt
        || !FLOW_SESSION_ID_PATTERN.test(outcome.flowSessionId)
      )
    )
  ) {
    throw invalidWebhookOutcome();
  }
  const progressEvidenceLocationDelivery = normalizeProgressEvidenceLocationDelivery(
    outcome.progressEvidenceLocationDelivery,
  );
  if (progressEvidenceLocationDelivery && outcome.flowPrompt) {
    throw invalidWebhookOutcome();
  }
  return {
    version: MESSAGE_OUTCOME_VERSION,
    type: "message",
    reply: outcome.reply,
    flowPrompt: outcome.flowPrompt || null,
    ...(outcome.flowSessionId ? { flowSessionId: outcome.flowSessionId } : {}),
    ...(progressEvidenceLocationDelivery ? { progressEvidenceLocationDelivery } : {}),
  };
}

export function isTerminalWebhookFailure(error) {
  return TERMINAL_WEBHOOK_CODES.has(error?.code);
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stableHash(value) {
  let hash = 2_166_136_261;
  for (const character of String(value || "webhook")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function webhookRetryDelayMs({ attempts, externalId }) {
  const normalizedAttempts = Math.max(1, Math.floor(Number(attempts) || 1));
  const exponentialDelay = Math.min(
    WEBHOOK_RETRY_CAP_MS,
    WEBHOOK_RETRY_BASE_MS * (2 ** (normalizedAttempts - 1)),
  );
  const jitterUnit = stableHash(`${externalId || "webhook"}:${normalizedAttempts}`) / 0xffff_ffff;
  const jitterMultiplier = 0.8 + (jitterUnit * 0.4);
  return Math.min(WEBHOOK_RETRY_CAP_MS, Math.max(1_000, Math.round(exponentialDelay * jitterMultiplier)));
}

export function webhookFailureTransition({ attempts, externalId, now = new Date() }) {
  const normalizedAttempts = Math.max(0, Math.floor(Number(attempts) || 0));
  if (normalizedAttempts >= WEBHOOK_MAX_ATTEMPTS) {
    return { status: "FAILED", nextAttemptAt: null };
  }
  return {
    status: "PENDING",
    nextAttemptAt: new Date(
      validDate(now).getTime() + webhookRetryDelayMs({ attempts: normalizedAttempts, externalId }),
    ),
  };
}

export function isWebhookEventEligible(event, now = new Date()) {
  if (!event || Number(event.attempts || 0) >= WEBHOOK_MAX_ATTEMPTS) return false;
  const currentTime = validDate(now)?.getTime();
  if (currentTime === undefined || currentTime === null) return false;

  if (event.status === "PENDING") {
    const nextAttemptAt = validDate(event.nextAttemptAt);
    return !nextAttemptAt || nextAttemptAt.getTime() <= currentTime;
  }
  if (event.status === "PROCESSING") {
    const leaseExpiresAt = validDate(event.leaseExpiresAt);
    return !leaseExpiresAt || leaseExpiresAt.getTime() <= currentTime;
  }
  return false;
}

export function shouldDeadLetterWebhookEvent(event, now = new Date()) {
  if (!event || Number(event.attempts || 0) < WEBHOOK_MAX_ATTEMPTS) return false;
  if (event.status === "PENDING") return true;
  if (event.status !== "PROCESSING") return false;
  const leaseExpiresAt = validDate(event.leaseExpiresAt);
  const currentTime = validDate(now)?.getTime();
  return currentTime !== undefined
    && currentTime !== null
    && (!leaseExpiresAt || leaseExpiresAt.getTime() <= currentTime);
}

function boundedPersistenceText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizedPaymentDisclosureText(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsTwentyTwoDigitPaymentDestination(value) {
  const text = normalizedPaymentDisclosureText(value);
  for (const match of text.matchAll(/\d(?:[\s.-]*\d)*/gu)) {
    if (match[0].replace(/\D/gu, '').length === 22) return true;
  }
  return false;
}

function containsExplicitPaymentDestination(value) {
  const text = normalizedPaymentDisclosureText(value);
  return PAYMENT_ALIAS_DISCLOSURE_PATTERN.test(text)
    || PAYMENT_ACCOUNT_DISCLOSURE_PATTERN.test(text);
}

function shouldRedactMetaPaymentText(event) {
  if (
    event?.provider !== 'meta'
    || event?.eventType !== 'message'
    || String(event?.kind || '').trim().toLowerCase() !== 'text'
  ) return false;

  const bodies = [event.text, event.raw?.text?.body];
  return bodies.some((body) => (
    containsTwentyTwoDigitPaymentDestination(body)
    || containsExplicitPaymentDestination(body)
  ));
}

function persistedMetaPaymentText(event) {
  const raw = event?.raw;
  return {
    provider: 'meta',
    eventType: 'message',
    externalId: event.externalId,
    phoneNumberId: event.phoneNumberId || null,
    businessDisplayPhone: event.businessDisplayPhone || null,
    from: event.from || '',
    displayName: event.displayName || null,
    timestamp: event.timestamp,
    kind: 'text',
    text: PAYMENT_DESTINATION_TEXT_MARKER,
    location: null,
    media: null,
    interactive: null,
    context: null,
    raw: {
      id: boundedPersistenceText(raw?.id || event.externalId, 500),
      from: boundedPersistenceText(raw?.from || event.from, 80),
      timestamp: boundedPersistenceText(raw?.timestamp, 32),
      type: 'text',
      text: { body: PAYMENT_DESTINATION_TEXT_MARKER },
    },
  };
}

function persistedFlowTokenEvidence(value) {
  const sessionId = String(value?.sessionId || '').trim().toLowerCase();
  const tokenSha256 = String(value?.tokenSha256 || '').trim().toLowerCase();
  if (!FLOW_SESSION_ID_PATTERN.test(sessionId) || !SHA256_PATTERN.test(tokenSha256)) return null;
  return {
    ...(value?.kind === 'worker_onboarding' ? { kind: 'worker_onboarding' } : {}),
    sessionId,
    tokenSha256,
  };
}

function persistedMetaFlowRaw(event, response) {
  const raw = event?.raw;
  const name = boundedPersistenceText(event?.interactive?.name, 200);
  const body = boundedPersistenceText(event?.text, MAX_WHATSAPP_TEXT_LENGTH);
  return {
    id: boundedPersistenceText(raw?.id || event?.externalId, 500),
    from: boundedPersistenceText(raw?.from || event?.from, 80),
    timestamp: boundedPersistenceText(raw?.timestamp, 32),
    type: 'interactive',
    interactive: {
      type: 'nfm_reply',
      nfm_reply: {
        ...(name ? { name } : {}),
        ...(body ? { body } : {}),
        response_json: JSON.stringify(response),
      },
    },
  };
}

function persistedWebhookEvent(event) {
  if (shouldRedactMetaPaymentText(event)) return persistedMetaPaymentText(event);
  if (event?.provider !== 'meta' || event?.interactive?.type !== 'flow') return event;

  const response = projectWhatsAppFlowReplyForPersistence(event.interactive.response);
  return {
    provider: 'meta',
    eventType: 'message',
    externalId: event.externalId,
    phoneNumberId: event.phoneNumberId || null,
    businessDisplayPhone: event.businessDisplayPhone || null,
    from: event.from || '',
    displayName: event.displayName || null,
    timestamp: event.timestamp,
    kind: 'interactive',
    text: boundedPersistenceText(event.text, MAX_WHATSAPP_TEXT_LENGTH)
      || 'Formulario de WhatsApp completado',
    location: null,
    media: null,
    interactive: {
      type: 'flow',
      name: boundedPersistenceText(event.interactive.name, 200),
      response,
      flowToken: persistedFlowTokenEvidence(event.interactive.flowToken),
    },
    context: null,
    raw: persistedMetaFlowRaw(event, response),
  };
}

export function serializeWebhookPayload(event, scope) {
  return JSON.parse(JSON.stringify({
    version: 1,
    event: persistedWebhookEvent(event),
    scope: {
      projectId: scope?.projectId || null,
      organizationId: scope?.organizationId || null,
      phoneNumberId: scope?.phoneNumberId || null,
      whatsappBusinessId: scope?.whatsappBusinessId || null,
      displayPhoneNumber: scope?.displayPhoneNumber || null,
    },
  }));
}

export function scopedWebhookExternalId(projectId, externalId) {
  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
  const normalizedExternalId = typeof externalId === "string" ? externalId.trim() : "";
  if (!normalizedProjectId || !normalizedExternalId) {
    const error = new Error("A project and provider event ID are required to scope a webhook event.");
    error.code = "WEBHOOK_PAYLOAD_INVALID";
    throw error;
  }
  return `project:${normalizedProjectId}:${normalizedExternalId}`;
}

function invalidWebhookPayload() {
  const error = new Error("Stored webhook payload is not a supported normalized event.");
  error.code = "WEBHOOK_PAYLOAD_INVALID";
  return error;
}

export function deserializeWebhookPayload(payload) {
  if (
    !payload
    || payload.version !== 1
    || !payload.event
    || !payload.scope
    || typeof payload.event.externalId !== "string"
    || !payload.event.externalId.trim()
    || typeof payload.event.eventType !== "string"
    || !payload.event.eventType.trim()
    || typeof payload.scope.projectId !== "string"
    || !payload.scope.projectId.trim()
    || typeof payload.scope.organizationId !== "string"
    || !payload.scope.organizationId.trim()
  ) {
    throw invalidWebhookPayload();
  }
  const timestamp = validDate(payload.event.timestamp);
  if (!timestamp) throw invalidWebhookPayload();
  return {
    event: {
      ...payload.event,
      timestamp: timestamp || new Date(),
    },
    scope: { ...payload.scope },
  };
}

export async function drainWebhookProjectQueue({
  projectId,
  acquire,
  process,
  complete,
  reschedule,
  maxEvents = 10,
}) {
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < maxEvents; index += 1) {
    const leasedEvent = await acquire(projectId);
    if (!leasedEvent) break;
    try {
      await process(leasedEvent);
      const accepted = await complete(leasedEvent);
      if (accepted === false) break;
      completed += 1;
    } catch (error) {
      const transition = await reschedule(leasedEvent, error);
      if (transition?.status === "FAILED") {
        failed += 1;
        continue;
      }
      return { completed, failed, blocked: true };
    }
  }
  return { completed, failed, blocked: false };
}
