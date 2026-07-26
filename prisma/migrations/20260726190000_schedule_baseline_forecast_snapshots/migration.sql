-- Immutable scheduling snapshots. This migration deliberately does not
-- backfill a baseline from mutable Task rows and does not attach a forecast to
-- legacy ReplanScenario records. Publishing and computing are separate,
-- future application-level operations.
CREATE TYPE "ScheduleBaselineStatus" AS ENUM (
  'ACTIVE',
  'SUPERSEDED'
);

CREATE TYPE "ScheduleCalendarPolicy" AS ENUM (
  'CIVIL_CALENDAR_DAYS_V1'
);

CREATE TYPE "ScheduleProgressSource" AS ENUM (
  'CANONICAL_TASK',
  'MANUAL_OVERRIDE',
  'REVIEWED_EVIDENCE'
);

CREATE TABLE "ScheduleBaseline" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ScheduleBaselineStatus" NOT NULL DEFAULT 'ACTIVE',
  "name" VARCHAR(220) NOT NULL,
  "timeZone" VARCHAR(64) NOT NULL,
  "calendarPolicy" "ScheduleCalendarPolicy" NOT NULL DEFAULT 'CIVIL_CALENDAR_DAYS_V1',
  "operationKeyHash" CHAR(64) NOT NULL,
  "sourcePlanHash" CHAR(64) NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "taskCount" INTEGER NOT NULL,
  "dependencyCount" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  "supersededById" TEXT,
  "supersessionHash" CHAR(64),

  CONSTRAINT "ScheduleBaseline_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleBaseline_identity_check" CHECK (
    "version" BETWEEN 1 AND 2147483647
    AND "taskCount" BETWEEN 1 AND 5000
    AND "dependencyCount" BETWEEN 0 AND 100000
    AND "dependencyCount" <= "taskCount" * 100
  ),
  CONSTRAINT "ScheduleBaseline_text_check" CHECK (
    char_length(btrim("name")) BETWEEN 1 AND 220
    AND char_length(btrim("timeZone")) BETWEEN 1 AND 64
    AND "timeZone" ~ '^[A-Za-z0-9._+/-]{1,64}$'
  ),
  CONSTRAINT "ScheduleBaseline_hashes_check" CHECK (
    "operationKeyHash" ~ '^[0-9a-f]{64}$'
    AND "sourcePlanHash" ~ '^[0-9a-f]{64}$'
    AND "contentHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ScheduleBaseline_lifecycle_check" CHECK (
    (
      "status" = 'ACTIVE'
      AND "supersededAt" IS NULL
      AND "supersededById" IS NULL
      AND "supersessionHash" IS NULL
    )
    OR (
      "status" = 'SUPERSEDED'
      AND "supersededAt" IS NOT NULL
      AND "supersededAt" >= "createdAt"
      AND "supersededById" IS NOT NULL
      AND "supersededById" <> "id"
      AND "supersessionHash" IS NOT NULL
      AND "supersessionHash" ~ '^[0-9a-f]{64}$'
    )
  )
);

CREATE TABLE "ScheduleBaselineTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "baselineId" TEXT NOT NULL,
  "sourceTaskId" VARCHAR(190) NOT NULL,
  "sourceTaskRevision" INTEGER NOT NULL,
  "code" VARCHAR(64),
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "type" "TaskType" NOT NULL DEFAULT 'TASK',
  "parentSourceTaskId" VARCHAR(190),
  "plannedStart" DATE NOT NULL,
  "plannedFinish" DATE NOT NULL,
  "plannedDurationDays" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleBaselineTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleBaselineTask_identity_check" CHECK (
    "sourceTaskRevision" >= 0
    AND char_length(btrim("sourceTaskId")) BETWEEN 1 AND 190
    AND "sourceTaskId" = btrim("sourceTaskId")
    AND (
      "parentSourceTaskId" IS NULL
      OR (
        char_length(btrim("parentSourceTaskId")) BETWEEN 1 AND 190
        AND "parentSourceTaskId" = btrim("parentSourceTaskId")
        AND "parentSourceTaskId" <> "sourceTaskId"
      )
    )
  ),
  CONSTRAINT "ScheduleBaselineTask_text_check" CHECK (
    char_length(btrim("title")) BETWEEN 1 AND 160
    AND ("code" IS NULL OR char_length(btrim("code")) BETWEEN 1 AND 64)
    AND ("description" IS NULL OR char_length("description") <= 4000)
  ),
  CONSTRAINT "ScheduleBaselineTask_dates_check" CHECK (
    (
      "type" = 'MILESTONE'
      AND "plannedFinish" = "plannedStart"
      AND "plannedDurationDays" = 0
    )
    OR (
      "type" = 'TASK'
      AND "plannedFinish" >= "plannedStart"
      AND "plannedDurationDays" BETWEEN 1 AND 36500
      AND ("plannedFinish" - "plannedStart") + 1 = "plannedDurationDays"
    )
  )
);

