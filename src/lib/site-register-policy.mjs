import { WorkspaceError, operationId, workspaceId, digest } from './workspace-policy.mjs';
export const SITE_ROLES = Object.freeze({
  WORKER: 'Operario', FOREMAN: 'Encargado', ARCHITECT: 'Arquitecto / director técnico',
  OWNER: 'Dueño / comitente', SAFETY: 'Seguridad e higiene', SUPPLIER: 'Proveedor',
});
export const MATERIAL_UNITS = Object.freeze(['unidad', 'm', 'm2', 'm3', 'kg', 'litro', 'bolsa']);
export function recordKeys(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== [...names].sort().join('|')) {
    throw new WorkspaceError('SITE_INPUT_INVALID');
  }
}
export function siteText(value, max, min = 1, multiline = false) {
  if (typeof value !== 'string') throw new WorkspaceError('SITE_INPUT_INVALID');
  const text = value.trim().replace(/\r\n/g, '\n');
  const forbidden = multiline ? /[\u0000-\u0008\u000b-\u001f\u007f<>]/ : /[\u0000-\u001f\u007f<>]/;
  if (text.length < min || text.length > max || forbidden.test(text)) throw new WorkspaceError('SITE_INPUT_INVALID');
  return text;
}
export function siteQuantity(value) {
  if (typeof value !== 'string' || !/^\d{1,9}(?:\.\d{1,3})?$/.test(value)) throw new WorkspaceError('SITE_QUANTITY_INVALID');
  const [whole, fraction = ''] = value.split('.');
  const thousandths = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
  if (thousandths <= 0n) throw new WorkspaceError('SITE_QUANTITY_INVALID');
  const decimals = (thousandths % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return (thousandths / 1000n).toString() + (decimals ? '.' + decimals : '');
}
export function siteRevision(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value)) throw new WorkspaceError('SITE_REVISION_REQUIRED');
  return value;
}
export function normalizeSiteCommand(input) {
  recordKeys(input, ['operationId', 'projectId', 'scope', 'action', 'payload']);
  if (!operationId(input.operationId) || !workspaceId(input.projectId) || !/^[a-f0-9]{64}$/.test(input.scope || '')) throw new WorkspaceError('SITE_INPUT_INVALID');
  const body = input.payload; let payload;
  if (input.action === 'ADD_PERSON') {
    recordKeys(body, ['name', 'phone', 'job']);
    if (!Object.hasOwn(SITE_ROLES, body.job)) throw new WorkspaceError('SITE_ROLE_INVALID');
    if (typeof body.phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(body.phone)) throw new WorkspaceError('SITE_PHONE_INVALID');
    payload = { name: siteText(body.name, 100, 2), phone: body.phone, job: body.job };
  } else if (input.action === 'SET_PERSON_ACTIVE') {
    recordKeys(body, ['personId', 'revision', 'active', 'reason']);
    if (!workspaceId(body.personId) || typeof body.active !== 'boolean') throw new WorkspaceError('SITE_INPUT_INVALID');
    payload = { personId: body.personId, revision: siteRevision(body.revision), active: body.active, reason: siteText(body.reason, 500, 8, true) };
  } else if (input.action === 'REPORT_ISSUE') {
    recordKeys(body, ['title', 'details', 'sector', 'severity']);
    if (!['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body.severity)) throw new WorkspaceError('SITE_SEVERITY_INVALID');
    payload = { title: siteText(body.title, 160, 3), details: siteText(body.details, 2000, 8, true), sector: siteText(body.sector, 100, 2), severity: body.severity };
  } else if (input.action === 'REQUEST_MATERIAL') {
    recordKeys(body, ['material', 'quantity', 'unit', 'sector', 'details']);
    if (!MATERIAL_UNITS.includes(body.unit)) throw new WorkspaceError('SITE_QUANTITY_INVALID');
    payload = { material: siteText(body.material, 160, 2), quantity: siteQuantity(body.quantity), unit: body.unit,
      sector: siteText(body.sector, 100, 2), details: siteText(body.details, 2000, 8, true) };
  } else if (input.action === 'REVIEW_REPORT') {
    recordKeys(body, ['reportId', 'revision', 'decision', 'reason']);
    if (!workspaceId(body.reportId) || !['ACKNOWLEDGED', 'RESOLVED', 'REJECTED'].includes(body.decision)) throw new WorkspaceError('SITE_INPUT_INVALID');
    payload = { reportId: body.reportId, revision: siteRevision(body.revision), decision: body.decision, reason: siteText(body.reason, 1000, 8, true) };
  } else throw new WorkspaceError('SITE_ACTION_INVALID');
  return { ...input, operationId: input.operationId.toLowerCase(), payload };
}
export function siteOperationId(actorId, input) { return 'site_' + digest([actorId, input.projectId, input.operationId.toLowerCase()]); }
export function siteCommandDigest(input) { return digest([input.projectId, input.scope, input.action, input.payload]); }
export function cleanMetadata(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new WorkspaceError('SITE_RECORD_INTEGRITY', 409);
  return value;
}
export function siteTransition(type, current, next) {
  if (!['ISSUE', 'MATERIAL_REQUEST'].includes(type)) throw new WorkspaceError('SITE_RECORD_NOT_SUPPORTED', 409);
  if (!['OPEN', 'ACKNOWLEDGED'].includes(current)) throw new WorkspaceError('SITE_REPORT_ALREADY_CLOSED', 409);
  if (!['ACKNOWLEDGED', 'RESOLVED', 'REJECTED'].includes(next) || next === current) throw new WorkspaceError('SITE_TRANSITION_INVALID', 409);
  return next;
}
