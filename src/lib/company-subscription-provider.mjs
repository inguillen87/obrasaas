import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {WorkspaceError,workspaceId} from './workspace-policy.mjs';

const PROVIDER='MERCADO_PAGO';
const API='https://api.mercadopago.com';
const CHECKOUT_HOSTS=new Set(['www.mercadopago.com.ar','www.mercadopago.com.br','www.mercadopago.com.mx','www.mercadopago.com.co','www.mercadopago.com.pe','www.mercadopago.com.uy','www.mercadopago.cl']);
const CURRENCY_DECIMALS=Object.freeze({USD:2,ARS:2,BRL:2,MXN:2,COP:2,PEN:2,UYU:2,CLP:0});
const NOTIFICATION_TYPES=new Set(['payment','subscription_preapproval','subscription_authorized_payment']);
const SUBSCRIPTION_STATUS=Object.freeze({pending:'PENDING',authorized:'AUTHORIZED',paused:'SUSPENDED',cancelled:'CANCELED',canceled:'CANCELED'});
const PAYMENT_STATUS=Object.freeze({approved:'APPROVED',refunded:'REFUNDED',charged_back:'CHARGEBACK',pending:'PENDING',in_process:'PENDING',authorized:'PENDING',rejected:'REJECTED',cancelled:'CANCELED',in_mediation:'DISPUTED'});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validReference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(value);
const resourceId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const numericId=value=>(typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value))||(typeof value==='number'&&Number.isSafeInteger(value)&&value>0);
const id=value=>numericId(value)?String(value):null;
const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const nowMs=now=>{const value=typeof now==='function'?now():now;return value instanceof Date?value.getTime():Number(value);};
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};

function httpsUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.port?url:null;}catch{return null;}
}

// This is a projection, not a generic redirect allowlist. An init_point may
// only select the exact subscription returned by the authenticated API.
export function companySubscriptionCheckoutUrl(value,{checkoutHost,resourceId:subscriptionId}={}){
  const url=httpsUrl(value);
  if(!url||!CHECKOUT_HOSTS.has(checkoutHost)||url.hostname!==checkoutHost||url.pathname!=='/subscriptions/checkout'||url.searchParams.size!==1||url.searchParams.getAll('preapproval_id').length!==1||url.searchParams.get('preapproval_id')!==subscriptionId||!resourceId(subscriptionId))return null;
  return `https://${checkoutHost}/subscriptions/checkout?preapproval_id=${encodeURIComponent(subscriptionId)}`;
}

export function companySubscriptionExternalReference({organizationId,attemptId}={}){
  if(!workspaceId(organizationId)||!workspaceId(attemptId))fail('BILLING_PROVIDER_INPUT_INVALID',400);
  // The durable attempt owns the company binding. No body-provided company
  // identifier is trusted when provider notifications are reconciled.
  return attemptId;
}

function amountMinor(value,decimals){
  const text=typeof value==='number'&&Number.isFinite(value)?String(value):value;
  if(typeof text!=='string'||!new RegExp(`^(?:0|[1-9][0-9]{0,10})(?:\\.[0-9]{1,${Math.max(1,decimals)}})?$`).test(text))return null;
  const [whole,fraction='']=text.split('.');
  if(fraction.length>decimals)return null;
  const result=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
  return result>0n&&result<=1000000000000n?String(result):null;
}

function majorAmount(minor,decimals){
  const amount=BigInt(minor),unit=10n**BigInt(decimals);
  const text=decimals?`${amount/unit}.${String(amount%unit).padStart(decimals,'0')}`:String(amount);
  return Number(text);
}

function configReady(config){
  const back=httpsUrl(config.backUrl),notification=httpsUrl(config.notificationUrl);
  return typeof config.accessToken==='string'&&config.accessToken.length>=12&&config.accessToken.length<=2048&&!/[\s\u0000-\u001f]/.test(config.accessToken)&&numericId(config.merchantId)&&Object.hasOwn(CURRENCY_DECIMALS,config.currency)&&['LIVE','TEST'].includes(config.accountMode)&&CHECKOUT_HOSTS.has(config.checkoutHost)&&Boolean(back&&notification&&back.origin===notification.origin)&&typeof config.webhookSecret==='string'&&config.webhookSecret.length>=16&&config.webhookSecret.length<=512;
}

