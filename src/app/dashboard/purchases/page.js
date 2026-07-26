import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from "@/lib/access";
import { serializeGoodsReceipt } from "@/lib/goods-receipts";
import { getPrisma } from "@/lib/prisma";
import { listPurchaseOrders } from "@/lib/purchase-orders";
import { listSuppliers } from "@/lib/suppliers";

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
  const [data, supplierData, budgetLines, receipts] = await Promise.all([
    listPurchaseOrders(prisma, {
      organizationId: access.organization.id,
      projectId: access.project.id,
    }),
    listSuppliers(prisma, { organizationId: access.organization.id, active: true }),
    prisma.budgetLine.findMany({
      where: { projectId: access.project.id },
      select: { id: true, costCode: true, description: true },
      orderBy: { costCode: "asc" },
      take: 500,
    }),
    prisma.goodsReceipt.findMany({
      where: { projectId: access.project.id, status: "POSTED" },
      include: { lines: true },
      orderBy: { receivedAt: "desc" },
      take: 500,
    }),
  ]);

  return (
    <PurchasesClient
      initialOrders={data.purchaseOrders}
      initialReceipts={receipts.map(serializeGoodsReceipt)}
      suppliers={supplierData.suppliers}
      budgetLines={budgetLines}
      projectName={access.project.name}
      canManage={hasTenantPermission(access, "org:execution:manage")}
    />
  );
}
