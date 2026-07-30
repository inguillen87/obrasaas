import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  createAndDiscoverWorkerPersonRequest,
  normalizeDataSubjectRequestInput,
} from '../src/lib/data-subject-requests.js';
import {
  buildWorkerPersonDiscoveryManifest,
  privacyDiscoveryCatalogDescriptor,
} from '../src/lib/privacy-discovery.js';

const KEY = crypto.randomBytes(32);
const KEY_ID = 'privacy-request-test-v1';
const NOW = new Date('2026-07-29T19:20:30.123Z');

function database({ actor = true, person = true, lockError = null } = {}) {
  const state = { requests: [], manifests: [], items: [], transactionOptions: [] };

  function decorated(row) {
    if (!row) return null;
    const manifest = state.manifests.find((entry) => (
      entry.organizationId === row.organizationId && entry.requestId === row.id
    ));
    return {
      ...row,
      manifest: manifest ? {
        ...manifest,
        items: state.items
          .filter((item) => item.manifestId === manifest.id)
          .sort((left, right) => left.ordinal - right.ordinal),
      } : null,
    };
  }

  const delegates = {
    tenantMembership: {
      async findFirst(query) {
        return actor && query.where.id === 'membership-admin-a'
          ? {
            id: 'membership-admin-a',
            organizationId: 'organization-a',
            userId: 'user-a',
            tenantRole: 'ADMIN',
            status: 'ACTIVE',
          }
          : null;
      },
    },
    workerPerson: {
      async findFirst(query) {
        return person
          && query.where.id === 'person-a'
          && query.where.organizationId === 'organization-a'
          ? { id: 'person-a', organizationId: 'organization-a' }
          : null;
      },
    },
    dataSubjectRequest: {
      async count({ where }) {
        return state.requests.filter((entry) => (
          entry.organizationId === where.organizationId
          && (!where.receivedByMembershipId
            || entry.receivedByMembershipId === where.receivedByMembershipId)
          && new Date(entry.receivedAt).getTime() >= new Date(where.receivedAt.gte).getTime()
        )).length;
      },
      async findFirst(query) {
        const row = state.requests.find((entry) => (
          (!query.where.id || entry.id === query.where.id)
          && (!query.where.organizationId || entry.organizationId === query.where.organizationId)
          && (!query.where.operationKeyHash || entry.operationKeyHash === query.where.operationKeyHash)
        ));
        return decorated(row);
      },
      async create({ data }) {
        const row = {
          ...data,
          subjectMembershipId: null,
          status: 'RECEIVED',
          attestedByMembershipId: null,
          completedByMembershipId: null,
          discoveryCatalogVersion: null,
          discoveryCatalogSha256: null,
          receivedAt: new Date(NOW),
          attestedAt: null,
          discoveryStartedAt: null,
          terminalAt: null,
          terminalReasonCode: null,
          revision: 0,
        };
        state.requests.push(row);
        return decorated(row);
      },
      async update({ where, data }) {
        const row = state.requests.find((entry) => entry.id === where.id);
        assert.ok(row);
        for (const [key, value] of Object.entries(data)) {
          if (key === 'revision') row.revision += value.increment;
          else row[key] = value;
        }
        if (row.status === 'AUTHORITY_ATTESTED') row.attestedAt = new Date(NOW);
        if (row.status === 'DISCOVERING') row.discoveryStartedAt = new Date(NOW);
        if (['DISCOVERED', 'DISCOVERY_BLOCKED', 'DISCOVERY_FAILED'].includes(row.status)) {
          row.terminalAt = new Date(NOW);
        }
        return decorated(row);
      },
    },
    dataSubjectDiscoveryItem: {
      async createMany({ data }) {
        state.items.push(...data.map((entry) => ({ ...entry })));
        return { count: data.length };
      },
    },
    dataSubjectDiscoveryManifest: {
      async create({ data }) {
        const row = { ...data, sealedAt: new Date(NOW) };
        state.manifests.push(row);
        return row;
      },
    },
  };
  const prisma = {
    ...delegates,
    async $transaction(operation, options) {
      state.transactionOptions.push(options);
      return operation(delegates);
    },
  };
  delegates.$executeRawUnsafe = async (statement) => {
    if (lockError && /pg_advisory_xact_lock/.test(statement)) throw lockError;
    return 1;
  };
  delegates.$queryRawUnsafe = async () => [{ observedAt: new Date(NOW) }];
  return { prisma, state };
}

