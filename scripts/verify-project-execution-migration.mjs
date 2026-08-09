import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const connectionString = process.env.PROJECT_EXECUTION_MIGRATION_DATABASE_URL
  || process.env.DATABASE_URL_UNPOOLED
  || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('PROJECT_EXECUTION_MIGRATION_DATABASE_URL or DATABASE_URL is required.');
}

const expectedMigrations = [
  '20260724120000_canonical_teams_assignments_blockers',
  '20260809093000_purchase_order_line_scoped_identity',
  '20260809093100_task_assignment_project_ownership',
];
const pool = new pg.Pool({
  connectionString,
  application_name: 'obrasaas-project-execution-verifier',
});
const client = await pool.connect();

try {
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
