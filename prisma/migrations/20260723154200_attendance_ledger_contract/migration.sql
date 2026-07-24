-- The validated required checks prove the backfill is complete and let
-- PostgreSQL install NOT NULL without a populated-table rescan while holding
-- the stronger ALTER TABLE lock.
ALTER TABLE "AttendanceEntry"
ALTER COLUMN "eventType" SET DEFAULT 'CHECK_IN',
ALTER COLUMN "eventType" SET NOT NULL,
ALTER COLUMN "verificationStatus" SET DEFAULT 'LEGACY',
ALTER COLUMN "verificationStatus" SET NOT NULL,
ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "occurredAt" SET NOT NULL,
ALTER COLUMN "idempotencyKey" SET DEFAULT gen_random_uuid()::text,
ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- The composite worker FK is already valid, so retiring the legacy global-id
-- FK cannot create an integrity window.
ALTER TABLE "AttendanceEntry"
DROP CONSTRAINT "AttendanceEntry_workerId_fkey";
