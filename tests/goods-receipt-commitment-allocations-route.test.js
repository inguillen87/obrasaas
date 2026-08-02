import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeUrl = new URL(
  '../src/app/api/goods-receipt-commitment-allocations/route.js',
  import.meta.url,
);

test('allocation route owns tenant scope, permissions, idempotency and bounded input', async () => {
  const source = await readFile(routeUrl, 'utf8');
  assert.match(source, /requireTenantPermission\(access, 'org:execution:manage'/);
  assert.match(source, /requireTenantPermission\(access, 'org:execution:read'/);
  assert.match(source, /requireScheduleIdempotencyKey\(request\)/);
  assert.match(source, /MAX_REQUEST_BYTES = 16 \* 1024/);
  assert.match(source, /readJsonRequest\(request, \{ maxBytes: MAX_REQUEST_BYTES \}\)/);
  assert.match(source, /organizationId: access\.organization\.id/);
  assert.match(source, /projectId: access\.project\.id/);
  assert.match(source, /const CREATE_FIELDS = new Set\(\[\s*'goodsReceiptLineId',\s*'supplierCommitmentId',\s*'quantity',\s*\]\)/);
  assert.doesNotMatch(source, /searchParams\.get\(['"]organizationId/);
  assert.doesNotMatch(source, /searchParams\.get\(['"]projectId/);
});

test('allocation GET is purchase-order bounded, paginated and never publicly cached', async () => {
  const source = await readFile(routeUrl, 'utf8');
  assert.match(source, /const QUERY_FIELDS = new Set\(\['purchaseOrderId', 'cursor', 'limit'\]\)/);
  assert.match(source, /purchaseOrderId: scheduleQueryValue\(searchParams, 'purchaseOrderId'\)/);
  assert.match(source, /cursor: scheduleQueryValue\(searchParams, 'cursor'\)/);
  assert.match(source, /limit: scheduleQueryValue\(searchParams, 'limit'\)/);
  assert.match(source, /Cache-Control', 'private, no-store, max-age=0'/);
});

test('allocation route maps known errors and keeps unexpected database details private', async () => {
  const source = await readFile(routeUrl, 'utf8');
  assert.match(source, /goodsReceiptCommitmentAllocationErrorResponse\(error\)/);
  assert.match(source, /projectWritePolicyErrorResponse\(error\)/);
  assert.match(source, /GOODS_RECEIPT_COMMITMENT_ALLOCATION_WRITE_FAILED/);
  assert.match(source, /GOODS_RECEIPT_COMMITMENT_ALLOCATION_READ_FAILED/);
  assert.doesNotMatch(source, /error\.message[),]/);
});
