import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { readJsonRequest, RequestBodyError, requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { projectExecutionErrorResponse } from '@/lib/project-execution';
import { reportIdentifier, messageReportErrorResponse } from '@/lib/whatsapp/progress-report-policy';
import { messageBlockerErrorResponse, WhatsAppMessageBlockerError } from '@/lib/whatsapp/message-blocker-policy';
import { prepareWhatsAppMessageBlocker, createWhatsAppMessageBlocker } from '@/lib/whatsapp/message-blocker';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project' };
export function createMessageBlockerHandlers({ resolveAccess = getPlatformAccess, authorize = requireTenantPermission, database = getPrisma, prepare = prepareWhatsAppMessageBlocker, create = createWhatsAppMessageBlocker } = {}) {
  async function run(request, params, write) {
    try {
      const access = await resolveAccess();
      for (const permission of ['org:conversations:read', 'org:execution:manage', 'org:tasks:read', SOURCE_EVIDENCE_PERMISSION]) authorize(access, permission, { subscriptionMode: write ? 'write' : 'read' });
      if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) throw new WhatsAppMessageBlockerError('Verificá la empresa y obra abiertas.', 'WHATSAPP_BLOCKER_CONTEXT_REQUIRED', 409);
      assertEvidenceRequestContext(request, access);
      const url = new URL(request.url), origin = request.headers.get('origin');
      if (url.search) throw new WhatsAppMessageBlockerError('La consulta no admite parámetros adicionales.', 'WHATSAPP_BLOCKER_REQUEST_INVALID', 400);
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new WhatsAppMessageBlockerError('Origen no autorizado.', 'WHATSAPP_BLOCKER_ORIGIN', 403);
      const selected = await params;
      const context = { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, conversationId: reportIdentifier(selected.conversationId), messageId: reportIdentifier(selected.messageId) };
      const input = write ? await readJsonRequest(request, { maxBytes: 24 * 1024 }) : null;
      const result = write ? await create(database(), { ...context, input, operationKey: request.headers.get('idempotency-key') }) : await prepare(database(), context);
      return Response.json(result, { status: write && !result.replayed ? 201 : 200, headers });
    } catch (error) {
      const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error)
        : evidenceContextErrorResponse(error) || messageBlockerErrorResponse(error) || messageReportErrorResponse(error) || projectExecutionErrorResponse(error) || projectWritePolicyErrorResponse(error);
      if (known) { Object.entries(headers).forEach(([key,value]) => known.headers.set(key,value)); return known; }
      return Response.json({ error: 'No se confirmó la restricción. Conservá los datos y verificá el mismo intento.', code: 'WHATSAPP_BLOCKER_UNCONFIRMED' }, { status: 503, headers });
    }
  }
  return { GET: (request, { params }) => run(request, params, false), POST: (request, { params }) => run(request, params, true) };
}
export const { GET, POST } = createMessageBlockerHandlers();
