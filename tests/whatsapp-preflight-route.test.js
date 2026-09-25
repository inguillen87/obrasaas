import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { MetaPreflightRateError } from '../src/lib/whatsapp/platform-preflight-audit.js';
const code = fs.readFileSync(new URL('../src/app/api/integrations/whatsapp/preflight/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function fixture(overrides = {}) {
  const calls = { remote: 0, db: 0, reserved: 0, recorded: 0 };
  const access = { isSuperadmin: true, databaseUserId: 'actor-a', organization: { id: 'org-a' }, project: { id: 'project-a' } };
  const dependencies = { AccessError, RequestBodyError, MetaPreflightRateError, assertEvidenceRequestContext, evidenceContextErrorResponse,
    accessErrorResponse: () => Response.json({}, { status: 403 }), requestBodyErrorResponse: () => Response.json({}, { status: 400 }),
    getPlatformAccess: async () => access, requireTenantPermission: (a, permission, options) => { assert.equal(permission, 'org:integrations:manage'); assert.equal(options.subscriptionMode, 'read'); },
    getPrisma: () => { calls.db++; return {}; }, readJsonRequest: async (request, options) => { assert.equal(options.maxBytes, 1024); return request.json(); },
    reserveMetaPreflight: async (db, context) => { calls.reserved++; assert.equal(context.actorId, 'actor-a'); assert.equal(context.projectId, 'project-a'); return { id: 'request-a' }; },
    verifyWhatsAppPlatform: async () => { calls.remote++; return { version: 1, provesOperationalTraffic: false }; },
    recordMetaPreflight: async () => { calls.recorded++; }, ...overrides };
  return { calls, post: new Function(...Object.keys(dependencies), code + '\nreturn POST;')(...Object.values(dependencies)) };
}
const request = (body = {}, headers = {}, query = '') => new Request('https://obra.test/api/integrations/whatsapp/preflight' + query, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ObraSaaS-Organization': 'org-a', 'X-ObraSaaS-Project': 'project-a', ...headers }, body: JSON.stringify(body) });
test('authorized explicit probe reserves and audits only its public result', async () => {
  const { post, calls } = fixture(); const response = await post(request());
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
  const data = await response.json(); assert.equal(data.projectId, 'project-a'); assert.equal(data.organizationId, 'org-a'); assert.equal(data.provesOperationalTraffic, false);
  assert.deepEqual(calls, { remote: 1, db: 1, reserved: 1, recorded: 1 });
});
test('tenant admin without platform authority cannot inspect global app credentials', async () => {
  const { post, calls } = fixture({ getPlatformAccess: async () => ({ isSuperadmin: false }) });
  assert.equal((await post(request())).status, 403); assert.equal(calls.remote, 0); assert.equal(calls.db, 0);
});
for (const headers of [{ 'X-ObraSaaS-Project': '' }, { 'X-ObraSaaS-Project': 'foreign' }, { 'X-ObraSaaS-Organization': 'foreign' }]) test('stale or missing context blocks before a provider call: ' + JSON.stringify(headers), async () => {
  const { post, calls } = fixture(); assert.equal((await post(request({}, headers))).status, 409); assert.equal(calls.db, 0); assert.equal(calls.remote, 0);
});
for (const headers of [{ origin: 'https://foreign.test' }, { 'sec-fetch-site': 'cross-site' }]) test('cross-site request cannot probe Meta: ' + Object.keys(headers)[0], async () => {
  const { post, calls } = fixture(); assert.equal((await post(request({}, headers))).status, 403); assert.equal(calls.remote, 0);
});
for (const body of [{ accessToken: 'secret' }, { appId: 'another' }, { url: 'https://other.test' }, [], null]) test('probe never accepts caller credentials, accounts or URLs: ' + JSON.stringify(body), async () => {
  const { post, calls } = fixture(); assert.equal((await post(request(body))).status, 400); assert.equal(calls.db, 0);
});
test('query cannot redirect configuration inspection', async () => {
  const { post, calls } = fixture(); assert.equal((await post(request({}, {}, '?appId=other'))).status, 400); assert.equal(calls.remote, 0);
});
test('rate-limited requests have no outbound call', async () => {
  const { post, calls } = fixture({ reserveMetaPreflight: async () => { throw new MetaPreflightRateError(); } });
  const response = await post(request()); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60'); assert.equal(calls.remote, 0);
});
test('unrecorded result is not reported as a completed check', async () => {
  const { post } = fixture({ recordMetaPreflight: async () => { throw new Error('private-db-url'); } });
  const response = await post(request()); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private-db-url'));
});
