import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectClerkAccessBuildGate } from '../scripts/lib/clerk-access-build-gate.mjs';
import { inspectIdentityProvider } from '../scripts/lib/production-identity-check.mjs';
import { IDENTITY_ORIGIN, IDENTITY_PUBLIC_KEY, IDENTITY_INSTANCE } from '../src/lib/production-identity-config.mjs';

const environment = { VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: IDENTITY_ORIGIN,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: IDENTITY_PUBLIC_KEY, CLERK_EXPECTED_INSTANCE_ID: IDENTITY_INSTANCE,
  CLERK_AUTHORIZED_PARTIES: IDENTITY_ORIGIN, CLERK_SECRET_KEY: 'sk_live_' + 'synthetic_only'.repeat(4) };
const inspectWith = fetchImpl => options => inspectIdentityProvider({ ...options, fetchImpl });

for (const target of [undefined, 'development', 'preview']) {
  test('non-production target ' + target + ' explicitly skips without a provider call or verification claim', async () => {
    let calls = 0;
    const result = await inspectClerkAccessBuildGate({ environment: { ...environment, VERCEL_ENV: target, NODE_ENV: 'production', CI: 'true' },
      inspect: async () => { calls++; throw new Error('must not call'); } });
    assert.equal(calls, 0);
    assert.deepEqual(result, { version: 1, readOnly: true, customerLoginVerified: false, businessAccessEnabled: false,
      status: 'SKIPPED_NON_PRODUCTION', required: false, passed: false, instanceIdMatched: false });
  });
}

test('production can pass only after the existing provider reader confirms the exact pinned instance', async () => {
  let calls = 0;
  const result = await inspectClerkAccessBuildGate({ environment: { ...environment, CI: 'true' }, inspect: inspectWith(async (url, options) => {
    calls++; assert.equal(url, 'https://api.clerk.com/v1/instance');
    assert.equal(options.method ?? 'GET', 'GET'); assert.equal(options.body, undefined);
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer ' + environment.CLERK_SECRET_KEY);
    return Response.json({ id: IDENTITY_INSTANCE, irrelevantPrivateField: 'provider-private-field' });
  }) });
  assert.equal(calls, 1); assert.equal(result.required, true); assert.equal(result.passed, true);
  assert.equal(result.status, 'INSTANCE_VERIFIED'); assert.equal(result.instanceIdMatched, true);
  assert.equal(result.customerLoginVerified, false); assert.equal(result.businessAccessEnabled, false);
  assert.doesNotMatch(JSON.stringify(result), /sk_live_|provider-private-field|Authorization|irrelevantPrivateField/);
});

test('production with missing configuration cannot pass and never calls the provider', async () => {
  let calls = 0;
  const result = await inspectClerkAccessBuildGate({ environment: { VERCEL_ENV: 'production' },
    inspect: inspectWith(async () => { calls++; throw new Error('must not call'); }) });
  assert.equal(calls, 0); assert.equal(result.status, 'CONFIGURATION_PENDING');
  assert.equal(result.required, true); assert.equal(result.passed, false);
});

for (const [http, expected] of [[401, 'PROVIDER_CREDENTIAL_REJECTED'], [403, 'PROVIDER_CREDENTIAL_REJECTED'],
  [429, 'PROVIDER_UNCONFIRMED'], [500, 'PROVIDER_UNCONFIRMED']]) {
  test('production HTTP ' + http + ' blocks the build without copying provider response contents', async () => {
    const result = await inspectClerkAccessBuildGate({ environment, inspect: inspectWith(async () => new Response('private-diagnostic ' + environment.CLERK_SECRET_KEY, { status: http })) });
    assert.equal(result.status, expected); assert.equal(result.passed, false); assert.equal(result.instanceIdMatched, false);
    assert.doesNotMatch(JSON.stringify(result), /sk_live_|private-diagnostic/);
  });
}

for (const body of [{ id: 'ins_OtherInstance' }, {}, null]) {
  test('production wrong or absent provider instance ' + JSON.stringify(body) + ' blocks the build', async () => {
    const result = await inspectClerkAccessBuildGate({ environment, inspect: inspectWith(async () => Response.json(body)) });
    assert.equal(result.status, 'PROVIDER_INSTANCE_MISMATCH'); assert.equal(result.passed, false);
  });
}

for (const proof of [{ status: 'INSTANCE_VERIFIED' }, { status: 'INSTANCE_VERIFIED', instanceIdMatched: 'true' },
  { status: 'PROVIDER_UNCONFIRMED', instanceIdMatched: true }, { status: 'private-diagnostic ' + environment.CLERK_SECRET_KEY }, null]) {
  test('production rejects incomplete or contradictory provider proof ' + String(proof?.status).split(' ')[0], async () => {
    const result = await inspectClerkAccessBuildGate({ environment, inspect: async () => proof });
    assert.equal(result.status, 'PROVIDER_UNCONFIRMED'); assert.equal(result.passed, false);
    assert.equal(result.instanceIdMatched, false); assert.doesNotMatch(JSON.stringify(result), /sk_live_|private-diagnostic/);
  });
}

test('provider network, malformed response and unexpected reader failures are sanitized and cannot pass', async () => {
  for (const inspect of [inspectWith(async () => { throw new Error(environment.CLERK_SECRET_KEY); }),
    inspectWith(async () => new Response('malformed-private-response')), async () => { throw new Error('private-diagnostic'); }]) {
    const result = await inspectClerkAccessBuildGate({ environment, inspect });
    assert.equal(result.status, 'PROVIDER_UNCONFIRMED'); assert.equal(result.passed, false);
    assert.doesNotMatch(JSON.stringify(result), /sk_live_|private-diagnostic|malformed-private/);
  }
});

test('CLI has a failing exit status for unconfirmed production and an explicit non-production skip', () => {
  const script = new URL('../scripts/verify-clerk-access-readonly.mjs', import.meta.url);
  for (const [target, expectedExit, expectedStatus] of [['production', 1, 'CONFIGURATION_PENDING'], ['preview', 0, 'SKIPPED_NON_PRODUCTION']]) {
    const child = spawnSync(process.execPath, [fileURLToPath(script)], {
      env: { VERCEL_ENV: target }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(child.error, undefined); assert.equal(child.status, expectedExit); assert.equal(child.stderr, '');
    const output = JSON.parse(child.stdout).clerkAccessBuildCheck;
    assert.equal(output.status, expectedStatus); assert.equal(output.passed, false); assert.equal(output.customerLoginVerified, false);
  }
});

test('build invokes the Clerk gate before existing independent probes', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const checks = pkg.scripts.prebuild.split(' && ');
  assert.equal(checks.shift(), 'node scripts/verify-clerk-access-readonly.mjs');
  assert.deepEqual(checks, ['node scripts/verify-constructor-crm-readonly.mjs', 'node scripts/verify-private-storage-live.mjs', 'node scripts/verify-pilot-media-live.mjs', 'node scripts/verify-plan-import-live.mjs',
    'node scripts/verify-meta-test-number.mjs', 'node scripts/verify-meta-template-catalog.mjs', 'node scripts/verify-company-onboarding-readonly.mjs', 'node scripts/verify-meta-release-closed-build.mjs']);
});
