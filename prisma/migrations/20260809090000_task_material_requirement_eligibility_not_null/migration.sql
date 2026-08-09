-- Hotfix for 20260802180000_task_material_requirements.
--
-- PostgreSQL does not infer NOT NULL metadata from a non-null generated
-- expression. The canonical-task identity FK is already safe because each BOM
-- revision snapshots TRUE, but Prisma and the live catalog contract require the
-- generated eligibility column itself to be physically NOT NULL.

SET lock_timeout = '5s';

-- Prisma executes PostgreSQL migration statements separately. Removing this
-- migration-owned helper first makes a retry safe if a prior attempt stopped
-- after ADD or VALIDATE but before SET NOT NULL / DROP.
ALTER TABLE "Task"
  DROP CONSTRAINT IF EXISTS "Task_material_requirement_eligibility_not_null_check";

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_material_requirement_eligibility_not_null_check"
  CHECK ("materialRequirementEligible" IS NOT NULL)
  NOT VALID;

ALTER TABLE "Task"
  VALIDATE CONSTRAINT "Task_material_requirement_eligibility_not_null_check";

ALTER TABLE "Task"
  ALTER COLUMN "materialRequirementEligible" SET NOT NULL;

ALTER TABLE "Task"
  DROP CONSTRAINT IF EXISTS "Task_material_requirement_eligibility_not_null_check";

RESET lock_timeout;
