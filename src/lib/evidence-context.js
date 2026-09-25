export class EvidenceContextError extends Error {
  constructor() { super('La sesión está en otra empresa u obra. Volvé al contexto original antes de reintentar.'); this.code = 'EVIDENCE_CONTEXT_CHANGED'; this.status = 409; }
}
// Hints supplied by the editor are compared to session authority, never used as authority.
// Existing clients without hints retain the session-scoped API contract.
export function assertEvidenceRequestContext(request, access) {
  const organizationId = request.headers.get('x-obrasaas-organization');
  const projectId = request.headers.get('x-obrasaas-project');
  if (organizationId === null && projectId === null) return;
  if (!organizationId || !projectId || organizationId !== access.organization.id || projectId !== access.project.id) throw new EvidenceContextError();
}
export function evidenceContextErrorResponse(error) {
  return error instanceof EvidenceContextError ? Response.json({ code: error.code, error: error.message }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
