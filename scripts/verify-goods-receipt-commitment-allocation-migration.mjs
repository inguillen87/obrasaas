import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_SCHEMA';
const MIGRATION = '20260802150000_goods_receipt_commitment_allocation';
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
    throw new Error('The goods receipt allocation migration schema must be a safe PostgreSQL identifier.');
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
  invariant(result.rowCount === 1, `Migration ${MIGRATION} is not applied exactly once.`);
  invariant(
    result.rows[0].checksum === expectedMigrationChecksum,
    `Applied migration ${MIGRATION} does not match the repository checksum.`,
  );
}

async function assertColumns(client) {
  const result = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable,
            numeric_precision, numeric_scale, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'GoodsReceiptCommitmentAllocation'`,
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));
  const required = [
    'id',
    'organizationId',
    'projectId',
    'purchaseOrderId',
    'purchaseOrderLineId',
    'goodsReceiptId',
    'goodsReceiptLineId',
    'supplierCommitmentId',
    'quantity',
    'operationKey',
    'requestFingerprint',
    'createdById',
    'createdAt',
  ];
  for (const name of required) {
    invariant(columns.get(name)?.is_nullable === 'NO', `${name} is missing or nullable.`);
  }
  const quantity = columns.get('quantity');
  invariant(
    quantity?.data_type === 'numeric'
      && Number(quantity.numeric_precision) === 14
      && Number(quantity.numeric_scale) === 3,
    'Allocation quantity must remain DECIMAL(14,3).',
  );
  invariant(
    columns.get('operationKey')?.data_type === 'character varying'
      && Number(columns.get('operationKey')?.character_maximum_length) === 190,
    'Allocation operationKey storage width drifted.',
  );
  invariant(
    columns.get('requestFingerprint')?.data_type === 'character'
      && Number(columns.get('requestFingerprint')?.character_maximum_length) === 64,
    'Allocation requestFingerprint must remain CHAR(64).',
  );
}

async function assertIndexes(client) {
  const names = [
    'GRCAllocation_project_id_key',
    'GRCAllocation_project_operation_key',
    'GRCAllocation_receipt_line_idx',
    'GRCAllocation_supplier_commitment_line_idx',
    'GoodsReceipt_org_project_order_id_key',
    'GoodsReceiptLine_scope_key',
    'SupplierCommitment_org_project_order_id_key',
    'SupplierCommitmentLine_scope_key',
  ];
  const result = await client.query(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Allocation scope indexes are incomplete.');
  const byName = new Map(result.rows.map((row) => [row.indexname, normalizeDefinition(row.indexdef)]));
  invariant(
    byName.get('GRCAllocation_project_id_key')?.includes('create unique index'),
    'Allocation project/id uniqueness is missing.',
  );
  invariant(
    byName.get('GRCAllocation_project_operation_key')?.includes('create unique index'),
    'Allocation operation idempotency uniqueness is missing.',
  );
  const expectedColumns = new Map([
    ['GRCAllocation_project_id_key', '(projectid, id)'],
    ['GRCAllocation_project_operation_key', '(projectid, operationkey)'],
    ['GRCAllocation_receipt_line_idx', '(projectid, goodsreceiptlineid)'],
    ['GRCAllocation_supplier_commitment_line_idx', '(projectid, suppliercommitmentid, purchaseorderlineid)'],
    ['GoodsReceipt_org_project_order_id_key', '(organizationid, projectid, purchaseorderid, id)'],
    ['GoodsReceiptLine_scope_key', '(projectid, purchaseorderid, goodsreceiptid, purchaseorderlineid, id)'],
    ['SupplierCommitment_org_project_order_id_key', '(organizationid, projectid, purchaseorderid, id)'],
    ['SupplierCommitmentLine_scope_key', '(projectid, purchaseorderid, commitmentid, purchaseorderlineid)'],
  ]);
  for (const [name, columns] of expectedColumns) {
    invariant(byName.get(name)?.includes(columns), `${name} has an unexpected column order.`);
  }
}

async function assertConstraints(client) {
  const names = [
    'GoodsReceiptCommitmentAllocation_pkey',
    'GRCAllocation_quantity_positive_check',
    'GRCAllocation_operation_key_check',
    'GRCAllocation_request_fingerprint_check',
    'GRCAllocation_receipt_fkey',
    'GRCAllocation_receipt_line_fkey',
    'GRCAllocation_supplier_commitment_fkey',
    'GRCAllocation_supplier_commitment_line_fkey',
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
        AND relation_record.relname = 'GoodsReceiptCommitmentAllocation'
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Allocation governed constraints are incomplete.');
  const byName = new Map(result.rows.map((row) => [row.conname, row]));
  for (const name of names) {
    invariant(byName.get(name)?.convalidated, `${name} is not validated.`);
  }
  invariant(
    byName.get('GoodsReceiptCommitmentAllocation_pkey')?.contype === 'p',
    'Allocation id primary key is missing.',
  );
  invariant(
    normalizeDefinition(byName.get('GRCAllocation_quantity_positive_check')?.definition)
      .includes('quantity > 0'),
    'Allocation positive quantity CHECK drifted.',
  );
  const operationCheck = normalizeDefinition(byName.get('GRCAllocation_operation_key_check')?.definition);
  invariant(
    operationCheck.includes('char_length(operationkey')
      && (
        operationCheck.includes('between 1 and 128')
        || (operationCheck.includes('>= 1') && operationCheck.includes('<= 128'))
      ),
    'Allocation operationKey length CHECK drifted.',
  );
  invariant(
    normalizeDefinition(byName.get('GRCAllocation_request_fingerprint_check')?.definition)
      .includes("requestfingerprint ~ '^[0-9a-f]{64}$'"),
    'Allocation requestFingerprint format CHECK drifted.',
  );
  const expectedForeignKeys = new Map([
    ['GRCAllocation_receipt_fkey', [
      'foreign key (organizationid, projectid, purchaseorderid, goodsreceiptid)',
      'references goodsreceipt(organizationid, projectid, purchaseorderid, id)',
    ]],
    ['GRCAllocation_receipt_line_fkey', [
      'foreign key (projectid, purchaseorderid, goodsreceiptid, purchaseorderlineid, goodsreceiptlineid)',
      'references goodsreceiptline(projectid, purchaseorderid, goodsreceiptid, purchaseorderlineid, id)',
    ]],
    ['GRCAllocation_supplier_commitment_fkey', [
      'foreign key (organizationid, projectid, purchaseorderid, suppliercommitmentid)',
      'references suppliercommitment(organizationid, projectid, purchaseorderid, id)',
    ]],
    ['GRCAllocation_supplier_commitment_line_fkey', [
      'foreign key (projectid, purchaseorderid, suppliercommitmentid, purchaseorderlineid)',
      'references suppliercommitmentline(projectid, purchaseorderid, commitmentid, purchaseorderlineid)',
    ]],
  ]);
  for (const [name, fragments] of expectedForeignKeys) {
    const constraint = byName.get(name);
    invariant(constraint?.contype === 'f', `${name} is not a foreign key.`);
    const definition = normalizeDefinition(constraint.definition);
    for (const fragment of fragments) {
      invariant(definition.includes(fragment), `${name} has an unexpected scope.`);
    }
    invariant(definition.includes('on update restrict'), `${name} must block identity updates.`);
    invariant(definition.includes('on delete restrict'), `${name} must block parent deletion.`);
  }
}

async function assertTriggers(client) {
  const expected = new Map([
    ['GoodsReceiptCommitmentAllocation', [
      'GoodsReceiptCommitmentAllocation_insert_guard',
      'GoodsReceiptCommitmentAllocation_append_only',
      'GoodsReceiptCommitmentAllocation_no_truncate',
    ]],
    ['GoodsReceipt', ['GoodsReceipt_status_transition_guard']],
    ['GoodsReceiptLine', ['GoodsReceiptLine_allocation_guard']],
    ['SupplierCommitmentLine', ['SupplierCommitmentLine_allocation_guard']],
  ]);
  const result = await client.query(
    `SELECT relation_record.relname AS table_name,
            trigger_record.tgname,
            trigger_record.tgenabled,
            pg_get_triggerdef(trigger_record.oid, true) AS definition
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND NOT trigger_record.tgisinternal`,
  );
  const byTable = new Map();
  for (const row of result.rows) {
    byTable.set(`${row.table_name}:${row.tgname}`, row);
  }
  for (const [table, triggers] of expected) {
    for (const name of triggers) {
      const trigger = byTable.get(`${table}:${name}`);
      invariant(trigger, `${name} is missing.`);
      invariant(trigger.tgenabled === 'A', `${name} is not ENABLE ALWAYS.`);
    }
  }
}

async function assertTriggerFunctions(client) {
  const names = [
    'obrasaas_goods_receipt_commitment_allocation_guard',
    'obrasaas_goods_receipt_commitment_allocation_append_only',
    'obrasaas_goods_receipt_status_transition_guard',
    'obrasaas_allocated_goods_receipt_line_guard',
    'obrasaas_allocated_supplier_commitment_line_guard',
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
  invariant(result.rowCount === names.length, 'Allocation trigger functions are incomplete.');
  const byName = new Map(result.rows.map((row) => [row.proname, row]));
  for (const name of names) {
    invariant(
      (byName.get(name)?.proconfig || []).includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
  }
  const guard = normalizeDefinition(
    byName.get('obrasaas_goods_receipt_commitment_allocation_guard')?.definition,
  );
  for (const fragment of [
    'pg_advisory_xact_lock',
    'hashtextextended(new.projectid, 0)',
    "receipt_status <> 'posted'",
    "commitment_kind <> 'material_delivery'",
    "commitment_status = 'cancelled'",
    'sum(allocation.quantity)',
    "receipt.status = ''posted''",
    'receipt_allocated + new.quantity > receipt_line_quantity',
    'commitment_allocated + new.quantity > commitment_line_quantity',
  ]) {
    invariant(guard.includes(fragment), `Allocation guard is missing invariant: ${fragment}.`);
  }
  for (const name of [
    'obrasaas_allocated_goods_receipt_line_guard',
    'obrasaas_allocated_supplier_commitment_line_guard',
  ]) {
    const lineGuard = normalizeDefinition(byName.get(name)?.definition);
    invariant(
      lineGuard.includes('pg_advisory_xact_lock')
        && lineGuard.includes('hashtextextended(old.projectid, 0)'),
      `${name} must serialize with allocation inserts.`,
    );
  }
  const receiptStatusGuard = normalizeDefinition(
    byName.get('obrasaas_goods_receipt_status_transition_guard')?.definition,
  );
  invariant(
    receiptStatusGuard.includes('pg_advisory_xact_lock')
      && receiptStatusGuard.includes('hashtextextended(old.projectid, 0)')
      && receiptStatusGuard.includes("old.status = 'posted'")
      && receiptStatusGuard.includes("new.status = 'voided'"),
    'GoodsReceipt status transition guard must serialize and keep VOIDED terminal.',
  );
}

async function expectSqlFailure(client, callback, { code, message }, label) {
  await client.query('SAVEPOINT goods_receipt_allocation_verifier_case');
  let failure = null;
  try {
    await callback();
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT goods_receipt_allocation_verifier_case');
  await client.query('RELEASE SAVEPOINT goods_receipt_allocation_verifier_case');
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with SQLSTATE ${failure.code || 'unknown'}.`);
  invariant(String(failure.message || '').includes(message), `${label} failed for an unexpected reason.`);
}

