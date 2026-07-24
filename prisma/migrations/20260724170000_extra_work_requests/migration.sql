CREATE TYPE "ExtraWorkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TABLE "ExtraWorkRequest" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "requestedByWorkerId" TEXT,
  "title" VARCHAR(220) NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "impactDays" INTEGER,
  "impactCost" DECIMAL(12,2),
  "currency" CHAR(3),
  "status" "ExtraWorkStatus" NOT NULL DEFAULT 'DRAFT',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExtraWorkRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExtraWorkRequest_projectId_id_key" ON "ExtraWorkRequest"("projectId", "id");
CREATE INDEX "ExtraWorkRequest_projectId_status_createdAt_idx" ON "ExtraWorkRequest"("projectId", "status", "createdAt");
CREATE INDEX "ExtraWorkRequest_projectId_taskId_status_idx" ON "ExtraWorkRequest"("projectId", "taskId", "status");
ALTER TABLE "ExtraWorkRequest" ADD CONSTRAINT "ExtraWorkRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtraWorkRequest" ADD CONSTRAINT "ExtraWorkRequest_project_task_fkey" FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtraWorkRequest" ADD CONSTRAINT "ExtraWorkRequest_project_worker_fkey" FOREIGN KEY ("projectId", "requestedByWorkerId") REFERENCES "Worker"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtraWorkRequest" ADD CONSTRAINT "ExtraWorkRequest_invariants_check" CHECK ("revision" >= 0 AND ("impactDays" IS NULL OR "impactDays" >= 0) AND ("impactCost" IS NULL OR "impactCost" >= 0));
