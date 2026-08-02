import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createInventoryLocation,
  listInventoryLocations,
} from '../src/lib/inventory-locations.js';

const SCOPE = { organizationId: 'organization-a', projectId: 'project-a' };
const NOW = new Date('2026-08-02T18:00:00.000Z');

function operationKeyFromAuditWhere(where) {
  return where.AND
    .find((entry) => entry.metadata?.path?.[0] === 'operationKey')
    ?.metadata?.equals;
}

function memoryPrisma() {
  const state = {
    audits: [],
    locations: [],
    lockCalls: 0,
    transactions: 0,
  };
  const transaction = {
    async $executeRawUnsafe() {
      state.lockCalls += 1;
    },
    project: {
      async findFirst(args) {
        assert.equal(args.where.organizationId, SCOPE.organizationId);
        assert.equal(args.where.id, SCOPE.projectId);
        return { ...SCOPE, id: SCOPE.projectId, status: 'ACTIVE' };
      },
    },
    auditLog: {
      async findFirst(args) {
        const key = operationKeyFromAuditWhere(args.where);
        return state.audits.find((audit) => (
          audit.organizationId === args.where.organizationId
          && audit.action === args.where.action
          && audit.entityType === args.where.entityType
          && audit.metadata.projectId === SCOPE.projectId
          && audit.metadata.operationKey === key
        )) || null;
      },
      async create({ data }) {
        state.audits.push({
          ...data,
          id: `audit-${state.audits.length + 1}`,
          createdAt: NOW,
        });
      },
    },
    inventoryLocation: {
      async count({ where }) {
        return state.locations.filter((location) => (
          location.organizationId === where.organizationId
          && location.projectId === where.projectId
          && location.active === where.active
        )).length;
      },
      async findFirst({ where }) {
        return state.locations.find((location) => (
          location.id === where.id
          && location.organizationId === where.organizationId
          && location.projectId === where.projectId
        )) || null;
      },
      async create({ data }) {
        if (state.locations.some((location) => (
          location.projectId === data.projectId && location.code === data.code
        ))) {
          const conflict = new Error('unique');
          conflict.code = 'P2002';
          throw conflict;
        }
        const row = {
          id: `location-${state.locations.length + 1}`,
          ...data,
          active: true,
          revision: 0,
          createdAt: NOW,
          updatedAt: NOW,
        };
        state.locations.push(row);
        return row;
      },
    },
  };
  return {
    state,
    prisma: {
      async $transaction(callback) {
        state.transactions += 1;
        return callback(transaction);
      },
    },
  };
}

test('create normalizes code, persists server scope and safely replays the canonical payload', async () => {
  const store = memoryPrisma();
  const first = await createInventoryLocation(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-attempt-a',
    input: { code: ' dep-01 ', name: ' Depósito principal ' },
  });
  const replay = await createInventoryLocation(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-attempt-a',
    input: { code: 'DEP-01', name: 'Depósito principal' },
  });

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.location, first.location);
  assert.deepEqual(Object.keys(first.location).sort(), [
    'active',
    'code',
    'createdAt',
    'id',
    'name',
    'revision',
    'updatedAt',
  ]);
  assert.equal(first.location.code, 'DEP-01');
  assert.equal(store.state.locations.length, 1);
  assert.equal(store.state.audits.length, 1);
  assert.equal(store.state.audits[0].actorId, 'user-a');
  assert.equal(store.state.audits[0].metadata.projectId, SCOPE.projectId);
  assert.equal(store.state.lockCalls, 2);
});

test('same Idempotency-Key with mutated content is rejected without another write', async () => {
  const store = memoryPrisma();
  await createInventoryLocation(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-attempt-b',
    input: { code: 'PA-01', name: 'Pañol' },
  });

  await assert.rejects(
    createInventoryLocation(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-attempt-b',
      input: { code: 'PA-01', name: 'Pañol modificado' },
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
  assert.equal(store.state.locations.length, 1);
  assert.equal(store.state.audits.length, 1);
});

test('a code race or duplicate maps to a governed 409', async () => {
  const store = memoryPrisma();
  await createInventoryLocation(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-attempt-c',
    input: { code: 'PLAYA-1', name: 'Playa uno' },
  });
  await assert.rejects(
    createInventoryLocation(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-attempt-d',
      input: { code: 'playa-1', name: 'Otra playa' },
    }),
    (error) => error.code === 'INVENTORY_LOCATION_CODE_CONFLICT' && error.status === 409,
  );
});

