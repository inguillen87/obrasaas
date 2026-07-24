-- S2 introduces a separate, versioned schedule domain. AttendanceEntry keeps
-- describing physical evidence; it is never repurposed as an absence row.
CREATE TYPE "AttendanceScheduleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AttendanceScheduleVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "AttendanceLatePolicy" AS ENUM ('FULL_FROM_SCHEDULE', 'EXCLUDE_GRACE');
CREATE TYPE "AttendanceExpectationKind" AS ENUM ('WORKING', 'NON_WORKING', 'EXCUSED');
CREATE TYPE "AttendanceExceptionAction" AS ENUM ('SET', 'CANCEL');
CREATE TYPE "AttendanceExceptionType" AS ENUM (
  'EXCUSED_ABSENCE',
  'APPROVED_LEAVE',
  'NON_WORKING_DAY',
  'OFFSITE_WORK'
);
CREATE TYPE "AttendanceCorrectionDecisionKind" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "AttendanceAlertType" AS ENUM ('NO_SHOW', 'PENDING_CLOSE');
CREATE TYPE "AttendanceAlertTransition" AS ENUM ('OPENED', 'ACKNOWLEDGED', 'RESOLVED');

-- Required by the non-overlap exclusion constraint below. Fail before any S2
-- table is created if the managed PostgreSQL provider does not allow it.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "AttendanceSchedule" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "status" "AttendanceScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceSchedule_revision_nonnegative_check" CHECK ("revision" >= 0),
  CONSTRAINT "AttendanceSchedule_name_not_blank_check"
    CHECK (char_length(btrim("name")) BETWEEN 1 AND 120)
);

CREATE TABLE "AttendanceScheduleVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "earlyCheckInMinutes" SMALLINT NOT NULL DEFAULT 120,
  "lateToleranceMinutes" SMALLINT NOT NULL DEFAULT 10,
  "latePolicy" "AttendanceLatePolicy" NOT NULL DEFAULT 'FULL_FROM_SCHEDULE',
  "noShowAfterMinutes" SMALLINT NOT NULL DEFAULT 30,
  "pendingCloseAfterMinutes" SMALLINT NOT NULL DEFAULT 60,
  "absenceFinalizeAfterMinutes" SMALLINT NOT NULL DEFAULT 120,
  "status" "AttendanceScheduleVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
  "configHash" CHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceScheduleVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceScheduleVersion_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "AttendanceScheduleVersion_timezone_not_blank_check"
    CHECK (char_length(btrim("timezone")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceScheduleVersion_policy_ranges_check" CHECK (
    "earlyCheckInMinutes" BETWEEN 0 AND 720
    AND "lateToleranceMinutes" BETWEEN 0 AND 240
    AND "noShowAfterMinutes" BETWEEN "lateToleranceMinutes" AND 1440
    AND "pendingCloseAfterMinutes" BETWEEN 0 AND 1440
    AND "absenceFinalizeAfterMinutes" BETWEEN "pendingCloseAfterMinutes" AND 2880
  ),
  CONSTRAINT "AttendanceScheduleVersion_publish_state_check" CHECK (
    ("status" = 'DRAFT' AND "publishedAt" IS NULL)
    OR ("status" IN ('PUBLISHED', 'RETIRED') AND "publishedAt" IS NOT NULL)
  ),
  CONSTRAINT "AttendanceScheduleVersion_config_hash_check"
    CHECK ("configHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AttendanceScheduleVersion_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AttendanceScheduleVersion_idempotency_not_blank_check"
    CHECK (char_length(btrim("idempotencyKey")) BETWEEN 1 AND 190)
);

CREATE TABLE "AttendanceScheduleDay" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "scheduleVersionId" TEXT NOT NULL,
  "isoWeekday" SMALLINT NOT NULL,
  "isWorkingDay" BOOLEAN NOT NULL DEFAULT TRUE,
  "startMinute" SMALLINT,
  "endMinute" SMALLINT,
  "endDayOffset" SMALLINT NOT NULL DEFAULT 0,
  "expectedBreakMinutes" SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT "AttendanceScheduleDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceScheduleDay_weekday_check" CHECK ("isoWeekday" BETWEEN 1 AND 7),
  CONSTRAINT "AttendanceScheduleDay_offset_check" CHECK ("endDayOffset" IN (0, 1)),
  CONSTRAINT "AttendanceScheduleDay_break_check" CHECK (
    "expectedBreakMinutes" BETWEEN 0 AND 720
  ),
  CONSTRAINT "AttendanceScheduleDay_shape_check" CHECK (
    (
      NOT "isWorkingDay"
      AND "startMinute" IS NULL
      AND "endMinute" IS NULL
      AND "endDayOffset" = 0
      AND "expectedBreakMinutes" = 0
    )
    OR (
      "isWorkingDay"
      AND "startMinute" BETWEEN 0 AND 1439
      AND "endMinute" BETWEEN 0 AND 1439
      AND ("endMinute" + ("endDayOffset" * 1440) - "startMinute") BETWEEN 1 AND 1440
      AND "expectedBreakMinutes" < ("endMinute" + ("endDayOffset" * 1440) - "startMinute")
    )
  )
);

