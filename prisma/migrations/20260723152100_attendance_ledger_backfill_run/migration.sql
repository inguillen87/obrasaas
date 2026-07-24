-- CALL must be the only statement in this Prisma migration. That makes the
-- procedure top-level and permits its bounded batches to COMMIT independently.
CALL obrasaas_backfill_attendance_ledger(1000);
