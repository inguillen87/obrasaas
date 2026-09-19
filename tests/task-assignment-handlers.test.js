import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assignmentId,assignmentFailure,TaskAssignmentError } from '../src/lib/task-assignment-policy.js';
import { assertEvidenceRequestContext,evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const code=fs.readFileSync(new URL('../src/lib/task-assignment-handlers.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error{}class RequestBodyError extends Error{}
function fixture(overrides={}){
  const calls={db:0,permissions:[],input:null};const access={organization:{id:'org-a'},project:{id:'project-a'},databaseUserId:'manager-a'};
  const deps={AccessError,RequestBodyError,TaskAssignmentError,assignmentId,assignmentFailure,assertEvidenceRequestContext,evidenceContextErrorResponse,
    accessErrorResponse:()=>Response.json({},{status:403}),requestBodyErrorResponse:()=>Response.json({},{status:400}),projectWritePolicyErrorResponse:()=>null,projectExecutionErrorResponse:()=>null,
    getPlatformAccess:async()=>access,requireTenantPermission:()=>{},getPrisma:()=>({}),prepareTaskAssignment:async()=>({}),planTaskAssignment:async()=>({}),getTaskAssignment:async()=>({}),decideTaskAssignment:async()=>({}),readJsonRequest:async request=>request.json()};
  const factory=new Function(...Object.keys(deps),code+'\nreturn createTaskAssignmentHandlers;')(...Object.values(deps));
  const read=async(db,input)=>{calls.input=input;return {assignment:{},replayed:false};};
  return {calls,handlers:factory({resolveAccess:async()=>access,authorize:(a,p,o)=>calls.permissions.push([p,o.subscriptionMode]),database:()=>{calls.db++;return{};},prepare:read,plan:read,read,decide:read,...overrides})};
}
const params={params:Promise.resolve({assignmentId:'assignment-a'})};
const request=(method='GET',headers={},query='')=>new Request('https://obra.test/api/execution/assignments'+query,{method,headers:{'Content-Type':'application/json','X-ObraSaaS-Project':'project-a','X-ObraSaaS-Organization':'org-a','Idempotency-Key':'request-key-00000001',...headers},...(['POST','PATCH'].includes(method)?{body:'{"taskId":"task-a"}'}:{})});
for(const [name,method,query] of [['prepareGET','GET','?taskId=task-a'],['planPOST','POST',''],['detailGET','GET',''],['detailPATCH','PATCH','']])test('handler binds permissions and session context: '+name,async()=>{
  const {calls,handlers}=fixture();const result=await handlers[name](request(method,{},query),params);assert.equal(result.status,name==='planPOST'?201:200);
  assert.deepEqual(calls.input.scope,{organizationId:'org-a',projectId:'project-a'});assert.equal(calls.permissions.length,2);assert.equal(calls.permissions[1][0],'org:tasks:read');assert.match(result.headers.get('cache-control'),/private, no-store/);
  if(method==='PATCH'||method==='POST')assert.equal(calls.permissions[0][0],'org:execution:manage');
});
for(const headers of [{'X-ObraSaaS-Organization':'other'},{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Project':''},{Origin:'https://other.test'},{'Sec-Fetch-Site':'cross-site'}])test('invalid write context rejected before database '+JSON.stringify(headers),async()=>{
  const {calls,handlers}=fixture();assert.ok([403,409].includes((await handlers.planPOST(request('POST',headers))).status));assert.equal(calls.db,0);
});
for(const permission of ['org:execution:manage','org:tasks:read'])test('missing permission rejects plan and decision '+permission,async()=>{
  const {calls,handlers}=fixture({authorize:(a,p)=>{if(p===permission)throw new AccessError();}});
  assert.equal((await handlers.planPOST(request('POST'))).status,403);assert.equal((await handlers.detailPATCH(request('PATCH'),params)).status,403);assert.equal(calls.db,0);
});
test('query cannot override authority or carry duplicate task selectors',async()=>{
  for(const query of ['?tenantId=other','?taskId=a&taskId=b','?taskId=../x','']){
    const {calls,handlers}=fixture();assert.equal((await handlers.prepareGET(request('GET',{},query))).status,422);assert.equal(calls.db,0);
  }
});
test('unexpected provider detail is sanitized and not cached',async()=>{
  const {handlers}=fixture({plan:async()=>{throw new Error('private-connection-string');}});const response=await handlers.planPOST(request('POST'));
  assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private-connection-string'));assert.match(response.headers.get('cache-control'),/no-store/);
});
test('verified replay reports 200 rather than a second creation',async()=>{
  const {handlers}=fixture({plan:async()=>({assignment:{},replayed:true})});assert.equal((await handlers.planPOST(request('POST'))).status,200);
});
