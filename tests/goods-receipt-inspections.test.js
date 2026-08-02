import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createGoodsReceiptInspection,
  listGoodsReceiptInspections,
} from '../src/lib/goods-receipt-inspections.js';

const SCOPE = { organizationId: 'organization-a', projectId: 'project-a' };
const NOW = new Date('2026-08-02T19:00:00.000Z');

function decimal(value) {
  return { toString: () => value };
}

function inspectionInput(overrides = {}) {
  return {
    goodsReceiptId: 'receipt-a',
    kind: 'FINALIZATION',
    locationId: 'location-a',
    reason: 'Una fracción dañada fue separada.',
    dispositions: [
      {
        goodsReceiptLineId: 'receipt-line-a',
        allocationId: 'allocation-a',
        quality: 'ACCEPTED',
        quantity: '0.500',
      },
      {
        goodsReceiptLineId: 'receipt-line-a',
        allocationId: 'allocation-a',
        quality: 'DAMAGED',
        quantity: '0.100',
      },
      {
        goodsReceiptLineId: 'receipt-line-a',
        allocationId: null,
        quality: 'ACCEPTED',
        quantity: '0.400',
      },
    ],
    ...overrides,
  };
}

function inspectionStore({ locationActive = true, receiptStatus = 'POSTED' } = {}) {
  const state = {
    audits: [],
    inspections: [],
    locationQueries: 0,
    receiptQueries: 0,
  };
  const receipt = {
    id: 'receipt-a',
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    purchaseOrderId: 'order-a',
    status: receiptStatus,
    lines: [{
      id: 'receipt-line-a',
      purchaseOrderLineId: 'order-line-a',
      quantity: decimal('1.000'),
      commitmentAllocations: [{
        id: 'allocation-a',
        supplierCommitmentId: 'commitment-a',
        purchaseOrderLineId: 'order-line-a',
        quantity: decimal('0.600'),
      }],
    }],
  };
  const transaction = {
    async $executeRawUnsafe() {},
    project: {
      async findFirst() {
        return { ...SCOPE, id: SCOPE.projectId, status: 'ACTIVE' };
      },
    },
    goodsReceipt: {
      async findFirst() {
        state.receiptQueries += 1;
        return receipt;
      },
    },
    goodsReceiptInspection: {
      async findFirst({ where }) {
        if (where.operationKey) {
          return state.inspections.find((row) => row.operationKey === where.operationKey) || null;
        }
        return [...state.inspections].sort((left, right) => right.version - left.version)[0] || null;
      },
      async create({ data }) {
        const dispositions = (data.dispositions?.create || []).map((row, index) => ({
          id: `disposition-${state.inspections.length}-${index}`,
          ...row,
          quantity: decimal(row.quantity),
        }));
        const row = {
          id: `inspection-${state.inspections.length + 1}`,
          ...data,
          inspectedAt: NOW,
          createdAt: NOW,
          dispositions,
        };
        state.inspections.push(row);
        return row;
      },
    },
    supplierCommitmentLineClosure: {
      async findMany() {
        return [];
      },
    },
    inventoryLocation: {
      async findFirst() {
        state.locationQueries += 1;
        return locationActive
          ? { id: 'location-a', code: 'OBRA', name: 'Acopio de obra' }
          : null;
      },
    },
    auditLog: {
      async create({ data }) {
        state.audits.push(data);
        return data;
      },
    },
  };
  return {
    state,
    prisma: {
      async $transaction(callback) {
        return callback(transaction);
      },
    },
  };
}

test('first inspection is version 1, server attributed and partitions exact allocation plus remainder', async () => {
  const store = inspectionStore();
  const result = await createGoodsReceiptInspection(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inspection-attempt-a',
    input: inspectionInput(),
    now: NOW,
  });

  assert.equal(result.replayed, false);
  assert.equal(result.inspection.version, 1);
  assert.equal(result.inspection.inspectedById, 'user-a');
  assert.equal(result.inspection.locationId, 'location-a');
  assert.deepEqual(result.inspection.location, {
    id: 'location-a',
    code: 'OBRA',
    name: 'Acopio de obra',
  });
  assert.deepEqual(result.inspection.dispositions.map((row) => row.quantity), [
    '0.400',
    '0.500',
    '0.100',
  ]);
  assert.equal(store.state.audits[0].action, 'goods_receipt_inspection.finalization');
  assert.equal(store.state.audits[0].metadata.version, 1);
});

