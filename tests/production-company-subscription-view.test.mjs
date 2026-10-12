import test from 'node:test';
import assert from 'node:assert/strict';
import {companySubscriptionView,companySubscriptionCheckoutUrl,companySubscriptionBeginCommand,companySubscriptionCancelCommand,companySubscriptionErrorMessage,createCompanySubscriptionJournal} from '../src/app/(identity)/cuenta/company-subscription-view.mjs';

const scope = 'a'.repeat(64),foreignScope = 'b'.repeat(64),operationId = '11111111-1111-4111-8111-111111111111',cancelOperationId = '22222222-2222-4222-8222-222222222222';
const attemptId = 'company_subscription_'+ 'c'.repeat(64),receiptId = 'company_subscription_payment_'+ 'd'.repeat(64);
const now = Date.parse('2026-10-12T12:00:00.000Z');
const offer = (plan = 'PRO',currency = 'USD',amountMinor = plan === 'PRO'?'14900':'34900') => ({id:`offer-${plan.toLowerCase()}`,plan,amountMinor,currency,periodUnit:'MONTH',periodCount:1,taxTreatment:'Impuestos incluidos en el importe informado.',termsVersion:'terms-2026-10',includesAllIn:true,automaticExtras:false});
const snapshot = () => ({version:1,scope,organization:{id:'org_pilot',name:'Empresa piloto'},observedAt:'2026-10-12T12:00:00.000Z',configuration:{state:'CONFIGURATION_PENDING',catalogVersion:null,offers:[]},subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:'2026-10-15T03:00:00.000Z',entitlement:{allowed:true,basis:'CURRENT_TRIAL',reasonCode:null}},attempt:null,recovery:null});
const ready = () => ({...snapshot(),configuration:{state:'READY',catalogVersion:'catalog-2026-10',offers:[offer(),offer('ENTERPRISE')]}});
const attempt = (state = 'CHECKOUT_READY') => ({attemptId,operationId,state,plan:'PRO',offerId:'offer-pro',catalogVersion:'catalog-2026-10',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:offer().taxTreatment,termsVersion:offer().termsVersion,includesAllIn:true,automaticExtras:false,checkoutUrl:state === 'CHECKOUT_READY'?'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=remote_123':null,receiptId:null,paidPeriod:null,cancelAtPeriodEnd:false,code:null,cancellation:null});
const active = () => ({...ready(),subscription:{plan:'PRO',status:'ACTIVE',trialEndsAt:null,entitlement:{allowed:true,basis:'ACTIVE_PAID_PLAN',reasonCode:null}},attempt:{...attempt('ACTIVE'),receiptId,paidPeriod:{startsAt:'2026-10-10T12:00:00.000Z',endsAt:'2026-11-10T12:00:00.000Z'}}});
const view = (value,expected = {}) => companySubscriptionView(value,{scope,...expected});
const ref = (action = 'begin',overrides = {}) => ({version:1,scope,organizationId:'org_pilot',operationId:action === 'begin'?operationId:cancelOperationId,action,createdAt:now,...overrides});

test('an unconfigured seller supplies no offer or charge action and preserves the observed trial', () => {
  const input = snapshot(),before = JSON.stringify(input),result = view(input);
  assert.equal(result.configurationReady,false);
  assert.deepEqual(result.offers,[]);
  assert.equal(result.canBegin,false);
  assert.equal(result.canCancel,false);
  assert.equal(result.statusLabel,'Prueba vigente');
  assert.match(result.trialExpiryLabel,/15\/10\/2026.*00:00.*Argentina/);
  assert.match(result.paymentLabel,/no hay un pago confirmado/);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.offers),true);
  assert.equal(JSON.stringify(input),before);
});

test('explicit offers show the approved total and immutable monthly conditions', () => {
  const input = ready(),result = view(input);
  assert.deepEqual(result.offers.map(item => item.priceLabel),['USD 149,00','USD 349,00']);
  assert.deepEqual(result.offers.map(item => item.planLabel),['Pro','Empresa']);
  assert.equal(result.canBegin,true);
  assert.equal(Object.isFrozen(result.offers[0]),true);
  assert.deepEqual(companySubscriptionBeginCommand(result,{scope,offerId:'offer-pro',confirmed:true}),{action:'begin',scope,offerId:'offer-pro',catalogVersion:'catalog-2026-10'});
  for (const changes of [{confirmed:false},{scope:foreignScope},{offerId:'foreign'}]) assert.throws(() => companySubscriptionBeginCommand(result,{scope,offerId:'offer-pro',confirmed:true,...changes}));
  assert.throws(() => companySubscriptionBeginCommand(view(snapshot()),{scope,offerId:'offer-pro',confirmed:true}));
});

