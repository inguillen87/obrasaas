import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { roleHasPermission } from '../src/lib/tenant-roles.js';
import { assertSignupScreenContext, signupScreenContextResponse } from '../src/lib/whatsapp/signup-screen-context.js';
import { evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { TenantWorkspaceError, tenantWorkspaceErrorResponse } from '../src/lib/whatsapp/tenant-workspace-policy.js';
const source = fs.readFileSync(new URL('../src/app/api/integrations/whatsapp/workspace/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class AccessError extends Error {}
class RequestBodyError extends Error {}
function fixture(role = 'ADMIN', overrides = {}) {
  const calls = { database: 0, reads: 0, writes: 0, options: null, limits: null };
  const access = { organization: { id: 'company-a', name: 'Cliente A', clerkOrganizationId: 'org_customer_a' }, project: { id: 'project-a' }, databaseUserId: 'admin-a' };
  const dependencies = { AccessError, RequestBodyError, TenantWorkspaceError, tenantWorkspaceErrorResponse, assertSignupScreenContext, signupScreenContextResponse, evidenceContextErrorResponse,
    getPlatformAccess: async () => access,
    requireTenantPermission: (current, permission, options) => { assert.equal(current, access); assert.ok(['read','write'].includes(options.subscriptionMode)); if (!roleHasPermission(role, permission)) throw new AccessError(); },
    accessErrorResponse: () => Response.json({code:'DENIED'},{status:403}), requestBodyErrorResponse: () => Response.json({code:'BODY_INVALID'},{status:400}),
    getPrisma: () => { calls.database++; return {}; }, readJsonRequest: async (request, limits) => { calls.limits=limits;return request.json(); },
    readTenantWorkspace: async (db,options) => { calls.reads++;calls.options=options;return {profile:{}}; },
    saveTenantWorkspace: async (db,options) => { calls.writes++;calls.options=options;return {profile:{}}; }, ...overrides };
  return { calls, routes: new Function(...Object.keys(dependencies), source+'\nreturn {GET,POST};')(...Object.values(dependencies)) };
}
function request(method='GET', headers={}, query='') {
  return new Request('https://obra.test/api/integrations/whatsapp/workspace'+query,{method,headers:{Origin:'https://obra.test','Content-Type':'application/json','X-ObraSaaS-Organization':'company-a','X-ObraSaaS-Project':'project-a',...headers},...(method==='POST'?{body:JSON.stringify({assistantName:'Asistente de ensayo'})}:{})});
}
for(const method of ['GET','POST'])test('authenticated '+method+' derives organization and actor from session',async()=>{
  const {routes,calls}=fixture();const response=await routes[method](request(method));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
  assert.deepEqual(calls.options.scope,{organizationId:'company-a',projectId:'project-a'});if(method==='POST'){assert.equal(calls.options.actorId,'admin-a');assert.equal(calls.limits.maxBytes,4096);}else assert.equal(calls.writes,0);
});
for(const role of ['AUDITOR','FINANCE','OPERARIO'])test('role cannot configure a tenant by calling API directly: '+role,async()=>{
  const {routes,calls}=fixture(role);assert.equal((await routes.POST(request('POST'))).status,403);assert.equal(calls.database,0);
});
for(const headers of [{'X-ObraSaaS-Organization':'foreign'},{'X-ObraSaaS-Project':'foreign'},{'X-ObraSaaS-Project':''}])test('mismatched screen is rejected before storage: '+JSON.stringify(headers),async()=>{
  const {routes,calls}=fixture();assert.equal((await routes.POST(request('POST',headers))).status,409);assert.equal(calls.database,0);
});
for(const headers of [{Origin:'https://foreign.test'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}])test('cross-origin writes are rejected: '+JSON.stringify(headers),async()=>{
  const {routes,calls}=fixture();assert.equal((await routes.POST(request('POST',headers))).status,403);assert.equal(calls.database,0);
});
test('URL cannot supply tenant, mode or fields outside the contract',async()=>{
  const {routes,calls}=fixture();assert.equal((await routes.GET(request('GET',{},'?tenant=foreign'))).status,422);assert.equal(calls.database,0);
});
test('unknown internal and upstream errors never appear in public result',async()=>{
  const {routes}=fixture('ADMIN',{saveTenantWorkspace:async()=>{throw new Error('private-upstream-payload');}});
  const response=await routes.POST(request('POST'));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private-upstream-payload'));
});
test('typed public errors use product copy instead of arbitrary attached messages',async()=>{
  const {routes}=fixture('ADMIN',{saveTenantWorkspace:async()=>{throw new TenantWorkspaceError('private-upstream-payload','WORKSPACE_CONFLICT',409);}});
  const response=await routes.POST(request('POST'));assert.equal(response.status,409);assert.ok(!(await response.text()).includes('private-upstream-payload'));
});
test('Meta route guards preparation before provider call and both save paths',()=>{
  const code=fs.readFileSync(new URL('../src/app/api/integrations/whatsapp/embedded-signup/route.js',import.meta.url),'utf8');
  assert.ok(code.indexOf('await assertTenantWorkspaceAuthorization(prisma, preparation)')<code.indexOf('await completeEmbeddedSignup'));
  assert.equal((code.match(/await assertTenantWorkspaceAuthorization\(tx, \{ \.\.\.preparation, lock: true \}\)/g)||[]).length,2);
  assert.match(code,/tenantWorkspaceErrorResponse\(error\)/);
});