CREATE TABLE "AttendanceScheduleAssignment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "scheduleVersionId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveThrough" DATE,
  "reasonCode" VARCHAR(64),
  "idempotencyKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdById" TEXT,
  "endedById" TEXT,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceScheduleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceScheduleAssignment_range_check"
    CHECK ("effectiveThrough" IS NULL OR "effectiveThrough" >= "effectiveFrom"),
  CONSTRAINT "AttendanceScheduleAssignment_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AttendanceScheduleAssignment_idempotency_not_blank_check"
    CHECK (char_length(btrim("idempotencyKey")) BETWEEN 1 AND 190)
);

CREATE TABLE "AttendanceExpectation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceExpectation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceExpectation_revision_nonnegative_check" CHECK ("revision" >= 0)
);

CREATE TABLE "AttendanceException" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  "currentType" "AttendanceExceptionType",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceException_revision_nonnegative_check" CHECK ("revision" >= 0),
  CONSTRAINT "AttendanceException_current_state_check" CHECK (
    ("active" AND "currentType" IS NOT NULL)
    OR (NOT "active" AND "currentType" IS NULL)
  )
);

CREATE TABLE "AttendanceExceptionRevision" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "exceptionId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "action" "AttendanceExceptionAction" NOT NULL,
  "type" "AttendanceExceptionType",
  "reasonCode" VARCHAR(64) NOT NULL,
  "note" VARCHAR(280),
  "idempotencyKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceExceptionRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceExceptionRevision_revision_positive_check" CHECK ("revision" > 0),
  CONSTRAINT "AttendanceExceptionRevision_action_shape_check" CHECK (
    ("action" = 'SET' AND "type" IS NOT NULL)
    OR ("action" = 'CANCEL' AND "type" IS NULL)
  ),
  CONSTRAINT "AttendanceExceptionRevision_reason_not_blank_check"
    CHECK (char_length(btrim("reasonCode")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceExceptionRevision_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AttendanceExceptionRevision_idempotency_not_blank_check"
    CHECK (char_length(btrim("idempotencyKey")) BETWEEN 1 AND 190)
);

CREATE TABLE "AttendanceExpectationRevision" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "expectationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "kind" "AttendanceExpectationKind" NOT NULL,
  "scheduleVersionId" TEXT,
  "scheduleDayId" TEXT,
  "exceptionRevisionId" TEXT,
  "timezone" VARCHAR(64) NOT NULL,
  "expectedStartAt" TIMESTAMP(3),
  "expectedEndAt" TIMESTAMP(3),
  "graceEndsAt" TIMESTAMP(3),
  "noShowAt" TIMESTAMP(3),
  "pendingCloseAt" TIMESTAMP(3),
  "absenceAt" TIMESTAMP(3),
  "latePolicy" "AttendanceLatePolicy",
  "expectedBreakMinutes" SMALLINT,
  "classifierVersion" VARCHAR(64) NOT NULL,
  "policyHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceExpectationRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceExpectationRevision_revision_positive_check" CHECK ("revision" > 0),
  CONSTRAINT "AttendanceExpectationRevision_timezone_not_blank_check"
    CHECK (char_length(btrim("timezone")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceExpectationRevision_policy_hash_check"
    CHECK ("policyHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AttendanceExpectationRevision_classifier_not_blank_check"
    CHECK (char_length(btrim("classifierVersion")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceExpectationRevision_schedule_link_check"
    CHECK ("scheduleDayId" IS NULL OR "scheduleVersionId" IS NOT NULL),
  CONSTRAINT "AttendanceExpectationRevision_shape_check" CHECK (
    (
      "kind" = 'WORKING'
      AND "scheduleVersionId" IS NOT NULL
      AND "scheduleDayId" IS NOT NULL
      AND "expectedStartAt" IS NOT NULL
      AND "expectedEndAt" IS NOT NULL
      AND "graceEndsAt" IS NOT NULL
      AND "noShowAt" IS NOT NULL
      AND "pendingCloseAt" IS NOT NULL
      AND "absenceAt" IS NOT NULL
      AND "latePolicy" IS NOT NULL
      AND "expectedBreakMinutes" IS NOT NULL
      AND "expectedStartAt" < "expectedEndAt"
      AND "expectedStartAt" <= "graceEndsAt"
      AND "graceEndsAt" <= "noShowAt"
      AND "expectedEndAt" <= "pendingCloseAt"
      AND "pendingCloseAt" <= "absenceAt"
    )
    OR (
      "kind" IN ('NON_WORKING', 'EXCUSED')
      AND "expectedStartAt" IS NULL
      AND "expectedEndAt" IS NULL
      AND "graceEndsAt" IS NULL
      AND "noShowAt" IS NULL
      AND "pendingCloseAt" IS NULL
      AND "absenceAt" IS NULL
      AND "latePolicy" IS NULL
      AND "expectedBreakMinutes" IS NULL
      AND (
        ("kind" = 'EXCUSED' AND "exceptionRevisionId" IS NOT NULL)
        OR (
          "kind" = 'NON_WORKING'
          AND ("scheduleDayId" IS NOT NULL OR "exceptionRevisionId" IS NOT NULL)
        )
      )
    )
  )
);

CREATE TABLE "AttendanceCorrectionRequest" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "expectationId" TEXT,
  "shiftId" TEXT NOT NULL,
  "targetEntryId" TEXT,
  "baseShiftRevision" INTEGER NOT NULL,
  "baseEffectiveHash" CHAR(64) NOT NULL,
  "proposedEvents" JSONB NOT NULL,
  "proposedEffectiveHash" CHAR(64) NOT NULL,
  "reasonCode" VARCHAR(64) NOT NULL,
  "note" VARCHAR(280),
  "requestedByPlatformUserId" TEXT,
  "requestedByWorkerId" TEXT,
  "idempotencyKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceCorrectionRequest_base_revision_check" CHECK ("baseShiftRevision" >= 0),
  CONSTRAINT "AttendanceCorrectionRequest_hashes_check" CHECK (
    "baseEffectiveHash" ~ '^[0-9a-f]{64}$'
    AND "proposedEffectiveHash" ~ '^[0-9a-f]{64}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "AttendanceCorrectionRequest_events_check" CHECK (
    jsonb_typeof("proposedEvents") = 'array'
    AND jsonb_array_length("proposedEvents") BETWEEN 1 AND 64
  ),
  CONSTRAINT "AttendanceCorrectionRequest_actor_check" CHECK (
    ("requestedByPlatformUserId" IS NOT NULL)::INTEGER
    + ("requestedByWorkerId" IS NOT NULL)::INTEGER = 1
  ),
  CONSTRAINT "AttendanceCorrectionRequest_reason_not_blank_check"
    CHECK (char_length(btrim("reasonCode")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceCorrectionRequest_idempotency_not_blank_check"
    CHECK (char_length(btrim("idempotencyKey")) BETWEEN 1 AND 190),
  CONSTRAINT "AttendanceCorrectionRequest_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "AttendanceCorrectionDecision" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "decision" "AttendanceCorrectionDecisionKind" NOT NULL,
  "reasonCode" VARCHAR(64) NOT NULL,
  "note" VARCHAR(280),
  "decidedById" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrectionDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceCorrectionDecision_reason_not_blank_check"
    CHECK (char_length(btrim("reasonCode")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceCorrectionDecision_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AttendanceCorrectionDecision_idempotency_not_blank_check"
    CHECK (char_length(btrim("idempotencyKey")) BETWEEN 1 AND 190)
);

CREATE TABLE "AttendanceAdjustment" (
  "id" TEXT NOT NULL,
  "correctionRequestId" TEXT NOT NULL,
  "appliedShiftRevision" INTEGER NOT NULL,
  "baseLedgerSequence" INTEGER NOT NULL,
  "baseEffectiveHash" CHAR(64) NOT NULL,
  "effectiveHash" CHAR(64) NOT NULL,
  "effectiveEvents" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceAdjustment_revision_check" CHECK (
    "appliedShiftRevision" > 0 AND "baseLedgerSequence" > 0
  ),
  CONSTRAINT "AttendanceAdjustment_hashes_check" CHECK (
    "baseEffectiveHash" ~ '^[0-9a-f]{64}$'
    AND "effectiveHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "AttendanceAdjustment_events_check" CHECK (
    jsonb_typeof("effectiveEvents") = 'array'
    AND jsonb_array_length("effectiveEvents") BETWEEN 1 AND 64
  )
);

CREATE TABLE "AttendanceAlertEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "expectationId" TEXT NOT NULL,
  "expectationRevisionId" TEXT NOT NULL,
  "shiftId" TEXT,
  "type" "AttendanceAlertType" NOT NULL,
  "transition" "AttendanceAlertTransition" NOT NULL,
  "dedupeKey" VARCHAR(190) NOT NULL,
  "causationId" VARCHAR(190),
  "classifierVersion" VARCHAR(64) NOT NULL,
  "payload" JSONB,
  "actorId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceAlertEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceAlertEvent_dedupe_not_blank_check"
    CHECK (char_length(btrim("dedupeKey")) BETWEEN 1 AND 190),
  CONSTRAINT "AttendanceAlertEvent_classifier_not_blank_check"
    CHECK (char_length(btrim("classifierVersion")) BETWEEN 1 AND 64),
  CONSTRAINT "AttendanceAlertEvent_payload_object_check"
    CHECK ("payload" IS NULL OR jsonb_typeof("payload") = 'object')
);

-- New-table indexes can be built normally; no populated heap is scanned.
CREATE INDEX "AttendanceSchedule_project_status_idx"
  ON "AttendanceSchedule"("projectId", "status", "createdAt");
CREATE UNIQUE INDEX "AttendanceSchedule_id_project_key"
  ON "AttendanceSchedule"("id", "projectId");
CREATE UNIQUE INDEX "AttendanceSchedule_project_name_key"
  ON "AttendanceSchedule"("projectId", "name");

CREATE UNIQUE INDEX "AttendanceScheduleVersion_idempotency_key"
  ON "AttendanceScheduleVersion"("idempotencyKey");
CREATE INDEX "AttendanceScheduleVersion_project_effective_idx"
  ON "AttendanceScheduleVersion"("projectId", "status", "effectiveFrom");
CREATE UNIQUE INDEX "AttendanceScheduleVersion_id_project_key"
  ON "AttendanceScheduleVersion"("id", "projectId");
CREATE UNIQUE INDEX "AttendanceScheduleVersion_schedule_version_key"
  ON "AttendanceScheduleVersion"("scheduleId", "version");
CREATE UNIQUE INDEX "AttendanceScheduleVersion_schedule_effective_key"
  ON "AttendanceScheduleVersion"("scheduleId", "effectiveFrom");
CREATE UNIQUE INDEX "AttendanceScheduleDay_version_weekday_key"
  ON "AttendanceScheduleDay"("scheduleVersionId", "isoWeekday");
CREATE UNIQUE INDEX "AttendanceScheduleDay_id_version_project_key"
  ON "AttendanceScheduleDay"("id", "scheduleVersionId", "projectId");

CREATE UNIQUE INDEX "AttendanceScheduleAssignment_idempotency_key"
  ON "AttendanceScheduleAssignment"("idempotencyKey");
CREATE INDEX "AttendanceScheduleAssignment_project_effective_idx"
  ON "AttendanceScheduleAssignment"("projectId", "effectiveFrom", "effectiveThrough");
CREATE INDEX "AttendanceScheduleAssignment_worker_effective_idx"
  ON "AttendanceScheduleAssignment"("workerId", "effectiveFrom", "effectiveThrough");
CREATE UNIQUE INDEX "AttendanceScheduleAssignment_worker_from_key"
  ON "AttendanceScheduleAssignment"("projectId", "workerId", "effectiveFrom");

CREATE INDEX "AttendanceExpectation_project_date_idx"
  ON "AttendanceExpectation"("projectId", "workDate");
CREATE UNIQUE INDEX "AttendanceExpectation_id_project_worker_key"
  ON "AttendanceExpectation"("id", "projectId", "workerId");
CREATE UNIQUE INDEX "AttendanceExpectation_id_scope_date_key"
  ON "AttendanceExpectation"("id", "projectId", "workerId", "workDate");
CREATE UNIQUE INDEX "AttendanceExpectation_worker_date_key"
  ON "AttendanceExpectation"("projectId", "workerId", "workDate");
CREATE INDEX "AttendanceExpectationRevision_no_show_idx"
  ON "AttendanceExpectationRevision"("noShowAt", "id");
CREATE INDEX "AttendanceExpectationRevision_pending_close_idx"
  ON "AttendanceExpectationRevision"("pendingCloseAt", "id");
CREATE UNIQUE INDEX "AttendanceExpectationRevision_expectation_revision_key"
  ON "AttendanceExpectationRevision"("expectationId", "revision");
CREATE UNIQUE INDEX "AttendanceExpectationRevision_id_expectation_scope_key"
  ON "AttendanceExpectationRevision"("id", "expectationId", "projectId", "workerId");

CREATE INDEX "AttendanceException_project_date_idx"
  ON "AttendanceException"("projectId", "workDate", "active");
CREATE UNIQUE INDEX "AttendanceException_id_project_worker_key"
  ON "AttendanceException"("id", "projectId", "workerId");
CREATE UNIQUE INDEX "AttendanceException_id_scope_date_key"
  ON "AttendanceException"("id", "projectId", "workerId", "workDate");
CREATE UNIQUE INDEX "AttendanceException_worker_date_key"
  ON "AttendanceException"("projectId", "workerId", "workDate");
CREATE UNIQUE INDEX "AttendanceExceptionRevision_idempotency_key"
  ON "AttendanceExceptionRevision"("idempotencyKey");
CREATE UNIQUE INDEX "AttendanceExceptionRevision_exception_revision_key"
  ON "AttendanceExceptionRevision"("exceptionId", "revision");
CREATE UNIQUE INDEX "AttendanceExceptionRevision_id_scope_date_key"
  ON "AttendanceExceptionRevision"("id", "projectId", "workerId", "workDate");

CREATE UNIQUE INDEX "AttendanceCorrectionRequest_idempotency_key"
  ON "AttendanceCorrectionRequest"("idempotencyKey");
CREATE INDEX "AttendanceCorrectionRequest_project_created_idx"
  ON "AttendanceCorrectionRequest"("projectId", "createdAt", "id");
CREATE INDEX "AttendanceCorrectionRequest_shift_created_idx"
  ON "AttendanceCorrectionRequest"("shiftId", "createdAt");
CREATE UNIQUE INDEX "AttendanceCorrectionDecision_request_key"
  ON "AttendanceCorrectionDecision"("requestId");
CREATE UNIQUE INDEX "AttendanceCorrectionDecision_idempotency_key"
  ON "AttendanceCorrectionDecision"("idempotencyKey");
CREATE UNIQUE INDEX "AttendanceAdjustment_request_key"
  ON "AttendanceAdjustment"("correctionRequestId");
CREATE INDEX "AttendanceAdjustment_created_idx"
  ON "AttendanceAdjustment"("createdAt", "id");

CREATE UNIQUE INDEX "AttendanceAlertEvent_dedupe_key"
  ON "AttendanceAlertEvent"("dedupeKey");
CREATE INDEX "AttendanceAlertEvent_project_occurred_idx"
  ON "AttendanceAlertEvent"("projectId", "occurredAt", "id");
CREATE INDEX "AttendanceAlertEvent_expectation_type_idx"
  ON "AttendanceAlertEvent"("expectationId", "type", "occurredAt");

-- Every S2 foreign key is project-scoped where the target belongs to a project.
ALTER TABLE "AttendanceSchedule" ADD CONSTRAINT "AttendanceSchedule_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleVersion" ADD CONSTRAINT "AttendanceScheduleVersion_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleVersion" ADD CONSTRAINT "AttendanceScheduleVersion_schedule_scope_fkey"
  FOREIGN KEY ("scheduleId", "projectId") REFERENCES "AttendanceSchedule"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleVersion" ADD CONSTRAINT "AttendanceScheduleVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleDay" ADD CONSTRAINT "AttendanceScheduleDay_version_scope_fkey"
  FOREIGN KEY ("scheduleVersionId", "projectId") REFERENCES "AttendanceScheduleVersion"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_version_scope_fkey"
  FOREIGN KEY ("scheduleVersionId", "projectId") REFERENCES "AttendanceScheduleVersion"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_endedById_fkey"
  FOREIGN KEY ("endedById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceExpectation" ADD CONSTRAINT "AttendanceExpectation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceExpectation" ADD CONSTRAINT "AttendanceExpectation_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceExceptionRevision" ADD CONSTRAINT "AttendanceExceptionRevision_exception_scope_fkey"
  FOREIGN KEY ("exceptionId", "projectId", "workerId", "workDate") REFERENCES "AttendanceException"("id", "projectId", "workerId", "workDate") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceExceptionRevision" ADD CONSTRAINT "AttendanceExceptionRevision_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceExpectationRevision" ADD CONSTRAINT "AttendanceExpectationRevision_expectation_scope_fkey"
  FOREIGN KEY ("expectationId", "projectId", "workerId", "workDate") REFERENCES "AttendanceExpectation"("id", "projectId", "workerId", "workDate") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceExpectationRevision" ADD CONSTRAINT "AttendanceExpectationRevision_version_scope_fkey"
  FOREIGN KEY ("scheduleVersionId", "projectId") REFERENCES "AttendanceScheduleVersion"("id", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceExpectationRevision" ADD CONSTRAINT "AttendanceExpectationRevision_day_scope_fkey"
  FOREIGN KEY ("scheduleDayId", "scheduleVersionId", "projectId") REFERENCES "AttendanceScheduleDay"("id", "scheduleVersionId", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceExpectationRevision" ADD CONSTRAINT "AttendanceExpectationRevision_exception_scope_fkey"
  FOREIGN KEY ("exceptionRevisionId", "projectId", "workerId", "workDate") REFERENCES "AttendanceExceptionRevision"("id", "projectId", "workerId", "workDate") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_expectation_scope_fkey"
  FOREIGN KEY ("expectationId", "projectId", "workerId") REFERENCES "AttendanceExpectation"("id", "projectId", "workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_shift_scope_fkey"
  FOREIGN KEY ("shiftId", "projectId", "workerId") REFERENCES "AttendanceShift"("id", "projectId", "workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_entry_scope_fkey"
  FOREIGN KEY ("targetEntryId", "projectId", "workerId") REFERENCES "AttendanceEntry"("id", "projectId", "workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_requestedByPlatformUserId_fkey"
  FOREIGN KEY ("requestedByPlatformUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_requester_scope_fkey"
  FOREIGN KEY ("projectId", "requestedByWorkerId") REFERENCES "Worker"("projectId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionDecision" ADD CONSTRAINT "AttendanceCorrectionDecision_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "AttendanceCorrectionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionDecision" ADD CONSTRAINT "AttendanceCorrectionDecision_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_correctionRequestId_fkey"
  FOREIGN KEY ("correctionRequestId") REFERENCES "AttendanceCorrectionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceAlertEvent" ADD CONSTRAINT "AttendanceAlertEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceAlertEvent" ADD CONSTRAINT "AttendanceAlertEvent_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceAlertEvent" ADD CONSTRAINT "AttendanceAlertEvent_expectation_scope_fkey"
  FOREIGN KEY ("expectationId", "projectId", "workerId") REFERENCES "AttendanceExpectation"("id", "projectId", "workerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceAlertEvent" ADD CONSTRAINT "AttendanceAlertEvent_revision_scope_fkey"
  FOREIGN KEY ("expectationRevisionId", "expectationId", "projectId", "workerId") REFERENCES "AttendanceExpectationRevision"("id", "expectationId", "projectId", "workerId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceAlertEvent" ADD CONSTRAINT "AttendanceAlertEvent_shift_scope_fkey"
  FOREIGN KEY ("shiftId", "projectId", "workerId") REFERENCES "AttendanceShift"("id", "projectId", "workerId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceAlertEvent" ADD CONSTRAINT "AttendanceAlertEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Assignment overlap is a database invariant, not only an API preflight.
ALTER TABLE "AttendanceScheduleAssignment"
ADD CONSTRAINT "AttendanceScheduleAssignment_no_overlap_excl"
EXCLUDE USING gist (
  "projectId" WITH =,
  "workerId" WITH =,
  daterange("effectiveFrom", COALESCE("effectiveThrough", 'infinity'::date), '[]') WITH &&
);

-- Existing populated tables are expanded without a rewrite. Their supporting
-- unique indexes and FK validation are split into the following migrations.
ALTER TABLE "AttendanceShift" ADD COLUMN "expectationId" TEXT;
ALTER TABLE "AttendanceShift" DROP CONSTRAINT "AttendanceShift_lifecycle_check";
ALTER TABLE "AttendanceShift" DROP CONSTRAINT "AttendanceShift_phase_check";
ALTER TABLE "AttendanceShift" ADD CONSTRAINT "AttendanceShift_lifecycle_check" CHECK (
  ("status" IN ('OPEN', 'PENDING_CLOSE') AND "closedAt" IS NULL)
  OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL)
  OR ("status" = 'LEGACY_INCOMPLETE' AND "closedAt" IS NULL)
  OR "status" = 'VOIDED'
) NOT VALID;
ALTER TABLE "AttendanceShift" ADD CONSTRAINT "AttendanceShift_phase_check" CHECK (
  "status" IN ('OPEN', 'PENDING_CLOSE') OR "phase" = 'WORKING'
) NOT VALID;
