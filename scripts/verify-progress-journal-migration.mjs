import pg from 'pg';

const migration = '20260724140000_daily_logs_progress_evidence';
const expectedTables = ['DailyLog', 'ProgressEvidence'];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
  if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  const tables = await client.query('SELECT "tablename" FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = ANY($1::text[])', [expectedTables]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  for (const table of expectedTables) if (!found.has(table)) throw new Error(`Missing table ${table}.`);
  const constraints = await client.query('SELECT COUNT(*)::int AS count FROM "pg_constraint" WHERE "conrelid" IN ($1::regclass, $2::regclass)', expectedTables);
  if (constraints.rows[0].count < 8) throw new Error('Progress journal constraints are incomplete.');
  console.log(`Verified ${migration}: ${expectedTables.join(', ')} and scoped constraints.`);
} finally { await client.end(); }
