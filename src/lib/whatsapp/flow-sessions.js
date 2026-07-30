import crypto from "node:crypto";

export const DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS = 30 * 60 * 1_000;
export const MIN_WHATSAPP_FLOW_DELIVERY_REMAINING_MS = 5 * 60 * 1_000;

const MAX_WHATSAPP_FLOW_SESSION_TTL_MS = 24 * 60 * 60 * 1_000;
const TOKEN_VERSION = "ofs1";
const LOCAL_DEVELOPMENT_SECRET = "obrasaas-local-only-whatsapp-flow-session-secret";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^ofs1\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

const ERROR_STATUS = Object.freeze({
  WHATSAPP_FLOW_SESSION_INPUT_INVALID: 400,
  WHATSAPP_FLOW_SESSION_INVALID: 401,
  WHATSAPP_FLOW_SESSION_CONFLICT: 409,
  WHATSAPP_FLOW_SESSION_USED: 409,
  WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT: 409,
  WHATSAPP_FLOW_SESSION_EXPIRED: 410,
  WHATSAPP_FLOW_TOKEN_SECRET_INVALID: 503,
  WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED: 503,
});

export class WhatsAppFlowSessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WhatsAppFlowSessionError";
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function flowSessionError(message, code) {
  return new WhatsAppFlowSessionError(message, code);
}

function validatedFlowTokenSecret(value) {
  const secret = typeof value === "string" ? value.trim() : "";
  if (!secret) return null;
  if (
    Buffer.byteLength(secret, "utf8") < 32
    || /replace-with|change-?me|placeholder|example-secret/i.test(secret)
  ) {
    throw flowSessionError(
      "WHATSAPP_FLOW_TOKEN_SECRET must be an independent secret of at least 32 bytes.",
      "WHATSAPP_FLOW_TOKEN_SECRET_INVALID",
    );
  }
  return secret;
}

export function assertWhatsAppFlowTokenSecret(explicitSecret, {
  allowDevelopmentFallback = false,
} = {}) {
  const secret = validatedFlowTokenSecret(
    explicitSecret,
  );
  if (secret) return secret;
  if (allowDevelopmentFallback && ["development", "test"].includes(process.env.NODE_ENV)) {
    return LOCAL_DEVELOPMENT_SECRET;
  }
  throw flowSessionError(
    "WHATSAPP_FLOW_TOKEN_SECRET is required outside explicit development or test runtimes.",
    "WHATSAPP_FLOW_TOKEN_SECRET_REQUIRED",
  );
}

function flowTokenSecret(explicitSecret) {
  return assertWhatsAppFlowTokenSecret(
    explicitSecret ?? process.env.WHATSAPP_FLOW_TOKEN_SECRET,
    { allowDevelopmentFallback: true },
  );
}

