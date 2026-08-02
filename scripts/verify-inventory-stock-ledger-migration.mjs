import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'INVENTORY_STOCK_LEDGER_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'INVENTORY_STOCK_LEDGER_MIGRATION_SCHEMA';
const MIGRATION = '20260802170000_inventory_stock_ledger';
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const connectionString = process.env[CONNECTION_ENV];

if (!connectionString) {
  throw new Error(`${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePostgresUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${CONNECTION_ENV} must be a valid PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${CONNECTION_ENV} must use PostgreSQL.`);
  }
  return parsed;
}

function resolveDatabaseSchema(value) {
  const parsed = parsePostgresUrl(value);
  const dsnSchemas = parsed.searchParams.getAll('schema');
  if (dsnSchemas.length > 1 && new Set(dsnSchemas).size > 1) {
    throw new Error(`${CONNECTION_ENV} contains conflicting schema parameters.`);
  }
  const dsnSchema = dsnSchemas[0] || null;
  const explicitSchema = process.env[SCHEMA_ENV] || null;
  if (explicitSchema && dsnSchema && explicitSchema !== dsnSchema) {
    throw new Error(`${SCHEMA_ENV} does not match the schema declared in the database URL.`);
  }
  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(`Declare ${SCHEMA_ENV} or add an explicit schema parameter to the database URL.`);
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error('The inventory stock ledger schema must be a safe PostgreSQL identifier.');
  }
  return schema;
}

