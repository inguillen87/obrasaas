import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { roleHasPermission } from '../src/lib/tenant-roles.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { JournalTaskLinkError, journalTaskLinkErrorResponse } from '../src/lib/journal-task-link-policy.js';
const source = fs.readFileSync(new URL('../src/app/api/progress/[recordId]/task/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export const .*;\r?\n/gm, '').replace('export async function PATCH', 'async function PATCH');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function fixture(role = 'DIRECTOR', override = {}) {
  const calls = { writes: [], database: 0, bodyLimit: null };
  const deps = { AccessError, RequestBodyError, JournalTaskLinkError, journalTaskLinkErrorResponse, assertEvidenceRequestContext, evidenceContextErrorResponse,
    accessErrorResponse: () => Response.json({ code: 'DENIED' }, { status: 403 }), requestBodyErrorResponse: () => Response.json({}, { status: 400 }), projectWritePolicyErrorResponse: () => null,
    getPlatformAccess: async () => ({ organization: { id: 'org-a' }, project: { id: 'project-a' }, databaseUserId: 'trusted-actor' }),
    requireTenantPermission: (a, p) => { if (!roleHasPermission(role, p)) throw new AccessError(); },
    readJsonRequest: (request, options) => { calls.bodyLimit = options.maxBytes; return request.json(); }, getPrisma: () => { calls.database++; return {}; },
    linkJournalDraftToTask: async (db, input) => { calls.writes.push(input); return { dailyLog: { id: input.recordId }, assignment: { replayed: false } }; }, ...override };
  return { calls, patch: new Function(...Object.keys(deps), source + '\nreturn PATCH;')(...Object.values(deps)) };
}
const request = (headers = {}, query = '') => new Request('https://obra.test/api/progress/log-a/task' + query, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'request-00000000001', 'x-obrasaas-organization': 'org-a', 'x-obrasaas-project': 'project-a', ...headers }, body: JSON.stringify({ taskId: 'task-a', expectedRevision: 0 }) });
const params = { params: Promise.resolve({ recordId: 'log-a' }) };
for (const role of ['DIRECTOR', 'SITE_MANAGER', 'ADMIN']) test(role + ' may link an editable draft without review permission', async () => { const { patch, calls } = fixture(role); const response = await patch(request(), params); assert.equal(response.status, 200); assert.equal(calls.writes[0].actorId, 'trusted-actor'); assert.deepEqual(calls.writes[0].scope, { organizationId: 'org-a', projectId: 'project-a' }); assert.equal(calls.bodyLimit, 4096); assert.match(response.headers.get('cache-control'), /private, no-store/); });
for (const role of ['FINANCE', 'AUDITOR']) test(role + ' cannot link a draft', async () => { const { patch, calls } = fixture(role); assert.equal((await patch(request(), params)).status, 403); assert.equal(calls.database, 0); });
for (const headers of [{ origin: 'https://other.test' }, { 'sec-fetch-site': 'cross-site' }]) test('cross-origin mutations denied: ' + JSON.stringify(headers), async () => { const { patch, calls } = fixture(); assert.equal((await patch(request(headers), params)).status, 403); assert.equal(calls.database, 0); });
for (const headers of [{ 'x-obrasaas-project': 'project-b' }, { 'x-obrasaas-organization': 'org-b' }, { 'x-obrasaas-project': '' }]) test('changed/missing context denied: ' + JSON.stringify(headers), async () => { const { patch, calls } = fixture(); assert.equal((await patch(request(headers), params)).status, 409); assert.equal(calls.database, 0); });
test('queries do not override the session or resource', async () => { const { patch, calls } = fixture(); assert.equal((await patch(request({}, '?taskId=other'), params)).status, 422); assert.equal(calls.database, 0); });
test('unexpected storage error does not disclose connection details', async () => { const { patch } = fixture('DIRECTOR', { linkJournalDraftToTask: async () => { throw new Error('secret-connection-string'); } }); const response = await patch(request(), params); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('secret-connection-string')); });
