ALTER TABLE "CashMovement" ADD COLUMN "fingerprint" VARCHAR(64);
CREATE INDEX "CashMovement_projectId_fingerprint_idx" ON "CashMovement"("projectId", "fingerprint");
