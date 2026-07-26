CREATE TYPE "VisualProgressAssessmentStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'ABSTAINED',
  'FAILED'
);

CREATE TYPE "VisualProgressAssessmentReviewStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'CORRECTED',
  'REJECTED'
);

CREATE TABLE "VisualProgressAssessment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "operationKeyHash" CHAR(64) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "providerModel" VARCHAR(120) NOT NULL,
  "analyzerVersion" VARCHAR(64) NOT NULL,
  "inputSha256" CHAR(64) NOT NULL,
  "baselineHash" CHAR(64) NOT NULL,
  "taskRevisionAtRequest" INTEGER NOT NULL,
  "evidenceRevisionAtRequest" INTEGER NOT NULL,
  "status" "VisualProgressAssessmentStatus" NOT NULL DEFAULT 'PENDING',
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT,
  "elementType" VARCHAR(120),
  "progressMin" INTEGER,
  "progressMax" INTEGER,
  "confidence" DECIMAL(5,4),
  "quality" JSONB,
  "observations" JSONB,
  "limitations" JSONB,
  "providerResponseId" VARCHAR(190),
  "failureCode" VARCHAR(64),
  "completedAt" TIMESTAMP(3),
  "requestedById" TEXT,
  "reviewStatus" "VisualProgressAssessmentReviewStatus",
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "correctedProgressMin" INTEGER,
  "correctedProgressMax" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VisualProgressAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VisualProgressAssessment_hashes_check" CHECK (
    "operationKeyHash" ~ '^[0-9a-f]{64}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND "inputSha256" ~ '^[0-9a-f]{64}$'
    AND "baselineHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "VisualProgressAssessment_versions_check" CHECK (
    "taskRevisionAtRequest" >= 0
    AND "evidenceRevisionAtRequest" >= 0
    AND "attemptCount" >= 0
    AND "revision" >= 0
  ),
  CONSTRAINT "VisualProgressAssessment_lease_state_check" CHECK (
    (
      "status" = 'PENDING'
      AND "leaseExpiresAt" IS NULL
      AND "attemptCount" = 0
    )
    OR (
      "status" = 'RUNNING'
      AND "leaseExpiresAt" IS NOT NULL
      AND "leaseExpiresAt" >= "createdAt"
      AND "attemptCount" >= 1
    )
    OR (
      "status" IN ('COMPLETED', 'ABSTAINED', 'FAILED')
      AND "leaseExpiresAt" IS NULL
      AND "attemptCount" >= 1
    )
  ),
  CONSTRAINT "VisualProgressAssessment_provider_identity_check" CHECK (
    char_length(btrim("provider")) BETWEEN 1 AND 64
    AND char_length(btrim("providerModel")) BETWEEN 1 AND 120
    AND char_length(btrim("analyzerVersion")) BETWEEN 1 AND 64
    AND ("providerResponseId" IS NULL OR char_length(btrim("providerResponseId")) BETWEEN 1 AND 190)
  ),
  CONSTRAINT "VisualProgressAssessment_element_type_check" CHECK (
    "elementType" IS NULL OR char_length(btrim("elementType")) BETWEEN 1 AND 120
  ),
  CONSTRAINT "VisualProgressAssessment_progress_range_check" CHECK (
    ("progressMin" IS NULL AND "progressMax" IS NULL)
    OR (
      "progressMin" IS NOT NULL
      AND "progressMax" IS NOT NULL
      AND "progressMin" BETWEEN 0 AND 100
      AND "progressMax" BETWEEN 0 AND 100
      AND "progressMin" <= "progressMax"
    )
  ),
  CONSTRAINT "VisualProgressAssessment_confidence_check" CHECK (
    "confidence" IS NULL OR "confidence" BETWEEN 0 AND 1
  ),
  CONSTRAINT "VisualProgressAssessment_json_shape_check" CHECK (
    ("quality" IS NULL OR jsonb_typeof("quality") = 'object')
    AND ("observations" IS NULL OR jsonb_typeof("observations") = 'array')
    AND ("limitations" IS NULL OR jsonb_typeof("limitations") = 'array')
  ),
  CONSTRAINT "VisualProgressAssessment_failure_code_check" CHECK (
    "failureCode" IS NULL OR "failureCode" ~ '^[A-Z][A-Z0-9_]{0,63}$'
  ),
  CONSTRAINT "VisualProgressAssessment_result_state_check" CHECK (
    (
      "status" IN ('PENDING', 'RUNNING')
      AND "summary" IS NULL
      AND "elementType" IS NULL
      AND "progressMin" IS NULL
      AND "progressMax" IS NULL
      AND "confidence" IS NULL
      AND "quality" IS NULL
      AND "observations" IS NULL
      AND "limitations" IS NULL
      AND "providerResponseId" IS NULL
      AND "failureCode" IS NULL
      AND "completedAt" IS NULL
    )
    OR (
      "status" = 'COMPLETED'
      AND "summary" IS NOT NULL
      AND char_length(btrim("summary")) > 0
      AND "progressMin" IS NOT NULL
      AND "progressMax" IS NOT NULL
      AND "confidence" IS NOT NULL
      AND "quality" IS NOT NULL
      AND "observations" IS NOT NULL
      AND "limitations" IS NOT NULL
      AND "failureCode" IS NULL
      AND "completedAt" IS NOT NULL
    )
    OR (
      "status" = 'ABSTAINED'
      AND "summary" IS NOT NULL
      AND char_length(btrim("summary")) > 0
      AND "progressMin" IS NULL
      AND "progressMax" IS NULL
      AND "quality" IS NOT NULL
      AND "limitations" IS NOT NULL
      AND jsonb_array_length("limitations") > 0
      AND "failureCode" IS NULL
      AND "completedAt" IS NOT NULL
    )
    OR (
      "status" = 'FAILED'
      AND "summary" IS NULL
      AND "elementType" IS NULL
      AND "progressMin" IS NULL
      AND "progressMax" IS NULL
      AND "confidence" IS NULL
      AND "quality" IS NULL
      AND "observations" IS NULL
      AND "limitations" IS NULL
      AND "failureCode" IS NOT NULL
      AND "completedAt" IS NOT NULL
    )
  ),
  CONSTRAINT "VisualProgressAssessment_review_state_check" CHECK (
    (
      "status" IN ('PENDING', 'RUNNING', 'FAILED')
      AND "reviewStatus" IS NULL
      AND "reviewedById" IS NULL
      AND "reviewedAt" IS NULL
      AND "reviewNote" IS NULL
      AND "correctedProgressMin" IS NULL
      AND "correctedProgressMax" IS NULL
    )
    OR (
      "status" IN ('COMPLETED', 'ABSTAINED')
      AND "reviewStatus" = 'PENDING'
      AND "reviewedById" IS NULL
      AND "reviewedAt" IS NULL
      AND "reviewNote" IS NULL
      AND "correctedProgressMin" IS NULL
      AND "correctedProgressMax" IS NULL
    )
    OR (
      "status" IN ('COMPLETED', 'ABSTAINED')
      AND "reviewStatus" = 'APPROVED'
      AND "reviewedById" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "correctedProgressMin" IS NULL
      AND "correctedProgressMax" IS NULL
    )
    OR (
      "status" IN ('COMPLETED', 'ABSTAINED')
      AND "reviewStatus" = 'CORRECTED'
      AND "reviewedById" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "reviewNote" IS NOT NULL
      AND char_length(btrim("reviewNote")) > 0
      AND "correctedProgressMin" IS NOT NULL
      AND "correctedProgressMax" IS NOT NULL
      AND "correctedProgressMin" BETWEEN 0 AND 100
      AND "correctedProgressMax" BETWEEN 0 AND 100
      AND "correctedProgressMin" <= "correctedProgressMax"
    )
    OR (
      "status" IN ('COMPLETED', 'ABSTAINED')
      AND "reviewStatus" = 'REJECTED'
      AND "reviewedById" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "reviewNote" IS NOT NULL
      AND char_length(btrim("reviewNote")) > 0
      AND "correctedProgressMin" IS NULL
      AND "correctedProgressMax" IS NULL
    )
  ),
  CONSTRAINT "VisualProgressAssessment_timestamps_check" CHECK (
    ("completedAt" IS NULL OR "completedAt" >= "createdAt")
    AND ("reviewedAt" IS NULL OR ("completedAt" IS NOT NULL AND "reviewedAt" >= "completedAt"))
  )
);

