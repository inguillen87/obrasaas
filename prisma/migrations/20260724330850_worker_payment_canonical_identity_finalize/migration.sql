-- Phase 2 (online finalize): intentionally no explicit transaction. Backfill
-- and validation avoid ACCESS EXCLUSIVE. Every preflight fails closed without
-- deleting or merging data. The concurrent index build is isolated in the next
-- migration, following the repository's PostgreSQL/Prisma rollout convention.

-- Check source-derived identities before changing any legacy row. This detects
-- a direct destination and one or more resolved aliases that identify the same
-- account within the same fingerprint-key epoch.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "WorkerPaymentDestination"
    WHERE
      "type" IN ('CBU', 'CVU')
      OR (
        "type" = 'ALIAS'
        AND "resolvedType" IN ('CBU', 'CVU')
        AND "resolvedFingerprint" IS NOT NULL
        AND "resolvedFingerprintKeyId" IS NOT NULL
      )
    GROUP BY
      "organizationId",
      "personId",
      "purpose",
      CASE WHEN "type" IN ('CBU', 'CVU') THEN "type" ELSE "resolvedType" END,
      CASE WHEN "type" IN ('CBU', 'CVU') THEN "fingerprintKeyId" ELSE "resolvedFingerprintKeyId" END,
      CASE WHEN "type" IN ('CBU', 'CVU') THEN "fingerprint" ELSE "resolvedFingerprint" END
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Duplicate canonical worker payment destinations require governed remediation before rollout';
  END IF;
END;
$$;

-- Do not silently grandfather VERIFIED identities that lack a provider subject.
-- Empty/new installations pass; any incompatible legacy row blocks finalization
-- until it is audited and backfilled through the governed identity workflow.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "WorkerChannelIdentity"
    WHERE
      "status" = 'VERIFIED'
      AND (
        "encryptedProviderSubjectPayload" IS NULL
        OR "providerSubjectFingerprint" IS NULL
        OR "providerSubjectFingerprintKeyId" IS NULL
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'VERIFIED worker channel identities require provider-subject audit and backfill before rollout';
  END IF;
END;
$$;

-- The phase-1 trigger protects concurrent old writers. IS DISTINCT FROM avoids
-- rewriting rows that are already canonical.
UPDATE "WorkerPaymentDestination"
SET
  "canonicalType" = "type",
  "canonicalFingerprint" = "fingerprint",
  "canonicalFingerprintKeyId" = "fingerprintKeyId"
WHERE
  "type" IN ('CBU', 'CVU')
  AND (
    "canonicalType" IS DISTINCT FROM "type"
    OR "canonicalFingerprint" IS DISTINCT FROM "fingerprint"
    OR "canonicalFingerprintKeyId" IS DISTINCT FROM "fingerprintKeyId"
  );

UPDATE "WorkerPaymentDestination"
SET
  "canonicalType" = "resolvedType",
  "canonicalFingerprint" = "resolvedFingerprint",
  "canonicalFingerprintKeyId" = "resolvedFingerprintKeyId"
WHERE
  "type" = 'ALIAS'
  AND "resolvedType" IN ('CBU', 'CVU')
  AND "resolvedFingerprint" IS NOT NULL
  AND "resolvedFingerprintKeyId" IS NOT NULL
  AND (
    "canonicalType" IS DISTINCT FROM "resolvedType"
    OR "canonicalFingerprint" IS DISTINCT FROM "resolvedFingerprint"
    OR "canonicalFingerprintKeyId" IS DISTINCT FROM "resolvedFingerprintKeyId"
  );

-- Phase 1 enforces these guards on all new/changed rows. The backfill makes the
-- legacy population compatible, so validations use lighter-weight table locks.
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_canonical_bundle_check";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_canonical_source_check";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_canonical_state_check";
ALTER TABLE "WorkerChannelIdentity"
  VALIDATE CONSTRAINT "WorkerChannelIdentity_verified_provider_subject_check";