test('an explicitly approved ARS offer is rendered as ARS without calculating a USD conversion', () => {
  const input = ready();input.configuration.offers = [offer('PRO','ARS','20599950')];
  const result = view(input);
  assert.equal(result.offers[0].priceLabel,'ARS 205.999,50');
  assert.equal(result.offers[0].amountMinor,'20599950');
  assert.equal(JSON.stringify(result).includes('USD'),false);
});

test('recovering a previous checkout retains its approved price and terms after catalog changes', () => {
  const input = {...ready(),attempt:attempt()};input.configuration = {state:'READY',catalogVersion:'catalog-new',offers:[{...offer('PRO','ARS','20599950'),termsVersion:'terms-new',taxTreatment:'Condición nueva aprobada.'}]};
  const result = view(input,{operationId});
  assert.equal(result.attempt.priceLabel,'USD 149,00');
  assert.equal(result.attempt.taxLabel,offer().taxTreatment);
  assert.equal(result.attempt.termsVersion,'terms-2026-10');
  assert.equal(result.offers[0].priceLabel,'ARS 205.999,50');
  assert.equal(result.canBegin,false);
  for (const changes of [{periodUnit:'YEAR'},{periodCount:2},{automaticExtras:true},{includesAllIn:false},{taxTreatment:null},{termsVersion:null}]) assert.throws(() => view({...input,attempt:{...input.attempt,...changes}}));
});

test('malformed amounts, unsupported currencies, altered fixed USD prices and extras close offers', () => {
  for (const change of [{amountMinor:'0'},{amountMinor:14900},{amountMinor:'149.00'},{amountMinor:'014900'},{amountMinor:'-14900'},{amountMinor:'14901'},{amountMinor:'9'.repeat(16),currency:'ARS'},{currency:'EUR'},{currency:'usd'},{periodUnit:'YEAR'},{periodCount:12},{includesAllIn:false},{automaticExtras:true},{taxTreatment:''},{termsVersion:null},{merchantId:'foreign-merchant'}]) {
    const input = ready();input.configuration.offers[0] = {...input.configuration.offers[0],...change};assert.throws(() => view(input));
  }
  const duplicate = ready();duplicate.configuration.offers = [offer(),offer()];assert.throws(() => view(duplicate));
  for (const change of [{state:'READY',catalogVersion:null},{offers:[]},{state:'CONFIGURATION_PENDING'},{state:'LIVE'},{merchantId:'foreign'},{provider:'foreign'}]) assert.throws(() => view({...ready(),configuration:{...ready().configuration,...change}}));
});

test('every envelope is bound to the current scope, organization and requested operation', () => {
  const input = {...ready(),attempt:attempt()};
  assert.equal(view(input,{organizationId:'org_pilot',operationId}).attempt.operationId,operationId);
  for (const expected of [{scope:foreignScope},{scope:'bad'},{organizationId:'org_other'},{operationId:cancelOperationId},{operationId:'bad'}]) assert.throws(() => view(input,expected));
  for (const change of [{scope:foreignScope},{version:2},{organization:{id:'org.other',name:'Otra empresa'}},{organization:{id:'org_pilot',name:'<Empresa>'}},{merchantId:'merchant_other'}]) assert.throws(() => view({...input,...change}));
  assert.throws(() => companySubscriptionView(input));
  // An unobserved durable operation keeps its reference; absence is not proof
  // that the provider never received it.
  assert.equal(view(ready(),{operationId}).attempt,null);
});

test('authorization is distinct from payment and cannot make a second begin available', () => {
  const result = view({...ready(),attempt:attempt('AUTHORIZED')});
  assert.equal(result.attempt.paidCovered,false);
  assert.equal(result.attempt.paymentConfirmed,false);
  assert.equal(result.attempt.paidThroughLabel,null);
  assert.equal(result.statusLabel,'Débito autorizado · pago pendiente');
  assert.equal(result.canBegin,false);
  assert.equal(result.canCancel,true);
  assert.match(result.paymentLabel,/no hay un pago confirmado/);
});

