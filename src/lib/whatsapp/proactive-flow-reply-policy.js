import { historyId, FlowHistoryError } from './proactive-flow-history-policy.js';
const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value,key));
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function normalizeFlowReplyQuery(params) {
  if (!(params instanceof URLSearchParams) || [...params.keys()].some(key => !['projectId','mode','messageId'].includes(key) || params.getAll(key).length !== 1)
    || params.get('mode') !== 'reply') throw new FlowHistoryError('La consulta de respuesta no es válida.');
  return { messageId: historyId(params.get('messageId')) };
}
export function flowReplyMatches(value, scope, sourceMessageId) {
  try {
    historyId(sourceMessageId); [scope.organizationId,scope.projectId,scope.conversationId].forEach(historyId);
    if (!fields(value,['context','sourceMessageId','observedAt','state','reply'])
      || !fields(value.context,['organizationId','projectId','conversationId'])
      || Object.keys(value.context).some(key => value.context[key] !== scope[key])
      || value.sourceMessageId !== sourceMessageId || !instant(value.observedAt)
      || !['available','not_recorded','unavailable'].includes(value.state)) return false;
    if (value.state !== 'available') return value.reply === null;
    const reply=value.reply;
    return Boolean(fields(reply,['messageId','body','recordedAt','processedAt'])
      && historyId(reply.messageId) && reply.messageId !== sourceMessageId
      && typeof reply.body === 'string' && reply.body.length <= 4096
      && instant(reply.recordedAt) && instant(reply.processedAt)
      && reply.recordedAt <= value.observedAt && reply.processedAt <= value.observedAt);
  } catch { return false; }
}
