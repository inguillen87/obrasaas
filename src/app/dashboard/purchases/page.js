import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listPurchaseOrders } from '@/lib/purchase-orders';
import styles from '../extra-work/extra-work.module.css';
import { listSuppliers } from '@/lib/suppliers';
import PurchasesClient from './purchases-client';
import ReceiptClient from './receipt-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compras', description: 'Ã“rdenes y recepciÃ³n de materiales.' };

export default async function PurchasesPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const [data, supplierData, budgetLines, receipts] = await Promise.all([listPurchaseOrders(prisma, { organizationId: access.organization.id, projectId: access.project.id }), listSuppliers(prisma, { organizationId: access.organization.id, active: true }), prisma.budgetLine.findMany({ where: { projectId: access.project.id }, select: { id: true, costCode: true, description: true }, orderBy: { costCode: 'asc' }, take: 500 }), prisma.goodsReceipt.findMany({ where: { projectId: access.project.id, status: 'POSTED' }, select: { purchaseOrderId: true, lines: { select: { quantity: true } } } })]); const receiptSummary = Object.groupBy ? Object.groupBy(receipts, (row) => row.purchaseOrderId) : receipts.reduce((map, row) => { (map[row.purchaseOrderId] ||= []).push(row); return map; }, {}); return <><PurchasesClient initialOrders={data.purchaseOrders} receiptSummary={receiptSummary} suppliers={supplierData.suppliers} budgetLines={budgetLines} projectName={access.project.name} /><ReceiptClient orders={data.purchaseOrders} /></>; }

