-- Expand phase: add the ledger structures without rewriting AttendanceEntry
-- or requiring the new application binary to be deployed at the same instant.
-- Do not wrap this file in BEGIN/COMMIT: later migrations use concurrent index
-- builds and the rolling-deploy bridge must become available promptly.

CREATE TYPE "AttendanceEventType" AS ENUM (
  'CHECK_IN',
  'BREAK_START',
  'BREAK_END',
  'CHECK_OUT'
);

CREATE TYPE "AttendanceVerificationStatus" AS ENUM (
  'LEGACY',
  'PENDING',
  'VERIFIED',
  'REVIEW_REQUIRED',
  'NOT_REQUIRED',
  'EXPIRED',
  'VOIDED'
);

CREATE TYPE "AttendanceShiftStatus" AS ENUM (
  'OPEN',
  'CLOSED',
  'LEGACY_INCOMPLETE',
  'VOIDED'
);

CREATE TYPE "AttendanceShiftPhase" AS ENUM (
  'WORKING',
  'ON_BREAK'
);

-- Fail before changing relational authority when legacy rows already cross a
-- tenant boundary or an organization timezone cannot reconstruct workDate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AttendanceEntry" AS attendance
    INNER JOIN "Worker" AS worker ON worker."id" = attendance."workerId"
    WHERE worker."projectId" IS DISTINCT FROM attendance."projectId"
  ) THEN
    RAISE EXCEPTION
      'Attendance ledger migration found a worker linked to a different project';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Organization" AS organization
    LEFT JOIN pg_timezone_names AS timezone
      ON timezone.name = organization."timezone"
    WHERE timezone.name IS NULL
  ) THEN
    RAISE EXCEPTION
      'Attendance ledger migration found an invalid organization timezone';
  END IF;
END
$$;

CREATE TABLE "AttendanceShift" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "status" "AttendanceShiftStatus" NOT NULL DEFAULT 'OPEN',
  "phase" "AttendanceShiftPhase" NOT NULL DEFAULT 'WORKING',
  "openedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AttendanceShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceShift_id_project_worker_key"
    UNIQUE ("id", "projectId", "workerId")
);

-- New columns remain nullable in the expand phase. The bridge trigger fills
-- them for old binaries; the batched backfill fills historical rows. Defaults
-- and NOT NULL are installed only after validation in the contract phase.
ALTER TABLE "AttendanceEntry"
ADD COLUMN "shiftId" TEXT,
ADD COLUMN "eventType" "AttendanceEventType",
ADD COLUMN "verificationStatus" "AttendanceVerificationStatus",
ADD COLUMN "occurredAt" TIMESTAMP(3),
ADD COLUMN "sourceOccurredAt" TIMESTAMP(3),
ADD COLUMN "sequence" INTEGER,
ADD COLUMN "idempotencyKey" VARCHAR(190),
ADD COLUMN "requestFingerprint" CHAR(64),
ADD COLUMN "accuracyMeters" DECIMAL(9,2),
ADD COLUMN "geofenceRadiusMeters" INTEGER,
ADD COLUMN "privacyNoticeVersion" VARCHAR(64),
ADD COLUMN "evidence" JSONB;

-- Checks and foreign keys are introduced without scanning or locking the
-- populated table. The contract migration validates each one after backfill.
ALTER TABLE "AttendanceShift"
ADD CONSTRAINT "AttendanceShift_revision_nonnegative_check"
  CHECK ("revision" >= 0) NOT VALID,
ADD CONSTRAINT "AttendanceShift_timezone_not_blank_check"
  CHECK (char_length(btrim("timezone")) BETWEEN 1 AND 64) NOT VALID,
ADD CONSTRAINT "AttendanceShift_closed_after_opened_check"
  CHECK ("closedAt" IS NULL OR "closedAt" >= "openedAt") NOT VALID,
ADD CONSTRAINT "AttendanceShift_lifecycle_check"
  CHECK (
    ("status" = 'OPEN' AND "closedAt" IS NULL)
    OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL)
    OR ("status" = 'LEGACY_INCOMPLETE' AND "closedAt" IS NULL)
    OR "status" = 'VOIDED'
  ) NOT VALID,
ADD CONSTRAINT "AttendanceShift_phase_check"
  CHECK ("status" = 'OPEN' OR "phase" = 'WORKING') NOT VALID,
