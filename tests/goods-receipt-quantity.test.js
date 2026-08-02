import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGoodsReceipt,
  listGoodsReceiptLineBalances,
  serializeGoodsReceipt,
} from '../src/lib/goods-receipts.js';

const scope = {
  organizationId: 'organization-a',
  projectId: 'project-a',
};

function decimal(value) {
  return {
    toString() {
      return value;
    },
  };
}

function receiptStore({
  ordered = '0.300',
  received = [],
  status = 'APPROVED',
  replay = null,
} = {}) {
  const state = {
    transactionCalls: 0,
    createCalls: 0,
    createdData: null,
    orderUpdate: null,
  };
  const order = {
    id: 'order-a',
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    status,
    revision: 0,
    lines: [{
      id: 'line-a',
      projectId: scope.projectId,
      purchaseOrderId: 'order-a',
      quantity: decimal(ordered),
      receiptLines: received.map((quantity, index) => ({
        id: `receipt-line-${index}`,
        quantity: decimal(quantity),
      })),
    }],
  };
  const transaction = {
    async $executeRawUnsafe() {
      return 1;
    },
    project: {
      async findFirst() {
        return { ...scope, id: scope.projectId, status: 'ACTIVE' };
      },
    },
    goodsReceipt: {
      async findFirst() {
        return replay;
      },
      async create({ data }) {
        state.createCalls += 1;
        state.createdData = data;
        return {
          id: 'goods-receipt-a',
          ...data,
          receipt: null,
          lines: data.lines.create.map((line, index) => ({
            id: `created-line-${index}`,
            ...line,
            quantity: decimal(line.quantity),
          })),
          receivedAt: new Date('2026-08-02T12:00:00.000Z'),
          createdAt: new Date('2026-08-02T12:00:00.000Z'),
          updatedAt: new Date('2026-08-02T12:00:00.000Z'),
        };
      },
    },
    purchaseOrder: {
      async findFirst() {
        return order;
      },
      async updateMany({ data }) {
        state.orderUpdate = data;
        return { count: 1 };
      },
    },
    auditLog: {
      async create() {
        return {};
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

function input(quantity, operationKey = 'receipt-operation-a') {
  return {
    operationKey,
    purchaseOrderId: 'order-a',
    lines: [{ purchaseOrderLineId: 'line-a', quantity }],
  };
}

test('goods receipt accepts the exact remaining boundary and persists a canonical decimal string', async () => {
  const current = receiptStore({ ordered: '0.300', received: ['0.100'] });
  const result = await createGoodsReceipt(current.prisma, {
    scope,
    actorId: 'user-a',
    input: input('0.2'),
  });

  assert.equal(current.state.transactionCalls, 1);
  assert.equal(current.state.createCalls, 1);
  assert.equal(current.state.createdData.lines.create[0].quantity, '0.200');
  assert.equal(result.receipt.lines[0].quantity, '0.200');
  assert.deepEqual(result.lineBalances, [{
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'line-a',
    ordered: '0.300',
    receivedPosted: '0.300',
    remainingToReceive: '0.000',
  }]);
  assert.equal(current.state.orderUpdate.status, 'RECEIVED');
});

test('equivalent decimal text inputs produce one canonical fingerprint', async () => {
  const fingerprints = [];
  for (const [index, quantity] of ['0.2', '0.20', '0.200'].entries()) {
    const current = receiptStore({ ordered: '1.000' });
    await createGoodsReceipt(current.prisma, {
      scope,
      actorId: 'user-a',
      input: input(quantity, `receipt-operation-${index}`),
    });
    fingerprints.push(current.state.createdData.requestFingerprint);
    assert.equal(current.state.createdData.lines.create[0].quantity, '0.200');
  }
  assert.equal(new Set(fingerprints).size, 1);
});

test('JSON numbers are rejected instead of rounded and never open a transaction', async () => {
  for (const value of [0.2, 0.1 + 0.2, 1, Number.NaN]) {
    const current = receiptStore();
    await assert.rejects(
      createGoodsReceipt(current.prisma, {
        scope,
        actorId: 'user-a',
        input: input(value),
      }),
      (error) => (
        error.code === 'GOODS_RECEIPT_QUANTITY_INVALID'
        && error.status === 400
      ),
    );
    assert.equal(current.state.transactionCalls, 0);
  }
});

test('serialization returns fixed three-decimal quantities for Prisma Decimal values', () => {
  const serialized = serializeGoodsReceipt({
    id: 'receipt-a',
    receipt: null,
    receivedAt: null,
    createdAt: null,
    updatedAt: null,
    lines: [{ id: 'line-a', quantity: decimal('0.2') }],
  });

  assert.equal(serialized.lines[0].quantity, '0.200');
});

test('invalid scale, overflow, zero and non-canonical syntax fail before a transaction', async () => {
  for (const quantity of [
    '0.0001',
    '100000000000.000',
    '0',
    '-0.001',
    '1e3',
    '1,5',
  ]) {
    const current = receiptStore();
    await assert.rejects(
      createGoodsReceipt(current.prisma, {
        scope,
        actorId: 'user-a',
        input: input(quantity),
      }),
      (error) => error.code === 'GOODS_RECEIPT_QUANTITY_INVALID',
      quantity,
    );
    assert.equal(current.state.transactionCalls, 0, quantity);
  }
});

test('over-reception is rejected at one exact thousandth above the remaining quantity', async () => {
  const current = receiptStore({ ordered: '0.300', received: ['0.100'] });
  await assert.rejects(
    createGoodsReceipt(current.prisma, {
      scope,
      actorId: 'user-a',
      input: input('0.201'),
    }),
    (error) => (
      error.code === 'GOODS_RECEIPT_OVER_RECEIVE'
      && error.status === 409
    ),
  );
  assert.equal(current.state.transactionCalls, 1);
  assert.equal(current.state.createCalls, 0);
});

test('multiple Prisma Decimal-like receipt quantities add exactly without floating-point drift', async () => {
  const current = receiptStore({
    ordered: '0.600',
    received: ['0.100', '0.200'],
  });
  const result = await createGoodsReceipt(current.prisma, {
    scope,
    actorId: 'user-a',
    input: input('0.300'),
  });

  assert.equal(result.receipt.lines[0].quantity, '0.300');
  assert.equal(current.state.orderUpdate.status, 'RECEIVED');
});

test('invalid persisted Decimal values fail closed before receipt creation', async () => {
  const current = receiptStore({ ordered: '1.000', received: ['0.0001'] });
  await assert.rejects(
    createGoodsReceipt(current.prisma, {
      scope,
      actorId: 'user-a',
      input: input('0.100'),
    }),
    (error) => error.code === 'GOODS_RECEIPT_QUANTITY_CORRUPT',
  );
  assert.equal(current.state.createCalls, 0);
});

test('server-owned line balances include every posted receipt without a client history cap', async () => {
  let lineQuery;
  let aggregateQuery;
  const prisma = {
    purchaseOrderLine: {
      async findMany(args) {
        lineQuery = args;
        return [{
          id: 'line-a',
          purchaseOrderId: 'order-a',
          quantity: decimal('1.000'),
        }];
      },
    },
    goodsReceiptLine: {
      async groupBy(args) {
        aggregateQuery = args;
        return [{
          purchaseOrderLineId: 'line-a',
          _sum: { quantity: decimal('0.501') },
        }];
      },
    },
  };

  const balances = await listGoodsReceiptLineBalances(prisma, {
    ...scope,
    purchaseOrderIds: ['order-a'],
  });

  assert.deepEqual(lineQuery.where, {
    projectId: scope.projectId,
    purchaseOrderId: { in: ['order-a'] },
    purchaseOrder: {
      organizationId: scope.organizationId,
      status: { in: ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
    },
  });
  assert.deepEqual(aggregateQuery.where, {
    projectId: scope.projectId,
    purchaseOrderId: { in: ['order-a'] },
    goodsReceipt: {
      organizationId: scope.organizationId,
      status: 'POSTED',
    },
  });
  assert.deepEqual(balances, [{
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'line-a',
    ordered: '1.000',
    receivedPosted: '0.501',
    remainingToReceive: '0.499',
  }]);
});

test('server-owned line balances reject an unbounded purchase-order scope', async () => {
  const prisma = {
    purchaseOrderLine: {
      async findMany() {
        assert.fail('invalid balance scope must fail before Prisma');
      },
    },
  };

  await assert.rejects(
    listGoodsReceiptLineBalances(prisma, {
      ...scope,
      purchaseOrderIds: Array.from({ length: 501 }, (_, index) => `order-${index}`),
    }),
    (error) => (
      error.code === 'GOODS_RECEIPT_BALANCE_SCOPE_INVALID'
      && error.status === 400
    ),
  );
});

test('idempotent replay returns authoritative balances instead of reapplying a client delta', async () => {
  const replay = {
    id: 'goods-receipt-a',
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    purchaseOrderId: 'order-a',
    operationKey: 'receipt-operation-a',
    requestFingerprint: null,
    protectedUploadId: null,
    receipt: null,
    lines: [{
      id: 'created-line-a',
      projectId: scope.projectId,
      purchaseOrderId: 'order-a',
      purchaseOrderLineId: 'line-a',
      quantity: decimal('0.200'),
    }],
    receivedAt: new Date('2026-08-02T12:00:00.000Z'),
    createdAt: new Date('2026-08-02T12:00:00.000Z'),
    updatedAt: new Date('2026-08-02T12:00:00.000Z'),
  };
  const current = receiptStore({
    ordered: '1.000',
    received: ['0.200'],
    status: 'PARTIALLY_RECEIVED',
    replay,
  });

  const result = await createGoodsReceipt(current.prisma, {
    scope,
    actorId: 'user-a',
    input: input('0.200'),
  });

  assert.equal(result.replayed, true);
  assert.equal(current.state.createCalls, 0);
  assert.equal(current.state.orderUpdate, null);
  assert.deepEqual(result.lineBalances, [{
    purchaseOrderId: 'order-a',
    purchaseOrderLineId: 'line-a',
    ordered: '1.000',
    receivedPosted: '0.200',
    remainingToReceive: '0.800',
  }]);
});
