import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWhatsAppChannelHealthFailureMetadata,
  buildWhatsAppChannelHealthMetadata,
  deriveStoredWhatsAppChannelReadiness,
  inspectStoredWhatsAppRemoteHealthEvidence,
  loadWhatsAppChannelHealth,
  WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS,
  whatsAppPlatformConfiguration,
} from '../src/lib/whatsapp/channel-health.js';

const NOW = new Date('2026-07-17T15:00:00.000Z');
const FLOW_ENDPOINT_ID = '11111111-1111-4111-8111-111111111111';
const FLOW_KEY_FINGERPRINT = 'a'.repeat(64);
const ENV = Object.freeze({
  NEXT_PUBLIC_APP_URL: 'https://preview.obrasaas.test',
  NEXT_PUBLIC_META_APP_ID: 'app-public-id',
  META_APP_SECRET: 'app-secret',
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: 'signup-config',
  META_VERIFY_TOKEN: 'webhook-secret',
  WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'encryption-key',
});

function verifiedMetadata(current = {}) {
  return buildWhatsAppChannelHealthMetadata(current, {
    expiresAt: 0,
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    subscribed: true,
    phoneStatus: 'CONNECTED',
    verificationStatus: 'VERIFIED',
    qualityRating: 'GREEN',
  }, { now: NOW });
}

function connection(overrides = {}) {
  return {
    id: 'connection-a',
    phoneNumberId: 'phone-a',
    whatsappBusinessId: 'waba-a',
    enabled: true,
    connectionStatus: 'CONNECTED',
    lastError: null,
    metadata: verifiedMetadata({
      whatsappFlows: { daily_report: { status: 'PUBLISHED' } },
      whatsappFlowEndpoint: {
        id: FLOW_ENDPOINT_ID,
        whatsappBusinessId: 'waba-a',
        phoneNumberId: 'phone-a',
        keyFingerprint: FLOW_KEY_FINGERPRINT,
        keyVersion: 1,
        signatureStatus: 'VALID',
      },
    }),
    flowEndpoint: {
      id: FLOW_ENDPOINT_ID,
      enabled: true,
      keys: [{
        status: 'ACTIVE',
        version: 1,
        publicKeySha256: FLOW_KEY_FINGERPRINT,
        verifiedAt: NOW,
      }],
    },
    ...overrides,
  };
}

test('platform configuration is reduced to booleans without exposing values', () => {
  assert.deepEqual(whatsAppPlatformConfiguration(ENV), {
    publicAppUrlConfigured: true,
    publicAppUrlStatus: 'CONFIGURED',
    appIdConfigured: true,
    appSecretConfigured: true,
    embeddedSignupConfigConfigured: true,
    webhookVerifyTokenConfigured: true,
    credentialEncryptionConfigured: true,
  });
  assert.equal(JSON.stringify(whatsAppPlatformConfiguration(ENV)).includes('app-secret'), false);
});

test('successful remote verification persists only a safe health snapshot', () => {
  const metadata = verifiedMetadata({ unrelated: { preserved: true } });

  assert.equal(metadata.unrelated.preserved, true);
  assert.deepEqual(metadata.channelHealth, {
    version: 1,
    checkedAt: NOW.toISOString(),
    tokenStatus: 'VALID',
    expiresAt: null,
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    subscriptionStatus: 'SUBSCRIBED',
    phoneStatus: 'REGISTERED',
    providerPhoneStatus: 'CONNECTED',
    verificationStatus: 'VERIFIED',
    qualityStatus: 'HEALTHY',
    qualityRating: 'GREEN',
    templateStatus: 'UNKNOWN',
    providerStatus: 'HEALTHY',
    failureCode: null,
  });
  assert.equal(JSON.stringify(metadata).includes('app-secret'), false);
});

