import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL(
  '../prisma/migrations/20260802170000_inventory_stock_ledger/migration.sql',
  import.meta.url,
);
const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const verifierPath = new URL('../scripts/verify-inventory-stock-ledger-migration.mjs', import.meta.url);
const vercelBuildPath = new URL('../scripts/vercel-build.mjs', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

const [migration, schema, verifier, vercelBuild, packageJson] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(schemaPath, 'utf8'),
  readFile(verifierPath, 'utf8'),
  readFile(vercelBuildPath, 'utf8'),
  readFile(packagePath, 'utf8').then(JSON.parse),
]);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[0];
}

test('schema exposes canonical items, immutable source bindings, transactions, entries and DB projection', () => {
  assert.match(schema, /enum InventoryTransactionKind \{[\s\S]*RECEIPT_PUTAWAY[\s\S]*REVERSAL/);

  const item = modelBlock('InventoryItem');
  assert.match(item, /code\s+String\s+@db\.VarChar\(32\)/);
  assert.match(item, /name\s+String\s+@db\.VarChar\(160\)/);
  assert.match(item, /baseUnit\s+String\s+@db\.VarChar\(32\)/);
  assert.match(item, /@@unique\(\[organizationId, projectId, id\]/);
  assert.match(item, /@@unique\(\[organizationId, projectId, id, baseUnit\]/);
  assert.match(item, /@@unique\(\[projectId, code\]/);

  const binding = modelBlock('PurchaseOrderLineInventoryBinding');
  assert.match(binding, /unitSnapshot\s+String\s+@db\.VarChar\(32\)/);
  assert.match(binding, /@@unique\(\[projectId, purchaseOrderId, purchaseOrderLineId\]/);
  assert.match(binding, /@@unique\(\[projectId, purchaseOrderId, purchaseOrderLineId, unitSnapshot\]/);
  assert.match(binding, /fields: \[projectId, purchaseOrderId, purchaseOrderLineId, unitSnapshot\][\s\S]*references: \[projectId, purchaseOrderId, id, unit\]/);
  assert.match(binding, /fields: \[organizationId, projectId, inventoryItemId, unitSnapshot\][\s\S]*references: \[organizationId, projectId, id, baseUnit\]/);
  assert.match(binding, /operationKey\s+String\s+@db\.VarChar\(190\)/);
  assert.match(binding, /requestFingerprint\s+String\s+@db\.Char\(64\)/);

  const transaction = modelBlock('InventoryTransaction');
  assert.match(transaction, /sourceInspection\s+GoodsReceiptInspection\?/);
  assert.match(transaction, /reversesTransaction\s+InventoryTransaction\?/);
  assert.match(transaction, /@@unique\(\[organizationId, projectId, reversesTransactionId\]/);

  const entry = modelBlock('InventoryLedgerEntry');
  assert.match(entry, /quantityDelta\s+Decimal\s+@db\.Decimal\(14, 3\)/);
  assert.match(entry, /inspectionDisposition\s+GoodsReceiptInspectionDisposition\?/);
  assert.match(entry, /@@unique\(\[projectId, inspectionDispositionId\]/);
  assert.match(entry, /@@unique\(\[organizationId, projectId, reversesEntryId\]/);

  const balance = modelBlock('InventoryBalance');
  assert.match(balance, /onHand\s+Decimal\s+@default\(0\) @db\.Decimal\(14, 3\)/);
  assert.match(balance, /@@id\(\[organizationId, projectId, inventoryItemId, locationId\]/);
});

test('migration makes the ledger exact, append-only and fail-closed without inferred stock', () => {
  for (const table of [
    'InventoryItem',
    'PurchaseOrderLineInventoryBinding',
    'InventoryTransaction',
    'InventoryLedgerEntry',
    'InventoryBalance',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(migration, /"quantityDelta" DECIMAL\(14,3\) NOT NULL/);
  assert.match(migration, /"quantityDelta" <> 0::numeric[\s\S]*"quantityDelta" <> 'NaN'::numeric/);
  assert.match(migration, /"onHand" >= 0::numeric[\s\S]*"onHand" <> 'NaN'::numeric/);
  assert.match(migration, /Purchase order line, inventory item and binding units must match exactly/);
  assert.match(migration, /FOREIGN KEY \("projectId", "purchaseOrderId", "purchaseOrderLineId", "unitSnapshot"\)[\s\S]*REFERENCES "PurchaseOrderLine"\("projectId", "purchaseOrderId", "id", "unit"\)[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.match(migration, /FOREIGN KEY \("organizationId", "projectId", "inventoryItemId", "unitSnapshot"\)[\s\S]*REFERENCES "InventoryItem"\("organizationId", "projectId", "id", "baseUnit"\)[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.match(migration, /inventory-binding:' \|\| NEW\."projectId"[\s\S]*inventory-item:' \|\| NEW\."projectId"/);
  assert.match(migration, /inventory-item:' \|\| OLD\."projectId" \|\| ':' \|\| OLD\."id"/);
  assert.match(migration, /Inventory putaway must post every ACCEPTED disposition exactly once/);
  assert.match(migration, /Inventory reversal must exactly reverse every original ledger entry/);
  assert.match(migration, /Inventory putaway must be reversed before correcting or reversing its inspection/);
  assert.match(migration, /receipt\."status" = ''POSTED''/);
  assert.match(migration, /active_item_count >= 500/);
  assert.match(migration, /InventoryItem active limit of 500 reached for project/);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*inventory-stock:/);
  assert.match(migration, /InventoryBalance must exactly project the immutable ledger/);
  assert.match(migration, /pg_catalog\.pg_trigger_depth\(\) <> 2/);
  assert.match(migration, /InventoryBalance is database-owned and rejects direct writes/);
  assert.doesNotMatch(migration, /INSERT INTO "Inventory(?:Item|LedgerEntry|Balance)"[\s\S]*SELECT[\s\S]*stockpiles/i);
  assert.match(migration, /deliberately not backfilled/);
});

test('append-only, projection and lifecycle triggers are deferred where needed and always enabled', () => {
  const expectedTriggers = [
    'InventoryItem_mutation_guard',
    'InventoryItem_active_guard',
    'InventoryItem_no_truncate',
    'PurchaseOrderLine_inventory_unit_guard',
    'PurchaseOrderLineInventoryBinding_append_only',
    'PurchaseOrderLineInventoryBinding_no_truncate',
    'InventoryTransaction_append_only',
    'InventoryTransaction_no_truncate',
    'InventoryTransaction_snapshot_guard',
    'InventoryLedgerEntry_00_finite_guard',
    'InventoryLedgerEntry_append_only',
    'InventoryLedgerEntry_no_truncate',
    'InventoryLedgerEntry_balance_project',
    'InventoryLedgerEntry_snapshot_guard',
    'InventoryBalance_projection_guard',
    'InventoryBalance_no_truncate',
    'GoodsReceiptInspection_inventory_putaway_guard',
  ];
  for (const trigger of expectedTriggers) {
    assert.match(migration, new RegExp(`CREATE (?:CONSTRAINT )?TRIGGER "${trigger}"`));
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
  assert.match(
    migration,
    /CREATE CONSTRAINT TRIGGER "InventoryTransaction_snapshot_guard"[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
  );
  assert.match(
    migration,
    /CREATE CONSTRAINT TRIGGER "InventoryLedgerEntry_snapshot_guard"[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
  );
  assert.doesNotMatch(migration, /IF NOT FOUND/);
});

test('dedicated verifier and Vercel gate prove stock migration after deploy and before generation', () => {
  assert.match(verifier, /INVENTORY_STOCK_LEDGER_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /INVENTORY_STOCK_LEDGER_MIGRATION_SCHEMA/);
  assert.match(verifier, /20260802170000_inventory_stock_ledger/);
  assert.match(verifier, /_prisma_migrations/);
  assert.match(verifier, /sslmode[^\n]*verify-full/);
  assert.match(verifier, /SET CONSTRAINTS ALL IMMEDIATE/);
  assert.match(verifier, /ROLLBACK/);
  assert.match(verifier, /InventoryBalance/);
  assert.match(verifier, /partial accepted-disposition putaway/);
  assert.match(verifier, /partial multi-entry reversal/);
  assert.match(verifier, /insertPutawayEntriesTogether/);
  assert.match(verifier, /direct exact\/no-op balance mutation/);

  const migrate = vercelBuild.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const inspection = vercelBuild.indexOf('[cliPaths.goodsReceiptInspectionVerifier]');
  const inventory = vercelBuild.indexOf('[cliPaths.inventoryStockLedgerVerifier]');
  const generate = vercelBuild.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && inspection > migrate && inventory > inspection && generate > inventory);
  assert.match(vercelBuild, /INVENTORY_STOCK_LEDGER_MIGRATION_SCHEMA: "public"/);
  assert.equal(
    packageJson.scripts['verify:inventory-stock-ledger-migration'],
    'node scripts/verify-inventory-stock-ledger-migration.mjs',
  );
});
