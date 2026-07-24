import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { supplierInvoiceErrorResponse, supplierInvoiceMatch } from '@/lib/supplier-invoices';
export async function GET(request, { params }) {
  try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const { invoiceId } = await params; return Response.json(await supplierInvoiceMatch(getPrisma(), { organizationId: access.organization.id, projectId: access.project.id, invoiceId }), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return (error instanceof AccessError && accessErrorResponse(error)) || supplierInvoiceErrorResponse(error) || Response.json({ error: 'No se pudo calcular el match.', code: 'SUPPLIER_INVOICE_MATCH_FAILED' }, { status: 500 }); }
}
