import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGoodsReceipt,
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
        return null;
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
