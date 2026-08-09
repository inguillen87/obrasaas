import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const CONNECTION_ENV = 'PROJECT_EXECUTION_MIGRATION_DATABASE_URL';
const SCHEMA_ENV = 'PROJECT_EXECUTION_MIGRATION_SCHEMA';
const SCHEMA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;
const connectionString = process.env[CONNECTION_ENV];
if (!connectionString) {
  throw new Error(`${CONNECTION_ENV} is required; generic database URLs are intentionally ignored.`);
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
  if (!schema || !SCHEMA_IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(`Declare a safe PostgreSQL schema through ${SCHEMA_ENV} or the database URL.`);
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

const expectedMigrations = [
  '20260724120000_canonical_teams_assignments_blockers',
  '20260809093000_purchase_order_line_scoped_identity',
  '20260809093100_task_assignment_project_ownership',
];
const databaseSchema = resolveDatabaseSchema(connectionString);
const verifierConnectionString = hardenedVerifierConnectionString(connectionString);
const pool = new pg.Pool({
  connectionString: verifierConnectionString,
  application_name: 'obrasaas-project-execution-verifier',
  statement_timeout: 35_000,
  query_timeout: 40_000,
});
const client = await pool.connect();

try {
  const schemaExists = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [databaseSchema],
  );
  assert.equal(schemaExists.rows[0]?.exists, true, 'Configured project execution schema does not exist.');
  await client.query(`SET search_path TO ${quoteIdentifier(databaseSchema)}, pg_catalog`);
  const activeSchema = await client.query('SELECT current_schema() AS name');
  assert.equal(activeSchema.rows[0]?.name, databaseSchema, 'PostgreSQL did not activate the configured project execution schema.');

  const migrations = await client.query(
    `SELECT "migration_name"
       FROM "_prisma_migrations"
      WHERE "migration_name" = ANY($1::text[])
        AND "finished_at" IS NOT NULL
      ORDER BY "migration_name"`,
    [expectedMigrations],
  );
  assert.deepEqual(
    migrations.rows.map((row) => row.migration_name),
    expectedMigrations,
    'S4 and both structural reconciliation migrations must be applied successfully.',
  );

  const tables = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename = ANY($1::text[])`,
    [['WorkTeam', 'WorkTeamMember', 'TaskAssignment', 'ProjectBlocker']],
  );
  assert.equal(tables.rowCount, 4, 'All S4 tables must exist.');

  const constraints = await client.query(
    `SELECT constraint_record.conname
       FROM pg_constraint AS constraint_record
       JOIN pg_class AS table_record
         ON table_record.oid = constraint_record.conrelid
       JOIN pg_namespace AS namespace_record
         ON namespace_record.oid = table_record.relnamespace
      WHERE namespace_record.nspname = current_schema()
        AND constraint_record.conname = ANY($1::text[])`,
    [[
      'WorkTeam_revision_nonnegative_check',
      'WorkTeam_name_not_blank_check',
      'WorkTeamMember_dates_check',
      'TaskAssignment_owner_check',
      'TaskAssignment_dates_check',
      'ProjectBlocker_resolution_state_check',
      'WorkTeamMember_team_scope_fkey',
      'WorkTeamMember_worker_scope_fkey',
      'TaskAssignment_task_scope_fkey',
      'TaskAssignment_worker_scope_fkey',
      'TaskAssignment_team_scope_fkey',
      'ProjectBlocker_task_scope_fkey',
      'ProjectBlocker_worker_scope_fkey',
      'ProjectBlocker_team_scope_fkey',
    ]],
  );
  assert.equal(constraints.rowCount, 14, 'S4 checks and scoped FKs must exist.');

  const types = await client.query(
    `SELECT type_record.typname
       FROM pg_type AS type_record
       JOIN pg_namespace AS namespace_record
         ON namespace_record.oid = type_record.typnamespace
      WHERE namespace_record.nspname = current_schema()
        AND type_record.typname = ANY($1::text[])`,
    [[
      'WorkTeamStatus',
      'WorkTeamMemberRole',
      'TaskAssignmentStatus',
      'ProjectBlockerStatus',
      'ProjectBlockerSeverity',
    ]],
  );
  assert.equal(types.rowCount, 5, 'S4 enums must exist.');

  const scopedPurchaseLineIndex = await client.query(`
    SELECT index_state.indisunique AS "isUnique",
           index_state.indisvalid AS "isValid",
           index_state.indisready AS "isReady",
           ARRAY(
             SELECT attribute_record.attname
               FROM unnest(index_state.indkey) WITH ORDINALITY
                    AS key_attribute(attnum, ordinal)
               JOIN pg_attribute AS attribute_record
                 ON attribute_record.attrelid = table_record.oid
                AND attribute_record.attnum = key_attribute.attnum
              WHERE key_attribute.ordinal <= index_state.indnkeyatts
              ORDER BY key_attribute.ordinal
           )::text[] AS columns
      FROM pg_class AS table_record
      JOIN pg_namespace AS namespace_record
        ON namespace_record.oid = table_record.relnamespace
      JOIN pg_index AS index_state
        ON index_state.indrelid = table_record.oid
      JOIN pg_class AS index_record
        ON index_record.oid = index_state.indexrelid
     WHERE namespace_record.nspname = current_schema()
       AND table_record.relname = 'PurchaseOrderLine'
       AND index_record.relname = 'PurchaseOrderLine_projectId_id_key'
  `);
  assert.equal(
    scopedPurchaseLineIndex.rowCount,
    1,
    'PurchaseOrderLine scoped identity index must exist exactly once.',
  );
  assert.equal(scopedPurchaseLineIndex.rows[0].isUnique, true, 'PurchaseOrderLine scoped identity index must be unique.');
  assert.equal(scopedPurchaseLineIndex.rows[0].isValid, true, 'PurchaseOrderLine scoped identity index must be valid.');
  assert.equal(scopedPurchaseLineIndex.rows[0].isReady, true, 'PurchaseOrderLine scoped identity index must be ready.');
  assert.deepEqual(
    scopedPurchaseLineIndex.rows[0].columns,
    ['projectId', 'id'],
    'PurchaseOrderLine scoped identity index has the wrong column order.',
  );

  const projectOwnershipForeignKey = await client.query(`
    SELECT constraint_record.convalidated AS "isValidated",
           constraint_record.confdeltype AS "deleteAction",
           constraint_record.confupdtype AS "updateAction",
           parent_table.relname AS "parentTable",
           ARRAY(
             SELECT attribute_record.attname
               FROM unnest(constraint_record.conkey) WITH ORDINALITY
                    AS key_attribute(attnum, ordinal)
               JOIN pg_attribute AS attribute_record
                 ON attribute_record.attrelid = child_table.oid
                AND attribute_record.attnum = key_attribute.attnum
              ORDER BY key_attribute.ordinal
           )::text[] AS "childColumns",
           ARRAY(
             SELECT attribute_record.attname
               FROM unnest(constraint_record.confkey) WITH ORDINALITY
                    AS key_attribute(attnum, ordinal)
               JOIN pg_attribute AS attribute_record
                 ON attribute_record.attrelid = parent_table.oid
                AND attribute_record.attnum = key_attribute.attnum
              ORDER BY key_attribute.ordinal
           )::text[] AS "parentColumns"
      FROM pg_constraint AS constraint_record
      JOIN pg_class AS child_table
        ON child_table.oid = constraint_record.conrelid
      JOIN pg_namespace AS namespace_record
        ON namespace_record.oid = child_table.relnamespace
      JOIN pg_class AS parent_table
        ON parent_table.oid = constraint_record.confrelid
     WHERE namespace_record.nspname = current_schema()
       AND child_table.relname = 'TaskAssignment'
       AND constraint_record.conname = 'TaskAssignment_projectId_fkey'
       AND constraint_record.contype = 'f'
  `);
  assert.equal(
    projectOwnershipForeignKey.rowCount,
    1,
    'TaskAssignment direct project ownership FK must exist exactly once.',
  );
  const projectForeignKey = projectOwnershipForeignKey.rows[0];
  assert.equal(projectForeignKey.isValidated, true, 'TaskAssignment project FK must be validated.');
  assert.equal(projectForeignKey.deleteAction, 'c', 'TaskAssignment project FK must cascade project deletion.');
  assert.equal(projectForeignKey.updateAction, 'c', 'TaskAssignment project FK must cascade project key updates.');
  assert.equal(projectForeignKey.parentTable, 'Project', 'TaskAssignment project FK targets the wrong table.');
  assert.deepEqual(projectForeignKey.childColumns, ['projectId']);
  assert.deepEqual(projectForeignKey.parentColumns, ['id']);

  const fixtureSuffix = randomUUID();
  const fixture = {
    organizationId: `project-execution-verifier:${fixtureSuffix}:organization`,
    organizationSlug: `project-execution-verifier-${fixtureSuffix}`,
    projectId: `project-execution-verifier:${fixtureSuffix}:project`,
    projectSlug: `project-execution-verifier-${fixtureSuffix}`,
    taskId: `project-execution-verifier:${fixtureSuffix}:task`,
    teamId: `project-execution-verifier:${fixtureSuffix}:team`,
    assignmentId: `project-execution-verifier:${fixtureSuffix}:assignment`,
  };

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
       VALUES ($1, 'Project execution verifier', $2, CURRENT_TIMESTAMP)`,
      [fixture.organizationId, fixture.organizationSlug],
    );
    await client.query(
      `INSERT INTO "Project" ("id", "organizationId", "name", "slug", "updatedAt")
       VALUES ($1, $2, 'Project execution verifier', $3, CURRENT_TIMESTAMP)`,
      [fixture.projectId, fixture.organizationId, fixture.projectSlug],
    );
    await client.query(
      `INSERT INTO "Task" ("id", "projectId", "title", "updatedAt")
       VALUES ($1, $2, 'Project execution verifier task', CURRENT_TIMESTAMP)`,
      [fixture.taskId, fixture.projectId],
    );
    await client.query(
      `INSERT INTO "WorkTeam" ("id", "projectId", "name", "updatedAt")
       VALUES ($1, $2, 'Project execution verifier team', CURRENT_TIMESTAMP)`,
      [fixture.teamId, fixture.projectId],
    );
    await client.query(
      `INSERT INTO "TaskAssignment" (
         "id", "projectId", "taskId", "teamId", "updatedAt"
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [fixture.assignmentId, fixture.projectId, fixture.taskId, fixture.teamId],
    );

    await client.query('DELETE FROM "Project" WHERE "id" = $1', [fixture.projectId]);
    const cascadeResult = await client.query(
      `SELECT
         (SELECT count(*)::int FROM "Project" WHERE "id" = $1) AS projects,
         (SELECT count(*)::int FROM "Task" WHERE "id" = $2) AS tasks,
         (SELECT count(*)::int FROM "WorkTeam" WHERE "id" = $3) AS teams,
         (SELECT count(*)::int FROM "TaskAssignment" WHERE "id" = $4) AS assignments`,
      [fixture.projectId, fixture.taskId, fixture.teamId, fixture.assignmentId],
    );
    assert.deepEqual(
      cascadeResult.rows[0],
      { projects: 0, tasks: 0, teams: 0, assignments: 0 },
      'Deleting a project must cascade through task, team and assignment ownership paths.',
    );
  } finally {
    await client.query('ROLLBACK');
  }

  console.log(JSON.stringify({
    ok: true,
    tables: tables.rowCount,
    constraints: constraints.rowCount + projectOwnershipForeignKey.rowCount,
    enums: types.rowCount,
    structuralReconciliation: true,
  }));
} finally {
  client.release();
  await pool.end();
}
