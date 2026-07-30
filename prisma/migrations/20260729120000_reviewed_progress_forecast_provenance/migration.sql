-- Immutable bridge from a completed, human-reviewed visual assessment to a
-- deterministic schedule forecast. The observation captures the exact mutable
-- source revisions before any forecast row can consume them.
CREATE TABLE "ScheduleProgressObservation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "source" "ScheduleProgressSource" NOT NULL DEFAULT 'REVIEWED_EVIDENCE',
  "assessmentRevision" INTEGER NOT NULL,
  "evidenceRevision" INTEGER NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "evidenceSha256" CHAR(64) NOT NULL,
  "evidenceCapturedAt" TIMESTAMP(3) NOT NULL,
  "planHash" CHAR(64) NOT NULL,
  "reviewStatus" "VisualProgressAssessmentReviewStatus" NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "progressMin" INTEGER NOT NULL,
  "progressMax" INTEGER NOT NULL,
  "progressPercent" INTEGER NOT NULL,
  "decisionPolicyVersion" VARCHAR(64) NOT NULL
    DEFAULT 'human-point-within-reviewed-range-v1',
  "observedOn" DATE NOT NULL,
  "actualStart" DATE,
  "actualFinish" DATE,
  "remainingDurationDays" INTEGER,
  "rationale" VARCHAR(1000) NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleProgressObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleProgressObservation_identity_check" CHECK (
    "assessmentRevision" >= 0
    AND "evidenceRevision" >= 0
    AND "taskRevision" >= 0
    AND char_length(btrim("taskId")) > 0
    AND char_length(btrim("evidenceId")) > 0
    AND char_length(btrim("assessmentId")) > 0
    AND char_length(btrim("reviewedById")) > 0
    AND char_length(btrim("createdById")) > 0
  ),
  CONSTRAINT "ScheduleProgressObservation_provenance_check" CHECK (
    "source" = 'REVIEWED_EVIDENCE'
    AND "reviewStatus" IN ('APPROVED', 'CORRECTED')
  ),
  CONSTRAINT "ScheduleProgressObservation_hashes_check" CHECK (
    "evidenceSha256" ~ '^[0-9a-f]{64}$'
    AND "planHash" ~ '^[0-9a-f]{64}$'
    AND "operationKeyHash" ~ '^[0-9a-f]{64}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ScheduleProgressObservation_reviewed_range_check" CHECK (
    "progressMin" BETWEEN 0 AND 100
    AND "progressMax" BETWEEN 0 AND 100
    AND "progressPercent" BETWEEN 0 AND 100
    AND "progressMin" <= "progressPercent"
    AND "progressPercent" <= "progressMax"
  ),
  CONSTRAINT "ScheduleProgressObservation_decision_policy_check" CHECK (
    "decisionPolicyVersion" = 'human-point-within-reviewed-range-v1'
  ),
  CONSTRAINT "ScheduleProgressObservation_progress_state_check" CHECK (
    (
      "progressPercent" = 0
      AND "actualStart" IS NULL
      AND "actualFinish" IS NULL
      AND "remainingDurationDays" IS NULL
    )
    OR (
      "progressPercent" BETWEEN 1 AND 99
      AND "actualStart" IS NOT NULL
      AND "actualStart" <= "observedOn"
      AND "actualFinish" IS NULL
      AND "remainingDurationDays" IS NOT NULL
      AND "remainingDurationDays" BETWEEN 1 AND 3650
    )
    OR (
      "progressPercent" = 100
      AND "actualStart" IS NOT NULL
      AND "actualFinish" IS NOT NULL
      AND "actualFinish" BETWEEN "actualStart" AND "observedOn"
      AND ("remainingDurationDays" IS NULL OR "remainingDurationDays" = 0)
    )
  ),
  CONSTRAINT "ScheduleProgressObservation_timestamps_check" CHECK (
    "evidenceCapturedAt" <= "reviewedAt"
    AND "reviewedAt" <= "createdAt"
  ),
  CONSTRAINT "ScheduleProgressObservation_rationale_check" CHECK (
    char_length(btrim("rationale")) BETWEEN 1 AND 1000
    AND "rationale" = btrim("rationale")
    AND "rationale" !~ '[[:cntrl:]]'
  )
);

