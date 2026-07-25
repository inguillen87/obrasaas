-- PostgreSQL validates with a low-impact lock; legacy rows with null bridge fields remain valid.
ALTER TABLE "Worker"
  VALIDATE CONSTRAINT "Worker_organizationId_fkey";

ALTER TABLE "Worker"
  VALIDATE CONSTRAINT "Worker_organizationId_personId_fkey";

ALTER TABLE "Worker"
  VALIDATE CONSTRAINT "Worker_organizationId_projectId_fkey";

ALTER TABLE "Worker"
  VALIDATE CONSTRAINT "Worker_person_scope_check";

ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerClaim_resolved_worker_scope_fkey";
