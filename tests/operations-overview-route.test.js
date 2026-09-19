import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { operationsPermissions, OperationsOverviewError } from '../src/lib/operations-overview.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { roleHasPermission } from '../src/lib/tenant-roles.js';
const source = readFileSync(new URL('../src/app/api/operations/overview/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
function fixture(role = 'DIRECTOR', overrides = {}) {
  const calls = { db: 0, loads: 0, checks: [], input: null };
  const deps = { AccessError, OperationsOverviewError, operationsPermissions, assertEvidenceRequestContext, evidenceContextErrorResponse,
    accessErrorResponse: () => Response.json({ code: 'DENIED' }, { status: 403 }),
    getPlatformAccess: async () => ({ organization: { id: 'org-a' }, project: { id: 'project-a' } }),
    hasTenantPermission: (access, permission) => roleHasPermission(role, permission),
    requireTenantPermission: (access, permission, options) => { calls.checks.push(permission); assert.equal(options.subscriptionMode, 'read'); if (!roleHasPermission(role, permission)) throw new AccessError(); },
    getPrisma: () => { calls.db++; return {}; }, readOperationsOverview: async (prisma, input) => { calls.loads++; calls.input = input; return { queues: [] }; }, ...overrides };
  return { calls, get: new Function(...Object.keys(deps), source + '\nreturn GET;')(...Object.values(deps)) };
}
const request = (headers = {}, query = '') => new Request('https://obra.test/api/operations/overview' + query, { headers: { 'x-obrasaas-project': 'project-a', 'x-obrasaas-organization': 'org-a', ...headers } });
test('overview uses authoritative scope and independently derived roles', async () => {
  const { get, calls } = fixture(); const response = await get(request());
  assert.equal(response.status, 200); assert.deepEqual(calls.input.scope, { organizationId: 'org-a', projectId: 'project-a' });
  assert.equal(calls.input.permissions.review, true); assert.match(response.headers.get('cache-control'), /private, no-store/); assert.match(response.headers.get('vary'), /Authorization/);
});
for (const role of ['SITE_MANAGER','FINANCE','AUDITOR']) test('review authority is not manufactured in overview for ' + role, async () => {
  const { get, calls } = fixture(role); assert.equal((await get(request())).status, 200); assert.equal(calls.input.permissions.review, false);
});
for (const headers of [{ 'x-obrasaas-project': 'foreign' }, { 'x-obrasaas-organization': 'foreign' }, { 'x-obrasaas-project': '' }]) test('scope mismatch or absence rejected before data access: ' + JSON.stringify(headers), async () => {
  const { get, calls } = fixture(); assert.equal((await get(request(headers))).status, 409); assert.equal(calls.db, 0);
});
test('unprivileged session gets no capabilities rather than a privileged fallback', async () => {
  const { get, calls } = fixture('UNKNOWN_ROLE'); assert.equal((await get(request())).status, 200); assert.ok(Object.values(calls.input.permissions).every(value => value === false));
});
test('subscription or authorization failure prevents even a summary read', async () => {
  const { get, calls } = fixture('DIRECTOR', { requireTenantPermission: () => { throw new AccessError(); } });
  assert.equal((await get(request())).status, 403); assert.equal(calls.db, 0);
});
test('caller cannot supply arbitrary company, user, filters or pagination', async () => {
  for (const query of ['?projectId=foreign', '?user=other', '?limit=5000']) { const { get, calls } = fixture(); assert.equal((await get(request({}, query))).status, 400); assert.equal(calls.db, 0); }
});
test('unknown backend errors remain sanitized and non-cacheable', async () => {
  const { get } = fixture('DIRECTOR', { readOperationsOverview: async () => { throw new Error('database-private-host'); } });
  const response = await get(request()); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('database-private-host')); assert.match(response.headers.get('cache-control'), /no-store/);
});
test('route exposes no mutation methods or writes', () => {
  assert.ok(!/export async function (POST|PUT|PATCH|DELETE)/.test(readFileSync(new URL('../src/app/api/operations/overview/route.js', import.meta.url), 'utf8')));
});
