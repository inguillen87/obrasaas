-- Persist one immutable, expiring security context for every outbound
-- WhatsApp Flow. Only the SHA-256 evidence of the signed token is stored.
CREATE TABLE "WhatsAppFlowSession" (
    "id" UUID NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "phoneNumberId" VARCHAR(40) NOT NULL,
    "recipientPhone" VARCHAR(20) NOT NULL,
    "blueprintKey" VARCHAR(100) NOT NULL,
    "flowId" VARCHAR(40) NOT NULL,
    "screenId" VARCHAR(30) NOT NULL,
    "flowType" VARCHAR(64) NOT NULL,
    "sourceExternalId" VARCHAR(512) NOT NULL,
    "tokenSha256" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveryAttemptedAt" TIMESTAMP(3),
    "deliveryRejectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" VARCHAR(500),
    "consumedAt" TIMESTAMP(3),
    "consumedExternalId" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlowSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WhatsAppFlowSession_tokenSha256_format_check"
      CHECK ("tokenSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "WhatsAppFlowSession_phoneNumberId_format_check"
      CHECK ("phoneNumberId" ~ '^[0-9]{5,40}$'),
    CONSTRAINT "WhatsAppFlowSession_recipientPhone_format_check"
      CHECK ("recipientPhone" ~ '^[0-9]{8,20}$'),
    CONSTRAINT "WhatsAppFlowSession_blueprintKey_format_check"
      CHECK ("blueprintKey" ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
    CONSTRAINT "WhatsAppFlowSession_flowId_format_check"
      CHECK ("flowId" ~ '^[0-9]{5,40}$'),
    CONSTRAINT "WhatsAppFlowSession_screenId_format_check"
      CHECK ("screenId" ~ '^[A-Z][A-Z0-9_]{0,29}$'),
    CONSTRAINT "WhatsAppFlowSession_flowType_format_check"
      CHECK ("flowType" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
    CONSTRAINT "WhatsAppFlowSession_expiry_check"
      CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "WhatsAppFlowSession_consumption_shape_check"
      CHECK (
        ("consumedAt" IS NULL AND "consumedExternalId" IS NULL)
        OR
        ("consumedAt" IS NOT NULL AND "consumedExternalId" IS NOT NULL)
      ),
    CONSTRAINT "WhatsAppFlowSession_delivery_rejection_shape_check"
      CHECK (
        "deliveryRejectedAt" IS NULL
        OR
        (
          "deliveryAttemptedAt" IS NOT NULL
          AND "sentAt" IS NULL
          AND "consumedAt" IS NULL
        )
      ),
    CONSTRAINT "WhatsAppFlowSession_sent_attempt_shape_check"
      CHECK ("sentAt" IS NULL OR "deliveryAttemptedAt" IS NOT NULL),
    CONSTRAINT "WhatsAppFlowSession_consumed_attempt_shape_check"
      CHECK ("consumedAt" IS NULL OR "deliveryAttemptedAt" IS NOT NULL),
    CONSTRAINT "WhatsAppFlowSession_provider_fence_check"
      CHECK ("providerMessageId" IS NULL OR "sentAt" IS NOT NULL)
);

CREATE UNIQUE INDEX "WhatsAppFlowSession_tokenSha256_key"
ON "WhatsAppFlowSession"("tokenSha256");

CREATE UNIQUE INDEX "WhatsAppFlowSession_providerMessageId_key"
ON "WhatsAppFlowSession"("providerMessageId");

CREATE UNIQUE INDEX "WhatsAppFlowSession_projectId_sourceExternalId_blueprintKey_key"
ON "WhatsAppFlowSession"("projectId", "sourceExternalId", "blueprintKey");

CREATE UNIQUE INDEX "WhatsAppFlowSession_projectId_consumedExternalId_key"
ON "WhatsAppFlowSession"("projectId", "consumedExternalId");

CREATE INDEX "WhatsAppFlowSession_organizationId_expiresAt_idx"
ON "WhatsAppFlowSession"("organizationId", "expiresAt");

CREATE INDEX "WhatsAppFlowSession_projectId_workerId_expiresAt_idx"
ON "WhatsAppFlowSession"("projectId", "workerId", "expiresAt");

CREATE INDEX "WhatsAppFlowSession_expiresAt_consumedAt_idx"
ON "WhatsAppFlowSession"("expiresAt", "consumedAt");

CREATE INDEX "WhatsAppFlowSession_phoneNumberId_recipientPhone_idx"
ON "WhatsAppFlowSession"("phoneNumberId", "recipientPhone");

ALTER TABLE "WhatsAppFlowSession"
ADD CONSTRAINT "WhatsAppFlowSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppFlowSession"
ADD CONSTRAINT "WhatsAppFlowSession_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppFlowSession"
ADD CONSTRAINT "WhatsAppFlowSession_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "Worker"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
