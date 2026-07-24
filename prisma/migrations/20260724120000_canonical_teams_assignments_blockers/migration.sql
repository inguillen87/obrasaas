CREATE TYPE "WorkTeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "WorkTeamMemberRole" AS ENUM ('LEAD', 'MEMBER');
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "ProjectBlockerStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE "ProjectBlockerSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "WorkTeam" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" VARCHAR(64),
  "name" VARCHAR(160) NOT NULL,
  "status" "WorkTeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTeam_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkTeam_revision_nonnegative_check" CHECK ("revision" >= 0),
  CONSTRAINT "WorkTeam_name_not_blank_check" CHECK (length(btrim("name")) > 0)
);

CREATE UNIQUE INDEX "WorkTeam_projectId_id_key" ON "WorkTeam"("projectId", "id");
CREATE UNIQUE INDEX "WorkTeam_projectId_code_key" ON "WorkTeam"("projectId", "code");
CREATE INDEX "WorkTeam_project_status_name_idx" ON "WorkTeam"("projectId", "status", "name");

CREATE TABLE "WorkTeamMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "role" "WorkTeamMemberRole" NOT NULL DEFAULT 'MEMBER',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTeamMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkTeamMember_dates_check" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt"),
  CONSTRAINT "WorkTeamMember_revision_nonnegative_check" CHECK ("revision" >= 0)
);

CREATE UNIQUE INDEX "WorkTeamMember_project_team_worker_start_key"
  ON "WorkTeamMember"("projectId", "teamId", "workerId", "startsAt");
CREATE INDEX "WorkTeamMember_project_worker_end_idx" ON "WorkTeamMember"("projectId", "workerId", "endsAt");
CREATE INDEX "WorkTeamMember_project_team_end_idx" ON "WorkTeamMember"("projectId", "teamId", "endsAt");

CREATE TABLE "TaskAssignment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "workerId" TEXT,
  "teamId" TEXT,
  "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'PLANNED',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskAssignment_owner_check" CHECK ("workerId" IS NOT NULL OR "teamId" IS NOT NULL),
  CONSTRAINT "TaskAssignment_dates_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt"),
  CONSTRAINT "TaskAssignment_revision_nonnegative_check" CHECK ("revision" >= 0)
);

CREATE UNIQUE INDEX "TaskAssignment_projectId_id_key" ON "TaskAssignment"("projectId", "id");
CREATE INDEX "TaskAssignment_project_task_status_idx" ON "TaskAssignment"("projectId", "taskId", "status");
CREATE INDEX "TaskAssignment_project_worker_status_idx" ON "TaskAssignment"("projectId", "workerId", "status");
CREATE INDEX "TaskAssignment_project_team_status_idx" ON "TaskAssignment"("projectId", "teamId", "status");

CREATE TABLE "ProjectBlocker" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "ownerWorkerId" TEXT,
  "ownerTeamId" TEXT,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "severity" "ProjectBlockerSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "ProjectBlockerStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectBlocker_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectBlocker_title_not_blank_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "ProjectBlocker_revision_nonnegative_check" CHECK ("revision" >= 0),
  CONSTRAINT "ProjectBlocker_resolution_state_check" CHECK (
    ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL AND "resolution" IS NOT NULL)
    OR ("status" <> 'RESOLVED')
  )
);

CREATE UNIQUE INDEX "ProjectBlocker_projectId_id_key" ON "ProjectBlocker"("projectId", "id");
CREATE INDEX "ProjectBlocker_project_status_severity_due_idx" ON "ProjectBlocker"("projectId", "status", "severity", "dueAt");
CREATE INDEX "ProjectBlocker_project_task_status_idx" ON "ProjectBlocker"("projectId", "taskId", "status");

ALTER TABLE "WorkTeam"
  ADD CONSTRAINT "WorkTeam_project_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkTeamMember"
  ADD CONSTRAINT "WorkTeamMember_team_scope_fkey"
    FOREIGN KEY ("projectId", "teamId") REFERENCES "WorkTeam"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkTeamMember_worker_scope_fkey"
    FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment"
  ADD CONSTRAINT "TaskAssignment_task_scope_fkey"
    FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskAssignment_worker_scope_fkey"
    FOREIGN KEY ("projectId", "workerId") REFERENCES "Worker"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskAssignment_team_scope_fkey"
    FOREIGN KEY ("projectId", "teamId") REFERENCES "WorkTeam"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectBlocker"
  ADD CONSTRAINT "ProjectBlocker_project_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectBlocker_task_scope_fkey"
    FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectBlocker_worker_scope_fkey"
    FOREIGN KEY ("projectId", "ownerWorkerId") REFERENCES "Worker"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectBlocker_team_scope_fkey"
    FOREIGN KEY ("projectId", "ownerTeamId") REFERENCES "WorkTeam"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
