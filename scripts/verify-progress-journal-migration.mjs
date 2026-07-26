import pg from 'pg';

const connectionString = process.env.PROGRESS_JOURNAL_MIGRATION_DATABASE_URL;
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

if (!connectionString) {
  throw new Error(
    'PROGRESS_JOURNAL_MIGRATION_DATABASE_URL is required; DATABASE_URL is intentionally ignored.',
  );
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveDatabaseSchema(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('PROGRESS_JOURNAL_MIGRATION_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('PROGRESS_JOURNAL_MIGRATION_DATABASE_URL must use PostgreSQL.');
  }

  const dsnSchemas = parsed.searchParams.getAll('schema');
  if (dsnSchemas.length > 1 && new Set(dsnSchemas).size > 1) {
    throw new Error('PROGRESS_JOURNAL_MIGRATION_DATABASE_URL contains conflicting schema parameters.');
  }
  const dsnSchema = dsnSchemas[0] || null;
  const explicitSchema = process.env.PROGRESS_JOURNAL_MIGRATION_SCHEMA || null;
  if (explicitSchema && dsnSchema && explicitSchema !== dsnSchema) {
    throw new Error(
      'PROGRESS_JOURNAL_MIGRATION_SCHEMA does not match the schema declared in the database URL.',
    );
  }

  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(
      'Declare PROGRESS_JOURNAL_MIGRATION_SCHEMA or add an explicit schema parameter to the database URL.',
    );
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(
      'The progress journal migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
    );
  }
  return schema;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function hardenedVerifierConnectionString(value) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const sslMode = parsed.searchParams.get('sslmode');
  if (
    hostname.endsWith('.neon.tech')
    && ['prefer', 'require', 'verify-ca'].includes(sslMode)
  ) {
    parsed.searchParams.set('sslmode', 'verify-full');
  }
  return parsed.toString();
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function normalizeDefinition(value) {
  return String(value || '')
    .replace(/::(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_.$]*(?:\[\])?)/g, '')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCheckExpression(value) {
  return String(value || '')
    .replace(/::(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_.$]*(?:\[\])?)/g, '')
    .replaceAll('"', '')
    .replace(/\s+/g, ' ')
    .trim();
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260724140000_daily_logs_progress_evidence',
  '20260726120000_whatsapp_progress_evidence_bridge',
  '20260726120010_progress_evidence_conversation_scope_index',
  '20260726120020_progress_evidence_message_scope_index',
  '20260726120030_progress_evidence_source_message_index',
  '20260726120040_progress_evidence_source_scope_index',
  '20260726120050_progress_evidence_operation_index',
  '20260726120100_whatsapp_progress_evidence_constraints',
  '20260726120200_whatsapp_progress_evidence_validate',
]);

const EXPECTED_TABLES = Object.freeze([
  'Conversation',
  'Message',
  'DailyLog',
  'ProgressEvidence',
]);

const EXPECTED_SOURCE_COLUMNS = Object.freeze({
  sourceConversationId: {
    nullable: 'YES', dataType: 'text', udtName: 'text', maxLength: null, default: null,
  },
  sourceMessageId: {
    nullable: 'YES', dataType: 'text', udtName: 'text', maxLength: null, default: null,
  },
  sourceOperationKeyHash: {
    nullable: 'YES', dataType: 'character', udtName: 'bpchar', maxLength: 64, default: null,
  },
  sourceRequestFingerprint: {
    nullable: 'YES', dataType: 'character', udtName: 'bpchar', maxLength: 64, default: null,
  },
});

const EXPECTED_INDEXES = Object.freeze({
  Conversation_projectId_id_key: {
    table: 'Conversation',
    columns: ['projectId', 'id'],
  },
  Message_conversationId_id_key: {
    table: 'Message',
    columns: ['conversationId', 'id'],
  },
  ProgressEvidence_sourceMessageId_key: {
    table: 'ProgressEvidence',
    columns: ['sourceMessageId'],
  },
  ProgressEvidence_source_conversation_message_key: {
    table: 'ProgressEvidence',
    columns: ['sourceConversationId', 'sourceMessageId'],
  },
  ProgressEvidence_project_operation_key: {
    table: 'ProgressEvidence',
    columns: ['projectId', 'sourceOperationKeyHash'],
  },
});

