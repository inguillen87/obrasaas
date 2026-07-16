export const WEBHOOK_MAX_ATTEMPTS = 8;
export const WEBHOOK_LEASE_MS = 120_000;
export const WEBHOOK_RETRY_BASE_MS = 5_000;
export const WEBHOOK_RETRY_CAP_MS = 15 * 60_000;

const TERMINAL_WEBHOOK_CODES = new Set([
  "FIELD_WORKER_UNKNOWN",
  "FIELD_WORKER_AMBIGUOUS",
  "FIELD_WORKER_INVALID_PHONE",
  "WEBHOOK_PAYLOAD_INVALID",
  "WEBHOOK_MESSAGE_SCOPE_MISMATCH",
  "WEBHOOK_OUTCOME_INVALID",
  "WEBHOOK_SUBSCRIPTION_BLOCKED",
]);

const MESSAGE_OUTCOME_VERSION = 1;
const MAX_WHATSAPP_TEXT_LENGTH = 4_096;
const FLOW_PROMPT_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

function invalidWebhookOutcome() {
  const error = new Error("Stored webhook outcome is not a supported delivery envelope.");
  error.code = "WEBHOOK_OUTCOME_INVALID";
  return error;
}

export function createMessageWebhookOutcome({ reply, flowPrompt = null } = {}) {
  if (typeof reply !== "string" || !reply.trim()) throw invalidWebhookOutcome();
  const normalizedFlowPrompt = flowPrompt === null || flowPrompt === undefined || flowPrompt === ""
    ? null
    : String(flowPrompt).trim();
  if (normalizedFlowPrompt && !FLOW_PROMPT_PATTERN.test(normalizedFlowPrompt)) {
    throw invalidWebhookOutcome();
  }
  return {
    version: MESSAGE_OUTCOME_VERSION,
    type: "message",
    reply: reply.slice(0, MAX_WHATSAPP_TEXT_LENGTH),
    flowPrompt: normalizedFlowPrompt,
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
  ) {
    throw invalidWebhookOutcome();
  }
  return {
    version: MESSAGE_OUTCOME_VERSION,
    type: "message",
    reply: outcome.reply,
    flowPrompt: outcome.flowPrompt || null,
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

export function serializeWebhookPayload(event, scope) {
  return JSON.parse(JSON.stringify({
    version: 1,
    event,
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
