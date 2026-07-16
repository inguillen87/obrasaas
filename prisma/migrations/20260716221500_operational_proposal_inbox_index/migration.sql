-- Keep the tenant-scoped approvals inbox efficient across pending and history views.
CREATE INDEX "OperationalProposal_projectId_status_createdAt_idx"
ON "OperationalProposal"("projectId", "status", "createdAt");