test('remote health evidence has an explicit inclusive fifteen-minute freshness boundary', () => {
  const verifiedConnection = connection();
  const boundary = new Date(NOW.getTime() + WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS);
  const fresh = inspectStoredWhatsAppRemoteHealthEvidence(verifiedConnection, { now: boundary });
  assert.deepEqual(fresh, {
    status: 'FRESH',
    fresh: true,
    checkedAt: NOW.toISOString(),
    maxAgeMs: 15 * 60 * 1_000,
  });

  const stale = inspectStoredWhatsAppRemoteHealthEvidence(verifiedConnection, {
    now: new Date(boundary.getTime() + 1),
  });
  assert.equal(stale.status, 'STALE');
  assert.equal(stale.fresh, false);

  const missing = connection();
  delete missing.metadata.channelHealth.checkedAt;
  assert.equal(inspectStoredWhatsAppRemoteHealthEvidence(missing, { now: NOW }).status, 'MISSING');
});

test('safe snapshots preserve explicit expiry and disconnected phone evidence', () => {
  const metadata = buildWhatsAppChannelHealthMetadata({}, {
    expiresAt: Math.floor(new Date('2025-01-01T00:00:00.000Z').getTime() / 1_000),
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    subscribed: true,
    phoneStatus: 'DISCONNECTED',
    verificationStatus: 'VERIFIED',
    qualityRating: 'GREEN',
  }, { now: NOW });

  assert.equal(metadata.channelHealth.tokenStatus, 'EXPIRED');
  assert.equal(metadata.channelHealth.phoneStatus, 'UNREGISTERED');
});

test('failed provider checks persist actionable degradation without raw provider payloads', () => {
  const metadata = buildWhatsAppChannelHealthFailureMetadata(verifiedMetadata(), {
    code: 'META_APP_NOT_SUBSCRIBED',
    raw: { access_token: 'must-not-persist' },
  }, { now: new Date('2026-07-17T16:00:00.000Z') });

  assert.equal(metadata.channelHealth.subscriptionStatus, 'UNSUBSCRIBED');
  assert.equal(metadata.channelHealth.providerStatus, 'DEGRADED');
  assert.equal(metadata.channelHealth.failureCode, 'META_APP_NOT_SUBSCRIBED');
  assert.equal(JSON.stringify(metadata).includes('must-not-persist'), false);
});

test('stored evidence only becomes operational with both real traffic directions', () => {
  const base = {
    connection: connection(),
    env: ENV,
    now: NOW,
  };
  const pending = deriveStoredWhatsAppChannelReadiness({
    ...base,
    inbound: { createdAt: new Date('2026-07-17T14:00:00.000Z') },
  });
  assert.equal(pending.state, 'WEBHOOK_PENDING');

  const operational = deriveStoredWhatsAppChannelReadiness({
    ...base,
    inbound: { createdAt: new Date('2026-07-17T14:00:00.000Z') },
    outbound: { sentAt: new Date('2026-07-17T14:01:00.000Z') },
  });
  assert.equal(operational.state, 'OPERATIONAL');
  assert.equal(operational.progress.percentage, 100);
});

test('an expired timestamp overrides a stale VALID token snapshot', () => {
  const stale = connection();
  stale.metadata.channelHealth.expiresAt = Math.floor(
    new Date('2025-01-01T00:00:00.000Z').getTime() / 1_000,
  );

  const readiness = deriveStoredWhatsAppChannelReadiness({
    connection: stale,
    inbound: { createdAt: new Date('2026-07-17T14:00:00.000Z') },
    outbound: { sentAt: new Date('2026-07-17T14:01:00.000Z') },
    env: ENV,
    now: NOW,
  });

  assert.equal(readiness.checks.account.tokenStatus, 'EXPIRED');
  assert.equal(readiness.state, 'DEGRADED');
  assert.equal(readiness.operational, false);
});

