CREATE TYPE "TaskType" AS ENUM ('TASK', 'MILESTONE');

CREATE TYPE "TaskDependencyType" AS ENUM (
  'FINISH_TO_START',
  'START_TO_START',
  'FINISH_TO_FINISH',
  'START_TO_FINISH'
);

ALTER TABLE "Task"
  ADD COLUMN "code" VARCHAR(64),
  ADD COLUMN "type" "TaskType" NOT NULL DEFAULT 'TASK',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parentId" TEXT;

CREATE UNIQUE INDEX "Task_projectId_id_key" ON "Task"("projectId", "id");
CREATE UNIQUE INDEX "Task_projectId_code_key" ON "Task"("projectId", "code");
CREATE INDEX "Task_projectId_parentId_idx" ON "Task"("projectId", "parentId");

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_progress_range_check"
    CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Task_revision_nonnegative_check"
    CHECK ("revision" >= 0),
  ADD CONSTRAINT "Task_code_not_blank_check"
    CHECK ("code" IS NULL OR length(btrim("code")) > 0),
  ADD CONSTRAINT "Task_parent_scope_fkey"
    FOREIGN KEY ("projectId", "parentId")
    REFERENCES "Task"("projectId", "id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

CREATE TABLE "TaskDependency" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "predecessorId" TEXT NOT NULL,
  "successorId" TEXT NOT NULL,
  "type" "TaskDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
  "lagDays" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskDependency_not_self_check" CHECK ("predecessorId" <> "successorId"),
  CONSTRAINT "TaskDependency_lag_range_check" CHECK ("lagDays" BETWEEN -3650 AND 3650)
);

CREATE UNIQUE INDEX "TaskDependency_project_predecessor_successor_key"
  ON "TaskDependency"("projectId", "predecessorId", "successorId");
CREATE INDEX "TaskDependency_project_successor_idx"
  ON "TaskDependency"("projectId", "successorId");

ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_project_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskDependency_predecessor_scope_fkey"
    FOREIGN KEY ("projectId", "predecessorId")
    REFERENCES "Task"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskDependency_successor_scope_fkey"
    FOREIGN KEY ("projectId", "successorId")
    REFERENCES "Task"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
