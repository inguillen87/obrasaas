import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {decodePlanSource,PLAN_IMPORT_CONSENT,PLAN_IMPORT_CYP_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {PLAN_BUDGET_SOURCE_PROFILE,PLAN_BUDGET_SOURCE_CONSENT} from '../src/lib/plan-budget-source.mjs';
import {PLAN_BUDGET_CSV_PROFILE as profile,PLAN_BUDGET_CSV_CONSENT as consent,PLAN_BUDGET_CSV_TYPE as type,planBudgetCsvSourceDigest} from '../src/lib/plan-budget-csv-source.mjs';
import {budgetStoreHarness,budgetContext as context,budgetSession as session,budgetSourceFile} from './fixtures/plan-budget-store-synthetic.mjs';
import {syntheticBudgetCsv} from './fixtures/plan-budget-csv-synthetic.mjs';
import {documentCurveFixture} from './fixtures/plan-import-document-curve-synthetic.mjs';

const endpoint='https://obrasaas.com/api/identity/plan-import';
const sourceFile=options=>decodePlanSource(syntheticBudgetCsv(options),type);
const input=(source=sourceFile(),changes={})=>({...context,operationId:randomUUID(),consent,source,...changes});
const detail=(h,draft)=>h.imports.read(session,{...context,draftId:draft.id});
const readRequest=changes=>new Request(endpoint+'?'+new URLSearchParams({...context,...changes}));
const handlers=h=>createPlanImportHandlers({verify:async()=>session,imports:h.imports});
function uploadRequest(source=sourceFile(),changes={},extras=[]){const form=new FormData();for(const [key,value]of Object.entries({...context,operationId:randomUUID(),consent,...changes}))form.set(key,value);form.set('file',new Blob([source.bytes],{type:source.contentType}),'synthetic-budget.csv');for(const [key,value]of extras)form.append(key,value);return new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com'},body:form});}
const noBusiness=h=>{assert.equal(h.calls.taskReads,0);assert.equal(h.calls.taskWrites,0);assert.equal(h.calls.provider,0);assert.equal(h.calls.providerConfiguration,0);assert.equal(h.state().tasks.size,0);assert.ok([...h.state().logs.values()].every(row=>row.action==='plan.import.draft'));};
async function unchanged(h,run,code){const before=h.state();await assert.rejects(run,{code});assert.deepEqual(h.state(),before);}

test('CSV analyzer is deterministic and never reads AI credentials or falls back to a document/CyP profile',async()=>{
 let external=0;const analyzer=createPlanImportAnalyzer({environment:()=>{external++;throw Error('No AI credentials');},fetchImpl:async()=>{external++;throw Error('No provider');}}),csv=sourceFile(),excel=budgetSourceFile();
 const result=await analyzer.analyze(csv,{profile,consent});assert.equal(result.success,true);assert.equal(result.provider,'local-csv');assert.equal(result.model,null);assert.equal(result.requestedModel,null);assert.deepEqual(result.rows,[]);assert.equal(result.budgetSource.profile,profile);assert.equal(result.budgetSource.sourceDigest,planBudgetCsvSourceDigest(result.budgetSource));
 for(const [file,options]of [[csv,{}],[csv,{profile:'MONTHLY_RUBROS',consent:PLAN_IMPORT_CONSENT}],[csv,{profile:PLAN_BUDGET_SOURCE_PROFILE,consent:PLAN_BUDGET_SOURCE_CONSENT}],[csv,{profile,consent:PLAN_IMPORT_CYP_CONSENT}],[excel,{profile,consent}],[excel,{profile:'CYP_PARTIDAS',consent}]])assert.deepEqual(await analyzer.analyze(file,options),{success:false,code:'PLAN_IMPORT_CONSENT_REQUIRED'});
 assert.equal(external,0);
});

test('canonical HTTP upload/list/recovery expose only a CSV descriptor; exact authorized detail returns all literals and original bytes',async()=>{
 const h=budgetStoreHarness(),http=handlers(h),source=sourceFile({count:68}),request=uploadRequest(source),posted=await http.POST(request),body=await posted.json(),draft=body.draft;assert.equal(posted.status,200);assert.equal(draft.status,'READY');assert.equal(draft.budgetImport,true);assert.equal(draft.financialSource,true);assert.equal(draft.existingTaskCount,null);assert.deepEqual(draft.rows,[]);assert.equal(draft.source.sha256,source.sha256);assert.equal(draft.source.contentType,type);assert.equal(draft.budgetDescriptor.version,1);assert.equal(draft.budgetDescriptor.profile,profile);assert.equal(draft.budgetDescriptor.rowCount,68);assert.equal(Object.hasOwn(draft.budgetDescriptor,'measurementSourceDigest'),false);assert.equal(Object.hasOwn(draft,'budgetSource'),false);assert.equal(posted.headers.get('cache-control'),'private, no-store, max-age=0');
 const list=await (await http.GET(readRequest({}))).json();assert.deepEqual(list.drafts[0].budgetDescriptor,draft.budgetDescriptor);assert.equal(Object.hasOwn(list.drafts[0],'budgetSource'),false);
 const exactResponse=await http.GET(readRequest({draftId:draft.id})),exact=await exactResponse.json();assert.equal(exactResponse.status,200);assert.equal(exact.canApprove,true);assert.equal(exact.draft.budgetSource.rows.length,68);assert.equal(exact.draft.budgetSource.rows[0].rawQuantity,'0,0000');assert.equal(exact.draft.budgetSource.rows[0].rawUnitPrice,'999999999999999999999,000000');assert.equal(exact.draft.budgetSource.sourceDigest,draft.budgetDescriptor.sourceDigest);assert.equal(exactResponse.headers.get('vary'),'Cookie, Authorization');
 const download=await http.GET(readRequest({draftId:draft.id,source:'1'}));assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),type);assert.deepEqual(Buffer.from(await download.arrayBuffer()),source.bytes);noBusiness(h);
});

