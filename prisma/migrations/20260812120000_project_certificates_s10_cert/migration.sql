-- S10-CERT F1: governed contractual progress certificates.
-- This migration intentionally keeps all candidate derivation, arithmetic,
-- idempotency and projection writes inside PostgreSQL.

CREATE TYPE "ProjectCertificateLineState" AS ENUM ('VALUED', 'NO_CLAIM');
CREATE TYPE "ProjectCertificateDecisionType" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ProjectCertificateOperationKind" AS ENUM ('PREPARE', 'APPROVE', 'REJECT', 'CANCEL');
CREATE TYPE "ProjectCertificateDecisionActorBasis" AS ENUM (
  'EXACT_CERTIFIER', 'EXACT_REGISTRAR', 'FALLBACK_PROJECT_ADMIN'
);

CREATE TABLE "ProjectCertificateBook" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "pinnedContractHeadId" TEXT,
  "pinnedContractVersionId" TEXT,
  "pinnedAuthorityVersionId" TEXT,
  "latestVersionSequence" BIGINT NOT NULL DEFAULT 0,
  "latestApprovedPeriodStart" DATE,
  "latestApprovedCertificateVersionId" TEXT,
  "pendingCertificateVersionId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificateBook_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificateBook_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "ProjectCertificateBook_sequence_check" CHECK ("latestVersionSequence" >= 0),
  CONSTRAINT "ProjectCertificateBook_pin_all_or_none_check" CHECK (
    ("pinnedContractHeadId" IS NULL AND "pinnedContractVersionId" IS NULL AND "pinnedAuthorityVersionId" IS NULL)
    OR
    ("pinnedContractHeadId" IS NOT NULL AND "pinnedContractVersionId" IS NOT NULL AND "pinnedAuthorityVersionId" IS NOT NULL)
  ),
  CONSTRAINT "ProjectCertificateBook_latest_period_pointer_check" CHECK (
    ("latestApprovedPeriodStart" IS NULL) = ("latestApprovedCertificateVersionId" IS NULL)
  )
);

CREATE TABLE "ProjectCertificatePeriodHead" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "currentApprovedVersionId" TEXT,
  "latestVersionId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificatePeriodHead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificatePeriodHead_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "ProjectCertificatePeriodHead_civil_fortnight_check" CHECK (
    (EXTRACT(DAY FROM "periodStart") = 1 AND "periodEnd" = "periodStart" + 14)
    OR
    (EXTRACT(DAY FROM "periodStart") = 16 AND "periodEnd" = (date_trunc('month', "periodStart") + INTERVAL '1 month - 1 day')::DATE)
  )
);

CREATE TABLE "ProjectCertificateVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "periodHeadId" TEXT NOT NULL,
  "projectSequence" BIGINT NOT NULL,
  "periodVersion" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "supersedesApprovedVersionId" TEXT,
  "previousApprovedCertificateVersionId" TEXT,
  "cutHeadId" TEXT NOT NULL,
  "cutId" TEXT NOT NULL,
  "contractHeadId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "authorityVersionId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "coverageFrom" DATE NOT NULL,
  "coverageThrough" DATE NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "currencyMinorUnits" SMALLINT NOT NULL,
  "contractualRoundingPolicyVersion" VARCHAR(64) NOT NULL,
  "cumulativeGrossPolicyVersion" VARCHAR(64) NOT NULL,
  "cumulativeRetentionPolicyVersion" VARCHAR(64) NOT NULL,
  "adjustmentPolicyVersion" VARCHAR(64) NOT NULL,
  "retentionBps" INTEGER NOT NULL,
  "taskCount" INTEGER NOT NULL,
  "valuedLineCount" INTEGER NOT NULL,
  "noClaimLineCount" INTEGER NOT NULL,
  "previousApprovedCumulativeGrossTotalMinor" BIGINT NOT NULL,
  "cumulativeGrossTotalMinor" BIGINT NOT NULL,
  "certificateIncrementGrossTotalMinor" BIGINT NOT NULL,
  "previousApprovedCumulativeRetentionMinor" BIGINT NOT NULL,
  "cumulativeRetentionMinor" BIGINT NOT NULL,
  "certificateIncrementRetentionMinor" BIGINT NOT NULL,
  "certificateIncrementDeductionsMinor" BIGINT NOT NULL,
  "certificateIncrementNetMinor" BIGINT NOT NULL,
  "sourceCutCandidateSha256" CHAR(64) NOT NULL,
  "sourceCutSha256" CHAR(64) NOT NULL,
  "sourceContractSha256" CHAR(64) NOT NULL,
  "sourceAuthoritySha256" CHAR(64) NOT NULL,
  "candidateSha256" CHAR(64) NOT NULL,
  "certificateSha256" CHAR(64) NOT NULL,
  "preparedByMembershipId" TEXT NOT NULL,
  "bookRevisionAtPrepare" INTEGER NOT NULL,
  "periodHeadRevisionAtPrepare" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificateVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificateVersion_sequence_check" CHECK ("projectSequence" > 0 AND "periodVersion" > 0),
  CONSTRAINT "ProjectCertificateVersion_period_check" CHECK (
    "periodEnd" >= "periodStart" AND "coverageFrom" <= "coverageThrough" AND "coverageThrough" = "periodEnd"
  ),
  CONSTRAINT "ProjectCertificateVersion_policy_check" CHECK (
    "currencyCode" IN ('ARS', 'USD')
    AND "currencyMinorUnits" = 2
    AND "contractualRoundingPolicyVersion" = 'CERT_RETENTION_HALF_UP_V1'
    AND "cumulativeGrossPolicyVersion" = 'CERT_CUMULATIVE_GROSS_HALF_UP_V1'
    AND "cumulativeRetentionPolicyVersion" = 'CERT_CUMULATIVE_RETENTION_HALF_UP_V1'
    AND "adjustmentPolicyVersion" = 'NONE'
    AND "retentionBps" BETWEEN 0 AND 10000
  ),
  CONSTRAINT "ProjectCertificateVersion_counts_check" CHECK (
    "taskCount" BETWEEN 1 AND 5000
    AND "valuedLineCount" BETWEEN 1 AND "taskCount" AND "noClaimLineCount" >= 0
    AND "valuedLineCount" + "noClaimLineCount" = "taskCount"
  ),
  CONSTRAINT "ProjectCertificateVersion_amounts_check" CHECK (
    "previousApprovedCumulativeGrossTotalMinor" >= 0
    AND "cumulativeGrossTotalMinor" >= 0
    AND "certificateIncrementGrossTotalMinor" >= 0
    AND "previousApprovedCumulativeRetentionMinor" >= 0
    AND "cumulativeRetentionMinor" >= 0
    AND "certificateIncrementRetentionMinor" >= 0
    AND "certificateIncrementDeductionsMinor" >= 0
    AND "certificateIncrementNetMinor" >= 0
    AND "cumulativeGrossTotalMinor" - "previousApprovedCumulativeGrossTotalMinor" = "certificateIncrementGrossTotalMinor"
    AND "cumulativeRetentionMinor" - "previousApprovedCumulativeRetentionMinor" = "certificateIncrementRetentionMinor"
    AND "certificateIncrementGrossTotalMinor" - "certificateIncrementRetentionMinor" - "certificateIncrementDeductionsMinor" = "certificateIncrementNetMinor"
  ),
  CONSTRAINT "ProjectCertificateVersion_cas_check" CHECK (
    "bookRevisionAtPrepare" >= 0 AND "periodHeadRevisionAtPrepare" >= 0
  ),
  CONSTRAINT "ProjectCertificateVersion_hashes_check" CHECK (
    "sourceCutCandidateSha256" ~ '^[a-f0-9]{64}$'
    AND "sourceCutSha256" ~ '^[a-f0-9]{64}$'
    AND "sourceContractSha256" ~ '^[a-f0-9]{64}$'
    AND "sourceAuthoritySha256" ~ '^[a-f0-9]{64}$'
    AND "candidateSha256" ~ '^[a-f0-9]{64}$'
    AND "certificateSha256" ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE "ProjectCertificateLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "certificateVersionId" TEXT NOT NULL,
  "cutId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "state" "ProjectCertificateLineState" NOT NULL,
  "cutLineState" "ProgressMeasurementCutLineState" NOT NULL,
  "taskId" TEXT NOT NULL,
  "cutLineId" TEXT NOT NULL,
  "contractLineId" TEXT NOT NULL,
  "taskCode" VARCHAR(64),
  "taskTitle" TEXT NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "unitCode" "ProgressMeasurementUnitCode",
  "baseQuantity" DECIMAL(18,4),
  "periodQuantity" DECIMAL(18,4),
  "cumulativeQuantity" DECIMAL(18,4),
  "technicalCumulativeOriginPeriodStart" DATE,
  "contractAmountMinor" BIGINT,
  "previousApprovedCumulativeGrossMinor" BIGINT,
  "cumulativeGrossMinor" BIGINT,
  "certificateIncrementGrossMinor" BIGINT,
  "noClaimReason" VARCHAR(1000),
  "cutLineSha256" CHAR(64) NOT NULL,
  "contractLineSha256" CHAR(64) NOT NULL,
  "lineSha256" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificateLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificateLine_ordinal_check" CHECK ("ordinal" > 0),
  CONSTRAINT "ProjectCertificateLine_snapshot_check" CHECK ("taskRevision" >= 0 AND length("taskTitle") > 0),
  CONSTRAINT "ProjectCertificateLine_hashes_check" CHECK (
    "cutLineSha256" ~ '^[a-f0-9]{64}$' AND "contractLineSha256" ~ '^[a-f0-9]{64}$' AND "lineSha256" ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "ProjectCertificateLine_state_check" CHECK (
    ("state" = 'NO_CLAIM'
      AND "unitCode" IS NULL AND "baseQuantity" IS NULL AND "periodQuantity" IS NULL AND "cumulativeQuantity" IS NULL
      AND "technicalCumulativeOriginPeriodStart" IS NULL AND "contractAmountMinor" IS NULL
      AND "previousApprovedCumulativeGrossMinor" IS NULL AND "cumulativeGrossMinor" IS NULL
      AND "certificateIncrementGrossMinor" IS NULL AND "noClaimReason" IS NOT NULL
      AND length(btrim("noClaimReason")) BETWEEN 1 AND 1000)
    OR
    ("state" = 'VALUED'
      AND "cutLineState" = 'MEASURED'
      AND "unitCode" IS NOT NULL AND "baseQuantity" > 0 AND "periodQuantity" >= 0 AND "cumulativeQuantity" >= 0
      AND "cumulativeQuantity" <= "baseQuantity"
      AND "technicalCumulativeOriginPeriodStart" IS NOT NULL AND "contractAmountMinor" >= 0
      AND "previousApprovedCumulativeGrossMinor" >= 0 AND "cumulativeGrossMinor" >= 0
      AND "certificateIncrementGrossMinor" >= 0
      AND "cumulativeGrossMinor" - "previousApprovedCumulativeGrossMinor" = "certificateIncrementGrossMinor"
      AND "noClaimReason" IS NULL)
  )
);

CREATE TABLE "ProjectCertificateDeduction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "certificateVersionId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "lineSha256" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificateDeduction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificateDeduction_input_check" CHECK (
    "ordinal" BETWEEN 1 AND 50
    AND "code" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND length(btrim("reason")) BETWEEN 1 AND 1000
    AND "reason" !~ '[[:cntrl:]]'
    AND "amountMinor" > 0
    AND "lineSha256" ~ '^[a-f0-9]{64}$'
  )
);

CREATE TABLE "ProjectCertificateDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "periodHeadId" TEXT NOT NULL,
  "certificateVersionId" TEXT NOT NULL,
  "decision" "ProjectCertificateDecisionType" NOT NULL,
  "actorBasis" "ProjectCertificateDecisionActorBasis" NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "expectedBookRevision" INTEGER NOT NULL,
  "expectedPeriodHeadRevision" INTEGER NOT NULL,
  "bookRevisionAfter" INTEGER NOT NULL,
  "periodHeadRevisionAfter" INTEGER NOT NULL,
  "certificateSha256Snapshot" CHAR(64) NOT NULL,
  "decidedByMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificateDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificateDecision_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 1 AND 1000 AND "reason" !~ '[[:cntrl:]]'
  ),
  CONSTRAINT "ProjectCertificateDecision_cas_check" CHECK (
    "expectedBookRevision" >= 0 AND "expectedPeriodHeadRevision" >= 0
    AND "bookRevisionAfter" = "expectedBookRevision" + 1
    AND "periodHeadRevisionAfter" = "expectedPeriodHeadRevision" + 1
  ),
  CONSTRAINT "ProjectCertificateDecision_hash_check" CHECK ("certificateSha256Snapshot" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ProjectCertificateDecision_actor_basis_check" CHECK (
    ("decision" IN ('APPROVED', 'REJECTED') AND "actorBasis" = 'EXACT_CERTIFIER')
    OR ("decision" = 'CANCELLED' AND "actorBasis" IN ('EXACT_REGISTRAR', 'FALLBACK_PROJECT_ADMIN'))
  )
);

