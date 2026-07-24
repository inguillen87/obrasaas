-- S6: auditable start/finish sessions for approved extra work.
CREATE TYPE "ExtraWorkSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'VOIDED');

CREATE TABLE "ExtraWorkSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "extraWorkId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "status" "ExtraWorkSessionStatus" NOT NULL DEFAULT 'OPEN',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "startLatitude" DECIMAL(10,7),
  "startLongitude" DECIMAL(10,7),
  "finishLatitude" DECIMAL(10,7),
  "finishLongitude" DECIMAL(10,7),
  "startAccuracy" DECIMAL(8,2),
  "finishAccuracy" DECIMAL(8,2),
  "evidenceIds" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExtraWorkSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtraWorkSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExtraWorkSession_extraWork_project_fkey" FOREIGN KEY ("projectId", "extraWorkId") REFERENCES "ExtraWorkRequest"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExtraWorkSession_worker_project_fkey" FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtraWorkSession_time_check" CHECK ("finishedAt" IS NULL OR "finishedAt" >= "startedAt"),
  CONSTRAINT "ExtraWorkSession_accuracy_check" CHECK (("startAccuracy" IS NULL OR "startAccuracy" >= 0) AND ("finishAccuracy" IS NULL OR "finishAccuracy" >= 0))
);
CREATE UNIQUE INDEX "ExtraWorkSession_projectId_id_key" ON "ExtraWorkSession"("projectId", "id");
CREATE INDEX "ExtraWorkSession_projectId_extraWorkId_status_idx" ON "ExtraWorkSession"("projectId", "extraWorkId", "status");
CREATE INDEX "ExtraWorkSession_projectId_workerId_status_idx" ON "ExtraWorkSession"("projectId", "workerId", "status");
