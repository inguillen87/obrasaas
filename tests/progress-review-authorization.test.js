import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { roleHasPermission } from '../src/lib/tenant-roles.js';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('src/app/api/progress/[recordId]/route.js')
  .replace(/import[\s\S]*?from ["'][^"']+["'];\r?\n/g, '')
  .replace('export async function PATCH', 'async function PATCH');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function route(role, { evidence = true } = {}) {
  const calls = { writes: [], reads: 0 };
  const deps = {
    AccessError, RequestBodyError,
    accessErrorResponse: () => Response.json({ code: 'ROLE_DENIED' }, { status: 403 }),
    requestBodyErrorResponse: () => Response.json({}, { status: 400 }),
    projectWritePolicyErrorResponse: () => null, progressJournalErrorResponse: () => null,
    getPlatformAccess: async () => ({ organization: { id: 'org' }, project: { id: 'project' }, databaseUserId: 'actor' }),
    requireTenantPermission: (access, permission) => {
      if (!roleHasPermission(role, permission) || (!evidence && permission === 'org:field:evidence:read')) throw new AccessError('denied');
    },
    hasTenantPermission: (access, permission) => roleHasPermission(role, permission),
    SOURCE_EVIDENCE_PERMISSION: 'org:field:evidence:read',
    getPrisma: () => { calls.reads++; return {}; },
    readJsonRequest: request => request.json(),
    reviewProgressRecord: async (prisma, input) => { calls.writes.push(input); return { id: input.id, status: input.status }; },
  };
  return { calls, patch: new Function(...Object.keys(deps), source + '\nreturn PATCH;')(...Object.values(deps)) };
}
const params = { params: Promise.resolve({ recordId: 'report-test' }) };
function request(kind, status, headers = {}) {
  return new Request('https://obra.test/api/progress/report-test', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ kind, status, expectedRevision: 0 }) });
}
for (const role of ['SITE_MANAGER', 'FINANCE', 'AUDITOR']) {
  for (const status of ['APPROVED', 'REJECTED']) test(role + ' cannot decide ' + status, async () => {
    const { patch, calls } = route(role); const response = await patch(request('DAILY_LOG', status), params);
    assert.equal(response.status, 403); assert.equal(calls.reads, 0); assert.equal(calls.writes.length, 0);
  });
}
for (const role of ['ADMIN', 'DIRECTOR']) {
  for (const kind of ['DAILY_LOG', 'EVIDENCE']) test(role + ' may review ' + kind, async () => {
    const { patch, calls } = route(role); const response = await patch(request(kind, 'APPROVED'), params);
    assert.equal(response.status, 200); assert.equal(calls.writes.length, 1);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.deepEqual(calls.writes[0].scope, { organizationId: 'org', projectId: 'project' });
  });
}
test('site manager keeps permission to submit a field draft', async () => {
  const { patch, calls } = route('SITE_MANAGER'); const response = await patch(request('DAILY_LOG', 'SUBMITTED'), params);
  assert.equal(response.status, 200); assert.equal(calls.writes[0].actorId, 'actor');
});
test('lowercase decision cannot bypass reviewer authorization', async () => {
  const { patch, calls } = route('SITE_MANAGER');
  assert.equal((await patch(request('daily_log', 'approved'), params)).status, 403); assert.equal(calls.reads, 0);
});
test('evidence review also requires evidence access', async () => {
  const { patch, calls } = route('DIRECTOR', { evidence: false });
  assert.equal((await patch(request('EVIDENCE', 'APPROVED'), params)).status, 403); assert.equal(calls.reads, 0);
});
for (const headers of [{ origin: 'https://other.test' }, { 'sec-fetch-site': 'cross-site' }]) test('cross-origin review rejected before data access: ' + Object.keys(headers)[0], async () => {
  const { patch, calls } = route('DIRECTOR');
  assert.equal((await patch(request('DAILY_LOG', 'APPROVED', headers), params)).status, 403);
  assert.equal(calls.reads, 0);
});
test('review controls are distinct from capture controls in the UI', () => {
  const client = read('src/app/dashboard/progress/progress-client.js');
  const page = read('src/app/dashboard/progress/page.js');
  assert.match(client, /permissions.canReviewJournal && item.status === "SUBMITTED"/);
  assert.match(client, /permissions.canReviewJournal && permissions.canReadSourceEvidence && item.status === "PENDING"/);
  assert.match(page, /canReviewJournal: canManage && hasTenantPermission\(access, 'org:progress:review'\)/);
  assert.doesNotMatch(client, /\{item.status\}/);
});