CREATE UNIQUE INDEX "VisualProgressAssessment_projectId_id_key"
  ON "VisualProgressAssessment"("projectId", "id");

CREATE UNIQUE INDEX "VisualProgressAssessment_project_operation_key"
  ON "VisualProgressAssessment"("projectId", "operationKeyHash");

-- Exactly one provider job or unresolved human review may exist for an
-- evidence item. The service project lock gives a friendly conflict; this
-- partial index is the database-level race fence.
CREATE UNIQUE INDEX "VPA_project_evidence_open_key"
  ON "VisualProgressAssessment"("projectId", "evidenceId")
  WHERE (
    "status" IN ('PENDING', 'RUNNING')
    OR (
      "status" IN ('COMPLETED', 'ABSTAINED')
      AND "reviewStatus" = 'PENDING'
    )
  );

CREATE INDEX "VisualProgressAssessment_project_fingerprint_idx"
  ON "VisualProgressAssessment"("projectId", "requestFingerprint");

CREATE INDEX "VPA_project_status_lease_idx"
  ON "VisualProgressAssessment"("projectId", "status", "leaseExpiresAt");

CREATE INDEX "VPA_project_task_status_created_idx"
  ON "VisualProgressAssessment"("projectId", "taskId", "status", "createdAt");

CREATE INDEX "VPA_project_evidence_created_idx"
  ON "VisualProgressAssessment"("projectId", "evidenceId", "createdAt");

CREATE INDEX "VPA_project_review_created_idx"
  ON "VisualProgressAssessment"("projectId", "reviewStatus", "createdAt");

CREATE INDEX "VPA_requester_created_idx"
  ON "VisualProgressAssessment"("requestedById", "createdAt");

CREATE INDEX "VPA_reviewer_reviewed_idx"
  ON "VisualProgressAssessment"("reviewedById", "reviewedAt");

ALTER TABLE "VisualProgressAssessment"
  ADD CONSTRAINT "VisualProgressAssessment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisualProgressAssessment"
  ADD CONSTRAINT "VisualProgressAssessment_project_task_fkey"
  FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VisualProgressAssessment"
  ADD CONSTRAINT "VisualProgressAssessment_project_evidence_fkey"
  FOREIGN KEY ("projectId", "evidenceId") REFERENCES "ProgressEvidence"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VisualProgressAssessment"
  ADD CONSTRAINT "VisualProgressAssessment_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VisualProgressAssessment"
  ADD CONSTRAINT "VisualProgressAssessment_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
