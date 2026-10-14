import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {DOCUMENT_CURVE_PROFILE,DOCUMENT_CURVE_CONSENT} from '../src/lib/plan-import-document-curve.mjs';
import {decodePlanSource} from '../src/lib/plan-import-policy.mjs';
import {documentCurveProviderFixture} from './fixtures/plan-import-document-curve-synthetic.mjs';
const pdf=Buffer.from('%PDF-1.7\nSynthetic monthly financial table\n%%EOF'),source=()=>decodePlanSource(pdf,'application/pdf'),options={profile:DOCUMENT_CURVE_PROFILE,consent:DOCUMENT_CURVE_CONSENT};
const envelope=(raw,{model='gpt-4o',status='completed',extra={}}={})=>Response.json({status,model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}],...extra});
const extraction=()=>({isMonthlyFinancialCurve:true,truncated:false,warnings:[],curve:documentCurveProviderFixture()});
const environment=()=>({OPENAI_API_KEY:'unit-only-config-not-a-provider-credential'});

test('explicit document-only request uses existing OpenAI transport storefalse and no task schema',async()=>{
 let request,calls=0;const analyzer=createPlanImportAnalyzer({environment,fetchImpl:async(url,init)=>{calls++;request={url,...init,body:JSON.parse(init.body)};return envelope(extraction());}});
 const result=await analyzer.analyze(source(),options);assert.equal(result.success,true);assert.equal(result.provider,'openai');assert.equal(result.model,'gpt-4o');assert.deepEqual(result.rows,[]);assert.equal(result.documentCurve.sourceSha256,source().sha256);assert.equal(result.documentCurve.coherence.status,'CONSISTENT');assert.equal(calls,1);
 assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(request.redirect,'error');assert.equal(request.body.store,false);assert.equal(request.body.model,'gpt-4o');assert.equal(request.body.text.format.strict,true);assert.equal(request.body.text.format.name,'plan_document_monthly_curve');assert.equal(request.body.text.format.schema.additionalProperties,false);assert.ok(!Object.hasOwn(request.body.text.format.schema.properties,'rows'));assert.match(request.body.instructions,/No extraigas ni inventes tareas/);assert.match(request.body.instructions,/calendarEvidence/);assert.equal(request.body.input[0].content[1].type,'input_file');
});
test('new profile cannot borrow legacy consent and mismatch fails before configuration or dispatch',async()=>{
 let configured=0,calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>{configured++;return environment();},fetchImpl:async()=>{calls++;throw new Error('Must not dispatch');}});
 for(const invalid of [{profile:DOCUMENT_CURVE_PROFILE},{profile:DOCUMENT_CURVE_PROFILE,consent:'plan-document-openai-v1'},{consent:DOCUMENT_CURVE_CONSENT},{profile:'MONTHLY_RUBROS',consent:DOCUMENT_CURVE_CONSENT}])assert.equal((await analyzer.analyze(source(),invalid)).code,'PLAN_IMPORT_CONSENT_REQUIRED');
 assert.equal((await analyzer.analyze({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes:pdf},options)).code,'PLAN_IMPORT_CONSENT_REQUIRED');assert.equal(configured,0);assert.equal(calls,0);
});
test('historical PDF task request and document request never consume each other schemas',async()=>{
 let request;const financial=createPlanImportAnalyzer({environment,fetchImpl:async(_url,init)=>{request=JSON.parse(init.body);return envelope(extraction());}});
 assert.equal((await financial.analyze(source())).code,'PLAN_IMPORT_NOT_A_SCHEDULE');assert.equal(request.text.format.name,'plan_import_draft');assert.equal(request.body,undefined);assert.ok(Object.hasOwn(request.text.format.schema.properties,'rows'));
 const tasks={isSchedule:true,truncated:false,warnings:[],rows:[{title:'Tarea sintética',startsOn:'2026-10-01',endsOn:'2026-10-02',evidence:'Fila sintética',uncertainty:''}]};
 const taskAnalyzer=createPlanImportAnalyzer({environment,fetchImpl:async()=>envelope(tasks)});assert.equal((await taskAnalyzer.analyze(source(),options)).code,'PLAN_IMPORT_NOT_A_MONTHLY_FINANCIAL_CURVE');const legacy=await taskAnalyzer.analyze(source());assert.equal(legacy.success,true);assert.equal(legacy.rows.length,1);assert.ok(!Object.hasOwn(legacy,'documentCurve'));
});
test('nonfinancial, partial, malformed and fabricated identity responses never produce a document curve',async()=>{
 const cases=[{raw:{isMonthlyFinancialCurve:false,truncated:false,warnings:['No es curva mensual.'],curve:null},code:'PLAN_IMPORT_NOT_A_MONTHLY_FINANCIAL_CURVE'},
  {raw:{...extraction(),truncated:true},code:'PLAN_IMPORT_DOCUMENT_CURVE_LIMIT'},
  {raw:{...extraction(),rows:[]},code:'PLAN_IMPORT_NOT_A_MONTHLY_FINANCIAL_CURVE'},
  {raw:{...extraction(),warnings:['\n']},code:'AI_RESPONSE_INVALID'},
  {raw:{...extraction(),curve:{...documentCurveProviderFixture(),sourceSha256:'a'.repeat(64)}},code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'},
  {raw:{...extraction(),curve:{...documentCurveProviderFixture(),tasks:[]}},code:'PLAN_IMPORT_DOCUMENT_CURVE_INVALID'}];
 for(const c of cases){let calls=0;const analyzer=createPlanImportAnalyzer({environment,fetchImpl:async()=>{calls++;return envelope(c.raw);}});const result=await analyzer.analyze(source(),options);assert.equal(result.success,false);assert.equal(result.code,c.code);assert.ok(!Object.hasOwn(result,'documentCurve'));assert.equal(calls,1);}
});
test('observed model and completion contract stay closed for document extraction',async()=>{
 for(const response of [{model:'gpt-4.1'},{model:'gpt-4o-mini'},{status:'incomplete'},{extra:{incomplete_details:{reason:'max_output_tokens'}}},{extra:{output:[{type:'message',content:[{type:'refusal',refusal:'synthetic refusal'}]}]}}]){const analyzer=createPlanImportAnalyzer({environment,fetchImpl:async()=>envelope(extraction(),response)});const result=await analyzer.analyze(source(),options);assert.equal(result.success,false);assert.ok(!Object.hasOwn(result,'documentCurve'));}
});
test('usage fence is awaited before transport and unconfirmed response never triggers a second call',async()=>{
 const trace=[],usage={clientRequestId:'organization_usage_'+('d'.repeat(64)),beforeExternal:async()=>{trace.push('fence');},observe:async()=>{trace.push('observed');},unknown:async()=>{trace.push('unknown');}};
 let calls=0;const analyzer=createPlanImportAnalyzer({environment,fetchImpl:async()=>{calls++;trace.push('http');throw new Error('Synthetic lost response');}});const result=await analyzer.analyze(source(),{...options,usageObserver:usage});assert.equal(result.code,'AI_REQUEST_UNCONFIRMED');assert.deepEqual(trace,['fence','http','unknown']);assert.equal(calls,1);
 const blocked={...usage,beforeExternal:async()=>{throw new WorkspaceError('PLAN_IMPORT_PERMISSION_REQUIRED',403);}};await assert.rejects(analyzer.analyze(source(),{...options,usageObserver:blocked}),{code:'PLAN_IMPORT_PERMISSION_REQUIRED'});assert.equal(calls,1);
});
test('synthetic image and response usage use the same document-only contract without local OCR claims',async()=>{
 const bytes=readFileSync(new URL('../scripts/fixtures/plan-import-synthetic-v1.png',import.meta.url)),image=decodePlanSource(bytes,'image/png'),facts=[];let request;
 const analyzer=createPlanImportAnalyzer({environment,fetchImpl:async(_url,init)=>{request=JSON.parse(init.body);return envelope(extraction());}}),usage={clientRequestId:'organization_usage_'+('e'.repeat(64)),beforeExternal:async()=>{},observe:async fact=>{facts.push(fact);},unknown:async()=>{throw new Error('Unexpected unknown observation');}};
 const result=await analyzer.analyze(image,{...options,usageObserver:usage});assert.equal(result.success,true);assert.equal(result.documentCurve.sourceSha256,image.sha256);assert.equal(result.provider,'openai');assert.equal(request.input[0].content[1].type,'input_image');assert.equal(request.input[0].content[1].detail,'high');assert.equal(facts.length,1);
});
test('incomplete and discrepant original observations remain visible for later human review',async()=>{
 const raw=extraction();raw.curve.periods[0].monthlyAmount.decimalText='26';raw.curve.periods[0].monthlyAmount.rawText='26';raw.curve.periods[1].cumulativePercentage={rawText:null,decimalText:null,evidence:[],uncertainty:'Texto ilegible en la muestra sintética.'};
 const analyzer=createPlanImportAnalyzer({environment,fetchImpl:async()=>envelope(raw)}),result=await analyzer.analyze(source(),options);assert.equal(result.success,true);assert.equal(result.documentCurve.coherence.status,'INCONSISTENT');assert.equal(result.documentCurve.periods[0].monthlyAmount.rawText,'26');assert.equal(result.documentCurve.periods[1].cumulativePercentage.decimalText,null);assert.deepEqual(result.rows,[]);
});