test('create fails closed when the project already has one hundred active locations', async () => {
  const store = memoryPrisma();
  store.state.locations.push(...Array.from({ length: 100 }, (_, index) => ({
    id: `existing-${index}`,
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    code: `L-${index}`,
    name: `Lugar ${index}`,
    active: true,
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
  })));

  await assert.rejects(
    createInventoryLocation(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-attempt-limit',
      input: { code: 'EXTRA', name: 'Ubicación extra' },
    }),
    (error) => error.code === 'INVENTORY_LOCATION_ACTIVE_LIMIT' && error.status === 409,
  );
  assert.equal(store.state.locations.length, 100);
  assert.equal(store.state.audits.length, 0);
});

test('create rejects missing idempotency, extra scope fields and unreadable codes before transaction', async () => {
  for (const request of [
    {
      operationKey: null,
      input: { code: 'DEP-01', name: 'Depósito' },
      code: 'INVENTORY_LOCATION_IDEMPOTENCY_KEY_REQUIRED',
    },
    {
      operationKey: 'inventory-attempt-e',
      input: { code: 'DEP-01', name: 'Depósito', projectId: 'project-b' },
      code: 'INVENTORY_LOCATION_FIELDS_INVALID',
    },
    {
      operationKey: 'inventory-attempt-f',
      input: { code: 'DEP--01', name: 'Depósito' },
      code: 'INVENTORY_LOCATION_CODE_INVALID',
    },
  ]) {
    const store = memoryPrisma();
    await assert.rejects(
      createInventoryLocation(store.prisma, {
        scope: SCOPE,
        actorId: 'user-a',
        operationKey: request.operationKey,
        input: request.input,
      }),
      (error) => error.code === request.code && error.status === 400,
    );
    assert.equal(store.state.transactions, 0);
  }
});

test('list is tenant scoped, active by default and bounded to one hundred rows', async () => {
  const calls = [];
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: `location-${index}`,
    code: `L-${index}`,
    name: `Lugar ${index}`,
    active: index % 2 === 0,
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
  }));
  const prisma = {
    inventoryLocation: {
      async findMany(args) {
        calls.push(args);
        return rows;
      },
    },
  };

  await assert.rejects(
    listInventoryLocations(prisma, { scope: SCOPE }),
    (error) => (
      error.code === 'INVENTORY_LOCATION_ACTIVE_LIMIT_CORRUPT'
      && error.status === 409
    ),
  );
  const all = await listInventoryLocations(prisma, { scope: SCOPE, includeInactive: true });
  assert.deepEqual(calls[0].where, { ...SCOPE, active: true });
  assert.deepEqual(calls[1].where, SCOPE);
  assert.equal(calls[0].take, 101);
  assert.equal(all.locations.length, 100);
  assert.equal(all.hasMore, true);
});

test('route owns scope, permissions, strict query/body and private no-store responses', async () => {
  const route = await readFile(
    new URL('../src/app/api/inventory-locations/route.js', import.meta.url),
    'utf8',
  );
  const service = await readFile(
    new URL('../src/lib/inventory-locations.js', import.meta.url),
    'utf8',
  );

  assert.match(route, /MAX_INVENTORY_LOCATION_BODY_BYTES = 8 \* 1024/);
  assert.match(route, /readJsonRequest\(request, \{[\s\S]*maxBytes: MAX_INVENTORY_LOCATION_BODY_BYTES/);
  assert.match(route, /request\.headers\.get\('Idempotency-Key'\)/);
  assert.match(route, /'org:execution:read'[\s\S]*subscriptionMode: 'read'/);
  assert.match(route, /'org:execution:manage'[\s\S]*subscriptionMode: 'write'/);
  assert.equal([...route.matchAll(/organizationId: access\.organization\.id/g)].length, 2);
  assert.equal([...route.matchAll(/projectId: access\.project\.id/g)].length, 2);
  assert.match(route, /active === 'all'/);
  assert.match(route, /active === 'true'/);
  assert.match(route, /params\.getAll\('active'\)\.length > 1/);
  assert.match(route, /Cache-Control', 'private, no-store'/);
  assert.match(service, /allowedFields = new Set\(\['code', 'name'\]\)/);
  assert.doesNotMatch(service, /\b(?:stock|available|availability|quantity)\b/i);
});
