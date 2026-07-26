-- Phase 1 (short expand): bridge an already durable WhatsApp Message to a
-- canonical ProgressEvidence. Existing evidence remains valid because every
-- new column is nullable and no row is rewritten. Candidate keys, foreign keys
-- and validation are deliberately split into later online migrations.
ALTER TABLE "ProgressEvidence"
  ADD COLUMN "sourceConversationId" TEXT,
  ADD COLUMN "sourceMessageId" TEXT,
  ADD COLUMN "sourceOperationKeyHash" CHAR(64),
  ADD COLUMN "sourceRequestFingerprint" CHAR(64);

ALTER TABLE "ProgressEvidence"
  ADD CONSTRAINT "ProgressEvidence_source_bundle_check" CHECK (
    (
      "sourceConversationId" IS NULL
      AND "sourceMessageId" IS NULL
      AND "sourceOperationKeyHash" IS NULL
      AND "sourceRequestFingerprint" IS NULL
    )
    OR
    (
      "sourceConversationId" IS NOT NULL
      AND "sourceMessageId" IS NOT NULL
      AND "sourceOperationKeyHash" IS NOT NULL
      AND "sourceRequestFingerprint" IS NOT NULL
    )
  ) NOT VALID,
  ADD CONSTRAINT "ProgressEvidence_source_operation_hash_check" CHECK (
    "sourceOperationKeyHash" IS NULL
    OR "sourceOperationKeyHash" ~ '^[0-9a-f]{64}$'
  ) NOT VALID,
  ADD CONSTRAINT "ProgressEvidence_source_fingerprint_check" CHECK (
    "sourceRequestFingerprint" IS NULL
    OR "sourceRequestFingerprint" ~ '^[0-9a-f]{64}$'
  ) NOT VALID;
