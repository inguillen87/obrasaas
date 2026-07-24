CREATE INDEX CONCURRENTLY "AttendanceEntry_project_worker_occurred_idx"
ON "AttendanceEntry" ("projectId", "workerId", "occurredAt");
