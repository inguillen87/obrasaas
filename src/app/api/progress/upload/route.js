import { createHash } from 'node:crypto';
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { deleteProtectedFile, uploadProtectedFile } from '@/lib/cloudinary';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']);

function errorResponse(error) { if (error instanceof AccessError) return accessErrorResponse(error); return Response.json({ error: error.message || 'No se pudo cargar el archivo.', code: 'PROGRESS_UPLOAD_FAILED' }, { status: error.status || 500 }); }

export async function POST(request) {
  try {
    const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_BYTES) return Response.json({ error: 'El archivo debe pesar entre 1 byte y 20 MB.', code: 'PROGRESS_FILE_SIZE_INVALID' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return Response.json({ error: 'Tipo de archivo no permitido.', code: 'PROGRESS_FILE_TYPE_INVALID' }, { status: 400 });
    const digest = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
    const upload = await uploadProtectedFile(file, { folder: `obrasaas/projects/${access.project.id}/progress`, context: `project=${access.project.id}|sha256=${digest}`, idempotencyKey: `progress:${access.project.id}:${digest}`, resourceType: file.type === 'application/pdf' ? 'raw' : file.type.startsWith('video/') ? 'video' : 'image' });
    return Response.json({ media: { provider: 'cloudinary', storage: { provider: 'cloudinary', assetId: upload.assetId || null, publicId: upload.publicId || null, resourceType: upload.resourceType || null, format: upload.format || null, bytes: upload.bytes || file.size }, mimeType: file.type, filename: file.name, size: file.size, sha256: digest } }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request) {
  try {
    const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const body = await request.json().catch(() => null); const storage = body?.media?.storage;
    if (!storage || storage.provider !== 'cloudinary' || typeof storage.publicId !== 'string' || !storage.publicId.trim()) return Response.json({ error: 'Identidad de media inválida.', code: 'PROGRESS_MEDIA_ID_INVALID' }, { status: 400 });
    await deleteProtectedFile(storage);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
