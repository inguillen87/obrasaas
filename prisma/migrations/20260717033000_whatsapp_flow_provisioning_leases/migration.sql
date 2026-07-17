-- Flow provisioning calls Meta and can outlive a serverless instance. Keep the
-- lease outside shared JSON metadata so unrelated read-modify-write operations
-- cannot erase the concurrency fence.
ALTER TABLE "WhatsAppConnection"
ADD COLUMN "flowProvisioningLeaseId" UUID,
ADD COLUMN "flowProvisioningBlueprintKey" VARCHAR(64),
ADD COLUMN "flowProvisioningLeaseAcquiredAt" TIMESTAMP(3),
ADD COLUMN "flowProvisioningLeaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "WhatsAppConnection"
ADD CONSTRAINT "WhatsAppConnection_flow_provisioning_lease_shape_check"
CHECK (
  (
    "flowProvisioningLeaseId" IS NULL
    AND "flowProvisioningBlueprintKey" IS NULL
    AND "flowProvisioningLeaseAcquiredAt" IS NULL
    AND "flowProvisioningLeaseExpiresAt" IS NULL
  )
  OR
  (
    "flowProvisioningLeaseId" IS NOT NULL
    AND "flowProvisioningBlueprintKey" IS NOT NULL
    AND "flowProvisioningBlueprintKey" ~ '^[a-z][a-z0-9_.-]{0,63}$'
    AND "flowProvisioningLeaseAcquiredAt" IS NOT NULL
    AND "flowProvisioningLeaseExpiresAt" IS NOT NULL
    AND "flowProvisioningLeaseExpiresAt" > "flowProvisioningLeaseAcquiredAt"
    AND "flowProvisioningLeaseExpiresAt"
      <= "flowProvisioningLeaseAcquiredAt" + INTERVAL '10 minutes'
  )
);

CREATE INDEX "WhatsAppConnection_flowProvisioningLeaseExpiresAt_idx"
ON "WhatsAppConnection"("flowProvisioningLeaseExpiresAt")
WHERE "flowProvisioningLeaseId" IS NOT NULL;
