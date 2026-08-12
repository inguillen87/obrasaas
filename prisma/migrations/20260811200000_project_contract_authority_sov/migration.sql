-- S9.3-CONTRACT: versioned contractual authority and immutable full-project
-- Schedule of Values. This foundation contains no certificate, invoice,
-- payment, change order, derived retention amount or Task.progress mutation.

CREATE TYPE "ProjectContractLineState" AS ENUM ('VALUED', 'NO_CLAIM');
CREATE TYPE "ProjectContractDecisionType" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "ProjectContractTechnicalBasisSnapshot" AS ENUM ('UNESTABLISHED', 'MATCHED');

CREATE TABLE "ProjectContractHead" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "currentAuthorityVersionId" TEXT,
  "latestAuthorityVersionId" TEXT,
  "pendingAuthorityVersionId" TEXT,
  "authorityRevision" INTEGER NOT NULL DEFAULT 0,
  "currentVersionId" TEXT,
  "latestVersionId" TEXT,
  "pendingVersionId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectContractHead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractHead_revision_check" CHECK (
    "authorityRevision" >= 0 AND "revision" >= 0
  )
);

CREATE TABLE "ProjectContractAuthorityVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "certifierMembershipId" TEXT NOT NULL,
  "financeMembershipId" TEXT NOT NULL,
  "registrarMembershipId" TEXT NOT NULL,
  "headRevisionAtPrepare" INTEGER NOT NULL,
  "preparedByMembershipId" TEXT NOT NULL,
  "candidateSha256" CHAR(64) NOT NULL,
  "authoritySha256" CHAR(64) NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectContractAuthorityVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractAuthority_version_check" CHECK ("version" >= 1),
  CONSTRAINT "ProjectContractAuthority_revision_check" CHECK ("headRevisionAtPrepare" >= 0),
  CONSTRAINT "ProjectContractAuthority_distinct_check" CHECK (
    "certifierMembershipId" <> "financeMembershipId"
    AND "certifierMembershipId" <> "registrarMembershipId"
    AND "financeMembershipId" <> "registrarMembershipId"
  ),
  CONSTRAINT "ProjectContractAuthority_hashes_check" CHECK (
    "candidateSha256" ~ '^[a-f0-9]{64}$'
    AND "authoritySha256" ~ '^[a-f0-9]{64}$'
    AND "operationKeyHash" ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint" ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE "ProjectContractAuthorityDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "authorityVersionId" TEXT NOT NULL,
  "decision" "ProjectContractDecisionType" NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "expectedHeadRevision" INTEGER NOT NULL,
  "headRevisionAfter" INTEGER NOT NULL,
  "authoritySha256Snapshot" CHAR(64) NOT NULL,
  "decidedByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectContractAuthorityDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractAuthorityDecision_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 1 AND 1000
  ),
  CONSTRAINT "ProjectContractAuthorityDecision_revision_check" CHECK (
    "expectedHeadRevision" >= 1 AND "headRevisionAfter" = "expectedHeadRevision" + 1
  ),
  CONSTRAINT "ProjectContractAuthorityDecision_hashes_check" CHECK (
    "authoritySha256Snapshot" ~ '^[a-f0-9]{64}$'
    AND "operationKeyHash" ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint" ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE "ProjectContractVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "authorityVersionId" TEXT NOT NULL,
  "authorityRevisionAtPrepare" INTEGER NOT NULL,
  "contractReference" VARCHAR(120) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "counterpartyLabel" VARCHAR(240) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "currencyMinorUnits" SMALLINT NOT NULL,
  "retentionBps" INTEGER NOT NULL,
  "roundingPolicyVersion" VARCHAR(64) NOT NULL,
  "adjustmentPolicyVersion" VARCHAR(64) NOT NULL,
  "lineCount" INTEGER NOT NULL,
  "valuedLineCount" INTEGER NOT NULL,
  "noClaimLineCount" INTEGER NOT NULL,
  "totalContractAmountMinor" BIGINT NOT NULL,
  "candidateSha256" CHAR(64) NOT NULL,
  "contractSha256" CHAR(64) NOT NULL,
  "headRevisionAtPrepare" INTEGER NOT NULL,
  "preparedByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectContractVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractVersion_version_check" CHECK ("version" >= 1),
  CONSTRAINT "ProjectContractVersion_revision_check" CHECK (
    "authorityRevisionAtPrepare" >= 2 AND "headRevisionAtPrepare" >= 0
  ),
  CONSTRAINT "ProjectContractVersion_identity_check" CHECK (
    length(btrim("contractReference")) BETWEEN 1 AND 120
    AND length(btrim("title")) BETWEEN 1 AND 240
    AND length(btrim("counterpartyLabel")) BETWEEN 1 AND 240
  ),
  CONSTRAINT "ProjectContractVersion_currency_check" CHECK (
    "currencyCode" IN ('ARS', 'USD') AND "currencyMinorUnits" = 2
  ),
  CONSTRAINT "ProjectContractVersion_terms_check" CHECK (
    "retentionBps" BETWEEN 0 AND 10000
    AND "roundingPolicyVersion" = 'CERT_RETENTION_HALF_UP_V1'
    AND "adjustmentPolicyVersion" = 'NONE'
  ),
  CONSTRAINT "ProjectContractVersion_counts_check" CHECK (
    "lineCount" BETWEEN 1 AND 5000
    AND "valuedLineCount" BETWEEN 1 AND "lineCount"
    AND "noClaimLineCount" >= 0
    AND "lineCount" = "valuedLineCount" + "noClaimLineCount"
  ),
  CONSTRAINT "ProjectContractVersion_amount_check" CHECK ("totalContractAmountMinor" > 0),
  CONSTRAINT "ProjectContractVersion_hashes_check" CHECK (
    "candidateSha256" ~ '^[a-f0-9]{64}$'
    AND "contractSha256" ~ '^[a-f0-9]{64}$'
    AND "operationKeyHash" ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint" ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE "ProjectContractLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "state" "ProjectContractLineState" NOT NULL,
  "taskId" TEXT NOT NULL,
  "taskCode" VARCHAR(64),
  "taskTitle" TEXT NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "unitCode" "ProgressMeasurementUnitCode",
  "baseQuantity" DECIMAL(18,4),
  "contractAmountMinor" BIGINT,
  "noClaimReason" VARCHAR(1000),
  "technicalBasisStatusAtPrepare" "ProjectContractTechnicalBasisSnapshot",
  "lineSha256" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectContractLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractLine_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 5000),
  CONSTRAINT "ProjectContractLine_task_revision_check" CHECK ("taskRevision" >= 0),
  CONSTRAINT "ProjectContractLine_hash_check" CHECK ("lineSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ProjectContractLine_shape_check" CHECK (
    (
      "state" = 'VALUED'
      AND "unitCode" IS NOT NULL
      AND "baseQuantity" > 0
      AND "contractAmountMinor" > 0
      AND "noClaimReason" IS NULL
      AND "technicalBasisStatusAtPrepare" IS NOT NULL
    )
    OR
    (
      "state" = 'NO_CLAIM'
      AND "unitCode" IS NULL
      AND "baseQuantity" IS NULL
      AND "contractAmountMinor" IS NULL
      AND length(btrim("noClaimReason")) BETWEEN 1 AND 1000
      AND "technicalBasisStatusAtPrepare" IS NULL
    )
  )
);

CREATE TABLE "ProjectContractDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "authorityVersionId" TEXT NOT NULL,
  "decision" "ProjectContractDecisionType" NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "expectedHeadRevision" INTEGER NOT NULL,
  "headRevisionAfter" INTEGER NOT NULL,
  "contractSha256Snapshot" CHAR(64) NOT NULL,
  "decidedByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectContractDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractDecision_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 1 AND 1000
  ),
  CONSTRAINT "ProjectContractDecision_revision_check" CHECK (
    "expectedHeadRevision" >= 1 AND "headRevisionAfter" = "expectedHeadRevision" + 1
  ),
  CONSTRAINT "ProjectContractDecision_hashes_check" CHECK (
    "contractSha256Snapshot" ~ '^[a-f0-9]{64}$'
    AND "operationKeyHash" ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint" ~ '^[a-f0-9]{64}$'
  )
);

