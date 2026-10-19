import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {decodePlanSource,PLAN_IMPORT_CYP_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {PLAN_MEASUREMENT_PROFILE,PLAN_MEASUREMENT_CONSENT} from '../src/lib/plan-measurement-source.mjs';
import {PLAN_BUDGET_SOURCE_PROFILE,PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_SOURCE_PURPOSE,planBudgetSourceDigest} from '../src/lib/plan-budget-source.mjs';
import {budgetStoreHarness,budgetContext as context,budgetSession as session,budgetSourceFile,budgetMime,invalidBudgetZipSource} from './fixtures/plan-budget-store-synthetic.mjs';

const endpoint='https://obrasaas.com/api/identity/plan-import';
function uploadRequest(source=budgetSourceFile(),changes={},extras=[]){
 const form=new FormData();for(const [key,value]of Object.entries({...context,operationId:randomUUID(),consent:PLAN_BUDGET_SOURCE_CONSENT,...changes}))form.set(key,value);form.set('file',new Blob([source.bytes],{type:source.contentType}),'synthetic-budget.xlsx');for(const [key,value]of extras)form.append(key,value);
 return new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com'},body:form});
}
const readRequest=changes=>new Request(endpoint+'?'+new URLSearchParams({...context,...changes}));
const jsonRequest=body=>new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(body)});
function localAnalyzer(){const calls={provider:0,configuration:0};return {calls,analyzer:createPlanImportAnalyzer({environment:()=>{calls.configuration++;throw Error('No AI configuration for local budget');},fetchImpl:async()=>{calls.provider++;throw Error('No provider for local budget');}})};}

test('real local analyzer requires the exact budget profile and consent for XLSX and XLSM, without provider configuration',async()=>{
 const {analyzer,calls}=localAnalyzer();
 for(const type of ['xlsx','xlsm']){const source=budgetSourceFile({type}),result=await analyzer.analyze(source,{profile:PLAN_BUDGET_SOURCE_PROFILE,consent:PLAN_BUDGET_SOURCE_CONSENT});assert.equal(result.success,true);assert.equal(result.provider,'local-ooxml');assert.equal(result.model,null);assert.equal(result.requestedModel,null);assert.deepEqual(result.rows,[]);assert.equal(result.budgetSource.purpose,PLAN_BUDGET_SOURCE_PURPOSE);assert.equal(result.budgetSource.sourceSha256,source.sha256);assert.equal(result.budgetSource.sourceDigest,planBudgetSourceDigest(result.budgetSource));assert.equal(Object.hasOwn(result,'measurementSource'),false);assert.equal(result.budgetSource.macrosExecuted,false);}
 assert.deepEqual(calls,{provider:0,configuration:0});
});

test('budget consent cannot cross into document, physical measurement or historical schedule analysis',async()=>{
 const {analyzer,calls}=localAnalyzer(),source=budgetSourceFile(),pdf=decodePlanSource(Buffer.from('%PDF-1.7\nSynthetic budget source\n%%EOF'),'application/pdf');
 for(const [file,options]of [[source,{profile:PLAN_BUDGET_SOURCE_PROFILE}],[source,{profile:PLAN_BUDGET_SOURCE_PROFILE,consent:PLAN_IMPORT_CYP_CONSENT}],[source,{profile:PLAN_BUDGET_SOURCE_PROFILE,consent:PLAN_MEASUREMENT_CONSENT}],[source,{profile:'CYP_PARTIDAS',consent:PLAN_BUDGET_SOURCE_CONSENT}],[source,{profile:PLAN_MEASUREMENT_PROFILE,consent:PLAN_BUDGET_SOURCE_CONSENT}],[pdf,{profile:PLAN_BUDGET_SOURCE_PROFILE,consent:PLAN_BUDGET_SOURCE_CONSENT}]]){
  const result=await analyzer.analyze(file,options);assert.equal(result.success,false);assert.equal(result.code,'PLAN_IMPORT_CONSENT_REQUIRED');assert.equal(Object.hasOwn(result,'budgetSource'),false);
 }
 assert.deepEqual(calls,{provider:0,configuration:0});
});

