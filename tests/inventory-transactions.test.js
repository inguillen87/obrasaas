import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createInventoryTransaction,
  getReceiptPutawayStatus,
} from '../src/lib/inventory-transactions.js';
import {
  formatProcurementQuantity,
  parseProcurementQuantity,
} from '../src/lib/procurement-quantity.js';

const SCOPE = { organizationId: 'organization-a', projectId: 'project-a' };
const NOW = new Date('2026-08-02T19:00:00.000Z');

function decimalAdd(left, right) {
  const scaled = (value) => {
    const candidate = String(value);
    const negative = candidate.startsWith('-');
    const parsed = parseProcurementQuantity(
      negative ? candidate.slice(1) : candidate,
      { allowZero: true },
    );
    return negative ? -parsed : parsed;
  };
  const total = scaled(left) + scaled(right);
  const absolute = total < 0n ? -total : total;
  return `${total < 0n ? '-' : ''}${formatProcurementQuantity(absolute)}`;
}

function transactionStore({ wrongUnit = false } = {}) {
  const state = {
    audits: [],
    balances: new Map(),
    bindings: [],
    transactions: [],
    lockCalls: 0,
  };
  const items = [
    {
      id: 'item-cement',
      code: 'CEM-01',
      name: 'Cemento portland',
      baseUnit: wrongUnit ? 'unidad' : 'bolsa',
      active: true,
    },
    {
      id: 'item-steel',
      code: 'ACE-01',
      name: 'Acero',
      baseUnit: 'kg',
      active: true,
    },
  ];
  const purchaseLines = [
    { id: 'line-cement', description: 'Cemento', unit: 'bolsa' },
    { id: 'line-steel', description: 'Acero', unit: 'kg' },
  ];
  const inspection = {
    id: 'inspection-head',
    kind: 'FINALIZATION',
    version: 1,
    purchaseOrderId: 'purchase-a',
    goodsReceiptId: 'receipt-a',
    locationId: 'location-a',
    locationCodeSnapshot: 'DEP-01',
    locationNameSnapshot: 'Depósito',
    dispositions: [
      {
        id: 'disposition-cement-a',
        quality: 'ACCEPTED',
        purchaseOrderLineId: 'line-cement',
        goodsReceiptLineId: 'receipt-line-cement',
        quantity: '1.125',
      },
      {
        id: 'disposition-cement-b',
        quality: 'ACCEPTED',
        purchaseOrderLineId: 'line-cement',
        goodsReceiptLineId: 'receipt-line-cement',
        quantity: '0.875',
      },
      {
        id: 'disposition-steel',
        quality: 'ACCEPTED',
        purchaseOrderLineId: 'line-steel',
        goodsReceiptLineId: 'receipt-line-steel',
        quantity: '12.500',
      },
      {
        id: 'disposition-rejected',
        quality: 'REJECTED',
        purchaseOrderLineId: 'line-steel',
        goodsReceiptLineId: 'receipt-line-steel',
        quantity: '0.500',
      },
    ],
  };

  function materialize(row) {
    if (!row) return null;
    const reversedBy = state.transactions.find((candidate) => (
      candidate.reversesTransactionId === row.id
    )) || null;
    return {
      ...row,
      entries: row.entries.map((entry) => ({ ...entry })),
      reversedBy: reversedBy ? {
        ...reversedBy,
        entries: reversedBy.entries.map((entry) => ({ ...entry })),
        reversedBy: null,
      } : null,
    };
  }

  const transaction = {
    async $executeRawUnsafe() {
      state.lockCalls += 1;
    },
    project: {
      async findFirst({ where }) {
        assert.deepEqual(where, {
          id: SCOPE.projectId,
          organizationId: SCOPE.organizationId,
        });
        return { id: SCOPE.projectId, organizationId: SCOPE.organizationId, status: 'ACTIVE' };
      },
    },
    goodsReceiptInspection: {
      async findFirst({ where }) {
        if (where.id) {
          if (
            where.id !== inspection.id
            || where.organizationId !== SCOPE.organizationId
            || where.projectId !== SCOPE.projectId
          ) return null;
          return {
            ...inspection,
            dispositions: inspection.dispositions
              .filter((row) => row.quality === 'ACCEPTED')
              .map((row) => ({ ...row })),
          };
        }
        if (
          where.organizationId === SCOPE.organizationId
          && where.projectId === SCOPE.projectId
          && where.goodsReceiptId === inspection.goodsReceiptId
        ) return { id: inspection.id };
        return null;
      },
    },
    purchaseOrderLine: {
      async findMany({ where }) {
        if (
          where.projectId !== SCOPE.projectId
          || where.purchaseOrderId !== inspection.purchaseOrderId
        ) return [];
        return purchaseLines
          .filter((line) => where.id.in.includes(line.id))
          .map((line) => ({ ...line }));
      },
    },
    purchaseOrderLineInventoryBinding: {
      async findMany({ where }) {
        return state.bindings
          .filter((binding) => (
            binding.organizationId === where.organizationId
            && binding.projectId === where.projectId
            && binding.purchaseOrderId === where.purchaseOrderId
            && where.purchaseOrderLineId.in.includes(binding.purchaseOrderLineId)
          ))
          .map((binding) => ({
            ...binding,
            inventoryItem: { ...items.find((item) => item.id === binding.inventoryItemId) },
          }));
      },
      async create({ data }) {
        const row = { id: `binding-${state.bindings.length + 1}`, ...data, createdAt: NOW };
        state.bindings.push(row);
        return { ...row };
      },
    },
    inventoryItem: {
      async findMany({ where }) {
        return items
          .filter((item) => where.id.in.includes(item.id) && item.active === where.active)
          .map((item) => ({ ...item }));
      },
    },
    inventoryLocation: {
      async findFirst({ where }) {
        if (
          where.id === inspection.locationId
          && where.organizationId === SCOPE.organizationId
          && where.projectId === SCOPE.projectId
          && where.active === true
        ) return { id: inspection.locationId };
        return null;
      },
    },
    inventoryTransaction: {
      async findFirst({ where }) {
        const row = state.transactions.find((candidate) => {
          if (
            candidate.organizationId !== where.organizationId
            || candidate.projectId !== where.projectId
          ) return false;
          if (where.operationKey) return candidate.operationKey === where.operationKey;
          if (where.id) {
            return candidate.id === where.id && (!where.kind || candidate.kind === where.kind);
          }
          if (where.sourceInspectionId) {
            return candidate.sourceInspectionId === where.sourceInspectionId
              && (!where.kind || candidate.kind === where.kind);
          }
          return false;
        });
        return materialize(row);
      },
      async create({ data }) {
        const transactionId = `transaction-${state.transactions.length + 1}`;
        const entries = data.entries.create.map((entry, index) => ({
          id: `${transactionId}-entry-${index + 1}`,
          organizationId: data.organizationId,
          projectId: data.projectId,
          transactionId,
          ...entry,
          createdAt: NOW,
        }));
        const row = {
          id: transactionId,
          ...data,
          entries,
          reversedBy: null,
          createdAt: NOW,
        };
        delete row.entries.create;
        row.entries = entries;
        state.transactions.push(row);
        for (const entry of entries) {
          const key = `${entry.inventoryItemId}\u0000${entry.locationId}`;
          const current = state.balances.get(key) || {
            organizationId: SCOPE.organizationId,
            projectId: SCOPE.projectId,
            inventoryItemId: entry.inventoryItemId,
            locationId: entry.locationId,
            onHand: '0.000',
            revision: 0,
            updatedAt: NOW,
          };
          state.balances.set(key, {
            ...current,
            onHand: decimalAdd(current.onHand, entry.quantityDelta),
            revision: current.revision + 1,
          });
        }
        return materialize(row);
      },
    },
    inventoryBalance: {
      async findMany({ where }) {
        return [...state.balances.values()]
          .filter((balance) => (
            balance.organizationId === where.organizationId
            && balance.projectId === where.projectId
            && where.inventoryItemId.in.includes(balance.inventoryItemId)
            && where.locationId.in.includes(balance.locationId)
          ))
          .map((balance) => ({ ...balance }));
      },
    },
    auditLog: {
      async create({ data }) {
        state.audits.push({ id: `audit-${state.audits.length + 1}`, ...data, createdAt: NOW });
      },
    },
  };
  return {
    state,
    inspection,
    prisma: {
      ...transaction,
      async $transaction(callback) {
        return callback(transaction);
      },
    },
  };
}