CREATE TABLE "ProjectCertificateOperationReceipt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "operationKind" "ProjectCertificateOperationKind" NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "certificateVersionId" TEXT NOT NULL,
  "decisionId" TEXT,
  "bookRevisionAfter" INTEGER NOT NULL,
  "periodHeadRevisionAfter" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCertificateOperationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCertificateOperation_hashes_check" CHECK (
    "operationKeyHash" ~ '^[a-f0-9]{64}$' AND "requestFingerprint" ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "ProjectCertificateOperation_revision_check" CHECK (
    "bookRevisionAfter" > 0 AND "periodHeadRevisionAfter" > 0
  ),
  CONSTRAINT "ProjectCertificateOperation_decision_check" CHECK (
    ("operationKind" = 'PREPARE' AND "decisionId" IS NULL)
    OR ("operationKind" IN ('APPROVE', 'REJECT', 'CANCEL') AND "decisionId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "PPMCutLine_certificate_scope_key"
  ON "ProjectProgressMeasurementCutLine"("organizationId", "projectId", "cutId", "taskId", "id");
CREATE UNIQUE INDEX "ProjectContractLine_certificate_scope_key"
  ON "ProjectContractLine"("organizationId", "projectId", "contractVersionId", "taskId", "id");

CREATE UNIQUE INDEX "ProjectCertificateBook_scope_key"
  ON "ProjectCertificateBook"("organizationId", "projectId");
CREATE UNIQUE INDEX "ProjectCertificateBook_scope_id_key"
  ON "ProjectCertificateBook"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ProjectCertificateBook_latest_approved_version_key"
  ON "ProjectCertificateBook"("latestApprovedCertificateVersionId");
CREATE UNIQUE INDEX "ProjectCertificateBook_pending_version_key"
  ON "ProjectCertificateBook"("pendingCertificateVersionId");
CREATE UNIQUE INDEX "ProjectCertificateBook_scope_latest_approved_key"
  ON "ProjectCertificateBook"("organizationId", "projectId", "id", "latestApprovedCertificateVersionId");
CREATE UNIQUE INDEX "ProjectCertificateBook_scope_pending_key"
  ON "ProjectCertificateBook"("organizationId", "projectId", "id", "pendingCertificateVersionId");
CREATE INDEX "ProjectCertificateBook_latest_period_idx"
  ON "ProjectCertificateBook"("organizationId", "projectId", "latestApprovedPeriodStart");

CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_scope_period_key"
  ON "ProjectCertificatePeriodHead"("organizationId", "projectId", "periodStart");
CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_scope_id_key"
  ON "ProjectCertificatePeriodHead"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_book_scope_id_key"
  ON "ProjectCertificatePeriodHead"("organizationId", "projectId", "bookId", "id");
CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_current_approved_key"
  ON "ProjectCertificatePeriodHead"("currentApprovedVersionId");
CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_latest_version_key"
  ON "ProjectCertificatePeriodHead"("latestVersionId");
CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_scope_current_key"
  ON "ProjectCertificatePeriodHead"("organizationId", "projectId", "bookId", "id", "currentApprovedVersionId");
CREATE UNIQUE INDEX "ProjectCertificatePeriodHead_scope_latest_key"
  ON "ProjectCertificatePeriodHead"("organizationId", "projectId", "bookId", "id", "latestVersionId");
CREATE INDEX "ProjectCertificatePeriodHead_project_period_idx"
  ON "ProjectCertificatePeriodHead"("organizationId", "projectId", "periodStart");

CREATE UNIQUE INDEX "ProjectCertificateVersion_book_sequence_key"
  ON "ProjectCertificateVersion"("bookId", "projectSequence");
CREATE UNIQUE INDEX "ProjectCertificateVersion_period_version_key"
  ON "ProjectCertificateVersion"("periodHeadId", "periodVersion");
CREATE UNIQUE INDEX "ProjectCertificateVersion_predecessor_key"
  ON "ProjectCertificateVersion"("predecessorId");
CREATE UNIQUE INDEX "ProjectCertificateVersion_scope_id_key"
  ON "ProjectCertificateVersion"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "ProjectCertificateVersion_book_scope_id_key"
  ON "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "id");
CREATE UNIQUE INDEX "ProjectCertificateVersion_period_scope_id_key"
  ON "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "id");
CREATE UNIQUE INDEX "ProjectCertificateVersion_line_source_scope_key"
  ON "ProjectCertificateVersion"("organizationId", "projectId", "id", "cutId", "contractVersionId");
CREATE UNIQUE INDEX "ProjectCertificateVersion_scope_predecessor_key"
  ON "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "predecessorId");
CREATE INDEX "ProjectCertificateVersion_project_period_idx"
  ON "ProjectCertificateVersion"("organizationId", "projectId", "periodStart", "createdAt");

CREATE UNIQUE INDEX "ProjectCertificateLine_version_ordinal_key"
  ON "ProjectCertificateLine"("certificateVersionId", "ordinal");
CREATE UNIQUE INDEX "ProjectCertificateLine_version_task_key"
  ON "ProjectCertificateLine"("certificateVersionId", "taskId");
CREATE UNIQUE INDEX "ProjectCertificateLine_scope_id_key"
  ON "ProjectCertificateLine"("organizationId", "projectId", "certificateVersionId", "id");
CREATE INDEX "ProjectCertificateLine_task_created_idx"
  ON "ProjectCertificateLine"("organizationId", "projectId", "taskId", "createdAt");

CREATE UNIQUE INDEX "ProjectCertificateDeduction_version_ordinal_key"
  ON "ProjectCertificateDeduction"("certificateVersionId", "ordinal");
CREATE UNIQUE INDEX "ProjectCertificateDeduction_version_code_key"
  ON "ProjectCertificateDeduction"("certificateVersionId", "code");
CREATE UNIQUE INDEX "ProjectCertificateDeduction_scope_id_key"
  ON "ProjectCertificateDeduction"("organizationId", "projectId", "certificateVersionId", "id");

CREATE UNIQUE INDEX "ProjectCertificateDecision_version_key"
  ON "ProjectCertificateDecision"("certificateVersionId");
CREATE UNIQUE INDEX "ProjectCertificateDecision_scope_id_key"
  ON "ProjectCertificateDecision"("organizationId", "projectId", "certificateVersionId", "id");
CREATE UNIQUE INDEX "ProjectCertificateDecision_exact_version_key"
  ON "ProjectCertificateDecision"("organizationId", "projectId", "bookId", "periodHeadId", "certificateVersionId");
CREATE INDEX "ProjectCertificateDecision_project_created_idx"
  ON "ProjectCertificateDecision"("organizationId", "projectId", "createdAt");

CREATE UNIQUE INDEX "ProjectCertificateOperation_org_key"
  ON "ProjectCertificateOperationReceipt"("organizationId", "operationKeyHash");
CREATE UNIQUE INDEX "ProjectCertificateOperation_scope_id_key"
  ON "ProjectCertificateOperationReceipt"("organizationId", "projectId", "certificateVersionId", "id");
CREATE INDEX "ProjectCertificateOperation_project_created_idx"
  ON "ProjectCertificateOperationReceipt"("organizationId", "projectId", "createdAt");

ALTER TABLE "ProjectCertificateBook"
  ADD CONSTRAINT "ProjectCertificateBook_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateBook_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateBook_pinned_contract_fkey"
    FOREIGN KEY ("organizationId", "projectId", "pinnedContractHeadId", "pinnedContractVersionId", "pinnedAuthorityVersionId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "headId", "id", "authorityVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificatePeriodHead"
  ADD CONSTRAINT "ProjectCertificatePeriodHead_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificatePeriodHead_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificatePeriodHead_book_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId")
    REFERENCES "ProjectCertificateBook"("organizationId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificateVersion"
  ADD CONSTRAINT "ProjectCertificateVersion_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_book_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId")
    REFERENCES "ProjectCertificateBook"("organizationId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_period_head_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "periodHeadId")
    REFERENCES "ProjectCertificatePeriodHead"("organizationId", "projectId", "bookId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_predecessor_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "periodHeadId", "predecessorId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_supersedes_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "periodHeadId", "supersedesApprovedVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_previous_approved_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "previousApprovedCertificateVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_cut_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "cutHeadId", "cutId")
    REFERENCES "ProjectProgressMeasurementCut"("organizationId", "projectId", "headId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_contract_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "contractHeadId", "contractVersionId", "authorityVersionId")
    REFERENCES "ProjectContractVersion"("organizationId", "projectId", "headId", "id", "authorityVersionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateVersion_preparer_fkey"
    FOREIGN KEY ("organizationId", "preparedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificateLine"
  ADD CONSTRAINT "ProjectCertificateLine_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateLine_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateLine_version_source_fkey"
    FOREIGN KEY ("organizationId", "projectId", "certificateVersionId", "cutId", "contractVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "id", "cutId", "contractVersionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateLine_task_scope_fkey"
    FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateLine_cut_line_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "cutId", "taskId", "cutLineId")
    REFERENCES "ProjectProgressMeasurementCutLine"("organizationId", "projectId", "cutId", "taskId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateLine_contract_line_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "contractVersionId", "taskId", "contractLineId")
    REFERENCES "ProjectContractLine"("organizationId", "projectId", "contractVersionId", "taskId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificateDeduction"
  ADD CONSTRAINT "ProjectCertificateDeduction_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDeduction_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDeduction_version_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "certificateVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificateDecision"
  ADD CONSTRAINT "ProjectCertificateDecision_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDecision_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDecision_book_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId")
    REFERENCES "ProjectCertificateBook"("organizationId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDecision_period_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "periodHeadId")
    REFERENCES "ProjectCertificatePeriodHead"("organizationId", "projectId", "bookId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDecision_version_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "periodHeadId", "certificateVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateDecision_actor_fkey"
    FOREIGN KEY ("organizationId", "decidedByMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificateOperationReceipt"
  ADD CONSTRAINT "ProjectCertificateOperation_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateOperation_project_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateOperation_actor_fkey"
    FOREIGN KEY ("organizationId", "actorMembershipId")
    REFERENCES "TenantMembership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateOperation_version_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "certificateVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateOperation_decision_scope_fkey"
    FOREIGN KEY ("organizationId", "projectId", "certificateVersionId", "decisionId")
    REFERENCES "ProjectCertificateDecision"("organizationId", "projectId", "certificateVersionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificateBook"
  ADD CONSTRAINT "ProjectCertificateBook_latest_approved_fkey"
    FOREIGN KEY ("organizationId", "projectId", "id", "latestApprovedCertificateVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificateBook_pending_version_fkey"
    FOREIGN KEY ("organizationId", "projectId", "id", "pendingCertificateVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectCertificatePeriodHead"
  ADD CONSTRAINT "ProjectCertificatePeriodHead_current_approved_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "id", "currentApprovedVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectCertificatePeriodHead_latest_version_fkey"
    FOREIGN KEY ("organizationId", "projectId", "bookId", "id", "latestVersionId")
    REFERENCES "ProjectCertificateVersion"("organizationId", "projectId", "bookId", "periodHeadId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "obrasaas_project_certificate_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is governed certificate state and cannot be truncated', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

-- A single freshness oracle is shared by GET capabilities and the APPROVE
-- worker.  It deliberately reconstructs the immutable PREPARE digest with
-- the persisted CAS revisions while rederiving every live technical and
-- contractual input under the caller's already-held domain locks.
CREATE FUNCTION "obrasaas_project_certificate_approval_is_fresh"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_certificate_version_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_version "ProjectCertificateVersion"%ROWTYPE;
  v_candidate RECORD;
  v_candidate_sha TEXT;
BEGIN
  SELECT * INTO v_version FROM "ProjectCertificateVersion"
   WHERE "organizationId" = p_organization_id
     AND "projectId" = p_project_id
     AND "id" = p_certificate_version_id;
  IF v_version."id" IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_candidate FROM "obrasaas_project_certificate_build_candidate"(
    p_organization_id, p_project_id, v_version."periodStart"
  );
  IF v_candidate.blockers <> '[]'::JSONB
    AND v_candidate.blockers <> '["CERT_PENDING_REVIEW"]'::JSONB THEN
    RETURN false;
  END IF;

  v_candidate_sha := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-candidate-v1', p_organization_id, p_project_id,
    to_char(v_version."periodStart", 'YYYY-MM-DD'), to_char(v_candidate.period_end, 'YYYY-MM-DD'),
    v_candidate.mode, v_version."bookRevisionAtPrepare", v_version."periodHeadRevisionAtPrepare",
    v_version."supersedesApprovedVersionId",
    CASE WHEN v_candidate.mode = 'CORRECTION' THEN v_version."supersedesApprovedVersionId"
      WHEN v_candidate.mode = 'NEXT_PERIOD' THEN v_version."previousApprovedCertificateVersionId"
      ELSE NULL END,
    v_candidate.cut_id, v_candidate.cut_candidate_sha256, v_candidate.cut_sha256,
    v_candidate.contract_head_id, v_candidate.contract_version_id, v_candidate.contract_sha256,
    v_candidate.authority_version_id, v_candidate.authority_sha256,
    v_candidate.previous_gross_total::TEXT, v_candidate.cumulative_gross_total::TEXT,
    v_candidate.increment_gross_total::TEXT, v_candidate.previous_retention::TEXT,
    v_candidate.cumulative_retention::TEXT, v_candidate.increment_retention::TEXT,
    (SELECT jsonb_agg(jsonb_build_array(line ->> 'task_id', line ->> 'line_sha')
      ORDER BY line ->> 'task_id') FROM jsonb_array_elements(v_candidate.internal_lines) line)
  )::TEXT, 'UTF8')), 'hex');

  SELECT encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-deducted-candidate-v1', v_candidate_sha,
    COALESCE(jsonb_agg(jsonb_build_array(
      deduction."ordinal", deduction."code", deduction."reason", deduction."amountMinor"::TEXT,
      deduction."lineSha256"::TEXT
    ) ORDER BY deduction."ordinal"), '[]'::JSONB)
  )::TEXT, 'UTF8')), 'hex') INTO v_candidate_sha
    FROM "ProjectCertificateDeduction" deduction
   WHERE deduction."certificateVersionId" = v_version."id";

  RETURN v_candidate_sha IS NOT DISTINCT FROM v_version."candidateSha256"::TEXT
    AND v_candidate.cut_id IS NOT DISTINCT FROM v_version."cutId"
    AND v_candidate.contract_version_id IS NOT DISTINCT FROM v_version."contractVersionId"
    AND v_candidate.authority_version_id IS NOT DISTINCT FROM v_version."authorityVersionId";
END;
$$;

CREATE VIEW "ObrasaasProjectCertificatePrepareCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::DATE AS "periodStart",
  NULL::INTEGER AS "expectedBookRevision",
  NULL::INTEGER AS "expectedPeriodHeadRevision",
  NULL::TEXT AS "expectedCurrentApprovedVersionId",
  NULL::JSONB AS "deductionsInput",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::JSONB AS "payload"
WHERE FALSE;

CREATE FUNCTION "obrasaas_project_certificate_prepare_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_expected_book_revision INTEGER,
  p_expected_period_head_revision INTEGER,
  p_expected_current_approved_version_id TEXT,
  p_deductions JSONB,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_receipt "ProjectCertificateOperationReceipt"%ROWTYPE;
  v_book "ProjectCertificateBook"%ROWTYPE;
  v_head "ProjectCertificatePeriodHead"%ROWTYPE;
  v_candidate RECORD;
  v_book_id TEXT;
  v_head_id TEXT;
  v_version_id TEXT := gen_random_uuid()::TEXT;
  v_receipt_id TEXT := gen_random_uuid()::TEXT;
  v_created_at TIMESTAMP(3) := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_scope TEXT;
  v_period_version INTEGER;
  v_project_sequence BIGINT;
  v_deduction_count INTEGER;
  v_deduction_total NUMERIC;
  v_candidate_sha TEXT;
  v_certificate_sha TEXT;
  v_net NUMERIC;
  v_rows INTEGER;
  v_unchanged BOOLEAN;
BEGIN
  IF pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project certificate prepare worker requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  IF p_organization_id IS NULL OR p_project_id IS NULL OR p_period_start IS NULL
    OR p_actor_membership_id IS NULL
    OR p_expected_book_revision IS NULL OR p_expected_book_revision < 0
    OR p_expected_period_head_revision IS NULL OR p_expected_period_head_revision < 0
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 128
    OR p_deductions IS NULL OR jsonb_typeof(p_deductions) <> 'array' THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: invalid prepare input'
      USING ERRCODE = '22023';
  END IF;
  IF EXTRACT(DAY FROM p_period_start)::INTEGER NOT IN (1, 16) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: period must start on day 1 or 16'
      USING ERRCODE = '22023';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-certificate:operation:' || p_organization_id || ':' || v_operation_hash, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));
  PERFORM "obrasaas_project_certificate_lock_active_actor"(
    p_organization_id, p_project_id, p_actor_membership_id
  );

  SELECT * INTO v_receipt FROM "ProjectCertificateOperationReceipt"
   WHERE "organizationId" = p_organization_id AND "operationKeyHash" = v_operation_hash;
  IF v_receipt."id" IS NOT NULL THEN
    IF v_receipt."projectId" IS DISTINCT FROM p_project_id
      OR v_receipt."operationKind" IS DISTINCT FROM 'PREPARE'::"ProjectCertificateOperationKind"
      OR v_receipt."requestFingerprint"::TEXT IS DISTINCT FROM p_request_fingerprint
      OR v_receipt."actorMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
      RAISE EXCEPTION 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT: operation key was reused with another request'
        USING ERRCODE = '22000';
    END IF;
    RETURN "obrasaas_project_certificate_receipt_payload"(v_receipt."id", true);
  END IF;

  IF NOT "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, p_actor_membership_id, 'SITE_MANAGER'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_PREPARER_REQUIRED: active SITE_MANAGER is required'
      USING ERRCODE = '42501';
  END IF;
  -- On a replay miss, prepare locks the exact approved authority actors before
  -- any task, cut or certificate lock. Concurrent role/status/delete cannot
  -- orphan the proposal between candidate validation and pending insertion.
  PERFORM 1
    FROM "ProjectContractHead" h
    JOIN "ProjectContractVersion" contract
      ON contract."organizationId" = h."organizationId"
     AND contract."projectId" = h."projectId"
     AND contract."headId" = h."id"
     AND contract."id" = h."currentVersionId"
    JOIN "ProjectContractAuthorityVersion" authority
      ON authority."organizationId" = contract."organizationId"
     AND authority."projectId" = contract."projectId"
     AND authority."headId" = contract."headId"
     AND authority."id" = contract."authorityVersionId"
    JOIN "TenantMembership" tm
      ON tm."organizationId" = h."organizationId"
     AND tm."id" IN (authority."certifierMembershipId", authority."registrarMembershipId")
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
   ORDER BY tm."id" FOR SHARE OF tm;
  PERFORM 1
    FROM "ProjectContractHead" h
    JOIN "ProjectContractVersion" contract
      ON contract."organizationId" = h."organizationId"
     AND contract."projectId" = h."projectId"
     AND contract."headId" = h."id"
     AND contract."id" = h."currentVersionId"
    JOIN "ProjectContractAuthorityVersion" authority
      ON authority."organizationId" = contract."organizationId"
     AND authority."projectId" = contract."projectId"
     AND authority."headId" = contract."headId"
     AND authority."id" = contract."authorityVersionId"
    JOIN "ProjectMembership" pm
      ON pm."projectId" = p_project_id
     AND pm."tenantMembershipId" IN (authority."certifierMembershipId", authority."registrarMembershipId")
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
   ORDER BY pm."id" FOR SHARE OF pm;
  PERFORM "obrasaas_project_certificate_lock_domain"(
    p_organization_id, p_project_id, p_period_start
  );

  SELECT * INTO v_book FROM "ProjectCertificateBook"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
   FOR UPDATE;
  IF v_book."id" IS NULL THEN
    v_book_id := gen_random_uuid()::TEXT;
    v_book."id" := v_book_id;
    v_book."revision" := 0;
    v_book."latestVersionSequence" := 0;
    v_book."pendingCertificateVersionId" := NULL;
  ELSE
    v_book_id := v_book."id";
  END IF;
  v_scope := p_organization_id || ':' || p_project_id || ':' || v_book_id;
  PERFORM set_config('obrasaas.project_certificate_write_scope', v_scope, true);
  IF NOT EXISTS (SELECT 1 FROM "ProjectCertificateBook" WHERE "id" = v_book_id) THEN
    INSERT INTO "ProjectCertificateBook"(
      "id", "organizationId", "projectId", "latestVersionSequence",
      "revision", "createdAt", "updatedAt"
    ) VALUES (
      v_book_id, p_organization_id, p_project_id, 0, 0, v_created_at, v_created_at
    );
  END IF;

  SELECT * INTO v_head FROM "ProjectCertificatePeriodHead"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
     AND "periodStart" = p_period_start FOR UPDATE;
  IF v_head."id" IS NULL THEN
    v_head_id := gen_random_uuid()::TEXT;
    v_head."id" := v_head_id;
    v_head."revision" := 0;
    v_head."currentApprovedVersionId" := NULL;
    v_head."latestVersionId" := NULL;
    INSERT INTO "ProjectCertificatePeriodHead"(
      "id", "organizationId", "projectId", "bookId", "periodStart", "periodEnd",
      "revision", "createdAt", "updatedAt"
    ) VALUES (
      v_head_id, p_organization_id, p_project_id, v_book_id, p_period_start,
      CASE EXTRACT(DAY FROM p_period_start)::INTEGER WHEN 1 THEN p_period_start + 14
        ELSE (date_trunc('month', p_period_start) + INTERVAL '1 month - 1 day')::DATE END,
      0, v_created_at, v_created_at
    );
  ELSE
    v_head_id := v_head."id";
  END IF;

  IF v_book."pendingCertificateVersionId" IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_PENDING_REVIEW: another certificate is pending'
      USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_candidate FROM "obrasaas_project_certificate_build_candidate"(
    p_organization_id, p_project_id, p_period_start
  );
  SELECT v_candidate.mode = 'CORRECTION'
    AND v_candidate.blockers = '[]'::JSONB
    AND approved."id" IS NOT NULL
    AND v_candidate.cut_id IS NOT DISTINCT FROM approved."cutId"
    AND v_candidate.cut_candidate_sha256 IS NOT DISTINCT FROM approved."sourceCutCandidateSha256"::TEXT
    AND v_candidate.cut_sha256 IS NOT DISTINCT FROM approved."sourceCutSha256"::TEXT
    INTO v_unchanged
    FROM "ProjectCertificateVersion" approved
   WHERE approved."organizationId" = p_organization_id
     AND approved."projectId" = p_project_id
     AND approved."id" = v_candidate.current_approved_version_id;
  IF COALESCE(v_unchanged, false) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_UNCHANGED: latest approved technical cut is unchanged'
      USING ERRCODE = '55000';
  END IF;
  IF v_candidate.blockers <> '[]'::JSONB OR v_candidate.candidate_sha256 IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_NOT_READY: certificate candidate is blocked'
      USING ERRCODE = '55000';
  END IF;
  IF v_candidate.book_revision IS DISTINCT FROM p_expected_book_revision
    OR v_candidate.period_head_revision IS DISTINCT FROM p_expected_period_head_revision
    OR v_candidate.current_approved_version_id IS DISTINCT FROM p_expected_current_approved_version_id THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_CAS_STALE: certificate head changed'
      USING ERRCODE = '40001';
  END IF;

  SELECT count(*)::INTEGER
    INTO v_deduction_count
    FROM jsonb_array_elements(p_deductions) item;
  IF v_deduction_count > 50 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_deductions) item
     WHERE jsonb_typeof(item) <> 'object'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID: deductions are not canonical'
      USING ERRCODE = '22023';
  END IF;
  -- Each validation phase only invokes operators that are safe for the shape
  -- proved by the preceding phase. PostgreSQL is free to reorder predicates,
  -- so mixing the regex proof with a NUMERIC cast could leak 22P02.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_deductions) item
     WHERE (SELECT count(*) FROM jsonb_object_keys(item)) <> 3
       OR NOT (item ? 'code' AND item ? 'reason' AND item ? 'amountMinor')
       OR jsonb_typeof(item -> 'code') <> 'string'
       OR jsonb_typeof(item -> 'reason') <> 'string'
       OR jsonb_typeof(item -> 'amountMinor') <> 'string'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID: deductions are not canonical'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_deductions) item
     WHERE item ->> 'code' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
       OR length(item ->> 'reason') NOT BETWEEN 1 AND 1000
       OR item ->> 'reason' IS DISTINCT FROM btrim(item ->> 'reason')
       OR item ->> 'reason' ~ '[[:cntrl:]]'
       OR item ->> 'amountMinor' !~ '^[1-9][0-9]{0,18}$'
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID: deductions are not canonical'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_deductions) item
     WHERE (item ->> 'amountMinor')::NUMERIC > 9223372036854775807
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_deductions) item
     GROUP BY item ->> 'code' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID: deductions are not canonical'
      USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(sum((item ->> 'amountMinor')::NUMERIC), 0)
    INTO v_deduction_total
    FROM jsonb_array_elements(p_deductions) item;
  IF v_deduction_total > 9223372036854775807 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_AMOUNT_OVERFLOW: deduction total exceeds BIGINT'
      USING ERRCODE = '22003';
  END IF;
  v_net := v_candidate.increment_gross_total - v_candidate.increment_retention - v_deduction_total;
  IF v_net < 0 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_NET_NEGATIVE: deductions exceed the certificate increment'
      USING ERRCODE = '22003';
  END IF;

  SELECT encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-deducted-candidate-v1', v_candidate.candidate_sha256,
    COALESCE(jsonb_agg(jsonb_build_array(
      ordinal, item ->> 'code', item ->> 'reason', item ->> 'amountMinor',
      "obrasaas_project_certificate_deduction_sha"(
        ordinal::INTEGER, item ->> 'code', item ->> 'reason',
        (item ->> 'amountMinor')::BIGINT
      )
    ) ORDER BY ordinal), '[]'::JSONB)
  )::TEXT, 'UTF8')), 'hex') INTO v_candidate_sha
    FROM jsonb_array_elements(p_deductions) WITH ORDINALITY deductions(item, ordinal);

  v_project_sequence := v_book."latestVersionSequence" + 1;
  SELECT COALESCE(max(version."periodVersion"), 0) + 1 INTO v_period_version
    FROM "ProjectCertificateVersion" version
   WHERE version."periodHeadId" = v_head_id;
  v_certificate_sha := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-v1', p_organization_id, p_project_id,
    v_project_sequence::TEXT, v_period_version, v_candidate.predecessor_id,
    v_candidate_sha, p_actor_membership_id,
    to_char(v_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::TEXT, 'UTF8')), 'hex');

  INSERT INTO "ProjectCertificateVersion"(
    "id", "organizationId", "projectId", "bookId", "periodHeadId",
    "projectSequence", "periodVersion", "predecessorId",
    "supersedesApprovedVersionId", "previousApprovedCertificateVersionId",
    "cutHeadId", "cutId", "contractHeadId", "contractVersionId", "authorityVersionId",
    "periodStart", "periodEnd", "coverageFrom", "coverageThrough",
    "currencyCode", "currencyMinorUnits", "contractualRoundingPolicyVersion",
    "cumulativeGrossPolicyVersion", "cumulativeRetentionPolicyVersion",
    "adjustmentPolicyVersion", "retentionBps", "taskCount", "valuedLineCount",
    "noClaimLineCount", "previousApprovedCumulativeGrossTotalMinor",
    "cumulativeGrossTotalMinor", "certificateIncrementGrossTotalMinor",
    "previousApprovedCumulativeRetentionMinor", "cumulativeRetentionMinor",
    "certificateIncrementRetentionMinor", "certificateIncrementDeductionsMinor",
    "certificateIncrementNetMinor", "sourceCutCandidateSha256", "sourceCutSha256",
    "sourceContractSha256", "sourceAuthoritySha256", "candidateSha256",
    "certificateSha256", "preparedByMembershipId", "bookRevisionAtPrepare",
    "periodHeadRevisionAtPrepare", "createdAt"
  ) VALUES (
    v_version_id, p_organization_id, p_project_id, v_book_id, v_head_id,
    v_project_sequence, v_period_version, v_candidate.predecessor_id,
    v_candidate.supersedes_approved_version_id, v_candidate.previous_approved_version_id,
    v_candidate.cut_head_id, v_candidate.cut_id, v_candidate.contract_head_id,
    v_candidate.contract_version_id, v_candidate.authority_version_id,
    p_period_start, v_candidate.period_end, v_candidate.coverage_from,
    v_candidate.coverage_through, v_candidate.currency_code,
    v_candidate.currency_minor_units, v_candidate.contractual_rounding_policy,
    'CERT_CUMULATIVE_GROSS_HALF_UP_V1', 'CERT_CUMULATIVE_RETENTION_HALF_UP_V1',
    v_candidate.adjustment_policy, v_candidate.retention_bps, v_candidate.task_count,
    v_candidate.valued_line_count, v_candidate.no_claim_line_count,
    v_candidate.previous_gross_total, v_candidate.cumulative_gross_total,
    v_candidate.increment_gross_total, v_candidate.previous_retention,
    v_candidate.cumulative_retention, v_candidate.increment_retention,
    v_deduction_total::BIGINT, v_net::BIGINT, v_candidate.cut_candidate_sha256,
    v_candidate.cut_sha256, v_candidate.contract_sha256, v_candidate.authority_sha256,
    v_candidate_sha, v_certificate_sha, p_actor_membership_id,
    p_expected_book_revision, p_expected_period_head_revision, v_created_at
  );

  INSERT INTO "ProjectCertificateLine"(
    "id", "organizationId", "projectId", "certificateVersionId", "cutId",
    "contractVersionId", "ordinal", "state", "cutLineState", "taskId",
    "cutLineId", "contractLineId", "taskCode", "taskTitle", "taskRevision",
    "unitCode", "baseQuantity", "periodQuantity", "cumulativeQuantity",
    "technicalCumulativeOriginPeriodStart", "contractAmountMinor",
    "previousApprovedCumulativeGrossMinor", "cumulativeGrossMinor",
    "certificateIncrementGrossMinor", "noClaimReason", "cutLineSha256",
    "contractLineSha256", "lineSha256", "createdAt"
  ) SELECT
    gen_random_uuid()::TEXT, p_organization_id, p_project_id, v_version_id,
    v_candidate.cut_id, v_candidate.contract_version_id,
    (line ->> 'ordinal')::INTEGER, (line ->> 'state')::"ProjectCertificateLineState",
    (line ->> 'cut_state')::"ProgressMeasurementCutLineState", line ->> 'task_id',
    line ->> 'cut_line_id', line ->> 'contract_line_id', line ->> 'task_code',
    line ->> 'task_title', (line ->> 'task_revision')::INTEGER,
    (line ->> 'unit_code')::"ProgressMeasurementUnitCode",
    (line ->> 'base_quantity')::NUMERIC(18,4),
    (line ->> 'period_quantity')::NUMERIC(18,4),
    (line ->> 'cumulative_quantity')::NUMERIC(18,4),
    (line ->> 'origin')::DATE, (line ->> 'contract_amount_minor')::BIGINT,
    (line ->> 'previous_gross')::BIGINT, (line ->> 'cumulative_gross')::BIGINT,
    (line ->> 'increment_gross')::BIGINT, line ->> 'no_claim_reason',
    line ->> 'cut_line_sha', line ->> 'contract_line_sha', line ->> 'line_sha', v_created_at
    FROM jsonb_array_elements(v_candidate.internal_lines) line;

  INSERT INTO "ProjectCertificateDeduction"(
    "id", "organizationId", "projectId", "certificateVersionId", "ordinal",
    "code", "reason", "amountMinor", "lineSha256", "createdAt"
  ) SELECT gen_random_uuid()::TEXT, p_organization_id, p_project_id, v_version_id,
      ordinal::INTEGER, item ->> 'code', item ->> 'reason',
      (item ->> 'amountMinor')::BIGINT,
      "obrasaas_project_certificate_deduction_sha"(
        ordinal::INTEGER, item ->> 'code', item ->> 'reason',
        (item ->> 'amountMinor')::BIGINT
      ), v_created_at
    FROM jsonb_array_elements(p_deductions) WITH ORDINALITY deductions(item, ordinal);

  UPDATE "ProjectCertificateBook"
     SET "latestVersionSequence" = v_project_sequence,
         "pendingCertificateVersionId" = v_version_id,
         "revision" = p_expected_book_revision + 1,
         "updatedAt" = v_created_at
   WHERE "id" = v_book_id AND "revision" = p_expected_book_revision
     AND "pendingCertificateVersionId" IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_CAS_STALE: book changed during prepare'
      USING ERRCODE = '40001';
  END IF;
  UPDATE "ProjectCertificatePeriodHead"
     SET "latestVersionId" = v_version_id,
         "revision" = p_expected_period_head_revision + 1,
         "updatedAt" = v_created_at
   WHERE "id" = v_head_id AND "revision" = p_expected_period_head_revision
     AND "currentApprovedVersionId" IS NOT DISTINCT FROM p_expected_current_approved_version_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_CAS_STALE: period head changed during prepare'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO "ProjectCertificateOperationReceipt"(
    "id", "organizationId", "projectId", "operationKind", "operationKeyHash",
    "requestFingerprint", "actorMembershipId", "certificateVersionId",
    "decisionId", "bookRevisionAfter", "periodHeadRevisionAfter", "createdAt"
  ) VALUES (
    v_receipt_id, p_organization_id, p_project_id, 'PREPARE', v_operation_hash,
    p_request_fingerprint, p_actor_membership_id, v_version_id, NULL,
    p_expected_book_revision + 1, p_expected_period_head_revision + 1, v_created_at
  );
  PERFORM set_config('obrasaas.project_certificate_write_scope', '', true);
  RETURN "obrasaas_project_certificate_receipt_payload"(v_receipt_id, false);
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_prepare_command"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project certificate prepare requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  NEW."payload" := "obrasaas_project_certificate_prepare_worker"(
    NEW."organizationId", NEW."projectId", NEW."periodStart",
    NEW."expectedBookRevision", NEW."expectedPeriodHeadRevision",
    NEW."expectedCurrentApprovedVersionId", NEW."deductionsInput",
    NEW."operationKey", NEW."requestFingerprint", NEW."actorMembershipId"
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ObrasaasProjectCertificatePrepareCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProjectCertificatePrepareCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_prepare_command"();