function discovery(input) {
  const rowsByFamily = new Map(
    privacyDiscoveryCatalogDescriptor().records.map((entry) => [entry.family, []]),
  );
  rowsByFamily.set('worker-person', [{
    id: input.personId,
    recordVersion: NOW.toISOString(),
  }]);
  return buildWorkerPersonDiscoveryManifest({
    organizationId: input.organizationId,
    requestId: input.requestId,
    requestOperationKeyHash: input.requestOperationKeyHash,
    requestFingerprint: input.requestFingerprint,
    sealedByMembershipId: input.sealedByMembershipId,
    sourceSnapshotAt: NOW,
    rowsByFamily,
    key: input.key,
    keyId: input.keyId,
  });
}

function operation(stored, overrides = {}) {
  return createAndDiscoverWorkerPersonRequest(stored.prisma, {
    scope: {
      organizationId: 'organization-a',
      actorMembershipId: 'membership-admin-a',
    },
    input: { personId: 'person-a', requestType: 'ACCESS' },
    idempotencyKey: 'privacy-request-0001',
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
    discover: async (_transaction, input) => discovery({ ...input, personId: 'person-a' }),
    ...overrides,
  });
}

test('privacy request input is exact and covers the initial rights vocabulary', () => {
  for (const requestType of [
    'ACCESS',
    'CORRECTION',
    'ERASURE',
    'RESTRICTION',
    'PORTABILITY',
    'OBJECTION',
  ]) {
    assert.deepEqual(
      normalizeDataSubjectRequestInput({ personId: 'person-a', requestType }),
      { personId: 'person-a', requestType },
    );
  }
  assert.throws(
    () => normalizeDataSubjectRequestInput({
      personId: 'person-a',
      requestType: 'ACCESS',
      organizationId: 'foreign-tenant',
    }),
    { code: 'PRIVACY_UNKNOWN_FIELDS' },
  );
});

test('request receipt, authority attestation, discovery and blocked seal remain one exact tenant operation', async () => {
  const stored = database();
  const result = await operation(stored);
  assert.equal(result.replayed, false);
  assert.equal(result.request.status, 'DISCOVERY_BLOCKED');
  assert.equal(result.request.requesterIdentityVerified, false);
  assert.equal(result.discovery.completed, true);
  assert.equal(result.discovery.coverageComplete, false);
  assert.equal(result.discovery.executionAllowed, false);
  assert.ok(result.discovery.blockerCount > 0);
  assert.equal(stored.state.requests.length, 1);
  assert.equal(stored.state.manifests.length, 1);
  assert.equal(stored.state.requests[0].organizationId, 'organization-a');
  assert.equal(stored.state.requests[0].workerPersonId, 'person-a');
  assert.match(stored.state.requests[0].operationKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(stored.state.requests[0].operationKeyHash.includes('privacy-request-0001'), false);
  assert.deepEqual(
    stored.state.transactionOptions.map((entry) => entry.isolationLevel),
    ['Serializable', 'RepeatableRead', 'Serializable'],
  );
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('person-a'), false);
  assert.equal(serialized.includes(KEY.toString('base64url')), false);
});