async function insertAllocation(client, fixture, overrides = {}) {
  const values = {
    id: `allocation_${randomUUID()}`,
    organizationId: fixture.organizationId,
    projectId: fixture.projectId,
    purchaseOrderId: fixture.purchaseOrderId,
    purchaseOrderLineId: fixture.purchaseOrderLineId,
    goodsReceiptId: fixture.goodsReceiptId,
    goodsReceiptLineId: fixture.goodsReceiptLineId,
    supplierCommitmentId: fixture.supplierCommitmentId,
    quantity: '4.000',
    operationKey: `verify-allocation-${randomUUID()}`,
    requestFingerprint: 'a'.repeat(64),
    createdById: 'migration-verifier',
    ...overrides,
  };
  return client.query(
    `INSERT INTO "GoodsReceiptCommitmentAllocation" (
       "id", "organizationId", "projectId", "purchaseOrderId",
       "purchaseOrderLineId", "goodsReceiptId", "goodsReceiptLineId",
       "supplierCommitmentId", "quantity", "operationKey", "requestFingerprint", "createdById"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10, $11, $12)`,
    [
      values.id,
      values.organizationId,
      values.projectId,
      values.purchaseOrderId,
      values.purchaseOrderLineId,
      values.goodsReceiptId,
      values.goodsReceiptLineId,
      values.supplierCommitmentId,
      values.quantity,
      values.operationKey,
      values.requestFingerprint,
      values.createdById,
    ],
  );
}

