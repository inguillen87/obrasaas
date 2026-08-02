import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
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
  createSupplierCommitment,
  listSupplierCommitments,
  supplierCommitmentErrorResponse,
} from '@/lib/supplier-commitments';

const CREATE_FIELDS = new Set([
  'supplierId',
  'purchaseOrderId',
  'kind',
  'status',
  'title',
  'notes',
  'startsOn',
  'endsOn',
  'reminderEnabled',
  'reminderEmailConfirmed',
  'reminderDaysBefore',
  'taskLinks',
  'lines',
]);
const QUERY_FIELDS = new Set(['from', 'to', 'status', 'taskId']);

function respond(request, response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, resolveRequestCorrelationId(request));
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof RequestBodyError) return respond(request, requestBodyErrorResponse(error));
  if (error instanceof ScheduleApiError) return respond(request, scheduleApiErrorResponse(error));
  const domain = projectWritePolicyErrorResponse(error) || supplierCommitmentErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const searchParams = new URL(request.url).searchParams;
    assertScheduleSearchParams(searchParams, QUERY_FIELDS);
    return respond(request, Response.json(await listSupplierCommitments(getPrisma(), {
      organizationId: access.organization.id,
      projectId: access.project.id,
      from: scheduleQueryValue(searchParams, 'from'),
      to: scheduleQueryValue(searchParams, 'to'),
      status: scheduleQueryValue(searchParams, 'status'),
      taskId: scheduleQueryValue(searchParams, 'taskId'),
    })));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudieron cargar los compromisos del proveedor.',
      code: 'SUPPLIER_COMMITMENT_READ_FAILED',
    }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const operationKey = requireScheduleIdempotencyKey(request);
    const input = assertScheduleObject(
      await readJsonRequest(request, { maxBytes: 64 * 1024 }),
      CREATE_FIELDS,
    );
    const result = await createSupplierCommitment(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      input: { ...input, operationKey },
    });
    return respond(request, Response.json(result, { status: result.replayed ? 200 : 201 }));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudo crear el compromiso del proveedor.',
      code: 'SUPPLIER_COMMITMENT_WRITE_FAILED',
    }, { status: 500 }));
  }
}