function expectedContext(input,config,{create=false}={}){
  if(!record(input)||!workspaceId(input.organizationId)||!workspaceId(input.attemptId))fail('BILLING_PROVIDER_INPUT_INVALID',400);
  const offer=input.offer;
  if(!record(offer)||!validReference(offer.id)||!validReference(offer.catalogVersion)||typeof offer.amountMinor!=='string'||! /^[1-9][0-9]{0,12}$/.test(offer.amountMinor)||BigInt(offer.amountMinor)>1000000000000n||offer.currency!==config.currency||offer.periodUnit!=='MONTH'||offer.periodCount!==1)fail('BILLING_PROVIDER_INPUT_INVALID',400);
  if(input.merchantId!==undefined&&String(input.merchantId)!==String(config.merchantId)||input.accountMode!==undefined&&input.accountMode!==config.accountMode)fail('BILLING_PROVIDER_BINDING_REJECTED');
  const reference=input.externalReference??companySubscriptionExternalReference(input);
  if(typeof reference!=='string'||reference.length>256||! /^[A-Za-z0-9:._-]{1,256}$/.test(reference))fail('BILLING_PROVIDER_INPUT_INVALID',400);
  if(create&&(input.payerEmailVerified!==true||typeof input.payerEmail!=='string'||input.payerEmail.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.payerEmail)))fail('BILLING_VERIFIED_PAYER_EMAIL_REQUIRED',409);
  const subscriptionId=input.providerSubscriptionId??input.resourceId;
  if(subscriptionId!==undefined&&subscriptionId!==null&&!resourceId(subscriptionId))fail('BILLING_PROVIDER_INPUT_INVALID',400);
  return {...input,offer,externalReference:reference,providerSubscriptionId:subscriptionId??null};
}

function subscriptionFacts(body,expected,config,observedAt){
  if(!record(body)||!resourceId(body.id)||expected.providerSubscriptionId&&body.id!==expected.providerSubscriptionId||id(body.collector_id)!==String(config.merchantId)||body.external_reference!==expected.externalReference||!Object.hasOwn(SUBSCRIPTION_STATUS,body.status)||!record(body.auto_recurring)||body.auto_recurring.currency_id!==expected.offer.currency||amountMinor(body.auto_recurring.transaction_amount,CURRENCY_DECIMALS[config.currency])!==expected.offer.amountMinor||body.auto_recurring.frequency!==1||body.auto_recurring.frequency_type!=='months'||body.auto_recurring.free_trial!=null)fail('BILLING_PROVIDER_BINDING_REJECTED');
  const checkoutUrl=body.init_point==null?null:companySubscriptionCheckoutUrl(body.init_point,{checkoutHost:config.checkoutHost,resourceId:body.id});
  if(body.init_point!=null&&!checkoutUrl)fail('BILLING_PROVIDER_CHECKOUT_REJECTED');
  return {state:'SUBSCRIPTION_OBSERVED',provider:PROVIDER,merchantId:String(config.merchantId),accountMode:config.accountMode,organizationId:expected.organizationId,attemptId:expected.attemptId,resourceId:body.id,providerSubscriptionId:body.id,externalReference:expected.externalReference,status:SUBSCRIPTION_STATUS[body.status],providerStatus:body.status,offerId:expected.offer.id,catalogVersion:expected.offer.catalogVersion,amountMinor:expected.offer.amountMinor,currency:expected.offer.currency,periodUnit:'MONTH',periodCount:1,observedAt,periodStartsAt:null,periodEndsAt:null,cancelAtPeriodEnd:false,payment:null,checkoutUrl};
}

function invoicePeriod(invoice,expected){
  const start=iso(invoice.debit_date);
  if(!start)fail('BILLING_PROVIDER_PERIOD_UNOBSERVED',503);
  const date=new Date(start),day=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
  const end=date.toISOString();
  // The immutable monthly offer plus the provider invoice's debit_date is the
  // source of this interval. Browser returns and local authorization dates
  // never establish a paid period.
  if(expected.periodStartsAt!=null&&iso(expected.periodStartsAt)!==start||expected.periodEndsAt!=null&&iso(expected.periodEndsAt)!==end)fail('BILLING_PROVIDER_PERIOD_REJECTED');
  return {periodStartsAt:start,periodEndsAt:end,periodSource:'MERCADO_PAGO_INVOICE_DEBIT_DATE_MONTHLY'};
}

