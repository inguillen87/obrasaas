import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { canonicalTaskErrorResponse, createCanonicalTaskDependency } from '@/lib/canonical-tasks';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';

const MAX_JSON_BYTES = 8 * 1024;

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:tasks:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: MAX_JSON_BYTES });
    const dependency = await createCanonicalTaskDependency(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId,
      predecessorId: input?.predecessorId,
      successorId: input?.successorId,
      type: input?.type,
      lagDays: input?.lagDays,
    });
    return Response.json({ dependency }, { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    const policyResponse = projectWritePolicyErrorResponse(error);
    if (policyResponse) return policyResponse;
    return canonicalTaskErrorResponse(error) || Response.json({ error: 'No se pudo crear la dependencia.', code: 'CANONICAL_TASK_DEPENDENCY_FAILED' }, { status: 500, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
