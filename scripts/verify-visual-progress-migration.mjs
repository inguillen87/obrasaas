import { randomUUID } from 'node:crypto';

import pg from 'pg';

const CONNECTION_ENV = 'VISUAL_PROGRESS_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'VISUAL_PROGRESS_MIGRATION_SCHEMA';
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
    throw new Error(
      `${SCHEMA_ENV} does not match the schema declared in the database URL.`,
    );
  }

  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(
      `Declare ${SCHEMA_ENV} or add an explicit schema parameter to the database URL.`,
    );
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(
      'The visual progress migration schema must be a safe PostgreSQL identifier of at most 63 ASCII characters.',
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
    .replace(/::(?:(?:"[^"]+")|[A-Za-z_][A-Za-z0-9_.$]*)(?:\[\])?/g, '')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePredicate(value) {
  return normalizeDefinition(value).replace(/\s+/g, '');
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260726143000_visual_progress_assessments',
]);

const EXPECTED_ENUMS = Object.freeze({
  VisualProgressAssessmentStatus: [
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'ABSTAINED',
    'FAILED',
  ],
  VisualProgressAssessmentReviewStatus: [
    'PENDING',
    'APPROVED',
    'CORRECTED',
    'REJECTED',
  ],
});

const REQUIRED_TABLES = Object.freeze([
  'VisualProgressAssessment',
  'Project',
  'Task',
  'ProgressEvidence',
  'PlatformUser',
]);

const TEXT = Object.freeze({ nullable: 'NO', dataType: 'text', udtName: 'text' });
const NULLABLE_TEXT = Object.freeze({ nullable: 'YES', dataType: 'text', udtName: 'text' });
const INTEGER = Object.freeze({ nullable: 'NO', dataType: 'integer', udtName: 'int4' });
const NULLABLE_INTEGER = Object.freeze({ nullable: 'YES', dataType: 'integer', udtName: 'int4' });
const NULLABLE_TIMESTAMP = Object.freeze({
  nullable: 'YES', dataType: 'timestamp without time zone', udtName: 'timestamp', datetimePrecision: 3,
});
const TIMESTAMP = Object.freeze({
  nullable: 'NO', dataType: 'timestamp without time zone', udtName: 'timestamp', datetimePrecision: 3,
});

const EXPECTED_COLUMNS = Object.freeze({
  id: TEXT,
  projectId: TEXT,
  taskId: TEXT,
  evidenceId: TEXT,
  operationKeyHash: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  requestFingerprint: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  provider: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  providerModel: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 120,
  },
  analyzerVersion: {
    nullable: 'NO', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  inputSha256: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  baselineHash: {
    nullable: 'NO', dataType: 'character', udtName: 'bpchar', maxLength: 64,
  },
  taskRevisionAtRequest: INTEGER,
  evidenceRevisionAtRequest: INTEGER,
  status: {
    nullable: 'NO',
    dataType: 'USER-DEFINED',
    udtName: 'VisualProgressAssessmentStatus',
    defaultPattern: /'PENDING'/,
  },
  leaseExpiresAt: NULLABLE_TIMESTAMP,
  attemptCount: { ...INTEGER, defaultPattern: /^0$/ },
  summary: NULLABLE_TEXT,
  elementType: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 120,
  },
  progressMin: NULLABLE_INTEGER,
  progressMax: NULLABLE_INTEGER,
  confidence: {
    nullable: 'YES', dataType: 'numeric', udtName: 'numeric', numericPrecision: 5, numericScale: 4,
  },
  quality: { nullable: 'YES', dataType: 'jsonb', udtName: 'jsonb' },
  observations: { nullable: 'YES', dataType: 'jsonb', udtName: 'jsonb' },
  limitations: { nullable: 'YES', dataType: 'jsonb', udtName: 'jsonb' },
  providerResponseId: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 190,
  },
  failureCode: {
    nullable: 'YES', dataType: 'character varying', udtName: 'varchar', maxLength: 64,
  },
  completedAt: NULLABLE_TIMESTAMP,
  requestedById: NULLABLE_TEXT,
  reviewStatus: {
    nullable: 'YES', dataType: 'USER-DEFINED', udtName: 'VisualProgressAssessmentReviewStatus',
  },
  reviewedById: NULLABLE_TEXT,
  reviewedAt: NULLABLE_TIMESTAMP,
  reviewNote: NULLABLE_TEXT,
  correctedProgressMin: NULLABLE_INTEGER,
  correctedProgressMax: NULLABLE_INTEGER,
  revision: { ...INTEGER, defaultPattern: /^0$/ },
  createdAt: { ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i },
  updatedAt: TIMESTAMP,
});

