import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
function csv(value) { const text = value === null || value === undefined ? '' : String(value); return `"${text.replaceAll('"', '""')}"`; }
const STATUSES = new Set(['RECEIVED', 'APPROVED', 'PAID', 'VOIDED']);
export async function GET(request) {
  try {
    const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const status = new URL(request.url).searchParams.get('status');
    if (status && !STATUSES.has(status)) return Response.json({ error: 'Estado de factura inválido.', code: 'SUPPLIER_INVOICE_STATUS_INVALID' }, { status: 400 });
    const rows = await getPrisma().supplierInvoice.findMany({ where: { organizationId: access.organization.id, projectId: access.project.id, ...(status ? { status } : {}) }, include: { supplier: { select: { legalName: true, taxId: true } }, purchaseOrder: { select: { number: true } } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], take: 5000 });
    const header = ['invoice_id', 'invoice_number', 'supplier', 'supplier_tax_id', 'purchase_order', 'currency', 'amount', 'status', 'due_at', 'created_at'];
    const body = rows.map((row) => [row.id, row.invoiceNumber, row.supplier.legalName, row.supplier.taxId, row.purchaseOrder?.number, row.currency, row.amount.toString(), row.status, row.dueAt?.toISOString(), row.createdAt.toISOString()].map(csv).join(',')).join('\n');
    return new Response(`${header.join(',')}\n${body}\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="supplier-invoices-${access.project.id}.csv"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return (error instanceof AccessError && accessErrorResponse(error)) || Response.json({ error: 'No se pudo exportar cuentas por pagar.', code: 'SUPPLIER_INVOICE_EXPORT_FAILED' }, { status: 500 }); }
}
