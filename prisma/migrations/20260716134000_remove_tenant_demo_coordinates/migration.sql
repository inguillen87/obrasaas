-- Historical tenant bootstrap used the internal Palermo demo coordinates.
-- Clear only the exact legacy placeholder so real tenant locations are untouched.
UPDATE "Project" AS project
SET
  "address" = NULL,
  "latitude" = NULL,
  "longitude" = NULL
FROM "Organization" AS organization
WHERE project."organizationId" = organization."id"
  AND COALESCE(organization."clerkOrganizationId", '') <> 'system:obrasaas'
  AND organization."metadata"->>'internal' IS DISTINCT FROM 'true'
  AND organization."name" <> 'ObraSaaS Operaciones'
  AND project."name" = 'Obra principal'
  AND project."slug" = 'obra-principal'
  AND project."address" = 'Argentina'
  AND project."latitude" = -34.5886000
  AND project."longitude" = -58.4302000;

-- Reconcile the internal operating project that predates the metadata-aware
-- bootstrap branch. This is the only organization allowed to keep demo data.
UPDATE "Project" AS project
SET
  "name" = 'Obra Palermo',
  "slug" = 'palermo'
FROM "Organization" AS organization
WHERE project."organizationId" = organization."id"
  AND (
    organization."clerkOrganizationId" = 'system:obrasaas'
    OR organization."metadata"->>'internal' = 'true'
  )
  AND project."name" = 'Obra principal'
  AND project."slug" = 'obra-principal'
  AND NOT EXISTS (
    SELECT 1
    FROM "Project" AS existing
    WHERE existing."organizationId" = project."organizationId"
      AND existing."slug" = 'palermo'
      AND existing."id" <> project."id"
  );
