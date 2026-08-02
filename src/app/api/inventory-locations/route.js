import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  createInventoryLocation,
  InventoryLocationError,
  inventoryLocationErrorResponse,
  listInventoryLocations,
} from '@/lib/inventory-locations';
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

const MAX_INVENTORY_LOCATION_BODY_BYTES = 8 * 1024;

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
    || inventoryLocationErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

function includeInactiveFromRequest(request) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== 'active')
    || params.getAll('active').length > 1
  ) {
    throw new InventoryLocationError(
      'Los parámetros de ubicaciones son inválidos.',
      'INVENTORY_LOCATION_QUERY_INVALID',
      400,
    );
  }
  const active = params.get('active');
  if (active === null || active === 'true') return false;
  if (active === 'all') return true;
  throw new InventoryLocationError(
    'active admite únicamente true o all.',
    'INVENTORY_LOCATION_ACTIVE_FILTER_INVALID',
    400,
  );
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const result = await listInventoryLocations(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      includeInactive: includeInactiveFromRequest(request),
    });
    return respond(request, Response.json(result));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudieron cargar las ubicaciones.',
      code: 'INVENTORY_LOCATION_READ_FAILED',
    }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, {
      maxBytes: MAX_INVENTORY_LOCATION_BODY_BYTES,
    });
    const result = await createInventoryLocation(getPrisma(), {
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
      error: 'No se pudo crear la ubicación.',
      code: 'INVENTORY_LOCATION_CREATE_FAILED',
    }, { status: 500 }));
  }
}
