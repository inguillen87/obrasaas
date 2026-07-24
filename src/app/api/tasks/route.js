import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import {
  canonicalTaskErrorResponse,
  createCanonicalTask,
  listCanonicalTasks,
} from '@/lib/canonical-tasks';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';

const MAX_JSON_BYTES = 16 * 1024;

function response(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } });
}

function errorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  const policyResponse = projectWritePolicyErrorResponse(error);
  if (policyResponse) return policyResponse;
  return canonicalTaskErrorResponse(error) || response({ error: 'No se pudo completar la operación.', code: 'CANONICAL_TASK_FAILED' }, { status: 500 });
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:tasks:read', { subscriptionMode: 'read' });
    const url = new URL(request.url);
    const result = await listCanonicalTasks(getPrisma(), {
      projectId: access.project.id,
      cursor: url.searchParams.get('cursor'),
      limit: url.searchParams.get('limit') || 100,
    });
    return response(result);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:tasks:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: MAX_JSON_BYTES });
    const task = await createCanonicalTask(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      input,
    });
    return response({ task }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
