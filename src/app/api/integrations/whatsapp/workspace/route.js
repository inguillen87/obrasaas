import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest, RequestBodyError, requestBodyErrorResponse } from '@/lib/request-body';
import { assertSignupScreenContext, signupScreenContextResponse } from '@/lib/whatsapp/signup-screen-context';
import { evidenceContextErrorResponse } from '@/lib/evidence-context';
import { readTenantWorkspace, saveTenantWorkspace } from '@/lib/whatsapp/tenant-workspace';
import { TenantWorkspaceError, tenantWorkspaceErrorResponse } from '@/lib/whatsapp/tenant-workspace-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
async function handle(request, write) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:integrations:manage', { subscriptionMode: write ? 'write' : 'read' });
    requireTenantPermission(access, 'org:projects:read', { subscriptionMode: 'read' });
    assertSignupScreenContext(request, access);
    if (new URL(request.url).search) throw new TenantWorkspaceError('La consulta no admite contexto ni filtros en la URL.');
    const scope = { organizationId: access.organization.id, projectId: access.project.id };
    const input = write ? await readJsonRequest(request, { maxBytes: 4096 }) : null;
    const result = write
      ? await saveTenantWorkspace(getPrisma(), { scope, actorId: access.databaseUserId, input })
      : await readTenantWorkspace(getPrisma(), { scope });
    return Response.json(result, { headers });
  } catch (error) {
    const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error)
      : signupScreenContextResponse(error) || evidenceContextErrorResponse(error) || tenantWorkspaceErrorResponse(error);
    if (known) { Object.entries(headers).forEach(([k,v]) => known.headers.set(k,v)); return known; }
    return Response.json({ error: error instanceof TenantWorkspaceError ? error.message : 'No se confirmó la configuración. Conservá el intento y verificá su estado.', code: error instanceof TenantWorkspaceError ? error.code : 'WORKSPACE_UNCONFIRMED' }, { status: error instanceof TenantWorkspaceError ? error.status : 503, headers });
  }
}
export const GET = request => handle(request, false);
export const POST = request => handle(request, true);
