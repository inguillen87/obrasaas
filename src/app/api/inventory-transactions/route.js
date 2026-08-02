import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  createInventoryTransaction,
  getReceiptPutawayStatus,
  inventoryTransactionErrorResponse,
  InventoryTransactionError,
} from '@/lib/inventory-transactions';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';

export const runtime = 'nodejs';

const MAX_INVENTORY_TRANSACTION_BODY_BYTES = 128 * 1024;

function respond(request, response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }), resolveRequestCorrelationId(request));
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  const domain = projectWritePolicyErrorResponse(error)
    || inventoryTransactionErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

function sourceInspectionIdFromRequest(request) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== 'sourceInspectionId')
    || params.getAll('sourceInspectionId').length !== 1
  ) {
    throw new InventoryTransactionError(
      'La consulta requiere exactamente un sourceInspectionId.',
      'INVENTORY_TRANSACTION_QUERY_INVALID',
      400,
    );
  }
  return params.get('sourceInspectionId');
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:inventory:read', { subscriptionMode: 'read' });
    const result = await getReceiptPutawayStatus(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      sourceInspectionId: sourceInspectionIdFromRequest(request),
    });
    return respond(request, Response.json(result));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudo cargar el estado de ingreso a stock.',
      code: 'INVENTORY_TRANSACTION_READ_FAILED',
    }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:inventory:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, {
      maxBytes: MAX_INVENTORY_TRANSACTION_BODY_BYTES,
    });
    const result = await createInventoryTransaction(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      actorId: access.databaseUserId,
      operationKey: request.headers.get('Idempotency-Key'),
      input,
    });
    return respond(request, Response.json(result, {
      status: result.replayed ? 200 : 201,
    }));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudo registrar el movimiento de inventario.',
      code: 'INVENTORY_TRANSACTION_WRITE_FAILED',
    }, { status: 500 }));
  }
}
