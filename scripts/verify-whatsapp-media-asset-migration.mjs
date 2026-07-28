import { randomUUID } from 'node:crypto';

import pg from 'pg';

const CONNECTION_ENV = 'WHATSAPP_MEDIA_ASSET_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'WHATSAPP_MEDIA_ASSET_MIGRATION_SCHEMA';
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
    throw new Error('The WhatsApp media asset migration schema must be a safe PostgreSQL identifier.');
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
    .replaceAll('"', '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sameValues(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);
const REQUIRED_MIGRATIONS = ['20260728070000_whatsapp_media_asset_lifecycle'];
const EXPECTED_ENUMS = {
  WhatsAppMediaAssetStatus: [
    'UPLOADING',
    'AVAILABLE',
    'CLAIMED',
    'DELETE_PENDING',
    'DELETED',
    'FAILED',
  ],
};
const EXPECTED_COLUMNS = {
  providerMediaIdHash: ['NO', 'character', 'bpchar', 64, null],
  providerMessageIdHash: ['NO', 'character', 'bpchar', 64, null],
  mediaKind: ['NO', 'USER-DEFINED', 'MessageKind', null, null],
  declaredMimeType: ['NO', 'character varying', 'varchar', 120, null],
  status: ['NO', 'USER-DEFINED', 'WhatsAppMediaAssetStatus', null, /'UPLOADING'/],
  operationKeyHash: ['NO', 'character', 'bpchar', 64, null],
  requestFingerprint: ['NO', 'character', 'bpchar', 64, null],
  storageProvider: ['YES', 'character varying', 'varchar', 32, null],
  storage: ['YES', 'jsonb', 'jsonb', null, null],
  fileName: ['YES', 'character varying', 'varchar', 255, null],
  mimeType: ['YES', 'character varying', 'varchar', 120, null],
  contentSha256: ['YES', 'character', 'bpchar', 64, null],
  sizeBytes: ['YES', 'integer', 'int4', null, null],
  storageLocatorHash: ['YES', 'character', 'bpchar', 64, null],
  uploadAttemptCount: ['NO', 'integer', 'int4', null, /1/],
  uploadLeaseToken: ['YES', 'uuid', 'uuid', null, null],
  uploadLeaseExpiresAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
  nextUploadAttemptAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
  purgeEligibleAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
  messageConversationId: ['YES', 'text', 'text', null, null],
  messageId: ['YES', 'text', 'text', null, null],
  claimFingerprint: ['YES', 'character', 'bpchar', 64, null],
  deleteOperationKeyHash: ['YES', 'character', 'bpchar', 64, null],
  deleteRequestFingerprint: ['YES', 'character', 'bpchar', 64, null],
  deleteAttemptCount: ['NO', 'integer', 'int4', null, /0/],
  deleteLeaseToken: ['YES', 'uuid', 'uuid', null, null],
  nextDeleteAttemptAt: ['YES', 'timestamp without time zone', 'timestamp', null, null],
  tombstoneSha256: ['YES', 'character', 'bpchar', 64, null],
  lastErrorCode: ['YES', 'character varying', 'varchar', 64, null],
};
const EXPECTED_CHECKS = {
  WhatsAppMediaAsset_hashes_check: ['providermediaidhash', 'providermessageidhash', 'operationkeyhash'],
  WhatsAppMediaAsset_metadata_check: ['mediakind', 'filename', 'mimetype', 'uploadleasetoken', 'deleteleasetoken', 'sizebytes'],
  WhatsAppMediaAsset_state_check: [
    "status = 'uploading'",
    "status = 'available'",
    "status = 'claimed'",
    'purgeeligibleat is null',
    "status = 'delete_pending'",
    "status = 'deleted'",
    'storage is null',
    "status = 'failed'",
  ],
  WhatsAppMediaAsset_timestamps_check: ['uploadleaseexpiresat', 'deleterequestedat', 'deletedat'],
};
const EXPECTED_INDEXES = {
  WebhookEvent_projectId_id_key: {
    table: 'WebhookEvent', columns: ['projectId', 'id'], unique: true,
  },
  WhatsAppMediaAsset_pkey: {
    table: 'WhatsAppMediaAsset', columns: ['id'], unique: true, primary: true,
  },
  WhatsAppMediaAsset_projectId_id_key: {
    table: 'WhatsAppMediaAsset', columns: ['projectId', 'id'], unique: true,
  },
  WhatsAppMediaAsset_project_operation_key: {
    table: 'WhatsAppMediaAsset', columns: ['projectId', 'operationKeyHash'], unique: true,
  },
  WhatsAppMediaAsset_project_provider_identity_key: {
    table: 'WhatsAppMediaAsset',
    columns: ['projectId', 'providerMessageIdHash', 'providerMediaIdHash'],
    unique: true,
  },
  WhatsAppMediaAsset_project_message_key: {
    table: 'WhatsAppMediaAsset',
    columns: ['projectId', 'messageConversationId', 'messageId'],
    unique: true,
  },
  WhatsAppMediaAsset_conversation_message_key: {
    table: 'WhatsAppMediaAsset', columns: ['messageConversationId', 'messageId'], unique: true,
  },
  WhatsAppMediaAsset_upload_queue_idx: {
    table: 'WhatsAppMediaAsset',
    columns: ['projectId', 'status', 'nextUploadAttemptAt', 'id'],
    unique: false,
  },
  WhatsAppMediaAsset_upload_lease_idx: {
    table: 'WhatsAppMediaAsset', columns: ['status', 'uploadLeaseExpiresAt', 'id'], unique: false,
  },
  WhatsAppMediaAsset_delete_queue_idx: {
    table: 'WhatsAppMediaAsset', columns: ['status', 'nextDeleteAttemptAt', 'id'], unique: false,
  },
  WhatsAppMediaAsset_org_created_idx: {
    table: 'WhatsAppMediaAsset', columns: ['organizationId', 'createdAt', 'id'], unique: false,
  },
  WhatsAppMediaAsset_webhook_created_idx: {
    table: 'WhatsAppMediaAsset', columns: ['webhookEventId', 'createdAt'], unique: false,
  },
  WhatsAppMediaAsset_purge_available_idx: {
    table: 'WhatsAppMediaAsset',
    columns: ['purgeEligibleAt', 'projectId', 'id'],
    unique: false,
    predicateFragments: ['status', 'available', 'purgeeligibleat', 'is not null'],
  },
};
const EXPECTED_FOREIGN_KEYS = {
  WhatsAppMediaAsset_project_scope_fkey: {
    table: 'WhatsAppMediaAsset', target: 'Project',
    columns: ['organizationId', 'projectId'], targetColumns: ['organizationId', 'id'],
  },
  WhatsAppMediaAsset_webhook_event_scope_fkey: {
    table: 'WhatsAppMediaAsset', target: 'WebhookEvent',
    columns: ['projectId', 'webhookEventId'], targetColumns: ['projectId', 'id'],
  },
  WhatsAppMediaAsset_conversation_scope_fkey: {
    table: 'WhatsAppMediaAsset', target: 'Conversation',
    columns: ['projectId', 'messageConversationId'], targetColumns: ['projectId', 'id'],
  },
  WhatsAppMediaAsset_message_scope_fkey: {
    table: 'WhatsAppMediaAsset', target: 'Message',
    columns: ['messageConversationId', 'messageId'], targetColumns: ['conversationId', 'id'],
  },
};

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

async function assertEnum(client) {
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
    invariant(sameValues(actual.get(name) || [], labels), `Enum ${name} does not match its governed order.`);
  }
}

