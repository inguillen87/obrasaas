import assert from 'node:assert/strict';
import test from 'node:test';

import {
  claimedWhatsAppMediaAssetDescriptor,
  claimWhatsAppMediaAsset,
  cleanupWhatsAppMediaAssets,
  createOrResumeWhatsAppMediaAssetIntent,
  markWhatsAppMediaAssetAvailable,
  markWhatsAppMediaAssetUploadFailure,
  resolveClaimedWhatsAppMessageMedia,
  WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_MS,
  WHATSAPP_MEDIA_UPLOAD_CERTAINTY,
  whatsAppMediaAssetHash,
} from '../src/lib/whatsapp/media-assets.js';

const NOW = new Date('2026-07-28T20:00:00.000Z');
const PURGE_AT = new Date('2026-08-27T20:00:00.000Z');
const SCOPE = {
  organizationId: 'org-a',
  projectId: 'project-a',
  phoneNumberId: '1225843560610854',
};
const PROVIDER_MESSAGE_ID = 'wamid.message-secret-1';
const PROVIDER_MEDIA_ID = 'meta-media-secret-1';

function compare(actual, expected) {
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  return actual === expected;
}

function matches(row, where = {}) {
  if (where.OR && !where.OR.some((branch) => matches(row, branch))) return false;
  if (where.AND && !where.AND.every((branch) => matches(row, branch))) return false;
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR' || key === 'AND') return true;
    const actual = row[key];
    if (
      expected
      && typeof expected === 'object'
      && !(expected instanceof Date)
      && !Array.isArray(expected)
    ) {
      const operator = ['gt', 'gte', 'lt', 'lte', 'in', 'not']
        .some((name) => name in expected);
      if ('gt' in expected && !(actual > expected.gt)) return false;
      if ('gte' in expected && !(actual >= expected.gte)) return false;
      if ('lt' in expected && !(actual < expected.lt)) return false;
      if ('lte' in expected && !(actual <= expected.lte)) return false;
      if ('in' in expected && !expected.in.includes(actual)) return false;
      if ('not' in expected && compare(actual, expected.not)) return false;
      return operator ? true : Boolean(actual) && matches(actual, expected);
    }
    return compare(actual, expected);
  });
}

function selected(row, select) {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.entries(select).filter(([, include]) => include).map(([key]) => [key, row[key]]),
  );
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) {
      row[key] = Number(row[key] || 0) + Number(value.increment);
    } else {
      row[key] = value;
    }
  }
  row.updatedAt = NOW;
}

