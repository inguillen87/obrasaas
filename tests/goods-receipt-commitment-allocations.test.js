import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGoodsReceiptCommitmentAllocation,
  listGoodsReceiptCommitmentAllocations,
} from '../src/lib/goods-receipt-commitment-allocations.js';

const activeScope = {
  organizationId: 'organization-a',
  projectId: 'project-a',
};

function decimal(value) {
  return { toString: () => value };
}

function scaled(value) {
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 1_000n) + BigInt(fraction.padEnd(3, '0'));
}

function fixed(value) {
  const whole = value / 1_000n;
  const fraction = (value % 1_000n).toString().padStart(3, '0');
  return `${whole}.${fraction}`;
}

function allocationRow(overrides = {}) {
  return {
    id: 'allocation-a',
    organizationId: activeScope.organizationId,
    projectId: activeScope.projectId,
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'order-line-a',
    goodsReceiptId: 'receipt-a',
    goodsReceiptLineId: 'receipt-line-a',
    supplierCommitmentId: 'commitment-a',
    quantity: decimal('0.100'),
    operationKey: 'allocate-001',
    requestFingerprint: 'stored-fingerprint',
    createdById: 'admin-a',
    createdAt: new Date('2026-08-02T12:00:00.000Z'),
    ...overrides,
  };
}

function createInput(quantity = '0.100') {
  return {
    goodsReceiptLineId: 'receipt-line-a',
    supplierCommitmentId: 'commitment-a',
    quantity,
  };
}

function mutationStore({
  receiptQuantity = '0.300',
  commitmentQuantity = '0.250',
  existing = [],
  receiptAvailable = true,
  commitmentAvailable = true,
  createError = null,
} = {}) {
  const state = {
    allocations: existing.map((row, index) => allocationRow({
      id: `existing-${index}`,
      operationKey: `existing-operation-${index}`,
      requestFingerprint: `existing-fingerprint-${index}`,
      ...row,
      quantity: decimal(row.quantity || '0.100'),
    })),
    audit: [],
    creates: 0,
    transactionCalls: 0,
  };

  function matching(where) {
    return state.allocations.filter((row) => (
      (!where.organizationId || row.organizationId === where.organizationId)
      && (!where.projectId || row.projectId === where.projectId)
      && (!where.operationKey || row.operationKey === where.operationKey)
      && (!where.goodsReceiptLineId || row.goodsReceiptLineId === where.goodsReceiptLineId)
      && (!where.supplierCommitmentId || row.supplierCommitmentId === where.supplierCommitmentId)
      && (!where.purchaseOrderLineId || row.purchaseOrderLineId === where.purchaseOrderLineId)
    ));
  }

  const transaction = {
    async $executeRawUnsafe() { return 1; },
    project: {
      async findFirst() {
        return { ...activeScope, id: activeScope.projectId, status: 'ACTIVE' };
      },
    },
    goodsReceiptLine: {
      async findFirst() {
        if (!receiptAvailable) return null;
        return {
          id: 'receipt-line-a',
          projectId: activeScope.projectId,
          purchaseOrderId: 'order-a',
          purchaseOrderLineId: 'order-line-a',
          goodsReceiptId: 'receipt-a',
          quantity: decimal(receiptQuantity),
          goodsReceipt: {
            status: 'POSTED',
            receivedAt: new Date('2026-08-02T10:00:00.000Z'),
          },
        };
      },
    },
    supplierCommitmentLine: {
      async findFirst() {
        if (!commitmentAvailable) return null;
        return {
          commitmentId: 'commitment-a',
          projectId: activeScope.projectId,
          purchaseOrderId: 'order-a',
          purchaseOrderLineId: 'order-line-a',
          quantity: decimal(commitmentQuantity),
          commitment: {
            status: 'CONFIRMED',
            title: 'Entrega de ladrillos',
            supplier: { legalName: 'Materiales SA' },
          },
        };
      },
    },
    goodsReceiptCommitmentAllocation: {
      async findFirst({ where }) {
        return matching(where)[0] || null;
      },
      async aggregate({ where }) {
        const total = matching(where).reduce(
          (sum, row) => sum + scaled(row.quantity.toString()),
          0n,
        );
        return { _sum: { quantity: total === 0n ? null : decimal(fixed(total)) } };
      },
      async create({ data }) {
        state.creates += 1;
        if (createError) throw createError;
        const row = allocationRow({
          ...data,
          id: `allocation-${state.creates}`,
          quantity: decimal(data.quantity),
          createdAt: new Date('2026-08-02T12:00:00.000Z'),
        });
        state.allocations.push(row);
        return row;
      },
    },
    auditLog: {
      async create({ data }) {
        state.audit.push(data);
        return data;
      },
    },
  };
  return {
    state,
    prisma: {
      async $transaction(callback) {
        state.transactionCalls += 1;
        return callback(transaction);
      },
    },
  };
}

