-- Correction requests use a project-scoped FK to immutable physical events.
-- Build its supporting unique index before creating the S2 correction table.
CREATE UNIQUE INDEX CONCURRENTLY "AttendanceEntry_id_project_worker_key"
ON "AttendanceEntry"("id", "projectId", "workerId");
