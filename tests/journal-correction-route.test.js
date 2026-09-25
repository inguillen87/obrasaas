import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { roleHasPermission } from '../src/lib/tenant-roles.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { JournalCorrectionError, correctionErrorResponse } from '../src/lib/journal-correction-policy.js';
const source = fs.readFileSync(new URL('../src/app/api/progress/[recordId]/correction/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function fixture(role = 'SITE_MANAGER', overrides = {}) {
  const calls = { db: 0, read: 0, write: 0, input: null, limits: null };
  const deps = { AccessError, RequestBodyError, assertEvidenceRequestContext, evidenceContextErrorResponse, JournalCorrectionError, correctionErrorResponse,
    getPlatformAccess: async () => ({ organization: { id: 'org-a' }, project: { id: 'project-a' }, databaseUserId: 'actor-a' }),
    requireTenantPermission: (access, permission) => { if (!roleHasPermission(role, permission)) throw new AccessError(); },
    accessErrorResponse: () => Response.json({ code: 'DENIED' }, { status: 403 }), requestBodyErrorResponse: () => Response.json({}, { status: 400 }), projectWritePolicyErrorResponse: () => null,
    getPrisma: () => { calls.db++; return {}; }, readJsonRequest: async (request, limits) => { calls.limits = limits; return request.json(); },
    prepareJournalCorrection: async (prisma, options) => { calls.read++; calls.input = options; return { source: {}, existing: null }; },
    createJournalCorrection: async (prisma, options) => { calls.write++; calls.input = options; return { dailyLog: {}, replayed: false }; }, ...overrides };
  return { calls, routes: new Function(...Object.keys(deps), source + '\nreturn {GET,POST};')(...Object.values(deps)) };
}
const params = { params: Promise.resolve({ recordId: 'source-a' }) };
const req = (method = 'POST', headers = {}, query = '') => new Request('https://obra.test/api/progress/source-a/correction' + query,
  { method, headers: { 'Content-Type': 'application/json', 'X-ObraSaaS-Organization': 'org-a', 'X-ObraSaaS-Project': 'project-a', 'Idempotency-Key': 'correction-test-0001', ...headers }, ...(method === 'POST' ? { body: JSON.stringify({ title: 'Corrección' }) } : {}) });
for (const method of ['GET', 'POST']) test('source preparation and creation derive identity from the session: ' + method, async () => {
  const { routes, calls } = fixture(); const response = await routes[method](req(method), params);
  assert.equal(response.status, method === 'POST' ? 201 : 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(calls.input.scope, { organizationId: 'org-a', projectId: 'project-a' }); assert.equal(calls.input.actorId, 'actor-a'); assert.equal(calls.input.sourceId, 'source-a');
  if (method === 'POST') { assert.equal(calls.input.operationKey, 'correction-test-0001'); assert.equal(calls.limits.maxBytes, 65536); }
});
for (const method of ['GET', 'POST']) {
  for (const role of ['AUDITOR', 'FINANCE']) test('unauthorized role cannot prepare or create: ' + role + ' ' + method, async () => {
    const { routes, calls } = fixture(role); assert.equal((await routes[method](req(method), params)).status, 403); assert.equal(calls.db, 0);
  });
  for (const headers of [{ 'X-ObraSaaS-Project': 'other' }, { 'X-ObraSaaS-Organization': 'other' }, { 'X-ObraSaaS-Project': '' }]) test('context comparison precedes data access: ' + method + JSON.stringify(headers), async () => {
    const { routes, calls } = fixture(); assert.equal((await routes[method](req(method, headers), params)).status, 409); assert.equal(calls.db, 0);
  });
}
for (const headers of [{ Origin: 'https://foreign.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) test('cross-origin action is rejected: ' + Object.keys(headers)[0], async () => {
  const { routes, calls } = fixture(); assert.equal((await routes.POST(req('POST', headers), params)).status, 403); assert.equal(calls.db, 0);
});
test('query cannot supply context or bypass checks', async () => {
  const { routes, calls } = fixture(); assert.equal((await routes.POST(req('POST', {}, '?tenantId=other'), params)).status, 422); assert.equal(calls.db, 0);
});
test('verified replay returns 200, not a second creation result', async () => {
  const { routes } = fixture('DIRECTOR', { createJournalCorrection: async () => ({ dailyLog: {}, replayed: true }) });
  assert.equal((await routes.POST(req(), params)).status, 200);
});
test('unexpected error does not leak private configuration', async () => {
  const { routes } = fixture('DIRECTOR', { createJournalCorrection: async () => { throw new Error('private-database-secret'); } });
  const response = await routes.POST(req(), params); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private-database-secret'));
});
