import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {storeHarness,context,session,oldTask} from './fixtures/plan-import-store-synthetic.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {decodePlanSource,normalizePlanRows,normalizePlanDecision,boundedPlanMultipart,PLAN_IMPORT_CONSENT,PLAN_IMPORT_LIMIT} from '../src/lib/plan-import-policy.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
const pdf=Buffer.from('%PDF-1.7\nSynthetic schedule fixture\n%%EOF');
const row={title:'Fundaciones sintéticas',startsOn:'2026-10-08',endsOn:'2026-10-10',evidence:'Fila 1, página 1',uncertainty:''};
const extracted={isSchedule:true,truncated:false,warnings:[],rows:[row]};
const apiResponse=raw=>Response.json({status:'completed',model:'gpt-4o',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]});
test('source size, actual signature and declared content type must agree',()=>{
 const source=decodePlanSource(pdf,'application/pdf');assert.equal(source.extension,'pdf');assert.match(source.sha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>decodePlanSource(pdf,'image/png'),{code:'PLAN_IMPORT_FILE_INVALID'});
 assert.throws(()=>decodePlanSource(Buffer.from('%PDF-1.7 truncated'),'application/pdf'),{code:'PLAN_IMPORT_FILE_INVALID'});
 assert.throws(()=>decodePlanSource(Buffer.alloc(PLAN_IMPORT_LIMIT+1),'application/pdf'),{code:'PLAN_IMPORT_FILE_TOO_LARGE'});
});
test('ambiguous dates remain empty and prevent application; over-limit and duplicates fail entirely',()=>{
 const uncertain={...row,startsOn:null,endsOn:null,uncertainty:'Año ausente en la fuente'};
 assert.deepEqual(normalizePlanRows([uncertain]),[uncertain]);assert.throws(()=>normalizePlanRows([uncertain],{complete:true}),{code:'PLAN_IMPORT_REVIEW_REQUIRED'});
 assert.throws(()=>normalizePlanRows([{...row,startsOn:'2026-02-30'}]),{code:'PLAN_IMPORT_DATES_INVALID'});
 assert.throws(()=>normalizePlanRows([{...row,endsOn:'2026-10-01'}]),{code:'PLAN_IMPORT_DATES_INVALID'});
 assert.throws(()=>normalizePlanRows([row,row]),{code:'PLAN_IMPORT_DUPLICATE_ROWS'});
 assert.throws(()=>normalizePlanRows(Array.from({length:51},(_,i)=>({...row,title:'Tarea '+i}))),{code:'PLAN_IMPORT_ROWS_LIMIT'});
 assert.throws(()=>normalizePlanRows([{...row,progress:100}]),{code:'PLAN_IMPORT_ROWS_INVALID'});
});
test('strict decision fields exclude caller role, progress and tenant claims',()=>{
 const input={action:'APPLY',draftId:'draft-fixture',expectedRevision:2,operationId:randomUUID(),projectId:'p-fixture',scope:'a'.repeat(64),reason:'Revisado con la fuente',rows:[row]};
 assert.equal(normalizePlanDecision(input).rows[0].startsOn,row.startsOn);
 for(const field of ['progress','actorId','role','organizationId'])assert.throws(()=>normalizePlanDecision({...input,[field]:'invented'}));
});
test('bounded multipart requires explicit consent and rejects duplicate/unknown fields',async()=>{
 const form=new FormData();for(const [key,value] of Object.entries({operationId:randomUUID(),projectId:'p-fixture',scope:'a'.repeat(64),consent:PLAN_IMPORT_CONSENT}))form.append(key,value);form.append('file',new Blob([pdf],{type:'application/pdf'}),'fixture.pdf');
 const request=()=>new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',body:form});assert.equal((await boundedPlanMultipart(request())).source.contentType,'application/pdf');
 form.set('consent','false');await assert.rejects(boundedPlanMultipart(request()),{code:'PLAN_IMPORT_CONSENT_REQUIRED'});form.set('consent',PLAN_IMPORT_CONSENT);form.append('projectId','other');await assert.rejects(boundedPlanMultipart(request()),{code:'PLAN_IMPORT_INPUT_INVALID'});
});
test('Responses PDF extraction uses private bytes, strict schema, consent-only context and no retention',async()=>{
 let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>({OPENAI_API_KEY:'synthetic-provider-token'}),fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.type,'json_schema');assert.equal(body.input[0].content[1].type,'input_file');assert.match(body.input[0].content[1].file_data,/^data:application\/pdf;base64,/);assert.equal(body.model,'gpt-4o');return apiResponse(extracted);
 }});
 const result=await analyzer.analyze(decodePlanSource(pdf,'application/pdf'));assert.equal(result.success,true);assert.equal(result.model,'gpt-4o');assert.equal(result.requestedModel,'gpt-4o');assert.deepEqual(result.rows,[row]);assert.equal(calls,1);
});
test('provider refusal, malformed schema, excessive rows and incomplete responses never yield a usable draft',async()=>{
 const bad=[Response.json({status:'incomplete',model:'gpt-4o'}),Response.json({status:'completed',model:'gpt-4o',output:[{type:'message',content:[{type:'refusal',refusal:'fixture'}]}]}),apiResponse({...extracted,truncated:true}),apiResponse({...extracted,rows:[{...row,progress:100}]}),apiResponse({...extracted,rows:Array.from({length:51},(_,i)=>({...row,title:'Tarea '+i}))}),apiResponse({...extracted,isSchedule:false})];
 for(const response of bad){const analyzer=createPlanImportAnalyzer({environment:()=>({OPENAI_API_KEY:'synthetic-token'}),fetchImpl:async()=>response});assert.equal((await analyzer.analyze(decodePlanSource(pdf,'application/pdf'))).success,false);}
 let calls=0;const missing=createPlanImportAnalyzer({environment:()=>({}),fetchImpl:async()=>{calls++;}});assert.equal((await missing.analyze({})).code,'AI_PROVIDER_NOT_CONFIGURED');assert.equal(calls,0);
});
test('image input uses vision and bounded provider response; no implicit network retries',async()=>{
 const png=Buffer.from('89504e470d0a1a0a00000000','hex');let calls=0;
 const analyzer=createPlanImportAnalyzer({environment:()=>({OPENAI_API_KEY:'fixture'}),fetchImpl:async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).input[0].content[1].type,'input_image');throw new Error('synthetic timeout');}});
 assert.equal((await analyzer.analyze(decodePlanSource(png,'image/png'))).success,false);assert.equal(calls,1);
});
test('HTTP authorization/origin/query boundaries run before upload and processing',async()=>{
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Fixture',organizationId:'org_Fixture',organizationRole:'org:admin'};let writes=0;
 const handlers=createPlanImportHandlers({verify:async()=>session,imports:{attach:async()=>{writes++;},decide:async()=>{writes++;}}});
 const cross=new Request('https://obrasaas.com/api/identity/plan-import',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:'{}'});assert.equal((await handlers.POST(cross)).status,403);assert.equal(writes,0);
 const bad=new Request('https://obrasaas.com/api/identity/plan-import?projectId=p&scope='+('a'.repeat(64))+'&scope='+('a'.repeat(64)));assert.equal((await handlers.GET(bad)).status,400);
 const unauth=createPlanImportHandlers({verify:async()=>({authenticated:false}),imports:{}});assert.equal((await unauth.GET(bad)).status,401);
});


