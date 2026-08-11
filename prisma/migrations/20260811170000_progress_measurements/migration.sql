-- S9.1 quantitative progress ledger.
-- This ledger is deliberately independent from Task.progress, certificates and payments.

CREATE TYPE "ProgressMeasurementUnitCode" AS ENUM (
  'M', 'M2', 'M3', 'KG', 'T', 'L', 'UNIT', 'HOUR', 'DAY', 'LOT'
);

CREATE TYPE "ProgressMeasurementMethod" AS ENUM (
  'DIRECT_COUNT', 'DIMENSIONAL_CALCULATION', 'INSTRUMENT_READING', 'OTHER_REVIEWED'
);

CREATE TYPE "ProgressMeasurementDecisionType" AS ENUM ('APPROVED', 'REJECTED');

-- Referential integrity, not trigger snapshot visibility, is authoritative for
-- concurrent project closure versus submission.
ALTER TABLE "Project"
  ADD COLUMN "progressMeasurementEligible" BOOLEAN
  GENERATED ALWAYS AS (
    "status" IN ('PLANNING', 'ACTIVE', 'PAUSED')
  ) STORED NOT NULL;

CREATE UNIQUE INDEX "Project_progress_measurement_eligibility_key"
  ON "Project"("organizationId", "id", "progressMeasurementEligible");

CREATE TABLE "TaskProgressMeasurementHead" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "projectProgressMeasurementEligibleSnapshot" BOOLEAN
    GENERATED ALWAYS AS (
      CASE WHEN "pendingMeasurementId" IS NULL THEN NULL ELSE TRUE END
    ) STORED,
  "taskId" TEXT NOT NULL,
  "taskIdentitySnapshot" BOOLEAN NOT NULL DEFAULT TRUE,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "headMeasurementId" TEXT,
  "pendingMeasurementId" TEXT,
  "approvedMeasurementId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskProgressMeasurementHead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TPMHead_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "TPMHead_civil_fortnight_check" CHECK (
    (EXTRACT(DAY FROM "periodStart") = 1 AND "periodEnd" = "periodStart" + 14)
    OR
    (EXTRACT(DAY FROM "periodStart") = 16 AND "periodEnd" =
      (date_trunc('month', "periodStart"::timestamp) + interval '1 month - 1 day')::date)
  )
);

CREATE TABLE "TaskProgressMeasurement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "unitCode" "ProgressMeasurementUnitCode" NOT NULL,
  "baseQuantity" DECIMAL(18,4) NOT NULL,
  "periodQuantity" DECIMAL(18,4) NOT NULL,
  "cumulativeQuantity" DECIMAL(18,4) NOT NULL,
  "headRevisionAtSubmit" INTEGER NOT NULL,
  "approvedCumulativeQuantityAtSubmit" DECIMAL(18,4) NOT NULL,
  "balanceRevisionAtSubmit" INTEGER NOT NULL,
  "method" "ProgressMeasurementMethod" NOT NULL,
  "rationale" VARCHAR(1000) NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "evidenceCount" INTEGER NOT NULL,
  "evidenceSetHash" CHAR(64) NOT NULL,
  "preparedByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProgressMeasurement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TPM_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "TPM_quantity_check" CHECK (
    "baseQuantity" > 0 AND "periodQuantity" > 0
    AND "cumulativeQuantity" >= 0 AND "cumulativeQuantity" <= "baseQuantity"
  ),
  CONSTRAINT "TPM_task_revision_check" CHECK ("taskRevision" >= 0),
  CONSTRAINT "TPM_submit_receipt_check" CHECK (
    "headRevisionAtSubmit" >= 1 AND "balanceRevisionAtSubmit" >= 0
    AND "approvedCumulativeQuantityAtSubmit" >= 0
    AND "approvedCumulativeQuantityAtSubmit" <= "baseQuantity"
  ),
  CONSTRAINT "TPM_evidence_count_check" CHECK ("evidenceCount" BETWEEN 1 AND 10),
  CONSTRAINT "TPM_evidence_hash_check" CHECK ("evidenceSetHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "TPM_operation_hash_check" CHECK ("operationKeyHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "TPM_request_fingerprint_check" CHECK ("requestFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "TPM_rationale_check" CHECK (
    length(btrim("rationale")) BETWEEN 1 AND 1000 AND "rationale" = btrim("rationale")
  )
);

CREATE TABLE "TaskProgressMeasurementEvidence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "measurementId" TEXT NOT NULL,
  "progressEvidenceId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "evidenceRevision" INTEGER NOT NULL,
  "evidenceCapturedAt" TIMESTAMP(3) NOT NULL,
  "evidenceSnapshotHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProgressMeasurementEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TPMEvidence_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 10),
  CONSTRAINT "TPMEvidence_revision_check" CHECK ("evidenceRevision" >= 0),
  CONSTRAINT "TPMEvidence_snapshot_hash_check" CHECK ("evidenceSnapshotHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "TaskProgressMeasurementDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "measurementId" TEXT NOT NULL,
  "decision" "ProgressMeasurementDecisionType" NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "expectedHeadRevision" INTEGER NOT NULL,
  "headRevisionAfterDecision" INTEGER NOT NULL,
  "approvedCumulativeQuantityAfterDecision" DECIMAL(18,4) NOT NULL,
  "balanceRevisionAfterDecision" INTEGER NOT NULL,
  "decidedByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProgressMeasurementDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TPMDecision_expected_revision_check" CHECK ("expectedHeadRevision" >= 1),
  CONSTRAINT "TPMDecision_receipt_check" CHECK (
    "headRevisionAfterDecision" = "expectedHeadRevision" + 1
    AND "approvedCumulativeQuantityAfterDecision" >= 0
    AND "balanceRevisionAfterDecision" >= 0
  ),
  CONSTRAINT "TPMDecision_operation_hash_check" CHECK ("operationKeyHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "TPMDecision_request_fingerprint_check" CHECK ("requestFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "TPMDecision_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 1 AND 1000 AND "reason" = btrim("reason")
  )
);

