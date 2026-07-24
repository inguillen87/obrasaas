CREATE TYPE "BudgetVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
CREATE TABLE "BudgetVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "BudgetVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" CHAR(3) NOT NULL,
  "baseVersion" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetVersion_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BudgetVersion_projectId_id_key" ON "BudgetVersion"("projectId", "id");
CREATE UNIQUE INDEX "BudgetVersion_projectId_version_key" ON "BudgetVersion"("projectId", "version");
CREATE INDEX "BudgetVersion_projectId_status_idx" ON "BudgetVersion"("projectId", "status");
CREATE TABLE "BudgetLine" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "budgetVersionId" TEXT NOT NULL,
  "taskId" TEXT,
  "costCode" VARCHAR(64) NOT NULL,
  "description" VARCHAR(220) NOT NULL,
  "quantity" DECIMAL(14,4),
  "unit" VARCHAR(32),
  "unitRate" DECIMAL(14,2),
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetLine_version_fkey" FOREIGN KEY ("projectId", "budgetVersionId") REFERENCES "BudgetVersion"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BudgetLine_task_fkey" FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BudgetLine_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "BudgetLine_quantity_check" CHECK ("quantity" IS NULL OR "quantity" >= 0),
  CONSTRAINT "BudgetLine_unitRate_check" CHECK ("unitRate" IS NULL OR "unitRate" >= 0)
);
CREATE UNIQUE INDEX "BudgetLine_projectId_id_key" ON "BudgetLine"("projectId", "id");
CREATE INDEX "BudgetLine_projectId_budgetVersionId_costCode_idx" ON "BudgetLine"("projectId", "budgetVersionId", "costCode");
CREATE INDEX "BudgetLine_projectId_taskId_idx" ON "BudgetLine"("projectId", "taskId");
