import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {companyWhatsappOnboardingEntitlement as entitlement} from '../src/lib/company-entitlement.mjs';

const checkedAt=new Date('2026-10-07T03:00:00.000Z');
const row=(patch={})=>({subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date('2026-10-08T03:00:00.000Z'),...patch});
const check=company=>entitlement(company,{now:checkedAt});
const allowed=(basis)=>({allowed:true,basis,reasonCode:null});
const closed=(reasonCode)=>({allowed:false,basis:null,reasonCode});

test('uses the current Organization subscription vocabulary, rather than legacy Tenant plan names',()=>{
 const enums=readFileSync(new URL('../src/generated/prisma/enums.ts',import.meta.url),'utf8');
 const values=name=>[...enums.match(new RegExp('export const '+name+' = \\{([\\s\\S]+?)\\} as const'))[1].matchAll(/:\s*'([^']+)'/g)].map(match=>match[1]);
 assert.deepEqual(values('SubscriptionPlan'),['TRIAL','PRO','ENTERPRISE']);
 assert.deepEqual(values('SubscriptionStatus'),['TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED']);
});

test('a current trial permits onboarding based on the exact canonical expiry',()=>{
 assert.deepEqual(check(row()),allowed('CURRENT_TRIAL'));
 assert.deepEqual(check(row({trialEndsAt:'2026-10-08T00:00:00-03:00'})),allowed('CURRENT_TRIAL'));
});

