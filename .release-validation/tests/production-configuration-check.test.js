import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectProductionPrerequisites } from '../scripts/lib/production-configuration-check.mjs';

// These values are inert fixtures, never credentials used to contact a provider.
function configured(overrides = {}) {
  return {
    VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://construction.example',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture_public', CLERK_SECRET_KEY: 'sk_live_fixture_private',
    CLERK_AUTHORIZED_PARTIES: 'https://construction.example', CLERK_EXPECTED_INSTANCE_ID: 'ins_fixture',
    CLERK_WEBHOOK_SIGNING_SECRET: 'fixture-clerk-signing-only',
    CLERK_WEBHOOK_EVIDENCE_SECRET: 'fixture-clerk-evidence-only', META_APP_SECRET: 'fixture-meta-app-only',
    META_VERIFY_TOKEN: 'fixture-meta-verification-only', CRON_SECRET: 'fixture-cron-only',
    WEBVIEW_TOKEN_SECRET: 'fixture-webview-signing-not-a-real-key',
    NEXT_PUBLIC_META_APP_ID: '123456789', NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '987654321',
    META_GRAPH_API_VERSION: 'v25.0', WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 21).toString('base64'),
    WHATSAPP_PILOT_IMPORT_ENABLED: 'false', PRIVATE_MEDIA_PROVIDER: 'vercel-blob',
    BLOB_READ_WRITE_TOKEN: 'fixture-private-storage-only', ...overrides,
  };
}
const blockers = result => result.checks.filter(item => item.status === 'BLOCKED').map(item => item.key);