function fakePrisma(initialAssets = [], initialMessages = [], initialWebhookEvents = null, hooks = {}) {
  const assets = initialAssets.map((row) => ({ ...row }));
  const messages = initialMessages.map((row) => ({ ...row }));
  const webhookEvents = (initialWebhookEvents || [{
    id: 'webhook-event-1',
    projectId: SCOPE.projectId,
    provider: 'meta',
    eventType: 'message',
    status: 'PROCESSING',
    leaseToken: 'webhook-lease-1',
    leaseExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
    project: { organizationId: SCOPE.organizationId },
  }]).map((row) => ({ ...row }));
  const rawCalls = [];
  let nextId = assets.length + 1;
  const whatsAppMediaAsset = {
    async findFirst({ where, select } = {}) {
      const row = assets.find((candidate) => matches({
        ...candidate,
        webhookEvent: webhookEvents.find((event) => event.id === candidate.webhookEventId),
      }, where));
      return row ? selected(row, select) : null;
    },
    async findMany({ where, take } = {}) {
      return assets.filter((candidate) => matches({
        ...candidate,
        webhookEvent: webhookEvents.find((event) => event.id === candidate.webhookEventId),
      }, where)).slice(0, take)
        .map((row) => ({ ...row }));
    },
    async create({ data }) {
      if (assets.some((row) => (
        row.projectId === data.projectId
        && row.operationKeyHash === data.operationKeyHash
      ))) {
        const error = new Error('unique conflict');
        error.code = 'P2002';
        throw error;
      }
      const row = {
        id: `media-asset-${nextId++}`,
        messageConversationId: null,
        messageId: null,
        claimedAt: null,
        claimFingerprint: null,
        deleteOperationKeyHash: null,
        deleteRequestFingerprint: null,
        deleteRequestedAt: null,
        deleteAttemptCount: 0,
        deleteLeaseToken: null,
        deleteLeaseExpiresAt: null,
        nextDeleteAttemptAt: null,
        deletedAt: null,
        tombstoneSha256: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...data,
      };
      assets.push(row);
      return { ...row };
    },
    async updateMany({ where, data }) {
      if (hooks.beforeUpdateMany) await hooks.beforeUpdateMany({ where, data, assets });
      const matching = assets.filter((candidate) => matches(candidate, where));
      for (const row of matching) applyData(row, data);
      return { count: matching.length };
    },
  };
  const message = {
    async findFirst({ where, select } = {}) {
      const row = messages.find((candidate) => {
        if (candidate.id !== where.id) return false;
        if (candidate.conversationId !== where.conversationId) return false;
        if (candidate.direction !== where.direction) return false;
        if (candidate.conversation?.id !== where.conversation.id) return false;
        if (candidate.conversation?.projectId !== where.conversation.projectId) return false;
        return candidate.conversation?.project?.organizationId
          === where.conversation.project.organizationId;
      });
      return row ? selected(row, select) : null;
    },
  };
  const webhookEvent = {
    async findFirst({ where, select } = {}) {
      const row = webhookEvents.find((candidate) => matches(candidate, where));
      return row ? selected(row, select) : null;
    },
  };
  const transaction = {
    whatsAppMediaAsset,
    message,
    webhookEvent,
    $executeRawUnsafe: async (...args) => rawCalls.push(args),
  };
  const prisma = {
    ...transaction,
    async $transaction(callback) {
      return callback(transaction);
    },
  };
  return { prisma, transaction, assets, messages, webhookEvents, rawCalls };
}

function storedMedia(pathname, bytes = 4, overrides = {}) {
  return {
    provider: 'vercel-blob',
    assetId: null,
    publicId: pathname,
    pathname,
    resourceType: 'image',
    format: 'jpg',
    bytes,
    reused: false,
    ...overrides,
  };
}

function confirmedVercelMedia(storage, overrides = {}) {
  return {
    ...storage,
    assetId: `https://tenant.private.blob.vercel-storage.com/${storage.pathname}`,
    ...overrides,
  };
}

function mediaFile(contents = [0xff, 0xd8, 0xff, 0xd9], name = 'pared.jpg') {
  return new File([Buffer.from(contents)], name, { type: 'image/jpeg' });
}

function intentInput(overrides = {}) {
  const file = overrides.file || mediaFile();
  const pathname = `obrasaas/projects/project-a/whatsapp/${SCOPE.phoneNumberId}/deterministic.jpg`;
  return {
    scope: SCOPE,
    webhookEventId: 'webhook-event-1',
    webhookLeaseToken: 'webhook-lease-1',
    providerMessageId: PROVIDER_MESSAGE_ID,
    providerMediaId: PROVIDER_MEDIA_ID,
    mediaKind: 'image',
    declaredMimeType: 'image/jpeg',
    file,
    contentSha256: 'a'.repeat(64),
    purgeEligibleAt: PURGE_AT,
    now: NOW,
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    resolveProvider: () => 'vercel-blob',
    expectedStorageForUpload: (selectedFile, options) => storedMedia(
      pathname,
      selectedFile.size,
      { resourceType: options.resourceType },
    ),
    ...overrides,
    file,
  };
}

async function createAvailable(state, overrides = {}) {
  const input = intentInput(overrides);
  const intent = await createOrResumeWhatsAppMediaAssetIntent(state.prisma, input);
  const available = await markWhatsAppMediaAssetAvailable(state.prisma, {
    scope: SCOPE,
    mediaAssetId: intent.mediaAssetId,
    uploadLeaseToken: intent.uploadLeaseToken,
    uploaded: confirmedVercelMedia(intent.upload.expectedStorage, {
      reused: overrides.reused === true,
    }),
    fileName: input.file.name,
    mimeType: input.declaredMimeType,
    now: NOW,
  });
  return { input, intent, available, row: state.assets.at(-1) };
}

