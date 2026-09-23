import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TaskAssignmentError,assignmentFailure,assignmentId } from '../src/lib/task-assignment-policy.js';
import { assertEvidenceRequestContext,evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const code=readFileSync(new URL('../src/lib/assignment-reschedule-handlers.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error{}class RequestBodyError extends Error{}
function fixture(overrides={}){
  const calls={db:0,input:null,permissions:[],read:0,review:0,save:0};
  const deps={AccessError,RequestBodyError,TaskAssignmentError,assignmentId,assignmentFailure,assertEvidenceRequestContext,evidenceContextErrorResponse,
    accessErrorResponse:()=>Response.json({},{status:403}),requestBodyErrorResponse:()=>Response.json({},{status:400}),projectWritePolicyErrorResponse:()=>null,
    getPlatformAccess:()=>{},requireTenantPermission:()=>{},getPrisma:()=>{},getAssignmentReschedule:()=>{},reviewAssignmentReschedule:()=>{},commitAssignmentReschedule:()=>{},readJsonRequest:request=>request.json()};
  const factory=new Function(...Object.keys(deps),code+'\nreturn createAssignmentRescheduleHandlers;')(...Object.values(deps));
  const run=kind=>async(db,input)=>{calls[kind]++;calls.input=input;return {context:input.scope};};
  return {calls,handlers:factory({resolveAccess:async()=>({organization:{id:'org-a'},project:{id:'project-a'},databaseUserId:'actor-a'}),authorize:(a,p,o)=>calls.permissions.push([p,o.subscriptionMode]),database:()=>{calls.db++;return{};},read:run('read'),review:run('review'),save:run('save'),...overrides})};
}
const params={params:Promise.resolve({assignmentId:'assignment-a'})};
const request=(method,headers={},query='')=>new Request('https://obra.test/api/execution/assignments/assignment-a/reschedule'+query,{method,headers:{'X-ObraSaaS-Organization':'org-a','X-ObraSaaS-Project':'project-a','Content-Type':'application/json',...headers},...(method!=='GET'?{body:'{"expectedRevision":0,"startsOn":"2026-10-05","endsOn":"2026-10-09"}'}:{})});
for(const method of ['GET','POST','PATCH'])test('context and distinct read/review/save handler '+method,async()=>{const {handlers,calls}=fixture();const response=await handlers[method](request(method),params);assert.equal(response.status,200);assert.deepEqual(calls.input.scope,{organizationId:'org-a',projectId:'project-a'});assert.equal(calls.input.assignmentId,'assignment-a');assert.equal(calls.input.actorId,'actor-a');assert.equal(calls[method==='GET'?'read':method==='POST'?'review':'save'],1);assert.equal(calls.permissions[0][0],method==='GET'?'org:execution:read':'org:execution:manage');assert.equal(calls.permissions[1][0],'org:tasks:read');assert.match(response.headers.get('cache-control'),/private, no-store/);});
test('changing URL context, foreign headers and cross-site writes fail before database access',async()=>{for(const [headers,query] of [[{'X-ObraSaaS-Organization':'other'},''],[{'X-ObraSaaS-Project':''},''],[{Origin:'https://other.test'},''],[{'Sec-Fetch-Site':'cross-site'},''],[{},'?projectId=other']]){const {handlers,calls}=fixture();assert.ok([403,409,422].includes((await handlers.PATCH(request('PATCH',headers,query),params)).status));assert.equal(calls.db,0);}});
test('permission failure cannot run review or mutation',async()=>{const {handlers,calls}=fixture({authorize:()=>{throw new AccessError();}});assert.equal((await handlers.POST(request('POST'),params)).status,403);assert.equal((await handlers.PATCH(request('PATCH'),params)).status,403);assert.equal(calls.db,0);});
test('unknown errors never expose connection diagnostics',async()=>{const {handlers}=fixture({save:()=>{throw new Error('private-database-detail');}});const response=await handlers.PATCH(request('PATCH'),params);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private-database-detail'));});
