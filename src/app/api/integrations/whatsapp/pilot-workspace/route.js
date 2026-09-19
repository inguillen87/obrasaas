import { clerkClient } from '@clerk/nextjs/server';
import { requireSuperadmin, AccessError, accessErrorResponse } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { readJsonRequest, RequestBodyError, requestBodyErrorResponse } from '@/lib/request-body';
import { provisionPilotWorkspace, PilotWorkspaceError } from '@/lib/whatsapp/pilot-workspace';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
export async function POST(request) {
  try {
    if (process.env.VERCEL_ENV !== 'preview' || process.env.WHATSAPP_PILOT_IMPORT_ENABLED !== 'true') return Response.json({ error: 'Recurso no disponible.' }, { status: 404, headers });
    const url = new URL(request.url);
    if (url.search || request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Origen o solicitud no autorizado.' }, { status: 403, headers });
    const access = await requireSuperadmin();
    if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) throw new PilotWorkspaceError('PILOT_SETUP_CONTEXT_REQUIRED', 409);
    assertEvidenceRequestContext(request, access);
    const body = await readJsonRequest(request, { maxBytes: 2048 });
    const result = await provisionPilotWorkspace({ prisma: getPrisma(), clerk: await clerkClient(), access, body });
    return Response.json({ ...result, context: { organizationId: access.organization.id, projectId: access.project.id } }, { headers });
  } catch (error) {
    const response = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error) : evidenceContextErrorResponse(error);
    if (response) { Object.entries(headers).forEach(([key,value]) => response.headers.set(key,value)); return response; }
    return Response.json({ error: error instanceof PilotWorkspaceError ? error.message : 'Alta no confirmada. Conservá los nombres y verificá el mismo intento.', code: error instanceof PilotWorkspaceError ? error.code : 'PILOT_SETUP_UNCONFIRMED' }, { status: error instanceof PilotWorkspaceError ? error.status : 503, headers });
  }
}