function messageFixture(overrides = {}) {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    externalId: PROVIDER_MESSAGE_ID,
    direction: 'INBOUND',
    kind: 'IMAGE',
    conversation: {
      id: 'conversation-1',
      projectId: SCOPE.projectId,
      project: { organizationId: SCOPE.organizationId },
    },
    ...overrides,
  };
}

function availableRow(overrides = {}) {
  const pathname = `obrasaas/projects/project-a/whatsapp/${SCOPE.phoneNumberId}/asset.jpg`;
  const storage = confirmedVercelMedia(storedMedia(pathname));
  return {
    id: 'media-asset-1',
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    webhookEventId: 'webhook-event-1',
    operationKeyHash: '1'.repeat(64),
    requestFingerprint: '2'.repeat(64),
    providerMediaIdHash: whatsAppMediaAssetHash(PROVIDER_MEDIA_ID),
    providerMessageIdHash: whatsAppMediaAssetHash(PROVIDER_MESSAGE_ID),
    mediaKind: 'IMAGE',
    declaredMimeType: 'image/jpeg',
    fileName: 'pared.jpg',
    mimeType: 'image/jpeg',
    status: 'AVAILABLE',
    storageProvider: 'vercel-blob',
    storage,
    contentSha256: 'a'.repeat(64),
    sizeBytes: 4,
    storageLocatorHash: whatsAppMediaAssetHash(JSON.stringify({
      path: ['storage', 'pathname'],
      provider: 'vercel-blob',
      value: pathname,
    })),
    uploadAttemptCount: 1,
    uploadLeaseToken: null,
    uploadLeaseExpiresAt: null,
    nextUploadAttemptAt: null,
    purgeEligibleAt: PURGE_AT,
    messageConversationId: null,
    messageId: null,
    claimedAt: null,
    claimFingerprint: null,
    deleteOperationKeyHash: null,
    deleteRequestFingerprint: null,
    deleteRequestedAt: null,
    deleteAttemptCount: 0,
    deleteLeaseToken: null,
    deleteLeaseExpiresAt: null,
    nextDeleteAttemptAt: null,
    deletedAt: null,
    tombstoneSha256: null,
    lastErrorCode: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test('creates a durable tenant-scoped intent before provider dispatch and finalizes AVAILABLE by lease CAS', async () => {
  const state = fakePrisma();
  const intent = await createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput());

  assert.equal(intent.dispatch, true);
  assert.equal(intent.status, 'UPLOADING');
  assert.equal(state.assets.length, 1);
  assert.equal(state.assets[0].status, 'UPLOADING');
  assert.equal(state.assets[0].uploadAttemptCount, 1);
  assert.equal(state.assets[0].providerMessageIdHash, whatsAppMediaAssetHash(PROVIDER_MESSAGE_ID));
  assert.equal(state.assets[0].providerMediaIdHash, whatsAppMediaAssetHash(PROVIDER_MEDIA_ID));
  assert.doesNotMatch(JSON.stringify(state.assets[0]), /wamid\.message-secret|meta-media-secret/);
  assert.match(intent.upload.options.folder, /^obrasaas\/projects\/project-a\/whatsapp\//);
  assert.doesNotMatch(intent.upload.options.context, /wamid\.message-secret|meta-media-secret/);
  assert.equal(state.rawCalls.filter(([sql]) => /pg_advisory_xact_lock/.test(sql)).length, 1);

  const result = await markWhatsAppMediaAssetAvailable(state.prisma, {
    scope: SCOPE,
    mediaAssetId: intent.mediaAssetId,
    uploadLeaseToken: intent.uploadLeaseToken,
    uploaded: confirmedVercelMedia(intent.upload.expectedStorage),
    fileName: 'pared.jpg',
    mimeType: 'image/jpeg',
    now: NOW,
  });
  assert.equal(result.mediaAssetId, 'media-asset-1');
  assert.equal(result.status, 'AVAILABLE');
  assert.equal(result.replayed, false);
  assert.equal(result.descriptor.assetId, result.mediaAssetId);
  assert.equal(result.descriptor.sha256, 'a'.repeat(64));
  assert.equal(state.assets[0].fileName, 'pared.jpg');
  assert.equal(state.assets[0].mimeType, 'image/jpeg');
  assert.equal(state.assets[0].uploadLeaseToken, null);
});

test('intent creation requires the exact live PROCESSING WebhookEvent lease and project', async () => {
  const state = fakePrisma();
  await assert.rejects(
    createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput({
      webhookLeaseToken: 'stale-webhook-lease',
    })),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_WEBHOOK_LEASE_LOST',
  );
  assert.equal(state.assets.length, 0);

  state.webhookEvents[0].status = 'PROCESSED';
  await assert.rejects(
    createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput()),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_WEBHOOK_LEASE_LOST',
  );
  assert.equal(state.assets.length, 0);
});

