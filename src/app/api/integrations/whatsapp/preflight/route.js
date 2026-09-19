import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { readJsonRequest, RequestBodyError, requestBodyErrorResponse } from '@/lib/request-body';
import { verifyWhatsAppPlatform } from '@/lib/whatsapp/platform-preflight';
import { reserveMetaPreflight, recordMetaPreflight, MetaPreflightRateError } from '@/lib/whatsapp/platform-preflight-audit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
export async function POST(request) {
  try {
    const url = new URL(request.url), origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return reply({ error: 'Origen no autorizado.', code: 'PREFLIGHT_ORIGIN_DENIED' }, 403);
    const access = await getPlatformAccess();
    if (access.isSuperadmin !== true) return reply({ error: 'La configuración de la app requiere administración de plataforma.', code: 'PREFLIGHT_PLATFORM_ADMIN_REQUIRED' }, 403);
    requireTenantPermission(access, 'org:integrations:manage', { subscriptionMode: 'read' });
    if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) return reply({ error: 'Actualizá el contexto de esta pantalla.', code: 'PREFLIGHT_CONTEXT_REQUIRED' }, 409);
    assertEvidenceRequestContext(request, access);
    if (url.search) return reply({ error: 'No se admiten parámetros de consulta.', code: 'PREFLIGHT_INPUT_INVALID' }, 400);
    const body = await readJsonRequest(request, { maxBytes: 1024 });
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) return reply({ error: 'Esta verificación no recibe claves, cuentas ni URLs desde el navegador.', code: 'PREFLIGHT_INPUT_INVALID' }, 400);
    const context = { organizationId: access.organization.id, projectId: access.project.id, actorId: access.databaseUserId };
    const prisma = getPrisma(), reservation = await reserveMetaPreflight(prisma, context);
    const report = await verifyWhatsAppPlatform();
    await recordMetaPreflight(prisma, { ...context, requestId: reservation.id, report });
    return reply({ ...report, organizationId: context.organizationId, projectId: context.projectId });
  } catch (error) {
    if (error instanceof MetaPreflightRateError) return reply({ error: error.message, code: error.code }, 429, { 'Retry-After': '60' });
    const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error) : evidenceContextErrorResponse(error);
    if (known) { Object.entries(headers).forEach(([key, value]) => known.headers.set(key, value)); return known; }
    return reply({ error: 'No se pudo confirmar y registrar la verificación. No se cambió la configuración de Meta.', code: 'PREFLIGHT_UNCONFIRMED' }, 503);
  }
}