test('a structural pass does not claim operational readiness or authorize database changes', () => {
  const result = inspectProductionPrerequisites(configured());
  assert.equal(result.status, 'CONFIGURATION_CHECKED'); assert.equal(result.blockerCount, 0);
  assert.equal(result.providerVerified, false); assert.equal(result.runtimeVerified, false);
  assert.equal(result.migrationAuthorizedByThisCheck, false);
});
test('input is neither changed nor retained in the output', () => {
  const env = Object.freeze(configured()); const before = JSON.stringify(env);
  const report = JSON.stringify(inspectProductionPrerequisites(env)); assert.equal(JSON.stringify(env), before);
  for (const key of ['CLERK_SECRET_KEY', 'META_APP_SECRET', 'META_VERIFY_TOKEN', 'BLOB_READ_WRITE_TOKEN', 'NEXT_PUBLIC_APP_URL', 'WHATSAPP_CREDENTIALS_ENCRYPTION_KEY']) {
    assert.ok(!report.includes(env[key]), 'Output exposed a configuration value');
  }
});
for (const key of ['CLERK_WEBHOOK_SIGNING_SECRET','CLERK_WEBHOOK_EVIDENCE_SECRET','CLERK_EXPECTED_INSTANCE_ID',
  'META_APP_SECRET','META_VERIFY_TOKEN','CRON_SECRET','WEBVIEW_TOKEN_SECRET','NEXT_PUBLIC_META_APP_ID',
  'NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID','META_GRAPH_API_VERSION','WHATSAPP_CREDENTIALS_ENCRYPTION_KEY',
  'BLOB_READ_WRITE_TOKEN','PRIVATE_MEDIA_PROVIDER']) {
  test('missing production prerequisite is explicit: ' + key, () => {
    const report = inspectProductionPrerequisites(configured({ [key]: undefined }));
    assert.equal(report.status, 'BLOCKED'); assert.ok(blockers(report).includes(key));
  });
}
test('all missing production configuration is reported together, not one failure per deploy', () => {
  const result = inspectProductionPrerequisites({ VERCEL_ENV: 'production' });
  assert.equal(result.status, 'BLOCKED'); assert.ok(result.blockerCount >= 15);
  assert.ok(blockers(result).includes('META_APP_SECRET')); assert.ok(blockers(result).includes('CLERK_SECRET_KEY'));
});
for (const mode of [undefined, 'development', 'preview']) {
  test('local and isolated preview keep their existing migration guard: ' + String(mode), () => {
    const report = inspectProductionPrerequisites({ VERCEL_ENV: mode });
    assert.equal(report.status, 'NOT_APPLICABLE'); assert.equal(report.applicable, false); assert.deepEqual(report.checks, []);
  });
}
test('environment mismatch or unknown target cannot suppress this check', () => {
  for (const pair of [{ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'production' },
    { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'preview' }, { VERCEL_ENV: 'not-recognized' }]) {
    assert.ok(blockers(inspectProductionPrerequisites(configured(pair))).includes('VERCEL_ENV'));
  }
});
test('Clerk development keys cannot be treated as production identity', () => {
  const result = inspectProductionPrerequisites(configured({ CLERK_SECRET_KEY: 'sk_test_fixture', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture' }));
  assert.ok(blockers(result).includes('CLERK_SECRET_KEY')); assert.ok(blockers(result).includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'));
});
for (const url of ['http://construction.example', 'https://login:password@construction.example',
  'https://construction.example/path', 'https://construction.example/?secret=never-log', 'https://localhost', 'not-a-url']) {
  test('unsafe public origin rejected without revealing it: ' + url.split(':')[0], () => {
    const report = inspectProductionPrerequisites(configured({ NEXT_PUBLIC_APP_URL: url }));
    assert.ok(blockers(report).includes('NEXT_PUBLIC_APP_URL')); assert.ok(!JSON.stringify(report).includes(url));
  });
}
test('Clerk parties must contain the exact HTTPS origin, not a suffix or arbitrary wildcard', () => {
  for (const value of ['https://other.example', 'https://construction.example.evil.example', '*', 'https://construction.example,http://localhost:3000']) {
    assert.ok(blockers(inspectProductionPrerequisites(configured({ CLERK_AUTHORIZED_PARTIES: value }))).includes('CLERK_AUTHORIZED_PARTIES'));
  }
});
test('encryption material must decode to 32 bytes and use valid canonical base64', () => {
  for (const key of ['?', Buffer.alloc(16).toString('base64'), Buffer.alloc(64).toString('base64'), ' ' + Buffer.alloc(32).toString('base64')]) {
    assert.ok(blockers(inspectProductionPrerequisites(configured({ WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: key }))).includes('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY'));
  }
});
test('reusing a signing secret across domains is reported without returning the secret', () => {
  const env = configured(); env.CRON_SECRET = env.META_VERIFY_TOKEN;
  const report = inspectProductionPrerequisites(env); assert.ok(blockers(report).includes('SIGNING_KEY_SEPARATION'));
  assert.ok(!JSON.stringify(report).includes(env.CRON_SECRET));
});
test('pilot importer never passes the production configuration check', () => {
  for (const flag of ['true', 'TRUE', '1', true]) {
    assert.ok(blockers(inspectProductionPrerequisites(configured({ WHATSAPP_PILOT_IMPORT_ENABLED: flag }))).includes('WHATSAPP_PILOT_IMPORT_ENABLED'));
  }
  assert.equal(inspectProductionPrerequisites(configured({ WHATSAPP_PILOT_IMPORT_ENABLED: undefined })).status, 'CONFIGURATION_CHECKED');
});
test('empty, padded or placeholder values are not configured credentials', () => {
  for (const value of ['', ' ', ' fixture', 'replace-with-a-key', 'changeme', 'abc\0def']) {
    assert.ok(blockers(inspectProductionPrerequisites(configured({ META_APP_SECRET: value }))).includes('META_APP_SECRET'));
  }
});
test('Cloudinary requires its own credential configuration, not a Vercel token', () => {
  const missing = configured({ PRIVATE_MEDIA_PROVIDER: 'cloudinary' });
  assert.ok(blockers(inspectProductionPrerequisites(missing)).includes('CLOUDINARY_CONFIGURATION'));
  assert.equal(inspectProductionPrerequisites({ ...missing, CLOUDINARY_CLOUD_NAME: 'fixture-cloud',
    CLOUDINARY_API_KEY: 'fixture-key', CLOUDINARY_API_SECRET: 'fixture-secret' }).status, 'CONFIGURATION_CHECKED');
});
