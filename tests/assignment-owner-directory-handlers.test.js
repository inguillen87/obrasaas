import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { TaskAssignmentError, assignmentFailure } from '../src/lib/task-assignment-policy.js';
import { normalizeOwnerSearch } from '../src/lib/assignment-owner-directory-policy.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const source = fs.readFileSync(new URL('../src/lib/assignment-owner-directory-handlers.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
function fixture(overrides = {}) {
  const calls = [], access = { organization: { id: 'org-a' }, project: { id: 'project-a' } };
  const deps = { AccessError, accessErrorResponse: () => Response.json({}, { status: 403 }), getPlatformAccess: async () => access, requireTenantPermission: () => {}, getPrisma: () => ({}), assertEvidenceRequestContext, evidenceContextErrorResponse, TaskAssignmentError, assignmentFailure, normalizeOwnerSearch, listAssignmentOwners: async () => ({}) };
  const factory = new Function(...Object.keys(deps), source + '\nreturn createOwnerDirectoryHandlers;')(...Object.values(deps));
  let dbReads = 0, command;
  const handler = factory({ resolveAccess: async () => access, authorize: (a, permission, options) => calls.push([permission, options.subscriptionMode]), database: () => { dbReads++; return {}; }, search: async (db, input) => { command = input; return { items: [] }; }, ...overrides });
  return { handler, calls, get dbReads() { return dbReads; }, get command() { return command; } };
}
const query = '?taskId=task-a&expectedTaskRevision=3&ownerKind=WORKER';
const request = (suffix = query, extra = {}) => new Request('https://obra.test/api/execution/assignments/owners' + suffix, { headers: { 'X-ObraSaaS-Organization': 'org-a', 'X-ObraSaaS-Project': 'project-a', ...extra } });
test('owner directory is read-only, scoped and never publicly cached', async () => {
  const f = fixture(), response = await f.handler.GET(request());
  assert.equal(response.status, 200); assert.deepEqual(f.command.scope, { organizationId: 'org-a', projectId: 'project-a' });
  assert.deepEqual(f.calls, [['org:execution:read', 'read'], ['org:tasks:read', 'read']]);
  assert.match(response.headers.get('cache-control'), /private, no-store/); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const route = fs.readFileSync(new URL('../src/app/api/execution/assignments/owners/route.js', import.meta.url), 'utf8');
  assert.match(route, /export const GET/); assert.doesNotMatch(route, /export const (POST|PATCH|PUT|DELETE)/);
});
for (const permission of ['org:execution:read', 'org:tasks:read']) test('denied ' + permission + ' does not query the directory', async () => {
  const f = fixture({ authorize: (a, p) => { if (p === permission) throw new AccessError(); } });
  assert.equal((await f.handler.GET(request())).status, 403); assert.equal(f.dbReads, 0);
});
for (const headers of [{ 'X-ObraSaaS-Organization': 'foreign' }, { 'X-ObraSaaS-Project': 'other' }, { 'X-ObraSaaS-Project': '' }, { Origin: 'https://other.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) test('context cannot be substituted ' + JSON.stringify(headers), async () => {
  const f = fixture(); assert.ok([403, 409].includes((await f.handler.GET(request(query, headers))).status)); assert.equal(f.dbReads, 0);
});
for (const suffix of ['', query + '&taskId=other', query + '&organizationId=other', query + '&limit=5000', query.replace('=3', '=03'), query.replace('=3', '=1e3'), query.replace('=3', '=9007199254740992'), query + '&cursor=%2F%2F', query + '&query=a&query=b']) test('malformed query cannot widen directory ' + suffix, async () => {
  const f = fixture(); assert.equal((await f.handler.GET(request(suffix))).status, 422); assert.equal(f.dbReads, 0);
});
test('unexpected database failure is sanitized', async () => {
  const f = fixture({ search: async () => { throw new Error('private-connection-details'); } });
  const response = await f.handler.GET(request()); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private-connection-details'));
});
