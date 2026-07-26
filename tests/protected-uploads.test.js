import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProtectedUploadReplay,
  claimProtectedUpload,
  cleanupProtectedUploads,
  deleteProtectedUpload,
  PROTECTED_UPLOAD_PROVIDER_TIMEOUT_MS,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadClaimFingerprint,
  protectedUploadErrorResponse,
  protectedUploadHash,
  publicProtectedAttachment,
  stageProtectedUpload,
} from '../src/lib/protected-uploads.js';
import { PROTECTED_UPLOAD_QUOTAS } from '../src/lib/protected-upload-policy.js';

const BASE_SCOPE = { organizationId: 'org-a', projectId: 'project-a' };
const NOW = new Date('2026-07-26T18:00:00.000Z');

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
      if ('gt' in expected && !(actual > expected.gt)) return false;
      if ('gte' in expected && !(actual >= expected.gte)) return false;
      if ('lt' in expected && !(actual < expected.lt)) return false;
      if ('lte' in expected && !(actual <= expected.lte)) return false;
      if ('in' in expected && !expected.in.includes(actual)) return false;
      return true;
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

function fakePrisma(initial = [], hooks = {}) {
  const rows = initial.map((row) => ({ ...row }));
  let nextId = rows.length + 1;
  const rawCalls = [];
  const protectedUpload = {
    async findFirst({ where, select } = {}) {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? selected(row, select) : null;
    },
    async findMany({ where, orderBy: _orderBy, take } = {}) {
      return rows.filter((candidate) => matches(candidate, where)).slice(0, take)
        .map((row) => ({ ...row }));
    },
    async count({ where } = {}) {
      return rows.filter((candidate) => matches(candidate, where)).length;
    },
    async aggregate({ where } = {}) {
      const size = rows
        .filter((candidate) => matches(candidate, where))
        .reduce((total, row) => total + Number(row.size || 0), 0);
      return { _sum: { size } };
    },
    async create({ data }) {
      if (rows.some((candidate) => (
        candidate.projectId === data.projectId
        && candidate.actorId === data.actorId
        && candidate.purpose === data.purpose
        && candidate.operationKeyHash === data.operationKeyHash
      ))) {
        const error = new Error('unique conflict');
        error.code = 'P2002';
        throw error;
      }
      const row = {
        id: `upload-${nextId++}`,
        claimedAt: null,
        claimedEntityType: null,
        claimedEntityId: null,
        claimFingerprint: null,
        deleteOperationKeyHash: null,
        deleteRequestFingerprint: null,
        deleteRequestedAt: null,
        deleteAttemptCount: 0,
        deleteLeaseExpiresAt: null,
        nextDeleteAttemptAt: null,
        deletedAt: null,
        lastErrorCode: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...data,
      };
      rows.push(row);
      return row;
    },
    async updateMany({ where, data }) {
      if (hooks.beforeUpdateMany) await hooks.beforeUpdateMany({ where, data, rows });
      const matching = rows.filter((candidate) => matches(candidate, where));
      if (data.deleteOperationKeyHash) {
        const conflict = rows.find((candidate) => (
          !matching.includes(candidate)
          && candidate.projectId === matching[0]?.projectId
          && candidate.actorId === matching[0]?.actorId
          && candidate.purpose === matching[0]?.purpose
          && candidate.deleteOperationKeyHash === data.deleteOperationKeyHash
        ));
        if (conflict) {
          const error = new Error('unique conflict');
          error.code = 'P2002';
          throw error;
        }
      }
      for (const row of matching) applyData(row, data);
      return { count: matching.length };
    },
  };
  const transaction = {
    protectedUpload,
    $executeRawUnsafe: async (...args) => rawCalls.push(args),
  };
  const prisma = {
    ...transaction,
    async $transaction(callback) {
      return callback(transaction);
    },
  };
  return { prisma, rows, transaction, rawCalls };
}

