import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createPurchaseOrder,
  listPurchaseOrders,
} from '../src/lib/purchase-orders.js';

const scope = { organizationId: 'organization-a', projectId: 'project-a' };
const validInput = {
  operationKey: 'purchase-attempt-exact-a',
  supplierId: 'supplier-a',
  number: 'OC-EXACT-1',
  currency: 'ARS',
  lines: [{
    budgetLineId: 'budget-line-a',
    description: 'Material exacto',
    unit: 'unidad',
    quantity: '1.250',
    unitPrice: '2.40',
  }],
};

function unreachablePrisma(counter) {
  return {
    async $transaction() {
      counter.calls += 1;
      throw new Error('database must not be reached');
    },
  };
}

function creationPrisma(capture) {
  const transaction = {
    async $executeRawUnsafe() {},
    project: {
      async findFirst() {
        return { ...scope, id: scope.projectId, status: 'ACTIVE' };
      },
    },
    purchaseOrder: {
      async findFirst() {
        return null;
      },
      async create(args) {
        capture.data = args.data;
        return {
          id: 'purchase-order-exact-a',
          ...args.data,
          status: 'DRAFT',
          revision: 0,
          lines: args.data.lines.create.map((line, index) => ({
            id: `purchase-line-exact-${index}`,
            purchaseOrderId: 'purchase-order-exact-a',
            ...line,
          })),
          supplier: { id: 'supplier-a', legalName: 'Proveedor exacto' },
        };
      },
    },
    budgetLine: {
      async findFirst() {
        return { id: 'budget-line-a', projectId: scope.projectId };
      },
    },
    supplier: {
      async findFirst() {
        return {
          id: 'supplier-a',
          organizationId: scope.organizationId,
          active: true,
          currency: 'ARS',
        };
      },
    },
    auditLog: {
      async create(args) {
        capture.audit = args.data;
      },
    },
  };
  return {
    async $transaction(callback) {
      return callback(transaction);
    },
  };
}

test('purchase order rejects numeric quantity and price before opening a transaction', async () => {
  for (const [code, line] of [
    ['PURCHASE_ORDER_QUANTITY_INVALID', { ...validInput.lines[0], quantity: 1.25 }],
    ['PURCHASE_ORDER_UNIT_PRICE_INVALID', { ...validInput.lines[0], unitPrice: 2.4 }],
  ]) {
    const counter = { calls: 0 };
    await assert.rejects(
      createPurchaseOrder(unreachablePrisma(counter), {
        scope,
        actorId: 'user-a',
        input: { ...validInput, lines: [line] },
      }),
      (error) => error.code === code && error.status === 400,
    );
    assert.equal(counter.calls, 0);
  }
});

test('purchase order persists only canonical Prisma Decimal strings and an exact rounded total', async () => {
  const capture = {};
  const result = await createPurchaseOrder(creationPrisma(capture), {
    scope,
    actorId: 'user-a',
    input: {
      ...validInput,
      lines: [
        { ...validInput.lines[0], quantity: '0.005', unitPrice: '1' },
        { ...validInput.lines[0], quantity: '0.005', unitPrice: '1.0' },
      ],
    },
  });

  assert.equal(capture.data.total, '0.01');
  assert.deepEqual(
    capture.data.lines.create.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      hasQuantityScaled: Object.hasOwn(line, 'quantityScaled'),
      hasUnitPriceScaled: Object.hasOwn(line, 'unitPriceScaled'),
    })),
    [
      { quantity: '0.005', unitPrice: '1.00', hasQuantityScaled: false, hasUnitPriceScaled: false },
      { quantity: '0.005', unitPrice: '1.00', hasQuantityScaled: false, hasUnitPriceScaled: false },
    ],
  );
  assert.equal(capture.audit.metadata.total, '0.01');
  assert.equal(result.purchaseOrder.total, '0.01');
});

test('purchase form sends decimal text without converting through Number', async () => {
  const source = await readFile(
    new URL('../src/app/dashboard/purchases/purchases-client.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /quantity: form\.quantity/);
  assert.match(source, /unitPrice: form\.unitPrice/);
  assert.doesNotMatch(source, /Number\(form\.(?:quantity|unitPrice)\)/);
});

test('purchase order reads serialize Prisma Decimal values at fixed scale', async () => {
  const result = await listPurchaseOrders({
    purchaseOrder: {
      async findMany() {
        return [{
          id: 'order-a',
          total: { toString: () => '0.5' },
          lines: [{
            id: 'line-a',
            quantity: { toString: () => '0.2' },
            unitPrice: { toString: () => '1' },
          }],
        }];
      },
    },
  }, scope);

  assert.equal(result.purchaseOrders[0].total, '0.50');
  assert.equal(result.purchaseOrders[0].lines[0].quantity, '0.200');
  assert.equal(result.purchaseOrders[0].lines[0].unitPrice, '1.00');
});

test('invalid persisted decimals fail closed as server data corruption', async () => {
  await assert.rejects(
    listPurchaseOrders({
      purchaseOrder: {
        async findMany() {
          return [{
            id: 'order-a',
            total: { toString: () => '1.00' },
            lines: [{
              id: 'line-a',
              quantity: { toString: () => '0.0001' },
              unitPrice: { toString: () => '1.00' },
            }],
          }];
        },
      },
    }, scope),
    (error) => (
      error.code === 'PURCHASE_ORDER_DECIMAL_CORRUPT'
      && error.status === 409
    ),
  );
});
