import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const {
  applyWebhookMessageAtomically,
  progressEvidenceLocationCaptureEligible,
} = await import('../src/lib/db.js');
const { whatsAppMediaAssetHash } = await import('../src/lib/whatsapp/media-assets.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

test('H2 atomically commits media/session/outcome while Inbox body remains bearer-free', async () => {
  const scope = {
    organizationId: 'organization-media-atomic',
    projectId: 'project-media-atomic',
    phoneNumberId: '1225843560610854',
  };
  const event = {
    provider: 'meta',
    eventType: 'message',
    externalId: 'wamid.media-atomic',
    phoneNumberId: scope.phoneNumberId,
    from: '5491112345678',
    kind: 'image',
    text: 'AVANCE: pared norte a medio terminar',
    media: {
      id: 'meta-media-atomic',
      assetId: 'asset-media-atomic',
      storage: { ledgerAssetId: 'asset-media-atomic' },
    },
  };
  const worker = {
    id: 'worker-media-atomic',
    projectId: scope.projectId,
    organizationId: null,
    phone: `+${event.from}`,
    name: 'Operario verificado',
    role: 'Albañil',
    active: true,
    metadata: { whatsappRole: 'WORKER' },
    createdAt: new Date('2026-07-28T12:00:00.000Z'),
    updatedAt: new Date('2026-07-28T12:00:00.000Z'),
    project: { organizationId: scope.organizationId },
  };
  const pathname = `obrasaas/projects/${scope.projectId}/whatsapp/${scope.phoneNumberId}/photo.jpg`;
  const storage = {
    provider: 'vercel-blob',
    assetId: `https://tenant.private.blob.vercel-storage.com/${pathname}`,
    publicId: pathname,
    pathname,
    resourceType: 'image',
    format: 'jpg',
    bytes: 5,
    reused: false,
  };
  const asset = {
    id: event.media.assetId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    webhookEventId: 'webhook-media-atomic',
    status: 'AVAILABLE',
    requestFingerprint: '1'.repeat(64),
    providerMessageIdHash: whatsAppMediaAssetHash(event.externalId),
    providerMediaIdHash: whatsAppMediaAssetHash(event.media.id),
    mediaKind: 'IMAGE',
    declaredMimeType: 'image/jpeg',
    storageProvider: 'vercel-blob',
    storage,
    storageLocatorHash: whatsAppMediaAssetHash(JSON.stringify({
      path: ['storage', 'pathname'],
      provider: 'vercel-blob',
      value: pathname,
    })),
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    contentSha256: 'a'.repeat(64),
    sizeBytes: 5,
    uploadAttemptCount: 1,
    purgeEligibleAt: new Date('2030-07-29T12:00:00.000Z'),
    messageConversationId: null,
    messageId: null,
    claimedAt: null,
    claimFingerprint: null,
  };
  const calls = [];
  const messages = [];
  const captureSessions = [];
  const conversation = { id: 'conversation-media-atomic' };
  const transaction = {
    async $executeRawUnsafe() {
      calls.push('project-lock');
    },
    webhookEvent: {
      async findFirst() {
        return { id: 'webhook-media-atomic', appliedAt: null, outcome: null };
      },
      async updateMany() {
        calls.push('webhook-applied');
        return { count: 1 };
      },
    },
    project: {
      async findFirst() {
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'ACTIVE',
          latitude: null,
          longitude: null,
          geofenceMeters: 100,
          startsAt: new Date('2026-07-01T00:00:00.000Z'),
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} }, version: 1 },
          whatsapp: {
            id: 'connection-media-atomic',
            phoneNumberId: scope.phoneNumberId,
            enabled: true,
            metadata: {},
          },
        };
      },
    },
    organization: {
      async findUnique({ where }) {
        return where.id === scope.organizationId
          ? {
              id: scope.organizationId,
              subscriptionPlan: 'PRO',
              subscriptionStatus: 'ACTIVE',
              trialEndsAt: null,
            }
          : null;
      },
    },
    worker: {
      async findMany() {
        return [worker];
      },
      async findFirst({ where }) {
        const organizationMatches = where.organizationId === undefined
          ? where.OR?.some((candidate) => (
              Object.hasOwn(candidate, 'organizationId')
              && candidate.organizationId === worker.organizationId
            ))
          : where.organizationId === worker.organizationId;
        return where.id === worker.id
          && where.projectId === scope.projectId
          && organizationMatches
          ? worker
          : null;
      },
    },
    whatsAppConnection: {
      async findFirst({ where }) {
        return where.id === 'connection-media-atomic'
          && where.projectId === scope.projectId
          ? {
              id: 'connection-media-atomic',
              projectId: scope.projectId,
              enabled: true,
              connectionStatus: 'CONNECTED',
            }
          : null;
      },
    },
    conversation: {
      async upsert() {
        return conversation;
      },
      async update() {
        return conversation;
      },
    },
    message: {
      async findUnique({ where }) {
        return messages.find((message) => message.externalId === where.externalId) || null;
      },
      async create({ data }) {
        const message = { id: `message-${messages.length + 1}`, ...data };
        messages.push(message);
        calls.push(`message:${message.direction}`);
        return message;
      },
      async update({ where, data }) {
        const message = messages.find((item) => item.id === where.id);
        Object.assign(message, data);
        return message;
      },
      async findFirst({ where }) {
        return messages.find((message) => (
          message.id === where.id
          && message.conversationId === where.conversationId
          && message.direction === where.direction
        )) || null;
      },
    },
    whatsAppMediaAsset: {
      async findFirst({ where }) {
        return asset.id === where.id ? { ...asset } : null;
      },
      async updateMany({ where, data }) {
        assert.equal(where.status, 'AVAILABLE');
        Object.assign(asset, data);
        calls.push('asset-claimed');
        return { count: 1 };
      },
    },
    progressEvidenceCaptureSession: {
      async findFirst({ where }) {
        return captureSessions.find((session) => (
          (where.mediaAssetId === undefined || session.mediaAssetId === where.mediaAssetId)
          && (where.id === undefined || session.id === where.id)
        )) || null;
      },
      async create({ data }) {
        const session = { ...data };
        captureSessions.push(session);
        calls.push('capture-session-created');
        return session;
      },
      async updateMany() {
        throw new Error('Unexpected location capture update during issuance.');
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback) {
      return callback(transaction);
    },
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'webhook-media-atomic',
    leaseToken: 'webhook-lease-media-atomic',
    event,
    scope,
    apply: async () => ({
      reply: 'Foto registrada',
      flowPrompt: null,
      stateChanged: false,
      newMessages: [
        {
          externalId: event.externalId,
          sender: 'user',
          kind: 'image',
          text: 'Pared norte a medio terminar',
          media: event.media,
          metadata: {
            authorized: true,
            sensitivity: 'restricted',
          },
        },
        {
          externalId: `obrasaas-reply:${event.externalId}`,
          sender: 'bot',
          kind: 'text',
          text: 'Foto registrada',
        },
      ],
    }),
  });

  assert.equal(result.alreadyApplied, false);
  assert.equal(asset.status, 'CLAIMED');
  assert.equal(captureSessions.length, 1);
  assert.equal(captureSessions[0].mediaAssetId, asset.id);
  assert.equal(captureSessions[0].status, 'AWAITING_LOCATION');
  assert.equal(Object.hasOwn(captureSessions[0], 'token'), false);
  assert.deepEqual(result.outcome.progressEvidenceLocationDelivery, {
    version: 1,
    sessionId: captureSessions[0].id,
  });
  assert.doesNotMatch(JSON.stringify(result.outcome), /token=|"token"/i);
  const outbound = messages.find((message) => message.direction === 'OUTBOUND');
  assert.doesNotMatch(outbound.body, /webview\/progress-evidence-location\?|token=/);
  assert.match(outbound.body, /credencial no se muestra en el panel/i);
  assert.equal(
    outbound.metadata.progressEvidenceLocationCapture.sessionId,
    captureSessions[0].id,
  );
  assert.equal(
    outbound.metadata.progressEvidenceLocationCapture.deliveryContentRestricted,
    true,
  );
  assert.equal(asset.messageId, messages.find((message) => message.direction === 'INBOUND').id);
  assert.ok(calls.indexOf('capture-session-created') < calls.indexOf('message:INBOUND'));
  assert.ok(calls.indexOf('message:INBOUND') < calls.indexOf('asset-claimed'));
  assert.ok(calls.indexOf('asset-claimed') < calls.indexOf('webhook-applied'));
});

test('H2 location capture is gated by an explicit progress caption', () => {
  const externalId = 'wamid.progress-caption-gate';
  const result = {
    flowPrompt: null,
    newMessages: [{
      externalId,
      sender: 'user',
      metadata: { authorized: true, sensitivity: 'restricted' },
    }],
  };
  const baseEvent = {
    provider: 'meta',
    kind: 'image',
    externalId,
  };

  assert.equal(progressEvidenceLocationCaptureEligible(
    { ...baseEvent, text: '  PROGRESO: muro oeste al 40%  ' },
    result,
    'asset-progress-caption',
  ), true);
  assert.equal(progressEvidenceLocationCaptureEligible(
    { ...baseEvent, text: 'Foto del muro oeste' },
    result,
    'asset-progress-caption',
  ), false);
  assert.equal(progressEvidenceLocationCaptureEligible(
    { ...baseEvent, text: 'AVANCE:' },
    result,
    'asset-progress-caption',
  ), false);
  assert.equal(progressEvidenceLocationCaptureEligible(
    { ...baseEvent, text: 'AVANCE: muro oeste', provider: 'twilio' },
    result,
    'asset-progress-caption',
  ), false);
});
