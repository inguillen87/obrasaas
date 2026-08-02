import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { resolveRequestCorrelationId, withCorrelationId } from '@/lib/request-correlation';
import {
  ScheduleApiError,
  assertScheduleObject,
  requireScheduleIdempotencyKey,
  scheduleApiErrorResponse,
} from '@/lib/schedule-api';
import {
  supplierCommitmentErrorResponse,
  updateSupplierCommitment,
} from '@/lib/supplier-commitments';

const UPDATE_FIELDS = new Set(['action', 'expectedRevision', 'reason', 'startsOn', 'endsOn']);

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

export async function PATCH(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const operationKey = requireScheduleIdempotencyKey(request);
    const input = assertScheduleObject(
      await readJsonRequest(request, { maxBytes: 16 * 1024 }),
      UPDATE_FIELDS,
    );
    const { commitmentId } = await params;
    return respond(request, Response.json(await updateSupplierCommitment(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      commitmentId,
      input: { ...input, operationKey },
    })));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudo actualizar el compromiso del proveedor.',
      code: 'SUPPLIER_COMMITMENT_WRITE_FAILED',
    }, { status: 500 }));
  }
}