function storedUpload(pathname, bytes = 4) {
  return {
    provider: 'vercel-blob',
    assetId: null,
    publicId: pathname,
    pathname,
    bytes,
    resourceType: 'image',
    format: 'jpg',
    reused: false,
  };
}

function reservation(overrides = {}) {
  const pathname = 'obrasaas/projects/project-a/cash-receipts/object.jpg';
  return {
    id: 'upload-1',
    organizationId: BASE_SCOPE.organizationId,
    projectId: BASE_SCOPE.projectId,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    status: 'AVAILABLE',
    operationKeyHash: 'a'.repeat(64),
    requestFingerprint: 'b'.repeat(64),
    storageProvider: 'vercel-blob',
    storage: storedUpload(pathname),
    mimeType: 'image/jpeg',
    filename: 'ticket.jpg',
    size: 4,
    sha256: 'c'.repeat(64),
    expiresAt: new Date(NOW.getTime() + 60_000),
    uploadAttemptCount: 1,
    uploadLeaseExpiresAt: null,
    claimedAt: null,
    claimedEntityType: null,
    claimedEntityId: null,
    claimFingerprint: null,
    deleteOperationKeyHash: null,
    deleteRequestFingerprint: null,
    deleteRequestedAt: null,
    deleteAttemptCount: 0,
    deleteLeaseExpiresAt: null,
    nextDeleteAttemptAt: null,
    deletedAt: null,
    lastErrorCode: null,
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: NOW,
    ...overrides,
  };
}

function cashFile(contents = [0xff, 0xd8, 0xff, 0xd9]) {
  return new File([Buffer.from(contents)], 'ticket.jpg', { type: 'image/jpeg' });
}

function stagingInput(overrides = {}) {
  const expectedPath = 'obrasaas/projects/project-a/cash-receipts/deterministic.jpg';
  return {
    scope: BASE_SCOPE,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    idempotencyKey: 'cash-operation-1234',
    file: cashFile(),
    sha256: 'c'.repeat(64),
    now: NOW,
    clock: () => NOW,
    resolveProvider: () => 'vercel-blob',
    expectedStorageForUpload: (file) => storedUpload(expectedPath, file.size),
    uploadFile: async (file) => storedUpload(expectedPath, file.size),
    ...overrides,
  };
}

test('intent and deterministic provider identity exist before external upload; replay is quota-free', async () => {
  const state = fakePrisma();
  let providerCalls = 0;
  const input = stagingInput({
    uploadFile: async (file, options) => {
      providerCalls += 1;
      assert.equal(state.rows.length, 1);
      assert.equal(state.rows[0].status, 'UPLOADING');
      assert.equal(state.rows[0].storageProvider, 'vercel-blob');
      assert.equal(state.rows[0].storage.pathname, 'obrasaas/projects/project-a/cash-receipts/deterministic.jpg');
      assert.equal(options.provider, 'vercel-blob');
      assert.ok(options.signal instanceof AbortSignal);
      assert.ok(PROTECTED_UPLOAD_PROVIDER_TIMEOUT_MS < 2 * 60 * 1000);
      return storedUpload(state.rows[0].storage.pathname, file.size);
    },
  });
  const created = await stageProtectedUpload(state.prisma, input);
  const replayed = await stageProtectedUpload(state.prisma, {
    ...input,
    resolveProvider: () => assert.fail('a committed replay must not resolve current provider config'),
  });
  assert.deepEqual(created, { uploadId: 'upload-1' });
  assert.deepEqual(replayed, created);
  assert.equal(providerCalls, 1);
  assert.equal(state.rows[0].status, 'AVAILABLE');
  assert.equal(state.rawCalls.filter(([statement]) => /pg_advisory_xact_lock/.test(statement)).length, 2);
});

test('a live upload lease prevents concurrent provider dispatch', async () => {
  const state = fakePrisma();
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let providerCalls = 0;
  const input = stagingInput({
    uploadFile: async (file) => {
      providerCalls += 1;
      await blocked;
      return storedUpload('obrasaas/projects/project-a/cash-receipts/deterministic.jpg', file.size);
    },
  });
  const first = stageProtectedUpload(state.prisma, input);
  while (state.rows.length === 0) await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    stageProtectedUpload(state.prisma, input),
    (error) => error.code === 'PROTECTED_UPLOAD_IN_PROGRESS' && error.status === 409,
  );
  assert.equal(providerCalls, 1);
  release();
  await first;
});