CREATE UNIQUE INDEX "ProjectContractHead_scope_key"
  ON "ProjectContractHead"("organizationId", "projectId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_id_key"
  ON "ProjectContractHead"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ProjectContractHead_current_authority_key"
  ON "ProjectContractHead"("currentAuthorityVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_latest_authority_key"
  ON "ProjectContractHead"("latestAuthorityVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_pending_authority_key"
  ON "ProjectContractHead"("pendingAuthorityVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_current_authority_key"
  ON "ProjectContractHead"("organizationId", "projectId", "currentAuthorityVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_latest_authority_key"
  ON "ProjectContractHead"("organizationId", "projectId", "latestAuthorityVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_pending_authority_key"
  ON "ProjectContractHead"("organizationId", "projectId", "pendingAuthorityVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_current_version_key"
  ON "ProjectContractHead"("currentVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_latest_version_key"
  ON "ProjectContractHead"("latestVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_pending_version_key"
  ON "ProjectContractHead"("pendingVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_current_version_key"
  ON "ProjectContractHead"("organizationId", "projectId", "currentVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_latest_version_key"
  ON "ProjectContractHead"("organizationId", "projectId", "latestVersionId");
CREATE UNIQUE INDEX "ProjectContractHead_scope_pending_version_key"
  ON "ProjectContractHead"("organizationId", "projectId", "pendingVersionId");

CREATE UNIQUE INDEX "ProjectContractAuthority_org_operation_key"
  ON "ProjectContractAuthorityVersion"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "ProjectContractAuthority_head_version_key"
  ON "ProjectContractAuthorityVersion"("headId", "version");
CREATE UNIQUE INDEX "ProjectContractAuthority_predecessor_key"
  ON "ProjectContractAuthorityVersion"("predecessorId");
CREATE UNIQUE INDEX "ProjectContractAuthority_scope_id_key"
  ON "ProjectContractAuthorityVersion"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ProjectContractAuthority_scope_head_id_key"
  ON "ProjectContractAuthorityVersion"("organizationId", "projectId", "headId", "id");
CREATE UNIQUE INDEX "ProjectContractAuthority_scope_predecessor_key"
  ON "ProjectContractAuthorityVersion"("organizationId", "projectId", "headId", "predecessorId");
CREATE INDEX "ProjectContractAuthority_project_created_idx"
  ON "ProjectContractAuthorityVersion"("organizationId", "projectId", "createdAt");

CREATE UNIQUE INDEX "ProjectContractAuthorityDecision_version_key"
  ON "ProjectContractAuthorityDecision"("authorityVersionId");
CREATE UNIQUE INDEX "ProjectContractAuthorityDecision_org_operation_key"
  ON "ProjectContractAuthorityDecision"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "ProjectContractAuthorityDecision_scope_version_key"
  ON "ProjectContractAuthorityDecision"("organizationId", "projectId", "headId", "authorityVersionId");
CREATE INDEX "ProjectContractAuthorityDecision_project_created_idx"
  ON "ProjectContractAuthorityDecision"("organizationId", "projectId", "createdAt");

CREATE UNIQUE INDEX "ProjectContractVersion_org_operation_key"
  ON "ProjectContractVersion"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "ProjectContractVersion_head_version_key"
  ON "ProjectContractVersion"("headId", "version");
CREATE UNIQUE INDEX "ProjectContractVersion_predecessor_key"
  ON "ProjectContractVersion"("predecessorId");
CREATE UNIQUE INDEX "ProjectContractVersion_scope_id_key"
  ON "ProjectContractVersion"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ProjectContractVersion_scope_head_id_key"
  ON "ProjectContractVersion"("organizationId", "projectId", "headId", "id");
CREATE UNIQUE INDEX "ProjectContractVersion_scope_authority_key"
  ON "ProjectContractVersion"("organizationId", "projectId", "headId", "id", "authorityVersionId");
CREATE UNIQUE INDEX "ProjectContractVersion_scope_predecessor_key"
  ON "ProjectContractVersion"("organizationId", "projectId", "headId", "predecessorId");
CREATE INDEX "ProjectContractVersion_project_created_idx"
  ON "ProjectContractVersion"("organizationId", "projectId", "createdAt");

CREATE UNIQUE INDEX "ProjectContractLine_version_ordinal_key"
  ON "ProjectContractLine"("contractVersionId", "ordinal");
CREATE UNIQUE INDEX "ProjectContractLine_version_task_key"
  ON "ProjectContractLine"("contractVersionId", "taskId");
CREATE UNIQUE INDEX "ProjectContractLine_scope_id_key"
  ON "ProjectContractLine"("organizationId", "projectId", "contractVersionId", "id");
CREATE INDEX "ProjectContractLine_task_created_idx"
  ON "ProjectContractLine"("organizationId", "projectId", "taskId", "createdAt");

CREATE UNIQUE INDEX "ProjectContractDecision_version_key"
  ON "ProjectContractDecision"("contractVersionId");
CREATE UNIQUE INDEX "ProjectContractDecision_org_operation_key"
  ON "ProjectContractDecision"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "ProjectContractDecision_scope_version_key"
  ON "ProjectContractDecision"("organizationId", "projectId", "headId", "contractVersionId");
CREATE UNIQUE INDEX "ProjectContractDecision_scope_authority_key"
  ON "ProjectContractDecision"(
    "organizationId", "projectId", "headId", "contractVersionId", "authorityVersionId"
  );
CREATE INDEX "ProjectContractDecision_project_created_idx"
  ON "ProjectContractDecision"("organizationId", "projectId", "createdAt");

ALTER TABLE "ProjectContractHead"
  ADD CONSTRAINT "ProjectContractHead_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractHead_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractAuthorityVersion"
  ADD CONSTRAINT "ProjectContractAuthority_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_head_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId")
    REFERENCES "ProjectContractHead"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_predecessor_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId", "predecessorId")
    REFERENCES "ProjectContractAuthorityVersion"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_certifier_fkey"
    FOREIGN KEY ("organizationId", "certifierMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_finance_fkey"
    FOREIGN KEY ("organizationId", "financeMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_registrar_fkey"
    FOREIGN KEY ("organizationId", "registrarMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthority_preparer_fkey"
    FOREIGN KEY ("organizationId", "preparedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractAuthorityDecision"
  ADD CONSTRAINT "ProjectContractAuthorityDecision_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthorityDecision_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthorityDecision_head_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId")
    REFERENCES "ProjectContractHead"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthorityDecision_version_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId", "authorityVersionId")
    REFERENCES "ProjectContractAuthorityVersion"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractAuthorityDecision_checker_fkey"
    FOREIGN KEY ("organizationId", "decidedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractVersion"
  ADD CONSTRAINT "ProjectContractVersion_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractVersion_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractVersion_head_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId")
    REFERENCES "ProjectContractHead"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractVersion_predecessor_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId", "predecessorId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractVersion_authority_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId", "authorityVersionId")
    REFERENCES "ProjectContractAuthorityVersion"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractVersion_preparer_fkey"
    FOREIGN KEY ("organizationId", "preparedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractLine"
  ADD CONSTRAINT "ProjectContractLine_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractLine_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractLine_head_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId")
    REFERENCES "ProjectContractHead"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractLine_version_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId", "contractVersionId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractLine_task_scope_fkey"
    FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractDecision"
  ADD CONSTRAINT "ProjectContractDecision_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractDecision_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractDecision_head_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId")
    REFERENCES "ProjectContractHead"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractDecision_version_scope_fkey"
    FOREIGN KEY (
      "organizationId", "projectId", "headId", "contractVersionId", "authorityVersionId"
    ) REFERENCES "ProjectContractVersion"(
      "organizationId", "projectId", "headId", "id", "authorityVersionId"
    ) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractDecision_checker_fkey"
    FOREIGN KEY ("organizationId", "decidedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractHead"
  ADD CONSTRAINT "ProjectContractHead_current_authority_fkey"
    FOREIGN KEY ("organizationId", "projectId", "currentAuthorityVersionId")
    REFERENCES "ProjectContractAuthorityVersion"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractHead_latest_authority_fkey"
    FOREIGN KEY ("organizationId", "projectId", "latestAuthorityVersionId")
    REFERENCES "ProjectContractAuthorityVersion"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractHead_pending_authority_fkey"
    FOREIGN KEY ("organizationId", "projectId", "pendingAuthorityVersionId")
    REFERENCES "ProjectContractAuthorityVersion"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractHead_current_version_fkey"
    FOREIGN KEY ("organizationId", "projectId", "currentVersionId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractHead_latest_version_fkey"
    FOREIGN KEY ("organizationId", "projectId", "latestVersionId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectContractHead_pending_version_fkey"
    FOREIGN KEY ("organizationId", "projectId", "pendingVersionId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "obrasaas_project_contract_line_sha"(
  p_state TEXT,
  p_task_id TEXT,
  p_task_code TEXT,
  p_task_title TEXT,
  p_task_revision INTEGER,
  p_unit_code TEXT,
  p_base_quantity NUMERIC,
  p_contract_amount_minor BIGINT,
  p_no_claim_reason TEXT,
  p_technical_basis_status TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-line-v1',
    p_state,
    p_task_id,
    p_task_code,
    p_task_title,
    p_task_revision,
    p_unit_code,
    CASE WHEN p_base_quantity IS NULL THEN NULL
      ELSE to_char(p_base_quantity, 'FM99999999999999.0000') END,
    CASE WHEN p_contract_amount_minor IS NULL THEN NULL
      ELSE p_contract_amount_minor::TEXT END,
    p_no_claim_reason,
    p_technical_basis_status
  )::TEXT, 'UTF8')), 'hex');
$$;

CREATE FUNCTION "obrasaas_project_contract_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is governed history and cannot be truncated', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_append_only_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_scope TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  v_scope := current_setting('obrasaas.project_contract_authority_write_scope', true);
  IF pg_catalog.pg_trigger_depth() <> 2 OR v_scope IS DISTINCT FROM
    NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."headId" THEN
    RAISE EXCEPTION 'direct project contract authority ledger writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_append_only_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_scope TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  v_scope := current_setting('obrasaas.project_contract_write_scope', true);
  IF pg_catalog.pg_trigger_depth() <> 2 OR v_scope IS DISTINCT FROM
    NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."headId" THEN
    RAISE EXCEPTION 'direct project contract ledger writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expected_sha TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  IF pg_catalog.pg_trigger_depth() <> 2 OR
    current_setting('obrasaas.project_contract_write_scope', true) IS DISTINCT FROM
      NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."headId" THEN
    RAISE EXCEPTION 'direct project contract line writes are forbidden'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM "Task" t
   WHERE t."projectId" = NEW."projectId"
     AND t."id" = NEW."taskId"
     AND t."type" = 'TASK'
     AND t."metadata" ->> 'source' = 'canonical-task-v1'
     AND t."code" IS NOT DISTINCT FROM NEW."taskCode"
     AND t."title" = NEW."taskTitle"
     AND t."revision" = NEW."taskRevision";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_SNAPSHOT_INVALID: line task snapshot is not canonical/current'
      USING ERRCODE = '40001';
  END IF;

  v_expected_sha := "obrasaas_project_contract_line_sha"(
    NEW."state"::TEXT,
    NEW."taskId",
    NEW."taskCode",
    NEW."taskTitle",
    NEW."taskRevision",
    NEW."unitCode"::TEXT,
    NEW."baseQuantity",
    NEW."contractAmountMinor",
    NEW."noClaimReason",
    NEW."technicalBasisStatusAtPrepare"::TEXT
  );
  IF NEW."lineSha256" IS DISTINCT FROM v_expected_sha THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_LINE_DIGEST_INVALID: line digest is not canonical'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_head_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_authority_scope TEXT;
  v_contract_scope TEXT;
  v_expected_scope TEXT;
BEGIN
  v_expected_scope := NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."id";
  v_authority_scope := current_setting('obrasaas.project_contract_authority_write_scope', true);
  v_contract_scope := current_setting('obrasaas.project_contract_write_scope', true);
  IF pg_catalog.pg_trigger_depth() <> 2 OR
    (v_authority_scope IS DISTINCT FROM v_expected_scope
      AND v_contract_scope IS DISTINCT FROM v_expected_scope) THEN
    RAISE EXCEPTION 'direct project contract head writes are forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ProjectContractHead cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'project contract head identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND v_authority_scope = v_expected_scope AND (
    NEW."currentVersionId" IS DISTINCT FROM OLD."currentVersionId"
    OR NEW."latestVersionId" IS DISTINCT FROM OLD."latestVersionId"
    OR NEW."pendingVersionId" IS DISTINCT FROM OLD."pendingVersionId"
    OR NEW."revision" IS DISTINCT FROM OLD."revision"
  ) THEN
    RAISE EXCEPTION 'authority command cannot mutate SOV projection' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND v_contract_scope = v_expected_scope AND (
    NEW."currentAuthorityVersionId" IS DISTINCT FROM OLD."currentAuthorityVersionId"
    OR NEW."latestAuthorityVersionId" IS DISTINCT FROM OLD."latestAuthorityVersionId"
    OR NEW."pendingAuthorityVersionId" IS DISTINCT FROM OLD."pendingAuthorityVersionId"
    OR NEW."authorityRevision" IS DISTINCT FROM OLD."authorityRevision"
  ) THEN
    RAISE EXCEPTION 'SOV command cannot mutate authority projection' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_task_scope_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_organization_id TEXT;
  v_was_canonical BOOLEAN := false;
  v_is_canonical BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_was_canonical := OLD."type" = 'TASK'
      AND OLD."metadata" ->> 'source' = 'canonical-task-v1';
  END IF;
  v_is_canonical := NEW."type" = 'TASK'
    AND NEW."metadata" ->> 'source' = 'canonical-task-v1';
  IF TG_OP = 'INSERT' AND NOT v_is_canonical THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND v_was_canonical = v_is_canonical THEN
    RETURN NEW;
  END IF;

  SELECT p."organizationId" INTO STRICT v_organization_id
    FROM "Project" p
   WHERE p."id" = NEW."projectId";

  -- Contract prepare/approval take these locks in the same order. Therefore a
  -- first activation either observes the changed task set and fails its CAS,
  -- or commits before this membership change reaches the governed check.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || v_organization_id || ':' || NEW."projectId", 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_organization_id || ':' || NEW."projectId" || ':' || NEW."id", 0
  ));

  IF EXISTS (
    SELECT 1
      FROM "ProjectContractHead" h
      JOIN "ProjectContractVersion" v
        ON v."organizationId" = h."organizationId"
       AND v."projectId" = h."projectId"
       AND v."headId" = h."id"
       AND v."id" = h."currentVersionId"
      JOIN "ProjectContractDecision" d
        ON d."organizationId" = v."organizationId"
       AND d."projectId" = v."projectId"
       AND d."headId" = v."headId"
       AND d."contractVersionId" = v."id"
       AND d."authorityVersionId" = v."authorityVersionId"
       AND d."decision" = 'APPROVED'
     WHERE h."organizationId" = v_organization_id
       AND h."projectId" = NEW."projectId"
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL: canonical task scope cannot change while an approved contract is current'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProjectContractAuthorityVersion_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectContractAuthorityVersion"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_authority_append_only_guard"();
ALTER TABLE "ProjectContractAuthorityVersion"
  ENABLE ALWAYS TRIGGER "ProjectContractAuthorityVersion_append_only";
CREATE TRIGGER "ProjectContractAuthorityVersion_no_truncate"
BEFORE TRUNCATE ON "ProjectContractAuthorityVersion"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_contract_no_truncate"();
ALTER TABLE "ProjectContractAuthorityVersion"
  ENABLE ALWAYS TRIGGER "ProjectContractAuthorityVersion_no_truncate";

CREATE TRIGGER "ProjectContractAuthorityDecision_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectContractAuthorityDecision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_authority_append_only_guard"();
ALTER TABLE "ProjectContractAuthorityDecision"
  ENABLE ALWAYS TRIGGER "ProjectContractAuthorityDecision_append_only";
CREATE TRIGGER "ProjectContractAuthorityDecision_no_truncate"
BEFORE TRUNCATE ON "ProjectContractAuthorityDecision"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_contract_no_truncate"();
ALTER TABLE "ProjectContractAuthorityDecision"
  ENABLE ALWAYS TRIGGER "ProjectContractAuthorityDecision_no_truncate";

CREATE TRIGGER "ProjectContractVersion_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectContractVersion"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_append_only_guard"();
ALTER TABLE "ProjectContractVersion"
  ENABLE ALWAYS TRIGGER "ProjectContractVersion_append_only";
CREATE TRIGGER "ProjectContractVersion_no_truncate"
BEFORE TRUNCATE ON "ProjectContractVersion"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_contract_no_truncate"();
ALTER TABLE "ProjectContractVersion"
  ENABLE ALWAYS TRIGGER "ProjectContractVersion_no_truncate";

CREATE TRIGGER "ProjectContractLine_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectContractLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_line_guard"();
ALTER TABLE "ProjectContractLine"
  ENABLE ALWAYS TRIGGER "ProjectContractLine_append_only";
CREATE TRIGGER "ProjectContractLine_no_truncate"
BEFORE TRUNCATE ON "ProjectContractLine"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_contract_no_truncate"();
ALTER TABLE "ProjectContractLine"
  ENABLE ALWAYS TRIGGER "ProjectContractLine_no_truncate";

CREATE TRIGGER "ProjectContractDecision_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectContractDecision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_append_only_guard"();
ALTER TABLE "ProjectContractDecision"
  ENABLE ALWAYS TRIGGER "ProjectContractDecision_append_only";
CREATE TRIGGER "ProjectContractDecision_no_truncate"
BEFORE TRUNCATE ON "ProjectContractDecision"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_contract_no_truncate"();
ALTER TABLE "ProjectContractDecision"
  ENABLE ALWAYS TRIGGER "ProjectContractDecision_no_truncate";

CREATE TRIGGER "ProjectContractHead_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectContractHead"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_head_guard"();
ALTER TABLE "ProjectContractHead"
  ENABLE ALWAYS TRIGGER "ProjectContractHead_projection_guard";
CREATE TRIGGER "ProjectContractHead_no_truncate"
BEFORE TRUNCATE ON "ProjectContractHead"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_contract_no_truncate"();
ALTER TABLE "ProjectContractHead"
  ENABLE ALWAYS TRIGGER "ProjectContractHead_no_truncate";

CREATE TRIGGER "Task_project_contract_scope_guard"
BEFORE INSERT OR UPDATE OF "type", "metadata" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_task_scope_guard"();
ALTER TABLE "Task"
  ENABLE ALWAYS TRIGGER "Task_project_contract_scope_guard";

CREATE FUNCTION "obrasaas_project_contract_membership_matches"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_membership_id TEXT,
  p_tenant_role TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM "TenantMembership" tm
      JOIN "ProjectMembership" pm
        ON pm."tenantMembershipId" = tm."id"
       AND pm."projectId" = p_project_id
       AND pm."status" = 'ACTIVE'
      JOIN "Project" p
        ON p."id" = pm."projectId"
       AND p."organizationId" = tm."organizationId"
       AND p."status" <> 'ARCHIVED'
     WHERE tm."organizationId" = p_organization_id
       AND tm."id" = p_membership_id
       AND tm."status" = 'ACTIVE'
       AND tm."tenantRole"::TEXT = p_tenant_role
  );
$$;

CREATE FUNCTION "obrasaas_project_contract_actor_can_read"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_membership_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM "TenantMembership" tm
      JOIN "ProjectMembership" pm
        ON pm."tenantMembershipId" = tm."id"
       AND pm."projectId" = p_project_id
       AND pm."status" = 'ACTIVE'
      JOIN "Project" p
        ON p."id" = pm."projectId"
       AND p."organizationId" = tm."organizationId"
       AND p."status" <> 'ARCHIVED'
     WHERE tm."organizationId" = p_organization_id
       AND tm."id" = p_membership_id
       AND tm."status" = 'ACTIVE'
       AND tm."tenantRole" IN ('ADMIN', 'DIRECTOR', 'FINANCE', 'AUDITOR')
  );
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_candidate"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_certifier_membership_id TEXT,
  p_finance_membership_id TEXT,
  p_registrar_membership_id TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  head_id TEXT,
  current_authority_version_id TEXT,
  latest_authority_version_id TEXT,
  pending_authority_version_id TEXT,
  authority_revision INTEGER,
  candidate_sha256 TEXT,
  readiness TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_head RECORD;
  v_current RECORD;
  v_candidate TEXT;
  v_readiness TEXT;
BEGIN
  IF p_organization_id IS NULL OR p_project_id IS NULL
    OR p_certifier_membership_id IS NULL OR p_finance_membership_id IS NULL
    OR p_registrar_membership_id IS NULL OR p_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'organization, project, three authorities and actor are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_certifier_membership_id = p_finance_membership_id
    OR p_certifier_membership_id = p_registrar_membership_id
    OR p_finance_membership_id = p_registrar_membership_id THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_SEPARATION_REQUIRED: certifier, finance and registrar must be distinct'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM "Project" p
   WHERE p."organizationId" = p_organization_id
     AND p."id" = p_project_id
     AND p."status" <> 'ARCHIVED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: active tenant-scoped project was not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_certifier_membership_id, 'DIRECTOR'
  ) OR NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_finance_membership_id, 'FINANCE'
  ) OR NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_registrar_membership_id, 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_INVALID: assigned authorities must be ACTIVE, project-scoped and role-compatible'
      USING ERRCODE = '42501';
  END IF;

  SELECT h."id", h."currentAuthorityVersionId", h."latestAuthorityVersionId",
         h."pendingAuthorityVersionId", h."authorityRevision", h."pendingVersionId"
    INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id;
  IF NOT FOUND THEN
    v_head."id" := NULL;
    v_head."currentAuthorityVersionId" := NULL;
    v_head."latestAuthorityVersionId" := NULL;
    v_head."pendingAuthorityVersionId" := NULL;
    v_head."authorityRevision" := 0;
    v_head."pendingVersionId" := NULL;
  END IF;

  IF v_head."pendingVersionId" IS NOT NULL THEN
    v_readiness := 'CONTRACT_PENDING';
  ELSIF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    v_readiness := 'AUTHORITY_PENDING';
  ELSE
    v_readiness := 'READY';
  END IF;

  IF v_head."currentAuthorityVersionId" IS NULL THEN
    IF p_actor_membership_id IS DISTINCT FROM p_registrar_membership_id
      OR NOT "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, p_actor_membership_id, 'ADMIN'
      ) THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_BOOTSTRAP_FORBIDDEN: bootstrap maker must be the proposed ACTIVE registrar ADMIN'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT a."certifierMembershipId", a."financeMembershipId", a."registrarMembershipId"
      INTO v_current
      FROM "ProjectContractAuthorityVersion" a
      JOIN "ProjectContractAuthorityDecision" d
        ON d."organizationId" = a."organizationId"
       AND d."projectId" = a."projectId"
       AND d."headId" = a."headId"
       AND d."authorityVersionId" = a."id"
       AND d."decision" = 'APPROVED'
     WHERE a."organizationId" = p_organization_id
       AND a."projectId" = p_project_id
       AND a."id" = v_head."currentAuthorityVersionId";
    IF NOT FOUND
      OR NOT "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_current."certifierMembershipId", 'DIRECTOR'
      ) OR NOT "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_current."financeMembershipId", 'FINANCE'
      ) OR NOT "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_current."registrarMembershipId", 'ADMIN'
      ) THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED: current authority is not fully active; break-glass is out of scope'
        USING ERRCODE = '42501';
    END IF;
    IF p_actor_membership_id IS DISTINCT FROM v_current."registrarMembershipId" THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_ROTATION_FORBIDDEN: only the current ACTIVE registrar may prepare rotation'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_candidate := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-authority-candidate-v1',
    p_organization_id,
    p_project_id,
    v_head."currentAuthorityVersionId",
    v_head."latestAuthorityVersionId",
    v_head."authorityRevision",
    p_certifier_membership_id,
    p_finance_membership_id,
    p_registrar_membership_id
  )::TEXT, 'UTF8')), 'hex');

  RETURN QUERY SELECT
    v_head."id"::TEXT,
    v_head."currentAuthorityVersionId"::TEXT,
    v_head."latestAuthorityVersionId"::TEXT,
    v_head."pendingAuthorityVersionId"::TEXT,
    v_head."authorityRevision"::INTEGER,
    v_candidate,
    v_readiness;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_prepare_result"(
  p_authority_version_id TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE(
  authority_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  authority_version INTEGER,
  authority_sha256 TEXT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT a."id", a."organizationId", a."projectId", a."version",
         a."authoritySha256"::TEXT, a."preparedByMembershipId",
         a."headRevisionAtPrepare" + 1, p_replayed
    FROM "ProjectContractAuthorityVersion" a
   WHERE a."id" = p_authority_version_id;
$$;

-- Replay lookup is intentionally independent from the live candidate. An exact
-- retry must remain observable after approval or a later authority rotation,
-- while current ACTIVE memberships are still revalidated fail-closed.
CREATE FUNCTION "obrasaas_project_contract_authority_prepare_replay"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_expected_current_authority_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_certifier_membership_id TEXT,
  p_finance_membership_id TEXT,
  p_registrar_membership_id TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  authority_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  authority_version INTEGER,
  authority_sha256 TEXT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_expected_candidate TEXT;
  v_existing RECORD;
BEGIN
  IF p_expected_head_revision IS NULL OR p_expected_head_revision < 0
    OR p_certifier_membership_id IS NULL
    OR p_finance_membership_id IS NULL
    OR p_registrar_membership_id IS NULL
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid authority replay lookup input'
      USING ERRCODE = '22023';
  END IF;
  IF p_certifier_membership_id = p_finance_membership_id
    OR p_certifier_membership_id = p_registrar_membership_id
    OR p_finance_membership_id = p_registrar_membership_id
    OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_actor_membership_id, 'ADMIN'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_certifier_membership_id, 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_finance_membership_id, 'FINANCE'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_registrar_membership_id, 'ADMIN'
    ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_MAKER_FORBIDDEN: replay requires the exact ACTIVE registrar and authority memberships'
      USING ERRCODE = '42501';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  SELECT a."id", a."projectId", a."predecessorId", a."headRevisionAtPrepare",
         a."certifierMembershipId", a."financeMembershipId", a."registrarMembershipId",
         a."candidateSha256"::TEXT AS candidate_sha256,
         a."requestFingerprint"::TEXT AS request_fingerprint,
         a."preparedByMembershipId"
    INTO v_existing
    FROM "ProjectContractAuthorityVersion" a
   WHERE a."organizationId" = p_organization_id
     AND a."operationKeyHash" = v_operation_hash;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_expected_candidate := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-authority-candidate-v1',
    p_organization_id,
    p_project_id,
    p_expected_current_authority_version_id,
    v_existing."predecessorId",
    p_expected_head_revision,
    p_certifier_membership_id,
    p_finance_membership_id,
    p_registrar_membership_id
  )::TEXT, 'UTF8')), 'hex');

  IF v_existing."projectId" IS DISTINCT FROM p_project_id
    OR v_existing."headRevisionAtPrepare" IS DISTINCT FROM p_expected_head_revision
    OR v_existing."certifierMembershipId" IS DISTINCT FROM p_certifier_membership_id
    OR v_existing."financeMembershipId" IS DISTINCT FROM p_finance_membership_id
    OR v_existing."registrarMembershipId" IS DISTINCT FROM p_registrar_membership_id
    OR v_existing.candidate_sha256 IS DISTINCT FROM v_expected_candidate
    OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint
    OR v_existing."preparedByMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_IDEMPOTENCY_CONFLICT: operation key was reused with another request'
      USING ERRCODE = '22000';
  END IF;

  RETURN QUERY SELECT *
    FROM "obrasaas_project_contract_authority_prepare_result"(v_existing.id, true);
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_decide_result"(
  p_decision_id TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE(
  decision_id TEXT,
  authority_version_id TEXT,
  decision "ProjectContractDecisionType",
  decided_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT d."id", d."authorityVersionId", d."decision",
         d."decidedByMembershipId", d."headRevisionAfter", p_replayed
    FROM "ProjectContractAuthorityDecision" d
   WHERE d."id" = p_decision_id;
$$;

CREATE VIEW "ObrasaasProjectContractAuthorityPrepareCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::TEXT AS "expectedCurrentAuthorityVersionId",
  NULL::INTEGER AS "expectedHeadRevision",
  NULL::TEXT AS "expectedCandidateSha256",
  NULL::TEXT AS "certifierMembershipId",
  NULL::TEXT AS "financeMembershipId",
  NULL::TEXT AS "registrarMembershipId",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::TEXT AS "authorityVersionId",
  NULL::INTEGER AS "authorityVersion",
  NULL::TEXT AS "authoritySha256",
  NULL::TEXT AS "preparedByMembershipId",
  NULL::INTEGER AS "headRevision",
  NULL::BOOLEAN AS "replayed"
WHERE FALSE;

CREATE VIEW "ObrasaasProjectContractAuthorityDecideCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::TEXT AS "authorityVersionId",
  NULL::INTEGER AS "expectedHeadRevision",
  NULL::TEXT AS "expectedAuthoritySha256",
  NULL::TEXT AS "decisionInput",
  NULL::TEXT AS "reason",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::TEXT AS "decisionId",
  NULL::TEXT AS "decidedByMembershipId",
  NULL::INTEGER AS "headRevision",
  NULL::BOOLEAN AS "replayed"
WHERE FALSE;

CREATE FUNCTION "obrasaas_project_contract_authority_prepare_command"()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF TG_OP <> 'INSERT' OR pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract authority prepare requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_result
    FROM "obrasaas_project_contract_authority_prepare_worker"(
      NEW."organizationId", NEW."projectId",
      NEW."expectedCurrentAuthorityVersionId", NEW."expectedHeadRevision",
      NEW."expectedCandidateSha256", NEW."certifierMembershipId",
      NEW."financeMembershipId", NEW."registrarMembershipId",
      NEW."operationKey", NEW."requestFingerprint", NEW."actorMembershipId"
    );
  NEW."authorityVersionId" := v_result.authority_version_id;
  NEW."organizationId" := v_result.organization_id;
  NEW."projectId" := v_result.project_id;
  NEW."authorityVersion" := v_result.authority_version;
  NEW."authoritySha256" := v_result.authority_sha256;
  NEW."preparedByMembershipId" := v_result.prepared_by_membership_id;
  NEW."headRevision" := v_result.head_revision;
  NEW."replayed" := v_result.replayed;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_decide_command"()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF TG_OP <> 'INSERT' OR pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract authority decision requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_result
    FROM "obrasaas_project_contract_authority_decide_worker"(
      NEW."organizationId", NEW."projectId", NEW."authorityVersionId",
      NEW."expectedHeadRevision", NEW."expectedAuthoritySha256",
      NEW."decisionInput", NEW."reason", NEW."operationKey",
      NEW."requestFingerprint", NEW."actorMembershipId"
    );
  NEW."decisionId" := v_result.decision_id;
  NEW."authorityVersionId" := v_result.authority_version_id;
  NEW."decisionInput" := v_result.decision::TEXT;
  NEW."decidedByMembershipId" := v_result.decided_by_membership_id;
  NEW."headRevision" := v_result.head_revision;
  NEW."replayed" := v_result.replayed;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ObrasaasProjectContractAuthorityPrepareCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProjectContractAuthorityPrepareCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_authority_prepare_command"();
CREATE TRIGGER "ObrasaasProjectContractAuthorityDecideCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProjectContractAuthorityDecideCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_authority_decide_command"();

CREATE FUNCTION "obrasaas_project_contract_authority_prepare"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_expected_current_authority_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_candidate_sha256 TEXT,
  p_certifier_membership_id TEXT,
  p_finance_membership_id TEXT,
  p_registrar_membership_id TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  authority_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  authority_version INTEGER,
  authority_sha256 TEXT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO "ObrasaasProjectContractAuthorityPrepareCommand" AS command (
    "organizationId", "projectId", "expectedCurrentAuthorityVersionId",
    "expectedHeadRevision", "expectedCandidateSha256", "certifierMembershipId",
    "financeMembershipId", "registrarMembershipId", "operationKey",
    "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_expected_current_authority_version_id,
    p_expected_head_revision, p_expected_candidate_sha256, p_certifier_membership_id,
    p_finance_membership_id, p_registrar_membership_id, p_operation_key,
    p_request_fingerprint, p_actor_membership_id
  ) RETURNING
    command."authorityVersionId", command."organizationId", command."projectId",
    command."authorityVersion", command."authoritySha256",
    command."preparedByMembershipId", command."headRevision", command."replayed";
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_decide"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_authority_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_authority_sha256 TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  decision_id TEXT,
  authority_version_id TEXT,
  decision "ProjectContractDecisionType",
  decided_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO "ObrasaasProjectContractAuthorityDecideCommand" AS command (
    "organizationId", "projectId", "authorityVersionId", "expectedHeadRevision",
    "expectedAuthoritySha256", "decisionInput", "reason", "operationKey",
    "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_authority_version_id, p_expected_head_revision,
    p_expected_authority_sha256, p_decision, p_reason, p_operation_key,
    p_request_fingerprint, p_actor_membership_id
  ) RETURNING
    command."decisionId", command."authorityVersionId",
    command."decisionInput"::"ProjectContractDecisionType",
    command."decidedByMembershipId", command."headRevision", command."replayed";
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_prepare_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_expected_current_authority_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_candidate_sha256 TEXT,
  p_certifier_membership_id TEXT,
  p_finance_membership_id TEXT,
  p_registrar_membership_id TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  authority_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  authority_version INTEGER,
  authority_sha256 TEXT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_existing RECORD;
  v_head RECORD;
  v_candidate RECORD;
  v_head_id TEXT;
  v_authority_id TEXT := gen_random_uuid()::TEXT;
  v_authority_version INTEGER;
  v_authority_sha TEXT;
  v_created_at TIMESTAMP(3) := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_scope TEXT;
  v_rows INTEGER;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract authority prepare worker requires the governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  IF p_expected_head_revision IS NULL OR p_expected_head_revision < 0
    OR p_expected_candidate_sha256 IS NULL
    OR p_expected_candidate_sha256 !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'invalid authority prepare CAS, digest or idempotency input'
      USING ERRCODE = '22023';
  END IF;
  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:authority-prepare:' || p_organization_id || ':' || v_operation_hash, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));

  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_MAKER_FORBIDDEN: authority maker must be ACTIVE ADMIN with project access'
      USING ERRCODE = '42501';
  END IF;

  SELECT a."id", a."projectId", a."predecessorId", a."certifierMembershipId",
         a."financeMembershipId", a."registrarMembershipId",
         a."candidateSha256"::TEXT AS candidate_sha256,
         a."requestFingerprint"::TEXT AS request_fingerprint,
         a."preparedByMembershipId"
    INTO v_existing
    FROM "ProjectContractAuthorityVersion" a
   WHERE a."organizationId" = p_organization_id
     AND a."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."certifierMembershipId" IS DISTINCT FROM p_certifier_membership_id
      OR v_existing."financeMembershipId" IS DISTINCT FROM p_finance_membership_id
      OR v_existing."registrarMembershipId" IS DISTINCT FROM p_registrar_membership_id
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing."preparedByMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_IDEMPOTENCY_CONFLICT: operation key was reused with another request'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT *
      FROM "obrasaas_project_contract_authority_prepare_result"(v_existing.id, true);
    RETURN;
  END IF;

  SELECT h."id", h."currentAuthorityVersionId", h."latestAuthorityVersionId",
         h."pendingAuthorityVersionId", h."authorityRevision", h."pendingVersionId"
    INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
   FOR UPDATE;
  IF NOT FOUND THEN
    v_head_id := gen_random_uuid()::TEXT;
    v_head."id" := v_head_id;
    v_head."currentAuthorityVersionId" := NULL;
    v_head."latestAuthorityVersionId" := NULL;
    v_head."pendingAuthorityVersionId" := NULL;
    v_head."authorityRevision" := 0;
    v_head."pendingVersionId" := NULL;
  ELSE
    v_head_id := v_head."id";
  END IF;

  SELECT * INTO v_candidate
    FROM "obrasaas_project_contract_authority_candidate"(
      p_organization_id, p_project_id, p_certifier_membership_id,
      p_finance_membership_id, p_registrar_membership_id, p_actor_membership_id
    );
  IF v_candidate.readiness <> 'READY' THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_NOT_READY: %', v_candidate.readiness
      USING ERRCODE = '55000';
  END IF;
  IF v_head."currentAuthorityVersionId" IS DISTINCT FROM p_expected_current_authority_version_id
    OR v_head."authorityRevision" IS DISTINCT FROM p_expected_head_revision THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_HEAD_STALE: authority head changed'
      USING ERRCODE = '40001';
  END IF;
  IF v_candidate.candidate_sha256 IS DISTINCT FROM p_expected_candidate_sha256 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_CANDIDATE_STALE: authority candidate changed'
      USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(max(a."version"), 0) + 1
    INTO v_authority_version
    FROM "ProjectContractAuthorityVersion" a
   WHERE a."headId" = v_head_id;
  v_authority_sha := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-authority-v1',
    p_organization_id,
    p_project_id,
    v_authority_version,
    v_head."latestAuthorityVersionId",
    p_certifier_membership_id,
    p_finance_membership_id,
    p_registrar_membership_id,
    p_expected_candidate_sha256,
    p_actor_membership_id,
    to_char(v_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::TEXT, 'UTF8')), 'hex');

  v_scope := p_organization_id || ':' || p_project_id || ':' || v_head_id;
  PERFORM set_config('obrasaas.project_contract_authority_write_scope', v_scope, true);
  IF v_head."id" IS NULL OR NOT EXISTS (
    SELECT 1 FROM "ProjectContractHead" h WHERE h."id" = v_head_id
  ) THEN
    INSERT INTO "ProjectContractHead" (
      "id", "organizationId", "projectId", "authorityRevision", "revision",
      "createdAt", "updatedAt"
    ) VALUES (
      v_head_id, p_organization_id, p_project_id, 0, 0, v_created_at, v_created_at
    );
  END IF;

  INSERT INTO "ProjectContractAuthorityVersion" (
    "id", "organizationId", "projectId", "headId", "version", "predecessorId",
    "certifierMembershipId", "financeMembershipId", "registrarMembershipId",
    "headRevisionAtPrepare", "preparedByMembershipId", "candidateSha256",
    "authoritySha256", "operationKeyHash", "requestFingerprint", "createdAt"
  ) VALUES (
    v_authority_id, p_organization_id, p_project_id, v_head_id, v_authority_version,
    v_head."latestAuthorityVersionId", p_certifier_membership_id,
    p_finance_membership_id, p_registrar_membership_id, p_expected_head_revision,
    p_actor_membership_id, p_expected_candidate_sha256, v_authority_sha,
    v_operation_hash, p_request_fingerprint, v_created_at
  );

  UPDATE "ProjectContractHead"
     SET "latestAuthorityVersionId" = v_authority_id,
         "pendingAuthorityVersionId" = v_authority_id,
         "authorityRevision" = p_expected_head_revision + 1,
         "updatedAt" = v_created_at
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "id" = v_head_id
     AND "authorityRevision" = p_expected_head_revision
     AND "currentAuthorityVersionId" IS NOT DISTINCT FROM p_expected_current_authority_version_id
     AND "pendingAuthorityVersionId" IS NULL
     AND "pendingVersionId" IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_HEAD_STALE: authority head changed during prepare'
      USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('obrasaas.project_contract_authority_write_scope', '', true);

  RETURN QUERY SELECT *
    FROM "obrasaas_project_contract_authority_prepare_result"(v_authority_id, false);
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_decide_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_authority_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_authority_sha256 TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  decision_id TEXT,
  authority_version_id TEXT,
  decision "ProjectContractDecisionType",
  decided_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_existing RECORD;
  v_head RECORD;
  v_authority RECORD;
  v_current RECORD;
  v_expected_checker TEXT;
  v_decision_id TEXT := gen_random_uuid()::TEXT;
  v_created_at TIMESTAMP(3) := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_scope TEXT;
  v_rows INTEGER;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract authority decision worker requires the governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  IF p_authority_version_id IS NULL OR p_expected_head_revision IS NULL
    OR p_expected_head_revision < 1
    OR p_expected_authority_sha256 IS NULL
    OR p_expected_authority_sha256 !~ '^[a-f0-9]{64}$'
    OR p_decision NOT IN ('APPROVED', 'REJECTED')
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid authority decision input' USING ERRCODE = '22023';
  END IF;
  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:authority-decide:' || p_organization_id || ':' || v_operation_hash, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));

  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'DIRECTOR'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_CHECKER_FORBIDDEN: authority checker must be ACTIVE DIRECTOR with project access'
      USING ERRCODE = '42501';
  END IF;

  SELECT d."id", d."projectId", d."authorityVersionId", d."decision"::TEXT AS decision_text,
         d."reason", d."authoritySha256Snapshot"::TEXT AS authority_sha,
         d."decidedByMembershipId", d."requestFingerprint"::TEXT AS request_fingerprint
    INTO v_existing
    FROM "ProjectContractAuthorityDecision" d
   WHERE d."organizationId" = p_organization_id
     AND d."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."authorityVersionId" IS DISTINCT FROM p_authority_version_id
      OR v_existing.decision_text IS DISTINCT FROM p_decision
      OR v_existing.reason IS DISTINCT FROM btrim(p_reason)
      OR v_existing."decidedByMembershipId" IS DISTINCT FROM p_actor_membership_id
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_DECISION_IDEMPOTENCY_CONFLICT: operation key was reused'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT *
      FROM "obrasaas_project_contract_authority_decide_result"(v_existing.id, true);
    RETURN;
  END IF;

  SELECT h."id", h."currentAuthorityVersionId", h."pendingAuthorityVersionId",
         h."authorityRevision", h."pendingVersionId"
    INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_head."pendingVersionId" IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_BLOCKED_BY_PENDING_CONTRACT: decide the SOV first'
      USING ERRCODE = '55000';
  END IF;
  SELECT a.* INTO v_authority
    FROM "ProjectContractAuthorityVersion" a
   WHERE a."organizationId" = p_organization_id
     AND a."projectId" = p_project_id
     AND a."headId" = v_head.id
     AND a."id" = p_authority_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_head."pendingAuthorityVersionId" IS DISTINCT FROM p_authority_version_id
    OR v_head."authorityRevision" IS DISTINCT FROM p_expected_head_revision THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_HEAD_STALE: pending authority or CAS changed'
      USING ERRCODE = '40001';
  END IF;
  IF v_authority."authoritySha256"::TEXT IS DISTINCT FROM p_expected_authority_sha256 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_CANDIDATE_STALE: authority digest changed'
      USING ERRCODE = '40001';
  END IF;

  IF v_head."currentAuthorityVersionId" IS NULL THEN
    v_expected_checker := v_authority."certifierMembershipId";
  ELSE
    SELECT a."certifierMembershipId", a."financeMembershipId", a."registrarMembershipId"
      INTO v_current
      FROM "ProjectContractAuthorityVersion" a
      JOIN "ProjectContractAuthorityDecision" d
        ON d."authorityVersionId" = a."id" AND d."decision" = 'APPROVED'
     WHERE a."organizationId" = p_organization_id
       AND a."projectId" = p_project_id
       AND a."id" = v_head."currentAuthorityVersionId";
    IF NOT FOUND
      OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_current."certifierMembershipId", 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_current."financeMembershipId", 'FINANCE'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_current."registrarMembershipId", 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED: current authority is no longer fully active'
        USING ERRCODE = '42501';
    END IF;
    v_expected_checker := v_current."certifierMembershipId";
  END IF;
  IF p_actor_membership_id IS DISTINCT FROM v_expected_checker
    OR p_actor_membership_id = v_authority."preparedByMembershipId" THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_MAKER_CHECKER_REQUIRED: expected certifier checker must differ from maker'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'APPROVED' AND (
    NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."financeMembershipId", 'FINANCE'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
    )
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_INVALID: proposed authorities are not fully active'
      USING ERRCODE = '42501';
  END IF;

  v_scope := p_organization_id || ':' || p_project_id || ':' || v_head.id;
  PERFORM set_config('obrasaas.project_contract_authority_write_scope', v_scope, true);
  INSERT INTO "ProjectContractAuthorityDecision" (
    "id", "organizationId", "projectId", "headId", "authorityVersionId",
    "decision", "reason", "expectedHeadRevision", "headRevisionAfter",
    "authoritySha256Snapshot", "decidedByMembershipId", "operationKeyHash",
    "requestFingerprint", "createdAt"
  ) VALUES (
    v_decision_id, p_organization_id, p_project_id, v_head.id,
    p_authority_version_id, p_decision::"ProjectContractDecisionType", btrim(p_reason),
    p_expected_head_revision, p_expected_head_revision + 1,
    p_expected_authority_sha256, p_actor_membership_id, v_operation_hash,
    p_request_fingerprint, v_created_at
  );

  UPDATE "ProjectContractHead"
     SET "currentAuthorityVersionId" = CASE WHEN p_decision = 'APPROVED'
           THEN p_authority_version_id ELSE "currentAuthorityVersionId" END,
         "pendingAuthorityVersionId" = NULL,
         "authorityRevision" = p_expected_head_revision + 1,
         "updatedAt" = v_created_at
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "id" = v_head.id
     AND "authorityRevision" = p_expected_head_revision
     AND "pendingAuthorityVersionId" = p_authority_version_id
     AND "pendingVersionId" IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_HEAD_STALE: authority head changed during decision'
      USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('obrasaas.project_contract_authority_write_scope', '', true);

  RETURN QUERY SELECT *
    FROM "obrasaas_project_contract_authority_decide_result"(v_decision_id, false);
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_sov_candidate"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_authority_version_id TEXT,
  p_contract_reference TEXT,
  p_title TEXT,
  p_counterparty_label TEXT,
  p_effective_from DATE,
  p_currency_code TEXT,
  p_currency_minor_units INTEGER,
  p_retention_bps INTEGER,
  p_rounding_policy_version TEXT,
  p_adjustment_policy_version TEXT,
  p_lines JSONB,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  head_id TEXT,
  current_version_id TEXT,
  latest_version_id TEXT,
  pending_version_id TEXT,
  head_revision INTEGER,
  authority_revision INTEGER,
  line_count INTEGER,
  valued_line_count INTEGER,
  no_claim_line_count INTEGER,
  total_contract_amount_minor BIGINT,
  candidate_sha256 TEXT,
  internal_lines JSONB,
  readiness TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_head RECORD;
  v_authority RECORD;
  v_task_count INTEGER;
  v_line_count INTEGER;
  v_valued_count INTEGER;
  v_no_claim_count INTEGER;
  v_total_numeric NUMERIC;
  v_total BIGINT;
  v_internal JSONB;
  v_candidate TEXT;
  v_readiness TEXT;