const EXPECTED_CHECKS = Object.freeze({
  VisualProgressAssessment_hashes_check: [
    'operationKeyHash',
    'requestFingerprint',
    'inputSha256',
    'baselineHash',
    '^[0-9a-f]{64}$',
  ],
  VisualProgressAssessment_versions_check: [
    'taskRevisionAtRequest >= 0',
    'evidenceRevisionAtRequest >= 0',
    'attemptCount >= 0',
    'revision >= 0',
  ],
  VisualProgressAssessment_lease_state_check: [
    "status = 'PENDING'",
    'leaseExpiresAt IS NULL',
    'attemptCount = 0',
    "status = 'RUNNING'",
    'leaseExpiresAt IS NOT NULL',
    'leaseExpiresAt >= createdAt',
    'attemptCount >= 1',
    "status = ANY ARRAY['COMPLETED', 'ABSTAINED', 'FAILED']",
  ],
  VisualProgressAssessment_provider_identity_check: [
    'provider',
    'providerModel',
    'analyzerVersion',
    'providerResponseId',
  ],
  VisualProgressAssessment_element_type_check: ['elementType'],
  VisualProgressAssessment_progress_range_check: [
    'progressMin BETWEEN 0 AND 100',
    'progressMax BETWEEN 0 AND 100',
    'progressMin <= progressMax',
  ],
  VisualProgressAssessment_confidence_check: ['confidence BETWEEN 0 AND 1'],
  VisualProgressAssessment_json_shape_check: [
    "jsonb_typeofquality = 'object'",
    "jsonb_typeofobservations = 'array'",
    "jsonb_typeoflimitations = 'array'",
  ],
  VisualProgressAssessment_failure_code_check: [
    'failureCode',
    '^[A-Z][A-Z0-9_]{0,63}$',
  ],
  VisualProgressAssessment_result_state_check: [
    "status = ANY ARRAY['PENDING', 'RUNNING']",
    "status = 'COMPLETED'",
    "status = 'ABSTAINED'",
    'jsonb_array_lengthlimitations > 0',
    "status = 'FAILED'",
    'failureCode IS NOT NULL',
    'completedAt IS NOT NULL',
  ],
  VisualProgressAssessment_review_state_check: [
    "status = ANY ARRAY['PENDING', 'RUNNING', 'FAILED']",
    "reviewStatus = 'PENDING'",
    "reviewStatus = 'APPROVED'",
    "reviewStatus = 'CORRECTED'",
    'correctedProgressMin BETWEEN 0 AND 100',
    'correctedProgressMax BETWEEN 0 AND 100',
    'correctedProgressMin <= correctedProgressMax',
    "reviewStatus = 'REJECTED'",
  ],
  VisualProgressAssessment_timestamps_check: [
    'completedAt >= createdAt',
    'reviewedAt >= completedAt',
  ],
});

const OPEN_PREDICATE = normalizePredicate(`
  "status" = ANY (ARRAY['PENDING', 'RUNNING'])
  OR (
    "status" = ANY (ARRAY['COMPLETED', 'ABSTAINED'])
    AND "reviewStatus" = 'PENDING'
  )
`);

