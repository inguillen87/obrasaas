-- Reading is an inbox concern. Preserve the delivery outcome and normalize
-- legacy rows that used READ as a delivery status.
UPDATE "NotificationDelivery"
SET
  "readAt" = COALESCE("readAt", "updatedAt", "createdAt"),
  "sentAt" = COALESCE("sentAt", "createdAt"),
  "status" = 'SENT'
WHERE "status" = 'READ';

-- A committed IN_APP row is already available in the durable inbox. Legacy
-- pending, failed or abandoned leases therefore reconcile safely to SENT.
UPDATE "NotificationDelivery"
SET
  "status" = 'SENT',
  "sentAt" = COALESCE("sentAt", "createdAt"),
  "leasedAt" = NULL,
  "lastError" = NULL
WHERE "channel" = 'IN_APP';

ALTER TABLE "NotificationDelivery"
DROP CONSTRAINT "NotificationDelivery_projectId_fkey";

DROP INDEX "NotificationDelivery_recipientId_channel_eventKey_key";

CREATE UNIQUE INDEX "NotificationDelivery_organizationId_recipientId_channel_eventKey_key"
ON "NotificationDelivery"("organizationId", "recipientId", "channel", "eventKey");

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_organizationId_projectId_fkey"
FOREIGN KEY ("organizationId", "projectId")
REFERENCES "Project"("organizationId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_read_outcome_check"
CHECK (
  "status" <> 'READ'
  AND ("readAt" IS NULL OR "status" = 'SENT')
);

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_in_app_delivery_check"
CHECK (
  "channel" <> 'IN_APP'
  OR (
    "status" = 'SENT'
    AND "sentAt" IS NOT NULL
    AND "leasedAt" IS NULL
  )
);
