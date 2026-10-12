import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createCompanySubscriptionProvider,companySubscriptionCheckoutUrl,companySubscriptionExternalReference,verifyCompanySubscriptionNotification} from '../src/lib/company-subscription-provider.mjs';

// All account, payer, token and payment values below are synthetic. The
// injected transport never makes an HTTP request to an account or payment API.
const time=Date.parse('2026-10-12T12:00:00.000Z');
const config={accessToken:'synthetic-account-token-only',merchantId:'900001',currency:'USD',accountMode:'TEST',checkoutHost:'www.mercadopago.com.ar',backUrl:'https://example.invalid/billing/return',notificationUrl:'https://example.invalid/billing/webhook',webhookSecret:'synthetic-webhook-secret-only'};
const offer={id:'pro-monthly-v1',plan:'PRO',catalogVersion:'catalog-v1',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1};
const context={organizationId:'company-synthetic',attemptId:'attempt-synthetic',merchantId:config.merchantId,accountMode:'TEST',offer,payerEmail:'verified-payer@example.invalid',payerEmailVerified:true};
const subId='synthetic_preapproval_01';
const checkoutUrl=`https://${config.checkoutHost}/subscriptions/checkout?preapproval_id=${subId}`;
const subscription=(extra={})=>({id:subId,collector_id:900001,external_reference:context.attemptId,status:'authorized',auto_recurring:{frequency:1,frequency_type:'months',currency_id:'USD',transaction_amount:149},init_point:checkoutUrl,...extra});
const invoice=(extra={})=>({id:500001,type:'scheduled',preapproval_id:subId,external_reference:context.attemptId,currency_id:'USD',transaction_amount:'149.00',debit_date:'2026-10-01T12:00:00.000Z',payment:{id:700001,status:'approved'},...extra});
const payment=(extra={})=>({id:700001,collector_id:900001,external_reference:context.attemptId,live_mode:false,currency_id:'USD',transaction_amount:149,status:'approved',date_approved:'2026-10-01T12:01:00.000Z',transaction_amount_refunded:0,refunds:[],...extra});
function fixture({account={id:900001,tags:['test_user']},sub=subscription(),bill=invoice(),charge=payment(),post,search,subscriptionSearch,transport,options={}}={}){
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url:String(url),init});if(transport)return transport(url,init);
    const parsed=new URL(url),path=parsed.pathname;
    if(path==='/users/me')return Response.json(account);
    if(init.method==='POST')return typeof post==='function'?post(url,init):Response.json(post??subscription({status:'pending'}),{status:201});
    if(path==='/authorized_payments/search')return Response.json(parsed.searchParams.has('preapproval_id')?(subscriptionSearch??{paging:{total:0,offset:0,limit:20},results:[]}):(search??{paging:{total:1,offset:0},results:[bill]}));
    if(path.startsWith('/authorized_payments/'))return Response.json(bill);
    if(path.startsWith('/v1/payments/'))return Response.json(charge);
    if(path.startsWith('/preapproval/'))return Response.json(init.method==='PUT'?subscription({status:'cancelled'}):sub);
    assert.fail('Unexpected route '+url);
  };
  return {calls,provider:createCompanySubscriptionProvider({config,now:()=>time,fetchImpl,...options})};
}
const inspect={...context,resourceId:subId};
const readCharge={...context,providerSubscriptionId:subId,notificationType:'subscription_authorized_payment',resourceId:'500001'};
function notification({resource='700001',type='payment',ts=String(time/1000),requestId='synthetic-request-01',secret=config.webhookSecret}={}){
  const manifest=`id:${resource.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const hash=createHmac('sha256',secret).update(manifest).digest('hex');
  return {url:`https://example.invalid/billing/webhook?data.id=${resource}&type=${type}`,headers:new Headers({'x-signature':`ts=${ts},v1=${hash}`,'x-request-id':requestId}),body:{type,data:{id:resource}},secret:config.webhookSecret,now:()=>time};
}

