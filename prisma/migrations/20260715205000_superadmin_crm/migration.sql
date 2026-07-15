-- CreateEnum
CREATE TYPE "CrmStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DEMO', 'PROPOSAL', 'TRIAL', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "CrmAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "segment" TEXT,
    "source" TEXT,
    "stage" "CrmStage" NOT NULL DEFAULT 'NEW',
    "estimatedSeats" INTEGER,
    "estimatedMonthlyValue" DECIMAL(12,2),
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmAccount_organizationId_key" ON "CrmAccount"("organizationId");

-- CreateIndex
CREATE INDEX "CrmAccount_stage_nextFollowUpAt_idx" ON "CrmAccount"("stage", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "CrmAccount_email_idx" ON "CrmAccount"("email");

-- AddForeignKey
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
