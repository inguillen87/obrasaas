import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { isPrivateReceiptForProject, privateReceiptFileResponse } from '@/lib/private-receipts';
import { getPrisma } from '@/lib/prisma';
import { readProtectedFile } from '@/lib/storage';

export const runtime = 'nodejs';

function json(payload, status) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const { invoiceId } = await params;
    const row = await getPrisma().supplierInvoice.findFirst({ where: { id: invoiceId, organizationId: access.organization.id, projectId: access.project.id }, select: { receipt: true } });
    if (!row) return json({ error: 'Factura no encontrada.', code: 'SUPPLIER_INVOICE_NOT_FOUND' }, 404);
    if (!isPrivateReceiptForProject(row.receipt, access.project.id, 'supplier')) return json({ error: 'La factura no tiene evidencia válida.', code: 'SUPPLIER_INVOICE_MEDIA_NOT_FOUND' }, 404);
    const downloaded = await readProtectedFile(row.receipt.storage);
    if (!downloaded) return json({ error: 'La evidencia ya no está disponible.', code: 'SUPPLIER_INVOICE_MEDIA_NOT_FOUND' }, 404);
    return privateReceiptFileResponse(row.receipt, downloaded);
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    return json({ error: 'No se pudo entregar la evidencia privada.', code: 'SUPPLIER_INVOICE_MEDIA_FAILED' }, 500);
  }
}