const EXPECTED_CONSTRAINTS = Object.freeze({
  ProgressEvidence_source_bundle_check: {
    type: 'c',
    expression: 'sourceConversationId IS NULL AND sourceMessageId IS NULL AND sourceOperationKeyHash IS NULL AND sourceRequestFingerprint IS NULL OR sourceConversationId IS NOT NULL AND sourceMessageId IS NOT NULL AND sourceOperationKeyHash IS NOT NULL AND sourceRequestFingerprint IS NOT NULL',
  },
  ProgressEvidence_source_operation_hash_check: {
    type: 'c',
    expression: "sourceOperationKeyHash IS NULL OR sourceOperationKeyHash ~ '^[0-9a-f]{64}$'",
  },
  ProgressEvidence_source_fingerprint_check: {
    type: 'c',
    expression: "sourceRequestFingerprint IS NULL OR sourceRequestFingerprint ~ '^[0-9a-f]{64}$'",
  },
  ProgressEvidence_source_conversation_scope_fkey: {
    type: 'f',
    fragments: [
      'FOREIGN KEY projectId, sourceConversationId REFERENCES ConversationprojectId, id',
      'ON UPDATE CASCADE',
    ],
  },
  ProgressEvidence_source_message_scope_fkey: {
    type: 'f',
    fragments: [
      'FOREIGN KEY sourceConversationId, sourceMessageId REFERENCES MessageconversationId, id',
      'ON UPDATE CASCADE',
    ],
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
  invariant(missing.length === 0, `Missing progress journal migrations: ${missing.join(', ')}.`);
}

async function assertTables(client) {
  const result = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = ANY($1::text[])`,
    [EXPECTED_TABLES],
  );
  const found = new Set(result.rows.map((row) => row.tablename));
  const missing = EXPECTED_TABLES.filter((name) => !found.has(name));
  invariant(missing.length === 0, `Missing progress journal tables: ${missing.join(', ')}.`);
}

async function assertColumns(client) {
  const names = Object.keys(EXPECTED_SOURCE_COLUMNS);
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'ProgressEvidence'
        AND column_name = ANY($1::text[])`,
    [names],
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));
  for (const [name, expected] of Object.entries(EXPECTED_SOURCE_COLUMNS)) {
    const column = columns.get(name);
    invariant(column, `Missing ProgressEvidence.${name}.`);
    invariant(column.is_nullable === expected.nullable, `${name} must remain nullable.`);
    invariant(column.data_type === expected.dataType, `${name} has an unexpected SQL data type.`);
    invariant(column.udt_name === expected.udtName, `${name} has an unexpected PostgreSQL base type.`);
    invariant(
      Number(column.character_maximum_length || 0) === Number(expected.maxLength || 0),
      `${name} has an unexpected maximum length.`,
    );
    invariant(column.column_default === expected.default, `${name} has an unexpected default.`);
  }
}

async function assertIndexes(client) {
  const names = Object.keys(EXPECTED_INDEXES);
  const result = await client.query(
    `SELECT indexes.tablename, indexes.indexname,
            index_state.indisvalid, index_state.indisready,
            index_state.indisunique, index_state.indnullsnotdistinct,
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
    invariant(index.indisunique, `Index ${name} is not unique.`);
    invariant(index.indnullsnotdistinct === false, `Index ${name} must keep NULLS DISTINCT.`);
    invariant(index.is_unconditional, `Index ${name} must govern every row.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `Index ${name} has unexpected ordered columns.`);
  }
}

async function assertConstraints(client) {
  const names = Object.keys(EXPECTED_CONSTRAINTS);
  const result = await client.query(
    `SELECT constraint_row.conname, constraint_row.contype,
            constraint_row.convalidated, constraint_row.condeferrable,
            constraint_row.condeferred, constraint_row.confdeltype,
            constraint_row.confupdtype, constraint_row.confmatchtype,
            pg_get_expr(constraint_row.conbin, constraint_row.conrelid, true) AS expression,
            pg_get_constraintdef(constraint_row.oid, true) AS definition
       FROM pg_constraint AS constraint_row
      WHERE constraint_row.conrelid = to_regclass(
              format('%I.%I', current_schema(), 'ProgressEvidence')
            )
        AND constraint_row.conname = ANY($1::text[])`,
    [names],
  );
  const constraints = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_CONSTRAINTS)) {
    const constraint = constraints.get(name);
    invariant(constraint, `Missing constraint ProgressEvidence.${name}.`);
    invariant(constraint.contype === expected.type, `${name} has an unexpected constraint type.`);
    invariant(constraint.convalidated === true, `${name} is still NOT VALID.`);
    const definition = normalizeDefinition(constraint.definition);
    if (expected.expression) {
      invariant(
        normalizeCheckExpression(constraint.expression) === expected.expression,
        `${name} has an unexpected exact expression.`,
      );
    }
    for (const fragment of expected.fragments || []) {
      invariant(definition.includes(fragment), `${name} has an unexpected definition.`);
    }
    if (expected.type === 'f') {
      invariant(
        constraint.condeferrable === true && constraint.condeferred === true,
        `${name} must remain DEFERRABLE INITIALLY DEFERRED.`,
      );
      invariant(constraint.confdeltype === 'a', `${name} must remain ON DELETE NO ACTION.`);
      invariant(constraint.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
      invariant(constraint.confmatchtype === 's', `${name} must remain MATCH SIMPLE.`);
    }
  }
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-progress-journal-migration-verifier',
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

await client.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
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
    'PostgreSQL did not activate the configured progress journal migration schema.',
  );
  await client.query("SET LOCAL lock_timeout = '5s'");
  await assertMigrations(client);
  await assertTables(client);
  await assertColumns(client);
  await assertIndexes(client);
  await assertConstraints(client);
  console.log(
    'Verified progress journal migrations: online indexes, tenant-scoped provenance and validated constraints.',
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  await client.end();
}
