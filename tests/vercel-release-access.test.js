import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectVercelReleaseAccess, RELEASE_KEY_NAMES, RELEASE_TARGET } from '../scripts/vercel-release-access.mjs';
const TOKEN = 'inert-test-token-never-authenticates';
const project = () => ({ id: RELEASE_TARGET.projectId, accountId: RELEASE_TARGET.teamId,
  link: { type: 'github', repoId: RELEASE_TARGET.repoId }, env: { secret: 'never-print-project-payload' } });
const metadata = () => ({ envs: [...RELEASE_KEY_NAMES, 'DIRECT_URL'].map(key => ({ key, target: ['production'], value: 'never-print-environment-value' })) });
function mocked(responses) {
  const calls = []; return { calls, fetcher: async (url, options) => {
    calls.push({ url: String(url), options });
    const response = responses.shift(); return response instanceof Response ? response : Response.json(response);
  } };
}
test('missing CI credential does not initiate a network call', async () => {
  const result = await inspectVercelReleaseAccess({ fetcher: () => assert.fail('unexpected network') });
  assert.equal(result.reason, 'CI_TOKEN_NOT_AVAILABLE'); assert.equal(result.requests, 0); assert.equal(result.status, 'BLOCKED');
});
for (const token of [' ', 'token\n', 'token embedded', 'x\0y']) test('invalid credential format stays offline', async () => {
  const result = await inspectVercelReleaseAccess({ token, fetcher: () => assert.fail('unexpected network') }); assert.equal(result.requests, 0);
});
for (const status of [401, 403]) test('authorization refusal is not retried or exposed: ' + status, async () => {
  const mock = mocked([new Response('private provider diagnostic', { status })]);
  const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mock.fetcher });
  assert.equal(result.reason, 'VERCEL_SCOPE_NOT_AUTHORIZED'); assert.equal(mock.calls.length, 1); assert.equal(result.httpStatus, status);
  assert.ok(!JSON.stringify(result).includes('private provider diagnostic'));
});
for (const change of [{ id: 'other' }, { accountId: 'other' }, { link: { type: 'github', repoId: 1 } }, { link: null }]) test('another project, team or repo cannot pass', async () => {
  const mock = mocked([{ ...project(), ...change }]); const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mock.fetcher });
  assert.equal(result.reason, 'PROJECT_BINDING_MISMATCH'); assert.equal(mock.calls.length, 1); assert.equal(result.accessVerified, false);
});
test('fixed target uses GET only, no redirects and encrypted metadata', async () => {
  const mock = mocked([project(), metadata()]); const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mock.fetcher });
  assert.equal(mock.calls.length, 2); assert.equal(result.status, 'ACCESS_AND_NAMES_CHECKED');
  for (const call of mock.calls) {
    const url = new URL(call.url); assert.equal(url.origin, 'https://api.vercel.com');
    assert.equal(url.searchParams.get('teamId'), RELEASE_TARGET.teamId);
    assert.equal(call.options.method, 'GET'); assert.equal(call.options.redirect, 'error');
    assert.equal(call.options.headers.Authorization, 'Bearer ' + TOKEN);
  }
  assert.equal(new URL(mock.calls[1].url).searchParams.get('decrypt'), 'false');
  for (const key of ['valuesVerified', 'writePermissionVerified', 'runtimeVerified', 'migrationAuthorized', 'deploymentCreated', 'productionPromoted']) assert.equal(result[key], false);
});
test('metadata presence never discloses any value or proves credentials valid', async () => {
  const data = metadata(); data.envs.push({ key: 'UNREQUESTED_SECRET', target: ['production'], value: TOKEN });
  const mock = mocked([project(), data]); const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mock.fetcher });
  const text = JSON.stringify(result);
  for (const forbidden of [TOKEN, 'never-print-environment-value', 'never-print-project-payload', 'UNREQUESTED_SECRET']) assert.ok(!text.includes(forbidden));
  assert.equal(result.valuesVerified, false);
});
test('Preview metadata cannot satisfy a Production prerequisite', async () => {
  const data = metadata(); data.envs.find(row => row.key === 'META_APP_SECRET').target = ['preview'];
  const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mocked([project(), data]).fetcher });
  assert.equal(result.reason, 'PRODUCTION_NAMES_NOT_RETURNED'); assert.equal(result.productionKeyNames.find(row => row.key === 'META_APP_SECRET').present, false);
});
test('absence of all database URLs remains blocked', async () => {
  const data = metadata(); data.envs = data.envs.filter(row => row.key !== 'DIRECT_URL');
  const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mocked([project(), data]).fetcher });
  assert.equal(result.databaseKeyPresent, false); assert.equal(result.status, 'BLOCKED');
});
for (const data of [{}, { envs: [null] }, { envs: [{ key: 'META_APP_SECRET' }] }, { ...metadata(), pagination: { next: 42 } }]) test('malformed or truncated metadata is not a clean configuration', async () => {
  const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mocked([project(), data]).fetcher });
  assert.equal(result.reason, 'ENV_METADATA_UNCONFIRMED'); assert.equal(result.productionKeyNames, null);
});
test('network errors do not disclose the thrown diagnostic', async () => {
  const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: () => { throw new Error(TOKEN); } });
  assert.equal(result.reason, 'NETWORK_OR_RESPONSE_UNCONFIRMED'); assert.ok(!JSON.stringify(result).includes(TOKEN));
});
test('oversized responses stop before metadata processing', async () => {
  const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mocked([new Response('x'.repeat(2*1024*1024+1))]).fetcher });
  assert.equal(result.reason, 'RESPONSE_TOO_LARGE'); assert.equal(result.requests, 1);
});
test('invalid JSON and non-OK responses remain unconfirmed', async () => {
  for (const response of [new Response('not-json'), new Response('{}', { status: 500 }), new Response('[]')]) {
    const result = await inspectVercelReleaseAccess({ token: TOKEN, fetcher: mocked([response]).fetcher }); assert.equal(result.status, 'BLOCKED');
  }
});
