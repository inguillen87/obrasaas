import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PilotWorkspaceError } from '../src/lib/whatsapp/pilot-workspace.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const source = readFileSync(new URL('../src/app/api/integrations/whatsapp/pilot-workspace/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function route(overrides = {}) {
  const calls = { db: 0, provider: 0, provision: 0 };
  const deps = { process: { env: { VERCEL_ENV: 'preview', WHATSAPP_PILOT_IMPORT_ENABLED: 'true' } }, PilotWorkspaceError, AccessError, RequestBodyError, assertEvidenceRequestContext, evidenceContextErrorResponse,
    requireSuperadmin: async () => ({ organization: { id: 'org-a' }, project: { id: 'project-a' }, isSuperadmin: true }),
    accessErrorResponse: () => Response.json({ code: 'DENIED' }, { status: 403 }), requestBodyErrorResponse: () => Response.json({}, { status: 400 }),
    getPrisma: () => { calls.db++; return {}; }, clerkClient: async () => { calls.provider++; return {}; },
    readJsonRequest: async (request, options) => { assert.equal(options.maxBytes, 2048); return request.json(); },
    provisionPilotWorkspace: async options => { calls.provision++; assert.equal(options.access.organization.id, 'org-a'); return { status: 'READY_FOR_CONNECTION' }; }, ...overrides };
  return { calls, handler: new Function(...Object.keys(deps), source + '\nreturn POST;')(...Object.values(deps)) };
}
const request = (headers = {}, suffix = '') => new Request('https://obra.test/api/integrations/whatsapp/pilot-workspace' + suffix, { method: 'POST', headers: { Origin: 'https://obra.test', 'X-ObraSaaS-Organization': 'org-a', 'X-ObraSaaS-Project': 'project-a', 'Content-Type': 'application/json', ...headers }, body: '{}' });
test('authenticated same-origin provisioning returns context with no-store', async () => { const { handler, calls } = route(); const response = await handler(request()); assert.equal(response.status, 200); assert.equal(calls.provision, 1); assert.match(response.headers.get('cache-control'), /private, no-store/); });
for (const headers of [{ Origin: 'https://foreign.test' }, { 'Sec-Fetch-Site': 'cross-site' }, { Origin: '' }]) test('cross-origin or missing origin denied before provider: ' + JSON.stringify(headers), async () => { const { handler, calls } = route(); assert.equal((await handler(request(headers))).status, 403); assert.equal(calls.db, 0); assert.equal(calls.provider, 0); });
for (const headers of [{ 'X-ObraSaaS-Project': 'other' }, { 'X-ObraSaaS-Organization': '' }]) test('stale context denied before provider: ' + JSON.stringify(headers), async () => { const { handler, calls } = route(); assert.equal((await handler(request(headers))).status, 409); assert.equal(calls.provision, 0); });
test('production cannot enable this preview-only action', async () => { const { handler, calls } = route({ process: { env: { VERCEL_ENV: 'production', WHATSAPP_PILOT_IMPORT_ENABLED: 'true' } } }); assert.equal((await handler(request())).status, 404); assert.equal(calls.db, 0); });
test('non-admin access rejection never contacts provider', async () => { const { handler, calls } = route({ requireSuperadmin: async () => { throw new AccessError(); } }); assert.equal((await handler(request())).status, 403); assert.equal(calls.provider, 0); });
test('unexpected provider errors are sanitized', async () => { const { handler } = route({ provisionPilotWorkspace: async () => { throw new Error('private credential'); } }); const response = await handler(request()); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private credential')); });
