-- H3.1 retention contract for transient pre-worker identity claims.
-- Terminal rows keep tenant scope, lifecycle, privacy evidence, exact operation
-- hashes and append-only decision relations, but cryptoshred both reversible or
-- correlatable identity bundles in the same state transition.

ALTER TABLE "WorkerOnboardingClaim"
ADD COLUMN "sensitiveDataPurgedAt" TIMESTAMP(3);

COMMENT ON COLUMN "WorkerOnboardingClaim"."sensitiveDataPurgedAt" IS
  'Timestamp at which sender and claimed-identity bundles were cryptoshredded.';

-- claimTokenHash is a one-way SHA-256 commitment over a 256-bit secret bearer token.
-- It is retained after sensitive-data purge because exact replay, request
-- correlation and audit verification depend on it; it is never the raw bearer token.
COMMENT ON COLUMN "WorkerOnboardingClaim"."claimTokenHash" IS
  'Retained one-way SHA-256 commitment for exact replay and audit binding; never the raw bearer token.';

-- The historical constraints require sensitive fields in terminal states and
-- couple acceptance evidence to the encrypted identity bundle. Replace them
-- only after the columns can represent a cryptoshredded tombstone.
ALTER TABLE "WorkerOnboardingClaim"
  DROP CONSTRAINT "WorkerOnboardingClaim_sender_check",
  DROP CONSTRAINT "WorkerOnboardingClaim_identity_bundle_check",
  DROP CONSTRAINT "WorkerClaim_privacy_notice_evidence_check",
  DROP CONSTRAINT "WorkerOnboardingClaim_state_check",
  ALTER COLUMN "senderEncryptedPayload" DROP NOT NULL,
  ALTER COLUMN "senderFingerprint" DROP NOT NULL,
  ALTER COLUMN "senderFingerprintKeyId" DROP NOT NULL,
  ALTER COLUMN "senderLastFour" DROP NOT NULL,
  ALTER COLUMN "senderWrappingKeyId" DROP NOT NULL,
  ALTER COLUMN "senderRecordVersion" DROP NOT NULL;

-- Existing terminal claims are migrated to the same evidence-preserving
-- tombstone shape required for all future terminal transitions.
WITH terminal_claims AS (
  SELECT "id",
         GREATEST(
           "createdAt",
           "updatedAt",
           COALESCE("submittedAt", "createdAt"),
           COALESCE("reviewedAt", "createdAt"),
           CURRENT_TIMESTAMP::TIMESTAMP(3)
         ) AS "purgedAt"
    FROM "WorkerOnboardingClaim"
   WHERE "status" IN ('APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')
)
UPDATE "WorkerOnboardingClaim" AS claim
   SET "senderEncryptedPayload" = NULL,
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
       "sensitiveDataPurgedAt" = terminal_claims."purgedAt",
       "updatedAt" = terminal_claims."purgedAt"
  FROM terminal_claims
 WHERE claim."id" = terminal_claims."id";

