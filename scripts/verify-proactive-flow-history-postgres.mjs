import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection } from './lib/execution-test-database.mjs';
import { listProactiveFlowHistory } from '../src/lib/whatsapp/proactive-flow-history.js';
import { flowHistoryPageMatches } from '../src/lib/whatsapp/proactive-flow-history-policy.js';
import { createHistoryFixture, historyScope, historyAccess, HISTORY_NOW } from '../tests/helpers/flow-history-fixture.js';

const connectionString = executionTestConnection(), db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const source = createHistoryFixture(46), report = { status: 'RUNNING', environment: 'disposable-postgresql-17', cases: [], realMessagesSent: 0, providerCalls: 0 };
const read = changes => listProactiveFlowHistory({ prisma: db, access: historyAccess, conversationId: historyScope.conversationId, clock: () => HISTORY_NOW, ...changes });
async function check(name, operation) { await operation(); report.cases.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
async function snapshot() { return JSON.stringify({ messages: await db.message.findMany({ orderBy: { id: 'asc' } }), sessions: await db.whatsAppFlowSession.findMany({ orderBy: { id: 'asc' } }), audits: await db.auditLog.count() }); }
try {
  await check('guarded empty database and synthetic message/session records', async () => {
    assert.equal(await db.organization.count(), 0);
    for (const suffix of ['', '-foreign']) {
      await db.organization.create({ data: { id: historyScope.organizationId + suffix, name: 'Empresa de ensayo', slug: 'history-org' + suffix, subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' } });
      await db.project.create({ data: { id: historyScope.projectId + suffix, organizationId: historyScope.organizationId + suffix, name: 'Obra de ensayo', slug: 'history-project' + suffix, status: 'ACTIVE' } });
      await db.worker.create({ data: { id: 'worker-history' + suffix, organizationId: historyScope.organizationId + suffix, projectId: historyScope.projectId + suffix, name: 'Persona sintética', active: true } });
    }
    await db.conversation.create({ data: { id: historyScope.conversationId, projectId: historyScope.projectId, channel: 'whatsapp', externalId: 'meta:5491111111111', displayName: 'Contacto de ensayo' } });
    await db.message.createMany({ data: source.messages });
    await db.whatsAppFlowSession.createMany({ data: source.sessions.map(({ recipientPhone: _phone, tokenSha256: _token, ...row }, index) => ({ ...row, createdAt: source.messages[index].createdAt, deliveryAttemptedAt: row.sentAt, workerId: 'worker-history', phoneNumberId: '111111111111111', recipientPhone: '5491111111111', flowId: '222222222222222', screenId: 'INCIDENT', flowType: 'incident', tokenSha256: createHash('sha256').update('synthetic-history-' + index).digest('hex') })) });
  });
  await check('real keyset pagination reads 46 records without duplicates or writes', async () => {
    const before = await snapshot(), ids = []; let cursor = null;
    do { const page = await read({ cursor }); assert.equal(flowHistoryPageMatches(page, historyScope, cursor), true); ids.push(...page.items.map(row => row.messageId)); cursor = page.nextCursor; } while (cursor);
    assert.equal(ids.length, 46); assert.equal(new Set(ids).size, 46); assert.equal(await snapshot(), before);
  });
  await check('verified session response and absent provider reference remain distinct', async () => {
    await db.whatsAppFlowSession.update({ where: { id: source.sessions[0].id }, data: { consumedAt: HISTORY_NOW, consumedExternalId: 'wamid.synthetic-history-response' } });
    await db.message.update({ where: { id: source.messages[1].id }, data: { providerMessageId: null } });
    const before = await snapshot(), page = await read({});
    assert.equal(page.items[0].reply.state, 'recorded'); assert.equal(page.items[0].status, 'accepted'); assert.equal(page.items[1].status, 'unknown'); assert.equal(await snapshot(), before);
  });
  await check('blank provider reference never turns a persisted accepted row into proof of acceptance', async () => {
    const id = source.messages[3].id;
    await db.message.update({ where: { id }, data: { providerMessageId: '   ' } });
    const before = await snapshot(), page = await read({});
    assert.equal(page.items.find(row => row.messageId === id).status, 'unknown');
    assert.equal(await snapshot(), before);
  });
  await check('foreign conversation scope and cursor are denied without leaking session data', async () => {
    const page = await read({}), before = await snapshot();
    await assert.rejects(read({ access: { ...historyAccess, organization: { id: 'organization-a-foreign' } } }), { code: 'INBOX_CONVERSATION_NOT_FOUND' });
    await assert.rejects(read({ cursor: page.nextCursor, conversationId: 'other' }), { code: 'WHATSAPP_FLOW_HISTORY_CURSOR_INVALID' });
    assert.equal(await snapshot(), before);
    assert.ok(!JSON.stringify(page).includes('PRIVATE_TOKEN_CANARY')); assert.ok(!JSON.stringify(page).includes('wamid.'));
  });
  await check('a foreign session id in a scoped message cannot disclose a reply timestamp', async () => {
    const foreignId = '20000000-0000-4000-8000-000000000001';
    await db.whatsAppFlowSession.create({ data: { id: foreignId, organizationId: 'organization-a-foreign', projectId: 'project-a-foreign', workerId: 'worker-history-foreign', phoneNumberId: '333333333333333', recipientPhone: '5492222222222', blueprintKey: 'incident-report', flowId: '444444444444444', screenId: 'INCIDENT', flowType: 'incident', sourceExternalId: 'foreign-history', tokenSha256: 'f'.repeat(64), createdAt: new Date(HISTORY_NOW.getTime() - 3600000), expiresAt: new Date(HISTORY_NOW.getTime() + 3600000), deliveryAttemptedAt: new Date(HISTORY_NOW.getTime() - 60000), consumedAt: HISTORY_NOW, consumedExternalId: 'wamid.synthetic-foreign-history-response' } });
    await db.message.update({ where: { id: source.messages[2].id }, data: { metadata: { ...source.messages[2].metadata, flowSessionId: foreignId } } });
    const before = await snapshot(), page = await read({}), row = page.items.find(item => item.messageId === source.messages[2].id);
    assert.equal(row.correlation, 'unavailable'); assert.equal(row.reply.state, 'unverified'); assert.equal(row.reply.recordedAt, null); assert.equal(row.expiresAt, null); assert.equal(await snapshot(), before);
  });
  await check('equal timestamps use stable ids and no cursor row lookup after deletion', async () => {
    await db.message.updateMany({ where: { conversationId: historyScope.conversationId }, data: { createdAt: HISTORY_NOW } });
    const first = await read({}); await db.message.delete({ where: { id: first.items.at(-1).messageId } });
    const second = await read({ cursor: first.nextCursor }); assert.equal(new Set([...first.items, ...second.items].map(item => item.messageId)).size, 40);
  });
  await check('history remains readable with no sending connection and unchanged audits', async () => {
    assert.equal(await db.whatsAppConnection.count(), 0); assert.equal(await db.auditLog.count(), 0);
    const before = await snapshot(); await read({}); assert.equal(await snapshot(), before);
  });
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.error = { code: error.code || error.name, message: String(error.message).slice(0, 2000) }; process.exitCode = 1; }
finally { mkdirSync('evidence', { recursive: true }); writeFileSync('evidence/proactive-flow-history-postgres.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await db.$disconnect(); }
