import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { executionTestConnection } from './lib/execution-test-database.mjs';

// Refuse before loading the application, Prisma or any optional .env file.
const connectionString = executionTestConnection();
assert.ok(!['preview', 'production'].includes(process.env.VERCEL_ENV));
assert.ok(!['preview', 'production'].includes(process.env.VERCEL_TARGET_ENV));
assert.ok(!globalThis.__obraSaasPrisma, 'An application Prisma client must not be reused.');
process.env.DATABASE_URL = connectionString;
process.env.WHATSAPP_FLOW_TOKEN_SECRET = 'a31-disposable-flow-signing-secret-not-a-real-credential';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL('../src/' + specifier.slice(2)
    + (specifier.startsWith('@/generated/') ? '.ts' : '.js'), import.meta.url).href, context);
  return next(specifier, context);
} });
const { PrismaPg } = await import('@prisma/adapter-pg');
const { PrismaClient } = await import('../src/generated/prisma/client.ts');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
// This is the actual PostgreSQL client, not a simulated Prisma delegate.
globalThis.__obraSaasPrisma = db;
const oldFetch = globalThis.fetch;
let forbiddenFetches = 0;
globalThis.fetch = async () => { forbiddenFetches++; throw new Error('External HTTP is forbidden in A31.'); };
const { applyWebhookMessageAtomically, storeWebhookEvent, acquireWebhookEvent, createEmptyAppState } = await import('../src/lib/db.js');
const { issueWhatsAppFlowSession, whatsAppFlowTokenEvidence } = await import('../src/lib/whatsapp/flow-sessions.js');
const { processIncomingObraMessage } = await import('../src/lib/whatsapp/obra-engine.js');
const { getWhatsAppFlowBlueprint } = await import('../src/lib/whatsapp/flows.js');
const { normalizeWorkerPhone } = await import('../src/lib/field-workers.js');
const { readProactiveFlowIncident } = await import('../src/lib/whatsapp/flow-incident.js');
const { readProactiveFlowReply } = await import('../src/lib/whatsapp/proactive-flow-reply.js');
const { serializeWebhookPayload } = await import('../src/lib/webhook-queue.js');
const report = { status: 'RUNNING', environment: 'disposable-postgresql-real-atomic-function-and-engine',
  cases: [], physicalMetaMessages: 0, httpSignatureTested: false, fullWorkerDispatchTested: false };
