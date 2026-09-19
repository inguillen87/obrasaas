import assert from 'node:assert/strict';
import test from 'node:test';
import { readScheduleFieldStatus, fieldStatusQuery } from '../src/lib/schedule-field-status.js';
import { fieldSignalMatches } from '../src/lib/schedule-field-channel.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const date = new Date('2026-09-18T12:00:00Z');
const task = id => ({ id, title: 'Tarea ' + id, type: 'TASK', progress: 10, revision: 2, startsAt: date, endsAt: date, updatedAt: date });
function database({ tasks = [task('task-a')], evidence = [], logs = [], balances = [], found = true } = {}) {
  const calls = { reads: [], balanceReads: 0, writes: 0 };
  const tx = {
    project: { findFirst: async ({ where }) => { assert.deepEqual(where, { id: scope.projectId, organizationId: scope.organizationId }); return found ? { id: scope.projectId, name: 'Obra demo' } : null; } },
    task: { findMany: async options => { calls.reads.push(options); assert.equal(options.where.projectId, scope.projectId); assert.equal(options.where.metadata.equals, 'canonical-task-v1'); return tasks; } },
    progressEvidence: { groupBy: async options => { calls.reads.push(options); assert.equal(options.where.projectId, scope.projectId); return evidence; } },
    dailyLog: { groupBy: async options => { calls.reads.push(options); assert.equal(options.where.projectId, scope.projectId); return logs; }, count: async ({ where }) => { assert.deepEqual(where, { projectId: scope.projectId, taskId: null }); return 1; } },
    taskProgressMeasurementBalance: { findMany: async options => { calls.balanceReads++; assert.equal(options.where.organizationId, scope.organizationId); assert.equal(options.where.projectId, scope.projectId); return balances; } },
  };
  return { calls, prisma: { $transaction: async (operation, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return operation(tx); } } };
}
const group = (status, count, taskId = 'task-a') => ({ taskId, status, _count: { _all: count }, _max: { updatedAt: date } });
test('evidence and reports are counts, never automatic progress', async () => {
  const { prisma } = database({ evidence: [group('PENDING', 2), group('APPROVED', 1)], logs: [group('SUBMITTED', 1)] });
  const data = await readScheduleFieldStatus(prisma, { scope });
  assert.equal(data.tasks[0].operationalProgress, 10); assert.equal(data.tasks[0].measured, null);
  assert.equal(data.tasks[0].evidence.total, 3); assert.equal(data.tasks[0].reports.pending, 1); assert.equal(data.unassignedParts, 1);
  assert.equal(data.tasks[0].evidence.updatedAt, date.toISOString());
});
test('approved quantity produces exact measured percentage without changing Task.progress', async () => {
  const { prisma } = database({ balances: [{ taskId: 'task-a', baseQuantity: '30', approvedCumulativeQuantity: '10', unitCode: 'M2', revision: 3, updatedAt: date, lastApprovedMeasurementId: 'm-1' }] });
  const data = await readScheduleFieldStatus(prisma, { scope, canReadMeasurements: true });
  assert.equal(data.tasks[0].measured.percent, '33.3333'); assert.equal(data.tasks[0].measured.completed, '10.0000');
  assert.equal(data.tasks[0].operationalProgress, 10); assert.equal(data.tasks[0].measured.measurementId, 'm-1');
});
test('no measurement permission means no measurement query and no balance disclosure', async () => {
  const { prisma, calls } = database({ balances: [{ taskId: 'task-a', baseQuantity: 'private' }] });
  const result = await readScheduleFieldStatus(prisma, { scope });
  assert.equal(calls.balanceReads, 0); assert.equal(result.tasks[0].measured, null); assert.equal(result.canReadMeasurements, false);
});
test('balance over base fails closed', async () => {
  const { prisma } = database({ balances: [{ taskId: 'task-a', baseQuantity: '10', approvedCumulativeQuantity: '11' }] });
  await assert.rejects(readScheduleFieldStatus(prisma, { scope, canReadMeasurements: true }), { code: 'FIELD_STATUS_INCONSISTENT' });
});
test('missing project does not query tasks', async () => {
  const { prisma, calls } = database({ found: false }); await assert.rejects(readScheduleFieldStatus(prisma, { scope }), { status: 404 }); assert.equal(calls.reads.length, 0);
});
test('missing selected task returns opaque not found', async () => {
  const { prisma } = database({ tasks: [] }); await assert.rejects(readScheduleFieldStatus(prisma, { scope, query: { taskId: 'other' } }), { status: 404 });
});
test('bounded keyset pagination queries evidence only for the visible tasks', async () => {
  const tasks = Array.from({ length: 51 }, (_, i) => task('task-' + String(i).padStart(2, '0'))); const { prisma, calls } = database({ tasks });
  const data = await readScheduleFieldStatus(prisma, { scope, query: { after: 'task-before' } });
  assert.equal(data.tasks.length, 50); assert.equal(data.page.nextAfter, 'task-49'); assert.equal(data.page.hasMore, true);
  assert.equal(calls.reads[0].take, 51); assert.deepEqual(calls.reads[0].where.id, { gt: 'task-before' }); assert.equal(calls.reads[1].where.taskId.in.length, 50);
});
test('fingerprint changes only with authoritative data', async () => {
  const base = await readScheduleFieldStatus(database().prisma, { scope });
  const again = await readScheduleFieldStatus(database().prisma, { scope });
  const changed = await readScheduleFieldStatus(database({ evidence: [group('APPROVED', 1)] }).prisma, { scope });
  assert.equal(base.version, again.version); assert.notEqual(base.version, changed.version);
});
test('empty project is explicit, not seeded with demo data', async () => {
  const data = await readScheduleFieldStatus(database({ tasks: [] }).prisma, { scope });
  assert.deepEqual(data.tasks, []); assert.equal(data.page.hasMore, false);
});
for (const query of ['tenantId=other', 'taskId=a&taskId=b', 'after=a&taskId=b', 'taskId=', 'taskId=../other', 'after=']) {
  test('invalid query rejected: ' + query, () => assert.throws(() => fieldStatusQuery(new URLSearchParams(query))));
}
test('validated task and cursor filters remain bounded inputs', () => {
  assert.deepEqual(fieldStatusQuery(new URLSearchParams('taskId=task-a')), { taskId: 'task-a', after: null });
  assert.deepEqual(fieldStatusQuery(new URLSearchParams('after=task-a')), { taskId: null, after: 'task-a' });
});
test('signals only match the same company/project and protocol version', () => {
  assert.equal(fieldSignalMatches({ version: 1, ...scope }, scope), true);
  for (const signal of [null, { version: 2, ...scope }, { version: 1, ...scope, organizationId: 'org-b' }, { version: 1, ...scope, projectId: 'project-b' }]) assert.equal(fieldSignalMatches(signal, scope), false);
});