BEGIN
  IF p_organization_id IS NULL OR p_project_id IS NULL
    OR p_authority_version_id IS NULL OR p_actor_membership_id IS NULL
    OR p_contract_reference IS NULL OR length(btrim(p_contract_reference)) NOT BETWEEN 1 AND 120
    OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 240
    OR p_counterparty_label IS NULL OR length(btrim(p_counterparty_label)) NOT BETWEEN 1 AND 240
    OR p_effective_from IS NULL
    OR p_currency_code NOT IN ('ARS', 'USD')
    OR p_currency_minor_units IS DISTINCT FROM 2
    OR p_retention_bps IS NULL OR p_retention_bps NOT BETWEEN 0 AND 10000
    OR p_rounding_policy_version IS DISTINCT FROM 'CERT_RETENTION_HALF_UP_V1'
    OR p_adjustment_policy_version IS DISTINCT FROM 'NONE'
    OR p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'invalid explicit SOV identity, currency, retention, policy or lines'
      USING ERRCODE = '22023';
  END IF;

  SELECT h."id", h."currentAuthorityVersionId", h."pendingAuthorityVersionId",
         h."authorityRevision", h."currentVersionId", h."latestVersionId",
         h."pendingVersionId", h."revision"
    INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_head."currentVersionId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "ProjectContractVersion" current_version
     WHERE current_version."organizationId" = p_organization_id
       AND current_version."projectId" = p_project_id
       AND current_version."headId" = v_head.id
       AND current_version."id" = v_head."currentVersionId"
       AND (
         current_version."currencyCode" IS DISTINCT FROM p_currency_code
         OR current_version."currencyMinorUnits" IS DISTINCT FROM p_currency_minor_units
       )
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_CURRENCY_IMMUTABLE: approved contract currency cannot change; FX is unsupported'
      USING ERRCODE = '23514';
  END IF;

  SELECT a."certifierMembershipId", a."financeMembershipId", a."registrarMembershipId"
    INTO v_authority
    FROM "ProjectContractAuthorityVersion" a
    JOIN "ProjectContractAuthorityDecision" d
      ON d."organizationId" = a."organizationId"
     AND d."projectId" = a."projectId"
     AND d."headId" = a."headId"
     AND d."authorityVersionId" = a."id"
     AND d."decision" = 'APPROVED'
   WHERE a."organizationId" = p_organization_id
     AND a."projectId" = p_project_id
     AND a."headId" = v_head.id
     AND a."id" = p_authority_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_head."currentAuthorityVersionId" IS DISTINCT FROM p_authority_version_id THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AUTHORITY_STALE: SOV must bind the exact current approved authority version'
      USING ERRCODE = '40001';
  END IF;
  IF p_actor_membership_id IS DISTINCT FROM v_authority."certifierMembershipId"
    OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."financeMembershipId", 'FINANCE'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
    ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_PREPARER_FORBIDDEN: only the exact ACTIVE certifier may prepare SOV while all authorities remain valid'
      USING ERRCODE = '42501';
  END IF;

  v_readiness := CASE
    WHEN v_head."pendingAuthorityVersionId" IS NOT NULL THEN 'AUTHORITY_PENDING'
    WHEN v_head."pendingVersionId" IS NOT NULL THEN 'CONTRACT_PENDING'
    ELSE 'READY'
  END;

  SELECT count(*)::INTEGER INTO v_task_count
    FROM "Task" t
   WHERE t."projectId" = p_project_id
     AND t."type" = 'TASK'
     AND t."metadata" ->> 'source' = 'canonical-task-v1';
  IF v_task_count < 1 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_EMPTY: at least one canonical task is required'
      USING ERRCODE = '23514';
  END IF;
  IF v_task_count > 5000 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TOO_LARGE: canonical task count exceeds 5000; the SOV is never truncated'
      USING ERRCODE = '54000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_lines) supplied(value)
     WHERE jsonb_typeof(supplied.value) <> 'object'
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) supplied(value)
      CROSS JOIN LATERAL jsonb_object_keys(supplied.value) key(name)
     WHERE key.name NOT IN (
       'taskId', 'state', 'unitCode', 'baseQuantity',
       'contractAmountMinor', 'noClaimReason'
     )
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_LINE_SHAPE_INVALID: line objects contain unsupported fields'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::INTEGER INTO v_line_count FROM jsonb_array_elements(p_lines);
  IF v_line_count <> v_task_count THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_COVERAGE_INVALID: SOV must include every canonical task exactly once'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) supplied(value)
     GROUP BY supplied.value ->> 'taskId'
    HAVING supplied.value ->> 'taskId' IS NULL OR count(*) <> 1
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) supplied(value)
      LEFT JOIN "Task" t
        ON t."projectId" = p_project_id
       AND t."id" = supplied.value ->> 'taskId'
       AND t."type" = 'TASK'
       AND t."metadata" ->> 'source' = 'canonical-task-v1'
     WHERE t."id" IS NULL
  ) OR EXISTS (
    SELECT 1
      FROM "Task" t
      LEFT JOIN jsonb_array_elements(p_lines) supplied(value)
        ON supplied.value ->> 'taskId' = t."id"
     WHERE t."projectId" = p_project_id
       AND t."type" = 'TASK'
       AND t."metadata" ->> 'source' = 'canonical-task-v1'
       AND supplied.value IS NULL
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_COVERAGE_INVALID: unknown, duplicate or missing canonical task'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) supplied(value)
     WHERE supplied.value ->> 'state' NOT IN ('VALUED', 'NO_CLAIM')
       OR (
         supplied.value ->> 'state' = 'VALUED'
         AND (
           supplied.value ->> 'unitCode' NOT IN ('M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT')
           OR supplied.value ->> 'baseQuantity' IS NULL
           OR supplied.value ->> 'baseQuantity' !~ '^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$'
           OR (supplied.value ->> 'baseQuantity')::NUMERIC <= 0
           OR supplied.value ->> 'contractAmountMinor' IS NULL
           OR supplied.value ->> 'contractAmountMinor' !~ '^[1-9][0-9]{0,18}$'
           OR (supplied.value ->> 'contractAmountMinor')::NUMERIC > 9223372036854775807
           OR supplied.value ->> 'noClaimReason' IS NOT NULL
         )
       )
       OR (
         supplied.value ->> 'state' = 'NO_CLAIM'
         AND (
           supplied.value ->> 'unitCode' IS NOT NULL
           OR supplied.value ->> 'baseQuantity' IS NOT NULL
           OR supplied.value ->> 'contractAmountMinor' IS NOT NULL
           OR supplied.value ->> 'noClaimReason' IS NULL
           OR length(btrim(supplied.value ->> 'noClaimReason')) NOT BETWEEN 1 AND 1000
         )
       )
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_LINE_VALUE_INVALID: VALUED and NO_CLAIM shapes are exact and explicit'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) supplied(value)
      JOIN "TaskProgressMeasurementBalance" b
        ON b."organizationId" = p_organization_id
       AND b."projectId" = p_project_id
       AND b."taskId" = supplied.value ->> 'taskId'
     WHERE supplied.value ->> 'state' = 'VALUED'
       AND (
         b."unitCode"::TEXT IS DISTINCT FROM supplied.value ->> 'unitCode'
         OR b."baseQuantity" IS DISTINCT FROM
           (supplied.value ->> 'baseQuantity')::NUMERIC(18,4)
       )
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TECHNICAL_BASIS_MISMATCH: existing technical unit/base conflicts with SOV'
      USING ERRCODE = '23514';
  END IF;

  WITH raw AS (
    SELECT supplied.value, supplied.ordinality::INTEGER AS input_ordinal
      FROM jsonb_array_elements(p_lines) WITH ORDINALITY supplied(value, ordinality)
  ), normalized AS (
    SELECT
      row_number() OVER (ORDER BY t."id")::INTEGER AS ordinal,
      t."id" AS task_id,
      t."code" AS task_code,
      t."title" AS task_title,
      t."revision" AS task_revision,
      raw.value ->> 'state' AS line_state,
      CASE WHEN raw.value ->> 'state' = 'VALUED'
        THEN raw.value ->> 'unitCode' ELSE NULL END AS unit_code,
      CASE WHEN raw.value ->> 'state' = 'VALUED'
        THEN (raw.value ->> 'baseQuantity')::NUMERIC(18,4) ELSE NULL END AS base_quantity,
      CASE WHEN raw.value ->> 'state' = 'VALUED'
        THEN (raw.value ->> 'contractAmountMinor')::BIGINT ELSE NULL END AS contract_amount_minor,
      CASE WHEN raw.value ->> 'state' = 'NO_CLAIM'
        THEN btrim(raw.value ->> 'noClaimReason') ELSE NULL END AS no_claim_reason,
      CASE WHEN raw.value ->> 'state' = 'VALUED' THEN
        CASE WHEN b."id" IS NULL THEN 'UNESTABLISHED' ELSE 'MATCHED' END
        ELSE NULL END AS technical_basis_status
    FROM raw
    JOIN "Task" t
      ON t."projectId" = p_project_id
     AND t."id" = raw.value ->> 'taskId'
     AND t."type" = 'TASK'
     AND t."metadata" ->> 'source' = 'canonical-task-v1'
    LEFT JOIN "TaskProgressMeasurementBalance" b
      ON b."organizationId" = p_organization_id
     AND b."projectId" = p_project_id
     AND b."taskId" = t."id"
  ), hashed AS (
    SELECT normalized.*,
      "obrasaas_project_contract_line_sha"(
        line_state, task_id, task_code, task_title, task_revision,
        unit_code, base_quantity, contract_amount_minor, no_claim_reason,
        technical_basis_status
      ) AS line_sha256
    FROM normalized
  )
  SELECT
    count(*) FILTER (WHERE line_state = 'VALUED')::INTEGER,
    count(*) FILTER (WHERE line_state = 'NO_CLAIM')::INTEGER,
    COALESCE(sum(contract_amount_minor::NUMERIC), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'ordinal', ordinal,
      'state', line_state,
      'task_id', task_id,
      'task_code', task_code,
      'task_title', task_title,
      'task_revision', task_revision,
      'unit_code', unit_code,
      'base_quantity', CASE WHEN base_quantity IS NULL THEN NULL
        ELSE to_char(base_quantity, 'FM99999999999999.0000') END,
      'contract_amount_minor', CASE WHEN contract_amount_minor IS NULL THEN NULL
        ELSE contract_amount_minor::TEXT END,
      'no_claim_reason', no_claim_reason,
      'technical_basis_status', technical_basis_status,
      'line_sha256', line_sha256
    ) ORDER BY task_id), '[]'::JSONB)
    INTO v_valued_count, v_no_claim_count, v_total_numeric, v_internal
    FROM hashed;

  IF v_valued_count < 1 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_NO_VALUED_LINES: at least one task must be VALUED'
      USING ERRCODE = '23514';
  END IF;
  IF v_total_numeric < 1 OR v_total_numeric > 9223372036854775807 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_AMOUNT_OVERFLOW: exact NUMERIC sum does not fit positive BIGINT'
      USING ERRCODE = '22003';
  END IF;
  v_total := v_total_numeric::BIGINT;
  v_candidate := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-sov-candidate-v1',
    p_organization_id,
    p_project_id,
    p_authority_version_id,
    v_head."authorityRevision",
    v_head."currentVersionId",
    v_head."latestVersionId",
    v_head."revision",
    btrim(p_contract_reference),
    btrim(p_title),
    btrim(p_counterparty_label),
    to_char(p_effective_from, 'YYYY-MM-DD'),
    p_currency_code,
    p_currency_minor_units,
    p_retention_bps,
    p_rounding_policy_version,
    p_adjustment_policy_version,
    v_total::TEXT,
    (SELECT COALESCE(jsonb_agg(jsonb_build_array(
      value ->> 'task_id', value ->> 'line_sha256'
    ) ORDER BY value ->> 'task_id'), '[]'::JSONB)
      FROM jsonb_array_elements(v_internal) lines(value))
  )::TEXT, 'UTF8')), 'hex');

  RETURN QUERY SELECT
    v_head.id::TEXT,
    v_head."currentVersionId"::TEXT,
    v_head."latestVersionId"::TEXT,
    v_head."pendingVersionId"::TEXT,
    v_head.revision::INTEGER,
    v_head."authorityRevision"::INTEGER,
    v_task_count,
    v_valued_count,
    v_no_claim_count,
    v_total,
    v_candidate,
    v_internal,
    v_readiness;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_prepare_result"(
  p_contract_version_id TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE(
  contract_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  contract_version INTEGER,
  contract_sha256 TEXT,
  total_contract_amount_minor BIGINT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT v."id", v."organizationId", v."projectId", v."version",
         v."contractSha256"::TEXT, v."totalContractAmountMinor",
         v."preparedByMembershipId", v."headRevisionAtPrepare" + 1, p_replayed
    FROM "ProjectContractVersion" v
   WHERE v."id" = p_contract_version_id;
$$;

-- Exact prepare retries are resolved before consulting the mutable live task
-- candidate. This preserves idempotency after approval/rotation/task changes,
-- without making a replay an authorization bypass.
CREATE FUNCTION "obrasaas_project_contract_prepare_replay"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_authority_version_id TEXT,
  p_expected_authority_revision INTEGER,
  p_expected_current_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_contract_reference TEXT,
  p_title TEXT,
  p_counterparty_label TEXT,
  p_effective_from DATE,
  p_currency_code TEXT,
  p_currency_minor_units INTEGER,
  p_retention_bps INTEGER,
  p_rounding_policy_version TEXT,
  p_adjustment_policy_version TEXT,
  p_lines JSONB,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  contract_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  contract_version INTEGER,
  contract_sha256 TEXT,
  total_contract_amount_minor BIGINT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_expected_candidate TEXT;
  v_existing RECORD;
  v_authority RECORD;
  v_input_lines_match BOOLEAN;
  v_line_digests JSONB;
BEGIN
  IF p_authority_version_id IS NULL
    OR p_expected_authority_revision IS NULL OR p_expected_authority_revision < 2
    OR p_expected_head_revision IS NULL OR p_expected_head_revision < 0
    OR p_contract_reference IS NULL OR length(btrim(p_contract_reference)) NOT BETWEEN 1 AND 120
    OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 240
    OR p_counterparty_label IS NULL OR length(btrim(p_counterparty_label)) NOT BETWEEN 1 AND 240
    OR p_effective_from IS NULL
    OR p_currency_code NOT IN ('ARS', 'USD') OR p_currency_minor_units IS DISTINCT FROM 2
    OR p_retention_bps IS NULL OR p_retention_bps NOT BETWEEN 0 AND 10000
    OR p_rounding_policy_version IS DISTINCT FROM 'CERT_RETENTION_HALF_UP_V1'
    OR p_adjustment_policy_version IS DISTINCT FROM 'NONE'
    OR p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid SOV replay lookup input'
      USING ERRCODE = '22023';
  END IF;
  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'DIRECTOR'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_PREPARER_FORBIDDEN: replay requires an ACTIVE DIRECTOR with project access'
      USING ERRCODE = '42501';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  SELECT v."id", v."projectId", v."predecessorId", v."authorityVersionId",
         v."authorityRevisionAtPrepare", v."contractReference", v.title,
         v."counterpartyLabel", v."effectiveFrom", v."currencyCode",
         v."currencyMinorUnits", v."retentionBps", v."roundingPolicyVersion",
         v."adjustmentPolicyVersion", v."lineCount", v."totalContractAmountMinor",
         v."candidateSha256"::TEXT AS candidate_sha256,
         v."headRevisionAtPrepare", v."preparedByMembershipId",
         v."requestFingerprint"::TEXT AS request_fingerprint
    INTO v_existing
    FROM "ProjectContractVersion" v
   WHERE v."organizationId" = p_organization_id
     AND v."operationKeyHash" = v_operation_hash;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT a."certifierMembershipId", a."financeMembershipId", a."registrarMembershipId"
    INTO v_authority
    FROM "ProjectContractAuthorityVersion" a
    JOIN "ProjectContractAuthorityDecision" d
      ON d."organizationId" = a."organizationId"
     AND d."projectId" = a."projectId"
     AND d."headId" = a."headId"
     AND d."authorityVersionId" = a."id"
     AND d."decision" = 'APPROVED'
   WHERE a."organizationId" = p_organization_id
     AND a."projectId" = p_project_id
     AND a."id" = v_existing."authorityVersionId";
  IF NOT FOUND
    OR p_actor_membership_id IS DISTINCT FROM v_authority."certifierMembershipId"
    OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."financeMembershipId", 'FINANCE'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
    ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_PREPARER_FORBIDDEN: replay requires the exact ACTIVE certifier and authority memberships'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_lines) supplied(value)
     WHERE jsonb_typeof(supplied.value) <> 'object'
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) supplied(value)
      CROSS JOIN LATERAL jsonb_object_keys(supplied.value) key(name)
     WHERE key.name NOT IN (
       'taskId', 'state', 'unitCode', 'baseQuantity',
       'contractAmountMinor', 'noClaimReason'
     )
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT: operation key was reused with another SOV request'
      USING ERRCODE = '22000';
  END IF;

  WITH supplied AS (
    SELECT value ->> 'taskId' AS task_id,
           value ->> 'state' AS state,
           value ->> 'unitCode' AS unit_code,
           value ->> 'baseQuantity' AS base_quantity,
           value ->> 'contractAmountMinor' AS contract_amount_minor,
           value ->> 'noClaimReason' AS no_claim_reason
      FROM jsonb_array_elements(p_lines) lines(value)
  ), matched AS (
    SELECT s.*, l."taskId" AS stored_task_id
      FROM supplied s
      LEFT JOIN "ProjectContractLine" l
        ON l."organizationId" = p_organization_id
       AND l."projectId" = p_project_id
       AND l."contractVersionId" = v_existing.id
       AND l."taskId" = s.task_id
     WHERE l."taskId" IS NULL
        OR l."state"::TEXT IS DISTINCT FROM s.state
        OR (l."state" = 'VALUED' AND (
          s.unit_code IS DISTINCT FROM l."unitCode"::TEXT
          OR s.base_quantity IS NULL
          OR s.base_quantity !~ '^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$'
          OR CASE WHEN s.base_quantity ~ '^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$'
               THEN s.base_quantity::NUMERIC(18,4) END IS DISTINCT FROM l."baseQuantity"
          OR s.contract_amount_minor IS NULL
          OR s.contract_amount_minor !~ '^[1-9][0-9]{0,18}$'
          OR CASE WHEN s.contract_amount_minor ~ '^[1-9][0-9]{0,18}$'
               THEN s.contract_amount_minor::NUMERIC END IS DISTINCT FROM l."contractAmountMinor"::NUMERIC
          OR s.no_claim_reason IS NOT NULL
        ))
        OR (l."state" = 'NO_CLAIM' AND (
          s.unit_code IS NOT NULL OR s.base_quantity IS NOT NULL
          OR s.contract_amount_minor IS NOT NULL
          OR btrim(s.no_claim_reason) IS DISTINCT FROM l."noClaimReason"
        ))
  )
  SELECT count(*) = v_existing."lineCount"
     AND count(DISTINCT supplied.task_id) = v_existing."lineCount"
     AND NOT EXISTS (SELECT 1 FROM matched)
    INTO v_input_lines_match
    FROM supplied;

  SELECT COALESCE(jsonb_agg(jsonb_build_array(
           l."taskId", l."lineSha256"::TEXT
         ) ORDER BY l."taskId"), '[]'::JSONB)
    INTO v_line_digests
    FROM "ProjectContractLine" l
   WHERE l."organizationId" = p_organization_id
     AND l."projectId" = p_project_id
     AND l."contractVersionId" = v_existing.id;

  v_expected_candidate := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-sov-candidate-v1',
    p_organization_id,
    p_project_id,
    p_authority_version_id,
    p_expected_authority_revision,
    p_expected_current_version_id,
    v_existing."predecessorId",
    p_expected_head_revision,
    btrim(p_contract_reference),
    btrim(p_title),
    btrim(p_counterparty_label),
    to_char(p_effective_from, 'YYYY-MM-DD'),
    p_currency_code,
    p_currency_minor_units,
    p_retention_bps,
    p_rounding_policy_version,
    p_adjustment_policy_version,
    v_existing."totalContractAmountMinor"::TEXT,
    v_line_digests
  )::TEXT, 'UTF8')), 'hex');

  IF v_existing."projectId" IS DISTINCT FROM p_project_id
    OR v_existing."authorityVersionId" IS DISTINCT FROM p_authority_version_id
    OR v_existing."authorityRevisionAtPrepare" IS DISTINCT FROM p_expected_authority_revision
    OR v_existing."headRevisionAtPrepare" IS DISTINCT FROM p_expected_head_revision
    OR v_existing."contractReference" IS DISTINCT FROM btrim(p_contract_reference)
    OR v_existing.title IS DISTINCT FROM btrim(p_title)
    OR v_existing."counterpartyLabel" IS DISTINCT FROM btrim(p_counterparty_label)
    OR v_existing."effectiveFrom" IS DISTINCT FROM p_effective_from
    OR v_existing."currencyCode" IS DISTINCT FROM p_currency_code
    OR v_existing."currencyMinorUnits" IS DISTINCT FROM p_currency_minor_units
    OR v_existing."retentionBps" IS DISTINCT FROM p_retention_bps
    OR v_existing."roundingPolicyVersion" IS DISTINCT FROM p_rounding_policy_version
    OR v_existing."adjustmentPolicyVersion" IS DISTINCT FROM p_adjustment_policy_version
    OR v_existing.candidate_sha256 IS DISTINCT FROM v_expected_candidate
    OR NOT COALESCE(v_input_lines_match, false)
    OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint
    OR v_existing."preparedByMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT: operation key was reused with another SOV request'
      USING ERRCODE = '22000';
  END IF;

  RETURN QUERY SELECT *
    FROM "obrasaas_project_contract_prepare_result"(v_existing.id, true);
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_decide_result"(
  p_decision_id TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE(
  decision_id TEXT,
  contract_version_id TEXT,
  decision "ProjectContractDecisionType",
  decided_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT d."id", d."contractVersionId", d."decision",
         d."decidedByMembershipId", d."headRevisionAfter", p_replayed
    FROM "ProjectContractDecision" d
   WHERE d."id" = p_decision_id;
$$;

CREATE VIEW "ObrasaasProjectContractPrepareCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::TEXT AS "authorityVersionId",
  NULL::INTEGER AS "expectedAuthorityRevision",
  NULL::TEXT AS "expectedCurrentVersionId",
  NULL::INTEGER AS "expectedHeadRevision",
  NULL::TEXT AS "expectedCandidateSha256",
  NULL::TEXT AS "contractReference",
  NULL::TEXT AS "title",
  NULL::TEXT AS "counterpartyLabel",
  NULL::DATE AS "effectiveFrom",
  NULL::TEXT AS "currencyCode",
  NULL::INTEGER AS "currencyMinorUnits",
  NULL::INTEGER AS "retentionBps",
  NULL::TEXT AS "roundingPolicyVersion",
  NULL::TEXT AS "adjustmentPolicyVersion",
  NULL::JSONB AS "linesInput",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::TEXT AS "contractVersionId",
  NULL::INTEGER AS "contractVersion",
  NULL::TEXT AS "contractSha256",
  NULL::BIGINT AS "totalContractAmountMinor",
  NULL::TEXT AS "preparedByMembershipId",
  NULL::INTEGER AS "headRevision",
  NULL::BOOLEAN AS "replayed"
WHERE FALSE;

CREATE VIEW "ObrasaasProjectContractDecideCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::TEXT AS "contractVersionId",
  NULL::INTEGER AS "expectedHeadRevision",
  NULL::TEXT AS "expectedContractSha256",
  NULL::TEXT AS "decisionInput",
  NULL::TEXT AS "reason",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::TEXT AS "decisionId",
  NULL::TEXT AS "decidedByMembershipId",
  NULL::INTEGER AS "headRevision",
  NULL::BOOLEAN AS "replayed"
WHERE FALSE;

CREATE FUNCTION "obrasaas_project_contract_prepare_command"()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF TG_OP <> 'INSERT' OR pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract prepare requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_result
    FROM "obrasaas_project_contract_prepare_worker"(
      NEW."organizationId", NEW."projectId", NEW."authorityVersionId",
      NEW."expectedAuthorityRevision", NEW."expectedCurrentVersionId",
      NEW."expectedHeadRevision", NEW."expectedCandidateSha256",
      NEW."contractReference", NEW."title", NEW."counterpartyLabel",
      NEW."effectiveFrom", NEW."currencyCode", NEW."currencyMinorUnits",
      NEW."retentionBps", NEW."roundingPolicyVersion",
      NEW."adjustmentPolicyVersion", NEW."linesInput",
      NEW."operationKey", NEW."requestFingerprint", NEW."actorMembershipId"
    );
  NEW."contractVersionId" := v_result.contract_version_id;
  NEW."organizationId" := v_result.organization_id;
  NEW."projectId" := v_result.project_id;
  NEW."contractVersion" := v_result.contract_version;
  NEW."contractSha256" := v_result.contract_sha256;
  NEW."totalContractAmountMinor" := v_result.total_contract_amount_minor;
  NEW."preparedByMembershipId" := v_result.prepared_by_membership_id;
  NEW."headRevision" := v_result.head_revision;
  NEW."replayed" := v_result.replayed;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_decide_command"()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF TG_OP <> 'INSERT' OR pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract decision requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_result
    FROM "obrasaas_project_contract_decide_worker"(
      NEW."organizationId", NEW."projectId", NEW."contractVersionId",
      NEW."expectedHeadRevision", NEW."expectedContractSha256",
      NEW."decisionInput", NEW."reason", NEW."operationKey",
      NEW."requestFingerprint", NEW."actorMembershipId"
    );
  NEW."decisionId" := v_result.decision_id;
  NEW."contractVersionId" := v_result.contract_version_id;
  NEW."decisionInput" := v_result.decision::TEXT;
  NEW."decidedByMembershipId" := v_result.decided_by_membership_id;
  NEW."headRevision" := v_result.head_revision;
  NEW."replayed" := v_result.replayed;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ObrasaasProjectContractPrepareCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProjectContractPrepareCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_prepare_command"();
CREATE TRIGGER "ObrasaasProjectContractDecideCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProjectContractDecideCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_decide_command"();

CREATE FUNCTION "obrasaas_project_contract_prepare"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_authority_version_id TEXT,
  p_expected_authority_revision INTEGER,
  p_expected_current_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_candidate_sha256 TEXT,
  p_contract_reference TEXT,
  p_title TEXT,
  p_counterparty_label TEXT,
  p_effective_from DATE,
  p_currency_code TEXT,
  p_currency_minor_units INTEGER,
  p_retention_bps INTEGER,
  p_rounding_policy_version TEXT,
  p_adjustment_policy_version TEXT,
  p_lines JSONB,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  contract_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  contract_version INTEGER,
  contract_sha256 TEXT,
  total_contract_amount_minor BIGINT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO "ObrasaasProjectContractPrepareCommand" AS command (
    "organizationId", "projectId", "authorityVersionId",
    "expectedAuthorityRevision", "expectedCurrentVersionId", "expectedHeadRevision",
    "expectedCandidateSha256", "contractReference", "title", "counterpartyLabel",
    "effectiveFrom", "currencyCode", "currencyMinorUnits", "retentionBps",
    "roundingPolicyVersion", "adjustmentPolicyVersion", "linesInput",
    "operationKey", "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_authority_version_id,
    p_expected_authority_revision, p_expected_current_version_id,
    p_expected_head_revision, p_expected_candidate_sha256,
    p_contract_reference, p_title, p_counterparty_label, p_effective_from,
    p_currency_code, p_currency_minor_units, p_retention_bps,
    p_rounding_policy_version, p_adjustment_policy_version, p_lines,
    p_operation_key, p_request_fingerprint, p_actor_membership_id
  ) RETURNING
    command."contractVersionId", command."organizationId", command."projectId",
    command."contractVersion", command."contractSha256",
    command."totalContractAmountMinor", command."preparedByMembershipId",
    command."headRevision", command."replayed";
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_decide"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_contract_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_contract_sha256 TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  decision_id TEXT,
  contract_version_id TEXT,
  decision "ProjectContractDecisionType",
  decided_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO "ObrasaasProjectContractDecideCommand" AS command (
    "organizationId", "projectId", "contractVersionId", "expectedHeadRevision",
    "expectedContractSha256", "decisionInput", "reason", "operationKey",
    "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_contract_version_id,
    p_expected_head_revision, p_expected_contract_sha256, p_decision,
    p_reason, p_operation_key, p_request_fingerprint, p_actor_membership_id
  ) RETURNING
    command."decisionId", command."contractVersionId",
    command."decisionInput"::"ProjectContractDecisionType",
    command."decidedByMembershipId", command."headRevision", command."replayed";
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_prepare_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_authority_version_id TEXT,
  p_expected_authority_revision INTEGER,
  p_expected_current_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_candidate_sha256 TEXT,
  p_contract_reference TEXT,
  p_title TEXT,
  p_counterparty_label TEXT,
  p_effective_from DATE,
  p_currency_code TEXT,
  p_currency_minor_units INTEGER,
  p_retention_bps INTEGER,
  p_rounding_policy_version TEXT,
  p_adjustment_policy_version TEXT,
  p_lines JSONB,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  contract_version_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  contract_version INTEGER,
  contract_sha256 TEXT,
  total_contract_amount_minor BIGINT,
  prepared_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_existing RECORD;
  v_head RECORD;
  v_candidate RECORD;
  v_contract_id TEXT := gen_random_uuid()::TEXT;
  v_contract_version INTEGER;
  v_contract_sha TEXT;
  v_created_at TIMESTAMP(3) := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_scope TEXT;
  v_rows INTEGER;
  v_task_id TEXT;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract prepare worker requires the governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  IF p_authority_version_id IS NULL
    OR p_expected_authority_revision IS NULL OR p_expected_authority_revision < 2
    OR p_expected_head_revision IS NULL OR p_expected_head_revision < 0
    OR p_expected_candidate_sha256 IS NULL
    OR p_expected_candidate_sha256 !~ '^[a-f0-9]{64}$'
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid SOV prepare CAS, digest or idempotency input'
      USING ERRCODE = '22023';
  END IF;
  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:prepare:' || p_organization_id || ':' || v_operation_hash, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));

  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'DIRECTOR'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_PREPARER_FORBIDDEN: SOV preparer must be ACTIVE DIRECTOR with project access'
      USING ERRCODE = '42501';
  END IF;

  SELECT v."id", v."projectId", v."authorityVersionId", v."predecessorId",
         v."contractReference", v.title, v."counterpartyLabel", v."effectiveFrom",
         v."currencyCode", v."currencyMinorUnits", v."retentionBps",
         v."roundingPolicyVersion", v."candidateSha256"::TEXT AS candidate_sha,
         v."adjustmentPolicyVersion",
         v."preparedByMembershipId", v."requestFingerprint"::TEXT AS request_fingerprint
    INTO v_existing
    FROM "ProjectContractVersion" v
   WHERE v."organizationId" = p_organization_id
     AND v."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."authorityVersionId" IS DISTINCT FROM p_authority_version_id
      OR v_existing."contractReference" IS DISTINCT FROM btrim(p_contract_reference)
      OR v_existing.title IS DISTINCT FROM btrim(p_title)
      OR v_existing."counterpartyLabel" IS DISTINCT FROM btrim(p_counterparty_label)
      OR v_existing."effectiveFrom" IS DISTINCT FROM p_effective_from
      OR v_existing."currencyCode" IS DISTINCT FROM p_currency_code
      OR v_existing."currencyMinorUnits" IS DISTINCT FROM p_currency_minor_units
      OR v_existing."retentionBps" IS DISTINCT FROM p_retention_bps
      OR v_existing."roundingPolicyVersion" IS DISTINCT FROM p_rounding_policy_version
      OR v_existing."adjustmentPolicyVersion" IS DISTINCT FROM p_adjustment_policy_version
      OR v_existing."preparedByMembershipId" IS DISTINCT FROM p_actor_membership_id
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT: operation key was reused with another SOV request'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT *
      FROM "obrasaas_project_contract_prepare_result"(v_existing.id, true);
    RETURN;
  END IF;

  SELECT h."id", h."currentAuthorityVersionId", h."pendingAuthorityVersionId",
         h."authorityRevision", h."currentVersionId", h."latestVersionId",
         h."pendingVersionId", h."revision"
    INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
    FROM "ProjectContractAuthorityVersion" a
    JOIN "ProjectContractAuthorityDecision" d
      ON d."organizationId" = a."organizationId"
     AND d."projectId" = a."projectId"
     AND d."headId" = a."headId"
     AND d."authorityVersionId" = a."id"
     AND d."decision" = 'APPROVED'
   WHERE a."organizationId" = p_organization_id
     AND a."projectId" = p_project_id
     AND a."headId" = v_head.id
     AND a."id" = p_authority_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_BLOCKED_BY_PENDING_AUTHORITY: decide authority rotation first'
      USING ERRCODE = '55000';
  END IF;
  IF v_head."currentAuthorityVersionId" IS DISTINCT FROM p_authority_version_id
    OR v_head."authorityRevision" IS DISTINCT FROM p_expected_authority_revision
    OR v_head."currentVersionId" IS DISTINCT FROM p_expected_current_version_id
    OR v_head."revision" IS DISTINCT FROM p_expected_head_revision
    OR v_head."pendingVersionId" IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_HEAD_STALE: authority, current SOV or CAS changed'
      USING ERRCODE = '40001';
  END IF;

  -- S9.1 serializes every task with hash(org:project:task). Acquire the exact
  -- same keys in task-id order before observing technical balances.
  FOR v_task_id IN
    SELECT t."id" FROM "Task" t
     WHERE t."projectId" = p_project_id
       AND t."type" = 'TASK'
       AND t."metadata" ->> 'source' = 'canonical-task-v1'
     ORDER BY t."id"
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_organization_id || ':' || p_project_id || ':' || v_task_id, 0
    ));
  END LOOP;

  SELECT * INTO v_candidate
    FROM "obrasaas_project_contract_sov_candidate"(
      p_organization_id, p_project_id, p_authority_version_id,
      p_contract_reference, p_title, p_counterparty_label, p_effective_from,
      p_currency_code, p_currency_minor_units, p_retention_bps,
      p_rounding_policy_version, p_adjustment_policy_version, p_lines,
      p_actor_membership_id
    );
  IF v_candidate.readiness <> 'READY' THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_NOT_READY: %', v_candidate.readiness
      USING ERRCODE = '55000';
  END IF;
  IF v_candidate.head_revision IS DISTINCT FROM p_expected_head_revision
    OR v_candidate.authority_revision IS DISTINCT FROM p_expected_authority_revision
    OR v_candidate.current_version_id IS DISTINCT FROM p_expected_current_version_id
    OR v_candidate.candidate_sha256 IS DISTINCT FROM p_expected_candidate_sha256 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_CANDIDATE_STALE: SOV candidate changed before prepare'
      USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(max(v."version"), 0) + 1 INTO v_contract_version
    FROM "ProjectContractVersion" v WHERE v."headId" = v_head.id;
  v_contract_sha := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-contract-sov-v1',
    p_organization_id,
    p_project_id,
    v_contract_version,
    v_head."latestVersionId",
    p_authority_version_id,
    p_expected_authority_revision,
    p_expected_candidate_sha256,
    v_candidate.total_contract_amount_minor::TEXT,
    p_actor_membership_id,
    to_char(v_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::TEXT, 'UTF8')), 'hex');

  v_scope := p_organization_id || ':' || p_project_id || ':' || v_head.id;
  PERFORM set_config('obrasaas.project_contract_write_scope', v_scope, true);
  INSERT INTO "ProjectContractVersion" (
    "id", "organizationId", "projectId", "headId", "version", "predecessorId",
    "authorityVersionId", "authorityRevisionAtPrepare", "contractReference",
    "title", "counterpartyLabel", "effectiveFrom", "currencyCode",
    "currencyMinorUnits", "retentionBps", "roundingPolicyVersion", "lineCount",
    "adjustmentPolicyVersion",
    "valuedLineCount", "noClaimLineCount", "totalContractAmountMinor",
    "candidateSha256", "contractSha256", "headRevisionAtPrepare",
    "preparedByMembershipId", "operationKeyHash", "requestFingerprint", "createdAt"
  ) VALUES (
    v_contract_id, p_organization_id, p_project_id, v_head.id, v_contract_version,
    v_head."latestVersionId", p_authority_version_id, p_expected_authority_revision,
    btrim(p_contract_reference), btrim(p_title), btrim(p_counterparty_label),
    p_effective_from, p_currency_code, p_currency_minor_units, p_retention_bps,
    p_rounding_policy_version, v_candidate.line_count, p_adjustment_policy_version,
    v_candidate.valued_line_count, v_candidate.no_claim_line_count,
    v_candidate.total_contract_amount_minor, p_expected_candidate_sha256,
    v_contract_sha, p_expected_head_revision, p_actor_membership_id,
    v_operation_hash, p_request_fingerprint, v_created_at
  );

  INSERT INTO "ProjectContractLine" (
    "id", "organizationId", "projectId", "headId", "contractVersionId",
    "ordinal", "state", "taskId", "taskCode", "taskTitle", "taskRevision",
    "unitCode", "baseQuantity", "contractAmountMinor", "noClaimReason",
    "technicalBasisStatusAtPrepare", "lineSha256", "createdAt"
  )
  SELECT
    gen_random_uuid()::TEXT, p_organization_id, p_project_id, v_head.id,
    v_contract_id, line.ordinal, line.state::"ProjectContractLineState",
    line.task_id, line.task_code, line.task_title, line.task_revision,
    line.unit_code::"ProgressMeasurementUnitCode",
    line.base_quantity::NUMERIC(18,4), line.contract_amount_minor::BIGINT,
    line.no_claim_reason,
    line.technical_basis_status::"ProjectContractTechnicalBasisSnapshot",
    line.line_sha256, v_created_at
  FROM jsonb_to_recordset(v_candidate.internal_lines) AS line(
    ordinal INTEGER,
    state TEXT,
    task_id TEXT,
    task_code TEXT,
    task_title TEXT,
    task_revision INTEGER,
    unit_code TEXT,
    base_quantity TEXT,
    contract_amount_minor TEXT,
    no_claim_reason TEXT,
    technical_basis_status TEXT,
    line_sha256 TEXT
  ) ORDER BY line.ordinal;

  UPDATE "ProjectContractHead"
     SET "latestVersionId" = v_contract_id,
         "pendingVersionId" = v_contract_id,
         "revision" = p_expected_head_revision + 1,
         "updatedAt" = v_created_at
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "id" = v_head.id
     AND "authorityRevision" = p_expected_authority_revision
     AND "currentAuthorityVersionId" = p_authority_version_id
     AND "currentVersionId" IS NOT DISTINCT FROM p_expected_current_version_id
     AND "revision" = p_expected_head_revision
     AND "pendingAuthorityVersionId" IS NULL
     AND "pendingVersionId" IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_HEAD_STALE: SOV head changed during prepare'
      USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('obrasaas.project_contract_write_scope', '', true);

  RETURN QUERY SELECT * FROM "obrasaas_project_contract_prepare_result"(v_contract_id, false);
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_decide_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_contract_version_id TEXT,
  p_expected_head_revision INTEGER,
  p_expected_contract_sha256 TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  decision_id TEXT,
  contract_version_id TEXT,
  decision "ProjectContractDecisionType",
  decided_by_membership_id TEXT,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_existing RECORD;
  v_head RECORD;
  v_contract RECORD;
  v_authority RECORD;
  v_decision_id TEXT := gen_random_uuid()::TEXT;
  v_created_at TIMESTAMP(3) := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_scope TEXT;
  v_rows INTEGER;
  v_task_id TEXT;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project contract decision worker requires the governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  IF p_contract_version_id IS NULL OR p_expected_head_revision IS NULL
    OR p_expected_head_revision < 1
    OR p_expected_contract_sha256 IS NULL
    OR p_expected_contract_sha256 !~ '^[a-f0-9]{64}$'
    OR p_decision NOT IN ('APPROVED', 'REJECTED')
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid SOV decision input' USING ERRCODE = '22023';
  END IF;
  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:decide:' || p_organization_id || ':' || v_operation_hash, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));

  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'FINANCE'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_CHECKER_FORBIDDEN: SOV checker must be ACTIVE FINANCE with project access'
      USING ERRCODE = '42501';
  END IF;

  SELECT d."id", d."projectId", d."contractVersionId", d."decision"::TEXT AS decision_text,
         d."reason", d."contractSha256Snapshot"::TEXT AS contract_sha,
         d."decidedByMembershipId", d."requestFingerprint"::TEXT AS request_fingerprint
    INTO v_existing
    FROM "ProjectContractDecision" d
   WHERE d."organizationId" = p_organization_id
     AND d."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."contractVersionId" IS DISTINCT FROM p_contract_version_id
      OR v_existing.decision_text IS DISTINCT FROM p_decision
      OR v_existing.reason IS DISTINCT FROM btrim(p_reason)
      OR v_existing."decidedByMembershipId" IS DISTINCT FROM p_actor_membership_id
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_DECISION_IDEMPOTENCY_CONFLICT: operation key was reused'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT *
      FROM "obrasaas_project_contract_decide_result"(v_existing.id, true);
    RETURN;
  END IF;

  SELECT h."id", h."currentAuthorityVersionId", h."pendingAuthorityVersionId",
         h."pendingVersionId", h."revision", h."currentVersionId"
    INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract version target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_BLOCKED_BY_PENDING_AUTHORITY: decide authority rotation first'
      USING ERRCODE = '55000';
  END IF;
  SELECT v.* INTO v_contract
    FROM "ProjectContractVersion" v
   WHERE v."organizationId" = p_organization_id
     AND v."projectId" = p_project_id
     AND v."headId" = v_head.id
     AND v."id" = p_contract_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract version target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_head."pendingVersionId" IS DISTINCT FROM p_contract_version_id
    OR v_head.revision IS DISTINCT FROM p_expected_head_revision THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_HEAD_STALE: pending SOV or CAS changed'
      USING ERRCODE = '40001';
  END IF;
  IF v_contract."contractSha256"::TEXT IS DISTINCT FROM p_expected_contract_sha256 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_CANDIDATE_STALE: contract digest changed'
      USING ERRCODE = '40001';
  END IF;

  SELECT a."certifierMembershipId", a."financeMembershipId", a."registrarMembershipId"
    INTO v_authority
    FROM "ProjectContractAuthorityVersion" a
    JOIN "ProjectContractAuthorityDecision" d
      ON d."organizationId" = a."organizationId"
     AND d."projectId" = a."projectId"
     AND d."headId" = a."headId"
     AND d."authorityVersionId" = a."id"
     AND d."decision" = 'APPROVED'
   WHERE a."organizationId" = p_organization_id
     AND a."projectId" = p_project_id
     AND a."headId" = v_head.id
     AND a."id" = v_contract."authorityVersionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_actor_membership_id IS DISTINCT FROM v_authority."financeMembershipId"
    OR p_actor_membership_id = v_contract."preparedByMembershipId"
    OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."financeMembershipId", 'FINANCE'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
    ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_MAKER_CHECKER_REQUIRED: exact ACTIVE finance authority must differ from preparer'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'APPROVED' THEN
    FOR v_task_id IN
      SELECT t."id" FROM "Task" t
       WHERE t."projectId" = p_project_id
         AND t."type" = 'TASK'
         AND t."metadata" ->> 'source' = 'canonical-task-v1'
       ORDER BY t."id"
    LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(
        p_organization_id || ':' || p_project_id || ':' || v_task_id, 0
      ));
    END LOOP;

    IF (SELECT count(*) FROM "ProjectContractLine" l
         WHERE l."contractVersionId" = p_contract_version_id) IS DISTINCT FROM
       (SELECT count(*) FROM "Task" t
         WHERE t."projectId" = p_project_id
           AND t."type" = 'TASK'
           AND t."metadata" ->> 'source' = 'canonical-task-v1')
      OR EXISTS (
        SELECT 1 FROM "ProjectContractLine" l
        LEFT JOIN "Task" t
          ON t."projectId" = l."projectId"
         AND t."id" = l."taskId"
         AND t."type" = 'TASK'
         AND t."metadata" ->> 'source' = 'canonical-task-v1'
         AND t."code" IS NOT DISTINCT FROM l."taskCode"
         AND t."title" = l."taskTitle"
         AND t."revision" = l."taskRevision"
       WHERE l."organizationId" = p_organization_id
         AND l."projectId" = p_project_id
         AND l."contractVersionId" = p_contract_version_id
         AND t."id" IS NULL
      ) THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_TASKS_STALE: canonical task set or revision changed before approval'
        USING ERRCODE = '40001';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM "ProjectContractLine" l
        JOIN "TaskProgressMeasurementBalance" b
          ON b."organizationId" = l."organizationId"
         AND b."projectId" = l."projectId"
         AND b."taskId" = l."taskId"
       WHERE l."organizationId" = p_organization_id
         AND l."projectId" = p_project_id
         AND l."contractVersionId" = p_contract_version_id
         AND l."state" = 'VALUED'
         AND (b."unitCode" <> l."unitCode" OR b."baseQuantity" <> l."baseQuantity")
    ) THEN
      RAISE EXCEPTION 'PROJECT_CONTRACT_TECHNICAL_BASIS_MISMATCH: existing technical unit/base conflicts with SOV'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  v_scope := p_organization_id || ':' || p_project_id || ':' || v_head.id;
  PERFORM set_config('obrasaas.project_contract_write_scope', v_scope, true);
  INSERT INTO "ProjectContractDecision" (
    "id", "organizationId", "projectId", "headId", "contractVersionId",
    "authorityVersionId", "decision", "reason", "expectedHeadRevision",
    "headRevisionAfter", "contractSha256Snapshot", "decidedByMembershipId",
    "operationKeyHash", "requestFingerprint", "createdAt"
  ) VALUES (
    v_decision_id, p_organization_id, p_project_id, v_head.id,
    p_contract_version_id, v_contract."authorityVersionId",
    p_decision::"ProjectContractDecisionType", btrim(p_reason),
    p_expected_head_revision, p_expected_head_revision + 1,
    p_expected_contract_sha256, p_actor_membership_id, v_operation_hash,
    p_request_fingerprint, v_created_at
  );

  UPDATE "ProjectContractHead"
     SET "currentVersionId" = CASE WHEN p_decision = 'APPROVED'
           THEN p_contract_version_id ELSE "currentVersionId" END,
         "pendingVersionId" = NULL,
         "revision" = p_expected_head_revision + 1,
         "updatedAt" = v_created_at
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "id" = v_head.id
     AND "revision" = p_expected_head_revision
     AND "pendingVersionId" = p_contract_version_id
     AND "pendingAuthorityVersionId" IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_HEAD_STALE: SOV head changed during decision'
      USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('obrasaas.project_contract_write_scope', '', true);

  RETURN QUERY SELECT * FROM "obrasaas_project_contract_decide_result"(v_decision_id, false);
