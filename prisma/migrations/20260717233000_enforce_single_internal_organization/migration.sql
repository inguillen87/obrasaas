DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "Organization"
    WHERE "clerkOrganizationId" = 'system:obrasaas'
       OR "metadata"->>'internal' = 'true'
  ) > 1 THEN
    RAISE EXCEPTION 'Multiple internal ObraSaaS organizations exist; refusing uniqueness migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Organization_single_internal_key"
ON "Organization" ((1))
WHERE "clerkOrganizationId" = 'system:obrasaas'
   OR "metadata"->>'internal' = 'true';
