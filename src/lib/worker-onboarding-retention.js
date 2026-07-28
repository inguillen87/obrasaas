import crypto from "node:crypto";

export const WORKER_ONBOARDING_RETENTION_BATCH_LIMIT = 100;

const RETENTION_POLICY_VERSION = "worker-onboarding-transient-v1";
const TERMINAL_STATUS = "EXPIRED";
const ELIGIBLE_STATUSES = new Set(["PENDING", "SUBMITTED"]);
const TERMINAL_STATUSES = new Set(["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"]);

export class WorkerOnboardingRetentionError extends Error {
  constructor(message, code = "WORKER_ONBOARDING_RETENTION_FAILED") {
    super(message);
    this.name = "WorkerOnboardingRetentionError";
    this.code = code;
    this.status = code === "WORKER_ONBOARDING_RETENTION_UNAVAILABLE" ? 503 : 500;
  }
}

function retentionError(message, code) {
  return new WorkerOnboardingRetentionError(message, code);
}

function retentionClock(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw retentionError(
      "Invalid worker-onboarding retention clock.",
      "WORKER_ONBOARDING_RETENTION_INPUT_INVALID",
    );
  }
  return date;
}

function retentionBatchSize(value) {
  const size = value ?? WORKER_ONBOARDING_RETENTION_BATCH_LIMIT;
  if (
    !Number.isSafeInteger(size)
    || size < 1
    || size > WORKER_ONBOARDING_RETENTION_BATCH_LIMIT
  ) {
    throw retentionError(
      `Worker-onboarding retention batchSize must be between 1 and ${WORKER_ONBOARDING_RETENTION_BATCH_LIMIT}.`,
      "WORKER_ONBOARDING_RETENTION_INPUT_INVALID",
    );
  }
  return size;
}

function assertPersistence(prisma) {
  if (typeof prisma?.$transaction !== "function") {
    throw retentionError(
      "Worker-onboarding retention persistence is unavailable.",
      "WORKER_ONBOARDING_RETENTION_UNAVAILABLE",
    );
  }
}

export function workerOnboardingSensitivePurgeData({ status, purgedAt }) {
  const terminalStatus = String(status || "").trim().toUpperCase();
  if (!TERMINAL_STATUSES.has(terminalStatus)) {
    throw retentionError(
      "Worker-onboarding sensitive data can only be purged with a terminal status.",
      "WORKER_ONBOARDING_RETENTION_INPUT_INVALID",
    );
  }
  const timestamp = retentionClock(purgedAt);
  return {
    status: terminalStatus,
    openClaimKey: null,
    senderEncryptedPayload: null,
    senderFingerprint: null,
    senderFingerprintKeyId: null,
    senderLastFour: null,
    senderWrappingKeyId: null,
    senderRecordVersion: null,
    claimedIdentityEncryptedPayload: null,
    claimedCuilFingerprint: null,
    claimedCuilFingerprintKeyId: null,
    claimedCuilLastFour: null,
    claimedIdentityWrappingKeyId: null,
    claimedIdentityRecordVersion: null,
    sensitiveDataPurgedAt: timestamp,
    revision: { increment: 1 },
  };
}

function normalizedExpiredClaim(row) {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const organizationId = typeof row?.organizationId === "string"
    ? row.organizationId.trim()
    : "";
  const projectId = typeof row?.projectId === "string" ? row.projectId.trim() : "";
  const previousStatus = String(row?.previousStatus || "").trim().toUpperCase();
  const revision = Number(row?.revision);
  if (
    !id
    || !organizationId
    || !projectId
    || !ELIGIBLE_STATUSES.has(previousStatus)
    || !Number.isSafeInteger(revision)
    || revision < 1
  ) {
    throw retentionError(
      "Worker-onboarding retention returned an invalid database result.",
      "WORKER_ONBOARDING_RETENTION_STATE_INVALID",
    );
  }
  return { id, organizationId, projectId, previousStatus, revision };
}

/**
 * Clock-driven crypto erasure for stale, still-open onboarding claims.
 *
 * PostgreSQL selects and mutates at most one bounded page under row locks. The
 * audit insert shares the transaction, so neither an unaudited purge nor an
 * audit for a rolled-back purge can become durable.
 */