CREATE TABLE "TaskProgressMeasurementBalance" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "unitCode" "ProgressMeasurementUnitCode" NOT NULL,
  "baseQuantity" DECIMAL(18,4) NOT NULL,
  "approvedCumulativeQuantity" DECIMAL(18,4) NOT NULL,
  "lastApprovedHeadId" TEXT NOT NULL,
  "lastApprovedMeasurementId" TEXT NOT NULL,
  "lastApprovedPeriodStart" DATE NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskProgressMeasurementBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TPMBalance_quantity_check" CHECK (
    "baseQuantity" > 0 AND "approvedCumulativeQuantity" >= 0
    AND "approvedCumulativeQuantity" <= "baseQuantity"
  ),
  CONSTRAINT "TPMBalance_revision_check" CHECK ("revision" >= 1)
);

CREATE UNIQUE INDEX "TPMHead_scope_period_key"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "periodStart");
CREATE UNIQUE INDEX "TPMHead_scope_id_key"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "id");
CREATE UNIQUE INDEX "TPMHead_head_measurement_key" ON "TaskProgressMeasurementHead"("headMeasurementId");
CREATE UNIQUE INDEX "TPMHead_pending_measurement_key" ON "TaskProgressMeasurementHead"("pendingMeasurementId");
CREATE UNIQUE INDEX "TPMHead_approved_measurement_key" ON "TaskProgressMeasurementHead"("approvedMeasurementId");
CREATE UNIQUE INDEX "TPMHead_scope_head_measurement_key"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "headMeasurementId");
CREATE UNIQUE INDEX "TPMHead_scope_pending_measurement_key"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "pendingMeasurementId");
CREATE UNIQUE INDEX "TPMHead_scope_approved_measurement_key"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "approvedMeasurementId");
CREATE UNIQUE INDEX "TPMHead_one_pending_per_task_key"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId")
  WHERE "pendingMeasurementId" IS NOT NULL;
CREATE INDEX "TPMHead_task_period_idx"
  ON "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "periodStart");

CREATE UNIQUE INDEX "TPM_org_operation_hash_key"
  ON "TaskProgressMeasurement"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "TPM_head_revision_key" ON "TaskProgressMeasurement"("headId", "revision");
CREATE UNIQUE INDEX "TPM_scope_id_key"
  ON "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id");
CREATE UNIQUE INDEX "TPM_predecessor_key" ON "TaskProgressMeasurement"("predecessorId");
CREATE UNIQUE INDEX "TPM_scope_predecessor_key"
  ON "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "predecessorId");
CREATE INDEX "TPM_task_created_idx"
  ON "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "createdAt");

CREATE UNIQUE INDEX "TPMEvidence_measurement_ordinal_key"
  ON "TaskProgressMeasurementEvidence"("measurementId", "ordinal");
CREATE UNIQUE INDEX "TPMEvidence_measurement_evidence_key"
  ON "TaskProgressMeasurementEvidence"("measurementId", "progressEvidenceId");
CREATE INDEX "TPMEvidence_task_created_idx"
  ON "TaskProgressMeasurementEvidence"("organizationId", "projectId", "taskId", "createdAt");

CREATE UNIQUE INDEX "TPMDecision_measurement_key" ON "TaskProgressMeasurementDecision"("measurementId");
CREATE UNIQUE INDEX "TPMDecision_org_operation_hash_key"
  ON "TaskProgressMeasurementDecision"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "TPMDecision_scope_id_key"
  ON "TaskProgressMeasurementDecision"("organizationId", "projectId", "taskId", "id");
CREATE UNIQUE INDEX "TPMDecision_measurement_scope_key"
  ON "TaskProgressMeasurementDecision"("organizationId", "projectId", "taskId", "measurementId");
CREATE INDEX "TPMDecision_task_created_idx"
  ON "TaskProgressMeasurementDecision"("organizationId", "projectId", "taskId", "createdAt");

CREATE UNIQUE INDEX "TPMBalance_task_key" ON "TaskProgressMeasurementBalance"("taskId");
CREATE UNIQUE INDEX "TPMBalance_scope_task_key"
  ON "TaskProgressMeasurementBalance"("organizationId", "projectId", "taskId");
CREATE UNIQUE INDEX "TPMBalance_project_task_key"
  ON "TaskProgressMeasurementBalance"("projectId", "taskId");
CREATE UNIQUE INDEX "TPMBalance_last_head_key" ON "TaskProgressMeasurementBalance"("lastApprovedHeadId");
CREATE UNIQUE INDEX "TPMBalance_last_measurement_key"
  ON "TaskProgressMeasurementBalance"("lastApprovedMeasurementId");
CREATE UNIQUE INDEX "TPMBalance_scope_last_head_key"
  ON "TaskProgressMeasurementBalance"("organizationId", "projectId", "taskId", "lastApprovedHeadId");
CREATE UNIQUE INDEX "TPMBalance_scope_last_measurement_key"
  ON "TaskProgressMeasurementBalance"("organizationId", "projectId", "taskId", "lastApprovedMeasurementId");
CREATE INDEX "TPMBalance_project_period_idx"
  ON "TaskProgressMeasurementBalance"("organizationId", "projectId", "lastApprovedPeriodStart");

ALTER TABLE "TaskProgressMeasurementHead"
  ADD CONSTRAINT "TPMHead_organization_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMHead_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMHead_task_identity_fkey"
  FOREIGN KEY ("projectId", "taskId", "taskIdentitySnapshot")
  REFERENCES "Task"("projectId", "id", "materialRequirementEligible")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "TPMHead_project_eligibility_fkey"
  FOREIGN KEY ("organizationId", "projectId", "projectProgressMeasurementEligibleSnapshot")
  REFERENCES "Project"("organizationId", "id", "progressMeasurementEligible")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TaskProgressMeasurement"
  ADD CONSTRAINT "TPM_organization_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPM_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPM_task_scope_fkey" FOREIGN KEY ("projectId", "taskId")
  REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPM_head_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "taskId", "headId")
  REFERENCES "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPM_predecessor_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "taskId", "predecessorId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPM_preparer_membership_fkey" FOREIGN KEY ("organizationId", "preparedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskProgressMeasurementEvidence"
  ADD CONSTRAINT "TPMEvidence_organization_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMEvidence_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMEvidence_task_scope_fkey" FOREIGN KEY ("projectId", "taskId")
  REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMEvidence_measurement_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "taskId", "measurementId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMEvidence_progress_evidence_fkey" FOREIGN KEY ("projectId", "progressEvidenceId")
  REFERENCES "ProgressEvidence"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskProgressMeasurementDecision"
  ADD CONSTRAINT "TPMDecision_organization_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMDecision_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMDecision_task_scope_fkey" FOREIGN KEY ("projectId", "taskId")
  REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMDecision_measurement_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "taskId", "measurementId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMDecision_decider_membership_fkey" FOREIGN KEY ("organizationId", "decidedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskProgressMeasurementBalance"
  ADD CONSTRAINT "TPMBalance_organization_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMBalance_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMBalance_task_scope_fkey" FOREIGN KEY ("projectId", "taskId")
  REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMBalance_last_head_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "taskId", "lastApprovedHeadId")
  REFERENCES "TaskProgressMeasurementHead"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMBalance_last_measurement_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "taskId", "lastApprovedMeasurementId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskProgressMeasurementHead"
  ADD CONSTRAINT "TPMHead_head_measurement_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "headMeasurementId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMHead_pending_measurement_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "pendingMeasurementId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TPMHead_approved_measurement_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "approvedMeasurementId")
  REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only facts and governed projections. The transaction-local scope is
