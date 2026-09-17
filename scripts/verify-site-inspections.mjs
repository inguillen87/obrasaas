import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { evaluateMigrationGate } from './vercel-build.mjs';

const target = process.env.INSPECTION_VERIFY_DATABASE_URL;
if (!target) throw new Error('INSPECTION_VERIFY_DATABASE_URL is required; no implicit database fallback.');
evaluateMigrationGate({ ...process.env, VERCEL_ENV: 'preview', DATABASE_URL: target, DIRECT_URL: target, DATABASE_URL_UNPOOLED: target });
const client = new pg.Client({ connectionString: target, connectionTimeoutMillis: 20000 });
await client.connect();
let assertions = 0;
try {
  await client.query('BEGIN');
  const prefix = 'inspection-verify-' + randomUUID();
  const org = prefix + '-org', project = prefix + '-project', actor = prefix + '-actor', record = prefix + '-record';
  await client.query('INSERT INTO "Organization" (id, name, slug, "updatedAt") VALUES ($1,$1,$1,now())', [org]);
  await client.query('INSERT INTO "PlatformUser" (id, "clerkUserId", "primaryEmail", "updatedAt") VALUES ($1,$1,$2,now())', [actor, prefix + '@example.invalid']);
  await client.query('INSERT INTO "Project" (id, "organizationId", name, slug, "updatedAt") VALUES ($1,$2,$1,$1,now())', [project, org]);
  const checklist = JSON.stringify([{ key: 'control', result: 'PASS', criterion: 'Documento de ensayo sintético', observation: 'Sólo prueba transaccional' }]);
  const insert = 'INSERT INTO "InspectionRecord" (id,"organizationId","projectId","clientRequestId","requestHash",title,location,"templateKey","templateVersion","technicalReference",notes,checklist,"contentHash","createdById","updatedAt") VALUES ($1,$2,$3,$1,$4,$1,$1,\'SEGURIDAD\',1,\'Prueba\',\'\',$5::jsonb,$4,$6,now())';
  const args = [record, org, project, '0'.repeat(64), checklist, actor];
  await client.query(insert, args); assertions++;
  async function rejects(sql, values, expectedCode) {
    await client.query('SAVEPOINT rejected_operation');
    try { await client.query(sql, values); assert.fail('Unsafe operation was accepted'); }
    catch (error) { assert.equal(error.code, expectedCode); assertions++; }
    finally { await client.query('ROLLBACK TO SAVEPOINT rejected_operation'); }
  }
  await rejects(insert, [record + '-cross', org + '-foreign', project, '0'.repeat(64), checklist, actor], '23503');
  await rejects(insert, args, '23505');
  await rejects('UPDATE "InspectionRecord" SET status=\'APPROVED\',version=2 WHERE id=$1', [record], '55000');
  await client.query('UPDATE "InspectionRecord" SET status=\'SUBMITTED\',version=2 WHERE id=$1', [record]); assertions++;
  await client.query('UPDATE "InspectionRecord" SET status=\'APPROVED\',version=3,"reviewedById"=$2,"reviewedAt"=now(),"reviewNotes"=\'Synthetic verification\' WHERE id=$1', [record, actor]); assertions++;
  await rejects('UPDATE "InspectionRecord" SET notes=\'Mutated final\',version=4 WHERE id=$1', [record], '55000');
  await client.query('ROLLBACK');
  const remaining = await client.query('SELECT count(*)::int AS count FROM "InspectionRecord" WHERE id=$1', [record]);
  assert.equal(remaining.rows[0].count, 0); assertions++;
  console.log(JSON.stringify({ result: 'PASS', assertions, database: 'isolated-preview', fixtures: 'rolled-back' }));
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}
