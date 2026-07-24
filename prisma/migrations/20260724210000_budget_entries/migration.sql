CREATE TYPE "BudgetEntryKind" AS ENUM ('COMMITMENT', 'ACTUAL', 'FORECAST');
CREATE TABLE "BudgetEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "budgetLineId" TEXT NOT NULL,
  "kind" "BudgetEntryKind" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "externalRef" VARCHAR(190),
  "description" VARCHAR(500),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetEntry_line_fkey" FOREIGN KEY ("projectId", "budgetLineId") REFERENCES "BudgetLine"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BudgetEntry_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "BudgetEntry_projectId_id_key" ON "BudgetEntry"("projectId", "id");
CREATE INDEX "BudgetEntry_projectId_budgetLineId_kind_occurredAt_idx" ON "BudgetEntry"("projectId", "budgetLineId", "kind", "occurredAt");
CREATE INDEX "BudgetEntry_projectId_kind_occurredAt_idx" ON "BudgetEntry"("projectId", "kind", "occurredAt");