test('provider resource type is correct for all supported WhatsApp media kinds', async () => {
  const cases = [
    ['image', 'image/jpeg', 'photo.jpg', 'image'],
    ['audio', 'audio/ogg', 'voice.ogg', 'video'],
    ['video', 'video/mp4', 'walkthrough.mp4', 'video'],
    ['document', 'application/pdf', 'plano.pdf', 'raw'],
  ];
  for (const [mediaKind, mimeType, name, expectedResourceType] of cases) {
    const state = fakePrisma();
    const file = new File([Buffer.from([1, 2, 3, 4])], name, { type: mimeType });
    const intent = await createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput({
      mediaKind,
      declaredMimeType: mimeType,
      file,
    }));
    assert.equal(intent.upload.options.resourceType, expectedResourceType, mediaKind);
  }
});

test('unclaimed retention defaults to 24 hours and kind/MIME mismatches fail before persistence', async () => {
  const state = fakePrisma();
  await createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput({
    purgeEligibleAt: null,
  }));
  assert.equal(
    state.assets[0].purgeEligibleAt.getTime(),
    NOW.getTime() + 24 * 60 * 60 * 1_000,
  );

  const invalidState = fakePrisma();
  await assert.rejects(
    createOrResumeWhatsAppMediaAssetIntent(invalidState.prisma, intentInput({
      mediaKind: 'audio',
      declaredMimeType: 'image/jpeg',
    })),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_KIND_MIME_MISMATCH',
  );
  assert.equal(invalidState.assets.length, 0);
});

test('AVAILABLE replay is quota/provider-free and a mutated replay fails closed', async () => {
  const state = fakePrisma();
  const completed = await createAvailable(state);
  const replay = await createOrResumeWhatsAppMediaAssetIntent(state.prisma, {
    ...completed.input,
    resolveProvider: () => assert.fail('committed replay cannot read current provider config'),
  });
  assert.equal(replay.mediaAssetId, completed.intent.mediaAssetId);
  assert.equal(replay.status, 'AVAILABLE');
  assert.equal(replay.replayed, true);
  assert.equal(replay.descriptor.assetId, completed.intent.mediaAssetId);
  assert.equal(replay.descriptor.filename, 'pared.jpg');
  assert.equal(replay.descriptor.mimeType, 'image/jpeg');
  assert.equal(replay.descriptor.size, 4);
  assert.equal(replay.descriptor.sha256, 'a'.repeat(64));
  assert.match(replay.descriptor.url, /^https:\/\/tenant\.private\.blob\.vercel-storage\.com\//);

  await assert.rejects(
    createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput({
      file: mediaFile([0xff, 0xd8, 1, 0xff, 0xd9], 'otra-pared.jpg'),
    })),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_IDEMPOTENCY_REUSED',
  );
});

