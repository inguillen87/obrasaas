-- Expand-only tenant scope key used by the worker identity graph.
-- Keep each concurrent build in its own Prisma migration.
CREATE UNIQUE INDEX CONCURRENTLY "Project_organizationId_id_key"
ON "Project"("organizationId", "id");
