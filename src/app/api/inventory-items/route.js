import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  createInventoryItem,
  InventoryItemError,
  inventoryItemErrorResponse,
  listInventoryItems,
  parseInventoryItemListQuery,
} from '@/lib/inventory-items';
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

const MAX_INVENTORY_ITEM_BODY_BYTES = 8 * 1024;

function respond(request, response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
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
    || inventoryItemErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

export function createInventoryItemsGetHandler({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  listItems = listInventoryItems,
} = {}) {
  return async function inventoryItemsGet(request) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:inventory:read', { subscriptionMode: 'read' });
      const query = parseInventoryItemListQuery(request.url, {
        organizationId: access.organization.id,
        projectId: access.project.id,
      });
      const result = await listItems(prismaFactory(), query);
      return respond(request, Response.json(result));
    } catch (error) {
      return known(request, error) || respond(request, Response.json({
        error: 'No se pudo cargar el catálogo de materiales.',
        code: 'INVENTORY_ITEM_READ_FAILED',
      }, { status: 500 }));
    }
  };
}

const defaultGetHandler = createInventoryItemsGetHandler();

export async function GET(request) {
  return defaultGetHandler(request);
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:inventory:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, {
      maxBytes: MAX_INVENTORY_ITEM_BODY_BYTES,
    });
    const result = await createInventoryItem(getPrisma(), {
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
      error: 'No se pudo crear el material.',
      code: 'INVENTORY_ITEM_CREATE_FAILED',
    }, { status: 500 }));
  }
}
