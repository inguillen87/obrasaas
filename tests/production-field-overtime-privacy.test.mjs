import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldOvertime} from '../src/lib/field-overtime-store.mjs';
import {fieldOvertimeJourneyCursor} from '../src/lib/field-overtime-policy.mjs';

const project={id:'project-a',metadata:{}},scope='a'.repeat(64);
const actor=(id,role='AUDITOR')=>({actorId:'actor-'+id,organizationId:'organization-a',role});
const session=id=>({userId:'user-'+id});
function fixture({current='a',sourceActor='a',mixed=false,malformed=false}={}){
 const worker={id:'worker-shared',name:'Synthetic reassigned worker',active:true,metadata:{participant:{version:1,clerkUserId:'user-'+current,status:'ACTIVE',permissions:{attendance:true},kyc:{status:'APPROVED'}}}};
 const event=(id,type,index)=>({id,projectId:project.id,workerId:worker.id,sortAt:'2026-10-01T11:00:00.000000',metadata:{fieldOperations:{version:1,eventType:type,phase:'WORKING',shiftId:'shift-original',sequence:index,previousEventId:index===1?null:'attendance-start',recordedBy:'actor-'+sourceActor,recordedAt:index===1?'2026-10-01T10:00:00.000Z':'2026-10-01T11:00:00.000Z',verificationStatus:'VERIFIED',sectorName:'PRIVATE_ORIGINAL_SECTOR',review:null}}});
 const rows=[event('attendance-start','CHECK_IN',1),event('attendance-end','CHECK_OUT',2)];
 if(mixed)rows[0].metadata.fieldOperations.recordedBy='actor-other';
 if(malformed)rows[0].metadata.fieldOperations.previousEventId='missing-predecessor';
 const calls={writes:0,chain:0,overlap:0,history:0,list:0,cursor:0};
 const result=rows=>({rows:structuredClone(rows)});
 const client={async query(sql,args){
  assert.match(sql,/^SELECT /,'Reads cannot write business state');
  if(sql.includes('FROM public."Worker" WHERE id=$1'))return result(args[0]===worker.id&&args[1]===project.id?[worker]:[]);
  if(sql.includes('FROM public."AttendanceEntry" a JOIN public."Worker"')){
   if(sql.includes('WHERE a.id=$1')){
    calls.cursor++;const row=rows.find(value=>value.id===args[0]&&value.projectId===args[1]);
    return result(row?[{id:row.id,workerId:row.workerId,sortAt:row.sortAt,...(sql.includes('AS "recordedBy"')?{recordedBy:row.metadata.fieldOperations.recordedBy}:{})}]:[]);
   }
   calls.list++;
   // Evaluate the actual supported WHERE predicates and their bound values,
   // including an author predicate only when the production SQL supplies it.
   const author=sql.match(/a\.metadata->'fieldOperations'->>'recordedBy'=\$(\d+)/);
   return result(rows.filter(row=>row.metadata.fieldOperations.eventType==='CHECK_OUT'&&row.projectId===args[0]&&(!args[3]||row.sortAt<args[3]||row.sortAt===args[3]&&row.id<args[4])&&(args[1]||args[2].includes(row.workerId)&&(!author||row.metadata.fieldOperations.recordedBy===args[Number(author[1])-1]))).map(row=>({...row,name:worker.name})));
  }
  if(sql.includes('FROM public."AttendanceEntry" a JOIN public."Project"')){calls.overlap++;return result(rows.filter(row=>row.metadata.fieldOperations.recordedBy===args[1]));}
  if(sql.includes('FROM public."AuditLog"')){calls.history++;return result([]);}
  if(sql.includes('WHERE id=$1 AND "projectId"=$2'))return result(rows.filter(row=>row.id===args[0]&&row.projectId===args[1]));
  if(sql.includes('WHERE "projectId"=$1 AND "workerId"=$2')){calls.chain++;return result(rows.filter(row=>row.projectId===args[0]&&row.workerId===args[1]&&row.metadata.fieldOperations.shiftId===args[2]));}
  if(sql.includes('WHERE "projectId"=$1 AND metadata'))return result(rows.filter(row=>row.projectId===args[0]&&row.metadata.fieldOperations.shiftId===args[1]&&row.metadata.fieldOperations.eventType==='CHECK_IN'));
  throw new Error('Unexpected bounded fixture query: '+sql);
 }};
 const store=createFieldOvertime({assertWorker:async()=>{throw new Error('Read path must not perform a write authorization');}});
 const cursor=fieldOvertimeJourneyCursor(project.id,scope,rows[1]);
 return {store,client,calls,worker,rows,cursor,bind(id){worker.metadata.participant.clerkUserId='user-'+id;},read(id,context={},role='AUDITOR'){return store.readShift(client,actor(id,role),session(id),project,{closingEventId:'attendance-end',...context});},list(id,context={},role='AUDITOR'){return store.journeys(client,actor(id,role),session(id),project,[worker.id],{scope,...context});}};
}

