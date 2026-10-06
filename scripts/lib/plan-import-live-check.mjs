import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPlanImportAnalyzer,observedPlanModel,requestedPlanModel} from '../../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,normalizePlanRows} from '../../src/lib/plan-import-policy.mjs';
export const PLAN_IMPORT_LIVE_FLAG='synthetic-plan-v1';
export const PLAN_IMPORT_LIVE_PROJECT='prj_68NErbCqCFsDVaMak81gcwsGI9pF';
const expectedRows=[{title:'Fundaciones de prueba',startsOn:'2026-11-03',endsOn:'2026-11-06'},{title:'Estructura de prueba',startsOn:'2026-11-09',endsOn:'2026-11-12'}];
const expectedFiles=[{name:'plan-import-synthetic-v1.pdf',contentType:'application/pdf',bytes:7360,sha256:'88254bd24823b0d6d8da46d0f2dfe4494f92f3d92fe7fc92080519e554dc5f12'},{name:'plan-import-synthetic-v1.png',contentType:'image/png',bytes:37236,sha256:'e57146090c0436bb75b6c8c21ee958abffae777fb5ba151081dc50def4ba91db'}];
const hash=value=>createHash('sha256').update(value).digest('hex');
export class PlanImportLiveError extends Error {constructor(code,proof){super(code);this.code=code;this.proof=proof;}}
export async function verifyPlanImportLive({environment=process.env,analyzer,readFixture=readFileSync}={}) {
 const proof={status:'NOT_REQUESTED',provider:'openai',requestedModel:requestedPlanModel,model:null,observedModels:[],syntheticOnly:true,businessWrites:0,providerRequests:0,fixtures:[]};
 if(!environment.OBRASAAS_RUN_PLAN_IMPORT_CHECK)return proof;
 proof.status='UNCONFIRMED';
 const fail=code=>{throw new PlanImportLiveError(code,proof);};
 if(environment.OBRASAAS_RUN_PLAN_IMPORT_CHECK!==PLAN_IMPORT_LIVE_FLAG||environment.VERCEL_ENV!=='production'||environment.VERCEL_PROJECT_ID!==PLAN_IMPORT_LIVE_PROJECT||environment.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com')fail('PLAN_IMPORT_LIVE_CONTEXT_REJECTED');
 if(typeof environment.OPENAI_API_KEY!=='string'||!environment.OPENAI_API_KEY.trim()||environment.OPENAI_API_KEY==='[SENSITIVE]')fail('PLAN_IMPORT_LIVE_PROVIDER_NOT_CONFIGURED');
 let metadata,sources;
 try {
  metadata=JSON.parse(readFixture(new URL('../fixtures/plan-import-synthetic-v1.json',import.meta.url),'utf8'));
  if(metadata.version!==PLAN_IMPORT_LIVE_FLAG||metadata.syntheticOnly!==true||metadata.containsPersonalData!==false||JSON.stringify(metadata.expectedRows)!==JSON.stringify(expectedRows)||JSON.stringify(metadata.files)!==JSON.stringify(expectedFiles))fail('PLAN_IMPORT_LIVE_FIXTURE_CHANGED');
  sources=expectedFiles.map(file=>{const bytes=readFixture(new URL('../fixtures/'+file.name,import.meta.url));if(bytes.length!==file.bytes||hash(bytes)!==file.sha256)fail('PLAN_IMPORT_LIVE_FIXTURE_CHANGED');return decodePlanSource(bytes,file.contentType);});
 }catch(error){if(error instanceof PlanImportLiveError)throw error;fail('PLAN_IMPORT_LIVE_FIXTURE_UNCONFIRMED');}
 const adapter=analyzer||createPlanImportAnalyzer({environment:()=>environment});
 for(const [index,source] of sources.entries()) {
  proof.providerRequests++;
  let result;try{result=await adapter.analyze(source);}catch{fail('PLAN_IMPORT_LIVE_PROVIDER_UNCONFIRMED');}
  if(typeof result?.model==='string'&&/^[a-z0-9.-]{1,80}$/.test(result.model)){proof.model=result.model;if(!proof.observedModels.includes(result.model))proof.observedModels.push(result.model);}
  if(result?.success!==true||result.provider!=='openai'||result.requestedModel!==requestedPlanModel||!observedPlanModel(result.model))fail('PLAN_IMPORT_LIVE_PROVIDER_UNCONFIRMED');
  let rows;try{rows=normalizePlanRows(result.rows,{complete:true});}catch{fail('PLAN_IMPORT_LIVE_EXTRACTION_UNCONFIRMED');}
  if(JSON.stringify(rows.map(({title,startsOn,endsOn})=>({title,startsOn,endsOn})))!==JSON.stringify(expectedRows))fail('PLAN_IMPORT_LIVE_EXTRACTION_UNCONFIRMED');
  proof.fixtures.push({contentType:expectedFiles[index].contentType,sourceSha256:source.sha256,model:result.model,requestedModel:result.requestedModel,rowCount:rows.length,resultDigest:hash(JSON.stringify(rows))});
 }
 proof.status='PASS';return proof;
}
