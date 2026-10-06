import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,normalizePlanRows,planImportRowRejection,safePlanImportDiagnostic} from '../src/lib/plan-import-policy.mjs';
import {verifyPlanImportLive,PLAN_IMPORT_LIVE_FLAG,PLAN_IMPORT_LIVE_PROJECT} from '../scripts/lib/plan-import-live-check.mjs';

const pdf=decodePlanSource(Buffer.from('%PDF-1.7\nSynthetic schedule\n%%EOF'),'application/pdf');
const row={title:'PRIVATE_TITLE_SENTINEL',startsOn:'2026-11-03',endsOn:'2026-11-06',evidence:'PRIVATE_EVIDENCE_SENTINEL',uncertainty:''};
const raw=rows=>({isSchedule:true,truncated:false,warnings:[],rows});
const response=rows=>Response.json({status:'completed',model:'gpt-4o-2024-08-06',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw(rows))}]}]});
const environment={OBRASAAS_RUN_PLAN_IMPORT_CHECK:PLAN_IMPORT_LIVE_FLAG,VERCEL_ENV:'production',VERCEL_PROJECT_ID:PLAN_IMPORT_LIVE_PROJECT,NEXT_PUBLIC_APP_URL:'https://obrasaas.com',OPENAI_API_KEY:'PRIVATE_PROVIDER_TOKEN_SENTINEL'};

test('provider request explains and constrains text without changing model, review, retention or request budget',async()=>{
 let calls=0;
 const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  const body=JSON.parse(options.body);assert.equal(body.model,'gpt-4o');assert.equal(body.store,false);assert.equal(body.max_output_tokens,10000);assert.equal(body.text.format.strict,true);
  const schema=body.text.format.schema,fields=schema.properties.rows.items.properties;
  assert.equal(schema.properties.rows.maxItems,50);assert.equal(schema.properties.warnings.maxItems,20);
  for(const [field,limit] of [['title',160],['evidence',500],['uncertainty',500]]){
   assert.equal(fields[field].maxLength,limit);const pattern=new RegExp(fields[field].pattern);
   assert.equal(pattern.test('Texto válido en español: áéíóúñ'),true);for(const invalid of ['texto\nnueva línea','texto\tcolumna','<contenido>','texto\u007f'])assert.equal(pattern.test(invalid),false);
  }
  assert.match(body.instructions,/160 caracteres/);assert.match(body.instructions,/500 caracteres/);assert.match(body.instructions,/sola línea/);assert.match(body.instructions,/sin saltos, tabulaciones/);assert.match(body.instructions,/revisión humana/);assert.match(body.instructions,/no aplica cambios/);assert.match(body.instructions,/no inventes fechas/i);
  return response([{...row,title:'T'.repeat(160),evidence:'E'.repeat(500),uncertainty:''}]);
 }});
 const result=await analyzer.analyze(pdf);assert.equal(result.success,true);assert.equal(result.rows[0].title.length,160);assert.equal(result.rows[0].evidence.length,500);assert.equal(result.diagnostic,undefined);assert.equal(calls,1);
});

test('valid uncertain extraction remains a draft requiring human review and preserves meaning',async()=>{
 let calls=0;const uncertain={...row,title:' Título original ',startsOn:null,endsOn:null,uncertainty:'U'.repeat(500)};
 const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return response([uncertain]);}});
 const result=await analyzer.analyze(pdf);assert.equal(result.success,true);assert.equal(result.rows[0].title,'Título original');assert.equal(result.rows[0].uncertainty,uncertain.uncertainty);assert.equal(calls,1);
 assert.throws(()=>normalizePlanRows(result.rows,{complete:true}),error=>{assert.equal(error.code,'PLAN_IMPORT_REVIEW_REQUIRED');assert.equal(error.status,409);assert.deepEqual(planImportRowRejection(error),{violation:'REVIEW_REQUIRED',field:'DATES'});return true;});
});

const invalidCases=[
 ['title-length',{title:'PRIVATE_TITLE_SENTINEL'+'T'.repeat(161)},'TEXT_LIMIT','TITLE'],
 ['evidence-length',{evidence:'PRIVATE_EVIDENCE_SENTINEL'+'E'.repeat(501)},'TEXT_LIMIT','EVIDENCE'],
 ['uncertainty-length',{uncertainty:'PRIVATE_UNCERTAINTY_SENTINEL'+'U'.repeat(501)},'TEXT_LIMIT','UNCERTAINTY'],
 ['title-control',{title:'PRIVATE_TITLE_SENTINEL\n'},'CONTROL_CHARACTERS','TITLE'],
 ['evidence-tab',{evidence:'PRIVATE_EVIDENCE_SENTINEL\t'},'CONTROL_CHARACTERS','EVIDENCE'],
 ['uncertainty-markup',{uncertainty:'<PRIVATE_UNCERTAINTY_SENTINEL>'},'CONTROL_CHARACTERS','UNCERTAINTY'],
 ['evidence-type',{evidence:null},'TEXT_TYPE','EVIDENCE'],
 ['title-empty',{title:'   '},'TEXT_REQUIRED','TITLE'],
 ['uncertainty-spaces',{uncertainty:'   '},'TEXT_REQUIRED','UNCERTAINTY'],
 ['missing-date-explanation',{startsOn:null},'MISSING_DATE_UNCERTAINTY','UNCERTAINTY'],
 ['extra-private-key',{PRIVATE_CUSTOMER_ID:'PRIVATE_CUSTOMER_VALUE'},'ROW_KEYS','ROW'],
 ['invalid-calendar-date',{startsOn:'2026-02-30'},'DATE_FORMAT','STARTS_ON','PLAN_IMPORT_DATES_INVALID'],
 ['reversed-dates',{endsOn:'2026-11-01'},'DATE_ORDER','DATES','PLAN_IMPORT_DATES_INVALID'],
];
for(const [name,patch,violation,field,code='PLAN_IMPORT_ROWS_INVALID'] of invalidCases)test('rejection diagnostics identify '+name+' without values or retries',async()=>{
 let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return response([{...row,...patch}]);}});
 const result=await analyzer.analyze(pdf);assert.deepEqual(result,{success:false,code,provider:'openai',requestedModel:'gpt-4o',model:'gpt-4o-2024-08-06',diagnostic:{violation,field,rowCount:1}});
 assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|"rows"|"warnings"|file_data|"message"|requestId|customer/i);
});

