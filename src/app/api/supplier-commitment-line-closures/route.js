import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
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
import {
  createSupplierCommitmentLineClosure,
  listSupplierCommitmentLineClosures,
  supplierCommitmentLineClosureErrorResponse,
} from '@/lib/supplier-commitment-line-closures';

const MAX_REQUEST_BYTES = 16 * 1024;
const CREATE_FIELDS = new Set([
  'supplierCommitmentId',
  'purchaseOrderLineId',
  'kind',
  'predecessorId',
  'reason',
]);
const QUERY_FIELDS = new Set([
  'purchaseOrderId',
  'supplierCommitmentId',
  'purchaseOrderLineId',
  'cursor',
  'limit',
]);

function respond(request, response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, resolveRequestCorrelationId(request));
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  if (error instanceof ScheduleApiError) return respond(request, scheduleApiErrorResponse(error));
  const domain = projectWritePolicyErrorResponse(error)
    || supplierCommitmentLineClosureErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    // This first slice intentionally uses the existing execution permission;
    // receiver/inspector segregation is a separate authorization hardening.
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const operationKey = requireScheduleIdempotencyKey(request);
    const input = assertScheduleObject(
      await readJsonRequest(request, { maxBytes: MAX_REQUEST_BYTES }),
      CREATE_FIELDS,
    );
    const result = await createSupplierCommitmentLineClosure(getPrisma(), {
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
      error: 'No se pudo registrar el cierre de la línea comprometida.',
      code: 'SUPPLIER_COMMITMENT_LINE_CLOSURE_WRITE_FAILED',
    }, { status: 500 }));
  }
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const searchParams = new URL(request.url).searchParams;
    assertScheduleSearchParams(searchParams, QUERY_FIELDS);
    const result = await listSupplierCommitmentLineClosures(getPrisma(), {
      organizationId: access.organization.id,
      projectId: access.project.id,
      purchaseOrderId: scheduleQueryValue(searchParams, 'purchaseOrderId'),
      supplierCommitmentId: scheduleQueryValue(searchParams, 'supplierCommitmentId'),
      purchaseOrderLineId: scheduleQueryValue(searchParams, 'purchaseOrderLineId'),
      cursor: scheduleQueryValue(searchParams, 'cursor'),
      limit: scheduleQueryValue(searchParams, 'limit'),
    });
    return respond(request, Response.json(result));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudieron cargar los cierres de entregas.',
      code: 'SUPPLIER_COMMITMENT_LINE_CLOSURE_READ_FAILED',
    }, { status: 500 }));
  }
}
