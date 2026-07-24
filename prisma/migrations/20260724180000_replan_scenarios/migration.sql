CREATE TYPE "ReplanScenarioStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'APPLIED');
CREATE TABLE "ReplanScenario" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "extraWorkId" TEXT,
  "name" VARCHAR(220) NOT NULL,
  "assumptions" JSONB NOT NULL,
  "impact" JSONB NOT NULL,
  "status" "ReplanScenarioStatus" NOT NULL DEFAULT 'PROPOSED',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReplanScenario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReplanScenario_projectId_id_key" ON "ReplanScenario"("projectId", "id");
CREATE INDEX "ReplanScenario_projectId_status_createdAt_idx" ON "ReplanScenario"("projectId", "status", "createdAt");
CREATE INDEX "ReplanScenario_projectId_extraWorkId_idx" ON "ReplanScenario"("projectId", "extraWorkId");
ALTER TABLE "ReplanScenario" ADD CONSTRAINT "ReplanScenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplanScenario" ADD CONSTRAINT "ReplanScenario_extraWorkId_fkey" FOREIGN KEY ("extraWorkId") REFERENCES "ExtraWorkRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplanScenario" ADD CONSTRAINT "ReplanScenario_revision_check" CHECK ("revision" >= 0);