test('allocation quantities require decimal strings before opening a transaction', async () => {
  for (const value of [0.1, 1, ' 0.100 ', '0.0001', '1e-3', '0']) {
    const current = mutationStore();
    await assert.rejects(
      createGoodsReceiptCommitmentAllocation(current.prisma, {
        scope: activeScope,
        actorId: 'admin-a',
        operationKey: 'allocate-001',
        input: createInput(value),
      }),
      (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_QUANTITY_INVALID'
        && error.status === 400,
      String(value),
    );
    assert.equal(current.state.transactionCalls, 0);
  }
});

test('operationKey is accepted only from the Idempotency-Key argument', async () => {
  const current = mutationStore();
  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(current.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: { ...createInput(), operationKey: 'body-operation' },
    }),
    (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_IDEMPOTENCY_BODY_FORBIDDEN',
  );
  assert.equal(current.state.transactionCalls, 0);
});

test('creates one exact allocation and returns authoritative balances for both lines', async () => {
  const current = mutationStore({
    existing: [{ quantity: '0.100' }],
  });
  const result = await createGoodsReceiptCommitmentAllocation(current.prisma, {
    scope: activeScope,
    actorId: 'admin-a',
    operationKey: 'allocate-001',
    input: createInput('0.15'),
  });

  assert.equal(result.replayed, false);
  assert.equal(result.allocation.quantity, '0.150');
  assert.equal(result.allocation.createdAt, '2026-08-02T12:00:00.000Z');
  assert.deepEqual(result.balances.receiptLine, {
    goodsReceiptId: 'receipt-a',
    goodsReceiptLineId: 'receipt-line-a',
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'order-line-a',
    receivedQuantity: '0.300',
    allocatedQuantity: '0.250',
    remainingQuantity: '0.050',
    status: 'PARTIALLY_ALLOCATED',
    receiptStatus: 'POSTED',
    receivedAt: '2026-08-02T10:00:00.000Z',
  });
  assert.deepEqual(result.balances.commitmentLine, {
    supplierCommitmentId: 'commitment-a',
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'order-line-a',
    committedQuantity: '0.250',
    allocatedQuantity: '0.250',
    remainingQuantity: '0.000',
    status: 'FULLY_RECEIVED',
    commitmentStatus: 'CONFIRMED',
    title: 'Entrega de ladrillos',
    supplierLabel: 'Materiales SA',
  });
  assert.equal(current.state.creates, 1);
  assert.equal(current.state.audit.length, 1);
  assert.equal(current.state.audit[0].action, 'goods_receipt_commitment_allocation.created');
  assert.equal(current.state.audit[0].metadata.quantity, '0.150');
});

test('fails closed when receipt or commitment exact balance would be exceeded', async () => {
  const receiptFull = mutationStore({
    receiptQuantity: '0.200',
    commitmentQuantity: '1.000',
    existing: [{ quantity: '0.100' }],
  });
  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(receiptFull.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: createInput('0.101'),
    }),
    (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_RECEIPT_EXCEEDED'
      && error.status === 409,
  );
  assert.equal(receiptFull.state.creates, 0);

  const commitmentFull = mutationStore({
    receiptQuantity: '1.000',
    commitmentQuantity: '0.200',
    existing: [{ quantity: '0.100' }],
  });
  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(commitmentFull.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: createInput('0.101'),
    }),
    (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_COMMITMENT_EXCEEDED'
      && error.status === 409,
  );
  assert.equal(commitmentFull.state.creates, 0);
});

