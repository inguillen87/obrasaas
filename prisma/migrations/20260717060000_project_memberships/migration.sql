BEGIN;

CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tenantMembershipId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMembership_projectId_tenantMembershipId_key"
ON "ProjectMembership"("projectId", "tenantMembershipId");

CREATE INDEX "ProjectMembership_tenantMembershipId_status_projectId_idx"
ON "ProjectMembership"("tenantMembershipId", "status", "projectId");

CREATE INDEX "ProjectMembership_projectId_status_idx"
ON "ProjectMembership"("projectId", "status");

ALTER TABLE "ProjectMembership"
ADD CONSTRAINT "ProjectMembership_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMembership"
ADD CONSTRAINT "ProjectMembership_tenantMembershipId_fkey"
FOREIGN KEY ("tenantMembershipId") REFERENCES "TenantMembership"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the access surface that existed before project-level assignments.
-- New projects use least privilege and do not repeat this portfolio-wide grant.
INSERT INTO "ProjectMembership" (
    "id",
    "projectId",
    "tenantMembershipId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'pm_' || md5(project."id" || ':' || membership."id"),
    project."id",
    membership."id",
    'ACTIVE'::"MembershipStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Project" AS project
JOIN "TenantMembership" AS membership
  ON membership."organizationId" = project."organizationId"
WHERE membership."status" = 'ACTIVE'::"MembershipStatus"
  AND project."status" <> 'ARCHIVED'::"ProjectStatus";

COMMIT;
