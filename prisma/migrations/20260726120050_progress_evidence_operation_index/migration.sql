-- Idempotency remains project-scoped and is closed at the database boundary.
CREATE UNIQUE INDEX CONCURRENTLY "ProgressEvidence_project_operation_key"
  ON "ProgressEvidence"("projectId", "sourceOperationKeyHash");
