import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseIdentityDigest } from '../scripts/vercel-build.mjs';
import { inspectReleaseConfiguration } from '../scripts/inspect-release-configuration.mjs';
const prod = 'postgresql://owner:prod-secret@ep-production.sa-east-1.aws.neon.tech/app';
const preview = 'postgresql://owner:preview-secret@ep-preview.sa-east-1.aws.neon.tech/app';
const pooled = preview.replace('ep-preview.', 'ep-preview-pooler.');
const digest = url => databaseIdentityDigest(url).toString('hex');
const environment = overrides => ({ VERCEL_ENV: 'preview', DATABASE_URL: pooled, DIRECT_URL: preview, DATABASE_URL_UNPOOLED: preview, OBRASAAS_PRODUCTION_DATABASE_IDENTITY_SHA256: digest(prod), OBRASAAS_PREVIEW_DATABASE_IDENTITY_SHA256: digest(preview), ...overrides });
test('pooled and direct identify one preview without exposing connections', () => {
  const result = inspectReleaseConfiguration(environment());
  assert.equal(result.distinctIdentities, 1);
  assert.equal(result.migrationGate.status, 'APPROVED_TO_ATTEMPT');
  assert.ok(result.connections.every(item => item.expectedPreviewMatch === true && item.productionMatch === false));
});
test('mixed connection sources are blocked and identified by variable name', () => {
  const result = inspectReleaseConfiguration(environment({ DATABASE_URL_UNPOOLED: prod }));
  assert.equal(result.migrationGate.status, 'BLOCKED'); assert.equal(result.mixedDatabaseTargets, true);
  assert.equal(result.connections.find(item => item.key === 'DATABASE_URL_UNPOOLED').productionMatch, true);
});
test('all production targets remain blocked in preview', () => {
  const result = inspectReleaseConfiguration(environment({ DATABASE_URL: prod, DIRECT_URL: prod, DATABASE_URL_UNPOOLED: prod }));
  assert.equal(result.migrationGate.status, 'BLOCKED');
});
test('malformed connection reports no raw URL or parser details', () => {
  const result = inspectReleaseConfiguration(environment({ DIRECT_URL: 'sensitive-invalid-material' }));
  assert.equal(result.connections[0].state, 'INVALID');
  assert.equal(result.migrationGate.status, 'BLOCKED');
  assert.ok(!JSON.stringify(result).includes('sensitive-invalid-material'));
});
test('missing runtime connection stays blocked', () => {
  const result = inspectReleaseConfiguration(environment({ DATABASE_URL: undefined }));
  assert.equal(result.migrationGate.status, 'BLOCKED');
  assert.equal(result.connections.find(item => item.key === 'DATABASE_URL').state, 'MISSING');
});
test('different database names are not treated as the same scope', () => {
  const result = inspectReleaseConfiguration(environment({ DIRECT_URL: preview.replace('/app', '/other') }));
  assert.equal(result.distinctIdentities, 2); assert.equal(result.migrationGate.status, 'BLOCKED');
});
test('production approval is not implied by matching connection variables', () => {
  const result = inspectReleaseConfiguration(environment({ VERCEL_ENV: 'production', DATABASE_URL: prod, DIRECT_URL: prod, DATABASE_URL_UNPOOLED: prod }));
  assert.equal(result.migrationGate.status, 'BLOCKED');
});
test('local inspection never claims a migration or live service is verified', () => {
  const result = inspectReleaseConfiguration(environment({ VERCEL_ENV: undefined }));
  assert.equal(result.migrationGate.status, 'LOCAL_NO_MIGRATION');
  assert.equal(result.providerVerified, false); assert.equal(result.runtimeVerified, false);
});
test('inspection does not mutate the supplied environment', () => {
  const input = Object.freeze(environment()); const before = JSON.stringify(input);
  inspectReleaseConfiguration(input); assert.equal(JSON.stringify(input), before);
});
test('report never exposes passwords, usernames, hosts or identity digests', () => {
  const result = JSON.stringify(inspectReleaseConfiguration(environment()));
  for (const secret of ['prod-secret', 'preview-secret', 'owner', 'ep-preview', 'ep-production', digest(preview), digest(prod)]) assert.ok(!result.includes(secret));
});
