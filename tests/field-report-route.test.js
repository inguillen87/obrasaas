import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { FieldReportError, fieldReportErrorResponse } from '../src/lib/field-report.js';
const source = fs.readFileSync(new URL('../src/app/api/field/reports/route.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export const .*;\r?\n/gm, '').replace('export async function POST', 'async function POST');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function handler(overrides = {}) {
  const calls = { writes: [], prisma: 0, limits: null };
  const dependencies = {
    AccessError, RequestBodyError, FieldReportError, fieldReportErrorResponse,
    accessErrorResponse: () => Response.json({ code: 'DENIED' }, { status: 403 }),
    requestBodyErrorResponse: () => Response.json({ code: 'BODY_INVALID' }, { status: 400 }),
    projectWritePolicyErrorResponse: () => null,
    getPlatformAccess: async () => ({ organization: { id: 'trusted-org' }, project: { id: 'trusted-project' }, databaseUserId: 'trusted-actor' }),
    requireTenantPermission: (access, permission, options) => { assert.equal(permission, 'org:execution:manage'); assert.equal(options.subscriptionMode, 'write'); },
    getPrisma: () => { calls.prisma++; return {}; },
    readJsonRequest: async (request, options) => { calls.limits = options; return request.json(); },
    createFieldReport: async (prisma, options) => { calls.writes.push(options); return { report: { id: 'field-test', status: 'DRAFT' }, replayed: false }; },
    ...overrides,
  };
  return { calls, post: new Function(...Object.keys(dependencies), source + '\nreturn POST;')(...Object.values(dependencies)) };
}
const request = headers => new Request('https://obrasaas.test/api/field/reports', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'request-key-00000001', ...headers }, body: JSON.stringify({ projectId: 'trusted-project', title: 'Parte' }) });
test('ruta usa identidad de sesión y cuerpo acotado', async () => {
  const { post, calls } = handler(); const response = await post(request());
  assert.equal(response.status, 201); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(calls.writes[0].scope, { organizationId: 'trusted-org', projectId: 'trusted-project' });
  assert.equal(calls.writes[0].actorId, 'trusted-actor'); assert.equal(calls.writes[0].operationKey, 'request-key-00000001');
  assert.equal(calls.limits.maxBytes, 16 * 1024);
});
for (const headers of [{ origin: 'https://evil.test' }, { 'sec-fetch-site': 'cross-site' }]) test('origen cruzado no llega a persistencia: ' + Object.keys(headers)[0], async () => {
  const { post, calls } = handler(); assert.equal((await post(request(headers))).status, 403); assert.equal(calls.prisma, 0);
});
test('rol sin permiso no llega a persistencia', async () => {
  const { post, calls } = handler({ requireTenantPermission: () => { throw new AccessError('forbidden'); } });
  assert.equal((await post(request())).status, 403); assert.equal(calls.prisma, 0);
});
test('el replay confirmado devuelve 200 en vez de una segunda creación', async () => {
  const { post } = handler({ createFieldReport: async () => ({ replayed: true, report: { id: 'existing', status: 'DRAFT' } }) });
  assert.equal((await post(request())).status, 200);
});
test('errores internos no revelan detalles ni afirman guardado', async () => {
  const { post } = handler({ createFieldReport: async () => { throw new Error('private-connection-data'); } });
  const response = await post(request()); const result = await response.text();
  assert.equal(response.status, 500); assert.ok(!result.includes('private-connection-data')); assert.match(result, /FIELD_SAVE_UNCONFIRMED/);
});
