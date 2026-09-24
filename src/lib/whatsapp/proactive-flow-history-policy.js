// Read-only history contracts. A cursor or record id never grants access.
export const FLOW_HISTORY_PAGE_SIZE = 20;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,1024}$/;
const STATUSES = new Set(['sending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown']);
export const HISTORY_BLUEPRINTS = ['incident-report', 'shift-check-in'];
export class FlowHistoryError extends Error {
  constructor(message, code = 'WHATSAPP_FLOW_HISTORY_INVALID', status = 400) {
    super(message); this.name = 'FlowHistoryError'; this.code = code; this.status = status;
  }
}
export function historyId(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new FlowHistoryError('El contexto del seguimiento no es válido.');
  return value;
}
export function historyCursor(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !CURSOR.test(value)) throw new FlowHistoryError('Volvé a la primera página del seguimiento.');
  return value;
}
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const nullableDate = value => value === null || date(value);
const keysAre = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
const text = (value, max) => typeof value === 'string' && value.length <= max;
export function flowHistoryPageMatches(page, scope, cursor = null) {
  try {
    [scope.organizationId, scope.projectId, scope.conversationId].forEach(historyId); historyCursor(cursor);
    if (!keysAre(page, ['context', 'cursor', 'nextCursor', 'pageSize', 'observedAt', 'items'])
      || !keysAre(page.context, ['organizationId', 'projectId', 'conversationId'])
      || Object.keys(page.context).some(key => page.context[key] !== scope[key]) || page.cursor !== cursor
      || page.pageSize !== FLOW_HISTORY_PAGE_SIZE || !date(page.observedAt)
      || !Array.isArray(page.items) || page.items.length > FLOW_HISTORY_PAGE_SIZE) return false;
    historyCursor(page.nextCursor);
    if (page.nextCursor !== null && (page.nextCursor === cursor || page.items.length !== FLOW_HISTORY_PAGE_SIZE)) return false;
    if (new Set(page.items.map(item => item?.messageId)).size !== page.items.length) return false;
    return page.items.every(item => {
      if (!keysAre(item, ['messageId', 'blueprintKey', 'body', 'recordedAt', 'status', 'correlation', 'reply', 'expiresAt', 'riskDecision'])
        || !historyId(item.messageId) || !HISTORY_BLUEPRINTS.includes(item.blueprintKey) || !text(item.body, 4096)
        || !date(item.recordedAt) || !STATUSES.has(item.status) || !['verified', 'unavailable', 'conflict'].includes(item.correlation)
        || !keysAre(item.reply, ['state', 'recordedAt']) || !['recorded', 'not_recorded', 'unverified'].includes(item.reply.state)
        || !nullableDate(item.reply.recordedAt) || !nullableDate(item.expiresAt) || typeof item.riskDecision !== 'boolean') return false;
      if (item.reply.state === 'recorded' && (!item.reply.recordedAt || item.correlation !== 'verified')) return false;
      if (item.reply.state !== 'recorded' && item.reply.recordedAt !== null) return false;
      if (item.correlation !== 'verified' && (item.reply.state !== 'unverified' || item.expiresAt !== null)) return false;
      if (item.correlation === 'conflict' && item.status !== 'unknown') return false;
      return true;
    });
  } catch { return false; }
}
export function flowHistoryReplyPresentation(item, observedAt) {
  if (item.reply.state === 'recorded') return { label: 'Respuesta registrada', detail: 'Se registró una respuesta al formulario. No acredita que el parte, fichaje o acción de negocio haya sido aprobado.', tone: 'recorded' };
  if (item.reply.state === 'unverified') return { label: 'Respuesta sin verificar', detail: 'No se pudo vincular una sesión válida al mensaje. No se infiere recepción ni entrega.', tone: 'unknown' };
  if (item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(observedAt)) return { label: 'Enlace vencido sin respuesta registrada', detail: 'La vigencia terminó según la última consulta. Esto no prueba que el mensaje no se haya entregado.', tone: 'expired' };
  return { label: 'Sin respuesta registrada', detail: 'No hay consumo registrado para esta sesión en la última consulta.', tone: 'pending' };
}
export function flowHistoryStatusLabel(item) {
  if (item.riskDecision) return 'Intento cerrado por decisión manual';
  return ({ accepted: 'Aceptado por Meta', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Intento rechazado', sending: 'En procesamiento', unknown: 'Resultado sin confirmar' })[item.status] || 'Resultado sin confirmar';
}