test('an exact idempotent replay returns the frozen manifest without rediscovery', async () => {
  const stored = database();
  await operation(stored);
  let discoveries = 0;
  const replay = await operation(stored, {
    discover: async () => {
      discoveries += 1;
      throw new Error('terminal replay must not rediscover');
    },
  });
  assert.equal(replay.replayed, true);
  assert.equal(discoveries, 0);
  assert.equal(stored.state.requests.length, 1);
  assert.equal(stored.state.manifests.length, 1);
});

test('idempotency drift, foreign subject and non-admin actor fail before discovery', async () => {
  const stored = database();
  await operation(stored);
  await assert.rejects(
    operation(stored, {
      input: { personId: 'person-a', requestType: 'ERASURE' },
    }),
    { code: 'PRIVACY_IDEMPOTENCY_PAYLOAD_MISMATCH', status: 409 },
  );
  await assert.rejects(operation(database({ person: false })), {
    code: 'PRIVACY_SUBJECT_NOT_FOUND',
    status: 404,
  });
  await assert.rejects(operation(database({ actor: false })), {
    code: 'PRIVACY_ACTOR_FORBIDDEN',
    status: 403,
  });
});

test('the service rejects an invalid fingerprint key before opening a transaction', async () => {
  const stored = database();
  await assert.rejects(operation(stored, {
    fingerprintKey: Buffer.alloc(31),
  }), {
    code: 'PRIVACY_DISCOVERY_UNAVAILABLE',
    status: 503,
  });
  assert.equal(stored.state.transactionOptions.length, 0);
  assert.equal(stored.state.requests.length, 0);
});

test('an exhausted seal conflict never returns a false successful discovery', async () => {
  const stored = database();
  const transact = stored.prisma.$transaction.bind(stored.prisma);
  let calls = 0;
  stored.prisma.$transaction = async (operationCallback, options) => {
    calls += 1;
    if (calls >= 3) {
      const error = new Error('synthetic serialization conflict');
      error.code = 'P2034';
      throw error;
    }
    return transact(operationCallback, options);
  };

  await assert.rejects(operation(stored), {
    code: 'PRIVACY_REQUEST_IN_PROGRESS',
    status: 409,
  });
  assert.equal(stored.state.requests[0].status, 'DISCOVERING');
  assert.equal(stored.state.manifests.length, 0);
});

test('new append-only cases are durably rate-limited while exact replays remain free', async () => {
  const stored = database();
  await operation(stored);
  for (let index = 0; index < 19; index += 1) {
    stored.state.requests.push({
      id: `prior-${index}`,
      organizationId: 'organization-a',
      receivedByMembershipId: 'membership-admin-a',
      operationKeyHash: `${index}`.padStart(64, '0'),
      requestFingerprint: 'f'.repeat(64),
      receivedAt: new Date(NOW),
      status: 'DISCOVERY_BLOCKED',
    });
  }
  const replay = await operation(stored);
  assert.equal(replay.replayed, true);
  await assert.rejects(operation(stored, {
    idempotencyKey: 'privacy-request-0002',
  }), {
    code: 'PRIVACY_REQUEST_RATE_LIMIT',
    status: 429,
    retryAfterSeconds: 3600,
  });
  assert.equal(stored.state.requests.length, 20);
});

test('advisory lock timeout is a short retryable 503 and never a quota 429', async () => {
  const failures = [
    Object.assign(new Error('raw PostgreSQL lock timeout'), { code: '55P03' }),
    Object.assign(new Error('Prisma wrapped PostgreSQL lock timeout'), {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: { originalCode: '55P03' },
        },
      },
    }),
  ];
  for (const lockError of failures) {
    const stored = database({ lockError });
    await assert.rejects(operation(stored), (error) => {
      assert.equal(error.code, 'PRIVACY_REQUEST_TEMPORARILY_UNAVAILABLE');
      assert.equal(error.status, 503);
      assert.equal(error.retryAfterSeconds, 3);
      assert.notEqual(error.status, 429);
      return true;
    });
    assert.equal(stored.state.requests.length, 0);
  }
});