test('same idempotency key replays exactly and rejects mutated content before reading receipt again', async () => {
  const store = inspectionStore();
  const options = {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inspection-attempt-b',
    input: inspectionInput(),
    now: NOW,
  };
  const first = await createGoodsReceiptInspection(store.prisma, options);
  const replay = await createGoodsReceiptInspection(store.prisma, options);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.inspection, first.inspection);
  assert.equal(store.state.receiptQueries, 1);

  await assert.rejects(
    createGoodsReceiptInspection(store.prisma, {
      ...options,
      input: inspectionInput({ reason: 'Contenido cambiado.' }),
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
  assert.equal(store.state.receiptQueries, 1);
});

test('correction advances to version 2 and reversal to version 3 while preserving historical location', async () => {
  const store = inspectionStore();
  const first = await createGoodsReceiptInspection(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inspection-attempt-c1',
    input: inspectionInput(),
    now: NOW,
  });
  const correction = await createGoodsReceiptInspection(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inspection-attempt-c2',
    input: inspectionInput({
      kind: 'CORRECTION',
      predecessorId: first.inspection.id,
      reason: 'Control técnico repetido.',
    }),
    now: NOW,
  });
  const reversal = await createGoodsReceiptInspection(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'inspection-attempt-c3',
    input: {
      goodsReceiptId: 'receipt-a',
      kind: 'REVERSAL',
      predecessorId: correction.inspection.id,
      reason: 'Reabrir la conciliación.',
    },
    now: NOW,
  });

  assert.equal(correction.inspection.version, 2);
  assert.equal(reversal.inspection.version, 3);
  assert.equal(reversal.inspection.locationId, 'location-a');
  assert.deepEqual(reversal.inspection.location, correction.inspection.location);
  assert.deepEqual(reversal.inspection.dispositions, []);
  assert.equal(store.state.locationQueries, 2, 'REVERSAL must not revalidate active location');
});

test('incomplete partitions and inactive locations fail closed without persistence', async () => {
  const incomplete = inspectionStore();
  await assert.rejects(
    createGoodsReceiptInspection(incomplete.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inspection-attempt-d1',
      input: inspectionInput({
        dispositions: [{
          goodsReceiptLineId: 'receipt-line-a',
          allocationId: 'allocation-a',
          quality: 'ACCEPTED',
          quantity: '0.599',
        }],
      }),
    }),
    (error) => error.code === 'GOODS_RECEIPT_INSPECTION_LINE_PARTITION_INVALID',
  );
  assert.equal(incomplete.state.inspections.length, 0);

  const inactive = inspectionStore({ locationActive: false });
  await assert.rejects(
    createGoodsReceiptInspection(inactive.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'inspection-attempt-d2',
      input: inspectionInput(),
    }),
    (error) => error.code === 'GOODS_RECEIPT_INSPECTION_LOCATION_SCOPE' && error.status === 409,
  );
  assert.equal(inactive.state.inspections.length, 0);
});

test('listing requires exactly one bounded tenant scope and emits a cursor', async () => {
  let query;
  const prisma = {
    goodsReceiptInspection: {
      async findMany(args) {
        query = args;
        return Array.from({ length: 3 }, (_, index) => ({
          id: `inspection-${index + 1}`,
          projectId: SCOPE.projectId,
          purchaseOrderId: 'order-a',
          goodsReceiptId: 'receipt-a',
          kind: index === 2 ? 'REVERSAL' : index === 0 ? 'FINALIZATION' : 'CORRECTION',
          version: index + 1,
          predecessorId: index ? `inspection-${index}` : null,
          inspectedById: 'user-a',
          locationId: 'location-a',
          locationCodeSnapshot: 'OBRA',
          locationNameSnapshot: 'Acopio de obra',
          inspectedAt: NOW,
          createdAt: NOW,
          dispositions: [],
        }));
      },
    },
  };
  const page = await listGoodsReceiptInspections(prisma, {
    ...SCOPE,
    goodsReceiptId: 'receipt-a',
    limit: '2',
  });
  assert.deepEqual(query.where, {
    ...SCOPE,
    goodsReceiptId: 'receipt-a',
  });
  assert.equal(query.take, 3);
  assert.equal(page.inspections.length, 2);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextCursor, 'inspection-2');

  await assert.rejects(
    listGoodsReceiptInspections(prisma, {
      ...SCOPE,
      purchaseOrderId: 'order-a',
      goodsReceiptId: 'receipt-a',
    }),
    (error) => error.code === 'GOODS_RECEIPT_INSPECTION_QUERY_SCOPE_INVALID',
  );
});

test('inspection route owns tenant, actor, strict body, bounded query and private cache policy', async () => {
  const route = await readFile(
    new URL('../src/app/api/goods-receipt-inspections/route.js', import.meta.url),
    'utf8',
  );
  assert.match(route, /MAX_REQUEST_BYTES = 64 \* 1024/);
  assert.match(route, /requireScheduleIdempotencyKey\(request\)/);
  assert.match(route, /assertScheduleObject\([\s\S]*CREATE_FIELDS/);
  assert.match(route, /assertScheduleSearchParams\(searchParams, QUERY_FIELDS\)/);
  assert.match(route, /actorId: access\.databaseUserId/);
  assert.equal([...route.matchAll(/organizationId: access\.organization\.id/g)].length, 2);
  assert.equal([...route.matchAll(/projectId: access\.project\.id/g)].length, 2);
  assert.match(route, /'org:execution:manage'[\s\S]*subscriptionMode: 'write'/);
  assert.match(route, /'org:execution:read'[\s\S]*subscriptionMode: 'read'/);
  assert.match(route, /Cache-Control', 'private, no-store, max-age=0'/);
});
