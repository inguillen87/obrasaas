-- Expand-only worker identity, WhatsApp onboarding, and payment destination core.
-- Sensitive identifiers are envelope-encrypted; searchable values are tenant-keyed hashes.
CREATE TYPE "WorkerPersonStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

CREATE TYPE "WorkerIdentityStatus" AS ENUM (
  'UNVERIFIED',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "WorkerChannelProvider" AS ENUM ('WHATSAPP');

CREATE TYPE "WorkerChannelIdentityStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'CONFLICT',
  'REVOKED'
);

CREATE TYPE "WorkerOnboardingClaimStatus" AS ENUM (
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "WorkerPaymentPurpose" AS ENUM (
  'SALARY',
  'REIMBURSEMENT'
);

CREATE TYPE "WorkerPaymentDestinationType" AS ENUM (
  'CBU',
  'CVU',
  'ALIAS'
);

CREATE TYPE "WorkerPaymentRail" AS ENUM (
  'AR_CBU',
  'AR_CVU'
);

CREATE TYPE "WorkerPaymentDestinationStatus" AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED',
  'ACTIVE',
  'SUPERSEDED',
  'REJECTED',
  'REVOKED'
);

-- Nullable bridge columns preserve legacy Worker readers and writers during rollout.
ALTER TABLE "Worker"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "personId" TEXT;

CREATE TABLE "WorkerPerson" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "WorkerPersonStatus" NOT NULL DEFAULT 'ACTIVE',
  "identityStatus" "WorkerIdentityStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "encryptedIdentityPayload" TEXT,
  "cuilFingerprint" CHAR(64),
  "cuilFingerprintKeyId" VARCHAR(100),
  "cuilLastFour" VARCHAR(4),
  "wrappingKeyId" VARCHAR(100),
  "recordVersion" INTEGER NOT NULL DEFAULT 1,
  "privacyNoticeVersion" VARCHAR(64),
  "privacyAcceptedAt" TIMESTAMP(3),
  "identityVerifiedAt" TIMESTAMP(3),
  "identityVerifiedById" TEXT,
  "identityRejectedAt" TIMESTAMP(3),
  "identityRejectedById" TEXT,
  "identityRejectionReason" VARCHAR(500),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerPerson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerPerson_version_revision_check"
    CHECK ("recordVersion" > 0 AND "revision" >= 0),
  CONSTRAINT "WorkerPerson_rejection_reason_check"
    CHECK (
      "identityRejectionReason" IS NULL
      OR char_length(btrim("identityRejectionReason")) BETWEEN 1 AND 500
    ),
  CONSTRAINT "WorkerPerson_identity_bundle_check"
    CHECK (
      (
        "encryptedIdentityPayload" IS NULL
        AND "cuilFingerprint" IS NULL
        AND "cuilFingerprintKeyId" IS NULL
        AND "cuilLastFour" IS NULL
        AND "wrappingKeyId" IS NULL
        AND "privacyNoticeVersion" IS NULL
        AND "privacyAcceptedAt" IS NULL
      )
      OR
      (
        "encryptedIdentityPayload" IS NOT NULL
        AND octet_length("encryptedIdentityPayload") BETWEEN 20 AND 16384
        AND "encryptedIdentityPayload" ~ '^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
        AND "cuilFingerprint" IS NOT NULL
        AND "cuilFingerprint" ~ '^[0-9a-f]{64}$'
        AND "cuilFingerprintKeyId" IS NOT NULL
        AND "cuilFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        AND "cuilLastFour" IS NOT NULL
        AND "cuilLastFour" ~ '^[0-9]{4}$'
        AND "wrappingKeyId" IS NOT NULL
        AND "wrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        AND "privacyNoticeVersion" IS NOT NULL
        AND "privacyNoticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
        AND "privacyAcceptedAt" IS NOT NULL
      )
    ),
  CONSTRAINT "WorkerPerson_identity_state_check"
    CHECK (
      (
        "identityStatus" = 'UNVERIFIED'
        AND "encryptedIdentityPayload" IS NULL
        AND "identityVerifiedAt" IS NULL
        AND "identityVerifiedById" IS NULL
        AND "identityRejectedAt" IS NULL
        AND "identityRejectedById" IS NULL
        AND "identityRejectionReason" IS NULL
      )
      OR
      (
        "identityStatus" = 'PENDING_REVIEW'
        AND "encryptedIdentityPayload" IS NOT NULL
        AND "identityVerifiedAt" IS NULL
        AND "identityVerifiedById" IS NULL
        AND "identityRejectedAt" IS NULL
        AND "identityRejectedById" IS NULL
        AND "identityRejectionReason" IS NULL
      )
      OR
      (
        "identityStatus" = 'VERIFIED'
        AND "encryptedIdentityPayload" IS NOT NULL
        AND "identityVerifiedAt" IS NOT NULL
        AND "identityRejectedAt" IS NULL
        AND "identityRejectedById" IS NULL
        AND "identityRejectionReason" IS NULL
      )
      OR
      (
        "identityStatus" = 'REJECTED'
        AND "encryptedIdentityPayload" IS NOT NULL
        AND "identityVerifiedAt" IS NULL
        AND "identityVerifiedById" IS NULL
        AND "identityRejectedAt" IS NOT NULL
        AND "identityRejectionReason" IS NOT NULL
      )
    )
);

