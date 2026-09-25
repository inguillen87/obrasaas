import { createHash } from 'node:crypto';
import { FlowHistoryError, FLOW_HISTORY_PAGE_SIZE, HISTORY_BLUEPRINTS, historyId, historyCursor, flowHistoryPageMatches } from './proactive-flow-history-policy.js';
const plain = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const iso = value => {
  if (!(value instanceof Date) && (typeof value !== 'string' || !value)) return null;
  const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const reference = value => typeof value === 'string' && value.length > 0 && value.length <= 500 && !/[\s\u0000-\u001f\u007f]/.test(value);
const binding = scope => createHash('sha256').update(JSON.stringify([scope.organizationId, scope.projectId, scope.conversationId])).digest('hex');
function afterCursor(cursor, scope) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url');
    if (raw.toString('base64url') !== cursor) throw new Error();
    const parsed = JSON.parse(raw.toString('utf8'));
    if (Object.keys(parsed).sort().join(',') !== 'at,binding,id,v' || parsed.v !== 1 || parsed.binding !== binding(scope)
      || !iso(parsed.at) || iso(parsed.at) !== parsed.at) throw new Error();
    historyId(parsed.id); return { createdAt: new Date(parsed.at), id: parsed.id };
  } catch { throw new FlowHistoryError('La página no corresponde a esta conversación. Volvé al inicio.', 'WHATSAPP_FLOW_HISTORY_CURSOR_INVALID'); }
}
function present(message, session, scope) {
  const metadata = plain(message.metadata), blueprintKey = metadata.blueprintKey;
  const validSession = session && session.id === metadata.flowSessionId && session.organizationId === scope.organizationId
    && session.projectId === scope.projectId && session.sourceExternalId === message.externalId && session.blueprintKey === blueprintKey;
  let correlation = session && !validSession ? 'conflict' : validSession ? 'verified' : 'unavailable';
  const messageRef = reference(message.providerMessageId), sessionRef = validSession && reference(session.providerMessageId);
  if (validSession && (messageRef && sessionRef && message.providerMessageId !== session.providerMessageId
    || session.deliveryRejectedAt && (session.sentAt || session.consumedAt || messageRef || sessionRef))) correlation = 'conflict';
  const original = typeof message.status === 'string' ? message.status.toLowerCase() : 'unknown';
  let status = ['sending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown'].includes(original) ? original : 'unknown';
  if (['accepted', 'sent', 'delivered', 'read'].includes(status) && !messageRef || correlation === 'conflict') status = 'unknown';
  const consumedAt = correlation === 'verified' ? iso(session.consumedAt) : null;
  // No provider id, flow token, recipient or raw metadata crosses this boundary.
  return { messageId: message.id, blueprintKey, body: typeof message.body === 'string' ? message.body.slice(0, 4096) : '',
    recordedAt: iso(message.createdAt), status, correlation,
    reply: { state: correlation !== 'verified' ? 'unverified' : consumedAt ? 'recorded' : 'not_recorded', recordedAt: consumedAt },
    expiresAt: correlation === 'verified' ? iso(session.expiresAt) : null,
    riskDecision: status === 'failed' && plain(metadata.uncertaintyResolution).decision === 'ALLOW_NEW_ATTEMPT'
      && plain(metadata.uncertaintyResolution).riskAccepted === true };
}
export async function listProactiveFlowHistory({ prisma, access, conversationId, cursor: rawCursor = null, clock = () => new Date() }) {
  const scope = { organizationId: historyId(access?.organization?.id), projectId: historyId(access?.project?.id), conversationId: historyId(conversationId) };
  const cursor = historyCursor(rawCursor), after = afterCursor(cursor, scope);
  return prisma.$transaction(async tx => {
    const conversation = await tx.conversation.findFirst({ where: { id: scope.conversationId, projectId: scope.projectId,
      project: { organizationId: scope.organizationId }, channel: 'whatsapp', externalId: { startsWith: 'meta:' } }, select: { id: true } });
    if (!conversation) throw new FlowHistoryError('La conversación no está disponible en esta obra.', 'INBOX_CONVERSATION_NOT_FOUND', 404);
    const messages = await tx.message.findMany({ where: { conversationId: conversation.id, direction: 'OUTBOUND',
      AND: [{ metadata: { path: ['messageType'], equals: 'whatsapp_flow_template' } },
        { OR: HISTORY_BLUEPRINTS.map(key => ({ metadata: { path: ['blueprintKey'], equals: key } })) },
        ...(after ? [{ OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] }] : [])] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: FLOW_HISTORY_PAGE_SIZE + 1,
      select: { id: true, externalId: true, providerMessageId: true, body: true, status: true, metadata: true, createdAt: true } });
    const rows = messages.slice(0, FLOW_HISTORY_PAGE_SIZE);
    const sessionIds = [...new Set(rows.map(row => plain(row.metadata).flowSessionId).filter(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
    const sessions = sessionIds.length ? await tx.whatsAppFlowSession.findMany({ where: { id: { in: sessionIds }, organizationId: scope.organizationId, projectId: scope.projectId },
      select: { id: true, organizationId: true, projectId: true, sourceExternalId: true, blueprintKey: true, expiresAt: true,
        providerMessageId: true, consumedAt: true, sentAt: true, deliveryRejectedAt: true } }) : [];
    const byId = new Map(sessions.map(session => [session.id, session]));
    const last = rows.at(-1), nextCursor = messages.length > FLOW_HISTORY_PAGE_SIZE
      ? Buffer.from(JSON.stringify({ v: 1, binding: binding(scope), at: iso(last.createdAt), id: last.id })).toString('base64url') : null;
    const page = { context: scope, cursor, nextCursor, pageSize: FLOW_HISTORY_PAGE_SIZE, observedAt: iso(clock()),
      items: rows.map(row => present(row, byId.get(plain(row.metadata).flowSessionId), scope)) };
    if (!flowHistoryPageMatches(page, scope, cursor)) throw new FlowHistoryError('No se pudo verificar el seguimiento de los registros.', 'WHATSAPP_FLOW_HISTORY_UNVERIFIED', 503);
    return page;
  }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 10000 });
}
