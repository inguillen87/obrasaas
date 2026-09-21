import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as pause } from 'node:timers/promises';
import { readAssignmentReviewLabels } from '../src/lib/assignment-review-labels.js';
const scope={organizationId:'org-a',projectId:'project-a'};
const rows=[{id:'a',projectId:'project-a',taskId:'task-a',workerId:'worker-a',teamId:null},{id:'b',projectId:'project-a',taskId:'task-b',workerId:null,teamId:'team-a'}];
function fixture(transform=(kind,records)=>records){
  let pending=false;const calls=[];
  const model=(kind,textField)=>({findMany:async options=>{
    assert.equal(pending,false,'Do not dispatch the next relation query before the previous completes.');pending=true;
    calls.push({kind,options});assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,options.where.id.in.length);
    try{await pause(2);return transform(kind,options.where.id.in.map(id=>({id,projectId:scope.projectId,[textField]:kind+' '+id})));}finally{pending=false;}
  }});
  return {calls,tx:{task:model('task','title'),worker:model('worker','name'),workTeam:model('team','name')}};
}
test('overlap labels are read sequentially with exact IDs and unchanged input',async()=>{
  const {calls,tx}=fixture();const before=structuredClone(rows);const result=await readAssignmentReviewLabels(tx,scope,rows);
  assert.deepEqual(calls.map(row=>row.kind),['task','worker','team']);assert.equal(result[0].task.title,'task task-a');assert.equal(result[0].worker.name,'worker worker-a');assert.equal(result[0].team,null);assert.equal(result[1].team.name,'team team-a');assert.deepEqual(rows,before);
});
test('repeated assignment references are batched, not read once per assignment',async()=>{
  const {calls,tx}=fixture();const input=Array.from({length:1000},(_,i)=>({...rows[i%2],id:'a-'+i}));await readAssignmentReviewLabels(tx,scope,input);
  assert.equal(calls.length,3);assert.deepEqual(calls.map(row=>row.options.take),[2,1,1]);
});
test('an empty assignment set issues no label queries',async()=>{const {calls,tx}=fixture();assert.deepEqual(await readAssignmentReviewLabels(tx,scope,[]),[]);assert.equal(calls.length,0);});
test('foreign assignment input is rejected before data access',async()=>{const {calls,tx}=fixture();await assert.rejects(readAssignmentReviewLabels(tx,scope,[{...rows[0],projectId:'other'}]),{code:'ASSIGNMENT_REVIEW_INCONSISTENT'});assert.equal(calls.length,0);});
for(const transform of [records=>records.slice(1),records=>records.map(row=>({...row,projectId:'other'})),records=>records.map(row=>({...row,id:'foreign'})),records=>records.map(row=>({...row,title:null}))])test('missing or wrong task labels stop later reads',async()=>{
  const {calls,tx}=fixture((kind,records)=>kind==='task'?transform(records):records);await assert.rejects(readAssignmentReviewLabels(tx,scope,rows),{code:'ASSIGNMENT_REVIEW_INCONSISTENT'});assert.deepEqual(calls.map(row=>row.kind),['task']);
});
test('provider query failure prevents the remaining relation reads',async()=>{
  const {calls,tx}=fixture((kind,records)=>{if(kind==='worker')throw new Error('isolated lookup failure');return records;});await assert.rejects(readAssignmentReviewLabels(tx,scope,rows),/isolated lookup failure/);assert.deepEqual(calls.map(row=>row.kind),['task','worker']);
});
