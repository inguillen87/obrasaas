ALTER TABLE "PurchaseOrderLine" ADD COLUMN "projectId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "budgetLineId" TEXT;
UPDATE "PurchaseOrderLine" SET "projectId" = (SELECT "projectId" FROM "PurchaseOrder" WHERE "PurchaseOrder"."id" = "PurchaseOrderLine"."purchaseOrderId");
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "projectId" DROP DEFAULT;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_budgetLine_fkey" FOREIGN KEY ("projectId", "budgetLineId") REFERENCES "BudgetLine"("projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PurchaseOrderLine_projectId_budgetLineId_idx" ON "PurchaseOrderLine"("projectId", "budgetLineId");
