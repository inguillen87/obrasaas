import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_PROCESSING_DISCLOSURE_VERSION,
  buildTenantAiSettingsUpdate,
  publicTenantAiSettings,
  TenantAiSettingsConflictError,
  TenantAiSettingsInputError,
  tenantAiSettingsFromMetadata,
} from '../src/lib/ai/tenant-settings.js';

const NOW = new Date('2026-07-26T18:00:00.000Z');

test('AI processing is fail-closed without a current attributed attestation', () => {
  assert.deepEqual(publicTenantAiSettings({}), {
    supervisorEnabled: false,
    audioTranscriptionEnabled: false,
    visualProgressEnabled: false,
    disclosureVersion: null,
    disclosureCurrent: false,
    authorizationAttestedAt: null,
    updatedAt: null,
    revision: 0,
  });
  assert.equal(tenantAiSettingsFromMetadata({
    aiProcessing: {
      supervisorEnabled: true,
      audioTranscriptionEnabled: true,
      visualProgressEnabled: true,
      disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
      authorizationAttestedAt: NOW.toISOString(),
    },
  }).supervisorEnabled, false);
});

test('an admin can explicitly attest and enable each AI processing purpose', () => {
  const stored = buildTenantAiSettingsUpdate({
    supervisorEnabled: true,
    audioTranscriptionEnabled: false,
    visualProgressEnabled: true,
    organizationAuthorizationConfirmed: true,
    expectedRevision: 0,
  }, {}, { actorId: 'user-admin', now: NOW });

  assert.deepEqual(stored, {
    supervisorEnabled: true,
    audioTranscriptionEnabled: false,
    visualProgressEnabled: true,
    disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
    authorizationAttestedAt: NOW.toISOString(),
    authorizationAttestedBy: 'user-admin',
    updatedAt: NOW.toISOString(),
    updatedBy: 'user-admin',
    revision: 1,
  });
  assert.equal(tenantAiSettingsFromMetadata({ aiProcessing: stored }).supervisorEnabled, true);
  assert.equal(
    tenantAiSettingsFromMetadata({ aiProcessing: stored }).audioTranscriptionEnabled,
    false,
  );
  assert.equal(
    tenantAiSettingsFromMetadata({ aiProcessing: stored }).visualProgressEnabled,
    true,
  );
});

test('enabling a purpose requires an explicit organization authorization attestation', () => {
  assert.throws(
    () => buildTenantAiSettingsUpdate({
      supervisorEnabled: false,
      audioTranscriptionEnabled: true,
      visualProgressEnabled: false,
      expectedRevision: 0,
    }, {}, { actorId: 'user-admin', now: NOW }),
    (error) => (
      error instanceof TenantAiSettingsInputError
      && error.code === 'AI_ORGANIZATION_AUTHORIZATION_REQUIRED'
    ),
  );
});

test('disabling processing does not manufacture a new authorization attestation', () => {
  const existing = {
    aiProcessing: {
      supervisorEnabled: true,
      audioTranscriptionEnabled: true,
      visualProgressEnabled: true,
      disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
      authorizationAttestedAt: '2026-07-16T12:00:00.000Z',
      authorizationAttestedBy: 'original-admin',
    },
  };
  const stored = buildTenantAiSettingsUpdate({
    supervisorEnabled: false,
    audioTranscriptionEnabled: false,
    visualProgressEnabled: false,
    expectedRevision: 0,
  }, existing, { actorId: 'second-admin', now: NOW });

  assert.equal(stored.authorizationAttestedAt, '2026-07-16T12:00:00.000Z');
  assert.equal(stored.authorizationAttestedBy, 'original-admin');
  assert.equal(stored.updatedBy, 'second-admin');
});

test('unknown fields and unchanged updates are rejected', () => {
  assert.throws(
    () => buildTenantAiSettingsUpdate({
      supervisorEnabled: false,
      audioTranscriptionEnabled: false,
      visualProgressEnabled: false,
      consent: true,
      expectedRevision: 0,
    }, {}, { actorId: 'user-admin', now: NOW }),
    (error) => error.code === 'AI_SETTINGS_UNKNOWN_FIELD',
  );
  assert.throws(
    () => buildTenantAiSettingsUpdate({
      supervisorEnabled: false,
      audioTranscriptionEnabled: false,
      visualProgressEnabled: false,
      expectedRevision: 0,
    }, {}, { actorId: 'user-admin', now: NOW }),
    (error) => error.code === 'AI_SETTINGS_UNCHANGED',
  );
});

test('updates require an exact public revision and increment it atomically', () => {
  const current = {
    aiProcessing: {
      supervisorEnabled: true,
      audioTranscriptionEnabled: false,
      visualProgressEnabled: false,
      disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
      authorizationAttestedAt: '2026-07-16T12:00:00.000Z',
      authorizationAttestedBy: 'original-admin',
      updatedAt: '2026-07-16T12:00:00.000Z',
      revision: 4,
    },
  };

  assert.equal(publicTenantAiSettings(current).revision, 4);
  assert.throws(
    () => buildTenantAiSettingsUpdate({
      supervisorEnabled: false,
      audioTranscriptionEnabled: false,
      visualProgressEnabled: false,
      expectedRevision: 3,
    }, current, { actorId: 'stale-admin', now: NOW }),
    (error) => (
      error instanceof TenantAiSettingsConflictError
      && error.code === 'AI_SETTINGS_CONFLICT'
      && error.currentSettings.revision === 4
      && error.currentSettings.supervisorEnabled === true
    ),
  );

  const stored = buildTenantAiSettingsUpdate({
    supervisorEnabled: false,
    audioTranscriptionEnabled: false,
    visualProgressEnabled: false,
    expectedRevision: 4,
  }, current, { actorId: 'current-admin', now: NOW });
  assert.equal(stored.revision, 5);
});

test('missing, coerced, negative, and unsafe revisions are rejected', () => {
  for (const expectedRevision of [undefined, '0', -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => buildTenantAiSettingsUpdate({
        supervisorEnabled: true,
        audioTranscriptionEnabled: false,
        visualProgressEnabled: false,
        organizationAuthorizationConfirmed: true,
        ...(expectedRevision === undefined ? {} : { expectedRevision }),
      }, {}, { actorId: 'user-admin', now: NOW }),
      (error) => (
        error instanceof TenantAiSettingsInputError
        && error.code === 'AI_SETTINGS_REVISION_REQUIRED'
      ),
    );
  }
});
