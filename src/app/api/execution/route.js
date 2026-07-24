import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { ProjectWritePolicyError, projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { createExecutionRecord, listProjectExecution, projectExecutionErrorResponse } from '@/lib/project-execution';

const MAX_BYTES = 16 * 1024;

function response(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } });
}

function knownError(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof ProjectWritePolicyError) return projectWritePolicyErrorResponse(error);
  return projectExecutionErrorResponse(error);
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    return response(await listProjectExecution(getPrisma(), { projectId: access.project.id }));
  } catch (error) {
    return knownError(error) || response({ error: 'No se pudo cargar la ejecución de la obra.', code: 'EXECUTION_READ_FAILED' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: MAX_BYTES });
    const result = await createExecutionRecord(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      input,
    });
    return response(result, { status: 201 });
  } catch (error) {
    return knownError(error) || response({ error: 'No se pudo guardar la ejecución de la obra.', code: 'EXECUTION_WRITE_FAILED' }, { status: 500 });
  }
}
