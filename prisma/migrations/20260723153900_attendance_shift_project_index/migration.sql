CREATE INDEX CONCURRENTLY "AttendanceShift_project_date_status_idx"
ON "AttendanceShift" ("projectId", "workDate", "status");
