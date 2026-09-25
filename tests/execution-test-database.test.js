import assert from 'node:assert/strict';
import test from 'node:test';
import { executionTestConnection } from '../scripts/lib/execution-test-database.mjs';
const url = 'postgresql://fixture:local-only@127.0.0.1:5432/obrasaas_execution_ci?schema=public';
const env = extra => ({ EXECUTION_RELEASE_DISPOSABLE: 'true', EXECUTION_RELEASE_DATABASE_URL: url, ...extra });
test('isolated database selection strips only the Prisma schema parameter', () => {
  assert.equal(executionTestConnection(env()), url.split('?')[0]);
});
for (const extra of [
  { EXECUTION_RELEASE_DISPOSABLE: undefined }, { EXECUTION_RELEASE_DISPOSABLE: true },
  { EXECUTION_RELEASE_DATABASE_URL: undefined, DATABASE_URL: url },
  { VERCEL_ENV: 'production' }, { VERCEL_TARGET_ENV: 'production' },
]) test('missing consent, generic fallback or production environment is refused: ' + JSON.stringify(extra), () => {
  assert.throws(() => executionTestConnection(env(extra)), /isolated loopback/);
});
for (const candidate of [
  url.replace('127.0.0.1', 'db.neon.tech'), url.replace('127.0.0.1', 'localhost'),
  url.replace('obrasaas_execution_ci', 'production'), url.replace('5432', '6432'),
  url + '&host=other.example', url + '&options=-csearch_path%3Dsecret',
  url + '&schema=other', url + '#fragment', url.split('?')[0],
  ' ' + url, 'not-a-connection', url.replace('postgresql:', 'https:'),
]) test('unapproved connection is refused without exposing its value: ' + candidate.split('@').at(-1), () => {
  try { executionTestConnection(env({ EXECUTION_RELEASE_DATABASE_URL: candidate })); assert.fail('must refuse'); }
  catch (error) { assert.match(error.message, /isolated loopback/); assert.ok(!error.message.includes('local-only')); assert.ok(!error.message.includes(candidate)); }
});
test('environment input is not mutated', () => {
  const input = Object.freeze(env()); executionTestConnection(input); assert.equal(input.EXECUTION_RELEASE_DATABASE_URL, url);
});
