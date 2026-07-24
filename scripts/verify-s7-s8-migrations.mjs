import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const migrations = ['20260724200000_budget_versions', '20260724210000_budget_entries', '20260724220000_cash_funds', '20260724230000_cash_movement_fingerprints', '20260724240000_cash_dual_approval'];
  for (const migration of migrations) {
    const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
    if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  }
  const tables = await client.query('SELECT "tablename" FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = ANY($1::text[])', [['BudgetVersion', 'BudgetLine', 'BudgetEntry', 'CashFund', 'CashMovement']]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  for (const table of ['BudgetVersion', 'BudgetLine', 'BudgetEntry', 'CashFund', 'CashMovement']) if (!found.has(table)) throw new Error(`Missing table ${table}.`);
  const unique = await client.query('SELECT COUNT(*)::int AS count FROM "pg_indexes" WHERE "schemaname" = current_schema() AND "indexname" ILIKE $1', ['%idempotency%']);
  if (unique.rows[0].count < 2) throw new Error('Financial idempotency indexes are incomplete.');
  const columns = await client.query('SELECT "column_name" FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = ANY($2::text[])', ['CashMovement', ['fingerprint', 'firstApproverId', 'secondApproverId']]);
  const foundColumns = new Set(columns.rows.map((row) => row.column_name));
  for (const column of ['fingerprint', 'firstApproverId', 'secondApproverId']) if (!foundColumns.has(column)) throw new Error(`Missing CashMovement column ${column}.`);
  const enumValue = await client.query('SELECT 1 FROM pg_enum WHERE enumtypid = \'"CashMovementStatus"\'::regtype AND enumlabel = $1', ['PARTIALLY_APPROVED']);
  if (enumValue.rowCount !== 1) throw new Error('CashMovementStatus dual-approval value is missing.');
  console.log('Verified S7/S8 migrations: budgets, ledger, private cash receipts and dual approval.');
} finally { await client.end(); }
