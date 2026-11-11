import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedProgressHistory,approvedProgressPage,approvedProgressContext,APPROVED_PROGRESS_LIMITS} from '../src/lib/approved-progress-curve.mjs';
import {createApprovedProgressCurveReader,APPROVED_PROGRESS_SOURCE_SQL} from '../src/lib/approved-progress-curve-store.mjs';
import {confirmedApprovedProgressPage,mergeApprovedProgressPage,createApprovedProgressRead} from '../src/app/(identity)/cuenta/approved-progress-curve-view.mjs';
import {sourcePair,context,clone} from './fixtures/approved-progress-curve-fixture.mjs';
const fail=fn=>assert.throws(fn,e=>typeof e.code==='string'&&e.code.startsWith('APPROVED_PROGRESS_'));
const read=rows=>approvedProgressHistory(rows,context),page=rows=>approvedProgressPage(read(rows),context),deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
test('an execution cannot turn its own issuer into an independent authorization',()=>{const rows=sourcePair({kind:'EXECUTION'}),actor=rows[0].metadata.outcome.execution.executedBy;rows[0].metadata.outcome.execution.authorizedBy=actor;rows[1].action.authorizedBy=actor;rows[1].result.authorization.issuedBy=actor;fail(()=>read(rows));});

test('human measured history uses public historical snapshot and approval date without exporting people or free text',()=>{
 const rows=sourcePair(),result=page(rows);assert.equal(result.rows.length,1);assert.equal(result.rows[0].progress,25);assert.deepEqual(result.rows[0].measurement,{definitionId:'measurement_curve',executed:'25.0000',baseline:'100.0000',unit:'M2'});assert.equal(result.rows[0].at,'2026-10-20T13:00:00.000Z');assert.equal(result.rows[0].origin,'HUMAN_APPROVAL');assert.equal(result.beforeFirst,'UNOBSERVED');assert(!JSON.stringify(result).includes('reviewer_curve'));assert(!JSON.stringify(result).includes('Private synthetic'));assert.equal(confirmedApprovedProgressPage(result,context),result);
});
test('mandate execution pairs one proposal and original execution audit; wrapper is not a second point',()=>{
 const result=page(sourcePair({kind:'EXECUTION'}));assert.equal(result.rows.length,1);assert.equal(result.rows[0].origin,'AUTHORIZED_EXECUTION');assert.equal(result.rows[0].timeMeaning,'AUTHORIZED_RECORDED_AT');assert.equal(result.rows[0].executionId,'execution_curve_1');assert.equal(result.rows[0].measurement.executed,'25.0000');assert.equal(confirmedApprovedProgressPage(result,context),result);
});
test('successive cumulative snapshots are not summed and preserve separate source origins',()=>{
 const first=sourcePair(),second=sourcePair({kind:'EXECUTION',index:2,executed:'40.0000',previous:'25.0000',at:'2026-10-21T13:00:00.000Z'}),result=page([...second,...first]);assert.deepEqual(result.rows.map(p=>p.measurement.executed),['25.0000','40.0000']);assert.deepEqual(result.rows.map(p=>p.progress),[25,40]);assert.deepEqual(result.rows.map(p=>p.segment),[0,0]);
});
test('legacy percentage remains percentage only and an empty retained history does not assert zero progress',()=>{
 const result=page(sourcePair({legacy:true}));assert.equal(result.rows[0].progress,25);assert.equal(result.rows[0].measurement,null);const empty=page([]);assert.deepEqual(empty.rows,[]);assert.equal(empty.total,0);assert.equal(empty.beforeFirst,'UNOBSERVED');assert.equal(empty.sourceScanComplete,true);
});
test('changed measured definition opens a separate segment without inventing monetary weights',()=>{
 const result=page([...sourcePair(),...sourcePair({kind:'EXECUTION',index:2,definitionId:'measurement_other',baseline:'200.0000',executed:'10.0000',at:'2026-10-21T13:00:00.000Z'})]);assert.deepEqual(result.rows.map(p=>p.segment),[0,1]);assert.deepEqual(result.rows.map(p=>p.progress),[25,5]);assert(!Object.keys(result).some(k=>/cost|money|paid|earned|globalProgress/i.test(k)));
});
test('identical duplicate source representation is deduplicated while contradictory duplicate is incomplete',()=>{
 const pair=sourcePair();assert.equal(read([...pair,...clone(pair)]).points.length,1);const wrong=clone(pair[0]);wrong.metadata.outcome.task.progress=99;fail(()=>read([...pair,wrong]));
});
test('orphan proposal, orphan receipt, two receipts for one proposal and unsupported writer all fail closed',()=>{
 const pair=sourcePair();fail(()=>read([pair[0]]));fail(()=>read([pair[1]]));const second=clone(pair[0]);second.id='field_'+'f'.repeat(64);fail(()=>read([...pair,second]));const unsupported=clone(pair);unsupported[1].sourceProvider='unknown-source';fail(()=>read(unsupported));
});
test('actor, project, organization, worker and request commitment contradictions cannot become approved history',()=>{
 for(const change of [r=>r[0].actorId='foreign_actor',r=>r[0].organizationId='foreign_org',r=>r[0].projectId='foreign_project',r=>r[1].proposedByWorkerId='foreign_worker',r=>r[0].metadata.requestDigest='bad',r=>r[1].action.submittedBy='reviewer_curve']){const rows=sourcePair();change(rows);fail(()=>read(rows));}
 for(const change of [r=>r[0].actorId='foreign_actor',r=>r[0].metadata.actorId='foreign_actor',r=>r[1].action.submittedBy='foreign_actor',r=>r[1].proposedByWorkerId='foreign_worker']){const rows=sourcePair({kind:'EXECUTION'});change(rows);fail(()=>read(rows));}
});
test('forged or regressive quantities and public snapshot contradictions fail without using current Task',()=>{
 for(const change of [r=>r[1].action.quantity='26.0000',r=>r[0].metadata.outcome.task.measurement.executed='26.0000',r=>r[1].action.measurement.previous='30.0000']){const rows=sourcePair();change(rows);fail(()=>read(rows));}
 fail(()=>read([...sourcePair(),...sourcePair({index:2,executed:'20.0000',at:'2026-10-21T13:00:00.000Z'})]));
});
test('a measured approval cannot predate its own historical definition',()=>{
 const rows=sourcePair(),future='2026-10-21T12:00:00.000Z';rows[0].metadata.outcome.task.measurement.configuredAt=future;rows[1].result.fieldOperations.task.measurement.configuredAt=future;fail(()=>read(rows));
});
test('page cursor and merge bind complete history snapshot, context and contiguous pages',()=>{
 const rows=Array.from({length:101},(_,i)=>sourcePair({index:i+1,executed:String(i+1)+'.0000',baseline:'1000.0000',at:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()})).flat(),history=read(rows),first=approvedProgressPage(history,context);assert.equal(first.rows.length,100);assert(first.nextCursor);const next=approvedProgressPage(history,{...context,cursor:first.nextCursor});assert.equal(next.rows.length,1);const merged=mergeApprovedProgressPage(mergeApprovedProgressPage(null,first,context),next,context);assert.equal(merged.rows.length,101);assert.equal(merged.complete,true);fail(()=>approvedProgressPage(history,{...context,scope:'d'.repeat(64),cursor:first.nextCursor}));fail(()=>approvedProgressPage({...history,snapshot:'e'.repeat(64)},{...context,cursor:first.nextCursor}));assert.throws(()=>mergeApprovedProgressPage(null,next,context));assert.throws(()=>mergeApprovedProgressPage({...first,rows:first.rows.slice(1)},next,context));
});
test('a source limit or malformed scope query never returns an invented partial curve',()=>{
 fail(()=>read(new Array(APPROVED_PROGRESS_LIMITS.sourceRows+1).fill(null)));for(const value of [{...context,organizationId:undefined},{projectId:context.projectId,scope:context.scope,taskId:context.taskId,cursor:''},{projectId:'../bad',scope:context.scope,taskId:context.taskId}])fail(()=>approvedProgressContext(value));
});
function readerHarness(rows,{role='ADMIN',scope=context.scope,taskPresent=true}={}){
 const queries=[],session={authenticated:true,userId:'user_Curve'},workspace={async projectOperation(seen,input,writable,fn){assert.equal(seen,session);assert.equal(writable,false);return fn({async query(sql,values){assert(!/\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql));queries.push({sql,values});return sql==='SELECT id FROM public."Task" WHERE id=$1 AND "projectId"=$2'?{rows:taskPresent?[{id:context.taskId}]:[]}:{rows};}},{organizationId:context.organizationId,role},scope,{id:context.projectId});}};
 return{queries,read:()=>createApprovedProgressCurveReader({workspace,canReview:r=>['ADMIN','DIRECTOR','SITE_MANAGER'].includes(r)})(session,{projectId:context.projectId,scope:context.scope,taskId:context.taskId})};
}
test('reader uses one canonical read-only transaction, exact task lookup and both bounded source writers',async()=>{
 const h=readerHarness(sourcePair()),result=await h.read();assert.equal(result.state,'CONFIRMED');assert.equal(h.queries.length,2);assert.equal(h.queries[1].sql,APPROVED_PROGRESS_SOURCE_SQL);assert.deepEqual(h.queries[1].values,[context.organizationId,context.projectId,context.taskId,10001]);assert(h.queries[1].sql.includes('UNION ALL'));assert(h.queries[1].sql.includes('"actorId"'));assert(h.queries[1].sql.includes('"proposedByWorkerId"'));assert(!/SELECT .*progress\b/i.test(h.queries[0].sql));
});
test('reader denies wrong authority, task and scope before any history scan',async()=>{
 for(const [options,code]of [[{role:'WORKER'},'APPROVED_PROGRESS_PERMISSION_REQUIRED'],[{scope:'d'.repeat(64)},'WORKSPACE_CONTEXT_CHANGED'],[{taskPresent:false},'WORKSPACE_TASK_UNAVAILABLE']]){const h=readerHarness(sourcePair(),options);await assert.rejects(h.read,e=>e.code===code);assert(h.queries.length<2);}
});
test('reader reports INCOMPLETE with no partial points for corrupt pairs or bounded overflow',async()=>{
 for(const rows of [[sourcePair()[1]],new Array(10001).fill(null)]){const h=readerHarness(rows),result=await h.read();assert.equal(result.state,'INCOMPLETE');assert.equal(result.total,null);assert.deepEqual(result.rows,[]);assert.equal(result.nextCursor,null);assert.equal(confirmedApprovedProgressPage(result,context),result);}
});
test('browser reader ignores late response after scope or task change and after disposal',async()=>{
 const hold=deferred(),states=[],current={...context,key:'initial',eligible:true};let captured;
 const service=createApprovedProgressRead({request:(url,options)=>{captured={url,options};return hold.promise;},getContext:()=>current,onState:s=>states.push(s)}),pending=service.read();assert(captured.url.includes('progressCurveTaskId=task_curve'));current.taskId='task_other';service.invalidate();hold.resolve(page(sourcePair()));await pending;assert.equal(states.at(-1).value,null);
 const hold2=deferred(),states2=[],service2=createApprovedProgressRead({request:()=>hold2.promise,getContext:()=>({...context,key:'same',eligible:true}),onState:s=>states2.push(s)}),pending2=service2.read();service2.dispose();hold2.resolve(page(sourcePair()));await pending2;assert.equal(states2.length,1);
});
test('browser reader retries only GET, rejects malformed pages and withdraws on a current denial',async()=>{
 const states=[],denials=[];let calls=0;const service=createApprovedProgressRead({request:async(url,options,readResponse)=>{assert.equal(options.method,undefined);calls++;return readResponse(new Response(JSON.stringify({code:'WORKSPACE_MEMBERSHIP_REQUIRED'}),{status:403,headers:{'Content-Type':'application/json'}}));},getContext:()=>({...context,key:'current',eligible:true}),onState:s=>states.push(s),onAccessDenied:e=>denials.push(e)});await service.read();assert.equal(calls,1);assert.equal(denials.length,1);assert.equal(states.at(-1).value,null);await service.read();assert.equal(calls,2);assert.throws(()=>confirmedApprovedProgressPage({...page(sourcePair()),scope:'d'.repeat(64)},context));
});
