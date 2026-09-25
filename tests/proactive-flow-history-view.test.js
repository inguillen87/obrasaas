import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFlowHistoryView, normalizeFlowHistoryQuery, flowHistoryTitle, FLOW_HISTORY_SEARCH_LIMIT } from '../src/lib/whatsapp/proactive-flow-history-view.js';
const item = (id, patch = {}) => ({ messageId: id, blueprintKey: 'incident-report', body: 'Revisión de hormigón en sector norte', recordedAt: '2026-09-24T11:00:00.000Z', status: 'accepted', correlation: 'verified', reply: { state: 'not_recorded', recordedAt: null }, expiresAt: '2026-09-24T13:00:00.000Z', riskDecision: false, ...patch });
const page = items => ({ context: { organizationId: 'org-a', projectId: 'project-a', conversationId: 'chat-a' }, cursor: null, nextCursor: null, pageSize: 20, observedAt: '2026-09-24T12:00:00.000Z', items });
const records = () => [item('record-a'), item('record-b', { body: 'Control de ingreso', blueprintKey: 'shift-check-in', reply: { state: 'recorded', recordedAt: '2026-09-24T11:30:00.000Z' } }), item('record-c', { expiresAt: '2026-09-24T11:30:00.000Z' }), item('record-d', { status: 'unknown' })];
for (const query of ['hormigon', 'HORMIGÓN', '  revision   NORTE ', 'norte hormigon', 'revisio\u0301n']) test('literal accent-insensitive search: ' + query, () => {
  const result = buildFlowHistoryView(page(records()), { query });
  assert.deepEqual(result.items.map(row => row.messageId), ['record-a', 'record-c', 'record-d']);
});
test('type and exact record search use only the displayed fields', () => {
  assert.deepEqual(buildFlowHistoryView(page(records()), { query: 'fichaje' }).items.map(row => row.messageId), ['record-b']);
  assert.deepEqual(buildFlowHistoryView(page(records()), { query: 'record-c' }).items.map(row => row.messageId), ['record-c']);
});
test('all query words are required, independent of their order', () => {
  assert.equal(buildFlowHistoryView(page(records()), { query: 'norte ingreso' }).items.length, 0);
  assert.equal(buildFlowHistoryView(page(records()), { query: 'record-a norte' }).items.length, 1);
});
for (const query of ['.*', '[a-z]', '(norte)', '<script>']) test('search does not execute or interpret ' + query, () => {
  assert.equal(buildFlowHistoryView(page(records()), { query }).items.length, 0);
});
test('match beyond the input length limit is still found in allowed message body', () => {
  const p = page([item('long-body', { body: 'x'.repeat(200) + ' última columna' })]);
  assert.equal(buildFlowHistoryView(p, { query: 'ultima columna' }).items.length, 1);
});
test('empty and whitespace search preserve all eligible records', () => {
  for (const query of ['', '  \t ', null, 7, {}]) assert.equal(buildFlowHistoryView(page(records()), { query }).items.length, 4);
});
test('query is bounded without coercing objects to strings', () => {
  assert.equal(normalizeFlowHistoryQuery('a'.repeat(400)).length, FLOW_HISTORY_SEARCH_LIMIT);
  assert.equal(normalizeFlowHistoryQuery({ toString: () => { throw Error('Do not coerce'); } }), '');
});
test('attention ordering groups follow-up needs and preserves server order within each group', () => {
  const rows = records(); rows.push(item('record-e', { status: 'failed' }));
  assert.deepEqual(buildFlowHistoryView(page(rows), { order: 'attention' }).items.map(row => row.messageId), ['record-d', 'record-e', 'record-c', 'record-a', 'record-b']);
});
test('recent order preserves the supplied keyset order, not browser dates', () => {
  const p = page(records());
  assert.deepEqual(buildFlowHistoryView(p).items, p.items);
  assert.deepEqual(buildFlowHistoryView(p, { order: 'unexpected' }).items, p.items);
});
test('search and category combine but counts remain page-scoped', () => {
  const result = buildFlowHistoryView(page(records()), { query: 'hormigon', filter: 'waiting', order: 'attention' });
  assert.deepEqual(result.items.map(row => row.messageId), ['record-a']);
  assert.deepEqual(result.counts, { all: 4, attention: 1, expired: 1, waiting: 1, responded: 1 });
  assert.equal(result.categoryCount, 1); assert.equal(result.pageCount, 4);
});
test('priority never implies approval or changes provider state', () => {
  const p = page(records()), before = structuredClone(p);
  for (const order of ['recent', 'attention']) for (const filter of ['all', 'waiting', 'attention', 'expired', 'responded']) buildFlowHistoryView(p, { order, filter, query: 'norte' });
  assert.deepEqual(p, before);
});
test('hidden or unrecognized fields are not a search index and invalidate the page', () => {
  const p = page([item('a', { recipient: 'PRIVATE_PHONE_CANARY' })]);
  const result = buildFlowHistoryView(p, { query: 'PRIVATE_PHONE_CANARY' });
  assert.equal(result.available, false); assert.deepEqual(result.items, []);
});
test('invalid pages are unavailable, distinct from zero search matches', () => {
  for (const p of [null, {}, page(null), page([item('a'), item('a')]), { ...page(records()), observedAt: 'bad' }]) {
    const result = buildFlowHistoryView(p, { query: 'norte' });
    assert.equal(result.available, false); assert.equal(result.counts, null);
  }
  const result = buildFlowHistoryView(page(records()), { query: 'ninguna coincidencia' });
  assert.equal(result.available, true); assert.equal(result.items.length, 0); assert.equal(result.pageCount, 4);
});
test('empty page stays available with exact zero counts', () => {
  const result = buildFlowHistoryView(page([]), { query: 'algo', order: 'attention' });
  assert.equal(result.available, true); assert.equal(result.items.length, 0); assert.equal(result.counts.all, 0);
});
test('unknown titles do not masquerade as a known business process', () => {
  assert.equal(flowHistoryTitle('incident-report'), 'Incidencia de obra');
  assert.equal(flowHistoryTitle('shift-check-in'), 'Fichaje y seguridad');
  for (const key of ['other', '__proto__', 'constructor', null]) assert.equal(flowHistoryTitle(key), 'Formulario');
});