function scheduleHarness(){
 return storeHarness({analyzerOverride:{async analyze(){return {success:true,rows:[row],warnings:[],provider:'synthetic-openai-adapter',model:'synthetic'};}}});
}
function attachSchedule(h,source=decodePlanSource(pdf,'application/pdf')){
 return h.imports.attach(session,{...context,operationId:randomUUID(),consent:PLAN_IMPORT_CONSENT,source});
}
function applySchedule(draft){
 return {...context,operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,action:'APPLY',rows:draft.rows,reason:'Cronograma sintético revisado'};
}
function approveExistingTask(h){
 h.changeTask(oldTask.id,task=>Object.assign(task,{progress:100,status:'DONE',revision:'2026-01-02T00:00:00.000Z'}));
}
for(const contentType of ['application/pdf','image/png']){
 test('a new '+contentType+' schedule remains applicable after an existing task reports progress',async()=>{
  const h=scheduleHarness();
  const source=contentType==='application/pdf'?decodePlanSource(pdf,contentType):decodePlanSource(readFileSync(new URL('../scripts/fixtures/plan-import-synthetic-v1.png',import.meta.url)),contentType);
  const {draft}=await attachSchedule(h,source);
  assert.equal(draft.status,'READY');
  assert.equal(h.calls.analyze,1);
  const metadata=h.logs().find(entry=>entry.id===draft.id).metadata;
  assert.equal(metadata.baselineVersion,2);
  assert.equal(metadata.baseline,digest(h.tasks()));
  assert.notEqual(metadata.plannedBaseline,metadata.baseline);
  approveExistingTask(h);
  const approved=h.tasks()[0],command=applySchedule(draft),result=await h.imports.decide(session,command);
  assert.equal(result.saved,true,result.code);
  assert.equal(result.draft.status,'APPLIED');
  assert.equal(result.tasks.length,draft.rows.length);
  assert.equal(h.tasks().length,1+draft.rows.length);
  assert.deepEqual(h.tasks().find(task=>task.id===approved.id),approved);
  assert.equal((await h.imports.decide(session,command)).receiptId,result.receiptId);
  assert.equal(h.calls.analyze,1);
  assert.equal(h.calls.put,1);
 });
}
test('a change in planned dates still rejects a document import without writing tasks',async()=>{
 const h=scheduleHarness(),{draft}=await attachSchedule(h);
 h.changeTask(oldTask.id,task=>{task.startsOn='2026-01-02';});
 const command=applySchedule(draft),result=await h.imports.decide(session,command);
 assert.equal(result.code,'PLAN_IMPORT_SCHEDULE_CHANGED');
 assert.equal(result.taskEffects,false);
 assert.equal(h.calls.taskBatches,0);
 assert.equal(h.calls.analyze,1);
 assert.equal((await h.imports.decide(session,command)).receiptId,result.receiptId);
});
test('legacy document baselines keep their original contract and unknown versions fail closed',async()=>{
 for(const [version,progressChanged,expected] of [[undefined,false,'RECORDED'],[undefined,true,'REJECTED'],[99,false,'REJECTED']]){
  const h=scheduleHarness(),{draft}=await attachSchedule(h);
  const legacyHash=digest(h.tasks());
  h.changeDraft(draft.id,metadata=>{
   metadata.baseline=legacyHash;
   if(version===undefined){
    delete metadata.baselineVersion;
    delete metadata.plannedBaseline;
   }else metadata.baselineVersion=version;
  });
  if(progressChanged)approveExistingTask(h);
  const result=await h.imports.decide(session,applySchedule(draft));
  assert.equal(result.saved,expected==='RECORDED',result.code);
  if(expected==='REJECTED'){
   assert.equal(result.code,'PLAN_IMPORT_SCHEDULE_CHANGED');
   assert.equal(h.calls.taskBatches,0);
  }
 }
});
