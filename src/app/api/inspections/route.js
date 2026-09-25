import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';
import { createInspection, listInspections } from '@/lib/site-inspection-store';
import { assertInspectionOrigin, inspectionHttpError, inspectionResponseHeaders } from '@/lib/site-inspection-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const scope = { organizationId: access.organization.id, projectId: access.project.id };
    const page = Number(new URL(request.url).searchParams.get('page') || 0);
    return Response.json(await listInspections(getPrisma(), { scope, page }), { headers: inspectionResponseHeaders });
  } catch (error) { return inspectionHttpError(error); }
}
export async function POST(request) {
  try {
    assertInspectionOrigin(request);
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: 32 * 1024 });
    const scope = { organizationId: access.organization.id, projectId: access.project.id };
    const result = await createInspection(getPrisma(), { scope, actorId: access.databaseUserId, input });
    return Response.json(result, { status: result.replayed ? 200 : 201, headers: inspectionResponseHeaders });
  } catch (error) { return inspectionHttpError(error); }
}
