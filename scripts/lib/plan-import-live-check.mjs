import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPlanImportAnalyzer,observedPlanModel,requestedPlanModel,safePlanDiagnosticModel} from '../../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,normalizePlanRows,safePlanImportDiagnostic} from '../../src/lib/plan-import-policy.mjs';
export const PLAN_IMPORT_LIVE_FLAG='synthetic-plan-v1';
export const PLAN_IMPORT_LIVE_PROJECT='prj_68NErbCqCFsDVaMak81gcwsGI9pF';
const expectedRows=[{title:'Fundaciones de prueba',startsOn:'2026-11-03',endsOn:'2026-11-06'},{title:'Estructura de prueba',startsOn:'2026-11-09',endsOn:'2026-11-12'}];
const expectedFiles=[{name:'plan-import-synthetic-v1.pdf',contentType:'application/pdf',bytes:7360,sha256:'88254bd24823b0d6d8da46d0f2dfe4494f92f3d92fe7fc92080519e554dc5f12'},{name:'plan-import-synthetic-v1.png',contentType:'image/png',bytes:37236,sha256:'e57146090c0436bb75b6c8c21ee958abffae777fb5ba151081dc50def4ba91db'}];
const hash=value=>createHash('sha256').update(value).digest('hex');
const safeFailureCodes=new Set(['AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_REQUEST_REJECTED','AI_REQUEST_UNCONFIRMED','AI_RESPONSE_UNCONFIRMED','AI_RESPONSE_TOO_LARGE','AI_RESPONSE_MODEL_UNCONFIRMED','AI_RESPONSE_INVALID','PLAN_IMPORT_NOT_A_SCHEDULE','PLAN_IMPORT_FILE_INVALID','PLAN_IMPORT_FILE_TOO_LARGE','PLAN_IMPORT_DATES_INVALID','PLAN_IMPORT_DUPLICATE_ROWS','PLAN_IMPORT_INPUT_INVALID','PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_ROWS_INVALID','PLAN_IMPORT_ROWS_LIMIT']);
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
  const model=safePlanDiagnosticModel(result?.model);if(model){proof.model=model;if(!proof.observedModels.includes(model))proof.observedModels.push(model);}
  if(result?.success!==true||result.provider!=='openai'||result.requestedModel!==requestedPlanModel||!observedPlanModel(result.model)){const diagnostic=safePlanImportDiagnostic(result?.diagnostic);proof.providerFailure={code:safeFailureCodes.has(result?.code)?result.code:'AI_RESPONSE_UNCONFIRMED',status:Number.isInteger(result?.providerStatus)&&result.providerStatus>=400&&result.providerStatus<=599?result.providerStatus:null,...(diagnostic?{diagnostic}:{})};fail('PLAN_IMPORT_LIVE_PROVIDER_UNCONFIRMED');}
  let rows;try{rows=normalizePlanRows(result.rows,{complete:true});}catch{fail('PLAN_IMPORT_LIVE_EXTRACTION_UNCONFIRMED');}
  if(JSON.stringify(rows.map(({title,startsOn,endsOn})=>({title,startsOn,endsOn})))!==JSON.stringify(expectedRows))fail('PLAN_IMPORT_LIVE_EXTRACTION_UNCONFIRMED');
  proof.fixtures.push({contentType:expectedFiles[index].contentType,sourceSha256:source.sha256,model:result.model,requestedModel:result.requestedModel,rowCount:rows.length,resultDigest:hash(JSON.stringify(rows))});
 }
 proof.status='PASS';return proof;
}
