import assert from 'node:assert/strict';
import test from 'node:test';
import {createCompanyBilling} from '../src/lib/company-billing.mjs';
import {createCompanyBillingHandlers} from '../src/lib/company-billing-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {createCheckoutPreference,PLAN_CONFIGS} from '../src/lib/mercadopago.js';
import * as billingRoute from '../src/app/api/billing/route.js';
import * as checkoutRoute from '../src/app/api/billing/checkout/route.js';
import * as webhookRoute from '../src/app/api/billing/webhook/route.js';

const scope='a'.repeat(64),session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const company={id:'company-a',name:'Synthetic company',subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date('2026-10-23T00:00:00Z'),observedAt:new Date('2026-10-08T00:00:00Z')};
function fixture(patch={}){
 let calls=0;
 const store=createCompanyBilling({workspace:{companyRead:async(_session,context,callback)=>{
  assert.deepEqual(context,{scope});
  return callback({query:async(sql,values)=>{calls++;assert.match(sql,/FROM public\."Organization" WHERE id=\$1/);assert.deepEqual(values,['company-a']);return {rows:[{...company,...patch}]};}},{organizationId:'company-a'},scope);
 }}});
 return {store,calls:()=>calls};
}
test('projects only the canonical subscription with a server clock, without payment or provider claims',async()=>{
 const {store}=fixture({metadata:{card:'private',phone:'private'},stripeCustomerId:'private',primaryEmail:'private'});
 const value=await store.read(session,{scope});
 assert.deepEqual(value,{version:1,scope,organization:{id:'company-a',name:'Synthetic company'},observedAt:'2026-10-08T00:00:00.000Z',subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:'2026-10-23T00:00:00.000Z',entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}},billing:{state:'CONFIGURATION_PENDING',checkoutAvailable:false,paymentEvidence:'UNOBSERVED'}});
 assert.equal(JSON.stringify(value).includes('private'),false);
});
test('expiry and suspension remain visible without extending the trial or claiming a paid receipt',async()=>{
 for(const [patch,reason] of [[{trialEndsAt:new Date('2026-10-08T00:00:00Z')},'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'],[{subscriptionPlan:'PRO',subscriptionStatus:'SUSPENDED'},'COMPANY_ENTITLEMENT_SUSPENDED']]){
  const value=await fixture(patch).store.read(session,{scope});assert.equal(value.subscription.entitlement.allowed,false);assert.equal(value.subscription.entitlement.reasonCode,reason);assert.equal(value.billing.paymentEvidence,'UNOBSERVED');
 }
 const active=await fixture({subscriptionPlan:'PRO',subscriptionStatus:'ACTIVE',trialEndsAt:null}).store.read(session,{scope});assert.equal(active.subscription.entitlement.allowed,true);assert.equal(active.billing.checkoutAvailable,false);assert.equal(active.billing.paymentEvidence,'UNOBSERVED');
});
test('incomplete or foreign canonical data cannot be projected as an active subscription',async()=>{
 for(const patch of [{id:'company-b'},{subscriptionPlan:'FREE'},{subscriptionStatus:'active'},{observedAt:null},{observedAt:new Date('invalid')}])await assert.rejects(fixture(patch).store.read(session,{scope}),{code:'COMPANY_BILLING_UNOBSERVED',status:503});
});
test('canonical company read needs both administrator roles and never queries an operational table',async()=>{
 for(const [canonicalRole,clerkRole,allowed] of [['ADMIN','org:admin',true],['DIRECTOR','org:admin',false],['ADMIN','org:member',false]]){
  const signed={...session,organizationRole:clerkRole},member={actorId:'actor',membershipId:'member',organizationId:'company-a',organizationName:'Company',role:canonicalRole};
  const statements=[],released=[];let callbackCalled=false;
  const workspace=createWorkspaceStore({connect:async()=>({query:async sql=>{statements.push(sql);return {rows:sql.includes('TenantMembership')?[member]:[]};},release:value=>released.push(value)})});
  const promise=workspace.companyRead(signed,{scope:scopeStamp(signed,member)},async()=>{callbackCalled=true;return 'observed';});
  if(allowed)assert.equal(await promise,'observed');else await assert.rejects(promise,{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});
  assert.equal(callbackCalled,allowed);assert.equal(statements[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.ok(statements.includes('ROLLBACK'));assert.equal(statements.some(sql=>/public\."(Project|Worker|Task)"/.test(sql)),false);assert.equal(released.length,1);
 }
});
test('HTTP accepts only one scope, rejects mutations and cross-site requests, and hides private failures',async()=>{
 let reads=0;const handlers=createCompanyBillingHandlers({verifySession:async()=>session,store:{read:async()=>{reads++;return {scope};}}});
 const request=(suffix='',options={})=>new Request('https://obrasaas.com/api/identity/company-billing?scope='+scope+suffix,options);
 for(const suffix of ['&scope='+scope,'&plan=PRO','&billing=success','&simulated=true'])assert.equal((await handlers.GET(request(suffix))).status,400);
 assert.equal((await handlers.POST(request('',{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify({plan:'PRO',paid:true})}))).status,405);
 assert.equal((await handlers.GET(request('',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 assert.equal(reads,0);
 const response=await handlers.GET(request());assert.equal(response.status,200);assert.equal(reads,1);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.match(response.headers.get('x-robots-tag'),/noindex/);
 const broken=createCompanyBillingHandlers({verifySession:async()=>session,store:{read:async()=>{throw Error('secret-provider-or-db-value');}}});const error=await broken.GET(request());assert.equal(error.status,503);assert.deepEqual(await error.json(),{code:'COMPANY_BILLING_UNOBSERVED'});
});
test('anonymous identity and identity outages never reach commercial storage',async()=>{
 let reads=0;
 for(const [identity,status] of [[{authenticated:false,code:'SESSION_REQUIRED'},401],[{authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'},503]]){
  const handlers=createCompanyBillingHandlers({verifySession:async()=>identity,store:{read:async()=>{reads++;}}});assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/identity/company-billing?scope='+scope))).status,status);
 }
 assert.equal(reads,0);
});
test('retired legacy paths never process a purchase, cancellation, callback or redirect',async()=>{
 for(const route of [billingRoute,checkoutRoute,webhookRoute]){
  for(const method of ['GET','POST'].filter(method=>typeof route[method]==='function')){
   const request=new Request('https://obrasaas.com/api/billing?billing=success&simulated=true&type=payment&data.id=123',{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({plan:'Pro',action:'upgrade',status:'approved',paid:true})}:{})});
   const response=await route[method](request);assert.equal(response.status,410);const value=await response.json();assert.equal(value.code,'BILLING_ROUTE_RETIRED');assert.equal(Object.hasOwn(value,'success'),false);assert.equal(Object.hasOwn(value,'received'),false);
  }
 }
 assert.deepEqual(PLAN_CONFIGS,{});await assert.rejects(createCheckoutPreference({planId:'professional',tenantSlug:'demo',userEmail:'private@example.invalid'}),{code:'BILLING_ROUTE_RETIRED',status:410});
});