CREATE FUNCTION "obrasaas_project_certificate_prepare"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_expected_book_revision INTEGER,
  p_expected_period_head_revision INTEGER,
  p_expected_current_approved_version_id TEXT,
  p_deductions JSONB,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(payload JSONB)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO "ObrasaasProjectCertificatePrepareCommand" AS command(
    "organizationId", "projectId", "periodStart", "expectedBookRevision",
    "expectedPeriodHeadRevision", "expectedCurrentApprovedVersionId",
    "deductionsInput", "operationKey", "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_period_start, p_expected_book_revision,
    p_expected_period_head_revision, p_expected_current_approved_version_id,
    p_deductions, p_operation_key, p_request_fingerprint, p_actor_membership_id
  ) RETURNING command."payload";
END;
$$;

REVOKE ALL ON FUNCTION "obrasaas_project_certificate_prepare_worker"(
  TEXT, TEXT, DATE, INTEGER, INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;

CREATE VIEW "ObrasaasProjectCertificateDecideCommand" AS
SELECT
  NULL::TEXT AS "organizationId",
  NULL::TEXT AS "projectId",
  NULL::TEXT AS "certificateVersionId",
  NULL::INTEGER AS "expectedBookRevision",
  NULL::INTEGER AS "expectedPeriodHeadRevision",
  NULL::TEXT AS "expectedCertificateDigest",
  NULL::TEXT AS "decisionInput",
  NULL::TEXT AS "reason",
  NULL::TEXT AS "operationKey",
  NULL::TEXT AS "requestFingerprint",
  NULL::TEXT AS "actorMembershipId",
  NULL::JSONB AS "payload"
WHERE FALSE;

CREATE FUNCTION "obrasaas_project_certificate_decide_worker"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_certificate_version_id TEXT,
  p_expected_book_revision INTEGER,
  p_expected_period_head_revision INTEGER,
  p_expected_certificate_sha256 TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operation_hash TEXT;
  v_receipt "ProjectCertificateOperationReceipt"%ROWTYPE;
  v_version "ProjectCertificateVersion"%ROWTYPE;
  v_book "ProjectCertificateBook"%ROWTYPE;
  v_head "ProjectCertificatePeriodHead"%ROWTYPE;
  v_authority "ProjectContractAuthorityVersion"%ROWTYPE;
  v_candidate RECORD;
  v_decision_id TEXT := gen_random_uuid()::TEXT;
  v_receipt_id TEXT := gen_random_uuid()::TEXT;
  v_created_at TIMESTAMP(3) := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  v_scope TEXT;
  v_stored_decision "ProjectCertificateDecisionType";
  v_actor_basis "ProjectCertificateDecisionActorBasis";
  v_certifier_valid BOOLEAN;
  v_registrar_valid BOOLEAN;
  v_maker_valid BOOLEAN;
  v_candidate_sha TEXT;
  v_rows INTEGER;
BEGIN
  IF pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project certificate decide worker requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  IF p_organization_id IS NULL OR p_project_id IS NULL OR p_certificate_version_id IS NULL
    OR p_actor_membership_id IS NULL
    OR p_expected_book_revision IS NULL OR p_expected_book_revision < 1
    OR p_expected_period_head_revision IS NULL OR p_expected_period_head_revision < 1
    OR p_expected_certificate_sha256 IS NULL OR p_expected_certificate_sha256 !~ '^[a-f0-9]{64}$'
    OR p_decision IS NULL OR p_decision NOT IN ('APPROVE','REJECT','CANCEL')
    OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 1000
    OR p_reason IS DISTINCT FROM btrim(p_reason) OR p_reason ~ '[[:cntrl:]]'
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: invalid decision input'
      USING ERRCODE = '22023';
  END IF;

  v_operation_hash := encode(sha256(convert_to(p_operation_key, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-certificate:operation:' || p_organization_id || ':' || v_operation_hash, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));
  PERFORM "obrasaas_project_certificate_lock_active_actor"(
    p_organization_id, p_project_id, p_actor_membership_id
  );

  SELECT * INTO v_receipt FROM "ProjectCertificateOperationReceipt"
   WHERE "organizationId" = p_organization_id AND "operationKeyHash" = v_operation_hash;
  IF v_receipt."id" IS NOT NULL THEN
    IF v_receipt."projectId" IS DISTINCT FROM p_project_id
      OR v_receipt."operationKind"::TEXT IS DISTINCT FROM p_decision
      OR v_receipt."certificateVersionId" IS DISTINCT FROM p_certificate_version_id
      OR v_receipt."requestFingerprint"::TEXT IS DISTINCT FROM p_request_fingerprint
      OR v_receipt."actorMembershipId" IS DISTINCT FROM p_actor_membership_id THEN
      RAISE EXCEPTION 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT: operation key was reused with another request'
        USING ERRCODE = '22000';
    END IF;
    RETURN "obrasaas_project_certificate_receipt_payload"(v_receipt."id", true);
  END IF;

  SELECT * INTO v_version FROM "ProjectCertificateVersion"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
     AND "id" = p_certificate_version_id;
  IF v_version."id" IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: certificate was not found'
      USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_authority FROM "ProjectContractAuthorityVersion"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
     AND "headId" = v_version."contractHeadId" AND "id" = v_version."authorityVersionId";

  -- Lock maker/checker/registrar memberships before technical and ledger state.
  PERFORM 1 FROM "TenantMembership" tm
   WHERE tm."organizationId" = p_organization_id
     AND tm."id" IN (
       v_version."preparedByMembershipId", p_actor_membership_id,
       v_authority."certifierMembershipId", v_authority."registrarMembershipId"
     ) ORDER BY tm."id" FOR SHARE;
  PERFORM 1 FROM "ProjectMembership" pm
   WHERE pm."projectId" = p_project_id
     AND pm."tenantMembershipId" IN (
       v_version."preparedByMembershipId", p_actor_membership_id,
       v_authority."certifierMembershipId", v_authority."registrarMembershipId"
     ) ORDER BY pm."id" FOR SHARE;

  v_certifier_valid := "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
  );
  v_registrar_valid := "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
  );
  v_maker_valid := "obrasaas_project_contract_membership_matches"(
    p_organization_id, p_project_id, v_version."preparedByMembershipId", 'SITE_MANAGER'
  );
  IF p_decision IN ('APPROVE','REJECT') THEN
    IF NOT v_certifier_valid OR p_actor_membership_id <> v_authority."certifierMembershipId" THEN
      RAISE EXCEPTION 'PROJECT_CERTIFICATE_CERTIFIER_REQUIRED: exact active certifier is required'
        USING ERRCODE = '42501';
    END IF;
    v_actor_basis := 'EXACT_CERTIFIER';
  ELSE
    IF v_certifier_valid THEN
      RAISE EXCEPTION 'PROJECT_CERTIFICATE_CANCEL_NOT_ORPHANED: exact certifier can still reject'
        USING ERRCODE = '55000';
    ELSIF v_registrar_valid AND p_actor_membership_id = v_authority."registrarMembershipId" THEN
      v_actor_basis := 'EXACT_REGISTRAR';
    ELSIF NOT v_registrar_valid AND "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_actor_membership_id, 'ADMIN'
    ) THEN
      v_actor_basis := 'FALLBACK_PROJECT_ADMIN';
    ELSE
      RAISE EXCEPTION 'PROJECT_CERTIFICATE_CANCELLER_REQUIRED: registrar or fallback admin is required'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_decision = 'APPROVE' AND (
    NOT v_maker_valid OR v_version."preparedByMembershipId" = p_actor_membership_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_MAKER_INVALID: maker/checker segregation failed'
      USING ERRCODE = '42501';
  END IF;

  PERFORM "obrasaas_project_certificate_lock_domain"(
    p_organization_id, p_project_id, v_version."periodStart"
  );
  SELECT * INTO STRICT v_book FROM "ProjectCertificateBook"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
     AND "id" = v_version."bookId" FOR UPDATE;
  SELECT * INTO STRICT v_head FROM "ProjectCertificatePeriodHead"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
     AND "id" = v_version."periodHeadId" FOR UPDATE;
  IF v_book."pendingCertificateVersionId" IS DISTINCT FROM v_version."id"
    OR v_head."latestVersionId" IS DISTINCT FROM v_version."id" THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_PENDING_REQUIRED: target is not the pending certificate'
      USING ERRCODE = '55000';
  END IF;
  IF v_book."revision" IS DISTINCT FROM p_expected_book_revision
    OR v_head."revision" IS DISTINCT FROM p_expected_period_head_revision THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_CAS_STALE: certificate head changed'
      USING ERRCODE = '40001';
  END IF;
  IF v_version."certificateSha256"::TEXT IS DISTINCT FROM p_expected_certificate_sha256 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_APPROVAL_STALE: certificate digest changed'
      USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM "ProjectCertificateDecision" WHERE "certificateVersionId" = v_version."id") THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_PENDING_REQUIRED: certificate is already decided'
      USING ERRCODE = '55000';
  END IF;

  IF p_decision = 'APPROVE' AND NOT "obrasaas_project_certificate_approval_is_fresh"(
    p_organization_id, p_project_id, v_version."id"
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_APPROVAL_STALE: persisted candidate no longer matches live authority'
      USING ERRCODE = '40001';
  END IF;

  v_stored_decision := CASE p_decision WHEN 'APPROVE' THEN 'APPROVED'
    WHEN 'REJECT' THEN 'REJECTED' ELSE 'CANCELLED' END;
  v_scope := p_organization_id || ':' || p_project_id || ':' || v_book."id";
  PERFORM set_config('obrasaas.project_certificate_write_scope', v_scope, true);
  INSERT INTO "ProjectCertificateDecision"(
    "id", "organizationId", "projectId", "bookId", "periodHeadId",
    "certificateVersionId", "decision", "actorBasis", "reason",
    "expectedBookRevision", "expectedPeriodHeadRevision", "bookRevisionAfter",
    "periodHeadRevisionAfter", "certificateSha256Snapshot",
    "decidedByMembershipId", "createdAt"
  ) VALUES (
    v_decision_id, p_organization_id, p_project_id, v_book."id", v_head."id",
    v_version."id", v_stored_decision, v_actor_basis, p_reason,
    p_expected_book_revision, p_expected_period_head_revision,
    p_expected_book_revision + 1, p_expected_period_head_revision + 1,
    p_expected_certificate_sha256, p_actor_membership_id, v_created_at
  );

  UPDATE "ProjectCertificateBook"
     SET "pendingCertificateVersionId" = NULL,
         "pinnedContractHeadId" = CASE WHEN p_decision = 'APPROVE'
           THEN COALESCE("pinnedContractHeadId", v_version."contractHeadId") ELSE "pinnedContractHeadId" END,
         "pinnedContractVersionId" = CASE WHEN p_decision = 'APPROVE'
           THEN COALESCE("pinnedContractVersionId", v_version."contractVersionId") ELSE "pinnedContractVersionId" END,
         "pinnedAuthorityVersionId" = CASE WHEN p_decision = 'APPROVE'
           THEN COALESCE("pinnedAuthorityVersionId", v_version."authorityVersionId") ELSE "pinnedAuthorityVersionId" END,
         "latestApprovedPeriodStart" = CASE WHEN p_decision = 'APPROVE'
           THEN v_version."periodStart" ELSE "latestApprovedPeriodStart" END,
         "latestApprovedCertificateVersionId" = CASE WHEN p_decision = 'APPROVE'
           THEN v_version."id" ELSE "latestApprovedCertificateVersionId" END,
         "revision" = p_expected_book_revision + 1,
         "updatedAt" = v_created_at
   WHERE "id" = v_book."id" AND "revision" = p_expected_book_revision
     AND "pendingCertificateVersionId" = v_version."id";
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_CAS_STALE: book changed during decision'
      USING ERRCODE = '40001';
  END IF;
  UPDATE "ProjectCertificatePeriodHead"
     SET "currentApprovedVersionId" = CASE WHEN p_decision = 'APPROVE'
           THEN v_version."id" ELSE "currentApprovedVersionId" END,
         "revision" = p_expected_period_head_revision + 1,
         "updatedAt" = v_created_at
   WHERE "id" = v_head."id" AND "revision" = p_expected_period_head_revision
     AND "latestVersionId" = v_version."id";
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_CAS_STALE: period head changed during decision'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO "ProjectCertificateOperationReceipt"(
    "id", "organizationId", "projectId", "operationKind", "operationKeyHash",
    "requestFingerprint", "actorMembershipId", "certificateVersionId",
    "decisionId", "bookRevisionAfter", "periodHeadRevisionAfter", "createdAt"
  ) VALUES (
    v_receipt_id, p_organization_id, p_project_id,
    p_decision::"ProjectCertificateOperationKind", v_operation_hash,
    p_request_fingerprint, p_actor_membership_id, v_version."id", v_decision_id,
    p_expected_book_revision + 1, p_expected_period_head_revision + 1, v_created_at
  );
  PERFORM set_config('obrasaas.project_certificate_write_scope', '', true);
  RETURN "obrasaas_project_certificate_receipt_payload"(v_receipt_id, false);
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_decide_command"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR pg_trigger_depth() <> 1 THEN
    RAISE EXCEPTION 'project certificate decision requires its governed command trigger'
      USING ERRCODE = '42501';
  END IF;
  NEW."payload" := "obrasaas_project_certificate_decide_worker"(
    NEW."organizationId", NEW."projectId", NEW."certificateVersionId",
    NEW."expectedBookRevision", NEW."expectedPeriodHeadRevision",
    NEW."expectedCertificateDigest", NEW."decisionInput", NEW."reason",
    NEW."operationKey", NEW."requestFingerprint", NEW."actorMembershipId"
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ObrasaasProjectCertificateDecideCommand_governed_insert"
INSTEAD OF INSERT ON "ObrasaasProjectCertificateDecideCommand"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_decide_command"();

CREATE FUNCTION "obrasaas_project_certificate_decide"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_certificate_version_id TEXT,
  p_expected_book_revision INTEGER,
  p_expected_period_head_revision INTEGER,
  p_expected_certificate_sha256 TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_actor_membership_id TEXT
)
RETURNS TABLE(payload JSONB)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO "ObrasaasProjectCertificateDecideCommand" AS command(
    "organizationId", "projectId", "certificateVersionId", "expectedBookRevision",
    "expectedPeriodHeadRevision", "expectedCertificateDigest", "decisionInput",
    "reason", "operationKey", "requestFingerprint", "actorMembershipId"
  ) VALUES (
    p_organization_id, p_project_id, p_certificate_version_id,
    p_expected_book_revision, p_expected_period_head_revision,
    p_expected_certificate_sha256, p_decision, p_reason, p_operation_key,
    p_request_fingerprint, p_actor_membership_id
  ) RETURNING command."payload";
END;
$$;

REVOKE ALL ON FUNCTION "obrasaas_project_certificate_decide_worker"(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

-- Convert the private, snake_case candidate record into the exact public DTO.
-- Internal pricing inputs and line hashes never escape this boundary.
CREATE FUNCTION "obrasaas_project_certificate_candidate_json"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate RECORD;
  v_lines JSONB;
BEGIN
  SELECT * INTO v_candidate
    FROM "obrasaas_project_certificate_build_candidate"(
      p_organization_id, p_project_id, p_period_start
    );
  IF v_candidate.blockers <> '[]'::JSONB OR v_candidate.candidate_sha256 IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'ordinal', (line ->> 'ordinal')::INTEGER,
    'state', line ->> 'state',
    'cutState', line ->> 'cut_state',
    'taskId', line ->> 'task_id',
    'taskCode', line -> 'task_code',
    'taskTitle', line ->> 'task_title',
    'taskRevision', (line ->> 'task_revision')::INTEGER,
    'cutLineId', line ->> 'cut_line_id',
    'cutLineDigest', line ->> 'cut_line_sha',
    'contractLineId', line ->> 'contract_line_id',
    'contractLineDigest', line ->> 'contract_line_sha',
    'unitCode', line -> 'unit_code',
    'baseQuantity', line -> 'base_quantity',
    'periodQuantity', line -> 'period_quantity',
    'cumulativeQuantity', line -> 'cumulative_quantity',
    'technicalCumulativeOriginPeriodStart', line -> 'origin',
    'previousApprovedCumulativeGrossMinor', line -> 'previous_gross',
    'cumulativeGrossMinor', line -> 'cumulative_gross',
    'certificateIncrementGrossMinor', line -> 'increment_gross',
    'noClaimReason', line -> 'no_claim_reason'
  ) ORDER BY (line ->> 'ordinal')::INTEGER), '[]'::JSONB)
    INTO v_lines
    FROM jsonb_array_elements(v_candidate.internal_lines) line;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start', to_char(p_period_start, 'YYYY-MM-DD'),
      'end', to_char(v_candidate.period_end, 'YYYY-MM-DD')
    ),
    'mode', v_candidate.mode,
    'expectedBookRevision', v_candidate.book_revision,
    'expectedPeriodHeadRevision', v_candidate.period_head_revision,
    'expectedCurrentApprovedVersionId', v_candidate.current_approved_version_id,
    'coverageFrom', to_char(v_candidate.coverage_from, 'YYYY-MM-DD'),
    'coverageThrough', to_char(v_candidate.coverage_through, 'YYYY-MM-DD'),
    'previousApprovedCertificateVersionId', v_candidate.previous_approved_version_id,
    'supersedesApprovedVersionId', v_candidate.supersedes_approved_version_id,
    'source', jsonb_build_object(
      'cutId', v_candidate.cut_id,
      'cutCandidateDigest', v_candidate.cut_candidate_sha256,
      'cutIntegrityDigest', v_candidate.cut_sha256,
      'contractHeadId', v_candidate.contract_head_id,
      'contractVersionId', v_candidate.contract_version_id,
      'contractDigest', v_candidate.contract_sha256,
      'authorityVersionId', v_candidate.authority_version_id,
      'authorityDigest', v_candidate.authority_sha256
    ),
    'terms', jsonb_build_object(
      'currencyCode', v_candidate.currency_code,
      'currencyMinorUnits', v_candidate.currency_minor_units,
      'retentionBps', v_candidate.retention_bps,
      'contractRoundingPolicyVersion', v_candidate.contractual_rounding_policy,
      'certificateGrossPolicyVersion', 'CERT_CUMULATIVE_GROSS_HALF_UP_V1',
      'certificateRetentionPolicyVersion', 'CERT_CUMULATIVE_RETENTION_HALF_UP_V1',
      'adjustmentPolicyVersion', v_candidate.adjustment_policy
    ),
    'lineCount', v_candidate.task_count,
    'valuedLineCount', v_candidate.valued_line_count,
    'noClaimLineCount', v_candidate.no_claim_line_count,
    'totals', jsonb_build_object(
      'previousApprovedCumulativeGrossMinor', v_candidate.previous_gross_total::TEXT,
      'cumulativeGrossMinor', v_candidate.cumulative_gross_total::TEXT,
      'certificateIncrementGrossMinor', v_candidate.increment_gross_total::TEXT,
      'previousApprovedCumulativeRetentionMinor', v_candidate.previous_retention::TEXT,
      'cumulativeRetentionMinor', v_candidate.cumulative_retention::TEXT,
      'certificateIncrementRetentionMinor', v_candidate.increment_retention::TEXT
    ),
    'lines', v_lines
  );
