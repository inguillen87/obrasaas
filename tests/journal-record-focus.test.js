import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { listProgressJournal } from '../src/lib/progress-journal.js';
import { withJournalCorrectionLinks } from '../src/lib/journal-correction.js';
test('a focused record reads only the requested project and ID', async () => {
  const calls = [];
  const prisma = { dailyLog: { findMany: async query => { calls.push(query); return [{ id: 'record-a', projectId: 'project-a', title: 'Original', status: 'REJECTED', revision: 2, workDate: new Date('2026-09-18'), createdAt: new Date('2026-09-18') }]; } } };
  const result = await listProgressJournal(prisma, { projectId: 'project-a', recordId: 'record-a' });
  assert.equal(calls.length, 1); assert.equal(calls[0].where.projectId, 'project-a'); assert.equal(calls[0].where.id, 'record-a');
  assert.equal(result.dailyLogs.length, 1); assert.deepEqual(result.evidence, []); assert.equal(result.timeline.length, 1);
});
for (const filters of [{ recordId: '../other' }, { recordId: 'x', taskId: 'y' }, { recordId: 'x', unassigned: true }, { recordId: 'x', kind: 'EVIDENCE' }, { recordId: 'x', status: 'DRAFT' }, { recordId: 'x', before: '2026-01-01' }]) test('ambiguous focused-record filters denied: ' + JSON.stringify(filters), async () => {
  await assert.rejects(listProgressJournal({}, { projectId: 'project-a', ...filters }));
});
test('ordinary records do not add audit queries', async () => {
  const journal = { dailyLogs: [{ id: 'ordinary', status: 'DRAFT' }] };
  assert.equal(await withJournalCorrectionLinks({}, { projectId: 'project-a', journal }), journal);
});
test('permalink page fails closed and limits scope before rendering', () => {
  const source = fs.readFileSync(new URL('../src/app/dashboard/progress/page.js', import.meta.url), 'utf8');
  assert.match(source, /focusedRecordId && baseJournal.dailyLogs.length !== 1\) notFound/);
  assert.match(source, /recordId: focusedRecordId/); assert.match(source, /projectId: access.project.id/);
});