const EXPECTED_INDEXES = Object.freeze({
  VisualProgressAssessment_pkey: {
    columns: ['id'], unique: true, primary: true,
  },
  VisualProgressAssessment_projectId_id_key: {
    columns: ['projectId', 'id'], unique: true,
  },
  VisualProgressAssessment_project_operation_key: {
    columns: ['projectId', 'operationKeyHash'], unique: true,
  },
  VPA_project_evidence_open_key: {
    columns: ['projectId', 'evidenceId'], unique: true, predicate: OPEN_PREDICATE,
  },
  VisualProgressAssessment_project_fingerprint_idx: {
    columns: ['projectId', 'requestFingerprint'], unique: false,
  },
  VPA_project_status_lease_idx: {
    columns: ['projectId', 'status', 'leaseExpiresAt'], unique: false,
  },
  VPA_project_task_status_created_idx: {
    columns: ['projectId', 'taskId', 'status', 'createdAt'], unique: false,
  },
  VPA_project_evidence_created_idx: {
    columns: ['projectId', 'evidenceId', 'createdAt'], unique: false,
  },
  VPA_project_review_created_idx: {
    columns: ['projectId', 'reviewStatus', 'createdAt'], unique: false,
  },
  VPA_requester_created_idx: {
    columns: ['requestedById', 'createdAt'], unique: false,
  },
  VPA_reviewer_reviewed_idx: {
    columns: ['reviewedById', 'reviewedAt'], unique: false,
  },
});