END;
$$;

-- Lock the complete technical universe in canonical order. Callers already
-- hold raw-project and contract scope; this helper adds task, cut and finally
-- certificate scope locks before any candidate is trusted.
CREATE FUNCTION "obrasaas_project_certificate_lock_domain"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  FOR v_value IN
    WITH task_ids AS (
      SELECT line."taskId" AS value
        FROM "ProjectProgressMeasurementCutLine" line
        JOIN "ProjectProgressMeasurementCutHead" head
          ON head."organizationId" = line."organizationId"
         AND head."projectId" = line."projectId"
         AND head."currentCutId" = line."cutId"
       WHERE head."organizationId" = p_organization_id
         AND head."projectId" = p_project_id
         AND head."periodStart" = p_period_start
      UNION
      SELECT line."taskId"
        FROM "ProjectCertificateLine" line
        JOIN "ProjectCertificatePeriodHead" head
          ON head."organizationId" = line."organizationId"
         AND head."projectId" = line."projectId"
         AND head."currentApprovedVersionId" = line."certificateVersionId"
       WHERE head."organizationId" = p_organization_id
         AND head."projectId" = p_project_id
    ) SELECT value FROM task_ids ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_organization_id || ':' || p_project_id || ':' || v_value, 0
    ));
  END LOOP;

  FOR v_value IN
    WITH period_starts AS (
      SELECT p_period_start AS value
      UNION
      SELECT head."periodStart"
        FROM "ProjectCertificatePeriodHead" head
       WHERE head."organizationId" = p_organization_id
         AND head."projectId" = p_project_id
         AND head."currentApprovedVersionId" IS NOT NULL
    ) SELECT to_char(value, 'YYYY-MM-DD') FROM period_starts ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'progress-measurement-cut:scope:' || p_organization_id || ':' ||
        p_project_id || ':' || v_value, 0
    ));
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-certificate:scope:' || p_organization_id || ':' || p_project_id, 0
  ));
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_read"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE,
  p_actor_membership_id TEXT
)
RETURNS TABLE(payload JSONB)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate RECORD;
  v_book "ProjectCertificateBook"%ROWTYPE;
  v_head "ProjectCertificatePeriodHead"%ROWTYPE;
  v_pending "ProjectCertificateVersion"%ROWTYPE;
  v_authority "ProjectContractAuthorityVersion"%ROWTYPE;
  v_candidate_json JSONB;
  v_history JSONB;
  v_blockers JSONB;
  v_readiness_state TEXT;
  v_prepare_allowed BOOLEAN;
  v_approve_allowed BOOLEAN;
  v_reject_allowed BOOLEAN;
  v_cancel_allowed BOOLEAN;
  v_certifier_valid BOOLEAN := false;
  v_registrar_valid BOOLEAN := false;
  v_admin_valid BOOLEAN := false;
  v_maker_valid BOOLEAN := false;
  v_unchanged BOOLEAN := false;
  v_approval_fresh BOOLEAN := false;
BEGIN
  IF p_organization_id IS NULL OR p_project_id IS NULL OR p_period_start IS NULL
    OR p_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: read scope is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || p_organization_id || ':' || p_project_id, 0
  ));
  PERFORM "obrasaas_project_certificate_lock_active_actor"(
    p_organization_id, p_project_id, p_actor_membership_id
  );
  IF NOT "obrasaas_project_certificate_actor_can_read"(
    p_organization_id, p_project_id, p_actor_membership_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_READ_FORBIDDEN: certificate read role is required'
      USING ERRCODE = '42501';
  END IF;
  PERFORM "obrasaas_project_certificate_lock_domain"(
    p_organization_id, p_project_id, p_period_start
  );

  SELECT * INTO v_candidate FROM "obrasaas_project_certificate_build_candidate"(
    p_organization_id, p_project_id, p_period_start
  );
  v_blockers := v_candidate.blockers;
  SELECT v_candidate.mode = 'CORRECTION'
    AND v_candidate.blockers = '[]'::JSONB
    AND approved."id" IS NOT NULL
    AND v_candidate.cut_id IS NOT DISTINCT FROM approved."cutId"
    AND v_candidate.cut_candidate_sha256 IS NOT DISTINCT FROM approved."sourceCutCandidateSha256"::TEXT
    AND v_candidate.cut_sha256 IS NOT DISTINCT FROM approved."sourceCutSha256"::TEXT
    INTO v_unchanged
    FROM "ProjectCertificateVersion" approved
   WHERE approved."organizationId" = p_organization_id
     AND approved."projectId" = p_project_id
     AND approved."id" = v_candidate.current_approved_version_id;
  v_candidate_json := CASE WHEN v_blockers = '[]'::JSONB AND NOT COALESCE(v_unchanged, false)
    THEN "obrasaas_project_certificate_candidate_json"(
      p_organization_id, p_project_id, p_period_start
    ) ELSE NULL END;

  SELECT * INTO v_book FROM "ProjectCertificateBook"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id;
  SELECT * INTO v_head FROM "ProjectCertificatePeriodHead"
   WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
     AND "periodStart" = p_period_start;
  IF v_book."pendingCertificateVersionId" IS NOT NULL THEN
    SELECT * INTO v_pending FROM "ProjectCertificateVersion"
     WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
       AND "id" = v_book."pendingCertificateVersionId";
    SELECT * INTO v_authority FROM "ProjectContractAuthorityVersion"
     WHERE "organizationId" = p_organization_id AND "projectId" = p_project_id
       AND "headId" = v_pending."contractHeadId"
       AND "id" = v_pending."authorityVersionId";
    v_certifier_valid := "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
    );
    v_registrar_valid := "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
    );
    v_admin_valid := "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_actor_membership_id, 'ADMIN'
    );
    v_maker_valid := "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_pending."preparedByMembershipId", 'SITE_MANAGER'
    );
    v_approval_fresh := "obrasaas_project_certificate_approval_is_fresh"(
      p_organization_id, p_project_id, v_pending."id"
    );
  END IF;

  v_prepare_allowed := v_blockers = '[]'::JSONB AND NOT COALESCE(v_unchanged, false)
    AND "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, p_actor_membership_id, 'SITE_MANAGER'
    );
  v_approve_allowed := v_pending."id" IS NOT NULL AND v_certifier_valid
    AND v_authority."certifierMembershipId" = p_actor_membership_id
    AND v_maker_valid AND v_pending."preparedByMembershipId" <> p_actor_membership_id
    AND v_approval_fresh;
  v_reject_allowed := v_pending."id" IS NOT NULL AND v_certifier_valid
    AND v_authority."certifierMembershipId" = p_actor_membership_id;
  v_cancel_allowed := v_pending."id" IS NOT NULL AND NOT v_certifier_valid AND (
    (v_registrar_valid AND v_authority."registrarMembershipId" = p_actor_membership_id)
    OR (NOT v_registrar_valid AND v_admin_valid)
  );
  v_readiness_state := CASE
    WHEN v_blockers ? 'CERT_PENDING_REVIEW' THEN 'REVIEW_PENDING'
    WHEN COALESCE(v_unchanged, false) THEN 'UP_TO_DATE'
    WHEN v_blockers = '[]'::JSONB THEN 'READY' ELSE 'BLOCKED' END;

  SELECT COALESCE(jsonb_agg(
    "obrasaas_project_certificate_version_json"(
      p_organization_id, p_project_id, history."id", true
    ) ORDER BY history."periodVersion" DESC
  ), '[]'::JSONB) INTO v_history
    FROM (
      SELECT version."id", version."periodVersion"
        FROM "ProjectCertificateVersion" version
       WHERE version."organizationId" = p_organization_id
         AND version."projectId" = p_project_id
         AND version."periodStart" = p_period_start
         AND version."periodEnd" = v_candidate.period_end
       ORDER BY version."periodVersion" DESC LIMIT 20
    ) history;

  payload := jsonb_build_object(
    'book', CASE WHEN v_book."id" IS NULL THEN NULL ELSE
      "obrasaas_project_certificate_book_json"(
        p_organization_id, p_project_id, v_book."id"
      ) END,
    'periodHead', CASE WHEN v_head."id" IS NULL THEN NULL ELSE
      "obrasaas_project_certificate_period_head_json"(
        p_organization_id, p_project_id, v_head."id"
      ) END,
    'currentApprovedCertificate', CASE WHEN v_head."currentApprovedVersionId" IS NULL THEN NULL ELSE
      "obrasaas_project_certificate_version_json"(
        p_organization_id, p_project_id, v_head."currentApprovedVersionId", false
      ) END,
    'pendingCertificate', CASE WHEN v_pending."id" IS NULL THEN NULL ELSE
      "obrasaas_project_certificate_version_json"(
        p_organization_id, p_project_id, v_pending."id", false
      ) END,
    'history', v_history,
    'readiness', jsonb_build_object(
      'state', v_readiness_state,
      'mode', CASE WHEN v_readiness_state = 'READY' THEN v_candidate.mode ELSE NULL END,
      'blockingReasons', v_blockers,
      'candidateReady', v_readiness_state = 'READY'
    ),
    'candidate', v_candidate_json,
    'capabilities', jsonb_build_object(
      'read', jsonb_build_object('allowed', true, 'reasonCode', NULL),
      'prepare', jsonb_build_object(
        'allowed', v_prepare_allowed,
        'reasonCode', CASE WHEN v_prepare_allowed THEN NULL
          WHEN NOT "obrasaas_project_contract_membership_matches"(
            p_organization_id, p_project_id, p_actor_membership_id, 'SITE_MANAGER'
          ) THEN 'CERT_PREPARER_REQUIRED' ELSE 'CERT_NOT_READY' END,
        'expectedActorMembershipId', CASE WHEN v_prepare_allowed THEN p_actor_membership_id ELSE NULL END
      ),
      'approve', jsonb_build_object(
        'allowed', v_approve_allowed,
        'reasonCode', CASE WHEN v_approve_allowed THEN NULL WHEN v_pending."id" IS NULL THEN 'CERT_PENDING_REQUIRED'
          WHEN NOT v_certifier_valid OR v_authority."certifierMembershipId" <> p_actor_membership_id THEN 'CERT_CERTIFIER_REQUIRED'
          WHEN NOT v_maker_valid OR v_pending."preparedByMembershipId" = p_actor_membership_id THEN 'CERT_MAKER_INVALID'
          ELSE 'CERT_APPROVAL_STALE' END,
        'expectedActorMembershipId', CASE WHEN v_approve_allowed THEN p_actor_membership_id ELSE NULL END,
        'targetId', v_pending."id"
      ),
      'reject', jsonb_build_object(
        'allowed', v_reject_allowed,
        'reasonCode', CASE WHEN v_reject_allowed THEN NULL WHEN v_pending."id" IS NULL THEN 'CERT_PENDING_REQUIRED'
          ELSE 'CERT_CERTIFIER_REQUIRED' END,
        'expectedActorMembershipId', CASE WHEN v_reject_allowed THEN p_actor_membership_id ELSE NULL END,
        'targetId', v_pending."id"
      ),
      'cancel', jsonb_build_object(
        'allowed', v_cancel_allowed,
        'reasonCode', CASE WHEN v_cancel_allowed THEN NULL WHEN v_pending."id" IS NULL THEN 'CERT_PENDING_REQUIRED'
          WHEN v_certifier_valid THEN 'CERT_CANCEL_NOT_ORPHANED' ELSE 'CERT_CANCELLER_REQUIRED' END,
        'expectedActorMembershipId', CASE WHEN v_cancel_allowed THEN p_actor_membership_id ELSE NULL END,
        'targetId', v_pending."id"
      )
    )
  );
  RETURN NEXT;
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_book_json"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_book_id TEXT,
  p_revision_override INTEGER DEFAULT NULL,
  p_pending_override TEXT DEFAULT NULL,
  p_pending_override_set BOOLEAN DEFAULT false,
  p_latest_period_override DATE DEFAULT NULL,
  p_latest_version_override TEXT DEFAULT NULL,
  p_latest_override_set BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN b."id" IS NULL THEN NULL ELSE jsonb_build_object(
    'id', b."id",
    'revision', COALESCE(p_revision_override, b."revision"),
    'pinnedContractHeadId', b."pinnedContractHeadId",
    'pinnedContractVersionId', b."pinnedContractVersionId",
    'pinnedAuthorityVersionId', b."pinnedAuthorityVersionId",
    'latestApprovedPeriodStart', CASE
      WHEN p_latest_override_set THEN CASE WHEN p_latest_period_override IS NULL THEN NULL ELSE to_char(p_latest_period_override, 'YYYY-MM-DD') END
      WHEN b."latestApprovedPeriodStart" IS NULL THEN NULL ELSE to_char(b."latestApprovedPeriodStart", 'YYYY-MM-DD') END,
    'latestApprovedCertificateVersionId', CASE WHEN p_latest_override_set THEN p_latest_version_override ELSE b."latestApprovedCertificateVersionId" END,
    'pendingCertificateVersionId', CASE WHEN p_pending_override_set THEN p_pending_override ELSE b."pendingCertificateVersionId" END
  ) END
  FROM (SELECT p_book_id AS requested_id) requested
  LEFT JOIN "ProjectCertificateBook" b
    ON b."id" = requested.requested_id
   AND b."organizationId" = p_organization_id AND b."projectId" = p_project_id;
