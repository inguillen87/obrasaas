import { randomUUID } from 'node:crypto';

import pg from 'pg';

const CONNECTION_ENV = 'PROTECTED_UPLOAD_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'PROTECTED_UPLOAD_MIGRATION_SCHEMA';
const connectionString = process.env[CONNECTION_ENV];
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

if (!connectionString) {
  throw new Error(
    `${CONNECTION_ENV} is required; DATABASE_URL is intentionally ignored.`,
  );
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
    throw new Error(
      'The protected upload migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
    );
  }
  return schema;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
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

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function normalizeDefinition(value) {
  return String(value || '')
    .replace(/::(?:(?:"[^"]+")|[A-Za-z_][A-Za-z0-9_.$]*(?:\[\])?)/g, '')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260726170000_protected_upload_reservations',
]);

const EXPECTED_ENUMS = Object.freeze({
  ProtectedUploadPurpose: [
    'CASH_RECEIPT',
    'GOODS_RECEIPT',
    'SUPPLIER_INVOICE',
    'PROGRESS_EVIDENCE',
  ],
  ProtectedUploadStatus: [
    'UPLOADING',
    'AVAILABLE',
    'CLAIMED',
    'DELETE_PENDING',
    'DELETED',
  ],
});

const REQUIRED_TABLES = Object.freeze([
  'ProtectedUpload',
  'CashMovement',
  'GoodsReceipt',
  'SupplierInvoice',
  'ProgressEvidence',
  'Project',
  'PlatformUser',
]);

const EXPECTED_COLUMNS = Object.freeze({
  ProtectedUpload: {
    id: ['NO', 'text', 'text', null, null],
    organizationId: ['NO', 'text', 'text', null, null],
    projectId: ['NO', 'text', 'text', null, null],
    actorId: ['NO', 'text', 'text', null, null],
    purpose: ['NO', 'USER-DEFINED', 'ProtectedUploadPurpose', null, null],
    status: ['NO', 'USER-DEFINED', 'ProtectedUploadStatus', null, /'UPLOADING'/],
    operationKeyHash: ['NO', 'character', 'bpchar', 64, null],
    requestFingerprint: ['NO', 'character', 'bpchar', 64, null],
    storageProvider: ['NO', 'character varying', 'varchar', 32, null],
    storage: ['NO', 'jsonb', 'jsonb', null, null],
    mimeType: ['NO', 'character varying', 'varchar', 120, null],
    filename: ['NO', 'character varying', 'varchar', 255, null],
    size: ['NO', 'integer', 'int4', null, null],
    sha256: ['NO', 'character', 'bpchar', 64, null],
    expiresAt: ['NO', 'timestamp without time zone', 'timestamp', null, null],
    uploadAttemptCount: ['NO', 'integer', 'int4', null, /^1$/],
    uploadLeaseExpiresAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
    claimedAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
    claimedEntityType: ['YES', 'character varying', 'varchar', 64, null],
    claimedEntityId: ['YES', 'character varying', 'varchar', 190, null],
    claimFingerprint: ['YES', 'character', 'bpchar', 64, null],
    deleteOperationKeyHash: ['YES', 'character', 'bpchar', 64, null],
    deleteRequestFingerprint: ['YES', 'character', 'bpchar', 64, null],
    deleteRequestedAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
    deleteAttemptCount: ['NO', 'integer', 'int4', null, /^0$/],
    deleteLeaseExpiresAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
    nextDeleteAttemptAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
    deletedAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
    lastErrorCode: ['YES', 'character varying', 'varchar', 64, null],
    createdAt: ['NO', 'timestamp without time zone', 'timestamp', null, /^CURRENT_TIMESTAMP$/i],
    updatedAt: ['NO', 'timestamp without time zone', 'timestamp', null, null],
  },
  CashMovement: {
    protectedUploadId: ['YES', 'text', 'text', null, null],
    requestFingerprint: ['YES', 'character', 'bpchar', 64, null],
  },
  GoodsReceipt: {
    protectedUploadId: ['YES', 'text', 'text', null, null],
    requestFingerprint: ['YES', 'character', 'bpchar', 64, null],
  },
  SupplierInvoice: {
    protectedUploadId: ['YES', 'text', 'text', null, null],
    requestFingerprint: ['YES', 'character', 'bpchar', 64, null],
  },
  ProgressEvidence: {
    protectedUploadId: ['YES', 'text', 'text', null, null],
  },
});

const EXPECTED_CHECKS = Object.freeze({
  ProtectedUpload_hashes_check: {
    table: 'ProtectedUpload',
    fragments: [
      'operationKeyHash',
      'requestFingerprint',
      'sha256',
      'deleteOperationKeyHash',
      'deleteRequestFingerprint',
      'claimFingerprint',
      '^[0-9a-f]{64}$',
    ],
  },
  ProtectedUpload_metadata_check: {
    table: 'ProtectedUpload',
    fragments: [
      'jsonb_typeofstorage',
      'storageProvider',
      'vercel-blob',
      'cloudinary',
      'pathname',
      'publicId',
      '4194304',
      'uploadAttemptCount >= 1',
      'deleteAttemptCount >= 0',
      'lastErrorCode',
      'expiresAt > createdAt',
    ],
  },
  ProtectedUpload_purpose_media_check: {
    table: 'ProtectedUpload',
    fragments: [
      'CASH_RECEIPT',
      'GOODS_RECEIPT',
      'SUPPLIER_INVOICE',
      'PROGRESS_EVIDENCE',
      'application/pdf',
      'video/mp4',
      '4194304',
    ],
  },
  ProtectedUpload_claim_type_check: {
    table: 'ProtectedUpload',
    fragments: ['CashMovement', 'GoodsReceipt', 'SupplierInvoice', 'ProgressEvidence'],
  },
  ProtectedUpload_state_check: {
    table: 'ProtectedUpload',
    fragments: [
      'UPLOADING',
      'AVAILABLE',
      'CLAIMED',
      'DELETE_PENDING',
      'DELETED',
      'uploadLeaseExpiresAt IS NOT NULL',
      'uploadLeaseExpiresAt IS NULL',
      'deleteLeaseExpiresAt IS NULL',
      'nextDeleteAttemptAt IS NOT NULL',
      'nextDeleteAttemptAt IS NULL',
    ],
  },
  ProtectedUpload_state_timestamps_check: {
    table: 'ProtectedUpload',
    fragments: [
      'uploadLeaseExpiresAt >= createdAt',
      'claimedAt >= createdAt',
      'deleteRequestedAt >= createdAt',
      'deleteLeaseExpiresAt >= deleteRequestedAt',
      'nextDeleteAttemptAt >= deleteRequestedAt',
      'deletedAt >= deleteRequestedAt',
    ],
  },
  CashMovement_request_fingerprint_check: {
    table: 'CashMovement',
    fragments: ['requestFingerprint', '^[0-9a-f]{64}$'],
  },
  GoodsReceipt_request_fingerprint_check: {
    table: 'GoodsReceipt',
    fragments: ['requestFingerprint', '^[0-9a-f]{64}$'],
  },
  SupplierInvoice_request_fingerprint_check: {
    table: 'SupplierInvoice',
    fragments: ['requestFingerprint', '^[0-9a-f]{64}$'],
  },
});

const EXPECTED_INDEXES = Object.freeze({
  ProtectedUpload_pkey: {
    table: 'ProtectedUpload', columns: ['id'], unique: true, primary: true,
  },
  ProtectedUpload_projectId_id_key: {
    table: 'ProtectedUpload', columns: ['projectId', 'id'], unique: true,
  },
  ProtectedUpload_project_purpose_operation_key: {
    table: 'ProtectedUpload',
    columns: ['projectId', 'actorId', 'purpose', 'operationKeyHash'],
    unique: true,
  },
  ProtectedUpload_project_purpose_delete_key: {
    table: 'ProtectedUpload',
    columns: ['projectId', 'actorId', 'purpose', 'deleteOperationKeyHash'],
    unique: true,
  },
  ProtectedUpload_actor_project_active_idx: {
    table: 'ProtectedUpload',
    columns: ['projectId', 'actorId', 'status', 'expiresAt'],
    unique: false,
  },
  ProtectedUpload_project_active_idx: {
    table: 'ProtectedUpload',
    columns: ['projectId', 'status', 'expiresAt'],
    unique: false,
  },
  ProtectedUpload_org_created_idx: {
    table: 'ProtectedUpload', columns: ['organizationId', 'createdAt'], unique: false,
  },
  ProtectedUpload_expiry_cleanup_idx: {
    table: 'ProtectedUpload', columns: ['status', 'expiresAt', 'id'], unique: false,
  },
  ProtectedUpload_delete_cleanup_idx: {
    table: 'ProtectedUpload', columns: ['status', 'nextDeleteAttemptAt', 'id'], unique: false,
  },
  CashMovement_project_protected_upload_key: {
    table: 'CashMovement', columns: ['projectId', 'protectedUploadId'], unique: true,
  },
  GoodsReceipt_project_protected_upload_key: {
    table: 'GoodsReceipt', columns: ['projectId', 'protectedUploadId'], unique: true,
  },
  SupplierInvoice_project_protected_upload_key: {
    table: 'SupplierInvoice', columns: ['projectId', 'protectedUploadId'], unique: true,
  },
  ProgressEvidence_project_protected_upload_key: {
    table: 'ProgressEvidence', columns: ['projectId', 'protectedUploadId'], unique: true,
  },
});

const EXPECTED_FOREIGN_KEYS = Object.freeze({
  ProtectedUpload_project_scope_fkey: {
    table: 'ProtectedUpload',
    target: 'Project',
    columns: ['organizationId', 'projectId'],
    targetColumns: ['organizationId', 'id'],
    deleteAction: 'r',
  },
  ProtectedUpload_actorId_fkey: {
    table: 'ProtectedUpload',
    target: 'PlatformUser',
    columns: ['actorId'],
    targetColumns: ['id'],
    deleteAction: 'r',
  },
  CashMovement_protected_upload_fkey: {
    table: 'CashMovement',
    target: 'ProtectedUpload',
    columns: ['projectId', 'protectedUploadId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  GoodsReceipt_protected_upload_fkey: {
    table: 'GoodsReceipt',
    target: 'ProtectedUpload',
    columns: ['projectId', 'protectedUploadId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  SupplierInvoice_protected_upload_fkey: {
    table: 'SupplierInvoice',
    target: 'ProtectedUpload',
    columns: ['projectId', 'protectedUploadId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  ProgressEvidence_protected_upload_fkey: {
    table: 'ProgressEvidence',
    target: 'ProtectedUpload',
    columns: ['projectId', 'protectedUploadId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
});

async function assertMigrations(client) {
  const result = await client.query(
    `SELECT "migration_name"
       FROM "_prisma_migrations"
      WHERE "migration_name" = ANY($1::text[])
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL`,
    [EXPECTED_MIGRATIONS],
  );
  const applied = new Set(result.rows.map((row) => row.migration_name));
  const missing = EXPECTED_MIGRATIONS.filter((name) => !applied.has(name));
  invariant(missing.length === 0, `Missing protected upload migrations: ${missing.join(', ')}.`);
}

async function assertTables(client) {
  const result = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = ANY($1::text[])`,
    [REQUIRED_TABLES],
  );
  const found = new Set(result.rows.map((row) => row.tablename));
  const missing = REQUIRED_TABLES.filter((name) => !found.has(name));
  invariant(missing.length === 0, `Missing protected upload tables: ${missing.join(', ')}.`);
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
  const actual = new Map(result.rows.map((row) => [row.typname, row.labels]));
  for (const [name, labels] of Object.entries(EXPECTED_ENUMS)) {
    invariant(actual.has(name), `Missing protected upload enum ${name}.`);
    invariant(
      sameValues(actual.get(name), labels),
      `Protected upload enum ${name} does not match the governed contract.`,
    );
  }
}

async function assertColumns(client) {
  const tables = Object.keys(EXPECTED_COLUMNS);
  const result = await client.query(
    `SELECT table_name, column_name, is_nullable, data_type, udt_name,
            character_maximum_length, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])`,
    [tables],
  );
  const columns = new Map(
    result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
  );

  for (const [table, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
    for (const [name, expected] of Object.entries(expectedColumns)) {
      const column = columns.get(`${table}.${name}`);
      invariant(column, `Missing governed column ${table}.${name}.`);
      const [nullable, dataType, udtName, maxLength, defaultPattern] = expected;
      invariant(column.is_nullable === nullable, `${table}.${name} has unexpected nullability.`);
      invariant(column.data_type === dataType, `${table}.${name} has an unexpected SQL type.`);
      invariant(column.udt_name === udtName, `${table}.${name} has an unexpected base type.`);
      invariant(
        Number(column.character_maximum_length || 0) === Number(maxLength || 0),
        `${table}.${name} has an unexpected maximum length.`,
      );
      if (defaultPattern) {
        invariant(
          defaultPattern.test(String(column.column_default || '')),
          `${table}.${name} has an unexpected default.`,
        );
      } else {
        invariant(column.column_default === null, `${table}.${name} must not have a database default.`);
      }
    }
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
  const checks = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed check constraint ${expected.table}.${name}.`);
    invariant(check.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c', `${name} is not a CHECK constraint.`);
    invariant(check.convalidated === true, `${name} is still NOT VALID.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of expected.fragments) {
      invariant(definition.includes(fragment), `${name} is missing a governed invariant.`);
    }
  }
}

async function assertIndexes(client) {
  const names = Object.keys(EXPECTED_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready,
            index_state.indisunique, index_state.indisprimary,
            index_state.indnullsnotdistinct,
            index_state.indpred IS NULL AS is_unconditional,
            ARRAY(
              SELECT pg_get_indexdef(index_state.indexrelid, position, true)
                FROM generate_series(1, index_state.indnkeyatts) AS position
               ORDER BY position
            ) AS key_columns
       FROM pg_indexes AS indexes
       JOIN pg_class AS index_class ON index_class.relname = indexes.indexname
       JOIN pg_namespace AS index_namespace
         ON index_namespace.oid = index_class.relnamespace
        AND index_namespace.nspname = indexes.schemaname
       JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
      WHERE indexes.schemaname = current_schema()
        AND index_state.indrelid = to_regclass(
          format('%I.%I', indexes.schemaname, indexes.tablename)
        )
        AND indexes.indexname = ANY($1::text[])`,
    [names],
  );
  const indexes = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_INDEXES)) {
    const index = indexes.get(name);
    invariant(index, `Missing governed index ${name}.`);
    invariant(index.tablename === expected.table, `Index ${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `Index ${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `Index ${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `Index ${name} has unexpected primary status.`);
    invariant(index.indnullsnotdistinct === false, `Index ${name} must keep NULLS DISTINCT.`);
    invariant(index.is_unconditional === true, `Index ${name} must govern every row.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `Index ${name} has unexpected ordered columns.`);
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
              SELECT source_attribute.attname
                FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key_record(attnum, position)
                JOIN pg_attribute AS source_attribute
                  ON source_attribute.attrelid = constraint_record.conrelid
                 AND source_attribute.attnum = key_record.attnum
               ORDER BY key_record.position
            ) AS source_columns,
            ARRAY(
              SELECT target_attribute.attname
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
  const foreignKeys = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_FOREIGN_KEYS)) {
    const foreignKey = foreignKeys.get(name);
    invariant(foreignKey, `Missing governed foreign key ${expected.table}.${name}.`);
    invariant(foreignKey.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(foreignKey.target_table === expected.target, `${name} references the wrong table.`);
    invariant(foreignKey.contype === 'f' && foreignKey.convalidated, `${name} is not a validated foreign key.`);
    invariant(!foreignKey.condeferrable && !foreignKey.condeferred, `${name} must remain immediate.`);
    invariant(foreignKey.confdeltype === expected.deleteAction, `${name} has an unsafe delete policy.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(foreignKey.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

let savepointSequence = 0;

async function expectSqlFailure(client, query, parameters, expectedCode, expectedConstraint, label) {
  savepointSequence += 1;
  const savepoint = `protected_upload_verify_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught = null;
  try {
    await client.query(query, parameters);
  } catch (error) {
    caught = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === expectedCode, `${label} failed with an unexpected SQLSTATE.`);
  if (expectedConstraint) {
    invariant(caught.constraint === expectedConstraint, `${label} failed on an unexpected constraint.`);
  }
}

function uploadInsertParameters(fixtures, overrides = {}) {
  const storageProvider = overrides.storageProvider || 'vercel-blob';
  return [
    overrides.id || `upload_${randomUUID()}`,
    overrides.organizationId || fixtures.organizationId,
    overrides.projectId || fixtures.projectId,
    fixtures.actorId,
    overrides.purpose || 'CASH_RECEIPT',
    overrides.status || 'AVAILABLE',
    overrides.operationKeyHash || randomUUID().replaceAll('-', '').padEnd(64, '0'),
    'b'.repeat(64),
    storageProvider,
    JSON.stringify(
      overrides.storage
        || { provider: storageProvider, pathname: `migration-verifier/${randomUUID()}` },
    ),
    'image/jpeg',
    'migration-verifier.jpg',
    overrides.size || 128,
    'c'.repeat(64),
    new Date(Date.now() + 15 * 60 * 1_000),
    new Date(),
    overrides.uploadLeaseExpiresAt || null,
  ];
}

const INSERT_UPLOAD_SQL = `
  INSERT INTO "ProtectedUpload" (
    "id", "organizationId", "projectId", "actorId", "purpose", "status",
    "operationKeyHash", "requestFingerprint", "storageProvider", "storage",
    "mimeType", "filename", "size", "sha256", "expiresAt", "updatedAt",
    "uploadLeaseExpiresAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
    $11, $12, $13, $14, $15, $16, $17
  )`;

async function assertTransactionalSmoke(client) {
  const suffix = randomUUID().replaceAll('-', '');
  const fixtures = {
    organizationId: `pu_verify_org_${suffix}`,
    otherOrganizationId: `pu_verify_other_org_${suffix}`,
    projectId: `pu_verify_project_${suffix}`,
    otherProjectId: `pu_verify_other_project_${suffix}`,
    actorId: `pu_verify_actor_${suffix}`,
  };
  const now = new Date();

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [fixtures.organizationId, 'Protected upload migration verifier', `pu-verify-${suffix}`, now],
  );
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [
      fixtures.otherOrganizationId,
      'Protected upload migration verifier cross-tenant fixture',
      `pu-verify-other-${suffix}`,
      now,
    ],
  );
  await client.query(
    `INSERT INTO "PlatformUser" (
       "id", "clerkUserId", "primaryEmail", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $4)`,
    [fixtures.actorId, `clerk_pu_verify_${suffix}`, `pu-verify-${suffix}@invalid.example`, now],
  );
  await client.query(
    `INSERT INTO "Project" (
       "id", "organizationId", "name", "slug", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $5)`,
    [fixtures.projectId, fixtures.organizationId, 'Protected upload verifier project', `pu-project-${suffix}`, now],
  );
  await client.query(
    `INSERT INTO "Project" (
       "id", "organizationId", "name", "slug", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $5)`,
    [
      fixtures.otherProjectId,
      fixtures.organizationId,
      'Protected upload verifier cross-project fixture',
      `pu-other-project-${suffix}`,
      now,
    ],
  );

  const validParameters = uploadInsertParameters(fixtures);
  await client.query(INSERT_UPLOAD_SQL, validParameters);

  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, { operationKeyHash: 'not-a-sha256' }),
    '23514',
    'ProtectedUpload_hashes_check',
    'ProtectedUpload hash guard',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, { status: 'UPLOADING' }),
    '23514',
    'ProtectedUpload_state_check',
    'ProtectedUpload UPLOADING lease guard',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, {
      status: 'AVAILABLE',
      uploadLeaseExpiresAt: new Date(Date.now() + 60_000),
    }),
    '23514',
    'ProtectedUpload_state_check',
    'ProtectedUpload AVAILABLE lifecycle guard',
  );
  await expectSqlFailure(
    client,
    `UPDATE "ProtectedUpload"
        SET "claimedAt" = $2, "updatedAt" = $2
      WHERE "id" = $1`,
    [validParameters[0], new Date()],
    '23514',
    'ProtectedUpload_state_check',
    'ProtectedUpload AVAILABLE claim-field guard',
  );
  await expectSqlFailure(
    client,
    `UPDATE "ProtectedUpload"
        SET "deleteRequestedAt" = $2, "updatedAt" = $2
      WHERE "id" = $1`,
    [validParameters[0], new Date()],
    '23514',
    'ProtectedUpload_state_check',
    'ProtectedUpload AVAILABLE delete-field guard',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, {
      purpose: 'PROGRESS_EVIDENCE',
      size: 4_194_305,
    }),
    '23514',
    'ProtectedUpload_metadata_check',
    'ProtectedUpload maximum size guard',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, {
      storageProvider: 'vercel-blob',
      storage: { provider: 'cloudinary', publicId: `migration-verifier/${suffix}` },
    }),
    '23514',
    'ProtectedUpload_metadata_check',
    'ProtectedUpload storage-provider binding',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, { organizationId: fixtures.otherOrganizationId }),
    '23503',
    'ProtectedUpload_project_scope_fkey',
    'ProtectedUpload cross-tenant project scope',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOAD_SQL,
    uploadInsertParameters(fixtures, { operationKeyHash: validParameters[6] }),
    '23505',
    'ProtectedUpload_project_purpose_operation_key',
    'ProtectedUpload idempotency uniqueness',
  );
  const fundId = `pu_verify_fund_${suffix}`;
  await client.query(
    `INSERT INTO "CashFund" (
       "id", "projectId", "name", "currency", "custodianId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, 'ARS', $4, $5, $5)`,
    [fundId, fixtures.otherProjectId, 'Protected upload verifier fund', fixtures.actorId, now],
  );
  await expectSqlFailure(
    client,
    `INSERT INTO "CashMovement" (
       "id", "idempotencyKey", "projectId", "fundId", "kind", "amount",
       "category", "protectedUploadId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, 'EXPENSE', 1, 'migration-verifier', $5, $6, $6)`,
    [
      `pu_verify_movement_${suffix}`,
      `pu-verify-${suffix}`,
      fixtures.otherProjectId,
      fundId,
      validParameters[0],
      now,
    ],
    '23503',
    'CashMovement_protected_upload_fkey',
    'ProtectedUpload cross-project entity scope',
  );
  await expectSqlFailure(
    client,
    `UPDATE "ProtectedUpload"
        SET "status" = 'DELETED', "updatedAt" = $2
      WHERE "id" = $1`,
    [validParameters[0], new Date()],
    '23514',
    'ProtectedUpload_state_check',
    'ProtectedUpload invalid direct transition',
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "Project" WHERE "id" = $1',
    [fixtures.projectId],
    '23503',
    'ProtectedUpload_project_scope_fkey',
    'ProtectedUpload project retention policy',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-protected-upload-migration-verifier',
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

await client.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [databaseSchema],
  );
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured protected upload migration schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigrations(client);
  await assertTables(client);
  await assertEnums(client);
  await assertColumns(client);
  await assertChecks(client);
  await assertIndexes(client);
  await assertForeignKeys(client);
  await assertTransactionalSmoke(client);
  console.log(
    'Verified protected upload migration: lifecycle leases, cleanup backoff, scoped uniqueness, RESTRICT ownership and rollback-only constraint smoke.',
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  await client.end();
}
