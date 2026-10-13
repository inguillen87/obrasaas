import test from 'node:test';
import assert from 'node:assert/strict';
import {planImportUsageView,planImportPreservation} from '../src/app/(identity)/cuenta/plan-import-usage-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
const scope='a'.repeat(64),projectId='project-synthetic',operationId='01234567-89ab-4cde-8fab-0123456789ab',otherId='01234567-89ab-4cde-8fab-0123456789ac';
const reference={version:1,resource:'plan-import',scope,projectId,operationId,createdAt:1};
const usage=state=>({version:1,receiptId:'organization_usage_'+'b'.repeat(64),state,coverageState:'TRIAL_CURRENT'});
const draft=(state='UNKNOWN')=>({id:'plan_draft_'+'c'.repeat(64),revision:1,status:'FAILED',rows:[],failure:'AI_REQUEST_UNCONFIRMED',sourceAvailable:true,usage:usage(state)});
const response=(state='UNKNOWN')=>({scope,projectId,state:'RECORDED',draft:draft(state)});
function storage(seed=[]){const rows=new Map(seed);return {get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const journal=s=>createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>1});
const request=(id=operationId)=>({method:'POST',body:JSON.stringify({scope,projectId,operationId:id})});

test('legacy drafts retain their read contract and do not acquire invented usage or costs',()=>{
 assert.equal(planImportUsageView({status:'READY',sourceAvailable:true}),null);assert.equal(planImportUsageView(null),null);assert.equal(planImportPreservation({data:{draft:{status:'READY'}},outcome:{state:'RECORDED'}}).preserveFile,false);
});
test('a legacy processing result preserves the selected file while its original recovery contract stays pending',()=>{
 const value={scope,projectId,saved:true,draft:{id:'draft-a',status:'PROCESSING',revision:1,rows:[],sourceAvailable:false}},outcome=recoveryResult(reference,value);
 assert.equal(outcome.state,'PROCESSING');assert.equal(planImportUsageView(value.draft),null);assert.equal(planImportPreservation({data:value,outcome}).preserveFile,true);
});
test('reserved dispatched and unknown drafts preserve work and request readonly verification',()=>{
 for(const state of ['RESERVED','DISPATCHED','UNKNOWN']){const d=draft(state),before=JSON.stringify(d),view=planImportUsageView(d);assert.equal(JSON.stringify(d),before);assert.equal(view.pending,true);assert.equal(view.preserveWork,true);assert.match(view.description,/no vuelve a invocar la IA/);assert.equal(planImportPreservation({data:{draft:d},outcome:{state:'RECORDED'}}).retainReference,true);assert.equal(recoveryResult(reference,response(state)).state,'PROCESSING');}
});
test('observed and unmeasured technical receipts never imply valid business rows or cost zero',()=>{
 for(const state of ['OBSERVED','UNMEASURED']){const value=response(state),view=planImportUsageView(value.draft);assert.equal(view.pending,false);assert.match(view.description,/no aprueba el contenido/);assert.equal(recoveryResult(reference,value).state,'RECORDED');assert.equal(planImportPreservation({data:value,outcome:{state:'RECORDED'}}).preserveFile,true);assert.equal(view.cost,undefined);}
});
test('coverage denial preserves the file and confirms storage only when sourceAvailable is true',()=>{
 const value={draft:{id:'draft-a',status:'FAILED',failure:'ORGANIZATION_USAGE_COVERAGE_EXPIRED',sourceAvailable:false,rows:[]}},view=planImportUsageView(value.draft);assert.equal(view.coverageExpired,true);assert.equal(view.receiptId,null);assert.equal(view.sourceAvailable,false);assert.match(view.sourceLabel,/todavía no está comprobada/);assert.ok(!view.sourceLabel.includes('está comprobada y disponible'));assert.equal(planImportPreservation({data:value,outcome:{state:'RECORDED'}}).preserveFile,true);value.draft.sourceAvailable=true;assert.match(planImportUsageView(value.draft).sourceLabel,/está comprobada y disponible/);
});
test('malformed private usage or unknown enums do not become a closed recovery result',()=>{
 for(const edit of [v=>{v.state='PAID';},v=>{v.receiptId='foreign';},v=>{v.coverageState='UNLIMITED';},v=>{v.version=2;},v=>{v.cost=0;},v=>{v.prompt='private';},v=>{delete v.coverageState;}]){const value=response();edit(value.draft.usage);assert.throws(()=>planImportUsageView(value.draft),{code:'PLAN_IMPORT_USAGE_UNCONFIRMED'});assert.equal(recoveryResult(reference,value),null);}
 const value=response();value.draft.usage=null;assert.throws(()=>planImportUsageView(value.draft),{code:'PLAN_IMPORT_USAGE_UNCONFIRMED'});assert.equal(recoveryResult(reference,value),null);
});
test('expiring a source lease cannot close a pending usage reservation or claim absence of dispatch',()=>{
 for(const state of ['RESERVED','DISPATCHED','UNKNOWN']){const value={scope,projectId,operationId,state:'EXPIRED',saved:false,definitive:true,draft:{...draft(state),status:'PROCESSING',processingExpired:true,processingExpiresAt:'2000-01-01T00:00:00.000Z'}};assert.deepEqual(recoveryResult(reference,value),{state:'PROCESSING'});assert.equal(planImportPreservation({data:value,outcome:{state:'EXPIRED'}}).preserveFile,true);}
});
test('legacy exact expired proofs remain recognizable while preserving local work in the view',()=>{
 const value={scope,projectId,operationId,state:'EXPIRED',saved:false,definitive:true,draft:{id:'draft-a',revision:1,status:'PROCESSING',rows:[],processingExpired:true,processingExpiresAt:'2000-01-01T00:00:00.000Z'}},outcome=recoveryResult(reference,value);assert.equal(outcome.state,'EXPIRED');assert.equal(planImportPreservation({data:value,outcome}).preserveFile,true);assert.equal(planImportPreservation({data:value,outcome}).retainReference,false);
});
test('local corrections are preserved only for the same draft and released by an exact decision receipt',()=>{
 const value=response('OBSERVED');assert.equal(planImportPreservation({data:value,outcome:{state:'RECORDED'},currentDraft:{id:value.draft.id},localRowsEdited:true}).preserveRows,true);assert.equal(planImportPreservation({data:value,outcome:{state:'RECORDED'},currentDraft:{id:'foreign'},localRowsEdited:true}).preserveRows,false);value.action='EDIT';value.receiptId='receipt-a';assert.equal(planImportPreservation({data:value,outcome:{state:'RECORDED'},currentDraft:{id:value.draft.id},localRowsEdited:true}).preserveFile,false);
});
test('durable pending usage survives GET and reload and blocks another UUID without storing source contents',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/plan-import',request());
 for(const state of ['RESERVED','DISPATCHED','UNKNOWN']){await j.settle(ticket,response(state));await j.observe(recoveryQuery(ticket.entry),response(state));assert.equal((await j.list(scope)).length,1);}
 const fresh=journal(storage(s.rows)),entry=(await fresh.list(scope))[0];assert.equal(entry.operationId,operationId);assert.match(recoveryQuery(entry),/operationId=/);await assert.rejects(fresh.prepare('/api/identity/plan-import',request(otherId)),{code:'WORKSPACE_RECOVERY_REQUIRED'});const persisted=JSON.stringify([...s.rows]);assert.ok(!persisted.includes('organization_usage_')&&!persisted.includes('sourceAvailable')&&!persisted.includes('AI_REQUEST'));
 await fresh.observe(recoveryQuery(entry),response('OBSERVED'));assert.equal((await fresh.list(scope)).length,0);
});
test('foreign scope project or malformed expired proofs never erase a pending reference',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/plan-import',request());
 for(const value of [{...response('OBSERVED'),scope:'b'.repeat(64)},{...response('OBSERVED'),projectId:'foreign'},{scope,projectId,operationId,state:'EXPIRED',saved:false,definitive:true,draft:{...draft(),status:'FAILED',processingExpired:true,processingExpiresAt:'2000-01-01T00:00:00.000Z'}}]){assert.equal(recoveryResult(ticket.entry,value),null);await j.observe(recoveryQuery(ticket.entry),value);assert.equal((await j.list(scope)).length,1);}
});
