import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const script = fileURLToPath(new URL('../scripts/verify-webhook-flow-atomic-postgres.mjs', import.meta.url));
const target = 'postgresql://fixture:fixture@127.0.0.1:5432/obrasaas_execution_ci?schema=public';
for (const [name, patch] of [
  ['no explicit acknowledgement', {}],
  ['wrong host', { EXECUTION_RELEASE_DISPOSABLE: 'true', EXECUTION_RELEASE_DATABASE_URL: target.replace('127.0.0.1', 'db.example.invalid') }],
  ['wrong database', { EXECUTION_RELEASE_DISPOSABLE: 'true', EXECUTION_RELEASE_DATABASE_URL: target.replace('obrasaas_execution_ci', 'customer_data') }],
  ['wrong port', { EXECUTION_RELEASE_DISPOSABLE: 'true', EXECUTION_RELEASE_DATABASE_URL: target.replace(':5432', ':5433') }],
  ['production target', { EXECUTION_RELEASE_DISPOSABLE: 'true', EXECUTION_RELEASE_DATABASE_URL: target, VERCEL_ENV: 'production' }],
  ['preview target', { EXECUTION_RELEASE_DISPOSABLE: 'true', EXECUTION_RELEASE_DATABASE_URL: target, VERCEL_ENV: 'preview' }],
]) test('atomic verification refuses ' + name + ' before loading Prisma or network calls', () => {
  const env = { ...process.env, DATABASE_URL: 'postgresql://do-not-use.invalid/customer', EXECUTION_RELEASE_DISPOSABLE: '', EXECUTION_RELEASE_DATABASE_URL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '', ...patch };
  const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined); assert.notEqual(result.status, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /Execution verification requires|AssertionError/);
  assert.doesNotMatch(output, /ERR_MODULE_NOT_FOUND|PrismaClientInitializationError|ECONNREFUSED|ENOTFOUND|PASS isolated/);
});
