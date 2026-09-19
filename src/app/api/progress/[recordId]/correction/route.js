import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { RequestBodyError, readJsonRequest, requestBodyErrorResponse } from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import { JournalCorrectionError, correctionErrorResponse } from '@/lib/journal-correction-policy';
import { prepareJournalCorrection, createJournalCorrection } from '@/lib/journal-correction';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
async function authorize(request, write) {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new JournalCorrectionError('Origen no autorizado.', 'JOURNAL_CORRECTION_ORIGIN', 403);
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: write ? 'write' : 'read' });
  requireTenantPermission(access, 'org:tasks:read', { subscriptionMode: 'read' });
  if (!request.headers.get('x-obrasaas-organization') || !request.headers.get('x-obrasaas-project')) throw new JournalCorrectionError('Verificá la obra activa antes de continuar.', 'JOURNAL_CORRECTION_CONTEXT_REQUIRED', 409);
  assertEvidenceRequestContext(request, access);
  if (url.search) throw new JournalCorrectionError('La corrección no admite parámetros de consulta.');
  return { scope: { organizationId: access.organization.id, projectId: access.project.id }, actorId: access.databaseUserId };
}
function failure(error) {
  const response = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error)
    : evidenceContextErrorResponse(error) || correctionErrorResponse(error) || projectWritePolicyErrorResponse(error);
  const result = response || Response.json({ error: 'No se confirmó la operación. Conservá el texto y verificá el mismo intento.', code: 'JOURNAL_CORRECTION_UNCONFIRMED' }, { status: 503 });
  Object.entries(headers).forEach(([key, value]) => result.headers.set(key, value)); return result;
}
export async function GET(request, { params }) {
  try {
    const access = await authorize(request, false);
    const result = await prepareJournalCorrection(getPrisma(), { ...access, sourceId: (await params).recordId });
    return Response.json(result, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request, { params }) {
  try {
    const access = await authorize(request, true);
    const input = await readJsonRequest(request, { maxBytes: 64 * 1024 });
    const result = await createJournalCorrection(getPrisma(), { ...access, sourceId: (await params).recordId, operationKey: request.headers.get('idempotency-key'), input });
    return Response.json(result, { status: result.replayed ? 200 : 201, headers });
  } catch (error) { return failure(error); }
}