function putawayInput() {
  return {
    kind: 'RECEIPT_PUTAWAY',
    sourceInspectionId: 'inspection-head',
    bindings: [
      { purchaseOrderLineId: 'line-steel', inventoryItemId: 'item-steel' },
      { purchaseOrderLineId: 'line-cement', inventoryItemId: 'item-cement' },
    ],
  };
}

test('putaway binds every accepted purchase line and posts exact immutable entries atomically', async () => {
  const store = transactionStore();
  const result = await createInventoryTransaction(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-putaway-attempt-a',
    input: putawayInput(),
    now: NOW,
  });

  assert.equal(result.replayed, false);
  assert.equal(result.transaction.kind, 'RECEIPT_PUTAWAY');
  assert.equal(result.transaction.sourceInspectionId, 'inspection-head');
  assert.equal(result.transaction.entries.length, 3);
  assert.deepEqual(
    result.transaction.entries.map((entry) => entry.quantityDelta),
    ['1.125', '0.875', '12.500'],
  );
  assert.equal(store.state.bindings.length, 2);
  assert.deepEqual(
    store.state.bindings.map((binding) => binding.purchaseOrderLineId).sort(),
    ['line-cement', 'line-steel'],
  );
  assert.equal(store.state.audits[0].action, 'inventory.receipt_putaway');
  assert.deepEqual(result.balances.map((balance) => balance.onHand).sort(), ['12.500', '2.000']);
});

