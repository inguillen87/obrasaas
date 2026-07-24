import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { cloudinaryPrivateDownloadUrl } from '@/lib/cloudinary';
import { getPrisma } from '@/lib/prisma';
export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const { invoiceId } = await params;
    const row = await getPrisma().supplierInvoice.findFirst({ where: { id: invoiceId, organizationId: access.organization.id, projectId: access.project.id }, select: { receipt: true } });
    if (!row) return Response.json({ error: 'Factura no encontrada.', code: 'SUPPLIER_INVOICE_NOT_FOUND' }, { status: 404 });
    const media = row.receipt;
    if (!media || media.visibility !== 'private' || media.provider !== 'cloudinary' || !media.storage?.publicId || !media.storage?.format) return Response.json({ error: 'La factura no tiene evidencia válida.', code: 'SUPPLIER_INVOICE_MEDIA_NOT_FOUND' }, { status: 404 });
    return Response.json({ url: cloudinaryPrivateDownloadUrl(media.storage), expiresInSeconds: 60 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return (error instanceof AccessError && accessErrorResponse(error)) || Response.json({ error: 'No se pudo autorizar la evidencia.', code: 'SUPPLIER_INVOICE_MEDIA_FAILED' }, { status: 500 }); }
}
