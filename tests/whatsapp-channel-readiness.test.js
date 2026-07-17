import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WHATSAPP_CHANNEL_READINESS_STATES,
  WHATSAPP_REQUIRED_SCOPES,
  deriveWhatsAppChannelReadiness,
} from '../src/lib/whatsapp/channel-readiness.js';

const CONFIGURED_PLATFORM = Object.freeze({
  appIdConfigured: true,
  appSecretConfigured: true,
  embeddedSignupConfigConfigured: true,
  webhookVerifyTokenConfigured: true,
  credentialEncryptionConfigured: true,
});

const HEALTHY_ACCOUNT = Object.freeze({
  linked: true,
  enabled: true,
  tokenStatus: 'VALID',
  scopes: [...WHATSAPP_REQUIRED_SCOPES],
  phoneStatus: 'REGISTERED',
  subscriptionStatus: 'SUBSCRIBED',
  qualityStatus: 'HEALTHY',
  templateStatus: 'HEALTHY',
  providerStatus: 'HEALTHY',
});

const PROVEN_TRAFFIC = Object.freeze({
  signedInboundAt: '2026-07-17T12:00:00.000Z',
  confirmedOutboundAt: '2026-07-17T12:01:00.000Z',
});

function readiness(overrides = {}) {
  return deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    account: HEALTHY_ACCOUNT,
    traffic: PROVEN_TRAFFIC,
    ...overrides,
  });
}

function reasonCodes(model) {
  return model.reasons.map((reason) => reason.code);
}

function actionCodes(model) {
  return model.actions.map((action) => action.code);
}

test('readiness publishes the six stable channel states', () => {
  assert.deepEqual(WHATSAPP_CHANNEL_READINESS_STATES, {
    UNCONFIGURED: 'UNCONFIGURED',
    READY_TO_CONNECT: 'READY_TO_CONNECT',
    ACCOUNT_LINKED: 'ACCOUNT_LINKED',
    WEBHOOK_PENDING: 'WEBHOOK_PENDING',
    OPERATIONAL: 'OPERATIONAL',
    DEGRADED: 'DEGRADED',
  });
  assert.equal(Object.isFrozen(WHATSAPP_CHANNEL_READINESS_STATES), true);
});

test('empty or malformed input is unconfigured and fails closed', () => {
  const model = deriveWhatsAppChannelReadiness({
    platform: [],
    account: 'invalid',
    traffic: { signedInboundAt: 'not-a-date' },
    flows: { configured: 'true', publishedCount: '4' },
  });

  assert.equal(model.state, 'UNCONFIGURED');
  assert.equal(model.operational, false);
  assert.equal(model.messagingOperational, false);
  assert.deepEqual(model.checks.platform.missing, [
    'appId',
    'appSecret',
    'embeddedSignupConfig',
    'webhookVerifyToken',
    'credentialEncryption',
  ]);
  assert.equal(model.checks.traffic.signedInboundObserved, false);
  assert.equal(model.checks.flows.configured, false);
  assert.equal(model.checks.flows.publishedCount, 0);
  assert.equal(model.progress.completed, 0);
  assert.equal(model.progress.nextStage, 'platform');
  assert.equal(model.nextAction.code, 'CONFIGURE_META_PLATFORM');
});

test('partial platform configuration identifies exactly what is missing', () => {
  const model = deriveWhatsAppChannelReadiness({
    platform: {
      appIdConfigured: true,
      appSecretConfigured: false,
      embeddedSignupConfigConfigured: true,
      webhookVerifyTokenConfigured: true,
      credentialEncryptionConfigured: true,
    },
  });

  assert.equal(model.state, 'UNCONFIGURED');
  assert.deepEqual(model.checks.platform.missing, ['appSecret']);
  assert.deepEqual(reasonCodes(model), ['META_APP_SECRET_MISSING']);
  assert.deepEqual(actionCodes(model), ['CONFIGURE_META_PLATFORM']);
});

