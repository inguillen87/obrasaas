-- PRO-05B.1 adds a tenant-scoped, non-executable privacy decision ledger.
-- It preserves the sealed PRO-05A evidence and cannot erase, export, dispatch
-- or otherwise mutate discovered source records.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TYPE "DataSubjectRequesterKind" AS ENUM ('SELF', 'REPRESENTATIVE');
CREATE TYPE "DataSubjectVerificationEventKind" AS ENUM ('VERIFIED', 'REVOKED');
CREATE TYPE "DataSubjectAssuranceLevel" AS ENUM ('SUBSTANTIAL');
CREATE TYPE "DataSubjectLegalDeadlineMethod" AS ENUM ('REVIEWED_EXPLICIT_DATE');
CREATE TYPE "DataSubjectHoldScopeKind" AS ENUM ('ITEM', 'CATEGORY');
CREATE TYPE "DataSubjectHoldEventKind" AS ENUM ('CREATED', 'REVIEWED', 'RELEASED');
CREATE TYPE "DataSubjectDecisionStatus" AS ENUM (
  'DRAFTING',
  'PENDING_APPROVAL',
  'SEALED_BLOCKED',
  'REJECTED'
);
CREATE TYPE "DataSubjectDecisionAction" AS ENUM (
  'DISCLOSE_CANDIDATE',
  'CORRECT_CANDIDATE',
  'RESTRICT_CANDIDATE',
  'PORTABILITY_CANDIDATE',
  'ERASE_CANDIDATE',
  'CRYPTO_ERASE_CANDIDATE',
  'PSEUDONYMIZE_CANDIDATE',
  'KEEP_WITH_BASIS',
  'WITHHOLD_WITH_BASIS',
  'NO_CHANGE_WITH_BASIS',
  'UNRESOLVED'
);

CREATE UNIQUE INDEX "DataSubjectDiscoveryItem_scope_id_key"
  ON "DataSubjectDiscoveryItem"("organizationId", "requestId", "manifestId", "id");

