import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'GOODS_RECEIPT_INSPECTION_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'GOODS_RECEIPT_INSPECTION_MIGRATION_SCHEMA';
const MIGRATION = '20260802160000_goods_receipt_inspection_exceptions';
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
    throw new Error('The goods receipt inspection migration schema must be a safe PostgreSQL identifier.');
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
  return String(value || '')
    .replaceAll('"', '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
    `SELECT "checksum"
       FROM "_prisma_migrations"
      WHERE "migration_name" = $1
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL`,
    [MIGRATION],
  );
  invariant(result.rowCount === 1, 'Goods receipt inspection migration is not applied exactly once.');
  invariant(
    result.rows[0]?.checksum === expectedMigrationChecksum,
    'Applied goods receipt inspection migration does not match the repository checksum.',
  );
}

async function assertEnums(client) {
  const expected = new Map([
    ['GoodsReceiptInspectionKind', ['FINALIZATION', 'CORRECTION', 'REVERSAL']],
    ['GoodsReceiptDispositionQuality', ['ACCEPTED', 'DAMAGED', 'REJECTED', 'QUARANTINED']],
    ['SupplierCommitmentLineClosureKind', ['FINAL_DELIVERY', 'REVERSAL']],
  ]);
  const result = await client.query(
    `SELECT type_record.typname AS type_name, enum_record.enumlabel AS value
       FROM pg_type AS type_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = type_record.typnamespace
       JOIN pg_enum AS enum_record ON enum_record.enumtypid = type_record.oid
      WHERE namespace_record.nspname = current_schema()
        AND type_record.typname = ANY($1::text[])
      ORDER BY type_record.typname, enum_record.enumsortorder`,
    [[...expected.keys()]],
  );
  const actual = new Map();
  for (const row of result.rows) {
    actual.set(row.type_name, [...(actual.get(row.type_name) || []), row.value]);
  }
  for (const [name, values] of expected) {
    invariant(JSON.stringify(actual.get(name)) === JSON.stringify(values), `${name} enum drifted.`);
  }
}

async function columnsFor(client, table) {
  const result = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable,
            numeric_precision, numeric_scale, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [table],
  );
  return new Map(result.rows.map((row) => [row.column_name, row]));
}

async function assertColumns(client) {
  const receipt = await columnsFor(client, 'GoodsReceipt');
  invariant(receipt.get('receivedById')?.is_nullable === 'YES', 'Legacy GoodsReceipt.receivedById must remain nullable.');

  const location = await columnsFor(client, 'InventoryLocation');
  for (const name of ['id', 'organizationId', 'projectId', 'code', 'name', 'active', 'revision', 'createdAt', 'updatedAt']) {
    invariant(location.get(name)?.is_nullable === 'NO', `InventoryLocation.${name} is missing or nullable.`);
  }
  invariant(
    Number(location.get('code')?.character_maximum_length) === 32,
    'InventoryLocation.code must remain VARCHAR(32).',
  );
  invariant(
    Number(location.get('name')?.character_maximum_length) === 160,
    'InventoryLocation.name must remain VARCHAR(160).',
  );

  const inspection = await columnsFor(client, 'GoodsReceiptInspection');
  for (const name of [
    'id', 'organizationId', 'projectId', 'purchaseOrderId', 'goodsReceiptId',
    'kind', 'version', 'operationKey', 'requestFingerprint', 'inspectedById',
    'locationId', 'locationCodeSnapshot', 'locationNameSnapshot', 'inspectedAt',
    'createdAt',
  ]) {
    invariant(inspection.get(name)?.is_nullable === 'NO', `GoodsReceiptInspection.${name} is missing or nullable.`);
  }
  invariant(inspection.get('predecessorId')?.is_nullable === 'YES', 'Inspection predecessor must be nullable for version 1.');
  invariant(inspection.get('reason')?.is_nullable === 'YES', 'Inspection reason must be nullable for clean first finalization.');

  const disposition = await columnsFor(client, 'GoodsReceiptInspectionDisposition');
  for (const name of [
    'id', 'organizationId', 'projectId', 'purchaseOrderId', 'purchaseOrderLineId',
    'goodsReceiptId', 'goodsReceiptLineId', 'inspectionId', 'quality', 'quantity', 'createdAt',
  ]) {
    invariant(disposition.get(name)?.is_nullable === 'NO', `Inspection disposition ${name} is missing or nullable.`);
  }
  invariant(disposition.get('allocationId')?.is_nullable === 'YES', 'Unallocated receipt disposition bucket is missing.');
  invariant(
    disposition.get('quantity')?.data_type === 'numeric'
      && Number(disposition.get('quantity')?.numeric_precision) === 14
      && Number(disposition.get('quantity')?.numeric_scale) === 3,
    'Inspection disposition quantity must remain DECIMAL(14,3).',
  );

  const closure = await columnsFor(client, 'SupplierCommitmentLineClosure');
  for (const name of [
    'id', 'organizationId', 'projectId', 'purchaseOrderId', 'purchaseOrderLineId',
    'supplierCommitmentId', 'kind', 'version', 'operationKey', 'requestFingerprint',
    'closedById', 'createdAt',
  ]) {
    invariant(closure.get(name)?.is_nullable === 'NO', `SupplierCommitmentLineClosure.${name} is missing or nullable.`);
  }
  for (const name of ['acceptedQuantity', 'shortageQuantity']) {
    const column = closure.get(name);
    invariant(
      column?.is_nullable === 'YES'
        && column.data_type === 'numeric'
        && Number(column.numeric_precision) === 14
        && Number(column.numeric_scale) === 3,
      `${name} must be nullable DECIMAL(14,3) for REVERSAL rows.`,
    );
  }
}

async function assertIndexes(client) {
  const names = [
    'GoodsReceipt_receivedById_receivedAt_idx',
    'InventoryLocation_scope_id_key',
    'InventoryLocation_project_code_key',
    'GRCAllocation_inspection_scope_key',
    'GoodsReceiptInspection_scope_id_key',
    'GoodsReceiptInspection_receipt_version_key',
    'GoodsReceiptInspection_predecessor_key',
    'GoodsReceiptInspection_operation_key',
    'GRInspectionDisposition_alloc_quality_key',
    'GRInspectionDisposition_unalloc_quality_key',
    'SupplierCommitmentLineClosure_scope_id_key',
    'SupplierCommitmentLineClosure_version_key',
    'SupplierCommitmentLineClosure_predecessor_key',
    'SupplierCommitmentLineClosure_operation_key',
  ];
  const result = await client.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Inspection scope/idempotency indexes are incomplete.');
  const byName = new Map(result.rows.map((row) => [row.indexname, normalizeDefinition(row.indexdef)]));
  for (const name of names.filter((name) => name !== 'GoodsReceipt_receivedById_receivedAt_idx')) {
    invariant(byName.get(name)?.includes('create unique index'), `${name} must be unique.`);
  }
  invariant(
    byName.get('GoodsReceipt_receivedById_receivedAt_idx')?.includes('(receivedbyid, receivedat)'),
    'GoodsReceipt receiver chronology index drifted.',
  );
  invariant(
    byName.get('GRInspectionDisposition_alloc_quality_key')?.includes('where (allocationid is not null)'),
    'Allocated disposition uniqueness must be partial and non-null.',
  );
  invariant(
    byName.get('GRInspectionDisposition_unalloc_quality_key')?.includes('where (allocationid is null)'),
    'Unallocated disposition uniqueness must be partial and null-scoped.',
  );
}

