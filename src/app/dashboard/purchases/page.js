import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from "@/lib/access";
import {
  listGoodsReceiptLineBalances,
  serializeGoodsReceipt,
} from "@/lib/goods-receipts";
import { getPrisma } from "@/lib/prisma";
import { listPurchaseOrders } from "@/lib/purchase-orders";
import { listSuppliers } from "@/lib/suppliers";
import { addCivilDays, listSupplierCommitments, todayInTimezone } from "@/lib/supplier-commitments";

import PurchasesClient from "./purchases-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compras",
  description: "Órdenes y recepción de materiales.",
};

export default async function PurchasesPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, "org:execution:read", { subscriptionMode: "read" });
  const prisma = getPrisma();
  const tenantToday = todayInTimezone(access.organization.timezone);
  const taskHorizonEnd = addCivilDays(tenantToday, 89);
  const taskRangeStart = new Date(`${tenantToday}T00:00:00.000Z`);
  const taskRangeEnd = new Date(`${taskHorizonEnd}T23:59:59.999Z`);
  const data = await listPurchaseOrders(prisma, {
    organizationId: access.organization.id,
    projectId: access.project.id,
  });
  const [
    supplierData,
    budgetLines,
    receipts,
    lineBalances,
    commitmentData,
    tasks,
  ] = await Promise.all([
    listSuppliers(prisma, { organizationId: access.organization.id, active: true }),
    prisma.budgetLine.findMany({
      where: { projectId: access.project.id },
      select: { id: true, costCode: true, description: true },
      orderBy: { costCode: "asc" },
      take: 500,
    }),
    prisma.goodsReceipt.findMany({
      where: {
        organizationId: access.organization.id,
        projectId: access.project.id,
        status: "POSTED",
      },
      include: { lines: true },
      orderBy: { receivedAt: "desc" },
      take: 501,
    }),
    listGoodsReceiptLineBalances(prisma, {
      organizationId: access.organization.id,
      projectId: access.project.id,
      purchaseOrderIds: data.purchaseOrders.map((order) => order.id),
    }),
    listSupplierCommitments(prisma, {
      organizationId: access.organization.id,
      projectId: access.project.id,
    }),
    prisma.task.findMany({
      where: {
        projectId: access.project.id,
        metadata: { path: ["source"], equals: "canonical-task-v1" },
        startsAt: { lte: taskRangeEnd },
        OR: [
          { endsAt: { gte: taskRangeStart } },
          { endsAt: null, startsAt: { gte: taskRangeStart } },
        ],
      },
      select: { id: true, code: true, title: true, status: true, startsAt: true, endsAt: true },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 5_001,
    }),
  ]);

  return (
    <PurchasesClient
      initialOrders={data.purchaseOrders}
      initialReceipts={receipts.slice(0, 500).map(serializeGoodsReceipt)}
      initialReceiptsTruncated={receipts.length > 500}
      initialLineBalances={lineBalances}
      initialCommitments={commitmentData.commitments}
      suppliers={supplierData.suppliers}
      budgetLines={budgetLines}
      tasks={tasks.slice(0, 5_000).map((task) => ({
        ...task,
        startsAt: task.startsAt?.toISOString() || null,
        endsAt: task.endsAt?.toISOString() || null,
      }))}
      tasksTruncated={tasks.length > 5_000}
      projectName={access.project.name}
      tenantToday={tenantToday}
      canManage={hasTenantPermission(access, "org:execution:manage")}
    />
  );
}
