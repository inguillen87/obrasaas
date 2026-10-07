import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { OBRASAAS_META_CHANNEL } from '../src/lib/meta-channel-binding.mjs';
import { metaCustomerReadiness } from '../src/lib/meta-customer-provider.mjs';
import { observeMetaRelease } from '../src/lib/meta-release-observation.mjs';
import { observeGeneralMetaClosedBuild } from '../scripts/verify-meta-release-closed-build.mjs';

const now = Date.parse('2026-10-07T02:00:00.000Z');
const closed = { customerSignup: 'CLOSED', businessAppCoexistence: 'CLOSED', developmentPilotAuthorization: 'CLOSED' };
const context = () => ({ OBRASAAS_META_RELEASE_OBSERVATION: 'GENERAL_META_CLOSED', VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_68NErbCqCFsDVaMak81gcwsGI9pF', NEXT_PUBLIC_APP_URL: 'https://obrasaas.com' });
const pilot = () => ({ version: 1, organizationId: 'org-fixture', actorId: 'actor-fixture',
  clerkUserId: 'user_fixtureActor', clerkOrganizationId: 'org_fixtureCompany', projectId: 'project-fixture',
  appId: OBRASAAS_META_CHANNEL.appId, configId: '123456789012346', businessId: '123456789012347',
  expectedPhoneE164: '+15550001001', allowArgentinaMobileAlias: false,
  issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 1000).toISOString() });
const pilotEnvironment = policy => ({ NEXT_PUBLIC_META_APP_ID: OBRASAAS_META_CHANNEL.appId,
  META_CONFIG_ID: '123456789012346', OBRASAAS_META_DEVELOPMENT_PILOT_POLICY: JSON.stringify(policy) });

test('absent releases are observed closed without provider I/O or authority claims', () => {
  const environment = Object.freeze({ META_APP_SECRET: 'private-secret-sentinel', DATABASE_URL: 'private-db-sentinel' });
  assert.deepEqual(observeMetaRelease(environment, now), closed);
  assert.equal(Object.isFrozen(observeMetaRelease(environment, now)), true);
  assert.deepEqual(Object.keys(observeMetaRelease(environment, now)), Object.keys(closed));
});

for (const value of [undefined, '', 'false', 'true', 'customer-self-service-v1 ', true, 1, null]) {
  test(`ordinary signup canonical release rejects nonmatching value ${String(value)}`, () => {
    const environment = { OBRASAAS_META_SIGNUP_RELEASE: value };
    assert.equal(observeMetaRelease(environment, now).customerSignup, 'CLOSED');
    assert.equal(metaCustomerReadiness(environment).gates.review, false);
  });
}

test('an enabled signup is visible and denies GENERAL even with every credential missing', () => {
  const environment = { ...context(), OBRASAAS_META_SIGNUP_RELEASE: 'customer-self-service-v1' };
  assert.equal(metaCustomerReadiness(environment).canLaunchMeta, false);
  assert.equal(observeMetaRelease(environment, now).customerSignup, 'RELEASE_ENABLED');
  assert.throws(() => observeGeneralMetaClosedBuild(environment, now), { message: 'META_RELEASE_CLOSED_BUILD_NOT_CLOSED' });
});

for (const value of [undefined, '', 'false', 'true', 'business-app-coexistence-v1 ', true, 1, null]) {
  test(`coexistence canonical release rejects nonmatching value ${String(value)}`, () => {
    assert.equal(observeMetaRelease({ OBRASAAS_META_COEXISTENCE_RELEASE: value }, now).businessAppCoexistence, 'CLOSED');
  });
}

test('an enabled coexistence release cannot be disguised by missing signup/configuration', () => {
  const environment = { ...context(), OBRASAAS_META_COEXISTENCE_RELEASE: 'business-app-coexistence-v1' };
  assert.equal(metaCustomerReadiness(environment).flows.BUSINESS_APP.available, false);
  assert.equal(observeMetaRelease(environment, now).businessAppCoexistence, 'RELEASE_ENABLED');
  assert.throws(() => observeGeneralMetaClosedBuild(environment, now), { message: 'META_RELEASE_CLOSED_BUILD_NOT_CLOSED' });
});

test('a current canonical pilot policy is reported without asserting owner verification', () => {
  const environment = pilotEnvironment(pilot()), observation = observeMetaRelease(environment, now);
  assert.deepEqual(observation, { ...closed, developmentPilotAuthorization: 'CURRENT_POLICY' });
  assert.throws(() => observeGeneralMetaClosedBuild({ ...context(), ...environment }, now), { message: 'META_RELEASE_CLOSED_BUILD_NOT_CLOSED' });
  const publicJson = JSON.stringify(observation);
  for (const privateValue of Object.values(pilot()).filter(value => typeof value === 'string')) assert.ok(!publicJson.includes(privateValue));
});

test('pilot TTL boundary closes at the stored expiry without extending it', () => {
  const policy = pilot(), environment = pilotEnvironment(policy);
  assert.equal(observeMetaRelease(environment, now + 999).developmentPilotAuthorization, 'CURRENT_POLICY');
  assert.deepEqual(observeMetaRelease(environment, now + 1000), closed);
  assert.deepEqual(observeMetaRelease(environment, now + 1001), closed);
  assert.equal(JSON.parse(environment.OBRASAAS_META_DEVELOPMENT_PILOT_POLICY).expiresAt, policy.expiresAt);
});

for (const change of [policy => { policy.version = 2; }, policy => { policy.expiresAt = 'private-malformed-date'; },
  policy => { policy.issuedAt = new Date(now + 500).toISOString(); }, policy => { policy.extra = 'private-extra'; },
  policy => { policy.expiresAt = new Date(now + 14400000).toISOString(); }]) {
  test('malformed or uncurrent pilot descriptors never grant current policy', () => {
    const policy = pilot(); change(policy);
    assert.deepEqual(observeMetaRelease(pilotEnvironment(policy), now), closed);
  });
}

test('invalid raw policy and unrelated credentials remain private in build and runtime observations', () => {
  const environment = { ...context(), OBRASAAS_META_DEVELOPMENT_PILOT_POLICY: 'private-policy-sentinel',
    META_APP_SECRET: 'private-secret-sentinel', WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'private-key-sentinel',
    CLERK_SECRET_KEY: 'private-clerk-sentinel', DATABASE_URL: 'private-db-sentinel', SOME_TOKEN: 'private-token-sentinel' };
  assert.deepEqual(observeMetaRelease(environment, now), closed);
  const proof = observeGeneralMetaClosedBuild(environment, now), json = JSON.stringify(proof);
  assert.equal(proof.status, 'PASS');
  for (const value of Object.values(environment)) if (value.startsWith('private-')) assert.ok(!json.includes(value));
  assert.equal(proof.environmentValuesReturned, false);
  assert.equal(proof.configurationValuesEqualClaimed, false);
  assert.equal(proof.ownerVerified, false);
  assert.equal(proof.existingConnectionsChecked, false);
});

test('conflicting canonical asset configuration does not authorize a pilot', () => {
  assert.deepEqual(observeMetaRelease({ ...pilotEnvironment(pilot()), NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '123456789012399' }, now), closed);
});

test('no observation marker makes no proof and does not block a legitimate future enabled release', () => {
  for (const marker of [undefined, '']) assert.equal(observeGeneralMetaClosedBuild({ OBRASAAS_META_RELEASE_OBSERVATION: marker,
    OBRASAAS_META_SIGNUP_RELEASE: 'customer-self-service-v1', OBRASAAS_META_COEXISTENCE_RELEASE: 'business-app-coexistence-v1' }, now), null);
});

for (const change of [environment => { environment.OBRASAAS_META_RELEASE_OBSERVATION = 'private-invalid-marker'; },
  environment => { environment.VERCEL_ENV = 'preview'; }, environment => { environment.VERCEL_PROJECT_ID = 'wrong-project'; },
  environment => { environment.NEXT_PUBLIC_APP_URL = 'https://wrong.example.invalid'; }]) {
  test('marked observation rejects a wrong release context', () => {
    const environment = context(); change(environment);
    assert.throws(() => observeGeneralMetaClosedBuild(environment, now), { message: 'META_RELEASE_CLOSED_BUILD_CONTEXT_INVALID' });
  });
}

for (const clock of [NaN, Infinity, 'private-clock-sentinel', 8640000000000001]) {
  test(`explicit invalid clock cannot manufacture a closed observation ${String(clock)}`, () => {
    assert.throws(() => observeMetaRelease({}, clock), { message: 'META_RELEASE_OBSERVATION_INVALID' });
  });
}

test('the actual CLI producer is silent without a marker and sanitizes marked failure', () => {
  const script = fileURLToPath(new URL('../scripts/verify-meta-release-closed-build.mjs', import.meta.url));
  const skipped = spawnSync(process.execPath, [script], { env: { OBRASAAS_META_SIGNUP_RELEASE: 'customer-self-service-v1' }, encoding: 'utf8' });
  assert.equal(skipped.status, 0); assert.equal(skipped.stdout, ''); assert.equal(skipped.stderr, '');
  const denied = spawnSync(process.execPath, [script], { env: { ...context(), OBRASAAS_META_SIGNUP_RELEASE: 'customer-self-service-v1',
    META_APP_SECRET: 'private-process-secret-sentinel' }, encoding: 'utf8' });
  assert.equal(denied.status, 1); assert.equal(denied.stdout, '');
  assert.equal(JSON.parse(denied.stderr).metaReleaseClosedBuildCheck.status, 'UNCONFIRMED');
  assert.ok(!denied.stderr.includes('private-process-secret-sentinel'));
  const success = spawnSync(process.execPath, [script], { env: context(), encoding: 'utf8' });
  assert.equal(success.status, 0); assert.equal(success.stderr, '');
  const proof = JSON.parse(success.stdout).metaReleaseClosedBuildCheck;
  assert.equal(proof.status, 'PASS'); assert.ok(Number.isFinite(Date.parse(proof.observedAt)));
  for (const [key, value] of Object.entries(closed)) assert.equal(proof[key], value);
});

const health = environment => {
  const route = pathToFileURL(fileURLToPath(new URL('../src/app/api/health/route.js', import.meta.url))).href;
  return spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {GET} from ${JSON.stringify(route)};const response=GET();console.log(JSON.stringify({status:response.status,cache:response.headers.get('cache-control'),body:await response.json()}));`],
  { env: environment, encoding: 'utf8' });
};

test('the existing health GET reports closed states, no-store and no private environment values', () => {
  const result = health({ META_APP_SECRET: 'private-health-secret-sentinel', DATABASE_URL: 'private-health-db-sentinel',
    OBRASAAS_META_DEVELOPMENT_PILOT_POLICY: 'private-health-policy-sentinel' });
  assert.equal(result.status, 0);
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, 200);
  assert.equal(response.cache, 'private, no-store, max-age=0');
  assert.deepEqual(response.body.metaRelease, closed);
  assert.equal(response.body.databaseChecked, false);
  assert.equal(response.body.identityProviderVerifiedByThisCheck, false);
  for (const value of ['private-health-secret-sentinel', 'private-health-db-sentinel', 'private-health-policy-sentinel']) {
    assert.ok(!result.stdout.includes(value)); assert.ok(!result.stderr.includes(value));
  }
});

test('health observes enabled flags without a build marker or claiming a customer is operational', () => {
  const result = health({ OBRASAAS_META_SIGNUP_RELEASE: 'customer-self-service-v1', OBRASAAS_META_COEXISTENCE_RELEASE: 'business-app-coexistence-v1' });
  assert.equal(result.status, 0);
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.metaRelease, { customerSignup: 'RELEASE_ENABLED', businessAppCoexistence: 'RELEASE_ENABLED', developmentPilotAuthorization: 'CLOSED' });
  assert.equal(response.body.operationalAccess, 'restricted');
  assert.deepEqual(Object.keys(response.body.metaRelease), Object.keys(closed));
});
