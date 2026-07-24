-- One concurrent index build per Prisma migration keeps PostgreSQL outside an
-- implicit multi-statement transaction block.
CREATE UNIQUE INDEX CONCURRENTLY "AttendanceEntry_idempotencyKey_key"
ON "AttendanceEntry" ("idempotencyKey");
