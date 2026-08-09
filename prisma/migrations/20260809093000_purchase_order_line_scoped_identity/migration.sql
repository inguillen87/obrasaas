-- Materialize the project-scoped candidate key already declared in Prisma.
-- Keep this migration isolated because PostgreSQL forbids CONCURRENTLY inside
-- a transaction and a failed concurrent build needs its own recovery path.
SET lock_timeout = '5s';

-- `id` is already globally unique, so this cannot reveal legitimate
-- duplicates. The scoped key keeps future project-scoped references explicit.
CREATE UNIQUE INDEX CONCURRENTLY "PurchaseOrderLine_projectId_id_key"
  ON "PurchaseOrderLine"("projectId", "id");

RESET lock_timeout;
