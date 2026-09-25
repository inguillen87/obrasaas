import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';
import { reportIdentifier, messageReportErrorResponse } from '../src/lib/whatsapp/progress-report-policy.js';
import { messageBlockerErrorResponse, WhatsAppMessageBlockerError } from '../src/lib/whatsapp/message-blocker-policy.js';
const code=fs.readFileSync(new URL('../src/app/api/whatsapp/inbox/[conversationId]/messages/[messageId]/blocker/route.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
class AccessError extends Error{}class RequestBodyError extends Error{}
const access={organization:{id:'org-a'},project:{id:'project-a'},databaseUserId:'manager-a'};
function route(overrides={}){
  const calls={db:0,permissions:[],input:null,limit:null};
  const deps={AccessError,RequestBodyError,WhatsAppMessageBlockerError,reportIdentifier,messageBlockerErrorResponse,messageReportErrorResponse,assertEvidenceRequestContext,evidenceContextErrorResponse,
    accessErrorResponse:()=>Response.json({}, {status:403}),requestBodyErrorResponse:()=>Response.json({}, {status:400}),projectExecutionErrorResponse:()=>null,projectWritePolicyErrorResponse:()=>null,
    getPlatformAccess:async()=>access,requireTenantPermission:()=>{},getPrisma:()=>({}),prepareWhatsAppMessageBlocker:async()=>({}),createWhatsAppMessageBlocker:async()=>({}),SOURCE_EVIDENCE_PERMISSION:'org:field:evidence:read',
    readJsonRequest:async(request,limits)=>{calls.limit=limits.maxBytes;return request.json();}};
  const factory=new Function(...Object.keys(deps),code+'\nreturn createMessageBlockerHandlers;')(...Object.values(deps));
  return{calls,handler:factory({resolveAccess:async()=>access,authorize:(a,permission,options)=>{assert.equal(a,access);calls.permissions.push([permission,options.subscriptionMode]);},database:()=>{calls.db++;return{};},prepare:async(db,input)=>{calls.input=input;return{source:{}};},create:async(db,input)=>{calls.input=input;return{blocker:{},replayed:false};},...overrides})};
}
const params={params:Promise.resolve({conversationId:'chat-a',messageId:'message-a'})};
function request(method='GET',headers={},query=''){return new Request('https://obra.test/api/whatsapp/inbox/chat-a/messages/message-a/blocker'+query,{method,headers:{'Content-Type':'application/json','x-obrasaas-organization':'org-a','x-obrasaas-project':'project-a','idempotency-key':'operation-000000001',...headers},...(method==='POST'?{body:'{"taskId":"task-a"}'}:{})});}
for(const method of ['GET','POST'])test('session context and four permissions required: '+method,async()=>{
  const {handler,calls}=route();const response=await handler[method](request(method),params);assert.equal(response.status,method==='POST'?201:200);
  assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(calls.permissions.length,4);assert.deepEqual(calls.input.scope,{organizationId:'org-a',projectId:'project-a'});assert.equal(calls.input.actorId,'manager-a');assert.equal(calls.input.messageId,'message-a');
  if(method==='POST'){assert.equal(calls.limit,24*1024);assert.equal(calls.input.operationKey,'operation-000000001');}
});
for(const permission of ['org:conversations:read','org:execution:manage','org:tasks:read','org:field:evidence:read'])test('missing permission prevents mutation: '+permission,async()=>{
  const {handler,calls}=route({authorize:(a,value)=>{if(value===permission)throw new AccessError();}});assert.equal((await handler.POST(request('POST'),params)).status,403);assert.equal(calls.db,0);
});
for(const headers of [{'x-obrasaas-project':'other'},{'x-obrasaas-organization':'other'},{'x-obrasaas-project':''},{origin:'https://other.test'},{'sec-fetch-site':'cross-site'}])test('context and origin checked before source access: '+JSON.stringify(headers),async()=>{
  const {handler,calls}=route();assert.ok([400,403,409].includes((await handler.POST(request('POST',headers),params)).status));assert.equal(calls.db,0);
});
test('query cannot override company or source and malformed source id never queries Prisma',async()=>{
  const {handler,calls}=route();assert.equal((await handler.GET(request('GET',{},'?tenant=other'),params)).status,400);
  assert.equal((await handler.GET(request(),{params:Promise.resolve({conversationId:'../bad',messageId:'message-a'})})).status,422);assert.equal(calls.db,0);
});
test('replayed creation returns the existing result, not a second created response',async()=>{
  const {handler}=route({create:async()=>({blocker:{},replayed:true})});assert.equal((await handler.POST(request('POST'),params)).status,200);
});
test('unexpected failure remains private and does not disclose backend details',async()=>{
  const {handler}=route({create:async()=>{throw new Error('internal-sensitive-detail');}});const response=await handler.POST(request('POST'),params);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('internal-sensitive-detail'));
});
test('exact record link checks project availability before rendering and uses the original resolution domain',()=>{
  const page=fs.readFileSync(new URL('../src/app/dashboard/execution/page.js',import.meta.url),'utf8');
  const client=fs.readFileSync(new URL('../src/app/dashboard/execution/execution-client.js',import.meta.url),'utf8');
  assert.match(page,/focusedBlockerId && !execution.blockers.some/);assert.match(page,/notFound\(\)/);
  assert.match(client,/BlockerFollowupCard/);assert.ok(!client.includes('Resuelto desde el control de ejecución.'));
});