ADD CONSTRAINT "AttendanceShift_metadata_object_check"
  CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object') NOT VALID;

ALTER TABLE "AttendanceEntry"
ADD CONSTRAINT "AttendanceEntry_coordinate_pair_check"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL)) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_latitude_range_check"
  CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_longitude_range_check"
  CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_accuracy_range_check"
  CHECK (
    "accuracyMeters" IS NULL
    OR "accuracyMeters" BETWEEN 0 AND 100000
  ) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_distance_nonnegative_check"
  CHECK ("distanceMeters" IS NULL OR "distanceMeters" >= 0) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_geofence_radius_positive_check"
  CHECK ("geofenceRadiusMeters" IS NULL OR "geofenceRadiusMeters" > 0) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_sequence_positive_check"
  CHECK ("sequence" IS NULL OR "sequence" > 0) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_shift_sequence_pair_check"
  CHECK (("shiftId" IS NULL) = ("sequence" IS NULL)) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_non_checkin_requires_shift_check"
  CHECK ("eventType" = 'CHECK_IN' OR "shiftId" IS NOT NULL) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_idempotency_not_blank_check"
  CHECK (
    "idempotencyKey" IS NULL
    OR char_length(btrim("idempotencyKey")) BETWEEN 1 AND 190
  ) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_request_fingerprint_check"
  CHECK (
    "requestFingerprint" IS NULL
    OR "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_privacy_notice_not_blank_check"
  CHECK (
    "privacyNoticeVersion" IS NULL
    OR char_length(btrim("privacyNoticeVersion")) BETWEEN 1 AND 64
  ) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_evidence_container_check"
  CHECK (
    "evidence" IS NULL
    OR jsonb_typeof("evidence") IN ('object', 'array')
  ) NOT VALID;

-- Rolling-deploy compatibility for the previous binary. Accepted legacy
-- writes create an OPEN bridge shift, never a historical incomplete shift.
-- A Worker row lock serializes the invariant even before the concurrent
-- one-open index is installed. A second check-in is rejected rather than
-- silently inventing another active jornada.
CREATE FUNCTION obrasaas_sync_legacy_attendance_ledger()
RETURNS TRIGGER AS $$
DECLARE
  legacy_write BOOLEAN := FALSE;
  shift_timezone VARCHAR(64);
  existing_open_shift_id TEXT;
  bridge_shift_id TEXT;
BEGIN
  legacy_write := (
    TG_OP = 'INSERT'
    AND (
      NEW."verificationStatus" IS NULL
      OR NEW."verificationStatus" = 'LEGACY'::"AttendanceVerificationStatus"
    )
  ) OR (
    TG_OP = 'UPDATE'
    AND NEW."status" IS DISTINCT FROM OLD."status"
    AND NEW."verificationStatus" IS NOT DISTINCT FROM OLD."verificationStatus"
  );

  IF TG_OP = 'INSERT' AND legacy_write THEN
    -- PostgreSQL applies column defaults before BEFORE INSERT triggers. The
    -- contract phase adds defaults for the new binary, so overwrite them for
    -- an old-shape write to preserve its historical identity and clock.
    NEW."eventType" := 'CHECK_IN'::"AttendanceEventType";
    NEW."occurredAt" := NEW."checkedInAt";
    NEW."idempotencyKey" := 'legacy:' || NEW."id";
  ELSE
    IF NEW."eventType" IS NULL THEN
      NEW."eventType" := 'CHECK_IN'::"AttendanceEventType";
    END IF;
    IF NEW."occurredAt" IS NULL THEN
      NEW."occurredAt" := NEW."checkedInAt";
    END IF;
    IF NEW."idempotencyKey" IS NULL THEN
      NEW."idempotencyKey" := 'legacy:' || NEW."id";
    END IF;
  END IF;

  IF legacy_write THEN
    NEW."verificationStatus" := CASE NEW."status"
      WHEN 'PENDING_GEO'::"AttendanceStatus"
        THEN 'PENDING'::"AttendanceVerificationStatus"
      WHEN 'PRESENT'::"AttendanceStatus"
        THEN 'VERIFIED'::"AttendanceVerificationStatus"
      WHEN 'OUTSIDE_GEOFENCE'::"AttendanceStatus"
        THEN 'REVIEW_REQUIRED'::"AttendanceVerificationStatus"
      WHEN 'EXCUSED'::"AttendanceStatus"
        THEN 'NOT_REQUIRED'::"AttendanceVerificationStatus"
      WHEN 'ABSENT'::"AttendanceStatus"
        THEN 'LEGACY'::"AttendanceVerificationStatus"
      WHEN 'EXPIRED'::"AttendanceStatus"
        THEN 'EXPIRED'::"AttendanceVerificationStatus"
      ELSE 'LEGACY'::"AttendanceVerificationStatus"
    END;
  ELSIF NEW."verificationStatus" IS NULL THEN
    NEW."verificationStatus" := 'LEGACY'::"AttendanceVerificationStatus";
  END IF;

  IF (
    legacy_write
    AND NEW."shiftId" IS NULL
    AND NEW."status" IN (
      'PRESENT'::"AttendanceStatus",
      'OUTSIDE_GEOFENCE'::"AttendanceStatus"
    )
  ) THEN
    PERFORM 1
    FROM "Worker"
    WHERE "projectId" = NEW."projectId"
      AND "id" = NEW."workerId"
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Attendance worker scope does not exist'
        USING ERRCODE = '23503',
              CONSTRAINT = 'AttendanceEntry_worker_scope_fkey';
    END IF;

    SELECT shift."id"
    INTO existing_open_shift_id
    FROM "AttendanceShift" AS shift
    WHERE shift."projectId" = NEW."projectId"
      AND shift."workerId" = NEW."workerId"
      AND shift."status" = 'OPEN'::"AttendanceShiftStatus"
    LIMIT 1;

    IF existing_open_shift_id IS NOT NULL THEN
      RAISE EXCEPTION 'Worker already has an open attendance shift'
        USING ERRCODE = '23505',
              CONSTRAINT = 'AttendanceShift_one_open_per_worker_idx';
    END IF;

    SELECT organization."timezone"
    INTO STRICT shift_timezone
    FROM "Project" AS project
    INNER JOIN "Organization" AS organization
      ON organization."id" = project."organizationId"
    WHERE project."id" = NEW."projectId";

    bridge_shift_id := 'legacy-bridge:' || NEW."id";

    INSERT INTO "AttendanceShift" (
      "id",
      "projectId",
      "workerId",
      "workDate",
      "timezone",
      "status",
      "phase",
      "openedAt",
      "closedAt",
      "revision",
      "metadata",
      "createdAt",
      "updatedAt"
    ) VALUES (
      bridge_shift_id,
      NEW."projectId",
      NEW."workerId",
      (
        (NEW."checkedInAt" AT TIME ZONE 'UTC')
        AT TIME ZONE shift_timezone
      )::date,
      shift_timezone,
      'OPEN'::"AttendanceShiftStatus",
      'WORKING'::"AttendanceShiftPhase",
      NEW."checkedInAt",
      NULL,
      0,
      jsonb_build_object(
        'migration', '20260723151000_attendance_ledger_expand',
        'attendanceEntryId', NEW."id",
        'rollingCompatibility', TRUE
      ),
      COALESCE(NEW."createdAt", CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP
    );

    NEW."shiftId" := bridge_shift_id;
    NEW."sequence" := 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AttendanceEntry_legacy_verification_insert_trg"
BEFORE INSERT ON "AttendanceEntry"
FOR EACH ROW
EXECUTE FUNCTION obrasaas_sync_legacy_attendance_ledger();

CREATE TRIGGER "AttendanceEntry_legacy_verification_update_trg"
BEFORE UPDATE OF "status" ON "AttendanceEntry"
FOR EACH ROW
EXECUTE FUNCTION obrasaas_sync_legacy_attendance_ledger();

-- NOT VALID checks still apply to new rows. Install the bridge first so a
-- pre-S1 binary can never observe required columns without the trigger that
-- supplies them during a rolling deploy.
ALTER TABLE "AttendanceEntry"
ADD CONSTRAINT "AttendanceEntry_event_type_required_check"
  CHECK ("eventType" IS NOT NULL) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_verification_status_required_check"
  CHECK ("verificationStatus" IS NOT NULL) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_occurred_at_required_check"
  CHECK ("occurredAt" IS NOT NULL) NOT VALID,
ADD CONSTRAINT "AttendanceEntry_idempotency_required_check"
  CHECK ("idempotencyKey" IS NOT NULL) NOT VALID;
