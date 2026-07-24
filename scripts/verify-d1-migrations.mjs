import pg from 'pg';

const connectionString = process.env.D1_MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('D1_MIGRATION_DATABASE_URL or DATABASE_URL is required.');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const migration = '20260724320000_worker_documents_start_acts';
  const applied = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL', [migration]);
  if (applied.rowCount !== 1) throw new Error(`Migration ${migration} is not applied.`);
  for (const table of ['WorkerDocument', 'ProjectStartAct', 'ProjectStartActParticipant']) {
    const result = await client.query('SELECT 1 FROM "pg_tables" WHERE "schemaname" = current_schema() AND "tablename" = $1', [table]);
    if (result.rowCount !== 1) throw new Error(`Missing table ${table}.`);
  }
  const enums = await client.query('SELECT typname, COUNT(*)::int AS count FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE typname = ANY($1::text[]) GROUP BY typname', [['WorkerDocumentType', 'WorkerDocumentStatus', 'ProjectStartActStatus']]);
  const counts = new Map(enums.rows.map((row) => [row.typname, row.count]));
  if (counts.get('WorkerDocumentType') !== 5 || counts.get('WorkerDocumentStatus') !== 5 || counts.get('ProjectStartActStatus') !== 4) throw new Error('D1 enums are incomplete.');
  console.log('Verified D1 migration: worker dossier, start act tables and lifecycle enums.');
} finally { await client.end(); }
