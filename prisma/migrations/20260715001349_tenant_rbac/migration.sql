-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('ADMIN', 'DIRECTOR', 'SITE_MANAGER', 'FINANCE', 'AUDITOR');

-- AlterTable
ALTER TABLE "TenantMembership" ADD COLUMN     "tenantRole" "TenantRole" NOT NULL DEFAULT 'AUDITOR';

-- CreateIndex
CREATE INDEX "TenantMembership_organizationId_tenantRole_status_idx" ON "TenantMembership"("organizationId", "tenantRole", "status");