END;
$$;

CREATE FUNCTION "obrasaas_project_contract_authority_json"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_actor_membership_id TEXT,
  p_authority_version_id TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN a."id" IS NULL THEN NULL ELSE jsonb_build_object(
    'id', a."id",
    'version', a."version",
    'previousAuthorityVersionId', a."predecessorId",
    'authorities', jsonb_build_object(
      'certifierMembershipId', a."certifierMembershipId",
      'financeMembershipId', a."financeMembershipId",
      'registrarMembershipId', a."registrarMembershipId"
    ),
    'candidateToken', a."candidateSha256"::TEXT,
    'integrityDigest', a."authoritySha256"::TEXT,
    'preparedByMembershipId', a."preparedByMembershipId",
    'preparedAt', to_char(a."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'decision', CASE WHEN d."id" IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d."id",
      'decision', d."decision"::TEXT,
      'reason', d."reason",
      'decidedByMembershipId', d."decidedByMembershipId",
      'decidedAt', to_char(d."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) END
  ) END
  FROM (SELECT p_authority_version_id AS requested_id) requested
  LEFT JOIN "ProjectContractAuthorityVersion" a
    ON a."id" = requested.requested_id
   AND a."organizationId" = p_organization_id
   AND a."projectId" = p_project_id
  LEFT JOIN "ProjectContractAuthorityDecision" d
    ON d."organizationId" = a."organizationId"
   AND d."projectId" = a."projectId"
   AND d."headId" = a."headId"
   AND d."authorityVersionId" = a."id"
  WHERE "obrasaas_project_contract_actor_can_read"(
    p_organization_id, p_project_id, p_actor_membership_id
  );
$$;

CREATE FUNCTION "obrasaas_project_contract_version_json"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_actor_membership_id TEXT,
  p_contract_version_id TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH target AS (
    SELECT v.* FROM "ProjectContractVersion" v
     WHERE v."id" = p_contract_version_id
       AND v."organizationId" = p_organization_id
       AND v."projectId" = p_project_id
       AND "obrasaas_project_contract_actor_can_read"(
         p_organization_id, p_project_id, p_actor_membership_id
       )
  ), lines AS (
    SELECT
      l."contractVersionId",
      COALESCE(jsonb_agg(jsonb_build_object(
        'ordinal', l."ordinal",
        'state', l."state"::TEXT,
        'taskId', l."taskId",
        'taskCode', l."taskCode",
        'taskTitle', l."taskTitle",
        'taskRevision', l."taskRevision",
        'unitCode', l."unitCode"::TEXT,
        'baseQuantity', CASE WHEN l."baseQuantity" IS NULL THEN NULL
          ELSE to_char(l."baseQuantity", 'FM99999999999999.0000') END,
        'contractAmountMinor', CASE WHEN l."contractAmountMinor" IS NULL THEN NULL
          ELSE l."contractAmountMinor"::TEXT END,
        'noClaimReason', l."noClaimReason",
        'technicalBasisStatusAtPrepare', l."technicalBasisStatusAtPrepare"::TEXT,
        'currentTechnicalCompatibility', CASE
          WHEN l."state" = 'NO_CLAIM' THEN NULL
          WHEN b."id" IS NULL THEN 'UNESTABLISHED'
          WHEN b."unitCode" = l."unitCode" AND b."baseQuantity" = l."baseQuantity"
            THEN 'MATCHED'
          ELSE 'MISMATCHED'
        END,
        'integrityDigest', l."lineSha256"::TEXT
      ) ORDER BY l."ordinal"), '[]'::JSONB) AS line_json,
      CASE
        WHEN count(*) FILTER (WHERE l."state" = 'VALUED' AND b."id" IS NOT NULL
          AND (b."unitCode" <> l."unitCode" OR b."baseQuantity" <> l."baseQuantity")) > 0
          THEN 'MISMATCHED'
        WHEN count(*) FILTER (WHERE l."state" = 'VALUED' AND b."id" IS NULL) > 0
          THEN 'UNESTABLISHED'
        ELSE 'MATCHED'
      END AS compatibility
    FROM "ProjectContractLine" l
    LEFT JOIN "TaskProgressMeasurementBalance" b
      ON b."organizationId" = l."organizationId"
     AND b."projectId" = l."projectId"
     AND b."taskId" = l."taskId"
    WHERE l."contractVersionId" = p_contract_version_id
    GROUP BY l."contractVersionId"
  )
  SELECT CASE WHEN v."id" IS NULL THEN NULL ELSE jsonb_build_object(
    'id', v."id",
    'version', v."version",
    'previousContractVersionId', v."predecessorId",
    'authorityVersionId', v."authorityVersionId",
    'contractReference', v."contractReference",
    'title', v."title",
    'counterpartyLabel', v."counterpartyLabel",
    'effectiveFrom', to_char(v."effectiveFrom", 'YYYY-MM-DD'),
    'currencyCode', v."currencyCode",
    'currencyMinorUnits', v."currencyMinorUnits",
    'retentionBps', v."retentionBps",
    'roundingPolicyVersion', v."roundingPolicyVersion",
    'adjustmentPolicyVersion', v."adjustmentPolicyVersion",
    'lineCount', v."lineCount",
    'valuedLineCount', v."valuedLineCount",
    'noClaimLineCount', v."noClaimLineCount",
    'totalContractAmountMinor', v."totalContractAmountMinor"::TEXT,
    'candidateToken', v."candidateSha256"::TEXT,
    'integrityDigest', v."contractSha256"::TEXT,
    'preparedByMembershipId', v."preparedByMembershipId",
    'preparedAt', to_char(v."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'currentTechnicalCompatibility', lines.compatibility,
    's10BlockerCode', CASE WHEN lines.compatibility = 'MISMATCHED'
      THEN 'CONTRACT_TECHNICAL_BASIS_MISMATCH' ELSE NULL END,
    'decision', CASE WHEN d."id" IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d."id",
      'decision', d."decision"::TEXT,
      'reason', d."reason",
      'decidedByMembershipId', d."decidedByMembershipId",
      'decidedAt', to_char(d."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) END,
    'lines', COALESCE(lines.line_json, '[]'::JSONB)
  ) END
  FROM (SELECT p_contract_version_id AS requested_id) requested
  LEFT JOIN target v ON v."id" = requested.requested_id
  LEFT JOIN lines ON lines."contractVersionId" = v."id"
  LEFT JOIN "ProjectContractDecision" d
    ON d."organizationId" = v."organizationId"
   AND d."projectId" = v."projectId"
   AND d."headId" = v."headId"
   AND d."contractVersionId" = v."id";
$$;

CREATE FUNCTION "obrasaas_project_contract_capabilities"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_actor_membership_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_head "ProjectContractHead"%ROWTYPE;
  v_current "ProjectContractAuthorityVersion"%ROWTYPE;
  v_pending_authority "ProjectContractAuthorityVersion"%ROWTYPE;
  v_pending_contract "ProjectContractVersion"%ROWTYPE;
  v_contract_authority "ProjectContractAuthorityVersion"%ROWTYPE;
  v_is_admin BOOLEAN;
  v_current_valid BOOLEAN := false;
  v_contract_authority_valid BOOLEAN := false;
  v_can_propose_authority BOOLEAN := false;
  v_can_decide_authority BOOLEAN := false;
  v_can_prepare_contract BOOLEAN := false;
  v_can_decide_contract BOOLEAN := false;
  v_propose_reason TEXT;
  v_authority_decide_reason TEXT;
  v_prepare_reason TEXT;
  v_contract_decide_reason TEXT;
  v_expected_authority_checker TEXT;
BEGIN
  PERFORM 1
    FROM "Project" p
   WHERE p."organizationId" = p_organization_id
     AND p."id" = p_project_id
     AND p."status" <> 'ARCHIVED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: active tenant-scoped project was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT "obrasaas_project_contract_actor_can_read"(
    p_organization_id, p_project_id, p_actor_membership_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_READ_FORBIDDEN: contract capabilities require an ACTIVE authorized project membership'
      USING ERRCODE = '42501';
  END IF;
  v_is_admin := "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'ADMIN'
  );
  SELECT h.* INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id
     AND h."projectId" = p_project_id;
  IF NOT FOUND THEN
    v_can_propose_authority := v_is_admin;
    v_propose_reason := CASE WHEN v_is_admin THEN NULL
      ELSE 'PROJECT_CONTRACT_AUTHORITY_REGISTRAR_REQUIRED' END;
    RETURN jsonb_build_object(
      'read', jsonb_build_object('allowed', true, 'reasonCode', NULL),
      'proposeAuthority', jsonb_build_object(
        'allowed', v_can_propose_authority,
        'reasonCode', v_propose_reason,
        'expectedActorMembershipId', CASE WHEN v_can_propose_authority
          THEN p_actor_membership_id ELSE NULL END
      ),
      'decideAuthority', jsonb_build_object(
        'allowed', false, 'reasonCode', 'PROJECT_CONTRACT_NO_PENDING_AUTHORITY',
        'expectedActorMembershipId', NULL, 'targetId', NULL
      ),
      'prepareContract', jsonb_build_object(
        'allowed', false, 'reasonCode', 'PROJECT_CONTRACT_AUTHORITY_REQUIRED',
        'expectedActorMembershipId', NULL
      ),
      'decideContract', jsonb_build_object(
        'allowed', false, 'reasonCode', 'PROJECT_CONTRACT_NO_PENDING_VERSION',
        'expectedActorMembershipId', NULL, 'targetId', NULL
      )
    );
  END IF;

  IF v_head."currentAuthorityVersionId" IS NOT NULL THEN
    SELECT a.* INTO v_current
      FROM "ProjectContractAuthorityVersion" a
     WHERE a."organizationId" = p_organization_id
       AND a."projectId" = p_project_id
       AND a."headId" = v_head."id"
       AND a."id" = v_head."currentAuthorityVersionId";
    v_current_valid := v_current."id" IS NOT NULL
      AND "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_current."certifierMembershipId", 'DIRECTOR'
      )
      AND "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_current."financeMembershipId", 'FINANCE'
      )
      AND "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_current."registrarMembershipId", 'ADMIN'
      );
  END IF;
  IF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    SELECT a.* INTO v_pending_authority
      FROM "ProjectContractAuthorityVersion" a
     WHERE a."organizationId" = p_organization_id
       AND a."projectId" = p_project_id
       AND a."headId" = v_head."id"
       AND a."id" = v_head."pendingAuthorityVersionId";
  END IF;
  IF v_head."pendingVersionId" IS NOT NULL THEN
    SELECT v.* INTO v_pending_contract
      FROM "ProjectContractVersion" v
     WHERE v."organizationId" = p_organization_id
       AND v."projectId" = p_project_id
       AND v."headId" = v_head."id"
       AND v."id" = v_head."pendingVersionId";
    SELECT a.* INTO v_contract_authority
      FROM "ProjectContractAuthorityVersion" a
     WHERE a."organizationId" = p_organization_id
       AND a."projectId" = p_project_id
       AND a."headId" = v_head."id"
       AND a."id" = v_pending_contract."authorityVersionId";
    v_contract_authority_valid := v_contract_authority."id" IS NOT NULL
      AND "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_contract_authority."certifierMembershipId", 'DIRECTOR'
      )
      AND "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_contract_authority."financeMembershipId", 'FINANCE'
      )
      AND "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, v_contract_authority."registrarMembershipId", 'ADMIN'
      );
  END IF;

  IF v_head."pendingVersionId" IS NOT NULL THEN
    v_propose_reason := 'PROJECT_CONTRACT_AUTHORITY_BLOCKED_BY_PENDING_CONTRACT';
  ELSIF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    v_propose_reason := 'PROJECT_CONTRACT_AUTHORITY_REVIEW_PENDING';
  ELSIF v_head."currentAuthorityVersionId" IS NULL THEN
    v_can_propose_authority := v_is_admin;
    v_propose_reason := CASE WHEN v_is_admin THEN NULL
      ELSE 'PROJECT_CONTRACT_AUTHORITY_REGISTRAR_REQUIRED' END;
  ELSIF NOT v_current_valid THEN
    v_propose_reason := 'PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED';
  ELSIF p_actor_membership_id IS DISTINCT FROM v_current."registrarMembershipId" THEN
    v_propose_reason := 'PROJECT_CONTRACT_AUTHORITY_ROTATION_FORBIDDEN';
  ELSE
    v_can_propose_authority := true;
  END IF;

  IF v_head."pendingAuthorityVersionId" IS NULL THEN
    v_authority_decide_reason := 'PROJECT_CONTRACT_NO_PENDING_AUTHORITY';
  ELSIF v_head."pendingVersionId" IS NOT NULL THEN
    v_authority_decide_reason := 'PROJECT_CONTRACT_AUTHORITY_BLOCKED_BY_PENDING_CONTRACT';
  ELSIF v_head."currentAuthorityVersionId" IS NOT NULL AND NOT v_current_valid THEN
    v_authority_decide_reason := 'PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED';
  ELSE
    v_expected_authority_checker := CASE
      WHEN v_head."currentAuthorityVersionId" IS NULL
        THEN v_pending_authority."certifierMembershipId"
      ELSE v_current."certifierMembershipId"
    END;
    IF p_actor_membership_id IS DISTINCT FROM v_expected_authority_checker
      OR NOT "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, p_actor_membership_id, 'DIRECTOR'
      ) THEN
      v_authority_decide_reason := 'PROJECT_CONTRACT_AUTHORITY_CHECKER_FORBIDDEN';
    ELSIF p_actor_membership_id = v_pending_authority."preparedByMembershipId" THEN
      v_authority_decide_reason := 'PROJECT_CONTRACT_AUTHORITY_MAKER_CHECKER_REQUIRED';
    ELSE
      v_can_decide_authority := true;
    END IF;
  END IF;

  IF v_head."currentAuthorityVersionId" IS NULL THEN
    v_prepare_reason := 'PROJECT_CONTRACT_AUTHORITY_REQUIRED';
  ELSIF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    v_prepare_reason := 'PROJECT_CONTRACT_AUTHORITY_REVIEW_PENDING';
  ELSIF v_head."pendingVersionId" IS NOT NULL THEN
    v_prepare_reason := 'PROJECT_CONTRACT_REVIEW_PENDING';
  ELSIF NOT v_current_valid THEN
    v_prepare_reason := 'PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED';
  ELSIF p_actor_membership_id IS DISTINCT FROM v_current."certifierMembershipId" THEN
    v_prepare_reason := 'PROJECT_CONTRACT_PREPARER_FORBIDDEN';
  ELSE
    v_can_prepare_contract := true;
  END IF;

  IF v_head."pendingAuthorityVersionId" IS NOT NULL THEN
    v_contract_decide_reason := 'PROJECT_CONTRACT_BLOCKED_BY_PENDING_AUTHORITY';
  ELSIF v_head."pendingVersionId" IS NULL THEN
    v_contract_decide_reason := 'PROJECT_CONTRACT_NO_PENDING_VERSION';
  ELSIF NOT v_contract_authority_valid THEN
    v_contract_decide_reason := 'PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED';
  ELSIF p_actor_membership_id IS DISTINCT FROM v_contract_authority."financeMembershipId"
    OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_actor_membership_id, 'FINANCE'
    ) THEN
    v_contract_decide_reason := 'PROJECT_CONTRACT_CHECKER_FORBIDDEN';
  ELSIF p_actor_membership_id = v_pending_contract."preparedByMembershipId" THEN
    v_contract_decide_reason := 'PROJECT_CONTRACT_MAKER_CHECKER_REQUIRED';
  ELSE
    v_can_decide_contract := true;
  END IF;

  RETURN jsonb_build_object(
    'read', jsonb_build_object('allowed', true, 'reasonCode', NULL),
    'proposeAuthority', jsonb_build_object(
      'allowed', v_can_propose_authority,
      'reasonCode', v_propose_reason,
      'expectedActorMembershipId', CASE
        WHEN v_head."currentAuthorityVersionId" IS NULL AND v_can_propose_authority
          THEN p_actor_membership_id
        ELSE v_current."registrarMembershipId"
      END
    ),
    'decideAuthority', jsonb_build_object(
      'allowed', v_can_decide_authority,
      'reasonCode', v_authority_decide_reason,
      'expectedActorMembershipId', v_expected_authority_checker,
      'targetId', v_head."pendingAuthorityVersionId"
    ),
    'prepareContract', jsonb_build_object(
      'allowed', v_can_prepare_contract,
      'reasonCode', v_prepare_reason,
      'expectedActorMembershipId', v_current."certifierMembershipId"
    ),
    'decideContract', jsonb_build_object(
      'allowed', v_can_decide_contract,
      'reasonCode', v_contract_decide_reason,
      'expectedActorMembershipId', v_contract_authority."financeMembershipId",
      'targetId', v_head."pendingVersionId"
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION "obrasaas_project_contract_read"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_actor_membership_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_head RECORD;
  v_current_contract JSONB;
  v_pending_contract JSONB;
  v_authority_history JSONB;
  v_contract_history JSONB;
  v_canonical_tasks JSONB;
BEGIN
  PERFORM 1
    FROM "Project" p
   WHERE p."organizationId" = p_organization_id
     AND p."id" = p_project_id
     AND p."status" <> 'ARCHIVED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_SCOPE_INVALID: active tenant-scoped project was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT "obrasaas_project_contract_actor_can_read"(
    p_organization_id, p_project_id, p_actor_membership_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_READ_FORBIDDEN: ACTIVE ADMIN, DIRECTOR, FINANCE or AUDITOR project membership is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'taskId', t."id",
      'taskCode', t."code",
      'taskTitle', t."title",
      'taskRevision', t."revision",
      'technicalBasis', CASE WHEN b."id" IS NULL
        THEN jsonb_build_object(
          'status', 'UNESTABLISHED', 'unitCode', NULL, 'baseQuantity', NULL
        )
        ELSE jsonb_build_object(
          'status', 'ESTABLISHED',
          'unitCode', b."unitCode"::TEXT,
          'baseQuantity', to_char(b."baseQuantity", 'FM99999999999999.0000')
        )
      END
    ) ORDER BY t."code" NULLS LAST, t."id"), '[]'::JSONB)
    INTO v_canonical_tasks
    FROM "Task" t
    LEFT JOIN "TaskProgressMeasurementBalance" b
      ON b."organizationId" = p_organization_id
     AND b."projectId" = t."projectId"
     AND b."taskId" = t."id"
   WHERE t."projectId" = p_project_id
     AND t."type" = 'TASK'
     AND t."metadata" ->> 'source' = 'canonical-task-v1';

  SELECT h.* INTO v_head
    FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'organizationId', p_organization_id,
      'projectId', p_project_id,
      'authorityRevision', 0,
      'headRevision', 0,
      'readiness', 'AUTHORITY_REQUIRED',
      'currentAuthority', NULL,
      'pendingAuthority', NULL,
      'currentContract', NULL,
      'pendingContract', NULL,
      'historyLimit', 20,
      'authorityHistory', '[]'::JSONB,
      'contractHistory', '[]'::JSONB,
      'canonicalTasks', v_canonical_tasks,
      'capabilities', "obrasaas_project_contract_capabilities"(
        p_organization_id, p_project_id, p_actor_membership_id
      ),
      'currentTechnicalCompatibility', 'UNESTABLISHED',
      's10BlockerCode', NULL
    );
  END IF;

  v_current_contract := "obrasaas_project_contract_version_json"(
    p_organization_id, p_project_id, p_actor_membership_id, v_head."currentVersionId"
  );
  v_pending_contract := "obrasaas_project_contract_version_json"(
    p_organization_id, p_project_id, p_actor_membership_id, v_head."pendingVersionId"
  );
  SELECT COALESCE(jsonb_agg(
      "obrasaas_project_contract_authority_json"(
        p_organization_id, p_project_id, p_actor_membership_id, history."id"
      )
      ORDER BY history."version" DESC
    ), '[]'::JSONB)
    INTO v_authority_history
    FROM (
      SELECT a."id", a."version"
        FROM "ProjectContractAuthorityVersion" a
       WHERE a."organizationId" = p_organization_id
         AND a."projectId" = p_project_id
         AND a."headId" = v_head."id"
       ORDER BY a."version" DESC
       LIMIT 20
    ) history;
  SELECT COALESCE(jsonb_agg(
      "obrasaas_project_contract_version_json"(
        p_organization_id, p_project_id, p_actor_membership_id, history."id"
      ) - 'lines'
      ORDER BY history."version" DESC
    ), '[]'::JSONB)
    INTO v_contract_history
    FROM (
      SELECT v."id", v."version"
        FROM "ProjectContractVersion" v
       WHERE v."organizationId" = p_organization_id
         AND v."projectId" = p_project_id
         AND v."headId" = v_head."id"
       ORDER BY v."version" DESC
       LIMIT 20
    ) history;
  RETURN jsonb_build_object(
    'organizationId', p_organization_id,
    'projectId', p_project_id,
    'authorityRevision', v_head."authorityRevision",
    'headRevision', v_head."revision",
    'readiness', CASE
      WHEN v_head."pendingAuthorityVersionId" IS NOT NULL THEN 'AUTHORITY_REVIEW_PENDING'
      WHEN v_head."currentAuthorityVersionId" IS NULL THEN 'AUTHORITY_REQUIRED'
      WHEN v_head."pendingVersionId" IS NOT NULL THEN 'CONTRACT_REVIEW_PENDING'
      WHEN v_head."currentVersionId" IS NULL THEN 'CONTRACT_REQUIRED'
      ELSE 'ACTIVE'
    END,
    'currentAuthority', "obrasaas_project_contract_authority_json"(
      p_organization_id, p_project_id, p_actor_membership_id,
      v_head."currentAuthorityVersionId"
    ),
    'pendingAuthority', "obrasaas_project_contract_authority_json"(
      p_organization_id, p_project_id, p_actor_membership_id,
      v_head."pendingAuthorityVersionId"
    ),
    'currentContract', v_current_contract,
    'pendingContract', v_pending_contract,
    'historyLimit', 20,
    'authorityHistory', v_authority_history,
    'contractHistory', v_contract_history,
    'canonicalTasks', v_canonical_tasks,
    'capabilities', "obrasaas_project_contract_capabilities"(
      p_organization_id, p_project_id, p_actor_membership_id
    ),
    'currentTechnicalCompatibility', COALESCE(
      v_current_contract ->> 'currentTechnicalCompatibility', 'UNESTABLISHED'
    ),
    's10BlockerCode', v_current_contract -> 's10BlockerCode'
  );
END;
$$;

-- Command views deliberately keep ordinary INSTEAD OF triggers. PostgreSQL
-- cannot mark view triggers ALWAYS; replica mode skips the command and the
-- constant zero-row views cannot mutate any ledger or head. Fact guards remain
-- ENABLE ALWAYS.

REVOKE ALL ON FUNCTION "obrasaas_project_contract_authority_prepare_worker"(
  TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION "obrasaas_project_contract_authority_decide_worker"(
  TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION "obrasaas_project_contract_prepare_worker"(
  TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, DATE,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION "obrasaas_project_contract_decide_worker"(
  TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
