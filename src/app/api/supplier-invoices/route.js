import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { resolveRequestCorrelationId, withCorrelationId } from '@/lib/request-correlation';
import { createSupplierInvoice, decideSupplierInvoice, listSupplierInvoices, supplierInvoiceErrorResponse } from '@/lib/supplier-invoices';

function respond(request, response) { return withCorrelationId(response, resolveRequestCorrelationId(request)); }
function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  const domain = supplierInvoiceErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

export async function GET(request) {
  try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); return respond(request, Response.json(await listSupplierInvoices(getPrisma(), { organizationId: access.organization.id, projectId: access.project.id, status: new URL(request.url).searchParams.get('status') || undefined }), { headers: { 'Cache-Control': 'private, no-store' } })); }
  catch (error) { return known(request, error) || respond(request, Response.json({ error: 'No se pudieron cargar facturas.', code: 'SUPPLIER_INVOICE_READ_FAILED' }, { status: 500 })); }
}

export async function PATCH(request) {
  try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' }); const input = await readJsonRequest(request, { maxBytes: 16 * 1024 }); return respond(request, Response.json(await decideSupplierInvoice(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, id: input.id, expectedRevision: input.expectedRevision, status: input.status }))); }
  catch (error) { return known(request, error) || respond(request, Response.json({ error: 'No se pudo decidir factura.', code: 'SUPPLIER_INVOICE_DECISION_FAILED' }, { status: 500 })); }
}

export async function POST(request) {
  try { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' }); const input = await readJsonRequest(request, { maxBytes: 32 * 1024 }); return respond(request, Response.json(await createSupplierInvoice(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, input }), { status: 201 })); }
  catch (error) { return known(request, error) || respond(request, Response.json({ error: 'No se pudo registrar factura.', code: 'SUPPLIER_INVOICE_CREATE_FAILED' }, { status: 500 })); }
}
