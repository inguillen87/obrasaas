import assert from 'node:assert/strict';
import test from 'node:test';

import { createSupplierCommitment } from '../src/lib/supplier-commitments.js';

function decimal(value) {
  return { toString: () => value };
}

function createInput(quantity) {
  return {
    operationKey: `commitment-${quantity}`,
    supplierId: 'supplier-a',
    purchaseOrderId: 'order-a',
    kind: 'MATERIAL_DELIVERY',
    status: 'CONFIRMED',
    title: 'Entrega de ladrillos',
    startsOn: '2026-08-20',
    endsOn: '2026-08-20',
    reminderEnabled: false,
    taskLinks: [],
    lines: [{ purchaseOrderLineId: 'line-a', quantity }],
  };
}

function quantityStore({
  ordered = '0.300',
  committed = ['0.100'],
  received = ['0.100'],
} = {}) {
  const state = { createdData: null, persisted: null };
  const orderLine = {
    id: 'line-a',
    description: 'Ladrillo hueco',
    unit: 'unidad',
    quantity: decimal(ordered),
  };
  const transaction = {
    async $executeRawUnsafe() { return 1; },
    project: {
      async findFirst() {
        return {
          id: 'project-a',
          organizationId: 'organization-a',
          status: 'ACTIVE',
          name: 'Edificio Centro',
          organization: { timezone: 'America/Argentina/Buenos_Aires' },
        };
      },
    },
    supplier: {
      async findFirst() {
        return {
          id: 'supplier-a',
          legalName: 'Materiales SA',
          email: null,
          active: true,
        };
      },
    },
    purchaseOrder: {
      async findFirst() {
        return {
          id: 'order-a',
          number: 'OC-1',
          status: 'APPROVED',
          lines: [orderLine],
        };
      },
    },
    supplierCommitmentLine: {
      async findMany() {
        return committed.map((quantity) => ({ quantity: decimal(quantity) }));
      },
    },
    goodsReceiptLine: {
      async findMany() {
        return received.map((quantity) => ({ quantity: decimal(quantity) }));
      },
    },
    supplierCommitmentEvent: {
      async findFirst() { return null; },
      async create() { return {}; },
    },
    supplierCommitment: {
      async findFirst({ where }) {
        if (where.operationKey) return null;
        return state.persisted;
      },
      async create({ data }) {
        state.createdData = data;
        const persistedLines = (data.lines?.create || []).map((line) => ({
          ...line,
          quantity: decimal(line.quantity),
          purchaseOrderLine: orderLine,
        }));
        state.persisted = {
          id: 'commitment-a',
          ...data,
          revision: 0,
          scheduleRevision: 0,
          fulfilledAt: null,
          supplier: {
            id: 'supplier-a',
            legalName: 'Materiales SA',
          },
          purchaseOrder: {
            id: 'order-a',
            number: 'OC-1',
            status: 'APPROVED',
          },
          taskLinks: [],
          lines: persistedLines,
          reminderDeliveries: [],
          createdAt: new Date('2026-08-01T12:00:00.000Z'),
          updatedAt: new Date('2026-08-01T12:00:00.000Z'),
        };
        return state.persisted;
      },
    },
    auditLog: { async create() { return {}; } },
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

test('commitment quantities accept only decimal strings before opening a transaction', async () => {
  let transactionCalls = 0;
  const prisma = {
    async $transaction() {
      transactionCalls += 1;
      throw new Error('transaction must not run');
    },
  };
  for (const quantity of [0.1, '0.0001', '1e-3', ' 0.100 ']) {
    await assert.rejects(
      createSupplierCommitment(prisma, {
        scope: { organizationId: 'organization-a', projectId: 'project-a' },
        actorId: 'admin-a',
        input: createInput(quantity),
      }),
      /cantidad comprometida/i,
      String(quantity),
    );
  }
  assert.equal(transactionCalls, 0);
});

test('exact thousandths accept the remaining ordered quantity and serialize fixed scale', async () => {
  const current = quantityStore();
  const result = await createSupplierCommitment(current.prisma, {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'admin-a',
    input: createInput('0.1'),
    now: new Date('2026-08-01T12:00:00.000Z'),
  });
  assert.equal(current.state.createdData.lines.create[0].quantity, '0.100');
  assert.equal(result.commitment.lines[0].quantity, '0.100');
});

test('backend rejects an allocation one exact thousandth above the remaining quantity', async () => {
  const current = quantityStore();
  await assert.rejects(
    createSupplierCommitment(current.prisma, {
      scope: { organizationId: 'organization-a', projectId: 'project-a' },
      actorId: 'admin-a',
      input: createInput('0.101'),
      now: new Date('2026-08-01T12:00:00.000Z'),
    }),
    (error) => error.code === 'SUPPLIER_COMMITMENT_OVER_ALLOCATED'
      && error.status === 409,
  );
  assert.equal(current.state.createdData, null);
});
