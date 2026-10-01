import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsStatusHandler} from '../src/lib/operations-status.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
const scope='a'.repeat(64),url='https://obrasaas.com/api/identity/operations-status?projectId=p-a&scope='+scope;
const identity={authenticated:true,verification:'clerk-production-jwt',userId:'user_Test',organizationId:'org_Test',organizationRole:'org:admin'};
test('observability requires verified workspace identity before querying aggregates',async()=>{
 let reads=0;const store={read:()=>{reads++;throw new Error('Must not read');}};
 for(const session of [{authenticated:false},{...identity,verification:'synthetic-unverified'}, {...identity,organizationId:null}]){
  const handler=createOperationsStatusHandler({verify:async()=>session,store});const response=await handler(new Request(url));assert.ok([401,403].includes(response.status));assert.match(response.headers.get('cache-control'),/private.*no-store/);
 }
 assert.equal(reads,0);
});
test('cross-site, duplicated scope, extra fields and writes cannot query operational history',async()=>{
 let reads=0;const handler=createOperationsStatusHandler({verify:async()=>identity,store:{read:()=>{reads++;}}});
 for(const request of [new Request(url,{headers:{'sec-fetch-site':'cross-site'}}),new Request(url+'&scope='+scope),new Request(url+'&provider=meta-test-v1'),new Request(url,{method:'POST',body:'{}'})]){
  const response=await handler(request);assert.ok([400,403,405].includes(response.status));assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 }
 assert.equal(reads,0);
});
test('tenant permission denial exposes the public code without credential or provider detail',async()=>{
 const handler=createOperationsStatusHandler({verify:async()=>identity,store:{read:async()=>{const error=new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',403);error.privatePayload='synthetic-private-provider-payload';throw error;}}});
 const response=await handler(new Request(url));assert.equal(response.status,403);assert.deepEqual(await response.json(),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
});
