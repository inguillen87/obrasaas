import { AccessError, accessErrorResponse } from './access';
import { RequestBodyError, requestBodyErrorResponse } from './request-body';
import { projectWritePolicyErrorResponse } from './project-write-policy';
import { InspectionError, inspectionErrorResponse } from './site-inspections';

export const inspectionResponseHeaders = { 'Cache-Control': 'private, no-store' };
export function assertInspectionOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new InspectionError('Origen de solicitud no autorizado.', 'INSPECTION_ORIGIN_FORBIDDEN', 403);
  }
}
export function inspectionHttpError(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  const known = inspectionErrorResponse(error) || projectWritePolicyErrorResponse(error);
  if (known) return known;
  console.error('Inspection operation failed:', error?.code || error?.name || 'unknown');
  return Response.json({ error: 'No se pudo completar la operación de inspecciones.', code: 'INSPECTION_OPERATION_FAILED' }, { status: 500, headers: inspectionResponseHeaders });
}
