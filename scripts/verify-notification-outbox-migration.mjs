import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const CONNECTION_ENV = 'NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'NOTIFICATION_OUTBOX_MIGRATION_SCHEMA';
const MIGRATION = '20260802120000_notification_outbox_p0';
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
    throw new Error('The notification outbox migration schema must be a safe PostgreSQL identifier.');
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

async function assertCatalog(client) {
  const table = await client.query(
    `SELECT 1
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = 'NotificationDelivery'`,
  );
  invariant(table.rowCount === 1, 'NotificationDelivery is missing from the configured schema.');

  const index = await client.query(
    `SELECT indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'NotificationDelivery'
        AND indexname = 'NotificationDelivery_organizationId_recipientId_channel_eventKey_key'`,
  );
  invariant(index.rowCount === 1, 'The tenant-aware notification dedupe index is missing.');
  const indexDefinition = normalizeDefinition(index.rows[0].indexdef);
  for (const fragment of [
    'create unique index',
    '(organizationid, recipientid, channel, eventkey)',
  ]) {
    invariant(indexDefinition.includes(fragment), 'The notification dedupe index has an unexpected definition.');
  }

  const constraints = await client.query(
    `SELECT constraint_record.conname,
            constraint_record.contype,
            constraint_record.convalidated,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS relation_record ON relation_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record ON namespace_record.oid = relation_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND relation_record.relname = 'NotificationDelivery'
        AND constraint_record.conname = ANY($1::text[])`,
    [[
      'NotificationDelivery_organizationId_projectId_fkey',
      'NotificationDelivery_read_outcome_check',
      'NotificationDelivery_in_app_delivery_check',
    ]],
  );
  invariant(constraints.rowCount === 3, 'NotificationDelivery governed constraints are incomplete.');
  const byName = new Map(constraints.rows.map((row) => [row.conname, row]));
  const scope = byName.get('NotificationDelivery_organizationId_projectId_fkey');
  invariant(scope?.contype === 'f' && scope?.convalidated, 'The notification project scope FK is not validated.');
  const scopeDefinition = normalizeDefinition(scope?.definition);
  invariant(
    scopeDefinition.includes('foreign key (organizationid, projectid)')
      && scopeDefinition.includes('references project(organizationid, id)'),
    'The notification project scope FK has an unexpected definition.',
  );
  for (const name of [
    'NotificationDelivery_read_outcome_check',
    'NotificationDelivery_in_app_delivery_check',
  ]) {
    const constraint = byName.get(name);
    invariant(constraint?.contype === 'c' && constraint?.convalidated, `${name} is not a validated CHECK.`);
  }
}

async function assertNormalization(client) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS violations
       FROM "NotificationDelivery"
      WHERE "status" = 'READ'
         OR ("readAt" IS NOT NULL AND "status" <> 'SENT')
         OR (
           "channel" = 'IN_APP'
           AND ("status" <> 'SENT' OR "sentAt" IS NULL OR "leasedAt" IS NOT NULL)
         )`,
  );
  invariant(result.rows[0]?.violations === 0, 'NotificationDelivery legacy normalization is incomplete.');
}

async function expectSqlState(client, callback, code, label) {
  await client.query('SAVEPOINT notification_outbox_verifier_case');
  let failure = null;
  try {
    await callback();
  } catch (error) {
    failure = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT notification_outbox_verifier_case');
  await client.query('RELEASE SAVEPOINT notification_outbox_verifier_case');
  invariant(failure, `${label} unexpectedly succeeded.`);
  invariant(failure.code === code, `${label} failed with SQLSTATE ${failure.code || 'unknown'}.`);
}

async function insertDelivery(client, {
  id,
  organizationId,
  projectId,
  recipientId,
  eventKey,
  status = 'SENT',
  sentAt = new Date(),
}) {
  return client.query(
    `INSERT INTO "NotificationDelivery" (
       "id", "organizationId", "projectId", "recipientId", "eventKey",
       "channel", "status", "title", "body", "nextAttemptAt", "sentAt",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'IN_APP', $6, 'Verifier', 'Rollback only',
       CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, organizationId, projectId, recipientId, eventKey, status, sentAt],
  );
}

async function assertRollbackOnlySmoke(client) {
  const suffix = randomUUID();
  const organizationA = `notification_verify_org_a_${suffix}`;
  const organizationB = `notification_verify_org_b_${suffix}`;
  const projectA = `notification_verify_project_a_${suffix}`;
  const projectB = `notification_verify_project_b_${suffix}`;
  const userId = `notification_verify_user_${suffix}`;
  const eventKey = `notification:verify:${suffix}`;

  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Verifier A', $2, CURRENT_TIMESTAMP),
            ($3, 'Verifier B', $4, CURRENT_TIMESTAMP)`,
    [organizationA, `verify-a-${suffix}`, organizationB, `verify-b-${suffix}`],
  );
  await client.query(
    `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
     VALUES ($1, $2, 'Verifier A', $3, CURRENT_TIMESTAMP),
            ($4, $5, 'Verifier B', $6, CURRENT_TIMESTAMP)`,
    [projectA, organizationA, `project-a-${suffix}`, projectB, organizationB, `project-b-${suffix}`],
  );
  await client.query(
    `INSERT INTO "PlatformUser" ("id", "clerkUserId", "primaryEmail", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
    [userId, `clerk-${suffix}`, `verify-${suffix}@example.test`],
  );

  await insertDelivery(client, {
    id: `delivery_a_${suffix}`,
    organizationId: organizationA,
    projectId: projectA,
    recipientId: userId,
    eventKey,
  });
  await expectSqlState(
    client,
    () => insertDelivery(client, {
      id: `delivery_duplicate_${suffix}`,
      organizationId: organizationA,
      projectId: projectA,
      recipientId: userId,
      eventKey,
    }),
    '23505',
    'same-tenant notification replay',
  );
  await insertDelivery(client, {
    id: `delivery_b_${suffix}`,
    organizationId: organizationB,
    projectId: projectB,
    recipientId: userId,
    eventKey,
  });
  await expectSqlState(
    client,
    () => insertDelivery(client, {
      id: `delivery_cross_scope_${suffix}`,
      organizationId: organizationA,
      projectId: projectB,
      recipientId: userId,
      eventKey: `${eventKey}:cross-scope`,
    }),
    '23503',
    'cross-tenant project notification',
  );
  await expectSqlState(
    client,
    () => insertDelivery(client, {
      id: `delivery_pending_${suffix}`,
      organizationId: organizationA,
      projectId: projectA,
      recipientId: userId,
      eventKey: `${eventKey}:pending`,
      status: 'PENDING',
      sentAt: null,
    }),
    '23514',
    'non-delivered IN_APP notification',
  );
}

const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-notification-outbox-migration-verifier',
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
    throw new Error('Unable to connect to the dedicated notification outbox verification database.');
  }
  await client.query('BEGIN');
  transactionOpen = true;
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(activeSchema.rows[0]?.name === databaseSchema, 'PostgreSQL did not activate the configured notification schema.');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  await assertMigration(client);
  await assertCatalog(client);
  await assertNormalization(client);
  await assertRollbackOnlySmoke(client);
  console.log(
    `Verified ${MIGRATION}: checksum, normalized inbox outcomes, tenant FK, scoped dedupe and rollback-only SQL smoke.`,
  );
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (connected && transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original verification failure.
    }
  }
  if (connected) await client.end();
}
