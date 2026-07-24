CREATE UNIQUE INDEX CONCURRENTLY "AttendanceShift_one_open_per_worker_idx"
ON "AttendanceShift" ("projectId", "workerId")
WHERE "status" = 'OPEN';
