import crypto from "node:crypto";
import {
  normalizeWorkerWhatsAppAddress,
  readWorkerFinancialFingerprintKeyRegistry,
  workerFinancialFingerprint,
} from "../worker-financial-data.js";
import {
  assertWorkerOnboardingPrivacyNoticeEvidence,
  WorkerOnboardingPrivacyNoticeError,
} from "../worker-onboarding-privacy-notices.js";

export const DEFAULT_WORKER_ONBOARDING_FLOW_SESSION_TTL_MS = 60 * 60 * 1_000;
export const MIN_WORKER_ONBOARDING_FLOW_DELIVERY_REMAINING_MS = 5 * 60 * 1_000;
export const WORKER_ONBOARDING_FLOW_BLUEPRINT_KEY = "worker-onboarding";
export const WORKER_ONBOARDING_FLOW_SCREEN_ID = "WORKER_ONBOARDING";
export const WORKER_ONBOARDING_FLOW_TYPE = "worker_onboarding";

const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1_000;
const TOKEN_VERSION = "wofs1";
const LOCAL_DEVELOPMENT_SECRET =
  "obrasaas-local-only-worker-onboarding-flow-session-secret";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN_PATTERN =
  /^wofs1\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

const ERROR_STATUS = Object.freeze({
  WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID: 400,
  WORKER_ONBOARDING_FLOW_SESSION_INVALID: 401,
  WORKER_ONBOARDING_FLOW_SESSION_CONFLICT: 409,
  WORKER_ONBOARDING_FLOW_SESSION_USED: 409,
  WORKER_ONBOARDING_FLOW_SESSION_CLAIM_UNAVAILABLE: 409,
  WORKER_ONBOARDING_FLOW_SESSION_DELIVERY_AMBIGUOUS: 409,
  WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT: 409,
  WORKER_ONBOARDING_FLOW_SESSION_EXPIRED: 410,
  WORKER_ONBOARDING_FLOW_SESSION_RETIRED: 410,
  WORKER_ONBOARDING_FLOW_TOKEN_SECRET_INVALID: 503,
  WORKER_ONBOARDING_FLOW_TOKEN_SECRET_REQUIRED: 503,
});

export class WorkerOnboardingFlowSessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WorkerOnboardingFlowSessionError";
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function sessionError(message, code) {
  return new WorkerOnboardingFlowSessionError(message, code);
}

function validatedSecret(value) {
  const secret = typeof value === "string" ? value.trim() : "";
  if (!secret) return null;
  if (
    Buffer.byteLength(secret, "utf8") < 32
    || /replace-with|change-?me|placeholder|example-secret/i.test(secret)
  ) {
    throw sessionError(
      "The worker-onboarding Flow token secret must be independent and at least 32 bytes.",
      "WORKER_ONBOARDING_FLOW_TOKEN_SECRET_INVALID",
    );
  }
  return secret;
}

export function assertWorkerOnboardingFlowTokenSecret(explicitSecret, {
  allowDevelopmentFallback = false,
} = {}) {
  const secret = validatedSecret(explicitSecret);
  if (secret) return secret;
  if (allowDevelopmentFallback && ["development", "test"].includes(process.env.NODE_ENV)) {
    return LOCAL_DEVELOPMENT_SECRET;
  }
  throw sessionError(
    "WORKER_ONBOARDING_FLOW_TOKEN_SECRET is required for worker-onboarding Flow sessions.",
    "WORKER_ONBOARDING_FLOW_TOKEN_SECRET_REQUIRED",
  );
}

