import assert from 'node:assert/strict';
import test from 'node:test';
import { readTaskRestrictionStatus } from '../src/lib/task-restriction-status.js';
import { listProjectExecution } from '../src/lib/project-execution.js';
const scope = { organizationId: 'org-a', projectId: 'project-a', taskIds: ['task-a','task-b'], now: new Date('2026-09-19T12:00:00Z') };
const group = (taskId, status, severity, count, dueAt = null) => ({ taskId, status, severity, _count: { _all: count }, _min: { dueAt }, _max: { updatedAt: new Date('2026-09-19T10:00:00Z') } });
function db(groups = []) { const calls=[]; return { calls, tx: { projectBlocker: { groupBy: async options => { calls.push(options); return groups; } } } }; }
test('aggregates active and terminal restrictions without inventing task progress', async () => {
  const { tx } = db([group('task-a','OPEN','CRITICAL',2), group('task-a','IN_PROGRESS','HIGH',3), group('task-a','RESOLVED','CRITICAL',8), group('task-a','CANCELLED','HIGH',1)]);
  const rows = await readTaskRestrictionStatus(tx,scope), row = rows.get('task-a');
  assert.equal(row.active,5);assert.equal(row.open,2);assert.equal(row.inProgress,3);assert.equal(row.critical,2);assert.equal(row.high,3);assert.equal(row.resolved,8);assert.equal(row.cancelled,1);
  assert.equal(rows.get('task-b').active,0);assert.ok(!('progress' in row));
});
test('all visible tasks share one bounded aggregation with company and project scope', async () => {
  const { tx,calls }=db(); const taskIds=Array.from({length:50},(_,i)=>'task-'+i);await readTaskRestrictionStatus(tx,{...scope,taskIds});
  assert.equal(calls.length,1);assert.deepEqual(calls[0].where,{projectId:'project-a',project:{organizationId:'org-a'},taskId:{in:taskIds}});
  assert.deepEqual(calls[0].by,['taskId','status','severity']);assert.equal(calls[0]._min.dueAt,true);
  assert.ok(!JSON.stringify(calls).includes('description'));assert.ok(!JSON.stringify(calls).includes('ownerWorkerId'));
});
test('closed restrictions do not keep an expired active warning', async () => {
  const {tx}=db([group('task-a','RESOLVED','CRITICAL',1,'2025-01-01'),group('task-a','OPEN','LOW',1,'2026-09-20')]);
  const row=(await readTaskRestrictionStatus(tx,scope)).get('task-a');assert.equal(row.overdue,false);assert.equal(row.earliestDueAt,'2026-09-20T00:00:00.000Z');
});
test('deadline warning uses the supplied observation time and not an estimated delay', async () => {
  const {tx}=db([group('task-a','OPEN','MEDIUM',1,'2026-09-19T12:00:00Z')]);
  assert.equal((await readTaskRestrictionStatus(tx,scope)).get('task-a').overdue,false);
  const row=(await readTaskRestrictionStatus(tx,{...scope,now:new Date('2026-09-19T12:00:01Z')})).get('task-a');assert.equal(row.overdue,true);assert.ok(!('delayDays' in row));
});
test('empty task page does not query or seed restrictions', async () => {
  const {tx,calls}=db();const result=await readTaskRestrictionStatus(tx,{...scope,taskIds:[]});assert.equal(result.size,0);assert.equal(calls.length,0);
});
for(const change of [{organizationId:''},{projectId:'../other'},{taskIds:['task-a','task-a']},{taskIds:Array.from({length:51},(_,i)=>'task-'+i)},{taskIds:['../x']},{now:'invalid'}]) {
  test('invalid or unbounded context fails before query: '+Object.keys(change)[0],async()=>{await assert.rejects(readTaskRestrictionStatus({}, {...scope,...change}));});
}
for(const value of [group('foreign-task','OPEN','HIGH',1),group('task-a','IMAGINARY','HIGH',1),group('task-a','OPEN','FAKE',1),group('task-a','OPEN','HIGH',-1),group('task-a','OPEN','HIGH',1,'not-a-date')]) {
  test('inconsistent aggregate cannot become a healthy zero: '+JSON.stringify([value.taskId,value.status,value.severity,value._count._all,value._min.dueAt]),async()=>{await assert.rejects(readTaskRestrictionStatus(db([value]).tx,scope));});
}
test('database failure remains a failure rather than an empty result',async()=>{await assert.rejects(readTaskRestrictionStatus({projectBlocker:{groupBy:async()=>{throw new Error('QUERY_UNAVAILABLE');}}},scope),/QUERY_UNAVAILABLE/);});
function executionDb(found=true){
 const calls=[];return{calls,prisma:{task:{findFirst:async({where})=>{calls.push(['task',where]);return found?{id:'task-a',title:'Muro de ensayo',type:'TASK'}:null;}},
 workTeam:{findMany:async({where})=>{calls.push(['teams',where]);return[];}},taskAssignment:{findMany:async({where})=>{calls.push(['assignments',where]);return[];}},projectBlocker:{findMany:async({where})=>{calls.push(['blockers',where]);return[];}}}};
}
test('task-focused execution reads only its restrictions and assignments',async()=>{
 const {prisma,calls}=executionDb();const result=await listProjectExecution(prisma,{projectId:'project-a',taskId:'task-a'});
 assert.equal(result.focusedTask.id,'task-a');assert.deepEqual(calls.find(([kind])=>kind==='blockers')[1],{projectId:'project-a',taskId:'task-a'});
 assert.deepEqual(calls.find(([kind])=>kind==='assignments')[1],{projectId:'project-a',taskId:'task-a'});assert.deepEqual(calls.find(([kind])=>kind==='teams')[1],{projectId:'project-a'});
 assert.equal(calls[0][1].metadata.equals,'canonical-task-v1');
});
test('task from another scope is not replaced by the first task or full list',async()=>{
 const {prisma,calls}=executionDb(false);await assert.rejects(listProjectExecution(prisma,{projectId:'project-a',taskId:'outside'}),{status:404});assert.equal(calls.length,1);
});
test('ordinary execution view retains its previous unfiltered contract',async()=>{
 const {prisma,calls}=executionDb();const result=await listProjectExecution(prisma,{projectId:'project-a'});assert.equal(result.focusedTask,undefined);assert.equal(calls.length,3);assert.ok(calls.every(([,where])=>!('taskId' in where)));
});
