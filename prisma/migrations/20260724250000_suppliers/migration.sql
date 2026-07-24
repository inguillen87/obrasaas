CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalName" VARCHAR(220) NOT NULL,
  "taxId" VARCHAR(64),
  "email" VARCHAR(190),
  "phone" VARCHAR(64),
  "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
  "paymentTerms" VARCHAR(160),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Supplier_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Supplier_organizationId_id_key" ON "Supplier"("organizationId", "id");
CREATE UNIQUE INDEX "Supplier_organizationId_taxId_key" ON "Supplier"("organizationId", "taxId");
CREATE INDEX "Supplier_organizationId_active_legalName_idx" ON "Supplier"("organizationId", "active", "legalName");