function invoiceFacts(invoice,expected,config,{requirePayment=true}={}){
  if(!record(invoice)||!numericId(invoice.id)||invoice.type!=='scheduled'||invoice.preapproval_id!==expected.providerSubscriptionId||invoice.external_reference!==expected.externalReference||invoice.currency_id!==expected.offer.currency||amountMinor(invoice.transaction_amount,CURRENCY_DECIMALS[config.currency])!==expected.offer.amountMinor||(requirePayment||invoice.payment!=null)&&(!record(invoice.payment)||!numericId(invoice.payment.id)))fail('BILLING_PROVIDER_CHARGE_BINDING_REJECTED');
  return {invoiceId:String(invoice.id),paymentId:invoice.payment==null?null:String(invoice.payment.id),...invoicePeriod(invoice,expected)};
}

/**
 * Explicit, bounded HTTP transport for company subscriptions. No token is read
 * from the environment and no customer/account/financial request runs on import.
 * POST /preapproval has no endpoint-specific idempotency guarantee in its
 * current official reference: a durable one-shot reservation MUST precede it.
 * There is no retry here, including after timeout, malformed 2xx or HTTP 5xx.
 * /preapproval/search has no documented exact external_reference filter, so
 * unknown creates without a provider ID cannot safely be recovered by search.
 * Sources: MP create-preapproval, search-preapproval, get-authorized-payment,
 * authorized-payment-search, pending-payments and subscriptions Webhooks docs.
 */
