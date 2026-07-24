-- D1: worker document dossier and immutable project start acts.
CREATE TYPE "WorkerDocumentType" AS ENUM ('DNI', 'OBRA_SOCIAL', 'ART', 'CERTIFICATION', 'OTHER');
CREATE TYPE "WorkerDocumentStatus" AS ENUM ('PENDING_REVIEW', 'VALID', 'EXPIRED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "ProjectStartActStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURES', 'SIGNED', 'VOIDED');

CREATE TABLE "WorkerDocument" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "type" "WorkerDocumentType" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "WorkerDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "storage" JSONB NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" VARCHAR(500),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectStartAct" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ProjectStartActStatus" NOT NULL DEFAULT 'DRAFT',
  "document" JSONB NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectStartAct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectStartActParticipant" (
  "id" TEXT NOT NULL,
  "actId" TEXT NOT NULL,
  "subjectType" VARCHAR(32) NOT NULL,
  "subjectId" VARCHAR(190) NOT NULL,
  "displayName" VARCHAR(190) NOT NULL,
  "role" VARCHAR(64) NOT NULL,
  "signedAt" TIMESTAMP(3),
  "signature" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectStartActParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerDocument_projectId_workerId_type_version_key" ON "WorkerDocument"("projectId", "workerId", "type", "version");
CREATE INDEX "WorkerDocument_projectId_status_expiresAt_idx" ON "WorkerDocument"("projectId", "status", "expiresAt");
CREATE INDEX "WorkerDocument_workerId_type_status_idx" ON "WorkerDocument"("workerId", "type", "status");
CREATE INDEX "WorkerDocument_expiresAt_status_idx" ON "WorkerDocument"("expiresAt", "status");
CREATE UNIQUE INDEX "ProjectStartAct_projectId_version_key" ON "ProjectStartAct"("projectId", "version");
CREATE INDEX "ProjectStartAct_projectId_status_idx" ON "ProjectStartAct"("projectId", "status");
CREATE UNIQUE INDEX "ProjectStartActParticipant_actId_subjectType_subjectId_key" ON "ProjectStartActParticipant"("actId", "subjectType", "subjectId");
CREATE INDEX "ProjectStartActParticipant_subjectId_subjectType_idx" ON "ProjectStartActParticipant"("subjectId", "subjectType");

ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStartAct" ADD CONSTRAINT "ProjectStartAct_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStartActParticipant" ADD CONSTRAINT "ProjectStartActParticipant_actId_fkey" FOREIGN KEY ("actId") REFERENCES "ProjectStartAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