$$;

CREATE FUNCTION "obrasaas_project_certificate_period_head_json"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_head_id TEXT,
  p_revision_override INTEGER DEFAULT NULL,
  p_current_override TEXT DEFAULT NULL,
  p_current_override_set BOOLEAN DEFAULT false,
  p_latest_override TEXT DEFAULT NULL,
  p_latest_override_set BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN h."id" IS NULL THEN NULL ELSE jsonb_build_object(
    'id', h."id",
    'revision', COALESCE(p_revision_override, h."revision"),
    'currentApprovedVersionId', CASE WHEN p_current_override_set THEN p_current_override ELSE h."currentApprovedVersionId" END,
    'latestVersionId', CASE WHEN p_latest_override_set THEN p_latest_override ELSE h."latestVersionId" END
  ) END
  FROM (SELECT p_period_head_id AS requested_id) requested
  LEFT JOIN "ProjectCertificatePeriodHead" h
    ON h."id" = requested.requested_id
   AND h."organizationId" = p_organization_id AND h."projectId" = p_project_id;
$$;

CREATE FUNCTION "obrasaas_project_certificate_version_json"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_certificate_version_id TEXT,
  p_summary BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH target AS (
    SELECT v.* FROM "ProjectCertificateVersion" v
     WHERE v."organizationId" = p_organization_id AND v."projectId" = p_project_id
       AND v."id" = p_certificate_version_id
  ), decision AS (
    SELECT d.*, jsonb_build_object(
      'id', d."id", 'decision', d."decision"::TEXT, 'reason', d."reason",
      'decidedByMembershipId', d."decidedByMembershipId",
      'decidedAt', to_char(d."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) AS payload
    FROM "ProjectCertificateDecision" d
    JOIN target v ON v."id" = d."certificateVersionId"
  ), lines AS (
    SELECT l."certificateVersionId", jsonb_agg(jsonb_build_object(
      'ordinal', l."ordinal", 'state', l."state"::TEXT,
      'cutState', l."cutLineState"::TEXT, 'taskId', l."taskId",
      'taskCode', l."taskCode", 'taskTitle', l."taskTitle", 'taskRevision', l."taskRevision",
      'cutLineId', l."cutLineId", 'cutLineDigest', l."cutLineSha256"::TEXT,
      'contractLineId', l."contractLineId", 'contractLineDigest', l."contractLineSha256"::TEXT,
      'unitCode', l."unitCode"::TEXT,
      'baseQuantity', CASE WHEN l."baseQuantity" IS NULL THEN NULL ELSE to_char(l."baseQuantity", 'FM99999999999999.0000') END,
      'periodQuantity', CASE WHEN l."periodQuantity" IS NULL THEN NULL ELSE to_char(l."periodQuantity", 'FM99999999999999.0000') END,
      'cumulativeQuantity', CASE WHEN l."cumulativeQuantity" IS NULL THEN NULL ELSE to_char(l."cumulativeQuantity", 'FM99999999999999.0000') END,
      'technicalCumulativeOriginPeriodStart', CASE WHEN l."technicalCumulativeOriginPeriodStart" IS NULL THEN NULL ELSE to_char(l."technicalCumulativeOriginPeriodStart", 'YYYY-MM-DD') END,
      'previousApprovedCumulativeGrossMinor', CASE WHEN l."previousApprovedCumulativeGrossMinor" IS NULL THEN NULL ELSE l."previousApprovedCumulativeGrossMinor"::TEXT END,
      'cumulativeGrossMinor', CASE WHEN l."cumulativeGrossMinor" IS NULL THEN NULL ELSE l."cumulativeGrossMinor"::TEXT END,
      'certificateIncrementGrossMinor', CASE WHEN l."certificateIncrementGrossMinor" IS NULL THEN NULL ELSE l."certificateIncrementGrossMinor"::TEXT END,
      'noClaimReason', l."noClaimReason", 'integrityDigest', l."lineSha256"::TEXT
    ) ORDER BY l."ordinal") AS payload
    FROM "ProjectCertificateLine" l JOIN target v ON v."id" = l."certificateVersionId"
    GROUP BY l."certificateVersionId"
  ), deductions AS (
    SELECT d."certificateVersionId", jsonb_agg(jsonb_build_object(
      'ordinal', d."ordinal", 'code', d."code", 'reason', d."reason",
      'amountMinor', d."amountMinor"::TEXT, 'integrityDigest', d."lineSha256"::TEXT
    ) ORDER BY d."ordinal") AS payload, count(*)::INTEGER AS deduction_count
    FROM "ProjectCertificateDeduction" d JOIN target v ON v."id" = d."certificateVersionId"
    GROUP BY d."certificateVersionId"
  ), base AS (
    SELECT v.*, jsonb_build_object(
      'id', v."id", 'projectSequence', v."projectSequence"::TEXT,
      'periodVersion', v."periodVersion", 'predecessorId', v."predecessorId",
      'supersedesApprovedVersionId', v."supersedesApprovedVersionId",
      'previousApprovedCertificateVersionId', v."previousApprovedCertificateVersionId",
      'period', jsonb_build_object('start', to_char(v."periodStart", 'YYYY-MM-DD'), 'end', to_char(v."periodEnd", 'YYYY-MM-DD')),
      'coverageFrom', to_char(v."coverageFrom", 'YYYY-MM-DD'), 'coverageThrough', to_char(v."coverageThrough", 'YYYY-MM-DD'),
      'source', jsonb_build_object(
        'cutId', v."cutId", 'cutCandidateDigest', v."sourceCutCandidateSha256"::TEXT,
        'cutIntegrityDigest', v."sourceCutSha256"::TEXT, 'contractHeadId', v."contractHeadId",
        'contractVersionId', v."contractVersionId", 'contractDigest', v."sourceContractSha256"::TEXT,
        'authorityVersionId', v."authorityVersionId", 'authorityDigest', v."sourceAuthoritySha256"::TEXT),
      'terms', jsonb_build_object(
        'currencyCode', v."currencyCode", 'currencyMinorUnits', v."currencyMinorUnits",
        'retentionBps', v."retentionBps", 'contractRoundingPolicyVersion', v."contractualRoundingPolicyVersion",
        'certificateGrossPolicyVersion', v."cumulativeGrossPolicyVersion",
        'certificateRetentionPolicyVersion', v."cumulativeRetentionPolicyVersion",
        'adjustmentPolicyVersion', v."adjustmentPolicyVersion"),
      'preparedByMembershipId', v."preparedByMembershipId",
      'preparedAt', to_char(v."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'lineCount', v."taskCount", 'valuedLineCount', v."valuedLineCount",
      'noClaimLineCount', v."noClaimLineCount", 'deductionCount', COALESCE(deductions.deduction_count, 0),
      'totals', jsonb_build_object(
        'previousApprovedCumulativeGrossMinor', v."previousApprovedCumulativeGrossTotalMinor"::TEXT,
        'cumulativeGrossMinor', v."cumulativeGrossTotalMinor"::TEXT,
        'certificateIncrementGrossMinor', v."certificateIncrementGrossTotalMinor"::TEXT,
        'previousApprovedCumulativeRetentionMinor', v."previousApprovedCumulativeRetentionMinor"::TEXT,
        'cumulativeRetentionMinor', v."cumulativeRetentionMinor"::TEXT,
        'certificateIncrementRetentionMinor', v."certificateIncrementRetentionMinor"::TEXT,
        'certificateIncrementDeductionsMinor', v."certificateIncrementDeductionsMinor"::TEXT,
        'certificateIncrementNetMinor', v."certificateIncrementNetMinor"::TEXT),
      'candidateDigest', v."candidateSha256"::TEXT,
      'integrityDigest', v."certificateSha256"::TEXT,
      'decision', decision.payload
    ) AS payload
    FROM target v LEFT JOIN decision ON true LEFT JOIN deductions ON deductions."certificateVersionId" = v."id"
  )
  SELECT CASE WHEN base."id" IS NULL THEN NULL
    WHEN p_summary THEN base.payload
    ELSE base.payload || jsonb_build_object(
      'lines', COALESCE(lines.payload, '[]'::JSONB),
      'deductions', COALESCE(deductions.payload, '[]'::JSONB)
    ) END
  FROM base LEFT JOIN lines ON lines."certificateVersionId" = base."id"
  LEFT JOIN deductions ON deductions."certificateVersionId" = base."id";
$$;

CREATE FUNCTION "obrasaas_project_certificate_receipt_payload"(
  p_receipt_id TEXT,
  p_replayed BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_receipt "ProjectCertificateOperationReceipt"%ROWTYPE;
  v_version "ProjectCertificateVersion"%ROWTYPE;
  v_decision "ProjectCertificateDecision"%ROWTYPE;
  v_book_json JSONB;
  v_head_json JSONB;
  v_current_before TEXT;
  v_latest_period_before DATE;
  v_latest_approved_before TEXT;
  v_certificate_json JSONB;
BEGIN
  SELECT r.* INTO STRICT v_receipt FROM "ProjectCertificateOperationReceipt" r WHERE r."id" = p_receipt_id;
  SELECT v.* INTO STRICT v_version FROM "ProjectCertificateVersion" v WHERE v."id" = v_receipt."certificateVersionId";
  IF v_receipt."decisionId" IS NOT NULL THEN
    SELECT d.* INTO STRICT v_decision FROM "ProjectCertificateDecision" d WHERE d."id" = v_receipt."decisionId";
  END IF;

  IF v_receipt."operationKind" = 'PREPARE' THEN
    v_current_before := v_version."supersedesApprovedVersionId";
    SELECT previous."periodStart", previous."id" INTO v_latest_period_before, v_latest_approved_before
      FROM "ProjectCertificateVersion" previous
     WHERE previous."id" = v_version."previousApprovedCertificateVersionId";
    IF v_version."supersedesApprovedVersionId" IS NOT NULL THEN
      v_latest_period_before := v_version."periodStart";
      v_latest_approved_before := v_version."supersedesApprovedVersionId";
    END IF;
    v_book_json := "obrasaas_project_certificate_book_json"(
      v_receipt."organizationId", v_receipt."projectId", v_version."bookId",
      v_receipt."bookRevisionAfter", v_version."id", true,
      v_latest_period_before, v_latest_approved_before, true
    );
    v_head_json := "obrasaas_project_certificate_period_head_json"(
      v_receipt."organizationId", v_receipt."projectId", v_version."periodHeadId",
      v_receipt."periodHeadRevisionAfter", v_current_before, true, v_version."id", true
    );
    v_certificate_json := jsonb_set(
      "obrasaas_project_certificate_version_json"(
        v_receipt."organizationId", v_receipt."projectId", v_receipt."certificateVersionId", true
      ), '{decision}', 'null'::JSONB
    );
  ELSE
    v_book_json := "obrasaas_project_certificate_book_json"(
      v_receipt."organizationId", v_receipt."projectId", v_version."bookId",
      v_receipt."bookRevisionAfter", NULL, true,
      CASE WHEN v_decision."decision" = 'APPROVED' THEN v_version."periodStart" ELSE NULL END,
      CASE WHEN v_decision."decision" = 'APPROVED' THEN v_version."id" ELSE NULL END,
      v_decision."decision" = 'APPROVED'
    );
    IF v_decision."decision" <> 'APPROVED' THEN
      v_book_json := jsonb_set(v_book_json, '{latestApprovedPeriodStart}',
        CASE WHEN v_version."previousApprovedCertificateVersionId" IS NULL THEN 'null'::JSONB
          ELSE to_jsonb((SELECT to_char(previous."periodStart", 'YYYY-MM-DD') FROM "ProjectCertificateVersion" previous WHERE previous."id" = v_version."previousApprovedCertificateVersionId")) END);
      v_book_json := jsonb_set(
        v_book_json,
        '{latestApprovedCertificateVersionId}',
        COALESCE(to_jsonb(v_version."previousApprovedCertificateVersionId"), 'null'::JSONB)
      );
      IF v_version."supersedesApprovedVersionId" IS NOT NULL THEN
        v_book_json := jsonb_set(v_book_json, '{latestApprovedPeriodStart}', to_jsonb(to_char(v_version."periodStart", 'YYYY-MM-DD')));
        v_book_json := jsonb_set(v_book_json, '{latestApprovedCertificateVersionId}', to_jsonb(v_version."supersedesApprovedVersionId"));
      END IF;
    END IF;
    v_head_json := "obrasaas_project_certificate_period_head_json"(
      v_receipt."organizationId", v_receipt."projectId", v_version."periodHeadId",
      v_receipt."periodHeadRevisionAfter",
      CASE WHEN v_decision."decision" = 'APPROVED' THEN v_version."id" ELSE v_version."supersedesApprovedVersionId" END,
      true, v_version."id", true
    );
    v_certificate_json := "obrasaas_project_certificate_version_json"(
      v_receipt."organizationId", v_receipt."projectId", v_receipt."certificateVersionId", true
    );
  END IF;

  -- Contract pins are immutable after the first approval and can therefore be
  -- reconstructed from the receipt's certificate lineage, not mutable heads.
  IF v_receipt."operationKind" = 'APPROVE'
    OR v_version."previousApprovedCertificateVersionId" IS NOT NULL
    OR v_version."supersedesApprovedVersionId" IS NOT NULL THEN
    v_book_json := jsonb_set(v_book_json, '{pinnedContractHeadId}', to_jsonb(v_version."contractHeadId"));
    v_book_json := jsonb_set(v_book_json, '{pinnedContractVersionId}', to_jsonb(v_version."contractVersionId"));
    v_book_json := jsonb_set(v_book_json, '{pinnedAuthorityVersionId}', to_jsonb(v_version."authorityVersionId"));
  ELSE
    v_book_json := jsonb_set(v_book_json, '{pinnedContractHeadId}', 'null'::JSONB);
    v_book_json := jsonb_set(v_book_json, '{pinnedContractVersionId}', 'null'::JSONB);
    v_book_json := jsonb_set(v_book_json, '{pinnedAuthorityVersionId}', 'null'::JSONB);
  END IF;

  RETURN jsonb_build_object(
    'receipt', jsonb_build_object(
      'operationReceiptId', v_receipt."id", 'operationKind', v_receipt."operationKind"::TEXT,
      'certificateVersionId', v_receipt."certificateVersionId", 'decisionId', v_receipt."decisionId",
      'actorMembershipId', v_receipt."actorMembershipId",
      'bookRevisionAfter', v_receipt."bookRevisionAfter",
      'periodHeadRevisionAfter', v_receipt."periodHeadRevisionAfter", 'replayed', p_replayed),
    'certificate', v_certificate_json,
    'decision', CASE WHEN v_decision."id" IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_decision."id", 'decision', v_decision."decision"::TEXT,
      'reason', v_decision."reason", 'decidedByMembershipId', v_decision."decidedByMembershipId",
      'decidedAt', to_char(v_decision."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
    'book', v_book_json, 'periodHead', v_head_json
  );
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_ledger_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_book_id TEXT;
  v_scope TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME = 'ProjectCertificateVersion' THEN
    v_book_id := NEW."bookId";
  ELSIF TG_TABLE_NAME = 'ProjectCertificateDecision' THEN
    v_book_id := NEW."bookId";
  ELSE
    SELECT v."bookId" INTO STRICT v_book_id
      FROM "ProjectCertificateVersion" v
     WHERE v."organizationId" = NEW."organizationId"
       AND v."projectId" = NEW."projectId"
       AND v."id" = NEW."certificateVersionId";
  END IF;

  v_scope := NEW."organizationId" || ':' || NEW."projectId" || ':' || v_book_id;
  IF pg_catalog.pg_trigger_depth() <> 2
    OR current_setting('obrasaas.project_certificate_write_scope', true) IS DISTINCT FROM v_scope THEN
    RAISE EXCEPTION 'direct project certificate ledger writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_projection_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_book_id TEXT;
  v_scope TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% cannot be deleted', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  IF TG_TABLE_NAME = 'ProjectCertificateBook' THEN
    v_book_id := NEW."id";
  ELSE
    v_book_id := NEW."bookId";
  END IF;
  v_scope := NEW."organizationId" || ':' || NEW."projectId" || ':' || v_book_id;
  IF pg_catalog.pg_trigger_depth() <> 2
    OR current_setting('obrasaas.project_certificate_write_scope', true) IS DISTINCT FROM v_scope THEN
    RAISE EXCEPTION 'direct project certificate projection writes are forbidden'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'project certificate projection identity is immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_TABLE_NAME = 'ProjectCertificatePeriodHead' AND TG_OP = 'UPDATE' THEN
    IF NEW."bookId" IS DISTINCT FROM OLD."bookId"
      OR NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
      OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd" THEN
      RAISE EXCEPTION 'project certificate period identity is immutable'
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProjectCertificateBook_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificateBook"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_projection_guard"();
ALTER TABLE "ProjectCertificateBook" ENABLE ALWAYS TRIGGER "ProjectCertificateBook_projection_guard";
CREATE TRIGGER "ProjectCertificateBook_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificateBook"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificateBook" ENABLE ALWAYS TRIGGER "ProjectCertificateBook_no_truncate";

CREATE TRIGGER "ProjectCertificatePeriodHead_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificatePeriodHead"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_projection_guard"();
ALTER TABLE "ProjectCertificatePeriodHead" ENABLE ALWAYS TRIGGER "ProjectCertificatePeriodHead_projection_guard";
CREATE TRIGGER "ProjectCertificatePeriodHead_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificatePeriodHead"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificatePeriodHead" ENABLE ALWAYS TRIGGER "ProjectCertificatePeriodHead_no_truncate";

CREATE TRIGGER "ProjectCertificateVersion_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificateVersion"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_ledger_guard"();
ALTER TABLE "ProjectCertificateVersion" ENABLE ALWAYS TRIGGER "ProjectCertificateVersion_append_only";
CREATE TRIGGER "ProjectCertificateVersion_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificateVersion"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificateVersion" ENABLE ALWAYS TRIGGER "ProjectCertificateVersion_no_truncate";

CREATE TRIGGER "ProjectCertificateLine_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificateLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_ledger_guard"();
ALTER TABLE "ProjectCertificateLine" ENABLE ALWAYS TRIGGER "ProjectCertificateLine_append_only";
CREATE TRIGGER "ProjectCertificateLine_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificateLine"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificateLine" ENABLE ALWAYS TRIGGER "ProjectCertificateLine_no_truncate";

CREATE TRIGGER "ProjectCertificateDeduction_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificateDeduction"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_ledger_guard"();
ALTER TABLE "ProjectCertificateDeduction" ENABLE ALWAYS TRIGGER "ProjectCertificateDeduction_append_only";
CREATE TRIGGER "ProjectCertificateDeduction_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificateDeduction"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificateDeduction" ENABLE ALWAYS TRIGGER "ProjectCertificateDeduction_no_truncate";

CREATE TRIGGER "ProjectCertificateDecision_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificateDecision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_ledger_guard"();
ALTER TABLE "ProjectCertificateDecision" ENABLE ALWAYS TRIGGER "ProjectCertificateDecision_append_only";
CREATE TRIGGER "ProjectCertificateDecision_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificateDecision"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificateDecision" ENABLE ALWAYS TRIGGER "ProjectCertificateDecision_no_truncate";

CREATE TRIGGER "ProjectCertificateOperationReceipt_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ProjectCertificateOperationReceipt"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_ledger_guard"();
ALTER TABLE "ProjectCertificateOperationReceipt" ENABLE ALWAYS TRIGGER "ProjectCertificateOperationReceipt_append_only";
CREATE TRIGGER "ProjectCertificateOperationReceipt_no_truncate"
BEFORE TRUNCATE ON "ProjectCertificateOperationReceipt"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_no_truncate"();
ALTER TABLE "ProjectCertificateOperationReceipt" ENABLE ALWAYS TRIGGER "ProjectCertificateOperationReceipt_no_truncate";

CREATE OR REPLACE FUNCTION "obrasaas_project_contract_task_scope_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_organization_id TEXT;
  v_was_canonical BOOLEAN := false;
  v_is_canonical BOOLEAN;
  v_scope_changed BOOLEAN;
  v_snapshot_changed BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_was_canonical := OLD."type" = 'TASK'
      AND OLD."metadata" ->> 'source' = 'canonical-task-v1';
  END IF;
  v_is_canonical := NEW."type" = 'TASK'
    AND NEW."metadata" ->> 'source' = 'canonical-task-v1';
  v_scope_changed := TG_OP = 'INSERT' AND v_is_canonical
    OR TG_OP = 'UPDATE' AND v_was_canonical IS DISTINCT FROM v_is_canonical;
  v_snapshot_changed := TG_OP = 'UPDATE' AND (v_was_canonical OR v_is_canonical) AND (
    NEW."code" IS DISTINCT FROM OLD."code"
    OR NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."revision" IS DISTINCT FROM OLD."revision"
  );
  IF NOT v_scope_changed AND NOT v_snapshot_changed THEN
    RETURN NEW;
  END IF;

  SELECT p."organizationId" INTO STRICT v_organization_id
    FROM "Project" p WHERE p."id" = NEW."projectId";

  -- The Task row is already locked by this BEFORE trigger. Never wait here for
  -- the S9.1 task advisory: fail fast so a concurrent governed measurement can
  -- finish and the caller can retry without a Task-row/advisory cycle.
  IF NOT pg_try_advisory_xact_lock(hashtextextended(
    v_organization_id || ':' || NEW."projectId" || ':' || NEW."id", 0
  )) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_SCOPE_BUSY: concurrent governed task measurement holds the task lock'
      USING ERRCODE = '40001';
  END IF;

  -- This is the application-wide raw project lock. Do not namespace it.
  IF NOT pg_try_advisory_xact_lock(hashtextextended(NEW."projectId", 0)) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_SCOPE_BUSY: concurrent project write owns the raw project lock'
      USING ERRCODE = '40001';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || v_organization_id || ':' || NEW."projectId", 0
  )) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_SCOPE_BUSY: concurrent contract/certificate command owns the scope lock'
      USING ERRCODE = '40001';
  END IF;

  IF v_scope_changed AND EXISTS (
    SELECT 1
      FROM "ProjectContractHead" h
      JOIN "ProjectContractDecision" d
        ON d."organizationId" = h."organizationId"
       AND d."projectId" = h."projectId"
       AND d."headId" = h."id"
       AND d."contractVersionId" = h."currentVersionId"
       AND d."decision" = 'APPROVED'
     WHERE h."organizationId" = v_organization_id
       AND h."projectId" = NEW."projectId"
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL: canonical task scope cannot change while an approved contract is current'
      USING ERRCODE = '55000';
  END IF;
  -- Snapshot-only changes are deliberately allowed. The raw + contract locks
  -- serialize them with S10; the next read derives a stale cut until reseal.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Task_project_contract_scope_guard" ON "Task";
CREATE TRIGGER "Task_project_contract_scope_guard"
BEFORE INSERT OR UPDATE OF "type", "metadata", "code", "title", "revision" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_contract_task_scope_guard"();
ALTER TABLE "Task" ENABLE ALWAYS TRIGGER "Task_project_contract_scope_guard";

CREATE FUNCTION "obrasaas_project_certificate_s93_fence"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_organization_id TEXT := NEW."organizationId";
  v_project_id TEXT := NEW."projectId";
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || v_organization_id || ':' || v_project_id, 0
  ));
  IF EXISTS (
    SELECT 1 FROM "ProjectCertificateBook" b
     WHERE b."organizationId" = v_organization_id
       AND b."projectId" = v_project_id
       AND b."pendingCertificateVersionId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_BLOCKED_BY_PENDING_CERTIFICATE: close the pending certificate first'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ProjectCertificateBook" b
     WHERE b."organizationId" = v_organization_id
       AND b."projectId" = v_project_id
       AND b."pinnedContractVersionId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_PINNED_BY_CERTIFICATE: S19 change control is required'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProjectContractAuthorityVersion_certificate_fence"
BEFORE INSERT ON "ProjectContractAuthorityVersion"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_s93_fence"();
ALTER TABLE "ProjectContractAuthorityVersion" ENABLE ALWAYS TRIGGER "ProjectContractAuthorityVersion_certificate_fence";
CREATE TRIGGER "ProjectContractAuthorityDecision_certificate_fence"
BEFORE INSERT ON "ProjectContractAuthorityDecision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_s93_fence"();
ALTER TABLE "ProjectContractAuthorityDecision" ENABLE ALWAYS TRIGGER "ProjectContractAuthorityDecision_certificate_fence";
CREATE TRIGGER "ProjectContractVersion_certificate_fence"
BEFORE INSERT ON "ProjectContractVersion"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_s93_fence"();
ALTER TABLE "ProjectContractVersion" ENABLE ALWAYS TRIGGER "ProjectContractVersion_certificate_fence";
CREATE TRIGGER "ProjectContractDecision_certificate_fence"
BEFORE INSERT ON "ProjectContractDecision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_s93_fence"();
ALTER TABLE "ProjectContractDecision" ENABLE ALWAYS TRIGGER "ProjectContractDecision_certificate_fence";

CREATE FUNCTION "obrasaas_project_certificate_s93_head_fence"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW."currentVersionId" IS NOT DISTINCT FROM OLD."currentVersionId"
    AND NEW."currentAuthorityVersionId" IS NOT DISTINCT FROM OLD."currentAuthorityVersionId" THEN
    RETURN NEW;
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || NEW."organizationId" || ':' || NEW."projectId", 0
  )) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_POINTER_BUSY: concurrent governed command owns the contract scope'
      USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ProjectCertificateBook" b
     WHERE b."organizationId" = NEW."organizationId"
       AND b."projectId" = NEW."projectId"
       AND (b."pendingCertificateVersionId" IS NOT NULL OR b."pinnedContractVersionId" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'PROJECT_CONTRACT_POINTER_BLOCKED_BY_CERTIFICATE: pending/pinned certificate forbids S9.3 pointer changes'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProjectContractHead_certificate_pointer_fence"
BEFORE UPDATE OF "currentVersionId", "currentAuthorityVersionId" ON "ProjectContractHead"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_s93_head_fence"();
ALTER TABLE "ProjectContractHead" ENABLE ALWAYS TRIGGER "ProjectContractHead_certificate_pointer_fence";

CREATE FUNCTION "obrasaas_project_certificate_archive_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" OR NEW."status" <> 'ARCHIVED' THEN
    RETURN NEW;
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(NEW."id", 0)) THEN
    RAISE EXCEPTION 'PROJECT_ARCHIVE_BUSY: concurrent project write owns the raw project lock'
      USING ERRCODE = '40001';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(
    'project-contract:scope:' || NEW."organizationId" || ':' || NEW."id", 0
  )) THEN
    RAISE EXCEPTION 'PROJECT_ARCHIVE_BUSY: concurrent governed command owns the contract scope'
      USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ProjectCertificateBook" b
     WHERE b."organizationId" = NEW."organizationId" AND b."projectId" = NEW."id"
       AND b."pendingCertificateVersionId" IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM "ProjectContractHead" h
     WHERE h."organizationId" = NEW."organizationId" AND h."projectId" = NEW."id"
       AND (h."pendingAuthorityVersionId" IS NOT NULL OR h."pendingVersionId" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'PROJECT_ARCHIVE_BLOCKED_BY_PENDING_GOVERNANCE: close pending contract/certificate review first'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Project_project_certificate_archive_guard"
BEFORE UPDATE OF "status" ON "Project"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_certificate_archive_guard"();
ALTER TABLE "Project" ENABLE ALWAYS TRIGGER "Project_project_certificate_archive_guard";

CREATE FUNCTION "obrasaas_project_certificate_pending_has_closer"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_certificate_version_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH authority AS (
    SELECT a."certifierMembershipId", a."registrarMembershipId"
      FROM "ProjectCertificateVersion" v
      JOIN "ProjectContractAuthorityVersion" a
        ON a."organizationId" = v."organizationId"
       AND a."projectId" = v."projectId"
       AND a."headId" = v."contractHeadId"
       AND a."id" = v."authorityVersionId"
     WHERE v."organizationId" = p_organization_id
       AND v."projectId" = p_project_id
       AND v."id" = p_certificate_version_id
  ), exact_roles AS (
    SELECT
      "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, a."certifierMembershipId", 'DIRECTOR'
      ) AS certifier_valid,
      "obrasaas_project_contract_membership_matches"(
        p_organization_id, p_project_id, a."registrarMembershipId", 'ADMIN'
      ) AS registrar_valid
    FROM authority a
  )
  SELECT COALESCE(
    r.certifier_valid
    OR (NOT r.certifier_valid AND r.registrar_valid)
    OR (NOT r.certifier_valid AND NOT r.registrar_valid AND EXISTS (
      SELECT 1
        FROM "TenantMembership" tm
        JOIN "ProjectMembership" pm
          ON pm."tenantMembershipId" = tm."id"
         AND pm."projectId" = p_project_id
         AND pm."status" = 'ACTIVE'
       WHERE tm."organizationId" = p_organization_id
         AND tm."status" = 'ACTIVE'
         AND tm."tenantRole" = 'ADMIN'
    )), false
  )
  FROM exact_roles r;