async function assertConstraints(client) {
  const names = [
    'InventoryLocation_project_fkey',
    'GoodsReceiptInspection_project_fkey',
    'GoodsReceiptInspection_receipt_fkey',
    'GoodsReceiptInspection_location_fkey',
    'GoodsReceiptInspection_predecessor_fkey',
    'GRInspectionDisposition_inspection_fkey',
    'GRInspectionDisposition_receipt_line_fkey',
    'GRInspectionDisposition_allocation_fkey',
    'SupplierCommitmentLineClosure_commitment_fkey',
    'SupplierCommitmentLineClosure_project_fkey',
    'SupplierCommitmentLineClosure_line_fkey',
    'SupplierCommitmentLineClosure_predecessor_fkey',
    'InventoryLocation_code_check',
    'InventoryLocation_name_check',
    'GoodsReceiptInspection_location_snapshot_check',
    'GRInspection_GoodsReceiptLine_finite_check',
    'GRInspection_GRCAllocation_finite_check',
    'GRInspection_SupplierCommitmentLine_finite_check',
    'GRInspectionDisposition_quantity_positive_check',
    'SupplierCommitmentLineClosure_quantity_shape_check',
    'SupplierCommitmentLineClosure_finite_check',
  ];
  const result = await client.query(
    `SELECT constraint_record.conname,
            constraint_record.contype,
            constraint_record.convalidated,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Inspection governed constraints are incomplete.');
  const byName = new Map(result.rows.map((row) => [row.conname, row]));
  for (const name of names) {
    invariant(byName.get(name)?.convalidated, `${name} is not validated.`);
  }
  const allocationFk = normalizeDefinition(byName.get('GRInspectionDisposition_allocation_fkey')?.definition);
  for (const fragment of [
    'foreign key (organizationid, projectid, purchaseorderid, purchaseorderlineid, goodsreceiptid, goodsreceiptlineid, allocationid)',
    'references goodsreceiptcommitmentallocation(organizationid, projectid, purchaseorderid, purchaseorderlineid, goodsreceiptid, goodsreceiptlineid, id)',
    'on update restrict',
    'on delete restrict',
  ]) {
    invariant(allocationFk.includes(fragment), `Disposition allocation FK lost scope: ${fragment}.`);
  }
  invariant(
    normalizeDefinition(byName.get('GRInspectionDisposition_quantity_positive_check')?.definition)
      .includes("quantity <> 'nan'::numeric"),
    'Disposition finite quantity check drifted.',
  );
  for (const name of [
    'GRInspection_GoodsReceiptLine_finite_check',
    'GRInspection_GRCAllocation_finite_check',
    'GRInspection_SupplierCommitmentLine_finite_check',
    'SupplierCommitmentLineClosure_finite_check',
  ]) {
    invariant(
      normalizeDefinition(byName.get(name)?.definition).includes("<> 'nan'::numeric"),
      `${name} no longer rejects NUMERIC NaN.`,
    );
  }
  const locationCode = normalizeDefinition(byName.get('InventoryLocation_code_check')?.definition);
  for (const fragment of [
    'btrim',
    'upper',
    '^[a-z0-9]+([._-][a-z0-9]+)*$',
    '32',
  ]) {
    invariant(locationCode.includes(fragment), `InventoryLocation code contract drifted: ${fragment}.`);
  }
  const locationName = normalizeDefinition(byName.get('InventoryLocation_name_check')?.definition);
  invariant(locationName.includes('btrim'), 'InventoryLocation names must be trimmed.');
  const locationSnapshot = normalizeDefinition(
    byName.get('GoodsReceiptInspection_location_snapshot_check')?.definition,
  );
  for (const fragment of ['locationcodesnapshot', 'locationnamesnapshot', 'btrim', 'upper']) {
    invariant(locationSnapshot.includes(fragment), `Inspection location snapshot drifted: ${fragment}.`);
  }
}

async function assertTriggers(client) {
  const expected = new Map([
    ['InventoryLocation', ['InventoryLocation_active_guard']],
    ['GoodsReceipt', [
      'GoodsReceipt_inspection_document_guard',
      'GoodsReceipt_receiver_guard',
      'GoodsReceipt_status_transition_guard',
    ]],
    ['GoodsReceiptInspection', [
      'GoodsReceiptInspection_insert_guard',
      'GoodsReceiptInspection_append_only',
      'GoodsReceiptInspection_no_truncate',
      'GoodsReceiptInspection_snapshot_guard',
    ]],
    ['GoodsReceiptInspectionDisposition', [
      'GoodsReceiptInspectionDisposition_00_finite_guard',
      'GoodsReceiptInspectionDisposition_insert_guard',
      'GoodsReceiptInspectionDisposition_append_only',
      'GoodsReceiptInspectionDisposition_no_truncate',
      'GoodsReceiptInspectionDisposition_snapshot_guard',
    ]],
    ['SupplierCommitmentLineClosure', [
      'SupplierCommitmentLineClosure_00_finite_guard',
      'SupplierCommitmentLineClosure_insert_guard',
      'SupplierCommitmentLineClosure_append_only',
      'SupplierCommitmentLineClosure_no_truncate',
    ]],
    ['GoodsReceiptCommitmentAllocation', [
      'GoodsReceiptCommitmentAllocation_00_finite_guard',
      'GRCAllocation_inspection_guard',
    ]],
    ['GoodsReceiptLine', [
      'GoodsReceiptLine_00_finite_guard',
      'GoodsReceiptLine_inspection_guard',
    ]],
    ['SupplierCommitmentLine', [
      'SupplierCommitmentLine_00_finite_guard',
      'SupplierCommitmentLine_closure_guard',
    ]],
  ]);
  const result = await client.query(
    `SELECT relation_record.relname AS table_name,
            trigger_record.tgname,
            trigger_record.tgenabled,
            trigger_record.tgdeferrable,
            trigger_record.tginitdeferred,
            pg_get_triggerdef(trigger_record.oid, true) AS definition
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND NOT trigger_record.tgisinternal`,
  );
  const byKey = new Map(result.rows.map((row) => [`${row.table_name}:${row.tgname}`, row]));
  for (const [table, triggers] of expected) {
    for (const name of triggers) {
      const trigger = byKey.get(`${table}:${name}`);
      invariant(trigger, `${name} is missing.`);
      invariant(trigger.tgenabled === 'A', `${name} is not ENABLE ALWAYS.`);
    }
  }
  for (const [table, name] of [
    ['GoodsReceiptInspection', 'GoodsReceiptInspection_snapshot_guard'],
    ['GoodsReceiptInspectionDisposition', 'GoodsReceiptInspectionDisposition_snapshot_guard'],
  ]) {
    const trigger = byKey.get(`${table}:${name}`);
    invariant(trigger?.tgdeferrable && trigger?.tginitdeferred, `${name} must be initially deferred.`);
  }
  invariant(
    normalizeDefinition(byKey.get('GoodsReceiptLine:GoodsReceiptLine_inspection_guard')?.definition)
      .includes('before insert or delete or update'),
    'GoodsReceiptLine inspection guard must cover INSERT, UPDATE and DELETE.',
  );
  invariant(
    normalizeDefinition(byKey.get('InventoryLocation:InventoryLocation_active_guard')?.definition)
      .includes('before insert or update of active, organizationid, projectid'),
    'InventoryLocation active guard must cover inserts, reactivation and scope moves.',
  );
}

async function assertTriggerFunctions(client) {
  const names = [
    'obrasaas_goods_receipt_receiver_guard',
    'obrasaas_inventory_location_active_guard',
    'obrasaas_numeric_quantity_finite_guard',
    'obrasaas_goods_receipt_inspection_insert_guard',
    'obrasaas_goods_receipt_disposition_insert_guard',
    'obrasaas_goods_receipt_inspection_snapshot_guard',
    'obrasaas_supplier_commitment_line_closure_guard',
    'obrasaas_inspected_allocation_guard',
    'obrasaas_inspected_goods_receipt_line_guard',
    'obrasaas_inspected_goods_receipt_guard',
    'obrasaas_closed_supplier_commitment_line_guard',
    'obrasaas_inspection_append_only',
    'obrasaas_goods_receipt_status_transition_guard',
  ];
  const result = await client.query(
    `SELECT procedure_record.proname,
            procedure_record.proconfig,
            pg_get_functiondef(procedure_record.oid) AS definition
       FROM pg_proc AS procedure_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = procedure_record.pronamespace
      WHERE namespace_record.nspname = current_schema()
        AND procedure_record.proname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Inspection trigger functions are incomplete.');
  const byName = new Map(result.rows.map((row) => [row.proname, row]));
  for (const name of names) {
    invariant(
      (byName.get(name)?.proconfig || []).includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
  }
  const snapshot = normalizeDefinition(
    byName.get('obrasaas_goods_receipt_inspection_snapshot_guard')?.definition,
  );
  for (const fragment of [
    'pg_advisory_xact_lock',
    'exactly partition every receipt line',
    'exactly partition every receipt allocation',
    'unallocated dispositions must equal',
    "quality <> ''accepted''",
  ]) {
    invariant(snapshot.includes(fragment), `Deferred snapshot guard is missing: ${fragment}.`);
  }
  const closure = normalizeDefinition(
    byName.get('obrasaas_supplier_commitment_line_closure_guard')?.definition,
  );
  for (const fragment of [
    'latest_inspection',
    'uninspected_allocation_exists',
    'active inspection for every posted allocation',
    "quality = ''accepted''",
    'shortage_quantity := commitment_quantity - accepted_quantity',
    'quantities do not match effective accepted inspections',
  ]) {
    invariant(closure.includes(fragment), `Closure derivation is missing: ${fragment}.`);
  }
  const inspectionInsert = normalizeDefinition(
    byName.get('obrasaas_goods_receipt_inspection_insert_guard')?.definition,
  );
  invariant(
    inspectionInsert.includes("new.kind <> 'reversal' and not location_active"),
    'Only FINALIZATION/CORRECTION may require an active location.',
  );
  for (const fragment of [
    'locationcodesnapshot',
    'locationnamesnapshot',
    'reversal must preserve the historical location snapshot',
  ]) {
    invariant(inspectionInsert.includes(fragment), `Inspection location history is missing: ${fragment}.`);
  }
  const dispositionInsert = normalizeDefinition(
    byName.get('obrasaas_goods_receipt_disposition_insert_guard')?.definition,
  );
  for (const fragment of [
    'goodsreceiptcommitmentallocation',
    'suppliercommitmentlineclosure',
    'must be reversed before adding inspection dispositions',
  ]) {
    invariant(
      dispositionInsert.includes(fragment),
      `Disposition/closure ordering fence is missing: ${fragment}.`,
    );
  }
  const locationGuard = normalizeDefinition(
    byName.get('obrasaas_inventory_location_active_guard')?.definition,
  );
  for (const fragment of ['pg_advisory_xact_lock', 'active_location_count >= 100', 'scope are immutable']) {
    invariant(locationGuard.includes(fragment), `Inventory location cap is missing: ${fragment}.`);
  }
  const finiteGuard = normalizeDefinition(
    byName.get('obrasaas_numeric_quantity_finite_guard')?.definition,
  );
  for (const fragment of ['foreach column_name in array tg_argv', "quantity_text = 'nan'", 'must be finite']) {
    invariant(finiteGuard.includes(fragment), `Explicit NUMERIC finite guard is missing: ${fragment}.`);
  }
  const receiptGuard = normalizeDefinition(
    byName.get('obrasaas_inspected_goods_receipt_guard')?.definition,
  );
  for (const fragment of [
    'goodsreceiptinspection',
    "old.status = 'voided'",
    "new.status = 'voided'",
    'source document is immutable',
    "- 'status'",
  ]) {
    invariant(receiptGuard.includes(fragment), `Receipt evidence freeze is missing: ${fragment}.`);
  }
  const receiptLineGuard = normalizeDefinition(
    byName.get('obrasaas_inspected_goods_receipt_line_guard')?.definition,
  );
  for (const fragment of [
    "tg_op = 'insert'",
    'goodsreceiptinspection',
    "receipt_status = 'voided'",
    'voided goodsreceiptline is immutable',
    'receipt identity is immutable',
    'inspected goodsreceiptline is immutable',
  ]) {
    invariant(receiptLineGuard.includes(fragment), `Receipt line history freeze is missing: ${fragment}.`);
  }
  const closedLine = normalizeDefinition(
    byName.get('obrasaas_closed_supplier_commitment_line_guard')?.definition,
  );
  for (const fragment of [
    'order by closure.version desc',
    "latest_closure_kind = 'final_delivery'",
  ]) {
    invariant(closedLine.includes(fragment), `Closure reversal does not reopen the line: ${fragment}.`);
  }
}

async function expectSqlFailure(client, callback, { code, message }, label) {
  await client.query('SAVEPOINT goods_receipt_inspection_verifier_case');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  let failure = null;
  try {
    await callback();
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT goods_receipt_inspection_verifier_case');
  await client.query('RELEASE SAVEPOINT goods_receipt_inspection_verifier_case');
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
    organizationId: `inspection_verify_org_${suffix}`,
    otherOrganizationId: `inspection_verify_other_org_${suffix}`,
    projectId: `inspection_verify_project_${suffix}`,
    otherProjectId: `inspection_verify_other_project_${suffix}`,
    actorId: `inspection_verify_actor_${suffix}`,
    supplierId: `inspection_verify_supplier_${suffix}`,
    purchaseOrderId: `inspection_verify_order_${suffix}`,
    purchaseOrderLineId: `inspection_verify_order_line_${suffix}`,
    goodsReceiptId: `inspection_verify_receipt_${suffix}`,
    goodsReceiptLineId: `inspection_verify_receipt_line_${suffix}`,
    supplierCommitmentId: `inspection_verify_commitment_${suffix}`,
    allocationId: `inspection_verify_allocation_${suffix}`,
    locationId: `inspection_verify_location_${suffix}`,
    otherLocationId: `inspection_verify_other_location_${suffix}`,
  };
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Inspection verifier', $2, CURRENT_TIMESTAMP),
            ($3, 'Inspection verifier other', $4, CURRENT_TIMESTAMP)`,
    [
      fixture.organizationId,
      `inspection-verifier-${suffix}`,
      fixture.otherOrganizationId,
      `inspection-verifier-other-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
     VALUES ($1, $2, 'Inspection project', $3, CURRENT_TIMESTAMP),
            ($4, $5, 'Inspection other project', $6, CURRENT_TIMESTAMP)`,
    [
      fixture.projectId,
      fixture.organizationId,
      `inspection-project-${suffix}`,
      fixture.otherProjectId,
      fixture.otherOrganizationId,
      `inspection-other-project-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "PlatformUser" (
       "id", "clerkUserId", "primaryEmail", "lastSeenAt", "updatedAt"
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [fixture.actorId, `clerk-${suffix}`, `inspection-${suffix}@example.test`],
  );
  await client.query(
    `INSERT INTO "TenantMembership" (
       "id", "organizationId", "userId", "clerkRole", "tenantRole", "status", "updatedAt"
     ) VALUES ($1, $2, $3, 'org:admin', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)`,
    [`inspection_membership_${suffix}`, fixture.organizationId, fixture.actorId],
  );
  await client.query(
    `INSERT INTO "Supplier" ("id", "organizationId", "legalName", "updatedAt")
     VALUES ($1, $2, 'Inspection supplier', CURRENT_TIMESTAMP)`,
    [fixture.supplierId, fixture.organizationId],
  );
  await client.query(
    `INSERT INTO "PurchaseOrder" (
       "id", "organizationId", "projectId", "supplierId", "operationKey",
       "number", "currency", "status", "total", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, 'ARS', 'APPROVED', 5.00, CURRENT_TIMESTAMP)`,
    [
      fixture.purchaseOrderId,
      fixture.organizationId,
      fixture.projectId,
      fixture.supplierId,
      `inspection-order-${suffix}`,
      `INSPECT-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "PurchaseOrderLine" (
       "id", "purchaseOrderId", "projectId", "description", "unit", "quantity", "unitPrice"
     ) VALUES ($1, $2, $3, 'Inspection material', 'u', 5.000, 1.00)`,
    [fixture.purchaseOrderLineId, fixture.purchaseOrderId, fixture.projectId],
  );
  await client.query(
    `INSERT INTO "GoodsReceipt" (
       "id", "organizationId", "projectId", "purchaseOrderId", "operationKey",
       "status", "receivedById", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'POSTED', $6, CURRENT_TIMESTAMP)`,
    [
      fixture.goodsReceiptId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      `inspection-receipt-${suffix}`,
      fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptLine" (
       "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
     ) VALUES ($1, $2, $3, $4, $5, 5.000)`,
    [
      fixture.goodsReceiptLineId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.goodsReceiptId,
      fixture.purchaseOrderLineId,
    ],
  );
  await client.query(
    `INSERT INTO "SupplierCommitment" (
       "id", "organizationId", "projectId", "supplierId", "purchaseOrderId",
       "operationKey", "requestFingerprint", "kind", "status", "title",
       "startsOn", "endsOn", "timezone", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'MATERIAL_DELIVERY', 'CONFIRMED',
       'Inspection commitment', CURRENT_DATE, CURRENT_DATE,
       'America/Argentina/Buenos_Aires', CURRENT_TIMESTAMP)`,
    [
      fixture.supplierCommitmentId,
      fixture.organizationId,
      fixture.projectId,
      fixture.supplierId,
      fixture.purchaseOrderId,
      `inspection-commitment-${suffix}`,
      'b'.repeat(64),
    ],
  );
  await client.query(
    `INSERT INTO "SupplierCommitmentEvent" (
       "id", "organizationId", "projectId", "commitmentId", "sequence",
       "operationKey", "requestFingerprint", "type", "actorId", "nextState"
     ) VALUES ($1, $2, $3, $4, 0, $5, $6, 'CREATED', $7,
       jsonb_build_object(
         'kind', 'MATERIAL_DELIVERY',
         'status', 'CONFIRMED',
         'title', 'Inspection commitment',
         'startsOn', to_char(CURRENT_DATE, 'YYYY-MM-DD'),
         'endsOn', to_char(CURRENT_DATE, 'YYYY-MM-DD'),
         'reminderEnabled', false,
         'reminderDaysBefore', 7,
         'reminderEmailConfigured', false,
         'reminderEmailConfirmed', false,
         'scheduleRevision', 0,
         'revision', 0
       ))`,
    [
      `inspection_commitment_event_${suffix}`,
      fixture.organizationId,
      fixture.projectId,
      fixture.supplierCommitmentId,
      `inspection-commitment-${suffix}`,
      'b'.repeat(64),
      fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "SupplierCommitmentLine" (
       "commitmentId", "projectId", "purchaseOrderId", "purchaseOrderLineId", "quantity"
     ) VALUES ($1, $2, $3, $4, 5.000)`,
    [
      fixture.supplierCommitmentId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptCommitmentAllocation" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "goodsReceiptId", "goodsReceiptLineId", "supplierCommitmentId", "quantity",
       "operationKey", "requestFingerprint", "createdById"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 4.000, $9, $10, $11)`,
    [
      fixture.allocationId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
      fixture.goodsReceiptId,
      fixture.goodsReceiptLineId,
      fixture.supplierCommitmentId,
      `inspection-allocation-${suffix}`,
      'c'.repeat(64),
      fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "InventoryLocation" (
       "id", "organizationId", "projectId", "code", "name", "updatedAt"
      ) VALUES ($1, $2, $3, 'OBRA', 'Acopio de obra', CURRENT_TIMESTAMP),
               ($4, $2, $3, 'CONTROL', 'Sector de control', CURRENT_TIMESTAMP)`,
    [
      fixture.locationId,
      fixture.organizationId,
      fixture.projectId,
      fixture.otherLocationId,
    ],
  );
  return fixture;
}

async function insertInspection(client, fixture, overrides = {}) {
  const values = {
    id: `inspection_${randomUUID()}`,
    kind: 'FINALIZATION',
    version: 1,
    predecessorId: null,
    operationKey: `inspection-operation-${randomUUID()}`,
    requestFingerprint: 'd'.repeat(64),
    inspectedById: fixture.actorId,
    locationId: fixture.locationId,
    locationCodeSnapshot: 'OBRA',
    locationNameSnapshot: 'Acopio de obra',
    reason: null,
    ...overrides,
  };
  await client.query(
    `INSERT INTO "GoodsReceiptInspection" (
       "id", "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId",
       "kind", "version", "predecessorId", "operationKey", "requestFingerprint",
       "inspectedById", "locationId", "locationCodeSnapshot", "locationNameSnapshot", "reason"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      values.id,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.goodsReceiptId,
      values.kind,
      values.version,
      values.predecessorId,
      values.operationKey,
      values.requestFingerprint,
      values.inspectedById,
      values.locationId,
      values.locationCodeSnapshot,
      values.locationNameSnapshot,
      values.reason,
    ],
  );
  return values;
}

async function insertDisposition(client, fixture, inspectionId, overrides = {}) {
  const values = {
    id: `disposition_${randomUUID()}`,
    allocationId: fixture.allocationId,
    quality: 'ACCEPTED',
    quantity: '1.000',
    ...overrides,
  };
  await client.query(
    `INSERT INTO "GoodsReceiptInspectionDisposition" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "goodsReceiptId", "goodsReceiptLineId", "inspectionId", "allocationId", "quality", "quantity"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::numeric)`,
    [
      values.id,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
      fixture.goodsReceiptId,
      fixture.goodsReceiptLineId,
      inspectionId,
      values.allocationId,
      values.quality,
      values.quantity,
    ],
  );
  return values;
}

async function insertClosure(client, fixture, overrides = {}) {
  const values = {
    id: `closure_${randomUUID()}`,
    kind: 'FINAL_DELIVERY',
    version: 1,
    predecessorId: null,
    operationKey: `closure-operation-${randomUUID()}`,
    requestFingerprint: 'e'.repeat(64),
    acceptedQuantity: '3.000',
    shortageQuantity: '2.000',
    reason: 'Faltante final verificado.',
    ...overrides,
  };
  await client.query(
    `INSERT INTO "SupplierCommitmentLineClosure" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "supplierCommitmentId", "kind", "version", "predecessorId", "operationKey",
       "requestFingerprint", "closedById", "acceptedQuantity", "shortageQuantity", "reason"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13::numeric, $14::numeric, $15)`,
    [
      values.id,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
      fixture.supplierCommitmentId,
      values.kind,
      values.version,
      values.predecessorId,
      values.operationKey,
      values.requestFingerprint,
      fixture.actorId,
      values.acceptedQuantity,
      values.shortageQuantity,
      values.reason,
    ],
  );
  return values;
}

async function assertRollbackOnlySmoke(client) {
  const fixture = await createFixture(client);
  const voidedReceiptId = `inspection_verify_voided_receipt_${randomUUID()}`;
  const voidedReceiptLineId = `inspection_verify_voided_line_${randomUUID()}`;
  await client.query(
    `INSERT INTO "GoodsReceipt" (
       "id", "organizationId", "projectId", "purchaseOrderId", "operationKey",
       "status", "receivedById", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'POSTED', $6, CURRENT_TIMESTAMP)`,
    [
      voidedReceiptId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      `voided-receipt-${randomUUID()}`,
      fixture.actorId,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptLine" (
       "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
     ) VALUES ($1, $2, $3, $4, $5, 1.000)`,
    [
      voidedReceiptLineId,
      fixture.projectId,
      fixture.purchaseOrderId,
      voidedReceiptId,
      fixture.purchaseOrderLineId,
    ],
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceipt"
          SET "status" = 'VOIDED', "notes" = 'alterado al anular',
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1`,
      [voidedReceiptId],
    ),
    { code: '55000', message: 'source document is immutable' },
    'combined receipt void and document mutation',
  );
  await client.query(
    `UPDATE "GoodsReceipt" SET "status" = 'VOIDED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1`,
    [voidedReceiptId],
  );
  for (const [label, statement, values, message] of [
    [
      'voided receipt document mutation',
      `UPDATE "GoodsReceipt" SET "notes" = 'alterado', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1`,
      [voidedReceiptId],
      'source document is immutable',
    ],
    [
      'voided receipt deletion',
      `DELETE FROM "GoodsReceipt" WHERE "id" = $1`,
      [voidedReceiptId],
      'source document is immutable',
    ],
    [
      'voided receipt line insertion',
      `INSERT INTO "GoodsReceiptLine" (
         "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
       ) VALUES ($1, $2, $3, $4, $5, 1.000)`,
      [
        `voided_extra_line_${randomUUID()}`,
        fixture.projectId,
        fixture.purchaseOrderId,
        voidedReceiptId,
        fixture.purchaseOrderLineId,
      ],
      'Voided GoodsReceiptLine is immutable',
    ],
    [
      'voided receipt line update',
      `UPDATE "GoodsReceiptLine" SET "quantity" = 2.000 WHERE "id" = $1`,
      [voidedReceiptLineId],
      'Voided GoodsReceiptLine is immutable',
    ],
    [
      'voided receipt line deletion',
      `DELETE FROM "GoodsReceiptLine" WHERE "id" = $1`,
      [voidedReceiptLineId],
      'Voided GoodsReceiptLine is immutable',
    ],
  ]) {
    await expectSqlFailure(
      client,
      () => client.query(statement, values),
      { code: '55000', message },
      label,
    );
  }

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceipt" SET "receivedById" = NULL WHERE "id" = $1`,
      [fixture.goodsReceiptId],
    ),
    { code: '55000', message: 'receivedById is immutable once attributed' },
    'receipt server attribution immutability',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "InventoryLocation" (
         "id", "organizationId", "projectId", "code", "name", "updatedAt"
       ) VALUES ($1, $2, $3, ' deposito ', 'Depósito inválido', CURRENT_TIMESTAMP)`,
      [`invalid_location_${randomUUID()}`, fixture.organizationId, fixture.projectId],
    ),
    { code: '23514', message: 'InventoryLocation_code_check' },
    'non-canonical inventory location code',
  );

  await expectSqlFailure(
    client,
    async () => {
      await client.query(
        `INSERT INTO "InventoryLocation" (
           "id", "organizationId", "projectId", "code", "name", "updatedAt"
         )
         SELECT $1 || '_limit_' || series::text, $2, $3,
                'L' || lpad(series::text, 3, '0'),
                'Ubicación ' || series::text, CURRENT_TIMESTAMP
           FROM generate_series(1, 98) AS series`,
        [fixture.projectId, fixture.organizationId, fixture.projectId],
      );
      await client.query(
        `INSERT INTO "InventoryLocation" (
           "id", "organizationId", "projectId", "code", "name", "updatedAt"
         ) VALUES ($1, $2, $3, 'LIMIT101', 'Ubicación 101', CURRENT_TIMESTAMP)`,
        [`limit_101_${randomUUID()}`, fixture.organizationId, fixture.projectId],
      );
    },
    { code: '54000', message: 'active limit of 100' },
    'one hundred first active inventory location',
  );

  await expectSqlFailure(
    client,
    async () => {
      await client.query(
        `INSERT INTO "InventoryLocation" (
           "id", "organizationId", "projectId", "code", "name", "updatedAt"
         )
         SELECT $1 || '_reactivate_' || series::text, $2, $3,
                'R' || lpad(series::text, 3, '0'),
                'Reactivación ' || series::text, CURRENT_TIMESTAMP
           FROM generate_series(1, 98) AS series`,
        [fixture.projectId, fixture.organizationId, fixture.projectId],
      );
      await client.query(
        `UPDATE "InventoryLocation"
            SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1`,
        [`${fixture.projectId}_reactivate_1`],
      );
      await client.query(
        `INSERT INTO "InventoryLocation" (
           "id", "organizationId", "projectId", "code", "name", "updatedAt"
         ) VALUES ($1, $2, $3, 'REPLACEMENT', 'Ubicación reemplazo', CURRENT_TIMESTAMP)`,
        [`replacement_${randomUUID()}`, fixture.organizationId, fixture.projectId],
      );
      await client.query(
        `UPDATE "InventoryLocation"
            SET "active" = true, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1`,
        [`${fixture.projectId}_reactivate_1`],
      );
    },
    { code: '54000', message: 'active limit of 100' },
    'reactivation beyond inventory location limit',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "InventoryLocation"
          SET "organizationId" = $1, "projectId" = $2, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3`,
      [fixture.otherOrganizationId, fixture.otherProjectId, fixture.locationId],
    ),
    { code: '55000', message: 'scope are immutable' },
    'inventory location tenant scope move',
  );

  await expectSqlFailure(
    client,
    async () => {
      const lineId = `nan_receipt_order_line_${randomUUID()}`;
      await client.query(
        `INSERT INTO "PurchaseOrderLine" (
           "id", "purchaseOrderId", "projectId", "description", "unit", "quantity", "unitPrice"
         ) VALUES ($1, $2, $3, 'NaN receipt line', 'u', 1.000, 1.00)`,
        [lineId, fixture.purchaseOrderId, fixture.projectId],
      );
      await client.query(
        `INSERT INTO "GoodsReceiptLine" (
           "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
         ) VALUES ($1, $2, $3, $4, $5, 'NaN'::numeric)`,
        [
          `nan_receipt_line_${randomUUID()}`,
          fixture.projectId,
          fixture.purchaseOrderId,
          fixture.goodsReceiptId,
          lineId,
        ],
      );
    },
    { code: '23514', message: 'must be finite' },
    'receipt line NUMERIC NaN rejection',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "GoodsReceiptCommitmentAllocation" (
         "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
         "goodsReceiptId", "goodsReceiptLineId", "supplierCommitmentId", "quantity",
         "operationKey", "requestFingerprint", "createdById"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NaN'::numeric, $9, $10, $11)`,
      [
        `nan_allocation_${randomUUID()}`,
        fixture.organizationId,
        fixture.projectId,
        fixture.purchaseOrderId,
        fixture.purchaseOrderLineId,
        fixture.goodsReceiptId,
        fixture.goodsReceiptLineId,
        fixture.supplierCommitmentId,
        `nan-allocation-${randomUUID()}`,
        '9'.repeat(64),
        fixture.actorId,
      ],
    ),
    { code: '23514', message: 'must be finite' },
    'allocation NUMERIC NaN rejection',
  );

  await expectSqlFailure(
    client,
    async () => {
      const lineId = `nan_commitment_order_line_${randomUUID()}`;
      await client.query(
        `INSERT INTO "PurchaseOrderLine" (
           "id", "purchaseOrderId", "projectId", "description", "unit", "quantity", "unitPrice"
         ) VALUES ($1, $2, $3, 'NaN commitment line', 'u', 1.000, 1.00)`,
        [lineId, fixture.purchaseOrderId, fixture.projectId],
      );
      await client.query(
        `INSERT INTO "SupplierCommitmentLine" (
           "commitmentId", "projectId", "purchaseOrderId", "purchaseOrderLineId", "quantity"
         ) VALUES ($1, $2, $3, $4, 'NaN'::numeric)`,
        [fixture.supplierCommitmentId, fixture.projectId, fixture.purchaseOrderId, lineId],
      );
    },
    { code: '23514', message: 'must be finite' },
    'supplier commitment line NUMERIC NaN rejection',
  );

  await expectSqlFailure(
    client,
    () => insertClosure(client, fixture, {
      acceptedQuantity: '0.000',
      shortageQuantity: '5.000',
      reason: 'No debe cerrar sin inspección.',
    }),
    { code: '55000', message: 'active inspection for every posted allocation' },
    'final delivery with uninspected posted allocation',
  );

  await expectSqlFailure(
    client,
    async () => {
      const invalid = await insertInspection(client, fixture, { reason: 'Partición incompleta.' });
      await insertDisposition(client, fixture, invalid.id, { quantity: '3.000' });
      await insertDisposition(client, fixture, invalid.id, {
        allocationId: null,
        quality: 'QUARANTINED',
        quantity: '2.000',
      });
    },
    { code: '23514', message: 'exactly partition every receipt allocation' },
    'deferred allocation partition mismatch',
  );

  await expectSqlFailure(
    client,
    () => insertInspection(client, fixture, {
      locationCodeSnapshot: 'WRONG',
      locationNameSnapshot: 'Ubicación incorrecta',
    }),
    { code: '23514', message: 'location snapshot must match' },
    'inspection location snapshot mismatch',
  );

  await expectSqlFailure(
    client,
    async () => {
      const partialInspection = await insertInspection(client, fixture, {
        reason: 'Encabezado antes del cierre adversarial.',
      });
      await insertClosure(client, fixture, {
        acceptedQuantity: '0.000',
        shortageQuantity: '5.000',
        reason: 'Cierre adversarial antes de las disposiciones.',
      });
      await insertDisposition(client, fixture, partialInspection.id, {
        quantity: '4.000',
      });
    },
    { code: '55000', message: 'before adding inspection dispositions' },
    'same transaction closure before inspection dispositions',
  );

  const inspection = await insertInspection(client, fixture, {
    reason: 'Una unidad dañada y una sin compromiso.',
  });
  invariant(inspection.version === 1, 'Initial inspection must be version 1.');
  await insertDisposition(client, fixture, inspection.id, {
    quality: 'ACCEPTED',
    quantity: '3.000',
  });
  await insertDisposition(client, fixture, inspection.id, {
    quality: 'DAMAGED',
    quantity: '1.000',
  });
  await insertDisposition(client, fixture, inspection.id, {
    allocationId: null,
    quality: 'QUARANTINED',
    quantity: '1.000',
  });
  await flushDeferredConstraints(client);

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceipt"
          SET "notes" = 'documento alterado', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1`,
      [fixture.goodsReceiptId],
    ),
    { code: '55000', message: 'source document is immutable' },
    'inspected receipt document mutation',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "GoodsReceiptLine" (
         "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
       ) VALUES ($1, $2, $3, $4, $5, 1.000)`,
      [
        `frozen_receipt_line_${randomUUID()}`,
        fixture.projectId,
        fixture.purchaseOrderId,
        fixture.goodsReceiptId,
        fixture.purchaseOrderLineId,
      ],
    ),
    { code: '55000', message: 'Inspected GoodsReceiptLine is immutable' },
    'receipt line insert after inspection history',
  );
  await expectSqlFailure(
    client,
    () => insertDisposition(client, fixture, inspection.id, {
      quality: 'REJECTED',
      quantity: 'NaN',
    }),
    { code: '23514', message: 'must be finite' },
    'inspection disposition NUMERIC NaN rejection',
  );

  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceiptInspection" SET "reason" = 'mutated' WHERE "id" = $1`,
      [inspection.id],
    ),
    { code: '55000', message: 'append-only' },
    'inspection UPDATE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `DELETE FROM "GoodsReceiptInspectionDisposition" WHERE "inspectionId" = $1`,
      [inspection.id],
    ),
    { code: '55000', message: 'append-only' },
    'disposition DELETE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query('TRUNCATE TABLE "GoodsReceiptInspection" CASCADE'),
    { code: '55000', message: 'append-only' },
    'inspection TRUNCATE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `INSERT INTO "GoodsReceiptCommitmentAllocation" (
         "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
         "goodsReceiptId", "goodsReceiptLineId", "supplierCommitmentId", "quantity",
         "operationKey", "requestFingerprint", "createdById"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.500, $9, $10, $11)`,
      [
        `frozen_allocation_${randomUUID()}`,
        fixture.organizationId,
        fixture.projectId,
        fixture.purchaseOrderId,
        fixture.purchaseOrderLineId,
        fixture.goodsReceiptId,
        fixture.goodsReceiptLineId,
        fixture.supplierCommitmentId,
        `frozen-allocation-${randomUUID()}`,
        'f'.repeat(64),
        fixture.actorId,
      ],
    ),
    { code: '55000', message: 'frozen by active inspection' },
    'allocation after final inspection',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceipt" SET "status" = 'VOIDED', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1`,
      [fixture.goodsReceiptId],
    ),
    { code: '55000', message: 'inspection must be reversed' },
    'receipt void before inspection reversal',
  );

  await expectSqlFailure(
    client,
    () => insertClosure(client, fixture, {
      acceptedQuantity: '2.999',
      shortageQuantity: '2.001',
    }),
    { code: '23514', message: 'do not match effective accepted inspections' },
    'closure accepted quantity mismatch by 0.001',
  );
  await expectSqlFailure(
    client,
    () => insertClosure(client, fixture, {
      acceptedQuantity: 'NaN',
      shortageQuantity: 'NaN',
    }),
    { code: '23514', message: 'must be finite' },
    'supplier closure NUMERIC NaN rejection',
  );
  const closure = await insertClosure(client, fixture);
  invariant(closure.version === 1, 'Initial closure must be version 1.');
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "SupplierCommitmentLineClosure" SET "reason" = 'mutated' WHERE "id" = $1`,
      [closure.id],
    ),
    { code: '55000', message: 'append-only' },
    'closure UPDATE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query('TRUNCATE TABLE "SupplierCommitmentLineClosure"'),
    { code: '55000', message: 'append-only' },
    'closure TRUNCATE append-only smoke',
  );

  await expectSqlFailure(
    client,
    () => insertInspection(client, fixture, {
      kind: 'CORRECTION',
      version: 2,
      predecessorId: inspection.id,
      reason: 'Attempt while delivery is closed.',
    }),
    { code: '55000', message: 'closure must be reversed' },
    'inspection correction while closure active',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "SupplierCommitmentLine"
          SET "createdAt" = "createdAt" + INTERVAL '1 millisecond'
        WHERE "commitmentId" = $1 AND "purchaseOrderLineId" = $2`,
      [fixture.supplierCommitmentId, fixture.purchaseOrderLineId],
    ),
    { code: '55000', message: 'Closed SupplierCommitmentLine is immutable' },
    'commitment line update before closure reversal',
  );

  const closureReversal = await insertClosure(client, fixture, {
    kind: 'REVERSAL',
    version: 2,
    predecessorId: closure.id,
    acceptedQuantity: null,
    shortageQuantity: null,
    reason: 'Reabrir para corregir inspección.',
  });
  invariant(
    closureReversal.kind === 'REVERSAL' && closureReversal.version === 2,
    'Closure reversal must advance the chain to version 2.',
  );
  await client.query(
    `UPDATE "SupplierCommitmentLine"
        SET "createdAt" = "createdAt" + INTERVAL '1 millisecond'
      WHERE "commitmentId" = $1 AND "purchaseOrderLineId" = $2`,
    [fixture.supplierCommitmentId, fixture.purchaseOrderLineId],
  );

  const correction = await insertInspection(client, fixture, {
    kind: 'CORRECTION',
    version: 2,
    predecessorId: inspection.id,
    reason: 'Daño descartado tras revisión técnica.',
  });
  invariant(correction.version === 2, 'Inspection correction must advance the chain to version 2.');
  await insertDisposition(client, fixture, correction.id, {
    quality: 'ACCEPTED',
    quantity: '4.000',
  });
  await insertDisposition(client, fixture, correction.id, {
    allocationId: null,
    quality: 'QUARANTINED',
    quantity: '1.000',
  });
  await flushDeferredConstraints(client);

  const reopenedClosure = await insertClosure(client, fixture, {
    version: 3,
    predecessorId: closureReversal.id,
    acceptedQuantity: '4.000',
    shortageQuantity: '1.000',
    reason: 'Una unidad final pendiente.',
  });
  invariant(reopenedClosure.version === 3, 'Reopened closure must advance the chain to version 3.');
  await expectSqlFailure(
    client,
    () => insertInspection(client, fixture, {
      kind: 'REVERSAL',
      version: 3,
      predecessorId: correction.id,
      reason: 'No puede reabrir con cierre activo.',
    }),
    { code: '55000', message: 'closure must be reversed' },
    'inspection reversal while reopened closure active',
  );
  const reopenedClosureReversal = await insertClosure(client, fixture, {
    kind: 'REVERSAL',
    version: 4,
    predecessorId: reopenedClosure.id,
    acceptedQuantity: null,
    shortageQuantity: null,
    reason: 'Reabrir recepción nuevamente.',
  });
  invariant(reopenedClosureReversal.version === 4, 'Second closure reversal must advance to version 4.');
  await client.query(
    `UPDATE "InventoryLocation" SET "active" = false, "revision" = "revision" + 1,
       "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
    [fixture.locationId],
  );

  await expectSqlFailure(
    client,
    () => insertInspection(client, fixture, {
      kind: 'REVERSAL',
      version: 3,
      predecessorId: correction.id,
      locationId: fixture.otherLocationId,
      locationCodeSnapshot: 'CONTROL',
      locationNameSnapshot: 'Sector de control',
      reason: 'Intento de cambiar la ubicación histórica.',
    }),
    { code: '55000', message: 'preserve the historical location snapshot' },
    'inspection reversal location mutation',
  );

  const reversal = await insertInspection(client, fixture, {
    kind: 'REVERSAL',
    version: 3,
    predecessorId: correction.id,
    reason: 'Reabrir conciliación explícitamente.',
  });
  invariant(reversal.version === 3, 'Inspection reversal must advance the chain to version 3.');
  await flushDeferredConstraints(client);
  await expectSqlFailure(
    client,
    () => insertDisposition(client, fixture, reversal.id, {
      allocationId: null,
      quality: 'ACCEPTED',
      quantity: '1.000',
    }),
    { code: '23514', message: 'REVERSAL inspection cannot contain dispositions' },
    'disposition on reversal inspection',
  );

  await client.query(
    `INSERT INTO "GoodsReceiptCommitmentAllocation" (
       "id", "organizationId", "projectId", "purchaseOrderId", "purchaseOrderLineId",
       "goodsReceiptId", "goodsReceiptLineId", "supplierCommitmentId", "quantity",
       "operationKey", "requestFingerprint", "createdById"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1.000, $9, $10, $11)`,
    [
      `reopened_allocation_${randomUUID()}`,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.purchaseOrderLineId,
      fixture.goodsReceiptId,
      fixture.goodsReceiptLineId,
      fixture.supplierCommitmentId,
      `reopened-allocation-${randomUUID()}`,
      '1'.repeat(64),
      fixture.actorId,
    ],
  );
  await client.query(
    `UPDATE "GoodsReceipt" SET "status" = 'VOIDED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1`,
    [fixture.goodsReceiptId],
  );
}

