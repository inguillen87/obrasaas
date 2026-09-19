import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertSignupScreenContext } from '../src/lib/whatsapp/signup-screen-context.js';
import { readPilotConnectionProgress } from '../src/lib/whatsapp/pilot-connection-progress.js';
const scope = { organization: { id: 'org-a' }, project: { id: 'project-a' } };
const request = (headers = {}, method = 'POST') => new Request('https://obra.test/api/integrations/whatsapp/embedded-signup', { method, headers: { origin: 'https://obra.test', 'X-ObraSaaS-Organization': 'org-a', 'X-ObraSaaS-Project': 'project-a', ...headers } });
test('signup compares company and project against the current session', () => { assert.doesNotThrow(() => assertSignupScreenContext(request(), scope)); });
for (const method of ['POST','DELETE']) {
  for (const headers of [{ 'X-ObraSaaS-Project': '' }, { 'X-ObraSaaS-Organization': '' }, { 'X-ObraSaaS-Project': 'other' }, { 'X-ObraSaaS-Organization': 'other' }, { origin: 'https://other.test' }, { 'sec-fetch-site': 'cross-site' }]) test('signup/disable rejects wrong context before mutation: ' + method + JSON.stringify(headers), () => assert.throws(() => assertSignupScreenContext(request(headers, method), scope)));
}
test('signup backend runs the screen check before reading credentials or contacting Meta', () => {
  const code = readFileSync(new URL('../src/app/api/integrations/whatsapp/embedded-signup/route.js', import.meta.url), 'utf8');
  for (const handler of ['POST','DELETE']) {
    const section = code.split('export async function ' + handler)[1];
    assert.ok(section.indexOf('assertSignupScreenContext(request, access)') < section.indexOf('getPrisma()'));
  }
  assert.match(code, /context: \{ organizationId: access.organization.id, projectId: access.project.id \}/);
});
const targets = [{ organizationId: 'org-a', organizationName: 'Empresa piloto', projects: [{ id: 'project-a', name: 'Obra piloto' }] }];
function fixture({ fail = false, rows } = {}) {
  const calls = [];
  const connection = { id: 'connection-a', projectId: 'project-a', phoneNumberId: '12345', displayPhoneNumber: '+15550000000', enabled: true, connectionStatus: 'CONNECTED', connectedAt: new Date('2026-09-18T12:00:00Z') };
  const prisma = { whatsAppConnection: { findMany: async options => { calls.push(options); return rows || [connection]; } }, $transaction: async (work, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return work({ message: { count: async options => { calls.push(options); if(fail) throw new Error('private-source'); return options.where.direction === 'OUTBOUND' ? 0 : 2; } } }); } };
  return { prisma, calls };
}
test('pilot summary differentiates stored inbound, participant restrictions and app-owned outbound', async () => {
  const { prisma, calls } = fixture(); const result = await readPilotConnectionProgress(prisma, { targets });
  const row = result.channels[0]; assert.equal(row.received, 2); assert.equal(row.awaitingParticipant, 2); assert.equal(row.outboundRecorded, 0); assert.equal(row.linked, true);
  assert.deepEqual(calls[0].where.OR, [{ projectId: 'project-a', project: { organizationId: 'org-a' } }]);
  assert.equal(calls[0].take, 6);
  for (const query of calls.slice(1)) { assert.equal(query.where.conversation.projectId, 'project-a'); assert.equal(query.where.conversation.project.organizationId, 'org-a'); assert.ok(query.where.createdAt.gte instanceof Date); }
  assert.ok(!JSON.stringify(row).includes('12345')); assert.equal(row.encryptedAccessToken, undefined); assert.equal(row.phoneNumberId, undefined);
});
test('empty authorized catalog makes no data calls', async () => { assert.deepEqual(await readPilotConnectionProgress({}, { targets: [] }), { channels: [], hasMore: false }); });
test('read failure remains unknown rather than showing zero incoming messages', async () => {
  const result = await readPilotConnectionProgress(fixture({ fail: true }).prisma, { targets });
  assert.equal(result.channels[0].received, null); assert.equal(result.channels[0].state, 'unavailable'); assert.ok(!JSON.stringify(result).includes('private-source'));
});
test('a result outside the authorized target catalog is not serialized', async () => {
  const result = await readPilotConnectionProgress(fixture({ rows: [{ projectId: 'foreign' }] }).prisma, { targets }); assert.deepEqual(result.channels, []);
});
test('ordinary onboarding neither renders nor requests a customer access token', () => {
  const code = readFileSync(new URL('../src/app/dashboard/integrations/whatsapp-connect-experience.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /name="(accessToken|whatsappBusinessId|phoneNumberId)"/);
  assert.match(code, /Conectar WhatsApp/); assert.match(code, /Continuar en Meta/); assert.match(code, /remitente debe tener acceso autorizado/);
});
test('pilot tools stay behind the superadmin disclosure while the client shows before it', () => {
  const code = readFileSync(new URL('../src/app/dashboard/integrations/page.js', import.meta.url), 'utf8');
  assert.match(code, /access.isSuperadmin && <details/);
  assert.ok(code.indexOf('<IntegrationsClient') < code.indexOf('<PlatformPreflightPanel'));
  assert.ok(code.indexOf('<details') < code.indexOf('<WhatsAppPilotImportPanel'));
});
test('provider event acceptance is limited to an initiated signup and its live callback', () => {
  const code = readFileSync(new URL('../src/app/dashboard/integrations/integrations-client.js', import.meta.url), 'utf8');
  assert.match(code, /!signupActiveRef.current \|\| !META_ORIGINS.has\(event.origin\)/);
  assert.match(code, /generation !== signupGenerationRef.current/);
  assert.match(code, /evidenceScopeHeaders\(\{ organizationId, projectId \}\)/);
  assert.match(code, /payload.context\?\.projectId !== projectId/);
});
test('internal platform workspace cannot onboard a customer number', () => {
  assert.throws(() => assertSignupScreenContext(request(), { ...scope, organization: { id: 'org-a', metadata: { internal: true } } }), { code: 'WHATSAPP_CUSTOMER_WORKSPACE_REQUIRED', status: 409 });
});
test('internal legacy connection may still be disabled with the correct context', () => {
  assert.doesNotThrow(() => assertSignupScreenContext(request({}, 'DELETE'), { ...scope, organization: { id: 'org-a', metadata: { internal: true } } }));
});