test('CSV duplicate delivery and operation recovery do not repeat parsing, archive writes or financial changes',async()=>{
 const h=budgetStoreHarness(),command=input(),first=await h.imports.attach(session,command),io={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},recovery=await h.imports.read(session,{...context,operationId:command.operationId}),again=await h.imports.attach(session,command);
 assert.equal(recovery.state,'RECORDED');assert.equal(recovery.draft.id,first.draft.id);assert.equal(Object.hasOwn(recovery.draft,'budgetSource'),false);assert.equal(again.replayed,true);assert.equal(again.draft.id,first.draft.id);assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},io);
 await unchanged(h,()=>h.imports.attach(session,{...command,source:sourceFile({count:4})}),'PLAN_IMPORT_OPERATION_CONFLICT');assert.equal(h.calls.put,1);assert.equal(h.calls.analyzer,1);noBusiness(h);
});

test('authorization precedes complete CSV parsing and rejects low roles, WhatsApp proof and foreign scope before archival',async()=>{
 const malformed=decodePlanSource(Buffer.from('wrong,header\n1,2\n'),type);
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR','CHANNEL_ADMIN']){const h=budgetStoreHarness();if(role==='CHANNEL_ADMIN')h.setChannelProof({channel:'WHATSAPP',synthetic:true});else h.setRole(role);await assert.rejects(()=>h.imports.attach(session,input(malformed)),{code:'PLAN_IMPORT_PERMISSION_REQUIRED',status:403});assert.equal(h.state().logs.size,0);assert.equal(h.calls.get+h.calls.put+h.calls.analyzer,0);}
 const h=budgetStoreHarness();await assert.rejects(()=>h.imports.attach(session,input(undefined,{scope:'a'.repeat(64)})),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(h.calls.put,0);assert.equal(h.calls.analyzer,0);
});

test('invalid CSV structure and record 201 are definitive pre-reservation rejections with zero archive IO',async()=>{
 for(const [source,status,code]of [[decodePlanSource(Buffer.from('wrong,header\n1,2\n'),type),400,'PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID'],[sourceFile({count:201}),413,'PLAN_IMPORT_BUDGET_CSV_ROWS_LIMIT']]){const h=budgetStoreHarness(),response=await handlers(h).POST(uploadRequest(source)),body=await response.json();assert.equal(response.status,status);assert.equal(body.code,code);assert.equal(body.phase,'PRE_RESERVATION');assert.equal(body.reservationStarted,false);assert.equal(body.definitive,true);assert.equal(h.state().logs.size,0);assert.equal(h.calls.get+h.calls.put+h.calls.analyzer,0);}
});

test('CSV parser rejections bind the live original upload digest for invalid UTF-8, malformed source and record limit',async()=>{
 const cases=[{bytes:Buffer.from([0xc3,0x28]),code:'PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID',status:400},{bytes:Buffer.from(syntheticBudgetCsv().toString().replace('Synthetic','Syn\u0000thetic')),code:'PLAN_IMPORT_BUDGET_CSV_INVALID',status:400},{bytes:Buffer.from('wrong,header\n1,2\n'),code:'PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID',status:400},{bytes:syntheticBudgetCsv({count:201}),code:'PLAN_IMPORT_BUDGET_CSV_ROWS_LIMIT',status:413}];
 for(const item of cases){
  const h=budgetStoreHarness(),operationId=randomUUID(),source={bytes:item.bytes,contentType:type},response=await handlers(h).POST(uploadRequest(source,{operationId})),body=await response.json(),sourceSha256=createHash('sha256').update(item.bytes).digest('hex');
  const expected=createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent,operationId,projectId:context.projectId,scope:context.scope,source:{bytes:item.bytes.length,contentType:type,sha256:sourceSha256}}])).digest('hex');
  assert.equal(response.status,item.status);assert.deepEqual(body,{saved:false,code:item.code,...context,operationId,action:'UPLOAD',inputDigest:expected,state:'REJECTED',definitive:true,reservationStarted:false,phase:'PRE_RESERVATION'});assert.equal(h.state().logs.size,0);assert.equal(h.calls.get+h.calls.put+h.calls.analyzer,0);
 }
});

