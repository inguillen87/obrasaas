import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPlanImportLive,PLAN_IMPORT_LIVE_FLAG,PLAN_IMPORT_LIVE_PROJECT} from '../scripts/lib/plan-import-live-check.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
const environment={OBRASAAS_RUN_PLAN_IMPORT_CHECK:PLAN_IMPORT_LIVE_FLAG,VERCEL_ENV:'production',VERCEL_PROJECT_ID:PLAN_IMPORT_LIVE_PROJECT,NEXT_PUBLIC_APP_URL:'https://obrasaas.com',OPENAI_API_KEY:'synthetic-local-test-token'};
const rows=[{title:'Fundaciones de prueba',startsOn:'2026-11-03',endsOn:'2026-11-06',evidence:'Fila 1',uncertainty:''},{title:'Estructura de prueba',startsOn:'2026-11-09',endsOn:'2026-11-12',evidence:'Fila 2',uncertainty:''}];
const success=()=>({success:true,provider:'openai',model:'gpt-4o',requestedModel:'gpt-4o',rows,warnings:[]});
test('live check is explicit opt-in; unrequested does not access fixtures or provider',async()=>{
 let calls=0;const result=await verifyPlanImportLive({environment:{},readFixture:()=>{calls++;},analyzer:{analyze:()=>{calls++;}}});assert.equal(result.status,'NOT_REQUESTED');assert.equal(result.providerRequests,0);assert.equal(calls,0);
});
test('live check pins exact production context and fails before provider for invalid context or missing credential',async()=>{
 for(const patch of [{OBRASAAS_RUN_PLAN_IMPORT_CHECK:'true'},{VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'another-project'},{NEXT_PUBLIC_APP_URL:'https://foreign.invalid'},{OPENAI_API_KEY:undefined},{OPENAI_API_KEY:'[SENSITIVE]'}]){
  let calls=0;await assert.rejects(verifyPlanImportLive({environment:{...environment,...patch},analyzer:{analyze:()=>{calls++;}}}));assert.equal(calls,0);
 }
});
test('committed PDF and PNG fixture hashes and two exact date rows are checked independently',async()=>{
 const types=[];const result=await verifyPlanImportLive({environment,analyzer:{analyze:async source=>{types.push(source.contentType);return success();}}});assert.deepEqual(types,['application/pdf','image/png']);assert.equal(result.status,'PASS');assert.equal(result.providerRequests,2);assert.equal(result.businessWrites,0);assert.ok(result.fixtures.every(f=>f.rowCount===2&&/^[a-f0-9]{64}$/.test(f.resultDigest)));
 const text=JSON.stringify(result);assert.doesNotMatch(text,/synthetic-local-test-token|Fundaciones de prueba|file_data|evidence|pathname/);
});
test('fixture mutation fails before either provider call',async()=>{
 let calls=0;await assert.rejects(verifyPlanImportLive({environment,analyzer:{analyze:()=>{calls++;}},readFixture:(url,encoding)=>url.pathname.endsWith('.png')?Buffer.from('changed'):readFileSync(url,encoding)}),{code:'PLAN_IMPORT_LIVE_FIXTURE_CHANGED'});assert.equal(calls,0);
});
test('refusal, ambiguous dates, unexpected rows and model mismatch fail closed without retries',async()=>{
 for(const result of [{success:false,code:'AI_RESPONSE_UNCONFIRMED'},{...success(),rows:[{...rows[0],startsOn:null,uncertainty:'Año ilegible'},rows[1]]},{...success(),rows:rows.slice(0,1)},{...success(),rows:[{...rows[0],endsOn:'2026-11-07'},rows[1]]},{...success(),model:'different-model'}]){
  let calls=0;await assert.rejects(verifyPlanImportLive({environment,analyzer:{analyze:async()=>{calls++;return result;}}}));assert.equal(calls,1);
 }
});
test('HTTP response model is verified end to end through analyzer and live checker',async()=>{
 for(const observed of ['gpt-4o-mini','gpt-4.1','',undefined]) {
  let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async()=>{calls++;return Response.json({status:'completed',model:observed,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({isSchedule:true,truncated:false,warnings:[],rows})}]}]});}});
  await assert.rejects(verifyPlanImportLive({environment,analyzer}),error=>{assert.equal(error.code,'PLAN_IMPORT_LIVE_PROVIDER_UNCONFIRMED');assert.notEqual(error.proof.status,'PASS');if(observed)assert.equal(error.proof.model,observed);assert.equal(error.proof.requestedModel,'gpt-4o');return true;});assert.equal(calls,1);
 }
 for(const observed of ['gpt-4o','gpt-4o-2024-08-06']){
  let calls=0;const analyzer=createPlanImportAnalyzer({environment:()=>environment,fetchImpl:async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).model,'gpt-4o');return Response.json({status:'completed',model:observed,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({isSchedule:true,truncated:false,warnings:[],rows})}]}]});}});
  const proof=await verifyPlanImportLive({environment,analyzer});assert.equal(proof.status,'PASS');assert.equal(proof.model,observed);assert.deepEqual(proof.observedModels,[observed]);assert.ok(proof.fixtures.every(f=>f.model===observed&&f.requestedModel==='gpt-4o'));assert.equal(calls,2);
 }
});
