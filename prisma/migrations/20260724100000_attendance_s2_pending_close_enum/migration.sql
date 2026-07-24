-- PENDING_CLOSE is a lifecycle projection, not a fabricated checkout.
-- Keep the enum change isolated because PostgreSQL cannot safely consume a
-- newly added enum value from every statement shape in the same transaction.
ALTER TYPE "AttendanceShiftStatus"
ADD VALUE IF NOT EXISTS 'PENDING_CLOSE' AFTER 'OPEN';
