import { deriveWhatsAppChannelReadiness } from './channel-readiness.js';
import { inspectWhatsAppPublicAppUrl } from './public-app-url.js';

const BAD_QUALITY_SIGNALS = new Set(['DEGRADED', 'FLAGGED', 'RED', 'YELLOW', 'POOR']);
const GOOD_QUALITY_SIGNALS = new Set(['GREEN', 'HEALTHY']);
const BAD_TEMPLATE_SIGNALS = new Set(['DISABLED', 'PAUSED', 'REJECTED']);
const GOOD_TEMPLATE_SIGNALS = new Set(['APPROVED', 'ACTIVE']);
const REGISTERED_PHONE_SIGNALS = new Set(['CONNECTED', 'REGISTERED', 'VERIFIED']);
const UNREGISTERED_PHONE_SIGNALS = new Set(['DISCONNECTED', 'UNREGISTERED']);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizedSignal(value) {
  return String(value || '').trim().toUpperCase();
}

function isoTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeScopes(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value
    .filter((scope) => typeof scope === 'string')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .slice(0, 32))];
}

function tokenStatusFromSnapshot(health, legacy, now) {
  const stored = normalizedSignal(health.tokenStatus);
  const expiresAt = Number(health.expiresAt ?? legacy.expiresAt ?? 0);
  if (expiresAt > 0 && expiresAt * 1_000 <= now.getTime()) return 'EXPIRED';
  if (['VALID', 'EXPIRED', 'INVALID'].includes(stored)) return stored;
  const scopes = safeScopes(health.scopes ?? legacy.scopes);
  if (!scopes) return 'UNKNOWN';
  return health.checkedAt || legacy.lastRemoteVerifiedAt ? 'VALID' : 'UNKNOWN';
}

function phoneStatusFromSnapshot(health, legacy) {
  const stored = normalizedSignal(health.phoneStatus);
  const providerStatus = normalizedSignal(health.providerPhoneStatus ?? legacy.phoneStatus);
  const verificationStatus = normalizedSignal(
    health.verificationStatus ?? legacy.verificationStatus,
  );
  if (
    UNREGISTERED_PHONE_SIGNALS.has(providerStatus)
    || UNREGISTERED_PHONE_SIGNALS.has(verificationStatus)
  ) return 'UNREGISTERED';
  if (['REGISTERED', 'UNREGISTERED'].includes(stored)) return stored;
  if (
    REGISTERED_PHONE_SIGNALS.has(providerStatus)
    || REGISTERED_PHONE_SIGNALS.has(verificationStatus)
  ) return 'REGISTERED';
  return 'UNKNOWN';
}

function subscriptionStatusFromSnapshot(health, legacy) {
  const stored = normalizedSignal(health.subscriptionStatus);
  if (['SUBSCRIBED', 'UNSUBSCRIBED'].includes(stored)) return stored;
  if (health.subscribed === true || legacy.subscribed === true) return 'SUBSCRIBED';
  if (health.subscribed === false || legacy.subscribed === false) return 'UNSUBSCRIBED';
  return 'UNKNOWN';
}

function providerEventSignal(metadata) {
  const webhook = record(metadata.metaWebhook);
  return {
    field: normalizedSignal(webhook.field),
    signal: normalizedSignal(
      webhook.event ?? webhook.decision ?? webhook.value?.status,
    ),
  };
}

function qualityStatusFromSnapshot(health, legacy, metadata) {
  const stored = normalizedSignal(health.qualityStatus);
  if (['HEALTHY', 'DEGRADED'].includes(stored)) return stored;
  const providerEvent = providerEventSignal(metadata);
  if (
    providerEvent.field === 'PHONE_NUMBER_QUALITY_UPDATE'
    && BAD_QUALITY_SIGNALS.has(providerEvent.signal)
  ) return 'DEGRADED';
  const rating = normalizedSignal(health.qualityRating ?? legacy.qualityRating);
  if (BAD_QUALITY_SIGNALS.has(rating)) return 'DEGRADED';
  if (GOOD_QUALITY_SIGNALS.has(rating)) return 'HEALTHY';
  return 'UNKNOWN';
}

function templateStatusFromSnapshot(health, metadata) {
  const stored = normalizedSignal(health.templateStatus);
  if (['HEALTHY', 'DEGRADED'].includes(stored)) return stored;
  const providerEvent = providerEventSignal(metadata);
  if (providerEvent.field !== 'MESSAGE_TEMPLATE_STATUS_UPDATE') return 'UNKNOWN';
  if (BAD_TEMPLATE_SIGNALS.has(providerEvent.signal)) return 'DEGRADED';
  if (GOOD_TEMPLATE_SIGNALS.has(providerEvent.signal)) return 'HEALTHY';
  return 'UNKNOWN';
}

