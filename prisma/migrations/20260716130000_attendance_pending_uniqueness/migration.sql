-- A location request is valid for two hours. Retire stale rows before adding
-- the invariant so an old check-in can never block a new one indefinitely.
UPDATE "AttendanceEntry"
SET "status" = 'ABSENT'
WHERE "status" = 'PENDING_GEO'
  AND "checkedInAt" < CURRENT_TIMESTAMP - INTERVAL '2 hours';

-- Keep the newest row if an earlier version allowed concurrent pending
-- check-ins for the same worker and project.
WITH ranked_pending AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "workerId"
      ORDER BY "checkedInAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "AttendanceEntry"
  WHERE "status" = 'PENDING_GEO'
)
UPDATE "AttendanceEntry" AS attendance
SET "status" = 'ABSENT'
FROM ranked_pending
WHERE attendance."id" = ranked_pending."id"
  AND ranked_pending.row_number > 1;

CREATE UNIQUE INDEX "AttendanceEntry_one_pending_geo_per_worker_idx"
ON "AttendanceEntry"("projectId", "workerId")
WHERE "status" = 'PENDING_GEO';
