import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [reconciliationClient, receiptClient] = await Promise.all([
  readFile(new URL(
    'src/app/dashboard/purchases/receipt-reconciliation-client.js',
    root,
  ), 'utf8'),
  readFile(new URL('src/app/dashboard/purchases/receipt-client.js', root), 'utf8'),
]);

test('procurement UI exposes an explicit, exact and replay-safe receipt reconciliation', () => {
  assert.match(
    reconciliationClient,
    /\/api\/goods-receipt-commitment-allocations\?\$\{query\.toString\(\)\}/,
  );
  assert.match(
    reconciliationClient,
    /"Idempotency-Key": attemptRef\.current\.operationKey/,
  );
  assert.match(reconciliationClient, /parseProcurementQuantity\(quantity\)/);
  assert.match(reconciliationClient, /formatProcurementQuantity\(parsed\)/);
  assert.match(reconciliationClient, /compareProcurementQuantities\(parsed, maximumScaled\)/);
  assert.doesNotMatch(reconciliationClient, /Number\(.*quantity/);
  assert.doesNotMatch(reconciliationClient, /parseFloat|parseInt/);
});

test('reconciliation remains separate from stock availability and never infers FIFO', () => {
  assert.match(reconciliationClient, /no marca por sí sola el material como disponible/);
  assert.match(reconciliationClient, /no asigna por fecha ni por FIFO/);
  assert.doesNotMatch(reconciliationClient, /AVAILABLE/);
  assert.match(reconciliationClient, /FULLY_ALLOCATED/);
  assert.match(reconciliationClient, /FULLY_RECEIVED/);
  assert.match(reconciliationClient, /documentado \{balance\.allocatedQuantity\}/);
  assert.doesNotMatch(reconciliationClient, /recibido \{balance\.allocatedQuantity\}/);
});

test('receipt creation refreshes the server-owned reconciliation inventory', () => {
  assert.match(receiptClient, /setReconciliationVersion\(\(current\) => current \+ 1\)/);
  assert.match(receiptClient, /<ReceiptReconciliationClient/);
  assert.match(receiptClient, /refreshVersion=\{reconciliationVersion\}/);
});

test('reconciliation loads complete inspection heads and excludes frozen receipts', () => {
  assert.match(reconciliationClient, /latestReceiptInspection/);
  assert.match(reconciliationClient, /INSPECTION_PAGE_SIZE = 50/);
  assert.match(reconciliationClient, /INSPECTION_HARD_CAP = 500/);
  assert.match(
    reconciliationClient,
    /\/api\/goods-receipt-inspections\?\$\{query\.toString\(\)\}/,
  );
  assert.match(reconciliationClient, /while \(true\)/);
  assert.match(reconciliationClient, /inspections\.length >= INSPECTION_HARD_CAP/);
  assert.match(
    reconciliationClient,
    /inspectionHeads\.get\(balance\.goodsReceiptId\)\.kind === "REVERSAL"/,
  );
  assert.match(reconciliationClient, /Inspección v\$\{head\.version\} finalizada/);
  assert.match(reconciliationClient, /Revisión reabierta/);
  assert.match(reconciliationClient, /Registrá primero una REVERSAL/);
});