test('requires a posted receipt line and a non-cancelled material commitment in the same scope', async () => {
  const invalidReceipt = mutationStore({ receiptAvailable: false });
  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(invalidReceipt.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: createInput(),
    }),
    (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_RECEIPT_SCOPE',
  );

  const invalidCommitment = mutationStore({ commitmentAvailable: false });
  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(invalidCommitment.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: createInput(),
    }),
    (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_COMMITMENT_SCOPE',
  );
});

test('same idempotency key replays once and rejects a mutated canonical payload', async () => {
  const current = mutationStore();
  const first = await createGoodsReceiptCommitmentAllocation(current.prisma, {
    scope: activeScope,
    actorId: 'admin-a',
    operationKey: 'allocate-001',
    input: createInput('0.1'),
  });
  const replay = await createGoodsReceiptCommitmentAllocation(current.prisma, {
    scope: activeScope,
    actorId: 'admin-a',
    operationKey: 'allocate-001',
    input: createInput('0.100'),
  });
  assert.equal(first.allocation.id, replay.allocation.id);
  assert.equal(replay.replayed, true);
  assert.equal(current.state.creates, 1);
  assert.equal(current.state.audit.length, 1);

  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(current.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: createInput('0.101'),
    }),
    (error) => error.code === 'IDEMPOTENCY_REPLAY_MUTATED' && error.status === 409,
  );
  assert.equal(current.state.creates, 1);
});

test('known database/trigger conflicts are mapped without leaking provider details', async () => {
  const current = mutationStore({
    createError: {
      code: 'P2004',
      message: 'secret SQL trigger internals and connection details',
    },
  });
  await assert.rejects(
    createGoodsReceiptCommitmentAllocation(current.prisma, {
      scope: activeScope,
      actorId: 'admin-a',
      operationKey: 'allocate-001',
      input: createInput(),
    }),
    (error) => (
      error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_CONFLICT'
      && error.status === 409
      && !error.message.includes('secret')
    ),
  );
});

