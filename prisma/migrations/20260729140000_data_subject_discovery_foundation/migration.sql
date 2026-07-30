-- PRO-05A creates a tenant-scoped, discovery-only privacy ledger. It does not
-- authorize or execute deletion. Requests, sealed manifests and their items
-- are retained as append-only, privacy-minimal evidence.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TYPE "DataSubjectKind" AS ENUM ('TENANT_MEMBER', 'WORKER_PERSON');
CREATE TYPE "DataSubjectRequestType" AS ENUM (
  'ACCESS',
  'CORRECTION',
  'ERASURE',
  'RESTRICTION',
  'PORTABILITY',
  'OBJECTION'
);
CREATE TYPE "DataSubjectRequestStatus" AS ENUM (
  'RECEIVED',
  'AUTHORITY_ATTESTED',
  'DISCOVERING',
  'DISCOVERED',
  'DISCOVERY_BLOCKED',
  'DISCOVERY_FAILED',
  'REJECTED',
  'CANCELLED'
);
CREATE TYPE "DataSubjectManifestOutcome" AS ENUM ('COMPLETE', 'BLOCKED');
CREATE TYPE "DataSubjectDiscoveryItemKind" AS ENUM ('RECORD', 'COVERAGE_BLOCKER');
CREATE TYPE "DataSubjectDataCategory" AS ENUM (
  'PERSONAL',
  'LABOR',
  'FINANCIAL',
  'CONVERSATION',
  'MEDIA',
  'AI_DERIVED',
  'AUDIT'
);
CREATE TYPE "DataSubjectDisposition" AS ENUM (
  'REVIEW_REQUIRED',
  'ERASE_CANDIDATE',
  'CRYPTO_ERASE_CANDIDATE',
  'PSEUDONYMIZE_CANDIDATE',
  'KEEP_MINIMAL',
  'EXTERNAL_DELETE_CANDIDATE'
);

