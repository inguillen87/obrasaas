import assert from 'node:assert/strict';
import test from 'node:test';
import { progressReviewAttachmentHref } from '../src/lib/progress-review-policy.js';
const item = { id: 'evidence-1', attachment: { available: true, restricted: false, href: '/api/progress/evidence-1/attachment' } };
test('review links only to the exact available private attachment', () => {
  assert.equal(progressReviewAttachmentHref(item), '/api/progress/evidence-1/attachment');
});
for (const href of ['https://other.test/file', '//other.test/file', '/api/progress/other/attachment', '/dashboard', 'javascript:alert(1)']) {
  test('unexpected attachment path rejected: ' + href, () => assert.equal(progressReviewAttachmentHref({ ...item, attachment: { ...item.attachment, href } }), null));
}
test('restricted and unavailable evidence does not expose a link', () => {
  assert.equal(progressReviewAttachmentHref({ ...item, attachment: { ...item.attachment, restricted: true } }), null);
  assert.equal(progressReviewAttachmentHref({ ...item, attachment: { ...item.attachment, available: false } }), null);
  assert.equal(progressReviewAttachmentHref(null), null);
});
test('WhatsApp source uses only its explicitly authorized message identity', () => {
  const source = { messageId: 'msg-A' };
  const evidence = { ...item, source, attachment: { ...item.attachment, href: '/api/evidence/msg-A' } };
  assert.equal(progressReviewAttachmentHref(evidence), '/api/evidence/msg-A');
  assert.equal(progressReviewAttachmentHref({ ...evidence, source: {} }), null);
});
