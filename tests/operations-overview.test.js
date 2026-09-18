import assert from 'node:assert/strict';
import test from 'node:test';
import { readOperationsOverview, operationsPermissions } from '../src/lib/operations-overview.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const now = new Date('2026-09-18T12:00:00Z');
const permissions = { execution: true, tasks: true, proposals: true, evidence: true, review: true, inspect: true, inbox: true, integrations: true, capture: true };
function database({ failModel = null, found = true, count = 5, connection = null } = {}) {
  const calls = [];
  const tx = {};
  for (const name of ['dailyLog','inspectionRecord','projectBlocker','purchaseOrder','progressEvidence','operationalProposal']) {
    tx[name] = { count: async options => { calls.push({ model: name, method: 'count', ...options }); if (name === failModel) throw new Error('private-database-error'); return count; },
      findMany: async options => { calls.push({ model: name, method: 'list', ...options }); return count ? [{ id: name + '-1', title: 'Ensayo', number: 'OC-001', taskId: 'task-a', createdAt: now }] : []; } };
  }
  return { calls, prisma: { project: { findFirst: async options => { calls.push({ model: 'project', ...options }); return found ? { id: 'project-a', name: 'Obra de ensayo', status: 'ACTIVE' } : null; } },
    whatsAppConnection: { findUnique: async options => { calls.push({ model: 'whatsapp', ...options }); if (failModel === 'whatsapp') throw new Error('private-provider-error'); return connection; } },
    $transaction: async (callback, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return callback(tx); } } };
}
test('operations summary reads all authorized queues without creating records', async () => {
  const db = database(); const result = await readOperationsOverview(db.prisma, { scope, permissions, now });
  assert.equal(result.queues.length, 7); assert.equal(result.projectId, scope.projectId); assert.equal(result.organizationId, scope.organizationId);
  assert.equal(result.failedQueues, 0); assert.ok(result.queues.every(queue => queue.count === 5 && queue.samples.length === 1 && queue.hasMore));
  for (const call of db.calls.filter(call => call.method)) { assert.equal(call.where.projectId, scope.projectId); assert.equal(call.where.organizationId || call.where.project?.organizationId, scope.organizationId); }
  for (const call of db.calls.filter(call => call.method === 'list')) { assert.equal(call.take, 3); assert.deepEqual(call.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]); }
});
test('only three oldest samples are requested, counts are not sample lengths', async () => {
  const db = database({ count: 24 }); const data = await readOperationsOverview(db.prisma, { scope, permissions, now });
  assert.equal(data.queues[0].count, 24); assert.equal(data.queues[0].samples.length, 1); assert.equal(data.sampleLimit, 3);
});
test('missing permissions cause no reads from restricted sources', async () => {
  const db = database(); const result = await readOperationsOverview(db.prisma, { scope, permissions: {}, now });
  assert.deepEqual(result.queues, []); assert.deepEqual(result.paths, []); assert.equal(result.channel, null); assert.equal(db.calls.length, 1);
});
test('execution access alone does not reveal evidence or conversational data', async () => {
  const db = database(); const result = await readOperationsOverview(db.prisma, { scope, permissions: { execution: true }, now });
  assert.ok(!result.queues.some(queue => ['evidence','proposals'].includes(queue.key))); assert.equal(result.channel, null);
  assert.ok(!db.calls.some(call => ['progressEvidence','operationalProposal','whatsapp'].includes(call.model)));
});
test('source failure stays unknown, not a false zero or empty successful queue', async () => {
  const db = database({ failModel: 'purchaseOrder' }); const data = await readOperationsOverview(db.prisma, { scope, permissions, now });
  assert.equal(data.failedQueues, 1); const queue = data.queues.find(q => q.key === 'purchases');
  assert.equal(queue.state, 'unavailable'); assert.equal(queue.count, null); assert.deepEqual(queue.samples, []);
  assert.ok(data.queues.filter(q => q.key !== 'purchases').every(q => q.state === 'available')); assert.ok(!JSON.stringify(data).includes('private-database-error'));
});
test('zero backlog is taken from the database, never from demo metrics', async () => {
  const db = database({ count: 0 }); const data = await readOperationsOverview(db.prisma, { scope, permissions, now });
  assert.ok(data.queues.every(queue => queue.count === 0 && queue.samples.length === 0 && queue.state === 'available'));
});
test('expired proposals are not presented as actionable', async () => {
  const db = database(); await readOperationsOverview(db.prisma, { scope, permissions, now });
  const call = db.calls.find(c => c.model === 'operationalProposal' && c.method === 'count');
  assert.equal(call.where.status, 'PENDING'); assert.equal(call.where.expiresAt.gt, now);
});
test('terminal reports and already linked drafts do not enter the linking queue', async () => {
  const db = database(); await readOperationsOverview(db.prisma, { scope, permissions, now });
  const call = db.calls.find(c => c.model === 'dailyLog' && c.method === 'count');
  assert.equal(call.where.status, 'DRAFT'); assert.equal(call.where.taskId, null);
});
test('does not request provider secrets, file paths, amounts, message bodies or worker identity', async () => {
  const db = database(); await readOperationsOverview(db.prisma, { scope, permissions, now });
  for (const call of db.calls.filter(c => c.select)) assert.ok(!['summary','caption','body','action','credential','accessToken','media','authorWorkerId','total'].some(key => key in call.select));
});
test('no linked WhatsApp record is not displayed as a working channel', async () => {
  const db = database(); const data = await readOperationsOverview(db.prisma, { scope, permissions, now });
  assert.equal(data.channel.connected, false); assert.match(data.channel.detail, /No reemplaza una prueba real/); assert.equal(data.channel.href, '/dashboard/integrations');
});
test('channel failure is explicitly unavailable, without provider error disclosure', async () => {
  const db = database({ failModel: 'whatsapp' }); const data = await readOperationsOverview(db.prisma, { scope, permissions: { inbox: true }, now });
  assert.equal(data.channel.state, 'unavailable'); assert.equal(data.channel.href, '/dashboard/inbox'); assert.ok(!JSON.stringify(data).includes('private-provider-error'));
});
test('another project or company is not silently substituted', async () => {
  const db = database({ found: false }); await assert.rejects(readOperationsOverview(db.prisma, { scope, permissions, now }), { status: 404 });
  assert.equal(db.calls.length, 1); assert.deepEqual(db.calls[0].where, { id: scope.projectId, organizationId: scope.organizationId });
});
for (const invalid of [{ organizationId: '', projectId: 'p' }, { organizationId: 'org-a', projectId: '../x' }, { organizationId: [], projectId: 'p' }]) test('invalid scope fails before database: ' + JSON.stringify(invalid), async () => {
  await assert.rejects(readOperationsOverview({}, { scope: invalid }));
});
test('capabilities are derived from exact granted permissions, not truthy strings', () => {
  const access = {}; const checked = [];
  const result = operationsPermissions(access, (candidate, permission) => { assert.equal(candidate, access); checked.push(permission); return permission === 'org:conversations:read' ? true : 'true'; });
  assert.equal(result.inbox, true); assert.equal(result.execution, false); assert.equal(result.review, false); assert.ok(checked.includes('org:field:evidence:read'));
});
