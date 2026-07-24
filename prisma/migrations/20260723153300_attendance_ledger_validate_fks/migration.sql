-- Validate scoped ownership before retiring the legacy workerId-only key.
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_worker_scope_fkey";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_shift_scope_fkey";
