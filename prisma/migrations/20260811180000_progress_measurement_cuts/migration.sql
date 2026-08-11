-- S9.2-MED: immutable, reproducible technical progress cut per project and
-- closed civil fortnight. This artifact deliberately contains no money,
-- certificate, payment or Task.progress mutation.

CREATE TYPE "ProgressMeasurementCutLineState" AS ENUM ('MEASURED', 'MISSING');

-- Exact structural identities consumed by the cut ledger.
CREATE UNIQUE INDEX "TPMHead_cut_period_scope_key"
  ON "TaskProgressMeasurementHead"(
    "organizationId", "projectId", "taskId", "periodStart", "periodEnd", "id"
  );
CREATE UNIQUE INDEX "TPMDecision_approved_cut_scope_key"
  ON "TaskProgressMeasurementDecision"(
    "organizationId", "projectId", "taskId", "measurementId", "id", "decision"
  );

CREATE TABLE "ProjectProgressMeasurementCutHead" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "currentCutId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectProgressMeasurementCutHead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PPMCutHead_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "PPMCutHead_civil_fortnight_check" CHECK (
    (EXTRACT(DAY FROM "periodStart") = 1 AND "periodEnd" = "periodStart" + 14)
    OR
    (EXTRACT(DAY FROM "periodStart") = 16 AND "periodEnd" =
      (date_trunc('month', "periodStart"::timestamp) + interval '1 month - 1 day')::date)
  )
);

