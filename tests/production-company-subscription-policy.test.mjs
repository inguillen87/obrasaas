import assert from 'node:assert/strict';
import test from 'node:test';
import {approvedSubscriptionConfiguration,subscriptionCommand,subscriptionAttemptId,subscriptionExternalReference,verifiedSubscriptionObservation} from '../src/lib/company-subscription-policy.mjs';

const id='00000000-0000-4000-8000-000000000001';
const offer={id:'pro-monthly',plan:'PRO',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:'Impuestos incluidos',termsVersion:'terms-v1',includesAllIn:true,automaticExtras:false};
const config=()=>({version:1,provider:'MERCADO_PAGO',merchantId:'12345',accountMode:'LIVE',catalogVersion:'catalog-v1',offers:[{...offer}]});
const attempt=()=>({id:subscriptionAttemptId('company-a',id),organizationId:'company-a',provider:'MERCADO_PAGO',merchantId:'12345',accountMode:'LIVE',catalogVersion:'catalog-v1',offer:{...offer},resourceId:null});
const time='2026-10-12T12:00:00.000Z';
const observation=()=>({provider:'MERCADO_PAGO',merchantId:'12345',accountMode:'LIVE',organizationId:'company-a',attemptId:attempt().id,offerId:offer.id,catalogVersion:'catalog-v1',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,resourceId:'provider-sub-a',status:'AUTHORIZED',observedAt:time,periodStartsAt:null,periodEndsAt:null,cancelAtPeriodEnd:false,payment:null,checkoutUrl:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=provider-sub-a'});
const paid=()=>({...observation(),status:'ACTIVE',periodStartsAt:'2026-10-12T10:00:00.000Z',periodEndsAt:'2026-11-12T10:00:00.000Z',payment:{id:'payment-1',invoiceId:'invoice-1',status:'APPROVED',amountMinor:'14900',currency:'USD',paidAt:'2026-10-12T10:01:00.000Z'}});
const normalize=value=>verifiedSubscriptionObservation(value,attempt(),{checkoutHost:'www.mercadopago.com.ar',observedAt:time});

test('missing catalog is closed and an approved quote is exact, immutable and all inclusive',()=>{
  assert.equal(approvedSubscriptionConfiguration(null),null);const c=approvedSubscriptionConfiguration(config());assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.offers[0]));
  for(const patch of [{amountMinor:14900},{amountMinor:'149.00'},{amountMinor:'1'},{amountMinor:'014900'},{includesAllIn:false},{automaticExtras:true},{taxTreatment:''},{termsVersion:''},{currency:'EUR'},{periodCount:12},{amountMinor:'NaN'}]){const c=config();Object.assign(c.offers[0],patch);assert.throws(()=>approvedSubscriptionConfiguration(c),{code:'COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING'});}
  const ars=config();Object.assign(ars.offers[0],{currency:'ARS',amountMinor:'22500000'});assert.equal(approvedSubscriptionConfiguration(ars).offers[0].amountMinor,'22500000');
  const duplicate=config();duplicate.offers.push({...offer,id:'another'});assert.throws(()=>approvedSubscriptionConfiguration(duplicate));
});
test('client cannot choose merchant, amount, financial proof or payer identity',()=>{
  const value={scope:'a'.repeat(64),operationId:id,offerId:offer.id,catalogVersion:'catalog-v1',acceptanceReceiptId:'company_subscription_offer_acceptance_'+'b'.repeat(64),acceptanceDigest:'c'.repeat(64)};assert.deepEqual(subscriptionCommand(value,'begin'),value);
  for(const field of ['amountMinor','merchantId','paid','payerEmail','payerEmailVerified','organizationId','provider','subscriptionStatus'])assert.throws(()=>subscriptionCommand({...value,[field]:'forged'},'begin'),{code:'COMPANY_SUBSCRIPTION_INPUT_INVALID'});
  assert.equal(subscriptionExternalReference('company-a',attempt().id),attempt().id);assert.notEqual(subscriptionAttemptId('company-b',id),attempt().id);
  const historical={...value};delete historical.acceptanceReceiptId;delete historical.acceptanceDigest;assert.throws(()=>subscriptionCommand(historical,'begin'),{code:'COMPANY_SUBSCRIPTION_INPUT_INVALID'});
});

test('acceptance command requires explicit true and exact current catalog offer and terms references',()=>{
  const value={scope:'a'.repeat(64),operationId:id,offerId:offer.id,catalogVersion:'catalog-v1',catalogDigest:'b'.repeat(64),offerDigest:'c'.repeat(64),termsVersion:'terms-v1',termsSha256:'d'.repeat(64),accepted:true};assert.deepEqual(subscriptionCommand(value,'accept_offer'),value);
  for(const patch of [{accepted:false},{accepted:'true'},{accepted:null},{termsSha256:'bad'},{offerDigest:'BAD'},{catalogDigest:null},{termsText:'Browser terms'},{taxTreatment:'Browser tax'},{amountMinor:'1'},{merchantId:'forged'},{organizationId:'foreign'}])assert.throws(()=>subscriptionCommand({...value,...patch},'accept_offer'),{code:'COMPANY_SUBSCRIPTION_INPUT_INVALID'});
});
test('pending checkout and authorization do not prove payment or activate a paid period',()=>{
  for(const status of ['PENDING','AUTHORIZED']){const result=normalize({...observation(),status});assert.equal(result.paidCovered,false);assert.equal(result.payment,null);}
  assert.throws(()=>normalize({state:'UNKNOWN',resourceId:'provider-sub-a'}),{code:'COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED'});
});
test('only exact current resource and approved paid monthly coverage qualifies',()=>{
  assert.equal(normalize(paid()).paidCovered,true);
  for(const [key,value]of [['merchantId','foreign'],['accountMode','TEST'],['organizationId','company-b'],['attemptId','forged'],['amountMinor','34900'],['currency','ARS'],['catalogVersion','different'],['offerId','other'],['provider','STRIPE']])assert.throws(()=>normalize({...paid(),[key]:value}),{code:'COMPANY_SUBSCRIPTION_PROVIDER_BINDING_REJECTED'});
  for(const patch of [{periodEndsAt:'2030-11-12T10:00:00.000Z'},{periodEndsAt:'2026-11-13T10:00:00.000Z'},{payment:{...paid().payment,status:'PENDING'}},{status:'AUTHORIZED'}]){
    const value={...paid(),...patch};if(patch.periodEndsAt)assert.throws(()=>normalize(value));else assert.equal(normalize(value).paidCovered,false);
  }
  const expired={...paid(),observedAt:'2026-11-12T10:00:00.000Z'};assert.equal(verifiedSubscriptionObservation(expired,attempt(),{checkoutHost:'www.mercadopago.com.ar',observedAt:expired.observedAt}).paidCovered,false);
});
test('stale observations and arbitrary checkout destinations are rejected',()=>{
  for(const observedAt of ['2026-10-12T11:58:59.000Z','2026-10-12T12:00:06.000Z','2026-02-30T12:00:00Z'])assert.throws(()=>normalize({...observation(),observedAt}));
  for(const checkoutUrl of ['https://evil.invalid/pay','http://www.mercadopago.com.ar/pay','https://user:password@www.mercadopago.com.ar/pay','https://www.mercadopago.com.ar:444/pay'])assert.throws(()=>normalize({...observation(),checkoutUrl}));
  const revoked=normalize({...paid(),payment:{...paid().payment,status:'REFUNDED'}});assert.equal(revoked.paidCovered,false);
  assert.equal(normalize({...paid(),status:'CANCELED',cancelAtPeriodEnd:true}).paidCovered,true);
});