function hardenedVerifierConnectionString(value) {
  const parsed = parsePostgresUrl(value);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  if (hostname.endsWith('.neon.tech')) {
    parsed.searchParams.set('sslmode', 'verify-full');
  } else if (!isLocal && parsed.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error(`${CONNECTION_ENV} must use sslmode=verify-full for a remote PostgreSQL host.`);
  }
  return parsed.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function normalizeDefinition(value) {
  return String(value || '').replaceAll('"', '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);
const migrationSql = await readFile(new URL(
  `../prisma/migrations/${MIGRATION}/migration.sql`,
  import.meta.url,
));
const expectedMigrationChecksum = createHash('sha256').update(migrationSql).digest('hex');

async function assertMigration(client) {
  const table = await client.query(
    "SELECT to_regclass(format('%I.%I', current_schema(), '_prisma_migrations')) AS name",
  );
  invariant(table.rows[0]?.name, 'The configured schema has no _prisma_migrations table.');
  const result = await client.query(
    `SELECT "checksum" FROM "_prisma_migrations"
      WHERE "migration_name" = $1
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL`,
    [MIGRATION],
  );
  invariant(result.rowCount === 1, 'Inventory stock ledger migration is not applied exactly once.');
  invariant(
    result.rows[0]?.checksum === expectedMigrationChecksum,
    'Applied inventory stock ledger migration does not match the repository checksum.',
  );
}

async function assertEnum(client) {
  const result = await client.query(
    `SELECT enum_record.enumlabel AS value
       FROM pg_type AS type_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = type_record.typnamespace
       JOIN pg_enum AS enum_record ON enum_record.enumtypid = type_record.oid
      WHERE namespace_record.nspname = current_schema()
        AND type_record.typname = 'InventoryTransactionKind'
      ORDER BY enum_record.enumsortorder`,
  );
  invariant(
    JSON.stringify(result.rows.map((row) => row.value))
      === JSON.stringify(['RECEIPT_PUTAWAY', 'REVERSAL']),
    'InventoryTransactionKind enum drifted.',
  );
}

async function columnsFor(client, table) {
  const result = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable,
            numeric_precision, numeric_scale, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return new Map(result.rows.map((row) => [row.column_name, row]));
}

async function assertColumns(client) {
  const required = new Map([
    ['InventoryItem', [
      'id', 'organizationId', 'projectId', 'code', 'name', 'baseUnit',
      'active', 'revision', 'createdAt', 'updatedAt',
    ]],
    ['PurchaseOrderLineInventoryBinding', [
      'id', 'organizationId', 'projectId', 'purchaseOrderId', 'purchaseOrderLineId',
      'inventoryItemId', 'unitSnapshot', 'operationKey', 'requestFingerprint',
      'boundById', 'createdAt',
    ]],
    ['InventoryTransaction', [
      'id', 'organizationId', 'projectId', 'kind', 'operationKey',
      'requestFingerprint', 'actorId', 'occurredAt', 'createdAt',
    ]],
    ['InventoryLedgerEntry', [
      'id', 'organizationId', 'projectId', 'transactionId', 'inventoryItemId',
      'locationId', 'quantityDelta', 'itemCodeSnapshot', 'itemNameSnapshot',
      'unitSnapshot', 'locationCodeSnapshot', 'locationNameSnapshot', 'createdAt',
    ]],
    ['InventoryBalance', [
      'organizationId', 'projectId', 'inventoryItemId', 'locationId',
      'onHand', 'revision', 'updatedAt',
    ]],
  ]);
  for (const [table, names] of required) {
    const columns = await columnsFor(client, table);
    for (const name of names) {
      invariant(columns.get(name)?.is_nullable === 'NO', `${table}.${name} is missing or nullable.`);
    }
  }

  const item = await columnsFor(client, 'InventoryItem');
  invariant(Number(item.get('code')?.character_maximum_length) === 32, 'InventoryItem.code must be VARCHAR(32).');
  invariant(Number(item.get('name')?.character_maximum_length) === 160, 'InventoryItem.name must be VARCHAR(160).');
  invariant(Number(item.get('baseUnit')?.character_maximum_length) === 32, 'InventoryItem.baseUnit must be VARCHAR(32).');

  const transaction = await columnsFor(client, 'InventoryTransaction');
  for (const name of [
    'purchaseOrderId', 'goodsReceiptId', 'sourceInspectionId',
    'reversesTransactionId', 'reason',
  ]) {
    invariant(transaction.get(name)?.is_nullable === 'YES', `InventoryTransaction.${name} must remain nullable by kind.`);
  }

  const entry = await columnsFor(client, 'InventoryLedgerEntry');
  invariant(
    entry.get('quantityDelta')?.data_type === 'numeric'
      && Number(entry.get('quantityDelta')?.numeric_precision) === 14
      && Number(entry.get('quantityDelta')?.numeric_scale) === 3,
    'InventoryLedgerEntry.quantityDelta must remain DECIMAL(14,3).',
  );
  for (const name of ['purchaseLineBindingId', 'inspectionDispositionId', 'reversesEntryId']) {
    invariant(entry.get(name)?.is_nullable === 'YES', `InventoryLedgerEntry.${name} must be nullable by kind.`);
  }
  const balance = await columnsFor(client, 'InventoryBalance');
  invariant(
    balance.get('onHand')?.data_type === 'numeric'
      && Number(balance.get('onHand')?.numeric_precision) === 14
      && Number(balance.get('onHand')?.numeric_scale) === 3,
    'InventoryBalance.onHand must remain DECIMAL(14,3).',
  );
}

async function assertIndexes(client) {
  const expected = new Map([
    ['InventoryItem_scope_id_key', ['InventoryItem', '(organizationid, projectid, id)']],
    ['InventoryItem_scope_unit_key', ['InventoryItem', '(organizationid, projectid, id, baseunit)']],
    ['InventoryItem_project_code_key', ['InventoryItem', '(projectid, code)']],
    ['POLInventoryBinding_scope_id_key', ['PurchaseOrderLineInventoryBinding', '(organizationid, projectid, id)']],
    ['POLInventoryBinding_purchase_line_key', ['PurchaseOrderLineInventoryBinding', '(projectid, purchaseorderid, purchaseorderlineid)']],
    ['POLInventoryBinding_purchase_line_unit_key', ['PurchaseOrderLineInventoryBinding', '(projectid, purchaseorderid, purchaseorderlineid, unitsnapshot)']],
    ['POLInventoryBinding_operation_key', ['PurchaseOrderLineInventoryBinding', '(projectid, operationkey)']],
    ['PurchaseOrderLine_inventory_unit_key', ['PurchaseOrderLine', '(projectid, purchaseorderid, id, unit)']],
    ['InventoryTransaction_scope_id_key', ['InventoryTransaction', '(organizationid, projectid, id)']],
    ['InventoryTransaction_operation_key', ['InventoryTransaction', '(projectid, operationkey)']],
    ['InventoryTransaction_source_inspection_key', ['InventoryTransaction', '(projectid, sourceinspectionid)']],
    ['InventoryTransaction_reversal_key', ['InventoryTransaction', '(organizationid, projectid, reversestransactionid)']],
    ['InventoryLedgerEntry_scope_id_key', ['InventoryLedgerEntry', '(organizationid, projectid, id)']],
    ['InventoryLedgerEntry_disposition_key', ['InventoryLedgerEntry', '(projectid, inspectiondispositionid)']],
    ['InventoryLedgerEntry_reversal_key', ['InventoryLedgerEntry', '(organizationid, projectid, reversesentryid)']],
    ['InventoryBalance_pkey', ['InventoryBalance', '(organizationid, projectid, inventoryitemid, locationid)']],
  ]);
  const result = await client.query(
    `SELECT indexname, tablename, indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = ANY($1::text[])`,
    [[...expected.keys()]],
  );
  const actual = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, [table, columns]] of expected) {
    const index = actual.get(name);
    const definition = normalizeDefinition(index?.indexdef);
    invariant(index?.tablename === table, `Inventory index ${name} is missing or attached to the wrong table.`);
    invariant(definition.startsWith('create unique index '), `Inventory index ${name} must remain unique.`);
    invariant(definition.includes(columns), `Inventory index ${name} column order drifted.`);
    invariant(!definition.includes(' where '), `Inventory index ${name} must not become partial.`);
  }
}

async function assertConstraints(client) {
  const expected = new Map([
    ['InventoryItem_code_check', ['c', 'InventoryItem', null]],
    ['InventoryItem_base_unit_check', ['c', 'InventoryItem', null]],
    ['POLInventoryBinding_purchase_line_fkey', ['f', 'PurchaseOrderLineInventoryBinding', 'PurchaseOrderLine']],
    ['POLInventoryBinding_item_fkey', ['f', 'PurchaseOrderLineInventoryBinding', 'InventoryItem']],
    ['InventoryTransaction_source_shape_check', ['c', 'InventoryTransaction', null]],
    ['InventoryTransaction_source_inspection_fkey', ['f', 'InventoryTransaction', 'GoodsReceiptInspection']],
    ['InventoryTransaction_reverses_fkey', ['f', 'InventoryTransaction', 'InventoryTransaction']],
    ['InventoryLedgerEntry_quantity_check', ['c', 'InventoryLedgerEntry', null]],
    ['InventoryLedgerEntry_source_shape_check', ['c', 'InventoryLedgerEntry', null]],
    ['InventoryLedgerEntry_transaction_fkey', ['f', 'InventoryLedgerEntry', 'InventoryTransaction']],
    ['InventoryLedgerEntry_disposition_fkey', ['f', 'InventoryLedgerEntry', 'GoodsReceiptInspectionDisposition']],
    ['InventoryLedgerEntry_reverses_fkey', ['f', 'InventoryLedgerEntry', 'InventoryLedgerEntry']],
    ['InventoryBalance_on_hand_check', ['c', 'InventoryBalance', null]],
    ['InventoryBalance_item_fkey', ['f', 'InventoryBalance', 'InventoryItem']],
    ['InventoryBalance_location_fkey', ['f', 'InventoryBalance', 'InventoryLocation']],
  ]);
  const result = await client.query(
    `SELECT constraint_record.conname AS name,
            constraint_record.contype AS type,
            constraint_record.convalidated AS validated,
            table_record.relname AS table_name,
            referenced_table.relname AS referenced_table,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = constraint_record.connamespace
       JOIN pg_class AS table_record ON table_record.oid = constraint_record.conrelid
       LEFT JOIN pg_class AS referenced_table ON referenced_table.oid = constraint_record.confrelid
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [[...expected.keys()]],
  );
  const actual = new Map(result.rows.map((row) => [row.name, row]));
  for (const [name, [type, table, referencedTable]] of expected) {
    const constraint = actual.get(name);
    invariant(constraint?.validated === true, `Required inventory constraint ${name} is missing or unvalidated.`);
    invariant(constraint.type === type && constraint.table_name === table, `Inventory constraint ${name} type/table drifted.`);
    invariant(constraint.referenced_table === referencedTable, `Inventory constraint ${name} references the wrong table.`);
  }
  const purchaseLineUnitFk = normalizeDefinition(actual.get('POLInventoryBinding_purchase_line_fkey')?.definition);
  invariant(
    purchaseLineUnitFk.includes('foreign key (projectid, purchaseorderid, purchaseorderlineid, unitsnapshot)')
      && purchaseLineUnitFk.includes('references purchaseorderline(projectid, purchaseorderid, id, unit)')
      && purchaseLineUnitFk.includes('on update restrict')
      && purchaseLineUnitFk.includes('on delete restrict'),
    'Purchase line binding no longer pins the exact purchase unit.',
  );
  const itemUnitFk = normalizeDefinition(actual.get('POLInventoryBinding_item_fkey')?.definition);
  invariant(
    itemUnitFk.includes('foreign key (organizationid, projectid, inventoryitemid, unitsnapshot)')
      && itemUnitFk.includes('references inventoryitem(organizationid, projectid, id, baseunit)')
      && itemUnitFk.includes('on update restrict')
      && itemUnitFk.includes('on delete restrict'),
    'Purchase line binding no longer pins the exact inventory base unit.',
  );
  invariant(
    normalizeDefinition(actual.get('InventoryLedgerEntry_quantity_check')?.definition).includes("quantitydelta <> 'nan'::numeric"),
    'Inventory ledger quantity does not reject NUMERIC NaN.',
  );
  invariant(
    normalizeDefinition(actual.get('InventoryBalance_on_hand_check')?.definition).includes('onhand >= 0'),
    'Inventory balance no longer rejects negative stock.',
  );
}

async function assertTriggers(client) {
  const expected = new Map([
    ['InventoryItem_mutation_guard', { deferred: false, type: 27, table: 'InventoryItem', fn: 'obrasaas_inventory_item_mutation_guard' }],
    ['InventoryItem_active_guard', { deferred: false, type: 23, table: 'InventoryItem', fn: 'obrasaas_inventory_item_active_guard' }],
    ['InventoryItem_no_truncate', { deferred: false, type: 34, table: 'InventoryItem', fn: 'obrasaas_inventory_no_truncate' }],
    ['PurchaseOrderLine_inventory_unit_guard', { deferred: false, type: 19, table: 'PurchaseOrderLine', fn: 'obrasaas_purchase_order_line_inventory_unit_guard' }],
    ['PurchaseOrderLineInventoryBinding_insert_guard', { deferred: false, type: 7, table: 'PurchaseOrderLineInventoryBinding', fn: 'obrasaas_inventory_binding_insert_guard' }],
    ['PurchaseOrderLineInventoryBinding_append_only', { deferred: false, type: 27, table: 'PurchaseOrderLineInventoryBinding', fn: 'obrasaas_inventory_append_only' }],
    ['PurchaseOrderLineInventoryBinding_no_truncate', { deferred: false, type: 34, table: 'PurchaseOrderLineInventoryBinding', fn: 'obrasaas_inventory_no_truncate' }],
    ['InventoryTransaction_insert_guard', { deferred: false, type: 7, table: 'InventoryTransaction', fn: 'obrasaas_inventory_transaction_insert_guard' }],
    ['InventoryTransaction_append_only', { deferred: false, type: 27, table: 'InventoryTransaction', fn: 'obrasaas_inventory_append_only' }],
    ['InventoryTransaction_no_truncate', { deferred: false, type: 34, table: 'InventoryTransaction', fn: 'obrasaas_inventory_no_truncate' }],
    ['InventoryTransaction_snapshot_guard', { deferred: true, type: 5, table: 'InventoryTransaction', fn: 'obrasaas_inventory_transaction_snapshot_guard' }],
    ['InventoryLedgerEntry_00_finite_guard', { deferred: false, type: 23, table: 'InventoryLedgerEntry', fn: 'obrasaas_numeric_quantity_finite_guard' }],
    ['InventoryLedgerEntry_insert_guard', { deferred: false, type: 7, table: 'InventoryLedgerEntry', fn: 'obrasaas_inventory_ledger_entry_insert_guard' }],
    ['InventoryLedgerEntry_append_only', { deferred: false, type: 27, table: 'InventoryLedgerEntry', fn: 'obrasaas_inventory_append_only' }],
    ['InventoryLedgerEntry_no_truncate', { deferred: false, type: 34, table: 'InventoryLedgerEntry', fn: 'obrasaas_inventory_no_truncate' }],
    ['InventoryLedgerEntry_balance_project', { deferred: false, type: 5, table: 'InventoryLedgerEntry', fn: 'obrasaas_inventory_balance_project' }],
    ['InventoryLedgerEntry_snapshot_guard', { deferred: true, type: 5, table: 'InventoryLedgerEntry', fn: 'obrasaas_inventory_transaction_snapshot_guard' }],
    ['InventoryBalance_projection_guard', { deferred: false, type: 31, table: 'InventoryBalance', fn: 'obrasaas_inventory_balance_projection_guard' }],
    ['InventoryBalance_no_truncate', { deferred: false, type: 34, table: 'InventoryBalance', fn: 'obrasaas_inventory_no_truncate' }],
    ['GoodsReceiptInspection_inventory_putaway_guard', { deferred: false, type: 7, table: 'GoodsReceiptInspection', fn: 'obrasaas_inventory_inspection_active_putaway_guard' }],
  ]);
  const result = await client.query(
    `SELECT trigger_record.tgname AS name, trigger_record.tgenabled AS enabled,
            trigger_record.tgtype::integer AS type,
            trigger_record.tgdeferrable AS deferrable,
            trigger_record.tginitdeferred AS initially_deferred,
            table_record.relname AS table_name,
            function_record.proname AS function_name
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS table_record ON table_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = table_record.relnamespace
       JOIN pg_proc AS function_record ON function_record.oid = trigger_record.tgfoid
      WHERE namespace_record.nspname = current_schema()
        AND NOT trigger_record.tgisinternal
        AND trigger_record.tgname = ANY($1::text[])`,
    [[...expected.keys()]],
  );
  const actual = new Map(result.rows.map((row) => [row.name, row]));
  for (const [name, contract] of expected) {
    const trigger = actual.get(name);
    invariant(trigger?.enabled === 'A', `Inventory trigger ${name} is missing or not ENABLE ALWAYS.`);
    invariant(trigger.type === contract.type, `Inventory trigger ${name} event/timing/row scope drifted.`);
    invariant(trigger.table_name === contract.table, `Inventory trigger ${name} is attached to the wrong table.`);
    invariant(trigger.function_name === contract.fn, `Inventory trigger ${name} invokes the wrong function.`);
    invariant(trigger.deferrable === contract.deferred, `Inventory trigger ${name} deferrability drifted.`);
    invariant(trigger.initially_deferred === contract.deferred, `Inventory trigger ${name} initial timing drifted.`);
  }
}

async function assertTriggerFunctions(client) {
  const expected = [
    'obrasaas_inventory_item_mutation_guard',
    'obrasaas_inventory_item_active_guard',
    'obrasaas_purchase_order_line_inventory_unit_guard',
    'obrasaas_numeric_quantity_finite_guard',
    'obrasaas_inventory_append_only',
    'obrasaas_inventory_no_truncate',
    'obrasaas_inventory_binding_insert_guard',
    'obrasaas_inventory_transaction_insert_guard',
    'obrasaas_inventory_ledger_entry_insert_guard',
    'obrasaas_inventory_balance_project',
    'obrasaas_inventory_balance_projection_guard',
    'obrasaas_inventory_transaction_snapshot_guard',
    'obrasaas_inventory_inspection_active_putaway_guard',
  ];
  const result = await client.query(
    `SELECT function_record.proname AS name, function_record.prosecdef AS security_definer,
            function_record.provolatile AS volatility, function_record.proconfig AS config,
            pg_get_functiondef(function_record.oid) AS definition
       FROM pg_proc AS function_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = function_record.pronamespace
      WHERE namespace_record.nspname = current_schema()
        AND function_record.proname = ANY($1::text[])`,
    [expected],
  );
  const actual = new Map(result.rows.map((row) => [row.name, row]));
  for (const name of expected) {
    const fn = actual.get(name);
    invariant(fn, `Inventory trigger function ${name} is missing.`);
    invariant(fn.security_definer === false, `${name} must not be SECURITY DEFINER.`);
    invariant(fn.volatility === 'v', `${name} must remain VOLATILE.`);
    invariant((fn.config || []).includes('search_path=pg_catalog'), `${name} must pin search_path to pg_catalog.`);
  }
  const entryGuard = normalizeDefinition(actual.get('obrasaas_inventory_ledger_entry_insert_guard')?.definition);
  invariant(entryGuard.includes('pg_advisory_xact_lock'), 'Ledger entry guard lost its advisory lock.');
  invariant(entryGuard.includes('accepted'), 'Ledger entry guard lost ACCEPTED-only enforcement.');
  const itemGuard = normalizeDefinition(actual.get('obrasaas_inventory_item_active_guard')?.definition);
  invariant(itemGuard.includes('pg_advisory_xact_lock'), 'Active inventory item limit lost its advisory lock.');
  invariant(itemGuard.includes('active_item_count >= 500'), 'Active inventory item limit drifted from 500.');
  const itemMutationGuard = normalizeDefinition(actual.get('obrasaas_inventory_item_mutation_guard')?.definition);
  const bindingGuard = normalizeDefinition(actual.get('obrasaas_inventory_binding_insert_guard')?.definition);
  const purchaseLineGuard = normalizeDefinition(actual.get('obrasaas_purchase_order_line_inventory_unit_guard')?.definition);
  invariant(itemMutationGuard.includes("'inventory-item:'"), 'Inventory item mutation lost its binding race lock.');
  invariant(bindingGuard.includes("'inventory-binding:'") && bindingGuard.includes("'inventory-item:'"), 'Inventory binding lost its ordered line/item race locks.');
  invariant(bindingGuard.indexOf("'inventory-binding:'") < bindingGuard.indexOf("'inventory-item:'"), 'Inventory binding line/item lock order drifted.');
  invariant(purchaseLineGuard.includes("'inventory-binding:'"), 'Purchase order line unit mutation lost its binding race lock.');
  const balanceGuard = normalizeDefinition(actual.get('obrasaas_inventory_balance_projection_guard')?.definition);
  invariant(balanceGuard.includes('pg_trigger_depth() <> 2'), 'InventoryBalance lost structural DB-owned provenance enforcement.');
  const balanceProject = normalizeDefinition(actual.get('obrasaas_inventory_balance_project')?.definition);
  invariant(
    balanceProject.includes('sum(entry.quantitydelta)')
      && balanceProject.includes('count(*)::integer')
      && balanceProject.includes('set onhand = $5')
      && balanceProject.includes('revision = $6'),
    'InventoryBalance projection no longer recomputes the statement-visible exact ledger aggregate.',
  );
  const snapshotGuard = normalizeDefinition(actual.get('obrasaas_inventory_transaction_snapshot_guard')?.definition);
  invariant(snapshotGuard.includes('every accepted disposition exactly once'), 'Putaway set completeness guard drifted.');
  invariant(snapshotGuard.includes("receipt.status = ''posted''"), 'Putaway no longer requires a POSTED goods receipt.');
}

async function expectSqlFailure(client, callback, { code, message }, label) {
  await client.query('SAVEPOINT inventory_stock_ledger_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  let failure = null;
  try {
    await callback();
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT inventory_stock_ledger_verifier_case');
  await client.query('RELEASE SAVEPOINT inventory_stock_ledger_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with SQLSTATE ${failure.code || 'unknown'}.`);
  invariant(String(failure.message || '').includes(message), `${label} failed for an unexpected reason.`);
}

async function flushDeferredConstraints(client) {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

async function createFixture(client) {
  const suffix = randomUUID();
  const fixture = {
    organizationId: `inventory_verify_org_${suffix}`,
    projectId: `inventory_verify_project_${suffix}`,
    actorId: `inventory_verify_actor_${suffix}`,
    supplierId: `inventory_verify_supplier_${suffix}`,
    purchaseOrderId: `inventory_verify_order_${suffix}`,
    purchaseOrderLineId: `inventory_verify_order_line_${suffix}`,
    secondPurchaseOrderLineId: `inventory_verify_order_line_2_${suffix}`,
    goodsReceiptId: `inventory_verify_receipt_${suffix}`,
    goodsReceiptLineId: `inventory_verify_receipt_line_${suffix}`,
    secondGoodsReceiptLineId: `inventory_verify_receipt_line_2_${suffix}`,
    locationId: `inventory_verify_location_${suffix}`,
    inspectionId: `inventory_verify_inspection_${suffix}`,
    dispositionId: `inventory_verify_disposition_${suffix}`,
    secondDispositionId: `inventory_verify_disposition_2_${suffix}`,
    inventoryItemId: `inventory_verify_item_${suffix}`,
    bindingId: `inventory_verify_binding_${suffix}`,
    secondBindingId: `inventory_verify_binding_2_${suffix}`,
  };
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Inventory verifier', $2, CURRENT_TIMESTAMP)`,
    [fixture.organizationId, `inventory-verifier-${suffix}`],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
     VALUES ($1, $2, 'Inventory project', $3, CURRENT_TIMESTAMP)`,
    [fixture.projectId, fixture.organizationId, `inventory-project-${suffix}`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" ("id", "clerkUserId", "primaryEmail", "lastSeenAt", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [fixture.actorId, `clerk-${suffix}`, `inventory-${suffix}@example.test`],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "updatedAt"
     ) VALUES ($1, $2, $3, 'org:admin', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)`,
    [`inventory_membership_${suffix}`, fixture.organizationId, fixture.actorId],
  );
  await client.query(
    `INSERT INTO "Supplier" ("id", "organizationId", "legalName", "updatedAt")
     VALUES ($1, $2, 'Inventory supplier', CURRENT_TIMESTAMP)`,
    [fixture.supplierId, fixture.organizationId],
  );
  await client.query(
    `INSERT INTO "PurchaseOrder" (
       "id", "organizationId", "projectId", "supplierId", "operationKey",
       "number", "currency", "status", "total", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, 'ARS', 'APPROVED', 8.00, CURRENT_TIMESTAMP)`,
    [
      fixture.purchaseOrderId, fixture.organizationId, fixture.projectId,
      fixture.supplierId, `inventory-order-${suffix}`, `INV-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "PurchaseOrderLine" (
       "id", "purchaseOrderId", "projectId", "description", "unit", "quantity", "unitPrice"
     ) VALUES
       ($1, $2, $3, 'Cemento gris', 'bolsas', 5.000, 1.00),
       ($4, $2, $3, 'Cemento blanco', 'bolsas', 3.000, 1.00)`,
    [
      fixture.purchaseOrderLineId, fixture.purchaseOrderId, fixture.projectId,
      fixture.secondPurchaseOrderLineId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceipt" (
       "id", "organizationId", "projectId", "purchaseOrderId", "operationKey",
       "status", "receivedById", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'POSTED', $6, CURRENT_TIMESTAMP)`,
    [
      fixture.goodsReceiptId, fixture.organizationId, fixture.projectId,
      fixture.purchaseOrderId, `inventory-receipt-${suffix}`, fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptLine" (
       "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
     ) VALUES
       ($1, $2, $3, $4, $5, 5.000),
       ($6, $2, $3, $4, $7, 3.000)`,
    [
      fixture.goodsReceiptLineId, fixture.projectId, fixture.purchaseOrderId,
      fixture.goodsReceiptId, fixture.purchaseOrderLineId,
      fixture.secondGoodsReceiptLineId, fixture.secondPurchaseOrderLineId,
    ],
  );
  await client.query(
    `INSERT INTO "InventoryLocation" (
       "id", "organizationId", "projectId", "code", "name", "updatedAt"
     ) VALUES ($1, $2, $3, 'OBRA', 'Acopio de obra', CURRENT_TIMESTAMP)`,
    [fixture.locationId, fixture.organizationId, fixture.projectId],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptInspection" (
       "id", "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId",
       "kind", "version", "operationKey", "requestFingerprint", "inspectedById",
       "locationId", "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES ($1, $2, $3, $4, $5, 'FINALIZATION', 1, $6, $7, $8, $9, 'OBRA', 'Acopio de obra')`,
    [
      fixture.inspectionId, fixture.organizationId, fixture.projectId,
      fixture.purchaseOrderId, fixture.goodsReceiptId,
      `inventory-inspection-${suffix}`, 'a'.repeat(64), fixture.actorId, fixture.locationId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptInspectionDisposition" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "goodsReceiptId", "goodsReceiptLineId", "inspectionId", "quality", "quantity"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, 'ACCEPTED', 5.000),
       ($9, $2, $3, $4, $10, $6, $11, $8, 'ACCEPTED', 3.000)`,
    [
      fixture.dispositionId, fixture.organizationId, fixture.projectId,
      fixture.purchaseOrderId, fixture.purchaseOrderLineId, fixture.goodsReceiptId,
      fixture.goodsReceiptLineId, fixture.inspectionId,
      fixture.secondDispositionId, fixture.secondPurchaseOrderLineId,
      fixture.secondGoodsReceiptLineId,
    ],
  );
  await flushDeferredConstraints(client);
  await client.query(
    `INSERT INTO "InventoryItem" (
       "id", "organizationId", "projectId", "code", "name", "baseUnit", "updatedAt"
     ) VALUES ($1, $2, $3, 'CEMENTO', 'Cemento', 'bolsas', CURRENT_TIMESTAMP)`,
    [fixture.inventoryItemId, fixture.organizationId, fixture.projectId],
  );
  await client.query(
    `INSERT INTO "PurchaseOrderLineInventoryBinding" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "inventoryItemId", "unitSnapshot", "operationKey", "requestFingerprint", "boundById"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, 'bolsas', $7, $8, $9),
       ($10, $2, $3, $4, $11, $6, 'bolsas', $12, $8, $9)`,
    [
      fixture.bindingId, fixture.organizationId, fixture.projectId,
      fixture.purchaseOrderId, fixture.purchaseOrderLineId, fixture.inventoryItemId,
      `inventory-binding-${suffix}`, 'b'.repeat(64), fixture.actorId,
      fixture.secondBindingId, fixture.secondPurchaseOrderLineId,
      `inventory-binding-2-${suffix}`,
    ],
  );
  return fixture;
}

async function insertTransaction(client, fixture, overrides = {}) {
  const values = {
    id: `inventory_transaction_${randomUUID()}`,
    kind: 'RECEIPT_PUTAWAY',
    purchaseOrderId: fixture.purchaseOrderId,
    goodsReceiptId: fixture.goodsReceiptId,
    sourceInspectionId: fixture.inspectionId,
    reversesTransactionId: null,
    operationKey: `inventory-transaction-${randomUUID()}`,
    requestFingerprint: 'c'.repeat(64),
    reason: null,
    ...overrides,
  };
  await client.query(
    `INSERT INTO "InventoryTransaction" (
       "id", "organizationId", "projectId", "kind", "purchaseOrderId",
       "goodsReceiptId", "sourceInspectionId", "reversesTransactionId",
       "operationKey", "requestFingerprint", "actorId", "reason"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      values.id, fixture.organizationId, fixture.projectId, values.kind,
      values.purchaseOrderId, values.goodsReceiptId, values.sourceInspectionId,
      values.reversesTransactionId, values.operationKey, values.requestFingerprint,
      fixture.actorId, values.reason,
    ],
  );
  return values;
}

async function insertEntry(client, fixture, transactionId, overrides = {}) {
  const values = {
    id: `inventory_entry_${randomUUID()}`,
    purchaseLineBindingId: fixture.bindingId,
    inspectionDispositionId: fixture.dispositionId,
    reversesEntryId: null,
    quantityDelta: '5.000',
    ...overrides,
  };
  await client.query(
    `INSERT INTO "InventoryLedgerEntry" (
       "id", "organizationId", "projectId", "transactionId", "inventoryItemId",
       "locationId", "purchaseLineBindingId", "inspectionDispositionId", "reversesEntryId",
       "quantityDelta", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot",
       "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::numeric,
       'CEMENTO', 'Cemento', 'bolsas', 'OBRA', 'Acopio de obra')`,
    [
      values.id, fixture.organizationId, fixture.projectId, transactionId,
      fixture.inventoryItemId, fixture.locationId, values.purchaseLineBindingId,
      values.inspectionDispositionId, values.reversesEntryId, values.quantityDelta,
    ],
  );
  return values;
}

async function insertPutawayEntriesTogether(client, fixture, transactionId) {
  const entries = [
    { id: `inventory_entry_${randomUUID()}`, bindingId: fixture.bindingId, dispositionId: fixture.dispositionId, quantity: '5.000' },
    { id: `inventory_entry_${randomUUID()}`, bindingId: fixture.secondBindingId, dispositionId: fixture.secondDispositionId, quantity: '3.000' },
  ];
  await client.query(
    `INSERT INTO "InventoryLedgerEntry" (
       "id", "organizationId", "projectId", "transactionId", "inventoryItemId",
       "locationId", "purchaseLineBindingId", "inspectionDispositionId", "reversesEntryId",
       "quantityDelta", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot",
       "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9::numeric,
        'CEMENTO', 'Cemento', 'bolsas', 'OBRA', 'Acopio de obra'),
       ($10, $2, $3, $4, $5, $6, $11, $12, NULL, $13::numeric,
        'CEMENTO', 'Cemento', 'bolsas', 'OBRA', 'Acopio de obra')`,
    [
      entries[0].id, fixture.organizationId, fixture.projectId, transactionId,
      fixture.inventoryItemId, fixture.locationId, entries[0].bindingId,
      entries[0].dispositionId, entries[0].quantity, entries[1].id,
      entries[1].bindingId, entries[1].dispositionId, entries[1].quantity,
    ],
  );
  return entries;
}

async function insertReversalEntriesTogether(client, fixture, transactionId, originals) {
  const entries = [
    { id: `inventory_entry_${randomUUID()}`, originalId: originals[0].id, quantity: '-5.000' },
    { id: `inventory_entry_${randomUUID()}`, originalId: originals[1].id, quantity: '-3.000' },
  ];
  await client.query(
    `INSERT INTO "InventoryLedgerEntry" (
       "id", "organizationId", "projectId", "transactionId", "inventoryItemId",
       "locationId", "purchaseLineBindingId", "inspectionDispositionId", "reversesEntryId",
       "quantityDelta", "itemCodeSnapshot", "itemNameSnapshot", "unitSnapshot",
       "locationCodeSnapshot", "locationNameSnapshot"
     ) VALUES
       ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, $8::numeric,
        'CEMENTO', 'Cemento', 'bolsas', 'OBRA', 'Acopio de obra'),
       ($9, $2, $3, $4, $5, $6, NULL, NULL, $10, $11::numeric,
        'CEMENTO', 'Cemento', 'bolsas', 'OBRA', 'Acopio de obra')`,
    [
      entries[0].id, fixture.organizationId, fixture.projectId, transactionId,
      fixture.inventoryItemId, fixture.locationId, entries[0].originalId,
      entries[0].quantity, entries[1].id, entries[1].originalId, entries[1].quantity,
    ],
  );
  return entries;
}

async function assertRollbackOnlySmoke(client) {
  const fixture = await createFixture(client);
  const before = await client.query(
    `SELECT (SELECT count(*) FROM "InventoryLedgerEntry") AS entries,
            (SELECT count(*) FROM "InventoryBalance") AS balances`,
  );
  invariant(before.rows[0]?.entries === '0' && before.rows[0]?.balances === '0', 'Migration inferred historical stock.');

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "InventoryItem" SET "baseUnit" = 'kg', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [fixture.inventoryItemId],
    ),
    { code: '55000', message: 'base unit is immutable' },
    'bound item unit mutation',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "PurchaseOrderLine" SET "unit" = 'kg' WHERE "projectId" = $1 AND "id" = $2`,
      [fixture.projectId, fixture.purchaseOrderLineId],
    ),
    { code: '55000', message: 'unit is immutable after inventory binding' },
    'bound purchase line unit mutation',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "InventoryItem" (
         "id", "organizationId", "projectId", "code", "name", "baseUnit", "updatedAt"
       )
       SELECT 'inventory_limit_' || series.value::text || '_' || $1,
              $2, $3,
              'VERIFY-' || lpad(series.value::text, 3, '0'),
              'Inventory limit fixture ' || series.value::text,
              'bolsas', CURRENT_TIMESTAMP
         FROM generate_series(1, 500) AS series(value)`,
      [randomUUID(), fixture.organizationId, fixture.projectId],
    ),
    { code: '54000', message: 'active limit of 500' },
    'project active inventory item limit',
  );

  await expectSqlFailure(
    client,
    async () => {
      const partialPutaway = await insertTransaction(client, fixture);
      await insertEntry(client, fixture, partialPutaway.id);
    },
    { code: '23514', message: 'every ACCEPTED disposition exactly once' },
    'partial accepted-disposition putaway',
  );

  const putaway = await insertTransaction(client, fixture);
  const putawayEntries = await insertPutawayEntriesTogether(client, fixture, putaway.id);
  await flushDeferredConstraints(client);
  const posted = await client.query(
    `SELECT "onHand", "revision" FROM "InventoryBalance"
      WHERE "organizationId" = $1 AND "projectId" = $2
        AND "inventoryItemId" = $3 AND "locationId" = $4`,
    [fixture.organizationId, fixture.projectId, fixture.inventoryItemId, fixture.locationId],
  );
  invariant(
    posted.rows[0]?.onHand === '8.000' && posted.rows[0]?.revision === 2,
    'Multi-row putaway balance projection is not exact.',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "InventoryBalance" SET "onHand" = "onHand", "revision" = "revision"
        WHERE "organizationId" = $1 AND "projectId" = $2
          AND "inventoryItemId" = $3 AND "locationId" = $4`,
      [fixture.organizationId, fixture.projectId, fixture.inventoryItemId, fixture.locationId],
    ),
    { code: '55000', message: 'database-owned and rejects direct writes' },
    'direct exact/no-op balance mutation',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "GoodsReceiptInspection" (
         "id", "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId",
         "kind", "version", "predecessorId", "operationKey", "requestFingerprint",
         "inspectedById", "locationId", "locationCodeSnapshot", "locationNameSnapshot", "reason"
       ) VALUES ($1, $2, $3, $4, $5, 'CORRECTION', 2, $6, $7, $8, $9, $10,
         'OBRA', 'Acopio de obra', 'Intento con stock activo')`,
      [
        `inventory_correction_${randomUUID()}`, fixture.organizationId, fixture.projectId,
        fixture.purchaseOrderId, fixture.goodsReceiptId, fixture.inspectionId,
        `inventory-correction-${randomUUID()}`, 'd'.repeat(64), fixture.actorId, fixture.locationId,
      ],
    ),
    { code: '55000', message: 'putaway must be reversed' },
    'inspection correction with active putaway',
  );

  await expectSqlFailure(
    client,
    () => insertEntry(client, fixture, putaway.id, {
      id: `inventory_nan_${randomUUID()}`,
      inspectionDispositionId: `missing_${randomUUID()}`,
      quantityDelta: 'NaN',
    }),
    { code: '23514', message: 'must be finite' },
    'NaN ledger quantity',
  );

  await expectSqlFailure(
    client,
    async () => {
      const partialReversal = await insertTransaction(client, fixture, {
        kind: 'REVERSAL',
        purchaseOrderId: null,
        goodsReceiptId: null,
        sourceInspectionId: null,
        reversesTransactionId: putaway.id,
        reason: 'Controlled invalid partial reversal.',
      });
      await insertEntry(client, fixture, partialReversal.id, {
        purchaseLineBindingId: null,
        inspectionDispositionId: null,
        reversesEntryId: putawayEntries[0].id,
        quantityDelta: '-5.000',
      });
    },
    { code: '23514', message: 'exactly reverse every original ledger entry' },
    'partial multi-entry reversal',
  );

  const reversal = await insertTransaction(client, fixture, {
    kind: 'REVERSAL',
    purchaseOrderId: null,
    goodsReceiptId: null,
    sourceInspectionId: null,
    reversesTransactionId: putaway.id,
    reason: 'CorrecciÃ³n controlada de la puesta en stock.',
  });
  await insertReversalEntriesTogether(client, fixture, reversal.id, putawayEntries);
  await flushDeferredConstraints(client);
  const reversed = await client.query(
    `SELECT "onHand", "revision" FROM "InventoryBalance"
      WHERE "organizationId" = $1 AND "projectId" = $2
        AND "inventoryItemId" = $3 AND "locationId" = $4`,
    [fixture.organizationId, fixture.projectId, fixture.inventoryItemId, fixture.locationId],
  );
  invariant(
    reversed.rows[0]?.onHand === '0.000' && reversed.rows[0]?.revision === 4,
    'Multi-row inventory reversal did not restore exact zero.',
  );

  await expectSqlFailure(
    client,
    () => client.query(`UPDATE "InventoryTransaction" SET "reason" = 'mutated' WHERE "id" = $1`, [putaway.id]),
    { code: '55000', message: 'append-only' },
    'inventory transaction mutation',
  );
  await expectSqlFailure(
    client,
    () => insertTransaction(client, fixture, {
      kind: 'REVERSAL',
      purchaseOrderId: null,
      goodsReceiptId: null,
      sourceInspectionId: null,
      reversesTransactionId: putaway.id,
      reason: 'Segunda reversiÃ³n invÃ¡lida.',
    }),
    { code: '23505', message: 'InventoryTransaction_reversal_key' },
    'duplicate inventory reversal',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-inventory-stock-ledger-migration-verifier',
  statement_timeout: 35_000,
  query_timeout: 40_000,
});

let connected = false;
let transactionOpen = false;
try {
  try {
    await client.connect();
    connected = true;
  } catch {
    throw new Error('Unable to connect to the dedicated inventory stock ledger verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(activeSchema.rows[0]?.name === databaseSchema, 'PostgreSQL did not activate the configured inventory schema.');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '35s'");
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  await assertMigration(client);
  await assertEnum(client);
  await assertColumns(client);
  await assertIndexes(client);
  await assertConstraints(client);
  await assertTriggers(client);
  await assertTriggerFunctions(client);
  await assertRollbackOnlySmoke(client);
  await client.query('ROLLBACK');
  transactionOpen = false;
  console.log(
    `Verified ${MIGRATION}: exact accepted putaway, one-shot reversal, immutable ledger, non-negative DB-owned balances and no inferred backfill.`,
  );
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  if (connected) await client.end();
}
