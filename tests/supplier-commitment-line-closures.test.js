import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createSupplierCommitmentLineClosure,
  listSupplierCommitmentLineClosures,
} from '../src/lib/supplier-commitment-line-closures.js';

const SCOPE = { organizationId: 'organization-a', projectId: 'project-a' };
const NOW = new Date('2026-08-02T20:00:00.000Z');

function decimal(value) {
  return { toString: () => value };
}

function closureInput(overrides = {}) {
  return {
    supplierCommitmentId: 'commitment-a',
    purchaseOrderLineId: 'order-line-a',
    kind: 'FINAL_DELIVERY',
    reason: 'Faltante final confirmado con el proveedor.',
    ...overrides,
  };
}

function closureStore({
  committed = '1.000',
  accepted = '0.750',
  allocations = true,
  inspectionKind = 'FINALIZATION',
  inspectionMissing = false,
} = {}) {
  const state = {
    audits: [],
    closures: [],
    closureCreates: 0,
    lineQueries: 0,
  };
  const allocationRows = allocations ? [{
    id: 'allocation-a',
    goodsReceiptId: 'receipt-a',
    quantity: decimal('1.000'),
  }] : [];
  const inspectionRows = inspectionMissing || !allocations ? [] : [{
    goodsReceiptId: 'receipt-a',
    kind: inspectionKind,
    dispositions: inspectionKind === 'REVERSAL' ? [] : [{
      allocationId: 'allocation-a',
      quantity: decimal(accepted),
    }],
  }];
  const transaction = {
    async $executeRawUnsafe() {},
    project: {
      async findFirst() {
        return { ...SCOPE, id: SCOPE.projectId, status: 'ACTIVE' };
      },
    },
    supplierCommitmentLine: {
      async findFirst() {
        state.lineQueries += 1;
        return {
          commitmentId: 'commitment-a',
          projectId: SCOPE.projectId,
          purchaseOrderId: 'order-a',
          purchaseOrderLineId: 'order-line-a',
          quantity: decimal(committed),
          commitment: { kind: 'MATERIAL_DELIVERY', status: 'CONFIRMED' },
        };
      },
    },
    supplierCommitmentLineClosure: {
      async findFirst({ where }) {
        if (where.operationKey) {
          return state.closures.find((row) => row.operationKey === where.operationKey) || null;
        }
        return [...state.closures].sort((left, right) => right.version - left.version)[0] || null;
      },
      async create({ data }) {
        state.closureCreates += 1;
        const row = {
          id: `closure-${state.closures.length + 1}`,
          ...data,
          acceptedQuantity: data.acceptedQuantity === null
            ? null
            : decimal(data.acceptedQuantity),
          shortageQuantity: data.shortageQuantity === null
            ? null
            : decimal(data.shortageQuantity),
          createdAt: NOW,
        };
        state.closures.push(row);
        return row;
      },
    },
    goodsReceiptCommitmentAllocation: {
      async findMany() {
        return allocationRows;
      },
    },
    goodsReceiptInspection: {
      async findMany() {
        return inspectionRows;
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

test('final delivery starts at version 1 and derives accepted plus shortage from active inspections', async () => {
  const store = closureStore();
  const result = await createSupplierCommitmentLineClosure(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'closure-attempt-a',
    input: closureInput(),
  });

  assert.equal(result.replayed, false);
  assert.equal(result.closure.version, 1);
  assert.equal(result.closure.closedById, 'user-a');
  assert.equal(result.closure.acceptedQuantity, '0.750');
  assert.equal(result.closure.shortageQuantity, '0.250');
  assert.equal(store.state.audits[0].action, 'supplier_commitment_line.closed');
  assert.equal(store.state.audits[0].metadata.version, 1);
});

test('uninspected or reversed posted allocations are pending review, never inferred shortage', async () => {
  for (const current of [
    closureStore({ inspectionMissing: true }),
    closureStore({ inspectionKind: 'REVERSAL' }),
  ]) {
    await assert.rejects(
      createSupplierCommitmentLineClosure(current.prisma, {
        scope: SCOPE,
        actorId: 'user-a',
        operationKey: `closure-attempt-${current.state.lineQueries}`,
        input: closureInput(),
      }),
      (error) => (
        error.code === 'SUPPLIER_COMMITMENT_LINE_CLOSURE_INSPECTION_REQUIRED'
        && error.status === 409
      ),
    );
    assert.equal(current.state.closureCreates, 0);
  }
});

test('zero allocations can close as an explicit full shortage but still requires a reason', async () => {
  const withoutReason = closureStore({ allocations: false });
  await assert.rejects(
    createSupplierCommitmentLineClosure(withoutReason.prisma, {
      scope: SCOPE,
      actorId: 'user-a',
      operationKey: 'closure-attempt-b1',
      input: closureInput({ reason: undefined }),
    }),
    (error) => error.code === 'SUPPLIER_COMMITMENT_LINE_CLOSURE_SHORTAGE_REASON_REQUIRED',
  );

  const explicit = closureStore({ allocations: false });
  const result = await createSupplierCommitmentLineClosure(explicit.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'closure-attempt-b2',
    input: closureInput({ reason: 'El proveedor confirmó que no realizará entregas.' }),
  });
  assert.equal(result.closure.acceptedQuantity, '0.000');
  assert.equal(result.closure.shortageQuantity, '1.000');
});

test('closure reversal is version 2 and a later final closure is version 3', async () => {
  const store = closureStore();
  const first = await createSupplierCommitmentLineClosure(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'closure-attempt-c1',
    input: closureInput(),
  });
  const reversal = await createSupplierCommitmentLineClosure(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'closure-attempt-c2',
    input: closureInput({
      kind: 'REVERSAL',
      predecessorId: first.closure.id,
      reason: 'Reabrir el control del proveedor.',
    }),
  });
  const closedAgain = await createSupplierCommitmentLineClosure(store.prisma, {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'closure-attempt-c3',
    input: closureInput({ predecessorId: reversal.closure.id }),
  });

  assert.equal(reversal.closure.version, 2);
  assert.equal(reversal.closure.acceptedQuantity, null);
  assert.equal(reversal.closure.shortageQuantity, null);
  assert.equal(closedAgain.closure.version, 3);
  assert.deepEqual(store.state.audits.map((row) => row.action), [
    'supplier_commitment_line.closed',
    'supplier_commitment_line.reopened',
    'supplier_commitment_line.closed',
  ]);
});

