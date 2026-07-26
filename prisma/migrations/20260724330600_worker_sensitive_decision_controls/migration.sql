-- Expand-only controls for worker identity and payment decisions.
-- New actor columns remain nullable at the Prisma layer until legacy rows have
-- been backfilled, while NOT VALID checks protect every new or changed row.
CREATE TYPE "WorkerPaymentSubmissionSource" AS ENUM (
  'TENANT_MEMBERSHIP',
  'WORKER_CHANNEL'
);

CREATE TYPE "WorkerSensitiveDecisionAction" AS ENUM (
  'IDENTITY_VERIFIED',
  'IDENTITY_REJECTED',
  'ONBOARDING_APPROVED',
  'ONBOARDING_REJECTED',
  'PAYMENT_VERIFIED',
  'PAYMENT_REJECTED',
  'PAYMENT_ACTIVATED',
  'PAYMENT_REVOKED'
);

-- The legacy phone column is no longer the identity authority. Existing values
-- remain available for dual reads, while new bridge rows may omit cleartext PII.
ALTER TABLE "Worker"
  ALTER COLUMN "phone" DROP NOT NULL;

ALTER TABLE "WorkerPerson"
  ADD COLUMN "identityVerifiedByMembershipId" TEXT,
  ADD COLUMN "identityRejectedByMembershipId" TEXT,
  ADD COLUMN "identityDecisionEvidenceHash" CHAR(64);

ALTER TABLE "WorkerOnboardingClaim"
  ADD COLUMN "reviewedByMembershipId" TEXT,
  ADD COLUMN "reviewEvidenceHash" CHAR(64);

ALTER TABLE "WorkerPaymentDestination"
  ADD COLUMN "submissionSource" "WorkerPaymentSubmissionSource",
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedByMembershipId" TEXT,
  ADD COLUMN "submittedByChannelIdentityId" TEXT,
  ADD COLUMN "resolvedType" "WorkerPaymentDestinationType",
  ADD COLUMN "resolvedEncryptedPayload" TEXT,
  ADD COLUMN "resolvedFingerprint" CHAR(64),
  ADD COLUMN "resolvedFingerprintKeyId" VARCHAR(100),
  ADD COLUMN "resolvedWrappingKeyId" VARCHAR(100),
  ADD COLUMN "resolvedRecordVersion" INTEGER,
  ADD COLUMN "verifiedByMembershipId" TEXT,
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "activatedByMembershipId" TEXT,
  ADD COLUMN "rejectedByMembershipId" TEXT,
  ADD COLUMN "revokedByMembershipId" TEXT;

-- Preserve an auditable tenant membership even if the legacy PlatformUser actor
-- is later detached. Evidence hashes are deliberately not fabricated here.
UPDATE "WorkerPerson" AS person
SET "identityVerifiedByMembershipId" = membership."id"
FROM "TenantMembership" AS membership
WHERE person."identityVerifiedById" IS NOT NULL
  AND membership."organizationId" = person."organizationId"
  AND membership."userId" = person."identityVerifiedById"
  AND person."identityVerifiedByMembershipId" IS NULL;

UPDATE "WorkerPerson" AS person
SET "identityRejectedByMembershipId" = membership."id"
FROM "TenantMembership" AS membership
WHERE person."identityRejectedById" IS NOT NULL
  AND membership."organizationId" = person."organizationId"
  AND membership."userId" = person."identityRejectedById"
  AND person."identityRejectedByMembershipId" IS NULL;

UPDATE "WorkerOnboardingClaim" AS claim
SET "reviewedByMembershipId" = membership."id"
FROM "TenantMembership" AS membership
WHERE claim."reviewedById" IS NOT NULL
  AND membership."organizationId" = claim."organizationId"
  AND membership."userId" = claim."reviewedById"
  AND claim."reviewedByMembershipId" IS NULL;

UPDATE "WorkerPaymentDestination" AS destination
SET "verifiedByMembershipId" = membership."id"
FROM "TenantMembership" AS membership
WHERE destination."verifiedById" IS NOT NULL
  AND membership."organizationId" = destination."organizationId"
  AND membership."userId" = destination."verifiedById"
  AND destination."verifiedByMembershipId" IS NULL;