test('paid access needs a matching receipt and current period; canonical ACTIVE alone is not payment', () => {
  const confirmed = view(active());
  assert.equal(confirmed.attempt.paidCovered,true);
  assert.match(confirmed.attempt.paidThroughLabel,/10\/11\/2026.*09:00/);
  assert.match(confirmed.paymentLabel,/Pago confirmado/);
  assert.equal(confirmed.statusLabel,'Período pagado');
  const registered = active();registered.attempt = null;
  assert.equal(view(registered).statusLabel,'Suscripción registrada');
  assert.match(view(registered).paymentLabel,/no hay un pago confirmado/);
  for (const change of [{receiptId:null},{paidPeriod:null},{receiptId:'fake'},{paidPeriod:{startsAt:'2026-10-10T12:00:00Z',endsAt:'2026-10-10T12:00:00Z'}},{paidPeriod:{startsAt:'2026-10-10T12:00:00Z',endsAt:'2026-11-10T12:00:00Z',paid:true}}]) assert.throws(() => view({...active(),attempt:{...active().attempt,...change}}));
  const wrongPlan = active();wrongPlan.subscription.plan = 'ENTERPRISE';assert.throws(() => view(wrongPlan));
  const expired = active();expired.observedAt = expired.attempt.paidPeriod.endsAt;
  assert.equal(view(expired).attempt.paidCovered,false);
  assert.equal(view(expired).attempt.paidThroughLabel,null);
});

test('canceling renewal retains the paid period and uses its own durable operation', () => {
  const input = active(),before = view(input);
  assert.deepEqual(companySubscriptionCancelCommand(before,{scope,confirmed:true}),{action:'cancel_renewal',scope,subscriptionAttemptId:attemptId});
  assert.throws(() => companySubscriptionCancelCommand(before,{scope,confirmed:false}));
  input.attempt = {...input.attempt,state:'CANCEL_CONFIRMED',cancelAtPeriodEnd:true,cancellation:{operationId:cancelOperationId,state:'CONFIRMED'}};
  const result = view(input,{operationId:cancelOperationId,action:'cancel_renewal'});
  assert.equal(result.attempt.operationId,operationId);
  assert.equal(result.attempt.cancellation.operationId,cancelOperationId);
  assert.equal(result.canCancel,false);
  assert.equal(result.attempt.paidCovered,true);
  assert.equal(result.attempt.paidThroughLabel,before.attempt.paidThroughLabel);
  assert.equal(result.statusLabel,'Renovación cancelada');
  assert.throws(() => view(input,{operationId:cancelOperationId,action:'begin'}));
  assert.throws(() => view(input,{operationId,action:'cancel_renewal'}));
  assert.throws(() => companySubscriptionCancelCommand(result,{scope,confirmed:true}));
  for (const cancellation of [{operationId:cancelOperationId,state:'PAID'},{operationId,state:'CONFIRMED'},{operationId:cancelOperationId,state:'CONFIRMED',receiptId}]) assert.throws(() => view({...input,attempt:{...input.attempt,cancellation}}));
});

test('cancellation pending or unknown remains visible and cannot open another payment', () => {
  for (const state of ['DISPATCHING','UNKNOWN']) {
    const input = active();input.attempt = {...input.attempt,state:state === 'UNKNOWN'?'UNKNOWN':'CANCEL_REQUESTED',cancellation:{operationId:cancelOperationId,state}};
    const result = view(input,{operationId:cancelOperationId,action:'cancel_renewal'});
    assert.equal(result.canBegin,false);
    assert.equal(result.canCancel,false);
    assert.equal(result.attempt.checkoutUrl,null);
    assert.equal(result.attempt.paidCovered,true);
    assert.match(result.attempt.paidThroughLabel,/10\/11\/2026/);
  }
});