$$;

CREATE FUNCTION "obrasaas_project_certificate_lock_and_validate_closer"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_book_id TEXT,
  p_pending_version_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Membership row triggers already own one or more membership rows. Never
  -- wait on the normal certificate lock in this inverted position: fail fast
  -- so the whole caller retries from raw-project -> contract -> actors.
  IF NOT pg_try_advisory_xact_lock(hashtextextended(
    'project-certificate:scope:' || p_organization_id || ':' || p_project_id, 0
  )) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_MEMBERSHIP_RETRY: certificate scope is busy'
      USING ERRCODE = '40001';
  END IF;
  -- This is a new READ COMMITTED statement after the common advisory lock.
  -- Re-lock/revalidate the exact pending pointer so two independent closer
  -- changes cannot both decide from the same stale statement snapshot.
  PERFORM 1 FROM "ProjectCertificateBook" book
   WHERE book."organizationId" = p_organization_id
     AND book."projectId" = p_project_id
     AND book."id" = p_book_id
     AND book."pendingCertificateVersionId" = p_pending_version_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT "obrasaas_project_certificate_pending_has_closer"(
    p_organization_id, p_project_id, p_pending_version_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_PENDING_CLOSER_REQUIRED: membership change would orphan a pending certificate'
      USING ERRCODE = '55000';
  END IF;
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_membership_closer_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_book RECORD;
BEGIN
  -- Statement-level transition tables preserve every affected project in bulk
  -- updates. Book locks are acquired in deterministic project order.
  IF TG_TABLE_NAME = 'TenantMembership' THEN
    FOR v_book IN
      WITH changed_membership AS (
        SELECT "id", "organizationId" FROM old_memberships
        UNION
        SELECT "id", "organizationId" FROM new_memberships
      ), candidate_books AS (
      SELECT DISTINCT b."id"
        FROM changed_membership changed
        JOIN "ProjectCertificateVersion" v
          ON v."organizationId" = changed."organizationId"
        JOIN "ProjectCertificateBook" b
          ON b."organizationId" = v."organizationId"
         AND b."projectId" = v."projectId"
         AND b."pendingCertificateVersionId" = v."id"
        JOIN "ProjectContractAuthorityVersion" a
          ON a."organizationId" = v."organizationId"
         AND a."projectId" = v."projectId"
         AND a."headId" = v."contractHeadId"
         AND a."id" = v."authorityVersionId"
       WHERE changed."id" IN (a."certifierMembershipId", a."registrarMembershipId")
          OR EXISTS (
            SELECT 1 FROM "ProjectMembership" pm
             WHERE pm."tenantMembershipId" = changed."id" AND pm."projectId" = v."projectId"
           )
      )
      SELECT b."organizationId", b."projectId", b."pendingCertificateVersionId", b."id"
        FROM "ProjectCertificateBook" b
        JOIN candidate_books candidate ON candidate."id" = b."id"
       ORDER BY b."projectId", b."id"
    LOOP
      PERFORM "obrasaas_project_certificate_lock_and_validate_closer"(
        v_book."organizationId", v_book."projectId", v_book."id",
        v_book."pendingCertificateVersionId"
      );
    END LOOP;
  ELSE
    FOR v_book IN
      WITH changed_project_membership AS (
        SELECT "projectId", "tenantMembershipId" FROM old_project_memberships
        UNION
        SELECT "projectId", "tenantMembershipId" FROM new_project_memberships
      ), candidate_books AS (
      SELECT DISTINCT b."id"
        FROM changed_project_membership changed
        JOIN "ProjectCertificateBook" b
          ON b."projectId" = changed."projectId"
         AND b."pendingCertificateVersionId" IS NOT NULL
      )
      SELECT b."organizationId", b."projectId", b."pendingCertificateVersionId", b."id"
        FROM "ProjectCertificateBook" b
        JOIN candidate_books candidate ON candidate."id" = b."id"
       ORDER BY b."projectId", b."id"
    LOOP
      PERFORM "obrasaas_project_certificate_lock_and_validate_closer"(
        v_book."organizationId", v_book."projectId", v_book."id",
        v_book."pendingCertificateVersionId"
      );
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "TenantMembership_project_certificate_closer_guard"
AFTER UPDATE ON "TenantMembership"
REFERENCING OLD TABLE AS old_memberships NEW TABLE AS new_memberships
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_membership_closer_guard"();
ALTER TABLE "TenantMembership" ENABLE ALWAYS TRIGGER "TenantMembership_project_certificate_closer_guard";

CREATE TRIGGER "ProjectMembership_project_certificate_closer_guard"
AFTER UPDATE ON "ProjectMembership"
REFERENCING OLD TABLE AS old_project_memberships NEW TABLE AS new_project_memberships
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_membership_closer_guard"();
ALTER TABLE "ProjectMembership" ENABLE ALWAYS TRIGGER "ProjectMembership_project_certificate_closer_guard";

CREATE FUNCTION "obrasaas_project_certificate_membership_closer_guard_delete"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_book RECORD;
BEGIN
  IF TG_TABLE_NAME = 'TenantMembership' THEN
    FOR v_book IN
      WITH candidate_books AS (
      SELECT DISTINCT b."id"
        FROM old_memberships changed
        JOIN "ProjectCertificateBook" b ON b."organizationId" = changed."organizationId"
       WHERE b."pendingCertificateVersionId" IS NOT NULL
         AND (
           EXISTS (SELECT 1 FROM "ProjectMembership" pm WHERE pm."tenantMembershipId" = changed."id" AND pm."projectId" = b."projectId")
           OR EXISTS (
             SELECT 1
               FROM "ProjectCertificateVersion" v
               JOIN "ProjectContractAuthorityVersion" a
                 ON a."organizationId" = v."organizationId" AND a."projectId" = v."projectId"
                AND a."headId" = v."contractHeadId" AND a."id" = v."authorityVersionId"
              WHERE v."id" = b."pendingCertificateVersionId"
                AND changed."id" IN (a."certifierMembershipId", a."registrarMembershipId")
           )
         )
      )
      SELECT b."organizationId", b."projectId", b."pendingCertificateVersionId", b."id"
        FROM "ProjectCertificateBook" b
        JOIN candidate_books candidate ON candidate."id" = b."id"
       ORDER BY b."projectId", b."id"
    LOOP
      PERFORM "obrasaas_project_certificate_lock_and_validate_closer"(
        v_book."organizationId", v_book."projectId", v_book."id",
        v_book."pendingCertificateVersionId"
      );
    END LOOP;
  ELSE
    FOR v_book IN
      WITH candidate_books AS (
      SELECT DISTINCT b."id"
        FROM old_project_memberships changed
        JOIN "ProjectCertificateBook" b ON b."projectId" = changed."projectId"
       WHERE b."pendingCertificateVersionId" IS NOT NULL
      )
      SELECT b."organizationId", b."projectId", b."pendingCertificateVersionId", b."id"
        FROM "ProjectCertificateBook" b
        JOIN candidate_books candidate ON candidate."id" = b."id"
       ORDER BY b."projectId", b."id"
    LOOP
      PERFORM "obrasaas_project_certificate_lock_and_validate_closer"(
        v_book."organizationId", v_book."projectId", v_book."id",
        v_book."pendingCertificateVersionId"
      );
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "TenantMembership_project_certificate_closer_delete_guard"
AFTER DELETE ON "TenantMembership"
REFERENCING OLD TABLE AS old_memberships
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_membership_closer_guard_delete"();
ALTER TABLE "TenantMembership" ENABLE ALWAYS TRIGGER "TenantMembership_project_certificate_closer_delete_guard";

CREATE TRIGGER "ProjectMembership_project_certificate_closer_delete_guard"
AFTER DELETE ON "ProjectMembership"
REFERENCING OLD TABLE AS old_project_memberships
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_project_certificate_membership_closer_guard_delete"();
ALTER TABLE "ProjectMembership" ENABLE ALWAYS TRIGGER "ProjectMembership_project_certificate_closer_delete_guard";

CREATE FUNCTION "obrasaas_project_certificate_actor_can_read"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_actor_membership_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM "TenantMembership" tm
      JOIN "ProjectMembership" pm
        ON pm."tenantMembershipId" = tm."id"
       AND pm."projectId" = p_project_id
       AND pm."status" = 'ACTIVE'
      JOIN "Project" p
        ON p."id" = pm."projectId"
       AND p."organizationId" = tm."organizationId"
     WHERE tm."organizationId" = p_organization_id
       AND tm."id" = p_actor_membership_id
       AND tm."status" = 'ACTIVE'
       AND tm."tenantRole" IN ('ADMIN','DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR')
  );
