import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
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