export async function expireAndPurgeWorkerOnboardingClaimsBatch(
  prisma,
  {
    now = new Date(),
    batchSize = WORKER_ONBOARDING_RETENTION_BATCH_LIMIT,
  } = {},
) {
  assertPersistence(prisma);
  const expiredAt = retentionClock(now);
  const limit = retentionBatchSize(batchSize);

  return prisma.$transaction(async (transaction) => {
    if (
      typeof transaction?.$queryRawUnsafe !== "function"
      || typeof transaction?.auditLog?.createMany !== "function"
    ) {
      throw retentionError(
        "Worker-onboarding retention persistence is unavailable.",
        "WORKER_ONBOARDING_RETENTION_UNAVAILABLE",
      );
    }

    const result = await transaction.$queryRawUnsafe(
      `WITH candidates AS (
         SELECT claim."id",
                claim."organizationId",
                claim."projectId",
                claim."status" AS "previousStatus"
           FROM "WorkerOnboardingClaim" AS claim
          WHERE claim."status" IN ('PENDING', 'SUBMITTED')
            AND claim."expiresAt" <= $1
            AND claim."sensitiveDataPurgedAt" IS NULL
          ORDER BY claim."expiresAt" ASC, claim."id" ASC
          LIMIT $2::int
          FOR UPDATE OF claim SKIP LOCKED
       )
       UPDATE "WorkerOnboardingClaim" AS claim
          SET "status" = 'EXPIRED',
              "openClaimKey" = NULL,
              "senderEncryptedPayload" = NULL,
              "senderFingerprint" = NULL,
              "senderFingerprintKeyId" = NULL,
              "senderLastFour" = NULL,
              "senderWrappingKeyId" = NULL,
              "senderRecordVersion" = NULL,
              "claimedIdentityEncryptedPayload" = NULL,
              "claimedCuilFingerprint" = NULL,
              "claimedCuilFingerprintKeyId" = NULL,
              "claimedCuilLastFour" = NULL,
              "claimedIdentityWrappingKeyId" = NULL,
              "claimedIdentityRecordVersion" = NULL,
              "sensitiveDataPurgedAt" = $1,
              "revision" = claim."revision" + 1,
              "updatedAt" = $1
         FROM candidates
        WHERE claim."id" = candidates."id"
      RETURNING claim."id",
                claim."organizationId",
                claim."projectId",
                candidates."previousStatus",
                claim."revision"`,
      expiredAt,
      limit,
    );

    if (!Array.isArray(result) || result.length > limit) {
      throw retentionError(
        "Worker-onboarding retention returned an invalid database result.",
        "WORKER_ONBOARDING_RETENTION_STATE_INVALID",
      );
    }
    const expiredClaims = result.map(normalizedExpiredClaim);
    if (expiredClaims.length > 0) {
      const audit = await transaction.auditLog.createMany({
        data: expiredClaims.map((claim) => ({
          id: crypto.randomUUID(),
          organizationId: claim.organizationId,
          actorId: null,
          action: "worker.onboarding.sensitive_bundle_purged",
          entityType: "WorkerOnboardingClaim",
          entityId: claim.id,
          metadata: {
            projectId: claim.projectId,
            previousStatus: claim.previousStatus,
            status: TERMINAL_STATUS,
            revision: claim.revision,
            reason: "AUTOMATIC_EXPIRY",
            retentionPolicyVersion: RETENTION_POLICY_VERSION,
          },
          createdAt: expiredAt,
        })),
      });
      if (Number(audit?.count) !== expiredClaims.length) {
        throw retentionError(
          "Worker-onboarding retention audit did not match the purged batch.",
          "WORKER_ONBOARDING_RETENTION_AUDIT_FAILED",
        );
      }
    }

    const count = expiredClaims.length;
    return {
      scanned: count,
      expired: count,
      purged: count,
      auditRows: count,
      hasMore: count === limit,
      failedBatches: 0,
      failureCodes: [],
    };
  }, {
    isolationLevel: "ReadCommitted",
    maxWait: 3_000,
    timeout: 10_000,
  });
}
