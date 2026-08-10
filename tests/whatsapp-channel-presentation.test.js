import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWhatsAppChannelHealthMetadata } from '../src/lib/whatsapp/channel-health.js';
import {
  WHATSAPP_CHANNEL_PRESENTATION_STATES,
  deriveWhatsAppChannelPresentation,
} from '../src/lib/whatsapp/channel-presentation.js';

const NOW = new Date('2026-08-10T20:00:00.000Z');
const ENV = Object.freeze({
  NEXT_PUBLIC_APP_URL: 'https://preview.obrasaas.test',
  NEXT_PUBLIC_META_APP_ID: 'public-app-id',
  META_APP_SECRET: 'meta-secret',
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: 'signup-config',
  META_VERIFY_TOKEN: 'verify-secret',
  WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'encryption-secret',
});

function verifiedMetadata(expiresAt = 0) {
  return buildWhatsAppChannelHealthMetadata({}, {
    expiresAt,
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    subscribed: true,
    phoneStatus: 'CONNECTED',
    verificationStatus: 'VERIFIED',
    qualityRating: 'GREEN',
  }, { now: NOW });
}

function connection(overrides = {}) {
  return {
    enabled: true,
    connectionStatus: 'CONNECTED',
    lastError: null,
    metadata: verifiedMetadata(),
    ...overrides,
  };
}

test('compact channel states are stable and frozen', () => {
  assert.equal(Object.isFrozen(WHATSAPP_CHANNEL_PRESENTATION_STATES), true);
  assert.deepEqual(WHATSAPP_CHANNEL_PRESENTATION_STATES, {
    NOT_CONFIGURED: 'NOT_CONFIGURED',
    DISABLED: 'DISABLED',
    PENDING: 'PENDING',
    CONNECTED: 'CONNECTED',
    ATTENTION: 'ATTENTION',
  });
});

test('only a verified account and webhook are presented as connected', () => {
  const presentation = deriveWhatsAppChannelPresentation(connection(), {
    env: ENV,
    now: NOW,
  });
  assert.deepEqual(presentation, {
    state: 'CONNECTED',
    label: 'WhatsApp verificado',
    summary: 'La cuenta y el webhook están verificados.',
    tone: 'connected',
    linked: true,
    connected: true,
    requiresAttention: false,
  });
});

test('an expired timestamp makes a raw CONNECTED row require attention', () => {
  const expiredAt = Math.floor(new Date('2026-08-10T19:59:59.000Z').getTime() / 1_000);
  const presentation = deriveWhatsAppChannelPresentation(connection({
    metadata: verifiedMetadata(expiredAt),
  }), { env: ENV, now: NOW });

  assert.equal(presentation.state, 'ATTENTION');
  assert.equal(presentation.connected, false);
  assert.equal(presentation.requiresAttention, true);
  assert.equal(presentation.label, 'WhatsApp requiere atención');
});

test('unknown evidence is pending and disabled connections stay distinct', () => {
  const pending = deriveWhatsAppChannelPresentation(connection({ metadata: {} }), {
    env: ENV,
    now: NOW,
  });
  assert.equal(pending.state, 'PENDING');
  assert.equal(pending.connected, false);

  const disabled = deriveWhatsAppChannelPresentation(connection({
    enabled: false,
    connectionStatus: 'DISABLED',
  }), { env: ENV, now: NOW });
  assert.equal(disabled.state, 'DISABLED');
  assert.equal(disabled.requiresAttention, false);

  assert.equal(deriveWhatsAppChannelPresentation(null, { env: ENV, now: NOW }).state, 'NOT_CONFIGURED');
});

test('the compact projection never returns metadata, identifiers or provider errors', () => {
  const presentation = deriveWhatsAppChannelPresentation(connection({
    lastError: 'provider-error-with-sensitive-detail',
    phoneNumberId: 'sensitive-phone-id',
    whatsappBusinessId: 'sensitive-waba-id',
  }), { env: ENV, now: NOW });
  const serialized = JSON.stringify(presentation);

  assert.equal(serialized.includes('sensitive-phone-id'), false);
  assert.equal(serialized.includes('sensitive-waba-id'), false);
  assert.equal(serialized.includes('provider-error-with-sensitive-detail'), false);
  assert.equal(Object.hasOwn(presentation, 'readiness'), false);
});
