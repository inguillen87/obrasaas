import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { JournalTaskLinkError, journalTaskLinkErrorResponse } from '@/lib/journal-task-link-policy';
import { linkJournalDraftToTask } from '@/lib/journal-task-link';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
export async function PATCH(request, { params }) {
  try {
    const url = new URL(request.url), origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new JournalTaskLinkError('Origen no autorizado.', 'JOURNAL_TASK_LINK_ORIGIN', 403);
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    requireTenantPermission(access, 'org:tasks:read', { subscriptionMode: 'read' });
    if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) throw new JournalTaskLinkError('Verificá la obra activa antes de vincular.', 'JOURNAL_TASK_LINK_CONTEXT_REQUIRED', 409);
    assertEvidenceRequestContext(request, access);
    if (url.search) throw new JournalTaskLinkError('La vinculación no admite parámetros de consulta.');
    const input = await readJsonRequest(request, { maxBytes: 4096 });
    const result = await linkJournalDraftToTask(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, recordId: (await params).recordId, operationKey: request.headers.get('idempotency-key'), input });
    return Response.json(result, { headers });
  } catch (error) {
    const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error) : evidenceContextErrorResponse(error) || journalTaskLinkErrorResponse(error) || projectWritePolicyErrorResponse(error);
    if (known) { Object.entries(headers).forEach(([key, value]) => known.headers.set(key, value)); return known; }
    return Response.json({ error: 'No se confirmó la vinculación. Reintentá la misma solicitud, sin crear otra.', code: 'JOURNAL_TASK_LINK_UNCONFIRMED' }, { status: 503, headers });
  }
}
