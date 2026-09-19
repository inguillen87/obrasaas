import { AccessError, accessErrorResponse, getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { BusinessProfileError, businessProfileFromMetadata, businessProfilePaths, updateBusinessProfile } from '@/lib/organization-business-profile';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
async function accessFor(request, write) {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:projects:read', { subscriptionMode: 'read' });
  if (write) requireTenantPermission(access, 'tenant:members:manage', { subscriptionMode: 'write' });
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (url.search || (origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new BusinessProfileError('La solicitud no pertenece al contexto autorizado.', 'BUSINESS_PROFILE_ORIGIN', 403);
  if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) throw new BusinessProfileError('Volvé a abrir el perfil desde la organización activa.', 'BUSINESS_PROFILE_CONTEXT', 409);
  assertEvidenceRequestContext(request, access); return access;
}
function response(access, result) { return Response.json({ ...result, organizationId: access.organization.id, projectId: access.project.id, canManage: hasTenantPermission(access, 'tenant:members:manage'), paths: businessProfilePaths(result.profile, permission => hasTenantPermission(access, permission)) }, { headers }); }
function failure(error) {
  const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error) : evidenceContextErrorResponse(error);
  const result = known || Response.json({ error: error instanceof BusinessProfileError ? error.message : 'No se confirmó el perfil. Conservá la selección y consultá la versión actual.', code: error instanceof BusinessProfileError ? error.code : 'BUSINESS_PROFILE_UNCONFIRMED' }, { status: error instanceof BusinessProfileError ? error.status : 503 });
  Object.entries(headers).forEach(([key,value]) => result.headers.set(key,value)); return result;
}
export async function GET(request) {
  try { const access = await accessFor(request, false); const org = await getPrisma().organization.findUnique({ where: { id: access.organization.id }, select: { metadata: true } }); if (!org) throw new BusinessProfileError('Organización no disponible.', 'BUSINESS_PROFILE_NOT_FOUND', 404); return response(access, { profile: businessProfileFromMetadata(org.metadata) }); } catch (error) { return failure(error); }
}
export async function PATCH(request) {
  try { const access = await accessFor(request, true); const input = await readJsonRequest(request, { maxBytes: 8192 }); return response(access, await updateBusinessProfile(getPrisma(), { organizationId: access.organization.id, actorId: access.databaseUserId, input })); } catch (error) { return failure(error); }
}