test('putaway replay is order-insensitive and mutated replay fails closed', async () => {
  const store = transactionStore();
  const options = {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-putaway-attempt-b',
    input: putawayInput(),
    now: NOW,
  };
  const first = await createInventoryTransaction(store.prisma, options);
  const replay = await createInventoryTransaction(store.prisma, {
    ...options,
    input: {
      ...putawayInput(),
      bindings: putawayInput().bindings.toReversed(),
    },
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.transaction.id, first.transaction.id);
  assert.equal(store.state.transactions.length, 1);
  assert.equal(store.state.bindings.length, 2);

  await assert.rejects(
    createInventoryTransaction(store.prisma, {
      ...options,
      input: {
        ...putawayInput(),
        bindings: [
          { purchaseOrderLineId: 'line-cement', inventoryItemId: 'item-steel' },
          { purchaseOrderLineId: 'line-steel', inventoryItemId: 'item-steel' },
        ],
      },
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
});

test('reversal posts exact negative counterparts once and status requires a new inspection version', async () => {
  const store = transactionStore();
  const putaway = await createInventoryTransaction(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-putaway-attempt-c',
    input: putawayInput(),
    now: NOW,
  });
  const reversal = await createInventoryTransaction(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-reversal-attempt-c',
    input: {
      kind: 'REVERSAL',
      reversesTransactionId: putaway.transaction.id,
      reason: '  Corrección de depósito  ',
    },
    now: NOW,
  });

  assert.equal(reversal.transaction.kind, 'REVERSAL');
  assert.equal(reversal.transaction.reason, 'Corrección de depósito');
  assert.deepEqual(
    reversal.transaction.entries.map((entry) => entry.quantityDelta),
    ['-1.125', '-0.875', '-12.500'],
  );
  assert.deepEqual(reversal.balances.map((balance) => balance.onHand), ['0.000', '0.000']);

  const status = await getReceiptPutawayStatus(store.prisma, {
    scope: SCOPE,
    sourceInspectionId: 'inspection-head',
  });
  assert.equal(status.activePutaway, false);
  assert.equal(status.canPutAway, false);
  assert.equal(status.requiresNewInspectionVersion, true);
  assert.equal(status.transactions.length, 2);

  await assert.rejects(
    createInventoryTransaction(store.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-reversal-attempt-c2',
      input: {
        kind: 'REVERSAL',
        reversesTransactionId: putaway.transaction.id,
        reason: 'Otra reversión',
      },
    }),
    (error) => error.code === 'INVENTORY_PUTAWAY_ALREADY_REVERSED' && error.status === 409,
  );
});

test('server rejects incomplete mappings, unit conversion and tenant-shaped body fields before stock', async () => {
  const incomplete = transactionStore();
  await assert.rejects(
    createInventoryTransaction(incomplete.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-putaway-attempt-d1',
      input: {
        ...putawayInput(),
        bindings: [putawayInput().bindings[0]],
      },
    }),
    (error) => error.code === 'INVENTORY_PUTAWAY_BINDINGS_INCOMPLETE' && error.status === 409,
  );
  assert.equal(incomplete.state.transactions.length, 0);
  assert.equal(incomplete.state.bindings.length, 0);

  const unitMismatch = transactionStore({ wrongUnit: true });
  await assert.rejects(
    createInventoryTransaction(unitMismatch.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-putaway-attempt-d2',
      input: putawayInput(),
    }),
    (error) => error.code === 'INVENTORY_ITEM_UNIT_MISMATCH' && error.status === 409,
  );
  assert.equal(unitMismatch.state.transactions.length, 0);

  const extra = transactionStore();
  await assert.rejects(
    createInventoryTransaction(extra.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inventory-putaway-attempt-d3',
      input: { ...putawayInput(), projectId: 'project-b' },
    }),
    (error) => error.code === 'INVENTORY_TRANSACTION_FIELDS_INVALID' && error.status === 400,
  );
  assert.equal(extra.state.lockCalls, 0);
});