$$;

CREATE FUNCTION "obrasaas_project_certificate_lock_active_actor"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_actor_membership_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1
    FROM "TenantMembership" tm
    JOIN "ProjectMembership" pm
      ON pm."tenantMembershipId" = tm."id"
     AND pm."projectId" = p_project_id
     AND pm."status" = 'ACTIVE'
    JOIN "Project" p
      ON p."id" = pm."projectId"
     AND p."organizationId" = tm."organizationId"
   WHERE tm."organizationId" = p_organization_id
     AND tm."id" = p_actor_membership_id
     AND tm."status" = 'ACTIVE'
   ORDER BY tm."id", pm."id"
   FOR SHARE OF tm, pm;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: active tenant/project actor scope was not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_half_up"(
  p_numerator NUMERIC,
  p_denominator NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT floor((p_numerator / p_denominator) + 0.5);
$$;

CREATE FUNCTION "obrasaas_project_certificate_deduction_sha"(
  p_ordinal INTEGER,
  p_code TEXT,
  p_reason TEXT,
  p_amount_minor BIGINT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-deduction-v1', p_ordinal, p_code, p_reason,
    p_amount_minor::TEXT
  )::TEXT, 'UTF8')), 'hex');
$$;

CREATE FUNCTION "obrasaas_project_certificate_line_sha"(
  p_state TEXT,
  p_cut_state TEXT,
  p_task_id TEXT,
  p_task_code TEXT,
  p_task_title TEXT,
  p_task_revision INTEGER,
  p_cut_line_id TEXT,
  p_cut_line_sha TEXT,
  p_contract_line_id TEXT,
  p_contract_line_sha TEXT,
  p_unit_code TEXT,
  p_base_quantity NUMERIC,
  p_period_quantity NUMERIC,
  p_cumulative_quantity NUMERIC,
  p_origin DATE,
  p_contract_amount_minor BIGINT,
  p_previous_gross BIGINT,
  p_cumulative_gross NUMERIC,
  p_increment_gross NUMERIC,
  p_no_claim_reason TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-line-v1', p_state, p_cut_state, p_task_id,
    p_task_code, p_task_title, p_task_revision, p_cut_line_id, p_cut_line_sha,
    p_contract_line_id, p_contract_line_sha, p_unit_code,
    CASE WHEN p_base_quantity IS NULL THEN NULL ELSE to_char(p_base_quantity, 'FM99999999999999.0000') END,
    CASE WHEN p_period_quantity IS NULL THEN NULL ELSE to_char(p_period_quantity, 'FM99999999999999.0000') END,
    CASE WHEN p_cumulative_quantity IS NULL THEN NULL ELSE to_char(p_cumulative_quantity, 'FM99999999999999.0000') END,
    CASE WHEN p_origin IS NULL THEN NULL ELSE to_char(p_origin, 'YYYY-MM-DD') END,
    CASE WHEN p_contract_amount_minor IS NULL THEN NULL ELSE p_contract_amount_minor::TEXT END,
    CASE WHEN p_previous_gross IS NULL THEN NULL ELSE p_previous_gross::TEXT END,
    CASE WHEN p_cumulative_gross IS NULL THEN NULL ELSE p_cumulative_gross::TEXT END,
    CASE WHEN p_increment_gross IS NULL THEN NULL ELSE p_increment_gross::TEXT END,
    p_no_claim_reason
  )::TEXT, 'UTF8')), 'hex');
$$;