CREATE UNIQUE INDEX "ScheduleProgressObservation_scope_id_key"
  ON "ScheduleProgressObservation"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ScheduleProgressObservation_scope_assessment_revision_key"
  ON "ScheduleProgressObservation"(
    "organizationId", "projectId", "assessmentId", "assessmentRevision"
  );
CREATE UNIQUE INDEX "ScheduleProgressObservation_scope_operation_key"
  ON "ScheduleProgressObservation"("organizationId", "projectId", "operationKeyHash");
CREATE INDEX "ScheduleProgressObservation_scope_task_observed_idx"
  ON "ScheduleProgressObservation"("organizationId", "projectId", "taskId", "observedOn");
CREATE INDEX "ScheduleProgressObservation_scope_evidence_created_idx"
  ON "ScheduleProgressObservation"("organizationId", "projectId", "evidenceId", "createdAt");
CREATE INDEX "ScheduleProgressObservation_reviewer_reviewed_idx"
  ON "ScheduleProgressObservation"("reviewedById", "reviewedAt");

ALTER TABLE "ScheduleProgressObservation"
  ADD CONSTRAINT "ScheduleProgressObservation_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleProgressObservation"
  ADD CONSTRAINT "ScheduleProgressObservation_task_scope_fkey"
  FOREIGN KEY ("projectId", "taskId")
  REFERENCES "Task"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleProgressObservation"
  ADD CONSTRAINT "ScheduleProgressObservation_evidence_scope_fkey"
  FOREIGN KEY ("projectId", "evidenceId")
  REFERENCES "ProgressEvidence"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleProgressObservation"
  ADD CONSTRAINT "ScheduleProgressObservation_assessment_scope_fkey"
  FOREIGN KEY ("projectId", "assessmentId")
  REFERENCES "VisualProgressAssessment"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleProgressObservation"
  ADD CONSTRAINT "ScheduleProgressObservation_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleProgressObservation"
  ADD CONSTRAINT "ScheduleProgressObservation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleForecastTask"
  ADD COLUMN "progressObservationId" TEXT;

CREATE INDEX "ScheduleForecastTask_scope_progress_observation_idx"
  ON "ScheduleForecastTask"("organizationId", "projectId", "progressObservationId");

ALTER TABLE "ScheduleForecastTask"
  ADD CONSTRAINT "ScheduleForecastTask_progress_observation_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "progressObservationId")
  REFERENCES "ScheduleProgressObservation"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- MANUAL_OVERRIDE remains deliberately closed until it receives an equally
