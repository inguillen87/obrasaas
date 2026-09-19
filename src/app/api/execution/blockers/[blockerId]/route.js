import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { ProjectWritePolicyError, projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { getProjectBlocker, projectExecutionErrorResponse, updateProjectBlocker } from '@/lib/project-execution';

const MAX_BYTES = 16 * 1024;

function response(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } });
}

export async function PATCH(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    assertEvidenceRequestContext(request, access);
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return response({ error: 'Origen no autorizado.' }, { status: 403 });
    const input = await readJsonRequest(request, { maxBytes: MAX_BYTES });
    const result = await updateProjectBlocker(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      blockerId: (await params).blockerId,
      expectedRevision: input?.expectedRevision,
      input,
    });
    return response({ blocker: result });
  } catch (error) {
    const mismatch = evidenceContextErrorResponse(error); if (mismatch) return mismatch;
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof ProjectWritePolicyError) return projectWritePolicyErrorResponse(error);
    return projectExecutionErrorResponse(error) || response({ error: 'No se pudo actualizar el blocker.', code: 'EXECUTION_BLOCKER_UPDATE_FAILED' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    assertEvidenceRequestContext(request, access);
    const blocker = await getProjectBlocker(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, blockerId: (await params).blockerId });
    return response({ blocker });
  } catch (error) {
    const mismatch = evidenceContextErrorResponse(error); if (mismatch) return mismatch;
    if (error instanceof AccessError) return accessErrorResponse(error);
    return projectExecutionErrorResponse(error) || response({ error: 'No se pudo consultar la restricción.' }, { status: 503 });
  }
}
