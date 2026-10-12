import assert from 'node:assert/strict';
import test from 'node:test';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {createCompanySubscriptionHandlers,createCompanySubscriptionWebhookHandlers} from '../src/lib/company-subscription-http.mjs';
const scope='a'.repeat(64),op='b511ea88-4c89-4f71-9c9b-bb04579ecb6d';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const endpoint='https://obrasaas.com/api/identity/company-subscription';
const request=(value,headers={})=>new Request(endpoint,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json',...headers},body:JSON.stringify(value)});
function fixture(){
  const calls=[];
  const store=Object.fromEntries(['read','begin','recover','cancelAtPeriodEnd'].map(action=>[action,async(identity,value)=>{calls.push({action,identity,value});return {state:'OBSERVED'};}]));
  return {calls,handlers:createCompanySubscriptionHandlers({verifySession:async()=>session,store})};
}
test('authorized commands carry only server contract selectors and operation references',async()=>{
  const {calls,handlers}=fixture();
  assert.equal((await handlers.GET(new Request(endpoint+'?scope='+scope))).status,200);
  assert.equal((await handlers.POST(request({action:'begin',scope,operationId:op,offerId:'approved-pro',catalogVersion:'catalog-1'}))).status,200);
  assert.equal((await handlers.POST(request({action:'recover',scope,operationId:op}))).status,200);
  assert.equal((await handlers.POST(request({action:'cancel_renewal',scope,operationId:op,subscriptionAttemptId:'company_subscription_'+'c'.repeat(64)}))).status,200);
  assert.deepEqual(calls.map(c=>c.action),['read','begin','recover','cancelAtPeriodEnd']);
  assert.deepEqual(calls[1].value,{scope,operationId:op,offerId:'approved-pro',catalogVersion:'catalog-1'});
  assert.ok(calls.every(c=>c.identity===session&&!Object.hasOwn(c.value,'action')));
});
test('client amount, currency, merchant, payer and paid flags never reach subscription service',async()=>{
  const {calls,handlers}=fixture();
  for(const patch of [{amountMinor:'1'},{currency:'ARS'},{merchantId:'another'},{payerEmail:'private@example.invalid'},{paid:true},{status:'ACTIVE'},{resourceId:'123'},{termsAccepted:true}]){
    assert.equal((await handlers.POST(request({action:'begin',scope,operationId:op,offerId:'approved-pro',catalogVersion:'catalog-1',...patch}))).status,400);
  }
  assert.equal(calls.length,0);
});
test('query duplicates, success-return flags and cross-site writes cannot read or mutate a plan',async()=>{
  const {calls,handlers}=fixture();
  for(const query of ['scope='+scope+'&scope='+scope,'scope='+scope+'&paid=true','scope='+scope+'&billing=success','scope='+scope+'&operationId=bad','scope='+scope+'&operationId='+op+'&operationId='+op]){
    assert.equal((await handlers.GET(new Request(endpoint+'?'+query))).status,400);
  }
  assert.equal((await handlers.POST(request({action:'recover',scope,operationId:op},{origin:'https://other.example.invalid'}))).status,403);
  assert.equal((await handlers.GET(new Request(endpoint+'?scope='+scope,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
  assert.equal(calls.length,0);
});
test('identity outage differs from anonymous access and response never echoes private errors',async()=>{
  let calls=0;
  for(const [identity,status]of [[{authenticated:false,code:'SESSION_REQUIRED'},401],[{authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'},503]]){
    const handlers=createCompanySubscriptionHandlers({verifySession:async()=>identity,store:{read:async()=>{calls++;}}});
    assert.equal((await handlers.GET(new Request(endpoint+'?scope='+scope))).status,status);
  }
  const handlers=createCompanySubscriptionHandlers({verifySession:async()=>session,store:{read:async()=>{throw new WorkspaceError('COMPANY_SUBSCRIPTION_UNCONFIRMED',503);}}});
  const response=await handlers.GET(new Request(endpoint+'?scope='+scope));
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.deepEqual(await response.json(),{code:'COMPANY_SUBSCRIPTION_UNCONFIRMED'});assert.equal(calls,0);
});
test('bounded JSON rejects encoded, absent, oversized, array and unsupported commands',async()=>{
  const {calls,handlers}=fixture();
  for(const value of [[],null,{action:'upgrade',scope,operationId:op},{action:'recover',scope,operationId:'bad'}])assert.equal((await handlers.POST(request(value))).status,400);
  assert.equal((await handlers.POST(request({action:'recover',scope,operationId:op},{'content-encoding':'gzip'}))).status,400);
  assert.equal((await handlers.POST(request({action:'recover',scope,operationId:op},{'content-length':'32769'}))).status,413);
  assert.equal(calls.length,0);
});
test('only a provider-created verified notification capability reaches financial reconciliation',async()=>{
  const trusted=new WeakSet(),calls=[];
  const provider={verifyNotification:async()=>{const event={resourceId:'remote'};trusted.add(event);return event;},isVerifiedEvent:event=>trusted.has(event)};
  const store={processVerifiedEvent:async event=>{calls.push(event);return {received:true};}};
  const handlers=createCompanySubscriptionWebhookHandlers({provider,store});
  const response=await handlers.POST(request({status:'approved',paid:true}));assert.equal(response.status,200);assert.equal(calls.length,1);assert.deepEqual(await response.json(),{received:true});
  const rejected=createCompanySubscriptionWebhookHandlers({provider:{verifyNotification:async()=>({resourceId:'remote'}),isVerifiedEvent:()=>false},store});
  assert.equal((await rejected.POST(request({paid:true}))).status,401);assert.equal(calls.length,1);
  assert.equal((await handlers.GET(new Request(endpoint))).status,405);
});
