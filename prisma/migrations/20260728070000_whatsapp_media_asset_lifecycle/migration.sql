CREATE TYPE "WhatsAppMediaAssetStatus" AS ENUM (
  'UPLOADING',
  'AVAILABLE',
  'CLAIMED',
  'DELETE_PENDING',
  'DELETED',
  'FAILED'
);

-- A webhook is the durable provenance root for every provider media object.
-- The nullable project scope remains valid for non-project events, while media
-- assets can reference only webhook events that belong to their exact project.
CREATE UNIQUE INDEX "WebhookEvent_projectId_id_key"
  ON "WebhookEvent"("projectId", "id");

CREATE TABLE "WhatsAppMediaAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "webhookEventId" TEXT NOT NULL,
  "providerMediaIdHash" CHAR(64) NOT NULL,
  "providerMessageIdHash" CHAR(64) NOT NULL,
  "mediaKind" "MessageKind" NOT NULL,
  "declaredMimeType" VARCHAR(120) NOT NULL,
  "status" "WhatsAppMediaAssetStatus" NOT NULL DEFAULT 'UPLOADING',
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "storageProvider" VARCHAR(32),
  "storage" JSONB,
  "fileName" VARCHAR(255),
  "mimeType" VARCHAR(120),
  "contentSha256" CHAR(64),
  "sizeBytes" INTEGER,
  "storageLocatorHash" CHAR(64),
  "uploadAttemptCount" INTEGER NOT NULL DEFAULT 1,
  "uploadLeaseToken" UUID,
  "uploadLeaseExpiresAt" TIMESTAMP(3),
  "nextUploadAttemptAt" TIMESTAMP(3),
  "purgeEligibleAt" TIMESTAMP(3),
  "messageConversationId" TEXT,
  "messageId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "claimFingerprint" CHAR(64),
  "deleteOperationKeyHash" CHAR(64),
  "deleteRequestFingerprint" CHAR(64),
  "deleteRequestedAt" TIMESTAMP(3),
  "deleteAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "deleteLeaseToken" UUID,
  "deleteLeaseExpiresAt" TIMESTAMP(3),
  "nextDeleteAttemptAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "tombstoneSha256" CHAR(64),
  "lastErrorCode" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsAppMediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppMediaAsset_hashes_check" CHECK (
    "providerMediaIdHash" ~ '^[0-9a-f]{64}$'
    AND "providerMessageIdHash" ~ '^[0-9a-f]{64}$'
    AND "operationKeyHash" ~ '^[0-9a-f]{64}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND ("contentSha256" IS NULL OR "contentSha256" ~ '^[0-9a-f]{64}$')
    AND ("storageLocatorHash" IS NULL OR "storageLocatorHash" ~ '^[0-9a-f]{64}$')
    AND ("claimFingerprint" IS NULL OR "claimFingerprint" ~ '^[0-9a-f]{64}$')
    AND ("deleteOperationKeyHash" IS NULL OR "deleteOperationKeyHash" ~ '^[0-9a-f]{64}$')
    AND ("deleteRequestFingerprint" IS NULL OR "deleteRequestFingerprint" ~ '^[0-9a-f]{64}$')
    AND ("tombstoneSha256" IS NULL OR "tombstoneSha256" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "WhatsAppMediaAsset_metadata_check" CHECK (
    "mediaKind" IN ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT')
    AND char_length(btrim("declaredMimeType")) BETWEEN 3 AND 120
    AND position('/' IN "declaredMimeType") > 1
    AND "uploadAttemptCount" >= 1
    AND "deleteAttemptCount" >= 0
    AND ("sizeBytes" IS NULL OR "sizeBytes" BETWEEN 1 AND 104857600)
    AND ("fileName" IS NULL OR char_length(btrim("fileName")) BETWEEN 1 AND 255)
    AND (
      "mimeType" IS NULL
      OR (char_length(btrim("mimeType")) BETWEEN 3 AND 120 AND position('/' IN "mimeType") > 1)
    )
    AND ("lastErrorCode" IS NULL OR "lastErrorCode" ~ '^[A-Z0-9_]{3,64}$')
    AND (
      "storage" IS NULL
      OR (
        "storageProvider" IS NOT NULL
        AND jsonb_typeof("storage") = 'object'
        AND jsonb_typeof("storage"->'provider') = 'string'
        AND "storage"->>'provider' = "storageProvider"
        AND char_length(btrim("storageProvider")) BETWEEN 2 AND 32
      )
    )
    AND (("contentSha256" IS NULL) = ("sizeBytes" IS NULL))
    AND (("fileName" IS NULL) = ("mimeType" IS NULL))
    AND (("messageConversationId" IS NULL) = ("messageId" IS NULL))
    AND (("uploadLeaseToken" IS NULL) = ("uploadLeaseExpiresAt" IS NULL))
    AND (("deleteLeaseToken" IS NULL) = ("deleteLeaseExpiresAt" IS NULL))
  ),
  CONSTRAINT "WhatsAppMediaAsset_state_check" CHECK (
    (
      "status" = 'UPLOADING'
      AND "storageProvider" IS NOT NULL
      AND "storage" IS NOT NULL
      AND "storageLocatorHash" IS NOT NULL
      AND "contentSha256" IS NOT NULL
      AND "sizeBytes" IS NOT NULL
      AND "fileName" IS NULL
      AND "mimeType" IS NULL
      AND "purgeEligibleAt" IS NOT NULL
      AND "messageConversationId" IS NULL
      AND "messageId" IS NULL
      AND "claimedAt" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseToken" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
      AND "tombstoneSha256" IS NULL
      AND (
        (
          "uploadLeaseToken" IS NOT NULL
          AND "uploadLeaseExpiresAt" IS NOT NULL
          AND "nextUploadAttemptAt" IS NULL
        )
        OR (
          "uploadLeaseToken" IS NULL
          AND "uploadLeaseExpiresAt" IS NULL
          AND "nextUploadAttemptAt" IS NOT NULL
        )
      )
    )
    OR (
      "status" = 'AVAILABLE'
      AND "storageProvider" IS NOT NULL
      AND "storage" IS NOT NULL
      AND "storageLocatorHash" IS NOT NULL
      AND "contentSha256" IS NOT NULL
      AND "sizeBytes" IS NOT NULL
      AND "fileName" IS NOT NULL
      AND "mimeType" IS NOT NULL
      AND "uploadLeaseToken" IS NULL
      AND "uploadLeaseExpiresAt" IS NULL
      AND "nextUploadAttemptAt" IS NULL
      AND "purgeEligibleAt" IS NOT NULL
      AND "messageConversationId" IS NULL
      AND "messageId" IS NULL
      AND "claimedAt" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseToken" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
      AND "tombstoneSha256" IS NULL
    )
    OR (
      "status" = 'CLAIMED'
      AND "storageProvider" IS NOT NULL
      AND "storage" IS NOT NULL
      AND "storageLocatorHash" IS NOT NULL
      AND "contentSha256" IS NOT NULL
      AND "sizeBytes" IS NOT NULL
      AND "fileName" IS NOT NULL
      AND "mimeType" IS NOT NULL
      AND "uploadLeaseToken" IS NULL
      AND "uploadLeaseExpiresAt" IS NULL
      AND "nextUploadAttemptAt" IS NULL
      AND "purgeEligibleAt" IS NULL
      AND "messageConversationId" IS NOT NULL
      AND "messageId" IS NOT NULL
      AND "claimedAt" IS NOT NULL
      AND "claimFingerprint" IS NOT NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseToken" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
      AND "tombstoneSha256" IS NULL
    )
    OR (
      "status" = 'DELETE_PENDING'
      AND "storageProvider" IS NOT NULL
      AND "storage" IS NOT NULL
      AND "storageLocatorHash" IS NOT NULL
      AND "uploadLeaseToken" IS NULL
      AND "uploadLeaseExpiresAt" IS NULL
      AND "nextUploadAttemptAt" IS NULL
      AND "messageConversationId" IS NULL
      AND "messageId" IS NULL
      AND "claimedAt" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NOT NULL
      AND "deleteRequestFingerprint" IS NOT NULL
      AND "deleteRequestedAt" IS NOT NULL
      AND "nextDeleteAttemptAt" IS NOT NULL
      AND "deletedAt" IS NULL
      AND "tombstoneSha256" IS NULL
    )
    OR (
      "status" = 'DELETED'
      AND "storageProvider" IS NOT NULL
      AND "storage" IS NULL
      AND "storageLocatorHash" IS NOT NULL
      AND "fileName" IS NULL
      AND "mimeType" IS NULL
      AND "uploadLeaseToken" IS NULL
      AND "uploadLeaseExpiresAt" IS NULL
      AND "nextUploadAttemptAt" IS NULL
      AND "messageConversationId" IS NULL
      AND "messageId" IS NULL
      AND "claimedAt" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NOT NULL
      AND "deleteRequestFingerprint" IS NOT NULL
      AND "deleteRequestedAt" IS NOT NULL
      AND "deleteLeaseToken" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NOT NULL
      AND "tombstoneSha256" IS NOT NULL
    )
    OR (
      "status" = 'FAILED'
      AND "storageProvider" IS NULL
      AND "storage" IS NULL
      AND "storageLocatorHash" IS NULL
      AND "contentSha256" IS NULL
      AND "sizeBytes" IS NULL
      AND "fileName" IS NULL
      AND "mimeType" IS NULL
      AND "uploadLeaseToken" IS NULL
      AND "uploadLeaseExpiresAt" IS NULL
      AND "nextUploadAttemptAt" IS NULL
      AND "purgeEligibleAt" IS NULL
      AND "messageConversationId" IS NULL
      AND "messageId" IS NULL
      AND "claimedAt" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseToken" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
      AND "tombstoneSha256" IS NULL
      AND "lastErrorCode" IS NOT NULL
    )
  ),
  CONSTRAINT "WhatsAppMediaAsset_timestamps_check" CHECK (
    ("uploadLeaseExpiresAt" IS NULL OR "uploadLeaseExpiresAt" >= "createdAt")
    AND ("nextUploadAttemptAt" IS NULL OR "nextUploadAttemptAt" >= "createdAt")
    AND ("purgeEligibleAt" IS NULL OR "purgeEligibleAt" >= "createdAt")
    AND ("claimedAt" IS NULL OR "claimedAt" >= "createdAt")
    AND ("deleteRequestedAt" IS NULL OR "deleteRequestedAt" >= "createdAt")
    AND ("deleteLeaseExpiresAt" IS NULL OR "deleteLeaseExpiresAt" >= "deleteRequestedAt")
    AND ("nextDeleteAttemptAt" IS NULL OR "nextDeleteAttemptAt" >= "deleteRequestedAt")
    AND ("deletedAt" IS NULL OR "deletedAt" >= "deleteRequestedAt")
  )
);

