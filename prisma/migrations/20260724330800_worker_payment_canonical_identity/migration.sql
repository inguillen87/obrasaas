-- Phase 1 (short expand): install nullable canonical identity, its derivation
-- trigger, and NOT VALID guards. PostgreSQL enforces NOT VALID checks for every
-- new or changed row without scanning existing data in this lock-sensitive phase.
BEGIN;

ALTER TABLE "WorkerPaymentDestination"
  ADD COLUMN "canonicalType" "WorkerPaymentDestinationType",
  ADD COLUMN "canonicalFingerprint" CHAR(64),
  ADD COLUMN "canonicalFingerprintKeyId" VARCHAR(100);

COMMENT ON COLUMN "WorkerPaymentDestination"."canonicalType" IS
  'Database-derived account type used to deduplicate direct and alias destinations; nullable only for unresolved aliases.';
COMMENT ON COLUMN "WorkerPaymentDestination"."canonicalFingerprint" IS
  'Tenant-keyed fingerprint of the resolved CBU/CVU; never a plaintext account identifier.';
COMMENT ON COLUMN "WorkerPaymentDestination"."canonicalFingerprintKeyId" IS
  'Fingerprint-key epoch paired with canonicalFingerprint; cross-key deduplication remains a service responsibility.';

-- Keeping derivation in the database makes the expand compatible with older
-- application instances while newer dual-write/read code is rolled out.
CREATE FUNCTION "worker_payment_sync_canonical_identity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."type" IN ('CBU', 'CVU') THEN
    NEW."canonicalType" := NEW."type";
    NEW."canonicalFingerprint" := NEW."fingerprint";
    NEW."canonicalFingerprintKeyId" := NEW."fingerprintKeyId";
  ELSIF NEW."type" = 'ALIAS' AND NEW."resolvedType" IN ('CBU', 'CVU') THEN
    NEW."canonicalType" := NEW."resolvedType";
    NEW."canonicalFingerprint" := NEW."resolvedFingerprint";
    NEW."canonicalFingerprintKeyId" := NEW."resolvedFingerprintKeyId";
  ELSE
    NEW."canonicalType" := NULL;
    NEW."canonicalFingerprint" := NULL;
    NEW."canonicalFingerprintKeyId" := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "worker_payment_sync_canonical_identity"() IS
  'Keeps canonical payment identity synchronized during rollout and future fingerprint-key rotations.';

CREATE TRIGGER "WorkerPayment_sync_canonical_identity"
BEFORE INSERT OR UPDATE ON "WorkerPaymentDestination"
FOR EACH ROW
EXECUTE FUNCTION "worker_payment_sync_canonical_identity"();

ALTER TABLE "WorkerPaymentDestination"
  ADD CONSTRAINT "WorkerPayment_canonical_bundle_check" CHECK (
    (
      "canonicalType" IS NULL
      AND "canonicalFingerprint" IS NULL
      AND "canonicalFingerprintKeyId" IS NULL
    )
    OR
    (
      "canonicalType" IS NOT NULL
      AND "canonicalType" IN ('CBU', 'CVU')
      AND "canonicalFingerprint" IS NOT NULL
      AND "canonicalFingerprint" ~ '^[0-9a-f]{64}$'
      AND "canonicalFingerprintKeyId" IS NOT NULL
      AND "canonicalFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerPayment_canonical_source_check" CHECK (
    (
      "type" IN ('CBU', 'CVU')
      AND "canonicalType" IS NOT NULL
      AND "canonicalFingerprint" IS NOT NULL
      AND "canonicalFingerprintKeyId" IS NOT NULL
      AND "canonicalType" = "type"
      AND "canonicalFingerprint" = "fingerprint"
      AND "canonicalFingerprintKeyId" = "fingerprintKeyId"
    )
    OR
    (
      "type" = 'ALIAS'
      AND (
        (
          "resolvedType" IS NULL
          AND "resolvedFingerprint" IS NULL
          AND "resolvedFingerprintKeyId" IS NULL
          AND "canonicalType" IS NULL
          AND "canonicalFingerprint" IS NULL
          AND "canonicalFingerprintKeyId" IS NULL
        )
        OR
        (
          "resolvedType" IN ('CBU', 'CVU')
          AND "resolvedFingerprint" IS NOT NULL
          AND "resolvedFingerprintKeyId" IS NOT NULL
          AND "canonicalType" IS NOT NULL
          AND "canonicalFingerprint" IS NOT NULL
          AND "canonicalFingerprintKeyId" IS NOT NULL
          AND "canonicalType" = "resolvedType"
          AND "canonicalFingerprint" = "resolvedFingerprint"
          AND "canonicalFingerprintKeyId" = "resolvedFingerprintKeyId"
        )
      )
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerPayment_canonical_state_check" CHECK (
    "status" NOT IN ('VERIFIED', 'ACTIVE', 'SUPERSEDED')
    OR (
      "canonicalType" IS NOT NULL
      AND "canonicalFingerprint" IS NOT NULL
      AND "canonicalFingerprintKeyId" IS NOT NULL
    )
  ) NOT VALID;

-- Install this guard without a legacy scan. Phase 2 preflights and validates it;
-- a pre-existing invalid VERIFIED row makes finalization fail closed.
ALTER TABLE "WorkerChannelIdentity"
  ADD CONSTRAINT "WorkerChannelIdentity_verified_provider_subject_check" CHECK (
    "status" <> 'VERIFIED'
    OR (
      "encryptedProviderSubjectPayload" IS NOT NULL
      AND "providerSubjectFingerprint" IS NOT NULL
      AND "providerSubjectFingerprintKeyId" IS NOT NULL
    )
  ) NOT VALID;

COMMENT ON CONSTRAINT "WorkerChannelIdentity_verified_provider_subject_check"
  ON "WorkerChannelIdentity" IS
  'Installed NOT VALID during expand; phase 2 requires a clean legacy preflight before validation.';

COMMIT;
