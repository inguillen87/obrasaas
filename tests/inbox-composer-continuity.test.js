import assert from 'node:assert/strict';
import test from 'node:test';
import { createInboxComposerBook, confirmInboxReply, INBOX_DRAFT_LIMIT } from '../src/lib/whatsapp/inbox-composer-book.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
function makeBook() { let sequence = 0; return createInboxComposerBook(scope, () => 'attempt-' + (++sequence)); }
const payload = (attempt, status = 'accepted', extra = {}) => ({ context: { organizationId: attempt.organizationId, projectId: attempt.projectId, conversationId: attempt.conversationId, idempotencyKey: attempt.idempotencyKey }, message: { id: 'message-a', direction: 'OUTBOUND', status }, ...extra });
test('drafts remain attached to their conversation, not the selected contact', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto A'); book.edit('chat-b', 'Texto B');
  assert.equal(book.get('chat-a').draft, 'Texto A'); assert.equal(book.get('chat-b').draft, 'Texto B');
  assert.equal(book.get('chat-c').draft, '');
});
test('an unknown conversation cannot obtain prototype properties', () => {
  const book = makeBook(); assert.equal(book.get('constructor').draft, ''); assert.equal(book.get('toString').draft, '');
});
test('another company, project or instance cannot inherit the draft map', () => {
  const first = makeBook(); first.edit('chat-a', 'Privado');
  for (const second of [makeBook(), createInboxComposerBook({ ...scope, projectId: 'project-b' }), createInboxComposerBook({ ...scope, organizationId: 'org-b' })]) assert.equal(second.get('chat-a').draft, '');
});
test('late acceptance settles only the original conversation', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto A'); const attempt = book.begin('chat-a'); book.edit('chat-b', 'Texto B');
  book.settle(attempt, confirmInboxReply(payload(attempt), attempt));
  assert.equal(book.get('chat-a').draft, ''); assert.equal(book.get('chat-a').receipt.status, 'ACCEPTED');
  assert.equal(book.get('chat-b').draft, 'Texto B'); assert.equal(book.get('chat-b').receipt, null);
});
test('synchronous duplicate clicks create only one attempt', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto'); const attempt = book.begin('chat-a');
  assert.ok(attempt); assert.equal(book.begin('chat-a'), null); assert.equal(book.get('chat-a').attempt, attempt);
});
test('uncertain attempt preserves exact key and body across chat switches', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto A'); const attempt = book.begin('chat-a');
  book.fail(attempt, new TypeError('network failure')); book.edit('chat-b', 'Texto B');
  assert.equal(book.edit('chat-a', 'Texto alterado'), false); assert.equal(book.discard('chat-a'), false); assert.equal(book.begin('chat-a'), null);
  const retry = book.begin('chat-a', { reconcileUnknown: true }); assert.equal(retry, attempt); assert.equal(retry.body, 'Texto A');
});
for (const status of ['prepared','sending','unknown']) test('nonterminal status is never treated as sent: ' + status, () => {
  const book = makeBook(); book.edit('chat-a', 'Parte'); const attempt = book.begin('chat-a'); book.settle(attempt, confirmInboxReply(payload(attempt, status), attempt));
  assert.equal(book.get('chat-a').draft, 'Parte'); assert.equal(book.get('chat-a').resolution, 'UNKNOWN'); assert.equal(book.get('chat-a').attempt.idempotencyKey, attempt.idempotencyKey);
});
for (const status of ['accepted','sent','delivered','read']) test('precise confirmed state retained: ' + status, () => {
  const book = makeBook(); book.edit('chat-a', 'Texto'); const attempt = book.begin('chat-a'); book.settle(attempt, confirmInboxReply(payload(attempt, status), attempt));
  assert.equal(book.get('chat-a').draft, ''); assert.equal(book.get('chat-a').receipt.status, status.toUpperCase());
});
test('failed delivery needs an explicit new attempt with a different key', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto'); const attempt = book.begin('chat-a'); book.settle(attempt, confirmInboxReply(payload(attempt, 'failed'), attempt));
  assert.equal(book.begin('chat-a'), null); assert.equal(book.get('chat-a').draft, 'Texto');
  const retry = book.begin('chat-a', { asNewAttempt: true }); assert.notEqual(retry.idempotencyKey, attempt.idempotencyKey);
});
for (const status of [401,403,404,409]) test('scope/access conflict blocks resend while preserving text: ' + status, () => {
  const book = makeBook(); book.edit('chat-a', 'Conservar'); const attempt = book.begin('chat-a'); book.fail(attempt, { status });
  assert.equal(book.get('chat-a').resolution, 'BLOCKED'); assert.equal(book.get('chat-a').draft, 'Conservar'); assert.equal(book.begin('chat-a', { reconcileUnknown: true }), null);
});
test('malformed or unrelated acknowledgement is never enough to clear the draft', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto'); const attempt = book.begin('chat-a'), valid = payload(attempt);
  for (const response of [{}, { message: valid.message }, { ...valid, context: { ...valid.context, projectId: 'other' } },
    { ...valid, context: { ...valid.context, organizationId: 'other' } }, { ...valid, context: { ...valid.context, conversationId: 'chat-b' } },
    { ...valid, context: { ...valid.context, idempotencyKey: 'another' } }, { ...valid, message: { ...valid.message, direction: 'INBOUND' } },
    { ...valid, message: { ...valid.message, status: 'made-up' } }, { ...valid, message: { ...valid.message, id: '' } }]) {
    assert.throws(() => confirmInboxReply(response, attempt), { code: 'WHATSAPP_DELIVERY_UNKNOWN' });
  }
  assert.equal(book.get('chat-a').draft, 'Texto');
});
test('a second response for an old attempt cannot erase a later draft', () => {
  const book = makeBook(); book.edit('chat-a', 'Primero'); const attempt = book.begin('chat-a'); const receipt = confirmInboxReply(payload(attempt), attempt);
  book.settle(attempt, receipt); book.edit('chat-a', 'Segundo'); assert.equal(book.settle(attempt, receipt), false); assert.equal(book.get('chat-a').draft, 'Segundo');
});
test('server history can reconcile a known message without retrying the send', () => {
  const book = makeBook(); book.edit('chat-a', 'Texto'); const attempt = book.begin('chat-a'); book.settle(attempt, confirmInboxReply(payload(attempt, 'unknown'), attempt));
  assert.equal(book.reconcile('chat-b', [{ id: 'message-a', direction: 'OUTBOUND', status: 'DELIVERED' }]), false);
  assert.equal(book.reconcile('chat-a', [{ id: 'message-a', direction: 'INBOUND', status: 'DELIVERED' }]), false);
  assert.equal(book.reconcile('chat-a', [{ id: 'message-a', direction: 'OUTBOUND', status: 'DELIVERED' }]), true);
  assert.equal(book.get('chat-a').draft, ''); assert.equal(book.get('chat-a').receipt.status, 'DELIVERED');
});
test('pending draft capacity never silently evicts unfinished work', () => {
  const book = makeBook(); for (let i=0;i<INBOX_DRAFT_LIMIT;i++) book.edit('chat-'+i, 'Texto '+i);
  assert.throws(() => book.edit('one-more', 'Nuevo'), /40 conversaciones/); assert.equal(book.get('chat-0').draft, 'Texto 0');
  assert.equal(book.discard('chat-0'), true); book.edit('one-more','Nuevo'); assert.equal(book.get('one-more').draft,'Nuevo');
});
test('a known receipt advances from accepted to delivered/read but never regresses', () => {
  const book=makeBook();book.edit('chat-a','Texto');const attempt=book.begin('chat-a');book.settle(attempt,confirmInboxReply(payload(attempt),attempt));
  const row={id:'message-a',direction:'OUTBOUND',status:'DELIVERED'};assert.equal(book.reconcile('chat-a',[row]),true);
  assert.equal(book.reconcile('chat-a',[{...row,status:'SENT'}]),false);assert.equal(book.get('chat-a').receipt.status,'DELIVERED');
  assert.equal(book.reconcile('chat-a',[{...row,status:'READ'}]),true);assert.equal(book.get('chat-a').receipt.status,'READ');
});
test('revocation during dispatch blocks late response and any retry without losing the draft', () => {
  const book=makeBook();book.edit('chat-a','Privado');const attempt=book.begin('chat-a');book.block('chat-a');
  assert.equal(book.settle(attempt,confirmInboxReply(payload(attempt),attempt)),false);assert.equal(book.get('chat-a').draft,'Privado');
  assert.equal(book.begin('chat-a',{reconcileUnknown:true}),null);
});
test('subscribers receive an immutable snapshot only when the state changes', () => {
  const book=makeBook();let events=0;const before=book.getSnapshot();const unsubscribe=book.subscribe(()=>events++);
  book.edit('chat-a','Texto');assert.notEqual(book.getSnapshot(),before);assert.equal(events,1);assert.equal(Object.isFrozen(book.get('chat-a')),true);
  unsubscribe();book.edit('chat-b','Otro');assert.equal(events,1);
});
test('invalid content and no-op send cannot create an attempt', () => {
  const book=makeBook();assert.equal(book.begin('empty'),null);assert.throws(()=>book.edit('chat-a','x'.repeat(4097)));
  assert.throws(()=>book.edit('chat-a',{}));assert.throws(()=>book.edit('../other','Texto'));assert.equal(book.get('chat-a').attempt,null);
});
test('late provider rejection updates the receipt without replacing a new draft', () => {
  const book=makeBook();book.edit('chat-a','Primero');const attempt=book.begin('chat-a');book.settle(attempt,confirmInboxReply(payload(attempt),attempt));
  book.edit('chat-a','Otra consulta');assert.equal(book.reconcile('chat-a',[{id:'message-a',direction:'OUTBOUND',status:'FAILED',body:'Primero'}]),true);
  assert.equal(book.get('chat-a').receipt.status,'FAILED');assert.equal(book.get('chat-a').draft,'Otra consulta');assert.equal(book.get('chat-a').resolution,'');
});
test('delivery confirmation cannot leave an obsolete failure retry enabled', () => {
  const book=makeBook();book.edit('chat-a','Texto');const attempt=book.begin('chat-a');book.settle(attempt,confirmInboxReply(payload(attempt,'failed'),attempt));
  assert.equal(book.reconcile('chat-a',[{id:'message-a',direction:'OUTBOUND',status:'DELIVERED',body:'Texto'}]),true);
  assert.equal(book.get('chat-a').draft,'');assert.equal(book.get('chat-a').resolution,'');assert.equal(book.begin('chat-a',{asNewAttempt:true}),null);
});