ALTER TABLE "WorkerOnboardingClaim"
  ADD CONSTRAINT "WorkerOnboardingClaim_sender_check" CHECK (
    num_nonnulls(
      "senderEncryptedPayload",
      "senderFingerprint",
      "senderFingerprintKeyId",
      "senderLastFour",
      "senderWrappingKeyId",
      "senderRecordVersion"
    ) = 0
    OR
    (
      num_nonnulls(
        "senderEncryptedPayload",
        "senderFingerprint",
        "senderFingerprintKeyId",
        "senderLastFour",
        "senderWrappingKeyId",
        "senderRecordVersion"
      ) = 6
      AND octet_length("senderEncryptedPayload") BETWEEN 20 AND 16384
      AND "senderEncryptedPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
      AND "senderFingerprint" ~ '^[0-9a-f]{64}$'
      AND "senderFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "senderLastFour" ~ '^[0-9]{4}$'
      AND "senderWrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "senderRecordVersion" > 0
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerOnboardingClaim_identity_bundle_check" CHECK (
    num_nonnulls(
      "claimedIdentityEncryptedPayload",
      "claimedCuilFingerprint",
      "claimedCuilFingerprintKeyId",
      "claimedCuilLastFour",
      "claimedIdentityWrappingKeyId",
      "claimedIdentityRecordVersion"
    ) = 0
    OR
    (
      num_nonnulls(
        "claimedIdentityEncryptedPayload",
        "claimedCuilFingerprint",
        "claimedCuilFingerprintKeyId",
        "claimedCuilLastFour",
        "claimedIdentityWrappingKeyId",
        "claimedIdentityRecordVersion"
      ) = 6
      AND octet_length("claimedIdentityEncryptedPayload") BETWEEN 20 AND 16384
      AND "claimedIdentityEncryptedPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
      AND "claimedCuilFingerprint" ~ '^[0-9a-f]{64}$'
      AND "claimedCuilFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "claimedCuilLastFour" ~ '^[0-9]{4}$'
      AND "claimedIdentityWrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "claimedIdentityRecordVersion" > 0
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerClaim_privacy_notice_evidence_check" CHECK (
    num_nonnulls(
      "privacyNoticeVersion",
      "privacyNoticeContentSha256",
      "privacyAcceptedAt"
    ) = 0
    OR
    (
      num_nonnulls(
        "privacyNoticeVersion",
        "privacyNoticeContentSha256",
        "privacyAcceptedAt"
      ) = 3
      AND "privacyNoticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      AND "privacyNoticeContentSha256" ~ '^[0-9a-f]{64}$'
      AND "privacyAcceptedAt" >= "createdAt"
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerClaim_sensitive_retention_check" CHECK (
    (
      "status" IN ('PENDING', 'SUBMITTED')
      AND "sensitiveDataPurgedAt" IS NULL
      AND num_nonnulls(
        "senderEncryptedPayload",
        "senderFingerprint",
        "senderFingerprintKeyId",
        "senderLastFour",
        "senderWrappingKeyId",
        "senderRecordVersion"
      ) = 6
      AND (
        (
          "status" = 'PENDING'
          AND num_nonnulls(
            "claimedIdentityEncryptedPayload",
            "claimedCuilFingerprint",
            "claimedCuilFingerprintKeyId",
            "claimedCuilLastFour",
            "claimedIdentityWrappingKeyId",
            "claimedIdentityRecordVersion"
          ) = 0
        )
        OR
        (
          "status" = 'SUBMITTED'
          AND num_nonnulls(
            "claimedIdentityEncryptedPayload",
            "claimedCuilFingerprint",
            "claimedCuilFingerprintKeyId",
            "claimedCuilLastFour",
            "claimedIdentityWrappingKeyId",
            "claimedIdentityRecordVersion"
          ) = 6
        )
      )
    )
    OR
    (
      "status" IN ('APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')
      AND "sensitiveDataPurgedAt" IS NOT NULL
      AND "sensitiveDataPurgedAt" >= "createdAt"
      AND ("submittedAt" IS NULL OR "sensitiveDataPurgedAt" >= "submittedAt")
      AND ("reviewedAt" IS NULL OR "sensitiveDataPurgedAt" >= "reviewedAt")
      AND num_nonnulls(
        "senderEncryptedPayload",
        "senderFingerprint",
        "senderFingerprintKeyId",
        "senderLastFour",
        "senderWrappingKeyId",
        "senderRecordVersion"
      ) = 0
      AND num_nonnulls(
        "claimedIdentityEncryptedPayload",
        "claimedCuilFingerprint",
        "claimedCuilFingerprintKeyId",
        "claimedCuilLastFour",
        "claimedIdentityWrappingKeyId",
        "claimedIdentityRecordVersion"
      ) = 0
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerOnboardingClaim_state_check" CHECK (
    (
      "status" = 'PENDING'
      AND "openClaimKey" IS NOT NULL
      AND "submittedAt" IS NULL
      AND "reviewedAt" IS NULL
      AND "privacyNoticeVersion" IS NULL
      AND "rejectionReason" IS NULL
      AND "resolvedPersonId" IS NULL
      AND "resolvedChannelIdentityId" IS NULL
      AND "resolvedWorkerId" IS NULL
    )
    OR
    (
      "status" = 'SUBMITTED'
      AND "openClaimKey" IS NOT NULL
      AND "submittedAt" IS NOT NULL
      AND "reviewedAt" IS NULL
      AND "privacyNoticeVersion" IS NOT NULL
      AND "rejectionReason" IS NULL
      AND "resolvedPersonId" IS NULL
      AND "resolvedChannelIdentityId" IS NULL
      AND "resolvedWorkerId" IS NULL
    )
    OR
    (
      "status" = 'APPROVED'
      AND "openClaimKey" IS NULL
      AND "submittedAt" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "privacyNoticeVersion" IS NOT NULL
      AND "rejectionReason" IS NULL
      AND "resolvedPersonId" IS NOT NULL
      AND "resolvedChannelIdentityId" IS NOT NULL
      AND "resolvedWorkerId" IS NOT NULL
    )
    OR
    (
      "status" = 'REJECTED'
      AND "openClaimKey" IS NULL
      AND "submittedAt" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "privacyNoticeVersion" IS NOT NULL
      AND "rejectionReason" IS NOT NULL
      AND "resolvedPersonId" IS NULL
      AND "resolvedChannelIdentityId" IS NULL
      AND "resolvedWorkerId" IS NULL
    )
    OR
    (
      "status" IN ('EXPIRED', 'CANCELLED')
      AND "openClaimKey" IS NULL
      AND "reviewedAt" IS NULL
      AND "rejectionReason" IS NULL
      AND "resolvedPersonId" IS NULL
      AND "resolvedChannelIdentityId" IS NULL
      AND "resolvedWorkerId" IS NULL
      AND (
        ("submittedAt" IS NULL AND "privacyNoticeVersion" IS NULL)
        OR
        ("submittedAt" IS NOT NULL AND "privacyNoticeVersion" IS NOT NULL)
      )
    )
  ) NOT VALID;

ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerOnboardingClaim_sender_check";
ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerOnboardingClaim_identity_bundle_check";
ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerClaim_privacy_notice_evidence_check";
ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerClaim_sensitive_retention_check";
ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerOnboardingClaim_state_check";

-- Supports bounded SKIP LOCKED retention batches without indexing terminal
-- tombstones or scanning all historical decision evidence.
CREATE INDEX "WorkerClaim_sensitive_retention_due_idx"
ON "WorkerOnboardingClaim"("expiresAt", "id")
WHERE "status" IN ('PENDING', 'SUBMITTED')
  AND "sensitiveDataPurgedAt" IS NULL;
