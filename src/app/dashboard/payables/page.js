import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listSupplierInvoices } from '@/lib/supplier-invoices';
import { listSuppliers } from '@/lib/suppliers';
import { listPurchaseOrders } from '@/lib/purchase-orders';
import PayablesClient from './payables-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cuentas por pagar', description: 'Facturas y vencimientos de proveedores.' };
export default async function PayablesPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const [invoices, suppliers, orders] = await Promise.all([listSupplierInvoices(prisma, { organizationId: access.organization.id, projectId: access.project.id }), listSuppliers(prisma, { organizationId: access.organization.id, active: true }), listPurchaseOrders(prisma, { organizationId: access.organization.id, projectId: access.project.id })]); return <PayablesClient initialInvoices={invoices.invoices} suppliers={suppliers.suppliers} purchaseOrders={orders.purchaseOrders.filter((order) => !['CANCELLED', 'RECEIVED'].includes(order.status))} projectName={access.project.name} />; }