async function assertTwoConnectionAdvisorySerialization() {
  const first = new pg.Client({
    connectionString: verifierConnectionString,
    application_name: 'obrasaas-inspection-lock-verifier-a',
    statement_timeout: 15_000,
    query_timeout: 20_000,
  });
  const second = new pg.Client({
    connectionString: verifierConnectionString,
    application_name: 'obrasaas-inspection-lock-verifier-b',
    statement_timeout: 15_000,
    query_timeout: 20_000,
  });
  let firstOpen = false;
  let secondOpen = false;
  try {
    await Promise.all([first.connect(), second.connect()]);
    await first.query('BEGIN');
    firstOpen = true;
    await second.query('BEGIN');
    secondOpen = true;
    const key = `inspection_concurrency_${randomUUID()}`;
    await first.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    const blocked = await second.query(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [key],
    );
    invariant(blocked.rows[0]?.acquired === false, 'The second connection bypassed the project advisory lock.');
    await first.query('ROLLBACK');
    firstOpen = false;
    const acquired = await second.query(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [key],
    );
    invariant(acquired.rows[0]?.acquired === true, 'The inspection advisory lock was not released.');
    await second.query('ROLLBACK');
    secondOpen = false;
  } finally {
    if (firstOpen) await first.query('ROLLBACK').catch(() => undefined);
    if (secondOpen) await second.query('ROLLBACK').catch(() => undefined);
    await Promise.all([
      first.end().catch(() => undefined),
      second.end().catch(() => undefined),
    ]);
  }
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-goods-receipt-inspection-migration-verifier',
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
    throw new Error('Unable to connect to the dedicated goods receipt inspection verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(activeSchema.rows[0]?.name === databaseSchema, 'PostgreSQL did not activate the configured inspection schema.');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '35s'");
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  await assertMigration(client);
  await assertEnums(client);
  await assertColumns(client);
  await assertIndexes(client);
  await assertConstraints(client);
  await assertTriggers(client);
  await assertTriggerFunctions(client);
  await assertRollbackOnlySmoke(client);
  await client.query('ROLLBACK');
  transactionOpen = false;
  await assertTwoConnectionAdvisorySerialization();
  console.log(
    `Verified ${MIGRATION}: exact deferred inspection partitions, immutable corrections/reversals, derived shortage closure, scoped locks and no inferred backfill.`,
  );
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  if (connected) await client.end();
}
