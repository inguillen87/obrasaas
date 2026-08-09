-- Add the direct project ownership edge using expand-then-validate so the
-- existing table is not scanned while holding ACCESS EXCLUSIVE.
SET lock_timeout = '5s';

-- CASCADE matches the existing Project -> Task/WorkTeam -> TaskAssignment
-- ownership paths. RESTRICT here would prevent the intended project cascade.
ALTER TABLE "TaskAssignment"
  ADD CONSTRAINT "TaskAssignment_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "TaskAssignment"
  VALIDATE CONSTRAINT "TaskAssignment_projectId_fkey";

RESET lock_timeout;
