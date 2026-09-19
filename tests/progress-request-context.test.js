import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createProgressRequest, confirmedProgressLog } from '../src/lib/progress-request.js';
import { withJournalCorrectionLinks } from '../src/lib/journal-correction.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const scope={organizationId:'org-A',projectId:'project-A'};
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function fixture(context=scope, reviewer=true){
 const calls={data:0,read:0,write:0,review:0};
 const deps={withJournalCorrectionLinks,AccessError,RequestBodyError,assertEvidenceRequestContext,evidenceContextErrorResponse,
  accessErrorResponse:()=>Response.json({}, {status:403}),requestBodyErrorResponse:()=>Response.json({}, {status:400}),
  protectedUploadErrorResponse:()=>null,projectWritePolicyErrorResponse:()=>null,progressJournalErrorResponse:()=>null,
  SOURCE_EVIDENCE_PERMISSION:'org:field:evidence:read',
  getPlatformAccess:async()=>({organization:{id:context.organizationId},project:{id:context.projectId},databaseUserId:'trusted-actor'}),
  hasTenantPermission:()=>true,requireTenantPermission:(access,p)=>{if(p==='org:progress:review'&&!reviewer)throw new AccessError();},
  getPrisma:()=>{calls.data++;return{};},readJsonRequest:req=>req.json(),
  listProgressJournal:async()=>{calls.read++;return{dailyLogs:[],evidence:[]};},
  createProgressJournalRecord:async(prisma,options)=>{calls.write++;return{dailyLog:{id:'log',status:'DRAFT',revision:0},scope:options.scope,actorId:options.actorId};},
  reviewProgressRecord:async()=>{calls.review++;return{dailyLog:{id:'log',status:'APPROVED',revision:1}};},
 };
 const compile=(path,names)=>new Function(...Object.keys(deps),source(path).replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm,'').replace(/export async function /g,'async function ')+'\nreturn {'+names+'};')(...Object.values(deps));
 const base=compile('src/app/api/progress/route.js','GET,POST'),review=compile('src/app/api/progress/[recordId]/route.js','PATCH');
 const fetchImpl=async(path,options={})=>{const req=new Request('https://obra.test'+path,options);return req.method==='PATCH'?review.PATCH(req,{params:Promise.resolve({recordId:'log'})}):base[req.method](req);};
 return{calls,fetchImpl};
}
const creation={method:'POST',body:JSON.stringify({kind:'DAILY_LOG',title:'Ensayo',summary:'Sintético',workDate:'2026-09-18'})};
const decision={method:'PATCH',body:JSON.stringify({kind:'DAILY_LOG',status:'APPROVED',expectedRevision:0})};
for(const context of [{...scope,projectId:'project-B'},{...scope,organizationId:'org-B'}]){
 for(const [path,options] of [['/api/progress',creation],['/api/progress?limit=50',{}],['/api/progress/log',decision]])test('context mismatch rejects before persistence: '+JSON.stringify(context)+' '+(options.method||'GET'),async()=>{
  const f=fixture(context);await assert.rejects(createProgressRequest(scope,{fetchImpl:f.fetchImpl})(path,options),{code:'EVIDENCE_CONTEXT_CHANGED',status:409});assert.equal(f.calls.data,0);
 });
}
test('matching headers retain authoritative actor and scope',async()=>{const f=fixture();const result=await createProgressRequest(scope,{fetchImpl:f.fetchImpl})('/api/progress',creation);assert.deepEqual(result.scope,scope);assert.equal(result.actorId,'trusted-actor');});
test('context conditions do not grant review permission',async()=>{const f=fixture(scope,false);await assert.rejects(createProgressRequest(scope,{fetchImpl:f.fetchImpl})('/api/progress/log',decision),{status:403});assert.equal(f.calls.data,0);});
test('legacy requests with no headers remain compatible',async()=>{const f=fixture();assert.equal((await f.fetchImpl('/api/progress',creation)).status,201);});
test('partial context is rejected',async()=>{const f=fixture();const response=await f.fetchImpl('/api/progress',{...creation,headers:{'X-ObraSaaS-Project':'project-A'}});assert.equal(response.status,409);assert.equal(f.calls.data,0);});
for(const originalHeaders of [{'x-obrasaas-project':'wrong','idempotency-key':'same-op'},new Headers({'x-obrasaas-project':'wrong','idempotency-key':'same-op'}),[['x-obrasaas-project','wrong'],['idempotency-key','same-op']]])test('immutable context and retained idempotency: '+originalHeaders.constructor.name,async()=>{
 let sent;const original={...scope};const request=createProgressRequest(original,{fetchImpl:async(path,options)=>{sent=options;return Response.json({});}});original.projectId='changed';await request('/api/progress',{headers:originalHeaders,cache:'force-cache'});assert.equal(sent.headers.get('x-obrasaas-project'),'project-A');assert.equal(sent.headers.get('idempotency-key'),'same-op');assert.equal(sent.cache,'no-store');
});
for(const body of ['not-json','null','[]','"text"'])test('malformed response is not confirmation: '+body,async()=>assert.rejects(createProgressRequest(scope,{fetchImpl:async()=>new Response(body)})('/api/progress'),{code:'PROGRESS_RESPONSE_UNCONFIRMED'}));
test('no automatic retry after network failure',async()=>{let calls=0;await assert.rejects(createProgressRequest(scope,{fetchImpl:async()=>{calls++;throw new Error('network');}})('/api/progress'));assert.equal(calls,1);});
test('missing context does not contact server',async()=>{let calls=0;await assert.rejects(createProgressRequest({}, {fetchImpl:async()=>{calls++;}})('/api/progress'));assert.equal(calls,0);});
for(const path of ['https://other.test/api/x','//other.test/api/x','/api/../../external','/api/\\other.test'])test('non-internal destination denied: '+path,async()=>{let calls=0;await assert.rejects(createProgressRequest(scope,{fetchImpl:async()=>{calls++;}})(path));assert.equal(calls,0);});
test('stale editor stops all subsequent network calls',async()=>{let calls=0,notices=0;const request=createProgressRequest(scope,{onContextChange:()=>notices++,fetchImpl:async()=>{calls++;return Response.json({code:'EVIDENCE_CONTEXT_CHANGED'},{status:409});}});await assert.rejects(request('/api/progress'));await assert.rejects(request('/api/progress/log',decision));assert.equal(calls,1);assert.equal(notices,1);});
test('version conflict is not a context change',async()=>{let notices=0;await assert.rejects(createProgressRequest(scope,{onContextChange:()=>notices++,fetchImpl:async()=>Response.json({code:'PROGRESS_JOURNAL_CONFLICT'},{status:409})})('/api/progress'));assert.equal(notices,0);});
test('analysis creation indicator remains available on failures',async()=>assert.rejects(createProgressRequest(scope,{fetchImpl:async()=>Response.json({assessmentId:'synthetic',code:'PENDING'},{status:409})})('/api/progress'),{assessmentCreated:true}));
for(const body of [{},{dailyLog:{}},{dailyLog:{id:'x',status:'DRAFT'}},{dailyLog:{id:'x',status:'UNKNOWN',revision:0}},{dailyLog:{id:'',status:'DRAFT',revision:0}}])test('incomplete creation cannot clear editor: '+JSON.stringify(body),()=>assert.throws(()=>confirmedProgressLog(body),{code:'PROGRESS_RESPONSE_UNCONFIRMED'}));
test('valid creation returns the authoritative log',()=>{const dailyLog={id:'x',status:'DRAFT',revision:0};assert.equal(confirmedProgressLog({dailyLog}),dailyLog);});