async function assertColumns(client) {
  const result = await client.query(
    `SELECT column_name, is_nullable, data_type, udt_name,
            character_maximum_length, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'WhatsAppMediaAsset'`,
  );
  const actual = new Map(result.rows.map((row) => [row.column_name, row]));
  for (const [name, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const column = actual.get(name);
    invariant(column, `Missing WhatsAppMediaAsset.${name}.`);
    const [nullable, dataType, udtName, maxLength, defaultPattern] = expected;
    invariant(column.is_nullable === nullable, `${name} has unexpected nullability.`);
    invariant(column.data_type === dataType && column.udt_name === udtName, `${name} has an unexpected SQL type.`);
    invariant(Number(column.character_maximum_length || 0) === Number(maxLength || 0), `${name} has an unexpected maximum length.`);
    if (defaultPattern) {
      invariant(defaultPattern.test(String(column.column_default || '')), `${name} has an unexpected default.`);
    } else {
      invariant(column.column_default === null, `${name} must not have a database default.`);
    }
  }
}

async function assertChecks(client) {
  const result = await client.query(
    `SELECT constraint_record.conname, constraint_record.contype,
            constraint_record.convalidated, constraint_record.condeferrable,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND relation_record.relname = 'WhatsAppMediaAsset'
        AND constraint_record.conname = ANY($1::text[])`,
    [Object.keys(EXPECTED_CHECKS)],
  );
  const actual = new Map(result.rows.map((row) => [row.conname, row]));
  for (const [name, fragments] of Object.entries(EXPECTED_CHECKS)) {
    const check = actual.get(name);
    invariant(check?.contype === 'c', `Missing CHECK ${name}.`);
    invariant(check.convalidated && !check.condeferrable, `${name} must be validated and immediate.`);
    const normalized = normalizeSql(check.definition);
    for (const fragment of fragments) {
      invariant(normalized.includes(fragment), `${name} is missing governed fragment ${fragment}.`);
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
        AND indexes.indexname = ANY($1::text[])`,
    [Object.keys(EXPECTED_INDEXES)],
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
    const columns = index.key_columns.map((column) => column.replaceAll('"', '').trim());
    invariant(sameValues(columns, expected.columns), `${name} has unexpected ordered columns.`);
    if (expected.predicateFragments) {
      const predicate = normalizeSql(index.predicate);
      for (const fragment of expected.predicateFragments) {
        invariant(predicate.includes(fragment), `${name} has an unsafe purge predicate.`);
      }
      invariant(!predicate.includes('claimed'), `${name} must never index CLAIMED assets.`);
    } else {
      invariant(index.predicate === null, `${name} must remain unconditional.`);
    }
  }
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
    invariant(foreignKey.confdeltype === 'r', `${name} must remain ON DELETE RESTRICT.`);
    invariant(foreignKey.confupdtype === 'c', `${name} must remain ON UPDATE CASCADE.`);
    invariant(sameValues(foreignKey.source_columns, expected.columns), `${name} has wrong source columns.`);
    invariant(sameValues(foreignKey.target_columns, expected.targetColumns), `${name} has wrong target columns.`);
  }
}

async function assertTransitionTrigger(client) {
  const result = await client.query(
    `SELECT trigger_record.tgenabled, trigger_record.tgisinternal,
            pg_get_triggerdef(trigger_record.oid, true) AS trigger_definition,
            procedure_record.proname,
            procedure_record.prosecdef,
            procedure_record.proconfig,
            pg_get_functiondef(procedure_record.oid) AS function_definition
       FROM pg_trigger AS trigger_record
       JOIN pg_class AS relation_record ON relation_record.oid = trigger_record.tgrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
       JOIN pg_proc AS procedure_record ON procedure_record.oid = trigger_record.tgfoid
      WHERE namespace_record.nspname = current_schema()
        AND relation_record.relname = 'WhatsAppMediaAsset'
        AND trigger_record.tgname = 'WhatsAppMediaAsset_transition_guard'`,
  );
  invariant(result.rowCount === 1, 'Missing WhatsAppMediaAsset transition trigger.');
  const trigger = result.rows[0];
  invariant(trigger.tgenabled === 'O' && trigger.tgisinternal === false, 'WhatsAppMediaAsset transition trigger is disabled or internal.');
  invariant(trigger.proname === 'enforce_whatsapp_media_asset_transition', 'WhatsAppMediaAsset transition trigger calls the wrong function.');
  invariant(trigger.prosecdef === false, 'WhatsAppMediaAsset transition trigger must remain invoker-security.');
  invariant(
    Array.isArray(trigger.proconfig) && trigger.proconfig.includes('search_path=pg_catalog'),
    'WhatsAppMediaAsset transition function must pin search_path.',
  );
  const triggerDefinition = normalizeSql(trigger.trigger_definition);
  invariant(
    triggerDefinition.includes('before')
      && triggerDefinition.includes('update')
      && triggerDefinition.includes('delete'),
    'WhatsAppMediaAsset terminal guard must run before updates and deletes.',
  );
  invariant(triggerDefinition.includes('for each row'), 'WhatsAppMediaAsset transition trigger must remain row scoped.');
  const functionDefinition = normalizeSql(trigger.function_definition);
  for (const fragment of [
    "tg_op = 'delete'",
    'whatsappmediaasset_row_retention_guard',
    'whatsappmediaasset_terminal_immutability_guard',
    "old.status = 'uploading'",
    "new.status in ('available'",
    "old.status = 'available'",
    "new.status in ('claimed'",
    "old.status = 'delete_pending'",
    "new.status = 'deleted'",
    'whatsappmediaasset_transition_guard',
  ]) {
    invariant(functionDefinition.includes(fragment), `Transition trigger is missing ${fragment}.`);
  }
}

let savepointSequence = 0;

async function expectSqlFailure(client, query, parameters, expectedCode, expectedConstraint, label) {
  savepointSequence += 1;
  const savepoint = `whatsapp_media_asset_verify_${savepointSequence}`;
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

const INSERT_UPLOADING_SQL = `
  INSERT INTO "WhatsAppMediaAsset" (
    "id", "organizationId", "projectId", "webhookEventId",
    "providerMediaIdHash", "providerMessageIdHash", "mediaKind", "declaredMimeType",
    "status", "operationKeyHash", "requestFingerprint",
    "storageProvider", "storage", "storageLocatorHash", "contentSha256", "sizeBytes",
    "purgeEligibleAt", "uploadLeaseToken", "uploadLeaseExpiresAt", "createdAt", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, 'IMAGE', 'image/jpeg',
    'UPLOADING', $7, $8, 'vercel-blob', $9::jsonb, $10, $11, 128, $12,
    $13::uuid, $14, $15, $15
  )`;

function uploadingParameters(fixtures, overrides = {}) {
  const id = overrides.id || `media_${randomUUID()}`;
  const now = new Date();
  return [
    id,
    overrides.organizationId || fixtures.organizationId,
    overrides.projectId || fixtures.projectId,
    overrides.webhookEventId || fixtures.webhookEventId,
    overrides.providerMediaIdHash || randomUUID().replaceAll('-', '').padEnd(64, 'a'),
    overrides.providerMessageIdHash || randomUUID().replaceAll('-', '').padEnd(64, 'b'),
    overrides.operationKeyHash || randomUUID().replaceAll('-', '').padEnd(64, 'c'),
    overrides.requestFingerprint || 'd'.repeat(64),
    JSON.stringify({ provider: 'vercel-blob', pathname: `obrasaas/whatsapp/${id}` }),
    'e'.repeat(64),
    'f'.repeat(64),
    new Date(now.getTime() + 15 * 60_000),
    overrides.uploadLeaseToken === null ? null : randomUUID(),
    overrides.uploadLeaseExpiresAt === null ? null : new Date(now.getTime() + 60_000),
    now,
  ];
}

async function assertTransactionalSmoke(client) {
  const suffix = randomUUID().replaceAll('-', '');
  const now = new Date();
  const fixtures = {
    organizationId: `wma_org_${suffix}`,
    otherOrganizationId: `wma_other_org_${suffix}`,
    projectId: `wma_project_${suffix}`,
    otherProjectId: `wma_other_project_${suffix}`,
    webhookEventId: `wma_webhook_${suffix}`,
    otherWebhookEventId: `wma_other_webhook_${suffix}`,
    conversationId: `wma_conversation_${suffix}`,
    otherConversationId: `wma_other_conversation_${suffix}`,
    messageId: `wma_message_${suffix}`,
    otherMessageId: `wma_other_message_${suffix}`,
  };

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, 'WhatsApp media verifier', $2, $3, $3),
            ($4, 'WhatsApp media verifier other', $5, $3, $3)`,
    [fixtures.organizationId, `wma-${suffix}`, now, fixtures.otherOrganizationId, `wma-other-${suffix}`],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1, $2, 'WhatsApp media project', $3, $4, $4),
            ($5, $6, 'WhatsApp media other project', $7, $4, $4)`,
    [
      fixtures.projectId, fixtures.organizationId, `wma-project-${suffix}`, now,
      fixtures.otherProjectId, fixtures.otherOrganizationId, `wma-other-project-${suffix}`,
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
    `INSERT INTO "Conversation" (
       "id", "projectId", "channel", "externalId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, 'whatsapp', $3, $4, $4),
              ($5, $6, 'whatsapp', $7, $4, $4)`,
    [
      fixtures.conversationId, fixtures.projectId, `worker-${suffix}`, now,
      fixtures.otherConversationId, fixtures.otherProjectId, `other-worker-${suffix}`,
    ],
  );
  await client.query(
    `INSERT INTO "Message" (
       "id", "conversationId", "externalId", "direction", "kind", "sentAt", "createdAt"
     ) VALUES ($1, $2, $3, 'INBOUND', 'IMAGE', $4, $4),
              ($5, $6, $7, 'INBOUND', 'IMAGE', $4, $4)`,
    [
      fixtures.messageId, fixtures.conversationId, `message-${suffix}`, now,
      fixtures.otherMessageId, fixtures.otherConversationId, `message-other-${suffix}`,
    ],
  );

  const upload = uploadingParameters(fixtures);
  await client.query(INSERT_UPLOADING_SQL, upload);

  await expectSqlFailure(
    client,
    INSERT_UPLOADING_SQL,
    uploadingParameters(fixtures, { operationKeyHash: 'not-a-hash' }),
    '23514',
    'WhatsAppMediaAsset_hashes_check',
    'WhatsAppMediaAsset hash guard',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOADING_SQL,
    uploadingParameters(fixtures, { uploadLeaseToken: null, uploadLeaseExpiresAt: null }),
    '23514',
    'WhatsAppMediaAsset_state_check',
    'WhatsAppMediaAsset UPLOADING lease or backoff guard',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOADING_SQL,
    uploadingParameters(fixtures, { organizationId: fixtures.otherOrganizationId }),
    '23503',
    'WhatsAppMediaAsset_project_scope_fkey',
    'WhatsAppMediaAsset cross-tenant project scope',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOADING_SQL,
    uploadingParameters(fixtures, { webhookEventId: fixtures.otherWebhookEventId }),
    '23503',
    'WhatsAppMediaAsset_webhook_event_scope_fkey',
    'WhatsAppMediaAsset cross-project webhook scope',
  );
  await expectSqlFailure(
    client,
    INSERT_UPLOADING_SQL,
    uploadingParameters(fixtures, { operationKeyHash: upload[6] }),
    '23505',
    'WhatsAppMediaAsset_project_operation_key',
    'WhatsAppMediaAsset operation idempotency',
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WhatsAppMediaAsset" WHERE "id" = $1',
    [upload[0]],
    '23514',
    'WhatsAppMediaAsset_row_retention_guard',
    'WhatsAppMediaAsset UPLOADING row retention guard',
  );

  const availableId = `media_available_${suffix}`;
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
       'vercel-blob', $9::jsonb, 'obra-frente.jpg', 'image/jpeg',
       $10, 128, $11, $12, $13, $13
     )`,
    [
      availableId, fixtures.organizationId, fixtures.projectId, fixtures.webhookEventId,
      '1'.repeat(64), '2'.repeat(64), '3'.repeat(64), '4'.repeat(64),
      JSON.stringify({ provider: 'vercel-blob', pathname: `obrasaas/whatsapp/${availableId}` }),
      '5'.repeat(64), '6'.repeat(64), new Date(now.getTime() + 60_000), now,
    ],
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WhatsAppMediaAsset" WHERE "id" = $1',
    [availableId],
    '23514',
    'WhatsAppMediaAsset_row_retention_guard',
    'WhatsAppMediaAsset AVAILABLE row retention guard',
  );

  await expectSqlFailure(
    client,
    `UPDATE "WhatsAppMediaAsset"
        SET "status" = 'CLAIMED', "messageConversationId" = $2, "messageId" = $3,
            "claimedAt" = $4, "claimFingerprint" = $5, "updatedAt" = $4
      WHERE "id" = $1`,
    [availableId, fixtures.conversationId, fixtures.messageId, new Date(), '7'.repeat(64)],
    '23514',
    'WhatsAppMediaAsset_state_check',
    'WhatsAppMediaAsset CLAIMED purge exclusion',
  );

  await expectSqlFailure(
    client,
    `UPDATE "WhatsAppMediaAsset"
        SET "status" = 'CLAIMED', "purgeEligibleAt" = NULL,
            "messageConversationId" = $2, "messageId" = $3,
            "claimedAt" = $4, "claimFingerprint" = $5, "updatedAt" = $4
      WHERE "id" = $1`,
    [availableId, fixtures.otherConversationId, fixtures.otherMessageId, new Date(), '7'.repeat(64)],
    '23503',
    'WhatsAppMediaAsset_conversation_scope_fkey',
    'WhatsAppMediaAsset cross-project Message claim scope',
  );

  const claimedAt = new Date();
  await client.query(
    `UPDATE "WhatsAppMediaAsset"
        SET "status" = 'CLAIMED', "purgeEligibleAt" = NULL,
            "messageConversationId" = $2, "messageId" = $3,
            "claimedAt" = $4, "claimFingerprint" = $5, "updatedAt" = $4
      WHERE "id" = $1`,
    [availableId, fixtures.conversationId, fixtures.messageId, claimedAt, '7'.repeat(64)],
  );
  const purgeCandidates = await client.query(
    `SELECT "id" FROM "WhatsAppMediaAsset"
      WHERE "status" = 'AVAILABLE' AND "purgeEligibleAt" <= $1`,
    [new Date(now.getTime() + 120_000)],
  );
  invariant(
    !purgeCandidates.rows.some((row) => row.id === availableId),
    'WhatsAppMediaAsset CLAIMED rows must remain outside purge candidates.',
  );

  await expectSqlFailure(
    client,
    'DELETE FROM "Message" WHERE "id" = $1',
    [fixtures.messageId],
    '23503',
    'WhatsAppMediaAsset_message_scope_fkey',
    'WhatsAppMediaAsset claimed Message retention policy',
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WebhookEvent" WHERE "id" = $1',
    [fixtures.webhookEventId],
    '23503',
    'WhatsAppMediaAsset_webhook_event_scope_fkey',
    'WhatsAppMediaAsset durable WebhookEvent provenance',
  );

  await expectSqlFailure(
    client,
    `UPDATE "WhatsAppMediaAsset"
        SET "status" = 'DELETE_PENDING',
            "messageConversationId" = NULL, "messageId" = NULL,
            "claimedAt" = NULL, "claimFingerprint" = NULL,
            "deleteOperationKeyHash" = $2, "deleteRequestFingerprint" = $3,
            "deleteRequestedAt" = $4, "nextDeleteAttemptAt" = $4,
            "updatedAt" = $4
      WHERE "id" = $1`,
    [availableId, '8'.repeat(64), '9'.repeat(64), new Date()],
    '23514',
    'WhatsAppMediaAsset_terminal_immutability_guard',
    'WhatsAppMediaAsset CLAIMED terminal transition guard',
  );
  await expectSqlFailure(
    client,
    `UPDATE "WhatsAppMediaAsset"
        SET "fileName" = 'tampered-but-valid.jpg', "updatedAt" = $2
      WHERE "id" = $1`,
    [availableId, new Date()],
    '23514',
    'WhatsAppMediaAsset_terminal_immutability_guard',
    'WhatsAppMediaAsset CLAIMED same-status immutability guard',
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WhatsAppMediaAsset" WHERE "id" = $1',
    [availableId],
    '23514',
    'WhatsAppMediaAsset_row_retention_guard',
    'WhatsAppMediaAsset CLAIMED row retention guard',
  );

  const deletedId = `media_deleted_${suffix}`;
  const deleteRequestedAt = new Date();
  await client.query(
    `INSERT INTO "WhatsAppMediaAsset" (
       "id", "organizationId", "projectId", "webhookEventId",
       "providerMediaIdHash", "providerMessageIdHash", "mediaKind", "declaredMimeType",
       "status", "operationKeyHash", "requestFingerprint",
       "storageProvider", "storage", "contentSha256", "sizeBytes", "storageLocatorHash",
       "purgeEligibleAt", "deleteOperationKeyHash", "deleteRequestFingerprint",
       "deleteRequestedAt", "nextDeleteAttemptAt", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'IMAGE', 'image/jpeg', 'DELETE_PENDING', $7, $8,
       'vercel-blob', $9::jsonb, $10, 128, $11, $12, $13, $14, $15, $15, $16, $16
     )`,
    [
      deletedId, fixtures.organizationId, fixtures.projectId, fixtures.webhookEventId,
      'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64),
      JSON.stringify({ provider: 'vercel-blob', pathname: `obrasaas/whatsapp/${deletedId}` }),
      'e'.repeat(64), 'f'.repeat(64), new Date(now.getTime() + 60_000),
      '1'.repeat(64), '2'.repeat(64), deleteRequestedAt, now,
    ],
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WhatsAppMediaAsset" WHERE "id" = $1',
    [deletedId],
    '23514',
    'WhatsAppMediaAsset_row_retention_guard',
    'WhatsAppMediaAsset DELETE_PENDING row retention guard',
  );
  const deletedAt = new Date();
  await client.query(
    `UPDATE "WhatsAppMediaAsset"
        SET "status" = 'DELETED', "storage" = NULL,
            "nextDeleteAttemptAt" = NULL, "deletedAt" = $2,
            "tombstoneSha256" = $3, "updatedAt" = $2
      WHERE "id" = $1`,
    [deletedId, deletedAt, '3'.repeat(64)],
  );
  await expectSqlFailure(
    client,
    `UPDATE "WhatsAppMediaAsset"
        SET "lastErrorCode" = 'TAMPER_ATTEMPT', "updatedAt" = $2
      WHERE "id" = $1`,
    [deletedId, new Date()],
    '23514',
    'WhatsAppMediaAsset_terminal_immutability_guard',
    'WhatsAppMediaAsset DELETED same-status immutability guard',
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WhatsAppMediaAsset" WHERE "id" = $1',
    [deletedId],
    '23514',
    'WhatsAppMediaAsset_row_retention_guard',
    'WhatsAppMediaAsset DELETED row retention guard',
  );

  const failedId = `media_failed_${suffix}`;
  await client.query(
    `INSERT INTO "WhatsAppMediaAsset" (
       "id", "organizationId", "projectId", "webhookEventId",
       "providerMediaIdHash", "providerMessageIdHash", "mediaKind", "declaredMimeType",
       "status", "operationKeyHash", "requestFingerprint", "lastErrorCode",
       "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'IMAGE', 'image/jpeg',
       'FAILED', $7, $8, 'PROVIDER_REJECTED', $9, $9
     )`,
    [
      failedId, fixtures.organizationId, fixtures.projectId, fixtures.webhookEventId,
      '4'.repeat(64), '5'.repeat(64), '6'.repeat(64), '7'.repeat(64), now,
    ],
  );
  await expectSqlFailure(
    client,
    'DELETE FROM "WhatsAppMediaAsset" WHERE "id" = $1',
    [failedId],
    '23514',
    'WhatsAppMediaAsset_row_retention_guard',
    'WhatsAppMediaAsset FAILED row retention guard',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-whatsapp-media-asset-migration-verifier',
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

await client.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(activeSchema.rows[0]?.name === databaseSchema, 'PostgreSQL did not activate the configured media asset schema.');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigration(client);
  await assertEnum(client);
  await assertColumns(client);
  await assertChecks(client);
  await assertIndexes(client);
  await assertForeignKeys(client);
  await assertTransitionTrigger(client);
  await assertTransactionalSmoke(client);
  console.log('Verified WhatsApp media asset migration: scoped durable provenance, upload/delete leases, tombstones and CLAIMED purge exclusion.');
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
  await client.end();
}
