import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GOODS_RECEIPT_LIST_MAX_LIMIT,
  encodeGoodsReceiptListCursor,
  goodsReceiptListWhere,
  parseGoodsReceiptListQuery,
} from '../src/app/api/goods-receipts/pagination.js';

const scope = { organizationId: 'org-a', projectId: 'project-a' };

test('goods receipt list query is bounded and rejects unknown or repeated filters', () => {
  const parsed = parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts?status=POSTED&limit=100',
    scope,
  );
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.status, 'POSTED');
  assert.equal(parsed.purchaseOrderId, null);
  assert.equal(parsed.cursor, null);
  assert.equal(GOODS_RECEIPT_LIST_MAX_LIMIT, 500);
  assert.equal(parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts',
    scope,
  ).limit, 500);

  assert.throws(() => parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts?limit=501',
    scope,
  ), /entre 1 y 500/);
  assert.throws(() => parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts?limit=001',
    scope,
  ), /limit no es válido/);
  assert.throws(() => parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts?status=POSTED&status=VOIDED',
    scope,
  ), /no puede repetirse/);
  assert.throws(() => parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts?organizationId=org-b',
    scope,
  ), /no está permitido/);
});

test('goods receipt cursor is keyset based and bound to tenant and filters', () => {
  const first = parseGoodsReceiptListQuery(
    'https://obrasaas.test/api/goods-receipts?purchaseOrderId=order-a&status=POSTED&limit=2',
    scope,
  );
  const cursor = encodeGoodsReceiptListCursor({
    id: 'receipt-b',
    receivedAt: new Date('2026-08-02T15:30:00.000Z'),
  }, first);
  const next = parseGoodsReceiptListQuery(
    `https://obrasaas.test/api/goods-receipts?purchaseOrderId=order-a&status=POSTED&limit=2&cursor=${encodeURIComponent(cursor)}`,
    scope,
  );
  assert.deepEqual(goodsReceiptListWhere(next), {
    organizationId: 'org-a',
    projectId: 'project-a',
    purchaseOrderId: 'order-a',
    status: 'POSTED',
    OR: [
      { receivedAt: { lt: new Date('2026-08-02T15:30:00.000Z') } },
      {
        receivedAt: new Date('2026-08-02T15:30:00.000Z'),
        id: { lt: 'receipt-b' },
      },
    ],
  });

  assert.throws(() => parseGoodsReceiptListQuery(
    `https://obrasaas.test/api/goods-receipts?purchaseOrderId=order-b&status=POSTED&cursor=${encodeURIComponent(cursor)}`,
    scope,
  ), /no corresponde a esta consulta/);
  assert.throws(() => parseGoodsReceiptListQuery(
    `https://obrasaas.test/api/goods-receipts?purchaseOrderId=order-a&status=POSTED&cursor=${encodeURIComponent(cursor)}`,
    { organizationId: 'org-b', projectId: 'project-a' },
  ), /no corresponde a esta consulta/);
});
