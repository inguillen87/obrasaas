-- Worker is an existing table, so build the bridge lookup index without blocking writes.
CREATE INDEX CONCURRENTLY "Worker_organizationId_personId_idx"
ON "Worker"("organizationId", "personId");
