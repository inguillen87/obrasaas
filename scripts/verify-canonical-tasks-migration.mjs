import assert from 'node:assert/strict';
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const { Pool } = pg;
const MIGRATION = '20260724110000_canonical_tasks_wbs';
const EXPECTED_COLUMNS = [
  ['Task', 'projectId'],
  ['Task', 'code'],
  ['Task', 'type'],
  ['Task', 'revision'],
  ['Task', 'parentId'],
  ['TaskDependency', 'projectId'],
  ['TaskDependency', 'predecessorId'],
  ['TaskDependency', 'successorId'],
  ['TaskDependency', 'type'],
  ['TaskDependency', 'lagDays'],
];
const connectionString = process.env.CANONICAL_TASKS_MIGRATION_DATABASE_URL
  || process.env.DATABASE_URL_UNPOOLED
  || process.env.DATABASE_URL;
if (!connectionString) throw new Error('CANONICAL_TASKS_MIGRATION_DATABASE_URL or DATABASE_URL is required.');

const pool = new Pool({ connectionString, application_name: 'obrasaas-canonical-tasks-verifier' });
const client = await pool.connect();
try {
  const migration = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [MIGRATION]);
  assert.equal(migration.rowCount, 1, 'S3 migration must be applied successfully.');

  const catalog = await client.query(`
    SELECT actual.table_name AS "tableName", actual.column_name AS "columnName"
    FROM information_schema.columns actual
    JOIN unnest($1::text[], $2::text[]) expected("tableName", "columnName")
      ON expected."tableName" = actual.table_name
     AND expected."columnName" = actual.column_name
    WHERE actual.table_schema = current_schema()
  `, [
    EXPECTED_COLUMNS.map(([tableName]) => tableName),
    EXPECTED_COLUMNS.map(([, columnName]) => columnName),
  ]);
  const existingColumns = new Set(
    catalog.rows.map(({ tableName, columnName }) => `${tableName}.${columnName}`),
  );
  const missingColumns = EXPECTED_COLUMNS
    .map(([tableName, columnName]) => `${tableName}.${columnName}`)
    .filter((column) => !existingColumns.has(column));
  assert.deepEqual(
    missingColumns,
    [],
    `Missing canonical task columns: ${missingColumns.join(', ')}`,
  );

  const types = await client.query(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname IN ('TaskType', 'TaskDependencyType') GROUP BY t.typname
  `);
  const typeMap = new Map(types.rows.map((row) => [row.typname, row.labels]));
  assert.deepEqual(typeMap.get('TaskType'), ['TASK', 'MILESTONE']);
  assert.deepEqual(typeMap.get('TaskDependencyType'), ['FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH']);

  const constraints = await client.query(`
    SELECT conname FROM pg_constraint
    WHERE conname = ANY($1::text[])
  `, [[
    'Task_progress_range_check', 'Task_revision_nonnegative_check', 'Task_code_not_blank_check',
    'Task_parent_scope_fkey', 'TaskDependency_not_self_check', 'TaskDependency_lag_range_check',
    'TaskDependency_project_fkey', 'TaskDependency_predecessor_scope_fkey', 'TaskDependency_successor_scope_fkey',
  ]]);
  assert.equal(constraints.rowCount, 9, 'All S3 checks and scoped FKs must exist.');

  const indexes = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE indexname = ANY($1::text[])
  `, [[
    'Task_projectId_id_key', 'Task_projectId_code_key', 'Task_projectId_parentId_idx',
    'TaskDependency_project_predecessor_successor_key', 'TaskDependency_project_successor_idx',
  ]]);
  assert.equal(indexes.rowCount, 5, 'All S3 scope and lookup indexes must exist.');

  console.log(JSON.stringify({ ok: true, migration: MIGRATION, checks: 5, constraints: constraints.rowCount, indexes: indexes.rowCount }));
} finally {
  client.release();
  await pool.end();
}
