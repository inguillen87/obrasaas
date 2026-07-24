import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listWorkerDocuments, WorkerDocumentError } from '@/lib/worker-documents';

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
    return Response.json(await listWorkerDocuments(getPrisma(), { projectId: access.project.id, workerId: params.get('workerId') || undefined, status: params.get('status') || undefined, limit: params.get('limit') || undefined }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return known(error) || Response.json({ error: 'No se pudieron cargar los documentos laborales.', code: 'WORKER_DOCUMENT_READ_FAILED' }, { status: 500 });
  }
}
