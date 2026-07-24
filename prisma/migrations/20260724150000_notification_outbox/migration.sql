CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER', 'READ');

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "recipientId" TEXT NOT NULL,
  "eventKey" VARCHAR(190) NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "title" VARCHAR(220) NOT NULL,
  "body" TEXT NOT NULL,
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leasedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationDelivery_recipientId_channel_eventKey_key" ON "NotificationDelivery"("recipientId", "channel", "eventKey");
CREATE INDEX "NotificationDelivery_organizationId_status_nextAttemptAt_idx" ON "NotificationDelivery"("organizationId", "status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_projectId_recipientId_status_createdAt_idx" ON "NotificationDelivery"("projectId", "recipientId", "status", "createdAt");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_attempts_check" CHECK ("attempts" >= 0);
