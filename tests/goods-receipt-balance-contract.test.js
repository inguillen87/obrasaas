import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [client, page, route, purchasesClient] = await Promise.all([
  readFile(new URL('src/app/dashboard/purchases/receipt-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/purchases/page.js', root), 'utf8'),
  readFile(new URL('src/app/api/goods-receipts/route.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/purchases/purchases-client.js', root), 'utf8'),
]);

test('receipt UI consumes server-owned line balances instead of rebuilding from a capped history', () => {
  assert.match(client, /initialLineBalances/);
  assert.match(client, /balance\?\.remainingToReceive \|\| line\.quantity/);
  assert.match(client, /result\.lineBalances/);
  assert.match(client, /setLineBalances\(indexLineBalances\(result\.lineBalances\)\)/);
  assert.doesNotMatch(client, /function receivedByLine/);
  assert.doesNotMatch(client, /Number\(line\.quantity/);
  assert.match(purchasesClient, /initialLineBalances/);
  assert.match(purchasesClient, /initialReceiptsTruncated/);
});

test('purchases page declares receipt truncation while balances cover the full posted history', () => {
  assert.match(page, /listGoodsReceiptLineBalances/);
  assert.match(page, /purchaseOrderIds: data\.purchaseOrders\.map/);
  assert.match(page, /take: 501/);
  assert.match(page, /initialReceipts=\{receipts\.slice\(0, 500\)\.map\(serializeGoodsReceipt\)\}/);
  assert.match(page, /initialReceiptsTruncated=\{receipts\.length > 500\}/);
  assert.match(page, /initialLineBalances=\{lineBalances\}/);
});

test('receipt refresh is tenant scoped and returns authoritative balances with truncation metadata', () => {
  assert.match(route, /organizationId: access\.organization\.id/);
  assert.match(route, /projectId: access\.project\.id/);
  assert.match(route, /parseGoodsReceiptListQuery/);
  assert.match(route, /goodsReceiptListWhere\(query\)/);
  assert.match(route, /purchaseOrder: \{ select: \{ id: true, number: true \} \}/);
  assert.match(route, /select: \{ id: true, description: true, unit: true \}/);
  assert.match(route, /take: query\.limit \+ 1/);
  assert.match(route, /orderBy: \[\{ receivedAt: 'desc' \}, \{ id: 'desc' \}\]/);
  assert.match(route, /purchaseOrderIds: balanceOrderIds/);
  assert.match(route, /select: \{ id: true \}/);
  assert.match(route, /take: 500/);
  assert.match(route, /receipts: page\.map\(serializeGoodsReceipt\)/);
  assert.match(route, /encodeGoodsReceiptListCursor/);
  assert.match(route, /lineBalances/);
  assert.match(route, /Cache-Control': 'private, no-store'/);
});