test('stale retry uses the persisted provider and path even after provider configuration changes', async () => {
  const state = fakePrisma();
  const first = stagingInput({
    uploadFile: async () => { throw new Error('response lost'); },
  });
  await assert.rejects(
    stageProtectedUpload(state.prisma, first),
    (error) => error.code === 'PROTECTED_UPLOAD_PROVIDER_FAILED',
  );
  assert.equal(state.rows[0].status, 'UPLOADING');
  assert.equal(state.rows[0].lastErrorCode, 'PROVIDER_UPLOAD_FAILED');

  const retryAt = new Date(NOW.getTime() + 1);
  let providerOptions;
  const result = await stageProtectedUpload(state.prisma, {
    ...first,
    now: retryAt,
    clock: () => retryAt,
    resolveProvider: () => assert.fail('retry must not select a new provider'),
    expectedStorageForUpload: () => assert.fail('retry must use persisted storage identity'),
    uploadFile: async (file, options) => {
      providerOptions = options;
      return storedUpload(state.rows[0].storage.pathname, file.size);
    },
  });
  assert.deepEqual(result, { uploadId: 'upload-1' });
  assert.equal(providerOptions.provider, 'vercel-blob');
  assert.equal(state.rows[0].status, 'AVAILABLE');
  assert.equal(state.rows[0].uploadAttemptCount, 2);
});

test('mutated replay is rejected before quota or provider work; actor namespace is independent', async () => {
  const state = fakePrisma();
  const base = stagingInput();
  await stageProtectedUpload(state.prisma, base);
  let providerCalls = 0;
  await assert.rejects(
    stageProtectedUpload(state.prisma, {
      ...base,
      sha256: 'd'.repeat(64),
      uploadFile: async () => { providerCalls += 1; },
    }),
    (error) => error.code === 'IDEMPOTENCY_KEY_REUSED',
  );
  await stageProtectedUpload(state.prisma, {
    ...base,
    actorId: 'actor-b',
    uploadFile: async (file) => {
      providerCalls += 1;
      return storedUpload('obrasaas/projects/project-a/cash-receipts/deterministic.jpg', file.size);
    },
  });
  assert.equal(providerCalls, 1);
  assert.equal(state.rows.length, 2);
});

test('out-of-scope provider descriptor is never deleted; only expected owned identity is cleaned', async () => {
  const state = fakePrisma();
  const deleted = [];
  await assert.rejects(
    stageProtectedUpload(state.prisma, stagingInput({
      uploadFile: async (file) => storedUpload(
        'obrasaas/projects/project-b/cash-receipts/foreign.jpg',
        file.size,
      ),
      deleteFile: async (storage) => deleted.push(storage.pathname),
    })),
    (error) => error.code === 'PROTECTED_UPLOAD_STORAGE_SCOPE',
  );
  assert.deepEqual(deleted, ['obrasaas/projects/project-a/cash-receipts/deterministic.jpg']);
  assert.equal(state.rows[0].status, 'DELETED');
});