CREATE FUNCTION "obrasaas_project_certificate_canonical_blockers"(p_blockers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
DECLARE
  v_unknown TEXT;
  v_result JSONB;
BEGIN
  WITH priority(code, ordinal) AS (VALUES
    ('CERT_PENDING_REVIEW', 1), ('CERT_PROJECT_ARCHIVED', 2),
    ('CERT_AUTHORITY_REVIEW_PENDING', 3), ('CERT_CONTRACT_REVIEW_PENDING', 4),
    ('CERT_AUTHORITY_REQUIRED', 5), ('CERT_CONTRACT_REQUIRED', 6),
    ('CERT_PINNED_PROVENANCE_MISMATCH', 7), ('CERT_AUTHORITY_INVALID', 8),
    ('HISTORICAL_RESTATEMENT_REQUIRED', 9), ('CORRECTION_REQUIRED', 10),
    ('CERT_PERIOD_ORDER_INVALID', 11), ('CERT_TECHNICAL_CUT_REQUIRED', 12),
    ('CERT_TECHNICAL_CUT_STALE', 13), ('CERT_TECHNICAL_MEASUREMENT_MISSING', 14),
    ('CERT_CONTRACT_TECHNICAL_BASIS_MISMATCH', 15),
    ('CERT_RETROACTIVE_CONTRACT_BASIS', 16),
    ('CERT_CONTRACT_POLICY_UNSUPPORTED', 17), ('CERT_AMOUNT_OVERFLOW', 18)
  ), observed AS (
    SELECT DISTINCT value AS code FROM jsonb_array_elements_text(COALESCE(p_blockers, '[]'::JSONB)) value
  ), unknown AS (
    SELECT observed.code FROM observed LEFT JOIN priority USING (code)
     WHERE priority.code IS NULL ORDER BY observed.code LIMIT 1
  ), result AS (
    SELECT COALESCE(jsonb_agg(observed.code ORDER BY priority.ordinal), '[]'::JSONB) AS value
      FROM observed JOIN priority USING (code)
  )
  SELECT (SELECT code FROM unknown), (SELECT value FROM result)
    INTO v_unknown, v_result;
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_BLOCKER_INVALID: internal blocker allowlist drifted'
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

CREATE FUNCTION "obrasaas_project_certificate_build_candidate"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_period_start DATE
)
RETURNS TABLE(
  period_end DATE,
  mode TEXT,
  book_id TEXT,
  book_revision INTEGER,
  period_head_id TEXT,
  period_head_revision INTEGER,
  current_approved_version_id TEXT,
  predecessor_id TEXT,
  supersedes_approved_version_id TEXT,
  previous_approved_version_id TEXT,
  coverage_from DATE,
  coverage_through DATE,
  cut_head_id TEXT,
  cut_id TEXT,
  cut_candidate_sha256 TEXT,
  cut_sha256 TEXT,
  contract_head_id TEXT,
  contract_version_id TEXT,
  contract_sha256 TEXT,
  authority_version_id TEXT,
  authority_sha256 TEXT,
  currency_code TEXT,
  currency_minor_units INTEGER,
  retention_bps INTEGER,
  contractual_rounding_policy TEXT,
  adjustment_policy TEXT,
  task_count INTEGER,
  valued_line_count INTEGER,
  no_claim_line_count INTEGER,
  previous_gross_total BIGINT,
  cumulative_gross_total BIGINT,
  increment_gross_total BIGINT,
  previous_retention BIGINT,
  cumulative_retention BIGINT,
  increment_retention BIGINT,
  internal_lines JSONB,
  candidate_sha256 TEXT,
  blockers JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_period_end DATE;
  v_book "ProjectCertificateBook"%ROWTYPE;
  v_period_head "ProjectCertificatePeriodHead"%ROWTYPE;
  v_cut_head "ProjectProgressMeasurementCutHead"%ROWTYPE;
  v_cut "ProjectProgressMeasurementCut"%ROWTYPE;
  v_contract_head "ProjectContractHead"%ROWTYPE;
  v_contract "ProjectContractVersion"%ROWTYPE;
  v_authority "ProjectContractAuthorityVersion"%ROWTYPE;
  v_previous "ProjectCertificateVersion"%ROWTYPE;
  v_basis_previous "ProjectCertificateVersion"%ROWTYPE;
  v_mode TEXT;
  v_coverage_from DATE;
  v_valued INTEGER;
  v_no_claim INTEGER;
  v_task_count INTEGER;
  v_previous_total NUMERIC;
  v_cumulative_total NUMERIC;
  v_increment_total NUMERIC;
  v_previous_retention_numeric NUMERIC;
  v_cumulative_retention_numeric NUMERIC;
  v_increment_retention_numeric NUMERIC;
  v_lines JSONB;
  v_candidate TEXT;
  v_blockers JSONB := '[]'::JSONB;
  v_live_cut RECORD;
  v_historical RECORD;
BEGIN
  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: period is required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Project" p
     WHERE p."organizationId" = p_organization_id AND p."id" = p_project_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: tenant-scoped project was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Project" p
     WHERE p."organizationId" = p_organization_id AND p."id" = p_project_id AND p."status" = 'ARCHIVED'
  ) THEN
    v_blockers := v_blockers || '"CERT_PROJECT_ARCHIVED"'::JSONB;
  END IF;
  v_period_end := CASE EXTRACT(DAY FROM p_period_start)::INTEGER
    WHEN 1 THEN p_period_start + 14
    WHEN 16 THEN (date_trunc('month', p_period_start) + INTERVAL '1 month - 1 day')::DATE
    ELSE NULL END;
  IF v_period_end IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CERTIFICATE_SCOPE_INVALID: period must start on day 1 or 16' USING ERRCODE = '22023';
  END IF;

  SELECT b.* INTO v_book FROM "ProjectCertificateBook" b
   WHERE b."organizationId" = p_organization_id AND b."projectId" = p_project_id;
  SELECT h.* INTO v_period_head FROM "ProjectCertificatePeriodHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
     AND h."periodStart" = p_period_start;
  SELECT h.* INTO v_cut_head FROM "ProjectProgressMeasurementCutHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
     AND h."periodStart" = p_period_start AND h."periodEnd" = v_period_end;
  IF v_cut_head."id" IS NULL OR v_cut_head."currentCutId" IS NULL THEN
    v_blockers := v_blockers || '"CERT_TECHNICAL_CUT_REQUIRED"'::JSONB;
  ELSE
    SELECT c.* INTO v_cut FROM "ProjectProgressMeasurementCut" c
     WHERE c."organizationId" = p_organization_id AND c."projectId" = p_project_id
       AND c."headId" = v_cut_head."id" AND c."id" = v_cut_head."currentCutId";
    SELECT * INTO v_live_cut FROM "obrasaas_progress_measurement_cut_build_candidate"(
      p_organization_id, p_project_id, p_period_start, v_period_end
    );
    IF v_live_cut.review_pending OR v_live_cut.candidate_sha256 IS DISTINCT FROM v_cut."candidateSha256"::TEXT THEN
      v_blockers := v_blockers || '"CERT_TECHNICAL_CUT_STALE"'::JSONB;
    END IF;
  END IF;

  SELECT h.* INTO v_contract_head FROM "ProjectContractHead" h
   WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id;
  IF v_contract_head."id" IS NULL THEN
    v_blockers := v_blockers || '"CERT_AUTHORITY_REQUIRED"'::JSONB;
    v_blockers := v_blockers || '"CERT_CONTRACT_REQUIRED"'::JSONB;
  ELSIF v_contract_head."pendingAuthorityVersionId" IS NOT NULL THEN
    v_blockers := v_blockers || '"CERT_AUTHORITY_REVIEW_PENDING"'::JSONB;
  ELSIF v_contract_head."pendingVersionId" IS NOT NULL THEN
    v_blockers := v_blockers || '"CERT_CONTRACT_REVIEW_PENDING"'::JSONB;
  ELSIF v_contract_head."currentAuthorityVersionId" IS NULL THEN
    v_blockers := v_blockers || '"CERT_AUTHORITY_REQUIRED"'::JSONB;
  ELSIF v_contract_head."currentVersionId" IS NULL THEN
    v_blockers := v_blockers || '"CERT_CONTRACT_REQUIRED"'::JSONB;
  ELSE
    SELECT v.* INTO v_contract FROM "ProjectContractVersion" v
     JOIN "ProjectContractDecision" d
       ON d."organizationId" = v."organizationId" AND d."projectId" = v."projectId"
      AND d."headId" = v."headId" AND d."contractVersionId" = v."id"
      AND d."decision" = 'APPROVED'
     WHERE v."organizationId" = p_organization_id AND v."projectId" = p_project_id
       AND v."headId" = v_contract_head."id" AND v."id" = v_contract_head."currentVersionId";
    IF v_contract."id" IS NULL THEN
      v_blockers := v_blockers || '"CERT_CONTRACT_REQUIRED"'::JSONB;
    ELSE
      SELECT a.* INTO v_authority FROM "ProjectContractAuthorityVersion" a
       JOIN "ProjectContractAuthorityDecision" d
         ON d."organizationId" = a."organizationId" AND d."projectId" = a."projectId"
        AND d."headId" = a."headId" AND d."authorityVersionId" = a."id"
        AND d."decision" = 'APPROVED'
       WHERE a."organizationId" = p_organization_id AND a."projectId" = p_project_id
         AND a."headId" = v_contract_head."id" AND a."id" = v_contract."authorityVersionId";
      IF v_authority."id" IS NULL THEN
        v_blockers := v_blockers || '"CERT_AUTHORITY_REQUIRED"'::JSONB;
      ELSIF v_contract."authorityVersionId" IS DISTINCT FROM v_contract_head."currentAuthorityVersionId" THEN
        v_blockers := v_blockers || '"CERT_AUTHORITY_INVALID"'::JSONB;
      END IF;
    END IF;
  END IF;

  IF v_book."pendingCertificateVersionId" IS NOT NULL THEN
    v_blockers := v_blockers || '"CERT_PENDING_REVIEW"'::JSONB;
  END IF;
  IF v_book."pinnedContractVersionId" IS NOT NULL AND (
    v_book."pinnedContractHeadId" IS DISTINCT FROM v_contract_head."id"
    OR v_book."pinnedContractVersionId" IS DISTINCT FROM v_contract."id"
    OR v_book."pinnedAuthorityVersionId" IS DISTINCT FROM v_authority."id"
  ) THEN
    v_blockers := v_blockers || '"CERT_PINNED_PROVENANCE_MISMATCH"'::JSONB;
  END IF;
  IF v_contract."id" IS NOT NULL AND (
    v_contract."roundingPolicyVersion" <> 'CERT_RETENTION_HALF_UP_V1'
    OR v_contract."adjustmentPolicyVersion" <> 'NONE'
  ) THEN
    v_blockers := v_blockers || '"CERT_CONTRACT_POLICY_UNSUPPORTED"'::JSONB;
  END IF;
  IF v_authority."id" IS NOT NULL AND (
    NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."certifierMembershipId", 'DIRECTOR'
    ) OR NOT "obrasaas_project_contract_membership_matches"(
      p_organization_id, p_project_id, v_authority."registrarMembershipId", 'ADMIN'
    )
  ) THEN
    v_blockers := v_blockers || '"CERT_AUTHORITY_INVALID"'::JSONB;
  END IF;

  IF v_period_head."currentApprovedVersionId" IS NOT NULL THEN
    SELECT previous.* INTO v_previous FROM "ProjectCertificateVersion" previous
     JOIN "ProjectCertificateDecision" decision
       ON decision."certificateVersionId" = previous."id" AND decision."decision" = 'APPROVED'
     WHERE previous."organizationId" = p_organization_id
       AND previous."projectId" = p_project_id
       AND previous."id" = v_period_head."currentApprovedVersionId";
    v_mode := 'CORRECTION';
    IF v_previous."previousApprovedCertificateVersionId" IS NOT NULL THEN
      SELECT basis.* INTO v_basis_previous FROM "ProjectCertificateVersion" basis
       WHERE basis."organizationId" = p_organization_id
         AND basis."projectId" = p_project_id
         AND basis."id" = v_previous."previousApprovedCertificateVersionId";
    END IF;
  ELSIF v_book."latestApprovedCertificateVersionId" IS NOT NULL THEN
    SELECT previous.* INTO v_previous FROM "ProjectCertificateVersion" previous
     WHERE previous."organizationId" = p_organization_id
       AND previous."projectId" = p_project_id
       AND previous."id" = v_book."latestApprovedCertificateVersionId";
    v_mode := 'NEXT_PERIOD';
    v_basis_previous := v_previous;
  ELSE
    v_mode := 'FIRST';
  END IF;

  IF v_mode = 'NEXT_PERIOD' AND p_period_start <= v_book."latestApprovedPeriodStart" THEN
    v_blockers := v_blockers || '"CERT_PERIOD_ORDER_INVALID"'::JSONB;
  ELSIF v_mode = 'CORRECTION' AND p_period_start IS DISTINCT FROM v_book."latestApprovedPeriodStart" THEN
    v_blockers := v_blockers || '"HISTORICAL_RESTATEMENT_REQUIRED"'::JSONB;
  END IF;

  IF v_cut."id" IS NULL OR v_contract."id" IS NULL OR v_authority."id" IS NULL THEN
    v_blockers := "obrasaas_project_certificate_canonical_blockers"(v_blockers);
    RETURN QUERY SELECT v_period_end, COALESCE(v_mode, 'FIRST'), v_book."id", COALESCE(v_book."revision", 0),
      v_period_head."id", COALESCE(v_period_head."revision", 0), v_period_head."currentApprovedVersionId",
      v_period_head."latestVersionId", v_period_head."currentApprovedVersionId",
      v_previous."id", NULL::DATE, v_period_end, v_cut_head."id", v_cut."id",
      v_cut."candidateSha256"::TEXT, v_cut."cutSha256"::TEXT,
      v_contract_head."id", v_contract."id", v_contract."contractSha256"::TEXT,
      v_authority."id", v_authority."authoritySha256"::TEXT,
      v_contract."currencyCode"::TEXT, v_contract."currencyMinorUnits"::INTEGER, v_contract."retentionBps",
      v_contract."roundingPolicyVersion"::TEXT, v_contract."adjustmentPolicyVersion"::TEXT,
      0, 0, 0, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT,
      '[]'::JSONB, NULL::TEXT, v_blockers;
    RETURN;
  END IF;

  WITH joined AS (
    SELECT
      row_number() OVER (ORDER BY contract_line."taskId")::INTEGER AS ordinal,
      contract_line."state"::TEXT AS state,
      cut_line."state"::TEXT AS cut_state,
      contract_line."taskId" AS task_id,
      cut_line."taskCode" AS task_code,
      cut_line."taskTitle" AS task_title,
      cut_line."taskRevision" AS task_revision,
      cut_line."id" AS cut_line_id,
      cut_line."lineSnapshotSha256"::TEXT AS cut_line_sha,
      contract_line."id" AS contract_line_id,
      contract_line."lineSha256"::TEXT AS contract_line_sha,
      CASE WHEN contract_line."state" = 'VALUED' THEN contract_line."unitCode"::TEXT ELSE NULL END AS unit_code,
      CASE WHEN contract_line."state" = 'VALUED' THEN contract_line."baseQuantity" ELSE NULL END AS base_quantity,
      CASE WHEN contract_line."state" = 'VALUED' THEN cut_line."unitCode"::TEXT ELSE NULL END AS cut_unit_code,
      CASE WHEN contract_line."state" = 'VALUED' THEN cut_line."baseQuantity" ELSE NULL END AS cut_base_quantity,
      CASE WHEN contract_line."state" = 'VALUED' THEN cut_line."periodQuantity" ELSE NULL END AS period_quantity,
      CASE WHEN contract_line."state" = 'VALUED' THEN cut_line."cumulativeQuantity" ELSE NULL END AS cumulative_quantity,
      contract_line."contractAmountMinor" AS contract_amount_minor,
      contract_line."noClaimReason" AS no_claim_reason,
      CASE WHEN contract_line."state" = 'VALUED' THEN previous_line."cumulativeGrossMinor" ELSE NULL END AS previous_gross,
      CASE WHEN contract_line."state" = 'VALUED' THEN (SELECT min(h."periodStart")
         FROM "TaskProgressMeasurementHead" h
         JOIN "TaskProgressMeasurement" m
           ON m."organizationId" = h."organizationId" AND m."projectId" = h."projectId"
          AND m."taskId" = h."taskId" AND m."id" = h."approvedMeasurementId"
        WHERE h."organizationId" = p_organization_id AND h."projectId" = p_project_id
          AND h."taskId" = contract_line."taskId" AND h."periodStart" <= p_period_start
          AND m."periodQuantity" > 0) ELSE NULL END AS origin
    FROM "ProjectContractLine" contract_line
    JOIN "ProjectProgressMeasurementCutLine" cut_line
      ON cut_line."organizationId" = contract_line."organizationId"
     AND cut_line."projectId" = contract_line."projectId"
     AND cut_line."cutId" = v_cut."id" AND cut_line."taskId" = contract_line."taskId"
    LEFT JOIN "ProjectCertificateLine" previous_line
      ON previous_line."certificateVersionId" = v_basis_previous."id"
     AND previous_line."taskId" = contract_line."taskId"
    WHERE contract_line."organizationId" = p_organization_id
      AND contract_line."projectId" = p_project_id
      AND contract_line."contractVersionId" = v_contract."id"
  ), calculated AS (
    SELECT joined.*,
      CASE WHEN state = 'VALUED' THEN "obrasaas_project_certificate_half_up"(
        contract_amount_minor::NUMERIC * cumulative_quantity, base_quantity
      ) ELSE NULL END AS cumulative_gross_numeric
    FROM joined
  ), checked AS (
    SELECT calculated.*,
      COALESCE(previous_gross, 0) AS previous_gross_value,
      CASE WHEN state = 'VALUED' THEN cumulative_gross_numeric - COALESCE(previous_gross, 0) ELSE NULL END AS increment_gross_numeric
    FROM calculated
  ), hashed AS (
    SELECT checked.*,
      "obrasaas_project_certificate_line_sha"(
        state, cut_state, task_id, task_code, task_title, task_revision,
        cut_line_id, cut_line_sha, contract_line_id, contract_line_sha,
        unit_code, base_quantity, period_quantity, cumulative_quantity, origin,
        contract_amount_minor,
        CASE WHEN state = 'VALUED' THEN previous_gross_value::BIGINT ELSE NULL END,
        CASE WHEN state = 'VALUED' THEN cumulative_gross_numeric ELSE NULL END,
        CASE WHEN state = 'VALUED' THEN increment_gross_numeric ELSE NULL END,
        no_claim_reason
      ) AS line_sha
    FROM checked
  )
  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE state = 'VALUED')::INTEGER,
    count(*) FILTER (WHERE state = 'NO_CLAIM')::INTEGER,
    COALESCE(sum(previous_gross_value) FILTER (WHERE state = 'VALUED'), 0),
    COALESCE(sum(cumulative_gross_numeric) FILTER (WHERE state = 'VALUED'), 0),
    COALESCE(sum(increment_gross_numeric) FILTER (WHERE state = 'VALUED'), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'ordinal', ordinal, 'state', state, 'cut_state', cut_state,
      'task_id', task_id, 'task_code', task_code, 'task_title', task_title,
      'task_revision', task_revision, 'cut_line_id', cut_line_id,
      'cut_line_sha', cut_line_sha, 'contract_line_id', contract_line_id,
      'contract_line_sha', contract_line_sha, 'unit_code', unit_code,
      'cut_unit_code', cut_unit_code,
      'cut_base_quantity', CASE WHEN cut_base_quantity IS NULL THEN NULL ELSE to_char(cut_base_quantity, 'FM99999999999999.0000') END,
      'base_quantity', CASE WHEN base_quantity IS NULL THEN NULL ELSE to_char(base_quantity, 'FM99999999999999.0000') END,
      'period_quantity', CASE WHEN period_quantity IS NULL THEN NULL ELSE to_char(period_quantity, 'FM99999999999999.0000') END,
      'cumulative_quantity', CASE WHEN cumulative_quantity IS NULL THEN NULL ELSE to_char(cumulative_quantity, 'FM99999999999999.0000') END,
      'origin', CASE WHEN origin IS NULL THEN NULL ELSE to_char(origin, 'YYYY-MM-DD') END,
      'contract_amount_minor', CASE WHEN contract_amount_minor IS NULL THEN NULL ELSE contract_amount_minor::TEXT END,
      'previous_gross', CASE WHEN state = 'VALUED' THEN previous_gross_value::TEXT ELSE NULL END,
      'cumulative_gross', CASE WHEN state = 'VALUED' THEN cumulative_gross_numeric::TEXT ELSE NULL END,
      'increment_gross', CASE WHEN state = 'VALUED' THEN increment_gross_numeric::TEXT ELSE NULL END,
      'no_claim_reason', no_claim_reason, 'line_sha', line_sha
    ) ORDER BY ordinal), '[]'::JSONB)
  INTO v_task_count, v_valued, v_no_claim, v_previous_total, v_cumulative_total,
       v_increment_total, v_lines
  FROM hashed;

  IF v_task_count < 1 OR v_valued < 1 OR v_task_count > 5000 THEN
    v_blockers := v_blockers || '"CERT_PINNED_PROVENANCE_MISMATCH"'::JSONB;
  END IF;
  IF v_task_count IS DISTINCT FROM v_cut."taskCount" OR v_task_count IS DISTINCT FROM v_contract."lineCount" THEN
    v_blockers := v_blockers || '"CERT_PINNED_PROVENANCE_MISMATCH"'::JSONB;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) line WHERE line ->> 'state' = 'VALUED' AND line ->> 'cut_state' <> 'MEASURED') THEN
    v_blockers := v_blockers || '"CERT_TECHNICAL_MEASUREMENT_MISSING"'::JSONB;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) line
     WHERE line ->> 'state' = 'VALUED'
       AND ((line ->> 'base_quantity') IS NULL OR (line ->> 'cumulative_quantity') IS NULL
         OR (line ->> 'unit_code') IS NULL
         OR line ->> 'unit_code' IS DISTINCT FROM line ->> 'cut_unit_code'
         OR line ->> 'base_quantity' IS DISTINCT FROM line ->> 'cut_base_quantity'
         OR (line ->> 'increment_gross')::NUMERIC < 0)
  ) THEN
    v_blockers := v_blockers || '"CERT_CONTRACT_TECHNICAL_BASIS_MISMATCH"'::JSONB;
  END IF;

  -- Every already-approved current period is a live technical authority input,
  -- not trusted merely because its cut head still points at the same row. A
  -- stale non-latest period requires future restatement; a stale latest period
  -- enables only its correction and blocks a later target.
  FOR v_historical IN
    SELECT certificate."periodStart", certificate."periodEnd", certificate."cutId",
           certificate."sourceCutCandidateSha256"::TEXT AS source_candidate,
           cut_head."currentCutId"
      FROM "ProjectCertificatePeriodHead" certificate_head
      JOIN "ProjectCertificateVersion" certificate
        ON certificate."organizationId" = certificate_head."organizationId"
       AND certificate."projectId" = certificate_head."projectId"
       AND certificate."bookId" = certificate_head."bookId"
       AND certificate."periodHeadId" = certificate_head."id"
       AND certificate."id" = certificate_head."currentApprovedVersionId"
      JOIN "ProjectProgressMeasurementCutHead" cut_head
        ON cut_head."organizationId" = certificate."organizationId"
       AND cut_head."projectId" = certificate."projectId"
       AND cut_head."periodStart" = certificate."periodStart"
       AND cut_head."periodEnd" = certificate."periodEnd"
     WHERE certificate_head."organizationId" = p_organization_id
       AND certificate_head."projectId" = p_project_id
     ORDER BY certificate."periodStart"
  LOOP
    SELECT * INTO v_live_cut FROM "obrasaas_progress_measurement_cut_build_candidate"(
      p_organization_id, p_project_id, v_historical."periodStart", v_historical."periodEnd"
    );
    IF v_live_cut.review_pending
      OR v_live_cut.candidate_sha256 IS DISTINCT FROM v_historical.source_candidate
      OR v_historical."currentCutId" IS DISTINCT FROM v_historical."cutId" THEN
      IF v_historical."periodStart" IS DISTINCT FROM v_book."latestApprovedPeriodStart" THEN
        v_blockers := v_blockers || '"HISTORICAL_RESTATEMENT_REQUIRED"'::JSONB;
      ELSIF p_period_start = v_historical."periodStart" THEN
        NULL; -- correction of the latest period is the only Phase-1 remedy
      ELSE
        v_blockers := v_blockers || '"CORRECTION_REQUIRED"'::JSONB;
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) line
     WHERE line ->> 'state' = 'VALUED' AND (
       line ->> 'origin' IS NULL OR v_contract."effectiveFrom" > (line ->> 'origin')::DATE
     )
  ) THEN
    v_blockers := v_blockers || '"CERT_RETROACTIVE_CONTRACT_BASIS"'::JSONB;
  END IF;
  IF v_previous_total < 0 OR v_cumulative_total < 0 OR v_increment_total < 0
    OR v_previous_total > 9223372036854775807 OR v_cumulative_total > 9223372036854775807
    OR v_increment_total > 9223372036854775807 THEN
    v_blockers := v_blockers || '"CERT_AMOUNT_OVERFLOW"'::JSONB;
  END IF;

  v_previous_retention_numeric := COALESCE(v_basis_previous."cumulativeRetentionMinor", 0);
  v_cumulative_retention_numeric := "obrasaas_project_certificate_half_up"(
    v_cumulative_total * v_contract."retentionBps", 10000
  );
  v_increment_retention_numeric := v_cumulative_retention_numeric - v_previous_retention_numeric;
  IF v_increment_retention_numeric < 0 OR v_cumulative_retention_numeric > 9223372036854775807 THEN
    v_blockers := v_blockers || '"CERT_AMOUNT_OVERFLOW"'::JSONB;
  END IF;

  SELECT min((line ->> 'origin')::DATE) INTO v_coverage_from
    FROM jsonb_array_elements(v_lines) line WHERE line ->> 'state' = 'VALUED';
  IF v_mode = 'NEXT_PERIOD' THEN v_coverage_from := v_previous."periodEnd" + 1; END IF;
  IF v_mode = 'CORRECTION' THEN
    v_coverage_from := CASE WHEN v_basis_previous."id" IS NULL THEN NULL
      ELSE v_basis_previous."periodEnd" + 1 END;
    v_coverage_from := COALESCE(v_coverage_from, (SELECT min((line ->> 'origin')::DATE)
      FROM jsonb_array_elements(v_lines) line WHERE line ->> 'state' = 'VALUED'));
  END IF;

  v_candidate := encode(sha256(convert_to(jsonb_build_array(
    'obrasaas-project-certificate-candidate-v1', p_organization_id, p_project_id,
    to_char(p_period_start, 'YYYY-MM-DD'), to_char(v_period_end, 'YYYY-MM-DD'),
    v_mode, COALESCE(v_book."revision", 0), COALESCE(v_period_head."revision", 0),
    v_period_head."currentApprovedVersionId", v_previous."id",
    v_cut."id", v_cut."candidateSha256"::TEXT, v_cut."cutSha256"::TEXT,
    v_contract_head."id", v_contract."id", v_contract."contractSha256"::TEXT,
    v_authority."id", v_authority."authoritySha256"::TEXT,
    v_previous_total::TEXT, v_cumulative_total::TEXT, v_increment_total::TEXT,
    v_previous_retention_numeric::TEXT, v_cumulative_retention_numeric::TEXT,
    v_increment_retention_numeric::TEXT,
    (SELECT jsonb_agg(jsonb_build_array(line ->> 'task_id', line ->> 'line_sha') ORDER BY line ->> 'task_id') FROM jsonb_array_elements(v_lines) line)
  )::TEXT, 'UTF8')), 'hex');

  v_blockers := "obrasaas_project_certificate_canonical_blockers"(v_blockers);
  RETURN QUERY SELECT v_period_end, v_mode, v_book."id", COALESCE(v_book."revision", 0),
    v_period_head."id", COALESCE(v_period_head."revision", 0), v_period_head."currentApprovedVersionId",
    v_period_head."latestVersionId", CASE WHEN v_mode = 'CORRECTION' THEN v_period_head."currentApprovedVersionId" ELSE NULL END,
    CASE WHEN v_mode = 'NEXT_PERIOD' THEN v_previous."id"
      WHEN v_mode = 'CORRECTION' THEN v_previous."previousApprovedCertificateVersionId" ELSE NULL END,
    v_coverage_from, v_period_end, v_cut_head."id", v_cut."id",
    v_cut."candidateSha256"::TEXT, v_cut."cutSha256"::TEXT,
    v_contract_head."id", v_contract."id", v_contract."contractSha256"::TEXT,
    v_authority."id", v_authority."authoritySha256"::TEXT,
    v_contract."currencyCode"::TEXT, v_contract."currencyMinorUnits"::INTEGER, v_contract."retentionBps",
    v_contract."roundingPolicyVersion"::TEXT, v_contract."adjustmentPolicyVersion"::TEXT,
    v_task_count, v_valued, v_no_claim,
    CASE WHEN v_previous_total BETWEEN 0 AND 9223372036854775807 THEN v_previous_total::BIGINT ELSE NULL END,
    CASE WHEN v_cumulative_total BETWEEN 0 AND 9223372036854775807 THEN v_cumulative_total::BIGINT ELSE NULL END,
    CASE WHEN v_increment_total BETWEEN 0 AND 9223372036854775807 THEN v_increment_total::BIGINT ELSE NULL END,
    CASE WHEN v_previous_retention_numeric BETWEEN 0 AND 9223372036854775807 THEN v_previous_retention_numeric::BIGINT ELSE NULL END,
    CASE WHEN v_cumulative_retention_numeric BETWEEN 0 AND 9223372036854775807 THEN v_cumulative_retention_numeric::BIGINT ELSE NULL END,
    CASE WHEN v_increment_retention_numeric BETWEEN 0 AND 9223372036854775807 THEN v_increment_retention_numeric::BIGINT ELSE NULL END,
    v_lines, v_candidate, v_blockers;
END;
$$;
