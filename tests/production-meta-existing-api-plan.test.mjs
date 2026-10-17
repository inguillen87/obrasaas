import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaExistingApiPlan} from '../src/lib/meta-existing-api-plan.mjs';
import {createMetaCustomerHandlers} from '../src/lib/meta-customer-http.mjs';

const operation='12345678-1234-4234-8234-123456789012',planId='12345678-1234-4234-8234-123456789013',scope='a'.repeat(64),projectId='p-a';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Read',organizationId:'org_Read',organizationRole:'org:admin'};
const request=params=>new Request('https://obrasaas.com/api/identity/meta-onboarding?'+new URLSearchParams({projectId,scope,...params}));

test('existing API receipt reads carry an exact action, plan and operation and never dispatch a command',async()=>{
 const calls=[],api=createMetaCustomerHandlers({verify:async()=>session,service:{read:async(_s,value)=>{calls.push(value);return value;},command:async()=>{throw new Error('Read must never send a command');}}});
 for(const action of ['prepare_existing_api_plan','close_existing_api_plan']){
  const context={projectId,scope,action,operationId:operation,planId:action==='prepare_existing_api_plan'?operation:planId},result=await api.GET(request(context));
  assert.equal(result.status,200);assert.deepEqual(await result.json(),context);assert.match(result.headers.get('cache-control'),/private, no-store/);
 }
 assert.equal(calls.length,2);
});

test('mixed, duplicated and unbound plan receipt filters are rejected before canonical storage',async()=>{
 let reads=0;const api=createMetaCustomerHandlers({verify:async()=>session,service:{read:async()=>{reads++;}}});
 const valid={action:'close_existing_api_plan',operationId:operation,planId};
 for(const patch of [{planId:'bad'},{operationId:'bad'},{signupId:operation},{eventId:'customer_webhook_'+'b'.repeat(64)},{after:'customer_webhook_'+'b'.repeat(64)},{action:'cancel'},{action:'process_inbox'},{action:'prepare_existing_api_plan'}])assert.equal((await api.GET(request({...valid,...patch}))).status,400);
 const duplicate=new Request(request(valid).url+'&planId='+planId);assert.equal((await api.GET(duplicate)).status,400);
 assert.equal((await api.GET(request({planId}))).status,400);assert.equal(reads,0);
});

test('plan commands require explicit local confirmation and the original command schema before opening a transaction',async()=>{
 let transactions=0;const service=createMetaExistingApiPlan({workspace:{integrationProject(){transactions++;throw new Error('Not a valid request');}}});
 const prepare={action:'prepare_existing_api_plan',operationId:operation,projectId,scope,preparedRevision:1,confirmPreserveProvider:true};
 const close={action:'close_existing_api_plan',operationId:operation,projectId,scope,planId,confirmLocalClosure:true};
 for(const body of [null,{},[],{...prepare,preparedRevision:0},{...prepare,preparedRevision:1.2},{...prepare,confirmPreserveProvider:false},{...prepare,token:'forbidden'},{...prepare,operationId:'not-uuid'},{...close,planId:'bad'},{...close,confirmLocalClosure:false},{...close,preparedRevision:1}])await assert.rejects(service.command(session,body),{code:'META_CUSTOMER_SYNC_INPUT_INVALID'});
 assert.equal(transactions,0);
});

test('receipt lookup does not infer success from a latest plan or manufacture a provider authorization',async()=>{
 const service=createMetaExistingApiPlan({workspace:{}}),project={id:projectId,metadata:{metaExistingApiPlan:{operationId:operation}}},member={actorId:'owner',organizationId:'company-a'},queries=[];
 const receipt=await service.readReceipt({query:async(sql,args)=>{queries.push({sql,args});return {rows:[]};}},member,scope,project,{action:'close_existing_api_plan',operationId:operation,planId});
 assert.deepEqual(receipt,{action:'close_existing_api_plan',operationId:operation,projectId,scope,planId,state:'NOT_OBSERVED',saved:false,receiptId:null,recordedAt:null,preparedRevision:null,code:null,providerChanged:false,remoteMutationDispatched:false,authorizationGranted:false});
 assert.equal(queries.length,1);assert.match(queries[0].sql,/SELECT.*AuditLog/s);assert.equal(queries[0].args[1],member.organizationId);assert.equal(queries[0].args[2],projectId);
});

test('unsupported or incomplete legacy plan metadata cannot be presented as a current plan',async()=>{
 const service=createMetaExistingApiPlan({workspace:{}});
 for(const value of [{},{version:1,operationId:operation},{version:99}])await assert.rejects(service.publicPlan({query:async()=>{throw new Error('No query for invalid metadata');}},{organizationId:'company-a'},{id:projectId,metadata:{metaExistingApiPlan:value}}),{code:'META_CUSTOMER_EXISTING_API_PLAN_INTEGRITY'});
});
