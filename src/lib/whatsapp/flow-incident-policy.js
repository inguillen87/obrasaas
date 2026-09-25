import { historyId, FlowHistoryError } from './proactive-flow-history-policy.js';
const fields = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));
const instant = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const incidentId = v => typeof v === 'string' && /^inc-event-[a-f0-9]{32}$/.test(v);
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const FLOW_INCIDENT_STATES = Object.freeze({ unclassified: 'Sin estado de resolución registrado', active: 'Activa', open: 'Abierta', pending: 'Pendiente de revisión', resolved: 'Resuelta en el registro', closed: 'Cerrada en el registro' });
export const FLOW_INCIDENT_SEVERITIES = Object.freeze({ info: 'Informativa', warning: 'Advertencia', critical: 'Crítica', success: 'Informada como favorable' });
export function flowIncidentReceiptMatches(receipt, session) {
  try { return Boolean(fields(receipt,['version','incidentId','projectId','workerId','sessionId']) && receipt.version === 1
    && incidentId(receipt.incidentId) && uuid(session?.id) && session.blueprintKey === 'incident-report'
    && historyId(session.projectId) && historyId(session.workerId) && receipt.projectId === session.projectId
    && receipt.workerId === session.workerId && receipt.sessionId === session.id); } catch { return false; }
}
export function normalizeFlowIncidentQuery(params) {
  if (!(params instanceof URLSearchParams) || params.get('mode') !== 'incident'
    || [...params.keys()].some(k => !['projectId','mode','messageId'].includes(k) || params.getAll(k).length !== 1)) throw new FlowHistoryError('La consulta de incidencia no es válida.');
  return { messageId: historyId(params.get('messageId')) };
}
export function flowIncidentMatches(value, scope, sourceMessageId) {
  try {
    historyId(sourceMessageId); [scope.organizationId,scope.projectId,scope.conversationId].forEach(historyId);
    if (!fields(value,['context','sourceMessageId','observedAt','state','incident']) || !fields(value.context,['organizationId','projectId','conversationId'])
      || Object.keys(value.context).some(k => value.context[k] !== scope[k]) || value.sourceMessageId !== sourceMessageId || !instant(value.observedAt)
      || !['available','not_recorded','unavailable','unlinked','unsupported'].includes(value.state)) return false;
    if (value.state !== 'available') return value.incident === null;
    const row=value.incident;
    return Boolean(fields(row,['id','severity','status','snapshotVersion','snapshotUpdatedAt']) && incidentId(row.id)
      && typeof row.status === 'string' && typeof row.severity === 'string' && Object.hasOwn(FLOW_INCIDENT_STATES,row.status) && Object.hasOwn(FLOW_INCIDENT_SEVERITIES,row.severity)
      && Number.isSafeInteger(row.snapshotVersion) && row.snapshotVersion >= 0
      && instant(row.snapshotUpdatedAt) && row.snapshotUpdatedAt <= value.observedAt);
  } catch { return false; }
}