test('an explicit disconnected phone overrides historical verification', () => {
  const disconnected = connection();
  disconnected.metadata.channelHealth.phoneStatus = 'REGISTERED';
  disconnected.metadata.channelHealth.providerPhoneStatus = 'DISCONNECTED';
  disconnected.metadata.channelHealth.verificationStatus = 'VERIFIED';

  const readiness = deriveStoredWhatsAppChannelReadiness({
    connection: disconnected,
    inbound: { createdAt: new Date('2026-07-17T14:00:00.000Z') },
    outbound: { sentAt: new Date('2026-07-17T14:01:00.000Z') },
    env: ENV,
    now: NOW,
  });

  assert.equal(readiness.checks.account.phoneStatus, 'UNREGISTERED');
  assert.equal(readiness.state, 'DEGRADED');
  assert.equal(readiness.operational, false);
});

test('a current connection error overrides a historical healthy provider snapshot', () => {
  const readiness = deriveStoredWhatsAppChannelReadiness({
    connection: connection({
      connectionStatus: 'ERROR',
      lastError: 'Provider rejected the latest request.',
    }),
    inbound: { createdAt: new Date('2026-07-17T14:00:00.000Z') },
    outbound: { sentAt: new Date('2026-07-17T14:01:00.000Z') },
    env: ENV,
    now: NOW,
  });

  assert.equal(readiness.checks.account.providerStatus, 'DEGRADED');
  assert.equal(readiness.state, 'DEGRADED');
  assert.equal(readiness.operational, false);
});

test('a leftover Flow keyring is not healthy without a current identity binding', () => {
  const stale = connection();
  delete stale.metadata.whatsappFlowEndpoint;

  const readiness = deriveStoredWhatsAppChannelReadiness({
    connection: stale,
    inbound: { createdAt: new Date('2026-07-17T14:00:00.000Z') },
    outbound: { sentAt: new Date('2026-07-17T14:01:00.000Z') },
    env: ENV,
    now: NOW,
  });

  assert.equal(readiness.checks.flows.endpointStatus, 'UNKNOWN');
  assert.equal(
    readiness.actions.some((action) => action.code === 'VERIFY_FLOW_ENDPOINT'),
    true,
  );
  assert.equal(
    readiness.actions.some((action) => action.code === 'PUBLISH_FLOW'),
    false,
  );
});

test('health loading keeps every evidence query inside the selected project', async () => {
  const calls = [];
  const prisma = {
    whatsAppConnection: {
      async findUnique(args) {
        calls.push(['connection', args]);
        return connection();
      },
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['inbound', args]);
        return { createdAt: new Date('2026-07-17T14:00:00.000Z'), status: 'PROCESSED' };
      },
      async groupBy(args) {
        calls.push(['queue', args]);
        return [
          { status: 'PENDING', _count: { _all: 2 } },
          { status: 'PROCESSING', _count: { _all: 1 } },
          { status: 'FAILED', _count: { _all: 4 } },
        ];
      },
    },
    message: {
      async findFirst(args) {
        calls.push(['outbound', args]);
        return { sentAt: new Date('2026-07-17T14:01:00.000Z'), status: 'delivered' };
      },
    },
  };

  const result = await loadWhatsAppChannelHealth(prisma, {
    projectId: 'project-a',
    env: ENV,
    now: NOW,
  });

  assert.equal(result.readiness.state, 'OPERATIONAL');
  assert.deepEqual(result.diagnostics, {
    checkedAt: NOW.toISOString(),
    lastRemoteVerificationAt: NOW.toISOString(),
    lastSignedInboundAt: '2026-07-17T14:00:00.000Z',
    lastConfirmedOutboundAt: '2026-07-17T14:01:00.000Z',
    pendingEvents: 3,
    failedEvents: 4,
  });
  assert.deepEqual(calls.find(([name]) => name === 'connection')[1].where, {
    projectId: 'project-a',
  });
  assert.deepEqual(calls.find(([name]) => name === 'inbound')[1].where, {
    projectId: 'project-a',
    provider: 'meta',
    eventType: 'message',
  });
  assert.equal(
    calls.find(([name]) => name === 'outbound')[1].where.conversation.projectId,
    'project-a',
  );
  assert.deepEqual(calls.find(([name]) => name === 'queue')[1].where, {
    projectId: 'project-a',
    provider: 'meta',
  });
});