function listingStore() {
  const rows = [
    allocationRow({ id: 'allocation-1', quantity: decimal('0.100') }),
    allocationRow({
      id: 'allocation-2',
      goodsReceiptId: 'receipt-b',
      goodsReceiptLineId: 'receipt-line-b',
      quantity: decimal('0.050'),
    }),
    allocationRow({
      id: 'allocation-3',
      quantity: decimal('0.050'),
    }),
  ];
  const receiptLines = [
    {
      id: 'receipt-line-a',
      goodsReceiptId: 'receipt-a',
      purchaseOrderId: 'order-a',
      purchaseOrderLineId: 'order-line-a',
      quantity: decimal('0.200'),
      goodsReceipt: {
        status: 'POSTED',
        receivedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
    },
    {
      id: 'receipt-line-b',
      goodsReceiptId: 'receipt-b',
      purchaseOrderId: 'order-a',
      purchaseOrderLineId: 'order-line-a',
      quantity: decimal('0.100'),
      goodsReceipt: {
        status: 'POSTED',
        receivedAt: new Date('2026-08-01T11:00:00.000Z'),
      },
    },
    {
      id: 'receipt-line-zero',
      goodsReceiptId: 'receipt-zero',
      purchaseOrderId: 'order-a',
      purchaseOrderLineId: 'order-line-zero',
      quantity: decimal('0.500'),
      goodsReceipt: {
        status: 'POSTED',
        receivedAt: new Date('2026-08-01T12:00:00.000Z'),
      },
    },
  ];
  const commitmentLines = [
    {
      commitmentId: 'commitment-a',
      purchaseOrderId: 'order-a',
      purchaseOrderLineId: 'order-line-a',
      quantity: decimal('0.300'),
      commitment: {
        status: 'CONFIRMED',
        title: 'Entrega A',
        supplier: { legalName: 'Materiales SA' },
      },
    },
    {
      commitmentId: 'commitment-zero',
      purchaseOrderId: 'order-a',
      purchaseOrderLineId: 'order-line-zero',
      quantity: decimal('0.400'),
      commitment: {
        status: 'TENTATIVE',
        title: 'Entrega futura',
        supplier: { legalName: 'Proveedor Cero' },
      },
    },
  ];
  const transaction = {
    goodsReceiptCommitmentAllocation: {
      async findMany({ where, take }) {
        return rows.filter((row) => (
          row.organizationId === where.organizationId
          && row.projectId === where.projectId
          && row.purchaseOrderId === where.purchaseOrderId
          && (!where.id?.gt || row.id > where.id.gt)
        )).slice(0, take);
      },
      async groupBy({ by }) {
        if (by.length === 1) {
          const ids = [...new Set(rows.map((row) => row.goodsReceiptLineId))];
          return ids.map((goodsReceiptLineId) => ({
            goodsReceiptLineId,
            _sum: {
              quantity: decimal(fixed(rows
                .filter((row) => row.goodsReceiptLineId === goodsReceiptLineId)
                .reduce((sum, row) => sum + scaled(row.quantity.toString()), 0n))),
            },
          }));
        }
        const keys = [...new Map(rows.map((row) => [
          `${row.supplierCommitmentId}\u0000${row.purchaseOrderLineId}`,
          {
            supplierCommitmentId: row.supplierCommitmentId,
            purchaseOrderLineId: row.purchaseOrderLineId,
          },
        ])).values()];
        return keys.map((key) => {
          const total = rows
            .filter((row) => (
              row.supplierCommitmentId === key.supplierCommitmentId
              && row.purchaseOrderLineId === key.purchaseOrderLineId
            ))
            .reduce((sum, row) => sum + scaled(row.quantity.toString()), 0n);
          return {
            ...key,
            _sum: { quantity: decimal(fixed(total)) },
          };
        });
      },
    },
    goodsReceiptLine: {
      async findMany() {
        return receiptLines;
      },
    },
    supplierCommitmentLine: {
      async findMany() {
        return commitmentLines;
      },
    },
  };
  return {
    async $transaction(callback, options) {
      assert.deepEqual(options, { isolationLevel: 'RepeatableRead' });
      return callback(transaction);
    },
  };
}

test('bounded listing returns a cursor plus full-order balances including zero allocations', async () => {
  const result = await listGoodsReceiptCommitmentAllocations(listingStore(), {
    ...activeScope,
    purchaseOrderId: 'order-a',
    limit: '2',
  });
  assert.equal(result.allocations.length, 2);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextCursor, 'allocation-2');
  assert.deepEqual(result.receiptLineBalances.map((balance) => ({
    id: balance.goodsReceiptLineId,
    allocated: balance.allocatedQuantity,
    remaining: balance.remainingQuantity,
    status: balance.status,
  })), [
    {
      id: 'receipt-line-a',
      allocated: '0.150',
      remaining: '0.050',
      status: 'PARTIALLY_ALLOCATED',
    },
    {
      id: 'receipt-line-b',
      allocated: '0.050',
      remaining: '0.050',
      status: 'PARTIALLY_ALLOCATED',
    },
    {
      id: 'receipt-line-zero',
      allocated: '0.000',
      remaining: '0.500',
      status: 'UNALLOCATED',
    },
  ]);
  assert.deepEqual(result.commitmentLineBalances, [{
    supplierCommitmentId: 'commitment-a',
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'order-line-a',
    committedQuantity: '0.300',
    allocatedQuantity: '0.200',
    remainingQuantity: '0.100',
    status: 'PARTIALLY_RECEIVED',
    commitmentStatus: 'CONFIRMED',
    title: 'Entrega A',
    supplierLabel: 'Materiales SA',
  }, {
    supplierCommitmentId: 'commitment-zero',
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'order-line-zero',
    committedQuantity: '0.400',
    allocatedQuantity: '0.000',
    remainingQuantity: '0.400',
    status: 'NOT_RECEIVED',
    commitmentStatus: 'TENTATIVE',
    title: 'Entrega futura',
    supplierLabel: 'Proveedor Cero',
  }]);
});

test('listing requires one bounded purchase order and rejects oversized pages before querying', async () => {
  let transactions = 0;
  const prisma = {
    async $transaction() {
      transactions += 1;
      throw new Error('must not query');
    },
  };
  await assert.rejects(
    listGoodsReceiptCommitmentAllocations(prisma, {
      ...activeScope,
      limit: '10',
    }),
    /purchaseOrderId/,
  );
  await assert.rejects(
    listGoodsReceiptCommitmentAllocations(prisma, {
      ...activeScope,
      purchaseOrderId: 'order-a',
      limit: '201',
    }),
    (error) => error.code === 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_PAGE_INVALID',
  );
  assert.equal(transactions, 0);
});
