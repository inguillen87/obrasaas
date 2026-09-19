import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inspectWhatsAppCredentialLifecycle } from '../src/lib/whatsapp/credential-lifecycle.js';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
const code = readFileSync(new URL('../src/app/api/integrations/whatsapp/lifecycle/route.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error {}
const access={organization:{id:'org-a'},project:{id:'project-a'}};
function fixture(overrides={}) {
  const calls={database:0,queries:[],checks:0};
  const deps={AccessError,accessErrorResponse:()=>Response.json({code:'DENIED'},{status:403}),getPlatformAccess:async()=>access,
    requireTenantPermission:(_,permission,options)=>{calls.checks++;assert.equal(permission,'org:integrations:manage');assert.equal(options.subscriptionMode,'read');},
    assertEvidenceRequestContext,evidenceContextErrorResponse,inspectWhatsAppCredentialLifecycle,
    getPrisma:()=>{calls.database++;return {whatsAppConnection:{findFirst:async query=>{calls.queries.push(query);return {enabled:true,connectionStatus:'CONNECTED',metadata:{channelHealth:{tokenStatus:'VALID',checkedAt:'2026-09-19T18:00:00.000Z',expiresAt:1}}};}}};}};
  const factory=new Function(...Object.keys(deps),code+'\nreturn createCredentialLifecycleHandler;')(...Object.values(deps));
  return {calls,get:factory({clock:()=>new Date('2026-09-19T18:00:00.000Z'),...overrides})};
}
const request=(headers={},suffix='')=>new Request('https://obra.test/api/integrations/whatsapp/lifecycle'+suffix,{headers:{'X-ObraSaaS-Organization':'org-a','X-ObraSaaS-Project':'project-a',...headers}});
test('session-scoped status query is private, read-only, and independent of raw CONNECTED',async()=>{
 const {get,calls}=fixture();const response=await get(request());const body=await response.json();assert.equal(response.status,200);
 assert.deepEqual(body.context,{organizationId:'org-a',projectId:'project-a'});assert.equal(body.credential.state,'EXPIRED');assert.match(response.headers.get('cache-control'),/private, no-store/);
 assert.deepEqual(calls.queries[0].where,{projectId:'project-a',project:{organizationId:'org-a'}});assert.deepEqual(calls.queries[0].select,{enabled:true,connectionStatus:true,metadata:true});
});
for(const headers of [{'X-ObraSaaS-Project':'other'},{'X-ObraSaaS-Organization':'other'},{'X-ObraSaaS-Project':''}])test('wrong or missing screen scope cannot query the database: '+JSON.stringify(headers),async()=>{
 const {get,calls}=fixture();assert.equal((await get(request(headers))).status,409);assert.equal(calls.database,0);
});
test('missing request scope fails before database access',async()=>{const{get,calls}=fixture();assert.equal((await get(new Request('https://obra.test/api/integrations/whatsapp/lifecycle'))).status,409);assert.equal(calls.database,0);});
test('revoked integrations permission cannot retrieve or renew authorization',async()=>{const{get,calls}=fixture({authorize:()=>{throw new AccessError();}});assert.equal((await get(request())).status,403);assert.equal(calls.database,0);});
test('query cannot switch target or request raw metadata',async()=>{const{get,calls}=fixture();assert.equal((await get(request({},'?raw=true'))).status,400);assert.equal(calls.database,0);});
test('database failures do not expose secrets or pretend a healthy channel',async()=>{const{get}=fixture({database:()=>{throw new Error('private-database-secret');}});const response=await get(request());assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private-database-secret'));});
test('no connection is explicit rather than falling back to another account',async()=>{const{get}=fixture({database:()=>({whatsAppConnection:{findFirst:async()=>null}})});const body=await(await get(request())).json();assert.equal(body.credential.state,'UNLINKED');});
test('inspection cannot return secrets or call Meta/mutate through this route',()=>{assert.doesNotMatch(code,/decryptCredential|verifyConnectedWhatsAppAccount|\.create\(|\.update\(|fetch\(/);assert.doesNotMatch(code,/function (POST|PATCH|PUT|DELETE)/);});