test('a client cannot lower financial classification using a document consent, extra flags or query flags',async()=>{
 const h=budgetStoreHarness(),http=handlers(h);h.setRole('SITE_MANAGER');
 for(const request of [uploadRequest(undefined,{consent:PLAN_IMPORT_CONSENT}),uploadRequest(undefined,{},[['budgetImport','false']]),uploadRequest(undefined,{},[['financialSource','false']])])assert.equal((await http.POST(request)).status,400);
 const response=await http.GET(readRequest({financialSource:'false'}));assert.equal(response.status,400);assert.equal(h.state().logs.size,0);assert.equal(h.calls.get+h.calls.put+h.calls.analyzer,0);
});

test('server-owned CSV sensitivity persists across role changes for detail, original download, recovery and listing',async()=>{
 const h=budgetStoreHarness(),http=handlers(h),command=input(),result=await h.imports.attach(session,command),io={get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer};h.setRole('SITE_MANAGER');
 for(const query of [{draftId:result.draft.id},{draftId:result.draft.id,source:'1'},{operationId:command.operationId}]){const response=await http.GET(readRequest(query)),body=await response.json();assert.equal(response.status,403);assert.equal(body.code,'PLAN_IMPORT_PERMISSION_REQUIRED');assert.equal(Object.hasOwn(body,'draft'),false);}
 const list=await (await http.GET(readRequest({}))).json();assert.deepEqual(list.drafts,[]);assert.deepEqual({get:h.calls.get,put:h.calls.put,analyzer:h.calls.analyzer},io);noBusiness(h);
});

