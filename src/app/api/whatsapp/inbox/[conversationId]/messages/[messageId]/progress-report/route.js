import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { prepareWhatsAppProgressReport, createWhatsAppProgressReport } from '@/lib/whatsapp/progress-report';
import { WhatsAppProgressReportError, messageReportErrorResponse } from '@/lib/whatsapp/progress-report-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project', 'X-Content-Type-Options': 'nosniff' };
export function createMessageReportHandlers({ resolveAccess = getPlatformAccess, authorize = requireTenantPermission, database = getPrisma, prepare = prepareWhatsAppProgressReport, create = createWhatsAppProgressReport, parse = readJsonRequest } = {}) {
  async function handle(request, context, write) {
    try {
      if (new URL(request.url).search) throw new WhatsAppProgressReportError('Esta operación no admite parámetros de consulta.');
      const origin = request.headers.get('origin');
      if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new WhatsAppProgressReportError('Origen no autorizado.', 'WHATSAPP_REPORT_ORIGIN', 403);
      const access = await resolveAccess();
      if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) throw new WhatsAppProgressReportError('Falta el contexto de la pantalla.', 'WHATSAPP_REPORT_CONTEXT', 409);
      assertEvidenceRequestContext(request, access);
      for (const permission of ['org:conversations:read', SOURCE_EVIDENCE_PERMISSION, 'org:execution:manage', 'org:tasks:read']) authorize(access, permission, { subscriptionMode: write ? 'write' : 'read' });
      const { conversationId, messageId } = await context.params;
      const input = { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId, conversationId, messageId };
      const result = write ? await create(database(), { ...input, input: await parse(request, { maxBytes: 16 * 1024 }), operationKey: request.headers.get('idempotency-key') }) : await prepare(database(), input);
      return Response.json(result, { status: write && !result.replayed ? 201 : 200, headers });
    } catch (error) {
      const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error) : evidenceContextErrorResponse(error) || messageReportErrorResponse(error) || projectWritePolicyErrorResponse(error);
      if (known) { for (const [key, value] of Object.entries(headers)) known.headers.set(key, value); return known; }
      return Response.json({ error: 'No se confirmó la operación del parte. Conservá los datos y verificá el mismo intento.', code: 'WHATSAPP_REPORT_UNAVAILABLE' }, { status: 503, headers });
    }
  }
  return { GET: (request, context) => handle(request, context, false), POST: (request, context) => handle(request, context, true) };
}
export const { GET, POST } = createMessageReportHandlers();
