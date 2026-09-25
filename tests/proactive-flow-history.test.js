import assert from 'node:assert/strict';
import test from 'node:test';
import { listProactiveFlowHistory } from '../src/lib/whatsapp/proactive-flow-history.js';
import { flowHistoryPageMatches, flowHistoryReplyPresentation, flowHistoryStatusLabel } from '../src/lib/whatsapp/proactive-flow-history-policy.js';
import { createHistoryFixture, historyScope, historyAccess, HISTORY_NOW } from './helpers/flow-history-fixture.js';
const read = (f, changes = {}) => listProactiveFlowHistory({ prisma: f.prisma, access: historyAccess, conversationId: historyScope.conversationId, clock: () => HISTORY_NOW, ...changes });

test('all persisted sends can be read in bounded pages without an in-memory operation key', async () => {
  const f = createHistoryFixture(), before = structuredClone([f.messages, f.sessions]), ids = []; let cursor = null;
  do { const page = await read(f, { cursor }); assert.equal(flowHistoryPageMatches(page, historyScope, cursor), true);
    ids.push(...page.items.map(row => row.messageId)); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(ids.length, 46); assert.equal(new Set(ids).size, 46); assert.equal(ids[0], 'message-0000'); assert.equal(ids.at(-1), 'message-0045');
  assert.deepEqual([f.messages, f.sessions], before); assert.equal(f.calls.filter(row => row.model === 'message').length, 3);
  assert.equal(f.calls.filter(row => row.model === 'session').length, 3);
  assert.ok(f.calls.filter(row => row.transaction).every(row => row.transaction.isolationLevel === 'RepeatableRead'));
});
test('secrets and raw provider/contact data never cross the public boundary', async () => {
  const f = createHistoryFixture(), page = await read(f), text = JSON.stringify(page);
  for (const forbidden of ['PRIVATE_PHONE_CANARY', 'PRIVATE_TOKEN_CANARY', 'wamid.', 'flowToken', 'tokenSha256', 'recipientPhone', 'actorId', 'idempotencyDigest', 'payloadDigest']) assert.ok(!text.includes(forbidden), forbidden);
});
test('ordinary text, unsupported blueprints and foreign conversation rows are excluded', async () => {
  const f = createHistoryFixture(0), samples = createHistoryFixture(5).messages;
  samples[0].direction = 'INBOUND'; samples[1].conversationId = 'foreign'; samples[2].metadata.messageType = 'text'; samples[3].metadata.blueprintKey = 'payment'; samples[4].metadata = null;
  f.messages.push(...samples); const page = await read(f); assert.deepEqual(page.items, []); assert.equal(page.nextCursor, null);
  assert.equal(f.calls.filter(row => row.model === 'session').length, 0);
});
for (const status of ['accepted', 'sent', 'delivered', 'read']) test('status ' + status + ' without provider reference is not evidence of acceptance', async () => {
  const f = createHistoryFixture(1); f.messages[0].status = status; f.messages[0].providerMessageId = null;
  assert.equal((await read(f)).items[0].status, 'unknown');
});
for (const field of ['organizationId', 'projectId']) test('session from another ' + field + ' is excluded before presentation', async () => {
  const f = createHistoryFixture(1); f.sessions[0][field] = 'foreign'; f.sessions[0].consumedAt = HISTORY_NOW;
  const row = (await read(f)).items[0]; assert.equal(row.reply.state, 'unverified'); assert.equal(row.reply.recordedAt, null); assert.equal(row.expiresAt, null);
});
for (const field of ['sourceExternalId', 'blueprintKey', 'providerMessageId']) test('same-scope but mismatched ' + field + ' cannot claim a correlated response', async () => {
  const f = createHistoryFixture(1); f.sessions[0][field] = 'other'; f.sessions[0].consumedAt = HISTORY_NOW;
  const row = (await read(f)).items[0]; assert.equal(row.correlation, 'conflict'); assert.equal(row.status, 'unknown'); assert.equal(row.reply.state, 'unverified');
});
test('a consumed session is displayed separately from delivery and domain completion', async () => {
  const f = createHistoryFixture(1); f.sessions[0].consumedAt = HISTORY_NOW; f.messages[0].status = 'delivered';
  const page = await read(f), row = page.items[0]; assert.equal(row.status, 'delivered'); assert.equal(row.reply.state, 'recorded');
  assert.match(flowHistoryReplyPresentation(row, page.observedAt).detail, /No acredita/); assert.equal(flowHistoryStatusLabel(row), 'Entregado');
});
test('expired link without consumption is not proof that the message was not delivered', async () => {
  const f = createHistoryFixture(1); f.messages[0].status = 'delivered'; f.sessions[0].expiresAt = new Date(HISTORY_NOW.getTime() - 1000);
  const page = await read(f), shown = flowHistoryReplyPresentation(page.items[0], page.observedAt);
  assert.equal(shown.label, 'Enlace vencido sin respuesta registrada'); assert.match(shown.detail, /no prueba/);
});
test('manual duplicate-risk decision is not mislabeled as provider rejection', async () => {
  const f = createHistoryFixture(1); f.messages[0].status = 'failed'; f.messages[0].providerMessageId = null;
  f.messages[0].metadata.uncertaintyResolution = { decision: 'ALLOW_NEW_ATTEMPT', riskAccepted: true };
  const row = (await read(f)).items[0]; assert.equal(row.riskDecision, true); assert.equal(flowHistoryStatusLabel(row), 'Intento cerrado por decisión manual');
});
test('contradictory rejected and consumed session is not used as positive evidence', async () => {
  const f = createHistoryFixture(1); f.sessions[0].consumedAt = HISTORY_NOW; f.sessions[0].deliveryRejectedAt = HISTORY_NOW;
  const row = (await read(f)).items[0]; assert.equal(row.correlation, 'conflict'); assert.equal(row.reply.state, 'unverified');
});
test('equal timestamps paginate by id and tolerate removal of the boundary record', async () => {
  const f = createHistoryFixture(42); f.messages.forEach(row => { row.createdAt = HISTORY_NOW; });
  const a = await read(f); f.messages.splice(f.messages.findIndex(row => row.id === a.items.at(-1).messageId), 1);
  const b = await read(f, { cursor: a.nextCursor }); assert.equal(new Set([...a.items, ...b.items].map(row => row.messageId)).size, 40);
});
for (const scopePatch of [{ access: { ...historyAccess, organization: { id: 'other' } } }, { access: { ...historyAccess, project: { id: 'other' } } }, { conversationId: 'other' }]) test('foreign scope rejects before message lookup ' + JSON.stringify(scopePatch), async () => {
  const f = createHistoryFixture(); await assert.rejects(read(f, scopePatch), { code: 'INBOX_CONVERSATION_NOT_FOUND' }); assert.equal(f.calls.some(call => call.model === 'message'), false);
});
test('a cursor for another conversation cannot change query scope', async () => {
  const f = createHistoryFixture(), a = await read(f), before = f.calls.length;
  await assert.rejects(read(f, { cursor: a.nextCursor, conversationId: 'other' }), { code: 'WHATSAPP_FLOW_HISTORY_CURSOR_INVALID' }); assert.equal(f.calls.length, before);
});
for (const cursor of ['', '../bad', 'a'.repeat(1025), 'not_a_valid_json_cursor', 4, {}]) test('invalid cursor does not reach storage ' + JSON.stringify(cursor), async () => {
  const f = createHistoryFixture(); await assert.rejects(read(f, { cursor })); assert.equal(f.calls.length, 0);
});
test('client rejects mixed context, wrong page, malformed status or injected private fields', async () => {
  const f = createHistoryFixture(), page = await read(f), row = page.items[0];
  const badRows = [{ ...row, status: 'SUCCESS' }, { ...row, secret: 'private' }, { ...row, messageId: '../bad' }, { ...row, recordedAt: 'today' }, { ...row, reply: { state: 'recorded', recordedAt: null } }, { ...row, correlation: 'conflict', status: 'accepted' }];
  for (const bad of [null, { ...page, context: { ...historyScope, projectId: 'foreign' } }, { ...page, cursor: 'different' }, { ...page, items: [row, row] }, { ...page, observedAt: null }, ...badRows.map(item => ({ ...page, items: [item], nextCursor: null }))]) assert.equal(flowHistoryPageMatches(bad, historyScope), false);
});
test('empty history is explicit and does not create records', async () => { const f = createHistoryFixture(0); const page = await read(f); assert.deepEqual(page.items, []); assert.equal(page.nextCursor, null); assert.equal(f.messages.length, 0); });

for (const providerMessageId of [' ', '   ', '\u00a0', '\twamid.invalid', 'wamid.trailing ', 'wamid.internal space', 123]) test('malformed provider reference is not acceptance: ' + JSON.stringify(providerMessageId), async () => {
  const f = createHistoryFixture(1);
  f.messages[0].providerMessageId = providerMessageId;
  const before = structuredClone([f.messages, f.sessions]);
  const page = await read(f);
  assert.equal(page.items[0].status, 'unknown');
  assert.deepEqual([f.messages, f.sessions], before);
});
