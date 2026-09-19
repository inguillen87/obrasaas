import { databaseOrganizationIsInternal } from '../organization-policy.js';
import { assertEvidenceRequestContext } from '../evidence-context.js';
export class SignupScreenContextError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}
export function assertSignupScreenContext(request, access) {
  if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) {
    throw new SignupScreenContextError('Volvé a abrir Integraciones en la empresa y obra correctas.', 'WHATSAPP_SCREEN_CONTEXT_REQUIRED', 409);
  }
  if (['POST','DELETE'].includes(request.method) && (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site')) {
    throw new SignupScreenContextError('La solicitud no proviene de esta plataforma.', 'WHATSAPP_SCREEN_ORIGIN_REJECTED', 403);
  }
  assertEvidenceRequestContext(request, access);
  if (request.method === 'POST' && databaseOrganizationIsInternal(access.organization)) throw new SignupScreenContextError('Conectá el número desde el espacio de la empresa, no desde la administración interna.', 'WHATSAPP_CUSTOMER_WORKSPACE_REQUIRED', 409);
}
export function signupScreenContextResponse(error) {
  return error instanceof SignupScreenContextError ? Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