test('in-scope size mismatch is safely deleted, while unexpected in-scope identity is not', async () => {
  const sizeState = fakePrisma();
  const sizeDeleted = [];
  await assert.rejects(
    stageProtectedUpload(sizeState.prisma, stagingInput({
      uploadFile: async () => storedUpload(
        'obrasaas/projects/project-a/cash-receipts/deterministic.jpg',
        3,
      ),
      deleteFile: async (storage) => sizeDeleted.push(storage.pathname),
    })),
    (error) => error.code === 'PROTECTED_UPLOAD_STORAGE_SIZE_MISMATCH',
  );
  assert.deepEqual(sizeDeleted, ['obrasaas/projects/project-a/cash-receipts/deterministic.jpg']);

  const driftState = fakePrisma();
  const driftDeleted = [];
  await assert.rejects(
    stageProtectedUpload(driftState.prisma, stagingInput({
      uploadFile: async (file) => storedUpload(
        'obrasaas/projects/project-a/cash-receipts/unexpected.jpg',
        file.size,
      ),
      deleteFile: async (storage) => driftDeleted.push(storage.pathname),
    })),
    (error) => error.code === 'PROTECTED_UPLOAD_PROVIDER_DRIFT',
  );
  assert.deepEqual(driftDeleted, ['obrasaas/projects/project-a/cash-receipts/deterministic.jpg']);
});

test('crash after provider success leaves a durable intent that a later retry reconciles', async () => {
  let failFinalize = true;
  const state = fakePrisma([], {
    beforeUpdateMany: ({ data }) => {
      if (data.status === 'AVAILABLE' && failFinalize) throw new Error('database unavailable');
    },
  });
  const input = stagingInput();
  await assert.rejects(stageProtectedUpload(state.prisma, input), /database unavailable/);
  assert.equal(state.rows.length, 1);
  assert.equal(state.rows[0].status, 'UPLOADING');
  assert.equal(state.rows[0].storage.pathname, 'obrasaas/projects/project-a/cash-receipts/deterministic.jpg');

  failFinalize = false;
  const retryAt = new Date(NOW.getTime() + (2 * 60 * 1000) + 1);
  await stageProtectedUpload(state.prisma, {
    ...input,
    now: retryAt,
    clock: () => retryAt,
  });
  assert.equal(state.rows[0].status, 'AVAILABLE');
  assert.equal(state.rows[0].uploadAttemptCount, 2);
});

test('a provider result arriving after lease expiry cannot finalize or delete the shared object', async () => {
  const state = fakePrisma();
  let clockCalls = 0;
  const deleted = [];
  await assert.rejects(
    stageProtectedUpload(state.prisma, stagingInput({
      clock: () => {
        clockCalls += 1;
        return new Date(NOW.getTime() + UPLOAD_TEST_LEASE_MS + 1);
      },
      deleteFile: async (storage) => deleted.push(storage.pathname),
    })),
    (error) => error.code === 'PROTECTED_UPLOAD_LEASE_LOST',
  );
  assert.ok(clockCalls >= 1);
  assert.equal(state.rows[0].status, 'UPLOADING');
  assert.deepEqual(deleted, []);
});

const UPLOAD_TEST_LEASE_MS = 2 * 60 * 1000;

test('durable quota rejects before provider write and returns Retry-After', async () => {
  const rows = Array.from({ length: PROTECTED_UPLOAD_QUOTAS.actorProjectActive }, (_, index) => (
    reservation({
      id: `active-${index}`,
      status: 'AVAILABLE',
      operationKeyHash: String(index).padStart(64, '0'),
    })
  ));
  const state = fakePrisma(rows);
  let providerCalls = 0;
  let limited;
  await assert.rejects(
    stageProtectedUpload(state.prisma, stagingInput({
      idempotencyKey: 'new-operation-1234',
      uploadFile: async () => { providerCalls += 1; },
    })),
    (error) => {
      limited = error;
      return error.code === 'PROTECTED_UPLOAD_ACTOR_QUOTA' && error.status === 429;
    },
  );
  assert.equal(providerCalls, 0);
  const response = protectedUploadErrorResponse(limited);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '300');
});

test('public attachment serialization never exposes provider or reservation internals', () => {
  const attachment = publicProtectedAttachment({
    provider: 'vercel-blob',
    storage: reservation().storage,
    visibility: 'private',
    mimeType: 'image/jpeg',
    filename: 'ticket.jpg',
    size: 4,
    sha256: 'c'.repeat(64),
    protectedUploadId: 'upload-1',
    requestFingerprint: 'd'.repeat(64),
  });
  assert.deepEqual(attachment, {
    available: true,
    visibility: 'private',
    mimeType: 'image/jpeg',
    filename: 'ticket.jpg',
    size: 4,
  });
  assert.equal('storage' in attachment, false);
});

