import assert from 'node:assert/strict';
import test from 'node:test';
import { filterProgressLogs, progressJournalSummary, PROGRESS_LOG_FILTERS } from '../src/lib/progress-journal-view.js';

const rows = [
  { id:'log-a', title:'Hormigonado losa', summary:'Sector norte', workDate:'2026-09-25', status:'DRAFT', taskId:'task-a' },
  { id:'log-b', title:'Revisión armadura', summary:'Eje B', workDate:'2026-09-24', status:'SUBMITTED', taskId:null },
  { id:'log-c', title:'Cierre encofrado', summary:'Planta baja', workDate:'2026-09-23', status:'APPROVED', taskId:'task-c' },
  { id:'log-d', title:'Corrección de replanteo', summary:'Sector sur', workDate:'2026-09-22', status:'REJECTED', taskId:null },
];

test('summary counts only loaded authoritative rows', () => {
  assert.deepEqual(progressJournalSummary({ dailyLogs: rows, evidence:[{id:'e1'},{id:'e2'}] }), {
    records:4,drafts:1,inReview:1,approved:1,unassigned:2,evidence:2,
  });
  assert.deepEqual(progressJournalSummary(null), { records:0,drafts:0,inReview:0,approved:0,unassigned:0,evidence:0 });
});
for (const query of ['hormigon norte','HORMIGON','revisión','2026-09-24']) {
  test('literal accent-insensitive journal search: '+query, () => {
    const found=filterProgressLogs(rows,{query});
    assert.ok(found.length>=1);
  });
}
test('query and status combine without mutating source', () => {
  const before=structuredClone(rows);
  assert.deepEqual(filterProgressLogs(rows,{query:'armadura',status:'SUBMITTED'}).map(row=>row.id),['log-b']);
  assert.deepEqual(filterProgressLogs(rows,{status:'APPROVED'}).map(row=>row.id),['log-c']);
  assert.deepEqual(rows,before);
});
test('unassigned filter is explicit and compatible with search', () => {
  assert.deepEqual(filterProgressLogs(rows,{unassignedOnly:true}).map(row=>row.id),['log-b','log-d']);
  assert.deepEqual(filterProgressLogs(rows,{unassignedOnly:true,query:'sur'}).map(row=>row.id),['log-d']);
});
test('regex and markup are treated as literal search text', () => {
  for(const query of ['.*','[a-z]','<script>']) assert.equal(filterProgressLogs(rows,{query}).length,0);
});
test('unknown status produces no accidental matches', () => {
  assert.deepEqual(filterProgressLogs(rows,{status:'UNKNOWN'}),[]);
});
test('filter catalog matches the persisted journal decisions exposed by this view', () => {
  assert.deepEqual(PROGRESS_LOG_FILTERS.map(row=>row.value),['ALL','DRAFT','SUBMITTED','APPROVED','REJECTED']);
});
