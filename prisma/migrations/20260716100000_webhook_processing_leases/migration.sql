-- Extend attendance persistence for check-ins that still require geofence validation.
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'PENDING_GEO';

-- Turn webhook deduplication records into recoverable, leased queue entries.
ALTER TABLE "WebhookEvent"
ADD COLUMN "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "leaseToken" TEXT,
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "appliedAt" TIMESTAMP(3),
ADD COLUMN "outcome" JSONB;

CREATE INDEX "WebhookEvent_projectId_status_nextAttemptAt_createdAt_idx"
ON "WebhookEvent"("projectId", "status", "nextAttemptAt", "createdAt");
