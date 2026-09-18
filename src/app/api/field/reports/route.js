import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { FieldReportError, fieldReportErrorResponse } from '@/lib/field-report';
import { createFieldReport } from '@/lib/field-report-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      throw new FieldReportError('Origen de solicitud no autorizado.', 'FIELD_ORIGIN_FORBIDDEN', 403);
    }
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: 16 * 1024 });
    const result = await createFieldReport(getPrisma(), {
      scope: { organizationId: access.organization.id, projectId: access.project.id },
      actorId: access.databaseUserId, operationKey: request.headers.get('idempotency-key'), input,
    });
    return Response.json(result, { status: result.replayed ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    return fieldReportErrorResponse(error) || projectWritePolicyErrorResponse(error) || Response.json({
      error: 'No se confirmó el guardado. Reintentá la misma solicitud.', code: 'FIELD_SAVE_UNCONFIRMED',
    }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
