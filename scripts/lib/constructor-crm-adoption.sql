-- Applied only by the guarded, bounded constructor CRM migration helper.
-- Existing platform cards keep NULL owner; no customer/contact data is imported.
ALTER TABLE public."CrmAccount"
  ADD COLUMN "ownerOrganizationId" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "CrmAccount_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CrmAccount_revision_check" CHECK ("revision" >= 1),
  ADD CONSTRAINT "CrmAccount_owner_exclusive_check" CHECK ("ownerOrganizationId" IS NULL OR "organizationId" IS NULL);
CREATE INDEX "CrmAccount_ownerOrganizationId_id_idx" ON public."CrmAccount"("ownerOrganizationId", "id");
