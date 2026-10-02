import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createConstructorCrmHandlers} from '../src/lib/constructor-crm-http.mjs';
import {constructorCrmReceiptId} from '../src/lib/constructor-crm-store.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const url='https://obrasaas.com/api/identity/constructor-crm',context='?projectId=project-a&scope='+scope;
const input={action:'CREATE',operationId:randomUUID(),scope,projectId:'project-a',payload:{name:'Cliente de ensayo'}};
const post=(body=input,headers={})=>new Request(url,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
test('CRM receipts bind the exact actor, owner company, selected project and case-normalized UUID',()=>{
 const key=randomUUID(),reference=constructorCrmReceiptId('actor','company','project',key);
 assert.match(reference,/^constructor_crm_[a-f0-9]{64}$/);
 assert.equal(reference,constructorCrmReceiptId('actor','company','project',key.toUpperCase()));
 for(const values of [['other','company','project'],['actor','other','project'],['actor','company','other']])assert.notEqual(reference,constructorCrmReceiptId(...values,key));
});
test('GET uses only verified session, explicit project scope and mutually exclusive cursor/account/receipt selectors',async()=>{
 const calls=[],store={list:async(s,c)=>{calls.push(['list',s,c]);return {scope,projectId:'project-a',records:[]};},status:async(s,c)=>{calls.push(['status',s,c]);return {scope,projectId:'project-a',state:'NOT_OBSERVED',saved:false,definitive:false};}};
 const handlers=createConstructorCrmHandlers({verify:async()=>session,store});
 assert.equal((await handlers.GET(new Request(url+context+'&accountId=crm_owned'))).status,200);
 assert.deepEqual(calls[0],['list',session,{scope,projectId:'project-a',accountId:'crm_owned'}]);
 assert.equal((await handlers.GET(new Request(url+context+'&operationId='+input.operationId))).status,200);
 assert.equal(calls[1][0],'status');
 for(const suffix of ['&projectId=other','&scope='+scope,'&ownerOrganizationId=company','&organizationId=company','&after=crm_a&accountId=crm_b','&operationId='+input.operationId+'&after=crm_a','&operationId='+input.operationId+'&accountId=crm_a','&operationId=not-a-uuid','&accountId=','&after='])assert.equal((await handlers.GET(new Request(url+context+suffix))).status,400,suffix);
 assert.equal(calls.length,2);
});
test('HTTP boundary preserves confirmed receipt and marks it private/no-store without serializing provider or verifier internals',async()=>{
 const result={scope,projectId:'project-a',state:'RECORDED',saved:true,definitive:true,receipt:{id:'constructor_crm_receipt',operationId:input.operationId,accountId:'crm_owned',action:'CREATE',revision:1}};
 const handlers=createConstructorCrmHandlers({verify:async()=>session,store:{save:async(s,b)=>{assert.equal(s,session);assert.deepEqual(b,input);return result;}}});
 const response=await handlers.POST(post());assert.equal(response.status,200);assert.deepEqual(await response.json(),result);
 assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('vary'),/Authorization/);
});
test('foreign origins, cross-site headers and POST query overrides stop before any store mutation',async()=>{
 let calls=0;const handlers=createConstructorCrmHandlers({verify:async()=>session,store:{save:async()=>{calls++;return {};},list:async()=>{calls++;return {};}}});
 for(const request of [post(input,{origin:'https://attacker.example'}),post(input,{'sec-fetch-site':'cross-site'}),new Request(url+context,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(input)}),new Request(url+context,{headers:{'sec-fetch-site':'cross-site'}})])assert.equal((await handlers[request.method](request)).status,403);
 assert.equal(calls,0);
});
test('compressed, malformed, overflowing and wrong-content-type bodies are rejected before mutation',async()=>{
 let calls=0;const handlers=createConstructorCrmHandlers({verify:async()=>session,store:{save:async()=>{calls++;return {};}}});
 for(const request of [post(input,{'content-encoding':'gzip'}),post('{broken'),post(input,{'content-type':'text/plain'}),post(input,{'content-length':'999999'})])assert.ok([400,413].includes((await handlers.POST(request)).status));
 assert.equal((await handlers.POST(post(' '.repeat(32769)))).status,413);assert.equal(calls,0);
});
test('anonymous, decoded-only and provider-unavailable sessions never reach the CRM service',async()=>{
 for(const [value,status] of [[{authenticated:false},401],[{...session,verification:'decoded-only'},401],[{authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'},503],[{authenticated:false,code:'IDENTITY_CONFIGURATION_PENDING'},503]]){
  const handlers=createConstructorCrmHandlers({verify:async()=>value,store:{list:()=>assert.fail('No read before verification'),save:()=>assert.fail('No mutation before verification')}});
  assert.equal((await handlers.GET(new Request(url+context))).status,status);assert.equal((await handlers.POST(post())).status,status);
 }
});
test('schema/revision errors retain canonical code and an unexpected database error never leaks private details',async()=>{
 for(const [error,status,code] of [[new WorkspaceError('CONSTRUCTOR_CRM_SCHEMA_PENDING',503),503,'CONSTRUCTOR_CRM_SCHEMA_PENDING'],[new WorkspaceError('CONSTRUCTOR_CRM_REVISION_CHANGED',409),409,'CONSTRUCTOR_CRM_REVISION_CHANGED'],[new Error('PRIVATE email token connection-string'),503,'CONSTRUCTOR_CRM_OPERATION_UNCONFIRMED']]){
  const handlers=createConstructorCrmHandlers({verify:async()=>session,store:{save:async()=>{throw error;}}}),response=await handlers.POST(post());assert.equal(response.status,status);assert.deepEqual(await response.json(),{saved:false,code});
 }
});
test('the actual API route imports canonical production dependencies and denies anonymous access without opening a database',async()=>{
 const route=await import('../src/app/api/identity/constructor-crm/route.js');assert.equal(typeof route.GET,'function');assert.equal(typeof route.POST,'function');
 const response=await route.GET(new Request(url+context));assert.ok([401,503].includes(response.status));const body=await response.json();assert.equal(body.saved,false);assert.ok(['SESSION_REQUIRED','IDENTITY_PROVIDER_UNAVAILABLE'].includes(body.code));
});