test('row count and duplicate rejections preserve original failure codes and disclose only counts',async()=>{
 for(const [rows,violation,code,count] of [[[],'ROW_COUNT','PLAN_IMPORT_ROWS_LIMIT',0],[Array.from({length:51},(_,index)=>({...row,title:'PRIVATE_TASK_'+index})),'ROW_COUNT','PLAN_IMPORT_ROWS_LIMIT',51],[[row,row],'DUPLICATE_ROWS','PLAN_IMPORT_DUPLICATE_ROWS',2]]){
  let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return response(rows);}});const result=await analyzer.analyze(pdf);
  assert.equal(result.success,false);assert.equal(result.code,code);assert.deepEqual(result.diagnostic,{violation,field:'ROWS',rowCount:count});assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|PRIVATE_TASK_0/);
 }
});

test('live checker retains observed model and safe first-rejection diagnostic but stops before PNG retry',async()=>{
 let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return response([{...row,evidence:'PRIVATE_EVIDENCE_SENTINEL\n'}]);}});
 await assert.rejects(verifyPlanImportLive({environment,analyzer}),error=>{
  assert.equal(error.code,'PLAN_IMPORT_LIVE_PROVIDER_UNCONFIRMED');assert.equal(error.proof.providerRequests,1);assert.deepEqual(error.proof.fixtures,[]);assert.equal(error.proof.model,'gpt-4o-2024-08-06');assert.deepEqual(error.proof.observedModels,['gpt-4o-2024-08-06']);
  assert.deepEqual(error.proof.providerFailure,{code:'PLAN_IMPORT_ROWS_INVALID',status:null,diagnostic:{violation:'CONTROL_CHARACTERS',field:'EVIDENCE',rowCount:1}});
  assert.doesNotMatch(JSON.stringify(error.proof),/PRIVATE_|file_data|PRIVATE_CUSTOMER_ID/);return true;
 });assert.equal(calls,1);
});

test('untrusted diagnostic data cannot smuggle values, identifiers or numeric strings into proof',async()=>{
 const valid={violation:'TEXT_LIMIT',field:'EVIDENCE',rowCount:1};assert.deepEqual(safePlanImportDiagnostic(valid),valid);
 const invalid=[{...valid,field:'PRIVATE_FIELD_SENTINEL'},{...valid,violation:'PRIVATE_REASON_SENTINEL'},{...valid,rowCount:'1'},{...valid,rowCount:-1},{...valid,rowCount:Infinity},{...valid,rowCount:192*1024+1},{...valid,message:'PRIVATE_MESSAGE_SENTINEL'},{...valid,rows:[row]},{...valid,customerId:'PRIVATE_CUSTOMER_ID'}];
 for(const diagnostic of invalid){assert.equal(safePlanImportDiagnostic(diagnostic),null);let calls=0;await assert.rejects(verifyPlanImportLive({environment,analyzer:{analyze:async()=>{calls++;return {success:false,code:'PLAN_IMPORT_ROWS_INVALID',diagnostic};}}}),error=>{assert.deepEqual(error.proof.providerFailure,{code:'PLAN_IMPORT_ROWS_INVALID',status:null});assert.doesNotMatch(JSON.stringify(error.proof),/PRIVATE_|customerId|message/);return true;});assert.equal(calls,1);}
});

test('response byte cap cancels a too-large body without parsing, retaining text or retrying',async()=>{
 let calls=0,cancelled=0;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(192*1024+1));},cancel(){cancelled++;}});
 const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return new Response(body);}});
 assert.deepEqual(await analyzer.analyze(pdf),{success:false,code:'AI_RESPONSE_TOO_LARGE'});assert.equal(calls,1);assert.equal(cancelled,1);assert.equal(body.locked,false);
});

test('model diagnostic allowlist does not echo private-looking provider or adapter labels',async()=>{
 for(const model of ['private-customer-id','gpt-4o-private-customer-id','sk-private-secret']){
  let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return Response.json({status:'completed',model,output:[]});}});
  await assert.rejects(verifyPlanImportLive({environment,analyzer}),error=>{assert.equal(error.proof.model,null);assert.deepEqual(error.proof.observedModels,[]);assert.doesNotMatch(JSON.stringify(error.proof),/private-customer|sk-private/);return true;});assert.equal(calls,1);
 }
});
