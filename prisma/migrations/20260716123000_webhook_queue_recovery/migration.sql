-- Support provider delivery receipts without replacing ObraSaaS correlation IDs.
ALTER TABLE "Message"
ADD COLUMN "providerMessageId" TEXT;

CREATE UNIQUE INDEX "Message_providerMessageId_key"
ON "Message"("providerMessageId");

-- Keep expired-lease sweeps bounded as webhook volume grows.
CREATE INDEX "WebhookEvent_projectId_status_leaseExpiresAt_createdAt_idx"
ON "WebhookEvent"("projectId", "status", "leaseExpiresAt", "createdAt");
