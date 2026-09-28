import assert from 'node:assert/strict';
import test from 'node:test';
import {
  certificateCapabilityLabel,
  certificateSnapshotSummary,
  formatCertificateMinor,
  majorToCertificateMinor,
} from '../src/lib/certificate-workspace-view.js';

test('minor units render without Number precision loss', () => {
  assert.equal(formatCertificateMinor('3125000', 'ARS', 2), 'ARS 31.250,00');
  assert.equal(formatCertificateMinor('9223372036854775807', 'USD', 2), 'USD 92.233.720.368.547.758,07');
  assert.equal(formatCertificateMinor('bad', 'ARS', 2), 'ARS —');
});

test('major input converts exactly to positive minor units', () => {
  assert.equal(majorToCertificateMinor('12,34', 2), '1234');
  assert.equal(majorToCertificateMinor('12.3', 2), '1230');
  assert.equal(majorToCertificateMinor('0.01', 2), '1');
  assert.equal(majorToCertificateMinor('0', 2), null);
  assert.equal(majorToCertificateMinor('1.234', 2), null);
  assert.equal(majorToCertificateMinor('1e3', 2), null);
});

test('snapshot summary does not invent absent certificate state', () => {
  assert.deepEqual(
    certificateSnapshotSummary({ readiness: { state: 'READY', mode: 'FIRST' }, history: [], candidate: { id: 'candidate' } }),
    { readiness: 'READY', mode: 'FIRST', history: 0, current: null, pending: null, candidate: { id: 'candidate' } },
  );
  assert.deepEqual(certificateSnapshotSummary(null), {
    readiness: 'BLOCKED', mode: null, history: 0, current: null, pending: null, candidate: null,
  });
});

test('capability labels distinguish allowed and denied reasons', () => {
  assert.equal(certificateCapabilityLabel({ allowed: true, reasonCode: null }), 'Habilitada');
  assert.match(certificateCapabilityLabel({ allowed: false, reasonCode: 'CERT_CERTIFIER_REQUIRED' }), /certificador/);
  assert.equal(certificateCapabilityLabel({ allowed: false, reasonCode: 'UNKNOWN' }), 'No habilitada');
});