test('configured platform without an account is ready to connect, not connected', () => {
  const model = deriveWhatsAppChannelReadiness({ platform: CONFIGURED_PLATFORM });

  assert.equal(model.state, 'READY_TO_CONNECT');
  assert.equal(model.operational, false);
  assert.equal(model.progress.completed, 1);
  assert.equal(model.progress.percentage, 20);
  assert.equal(model.progress.nextStage, 'account');
  assert.deepEqual(reasonCodes(model), ['ACCOUNT_NOT_LINKED']);
  assert.equal(model.nextAction.code, 'CONNECT_ACCOUNT');
});

test('a persisted account alone remains ACCOUNT_LINKED until provider facts are known', () => {
  const model = deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    account: { linked: true },
    traffic: PROVEN_TRAFFIC,
  });

  assert.equal(model.state, 'ACCOUNT_LINKED');
  assert.equal(model.messagingOperational, false);
  assert.equal(model.checks.account.tokenStatus, 'UNKNOWN');
  assert.equal(model.checks.account.scopesVerified, false);
  assert.equal(model.checks.account.missingScopes, null);
  assert.equal(model.checks.webhook.subscriptionStatus, 'UNKNOWN');
  assert.deepEqual(reasonCodes(model), [
    'CONNECTION_STATUS_UNVERIFIED',
    'ACCESS_TOKEN_UNVERIFIED',
    'SCOPES_UNVERIFIED',
    'PHONE_STATUS_UNVERIFIED',
    'WEBHOOK_SUBSCRIPTION_UNVERIFIED',
  ]);
  assert.deepEqual(actionCodes(model), ['VERIFY_ACCOUNT', 'VERIFY_WEBHOOK_SUBSCRIPTION']);
});

test('orphaned Flow-shaped input cannot skip the account progression', () => {
  const model = deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    flows: { configured: true, endpointStatus: 'DEGRADED', publishedCount: 1 },
  });

  assert.equal(model.state, 'READY_TO_CONNECT');
  assert.equal(model.progress.nextStage, 'account');
  assert.equal(reasonCodes(model).includes('FLOW_ENDPOINT_DEGRADED'), false);
  assert.equal(model.nextAction.code, 'CONNECT_ACCOUNT');
});

test('a verified account with unknown subscription remains ACCOUNT_LINKED', () => {
  const model = deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    account: { ...HEALTHY_ACCOUNT, subscriptionStatus: 'UNKNOWN' },
  });

  assert.equal(model.state, 'ACCOUNT_LINKED');
  assert.equal(model.progress.stages.find((stage) => stage.key === 'account').status, 'COMPLETE');
  assert.equal(model.progress.stages.find((stage) => stage.key === 'webhook').status, 'CURRENT');
  assert.equal(model.nextAction.code, 'VERIFY_WEBHOOK_SUBSCRIPTION');
});

test('a healthy subscribed webhook waits for both real traffic directions', () => {
  const noTraffic = deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    account: HEALTHY_ACCOUNT,
  });
  assert.equal(noTraffic.state, 'WEBHOOK_PENDING');
  assert.deepEqual(reasonCodes(noTraffic), [
    'SIGNED_INBOUND_NOT_OBSERVED',
    'CONFIRMED_OUTBOUND_NOT_OBSERVED',
  ]);
  assert.deepEqual(actionCodes(noTraffic), ['TEST_INBOUND_MESSAGE', 'TEST_OUTBOUND_MESSAGE']);

  const inboundOnly = deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    account: HEALTHY_ACCOUNT,
    traffic: { signedInboundAt: PROVEN_TRAFFIC.signedInboundAt },
  });
  assert.equal(inboundOnly.state, 'WEBHOOK_PENDING');
  assert.deepEqual(reasonCodes(inboundOnly), ['CONFIRMED_OUTBOUND_NOT_OBSERVED']);

  const outboundOnly = deriveWhatsAppChannelReadiness({
    platform: CONFIGURED_PLATFORM,
    account: HEALTHY_ACCOUNT,
    traffic: { confirmedOutboundAt: PROVEN_TRAFFIC.confirmedOutboundAt },
  });
  assert.equal(outboundOnly.state, 'WEBHOOK_PENDING');
  assert.deepEqual(reasonCodes(outboundOnly), ['SIGNED_INBOUND_NOT_OBSERVED']);
});

