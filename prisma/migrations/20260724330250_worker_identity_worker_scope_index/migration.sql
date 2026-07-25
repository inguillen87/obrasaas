-- The approved onboarding result must bind tenant, person, project, and worker.
CREATE UNIQUE INDEX CONCURRENTLY "Worker_org_person_project_id_key"
ON "Worker"("organizationId", "personId", "projectId", "id");
