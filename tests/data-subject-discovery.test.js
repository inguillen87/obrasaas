import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  buildWorkerPersonDiscoveryManifest,
  dataSubjectManifestSha256,
  discoverWorkerPersonData,
  PRIVACY_DISCOVERY_CATALOG_SHA256,
  PRIVACY_DISCOVERY_CATALOG_VERSION,
  privacyDiscoveryCatalogDescriptor,
  privacyOperationKeyHash,
  resolvePrivacyDiscoveryKeyConfig,
} from '../src/lib/privacy-discovery.js';

const KEY = crypto.randomBytes(32);
const KEY_ID = 'privacy-discovery-test-v1';
const OBSERVED_AT = new Date('2026-07-29T18:10:11.123Z');

function emptyRows() {
  return new Map(
    privacyDiscoveryCatalogDescriptor().records.map((entry) => [entry.family, []]),
  );
}

function manifest(overrides = {}) {
  const rowsByFamily = emptyRows();
  rowsByFamily.set('worker-person', [{
    id: 'person-secret-id',
    recordVersion: '2026-07-29T18:00:00.000Z',
  }]);
  rowsByFamily.set('worker-channel-identities', [{
    id: 'channel-secret-id',
    recordVersion: '2026-07-29T18:01:00.000Z',
  }]);
  return buildWorkerPersonDiscoveryManifest({
    organizationId: 'organization-a',
    requestId: 'request-a',
    requestOperationKeyHash: 'a'.repeat(64),
    requestFingerprint: 'b'.repeat(64),
    sealedByMembershipId: 'membership-admin-a',
    sourceSnapshotAt: OBSERVED_AT,
    rowsByFamily,
    key: KEY,
    keyId: KEY_ID,
    ...overrides,
  });
}

test('privacy discovery catalog is integrity-bound and excludes executable SQL from its public descriptor', () => {
  const descriptor = privacyDiscoveryCatalogDescriptor();
  assert.equal(descriptor.version, PRIVACY_DISCOVERY_CATALOG_VERSION);
  assert.match(PRIVACY_DISCOVERY_CATALOG_SHA256, /^[a-f0-9]{64}$/);
  assert.ok(descriptor.records.length >= 9);
  assert.ok(descriptor.blockers.length >= 6);
  for (const entry of descriptor.records) {
    assert.match(entry.querySha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(entry, 'sql'), false);
  }
});

test('dedicated discovery key configuration is fail-closed and versioned', () => {
  assert.throws(
    () => resolvePrivacyDiscoveryKeyConfig({}),
    { code: 'PRIVACY_DISCOVERY_UNAVAILABLE', status: 503 },
  );
  assert.throws(
    () => resolvePrivacyDiscoveryKeyConfig({
      PRIVACY_DISCOVERY_FINGERPRINT_KEY_ID: KEY_ID,
      PRIVACY_DISCOVERY_FINGERPRINT_SECRET: Buffer.from('short').toString('base64url'),
    }),
    { code: 'PRIVACY_DISCOVERY_UNAVAILABLE', status: 503 },
  );
  const resolved = resolvePrivacyDiscoveryKeyConfig({
    PRIVACY_DISCOVERY_FINGERPRINT_KEY_ID: KEY_ID,
    PRIVACY_DISCOVERY_FINGERPRINT_SECRET: KEY.toString('base64url'),
  });
  assert.equal(resolved.keyId, KEY_ID);
  assert.deepEqual(resolved.key, KEY);
});

test('request idempotency commitments remain stable across fingerprint-key rotation', () => {
  const first = privacyOperationKeyHash('organization-a', 'privacy-request-0001');
  const second = privacyOperationKeyHash('organization-a', 'privacy-request-0001');
  assert.equal(second, first);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(
    privacyOperationKeyHash('organization-b', 'privacy-request-0001'),
    first,
  );
});

test('manifest is deterministic, blocked on incomplete coverage and contains no source identifiers', () => {
  const first = manifest();
  const second = manifest();
  assert.deepEqual(second, first);
  assert.equal(first.manifest.outcome, 'BLOCKED');
  assert.equal(first.manifest.blockerCount, first.items.length);
  assert.equal(first.manifest.itemCount, first.items.length);
  assert.equal(first.manifest.operationKeyHash, 'a'.repeat(64));
  assert.match(first.manifest.manifestSha256, /^[a-f0-9]{64}$/);
  assert.ok(first.items.some((item) => item.kind === 'RECORD'));
  assert.ok(first.items.some((item) => item.kind === 'COVERAGE_BLOCKER'));
  for (const item of first.items.filter((entry) => entry.kind === 'RECORD')) {
    assert.equal(item.fingerprintKeyId, KEY_ID);
    assert.match(item.locatorFingerprintHmac, /^[a-f0-9]{64}$/);
    assert.match(item.recordFingerprintHmac, /^[a-f0-9]{64}$/);
    assert.equal(item.disposition, 'REVIEW_REQUIRED');
    assert.equal(item.blockerCode, 'LEGAL_CLASSIFICATION_REQUIRED');
  }
  const serialized = JSON.stringify(first);
  for (const sourceValue of ['person-secret-id', 'channel-secret-id']) {
    assert.equal(serialized.includes(sourceValue), false);
  }
});

test('manifest hash binds every item field and canonical order', () => {
  const result = manifest();
  const reversed = [...result.items].reverse();
  assert.equal(
    dataSubjectManifestSha256(result.manifest, reversed),
    result.manifest.manifestSha256,
  );
  const changed = result.items.map((item, index) => (
    index === 0 ? { ...item, blockerCode: 'A_DIFFERENT_BLOCKER' } : item
  ));
  assert.notEqual(
    dataSubjectManifestSha256(result.manifest, changed),
    result.manifest.manifestSha256,
  );
});

test('source discovery declares a read-only transaction before bounded SELECT-only catalog queries', async () => {
  const calls = [];
  const descriptor = privacyDiscoveryCatalogDescriptor();
  const transaction = {
    async $executeRawUnsafe(sql) {
      calls.push({ kind: 'execute', sql });
      return 0;
    },
    async $queryRawUnsafe(sql, ...args) {
      calls.push({ kind: 'query', sql, args });
      if (/statement_timestamp/i.test(sql)) return [{ observedAt: OBSERVED_AT }];
      if (/FROM "WorkerPerson"/i.test(sql)) {
        return [{ id: 'person-secret-id', recordVersion: '2026-07-29T18:00:00.000Z' }];
      }
      return [];
    },
  };
  const result = await discoverWorkerPersonData(transaction, {
    organizationId: 'organization-a',
    personId: 'person-secret-id',
    requestId: 'request-a',
    requestOperationKeyHash: 'a'.repeat(64),
    requestFingerprint: 'b'.repeat(64),
    sealedByMembershipId: 'membership-admin-a',
    key: KEY,
    keyId: KEY_ID,
    familyLimit: 10,
  });
  assert.equal(calls[0].kind, 'execute');
  assert.match(calls[0].sql, /^SET TRANSACTION READ ONLY$/i);
  const sourceQueries = calls.filter((call) => call.kind === 'query').slice(1);
  assert.equal(sourceQueries.length, descriptor.records.length);
  for (const call of sourceQueries) {
    assert.match(call.sql.trim(), /^SELECT/i);
    assert.doesNotMatch(call.sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    assert.deepEqual(call.args, ['organization-a', 'person-secret-id', 11]);
  }
  assert.equal(result.manifest.outcome, 'BLOCKED');
  assert.equal(JSON.stringify(result).includes('person-secret-id'), false);
});
