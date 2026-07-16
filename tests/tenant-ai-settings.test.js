import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_PROCESSING_DISCLOSURE_VERSION,
  buildTenantAiSettingsUpdate,
  publicTenantAiSettings,
  TenantAiSettingsInputError,
  tenantAiSettingsFromMetadata,
} from '../src/lib/ai/tenant-settings.js';

const NOW = new Date('2026-07-16T18:00:00.000Z');

test('AI processing is fail-closed without a current attributed attestation', () => {
  assert.deepEqual(publicTenantAiSettings({}), {
    supervisorEnabled: false,
    audioTranscriptionEnabled: false,
    disclosureVersion: null,
    disclosureCurrent: false,
    authorizationAttestedAt: null,
    updatedAt: null,
  });
  assert.equal(tenantAiSettingsFromMetadata({
    aiProcessing: {
      supervisorEnabled: true,
      audioTranscriptionEnabled: true,
      disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
      authorizationAttestedAt: NOW.toISOString(),
    },
  }).supervisorEnabled, false);
});

test('an admin can explicitly attest and enable each OpenAI processing purpose', () => {
  const stored = buildTenantAiSettingsUpdate({
    supervisorEnabled: true,
    audioTranscriptionEnabled: false,
    organizationAuthorizationConfirmed: true,
  }, {}, { actorId: 'user-admin', now: NOW });

  assert.deepEqual(stored, {
    supervisorEnabled: true,
    audioTranscriptionEnabled: false,
    disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
    authorizationAttestedAt: NOW.toISOString(),
    authorizationAttestedBy: 'user-admin',
    updatedAt: NOW.toISOString(),
    updatedBy: 'user-admin',
  });
  assert.equal(tenantAiSettingsFromMetadata({ aiProcessing: stored }).supervisorEnabled, true);
  assert.equal(
    tenantAiSettingsFromMetadata({ aiProcessing: stored }).audioTranscriptionEnabled,
    false,
  );
});

test('enabling a purpose requires an explicit organization authorization attestation', () => {
  assert.throws(
    () => buildTenantAiSettingsUpdate({
      supervisorEnabled: false,
      audioTranscriptionEnabled: true,
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
      disclosureVersion: AI_PROCESSING_DISCLOSURE_VERSION,
      authorizationAttestedAt: '2026-07-16T12:00:00.000Z',
      authorizationAttestedBy: 'original-admin',
    },
  };
  const stored = buildTenantAiSettingsUpdate({
    supervisorEnabled: false,
    audioTranscriptionEnabled: false,
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
      consent: true,
    }, {}, { actorId: 'user-admin', now: NOW }),
    (error) => error.code === 'AI_SETTINGS_UNKNOWN_FIELD',
  );
  assert.throws(
    () => buildTenantAiSettingsUpdate({
      supervisorEnabled: false,
      audioTranscriptionEnabled: false,
    }, {}, { actorId: 'user-admin', now: NOW }),
    (error) => error.code === 'AI_SETTINGS_UNCHANGED',
  );
});
