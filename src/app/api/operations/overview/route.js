import { AccessError, accessErrorResponse, getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { OperationsOverviewError, operationsPermissions, readOperationsOverview } from '@/lib/operations-overview';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization, X-ObraSaaS-Project, X-ObraSaaS-Organization', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) throw new OperationsOverviewError('Verificá la obra activa.', 409, 'OPERATIONS_CONTEXT_REQUIRED');
    assertEvidenceRequestContext(request, access);
    if (new URL(request.url).search) throw new OperationsOverviewError('La consulta no admite filtros de empresa, obra o usuario.');
    const permissions = operationsPermissions(access, hasTenantPermission);
    for (const [key, permission] of [['execution','org:execution:read'],['proposals','org:operational-proposals:read'],['tasks','org:tasks:read'],['inbox','org:conversations:read'],['integrations','org:integrations:manage'],['attendance','org:attendance:read'],['reports','org:reports:read']]) {
      if (permissions[key]) requireTenantPermission(access, permission, { subscriptionMode: 'read' });
    }
    const result = await readOperationsOverview(getPrisma(), { scope: { organizationId: access.organization.id, projectId: access.project.id }, permissions });
    return Response.json(result, { headers });
  } catch (error) {
    const known = error instanceof AccessError ? accessErrorResponse(error) : evidenceContextErrorResponse(error);
    if (known) { Object.entries(headers).forEach(([key,value]) => known.headers.set(key,value)); return known; }
    return Response.json({ error: error instanceof OperationsOverviewError ? error.message : 'No se pudo verificar el centro de operaciones.', code: error instanceof OperationsOverviewError ? error.code : 'OPERATIONS_UNAVAILABLE' }, { status: error instanceof OperationsOverviewError ? error.status : 503, headers });
  }
}