test('configuration missing any explicit merchant decision is closed without transport',async()=>{
  for(const key of Object.keys(config)){
    let calls=0;const provider=createCompanySubscriptionProvider({config:{...config,[key]:undefined},fetchImpl:()=>{calls++;assert.fail('No request before complete config');}});
    assert.equal(provider.readiness().available,false);assert.equal(provider.readiness().purchaseVerified,false);
    await assert.rejects(provider.createCheckout(context),{code:'BILLING_CONFIGURATION_PENDING'});assert.equal(calls,0);
  }
});
test('currency is configured explicitly and USD never derives ARS or accepted merchant support',async()=>{
  const f=fixture();const result=await f.provider.createCheckout(context);
  assert.equal(result.state,'CHECKOUT_CREATED');assert.equal(result.status,'PENDING');assert.equal(result.payment,null);
  assert.equal(companySubscriptionExternalReference(context),context.attemptId);
  assert.deepEqual(f.calls.map(c=>new URL(c.url).pathname),['/users/me','/preapproval']);
  const sent=JSON.parse(f.calls[1].init.body);
  assert.equal(sent.auto_recurring.currency_id,'USD');assert.equal(sent.auto_recurring.transaction_amount,149);assert.equal(sent.external_reference,context.attemptId);assert.equal(sent.status,'pending');
  assert.equal(sent.payer_email,context.payerEmail);assert.equal(sent.notification_url,config.notificationUrl);
  assert.equal(f.calls[1].init.headers['X-Idempotency-Key'],undefined);assert.equal(f.calls[1].init.redirect,'error');
  assert.ok(!JSON.stringify(result).includes(config.accessToken));assert.ok(!JSON.stringify(result).includes(context.payerEmail));
});
test('verified payer email and server offer are necessary before any POST',async()=>{
  for(const input of [{...context,payerEmailVerified:false},{...context,payerEmail:undefined},{...context,offer:{...offer,currency:'ARS'}},{...context,offer:{...offer,amountMinor:'149.00'}},{...context,offer:{...offer,periodCount:12}}]){
    const f=fixture();await assert.rejects(f.provider.createCheckout(input));assert.equal(f.calls.length,0);
  }
});
test('server offer and catalog reference syntax matches canonical policy without narrowing supported selectors',async()=>{
  const f=fixture(),result=await f.provider.createCheckout({...context,offer:{...offer,id:'pro:monthly.v1',catalogVersion:'catalog:2026.10'}});
  assert.equal(result.state,'CHECKOUT_CREATED');assert.equal(result.offerId,'pro:monthly.v1');assert.equal(result.catalogVersion,'catalog:2026.10');
});
test('current authenticated merchant and account mode must match before create',async()=>{
  for(const account of [{id:900002,tags:['test_user']},{id:900001,tags:[]},{id:900001},{id:900001,tags:[null]}]){
    const f=fixture({account});await assert.rejects(f.provider.createCheckout(context),{code:'BILLING_PROVIDER_MERCHANT_REJECTED'});assert.equal(f.calls.length,1);
  }
});
test('membership/lease fence is rechecked immediately before POST after authenticated account GET',async()=>{
  let guards=0;const f=fixture();const result=await f.provider.createCheckout({...context,beforeExternal:async()=>{guards++;if(guards===2)throw new Error('synthetic revoked authority');}});
  assert.equal(guards,2);assert.equal(result.state,'UNKNOWN');assert.equal(f.calls.length,1);assert.equal(f.calls[0].init.method,'GET');
  const healthy=fixture();let successfulGuards=0;await healthy.provider.createCheckout({...context,beforeExternal:async()=>{successfulGuards++;}});assert.equal(successfulGuards,2);
});
test('all checkout projections select exact HTTPS Mercado Pago host and subscription',()=>{
  assert.equal(companySubscriptionCheckoutUrl(checkoutUrl,{checkoutHost:config.checkoutHost,resourceId:subId}),checkoutUrl);
  for(const value of [checkoutUrl.replace('https:','http:'),checkoutUrl.replace(config.checkoutHost,'evil.invalid'),checkoutUrl.replace(config.checkoutHost,config.checkoutHost+'.evil.invalid'),checkoutUrl.replace('/subscriptions/checkout','/redirect'),checkoutUrl+'&redirect=https://evil.invalid',checkoutUrl+'&preapproval_id='+subId,checkoutUrl.replace(subId,'other'),checkoutUrl+'#return',checkoutUrl.replace('https://','https://user@')])assert.equal(companySubscriptionCheckoutUrl(value,{checkoutHost:config.checkoutHost,resourceId:subId}),null);
});
test('uncertain POST transport, malformed JSON, provider error and unsafe response never retry',async()=>{
  for(const post of [async()=>{throw new Error(config.accessToken);},async()=>new Response(config.accessToken,{status:500}),async()=>new Response('{broken',{headers:{'content-type':'application/json'}}),subscription({init_point:'https://evil.invalid/checkout'}),subscription({collector_id:900002}),subscription({auto_recurring:{frequency:1,frequency_type:'months',currency_id:'ARS',transaction_amount:149}})]){
    const f=fixture({post});const result=await f.provider.createCheckout(context);assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BILLING_PROVIDER_CREATE_UNCERTAIN');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);assert.ok(!JSON.stringify(result).includes(config.accessToken));
  }
});
test('unknown create recovery cannot use an undocumented reference filter or recreate',async()=>{
  const f=fixture();const result=await f.provider.recoverCheckout(context);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BILLING_PROVIDER_REFERENCE_RECOVERY_UNSUPPORTED');assert.equal(f.calls.length,0);
});
test('unsafe checkout preserves only fully bound provider ID for GET recovery, foreign merchant ID never binds',async()=>{
  const f=fixture({post:subscription({init_point:'https://evil.invalid/checkout'})}),result=await f.provider.createCheckout(context);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.resourceId,subId);assert.equal(result.checkoutUrl,undefined);
  const recovered=await f.provider.recoverCheckout({...context,resourceId:result.resourceId});assert.equal(recovered.state,'SUBSCRIPTION_OBSERVED');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
  const foreign=await fixture({post:subscription({collector_id:900002})}).provider.createCheckout(context);assert.equal(foreign.resourceId,undefined);
});
test('known subscription recovery only reads current ID and authorization is not payment',async()=>{
  const f=fixture();const result=await f.provider.inspectSubscription(inspect);
  assert.equal(result.status,'AUTHORIZED');assert.equal(result.payment,null);assert.equal(result.periodEndsAt,null);assert.deepEqual(f.calls.map(c=>c.init.method),['GET','GET','GET']);
});
test('lost webhook recovery searches known subscription invoices and reads actual current approved payment using GET only',async()=>{
  const f=fixture({subscriptionSearch:{paging:{offset:0,total:1},results:[invoice()]}}),created=await f.provider.createCheckout(context);
  assert.equal(created.state,'CHECKOUT_CREATED');const initialCalls=f.calls.length;
  const result=await f.provider.recoverCheckout({...context,resourceId:created.resourceId});
  assert.equal(result.state,'CHARGE_VERIFIED');assert.equal(result.status,'ACTIVE');assert.equal(result.payment.status,'APPROVED');assert.equal(result.payment.id,'700001');
  const recoveredCalls=f.calls.slice(initialCalls);assert.ok(recoveredCalls.every(call=>call.init.method==='GET'));assert.equal(f.calls.filter(call=>call.init.method==='POST').length,1);
  assert.equal(recoveredCalls[2].url,'https://api.mercadopago.com/authorized_payments/search?preapproval_id='+subId);assert.equal(new URL(recoveredCalls[3].url).pathname,'/authorized_payments/500001');assert.equal(new URL(recoveredCalls.at(-1).url).pathname,'/v1/payments/700001');
});
test('invoice recovery refuses partial pages, excessive history, duplicate/current ambiguous invoices and broad filter errors',async()=>{
  for(const subscriptionSearch of [{paging:{offset:1,total:1},results:[invoice()]},{paging:{offset:0,total:21},results:[invoice()]},{paging:{offset:0,total:2},results:[invoice()]},{paging:{offset:0,total:2},results:[invoice(),invoice()]},{paging:{offset:0,total:2},results:[invoice(),invoice({id:500002})]}]){
    const f=fixture({subscriptionSearch});const result=await f.provider.recoverCheckout(inspect);assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BILLING_PROVIDER_INVOICE_HISTORY_UNOBSERVED');assert.equal(f.calls.length,3);assert.ok(f.calls.every(call=>call.init.method==='GET'));
  }
  for(const bad of [invoice({preapproval_id:'another_company_sub'}),invoice({external_reference:'another_company_attempt'}),invoice({currency_id:'ARS'}),invoice({transaction_amount:'148.99'})]){
    await assert.rejects(fixture({subscriptionSearch:{paging:{offset:0,total:1},results:[bad]}}).provider.recoverCheckout(inspect),{code:'BILLING_PROVIDER_CHARGE_BINDING_REJECTED'});
  }
});
test('recovery never trusts stale search approval and observes current refund/chargeback including latest prior paid invoice',async()=>{
  const old=invoice({debit_date:'2026-08-31T12:00:00.000Z'}),future=invoice({id:500003,debit_date:'2026-11-01T12:00:00.000Z',payment:null});
  for(const status of ['refunded','charged_back']){
    const f=fixture({bill:old,charge:payment({status,date_approved:'2026-08-31T12:01:00.000Z'}),subscriptionSearch:{paging:{offset:0,total:2},results:[future,old]}}),result=await f.provider.recoverCheckout(inspect);
    assert.equal(result.state,'CHARGE_OBSERVED');assert.equal(result.payment.status,status==='refunded'?'REFUNDED':'CHARGEBACK');assert.equal(result.periodEndsAt,'2026-09-30T12:00:00.000Z');assert.notEqual(result.status,'ACTIVE');assert.equal(new URL(f.calls.at(-1).url).pathname,'/v1/payments/700001');
  }
  const current=fixture({charge:payment({status:'refunded'}),subscriptionSearch:{paging:{offset:0,total:1},results:[invoice()]}});assert.equal((await current.provider.recoverCheckout(inspect)).payment.status,'REFUNDED');
});
test('subscription current ID, collector, reference, amount, currency and recurrence must match',async()=>{
  for(const sub of [subscription({id:'other'}),subscription({collector_id:1}),subscription({external_reference:'other-attempt'}),subscription({auto_recurring:{frequency:1,frequency_type:'months',currency_id:'USD',transaction_amount:149.01}}),subscription({auto_recurring:{frequency:2,frequency_type:'months',currency_id:'USD',transaction_amount:149}}),subscription({status:'active'}),subscription({auto_recurring:{frequency:1,frequency_type:'months',currency_id:'USD',transaction_amount:149,free_trial:{frequency:1,frequency_type:'months'}}})]){
    const f=fixture({sub});await assert.rejects(f.provider.inspectSubscription(inspect),{code:'BILLING_PROVIDER_BINDING_REJECTED'});
  }
});
test('verified invoice and separately read approved current payment establish paid period',async()=>{
  const f=fixture();const result=await f.provider.readCharge(readCharge);
  assert.equal(result.state,'CHARGE_VERIFIED');assert.equal(result.status,'ACTIVE');assert.equal(result.payment.status,'APPROVED');assert.equal(result.payment.invoiceId,'500001');assert.equal(result.periodStartsAt,'2026-10-01T12:00:00.000Z');assert.equal(result.periodEndsAt,'2026-11-01T12:00:00.000Z');assert.equal(result.periodSource,'MERCADO_PAGO_INVOICE_DEBIT_DATE_MONTHLY');
  assert.deepEqual(f.calls.map(c=>new URL(c.url).pathname),['/users/me','/authorized_payments/500001','/preapproval/'+subId,'/v1/payments/700001']);
});
test('payment topic resolves exact documented invoice payment_id filter and checks matching ID',async()=>{
  const f=fixture();const result=await f.provider.readCharge({...readCharge,notificationType:'payment',resourceId:'700001'});
  assert.equal(result.payment.status,'APPROVED');assert.equal(f.calls[1].url,'https://api.mercadopago.com/authorized_payments/search?payment_id=700001');
  for(const search of [{paging:{total:0},results:[]},{paging:{total:2},results:[invoice(),invoice()]},{paging:{total:2},results:[invoice()]}]){
    const bad=fixture({search});assert.equal((await bad.provider.readCharge({...readCharge,notificationType:'payment',resourceId:'700001'})).state,'UNKNOWN');
  }
});
test('wrong invoice subscription, reference, amount, currency and missing period reject paid facts',async()=>{
  for(const bill of [invoice({preapproval_id:'other'}),invoice({external_reference:'other'}),invoice({currency_id:'ARS'}),invoice({transaction_amount:'149.01'}),invoice({id:500002}),invoice({type:'arbitrary'}),invoice({payment:null})]){
    const f=fixture({bill});await assert.rejects(f.provider.readCharge(readCharge),{code:'BILLING_PROVIDER_CHARGE_BINDING_REJECTED'});
  }
  assert.equal((await fixture({bill:invoice({debit_date:null})}).provider.readCharge(readCharge)).state,'UNKNOWN');
});
test('approved invoice alone cannot overcome wrong current payment merchant/amount/currency/mode/reference',async()=>{
  for(const charge of [payment({collector_id:900002}),payment({transaction_amount:149.01}),payment({currency_id:'ARS'}),payment({live_mode:true}),payment({external_reference:'other'}),payment({id:700002}),payment({status:'arbitrary'})]){
    const f=fixture({charge});await assert.rejects(f.provider.readCharge(readCharge),{code:'BILLING_PROVIDER_CHARGE_BINDING_REJECTED'});
  }
});
test('refund, pending, rejected, chargeback or unconfirmed paid timestamp cannot activate',async()=>{
  for(const status of ['pending','refunded','charged_back','rejected','in_mediation']){
    const f=fixture({charge:payment({status,date_approved:null})});const result=await f.provider.readCharge(readCharge);assert.equal(result.state,'CHARGE_OBSERVED');assert.notEqual(result.status,'ACTIVE');
  }
  for(const charge of [payment({date_approved:null}),payment({date_approved:'2026-09-30T00:00:00.000Z'}),payment({date_approved:'2026-10-13T00:00:00.000Z'}),payment({transaction_amount_refunded:1}),payment({refunds:[{id:1}]})])assert.equal((await fixture({charge}).provider.readCharge(readCharge)).state,'UNKNOWN');
  assert.equal((await fixture({bill:invoice({payment:{id:700001,status:'pending'}})}).provider.readCharge(readCharge)).state,'UNKNOWN');
});
test('old approved invoice supplies factual period but does not activate current subscription',async()=>{
  const f=fixture({bill:invoice({debit_date:'2026-08-31T12:00:00.000Z'})});const result=await f.provider.readCharge(readCharge);
  assert.equal(result.state,'CHARGE_VERIFIED');assert.equal(result.periodEndsAt,'2026-09-30T12:00:00.000Z');assert.notEqual(result.status,'ACTIVE');
  await assert.rejects(f.provider.readCharge({...readCharge,periodEndsAt:'2026-10-31T12:00:00.000Z'}),{code:'BILLING_PROVIDER_PERIOD_REJECTED'});
});
test('transport body and time limits close an account read without leakage or mutation',async()=>{
  for(const transport of [async()=>Response.json({id:900001,tags:['test_user'],secret:config.accessToken.repeat(100)}),async()=>new Response('{}',{headers:{'content-type':'text/html'}}),async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'999999'}}),async()=>new Promise(()=>{})]){
    const f=fixture({transport,options:{timeoutMs:20,maxResponseBytes:128}});const result=await f.provider.inspectSubscription(inspect);assert.equal(result.state,'UNKNOWN');assert.ok(!JSON.stringify(result).includes(config.accessToken));assert.equal(f.calls.length,1);
  }
});
test('cancel renewal uses current bound subscription then PUT cancelled, no fabricated end date',async()=>{
  const f=fixture();const result=await f.provider.cancelAtPeriodEnd(inspect);
  assert.equal(result.state,'RENEWAL_STOPPED');assert.equal(result.renewalStopped,true);assert.equal(result.cancelAtPeriodEnd,true);assert.equal(result.periodEndsAt,null);assert.deepEqual(JSON.parse(f.calls.at(-1).init.body),{status:'cancelled'});
  assert.equal(f.calls.at(-1).init.method,'PUT');
  const canceled=fixture({sub:subscription({status:'cancelled'})});assert.equal((await canceled.provider.cancelAtPeriodEnd(inspect)).renewalStopped,true);assert.equal(canceled.calls.some(c=>c.init.method==='PUT'),false);
});
test('official signed manifest validates seconds timestamp and query data.id normalization',()=>{
  const input=notification({resource:'SubABC',type:'subscription_preapproval'});const event=verifyCompanySubscriptionNotification(input);
  assert.equal(event.resourceId,'subabc');assert.equal(event.notificationType,'subscription_preapproval');assert.equal(event.signatureTimestamp,'2026-10-12T12:00:00.000Z');assert.match(event.replayKey,/^[a-f0-9]{64}$/);assert.equal(Object.isFrozen(event),true);assert.equal(event.organizationId,undefined);
});
test('factory signature capability is object-local and cannot be faked or shared across providers',()=>{
  const a=fixture().provider,b=fixture().provider,input=notification();const event=a.verifyNotification(input);
  assert.equal(a.isVerifiedEvent(event),true);assert.equal(a.isVerifiedEvent({...event}),false);assert.equal(b.isVerifiedEvent(event),false);assert.equal(a.isVerifiedEvent(verifyCompanySubscriptionNotification(input)),false);assert.equal(a.isVerifiedEvent({verified:true}),false);
});
test('notification type is outside HMAC; replay identity stays same across type changes',()=>{
  const a=notification({resource:'500001',type:'payment'}),b=notification({resource:'500001',type:'subscription_authorized_payment'});
  assert.equal(verifyCompanySubscriptionNotification(a).replayKey,verifyCompanySubscriptionNotification(b).replayKey);
});
test('verified event resolver reads only current provider resources and yields durable subscription lookup',async()=>{
  for(const input of [notification({resource:'500001',type:'subscription_authorized_payment'}),notification({resource:'700001',type:'payment'}),notification({resource:subId,type:'subscription_preapproval'})]){
    const f=fixture(),event=f.provider.verifyNotification(input),resolved=await f.provider.resolveNotification(event);
    assert.equal(resolved.providerSubscriptionId,subId);assert.equal(resolved.merchantId,config.merchantId);assert.equal(resolved.eventId,event.eventId);assert.deepEqual(resolved.notification,{notificationType:event.notificationType,resourceId:event.resourceId});assert.equal(resolved.organizationId,undefined);assert.ok(f.calls.every(c=>c.init.method==='GET'));
  }
  const f=fixture();await assert.rejects(f.provider.resolveNotification({provider:'MERCADO_PAGO',resourceId:'500001',verified:true}),{code:'BILLING_WEBHOOK_SIGNATURE_REJECTED'});assert.equal(f.calls.length,0);
  const wrong=fixture({sub:subscription({collector_id:900002})}),event=wrong.provider.verifyNotification(notification({resource:subId,type:'subscription_preapproval'}));await assert.rejects(wrong.provider.resolveNotification(event),{code:'BILLING_PROVIDER_BINDING_REJECTED'});
});
test('cancellation transport uncertainty stays unknown and no PUT retry runs',async()=>{
  const calls=[];const provider=createCompanySubscriptionProvider({config,now:()=>time,fetchImpl:async(url,options)=>{calls.push(options.method);if(options.method==='PUT')throw new Error(config.accessToken);return Response.json(new URL(url).pathname==='/users/me'?{id:900001,tags:['test_user']}:subscription());}});
  const result=await provider.cancelAtPeriodEnd(inspect);assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BILLING_PROVIDER_CANCELLATION_UNCERTAIN');assert.equal(calls.filter(method=>method==='PUT').length,1);assert.ok(!JSON.stringify(result).includes(config.accessToken));
});
test('invalid secret, signature bytes, request ID, stale/future timestamp and millisecond timestamp reject',()=>{
  const valid=notification();const bad=[];
  bad.push({...valid,secret:'wrong-synthetic-secret'});
  const wrongHeaders=new Headers(valid.headers);wrongHeaders.set('x-signature',wrongHeaders.get('x-signature').replace(/v1=./,'v1=0'));bad.push({...valid,headers:wrongHeaders});
  const missingHeaders=new Headers(valid.headers);missingHeaders.delete('x-request-id');bad.push({...valid,headers:missingHeaders});
  bad.push(notification({ts:String(time/1000-301)}));bad.push(notification({ts:String(time/1000+301)}));bad.push(notification({ts:String(time)}));
  for(const input of bad)assert.throws(()=>verifyCompanySubscriptionNotification(input),error=>error.status===401);
  assert.throws(()=>verifyCompanySubscriptionNotification({...valid,secret:undefined}),{code:'BILLING_WEBHOOK_CONFIGURATION_PENDING'});
});
test('duplicate signature fields, query keys, IPN/QR/product exceptions and inconsistent payload reject',()=>{
  const valid=notification(),signature=valid.headers.get('x-signature');
  for(const text of [signature+',ts='+time/1000,signature.replace(/v1=/,'v2='),signature+',ignored=value','ts='+time/1000+',ts='+time/1000,signature.replace(/v1=.*/,'v1=ff')]){const headers=new Headers(valid.headers);headers.set('x-signature',text);assert.throws(()=>verifyCompanySubscriptionNotification({...valid,headers}));}
  for(const input of [{...valid,url:valid.url+'&data.id=700001'},{...valid,url:valid.url+'&type=payment'},{...valid,url:valid.url+'&topic=payment'},{...valid,body:{type:'subscription_authorized_payment',data:{id:'700001'}}},{...valid,body:{type:'payment',data:{id:'700002'}}},notification({type:'merchant_order'}),notification({type:'point_integration_wh'}),notification({type:'orders'})])assert.throws(()=>verifyCompanySubscriptionNotification(input),{code:'BILLING_WEBHOOK_INPUT_INVALID'});
});