test('only signed inbound plus Meta-confirmed outbound declares messaging operational', () => {
  const model = readiness();

  assert.equal(model.state, 'OPERATIONAL');
  assert.equal(model.operational, true);
  assert.equal(model.messagingOperational, true);
  assert.equal(model.progress.completed, 4);
  assert.equal(model.progress.percentage, 80);
  assert.equal(model.progress.nextStage, 'flows');
  assert.deepEqual(reasonCodes(model), ['FLOWS_NOT_CONFIGURED']);
  assert.equal(model.nextAction.code, 'CONFIGURE_FLOWS');
  assert.equal(model.nextAction.priority, 'ENHANCEMENT');
});

test('healthy published Flows completes the five-step progression', () => {
  const model = readiness({
    flows: { configured: true, endpointStatus: 'HEALTHY', publishedCount: 2 },
  });

  assert.equal(model.state, 'OPERATIONAL');
  assert.equal(model.progress.completed, 5);
  assert.equal(model.progress.percentage, 100);
  assert.equal(model.progress.nextStage, null);
  assert.deepEqual(model.reasons, []);
  assert.deepEqual(model.actions, []);
  assert.equal(model.nextAction, null);
});

for (const tokenStatus of ['EXPIRED', 'INVALID']) {
  test(`${tokenStatus.toLowerCase()} access token degrades even previously proven traffic`, () => {
    const model = readiness({
      account: { ...HEALTHY_ACCOUNT, tokenStatus },
    });

    assert.equal(model.state, 'DEGRADED');
    assert.equal(model.operational, false);
    assert.equal(model.messagingOperational, false);
    assert.equal(model.nextAction.code, 'RECONNECT_ACCOUNT');
    assert.equal(reasonCodes(model).includes(
      tokenStatus === 'EXPIRED' ? 'ACCESS_TOKEN_EXPIRED' : 'ACCESS_TOKEN_INVALID',
    ), true);
  });
}

test('both mandatory WhatsApp scopes are required exactly', () => {
  const missingMessaging = readiness({
    account: {
      ...HEALTHY_ACCOUNT,
      scopes: ['whatsapp_business_management', 'business_management'],
    },
  });
  assert.equal(missingMessaging.state, 'DEGRADED');
  assert.deepEqual(missingMessaging.checks.account.missingScopes, [
    'whatsapp_business_messaging',
  ]);
  assert.equal(reasonCodes(missingMessaging).includes('REQUIRED_SCOPES_MISSING'), true);

  const duplicateButComplete = readiness({
    account: {
      ...HEALTHY_ACCOUNT,
      scopes: [
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'whatsapp_business_messaging',
      ],
    },
    flows: { configured: true, endpointStatus: 'HEALTHY', publishedCount: 1 },
  });
  assert.equal(duplicateButComplete.state, 'OPERATIONAL');
});

test('an explicitly unsubscribed WABA degrades instead of looking pending', () => {
  const model = readiness({
    account: { ...HEALTHY_ACCOUNT, subscriptionStatus: 'UNSUBSCRIBED' },
  });

  assert.equal(model.state, 'DEGRADED');
  assert.equal(model.progress.stages.find((stage) => stage.key === 'webhook').status, 'DEGRADED');
  assert.equal(reasonCodes(model).includes('WEBHOOK_NOT_SUBSCRIBED'), true);
  assert.equal(model.nextAction.code, 'SUBSCRIBE_WEBHOOK');
});

