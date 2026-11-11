import './helpers/field-hours-network-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {PLAN_BUDGET_CSV_CONSENT as consent} from '../src/lib/plan-budget-csv-source.mjs';
import {budgetStoreHarness,budgetContext as context,budgetSession as session} from './fixtures/plan-budget-store-synthetic.mjs';
import {syntheticBudgetCsv} from './fixtures/plan-budget-csv-synthetic.mjs';
import {createWorkspaceRecoveryJournal,planImportUploadDigest,planImportUploadFormDigest,recoveryResult,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';

// Request objects exercise the real same-origin gate in memory; no fetch runs.
const endpoint='/api/identity/plan-import',origin='https://obrasaas.com',type='text/csv';
function storage(){const values=new Map();return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};}
const journal=store=>createWorkspaceRecoveryJournal({getStorage:()=>store,now:()=>123});
function command(bytes,changes={}){const form=new FormData();for(const [key,value]of Object.entries({...context,consent,operationId:randomUUID(),...changes}))form.set(key,value);form.set('file',new Blob([bytes],{type}),'synthetic-budget.csv');return {method:'POST',body:form};}
const digest=(options,bytes)=>createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:options.body.get('consent'),operationId:options.body.get('operationId').toLowerCase(),projectId:context.projectId,scope:context.scope,source:{bytes:bytes.length,contentType:type,sha256:createHash('sha256').update(bytes).digest('hex')}}])).digest('hex');
async function response(options){const h=budgetStoreHarness(),http=createPlanImportHandlers({verify:async()=>session,imports:h.imports}),request=new Request(origin+endpoint,{...options,headers:{origin}}),r=await http.POST(request);return {h,status:r.status,body:await r.json()};}

