export const WORKSPACE_NUMBER_MODES = Object.freeze([
  { key: 'DEDICATED', label: 'Número para el asistente', detail: 'Un número de la empresa destinado a Cloud API. Se autoriza con Meta.' },
  { key: 'BUSINESS_APP', label: 'Ya uso WhatsApp Business', detail: 'Quiero conservar la app. Requiere coexistencia y elegibilidad verificadas antes de conectar.' },
  { key: 'EXISTING_API', label: 'Ya tengo otro proveedor', detail: 'Necesita un traspaso planificado. No desconectaremos el servicio actual automáticamente.' },
].map(Object.freeze));
export const WORKSPACE_USE_CASES = Object.freeze([
  { key: 'FIELD_REPORTS', label: 'Partes y evidencia de obra', detail: 'Novedades, fotos y audios vinculados a una tarea.' },
  { key: 'MATERIAL_REQUESTS', label: 'Materiales y faltantes', detail: 'Solicitudes revisables, sin compras automáticas.' },
  { key: 'SCHEDULE_QUERIES', label: 'Seguimiento del cronograma', detail: 'Consultar y proponer actualizaciones con su fuente.' },
].map(Object.freeze));
export class TenantWorkspaceError extends Error {
  constructor(message, code = 'WORKSPACE_INVALID', status = 422) { super(message); this.code = code; this.status = status; }
}
export const workspaceIdentifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function normalizeTenantWorkspace(input) {
  const keys = new Set(['assistantName','numberMode','initialProjectId','useCases','expectedRevision','confirmOwnership']);
  if (!object(input) || Object.keys(input).some(key => !keys.has(key))) throw new TenantWorkspaceError('La configuración contiene campos no admitidos.');
  const name = typeof input.assistantName === 'string' ? input.assistantName.trim() : '';
  if (!name || name.length > 70 || /[\u0000-\u001f\u007f<>]/.test(name)) throw new TenantWorkspaceError('Usá un nombre del asistente de 1 a 70 caracteres, sin etiquetas.');
  if (!WORKSPACE_NUMBER_MODES.some(mode => mode.key === input.numberMode) || !workspaceIdentifier(input.initialProjectId)) throw new TenantWorkspaceError('Seleccioná el tipo de número y la primera obra.');
  if (!Array.isArray(input.useCases) || !input.useCases.length || input.useCases.length > WORKSPACE_USE_CASES.length || new Set(input.useCases).size !== input.useCases.length || input.useCases.some(key => !WORKSPACE_USE_CASES.some(item => item.key === key))) throw new TenantWorkspaceError('Elegí al menos un circuito del asistente.');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.confirmOwnership !== true) throw new TenantWorkspaceError('Confirmá la cuenta de tu empresa y la revisión de la configuración.');
  return { assistantName: name, numberMode: input.numberMode, initialProjectId: input.initialProjectId,
    useCases: WORKSPACE_USE_CASES.map(item => item.key).filter(key => input.useCases.includes(key)), expectedRevision: input.expectedRevision, confirmOwnership: true };
}
export function tenantWorkspaceFromMetadata(metadata) {
  if (metadata != null && !object(metadata)) throw new TenantWorkspaceError('La configuración de empresa necesita revisión.', 'WORKSPACE_INTEGRITY', 409);
  const stored = metadata?.whatsappWorkspace;
  if (stored == null) return { configured: false, revision: 0, assistantName: '', numberMode: null, initialProjectId: null, useCases: [], mode: 'REVIEW_REQUIRED', ownership: 'CUSTOMER', updatedAt: null };
  try {
    if (!object(stored) || stored.schemaVersion !== 1 || !Number.isSafeInteger(stored.revision) || stored.revision < 1 || stored.mode !== 'REVIEW_REQUIRED' || stored.ownership !== 'CUSTOMER' || typeof stored.updatedAt !== 'string' || stored.updatedAt.length > 40 || !Number.isFinite(Date.parse(stored.updatedAt))) throw new Error();
    const normalized = normalizeTenantWorkspace({ assistantName: stored.assistantName, numberMode: stored.numberMode, initialProjectId: stored.initialProjectId, useCases: stored.useCases, expectedRevision: stored.revision, confirmOwnership: true });
    return { configured: true, revision: stored.revision, assistantName: normalized.assistantName, numberMode: normalized.numberMode, initialProjectId: normalized.initialProjectId, useCases: normalized.useCases, mode: 'REVIEW_REQUIRED', ownership: 'CUSTOMER', updatedAt: stored.updatedAt };
  } catch { throw new TenantWorkspaceError('La configuración guardada requiere revisión; no se reemplazó por valores de ejemplo.', 'WORKSPACE_INTEGRITY', 409); }
}
export function workspaceAuthorizationState(profile, projectId) {
  if (!profile.configured) return { allowed: false, code: 'WORKSPACE_REQUIRED', message: 'Guardá primero la preparación del asistente de tu empresa.' };
  if (profile.initialProjectId !== projectId) return { allowed: false, code: 'WORKSPACE_PROJECT_MISMATCH', message: 'Abrí Integraciones en la primera obra que elegiste. No conectaremos el número a otra obra.' };
  if (profile.numberMode !== 'DEDICATED') return { allowed: false, code: 'WORKSPACE_ASSISTED_ONBOARDING', message: profile.numberMode === 'BUSINESS_APP' ? 'Conservamos tu elección. La coexistencia debe habilitarse y verificarse antes de conectar, sin perder tu app.' : 'Conservamos tu elección. El traspaso necesita un plan y validación antes de modificar el proveedor actual.' };
  return { allowed: true, code: 'READY_FOR_META_AUTHORIZATION', message: 'Preparación guardada. Falta autorizar en Meta y comprobar recepción y respuesta.' };
}
export function confirmsTenantWorkspaceSave(body, command, scope) {
  const p = body?.profile;
  return Boolean(body?.organizationId === scope.organizationId && body?.projectId === scope.projectId && typeof body.unchanged === 'boolean' && p?.configured === true && p.assistantName === command.assistantName && p.numberMode === command.numberMode && p.initialProjectId === command.initialProjectId && p.mode === 'REVIEW_REQUIRED' && p.ownership === 'CUSTOMER' && JSON.stringify(p.useCases) === JSON.stringify(command.useCases) && (p.revision === command.expectedRevision + 1 || body.unchanged && p.revision === command.expectedRevision));
}
const PUBLIC_WORKSPACE_ERRORS = Object.freeze({
  WORKSPACE_INVALID: 'Revisá el nombre, el tipo de número, la primera obra y la confirmación de tu empresa.',
  WORKSPACE_SCOPE: 'No se pudo confirmar el espacio de tu empresa.',
  WORKSPACE_CUSTOMER_REQUIRED: 'Abrí esta preparación desde una empresa cliente, no desde administración interna.',
  WORKSPACE_INTEGRITY: 'La preparación guardada necesita revisión. No fue reemplazada.',
  WORKSPACE_PROJECT_UNAVAILABLE: 'La primera obra no está disponible para operar en esta empresa.',
  WORKSPACE_CONFLICT: 'Otro cambio modificó esta preparación. Conservá tu texto y consultá la versión actual.',
  WORKSPACE_REQUIRED: 'Guardá la preparación del asistente antes de autorizar el número.',
  WORKSPACE_PROJECT_MISMATCH: 'Abrí Integraciones en la primera obra elegida para esta conexión.',
  WORKSPACE_ASSISTED_ONBOARDING: 'El tipo de conexión elegido necesita habilitación específica antes de cambiar tu número.',
  WORKSPACE_REVISION_CHANGED: 'La preparación cambió. Consultá la revisión actual antes de autorizar.',
});
export function tenantWorkspaceErrorResponse(error) {
  if (!(error instanceof TenantWorkspaceError)) return null;
  const known = Object.hasOwn(PUBLIC_WORKSPACE_ERRORS, error.code);
  return Response.json({ error: known ? PUBLIC_WORKSPACE_ERRORS[error.code] : 'No se confirmó la preparación.', code: known ? error.code : 'WORKSPACE_UNCONFIRMED' },
    { status: known ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } });
}
