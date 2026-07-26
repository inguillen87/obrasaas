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
    const { receiptId } = await params;
    const row = await getPrisma().goodsReceipt.findFirst({ where: { id: receiptId, projectId: access.project.id }, select: { receipt: true } });
    if (!row) return json({ error: 'Recepción no encontrada.', code: 'GOODS_RECEIPT_NOT_FOUND' }, 404);
    if (!isPrivateReceiptForProject(row.receipt, access.project.id, 'goods')) return json({ error: 'La recepción no tiene evidencia válida.', code: 'GOODS_RECEIPT_MEDIA_NOT_FOUND' }, 404);
    const downloaded = await readProtectedFile(row.receipt.storage);
    if (!downloaded) return json({ error: 'La evidencia ya no está disponible.', code: 'GOODS_RECEIPT_MEDIA_NOT_FOUND' }, 404);
    return privateReceiptFileResponse(row.receipt, downloaded);
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    return json({ error: 'No se pudo entregar la evidencia privada.', code: 'GOODS_RECEIPT_MEDIA_FAILED' }, 500);
  }
}
