import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  createInventoryItem,
  INVENTORY_ITEM_LIST_DEFAULT_LIMIT,
  INVENTORY_ITEM_LIST_MAX_LIMIT,
  listInventoryItems,
  parseInventoryItemListQuery,
} from '../src/lib/inventory-items.js';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:inventory-items-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:inventory-items-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:inventory-items-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:inventory-items-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:inventory-items-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:inventory-items-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

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
    items: [],
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
    inventoryItem: {
      async count({ where }) {
        return state.items.filter((item) => (
          item.organizationId === where.organizationId
          && item.projectId === where.projectId
          && item.active === where.active
        )).length;
      },
      async findFirst({ where }) {
        return state.items.find((item) => (
          item.id === where.id
          && item.organizationId === where.organizationId
          && item.projectId === where.projectId
        )) || null;
      },
      async create({ data }) {
        if (state.items.some((item) => (
          item.projectId === data.projectId && item.code === data.code
        ))) {
          const conflict = new Error('unique');
          conflict.code = 'P2002';
          throw conflict;
        }
        const row = {
          id: `item-${state.items.length + 1}`,
          ...data,
          active: true,
          revision: 0,
          createdAt: NOW,
          updatedAt: NOW,
        };
        state.items.push(row);
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

test('create normalizes material identity and replays only the canonical payload', async () => {
  const store = memoryPrisma();
  const first = await createInventoryItem(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-item-attempt-a',
    input: { code: ' cem-01 ', name: ' Cemento portland ', baseUnit: ' bolsa ' },
  });
  const replay = await createInventoryItem(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-item-attempt-a',
    input: { code: 'CEM-01', name: 'Cemento portland', baseUnit: 'bolsa' },
  });

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.item, first.item);
  assert.deepEqual(Object.keys(first.item).sort(), [
    'active',
    'baseUnit',
    'code',
    'createdAt',
    'id',
    'name',
    'revision',
    'updatedAt',
  ]);
  assert.equal(first.item.code, 'CEM-01');
  assert.equal(first.item.baseUnit, 'bolsa');
  assert.equal(store.state.items.length, 1);
  assert.equal(store.state.audits.length, 1);
  assert.equal(store.state.audits[0].actorId, 'user-a');
  assert.equal(store.state.lockCalls, 2);
});

test('base unit preserves the purchase-order spelling without case or whitespace conversion', async () => {
  const store = memoryPrisma();
  const result = await createInventoryItem(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-item-attempt-unit',
    input: { code: 'MEZ-01', name: 'Mezcla especial', baseUnit: ' kg  por bolsa ' },
  });
  assert.equal(result.item.baseUnit, 'kg  por bolsa');
});

test('mutated replay and duplicate material code fail closed', async () => {
  const store = memoryPrisma();
  await createInventoryItem(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-item-attempt-b',
    input: { code: 'ACERO-1', name: 'Acero', baseUnit: 'KG' },
  });
  await assert.rejects(
    createInventoryItem(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-item-attempt-b',
      input: { code: 'ACERO-1', name: 'Acero modificado', baseUnit: 'KG' },
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
  await assert.rejects(
    createInventoryItem(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-item-attempt-c',
      input: { code: 'acero-1', name: 'Otro acero', baseUnit: 'KG' },
    }),
    (error) => error.code === 'INVENTORY_ITEM_CODE_CONFLICT' && error.status === 409,
  );
});