CREATE TABLE "WorkerChannelIdentity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "provider" "WorkerChannelProvider" NOT NULL DEFAULT 'WHATSAPP',
  "status" "WorkerChannelIdentityStatus" NOT NULL DEFAULT 'PENDING',
  "encryptedAddressPayload" TEXT NOT NULL,
  "addressFingerprint" CHAR(64) NOT NULL,
  "addressFingerprintKeyId" VARCHAR(100) NOT NULL,
  "addressLastFour" VARCHAR(4) NOT NULL,
  "wrappingKeyId" VARCHAR(100) NOT NULL,
  "recordVersion" INTEGER NOT NULL DEFAULT 1,
  "encryptedProviderSubjectPayload" TEXT,
  "providerSubjectFingerprint" CHAR(64),
  "providerSubjectFingerprintKeyId" VARCHAR(100),
  "verifiedAt" TIMESTAMP(3),
  "verificationMethod" VARCHAR(64),
  "revokedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerChannelIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerChannelIdentity_version_revision_check"
    CHECK ("recordVersion" > 0 AND "revision" >= 0),
  CONSTRAINT "WorkerChannelIdentity_verification_method_check"
    CHECK (
      "verificationMethod" IS NULL
      OR "verificationMethod" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    ),
  CONSTRAINT "WorkerChannelIdentity_encrypted_address_check"
    CHECK (
      octet_length("encryptedAddressPayload") BETWEEN 20 AND 16384
      AND "encryptedAddressPayload" ~ '^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
      AND "addressFingerprint" ~ '^[0-9a-f]{64}$'
      AND "addressFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "addressLastFour" ~ '^[0-9]{4}$'
      AND "wrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    ),
  CONSTRAINT "WorkerChannelIdentity_provider_subject_check"
    CHECK (
      (
        "encryptedProviderSubjectPayload" IS NULL
        AND "providerSubjectFingerprint" IS NULL
        AND "providerSubjectFingerprintKeyId" IS NULL
      )
      OR
      (
        "encryptedProviderSubjectPayload" IS NOT NULL
        AND octet_length("encryptedProviderSubjectPayload") BETWEEN 20 AND 16384
        AND "encryptedProviderSubjectPayload" ~ '^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
        AND "providerSubjectFingerprint" IS NOT NULL
        AND "providerSubjectFingerprint" ~ '^[0-9a-f]{64}$'
        AND "providerSubjectFingerprintKeyId" IS NOT NULL
        AND "providerSubjectFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      )
    ),
  CONSTRAINT "WorkerChannelIdentity_state_check"
    CHECK (
      (
        "status" = 'PENDING'
        AND "verifiedAt" IS NULL
        AND "revokedAt" IS NULL
      )
      OR
      (
        "status" = 'VERIFIED'
        AND "verifiedAt" IS NOT NULL
        AND "revokedAt" IS NULL
      )
      OR
      (
        "status" = 'CONFLICT'
        AND "verifiedAt" IS NULL
        AND "revokedAt" IS NULL
      )
      OR
      (
        "status" = 'REVOKED'
        AND "revokedAt" IS NOT NULL
      )
    )
);

CREATE TABLE "WorkerOnboardingClaim" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "senderEncryptedPayload" TEXT NOT NULL,
  "senderFingerprint" CHAR(64) NOT NULL,
  "senderFingerprintKeyId" VARCHAR(100) NOT NULL,
  "senderLastFour" VARCHAR(4) NOT NULL,
  "senderWrappingKeyId" VARCHAR(100) NOT NULL,
  "senderRecordVersion" INTEGER NOT NULL DEFAULT 1,
  "claimTokenHash" CHAR(64) NOT NULL,
  "openClaimKey" CHAR(64),
  "claimedIdentityEncryptedPayload" TEXT,
  "claimedCuilFingerprint" CHAR(64),
  "claimedCuilFingerprintKeyId" VARCHAR(100),
  "claimedCuilLastFour" VARCHAR(4),
  "claimedIdentityWrappingKeyId" VARCHAR(100),
  "claimedIdentityRecordVersion" INTEGER,
  "privacyNoticeVersion" VARCHAR(64),
  "privacyAcceptedAt" TIMESTAMP(3),
  "status" "WorkerOnboardingClaimStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" VARCHAR(500),
  "resolvedPersonId" TEXT,
  "resolvedChannelIdentityId" TEXT,
  "resolvedWorkerId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerOnboardingClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerOnboardingClaim_version_revision_check"
    CHECK (
      "senderRecordVersion" > 0
      AND ("claimedIdentityRecordVersion" IS NULL OR "claimedIdentityRecordVersion" > 0)
      AND "revision" >= 0
    ),
  CONSTRAINT "WorkerOnboardingClaim_sender_check"
    CHECK (
      octet_length("senderEncryptedPayload") BETWEEN 20 AND 16384
      AND "senderEncryptedPayload" ~ '^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
      AND "senderFingerprint" ~ '^[0-9a-f]{64}$'
      AND "senderFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "senderLastFour" ~ '^[0-9]{4}$'
      AND "senderWrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    ),
  CONSTRAINT "WorkerOnboardingClaim_hashes_check"
    CHECK (
      "claimTokenHash" ~ '^[0-9a-f]{64}$'
      AND ("openClaimKey" IS NULL OR "openClaimKey" ~ '^[0-9a-f]{64}$')
      AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
      AND "operationKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$'
    ),
  CONSTRAINT "WorkerOnboardingClaim_review_check"
    CHECK (
      ("reviewedById" IS NULL OR "reviewedAt" IS NOT NULL)
      AND (
        "rejectionReason" IS NULL
        OR char_length(btrim("rejectionReason")) BETWEEN 1 AND 500
      )
    ),
  CONSTRAINT "WorkerOnboardingClaim_identity_bundle_check"
    CHECK (
      (
        "claimedIdentityEncryptedPayload" IS NULL
        AND "claimedCuilFingerprint" IS NULL
        AND "claimedCuilFingerprintKeyId" IS NULL
        AND "claimedCuilLastFour" IS NULL
        AND "claimedIdentityWrappingKeyId" IS NULL
        AND "claimedIdentityRecordVersion" IS NULL
        AND "privacyNoticeVersion" IS NULL
        AND "privacyAcceptedAt" IS NULL
      )
      OR
      (
        "claimedIdentityEncryptedPayload" IS NOT NULL
        AND octet_length("claimedIdentityEncryptedPayload") BETWEEN 20 AND 16384
        AND "claimedIdentityEncryptedPayload" ~ '^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
        AND "claimedCuilFingerprint" IS NOT NULL
        AND "claimedCuilFingerprint" ~ '^[0-9a-f]{64}$'
        AND "claimedCuilFingerprintKeyId" IS NOT NULL
        AND "claimedCuilFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        AND "claimedCuilLastFour" IS NOT NULL
        AND "claimedCuilLastFour" ~ '^[0-9]{4}$'
        AND "claimedIdentityWrappingKeyId" IS NOT NULL
        AND "claimedIdentityWrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        AND "claimedIdentityRecordVersion" IS NOT NULL
        AND "claimedIdentityRecordVersion" > 0
        AND "privacyNoticeVersion" IS NOT NULL
        AND "privacyNoticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
        AND "privacyAcceptedAt" IS NOT NULL
      )
    ),
  CONSTRAINT "WorkerOnboardingClaim_expiry_order_check"
    CHECK (
      "expiresAt" > "createdAt"
      AND ("submittedAt" IS NULL OR "submittedAt" >= "createdAt")
      AND ("reviewedAt" IS NULL OR "submittedAt" IS NOT NULL)
      AND ("reviewedAt" IS NULL OR "reviewedAt" >= "submittedAt")
    ),
  CONSTRAINT "WorkerOnboardingClaim_state_check"
    CHECK (
      (
        "status" = 'PENDING'
        AND "openClaimKey" IS NOT NULL
        AND "claimedIdentityEncryptedPayload" IS NULL
        AND "submittedAt" IS NULL
        AND "reviewedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "resolvedPersonId" IS NULL
        AND "resolvedChannelIdentityId" IS NULL
        AND "resolvedWorkerId" IS NULL
      )
      OR
      (
        "status" = 'SUBMITTED'
        AND "openClaimKey" IS NOT NULL
        AND "claimedIdentityEncryptedPayload" IS NOT NULL
        AND "submittedAt" IS NOT NULL
        AND "reviewedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "resolvedPersonId" IS NULL
        AND "resolvedChannelIdentityId" IS NULL
        AND "resolvedWorkerId" IS NULL
      )
      OR
      (
        "status" = 'APPROVED'
        AND "openClaimKey" IS NULL
        AND "claimedIdentityEncryptedPayload" IS NOT NULL
        AND "submittedAt" IS NOT NULL
        AND "reviewedAt" IS NOT NULL
        AND "rejectionReason" IS NULL
        AND "resolvedPersonId" IS NOT NULL
        AND "resolvedChannelIdentityId" IS NOT NULL
        AND "resolvedWorkerId" IS NOT NULL
      )
      OR
      (
        "status" = 'REJECTED'
        AND "openClaimKey" IS NULL
        AND "claimedIdentityEncryptedPayload" IS NOT NULL
        AND "submittedAt" IS NOT NULL
        AND "reviewedAt" IS NOT NULL
        AND "rejectionReason" IS NOT NULL
        AND "resolvedPersonId" IS NULL
        AND "resolvedChannelIdentityId" IS NULL
        AND "resolvedWorkerId" IS NULL
      )
      OR
      (
        "status" IN ('EXPIRED', 'CANCELLED')
        AND "openClaimKey" IS NULL
        AND "reviewedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "resolvedPersonId" IS NULL
        AND "resolvedChannelIdentityId" IS NULL
        AND "resolvedWorkerId" IS NULL
      )
    )
);

CREATE TABLE "WorkerPaymentDestination" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "purpose" "WorkerPaymentPurpose" NOT NULL,
  "type" "WorkerPaymentDestinationType" NOT NULL,
  "rail" "WorkerPaymentRail",
  "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
  "encryptedPayload" TEXT NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "fingerprintKeyId" VARCHAR(100) NOT NULL,
  "lastFour" VARCHAR(4) NOT NULL,
  "wrappingKeyId" VARCHAR(100) NOT NULL,
  "recordVersion" INTEGER NOT NULL DEFAULT 1,
  "holderCuilFingerprint" CHAR(64) NOT NULL,
  "holderCuilFingerprintKeyId" VARCHAR(100) NOT NULL,
  "status" "WorkerPaymentDestinationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "version" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "activeSlot" CHAR(64),
  "previousDestinationId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "verificationProvider" VARCHAR(64),
  "providerReferenceHash" CHAR(64),
  "verificationEvidenceHash" CHAR(64),
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "availableFrom" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" VARCHAR(500),
  "revokedAt" TIMESTAMP(3),
  "revocationReason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerPaymentDestination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerPaymentDestination_version_revision_check"
    CHECK ("recordVersion" > 0 AND "version" > 0 AND "revision" >= 0),
  CONSTRAINT "WorkerPaymentDestination_encrypted_payload_check"
    CHECK (
      octet_length("encryptedPayload") BETWEEN 20 AND 16384
      AND "encryptedPayload" ~ '^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
      AND "fingerprint" ~ '^[0-9a-f]{64}$'
      AND "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND (
        ("type" IN ('CBU', 'CVU') AND "lastFour" ~ '^[0-9]{4}$')
        OR ("type" = 'ALIAS' AND "lastFour" ~ '^[a-z0-9.-]{1,4}$')
      )
      AND "wrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      AND "holderCuilFingerprint" ~ '^[0-9a-f]{64}$'
      AND "holderCuilFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    ),
  CONSTRAINT "WorkerPaymentDestination_request_check"
    CHECK (
      "operationKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$'
      AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
      AND "currency" ~ '^[A-Z]{3}$'
      AND ("activeSlot" IS NULL OR "activeSlot" ~ '^[0-9a-f]{64}$')
    ),
  CONSTRAINT "WorkerPaymentDestination_rail_check"
    CHECK (
      ("type" = 'CBU' AND "rail" IS NOT NULL AND "rail" = 'AR_CBU')
      OR ("type" = 'CVU' AND "rail" IS NOT NULL AND "rail" = 'AR_CVU')
      OR "type" = 'ALIAS'
    ),
  CONSTRAINT "WorkerPaymentDestination_provider_evidence_check"
    CHECK (
      (
        (
          "verificationProvider" IS NULL
          AND "providerReferenceHash" IS NULL
        )
        OR
        (
          "verificationProvider" IS NOT NULL
          AND "verificationProvider" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
          AND "providerReferenceHash" IS NOT NULL
          AND "providerReferenceHash" ~ '^[0-9a-f]{64}$'
        )
      )
      AND (
        "verificationEvidenceHash" IS NULL
        OR "verificationEvidenceHash" ~ '^[0-9a-f]{64}$'
      )
    ),
  CONSTRAINT "WorkerPaymentDestination_previous_check"
    CHECK (
      (
        "version" = 1
        AND "previousDestinationId" IS NULL
      )
      OR
      (
        "version" > 1
        AND "previousDestinationId" IS NOT NULL
        AND "previousDestinationId" <> "id"
      )
    ),
  CONSTRAINT "WorkerPaymentDestination_reason_check"
    CHECK (
      (
        "rejectionReason" IS NULL
        OR char_length(btrim("rejectionReason")) BETWEEN 1 AND 500
      )
      AND (
        "revocationReason" IS NULL
        OR char_length(btrim("revocationReason")) BETWEEN 1 AND 500
      )
    ),
  CONSTRAINT "WorkerPaymentDestination_state_check"
    CHECK (
      (
        "status" = 'PENDING_VERIFICATION'
        AND "verifiedAt" IS NULL
        AND "verifiedById" IS NULL
        AND "verificationEvidenceHash" IS NULL
        AND "availableFrom" IS NULL
        AND "activeSlot" IS NULL
        AND "rejectedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "revokedAt" IS NULL
        AND "revocationReason" IS NULL
      )
      OR
      (
        "status" = 'VERIFIED'
        AND "verifiedAt" IS NOT NULL
        AND "verificationEvidenceHash" IS NOT NULL
        AND "availableFrom" IS NULL
        AND "activeSlot" IS NULL
        AND "rejectedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "revokedAt" IS NULL
        AND "revocationReason" IS NULL
      )
      OR
      (
        "status" = 'ACTIVE'
        AND "verifiedAt" IS NOT NULL
        AND "verificationEvidenceHash" IS NOT NULL
        AND "availableFrom" IS NOT NULL
        AND "activeSlot" IS NOT NULL
        AND "rejectedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "revokedAt" IS NULL
        AND "revocationReason" IS NULL
      )
      OR
      (
        "status" = 'SUPERSEDED'
        AND "verifiedAt" IS NOT NULL
        AND "verificationEvidenceHash" IS NOT NULL
        AND "availableFrom" IS NOT NULL
        AND "activeSlot" IS NULL
        AND "rejectedAt" IS NULL
        AND "rejectionReason" IS NULL
        AND "revokedAt" IS NULL
        AND "revocationReason" IS NULL
      )
      OR
      (
        "status" = 'REJECTED'
        AND "verifiedAt" IS NULL
        AND "verifiedById" IS NULL
        AND "availableFrom" IS NULL
        AND "activeSlot" IS NULL
        AND "rejectedAt" IS NOT NULL
        AND "rejectionReason" IS NOT NULL
        AND "revokedAt" IS NULL
        AND "revocationReason" IS NULL
      )
      OR
      (
        "status" = 'REVOKED'
        AND "activeSlot" IS NULL
        AND "revokedAt" IS NOT NULL
        AND "revocationReason" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "WorkerPerson_organizationId_id_key"
  ON "WorkerPerson"("organizationId", "id");
-- Fingerprint key ids make rotation explicit. Writers must dual-compute and
-- search with every accepted HMAC key before insert; these keys stop same-key races.
-- The operational rewrap/dual-fingerprint rotation job is intentionally outside
-- this initial expand migration and must ship before any key is retired.
CREATE UNIQUE INDEX "WorkerPerson_org_cuil_fp_key"
  ON "WorkerPerson"("organizationId", "cuilFingerprintKeyId", "cuilFingerprint");
CREATE INDEX "WorkerPerson_organizationId_status_identityStatus_idx"
  ON "WorkerPerson"("organizationId", "status", "identityStatus");
CREATE INDEX "WorkerPerson_identityVerifiedById_identityVerifiedAt_idx"
  ON "WorkerPerson"("identityVerifiedById", "identityVerifiedAt");

CREATE UNIQUE INDEX "WorkerChannelIdentity_organizationId_id_key"
  ON "WorkerChannelIdentity"("organizationId", "id");
CREATE UNIQUE INDEX "WCI_org_person_id_key"
  ON "WorkerChannelIdentity"("organizationId", "personId", "id");
CREATE UNIQUE INDEX "WCI_org_provider_address_fp_key"
  ON "WorkerChannelIdentity"("organizationId", "provider", "addressFingerprintKeyId", "addressFingerprint");
CREATE UNIQUE INDEX "WCI_org_provider_subject_fp_key"
  ON "WorkerChannelIdentity"("organizationId", "provider", "providerSubjectFingerprintKeyId", "providerSubjectFingerprint");
CREATE INDEX "WorkerChannelIdentity_organizationId_personId_status_idx"
  ON "WorkerChannelIdentity"("organizationId", "personId", "status");

CREATE UNIQUE INDEX "WorkerOnboardingClaim_claimTokenHash_key"
  ON "WorkerOnboardingClaim"("claimTokenHash");
CREATE UNIQUE INDEX "WorkerOnboardingClaim_openClaimKey_key"
  ON "WorkerOnboardingClaim"("openClaimKey");
CREATE UNIQUE INDEX "WorkerClaim_one_open_per_sender_idx"
  ON "WorkerOnboardingClaim"("projectId", "senderFingerprintKeyId", "senderFingerprint")
  WHERE "status" IN ('PENDING', 'SUBMITTED');
CREATE UNIQUE INDEX "WorkerOnboardingClaim_organizationId_id_key"
  ON "WorkerOnboardingClaim"("organizationId", "id");
CREATE UNIQUE INDEX "WorkerOnboardingClaim_connectionId_operationKey_key"
  ON "WorkerOnboardingClaim"("connectionId", "operationKey");
CREATE INDEX "WorkerClaim_org_sender_status_idx"
  ON "WorkerOnboardingClaim"("organizationId", "senderFingerprintKeyId", "senderFingerprint", "status");
CREATE INDEX "WorkerOnboardingClaim_projectId_status_expiresAt_idx"
  ON "WorkerOnboardingClaim"("projectId", "status", "expiresAt");
CREATE INDEX "WorkerOnboardingClaim_resolvedPersonId_status_idx"
  ON "WorkerOnboardingClaim"("resolvedPersonId", "status");

CREATE UNIQUE INDEX "WorkerPaymentDestination_activeSlot_key"
  ON "WorkerPaymentDestination"("activeSlot");
CREATE UNIQUE INDEX "WorkerPayment_one_active_per_purpose_idx"
  ON "WorkerPaymentDestination"("organizationId", "personId", "purpose")
  WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "WorkerPaymentDestination_organizationId_id_key"
  ON "WorkerPaymentDestination"("organizationId", "id");
CREATE UNIQUE INDEX "WorkerPayment_org_person_purpose_id_key"
  ON "WorkerPaymentDestination"("organizationId", "personId", "purpose", "id");
CREATE UNIQUE INDEX "WorkerPayment_org_person_purpose_version_key"
  ON "WorkerPaymentDestination"("organizationId", "personId", "purpose", "version");
CREATE UNIQUE INDEX "WorkerPayment_org_person_purpose_type_fp_key"
  ON "WorkerPaymentDestination"("organizationId", "personId", "purpose", "type", "fingerprintKeyId", "fingerprint");
CREATE UNIQUE INDEX "WorkerPayment_org_person_operation_key"
  ON "WorkerPaymentDestination"("organizationId", "personId", "operationKey");
CREATE INDEX "WorkerPayment_org_person_purpose_status_idx"
  ON "WorkerPaymentDestination"("organizationId", "personId", "purpose", "status");
CREATE INDEX "WorkerPaymentDestination_status_availableFrom_idx"
  ON "WorkerPaymentDestination"("status", "availableFrom");
CREATE INDEX "WorkerPaymentDestination_verifiedById_verifiedAt_idx"
  ON "WorkerPaymentDestination"("verifiedById", "verifiedAt");

ALTER TABLE "WorkerPerson"
  ADD CONSTRAINT "WorkerPerson_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerPerson_identityVerifiedById_fkey"
  FOREIGN KEY ("identityVerifiedById") REFERENCES "PlatformUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerPerson_identityRejectedById_fkey"
  FOREIGN KEY ("identityRejectedById") REFERENCES "PlatformUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkerChannelIdentity"
  ADD CONSTRAINT "WorkerChannelIdentity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerChannelIdentity_organizationId_personId_fkey"
  FOREIGN KEY ("organizationId", "personId") REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerOnboardingClaim"
  ADD CONSTRAINT "WorkerOnboardingClaim_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerOnboardingClaim_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerOnboardingClaim_projectId_connectionId_fkey"
  FOREIGN KEY ("projectId", "connectionId") REFERENCES "WhatsAppConnection"("projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerOnboardingClaim_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "PlatformUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerOnboardingClaim_organizationId_resolvedPersonId_fkey"
  FOREIGN KEY ("organizationId", "resolvedPersonId") REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerClaim_resolved_channel_scope_fkey"
  FOREIGN KEY ("organizationId", "resolvedPersonId", "resolvedChannelIdentityId") REFERENCES "WorkerChannelIdentity"("organizationId", "personId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentDestination"
  ADD CONSTRAINT "WorkerPaymentDestination_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerPaymentDestination_organizationId_personId_fkey"
  FOREIGN KEY ("organizationId", "personId") REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerPayment_previous_scope_fkey"
  FOREIGN KEY ("organizationId", "personId", "purpose", "previousDestinationId") REFERENCES "WorkerPaymentDestination"("organizationId", "personId", "purpose", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkerPaymentDestination_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "PlatformUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
