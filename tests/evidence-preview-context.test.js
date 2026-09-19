import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const source = readFileSync(new URL('../src/app/api/progress/[recordId]/attachment/route.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace(/^export const .*;\r?\n/gm, '').replace('export async function GET', 'async function GET');
class AccessError extends Error {}
function harness(allowed = true) {
  const effects = { queries: [], reads: 0, permissions: [] };
  const dependencies = { AccessError, assertEvidenceRequestContext, evidenceContextErrorResponse,
    accessErrorResponse: () => Response.json({}, { status: 403 }),
    getPlatformAccess: async () => ({ organization: { id: 'org-a' }, project: { id: 'project-a' } }),
    requireTenantPermission: (access, permission) => { effects.permissions.push(permission); if (!allowed) throw new AccessError(); },
    SOURCE_EVIDENCE_PERMISSION: 'org:field:evidence:read',
    getPrisma: () => ({ progressEvidence: { findFirst: async query => { effects.queries.push(query); return { id: 'evidence-a', projectId: 'project-a', media: {} }; } } }),
    isDashboardProgressMediaForProject: () => true,
    readProtectedFile: async () => { effects.reads++; return { stream: new ReadableStream() }; },
    progressEvidenceFileResponse: () => new Response('synthetic', { headers: { 'Cache-Control': 'private, no-store' } }),
  };
  return { effects, GET: new Function(...Object.keys(dependencies), source + '\nreturn GET;')(...Object.values(dependencies)) };
}
const ctx = { params: Promise.resolve({ recordId: 'evidence-a' }) };
for (const headers of [{ 'x-obrasaas-organization': 'org-a', 'x-obrasaas-project': 'other' }, { 'x-obrasaas-organization': 'other', 'x-obrasaas-project': 'project-a' }, { 'x-obrasaas-project': 'project-a' }]) {
  test('changed or partial context cannot read private media: ' + JSON.stringify(headers), async () => {
    const { GET, effects } = harness(); const response = await GET(new Request('https://obra.test/api/progress/evidence-a/attachment', { headers }), ctx);
    assert.equal(response.status, 409); assert.equal(effects.reads, 0); assert.equal(effects.queries.length, 0);
  });
}
test('matching context still requires the evidence permission', async () => {
  const { GET, effects } = harness(false);
  const response = await GET(new Request('https://obra.test/api/progress/evidence-a/attachment', { headers: { 'x-obrasaas-organization': 'org-a', 'x-obrasaas-project': 'project-a' } }), ctx);
  assert.equal(response.status, 403); assert.equal(effects.reads, 0);
});
test('legacy request remains session scoped and private', async () => {
  const { GET, effects } = harness(); const response = await GET(new Request('https://obra.test/api/progress/evidence-a/attachment'), ctx);
  assert.equal(response.status, 200); assert.equal(effects.reads, 1);
  assert.equal(effects.queries[0].where.projectId, 'project-a'); assert.equal(effects.queries[0].where.sourceMessageId, null);
  assert.ok(effects.permissions.includes('org:field:evidence:read')); assert.match(response.headers.get('cache-control'), /private, no-store/);
});
