CREATE TYPE "CashFundStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "CashMovementKind" AS ENUM ('FUNDING', 'EXPENSE', 'REIMBURSEMENT', 'ADJUSTMENT');
CREATE TYPE "CashMovementStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');
CREATE TABLE "CashFund" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "custodianId" TEXT NOT NULL,
  "status" "CashFundStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashFund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashFund_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CashFund_custodian_fkey" FOREIGN KEY ("custodianId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CashFund_projectId_id_key" ON "CashFund"("projectId", "id");
CREATE INDEX "CashFund_projectId_status_idx" ON "CashFund"("projectId", "status");
CREATE TABLE "CashMovement" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fundId" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(190) NOT NULL,
  "kind" "CashMovementKind" NOT NULL,
  "status" "CashMovementStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(14,2) NOT NULL,
  "category" VARCHAR(96) NOT NULL,
  "description" VARCHAR(500),
  "receipt" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashMovement_fund_fkey" FOREIGN KEY ("projectId", "fundId") REFERENCES "CashFund"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CashMovement_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "CashMovement_projectId_id_key" ON "CashMovement"("projectId", "id");
CREATE UNIQUE INDEX "CashMovement_projectId_idempotencyKey_key" ON "CashMovement"("projectId", "idempotencyKey");
CREATE INDEX "CashMovement_projectId_fundId_status_createdAt_idx" ON "CashMovement"("projectId", "fundId", "status", "createdAt");
