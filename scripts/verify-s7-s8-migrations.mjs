import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const migrations = ['20260724200000_budget_versions', '20260724210000_budget_entries', '20260724220000_cash_funds'];
  for (const migration of migrations) {
    const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
    if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  }
  const tables = await client.query('SELECT "tablename" FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = ANY($1::text[])', [['BudgetVersion', 'BudgetLine', 'BudgetEntry', 'CashFund', 'CashMovement']]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  for (const table of ['BudgetVersion', 'BudgetLine', 'BudgetEntry', 'CashFund', 'CashMovement']) if (!found.has(table)) throw new Error(`Missing table ${table}.`);
  const unique = await client.query('SELECT COUNT(*)::int AS count FROM "pg_indexes" WHERE "schemaname" = current_schema() AND "indexname" ILIKE $1', ['%idempotency%']);
  if (unique.rows[0].count < 2) throw new Error('Financial idempotency indexes are incomplete.');
  console.log('Verified S7/S8 migrations: budgets, ledger and petty cash with idempotency constraints.');
} finally { await client.end(); }
