import assert from 'node:assert/strict';
export const historyScope = { organizationId: 'organization-a', projectId: 'project-a', conversationId: 'conversation-a' };
export const historyAccess = { organization: { id: historyScope.organizationId }, project: { id: historyScope.projectId }, databaseUserId: 'reader-a' };
export const HISTORY_NOW = new Date('2026-09-24T12:00:00.000Z');
export function createHistoryFixture(count = 46) {
  const messages = [], sessions = [], calls = [];
  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(4, '0'), id = 'message-' + n, sessionId = '10000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const externalId = 'obrasaas-flow-template:history-' + i;
    messages.push({ id, conversationId: historyScope.conversationId, direction: 'OUTBOUND', kind: 'INTERACTIVE', externalId,
      providerMessageId: 'wamid.history.' + i, body: 'Mensaje conservado ' + n, status: 'accepted', createdAt: new Date(HISTORY_NOW.getTime() - (i + 1) * 60000),
      metadata: { messageType: 'whatsapp_flow_template', blueprintKey: 'incident-report', flowSessionId: sessionId,
        recipient: 'PRIVATE_PHONE_CANARY', flowToken: 'PRIVATE_TOKEN_CANARY', actorId: 'manager-a' } });
    sessions.push({ id: sessionId, organizationId: historyScope.organizationId, projectId: historyScope.projectId, blueprintKey: 'incident-report', sourceExternalId: externalId,
      expiresAt: new Date(HISTORY_NOW.getTime() + 3600000), consumedAt: null, providerMessageId: 'wamid.history.' + i, sentAt: new Date(HISTORY_NOW.getTime() - (i + 1) * 60000), deliveryRejectedAt: null,
      recipientPhone: 'PRIVATE_PHONE_CANARY', tokenSha256: 'PRIVATE_TOKEN_CANARY' });
  }
  const equal = (left, right) => left instanceof Date || right instanceof Date ? new Date(left).getTime() === new Date(right).getTime() : left === right;
  function matches(row, where) {
    return Object.entries(where).every(([key, expected]) => {
      if (key === 'AND') return expected.every(part => matches(row, part));
      if (key === 'OR') return expected.some(part => matches(row, part));
      if (key === 'metadata') return row.metadata?.[expected.path[0]] === expected.equals;
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if (Object.hasOwn(expected, 'in')) return expected.in.includes(row[key]);
        if (Object.hasOwn(expected, 'lt')) return row[key] < expected.lt;
        throw Error('Unknown fixture operator');
      }
      return equal(row[key], expected);
    });
  }
  const selected = (row, select) => structuredClone(Object.fromEntries(Object.keys(select).filter(key => select[key]).map(key => [key, row[key]])));
  const prisma = {
    conversation: { findFirst: async ({ where }) => {
      calls.push({ model: 'conversation', where: structuredClone(where) });
      return where.id === historyScope.conversationId && where.projectId === historyScope.projectId && where.project?.organizationId === historyScope.organizationId
        && where.channel === 'whatsapp' && where.externalId?.startsWith === 'meta:' ? { id: where.id } : null;
    } },
    project: { findFirst: async ({ where }) => where.id === historyScope.projectId && where.organizationId === historyScope.organizationId ? { id: where.id } : null },
    message: { findMany: async args => {
      calls.push({ model: 'message', args: structuredClone(args) }); assert.equal(args.take, 21);
      assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
      return messages.filter(row => matches(row, args.where)).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, args.take).map(row => selected(row, args.select));
    } },
    whatsAppFlowSession: { findMany: async args => {
      calls.push({ model: 'session', args: structuredClone(args) }); assert.ok(args.where.id.in.length <= 20);
      assert.equal(args.select.tokenSha256, undefined); assert.equal(args.select.recipientPhone, undefined);
      return sessions.filter(row => matches(row, args.where)).map(row => selected(row, args.select));
    } },
    $transaction: async (read, options) => { calls.push({ transaction: options }); return read(prisma); },
  };
  return { prisma, messages, sessions, calls };
}
