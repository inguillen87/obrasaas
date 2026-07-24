-- Attach the expectation FK without an initial heap scan. Validation is a
-- separate step so deployment can stop safely on lock timeout.
ALTER TABLE "AttendanceShift"
ADD CONSTRAINT "AttendanceShift_expectation_scope_fkey"
FOREIGN KEY ("expectationId", "projectId", "workerId")
REFERENCES "AttendanceExpectation"("id", "projectId", "workerId")
ON DELETE NO ACTION ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AttendanceShift" VALIDATE CONSTRAINT "AttendanceShift_lifecycle_check";
ALTER TABLE "AttendanceShift" VALIDATE CONSTRAINT "AttendanceShift_phase_check";
ALTER TABLE "AttendanceShift" VALIDATE CONSTRAINT "AttendanceShift_expectation_scope_fkey";
