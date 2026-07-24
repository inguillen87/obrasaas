import pg from 'pg';
const migration = '20260724150000_notification_outbox';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
  if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  const table = await client.query('SELECT 1 FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = $1', ['NotificationDelivery']);
  if (table.rowCount !== 1) throw new Error('NotificationDelivery table is missing.');
  const indexes = await client.query('SELECT COUNT(*)::int AS count FROM "pg_indexes" WHERE "schemaname" = current_schema() AND "tablename" = $1', ['NotificationDelivery']);
  if (indexes.rows[0].count < 3) throw new Error('Notification outbox indexes are incomplete.');
  console.log(`Verified ${migration}: durable notification outbox and dedupe indexes.`);
} finally { await client.end(); }
