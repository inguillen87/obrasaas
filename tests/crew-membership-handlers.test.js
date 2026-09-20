import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CrewMembershipError,crewFailure,crewId,crewQuery } from '../src/lib/crew-membership-policy.js';
import { assertEvidenceRequestContext,evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const code=readFileSync(new URL('../src/lib/crew-membership-handlers.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error{}class RequestBodyError extends Error{}
function fixture(overrides={}){
  const calls={db:0,input:null,permissions:[]};const deps={AccessError,RequestBodyError,CrewMembershipError,crewId,crewQuery,crewFailure,assertEvidenceRequestContext,evidenceContextErrorResponse,
    accessErrorResponse:()=>Response.json({},{status:403}),requestBodyErrorResponse:()=>Response.json({},{status:400}),projectWritePolicyErrorResponse:()=>null,projectExecutionErrorResponse:()=>null,
    getPlatformAccess:()=>{},requireTenantPermission:()=>{},getPrisma:()=>{},readJsonRequest:request=>request.json(),readCrewRoster:()=>{},addCrewMember:()=>{},getCrewMember:()=>{},decideCrewMember:()=>{}};
  const factory=new Function(...Object.keys(deps),code+'\nreturn createCrewMembershipHandlers;')(...Object.values(deps));
  const run=async(db,input)=>{calls.input=input;return {replayed:false};};
  return {calls,handlers:factory({resolveAccess:async()=>({organization:{id:'org-a'},project:{id:'project-a'},databaseUserId:'actor-a'}),authorize:(a,p,o)=>calls.permissions.push([p,o.subscriptionMode]),database:()=>{calls.db++;return{};},list:run,add:run,read:run,decide:run,...overrides})};
}
const params={params:Promise.resolve({teamId:'team-a',memberId:'member-a'})};
const request=(method,headers={},query='')=>new Request('https://obra.test/api/execution/teams/team-a/members'+query,{method,headers:{'X-ObraSaaS-Organization':'org-a','X-ObraSaaS-Project':'project-a','Content-Type':'application/json','Idempotency-Key':'crew-request-0000001',...headers},...(['POST','PATCH'].includes(method)?{body:'{"workerId":"worker-a"}'}:{})});
for(const [method,name] of [['GET','listGET'],['POST','addPOST'],['GET','memberGET'],['PATCH','memberPATCH']])test('session-scoped roster handler '+name,async()=>{
  const {handlers,calls}=fixture();const response=await handlers[name](request(method),params);assert.equal(response.status,method==='POST'?201:200);assert.deepEqual(calls.input.scope,{organizationId:'org-a',projectId:'project-a'});assert.equal(calls.input.teamId,'team-a');assert.equal(calls.input.actorId,'actor-a');assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(calls.permissions[0][0],method==='GET'?'org:execution:read':'org:execution:manage');
});
for(const headers of [{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Organization':'other'},{'X-ObraSaaS-Project':''},{Origin:'https://other.test'},{'Sec-Fetch-Site':'cross-site'}])test('unsafe write rejected before data '+JSON.stringify(headers),async()=>{const {handlers,calls}=fixture();assert.ok([403,409].includes((await handlers.addPOST(request('POST',headers),params)).status));assert.equal(calls.db,0);});
test('missing manage permission blocks add and membership changes',async()=>{const {handlers,calls}=fixture({authorize:()=>{throw new AccessError();}});assert.equal((await handlers.addPOST(request('POST'),params)).status,403);assert.equal((await handlers.memberPATCH(request('PATCH'),params)).status,403);assert.equal(calls.db,0);});
test('query cannot choose tenant or override path IDs',async()=>{for(const query of ['?teamId=other','?view=current&view=all','?after=../x']){const {handlers,calls}=fixture();assert.equal((await handlers.listGET(request('GET',{},query),params)).status,422);assert.equal(calls.db,0);}});
test('unconfirmed errors remain private and replay uses 200',async()=>{const f=fixture({add:async()=>{throw new Error('secret-host-detail');}});const response=await f.handlers.addPOST(request('POST'),params);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret-host-detail'));const r=fixture({add:async()=>({replayed:true})});assert.equal((await r.handlers.addPOST(request('POST'),params)).status,200);});