CREATE TABLE "DataSubjectRequesterVerificationEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "predecessorEventId" TEXT,
  "kind" "DataSubjectVerificationEventKind" NOT NULL,
  "requesterKind" "DataSubjectRequesterKind",
  "assuranceLevel" "DataSubjectAssuranceLevel",
  "verificationMethodCode" VARCHAR(64),
  "verificationPolicyVersion" VARCHAR(64),
  "fingerprintKeyId" VARCHAR(100) NOT NULL,
  "requesterFingerprintHmac" CHAR(64),
  "identityEvidenceSha256" CHAR(64),
  "challengeEvidenceSha256" CHAR(64),
  "subjectIdentityRecordVersion" INTEGER,
  "representationMethodCode" VARCHAR(64),
  "representationEvidenceSha256" CHAR(64),
  "validUntil" TIMESTAMPTZ(3),
  "representationValidUntil" TIMESTAMPTZ(3),
  "revocationReasonCode" VARCHAR(64),
  "actorMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectRequesterVerificationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectVerificationEvent_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "DataSubjectVerificationEvent_hashes_check" CHECK (
    "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
    AND ("requesterFingerprintHmac" IS NULL OR "requesterFingerprintHmac"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("identityEvidenceSha256" IS NULL OR "identityEvidenceSha256"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("challengeEvidenceSha256" IS NULL OR "challengeEvidenceSha256"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("representationEvidenceSha256" IS NULL OR "representationEvidenceSha256"::TEXT ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "DataSubjectVerificationEvent_codes_check" CHECK (
    "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND ("verificationMethodCode" IS NULL OR "verificationMethodCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("verificationPolicyVersion" IS NULL OR "verificationPolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("representationMethodCode" IS NULL OR "representationMethodCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("revocationReasonCode" IS NULL OR "revocationReasonCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
  ),
  CONSTRAINT "DataSubjectVerificationEvent_shape_check" CHECK (
    (
      "kind" = 'VERIFIED'
      AND "requesterKind" IS NOT NULL
      AND "assuranceLevel" = 'SUBSTANTIAL'
      AND "verificationMethodCode" IS NOT NULL
      AND "verificationPolicyVersion" IS NOT NULL
      AND "requesterFingerprintHmac" IS NOT NULL
      AND "identityEvidenceSha256" IS NOT NULL
      AND "challengeEvidenceSha256" IS NOT NULL
      AND "validUntil" IS NOT NULL
      AND "revocationReasonCode" IS NULL
      AND (
        (
          "requesterKind" = 'SELF'
          AND "subjectIdentityRecordVersion" IS NOT NULL
          AND "representationMethodCode" IS NULL
          AND "representationEvidenceSha256" IS NULL
          AND "representationValidUntil" IS NULL
        )
        OR
        (
          "requesterKind" = 'REPRESENTATIVE'
          AND "subjectIdentityRecordVersion" IS NULL
          AND "representationMethodCode" IS NOT NULL
          AND "representationEvidenceSha256" IS NOT NULL
          AND "representationValidUntil" IS NOT NULL
        )
      )
    )
    OR
    (
      "kind" = 'REVOKED'
      AND "requesterKind" IS NULL
      AND "assuranceLevel" IS NULL
      AND "verificationMethodCode" IS NULL
      AND "verificationPolicyVersion" IS NULL
      AND "requesterFingerprintHmac" IS NULL
      AND "identityEvidenceSha256" IS NULL
      AND "challengeEvidenceSha256" IS NULL
      AND "subjectIdentityRecordVersion" IS NULL
      AND "representationMethodCode" IS NULL
      AND "representationEvidenceSha256" IS NULL
      AND "validUntil" IS NULL
      AND "representationValidUntil" IS NULL
      AND "revocationReasonCode" IS NOT NULL
    )
  )
);

CREATE TABLE "DataSubjectLegalAssessmentRevision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "manifestId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "predecessorAssessmentId" TEXT,
  "jurisdictionCode" VARCHAR(16) NOT NULL,
  "deadlineMethod" "DataSubjectLegalDeadlineMethod" NOT NULL,
  "dueAt" TIMESTAMPTZ(3) NOT NULL,
  "deadlinePolicyVersion" VARCHAR(64) NOT NULL,
  "deadlinePolicySha256" CHAR(64) NOT NULL,
  "retentionMatrixVersion" VARCHAR(64) NOT NULL,
  "retentionMatrixSha256" CHAR(64) NOT NULL,
  "legalReviewEvidenceSha256" CHAR(64) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "fingerprintKeyId" VARCHAR(100) NOT NULL,
  "assessedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectLegalAssessmentRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectLegalAssessment_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "DataSubjectLegalAssessment_hashes_check" CHECK (
    "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
    AND "deadlinePolicySha256"::TEXT ~ '^[a-f0-9]{64}$'
    AND "retentionMatrixSha256"::TEXT ~ '^[a-f0-9]{64}$'
    AND "legalReviewEvidenceSha256"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectLegalAssessment_codes_check" CHECK (
    "jurisdictionCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{1,15}$'
    AND "deadlinePolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "retentionMatrixVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  )
);

CREATE TABLE "DataSubjectLegalHold" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "manifestId" TEXT NOT NULL,
  "scopeKind" "DataSubjectHoldScopeKind" NOT NULL,
  "discoveryItemId" TEXT,
  "category" "DataSubjectDataCategory",
  "createdByMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "fingerprintKeyId" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectLegalHold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectLegalHold_scope_shape_check" CHECK (
    ("scopeKind" = 'ITEM' AND "discoveryItemId" IS NOT NULL AND "category" IS NULL)
    OR ("scopeKind" = 'CATEGORY' AND "discoveryItemId" IS NULL AND "category" IS NOT NULL)
  ),
  CONSTRAINT "DataSubjectLegalHold_hashes_check" CHECK (
    "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "DataSubjectLegalHold_key_id_check" CHECK (
    "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  )
);

CREATE TABLE "DataSubjectLegalHoldEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "holdId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "predecessorEventId" TEXT,
  "kind" "DataSubjectHoldEventKind" NOT NULL,
  "basisCode" VARCHAR(64),
  "policyVersion" VARCHAR(64),
  "evidenceSha256" CHAR(64),
  "ownerMembershipId" TEXT,
  "reviewDueAt" TIMESTAMPTZ(3),
  "releaseReasonCode" VARCHAR(64),
  "releaseEvidenceSha256" CHAR(64),
  "actorMembershipId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "fingerprintKeyId" VARCHAR(100) NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectLegalHoldEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectLegalHoldEvent_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "DataSubjectLegalHoldEvent_hashes_check" CHECK (
    "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
    AND ("evidenceSha256" IS NULL OR "evidenceSha256"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("releaseEvidenceSha256" IS NULL OR "releaseEvidenceSha256"::TEXT ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "DataSubjectLegalHoldEvent_codes_check" CHECK (
    "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND ("basisCode" IS NULL OR "basisCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("policyVersion" IS NULL OR "policyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("releaseReasonCode" IS NULL OR "releaseReasonCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
  ),
  CONSTRAINT "DataSubjectLegalHoldEvent_shape_check" CHECK (
    (
      "kind" IN ('CREATED', 'REVIEWED')
      AND "basisCode" IS NOT NULL
      AND "policyVersion" IS NOT NULL
      AND "evidenceSha256" IS NOT NULL
      AND "ownerMembershipId" IS NOT NULL
      AND "reviewDueAt" IS NOT NULL
      AND "releaseReasonCode" IS NULL
      AND "releaseEvidenceSha256" IS NULL
    )
    OR
    (
      "kind" = 'RELEASED'
      AND "basisCode" IS NULL
      AND "policyVersion" IS NULL
      AND "evidenceSha256" IS NULL
      AND "ownerMembershipId" IS NULL
      AND "reviewDueAt" IS NULL
      AND "releaseReasonCode" IS NOT NULL
      AND "releaseEvidenceSha256" IS NOT NULL
    )
  )
);

CREATE TABLE "DataSubjectDecisionSet" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "manifestId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "predecessorDecisionId" TEXT,
  "status" "DataSubjectDecisionStatus" NOT NULL DEFAULT 'DRAFTING',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "verificationEventId" TEXT NOT NULL,
  "legalAssessmentId" TEXT NOT NULL,
  "manifestSha256" CHAR(64),
  "holdSetSha256" CHAR(64),
  "itemCount" INTEGER,
  "unresolvedCount" INTEGER,
  "activeHoldCount" INTEGER,
  "decisionSha256" CHAR(64),
  "preparedByMembershipId" TEXT NOT NULL,
  "decidedByMembershipId" TEXT,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "fingerprintKeyId" VARCHAR(100) NOT NULL,
  "decisionOperationKeyHash" CHAR(64),
  "decisionRequestFingerprint" CHAR(64),
  "decisionFingerprintKeyId" VARCHAR(100),
  "decisionReasonCode" VARCHAR(64),
  "preparedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pendingAt" TIMESTAMPTZ(3),
  "decidedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "DataSubjectDecisionSet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectDecisionSet_revision_check" CHECK (
    "schemaVersion" = 1 AND "revision" >= 1
  ),
  CONSTRAINT "DataSubjectDecisionSet_counts_check" CHECK (
    ("itemCount" IS NULL OR "itemCount" BETWEEN 1 AND 1024)
    AND ("unresolvedCount" IS NULL OR "unresolvedCount" BETWEEN 0 AND 1024)
    AND ("activeHoldCount" IS NULL OR "activeHoldCount" BETWEEN 0 AND 256)
  ),
  CONSTRAINT "DataSubjectDecisionSet_hashes_check" CHECK (
    "operationKeyHash"::TEXT ~ '^[a-f0-9]{64}$'
    AND "requestFingerprint"::TEXT ~ '^[a-f0-9]{64}$'
    AND ("manifestSha256" IS NULL OR "manifestSha256"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("holdSetSha256" IS NULL OR "holdSetSha256"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("decisionSha256" IS NULL OR "decisionSha256"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("decisionOperationKeyHash" IS NULL OR "decisionOperationKeyHash"::TEXT ~ '^[a-f0-9]{64}$')
    AND ("decisionRequestFingerprint" IS NULL OR "decisionRequestFingerprint"::TEXT ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "DataSubjectDecisionSet_codes_check" CHECK (
    "fingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND ("decisionFingerprintKeyId" IS NULL OR "decisionFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$')
    AND ("decisionReasonCode" IS NULL OR "decisionReasonCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
  ),
  CONSTRAINT "DataSubjectDecisionSet_state_shape_check" CHECK (
    (
      "status" = 'DRAFTING'
      AND num_nonnulls("manifestSha256", "holdSetSha256", "itemCount", "unresolvedCount", "activeHoldCount", "decisionSha256", "pendingAt", "decidedByMembershipId", "decisionOperationKeyHash", "decisionRequestFingerprint", "decisionFingerprintKeyId", "decisionReasonCode", "decidedAt") = 0
    )
    OR
    (
      "status" = 'PENDING_APPROVAL'
      AND num_nonnulls("manifestSha256", "holdSetSha256", "itemCount", "unresolvedCount", "activeHoldCount", "decisionSha256", "pendingAt") = 7
      AND num_nonnulls("decidedByMembershipId", "decisionOperationKeyHash", "decisionRequestFingerprint", "decisionFingerprintKeyId", "decisionReasonCode", "decidedAt") = 0
    )
    OR
    (
      "status" = 'SEALED_BLOCKED'
      AND num_nonnulls("manifestSha256", "holdSetSha256", "itemCount", "unresolvedCount", "activeHoldCount", "decisionSha256", "pendingAt", "decidedByMembershipId", "decisionOperationKeyHash", "decisionRequestFingerprint", "decisionFingerprintKeyId", "decidedAt") = 12
      AND "decisionReasonCode" IS NULL
    )
    OR
    (
      "status" = 'REJECTED'
      AND num_nonnulls("manifestSha256", "holdSetSha256", "itemCount", "unresolvedCount", "activeHoldCount", "decisionSha256", "pendingAt", "decidedByMembershipId", "decisionOperationKeyHash", "decisionRequestFingerprint", "decisionFingerprintKeyId", "decisionReasonCode", "decidedAt") = 13
    )
  )
);

CREATE TABLE "DataSubjectDecisionItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "manifestId" TEXT NOT NULL,
  "decisionSetId" TEXT NOT NULL,
  "discoveryItemId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "action" "DataSubjectDecisionAction" NOT NULL,
  "legalBasisCode" VARCHAR(64),
  "retentionPolicyVersion" VARCHAR(64),
  "retentionRuleCode" VARCHAR(64),
  "retentionUntil" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataSubjectDecisionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataSubjectDecisionItem_ordinal_check" CHECK ("ordinal" BETWEEN 0 AND 1023),
  CONSTRAINT "DataSubjectDecisionItem_codes_check" CHECK (
    ("legalBasisCode" IS NULL OR "legalBasisCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("retentionPolicyVersion" IS NULL OR "retentionPolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    AND ("retentionRuleCode" IS NULL OR "retentionRuleCode" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
  )
);

CREATE UNIQUE INDEX "DataSubjectVerificationEvent_scope_id_key"
  ON "DataSubjectRequesterVerificationEvent"("organizationId", "requestId", "id");
CREATE UNIQUE INDEX "DataSubjectVerificationEvent_scope_sequence_key"
  ON "DataSubjectRequesterVerificationEvent"("organizationId", "requestId", "sequence");
CREATE UNIQUE INDEX "DataSubjectVerificationEvent_org_operation_key"
  ON "DataSubjectRequesterVerificationEvent"("organizationId", "operationKeyHash");
CREATE INDEX "DataSubjectVerificationEvent_request_occurred_idx"
  ON "DataSubjectRequesterVerificationEvent"("organizationId", "requestId", "occurredAt");

CREATE UNIQUE INDEX "DataSubjectLegalAssessment_scope_id_key"
  ON "DataSubjectLegalAssessmentRevision"("organizationId", "requestId", "id");
CREATE UNIQUE INDEX "DataSubjectLegalAssessment_scope_sequence_key"
  ON "DataSubjectLegalAssessmentRevision"("organizationId", "requestId", "sequence");
CREATE UNIQUE INDEX "DataSubjectLegalAssessment_org_operation_key"
  ON "DataSubjectLegalAssessmentRevision"("organizationId", "operationKeyHash");
CREATE INDEX "DataSubjectLegalAssessment_request_due_idx"
  ON "DataSubjectLegalAssessmentRevision"("organizationId", "requestId", "dueAt");

CREATE UNIQUE INDEX "DataSubjectLegalHold_scope_id_key"
  ON "DataSubjectLegalHold"("organizationId", "requestId", "id");
CREATE UNIQUE INDEX "DataSubjectLegalHold_manifest_scope_id_key"
  ON "DataSubjectLegalHold"("organizationId", "requestId", "manifestId", "id");
CREATE UNIQUE INDEX "DataSubjectLegalHold_org_operation_key"
  ON "DataSubjectLegalHold"("organizationId", "operationKeyHash");
CREATE INDEX "DataSubjectLegalHold_request_scope_idx"
  ON "DataSubjectLegalHold"("organizationId", "requestId", "manifestId", "scopeKind");

CREATE UNIQUE INDEX "DataSubjectLegalHoldEvent_scope_id_key"
  ON "DataSubjectLegalHoldEvent"("organizationId", "requestId", "holdId", "id");
CREATE UNIQUE INDEX "DataSubjectLegalHoldEvent_scope_sequence_key"
  ON "DataSubjectLegalHoldEvent"("organizationId", "requestId", "holdId", "sequence");
CREATE UNIQUE INDEX "DataSubjectLegalHoldEvent_org_operation_key"
  ON "DataSubjectLegalHoldEvent"("organizationId", "operationKeyHash");
CREATE INDEX "DataSubjectLegalHoldEvent_hold_occurred_idx"
  ON "DataSubjectLegalHoldEvent"("organizationId", "requestId", "holdId", "occurredAt");

CREATE UNIQUE INDEX "DataSubjectDecisionSet_scope_id_key"
  ON "DataSubjectDecisionSet"("organizationId", "requestId", "id");
CREATE UNIQUE INDEX "DataSubjectDecisionSet_manifest_scope_id_key"
  ON "DataSubjectDecisionSet"("organizationId", "requestId", "manifestId", "id");
CREATE UNIQUE INDEX "DataSubjectDecisionSet_scope_revision_key"
  ON "DataSubjectDecisionSet"("organizationId", "requestId", "revision");
CREATE UNIQUE INDEX "DataSubjectDecisionSet_org_operation_key"
  ON "DataSubjectDecisionSet"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "DataSubjectDecisionSet_org_decision_operation_key"
  ON "DataSubjectDecisionSet"("organizationId", "decisionOperationKeyHash");
CREATE UNIQUE INDEX "DataSubjectDecisionSet_one_pending_key"
  ON "DataSubjectDecisionSet"("organizationId", "requestId")
  WHERE "status" IN ('DRAFTING', 'PENDING_APPROVAL');
CREATE INDEX "DataSubjectDecisionSet_request_status_revision_idx"
  ON "DataSubjectDecisionSet"("organizationId", "requestId", "status", "revision");

CREATE UNIQUE INDEX "DataSubjectDecisionItem_decision_item_key"
  ON "DataSubjectDecisionItem"("organizationId", "decisionSetId", "discoveryItemId");
CREATE UNIQUE INDEX "DataSubjectDecisionItem_decision_ordinal_key"
  ON "DataSubjectDecisionItem"("organizationId", "decisionSetId", "ordinal");
CREATE INDEX "DataSubjectDecisionItem_request_action_idx"
  ON "DataSubjectDecisionItem"("organizationId", "requestId", "manifestId", "action");

ALTER TABLE "DataSubjectRequesterVerificationEvent"
  ADD CONSTRAINT "DataSubjectRequesterVerificationEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectVerificationEvent_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectVerificationEvent_predecessor_fkey"
  FOREIGN KEY ("organizationId", "requestId", "predecessorEventId")
  REFERENCES "DataSubjectRequesterVerificationEvent"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectVerificationEvent_actor_fkey"
  FOREIGN KEY ("organizationId", "actorMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DataSubjectLegalAssessmentRevision"
  ADD CONSTRAINT "DataSubjectLegalAssessmentRevision_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectLegalAssessment_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalAssessment_manifest_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId")
  REFERENCES "DataSubjectDiscoveryManifest"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalAssessment_predecessor_fkey"
  FOREIGN KEY ("organizationId", "requestId", "predecessorAssessmentId")
  REFERENCES "DataSubjectLegalAssessmentRevision"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalAssessment_actor_fkey"
  FOREIGN KEY ("organizationId", "actorMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DataSubjectLegalHold"
  ADD CONSTRAINT "DataSubjectLegalHold_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectLegalHold_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHold_manifest_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId")
  REFERENCES "DataSubjectDiscoveryManifest"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHold_item_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId", "discoveryItemId")
  REFERENCES "DataSubjectDiscoveryItem"("organizationId", "requestId", "manifestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHold_creator_fkey"
  FOREIGN KEY ("organizationId", "createdByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DataSubjectLegalHoldEvent"
  ADD CONSTRAINT "DataSubjectLegalHoldEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectLegalHoldEvent_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHoldEvent_hold_fkey"
  FOREIGN KEY ("organizationId", "requestId", "holdId")
  REFERENCES "DataSubjectLegalHold"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHoldEvent_predecessor_fkey"
  FOREIGN KEY ("organizationId", "requestId", "holdId", "predecessorEventId")
  REFERENCES "DataSubjectLegalHoldEvent"("organizationId", "requestId", "holdId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHoldEvent_owner_fkey"
  FOREIGN KEY ("organizationId", "ownerMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectLegalHoldEvent_actor_fkey"
  FOREIGN KEY ("organizationId", "actorMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DataSubjectDecisionSet"
  ADD CONSTRAINT "DataSubjectDecisionSet_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectDecisionSet_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionSet_manifest_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId")
  REFERENCES "DataSubjectDiscoveryManifest"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionSet_predecessor_fkey"
  FOREIGN KEY ("organizationId", "requestId", "predecessorDecisionId")
  REFERENCES "DataSubjectDecisionSet"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionSet_verification_fkey"
  FOREIGN KEY ("organizationId", "requestId", "verificationEventId")
  REFERENCES "DataSubjectRequesterVerificationEvent"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionSet_assessment_fkey"
  FOREIGN KEY ("organizationId", "requestId", "legalAssessmentId")
  REFERENCES "DataSubjectLegalAssessmentRevision"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionSet_preparer_fkey"
  FOREIGN KEY ("organizationId", "preparedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionSet_checker_fkey"
  FOREIGN KEY ("organizationId", "decidedByMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DataSubjectDecisionItem"
  ADD CONSTRAINT "DataSubjectDecisionItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DataSubjectDecisionItem_request_fkey"
  FOREIGN KEY ("organizationId", "requestId")
  REFERENCES "DataSubjectRequest"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionItem_manifest_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId")
  REFERENCES "DataSubjectDiscoveryManifest"("organizationId", "requestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionItem_decision_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId", "decisionSetId")
  REFERENCES "DataSubjectDecisionSet"("organizationId", "requestId", "manifestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "DataSubjectDecisionItem_discovery_item_fkey"
  FOREIGN KEY ("organizationId", "requestId", "manifestId", "discoveryItemId")
  REFERENCES "DataSubjectDiscoveryItem"("organizationId", "requestId", "manifestId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "obrasaas_data_subject_decision_admin_active"(
  organization_id TEXT,
  membership_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM "TenantMembership"
     WHERE "organizationId" = organization_id
       AND "id" = membership_id
       AND "status" = 'ACTIVE'
       AND "tenantRole" = 'ADMIN'
  );
$$;

CREATE FUNCTION "obrasaas_data_subject_decision_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_decision_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% cannot be truncated', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_verification_event_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  request_status TEXT;
  worker_person_id TEXT;
  prior_id TEXT;
  prior_sequence INTEGER;
  prior_kind TEXT;
  prior_valid_until TIMESTAMPTZ(3);
  worker_identity_status TEXT;
  worker_record_version INTEGER;
  worker_evidence_sha256 TEXT;
  actor_valid BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT, "workerPersonId"
       FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status, worker_person_id
  USING NEW."organizationId", NEW."requestId";

  IF request_status IS NULL THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  IF request_status NOT IN ('DISCOVERED', 'DISCOVERY_BLOCKED') THEN
    RAISE EXCEPTION 'privacy review request is not discovery-terminal' USING ERRCODE = 'P0509';
  END IF;

  EXECUTE format(
    'SELECT TRUE FROM %I."TenantMembership"
      WHERE "organizationId" = $1 AND "id" = $2
        AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
      FOR SHARE',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."actorMembershipId";
  IF actor_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;

  EXECUTE format(
    'SELECT "id", "sequence", "kind"::TEXT, "validUntil"
       FROM %I."DataSubjectRequesterVerificationEvent"
      WHERE "organizationId" = $1 AND "requestId" = $2
      ORDER BY "sequence" DESC LIMIT 1',
    TG_TABLE_SCHEMA
  ) INTO prior_id, prior_sequence, prior_kind, prior_valid_until
  USING NEW."organizationId", NEW."requestId";

  IF prior_id IS NULL THEN
    IF NEW."sequence" <> 1 OR NEW."predecessorEventId" IS NOT NULL OR NEW."kind"::TEXT <> 'VERIFIED' THEN
      RAISE EXCEPTION 'first privacy verification event must be VERIFIED sequence one'
        USING ERRCODE = 'P0509';
    END IF;
  ELSIF NEW."sequence" <> prior_sequence + 1
    OR NEW."predecessorEventId" IS DISTINCT FROM prior_id
  THEN
    RAISE EXCEPTION 'privacy verification head is stale' USING ERRCODE = 'P0509';
  END IF;

  IF NEW."kind"::TEXT = 'VERIFIED' THEN
    IF prior_kind = 'VERIFIED' AND prior_valid_until > observed_at THEN
      RAISE EXCEPTION 'current requester verification must be revoked before replacement'
        USING ERRCODE = 'P0509';
    END IF;
    IF NEW."validUntil" <= observed_at
      OR NEW."validUntil" > observed_at + INTERVAL '30 days'
    THEN
      RAISE EXCEPTION 'requester verification validity is outside the bounded policy'
        USING ERRCODE = 'P0500';
    END IF;

    IF NEW."requesterKind"::TEXT = 'SELF' THEN
      IF worker_person_id IS NULL THEN
        RAISE EXCEPTION 'self requester requires a canonical worker person'
          USING ERRCODE = 'P0509';
      END IF;
      EXECUTE format(
        'SELECT "identityStatus"::TEXT, "recordVersion", "identityDecisionEvidenceHash"::TEXT
           FROM %I."WorkerPerson"
          WHERE "organizationId" = $1 AND "id" = $2
          FOR SHARE',
        TG_TABLE_SCHEMA
      ) INTO worker_identity_status, worker_record_version, worker_evidence_sha256
      USING NEW."organizationId", worker_person_id;
      IF worker_identity_status <> 'VERIFIED'
        OR worker_evidence_sha256 IS NULL
        OR NEW."subjectIdentityRecordVersion" IS DISTINCT FROM worker_record_version
        OR NEW."identityEvidenceSha256"::TEXT IS DISTINCT FROM worker_evidence_sha256
        OR NEW."verificationMethodCode" <> 'CANONICAL_WORKER_IDENTITY_PLUS_CHALLENGE'
      THEN
        RAISE EXCEPTION 'self requester identity snapshot is not current and verified'
          USING ERRCODE = 'P0509';
      END IF;
    ELSE
      IF NEW."verificationMethodCode" <> 'MANUAL_REPRESENTATIVE_REVIEW_PLUS_CHALLENGE'
        OR NEW."representationValidUntil" <= observed_at
        OR NEW."representationValidUntil" > NEW."validUntil"
      THEN
        RAISE EXCEPTION 'representative verification evidence is incomplete or stale'
          USING ERRCODE = 'P0500';
      END IF;
    END IF;
  ELSE
    IF prior_kind IS DISTINCT FROM 'VERIFIED' THEN
      RAISE EXCEPTION 'only the current verified event may be revoked'
        USING ERRCODE = 'P0509';
    END IF;
  END IF;

  NEW."occurredAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectVerificationEvent_guard"
BEFORE INSERT ON "DataSubjectRequesterVerificationEvent"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_verification_event_guard"();

CREATE FUNCTION "obrasaas_data_subject_legal_assessment_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  request_status TEXT;
  request_received_at TIMESTAMPTZ(3);
  prior_id TEXT;
  prior_sequence INTEGER;
  manifest_exists BOOLEAN;
  actor_valid BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT, "receivedAt"
       FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status, request_received_at
  USING NEW."organizationId", NEW."requestId";
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  IF request_status NOT IN ('DISCOVERED', 'DISCOVERY_BLOCKED') THEN
    RAISE EXCEPTION 'privacy review request is not discovery-terminal' USING ERRCODE = 'P0509';
  END IF;

  EXECUTE format(
    'SELECT TRUE FROM %I."TenantMembership"
      WHERE "organizationId" = $1 AND "id" = $2
        AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
      FOR SHARE',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."actorMembershipId";
  IF actor_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'privacy legal assessment requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."DataSubjectDiscoveryManifest"
        WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO manifest_exists
  USING NEW."organizationId", NEW."requestId", NEW."manifestId";
  IF NOT manifest_exists THEN
    RAISE EXCEPTION 'privacy discovery manifest not found' USING ERRCODE = 'P0504';
  END IF;

  EXECUTE format(
    'SELECT "id", "sequence"
       FROM %I."DataSubjectLegalAssessmentRevision"
      WHERE "organizationId" = $1 AND "requestId" = $2
      ORDER BY "sequence" DESC LIMIT 1',
    TG_TABLE_SCHEMA
  ) INTO prior_id, prior_sequence
  USING NEW."organizationId", NEW."requestId";
  IF prior_id IS NULL THEN
    IF NEW."sequence" <> 1 OR NEW."predecessorAssessmentId" IS NOT NULL THEN
      RAISE EXCEPTION 'first legal assessment must be sequence one'
        USING ERRCODE = 'P0509';
    END IF;
  ELSIF NEW."sequence" <> prior_sequence + 1
    OR NEW."predecessorAssessmentId" IS DISTINCT FROM prior_id
  THEN
    RAISE EXCEPTION 'privacy legal assessment head is stale' USING ERRCODE = 'P0509';
  END IF;
  IF NEW."deadlineMethod"::TEXT <> 'REVIEWED_EXPLICIT_DATE'
    OR NEW."dueAt" < request_received_at
  THEN
    RAISE EXCEPTION 'reviewed privacy deadline is invalid' USING ERRCODE = 'P0500';
  END IF;

  NEW."assessedAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectLegalAssessment_guard"
BEFORE INSERT ON "DataSubjectLegalAssessmentRevision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_legal_assessment_guard"();

CREATE FUNCTION "obrasaas_data_subject_legal_hold_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  request_status TEXT;
  actor_valid BOOLEAN;
  manifest_exists BOOLEAN;
  category_exists BOOLEAN;
  duplicate_active BOOLEAN;
  active_count INTEGER;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT
       FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status
  USING NEW."organizationId", NEW."requestId";
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  IF request_status NOT IN ('DISCOVERED', 'DISCOVERY_BLOCKED') THEN
    RAISE EXCEPTION 'privacy review request is not discovery-terminal' USING ERRCODE = 'P0509';
  END IF;

  EXECUTE format(
    'SELECT TRUE FROM %I."TenantMembership"
      WHERE "organizationId" = $1 AND "id" = $2
        AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
      FOR SHARE',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."createdByMembershipId";
  IF actor_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'privacy hold requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."DataSubjectDiscoveryManifest"
        WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO manifest_exists
  USING NEW."organizationId", NEW."requestId", NEW."manifestId";
  IF NOT manifest_exists THEN
    RAISE EXCEPTION 'privacy discovery manifest not found' USING ERRCODE = 'P0504';
  END IF;

  IF NEW."scopeKind"::TEXT = 'CATEGORY' THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."DataSubjectDiscoveryItem"
          WHERE "organizationId" = $1 AND "requestId" = $2
            AND "manifestId" = $3 AND "category" = $4
       )',
      TG_TABLE_SCHEMA
    ) INTO category_exists
    USING NEW."organizationId", NEW."requestId", NEW."manifestId", NEW."category";
    IF NOT category_exists THEN
      RAISE EXCEPTION 'privacy hold category is outside the sealed manifest'
        USING ERRCODE = 'P0504';
    END IF;
  END IF;

  EXECUTE format(
    'WITH latest AS (
       SELECT DISTINCT ON (h."id")
              h."id", h."scopeKind"::TEXT AS scope_kind,
              h."discoveryItemId", h."category"::TEXT AS category,
              e."kind"::TEXT AS event_kind
         FROM %I."DataSubjectLegalHold" h
         JOIN %I."DataSubjectLegalHoldEvent" e
           ON e."organizationId" = h."organizationId"
          AND e."requestId" = h."requestId"
          AND e."holdId" = h."id"
        WHERE h."organizationId" = $1 AND h."requestId" = $2
        ORDER BY h."id", e."sequence" DESC
     )
     SELECT COUNT(*) FILTER (WHERE event_kind <> ''RELEASED'')::INTEGER,
            COALESCE(BOOL_OR(
              event_kind <> ''RELEASED''
              AND scope_kind = $3
              AND "discoveryItemId" IS NOT DISTINCT FROM $4
              AND category IS NOT DISTINCT FROM $5
            ), FALSE)
       FROM latest',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  ) INTO active_count, duplicate_active
  USING NEW."organizationId", NEW."requestId", NEW."scopeKind"::TEXT,
        NEW."discoveryItemId", NEW."category"::TEXT;
  IF active_count >= 256 THEN
    RAISE EXCEPTION 'privacy hold active limit reached' USING ERRCODE = 'P0509';
  END IF;
  IF duplicate_active THEN
    RAISE EXCEPTION 'an active privacy hold already owns this exact scope'
      USING ERRCODE = 'P0509';
  END IF;

  NEW."createdAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectLegalHold_guard"
BEFORE INSERT ON "DataSubjectLegalHold"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_legal_hold_guard"();

CREATE FUNCTION "obrasaas_data_subject_legal_hold_event_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  request_status TEXT;
  hold_creator_id TEXT;
  prior_id TEXT;
  prior_sequence INTEGER;
  prior_kind TEXT;
  actor_valid BOOLEAN;
  owner_valid BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT
       FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status
  USING NEW."organizationId", NEW."requestId";
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;

  EXECUTE format(
    'SELECT "createdByMembershipId"
       FROM %I."DataSubjectLegalHold"
      WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3
      FOR SHARE',
    TG_TABLE_SCHEMA
  ) INTO hold_creator_id
  USING NEW."organizationId", NEW."requestId", NEW."holdId";
  IF hold_creator_id IS NULL THEN
    RAISE EXCEPTION 'privacy hold not found' USING ERRCODE = 'P0504';
  END IF;

  EXECUTE format(
    'SELECT TRUE FROM %I."TenantMembership"
      WHERE "organizationId" = $1 AND "id" = $2
        AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
      FOR SHARE',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."actorMembershipId";
  IF actor_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'privacy hold event requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;

  EXECUTE format(
    'SELECT "id", "sequence", "kind"::TEXT
       FROM %I."DataSubjectLegalHoldEvent"
      WHERE "organizationId" = $1 AND "requestId" = $2 AND "holdId" = $3
      ORDER BY "sequence" DESC LIMIT 1',
    TG_TABLE_SCHEMA
  ) INTO prior_id, prior_sequence, prior_kind
  USING NEW."organizationId", NEW."requestId", NEW."holdId";

  IF prior_id IS NULL THEN
    IF NEW."kind"::TEXT <> 'CREATED'
      OR NEW."sequence" <> 1
      OR NEW."predecessorEventId" IS NOT NULL
      OR NEW."actorMembershipId" IS DISTINCT FROM hold_creator_id
    THEN
      RAISE EXCEPTION 'privacy hold must begin with its creator event'
        USING ERRCODE = 'P0509';
    END IF;
  ELSE
    IF NEW."sequence" <> prior_sequence + 1
      OR NEW."predecessorEventId" IS DISTINCT FROM prior_id
    THEN
      RAISE EXCEPTION 'privacy hold event head is stale' USING ERRCODE = 'P0509';
    END IF;
    IF prior_kind = 'RELEASED' OR NEW."kind"::TEXT = 'CREATED' THEN
      RAISE EXCEPTION 'released privacy hold is terminal' USING ERRCODE = 'P0509';
    END IF;
  END IF;

  IF NEW."kind"::TEXT IN ('CREATED', 'REVIEWED') THEN
    IF NEW."ownerMembershipId" IS DISTINCT FROM NEW."actorMembershipId" THEN
      RAISE EXCEPTION 'privacy hold owner must be the authenticated reviewing administrator'
        USING ERRCODE = 'P0503';
    END IF;
    EXECUTE format(
      'SELECT TRUE FROM %I."TenantMembership"
        WHERE "organizationId" = $1 AND "id" = $2
          AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
        FOR SHARE',
      TG_TABLE_SCHEMA
    ) INTO owner_valid
    USING NEW."organizationId", NEW."ownerMembershipId";
    IF owner_valid IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'privacy hold owner is not an active tenant administrator'
        USING ERRCODE = 'P0503';
    END IF;
    IF NEW."reviewDueAt" <= observed_at
      OR NEW."reviewDueAt" > observed_at + INTERVAL '90 days'
    THEN
      RAISE EXCEPTION 'privacy hold review date is outside the bounded policy'
        USING ERRCODE = 'P0500';
    END IF;
  ELSE
    IF NEW."actorMembershipId" = hold_creator_id THEN
      RAISE EXCEPTION 'privacy hold release requires a different administrator'
        USING ERRCODE = 'P0509';
    END IF;
  END IF;

  NEW."occurredAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectLegalHoldEvent_guard"
BEFORE INSERT ON "DataSubjectLegalHoldEvent"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_legal_hold_event_guard"();

CREATE FUNCTION "obrasaas_data_subject_legal_hold_initial_event_check"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  initial_count INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*)::INTEGER
       FROM %I."DataSubjectLegalHoldEvent"
      WHERE "organizationId" = $1 AND "requestId" = $2 AND "holdId" = $3
        AND "sequence" = 1 AND "kind" = ''CREATED''',
    TG_TABLE_SCHEMA
  ) INTO initial_count
  USING NEW."organizationId", NEW."requestId", NEW."id";
  IF initial_count <> 1 THEN
    RAISE EXCEPTION 'privacy hold lacks one initial CREATED event'
      USING ERRCODE = '55000';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "DataSubjectLegalHold_initial_event_check"
AFTER INSERT ON "DataSubjectLegalHold"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_legal_hold_initial_event_check"();

CREATE FUNCTION "obrasaas_data_subject_hold_set_sha256"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_manifest_id TEXT
)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = pg_catalog, public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (h."id")
           h."id", h."scopeKind"::TEXT AS scope_kind,
           h."discoveryItemId", h."category"::TEXT AS category,
           e."id" AS event_id, e."sequence", e."kind"::TEXT AS event_kind,
           e."basisCode", e."policyVersion", e."evidenceSha256"::TEXT AS evidence_sha256,
           e."ownerMembershipId", e."reviewDueAt"
      FROM "DataSubjectLegalHold" h
      JOIN "DataSubjectLegalHoldEvent" e
        ON e."organizationId" = h."organizationId"
       AND e."requestId" = h."requestId"
       AND e."holdId" = h."id"
     WHERE h."organizationId" = p_organization_id
       AND h."requestId" = p_request_id
       AND h."manifestId" = p_manifest_id
     ORDER BY h."id", e."sequence" DESC
  ), active AS (
    SELECT * FROM latest WHERE event_kind <> 'RELEASED'
  )
  SELECT encode(
    sha256(convert_to(
      'obrasaas:data-subject-active-holds:v1|'
      || octet_length(p_organization_id)::TEXT || ':' || p_organization_id || '|'
      || octet_length(p_request_id)::TEXT || ':' || p_request_id || '|'
      || octet_length(p_manifest_id)::TEXT || ':' || p_manifest_id || '|'
      || COALESCE(string_agg(
        octet_length("id")::TEXT || ':' || "id" || ','
        || octet_length(scope_kind)::TEXT || ':' || scope_kind || ','
        || octet_length(COALESCE("discoveryItemId", ''))::TEXT || ':' || COALESCE("discoveryItemId", '') || ','
        || octet_length(COALESCE(category, ''))::TEXT || ':' || COALESCE(category, '') || ','
        || octet_length(event_id)::TEXT || ':' || event_id || ','
        || sequence::TEXT || ','
        || octet_length(event_kind)::TEXT || ':' || event_kind || ','
        || octet_length(COALESCE("basisCode", ''))::TEXT || ':' || COALESCE("basisCode", '') || ','
        || octet_length(COALESCE("policyVersion", ''))::TEXT || ':' || COALESCE("policyVersion", '') || ','
        || octet_length(COALESCE(evidence_sha256, ''))::TEXT || ':' || COALESCE(evidence_sha256, '') || ','
        || octet_length(COALESCE("ownerMembershipId", ''))::TEXT || ':' || COALESCE("ownerMembershipId", '') || ','
        || COALESCE(to_char("reviewDueAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '')
      , '|' ORDER BY "id"), ''),
      'UTF8'
    )),
    'hex'
  )
  FROM active;
$$;

CREATE FUNCTION "obrasaas_data_subject_decision_set_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  request_status TEXT;
  worker_person_id TEXT;
  actor_valid BOOLEAN;
  manifest_exists BOOLEAN;
  prior_id TEXT;
  prior_revision INTEGER;
  verification_head_id TEXT;
  verification_kind TEXT;
  verification_valid_until TIMESTAMPTZ(3);
  verification_representation_until TIMESTAMPTZ(3);
  verification_requester_kind TEXT;
  verification_identity_record_version INTEGER;
  verification_identity_evidence_sha256 TEXT;
  worker_identity_status TEXT;
  worker_identity_record_version INTEGER;
  worker_identity_evidence_sha256 TEXT;
  assessment_head_id TEXT;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT, "workerPersonId"
       FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_status, worker_person_id
  USING NEW."organizationId", NEW."requestId";
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  IF request_status NOT IN ('DISCOVERED', 'DISCOVERY_BLOCKED') THEN
    RAISE EXCEPTION 'privacy review request is not discovery-terminal' USING ERRCODE = 'P0509';
  END IF;

  EXECUTE format(
    'SELECT TRUE FROM %I."TenantMembership"
      WHERE "organizationId" = $1 AND "id" = $2
        AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
      FOR SHARE',
    TG_TABLE_SCHEMA
  ) INTO actor_valid
  USING NEW."organizationId", NEW."preparedByMembershipId";
  IF actor_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'privacy decision requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."DataSubjectDiscoveryManifest"
        WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO manifest_exists
  USING NEW."organizationId", NEW."requestId", NEW."manifestId";
  IF NOT manifest_exists THEN
    RAISE EXCEPTION 'privacy discovery manifest not found' USING ERRCODE = 'P0504';
  END IF;

  EXECUTE format(
    'SELECT "id", "revision"
       FROM %I."DataSubjectDecisionSet"
      WHERE "organizationId" = $1 AND "requestId" = $2
      ORDER BY "revision" DESC LIMIT 1',
    TG_TABLE_SCHEMA
  ) INTO prior_id, prior_revision
  USING NEW."organizationId", NEW."requestId";
  IF prior_id IS NULL THEN
    IF NEW."revision" <> 1 OR NEW."predecessorDecisionId" IS NOT NULL THEN
      RAISE EXCEPTION 'first privacy decision must be revision one'
        USING ERRCODE = 'P0509';
    END IF;
  ELSIF NEW."revision" <> prior_revision + 1
    OR NEW."predecessorDecisionId" IS DISTINCT FROM prior_id
  THEN
    RAISE EXCEPTION 'privacy decision head is stale' USING ERRCODE = 'P0509';
  END IF;

  EXECUTE format(
    'SELECT "id", "kind"::TEXT, "validUntil", "representationValidUntil",
            "requesterKind"::TEXT, "subjectIdentityRecordVersion",
            "identityEvidenceSha256"::TEXT
       FROM %I."DataSubjectRequesterVerificationEvent"
      WHERE "organizationId" = $1 AND "requestId" = $2
      ORDER BY "sequence" DESC LIMIT 1',
    TG_TABLE_SCHEMA
  ) INTO verification_head_id, verification_kind, verification_valid_until,
         verification_representation_until, verification_requester_kind,
         verification_identity_record_version, verification_identity_evidence_sha256
  USING NEW."organizationId", NEW."requestId";
  IF verification_head_id IS DISTINCT FROM NEW."verificationEventId"
    OR verification_kind IS DISTINCT FROM 'VERIFIED'
    OR verification_valid_until <= observed_at
    OR (verification_representation_until IS NOT NULL AND verification_representation_until <= observed_at)
  THEN
    RAISE EXCEPTION 'current requester verification is missing, stale or expired'
      USING ERRCODE = 'P0509';
  END IF;
  IF verification_requester_kind = 'SELF' THEN
    EXECUTE format(
      'SELECT "identityStatus"::TEXT, "recordVersion", "identityDecisionEvidenceHash"::TEXT
         FROM %I."WorkerPerson"
        WHERE "organizationId" = $1 AND "id" = $2
        FOR SHARE',
      TG_TABLE_SCHEMA
    ) INTO worker_identity_status, worker_identity_record_version,
           worker_identity_evidence_sha256
    USING NEW."organizationId", worker_person_id;
    IF worker_identity_status IS DISTINCT FROM 'VERIFIED'
      OR worker_identity_record_version IS DISTINCT FROM verification_identity_record_version
      OR worker_identity_evidence_sha256 IS DISTINCT FROM verification_identity_evidence_sha256
    THEN
      RAISE EXCEPTION 'self requester identity changed after verification'
        USING ERRCODE = 'P0509';
    END IF;
  END IF;

  EXECUTE format(
    'SELECT "id"
       FROM %I."DataSubjectLegalAssessmentRevision"
      WHERE "organizationId" = $1 AND "requestId" = $2
      ORDER BY "sequence" DESC LIMIT 1',
    TG_TABLE_SCHEMA
  ) INTO assessment_head_id
  USING NEW."organizationId", NEW."requestId";
  IF assessment_head_id IS DISTINCT FROM NEW."legalAssessmentId" THEN
    RAISE EXCEPTION 'current legal assessment is missing or stale'
      USING ERRCODE = 'P0509';
  END IF;

  IF NEW."status"::TEXT <> 'DRAFTING' THEN
    RAISE EXCEPTION 'privacy decision must begin in transient DRAFTING state'
      USING ERRCODE = '55000';
  END IF;
  NEW."preparedAt" := observed_at;
  NEW."createdAt" := observed_at;
  NEW."updatedAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectDecisionSet_insert_guard"
BEFORE INSERT ON "DataSubjectDecisionSet"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_set_insert_guard"();

CREATE FUNCTION "obrasaas_data_subject_decision_item_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  decision_status TEXT;
  request_type TEXT;
  source_kind TEXT;
  source_ordinal INTEGER;
  allowed_action BOOLEAN := FALSE;
BEGIN
  EXECUTE format(
    'SELECT d."status"::TEXT, r."type"::TEXT
       FROM %I."DataSubjectDecisionSet" d
       JOIN %I."DataSubjectRequest" r
         ON r."organizationId" = d."organizationId" AND r."id" = d."requestId"
      WHERE d."organizationId" = $1 AND d."requestId" = $2
        AND d."manifestId" = $3 AND d."id" = $4
      FOR SHARE OF d',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  ) INTO decision_status, request_type
  USING NEW."organizationId", NEW."requestId", NEW."manifestId", NEW."decisionSetId";
  IF decision_status IS NULL THEN
    RAISE EXCEPTION 'privacy decision draft not found' USING ERRCODE = 'P0504';
  END IF;
  IF decision_status <> 'DRAFTING' THEN
    RAISE EXCEPTION 'privacy decision items are immutable after preparation'
      USING ERRCODE = 'P0509';
  END IF;

  EXECUTE format(
    'SELECT "kind"::TEXT, "ordinal"
       FROM %I."DataSubjectDiscoveryItem"
      WHERE "organizationId" = $1 AND "requestId" = $2
        AND "manifestId" = $3 AND "id" = $4',
    TG_TABLE_SCHEMA
  ) INTO source_kind, source_ordinal
  USING NEW."organizationId", NEW."requestId", NEW."manifestId", NEW."discoveryItemId";
  IF source_kind IS NULL THEN
    RAISE EXCEPTION 'privacy discovery item not found' USING ERRCODE = 'P0504';
  END IF;

  NEW."ordinal" := source_ordinal;
  IF source_kind = 'COVERAGE_BLOCKER' THEN
    IF NEW."action"::TEXT <> 'UNRESOLVED'
      OR num_nonnulls(
        NEW."legalBasisCode",
        NEW."retentionPolicyVersion",
        NEW."retentionRuleCode",
        NEW."retentionUntil"
      ) <> 0
    THEN
      RAISE EXCEPTION 'coverage blockers must remain exactly UNRESOLVED'
        USING ERRCODE = 'P0500';
    END IF;
  ELSE
    IF NEW."action"::TEXT = 'UNRESOLVED'
      OR NEW."legalBasisCode" IS NULL
      OR NEW."retentionPolicyVersion" IS NULL
      OR NEW."retentionRuleCode" IS NULL
    THEN
      RAISE EXCEPTION 'record decisions require a proposed action and policy codes'
        USING ERRCODE = 'P0500';
    END IF;

    allowed_action := NEW."action"::TEXT IN (
      'KEEP_WITH_BASIS', 'WITHHOLD_WITH_BASIS', 'NO_CHANGE_WITH_BASIS'
    ) OR (request_type = 'ACCESS' AND NEW."action"::TEXT = 'DISCLOSE_CANDIDATE')
      OR (request_type = 'CORRECTION' AND NEW."action"::TEXT IN ('CORRECT_CANDIDATE', 'RESTRICT_CANDIDATE'))
      OR (request_type = 'ERASURE' AND NEW."action"::TEXT IN ('ERASE_CANDIDATE', 'CRYPTO_ERASE_CANDIDATE', 'PSEUDONYMIZE_CANDIDATE', 'RESTRICT_CANDIDATE'))
      OR (request_type = 'RESTRICTION' AND NEW."action"::TEXT = 'RESTRICT_CANDIDATE')
      OR (request_type = 'PORTABILITY' AND NEW."action"::TEXT IN ('PORTABILITY_CANDIDATE', 'DISCLOSE_CANDIDATE'))
      OR (request_type = 'OBJECTION' AND NEW."action"::TEXT IN ('RESTRICT_CANDIDATE', 'PSEUDONYMIZE_CANDIDATE'));
    IF NOT allowed_action THEN
      RAISE EXCEPTION 'proposed action is outside the request-type vocabulary'
        USING ERRCODE = 'P0500';
    END IF;
  END IF;

  NEW."createdAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectDecisionItem_guard"
BEFORE INSERT ON "DataSubjectDecisionItem"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_item_guard"();

CREATE FUNCTION "obrasaas_data_subject_decision_set_lifecycle_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMPTZ(3) := statement_timestamp();
  actor_valid BOOLEAN;
  request_worker_person_id TEXT;
  verification_head_id TEXT;
  verification_kind TEXT;
  verification_valid_until TIMESTAMPTZ(3);
  verification_representation_until TIMESTAMPTZ(3);
  verification_requester_kind TEXT;
  verification_identity_record_version INTEGER;
  verification_identity_evidence_sha256 TEXT;
  worker_identity_status TEXT;
  worker_identity_record_version INTEGER;
  worker_identity_evidence_sha256 TEXT;
  assessment_head_id TEXT;
  manifest_sha256 TEXT;
  expected_item_count INTEGER;
  expected_unresolved_count INTEGER;
  actual_item_count INTEGER;
  actual_unresolved_count INTEGER;
  current_hold_set_sha256 TEXT;
  current_active_hold_count INTEGER;
  calculated_decision_sha256 TEXT;
BEGIN
  IF OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."requestId" IS DISTINCT FROM NEW."requestId"
    OR OLD."manifestId" IS DISTINCT FROM NEW."manifestId"
    OR OLD."revision" IS DISTINCT FROM NEW."revision"
    OR OLD."predecessorDecisionId" IS DISTINCT FROM NEW."predecessorDecisionId"
    OR OLD."schemaVersion" IS DISTINCT FROM NEW."schemaVersion"
    OR OLD."verificationEventId" IS DISTINCT FROM NEW."verificationEventId"
    OR OLD."legalAssessmentId" IS DISTINCT FROM NEW."legalAssessmentId"
    OR OLD."preparedByMembershipId" IS DISTINCT FROM NEW."preparedByMembershipId"
    OR OLD."operationKeyHash" IS DISTINCT FROM NEW."operationKeyHash"
    OR OLD."requestFingerprint" IS DISTINCT FROM NEW."requestFingerprint"
    OR OLD."fingerprintKeyId" IS DISTINCT FROM NEW."fingerprintKeyId"
    OR OLD."preparedAt" IS DISTINCT FROM NEW."preparedAt"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
    OR (
      OLD."status"::TEXT <> 'DRAFTING'
      AND (
        OLD."manifestSha256" IS DISTINCT FROM NEW."manifestSha256"
        OR OLD."holdSetSha256" IS DISTINCT FROM NEW."holdSetSha256"
        OR OLD."itemCount" IS DISTINCT FROM NEW."itemCount"
        OR OLD."unresolvedCount" IS DISTINCT FROM NEW."unresolvedCount"
        OR OLD."activeHoldCount" IS DISTINCT FROM NEW."activeHoldCount"
        OR OLD."decisionSha256" IS DISTINCT FROM NEW."decisionSha256"
        OR OLD."pendingAt" IS DISTINCT FROM NEW."pendingAt"
      )
    )
  THEN
    RAISE EXCEPTION 'privacy decision immutable fields changed' USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    'SELECT "workerPersonId" FROM %I."DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2
      FOR UPDATE',
    TG_TABLE_SCHEMA
  ) INTO request_worker_person_id
  USING NEW."organizationId", NEW."requestId";

  IF OLD."status"::TEXT = 'DRAFTING' AND NEW."status"::TEXT = 'PENDING_APPROVAL' THEN
    EXECUTE format(
      'SELECT TRUE FROM %I."TenantMembership"
        WHERE "organizationId" = $1 AND "id" = $2
          AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
        FOR SHARE',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."preparedByMembershipId";
    IF actor_valid IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'privacy decision preparer is no longer active'
        USING ERRCODE = 'P0503';
    END IF;

    EXECUTE format(
      'SELECT "id", "kind"::TEXT, "validUntil", "representationValidUntil",
              "requesterKind"::TEXT, "subjectIdentityRecordVersion",
              "identityEvidenceSha256"::TEXT
         FROM %I."DataSubjectRequesterVerificationEvent"
        WHERE "organizationId" = $1 AND "requestId" = $2
        ORDER BY "sequence" DESC LIMIT 1',
      TG_TABLE_SCHEMA
    ) INTO verification_head_id, verification_kind, verification_valid_until,
           verification_representation_until, verification_requester_kind,
           verification_identity_record_version, verification_identity_evidence_sha256
    USING NEW."organizationId", NEW."requestId";
    EXECUTE format(
      'SELECT "id"
         FROM %I."DataSubjectLegalAssessmentRevision"
        WHERE "organizationId" = $1 AND "requestId" = $2
        ORDER BY "sequence" DESC LIMIT 1',
      TG_TABLE_SCHEMA
    ) INTO assessment_head_id
    USING NEW."organizationId", NEW."requestId";
    IF verification_head_id IS DISTINCT FROM NEW."verificationEventId"
      OR verification_kind IS DISTINCT FROM 'VERIFIED'
      OR verification_valid_until <= observed_at
      OR (verification_representation_until IS NOT NULL AND verification_representation_until <= observed_at)
      OR assessment_head_id IS DISTINCT FROM NEW."legalAssessmentId"
    THEN
      RAISE EXCEPTION 'privacy decision dependencies are stale'
        USING ERRCODE = 'P0509';
    END IF;
    IF verification_requester_kind = 'SELF' THEN
      EXECUTE format(
        'SELECT "identityStatus"::TEXT, "recordVersion", "identityDecisionEvidenceHash"::TEXT
           FROM %I."WorkerPerson"
          WHERE "organizationId" = $1 AND "id" = $2
          FOR SHARE',
        TG_TABLE_SCHEMA
      ) INTO worker_identity_status, worker_identity_record_version,
             worker_identity_evidence_sha256
      USING NEW."organizationId", request_worker_person_id;
      IF worker_identity_status IS DISTINCT FROM 'VERIFIED'
        OR worker_identity_record_version IS DISTINCT FROM verification_identity_record_version
        OR worker_identity_evidence_sha256 IS DISTINCT FROM verification_identity_evidence_sha256
      THEN
        RAISE EXCEPTION 'self requester identity changed after verification'
          USING ERRCODE = 'P0509';
      END IF;
    END IF;

    EXECUTE format(
      'SELECT m."manifestSha256"::TEXT, m."itemCount",
              (SELECT COUNT(*)::INTEGER
                 FROM %I."DataSubjectDiscoveryItem" source_item
                WHERE source_item."organizationId" = m."organizationId"
                  AND source_item."requestId" = m."requestId"
                  AND source_item."manifestId" = m."id"
                  AND source_item."kind" = ''COVERAGE_BLOCKER''),
              COUNT(i."id")::INTEGER,
              COUNT(*) FILTER (WHERE i."action" = ''UNRESOLVED'')::INTEGER
         FROM %I."DataSubjectDiscoveryManifest" m
         LEFT JOIN %I."DataSubjectDecisionItem" i
           ON i."organizationId" = m."organizationId"
          AND i."requestId" = m."requestId"
          AND i."manifestId" = m."id"
          AND i."decisionSetId" = $4
        WHERE m."organizationId" = $1 AND m."requestId" = $2 AND m."id" = $3
        GROUP BY m."manifestSha256", m."itemCount", m."organizationId", m."requestId", m."id"',
      TG_TABLE_SCHEMA,
      TG_TABLE_SCHEMA,
      TG_TABLE_SCHEMA
    ) INTO manifest_sha256, expected_item_count, expected_unresolved_count,
           actual_item_count, actual_unresolved_count
    USING NEW."organizationId", NEW."requestId", NEW."manifestId", NEW."id";
    IF manifest_sha256 IS NULL
      OR expected_item_count NOT BETWEEN 1 AND 1024
      OR actual_item_count <> expected_item_count
      OR actual_unresolved_count <> expected_unresolved_count
    THEN
      RAISE EXCEPTION 'privacy decision does not cover the exact sealed manifest'
        USING ERRCODE = 'P0509';
    END IF;

    EXECUTE format(
      'WITH latest AS (
         SELECT DISTINCT ON (h."id") h."id", e."kind"::TEXT AS event_kind
           FROM %I."DataSubjectLegalHold" h
           JOIN %I."DataSubjectLegalHoldEvent" e
             ON e."organizationId" = h."organizationId"
            AND e."requestId" = h."requestId" AND e."holdId" = h."id"
          WHERE h."organizationId" = $1 AND h."requestId" = $2 AND h."manifestId" = $3
          ORDER BY h."id", e."sequence" DESC
       ) SELECT COUNT(*) FILTER (WHERE event_kind <> ''RELEASED'')::INTEGER FROM latest',
      TG_TABLE_SCHEMA,
      TG_TABLE_SCHEMA
    ) INTO current_active_hold_count
    USING NEW."organizationId", NEW."requestId", NEW."manifestId";
    current_hold_set_sha256 := public."obrasaas_data_subject_hold_set_sha256"(
      NEW."organizationId", NEW."requestId", NEW."manifestId"
    );

    NEW."manifestSha256" := manifest_sha256;
    NEW."holdSetSha256" := current_hold_set_sha256;
    NEW."itemCount" := actual_item_count;
    NEW."unresolvedCount" := actual_unresolved_count;
    NEW."activeHoldCount" := COALESCE(current_active_hold_count, 0);
    NEW."pendingAt" := observed_at;

    EXECUTE format(
      'SELECT encode(sha256(convert_to(
         ''obrasaas:data-subject-decision:v1|''
         || octet_length($1)::TEXT || '':'' || $1 || ''|''
         || octet_length($2)::TEXT || '':'' || $2 || ''|''
         || octet_length($3)::TEXT || '':'' || $3 || ''|''
         || $4::TEXT || ''|''
         || octet_length(COALESCE($5, ''''))::TEXT || '':'' || COALESCE($5, '''') || ''|''
         || octet_length($6)::TEXT || '':'' || $6 || ''|''
         || octet_length($7)::TEXT || '':'' || $7 || ''|''
         || octet_length($8)::TEXT || '':'' || $8 || ''|''
         || octet_length($9)::TEXT || '':'' || $9 || ''|''
         || COALESCE(string_agg(
              i."ordinal"::TEXT || '',''
              || octet_length(i."discoveryItemId")::TEXT || '':'' || i."discoveryItemId" || '',''
              || octet_length(i."action"::TEXT)::TEXT || '':'' || i."action"::TEXT || '',''
              || octet_length(COALESCE(i."legalBasisCode", ''''))::TEXT || '':'' || COALESCE(i."legalBasisCode", '''') || '',''
              || octet_length(COALESCE(i."retentionPolicyVersion", ''''))::TEXT || '':'' || COALESCE(i."retentionPolicyVersion", '''') || '',''
              || octet_length(COALESCE(i."retentionRuleCode", ''''))::TEXT || '':'' || COALESCE(i."retentionRuleCode", '''') || '',''
              || COALESCE(to_char(i."retentionUntil" AT TIME ZONE ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"''), '''')
            , ''|'' ORDER BY i."ordinal", i."discoveryItemId"), ''''),
         ''UTF8'')), ''hex'')
         FROM %I."DataSubjectDecisionItem" i
        WHERE i."organizationId" = $1 AND i."requestId" = $2
          AND i."manifestId" = $3 AND i."decisionSetId" = $10',
      TG_TABLE_SCHEMA
    ) INTO calculated_decision_sha256
    USING NEW."organizationId", NEW."requestId", NEW."manifestId", NEW."revision",
          NEW."predecessorDecisionId", NEW."verificationEventId", NEW."legalAssessmentId",
          NEW."manifestSha256"::TEXT, NEW."holdSetSha256"::TEXT, NEW."id";
    NEW."decisionSha256" := calculated_decision_sha256;

  ELSIF OLD."status"::TEXT = 'PENDING_APPROVAL'
    AND NEW."status"::TEXT IN ('SEALED_BLOCKED', 'REJECTED')
  THEN
    EXECUTE format(
      'SELECT TRUE FROM %I."TenantMembership"
        WHERE "organizationId" = $1 AND "id" = $2
          AND "status" = ''ACTIVE'' AND "tenantRole" = ''ADMIN''
        FOR SHARE',
      TG_TABLE_SCHEMA
    ) INTO actor_valid
    USING NEW."organizationId", NEW."decidedByMembershipId";
    IF actor_valid IS DISTINCT FROM TRUE
      OR NEW."decidedByMembershipId" = NEW."preparedByMembershipId"
    THEN
      RAISE EXCEPTION 'privacy decision requires a different active administrator'
        USING ERRCODE = 'P0509';
    END IF;
    IF NEW."decisionOperationKeyHash" IS NULL
      OR NEW."decisionRequestFingerprint" IS NULL
      OR NEW."decisionFingerprintKeyId" IS NULL
    THEN
      RAISE EXCEPTION 'privacy decision checker evidence is incomplete'
        USING ERRCODE = 'P0500';
    END IF;

    IF NEW."status"::TEXT = 'SEALED_BLOCKED' THEN
      IF NEW."decisionReasonCode" IS NOT NULL THEN
        RAISE EXCEPTION 'approved blocked decision cannot carry a rejection reason'
          USING ERRCODE = 'P0500';
      END IF;
      EXECUTE format(
        'SELECT "id", "kind"::TEXT, "validUntil", "representationValidUntil",
                "requesterKind"::TEXT, "subjectIdentityRecordVersion",
                "identityEvidenceSha256"::TEXT
           FROM %I."DataSubjectRequesterVerificationEvent"
          WHERE "organizationId" = $1 AND "requestId" = $2
          ORDER BY "sequence" DESC LIMIT 1',
        TG_TABLE_SCHEMA
      ) INTO verification_head_id, verification_kind, verification_valid_until,
             verification_representation_until, verification_requester_kind,
             verification_identity_record_version, verification_identity_evidence_sha256
      USING NEW."organizationId", NEW."requestId";
      EXECUTE format(
        'SELECT "id" FROM %I."DataSubjectLegalAssessmentRevision"
          WHERE "organizationId" = $1 AND "requestId" = $2
          ORDER BY "sequence" DESC LIMIT 1',
        TG_TABLE_SCHEMA
      ) INTO assessment_head_id
      USING NEW."organizationId", NEW."requestId";
      current_hold_set_sha256 := public."obrasaas_data_subject_hold_set_sha256"(
        NEW."organizationId", NEW."requestId", NEW."manifestId"
      );
      IF verification_head_id IS DISTINCT FROM NEW."verificationEventId"
        OR verification_kind IS DISTINCT FROM 'VERIFIED'
        OR verification_valid_until <= observed_at
        OR (verification_representation_until IS NOT NULL AND verification_representation_until <= observed_at)
        OR assessment_head_id IS DISTINCT FROM NEW."legalAssessmentId"
        OR current_hold_set_sha256 IS DISTINCT FROM NEW."holdSetSha256"::TEXT
      THEN
        RAISE EXCEPTION 'privacy decision dependencies changed before approval'
          USING ERRCODE = 'P0509';
      END IF;
      IF verification_requester_kind = 'SELF' THEN
        EXECUTE format(
          'SELECT "identityStatus"::TEXT, "recordVersion", "identityDecisionEvidenceHash"::TEXT
             FROM %I."WorkerPerson"
            WHERE "organizationId" = $1 AND "id" = $2
            FOR SHARE',
          TG_TABLE_SCHEMA
        ) INTO worker_identity_status, worker_identity_record_version,
               worker_identity_evidence_sha256
        USING NEW."organizationId", request_worker_person_id;
        IF worker_identity_status IS DISTINCT FROM 'VERIFIED'
          OR worker_identity_record_version IS DISTINCT FROM verification_identity_record_version
          OR worker_identity_evidence_sha256 IS DISTINCT FROM verification_identity_evidence_sha256
        THEN
          RAISE EXCEPTION 'self requester identity changed after verification'
            USING ERRCODE = 'P0509';
        END IF;
      END IF;
    ELSE
      IF NEW."decisionReasonCode" IS NULL THEN
        RAISE EXCEPTION 'rejected privacy decision requires a reason code'
          USING ERRCODE = 'P0500';
      END IF;
    END IF;
    NEW."decidedAt" := observed_at;
  ELSE
    RAISE EXCEPTION 'privacy decision transition is not allowed' USING ERRCODE = '55000';
  END IF;

  NEW."updatedAt" := observed_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DataSubjectDecisionSet_lifecycle_guard"
BEFORE UPDATE ON "DataSubjectDecisionSet"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_set_lifecycle_guard"();

CREATE FUNCTION "obrasaas_data_subject_decision_terminal_check"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  current_status TEXT;
BEGIN
  EXECUTE format(
    'SELECT "status"::TEXT FROM %I."DataSubjectDecisionSet"
      WHERE "organizationId" = $1 AND "requestId" = $2 AND "id" = $3',
    TG_TABLE_SCHEMA
  ) INTO current_status
  USING NEW."organizationId", NEW."requestId", NEW."id";
  IF current_status = 'DRAFTING' THEN
    RAISE EXCEPTION 'transient privacy decision draft cannot reach commit'
      USING ERRCODE = '55000';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "DataSubjectDecisionSet_terminal_check"
AFTER INSERT OR UPDATE ON "DataSubjectDecisionSet"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_terminal_check"();

CREATE FUNCTION "obrasaas_data_subject_verification_event_append"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_actor_membership_id TEXT,
  p_operation_key_hash TEXT,
  p_request_fingerprint TEXT,
  p_fingerprint_key_id TEXT,
  p_event_kind TEXT,
  p_expected_head_event_id TEXT,
  p_requester_kind TEXT,
  p_assurance_level TEXT,
  p_verification_method_code TEXT,
  p_verification_policy_version TEXT,
  p_requester_fingerprint_hmac TEXT,
  p_identity_evidence_sha256 TEXT,
  p_challenge_evidence_sha256 TEXT,
  p_subject_identity_record_version INTEGER,
  p_representation_method_code TEXT,
  p_representation_evidence_sha256 TEXT,
  p_valid_until TIMESTAMPTZ,
  p_representation_valid_until TIMESTAMPTZ,
  p_revocation_reason_code TEXT
)
RETURNS TABLE(
  event_id TEXT,
  sequence INTEGER,
  event_kind TEXT,
  replayed BOOLEAN,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_status TEXT;
  v_worker_person_id TEXT;
  v_worker_identity_status TEXT;
  v_worker_record_version INTEGER;
  v_worker_evidence_sha256 TEXT;
  v_existing_id TEXT;
  v_existing_request_id TEXT;
  v_existing_sequence INTEGER;
  v_existing_kind TEXT;
  v_existing_fingerprint TEXT;
  v_existing_key_id TEXT;
  v_existing_occurred_at TIMESTAMPTZ;
  v_head_id TEXT;
  v_head_sequence INTEGER;
  v_new_id TEXT := gen_random_uuid()::TEXT;
BEGIN
  SELECT r."status"::TEXT, r."workerPersonId"
    INTO v_request_status, v_worker_person_id
    FROM "DataSubjectRequest" r
   WHERE r."organizationId" = p_organization_id AND r."id" = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  PERFORM 1
    FROM "TenantMembership" m
   WHERE m."organizationId" = p_organization_id
     AND m."id" = p_actor_membership_id
     AND m."status" = 'ACTIVE' AND m."tenantRole" = 'ADMIN'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;
  IF p_event_kind IS NULL OR p_event_kind NOT IN ('VERIFIED', 'REVOKED')
    OR p_operation_key_hash !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_fingerprint_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  THEN
    RAISE EXCEPTION 'privacy verification request is malformed' USING ERRCODE = 'P0500';
  END IF;

  SELECT e."id", e."requestId", e."sequence", e."kind"::TEXT,
         e."requestFingerprint"::TEXT, e."fingerprintKeyId", e."occurredAt"
    INTO v_existing_id, v_existing_request_id, v_existing_sequence, v_existing_kind,
         v_existing_fingerprint, v_existing_key_id, v_existing_occurred_at
    FROM "DataSubjectRequesterVerificationEvent" e
   WHERE e."organizationId" = p_organization_id
     AND e."operationKeyHash" = p_operation_key_hash;
  IF FOUND THEN
    IF v_existing_request_id IS DISTINCT FROM p_request_id
      OR v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing_key_id IS DISTINCT FROM p_fingerprint_key_id
    THEN
      RAISE EXCEPTION 'privacy verification idempotency conflict' USING ERRCODE = 'P0509';
    END IF;
    RETURN QUERY SELECT v_existing_id, v_existing_sequence, v_existing_kind,
                        TRUE, v_existing_occurred_at;
    RETURN;
  END IF;

  SELECT e."id", e."sequence"
    INTO v_head_id, v_head_sequence
    FROM "DataSubjectRequesterVerificationEvent" e
   WHERE e."organizationId" = p_organization_id AND e."requestId" = p_request_id
   ORDER BY e."sequence" DESC
   LIMIT 1;
  IF v_head_id IS DISTINCT FROM p_expected_head_event_id THEN
    RAISE EXCEPTION 'privacy verification head is stale' USING ERRCODE = 'P0509';
  END IF;

  IF p_event_kind = 'VERIFIED' THEN
    IF p_requester_kind IS NULL OR p_requester_kind NOT IN ('SELF', 'REPRESENTATIVE')
      OR p_assurance_level IS DISTINCT FROM 'SUBSTANTIAL'
    THEN
      RAISE EXCEPTION 'privacy requester assurance is invalid' USING ERRCODE = 'P0500';
    END IF;
    IF p_requester_kind = 'SELF' THEN
      IF p_subject_identity_record_version IS NULL OR p_subject_identity_record_version < 1
        OR v_worker_person_id IS NULL
      THEN
        RAISE EXCEPTION 'self requester identity revision is invalid' USING ERRCODE = 'P0509';
      END IF;
      SELECT w."identityStatus"::TEXT, w."recordVersion", w."identityDecisionEvidenceHash"::TEXT
        INTO v_worker_identity_status, v_worker_record_version, v_worker_evidence_sha256
        FROM "WorkerPerson" w
       WHERE w."organizationId" = p_organization_id AND w."id" = v_worker_person_id
       FOR SHARE;
      IF v_worker_identity_status IS DISTINCT FROM 'VERIFIED'
        OR v_worker_record_version IS DISTINCT FROM p_subject_identity_record_version
        OR v_worker_evidence_sha256 IS NULL
        OR v_worker_evidence_sha256 IS DISTINCT FROM p_identity_evidence_sha256
      THEN
        RAISE EXCEPTION 'self requester identity snapshot is not current and verified'
          USING ERRCODE = 'P0509';
      END IF;
    END IF;
  END IF;

  BEGIN
    INSERT INTO "DataSubjectRequesterVerificationEvent" (
      "id", "organizationId", "requestId", "sequence", "predecessorEventId",
      "kind", "requesterKind", "assuranceLevel", "verificationMethodCode",
      "verificationPolicyVersion", "fingerprintKeyId", "requesterFingerprintHmac",
      "identityEvidenceSha256", "challengeEvidenceSha256", "subjectIdentityRecordVersion",
      "representationMethodCode", "representationEvidenceSha256", "validUntil",
      "representationValidUntil", "revocationReasonCode", "actorMembershipId",
      "operationKeyHash", "requestFingerprint"
    ) VALUES (
      v_new_id, p_organization_id, p_request_id, COALESCE(v_head_sequence, 0) + 1,
      v_head_id, p_event_kind::"DataSubjectVerificationEventKind",
      p_requester_kind::"DataSubjectRequesterKind",
      p_assurance_level::"DataSubjectAssuranceLevel", p_verification_method_code,
      p_verification_policy_version, p_fingerprint_key_id, p_requester_fingerprint_hmac,
      p_identity_evidence_sha256, p_challenge_evidence_sha256,
      p_subject_identity_record_version, p_representation_method_code,
      p_representation_evidence_sha256, p_valid_until, p_representation_valid_until,
      p_revocation_reason_code, p_actor_membership_id, p_operation_key_hash,
      p_request_fingerprint
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'privacy verification concurrency conflict' USING ERRCODE = 'P0509';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'privacy verification reference not found' USING ERRCODE = 'P0504';
    WHEN check_violation OR invalid_text_representation THEN
      RAISE EXCEPTION 'privacy verification request is invalid' USING ERRCODE = 'P0500';
  END;

  RETURN QUERY
    SELECT e."id", e."sequence", e."kind"::TEXT, FALSE, e."occurredAt"
      FROM "DataSubjectRequesterVerificationEvent" e
     WHERE e."id" = v_new_id;
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_legal_assessment_append"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_actor_membership_id TEXT,
  p_operation_key_hash TEXT,
  p_request_fingerprint TEXT,
  p_fingerprint_key_id TEXT,
  p_expected_head_assessment_id TEXT,
  p_jurisdiction_code TEXT,
  p_deadline_method TEXT,
  p_due_at TIMESTAMPTZ,
  p_deadline_policy_version TEXT,
  p_deadline_policy_sha256 TEXT,
  p_retention_matrix_version TEXT,
  p_retention_matrix_sha256 TEXT,
  p_legal_review_evidence_sha256 TEXT
)
RETURNS TABLE(
  assessment_id TEXT,
  sequence INTEGER,
  replayed BOOLEAN,
  due_at TIMESTAMPTZ,
  assessed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_status TEXT;
  v_manifest_id TEXT;
  v_existing_id TEXT;
  v_existing_request_id TEXT;
  v_existing_sequence INTEGER;
  v_existing_fingerprint TEXT;
  v_existing_key_id TEXT;
  v_existing_due_at TIMESTAMPTZ;
  v_existing_assessed_at TIMESTAMPTZ;
  v_head_id TEXT;
  v_head_sequence INTEGER;
  v_new_id TEXT := gen_random_uuid()::TEXT;
BEGIN
  SELECT r."status"::TEXT
    INTO v_request_status
    FROM "DataSubjectRequest" r
   WHERE r."organizationId" = p_organization_id AND r."id" = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  PERFORM 1
    FROM "TenantMembership" m
   WHERE m."organizationId" = p_organization_id
     AND m."id" = p_actor_membership_id
     AND m."status" = 'ACTIVE' AND m."tenantRole" = 'ADMIN'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;
  IF p_deadline_method IS DISTINCT FROM 'REVIEWED_EXPLICIT_DATE'
    OR p_operation_key_hash !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_fingerprint_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  THEN
    RAISE EXCEPTION 'privacy legal assessment request is malformed' USING ERRCODE = 'P0500';
  END IF;

  SELECT a."id", a."requestId", a."sequence", a."requestFingerprint"::TEXT,
         a."fingerprintKeyId", a."dueAt", a."assessedAt"
    INTO v_existing_id, v_existing_request_id, v_existing_sequence,
         v_existing_fingerprint, v_existing_key_id, v_existing_due_at,
         v_existing_assessed_at
    FROM "DataSubjectLegalAssessmentRevision" a
   WHERE a."organizationId" = p_organization_id
     AND a."operationKeyHash" = p_operation_key_hash;
  IF FOUND THEN
    IF v_existing_request_id IS DISTINCT FROM p_request_id
      OR v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing_key_id IS DISTINCT FROM p_fingerprint_key_id
    THEN
      RAISE EXCEPTION 'privacy legal assessment idempotency conflict' USING ERRCODE = 'P0509';
    END IF;
    RETURN QUERY SELECT v_existing_id, v_existing_sequence, TRUE,
                        v_existing_due_at, v_existing_assessed_at;
    RETURN;
  END IF;

  SELECT m."id"
    INTO v_manifest_id
    FROM "DataSubjectDiscoveryManifest" m
   WHERE m."organizationId" = p_organization_id AND m."requestId" = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy discovery manifest not found' USING ERRCODE = 'P0504';
  END IF;
  SELECT a."id", a."sequence"
    INTO v_head_id, v_head_sequence
    FROM "DataSubjectLegalAssessmentRevision" a
   WHERE a."organizationId" = p_organization_id AND a."requestId" = p_request_id
   ORDER BY a."sequence" DESC
   LIMIT 1;
  IF v_head_id IS DISTINCT FROM p_expected_head_assessment_id THEN
    RAISE EXCEPTION 'privacy legal assessment head is stale' USING ERRCODE = 'P0509';
  END IF;

  BEGIN
    INSERT INTO "DataSubjectLegalAssessmentRevision" (
      "id", "organizationId", "requestId", "manifestId", "sequence",
      "predecessorAssessmentId", "jurisdictionCode", "deadlineMethod", "dueAt",
      "deadlinePolicyVersion", "deadlinePolicySha256", "retentionMatrixVersion",
      "retentionMatrixSha256", "legalReviewEvidenceSha256", "actorMembershipId",
      "operationKeyHash", "requestFingerprint", "fingerprintKeyId"
    ) VALUES (
      v_new_id, p_organization_id, p_request_id, v_manifest_id,
      COALESCE(v_head_sequence, 0) + 1, v_head_id, p_jurisdiction_code,
      p_deadline_method::"DataSubjectLegalDeadlineMethod", p_due_at,
      p_deadline_policy_version, p_deadline_policy_sha256,
      p_retention_matrix_version, p_retention_matrix_sha256,
      p_legal_review_evidence_sha256, p_actor_membership_id,
      p_operation_key_hash, p_request_fingerprint, p_fingerprint_key_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'privacy legal assessment concurrency conflict' USING ERRCODE = 'P0509';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'privacy legal assessment reference not found' USING ERRCODE = 'P0504';
    WHEN check_violation OR invalid_text_representation THEN
      RAISE EXCEPTION 'privacy legal assessment request is invalid' USING ERRCODE = 'P0500';
  END;
  RETURN QUERY
    SELECT a."id", a."sequence", FALSE, a."dueAt", a."assessedAt"
      FROM "DataSubjectLegalAssessmentRevision" a
     WHERE a."id" = v_new_id;
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_hold_create"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_manifest_id TEXT,
  p_expected_manifest_sha256 TEXT,
  p_actor_membership_id TEXT,
  p_operation_key_hash TEXT,
  p_request_fingerprint TEXT,
  p_fingerprint_key_id TEXT,
  p_scope_kind TEXT,
  p_discovery_item_id TEXT,
  p_category TEXT,
  p_basis_code TEXT,
  p_policy_version TEXT,
  p_evidence_sha256 TEXT,
  p_owner_membership_id TEXT,
  p_review_due_at TIMESTAMPTZ
)
RETURNS TABLE(
  hold_id TEXT,
  event_id TEXT,
  sequence INTEGER,
  event_kind TEXT,
  replayed BOOLEAN,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_status TEXT;
  v_manifest_sha256 TEXT;
  v_existing_hold_id TEXT;
  v_existing_request_id TEXT;
  v_existing_fingerprint TEXT;
  v_existing_key_id TEXT;
  v_existing_event_id TEXT;
  v_existing_sequence INTEGER;
  v_existing_kind TEXT;
  v_existing_occurred_at TIMESTAMPTZ;
  v_hold_id TEXT := gen_random_uuid()::TEXT;
  v_event_id TEXT := gen_random_uuid()::TEXT;
BEGIN
  SELECT r."status"::TEXT
    INTO v_request_status
    FROM "DataSubjectRequest" r
   WHERE r."organizationId" = p_organization_id AND r."id" = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  PERFORM 1
    FROM "TenantMembership" m
   WHERE m."organizationId" = p_organization_id
     AND m."id" = p_actor_membership_id
     AND m."status" = 'ACTIVE' AND m."tenantRole" = 'ADMIN'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;
  IF p_scope_kind IS NULL OR p_scope_kind NOT IN ('ITEM', 'CATEGORY')
    OR p_operation_key_hash !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_expected_manifest_sha256 !~ '^[a-f0-9]{64}$'
    OR p_fingerprint_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  THEN
    RAISE EXCEPTION 'privacy hold request is malformed' USING ERRCODE = 'P0500';
  END IF;

  SELECT h."id", h."requestId", h."requestFingerprint"::TEXT, h."fingerprintKeyId"
    INTO v_existing_hold_id, v_existing_request_id, v_existing_fingerprint,
         v_existing_key_id
    FROM "DataSubjectLegalHold" h
   WHERE h."organizationId" = p_organization_id
     AND h."operationKeyHash" = p_operation_key_hash;
  IF FOUND THEN
    IF v_existing_request_id IS DISTINCT FROM p_request_id
      OR v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing_key_id IS DISTINCT FROM p_fingerprint_key_id
    THEN
      RAISE EXCEPTION 'privacy hold idempotency conflict' USING ERRCODE = 'P0509';
    END IF;
    SELECT e."id", e."sequence", e."kind"::TEXT, e."occurredAt"
      INTO v_existing_event_id, v_existing_sequence, v_existing_kind,
           v_existing_occurred_at
      FROM "DataSubjectLegalHoldEvent" e
     WHERE e."organizationId" = p_organization_id
       AND e."requestId" = p_request_id
       AND e."holdId" = v_existing_hold_id
     ORDER BY e."sequence"
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'privacy hold initial event is incomplete' USING ERRCODE = 'P0509';
    END IF;
    RETURN QUERY SELECT v_existing_hold_id, v_existing_event_id,
                        v_existing_sequence, v_existing_kind, TRUE,
                        v_existing_occurred_at;
    RETURN;
  END IF;

  SELECT m."manifestSha256"::TEXT
    INTO v_manifest_sha256
    FROM "DataSubjectDiscoveryManifest" m
   WHERE m."organizationId" = p_organization_id
     AND m."requestId" = p_request_id
     AND m."id" = p_manifest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy discovery manifest not found' USING ERRCODE = 'P0504';
  END IF;
  IF v_manifest_sha256 IS DISTINCT FROM p_expected_manifest_sha256 THEN
    RAISE EXCEPTION 'privacy discovery manifest is stale' USING ERRCODE = 'P0509';
  END IF;
  IF p_owner_membership_id IS DISTINCT FROM p_actor_membership_id THEN
    RAISE EXCEPTION 'privacy hold owner must be the authenticated administrator'
      USING ERRCODE = 'P0503';
  END IF;

  BEGIN
    INSERT INTO "DataSubjectLegalHold" (
      "id", "organizationId", "requestId", "manifestId", "scopeKind",
      "discoveryItemId", "category", "createdByMembershipId", "operationKeyHash",
      "requestFingerprint", "fingerprintKeyId"
    ) VALUES (
      v_hold_id, p_organization_id, p_request_id, p_manifest_id,
      p_scope_kind::"DataSubjectHoldScopeKind", p_discovery_item_id,
      p_category::"DataSubjectDataCategory", p_actor_membership_id,
      p_operation_key_hash, p_request_fingerprint, p_fingerprint_key_id
    );
    INSERT INTO "DataSubjectLegalHoldEvent" (
      "id", "organizationId", "requestId", "holdId", "sequence",
      "predecessorEventId", "kind", "basisCode", "policyVersion",
      "evidenceSha256", "ownerMembershipId", "reviewDueAt",
      "releaseReasonCode", "releaseEvidenceSha256", "actorMembershipId",
      "operationKeyHash", "requestFingerprint", "fingerprintKeyId"
    ) VALUES (
      v_event_id, p_organization_id, p_request_id, v_hold_id, 1, NULL,
      'CREATED', p_basis_code, p_policy_version, p_evidence_sha256,
      p_owner_membership_id, p_review_due_at, NULL, NULL,
      p_actor_membership_id, p_operation_key_hash, p_request_fingerprint,
      p_fingerprint_key_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'privacy hold concurrency conflict' USING ERRCODE = 'P0509';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'privacy hold reference not found' USING ERRCODE = 'P0504';
    WHEN check_violation OR invalid_text_representation THEN
      RAISE EXCEPTION 'privacy hold request is invalid' USING ERRCODE = 'P0500';
  END;
  RETURN QUERY
    SELECT h."id", e."id", e."sequence", e."kind"::TEXT, FALSE, e."occurredAt"
      FROM "DataSubjectLegalHold" h
      JOIN "DataSubjectLegalHoldEvent" e
        ON e."organizationId" = h."organizationId"
       AND e."requestId" = h."requestId"
       AND e."holdId" = h."id"
     WHERE h."id" = v_hold_id AND e."id" = v_event_id;
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_hold_event_append"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_hold_id TEXT,
  p_actor_membership_id TEXT,
  p_operation_key_hash TEXT,
  p_request_fingerprint TEXT,
  p_fingerprint_key_id TEXT,
  p_expected_head_event_id TEXT,
  p_event_kind TEXT,
  p_basis_code TEXT,
  p_policy_version TEXT,
  p_evidence_sha256 TEXT,
  p_owner_membership_id TEXT,
  p_review_due_at TIMESTAMPTZ,
  p_release_reason_code TEXT,
  p_release_evidence_sha256 TEXT
)
RETURNS TABLE(
  hold_id TEXT,
  event_id TEXT,
  sequence INTEGER,
  event_kind TEXT,
  replayed BOOLEAN,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_status TEXT;
  v_existing_id TEXT;
  v_existing_request_id TEXT;
  v_existing_hold_id TEXT;
  v_existing_sequence INTEGER;
  v_existing_kind TEXT;
  v_existing_fingerprint TEXT;
  v_existing_key_id TEXT;
  v_existing_occurred_at TIMESTAMPTZ;
  v_head_id TEXT;
  v_head_sequence INTEGER;
  v_hold_exists BOOLEAN;
  v_new_id TEXT := gen_random_uuid()::TEXT;
BEGIN
  SELECT r."status"::TEXT
    INTO v_request_status
    FROM "DataSubjectRequest" r
   WHERE r."organizationId" = p_organization_id AND r."id" = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  PERFORM 1
    FROM "TenantMembership" m
   WHERE m."organizationId" = p_organization_id
     AND m."id" = p_actor_membership_id
     AND m."status" = 'ACTIVE' AND m."tenantRole" = 'ADMIN'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;
  IF p_event_kind IS NULL OR p_event_kind NOT IN ('REVIEWED', 'RELEASED')
    OR p_operation_key_hash !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_fingerprint_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  THEN
    RAISE EXCEPTION 'privacy hold event request is malformed' USING ERRCODE = 'P0500';
  END IF;

  SELECT e."id", e."requestId", e."holdId", e."sequence", e."kind"::TEXT,
         e."requestFingerprint"::TEXT, e."fingerprintKeyId", e."occurredAt"
    INTO v_existing_id, v_existing_request_id, v_existing_hold_id,
         v_existing_sequence, v_existing_kind, v_existing_fingerprint,
         v_existing_key_id, v_existing_occurred_at
    FROM "DataSubjectLegalHoldEvent" e
   WHERE e."organizationId" = p_organization_id
     AND e."operationKeyHash" = p_operation_key_hash;
  IF FOUND THEN
    IF v_existing_request_id IS DISTINCT FROM p_request_id
      OR v_existing_hold_id IS DISTINCT FROM p_hold_id
      OR v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing_key_id IS DISTINCT FROM p_fingerprint_key_id
    THEN
      RAISE EXCEPTION 'privacy hold event idempotency conflict' USING ERRCODE = 'P0509';
    END IF;
    RETURN QUERY SELECT v_existing_hold_id, v_existing_id, v_existing_sequence,
                        v_existing_kind, TRUE, v_existing_occurred_at;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "DataSubjectLegalHold" h
     WHERE h."organizationId" = p_organization_id
       AND h."requestId" = p_request_id AND h."id" = p_hold_id
  ) INTO v_hold_exists;
  IF NOT v_hold_exists THEN
    RAISE EXCEPTION 'privacy hold not found' USING ERRCODE = 'P0504';
  END IF;
  SELECT e."id", e."sequence"
    INTO v_head_id, v_head_sequence
    FROM "DataSubjectLegalHoldEvent" e
   WHERE e."organizationId" = p_organization_id
     AND e."requestId" = p_request_id AND e."holdId" = p_hold_id
   ORDER BY e."sequence" DESC
   LIMIT 1;
  IF v_head_id IS DISTINCT FROM p_expected_head_event_id OR v_head_id IS NULL THEN
    RAISE EXCEPTION 'privacy hold event head is stale' USING ERRCODE = 'P0509';
  END IF;

  BEGIN
    INSERT INTO "DataSubjectLegalHoldEvent" (
      "id", "organizationId", "requestId", "holdId", "sequence",
      "predecessorEventId", "kind", "basisCode", "policyVersion",
      "evidenceSha256", "ownerMembershipId", "reviewDueAt",
      "releaseReasonCode", "releaseEvidenceSha256", "actorMembershipId",
      "operationKeyHash", "requestFingerprint", "fingerprintKeyId"
    ) VALUES (
      v_new_id, p_organization_id, p_request_id, p_hold_id,
      v_head_sequence + 1, v_head_id, p_event_kind::"DataSubjectHoldEventKind",
      p_basis_code, p_policy_version, p_evidence_sha256, p_owner_membership_id,
      p_review_due_at, p_release_reason_code, p_release_evidence_sha256,
      p_actor_membership_id, p_operation_key_hash, p_request_fingerprint,
      p_fingerprint_key_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'privacy hold event concurrency conflict' USING ERRCODE = 'P0509';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'privacy hold event reference not found' USING ERRCODE = 'P0504';
    WHEN check_violation OR invalid_text_representation THEN
      RAISE EXCEPTION 'privacy hold event request is invalid' USING ERRCODE = 'P0500';
  END;
  RETURN QUERY
    SELECT e."holdId", e."id", e."sequence", e."kind"::TEXT, FALSE, e."occurredAt"
      FROM "DataSubjectLegalHoldEvent" e
     WHERE e."id" = v_new_id;
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_decision_create"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_manifest_id TEXT,
  p_expected_manifest_sha256 TEXT,
  p_actor_membership_id TEXT,
  p_operation_key_hash TEXT,
  p_request_fingerprint TEXT,
  p_fingerprint_key_id TEXT,
  p_expected_verification_event_id TEXT,
  p_expected_legal_assessment_id TEXT,
  p_expected_hold_set_sha256 TEXT,
  p_expected_previous_decision_id TEXT,
  p_items JSONB
)
RETURNS TABLE(
  decision_id TEXT,
  revision INTEGER,
  status TEXT,
  decision_sha256 TEXT,
  hold_set_sha256 TEXT,
  replayed BOOLEAN,
  prepared_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_status TEXT;
  v_manifest_sha256 TEXT;
  v_verification_head_id TEXT;
  v_assessment_head_id TEXT;
  v_hold_set_sha256 TEXT;
  v_prior_id TEXT;
  v_prior_revision INTEGER;
  v_existing_id TEXT;
  v_existing_request_id TEXT;
  v_existing_revision INTEGER;
  v_existing_status TEXT;
  v_existing_decision_sha256 TEXT;
  v_existing_hold_sha256 TEXT;
  v_existing_fingerprint TEXT;
  v_existing_key_id TEXT;
  v_existing_prepared_at TIMESTAMPTZ;
  v_decision_id TEXT := gen_random_uuid()::TEXT;
  v_item_count INTEGER;
BEGIN
  SELECT r."status"::TEXT
    INTO v_request_status
    FROM "DataSubjectRequest" r
   WHERE r."organizationId" = p_organization_id AND r."id" = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  PERFORM 1
    FROM "TenantMembership" m
   WHERE m."organizationId" = p_organization_id
     AND m."id" = p_actor_membership_id
     AND m."status" = 'ACTIVE' AND m."tenantRole" = 'ADMIN'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;
  IF p_operation_key_hash !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_expected_manifest_sha256 !~ '^[a-f0-9]{64}$'
    OR p_expected_hold_set_sha256 !~ '^[a-f0-9]{64}$'
    OR p_fingerprint_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  THEN
    RAISE EXCEPTION 'privacy decision request is malformed' USING ERRCODE = 'P0500';
  END IF;

  SELECT d."id", d."requestId", d."revision", d."status"::TEXT,
         d."decisionSha256"::TEXT, d."holdSetSha256"::TEXT,
         d."requestFingerprint"::TEXT, d."fingerprintKeyId", d."preparedAt"
    INTO v_existing_id, v_existing_request_id, v_existing_revision,
         v_existing_status, v_existing_decision_sha256, v_existing_hold_sha256,
         v_existing_fingerprint, v_existing_key_id, v_existing_prepared_at
    FROM "DataSubjectDecisionSet" d
   WHERE d."organizationId" = p_organization_id
     AND d."operationKeyHash" = p_operation_key_hash;
  IF FOUND THEN
    IF v_existing_request_id IS DISTINCT FROM p_request_id
      OR v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing_key_id IS DISTINCT FROM p_fingerprint_key_id
    THEN
      RAISE EXCEPTION 'privacy decision idempotency conflict' USING ERRCODE = 'P0509';
    END IF;
    RETURN QUERY SELECT v_existing_id, v_existing_revision, v_existing_status,
                        v_existing_decision_sha256, v_existing_hold_sha256,
                        TRUE, v_existing_prepared_at;
    RETURN;
  END IF;

  SELECT m."manifestSha256"::TEXT
    INTO v_manifest_sha256
    FROM "DataSubjectDiscoveryManifest" m
   WHERE m."organizationId" = p_organization_id
     AND m."requestId" = p_request_id AND m."id" = p_manifest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy discovery manifest not found' USING ERRCODE = 'P0504';
  END IF;
  IF v_manifest_sha256 IS DISTINCT FROM p_expected_manifest_sha256 THEN
    RAISE EXCEPTION 'privacy discovery manifest is stale' USING ERRCODE = 'P0509';
  END IF;

  SELECT e."id"
    INTO v_verification_head_id
    FROM "DataSubjectRequesterVerificationEvent" e
   WHERE e."organizationId" = p_organization_id AND e."requestId" = p_request_id
   ORDER BY e."sequence" DESC LIMIT 1;
  SELECT a."id"
    INTO v_assessment_head_id
    FROM "DataSubjectLegalAssessmentRevision" a
   WHERE a."organizationId" = p_organization_id AND a."requestId" = p_request_id
   ORDER BY a."sequence" DESC LIMIT 1;
  IF v_verification_head_id IS DISTINCT FROM p_expected_verification_event_id
    OR v_assessment_head_id IS DISTINCT FROM p_expected_legal_assessment_id
  THEN
    RAISE EXCEPTION 'privacy decision dependencies are stale' USING ERRCODE = 'P0509';
  END IF;
  v_hold_set_sha256 := "obrasaas_data_subject_hold_set_sha256"(
    p_organization_id, p_request_id, p_manifest_id
  );
  IF v_hold_set_sha256 IS DISTINCT FROM p_expected_hold_set_sha256 THEN
    RAISE EXCEPTION 'privacy hold set is stale' USING ERRCODE = 'P0509';
  END IF;

  SELECT d."id", d."revision"
    INTO v_prior_id, v_prior_revision
    FROM "DataSubjectDecisionSet" d
   WHERE d."organizationId" = p_organization_id AND d."requestId" = p_request_id
   ORDER BY d."revision" DESC LIMIT 1;
  IF v_prior_id IS DISTINCT FROM p_expected_previous_decision_id THEN
    RAISE EXCEPTION 'privacy decision head is stale' USING ERRCODE = 'P0509';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'privacy decision items must be one JSON array' USING ERRCODE = 'P0500';
  END IF;
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count NOT BETWEEN 1 AND 1024 THEN
    RAISE EXCEPTION 'privacy decision item count is outside the bounded policy'
      USING ERRCODE = 'P0500';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) AS input_item(value)
     WHERE jsonb_typeof(input_item.value) <> 'object'
        OR NOT (input_item.value ?& ARRAY[
          'reviewItemId', 'action', 'legalBasisCode', 'retentionPolicyVersion',
          'retentionRuleCode', 'retentionUntil'
        ])
        OR input_item.value - ARRAY[
          'reviewItemId', 'action', 'legalBasisCode', 'retentionPolicyVersion',
          'retentionRuleCode', 'retentionUntil'
        ] <> '{}'::JSONB
        OR jsonb_typeof(input_item.value -> 'reviewItemId') <> 'string'
        OR jsonb_typeof(input_item.value -> 'action') <> 'string'
        OR jsonb_typeof(input_item.value -> 'legalBasisCode') NOT IN ('string', 'null')
        OR jsonb_typeof(input_item.value -> 'retentionPolicyVersion') NOT IN ('string', 'null')
        OR jsonb_typeof(input_item.value -> 'retentionRuleCode') NOT IN ('string', 'null')
        OR jsonb_typeof(input_item.value -> 'retentionUntil') NOT IN ('string', 'null')
  ) THEN
    RAISE EXCEPTION 'privacy decision item JSON has an invalid or unknown field'
      USING ERRCODE = 'P0500';
  END IF;

  BEGIN
    INSERT INTO "DataSubjectDecisionSet" (
      "id", "organizationId", "requestId", "manifestId", "revision",
      "predecessorDecisionId", "status", "schemaVersion", "verificationEventId",
      "legalAssessmentId", "preparedByMembershipId", "operationKeyHash",
      "requestFingerprint", "fingerprintKeyId", "updatedAt"
    ) VALUES (
      v_decision_id, p_organization_id, p_request_id, p_manifest_id,
      COALESCE(v_prior_revision, 0) + 1, v_prior_id, 'DRAFTING', 1,
      p_expected_verification_event_id, p_expected_legal_assessment_id,
      p_actor_membership_id, p_operation_key_hash, p_request_fingerprint,
      p_fingerprint_key_id, statement_timestamp()
    );

    INSERT INTO "DataSubjectDecisionItem" (
      "id", "organizationId", "requestId", "manifestId", "decisionSetId",
      "discoveryItemId", "ordinal", "action", "legalBasisCode",
      "retentionPolicyVersion", "retentionRuleCode", "retentionUntil"
    )
    SELECT gen_random_uuid()::TEXT, p_organization_id, p_request_id, p_manifest_id,
           v_decision_id, input_item.value ->> 'reviewItemId', 0,
           (input_item.value ->> 'action')::"DataSubjectDecisionAction",
           input_item.value ->> 'legalBasisCode',
           input_item.value ->> 'retentionPolicyVersion',
           input_item.value ->> 'retentionRuleCode',
           CASE
             WHEN jsonb_typeof(input_item.value -> 'retentionUntil') = 'null' THEN NULL
             ELSE (input_item.value ->> 'retentionUntil')::TIMESTAMPTZ
           END
      FROM jsonb_array_elements(p_items) AS input_item(value);

    UPDATE "DataSubjectDecisionSet"
       SET "status" = 'PENDING_APPROVAL'
     WHERE "organizationId" = p_organization_id
       AND "requestId" = p_request_id AND "id" = v_decision_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'privacy decision coverage or concurrency conflict' USING ERRCODE = 'P0509';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'privacy decision reference not found' USING ERRCODE = 'P0504';
    WHEN check_violation OR invalid_text_representation OR datetime_field_overflow THEN
      RAISE EXCEPTION 'privacy decision request is invalid' USING ERRCODE = 'P0500';
  END;

  RETURN QUERY
    SELECT d."id", d."revision", d."status"::TEXT, d."decisionSha256"::TEXT,
           d."holdSetSha256"::TEXT, FALSE, d."preparedAt"
      FROM "DataSubjectDecisionSet" d
     WHERE d."id" = v_decision_id;
END;
$$;

CREATE FUNCTION "obrasaas_data_subject_decision_decide"(
  p_organization_id TEXT,
  p_request_id TEXT,
  p_decision_id TEXT,
  p_actor_membership_id TEXT,
  p_operation_key_hash TEXT,
  p_request_fingerprint TEXT,
  p_fingerprint_key_id TEXT,
  p_expected_decision_sha256 TEXT,
  p_decision TEXT,
  p_reason_code TEXT
)
RETURNS TABLE(
  decision_id TEXT,
  revision INTEGER,
  status TEXT,
  decision_sha256 TEXT,
  hold_set_sha256 TEXT,
  replayed BOOLEAN,
  decided_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_status TEXT;
  v_existing_id TEXT;
  v_existing_request_id TEXT;
  v_existing_revision INTEGER;
  v_existing_status TEXT;
  v_existing_decision_sha256 TEXT;
  v_existing_hold_sha256 TEXT;
  v_existing_fingerprint TEXT;
  v_existing_key_id TEXT;
  v_existing_decided_at TIMESTAMPTZ;
  v_current_status TEXT;
  v_current_decision_sha256 TEXT;
BEGIN
  SELECT r."status"::TEXT
    INTO v_request_status
    FROM "DataSubjectRequest" r
   WHERE r."organizationId" = p_organization_id AND r."id" = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review request not found' USING ERRCODE = 'P0504';
  END IF;
  PERFORM 1
    FROM "TenantMembership" m
   WHERE m."organizationId" = p_organization_id
     AND m."id" = p_actor_membership_id
     AND m."status" = 'ACTIVE' AND m."tenantRole" = 'ADMIN'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy review requires one active tenant administrator'
      USING ERRCODE = 'P0503';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('APPROVE', 'REJECT')
    OR p_operation_key_hash !~ '^[a-f0-9]{64}$'
    OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_expected_decision_sha256 !~ '^[a-f0-9]{64}$'
    OR p_fingerprint_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
  THEN
    RAISE EXCEPTION 'privacy decision approval request is malformed' USING ERRCODE = 'P0500';
  END IF;
  IF (p_decision = 'APPROVE' AND p_reason_code IS NOT NULL)
    OR (p_decision = 'REJECT' AND p_reason_code IS NULL)
  THEN
    RAISE EXCEPTION 'privacy decision reason shape is invalid' USING ERRCODE = 'P0500';
  END IF;

  SELECT d."id", d."requestId", d."revision", d."status"::TEXT,
         d."decisionSha256"::TEXT, d."holdSetSha256"::TEXT,
         d."decisionRequestFingerprint"::TEXT, d."decisionFingerprintKeyId",
         d."decidedAt"
    INTO v_existing_id, v_existing_request_id, v_existing_revision,
         v_existing_status, v_existing_decision_sha256, v_existing_hold_sha256,
         v_existing_fingerprint, v_existing_key_id, v_existing_decided_at
    FROM "DataSubjectDecisionSet" d
   WHERE d."organizationId" = p_organization_id
     AND d."decisionOperationKeyHash" = p_operation_key_hash;
  IF FOUND THEN
    IF v_existing_id IS DISTINCT FROM p_decision_id
      OR v_existing_request_id IS DISTINCT FROM p_request_id
      OR v_existing_fingerprint IS DISTINCT FROM p_request_fingerprint
      OR v_existing_key_id IS DISTINCT FROM p_fingerprint_key_id
    THEN
      RAISE EXCEPTION 'privacy decision approval idempotency conflict' USING ERRCODE = 'P0509';
    END IF;
    RETURN QUERY SELECT v_existing_id, v_existing_revision, v_existing_status,
                        v_existing_decision_sha256, v_existing_hold_sha256,
                        TRUE, v_existing_decided_at;
    RETURN;
  END IF;

  SELECT d."status"::TEXT, d."decisionSha256"::TEXT
    INTO v_current_status, v_current_decision_sha256
    FROM "DataSubjectDecisionSet" d
   WHERE d."organizationId" = p_organization_id
     AND d."requestId" = p_request_id AND d."id" = p_decision_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'privacy decision not found' USING ERRCODE = 'P0504';
  END IF;
  IF v_current_status IS DISTINCT FROM 'PENDING_APPROVAL'
    OR v_current_decision_sha256 IS DISTINCT FROM p_expected_decision_sha256
  THEN
    RAISE EXCEPTION 'privacy decision approval head is stale' USING ERRCODE = 'P0509';
  END IF;

  BEGIN
    UPDATE "DataSubjectDecisionSet"
       SET "status" = CASE
             WHEN p_decision = 'APPROVE' THEN 'SEALED_BLOCKED'::"DataSubjectDecisionStatus"
             ELSE 'REJECTED'::"DataSubjectDecisionStatus"
           END,
           "decidedByMembershipId" = p_actor_membership_id,
           "decisionOperationKeyHash" = p_operation_key_hash,
           "decisionRequestFingerprint" = p_request_fingerprint,
           "decisionFingerprintKeyId" = p_fingerprint_key_id,
           "decisionReasonCode" = p_reason_code
     WHERE "organizationId" = p_organization_id
       AND "requestId" = p_request_id AND "id" = p_decision_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'privacy decision approval concurrency conflict' USING ERRCODE = 'P0509';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'privacy decision approval reference not found' USING ERRCODE = 'P0504';
    WHEN check_violation OR invalid_text_representation THEN
      RAISE EXCEPTION 'privacy decision approval request is invalid' USING ERRCODE = 'P0500';
  END;

  RETURN QUERY
    SELECT d."id", d."revision", d."status"::TEXT, d."decisionSha256"::TEXT,
           d."holdSetSha256"::TEXT, FALSE, d."decidedAt"
      FROM "DataSubjectDecisionSet" d
     WHERE d."id" = p_decision_id;
END;
$$;

CREATE TRIGGER "DataSubjectVerificationEvent_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectRequesterVerificationEvent"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_append_only"();
CREATE TRIGGER "DataSubjectVerificationEvent_no_truncate"
BEFORE TRUNCATE ON "DataSubjectRequesterVerificationEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_decision_no_truncate"();

CREATE TRIGGER "DataSubjectLegalAssessment_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectLegalAssessmentRevision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_append_only"();
CREATE TRIGGER "DataSubjectLegalAssessment_no_truncate"
BEFORE TRUNCATE ON "DataSubjectLegalAssessmentRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_decision_no_truncate"();

CREATE TRIGGER "DataSubjectLegalHold_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectLegalHold"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_append_only"();
CREATE TRIGGER "DataSubjectLegalHold_no_truncate"
BEFORE TRUNCATE ON "DataSubjectLegalHold"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_decision_no_truncate"();

CREATE TRIGGER "DataSubjectLegalHoldEvent_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectLegalHoldEvent"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_append_only"();
CREATE TRIGGER "DataSubjectLegalHoldEvent_no_truncate"
BEFORE TRUNCATE ON "DataSubjectLegalHoldEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_decision_no_truncate"();

CREATE TRIGGER "DataSubjectDecisionSet_no_delete"
BEFORE DELETE ON "DataSubjectDecisionSet"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_append_only"();
CREATE TRIGGER "DataSubjectDecisionSet_no_truncate"
BEFORE TRUNCATE ON "DataSubjectDecisionSet"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_decision_no_truncate"();

CREATE TRIGGER "DataSubjectDecisionItem_append_only"
BEFORE UPDATE OR DELETE ON "DataSubjectDecisionItem"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_data_subject_decision_append_only"();
CREATE TRIGGER "DataSubjectDecisionItem_no_truncate"
BEFORE TRUNCATE ON "DataSubjectDecisionItem"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_data_subject_decision_no_truncate"();

ALTER TABLE "DataSubjectRequesterVerificationEvent"
  ENABLE ALWAYS TRIGGER "DataSubjectVerificationEvent_guard";
ALTER TABLE "DataSubjectRequesterVerificationEvent"
  ENABLE ALWAYS TRIGGER "DataSubjectVerificationEvent_append_only";
ALTER TABLE "DataSubjectRequesterVerificationEvent"
  ENABLE ALWAYS TRIGGER "DataSubjectVerificationEvent_no_truncate";

ALTER TABLE "DataSubjectLegalAssessmentRevision"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalAssessment_guard";
ALTER TABLE "DataSubjectLegalAssessmentRevision"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalAssessment_append_only";
ALTER TABLE "DataSubjectLegalAssessmentRevision"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalAssessment_no_truncate";

ALTER TABLE "DataSubjectLegalHold"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHold_guard";
ALTER TABLE "DataSubjectLegalHold"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHold_initial_event_check";
ALTER TABLE "DataSubjectLegalHold"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHold_append_only";
ALTER TABLE "DataSubjectLegalHold"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHold_no_truncate";

ALTER TABLE "DataSubjectLegalHoldEvent"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHoldEvent_guard";
ALTER TABLE "DataSubjectLegalHoldEvent"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHoldEvent_append_only";
ALTER TABLE "DataSubjectLegalHoldEvent"
  ENABLE ALWAYS TRIGGER "DataSubjectLegalHoldEvent_no_truncate";

ALTER TABLE "DataSubjectDecisionSet"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionSet_insert_guard";
ALTER TABLE "DataSubjectDecisionSet"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionSet_lifecycle_guard";
ALTER TABLE "DataSubjectDecisionSet"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionSet_terminal_check";
ALTER TABLE "DataSubjectDecisionSet"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionSet_no_delete";
ALTER TABLE "DataSubjectDecisionSet"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionSet_no_truncate";

ALTER TABLE "DataSubjectDecisionItem"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionItem_guard";
ALTER TABLE "DataSubjectDecisionItem"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionItem_append_only";
ALTER TABLE "DataSubjectDecisionItem"
  ENABLE ALWAYS TRIGGER "DataSubjectDecisionItem_no_truncate";

COMMIT;