for (const [name, accountPatch, expectedReason, expectedAction] of [
  ['disabled connection', { enabled: false }, 'CONNECTION_DISABLED', 'ENABLE_CONNECTION'],
  ['unregistered phone', { phoneStatus: 'UNREGISTERED' }, 'PHONE_NOT_REGISTERED', 'REGISTER_PHONE'],
  ['poor phone quality', { qualityStatus: 'DEGRADED' }, 'PHONE_QUALITY_DEGRADED', 'REVIEW_PHONE_QUALITY'],
  ['restricted templates', { templateStatus: 'DEGRADED' }, 'TEMPLATE_HEALTH_DEGRADED', 'REVIEW_TEMPLATES'],
  ['provider failure', { providerStatus: 'DEGRADED' }, 'PROVIDER_HEALTH_DEGRADED', 'REVALIDATE_PROVIDER'],
]) {
  test(`${name} produces an actionable degraded state`, () => {
    const model = readiness({ account: { ...HEALTHY_ACCOUNT, ...accountPatch } });
    assert.equal(model.state, 'DEGRADED');
    assert.equal(reasonCodes(model).includes(expectedReason), true);
    assert.equal(actionCodes(model).includes(expectedAction), true);
    assert.equal(model.nextAction.priority, 'BLOCKING');
  });
}

test('losing platform configuration after linking is degraded, not a fresh setup', () => {
  const model = readiness({
    platform: { ...CONFIGURED_PLATFORM, appSecretConfigured: false },
  });

  assert.equal(model.state, 'DEGRADED');
  assert.equal(model.progress.stages[0].status, 'DEGRADED');
  assert.equal(model.nextAction.code, 'CONFIGURE_META_PLATFORM');
});

test('a configured unhealthy Flow endpoint degrades the product while preserving messaging evidence', () => {
  const model = readiness({
    flows: { configured: true, endpointStatus: 'DEGRADED', publishedCount: 1 },
  });

  assert.equal(model.state, 'DEGRADED');
  assert.equal(model.operational, false);
  assert.equal(model.messagingOperational, true);
  assert.equal(model.progress.stages.at(-1).status, 'DEGRADED');
  assert.equal(reasonCodes(model).includes('FLOW_ENDPOINT_DEGRADED'), true);
  assert.equal(model.nextAction.code, 'REPAIR_FLOW_ENDPOINT');
});

test('configured Flows distinguish endpoint verification from publication', () => {
  const unknownEndpoint = readiness({
    flows: { configured: true, endpointStatus: 'UNKNOWN', publishedCount: 1 },
  });
  assert.equal(unknownEndpoint.state, 'OPERATIONAL');
  assert.equal(unknownEndpoint.nextAction.code, 'VERIFY_FLOW_ENDPOINT');

  const unpublished = readiness({
    flows: { configured: true, endpointStatus: 'HEALTHY', publishedCount: 0 },
  });
  assert.equal(unpublished.state, 'OPERATIONAL');
  assert.equal(unpublished.nextAction.code, 'PUBLISH_FLOW');
});

test('the projection is JSON-safe and never echoes credentials, IDs or raw payloads', () => {
  const secrets = {
    accessToken: 'tenant-access-token-secret',
    appSecret: 'meta-app-secret',
    phoneNumberId: '123456789012345',
    raw: { credential: 'raw-provider-secret' },
  };
  const model = deriveWhatsAppChannelReadiness({
    ...secrets,
    platform: { ...CONFIGURED_PLATFORM, ...secrets },
    account: { ...HEALTHY_ACCOUNT, ...secrets },
    traffic: { ...PROVEN_TRAFFIC, ...secrets },
    flows: {
      configured: true,
      endpointStatus: 'HEALTHY',
      publishedCount: 1,
      ...secrets,
    },
  });
  const serialized = JSON.stringify(model);

  assert.deepEqual(JSON.parse(serialized), model);
  for (const secret of Object.values(secrets).filter((value) => typeof value === 'string')) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(serialized.includes('raw-provider-secret'), false);
  assert.equal(Object.hasOwn(model.checks.account, 'scopes'), false);
});
