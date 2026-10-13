import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac,randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createCompanySubscription} from '../src/lib/company-subscription-store.mjs';
import {createCompanySubscriptionProvider} from '../src/lib/company-subscription-provider.mjs';
import {companySubscriptionView} from '../src/app/(identity)/cuenta/company-subscription-view.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {subscriptionCommand} from '../src/lib/company-subscription-policy.mjs';
import {commercialTermsSha256,defaultCommercialCatalog,commercialAcceptanceId,commercialContractDigest,commercialCatalogDigest} from '../src/lib/company-subscription-catalog.mjs';
import {companySubscriptionRuntimeConfiguration,companyCommercialRuntimeCatalog} from '../src/lib/company-subscription-runtime-config.mjs';

const op='00000000-0000-4000-8000-000000000001',otherOp='00000000-0000-4000-8000-000000000002',cancelOp='00000000-0000-4000-8000-000000000003',scope='a'.repeat(64);
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const offer={id:'pro-monthly',plan:'PRO',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:'Impuestos incluidos',termsVersion:'terms-v1',includesAllIn:true,automaticExtras:false};
const config=()=>({version:1,provider:'MERCADO_PAGO',merchantId:'12345',accountMode:'LIVE',catalogVersion:'catalog-v1',offers:[{...offer}]});
const beginInput=(operationId=op)=>({scope,operationId,offerId:offer.id,catalogVersion:'catalog-v1',acceptanceReceiptId:'company_subscription_offer_acceptance_'+'a'.repeat(64),acceptanceDigest:'b'.repeat(64)});
const termsText='Condiciones exclusivamente sintéticas: un abono mensual por empresa, sin adicionales automáticos. Cancelación de renovación al final del período pagado.\n';
const completeCatalog=()=>({version:1,catalogVersion:'catalog-v1',offers:[{...offer,includedTerms:'WhatsApp, identidad e IA sólo en esta prueba sintética; sin cuota ni autorización real.',termsText,termsSha256:commercialTermsSha256(termsText)}]});
function fixture({commercialReady=true,factory=createCompanySubscription}={}){
  let clock=new Date('2026-10-12T12:00:00.000Z'),configured=true,allowed=true,tail=Promise.resolve(),createCalls=0,inspectCalls=0,cancelCalls=0,commercialRaw=commercialReady?completeCatalog():defaultCommercialCatalog();
  const transactions=new AsyncLocalStorage(),acceptanceOperations=new Map();
  const organizations=new Map(['company-a','company-b'].map(id=>[id,{id,name:'Synthetic '+id,metadata:{onboarding:{preserved:true}},subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date('2026-10-27T12:00:00.000Z')}])),logs=new Map();
  const member={actorId:'actor-a',membershipId:'member-a',organizationId:'company-a',role:'ADMIN'};
  let currentResource=null,providerHook=null,afterCreate=null,payerHook=null,failAttemptWrites=0,queryHook=null;
  async function query(sql,args=[]){
    await queryHook?.(sql,args);
    if(sql.includes('FROM public."PlatformUser"'))return {rows:[structuredClone(member)]};
    if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql)||sql.includes('pg_advisory_xact_lock'))return {rows:[]};
    if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(clock)}]};
    if(sql.includes('clock_timestamp() AS "observedAt"'))return {rows:organizations.has(args[0])?[{...structuredClone(organizations.get(args[0])),observedAt:new Date(clock)}]:[]};
    if(sql.startsWith('SELECT id FROM public."Organization"'))return {rows:organizations.has(args[0])&&!(sql.includes('COALESCE')&&organizations.get(args[0]).metadata.internal===true)?[{id:args[0]}]:[]};
    if(sql.startsWith('SELECT id,"entityId",metadata')){
      let rows=sql.includes('WHERE id=$1')?[logs.get(args[0])].filter(a=>a&&a.organizationId===args[1]&&a.action===args[2]):[...logs.values()].filter(a=>a.organizationId===args[0]&&a.action===args[1]&&(!sql.includes('"actorId"=$3')||a.actorId===args[2])).reverse();if(sql.endsWith('LIMIT 1'))rows=rows.slice(0,1);return {rows:structuredClone(rows)};
    }
    if(sql.startsWith('SELECT DISTINCT metadata'))return {rows:[...new Set([...logs.values()].filter(a=>a.action===args[0]&&a.metadata.catalogVersion===args[1]).map(a=>a.metadata.catalogDigest))].slice(0,2).map(catalogDigest=>({catalogDigest}))};
    if(sql.startsWith('SELECT id,"organizationId",metadata')&&args.length===1)return {rows:logs.has(args[0])?[structuredClone(logs.get(args[0]))]:[]};
    if(sql.startsWith('SELECT id,"organizationId"')){return {rows:[...logs.values()].filter(a=>a.action===args[0]&&a.metadata.provider===args[1]&&a.metadata.merchantId===args[2]&&a.metadata.accountMode===args[3]&&a.metadata.resourceId===args[4]&&(args[5]===undefined||a.id!==args[5])).map(a=>structuredClone(a))};}
    if(sql.startsWith('INSERT INTO public."AuditLog"')){
      if(sql.includes("'company.subscription.event'")){logs.set(args[0],{id:args[0],organizationId:null,entityId:null,action:'company.subscription.event',metadata:JSON.parse(args[1])});return {rows:[]};}
      const isAttempt=sql.includes("$4,'Organization'"),kind=isAttempt?args[3]:/action,.*VALUES/.test(sql)?(sql.match(/'company\.subscription\.[^']+'/)||[])[0]?.slice(1,-1):null;
      const row={id:args[0],organizationId:args[1],actorId:args[2],entityId:args[1],action:kind,metadata:JSON.parse(args[isAttempt?4:3])};if(!logs.has(row.id))logs.set(row.id,row);return {rows:[]};
    }
    if(sql.startsWith('UPDATE public."AuditLog"')){
      if(sql.includes('"organizationId"=$2')){const row=logs.get(args[0]);row.organizationId=args[1];row.entityId=args[1];row.metadata=JSON.parse(args[2]);return {rows:[]};}
      if(logs.get(args[0])?.action==='company.subscription.attempt'&&failAttemptWrites>0){failAttemptWrites--;throw new WorkspaceError('WORKSPACE_OPERATION_UNCONFIRMED',503);}
      logs.get(args[0]).metadata=JSON.parse(args[1]);return {rows:[]};
    }
    if(sql.startsWith('UPDATE public."Organization"')){
      const org=organizations.get(args[0]);if(sql.includes('"subscriptionPlan"=$2')){org.subscriptionPlan=args[1];org.subscriptionStatus='ACTIVE';org.metadata.companySubscription=JSON.parse(args[2]);}else if(sql.includes('"subscriptionStatus"=$2'))org.subscriptionStatus=args[1];else if(sql.includes('cancelAtPeriodEnd'))org.metadata.companySubscription.cancelAtPeriodEnd=true;return {rows:[]};
    }
    throw new Error('Unimplemented synthetic SQL: '+sql);
  }
  const client={query,release(){}};
  const workspace={async companyOperation(_session,context,writable,callback){
    if(!allowed)throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);if(context.scope!==scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
    let release;if(writable){const previous=tail;tail=new Promise(resolve=>{release=resolve;});await previous;}
    const beforeLogs=structuredClone(logs),beforeOrgs=structuredClone(organizations);
    try{return await transactions.run(true,()=>callback(client,member,scope));}catch(error){if(writable){logs.clear();for(const [key,value]of beforeLogs)logs.set(key,value);organizations.clear();for(const [key,value]of beforeOrgs)organizations.set(key,value);}throw error;}finally{release?.();}
  }};
  const raw=context=>({provider:'MERCADO_PAGO',merchantId:'12345',accountMode:'LIVE',organizationId:context.organizationId,attemptId:context.attemptId,offerId:context.offer.id,catalogVersion:context.offer.catalogVersion,amountMinor:context.offer.amountMinor,currency:context.offer.currency,periodUnit:'MONTH',periodCount:1,resourceId:'resource-a',status:'PENDING',observedAt:clock.toISOString(),periodStartsAt:null,periodEndsAt:null,cancelAtPeriodEnd:false,payment:null,checkoutUrl:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=resource-a'});
  const provider={readiness:()=>({available:true,provider:'MERCADO_PAGO',merchantId:'12345',accountMode:'LIVE',checkoutHost:'www.mercadopago.com.ar'}),async createCheckout(context){assert.notEqual(transactions.getStore(),true);assert.ok([...logs.values()].some(a=>a.metadata.id===context.attemptId));assert.equal(context.externalReference,context.attemptId);assert.equal(context.payerEmailVerified,true);createCalls++;if(providerHook)await providerHook(context,'create');await context.beforeExternal();currentResource=raw(context);await afterCreate?.();return structuredClone(currentResource);},async inspectSubscription(context){assert.notEqual(transactions.getStore(),true);inspectCalls++;if(providerHook)await providerHook(context,'inspect');await context.beforeExternal?.();return currentResource?{...structuredClone(currentResource),observedAt:clock.toISOString()}:{state:'UNKNOWN'};},async cancelAtPeriodEnd(context){assert.notEqual(transactions.getStore(),true);cancelCalls++;await context.beforeExternal();currentResource={...currentResource,status:'CANCELED',cancelAtPeriodEnd:true,payment:null,periodStartsAt:null,periodEndsAt:null,checkoutUrl:null,observedAt:clock.toISOString()};return structuredClone(currentResource);},isVerifiedEvent:()=>false};
  const verifiedPayer=async signed=>{await payerHook?.(signed);return {email:'synthetic@example.invalid',verified:true};};
  const make=actual=>factory({workspace,provider:actual,configuration:()=>configured?config():null,commercialCatalog:()=>commercialRaw,verifiedPayer,connect:async()=>client});
  const rawStore=make(provider);
  // Financial regression cases now pass through the actual commercial accept
  // method first. No termsVersion-only receipt or fake acceptance is seeded.
  const authorizeFinancialStore=actual=>({...actual,begin:async(signed,value)=>{
    subscriptionCommand(value,'begin');if(!configured)return actual.begin(signed,value);
    const view=await actual.read(signed,{scope:value.scope}),selected=view.commercial.offers.find(o=>o.id===offer.id);
    if(!acceptanceOperations.has(view.organization.id))acceptanceOperations.set(view.organization.id,randomUUID());
    const accepted=await actual.acceptOffer(signed,{scope:value.scope,operationId:acceptanceOperations.get(view.organization.id),offerId:selected.id,catalogVersion:view.commercial.catalogVersion,catalogDigest:view.commercial.catalogDigest,offerDigest:selected.offerDigest,termsVersion:selected.termsVersion,termsSha256:selected.termsSha256,accepted:true});
    return actual.begin(signed,{...value,acceptanceReceiptId:accepted.acceptance.receiptId,acceptanceDigest:accepted.acceptance.acceptanceDigest});
  }});
  const store=authorizeFinancialStore(rawStore);
  const paid=()=>{currentResource={...currentResource,status:'ACTIVE',periodStartsAt:'2026-10-12T10:00:00.000Z',periodEndsAt:'2026-11-12T10:00:00.000Z',payment:{id:'payment-a',status:'APPROVED',amountMinor:'14900',currency:'USD',paidAt:'2026-10-12T10:01:00.000Z',invoiceId:'invoice-a'},checkoutUrl:null};};
  const withProvider=actual=>authorizeFinancialStore(make(actual));
  return {store,rawStore,provider,logs,organizations,member,client,withProvider,queryHook:value=>{queryHook=value;},commercial:value=>{commercialRaw=value;},readCommercial:()=>commercialRaw,clock:value=>{clock=new Date(value);},configure:value=>{configured=value;},allow:value=>{allowed=value;},hook:value=>{providerHook=value;},payerHook:value=>{payerHook=value;},afterCreate:value=>{afterCreate=value;},paid,resource:()=>currentResource,setResource:value=>{currentResource=value;},failNextAttemptWrite:()=>{failAttemptWrites++;},calls:()=>({createCalls,inspectCalls,cancelCalls})};
}

test('default missing configuration hides offers and makes no charge or durable attempt',async()=>{
  const f=fixture();f.configure(false);const result=await f.store.read(session,{scope});assert.equal(result.configuration.state,'CONFIGURATION_PENDING');assert.deepEqual(result.configuration.offers,[]);
  await assert.rejects(f.store.begin(session,beginInput()),{code:'COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING'});assert.equal(f.logs.size,0);assert.deepEqual(f.calls(),{createCalls:0,inspectCalls:0,cancelCalls:0});
});
test('explicit recovery closes an undispatched UUID durably even while financial configuration is closed',async()=>{
  const f=fixture();f.configure(false);const before=structuredClone(f.organizations),closed=await f.store.recover(session,{scope,operationId:op});assert.equal(closed.attempt,null);assert.deepEqual(closed.recovery,{operationId:op,state:'NO_DISPATCH'});assert.deepEqual((await f.store.read(session,{scope,operationId:op})).recovery,closed.recovery);assert.equal((await f.store.read(session,{scope})).recovery,null);assert.deepEqual(f.organizations,before);assert.deepEqual(f.calls(),{createCalls:0,inspectCalls:0,cancelCalls:0});
  await f.store.recover(session,{scope,operationId:op});assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.operation.closed').length,1);f.configure(true);await assert.rejects(f.store.begin(session,beginInput()),{code:'COMPANY_SUBSCRIPTION_OPERATION_CLOSED'});assert.equal(f.calls().createCalls,0);assert.equal((await f.store.begin(session,beginInput(otherOp))).attempt.state,'CHECKOUT_READY');
});
test('reconciliation wins the company lock before a delayed begin and permanently prevents its external create',async()=>{
  const f=fixture();let releasePayer,entered;const waiting=new Promise(resolve=>{releasePayer=resolve;}),started=new Promise(resolve=>{entered=resolve;});f.payerHook(async()=>{entered();await waiting;});
  const delayed=f.store.begin(session,beginInput());await started;const closed=await f.store.recover(session,{scope,operationId:op});assert.equal(closed.recovery.state,'NO_DISPATCH');releasePayer();await assert.rejects(delayed,{code:'COMPANY_SUBSCRIPTION_OPERATION_CLOSED'});assert.equal(f.calls().createCalls,0);assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.attempt').length,0);
});
test('a dispatched reservation wins the race; reconciliation cannot close it or duplicate its provider create',async()=>{
  const f=fixture();let releaseCreate,entered;const waiting=new Promise(resolve=>{releaseCreate=resolve;}),started=new Promise(resolve=>{entered=resolve;});f.hook(async(_context,kind)=>{if(kind==='create'){entered();await waiting;}});
  const sending=f.store.begin(session,beginInput());await started;const pending=await f.store.recover(session,{scope,operationId:op});assert.equal(pending.recovery,null);assert.equal(pending.attempt.state,'UNKNOWN');assert.equal([...f.logs.values()].some(row=>row.action==='company.subscription.operation.closed'),false);releaseCreate();assert.equal((await sending).attempt.state,'CHECKOUT_READY');assert.equal(f.calls().createCalls,1);
});
test('NO_DISPATCH closure is company-specific and also rejects a delayed cancellation UUID',async()=>{
  const f=fixture(),created=await f.store.begin(session,beginInput());const closed=await f.store.recover(session,{scope,operationId:cancelOp});assert.equal(closed.recovery.operationId,cancelOp);await assert.rejects(f.store.cancelRenewal(session,{scope,operationId:cancelOp,subscriptionAttemptId:created.attempt.attemptId}),{code:'COMPANY_SUBSCRIPTION_OPERATION_CLOSED'});assert.equal(f.calls().cancelCalls,0);
  f.member.organizationId='company-b';assert.equal((await f.store.read(session,{scope,operationId:cancelOp})).recovery,null);assert.equal((await f.store.begin(session,beginInput(cancelOp))).attempt.state,'UNKNOWN');assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.attempt'&&row.organizationId==='company-b').length,1);
});
test('checkout persists reservation before network, never holds transaction and preserves exact trial',async()=>{
  const f=fixture(),trial=f.organizations.get('company-a').trialEndsAt.toISOString(),r=await f.store.begin(session,beginInput());assert.equal(r.attempt.state,'CHECKOUT_READY');assert.equal(r.subscription.status,'TRIALING');assert.equal(r.subscription.trialEndsAt,trial);assert.equal(f.calls().createCalls,1);assert.equal(JSON.stringify([...f.logs.values()]).includes('synthetic@example.invalid'),false);
  const replay=await f.store.begin(session,beginInput());assert.equal(replay.attempt.attemptId,r.attempt.attemptId);assert.equal(f.calls().createCalls,1);
  await assert.rejects(f.store.begin(session,beginInput(otherOp)),{code:'COMPANY_SUBSCRIPTION_ATTEMPT_ALREADY_ACTIVE'});
});
test('concurrent begins reserve one checkout and operation tampering does not change its contract',async()=>{
  const f=fixture(),results=await Promise.allSettled([f.store.begin(session,beginInput()),f.store.begin(session,beginInput(otherOp))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.calls().createCalls,1);
  const saved=[...f.logs.values()].find(a=>a.action==='company.subscription.attempt');await assert.rejects(f.store.begin(session,{...beginInput(saved.metadata.operationId),offerId:'enterprise-monthly'}),{code:'COMPANY_SUBSCRIPTION_OPERATION_CONFLICT'});
  for(const field of ['amountMinor','paid','merchantId','organizationId','payerEmail'])await assert.rejects(f.store.begin(session,{...beginInput(),[field]:'forged'}),{code:'COMPANY_SUBSCRIPTION_INPUT_INVALID'});
});
test('uncertain external creation remains reserved and neither begin nor recover repeats it',async()=>{
  const f=fixture();f.hook(()=>{throw Error('Private provider message');});const r=await f.store.begin(session,beginInput());assert.equal(r.attempt.state,'UNKNOWN');assert.equal(r.attempt.code,'COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED');assert.equal(JSON.stringify(r).includes('Private'),false);
  await f.store.begin(session,beginInput());await f.store.recover(session,{scope,operationId:op});await assert.rejects(f.store.begin(session,beginInput(otherOp)),{code:'COMPANY_SUBSCRIPTION_ATTEMPT_ALREADY_ACTIVE'});assert.equal(f.calls().createCalls,1);assert.equal(f.calls().inspectCalls,0);
});
test('current membership revoked directly before external creation prevents the POST and preserves reservation',async()=>{
  const f=fixture();f.hook(()=>f.allow(false));await assert.rejects(f.store.begin(session,beginInput()),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal(f.resource(),null);assert.equal([...f.logs.values()].find(a=>a.action==='company.subscription.attempt').metadata.state,'DISPATCHING');
  f.allow(true);const result=await f.store.recover(session,{scope,operationId:op});assert.equal(result.attempt.state,'UNKNOWN');assert.equal(f.calls().createCalls,1);
});
test('successful remote checkout followed by failed local finish retains fully bound resource for GET-only recovery',async()=>{
  const f=fixture();f.hook(()=>f.failNextAttemptWrite());const result=await f.store.begin(session,beginInput());assert.equal(result.attempt.state,'UNKNOWN');assert.equal([...f.logs.values()].find(a=>a.action==='company.subscription.attempt').metadata.resourceId,'resource-a');f.hook(null);
  const recovered=await f.store.recover(session,{scope,operationId:op});assert.equal(recovered.attempt.state,'CHECKOUT_READY');assert.equal(f.calls().createCalls,1);assert.equal(f.calls().inspectCalls,1);
});
test('membership revoked after the remote response retains its passive reference without granting access',async()=>{
  const f=fixture();f.afterCreate(()=>f.allow(false));await assert.rejects(f.store.begin(session,beginInput()),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});const saved=[...f.logs.values()].find(a=>a.action==='company.subscription.attempt');assert.equal(saved.metadata.resourceId,'resource-a');assert.equal(saved.metadata.state,'UNKNOWN');assert.equal(f.organizations.get('company-a').subscriptionStatus,'TRIALING');f.allow(true);assert.equal((await f.store.recover(session,{scope,operationId:op})).attempt.state,'CHECKOUT_READY');assert.equal(f.calls().createCalls,1);
});
test('authorization alone stays trial; fresh approved payment grants one durable covered period and duplicate observation is idempotent',async()=>{
  const f=fixture();await f.store.begin(session,beginInput());f.setResource({...f.resource(),status:'AUTHORIZED'});assert.equal((await f.store.recover(session,{scope,operationId:op})).subscription.status,'TRIALING');
  f.paid();const first=await f.store.recover(session,{scope,operationId:op});assert.equal(first.subscription.status,'ACTIVE');assert.equal(first.attempt.state,'ACTIVE');assert.match(first.attempt.receiptId,/^company_subscription_payment_/);assert.equal(first.subscription.trialEndsAt,'2026-10-27T12:00:00.000Z');
  const next=await f.store.recover(session,{scope,operationId:op});assert.equal(next.attempt.receiptId,first.attempt.receiptId);assert.equal([...f.logs.values()].filter(a=>a.action==='company.subscription.payment.verified').length,1);assert.deepEqual(f.organizations.get('company-a').metadata.onboarding,{preserved:true});assert.equal(f.organizations.get('company-b').subscriptionStatus,'TRIALING');
});
test('foreign merchant resource or amount cannot activate the company or claim financial proof',async()=>{
  for(const patch of [{merchantId:'foreign'},{organizationId:'company-b'},{accountMode:'TEST'},{amountMinor:'34900'},{resourceId:'foreign-resource'}]){
    const f=fixture();await f.store.begin(session,beginInput());f.paid();f.setResource({...f.resource(),...patch});const r=await f.store.recover(session,{scope,operationId:op});assert.equal(r.attempt.state,'UNKNOWN');assert.equal(r.subscription.status,'TRIALING');assert.equal(r.attempt.receiptId,null);
  }
});
test('stop renewal preserves purchased coverage, cancellation UUID recovers and exact expiry closes managed access',async()=>{
  const f=fixture();await f.store.begin(session,beginInput());f.paid();const paid=await f.store.recover(session,{scope,operationId:op});const result=await f.store.cancelRenewal(session,{scope,operationId:cancelOp,subscriptionAttemptId:paid.attempt.attemptId});assert.equal(result.attempt.state,'CANCEL_CONFIRMED');assert.equal(result.attempt.cancellation.operationId,cancelOp);assert.equal(result.attempt.cancellation.state,'CONFIRMED');assert.equal(result.subscription.status,'ACTIVE');assert.equal(result.subscription.entitlement.allowed,true);assert.deepEqual(result.attempt.paidPeriod,paid.attempt.paidPeriod);
  assert.equal((await f.store.read(session,{scope,operationId:cancelOp})).attempt.attemptId,paid.attempt.attemptId);await f.store.cancelRenewal(session,{scope,operationId:cancelOp,subscriptionAttemptId:paid.attempt.attemptId});assert.equal(f.calls().cancelCalls,1);
  f.clock('2026-11-12T10:00:00.000Z');const expired=await f.store.read(session,{scope});assert.equal(expired.subscription.entitlement.reasonCode,'COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED');assert.equal(expired.subscription.trialEndsAt,'2026-10-27T12:00:00.000Z');
});
test('current refunded resource revokes its exact receipt; a notification cannot be forged into system reconciliation',async()=>{
  const f=fixture();await f.store.begin(session,beginInput());f.paid();await f.store.recover(session,{scope,operationId:op});f.setResource({...f.resource(),payment:{...f.resource().payment,status:'REFUNDED'}});const refunded=await f.store.recover(session,{scope,operationId:op});assert.equal(refunded.subscription.status,'SUSPENDED');assert.equal(refunded.subscription.entitlement.allowed,false);await assert.rejects(f.store.processVerifiedEvent({signatureVerified:true,paid:true}),{code:'COMPANY_SUBSCRIPTION_EVENT_PROOF_REQUIRED'});
});
test('companyOperation requires both administrator roles, rejects office access and locks company without projects or lock upgrade',async()=>{
  for(const [role,clerkRole,office,allowed]of [['ADMIN','org:admin',false,true],['DIRECTOR','org:admin',false,false],['ADMIN','org:member',false,false],['ADMIN','org:admin',true,false]]){
    const signed={...session,organizationRole:clerkRole},member={actorId:'actor',membershipId:'member',organizationId:'company-a',role,officeReviewOnly:office},statements=[];
    const workspace=createWorkspaceStore({connect:async()=>({query:async(sql,args)=>{statements.push(sql);return {rows:sql.includes('FROM public."PlatformUser"')?[member]:sql.startsWith('SELECT id FROM public."Organization"')?[{id:args[0]}]:[]};},release(){}})});
    const task=workspace.companyOperation(signed,{scope:scopeStamp(signed,member)},true,()=>true);if(allowed)assert.equal(await task,true);else await assert.rejects(task);
    assert.equal(statements.some(sql=>/public\."(Project|Worker|Task)"/.test(sql)),false);if(allowed){assert.match(statements.find(sql=>sql.includes('FROM public."PlatformUser"')),/FOR SHARE OF u,m\s*$/);assert.match(statements.find(sql=>sql.startsWith('SELECT id FROM public."Organization"')),/FOR UPDATE$/);assert.ok(statements.includes('COMMIT'));}
  }
});

function adapterFixture(f,{beforeFetch}={}){
  const time=Date.parse('2026-10-12T12:00:00.000Z'),secret='synthetic-webhook-secret-123456',calls=[];let subscription=null,paymentStatus='approved',foreignMerchant=false,eventMode=false,makeInternalAtPayment=false,invoicesAvailable=true,readsFail=false;
  const invoice=()=>({id:9001,type:'scheduled',preapproval_id:'provider-sub-a',external_reference:subscription.external_reference,currency_id:'USD',transaction_amount:149,status:'processed',debit_date:'2026-10-12T10:00:00.000Z',payment:{id:7001,status:paymentStatus}});
  const provider=createCompanySubscriptionProvider({config:{accessToken:'synthetic-token-123456',merchantId:'12345',currency:'USD',accountMode:'LIVE',checkoutHost:'www.mercadopago.com.ar',backUrl:'https://obrasaas.com/cuenta',notificationUrl:'https://obrasaas.com/api/company-subscription/callback',webhookSecret:secret},now:()=>time,fetchImpl:async(url,options)=>{
    const path=new URL(url).pathname;calls.push({path,method:options.method});
    await beforeFetch?.(path,options);
    if(readsFail&&options.method==='GET')return Response.json({error:'synthetic temporary failure'},{status:503});
    if(path==='/users/me')return Response.json({id:12345,tags:[]});
    if(path==='/preapproval'&&options.method==='POST'){
      assert.ok([...f.logs.values()].some(row=>row.action==='company.subscription.attempt'));const body=JSON.parse(options.body);subscription={id:'provider-sub-a',collector_id:12345,external_reference:body.external_reference,status:'pending',auto_recurring:body.auto_recurring,init_point:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=provider-sub-a'};return Response.json(subscription);
    }
    if(path==='/preapproval/provider-sub-a')return Response.json({...subscription,collector_id:foreignMerchant?99999:12345});
    if(path==='/authorized_payments/9001'){if(eventMode)assert.ok([...f.logs.values()].some(row=>row.action==='company.subscription.event'));return Response.json(invoice());}
    if(path==='/authorized_payments/search')return Response.json({paging:{total:invoicesAvailable?1:0,offset:0,limit:20},results:invoicesAvailable?[invoice()]:[]});
    if(path==='/v1/payments/7001'){if(makeInternalAtPayment)f.organizations.get('company-a').metadata.internal=true;return Response.json({id:7001,collector_id:12345,external_reference:subscription.external_reference,live_mode:true,transaction_amount:149,currency_id:'USD',status:paymentStatus,date_approved:'2026-10-12T10:01:00.000Z',transaction_amount_refunded:paymentStatus==='refunded'?149:0,refunds:paymentStatus==='refunded'?[{id:'refund-a'}]:[]});}
    throw Error('Unexpected synthetic provider path '+path);
  }});
  function event(requestId='request-a',type='subscription_authorized_payment',resourceId='9001',wrong=false){
    eventMode=true;
    const timestamp=String(time/1000),manifest=`id:${resourceId};request-id:${requestId};ts:${timestamp};`,signature=createHmac('sha256',secret).update(manifest).digest('hex');
    return provider.verifyNotification({headers:new Headers({'x-request-id':requestId,'x-signature':`ts=${timestamp},v1=${wrong?'0'.repeat(64):signature}`}),url:`https://obrasaas.com/api/company-subscription/callback?data.id=${resourceId}&type=${type}`,body:{type,data:{id:resourceId}}});
  }
  return {provider,store:f.withProvider(provider),calls,event,authorize:()=>{subscription.status='authorized';},refund:()=>{paymentStatus='refunded';},foreign:()=>{foreignMerchant=true;},internalAtPayment:()=>{makeInternalAtPayment=true;},noInvoices:()=>{invoicesAvailable=false;},failReads:()=>{readsFail=true;}};
}
test('actual adapter signed notification reconciles current invoice and payment once; duplicate and unsigned type replay cause no additional GETs',async()=>{
  const f=fixture(),a=adapterFixture(f);await a.store.begin(session,beginInput());a.authorize();const event=a.event();const first=await a.store.processVerifiedEvent(event);assert.equal(first.state,'ACTIVE');assert.equal(f.organizations.get('company-a').subscriptionStatus,'ACTIVE');assert.equal(f.organizations.get('company-b').subscriptionStatus,'TRIALING');assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.payment.verified').length,1);
  const count=a.calls.length,duplicate=await a.store.processVerifiedEvent(a.event());assert.equal(duplicate.replayed,true);assert.equal(a.calls.length,count);
  await assert.rejects(a.store.processVerifiedEvent(a.event('request-a','payment')),{code:'COMPANY_SUBSCRIPTION_EVENT_REPLAY_CONFLICT'});assert.equal(a.calls.length,count);assert.throws(()=>a.event('bad-signature','subscription_authorized_payment','9001',true),{code:'BILLING_WEBHOOK_SIGNATURE_REJECTED'});
});
test('actual adapter current refund revokes exact paid receipt while foreign merchant resource cannot activate another company',async()=>{
  const f=fixture(),a=adapterFixture(f);await a.store.begin(session,beginInput());a.authorize();await a.store.processVerifiedEvent(a.event());a.refund();const refunded=await a.store.processVerifiedEvent(a.event('request-refund'));assert.equal(refunded.state,'AUTHORIZED');assert.equal(f.organizations.get('company-a').subscriptionStatus,'SUSPENDED');
  const g=fixture(),b=adapterFixture(g);await b.store.begin(session,beginInput());b.authorize();b.foreign();await assert.rejects(b.store.processVerifiedEvent(b.event()));assert.equal(g.organizations.get('company-a').subscriptionStatus,'TRIALING');assert.equal(g.organizations.get('company-b').subscriptionStatus,'TRIALING');
});
test('actual adapter recovers a missed webhook from the known subscription with only bounded current GETs',async()=>{
  const f=fixture(),a=adapterFixture(f);await a.store.begin(session,beginInput());a.authorize();const result=await a.store.recover(session,{scope,operationId:op});assert.equal(result.subscription.status,'ACTIVE');assert.match(result.attempt.receiptId,/^company_subscription_payment_/);assert.equal(a.calls.filter(call=>call.method==='POST').length,1);assert.equal(a.calls.some(call=>call.path==='/authorized_payments/search'),true);assert.equal(a.calls.some(call=>call.path==='/v1/payments/7001'),true);
});
test('actual authorized resource retaining provider init_point stays readable without exposing a second checkout link',async()=>{
  const f=fixture(),a=adapterFixture(f);await a.store.begin(session,beginInput());a.authorize();a.noInvoices();const result=await a.store.recover(session,{scope,operationId:op});assert.equal(result.attempt.state,'AUTHORIZED');assert.equal(result.attempt.checkoutUrl,null);assert.equal(result.subscription.status,'TRIALING');const view=companySubscriptionView(result,{scope});assert.equal(view.attempt.checkoutUrl,null);assert.equal(view.attempt.canCancel,true);assert.equal(view.attempt.paymentConfirmed,false);
});
test('actual adapter timeout after checkout ready hides its old private link and remains a valid recoverable public result',async()=>{
  const f=fixture(),a=adapterFixture(f),created=await a.store.begin(session,beginInput());assert.ok(created.attempt.checkoutUrl);a.failReads();const result=await a.store.recover(session,{scope,operationId:op});assert.equal(result.attempt.state,'UNKNOWN');assert.equal(result.attempt.checkoutUrl,null);assert.equal(companySubscriptionView(result,{scope}).attempt.state,'UNKNOWN');assert.equal([...f.logs.values()].find(row=>row.action==='company.subscription.attempt').metadata.checkoutUrl,created.attempt.checkoutUrl);assert.equal(a.calls.filter(call=>call.method==='POST').length,1);
});
test('system finish rechecks internal-company exclusion after the external financial observation',async()=>{
  const f=fixture(),a=adapterFixture(f);await a.store.begin(session,beginInput());a.authorize();a.internalAtPayment();await assert.rejects(a.store.processVerifiedEvent(a.event()),{code:'COMPANY_SUBSCRIPTION_EVENT_UNBOUND'});assert.equal(f.organizations.get('company-a').subscriptionStatus,'TRIALING');assert.equal([...f.logs.values()].some(row=>row.action==='company.subscription.payment.verified'),false);
});
test('immutable receipts and replay digests tolerate PostgreSQL JSONB key order',async()=>{
  const f=fixture();await f.store.begin(session,beginInput());f.paid();await f.store.recover(session,{scope,operationId:op});const receipt=[...f.logs.values()].find(row=>row.action==='company.subscription.payment.verified');receipt.metadata=Object.fromEntries(Object.entries(receipt.metadata).reverse());await f.store.recover(session,{scope,operationId:op});assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.payment.verified').length,1);
  await f.store.begin(session,Object.fromEntries(Object.entries(beginInput()).reverse()));assert.equal(f.calls().createCalls,1);
});
test('one provider resource cannot be adopted into a second company even with a matching synthetic response',async()=>{
  const f=fixture(),first=await f.store.begin(session,beginInput()),originalResource=structuredClone(f.resource());f.member.organizationId='company-b';const result=await f.store.begin(session,beginInput(otherOp));assert.equal(result.attempt.state,'UNKNOWN');assert.equal(result.attempt.code,'COMPANY_SUBSCRIPTION_RESOURCE_ALREADY_BOUND');assert.equal([...f.logs.values()].find(row=>row.action==='company.subscription.attempt'&&row.organizationId==='company-b').metadata.resourceId,null);assert.equal(f.organizations.get('company-a').subscriptionStatus,'TRIALING');assert.equal(f.organizations.get('company-b').subscriptionStatus,'TRIALING');
  f.member.organizationId='company-a';f.setResource(originalResource);const cancelled=await f.store.cancelRenewal(session,{scope,operationId:cancelOp,subscriptionAttemptId:first.attempt.attemptId});assert.equal(cancelled.attempt.state,'CANCELED');assert.equal(cancelled.attempt.cancelAtPeriodEnd,true);assert.equal(f.calls().cancelCalls,1);
});
test('successive current invoices extend coverage monotonically and an older invoice cannot shorten it',async()=>{
  const f=fixture();await f.store.begin(session,beginInput());f.paid();await f.store.recover(session,{scope,operationId:op});f.clock('2026-11-12T12:00:00.000Z');f.setResource({...f.resource(),periodStartsAt:'2026-11-12T10:00:00.000Z',periodEndsAt:'2026-12-12T10:00:00.000Z',payment:{...f.resource().payment,id:'payment-b',invoiceId:'invoice-b',paidAt:'2026-11-12T10:01:00.000Z'}});const latest=await f.store.recover(session,{scope,operationId:op});assert.equal(latest.attempt.paidPeriod.endsAt,'2026-12-12T10:00:00.000Z');
  f.setResource({...f.resource(),status:'AUTHORIZED',periodStartsAt:'2026-10-12T10:00:00.000Z',periodEndsAt:'2026-11-12T10:00:00.000Z',payment:{...f.resource().payment,id:'payment-a',invoiceId:'invoice-a',paidAt:'2026-10-12T10:01:00.000Z'}});const older=await f.store.recover(session,{scope,operationId:op});assert.equal(older.attempt.paidPeriod.endsAt,'2026-12-12T10:00:00.000Z');assert.equal(older.subscription.status,'ACTIVE');assert.equal(older.subscription.entitlement.allowed,true);assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.payment.verified').length,2);
});

const acceptanceOp='00000000-0000-4000-8000-000000000100';
async function acceptanceInput(f,operationId=acceptanceOp){const view=await f.rawStore.read(session,{scope}),selected=view.commercial.offers[0];return {scope,operationId,offerId:selected.id,catalogVersion:view.commercial.catalogVersion,catalogDigest:view.commercial.catalogDigest,offerDigest:selected.offerDigest,termsVersion:selected.termsVersion||'pending-terms',termsSha256:selected.termsSha256||'a'.repeat(64),accepted:true};}
const financialInput=accepted=>({...beginInput(),acceptanceReceiptId:accepted.acceptance.receiptId,acceptanceDigest:accepted.acceptance.acceptanceDigest});

function approvedRuntimeEnvironment(raw=completeCatalog(),financial=null){
 const environment={VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_68NErbCqCFsDVaMak81gcwsGI9pF',NEXT_PUBLIC_APP_URL:'https://obrasaas.com',OBRASAAS_COMPANY_COMMERCIAL_RELEASE:'company-commercial-v1',OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify(raw),OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:JSON.stringify({version:1,catalogDigest:commercialCatalogDigest(raw),approvalReference:'synthetic-approval:store-v1',fundingEvidenceReference:'synthetic-funding:store-v1'})};
 if(financial)Object.assign(environment,{OBRASAAS_COMPANY_SUBSCRIPTION_RELEASE:'company-subscription-v1',OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:JSON.stringify(financial),MERCADOPAGO_SUBSCRIPTION_MERCHANT_ID:financial.merchantId,MERCADOPAGO_SUBSCRIPTION_CURRENCY:financial.offers[0].currency,MERCADOPAGO_SUBSCRIPTION_CHECKOUT_HOST:'www.mercadopago.com.ar',MERCADOPAGO_ACCESS_TOKEN:'synthetic-runtime-token-123456',MERCADOPAGO_SUBSCRIPTION_WEBHOOK_SECRET:'synthetic-runtime-secret-123456'});
 return environment;
}
function actualRuntime(f,environment,{source=readFileSync(new URL('../src/lib/company-subscription-runtime.mjs',import.meta.url),'utf8'),provider=null}={}){
 // Execute the actual composition body, with no real process.env, Clerk,
 // network or DB. The store and canonical workspace transaction code are real.
 const body=source.replace(/^import [^\r\n]+;\r?$/gm,'').replace(/^export /gm,'');assert.doesNotMatch(body,/^\s*import\b/m);
 const counts={membership:0,email:0,http:0},workspace=createWorkspaceStore({connect:async()=>f.client});
 const result=runInNewContext(body+'\n({store:productionCompanySubscription,provider:productionCompanySubscriptionProvider})',{
  process:Object.freeze({env:Object.freeze({...environment})}),clerkClient:()=>{throw new Error('No real Clerk in runtime integration');},WorkspaceError,
  connectWorkspace:async()=>f.client,productionWorkspace:workspace,createCompanySubscription,
  createCompanySubscriptionProvider:provider?()=>provider:options=>createCompanySubscriptionProvider({...options,fetchImpl:async()=>{counts.http++;throw new Error('No external provider in runtime integration');}}),
  companySubscriptionRuntimeConfiguration,companyCommercialRuntimeCatalog,
  createParticipantIdentityProvider:()=>({async verifyMembership(){counts.membership++;return {role:'org:admin'};},async verifiedEmail(){counts.email++;return 'synthetic@example.invalid';}})
 });
 return {...result,counts,scope:scopeStamp(session,f.member)};
}
async function runtimeAcceptance(runtime,operationId=acceptanceOp){
 const view=await runtime.store.read(session,{scope:runtime.scope}),selected=view.commercial.offers[0];
 return runtime.store.acceptOffer(session,{scope:runtime.scope,operationId,offerId:selected.id,catalogVersion:view.commercial.catalogVersion,catalogDigest:view.commercial.catalogDigest,offerDigest:selected.offerDigest,termsVersion:selected.termsVersion,termsSha256:selected.termsSha256,accepted:true});
}

test('actual runtime mounts approved loader into canonical acceptance while provider and financial grant remain closed',async()=>{
 const f=fixture(),before=structuredClone(f.organizations),runtime=actualRuntime(f,approvedRuntimeEnvironment()),view=await runtime.store.read(session,{scope:runtime.scope});
 assert.equal(runtime.provider.readiness().available,false);assert.equal(view.configuration.state,'CONFIGURATION_PENDING');assert.equal(view.commercial.state,'READY');assert.equal(view.commercial.offers[0].canAccept,true);assert.equal(view.commercial.offers[0].checkoutAvailable,false);
 const accepted=await runtimeAcceptance(runtime),replay=await runtimeAcceptance(runtime);assert.deepEqual(replay.acceptance,accepted.acceptance);assert.equal(accepted.acceptance.current,true);assert.equal(accepted.acceptance.canCheckout,false);assert.equal(accepted.acceptance.offer.termsText,termsText);
 assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.offer.accepted').length,1);assert.deepEqual(f.organizations,before);
 await assert.rejects(runtime.store.begin(session,{...financialInput(accepted),scope:runtime.scope}),{code:'COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING'});
 assert.deepEqual(runtime.counts,{membership:0,email:0,http:0});assert.deepEqual(f.calls(),{createCalls:0,inspectCalls:0,cancelCalls:0});assert.equal([...f.logs.values()].some(row=>row.action==='company.subscription.attempt'),false);
});

test('removing the real runtime loader call causally loses approved acceptance rather than making the helper sufficient',async()=>{
 const source=readFileSync(new URL('../src/lib/company-subscription-runtime.mjs',import.meta.url),'utf8'),call='const commercialCatalog=companyCommercialRuntimeCatalog(process.env);';assert.equal(source.split(call).length,2);
 const f=fixture(),runtime=actualRuntime(f,approvedRuntimeEnvironment(),{source:source.replace(call,'const commercialCatalog=companyCommercialRuntimeCatalog({});')}),view=await runtime.store.read(session,{scope:runtime.scope});
 assert.equal(companyCommercialRuntimeCatalog(approvedRuntimeEnvironment()).offers[0].termsText,termsText,'The actual helper alone remains approved');assert.equal(view.commercial.state,'TERMS_PENDING');assert.ok(view.commercial.offers.every(offer=>!offer.canAccept&&!offer.checkoutAvailable));
 await assert.rejects(runtime.store.acceptOffer(session,{scope:runtime.scope,operationId:acceptanceOp,offerId:view.commercial.offers[0].id,catalogVersion:view.commercial.catalogVersion,catalogDigest:view.commercial.catalogDigest,offerDigest:view.commercial.offers[0].offerDigest,termsVersion:'pending-terms',termsSha256:'a'.repeat(64),accepted:true}),{code:'COMPANY_SUBSCRIPTION_TERMS_PENDING'});
 assert.equal(f.logs.size,0);assert.deepEqual(runtime.counts,{membership:0,email:0,http:0});
});

test('approved commercial runtime cannot checkout against a different independently configured financial contract',async()=>{
 const f=fixture(),financial=config();financial.offers[0].termsVersion='different-financial-terms';const before=structuredClone(f.organizations),runtime=actualRuntime(f,approvedRuntimeEnvironment(completeCatalog(),financial));
 assert.equal(runtime.provider.readiness().available,true);const accepted=await runtimeAcceptance(runtime);assert.equal(accepted.acceptance.current,true);assert.equal(accepted.acceptance.canCheckout,false);
 await assert.rejects(runtime.store.begin(session,{...financialInput(accepted),scope:runtime.scope}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});
 assert.deepEqual(runtime.counts,{membership:0,email:0,http:0});assert.deepEqual(f.organizations,before);assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.offer.accepted').length,1);assert.equal([...f.logs.values()].some(row=>row.action==='company.subscription.attempt'),false);
});

test('new runtime with closed commercial approval recovers and cancels a previous receipt-bound financial attempt',async()=>{
 const f=fixture(),environment=approvedRuntimeEnvironment(completeCatalog(),config()),first=actualRuntime(f,environment,{provider:f.provider}),accepted=await runtimeAcceptance(first),started=await first.store.begin(session,{...financialInput(accepted),scope:first.scope});
 assert.equal(started.attempt.state,'CHECKOUT_READY');const receiptBefore=structuredClone([...f.logs.values()].find(row=>row.action==='company.subscription.offer.accepted'));
 const closedEnvironment={...environment,OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:undefined};assert.deepEqual(companySubscriptionRuntimeConfiguration(closedEnvironment),companySubscriptionRuntimeConfiguration(environment));
 const fresh=actualRuntime(f,closedEnvironment,{provider:f.provider}),view=await fresh.store.read(session,{scope:fresh.scope,acceptanceOperationId:acceptanceOp});assert.equal(view.commercial.state,'TERMS_PENDING');assert.equal(view.acceptance.current,false);assert.equal(view.acceptance.canCheckout,false);assert.equal(view.attempt.attemptId,started.attempt.attemptId);
 await assert.rejects(fresh.store.begin(session,{...financialInput(accepted),scope:fresh.scope}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});f.paid();
 const recovered=await fresh.store.recover(session,{scope:fresh.scope,operationId:op});assert.equal(recovered.subscription.status,'ACTIVE');assert.equal(recovered.attempt.state,'ACTIVE');assert.equal(recovered.acceptance.current,false);assert.equal(recovered.acceptance.offer.termsText,termsText);
 const canceled=await fresh.store.cancelAtPeriodEnd(session,{scope:fresh.scope,operationId:cancelOp,subscriptionAttemptId:started.attempt.attemptId});assert.equal(canceled.attempt.cancelAtPeriodEnd,true);assert.equal(canceled.subscription.entitlement.allowed,true);
 assert.deepEqual([...f.logs.values()].find(row=>row.action==='company.subscription.offer.accepted'),receiptBefore);assert.equal(f.calls().createCalls,1);assert.equal(f.calls().inspectCalls,1);assert.equal(f.calls().cancelCalls,1);assert.deepEqual(fresh.counts,{membership:0,email:0,http:0});
});

test('default pending commercial catalog exposes selected prices without merchant writes or executable terms',async()=>{
 const f=fixture({commercialReady:false});f.configure(false);const before=structuredClone(f.organizations),view=await f.rawStore.read(session,{scope});assert.equal(view.version,2);assert.equal(view.commercial.state,'TERMS_PENDING');assert.deepEqual(view.commercial.offers.map(o=>o.amountMinor),['14900','34900']);assert.ok(view.commercial.offers.every(o=>!o.canAccept&&!o.checkoutAvailable));assert.equal(view.acceptance,null);
 await assert.rejects(f.rawStore.acceptOffer(session,await acceptanceInput(f)),{code:'COMPANY_SUBSCRIPTION_TERMS_PENDING'});assert.equal(f.logs.size,0);assert.deepEqual(f.organizations,before);assert.deepEqual(f.calls(),{createCalls:0,inspectCalls:0,cancelCalls:0});
});

test('actual acceptance is append only full server terms and SQL clock while financial configuration remains closed',async()=>{
 const f=fixture();f.configure(false);const before=structuredClone(f.organizations),input=await acceptanceInput(f),results=await Promise.all([f.rawStore.acceptOffer(session,input),f.rawStore.acceptOffer(session,input)]),accepted=results[0].acceptance;
 assert.deepEqual(results[0],results[1]);assert.equal(accepted.receiptId,commercialAcceptanceId('company-a',acceptanceOp));assert.equal(accepted.state,'TERMS_ACCEPTED');assert.equal(accepted.acceptedAt,'2026-10-12T12:00:00.000Z');assert.equal(accepted.offer.termsText,termsText);assert.equal(accepted.offer.termsSha256,commercialTermsSha256(termsText));assert.equal(accepted.current,true);assert.equal(accepted.canCheckout,false);assert.equal(f.logs.size,1);assert.deepEqual(f.organizations,before);
 const record=[...f.logs.values()][0];assert.equal(record.action,'company.subscription.offer.accepted');assert.equal(record.metadata.authority.actorId,'actor-a');assert.equal(record.metadata.authority.membershipId,'member-a');assert.equal(record.metadata.authority.clerkUserId,session.userId);assert.equal(Object.hasOwn(accepted,'authority'),false);assert.equal(Object.hasOwn(accepted.offer,'canAccept'),false);assert.deepEqual(f.calls(),{createCalls:0,inspectCalls:0,cancelCalls:0});
 assert.deepEqual((await f.rawStore.read(session,{scope,acceptanceOperationId:acceptanceOp})).acceptance,accepted);
});

test('commercial acceptance preserves manual registered entitlement and expired trial without inventing a financial grant',async()=>{
 for(const patch of [{subscriptionPlan:'PRO',subscriptionStatus:'ACTIVE',trialEndsAt:null},{subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date('2026-10-01T00:00:00.000Z')}]){const f=fixture();f.configure(false);Object.assign(f.organizations.get('company-a'),patch);const before=structuredClone(f.organizations),prior=await f.rawStore.read(session,{scope}),accepted=await f.rawStore.acceptOffer(session,await acceptanceInput(f));assert.deepEqual(accepted.subscription,prior.subscription);assert.deepEqual(f.organizations,before);assert.equal(Object.hasOwn(f.organizations.get('company-a').metadata,'companySubscription'),false);assert.ok([...f.logs.values()].every(row=>row.action==='company.subscription.offer.accepted'));assert.deepEqual(f.calls(),{createCalls:0,inspectCalls:0,cancelCalls:0});}
});

test('absent acceptance reference stays unconfirmed and cannot create a financial closure or replay under a new UUID',async()=>{
 const f=fixture(),before=structuredClone(f.organizations),absent=await f.rawStore.read(session,{scope,acceptanceOperationId:acceptanceOp});assert.equal(absent.acceptance,null);assert.equal(absent.attempt,null);assert.equal(absent.recovery,null);assert.equal(f.logs.size,0);assert.deepEqual(f.organizations,before);
 const input=await acceptanceInput(f),accepted=await f.rawStore.acceptOffer(session,input);assert.equal((await f.rawStore.acceptOffer(session,input)).acceptance.receiptId,accepted.acceptance.receiptId);assert.equal(f.logs.size,1);
 await assert.rejects(f.rawStore.read(session,{scope,operationId:op,acceptanceOperationId:acceptanceOp}),{code:'COMPANY_SUBSCRIPTION_INPUT_INVALID'});
});

test('acceptance rejects browser terms substitution stale catalog and authority borrowing without a write',async()=>{
 for(const patch of [{catalogDigest:'a'.repeat(64)},{offerDigest:'b'.repeat(64)},{termsVersion:'different-terms'},{termsSha256:'c'.repeat(64)},{accepted:false},{amountMinor:'1'},{taxTreatment:'Browser tax'}]){const f=fixture(),input=await acceptanceInput(f);await assert.rejects(f.rawStore.acceptOffer(session,{...input,...patch}));assert.equal(f.logs.size,0);assert.equal(f.calls().createCalls,0);}
 const f=fixture(),input=await acceptanceInput(f),accepted=await f.rawStore.acceptOffer(session,input);await assert.rejects(f.rawStore.acceptOffer(session,{...input,termsSha256:'d'.repeat(64)}),{code:'COMPANY_SUBSCRIPTION_OPERATION_CONFLICT'});f.member.actorId='actor-other';f.member.membershipId='member-other';await assert.rejects(f.rawStore.acceptOffer(session,input),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED'});await assert.rejects(f.rawStore.begin(session,financialInput(accepted)),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED'});assert.equal(f.logs.size,1);assert.equal(f.calls().createCalls,0);
});

test('a reused catalog version cannot rewrite accepted terms while original receipt remains readable without checkout',async()=>{
 const f=fixture(),input=await acceptanceInput(f),accepted=await f.rawStore.acceptOffer(session,input),snapshot=structuredClone([...f.logs.values()][0]),changed=completeCatalog();changed.offers[0].termsText+='Una condición distinta.\n';changed.offers[0].termsSha256=commercialTermsSha256(changed.offers[0].termsText);f.commercial(changed);
 const old=await f.rawStore.read(session,{scope,acceptanceOperationId:acceptanceOp});assert.equal(old.acceptance.current,false);assert.equal(old.acceptance.canCheckout,false);assert.equal(old.acceptance.offer.termsText,termsText);assert.deepEqual([...f.logs.values()][0],snapshot);assert.deepEqual((await f.rawStore.acceptOffer(session,input)).acceptance,old.acceptance);
 await assert.rejects(f.rawStore.acceptOffer(session,await acceptanceInput(f,otherOp)),{code:'COMPANY_SUBSCRIPTION_CATALOG_CHANGED'});await assert.rejects(f.rawStore.begin(session,financialInput(accepted)),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});assert.equal(f.calls().createCalls,0);
});

test('checkout requires the actual own current immutable acceptance and a distinct financial UUID before payer IO',async()=>{
 const f=fixture();let payerReads=0;f.payerHook(()=>{payerReads++;});await assert.rejects(f.rawStore.begin(session,beginInput()),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_REQUIRED'});assert.equal(payerReads,0);assert.equal(f.logs.size,0);
 const accepted=await f.rawStore.acceptOffer(session,await acceptanceInput(f)),input=financialInput(accepted);await assert.rejects(f.rawStore.begin(session,{...input,operationId:acceptanceOp}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});await assert.rejects(f.rawStore.begin(session,{...input,acceptanceDigest:'e'.repeat(64)}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});assert.equal(payerReads,0);
 const started=await f.rawStore.begin(session,input);assert.equal(started.attempt.state,'CHECKOUT_READY');assert.equal(f.calls().createCalls,1);const metadata=[...f.logs.values()].find(x=>x.action==='company.subscription.attempt').metadata;assert.equal(metadata.version,2);assert.equal(metadata.acceptanceReceiptId,accepted.acceptance.receiptId);assert.equal(metadata.acceptanceDigest,accepted.acceptance.acceptanceDigest);assert.equal(f.organizations.get('company-a').subscriptionStatus,'TRIALING');
});

test('acceptance reply and separate recovery preserve an existing durable financial attempt without repeating its provider call',async()=>{
 const f=fixture(),input=await acceptanceInput(f),accepted=await f.rawStore.acceptOffer(session,input),started=await f.rawStore.begin(session,financialInput(accepted)),postCount=f.calls().createCalls;
 for(const value of [await f.rawStore.acceptOffer(session,input),await f.rawStore.read(session,{scope,acceptanceOperationId:acceptanceOp})]){assert.equal(value.attempt.attemptId,started.attempt.attemptId);assert.equal(value.attempt.state,'CHECKOUT_READY');assert.equal(value.acceptance.operationId,acceptanceOp);assert.equal(value.recovery,null);}assert.equal(f.calls().createCalls,postCount);
});

test('stored acceptance tampering fails closed and recovery cancellation remain bound to the original terms',async()=>{
 for(const field of ['termsText','authority','requestDigest']){const f=fixture();await f.rawStore.acceptOffer(session,await acceptanceInput(f));const a=[...f.logs.values()][0].metadata;if(field==='termsText')a.offer.termsText+='changed';else if(field==='authority')a.authority.clerkUserId='user_Foreign';else a.requestDigest='f'.repeat(64);await assert.rejects(f.rawStore.read(session,{scope,acceptanceOperationId:acceptanceOp}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_INTEGRITY'});}
 const f=fixture(),accepted=await f.rawStore.acceptOffer(session,await acceptanceInput(f)),started=await f.rawStore.begin(session,financialInput(accepted));const changed=completeCatalog();changed.catalogVersion='catalog-v2';changed.offers[0].termsText+='Nueva versión.\n';changed.offers[0].termsSha256=commercialTermsSha256(changed.offers[0].termsText);f.commercial(changed);f.paid();const recovered=await f.rawStore.recover(session,{scope,operationId:op});assert.equal(recovered.subscription.status,'ACTIVE');assert.equal(recovered.acceptance.current,false);assert.equal((await f.rawStore.cancelAtPeriodEnd(session,{scope,operationId:cancelOp,subscriptionAttemptId:started.attempt.attemptId})).attempt.cancelAtPeriodEnd,true);assert.equal(f.calls().createCalls,1);
});

async function mutantFactory(needle,replacement){const file=new URL('../src/lib/company-subscription-store.mjs',import.meta.url),source=readFileSync(file,'utf8');assert.equal(source.split(needle).length,2);const changed=source.replace(needle,replacement).replace(/from '(\.[^']+)'/g,(_match,ref)=>`from '${new URL(ref,file).href}'`);return (await import('data:text/javascript;base64,'+Buffer.from(changed).toString('base64'))).createCompanySubscription;}

test('removing the exact terms SHA acknowledgement guard causally commits a mismatched user acknowledgement',async()=>{
 const wrong=await mutantFactory('||command.termsSha256!==offer.termsSha256',''),bad='1'.repeat(64);const actual=fixture(),realInput=await acceptanceInput(actual);await assert.rejects(actual.rawStore.acceptOffer(session,{...realInput,termsSha256:bad}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});assert.equal(actual.logs.size,0);
 const mutant=fixture({factory:wrong}),input=await acceptanceInput(mutant),result=await mutant.rawStore.acceptOffer(session,{...input,termsSha256:bad});assert.equal(result.acceptance.state,'TERMS_ACCEPTED');assert.equal(mutant.logs.size,1);await assert.rejects(mutant.rawStore.read(session,{scope,acceptanceOperationId:acceptanceOp}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_INTEGRITY'});
});

test('removing preflight current-catalog matching causally permits payer IO and reserves unaccepted terms while final CREATE remains fenced',async()=>{
 const wrong=await mutantFactory('||!acceptedCurrent(a,catalog,binding)','');for(const [factory,unsafe] of [[createCompanySubscription,false],[wrong,true]]){
  const f=fixture({factory}),accepted=await f.rawStore.acceptOffer(session,await acceptanceInput(f)),changed=completeCatalog();let payerReads=0;f.payerHook(()=>{payerReads++;});changed.offers[0].includedTerms+='Una inclusión distinta.';f.commercial(changed);
  if(unsafe){const result=await f.rawStore.begin(session,financialInput(accepted));assert.equal(result.attempt.state,'UNKNOWN');assert.equal(result.attempt.code,'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED');}
  else await assert.rejects(f.rawStore.begin(session,financialInput(accepted)),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});
  assert.equal(payerReads,unsafe?1:0,'Removing only the actual preflight guard crosses payer IO before current acceptance');assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.attempt').length,unsafe?1:0);
  assert.equal(f.calls().createCalls,0,'Independent post-COMMIT fence still prevents external creation');assert.equal(f.resource(),null);
 }
});

test('final CREATE fence observes full terms changed during acceptance SQL without sending an external POST',async()=>{
  const f=fixture(),before=structuredClone(f.organizations),changed=completeCatalog();let acceptanceReads=0,changedDuringAwait=false;
  changed.offers[0].termsText+='Distinct approved full terms after reservation.\n';changed.offers[0].termsSha256=commercialTermsSha256(changed.offers[0].termsText);
  const a=adapterFixture(f,{beforeFetch(path){if(path==='/users/me')f.queryHook(async(sql,args)=>{
   if(sql.startsWith('SELECT id,"entityId",metadata')&&sql.includes('WHERE id=$1')&&args[2]==='company.subscription.offer.accepted'&&++acceptanceReads===2){await Promise.resolve();f.commercial(changed);changedDuringAwait=true;}
  });}});
  const result=await a.store.begin(session,beginInput()),externalCreates=a.calls.filter(call=>call.path==='/preapproval'&&call.method==='POST');
  assert.equal(changedDuringAwait,true,'Probe must alter only the final receipt SQL wait after account verification');assert.equal(a.calls.filter(call=>call.path==='/users/me').length,1);
  assert.equal(externalCreates.length,0,'Count actual adapter fetch dispatches, not calls into createCheckout');
  assert.equal(result.attempt.state,'UNKNOWN');assert.equal(result.acceptance.current,false);assert.deepEqual(f.organizations,before);
  const attempt=[...f.logs.values()].find(row=>row.action==='company.subscription.attempt').metadata;
  assert.equal(attempt.resourceId,null);assert.equal(attempt.code,'COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED','Existing real adapter masks an unconfirmed CREATE result; zero actual POSTs proves the fence');
  assert.equal([...f.logs.values()].filter(row=>row.action==='company.subscription.offer.accepted').length,1);
});

test('removing the post-COMMIT commercial fence causally dispatches CREATE with newly changed unaccepted terms',async()=>{
 const guard="if(!acceptedCurrent(acceptanceFence.accepted,catalog,acceptanceFence.binding)||!financialOfferMatches(acceptanceFence.accepted.offer,catalog))fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED');";
 const wrong=await mutantFactory(guard,'void catalog;');
 for(const [factory,unsafe] of [[createCompanySubscription,false],[wrong,true]]){
  const f=fixture(),before=structuredClone(f.organizations),changed=completeCatalog();let changedDuringCommit=false,acceptanceReads=0;
  changed.offers[0].termsText+='Distinct approved full terms during final COMMIT.\n';changed.offers[0].termsSha256=commercialTermsSha256(changed.offers[0].termsText);
  const a=adapterFixture(f,{beforeFetch(path){if(path==='/users/me')f.queryHook(async(sql,args)=>{
   if(sql.startsWith('SELECT id,"entityId",metadata')&&sql.includes('WHERE id=$1')&&args[2]==='company.subscription.offer.accepted')acceptanceReads++;
   if(sql==='COMMIT'&&!changedDuringCommit){assert.equal(acceptanceReads,2,'Both receipt SQL guards precede the final COMMIT');await Promise.resolve();f.commercial(changed);changedDuringCommit=true;}
  });}});
  const canonicalScope=scopeStamp(session,f.member),store=factory({workspace:createWorkspaceStore({connect:async()=>f.client}),provider:a.provider,configuration:config,commercialCatalog:f.readCommercial,verifiedPayer:async()=>({email:'synthetic@example.invalid',verified:true})});
  const observed=await store.read(session,{scope:canonicalScope}),offer=observed.commercial.offers[0],accepted=await store.acceptOffer(session,{scope:canonicalScope,operationId:acceptanceOp,offerId:offer.id,catalogVersion:observed.commercial.catalogVersion,catalogDigest:observed.commercial.catalogDigest,offerDigest:offer.offerDigest,termsVersion:offer.termsVersion,termsSha256:offer.termsSha256,accepted:true});
  const result=await store.begin(session,{...financialInput(accepted),scope:canonicalScope});
  assert.equal(changedDuringCommit,true);assert.equal(a.calls.filter(call=>call.path==='/users/me').length,1);assert.equal(a.calls.filter(call=>call.path==='/preapproval'&&call.method==='POST').length,unsafe?1:0,'Only removal of the actual post-COMMIT guard admits an external CREATE');
  assert.equal(result.attempt.state,unsafe?'CHECKOUT_READY':'UNKNOWN');assert.equal(result.acceptance.current,false);assert.deepEqual(f.organizations,before);
  const attempt=[...f.logs.values()].find(row=>row.action==='company.subscription.attempt').metadata;assert.equal(attempt.resourceId,unsafe?'provider-sub-a':null);assert.equal(attempt.lease,null);
  const postCount=a.calls.filter(call=>call.method==='POST').length;await assert.rejects(store.begin(session,{...financialInput(accepted),scope:canonicalScope}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});assert.equal(a.calls.filter(call=>call.method==='POST').length,postCount,'Explicit same-operation replay cannot dispatch again');
 }
});
