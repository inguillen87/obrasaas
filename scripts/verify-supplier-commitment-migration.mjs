import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'SUPPLIER_COMMITMENT_MIGRATION_SCHEMA';
const MIGRATION = '20260801090000_supplier_commitments_and_calendar';
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
    throw new Error(
      `Declare ${SCHEMA_ENV} or add an explicit schema parameter to the database URL.`,
    );
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(
      'The supplier commitment migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
    );
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
    throw new Error(
      `${CONNECTION_ENV} must use sslmode=verify-full for a remote PostgreSQL host.`,
    );
  }
  return parsed.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function normalizeDefinition(value) {
  return String(value || '')
    .replace(/::(?:(?:"[^"]+")|[A-Za-z_][A-Za-z0-9_.$]*)(?:\[\])?/g, '')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
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

const TABLES = Object.freeze([
  'SupplierCommitment',
  'SupplierCommitmentLine',
  'SupplierCommitmentTaskLink',
  'SupplierCommitmentEvent',
  'SupplierReminderDelivery',
  'SupplierReminderWebhookEvent',
  'SupplierReminderWebhookApplication',
]);

const EXPECTED_ENUMS = Object.freeze({
  SupplierCommitmentKind: ['MATERIAL_DELIVERY', 'SERVICE_EXECUTION'],
  SupplierCommitmentStatus: ['TENTATIVE', 'CONFIRMED', 'AT_RISK', 'FULFILLED', 'CANCELLED'],
  SupplierCommitmentTaskRelation: ['REQUIRED_BEFORE_START', 'EXECUTES_TASK'],
  SupplierCommitmentEventType: [
    'CREATED',
    'CONFIRMED',
    'RESCHEDULED',
    'MARKED_AT_RISK',
    'FULFILLED',
    'CANCELLED',
  ],
  SupplierReminderDeliveryStatus: [
    'PENDING',
    'CLAIMED',
    'DISPATCHING',
    'PROVIDER_ACCEPTED',
    'DELIVERY_DELAYED',
    'DELIVERED',
    'FAILED',
    'DEAD_LETTER',
    'CANCELLED',
    'UNCERTAIN',
    'CONFLICT',
    'BOUNCED',
    'COMPLAINED',
    'DELIVERY_FAILED',
    'SUPPRESSED',
  ],
  SupplierReminderKind: ['UPCOMING', 'LATE_SCHEDULED', 'RESCHEDULED', 'CANCELLED'],
});

const EXPECTED_CHECKS = Object.freeze({
  Task_canonical_startsAt_civil_check: {
    table: 'Task',
    fragments: [
      "metadata ->> 'source' is distinct from 'canonical-task-v1'",
      'startsAt is null',
      "startsAt = date_trunc'day', startsAt",
    ],
  },
  Task_canonical_endsAt_civil_check: {
    table: 'Task',
    fragments: [
      "metadata ->> 'source' is distinct from 'canonical-task-v1'",
      'endsAt is null',
      "endsAt = date_trunc'day', endsAt",
    ],
  },
  SupplierCommitment_dates_check: {
    table: 'SupplierCommitment', fragments: ['startsOn <= endsOn'],
  },
  SupplierCommitment_revision_check: {
    table: 'SupplierCommitment', fragments: ['revision >= 0'],
  },
  SupplierCommitment_schedule_revision_check: {
    table: 'SupplierCommitment', fragments: ['scheduleRevision >= 0'],
  },
  SupplierCommitment_reminder_days_check: {
    table: 'SupplierCommitment', fragments: ['reminderDaysBefore >= 1', 'reminderDaysBefore <= 30'],
  },
  SupplierCommitment_reminder_bundle_check: {
    table: 'SupplierCommitment',
    fragments: [
      'not reminderEnabled',
      'reminderEmail is not null',
      'reminderEmailConfirmedAt is not null',
      'reminderEmailConfirmedById is not null',
    ],
  },
  SupplierCommitment_fulfilled_bundle_check: {
    table: 'SupplierCommitment', fragments: ["status = 'fulfilled'", 'fulfilledAt is not null'],
  },
  SupplierCommitmentLine_quantity_check: {
    table: 'SupplierCommitmentLine', fragments: ['quantity > 0'],
  },
  SupplierCommitmentEvent_sequence_check: {
    table: 'SupplierCommitmentEvent', fragments: ['sequence >= 0'],
  },
  SupplierReminderDelivery_attempts_check: {
    table: 'SupplierReminderDelivery', fragments: ['attempts >= 0'],
  },
  SupplierReminderDelivery_revision_check: {
    table: 'SupplierReminderDelivery', fragments: ['scheduleRevision >= 0'],
  },
  SupplierReminderDelivery_lease_bundle_check: {
    table: 'SupplierReminderDelivery',
    fragments: ["status = any array['claimed'", "'dispatching'", 'leasedAt is not null'],
  },
  SupplierReminderDelivery_provider_bundle_check: {
    table: 'SupplierReminderDelivery',
    fragments: [
      "status <> all array['provider_accepted'",
      "'delivery_delayed'",
      "'delivered'",
      "'bounced'",
      "'complained'",
      "'delivery_failed'",
      "'suppressed'",
      'provider is not null',
      'providerMessageId is not null',
      'providerStatusAt is not null',
      'sentAt is not null',
    ],
  },
});

const EXPECTED_FOREIGN_KEYS = Object.freeze({
  PurchaseOrder_project_fkey: {
    table: 'PurchaseOrder', target: 'Project', columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'], deleteAction: 'c',
  },
  PurchaseOrderLine_order_fkey: {
    table: 'PurchaseOrderLine', target: 'PurchaseOrder', columns: ['projectId', 'purchaseOrderId'], targetColumns: ['projectId', 'id'], deleteAction: 'c',
  },
  SupplierInvoice_project_fkey: {
    table: 'SupplierInvoice', target: 'Project', columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'], deleteAction: 'c',
  },
  SupplierInvoice_order_fkey: {
    table: 'SupplierInvoice', target: 'PurchaseOrder', columns: ['organizationId', 'projectId', 'supplierId', 'purchaseOrderId'], targetColumns: ['organizationId', 'projectId', 'supplierId', 'id'], deleteAction: 'r',
  },
  GoodsReceipt_organization_fkey: {
    table: 'GoodsReceipt', target: 'Organization', columns: ['organizationId'], targetColumns: ['id'], deleteAction: 'c',
  },
  GoodsReceipt_project_fkey: {
    table: 'GoodsReceipt', target: 'Project', columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'], deleteAction: 'c',
  },
  GoodsReceipt_order_fkey: {
    table: 'GoodsReceipt', target: 'PurchaseOrder', columns: ['organizationId', 'projectId', 'purchaseOrderId'], targetColumns: ['organizationId', 'projectId', 'id'], deleteAction: 'r',
  },
  GoodsReceiptLine_receipt_fkey: {
    table: 'GoodsReceiptLine', target: 'GoodsReceipt', columns: ['projectId', 'purchaseOrderId', 'goodsReceiptId'], targetColumns: ['projectId', 'purchaseOrderId', 'id'], deleteAction: 'c',
  },
  GoodsReceiptLine_orderLine_fkey: {
    table: 'GoodsReceiptLine', target: 'PurchaseOrderLine', columns: ['projectId', 'purchaseOrderId', 'purchaseOrderLineId'], targetColumns: ['projectId', 'purchaseOrderId', 'id'], deleteAction: 'r',
  },
  SupplierCommitment_organization_fkey: {
    table: 'SupplierCommitment', target: 'Organization', columns: ['organizationId'], targetColumns: ['id'], deleteAction: 'c',
  },
  SupplierCommitment_project_fkey: {
    table: 'SupplierCommitment', target: 'Project', columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'], deleteAction: 'c',
  },
  SupplierCommitment_supplier_fkey: {
    table: 'SupplierCommitment', target: 'Supplier', columns: ['organizationId', 'supplierId'], targetColumns: ['organizationId', 'id'], deleteAction: 'r',
  },
  SupplierCommitment_purchaseOrder_fkey: {
    table: 'SupplierCommitment', target: 'PurchaseOrder', columns: ['organizationId', 'projectId', 'supplierId', 'purchaseOrderId'], targetColumns: ['organizationId', 'projectId', 'supplierId', 'id'], deleteAction: 'r',
  },
  SupplierCommitmentLine_commitment_fkey: {
    table: 'SupplierCommitmentLine', target: 'SupplierCommitment', columns: ['projectId', 'purchaseOrderId', 'commitmentId'], targetColumns: ['projectId', 'purchaseOrderId', 'id'], deleteAction: 'c',
  },
  SupplierCommitmentLine_purchaseOrderLine_fkey: {
    table: 'SupplierCommitmentLine', target: 'PurchaseOrderLine', columns: ['projectId', 'purchaseOrderId', 'purchaseOrderLineId'], targetColumns: ['projectId', 'purchaseOrderId', 'id'], deleteAction: 'r',
  },
  SupplierCommitmentTaskLink_commitment_fkey: {
    table: 'SupplierCommitmentTaskLink', target: 'SupplierCommitment', columns: ['projectId', 'commitmentId'], targetColumns: ['projectId', 'id'], deleteAction: 'c',
  },
  SupplierCommitmentTaskLink_task_fkey: {
    table: 'SupplierCommitmentTaskLink', target: 'Task', columns: ['projectId', 'taskId'], targetColumns: ['projectId', 'id'], deleteAction: 'r',
  },
  SupplierCommitmentEvent_commitment_fkey: {
    table: 'SupplierCommitmentEvent', target: 'SupplierCommitment', columns: ['organizationId', 'projectId', 'commitmentId'], targetColumns: ['organizationId', 'projectId', 'id'], deleteAction: 'c',
  },
  SupplierReminderDelivery_organization_fkey: {
    table: 'SupplierReminderDelivery', target: 'Organization', columns: ['organizationId'], targetColumns: ['id'], deleteAction: 'c',
  },
  SupplierReminderDelivery_project_fkey: {
    table: 'SupplierReminderDelivery', target: 'Project', columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'], deleteAction: 'c',
  },
  SupplierReminderDelivery_commitment_fkey: {
    table: 'SupplierReminderDelivery', target: 'SupplierCommitment', columns: ['organizationId', 'projectId', 'commitmentId'], targetColumns: ['organizationId', 'projectId', 'id'], deleteAction: 'c',
  },
  SupplierReminderWebhookApplication_event_fkey: {
    table: 'SupplierReminderWebhookApplication', target: 'SupplierReminderWebhookEvent', columns: ['eventId'], targetColumns: ['id'], deleteAction: 'r',
  },
  SupplierReminderWebhookApplication_delivery_fkey: {
    table: 'SupplierReminderWebhookApplication', target: 'SupplierReminderDelivery', columns: ['organizationId', 'projectId', 'deliveryId'], targetColumns: ['organizationId', 'projectId', 'id'], deleteAction: 'c',
  },
});

const EXPECTED_TRIGGERS = Object.freeze({
  SupplierCommitment_revision_guard: {
    table: 'SupplierCommitment', type: 23, functionName: 'obrasaas_supplier_commitment_revision_guard',
  },
  SupplierCommitment_event_guard: {
    table: 'SupplierCommitment', type: 21, functionName: 'obrasaas_supplier_commitment_event_guard', constraint: true,
  },
  SupplierCommitmentEvent_append_only: {
    table: 'SupplierCommitmentEvent', type: 27, functionName: 'obrasaas_supplier_commitment_event_append_only',
  },
  SupplierCommitmentEvent_no_truncate: {
    table: 'SupplierCommitmentEvent', type: 34, functionName: 'obrasaas_supplier_commitment_event_append_only',
  },
  SupplierReminderWebhookEvent_append_only: {
    table: 'SupplierReminderWebhookEvent', type: 27, functionName: 'obrasaas_supplier_commitment_event_append_only',
  },
  SupplierReminderWebhookEvent_no_truncate: {
    table: 'SupplierReminderWebhookEvent', type: 34, functionName: 'obrasaas_supplier_commitment_event_append_only',
  },
  SupplierReminderWebhookApplication_append_only: {
    table: 'SupplierReminderWebhookApplication', type: 27, functionName: 'obrasaas_supplier_commitment_event_append_only',
  },
  SupplierReminderWebhookApplication_no_truncate: {
    table: 'SupplierReminderWebhookApplication', type: 34, functionName: 'obrasaas_supplier_commitment_event_append_only',
  },
  SupplierReminderDelivery_no_delete: {
    table: 'SupplierReminderDelivery', type: 11, functionName: 'obrasaas_supplier_reminder_no_delete',
  },
  SupplierReminderDelivery_no_truncate: {
    table: 'SupplierReminderDelivery', type: 34, functionName: 'obrasaas_supplier_reminder_no_delete',
  },
  SupplierReminderDelivery_transition_guard: {
    table: 'SupplierReminderDelivery', type: 19, functionName: 'obrasaas_supplier_reminder_transition_guard',
  },
});

const EXPECTED_TRIGGER_FUNCTIONS = Object.freeze({
  obrasaas_supplier_commitment_revision_guard: [
    'new.revision <> old.revision + 1',
    'suppliercommitment immutable identity changed',
    'suppliercommitment schedule changes require one schedule revision',
    'suppliercommitment status transition is invalid',
    'suppliercommitment must start at revision zero',
    '55000',
  ],
  obrasaas_supplier_commitment_event_guard: [
    'next_expected := jsonb_build_object',
    'previous_expected := jsonb_build_object',
    'tg_table_schema',
    'event.nextstate = $5',
    'event.previousstate is not distinct from $6',
    'suppliercommitment revision requires an immutable event',
    '55000',
  ],
  obrasaas_supplier_commitment_event_append_only: [
    'suppliercommitmentevent is append-only',
    '55000',
  ],
  obrasaas_supplier_reminder_no_delete: [
    'supplierreminderdelivery cannot be deleted or truncated',
    '55000',
  ],
  obrasaas_supplier_reminder_transition_guard: [
    'supplierreminderdelivery immutable dispatch data changed',
    'supplierreminderdelivery provider identity is immutable once assigned',
    "old.status = 'dispatching'",
    "new.status in 'provider_accepted', 'failed', 'dead_letter', 'uncertain', 'conflict', 'cancelled'",
    'supplierreminderdelivery transition is invalid',
    '55000',
  ],
});

async function assertMigration(client) {
  const table = await client.query("SELECT to_regclass(format('%I.%I', current_schema(), '_prisma_migrations')) AS name");
  invariant(table.rows[0]?.name, 'The configured schema has no _prisma_migrations table.');
  const result = await client.query(
    `SELECT "migration_name", "checksum"
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

async function assertTables(client) {
  const result = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = ANY($1::text[])
      ORDER BY tablename`,
    [TABLES],
  );
  const expected = [...TABLES].sort();
  const actual = result.rows.map((row) => row.tablename);
  invariant(sameValues(actual, expected), 'Supplier commitment table catalog is incomplete.');
}

async function assertEnums(client) {
  const result = await client.query(
    `SELECT type_record.typname,
            array_agg(enum_record.enumlabel::text ORDER BY enum_record.enumsortorder) AS labels
       FROM pg_type AS type_record
       JOIN pg_enum AS enum_record ON enum_record.enumtypid = type_record.oid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = type_record.typnamespace
      WHERE namespace_record.nspname = current_schema()
        AND type_record.typname = ANY($1::text[])
      GROUP BY type_record.typname`,
    [Object.keys(EXPECTED_ENUMS)],
  );
  invariant(result.rowCount === Object.keys(EXPECTED_ENUMS).length, 'Supplier commitment enum catalog is incomplete.');
  const actual = new Map(result.rows.map((row) => [row.typname, row.labels]));
  for (const [name, labels] of Object.entries(EXPECTED_ENUMS)) {
    invariant(sameValues(actual.get(name) || [], labels), `${name} does not match its governed enum contract.`);
  }
}

async function assertScopeRepairColumns(client) {
  const result = await client.query(
    `SELECT table_name, column_name, is_nullable, data_type, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name, column_name) IN (
          ('Supplier', 'email'),
          ('GoodsReceipt', 'organizationId'),
          ('GoodsReceiptLine', 'projectId'),
          ('GoodsReceiptLine', 'purchaseOrderId')
        )`,
  );
  const columns = new Map(result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
  invariant(
    columns.get('Supplier.email')?.data_type === 'character varying'
      && Number(columns.get('Supplier.email')?.character_maximum_length) === 254,
    'Supplier.email is not VARCHAR(254).',
  );
  for (const name of [
    'GoodsReceipt.organizationId',
    'GoodsReceiptLine.projectId',
    'GoodsReceiptLine.purchaseOrderId',
  ]) {
    invariant(columns.get(name)?.is_nullable === 'NO', `${name} tenant scope repair is missing.`);
  }
}

async function assertChecks(client) {
  const names = Object.keys(EXPECTED_CHECKS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            relation_record.relname AS table_name,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Supplier commitment CHECK catalog is incomplete or ambiguous.');
  const checks = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_CHECKS)) {
    const check = checks.get(name);
    invariant(check?.table_name === expected.table, `${name} is missing or attached to the wrong table.`);
    invariant(check.contype === 'c' && check.convalidated, `${name} is not a validated CHECK constraint.`);
    invariant(!check.condeferrable, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of expected.fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed invariant: ${fragment}.`,
      );
    }
  }
}

async function assertForeignKeys(client) {
  const names = Object.keys(EXPECTED_FOREIGN_KEYS);
  const result = await client.query(
    `SELECT constraint_record.conname,
            source_relation.relname AS table_name,
            target_relation.relname AS target_table,
            constraint_record.contype,
            constraint_record.convalidated,
            constraint_record.condeferrable,
            constraint_record.condeferred,
            constraint_record.confdeltype,
            constraint_record.confupdtype,
            constraint_record.confmatchtype,
            ARRAY(
              SELECT source_attribute.attname::text
                FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS source_attribute
                  ON source_attribute.attrelid = constraint_record.conrelid
                 AND source_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS source_columns,
            ARRAY(
              SELECT target_attribute.attname::text
                FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS target_attribute
                  ON target_attribute.attrelid = constraint_record.confrelid
                 AND target_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS target_columns
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS source_relation ON source_relation.oid = constraint_record.conrelid
       JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_relation.relnamespace
       JOIN pg_class AS target_relation ON target_relation.oid = constraint_record.confrelid
      WHERE source_namespace.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Supplier commitment foreign-key catalog is incomplete or ambiguous.');
  const foreignKeys = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_FOREIGN_KEYS)) {
    const foreignKey = foreignKeys.get(name);
    invariant(foreignKey?.table_name === expected.table, `${name} is missing or attached to the wrong table.`);
    invariant(foreignKey.target_table === expected.target, `${name} references the wrong table.`);
    invariant(foreignKey.contype === 'f' && foreignKey.convalidated, `${name} is not a validated foreign key.`);
    invariant(!foreignKey.condeferrable && !foreignKey.condeferred, `${name} must remain immediate.`);
    invariant(foreignKey.confdeltype === expected.deleteAction, `${name} has an unexpected delete action.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(foreignKey.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertTriggers(client) {
  const names = Object.keys(EXPECTED_TRIGGERS);
  const result = await client.query(
    `SELECT trigger_record.tgname,
            relation_record.relname AS table_name,
            trigger_record.tgenabled,
            trigger_record.tgtype::integer AS trigger_type,
            procedure_record.proname AS function_name,
            trigger_record.tgconstraint <> 0 AS is_constraint,
            constraint_record.condeferrable,
            constraint_record.condeferred
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
       JOIN pg_proc AS procedure_record ON procedure_record.oid = trigger_record.tgfoid
       LEFT JOIN pg_constraint AS constraint_record ON constraint_record.oid = trigger_record.tgconstraint
      WHERE namespace_record.nspname = current_schema()
        AND relation_record.relname = ANY($1::text[])
        AND NOT trigger_record.tgisinternal`,
    [TABLES],
  );
  invariant(result.rowCount === names.length, 'Supplier commitment trigger catalog has missing or unexpected entries.');
  const triggers = new Map(result.rows.map((row) => [row.tgname, row]));
  invariant(triggers.size === names.length, 'Supplier commitment trigger names are ambiguous.');
  for (const [name, expected] of Object.entries(EXPECTED_TRIGGERS)) {
    const trigger = triggers.get(name);
    invariant(trigger?.table_name === expected.table, `${name} is missing or attached to the wrong table.`);
    invariant(trigger.tgenabled === 'A', `${name} must be ENABLE ALWAYS.`);
    invariant(Number(trigger.trigger_type) === expected.type, `${name} protects the wrong events.`);
    invariant(trigger.function_name === expected.functionName, `${name} invokes the wrong function.`);
    invariant(trigger.is_constraint === Boolean(expected.constraint), `${name} has the wrong trigger class.`);
    if (expected.constraint) {
      invariant(trigger.condeferrable && trigger.condeferred, `${name} must be deferred until commit.`);
    }
  }
}

async function assertTriggerFunctions(client) {
  const names = Object.keys(EXPECTED_TRIGGER_FUNCTIONS);
  const result = await client.query(
    `SELECT procedure_record.proname,
            procedure_record.prosecdef,
            procedure_record.provolatile,
            procedure_record.proconfig,
            format_type(procedure_record.prorettype, NULL) AS return_type,
            pg_get_functiondef(procedure_record.oid) AS definition
       FROM pg_proc AS procedure_record
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = procedure_record.pronamespace
      WHERE namespace_record.nspname = current_schema()
        AND procedure_record.proname = ANY($1::text[])
        AND procedure_record.pronargs = 0`,
    [names],
  );
  invariant(result.rowCount === names.length, 'Supplier commitment trigger-function catalog is incomplete or ambiguous.');
  const functions = new Map(result.rows.map((row) => [row.proname, row]));
  for (const [name, fragments] of Object.entries(EXPECTED_TRIGGER_FUNCTIONS)) {
    const procedure = functions.get(name);
    invariant(procedure?.return_type === 'trigger', `${name} is missing or does not return trigger.`);
    invariant(!procedure.prosecdef, `${name} must not run as SECURITY DEFINER.`);
    invariant(procedure.provolatile === 'v', `${name} must remain VOLATILE.`);
    invariant(
      procedure.proconfig?.includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
    const definition = normalizeDefinition(procedure.definition);
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed function invariant: ${fragment}.`,
      );
    }
  }
}

async function expectSqlFailure(client, callback, { code, message }, label) {
  await client.query('SAVEPOINT supplier_commitment_verifier_case');
  let failure = null;
  try {
    await callback();
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT supplier_commitment_verifier_case');
  await client.query('RELEASE SAVEPOINT supplier_commitment_verifier_case');
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with unexpected SQLSTATE ${failure.code || 'unknown'}.`);
  invariant(String(failure.message || '').includes(message), `${label} failed for an unexpected reason.`);
}

async function assertRollbackOnlySmoke(client) {
  const eventId = `supplier_commitment_verify_${randomUUID()}`;
  await client.query(
    `INSERT INTO "SupplierReminderWebhookEvent"
      ("id", "providerMessageId", "type", "occurredAt", "payloadHash")
     VALUES ($1, $2, 'email.sent', CURRENT_TIMESTAMP, $3)`,
    [eventId, `provider_${eventId}`, '0'.repeat(64)],
  );
  const expected = { code: '55000', message: 'append-only' };
  await expectSqlFailure(
    client,
    () => client.query(
      `UPDATE "SupplierReminderWebhookEvent" SET "payloadHash" = $2 WHERE "id" = $1`,
      [eventId, '1'.repeat(64)],
    ),
    expected,
    'SupplierReminderWebhookEvent UPDATE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query('DELETE FROM "SupplierReminderWebhookEvent" WHERE "id" = $1', [eventId]),
    expected,
    'SupplierReminderWebhookEvent DELETE append-only smoke',
  );
  await expectSqlFailure(
    client,
    () => client.query('TRUNCATE TABLE "SupplierReminderWebhookEvent" CASCADE'),
    expected,
    'SupplierReminderWebhookEvent TRUNCATE append-only smoke',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-supplier-commitment-migration-verifier',
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
    throw new Error('Unable to connect to the dedicated supplier commitment verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured supplier commitment migration schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigration(client);
  await assertTables(client);
  await assertEnums(client);
  await assertScopeRepairColumns(client);
  await assertChecks(client);
  await assertForeignKeys(client);
  await assertTriggers(client);
  await assertTriggerFunctions(client);
  await assertRollbackOnlySmoke(client);
  console.log(
    `Verified ${MIGRATION}: exact checksum/catalog, scoped procurement relations, ENABLE ALWAYS guards and rollback-only webhook immutability smoke.`,
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  if (connected) await client.end();
}