test('read status aggregates accepted quantities exactly and exposes immutable existing bindings', async () => {
  const store = transactionStore();
  await createInventoryTransaction(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inventory-putaway-attempt-e',
    input: putawayInput(),
  });
  const status = await getReceiptPutawayStatus(store.prisma, {
    scope: SCOPE,
    sourceInspectionId: 'inspection-head',
  });
  assert.equal(status.inspection.isHead, true);
  assert.equal(status.acceptedDispositionCount, 3);
  assert.deepEqual(status.acceptedLines.map((line) => [
    line.purchaseOrderLineId,
    line.acceptedQuantity,
    line.unit,
    line.binding.inventoryItem.id,
  ]), [
    ['line-cement', '2.000', 'bolsa', 'item-cement'],
    ['line-steel', '12.500', 'kg', 'item-steel'],
  ]);
  assert.equal(status.activePutaway, true);
  assert.equal(status.canPutAway, false);
});

test('route owns tenant, actor, idempotency, strict query and private inventory permissions', async () => {
  const [route, service, proxy] = await Promise.all([
    readFile(new URL('../src/app/api/inventory-transactions/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/inventory-transactions.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/proxy.js', import.meta.url), 'utf8'),
  ]);

  assert.match(route, /MAX_INVENTORY_TRANSACTION_BODY_BYTES = 128 \* 1024/);
  assert.match(route, /request\.headers\.get\('Idempotency-Key'\)/);
  assert.match(route, /'org:inventory:read'[\s\S]*subscriptionMode: 'read'/);
  assert.match(route, /'org:inventory:manage'[\s\S]*subscriptionMode: 'write'/);
  assert.equal([...route.matchAll(/organizationId: access\.organization\.id/g)].length, 2);
  assert.equal([...route.matchAll(/projectId: access\.project\.id/g)].length, 2);
  assert.match(route, /params\.getAll\('sourceInspectionId'\)\.length !== 1/);
  assert.match(route, /Cache-Control', 'private, no-store, max-age=0'/);
  assert.match(proxy, /'\/api\/inventory-transactions'/);
  assert.match(proxy, /'\/api\/inventory-transactions\/:path\*'/);
  assert.match(service, /quality: 'ACCEPTED'/);
  assert.match(service, /bindings debe vincular todas y sólo las líneas/);
  assert.match(service, /quantityDelta: canonicalStored\(disposition\.quantity\)/);
  assert.match(service, /quantityDelta: negativeStored\(entry\.quantityDelta\)/);
  assert.doesNotMatch(service, /parseFloat|parseInt/);
});
