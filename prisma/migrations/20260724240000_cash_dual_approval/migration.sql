ALTER TYPE "CashMovementStatus" ADD VALUE 'PARTIALLY_APPROVED';
ALTER TABLE "CashMovement" ADD COLUMN "firstApproverId" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN "secondApproverId" TEXT;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_firstApprover_fkey" FOREIGN KEY ("firstApproverId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_secondApprover_fkey" FOREIGN KEY ("secondApproverId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