function providerStatusFromSnapshot(connection, health) {
  if (
    normalizedSignal(connection?.connectionStatus) === 'ERROR'
    || connection?.lastError
  ) return 'DEGRADED';
  const stored = normalizedSignal(health.providerStatus);
  if (['HEALTHY', 'DEGRADED'].includes(stored)) return stored;
  return 'UNKNOWN';
}

function publishedFlowCount(metadata) {
  const flows = record(metadata.whatsappFlows);
  return Object.values(flows).filter((flow) => normalizedSignal(flow?.status) === 'PUBLISHED').length;
}

function flowEndpointStatus(endpoint, metadata, connection) {
  if (!endpoint) return 'UNKNOWN';
  if (endpoint.enabled === false) return 'DEGRADED';
  const activeKey = Array.isArray(endpoint.keys) ? endpoint.keys[0] : null;
  if (endpoint.enabled !== true || !activeKey?.verifiedAt) return 'UNKNOWN';
  const stored = record(record(metadata).whatsappFlowEndpoint);
  const bound = stored.id === endpoint.id
    && String(stored.keyFingerprint || '').toLowerCase()
      === String(activeKey.publicKeySha256 || '').toLowerCase()
    && stored.keyVersion === activeKey.version
    && normalizedSignal(stored.signatureStatus) === 'VALID'
    && stored.whatsappBusinessId === connection?.whatsappBusinessId
    && stored.phoneNumberId === connection?.phoneNumberId;
  return bound ? 'HEALTHY' : 'UNKNOWN';
}

export function whatsAppPlatformConfiguration(env = process.env) {
  const publicAppUrl = inspectWhatsAppPublicAppUrl(env);
  return {
    publicAppUrlConfigured: publicAppUrl.configured,
    publicAppUrlStatus: publicAppUrl.status,
    appIdConfigured: Boolean(env.NEXT_PUBLIC_META_APP_ID),
    appSecretConfigured: Boolean(env.META_APP_SECRET),
    embeddedSignupConfigConfigured: Boolean(env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID),
    webhookVerifyTokenConfigured: Boolean(env.META_VERIFY_TOKEN),
    credentialEncryptionConfigured: Boolean(env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY),
  };
}

export function buildWhatsAppChannelHealthMetadata(current, verified, {
  now = new Date(),
} = {}) {
  const metadata = record(current);
  const expiresAt = Number(verified?.expiresAt || 0) || null;
  const providerPhoneStatus = normalizedSignal(verified?.phoneStatus) || null;
  const verificationStatus = normalizedSignal(verified?.verificationStatus) || null;
  const qualityRating = normalizedSignal(verified?.qualityRating) || null;
  const phoneExplicitlyUnregistered = UNREGISTERED_PHONE_SIGNALS.has(providerPhoneStatus)
    || UNREGISTERED_PHONE_SIGNALS.has(verificationStatus);
  const phoneStatus = phoneExplicitlyUnregistered
    ? 'UNREGISTERED'
    : (
      REGISTERED_PHONE_SIGNALS.has(providerPhoneStatus)
      || REGISTERED_PHONE_SIGNALS.has(verificationStatus)
    ) ? 'REGISTERED' : 'UNKNOWN';
  const qualityStatus = GOOD_QUALITY_SIGNALS.has(qualityRating)
    ? 'HEALTHY'
    : BAD_QUALITY_SIGNALS.has(qualityRating)
      ? 'DEGRADED'
      : 'UNKNOWN';

  return {
    ...metadata,
    channelHealth: {
      version: 1,
      checkedAt: isoTimestamp(now),
      tokenStatus: expiresAt && expiresAt * 1_000 <= now.getTime() ? 'EXPIRED' : 'VALID',
      expiresAt,
      scopes: safeScopes(verified?.scopes) || [],
      subscriptionStatus: verified?.subscribed === true ? 'SUBSCRIBED' : 'UNKNOWN',
      phoneStatus,
      providerPhoneStatus,
      verificationStatus,
      qualityStatus,
      qualityRating,
      templateStatus: normalizedSignal(metadata.channelHealth?.templateStatus) || 'UNKNOWN',
      providerStatus: 'HEALTHY',
      failureCode: null,
    },
  };
}

