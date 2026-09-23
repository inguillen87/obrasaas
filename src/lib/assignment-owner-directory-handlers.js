import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { TaskAssignmentError, assignmentFailure } from '@/lib/task-assignment-policy';
import { normalizeOwnerSearch } from '@/lib/assignment-owner-directory-policy';
import { listAssignmentOwners } from '@/lib/assignment-owner-directory';

const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project', 'X-Content-Type-Options': 'nosniff' };
export function createOwnerDirectoryHandlers({ resolveAccess = getPlatformAccess, authorize = requireTenantPermission, database = getPrisma, search = listAssignmentOwners } = {}) {
  return {
    async GET(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:execution:read', { subscriptionMode: 'read' });
        authorize(access, 'org:tasks:read', { subscriptionMode: 'read' });
        if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) throw new TaskAssignmentError('Actualizá el contexto de empresa y obra.', 'ASSIGNMENT_CONTEXT_REQUIRED', 409);
        assertEvidenceRequestContext(request, access);
        const url = new URL(request.url), params = url.searchParams;
        if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('origin') && request.headers.get('origin') !== url.origin) throw new TaskAssignmentError('Origen no autorizado.', 'ASSIGNMENT_ORIGIN', 403);
        for (const key of params.keys()) if (!['taskId', 'expectedTaskRevision', 'ownerKind', 'query', 'cursor'].includes(key) || params.getAll(key).length !== 1) throw new TaskAssignmentError('Consulta no admitida.', 'ASSIGNMENT_DIRECTORY_INVALID');
        const revision = params.get('expectedTaskRevision');
        if (!/^(0|[1-9]\d{0,15})$/.test(revision ?? '')) throw new TaskAssignmentError('La versión consultada es obligatoria.', 'ASSIGNMENT_DIRECTORY_INVALID');
        const input = normalizeOwnerSearch({ taskId: params.get('taskId'), expectedTaskRevision: Number(revision), ownerKind: params.get('ownerKind'), query: params.get('query') ?? '', cursor: params.get('cursor') });
        const scope = { organizationId: access.organization.id, projectId: access.project.id };
        return Response.json(await search(database(), { scope, input }), { headers });
      } catch (error) {
        const response = (error instanceof AccessError ? accessErrorResponse(error) : evidenceContextErrorResponse(error) || assignmentFailure(error))
          || Response.json({ error: 'No se pudo consultar el directorio. Volvé a buscar; no se modificó ninguna asignación.', code: 'ASSIGNMENT_DIRECTORY_UNAVAILABLE' }, { status: 503 });
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        return response;
      }
    },
  };
}
