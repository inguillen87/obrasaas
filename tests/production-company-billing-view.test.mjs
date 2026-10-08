import test from 'node:test';
import assert from 'node:assert/strict';
import {companyBillingView,companyBillingErrorMessage} from '../src/app/(identity)/cuenta/company-billing-view.mjs';

const scope = 'a'.repeat(64);
const snapshot = () => ({
  version:1,scope,organization:{id:'org_pilot',name:'Piloto Marcelo y Victoria'},observedAt:'2026-10-08T12:00:00.000Z',
  subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:'2026-10-09T03:00:00.000Z',entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}},
  billing:{state:'CONFIGURATION_PENDING',checkoutAvailable:false,paymentEvidence:'UNOBSERVED'},
});
const closed = reasonCode => ({allowed:false,basis:null,reasonCode});
const view = value => companyBillingView(value,{scope});
const clone = value => structuredClone(value);

test('a current canonical trial displays the Argentine expiry and exact observed time', () => {
  const input = snapshot(), before = JSON.stringify(input), result = view(input);
  assert.equal(result.companyName,'Piloto Marcelo y Victoria');
  assert.equal(result.planLabel,'Prueba gratuita');
  assert.equal(result.statusLabel,'En prueba');
  assert.match(result.trialExpiryLabel,/09\/10\/2026.*00:00:00.*Argentina/);
  assert.match(result.observedAtLabel,/08\/10\/2026.*09:00:00.*Argentina/);
  assert.equal(result.paymentLabel,'Comprobante de pago: no consultado.');
  assert.equal(result.checkoutLabel,'El pago en línea está pendiente de activación.');
  assert.equal(Object.isFrozen(result),true);
  assert.equal(JSON.stringify(input),before);
});

