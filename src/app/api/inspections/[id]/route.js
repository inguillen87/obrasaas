import { getPlatformAccess, requireTenantPermission, hasTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';
import { getInspection, mutateInspection } from '@/lib/site-inspection-store';
import { assertInspectionOrigin, inspectionHttpError, inspectionResponseHeaders } from '@/lib/site-inspection-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const scope = { organizationId: access.organization.id, projectId: access.project.id };
    return Response.json(await getInspection(getPrisma(), { scope, id: (await params).id }), { headers: inspectionResponseHeaders });
  } catch (error) { return inspectionHttpError(error); }
}
export async function PATCH(request, { params }) {
  try {
    assertInspectionOrigin(request);
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: 32 * 1024 });
    const scope = { organizationId: access.organization.id, projectId: access.project.id };
    const record = await mutateInspection(getPrisma(), { scope, actorId: access.databaseUserId, id: (await params).id, input, canReview: hasTenantPermission(access, 'org:inspections:approve') });
    return Response.json({ record }, { headers: inspectionResponseHeaders });
  } catch (error) { return inspectionHttpError(error); }
}