CREATE UNIQUE INDEX "WhatsAppMediaAsset_projectId_id_key"
  ON "WhatsAppMediaAsset"("projectId", "id");

CREATE UNIQUE INDEX "WhatsAppMediaAsset_project_operation_key"
  ON "WhatsAppMediaAsset"("projectId", "operationKeyHash");

CREATE UNIQUE INDEX "WhatsAppMediaAsset_project_provider_identity_key"
  ON "WhatsAppMediaAsset"("projectId", "providerMessageIdHash", "providerMediaIdHash");

CREATE UNIQUE INDEX "WhatsAppMediaAsset_project_message_key"
  ON "WhatsAppMediaAsset"("projectId", "messageConversationId", "messageId");

CREATE UNIQUE INDEX "WhatsAppMediaAsset_conversation_message_key"
  ON "WhatsAppMediaAsset"("messageConversationId", "messageId");

CREATE INDEX "WhatsAppMediaAsset_upload_queue_idx"
  ON "WhatsAppMediaAsset"("projectId", "status", "nextUploadAttemptAt", "id");

CREATE INDEX "WhatsAppMediaAsset_upload_lease_idx"
  ON "WhatsAppMediaAsset"("status", "uploadLeaseExpiresAt", "id");

CREATE INDEX "WhatsAppMediaAsset_delete_queue_idx"
  ON "WhatsAppMediaAsset"("status", "nextDeleteAttemptAt", "id");

