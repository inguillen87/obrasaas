-- NOT VALID keeps the expand phase online while immediately protecting new writes.
ALTER TABLE "Worker"
  ADD CONSTRAINT "Worker_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "Worker_organizationId_personId_fkey"
  FOREIGN KEY ("organizationId", "personId") REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "Worker_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "Worker_person_scope_check"
  CHECK ("personId" IS NULL OR "organizationId" IS NOT NULL) NOT VALID;

ALTER TABLE "WorkerOnboardingClaim"
  ADD CONSTRAINT "WorkerClaim_resolved_worker_scope_fkey"
  FOREIGN KEY ("organizationId", "resolvedPersonId", "projectId", "resolvedWorkerId")
  REFERENCES "Worker"("organizationId", "personId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