test('trial closes at its exact expiry, without an extra day or grace period',()=>{
 const end=checkedAt.getTime();
 assert.deepEqual(check(row({trialEndsAt:new Date(end+1)})),allowed('CURRENT_TRIAL'));
 for(const milliseconds of [end,end-1,end-86400000])assert.deepEqual(check(row({trialEndsAt:new Date(milliseconds)})),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
});

test('UTC and Argentine instants expire together regardless of a company timezone label',()=>{
 for(const value of ['2026-10-07T03:00:00.000Z','2026-10-07T00:00:00-03:00','2026-10-07T08:30:00+05:30']){
  assert.deepEqual(check(row({trialEndsAt:value,timezone:'Pacific/Kiritimati'})),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
 }
 assert.deepEqual(entitlement(row({trialEndsAt:'2026-10-07T00:00:00.001-03:00'}),{now:'2026-10-07T00:00:00.000-03:00'}),allowed('CURRENT_TRIAL'));
});

test('a supplied 15-day trial is checked at its boundary without being extended',()=>{
 const start=new Date('2026-10-01T15:00:00.000Z'),end=new Date(start.getTime()+15*86400000),company=row({createdAt:start,trialEndsAt:end});
 assert.deepEqual(entitlement(company,{now:new Date(end.getTime()-1)}),allowed('CURRENT_TRIAL'));
 assert.deepEqual(entitlement(company,{now:end}),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
 assert.equal(company.trialEndsAt.getTime(),end.getTime());
});

for(const plan of ['PRO','ENTERPRISE'])test('canonical ACTIVE '+plan+' qualifies without fabricating a payment receipt',()=>{
 const company=row({subscriptionPlan:plan,subscriptionStatus:'ACTIVE',trialEndsAt:null});
 assert.deepEqual(check(company),allowed('ACTIVE_PAID_PLAN'));
 assert.equal(Object.hasOwn(check(company),'paymentVerified'),false);
 assert.equal(Object.hasOwn(company,'stripeSubscriptionId'),false);
});

test('ACTIVE TRIAL cannot be used to remove the expiry restriction',()=>{
 for(const end of [new Date(checkedAt.getTime()+1),null,new Date(checkedAt.getTime()-1)])assert.deepEqual(check(row({subscriptionStatus:'ACTIVE',trialEndsAt:end})),closed('COMPANY_ENTITLEMENT_ACTIVE_PLAN_UNSUPPORTED'));
});

for(const plan of ['PRO','ENTERPRISE'])test('a '+plan+' TRIALING row is not inferred to be the canonical free trial',()=>{
 assert.deepEqual(check(row({subscriptionPlan:plan})),closed('COMPANY_ENTITLEMENT_TRIAL_PLAN_MISMATCH'));
});

for(const state of ['PAST_DUE','CANCELED','SUSPENDED'])test(state+' closes paid and free plans even when the old trial remains in the future',()=>{
 for(const plan of ['TRIAL','PRO','ENTERPRISE'])assert.deepEqual(check(row({subscriptionPlan:plan,subscriptionStatus:state})),closed('COMPANY_ENTITLEMENT_'+state));
});

test('unknown, incomplete and loosely normalized states cannot enable delivery',()=>{
 for(const status of [null,undefined,'INCOMPLETE','INCOMPLETE_EXPIRED','UNPAID','CANCELLED','active',' ACTIVE','ACTIVE ',0,true,{},[]]){
  assert.deepEqual(check(row({subscriptionPlan:'PRO',subscriptionStatus:status})),closed('COMPANY_ENTITLEMENT_STATUS_UNSUPPORTED'));
 }
});

test('legacy, unknown or missing plans are not upgraded by an active subscription flag',()=>{
 for(const plan of [null,undefined,'FREE','STARTER','PROFESSIONAL','GOVERNMENT','pro',' PRO','PRO ',0,true,{},[]])assert.deepEqual(check(row({subscriptionPlan:plan,subscriptionStatus:'ACTIVE'})),closed('COMPANY_ENTITLEMENT_PLAN_UNSUPPORTED'));
});

test('missing or invalid server time cannot fall back to a browser timestamp or ambient clock',()=>{
 const company=row({subscriptionPlan:'PRO',subscriptionStatus:'ACTIVE'});
 assert.deepEqual(entitlement(company),closed('COMPANY_ENTITLEMENT_CLOCK_UNAVAILABLE'));
 for(const now of [null,undefined,new Date('invalid'),'invalid','2026-10-07','2026-10-07T00:00:00',checkedAt.getTime(),{},()=>checkedAt])assert.deepEqual(entitlement(company,{now}),closed('COMPANY_ENTITLEMENT_CLOCK_UNAVAILABLE'));
});

test('missing and malformed expiry do not become an unlimited trial',()=>{
 const invalid=[null,undefined,new Date('invalid'),'invalid','2026-10-08','2026-10-08T00:00:00','2026-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-13-01T00:00:00Z','2026-10-08T24:00:00Z','2026-10-08T00:60:00Z','2026-10-08T00:00:60Z','2026-10-08T00:00:00+24:00','2026-10-08T00:00:00+03:60',checkedAt.getTime()+86400000,true,{},[]];
 for(const trialEndsAt of invalid)assert.deepEqual(check(row({trialEndsAt})),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'));
 assert.deepEqual(check({...row({trialEndsAt:undefined}),trialEndsOn:'2026-10-08'}),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'));
});

test('a leap-day RFC3339 expiry is accepted only for a real leap year',()=>{
 assert.deepEqual(entitlement(row({trialEndsAt:'2028-02-29T03:00:00Z'}),{now:new Date('2028-02-28T03:00:00Z')}),allowed('CURRENT_TRIAL'));
 assert.deepEqual(entitlement(row({trialEndsAt:'2100-02-29T03:00:00Z'}),{now:new Date('2100-02-28T03:00:00Z')}),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'));
});

test('microsecond strings cannot keep an expired trial open through rounding',()=>{
 assert.deepEqual(entitlement(row({trialEndsAt:'2026-10-07T03:00:00.000000Z'}),{now:'2026-10-07T03:00:00.000001Z'}),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
 // PostgreSQL/JavaScript Date has millisecond precision. At a shared rounded
 // millisecond, denial is conservative; no sub-millisecond grant is inferred.
 assert.deepEqual(entitlement(row({trialEndsAt:'2026-10-07T03:00:00.000999Z'}),{now:'2026-10-07T03:00:00.000001Z'}),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
});

test('the intrinsic Date value is used rather than a supplied getTime method',()=>{
 const expiry=new Date(checkedAt.getTime()-1);expiry.getTime=()=>checkedAt.getTime()+10000;
 assert.deepEqual(check(row({trialEndsAt:expiry})),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
 assert.deepEqual(check(row({trialEndsAt:{getTime:()=>checkedAt.getTime()+10000}})),closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'));
});

test('a missing canonical customer is closed rather than replaced by request plan data',()=>{
 for(const company of [null,undefined,'ACTIVE',[],false,1])assert.deepEqual(check(company),closed('COMPANY_ENTITLEMENT_UNOBSERVED'));
});

test('output is sanitized and immutable; unrelated metadata cannot activate an expired trial',()=>{
 const company=row({trialEndsAt:new Date(checkedAt.getTime()-1),name:'Private name',stripeCustomerId:'private-customer',stripeSubscriptionId:'private-subscription',metadata:{subscriptionStatus:'ACTIVE',subscriptionPlan:'PRO',paid:true,trialDays:15,phone:'+12025550123'}});
 Object.freeze(company.metadata);Object.freeze(company);const before=JSON.stringify(company),result=check(company);
 assert.deepEqual(result,closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED'));
 assert.equal(JSON.stringify(company),before);assert.equal(Object.isFrozen(result),true);
 assert.equal(JSON.stringify(result).includes('Private'),false);assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('+12025550123'),false);
 assert.throws(()=>{result.allowed=true;},TypeError);
});
