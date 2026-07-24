-- This populated-table index must be the only statement in its Prisma
-- migration so PostgreSQL executes CONCURRENTLY outside a transaction block.
CREATE UNIQUE INDEX CONCURRENTLY "Worker_projectId_id_key"
ON "Worker" ("projectId", "id");