test('an expired trial is derived from the server observation, including the exact boundary', () => {
  for (const expiry of ['2026-10-08T12:00:00.000Z','2026-10-08T11:59:59.999Z']) {
    const input = snapshot();input.subscription.trialEndsAt = expiry;input.subscription.entitlement = closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED');
    assert.equal(view(input).statusLabel,'Prueba finalizada');
    assert.equal(view(input).tone,'attention');
  }
  const future = snapshot();future.observedAt = '2000-01-01T00:00:00Z';future.subscription.trialEndsAt = '2000-01-01T00:00:00.001Z';
  assert.equal(view(future).statusLabel,'En prueba');
  assert.throws(() => view({...future,subscription:{...future.subscription,entitlement:closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRED')}}));
});

test('registered paid plans never become a claimed payment receipt', () => {
  for (const plan of ['PRO','ENTERPRISE']) {
    const input = snapshot();input.subscription = {plan,status:'ACTIVE',trialEndsAt:null,entitlement:{allowed:true,basis:'ACTIVE_PAID_PLAN',reasonCode:null}};
    const result = view(input);
    assert.equal(result.statusLabel,'Suscripción activa');
    assert.equal(result.trialExpiryLabel,null);
    assert.match(result.entitlementLabel,/registrada/);
    assert.match(result.paymentLabel,/no consultado/);
    assert.equal(Object.hasOwn(result,'paid'),false);
    assert.equal(Object.hasOwn(result,'paymentVerified'),false);
  }
});

test('closed subscriptions and inconsistent canonical rows stay visibly closed', () => {
  const cases = [
    ['PRO','PAST_DUE','COMPANY_ENTITLEMENT_PAST_DUE','Pago pendiente'],
    ['ENTERPRISE','CANCELED','COMPANY_ENTITLEMENT_CANCELED','Suscripción cancelada'],
    ['PRO','SUSPENDED','COMPANY_ENTITLEMENT_SUSPENDED','Suscripción suspendida'],
    ['TRIAL','ACTIVE','COMPANY_ENTITLEMENT_ACTIVE_PLAN_UNSUPPORTED','Estado por revisar'],
    ['PRO','TRIALING','COMPANY_ENTITLEMENT_TRIAL_PLAN_MISMATCH','Estado por revisar'],
  ];
  for (const [plan,status,reasonCode,label] of cases) {
    const input = snapshot();input.subscription = {...input.subscription,plan,status,entitlement:closed(reasonCode)};
    assert.equal(view(input).statusLabel,label);
    assert.equal(view(input).tone,'attention');
  }
  const missingExpiry = snapshot();missingExpiry.subscription.trialEndsAt = null;missingExpiry.subscription.entitlement = closed('COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE');
  assert.equal(view(missingExpiry).statusLabel,'Vencimiento por revisar');
  assert.equal(view(missingExpiry).trialExpiryLabel,null);
});

test('context, envelope and unknown enums cannot be projected as a current company plan', () => {
  for (const change of [{scope:'b'.repeat(64)},{scope:scope.toUpperCase()},{version:2},{observedAt:null},{organization:[]},{subscription:null},{billing:[]},{organization:{id:'other.org',name:'Otra empresa'}},{organization:{id:'org_pilot',name:''}}]) assert.throws(() => view({...snapshot(),...change}));
  for (const expected of [undefined,null,{},{scope:'bad'},{scope:'b'.repeat(64)}]) assert.throws(() => companyBillingView(snapshot(),expected));
  for (const [key,values] of [['plan',['FREE','STARTER','pro',null]],['status',['UNPAID','CANCELLED','active',null]]]) for (const value of values) {
    const input = snapshot();input.subscription[key] = value;assert.throws(() => view(input));
  }
  for (const key of ['organization','subscription','billing','version','observedAt']) {const input = snapshot();delete input[key];assert.throws(() => view(input));}
});

test('real UTC instants are required; local strings and normalized impossible dates are rejected', () => {
  const invalid = ['2026-10-08','2026-10-08T12:00:00','2026-10-08T09:00:00-03:00','2026-02-29T00:00:00.000Z','2026-04-31T00:00:00.000Z','2026-10-08T24:00:00Z','2026-10-08T12:00:60Z','2026-10-08T12:00:00.0000Z',new Date('2026-10-08T12:00:00Z'),12345];
  for (const instant of invalid) {
    assert.throws(() => view({...snapshot(),observedAt:instant}));
    const input = snapshot();input.subscription.trialEndsAt = instant;assert.throws(() => view(input));
  }
  const leap = snapshot();leap.observedAt = '2028-02-28T03:00:00Z';leap.subscription.trialEndsAt = '2028-02-29T03:00:00Z';assert.match(view(leap).trialExpiryLabel,/29\/02\/2028/);
});

test('an entitlement contradiction or payment-like result cannot enable a display claim', () => {
  const forged = [
    {allowed:'true',basis:'CURRENT_TRIAL',reasonCode:null},
    {allowed:true,basis:'ACTIVE_PAID_PLAN',reasonCode:null},
    {allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'},
    {allowed:true,basis:'CURRENT_TRIAL',reasonCode:'paid'},
  ];
  for (const entitlement of forged) {const input = snapshot();input.subscription.entitlement = entitlement;assert.throws(() => view(input));}
  for (const change of [{state:'ACTIVE'},{checkoutAvailable:true},{paymentEvidence:'PAID'},{checkoutAvailable:0}]) assert.throws(() => view({...snapshot(),billing:{...snapshot().billing,...change}}));
});

test('sensitive additions are rejected and the successful projection contains only display fields', () => {
  const base = snapshot();
  for (const target of ['', 'organization','subscription','subscription.entitlement','billing']) {
    const input = clone(base);let record = input;for (const key of target.split('.').filter(Boolean)) record = record[key];
    record.stripeCustomerId = 'cus_PRIVATE';assert.throws(() => view(input));
  }
  const result = view(base);
  for (const forbidden of ['organizationId','scope','reasonCode','subscription','billing','stripeCustomerId','checkoutAvailable','paymentEvidence']) assert.equal(Object.hasOwn(result,forbidden),false);
  assert.equal(JSON.stringify(result).includes('org_pilot'),false);
  assert.equal(JSON.stringify(result).includes(scope),false);
});

test('errors clear presentation with fixed guidance rather than provider text or credentials', () => {
  for (const status of [401,403]) assert.match(companyBillingErrorMessage({status,message:'token=PRIVATE'}),/acceso/);
  assert.match(companyBillingErrorMessage({status:409,message:'PRIVATE'}),/empresa correcta/);
  assert.match(companyBillingErrorMessage({code:'WORKSPACE_CONTEXT_CHANGED'}),/empresa correcta/);
  for (const error of [{name:'AbortError'},{name:'TimeoutError'},{status:500,message:'PRIVATE'},{code:'COMPANY_BILLING_RESULT_UNCONFIRMED',message:'PRIVATE'}]) assert.equal(companyBillingErrorMessage(error).includes('PRIVATE'),false);
});
