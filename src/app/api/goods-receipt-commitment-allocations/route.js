import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  createGoodsReceiptCommitmentAllocation,
  goodsReceiptCommitmentAllocationErrorResponse,
  listGoodsReceiptCommitmentAllocations,
} from '@/lib/goods-receipt-commitment-allocations';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { resolveRequestCorrelationId, withCorrelationId } from '@/lib/request-correlation';
import {
  ScheduleApiError,
  assertScheduleObject,
  assertScheduleSearchParams,
  requireScheduleIdempotencyKey,
  scheduleApiErrorResponse,
  scheduleQueryValue,
} from '@/lib/schedule-api';

const MAX_REQUEST_BYTES = 16 * 1024;
const CREATE_FIELDS = new Set([
  'goodsReceiptLineId',
  'supplierCommitmentId',
  'quantity',
]);
const QUERY_FIELDS = new Set(['purchaseOrderId', 'cursor', 'limit']);

function respond(request, response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, resolveRequestCorrelationId(request));
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  if (error instanceof ScheduleApiError) return respond(request, scheduleApiErrorResponse(error));
  const domain = projectWritePolicyErrorResponse(error)
    || goodsReceiptCommitmentAllocationErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const operationKey = requireScheduleIdempotencyKey(request);
    const input = assertScheduleObject(
      await readJsonRequest(request, { maxBytes: MAX_REQUEST_BYTES }),
      CREATE_FIELDS,
    );
    const result = await createGoodsReceiptCommitmentAllocation(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      actorId: access.databaseUserId,
      operationKey,
      input,
    });
    return respond(request, Response.json(result, {
      status: result.replayed ? 200 : 201,
    }));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudo asignar la recepción al compromiso.',
      code: 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_WRITE_FAILED',
    }, { status: 500 }));
  }
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const searchParams = new URL(request.url).searchParams;
    assertScheduleSearchParams(searchParams, QUERY_FIELDS);
    const result = await listGoodsReceiptCommitmentAllocations(getPrisma(), {
      organizationId: access.organization.id,
      projectId: access.project.id,
      purchaseOrderId: scheduleQueryValue(searchParams, 'purchaseOrderId'),
      cursor: scheduleQueryValue(searchParams, 'cursor'),
      limit: scheduleQueryValue(searchParams, 'limit'),
    });
    return respond(request, Response.json(result));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudieron cargar las asignaciones de recepciones.',
      code: 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_READ_FAILED',
    }, { status: 500 }));
  }
}
