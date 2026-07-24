import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { canonicalTaskErrorResponse, deleteCanonicalTask, updateCanonicalTask } from '@/lib/canonical-tasks';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';

const MAX_JSON_BYTES = 16 * 1024;

function response(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } });
}

export async function PATCH(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:tasks:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: MAX_JSON_BYTES });
    const task = await updateCanonicalTask(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      taskId: (await params).taskId,
      expectedRevision: input?.expectedRevision,
      input,
    });
    return response({ task });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    const policyResponse = projectWritePolicyErrorResponse(error);
    if (policyResponse) return policyResponse;
    return canonicalTaskErrorResponse(error) || response({ error: 'No se pudo actualizar la tarea.', code: 'CANONICAL_TASK_UPDATE_FAILED' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:tasks:manage', { subscriptionMode: 'write' });
    const task = await deleteCanonicalTask(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      taskId: (await params).taskId,
    });
    return response(task);
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    const policyResponse = projectWritePolicyErrorResponse(error);
    if (policyResponse) return policyResponse;
    return canonicalTaskErrorResponse(error) || response({ error: 'No se pudo eliminar la tarea.', code: 'CANONICAL_TASK_DELETE_FAILED' }, { status: 500 });
  }
}