CREATE TABLE "DataSubjectRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "DataSubjectRequestType" NOT NULL,
  "subjectKind" "DataSubjectKind" NOT NULL,
  "subjectMembershipId" TEXT,
  "workerPersonId" TEXT,
  "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "receivedByMembershipId" TEXT NOT NULL,
  "attestedByMembershipId" TEXT,
  "completedByMembershipId" TEXT,
  "attestationPolicyVersion" VARCHAR(64),
  "attestationMethod" VARCHAR(64),
  "attestationEvidenceSha256" CHAR(64),
  "discoveryCatalogVersion" VARCHAR(64),
  "discoveryCatalogSha256" CHAR(64),
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attestedAt" TIMESTAMPTZ(3),
  "discoveryStartedAt" TIMESTAMPTZ(3),
  "terminalAt" TIMESTAMPTZ(3),
  "terminalReasonCode" VARCHAR(64),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectRequest_exact_subject_check" CHECK (
    (
      "subjectKind" = 'TENANT_MEMBER'
      AND "subjectMembershipId" IS NOT NULL
      AND "workerPersonId" IS NULL
    )
    OR
    (
      "subjectKind" = 'WORKER_PERSON'
      AND "subjectMembershipId" IS NULL
      AND "workerPersonId" IS NOT NULL
    )
  ),
  CONSTRAINT "DataSubjectRequest_schema_revision_check" CHECK (
    "schemaVersion" = 1 AND "revision" >= 0
  ),
  CONSTRAINT "DataSubjectRequest_operation_hash_check" CHECK (
    "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectRequest_fingerprint_check" CHECK (
    "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectRequest_attestation_hash_check" CHECK (
    "attestationEvidenceSha256" IS NULL
    OR "attestationEvidenceSha256"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectRequest_catalog_hash_check" CHECK (
    "discoveryCatalogSha256" IS NULL
    OR "discoveryCatalogSha256"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectRequest_catalog_v1_pin_check" CHECK (
    (
      "discoveryCatalogVersion" IS NULL
      AND "discoveryCatalogSha256" IS NULL
    )
    OR
    (
      "discoveryCatalogVersion" = 'privacy-discovery-catalog-v1'
      AND "discoveryCatalogSha256"::TEXT = 'e5809bceb805a09c0bc2735cf44a39b7ca1d2b1794a5bd2dadc2ca6b12d6e6b4'
    )
  )
);

CREATE TABLE "DataSubjectDiscoveryManifest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "outcome" "DataSubjectManifestOutcome" NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "catalogVersion" VARCHAR(64) NOT NULL,
  "catalogSha256" CHAR(64) NOT NULL,
  "sourceSnapshotAt" TIMESTAMPTZ(3) NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "blockerCount" INTEGER NOT NULL,
  "manifestSha256" CHAR(64) NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "sealedByMembershipId" TEXT NOT NULL,
  "sealedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectDiscoveryManifest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectDiscoveryManifest_shape_check" CHECK (
    "schemaVersion" = 1
    AND "itemCount" >= 1
    AND "itemCount" <= 1024
    AND "blockerCount" >= 0
    AND "blockerCount" <= "itemCount"
    AND (
      ("outcome" = 'COMPLETE' AND "blockerCount" = 0)
      OR ("outcome" = 'BLOCKED' AND "blockerCount" > 0)
    )
  ),
  CONSTRAINT "DataSubjectDiscoveryManifest_hashes_check" CHECK (
    "catalogSha256"::TEXT ~ '^[a-f0-9]{64}$'
    AND "manifestSha256"::TEXT ~ '^[a-f0-9]{64}$'
    AND "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectDiscoveryManifest_codes_check" CHECK (
    "catalogVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
  ),
  CONSTRAINT "DataSubjectDiscoveryManifest_catalog_v1_pin_check" CHECK (
    "catalogVersion" = 'privacy-discovery-catalog-v1'
    AND "catalogSha256"::TEXT = 'e5809bceb805a09c0bc2735cf44a39b7ca1d2b1794a5bd2dadc2ca6b12d6e6b4'
    AND "outcome" = 'BLOCKED'
  )
);

CREATE TABLE "DataSubjectDiscoveryItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "manifestId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "kind" "DataSubjectDiscoveryItemKind" NOT NULL,
  "category" "DataSubjectDataCategory" NOT NULL,
  "sourceSystem" VARCHAR(64) NOT NULL,
  "resourceType" VARCHAR(120) NOT NULL,
  "fieldSetCode" VARCHAR(64) NOT NULL,
  "fingerprintKeyId" VARCHAR(100),
  "locatorFingerprintHmac" CHAR(64),
  "recordFingerprintHmac" CHAR(64),
  "disposition" "DataSubjectDisposition" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "retentionPolicyVersion" VARCHAR(64),
  "retentionBasisCode" VARCHAR(64),
  "retentionUntil" TIMESTAMPTZ(3),
  "blockerCode" VARCHAR(64),
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectDiscoveryItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectDiscoveryItem_ordinal_check" CHECK (
    "ordinal" BETWEEN 0 AND 1023
  ),
  CONSTRAINT "DataSubjectDiscoveryItem_codes_check" CHECK (
    "sourceSystem" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "resourceType" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'
    AND "fieldSetCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND (
      "fingerprintKeyId" IS NULL
      OR "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    )
    AND (
      "retentionPolicyVersion" IS NULL
      OR "retentionPolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    )
    AND (
      "retentionBasisCode" IS NULL
      OR "retentionBasisCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    )
    AND (
      "blockerCode" IS NULL
      OR "blockerCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    )
  ),
  CONSTRAINT "DataSubjectDiscoveryItem_hmac_check" CHECK (
    ("locatorFingerprintHmac" IS NULL OR "locatorFingerprintHmac"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("recordFingerprintHmac" IS NULL OR "recordFingerprintHmac"::TEXT ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "DataSubjectDiscoveryItem_kind_check" CHECK (
    (
      "kind" = 'RECORD'
      AND "sourceSystem" = 'postgresql'
      AND num_nonnulls(
        "fingerprintKeyId",
        "locatorFingerprintHmac",
        "recordFingerprintHmac"
      ) = 3
    )
    OR
    (
      "kind" = 'COVERAGE_BLOCKER'
      AND "sourceSystem" = 'control-plane'
      AND num_nonnulls(
        "fingerprintKeyId",
        "locatorFingerprintHmac",
        "recordFingerprintHmac"
      ) = 0
      AND "disposition" = 'REVIEW_REQUIRED'
      AND "blockerCode" IS NOT NULL
    )
  ),
  CONSTRAINT "DataSubjectDiscoveryItem_disposition_check" CHECK (
    (
      "disposition" = 'REVIEW_REQUIRED'
      AND "blockerCode" IS NOT NULL
      AND "retentionPolicyVersion" IS NULL
      AND "retentionBasisCode" IS NULL
      AND "retentionUntil" IS NULL
    )
    OR
    (
      "disposition" <> 'REVIEW_REQUIRED'
      AND "blockerCode" IS NULL
      AND "retentionPolicyVersion" IS NOT NULL
      AND "retentionBasisCode" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "DataSubjectRequest_org_id_key"
  ON "DataSubjectRequest"("organizationId", "id");
CREATE UNIQUE INDEX "DataSubjectRequest_org_operation_key"
  ON "DataSubjectRequest"("organizationId", "operationKeyHash");
CREATE INDEX "DataSubjectRequest_org_received_idx"
  ON "DataSubjectRequest"("organizationId", "receivedAt");
CREATE INDEX "DataSubjectRequest_org_status_received_idx"
  ON "DataSubjectRequest"("organizationId", "status", "receivedAt");
CREATE INDEX "DataSubjectRequest_org_actor_received_idx"
  ON "DataSubjectRequest"("organizationId", "receivedByMembershipId", "receivedAt");
CREATE INDEX "DataSubjectRequest_org_member_received_idx"
  ON "DataSubjectRequest"("organizationId", "subjectMembershipId", "receivedAt");
CREATE INDEX "DataSubjectRequest_org_worker_received_idx"
  ON "DataSubjectRequest"("organizationId", "workerPersonId", "receivedAt");

CREATE UNIQUE INDEX "DataSubjectDiscoveryManifest_org_id_key"
  ON "DataSubjectDiscoveryManifest"("organizationId", "id");
CREATE UNIQUE INDEX "DataSubjectDiscoveryManifest_org_request_key"
  ON "DataSubjectDiscoveryManifest"("organizationId", "requestId");
CREATE UNIQUE INDEX "DataSubjectDiscoveryManifest_scope_key"
  ON "DataSubjectDiscoveryManifest"("organizationId", "requestId", "id");
CREATE UNIQUE INDEX "DataSubjectDiscoveryManifest_org_operation_key"
  ON "DataSubjectDiscoveryManifest"("organizationId", "operationKeyHash");
CREATE INDEX "DataSubjectDiscoveryManifest_org_outcome_sealed_idx"
  ON "DataSubjectDiscoveryManifest"("organizationId", "outcome", "sealedAt");

CREATE UNIQUE INDEX "DataSubjectDiscoveryItem_org_manifest_ordinal_key"
  ON "DataSubjectDiscoveryItem"("organizationId", "manifestId", "ordinal");
CREATE UNIQUE INDEX "DataSubjectDiscoveryItem_org_manifest_blocker_key"
  ON "DataSubjectDiscoveryItem"(
    "organizationId",
    "manifestId",
    "resourceType",
    "blockerCode"
  )
  WHERE "kind" = 'COVERAGE_BLOCKER';
CREATE INDEX "DataSubjectDiscoveryItem_org_request_category_idx"
  ON "DataSubjectDiscoveryItem"("organizationId", "requestId", "category");
CREATE INDEX "DataSubjectDiscoveryItem_org_disposition_blocker_idx"
  ON "DataSubjectDiscoveryItem"("organizationId", "disposition", "blockerCode");

ALTER TABLE "DataSubjectRequest"
  ADD CONSTRAINT "DataSubjectRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectRequest_subject_membership_fkey"
  FOREIGN KEY ("organizationId", "subjectMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectRequest_worker_person_fkey"
  FOREIGN KEY ("organizationId", "workerPersonId")
  REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectRequest_received_by_fkey"
  FOREIGN KEY ("organizationId", "receivedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectRequest_attested_by_fkey"
  FOREIGN KEY ("organizationId", "attestedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectRequest_completed_by_fkey"
  FOREIGN KEY ("organizationId", "completedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DataSubjectDiscoveryManifest"
  ADD CONSTRAINT "DataSubjectDiscoveryManifest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectDiscoveryManifest_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectDiscoveryManifest_sealed_by_fkey"
  FOREIGN KEY ("organizationId", "sealedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DataSubjectDiscoveryItem"
  ADD CONSTRAINT "DataSubjectDiscoveryItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectDiscoveryItem_manifest_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId")
  REFERENCES "DataSubjectDiscoveryManifest"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION "obrasaas_data_subject_request_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3);
  actor_valid BOOLEAN;
BEGIN
  observed_at := statement_timestamp();

  IF NEW."status"::TEXT <> 'RECEIVED'
    OR NEW."schemaVersion" <> 1
    OR NEW."revision" <> 0
    OR NEW."attestedByMembershipId" IS NOT NULL
    OR NEW."completedByMembershipId" IS NOT NULL
    OR NEW."attestationPolicyVersion" IS NOT NULL
    OR NEW."attestationMethod" IS NOT NULL
    OR NEW."attestationEvidenceSha256" IS NOT NULL
    OR NEW."discoveryCatalogVersion" IS NOT NULL
    OR NEW."discoveryCatalogSha256" IS NOT NULL
    OR NEW."attestedAt" IS NOT NULL
    OR NEW."discoveryStartedAt" IS NOT NULL
    OR NEW."terminalAt" IS NOT NULL
    OR NEW."terminalReasonCode" IS NOT NULL
  THEN
    RAISE EXCEPTION 'data subject request must start in the empty RECEIVED state'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."TenantMembership"
        WHERE "organizationId" = $1
          AND "id" = $2
          AND "status" = ''ACTIVE''
          AND "tenantRole" = ''ADMIN''
     )',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."receivedByMembershipId";

  IF NOT actor_valid THEN
    RAISE EXCEPTION 'data subject request requires one active tenant administrator'
      USING ERRCODE = '42501';
  END IF;

  NEW."receivedAt" := observed_at;
  NEW."createdAt" := observed_at;
  NEW."updatedAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectRequest_insert_guard"
BEFORE INSERT ON "DataSubjectRequest"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_request_insert_guard"();

CREATE FUNCTION "obrasaas_data_subject_request_lifecycle_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3);
  actor_valid BOOLEAN;
  manifest_outcome TEXT;
BEGIN
  observed_at := statement_timestamp();

  IF OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."type" IS DISTINCT FROM NEW."type"
    OR OLD."subjectKind" IS DISTINCT FROM NEW."subjectKind"
    OR OLD."subjectMembershipId" IS DISTINCT FROM NEW."subjectMembershipId"
    OR OLD."workerPersonId" IS DISTINCT FROM NEW."workerPersonId"
    OR OLD."schemaVersion" IS DISTINCT FROM NEW."schemaVersion"
    OR OLD."operationKeyHash" IS DISTINCT FROM NEW."operationKeyHash"
    OR OLD."requestFingerprint" IS DISTINCT FROM NEW."requestFingerprint"
    OR OLD."receivedByMembershipId" IS DISTINCT FROM NEW."receivedByMembershipId"
    OR OLD."receivedAt" IS DISTINCT FROM NEW."receivedAt"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
    OR NEW."revision" <> OLD."revision" + 1
  THEN
    RAISE EXCEPTION 'data subject request immutable fields or revision changed'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."status"::TEXT = 'RECEIVED' AND NEW."status"::TEXT = 'AUTHORITY_ATTESTED' THEN
    IF NEW."attestedByMembershipId" IS NULL
      OR NEW."attestationPolicyVersion" IS NULL
      OR NEW."attestationPolicyVersion" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      OR NEW."attestationMethod" IS NULL
      OR NEW."attestationMethod" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      OR NEW."attestationEvidenceSha256" IS NULL
      OR NEW."discoveryCatalogVersion" IS NULL
      OR NEW."discoveryCatalogVersion" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      OR NEW."discoveryCatalogSha256" IS NULL
      OR NEW."completedByMembershipId" IS NOT NULL
      OR NEW."discoveryStartedAt" IS NOT NULL
      OR NEW."terminalAt" IS NOT NULL
      OR NEW."terminalReasonCode" IS NOT NULL
    THEN
      RAISE EXCEPTION 'data subject request authority attestation is incomplete'
        USING ERRCODE = '55000';
    END IF;

    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."TenantMembership"
          WHERE "organizationId" = $1 AND "id" = $2
            AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
       )',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."attestedByMembershipId";
    IF NOT actor_valid THEN
      RAISE EXCEPTION 'data subject attestation requires one active tenant administrator'
        USING ERRCODE = '42501';
    END IF;
    NEW."attestedAt" := observed_at;

  ELSIF OLD."status"::TEXT = 'AUTHORITY_ATTESTED' AND NEW."status"::TEXT = 'DISCOVERING' THEN
    IF NEW."attestedByMembershipId" IS DISTINCT FROM OLD."attestedByMembershipId"
      OR NEW."attestationPolicyVersion" IS DISTINCT FROM OLD."attestationPolicyVersion"
      OR NEW."attestationMethod" IS DISTINCT FROM OLD."attestationMethod"
      OR NEW."attestationEvidenceSha256" IS DISTINCT FROM OLD."attestationEvidenceSha256"
      OR NEW."discoveryCatalogVersion" IS DISTINCT FROM OLD."discoveryCatalogVersion"
      OR NEW."discoveryCatalogSha256" IS DISTINCT FROM OLD."discoveryCatalogSha256"
      OR NEW."attestedAt" IS DISTINCT FROM OLD."attestedAt"
      OR NEW."completedByMembershipId" IS NOT NULL
      OR NEW."terminalAt" IS NOT NULL
      OR NEW."terminalReasonCode" IS NOT NULL
    THEN
      RAISE EXCEPTION 'data subject discovery start changed attested authority evidence'
        USING ERRCODE = '55000';
    END IF;
    NEW."discoveryStartedAt" := observed_at;

  ELSIF OLD."status"::TEXT = 'DISCOVERING'
    AND NEW."status"::TEXT IN ('DISCOVERED', 'DISCOVERY_BLOCKED')
  THEN
    IF NEW."attestedByMembershipId" IS DISTINCT FROM OLD."attestedByMembershipId"
      OR NEW."attestationPolicyVersion" IS DISTINCT FROM OLD."attestationPolicyVersion"
      OR NEW."attestationMethod" IS DISTINCT FROM OLD."attestationMethod"
      OR NEW."attestationEvidenceSha256" IS DISTINCT FROM OLD."attestationEvidenceSha256"
      OR NEW."discoveryCatalogVersion" IS DISTINCT FROM OLD."discoveryCatalogVersion"
      OR NEW."discoveryCatalogSha256" IS DISTINCT FROM OLD."discoveryCatalogSha256"
      OR NEW."attestedAt" IS DISTINCT FROM OLD."attestedAt"
      OR NEW."discoveryStartedAt" IS DISTINCT FROM OLD."discoveryStartedAt"
      OR NEW."completedByMembershipId" IS NULL
      OR NEW."terminalReasonCode" IS NOT NULL
    THEN
      RAISE EXCEPTION 'data subject discovery terminal evidence is invalid'
        USING ERRCODE = '55000';
    END IF;

    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."TenantMembership"
          WHERE "organizationId" = $1 AND "id" = $2
            AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
       )',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."completedByMembershipId";
    IF NOT actor_valid THEN
      RAISE EXCEPTION 'data subject discovery completion requires one active tenant administrator'
        USING ERRCODE = '42501';
    END IF;

    EXECUTE format(
      'SELECT "outcome"::TEXT
         FROM %I."DataSubjectDiscoveryManifest"
        WHERE "organizationId" = $1 AND "requestId" = $2',
      TG_TABLE_SCHEMA
    ) INTO manifest_outcome
    USING NEW."organizationId", NEW."id";
    IF manifest_outcome IS NULL
      OR (NEW."status"::TEXT = 'DISCOVERED' AND manifest_outcome <> 'COMPLETE')
      OR (NEW."status"::TEXT = 'DISCOVERY_BLOCKED' AND manifest_outcome <> 'BLOCKED')
    THEN
      RAISE EXCEPTION 'data subject request terminal state does not match its manifest'
        USING ERRCODE = '55000';
    END IF;
    NEW."terminalAt" := observed_at;

  ELSIF OLD."status"::TEXT = 'DISCOVERING'
    AND NEW."status"::TEXT = 'DISCOVERY_FAILED'
  THEN
    IF NEW."attestedByMembershipId" IS DISTINCT FROM OLD."attestedByMembershipId"
      OR NEW."attestationPolicyVersion" IS DISTINCT FROM OLD."attestationPolicyVersion"
      OR NEW."attestationMethod" IS DISTINCT FROM OLD."attestationMethod"
      OR NEW."attestationEvidenceSha256" IS DISTINCT FROM OLD."attestationEvidenceSha256"
      OR NEW."discoveryCatalogVersion" IS DISTINCT FROM OLD."discoveryCatalogVersion"
      OR NEW."discoveryCatalogSha256" IS DISTINCT FROM OLD."discoveryCatalogSha256"
      OR NEW."attestedAt" IS DISTINCT FROM OLD."attestedAt"
      OR NEW."discoveryStartedAt" IS DISTINCT FROM OLD."discoveryStartedAt"
      OR NEW."completedByMembershipId" IS NULL
      OR NEW."terminalReasonCode" IS NULL
      OR NEW."terminalReasonCode" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    THEN
      RAISE EXCEPTION 'data subject discovery failure evidence is invalid'
        USING ERRCODE = '55000';
    END IF;
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."TenantMembership"
          WHERE "organizationId" = $1 AND "id" = $2
            AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
       )',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."completedByMembershipId";
    IF NOT actor_valid THEN
      RAISE EXCEPTION 'data subject discovery failure requires one active tenant administrator'
        USING ERRCODE = '42501';
    END IF;
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."DataSubjectDiscoveryManifest"
          WHERE "organizationId" = $1 AND "requestId" = $2
       )',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."id";
    IF actor_valid THEN
      RAISE EXCEPTION 'failed discovery cannot retain a sealed manifest'
        USING ERRCODE = '55000';
    END IF;
    NEW."terminalAt" := observed_at;

  ELSIF OLD."status"::TEXT IN ('RECEIVED', 'AUTHORITY_ATTESTED')
    AND NEW."status"::TEXT IN ('REJECTED', 'CANCELLED')
  THEN
    IF NEW."attestedByMembershipId" IS DISTINCT FROM OLD."attestedByMembershipId"
      OR NEW."attestationPolicyVersion" IS DISTINCT FROM OLD."attestationPolicyVersion"
      OR NEW."attestationMethod" IS DISTINCT FROM OLD."attestationMethod"
      OR NEW."attestationEvidenceSha256" IS DISTINCT FROM OLD."attestationEvidenceSha256"
      OR NEW."discoveryCatalogVersion" IS DISTINCT FROM OLD."discoveryCatalogVersion"
      OR NEW."discoveryCatalogSha256" IS DISTINCT FROM OLD."discoveryCatalogSha256"
      OR NEW."attestedAt" IS DISTINCT FROM OLD."attestedAt"
      OR NEW."completedByMembershipId" IS NULL
      OR NEW."terminalReasonCode" IS NULL
      OR NEW."terminalReasonCode" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      OR NEW."discoveryStartedAt" IS NOT NULL
    THEN
      RAISE EXCEPTION 'data subject request close evidence is invalid'
        USING ERRCODE = '55000';
    END IF;
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."TenantMembership"
          WHERE "organizationId" = $1 AND "id" = $2
            AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
       )',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."completedByMembershipId";
    IF NOT actor_valid THEN
      RAISE EXCEPTION 'data subject request close requires one active tenant administrator'
        USING ERRCODE = '42501';
    END IF;
    NEW."terminalAt" := observed_at;

  ELSE
    RAISE EXCEPTION 'invalid data subject request lifecycle transition'
      USING ERRCODE = '55000';
  END IF;

  NEW."updatedAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectRequest_lifecycle_guard"
BEFORE UPDATE ON "DataSubjectRequest"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_request_lifecycle_guard"();

CREATE FUNCTION "obrasaas_data_subject_item_before_seal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3);
  request_status TEXT;
  root_exists BOOLEAN;
BEGIN
  observed_at := statement_timestamp();
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'data-subject-manifest:' || NEW."organizationId" || ':'
      || NEW."requestId" || ':' || NEW."manifestId",
    0
  ));

  EXECUTE format(
    'SELECT "status"::TEXT FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2 FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status
  USING NEW."organizationId", NEW."requestId";
  IF request_status IS DISTINCT FROM 'DISCOVERING' THEN
    RAISE EXCEPTION 'data subject discovery items require a DISCOVERING request'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."DataSubjectDiscoveryManifest"
        WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO root_exists
  USING NEW."organizationId", NEW."requestId", NEW."manifestId";
  IF root_exists THEN
    RAISE EXCEPTION 'data subject discovery manifest is already sealed'
      USING ERRCODE = '55000';
  END IF;
  NEW."createdAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectDiscoveryItem_before_seal"
BEFORE INSERT ON "DataSubjectDiscoveryItem"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_item_before_seal"();

CREATE FUNCTION "obrasaas_data_subject_manifest_seal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3);
  request_status TEXT;
  request_started_at TIMESTAMPTZ(3);
  request_catalog_version TEXT;
  request_catalog_sha256 TEXT;
  request_operation_key_hash TEXT;
  request_fingerprint TEXT;
  actor_valid BOOLEAN;
  actual_item_count INTEGER;
  actual_blocker_count INTEGER;
  actual_min_ordinal INTEGER;
  actual_max_ordinal INTEGER;
  actual_snapshot_mismatch_count INTEGER;
  actual_required_blocker_count INTEGER;
  item_commitment TEXT;
  snapshot_text TEXT;
  canonical_manifest TEXT;
  expected_manifest_sha256 TEXT;
BEGIN
  observed_at := statement_timestamp();
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'data-subject-manifest:' || NEW."organizationId" || ':'
      || NEW."requestId" || ':' || NEW."id",
    0
  ));

  EXECUTE format(
    'SELECT "status"::TEXT, "discoveryStartedAt", "discoveryCatalogVersion",
            "discoveryCatalogSha256"::TEXT, "operationKeyHash"::TEXT,
            "requestFingerprint"::TEXT
       FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status, request_started_at, request_catalog_version,
         request_catalog_sha256, request_operation_key_hash,
         request_fingerprint
  USING NEW."organizationId", NEW."requestId";

  IF request_status IS DISTINCT FROM 'DISCOVERING'
    OR request_started_at IS NULL
    OR NEW."catalogVersion" IS DISTINCT FROM request_catalog_version
    OR NEW."catalogSha256"::TEXT IS DISTINCT FROM request_catalog_sha256
    OR NEW."operationKeyHash"::TEXT IS DISTINCT FROM request_operation_key_hash
    OR NEW."requestFingerprint"::TEXT IS DISTINCT FROM request_fingerprint
  THEN
    RAISE EXCEPTION 'data subject discovery manifest does not match its active request'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."TenantMembership"
        WHERE "organizationId" = $1 AND "id" = $2
          AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
     )',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."sealedByMembershipId";
  IF NOT actor_valid THEN
    RAISE EXCEPTION 'data subject discovery seal requires one active tenant administrator'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."sourceSnapshotAt" < request_started_at
    OR NEW."sourceSnapshotAt" > observed_at + INTERVAL '5 seconds'
  THEN
    RAISE EXCEPTION 'data subject discovery snapshot clock is invalid'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    'SELECT count(*)::INTEGER,
            count(*) FILTER (
              WHERE "blockerCode" IS NOT NULL
                 OR "disposition" = ''REVIEW_REQUIRED''
            )::INTEGER,
            min("ordinal")::INTEGER,
            max("ordinal")::INTEGER,
            count(*) FILTER (
              WHERE "observedAt" IS DISTINCT FROM $4
            )::INTEGER,
            count(*) FILTER (
              WHERE "kind" = ''COVERAGE_BLOCKER''
                AND ("resourceType", "blockerCode") IN (
                  (''WorkerOperationalGraph'', ''WORKER_OPERATIONAL_GRAPH_PARTIAL''),
                  (''ConversationMessage'', ''CONVERSATION_SUBJECT_BINDING_MISSING''),
                  (''ClaimedMediaStorage'', ''CLAIMED_MEDIA_DELETE_ADAPTER_MISSING''),
                  (''AiDerivedProviderData'', ''AI_PROVIDER_RECEIPTS_MISSING''),
                  (''UntypedJsonAndAuditMetadata'', ''UNTYPED_SUBJECT_INDEX_MISSING''),
                  (''BackupRestoreReplay'', ''BACKUP_TOMBSTONE_REPLAY_MISSING''),
                  (''Worker'', ''WORKER_PROJECT_LINKS_PARTIAL''),
                  (''WorkerOnboardingClaim'', ''WORKER_ONBOARDING_CLAIMS_PARTIAL'')
                )
            )::INTEGER
       FROM %I."DataSubjectDiscoveryItem"
      WHERE "organizationId" = $1
        AND "requestId" = $2
        AND "manifestId" = $3',
    TG_TABLE_SCHEMA
  ) INTO actual_item_count, actual_blocker_count, actual_min_ordinal,
         actual_max_ordinal, actual_snapshot_mismatch_count,
         actual_required_blocker_count
  USING NEW."organizationId", NEW."requestId", NEW."id", NEW."sourceSnapshotAt";

  IF NEW."itemCount" <> actual_item_count
    OR NEW."blockerCount" <> actual_blocker_count
    OR actual_item_count < 1
    OR actual_min_ordinal <> 0
    OR actual_max_ordinal <> actual_item_count - 1
    OR actual_snapshot_mismatch_count <> 0
    OR actual_required_blocker_count <> 8
    OR (NEW."outcome"::TEXT = 'COMPLETE' AND actual_blocker_count <> 0)
    OR (NEW."outcome"::TEXT = 'BLOCKED' AND actual_blocker_count = 0)
  THEN
    RAISE EXCEPTION 'data subject discovery manifest counts or outcome are invalid'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    $sql$
      SELECT coalesce(string_agg(
        CASE WHEN "id" IS NULL THEN '-1:'
             ELSE octet_length("id")::TEXT || ':' || "id" END || '|'
        || octet_length("ordinal"::TEXT)::TEXT || ':' || "ordinal"::TEXT || '|'
        || octet_length("kind"::TEXT)::TEXT || ':' || "kind"::TEXT || '|'
        || octet_length("category"::TEXT)::TEXT || ':' || "category"::TEXT || '|'
        || octet_length("sourceSystem")::TEXT || ':' || "sourceSystem" || '|'
        || octet_length("resourceType")::TEXT || ':' || "resourceType" || '|'
        || octet_length("fieldSetCode")::TEXT || ':' || "fieldSetCode" || '|'
        || CASE WHEN "fingerprintKeyId" IS NULL THEN '-1:'
                ELSE octet_length("fingerprintKeyId")::TEXT || ':' || "fingerprintKeyId" END || '|'
        || CASE WHEN "locatorFingerprintHmac" IS NULL THEN '-1:'
                ELSE octet_length("locatorFingerprintHmac"::TEXT)::TEXT || ':'
                  || "locatorFingerprintHmac"::TEXT END || '|'
        || CASE WHEN "recordFingerprintHmac" IS NULL THEN '-1:'
                ELSE octet_length("recordFingerprintHmac"::TEXT)::TEXT || ':'
                  || "recordFingerprintHmac"::TEXT END || '|'
        || octet_length("disposition"::TEXT)::TEXT || ':' || "disposition"::TEXT || '|'
        || CASE WHEN "retentionPolicyVersion" IS NULL THEN '-1:'
                ELSE octet_length("retentionPolicyVersion")::TEXT || ':'
                  || "retentionPolicyVersion" END || '|'
        || CASE WHEN "retentionBasisCode" IS NULL THEN '-1:'
                ELSE octet_length("retentionBasisCode")::TEXT || ':'
                  || "retentionBasisCode" END || '|'
        || CASE WHEN "retentionUntil" IS NULL THEN '-1:'
                ELSE octet_length(to_char("retentionUntil" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::TEXT
                  || ':' || to_char("retentionUntil" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END || '|'
        || CASE WHEN "blockerCode" IS NULL THEN '-1:'
                ELSE octet_length("blockerCode")::TEXT || ':' || "blockerCode" END || '|'
        || octet_length(to_char("observedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::TEXT
          || ':' || to_char("observedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        '' ORDER BY "ordinal"
      ), '')
      FROM %I."DataSubjectDiscoveryItem"
      WHERE "organizationId" = $1
        AND "requestId" = $2
        AND "manifestId" = $3
    $sql$,
    TG_TABLE_SCHEMA
  ) INTO item_commitment
  USING NEW."organizationId", NEW."requestId", NEW."id";

  snapshot_text := to_char(
    NEW."sourceSnapshotAt" AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  NEW."sealedAt" := observed_at;
  canonical_manifest :=
      octet_length('obrasaas:data-subject-discovery-manifest:v1')::TEXT
        || ':obrasaas:data-subject-discovery-manifest:v1|'
    || octet_length(NEW."id")::TEXT || ':' || NEW."id" || '|'
    || octet_length(NEW."organizationId")::TEXT || ':' || NEW."organizationId" || '|'
    || octet_length(NEW."requestId")::TEXT || ':' || NEW."requestId" || '|'
    || octet_length(NEW."schemaVersion"::TEXT)::TEXT || ':' || NEW."schemaVersion"::TEXT || '|'
    || octet_length(NEW."catalogVersion")::TEXT || ':' || NEW."catalogVersion" || '|'
    || octet_length(NEW."catalogSha256"::TEXT)::TEXT || ':' || NEW."catalogSha256"::TEXT || '|'
    || octet_length(snapshot_text)::TEXT || ':' || snapshot_text || '|'
    || octet_length(NEW."outcome"::TEXT)::TEXT || ':' || NEW."outcome"::TEXT || '|'
    || octet_length(NEW."itemCount"::TEXT)::TEXT || ':' || NEW."itemCount"::TEXT || '|'
    || octet_length(NEW."blockerCount"::TEXT)::TEXT || ':' || NEW."blockerCount"::TEXT || '|'
    || octet_length(NEW."operationKeyHash"::TEXT)::TEXT || ':' || NEW."operationKeyHash"::TEXT || '|'
    || octet_length(NEW."requestFingerprint"::TEXT)::TEXT || ':' || NEW."requestFingerprint"::TEXT || '|'
    || octet_length(NEW."sealedByMembershipId")::TEXT || ':' || NEW."sealedByMembershipId" || '|'
    || octet_length(item_commitment)::TEXT || ':' || item_commitment;
  expected_manifest_sha256 := encode(
    sha256(convert_to(canonical_manifest, 'UTF8')),
    'hex'
  );

  IF NEW."manifestSha256"::TEXT IS DISTINCT FROM expected_manifest_sha256 THEN
    RAISE EXCEPTION 'data subject discovery manifest hash is invalid'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectDiscoveryManifest_seal"
BEFORE INSERT ON "DataSubjectDiscoveryManifest"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_manifest_seal"();

CREATE FUNCTION "obrasaas_data_subject_manifest_terminal_check"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  request_status TEXT;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2',
    TG_TABLE_SCHEMA
  ) INTO request_status
  USING NEW."organizationId", NEW."requestId";

  IF (NEW."outcome"::TEXT = 'COMPLETE' AND request_status <> 'DISCOVERED')
    OR (NEW."outcome"::TEXT = 'BLOCKED' AND request_status <> 'DISCOVERY_BLOCKED')
  THEN
    RAISE EXCEPTION 'sealed discovery manifest lacks its matching terminal request'
      USING ERRCODE = '55000';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "DataSubjectDiscoveryManifest_terminal_check"
AFTER INSERT ON "DataSubjectDiscoveryManifest"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_manifest_terminal_check"();

CREATE FUNCTION "obrasaas_data_subject_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% cannot be truncated', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "DataSubjectRequest_no_delete"
BEFORE DELETE ON "DataSubjectRequest"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_append_only"();
CREATE TRIGGER "DataSubjectRequest_no_truncate"
BEFORE TRUNCATE ON "DataSubjectRequest"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_no_truncate"();

CREATE TRIGGER "DataSubjectDiscoveryManifest_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectDiscoveryManifest"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_append_only"();
CREATE TRIGGER "DataSubjectDiscoveryManifest_no_truncate"
BEFORE TRUNCATE ON "DataSubjectDiscoveryManifest"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_no_truncate"();

CREATE TRIGGER "DataSubjectDiscoveryItem_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectDiscoveryItem"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_append_only"();
CREATE TRIGGER "DataSubjectDiscoveryItem_no_truncate"
BEFORE TRUNCATE ON "DataSubjectDiscoveryItem"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_no_truncate"();

ALTER TABLE "DataSubjectRequest"
  ENABLE ALWAYS TRIGGER "DataSubjectRequest_insert_guard";
ALTER TABLE "DataSubjectRequest"
  ENABLE ALWAYS TRIGGER "DataSubjectRequest_lifecycle_guard";
ALTER TABLE "DataSubjectRequest"
  ENABLE ALWAYS TRIGGER "DataSubjectRequest_no_delete";
ALTER TABLE "DataSubjectRequest"
  ENABLE ALWAYS TRIGGER "DataSubjectRequest_no_truncate";
ALTER TABLE "DataSubjectDiscoveryManifest"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryManifest_seal";
ALTER TABLE "DataSubjectDiscoveryManifest"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryManifest_terminal_check";
ALTER TABLE "DataSubjectDiscoveryManifest"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryManifest_append_only";
ALTER TABLE "DataSubjectDiscoveryManifest"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryManifest_no_truncate";
ALTER TABLE "DataSubjectDiscoveryItem"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryItem_before_seal";
ALTER TABLE "DataSubjectDiscoveryItem"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryItem_append_only";
ALTER TABLE "DataSubjectDiscoveryItem"
  ENABLE ALWAYS TRIGGER "DataSubjectDiscoveryItem_no_truncate";

COMMIT;
