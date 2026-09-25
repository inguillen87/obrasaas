import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { normalizeMessageReport, messageReportSourceId, messageReportFingerprint, messageReportPreparationMatches, confirmedMessageReport, WhatsAppProgressReportError, messageReportErrorResponse } from '../src/lib/whatsapp/progress-report-policy.js';
const code = fs.readFileSync(new URL('../src/app/api/whatsapp/inbox/[conversationId]/messages/[messageId]/progress-report/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export const .*;\r?\n/gm, '').replace('export function createMessageReportHandlers', 'function createMessageReportHandlers');
class AccessError extends Error {}
class RequestBodyError extends Error {}
const access = { organization: { id: 'org-a' }, project: { id: 'project-a' }, databaseUserId: 'trusted-actor' };
const sourceContext = { organizationId: 'org-a', projectId: 'project-a', conversationId: 'conversation-a', messageId: 'message-a' };
const intent = { taskId: 'task-a', title: 'Reporte', summary: 'Revisar mampostería', sourceVersion: 'a'.repeat(64) };
const reportId = await messageReportSourceId(sourceContext);
const fingerprint = await messageReportFingerprint(intent);
const record = { id: reportId, projectId: 'project-a', taskId: 'task-a', status: 'DRAFT', revision: 0 };
const receipt = { context: sourceContext, sourceVersion: intent.sourceVersion, requestFingerprint: fingerprint, report: record, replayed: false };
const preparation = { context: sourceContext, reportId, source: { id:'message-a', projectId:'project-a', conversationId:'conversation-a', kind:'TEXT',text:'Revisar mampostería',sentAt:'2026-09-24T10:00:00.000Z',workDate:'2026-09-24',version:intent.sourceVersion },existing:null,existingReceipt:null };
function route(overrides = {}) {
  const calls = { database: 0, create: [], prepare: [], permissions: [], limit: null };
  const dependencies = { normalizeMessageReport, messageReportSourceId, messageReportFingerprint, messageReportPreparationMatches, confirmedMessageReport, AccessError, RequestBodyError, WhatsAppProgressReportError, messageReportErrorResponse, assertEvidenceRequestContext, evidenceContextErrorResponse,
    accessErrorResponse: () => Response.json({}, { status: 403 }), requestBodyErrorResponse: () => Response.json({}, { status: 400 }), projectWritePolicyErrorResponse: () => null,
    getPlatformAccess: async () => access, requireTenantPermission: () => {}, getPrisma: () => ({}), readJsonRequest: req => req.json(),
    prepareWhatsAppProgressReport: async () => ({}), createWhatsAppProgressReport: async () => ({}), SOURCE_EVIDENCE_PERMISSION: 'org:field:evidence:read' };
  const factory = new Function(...Object.keys(dependencies), code + '\nreturn createMessageReportHandlers;')(...Object.values(dependencies));
  const handler = factory({ resolveAccess: async () => access, database: () => { calls.database++; return {}; },
    authorize: (a, permission, options) => { assert.equal(a, access); calls.permissions.push({ permission, ...options }); },
    prepare: async (db, options) => { calls.prepare.push(options); return preparation; },
    create: async (db, options) => { calls.create.push(options); return receipt; },
    parse: async (req, options) => { calls.limit = options.maxBytes; return req.json(); }, ...overrides });
  return { handler, calls };
}
const params = { params: Promise.resolve({ conversationId: 'conversation-a', messageId: 'message-a' }) };
function request(method = 'GET', headers = {}, query = '') { return new Request('https://obra.test/api/whatsapp/inbox/conversation-a/messages/message-a/progress-report' + query, { method, headers: { 'x-obrasaas-organization': 'org-a', 'x-obrasaas-project': 'project-a', 'Content-Type': 'application/json', 'idempotency-key': 'operation-0000001', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(intent) } : {}) }); }
for (const method of ['GET', 'POST']) test(method + ' authorizes four permissions and uses only session identity', async () => {
  const { handler, calls } = route(); const response = await handler[method](request(method), params);
  assert.equal(response.status, method === 'POST' ? 201 : 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(calls.permissions.length, 4); const options = method === 'GET' ? calls.prepare[0] : calls.create[0];
  assert.deepEqual(options.scope, { organizationId: 'org-a', projectId: 'project-a' }); assert.equal(options.actorId, 'trusted-actor'); assert.equal(options.messageId, 'message-a');
  if (method === 'POST') { assert.equal(options.operationKey, 'operation-0000001'); assert.equal(calls.limit, 16 * 1024); }
});
for (const permission of ['org:conversations:read', 'org:field:evidence:read', 'org:execution:manage', 'org:tasks:read']) test('denied permission stops persistence: ' + permission, async () => {
  const { handler, calls } = route({ authorize: (a, value) => { if (value === permission) throw new AccessError(); } });
  assert.equal((await handler.POST(request('POST'), params)).status, 403); assert.equal(calls.database, 0);
});
for (const headers of [{ 'x-obrasaas-project': 'other' }, { 'x-obrasaas-organization': 'other' }, { 'x-obrasaas-project': '' }, { 'origin': 'https://other.test' }, { 'sec-fetch-site': 'cross-site' }]) test('context or origin mismatch rejected: ' + JSON.stringify(headers), async () => {
  const { handler, calls } = route(); assert.ok([403,409].includes((await handler.POST(request('POST', headers), params)).status)); assert.equal(calls.database, 0);
});
test('query parameters cannot override the selected source or scope', async () => {
  const { handler, calls } = route(); assert.equal((await handler.GET(request('GET', {}, '?projectId=other'), params)).status, 422); assert.equal(calls.database, 0);
});
test('existing source replay returns 200 not another creation', async () => {
  const { handler } = route({ create: async () => ({ ...receipt, replayed: true }) }); assert.equal((await handler.POST(request('POST'), params)).status, 200);
});
test('unexpected internal failure does not expose details', async () => {
  const { handler } = route({ create: async () => { throw new Error('private-backend-detail'); } }); const response = await handler.POST(request('POST'), params);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private-backend-detail'));
});

for (const method of ['GET','POST']) for (const malformed of [{}, {context:sourceContext}, {...receipt,report:{...record,id:'../other'}}]) test(method+' does not expose a success for an incomplete or foreign service result '+JSON.stringify(malformed), async()=>{
  const {handler}=route({prepare:async()=>malformed,create:async()=>malformed}); const response=await handler[method](request(method),params);
  assert.equal(response.status,502);assert.match(response.headers.get('cache-control'),/no-store/);
});
