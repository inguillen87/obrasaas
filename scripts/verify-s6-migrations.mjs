import pg from 'pg';

const expectedTables = ['ExtraWorkRequest', 'ReplanScenario', 'ExtraWorkSession'];
const expectedConstraints = [
  ['ExtraWorkRequest', 'ExtraWorkRequest_pkey'],
  ['ExtraWorkRequest', 'ExtraWorkRequest_projectId_fkey'],
  ['ExtraWorkRequest', 'ExtraWorkRequest_project_task_fkey'],
  ['ExtraWorkRequest', 'ExtraWorkRequest_project_worker_fkey'],
  ['ExtraWorkRequest', 'ExtraWorkRequest_invariants_check'],
  ['ReplanScenario', 'ReplanScenario_pkey'],
  ['ReplanScenario', 'ReplanScenario_projectId_fkey'],
  ['ReplanScenario', 'ReplanScenario_extraWorkId_fkey'],
  ['ReplanScenario', 'ReplanScenario_revision_check'],
  ['ExtraWorkSession', 'ExtraWorkSession_pkey'],
  ['ExtraWorkSession', 'ExtraWorkSession_projectId_fkey'],
  ['ExtraWorkSession', 'ExtraWorkSession_extraWork_project_fkey'],
  ['ExtraWorkSession', 'ExtraWorkSession_worker_project_fkey'],
  ['ExtraWorkSession', 'ExtraWorkSession_time_check'],
  ['ExtraWorkSession', 'ExtraWorkSession_accuracy_check'],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  for (const migration of ['20260724170000_extra_work_requests', '20260724180000_replan_scenarios', '20260724190000_extra_work_sessions']) {
    const applied = await client.query(
      `SELECT 1
         FROM "_prisma_migrations"
        WHERE tableoid = to_regclass(format('%I.%I', current_schema(), '_prisma_migrations'))
          AND "migration_name" = $1
          AND "finished_at" IS NOT NULL`,
      [migration],
    );
    if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  }

  const tables = await client.query(
    'SELECT "tablename" FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = ANY($1::text[])',
    [expectedTables],
  );
  const found = new Set(tables.rows.map((row) => row.tablename));
  for (const table of expectedTables) {
    if (!found.has(table)) throw new Error(`Missing table ${table}.`);
  }

  const constraints = await client.query(
    `SELECT constrained_relation.relname AS table_name,
            constraint_record.conname AS constraint_name
       FROM pg_catalog.pg_constraint AS constraint_record
       JOIN pg_catalog.pg_class AS constrained_relation
         ON constrained_relation.oid = constraint_record.conrelid
       JOIN pg_catalog.pg_namespace AS relation_namespace
         ON relation_namespace.oid = constrained_relation.relnamespace
      WHERE relation_namespace.nspname = current_schema()
        AND constrained_relation.relname = ANY($1::text[])
        AND constraint_record.conname = ANY($2::text[])`,
    [
      expectedTables,
      expectedConstraints.map(([, constraintName]) => constraintName),
    ],
  );
  const foundConstraints = new Set(
    constraints.rows.map((row) => `${row.table_name}.${row.constraint_name}`),
  );
  const missingConstraints = expectedConstraints
    .map(([tableName, constraintName]) => `${tableName}.${constraintName}`)
    .filter((constraint) => !foundConstraints.has(constraint));
  if (missingConstraints.length > 0) {
    throw new Error(`S6 constraints are incomplete: ${missingConstraints.join(', ')}.`);
  }

  console.log('Verified S6 migrations: extra work, sessions and isolated replan scenarios.');
} finally {
  await client.end();
}