CREATE TABLE "WorkerSensitiveDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "action" "WorkerSensitiveDecisionAction" NOT NULL,
  "workerPersonId" TEXT,
  "onboardingClaimId" TEXT,
  "paymentDestinationId" TEXT,
  "policyVersion" VARCHAR(64) NOT NULL,
  "evidenceHash" CHAR(64) NOT NULL,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkerSensitiveDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WSD_hash_and_key_check" CHECK (
    "policyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "evidenceHash" ~ '^[0-9a-f]{64}$'
    AND "operationKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "WSD_exact_subject_check" CHECK (
    (
      "action" IN ('IDENTITY_VERIFIED', 'IDENTITY_REJECTED')
      AND "workerPersonId" IS NOT NULL
      AND "onboardingClaimId" IS NULL
      AND "paymentDestinationId" IS NULL
    )
    OR
    (
      "action" IN ('ONBOARDING_APPROVED', 'ONBOARDING_REJECTED')
      AND "workerPersonId" IS NULL
      AND "onboardingClaimId" IS NOT NULL
      AND "paymentDestinationId" IS NULL
    )
    OR
    (
      "action" IN (
        'PAYMENT_VERIFIED',
        'PAYMENT_REJECTED',
        'PAYMENT_ACTIVATED',
        'PAYMENT_REVOKED'
      )
      AND "workerPersonId" IS NULL
      AND "onboardingClaimId" IS NULL
      AND "paymentDestinationId" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "WSD_org_id_key"
  ON "WorkerSensitiveDecision"("organizationId", "id");
CREATE UNIQUE INDEX "WSD_org_operation_key"
  ON "WorkerSensitiveDecision"("organizationId", "operationKey");
CREATE INDEX "WSD_org_action_created_idx"
  ON "WorkerSensitiveDecision"("organizationId", "action", "createdAt");
CREATE INDEX "WSD_org_person_created_idx"
  ON "WorkerSensitiveDecision"("organizationId", "workerPersonId", "createdAt");
CREATE INDEX "WSD_org_claim_created_idx"
  ON "WorkerSensitiveDecision"("organizationId", "onboardingClaimId", "createdAt");
CREATE INDEX "WSD_org_payment_created_idx"
  ON "WorkerSensitiveDecision"("organizationId", "paymentDestinationId", "createdAt");

ALTER TABLE "WorkerSensitiveDecision"
  ADD CONSTRAINT "WorkerSensitiveDecision_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WSD_actor_membership_fkey"
  FOREIGN KEY ("organizationId", "actorMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WSD_worker_person_fkey"
  FOREIGN KEY ("organizationId", "workerPersonId")
  REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WSD_onboarding_claim_fkey"
  FOREIGN KEY ("organizationId", "onboardingClaimId")
  REFERENCES "WorkerOnboardingClaim"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WSD_payment_destination_fkey"
  FOREIGN KEY ("organizationId", "paymentDestinationId")
  REFERENCES "WorkerPaymentDestination"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-enforced append-only semantics. Corrections are compensating events,
-- never UPDATE or DELETE operations against prior decisions.
CREATE FUNCTION "obrasaas_worker_sensitive_decision_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'WorkerSensitiveDecision is append-only';
END;
$$;

CREATE TRIGGER "WorkerSensitiveDecision_append_only"
BEFORE UPDATE OR DELETE ON "WorkerSensitiveDecision"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_worker_sensitive_decision_append_only"();

CREATE TRIGGER "WorkerSensitiveDecision_no_truncate"
BEFORE TRUNCATE ON "WorkerSensitiveDecision"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_worker_sensitive_decision_append_only"();

-- Add tenant-scoped actor references without scanning existing tables under an
-- AccessExclusive validation lock. The next migration validates compatible data.
ALTER TABLE "WorkerPerson"
  ADD CONSTRAINT "WorkerPerson_verifier_membership_fkey"
  FOREIGN KEY ("organizationId", "identityVerifiedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPerson_rejecter_membership_fkey"
  FOREIGN KEY ("organizationId", "identityRejectedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "WorkerOnboardingClaim"
  ADD CONSTRAINT "WorkerClaim_reviewer_membership_fkey"
  FOREIGN KEY ("organizationId", "reviewedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "WorkerPaymentDestination"
  ADD CONSTRAINT "WorkerPayment_submitter_membership_fkey"
  FOREIGN KEY ("organizationId", "submittedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPayment_submitter_channel_fkey"
  FOREIGN KEY ("organizationId", "personId", "submittedByChannelIdentityId")
  REFERENCES "WorkerChannelIdentity"("organizationId", "personId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPayment_verifier_membership_fkey"
  FOREIGN KEY ("organizationId", "verifiedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPayment_activator_membership_fkey"
  FOREIGN KEY ("organizationId", "activatedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPayment_rejecter_membership_fkey"
  FOREIGN KEY ("organizationId", "rejectedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPayment_revoker_membership_fkey"
  FOREIGN KEY ("organizationId", "revokedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- Install the RESTRICT guard before removing the legacy composite SET NULL
-- action. This prevents deleting a WorkerPerson from clearing organizationId.
ALTER TABLE "Worker"
  ADD CONSTRAINT "Worker_person_scope_restrict_fkey"
  FOREIGN KEY ("organizationId", "personId")
  REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "WorkerPerson"
  ADD CONSTRAINT "WorkerPerson_identity_decision_actor_check" CHECK (
    (
      "identityStatus" IN ('UNVERIFIED', 'PENDING_REVIEW')
      AND "identityVerifiedByMembershipId" IS NULL
      AND "identityRejectedByMembershipId" IS NULL
      AND "identityDecisionEvidenceHash" IS NULL
    )
    OR
    (
      "identityStatus" = 'VERIFIED'
      AND "identityVerifiedByMembershipId" IS NOT NULL
      AND "identityRejectedByMembershipId" IS NULL
      AND "identityDecisionEvidenceHash" IS NOT NULL
      AND "identityDecisionEvidenceHash" ~ '^[0-9a-f]{64}$'
    )
    OR
    (
      "identityStatus" = 'REJECTED'
      AND "identityVerifiedByMembershipId" IS NULL
      AND "identityRejectedByMembershipId" IS NOT NULL
      AND "identityDecisionEvidenceHash" IS NOT NULL
      AND "identityDecisionEvidenceHash" ~ '^[0-9a-f]{64}$'
    )
  ) NOT VALID;

ALTER TABLE "WorkerOnboardingClaim"
  ADD CONSTRAINT "WorkerClaim_review_actor_check" CHECK (
    (
      "status" IN ('PENDING', 'SUBMITTED', 'EXPIRED', 'CANCELLED')
      AND "reviewedByMembershipId" IS NULL
      AND "reviewEvidenceHash" IS NULL
    )
    OR
    (
      "status" IN ('APPROVED', 'REJECTED')
      AND "reviewedByMembershipId" IS NOT NULL
      AND "reviewEvidenceHash" IS NOT NULL
      AND "reviewEvidenceHash" ~ '^[0-9a-f]{64}$'
    )
  ) NOT VALID;

ALTER TABLE "WorkerPaymentDestination"
  ADD CONSTRAINT "WorkerPayment_submission_actor_check" CHECK (
    "submittedAt" IS NOT NULL
    AND "submissionSource" IS NOT NULL
    AND (
      (
        "submissionSource" = 'TENANT_MEMBERSHIP'
        AND "submittedByMembershipId" IS NOT NULL
        AND "submittedByChannelIdentityId" IS NULL
      )
      OR
      (
        "submissionSource" = 'WORKER_CHANNEL'
        AND "submittedByMembershipId" IS NULL
        AND "submittedByChannelIdentityId" IS NOT NULL
      )
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerPayment_decision_actor_check" CHECK (
    ("verifiedAt" IS NULL) = ("verifiedByMembershipId" IS NULL)
    AND ("activatedAt" IS NULL) = ("activatedByMembershipId" IS NULL)
    AND ("rejectedAt" IS NULL) = ("rejectedByMembershipId" IS NULL)
    AND ("revokedAt" IS NULL) = ("revokedByMembershipId" IS NULL)
    AND (
      (
        "status" = 'PENDING_VERIFICATION'
        AND "verifiedByMembershipId" IS NULL
        AND "activatedByMembershipId" IS NULL
        AND "rejectedByMembershipId" IS NULL
        AND "revokedByMembershipId" IS NULL
      )
      OR
      (
        "status" = 'VERIFIED'
        AND "verifiedByMembershipId" IS NOT NULL
        AND "activatedByMembershipId" IS NULL
        AND "rejectedByMembershipId" IS NULL
        AND "revokedByMembershipId" IS NULL
      )
      OR
      (
        "status" IN ('ACTIVE', 'SUPERSEDED')
        AND "verifiedByMembershipId" IS NOT NULL
        AND "activatedByMembershipId" IS NOT NULL
        AND "rejectedByMembershipId" IS NULL
        AND "revokedByMembershipId" IS NULL
      )
      OR
      (
        "status" = 'REJECTED'
        AND "verifiedByMembershipId" IS NULL
        AND "activatedByMembershipId" IS NULL
        AND "rejectedByMembershipId" IS NOT NULL
        AND "revokedByMembershipId" IS NULL
      )
      OR
      (
        "status" = 'REVOKED'
        AND "rejectedByMembershipId" IS NULL
        AND "revokedByMembershipId" IS NOT NULL
      )
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerPayment_separation_of_duties_check" CHECK (
    (
      "submittedByMembershipId" IS NULL
      OR "verifiedByMembershipId" IS NULL
      OR "submittedByMembershipId" <> "verifiedByMembershipId"
    )
    AND (
      "submittedByMembershipId" IS NULL
      OR "activatedByMembershipId" IS NULL
      OR "submittedByMembershipId" <> "activatedByMembershipId"
    )
    AND (
      "verifiedByMembershipId" IS NULL
      OR "activatedByMembershipId" IS NULL
      OR "verifiedByMembershipId" <> "activatedByMembershipId"
    )
    AND (
      "submittedByMembershipId" IS NULL
      OR "rejectedByMembershipId" IS NULL
      OR "submittedByMembershipId" <> "rejectedByMembershipId"
    )
    AND (
      "activatedByMembershipId" IS NULL
      OR "revokedByMembershipId" IS NULL
      OR "activatedByMembershipId" <> "revokedByMembershipId"
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerPayment_alias_resolution_check" CHECK (
    (
      (
        "resolvedType" IS NULL
        AND "resolvedEncryptedPayload" IS NULL
        AND "resolvedFingerprint" IS NULL
        AND "resolvedFingerprintKeyId" IS NULL
        AND "resolvedWrappingKeyId" IS NULL
        AND "resolvedRecordVersion" IS NULL
      )
      OR
      (
        "type" = 'ALIAS'
        AND "resolvedType" IS NOT NULL
        AND "resolvedType" IN ('CBU', 'CVU')
        AND "resolvedEncryptedPayload" IS NOT NULL
        AND octet_length("resolvedEncryptedPayload") BETWEEN 20 AND 16384
        AND "resolvedEncryptedPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
        AND "resolvedFingerprint" IS NOT NULL
        AND "resolvedFingerprint" ~ '^[0-9a-f]{64}$'
        AND "resolvedFingerprintKeyId" IS NOT NULL
        AND "resolvedFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        AND "resolvedWrappingKeyId" IS NOT NULL
        AND "resolvedWrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        AND "resolvedRecordVersion" IS NOT NULL
        AND "resolvedRecordVersion" > 0
      )
    )
    AND (
      "type" <> 'ALIAS'
      OR "status" NOT IN ('VERIFIED', 'ACTIVE', 'SUPERSEDED')
      OR "resolvedType" IS NOT NULL
    )
  ) NOT VALID;

CREATE INDEX "WorkerPerson_verifier_membership_idx"
  ON "WorkerPerson"("identityVerifiedByMembershipId", "identityVerifiedAt");
CREATE INDEX "WorkerPerson_rejecter_membership_idx"
  ON "WorkerPerson"("identityRejectedByMembershipId", "identityRejectedAt");
CREATE INDEX "WorkerClaim_reviewer_membership_idx"
  ON "WorkerOnboardingClaim"("reviewedByMembershipId", "reviewedAt");
CREATE INDEX "WorkerPaymentDestination_verifiedByMembershipId_verifiedAt_idx"
  ON "WorkerPaymentDestination"("verifiedByMembershipId", "verifiedAt");
CREATE INDEX "WorkerPayment_activator_membership_idx"
  ON "WorkerPaymentDestination"("activatedByMembershipId", "activatedAt");
CREATE INDEX "WorkerPaymentDestination_rejectedByMembershipId_rejectedAt_idx"
  ON "WorkerPaymentDestination"("rejectedByMembershipId", "rejectedAt");
CREATE INDEX "WorkerPaymentDestination_revokedByMembershipId_revokedAt_idx"
  ON "WorkerPaymentDestination"("revokedByMembershipId", "revokedAt");

-- Crypto rollout: install v2-or-v3 envelope checks in parallel. The validation
-- migration proves these superset constraints before swapping their names.
ALTER TABLE "WorkerPerson"
  ADD CONSTRAINT "WorkerPerson_identity_bundle_v3_check" CHECK (
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
      AND "encryptedIdentityPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
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
  ) NOT VALID;

ALTER TABLE "WorkerChannelIdentity"
  ADD CONSTRAINT "WorkerChannelIdentity_encrypted_address_v3_check" CHECK (
    octet_length("encryptedAddressPayload") BETWEEN 20 AND 16384
    AND "encryptedAddressPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
    AND "addressFingerprint" ~ '^[0-9a-f]{64}$'
    AND "addressFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND "addressLastFour" ~ '^[0-9]{4}$'
    AND "wrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  ) NOT VALID,
  ADD CONSTRAINT "WorkerChannelIdentity_provider_subject_v3_check" CHECK (
    (
      "encryptedProviderSubjectPayload" IS NULL
      AND "providerSubjectFingerprint" IS NULL
      AND "providerSubjectFingerprintKeyId" IS NULL
    )
    OR
    (
      "encryptedProviderSubjectPayload" IS NOT NULL
      AND octet_length("encryptedProviderSubjectPayload") BETWEEN 20 AND 16384
      AND "encryptedProviderSubjectPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
      AND "providerSubjectFingerprint" IS NOT NULL
      AND "providerSubjectFingerprint" ~ '^[0-9a-f]{64}$'
      AND "providerSubjectFingerprintKeyId" IS NOT NULL
      AND "providerSubjectFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    )
  ) NOT VALID;

ALTER TABLE "WorkerOnboardingClaim"
  ADD CONSTRAINT "WorkerOnboardingClaim_sender_v3_check" CHECK (
    octet_length("senderEncryptedPayload") BETWEEN 20 AND 16384
    AND "senderEncryptedPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
    AND "senderFingerprint" ~ '^[0-9a-f]{64}$'
    AND "senderFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND "senderLastFour" ~ '^[0-9]{4}$'
    AND "senderWrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  ) NOT VALID,
  ADD CONSTRAINT "WorkerOnboardingClaim_identity_bundle_v3_check" CHECK (
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
      AND "claimedIdentityEncryptedPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
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
  ) NOT VALID;

ALTER TABLE "WorkerPaymentDestination"
  ADD CONSTRAINT "WorkerPaymentDestination_encrypted_payload_v3_check" CHECK (
    octet_length("encryptedPayload") BETWEEN 20 AND 16384
    AND "encryptedPayload" ~ '^v[23]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$'
    AND "fingerprint" ~ '^[0-9a-f]{64}$'
    AND "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND (
      ("type" IN ('CBU', 'CVU') AND "lastFour" ~ '^[0-9]{4}$')
      OR ("type" = 'ALIAS' AND "lastFour" ~ '^[a-z0-9.-]{1,4}$')
    )
    AND "wrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND "holderCuilFingerprint" ~ '^[0-9a-f]{64}$'
    AND "holderCuilFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  ) NOT VALID;