test('claim is single-use and records a typed claim fingerprint', async () => {
  const state = fakePrisma([reservation()]);
  const fingerprint = protectedUploadClaimFingerprint({ amount: '10.00', uploadId: 'upload-1' });
  const entity = await claimProtectedUpload(state.transaction, {
    scope: BASE_SCOPE,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    uploadId: 'upload-1',
    claimFingerprint: fingerprint,
    now: NOW,
    createEntity: async (descriptor) => ({ id: 'cash-1', receipt: descriptor }),
  });
  assert.equal(entity.id, 'cash-1');
  assert.equal(state.rows[0].status, 'CLAIMED');
  assert.equal(state.rows[0].claimFingerprint, fingerprint);
  await assert.rejects(
    claimProtectedUpload(state.transaction, {
      scope: BASE_SCOPE,
      actorId: 'actor-a',
      purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
      uploadId: 'upload-1',
      claimFingerprint: fingerprint,
      now: NOW,
      createEntity: async () => ({ id: 'cash-2' }),
    }),
    (error) => error.code === 'PROTECTED_UPLOAD_ALREADY_CLAIMED',
  );
});

test('business replay requires the original claim fingerprint and upload id', async () => {
  const fingerprint = 'd'.repeat(64);
  const state = fakePrisma([reservation({
    status: 'CLAIMED',
    claimedAt: NOW,
    claimedEntityType: 'CashMovement',
    claimedEntityId: 'cash-1',
    claimFingerprint: fingerprint,
  })]);
  await assert.doesNotReject(assertProtectedUploadReplay(state.transaction, {
    scope: BASE_SCOPE,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    uploadId: 'upload-1',
    entityId: 'cash-1',
    entityProtectedUploadId: 'upload-1',
    claimFingerprint: fingerprint,
    entityHasAttachment: true,
  }));
  await assert.rejects(
    assertProtectedUploadReplay(state.transaction, {
      scope: BASE_SCOPE,
      actorId: 'actor-a',
      purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
      uploadId: 'upload-1',
      entityId: 'cash-1',
      entityProtectedUploadId: 'upload-1',
      claimFingerprint: 'e'.repeat(64),
      entityHasAttachment: true,
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED',
  );
});

test('delete and claim CAS are mutually exclusive; terminal DELETE is key-agnostic', async () => {
  const state = fakePrisma([reservation()]);
  const deleted = [];
  await deleteProtectedUpload(state.prisma, {
    scope: BASE_SCOPE,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    uploadId: 'upload-1',
    idempotencyKey: 'delete-operation-1234',
    now: NOW,
    deleteFile: async (storage) => deleted.push(storage.pathname),
  });
  assert.equal(state.rows[0].status, 'DELETED');
  assert.deepEqual(deleted, ['obrasaas/projects/project-a/cash-receipts/object.jpg']);
  await assert.doesNotReject(deleteProtectedUpload(state.prisma, {
    scope: BASE_SCOPE,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    uploadId: 'upload-1',
    idempotencyKey: 'new-ui-delete-key-1234',
    now: NOW,
    deleteFile: async () => assert.fail('terminal replay cannot call provider'),
  }));
  await assert.rejects(
    claimProtectedUpload(state.transaction, {
      scope: BASE_SCOPE,
      actorId: 'actor-a',
      purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
      uploadId: 'upload-1',
      claimFingerprint: 'd'.repeat(64),
      now: NOW,
      createEntity: async () => ({ id: 'cash-1' }),
    }),
    (error) => error.code === 'PROTECTED_UPLOAD_DELETED',
  );
});

test('an internally expired DELETE_PENDING returns progress, then terminal replay unblocks UI', async () => {
  const operationKeyHash = protectedUploadHash('system:PROTECTED_UPLOAD_EXPIRED:upload-1');
  const requestFingerprint = protectedUploadHash(
    `system:PROTECTED_UPLOAD_EXPIRED:upload-1:${'b'.repeat(64)}`,
  );
  const pending = reservation({
    status: 'DELETE_PENDING',
    deleteOperationKeyHash: operationKeyHash,
    deleteRequestFingerprint: requestFingerprint,
    deleteRequestedAt: NOW,
    nextDeleteAttemptAt: new Date(NOW.getTime() + 30_000),
    // A prior provider failure overwrites the diagnostic code. Recognition
    // must still use the immutable internal hashes, never lastErrorCode.
    lastErrorCode: 'PROTECTED_UPLOAD_PROVIDER_DELETE_FAILED',
  });
  const state = fakePrisma([pending]);
  await assert.rejects(
    deleteProtectedUpload(state.prisma, {
      scope: BASE_SCOPE,
      actorId: 'actor-a',
      purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
      uploadId: 'upload-1',
      idempotencyKey: 'ui-delete-operation-1234',
      now: NOW,
      deleteFile: async () => {},
    }),
    (error) => error.code === 'PROTECTED_UPLOAD_DELETE_IN_PROGRESS' && error.retryAfterSeconds === 30,
  );
  state.rows[0].status = 'DELETED';
  state.rows[0].deletedAt = NOW;
  state.rows[0].nextDeleteAttemptAt = null;
  await assert.doesNotReject(deleteProtectedUpload(state.prisma, {
    scope: BASE_SCOPE,
    actorId: 'actor-a',
    purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
    uploadId: 'upload-1',
    idempotencyKey: 'ui-delete-operation-1234',
    now: NOW,
    deleteFile: async () => assert.fail('terminal tombstone cannot call provider'),
  }));
});

test('cleanup skips live leases and CLAIMED rows, applies backoff, and reports safe metrics', async () => {
  const liveUploading = Array.from({ length: 20 }, (_, index) => reservation({
    id: `live-${index}`,
    status: 'UPLOADING',
    operationKeyHash: `${index + 100}`.padStart(64, '0'),
    expiresAt: new Date(NOW.getTime() - 1),
    uploadLeaseExpiresAt: new Date(NOW.getTime() + 60_000),
  }));
  const expired = reservation({
    id: 'expired-1',
    operationKeyHash: 'f'.repeat(64),
    expiresAt: new Date(NOW.getTime() - 1),
  });
  const claimed = reservation({
    id: 'claimed-1',
    operationKeyHash: '9'.repeat(64),
    status: 'CLAIMED',
    claimedAt: NOW,
    claimedEntityType: 'CashMovement',
    claimedEntityId: 'cash-1',
    claimFingerprint: '8'.repeat(64),
    expiresAt: new Date(NOW.getTime() - 1),
  });
  const state = fakePrisma([...liveUploading, expired, claimed]);
  const first = await cleanupProtectedUploads(state.prisma, {
    now: NOW,
    limit: 2,
    deleteFile: async () => { throw new Error('provider unavailable'); },
  });
  assert.deepEqual(first, {
    expiredReserved: 1,
    scanned: 1,
    deleted: 0,
    failed: 1,
    hasMore: false,
  });
  assert.equal(state.rows.find((row) => row.id === 'expired-1').status, 'DELETE_PENDING');
  assert.equal(state.rows.find((row) => row.id === 'expired-1').lastErrorCode, 'PROTECTED_UPLOAD_PROVIDER_DELETE_FAILED');
  assert.equal(state.rows.find((row) => row.id === 'claimed-1').status, 'CLAIMED');
  assert.ok(liveUploading.every((_, index) => state.rows.find((row) => row.id === `live-${index}`).status === 'UPLOADING'));

  const immediate = await cleanupProtectedUploads(state.prisma, {
    now: NOW,
    limit: 2,
    deleteFile: async () => assert.fail('backoff row must not dispatch'),
  });
  assert.equal(immediate.scanned, 0);
  const retryAt = new Date(NOW.getTime() + 31_000);
  const retried = await cleanupProtectedUploads(state.prisma, {
    now: retryAt,
    limit: 2,
    deleteFile: async () => {},
  });
  assert.equal(retried.deleted, 1);
});

test('cleanup performs at most 100 provider deletions per batch and reports remaining work', async () => {
  const rows = Array.from({ length: 130 }, (_, index) => reservation({
    id: `pending-${index}`,
    operationKeyHash: `${index + 1}`.padStart(64, '0'),
    status: 'DELETE_PENDING',
    deleteOperationKeyHash: `${index + 501}`.padStart(64, '0'),
    deleteRequestFingerprint: `${index + 1_001}`.padStart(64, '0'),
    deleteRequestedAt: NOW,
    nextDeleteAttemptAt: NOW,
  }));
  const state = fakePrisma(rows);
  let providerCalls = 0;
  const result = await cleanupProtectedUploads(state.prisma, {
    now: NOW,
    limit: 500,
    deleteFile: async () => { providerCalls += 1; },
  });
  assert.equal(result.scanned, 100);
  assert.equal(result.deleted, 100);
  assert.equal(result.hasMore, true);
  assert.equal(providerCalls, 100);
});

test('cleanup can delete the same full batch that it just reserved as expired', async () => {
  const rows = Array.from({ length: 130 }, (_, index) => reservation({
    id: `expired-batch-${index}`,
    operationKeyHash: `${index + 2_001}`.padStart(64, '0'),
    expiresAt: new Date(NOW.getTime() - 1),
  }));
  const state = fakePrisma(rows);
  let providerCalls = 0;

  const result = await cleanupProtectedUploads(state.prisma, {
    now: NOW,
    limit: 100,
    deleteFile: async () => { providerCalls += 1; },
  });

  assert.equal(result.expiredReserved, 100);
  assert.equal(result.scanned, 100);
  assert.equal(result.deleted, 100);
  assert.equal(result.failed, 0);
  assert.equal(result.hasMore, true);
  assert.equal(providerCalls, 100);
  assert.equal(state.rows.filter((row) => row.status === 'DELETED').length, 100);
  assert.equal(state.rows.filter((row) => row.status === 'AVAILABLE').length, 30);
});

test('cleanup stops before dispatch when its serverless deadline is exhausted', async () => {
  const state = fakePrisma([reservation({
    id: 'deadline-pending',
    status: 'DELETE_PENDING',
    deleteOperationKeyHash: 'a'.repeat(64),
    deleteRequestFingerprint: 'b'.repeat(64),
    deleteRequestedAt: NOW,
    nextDeleteAttemptAt: NOW,
  })]);

  const result = await cleanupProtectedUploads(state.prisma, {
    now: NOW,
    deadlineAt: NOW,
    clock: () => NOW,
    deleteFile: async () => assert.fail('an exhausted run cannot contact storage'),
  });

  assert.deepEqual(result, {
    expiredReserved: 0,
    scanned: 0,
    deleted: 0,
    failed: 0,
    hasMore: true,
  });
});

test('cleanup times out a hung provider and schedules bounded retry', async () => {
  const state = fakePrisma([reservation({
    id: 'hung-provider',
    status: 'DELETE_PENDING',
    deleteOperationKeyHash: 'c'.repeat(64),
    deleteRequestFingerprint: 'd'.repeat(64),
    deleteRequestedAt: NOW,
    nextDeleteAttemptAt: NOW,
  })]);

  const result = await cleanupProtectedUploads(state.prisma, {
    now: NOW,
    deleteTimeoutMs: 5,
    deleteFile: async () => new Promise(() => {}),
  });

  assert.equal(result.scanned, 1);
  assert.equal(result.failed, 1);
  assert.equal(state.rows[0].status, 'DELETE_PENDING');
  assert.equal(state.rows[0].lastErrorCode, 'PROTECTED_UPLOAD_PROVIDER_DELETE_TIMEOUT');
  assert.ok(state.rows[0].nextDeleteAttemptAt > NOW);
});
