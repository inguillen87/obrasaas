import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createGoodsReceipt } from '../src/lib/goods-receipts.js';
import { createPurchaseOrder } from '../src/lib/purchase-orders.js';

const scope = {
  organizationId: 'organization-a',
  projectId: 'project-a',
};

function purchaseOrderReplayPrisma(replay) {
  const transaction = {
    async $executeRawUnsafe() {},
    project: {
      async findFirst() {
        return { ...scope, id: scope.projectId, status: 'ACTIVE' };
      },
    },
    purchaseOrder: {
      async findFirst() {
        return replay;
      },
    },
  };
  return {
    async $transaction(callback) {
      return callback(transaction);
    },
  };
}

const replay = {
  id: 'purchase-order-a',
  organizationId: scope.organizationId,
  projectId: scope.projectId,
  supplierId: 'supplier-a',
  supplier: { id: 'supplier-a', legalName: 'Proveedor A' },
  operationKey: 'purchase-attempt-a',
  number: 'OC-100',
  currency: 'ARS',
  status: 'DRAFT',
  total: 1000,
  revision: 0,
  lines: [{
    id: 'purchase-line-a',
    projectId: scope.projectId,
    purchaseOrderId: 'purchase-order-a',
    budgetLineId: 'budget-line-a',
    costCode: null,
    description: 'Cemento',
    unit: 'bolsa',
    quantity: 10,
    unitPrice: 100,
  }],
};

const purchaseInput = {
  operationKey: replay.operationKey,
  supplierId: replay.supplierId,
  number: replay.number,
  currency: replay.currency,
  lines: [{
    budgetLineId: 'budget-line-a',
    description: 'Cemento',
    unit: 'bolsa',
    quantity: 10,
    unitPrice: 100,
  }],
};

test('goods receipts reject duplicate order lines before opening a database transaction', async () => {
  let transactionCalls = 0;
  const prisma = {
    async $transaction() {
      transactionCalls += 1;
      throw new Error('database must not be reached');
    },
  };

  await assert.rejects(
    createGoodsReceipt(prisma, {
      scope,
      actorId: 'user-a',
      input: {
        operationKey: 'receipt-attempt-a',
        purchaseOrderId: replay.id,
        lines: [
          { purchaseOrderLineId: replay.lines[0].id, quantity: '1.000' },
          { purchaseOrderLineId: replay.lines[0].id, quantity: '2.000' },
        ],
      },
    }),
    (error) => (
      error.code === 'GOODS_RECEIPT_DUPLICATE_LINE'
      && error.status === 400
    ),
  );
  assert.equal(transactionCalls, 0);
});

test('purchase order idempotency replays an equivalent canonical payload', async () => {
  const result = await createPurchaseOrder(purchaseOrderReplayPrisma(replay), {
    scope,
    actorId: 'user-a',
    input: purchaseInput,
  });

  assert.equal(result.replayed, true);
  assert.equal(result.purchaseOrder.id, replay.id);
  assert.equal(result.purchaseOrder.supplier.legalName, 'Proveedor A');
});

test('purchase order replay treats an omitted currency as the stored supplier default', async () => {
  const result = await createPurchaseOrder(purchaseOrderReplayPrisma(replay), {
    scope,
    actorId: 'user-a',
    input: { ...purchaseInput, currency: undefined },
  });

  assert.equal(result.replayed, true);
  assert.equal(result.purchaseOrder.currency, 'ARS');
});

for (const [field, mutation] of [
  ['supplier', { supplierId: 'supplier-b' }],
  ['number', { number: 'OC-101' }],
  ['currency', { currency: 'USD' }],
  ['lines', {
    lines: [{
      ...purchaseInput.lines[0],
      quantity: 11,
    }],
  }],
]) {
  test(`purchase order idempotency rejects a changed ${field} payload`, async () => {
    await assert.rejects(
      createPurchaseOrder(purchaseOrderReplayPrisma(replay), {
        scope,
        actorId: 'user-a',
        input: { ...purchaseInput, ...mutation },
      }),
      (error) => (
        error.code === 'IDEMPOTENCY_REPLAY_MUTATED'
        && error.status === 409
      ),
    );
  });
}

test('operational procurement routes preserve structured project write errors', async () => {
  const routes = [
    'src/app/api/cash-funds/route.js',
    'src/app/api/cash-movements/route.js',
    'src/app/api/cash-movements/receipt/route.js',
    'src/app/api/purchase-orders/route.js',
    'src/app/api/goods-receipts/route.js',
    'src/app/api/goods-receipts/evidence/route.js',
    'src/app/api/supplier-invoices/route.js',
    'src/app/api/supplier-invoices/evidence/route.js',
  ];
  for (const route of routes) {
    const source = await readFile(new URL(`../${route}`, import.meta.url), 'utf8');
    assert.match(source, /projectWritePolicyErrorResponse\(error\)/, route);
  }
});

test('procurement upload controls clear native file inputs and invoice currency follows the linked order', async () => {
  const receiptClient = await readFile(
    new URL('../src/app/dashboard/purchases/receipt-client.js', import.meta.url),
    'utf8',
  );
  const payablesClient = await readFile(
    new URL('../src/app/dashboard/payables/payables-client.js', import.meta.url),
    'utf8',
  );
  const purchasesClient = await readFile(
    new URL('../src/app/dashboard/purchases/purchases-client.js', import.meta.url),
    'utf8',
  );

  for (const source of [receiptClient, payablesClient]) {
    assert.match(source, /fileInputRef = useRef\(null\)/);
    assert.match(source, /fileInputRef\.current\.value = ""/);
    assert.match(source, /ref=\{fileInputRef\}/);
  }
  assert.doesNotMatch(receiptClient, /useEffect/);
  assert.doesNotMatch(receiptClient, /Number\(quantity\)/);
  assert.match(receiptClient, /quantity: canonicalQuantity/);
  assert.match(receiptClient, /parseProcurementQuantity\(quantity\)/);
  assert.match(payablesClient, /currency: order\?\.currency/);
  assert.match(payablesClient, /Derivada de la orden de compra vinculada/);
  assert.match(payablesClient, /disabled=\{Boolean\(form\.purchaseOrderId\)\}/);
  assert.match(purchasesClient, /currency: suppliers\[0\]\?\.currency \|\| "ARS"/);
  assert.match(purchasesClient, /currency: supplier\?\.currency \|\| form\.currency/);
});