test('idempotent replay is exact and mutated content never reuses the closure', async () => {
  const store = closureStore();
  const options = {
    scope: SCOPE,
    actorId: 'user-a',
    operationKey: 'closure-attempt-d',
    input: closureInput(),
  };
  const first = await createSupplierCommitmentLineClosure(store.prisma, options);
  const replay = await createSupplierCommitmentLineClosure(store.prisma, options);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.closure, first.closure);
  assert.equal(store.state.lineQueries, 1);

  await assert.rejects(
    createSupplierCommitmentLineClosure(store.prisma, {
      ...options,
      input: closureInput({ reason: 'Otro motivo.' }),
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
  assert.equal(store.state.lineQueries, 1);
});

test('closure listing stays tenant scoped, bounded and requires paired line filters', async () => {
  let query;
  const prisma = {
    supplierCommitmentLineClosure: {
      async findMany(args) {
        query = args;
        return Array.from({ length: 3 }, (_, index) => ({
          id: `closure-${index + 1}`,
          projectId: SCOPE.projectId,
          purchaseOrderId: 'order-a',
          purchaseOrderLineId: 'order-line-a',
          supplierCommitmentId: 'commitment-a',
          kind: index === 1 ? 'REVERSAL' : 'FINAL_DELIVERY',
          version: index + 1,
          predecessorId: index ? `closure-${index}` : null,
          closedById: 'user-a',
          acceptedQuantity: index === 1 ? null : decimal('1.000'),
          shortageQuantity: index === 1 ? null : decimal('0.000'),
          reason: index === 1 ? 'Reabrir.' : null,
          createdAt: NOW,
        }));
      },
    },
  };
  const page = await listSupplierCommitmentLineClosures(prisma, {
    ...SCOPE,
    purchaseOrderId: 'order-a',
    supplierCommitmentId: 'commitment-a',
    purchaseOrderLineId: 'order-line-a',
    limit: '2',
  });
  assert.deepEqual(query.where, {
    ...SCOPE,
    purchaseOrderId: 'order-a',
    supplierCommitmentId: 'commitment-a',
    purchaseOrderLineId: 'order-line-a',
  });
  assert.equal(query.take, 3);
  assert.equal(page.closures.length, 2);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextCursor, 'closure-2');

  await assert.rejects(
    listSupplierCommitmentLineClosures(prisma, {
      ...SCOPE,
      purchaseOrderId: 'order-a',
      supplierCommitmentId: 'commitment-a',
    }),
    (error) => error.code === 'SUPPLIER_COMMITMENT_LINE_CLOSURE_QUERY_SCOPE_INVALID',
  );
});

test('closure route owns tenant, actor, idempotency, strict fields and private cache policy', async () => {
  const route = await readFile(
    new URL('../src/app/api/supplier-commitment-line-closures/route.js', import.meta.url),
    'utf8',
  );
  assert.match(route, /MAX_REQUEST_BYTES = 16 \* 1024/);
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