test('create rejects scope-shaped extras, unsafe codes and missing idempotency before transaction', async () => {
  for (const request of [
    {
      operationKey: null,
      input: { code: 'CEM-01', name: 'Cemento', baseUnit: 'BOLSA' },
      code: 'INVENTORY_ITEM_IDEMPOTENCY_KEY_REQUIRED',
    },
    {
      operationKey: 'inventory-item-attempt-d',
      input: {
        code: 'CEM-01',
        name: 'Cemento',
        baseUnit: 'BOLSA',
        organizationId: 'organization-b',
      },
      code: 'INVENTORY_ITEM_FIELDS_INVALID',
    },
    {
      operationKey: 'inventory-item-attempt-e',
      input: { code: 'CEM/01', name: 'Cemento', baseUnit: 'kg por bolsa' },
      code: 'INVENTORY_ITEM_CODE_INVALID',
    },
  ]) {
    const store = memoryPrisma();
    await assert.rejects(
      createInventoryItem(store.prisma, {
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

test('create fails closed at the active catalog limit', async () => {
  const store = memoryPrisma();
  store.state.items.push(...Array.from({ length: 500 }, (_, index) => ({
    id: `existing-${index}`,
    ...SCOPE,
    code: `M-${index}`,
    name: `Material ${index}`,
    baseUnit: 'UN',
    active: true,
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
  })));
  await assert.rejects(
    createInventoryItem(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-item-attempt-limit',
      input: { code: 'EXTRA', name: 'Material extra', baseUnit: 'UN' },
    }),
    (error) => error.code === 'INVENTORY_ITEM_ACTIVE_LIMIT' && error.status === 409,
  );
  assert.equal(store.state.items.length, 500);
  assert.equal(store.state.audits.length, 0);
});

test('list is tenant scoped, active by default and bounded', async () => {
  const calls = [];
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: `item-${index}`,
    code: `M-${index}`,
    name: `Material ${index}`,
    baseUnit: 'UN',
    active: index % 2 === 0,
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
  }));
  const prisma = {
    inventoryItem: {
      async findMany(args) {
        calls.push(args);
        return rows;
      },
    },
  };

  await assert.rejects(
    listInventoryItems(prisma, { scope: SCOPE }),
    (error) => error.code === 'INVENTORY_ITEM_ACTIVE_LIMIT_CORRUPT' && error.status === 409,
  );
  const active = await listInventoryItems({
    inventoryItem: {
      async findMany(args) {
        calls.push(args);
        return rows.slice(0, 500);
      },
    },
  }, { scope: SCOPE });
  const all = await listInventoryItems(prisma, { scope: SCOPE, includeInactive: true });
  assert.deepEqual(calls[0].where, { ...SCOPE, active: true });
  assert.deepEqual(calls[1].where, { ...SCOPE, active: true });
  assert.deepEqual(calls[2].where, SCOPE);
  assert.equal(calls[0].take, 501);
  assert.equal(calls[1].take, 501);
  assert.deepEqual(Object.keys(active).sort(), ['hasMore', 'items']);
  assert.equal(active.items.length, 500);
  assert.equal(active.hasMore, false);
  assert.equal(calls[2].take, INVENTORY_ITEM_LIST_DEFAULT_LIMIT + 1);
  assert.equal(INVENTORY_ITEM_LIST_DEFAULT_LIMIT, 100);
  assert.equal(INVENTORY_ITEM_LIST_MAX_LIMIT, 200);
  assert.equal(all.items.length, INVENTORY_ITEM_LIST_DEFAULT_LIMIT);
  assert.equal(all.hasMore, true);
  assert.match(all.nextCursor, /^[A-Za-z0-9_-]+$/);
});

test('active=all uses an opaque tenant-bound (code,id) keyset cursor', async () => {
  const calls = [];
  const rows = [
    { id: 'item-a', code: 'ARENA', name: 'Arena', baseUnit: 'M3', active: true },
    { id: 'item-b', code: 'CEMENTO', name: 'Cemento', baseUnit: 'BOLSA', active: true },
    { id: 'item-c', code: 'HIERRO', name: 'Hierro', baseUnit: 'KG', active: false },
  ].map((row) => ({
    ...row,
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
  }));
  const prisma = {
    inventoryItem: {
      async findMany(args) {
        calls.push(args);
        return calls.length === 1 ? rows : rows.slice(2);
      },
    },
  };

  const firstQuery = parseInventoryItemListQuery(
    'https://obrasaas.test/api/inventory-items?active=all&limit=2',
    SCOPE,
  );
  const first = await listInventoryItems(prisma, firstQuery);
  assert.equal(first.items.length, 2);
  assert.equal(first.hasMore, true);
  assert.match(first.nextCursor, /^[A-Za-z0-9_-]+$/);
  assert.equal(first.nextCursor.includes('CEMENTO'), false);
  assert.equal(first.nextCursor.includes('item-b'), false);
  const decodedCursor = Buffer.from(first.nextCursor, 'base64url').toString('utf8');
  assert.equal(decodedCursor.includes(SCOPE.organizationId), false);
  assert.equal(decodedCursor.includes(SCOPE.projectId), false);
  assert.deepEqual(calls[0], {
    where: SCOPE,
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    take: 3,
  });

  const secondQuery = parseInventoryItemListQuery(
    `https://obrasaas.test/api/inventory-items?active=all&limit=2&cursor=${first.nextCursor}`,
    SCOPE,
  );
  assert.deepEqual(secondQuery.cursor, { code: 'CEMENTO', id: 'item-b' });
  const second = await listInventoryItems(prisma, secondQuery);
  assert.deepEqual(calls[1].where, {
    ...SCOPE,
    OR: [
      { code: { gt: 'CEMENTO' } },
      { code: 'CEMENTO', id: { gt: 'item-b' } },
    ],
  });
  assert.deepEqual(second.items.map((item) => item.id), ['item-c']);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, null);

  assert.throws(
    () => parseInventoryItemListQuery(
      `https://obrasaas.test/api/inventory-items?active=all&cursor=${first.nextCursor}`,
      { organizationId: 'organization-b', projectId: SCOPE.projectId },
    ),
    (error) => error.code === 'INVENTORY_ITEM_CURSOR_SCOPE_MISMATCH' && error.status === 400,
  );
});

test('inventory item list query is strict and keeps active=true unpaginated', () => {
  assert.deepEqual(
    parseInventoryItemListQuery('https://obrasaas.test/api/inventory-items', SCOPE),
    { scope: SCOPE, includeInactive: false },
  );
  assert.deepEqual(
    parseInventoryItemListQuery(
      'https://obrasaas.test/api/inventory-items?active=true',
      SCOPE,
    ),
    { scope: SCOPE, includeInactive: false },
  );
  assert.equal(parseInventoryItemListQuery(
    'https://obrasaas.test/api/inventory-items?active=all',
    SCOPE,
  ).limit, INVENTORY_ITEM_LIST_DEFAULT_LIMIT);

  for (const [path, code] of [
    ['/api/inventory-items?organizationId=attacker', 'INVENTORY_ITEM_QUERY_INVALID'],
    ['/api/inventory-items?active=all&active=true', 'INVENTORY_ITEM_QUERY_INVALID'],
    ['/api/inventory-items?limit=2', 'INVENTORY_ITEM_PAGINATION_REQUIRES_ALL'],
    ['/api/inventory-items?active=true&cursor=opaque', 'INVENTORY_ITEM_PAGINATION_REQUIRES_ALL'],
    ['/api/inventory-items?active=all&limit=201', 'INVENTORY_ITEM_LIMIT_INVALID'],
    ['/api/inventory-items?active=all&limit=001', 'INVENTORY_ITEM_LIMIT_INVALID'],
    ['/api/inventory-items?active=all&cursor=not%21base64', 'INVENTORY_ITEM_CURSOR_INVALID'],
  ]) {
    assert.throws(
      () => parseInventoryItemListQuery(`https://obrasaas.test${path}`, SCOPE),
      (error) => error.code === code && error.status === 400,
    );
  }
});

test('GET route authorizes trusted scope, forwards paging and rejects client scope', async () => {
  const { createInventoryItemsGetHandler } = await import(
    '../src/app/api/inventory-items/route.js'
  );
  const authorizations = [];
  const calls = [];
  const prisma = { kind: 'inventory-items-route-prisma' };
  const handler = createInventoryItemsGetHandler({
    resolveAccess: async () => ({
      organization: { id: SCOPE.organizationId },
      project: { id: SCOPE.projectId },
    }),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => prisma,
    listItems: async (...args) => {
      calls.push(args);
      return { items: [], hasMore: false, ...(args[1].includeInactive ? { nextCursor: null } : {}) };
    },
  });
  const request = (query = '') => new Request(
    `https://obrasaas.test/api/inventory-items${query}`,
    { headers: { 'x-request-id': 'inventory-items-route-test' } },
  );

  const active = await handler(request('?active=true'));
  assert.equal(active.status, 200);
  assert.match(active.headers.get('cache-control') || '', /private/i);
  assert.match(active.headers.get('cache-control') || '', /no-store/i);
  assert.equal(active.headers.get('x-request-id'), 'inventory-items-route-test');
  assert.deepEqual(calls[0], [prisma, { scope: SCOPE, includeInactive: false }]);

  const all = await handler(request('?active=all&limit=25'));
  assert.equal(all.status, 200);
  assert.deepEqual(calls[1], [prisma, {
    scope: SCOPE,
    includeInactive: true,
    cursor: null,
    limit: 25,
  }]);
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:inventory:read', { subscriptionMode: 'read' }],
    ['org:inventory:read', { subscriptionMode: 'read' }],
  ]);

  for (const query of ['?projectId=attacker', '?active=true&limit=25']) {
    const rejected = await handler(request(query));
    assert.equal(rejected.status, 400);
    assert.match(rejected.headers.get('cache-control') || '', /private/i);
    assert.match(rejected.headers.get('cache-control') || '', /no-store/i);
  }
  assert.equal(calls.length, 2);
});

