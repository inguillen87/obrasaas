import { createHash, randomUUID } from 'node:crypto';

import pg from 'pg';

const CONNECTION_ENV = 'PROGRESS_EVIDENCE_LOCATION_CAPTURE_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'PROGRESS_EVIDENCE_LOCATION_CAPTURE_MIGRATION_SCHEMA';
const connectionString = process.env[CONNECTION_ENV];
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

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
    throw new Error('The progress evidence location capture schema must be a safe PostgreSQL identifier.');
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
    throw new Error(`${CONNECTION_ENV} must use sslmode=verify-full for a remote PostgreSQL host.`);
  }
  parsed.searchParams.delete('schema');
  return parsed.toString();
}

function normalizeSql(value) {
  return String(value || '')
    .replace(/::(?:(?:"[^"]+")|[A-Za-z_][A-Za-z0-9_.$]*)(?:\[\])?/g, '')
    .replaceAll('"', '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);
const REQUIRED_MIGRATIONS = [
  '20260729100000_progress_evidence_location_capture',
  '20260729110000_progress_evidence_location_rate_limit',
];

const EXPECTED_ENUMS = Object.freeze({
  ProgressEvidenceCaptureStatus: [
    'AWAITING_LOCATION',
    'LOCATION_CAPTURED',
    'CONSUMED',
    'EXPIRED',
    'CANCELLED',
  ],
  ProgressEvidenceLocationSource: ['WEBVIEW_GEOLOCATION', 'WHATSAPP_DECLARED'],
  ProgressEvidenceLocationVerification: [
    'IN_GEOFENCE',
    'REVIEW_REQUIRED',
    'DECLARED_ONLY',
  ],
  ProgressEvidenceLocationRateScope: [
    'ACTIVE_SESSION',
    'ACTIVE_ORGANIZATION',
    'INACTIVE_SESSION',
    'INACTIVE_ORGANIZATION',
  ],
});

const TEXT = Object.freeze({ nullable: 'NO', dataType: 'text', udtName: 'text' });
const NULLABLE_TEXT = Object.freeze({ ...TEXT, nullable: 'YES' });
const INTEGER = Object.freeze({ nullable: 'NO', dataType: 'integer', udtName: 'int4' });
const BIGINT = Object.freeze({ nullable: 'NO', dataType: 'bigint', udtName: 'int8' });
const JSONB = Object.freeze({ nullable: 'NO', dataType: 'jsonb', udtName: 'jsonb' });
const TIMESTAMP = Object.freeze({
  nullable: 'NO',
  dataType: 'timestamp without time zone',
  udtName: 'timestamp',
  datetimePrecision: 3,
});
const NULLABLE_TIMESTAMP = Object.freeze({ ...TIMESTAMP, nullable: 'YES' });
const CREATED_AT = Object.freeze({ ...TIMESTAMP, defaultPattern: /^CURRENT_TIMESTAMP$/i });

function char(length, nullable = false) {
  return {
    nullable: nullable ? 'YES' : 'NO',
    dataType: 'character',
    udtName: 'bpchar',
    maxLength: length,
  };
}

function varchar(length) {
  return {
    nullable: 'NO',
    dataType: 'character varying',
    udtName: 'varchar',
    maxLength: length,
  };
}

function decimal(precision, scale, nullable = true) {
  return {
    nullable: nullable ? 'YES' : 'NO',
    dataType: 'numeric',
    udtName: 'numeric',
    numericPrecision: precision,
    numericScale: scale,
  };
}

function enumeration(name, nullable = false, defaultValue = null) {
  return {
    nullable: nullable ? 'YES' : 'NO',
    dataType: 'USER-DEFINED',
    udtName: name,
    ...(defaultValue ? { defaultPattern: new RegExp(`'${defaultValue}'`) } : {}),
  };
}

const EXPECTED_SESSION_COLUMNS = Object.freeze({
  id: TEXT,
  organizationId: TEXT,
  projectId: TEXT,
  workerId: TEXT,
  connectionId: TEXT,
  mediaAssetId: TEXT,
  status: enumeration('ProgressEvidenceCaptureStatus', false, 'AWAITING_LOCATION'),
  revision: { ...INTEGER, defaultPattern: /^0$/ },
  tokenHash: char(64),
  privacyNoticeVersion: varchar(64),
  privacyNoticeContentSha256: char(64),
  privacyAcceptedAt: NULLABLE_TIMESTAMP,
  issuedAt: CREATED_AT,
  expiresAt: TIMESTAMP,
  locationCapturedAt: NULLABLE_TIMESTAMP,
  locationReceivedAt: NULLABLE_TIMESTAMP,
  latitude: decimal(10, 7),
  longitude: decimal(10, 7),
  accuracyMeters: decimal(9, 2),
  locationSource: enumeration('ProgressEvidenceLocationSource', true),
  locationVerification: enumeration('ProgressEvidenceLocationVerification', true),
  distanceMeters: decimal(10, 2),
  geofenceRadiusMeters: decimal(10, 2),
  operationKeyHash: char(64, true),
  requestFingerprint: char(64, true),
  consumedAt: NULLABLE_TIMESTAMP,
  expiredAt: NULLABLE_TIMESTAMP,
  cancelledAt: NULLABLE_TIMESTAMP,
  createdAt: CREATED_AT,
  updatedAt: TIMESTAMP,
});

const EXPECTED_EVIDENCE_COLUMNS = Object.freeze({
  locationCaptureSessionId: NULLABLE_TEXT,
  locationCapturedAt: NULLABLE_TIMESTAMP,
  locationSource: enumeration('ProgressEvidenceLocationSource', true),
  locationVerification: enumeration('ProgressEvidenceLocationVerification', true),
});

const EXPECTED_RATE_BUCKET_COLUMNS = Object.freeze({
  id: TEXT,
  organizationId: TEXT,
  scope: enumeration('ProgressEvidenceLocationRateScope'),
  scopeKeyHash: char(64),
  windowBuckets: JSONB,
  blockedCount: { ...BIGINT, defaultPattern: /^(?:0|'0'::bigint)$/i },
  lastBlockedAt: NULLABLE_TIMESTAMP,
  expiresAt: TIMESTAMP,
  createdAt: CREATED_AT,
  updatedAt: TIMESTAMP,
});

const EXPECTED_CHECKS = Object.freeze({
  ProgressEvidenceCaptureSession_hashes_check: {
    table: 'ProgressEvidenceCaptureSession',
    validated: true,
    fragments: ['tokenhash ~', 'privacynoticecontentsha256 ~', 'operationkeyhash is null', 'requestfingerprint is null'],
  },
  ProgressEvidenceCaptureSession_metadata_check: {
    table: 'ProgressEvidenceCaptureSession',
    validated: true,
    fragments: ['revision >= 0', 'privacynoticeversion', 'operationkeyhash is null = requestfingerprint is null', 'locationcapturedat is null = operationkeyhash is null'],
  },
  ProgressEvidenceCaptureSession_location_bundle_check: {
    table: 'ProgressEvidenceCaptureSession',
    validated: true,
    fragments: [
      'webview_geolocation',
      'whatsapp_declared',
      'declared_only',
      'distancemeters',
      'accuracymeters',
      'locationcapturedat >= issuedat -',
      'locationcapturedat <= locationreceivedat +',
    ],
  },
  ProgressEvidenceCaptureSession_state_check: {
    table: 'ProgressEvidenceCaptureSession',
    validated: true,
    fragments: [
      'awaiting_location',
      'location_captured',
      'consumed',
      'expired',
      "status = 'cancelled' and locationcapturedat is null",
      'mediaassetid is not null',
    ],
  },
  ProgressEvidenceCaptureSession_timestamps_check: {
    table: 'ProgressEvidenceCaptureSession',
    validated: true,
    fragments: ['expiresat <= issuedat +', 'consumedat >= locationreceivedat', 'expiredat >= expiresat'],
  },
  ProgressEvidence_location_capture_bundle_check: {
    table: 'ProgressEvidence',
    validated: false,
    fragments: ['locationcapturesessionid is null', 'webview_geolocation', 'whatsapp_declared', 'declared_only'],
  },
  PELRateBucket_hash_check: {
    table: 'ProgressEvidenceLocationRateBucket',
    validated: true,
    fragments: ['scopekeyhash ~'],
  },
  PELRateBucket_state_check: {
    table: 'ProgressEvidenceLocationRateBucket',
    validated: true,
    fragments: [
      "jsonb_typeofwindowbuckets = 'array'",
      'jsonb_array_lengthwindowbuckets <= 60',
      'blockedcount >= 0',
      'expiresat >= updatedat',
      'lastblockedat is null',
    ],
  },
});

const EXPECTED_INDEXES = Object.freeze({
  ProgressEvidenceLocationRateBucket_pkey: {
    table: 'ProgressEvidenceLocationRateBucket', columns: ['id'], unique: true, primary: true,
  },
  PELRateBucket_scope_key: {
    table: 'ProgressEvidenceLocationRateBucket', columns: ['organizationId', 'scope', 'scopeKeyHash'], unique: true,
  },
  PELRateBucket_org_expiry_idx: {
    table: 'ProgressEvidenceLocationRateBucket', columns: ['organizationId', 'expiresAt', 'id'], unique: false,
  },
  PELRateBucket_expiry_idx: {
    table: 'ProgressEvidenceLocationRateBucket', columns: ['expiresAt', 'id'], unique: false,
  },
  ProgressEvidenceCaptureSession_pkey: {
    table: 'ProgressEvidenceCaptureSession', columns: ['id'], unique: true, primary: true,
  },
  ProgressEvidenceCaptureSession_project_id_key: {
    table: 'ProgressEvidenceCaptureSession', columns: ['projectId', 'id'], unique: true,
  },
  ProgressEvidenceCaptureSession_token_hash_key: {
    table: 'ProgressEvidenceCaptureSession', columns: ['tokenHash'], unique: true,
  },
  ProgressEvidenceCaptureSession_project_media_asset_key: {
    table: 'ProgressEvidenceCaptureSession', columns: ['projectId', 'mediaAssetId'], unique: true,
  },
  ProgressEvidenceCaptureSession_project_operation_key: {
    table: 'ProgressEvidenceCaptureSession', columns: ['projectId', 'operationKeyHash'], unique: true,
  },
  ProgressEvidenceCaptureSession_org_created_idx: {
    table: 'ProgressEvidenceCaptureSession', columns: ['organizationId', 'createdAt', 'id'], unique: false,
  },
  ProgressEvidenceCaptureSession_worker_active_idx: {
    table: 'ProgressEvidenceCaptureSession', columns: ['projectId', 'workerId', 'status', 'expiresAt', 'id'], unique: false,
  },
  ProgressEvidenceCaptureSession_connection_active_idx: {
    table: 'ProgressEvidenceCaptureSession', columns: ['projectId', 'connectionId', 'status', 'expiresAt', 'id'], unique: false,
  },
  ProgressEvidenceCaptureSession_expiry_idx: {
    table: 'ProgressEvidenceCaptureSession', columns: ['status', 'expiresAt', 'id'], unique: false,
  },
  ProgressEvidence_project_location_capture_session_key: {
    table: 'ProgressEvidence', columns: ['projectId', 'locationCaptureSessionId'], unique: true,
  },
});

const EXPECTED_FOREIGN_KEYS = Object.freeze({
  PELRateBucket_organization_fkey: {
    table: 'ProgressEvidenceLocationRateBucket', target: 'Organization',
    columns: ['organizationId'], targetColumns: ['id'], deleteType: 'c',
  },
  ProgressEvidenceCaptureSession_organizationId_fkey: {
    table: 'ProgressEvidenceCaptureSession', target: 'Organization',
    columns: ['organizationId'], targetColumns: ['id'],
  },
  ProgressEvidenceCaptureSession_project_scope_fkey: {
    table: 'ProgressEvidenceCaptureSession', target: 'Project',
    columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'],
  },
  ProgressEvidenceCaptureSession_worker_scope_fkey: {
    table: 'ProgressEvidenceCaptureSession', target: 'Worker',
    columns: ['projectId', 'workerId'], targetColumns: ['projectId', 'id'],
  },
  ProgressEvidenceCaptureSession_connection_scope_fkey: {
    table: 'ProgressEvidenceCaptureSession', target: 'WhatsAppConnection',
    columns: ['projectId', 'connectionId'], targetColumns: ['projectId', 'id'],
  },
  ProgressEvidenceCaptureSession_media_asset_scope_fkey: {
    table: 'ProgressEvidenceCaptureSession', target: 'WhatsAppMediaAsset',
    columns: ['projectId', 'mediaAssetId'], targetColumns: ['projectId', 'id'],
  },
  ProgressEvidence_location_capture_scope_fkey: {
    table: 'ProgressEvidence', target: 'ProgressEvidenceCaptureSession',
    columns: ['projectId', 'locationCaptureSessionId'], targetColumns: ['projectId', 'id'],
  },
});

async function assertMigration(client) {
  const result = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"
      WHERE migration_name = ANY($1::text[])`,
    [REQUIRED_MIGRATIONS],
  );
  const applied = new Map(result.rows.map((row) => [row.migration_name, row]));
  for (const name of REQUIRED_MIGRATIONS) {
    const row = applied.get(name);
    invariant(row?.finished_at && !row.rolled_back_at, `Migration ${name} is not durably applied.`);
  }
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
  for (const [name, values] of Object.entries(EXPECTED_ENUMS)) {
    invariant(sameValues(actual.get(name) || [], values), `Enum ${name} does not match its governed order.`);
  }
}

async function assertColumnSet(client, table, expectedColumns) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, numeric_precision, numeric_scale,
            datetime_precision, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [table],
  );
  const actual = new Map(result.rows.map((row) => [row.column_name, row]));
  for (const [name, expected] of Object.entries(expectedColumns)) {
    const column = actual.get(name);
    invariant(column, `Missing ${table}.${name}.`);
    invariant(column.is_nullable === expected.nullable, `${table}.${name} has unexpected nullability.`);
    invariant(
      column.data_type === expected.dataType && column.udt_name === expected.udtName,
      `${table}.${name} has an unexpected SQL type.`,
    );
    if (expected.maxLength !== undefined) {
      invariant(Number(column.character_maximum_length) === expected.maxLength, `${table}.${name} has an unexpected maximum length.`);
    }
    if (expected.numericPrecision !== undefined) {
      invariant(Number(column.numeric_precision) === expected.numericPrecision, `${table}.${name} has unexpected numeric precision.`);
      invariant(Number(column.numeric_scale) === expected.numericScale, `${table}.${name} has unexpected numeric scale.`);
    }
    if (expected.datetimePrecision !== undefined) {
      invariant(Number(column.datetime_precision) === expected.datetimePrecision, `${table}.${name} has unexpected timestamp precision.`);
    }
    if (expected.defaultPattern) {
      invariant(expected.defaultPattern.test(String(column.column_default || '')), `${table}.${name} has an unexpected default.`);
    } else {
      invariant(column.column_default === null, `${table}.${name} must not have a database default.`);
    }
  }
}

async function assertChecks(client) {
  const names = Object.keys(EXPECTED_CHECKS);
  const result = await client.query(
    `SELECT constraint_record.conname, relation_record.relname AS table_name,
            constraint_record.contype, constraint_record.convalidated,
            constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [names],
  );
  const actual = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_CHECKS)) {
    const check = actual.get(name);
    invariant(check?.contype === 'c', `Missing CHECK ${name}.`);
    invariant(check.table_name === expected.table, `${name} is attached to the wrong table.`);
    invariant(check.convalidated === expected.validated, `${name} has unexpected validation state.`);
    invariant(!check.condeferrable, `${name} must remain immediate.`);
    const definition = normalizeSql(check.definition);
    for (const fragment of expected.fragments) {
      invariant(definition.includes(fragment), `${name} is missing governed fragment ${fragment}.`);
    }
  }
}

async function assertIndexes(client) {
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
        AND index_state.indrelid = to_regclass(format('%I.%I', indexes.schemaname, indexes.tablename))
        AND indexes.tablename IN (
          'ProgressEvidenceLocationRateBucket',
          'ProgressEvidenceCaptureSession',
          'ProgressEvidence'
        )`,
  );
  const actual = new Map(result.rows.map((row) => [row.indexname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_INDEXES)) {
    const index = actual.get(name);
    invariant(index, `Missing governed index ${name}.`);
    invariant(index.tablename === expected.table, `${name} is attached to the wrong table.`);
    invariant(index.indisvalid && index.indisready, `${name} is not valid and ready.`);
    invariant(index.indisunique === expected.unique, `${name} has unexpected uniqueness.`);
    invariant(index.indisprimary === Boolean(expected.primary), `${name} has unexpected primary state.`);
    invariant(index.indnullsnotdistinct === false, `${name} must keep NULLS DISTINCT.`);
    invariant(index.predicate === null, `${name} must remain unconditional.`);
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
  }

  const redundantUnscopedCaptureIndexes = result.rows.filter((index) => {
    if (index.tablename !== 'ProgressEvidence' || !index.indisunique) return false;
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    return sameValues(columns, ['locationCaptureSessionId']);
  });
  invariant(
    redundantUnscopedCaptureIndexes.length === 0,
    'ProgressEvidence must not keep a redundant unscoped unique locationCaptureSessionId index.',
  );

  const forbidden = await client.query(
    `SELECT to_regclass(format('%I.%I', current_schema(), $1::text)) IS NOT NULL AS exists`,
    ['ProgressEvidenceCaptureSession_one_active_worker_connection_key'],
  );
  invariant(!forbidden.rows[0]?.exists, 'Photo-bound sessions must not impose a worker-wide active-session lock.');
}

async function assertForeignKeys(client) {
  const result = await client.query(
    `SELECT constraint_record.conname,
            source_relation.relname AS table_name,
            target_relation.relname AS target_table,
            constraint_record.contype, constraint_record.convalidated,
            constraint_record.condeferrable, constraint_record.condeferred,
            constraint_record.confdeltype, constraint_record.confupdtype,
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
    [Object.keys(EXPECTED_FOREIGN_KEYS)],
  );
  const actual = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, expected] of Object.entries(EXPECTED_FOREIGN_KEYS)) {
    const foreignKey = actual.get(name);
    invariant(foreignKey?.contype === 'f' && foreignKey.convalidated, `Missing validated FK ${name}.`);
    invariant(foreignKey.table_name === expected.table && foreignKey.target_table === expected.target, `${name} has the wrong relation.`);
    invariant(!foreignKey.condeferrable && !foreignKey.condeferred, `${name} must be immediate.`);
    const expectedDeleteType = expected.deleteType || 'r';
    invariant(
      foreignKey.confdeltype === expectedDeleteType,
      `${name} has an unexpected ON DELETE action.`,
    );
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertTriggers(client) {
  const expected = {
    ProgressEvidenceCaptureSession_transition_guard: {
      table: 'ProgressEvidenceCaptureSession',
      procedure: 'enforce_progress_evidence_capture_session_transition',
      constraint: false,
      deferred: false,
      triggerFragments: ['before', 'update', 'delete', 'for each row'],
      functionFragments: [
        'consumed_delete_guard',
        'location_immutability_guard',
        'operation_immutability_guard',
        'terminal_immutability_guard',
        'revision_transition_guard',
        'awaiting_location',
        'location_captured',
      ],
    },
    ProgressEvidence_location_immutability_guard: {
      table: 'ProgressEvidence',
      procedure: 'enforce_progress_evidence_location_provenance_immutability',
      constraint: false,
      deferred: false,
      triggerFragments: ['before', 'update', 'delete', 'for each row'],
      functionFragments: ['locationcapturesessionid', 'location_immutability_guard', 'location_delete_guard'],
    },
    ProgressEvidenceCaptureSession_evidence_link_guard: {
      table: 'ProgressEvidenceCaptureSession',
      procedure: 'validate_progress_evidence_location_capture_link',
      constraint: true,
      deferred: true,
      triggerFragments: ['after insert or update', 'deferrable initially deferred', 'for each row'],
      functionFragments: ['consumed_evidence_guard', 'evidence_copy_guard', 'unconsumed_link_guard'],
    },
    ProgressEvidence_capture_session_link_guard: {
      table: 'ProgressEvidence',
      procedure: 'validate_progress_evidence_location_capture_link',
      constraint: true,
      deferred: true,
      triggerFragments: ['after insert or update', 'deferrable initially deferred', 'for each row'],
      functionFragments: ['consumed_capture_guard', 'capture_copy_guard'],
    },
  };

  const result = await client.query(
    `SELECT trigger_record.tgname, relation_record.relname AS table_name,
            trigger_record.tgenabled, trigger_record.tgisinternal,
            trigger_record.tgconstraint <> 0 AS is_constraint,
            trigger_record.tgdeferrable, trigger_record.tginitdeferred,
            pg_get_triggerdef(trigger_record.oid, true) AS trigger_definition,
            procedure_record.proname, procedure_record.prosecdef,
            procedure_record.proconfig,
            pg_get_functiondef(procedure_record.oid) AS function_definition
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
       JOIN pg_proc AS procedure_record ON procedure_record.oid = trigger_record.tgfoid
      WHERE namespace_record.nspname = current_schema()
        AND trigger_record.tgname = ANY($1::text[])`,
    [Object.keys(expected)],
  );
  const actual = new Map(result.rows.map((row) => [row.tgname, row]));
  for (const [name, contract] of Object.entries(expected)) {
    const trigger = actual.get(name);
    invariant(trigger, `Missing governed trigger ${name}.`);
    invariant(trigger.table_name === contract.table, `${name} is attached to the wrong table.`);
    invariant(trigger.tgenabled === 'O' && !trigger.tgisinternal, `${name} is disabled or internal.`);
    invariant(trigger.proname === contract.procedure, `${name} calls the wrong function.`);
    invariant(!trigger.prosecdef, `${name} must remain invoker-security.`);
    invariant(
      Array.isArray(trigger.proconfig) && trigger.proconfig.includes('search_path=pg_catalog'),
      `${name} must pin search_path to pg_catalog.`,
    );
    invariant(trigger.is_constraint === contract.constraint, `${name} has unexpected constraint-trigger state.`);
    invariant(trigger.tgdeferrable === contract.deferred, `${name} has unexpected deferrability.`);
    invariant(trigger.tginitdeferred === contract.deferred, `${name} has unexpected initial timing.`);
    const triggerDefinition = normalizeSql(trigger.trigger_definition);
    const functionDefinition = normalizeSql(trigger.function_definition);
    for (const fragment of contract.triggerFragments) {
      invariant(triggerDefinition.includes(fragment), `${name} is missing trigger fragment ${fragment}.`);
    }
    for (const fragment of contract.functionFragments) {
      invariant(functionDefinition.includes(fragment), `${name} is missing function fragment ${fragment}.`);
    }
  }
}

let savepointSequence = 0;

async function expectSqlFailure(client, query, parameters, expectedCode, expectedConstraint, label) {
  savepointSequence += 1;
  const savepoint = `progress_location_verify_${savepointSequence}`;
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
  invariant(caught.code === expectedCode, `${label} failed with unexpected SQLSTATE.`);
  if (expectedConstraint) {
    invariant(caught.constraint === expectedConstraint, `${label} failed on an unexpected constraint.`);
  }
}

async function expectDeferredSqlFailure(client, operation, expectedCode, expectedConstraint, label) {
  savepointSequence += 1;
  const savepoint = `progress_location_deferred_verify_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught = null;
  try {
    await operation();
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (error) {
    caught = error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === expectedCode, `${label} failed with unexpected SQLSTATE.`);
  invariant(caught.constraint === expectedConstraint, `${label} failed on an unexpected constraint.`);
}

const INSERT_SESSION_SQL = `
  INSERT INTO "ProgressEvidenceCaptureSession" (
    "id", "organizationId", "projectId", "workerId", "connectionId", "mediaAssetId",
    "status", "revision", "tokenHash", "privacyNoticeVersion",
    "privacyNoticeContentSha256", "issuedAt", "expiresAt", "createdAt", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, 'AWAITING_LOCATION', 0, $7,
    'gps-evidence-v1', $8, $9, $10, $9, $9
  )`;

function sessionParameters(fixtures, overrides = {}) {
  const id = overrides.id || `pelc_session_${randomUUID().replaceAll('-', '')}`;
  const issuedAt = overrides.issuedAt || new Date();
  return [
    id,
    overrides.organizationId || fixtures.organizationId,
    overrides.projectId || fixtures.projectId,
    overrides.workerId || fixtures.workerId,
    overrides.connectionId || fixtures.connectionId,
    overrides.mediaAssetId || fixtures.mediaAssetId,
    overrides.tokenHash || sha256Hex(`token:${id}`),
    overrides.noticeHash || sha256Hex('ObraSaaS device geolocation evidence notice v2'),
    issuedAt,
    overrides.expiresAt || new Date(issuedAt.getTime() + 5 * 60_000),
  ];
}

async function insertAvailableAsset(client, fixtures, id, project = 'primary') {
  const organizationId = project === 'primary' ? fixtures.organizationId : fixtures.otherOrganizationId;
  const projectId = project === 'primary' ? fixtures.projectId : fixtures.otherProjectId;
  const webhookEventId = project === 'primary' ? fixtures.webhookEventId : fixtures.otherWebhookEventId;
  const now = new Date();
  await client.query(
    `INSERT INTO "WhatsAppMediaAsset" (
       "id", "organizationId", "projectId", "webhookEventId",
       "providerMediaIdHash", "providerMessageIdHash", "mediaKind", "declaredMimeType",
       "status", "operationKeyHash", "requestFingerprint",
       "storageProvider", "storage", "fileName", "mimeType",
       "contentSha256", "sizeBytes", "storageLocatorHash",
       "purgeEligibleAt", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'IMAGE', 'image/jpeg', 'AVAILABLE', $7, $8,
       'vercel-blob', $9::jsonb, 'obra.jpg', 'image/jpeg', $10, 128, $11, $12, $13, $13
     )`,
    [
      id,
      organizationId,
      projectId,
      webhookEventId,
      sha256Hex(`provider-media:${id}`),
      sha256Hex(`provider-message:${id}`),
      sha256Hex(`media-operation:${id}`),
      sha256Hex(`media-request:${id}`),
      JSON.stringify({ provider: 'vercel-blob', pathname: `obrasaas/whatsapp/${id}` }),
      sha256Hex(`content:${id}`),
      sha256Hex(`locator:${id}`),
      new Date(now.getTime() + 60 * 60_000),
      now,
    ],
  );
}

function locationUpdateParameters(fixtures, overrides = {}) {
  const acceptedAt = overrides.acceptedAt || new Date(fixtures.issuedAt.getTime() + 1_000);
  return [
    overrides.sessionId || fixtures.sessionId,
    acceptedAt,
    overrides.latitude ?? -32.889458,
    overrides.longitude ?? -68.845839,
    overrides.accuracyMeters === null ? null : (overrides.accuracyMeters ?? 5),
    overrides.locationSource || 'WEBVIEW_GEOLOCATION',
    overrides.locationVerification || 'IN_GEOFENCE',
    overrides.distanceMeters === null ? null : (overrides.distanceMeters ?? 10),
    overrides.geofenceRadiusMeters === null ? null : (overrides.geofenceRadiusMeters ?? 100),
    overrides.operationKeyHash || sha256Hex(`capture-operation:${overrides.sessionId || fixtures.sessionId}`),
    overrides.requestFingerprint || sha256Hex(`capture-request:${overrides.sessionId || fixtures.sessionId}`),
  ];
}

const CAPTURE_LOCATION_SQL = `
  UPDATE "ProgressEvidenceCaptureSession"
     SET "status" = 'LOCATION_CAPTURED',
         "revision" = "revision" + 1,
         "privacyAcceptedAt" = $2,
         "locationCapturedAt" = $2,
         "locationReceivedAt" = $2,
         "latitude" = $3,
         "longitude" = $4,
         "accuracyMeters" = $5,
         "locationSource" = $6,
         "locationVerification" = $7,
         "distanceMeters" = $8,
         "geofenceRadiusMeters" = $9,
         "operationKeyHash" = $10,
         "requestFingerprint" = $11,
         "updatedAt" = $2
   WHERE "id" = $1`;

async function assertTransactionalSmoke(client) {
  const suffix = randomUUID().replaceAll('-', '');
  const now = new Date();
  const fixtures = {
    organizationId: `pelc_org_${suffix}`,
    otherOrganizationId: `pelc_other_org_${suffix}`,
    projectId: `pelc_project_${suffix}`,
    otherProjectId: `pelc_other_project_${suffix}`,
    workerId: `pelc_worker_${suffix}`,
    otherWorkerId: `pelc_other_worker_${suffix}`,
    connectionId: `pelc_connection_${suffix}`,
    otherConnectionId: `pelc_other_connection_${suffix}`,
    webhookEventId: `pelc_webhook_${suffix}`,
    otherWebhookEventId: `pelc_other_webhook_${suffix}`,
    mediaAssetId: `pelc_media_${suffix}`,
    secondMediaAssetId: `pelc_media_second_${suffix}`,
    spareMediaAssetId: `pelc_media_spare_${suffix}`,
    otherMediaAssetId: `pelc_media_other_${suffix}`,
    taskId: `pelc_task_${suffix}`,
    sessionId: `pelc_session_${suffix}`,
    secondSessionId: `pelc_session_second_${suffix}`,
    thirdSessionId: `pelc_session_third_${suffix}`,
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, 'Progress location verifier', $2, $3, $3),
            ($4, 'Progress location verifier other', $5, $3, $3)`,
    [fixtures.organizationId, `pelc-${suffix}`, now, fixtures.otherOrganizationId, `pelc-other-${suffix}`],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Progress location project', $3, $4, $4),
            ($5, $6, 'Progress location other project', $7, $4, $4)`,
    [
      fixtures.projectId, fixtures.organizationId, `pelc-project-${suffix}`, now,
      fixtures.otherProjectId, fixtures.otherOrganizationId, `pelc-other-project-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Worker" ("id", "projectId", "phone", "name", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'Verifier worker', $4, $4),
            ($5, $6, $7, 'Verifier other worker', $4, $4)`,
    [
      fixtures.workerId, fixtures.projectId, `+549261${suffix.slice(0, 7)}`, now,
      fixtures.otherWorkerId, fixtures.otherProjectId, `+549262${suffix.slice(0, 7)}`,
    ],
  );
  await client.query(
    `INSERT INTO "WhatsAppConnection" (
       "id", "projectId", "phoneNumberId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $4), ($5, $6, $7, $4, $4)`,
    [
      fixtures.connectionId, fixtures.projectId, `phone-${suffix}`, now,
      fixtures.otherConnectionId, fixtures.otherProjectId, `phone-other-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "WebhookEvent" (
       "id", "projectId", "provider", "externalId", "eventType", "payload", "createdAt", "updatedAt"
     ) VALUES ($1, $2, 'whatsapp', $3, 'message', '{}'::jsonb, $4, $4),
              ($5, $6, 'whatsapp', $7, 'message', '{}'::jsonb, $4, $4)`,
    [
      fixtures.webhookEventId, fixtures.projectId, `wamid.${suffix}`, now,
      fixtures.otherWebhookEventId, fixtures.otherProjectId, `wamid.other.${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Task" ("id", "projectId", "title", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Verifier task', $3, $3)`,
    [fixtures.taskId, fixtures.projectId, now],
  );

  await insertAvailableAsset(client, fixtures, fixtures.mediaAssetId);
  await insertAvailableAsset(client, fixtures, fixtures.secondMediaAssetId);
  await insertAvailableAsset(client, fixtures, fixtures.spareMediaAssetId);
  await insertAvailableAsset(client, fixtures, fixtures.otherMediaAssetId, 'other');

  fixtures.issuedAt = now;
  const primarySession = sessionParameters(fixtures, {
    id: fixtures.sessionId,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
  });
  await client.query(INSERT_SESSION_SQL, primarySession);

  await client.query(
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, {
      id: fixtures.secondSessionId,
      mediaAssetId: fixtures.secondMediaAssetId,
      issuedAt: now,
    }),
  );

  await expectSqlFailure(
    client,
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, { mediaAssetId: fixtures.mediaAssetId }),
    '23505',
    'ProgressEvidenceCaptureSession_project_media_asset_key',
    'Progress evidence location exact photo binding',
  );
  await expectSqlFailure(
    client,
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, { workerId: fixtures.otherWorkerId, mediaAssetId: fixtures.spareMediaAssetId }),
    '23503',
    'ProgressEvidenceCaptureSession_worker_scope_fkey',
    'Progress evidence location cross-project worker scope',
  );
  await expectSqlFailure(
    client,
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, { connectionId: fixtures.otherConnectionId, mediaAssetId: fixtures.spareMediaAssetId }),
    '23503',
    'ProgressEvidenceCaptureSession_connection_scope_fkey',
    'Progress evidence location cross-project connection scope',
  );
  await expectSqlFailure(
    client,
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, { mediaAssetId: fixtures.otherMediaAssetId }),
    '23503',
    'ProgressEvidenceCaptureSession_media_asset_scope_fkey',
    'Progress evidence location cross-project media scope',
  );
  await expectSqlFailure(
    client,
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, { organizationId: fixtures.otherOrganizationId, mediaAssetId: fixtures.spareMediaAssetId }),
    '23503',
    'ProgressEvidenceCaptureSession_project_scope_fkey',
    'Progress evidence location cross-tenant project scope',
  );

  await client.query(
    INSERT_SESSION_SQL,
    sessionParameters(fixtures, {
      id: fixtures.thirdSessionId,
      mediaAssetId: fixtures.spareMediaAssetId,
      issuedAt: now,
    }),
  );

  await expectSqlFailure(
    client,
    CAPTURE_LOCATION_SQL,
    locationUpdateParameters(fixtures, {
      acceptedAt: new Date(now.getTime() + 61_000),
    }),
    '23514',
    'ProgressEvidenceCaptureSession_location_bundle_check',
    'Progress evidence geolocation expiry guard',
  );
  await expectSqlFailure(
    client,
    CAPTURE_LOCATION_SQL,
    locationUpdateParameters(fixtures, {
      distanceMeters: 99,
      accuracyMeters: 5,
      geofenceRadiusMeters: 100,
    }),
    '23514',
    'ProgressEvidenceCaptureSession_location_bundle_check',
    'Progress evidence conservative geofence guard',
  );

  const capturedAt = new Date(now.getTime() + 1_000);
  const locationParameters = locationUpdateParameters(fixtures, { acceptedAt: capturedAt });
  await client.query(CAPTURE_LOCATION_SQL, locationParameters);

  await expectSqlFailure(
    client,
    `UPDATE "ProgressEvidenceCaptureSession"
        SET "latitude" = "latitude" + 0.0000001,
            "revision" = "revision" + 1,
            "updatedAt" = $2
      WHERE "id" = $1`,
    [fixtures.sessionId, new Date(now.getTime() + 2_000)],
    '55000',
    'ProgressEvidenceCaptureSession_location_immutability_guard',
    'Progress evidence captured geolocation immutability',
  );
  await expectSqlFailure(
    client,
    `UPDATE "ProgressEvidenceCaptureSession"
        SET "requestFingerprint" = $2,
            "revision" = "revision" + 1,
            "updatedAt" = $3
      WHERE "id" = $1`,
    [fixtures.sessionId, sha256Hex('tampered capture request'), new Date(now.getTime() + 2_000)],
    '55000',
    'ProgressEvidenceCaptureSession_operation_immutability_guard',
    'Progress evidence capture operation immutability',
  );

  const consumedAt = new Date(now.getTime() + 2 * 60_000);
  const consumeSql = `UPDATE "ProgressEvidenceCaptureSession"
     SET "status" = 'CONSUMED', "revision" = "revision" + 1,
         "consumedAt" = $2, "updatedAt" = $2
   WHERE "id" = $1`;

  await expectDeferredSqlFailure(
    client,
    async () => client.query(consumeSql, [fixtures.sessionId, consumedAt]),
    '23514',
    'ProgressEvidenceCaptureSession_consumed_evidence_guard',
    'Progress evidence consumed session requires canonical evidence',
  );

  const insertEvidenceSql = `INSERT INTO "ProgressEvidence" (
    "id", "projectId", "taskId", "authorWorkerId", "capturedAt", "media",
    "latitude", "longitude", "accuracyMeters", "locationCaptureSessionId",
    "locationCapturedAt", "locationSource", "locationVerification",
    "createdAt", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, '{}'::jsonb, $6, $7, $8, $9, $10, $11, $12, $5, $5
  )`;
  const evidenceId = `pelc_evidence_${suffix}`;
  const evidenceParameters = [
    evidenceId,
    fixtures.projectId,
    fixtures.taskId,
    fixtures.workerId,
    consumedAt,
    locationParameters[2],
    locationParameters[3],
    locationParameters[4],
    fixtures.sessionId,
    capturedAt,
    locationParameters[5],
    locationParameters[6],
  ];

  await expectDeferredSqlFailure(
    client,
    async () => {
      await client.query(consumeSql, [fixtures.sessionId, consumedAt]);
      const mismatched = [...evidenceParameters];
      mismatched[5] += 0.0000001;
      await client.query(insertEvidenceSql, mismatched);
    },
    '23514',
    'ProgressEvidenceCaptureSession_evidence_copy_guard',
    'Progress evidence exact capture copy guard',
  );

  await client.query(consumeSql, [fixtures.sessionId, consumedAt]);
  await client.query(insertEvidenceSql, evidenceParameters);
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');

  await expectSqlFailure(
    client,
    `UPDATE "ProgressEvidence"
        SET "longitude" = "longitude" + 0.0000001,
            "revision" = "revision" + 1,
            "updatedAt" = $2
      WHERE "id" = $1`,
    [evidenceId, new Date(consumedAt.getTime() + 1_000)],
    '55000',
    'ProgressEvidence_location_immutability_guard',
    'Progress evidence linked location immutability',
  );
  await expectSqlFailure(
    client,
    `UPDATE "ProgressEvidenceCaptureSession"
        SET "status" = 'EXPIRED', "revision" = "revision" + 1,
            "consumedAt" = NULL, "expiredAt" = $2, "updatedAt" = $2
      WHERE "id" = $1`,
    [fixtures.sessionId, new Date(consumedAt.getTime() + 2_000)],
    '55000',
    'ProgressEvidenceCaptureSession_terminal_immutability_guard',
    'Progress evidence terminal session immutability',
  );

  await expectSqlFailure(
    client,
    `DELETE FROM "ProgressEvidence" WHERE "id" = $1`,
    [evidenceId],
    '55000',
    'ProgressEvidence_location_delete_guard',
    'Progress evidence canonical location delete guard',
  );
  await expectSqlFailure(
    client,
    `DELETE FROM "ProgressEvidenceCaptureSession" WHERE "id" = $1`,
    [fixtures.sessionId],
    '55000',
    'ProgressEvidenceCaptureSession_consumed_delete_guard',
    'Progress evidence consumed capture delete guard',
  );

  const cancelledAt = new Date(now.getTime() + 2_000);
  await client.query(
    `UPDATE "ProgressEvidenceCaptureSession"
        SET "status" = 'CANCELLED', "revision" = "revision" + 1,
            "cancelledAt" = $2, "updatedAt" = $2
      WHERE "id" = $1`,
    [fixtures.secondSessionId, cancelledAt],
  );

  const declaredAt = new Date(now.getTime() + 2_000);
  await client.query(
    CAPTURE_LOCATION_SQL,
    locationUpdateParameters(fixtures, {
      sessionId: fixtures.thirdSessionId,
      acceptedAt: declaredAt,
      accuracyMeters: null,
      locationSource: 'WHATSAPP_DECLARED',
      locationVerification: 'DECLARED_ONLY',
      distanceMeters: null,
      geofenceRadiusMeters: null,
    }),
  );
  await expectSqlFailure(
    client,
    `UPDATE "ProgressEvidenceCaptureSession"
        SET "status" = 'CANCELLED', "revision" = "revision" + 1,
            "cancelledAt" = $2, "updatedAt" = $2
      WHERE "id" = $1`,
    [fixtures.thirdSessionId, new Date(now.getTime() + 3_000)],
    '23514',
    'ProgressEvidenceCaptureSession_transition_guard',
    'Progress evidence captured location cancellation guard',
  );
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-progress-evidence-location-capture-migration-verifier',
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
  invariant(activeSchema.rows[0]?.name === databaseSchema, 'PostgreSQL did not activate the configured location capture schema.');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigration(client);
  await assertEnums(client);
  await assertColumnSet(
    client,
    'ProgressEvidenceLocationRateBucket',
    EXPECTED_RATE_BUCKET_COLUMNS,
  );
  await assertColumnSet(client, 'ProgressEvidenceCaptureSession', EXPECTED_SESSION_COLUMNS);
  await assertColumnSet(client, 'ProgressEvidence', EXPECTED_EVIDENCE_COLUMNS);
  await assertChecks(client);
  await assertIndexes(client);
  await assertForeignKeys(client);
  await assertTriggers(client);
  await assertTransactionalSmoke(client);
  console.log('Verified progress evidence location capture migration: exact photo binding, scoped device-geolocation provenance, immutable consent and rollback-only lifecycle smoke.');
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  await client.end();
}
