import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [inventoryClient, inspectionClient, receiptClient, purchasesClient, purchasesPage, css] = await Promise.all([
  readFile(
    new URL('../src/app/dashboard/purchases/receipt-inventory-client.js', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../src/app/dashboard/purchases/receipt-inspection-client.js', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../src/app/dashboard/purchases/receipt-client.js', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../src/app/dashboard/purchases/purchases-client.js', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../src/app/dashboard/purchases/page.js', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../src/app/dashboard/purchases/receipt-inventory-client.module.css', import.meta.url),
    'utf8',
  ),
]);

test('inventory UI separates ACCEPTED inspection from explicit physical stock', () => {
  assert.match(inventoryClient, /ACEPTADO confirma calidad y ubicación/);
  assert.match(inventoryClient, /sólo ingresa a existencia física después/);
  assert.match(inventoryClient, /nunca infiere el vínculo por descripción, fecha o FIFO/);
  assert.match(inventoryClient, /ni lo reserva para tareas/);
  assert.match(inventoryClient, /Ingresar todo lo ACEPTADO a stock/);
  assert.match(inventoryClient, /No admite ingreso parcial/);
  assert.match(inventoryClient, /kind: "RECEIPT_PUTAWAY"/);
  assert.match(inventoryClient, /sourceInspectionId: inspectionId/);
  assert.match(inventoryClient, /purchaseOrderLineId: line\.purchaseOrderLineId/);
  assert.match(inventoryClient, /inventoryItemId: line\.binding\?\.inventoryItem\?\.id/);
  assert.doesNotMatch(inventoryClient, /parseFloat|parseInt/);
});

test('material creation preserves the authoritative purchase-line unit and explicit identity', () => {
  assert.match(inventoryClient, /baseUnit: createLine\.unit/);
  assert.match(inventoryClient, /item\.baseUnit === line\.unit/);
  assert.match(inventoryClient, /Material canónico de la misma unidad/);
  assert.match(inventoryClient, /Seleccionar explícitamente/);
  assert.match(inventoryClient, /Código único/);
  assert.match(inventoryClient, /Unidad contractual/);
  assert.match(inventoryClient, /readOnly value=\{createLine\?\.unit \|\| ""\}/);
  assert.match(inventoryClient, /\/api\/inventory-items/);
  assert.match(inventoryClient, /"Idempotency-Key": itemAttemptRef\.current\.operationKey/);
});

test('putaway and reversal writes are replay-safe and refresh authoritative state', () => {
  assert.match(
    inventoryClient,
    /\/api\/inventory-transactions\?sourceInspectionId=\$\{encodeURIComponent\(inspectionId\)\}/,
  );
  assert.match(inventoryClient, /"Idempotency-Key": putawayAttemptRef\.current\.operationKey/);
  assert.match(inventoryClient, /"Idempotency-Key": reversalAttemptRef\.current\.operationKey/);
  assert.match(inventoryClient, /kind: "REVERSAL"/);
  assert.match(inventoryClient, /reversesTransactionId: putaway\.id/);
  assert.match(inventoryClient, /await refresh\(\)/);
  assert.match(inventoryClient, /si el material\s+ya fue consumido o movido/);
  assert.match(inventoryClient, /registrá una nueva versión de inspección/);
});

test('inspection editing fails closed while ledger status is unknown or stock is active', () => {
  assert.match(inspectionClient, /currentInventoryPutawayState === null/);
  assert.match(
    inspectionClient,
    /inventoryPutawayBlocked = inventoryPutawayActive \|\| inventoryPutawayPending/,
  );
  assert.match(inspectionClient, /if \(inventoryPutawayBlocked\)/);
  assert.match(inspectionClient, /Revertí primero el ingreso de inventario/);
  assert.match(inspectionClient, /disabled=\{[\s\S]*inventoryPutawayBlocked/);
  assert.match(inspectionClient, /Validando el ledger de inventario/);
  assert.match(inspectionClient, /<ReceiptInventoryClient/);
  assert.match(inspectionClient, /key=\{head\.id\}/);
});

test('inventory permission is distinct and wired server-to-client without client-owned scope', () => {
  const inspectionMount = receiptClient.match(/<ReceiptInspectionClient[\s\S]*?\/>/)?.[0] || '';
  assert.match(
    purchasesPage,
    /canReadInventory=\{hasTenantPermission\(access, "org:inventory:read"\)\}/,
  );
  assert.match(
    purchasesPage,
    /canManageInventory=\{hasTenantPermission\(access, "org:inventory:manage"\)\}/,
  );
  assert.match(purchasesClient, /canReadInventory=\{canReadInventory\}/);
  assert.match(purchasesClient, /canManageInventory=\{canManageInventory\}/);
  assert.match(inspectionMount, /canReadInventory=\{canReadInventory\}/);
  assert.match(inspectionMount, /canManageInventory=\{canManageInventory\}/);
  assert.match(inspectionClient, /canReadInventory && head && head\.kind !== "REVERSAL"/);
  assert.match(inspectionClient, /canManage=\{canManageInventory\}/);
  assert.doesNotMatch(inventoryClient, /organizationId|projectId/);
});

test('inventory controls expose status semantics and collapse safely on mobile', () => {
  assert.match(inventoryClient, /role="status"/);
  assert.match(inventoryClient, /aria-live="polite"/);
  assert.match(inventoryClient, /setLoadAttempt\(\(current\) => current \+ 1\)/);
  assert.match(inventoryClient, /Reintentar carga segura/);
  assert.match(inventoryClient, /ON-HAND/);
  assert.match(inventoryClient, /NO DISPONIBLE/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /width: 100%/);
});