test('live leases block concurrency and expired attempts become DELETE_PENDING without redispatch', async () => {
  const state = fakePrisma();
  const input = intentInput();
  await createOrResumeWhatsAppMediaAssetIntent(state.prisma, input);
  await assert.rejects(
    createOrResumeWhatsAppMediaAssetIntent(state.prisma, {
      ...input,
      now: new Date(NOW.getTime() + 1_000),
    }),
    (error) => (
      error.code === 'WHATSAPP_MEDIA_ASSET_UPLOAD_IN_PROGRESS'
      && error.retryAfterSeconds > 0
    ),
  );

  await assert.rejects(
    createOrResumeWhatsAppMediaAssetIntent(state.prisma, {
      ...input,
      now: new Date(NOW.getTime() + WHATSAPP_MEDIA_ASSET_UPLOAD_LEASE_MS + 1),
      resolveProvider: () => assert.fail('ambiguous upload must never redispatch'),
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_UPLOAD_UNCERTAIN',
  );
  assert.equal(state.assets[0].status, 'DELETE_PENDING');
  assert.equal(state.assets[0].lastErrorCode, 'WHATSAPP_MEDIA_UPLOAD_UNCERTAIN');
  assert.equal(state.assets[0].uploadLeaseToken, null);
});

test('provider outcomes distinguish terminal definite failure from ambiguous cleanup', async () => {
  const definiteState = fakePrisma();
  const definite = await createOrResumeWhatsAppMediaAssetIntent(
    definiteState.prisma,
    intentInput(),
  );
  await markWhatsAppMediaAssetUploadFailure(definiteState.prisma, {
    scope: SCOPE,
    mediaAssetId: definite.mediaAssetId,
    uploadLeaseToken: definite.uploadLeaseToken,
    certainty: WHATSAPP_MEDIA_UPLOAD_CERTAINTY.DEFINITE,
    errorCode: 'X'.repeat(65),
    now: NOW,
  });
  assert.equal(definiteState.assets[0].status, 'FAILED');
  assert.equal(definiteState.assets[0].storage, null);
  assert.equal(definiteState.assets[0].storageLocatorHash, null);
  assert.equal(definiteState.assets[0].lastErrorCode, 'WHATSAPP_MEDIA_UPLOAD_FAILED');

  const uncertainState = fakePrisma();
  const uncertain = await createOrResumeWhatsAppMediaAssetIntent(
    uncertainState.prisma,
    intentInput(),
  );
  await markWhatsAppMediaAssetUploadFailure(uncertainState.prisma, {
    scope: SCOPE,
    mediaAssetId: uncertain.mediaAssetId,
    uploadLeaseToken: uncertain.uploadLeaseToken,
    certainty: WHATSAPP_MEDIA_UPLOAD_CERTAINTY.UNCERTAIN,
    errorCode: 'PROVIDER_TIMEOUT_AFTER_DISPATCH',
    now: NOW,
  });
  assert.equal(uncertainState.assets[0].status, 'DELETE_PENDING');
  assert.ok(uncertainState.assets[0].storage);
  assert.match(uncertainState.assets[0].deleteOperationKeyHash, /^[a-f0-9]{64}$/);
});

test('invalid provider identity is quarantined for deletion and cross-tenant finalization is hidden', async () => {
  const state = fakePrisma();
  const intent = await createOrResumeWhatsAppMediaAssetIntent(state.prisma, intentInput());
  await assert.rejects(
    markWhatsAppMediaAssetAvailable(state.prisma, {
      scope: { organizationId: 'org-b', projectId: SCOPE.projectId },
      mediaAssetId: intent.mediaAssetId,
      uploadLeaseToken: intent.uploadLeaseToken,
      uploaded: intent.upload.expectedStorage,
      fileName: 'pared.jpg',
      mimeType: 'image/jpeg',
      now: NOW,
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_NOT_FOUND',
  );

  await assert.rejects(
    markWhatsAppMediaAssetAvailable(state.prisma, {
      scope: SCOPE,
      mediaAssetId: intent.mediaAssetId,
      uploadLeaseToken: intent.uploadLeaseToken,
      uploaded: storedMedia('obrasaas/projects/project-b/whatsapp/evil.jpg'),
      fileName: 'pared.jpg',
      mimeType: 'image/jpeg',
      now: NOW,
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_STORAGE_SCOPE',
  );
  assert.equal(state.assets[0].status, 'DELETE_PENDING');
});

test('claim is an idempotent Message CAS with organization/project/source binding', async () => {
  const state = fakePrisma([], [messageFixture()]);
  const completed = await createAvailable(state);
  const claimed = await claimWhatsAppMediaAsset(state.transaction, {
    scope: SCOPE,
    mediaAssetId: completed.intent.mediaAssetId,
    messageConversationId: 'conversation-1',
    messageId: 'message-1',
    now: NOW,
  });
  assert.deepEqual(claimed, {
    mediaAssetId: completed.intent.mediaAssetId,
    status: 'CLAIMED',
    messageId: 'message-1',
    replayed: false,
  });
  assert.equal(state.assets[0].purgeEligibleAt, null);
  assert.match(state.assets[0].claimFingerprint, /^[a-f0-9]{64}$/);

  const replay = await claimWhatsAppMediaAsset(state.transaction, {
    scope: SCOPE,
    mediaAssetId: completed.intent.mediaAssetId,
    messageConversationId: 'conversation-1',
    messageId: 'message-1',
    now: NOW,
  });
  assert.equal(replay.replayed, true);
  assert.equal(claimedWhatsAppMediaAssetDescriptor(state.assets[0]).filename, 'pared.jpg');

  await assert.rejects(
    claimWhatsAppMediaAsset(state.transaction, {
      scope: { organizationId: 'org-b', projectId: SCOPE.projectId },
      mediaAssetId: completed.intent.mediaAssetId,
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      now: NOW,
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_NOT_FOUND',
  );
});

test('claim rejects a Message whose provider id or project scope differs', async () => {
  const wrongSource = fakePrisma([availableRow()], [messageFixture({
    externalId: 'wamid.other',
  })]);
  await assert.rejects(
    claimWhatsAppMediaAsset(wrongSource.transaction, {
      scope: SCOPE,
      mediaAssetId: 'media-asset-1',
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      now: NOW,
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_MESSAGE_SCOPE_MISMATCH',
  );
  assert.equal(wrongSource.assets[0].status, 'AVAILABLE');

  const wrongProject = fakePrisma([availableRow()], [messageFixture({
    conversation: {
      id: 'conversation-1',
      projectId: 'project-b',
      project: { organizationId: SCOPE.organizationId },
    },
  })]);
  await assert.rejects(
    claimWhatsAppMediaAsset(wrongProject.transaction, {
      scope: SCOPE,
      mediaAssetId: 'media-asset-1',
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      now: NOW,
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_MESSAGE_SCOPE_MISMATCH',
  );
});

test('cleanup deletes only orphans, forces reused=false, and leaves CLAIMED untouched', async () => {
  const expiredAt = new Date(NOW.getTime() - 1);
  const available = availableRow({
    id: 'available-expired',
    purgeEligibleAt: expiredAt,
    storage: { ...availableRow().storage, reused: true },
  });
  const uploading = availableRow({
    id: 'upload-uncertain',
    status: 'UPLOADING',
    fileName: null,
    mimeType: null,
    operationKeyHash: '3'.repeat(64),
    requestFingerprint: '4'.repeat(64),
    uploadLeaseToken: '22222222-2222-4222-8222-222222222222',
    uploadLeaseExpiresAt: expiredAt,
    purgeEligibleAt: PURGE_AT,
  });
  const claimed = availableRow({
    id: 'claimed-retained',
    status: 'CLAIMED',
    operationKeyHash: '5'.repeat(64),
    requestFingerprint: '6'.repeat(64),
    messageConversationId: 'conversation-1',
    messageId: 'message-1',
    claimedAt: NOW,
    claimFingerprint: '7'.repeat(64),
    purgeEligibleAt: null,
  });
  const recoverable = availableRow({
    id: 'available-processing-webhook',
    webhookEventId: 'webhook-event-processing',
    operationKeyHash: 'a'.repeat(64),
    requestFingerprint: 'b'.repeat(64),
    purgeEligibleAt: expiredAt,
  });
  const state = fakePrisma(
    [available, uploading, claimed, recoverable],
    [],
    [
      {
        id: 'webhook-event-1',
        projectId: SCOPE.projectId,
        provider: 'meta',
        eventType: 'message',
        status: 'PROCESSED',
        leaseToken: null,
        leaseExpiresAt: null,
      },
      {
        id: 'webhook-event-processing',
        projectId: SCOPE.projectId,
        provider: 'meta',
        eventType: 'message',
        status: 'PROCESSING',
        leaseToken: 'recoverable-lease',
        leaseExpiresAt: new Date(NOW.getTime() + 60_000),
      },
    ],
  );
  const deleted = [];
  const result = await cleanupWhatsAppMediaAssets(state.prisma, {
    now: NOW,
    limit: 10,
    randomUUID: (() => {
      let sequence = 0;
      return () => `33333333-3333-4333-8333-${String(++sequence).padStart(12, '0')}`;
    })(),
    deleteFile: async (storage) => {
      assert.equal(storage.reused, false);
      deleted.push(storage.pathname);
    },
  });
  assert.deepEqual(result, {
    expiredReserved: 1,
    uncertainReserved: 1,
    scanned: 2,
    deleted: 2,
    failed: 0,
    hasMore: false,
  });
  assert.equal(deleted.length, 2);
  assert.equal(state.assets.find((row) => row.id === 'available-expired').status, 'DELETED');
  assert.equal(state.assets.find((row) => row.id === 'available-expired').storage, null);
  assert.match(
    state.assets.find((row) => row.id === 'available-expired').tombstoneSha256,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(state.assets.find((row) => row.id === 'claimed-retained').status, 'CLAIMED');
  assert.equal(
    state.assets.find((row) => row.id === 'available-processing-webhook').status,
    'AVAILABLE',
  );
});

test('delete failures release the lease, apply bounded backoff, then reach a tombstone', async () => {
  const pending = availableRow({
    id: 'delete-pending',
    status: 'DELETE_PENDING',
    purgeEligibleAt: new Date(NOW.getTime() - 1),
    deleteOperationKeyHash: '8'.repeat(64),
    deleteRequestFingerprint: '9'.repeat(64),
    deleteRequestedAt: NOW,
    nextDeleteAttemptAt: NOW,
  });
  const state = fakePrisma([pending], [], [{
    id: 'webhook-event-1',
    projectId: SCOPE.projectId,
    provider: 'meta',
    eventType: 'message',
    status: 'FAILED',
    leaseToken: null,
    leaseExpiresAt: null,
  }]);
  const failed = await cleanupWhatsAppMediaAssets(state.prisma, {
    now: NOW,
    randomUUID: () => '44444444-4444-4444-8444-444444444444',
    deleteFile: async () => { throw new Error('provider unavailable'); },
  });
  assert.equal(failed.failed, 1);
  assert.equal(state.assets[0].status, 'DELETE_PENDING');
  assert.equal(state.assets[0].deleteLeaseToken, null);
  assert.equal(state.assets[0].nextDeleteAttemptAt.getTime(), NOW.getTime() + 30_000);

  let calls = 0;
  const backedOff = await cleanupWhatsAppMediaAssets(state.prisma, {
    now: new Date(NOW.getTime() + 29_999),
    deleteFile: async () => { calls += 1; },
  });
  assert.equal(backedOff.scanned, 0);
  assert.equal(calls, 0);

  const recovered = await cleanupWhatsAppMediaAssets(state.prisma, {
    now: new Date(NOW.getTime() + 30_000),
    randomUUID: () => '55555555-5555-4555-8555-555555555555',
    deleteFile: async () => { calls += 1; },
  });
  assert.equal(recovered.deleted, 1);
  assert.equal(state.assets[0].status, 'DELETED');
  assert.equal(calls, 1);
});

test('claimed descriptor fails closed for non-CLAIMED or corrupt v2 rows', () => {
  assert.throws(
    () => claimedWhatsAppMediaAssetDescriptor(availableRow()),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_NOT_CLAIMED',
  );
  assert.throws(
    () => claimedWhatsAppMediaAssetDescriptor(availableRow({
      status: 'CLAIMED',
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      claimedAt: NOW,
      claimFingerprint: 'a'.repeat(64),
      purgeEligibleAt: null,
      fileName: '../escape.jpg',
    })),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_INVALID',
  );
});

test('durable descriptors accept only provider-coherent Vercel and Cloudinary URLs', () => {
  const vercel = availableRow();
  const vercelDescriptor = claimedWhatsAppMediaAssetDescriptor({
    ...vercel,
    status: 'CLAIMED',
    messageConversationId: 'conversation-1',
    messageId: 'message-1',
    claimedAt: NOW,
    claimFingerprint: 'c'.repeat(64),
    purgeEligibleAt: null,
  });
  assert.match(vercelDescriptor.url, /\.private\.blob\.vercel-storage\.com\//);
  assert.throws(
    () => claimedWhatsAppMediaAssetDescriptor({
      ...vercel,
      status: 'CLAIMED',
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      claimedAt: NOW,
      claimFingerprint: 'f'.repeat(64),
      purgeEligibleAt: null,
      storage: {
        ...vercel.storage,
        assetId: `https://tenant.public.blob.vercel-storage.com/${vercel.storage.pathname}`,
      },
    }),
    (error) => [
      'WHATSAPP_MEDIA_ASSET_STORAGE_SCOPE',
      'WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID',
    ].includes(error.code),
  );

  const publicId = `obrasaas/projects/project-a/whatsapp/${SCOPE.phoneNumberId}/cloud-photo`;
  const cloudinaryStorage = {
    provider: 'cloudinary',
    assetId: 'opaque-cloudinary-asset-id',
    publicId,
    pathname: null,
    resourceType: 'image',
    format: 'jpg',
    bytes: 4,
    reused: false,
    deliveryUrl: `https://res.cloudinary.com/demo/image/authenticated/v123/${publicId}.jpg`,
  };
  const cloudinary = {
    ...availableRow(),
    storageProvider: 'cloudinary',
    storage: cloudinaryStorage,
    storageLocatorHash: whatsAppMediaAssetHash(JSON.stringify({
      path: ['storage', 'publicId'],
      provider: 'cloudinary',
      value: publicId,
    })),
  };
  assert.equal(
    claimedWhatsAppMediaAssetDescriptor({
      ...cloudinary,
      status: 'CLAIMED',
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      claimedAt: NOW,
      claimFingerprint: 'd'.repeat(64),
      purgeEligibleAt: null,
    }).url,
    cloudinaryStorage.deliveryUrl,
  );
  assert.throws(
    () => claimedWhatsAppMediaAssetDescriptor({
      ...cloudinary,
      status: 'CLAIMED',
      messageConversationId: 'conversation-1',
      messageId: 'message-1',
      claimedAt: NOW,
      claimFingerprint: 'e'.repeat(64),
      purgeEligibleAt: null,
      storage: {
        ...cloudinaryStorage,
        deliveryUrl: 'https://res.cloudinary.com/demo/image/authenticated/v123/other.jpg',
      },
    }),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_DELIVERY_URL_INVALID',
  );
});

test('message media resolution is v2-authoritative and requires the loaded relation', () => {
  const row = availableRow({
    status: 'CLAIMED',
    messageConversationId: 'conversation-1',
    messageId: 'message-1',
    claimedAt: NOW,
    claimFingerprint: 'f'.repeat(64),
    purgeEligibleAt: null,
  });
  const message = {
    id: 'message-1',
    conversationId: 'conversation-1',
    externalId: PROVIDER_MESSAGE_ID,
    direction: 'INBOUND',
    kind: 'IMAGE',
    whatsappMediaAsset: row,
  };
  assert.equal(resolveClaimedWhatsAppMessageMedia(message).descriptor.assetId, row.id);
  assert.equal(resolveClaimedWhatsAppMessageMedia({ ...message, whatsappMediaAsset: null }), null);
  assert.throws(
    () => resolveClaimedWhatsAppMessageMedia(({ ...message, whatsappMediaAsset: undefined })),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_NOT_CLAIMED',
  );
  const relationMissing = { ...message };
  delete relationMissing.whatsappMediaAsset;
  assert.throws(
    () => resolveClaimedWhatsAppMessageMedia(relationMissing),
    (error) => error.code === 'WHATSAPP_MEDIA_ASSET_RELATION_REQUIRED',
  );
});
