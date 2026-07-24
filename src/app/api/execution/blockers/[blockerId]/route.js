import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { ProjectWritePolicyError, projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { projectExecutionErrorResponse, updateProjectBlocker } from '@/lib/project-execution';

const MAX_BYTES = 16 * 1024;

function response(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } });
}

export async function PATCH(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
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
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof ProjectWritePolicyError) return projectWritePolicyErrorResponse(error);
    return projectExecutionErrorResponse(error) || response({ error: 'No se pudo actualizar el blocker.', code: 'EXECUTION_BLOCKER_UPDATE_FAILED' }, { status: 500 });
  }
}
