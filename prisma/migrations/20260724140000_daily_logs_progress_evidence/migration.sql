CREATE TYPE "DailyLogStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TYPE "ProgressEvidenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "DailyLog" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "authorWorkerId" TEXT,
  "workDate" DATE NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "DailyLogStatus" NOT NULL DEFAULT 'DRAFT',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressEvidence" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorWorkerId" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "caption" TEXT,
  "media" JSONB NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "accuracyMeters" DECIMAL(9,2),
  "status" "ProgressEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgressEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyLog_projectId_id_key" ON "DailyLog"("projectId", "id");
CREATE INDEX "DailyLog_projectId_workDate_status_idx" ON "DailyLog"("projectId", "workDate", "status");
CREATE INDEX "DailyLog_projectId_taskId_workDate_idx" ON "DailyLog"("projectId", "taskId", "workDate");
CREATE UNIQUE INDEX "ProgressEvidence_projectId_id_key" ON "ProgressEvidence"("projectId", "id");
CREATE INDEX "ProgressEvidence_projectId_taskId_capturedAt_idx" ON "ProgressEvidence"("projectId", "taskId", "capturedAt");
CREATE INDEX "ProgressEvidence_projectId_status_capturedAt_idx" ON "ProgressEvidence"("projectId", "status", "capturedAt");

ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_project_task_fkey" FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_project_worker_fkey" FOREIGN KEY ("projectId", "authorWorkerId") REFERENCES "Worker"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressEvidence" ADD CONSTRAINT "ProgressEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressEvidence" ADD CONSTRAINT "ProgressEvidence_project_task_fkey" FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressEvidence" ADD CONSTRAINT "ProgressEvidence_project_worker_fkey" FOREIGN KEY ("projectId", "authorWorkerId") REFERENCES "Worker"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_revision_check" CHECK ("revision" >= 0);
ALTER TABLE "ProgressEvidence" ADD CONSTRAINT "ProgressEvidence_revision_check" CHECK ("revision" >= 0);
ALTER TABLE "ProgressEvidence" ADD CONSTRAINT "ProgressEvidence_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));
