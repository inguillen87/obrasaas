import { normalizeMessageReport, reportIdentifier } from './progress-report-policy.js';
export class WhatsAppMessageBlockerError extends Error {
  constructor(message, code = 'WHATSAPP_BLOCKER_INVALID', status = 422) { super(message); this.name = 'WhatsAppMessageBlockerError'; this.code = code; this.status = status; }
}
export const BLOCKER_LABELS = Object.freeze({ OPEN: 'Abierta', IN_PROGRESS: 'En gestión', RESOLVED: 'Resuelta', CANCELLED: 'Cancelada' });
export const BLOCKER_PRIORITIES = Object.freeze({ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' });
const fields = new Set(['sourceVersion','taskId','title','description','ownerWorkerId','ownerTeamId','severity']);
export function normalizeMessageBlocker(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.has(key))) throw new WhatsAppMessageBlockerError('La restricción contiene campos no admitidos.');
  const reviewed = normalizeMessageReport({ sourceVersion: input.sourceVersion, taskId: input.taskId, title: input.title, summary: input.description });
  const ownerWorkerId = input.ownerWorkerId == null || input.ownerWorkerId === '' ? null : reportIdentifier(input.ownerWorkerId);
  const ownerTeamId = input.ownerTeamId == null || input.ownerTeamId === '' ? null : reportIdentifier(input.ownerTeamId);
  if (Boolean(ownerWorkerId) === Boolean(ownerTeamId)) throw new WhatsAppMessageBlockerError('Elegí una persona o una cuadrilla responsable, no ambas.');
  if (!Object.hasOwn(BLOCKER_PRIORITIES, input.severity)) throw new WhatsAppMessageBlockerError('Elegí una prioridad válida.');
  return { sourceVersion: reviewed.sourceVersion, taskId: reviewed.taskId, title: reviewed.title.replace(/\s+/g,' '), description: reviewed.summary.replace(/\s+/g,' '), ownerWorkerId, ownerTeamId, severity: input.severity };
}
export function confirmedMessageBlocker(payload, { organizationId, projectId, conversationId, messageId }) {
  const row = payload?.blocker, source = payload?.source;
  if (!row || !source || source.organizationId !== organizationId || source.projectId !== projectId || source.conversationId !== conversationId || source.messageId !== messageId
    || row.projectId !== projectId || typeof row.id !== 'string' || !/^wa_blocker_[a-f0-9]{64}$/.test(row.id)
    || !Object.hasOwn(BLOCKER_LABELS, row.status) || !Number.isSafeInteger(row.revision) || row.revision < 0 || typeof payload.replayed !== 'boolean') throw new WhatsAppMessageBlockerError('No se confirmó la restricción esperada. Conservá el mismo intento.', 'WHATSAPP_BLOCKER_UNCONFIRMED', 502);
  return row;
}
export function messageBlockerErrorResponse(error) {
  return error instanceof WhatsAppMessageBlockerError ? Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }) : null;
}