test('a fresh subscription requires confirmed closure and a ended paid period or canceled unpaid checkout', () => {
  for (const state of ['CANCELED','CANCEL_CONFIRMED']) {
    const input = active();input.attempt.state = state;input.attempt.cancelAtPeriodEnd = true;input.attempt.cancellation = {operationId:cancelOperationId,state:'CONFIRMED'};
    assert.equal(view(input).canBegin,false,'Current paid coverage blocks another checkout');
    input.observedAt = input.attempt.paidPeriod.endsAt;input.subscription.entitlement = {allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED'};
    const result = view(input);assert.equal(result.canBegin,true);assert.deepEqual(companySubscriptionBeginCommand(result,{scope,offerId:'offer-pro',confirmed:true}),{action:'begin',scope,offerId:'offer-pro',catalogVersion:'catalog-2026-10'});
    input.attempt.cancellation.state = 'UNKNOWN';assert.equal(view(input).canBegin,false,'An uncertain cancellation does not enable a new charge');
  }
  const unpaid = {...ready(),attempt:{...attempt('CANCELED'),cancelAtPeriodEnd:true}};
  assert.equal(view(unpaid).canBegin,true);
  unpaid.attempt.state = 'CANCEL_CONFIRMED';assert.equal(view(unpaid).canBegin,false,'A missing paid-period boundary cannot imply expiry');
  for (const state of ['DISPATCHING','UNKNOWN','AUTHORIZED','PAST_DUE','SUSPENDED','CANCEL_REQUESTED']) assert.equal(view({...ready(),attempt:attempt(state)}).canBegin,false);
});

test('the checkout URL admits only the exact verified Mercado Pago subscription route', () => {
  const url = 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=remote_123';
  assert.equal(companySubscriptionCheckoutUrl(url),url);
  assert.equal(companySubscriptionCheckoutUrl(null),null);
  for (const value of ['http://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=remote_123','//www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=remote_123','https://www.mercadopago.com.ar.evil.test/subscriptions/checkout?preapproval_id=remote_123','https://www.mercadopago.com.ar./subscriptions/checkout?preapproval_id=remote_123','https://user:secret@www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=remote_123','https://www.mercadopago.com.ar:443/subscriptions/checkout?preapproval_id=remote_123',url+'#paid',url+'&success=true',url+'&preapproval_id=foreign',url.replace('/subscriptions/checkout','/checkout'),url.replace('remote_123',''),url.replace('remote_123','bad%2Fid'),123]) assert.throws(() => companySubscriptionCheckoutUrl(value));
  const invalidState = {...ready(),attempt:{...attempt('AUTHORIZED'),checkoutUrl:url}};assert.throws(() => view(invalidState));
});

test('provider hints, merchant additions and impossible dates never become a financial display', () => {
  const base = active();
  for (const path of ['', 'organization','configuration','subscription','subscription.entitlement','attempt','attempt.paidPeriod']) {
    const input = structuredClone(base);let target = input;for (const key of path.split('.').filter(Boolean)) target = target[key];target.merchantId = 'FOREIGN';assert.throws(() => view(input));
  }
  for (const value of ['2026-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-10-12T24:00:00Z','2026-10-12T09:00:00-03:00','2026-10-12']) assert.throws(() => view({...base,observedAt:value}));
  const changedOffer = active();changedOffer.attempt.offerId = 'offer-enterprise';assert.throws(() => view(changedOffer));
});

test('unavailable or expired trial data is labeled without inventing a current benefit', () => {
  const input = snapshot();input.subscription.trialEndsAt = null;input.subscription.entitlement = {allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'};
  assert.equal(view(input).statusLabel,'Vencimiento por revisar');
  input.subscription.trialEndsAt = input.observedAt;input.subscription.entitlement.reasonCode = 'COMPANY_ENTITLEMENT_TRIAL_EXPIRED';
  assert.equal(view(input).statusLabel,'Prueba finalizada');
  input.subscription.entitlement.allowed = true;assert.throws(() => view(input));
});

test('server-managed paid boundaries remain closed without exposing provider metadata', () => {
  const input = active();input.observedAt = input.attempt.paidPeriod.endsAt;input.subscription.entitlement = {allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED'};
  assert.equal(view(input).statusLabel,'Período pagado finalizado');
  assert.equal(view(input).attempt.paidCovered,false);
  input.subscription.entitlement.reasonCode = 'COMPANY_ENTITLEMENT_PAID_PERIOD_NOT_STARTED';assert.throws(() => view(input));
  input.observedAt = '2026-10-09T12:00:00.000Z';
  assert.equal(view(input).statusLabel,'Período pagado aún no iniciado');
  input.attempt = null;input.subscription.entitlement.reasonCode = 'COMPANY_ENTITLEMENT_PAID_PERIOD_UNOBSERVED';
  assert.equal(view(input).statusLabel,'Pago por revisar');
  assert.equal(view(input).canBegin,false);
  input.subscription.entitlement.reasonCode = 'PAID_FROM_BROWSER';assert.throws(() => view(input));
});

function memoryStorage() {
  const values = new Map(),log = [];
  const withStorage = async (mode,expectedScope,callback) => {
    const rows = [...values.keys()].filter(key => key.startsWith(`obrasaas.company-subscription-reference.v1.${expectedScope}.`));
    const storage = {length:rows.length,key:index => rows[index] ?? null,getItem:key => values.get(key) ?? null,setItem:(key,value) => {assert.equal(mode,'readwrite');values.set(key,value);log.push(['write',key]);},removeItem:key => {assert.equal(mode,'readwrite');values.delete(key);log.push(['remove',key]);}};
    const result = callback(storage);log.push(['commit',mode]);return result;
  };
  return {withStorage,values,log};
}

test('a committed reference is read back before dispatch and stores no financial or private payload', async () => {
  const storage = memoryStorage(),journal = createCompanySubscriptionJournal({withStorage:storage.withStorage,now:() => now,onChange:() => {}}),reference = ref();
  assert.deepEqual(await journal.reserve(reference),reference);
  assert.deepEqual(storage.log.map(item => item[0]),['write','commit','commit']);
  assert.deepEqual(await journal.read(scope,'org_pilot'),reference);
  const stored = JSON.parse([...storage.values.values()][0]);
  assert.deepEqual(Object.keys(stored).sort(),['action','createdAt','operationId','organizationId','scope','version']);
  for (const change of [{checkoutUrl:'https://private'},{email:'private@example.com'},{amountMinor:'14900'},{profile:{}},{token:'PRIVATE'}]) await assert.rejects(journal.reserve({...reference,...change}));
  await assert.rejects(journal.reserve(ref('cancel_renewal')));
  assert.equal((await journal.read(scope,'org_pilot')).operationId,operationId);
});

test('foreign scope, company and operation results cannot erase a pending reference', async () => {
  const storage = memoryStorage(),journal = createCompanySubscriptionJournal({withStorage:storage.withStorage,now:() => now,onChange:() => {}}),reference = ref();
  await journal.reserve(reference);
  assert.equal(await journal.read(foreignScope,'org_pilot'),null);
  assert.equal(await journal.read(scope,'org_other'),null);
  for (const state of ['DISPATCHING','UNKNOWN','CANCEL_REQUESTED']) assert.equal(await journal.settle(reference,view({...ready(),attempt:attempt(state)})),false);
  assert.equal(await journal.settle(reference,view(ready(),{operationId})),false);
  assert.equal(await journal.settle(reference,{...view({...ready(),attempt:attempt()}),scope:foreignScope}),false);
  assert.equal(await journal.settle(reference,{...view({...ready(),attempt:attempt()}),organizationId:'org_other'}),false);
  assert.equal(await journal.settle(reference,{...view({...ready(),attempt:attempt()}),attempt:{...attempt(),operationId:cancelOperationId}}),false);
  assert.deepEqual(await journal.read(scope,'org_pilot'),reference);
  assert.equal(await journal.settle(reference,view({...ready(),attempt:attempt()})),true);
  assert.equal(await journal.read(scope,'org_pilot'),null);
});

test('a cancellation reference only settles against its own confirmed cancellation', async () => {
  const storage = memoryStorage(),journal = createCompanySubscriptionJournal({withStorage:storage.withStorage,now:() => now,onChange:() => {}}),reference = ref('cancel_renewal');
  await journal.reserve(reference);
  assert.equal(await journal.settle(reference,view(active())),false);
  const input = active();input.attempt = {...input.attempt,state:'CANCEL_REQUESTED',cancellation:{operationId:cancelOperationId,state:'UNKNOWN'}};
  assert.equal(await journal.settle(reference,view(input)),false);
  input.attempt.state = 'CANCEL_CONFIRMED';input.attempt.cancelAtPeriodEnd = true;input.attempt.cancellation.state = 'CONFIRMED';
  assert.equal(await journal.settle(reference,view(input,{operationId:cancelOperationId,action:'cancel_renewal'})),true);
  assert.equal(await journal.read(scope,'org_pilot'),null);
});

test('only a matching durable NO_DISPATCH closure can settle an otherwise unobserved operation', async () => {
  for (const action of ['begin','cancel_renewal']) {
    const storage = memoryStorage(),journal = createCompanySubscriptionJournal({withStorage:storage.withStorage,now:() => now,onChange:() => {}}),reference = ref(action);
    await journal.reserve(reference);
    assert.equal(await journal.settle(reference,view(ready(),{operationId:reference.operationId})),false,'Ordinary absent attempt is not closure');
    const input = {...ready(),recovery:{operationId:reference.operationId,state:'NO_DISPATCH'}};
    const result = view(input,{operationId:reference.operationId,action});
    assert.equal(result.canBegin,false,'A closure proof must be followed by a fresh current-company read');
    assert.match(result.paymentLabel,/no hay un pago confirmado/);
    assert.equal(result.attempt,null);
    assert.equal(await journal.settle(reference,{...result,scope:foreignScope}),false);
    assert.equal(await journal.settle(reference,{...result,organizationId:'org_other'}),false);
    assert.equal(await journal.settle(reference,{...result,recovery:{...result.recovery,operationId:action === 'begin'?cancelOperationId:operationId}}),false);
    assert.equal(await journal.settle(reference,result),true);
    assert.equal(await journal.read(scope,'org_pilot'),null);
  }
});

test('a closure hint cannot masquerade as payment, a different operation or an ordinary snapshot', () => {
  const base = {...ready(),recovery:{operationId,state:'NO_DISPATCH'}};
  assert.throws(() => view(base));
  for (const recovery of [{operationId:cancelOperationId,state:'NO_DISPATCH'},{operationId,state:'NOT_FOUND'},{operationId,state:'NO_DISPATCH',paid:true},{operationId:'bad',state:'NO_DISPATCH'},{}]) assert.throws(() => view({...base,recovery},{operationId}));
  assert.throws(() => view({...base,attempt:attempt()},{operationId}));
  const missing = ready();delete missing.recovery;assert.throws(() => view(missing));
});

test('uncertain attempts do not expire into permission for a new charge', async () => {
  const storage = memoryStorage(),journal = createCompanySubscriptionJournal({withStorage:storage.withStorage,now:() => now,onChange:() => {}});
  const old = ref('begin',{createdAt:now-400*86400000});
  const key = `obrasaas.company-subscription-reference.v1.${scope}.org_pilot`;storage.values.set(key,JSON.stringify(old));
  assert.deepEqual(await journal.read(scope,'org_pilot'),old);
  await assert.rejects(journal.reserve(ref('cancel_renewal')));
  assert.equal(await journal.settle(old,view({...ready(),attempt:attempt('UNKNOWN')})),false);
  assert.deepEqual(await journal.read(scope,'org_pilot'),old);
});

test('malformed and future references fail closed while failed storage never invents a committed ticket', async () => {
  const storage = memoryStorage(),journal = createCompanySubscriptionJournal({withStorage:storage.withStorage,now:() => now,onChange:() => {}});
  await assert.rejects(journal.reserve(ref('begin',{createdAt:now+60001})));
  await assert.rejects(journal.reserve(ref('begin',{createdAt:now-60001})));
  storage.values.set(`obrasaas.company-subscription-reference.v1.${scope}.org_pilot`,JSON.stringify({...ref(),scope:foreignScope}));
  await assert.rejects(journal.read(scope,'org_pilot'));
  const unavailable = createCompanySubscriptionJournal({withStorage:async () => {throw new Error('storage blocked');},now:() => now,onChange:() => {}});
  await assert.rejects(unavailable.reserve(ref()));
});

test('safe fixed errors never display provider details, token values or a false successful charge', () => {
  const secret = 'token=PRIVATE_MERCHANT';
  for (const error of [{status:401,message:secret},{status:403,message:secret},{code:'WORKSPACE_CONTEXT_CHANGED',message:secret},{status:503,code:'COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING',message:secret},{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE',message:secret},{name:'AbortError',message:secret},{status:500,message:secret}]) {
    assert.equal(companySubscriptionErrorMessage(error).includes(secret),false);
    assert.equal(companySubscriptionErrorMessage(error,{mutation:true}).includes(secret),false);
  }
  assert.match(companySubscriptionErrorMessage({status:500},{mutation:true}),/mismo intento/);
});
