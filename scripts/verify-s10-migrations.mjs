import pg from 'pg';

const connectionString = process.env.S10_MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('S10_MIGRATION_DATABASE_URL or DATABASE_URL is required.');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const migration = '20260724310000_supplier_invoices';
  const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
  if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  const table = await client.query('SELECT 1 FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = $1', ['SupplierInvoice']);
  if (table.rowCount !== 1) throw new Error('Missing table SupplierInvoice.');
  const enumResult = await client.query('SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = $1 AND e.enumlabel = ANY($2::text[])', ['SupplierInvoiceStatus', ['RECEIVED', 'APPROVED', 'PAID', 'VOIDED']]);
  if (enumResult.rowCount !== 4) throw new Error('SupplierInvoiceStatus enum is incomplete.');
  const indexes = await client.query('SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1 AND indexname = ANY($2::text[])', ['SupplierInvoice', ['SupplierInvoice_projectId_operationKey_key', 'SupplierInvoice_organizationId_supplierId_invoiceNumber_key', 'SupplierInvoice_projectId_status_dueAt_idx']]);
  if (indexes.rows[0].count !== 3) throw new Error('S10 invoice indexes are incomplete.');
  const checks = await client.query('SELECT COUNT(*)::int AS count FROM pg_constraint WHERE conrelid = $1::regclass AND contype = $2', ['SupplierInvoice', 'c']);
  if (checks.rows[0].count < 1) throw new Error('SupplierInvoice amount check is missing.');
  console.log('Verified S10 migration: supplier invoices, statuses, indexes and amount constraint.');
} finally { await client.end(); }