test('CSV has exactly its deterministic MIME/consent digest pair and keeps original invalid UTF-8 bytes bound',async()=>{
 const bytes=Buffer.from([0x81,0x28]),options=command(bytes),expected=digest(options,bytes);assert.equal(await planImportUploadFormDigest(options.body),expected);
 const input={...context,operationId:options.body.get('operationId'),consent,source:{bytes:bytes.length,contentType:type,sha256:createHash('sha256').update(bytes).digest('hex')}};assert.equal(await planImportUploadDigest(input),expected);
 for(const mismatch of [{consent:'plan-document-openai-v1'},{consent:'plan-source-budget-local-v1'},{source:{...input.source,contentType:'application/pdf'}},{source:{...input.source,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}])await assert.rejects(()=>planImportUploadDigest({...input,...mismatch}),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE',requestDispatched:false});
});

test('actual multipart HTTP parser rejections settle only their fresh digest-bound CSV ticket and allow explicit correction',async()=>{
 const cases=[
  [Buffer.from([0x81,0x28]),400,'PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID'],
  [Buffer.from('bad\u0000csv'),400,'PLAN_IMPORT_BUDGET_CSV_INVALID'],
  [Buffer.from('wrong,headers\n1,2'),400,'PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID'],
  [syntheticBudgetCsv({count:201}),413,'PLAN_IMPORT_BUDGET_CSV_ROWS_LIMIT'],
  [syntheticBudgetCsv({rows:[['1','9.1','Synthetic A','un.','0','0','0'],['1','9.1','Synthetic B','un.','0','0','0']]}),400,'PLAN_IMPORT_BUDGET_CSV_DUPLICATE_CODES'],
 ];
 for(const [bytes,status,code]of cases){
  const store=storage(),j=journal(store),options=command(bytes),ticket=await j.prepare(endpoint,options),r=await response(options);assert.equal(r.status,status);assert.equal(r.body.code,code);assert.equal(r.body.inputDigest,digest(options,bytes));assert.deepEqual(recoveryResult(ticket.entry,r.body),{state:'REJECTED',phase:'PRE_RESERVATION',liveOnly:true,code});
  assert.equal(r.h.state().logs.size,0);assert.equal(r.h.calls.put+r.h.calls.get+r.h.calls.analyzer+r.h.calls.taskWrites,0);
  await j.settle(ticket,null,{status:r.status,code:r.body.code,result:r.body});assert.deepEqual(await j.list(context.scope),[]);
  const corrected=command(syntheticBudgetCsv());assert.ok(await j.prepare(endpoint,corrected));assert.doesNotMatch(JSON.stringify([...store.values.values()]),/Synthetic A|synthetic-budget\.csv|cantidad_original|sourceSha256|contentType|plan-source-budget-csv/);
 }
});

test('actual successful CSV HTTP upload passes through journal prepare/settle without IA or duplicate business effects',async()=>{
 const bytes=syntheticBudgetCsv({count:68}),options=command(bytes),j=journal(storage()),ticket=await j.prepare(endpoint,options),r=await response(options);assert.equal(r.status,200);assert.equal(r.body.draft.budgetDescriptor.rowCount,68);assert.equal(r.body.draft.budgetImport,true);assert.equal(r.body.draft.source.contentType,type);assert.equal(r.h.calls.provider,0);assert.equal(r.h.calls.taskWrites,0);assert.equal(recoveryResult(ticket.entry,r.body).state,'RECORDED');await j.settle(ticket,r.body);assert.deepEqual(await j.list(context.scope),[]);
});

test('CSV parser response is live-only: reload, existing ticket, GET and success-shaped transport never clear it',async()=>{
 const bytes=Buffer.from([0x81,0x28]),options=command(bytes),r=await response(options);assert.equal(r.status,400);assert.equal(r.body.code,'PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID');
 for(const mode of ['GET','EXISTING_ERROR','EXISTING_SUCCESS','FRESH_SUCCESS']){const store=storage(),first=journal(store),ticket=await first.prepare(endpoint,options),j=mode.startsWith('EXISTING')?journal(store):first,active=mode.startsWith('EXISTING')?await j.prepare(endpoint,options):ticket;assert.equal(active.existed,mode.startsWith('EXISTING'));if(mode==='GET')await j.observe(recoveryQuery(active.entry),r.body);else if(mode==='EXISTING_ERROR')await j.settle(active,null,{status:r.status,code:r.body.code,result:r.body});else await j.settle(active,r.body);assert.equal((await j.list(context.scope)).length,1);}
});

test('foreign context, changed digest, absent proof fields, 403 and unknown/status-mismatched CSV responses retain the ticket',async()=>{
 const bytes=Buffer.from([0x81,0x28]),options=command(bytes),r=await response(options),mutations=[b=>({...b,scope:'e'.repeat(64)}),b=>({...b,projectId:'foreign'}),b=>({...b,operationId:randomUUID()}),b=>({...b,inputDigest:'f'.repeat(64)}),b=>({...b,action:'APPLY'}),b=>({...b,code:'PLAN_IMPORT_UNCONFIRMED'}),b=>({...b,definitive:false}),b=>({...b,saved:true}),b=>({...b,reservationStarted:true}),b=>({...b,extra:'unexpected'}),b=>{const {inputDigest:ignored,...other}=b;void ignored;return other;}];assert.equal(r.status,400);assert.equal(r.body.code,'PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID');
 for(const mutate of mutations){const j=journal(storage()),ticket=await j.prepare(endpoint,options),body=mutate(r.body);assert.equal(recoveryResult(ticket.entry,body),null);await j.settle(ticket,null,{status:r.status,code:body.code,result:body});assert.equal((await j.list(context.scope)).length,1);}
 for(const status of [200,403,409,413,500]){const j=journal(storage()),ticket=await j.prepare(endpoint,options);await j.settle(ticket,null,{status,code:r.body.code,result:r.body});assert.equal((await j.list(context.scope)).length,1);}
 const j=journal(storage()),ticket=await j.prepare(endpoint,options);assert.equal(recoveryResult({...ticket.entry,resource:'plan-measurement'},r.body),null);await j.settle(ticket,null,{status:400,code:'PLAN_IMPORT_FILE_INVALID',result:r.body});assert.equal((await j.list(context.scope)).length,1);assert.deepEqual(globalThis.__hoursExportNetworkGuard.attempts,[]);
});