test('route owns tenant scope, inventory permissions and bounded private contracts', async () => {
  const route = await readFile(
    new URL('../src/app/api/inventory-items/route.js', import.meta.url),
    'utf8',
  );
  const service = await readFile(
    new URL('../src/lib/inventory-items.js', import.meta.url),
    'utf8',
  );

  assert.match(route, /MAX_INVENTORY_ITEM_BODY_BYTES = 8 \* 1024/);
  assert.match(route, /readJsonRequest\(request, \{[\s\S]*maxBytes: MAX_INVENTORY_ITEM_BODY_BYTES/);
  assert.match(route, /request\.headers\.get\('Idempotency-Key'\)/);
  assert.match(route, /'org:inventory:read'[\s\S]*subscriptionMode: 'read'/);
  assert.match(route, /'org:inventory:manage'[\s\S]*subscriptionMode: 'write'/);
  assert.equal([...route.matchAll(/organizationId: access\.organization\.id/g)].length, 2);
  assert.equal([...route.matchAll(/projectId: access\.project\.id/g)].length, 2);
  assert.match(route, /parseInventoryItemListQuery\(request\.url, \{/);
  assert.match(route, /listItems\(prismaFactory\(\), query\)/);
  assert.match(route, /Cache-Control', 'private, no-store'/);
  assert.match(service, /LIST_QUERY_FIELDS = new Set\(\['active', 'cursor', 'limit'\]\)/);
  assert.match(service, /orderBy: \[\{ code: 'asc' \}, \{ id: 'asc' \}\]/);
  assert.match(service, /\{ code: \{ gt: cursor\.code \} \}/);
  assert.match(service, /\{ code: cursor\.code, id: \{ gt: cursor\.id \} \}/);
  assert.match(service, /allowedFields = new Set\(\['code', 'name', 'baseUnit'\]\)/);
  assert.doesNotMatch(service, /\b(?:onHand|available|reserved|quantity)\b/);
});
