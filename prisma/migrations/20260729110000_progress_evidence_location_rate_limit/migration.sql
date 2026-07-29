CREATE TYPE "ProgressEvidenceLocationRateScope" AS ENUM (
  'ACTIVE_SESSION',
  'ACTIVE_ORGANIZATION',
  'INACTIVE_SESSION',
  'INACTIVE_ORGANIZATION'
);

CREATE TABLE "ProgressEvidenceLocationRateBucket" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" "ProgressEvidenceLocationRateScope" NOT NULL,
  "scopeKeyHash" CHAR(64) NOT NULL,
  "windowBuckets" JSONB NOT NULL,
  "blockedCount" BIGINT NOT NULL DEFAULT 0,
  "lastBlockedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProgressEvidenceLocationRateBucket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PELRateBucket_hash_check" CHECK (
    "scopeKeyHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "PELRateBucket_state_check" CHECK (
    jsonb_typeof("windowBuckets") = 'array'
    AND jsonb_array_length("windowBuckets") <= 60
    AND "blockedCount" >= 0
    AND "expiresAt" >= "updatedAt"
    AND ("lastBlockedAt" IS NULL OR "lastBlockedAt" <= "updatedAt")
  )
);

CREATE UNIQUE INDEX "PELRateBucket_scope_key"
  ON "ProgressEvidenceLocationRateBucket"("organizationId", "scope", "scopeKeyHash");

CREATE INDEX "PELRateBucket_org_expiry_idx"
  ON "ProgressEvidenceLocationRateBucket"("organizationId", "expiresAt", "id");

CREATE INDEX "PELRateBucket_expiry_idx"
  ON "ProgressEvidenceLocationRateBucket"("expiresAt", "id");

ALTER TABLE "ProgressEvidenceLocationRateBucket"
  ADD CONSTRAINT "PELRateBucket_organization_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
