import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedProgressReview, normalizeProgressReviewNote } from '../src/lib/progress-review-policy.js';
const item = { id: 'record-a', revision: 4 };
const options = { item, kind: 'DAILY_LOG', status: 'REJECTED', projectId: 'project-a', note: 'Falta metrado' };
const body = changes => ({ dailyLog: { id: 'record-a', projectId: 'project-a', revision: 5, status: 'REJECTED', rejectionReason: 'Falta metrado', ...changes } });
test('only the expected record version and decision are confirmed', () => {
  const result = body(); assert.equal(confirmedProgressReview(result, options), result.dailyLog);
});
for (const changes of [{ id: 'other' }, { projectId: 'other' }, { revision: 4 }, { revision: 6 }, { status: 'APPROVED' }, { rejectionReason: 'Different' }, { rejectionReason: '' }]) {
  test('mismatched confirmation does not replace local record: ' + JSON.stringify(changes), () => assert.throws(() => confirmedProgressReview(body(changes), options), { code: 'PROGRESS_RESPONSE_UNCONFIRMED' }));
}
for (const value of [null, {}, [], { evidence: {} }, { dailyLog: {} }]) {
  test('incomplete response is not confirmation: ' + JSON.stringify(value), () => assert.throws(() => confirmedProgressReview(value, options), { code: 'PROGRESS_RESPONSE_UNCONFIRMED' }));
}
test('evidence approval verifies its note and source record', () => {
  const expected = { ...options, kind: 'EVIDENCE', status: 'APPROVED', note: 'Revisado' };
  const evidence = { id: item.id, projectId: 'project-a', status: 'APPROVED', revision: 5, reviewNote: 'Revisado' };
  assert.equal(confirmedProgressReview({ evidence }, expected), evidence);
  assert.throws(() => confirmedProgressReview({ evidence: { ...evidence, reviewNote: '' } }, expected), { code: 'PROGRESS_RESPONSE_UNCONFIRMED' });
});
test('empty optional evidence note and no-note submission remain valid', () => {
  assert.equal(normalizeProgressReviewNote('EVIDENCE', 'APPROVED', ''), null);
  assert.equal(normalizeProgressReviewNote('DAILY_LOG', 'SUBMITTED', null), null);
});
test('policy refuses unknown operation type and status', () => {
  assert.throws(() => normalizeProgressReviewNote('OTHER', 'REJECTED', 'Motivo'));
  assert.throws(() => normalizeProgressReviewNote('DAILY_LOG', 'DRAFT', 'Motivo'));
});