export function createCompanySubscriptionProvider({config={},fetchImpl=globalThis.fetch,now=()=>Date.now(),timeoutMs=8000,maxResponseBytes=65536}={}){
  config=Object.freeze({...config});
  if(typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>15000||!Number.isInteger(maxResponseBytes)||maxResponseBytes<128||maxResponseBytes>131072)throw new TypeError('Bounded billing transport required');
  const ready=()=>configReady(config);
  const verifiedEvents=new WeakSet();
  const requireReady=()=>{if(!ready())fail('BILLING_CONFIGURATION_PENDING',503);};
  const unknown=(code='BILLING_PROVIDER_UNOBSERVED')=>({state:'UNKNOWN',code,provider:PROVIDER,payment:null});
  async function request(path,{method='GET',body,beforeExternal}={}){
    const controller=new AbortController();let timer;
    const work=(async()=>{
      if(beforeExternal!==undefined){if(typeof beforeExternal!=='function')fail('BILLING_PROVIDER_INPUT_INVALID',400);await beforeExternal();}
      const response=await fetchImpl(API+path,{method,headers:{Accept:'application/json',Authorization:`Bearer ${config.accessToken}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error',cache:'no-store'});
      if(!response||response.status<200||response.status>=300){
        // Never echo provider error bodies, payer data or token-bearing errors.
        try{await response?.body?.cancel();}catch{}
        fail(response?.status===404?'BILLING_PROVIDER_RESOURCE_UNOBSERVED':'BILLING_PROVIDER_UNOBSERVED',503);
      }
      if(response.url&&new URL(response.url).origin!==API||response.redirected===true)fail('BILLING_PROVIDER_RESPONSE_REJECTED',503);
      const length=response.headers.get('content-length');
      if(length!==null&&(! /^\d+$/.test(length)||Number(length)>maxResponseBytes))fail('BILLING_PROVIDER_RESPONSE_REJECTED',503);
      const type=response.headers.get('content-type')||'';
      if(!/^application\/json(?:;|$)/i.test(type)||!response.body?.getReader)fail('BILLING_PROVIDER_RESPONSE_REJECTED',503);
      const reader=response.body.getReader();const chunks=[];let total=0;
      try{
        while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>maxResponseBytes)fail('BILLING_PROVIDER_RESPONSE_REJECTED',503);chunks.push(chunk.value);}
      }finally{try{await reader.cancel();}catch{}}
      try{const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));if(!record(parsed))fail('BILLING_PROVIDER_RESPONSE_REJECTED',503);return parsed;}catch{fail('BILLING_PROVIDER_RESPONSE_REJECTED',503);}
    })();
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new WorkspaceError('BILLING_PROVIDER_UNOBSERVED',503));},timeoutMs);});
    try{return await Promise.race([work,timeout]);}catch(error){throw error instanceof WorkspaceError?error:new WorkspaceError('BILLING_PROVIDER_UNOBSERVED',503);}finally{clearTimeout(timer);}
  }
  async function account(beforeExternal){
    const user=await request('/users/me',{beforeExternal});
    if(id(user.id)!==String(config.merchantId)||!Array.isArray(user.tags)||user.tags.some(tag=>typeof tag!=='string')||(user.tags.includes('test_user')?'TEST':'LIVE')!==config.accountMode)fail('BILLING_PROVIDER_MERCHANT_REJECTED');
  }
  async function subscription(expected){return subscriptionFacts(await request('/preapproval/'+encodeURIComponent(expected.providerSubscriptionId),{beforeExternal:expected.beforeExternal}),expected,config,new Date(nowMs(now)).toISOString());}
  async function readChargeInternal(expected,notification){
    if(!record(notification)||!['payment','subscription_authorized_payment'].includes(notification.notificationType)||!numericId(notification.resourceId))fail('BILLING_PROVIDER_INPUT_INVALID',400);
    let invoice;
    if(notification.notificationType==='subscription_authorized_payment')invoice=await request('/authorized_payments/'+notification.resourceId,{beforeExternal:expected.beforeExternal});
    else{
      // payment_id is an explicitly documented invoice filter. q or broad
      // preapproval searches are never used to guess a subscription binding.
      const search=await request('/authorized_payments/search?payment_id='+notification.resourceId,{beforeExternal:expected.beforeExternal});
      if(!Array.isArray(search.results)||search.results.length!==1||!record(search.paging)||Number(search.paging.total)!==1)fail('BILLING_PROVIDER_CHARGE_UNOBSERVED',503);
      invoice=search.results[0];
      if(String(invoice?.payment?.id)!==String(notification.resourceId))fail('BILLING_PROVIDER_CHARGE_BINDING_REJECTED');
    }
    if(notification.notificationType==='subscription_authorized_payment'&&String(invoice?.id)!==String(notification.resourceId))fail('BILLING_PROVIDER_CHARGE_BINDING_REJECTED');
    const invoiceInfo=invoiceFacts(invoice,expected,config);
    const facts=await subscription(expected);
    const payment=await request('/v1/payments/'+invoiceInfo.paymentId,{beforeExternal:expected.beforeExternal});
    if(!record(payment)||String(payment.id)!==invoiceInfo.paymentId||id(payment.collector_id)!==String(config.merchantId)||payment.live_mode!==(config.accountMode==='LIVE')||payment.currency_id!==expected.offer.currency||amountMinor(payment.transaction_amount,CURRENCY_DECIMALS[config.currency])!==expected.offer.amountMinor||payment.external_reference!==expected.externalReference||!Object.hasOwn(PAYMENT_STATUS,payment.status))fail('BILLING_PROVIDER_CHARGE_BINDING_REJECTED');
    const paidAt=iso(payment.date_approved);
    if(payment.status==='approved'&&(!paidAt||Date.parse(paidAt)<Date.parse(invoiceInfo.periodStartsAt)||Date.parse(paidAt)>nowMs(now)+30000||invoice.payment.status!=='approved'||(payment.transaction_amount_refunded!==undefined&&Number(payment.transaction_amount_refunded)!==0)||Array.isArray(payment.refunds)&&payment.refunds.length))fail('BILLING_PROVIDER_CHARGE_UNOBSERVED',503);
    const current=Date.parse(invoiceInfo.periodStartsAt)<=nowMs(now)&&nowMs(now)<Date.parse(invoiceInfo.periodEndsAt);
    return {...facts,...invoiceInfo,state:payment.status==='approved'?'CHARGE_VERIFIED':'CHARGE_OBSERVED',status:payment.status==='approved'&&facts.providerStatus==='authorized'&&current?'ACTIVE':facts.status,payment:{id:invoiceInfo.paymentId,status:PAYMENT_STATUS[payment.status],amountMinor:expected.offer.amountMinor,currency:expected.offer.currency,paidAt,invoiceId:invoiceInfo.invoiceId},checkoutUrl:null};
  }
  async function recoverCurrentCharge(expected,facts){
    // The documented preapproval_id filter identifies invoices belonging to a
    // known subscription. Do not guess an order-by field, or adopt a partial
    // first page as proof that a newer invoice/refund does not exist.
    const search=await request('/authorized_payments/search?preapproval_id='+encodeURIComponent(expected.providerSubscriptionId),{beforeExternal:expected.beforeExternal});
    if(!record(search.paging)||search.paging.offset!==0||!Number.isSafeInteger(search.paging.total)||search.paging.total<0||search.paging.total>20||!Array.isArray(search.results)||search.results.length>20||search.results.length!==search.paging.total)fail('BILLING_PROVIDER_INVOICE_HISTORY_UNOBSERVED',503);
    if(search.results.length===0)return facts;
    const seen=new Set(),invoices=[];
    for(const invoice of search.results){
      // Validate every row, even an old/unselected row. A broad or incorrectly
      // filtered response must never acquire a cross-company payment binding.
      const info=invoiceFacts(invoice,expected,config,{requirePayment:false});
      if(seen.has(info.invoiceId))fail('BILLING_PROVIDER_INVOICE_HISTORY_UNOBSERVED',503);
      seen.add(info.invoiceId);invoices.push(info);
    }
    const current=invoices.filter(info=>Date.parse(info.periodStartsAt)<=nowMs(now)&&nowMs(now)<Date.parse(info.periodEndsAt));
    if(current.length>1)fail('BILLING_PROVIDER_INVOICE_HISTORY_UNOBSERVED',503);
    let selected=current[0];
    if(!selected){
      const prior=invoices.filter(info=>Date.parse(info.periodStartsAt)<=nowMs(now)).sort((a,b)=>Date.parse(b.periodStartsAt)-Date.parse(a.periodStartsAt));
      if(prior.length>1&&prior[0].periodStartsAt===prior[1].periodStartsAt)fail('BILLING_PROVIDER_INVOICE_HISTORY_UNOBSERVED',503);
      selected=prior[0];
    }
    if(!selected)return facts;
    // A fresh invoice GET and payment GET are required even when the search
    // row reports approved. In particular, a prior paid invoice may now be
    // refunded/charged back; preserve that fact for exact-receipt revocation.
    return readChargeInternal(expected,{notificationType:'subscription_authorized_payment',resourceId:selected.invoiceId});
  }
  async function inspect(input){
    requireReady();const expected=expectedContext(input,config);
    if(!expected.providerSubscriptionId)return unknown('BILLING_PROVIDER_REFERENCE_RECOVERY_UNSUPPORTED');
    try{await account(expected.beforeExternal);if(input.notification)return await readChargeInternal(expected,input.notification);const facts=await subscription(expected);return await recoverCurrentCharge(expected,facts);}catch(error){if(error instanceof WorkspaceError&&error.status===409)throw error;return unknown(error instanceof WorkspaceError?error.code:undefined);}
  }
  return Object.freeze({
    readiness(){const available=ready();return {available,provider:PROVIDER,merchantId:available?String(config.merchantId):null,accountMode:available?config.accountMode:null,checkoutHost:available?config.checkoutHost:null,state:available?'CONFIGURED':'CONFIGURATION_PENDING',purchaseVerified:false};},
    async createCheckout(input){
      requireReady();const expected=expectedContext(input,config,{create:true});
      // Local memory is not a durable idempotency ledger. The store must mark
      // the attempt sent before this method and never call it again for it.
      await account(expected.beforeExternal);
      let candidateResourceId=null;
      try{
        const result=await request('/preapproval',{method:'POST',beforeExternal:expected.beforeExternal,body:{reason:expected.offer.plan==='ENTERPRISE'?'ObraSaaS Enterprise':'ObraSaaS Pro',external_reference:expected.externalReference,payer_email:input.payerEmail,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:majorAmount(expected.offer.amountMinor,CURRENCY_DECIMALS[config.currency]),currency_id:expected.offer.currency},back_url:config.backUrl,notification_url:config.notificationUrl,status:'pending'}});
        // Preserve an authenticated, fully bound ID even if checkout URL
        // projection fails. Recovery can GET it; no new POST is permitted.
        candidateResourceId=subscriptionFacts({...result,init_point:null},expected,config,new Date(nowMs(now)).toISOString()).resourceId;
        const facts=subscriptionFacts(result,expected,config,new Date(nowMs(now)).toISOString());
        if(!facts.checkoutUrl)fail('BILLING_PROVIDER_CHECKOUT_REJECTED');
        return {...facts,state:'CHECKOUT_CREATED'};
      }catch{return {...unknown('BILLING_PROVIDER_CREATE_UNCERTAIN'),...(candidateResourceId?{resourceId:candidateResourceId,providerSubscriptionId:candidateResourceId}:{})};}
    },
    inspectSubscription:inspect,
    recoverCheckout:inspect,
    readSubscription:inspect,
    readCharge(input){return inspect({...input,resourceId:input.providerSubscriptionId,notification:input.notification??{notificationType:input.notificationType,resourceId:input.resourceId}});},
    async cancelAtPeriodEnd(input){
      // MP status=cancelled stops renewals now; it does not schedule an end_date
      // or revoke the application's independently recorded paid interval.
      requireReady();const expected=expectedContext(input,config);
      if(!expected.providerSubscriptionId)return unknown('BILLING_PROVIDER_REFERENCE_RECOVERY_UNSUPPORTED');
      await account(expected.beforeExternal);const current=await subscription(expected);
      if(current.status==='CANCELED')return {...current,state:'RENEWAL_STOPPED',renewalStopped:true,cancelAtPeriodEnd:true};
      try{
        const updated=subscriptionFacts(await request('/preapproval/'+expected.providerSubscriptionId,{method:'PUT',beforeExternal:expected.beforeExternal,body:{status:'cancelled'}}),expected,config,new Date(nowMs(now)).toISOString());
        if(updated.status!=='CANCELED')return unknown('BILLING_PROVIDER_CANCELLATION_UNCERTAIN');
        return {...updated,state:'RENEWAL_STOPPED',renewalStopped:true,cancelAtPeriodEnd:true};
      }catch{return unknown('BILLING_PROVIDER_CANCELLATION_UNCERTAIN');}
    },
    verifyNotification(input){const event=verifyCompanySubscriptionNotification({...input,secret:config.webhookSecret,now});verifiedEvents.add(event);return event;},
    verifyWebhook(input){const event=verifyCompanySubscriptionNotification({...input,secret:config.webhookSecret,now});verifiedEvents.add(event);return event;},
    async resolveNotification(event){
      requireReady();if(!verifiedEvents.has(event))fail('BILLING_WEBHOOK_SIGNATURE_REJECTED',401);
      await account();let subscriptionId;
      if(event.notificationType==='subscription_preapproval'){
        const current=await request('/preapproval/'+encodeURIComponent(event.resourceId));
        if(!record(current)||current.id!==event.resourceId||id(current.collector_id)!==String(config.merchantId))fail('BILLING_PROVIDER_BINDING_REJECTED');
        subscriptionId=current.id;
      }else{
        let invoice;
        if(event.notificationType==='subscription_authorized_payment')invoice=await request('/authorized_payments/'+event.resourceId);
        else{
          const search=await request('/authorized_payments/search?payment_id='+event.resourceId);
          if(!Array.isArray(search.results)||search.results.length!==1||!record(search.paging)||Number(search.paging.total)!==1)fail('BILLING_PROVIDER_CHARGE_UNOBSERVED',503);
          invoice=search.results[0];
          if(String(invoice?.payment?.id)!==event.resourceId)fail('BILLING_PROVIDER_CHARGE_BINDING_REJECTED');
        }
        if(!record(invoice)||!resourceId(invoice.preapproval_id)||event.notificationType==='subscription_authorized_payment'&&String(invoice.id)!==event.resourceId)fail('BILLING_PROVIDER_CHARGE_BINDING_REJECTED');
        const current=await request('/preapproval/'+encodeURIComponent(invoice.preapproval_id));
        if(!record(current)||current.id!==invoice.preapproval_id||id(current.collector_id)!==String(config.merchantId))fail('BILLING_PROVIDER_BINDING_REJECTED');
        subscriptionId=current.id;
      }
      return Object.freeze({provider:PROVIDER,merchantId:String(config.merchantId),accountMode:config.accountMode,providerSubscriptionId:subscriptionId,notification:Object.freeze({notificationType:event.notificationType,resourceId:event.resourceId}),eventId:event.eventId});
    },
    isVerifiedEvent(event){return verifiedEvents.has(event);}
  });
}

/**
 * MP signs query data.id + x-request-id + ts (seconds). The payload and type
 * are NOT signed, so they never provide company authority or payment evidence.
 * Missing manifest parts are optional in MP's generic validator; this billing
 * contract rejects them, duplicate keys, unsigned IPN and QR/product exceptions.
 * Durable storage must reserve replayKey before processing any provider facts.
 */
export function verifyCompanySubscriptionNotification({headers,url,body,secret,now=()=>Date.now(),maxAgeMs=300000}={}){
  if(typeof secret!=='string'||secret.length<16||secret.length>512)fail('BILLING_WEBHOOK_CONFIGURATION_PENDING',503);
  if(!Number.isInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>300000)throw new TypeError('Bounded webhook timestamp window required');
  let parsed;try{parsed=new URL(url);}catch{fail('BILLING_WEBHOOK_INPUT_INVALID',400);}
  const query=parsed.searchParams;
  const dataIds=query.getAll('data.id'),types=query.getAll('type');
  if(dataIds.length!==1||types.length!==1||query.has('topic')||query.has('id')||query.has('data_id')||!resourceId(dataIds[0])||!NOTIFICATION_TYPES.has(types[0])||!record(body)||body.type!==types[0]||!record(body.data)||String(body.data.id).toLowerCase()!==dataIds[0].toLowerCase())fail('BILLING_WEBHOOK_INPUT_INVALID',400);
  const get=name=>typeof headers?.get==='function'?headers.get(name):headers?.[name];
  const signature=get('x-signature'),requestId=get('x-request-id');
  if(typeof signature!=='string'||signature.length>256||typeof requestId!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(requestId))fail('BILLING_WEBHOOK_SIGNATURE_REJECTED',401);
  const components=signature.split(',').map(part=>part.trim());
  if(components.length!==2)fail('BILLING_WEBHOOK_SIGNATURE_REJECTED',401);
  const values={};
  for(const part of components){const match=/^(ts|v1)=([a-fA-F0-9]+)$/.exec(part);if(!match||Object.hasOwn(values,match[1]))fail('BILLING_WEBHOOK_SIGNATURE_REJECTED',401);values[match[1]]=match[2];}
  if(! /^[1-9][0-9]{9}$/.test(values.ts||'')||! /^[a-fA-F0-9]{64}$/.test(values.v1||''))fail('BILLING_WEBHOOK_SIGNATURE_REJECTED',401);
  const timestamp=Number(values.ts)*1000,current=nowMs(now);
  if(!Number.isFinite(current)||Math.abs(current-timestamp)>maxAgeMs)fail('BILLING_WEBHOOK_TIMESTAMP_REJECTED',401);
  const canonicalId=dataIds[0].toLowerCase();
  const manifest=`id:${canonicalId};request-id:${requestId};ts:${values.ts};`;
  const expected=createHmac('sha256',secret).update(manifest).digest();
  if(!timingSafeEqual(expected,Buffer.from(values.v1,'hex')))fail('BILLING_WEBHOOK_SIGNATURE_REJECTED',401);
  const event=Object.freeze({provider:PROVIDER,notificationType:types[0],resourceId:canonicalId,requestId,signatureTimestamp:new Date(timestamp).toISOString(),replayKey:createHash('sha256').update(manifest).update(expected).digest('hex'),eventId:createHash('sha256').update(manifest).update(expected).digest('hex')});
  return event;
}