function boundedText(value, { name, max, pattern = null }) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
    || (pattern && !pattern.test(normalized))
  ) {
    throw flowSessionError(
      `Invalid WhatsApp Flow session ${name}.`,
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return normalized;
}

function normalizeRecipient(value) {
  const raw = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  const recipient = raw.startsWith("+") ? raw.slice(1) : raw;
  if (!/^\d{8,20}$/.test(recipient)) {
    throw flowSessionError(
      "Invalid WhatsApp Flow session recipient.",
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return recipient;
}

function validDate(value, name = "date") {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw flowSessionError(
      `Invalid WhatsApp Flow session ${name}.`,
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return date;
}

function normalizeImmutableInput(input = {}) {
  return {
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    workerId: boundedText(input.workerId, { name: "worker", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    recipientPhone: normalizeRecipient(input.recipientPhone ?? input.recipient),
    blueprintKey: boundedText(input.blueprintKey, {
      name: "blueprint key",
      max: 100,
      pattern: /^[a-z0-9][a-z0-9-]{0,99}$/,
    }),
    flowId: boundedText(input.flowId, {
      name: "Flow ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    screenId: boundedText(input.screenId, {
      name: "screen ID",
      max: 30,
      pattern: /^[A-Z][A-Z0-9_]{0,29}$/,
    }),
    flowType: boundedText(input.flowType, {
      name: "Flow type",
      max: 64,
      pattern: /^[a-z0-9][a-z0-9_-]{0,63}$/,
    }),
    sourceExternalId: boundedText(input.sourceExternalId, {
      name: "source external ID",
      max: 512,
    }),
  };
}

function normalizeDeliveryInput(input = {}) {
  const normalized = {
    sessionId: boundedText(input.sessionId ?? input.id, {
      name: "session ID",
      max: 36,
      pattern: UUID_PATTERN,
    }).toLowerCase(),
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    recipientPhone: normalizeRecipient(input.recipientPhone ?? input.recipient),
    blueprintKey: boundedText(input.blueprintKey, {
      name: "blueprint key",
      max: 100,
      pattern: /^[a-z0-9][a-z0-9-]{0,99}$/,
    }),
    flowId: boundedText(input.flowId, {
      name: "Flow ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    screenId: boundedText(input.screenId, {
      name: "screen ID",
      max: 30,
      pattern: /^[A-Z][A-Z0-9_]{0,29}$/,
    }),
    flowType: boundedText(input.flowType, {
      name: "Flow type",
      max: 64,
      pattern: /^[a-z0-9][a-z0-9_-]{0,63}$/,
    }),
  };
  if (input.workerId) {
    normalized.workerId = boundedText(input.workerId, { name: "worker", max: 191 });
  }
  if (input.sourceExternalId) {
    normalized.sourceExternalId = boundedText(input.sourceExternalId, {
      name: "source external ID",
      max: 512,
    });
  }
  return normalized;
}

function normalizeSentFenceInput(input = {}) {
  return {
    sessionId: boundedText(input.sessionId ?? input.id, {
      name: "session ID",
      max: 36,
      pattern: UUID_PATTERN,
    }).toLowerCase(),
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    recipientPhone: normalizeRecipient(input.recipientPhone ?? input.recipient),
    blueprintKey: boundedText(input.blueprintKey, {
      name: "blueprint key",
      max: 100,
      pattern: /^[a-z0-9][a-z0-9-]{0,99}$/,
    }),
    sourceExternalId: boundedText(input.sourceExternalId, {
      name: "source external ID",
      max: 512,
    }),
  };
}

function normalizeConsumptionInput(input = {}) {
  const normalized = {
    tokenEvidence: normalizeTokenEvidence(input),
    consumedExternalId: boundedText(input.consumedExternalId, {
      name: "consumer external ID",
      max: 512,
    }),
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    workerId: boundedText(input.workerId, { name: "worker", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    recipientPhone: normalizeRecipient(input.recipientPhone ?? input.recipient),
  };
  if (input.blueprintKey) {
    normalized.blueprintKey = boundedText(input.blueprintKey, {
      name: "blueprint key",
      max: 100,
      pattern: /^[a-z0-9][a-z0-9-]{0,99}$/,
    });
  }
  if (input.flowId) {
    normalized.flowId = boundedText(input.flowId, {
      name: "Flow ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    });
  }
  if (input.screenId) {
    normalized.screenId = boundedText(input.screenId, {
      name: "screen ID",
      max: 30,
      pattern: /^[A-Z][A-Z0-9_]{0,29}$/,
    });
  }
  if (input.flowType) {
    normalized.flowType = boundedText(input.flowType, {
      name: "Flow type",
      max: 64,
      pattern: /^[a-z0-9][a-z0-9_-]{0,63}$/,
    });
  }
  return normalized;
}

function normalizeDataEndpointAuthenticationInput(input = {}) {
  return {
    tokenEvidence: normalizeTokenEvidence(input),
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
  };
}

function normalizeNow(value) {
  return validDate(value ?? new Date(), "clock");
}

function normalizeSessionId(input = {}) {
  return boundedText(input.sessionId ?? input.id, {
    name: "session ID",
    max: 36,
    pattern: UUID_PATTERN,
  }).toLowerCase();
}

function normalizeTtl(value) {
  const ttlMs = value ?? DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS;
  if (
    !Number.isSafeInteger(ttlMs)
    || ttlMs <= 0
    || ttlMs > MAX_WHATSAPP_FLOW_SESSION_TTL_MS
  ) {
    throw flowSessionError(
      "Invalid WhatsApp Flow session TTL.",
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return ttlMs;
}

function sessionDelegate(prisma) {
  const delegate = prisma?.whatsAppFlowSession;
  if (
    !delegate
    || typeof delegate.findUnique !== "function"
    || typeof delegate.create !== "function"
    || typeof delegate.updateMany !== "function"
  ) {
    throw flowSessionError(
      "A WhatsApp Flow session persistence adapter is required.",
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return delegate;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionClaims(session) {
  const id = String(session?.id || "").toLowerCase();
  if (!UUID_PATTERN.test(id)) {
    throw flowSessionError(
      "Stored WhatsApp Flow session identity is invalid.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  return [
    TOKEN_VERSION,
    id,
    String(session.organizationId || ""),
    String(session.projectId || ""),
    String(session.workerId || ""),
    String(session.phoneNumberId || ""),
    String(session.recipientPhone || ""),
    String(session.blueprintKey || ""),
    String(session.flowId || ""),
    String(session.screenId || ""),
    String(session.flowType || ""),
    String(session.sourceExternalId || ""),
    validDate(session.expiresAt, "expiration").toISOString(),
  ];
}

function signedTokenForSession(session, secret) {
  const claims = sessionClaims(session);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(claims))
    .digest("base64url");
  return `${TOKEN_VERSION}.${claims[1]}.${signature}`;
}

function assertStoredTokenIntegrity(session, token) {
  const evidence = whatsAppFlowTokenEvidence(token);
  if (
    evidence.sessionId !== String(session.id).toLowerCase()
    || !constantTimeEqual(evidence.tokenSha256, session.tokenSha256)
  ) {
    throw flowSessionError(
      "WhatsApp Flow token evidence does not match its session.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  return evidence;
}

function tokenForStoredSession(session, secret) {
  const token = signedTokenForSession(session, secret);
  assertStoredTokenIntegrity(session, token);
  return token;
}

function sameImmutableBinding(session, binding) {
  return [
    "organizationId",
    "projectId",
    "workerId",
    "phoneNumberId",
    "recipientPhone",
    "blueprintKey",
    "flowId",
    "screenId",
    "flowType",
    "sourceExternalId",
  ].every((field) => String(session?.[field] || "") === binding[field]);
}

function sameConsumptionScope(session, input) {
  const requiredFields = [
    "organizationId",
    "projectId",
    "workerId",
    "phoneNumberId",
    "recipientPhone",
  ];
  const optionalFields = ["blueprintKey", "flowId", "screenId", "flowType"];
  return requiredFields.every((field) => String(session?.[field] || "") === input[field])
    && optionalFields.every((field) => (
      input[field] === undefined || String(session?.[field] || "") === input[field]
    ));
}

function sameDeliveryScope(session, input) {
  const requiredFields = [
    "organizationId",
    "projectId",
    "phoneNumberId",
    "recipientPhone",
    "blueprintKey",
    "flowId",
    "screenId",
    "flowType",
  ];
  const optionalFields = ["workerId", "sourceExternalId"];
  return requiredFields.every((field) => String(session?.[field] || "") === input[field])
    && optionalFields.every((field) => (
      input[field] === undefined || String(session?.[field] || "") === input[field]
    ));
}

function sameSentFenceScope(session, input) {
  return [
    "organizationId",
    "projectId",
    "phoneNumberId",
    "recipientPhone",
    "blueprintKey",
    "sourceExternalId",
  ].every((field) => String(session?.[field] || "") === input[field]);
}

function assertSessionNotExpired(session, now, minRemainingMs = 0) {
  if (
    !Number.isSafeInteger(minRemainingMs)
    || minRemainingMs < 0
    || minRemainingMs > MAX_WHATSAPP_FLOW_SESSION_TTL_MS
  ) {
    throw flowSessionError(
      "Invalid WhatsApp Flow delivery safety window.",
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  if (sessionExpired(session, now, minRemainingMs)) {
    throw flowSessionError(
      "The WhatsApp Flow session expired.",
      "WHATSAPP_FLOW_SESSION_EXPIRED",
    );
  }
}

function sessionExpired(session, now, minRemainingMs = 0) {
  return validDate(session.expiresAt, "expiration").getTime()
    <= now.getTime() + minRemainingMs;
}

function assertSessionNotConsumed(session) {
  if (session.consumedAt) {
    throw flowSessionError(
      "The WhatsApp Flow session was already used.",
      "WHATSAPP_FLOW_SESSION_USED",
    );
  }
}

function isUniqueConstraintError(error) {
  return error?.code === "P2002" || error?.code === "23505";
}

function sessionUniqueWhere(binding) {
  return {
    projectId_sourceExternalId_blueprintKey: {
      projectId: binding.projectId,
      sourceExternalId: binding.sourceExternalId,
      blueprintKey: binding.blueprintKey,
    },
  };
}

async function readSessionByBinding(delegate, binding) {
  return delegate.findUnique({ where: sessionUniqueWhere(binding) });
}

function idempotentIssuedSession(existing, binding, secret) {
  if (!sameImmutableBinding(existing, binding)) {
    throw flowSessionError(
      "The source event is already bound to a different WhatsApp Flow session.",
      "WHATSAPP_FLOW_SESSION_CONFLICT",
    );
  }
  return {
    session: existing,
    token: tokenForStoredSession(existing, secret),
  };
}

/**
 * Parse immutable evidence from a Flow token without authenticating it. The
 * caller must still load the session and verify the HMAC against stored claims.
 */
export function whatsAppFlowTokenEvidence(raw) {
  const token = typeof raw === "string" ? raw.trim() : "";
  const match = TOKEN_PATTERN.exec(token);
  if (!match) {
    throw flowSessionError(
      "Invalid WhatsApp Flow token.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  return {
    sessionId: match[1],
    tokenSha256: crypto.createHash("sha256").update(token).digest("hex"),
  };
}

function normalizeTokenEvidence(input = {}) {
  const provided = input.tokenEvidence;
  let evidence = null;
  if (provided && typeof provided === "object" && !Array.isArray(provided)) {
    const sessionId = typeof provided.sessionId === "string"
      ? provided.sessionId.trim().toLowerCase()
      : "";
    const tokenSha256 = typeof provided.tokenSha256 === "string"
      ? provided.tokenSha256.trim().toLowerCase()
      : "";
    if (!UUID_PATTERN.test(sessionId) || !/^[a-f0-9]{64}$/.test(tokenSha256)) {
      throw flowSessionError(
        "WhatsApp Flow token evidence is invalid.",
        "WHATSAPP_FLOW_SESSION_INVALID",
      );
    }
    evidence = { sessionId, tokenSha256 };
  }

  if (input.token !== undefined && input.token !== null && input.token !== "") {
    const rawEvidence = whatsAppFlowTokenEvidence(input.token);
    if (
      evidence
      && (
        evidence.sessionId !== rawEvidence.sessionId
        || !constantTimeEqual(evidence.tokenSha256, rawEvidence.tokenSha256)
      )
    ) {
      throw flowSessionError(
        "WhatsApp Flow token evidence is invalid.",
        "WHATSAPP_FLOW_SESSION_INVALID",
      );
    }
    evidence = rawEvidence;
  }

  if (!evidence) {
    throw flowSessionError(
      "WhatsApp Flow token evidence is required.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  return evidence;
}

export async function issueWhatsAppFlowSession(
  prisma,
  input,
  {
    secret,
    now = new Date(),
    ttlMs = DEFAULT_WHATSAPP_FLOW_SESSION_TTL_MS,
    propagateUniqueConstraint = false,
  } = {},
) {
  const delegate = sessionDelegate(prisma);
  const binding = normalizeImmutableInput(input);
  const issuedAt = normalizeNow(now);
  const lifetimeMs = normalizeTtl(ttlMs);
  const signingSecret = flowTokenSecret(secret);

  const existing = await readSessionByBinding(delegate, binding);
  if (existing) return idempotentIssuedSession(existing, binding, signingSecret);

  const draft = {
    id: crypto.randomUUID(),
    ...binding,
    expiresAt: new Date(issuedAt.getTime() + lifetimeMs),
  };
  const token = signedTokenForSession(draft, signingSecret);
  const { tokenSha256 } = whatsAppFlowTokenEvidence(token);

  try {
    const session = await delegate.create({
      data: {
        ...draft,
        tokenSha256,
      },
    });
    assertStoredTokenIntegrity(session, token);
    return { session, token };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    // A PostgreSQL unique violation aborts an interactive transaction. Let a
    // transaction-owning orchestrator retry the whole unit instead of querying
    // again through an already-aborted transaction client.
    if (propagateUniqueConstraint) throw error;
    const raced = await readSessionByBinding(delegate, binding);
    if (raced) return idempotentIssuedSession(raced, binding, signingSecret);
    throw flowSessionError(
      "WhatsApp Flow session uniqueness could not be established.",
      "WHATSAPP_FLOW_SESSION_CONFLICT",
    );
  }
}

export async function getWhatsAppFlowSessionForDelivery(
  prisma,
  input,
  {
    secret,
    now = new Date(),
    minRemainingMs = MIN_WHATSAPP_FLOW_DELIVERY_REMAINING_MS,
  } = {},
) {
  const delegate = sessionDelegate(prisma);
  const delivery = normalizeDeliveryInput(input);
  const deliveryTime = normalizeNow(now);
  const session = await delegate.findUnique({ where: { id: delivery.sessionId } });
  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session was not found.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (!sameDeliveryScope(session, delivery)) {
    throw flowSessionError(
      "WhatsApp Flow delivery scope does not match its session.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (session.sentAt || session.consumedAt || session.deliveryRejectedAt) {
    return { session, token: null };
  }
  const signingSecret = flowTokenSecret(secret);
  const token = tokenForStoredSession(session, signingSecret);
  assertSessionNotExpired(session, deliveryTime, minRemainingMs);
  assertSessionNotConsumed(session);
  return { session, token };
}

export async function getWhatsAppFlowSessionSentFence(prisma, input) {
  const delegate = sessionDelegate(prisma);
  const fence = normalizeSentFenceInput(input);
  const session = await delegate.findUnique({ where: { id: fence.sessionId } });
  if (!session || !sameSentFenceScope(session, fence)) {
    throw flowSessionError(
      "WhatsApp Flow sent fence does not match its immutable scope.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  return { session };
}

/**
 * Authenticate a raw Flow token for the encrypted Data Endpoint without
 * consuming the generic session. Generic operational INIT/data_exchange calls
 * are read-only. The payment-destination companion may persist its governed
 * submission during data_exchange, but the terminal nfm_reply remains the only
 * path allowed to claim the generic session and apply downstream effects.
 */
export async function authenticateWhatsAppFlowDataSession(
  prisma,
  input,
  { secret, now = new Date(), allowExpired = false } = {},
) {
  const delegate = sessionDelegate(prisma);
  const authentication = normalizeDataEndpointAuthenticationInput(input);
  const authenticatedAt = normalizeNow(now);
  const signingSecret = flowTokenSecret(secret);
  const evidence = authentication.tokenEvidence;
  if (typeof allowExpired !== "boolean") {
    throw flowSessionError(
      "Invalid WhatsApp Flow expiry authentication policy.",
      "WHATSAPP_FLOW_SESSION_INPUT_INVALID",
    );
  }
  const session = await delegate.findUnique({ where: { id: evidence.sessionId } });

  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }

  const expectedToken = signedTokenForSession(session, signingSecret);
  const expectedEvidence = whatsAppFlowTokenEvidence(expectedToken);
  if (
    evidence.sessionId !== expectedEvidence.sessionId
    || !constantTimeEqual(evidence.tokenSha256, expectedEvidence.tokenSha256)
    || !constantTimeEqual(evidence.tokenSha256, session.tokenSha256)
  ) {
    throw flowSessionError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }

  if (
    String(session.organizationId || "") !== authentication.organizationId
    || String(session.projectId || "") !== authentication.projectId
    || String(session.phoneNumberId || "") !== authentication.phoneNumberId
  ) {
    throw flowSessionError(
      "WhatsApp Flow session does not belong to this Data Endpoint.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (!session.deliveryAttemptedAt || session.deliveryRejectedAt) {
    throw flowSessionError(
      "WhatsApp Flow session was not in a deliverable state.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  assertSessionNotConsumed(session);
  // Expiry bypass is an explicit low-level capability used only by the
  // payment terminal-receipt recovery path. Callers must still prove the
  // specialized session is SUCCEEDED and inside its bounded replay grace.
  if (!allowExpired) assertSessionNotExpired(session, authenticatedAt);
  return { session };
}

export async function consumeWhatsAppFlowSession(
  prisma,
  input,
  {
    secret,
    now = new Date(),
    recoverExpired = false,
    beforeConsume,
  } = {},
) {
  const delegate = sessionDelegate(prisma);
  const consumption = normalizeConsumptionInput(input);
  const consumedAt = normalizeNow(now);
  const signingSecret = flowTokenSecret(secret);
  const evidence = consumption.tokenEvidence;
  let session = await delegate.findUnique({ where: { id: evidence.sessionId } });
  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }

  const expectedToken = signedTokenForSession(session, signingSecret);
  const expectedEvidence = whatsAppFlowTokenEvidence(expectedToken);
  if (
    evidence.sessionId !== expectedEvidence.sessionId
    || !constantTimeEqual(evidence.tokenSha256, expectedEvidence.tokenSha256)
    || !constantTimeEqual(evidence.tokenSha256, session.tokenSha256)
  ) {
    throw flowSessionError(
      "WhatsApp Flow session is invalid.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (!session.deliveryAttemptedAt || session.deliveryRejectedAt) {
    throw flowSessionError(
      "WhatsApp Flow session was not in a deliverable state.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (!sameConsumptionScope(session, consumption)) {
    throw flowSessionError(
      "WhatsApp Flow session scope does not match the inbound reply.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  assertSessionNotConsumed(session);
  const expired = sessionExpired(session, consumedAt);
  if (expired && !recoverExpired) {
    throw flowSessionError(
      "The WhatsApp Flow session expired.",
      "WHATSAPP_FLOW_SESSION_EXPIRED",
    );
  }
  if (beforeConsume !== undefined) {
    if (typeof beforeConsume !== "function") {
      throw flowSessionError(
        "WhatsApp Flow pre-consumption validation is invalid.",
        "WHATSAPP_FLOW_SESSION_CONFIGURATION_INVALID",
      );
    }
    await beforeConsume(prisma, { session, expired });
  }

  let claimed;
  try {
    claimed = await delegate.updateMany({
      where: {
        id: session.id,
        tokenSha256: evidence.tokenSha256,
        organizationId: consumption.organizationId,
        projectId: consumption.projectId,
        workerId: consumption.workerId,
        phoneNumberId: consumption.phoneNumberId,
        recipientPhone: consumption.recipientPhone,
        blueprintKey: session.blueprintKey,
        flowId: session.flowId,
        screenId: session.screenId,
        flowType: session.flowType,
        expiresAt: expired ? { lte: consumedAt } : { gt: consumedAt },
        deliveryAttemptedAt: { not: null },
        deliveryRejectedAt: null,
        consumedAt: null,
      },
      data: {
        consumedAt,
        consumedExternalId: consumption.consumedExternalId,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    throw flowSessionError(
      "The inbound event already consumed another WhatsApp Flow session.",
      "WHATSAPP_FLOW_SESSION_USED",
    );
  }

  if (claimed.count === 1) {
    session = await delegate.findUnique({ where: { id: session.id } });
    return { session, expired };
  }

  session = await delegate.findUnique({ where: { id: session.id } });
  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session was not found.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (!sameConsumptionScope(session, consumption)) {
    throw flowSessionError(
      "WhatsApp Flow session scope changed before it was consumed.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (!recoverExpired) assertSessionNotExpired(session, consumedAt);
  throw flowSessionError(
    "The WhatsApp Flow session was already used.",
    "WHATSAPP_FLOW_SESSION_USED",
  );
}

export async function markWhatsAppFlowSessionDeliveryAttempted(
  prisma,
  input,
  { now = new Date() } = {},
) {
  const delegate = sessionDelegate(prisma);
  const sessionId = normalizeSessionId(input);
  const deliveryAttemptedAt = normalizeNow(now);
  const marked = await delegate.updateMany({
    where: {
      id: sessionId,
      deliveryAttemptedAt: null,
      deliveryRejectedAt: null,
      sentAt: null,
      consumedAt: null,
    },
    data: { deliveryAttemptedAt },
  });
  const session = await delegate.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session was not found.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (marked.count === 1) return { session, alreadyAttempted: false };
  if (session.deliveryAttemptedAt) {
    return { session, alreadyAttempted: true };
  }
  throw flowSessionError(
    "WhatsApp Flow delivery state changed before its attempt could be fenced.",
    "WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
  );
}

export async function markWhatsAppFlowSessionDeliveryRejected(
  prisma,
  input,
  { now = new Date() } = {},
) {
  const delegate = sessionDelegate(prisma);
  const sessionId = normalizeSessionId(input);
  const deliveryRejectedAt = normalizeNow(now);
  const marked = await delegate.updateMany({
    where: {
      id: sessionId,
      deliveryAttemptedAt: { not: null },
      deliveryRejectedAt: null,
      sentAt: null,
      consumedAt: null,
    },
    data: { deliveryRejectedAt },
  });
  const session = await delegate.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session was not found.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (marked.count === 1) return { session, alreadyRejected: false };
  if (session.deliveryRejectedAt) {
    return { session, alreadyRejected: true };
  }
  if (session.sentAt || session.consumedAt) {
    return { session, alreadyRejected: false };
  }
  throw flowSessionError(
    "WhatsApp Flow delivery state changed before its rejection could be fenced.",
    "WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
  );
}

export async function markWhatsAppFlowSessionSent(
  prisma,
  input,
  { now = new Date() } = {},
) {
  const delegate = sessionDelegate(prisma);
  const sessionId = normalizeSessionId(input);
  const providerMessageId = input?.providerMessageId === undefined
    || input?.providerMessageId === null
    || input?.providerMessageId === ""
    ? null
    : boundedText(input.providerMessageId, {
        name: "provider message ID",
        max: 500,
      });
  const sentAt = normalizeNow(now);

  let marked;
  try {
    marked = await delegate.updateMany({
      where: {
        id: sessionId,
        deliveryAttemptedAt: { not: null },
        deliveryRejectedAt: null,
        sentAt: null,
      },
      data: { sentAt, providerMessageId },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    throw flowSessionError(
      "The provider message is already bound to another WhatsApp Flow session.",
      "WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
    );
  }

  const session = await delegate.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw flowSessionError(
      "WhatsApp Flow session was not found.",
      "WHATSAPP_FLOW_SESSION_INVALID",
    );
  }
  if (marked.count === 1) return { session, alreadySent: false };
  if (session.sentAt && session.providerMessageId === providerMessageId) {
    return { session, alreadySent: true };
  }
  throw flowSessionError(
    "The WhatsApp Flow session was already linked to another provider message.",
    "WHATSAPP_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
  );
}
