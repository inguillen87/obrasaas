import assert from 'node:assert/strict';
import test from 'node:test';
import { evidencePreviewHref, fetchEvidencePreview, EVIDENCE_PREVIEW_MAX_BYTES } from '../src/lib/evidence-viewer-policy.js';
const context = { organizationId: 'org-a', projectId: 'project-a' };
const item = { id: 'ev-a', projectId: 'project-a', attachment: { available: true, restricted: false, kind: 'image', mimeType: 'image/png', size: 4, href: '/api/progress/ev-a/attachment' } };
const response = (bytes = new Uint8Array([1, 2, 3, 4]), headers = {}) => new Response(bytes, { headers: { 'Content-Type': 'image/png', ...headers } });
test('allowed preview is a reference to the exact private resource', () => assert.equal(evidencePreviewHref(item), '/api/progress/ev-a/attachment'));
for (const attachment of [{ restricted: true }, { available: false }, { kind: 'document' }, { mimeType: 'image/svg+xml' }, { href: 'https://other.test/img' }, { href: '//other.test/img' }, { href: '/api/progress/ev-b/attachment' }, { mimeType: 'text/html' }]) {
  test('no preview or fetch for invalid metadata: ' + JSON.stringify(attachment), async () => {
    let calls = 0; const value = { ...item, attachment: { ...item.attachment, ...attachment } };
    assert.equal(evidencePreviewHref(value), null);
    await assert.rejects(fetchEvidencePreview(value, context, { fetchImpl: async () => { calls++; } })); assert.equal(calls, 0);
  });
}
test('context mismatch never reaches network', async () => {
  let calls = 0;
  await assert.rejects(fetchEvidencePreview(item, { ...context, projectId: 'other' }, { fetchImpl: async () => { calls++; } }), { code: 'EVIDENCE_PREVIEW_CONTEXT' });
  assert.equal(calls, 0);
});
test('fetch sends session context without caching and returns bytes', async () => {
  let observed; const controller = new AbortController();
  const blob = await fetchEvidencePreview(item, context, { signal: controller.signal, fetchImpl: async (path, options) => { observed = { path, ...options }; return response(); } });
  assert.equal(observed.path, item.attachment.href); assert.equal(observed.cache, 'no-store'); assert.equal(observed.credentials, 'same-origin');
  assert.equal(observed.redirect, 'error'); assert.equal(observed.signal, controller.signal); assert.equal(observed.headers['X-ObraSaaS-Project'], 'project-a');
  assert.equal(blob.size, 4); assert.equal(blob.type, 'image/png');
});
for (const status of [401, 403, 404, 409, 500]) test('response denies preview: ' + status, async () => {
  await assert.rejects(fetchEvidencePreview(item, context, { fetchImpl: async () => new Response('denied', { status }) }), { code: status === 409 ? 'EVIDENCE_PREVIEW_CONTEXT' : 'EVIDENCE_PREVIEW_UNAVAILABLE' });
});
for (const type of ['text/html', 'image/svg+xml', 'image/jpeg', 'application/pdf']) test('unexpected MIME is not displayed: ' + type, async () => {
  await assert.rejects(fetchEvidencePreview(item, context, { fetchImpl: async () => response(undefined, { 'Content-Type': type }) }), { code: 'EVIDENCE_PREVIEW_TYPE' });
});
test('size metadata rejects before fetching', async () => {
  let calls = 0;
  await assert.rejects(fetchEvidencePreview({ ...item, attachment: { ...item.attachment, size: EVIDENCE_PREVIEW_MAX_BYTES + 1 } }, context, { fetchImpl: async () => { calls++; } }), { code: 'EVIDENCE_PREVIEW_SIZE' });
  assert.equal(calls, 0);
});
test('declared response length is bounded', async () => {
  await assert.rejects(fetchEvidencePreview(item, context, { fetchImpl: async () => response(undefined, { 'Content-Length': String(EVIDENCE_PREVIEW_MAX_BYTES + 1) }) }), { code: 'EVIDENCE_PREVIEW_SIZE' });
});
test('stream size is bounded even without declared length', async () => {
  let canceled = false; const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(EVIDENCE_PREVIEW_MAX_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { canceled = true; } });
  await assert.rejects(fetchEvidencePreview({ ...item, attachment: { ...item.attachment, size: null } }, context, { fetchImpl: async () => new Response(stream, { headers: { 'Content-Type': 'image/png' } }) }), { code: 'EVIDENCE_PREVIEW_SIZE' });
  assert.equal(canceled, true);
});
for (const bytes of [new Uint8Array(), new Uint8Array([1, 2])]) test('incomplete response rejected: ' + bytes.length, async () => {
  await assert.rejects(fetchEvidencePreview(item, context, { fetchImpl: async () => response(bytes) }), { code: 'EVIDENCE_PREVIEW_INCOMPLETE' });
});
test('abort is respected without automatic retries', async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(fetchEvidencePreview(item, context, { signal: controller.signal, fetchImpl: async () => { calls++; return response(); } }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