let serial = 0;
async function check(name, fn) { await fn(); report.cases.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
async function fixture(label, organizationId = 'a31-org-a') {
  const index = ++serial, projectId = 'a31-' + label, phoneNumberId = String(910000000000000 + index);
  const scope = { organizationId, projectId, phoneNumberId }, workerId = projectId + '-worker';
  const from = '5491111111111', phone = normalizeWorkerPhone(from);
  await db.project.create({ data: { id: projectId, organizationId, name: 'Obra sintetica A31', slug: projectId, status: 'ACTIVE' } });
  await db.whatsAppConnection.create({ data: { id: projectId + '-connection', projectId, phoneNumberId, enabled: true,
    connectionStatus: 'CONNECTED', whatsappBusinessId: String(920000000000000 + index) } });
  await db.worker.create({ data: { id: workerId, projectId, organizationId, phone, name: 'Responsable sintetico', active: true, metadata: { whatsappRole: 'SITE_MANAGER' } } });
  await db.projectSnapshot.create({ data: { projectId, state: createEmptyAppState(), version: 1 } });
  const issued = await issueWhatsAppFlowSession(db, { ...scope, workerId, recipientPhone: phone,
    blueprintKey: 'incident-report', flowId: '930000000000000', screenId: getWhatsAppFlowBlueprint('incident-report').screenId,
    flowType: 'incident', sourceExternalId: 'obrasaas-flow-template:' + projectId });
  const sentAt = new Date(), providerMessageId = 'wamid.a31.sent.' + index;
  await db.whatsAppFlowSession.update({ where: { id: issued.session.id }, data: { deliveryAttemptedAt: sentAt, sentAt, providerMessageId } });
  const conversationId = projectId + '-conversation', sourceId = projectId + '-source';
  await db.conversation.create({ data: { id: conversationId, projectId, channel: 'whatsapp', externalId: 'meta:' + from, displayName: 'Participante sintetico' } });
  await db.message.create({ data: { id: sourceId, conversationId, direction: 'OUTBOUND', kind: 'INTERACTIVE',
    externalId: issued.session.sourceExternalId, providerMessageId, body: 'Solicitud de incidencia de ensayo', status: 'delivered',
    createdAt: issued.session.createdAt, sentAt, metadata: { messageType: 'whatsapp_flow_template', blueprintKey: 'incident-report', flowSessionId: issued.session.id } } });
  const event = { provider: 'meta', eventType: 'message', externalId: 'wamid.a31.received.' + index,
    phoneNumberId, from, kind: 'interactive', timestamp: new Date(), interactive: { type: 'flow',
      flowToken: whatsAppFlowTokenEvidence(issued.token), response: { flow_type: 'incident', severity: 'high', area: 'Frente de ensayo', description: 'Demora de materiales de ensayo.' } } };
  const stored = await storeWebhookEvent({ provider: 'meta', externalId: projectId + ':' + event.externalId,
    eventType: 'message', payload: serializeWebhookPayload(event, scope), scope });
  const leased = await acquireWebhookEvent({ projectId });
  assert.equal(leased.id, stored.eventId); assert.equal(leased.status, 'PROCESSING');
  const f = { scope, workerId, conversationId, sourceId, event, stored, leased, sessionId: issued.session.id, engineCalls: 0 };
  f.apply = async context => { f.engineCalls++; return processIncomingObraMessage(f.event, scope, { ...context, persist: false, environment: {} }); };
  return f;
}
const execute = (f, extra = {}) => applyWebhookMessageAtomically({ eventId: f.leased.id, leaseToken: f.leased.leaseToken, event: f.event, scope: f.scope, apply: f.apply, ...extra });
async function snapshot(f) {
  return JSON.parse(JSON.stringify({
    snapshot: await db.projectSnapshot.findUnique({ where: { projectId: f.scope.projectId } }),
    messages: await db.message.findMany({ where: { conversation: { projectId: f.scope.projectId } }, orderBy: { id: 'asc' } }),
    sessions: await db.whatsAppFlowSession.findMany({ where: { projectId: f.scope.projectId }, orderBy: { id: 'asc' } }),
    tasks: await db.task.findMany({ where: { projectId: f.scope.projectId }, orderBy: { id: 'asc' } }),
    audits: await db.auditLog.findMany({ where: { organizationId: f.scope.organizationId }, orderBy: { id: 'asc' } }),
  }));
}
async function assertLinked(f) {
  const access = { organization: { id: f.scope.organizationId }, project: { id: f.scope.projectId } };
  const input = { prisma: db, access, conversationId: f.conversationId, messageId: f.sourceId };
  const reply = await readProactiveFlowReply(input), linked = await readProactiveFlowIncident(input);
  assert.equal(reply.state, 'available'); assert.equal(linked.state, 'available');
  const inbound = await db.message.findFirst({ where: { conversationId: f.conversationId, direction: 'INBOUND', externalId: f.event.externalId } });
  assert.equal(reply.reply.messageId, inbound.id);
  assert.equal(linked.incident.id, inbound.metadata.flowIncidentReceipt.incidentId);
  for (const text of ['flowToken', 'tokenSha256', f.event.from, 'description', 'workerId']) assert.equal(JSON.stringify(linked).includes(text), false);
  return linked;
}
try {
  await check('isolated empty database, real TCP identity and no provider credentials', async () => {
    assert.equal(await db.organization.count(), 0);
    const [identity] = await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_addr()::text AS address, inet_server_port() AS port');
    assert.equal(identity.name, 'obrasaas_execution_ci'); assert.equal(identity.port, 5432);
    assert.ok(identity.address);
    for (const suffix of ['a', 'b']) await db.organization.create({ data: { id: 'a31-org-' + suffix, name: 'Empresa sintetica A31', slug: 'a31-org-' + suffix, subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' } });
  });
  await check('leased event consumes session, stores engine receipt and incident in one transaction', async () => {
    const f = await fixture('success'), result = await execute(f), after = await snapshot(f);
    assert.equal(result.alreadyApplied, false); assert.equal(f.engineCalls, 1);
    assert.equal(after.snapshot.version, 2); assert.equal(after.snapshot.state.incidents.length, 1);
    assert.equal(after.sessions[0].consumedExternalId, f.event.externalId);
    assert.equal(after.messages.filter(m => m.direction === 'INBOUND').length, 1);
    assert.equal(after.messages.filter(m => m.direction === 'OUTBOUND').length, 2);
    assert.ok((await db.webhookEvent.findUnique({ where: { id: f.leased.id } })).appliedAt);
    await assertLinked(f); assert.deepEqual(await snapshot(f), after);
    const replay = await execute(f); assert.equal(replay.alreadyApplied, true); assert.equal(f.engineCalls, 1);
    assert.deepEqual(await snapshot(f), after);
  });
  await check('two PostgreSQL transactions sharing a lease execute the engine once', async () => {
    const f = await fixture('concurrent'), results = await Promise.all([execute(f), execute(f)]);
    assert.equal(results.filter(r => r.alreadyApplied).length, 1); assert.equal(f.engineCalls, 1);
    const after = await snapshot(f); assert.equal(after.snapshot.version, 2); assert.equal(after.snapshot.state.incidents.length, 1);
    await assertLinked(f);
  });
  await check('expired processing lease is reclaimed without repeating committed business effects', async () => {
    const f = await fixture('reclaimed'); await execute(f); const before = await snapshot(f), oldLease = f.leased.leaseToken;
    const reacquired = await acquireWebhookEvent({ projectId: f.scope.projectId, now: new Date(new Date(f.leased.leaseExpiresAt).getTime() + 1) });
    assert.equal(reacquired.id, f.leased.id); assert.notEqual(reacquired.leaseToken, oldLease);
    assert.equal(reacquired.attempts, 2); f.leased = reacquired;
    await assert.rejects(execute(f, { leaseToken: oldLease }), { code: 'WEBHOOK_LEASE_LOST' });
    const result = await execute(f); assert.equal(result.alreadyApplied, true); assert.equal(f.engineCalls, 1);
    assert.deepEqual(await snapshot(f), before); await assertLinked(f);
  });
  await check('duplicate ingress retains the same durable event without extra application', async () => {
    const f = await fixture('duplicate'); await execute(f); const before = await snapshot(f);
    const duplicate = await storeWebhookEvent({ provider: 'meta', externalId: f.scope.projectId + ':' + f.event.externalId,
      eventType: 'message', payload: serializeWebhookPayload(f.event, f.scope), scope: f.scope });
    assert.equal(duplicate.stored, false); assert.equal(duplicate.eventId, f.leased.id); assert.deepEqual(await snapshot(f), before);
  });
  await check('late failure at appliedAt rolls back session, snapshot, inbound and automatic reply', async () => {
    const f = await fixture('rollback'), before = await snapshot(f);
    assert.match(f.leased.id, /^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(`CREATE FUNCTION a31_reject_applied() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${f.leased.id}' AND NEW."appliedAt" IS NOT NULL THEN RAISE EXCEPTION 'A31 deliberate rollback'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER a31_reject_applied BEFORE UPDATE ON "WebhookEvent" FOR EACH ROW EXECUTE FUNCTION a31_reject_applied()');
    try { await assert.rejects(execute(f)); assert.equal(f.engineCalls, 1); assert.deepEqual(await snapshot(f), before);
      assert.equal((await db.webhookEvent.findUnique({ where: { id: f.leased.id } })).appliedAt, null);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER a31_reject_applied ON "WebhookEvent"'); await db.$executeRawUnsafe('DROP FUNCTION a31_reject_applied()'); }
    await execute(f); assert.equal(f.engineCalls, 2); await assertLinked(f);
    assert.equal((await snapshot(f)).snapshot.state.incidents.length, 1);
  });
  await check('wrong lease cannot consume the form or enter the engine', async () => {
    const f = await fixture('wrong-lease'), before = await snapshot(f);
    await assert.rejects(execute(f, { leaseToken: 'not-the-current-lease' }), { code: 'WEBHOOK_LEASE_LOST' });
    assert.equal(f.engineCalls, 0); assert.deepEqual(await snapshot(f), before);
  });
  await check('tampered token fails before engine and leaves its legitimate session unconsumed', async () => {
    const f = await fixture('token'), before = await snapshot(f);
    f.event.interactive.flowToken.tokenSha256 = '0'.repeat(64);
    await assert.rejects(execute(f), { code: 'WHATSAPP_FLOW_SESSION_INVALID' });
    assert.equal(f.engineCalls, 0); assert.deepEqual(await snapshot(f), before);
  });
  await check('same phone in two employers does not authorize a foreign form', async () => {
    const a = await fixture('tenant-a'), b = await fixture('tenant-b', 'a31-org-b');
    const beforeA = await snapshot(a), beforeB = await snapshot(b), own = b.event.interactive.flowToken;
    b.event.interactive.flowToken = a.event.interactive.flowToken;
    await assert.rejects(execute(b), { code: 'WHATSAPP_FLOW_SESSION_INVALID' });
    assert.equal(b.engineCalls, 0); assert.deepEqual(await snapshot(a), beforeA); assert.deepEqual(await snapshot(b), beforeB);
    b.event.interactive.flowToken = own; await execute(a); await execute(b); await assertLinked(a); await assertLinked(b);
  });
  await check('disabled receiving connection cannot apply a previously queued event', async () => {
    const f = await fixture('disabled'); await db.whatsAppConnection.update({ where: { projectId: f.scope.projectId }, data: { enabled: false } });
    const before = await snapshot(f); await assert.rejects(execute(f), { code: 'WEBHOOK_MESSAGE_SCOPE_MISMATCH' });
    assert.equal(f.engineCalls, 0); assert.deepEqual(await snapshot(f), before);
  });
  await check('revoked worker is quarantined without executing or consuming the form', async () => {
    const f = await fixture('revoked'); await db.worker.update({ where: { id: f.workerId }, data: { active: false } });
    const before = await snapshot(f), result = await execute(f), after = await snapshot(f);
    assert.equal(result.quarantined, true); assert.equal(result.outcome.deliverySuppressed, true); assert.equal(f.engineCalls, 0);
    assert.deepEqual(after.snapshot, before.snapshot); assert.deepEqual(after.sessions, before.sessions);
    assert.equal(after.messages.filter(m => m.direction === 'OUTBOUND').length, 1);
    assert.equal(after.messages.find(m => m.direction === 'INBOUND').metadata.quarantined, true);
  });
  await check('application outcome is persisted but no external dispatcher or delivery is claimed', async () => {
    assert.equal(forbiddenFetches, 0);
    assert.equal(await db.whatsAppConnection.count({ where: { encryptedAccessToken: { not: null } } }), 0);
    assert.equal(await db.incident.count(), 0);
  });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = { code: error.code || error.name, message: String(error.message).slice(0, 1600) }; process.exitCode = 1;
} finally {
  globalThis.fetch = oldFetch; delete globalThis.__obraSaasPrisma;
  mkdirSync('evidence', { recursive: true }); writeFileSync('evidence/webhook-flow-atomic-postgres.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await db.$disconnect();
}