const EXPECTED_FOREIGN_KEYS = Object.freeze({
  VisualProgressAssessment_projectId_fkey: {
    target: 'Project',
    columns: ['projectId'],
    targetColumns: ['id'],
    deleteAction: 'c',
  },
  VisualProgressAssessment_project_task_fkey: {
    target: 'Task',
    columns: ['projectId', 'taskId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  VisualProgressAssessment_project_evidence_fkey: {
    target: 'ProgressEvidence',
    columns: ['projectId', 'evidenceId'],
    targetColumns: ['projectId', 'id'],
    deleteAction: 'r',
  },
  VisualProgressAssessment_requestedById_fkey: {
    target: 'PlatformUser',
    columns: ['requestedById'],
    targetColumns: ['id'],
    deleteAction: 'r',
  },
  VisualProgressAssessment_reviewedById_fkey: {
    target: 'PlatformUser',
    columns: ['reviewedById'],
    targetColumns: ['id'],
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
  invariant(
    missing.length === 0,
    `Missing visual progress migrations: ${missing.join(', ')}.`,
  );
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
  invariant(missing.length === 0, `Missing visual progress tables: ${missing.join(', ')}.`);
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
    invariant(actual.has(name), `Missing visual progress enum ${name}.`);
    invariant(
      sameValues(actual.get(name), labels),
      `Visual progress enum ${name} does not match the governed contract.`,
    );
  }
}

async function assertColumns(client) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, numeric_precision, numeric_scale,
            datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'VisualProgressAssessment'`,
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));

  for (const [name, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const column = columns.get(name);
    invariant(column, `Missing governed column VisualProgressAssessment.${name}.`);
    invariant(column.is_nullable === expected.nullable, `${name} has unexpected nullability.`);
    invariant(column.data_type === expected.dataType, `${name} has an unexpected SQL type.`);
    invariant(column.udt_name === expected.udtName, `${name} has an unexpected base type.`);
    for (const [actualKey, expectedKey, label] of [
      ['character_maximum_length', 'maxLength', 'maximum length'],
      ['numeric_precision', 'numericPrecision', 'numeric precision'],
      ['numeric_scale', 'numericScale', 'numeric scale'],
      ['datetime_precision', 'datetimePrecision', 'datetime precision'],
    ]) {
      invariant(
        Number(column[actualKey] || 0) === Number(expected[expectedKey] || 0),
        `${name} has an unexpected ${label}.`,
      );
    }
    if (expected.defaultPattern) {
      invariant(
        expected.defaultPattern.test(String(column.column_default || '')),
        `${name} has an unexpected default.`,
      );
    } else {
      invariant(column.column_default === null, `${name} must not have a database default.`);
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
  for (const [name, fragments] of Object.entries(EXPECTED_CHECKS)) {
    const check = checks.get(name);
    invariant(check, `Missing governed check constraint ${name}.`);
    invariant(check.table_name === 'VisualProgressAssessment', `${name} is attached to the wrong table.`);
    invariant(check.contype === 'c', `${name} is not a CHECK constraint.`);
    invariant(check.convalidated === true, `${name} is still NOT VALID.`);
    invariant(check.condeferrable === false, `${name} must remain non-deferrable.`);
    const definition = normalizeDefinition(check.definition);
    for (const fragment of fragments) {
      invariant(
        definition.includes(normalizeDefinition(fragment)),
        `${name} is missing a governed invariant.`,
      );
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
            pg_get_expr(index_state.indpred, index_state.indrelid, true) AS predicate,
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
    invariant(index.tablename === 'VisualProgressAssessment', `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary status.`);
    invariant(index.indnullsnotdistinct === false, `${name} must keep NULLS DISTINCT.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    if (expected.predicate) {
      invariant(index.predicate !== null, `${name} must remain a partial index.`);
      invariant(
        normalizePredicate(index.predicate) === expected.predicate,
        `${name} has an unexpected open-assessment predicate.`,
      );
    } else {
      invariant(index.predicate === null, `${name} must govern every row.`);
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
    invariant(foreignKey, `Missing governed foreign key ${name}.`);
    invariant(foreignKey.table_name === 'VisualProgressAssessment', `${name} is attached to the wrong table.`);
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

async function expectSqlFailure(
  client,
  query,
  parameters,
  expectedCode,
  expectedConstraint,
  label,
) {
  savepointSequence += 1;
  const savepoint = `visual_progress_verify_${savepointSequence}`;
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

const INSERT_ASSESSMENT_SQL = `
  INSERT INTO "VisualProgressAssessment" (
    "id", "projectId", "taskId", "evidenceId", "operationKeyHash",
    "requestFingerprint", "provider", "providerModel", "analyzerVersion",
    "inputSha256", "baselineHash", "taskRevisionAtRequest",
    "evidenceRevisionAtRequest", "status", "leaseExpiresAt", "attemptCount",
    "summary", "elementType", "progressMin", "progressMax", "confidence",
    "quality", "observations", "limitations", "providerResponseId",
    "failureCode", "completedAt", "requestedById", "reviewStatus",
    "reviewedById", "reviewedAt", "reviewNote", "correctedProgressMin",
    "correctedProgressMax", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23::jsonb,
    $24::jsonb, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
  )`;

function assessmentParameters(fixtures, overrides = {}) {
  const status = overrides.status || 'PENDING';
  return [
    overrides.id || `vpa_${randomUUID()}`,
    overrides.projectId || fixtures.projectId,
    overrides.taskId || fixtures.taskId,
    overrides.evidenceId || fixtures.evidenceId,
    overrides.operationKeyHash || randomUUID().replaceAll('-', '').padEnd(64, '0'),
    overrides.requestFingerprint || randomUUID().replaceAll('-', '').padEnd(64, '1'),
    overrides.provider || 'openai',
    overrides.providerModel || 'migration-verifier',
    overrides.analyzerVersion || 'migration-verifier-v1',
    overrides.inputSha256 || randomUUID().replaceAll('-', '').padEnd(64, '2'),
    overrides.baselineHash || randomUUID().replaceAll('-', '').padEnd(64, '3'),
    overrides.taskRevisionAtRequest ?? 0,
    overrides.evidenceRevisionAtRequest ?? 0,
    status,
    overrides.leaseExpiresAt ?? null,
    overrides.attemptCount ?? 0,
    overrides.summary ?? null,
    overrides.elementType ?? null,
    overrides.progressMin ?? null,
    overrides.progressMax ?? null,
    overrides.confidence ?? null,
    JSON.stringify(overrides.quality ?? null),
    JSON.stringify(overrides.observations ?? null),
    JSON.stringify(overrides.limitations ?? null),
    overrides.providerResponseId ?? null,
    overrides.failureCode ?? null,
    overrides.completedAt ?? null,
    overrides.requestedById === undefined ? fixtures.requesterId : overrides.requestedById,
    overrides.reviewStatus ?? null,
    overrides.reviewedById ?? null,
    overrides.reviewedAt ?? null,
    overrides.reviewNote ?? null,
    overrides.correctedProgressMin ?? null,
    overrides.correctedProgressMax ?? null,
    overrides.updatedAt || new Date(),
  ];
}

async function insertEvidence(client, { id, projectId, taskId, suffix, now }) {
  await client.query(
    `INSERT INTO "ProgressEvidence" (
       "id", "projectId", "taskId", "capturedAt", "caption", "media",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $4, $4)`,
    [id, projectId, taskId, now, `Visual migration ${suffix}`, JSON.stringify({ kind: 'image' })],
  );
}

async function assertTransactionalSmoke(client) {
  const suffix = randomUUID().replaceAll('-', '');
  const now = new Date();
  const fixtures = {
    organizationId: `vpa_verify_org_${suffix}`,
    projectId: `vpa_verify_project_${suffix}`,
    otherProjectId: `vpa_verify_other_project_${suffix}`,
    taskId: `vpa_verify_task_${suffix}`,
    otherTaskId: `vpa_verify_other_task_${suffix}`,
    evidenceId: `vpa_verify_evidence_${suffix}`,
    reviewEvidenceId: `vpa_verify_review_evidence_${suffix}`,
    otherEvidenceId: `vpa_verify_other_evidence_${suffix}`,
    requesterId: `vpa_verify_requester_${suffix}`,
    reviewerId: `vpa_verify_reviewer_${suffix}`,
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [fixtures.organizationId, 'Visual progress migration verifier', `vpa-verify-${suffix}`, now],
  );
  for (const [id, clerkSuffix] of [
    [fixtures.requesterId, 'requester'],
    [fixtures.reviewerId, 'reviewer'],
  ]) {
    await client.query(
      `INSERT INTO "PlatformUser" (
         "id", "clerkUserId", "primaryEmail", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $4)`,
      [id, `clerk_vpa_${clerkSuffix}_${suffix}`, `vpa-${clerkSuffix}-${suffix}@invalid.example`, now],
    );
  }
  for (const [id, slug] of [
    [fixtures.projectId, `vpa-project-${suffix}`],
    [fixtures.otherProjectId, `vpa-other-project-${suffix}`],
  ]) {
    await client.query(
      `INSERT INTO "Project" (
         "id", "organizationId", "name", "slug", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, fixtures.organizationId, 'Visual progress verifier project', slug, now],
    );
  }
  for (const [id, projectId] of [
    [fixtures.taskId, fixtures.projectId],
    [fixtures.otherTaskId, fixtures.otherProjectId],
  ]) {
    await client.query(
      `INSERT INTO "Task" ("id", "projectId", "title", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $4)`,
      [id, projectId, 'Visual progress verifier task', now],
    );
  }
  await insertEvidence(client, {
    id: fixtures.evidenceId,
    projectId: fixtures.projectId,
    taskId: fixtures.taskId,
    suffix,
    now,
  });
  await insertEvidence(client, {
    id: fixtures.reviewEvidenceId,
    projectId: fixtures.projectId,
    taskId: fixtures.taskId,
    suffix,
    now,
  });
  await insertEvidence(client, {
    id: fixtures.otherEvidenceId,
    projectId: fixtures.otherProjectId,
    taskId: fixtures.otherTaskId,
    suffix,
    now,
  });

  const pending = assessmentParameters(fixtures);
  await client.query(INSERT_ASSESSMENT_SQL, pending);

  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { operationKeyHash: 'not-a-sha256' }),
    '23514',
    'VisualProgressAssessment_hashes_check',
    'VisualProgressAssessment hash guard',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, {
      evidenceId: fixtures.reviewEvidenceId,
      status: 'RUNNING',
      attemptCount: 1,
    }),
    '23514',
    'VisualProgressAssessment_lease_state_check',
    'VisualProgressAssessment RUNNING lease guard',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, {
      evidenceId: fixtures.reviewEvidenceId,
      status: 'COMPLETED',
      attemptCount: 1,
      completedAt: new Date(),
      reviewStatus: 'PENDING',
    }),
    '23514',
    'VisualProgressAssessment_result_state_check',
    'VisualProgressAssessment completed result guard',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures),
    '23505',
    'VPA_project_evidence_open_key',
    'VisualProgressAssessment open evidence uniqueness',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, {
      taskId: fixtures.otherTaskId,
      evidenceId: fixtures.reviewEvidenceId,
    }),
    '23503',
    'VisualProgressAssessment_project_task_fkey',
    'VisualProgressAssessment cross-project task scope',
  );
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { evidenceId: fixtures.otherEvidenceId }),
    '23503',
    'VisualProgressAssessment_project_evidence_fkey',
    'VisualProgressAssessment cross-project evidence scope',
  );

  const completedAt = new Date(Date.now() + 1_000);
  const completed = assessmentParameters(fixtures, {
    evidenceId: fixtures.reviewEvidenceId,
    status: 'COMPLETED',
    attemptCount: 1,
    summary: 'Mamposteria parcialmente ejecutada.',
    elementType: 'masonry-wall',
    progressMin: 40,
    progressMax: 60,
    confidence: 0.75,
    quality: { usable: true },
    observations: ['Muro visible'],
    limitations: ['Una sola toma'],
    providerResponseId: 'migration-verifier-response',
    completedAt,
    reviewStatus: 'PENDING',
    updatedAt: completedAt,
  });
  await client.query(INSERT_ASSESSMENT_SQL, completed);
  await expectSqlFailure(
    client,
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { evidenceId: fixtures.reviewEvidenceId }),
    '23505',
    'VPA_project_evidence_open_key',
    'VisualProgressAssessment unresolved review uniqueness',
  );

  const reviewedAt = new Date(completedAt.getTime() + 1_000);
  await client.query(
    `UPDATE "VisualProgressAssessment"
        SET "reviewStatus" = 'APPROVED', "reviewedById" = $2,
            "reviewedAt" = $3, "updatedAt" = $3
      WHERE "id" = $1`,
    [completed[0], fixtures.reviewerId, reviewedAt],
  );
  await client.query(
    INSERT_ASSESSMENT_SQL,
    assessmentParameters(fixtures, { evidenceId: fixtures.reviewEvidenceId }),
  );

  await expectSqlFailure(
    client,
    'DELETE FROM "PlatformUser" WHERE "id" = $1',
    [fixtures.requesterId],
    '23503',
    'VisualProgressAssessment_requestedById_fkey',
    'VisualProgressAssessment requester retention policy',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-visual-progress-migration-verifier',
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
    throw new Error('Unable to connect to the dedicated visual progress verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [databaseSchema],
  );
  invariant(
    schemaExists.rows[0]?.exists,
    `Configured PostgreSQL schema ${databaseSchema} does not exist.`,
  );
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(
    activeSchema.rows[0]?.name === databaseSchema,
    'PostgreSQL did not activate the configured visual progress migration schema.',
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
    'Verified visual progress migration: governed lifecycle, human review, scoped relations, exact open-evidence uniqueness and rollback-only smoke.',
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  if (connected) {
    await client.end();
  }
}