CREATE TABLE "ScheduleBaselineDependency" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "baselineId" TEXT NOT NULL,
  "predecessorSourceTaskId" VARCHAR(190) NOT NULL,
  "successorSourceTaskId" VARCHAR(190) NOT NULL,
  "type" "TaskDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
  "lagDays" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleBaselineDependency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleBaselineDependency_edge_check" CHECK (
    "predecessorSourceTaskId" <> "successorSourceTaskId"
    AND char_length(btrim("predecessorSourceTaskId")) BETWEEN 1 AND 190
    AND char_length(btrim("successorSourceTaskId")) BETWEEN 1 AND 190
    AND "predecessorSourceTaskId" = btrim("predecessorSourceTaskId")
    AND "successorSourceTaskId" = btrim("successorSourceTaskId")
    AND "lagDays" BETWEEN -3650 AND 3650
  )
);

CREATE TABLE "ScheduleForecastRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "baselineId" TEXT NOT NULL,
  "scenarioId" TEXT,
  "scenarioRevision" INTEGER,
  "scenarioInputHash" CHAR(64),
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "engineVersion" VARCHAR(64) NOT NULL,
  "calendarPolicy" "ScheduleCalendarPolicy" NOT NULL DEFAULT 'CIVIL_CALENDAR_DAYS_V1',
  "operationKeyHash" CHAR(64) NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "resultHash" CHAR(64) NOT NULL,
  "asOfDate" DATE NOT NULL,
  "baselineStartDate" DATE NOT NULL,
  "baselineFinishDate" DATE NOT NULL,
  "forecastStartDate" DATE NOT NULL,
  "forecastFinishDate" DATE NOT NULL,
  "startDeltaDays" INTEGER NOT NULL,
  "finishDeltaDays" INTEGER NOT NULL,
  "taskCount" INTEGER NOT NULL,
  "topologicalOrder" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleForecastRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleForecastRun_identity_check" CHECK (
    "schemaVersion" BETWEEN 1 AND 2147483647
    AND char_length(btrim("engineVersion")) BETWEEN 1 AND 64
    AND "engineVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND (
      (
        "scenarioId" IS NULL
        AND "scenarioRevision" IS NULL
        AND "scenarioInputHash" IS NULL
      )
      OR (
        "scenarioId" IS NOT NULL
        AND char_length(btrim("scenarioId")) BETWEEN 1 AND 190
        AND "scenarioId" = btrim("scenarioId")
        AND "scenarioRevision" IS NOT NULL
        AND "scenarioRevision" >= 0
        AND "scenarioInputHash" IS NOT NULL
        AND "scenarioInputHash" ~ '^[0-9a-f]{64}$'
      )
    )
    AND "taskCount" BETWEEN 1 AND 5000
  ),
  CONSTRAINT "ScheduleForecastRun_hashes_check" CHECK (
    "operationKeyHash" ~ '^[0-9a-f]{64}$'
    AND "inputHash" ~ '^[0-9a-f]{64}$'
    AND "resultHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ScheduleForecastRun_range_check" CHECK (
    "baselineFinishDate" >= "baselineStartDate"
    AND "forecastFinishDate" >= "forecastStartDate"
    AND "startDeltaDays" BETWEEN -3650000 AND 3650000
    AND "finishDeltaDays" BETWEEN -3650000 AND 3650000
    AND "forecastStartDate" - "baselineStartDate" = "startDeltaDays"
    AND "forecastFinishDate" - "baselineFinishDate" = "finishDeltaDays"
  ),
  CONSTRAINT "ScheduleForecastRun_topology_check" CHECK (
    CASE
      WHEN jsonb_typeof("topologicalOrder") = 'array' THEN
        jsonb_array_length("topologicalOrder") = "taskCount"
        AND octet_length("topologicalOrder"::TEXT) <= 1048576
      ELSE FALSE
    END
  )
);

