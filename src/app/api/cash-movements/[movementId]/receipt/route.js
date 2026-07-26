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
    const { movementId } = await params;
    const row = await getPrisma().cashMovement.findFirst({ where: { id: movementId, projectId: access.project.id }, select: { receipt: true } });
    if (!row) return json({ error: 'Movimiento no encontrado.', code: 'CASH_MOVEMENT_NOT_FOUND' }, 404);
    if (!isPrivateReceiptForProject(row.receipt, access.project.id, 'cash')) return json({ error: 'El movimiento no tiene un comprobante válido.', code: 'CASH_RECEIPT_NOT_FOUND' }, 404);
    const downloaded = await readProtectedFile(row.receipt.storage);
    if (!downloaded) return json({ error: 'El comprobante ya no está disponible.', code: 'CASH_RECEIPT_NOT_FOUND' }, 404);
    return privateReceiptFileResponse(row.receipt, downloaded);
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    return json({ error: 'No se pudo entregar el comprobante privado.', code: 'CASH_RECEIPT_DOWNLOAD_FAILED' }, 500);
  }
}
