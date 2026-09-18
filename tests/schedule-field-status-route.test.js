import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fieldStatusQuery, ScheduleFieldStatusError } from '../src/lib/schedule-field-status.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const source = readFileSync(new URL('../src/app/api/schedule/field-status/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export const .*;\r?\n/gm, '').replace('export function createFieldStatusHandler', 'function createFieldStatusHandler');
class AccessError extends Error {}
const access = { tenantMembershipId: 'membership-a', organization: { id: 'org-a' }, project: { id: 'project-a' } };
function route(overrides = {}) {
  const calls = { load: 0, database: 0, options: null };
  const dependencies = { AccessError, accessErrorResponse: () => Response.json({ code: 'DENIED' }, { status: 403 }), fieldStatusQuery, ScheduleFieldStatusError, assertEvidenceRequestContext, evidenceContextErrorResponse,
    getPlatformAccess: async () => access, requireTenantPermission: () => {}, hasTenantPermission: () => false, getPrisma: () => ({}), readScheduleFieldStatus: async () => ({}) };
  const factory = new Function(...Object.keys(dependencies), source + '\nreturn createFieldStatusHandler;')(...Object.values(dependencies));
  const handler = factory({ resolveAccess: async () => access, authorize: (a, permission, opts) => { assert.equal(a, access); assert.ok(['org:tasks:read', 'org:execution:read'].includes(permission)); assert.equal(opts.subscriptionMode, 'read'); }, hasPermission: () => false,
    database: () => { calls.database++; return {}; }, load: async (db, options) => { calls.load++; calls.options = options; return { version: 'v1', checkedAt: '2026-09-18T12:00:00Z', tasks: [] }; }, ...overrides });
  return { handler, calls };
}
const request = (suffix = '', headers = {}) => new Request('https://obra.test/api/schedule/field-status' + suffix, { headers: { 'x-obrasaas-organization': 'org-a', 'x-obrasaas-project': 'project-a', ...headers } });
test('authorized read is scoped by session with private no-store response', async () => {
  const { handler, calls } = route(); const response = await handler(request());
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(calls.options.scope, { organizationId: 'org-a', projectId: 'project-a' }); assert.equal(calls.options.canReadMeasurements, false);
});
for (const headers of [{ 'x-obrasaas-organization': 'other' }, { 'x-obrasaas-project': 'other' }, { 'x-obrasaas-project': '' }]) test('context change denied before Prisma: ' + JSON.stringify(headers), async () => {
  const { handler, calls } = route(); assert.equal((await handler(request('', headers))).status, 409); assert.equal(calls.database, 0);
});
test('missing context denied rather than using an implicit project', async () => {
  const { handler, calls } = route(); assert.equal((await handler(new Request('https://obra.test/api/schedule/field-status'))).status, 409); assert.equal(calls.database, 0);
});
test('matching version returns 304 but still authorizes and reads the current database state', async () => {
  const { handler, calls } = route(); const response = await handler(request('', { 'if-none-match': '"field-v1"' }));
  assert.equal(response.status, 304); assert.equal(await response.text(), ''); assert.equal(calls.load, 1);
  assert.equal(response.headers.get('x-obrasaas-checked-at'), '2026-09-18T12:00:00Z');
});
test('a conditional read cannot bypass revoked permissions', async () => {
  const { handler, calls } = route({ authorize: () => { throw new AccessError(); } });
  assert.equal((await handler(request('', { 'if-none-match': '"field-v1"' }))).status, 403); assert.equal(calls.database, 0);
});
test('invalid filters and duplicate query values fail before database access', async () => {
  for (const query of ['?taskId=x&taskId=y', '?organizationId=org-b', '?after=']) {
    const { handler, calls } = route(); assert.equal((await handler(request(query))).status, 400); assert.equal(calls.database, 0);
  }
});
test('measurement permission is passed independently of execution', async () => {
  const { handler, calls } = route({ hasPermission: (a, permission) => permission === 'org:measurements:read' }); await handler(request()); assert.equal(calls.options.canReadMeasurements, true);
});
test('unknown failures do not leak database messages', async () => {
  const { handler } = route({ load: async () => { throw new Error('postgres-private-url'); } });
  const response = await handler(request()); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('postgres-private-url'));
});
test('platform access without active membership does not unlock measurement balances', async () => {
  const { handler, calls } = route({ resolveAccess: async () => ({ ...access, tenantMembershipId: null }), authorize: () => {}, hasPermission: () => true });
  assert.equal((await handler(request())).status, 200); assert.equal(calls.options.canReadMeasurements, false);
});
