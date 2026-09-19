import { AccessError, accessErrorResponse, getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { fieldStatusQuery, readScheduleFieldStatus, ScheduleFieldStatusError } from '@/lib/schedule-field-status';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization, X-ObraSaaS-Organization, X-ObraSaaS-Project', 'X-Content-Type-Options': 'nosniff' };
export function createFieldStatusHandler({ resolveAccess = getPlatformAccess, authorize = requireTenantPermission, hasPermission = hasTenantPermission, database = getPrisma, load = readScheduleFieldStatus } = {}) {
  return async function GET(request) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:tasks:read', { subscriptionMode: 'read' });
      authorize(access, 'org:execution:read', { subscriptionMode: 'read' });
      if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) throw new ScheduleFieldStatusError('Actualizá el contexto de la pantalla.', 'FIELD_STATUS_CONTEXT_REQUIRED', 409);
      assertEvidenceRequestContext(request, access);
      const query = fieldStatusQuery(new URL(request.url).searchParams);
      const snapshot = await load(database(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, query, canReadMeasurements: Boolean(access.tenantMembershipId) && hasPermission(access, 'org:measurements:read') });
      const etag = '"field-' + snapshot.version + '"';
      const responseHeaders = { ...headers, ETag: etag, 'X-ObraSaaS-Checked-At': snapshot.checkedAt };
      if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: responseHeaders });
      return Response.json(snapshot, { headers: responseHeaders });
    } catch (error) {
      const known = error instanceof AccessError ? accessErrorResponse(error) : evidenceContextErrorResponse(error);
      if (known) { Object.entries(headers).forEach(([key, value]) => known.headers.set(key, value)); return known; }
      return Response.json({ error: error instanceof ScheduleFieldStatusError ? error.message : 'No se pudo verificar el estado del campo.', code: error instanceof ScheduleFieldStatusError ? error.code : 'FIELD_STATUS_UNAVAILABLE' }, { status: error instanceof ScheduleFieldStatusError ? error.status : 503, headers });
    }
  };
}
export const GET = createFieldStatusHandler();
