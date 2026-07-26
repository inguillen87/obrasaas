CREATE TYPE "ProtectedUploadPurpose" AS ENUM (
  'CASH_RECEIPT',
  'GOODS_RECEIPT',
  'SUPPLIER_INVOICE',
  'PROGRESS_EVIDENCE'
);

CREATE TYPE "ProtectedUploadStatus" AS ENUM (
  'UPLOADING',
  'AVAILABLE',
  'CLAIMED',
  'DELETE_PENDING',
  'DELETED'
);

CREATE TABLE "ProtectedUpload" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "purpose" "ProtectedUploadPurpose" NOT NULL,
  "status" "ProtectedUploadStatus" NOT NULL DEFAULT 'UPLOADING',
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "storageProvider" VARCHAR(32) NOT NULL,
  "storage" JSONB NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "uploadAttemptCount" INTEGER NOT NULL DEFAULT 1,
  "uploadLeaseExpiresAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "claimedEntityType" VARCHAR(64),
  "claimedEntityId" VARCHAR(190),
  "claimFingerprint" CHAR(64),
  "deleteOperationKeyHash" CHAR(64),
  "deleteRequestFingerprint" CHAR(64),
  "deleteRequestedAt" TIMESTAMP(3),
  "deleteAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "deleteLeaseExpiresAt" TIMESTAMP(3),
  "nextDeleteAttemptAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProtectedUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProtectedUpload_hashes_check" CHECK (
    "operationKeyHash" ~ '^[0-9a-f]{64}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND "sha256" ~ '^[0-9a-f]{64}$'
    AND ("deleteOperationKeyHash" IS NULL OR "deleteOperationKeyHash" ~ '^[0-9a-f]{64}$')
    AND ("deleteRequestFingerprint" IS NULL OR "deleteRequestFingerprint" ~ '^[0-9a-f]{64}$')
    AND ("claimFingerprint" IS NULL OR "claimFingerprint" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "ProtectedUpload_metadata_check" CHECK (
    jsonb_typeof("storage") = 'object'
    AND "storageProvider" IN ('vercel-blob', 'cloudinary')
    AND "storage"->>'provider' = "storageProvider"
    AND (
      ("storageProvider" = 'vercel-blob' AND jsonb_typeof("storage"->'pathname') = 'string')
      OR ("storageProvider" = 'cloudinary' AND jsonb_typeof("storage"->'publicId') = 'string')
    )
    AND char_length(btrim("filename")) BETWEEN 1 AND 255
    AND char_length(btrim("mimeType")) BETWEEN 3 AND 120
    AND "size" BETWEEN 1 AND 4194304
    AND "uploadAttemptCount" >= 1
    AND "deleteAttemptCount" >= 0
    AND ("lastErrorCode" IS NULL OR "lastErrorCode" ~ '^[A-Z0-9_]{3,64}$')
    AND "expiresAt" > "createdAt"
  ),
  CONSTRAINT "ProtectedUpload_purpose_media_check" CHECK (
    (
      "purpose" IN ('CASH_RECEIPT', 'GOODS_RECEIPT', 'SUPPLIER_INVOICE')
      AND "size" <= 4194304
      AND "mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    )
    OR (
      "purpose" = 'PROGRESS_EVIDENCE'
      AND "mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf')
    )
  ),
  CONSTRAINT "ProtectedUpload_claim_type_check" CHECK (
    "claimedEntityType" IS NULL
    OR ("purpose" = 'CASH_RECEIPT' AND "claimedEntityType" = 'CashMovement')
    OR ("purpose" = 'GOODS_RECEIPT' AND "claimedEntityType" = 'GoodsReceipt')
    OR ("purpose" = 'SUPPLIER_INVOICE' AND "claimedEntityType" = 'SupplierInvoice')
    OR ("purpose" = 'PROGRESS_EVIDENCE' AND "claimedEntityType" = 'ProgressEvidence')
  ),
  CONSTRAINT "ProtectedUpload_state_check" CHECK (
    (
      "status" = 'UPLOADING'
      AND "uploadLeaseExpiresAt" IS NOT NULL
      AND "claimedAt" IS NULL
      AND "claimedEntityType" IS NULL
      AND "claimedEntityId" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
    )
    OR (
      "status" = 'AVAILABLE'
      AND "uploadLeaseExpiresAt" IS NULL
      AND "claimedAt" IS NULL
      AND "claimedEntityType" IS NULL
      AND "claimedEntityId" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
    )
    OR (
      "status" = 'CLAIMED'
      AND "uploadLeaseExpiresAt" IS NULL
      AND "claimedAt" IS NOT NULL
      AND "claimedEntityType" IS NOT NULL
      AND "claimedEntityId" IS NOT NULL
      AND "claimFingerprint" IS NOT NULL
      AND "deleteOperationKeyHash" IS NULL
      AND "deleteRequestFingerprint" IS NULL
      AND "deleteRequestedAt" IS NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NULL
    )
    OR (
      "status" = 'DELETE_PENDING'
      AND "uploadLeaseExpiresAt" IS NULL
      AND "claimedAt" IS NULL
      AND "claimedEntityType" IS NULL
      AND "claimedEntityId" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NOT NULL
      AND "deleteRequestFingerprint" IS NOT NULL
      AND "deleteRequestedAt" IS NOT NULL
      AND "nextDeleteAttemptAt" IS NOT NULL
      AND "deletedAt" IS NULL
    )
    OR (
      "status" = 'DELETED'
      AND "uploadLeaseExpiresAt" IS NULL
      AND "claimedAt" IS NULL
      AND "claimedEntityType" IS NULL
      AND "claimedEntityId" IS NULL
      AND "claimFingerprint" IS NULL
      AND "deleteOperationKeyHash" IS NOT NULL
      AND "deleteRequestFingerprint" IS NOT NULL
      AND "deleteRequestedAt" IS NOT NULL
      AND "deleteLeaseExpiresAt" IS NULL
      AND "nextDeleteAttemptAt" IS NULL
      AND "deletedAt" IS NOT NULL
    )
  ),
  CONSTRAINT "ProtectedUpload_state_timestamps_check" CHECK (
    ("uploadLeaseExpiresAt" IS NULL OR "uploadLeaseExpiresAt" >= "createdAt")
    AND ("claimedAt" IS NULL OR "claimedAt" >= "createdAt")
    AND ("deleteRequestedAt" IS NULL OR "deleteRequestedAt" >= "createdAt")
    AND ("deleteLeaseExpiresAt" IS NULL OR "deleteLeaseExpiresAt" >= "deleteRequestedAt")
    AND ("nextDeleteAttemptAt" IS NULL OR "nextDeleteAttemptAt" >= "deleteRequestedAt")
    AND ("deletedAt" IS NULL OR ("deleteRequestedAt" IS NOT NULL AND "deletedAt" >= "deleteRequestedAt"))
  )
);

CREATE UNIQUE INDEX "ProtectedUpload_projectId_id_key"
  ON "ProtectedUpload"("projectId", "id");

CREATE UNIQUE INDEX "ProtectedUpload_project_purpose_operation_key"
  ON "ProtectedUpload"("projectId", "actorId", "purpose", "operationKeyHash");

CREATE UNIQUE INDEX "ProtectedUpload_project_purpose_delete_key"
  ON "ProtectedUpload"("projectId", "actorId", "purpose", "deleteOperationKeyHash");

CREATE INDEX "ProtectedUpload_actor_project_active_idx"
  ON "ProtectedUpload"("projectId", "actorId", "status", "expiresAt");

CREATE INDEX "ProtectedUpload_project_active_idx"
  ON "ProtectedUpload"("projectId", "status", "expiresAt");

CREATE INDEX "ProtectedUpload_org_created_idx"
  ON "ProtectedUpload"("organizationId", "createdAt");

CREATE INDEX "ProtectedUpload_expiry_cleanup_idx"
  ON "ProtectedUpload"("status", "expiresAt", "id");

CREATE INDEX "ProtectedUpload_delete_cleanup_idx"
  ON "ProtectedUpload"("status", "nextDeleteAttemptAt", "id");

ALTER TABLE "ProtectedUpload"
  ADD CONSTRAINT "ProtectedUpload_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProtectedUpload"
  ADD CONSTRAINT "ProtectedUpload_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashMovement"
  ADD COLUMN "protectedUploadId" TEXT,
  ADD COLUMN "requestFingerprint" CHAR(64);

ALTER TABLE "GoodsReceipt"
  ADD COLUMN "protectedUploadId" TEXT,
  ADD COLUMN "requestFingerprint" CHAR(64);

ALTER TABLE "SupplierInvoice"
  ADD COLUMN "protectedUploadId" TEXT,
  ADD COLUMN "requestFingerprint" CHAR(64);

ALTER TABLE "ProgressEvidence"
  ADD COLUMN "protectedUploadId" TEXT;

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_request_fingerprint_check"
  CHECK ("requestFingerprint" IS NULL OR "requestFingerprint" ~ '^[0-9a-f]{64}$');

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_request_fingerprint_check"
  CHECK ("requestFingerprint" IS NULL OR "requestFingerprint" ~ '^[0-9a-f]{64}$');

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_request_fingerprint_check"
  CHECK ("requestFingerprint" IS NULL OR "requestFingerprint" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "CashMovement_project_protected_upload_key"
  ON "CashMovement"("projectId", "protectedUploadId");

CREATE UNIQUE INDEX "GoodsReceipt_project_protected_upload_key"
  ON "GoodsReceipt"("projectId", "protectedUploadId");

CREATE UNIQUE INDEX "SupplierInvoice_project_protected_upload_key"
  ON "SupplierInvoice"("projectId", "protectedUploadId");

CREATE UNIQUE INDEX "ProgressEvidence_project_protected_upload_key"
  ON "ProgressEvidence"("projectId", "protectedUploadId");

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_protected_upload_fkey"
  FOREIGN KEY ("projectId", "protectedUploadId") REFERENCES "ProtectedUpload"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_protected_upload_fkey"
  FOREIGN KEY ("projectId", "protectedUploadId") REFERENCES "ProtectedUpload"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_protected_upload_fkey"
  FOREIGN KEY ("projectId", "protectedUploadId") REFERENCES "ProtectedUpload"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgressEvidence"
  ADD CONSTRAINT "ProgressEvidence_protected_upload_fkey"
  FOREIGN KEY ("projectId", "protectedUploadId") REFERENCES "ProtectedUpload"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