-- set only by the two public mutation functions below.
CREATE FUNCTION "obrasaas_progress_measurement_append_only_guard"()
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
  v_scope := current_setting('obrasaas.progress_measurement_write_scope', true);
  IF v_scope IS DISTINCT FROM NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."taskId" THEN
    RAISE EXCEPTION 'direct progress measurement ledger writes are forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_projection_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_scope TEXT;
  v_organization_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."organizationId" ELSE NEW."organizationId" END;
  v_project_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."projectId" ELSE NEW."projectId" END;
  v_task_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."taskId" ELSE NEW."taskId" END;
BEGIN
  v_scope := current_setting('obrasaas.progress_measurement_write_scope', true);
  IF v_scope IS DISTINCT FROM v_organization_id || ':' || v_project_id || ':' || v_task_id THEN
    RAISE EXCEPTION 'direct progress measurement projection writes are forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% cannot be truncated', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_task_identity_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (
    NEW."type" IS DISTINCT FROM OLD."type"
    OR (NEW."metadata" ->> 'source') IS DISTINCT FROM (OLD."metadata" ->> 'source')
  ) AND EXISTS (
    SELECT 1
      FROM "TaskProgressMeasurementHead" h
     WHERE h."projectId" = OLD."projectId" AND h."taskId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_TASK_IDENTITY_IMMUTABLE: measured task type and canonical source cannot change'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_project_closure_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW."status" IN ('COMPLETED', 'ARCHIVED')
    AND NEW."status" IS DISTINCT FROM OLD."status"
    AND EXISTS (
      SELECT 1
        FROM "TaskProgressMeasurementHead" h
       WHERE h."organizationId" = OLD."organizationId"
         AND h."projectId" = OLD."id"
         AND h."pendingMeasurementId" IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PROJECT_PENDING: project cannot close with progress measurements awaiting decision'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "TaskProgressMeasurement_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskProgressMeasurement"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_append_only_guard"();
CREATE TRIGGER "TaskProgressMeasurement_no_truncate"
BEFORE TRUNCATE ON "TaskProgressMeasurement"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_no_truncate"();

CREATE TRIGGER "TaskProgressMeasurementEvidence_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskProgressMeasurementEvidence"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_append_only_guard"();
CREATE TRIGGER "TaskProgressMeasurementEvidence_no_truncate"
BEFORE TRUNCATE ON "TaskProgressMeasurementEvidence"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_no_truncate"();

CREATE TRIGGER "TaskProgressMeasurementDecision_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskProgressMeasurementDecision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_append_only_guard"();
CREATE TRIGGER "TaskProgressMeasurementDecision_no_truncate"
BEFORE TRUNCATE ON "TaskProgressMeasurementDecision"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_no_truncate"();

CREATE TRIGGER "TaskProgressMeasurementHead_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskProgressMeasurementHead"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_projection_guard"();
CREATE TRIGGER "TaskProgressMeasurementHead_no_truncate"
BEFORE TRUNCATE ON "TaskProgressMeasurementHead"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_no_truncate"();

CREATE TRIGGER "TaskProgressMeasurementBalance_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskProgressMeasurementBalance"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_projection_guard"();
CREATE TRIGGER "TaskProgressMeasurementBalance_no_truncate"
BEFORE TRUNCATE ON "TaskProgressMeasurementBalance"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_no_truncate"();

CREATE TRIGGER "Task_progress_measurement_identity_guard"
BEFORE UPDATE OF "type", "metadata" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_task_identity_guard"();

CREATE TRIGGER "Project_progress_measurement_closure_guard"
BEFORE UPDATE OF "status" ON "Project"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_project_closure_guard"();

ALTER TABLE "TaskProgressMeasurement" ENABLE ALWAYS TRIGGER "TaskProgressMeasurement_append_only";
ALTER TABLE "TaskProgressMeasurement" ENABLE ALWAYS TRIGGER "TaskProgressMeasurement_no_truncate";
ALTER TABLE "TaskProgressMeasurementEvidence" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementEvidence_append_only";
ALTER TABLE "TaskProgressMeasurementEvidence" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementEvidence_no_truncate";
ALTER TABLE "TaskProgressMeasurementDecision" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementDecision_append_only";
ALTER TABLE "TaskProgressMeasurementDecision" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementDecision_no_truncate";
ALTER TABLE "TaskProgressMeasurementHead" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementHead_projection_guard";
ALTER TABLE "TaskProgressMeasurementHead" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementHead_no_truncate";
ALTER TABLE "TaskProgressMeasurementBalance" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementBalance_projection_guard";
ALTER TABLE "TaskProgressMeasurementBalance" ENABLE ALWAYS TRIGGER "TaskProgressMeasurementBalance_no_truncate";
ALTER TABLE "Task" ENABLE ALWAYS TRIGGER "Task_progress_measurement_identity_guard";
ALTER TABLE "Project" ENABLE ALWAYS TRIGGER "Project_progress_measurement_closure_guard";

CREATE FUNCTION "obrasaas_progress_measurement_result"(
  p_measurement_id TEXT,
  p_operation_kind TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE(
  head_id TEXT,
  measurement_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  task_id TEXT,
  period_start DATE,
  period_end DATE,
  unit_code TEXT,
  base_quantity NUMERIC(18,4),
  period_quantity NUMERIC(18,4),
  cumulative_quantity NUMERIC(18,4),
  method TEXT,
  rationale TEXT,
  task_revision INTEGER,
  measurement_revision INTEGER,
  head_revision INTEGER,
  status TEXT,
  evidence_count INTEGER,
  prepared_by_membership_id TEXT,
  decided_by_membership_id TEXT,
  decision_reason TEXT,
  approved_cumulative_quantity NUMERIC(18,4),
  balance_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    h."id",
    m."id",
    m."organizationId",
    m."projectId",
    m."taskId",
    h."periodStart",
    h."periodEnd",
    m."unitCode"::TEXT,
    m."baseQuantity",
    m."periodQuantity",
    m."cumulativeQuantity",
    m."method"::TEXT,
    m."rationale"::TEXT,
    m."taskRevision",
    m."revision",
    CASE WHEN p_operation_kind = 'SUBMIT'
      THEN m."headRevisionAtSubmit" ELSE d."headRevisionAfterDecision" END,
    CASE WHEN p_operation_kind = 'SUBMIT'
      THEN 'PENDING' ELSE d."decision"::TEXT END,
    m."evidenceCount",
    m."preparedByMembershipId",
    CASE WHEN p_operation_kind = 'SUBMIT' THEN NULL ELSE d."decidedByMembershipId" END,
    CASE WHEN p_operation_kind = 'SUBMIT' THEN NULL ELSE d."reason"::TEXT END,
    CASE WHEN p_operation_kind = 'SUBMIT'
      THEN m."approvedCumulativeQuantityAtSubmit"
      ELSE d."approvedCumulativeQuantityAfterDecision" END,
    CASE WHEN p_operation_kind = 'SUBMIT'
      THEN m."balanceRevisionAtSubmit" ELSE d."balanceRevisionAfterDecision" END,
    p_replayed
  FROM "TaskProgressMeasurement" m
  JOIN "TaskProgressMeasurementHead" h
    ON h."organizationId" = m."organizationId"
   AND h."projectId" = m."projectId"
   AND h."taskId" = m."taskId"
   AND h."id" = m."headId"
  LEFT JOIN "TaskProgressMeasurementDecision" d
    ON d."organizationId" = m."organizationId"
   AND d."projectId" = m."projectId"
   AND d."taskId" = m."taskId"
   AND d."measurementId" = m."id"
  LEFT JOIN "TaskProgressMeasurementBalance" b
    ON b."organizationId" = m."organizationId"
   AND b."projectId" = m."projectId"
   AND b."taskId" = m."taskId"
  WHERE m."id" = p_measurement_id;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_submit"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_task_id TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_unit_code TEXT,
  p_base_quantity NUMERIC,
  p_period_quantity NUMERIC,
  p_method TEXT,
  p_rationale TEXT,
  p_evidence_ids_jsonb JSONB,
  p_expected_head_measurement_id TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  head_id TEXT,
  measurement_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  task_id TEXT,
  period_start DATE,
  period_end DATE,
  unit_code TEXT,
  base_quantity NUMERIC(18,4),
  period_quantity NUMERIC(18,4),
  cumulative_quantity NUMERIC(18,4),
  method TEXT,
  rationale TEXT,
  task_revision INTEGER,
  measurement_revision INTEGER,
  head_revision INTEGER,
  status TEXT,
  evidence_count INTEGER,
  prepared_by_membership_id TEXT,
  decided_by_membership_id TEXT,
  decision_reason TEXT,
  approved_cumulative_quantity NUMERIC(18,4),
  balance_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_evidence_set_hash TEXT;
  v_evidence_count INTEGER;
  v_valid_evidence_count INTEGER;
  v_existing RECORD;
  v_task_revision INTEGER;
  v_project_status TEXT;
  v_task_type TEXT;
  v_task_source TEXT;
  v_tenant_today DATE;
  v_head RECORD;
  v_balance RECORD;
  v_prior_period_quantity NUMERIC(18,4);
  v_cumulative_quantity NUMERIC(18,4);
  v_measurement_revision INTEGER;
  v_head_revision_after_submit INTEGER;
  v_approved_cumulative_at_submit NUMERIC(18,4);
  v_balance_revision_at_submit INTEGER;
  v_head_id TEXT;
  v_measurement_id TEXT := gen_random_uuid()::TEXT;
  v_scope TEXT := p_organization_id || ':' || p_project_id || ':' || p_task_id;
BEGIN
  IF p_organization_id IS NULL OR p_project_id IS NULL OR p_task_id IS NULL
    OR p_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'organization, project, task and actor membership are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT (CURRENT_TIMESTAMP AT TIME ZONE o."timezone")::DATE
    INTO v_tenant_today
    FROM "TenantMembership" tm
    JOIN "Organization" o ON o."id" = tm."organizationId"
   WHERE tm."organizationId" = p_organization_id
     AND tm."id" = p_actor_membership_id
     AND tm."status" = 'ACTIVE'
     AND tm."tenantRole" IN ('ADMIN', 'DIRECTOR', 'SITE_MANAGER')
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_ACTOR_FORBIDDEN: progress measurement submit requires an active authorized tenant membership'
      USING ERRCODE = '42501';
  END IF;

  IF p_period_start IS NULL OR p_period_end IS NULL
    OR NOT (
      (EXTRACT(DAY FROM p_period_start) = 1 AND p_period_end = p_period_start + 14)
      OR
      (EXTRACT(DAY FROM p_period_start) = 16 AND p_period_end =
        (date_trunc('month', p_period_start::timestamp) + interval '1 month - 1 day')::date)
    ) THEN
    RAISE EXCEPTION 'measurement period must be a civil fortnight (1-15 or 16-month end)'
      USING ERRCODE = '22023';
  END IF;
  IF p_period_start > v_tenant_today THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_FUTURE_PERIOD: measurement period cannot start after the tenant civil date'
      USING ERRCODE = '23514';
  END IF;
  IF p_unit_code IS NULL OR p_unit_code NOT IN ('M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT') THEN
    RAISE EXCEPTION 'unsupported progress measurement unit' USING ERRCODE = '22023';
  END IF;
  IF p_method IS NULL OR p_method NOT IN (
    'DIRECT_COUNT','DIMENSIONAL_CALCULATION','INSTRUMENT_READING','OTHER_REVIEWED'
  ) THEN
    RAISE EXCEPTION 'unsupported progress measurement method' USING ERRCODE = '22023';
  END IF;
  IF p_base_quantity IS NULL OR p_base_quantity <= 0
    OR p_base_quantity <> round(p_base_quantity, 4)
    OR p_period_quantity IS NULL OR p_period_quantity <= 0
    OR p_period_quantity <> round(p_period_quantity, 4) THEN
    RAISE EXCEPTION 'base and period quantities must be positive decimal values with at most four places'
      USING ERRCODE = '22023';
  END IF;
  IF p_rationale IS NULL OR length(btrim(p_rationale)) NOT BETWEEN 1 AND 1000
    OR p_rationale IS DISTINCT FROM btrim(p_rationale) THEN
    RAISE EXCEPTION 'rationale must be trimmed and contain 1 to 1000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'operation key must contain 8 to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'request fingerprint must be lowercase sha256' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ids_jsonb IS NULL OR jsonb_typeof(p_evidence_ids_jsonb) <> 'array' THEN
    RAISE EXCEPTION 'evidence ids must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::INTEGER, count(DISTINCT e.value)::INTEGER
    INTO v_evidence_count, v_valid_evidence_count
    FROM jsonb_array_elements_text(p_evidence_ids_jsonb) e(value);
  IF v_evidence_count NOT BETWEEN 1 AND 10 OR v_valid_evidence_count <> v_evidence_count
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_evidence_ids_jsonb) raw(value)
       WHERE jsonb_typeof(raw.value) <> 'string' OR length(raw.value #>> '{}') = 0
    ) THEN
    RAISE EXCEPTION 'measurement requires 1 to 10 distinct non-empty evidence ids'
      USING ERRCODE = '22023';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  SELECT encode(sha256(convert_to(string_agg(e.value, ',' ORDER BY e.value), 'UTF8')), 'hex')
    INTO v_evidence_set_hash
    FROM jsonb_array_elements_text(p_evidence_ids_jsonb) e(value);

  -- Operation-key serialization precedes task-scope serialization everywhere.
  -- This makes an identical concurrent request return a replay instead of a
  -- transient uniqueness/head conflict.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progress-measurement:submit:' || p_organization_id || ':' || v_operation_hash,
    0
  ));

  SELECT m."id", m."projectId", m."taskId", h."periodStart", h."periodEnd",
         m."unitCode"::TEXT AS unit_code, m."baseQuantity", m."periodQuantity",
         m."method"::TEXT AS method, m."rationale"::TEXT AS rationale,
         m."preparedByMembershipId", m."requestFingerprint"::TEXT AS request_fingerprint,
         m."predecessorId", m."evidenceSetHash"::TEXT AS evidence_set_hash
    INTO v_existing
    FROM "TaskProgressMeasurement" m
    JOIN "TaskProgressMeasurementHead" h
      ON h."organizationId" = m."organizationId"
     AND h."projectId" = m."projectId"
     AND h."taskId" = m."taskId" AND h."id" = m."headId"
   WHERE m."organizationId" = p_organization_id
     AND m."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."taskId" IS DISTINCT FROM p_task_id
      OR v_existing."periodStart" IS DISTINCT FROM p_period_start
      OR v_existing."periodEnd" IS DISTINCT FROM p_period_end
      OR v_existing.unit_code IS DISTINCT FROM p_unit_code
      OR v_existing."baseQuantity" IS DISTINCT FROM p_base_quantity::NUMERIC(18,4)
      OR v_existing."periodQuantity" IS DISTINCT FROM p_period_quantity::NUMERIC(18,4)
      OR v_existing.method IS DISTINCT FROM p_method
      OR v_existing.rationale IS DISTINCT FROM p_rationale
      OR v_existing."preparedByMembershipId" IS DISTINCT FROM p_actor_membership_id
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing."predecessorId" IS DISTINCT FROM p_expected_head_measurement_id
      OR v_existing.evidence_set_hash IS DISTINCT FROM v_evidence_set_hash THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_IDEMPOTENCY_CONFLICT: operation key was already used with a different measurement request'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT * FROM "obrasaas_progress_measurement_result"(v_existing."id", 'SUBMIT', true);
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_scope, 0));

  SELECT t."revision", p."status"::TEXT, t."type"::TEXT, t."metadata" ->> 'source'
    INTO v_task_revision, v_project_status, v_task_type, v_task_source
    FROM "Task" t
    JOIN "Project" p ON p."id" = t."projectId"
   WHERE p."organizationId" = p_organization_id
     AND p."id" = p_project_id
     AND t."id" = p_task_id
   FOR SHARE OF t, p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_SCOPE_INVALID: tenant-scoped project task was not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_project_status NOT IN ('PLANNING', 'ACTIVE', 'PAUSED') THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PROJECT_READ_ONLY: project is read-only for progress measurements'
      USING ERRCODE = '55000';
  END IF;
  IF v_task_type IS DISTINCT FROM 'TASK' THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_TASK_TYPE_INVALID: only executable tasks can be measured'
      USING ERRCODE = '23514';
  END IF;
  IF v_task_source IS DISTINCT FROM 'canonical-task-v1' THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_TASK_NOT_CANONICAL: progress measurement requires a canonical task'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::INTEGER
    INTO v_valid_evidence_count
    FROM "ProgressEvidence" pe
    JOIN jsonb_array_elements_text(p_evidence_ids_jsonb) requested(id)
      ON requested.id = pe."id"
   WHERE pe."projectId" = p_project_id
     AND pe."taskId" = p_task_id
     AND pe."status" = 'APPROVED';
  IF v_valid_evidence_count <> v_evidence_count THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_EVIDENCE_INVALID: all evidence must be approved and belong to the same project task'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_head
    FROM "TaskProgressMeasurementHead" h
   WHERE h."organizationId" = p_organization_id
     AND h."projectId" = p_project_id
     AND h."taskId" = p_task_id
     AND h."periodStart" = p_period_start
   FOR UPDATE;

  IF FOUND THEN
    IF v_head."periodEnd" IS DISTINCT FROM p_period_end THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_HEAD_STALE: period head has a different civil period end' USING ERRCODE = '40001';
    END IF;
    IF v_head."headMeasurementId" IS DISTINCT FROM p_expected_head_measurement_id THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_HEAD_STALE: stale expected head measurement' USING ERRCODE = '40001';
    END IF;
    IF v_head."pendingMeasurementId" IS NOT NULL THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_REVIEW_PENDING: task already has a submitted measurement awaiting decision'
        USING ERRCODE = '55000';
    END IF;
    v_head_id := v_head."id";
    v_head_revision_after_submit := v_head."revision" + 1;
    v_measurement_revision := (
      SELECT COALESCE(max(m."revision"), 0) + 1
        FROM "TaskProgressMeasurement" m
       WHERE m."organizationId" = p_organization_id
         AND m."projectId" = p_project_id
         AND m."taskId" = p_task_id
         AND m."headId" = v_head."id"
    );
  ELSE
    IF p_expected_head_measurement_id IS NOT NULL THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_HEAD_STALE: expected head must be null when creating a civil-period head'
        USING ERRCODE = '40001';
    END IF;
    v_head_id := gen_random_uuid()::TEXT;
    v_measurement_revision := 1;
    v_head_revision_after_submit := 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "TaskProgressMeasurementHead" h
     WHERE h."organizationId" = p_organization_id
       AND h."projectId" = p_project_id
       AND h."taskId" = p_task_id
       AND h."pendingMeasurementId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_REVIEW_PENDING: task already has a submitted measurement awaiting decision'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_balance
    FROM "TaskProgressMeasurementBalance" b
   WHERE b."organizationId" = p_organization_id
     AND b."projectId" = p_project_id
     AND b."taskId" = p_task_id
   FOR UPDATE;

  IF FOUND THEN
    v_approved_cumulative_at_submit := v_balance."approvedCumulativeQuantity";
    v_balance_revision_at_submit := v_balance."revision";
    IF v_balance."unitCode"::TEXT IS DISTINCT FROM p_unit_code
      OR v_balance."baseQuantity" IS DISTINCT FROM p_base_quantity::NUMERIC(18,4) THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_BASIS_MISMATCH: approved base quantity and unit are fixed for the task'
        USING ERRCODE = '23514';
    END IF;
    IF p_period_start < v_balance."lastApprovedPeriodStart" THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PERIOD_CONFLICT: measurement periods must be approved chronologically'
        USING ERRCODE = '23514';
    ELSIF p_period_start = v_balance."lastApprovedPeriodStart" THEN
      IF v_head."approvedMeasurementId" IS DISTINCT FROM v_balance."lastApprovedMeasurementId" THEN
        RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PERIOD_CONFLICT: only the latest approved period may be corrected'
          USING ERRCODE = '23514';
      END IF;
      SELECT m."periodQuantity" INTO v_prior_period_quantity
        FROM "TaskProgressMeasurement" m
       WHERE m."organizationId" = p_organization_id
         AND m."projectId" = p_project_id
         AND m."taskId" = p_task_id
         AND m."id" = v_balance."lastApprovedMeasurementId";
      v_cumulative_quantity := v_balance."approvedCumulativeQuantity"
        - v_prior_period_quantity + p_period_quantity;
    ELSE
      v_cumulative_quantity := v_balance."approvedCumulativeQuantity" + p_period_quantity;
    END IF;
  ELSE
    v_approved_cumulative_at_submit := 0::NUMERIC(18,4);
    v_balance_revision_at_submit := 0;
    v_cumulative_quantity := p_period_quantity;
  END IF;

  IF v_cumulative_quantity < 0 OR v_cumulative_quantity > p_base_quantity THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_OVER_BASELINE: derived cumulative quantity must remain between zero and the approved base'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('obrasaas.progress_measurement_write_scope', v_scope, true);
  IF v_head.id IS NULL THEN
    INSERT INTO "TaskProgressMeasurementHead" (
      "id", "organizationId", "projectId", "taskId", "periodStart", "periodEnd",
      "revision", "createdAt", "updatedAt"
    ) VALUES (
      v_head_id, p_organization_id, p_project_id, p_task_id, p_period_start, p_period_end,
      0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  END IF;

  INSERT INTO "TaskProgressMeasurement" (
    "id", "organizationId", "projectId", "taskId", "headId", "revision", "predecessorId",
    "unitCode", "baseQuantity", "periodQuantity", "cumulativeQuantity",
    "headRevisionAtSubmit", "approvedCumulativeQuantityAtSubmit", "balanceRevisionAtSubmit",
    "method", "rationale",
    "taskRevision", "evidenceCount", "evidenceSetHash", "preparedByMembershipId",
    "operationKeyHash", "requestFingerprint", "createdAt"
  ) VALUES (
    v_measurement_id, p_organization_id, p_project_id, p_task_id, v_head_id,
    v_measurement_revision, p_expected_head_measurement_id,
    p_unit_code::"ProgressMeasurementUnitCode", p_base_quantity::NUMERIC(18,4),
    p_period_quantity::NUMERIC(18,4), v_cumulative_quantity,
    v_head_revision_after_submit, v_approved_cumulative_at_submit, v_balance_revision_at_submit,
    p_method::"ProgressMeasurementMethod", p_rationale, v_task_revision, v_evidence_count,
    v_evidence_set_hash, p_actor_membership_id, v_operation_hash, p_request_fingerprint,
    CURRENT_TIMESTAMP
  );

  INSERT INTO "TaskProgressMeasurementEvidence" (
    "id", "organizationId", "projectId", "taskId", "measurementId", "progressEvidenceId",
    "ordinal", "evidenceRevision", "evidenceCapturedAt", "evidenceSnapshotHash", "createdAt"
  )
  SELECT gen_random_uuid()::TEXT, p_organization_id, p_project_id, p_task_id,
         v_measurement_id, pe."id", requested.ordinality::INTEGER, pe."revision", pe."capturedAt",
         encode(sha256(convert_to(
           pe."id" || '|' || pe."revision"::TEXT || '|' || pe."capturedAt"::TEXT || '|' || pe."media"::TEXT,
           'UTF8'
         )), 'hex'), CURRENT_TIMESTAMP
    FROM jsonb_array_elements_text(p_evidence_ids_jsonb) WITH ORDINALITY requested(id, ordinality)
    JOIN "ProgressEvidence" pe
      ON pe."projectId" = p_project_id AND pe."taskId" = p_task_id AND pe."id" = requested.id
   ORDER BY requested.ordinality;

  UPDATE "TaskProgressMeasurementHead"
     SET "headMeasurementId" = v_measurement_id,
         "pendingMeasurementId" = v_measurement_id,
         "revision" = "revision" + 1,
         "updatedAt" = CURRENT_TIMESTAMP
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "taskId" = p_task_id
     AND "id" = v_head_id;
  PERFORM set_config('obrasaas.progress_measurement_write_scope', '', true);

  RETURN QUERY SELECT * FROM "obrasaas_progress_measurement_result"(v_measurement_id, 'SUBMIT', false);
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_review"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_measurement_id TEXT,
  p_expected_head_revision INTEGER,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  head_id TEXT,
  measurement_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  task_id TEXT,
  period_start DATE,
  period_end DATE,
  unit_code TEXT,
  base_quantity NUMERIC(18,4),
  period_quantity NUMERIC(18,4),
  cumulative_quantity NUMERIC(18,4),
  method TEXT,
  rationale TEXT,
  task_revision INTEGER,
  measurement_revision INTEGER,
  head_revision INTEGER,
  status TEXT,
  evidence_count INTEGER,
  prepared_by_membership_id TEXT,
  decided_by_membership_id TEXT,
  decision_reason TEXT,
  approved_cumulative_quantity NUMERIC(18,4),
  balance_revision INTEGER,
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
  v_measurement RECORD;
  v_head RECORD;
  v_balance RECORD;
  v_prior_period_quantity NUMERIC(18,4);
  v_derived_cumulative NUMERIC(18,4);
  v_approved_cumulative_after_decision NUMERIC(18,4);
  v_balance_revision_after_decision INTEGER;
  v_scope TEXT;
  v_decision_id TEXT := gen_random_uuid()::TEXT;
  v_rows INTEGER;
BEGIN
  IF p_organization_id IS NULL OR p_project_id IS NULL OR p_measurement_id IS NULL
    OR p_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'organization, project, measurement and actor membership are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM "TenantMembership" tm
   WHERE tm."organizationId" = p_organization_id
     AND tm."id" = p_actor_membership_id
     AND tm."status" = 'ACTIVE'
     AND tm."tenantRole" IN ('ADMIN', 'DIRECTOR')
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_ACTOR_FORBIDDEN: progress measurement review requires an active director or administrator membership'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_head_revision IS NULL OR p_expected_head_revision < 1 THEN
    RAISE EXCEPTION 'expected head revision must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'decision must be APPROVED or REJECTED' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000
    OR p_reason IS DISTINCT FROM btrim(p_reason) THEN
    RAISE EXCEPTION 'decision reason must be trimmed and contain 1 to 1000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'operation key must contain 8 to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'request fingerprint must be lowercase sha256' USING ERRCODE = '22023';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progress-measurement:review:' || p_organization_id || ':' || v_operation_hash,
    0
  ));

  SELECT d."measurementId", d."projectId", d."expectedHeadRevision",
         d."decision"::TEXT AS decision, d."reason"::TEXT AS reason,
         d."requestFingerprint"::TEXT AS request_fingerprint,
         d."decidedByMembershipId"
    INTO v_existing
    FROM "TaskProgressMeasurementDecision" d
   WHERE d."organizationId" = p_organization_id
     AND d."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."measurementId" IS DISTINCT FROM p_measurement_id
      OR v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."expectedHeadRevision" IS DISTINCT FROM p_expected_head_revision
      OR v_existing.decision IS DISTINCT FROM p_decision
      OR v_existing.reason IS DISTINCT FROM p_reason
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing."decidedByMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_IDEMPOTENCY_CONFLICT: operation key was already used with a different review request'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT * FROM "obrasaas_progress_measurement_result"(p_measurement_id, 'REVIEW', true);
    RETURN;
  END IF;

  SELECT m."taskId", m."headId"
    INTO v_measurement
    FROM "TaskProgressMeasurement" m
   WHERE m."organizationId" = p_organization_id
     AND m."projectId" = p_project_id
     AND m."id" = p_measurement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_SCOPE_INVALID: tenant-scoped progress measurement was not found' USING ERRCODE = 'P0002';
  END IF;

  v_scope := p_organization_id || ':' || p_project_id || ':' || v_measurement."taskId";
  PERFORM pg_advisory_xact_lock(hashtextextended(v_scope, 0));

  SELECT m.*, h."periodStart" AS period_start, h."periodEnd" AS period_end,
         h."headMeasurementId" AS head_measurement_id,
         h."pendingMeasurementId" AS pending_measurement_id,
         h."approvedMeasurementId" AS approved_measurement_id,
         h."revision" AS head_revision,
         p."status"::TEXT AS project_status
    INTO v_measurement
    FROM "TaskProgressMeasurement" m
    JOIN "TaskProgressMeasurementHead" h
      ON h."organizationId" = m."organizationId"
     AND h."projectId" = m."projectId"
     AND h."taskId" = m."taskId"
     AND h."id" = m."headId"
    JOIN "Project" p
      ON p."organizationId" = m."organizationId" AND p."id" = m."projectId"
   WHERE m."organizationId" = p_organization_id
     AND m."projectId" = p_project_id
     AND m."id" = p_measurement_id
   FOR UPDATE OF h;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_SCOPE_INVALID: tenant-scoped progress measurement head was not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_measurement.project_status NOT IN ('PLANNING', 'ACTIVE', 'PAUSED') THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PROJECT_READ_ONLY: project is read-only for progress measurement review'
      USING ERRCODE = '55000';
  END IF;
  IF v_measurement."preparedByMembershipId" = p_actor_membership_id THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_ACTOR_FORBIDDEN: maker and checker memberships must be different' USING ERRCODE = '42501';
  END IF;
  IF v_measurement.pending_measurement_id IS DISTINCT FROM p_measurement_id
    OR v_measurement.head_measurement_id IS DISTINCT FROM p_measurement_id THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_HEAD_STALE: only the currently submitted head measurement may be reviewed'
      USING ERRCODE = '40001';
  END IF;
  IF v_measurement.head_revision IS DISTINCT FROM p_expected_head_revision THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_REVISION_STALE: stale expected progress measurement head revision'
      USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "TaskProgressMeasurementDecision" d
     WHERE d."organizationId" = p_organization_id
       AND d."projectId" = p_project_id
       AND d."taskId" = v_measurement."taskId"
       AND d."measurementId" = p_measurement_id
  ) THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_ALREADY_REVIEWED: measurement already has an append-only decision' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_balance
    FROM "TaskProgressMeasurementBalance" b
   WHERE b."organizationId" = p_organization_id
     AND b."projectId" = p_project_id
     AND b."taskId" = v_measurement."taskId"
   FOR UPDATE;

  IF p_decision = 'APPROVED' THEN
    IF v_balance.id IS NULL THEN
      v_derived_cumulative := v_measurement."periodQuantity";
      v_balance_revision_after_decision := 1;
      IF v_measurement."cumulativeQuantity" IS DISTINCT FROM v_derived_cumulative THEN
        RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PROJECTION_STALE: submitted cumulative quantity no longer matches the database projection'
          USING ERRCODE = '40001';
      END IF;
    ELSE
      v_balance_revision_after_decision := v_balance."revision" + 1;
      IF v_balance."unitCode" IS DISTINCT FROM v_measurement."unitCode"
        OR v_balance."baseQuantity" IS DISTINCT FROM v_measurement."baseQuantity" THEN
        RAISE EXCEPTION 'PROGRESS_MEASUREMENT_BASIS_MISMATCH: approved base quantity and unit are fixed for the task'
          USING ERRCODE = '23514';
      END IF;
      IF v_measurement.period_start < v_balance."lastApprovedPeriodStart" THEN
        RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PERIOD_CONFLICT: measurement periods must be approved chronologically'
          USING ERRCODE = '23514';
      ELSIF v_measurement.period_start = v_balance."lastApprovedPeriodStart" THEN
        IF v_measurement.approved_measurement_id IS DISTINCT FROM v_balance."lastApprovedMeasurementId" THEN
          RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PERIOD_CONFLICT: only the latest approved period may be corrected'
            USING ERRCODE = '23514';
        END IF;
        SELECT prior."periodQuantity" INTO v_prior_period_quantity
          FROM "TaskProgressMeasurement" prior
         WHERE prior."organizationId" = p_organization_id
           AND prior."projectId" = p_project_id
           AND prior."taskId" = v_measurement."taskId"
           AND prior."id" = v_balance."lastApprovedMeasurementId";
        v_derived_cumulative := v_balance."approvedCumulativeQuantity"
          - v_prior_period_quantity + v_measurement."periodQuantity";
      ELSE
        v_derived_cumulative := v_balance."approvedCumulativeQuantity"
          + v_measurement."periodQuantity";
      END IF;
      IF v_measurement."cumulativeQuantity" IS DISTINCT FROM v_derived_cumulative THEN
        RAISE EXCEPTION 'PROGRESS_MEASUREMENT_PROJECTION_STALE: submitted cumulative quantity no longer matches the database projection'
          USING ERRCODE = '40001';
      END IF;
    END IF;
    IF v_derived_cumulative < 0 OR v_derived_cumulative > v_measurement."baseQuantity" THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_OVER_BASELINE: approval would exceed the fixed base quantity' USING ERRCODE = '23514';
    END IF;
    v_approved_cumulative_after_decision := v_derived_cumulative;
  ELSE
    v_approved_cumulative_after_decision := COALESCE(
      v_balance."approvedCumulativeQuantity", 0::NUMERIC(18,4)
    );
    v_balance_revision_after_decision := COALESCE(v_balance."revision", 0);
  END IF;

  PERFORM set_config('obrasaas.progress_measurement_write_scope', v_scope, true);
  INSERT INTO "TaskProgressMeasurementDecision" (
    "id", "organizationId", "projectId", "taskId", "measurementId", "decision", "reason",
    "expectedHeadRevision", "headRevisionAfterDecision",
    "approvedCumulativeQuantityAfterDecision", "balanceRevisionAfterDecision",
    "decidedByMembershipId", "operationKeyHash",
    "requestFingerprint", "createdAt"
  ) VALUES (
    v_decision_id, p_organization_id, p_project_id, v_measurement."taskId", p_measurement_id,
    p_decision::"ProgressMeasurementDecisionType", p_reason, p_expected_head_revision,
    p_expected_head_revision + 1, v_approved_cumulative_after_decision,
    v_balance_revision_after_decision,
    p_actor_membership_id, v_operation_hash, p_request_fingerprint, CURRENT_TIMESTAMP
  );

  IF p_decision = 'APPROVED' THEN
    IF v_balance.id IS NULL THEN
      INSERT INTO "TaskProgressMeasurementBalance" (
        "id", "organizationId", "projectId", "taskId", "unitCode", "baseQuantity",
        "approvedCumulativeQuantity", "lastApprovedHeadId", "lastApprovedMeasurementId",
        "lastApprovedPeriodStart", "revision", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::TEXT, p_organization_id, p_project_id, v_measurement."taskId",
        v_measurement."unitCode", v_measurement."baseQuantity", v_derived_cumulative,
        v_measurement."headId", p_measurement_id, v_measurement.period_start,
        1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    ELSE
      UPDATE "TaskProgressMeasurementBalance"
         SET "approvedCumulativeQuantity" = v_derived_cumulative,
             "lastApprovedHeadId" = v_measurement."headId",
             "lastApprovedMeasurementId" = p_measurement_id,
             "lastApprovedPeriodStart" = v_measurement.period_start,
             "revision" = "revision" + 1,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "organizationId" = p_organization_id
         AND "projectId" = p_project_id
         AND "taskId" = v_measurement."taskId";
    END IF;

    UPDATE "TaskProgressMeasurementHead"
       SET "pendingMeasurementId" = NULL,
           "approvedMeasurementId" = p_measurement_id,
           "revision" = "revision" + 1,
           "updatedAt" = CURRENT_TIMESTAMP
     WHERE "organizationId" = p_organization_id
       AND "projectId" = p_project_id
       AND "taskId" = v_measurement."taskId"
       AND "id" = v_measurement."headId"
       AND "revision" = p_expected_head_revision;
  ELSE
    UPDATE "TaskProgressMeasurementHead"
       SET "pendingMeasurementId" = NULL,
           "revision" = "revision" + 1,
           "updatedAt" = CURRENT_TIMESTAMP
     WHERE "organizationId" = p_organization_id
       AND "projectId" = p_project_id
       AND "taskId" = v_measurement."taskId"
       AND "id" = v_measurement."headId"
       AND "revision" = p_expected_head_revision;
  END IF;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_REVISION_STALE: progress measurement head changed during review' USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('obrasaas.progress_measurement_write_scope', '', true);

  RETURN QUERY SELECT * FROM "obrasaas_progress_measurement_result"(p_measurement_id, 'REVIEW', false);
END;
$$;
