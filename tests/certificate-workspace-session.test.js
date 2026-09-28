import assert from 'node:assert/strict';
import test from 'node:test';
import { certificatePeriodForDate, certificateSnapshotMatches, certificateReceiptMatches, certificateFailureIsUncertain, certificateFailureMessage } from '../src/lib/certificate-workspace-session.js';
import { fixtureSnapshot, fixtureReceipt, scope, PREPARER, CERTIFIER, HASH, DATE } from '../scripts/lib/certificate-workspace-fixture.mjs';

test('civil fortnight preserves leap-day and month boundaries', () => {
  assert.deepEqual(certificatePeriodForDate('2024-02-29'), { start: '2024-02-16', end: '2024-02-29' });
  assert.deepEqual(certificatePeriodForDate('2026-09-15'), { start: '2026-09-01', end: '2026-09-15' });
  for (const value of ['2026-02-30', '2026-09-31', '', '2026-1-1', null]) assert.equal(certificatePeriodForDate(value), null);
});
for (const [state, actor] of [['READY', PREPARER], ['PENDING', PREPARER], ['PENDING', CERTIFIER], ['APPROVED', CERTIFIER]]) {
  test(`accepts verified ${state} snapshot for ${actor}`, () => {
    assert.equal(certificateSnapshotMatches(fixtureSnapshot(state, actor), scope, DATE, actor), true);
  });
}
for (const [name, change] of [
  ['another organization', value => { value.organizationId = 'other'; }],
  ['another project', value => { value.projectId = 'other'; }],
  ['another period', value => { value.requestedPeriod = { start: '2026-09-01', end: '2026-09-15' }; }],
  ['missing capability', value => { delete value.capabilities.approve; }],
  ['revoked read', value => { value.capabilities.read.allowed = false; }],
  ['foreign prepare actor', value => { value.capabilities.prepare.expectedActorMembershipId = 'other'; }],
  ['invalid money', value => { value.candidate.totals.certificateIncrementGrossMinor = 3125000; }],
  ['missing lines', value => { delete value.candidate.lines; }],
  ['incoherent revision', value => { value.candidate.expectedBookRevision = 9; }],
  ['payment authority', value => { value.executionAllowed = true; }],
]) {
  test(`rejects ${name}`, () => {
    const snapshot = structuredClone(fixtureSnapshot()); change(snapshot);
    assert.equal(certificateSnapshotMatches(snapshot, scope, DATE, PREPARER), false);
  });
}
const prepare = { kind: 'PREPARE', periodDate: DATE, body: { expectedBookRevision: 0, expectedPeriodHeadRevision: 0 } };
const decision = { kind: 'APPROVE', periodDate: DATE, certificateId: 'certificate-test',
  body: { expectedBookRevision: 1, expectedPeriodHeadRevision: 1, expectedCertificateDigest: HASH, reason: 'Conformidad contractual verificada.' } };
for (const attempt of [prepare, decision]) {
  test(`validates ${attempt.kind} receipt and exact replay`, () => {
    const actor = attempt.kind === 'PREPARE' ? PREPARER : CERTIFIER;
    for (const replay of [true, false]) assert.equal(certificateReceiptMatches(fixtureReceipt(attempt.kind, attempt.body, actor, replay), attempt, actor), true);
  });
}
for (const [name, change] of [
  ['actor', value => { value.receipt.actorMembershipId = 'other'; }],
  ['operation', value => { value.receipt.operationKind = 'CANCEL'; }],
  ['version', value => { value.certificate.id = 'other'; }],
  ['revision', value => { value.receipt.bookRevisionAfter = 999; }],
  ['digest', value => { value.certificate.integrityDigest = 'b'.repeat(64); }],
  ['decision', value => { value.decision.decision = 'REJECTED'; }],
  ['reason', value => { value.decision.reason = 'Another decision'; }],
]) {
  test(`rejects mismatched receipt ${name}`, () => {
    const value = fixtureReceipt(decision.kind, decision.body, CERTIFIER); change(value);
    assert.equal(certificateReceiptMatches(value, decision, CERTIFIER), false);
  });
}
test('an HTTP 200 without a receipt cannot confirm an operation', () => {
  for (const value of [{}, null, { receipt: { replayed: false } }]) assert.equal(certificateReceiptMatches(value, prepare, PREPARER), false);
});
test('uncertainty does not use raw transport errors as operator copy', () => {
  for (const status of [undefined, 408, 425, 429, 500, 503]) assert.equal(certificateFailureIsUncertain({ status }), true);
  for (const status of [400, 401, 403, 409, 422]) assert.equal(certificateFailureIsUncertain({ status }), false);
  assert.doesNotMatch(certificateFailureMessage({ message: 'postgres://private:secret@db' }, true), /postgres|secret/);
});
