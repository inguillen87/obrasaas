-- Validate ledger semantics after the bounded backfill. Each constraint was
-- already enforcing new writes from the expand phase onward.
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_sequence_positive_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_shift_sequence_pair_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_non_checkin_requires_shift_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_idempotency_not_blank_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_request_fingerprint_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_privacy_notice_not_blank_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_evidence_container_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_event_type_required_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_verification_status_required_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_occurred_at_required_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_idempotency_required_check";
