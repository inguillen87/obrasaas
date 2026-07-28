import crypto from "node:crypto";

export const WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS = Object.freeze({
  connectionPerMinute: 600,
  leaseMs: 12_000,
  retentionMs: 24 * 60 * 60 * 1_000,
  gcBatchSize: 500,
  gcMaxBatchSize: 5_000,
  gcEndpointsPerRun: 2,
  gcMaxEndpointsPerRun: 16,
  tombstoneRetirementGraceMs: 10 * 60 * 1_000,
});

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACTION_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const SCREEN_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
const FAILURE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

export class WhatsAppFlowEndpointRequestError extends Error {
  constructor(message, { code, status, retryAfterSeconds = null }) {
    super(message);
    this.name = "WhatsAppFlowEndpointRequestError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function requestError(message, code, status, retryAfterSeconds = null) {
  return new WhatsAppFlowEndpointRequestError(message, {
    code,
    status,
    retryAfterSeconds,
  });
}

function validDate(value, name) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw requestError(
      `Invalid WhatsApp Flow endpoint ${name}.`,
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  return parsed;
}

function normalizedUuid(value, name) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw requestError(
      `Invalid WhatsApp Flow endpoint ${name}.`,
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  return normalized;
}

function requestDelegate(prisma) {
  const delegate = prisma?.whatsAppFlowEndpointRequest;
  if (
    !delegate
    || typeof delegate.findUnique !== "function"
    || typeof delegate.count !== "function"
    || typeof delegate.create !== "function"
    || typeof delegate.updateMany !== "function"
  ) {
    throw requestError(
      "WhatsApp Flow endpoint request persistence is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE",
      503,
    );
  }
  return delegate;
}

export function hashWhatsAppFlowEndpointRequest(rawBytes) {
  if (!Buffer.isBuffer(rawBytes) && !(rawBytes instanceof Uint8Array)) {
    throw new TypeError("Raw WhatsApp Flow request bytes are required.");
  }
  return crypto.createHash("sha256").update(rawBytes).digest("hex");
}

export async function garbageCollectWhatsAppFlowEndpointRequests(
  prisma,
  {
    endpointId: rawEndpointId,
    now = new Date(),
    batchSize = WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcBatchSize,
  },
) {
  if (typeof prisma?.$transaction !== "function") {
    throw requestError(
      "WhatsApp Flow endpoint request garbage collection is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE",
      503,
    );
  }
  const endpointId = normalizedUuid(rawEndpointId, "identity");
  const requestedAt = validDate(now, "garbage collection clock");
  if (
    !Number.isSafeInteger(batchSize)
    || batchSize < 1
    || batchSize > WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcMaxBatchSize
  ) {
    throw requestError(
      "Invalid WhatsApp Flow endpoint request garbage collection batch.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  const oldestEligibleCreatedAt = new Date(
    requestedAt.getTime() - WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.retentionMs,
  );
  const retiredBefore = new Date(
    requestedAt.getTime()
      - WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.tombstoneRetirementGraceMs,
  );

  return prisma.$transaction(async (transaction) => {
    if (typeof transaction?.$queryRawUnsafe !== "function") {
      throw requestError(
        "WhatsApp Flow endpoint request garbage collection is unavailable.",
        "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE",
        503,
      );
    }
    await lockRequest(transaction, endpointId);
    const deleted = await transaction.$queryRawUnsafe(
      `WITH candidates AS (
        SELECT request."id"
        FROM "WhatsAppFlowEndpointRequest" AS request
        WHERE request."endpointId" = $1::uuid
          AND request."createdAt" <= $2
          AND request."expiresAt" <= $3
          AND (
            (
              request."responseCiphertext" IS NULL
              AND (
                request."status" <> 'PROCESSING'
                OR request."leaseExpiresAt" IS NULL
                OR request."leaseExpiresAt" <= $3
              )
            )
            OR (
              request."responseCiphertext" IS NOT NULL
              AND request."keyVersion" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM "WhatsAppFlowEndpointKey" AS endpoint_key
                WHERE endpoint_key."endpointId" = request."endpointId"
                  AND endpoint_key."version" = request."keyVersion"
                  AND (
                    (
                      endpoint_key."status" = 'REVOKED'
                      AND endpoint_key."updatedAt" <= $4
                    )
                    OR (
                      endpoint_key."status" = 'RETIRING'
                      AND endpoint_key."retireAfter" <= $4
                    )
                  )
              )
            )
          )
        ORDER BY request."createdAt" ASC
        LIMIT $5::int
        FOR UPDATE OF request SKIP LOCKED
      )
      DELETE FROM "WhatsAppFlowEndpointRequest" AS doomed
      USING candidates
      WHERE doomed."id" = candidates."id"
      RETURNING doomed."id"`,
      endpointId,
      oldestEligibleCreatedAt,
      requestedAt,
      retiredBefore,
      batchSize,
    );
    const deletedCount = Array.isArray(deleted) ? deleted.length : 0;
    return {
      deletedCount,
      hasMore: deletedCount === batchSize,
    };
  }, { maxWait: 3_000, timeout: 10_000 });
}

export async function garbageCollectWhatsAppFlowEndpointRequestBacklog(
  prisma,
  {
    now = new Date(),
    maxEndpoints = WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcEndpointsPerRun,
    batchSize = 250,
  } = {},
) {
  if (
    typeof prisma?.$queryRawUnsafe !== "function"
    || typeof prisma?.$transaction !== "function"
  ) {
    throw requestError(
      "WhatsApp Flow endpoint request garbage collection is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE",
      503,
    );
  }
  const requestedAt = validDate(now, "garbage collection clock");
  if (
    !Number.isSafeInteger(maxEndpoints)
    || maxEndpoints < 1
    || maxEndpoints > WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcMaxEndpointsPerRun
    || !Number.isSafeInteger(batchSize)
    || batchSize < 1
    || batchSize > WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.gcMaxBatchSize
  ) {
    throw requestError(
      "Invalid WhatsApp Flow endpoint request garbage collection bounds.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  const oldestEligibleCreatedAt = new Date(
    requestedAt.getTime() - WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.retentionMs,
  );
  const retiredBefore = new Date(
    requestedAt.getTime()
      - WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.tombstoneRetirementGraceMs,
  );
  const candidates = await prisma.$queryRawUnsafe(
    `SELECT request."endpointId"
    FROM "WhatsAppFlowEndpointRequest" AS request
    WHERE request."createdAt" <= $1
      AND request."expiresAt" <= $2
      AND (
        (
          request."responseCiphertext" IS NULL
          AND (
            request."status" <> 'PROCESSING'
            OR request."leaseExpiresAt" IS NULL
            OR request."leaseExpiresAt" <= $2
          )
        )
        OR (
          request."responseCiphertext" IS NOT NULL
          AND request."keyVersion" IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM "WhatsAppFlowEndpointKey" AS endpoint_key
            WHERE endpoint_key."endpointId" = request."endpointId"
              AND endpoint_key."version" = request."keyVersion"
              AND (
                (
                  endpoint_key."status" = 'REVOKED'
                  AND endpoint_key."updatedAt" <= $3
                )
                OR (
                  endpoint_key."status" = 'RETIRING'
                  AND endpoint_key."retireAfter" <= $3
                )
              )
          )
        )
      )
    GROUP BY request."endpointId"
    ORDER BY MIN(request."createdAt") ASC
    LIMIT $4::int`,
    oldestEligibleCreatedAt,
    requestedAt,
    retiredBefore,
    maxEndpoints,
  );

  let deletedCount = 0;
  let failedEndpoints = 0;
  let hasMore = false;
  const endpointIds = Array.isArray(candidates)
    ? candidates.map((candidate) => candidate?.endpointId).filter(Boolean)
    : [];
  for (const endpointId of endpointIds) {
    try {
      const result = await garbageCollectWhatsAppFlowEndpointRequests(prisma, {
        endpointId,
        now: requestedAt,
        batchSize,
      });
      deletedCount += result.deletedCount;
      hasMore ||= result.hasMore;
    } catch {
      // Cron maintenance is best-effort and must not block webhook recovery.
      failedEndpoints += 1;
    }
  }
  return {
    scannedEndpoints: endpointIds.length,
    failedEndpoints,
    deletedCount,
    hasMore: hasMore || endpointIds.length === maxEndpoints,
  };
}

function requestWhere(endpointId, requestSha256) {
  return {
    endpointId_requestSha256: {
      endpointId,
      requestSha256,
    },
  };
}

function terminalReplay(record, now) {
  if (!record || record.status === "PROCESSING") return false;
  // Once ciphertext has been exposed, the digest is a cryptographic tombstone:
  // Meta may replay the envelope while its RSA key is accepted, and recomputing
  // could reuse the protocol-mandated AES-GCM response nonce. Failures without
  // ciphertext are only a bounded negative cache and remain recoverable.
  return record.responseCiphertext !== null && record.responseCiphertext !== undefined
    ? true
    : validDate(record.expiresAt, "expiry") > now;
}

function activeLease(record, now) {
  return record?.status === "PROCESSING"
    && record.leaseToken
    && record.leaseExpiresAt
    && validDate(record.leaseExpiresAt, "lease") > now;
}

async function lockRequest(transaction, endpointId) {
  if (typeof transaction?.$executeRawUnsafe !== "function") {
    throw requestError(
      "WhatsApp Flow endpoint transaction locking is unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE",
      503,
    );
  }
  await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '2500ms'");
  await transaction.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    // One shared lock per endpoint makes the count+create rate-limit decision
    // atomic even when many distinct request digests arrive concurrently.
    `obrasaas:flow-data:${endpointId}`,
  );
}

export async function reserveWhatsAppFlowEndpointRequest(
  prisma,
  {
    endpointId: rawEndpointId,
    requestSha256: rawRequestSha256,
    now = new Date(),
  },
) {
  if (typeof prisma?.$transaction !== "function") {
    throw requestError(
      "WhatsApp Flow endpoint transactions are unavailable.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE",
      503,
    );
  }
  const endpointId = normalizedUuid(rawEndpointId, "identity");
  const requestSha256 = String(rawRequestSha256 || "").trim().toLowerCase();
  if (!HASH_PATTERN.test(requestSha256)) {
    throw requestError(
      "Invalid WhatsApp Flow endpoint request digest.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  const requestedAt = validDate(now, "clock");

  return prisma.$transaction(async (transaction) => {
    const delegate = requestDelegate(transaction);
    await lockRequest(transaction, endpointId);
    let record = await delegate.findUnique({
      where: requestWhere(endpointId, requestSha256),
    });

    if (terminalReplay(record, requestedAt)) {
      await delegate.updateMany({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return { state: "replay", record };
    }
    if (activeLease(record, requestedAt)) {
      await delegate.updateMany({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return { state: "in_flight", record };
    }

    if (!record) {
      const recentCount = await delegate.count({
        where: {
          endpointId,
          createdAt: { gte: new Date(requestedAt.getTime() - 60_000) },
        },
      });
      if (recentCount >= WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.connectionPerMinute) {
        throw requestError(
          "WhatsApp Flow endpoint request rate exceeded.",
          "WHATSAPP_FLOW_ENDPOINT_RATE_LIMIT",
          429,
          60,
        );
      }
    }

    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = new Date(
      requestedAt.getTime() + WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.leaseMs,
    );
    const expiresAt = new Date(
      requestedAt.getTime() + WHATSAPP_FLOW_ENDPOINT_REQUEST_LIMITS.retentionMs,
    );

    if (record) {
      const claimed = await delegate.updateMany({
        where: { id: record.id },
        data: {
          status: "PROCESSING",
          responseStatus: null,
          responseCiphertext: null,
          failureCode: null,
          flowSessionId: null,
          workerOnboardingFlowSessionId: null,
          leaseToken,
          leaseExpiresAt,
          completedAt: null,
          expiresAt,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        throw requestError(
          "WhatsApp Flow endpoint request lease was not acquired.",
          "WHATSAPP_FLOW_ENDPOINT_REQUEST_CONFLICT",
          409,
        );
      }
      record = await delegate.findUnique({ where: { id: record.id } });
    } else {
      record = await delegate.create({
        data: {
          endpointId,
          requestSha256,
          action: "UNKNOWN",
          status: "PROCESSING",
          leaseToken,
          leaseExpiresAt,
          expiresAt,
        },
      });
    }
    return { state: "claimed", record: { ...record, leaseToken } };
  }, { maxWait: 3_000, timeout: 5_000 });
}

function normalizedCompletion(input) {
  const requestId = normalizedUuid(input.requestId ?? input.id, "request identity");
  const leaseToken = normalizedUuid(input.leaseToken, "request lease");
  const status = String(input.status || "");
  if (!new Set(["SUCCEEDED", "REJECTED", "FAILED"]).has(status)) {
    throw requestError(
      "Invalid WhatsApp Flow endpoint terminal status.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  const responseStatus = Number(input.responseStatus);
  if (!Number.isSafeInteger(responseStatus) || responseStatus < 100 || responseStatus > 599) {
    throw requestError(
      "Invalid WhatsApp Flow endpoint response status.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  const action = String(input.action || "UNKNOWN");
  const screen = input.screen === undefined || input.screen === null || input.screen === ""
    ? null
    : String(input.screen);
  const failureCode = input.failureCode === undefined || input.failureCode === null
    ? null
    : String(input.failureCode);
  const responseCiphertext = input.responseCiphertext === undefined
    || input.responseCiphertext === null
    ? null
    : String(input.responseCiphertext);
  const flowSessionId = input.flowSessionId
    ? normalizedUuid(input.flowSessionId, "Flow session identity")
    : null;
  const workerOnboardingFlowSessionId = input.workerOnboardingFlowSessionId
    ? normalizedUuid(
      input.workerOnboardingFlowSessionId,
      "worker onboarding Flow session identity",
    )
    : null;
  const keyVersion = input.keyVersion === undefined || input.keyVersion === null
    ? null
    : Number(input.keyVersion);

  if (
    !ACTION_PATTERN.test(action)
    || (screen && !SCREEN_PATTERN.test(screen))
    || (failureCode && !FAILURE_PATTERN.test(failureCode))
    || (responseCiphertext && Buffer.byteLength(responseCiphertext, "utf8") > 262_144)
    || (keyVersion !== null && (!Number.isSafeInteger(keyVersion) || keyVersion < 1))
    || (flowSessionId && workerOnboardingFlowSessionId)
    || (status === "SUCCEEDED" && (!responseCiphertext || failureCode || responseStatus < 200 || responseStatus > 299))
    || (status !== "SUCCEEDED" && !failureCode)
  ) {
    throw requestError(
      "Invalid WhatsApp Flow endpoint completion.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_INVALID",
      500,
    );
  }
  return {
    requestId,
    leaseToken,
    status,
    responseStatus,
    action,
    screen,
    failureCode,
    responseCiphertext,
    flowSessionId,
    workerOnboardingFlowSessionId,
    keyVersion,
    completedAt: validDate(input.completedAt ?? new Date(), "completion clock"),
  };
}

export async function completeWhatsAppFlowEndpointRequest(prisma, input) {
  const delegate = requestDelegate(prisma);
  const completion = normalizedCompletion(input);
  const result = await delegate.updateMany({
    where: {
      id: completion.requestId,
      status: "PROCESSING",
      leaseToken: completion.leaseToken,
    },
    data: {
      status: completion.status,
      responseStatus: completion.responseStatus,
      responseCiphertext: completion.responseCiphertext,
      failureCode: completion.failureCode,
      action: completion.action,
      screen: completion.screen,
      keyVersion: completion.keyVersion,
      flowSessionId: completion.flowSessionId,
      workerOnboardingFlowSessionId: completion.workerOnboardingFlowSessionId,
      completedAt: completion.completedAt,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  if (result.count !== 1) {
    throw requestError(
      "WhatsApp Flow endpoint request lease was lost.",
      "WHATSAPP_FLOW_ENDPOINT_REQUEST_CONFLICT",
      409,
    );
  }
  return true;
}
