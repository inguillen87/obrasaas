import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import pg from 'pg';

import {
  buildWorkerPersonDiscoveryManifest,
  dataSubjectManifestSha256,
  discoverWorkerPersonData,
  privacyAdminAttestationEvidenceSha256,
  privacyDiscoveryCatalogDescriptor,
  privacyOperationKeyHash,
  privacyRequestFingerprint,
  PRIVACY_DISCOVERY_CATALOG_SHA256,
  PRIVACY_DISCOVERY_CATALOG_VERSION,
} from '../src/lib/privacy-discovery.js';

const CONNECTION_ENV = 'DATA_SUBJECT_DISCOVERY_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'DATA_SUBJECT_DISCOVERY_MIGRATION_SCHEMA';
const MIGRATION = '20260729140000_data_subject_discovery_foundation';
const SCHEMA_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const HELP = `Usage:
  npm run verify:data-subject-discovery-migration

Required environment variables:
  ${CONNECTION_ENV}   Dedicated PostgreSQL/PGlite verification database URL.
  ${SCHEMA_ENV}       Explicit schema containing the applied migration.

DATABASE_URL is deliberately ignored. Remote PostgreSQL requires sslmode=verify-full.
The verifier uses rollback-only fixtures but must still target a dedicated database/schema.`;

