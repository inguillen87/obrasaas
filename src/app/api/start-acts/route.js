import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listProjectStartActs, WorkerDocumentError } from '@/lib/worker-documents';

function known(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof WorkerDocumentError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  return null;
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const params = new URL(request.url).searchParams;
    const status = params.get('status') || undefined;
    const limit = params.get('limit') || undefined;
    return Response.json(await listProjectStartActs(getPrisma(), { projectId: access.project.id, status, limit }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return known(error) || Response.json({ error: 'No se pudieron cargar las actas de inicio.', code: 'START_ACT_READ_FAILED' }, { status: 500 });
  }
}