CREATE TABLE "ScheduleForecastTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "forecastRunId" TEXT NOT NULL,
  "baselineId" TEXT NOT NULL,
  "sourceTaskId" VARCHAR(190) NOT NULL,
  "observedTaskRevision" INTEGER NOT NULL,
  "progressSource" "ScheduleProgressSource" NOT NULL,
  "progressPercent" INTEGER NOT NULL,
  "observedOn" DATE NOT NULL,
  "actualStart" DATE,
  "actualFinish" DATE,
  "remainingDurationDays" INTEGER,
  "baselineStart" DATE NOT NULL,
  "baselineFinish" DATE NOT NULL,
  "forecastStart" DATE NOT NULL,
  "forecastFinish" DATE NOT NULL,
  "forecastDurationDays" INTEGER NOT NULL,
  "forecastRemainingDays" INTEGER NOT NULL,
  "startDeltaDays" INTEGER NOT NULL,
  "finishDeltaDays" INTEGER NOT NULL,
  "durationDeltaDays" INTEGER NOT NULL,
  "driver" JSONB NOT NULL,
  "relationshipConstraints" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleForecastTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleForecastTask_identity_check" CHECK (
    "observedTaskRevision" >= 0
    AND char_length(btrim("sourceTaskId")) BETWEEN 1 AND 190
    AND "sourceTaskId" = btrim("sourceTaskId")
  ),
  CONSTRAINT "ScheduleForecastTask_progress_check" CHECK (
    (
      "progressPercent" = 0
      AND "actualStart" IS NULL
      AND "actualFinish" IS NULL
      AND "remainingDurationDays" IS NULL
    )
    OR (
      "progressPercent" BETWEEN 1 AND 99
      AND "actualStart" IS NOT NULL
      AND "actualFinish" IS NULL
      AND "actualStart" <= "observedOn"
      AND "remainingDurationDays" IS NOT NULL
      AND "remainingDurationDays" BETWEEN 1 AND 36500
    )
    OR (
      "progressPercent" = 100
      AND "actualStart" IS NOT NULL
      AND "actualFinish" IS NOT NULL
      AND "actualFinish" BETWEEN "actualStart" AND "observedOn"
      AND ("remainingDurationDays" IS NULL OR "remainingDurationDays" = 0)
    )
  ),
  CONSTRAINT "ScheduleForecastTask_dates_check" CHECK (
    "baselineFinish" >= "baselineStart"
    AND "forecastFinish" >= "forecastStart"
    AND "forecastDurationDays" BETWEEN 0 AND 36500
    AND "forecastRemainingDays" BETWEEN 0 AND 36500
    AND "startDeltaDays" BETWEEN -3650000 AND 3650000
    AND "finishDeltaDays" BETWEEN -3650000 AND 3650000
    AND "durationDeltaDays" BETWEEN -36500 AND 36500
    AND "forecastStart" - "baselineStart" = "startDeltaDays"
    AND "forecastFinish" - "baselineFinish" = "finishDeltaDays"
  ),
  CONSTRAINT "ScheduleForecastTask_explanation_check" CHECK (
    CASE
      WHEN jsonb_typeof("driver") = 'object'
           AND "driver" ? 'kind'
           AND jsonb_typeof("relationshipConstraints") = 'array' THEN
        jsonb_typeof("driver" -> 'kind') = 'string'
        AND "driver" ->> 'kind' IN (
          'ACTUAL',
          'DATA_DATE_AND_REMAINING_DURATION',
          'BASELINE',
          'DATA_DATE',
          'DEPENDENCY'
        )
        AND octet_length("driver"::TEXT) <= 4096
        AND jsonb_array_length("relationshipConstraints") <= 100
        AND octet_length("relationshipConstraints"::TEXT) <= 131072
      ELSE FALSE
    END
  )
);

CREATE UNIQUE INDEX "ScheduleBaseline_scope_id_key"
  ON "ScheduleBaseline"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ScheduleBaseline_scope_version_key"
  ON "ScheduleBaseline"("organizationId", "projectId", "version");
CREATE UNIQUE INDEX "ScheduleBaseline_scope_operation_key"
  ON "ScheduleBaseline"("organizationId", "projectId", "operationKeyHash");
CREATE UNIQUE INDEX "ScheduleBaseline_one_active_per_project_key"
  ON "ScheduleBaseline"("organizationId", "projectId")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "ScheduleBaseline_scope_status_version_idx"
  ON "ScheduleBaseline"("organizationId", "projectId", "status", "version");
CREATE UNIQUE INDEX "ScheduleBaseline_scope_superseded_by_key"
  ON "ScheduleBaseline"("organizationId", "projectId", "supersededById");
CREATE UNIQUE INDEX "ScheduleBaseline_scope_supersession_hash_key"
  ON "ScheduleBaseline"("organizationId", "projectId", "supersessionHash");

CREATE UNIQUE INDEX "ScheduleBaselineTask_scope_source_key"
  ON "ScheduleBaselineTask"("organizationId", "projectId", "baselineId", "sourceTaskId");
CREATE INDEX "ScheduleBaselineTask_scope_parent_idx"
  ON "ScheduleBaselineTask"("organizationId", "projectId", "baselineId", "parentSourceTaskId");

CREATE UNIQUE INDEX "ScheduleBaselineDependency_scope_edge_key"
  ON "ScheduleBaselineDependency"(
    "organizationId", "projectId", "baselineId",
    "predecessorSourceTaskId", "successorSourceTaskId"
  );