const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');
if (!helpRequested) assert.deepEqual(args, [], `Unknown arguments: ${args.join(' ')}`);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseConnectionString(value) {
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

function connectionConfiguration() {
  const value = String(process.env[CONNECTION_ENV] || '').trim();
  const schema = String(process.env[SCHEMA_ENV] || '').trim();
  invariant(value, `${CONNECTION_ENV} is required; DATABASE_URL is deliberately ignored.`);
  invariant(schema, `${SCHEMA_ENV} is required; the schema must be explicit.`);
  invariant(SCHEMA_PATTERN.test(schema), `${SCHEMA_ENV} is not a safe PostgreSQL identifier.`);

  const parsed = parseConnectionString(value);
  const declaredSchemas = parsed.searchParams.getAll('schema');
  invariant(
    declaredSchemas.length === 0 || declaredSchemas.every((entry) => entry === schema),
    `${SCHEMA_ENV} conflicts with the schema declared in ${CONNECTION_ENV}.`,
  );
  parsed.searchParams.delete('schema');

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  if (!local && hostname.endsWith('.neon.tech')) {
    parsed.searchParams.set('sslmode', 'verify-full');
  } else if (!local) {
    invariant(
      parsed.searchParams.get('sslmode') === 'verify-full',
      `${CONNECTION_ENV} must use sslmode=verify-full for a remote PostgreSQL host.`,
    );
  }
  return { connectionString: parsed.toString(), local, schema };
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function normalizeDefinition(value) {
  return String(value || '').replaceAll('"', '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sameValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

async function assertMigrationLedger(client, schema, local) {
  const relation = await client.query('SELECT to_regclass($1) AS name', [
    `${schema}._prisma_migrations`,
  ]);
  if (!relation.rows[0]?.name) {
    invariant(
      local,
      'Remote verification requires the Prisma migration ledger.',
    );
    return 'untracked-local-catalog';
  }
  const result = await client.query(
    `SELECT "finished_at", "rolled_back_at"
       FROM ${quoteIdentifier(schema)}."_prisma_migrations"
      WHERE "migration_name" = $1`,
    [MIGRATION],
  );
  invariant(result.rows.length === 1, `Migration ${MIGRATION} is absent from the Prisma ledger.`);
  invariant(
    result.rows[0].finished_at && !result.rows[0].rolled_back_at,
    `Migration ${MIGRATION} is not durably applied.`,
  );
  return 'tracked';
}

const ENUMS = Object.freeze({
  DataSubjectKind: ['TENANT_MEMBER', 'WORKER_PERSON'],
  DataSubjectRequestType: ['ACCESS', 'CORRECTION', 'ERASURE', 'RESTRICTION', 'PORTABILITY', 'OBJECTION'],
  DataSubjectRequestStatus: [
    'RECEIVED',
    'AUTHORITY_ATTESTED',
    'DISCOVERING',
    'DISCOVERED',
    'DISCOVERY_BLOCKED',
    'DISCOVERY_FAILED',
    'REJECTED',
    'CANCELLED',
  ],
  DataSubjectManifestOutcome: ['COMPLETE', 'BLOCKED'],
  DataSubjectDiscoveryItemKind: ['RECORD', 'COVERAGE_BLOCKER'],
  DataSubjectDataCategory: ['PERSONAL', 'LABOR', 'FINANCIAL', 'CONVERSATION', 'MEDIA', 'AI_DERIVED', 'AUDIT'],
  DataSubjectDisposition: [
    'REVIEW_REQUIRED',
    'ERASE_CANDIDATE',
    'CRYPTO_ERASE_CANDIDATE',
    'PSEUDONYMIZE_CANDIDATE',
    'KEEP_MINIMAL',
    'EXTERNAL_DELETE_CANDIDATE',
  ],
});

const TABLES = Object.freeze([
  'DataSubjectRequest',
  'DataSubjectDiscoveryManifest',
  'DataSubjectDiscoveryItem',
]);

const CHECKS = Object.freeze({
  DataSubjectRequest_exact_subject_check: ['tenant_member', 'worker_person'],
  DataSubjectRequest_catalog_v1_pin_check: [
    PRIVACY_DISCOVERY_CATALOG_VERSION,
    PRIVACY_DISCOVERY_CATALOG_SHA256,
  ],
  DataSubjectDiscoveryManifest_shape_check: ['itemcount <= 1024', 'complete', 'blocked'],
  DataSubjectDiscoveryManifest_catalog_v1_pin_check: [
    PRIVACY_DISCOVERY_CATALOG_VERSION,
    PRIVACY_DISCOVERY_CATALOG_SHA256,
    "outcome = 'blocked'",
  ],
  DataSubjectDiscoveryItem_ordinal_check: ['ordinal >= 0', 'ordinal <= 1023'],
  DataSubjectDiscoveryItem_kind_check: ['record', 'coverage_blocker'],
  DataSubjectDiscoveryItem_disposition_check: ['review_required', 'retentionpolicyversion'],
});

const FOREIGN_KEYS = Object.freeze([
  'DataSubjectRequest_organizationId_fkey',
  'DataSubjectRequest_subject_membership_fkey',
  'DataSubjectRequest_worker_person_fkey',
  'DataSubjectRequest_received_by_fkey',
  'DataSubjectRequest_attested_by_fkey',
  'DataSubjectRequest_completed_by_fkey',
  'DataSubjectDiscoveryManifest_organizationId_fkey',
  'DataSubjectDiscoveryManifest_request_fkey',
  'DataSubjectDiscoveryManifest_sealed_by_fkey',
  'DataSubjectDiscoveryItem_organizationId_fkey',
  'DataSubjectDiscoveryItem_manifest_fkey',
]);

const TRIGGERS = Object.freeze([
  'DataSubjectRequest_insert_guard',
  'DataSubjectRequest_lifecycle_guard',
  'DataSubjectRequest_no_delete',
  'DataSubjectRequest_no_truncate',
  'DataSubjectDiscoveryManifest_seal',
  'DataSubjectDiscoveryManifest_terminal_check',
  'DataSubjectDiscoveryManifest_append_only',
  'DataSubjectDiscoveryManifest_no_truncate',
  'DataSubjectDiscoveryItem_before_seal',
  'DataSubjectDiscoveryItem_append_only',
  'DataSubjectDiscoveryItem_no_truncate',
]);

const INDEXES = Object.freeze([
  'DataSubjectRequest_org_operation_key',
  'DataSubjectDiscoveryManifest_org_request_key',
  'DataSubjectDiscoveryManifest_scope_key',
  'DataSubjectDiscoveryManifest_org_operation_key',
  'DataSubjectDiscoveryItem_org_manifest_ordinal_key',
  'DataSubjectDiscoveryItem_org_manifest_blocker_key',
]);
const REQUEST_RECEIVED_INDEX = 'DataSubjectRequest_org_received_idx';

async function assertInstalledObjects(client) {
  const tables = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema() AND tablename = ANY($1::text[])`,
    [TABLES],
  );
  assert.deepEqual(
    tables.rows.map((row) => row.tablename).sort(),
    [...TABLES].sort(),
    'The three PRO-05A tables must be installed.',
  );

  const enums = await client.query(
    `SELECT enum_type.typname AS name,
            array_agg(enum_value.enumlabel::text ORDER BY enum_value.enumsortorder) AS labels
       FROM pg_type AS enum_type
       JOIN pg_enum AS enum_value ON enum_value.enumtypid = enum_type.oid
       JOIN pg_namespace AS enum_schema ON enum_schema.oid = enum_type.typnamespace
      WHERE enum_schema.nspname = current_schema()
        AND enum_type.typname = ANY($1::text[])
      GROUP BY enum_type.typname`,
    [Object.keys(ENUMS)],
  );
  const enumMap = new Map(enums.rows.map((row) => [row.name, row.labels]));
  for (const [name, labels] of Object.entries(ENUMS)) {
    invariant(sameValues(enumMap.get(name) || [], labels), `Enum ${name} has drifted.`);
  }

  const constraints = await client.query(
    `SELECT constraint_state.conname AS name,
            constraint_state.contype AS type,
            constraint_state.convalidated AS validated,
            constraint_state.condeferrable AS deferrable,
            constraint_state.condeferred AS initially_deferred,
            constraint_state.confdeltype AS delete_action,
            pg_get_constraintdef(constraint_state.oid, TRUE) AS definition
       FROM pg_constraint AS constraint_state
       JOIN pg_class AS source_table ON source_table.oid = constraint_state.conrelid
       JOIN pg_namespace AS source_schema ON source_schema.oid = source_table.relnamespace
      WHERE source_schema.nspname = current_schema()
        AND constraint_state.conname = ANY($1::text[])`,
    [[...Object.keys(CHECKS), ...FOREIGN_KEYS, 'DataSubjectDiscoveryManifest_terminal_check']],
  );
  const constraintMap = new Map(constraints.rows.map((row) => [row.name, row]));
  for (const [name, fragments] of Object.entries(CHECKS)) {
    const row = constraintMap.get(name);
    invariant(row?.type === 'c' && row.validated, `CHECK ${name} is absent or unvalidated.`);
    const definition = normalizeDefinition(row.definition);
    for (const fragment of fragments) {
      invariant(definition.includes(fragment), `CHECK ${name} is missing ${fragment}.`);
    }
  }
  for (const name of FOREIGN_KEYS) {
    const row = constraintMap.get(name);
    invariant(row?.type === 'f' && row.validated, `Foreign key ${name} is absent or unvalidated.`);
    invariant(row.delete_action === 'r', `Foreign key ${name} must use ON DELETE RESTRICT.`);
  }
  const itemScope = constraintMap.get('DataSubjectDiscoveryItem_manifest_fkey');
  invariant(
    itemScope?.deferrable && itemScope?.initially_deferred,
    'The child-first manifest foreign key must be initially deferred.',
  );
  const terminal = constraintMap.get('DataSubjectDiscoveryManifest_terminal_check');
  invariant(
    terminal?.deferrable && terminal?.initially_deferred,
    'The manifest terminal consistency check must be initially deferred.',
  );

  const triggers = await client.query(
    `SELECT trigger_state.tgname AS name,
            trigger_state.tgenabled AS enabled,
            trigger_state.tgdeferrable AS deferrable,
            trigger_state.tginitdeferred AS initially_deferred,
            procedure_state.proname AS function_name,
            procedure_state.proconfig AS function_config
       FROM pg_trigger AS trigger_state
       JOIN pg_class AS source_table ON source_table.oid = trigger_state.tgrelid
       JOIN pg_namespace AS source_schema ON source_schema.oid = source_table.relnamespace
       JOIN pg_proc AS procedure_state ON procedure_state.oid = trigger_state.tgfoid
      WHERE source_schema.nspname = current_schema()
        AND NOT trigger_state.tgisinternal
        AND trigger_state.tgname = ANY($1::text[])`,
    [TRIGGERS],
  );
  const triggerMap = new Map(triggers.rows.map((row) => [row.name, row]));
  for (const name of TRIGGERS) {
    const row = triggerMap.get(name);
    invariant(row?.enabled === 'A', `Trigger ${name} must exist as ENABLE ALWAYS.`);
    invariant(
      Array.isArray(row.function_config)
        && row.function_config.includes('search_path=pg_catalog'),
      `Trigger function ${row?.function_name || name} must pin search_path.`,
    );
  }
  invariant(
    triggerMap.get('DataSubjectDiscoveryManifest_terminal_check')?.deferrable
      && triggerMap.get('DataSubjectDiscoveryManifest_terminal_check')?.initially_deferred,
    'The terminal constraint trigger must be initially deferred.',
  );

  const indexes = await client.query(
    `SELECT index_table.relname AS name,
            index_state.indisunique AS unique,
            index_state.indisvalid AS valid,
            index_state.indisready AS ready
       FROM pg_index AS index_state
       JOIN pg_class AS index_table ON index_table.oid = index_state.indexrelid
       JOIN pg_namespace AS index_schema ON index_schema.oid = index_table.relnamespace
      WHERE index_schema.nspname = current_schema()
        AND index_table.relname = ANY($1::text[])`,
    [INDEXES],
  );
  const indexMap = new Map(indexes.rows.map((row) => [row.name, row]));
  for (const name of INDEXES) {
    const row = indexMap.get(name);
    invariant(row?.unique && row.valid && row.ready, `Unique index ${name} is absent or invalid.`);
  }
  const requestReceivedIndex = await client.query(
    `SELECT index_state.indisunique AS unique,
            index_state.indisvalid AS valid,
            index_state.indisready AS ready,
            (
              SELECT string_agg(indexed_attribute.attname, ',' ORDER BY index_key.position)
                FROM unnest(index_state.indkey::smallint[]) WITH ORDINALITY
                  AS index_key(attribute_number, position)
                JOIN pg_attribute AS indexed_attribute
                  ON indexed_attribute.attrelid = index_state.indrelid
                 AND indexed_attribute.attnum = index_key.attribute_number
               WHERE index_key.position <= index_state.indnkeyatts
            ) AS key_columns
       FROM pg_index AS index_state
       JOIN pg_class AS index_table ON index_table.oid = index_state.indexrelid
       JOIN pg_namespace AS index_schema ON index_schema.oid = index_table.relnamespace
      WHERE index_schema.nspname = current_schema()
        AND index_table.relname = $1`,
    [REQUEST_RECEIVED_INDEX],
  );
  const requestReceived = requestReceivedIndex.rows[0];
  invariant(
    requestReceived
      && !requestReceived.unique
      && requestReceived.valid
      && requestReceived.ready
      && requestReceived.key_columns === 'organizationId,receivedAt',
    `${REQUEST_RECEIVED_INDEX} must be a valid non-unique (organizationId, receivedAt) index.`,
  );

  const timestampColumns = await client.query(
    `SELECT table_name, column_name, data_type, datetime_precision
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name, column_name) IN (
          ('DataSubjectRequest', 'receivedAt'),
          ('DataSubjectRequest', 'attestedAt'),
          ('DataSubjectRequest', 'discoveryStartedAt'),
          ('DataSubjectRequest', 'terminalAt'),
          ('DataSubjectDiscoveryManifest', 'sourceSnapshotAt'),
          ('DataSubjectDiscoveryManifest', 'sealedAt'),
          ('DataSubjectDiscoveryItem', 'observedAt'),
          ('DataSubjectDiscoveryItem', 'retentionUntil')
        )`,
  );
  invariant(timestampColumns.rows.length === 8, 'Every governed privacy timestamp must exist.');
  invariant(
    timestampColumns.rows.every((row) => (
      row.data_type === 'timestamp with time zone' && row.datetime_precision === 3
    )),
    'Every governed privacy timestamp must be TIMESTAMPTZ(3).',
  );
}

function pgAdapter(client, afterReadOnly = null) {
  return {
    async $executeRawUnsafe(sql, ...parameters) {
      const result = await client.query(sql, parameters);
      if (/^SET TRANSACTION READ ONLY$/i.test(sql.trim()) && afterReadOnly) {
        await afterReadOnly();
      }
      return result.rowCount || 0;
    },
    async $queryRawUnsafe(sql, ...parameters) {
      return (await client.query(sql, parameters)).rows;
    },
  };
}

async function assertReadOnlyDiscovery(client, schema) {
  const fixtureKey = Buffer.alloc(32, 0x52);
  let transactionOpen = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    transactionOpen = true;
    const discovery = await discoverWorkerPersonData(
      pgAdapter(client, async () => {
        await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
        await client.query("SET LOCAL TIME ZONE 'Pacific/Chatham'");
      }),
      {
        organizationId: 'privacy-read-only-org-does-not-exist',
        personId: 'privacy-read-only-person-does-not-exist',
        requestId: 'privacy-read-only-request',
        requestOperationKeyHash: 'a'.repeat(64),
        requestFingerprint: 'b'.repeat(64),
        sealedByMembershipId: 'privacy-read-only-admin',
        key: fixtureKey,
        keyId: 'privacy-verifier-key-v1',
      },
    );
    invariant(discovery.manifest.outcome === 'BLOCKED', 'Read-only discovery must fail closed.');
    const readOnly = await client.query('SHOW transaction_read_only');
    invariant(readOnly.rows[0]?.transaction_read_only === 'on', 'Discovery did not make its transaction read-only.');

    let caught = null;
    try {
      await client.query(
        `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
         VALUES ('privacy-read-only-write', 'forbidden', 'privacy-read-only-write', CURRENT_TIMESTAMP)`,
      );
    } catch (error) {
      caught = error;
    }
    invariant(caught?.code === '25006', 'Read-only discovery must reject writes with SQLSTATE 25006.');
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  }
}

let savepointSequence = 0;

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  if (typeof value === 'number') {
    invariant(Number.isFinite(value), 'Verifier SQL numbers must be finite.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function renderCommand(command) {
  invariant(command && typeof command.text === 'string', 'Expected one SQL verification command.');
  const values = command.values || [];
  return command.text.replace(/\$(\d+)/g, (_match, rawIndex) => {
    const index = Number(rawIndex) - 1;
    invariant(index >= 0 && index < values.length, `Missing verifier SQL parameter $${rawIndex}.`);
    return sqlLiteral(values[index]);
  });
}

async function installLocalFailureCapture(client) {
  await client.query(`
    CREATE FUNCTION pg_temp.obrasaas_capture_expected_failure(command TEXT)
    RETURNS TABLE(error_code TEXT, constraint_name TEXT, error_message TEXT)
    LANGUAGE plpgsql
    AS $$
    DECLARE
      observed_code TEXT;
      observed_constraint TEXT;
      observed_message TEXT;
    BEGIN
      BEGIN
        EXECUTE command;
        RAISE EXCEPTION 'obrasaas verifier statement unexpectedly succeeded'
          USING ERRCODE = 'ZX001';
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
          observed_code = RETURNED_SQLSTATE,
          observed_constraint = CONSTRAINT_NAME,
          observed_message = MESSAGE_TEXT;
      END;
      IF observed_code = 'ZX001'
        AND observed_message = 'obrasaas verifier statement unexpectedly succeeded'
      THEN
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT;
      ELSE
        RETURN QUERY SELECT observed_code, nullif(observed_constraint, ''), observed_message;
      END IF;
    END;
    $$
  `);
}

async function expectSqlFailure(client, local, operation, code, constraint, label) {
  savepointSequence += 1;
  const savepoint = `privacy_discovery_verify_${savepointSequence}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let caught = null;
  try {
    const command = await operation();
    if (local) {
      const captured = await client.query(
        'SELECT * FROM pg_temp.obrasaas_capture_expected_failure($1)',
        [renderCommand(command)],
      );
      const row = captured.rows[0];
      if (row?.error_code) {
        caught = {
          code: row.error_code,
          constraint: row.constraint_name,
          message: row.error_message,
        };
      }
    } else {
      try {
        await client.query(command);
      } catch (error) {
        caught = error;
      }
    }
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(() => undefined);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`).catch(() => undefined);
    throw error;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  invariant(caught, `${label} unexpectedly succeeded.`);
  invariant(caught.code === code, `${label} failed with SQLSTATE ${caught.code || 'unknown'}, expected ${code}.`);
  if (constraint) {
    invariant(caught.constraint === constraint, `${label} failed on ${caught.constraint || 'no constraint'}.`);
  }
}

function hashFixture(seed) {
  return seed.toString(16).padStart(64, '0');
}

async function seedTenantFixtures(client, suffix) {
  const fixtures = {
    suffix,
    organizationA: `privacy_org_a_${suffix}`,
    organizationB: `privacy_org_b_${suffix}`,
    userA: `privacy_user_a_${suffix}`,
    userB: `privacy_user_b_${suffix}`,
    adminA: `privacy_admin_a_${suffix}`,
    adminB: `privacy_admin_b_${suffix}`,
    personA: `privacy_person_a_${suffix}`,
    personB: `privacy_person_b_${suffix}`,
  };
  for (const [organizationId, marker] of [
    [fixtures.organizationA, 'a'],
    [fixtures.organizationB, 'b'],
  ]) {
    await client.query(
      `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [organizationId, `Privacy verifier ${marker}`, `${organizationId}-slug`],
    );
  }
  for (const [userId, marker] of [[fixtures.userA, 'a'], [fixtures.userB, 'b']]) {
    await client.query(
      `INSERT INTO "PlatformUser" (
         "id", "clerkUserId", "primaryEmail", "fullName", "updatedAt"
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        userId,
        `clerk_privacy_${marker}_${suffix}`,
        `privacy-${marker}-${suffix}@verifier.invalid`,
        `Privacy verifier ${marker}`,
      ],
    );
  }
  for (const [membershipId, organizationId, userId] of [
    [fixtures.adminA, fixtures.organizationA, fixtures.userA],
    [fixtures.adminB, fixtures.organizationB, fixtures.userB],
  ]) {
    await client.query(
      `INSERT INTO "TenantMembership" (
         "id", "organizationId", "userId", "tenantRole", "status", "updatedAt"
       ) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)`,
      [membershipId, organizationId, userId],
    );
  }
  for (const [personId, organizationId] of [
    [fixtures.personA, fixtures.organizationA],
    [fixtures.personB, fixtures.organizationB],
  ]) {
    await client.query(
      `INSERT INTO "WorkerPerson" ("id", "organizationId", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [personId, organizationId],
    );
  }
  return fixtures;
}

function insertRequestCommand({
  id,
  organizationId,
  personId,
  actorMembershipId,
  operationKeyHash,
  requestFingerprint,
}) {
  return {
    text: `INSERT INTO "DataSubjectRequest" (
       "id", "organizationId", "type", "subjectKind", "workerPersonId",
       "operationKeyHash", "requestFingerprint", "receivedByMembershipId", "updatedAt"
     ) VALUES ($1, $2, 'ACCESS', 'WORKER_PERSON', $3, $4, $5, $6, CURRENT_TIMESTAMP)
     RETURNING *`,
    values: [id, organizationId, personId, operationKeyHash, requestFingerprint, actorMembershipId],
  };
}

async function insertRequest(client, input) {
  return (await client.query(insertRequestCommand(input))).rows[0];
}

async function prepareDiscoveringRequest(client, fixtures, marker) {
  const id = `privacy_request_${marker}_${fixtures.suffix}`;
  const operationKeyHash = privacyOperationKeyHash(
    fixtures.organizationA,
    `privacy-idempotency-${marker}-${fixtures.suffix}`,
  );
  const requestFingerprint = privacyRequestFingerprint({
    organizationId: fixtures.organizationA,
    personId: fixtures.personA,
    requestType: 'ACCESS',
  });
  await insertRequest(client, {
    id,
    organizationId: fixtures.organizationA,
    personId: fixtures.personA,
    actorMembershipId: fixtures.adminA,
    operationKeyHash,
    requestFingerprint,
  });
  const evidence = privacyAdminAttestationEvidenceSha256({
    organizationId: fixtures.organizationA,
    requestId: id,
    personId: fixtures.personA,
    requestType: 'ACCESS',
    actorMembershipId: fixtures.adminA,
  });
  await client.query(
    `UPDATE "DataSubjectRequest"
        SET "status" = 'AUTHORITY_ATTESTED',
            "attestedByMembershipId" = $2,
            "attestationPolicyVersion" = 'tenant-admin-privacy-intake-v1',
            "attestationMethod" = 'AUTHENTICATED_TENANT_ADMIN_ATTESTATION',
            "attestationEvidenceSha256" = $3,
            "discoveryCatalogVersion" = $4,
            "discoveryCatalogSha256" = $5,
            "revision" = "revision" + 1
      WHERE "organizationId" = $1 AND "id" = $6`,
    [
      fixtures.organizationA,
      fixtures.adminA,
      evidence,
      PRIVACY_DISCOVERY_CATALOG_VERSION,
      PRIVACY_DISCOVERY_CATALOG_SHA256,
      id,
    ],
  );
  await client.query(
    `UPDATE "DataSubjectRequest"
        SET "status" = 'DISCOVERING', "revision" = "revision" + 1
      WHERE "organizationId" = $1 AND "id" = $2`,
    [fixtures.organizationA, id],
  );
  const clock = await client.query(
    `SELECT greatest("discoveryStartedAt", statement_timestamp()) AS snapshot
       FROM "DataSubjectRequest"
      WHERE "organizationId" = $1 AND "id" = $2`,
    [fixtures.organizationA, id],
  );
  return { id, operationKeyHash, requestFingerprint, snapshot: clock.rows[0].snapshot };
}

function buildDiscovery(fixtures, request) {
  const rowsByFamily = new Map(
    privacyDiscoveryCatalogDescriptor().records.map((entry) => [entry.family, []]),
  );
  rowsByFamily.set('worker-person', [{
    id: fixtures.personA,
    recordVersion: request.snapshot.toISOString(),
  }]);
  return buildWorkerPersonDiscoveryManifest({
    organizationId: fixtures.organizationA,
    requestId: request.id,
    requestOperationKeyHash: request.operationKeyHash,
    requestFingerprint: request.requestFingerprint,
    sealedByMembershipId: fixtures.adminA,
    sourceSnapshotAt: request.snapshot,
    rowsByFamily,
    key: Buffer.alloc(32, 0x56),
    keyId: 'privacy-verifier-key-v1',
    extraBlockers: [
      {
        category: 'LABOR',
        resourceType: 'Worker',
        fieldSetCode: 'worker-project-link-v1',
        blockerCode: 'WORKER_PROJECT_LINKS_PARTIAL',
      },
      {
        category: 'PERSONAL',
        resourceType: 'WorkerOnboardingClaim',
        fieldSetCode: 'resolved-onboarding-claim-v1',
        blockerCode: 'WORKER_ONBOARDING_CLAIMS_PARTIAL',
      },
    ],
  });
}

async function insertItems(client, items) {
  for (const item of items) {
    await client.query(insertItemCommand(item));
  }
}

function insertItemCommand(item) {
  return {
    text: `INSERT INTO "DataSubjectDiscoveryItem" (
         "id", "organizationId", "requestId", "manifestId", "ordinal", "kind", "category",
         "sourceSystem", "resourceType", "fieldSetCode", "fingerprintKeyId",
         "locatorFingerprintHmac", "recordFingerprintHmac", "disposition",
         "retentionPolicyVersion", "retentionBasisCode", "retentionUntil", "blockerCode", "observedAt"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
       )`,
    values: [
      item.id,
      item.organizationId,
      item.requestId,
      item.manifestId,
      item.ordinal,
      item.kind,
      item.category,
      item.sourceSystem,
      item.resourceType,
      item.fieldSetCode,
      item.fingerprintKeyId,
      item.locatorFingerprintHmac,
      item.recordFingerprintHmac,
      item.disposition,
      item.retentionPolicyVersion,
      item.retentionBasisCode,
      item.retentionUntil,
      item.blockerCode,
      item.observedAt,
    ],
  };
}

function insertManifestCommand(manifest) {
  return {
    text: `INSERT INTO "DataSubjectDiscoveryManifest" (
       "id", "organizationId", "requestId", "outcome", "schemaVersion",
       "catalogVersion", "catalogSha256", "sourceSnapshotAt", "itemCount", "blockerCount",
       "manifestSha256", "operationKeyHash", "requestFingerprint", "sealedByMembershipId"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    values: [
      manifest.id,
      manifest.organizationId,
      manifest.requestId,
      manifest.outcome,
      manifest.schemaVersion,
      manifest.catalogVersion,
      manifest.catalogSha256,
      manifest.sourceSnapshotAt,
      manifest.itemCount,
      manifest.blockerCount,
      manifest.manifestSha256,
      manifest.operationKeyHash,
      manifest.requestFingerprint,
      manifest.sealedByMembershipId,
    ],
  };
}

async function insertManifest(client, manifest) {
  return client.query(insertManifestCommand(manifest));
}

function rehash(manifest, items) {
  const unsigned = { ...manifest };
  delete unsigned.manifestSha256;
  return { ...unsigned, manifestSha256: dataSubjectManifestSha256(unsigned, items) };
}

async function assertTransactionalSmoke(client, fixtures, local) {
  await expectSqlFailure(
    client,
    local,
    () => insertRequestCommand({
      id: `privacy_cross_subject_${fixtures.suffix}`,
      organizationId: fixtures.organizationA,
      personId: fixtures.personB,
      actorMembershipId: fixtures.adminA,
      operationKeyHash: hashFixture(10),
      requestFingerprint: hashFixture(11),
    }),
    '23503',
    'DataSubjectRequest_worker_person_fkey',
    'Cross-tenant worker subject guard',
  );
  await expectSqlFailure(
    client,
    local,
    () => insertRequestCommand({
      id: `privacy_cross_actor_${fixtures.suffix}`,
      organizationId: fixtures.organizationA,
      personId: fixtures.personA,
      actorMembershipId: fixtures.adminB,
      operationKeyHash: hashFixture(12),
      requestFingerprint: hashFixture(13),
    }),
    '42501',
    null,
    'Cross-tenant administrator guard',
  );

  await expectSqlFailure(
    client,
    local,
    async () => {
      const request = await prepareDiscoveringRequest(client, fixtures, 'bad_hash');
      const discovery = buildDiscovery(fixtures, request);
      await insertItems(client, discovery.items);
      return insertManifestCommand({
        ...discovery.manifest,
        manifestSha256: `${discovery.manifest.manifestSha256[0] === '0' ? '1' : '0'}${discovery.manifest.manifestSha256.slice(1)}`,
      });
    },
    '55000',
    null,
    'Manifest cryptographic seal',
  );

  await expectSqlFailure(
    client,
    local,
    async () => {
      const request = await prepareDiscoveringRequest(client, fixtures, 'bad_commitment');
      const discovery = buildDiscovery(fixtures, request);
      await insertItems(client, discovery.items);
      const changed = rehash({
        ...discovery.manifest,
        operationKeyHash: hashFixture(99),
        requestFingerprint: hashFixture(100),
      }, discovery.items);
      return insertManifestCommand(changed);
    },
    '55000',
    null,
    'Manifest-to-request commitment binding',
  );

  await expectSqlFailure(
    client,
    local,
    async () => {
      const request = await prepareDiscoveringRequest(client, fixtures, 'bad_clock');
      const discovery = buildDiscovery(fixtures, request);
      const items = discovery.items.map((item, index) => (
        index === 0
          ? { ...item, observedAt: new Date(item.observedAt.getTime() + 1) }
          : item
      ));
      await insertItems(client, items);
      return insertManifestCommand(rehash(discovery.manifest, items));
    },
    '55000',
    null,
    'Manifest source snapshot clock binding',
  );

  await expectSqlFailure(
    client,
    local,
    async () => {
      const request = await prepareDiscoveringRequest(client, fixtures, 'false_complete');
      const manifestId = `privacy_false_complete_manifest_${fixtures.suffix}`;
      const item = {
        id: `privacy_false_complete_item_${fixtures.suffix}`,
        organizationId: fixtures.organizationA,
        requestId: request.id,
        manifestId,
        ordinal: 0,
        kind: 'RECORD',
        category: 'PERSONAL',
        sourceSystem: 'postgresql',
        resourceType: 'WorkerPerson',
        fieldSetCode: 'identity-core-v1',
        fingerprintKeyId: 'privacy-verifier-key-v1',
        locatorFingerprintHmac: hashFixture(101),
        recordFingerprintHmac: hashFixture(102),
        disposition: 'KEEP_MINIMAL',
        retentionPolicyVersion: 'privacy-retention-v1',
        retentionBasisCode: 'LEGAL_REVIEWED',
        retentionUntil: null,
        blockerCode: null,
        observedAt: request.snapshot,
      };
      const unsigned = {
        id: manifestId,
        organizationId: fixtures.organizationA,
        requestId: request.id,
        outcome: 'COMPLETE',
        schemaVersion: 1,
        catalogVersion: PRIVACY_DISCOVERY_CATALOG_VERSION,
        catalogSha256: PRIVACY_DISCOVERY_CATALOG_SHA256,
        sourceSnapshotAt: request.snapshot,
        itemCount: 1,
        blockerCount: 0,
        operationKeyHash: request.operationKeyHash,
        requestFingerprint: request.requestFingerprint,
        sealedByMembershipId: fixtures.adminA,
      };
      await insertItems(client, [item]);
      return insertManifestCommand(rehash(unsigned, [item]));
    },
    '55000',
    null,
    'PRO-05A false COMPLETE guard',
  );

  const request = await prepareDiscoveringRequest(client, fixtures, 'happy');
  const discovery = buildDiscovery(fixtures, request);
  await insertItems(client, discovery.items);
  await insertManifest(client, discovery.manifest);
  await expectSqlFailure(
    client,
    local,
    () => ({
      text: 'SET CONSTRAINTS "DataSubjectDiscoveryManifest_terminal_check" IMMEDIATE',
      values: [],
    }),
    '55000',
    null,
    'Deferred terminal consistency guard',
  );
  await client.query(
    `UPDATE "DataSubjectRequest"
        SET "status" = 'DISCOVERY_BLOCKED',
            "completedByMembershipId" = $3,
            "revision" = "revision" + 1
      WHERE "organizationId" = $1 AND "id" = $2`,
    [fixtures.organizationA, request.id, fixtures.adminA],
  );
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  const sealed = await client.query(
    `SELECT "manifestSha256"::text AS hash,
            to_char("sourceSnapshotAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS snapshot
       FROM "DataSubjectDiscoveryManifest"
      WHERE "organizationId" = $1 AND "requestId" = $2`,
    [fixtures.organizationA, request.id],
  );
  assert.deepEqual(sealed.rows, [{
    hash: discovery.manifest.manifestSha256,
    snapshot: request.snapshot.toISOString(),
  }], 'JavaScript and PostgreSQL must share one UTC canonical manifest hash.');

  await expectSqlFailure(
    client,
    local,
    () => insertItemCommand({
      ...discovery.items[0],
      id: `privacy_late_item_${fixtures.suffix}`,
      ordinal: discovery.items.length,
    }),
    '55000',
    null,
    'Late manifest item guard',
  );

  for (const target of [
    ['DataSubjectRequest', '"id" = $1', [request.id], false],
    ['DataSubjectDiscoveryManifest', '"id" = $1', [discovery.manifest.id], true],
    ['DataSubjectDiscoveryItem', '"id" = $1', [discovery.items[0].id], true],
  ]) {
    const [table, predicate, parameters, updateAppendOnly] = target;
    if (updateAppendOnly) {
      await expectSqlFailure(
        client,
        local,
        () => ({
          text: `UPDATE "${table}" SET "id" = "id" WHERE ${predicate}`,
          values: parameters,
        }),
        '55000',
        null,
        `${table} UPDATE append-only guard`,
      );
    } else {
      await expectSqlFailure(
        client,
        local,
        () => ({
          text: 'UPDATE "DataSubjectRequest" SET "revision" = "revision" + 1 WHERE "id" = $1',
          values: parameters,
        }),
        '55000',
        null,
        'Terminal request immutability guard',
      );
    }
    await expectSqlFailure(
      client,
      local,
      () => ({
        text: `DELETE FROM "${table}" WHERE ${predicate}`,
        values: parameters,
      }),
      '55000',
      null,
      `${table} DELETE append-only guard`,
    );
    await expectSqlFailure(
      client,
      local,
      () => ({ text: `TRUNCATE TABLE "${table}" CASCADE`, values: [] }),
      '55000',
      null,
      `${table} TRUNCATE append-only guard`,
    );
  }
}

async function main() {
  const { connectionString, local, schema } = connectionConfiguration();
  const client = new pg.Client({
    connectionString,
    application_name: 'obrasaas-data-subject-discovery-migration-verifier',
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
      throw new Error('Unable to connect to the dedicated privacy migration verification database.');
    }
    const server = await client.query(
      `SELECT to_regnamespace($1) IS NOT NULL AS schema_exists,
              current_setting('server_version_num')::integer AS server_version`,
      [schema],
    );
    invariant(server.rows[0]?.schema_exists, `Configured PostgreSQL schema ${schema} does not exist.`);
    invariant(server.rows[0]?.server_version >= 140000, 'PostgreSQL 14 or newer is required.');

    await assertReadOnlyDiscovery(client, schema);

    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}, pg_catalog`);
    await client.query("SET LOCAL TIME ZONE 'Pacific/Chatham'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    const activeSchema = await client.query('SELECT current_schema() AS name');
    invariant(activeSchema.rows[0]?.name === schema, 'PostgreSQL did not activate the configured schema.');
    if (local) await installLocalFailureCapture(client);

    const ledger = await assertMigrationLedger(client, schema, local);
    await assertInstalledObjects(client);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const fixtures = await seedTenantFixtures(client, suffix);
    await assertTransactionalSmoke(client, fixtures, local);
    await client.query('ROLLBACK');
    transactionOpen = false;
    console.log(
      `Verified PRO-05A read-only discovery, tenant scope, UTC hash seal, fail-closed coverage, terminal consistency and append-only evidence (${ledger}).`,
    );
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    if (connected) await client.end();
  }
}

if (helpRequested) console.log(HELP);
else await main();