export function buildWhatsAppChannelHealthFailureMetadata(current, error, {
  now = new Date(),
} = {}) {
  const metadata = record(current);
  const previous = record(metadata.channelHealth);
  const code = String(error?.code || 'META_VERIFICATION_FAILED').slice(0, 96);
  const next = {
    ...previous,
    version: 1,
    checkedAt: isoTimestamp(now),
    providerStatus: 'DEGRADED',
    failureCode: code,
  };
  if (['META_TOKEN_MISSING', 'META_TOKEN_APP_MISMATCH', 'META_190'].includes(code)) {
    next.tokenStatus = 'INVALID';
  }
  if (code === 'META_APP_NOT_SUBSCRIBED') next.subscriptionStatus = 'UNSUBSCRIBED';
  if (code === 'PHONE_WABA_MISMATCH') next.phoneStatus = 'UNREGISTERED';
  return { ...metadata, channelHealth: next };
}

export function deriveStoredWhatsAppChannelReadiness({
  connection,
  inbound,
  outbound,
  env = process.env,
  now = new Date(),
} = {}) {
  const metadata = record(connection?.metadata);
  const health = record(metadata.channelHealth);
  const account = connection ? {
    linked: true,
    enabled: connection.enabled,
    tokenStatus: tokenStatusFromSnapshot(health, metadata, now),
    scopes: safeScopes(health.scopes ?? metadata.scopes) ?? undefined,
    phoneStatus: phoneStatusFromSnapshot(health, metadata),
    subscriptionStatus: subscriptionStatusFromSnapshot(health, metadata),
    qualityStatus: qualityStatusFromSnapshot(health, metadata, metadata),
    templateStatus: templateStatusFromSnapshot(health, metadata),
    providerStatus: providerStatusFromSnapshot(connection, health),
  } : { linked: false };
  const endpoint = connection?.flowEndpoint || null;

  return deriveWhatsAppChannelReadiness({
    platform: whatsAppPlatformConfiguration(env),
    account,
    traffic: {
      signedInboundAt: isoTimestamp(inbound?.createdAt),
      confirmedOutboundAt: isoTimestamp(outbound?.sentAt ?? outbound?.createdAt),
    },
    flows: {
      configured: Boolean(endpoint),
      endpointStatus: flowEndpointStatus(endpoint, metadata, connection),
      publishedCount: publishedFlowCount(metadata),
    },
  });
}

function queueDiagnostics(groups) {
  const counts = new Map((Array.isArray(groups) ? groups : []).map((group) => [
    group.status,
    Number(group?._count?._all || 0),
  ]));
  return {
    pendingEvents: (counts.get('PENDING') || 0) + (counts.get('PROCESSING') || 0),
    failedEvents: counts.get('FAILED') || 0,
  };
}

export async function loadWhatsAppChannelHealth(prisma, {
  projectId,
  env = process.env,
  now = new Date(),
} = {}) {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { projectId },
    select: {
      id: true,
      phoneNumberId: true,
      whatsappBusinessId: true,
      displayPhoneNumber: true,
      verifiedBusinessName: true,
      enabled: true,
      connectionStatus: true,
      tokenLastFour: true,
      embeddedSignupVersion: true,
      connectedAt: true,
      lastVerifiedAt: true,
      lastError: true,
      metadata: true,
      updatedAt: true,
      flowEndpoint: {
        select: {
          id: true,
          enabled: true,
          updatedAt: true,
          keys: {
            where: { status: 'ACTIVE' },
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              status: true,
              version: true,
              publicKeySha256: true,
              verifiedAt: true,
            },
          },
        },
      },
    },
  });

  const [inbound, outbound, queueGroups] = await Promise.all([
    prisma.webhookEvent.findFirst({
      where: { projectId, provider: 'meta', eventType: 'message' },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.message.findFirst({
      where: {
        direction: 'OUTBOUND',
        providerMessageId: { not: null },
        conversation: { projectId },
      },
      select: { sentAt: true, createdAt: true, status: true },
      orderBy: { sentAt: 'desc' },
    }),
    prisma.webhookEvent.groupBy({
      by: ['status'],
      where: { projectId, provider: 'meta' },
      _count: { _all: true },
    }),
  ]);
  const readiness = deriveStoredWhatsAppChannelReadiness({
    connection,
    inbound,
    outbound,
    env,
    now,
  });
  const queue = queueDiagnostics(queueGroups);

  return {
    connection,
    readiness,
    diagnostics: {
      checkedAt: isoTimestamp(now),
      lastRemoteVerificationAt: isoTimestamp(connection?.metadata?.channelHealth?.checkedAt),
      lastSignedInboundAt: isoTimestamp(inbound?.createdAt),
      lastConfirmedOutboundAt: isoTimestamp(outbound?.sentAt ?? outbound?.createdAt),
      ...queue,
    },
  };
}
