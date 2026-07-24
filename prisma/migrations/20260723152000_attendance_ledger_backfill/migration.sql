-- Backfill phase: define a procedure that processes a bounded number of rows
-- per transaction. The following Prisma migration contains only CALL, which
-- keeps the invocation top-level so PostgreSQL permits transaction control.
CREATE PROCEDURE obrasaas_backfill_attendance_ledger(batch_size INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  batch_ids TEXT[];
  backfilled_rows INTEGER;
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 10000 THEN
    RAISE EXCEPTION 'attendance ledger batch_size must be between 1 and 10000';
  END IF;

  LOOP
    SELECT array_agg(candidate."id" ORDER BY candidate."id")
    INTO batch_ids
    FROM (
      SELECT attendance."id"
      FROM "AttendanceEntry" AS attendance
      WHERE attendance."eventType" IS NULL
         OR attendance."verificationStatus" IS NULL
         OR attendance."occurredAt" IS NULL
         OR attendance."idempotencyKey" IS NULL
      ORDER BY attendance."id"
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    ) AS candidate;

    EXIT WHEN batch_ids IS NULL;

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
    )
    SELECT
      'legacy-shift:' || attendance."id",
      attendance."projectId",
      attendance."workerId",
      (
        (attendance."checkedInAt" AT TIME ZONE 'UTC')
        AT TIME ZONE organization."timezone"
      )::date,
      organization."timezone",
      'LEGACY_INCOMPLETE'::"AttendanceShiftStatus",
      'WORKING'::"AttendanceShiftPhase",
      attendance."checkedInAt",
      NULL,
      0,
      jsonb_build_object(
        'migration', '20260723152100_attendance_ledger_backfill_run',
        'attendanceEntryId', attendance."id"
      ),
      attendance."createdAt",
      attendance."createdAt"
    FROM "AttendanceEntry" AS attendance
    INNER JOIN "Project" AS project ON project."id" = attendance."projectId"
    INNER JOIN "Organization" AS organization
      ON organization."id" = project."organizationId"
    WHERE attendance."id" = ANY(batch_ids)
      AND attendance."shiftId" IS NULL
      AND attendance."status" IN (
        'PRESENT'::"AttendanceStatus",
        'OUTSIDE_GEOFENCE'::"AttendanceStatus"
      )
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "AttendanceEntry" AS attendance
    SET
      "shiftId" = CASE
        WHEN attendance."status" IN (
          'PRESENT'::"AttendanceStatus",
          'OUTSIDE_GEOFENCE'::"AttendanceStatus"
        )
          THEN COALESCE(attendance."shiftId", 'legacy-shift:' || attendance."id")
        ELSE attendance."shiftId"
      END,
      "eventType" = COALESCE(
        attendance."eventType",
        'CHECK_IN'::"AttendanceEventType"
      ),
      "verificationStatus" = COALESCE(
        attendance."verificationStatus",
        CASE attendance."status"
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
        END
      ),
      "occurredAt" = COALESCE(attendance."occurredAt", attendance."checkedInAt"),
      -- sourceOccurredAt deliberately remains NULL. The legacy model did not
      -- preserve a trustworthy client/source clock.
      "sequence" = CASE
        WHEN attendance."status" IN (
          'PRESENT'::"AttendanceStatus",
          'OUTSIDE_GEOFENCE'::"AttendanceStatus"
        )
          THEN COALESCE(attendance."sequence", 1)
        ELSE attendance."sequence"
      END,
      "idempotencyKey" = COALESCE(
        attendance."idempotencyKey",
        'legacy:' || attendance."id"
      )
    WHERE attendance."id" = ANY(batch_ids);

    GET DIAGNOSTICS backfilled_rows = ROW_COUNT;
    IF backfilled_rows = 0 THEN
      RAISE EXCEPTION 'attendance ledger backfill made no progress';
    END IF;

    -- Release row versions and WAL pressure before selecting the next batch.
    COMMIT;
  END LOOP;
END;
$$;
