import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const migrations = ['20260724250000_suppliers', '20260724260000_purchase_orders', '20260724270000_purchase_order_budget_links', '20260724280000_goods_receipts', '20260724290000_goods_receipt_evidence'];
  for (const migration of migrations) {
    const result = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
    if (result.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  }
  const tables = await client.query('SELECT "tablename" FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = ANY($1::text[])', [['Supplier', 'PurchaseOrder', 'PurchaseOrderLine', 'GoodsReceipt', 'GoodsReceiptLine']]);
  const found = new Set(tables.rows.map((row) => row.tablename));
  for (const table of ['Supplier', 'PurchaseOrder', 'PurchaseOrderLine', 'GoodsReceipt', 'GoodsReceiptLine']) if (!found.has(table)) throw new Error(`Missing table ${table}.`);
  const constraints = await client.query('SELECT COUNT(*)::int AS count FROM "pg_constraint" WHERE "conrelid" IN ($1::regclass, $2::regclass, $3::regclass, $4::regclass, $5::regclass)', ['Supplier', 'PurchaseOrder', 'PurchaseOrderLine', 'GoodsReceipt', 'GoodsReceiptLine']);
  if (constraints.rows[0].count < 12) throw new Error('S9 constraints are incomplete.');
  console.log('Verified S9 migrations: suppliers, purchase orders, budget links and goods receipts.');
} finally { await client.end(); }