test('authenticated HTTP uses the existing five-key multipart contract and exact GET returns private full evidence',async()=>{
 const h=budgetStoreHarness(),handlers=createPlanImportHandlers({verify:async()=>session,imports:h.imports}),source=budgetSourceFile(),upload=await handlers.POST(uploadRequest(source));assert.equal(upload.status,200);assert.equal(upload.headers.get('cache-control'),'private, no-store, max-age=0');
 const body=await upload.json(),draft=body.draft;assert.equal(draft.budgetImport,true);assert.equal(draft.financialSource,true);assert.equal(draft.budgetDescriptor.projectId,context.projectId);assert.equal(draft.budgetDescriptor.sourceSha256,source.sha256);assert.equal(Object.hasOwn(draft,'budgetSource'),false);
 const list=await handlers.GET(readRequest({})),listing=await list.json();assert.equal(list.status,200);assert.equal(Object.hasOwn(listing.drafts[0],'budgetSource'),false);
 const exact=await handlers.GET(readRequest({draftId:draft.id})),detail=await exact.json();assert.equal(exact.status,200);assert.equal(exact.headers.get('vary'),'Cookie, Authorization');assert.equal(detail.canApprove,true);assert.equal(detail.draft.budgetSource.sourceDigest,draft.budgetDescriptor.sourceDigest);assert.equal(detail.draft.budgetSource.sourceSha256,source.sha256);assert.deepEqual(h.state().logs.get(draft.id).metadata.analysis.budgetDescriptor,draft.budgetDescriptor);
 const original=await handlers.GET(readRequest({draftId:draft.id,source:'1'}));assert.equal(original.status,200);assert.equal(original.headers.get('content-type'),budgetMime);assert.deepEqual(Buffer.from(await original.arrayBuffer()),source.bytes);assert.equal(h.calls.provider,0);assert.equal(h.calls.taskReads,0);assert.equal(h.calls.taskWrites,0);
});

test('HTTP rejects extra multipart proof, duplicate consent and unsupported queries without reserving or analyzing a source',async()=>{
 const h=budgetStoreHarness(),handlers=createPlanImportHandlers({verify:async()=>session,imports:h.imports});
 for(const request of [uploadRequest(undefined,{},[['budgetSource','{"forged":true}']]),uploadRequest(undefined,{},[['consent',PLAN_BUDGET_SOURCE_CONSENT]])]){const response=await handlers.POST(request);assert.equal(response.status,400);assert.equal((await response.json()).code,'PLAN_IMPORT_INPUT_INVALID');}
 for(const query of [{budget:'1'},{source:'1'},{draftId:'synthetic-draft',budgetSource:'1'}])assert.equal((await handlers.GET(readRequest(query))).status,400);
 assert.equal(h.state().logs.size,0);assert.equal(h.calls.get,0);assert.equal(h.calls.put,0);assert.equal(h.calls.analyzer,0);
});

test('HTTP permission denial precedes malformed ZIP parsing for low roles and ADMIN channelProof',async()=>{
 for(const mode of ['SITE_MANAGER','CHANNEL_ADMIN']){
  const h=budgetStoreHarness();if(mode==='SITE_MANAGER')h.setRole(mode);else h.setChannelProof({channel:'WHATSAPP',synthetic:true});
  const handlers=createPlanImportHandlers({verify:async()=>session,imports:h.imports}),response=await handlers.POST(uploadRequest(invalidBudgetZipSource()));assert.equal(response.status,403);assert.equal((await response.json()).code,'PLAN_IMPORT_PERMISSION_REQUIRED');assert.equal(h.state().logs.size,0);assert.equal(h.calls.analyzer,0);assert.equal(h.calls.get,0);assert.equal(h.calls.put,0);
 }
});

test('the one MiB JSON cap never accepts a client-supplied two MiB budget proof or creates a decision receipt',async()=>{
 const h=budgetStoreHarness(),handlers=createPlanImportHandlers({verify:async()=>session,imports:h.imports});
 const response=await handlers.POST(jsonRequest({...context,operationId:randomUUID(),action:'APPLY',budgetSource:'x'.repeat(1024*1024)}));assert.equal(response.status,413);assert.equal((await response.json()).code,'PLAN_IMPORT_INPUT_INVALID');assert.equal(h.state().logs.size,0);assert.equal(h.calls.analyzer,0);assert.equal(h.calls.taskWrites,0);
});

test('HTTP preserves private response headers and reports revoked budget access as 403 without exposing source facts',async()=>{
 const h=budgetStoreHarness(),handlers=createPlanImportHandlers({verify:async()=>session,imports:h.imports}),uploaded=await (await handlers.POST(uploadRequest())).json();h.setRole('SITE_MANAGER');
 for(const query of [{draftId:uploaded.draft.id},{draftId:uploaded.draft.id,source:'1'}]){const response=await handlers.GET(readRequest(query)),body=await response.json();assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(body.code,'PLAN_IMPORT_PERMISSION_REQUIRED');assert.equal(Object.hasOwn(body,'draft'),false);assert.equal(JSON.stringify(body).includes('999.0000'),false);}
});