function signingSecret(explicitSecret) {
  return assertWorkerOnboardingFlowTokenSecret(
    explicitSecret ?? process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET,
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
    throw sessionError(
      `Invalid worker-onboarding Flow session ${name}.`,
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return normalized;
}

function validDate(value, name = "date") {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw sessionError(
      `Invalid worker-onboarding Flow session ${name}.`,
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return date;
}

function normalizedNow(value) {
  return validDate(value, "clock");
}

function normalizeTtl(value) {
  const ttlMs = value ?? DEFAULT_WORKER_ONBOARDING_FLOW_SESSION_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_SESSION_TTL_MS) {
    throw sessionError(
      "Invalid worker-onboarding Flow session TTL.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return ttlMs;
}

function normalizedSessionId(value) {
  return boundedText(value?.sessionId ?? value?.id ?? value, {
    name: "identity",
    max: 36,
    pattern: UUID_PATTERN,
  }).toLowerCase();
}

function normalizeFixedBlueprint(input) {
  const blueprintKey = boundedText(input.blueprintKey, {
    name: "blueprint key",
    max: 100,
    pattern: /^[a-z0-9][a-z0-9-]{0,99}$/,
  });
  const screenId = boundedText(input.screenId, {
    name: "screen ID",
    max: 30,
    pattern: /^[A-Z][A-Z0-9_]{0,29}$/,
  });
  const flowType = boundedText(input.flowType, {
    name: "Flow type",
    max: 64,
    pattern: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  });
  if (
    blueprintKey !== WORKER_ONBOARDING_FLOW_BLUEPRINT_KEY
    || screenId !== WORKER_ONBOARDING_FLOW_SCREEN_ID
    || flowType !== WORKER_ONBOARDING_FLOW_TYPE
  ) {
    throw sessionError(
      "The Flow identity does not belong to the worker-onboarding domain.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return { blueprintKey, screenId, flowType };
}

function normalizePinnedPrivacyNotice(input = {}) {
  const noticeVersion = boundedText(input.noticeVersion, {
    name: "privacy notice version",
    max: 64,
    pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/,
  });
  const noticeContentSha256 = boundedText(input.noticeContentSha256, {
    name: "privacy notice content commitment",
    max: 64,
    pattern: SHA256_PATTERN,
  }).toLowerCase();
  try {
    assertWorkerOnboardingPrivacyNoticeEvidence(noticeVersion, noticeContentSha256);
  } catch (error) {
    if (!(error instanceof WorkerOnboardingPrivacyNoticeError)) throw error;
    throw sessionError(
      "The worker-onboarding privacy notice evidence is invalid.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return { noticeVersion, noticeContentSha256 };
}

function normalizeImmutableInput(input = {}) {
  return {
    claimId: boundedText(input.claimId, { name: "claim", max: 191 }),
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    connectionId: boundedText(input.connectionId, { name: "connection", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    ...normalizeFixedBlueprint(input),
    flowId: boundedText(input.flowId, {
      name: "Flow ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
    sourceExternalId: boundedText(input.sourceExternalId, {
      name: "source external ID",
      max: 512,
    }),
    ...normalizePinnedPrivacyNotice(input),
  };
}

function normalizeDeliveryInput(input = {}) {
  return {
    sessionId: normalizedSessionId(input),
    ...normalizeImmutableInput(input),
  };
}

function normalizeEndpointScope(input = {}) {
  return {
    organizationId: boundedText(input.organizationId, { name: "organization", max: 191 }),
    projectId: boundedText(input.projectId, { name: "project", max: 191 }),
    connectionId: boundedText(input.connectionId, { name: "connection", max: 191 }),
    phoneNumberId: boundedText(input.phoneNumberId, {
      name: "phone number ID",
      max: 40,
      pattern: /^\d{5,40}$/,
    }),
  };
}

function normalizeExternalId(value) {
  return boundedText(value, { name: "consumed external ID", max: 512 });
}

function normalizeSenderFingerprint(input = {}) {
  const fingerprint = boundedText(
    input.senderFingerprint ?? input.fingerprint,
    { name: "sender fingerprint", max: 64, pattern: SHA256_PATTERN },
  ).toLowerCase();
  const fingerprintKeyId = boundedText(
    input.senderFingerprintKeyId ?? input.fingerprintKeyId,
    { name: "sender fingerprint key", max: 100, pattern: KEY_ID_PATTERN },
  );
  return { fingerprint, fingerprintKeyId };
}

function receiptSenderFingerprint(input, claim, scope, fingerprintRegistry) {
  if (input?.senderAddress === undefined) return normalizeSenderFingerprint(input);
  const address = normalizeWorkerWhatsAppAddress(input.senderAddress);
  const registry = fingerprintRegistry ?? readWorkerFinancialFingerprintKeyRegistry();
  const fingerprintOptions = {
    keyId: claim.senderFingerprintKeyId,
    registry,
  };
  return workerFinancialFingerprint(address, {
    organizationId: scope.organizationId,
    valueType: "WHATSAPP_E164",
  }, fingerprintOptions);
}

function sessionDelegate(prisma) {
  const delegate = prisma?.workerOnboardingFlowSession;
  if (
    !delegate
    || typeof delegate.findUnique !== "function"
    || typeof delegate.create !== "function"
    || typeof delegate.updateMany !== "function"
  ) {
    throw sessionError(
      "Worker-onboarding Flow session persistence is unavailable.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return delegate;
}

function claimDelegate(prisma) {
  const delegate = prisma?.workerOnboardingClaim;
  if (!delegate || typeof delegate.findFirst !== "function") {
    throw sessionError(
      "Worker-onboarding claim persistence is unavailable.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  return delegate;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeStoredClaim(claim, expectedScope = null) {
  if (!claim) {
    throw sessionError(
      "The worker-onboarding claim is unavailable.",
      "WORKER_ONBOARDING_FLOW_SESSION_CLAIM_UNAVAILABLE",
    );
  }
  // Terminal onboarding claims are cryptoshredded. Their original HMAC
  // binding can no longer be reconstructed by design, and a delayed Flow
  // callback must never be allowed to reactivate the claim.
  if (claim.sensitiveDataPurgedAt) {
    throw sessionError(
      "The worker-onboarding Flow session has been retired.",
      "WORKER_ONBOARDING_FLOW_SESSION_RETIRED",
    );
  }
  const normalized = {
    id: String(claim.id || ""),
    organizationId: String(claim.organizationId || ""),
    projectId: String(claim.projectId || ""),
    connectionId: String(claim.connectionId || ""),
    senderFingerprint: String(claim.senderFingerprint || "").toLowerCase(),
    senderFingerprintKeyId: String(claim.senderFingerprintKeyId || ""),
    senderRecordVersion: Number(claim.senderRecordVersion),
    claimTokenHash: String(claim.claimTokenHash || "").toLowerCase(),
    status: String(claim.status || ""),
    expiresAt: validDate(claim.expiresAt, "claim expiration"),
  };
  if (
    !normalized.id
    || !SHA256_PATTERN.test(normalized.senderFingerprint)
    || !KEY_ID_PATTERN.test(normalized.senderFingerprintKeyId)
    || !Number.isSafeInteger(normalized.senderRecordVersion)
    || normalized.senderRecordVersion <= 0
    || !SHA256_PATTERN.test(normalized.claimTokenHash)
    || !normalized.status
  ) {
    throw sessionError(
      "The worker-onboarding claim security binding is invalid.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  if (
    expectedScope
    && ["id", "organizationId", "projectId", "connectionId"].some((field) => (
      String(expectedScope[field] || "") !== normalized[field]
    ))
  ) {
    throw sessionError(
      "The worker-onboarding claim does not match the Flow session scope.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  return normalized;
}

async function readClaim(prisma, scope) {
  const claim = await claimDelegate(prisma).findFirst({
    where: {
      id: scope.claimId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      connectionId: scope.connectionId,
    },
  });
  return normalizeStoredClaim(claim, { ...scope, id: scope.claimId });
}

function assertClaimStatus(claim, statuses) {
  if (!statuses.includes(claim.status)) {
    throw sessionError(
      "The worker-onboarding claim no longer accepts this Flow operation.",
      "WORKER_ONBOARDING_FLOW_SESSION_CLAIM_UNAVAILABLE",
    );
  }
}

function assertClaimNotExpired(claim, now) {
  if (claim.expiresAt.getTime() <= now.getTime()) {
    throw sessionError(
      "The worker-onboarding claim expired.",
      "WORKER_ONBOARDING_FLOW_SESSION_EXPIRED",
    );
  }
}

function tokenClaims(session, claim) {
  const id = String(session?.id || "").toLowerCase();
  if (!UUID_PATTERN.test(id)) {
    throw sessionError(
      "Stored worker-onboarding Flow session identity is invalid.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  let pinnedNotice;
  try {
    pinnedNotice = assertWorkerOnboardingPrivacyNoticeEvidence(
      session.noticeVersion,
      session.noticeContentSha256,
    );
  } catch (error) {
    if (!(error instanceof WorkerOnboardingPrivacyNoticeError)) throw error;
    throw sessionError(
      "Stored worker-onboarding privacy notice evidence is invalid.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  return [
    TOKEN_VERSION,
    id,
    String(session.claimId || ""),
    String(session.organizationId || ""),
    String(session.projectId || ""),
    String(session.connectionId || ""),
    String(session.phoneNumberId || ""),
    String(session.blueprintKey || ""),
    String(session.flowId || ""),
    String(session.screenId || ""),
    String(session.flowType || ""),
    String(session.sourceExternalId || ""),
    pinnedNotice.version,
    pinnedNotice.contentSha256,
    validDate(session.expiresAt, "expiration").toISOString(),
    claim.id,
    claim.senderFingerprintKeyId,
    claim.senderFingerprint,
    claim.senderRecordVersion,
    claim.claimTokenHash,
    claim.expiresAt.toISOString(),
  ];
}

function signedToken(session, claim, secret) {
  const claims = tokenClaims(session, claim);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(claims))
    .digest("base64url");
  return `${TOKEN_VERSION}.${claims[1]}.${signature}`;
}

export function workerOnboardingFlowTokenEvidence(raw) {
  const token = typeof raw === "string" ? raw.trim() : "";
  const match = TOKEN_PATTERN.exec(token);
  if (!match) {
    throw sessionError(
      "Invalid worker-onboarding Flow token.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  return {
    kind: "worker_onboarding",
    sessionId: match[1],
    tokenSha256: crypto.createHash("sha256").update(token).digest("hex"),
  };
}

function normalizeTokenEvidence(input = {}) {
  const provided = input.tokenEvidence;
  let evidence = null;
  if (provided && typeof provided === "object" && !Array.isArray(provided)) {
    const kind = String(provided.kind || "");
    const sessionId = String(provided.sessionId || "").trim().toLowerCase();
    const tokenSha256 = String(provided.tokenSha256 || "").trim().toLowerCase();
    if (
      kind !== "worker_onboarding"
      || !UUID_PATTERN.test(sessionId)
      || !SHA256_PATTERN.test(tokenSha256)
    ) {
      throw sessionError(
        "Worker-onboarding Flow token evidence is invalid.",
        "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
      );
    }
    evidence = { kind, sessionId, tokenSha256 };
  }
  if (input.token !== undefined && input.token !== null && input.token !== "") {
    const parsed = workerOnboardingFlowTokenEvidence(input.token);
    if (
      evidence
      && (
        evidence.sessionId !== parsed.sessionId
        || !constantTimeEqual(evidence.tokenSha256, parsed.tokenSha256)
      )
    ) {
      throw sessionError(
        "Worker-onboarding Flow token evidence is invalid.",
        "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
      );
    }
    evidence = parsed;
  }
  if (!evidence) {
    throw sessionError(
      "Worker-onboarding Flow token evidence is required.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  return evidence;
}

function tokenForStoredSession(session, claim, secret) {
  const token = signedToken(session, claim, secret);
  const evidence = workerOnboardingFlowTokenEvidence(token);
  if (
    evidence.sessionId !== String(session.id || "").toLowerCase()
    || !constantTimeEqual(evidence.tokenSha256, session.tokenSha256)
  ) {
    throw sessionError(
      "Worker-onboarding Flow token evidence does not match its session.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  return token;
}

function sameImmutableBinding(session, binding) {
  return [
    "claimId",
    "organizationId",
    "projectId",
    "connectionId",
    "phoneNumberId",
    "blueprintKey",
    "flowId",
    "screenId",
    "flowType",
    "sourceExternalId",
    "noticeVersion",
    "noticeContentSha256",
  ].every((field) => String(session?.[field] || "") === binding[field]);
}

function sameEndpointScope(session, scope) {
  return ["organizationId", "projectId", "connectionId", "phoneNumberId"]
    .every((field) => String(session?.[field] || "") === scope[field]);
}

function isUniqueConstraintError(error) {
  return error?.code === "P2002" || error?.code === "23505";
}

function sessionExpired(session, now) {
  return validDate(session.expiresAt, "expiration").getTime() <= now.getTime();
}

function assertSessionNotExpired(session, now, minRemainingMs = 0) {
  const remaining = validDate(session.expiresAt, "expiration").getTime() - now.getTime();
  if (remaining <= 0 || remaining < minRemainingMs) {
    throw sessionError(
      "The worker-onboarding Flow session expired.",
      "WORKER_ONBOARDING_FLOW_SESSION_EXPIRED",
    );
  }
}

async function loadBoundSession(prisma, sessionId) {
  const session = await sessionDelegate(prisma).findUnique({ where: { id: sessionId } });
  if (!session) {
    throw sessionError(
      "The worker-onboarding Flow session was not found.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  const claim = await readClaim(prisma, session);
  return { session, claim };
}

async function readSessionByBinding(delegate, binding) {
  return delegate.findUnique({
    where: {
      projectId_sourceExternalId_blueprintKey: {
        projectId: binding.projectId,
        sourceExternalId: binding.sourceExternalId,
        blueprintKey: binding.blueprintKey,
      },
    },
  });
}

function assertIssuableClaim(claim, now) {
  assertClaimStatus(claim, ["PENDING"]);
  assertClaimNotExpired(claim, now);
}

function assertNotFinalized(session) {
  if (session.submittedAt || session.consumedAt) {
    throw sessionError(
      "The worker-onboarding Flow session was already used.",
      "WORKER_ONBOARDING_FLOW_SESSION_USED",
    );
  }
  if (session.deliveryRejectedAt) {
    throw sessionError(
      "The worker-onboarding Flow delivery was rejected.",
      "WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
    );
  }
}

export async function issueWorkerOnboardingFlowSession(
  prisma,
  input,
  {
    secret,
    now = new Date(),
    ttlMs = DEFAULT_WORKER_ONBOARDING_FLOW_SESSION_TTL_MS,
  } = {},
) {
  const delegate = sessionDelegate(prisma);
  const binding = normalizeImmutableInput(input);
  const issuedAt = normalizedNow(now);
  const lifetimeMs = normalizeTtl(ttlMs);
  const resolvedSecret = signingSecret(secret);
  const claim = await readClaim(prisma, binding);
  assertIssuableClaim(claim, issuedAt);

  const existing = await readSessionByBinding(delegate, binding);
  if (existing) {
    if (!sameImmutableBinding(existing, binding)) {
      throw sessionError(
        "The source event is already bound to a different worker-onboarding Flow session.",
        "WORKER_ONBOARDING_FLOW_SESSION_CONFLICT",
      );
    }
    assertSessionNotExpired(existing, issuedAt);
    assertNotFinalized(existing);
    return {
      session: existing,
      token: tokenForStoredSession(existing, claim, resolvedSecret),
      replayed: true,
    };
  }

  const expiresAt = new Date(issuedAt.getTime() + lifetimeMs);
  if (expiresAt.getTime() > claim.expiresAt.getTime()) {
    throw sessionError(
      "The Flow session cannot outlive its worker-onboarding claim.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  const draft = {
    id: crypto.randomUUID(),
    ...binding,
    expiresAt,
    createdAt: issuedAt,
  };
  const token = signedToken(draft, claim, resolvedSecret);
  const { tokenSha256 } = workerOnboardingFlowTokenEvidence(token);

  try {
    const session = await delegate.create({ data: { ...draft, tokenSha256 } });
    tokenForStoredSession(session, claim, resolvedSecret);
    return { session, token, replayed: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await readSessionByBinding(delegate, binding);
    if (raced && sameImmutableBinding(raced, binding)) {
      assertSessionNotExpired(raced, issuedAt);
      assertNotFinalized(raced);
      return {
        session: raced,
        token: tokenForStoredSession(raced, claim, resolvedSecret),
        replayed: true,
      };
    }
    throw sessionError(
      "A conflicting worker-onboarding Flow session already exists.",
      "WORKER_ONBOARDING_FLOW_SESSION_CONFLICT",
    );
  }
}

export async function getWorkerOnboardingFlowSessionForDelivery(
  prisma,
  input,
  {
    secret,
    now = new Date(),
    minRemainingMs = MIN_WORKER_ONBOARDING_FLOW_DELIVERY_REMAINING_MS,
  } = {},
) {
  if (!Number.isSafeInteger(minRemainingMs) || minRemainingMs < 0) {
    throw sessionError(
      "Invalid minimum delivery lifetime.",
      "WORKER_ONBOARDING_FLOW_SESSION_INPUT_INVALID",
    );
  }
  const expected = normalizeDeliveryInput(input);
  const deliveryTime = normalizedNow(now);
  const { session, claim } = await loadBoundSession(prisma, expected.sessionId);
  if (!sameImmutableBinding(session, expected)) {
    throw sessionError(
      "The worker-onboarding Flow delivery scope is invalid.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  assertIssuableClaim(claim, deliveryTime);
  assertSessionNotExpired(session, deliveryTime, minRemainingMs);
  assertNotFinalized(session);
  if (session.sentAt) {
    throw sessionError(
      "The worker-onboarding Flow session was already sent.",
      "WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
    );
  }
  if (session.deliveryAttemptedAt) {
    throw sessionError(
      "The provider already has an unresolved worker-onboarding Flow delivery attempt.",
      "WORKER_ONBOARDING_FLOW_SESSION_DELIVERY_AMBIGUOUS",
    );
  }
  const token = tokenForStoredSession(session, claim, signingSecret(secret));
  return { session, token };
}

export async function authenticateWorkerOnboardingFlowDataSession(
  prisma,
  input,
  { secret, now = new Date() } = {},
) {
  const scope = normalizeEndpointScope(input);
  const evidence = normalizeTokenEvidence(input);
  const authenticatedAt = normalizedNow(now);
  const { session, claim } = await loadBoundSession(prisma, evidence.sessionId);
  const expectedToken = tokenForStoredSession(session, claim, signingSecret(secret));
  const expectedEvidence = workerOnboardingFlowTokenEvidence(expectedToken);
  if (
    !constantTimeEqual(evidence.tokenSha256, expectedEvidence.tokenSha256)
    || !constantTimeEqual(evidence.tokenSha256, session.tokenSha256)
    || !sameEndpointScope(session, scope)
  ) {
    throw sessionError(
      "The worker-onboarding Flow session does not belong to this endpoint.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  assertClaimStatus(claim, ["PENDING", "SUBMITTED"]);
  assertClaimNotExpired(claim, authenticatedAt);
  assertSessionNotExpired(session, authenticatedAt);
  if (!session.deliveryAttemptedAt || session.deliveryRejectedAt || session.consumedAt) {
    throw sessionError(
      "The worker-onboarding Flow session is not in an authenticatable state.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  return { session, claim, tokenEvidence: expectedEvidence };
}

export async function markWorkerOnboardingFlowPrivacyPresented(
  prisma,
  input,
  { secret, now = new Date() } = {},
) {
  // This timestamp proves that our Data Endpoint served INIT with the exact
  // pinned copy. It is deliberately not described as proof of human reading.
  const presentedAt = normalizedNow(now);
  const authentication = await authenticateWorkerOnboardingFlowDataSession(
    prisma,
    input,
    { secret, now: presentedAt },
  );
  const before = authentication.session;
  if (
    validDate(before.deliveryAttemptedAt, "delivery attempt").getTime()
    > presentedAt.getTime()
  ) {
    throw sessionError(
      "The INIT privacy presentation predates the delivery attempt.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  if (before.submittedAt || before.consumedAt) {
    throw sessionError(
      "The worker-onboarding privacy notice cannot be presented after submission.",
      "WORKER_ONBOARDING_FLOW_SESSION_USED",
    );
  }
  const marked = await sessionDelegate(prisma).updateMany({
    where: {
      id: before.id,
      tokenSha256: before.tokenSha256,
      noticeVersion: before.noticeVersion,
      noticeContentSha256: before.noticeContentSha256,
      expiresAt: { gt: presentedAt },
      deliveryAttemptedAt: { not: null },
      deliveryRejectedAt: null,
      privacyPresentedAt: null,
      submittedAt: null,
      consumedAt: null,
    },
    data: { privacyPresentedAt: presentedAt },
  });
  const { session } = await reloadState(prisma, before.id, secret);
  if (marked.count === 1) {
    return { session, alreadyPresented: false };
  }
  if (
    session.privacyPresentedAt
    && !session.deliveryRejectedAt
    && !session.submittedAt
    && !session.consumedAt
  ) {
    return { session, alreadyPresented: true };
  }
  throw sessionError(
    "The worker-onboarding privacy presentation state changed.",
    "WORKER_ONBOARDING_FLOW_SESSION_CONFLICT",
  );
}

async function reloadState(prisma, sessionId, secret) {
  const state = await loadBoundSession(prisma, sessionId);
  tokenForStoredSession(state.session, state.claim, signingSecret(secret));
  return state;
}

export async function markWorkerOnboardingFlowSessionDeliveryAttempted(
  prisma,
  input,
  { secret, now = new Date() } = {},
) {
  const sessionId = normalizedSessionId(input);
  const attemptedAt = normalizedNow(now);
  const before = await reloadState(prisma, sessionId, secret);
  assertIssuableClaim(before.claim, attemptedAt);
  assertSessionNotExpired(before.session, attemptedAt);
  const marked = await sessionDelegate(prisma).updateMany({
    where: {
      id: sessionId,
      tokenSha256: before.session.tokenSha256,
      expiresAt: { gt: attemptedAt },
      deliveryAttemptedAt: null,
      deliveryRejectedAt: null,
      sentAt: null,
      submittedAt: null,
      consumedAt: null,
    },
    data: { deliveryAttemptedAt: attemptedAt },
  });
  const { session } = await reloadState(prisma, sessionId, secret);
  if (marked.count === 1) return { session, alreadyAttempted: false };
  if (
    session.deliveryAttemptedAt
    && !session.deliveryRejectedAt
    && !session.sentAt
    && !session.submittedAt
    && !session.consumedAt
  ) return { session, alreadyAttempted: true };
  if (sessionExpired(session, attemptedAt)) {
    throw sessionError(
      "The worker-onboarding Flow session expired.",
      "WORKER_ONBOARDING_FLOW_SESSION_EXPIRED",
    );
  }
  throw sessionError(
    "The worker-onboarding Flow delivery state changed before the attempt fence.",
    "WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
  );
}

export async function markWorkerOnboardingFlowSessionDeliveryRejected(
  prisma,
  input,
  { secret, now = new Date() } = {},
) {
  const sessionId = normalizedSessionId(input);
  const rejectedAt = normalizedNow(now);
  const before = await reloadState(prisma, sessionId, secret);
  const marked = await sessionDelegate(prisma).updateMany({
    where: {
      id: sessionId,
      tokenSha256: before.session.tokenSha256,
      deliveryAttemptedAt: { not: null },
      deliveryRejectedAt: null,
      sentAt: null,
      submittedAt: null,
      consumedAt: null,
    },
    data: { deliveryRejectedAt: rejectedAt },
  });
  const { session } = await reloadState(prisma, sessionId, secret);
  if (marked.count === 1) return { session, alreadyRejected: false };
  if (
    session.deliveryRejectedAt
    && !session.sentAt
    && !session.submittedAt
    && !session.consumedAt
  ) return { session, alreadyRejected: true };
  throw sessionError(
    "A provider or submission fence prevents rejecting this Flow session.",
    "WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
  );
}

export async function markWorkerOnboardingFlowSessionSent(
  prisma,
  input,
  { secret, now = new Date() } = {},
) {
  const sessionId = normalizedSessionId(input);
  const providerMessageId = boundedText(input?.providerMessageId, {
    name: "provider message ID",
    max: 500,
  });
  const sentAt = normalizedNow(now);
  const before = await reloadState(prisma, sessionId, secret);
  let marked;
  try {
    marked = await sessionDelegate(prisma).updateMany({
      where: {
        id: sessionId,
        tokenSha256: before.session.tokenSha256,
        deliveryAttemptedAt: { not: null },
        deliveryRejectedAt: null,
        sentAt: null,
        consumedAt: null,
      },
      data: { sentAt, providerMessageId },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    throw sessionError(
      "The provider message is already bound to another worker-onboarding Flow session.",
      "WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
    );
  }
  const { session } = await reloadState(prisma, sessionId, secret);
  if (marked.count === 1) return { session, alreadySent: false };
  if (session.sentAt && session.providerMessageId === providerMessageId) {
    return { session, alreadySent: true };
  }
  throw sessionError(
    "The worker-onboarding Flow session is already linked to another provider outcome.",
    "WORKER_ONBOARDING_FLOW_SESSION_PROVIDER_MESSAGE_CONFLICT",
  );
}

export async function markWorkerOnboardingFlowSessionSubmitted(
  prisma,
  input,
  { secret, now = new Date() } = {},
) {
  const sessionId = normalizedSessionId(input);
  const submittedAt = normalizedNow(now);
  const before = await reloadState(prisma, sessionId, secret);
  if (
    input?.claimId !== undefined
    && boundedText(input.claimId, { name: "claim", max: 191 }) !== before.session.claimId
  ) {
    throw sessionError(
      "The submitted claim does not match the worker-onboarding Flow session.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  assertClaimStatus(before.claim, ["PENDING", "SUBMITTED"]);
  assertClaimNotExpired(before.claim, submittedAt);
  assertSessionNotExpired(before.session, submittedAt);
  if (!before.session.privacyPresentedAt) {
    throw sessionError(
      "The worker-onboarding privacy notice was not presented by INIT.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  const marked = await sessionDelegate(prisma).updateMany({
    where: {
      id: sessionId,
      tokenSha256: before.session.tokenSha256,
      expiresAt: { gt: submittedAt },
      deliveryAttemptedAt: { not: null },
      deliveryRejectedAt: null,
      privacyPresentedAt: { not: null },
      submittedAt: null,
      consumedAt: null,
    },
    data: { submittedAt },
  });
  const { session } = await reloadState(prisma, sessionId, secret);
  if (marked.count === 1) return { session, alreadySubmitted: false };
  if (session.submittedAt && !session.deliveryRejectedAt && !session.consumedAt) {
    return { session, alreadySubmitted: true };
  }
  throw sessionError(
    "The worker-onboarding Flow session cannot be marked submitted.",
    "WORKER_ONBOARDING_FLOW_SESSION_USED",
  );
}

export async function consumeWorkerOnboardingFlowSession(
  prisma,
  input,
  {
    secret,
    now = new Date(),
    recoverExpired = false,
    fingerprintRegistry,
  } = {},
) {
  const evidence = normalizeTokenEvidence(input);
  const scope = normalizeEndpointScope(input);
  const consumedExternalId = normalizeExternalId(input.consumedExternalId);
  const consumedAt = normalizedNow(now);
  const before = await loadBoundSession(prisma, evidence.sessionId);
  if (
    input?.claimRef !== undefined
    && boundedText(input.claimRef, { name: "receipt claim", max: 190 }) !== before.session.claimId
  ) {
    throw sessionError(
      "The terminal receipt does not match the worker-onboarding claim.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  const sender = receiptSenderFingerprint(input, before.claim, scope, fingerprintRegistry);
  const expectedToken = tokenForStoredSession(
    before.session,
    before.claim,
    signingSecret(secret),
  );
  const expectedEvidence = workerOnboardingFlowTokenEvidence(expectedToken);
  if (
    !constantTimeEqual(evidence.tokenSha256, expectedEvidence.tokenSha256)
    || !constantTimeEqual(evidence.tokenSha256, before.session.tokenSha256)
    || !sameEndpointScope(before.session, scope)
    || sender.fingerprintKeyId !== before.claim.senderFingerprintKeyId
    || !constantTimeEqual(sender.fingerprint, before.claim.senderFingerprint)
  ) {
    throw sessionError(
      "The terminal reply does not match the worker-onboarding Flow session.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  if (
    !before.session.deliveryAttemptedAt
    || before.session.deliveryRejectedAt
    || !before.session.submittedAt
  ) {
    throw sessionError(
      "The worker-onboarding Flow session was not submitted.",
      "WORKER_ONBOARDING_FLOW_SESSION_INVALID",
    );
  }
  if (before.session.consumedAt) {
    throw sessionError(
      "The worker-onboarding Flow session was already consumed.",
      "WORKER_ONBOARDING_FLOW_SESSION_USED",
    );
  }
  const expired = sessionExpired(before.session, consumedAt);
  if (expired && !recoverExpired) {
    throw sessionError(
      "The worker-onboarding Flow session expired.",
      "WORKER_ONBOARDING_FLOW_SESSION_EXPIRED",
    );
  }

  let claimed;
  try {
    claimed = await sessionDelegate(prisma).updateMany({
      where: {
        id: before.session.id,
        claimId: before.session.claimId,
        tokenSha256: evidence.tokenSha256,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        connectionId: scope.connectionId,
        phoneNumberId: scope.phoneNumberId,
        expiresAt: expired ? { lte: consumedAt } : { gt: consumedAt },
        deliveryAttemptedAt: { not: null },
        deliveryRejectedAt: null,
        submittedAt: { not: null },
        consumedAt: null,
      },
      data: { consumedAt, consumedExternalId },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    throw sessionError(
      "The inbound event already consumed another worker-onboarding Flow session.",
      "WORKER_ONBOARDING_FLOW_SESSION_USED",
    );
  }
  const { session } = await reloadState(prisma, before.session.id, secret);
  if (claimed.count === 1) return { session, expired };
  if (session.consumedAt) {
    throw sessionError(
      "The worker-onboarding Flow session was already consumed.",
      "WORKER_ONBOARDING_FLOW_SESSION_USED",
    );
  }
  if (!recoverExpired) assertSessionNotExpired(session, consumedAt);
  throw sessionError(
    "The worker-onboarding Flow session changed before it could be consumed.",
    "WORKER_ONBOARDING_FLOW_SESSION_CONFLICT",
  );
}
