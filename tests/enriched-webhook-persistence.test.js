import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const { persistEnrichedWebhookEvent } = await import('../src/lib/db.js');
const { whatsAppMediaAssetHash } = await import('../src/lib/whatsapp/media-assets.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

const scope = {
  projectId: 'project-media-a',
  organizationId: 'organization-media-a',
  phoneNumberId: 'phone-media-a',
};

const project = {
  id: scope.projectId,
  organizationId: scope.organizationId,
  organization: { id: scope.organizationId },
  whatsapp: { enabled: true, phoneNumberId: scope.phoneNumberId },
};

function prismaDouble(count, { mediaAsset = null } = {}) {
  let updateArgs;
  return {
    prisma: {
      project: {
        findUnique: async () => project,
      },
      webhookEvent: {
        updateMany: async (args) => {
          updateArgs = args;
          return { count };
        },
      },
      whatsAppMediaAsset: {
        findFirst: async () => mediaAsset,
      },
    },
    updateArgs: () => updateArgs,
  };
}

function managedMediaFixture() {
  const pathname = `obrasaas/projects/${scope.projectId}/whatsapp/${scope.phoneNumberId}/photo.jpg`;
  const url = `https://tenant.private.blob.vercel-storage.com/${pathname}`;
  const storage = {
    provider: 'vercel-blob',
    assetId: url,
    publicId: pathname,
    pathname,
    resourceType: 'image',
    format: 'jpg',
    bytes: 5,
    reused: false,
  };
  const event = {
    eventType: 'message',
    externalId: 'wamid.managed-media-a',
    phoneNumberId: scope.phoneNumberId,
    from: '+5491112345678',
    kind: 'image',
    media: {
      id: 'meta-media-a',
      assetId: 'managed-asset-a',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sha256: 'a'.repeat(64),
      size: 5,
      url,
      storage: { ...storage, status: 'stored', ledgerAssetId: 'managed-asset-a' },
    },
  };
  return {
    event,
    asset: {
      id: 'managed-asset-a',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      webhookEventId: 'webhook-managed-a',
      status: 'AVAILABLE',
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
      messageConversationId: null,
      messageId: null,
      claimFingerprint: null,
      providerMessageIdHash: whatsAppMediaAssetHash(event.externalId),
      providerMediaIdHash: whatsAppMediaAssetHash(event.media.id),
    },
  };
}

test('enriched media replaces only the currently leased unapplied message payload', async () => {
  const { prisma, updateArgs } = prismaDouble(1);
  globalThis.__obraSaasPrisma = prisma;
  const event = {
    eventType: 'message',
    externalId: 'wamid.media-a',
    phoneNumberId: scope.phoneNumberId,
    from: '+5491112345678',
    media: {
      url: 'https://private.example/media-a',
      storage: { provider: 'vercel-blob', status: 'stored' },
    },
  };

  assert.equal(await persistEnrichedWebhookEvent({
    eventId: 'webhook-a',
    leaseToken: 'lease-a',
    event,
    scope,
  }), true);

  assert.deepEqual(updateArgs().where, {
    id: 'webhook-a',
    projectId: scope.projectId,
    eventType: 'message',
    status: 'PROCESSING',
    leaseToken: 'lease-a',
    appliedAt: null,
  });
  assert.deepEqual(updateArgs().data.payload, {
    version: 1,
    event,
    scope: {
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      phoneNumberId: scope.phoneNumberId,
      whatsappBusinessId: null,
      displayPhoneNumber: null,
    },
  });
  assert.equal(updateArgs().data.lastError, null);
});

test('enriched media fails with WEBHOOK_LEASE_LOST when its lease changed', async () => {
  const { prisma } = prismaDouble(0);
  globalThis.__obraSaasPrisma = prisma;

  await assert.rejects(
    persistEnrichedWebhookEvent({
      eventId: 'webhook-a',
      leaseToken: 'stale-lease',
      event: { eventType: 'message', externalId: 'wamid.media-a' },
      scope,
    }),
    (error) => error.code === 'WEBHOOK_LEASE_LOST',
  );
});

test('managed media payload is accepted only when its durable asset matches the leased webhook', async () => {
  const fixture = managedMediaFixture();
  const { prisma, updateArgs } = prismaDouble(1, { mediaAsset: fixture.asset });
  globalThis.__obraSaasPrisma = prisma;

  assert.equal(await persistEnrichedWebhookEvent({
    eventId: 'webhook-managed-a',
    leaseToken: 'lease-managed-a',
    event: fixture.event,
    scope,
  }), true);
  assert.equal(updateArgs().data.payload.event.media.assetId, fixture.asset.id);

  globalThis.__obraSaasPrisma = prismaDouble(1, {
    mediaAsset: { ...fixture.asset, providerMessageIdHash: 'b'.repeat(64) },
  }).prisma;
  await assert.rejects(
    persistEnrichedWebhookEvent({
      eventId: 'webhook-managed-a',
      leaseToken: 'lease-managed-a',
      event: fixture.event,
      scope,
    }),
    (error) => error.code === 'WEBHOOK_PAYLOAD_INVALID',
  );
});
