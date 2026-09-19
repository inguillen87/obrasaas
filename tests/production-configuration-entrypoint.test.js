import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectReleaseConfiguration } from '../scripts/inspect-release-configuration.mjs';
import { databaseIdentityDigest, evaluateMigrationGate } from '../scripts/vercel-build.mjs';

function databaseConfiguration() {
  const databaseUrl = 'postgresql://fixture:never-send@ep-fixture.us-east-1.aws.neon.tech/fixture?schema=public';
  return { VERCEL_ENV: 'production', DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl,
    OBRASAAS_PRODUCTION_DATABASE_IDENTITY_SHA256: databaseIdentityDigest(databaseUrl).toString('hex'),
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), OBRASAAS_PRODUCTION_MIGRATION_RELEASE_SHA: 'a'.repeat(40) };
}
test('approved database/SHA alone cannot hide missing production prerequisites', () => {
  const env = databaseConfiguration(); assert.equal(evaluateMigrationGate(env).migrate, true);
  const report = inspectReleaseConfiguration(env);
  assert.equal(report.migrationGate.status, 'APPROVED_TO_ATTEMPT');
  assert.equal(report.productionPrerequisites.status, 'BLOCKED');
  assert.ok(report.productionPrerequisites.checks.some(check => check.key === 'META_APP_SECRET' && check.status === 'BLOCKED'));
});
test('CLI fails even with approved migration identity when application configuration is incomplete', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/inspect-release-configuration.mjs', import.meta.url))],
    { env: databaseConfiguration(), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); const report = JSON.parse(result.stdout);
  assert.equal(report.migrationGate.status, 'APPROVED_TO_ATTEMPT'); assert.equal(report.productionPrerequisites.status, 'BLOCKED');
  for (const forbidden of ['never-send', 'ep-fixture', databaseConfiguration().DATABASE_URL]) assert.ok(!result.stdout.includes(forbidden));
});
test('production key mismatch continues to be blocked by the existing migration gate', () => {
  const env = { ...databaseConfiguration(), OBRASAAS_PRODUCTION_MIGRATION_RELEASE_SHA: 'b'.repeat(40) };
  assert.throws(() => evaluateMigrationGate(env)); assert.equal(inspectReleaseConfiguration(env).migrationGate.status, 'BLOCKED');
});
test('Preview cannot reuse approved Production database even though new prerequisite check is not applicable', () => {
  const result = inspectReleaseConfiguration({ ...databaseConfiguration(), VERCEL_ENV: 'preview' });
  assert.equal(result.productionPrerequisites.status, 'NOT_APPLICABLE'); assert.equal(result.migrationGate.status, 'BLOCKED');
});
test('Vercel executes the inspection before migration-capable build with short-circuit semantics', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.buildCommand, 'node scripts/inspect-release-configuration.mjs && npm run build:vercel');
});
test('local CLI keeps its non-migrating behavior', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/inspect-release-configuration.mjs', import.meta.url))],
    { env: { VERCEL_ENV: 'development' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0); const report = JSON.parse(result.stdout);
  assert.equal(report.migrationGate.status, 'LOCAL_NO_MIGRATION'); assert.equal(report.productionPrerequisites.status, 'NOT_APPLICABLE');
});
