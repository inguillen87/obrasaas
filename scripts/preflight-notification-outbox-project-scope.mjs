import pg from 'pg';

import {
  NOTIFICATION_OUTBOX_PREFLIGHT_ACTION,
  classifyNotificationOutboxPreflightState,
} from './notification-outbox-preflight-state.mjs';

const CONNECTION_ENV = 'NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL';
const SCHEMA_ENV = 'NOTIFICATION_OUTBOX_PREFLIGHT_SCHEMA';
const BASE_MIGRATION = '20260724150000_notification_outbox';
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const connectionString = process.env[CONNECTION_ENV];

if (!connectionString) {
  throw new Error(`${CONNECTION_ENV} is required; migration and runtime URLs are intentionally ignored.`);
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
    throw new Error(`${SCHEMA_ENV} does not match the schema declared in the preflight URL.`);
  }
  const schema = explicitSchema || dsnSchema;
  if (!schema) {
    throw new Error(`Declare ${SCHEMA_ENV} or add an explicit schema parameter to the preflight URL.`);
  }
  if (!SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error('The notification outbox preflight schema must be a safe PostgreSQL identifier.');
  }
  return schema;
}

function hardenedConnectionString(value) {
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

async function assertScopeColumns(client) {
  const columns = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name, column_name) IN (
          ('NotificationDelivery', 'organizationId'),
          ('NotificationDelivery', 'projectId'),
          ('Project', 'organizationId'),
          ('Project', 'id')
        )`,
  );
  invariant(columns.rowCount === 4, 'Notification outbox project-scope columns are incomplete.');
}

async function inspectBootstrapState(client) {
  const catalog = await client.query(
    `SELECT
       to_regclass(format('%I.%I', current_schema(), 'Project')) IS NOT NULL AS project_exists,
       to_regclass(format('%I.%I', current_schema(), 'NotificationDelivery')) IS NOT NULL AS delivery_exists,
       to_regclass(format('%I.%I', current_schema(), '_prisma_migrations')) IS NOT NULL AS migration_table_exists`,
  );
  const row = catalog.rows[0] || {};
  const migrationTableExists = row.migration_table_exists === true;
  let baseMigrationApplied = false;
  if (migrationTableExists) {
    const migration = await client.query(
      `SELECT COUNT(*)::int AS applied_count
         FROM "_prisma_migrations"
        WHERE "migration_name" = $1
          AND "finished_at" IS NOT NULL
          AND "rolled_back_at" IS NULL`,
      [BASE_MIGRATION],
    );
    invariant(
      Number.isInteger(migration.rows[0]?.applied_count)
        && migration.rows[0].applied_count >= 0
        && migration.rows[0].applied_count <= 1,
      'Notification outbox base migration history is ambiguous.',
    );
    baseMigrationApplied = migration.rows[0].applied_count === 1;
  }
  return {
    projectExists: row.project_exists === true,
    notificationDeliveryExists: row.delivery_exists === true,
    migrationTableExists,
    baseMigrationApplied,
  };
}

async function assertProjectScopeCompatibility(client) {
  const result = await client.query(
    `SELECT COUNT(*)::text AS violation_count
       FROM "NotificationDelivery" AS delivery
       LEFT JOIN "Project" AS project_record
         ON project_record."id" = delivery."projectId"
      WHERE delivery."projectId" IS NOT NULL
        AND (
          project_record."id" IS NULL
          OR project_record."organizationId" <> delivery."organizationId"
        )`,
  );
  const countText = result.rows[0]?.violation_count;
  invariant(/^\d+$/.test(String(countText || '')), 'The notification scope violation count is invalid.');
  const violationCount = BigInt(countText);
  if (violationCount > 0n) {
    throw new Error(
      `Notification outbox project-scope preflight found ${violationCount.toString()} incompatible row(s); migration refused.`,
    );
  }
  return violationCount;
}

const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedConnectionString(connectionString);
const client = new pg.Client({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-notification-outbox-project-scope-preflight',
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
    throw new Error('Unable to connect to the dedicated notification outbox preflight database.');
  }
  await client.query('BEGIN TRANSACTION READ ONLY');
  transactionOpen = true;
  const mode = await client.query('SHOW transaction_read_only');
  invariant(mode.rows[0]?.transaction_read_only === 'on', 'PostgreSQL did not activate a read-only preflight transaction.');
  const schemaExists = await client.query('SELECT to_regnamespace($1) IS NOT NULL AS exists', [databaseSchema]);
  invariant(schemaExists.rows[0]?.exists, `Configured PostgreSQL schema ${databaseSchema} does not exist.`);
  await client.query(`SET LOCAL search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  invariant(activeSchema.rows[0]?.name === databaseSchema, 'PostgreSQL did not activate the configured preflight schema.');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
  const bootstrap = classifyNotificationOutboxPreflightState(
    await inspectBootstrapState(client),
  );
  if (bootstrap.action === NOTIFICATION_OUTBOX_PREFLIGHT_ACTION.SKIP_BOOTSTRAP) {
    console.log('Notification outbox project-scope preflight skipped for a clean bootstrap.');
  } else {
    await assertScopeColumns(client);
    await assertProjectScopeCompatibility(client);
    console.log('Notification outbox project-scope preflight passed with 0 incompatible rows.');
  }
  await client.query('ROLLBACK');
  transactionOpen = false;
} finally {
  if (connected && transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original preflight failure.
    }
  }
  if (connected) await client.end();
}
