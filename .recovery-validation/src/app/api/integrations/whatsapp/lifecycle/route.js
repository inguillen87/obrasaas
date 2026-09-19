import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { inspectWhatsAppCredentialLifecycle } from '@/lib/whatsapp/credential-lifecycle';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff',
  Vary: 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project' };
const json = (body, status = 200) => Response.json(body, { status, headers });
export function createCredentialLifecycleHandler({ resolveAccess = getPlatformAccess, authorize = requireTenantPermission,
  database = getPrisma, inspect = inspectWhatsAppCredentialLifecycle, clock = () => new Date() } = {}) {
  return async function GET(request) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:integrations:manage', { subscriptionMode: 'read' });
      if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) {
        return json({ error: 'Recargá Integraciones para confirmar la empresa y la obra.', code: 'WHATSAPP_LIFECYCLE_CONTEXT_REQUIRED' }, 409);
      }
      assertEvidenceRequestContext(request, access);
      if (new URL(request.url).search) return json({ error: 'Esta consulta no admite otros destinos.', code: 'WHATSAPP_LIFECYCLE_QUERY_INVALID' }, 400);
      const context = { organizationId: access.organization.id, projectId: access.project.id };
      const connection = await database().whatsAppConnection.findFirst({
        where: { projectId: context.projectId, project: { organizationId: context.organizationId } },
        select: { enabled: true, connectionStatus: true, metadata: true },
      });
      return json({ context, credential: inspect(connection, { now: clock() }) });
    } catch (error) {
      const known = error instanceof AccessError ? accessErrorResponse(error) : evidenceContextErrorResponse(error);
      if (known) { Object.entries(headers).forEach(([key, value]) => known.headers.set(key, value)); return known; }
      return json({ error: 'No se pudo confirmar el estado de la autorización. Conservá tu preparación y volvé a consultar.', code: 'WHATSAPP_LIFECYCLE_UNAVAILABLE' }, 503);
    }
  };
}
export const GET = createCredentialLifecycleHandler();
