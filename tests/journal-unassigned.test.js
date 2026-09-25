import assert from 'node:assert/strict';
import test from 'node:test';
import { listProgressJournal } from '../src/lib/progress-journal.js';
for (const unassigned of [true, '1']) test('unassigned inbox queries only taskless logs: ' + unassigned, async () => {
  let logs = 0; const unexpected = () => { throw new Error('UNRELATED_QUERY'); };
  const prisma = { dailyLog: { findMany: async ({ where }) => { logs++; assert.deepEqual(where, { projectId: 'p-a', taskId: null }); return [{ id: 'log', projectId: 'p-a', taskId: null, status: 'DRAFT', title: 'Pendiente', workDate: new Date('2026-09-18'), createdAt: new Date('2026-09-18') }]; } }, progressEvidence: { findMany: unexpected }, projectBlocker: { findMany: unexpected }, incident: { findMany: unexpected } };
  const result = await listProgressJournal(prisma, { projectId: 'p-a', unassigned }); assert.equal(logs, 1); assert.equal(result.dailyLogs.length, 1); assert.deepEqual(result.evidence, []); assert.equal(result.timeline[0].kind, 'DAILY_LOG');
});
for (const unassigned of ['0', '1,1', [], 1]) test('malformed unassigned filter rejected: ' + JSON.stringify(unassigned), async () => { await assert.rejects(listProgressJournal({}, { projectId: 'p-a', unassigned })); });
test('task and unassigned filters cannot be combined', async () => { await assert.rejects(listProgressJournal({}, { projectId: 'p-a', taskId: 'task-a', unassigned: true })); });