for(const key of ['closingEventId','shiftId'])test('same worker reassigned to B cannot read A shift through '+key,async()=>{
 const f=fixture({current:'b'}),context=key==='closingEventId'?{closingEventId:'attendance-end'}:{closingEventId:undefined,shiftId:'shift-original'};
 await assert.rejects(f.read('b',context),{code:'OVERTIME_SHIFT_UNAVAILABLE',status:404});
 assert.deepEqual([f.calls.chain,f.calls.overlap,f.calls.history,f.calls.writes],[0,0,0,0],'Deny before private chain, cross-shift or history queries');
});

test('same-worker own list filters original actor rather than transferring A history to B',async()=>{
 const f=fixture({current:'b'}),page=await f.list('b');assert.deepEqual(page.journeys,[]);assert.equal(page.nextCursor,null);assert.equal(page.hasMore,false);assert.equal(f.calls.writes,0);
});

test('same-worker cursor cannot cross to a different original actor',async()=>{
 const f=fixture({current:'b'});await assert.rejects(f.list('b',{cursor:f.cursor}),{code:'FIELD_QUERY_INVALID'});assert.equal(f.calls.list,0);assert.equal(f.calls.writes,0);
});

test('current author A can read and page, loses access after reassignment, and can read again when restored',async()=>{
 const f=fixture(),own=await f.read('a');assert.equal(own.summary.recordedBy,'actor-a');assert.equal(own.summary.netMs,3600000);assert.equal(own.events.length,2);assert.equal((await f.list('a')).journeys.length,1);
 f.bind('b');await assert.rejects(f.read('a'),{code:'FIELD_PARTICIPANT_REQUIRED'});await assert.rejects(f.read('b'),{code:'OVERTIME_SHIFT_UNAVAILABLE'});assert.deepEqual((await f.list('b')).journeys,[]);
 f.bind('a');assert.equal((await f.read('a')).summary.netMs,3600000);assert.equal((await f.list('a')).journeys.length,1);assert.equal((await f.list('a',{cursor:f.cursor})).journeys.length,0);assert.equal(f.calls.writes,0);
});

for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER'])test(role+' keeps assigned-worksite review of the original author after reassignment',async()=>{
 const f=fixture({current:'b'}),detail=await f.read('reviewer',{},role);assert.equal(detail.summary.recordedBy,'actor-a');assert.equal(detail.events[0].sectorName,'PRIVATE_ORIGINAL_SECTOR');assert.equal((await f.list('reviewer',{},role)).journeys.length,1);assert.equal((await f.list('reviewer',{cursor:f.cursor},role)).journeys.length,0);assert.equal(f.calls.writes,0);
});

test('own detail rejects a mixed-author chain before cross-shift and history queries',async()=>{
 const f=fixture({mixed:true});await assert.rejects(f.read('a'),{code:'OVERTIME_SHIFT_UNAVAILABLE'});assert.equal(f.calls.chain,1);assert.equal(f.calls.overlap,0);assert.equal(f.calls.history,0);
});

test('a malformed chain entirely authored by the current account remains inspectable as integrity review',async()=>{
 const f=fixture({malformed:true}),detail=await f.read('a');assert.equal(detail.summary.status,'INTEGRITY_REVIEW_REQUIRED');assert.equal(detail.canPropose,false);assert.equal(detail.events.length,2);assert.equal(f.calls.writes,0);
});

test('different worker, project and cursor scope remain unavailable',async()=>{
 const f=fixture();await assert.rejects(f.store.readShift(f.client,actor('a'),session('a'),{id:'other-project',metadata:{}},{closingEventId:'attendance-end'}),{code:'OVERTIME_SHIFT_UNAVAILABLE'});
 const otherCursor=fieldOvertimeJourneyCursor('other-project',scope,f.rows[1]);await assert.rejects(f.list('a',{cursor:otherCursor}),{code:'FIELD_QUERY_INVALID'});
 const foreignScope=fieldOvertimeJourneyCursor(project.id,'b'.repeat(64),f.rows[1]);await assert.rejects(f.list('a',{cursor:foreignScope}),{code:'FIELD_QUERY_INVALID'});
 await assert.rejects(f.store.journeys(f.client,actor('a'),session('a'),project,['different-worker'],{scope,cursor:f.cursor}),{code:'FIELD_QUERY_INVALID'});assert.equal(f.calls.writes,0);
});

test('revoked current attendance access and channel-only calls keep their existing denials',async()=>{
 const f=fixture();f.worker.metadata.participant.permissions.attendance=false;await assert.rejects(f.read('a'),{code:'FIELD_PARTICIPANT_REQUIRED'});
 const member={...actor('a'),channelProof:{provider:'synthetic-existing-channel'}};
 await assert.rejects(f.store.readShift(f.client,member,session('a'),project,{closingEventId:'attendance-end'}),{code:'OVERTIME_WEB_ONLY'});
 await assert.rejects(f.store.journeys(f.client,member,session('a'),project,[f.worker.id],{scope}),{code:'OVERTIME_WEB_ONLY'});assert.equal(f.calls.writes,0);
});
