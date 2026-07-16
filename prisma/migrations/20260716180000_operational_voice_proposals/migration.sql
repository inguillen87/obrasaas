-- CreateEnum
CREATE TYPE "OperationalProposalType" AS ENUM ('TASK_PROGRESS', 'DELAY_REPORT', 'CRITICAL_INCIDENT');

-- CreateEnum
CREATE TYPE "OperationalProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'EXPIRED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "OperationalProposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "proposedByWorkerId" TEXT,
    "resolvedByWorkerId" TEXT,
    "sourceProvider" VARCHAR(32) NOT NULL,
    "sourceExternalId" VARCHAR(512) NOT NULL,
    "resolverProvider" VARCHAR(32),
    "resolverExternalId" VARCHAR(512),
    "confirmationCode" VARCHAR(16) NOT NULL,
    "type" "OperationalProposalType" NOT NULL,
    "status" "OperationalProposalStatus" NOT NULL DEFAULT 'PENDING',
    "summary" VARCHAR(280) NOT NULL,
    "action" JSONB NOT NULL,
    "precondition" JSONB,
    "result" JSONB,
    "classifierVersion" VARCHAR(64) NOT NULL,
    "transcriptSha256" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalProposal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OperationalProposal_expiry_after_creation_check"
      CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "OperationalProposal_action_size_check"
      CHECK (octet_length("action"::text) <= 8192),
    CONSTRAINT "OperationalProposal_task_percentage_check"
      CHECK (
        CASE
          WHEN "type" = 'TASK_PROGRESS' THEN
            CASE
              WHEN jsonb_typeof("action"->'percentage') = 'number' THEN
                (("action"->>'percentage')::numeric BETWEEN 0 AND 100)
              ELSE FALSE
            END
          ELSE TRUE
        END
      ),
    CONSTRAINT "OperationalProposal_resolution_shape_check"
      CHECK (
        (
          "status" = 'PENDING'
          AND "resolvedAt" IS NULL
          AND "resolvedByWorkerId" IS NULL
          AND "resolverProvider" IS NULL
          AND "resolverExternalId" IS NULL
        )
        OR
        (
          "status" <> 'PENDING'
          AND "resolvedAt" IS NOT NULL
        )
      ),
    CONSTRAINT "OperationalProposal_actor_for_decision_check"
      CHECK (
        "status" NOT IN ('APPLIED', 'REJECTED', 'INVALIDATED')
        OR (
          "resolverProvider" IS NOT NULL
          AND "resolverExternalId" IS NOT NULL
        )
      )
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalProposal_projectId_sourceProvider_sourceExternalId_key"
ON "OperationalProposal"("projectId", "sourceProvider", "sourceExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalProposal_projectId_resolverProvider_resolverExternalId_key"
ON "OperationalProposal"("projectId", "resolverProvider", "resolverExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalProposal_projectId_confirmationCode_key"
ON "OperationalProposal"("projectId", "confirmationCode");

-- CreateIndex
CREATE INDEX "OperationalProposal_projectId_status_expiresAt_idx"
ON "OperationalProposal"("projectId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "OperationalProposal_proposedByWorkerId_status_createdAt_idx"
ON "OperationalProposal"("proposedByWorkerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "OperationalProposal"
ADD CONSTRAINT "OperationalProposal_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalProposal"
ADD CONSTRAINT "OperationalProposal_proposedByWorkerId_fkey"
FOREIGN KEY ("proposedByWorkerId") REFERENCES "Worker"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalProposal"
ADD CONSTRAINT "OperationalProposal_resolvedByWorkerId_fkey"
FOREIGN KEY ("resolvedByWorkerId") REFERENCES "Worker"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