-- reviewable, immutable provenance contract. Validate now so staging drift is
-- surfaced instead of silently grandfathered.
ALTER TABLE "ScheduleForecastTask"
  ADD CONSTRAINT "ScheduleForecastTask_progress_observation_check" CHECK (
    (
      "progressSource" = 'CANONICAL_TASK'
      AND "progressObservationId" IS NULL
    )
    OR (
      "progressSource" = 'REVIEWED_EVIDENCE'
      AND "progressObservationId" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "ScheduleForecastTask"
  VALIDATE CONSTRAINT "ScheduleForecastTask_progress_observation_check";

CREATE FUNCTION "obrasaas_schedule_progress_observation_validate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  selected_row_count BIGINT;
  project_organization_id TEXT;
  current_task_revision INTEGER;
  evidence_task_id TEXT;
  evidence_status TEXT;
  current_evidence_revision INTEGER;
  current_evidence_sha256 TEXT;
  current_evidence_captured_at TIMESTAMP(3);
  assessment_task_id TEXT;
  assessment_evidence_id TEXT;
  assessment_status TEXT;
  current_assessment_revision INTEGER;
  assessment_input_sha256 TEXT;
  assessment_plan_hash TEXT;
  assessment_task_revision INTEGER;
  assessment_evidence_revision INTEGER;
  assessment_review_status TEXT;
  assessment_reviewed_by_id TEXT;
  assessment_reviewed_at TIMESTAMP(3);
  reviewed_progress_min INTEGER;
  reviewed_progress_max INTEGER;
BEGIN
  IF NEW."source" <> 'REVIEWED_EVIDENCE'
     OR NEW."decisionPolicyVersion" <> 'human-point-within-reviewed-range-v1' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleProgressObservation requires reviewed evidence and the approved human decision policy';
  END IF;

  EXECUTE format(
    'SELECT p."organizationId",
            t."revision",
            e."taskId",
            e."status"::TEXT,
            e."revision",
            lower(e."media" ->> ''sha256''),
            e."capturedAt",
            a."taskId",
            a."evidenceId",
            a."status"::TEXT,
            a."revision",
            a."inputSha256",
            a."baselineHash",
            a."taskRevisionAtRequest",
            a."evidenceRevisionAtRequest",
            a."reviewStatus"::TEXT,
            a."reviewedById",
            a."reviewedAt",
            CASE WHEN a."reviewStatus" = ''CORRECTED''
              THEN a."correctedProgressMin" ELSE a."progressMin" END,
            CASE WHEN a."reviewStatus" = ''CORRECTED''
              THEN a."correctedProgressMax" ELSE a."progressMax" END
       FROM %1$I."Project" p
       JOIN %1$I."Task" t
         ON t."projectId" = p."id" AND t."id" = $2
       JOIN %1$I."ProgressEvidence" e
         ON e."projectId" = p."id" AND e."id" = $3
       JOIN %1$I."VisualProgressAssessment" a
         ON a."projectId" = p."id" AND a."id" = $4
      WHERE p."id" = $1
      FOR SHARE OF p, t, e, a',
    TG_TABLE_SCHEMA
  )
  INTO project_organization_id,
       current_task_revision,
       evidence_task_id,
       evidence_status,
       current_evidence_revision,
       current_evidence_sha256,
       current_evidence_captured_at,
       assessment_task_id,
       assessment_evidence_id,
       assessment_status,
       current_assessment_revision,
       assessment_input_sha256,
       assessment_plan_hash,
       assessment_task_revision,
       assessment_evidence_revision,
       assessment_review_status,
       assessment_reviewed_by_id,
       assessment_reviewed_at,
       reviewed_progress_min,
       reviewed_progress_max
  USING NEW."projectId", NEW."taskId", NEW."evidenceId", NEW."assessmentId";
  GET DIAGNOSTICS selected_row_count = ROW_COUNT;

  IF selected_row_count <> 1
     OR project_organization_id <> NEW."organizationId"
     OR evidence_task_id <> NEW."taskId"
     OR assessment_task_id <> NEW."taskId"
     OR assessment_evidence_id <> NEW."evidenceId"
     OR assessment_status <> 'COMPLETED'
     OR current_assessment_revision <> NEW."assessmentRevision"
     OR evidence_status <> 'APPROVED'
     OR current_evidence_revision <> NEW."evidenceRevision"
     OR assessment_evidence_revision <> NEW."evidenceRevision"
     OR current_task_revision <> NEW."taskRevision"
     OR assessment_task_revision <> NEW."taskRevision"
     OR btrim(current_evidence_sha256) IS DISTINCT FROM btrim(NEW."evidenceSha256")
     OR btrim(assessment_input_sha256) IS DISTINCT FROM btrim(NEW."evidenceSha256")
     OR current_evidence_captured_at IS DISTINCT FROM NEW."evidenceCapturedAt"
     OR btrim(assessment_plan_hash) IS DISTINCT FROM btrim(NEW."planHash")
     OR assessment_review_status IS DISTINCT FROM NEW."reviewStatus"::TEXT
     OR assessment_review_status IS NULL
     OR assessment_review_status NOT IN ('APPROVED', 'CORRECTED')
     OR assessment_reviewed_by_id IS DISTINCT FROM NEW."reviewedById"
     OR assessment_reviewed_at IS DISTINCT FROM NEW."reviewedAt"
     OR reviewed_progress_min IS DISTINCT FROM NEW."progressMin"
     OR reviewed_progress_max IS DISTINCT FROM NEW."progressMax" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleProgressObservation provenance is stale or inconsistent';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ScheduleProgressObservation_provenance_validate"
BEFORE INSERT ON "ScheduleProgressObservation"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_progress_observation_validate"();

CREATE FUNCTION "obrasaas_schedule_forecast_progress_observation_validate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  selected_row_count BIGINT;
  observation_source TEXT;
  observation_task_id TEXT;
  observation_task_revision INTEGER;
  observation_progress_percent INTEGER;
  observation_observed_on DATE;
  observation_actual_start DATE;
  observation_actual_finish DATE;
  observation_remaining_duration_days INTEGER;
  observation_decision_policy_version TEXT;
BEGIN
  IF NEW."progressSource" = 'MANUAL_OVERRIDE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleForecastTask MANUAL_OVERRIDE is closed without immutable provenance';
  END IF;

  IF NEW."progressSource" = 'CANONICAL_TASK' THEN
    IF NEW."progressObservationId" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'ScheduleForecastTask canonical progress cannot reference a reviewed observation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."progressSource" <> 'REVIEWED_EVIDENCE'
     OR NEW."progressObservationId" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleForecastTask reviewed progress requires immutable provenance';
  END IF;

  EXECUTE format(
    'SELECT o."source"::TEXT,
            o."taskId",
            o."taskRevision",
            o."progressPercent",
            o."observedOn",
            o."actualStart",
            o."actualFinish",
            o."remainingDurationDays",
            o."decisionPolicyVersion"
       FROM %1$I."ScheduleProgressObservation" o
      WHERE o."organizationId" = $1
        AND o."projectId" = $2
        AND o."id" = $3
      FOR SHARE OF o',
    TG_TABLE_SCHEMA
  )
  INTO observation_source,
       observation_task_id,
       observation_task_revision,
       observation_progress_percent,
       observation_observed_on,
       observation_actual_start,
       observation_actual_finish,
       observation_remaining_duration_days,
       observation_decision_policy_version
  USING NEW."organizationId", NEW."projectId", NEW."progressObservationId";
  GET DIAGNOSTICS selected_row_count = ROW_COUNT;

  IF selected_row_count <> 1
     OR observation_source <> 'REVIEWED_EVIDENCE'
     OR observation_decision_policy_version <> 'human-point-within-reviewed-range-v1'
     OR observation_task_id <> NEW."sourceTaskId"
     OR observation_task_revision <> NEW."observedTaskRevision"
     OR observation_progress_percent <> NEW."progressPercent"
     OR observation_observed_on IS DISTINCT FROM NEW."observedOn"
     OR observation_actual_start IS DISTINCT FROM NEW."actualStart"
     OR observation_actual_finish IS DISTINCT FROM NEW."actualFinish"
     OR observation_remaining_duration_days IS DISTINCT FROM NEW."remainingDurationDays" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleForecastTask reviewed progress does not match its immutable observation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ScheduleForecastTask_progress_observation_validate"
BEFORE INSERT ON "ScheduleForecastTask"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_forecast_progress_observation_validate"();

CREATE TRIGGER "ScheduleProgressObservation_append_only"
BEFORE UPDATE OR DELETE ON "ScheduleProgressObservation"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();

CREATE TRIGGER "ScheduleProgressObservation_no_truncate"
BEFORE TRUNCATE ON "ScheduleProgressObservation"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();
