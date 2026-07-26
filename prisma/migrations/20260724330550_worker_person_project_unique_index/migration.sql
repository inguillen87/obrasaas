-- A legal person may have only one Worker bridge row in the same project.
-- Legacy workers without personId remain valid during the expand phase.
CREATE UNIQUE INDEX CONCURRENTLY "Worker_one_person_per_project_idx"
ON "Worker"("organizationId", "personId", "projectId")
WHERE "personId" IS NOT NULL;
