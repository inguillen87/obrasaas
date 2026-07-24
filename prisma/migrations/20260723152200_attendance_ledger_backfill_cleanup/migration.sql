-- The run completed before Prisma reaches this migration, so the temporary
-- deployment procedure is no longer part of the runtime database surface.
DROP PROCEDURE obrasaas_backfill_attendance_ledger(INTEGER);
