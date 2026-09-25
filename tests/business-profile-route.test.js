import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { roleHasPermission } from '../src/lib/tenant-roles.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { BusinessProfileError, businessProfileFromMetadata, businessProfilePaths } from '../src/lib/organization-business-profile.js';
const source=fs.readFileSync(new URL('../src/app/api/tenant/business-profile/route.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error{} class RequestBodyError extends Error{}
const profile={configured:true,kind:'CONSTRUCTOR',market:'PRIVATE',revision:1,updatedAt:'2026-09-18T12:00:00Z'};
function fixture(role='ADMIN',overrides={}) {
 const calls={db:0,write:0,options:null,limits:null,checks:[]};const access={organization:{id:'org-a'},project:{id:'project-a'},databaseUserId:'actor-a'};
 const deps={AccessError,RequestBodyError,BusinessProfileError,businessProfileFromMetadata,businessProfilePaths,assertEvidenceRequestContext,evidenceContextErrorResponse,
  accessErrorResponse:()=>Response.json({code:'DENIED'},{status:403}),requestBodyErrorResponse:()=>Response.json({},{status:400}),getPlatformAccess:async()=>access,
  requireTenantPermission:(a,p,options)=>{assert.equal(a,access);calls.checks.push({p,options});if(!roleHasPermission(role,p))throw new AccessError();},hasTenantPermission:(a,p)=>roleHasPermission(role,p),
  getPrisma:()=>{calls.db++;return{organization:{findUnique:async({where})=>{assert.equal(where.id,'org-a');return{metadata:{businessProfile:{schemaVersion:1,...profile}}};}}};},
  readJsonRequest:async(request,limits)=>{calls.limits=limits;return request.json();},updateBusinessProfile:async(db,options)=>{calls.write++;calls.options=options;return{profile,unchanged:false};},...overrides};
 return{calls,handlers:new Function(...Object.keys(deps),source+'\nreturn {GET,PATCH};')(...Object.values(deps))};
}
const request=(method='PATCH',headers={},query='')=>new Request('https://obra.test/api/tenant/business-profile'+query,{method,headers:{'Content-Type':'application/json','X-ObraSaaS-Project':'project-a','X-ObraSaaS-Organization':'org-a',...headers},...(method==='PATCH'?{body:JSON.stringify({kind:'CONSTRUCTOR',market:'PRIVATE',expectedRevision:0})}:{})});
for(const method of ['GET','PATCH'])test('scoped profile '+method+' returns only a public profile and role-filtered routes',async()=>{const{handlers,calls}=fixture();const response=await handlers[method](request(method));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);const body=await response.json();assert.equal(body.organizationId,'org-a');assert.equal(body.projectId,'project-a');assert.equal(body.profile.kind,'CONSTRUCTOR');assert.equal(body.metadata,undefined);if(method==='PATCH'){assert.equal(calls.options.organizationId,'org-a');assert.equal(calls.options.actorId,'actor-a');assert.equal(calls.limits.maxBytes,8192);assert.ok(calls.checks.some(c=>c.p==='tenant:members:manage'&&c.options.subscriptionMode==='write'));}});
for(const role of ['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'])test('organization profile cannot be changed by '+role,async()=>{const{handlers,calls}=fixture(role);assert.equal((await handlers.PATCH(request())).status,403);assert.equal(calls.db,0);});
for(const headers of [{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Organization':'other'},{'X-ObraSaaS-Project':''}])test('context change rejected before persistence '+JSON.stringify(headers),async()=>{const{handlers,calls}=fixture();assert.equal((await handlers.PATCH(request('PATCH',headers))).status,409);assert.equal(calls.db,0);});
for(const headers of [{Origin:'https://other.test'},{'Sec-Fetch-Site':'cross-site'}])test('cross-site profile write rejected '+JSON.stringify(headers),async()=>{const{handlers,calls}=fixture();assert.equal((await handlers.PATCH(request('PATCH',headers))).status,403);assert.equal(calls.db,0);});
test('tenant query override is not accepted',async()=>{const{handlers,calls}=fixture();assert.equal((await handlers.GET(request('GET',{},'?organizationId=other'))).status,403);assert.equal(calls.db,0);});
test('unexpected failure is sanitized and not confirmed',async()=>{const{handlers}=fixture('ADMIN',{updateBusinessProfile:async()=>{throw new Error('private connection');}});const response=await handlers.PATCH(request());assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private connection'));});
