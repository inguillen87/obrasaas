import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
try {
  for (const migration of ['20260724170000_extra_work_requests', '20260724180000_replan_scenarios', '20260724190000_extra_work_sessions']) {
    const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
    if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  }
  const tables = await client.query('SELECT "tablename" FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = ANY($1::text[])', [['ExtraWorkRequest', 'ReplanScenario', 'ExtraWorkSession']]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  for (const table of ['ExtraWorkRequest', 'ReplanScenario', 'ExtraWorkSession']) if (!found.has(table)) throw new Error(`Missing table ${table}.`);
  const constraints = await client.query('SELECT COUNT(*)::int AS count FROM "pg_constraint" WHERE "conrelid" IN ($1::regclass, $2::regclass)', ['ExtraWorkRequest', 'ReplanScenario']);
  if (constraints.rows[0].count < 8) throw new Error('S6 constraints are incomplete.');
  console.log('Verified S6 migrations: extra work, sessions and isolated replan scenarios.');
} finally { await client.end(); }