CREATE INDEX "WhatsAppMediaAsset_org_created_idx"
  ON "WhatsAppMediaAsset"("organizationId", "createdAt", "id");

CREATE INDEX "WhatsAppMediaAsset_webhook_created_idx"
  ON "WhatsAppMediaAsset"("webhookEventId", "createdAt");

-- P0 purge candidates are only unclaimed AVAILABLE objects. CLAIMED cannot
-- enter this access path, even if application code accidentally omits status.
CREATE INDEX "WhatsAppMediaAsset_purge_available_idx"
  ON "WhatsAppMediaAsset"("purgeEligibleAt", "projectId", "id")
  WHERE "status" = 'AVAILABLE' AND "purgeEligibleAt" IS NOT NULL;

-- CHECK constraints govern each row shape, while this transition trigger makes
-- CLAIMED and DELETED terminal. Clearing claim columns can therefore never turn
-- accepted evidence back into a garbage-collection candidate.
CREATE FUNCTION "enforce_whatsapp_media_asset_transition"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WhatsApp media asset ledger rows cannot be deleted'
      USING ERRCODE = '23514', CONSTRAINT = 'WhatsAppMediaAsset_row_retention_guard';
  END IF;

  IF OLD."status" IN ('CLAIMED', 'DELETED') THEN
    RAISE EXCEPTION 'terminal WhatsApp media assets are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'WhatsAppMediaAsset_terminal_immutability_guard';
  END IF;

  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;

  IF (
    (OLD."status" = 'UPLOADING' AND NEW."status" IN ('AVAILABLE', 'DELETE_PENDING', 'FAILED'))
    OR (OLD."status" = 'AVAILABLE' AND NEW."status" IN ('CLAIMED', 'DELETE_PENDING'))
    OR (OLD."status" = 'DELETE_PENDING' AND NEW."status" = 'DELETED')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid WhatsApp media asset lifecycle transition'
    USING ERRCODE = '23514', CONSTRAINT = 'WhatsAppMediaAsset_transition_guard';
END;
$$;

CREATE TRIGGER "WhatsAppMediaAsset_transition_guard"
BEFORE UPDATE OR DELETE ON "WhatsAppMediaAsset"
FOR EACH ROW
EXECUTE FUNCTION "enforce_whatsapp_media_asset_transition"();

ALTER TABLE "WhatsAppMediaAsset"
  ADD CONSTRAINT "WhatsAppMediaAsset_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WhatsAppMediaAsset"
  ADD CONSTRAINT "WhatsAppMediaAsset_webhook_event_scope_fkey"
  FOREIGN KEY ("projectId", "webhookEventId")
  REFERENCES "WebhookEvent"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WhatsAppMediaAsset"
  ADD CONSTRAINT "WhatsAppMediaAsset_conversation_scope_fkey"
  FOREIGN KEY ("projectId", "messageConversationId")
  REFERENCES "Conversation"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WhatsAppMediaAsset"
  ADD CONSTRAINT "WhatsAppMediaAsset_message_scope_fkey"
  FOREIGN KEY ("messageConversationId", "messageId")
  REFERENCES "Message"("conversationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
