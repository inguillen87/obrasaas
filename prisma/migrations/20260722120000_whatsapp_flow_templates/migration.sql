-- Persist only ObraSaaS-owned WhatsApp templates. The provider identity and
-- immutable content hash keep tenant reconciliation fail-closed.
CREATE TABLE "WhatsAppFlowTemplate" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "whatsappBusinessId" VARCHAR(40) NOT NULL,
    "blueprintKey" VARCHAR(100) NOT NULL,
    "providerTemplateId" VARCHAR(40),
    "name" VARCHAR(512) NOT NULL,
    "language" VARCHAR(35) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "contentSha256" CHAR(64) NOT NULL,
    "flowId" VARCHAR(40) NOT NULL,
    "screenId" VARCHAR(30) NOT NULL,
    "bodyText" VARCHAR(1024) NOT NULL,
    "buttonText" VARCHAR(25) NOT NULL,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "statusChangedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlowTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WhatsAppFlowTemplate_name_check"
      CHECK ("name" ~ '^[a-z0-9_]{1,512}$'),
    CONSTRAINT "WhatsAppFlowTemplate_language_check"
      CHECK ("language" ~ '^[A-Za-z]{2}[-_][A-Za-z]{2}$'),
    CONSTRAINT "WhatsAppFlowTemplate_category_check"
      CHECK ("category" ~ '^[A-Z_]{2,32}$'),
    CONSTRAINT "WhatsAppFlowTemplate_status_check"
      CHECK ("status" ~ '^[A-Z_]{2,40}$'),
    CONSTRAINT "WhatsAppFlowTemplate_content_hash_check"
      CHECK ("contentSha256" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "WhatsAppFlowTemplate_provider_id_check"
      CHECK ("providerTemplateId" IS NULL OR "providerTemplateId" ~ '^[0-9]{5,40}$'),
    CONSTRAINT "WhatsAppFlowTemplate_waba_id_check"
      CHECK ("whatsappBusinessId" ~ '^[0-9]{5,40}$'),
    CONSTRAINT "WhatsAppFlowTemplate_flow_id_check"
      CHECK ("flowId" ~ '^[0-9]{5,40}$'),
    CONSTRAINT "WhatsAppFlowTemplate_screen_id_check"
      CHECK ("screenId" ~ '^[A-Z][A-Z0-9_]{0,29}$')
);

CREATE UNIQUE INDEX "WAFlowTemplate_provider_id_key"
ON "WhatsAppFlowTemplate"("providerTemplateId");

CREATE UNIQUE INDEX "WAFlowTemplate_name_language_key"
ON "WhatsAppFlowTemplate"("connectionId", "name", "language");

CREATE UNIQUE INDEX "WAFlowTemplate_blueprint_hash_key"
ON "WhatsAppFlowTemplate"("connectionId", "blueprintKey", "language", "contentSha256");

CREATE INDEX "WAFlowTemplate_blueprint_status_idx"
ON "WhatsAppFlowTemplate"("connectionId", "blueprintKey", "status");

CREATE INDEX "WAFlowTemplate_waba_provider_idx"
ON "WhatsAppFlowTemplate"("whatsappBusinessId", "providerTemplateId");

ALTER TABLE "WhatsAppFlowTemplate"
ADD CONSTRAINT "WhatsAppFlowTemplate_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "WhatsAppConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
