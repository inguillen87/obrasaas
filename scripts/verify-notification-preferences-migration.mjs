import pg from 'pg';
const migration = '20260724160000_notification_preferences';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
try { const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]); if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`); const table = await client.query('SELECT 1 FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = $1', ['NotificationPreference']); if (table.rowCount !== 1) throw new Error('NotificationPreference table is missing.'); console.log(`Verified ${migration}: notification preferences.`); } finally { await client.end(); }
