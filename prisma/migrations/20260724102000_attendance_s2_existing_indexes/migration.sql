-- Build populated-table indexes without blocking attendance writes.
CREATE UNIQUE INDEX CONCURRENTLY "AttendanceShift_expectation_scope_key"
ON "AttendanceShift"("expectationId", "projectId", "workerId");
