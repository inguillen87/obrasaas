import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { assertTemplateReviewDefinition, normalizeTemplateReview, TemplateReviewError } from '../src/lib/whatsapp/template-review-policy.js';
import { buildOwnedWhatsAppFlowTemplate } from '../src/lib/whatsapp/templates.js';
import { MetaIntegrationError } from '../src/lib/whatsapp/embedded-signup.js';
import { publicMetaIntegrationFailure } from '../src/lib/whatsapp/public-error.js';
import { templateWorkbenchFixture, templateScope } from './helpers/template-workbench-fixture.js';
const source = fs.readFileSync(new URL('../src/app/api/integrations/whatsapp/templates/route.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
class RequestBodyError extends Error {}
class WhatsAppGraphAccessError extends Error {}
class WhatsAppFlowProvisioningLeaseError extends Error {}
function fixture(overrides = {}) {
  const f = templateWorkbenchFixture(), calls = [], logs = [], access = { organization: { id: templateScope.organizationId }, project: { id: templateScope.projectId }, databaseUserId: 'manager-a' };
  const prisma = { ...f.prisma, auditLog: { create: async ({ data }) => { calls.push('audit'); return data; } } };
  const dependencies = { assertEvidenceRequestContext, evidenceContextErrorResponse, normalizeTemplateReview, assertTemplateReviewDefinition, TemplateReviewError,
    AccessError, accessErrorResponse: () => Response.json({ code: 'PERMISSION_REQUIRED' }, { status: 403 }), getPlatformAccess: async () => access,
    requireTenantPermission: (a, p) => { assert.equal(a, access); assert.equal(p, 'org:integrations:manage'); calls.push('authorize'); },
    decryptCredential: value => { assert.equal(value, f.connection.encryptedAccessToken); calls.push('decrypt'); return 'synthetic'; },
    getPrisma: () => { calls.push('database'); return prisma; },
    RequestBodyError, readJsonRequest: async (request, options) => { assert.equal(options.maxBytes, 4096); return request.json(); }, requestBodyErrorResponse: () => Response.json({}, { status: 400 }),
    MetaIntegrationError, WhatsAppGraphAccessError, WhatsAppFlowProvisioningLeaseError, publicMetaIntegrationFailure,
    requireGraphReadyWhatsAppConnection: async (db, projectId) => { assert.equal(db, prisma); assert.equal(projectId, templateScope.projectId); calls.push('gate'); return f.connection; },
    acquireWhatsAppConnectionLease: async (db, options) => { assert.equal(options.requireActive, true); assert.equal(options.expectedConnectionIdentity.whatsappBusinessId, f.connection.whatsappBusinessId); calls.push('lease'); return { lease: { id: 'test-lease' }, metadata: f.connection.metadata }; },
    releaseWhatsAppConnectionLease: async () => { calls.push('release'); },
    buildOwnedWhatsAppFlowTemplate,
    provisionOwnedWhatsAppFlowTemplate: async () => { calls.push('provision'); return f.provision(); },
    synchronizeOwnedWhatsAppFlowTemplates: async () => { calls.push('sync'); return f.sync(); },
    console: { error: (...args) => logs.push(args) }, ...overrides };
  const handlers = new Function(...Object.keys(dependencies), source + '\nreturn { GET, POST };')(...Object.values(dependencies));
  const d = f.definition();
  return { ...f, calls, logs, handlers, review: { blueprintKey: d.blueprintKey, expectedName: d.name, contentSha256: d.contentSha256, confirmed: true } };
}
function request(method, body = null, headers = {}, query = '') { return new Request('https://obra.test/api/integrations/whatsapp/templates' + query, { method, headers: { 'X-ObraSaaS-Organization': templateScope.organizationId, 'X-ObraSaaS-Project': templateScope.projectId, 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }); }
test('GET returns verified context and preview without a provider creation', async () => {
  const f = fixture(), response = await f.handlers.GET(request('GET'));
  assert.equal(response.status, 200); const payload = await response.json(); assert.deepEqual(payload.context, templateScope); assert.equal(payload.templates[0].preview.buttonText, 'Reportar');
  assert.deepEqual(f.calls, ['authorize', 'database', 'gate', 'decrypt', 'sync']);
  assert.match(response.headers.get('vary'), /X-ObraSaaS-Project/); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
test('POST uses reviewed content, Graph gate, exact connection lease and existing audit', async () => {
  const f = fixture(), response = await f.handlers.POST(request('POST', f.review));
  assert.equal(response.status, 200); const payload = await response.json(); assert.deepEqual(payload.context, templateScope); assert.equal(payload.result.template.status, 'PENDING');
  assert.deepEqual(f.calls, ['authorize', 'database', 'gate', 'lease', 'decrypt', 'provision', 'audit', 'release']);
});
for (const method of ['GET', 'POST']) for (const headers of [{ 'X-ObraSaaS-Organization': 'other' }, { 'X-ObraSaaS-Project': 'other' }, { 'X-ObraSaaS-Project': '' }, { Origin: 'https://other.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) test(method + ' rejects stale or cross-site context before database ' + JSON.stringify(headers), async () => {
  const f = fixture(), response = await f.handlers[method](request(method, f.review, headers));
  assert.ok([403, 409].includes(response.status)); assert.deepEqual(f.calls, ['authorize']); assert.match(response.headers.get('cache-control'), /private, no-store/);
});
for (const patch of [{ confirmed: false }, { expectedName: 'other' }, { contentSha256: 'a'.repeat(64) }, { blueprintKey: 'missing' }, { recipient: '+54000000000' }]) test('a changed review cannot touch Meta ' + JSON.stringify(patch), async () => {
  const f = fixture(), response = await f.handlers.POST(request('POST', { ...f.review, ...patch }));
  assert.ok([409, 422].includes(response.status)); assert.ok(!f.calls.includes('provision')); assert.ok(!f.calls.includes('decrypt')); assert.ok(!f.calls.includes('audit'));
});
test('a mutated form reference after lease acquisition is rejected and releases the lease', async () => {
  const f = fixture({ acquireWhatsAppConnectionLease: async () => ({ lease: { id: 'test' }, metadata: { whatsappFlows: { 'incident-report': { id: '999999999999999', status: 'PUBLISHED', dataExchange: false } } } }) });
  const response = await f.handlers.POST(request('POST', f.review)); assert.equal(response.status, 409); assert.ok(!f.calls.includes('provision')); assert.ok(f.calls.includes('release'));
});
test('missing permission prevents catalog or creation and applies no-store errors', async () => {
  const f = fixture({ requireTenantPermission: () => { throw new AccessError(); } });
  for (const method of ['GET', 'POST']) { const response = await f.handlers[method](request(method, f.review)); assert.equal(response.status, 403); assert.match(response.headers.get('cache-control'), /no-store/); }
  assert.equal(f.calls.length, 0);
});
test('Graph health rejection occurs before decryption and creation', async () => {
  const f = fixture({ requireGraphReadyWhatsAppConnection: async () => { const error = new WhatsAppGraphAccessError('Reconnect'); error.status = 409; error.code = 'WHATSAPP_GRAPH_RECONNECT_REQUIRED'; throw error; } });
  const response = await f.handlers.POST(request('POST', f.review)); assert.equal(response.status, 409); assert.ok(!f.calls.includes('decrypt')); assert.ok(!f.calls.includes('lease'));
});
test('query scope and legacy unreviewed POST are not silently accepted', async () => {
  const f = fixture(); assert.equal((await f.handlers.GET(request('GET', null, {}, '?projectId=other'))).status, 422);
  assert.equal((await f.handlers.POST(request('POST', { blueprintKey: 'incident-report' }))).status, 422); assert.ok(!f.calls.includes('database'));
});
test('an unknown provider or audit failure is not exposed and always releases the lease', async () => {
  const f = fixture({ provisionOwnedWhatsAppFlowTemplate: async () => { throw new Error('RAW_PROVIDER_SECRET'); } });
  const response = await f.handlers.POST(request('POST', f.review)); assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('RAW_PROVIDER_SECRET')); assert.ok(!JSON.stringify(f.logs).includes('RAW_PROVIDER_SECRET')); assert.ok(f.calls.includes('release'));
});
