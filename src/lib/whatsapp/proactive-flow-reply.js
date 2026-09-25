import { historyId, HISTORY_BLUEPRINTS, FlowHistoryError } from './proactive-flow-history-policy.js';
import { flowReplyMatches } from './proactive-flow-reply-policy.js';
import { presentWhatsAppReplyExcerpt } from './inbox.js';
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const reference = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\s\u0000-\u001f\u007f]/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;

// Shared exact chain for read-only projections in one database snapshot.
export async function resolveProactiveFlowReplyInTransaction(tx, scope, messageId, observedAt) {
    const conversation = await tx.conversation.findFirst({ where: { id: scope.conversationId, projectId: scope.projectId,
      project: { organizationId: scope.organizationId }, channel: 'whatsapp', externalId: { startsWith: 'meta:' } }, select: { id: true } });
    if (!conversation) throw new FlowHistoryError('La conversación no está disponible en esta obra.', 'INBOX_CONVERSATION_NOT_FOUND', 404);
    const source = await tx.message.findFirst({ where: { id: messageId, conversationId: scope.conversationId, direction: 'OUTBOUND', kind: 'INTERACTIVE',
      AND: [{ metadata: { path: ['messageType'], equals: 'whatsapp_flow_template' } }, { OR: HISTORY_BLUEPRINTS.map(key => ({ metadata: { path: ['blueprintKey'], equals: key } })) }] },
      select: { id: true, externalId: true, providerMessageId: true, createdAt: true, metadata: true } });
    if (!source) throw new FlowHistoryError('El envío no está disponible en esta conversación.', 'WHATSAPP_FLOW_SOURCE_NOT_FOUND', 404);
    const meta = record(source.metadata);
    if (!uuid(meta.flowSessionId) || !reference(source.externalId)) return { state: 'unavailable' };
    const session = await tx.whatsAppFlowSession.findFirst({ where: { id: meta.flowSessionId, organizationId: scope.organizationId, projectId: scope.projectId,
      blueprintKey: meta.blueprintKey, sourceExternalId: source.externalId },
      select: { id: true, projectId: true, blueprintKey: true, workerId: true, createdAt: true, consumedAt: true, consumedExternalId: true, sentAt: true, providerMessageId: true, deliveryRejectedAt: true } });
    if (!session) return { state: 'unavailable' };
    if (!session.consumedAt && !session.consumedExternalId) return { state: 'not_recorded' };
    const processedAt = date(session.consumedAt), issuedAt = date(session.createdAt), sentAt = date(session.sentAt);
    if (!processedAt || !issuedAt || !sentAt || processedAt < issuedAt || sentAt < issuedAt || processedAt < sentAt
      || processedAt > observedAt || !reference(session.consumedExternalId) || session.deliveryRejectedAt
      || !reference(source.providerMessageId) || source.providerMessageId !== session.providerMessageId) return { state: 'unavailable' };
    const inbound = await tx.message.findFirst({ where: { conversationId: scope.conversationId, externalId: session.consumedExternalId,
      direction: 'INBOUND', kind: 'INTERACTIVE' },
      select: { id: true, body: true, kind: true, direction: true, metadata: true, createdAt: true, sentAt: true } });
    if (!inbound) return { state: 'unavailable' };
    const inboundMeta = record(inbound.metadata), recordedAt = date(inbound.createdAt);
    if (inboundMeta.provider !== 'meta' || inboundMeta.authorized !== true || inboundMeta.quarantined === true
      || inboundMeta.whatsappFlowSessionId !== session.id || inboundMeta.whatsappFlowBlueprintKey !== meta.blueprintKey
      || inboundMeta.workerId !== session.workerId || inboundMeta.whatsappFlowSessionExpired === true
      || !recordedAt || recordedAt < issuedAt || recordedAt > observedAt) return { state: 'unavailable' };
    return { state: 'available', source, session, inbound, processedAt };
}

export async function readProactiveFlowReply({ prisma, access, conversationId, messageId, canReadAttendance = false, clock = () => new Date() }) {
  const scope = { organizationId: historyId(access?.organization?.id), projectId: historyId(access?.project?.id), conversationId: historyId(conversationId) };
  historyId(messageId);
  return prisma.$transaction(async tx => {
    const observedAt = date(clock());
    const resolved = await resolveProactiveFlowReplyInTransaction(tx, scope, messageId, observedAt);
    const payload = { context: scope, sourceMessageId: messageId, observedAt, state: resolved.state,
      reply: resolved.state === 'available' ? { ...presentWhatsAppReplyExcerpt(resolved.inbound), processedAt: resolved.processedAt } : null,
      ...(canReadAttendance === true && resolved.state === 'available' && resolved.session.blueprintKey === 'shift-check-in' ? { attendanceAvailable: true } : {}) };
    if (!flowReplyMatches(payload, scope, messageId)) throw new FlowHistoryError('No se pudo verificar la respuesta del formulario.', 'WHATSAPP_FLOW_REPLY_UNVERIFIED', 503);
    return payload;
  }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 10000 });
}