CREATE INDEX "ScheduleBaselineDependency_scope_successor_idx"
  ON "ScheduleBaselineDependency"(
    "organizationId", "projectId", "baselineId", "successorSourceTaskId"
  );

CREATE UNIQUE INDEX "ScheduleForecastRun_scope_id_key"
  ON "ScheduleForecastRun"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ScheduleForecastRun_scope_baseline_key"
  ON "ScheduleForecastRun"("organizationId", "projectId", "id", "baselineId");
CREATE UNIQUE INDEX "ScheduleForecastRun_scope_operation_key"
  ON "ScheduleForecastRun"("organizationId", "projectId", "operationKeyHash");
CREATE INDEX "ScheduleForecastRun_project_scenario_created_idx"
  ON "ScheduleForecastRun"("projectId", "scenarioId", "createdAt");
CREATE INDEX "ScheduleForecastRun_scope_baseline_created_idx"
  ON "ScheduleForecastRun"("organizationId", "projectId", "baselineId", "createdAt");

CREATE UNIQUE INDEX "ScheduleForecastTask_scope_source_key"
  ON "ScheduleForecastTask"("organizationId", "projectId", "forecastRunId", "sourceTaskId");
CREATE INDEX "ScheduleForecastTask_scope_finish_delta_idx"
  ON "ScheduleForecastTask"("organizationId", "projectId", "forecastRunId", "finishDeltaDays");