CREATE TABLE "ProjectProgressMeasurementCut" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "headId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "taskCount" INTEGER NOT NULL,
  "measuredLineCount" INTEGER NOT NULL,
  "missingLineCount" INTEGER NOT NULL,
  "candidateSha256" CHAR(64) NOT NULL,
  "cutSha256" CHAR(64) NOT NULL,
  "headRevisionAtSeal" INTEGER NOT NULL,
  "sealedByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectProgressMeasurementCut_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PPMCut_version_check" CHECK ("version" >= 1),
  CONSTRAINT "PPMCut_counts_check" CHECK (
    "taskCount" BETWEEN 1 AND 5000
    AND "measuredLineCount" BETWEEN 1 AND "taskCount"
    AND "missingLineCount" >= 0
    AND "taskCount" = "measuredLineCount" + "missingLineCount"
  ),
  CONSTRAINT "PPMCut_receipt_check" CHECK ("headRevisionAtSeal" = "version"),
  CONSTRAINT "PPMCut_candidate_hash_check" CHECK ("candidateSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PPMCut_hash_check" CHECK ("cutSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PPMCut_operation_hash_check" CHECK ("operationKeyHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PPMCut_request_fingerprint_check" CHECK ("requestFingerprint" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "ProjectProgressMeasurementCutLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "cutHeadId" TEXT NOT NULL,
  "cutId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "state" "ProgressMeasurementCutLineState" NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "taskId" TEXT NOT NULL,
  "taskCode" VARCHAR(64),
  "taskTitle" TEXT NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "measurementHeadId" TEXT,
  "approvedMeasurementId" TEXT,
  "approvedDecisionId" TEXT,
  "approvedDecisionSnapshot" "ProgressMeasurementDecisionType",
  "unitCode" "ProgressMeasurementUnitCode",
  "baseQuantity" DECIMAL(18,4),
  "periodQuantity" DECIMAL(18,4),
  "cumulativeQuantity" DECIMAL(18,4),
  "method" "ProgressMeasurementMethod",
  "measurementRationale" VARCHAR(1000),
  "measurementRevision" INTEGER,
  "evidenceCount" INTEGER,
  "evidenceSetHash" CHAR(64),
  "measurementDecisionCreatedAt" TIMESTAMP(3),
  "lineSnapshotSha256" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectProgressMeasurementCutLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PPMCutLine_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 5000),
  CONSTRAINT "PPMCutLine_task_revision_check" CHECK ("taskRevision" >= 0),
  CONSTRAINT "PPMCutLine_hash_check" CHECK ("lineSnapshotSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PPMCutLine_source_shape_check" CHECK (
    (
      "state" = 'MEASURED'
      AND "measurementHeadId" IS NOT NULL
      AND "approvedMeasurementId" IS NOT NULL
      AND "approvedDecisionId" IS NOT NULL
      AND "approvedDecisionSnapshot" = 'APPROVED'
      AND "unitCode" IS NOT NULL
      AND "baseQuantity" > 0
      AND "periodQuantity" > 0
      AND "cumulativeQuantity" >= 0
      AND "cumulativeQuantity" <= "baseQuantity"
      AND "method" IS NOT NULL
      AND "measurementRationale" IS NOT NULL
      AND "measurementRevision" >= 1
      AND "evidenceCount" BETWEEN 1 AND 10
      AND "evidenceSetHash" ~ '^[a-f0-9]{64}$'
      AND "measurementDecisionCreatedAt" IS NOT NULL
    )
    OR
    (
      "state" = 'MISSING'
      AND "measurementHeadId" IS NULL
      AND "approvedMeasurementId" IS NULL
      AND "approvedDecisionId" IS NULL
      AND "approvedDecisionSnapshot" IS NULL
      AND "unitCode" IS NULL
      AND "baseQuantity" IS NULL
      AND "periodQuantity" IS NULL
      AND "cumulativeQuantity" IS NULL
      AND "method" IS NULL
      AND "measurementRationale" IS NULL
      AND "measurementRevision" IS NULL
      AND "evidenceCount" IS NULL
      AND "evidenceSetHash" IS NULL
      AND "measurementDecisionCreatedAt" IS NULL
    )
  )
);

CREATE UNIQUE INDEX "PPMCutHead_scope_period_key"
  ON "ProjectProgressMeasurementCutHead"("organizationId", "projectId", "periodStart");
CREATE UNIQUE INDEX "PPMCutHead_scope_id_key"
  ON "ProjectProgressMeasurementCutHead"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "PPMCutHead_scope_period_id_key"
  ON "ProjectProgressMeasurementCutHead"(
    "organizationId", "projectId", "id", "periodStart", "periodEnd"
  );
CREATE UNIQUE INDEX "PPMCutHead_current_cut_key"
  ON "ProjectProgressMeasurementCutHead"("currentCutId");
CREATE UNIQUE INDEX "PPMCutHead_scope_current_cut_key"
  ON "ProjectProgressMeasurementCutHead"("organizationId", "projectId", "currentCutId");
CREATE UNIQUE INDEX "PPMCutHead_exact_current_cut_key"
  ON "ProjectProgressMeasurementCutHead"("organizationId", "projectId", "id", "currentCutId");
CREATE INDEX "PPMCutHead_project_period_idx"
  ON "ProjectProgressMeasurementCutHead"("organizationId", "projectId", "periodStart");

CREATE UNIQUE INDEX "PPMCut_org_operation_hash_key"
  ON "ProjectProgressMeasurementCut"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "PPMCut_head_version_key"
  ON "ProjectProgressMeasurementCut"("headId", "version");
CREATE UNIQUE INDEX "PPMCut_predecessor_key"
  ON "ProjectProgressMeasurementCut"("predecessorId");
CREATE UNIQUE INDEX "PPMCut_scope_id_key"
  ON "ProjectProgressMeasurementCut"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "PPMCut_scope_head_id_key"
  ON "ProjectProgressMeasurementCut"("organizationId", "projectId", "headId", "id");
CREATE UNIQUE INDEX "PPMCut_scope_predecessor_key"
  ON "ProjectProgressMeasurementCut"("organizationId", "projectId", "predecessorId");
CREATE UNIQUE INDEX "PPMCut_exact_predecessor_key"
  ON "ProjectProgressMeasurementCut"(
    "organizationId", "projectId", "headId", "predecessorId"
  );
CREATE INDEX "PPMCut_project_created_idx"
  ON "ProjectProgressMeasurementCut"("organizationId", "projectId", "createdAt");

CREATE UNIQUE INDEX "PPMCutLine_cut_ordinal_key"
  ON "ProjectProgressMeasurementCutLine"("cutId", "ordinal");
CREATE UNIQUE INDEX "PPMCutLine_cut_task_key"
  ON "ProjectProgressMeasurementCutLine"("cutId", "taskId");
CREATE UNIQUE INDEX "PPMCutLine_scope_id_key"
  ON "ProjectProgressMeasurementCutLine"("organizationId", "projectId", "cutId", "id");
CREATE INDEX "PPMCutLine_task_created_idx"
  ON "ProjectProgressMeasurementCutLine"("organizationId", "projectId", "taskId", "createdAt");

ALTER TABLE "ProjectProgressMeasurementCutHead"
  ADD CONSTRAINT "PPMCutHead_organization_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutHead_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectProgressMeasurementCut"
  ADD CONSTRAINT "PPMCut_organization_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCut_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCut_head_scope_fkey" FOREIGN KEY ("organizationId", "projectId", "headId")
    REFERENCES "ProjectProgressMeasurementCutHead"("organizationId", "projectId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCut_predecessor_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "headId", "predecessorId")
    REFERENCES "ProjectProgressMeasurementCut"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCut_sealer_membership_fkey"
    FOREIGN KEY ("organizationId", "sealedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectProgressMeasurementCutLine"
  ADD CONSTRAINT "PPMCutLine_organization_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_project_scope_fkey" FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_cut_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "cutHeadId", "cutId")
    REFERENCES "ProjectProgressMeasurementCut"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_cut_head_period_fkey"
    FOREIGN KEY ("organizationId", "projectId", "cutHeadId", "periodStart", "periodEnd")
    REFERENCES "ProjectProgressMeasurementCutHead"(
      "organizationId", "projectId", "id", "periodStart", "periodEnd"
    ) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_task_scope_fkey" FOREIGN KEY ("projectId", "taskId")
    REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_measurement_head_scope_fkey"
    FOREIGN KEY (
      "organizationId", "projectId", "taskId", "periodStart", "periodEnd", "measurementHeadId"
    ) REFERENCES "TaskProgressMeasurementHead"(
      "organizationId", "projectId", "taskId", "periodStart", "periodEnd", "id"
    ) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_measurement_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "taskId", "approvedMeasurementId")
    REFERENCES "TaskProgressMeasurement"("organizationId", "projectId", "taskId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PPMCutLine_decision_scope_fkey"
    FOREIGN KEY (
      "organizationId", "projectId", "taskId", "approvedMeasurementId",
      "approvedDecisionId", "approvedDecisionSnapshot"
    ) REFERENCES "TaskProgressMeasurementDecision"(
      "organizationId", "projectId", "taskId", "measurementId", "id", "decision"
    ) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectProgressMeasurementCutHead"
  ADD CONSTRAINT "PPMCutHead_current_cut_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "id", "currentCutId")
    REFERENCES "ProjectProgressMeasurementCut"("organizationId", "projectId", "headId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "obrasaas_progress_measurement_cut_line_sha"(
  p_state TEXT,
  p_task_id TEXT,
  p_task_code TEXT,
  p_task_title TEXT,
  p_task_revision INTEGER,
  p_period_start DATE,
  p_period_end DATE,
  p_measurement_head_id TEXT,
  p_measurement_id TEXT,
  p_decision_id TEXT,
  p_unit_code TEXT,
  p_base_quantity NUMERIC,
  p_period_quantity NUMERIC,
  p_cumulative_quantity NUMERIC,
  p_method TEXT,
  p_rationale TEXT,
  p_measurement_revision INTEGER,
  p_evidence_count INTEGER,
  p_evidence_set_hash TEXT,
  p_decision_created_at TIMESTAMP
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-progress-measurement-cut-line-v1',
    p_state,
    p_task_id,
    p_task_code,
    p_task_title,
    p_task_revision,
    to_char(p_period_start, 'YYYY-MM-DD'),
    to_char(p_period_end, 'YYYY-MM-DD'),
    p_measurement_head_id,
    p_measurement_id,
    p_decision_id,
    p_unit_code,
    CASE WHEN p_base_quantity IS NULL THEN NULL
      ELSE to_char(p_base_quantity, 'FM99999999999999.0000') END,
    CASE WHEN p_period_quantity IS NULL THEN NULL
      ELSE to_char(p_period_quantity, 'FM99999999999999.0000') END,
    CASE WHEN p_cumulative_quantity IS NULL THEN NULL
      ELSE to_char(p_cumulative_quantity, 'FM99999999999999.0000') END,
    p_method,
    p_rationale,
    p_measurement_revision,
    p_evidence_count,
    p_evidence_set_hash,
    CASE WHEN p_decision_created_at IS NULL THEN NULL ELSE
      to_char(p_decision_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    END
  )::TEXT, 'UTF8')), 'hex');
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_append_only_guard"()
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
  v_scope := current_setting('obrasaas.progress_measurement_cut_write_scope', true);
  IF pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION 'direct progress measurement cut ledger writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  IF v_scope IS DISTINCT FROM
    NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."headId" THEN
    RAISE EXCEPTION 'direct progress measurement cut ledger writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- The public function writes only to this zero-row command view. Its INSTEAD OF
-- trigger executes the complete governed seal at trigger depth 1; the resulting
-- Cut, Line and Head writes therefore reach their ENABLE ALWAYS guards at depth
-- 2. A DML caller can invoke the same command surface directly, but cannot bypass
-- any validation or supply receipt/fact fields: the trigger derives all of them.
CREATE VIEW "ObrasaasProgressMeasurementCutSealCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::DATE AS "periodStart",
  NULL::DATE AS "periodEnd",
  NULL::TEXT AS "expectedHeadCutId",
  NULL::TEXT AS "expectedCandidateSha256",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::TEXT AS "cutId",
  NULL::INTEGER AS "cutVersion",
  NULL::INTEGER AS "taskCount",
  NULL::INTEGER AS "measuredLineCount",
  NULL::INTEGER AS "missingLineCount",
  NULL::TEXT AS "snapshotSha256",
  NULL::TEXT AS "sealedByMembershipId",
  NULL::TIMESTAMP AS "sealedAt",
  NULL::INTEGER AS "headRevision",
  NULL::BOOLEAN AS "replayed"
WHERE FALSE;

CREATE FUNCTION "obrasaas_progress_measurement_cut_seal_command"()
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
    RAISE EXCEPTION 'progress measurement cut command requires its governed insert trigger'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO STRICT v_result
    FROM "obrasaas_progress_measurement_cut_seal_worker"(
      NEW."organizationId",
      NEW."projectId",
      NEW."periodStart",
      NEW."periodEnd",
      NEW."expectedHeadCutId",
      NEW."expectedCandidateSha256",
      NEW."operationKey",
      NEW."requestFingerprint",
      NEW."actorMembershipId"
    );

  NEW."cutId" := v_result.cut_id;
  NEW."organizationId" := v_result.organization_id;
  NEW."projectId" := v_result.project_id;
  NEW."periodStart" := v_result.period_start;
  NEW."periodEnd" := v_result.period_end;
  NEW."cutVersion" := v_result.cut_version;
  NEW."taskCount" := v_result.task_count;
  NEW."measuredLineCount" := v_result.measured_line_count;
  NEW."missingLineCount" := v_result.missing_line_count;
  NEW."snapshotSha256" := v_result.snapshot_sha256;
  NEW."sealedByMembershipId" := v_result.sealed_by_membership_id;
  NEW."sealedAt" := v_result.sealed_at;
  NEW."headRevision" := v_result.head_revision;
  NEW."replayed" := v_result.replayed;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ObrasaasProgressMeasurementCutSealCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProgressMeasurementCutSealCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_cut_seal_command"();

-- PostgreSQL does not support ENABLE ALWAYS on a view. This ordinary INSTEAD OF
-- trigger is fail-closed under replica mode: if skipped, the constant zero-row
-- view is not automatically updatable and no Cut, Line or Head write can occur.
-- The three fact/projection guards reached by the governed path remain ALWAYS.

CREATE FUNCTION "obrasaas_progress_measurement_cut_seal"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_expected_head_cut_id TEXT,
  p_expected_candidate_sha256 TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  cut_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  period_start DATE,
  period_end DATE,
  cut_version INTEGER,
  task_count INTEGER,
  measured_line_count INTEGER,
  missing_line_count INTEGER,
  snapshot_sha256 TEXT,
  sealed_by_membership_id TEXT,
  sealed_at TIMESTAMP,
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
  INSERT INTO "ObrasaasProgressMeasurementCutSealCommand" AS command (
    "organizationId", "projectId", "periodStart", "periodEnd",
    "expectedHeadCutId", "expectedCandidateSha256", "operationKey",
    "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_period_start, p_period_end,
    p_expected_head_cut_id, p_expected_candidate_sha256, p_operation_key,
    p_request_fingerprint, p_actor_membership_id
  )
  RETURNING
    command."cutId",
    command."organizationId",
    command."projectId",
    command."periodStart",
    command."periodEnd",
    command."cutVersion",
    command."taskCount",
    command."measuredLineCount",
    command."missingLineCount",
    command."snapshotSha256",
    command."sealedByMembershipId",
    command."sealedAt",
    command."headRevision",
    command."replayed";
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_scope TEXT;
  v_expected_hash TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;

  v_scope := current_setting('obrasaas.progress_measurement_cut_write_scope', true);
  IF pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION 'direct progress measurement cut line writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  IF v_scope IS DISTINCT FROM
    NEW."organizationId" || ':' || NEW."projectId" || ':' || NEW."cutHeadId" THEN
    RAISE EXCEPTION 'direct progress measurement cut line writes are forbidden'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
    FROM "ProjectProgressMeasurementCut" c
    JOIN "ProjectProgressMeasurementCutHead" ch
      ON ch."organizationId" = c."organizationId"
     AND ch."projectId" = c."projectId"
     AND ch."id" = c."headId"
   WHERE c."organizationId" = NEW."organizationId"
     AND c."projectId" = NEW."projectId"
     AND c."headId" = NEW."cutHeadId"
     AND c."id" = NEW."cutId"
     AND ch."periodStart" = NEW."periodStart"
     AND ch."periodEnd" = NEW."periodEnd";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_LINE_SCOPE_INVALID: line and cut period do not match'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1
    FROM "Task" t
   WHERE t."projectId" = NEW."projectId"
     AND t."id" = NEW."taskId"
     AND t."type" = 'TASK'
     AND t."metadata" ->> 'source' = 'canonical-task-v1'
     AND t."code" IS NOT DISTINCT FROM NEW."taskCode"
     AND t."title" = NEW."taskTitle"
     AND t."revision" = NEW."taskRevision";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_TASK_SNAPSHOT_INVALID: line task snapshot is not canonical/current at seal'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."state" = 'MEASURED' THEN
    PERFORM 1
      FROM "TaskProgressMeasurementHead" h
      JOIN "TaskProgressMeasurement" m
        ON m."organizationId" = h."organizationId"
       AND m."projectId" = h."projectId"
       AND m."taskId" = h."taskId"
       AND m."id" = h."approvedMeasurementId"
      JOIN "TaskProgressMeasurementDecision" d
        ON d."organizationId" = m."organizationId"
       AND d."projectId" = m."projectId"
       AND d."taskId" = m."taskId"
       AND d."measurementId" = m."id"
       AND d."decision" = 'APPROVED'
     WHERE h."organizationId" = NEW."organizationId"
       AND h."projectId" = NEW."projectId"
       AND h."taskId" = NEW."taskId"
       AND h."periodStart" = NEW."periodStart"
       AND h."periodEnd" = NEW."periodEnd"
       AND h."id" = NEW."measurementHeadId"
       AND h."approvedMeasurementId" = NEW."approvedMeasurementId"
       AND d."id" = NEW."approvedDecisionId"
       AND NEW."approvedDecisionSnapshot" = 'APPROVED'
       AND m."unitCode" IS NOT DISTINCT FROM NEW."unitCode"
       AND m."baseQuantity" IS NOT DISTINCT FROM NEW."baseQuantity"
       AND m."periodQuantity" IS NOT DISTINCT FROM NEW."periodQuantity"
       AND m."cumulativeQuantity" IS NOT DISTINCT FROM NEW."cumulativeQuantity"
       AND m."method" IS NOT DISTINCT FROM NEW."method"
       AND m."rationale" IS NOT DISTINCT FROM NEW."measurementRationale"
       AND m."revision" IS NOT DISTINCT FROM NEW."measurementRevision"
       AND m."evidenceCount" IS NOT DISTINCT FROM NEW."evidenceCount"
       AND m."evidenceSetHash" IS NOT DISTINCT FROM NEW."evidenceSetHash"
       AND d."createdAt" IS NOT DISTINCT FROM NEW."measurementDecisionCreatedAt";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_SOURCE_INVALID: measured line is not the approved period head snapshot'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
        FROM "TaskProgressMeasurementHead" h
       WHERE h."organizationId" = NEW."organizationId"
         AND h."projectId" = NEW."projectId"
         AND h."taskId" = NEW."taskId"
         AND h."periodStart" = NEW."periodStart"
         AND h."periodEnd" = NEW."periodEnd"
         AND h."approvedMeasurementId" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_SOURCE_INVALID: missing line has an approved period measurement'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  v_expected_hash := "obrasaas_progress_measurement_cut_line_sha"(
    NEW."state"::TEXT,
    NEW."taskId",
    NEW."taskCode",
    NEW."taskTitle",
    NEW."taskRevision",
    NEW."periodStart",
    NEW."periodEnd",
    NEW."measurementHeadId",
    NEW."approvedMeasurementId",
    NEW."approvedDecisionId",
    NEW."unitCode"::TEXT,
    NEW."baseQuantity",
    NEW."periodQuantity",
    NEW."cumulativeQuantity",
    NEW."method"::TEXT,
    NEW."measurementRationale",
    NEW."measurementRevision",
    NEW."evidenceCount",
    NEW."evidenceSetHash",
    NEW."measurementDecisionCreatedAt"
  );
  IF NEW."lineSnapshotSha256" IS DISTINCT FROM v_expected_hash THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_LINE_HASH_INVALID: line snapshot hash mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_projection_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_scope TEXT;
  v_organization_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."organizationId" ELSE NEW."organizationId" END;
  v_project_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."projectId" ELSE NEW."projectId" END;
  v_head_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
BEGIN
  v_scope := current_setting('obrasaas.progress_measurement_cut_write_scope', true);
  IF pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION 'direct progress measurement cut projection writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  IF v_scope IS DISTINCT FROM v_organization_id || ':' || v_project_id || ':' || v_head_id THEN
    RAISE EXCEPTION 'direct progress measurement cut projection writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% cannot be truncated', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ProjectProgressMeasurementCut_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectProgressMeasurementCut"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_cut_append_only_guard"();
CREATE TRIGGER "ProjectProgressMeasurementCut_no_truncate"
BEFORE TRUNCATE ON "ProjectProgressMeasurementCut"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_cut_no_truncate"();

CREATE TRIGGER "ProjectProgressMeasurementCutLine_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectProgressMeasurementCutLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_cut_line_guard"();
CREATE TRIGGER "ProjectProgressMeasurementCutLine_no_truncate"
BEFORE TRUNCATE ON "ProjectProgressMeasurementCutLine"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_cut_no_truncate"();

CREATE TRIGGER "ProjectProgressMeasurementCutHead_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectProgressMeasurementCutHead"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_progress_measurement_cut_projection_guard"();
CREATE TRIGGER "ProjectProgressMeasurementCutHead_no_truncate"
BEFORE TRUNCATE ON "ProjectProgressMeasurementCutHead"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_progress_measurement_cut_no_truncate"();

ALTER TABLE "ProjectProgressMeasurementCut"
  ENABLE ALWAYS TRIGGER "ProjectProgressMeasurementCut_append_only";
ALTER TABLE "ProjectProgressMeasurementCut"
  ENABLE ALWAYS TRIGGER "ProjectProgressMeasurementCut_no_truncate";
ALTER TABLE "ProjectProgressMeasurementCutLine"
  ENABLE ALWAYS TRIGGER "ProjectProgressMeasurementCutLine_append_only";
ALTER TABLE "ProjectProgressMeasurementCutLine"
  ENABLE ALWAYS TRIGGER "ProjectProgressMeasurementCutLine_no_truncate";
ALTER TABLE "ProjectProgressMeasurementCutHead"
  ENABLE ALWAYS TRIGGER "ProjectProgressMeasurementCutHead_projection_guard";
ALTER TABLE "ProjectProgressMeasurementCutHead"
  ENABLE ALWAYS TRIGGER "ProjectProgressMeasurementCutHead_no_truncate";

-- Single canonical builder reused by reads and seals. Quantities are encoded
-- as fixed four-decimal strings before hashing or crossing the SQL boundary.
CREATE FUNCTION "obrasaas_progress_measurement_cut_build_candidate"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE(
  task_count INTEGER,
  measured_line_count INTEGER,
  missing_line_count INTEGER,
  review_pending BOOLEAN,
  candidate_sha256 TEXT,
  internal_lines JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_task_count INTEGER;
  v_measured_count INTEGER;
  v_missing_count INTEGER;
  v_invalid_count INTEGER;
  v_review_pending BOOLEAN;
  v_candidate_sha256 TEXT;
  v_internal_lines JSONB;
BEGIN
  PERFORM 1
    FROM "Project" p
   WHERE p."organizationId" = p_organization_id AND p."id" = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_SCOPE_INVALID: tenant-scoped project was not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::INTEGER
    INTO v_task_count
    FROM "Task" t
   WHERE t."projectId" = p_project_id
     AND t."type" = 'TASK'
     AND t."metadata" ->> 'source' = 'canonical-task-v1';

  IF v_task_count > 5000 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_TOO_LARGE: canonical task count exceeds 5000; the cut is never truncated'
      USING ERRCODE = '54000';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM "TaskProgressMeasurementHead" h
     WHERE h."organizationId" = p_organization_id
       AND h."projectId" = p_project_id
       AND h."periodStart" = p_period_start
       AND h."periodEnd" = p_period_end
       AND h."pendingMeasurementId" IS NOT NULL
  ) INTO v_review_pending;

  WITH source AS (
    SELECT
      row_number() OVER (ORDER BY t."id")::INTEGER AS ordinal,
      t."id" AS task_id,
      t."code" AS task_code,
      t."title" AS task_title,
      t."revision" AS task_revision,
      h."id" AS measurement_head_id,
      h."approvedMeasurementId" AS approved_measurement_id,
      m."revision" AS measurement_revision,
      m."unitCode"::TEXT AS unit_code,
      m."baseQuantity" AS base_quantity,
      m."periodQuantity" AS period_quantity,
      m."cumulativeQuantity" AS cumulative_quantity,
      m."method"::TEXT AS method,
      m."rationale"::TEXT AS rationale,
      m."evidenceCount" AS evidence_count,
      m."evidenceSetHash"::TEXT AS evidence_set_hash,
      d."id" AS approved_decision_id,
      d."createdAt" AS decision_created_at,
      CASE WHEN h."approvedMeasurementId" IS NULL THEN 'MISSING' ELSE 'MEASURED' END AS line_state,
      CASE
        WHEN h."approvedMeasurementId" IS NULL THEN TRUE
        ELSE m."id" IS NOT NULL AND d."id" IS NOT NULL AND d."decision" = 'APPROVED'
      END AS source_valid
    FROM "Task" t
    LEFT JOIN "TaskProgressMeasurementHead" h
      ON h."organizationId" = p_organization_id
     AND h."projectId" = p_project_id
     AND h."taskId" = t."id"
     AND h."periodStart" = p_period_start
     AND h."periodEnd" = p_period_end
    LEFT JOIN "TaskProgressMeasurement" m
      ON m."organizationId" = h."organizationId"
     AND m."projectId" = h."projectId"
     AND m."taskId" = h."taskId"
     AND m."id" = h."approvedMeasurementId"
    LEFT JOIN "TaskProgressMeasurementDecision" d
      ON d."organizationId" = m."organizationId"
     AND d."projectId" = m."projectId"
     AND d."taskId" = m."taskId"
     AND d."measurementId" = m."id"
     AND d."decision" = 'APPROVED'
    WHERE t."projectId" = p_project_id
      AND t."type" = 'TASK'
      AND t."metadata" ->> 'source' = 'canonical-task-v1'
  ), hashed AS (
    SELECT source.*,
      "obrasaas_progress_measurement_cut_line_sha"(
        line_state,
        task_id,
        task_code,
        task_title,
        task_revision,
        p_period_start,
        p_period_end,
        CASE WHEN line_state = 'MEASURED' THEN measurement_head_id ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN approved_measurement_id ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN approved_decision_id ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN unit_code ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN base_quantity ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN period_quantity ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN cumulative_quantity ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN method ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN rationale ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN measurement_revision ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN evidence_count ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN evidence_set_hash ELSE NULL END,
        CASE WHEN line_state = 'MEASURED' THEN decision_created_at ELSE NULL END
      ) AS line_snapshot_sha256
    FROM source
  )
  SELECT
    count(*) FILTER (WHERE line_state = 'MEASURED')::INTEGER,
    count(*) FILTER (WHERE line_state = 'MISSING')::INTEGER,
    count(*) FILTER (WHERE NOT source_valid)::INTEGER,
    COALESCE(jsonb_agg(jsonb_build_object(
      'ordinal', ordinal,
      'state', line_state,
      'task_id', task_id,
      'task_code', task_code,
      'task_title', task_title,
      'task_revision', task_revision,
      'period_start', to_char(p_period_start, 'YYYY-MM-DD'),
      'period_end', to_char(p_period_end, 'YYYY-MM-DD'),
      'measurement_head_id', CASE WHEN line_state = 'MEASURED' THEN measurement_head_id ELSE NULL END,
      'approved_measurement_id', CASE WHEN line_state = 'MEASURED' THEN approved_measurement_id ELSE NULL END,
      'approved_decision_id', CASE WHEN line_state = 'MEASURED' THEN approved_decision_id ELSE NULL END,
      'approved_decision_snapshot', CASE WHEN line_state = 'MEASURED' THEN 'APPROVED' ELSE NULL END,
      'unit_code', CASE WHEN line_state = 'MEASURED' THEN unit_code ELSE NULL END,
      'base_quantity', CASE WHEN line_state = 'MEASURED'
        THEN to_char(base_quantity, 'FM99999999999999.0000') ELSE NULL END,
      'period_quantity', CASE WHEN line_state = 'MEASURED'
        THEN to_char(period_quantity, 'FM99999999999999.0000') ELSE NULL END,
      'cumulative_quantity', CASE WHEN line_state = 'MEASURED'
        THEN to_char(cumulative_quantity, 'FM99999999999999.0000') ELSE NULL END,
      'method', CASE WHEN line_state = 'MEASURED' THEN method ELSE NULL END,
      'rationale', CASE WHEN line_state = 'MEASURED' THEN rationale ELSE NULL END,
      'measurement_revision', CASE WHEN line_state = 'MEASURED' THEN measurement_revision ELSE NULL END,
      'evidence_count', CASE WHEN line_state = 'MEASURED' THEN evidence_count ELSE NULL END,
      'evidence_set_hash', CASE WHEN line_state = 'MEASURED' THEN evidence_set_hash ELSE NULL END,
      'decision_created_at', CASE WHEN line_state = 'MEASURED' THEN
        to_char(decision_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ELSE NULL END,
      'line_snapshot_sha256', line_snapshot_sha256
    ) ORDER BY task_id), '[]'::JSONB),
    encode(sha256(convert_to(COALESCE(jsonb_agg(
      jsonb_build_array(task_id, line_snapshot_sha256) ORDER BY task_id
    ), '[]'::JSONB)::TEXT, 'UTF8')), 'hex')
  INTO v_measured_count, v_missing_count, v_invalid_count,
       v_internal_lines, v_candidate_sha256
  FROM hashed;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_SOURCE_INVALID: approved period head is missing its immutable APPROVED decision'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY SELECT
    v_task_count,
    COALESCE(v_measured_count, 0),
    COALESCE(v_missing_count, 0),
    v_review_pending,
    v_candidate_sha256,
    COALESCE(v_internal_lines, '[]'::JSONB);
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_read"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  organization_id TEXT,
  project_id TEXT,
  project_name TEXT,
  project_status TEXT,
  time_zone TEXT,
  tenant_today DATE,
  actor_can_seal BOOLEAN,
  period_start DATE,
  period_end DATE,
  head_current_cut_id TEXT,
  head_revision INTEGER,
  candidate_sha256 TEXT,
  task_count INTEGER,
  measured_line_count INTEGER,
  missing_line_count INTEGER,
  review_pending BOOLEAN,
  readiness TEXT,
  candidate_lines JSONB,
  current_cut JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_project_name TEXT;
  v_project_status TEXT;
  v_time_zone TEXT;
  v_tenant_today DATE;
  v_actor_role TEXT;
  v_actor_can_seal BOOLEAN;
  v_candidate RECORD;
  v_head RECORD;
  v_current_cut RECORD;
  v_current_candidate_sha256 TEXT;
  v_candidate_lines JSONB;
  v_current_lines JSONB;
  v_current_cut_json JSONB;
  v_readiness TEXT;
BEGIN
  IF p_organization_id IS NULL OR p_project_id IS NULL
    OR p_period_start IS NULL OR p_period_end IS NULL
    OR p_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'organization, project, period and actor membership are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT p."name", p."status"::TEXT, o."timezone", (CURRENT_TIMESTAMP AT TIME ZONE o."timezone")::DATE,
         tm."tenantRole"::TEXT
    INTO v_project_name, v_project_status, v_time_zone, v_tenant_today, v_actor_role
    FROM "TenantMembership" tm
    JOIN "Organization" o
      ON o."id" = tm."organizationId"
    JOIN "Project" p
      ON p."organizationId" = tm."organizationId" AND p."id" = p_project_id
   WHERE tm."organizationId" = p_organization_id
     AND tm."id" = p_actor_membership_id
     AND tm."status" = 'ACTIVE'
     AND tm."tenantRole" IN ('ADMIN', 'DIRECTOR', 'SITE_MANAGER', 'FINANCE', 'AUDITOR');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN: read requires an active authorized tenant membership'
      USING ERRCODE = '42501';
  END IF;
  v_actor_can_seal := v_actor_role IN ('ADMIN', 'DIRECTOR');

  IF NOT (
    (EXTRACT(DAY FROM p_period_start) = 1 AND p_period_end = p_period_start + 14)
    OR
    (EXTRACT(DAY FROM p_period_start) = 16 AND p_period_end =
      (date_trunc('month', p_period_start::timestamp) + interval '1 month - 1 day')::date)
  ) THEN
    RAISE EXCEPTION 'progress measurement cut period must be a civil fortnight (1-15 or 16-month end)'
      USING ERRCODE = '22023';
  END IF;
  IF p_period_end >= v_tenant_today THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_PERIOD_OPEN: only a closed tenant-local civil fortnight can be read or sealed'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_candidate
    FROM "obrasaas_progress_measurement_cut_build_candidate"(
      p_organization_id, p_project_id, p_period_start, p_period_end
    );

  SELECT h."id", h."currentCutId", h."revision"
    INTO v_head
    FROM "ProjectProgressMeasurementCutHead" h
   WHERE h."organizationId" = p_organization_id
     AND h."projectId" = p_project_id
     AND h."periodStart" = p_period_start
     AND h."periodEnd" = p_period_end;
  IF NOT FOUND THEN
    v_head.id := NULL;
    v_head."currentCutId" := NULL;
    v_head.revision := 0;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'state', line.value ->> 'state',
    'task', jsonb_build_object(
      'id', line.value ->> 'task_id',
      'code', line.value -> 'task_code',
      'title', line.value ->> 'task_title',
      'revision', (line.value ->> 'task_revision')::INTEGER
    ),
    'approvedMeasurement', CASE WHEN line.value ->> 'state' = 'MEASURED' THEN
      jsonb_build_object(
        'id', line.value ->> 'approved_measurement_id',
        'revision', (line.value ->> 'measurement_revision')::INTEGER,
        'unit', line.value ->> 'unit_code',
        'baselineQuantity', line.value ->> 'base_quantity',
        'executedQuantity', line.value ->> 'period_quantity',
        'cumulativeQuantity', line.value ->> 'cumulative_quantity',
        'method', line.value ->> 'method',
        'rationale', line.value ->> 'rationale',
        'evidenceCount', (line.value ->> 'evidence_count')::INTEGER,
        'approvedAt', line.value ->> 'decision_created_at'
      ) ELSE 'null'::JSONB END,
    'snapshotToken', line.value ->> 'line_snapshot_sha256'
  ) ORDER BY line.value ->> 'task_id'), '[]'::JSONB)
  INTO v_candidate_lines
  FROM jsonb_array_elements(v_candidate.internal_lines) line(value);

  v_current_cut_json := NULL;
  IF v_head."currentCutId" IS NOT NULL THEN
    SELECT c."id", c."version", c."predecessorId", c."taskCount",
           c."measuredLineCount", c."missingLineCount", c."candidateSha256"::TEXT,
           c."cutSha256"::TEXT, c."sealedByMembershipId", c."createdAt"
      INTO v_current_cut
      FROM "ProjectProgressMeasurementCut" c
     WHERE c."organizationId" = p_organization_id
       AND c."projectId" = p_project_id
       AND c."headId" = v_head.id
       AND c."id" = v_head."currentCutId";
    v_current_candidate_sha256 := v_current_cut."candidateSha256";

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'state', l."state"::TEXT,
      'task', jsonb_build_object(
        'id', l."taskId",
        'code', to_jsonb(l."taskCode"),
        'title', l."taskTitle",
        'revision', l."taskRevision"
      ),
      'approvedMeasurement', CASE WHEN l."state" = 'MEASURED' THEN
        jsonb_build_object(
          'id', l."approvedMeasurementId",
          'revision', l."measurementRevision",
          'unit', l."unitCode"::TEXT,
          'baselineQuantity', to_char(l."baseQuantity", 'FM99999999999999.0000'),
          'executedQuantity', to_char(l."periodQuantity", 'FM99999999999999.0000'),
          'cumulativeQuantity', to_char(l."cumulativeQuantity", 'FM99999999999999.0000'),
          'method', l."method"::TEXT,
          'rationale', l."measurementRationale",
          'evidenceCount', l."evidenceCount",
          'approvedAt', to_char(l."measurementDecisionCreatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) ELSE 'null'::JSONB END,
      'snapshotToken', l."lineSnapshotSha256"::TEXT
    ) ORDER BY l."taskId"), '[]'::JSONB)
    INTO v_current_lines
    FROM "ProjectProgressMeasurementCutLine" l
    WHERE l."organizationId" = p_organization_id
      AND l."projectId" = p_project_id
      AND l."cutHeadId" = v_head.id
      AND l."cutId" = v_current_cut.id;

    v_current_cut_json := jsonb_build_object(
      'id', v_current_cut.id,
      'previousCutId', v_current_cut."predecessorId",
      'version', v_current_cut.version,
      'taskCount', v_current_cut."taskCount",
      'measuredLineCount', v_current_cut."measuredLineCount",
      'missingLineCount', v_current_cut."missingLineCount",
      'candidateToken', v_current_cut."candidateSha256",
      'integrityDigest', v_current_cut."cutSha256",
      'sealedAt', to_char(v_current_cut."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'sealedByLabel', 'Miembro autorizado',
      'sealedByIsCurrentActor', v_current_cut."sealedByMembershipId" = p_actor_membership_id,
      'lines', v_current_lines
    );
  END IF;

  v_readiness := CASE
    WHEN v_candidate.review_pending THEN 'REVIEW_PENDING'
    WHEN v_candidate.measured_line_count = 0 THEN 'EMPTY'
    WHEN v_head."currentCutId" IS NULL THEN 'READY'
    WHEN v_current_candidate_sha256 = v_candidate.candidate_sha256 THEN 'UP_TO_DATE'
    ELSE 'STALE'
  END;

  RETURN QUERY SELECT
    p_organization_id,
    p_project_id,
    v_project_name,
    v_project_status,
    v_time_zone,
    v_tenant_today,
    v_actor_can_seal,
    p_period_start,
    p_period_end,
    v_head."currentCutId"::TEXT,
    v_head.revision::INTEGER,
    v_candidate.candidate_sha256::TEXT,
    v_candidate.task_count::INTEGER,
    v_candidate.measured_line_count::INTEGER,
    v_candidate.missing_line_count::INTEGER,
    v_candidate.review_pending::BOOLEAN,
    v_readiness,
    v_candidate_lines,
    v_current_cut_json;
END;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_result"(
  p_cut_id TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE(
  cut_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  period_start DATE,
  period_end DATE,
  cut_version INTEGER,
  task_count INTEGER,
  measured_line_count INTEGER,
  missing_line_count INTEGER,
  snapshot_sha256 TEXT,
  sealed_by_membership_id TEXT,
  sealed_at TIMESTAMP,
  head_revision INTEGER,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    c."id",
    c."organizationId",
    c."projectId",
    h."periodStart",
    h."periodEnd",
    c."version",
    c."taskCount",
    c."measuredLineCount",
    c."missingLineCount",
    c."cutSha256"::TEXT,
    c."sealedByMembershipId",
    c."createdAt",
    c."headRevisionAtSeal",
    p_replayed
  FROM "ProjectProgressMeasurementCut" c
  JOIN "ProjectProgressMeasurementCutHead" h
    ON h."organizationId" = c."organizationId"
   AND h."projectId" = c."projectId"
   AND h."id" = c."headId"
  WHERE c."id" = p_cut_id;
$$;

CREATE FUNCTION "obrasaas_progress_measurement_cut_seal_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_expected_head_cut_id TEXT,
  p_expected_candidate_sha256 TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(
  cut_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  period_start DATE,
  period_end DATE,
  cut_version INTEGER,
  task_count INTEGER,
  measured_line_count INTEGER,
  missing_line_count INTEGER,
  snapshot_sha256 TEXT,
  sealed_by_membership_id TEXT,
  sealed_at TIMESTAMP,
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
  v_tenant_today DATE;
  v_project_status TEXT;
  v_existing RECORD;
  v_candidate RECORD;
  v_head_id TEXT;
  v_current_cut_id TEXT;
  v_head_revision INTEGER;
  v_current_cut_version INTEGER;
  v_current_candidate_sha256 TEXT;
  v_cut_id TEXT := gen_random_uuid()::TEXT;
  v_cut_version INTEGER;
  v_cut_sha256 TEXT;
  v_scope TEXT;
  v_sealed_at TIMESTAMP(3) := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_rows INTEGER;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'progress measurement cut seal worker requires the governed command trigger'
      USING ERRCODE = '42501';
  END IF;

  IF p_organization_id IS NULL OR p_project_id IS NULL
    OR p_period_start IS NULL OR p_period_end IS NULL
    OR p_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'organization, project, period and actor membership are required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT (
    (EXTRACT(DAY FROM p_period_start) = 1 AND p_period_end = p_period_start + 14)
    OR
    (EXTRACT(DAY FROM p_period_start) = 16 AND p_period_end =
      (date_trunc('month', p_period_start::timestamp) + interval '1 month - 1 day')::date)
  ) THEN
    RAISE EXCEPTION 'progress measurement cut period must be a civil fortnight (1-15 or 16-month end)'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_head_cut_id IS NOT NULL
    AND length(p_expected_head_cut_id) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'expected head cut id must be null or contain 1 to 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_candidate_sha256 IS NULL
    OR p_expected_candidate_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'expected candidate sha256 must be lowercase sha256'
      USING ERRCODE = '22023';
  END IF;
  IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'operation key must contain 8 to 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'request fingerprint must be lowercase sha256'
      USING ERRCODE = '22023';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');

  -- Every mutator follows operation -> project/period -> rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progress-measurement-cut:seal:' || p_organization_id || ':' || v_operation_hash,
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progress-measurement-cut:scope:' || p_organization_id || ':' || p_project_id || ':' ||
      to_char(p_period_start, 'YYYY-MM-DD'),
    0
  ));

  SELECT (CURRENT_TIMESTAMP AT TIME ZONE o."timezone")::DATE
    INTO v_tenant_today
    FROM "TenantMembership" tm
    JOIN "Organization" o ON o."id" = tm."organizationId"
   WHERE tm."organizationId" = p_organization_id
     AND tm."id" = p_actor_membership_id
     AND tm."status" = 'ACTIVE'
     AND tm."tenantRole" IN ('ADMIN', 'DIRECTOR')
   FOR SHARE OF tm, o;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_ACTOR_FORBIDDEN: seal requires an active administrator or director membership'
      USING ERRCODE = '42501';
  END IF;

  SELECT c."id", c."projectId", c."headId", c."predecessorId",
         c."candidateSha256"::TEXT AS candidate_sha256,
         c."requestFingerprint"::TEXT AS request_fingerprint,
         c."sealedByMembershipId", h."periodStart", h."periodEnd"
    INTO v_existing
    FROM "ProjectProgressMeasurementCut" c
    JOIN "ProjectProgressMeasurementCutHead" h
      ON h."organizationId" = c."organizationId"
     AND h."projectId" = c."projectId"
     AND h."id" = c."headId"
   WHERE c."organizationId" = p_organization_id
     AND c."operationKeyHash" = v_operation_hash;
  IF FOUND THEN
    IF v_existing."projectId" IS DISTINCT FROM p_project_id
      OR v_existing."periodStart" IS DISTINCT FROM p_period_start
      OR v_existing."periodEnd" IS DISTINCT FROM p_period_end
      OR v_existing."predecessorId" IS DISTINCT FROM p_expected_head_cut_id
      OR v_existing.candidate_sha256 IS DISTINCT FROM p_expected_candidate_sha256
      OR v_existing.request_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing."sealedByMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_CONFLICT: operation key was already used with a different seal request'
        USING ERRCODE = '22000';
    END IF;
    RETURN QUERY SELECT * FROM "obrasaas_progress_measurement_cut_result"(v_existing.id, true);
    RETURN;
  END IF;

  SELECT p."status"::TEXT
    INTO v_project_status
    FROM "Project" p
   WHERE p."organizationId" = p_organization_id AND p."id" = p_project_id
   FOR SHARE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_SCOPE_INVALID: tenant-scoped project was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_project_status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_PROJECT_ARCHIVED: archived projects cannot create technical cuts'
      USING ERRCODE = '55000';
  END IF;
  IF p_period_end >= v_tenant_today THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_PERIOD_OPEN: only a closed tenant-local civil fortnight can be sealed'
      USING ERRCODE = '23514';
  END IF;

  SELECT h."id", h."currentCutId", h."revision"
    INTO v_head_id, v_current_cut_id, v_head_revision
    FROM "ProjectProgressMeasurementCutHead" h
   WHERE h."organizationId" = p_organization_id
     AND h."projectId" = p_project_id
     AND h."periodStart" = p_period_start
     AND h."periodEnd" = p_period_end
   FOR UPDATE;
  IF NOT FOUND THEN
    v_head_id := gen_random_uuid()::TEXT;
    v_current_cut_id := NULL;
    v_head_revision := 0;
  END IF;

  IF v_current_cut_id IS DISTINCT FROM p_expected_head_cut_id THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_HEAD_STALE: expected head cut does not match the current sealed cut'
      USING ERRCODE = '40001';
  END IF;

  IF v_current_cut_id IS NOT NULL THEN
    SELECT c."version", c."candidateSha256"::TEXT
      INTO v_current_cut_version, v_current_candidate_sha256
      FROM "ProjectProgressMeasurementCut" c
     WHERE c."organizationId" = p_organization_id
       AND c."projectId" = p_project_id
       AND c."headId" = v_head_id
       AND c."id" = v_current_cut_id;
    IF NOT FOUND OR v_current_cut_version IS DISTINCT FROM v_head_revision THEN
      RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_PROJECTION_INVALID: current cut and head revision diverged'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  SELECT * INTO v_candidate
    FROM "obrasaas_progress_measurement_cut_build_candidate"(
      p_organization_id, p_project_id, p_period_start, p_period_end
    );
  IF v_candidate.review_pending THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_REVIEW_PENDING: all period measurements must have an append-only decision before sealing'
      USING ERRCODE = '55000';
  END IF;
  IF v_candidate.measured_line_count < 1 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_EMPTY: at least one approved measurement is required'
      USING ERRCODE = '23514';
  END IF;
  IF v_candidate.candidate_sha256 IS DISTINCT FROM p_expected_candidate_sha256 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE: candidate composition changed before seal'
      USING ERRCODE = '40001';
  END IF;
  IF v_current_candidate_sha256 IS NOT DISTINCT FROM v_candidate.candidate_sha256 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_NO_CHANGE: current cut already seals this exact candidate composition'
      USING ERRCODE = '23514';
  END IF;

  v_cut_version := v_head_revision + 1;
  v_scope := p_organization_id || ':' || p_project_id || ':' || v_head_id;
  v_cut_sha256 := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-progress-measurement-cut-v1',
    p_organization_id,
    p_project_id,
    to_char(p_period_start, 'YYYY-MM-DD'),
    to_char(p_period_end, 'YYYY-MM-DD'),
    v_cut_version,
    v_current_cut_id,
    v_candidate.task_count,
    v_candidate.measured_line_count,
    v_candidate.missing_line_count,
    v_candidate.candidate_sha256,
    p_actor_membership_id,
    to_char(v_sealed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::TEXT, 'UTF8')), 'hex');

  PERFORM set_config('obrasaas.progress_measurement_cut_write_scope', v_scope, true);
  IF v_head_revision = 0 THEN
    INSERT INTO "ProjectProgressMeasurementCutHead" (
      "id", "organizationId", "projectId", "periodStart", "periodEnd",
      "currentCutId", "revision", "createdAt", "updatedAt"
    ) VALUES (
      v_head_id, p_organization_id, p_project_id, p_period_start, p_period_end,
      NULL, 0, v_sealed_at, v_sealed_at
    );
  END IF;

  INSERT INTO "ProjectProgressMeasurementCut" (
    "id", "organizationId", "projectId", "headId", "version", "predecessorId",
    "taskCount", "measuredLineCount", "missingLineCount", "candidateSha256",
    "cutSha256", "headRevisionAtSeal", "sealedByMembershipId",
    "operationKeyHash", "requestFingerprint", "createdAt"
  ) VALUES (
    v_cut_id, p_organization_id, p_project_id, v_head_id, v_cut_version,
    v_current_cut_id, v_candidate.task_count, v_candidate.measured_line_count,
    v_candidate.missing_line_count, v_candidate.candidate_sha256, v_cut_sha256,
    v_cut_version, p_actor_membership_id, v_operation_hash,
    p_request_fingerprint, v_sealed_at
  );

  INSERT INTO "ProjectProgressMeasurementCutLine" (
    "id", "organizationId", "projectId", "cutHeadId", "cutId", "ordinal", "state",
    "periodStart", "periodEnd", "taskId", "taskCode", "taskTitle", "taskRevision",
    "measurementHeadId", "approvedMeasurementId", "approvedDecisionId",
    "approvedDecisionSnapshot", "unitCode", "baseQuantity", "periodQuantity",
    "cumulativeQuantity", "method", "measurementRationale", "measurementRevision",
    "evidenceCount", "evidenceSetHash", "measurementDecisionCreatedAt",
    "lineSnapshotSha256", "createdAt"
  )
  SELECT
    gen_random_uuid()::TEXT, p_organization_id, p_project_id, v_head_id, v_cut_id,
    line.ordinal, line.state::"ProgressMeasurementCutLineState",
    line.period_start::DATE, line.period_end::DATE, line.task_id, line.task_code,
    line.task_title, line.task_revision, line.measurement_head_id,
    line.approved_measurement_id, line.approved_decision_id,
    line.approved_decision_snapshot::"ProgressMeasurementDecisionType",
    line.unit_code::"ProgressMeasurementUnitCode", line.base_quantity::NUMERIC(18,4),
    line.period_quantity::NUMERIC(18,4), line.cumulative_quantity::NUMERIC(18,4),
    line.method::"ProgressMeasurementMethod", line.rationale, line.measurement_revision,
    line.evidence_count, line.evidence_set_hash, line.decision_created_at::TIMESTAMP,
    line.line_snapshot_sha256, v_sealed_at
  FROM jsonb_to_recordset(v_candidate.internal_lines) AS line(
    ordinal INTEGER,
    state TEXT,
    task_id TEXT,
    task_code TEXT,
    task_title TEXT,
    task_revision INTEGER,
    period_start TEXT,
    period_end TEXT,
    measurement_head_id TEXT,
    approved_measurement_id TEXT,
    approved_decision_id TEXT,
    approved_decision_snapshot TEXT,
    unit_code TEXT,
    base_quantity TEXT,
    period_quantity TEXT,
    cumulative_quantity TEXT,
    method TEXT,
    rationale TEXT,
    measurement_revision INTEGER,
    evidence_count INTEGER,
    evidence_set_hash TEXT,
    decision_created_at TEXT,
    line_snapshot_sha256 TEXT
  )
  ORDER BY line.ordinal;

  UPDATE "ProjectProgressMeasurementCutHead"
     SET "currentCutId" = v_cut_id,
         "revision" = v_cut_version,
         "updatedAt" = v_sealed_at
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "id" = v_head_id
     AND "revision" = v_head_revision;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROGRESS_MEASUREMENT_CUT_HEAD_STALE: cut head changed during seal'
      USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('obrasaas.progress_measurement_cut_write_scope', '', true);

  RETURN QUERY SELECT * FROM "obrasaas_progress_measurement_cut_result"(v_cut_id, false);
END;
$$;