async function createFixture(client) {
  const suffix = randomUUID();
  const fixture = {
    organizationId: `allocation_verify_org_${suffix}`,
    otherOrganizationId: `allocation_verify_other_org_${suffix}`,
    projectId: `allocation_verify_project_${suffix}`,
    otherProjectId: `allocation_verify_other_project_${suffix}`,
    supplierId: `allocation_verify_supplier_${suffix}`,
    purchaseOrderId: `allocation_verify_order_${suffix}`,
    purchaseOrderLineId: `allocation_verify_order_line_${suffix}`,
    goodsReceiptId: `allocation_verify_receipt_${suffix}`,
    goodsReceiptLineId: `allocation_verify_receipt_line_${suffix}`,
    secondGoodsReceiptId: `allocation_verify_receipt_second_${suffix}`,
    secondGoodsReceiptLineId: `allocation_verify_receipt_line_second_${suffix}`,
    supplierCommitmentId: `allocation_verify_commitment_${suffix}`,
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Allocation verifier', $2, CURRENT_TIMESTAMP),
            ($3, 'Allocation verifier other', $4, CURRENT_TIMESTAMP)`,
    [
      fixture.organizationId,
      `allocation-verifier-${suffix}`,
      fixture.otherOrganizationId,
      `allocation-verifier-other-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
     VALUES ($1, $2, 'Allocation project', $3, CURRENT_TIMESTAMP),
            ($4, $5, 'Allocation other project', $6, CURRENT_TIMESTAMP)`,
    [
      fixture.projectId,
      fixture.organizationId,
      `allocation-project-${suffix}`,
      fixture.otherProjectId,
      fixture.otherOrganizationId,
      `allocation-other-project-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Supplier" ("id", "organizationId", "legalName", "updatedAt")
     VALUES ($1, $2, 'Allocation supplier', CURRENT_TIMESTAMP)`,
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
      `allocation-order-${suffix}`,
      `VERIFY-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "PurchaseOrderLine" (
       "id", "purchaseOrderId", "projectId", "description", "unit", "quantity", "unitPrice"
     ) VALUES ($1, $2, $3, 'Verifier material', 'u', 5.000, 1.00)`,
    [fixture.purchaseOrderLineId, fixture.purchaseOrderId, fixture.projectId],
  );
  await client.query(
    `INSERT INTO "GoodsReceipt" (
       "id", "organizationId", "projectId", "purchaseOrderId", "operationKey",
       "status", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'POSTED', CURRENT_TIMESTAMP),
              ($6, $2, $3, $4, $7, 'POSTED', CURRENT_TIMESTAMP)`,
    [
      fixture.goodsReceiptId,
      fixture.organizationId,
      fixture.projectId,
      fixture.purchaseOrderId,
      `allocation-receipt-${suffix}`,
      fixture.secondGoodsReceiptId,
      `allocation-receipt-second-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "GoodsReceiptLine" (
       "id", "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "quantity"
     ) VALUES ($1, $2, $3, $4, $5, 5.000),
              ($6, $2, $3, $7, $5, 5.000)`,
    [
      fixture.goodsReceiptLineId,
      fixture.projectId,
      fixture.purchaseOrderId,
      fixture.goodsReceiptId,
      fixture.purchaseOrderLineId,
      fixture.secondGoodsReceiptLineId,
      fixture.secondGoodsReceiptId,
    ],
  );
  await client.query(
    `INSERT INTO "SupplierCommitment" (
       "id", "organizationId", "projectId", "supplierId", "purchaseOrderId",
       "operationKey", "requestFingerprint", "kind", "status", "title",
       "startsOn", "endsOn", "timezone", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'MATERIAL_DELIVERY', 'CONFIRMED',
       'Allocation verifier commitment', CURRENT_DATE, CURRENT_DATE,
       'America/Argentina/Buenos_Aires', CURRENT_TIMESTAMP)`,
    [
      fixture.supplierCommitmentId,
      fixture.organizationId,
      fixture.projectId,
      fixture.supplierId,
      fixture.purchaseOrderId,
      `allocation-commitment-${suffix}`,
      'b'.repeat(64),
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
  return fixture;
}

async function assertRollbackOnlySmoke(client) {
  const fixture = await createFixture(client);
  const allocationId = `allocation_valid_${randomUUID()}`;
  await insertAllocation(client, fixture, { id: allocationId });

  await expectSqlFailure(
    client,
    () => insertAllocation(client, fixture, {
      organizationId: fixture.otherOrganizationId,
      operationKey: `cross-scope-${randomUUID()}`,
      quantity: '0.001',
    }),
    { code: '23503', message: 'scope is invalid' },
    'cross-tenant allocation',
  );
  await expectSqlFailure(
    client,
    () => insertAllocation(client, fixture, {
      operationKey: `receipt-excess-${randomUUID()}`,
      quantity: '1.001',
    }),
    { code: '23514', message: 'exceeds receipt line quantity' },
    'receipt line excess by 0.001',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceiptCommitmentAllocation" SET "quantity" = 3.999 WHERE "id" = $1`,
      [allocationId],
    ),
    { code: '55000', message: 'append-only' },
    'allocation UPDATE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query('DELETE FROM "GoodsReceiptCommitmentAllocation" WHERE "id" = $1', [allocationId]),
    { code: '55000', message: 'append-only' },
    'allocation DELETE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query('TRUNCATE TABLE "GoodsReceiptCommitmentAllocation" CASCADE'),
    { code: '55000', message: 'append-only' },
    'allocation TRUNCATE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      'UPDATE "GoodsReceiptLine" SET "quantity" = 6.000 WHERE "id" = $1',
      [fixture.goodsReceiptLineId],
    ),
    { code: '55000', message: 'identity and quantity are immutable' },
    'allocated receipt line mutation',
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "SupplierCommitmentLine"
          SET "quantity" = 6.000
        WHERE "commitmentId" = $1 AND "purchaseOrderLineId" = $2`,
      [fixture.supplierCommitmentId, fixture.purchaseOrderLineId],
    ),
    { code: '55000', message: 'identity and quantity are immutable' },
    'allocated commitment line mutation',
  );

  await client.query(
    `UPDATE "GoodsReceipt" SET "status" = 'VOIDED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
    [fixture.goodsReceiptId],
  );
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "GoodsReceipt" SET "status" = 'POSTED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [fixture.goodsReceiptId],
    ),
    { code: '55000', message: 'status transition is invalid' },
    'VOIDED receipt reactivation',
  );
  await insertAllocation(client, fixture, {
    id: `allocation_after_void_${randomUUID()}`,
    goodsReceiptId: fixture.secondGoodsReceiptId,
    goodsReceiptLineId: fixture.secondGoodsReceiptLineId,
    operationKey: `after-void-${randomUUID()}`,
    quantity: '5.000',
  });
  await expectSqlFailure(
    client,
    () => insertAllocation(client, fixture, {
      operationKey: `void-target-${randomUUID()}`,
      quantity: '0.001',
    }),
    { code: '55000', message: 'requires a POSTED receipt' },
    'VOIDED receipt target',
  );
}

async function assertTwoConnectionAdvisorySerialization() {
  const first = new pg.Client({
    connectionString: verifierConnectionString,
    application_name: 'obrasaas-allocation-lock-verifier-a',
    statement_timeout: 15_000,
    query_timeout: 20_000,
  });
  const second = new pg.Client({
    connectionString: verifierConnectionString,
    application_name: 'obrasaas-allocation-lock-verifier-b',
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
    const key = `allocation_concurrency_${randomUUID()}`;
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
    invariant(acquired.rows[0]?.acquired === true, 'The advisory lock was not released at transaction end.');
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
  application_name: 'obrasaas-goods-receipt-allocation-migration-verifier',
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

let connected = false;
let transactionOpen = false;
try {
  try {
    await client.connect();
    connected = true;
  } catch {
    throw new Error('Unable to connect to the dedicated goods receipt allocation verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured goods receipt allocation schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigration(client);
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
    `Verified ${MIGRATION}: exact checksum/catalog, scoped reconciliation, 0.001 over-allocation rejection, append-only guards and two-connection advisory serialization.`,
  );
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  if (connected) await client.end();
}