ALTER TABLE "ScheduleBaseline"
  ADD CONSTRAINT "ScheduleBaseline_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScheduleBaseline_superseded_by_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "supersededById")
  REFERENCES "ScheduleBaseline"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "ScheduleBaselineTask"
  ADD CONSTRAINT "ScheduleBaselineTask_baseline_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "baselineId")
  REFERENCES "ScheduleBaseline"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "ScheduleBaselineTask_parent_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "baselineId", "parentSourceTaskId")
  REFERENCES "ScheduleBaselineTask"(
    "organizationId", "projectId", "baselineId", "sourceTaskId"
  )
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "ScheduleBaselineDependency"
  ADD CONSTRAINT "ScheduleBaselineDependency_baseline_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "baselineId")
  REFERENCES "ScheduleBaseline"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "ScheduleBaselineDependency_predecessor_scope_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "baselineId", "predecessorSourceTaskId"
  )
  REFERENCES "ScheduleBaselineTask"(
    "organizationId", "projectId", "baselineId", "sourceTaskId"
  )
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "ScheduleBaselineDependency_successor_scope_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "baselineId", "successorSourceTaskId"
  )
  REFERENCES "ScheduleBaselineTask"(
    "organizationId", "projectId", "baselineId", "sourceTaskId"
  )
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "ScheduleForecastRun"
  ADD CONSTRAINT "ScheduleForecastRun_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScheduleForecastRun_baseline_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "baselineId")
  REFERENCES "ScheduleBaseline"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScheduleForecastRun_scenario_scope_fkey"
  FOREIGN KEY ("projectId", "scenarioId")
  REFERENCES "ReplanScenario"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleForecastTask"
  ADD CONSTRAINT "ScheduleForecastTask_run_baseline_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "forecastRunId", "baselineId")
  REFERENCES "ScheduleForecastRun"("organizationId", "projectId", "id", "baselineId")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "ScheduleForecastTask_baseline_task_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId", "baselineId", "sourceTaskId")
  REFERENCES "ScheduleBaselineTask"(
    "organizationId", "projectId", "baselineId", "sourceTaskId"
  )
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Children are inserted first under deferred scope FKs. The immutable root is
-- inserted last and seals the aggregate by matching its declared counts. Once
-- the root exists, no later INSERT can extend the snapshot behind its hashes.
CREATE FUNCTION "obrasaas_schedule_baseline_child_before_seal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  root_exists BOOLEAN;
BEGIN
  -- Serialize child publication against the root seal. Without this lock, a
  -- concurrent child could pass the EXISTS check before another transaction
  -- commits the root and extend the aggregate after its declared hash/counts.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'schedule-baseline:' || NEW."organizationId" || ':'
      || NEW."projectId" || ':' || NEW."baselineId",
    0
  ));

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."ScheduleBaseline"
        WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3
     )',
    TG_TABLE_SCHEMA
  )
  INTO root_exists
  USING NEW."organizationId", NEW."projectId", NEW."baselineId";

  IF root_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleBaseline is already sealed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_schedule_baseline_seal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  actual_task_count INTEGER;
  actual_dependency_count INTEGER;
  max_predecessor_edges INTEGER;
  max_successor_edges INTEGER;
  expected_version INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'schedule-baseline-active:' || NEW."organizationId" || ':' || NEW."projectId",
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'schedule-baseline:' || NEW."organizationId" || ':'
      || NEW."projectId" || ':' || NEW."id",
    0
  ));

  EXECUTE format(
    'SELECT count(*)::INTEGER FROM %I."ScheduleBaselineTask"
      WHERE "organizationId" = $1 AND "projectId" = $2 AND "baselineId" = $3',
    TG_TABLE_SCHEMA
  )
  INTO actual_task_count
  USING NEW."organizationId", NEW."projectId", NEW."id";

  EXECUTE format(
    'SELECT count(*)::INTEGER FROM %I."ScheduleBaselineDependency"
      WHERE "organizationId" = $1 AND "projectId" = $2 AND "baselineId" = $3',
    TG_TABLE_SCHEMA
  )
  INTO actual_dependency_count
  USING NEW."organizationId", NEW."projectId", NEW."id";

  EXECUTE format(
    'SELECT coalesce(max(edge_count), 0)::INTEGER
       FROM (
         SELECT count(*) AS edge_count
           FROM %I."ScheduleBaselineDependency"
          WHERE "organizationId" = $1 AND "projectId" = $2 AND "baselineId" = $3
          GROUP BY "predecessorSourceTaskId"
       ) AS predecessor_edges',
    TG_TABLE_SCHEMA
  )
  INTO max_predecessor_edges
  USING NEW."organizationId", NEW."projectId", NEW."id";

  EXECUTE format(
    'SELECT coalesce(max(edge_count), 0)::INTEGER
       FROM (
         SELECT count(*) AS edge_count
           FROM %I."ScheduleBaselineDependency"
          WHERE "organizationId" = $1 AND "projectId" = $2 AND "baselineId" = $3
          GROUP BY "successorSourceTaskId"
       ) AS successor_edges',
    TG_TABLE_SCHEMA
  )
  INTO max_successor_edges
  USING NEW."organizationId", NEW."projectId", NEW."id";

  EXECUTE format(
    'SELECT coalesce(max("version"), 0)::INTEGER + 1
       FROM %I."ScheduleBaseline"
      WHERE "organizationId" = $1 AND "projectId" = $2',
    TG_TABLE_SCHEMA
  )
  INTO expected_version
  USING NEW."organizationId", NEW."projectId";

  IF NEW."status"::TEXT <> 'ACTIVE'
     OR NEW."version" <> expected_version
     OR actual_task_count <> NEW."taskCount"
     OR actual_dependency_count <> NEW."dependencyCount"
     OR max_predecessor_edges > 100
     OR max_successor_edges > 100 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleBaseline declared counts do not match immutable children';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_schedule_forecast_child_before_seal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  run_exists BOOLEAN;
  baseline_start DATE;
  baseline_finish DATE;
  baseline_revision INTEGER;
  baseline_duration INTEGER;
  baseline_type TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'schedule-forecast:' || NEW."organizationId" || ':'
      || NEW."projectId" || ':' || NEW."forecastRunId",
    0
  ));

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."ScheduleForecastRun"
        WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3
     )',
    TG_TABLE_SCHEMA
  )
  INTO run_exists
  USING NEW."organizationId", NEW."projectId", NEW."forecastRunId";

  IF run_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleForecastRun is already sealed';
  END IF;

  EXECUTE format(
    'SELECT "plannedStart", "plannedFinish", "sourceTaskRevision",
            "plannedDurationDays", "type"::TEXT
       FROM %I."ScheduleBaselineTask"
      WHERE "organizationId" = $1 AND "projectId" = $2
        AND "baselineId" = $3 AND "sourceTaskId" = $4',
    TG_TABLE_SCHEMA
  )
  INTO baseline_start, baseline_finish, baseline_revision, baseline_duration, baseline_type
  USING NEW."organizationId", NEW."projectId", NEW."baselineId", NEW."sourceTaskId";

  IF baseline_revision IS NOT NULL AND (
    NEW."baselineStart" <> baseline_start
    OR NEW."baselineFinish" <> baseline_finish
    OR NEW."observedTaskRevision" < baseline_revision
    OR (
      NEW."progressPercent" = 0
      AND NEW."driver" ->> 'kind' NOT IN ('BASELINE', 'DATA_DATE', 'DEPENDENCY')
    )
    OR (
      NEW."progressPercent" BETWEEN 1 AND 99
      AND NEW."driver" ->> 'kind' <> 'DATA_DATE_AND_REMAINING_DURATION'
    )
    OR (
      NEW."progressPercent" = 100
      AND NEW."driver" ->> 'kind' <> 'ACTUAL'
    )
    OR (
      baseline_type = 'TASK'
      AND (
        NEW."forecastDurationDays" <> (NEW."forecastFinish" - NEW."forecastStart") + 1
        OR (
          NEW."progressPercent" = 0
          AND NEW."forecastRemainingDays" <> baseline_duration
        )
        OR (
          NEW."progressPercent" BETWEEN 1 AND 99
          AND (
            NEW."forecastStart" <> NEW."actualStart"
            OR NEW."forecastRemainingDays" <> NEW."remainingDurationDays"
          )
        )
        OR (
          NEW."progressPercent" = 100
          AND (
            NEW."forecastStart" <> NEW."actualStart"
            OR NEW."forecastFinish" <> NEW."actualFinish"
            OR NEW."forecastRemainingDays" <> 0
          )
        )
      )
    )
    OR (
      baseline_type = 'MILESTONE'
      AND (
        NEW."progressPercent" NOT IN (0, 100)
        OR NEW."forecastDurationDays" <> 0
        OR NEW."forecastRemainingDays" <> 0
        OR NEW."forecastStart" <> NEW."forecastFinish"
        OR (
          NEW."progressPercent" = 100
          AND (
            NEW."actualStart" <> NEW."actualFinish"
            OR NEW."forecastStart" <> NEW."actualStart"
          )
        )
      )
    )
    OR NEW."durationDeltaDays" <> NEW."forecastDurationDays" - baseline_duration
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleForecastTask does not preserve its baseline projection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_schedule_forecast_seal"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  actual_task_count INTEGER;
  expected_task_count INTEGER;
  observed_date_violation_count INTEGER;
  partial_finish_violation_count INTEGER;
  topology_invalid_count INTEGER;
  topology_distinct_count INTEGER;
  topology_order_violation_count INTEGER;
  relationship_constraint_count BIGINT;
  relationship_explanation_violation_count INTEGER;
  expected_dependency_count INTEGER;
  expected_calendar_policy TEXT;
  expected_baseline_start DATE;
  expected_baseline_finish DATE;
  actual_forecast_start DATE;
  actual_forecast_finish DATE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'schedule-forecast:' || NEW."organizationId" || ':'
      || NEW."projectId" || ':' || NEW."id",
    0
  ));

  IF jsonb_typeof(NEW."topologicalOrder") <> 'array' THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT count(*)::INTEGER,
            (count(*) FILTER (WHERE "observedOn" > $4))::INTEGER,
            (count(*) FILTER (
              WHERE "progressPercent" BETWEEN 1 AND 99
                AND "forecastFinish" <> $4 + "remainingDurationDays" - 1
            ))::INTEGER,
            min("forecastStart"), max("forecastFinish"),
            coalesce(sum(jsonb_array_length("relationshipConstraints")), 0)::BIGINT
       FROM %I."ScheduleForecastTask"
      WHERE "organizationId" = $1 AND "projectId" = $2 AND "forecastRunId" = $3',
    TG_TABLE_SCHEMA
  )
  INTO actual_task_count, observed_date_violation_count, partial_finish_violation_count,
       actual_forecast_start, actual_forecast_finish, relationship_constraint_count
  USING NEW."organizationId", NEW."projectId", NEW."id", NEW."asOfDate";

  EXECUTE format(
    'SELECT baseline."taskCount", baseline."dependencyCount",
            baseline."calendarPolicy"::TEXT,
            min(task."plannedStart"), max(task."plannedFinish")
       FROM %I."ScheduleBaseline" AS baseline
       JOIN %I."ScheduleBaselineTask" AS task
         ON task."organizationId" = baseline."organizationId"
        AND task."projectId" = baseline."projectId"
        AND task."baselineId" = baseline."id"
      WHERE baseline."organizationId" = $1 AND baseline."projectId" = $2
        AND baseline."id" = $3
      GROUP BY baseline."taskCount", baseline."dependencyCount", baseline."calendarPolicy"',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO expected_task_count, expected_dependency_count, expected_calendar_policy,
       expected_baseline_start, expected_baseline_finish
  USING NEW."organizationId", NEW."projectId", NEW."baselineId";

  EXECUTE format(
    'SELECT (count(*) FILTER (
              WHERE jsonb_typeof(value) <> ''string''
                 OR NOT EXISTS (
                   SELECT 1 FROM %I."ScheduleForecastTask" AS task
                    WHERE task."organizationId" = $1 AND task."projectId" = $2
                      AND task."forecastRunId" = $3
                      AND task."sourceTaskId" = value #>> ''{}''
                 )
            ))::INTEGER,
            count(DISTINCT value)::INTEGER
       FROM jsonb_array_elements($4) AS topology(value)',
    TG_TABLE_SCHEMA
  )
  INTO topology_invalid_count, topology_distinct_count
  USING NEW."organizationId", NEW."projectId", NEW."id", NEW."topologicalOrder";

  EXECUTE format(
    'WITH topology AS (
       SELECT value, ordinality
         FROM jsonb_array_elements_text($4) WITH ORDINALITY AS item(value, ordinality)
     )
     SELECT count(*)::INTEGER
       FROM %I."ScheduleBaselineDependency" AS dependency
       JOIN topology AS predecessor
         ON predecessor.value = dependency."predecessorSourceTaskId"
       JOIN topology AS successor
         ON successor.value = dependency."successorSourceTaskId"
      WHERE dependency."organizationId" = $1
        AND dependency."projectId" = $2
        AND dependency."baselineId" = $3
        AND predecessor.ordinality >= successor.ordinality',
    TG_TABLE_SCHEMA
  )
  INTO topology_order_violation_count
  USING NEW."organizationId", NEW."projectId", NEW."baselineId", NEW."topologicalOrder";

  EXECUTE format(
    'SELECT count(*)::INTEGER
       FROM %I."ScheduleForecastTask" AS forecast_task
      WHERE forecast_task."organizationId" = $1
        AND forecast_task."projectId" = $2
        AND forecast_task."forecastRunId" = $3
        AND (
          jsonb_array_length(forecast_task."relationshipConstraints") <> (
            SELECT count(*)
              FROM %I."ScheduleBaselineDependency" AS dependency
             WHERE dependency."organizationId" = forecast_task."organizationId"
               AND dependency."projectId" = forecast_task."projectId"
               AND dependency."baselineId" = forecast_task."baselineId"
               AND dependency."successorSourceTaskId" = forecast_task."sourceTaskId"
          )
          OR EXISTS (
            SELECT 1
              FROM jsonb_array_elements(
                forecast_task."relationshipConstraints"
              ) AS explanation(value)
             WHERE jsonb_typeof(explanation.value) IS DISTINCT FROM ''object''
                OR NOT EXISTS (
                  SELECT 1
                    FROM %I."ScheduleBaselineDependency" AS dependency
                   WHERE dependency."organizationId" = forecast_task."organizationId"
                     AND dependency."projectId" = forecast_task."projectId"
                     AND dependency."baselineId" = forecast_task."baselineId"
                     AND dependency."successorSourceTaskId" = forecast_task."sourceTaskId"
                     AND dependency."predecessorSourceTaskId" = explanation.value ->> ''predecessorId''
                     AND dependency."type"::TEXT = explanation.value ->> ''type''
                     AND to_jsonb(dependency."lagDays") = explanation.value -> ''lagDays''
                )
          )
          OR EXISTS (
            SELECT 1
              FROM %I."ScheduleBaselineDependency" AS dependency
             WHERE dependency."organizationId" = forecast_task."organizationId"
               AND dependency."projectId" = forecast_task."projectId"
               AND dependency."baselineId" = forecast_task."baselineId"
               AND dependency."successorSourceTaskId" = forecast_task."sourceTaskId"
               AND NOT EXISTS (
                 SELECT 1
                   FROM jsonb_array_elements(
                     forecast_task."relationshipConstraints"
                   ) AS explanation(value)
                  WHERE dependency."predecessorSourceTaskId" = explanation.value ->> ''predecessorId''
                    AND dependency."type"::TEXT = explanation.value ->> ''type''
                    AND to_jsonb(dependency."lagDays") = explanation.value -> ''lagDays''
               )
          )
          OR (
            forecast_task."driver" ->> ''kind'' = ''DEPENDENCY''
            AND NOT EXISTS (
              SELECT 1
                FROM %I."ScheduleBaselineDependency" AS dependency
               WHERE dependency."organizationId" = forecast_task."organizationId"
                 AND dependency."projectId" = forecast_task."projectId"
                 AND dependency."baselineId" = forecast_task."baselineId"
                 AND dependency."successorSourceTaskId" = forecast_task."sourceTaskId"
                 AND dependency."predecessorSourceTaskId" = forecast_task."driver" ->> ''predecessorId''
                 AND dependency."type"::TEXT = forecast_task."driver" ->> ''type''
                 AND to_jsonb(dependency."lagDays") = forecast_task."driver" -> ''lagDays''
            )
          )
        )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO relationship_explanation_violation_count
  USING NEW."organizationId", NEW."projectId", NEW."id";

  IF actual_task_count <> NEW."taskCount"
     OR expected_task_count <> NEW."taskCount"
     OR expected_calendar_policy <> NEW."calendarPolicy"::TEXT
     OR observed_date_violation_count <> 0
     OR partial_finish_violation_count <> 0
     OR topology_invalid_count <> 0
     OR topology_distinct_count <> NEW."taskCount"
     OR topology_order_violation_count <> 0
     OR relationship_constraint_count <> expected_dependency_count
     OR relationship_explanation_violation_count <> 0
     OR expected_baseline_start <> NEW."baselineStartDate"
     OR expected_baseline_finish <> NEW."baselineFinishDate"
     OR actual_forecast_start <> NEW."forecastStartDate"
     OR actual_forecast_finish <> NEW."forecastFinishDate" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'ScheduleForecastRun summary does not match its immutable baseline and tasks';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ScheduleBaselineTask_before_seal"
BEFORE INSERT ON "ScheduleBaselineTask"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_baseline_child_before_seal"();
CREATE TRIGGER "ScheduleBaselineDependency_before_seal"
BEFORE INSERT ON "ScheduleBaselineDependency"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_baseline_child_before_seal"();
CREATE TRIGGER "ScheduleBaseline_seal"
BEFORE INSERT ON "ScheduleBaseline"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_baseline_seal"();

CREATE TRIGGER "ScheduleForecastTask_before_seal"
BEFORE INSERT ON "ScheduleForecastTask"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_forecast_child_before_seal"();
CREATE TRIGGER "ScheduleForecastRun_seal"
BEFORE INSERT ON "ScheduleForecastRun"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_forecast_seal"();

-- Baseline content is immutable. Its only legal UPDATE is the one-way lifecycle
-- transition ACTIVE -> SUPERSEDED that points to the next immutable baseline.
CREATE FUNCTION "obrasaas_schedule_baseline_lifecycle_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'schedule-baseline-active:' || OLD."organizationId" || ':' || OLD."projectId",
      0
    ));

    IF OLD."status"::TEXT = 'ACTIVE'
       AND NEW."status"::TEXT = 'SUPERSEDED'
       AND OLD."supersededAt" IS NULL
       AND OLD."supersededById" IS NULL
       AND OLD."supersessionHash" IS NULL
       AND NEW."supersededAt" IS NOT NULL
       AND NEW."supersededById" IS NOT NULL
       AND NEW."supersededById" <> NEW."id"
       AND NEW."supersessionHash" IS NOT NULL
       AND (
         to_jsonb(OLD) - ARRAY[
           'status', 'supersededAt', 'supersededById', 'supersessionHash'
         ]
       ) IS NOT DISTINCT FROM (
         to_jsonb(NEW) - ARRAY[
           'status', 'supersededAt', 'supersededById', 'supersessionHash'
         ]
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'ScheduleBaseline content is append-only';
END;
$$;

CREATE FUNCTION "obrasaas_schedule_baseline_supersession_integrity"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  successor_version INTEGER;
  successor_status TEXT;
BEGIN
  IF NEW."status"::TEXT = 'SUPERSEDED' THEN
    EXECUTE format(
      'SELECT "version", "status"::TEXT
         FROM %I."ScheduleBaseline"
        WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3',
      TG_TABLE_SCHEMA
    )
    INTO successor_version, successor_status
    USING NEW."organizationId", NEW."projectId", NEW."supersededById";

    IF successor_version IS NULL
       OR successor_version <= NEW."version"
       OR successor_status <> 'ACTIVE' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'ScheduleBaseline supersession must target a newer active baseline';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "ScheduleBaseline_supersession_integrity"
AFTER INSERT OR UPDATE ON "ScheduleBaseline"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_baseline_supersession_integrity"();

-- Child snapshots and forecast runs are fully append-only. Baseline DELETE,
-- TRUNCATE, content rewrites and lifecycle reversal are rejected as well.
CREATE FUNCTION "obrasaas_schedule_snapshot_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = TG_TABLE_NAME || ' is append-only';
END;
$$;

CREATE TRIGGER "ScheduleBaseline_append_only"
BEFORE UPDATE OR DELETE ON "ScheduleBaseline"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_baseline_lifecycle_guard"();
CREATE TRIGGER "ScheduleBaseline_no_truncate"
BEFORE TRUNCATE ON "ScheduleBaseline"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();

CREATE TRIGGER "ScheduleBaselineTask_append_only"
BEFORE UPDATE OR DELETE ON "ScheduleBaselineTask"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();
CREATE TRIGGER "ScheduleBaselineTask_no_truncate"
BEFORE TRUNCATE ON "ScheduleBaselineTask"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();

CREATE TRIGGER "ScheduleBaselineDependency_append_only"
BEFORE UPDATE OR DELETE ON "ScheduleBaselineDependency"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();
CREATE TRIGGER "ScheduleBaselineDependency_no_truncate"
BEFORE TRUNCATE ON "ScheduleBaselineDependency"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();

CREATE TRIGGER "ScheduleForecastRun_append_only"
BEFORE UPDATE OR DELETE ON "ScheduleForecastRun"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();
CREATE TRIGGER "ScheduleForecastRun_no_truncate"
BEFORE TRUNCATE ON "ScheduleForecastRun"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();

CREATE TRIGGER "ScheduleForecastTask_append_only"
BEFORE UPDATE OR DELETE ON "ScheduleForecastTask"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();
CREATE TRIGGER "ScheduleForecastTask_no_truncate"
BEFORE TRUNCATE ON "ScheduleForecastTask"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_schedule_snapshot_append_only"();