test('CSV upload never reserves an AI usage operation or invokes its provider observer',async()=>{
 let attempted=0;const forbidden=async()=>{attempted++;throw Error('CSV must not reserve AI usage');},usage={reserve:forbidden,fence:forbidden,observe:forbidden,unknown:forbidden,lockBeforeProject:async()=>{}};
 const h=budgetStoreHarness({usage}),result=await h.imports.attach(session,input());assert.equal(result.draft.status,'READY');assert.equal(attempted,0);assert.equal(Object.hasOwn(result.draft,'usage'),false);noBusiness(h);
});

test('all existing ordinary, investment and document decisions reject CSV budgets without a business or decision write',async()=>{
 const h=budgetStoreHarness(),result=await h.imports.attach(session,input()),draft=result.draft,base={...context,draftId:draft.id,expectedRevision:draft.revision,reason:'Synthetic unauthorized financial application',rows:[{title:'Synthetic task must never exist',startsOn:'2026-11-01',endsOn:'2026-11-02',evidence:'Synthetic',uncertainty:''}]};
 const attempts=['EDIT','APPLY','REJECT'].map(action=>({...base,operationId:randomUUID(),action,rows:action==='REJECT'?null:base.rows}));
 for(const action of ['REVIEW_CURVE','APPLY_CURVE'])attempts.push({...base,operationId:randomUUID(),action,rows:null,curve:action==='REVIEW_CURVE'?documentCurveFixture({sourceSha256:draft.source.sha256}):null});
 for(const action of ['REVIEW_INVESTMENT','APPLY_INVESTMENT','REJECT_INVESTMENT']){const {rows,...body}=base;void rows;attempts.push({...body,operationId:randomUUID(),action,acknowledgeDifference:false});}
 for(const body of attempts)await unchanged(h,()=>h.imports.decide(session,body),'PLAN_IMPORT_BUDGET_READ_ONLY');noBusiness(h);
});

test('full CSV evidence is validated on exact read and never released from a corrupted draft descriptor',async()=>{
 for(const corrupt of [m=>{m.analysis.budgetSource.rows[0].rawLineAmount='changed';},m=>{m.analysis.budgetSource.rows[0].provenance.pageLiteral='changed';},m=>{m.analysis.budgetSource.taskWrites=true;},m=>{m.analysis.budgetDescriptor.profile=PLAN_BUDGET_SOURCE_PROFILE;},m=>{m.analysis.budgetDescriptor.rowCount=2;}]){const h=budgetStoreHarness(),result=await h.imports.attach(session,input());h.mutateDraft(result.draft.id,corrupt);await unchanged(h,()=>detail(h,result.draft),'PLAN_IMPORT_RECEIPT_INTEGRITY');assert.equal(h.calls.put,1);assert.equal(h.calls.analyzer,1);noBusiness(h);}
});

test('an uncertain post-upload role loss remains recoverable without a second archive or analyzer dispatch',async()=>{
 const h=budgetStoreHarness(),command=input();h.setAfterPut(()=>h.setRole('SITE_MANAGER'));await assert.rejects(()=>h.imports.attach(session,command),{code:'PLAN_IMPORT_PERMISSION_REQUIRED'});assert.equal(h.calls.put,1);assert.equal(h.calls.analyzer,0);h.setRole('ADMIN');h.setAfterPut(null);const recovered=await h.imports.read(session,{...context,operationId:command.operationId});assert.equal(recovered.draft.status,'UPLOADING');assert.equal(recovered.draft.budgetDescriptor,null);assert.equal((await h.imports.attach(session,command)).replayed,true);assert.equal(h.calls.put,1);assert.equal(h.calls.analyzer,0);noBusiness(h);
});

test('source byte corruption is not silently repaired or returned as the original CSV',async()=>{
 const h=budgetStoreHarness(),result=await h.imports.attach(session,input()),pathname=h.state().logs.get(result.draft.id).metadata.source.pathname;h.mutateBlob(pathname,value=>{value.bytes[0]^=1;});await unchanged(h,()=>h.imports.source(session,{...context,draftId:result.draft.id}),'PLAN_IMPORT_SOURCE_INTEGRITY');assert.equal(h.calls.put,1);assert.equal(h.calls.analyzer,1);noBusiness(h);
});
