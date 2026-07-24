-- Contract validation uses NOT VALID + VALIDATE so reads and writes may
-- continue while PostgreSQL scans existing shift rows.
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_revision_nonnegative_check";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_timezone_not_blank_check";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_closed_after_opened_check";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_lifecycle_check";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_phase_check";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_metadata_object_check";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_projectId_fkey";
ALTER TABLE "AttendanceShift"
VALIDATE CONSTRAINT "AttendanceShift_worker_scope_fkey";
