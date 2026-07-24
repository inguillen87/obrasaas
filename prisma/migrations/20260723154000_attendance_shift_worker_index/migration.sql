CREATE INDEX CONCURRENTLY "AttendanceShift_worker_opened_idx"
ON "AttendanceShift" ("workerId", "openedAt");
