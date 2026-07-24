import { createHash } from 'node:crypto';
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { uploadProtectedFile } from '@/lib/cloudinary';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES) return Response.json({ error: 'El comprobante debe pesar entre 1 byte y 10 MB.', code: 'SUPPLIER_INVOICE_SIZE_INVALID' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return Response.json({ error: 'Tipo de comprobante no permitido.', code: 'SUPPLIER_INVOICE_TYPE_INVALID' }, { status: 400 });
    const sha256 = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
    const upload = await uploadProtectedFile(file, { folder: `obrasaas/projects/${access.project.id}/supplier-invoices`, context: `project=${access.project.id}|sha256=${sha256}|private=true`, idempotencyKey: `supplier-invoice:${access.project.id}:${sha256}`, resourceType: file.type === 'application/pdf' ? 'raw' : 'image' });
    return Response.json({ receipt: { provider: 'cloudinary', storage: { provider: 'cloudinary', assetId: upload.assetId || null, publicId: upload.publicId || null, resourceType: upload.resourceType || null, format: upload.format || null, bytes: upload.bytes || file.size }, mimeType: file.type, filename: file.name, size: file.size, sha256, visibility: 'private' } }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return (error instanceof AccessError && accessErrorResponse(error)) || Response.json({ error: error.message || 'No se pudo cargar evidencia.', code: 'SUPPLIER_INVOICE_EVIDENCE_FAILED' }, { status: error.status || 500 }); }
}
