import crypto from "node:crypto";

export const PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS = Object.freeze({
  activeSessionPerMinute: 12,
  activeOrganizationPerMinute: 600,
  inactiveSessionPerMinute: 6,
  inactiveOrganizationPerMinute: 300,
  windowSeconds: 60,
  bucketRetentionMs: 10 * 60 * 1_000,
  gcBatchSize: 100,
  lockTimeoutMs: 2_500,
});

const TOKEN_FINGERPRINT_DOMAINS = Object.freeze({
  ACTIVE: "progress-evidence-location-active-session-rate-v1",
  INACTIVE: "progress-evidence-location-inactive-session-rate-v1",
});
const ORGANIZATION_SCOPE_DOMAINS = Object.freeze({
  ACTIVE: "progress-evidence-location-active-org-rate-v1",
  INACTIVE: "progress-evidence-location-inactive-org-rate-v1",
});
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ACTIONS = new Set(["INIT", "CAPTURE", "CANCEL"]);
const SESSION_STATUSES = new Set([
  "AWAITING_LOCATION",
  "LOCATION_CAPTURED",
  "CONSUMED",
  "EXPIRED",
  "CANCELLED",
]);
const MAX_ID_LENGTH = 191;
const MAX_TOKEN_LENGTH = 4_096;
const INPUT_FIELDS = new Set([
  "action",
  "workerId",
  "sessionId",
  "token",
  "correlationId",
]);
const RATE_SCOPES = Object.freeze({
  ACTIVE_SESSION: "ACTIVE_SESSION",
  ACTIVE_ORGANIZATION: "ACTIVE_ORGANIZATION",
  INACTIVE_SESSION: "INACTIVE_SESSION",
  INACTIVE_ORGANIZATION: "INACTIVE_ORGANIZATION",
});
const RATE_LANES = Object.freeze({ ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" });

export class ProgressEvidenceLocationRateLimitError extends Error {
  constructor(message, { code, status, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = "ProgressEvidenceLocationRateLimitError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isProgressEvidenceLocationRateLimitError(error) {
  return error instanceof ProgressEvidenceLocationRateLimitError;
}

function rateLimitError(message, code, status, retryAfterSeconds = null) {
  return new ProgressEvidenceLocationRateLimitError(message, {
    code,
    status,
    retryAfterSeconds,
  });
}

function unavailableError() {
  return rateLimitError(
    "El control de solicitudes no está disponible. Reintentá más tarde.",
    "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_UNAVAILABLE",
    503,
    2,
  );
}

function exactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw rateLimitError(
      "La solicitud de ubicación no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_INPUT_INVALID",
      400,
    );
  }
  const keys = Object.keys(value);
  if (keys.some((key) => !INPUT_FIELDS.has(key))) {
    throw rateLimitError(
      "La solicitud de ubicación no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_INPUT_INVALID",
      400,
    );
  }
  return value;
}

function exactString(value, maxLength) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && value.trim() === value
    ? value
    : null;
}

function normalizedInput(rawInput) {
  const input = exactObject(rawInput);
  const action = ACTIONS.has(input.action) ? input.action : null;
  const workerId = exactString(input.workerId, MAX_ID_LENGTH);
  const sessionId = exactString(input.sessionId, MAX_ID_LENGTH);
  const token = exactString(input.token, MAX_TOKEN_LENGTH);
  const correlationId = input.correlationId === undefined
    ? null
    : exactString(input.correlationId, 128);
  if (!action || !workerId || !sessionId || !token || (input.correlationId !== undefined && !correlationId)) {
    throw rateLimitError(
      "La solicitud de ubicación no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_INPUT_INVALID",
      400,
    );
  }
  if (correlationId && !CORRELATION_ID_PATTERN.test(correlationId)) {
    throw rateLimitError(
      "La solicitud de ubicación no es válida.",
      "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_INPUT_INVALID",
      400,
    );
  }
  return { action, workerId, sessionId, token, correlationId };
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeHashEqual(left, right) {
  if (!HASH_PATTERN.test(left || "") || !HASH_PATTERN.test(right || "")) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function progressEvidenceLocationTokenFingerprint({
  organizationId,
  projectId,
  workerId,
  sessionId,
  storedTokenHash,
  lane = RATE_LANES.ACTIVE,
}) {
  const fields = [organizationId, projectId, workerId, sessionId]
    .map((value) => exactString(value, MAX_ID_LENGTH));
  if (
    fields.some((value) => !value)
    || !HASH_PATTERN.test(storedTokenHash || "")
    || !TOKEN_FINGERPRINT_DOMAINS[lane]
  ) {
    throw unavailableError();
  }
  return sha256([
    TOKEN_FINGERPRINT_DOMAINS[lane],
    ...fields,
    storedTokenHash,
  ].join("\0"));
}

function organizationScopeHash(organizationId, lane) {
  const normalized = exactString(organizationId, MAX_ID_LENGTH);
  const domain = ORGANIZATION_SCOPE_DOMAINS[lane];
  if (!normalized || !domain) throw unavailableError();
  return sha256(`${domain}\0${normalized}`);
}

function ratePolicyForSession(session, now) {
  const status = SESSION_STATUSES.has(session?.status) ? session.status : null;
  const expiresAt = session?.expiresAt instanceof Date
    ? new Date(session.expiresAt.getTime())
    : new Date(session?.expiresAt);
  if (!status || !Number.isFinite(expiresAt.getTime())) throw unavailableError();
  const isActive = status === "AWAITING_LOCATION"
    && now.getTime() < expiresAt.getTime();
  return isActive
    ? {
        lane: RATE_LANES.ACTIVE,
        sessionScope: RATE_SCOPES.ACTIVE_SESSION,
        organizationScope: RATE_SCOPES.ACTIVE_ORGANIZATION,
        sessionLimit: PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.activeSessionPerMinute,
        organizationLimit: PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.activeOrganizationPerMinute,
      }
    : {
        lane: RATE_LANES.INACTIVE,
        sessionScope: RATE_SCOPES.INACTIVE_SESSION,
        organizationScope: RATE_SCOPES.INACTIVE_ORGANIZATION,
        sessionLimit: PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.inactiveSessionPerMinute,
        organizationLimit: PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.inactiveOrganizationPerMinute,
      };
}

function assertPrisma(prisma) {
  if (!prisma || typeof prisma.$transaction !== "function") throw unavailableError();
}

function assertTransaction(transaction) {
  if (
    !transaction
    || typeof transaction.$executeRawUnsafe !== "function"
    || typeof transaction.$queryRawUnsafe !== "function"
    || typeof transaction.progressEvidenceCaptureSession?.findFirst !== "function"
    || typeof transaction.progressEvidenceLocationRateBucket?.findUnique !== "function"
    || typeof transaction.progressEvidenceLocationRateBucket?.create !== "function"
    || typeof transaction.progressEvidenceLocationRateBucket?.update !== "function"
  ) throw unavailableError();
}

function tokenDenied() {
  return rateLimitError(
    "El enlace ya no es válido o no autoriza esta captura.",
    "PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID",
    401,
  );
}

function sessionAuthorizesToken(session, input) {
  return Boolean(
    session
    && session.id === input.sessionId
    && session.workerId === input.workerId
    && safeHashEqual(sha256(input.token), session.tokenHash),
  );
}

async function lockAuthoritativeSession(
  transaction,
  { input, observedOrganizationId },
) {
  const rows = await transaction.$queryRawUnsafe(
    `SELECT
       "id",
       "organizationId",
       "projectId",
       "workerId",
       "tokenHash",
       "status",
       "expiresAt"
     FROM "ProgressEvidenceCaptureSession"
     WHERE "id" = $1
       AND "workerId" = $2
     FOR SHARE`,
    input.sessionId,
    input.workerId,
  );
  const session = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  if (!sessionAuthorizesToken(session, input)) throw tokenDenied();
  // The advisory lock was acquired from the first tenant-scoped lookup. If an
  // impossible/manual scope rewrite raced that lookup, do not continue under
  // the wrong organization's lock.
  if (session.organizationId !== observedOrganizationId) throw unavailableError();
  return session;
}

async function databaseClock(transaction) {
  const rows = await transaction.$queryRawUnsafe(
    'SELECT clock_timestamp() AS "now"',
  );
  const value = Array.isArray(rows) && rows.length === 1 ? rows[0]?.now : null;
  const now = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(now.getTime())) throw unavailableError();
  return now;
}

async function garbageCollectExpiredBuckets(transaction, organizationId, now) {
  await transaction.$queryRawUnsafe(
    `WITH candidates AS (
      SELECT bucket."id"
      FROM "ProgressEvidenceLocationRateBucket" AS bucket
      WHERE bucket."organizationId" = $1
        AND bucket."expiresAt" <= $2
      ORDER BY bucket."expiresAt" ASC, bucket."id" ASC
      LIMIT $3::int
      FOR UPDATE OF bucket SKIP LOCKED
    )
    DELETE FROM "ProgressEvidenceLocationRateBucket" AS doomed
    USING candidates
    WHERE doomed."id" = candidates."id"
    RETURNING doomed."id"`,
    organizationId,
    now,
    PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.gcBatchSize,
  );
}

function bucketWhere(organizationId, scope, scopeKeyHash) {
  return {
    organizationId_scope_scopeKeyHash: {
      organizationId,
      scope,
      scopeKeyHash,
    },
  };
}

function normalizeWindowBuckets(value, currentSecond, limit) {
  if (!Array.isArray(value) || value.length > PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.windowSeconds) {
    throw unavailableError();
  }
  const firstIncludedSecond = currentSecond
    - PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.windowSeconds
    + 1;
  const normalized = [];
  let previousSecond = null;
  let total = 0;
  for (const item of value) {
    if (
      !Array.isArray(item)
      || item.length !== 2
      || !Number.isSafeInteger(item[0])
      || item[0] < 0
      || !Number.isSafeInteger(item[1])
      || item[1] < 1
      || item[1] > limit
      || (previousSecond !== null && item[0] <= previousSecond)
      || item[0] > currentSecond
    ) throw unavailableError();
    previousSecond = item[0];
    if (item[0] < firstIncludedSecond) continue;
    total += item[1];
    if (total > limit) throw unavailableError();
    normalized.push([item[0], item[1]]);
  }
  return { buckets: normalized, total };
}

function appendCurrentSecond(window, currentSecond) {
  const buckets = window.buckets.map((item) => [...item]);
  const last = buckets.at(-1);
  if (last?.[0] === currentSecond) last[1] += 1;
  else buckets.push([currentSecond, 1]);
  return buckets;
}

function retryAfterSeconds(window, currentSecond) {
  const oldestSecond = window.buckets[0]?.[0];
  if (!Number.isSafeInteger(oldestSecond)) return 60;
  return Math.min(
    PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.windowSeconds,
    Math.max(
      1,
      oldestSecond
        + PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.windowSeconds
        - currentSecond,
    ),
  );
}

async function loadBucket(transaction, organizationId, scope, scopeKeyHash) {
  return transaction.progressEvidenceLocationRateBucket.findUnique({
    where: bucketWhere(organizationId, scope, scopeKeyHash),
    select: {
      id: true,
      organizationId: true,
      scope: true,
      scopeKeyHash: true,
      windowBuckets: true,
      blockedCount: true,
      expiresAt: true,
    },
  });
}

async function writeAdmittedBucket(
  transaction,
  { bucket, organizationId, scope, scopeKeyHash, windowBuckets, now, expiresAt },
) {
  if (bucket) {
    return transaction.progressEvidenceLocationRateBucket.update({
      where: { id: bucket.id },
      data: { windowBuckets, expiresAt, updatedAt: now },
    });
  }
  return transaction.progressEvidenceLocationRateBucket.create({
    data: {
      organizationId,
      scope,
      scopeKeyHash,
      windowBuckets,
      expiresAt,
      updatedAt: now,
    },
  });
}

async function recordBlockedBucket(transaction, bucket, now, expiresAt) {
  if (!bucket?.id) throw unavailableError();
  await transaction.progressEvidenceLocationRateBucket.update({
    where: { id: bucket.id },
    data: {
      blockedCount: { increment: 1n },
      lastBlockedAt: now,
      expiresAt,
      updatedAt: now,
    },
  });
}

export async function reserveProgressEvidenceLocationRequest(prisma, rawInput) {
  assertPrisma(prisma);
  const input = normalizedInput(rawInput);
  let decision;
  try {
    decision = await prisma.$transaction(async (transaction) => {
      assertTransaction(transaction);
      const observedSession = await transaction.progressEvidenceCaptureSession.findFirst({
        where: { id: input.sessionId, workerId: input.workerId },
        select: {
          id: true,
          organizationId: true,
          projectId: true,
          workerId: true,
          tokenHash: true,
          status: true,
          expiresAt: true,
        },
      });
      if (
        !sessionAuthorizesToken(observedSession, input)
      ) throw tokenDenied();

      await transaction.$executeRawUnsafe(
        `SET LOCAL lock_timeout = '${PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.lockTimeoutMs}ms'`,
      );
      await transaction.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        `obrasaas:progress-evidence-location-rate:${observedSession.organizationId}`,
      );
      const session = await lockAuthoritativeSession(transaction, {
        input,
        observedOrganizationId: observedSession.organizationId,
      });
      // The authoritative clock is read after waiting for the lock. Using an
      // application clock or transaction start time can drift across Vercel
      // instances and miscount the sliding window under contention.
      const now = await databaseClock(transaction);
      const currentSecond = Math.floor(now.getTime() / 1_000);
      const expiresAt = new Date(
        now.getTime() + PROGRESS_EVIDENCE_LOCATION_RATE_LIMITS.bucketRetentionMs,
      );

      await garbageCollectExpiredBuckets(transaction, session.organizationId, now);

      const policy = ratePolicyForSession(session, now);
      const sessionScopeKey = progressEvidenceLocationTokenFingerprint({
        organizationId: session.organizationId,
        projectId: session.projectId,
        workerId: session.workerId,
        sessionId: session.id,
        storedTokenHash: session.tokenHash,
        lane: policy.lane,
      });
      const organizationScopeKey = organizationScopeHash(
        session.organizationId,
        policy.lane,
      );
      const [sessionBucket, organizationBucket] = await Promise.all([
        loadBucket(
          transaction,
          session.organizationId,
          policy.sessionScope,
          sessionScopeKey,
        ),
        loadBucket(
          transaction,
          session.organizationId,
          policy.organizationScope,
          organizationScopeKey,
        ),
      ]);
      const sessionWindow = normalizeWindowBuckets(
        sessionBucket?.windowBuckets || [],
        currentSecond,
        policy.sessionLimit,
      );
      const organizationWindow = normalizeWindowBuckets(
        organizationBucket?.windowBuckets || [],
        currentSecond,
        policy.organizationLimit,
      );

      const limited = sessionWindow.total
        >= policy.sessionLimit
        ? {
            code: "PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT",
            bucket: sessionBucket,
            window: sessionWindow,
          }
        : organizationWindow.total
            >= policy.organizationLimit
          ? {
              code: "PROGRESS_EVIDENCE_LOCATION_ORGANIZATION_RATE_LIMIT",
              bucket: organizationBucket,
              window: organizationWindow,
            }
          : null;
      if (limited) {
        await recordBlockedBucket(transaction, limited.bucket, now, expiresAt);
        return {
          limited: true,
          code: limited.code,
          retryAfterSeconds: retryAfterSeconds(limited.window, currentSecond),
        };
      }

      await writeAdmittedBucket(transaction, {
        bucket: sessionBucket,
        organizationId: session.organizationId,
        scope: policy.sessionScope,
        scopeKeyHash: sessionScopeKey,
        windowBuckets: appendCurrentSecond(sessionWindow, currentSecond),
        now,
        expiresAt,
      });
      await writeAdmittedBucket(transaction, {
        bucket: organizationBucket,
        organizationId: session.organizationId,
        scope: policy.organizationScope,
        scopeKeyHash: organizationScopeKey,
        windowBuckets: appendCurrentSecond(organizationWindow, currentSecond),
        now,
        expiresAt,
      });

      return {
        limited: false,
        organizationId: session.organizationId,
        projectId: session.projectId,
        sessionId: session.id,
        action: input.action,
      };
    }, {
      isolationLevel: "ReadCommitted",
      maxWait: 3_000,
      timeout: 5_000,
    });
  } catch (error) {
    if (isProgressEvidenceLocationRateLimitError(error)) throw error;
    throw unavailableError();
  }

  if (decision?.limited) {
    throw rateLimitError(
      "Recibimos varias solicitudes para esta evidencia. Esperá antes de reintentar.",
      decision.code,
      429,
      decision.retryAfterSeconds,
    );
  }
  return {
    organizationId: decision.organizationId,
    projectId: decision.projectId,
    sessionId: decision.sessionId,
    action: decision.action,
  };
}
