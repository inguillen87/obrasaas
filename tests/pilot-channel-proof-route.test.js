import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {assertEvidenceRequestContext,evidenceContextErrorResponse} from '../src/lib/evidence-context.js';
import {PilotChannelProofError} from '../src/lib/whatsapp/pilot-channel-proof.js';
const source=readFileSync(new URL('../src/app/api/integrations/whatsapp/pilot-proof/route.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error {}
class RequestBodyError extends Error {}
class WhatsAppInboxError extends Error {}
function fixture(overrides={}){
 const calls={reads:0,sends:0,db:0};
 const principal={isSuperadmin:true,organization:{id:'org-control'},project:{id:'project-control'}};
 const deps={process:{env:{VERCEL_ENV:'preview',WHATSAPP_PILOT_IMPORT_ENABLED:'true'}},AccessError,RequestBodyError,WhatsAppInboxError,PilotChannelProofError,assertEvidenceRequestContext,evidenceContextErrorResponse,
  requireSuperadmin:async()=>principal,clerkClient:async()=>({}),getPrisma:()=>{calls.db++;return{};},readJsonRequest:async request=>request.json(),
  accessErrorResponse:()=>Response.json({},{status:403}),requestBodyErrorResponse:()=>Response.json({},{status:400}),
  resolvePilotProofContext:async({principal:p,projectId})=>{assert.equal(p,principal);return{project:{id:projectId}};},sendManualWhatsAppMessage:()=>{},
  readPilotChannelProof:async()=>{calls.reads++;return{projectId:'pilot'};},sendPilotChannelProof:async()=>{calls.sends++;return{reply:{id:'reply-1',status:'accepted'}};},...overrides};
 return{calls,...new Function(...Object.keys(deps),source+'\nreturn {GET,POST};')(...Object.values(deps))};
}
const request=(method='GET',headers={},query=method==='GET'?'?projectId=pilot':'')=>new Request('https://obra.test/api/integrations/whatsapp/pilot-proof'+query,{method,headers:{origin:'https://obra.test','content-type':'application/json','x-obrasaas-organization':'org-control','x-obrasaas-project':'project-control',...headers},...(method==='POST'?{body:JSON.stringify({projectId:'pilot',confirmSend:true})}:{})});
for(const mode of ['production','development'])test('pilot test cannot operate in '+mode,async()=>{const f=fixture({process:{env:{VERCEL_ENV:mode,WHATSAPP_PILOT_IMPORT_ENABLED:'true'}}});assert.equal((await f.POST(request('POST'))).status,404);assert.equal(f.calls.db,0);});
test('GET never sends a message',async()=>{const f=fixture();const response=await f.GET(request());assert.equal(response.status,200);assert.equal(f.calls.sends,0);assert.match(response.headers.get('cache-control'),/private, no-store/);});
for(const headers of [{origin:'https://foreign.test'},{origin:''},{'x-obrasaas-project':'other'},{'x-obrasaas-organization':''}])test('context and origin rejected before database: '+JSON.stringify(headers),async()=>{const f=fixture();assert.ok([403,409].includes((await f.POST(request('POST',headers))).status));assert.equal(f.calls.db,0);});
test('duplicate target query rejected',async()=>{const f=fixture();assert.equal((await f.GET(request('GET',{},'?projectId=a&projectId=b'))).status,400);assert.equal(f.calls.db,0);});
test('write invokes only the scoped canonical sender path',async()=>{const f=fixture();const response=await f.POST(request('POST'));assert.equal(response.status,200);assert.equal(f.calls.sends,1);});
test('provider exceptions never expose configuration',async()=>{const f=fixture({resolvePilotProofContext:async()=>{throw new Error('sensitive-provider-detail');}});const response=await f.POST(request('POST'));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('sensitive-provider-detail'));});
