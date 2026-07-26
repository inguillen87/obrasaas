-- Tenant-scoped actor foreign keys require a stable composite candidate key.
-- Keep this concurrent build isolated so PostgreSQL never blocks tenant writes
-- behind a table-wide index build.
CREATE UNIQUE INDEX CONCURRENTLY "TenantMembership_organizationId_id_key"
ON "TenantMembership"("organizationId", "id");
