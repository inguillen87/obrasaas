import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,WORKSPACE_RECOVERY_PREFIX} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),otherScope='b'.repeat(64),projectId='project-plan',operationId='01234567-89ab-4cde-8fab-0123456789ab',secondId='01234567-89ab-4cde-8fab-0123456789ac';
const endpoint='/api/identity/plan-import';
function storage(seed=[]) {const rows=new Map(seed);return {get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const journal=store=>createWorkspaceRecoveryJournal({getStorage:()=>store,now:()=>123});
const command=(extra={})=>({method:'POST',body:JSON.stringify({operationId,scope,projectId,action:'APPLY',draftId:'private-draft',rows:[{title:'Private construction plan',evidence:'private evidence'}],reason:'Private reason',...extra})});
const draft=status=>({id:'draft-plan',revision:3,status,rows:[]});
const recorded=(status='READY')=>({scope,projectId,state:'RECORDED',draft:draft(status)});
const rejection=()=>({scope,projectId,operationId,saved:false,state:'REJECTED',definitive:true,reservationStarted:false,phase:'PRE_RESERVATION',code:'PLAN_IMPORT_FILE_INVALID'});

test('plan FormData is durably reserved before dispatch and restart keeps only minimal scoped references',async()=>{
 const store=storage(),j=journal(store),form=new FormData();for(const [key,value] of Object.entries({scope,projectId,operationId,consent:'plan-document-openai-v1'}))form.append(key,value);form.append('file',new Blob(['private source bytes'],{type:'application/pdf'}),'private-schedule.pdf');
 let posts=0;const lifecycle=createWorkspaceRequestLifecycle(async()=>'private-token',{journal:j,fetchImpl:async()=>{posts++;assert.equal((await j.list(scope)).length,1);throw new TypeError('Lost confirmation');}});
 await assert.rejects(lifecycle.request(endpoint,{method:'POST',body:form}),TypeError);assert.equal(posts,1);
 const fresh=journal(storage(store.rows)),entry=(await fresh.list(scope))[0];assert.deepEqual(Object.keys(entry).sort(),['createdAt','operationId','projectId','resource','scope','version']);assert.equal(entry.resource,'plan-import');assert.equal(await fresh.list(otherScope).then(rows=>rows.length),0);
 assert.doesNotMatch(JSON.stringify([...store.rows]),/private-|source bytes|consent|file|rows|reason|draftId/);assert.ok(store.key(0).startsWith(WORKSPACE_RECOVERY_PREFIX));
 await assert.rejects(fresh.prepare(endpoint,command({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED',requestDispatched:false});
 assert.ok(await fresh.prepare(endpoint,command({projectId:'another-project',operationId:secondId})));assert.ok(await fresh.prepare(endpoint,command({scope:otherScope,operationId:secondId})));lifecycle.abort();
});

test('plan dispatched 403 and 409 preserve references and deny a fresh UUID after reload',async()=>{
 for(const status of [403,409]){
  const store=storage(),j=journal(store);let posts=0;const lifecycle=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>{posts++;return Response.json({code:status===403?'PLAN_IMPORT_PERMISSION_REQUIRED':'WORKSPACE_CONTEXT_CHANGED'},{status});}});
  await assert.rejects(lifecycle.request(endpoint,command(),async response=>{throw Object.assign(new Error('Access changed after reservation'),{status:response.status});}));
  const fresh=journal(storage(store.rows));assert.equal((await fresh.list(scope)).length,1);await assert.rejects(fresh.prepare(endpoint,command({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});assert.equal(posts,1);lifecycle.abort();
 }
});

test('plan token failure before dispatch releases only a new reservation, never an existing uncertain reference',async()=>{
 for(const existing of [false,true]){
  const j=journal(storage());if(existing)await j.prepare(endpoint,command());let posts=0;
  const lifecycle=createWorkspaceRequestLifecycle(async()=>null,{journal:j,fetchImpl:async()=>{posts++;}});
  await assert.rejects(lifecycle.request(endpoint,command()),error=>error.requestDispatched===false);assert.equal((await j.list(scope)).length,existing?1:0);assert.equal(posts,0);lifecycle.abort();
 }
});

test('NOT_OBSERVED and non-receipt draft reads never resolve a plan attempt; terminal exact GET permits a new command',async()=>{
 const j=journal(storage()),ticket=await j.prepare(endpoint,command()),url=recoveryQuery(ticket.entry);
 assert.equal(url,endpoint+'?'+new URLSearchParams({projectId,scope,operationId}));
 for(const result of [{scope,projectId,state:'NOT_OBSERVED',definitive:false},recorded('UPLOADING'),recorded('PROCESSING'),{...recorded(),scope:otherScope},{...recorded(),projectId:'other-project'},{...recorded(),draft:{...draft('READY'),revision:0}},{scope,projectId,state:'RECORDED',saved:true,receiptId:'unrelated'}]){
  await j.observe(url,result);assert.equal((await j.list(scope)).length,1);
 }
 await j.observe(endpoint+'?'+new URLSearchParams({scope,projectId,draftId:'draft-plan'}),recorded());assert.equal((await j.list(scope)).length,1);
 await assert.rejects(j.prepare(endpoint,command({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 await j.observe(url,recorded());assert.equal((await j.list(scope)).length,0);assert.ok(await j.prepare(endpoint,command({operationId:secondId})));
});

test('only confirmed plan draft or decision outcomes settle POST, retaining in-progress upload and malformed receipts',async()=>{
 for(const status of ['READY','FAILED','APPLIED','REJECTED']){
  const j=journal(storage()),ticket=await j.prepare(endpoint,command());await j.settle(ticket,{...recorded(status),state:undefined,saved:true});assert.equal((await j.list(scope)).length,0);
 }
 for(const action of ['EDIT','APPLY','REJECT']){
  const j=journal(storage()),ticket=await j.prepare(endpoint,command()),result={...recorded({EDIT:'READY',APPLY:'APPLIED',REJECT:'REJECTED'}[action]),saved:true,receiptId:'receipt-plan',action,tasks:[]};
  assert.equal(recoveryResult(ticket.entry,{...result,draft:draft('PROCESSING')}),null);await j.settle(ticket,{...result,projectId:'other-project'});assert.equal((await j.list(scope)).length,1);await j.settle(ticket,result);assert.equal((await j.list(scope)).length,0);
 }
 const j=journal(storage()),ticket=await j.prepare(endpoint,command());await j.settle(ticket,{...recorded('PROCESSING'),saved:true});assert.equal((await j.list(scope)).length,1);
});

test('legacy session migration commits the canonical reference before deleting only the matching safe reference',async()=>{
 const key='obrasaas-plan-attempt-v1:'+scope+':'+projectId,legacy=storage([[key,JSON.stringify({scope,projectId,operationId,kind:'UPLOAD'})]]),store=storage(),j=journal(store);
 await j.migratePlanImportAttempt(scope,projectId,legacy);assert.equal(legacy.getItem(key),null);assert.equal((await j.list(scope))[0].operationId,operationId);
 assert.doesNotMatch(JSON.stringify([...store.rows]),/kind|UPLOAD/);
 for(const altered of [{scope:otherScope,projectId,operationId,kind:'UPLOAD'},{scope,projectId,operationId,kind:'UPLOAD',source:'private'},{scope,projectId,operationId:'invalid',kind:'DECISION'}]){
  const raw=JSON.stringify(altered);legacy.setItem(key,raw);await assert.rejects(j.migratePlanImportAttempt(scope,projectId,legacy),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});assert.equal(legacy.getItem(key),raw);
 }
 legacy.setItem(key,JSON.stringify({scope,projectId,operationId:secondId,kind:'DECISION'}));await assert.rejects(j.migratePlanImportAttempt(scope,projectId,legacy),{code:'WORKSPACE_RECOVERY_REQUIRED'});assert.ok(legacy.getItem(key));assert.equal((await j.list(scope)).length,1);
 const current=(await j.list(scope))[0];await j.observe(recoveryQuery(current),recorded());
 await j.migratePlanImportAttempt(scope,projectId,legacy);assert.equal((await j.list(scope))[0].operationId,secondId);assert.equal(legacy.getItem(key),null);
 await assert.rejects(j.prepare(endpoint,command()),{code:'WORKSPACE_RECOVERY_REQUIRED'});
});

test('the real POST parser proves scoped source rejection before attach; corrected source is an explicit new operation',async()=>{
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Fixture',organizationId:'org_Fixture',organizationRole:'org:admin'};let attaches=0;
 const handlers=createPlanImportHandlers({verify:async()=>session,imports:{attach:async(_session,input)=>{attaches++;assert.equal(input.operationId,secondId);assert.equal(input.source.bytes.toString(),'%PDF-1.7\nCorrected synthetic source\n%%EOF');return {scope,projectId,saved:true,draft:draft('READY')};}}});
 const sourceRequest=(operation,bytes,extra={})=>{const form=new FormData();for(const [key,value] of Object.entries({scope,projectId,operationId:operation,consent:'plan-document-openai-v1',...extra}))form.append(key,value);form.append('file',new Blob([bytes],{type:'application/pdf'}),'fixture.pdf');return new Request('https://obrasaas.com'+endpoint,{method:'POST',headers:{Origin:'https://obrasaas.com'},body:form});};
 const rejected=await handlers.POST(sourceRequest(operationId,'Invalid PDF source'));assert.equal(rejected.status,400);assert.deepEqual(await rejected.json(),rejection());assert.equal(attaches,0);
 const forged=await handlers.POST(sourceRequest(operationId,'Invalid PDF source',{phase:'PRE_RESERVATION'}));assert.equal((await forged.json()).definitive,undefined);assert.equal(attaches,0);
 const invalidScope=await handlers.POST(sourceRequest(operationId,'Invalid PDF source',{scope:'invalid'}));assert.equal((await invalidScope.json()).definitive,undefined);assert.equal(attaches,0);
 const corrected=await handlers.POST(sourceRequest(secondId,'%PDF-1.7\nCorrected synthetic source\n%%EOF'));assert.equal(corrected.status,200);assert.equal((await corrected.json()).saved,true);assert.equal(attaches,1);
 const ambiguous=createPlanImportHandlers({verify:async()=>session,imports:{attach:async()=>{throw Object.assign(new WorkspaceError('PLAN_IMPORT_FILE_INVALID',400),rejection());}}});
 const storeError=await ambiguous.POST(sourceRequest(secondId,'%PDF-1.7\nCorrected synthetic source\n%%EOF'));assert.equal((await storeError.json()).definitive,undefined,'Only the private parser marker may prove pre-reservation rejection');
});

test('exact pre-reservation rejection releases a new ticket only; previous uncertainty and malformed markers persist',async()=>{
 for(const existed of [false,true]){
  const j=journal(storage());if(existed)await j.prepare(endpoint,command());const ticket=await j.prepare(endpoint,command());
  await j.settle(ticket,null,{status:400,code:'PLAN_IMPORT_FILE_INVALID',result:rejection()});assert.equal((await j.list(scope)).length,existed?1:0);
  if(existed){await j.observe(recoveryQuery(ticket.entry),rejection());assert.equal((await j.list(scope)).length,1);await assert.rejects(j.prepare(endpoint,command({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});}else assert.ok(await j.prepare(endpoint,command({operationId:secondId})));
 }
 for(const result of [{...rejection(),operationId:secondId},{...rejection(),scope:otherScope},{...rejection(),projectId:'other-project'},{...rejection(),phase:undefined},{...rejection(),reservationStarted:true},{...rejection(),source:'private'},{scope,projectId,operationId,saved:false,code:'PLAN_IMPORT_FILE_INVALID'}]){
  const j=journal(storage()),ticket=await j.prepare(endpoint,command());await j.settle(ticket,null,{status:400,code:'PLAN_IMPORT_FILE_INVALID',result});assert.equal((await j.list(scope)).length,1);
 }
});

test('a conflicting legacy adoption never recursively invalidates its own reader',async()=>{
 const store=storage(),key='obrasaas-plan-attempt-v1:'+scope+':'+projectId,legacy=storage([[key,JSON.stringify({scope,projectId,operationId:secondId,kind:'UPLOAD'})]]);let notifications=0;
 const j=createWorkspaceRecoveryJournal({getStorage:()=>store,notify:()=>{notifications++;}});await j.prepare(endpoint,command());assert.equal(notifications,1);
 await assert.rejects(j.migratePlanImportAttempt(scope,projectId,legacy),{code:'WORKSPACE_RECOVERY_REQUIRED'});assert.equal(notifications,1);
 const current=(await j.list(scope))[0];await j.observe(recoveryQuery(current),recorded());assert.equal(notifications,2);
 await j.migratePlanImportAttempt(scope,projectId,legacy);assert.equal(notifications,3);assert.equal((await j.list(scope))[0].operationId,secondId);
});

test('only an exact scoped GET with a canonical expired lease resolves a pending extraction reference',async()=>{
 const j=journal(storage()),ticket=await j.prepare(endpoint,command()),other=await j.prepare(endpoint,command({projectId:'other-project',operationId:secondId}));
 const result={scope,projectId,operationId,state:'EXPIRED',saved:false,definitive:true,draft:{...draft('PROCESSING'),processingExpired:true,processingExpiresAt:new Date(Date.now()-1000).toISOString()}};
 for(const altered of [{...result,scope:otherScope},{...result,operationId:secondId},{...result,projectId:'other-project'},{...result,saved:true},{...result,draft:{...result.draft,processingExpired:false}},{...result,draft:{...result.draft,status:'READY'}},{...result,draft:{...result.draft,processingExpiresAt:'invalid'}},{...result,draft:{...result.draft,processingExpiresAt:new Date(Date.now()+60000).toISOString()}},{...result,receiptId:'not-a-decision'}]){
  assert.equal(recoveryResult(ticket.entry,altered),null);await j.observe(recoveryQuery(ticket.entry),altered);assert.equal((await j.list(scope)).length,2);
 }
 await j.settle(ticket,result);assert.equal((await j.list(scope)).length,2,'POST cannot resolve a lease expiry');
 await j.observe(endpoint+'?'+new URLSearchParams({scope,projectId,draftId:'draft-plan'}),result);assert.equal((await j.list(scope)).length,2);
 await j.observe(recoveryQuery(ticket.entry),result);assert.deepEqual(await j.list(scope),[other.entry]);assert.ok(await j.prepare(endpoint,command({operationId:'01234567-89ab-4cde-8fab-0123456789ad'})));
});
