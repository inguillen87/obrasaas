import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,Pool} from 'pg';
import {WorkspaceError,scopeStamp} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createCompanySubscription} from '../src/lib/company-subscription-store.mjs';
import {createCompanySubscriptionProvider} from '../src/lib/company-subscription-provider.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';

// The entire financial transport is synthetic. Only this explicitly marked
// local PostgreSQL fixture may be contacted, created or dropped by the harness.
export function companySubscriptionDisposableUrl(environment={}){
  let url;try{url=new URL(environment.CUTOVER_TEST_DATABASE_URL);}catch{throw new WorkspaceError('COMPANY_SUBSCRIPTION_DISPOSABLE_TARGET_REJECTED');}
  if(environment.CUTOVER_TEST_DISPOSABLE!=='1'||environment.VERCEL||environment.VERCEL_ENV||environment.VERCEL_TARGET_ENV||!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname)||!['5432','6549'].includes(url.port)||url.username!=='cutover_test'||url.pathname!=='/obrasaas_cutover_ci'||url.search||url.hash||(url.port==='6549'?url.password!=='':!['','cutover_test'].includes(url.password)))throw new WorkspaceError('COMPANY_SUBSCRIPTION_DISPOSABLE_TARGET_REJECTED');
  return url;
}
const monthLater=value=>{const date=new Date(value),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return date.toISOString();};
const offer={id:'pro-monthly',plan:'PRO',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:'Synthetic final amount',termsVersion:'synthetic-terms-v1',includesAllIn:true,automaticExtras:false};
const catalog={version:1,provider:'MERCADO_PAGO',merchantId:'900001',accountMode:'LIVE',catalogVersion:'synthetic-catalog-v1',offers:[offer]};
const secret='synthetic-subscription-webhook-secret-only';
const providerConfig={accessToken:'synthetic-subscription-token-only',merchantId:catalog.merchantId,accountMode:'LIVE',currency:'USD',checkoutHost:'www.mercadopago.com.ar',backUrl:'https://example.invalid/billing',notificationUrl:'https://example.invalid/notifications',webhookSecret:secret};

export async function verifyCompanySubscriptionPostgres(environment=process.env){
  const target=companySubscriptionDisposableUrl(environment);
  const database='obrasaas_subscription_'+randomUUID().replaceAll('-','');
  assert.match(database,/^obrasaas_subscription_[a-f0-9]{32}$/);
  const admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000});
  const checks=[],statements=[],calls=[],subscriptions=new Map(),invoices=new Map(),payments=new Map();
  const originalFetch=globalThis.fetch;let uncontrolledHttp=0,created=false,removed=false,pool,sequence=10000,uncertainPost=false,reuseSubscription=null,revokeOnAccount=null,paymentReferenceOverride=null,companyLockObserver=null;
  let time=Date.now();
  // A deterministic disposable SQL clock allows sequential monthly periods
  // and exact expiry without changing native PostgreSQL transaction/lock rules.
  const sqlInFixture=sql=>sql.replaceAll('clock_timestamp()','public.fixture_clock_timestamp()');
  globalThis.fetch=async()=>{uncontrolledHttp++;throw new Error('COMPANY_SUBSCRIPTION_UNCONTROLLED_HTTP_REJECTED');};
  try{
    await admin.connect();assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,'obrasaas_cutover_ci');
    await admin.query(`CREATE DATABASE "${database}"`);created=true;const fixtureUrl=new URL(target);fixtureUrl.pathname='/'+database;
    pool=trackDisposablePool(new Pool({connectionString:fixtureUrl.toString(),max:12,connectionTimeoutMillis:5000}));
    await pool.query(`CREATE TYPE "SubscriptionPlan" AS ENUM('TRIAL','PRO','ENTERPRISE');CREATE TYPE "SubscriptionStatus" AS ENUM('TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED');
      CREATE TABLE fixture_clock(id integer PRIMARY KEY CHECK(id=1),now timestamptz NOT NULL);
      CREATE FUNCTION fixture_clock_timestamp() RETURNS timestamptz LANGUAGE sql STABLE AS 'SELECT now FROM public.fixture_clock WHERE id=1';
      CREATE TABLE "Organization"(id text PRIMARY KEY,name text NOT NULL,"clerkOrganizationId" text UNIQUE,metadata jsonb,"subscriptionPlan" "SubscriptionPlan" NOT NULL,"subscriptionStatus" "SubscriptionStatus" NOT NULL,"trialEndsAt" timestamp,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text UNIQUE);
      CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"userId" text REFERENCES "PlatformUser","organizationId" text REFERENCES "Organization","clerkRole" text NOT NULL,"tenantRole" text NOT NULL,status text NOT NULL);
      CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text NOT NULL,"entityType" text NOT NULL,"entityId" text,metadata jsonb,"createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    await pool.query('INSERT INTO fixture_clock VALUES(1,$1)',[new Date(time)]);
    const contexts={};
    for(const label of ['A','B','C','Unknown','Revoked','Closure']){
      const organizationId='company-'+label.toLowerCase(),actorId='Owner'+label,membershipId='membership-'+label,session={authenticated:true,verification:'clerk-production-jwt',userId:'user_'+actorId,organizationId:'org_'+label,organizationRole:'org:admin'};
      await pool.query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata,"subscriptionPlan","subscriptionStatus","trialEndsAt") VALUES($1,$2,$3,'{"preserved":true}','TRIAL','TRIALING',($4::timestamptz AT TIME ZONE 'UTC')+interval '15 days')`,[organizationId,'Synthetic '+label,session.organizationId,new Date(time)]);
      await pool.query('INSERT INTO "PlatformUser" VALUES($1,$2)',[actorId,session.userId]);await pool.query(`INSERT INTO "TenantMembership" VALUES($1,$2,$3,'org:admin','ADMIN','ACTIVE')`,[membershipId,actorId,organizationId]);
      const member={actorId,membershipId,organizationId,role:'ADMIN'};contexts[label]={session,member,scope:scopeStamp(session,member)};
    }
    const connect=async()=>{const client=await pool.connect();return {query:async(sql,args=[])=>{statements.push(sql);if(companyLockObserver&&args[0]===companyLockObserver.organizationId&&sql.startsWith('SELECT id FROM public."Organization"')&&sql.endsWith('FOR UPDATE')){companyLockObserver.resolve(client.processID);companyLockObserver=null;}return client.query(sqlInFixture(sql),args);},release:broken=>client.release(broken)};};
    const workspace=createWorkspaceStore({connect});
    const row=async label=>(await pool.query(`SELECT *,"trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt" FROM "Organization" WHERE id=$1`,[contexts[label].member.organizationId])).rows[0];
    const setClock=async value=>{time=new Date(value).getTime();assert.ok(Number.isFinite(time));await pool.query('UPDATE fixture_clock SET now=$1 WHERE id=1',[new Date(time)]);};
    const syntheticFetch=async(value,options)=>{
      const url=new URL(value);assert.equal(url.origin,'https://api.mercadopago.com');calls.push({method:options.method,path:url.pathname});
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND state='idle in transaction'`,[database])).rows[0].n,0,'No external provider call may hold an open transaction');
      if(url.pathname==='/users/me'){
        if(revokeOnAccount){await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR' WHERE id=$1`,[revokeOnAccount]);revokeOnAccount=null;}
        return Response.json({id:900001,tags:[]});
      }
      if(url.pathname==='/preapproval'&&options.method==='POST'){
        const body=JSON.parse(options.body),reservation=(await pool.query(`SELECT metadata FROM "AuditLog" WHERE id=$1 AND action='company.subscription.attempt'`,[body.external_reference])).rows;
        assert.equal(reservation.length,1);assert.equal(reservation[0].metadata.state,'DISPATCHING');assert.ok(reservation[0].metadata.lease.id);
        const id=reuseSubscription??'synthetic_sub_'+sequence++;const sub={id,collector_id:900001,external_reference:body.external_reference,status:'pending',auto_recurring:body.auto_recurring,init_point:`https://${providerConfig.checkoutHost}/subscriptions/checkout?preapproval_id=${id}`};
        if(reuseSubscription)reuseSubscription=null;else subscriptions.set(id,sub);
        if(uncertainPost){uncertainPost=false;throw new Error('SYNTHETIC_CREATE_RESPONSE_LOST');}
        return Response.json(sub,{status:201});
      }
      if(url.pathname.startsWith('/preapproval/')){
        const sub=subscriptions.get(url.pathname.slice('/preapproval/'.length));assert.ok(sub);
        if(options.method==='PUT'){assert.deepEqual(JSON.parse(options.body),{status:'cancelled'});sub.status='cancelled';}
        return Response.json(sub);
      }
      if(url.pathname==='/authorized_payments/search'){
        const results=[...invoices.values()].filter(invoice=>url.searchParams.has('payment_id')?String(invoice.payment.id)===url.searchParams.get('payment_id'):invoice.preapproval_id===url.searchParams.get('preapproval_id'));
        return Response.json({paging:{offset:0,total:results.length,limit:20},results});
      }
      if(url.pathname.startsWith('/authorized_payments/')){const invoice=invoices.get(url.pathname.slice('/authorized_payments/'.length));assert.ok(invoice);return Response.json({...invoice,payment:{...invoice.payment,status:payments.get(String(invoice.payment.id)).status}});}
      if(url.pathname.startsWith('/v1/payments/')){const payment=payments.get(url.pathname.slice('/v1/payments/'.length));assert.ok(payment);return Response.json({...payment,...(paymentReferenceOverride?{external_reference:paymentReferenceOverride}:{})});}
      assert.fail('Unexpected synthetic provider route');
    };
    const provider=createCompanySubscriptionProvider({config:providerConfig,fetchImpl:syntheticFetch,now:()=>time});
    const store=createCompanySubscription({workspace,provider,configuration:()=>catalog,verifiedPayer:async()=>({email:'verified-synthetic@example.invalid',verified:true}),connect});
    const input=(label,operationId=randomUUID())=>({scope:contexts[label].scope,operationId,offerId:offer.id,catalogVersion:catalog.catalogVersion});
    const begin=(label,command=input(label))=>store.begin(contexts[label].session,command);
    const recover=(label,operationId)=>store.recover(contexts[label].session,{scope:contexts[label].scope,operationId});
    const invoiceFor=(subscriptionId,startsAt,{paymentId=null}={})=>{
      const sub=subscriptions.get(subscriptionId),invoiceId=String(sequence++),id=paymentId??String(sequence++);
      const invoice={id:Number(invoiceId),type:'scheduled',preapproval_id:subscriptionId,external_reference:sub.external_reference,currency_id:'USD',transaction_amount:149,debit_date:startsAt,status:'processed',payment:{id:Number(id),status:'approved'}};
      invoices.set(invoiceId,invoice);
      if(!paymentId)payments.set(id,{id:Number(id),collector_id:900001,external_reference:sub.external_reference,live_mode:true,transaction_amount:149,currency_id:'USD',status:'approved',date_approved:new Date(Date.parse(startsAt)+60000).toISOString(),transaction_amount_refunded:0,refunds:[]});
      return {invoiceId,paymentId:id,startsAt,endsAt:monthLater(startsAt)};
    };
    const event=(invoiceId,requestId=randomUUID(),type='subscription_authorized_payment')=>{const ts=String(Math.floor(time/1000)),manifest=`id:${invoiceId};request-id:${requestId};ts:${ts};`,v1=createHmac('sha256',secret).update(manifest).digest('hex');return provider.verifyNotification({headers:new Headers({'x-request-id':requestId,'x-signature':`ts=${ts},v1=${v1}`}),url:`https://example.invalid/notifications?data.id=${invoiceId}&type=${type}`,body:{type,data:{id:invoiceId}}});};
    const attempts=async label=>(await pool.query(`SELECT metadata FROM "AuditLog" WHERE "organizationId"=$1 AND action='company.subscription.attempt'`,[contexts[label].member.organizationId])).rows.map(item=>item.metadata);
    const receiptCount=async label=>(await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "organizationId"=$1 AND action='company.subscription.payment.verified'`,[contexts[label].member.organizationId])).rows[0].n;
    const paidSnapshot=async label=>({organization:await row(label),attempts:await attempts(label),receipts:(await pool.query(`SELECT id,metadata FROM "AuditLog" WHERE "organizationId"=$1 AND action='company.subscription.payment.verified' ORDER BY id`,[contexts[label].member.organizationId])).rows});
    const observeCompanyLock=organizationId=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{companyLockObserver=null;reject(new Error('SYNTHETIC_LOCK_OBSERVER_TIMEOUT'));},1000);companyLockObserver={organizationId,resolve:pid=>{clearTimeout(timer);resolve(pid);}};});
    async function assertNativeLockWait(pid){
      const deadline=Date.now()+750;
      while(Date.now()<deadline){if((await pool.query('SELECT count(*)::int AS n FROM pg_locks WHERE pid=$1 AND granted=false',[pid])).rows[0].n>0)return;await new Promise(resolve=>setTimeout(resolve,5));}
      assert.fail('The command must actually wait for a native PostgreSQL lock');
    }
    async function closeBeforeDelayedCommand(label,operationId,dispatch){
      const organizationId=contexts[label].member.organizationId,locker=await pool.connect(),before=calls.length;let held=false;
      try{
        await locker.query('BEGIN');held=true;await locker.query('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',[organizationId]);
        const observedRecovery=observeCompanyLock(organizationId),closing=recover(label,operationId).then(value=>({value}),error=>({error}));await assertNativeLockWait(await observedRecovery);
        const observedDispatch=observeCompanyLock(organizationId),delayed=dispatch().then(value=>({value}),error=>({error}));await assertNativeLockWait(await observedDispatch);
        await locker.query('COMMIT');held=false;const closure=await closing,rejected=await delayed;
        assert.equal(closure.error,undefined);assert.deepEqual(closure.value.recovery,{operationId,state:'NO_DISPATCH'});assert.equal(closure.value.attempt,null);assert.equal(rejected.error?.code,'COMPANY_SUBSCRIPTION_OPERATION_CLOSED');assert.equal(calls.length,before);
        const durable=await store.read(contexts[label].session,{scope:contexts[label].scope,operationId});assert.deepEqual(durable.recovery,closure.value.recovery);
        const replay=await recover(label,operationId);assert.deepEqual(replay.recovery,closure.value.recovery);assert.equal(calls.length,before);
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "organizationId"=$1 AND action='company.subscription.operation.closed' AND metadata->>'operationId'=$2`,[organizationId,operationId])).rows[0].n,1);
      }finally{if(held)await locker.query('ROLLBACK');locker.release();}
    }

    const initialA=await row('A'),commands=[input('A'),input('A')];
    const simultaneous=await Promise.allSettled(commands.map(command=>begin('A',command)));
    assert.equal(simultaneous.filter(result=>result.status==='fulfilled').length,1);assert.equal(calls.filter(call=>call.method==='POST').length,1);assert.equal((await attempts('A')).length,1);
    const checkout=simultaneous.find(result=>result.status==='fulfilled').value,operationA=checkout.attempt.operationId,subscriptionA=(await attempts('A'))[0].resourceId;
    assert.equal(checkout.attempt.state,'CHECKOUT_READY');assert.equal((await row('A')).subscriptionStatus,'TRIALING');assert.equal(checkout.subscription.trialEndsAt,initialA.trialEndsAt.toISOString());
    await begin('A',commands.find(command=>command.operationId===operationA));assert.equal(calls.filter(call=>call.method==='POST').length,1);
    checks.push('native-company-lock-concurrent-begin-one-durable-reservation-one-synthetic-POST');

    const neverDispatched=input('Closure');await closeBeforeDelayedCommand('Closure',neverDispatched.operationId,()=>begin('Closure',neverDispatched));assert.equal((await attempts('Closure')).length,0);assert.equal((await row('Closure')).subscriptionStatus,'TRIALING');
    checks.push('native-lock-recovery-tombstone-wins-delayed-begin-with-zero-provider-HTTP');

    const unknownCommand=input('Unknown');uncertainPost=true;const postBefore=calls.filter(call=>call.method==='POST').length;
    const unknown=await begin('Unknown',unknownCommand);assert.equal(unknown.attempt.state,'UNKNOWN');assert.equal((await attempts('Unknown'))[0].resourceId,null);
    await begin('Unknown',unknownCommand);await recover('Unknown',unknownCommand.operationId);await assert.rejects(begin('Unknown',input('Unknown')),{code:'COMPANY_SUBSCRIPTION_ATTEMPT_ALREADY_ACTIVE'});assert.equal(calls.filter(call=>call.method==='POST').length,postBefore+1);
    checks.push('accepted-uncertain-create-never-repeats-POST-or-guesses-reference');

    revokeOnAccount=contexts.Revoked.member.membershipId;const revokedCommand=input('Revoked'),beforeRevoked=calls.filter(call=>call.method==='POST').length;
    await assert.rejects(begin('Revoked',revokedCommand));assert.equal(calls.filter(call=>call.method==='POST').length,beforeRevoked);assert.equal((await attempts('Revoked')).length,1);assert.equal((await row('Revoked')).subscriptionStatus,'TRIALING');
    await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE id=$1`,[contexts.Revoked.member.membershipId]);const revokedRecovered=await recover('Revoked',revokedCommand.operationId);assert.equal(revokedRecovered.attempt.state,'UNKNOWN');assert.equal(calls.filter(call=>call.method==='POST').length,beforeRevoked);
    checks.push('native-membership-role-revocation-during-account-GET-blocks-POST-fence');

    await assert.rejects(store.read(contexts.B.session,{scope:contexts.A.scope}),{code:'WORKSPACE_CONTEXT_CHANGED'});await assert.rejects(store.read(contexts.A.session,{scope:contexts.B.scope}),{code:'WORKSPACE_CONTEXT_CHANGED'});
    subscriptions.get(subscriptionA).status='authorized';const firstPeriod=invoiceFor(subscriptionA,new Date(time-3600000).toISOString()),signed=event(firstPeriod.invoiceId);
    const activated=await store.processVerifiedEvent(signed);assert.equal(activated.state,'ACTIVE');assert.equal((await row('A')).subscriptionStatus,'ACTIVE');assert.equal((await row('B')).subscriptionStatus,'TRIALING');assert.equal(await receiptCount('A'),1);
    const beforeReplay=calls.length;const duplicates=await Promise.all([store.processVerifiedEvent(event(firstPeriod.invoiceId,signed.requestId)),store.processVerifiedEvent(event(firstPeriod.invoiceId,signed.requestId))]);assert.ok(duplicates.every(result=>result.replayed===true));assert.equal(calls.length,beforeReplay);assert.equal(await receiptCount('A'),1);
    const ledgerBeforePoison=(await pool.query(`SELECT id,metadata FROM "AuditLog" WHERE action='company.subscription.event' AND metadata->>'replayKey'=$1`,[signed.replayKey])).rows;assert.equal(ledgerBeforePoison.length,1);assert.equal(ledgerBeforePoison[0].metadata.state,'PROCESSED');
    await assert.rejects(store.processVerifiedEvent(event(firstPeriod.invoiceId,signed.requestId,'payment')),{code:'COMPANY_SUBSCRIPTION_EVENT_REPLAY_CONFLICT'});assert.equal(calls.length,beforeReplay);
    assert.deepEqual((await pool.query(`SELECT id,metadata FROM "AuditLog" WHERE id=$1`,[ledgerBeforePoison[0].id])).rows,ledgerBeforePoison);const originalAfterPoison=await store.processVerifiedEvent(event(firstPeriod.invoiceId,signed.requestId));assert.equal(originalAfterPoison.replayed,true);assert.deepEqual({...originalAfterPoison,replayed:undefined},{...activated,replayed:undefined});assert.equal(calls.length,beforeReplay);assert.equal(await receiptCount('A'),1);
    checks.push('signed-current-invoice-actual-payment-native-receipt-and-replay-ledger-exact-once');

    const nextStart=monthLater(firstPeriod.startsAt);await setClock(new Date(Date.parse(nextStart)+3600000));const nextPeriod=invoiceFor(subscriptionA,nextStart);
    const next=await recover('A',operationA);assert.equal(next.attempt.paidPeriod.endsAt,nextPeriod.endsAt);assert.equal(next.subscription.status,'ACTIVE');assert.equal(await receiptCount('A'),2);assert.equal(calls.filter(call=>call.method==='POST').length,postBefore+1);
    await store.processVerifiedEvent(event(firstPeriod.invoiceId));const afterOld=await store.read(contexts.A.session,{scope:contexts.A.scope});assert.equal(afterOld.attempt.paidPeriod.endsAt,nextPeriod.endsAt);assert.equal(afterOld.subscription.entitlement.allowed,true);
    checks.push('missed-webhook-GET-recovery-next-month-receipt-monotonic-old-invoice-cannot-shorten');

    const currentPayment=payments.get(nextPeriod.paymentId);currentPayment.status='refunded';currentPayment.transaction_amount_refunded=149;currentPayment.refunds=[{id:'synthetic-refund'}];
    await store.processVerifiedEvent(event(nextPeriod.invoiceId));assert.equal((await row('A')).subscriptionStatus,'SUSPENDED');assert.equal((await store.read(contexts.A.session,{scope:contexts.A.scope})).subscription.entitlement.allowed,false);
    const thirdStart=monthLater(nextPeriod.startsAt);await setClock(new Date(Date.parse(thirdStart)+3600000));const thirdPeriod=invoiceFor(subscriptionA,thirdStart);await store.processVerifiedEvent(event(thirdPeriod.invoiceId));assert.equal((await row('A')).subscriptionStatus,'ACTIVE');assert.equal(await receiptCount('A'),3);
    checks.push('current-refund-revokes-exact-receipt-new-paid-month-reestablishes-coverage');

    const lenderBeforeBorrow=await paidSnapshot('A');reuseSubscription=subscriptionA;const borrowed=await begin('B');assert.equal(borrowed.attempt.state,'UNKNOWN');assert.equal(borrowed.attempt.code,'COMPANY_SUBSCRIPTION_RESOURCE_ALREADY_BOUND');assert.equal((await attempts('B'))[0].resourceId,null);assert.equal((await row('B')).subscriptionStatus,'TRIALING');assert.equal(await receiptCount('B'),0);assert.deepEqual(await paidSnapshot('A'),lenderBeforeBorrow);
    const commandC=input('C'),checkoutC=await begin('C',commandC),subscriptionC=(await attempts('C'))[0].resourceId;subscriptions.get(subscriptionC).status='authorized';invoiceFor(subscriptionC,thirdStart,{paymentId:thirdPeriod.paymentId});paymentReferenceOverride=checkoutC.attempt.attemptId;
    const borrowedReceipt=await recover('C',commandC.operationId);paymentReferenceOverride=null;assert.equal(borrowedReceipt.attempt.state,'UNKNOWN');assert.equal(borrowedReceipt.attempt.code,'COMPANY_SUBSCRIPTION_PAYMENT_ALREADY_BOUND');assert.equal((await row('C')).subscriptionStatus,'TRIALING');assert.equal(await receiptCount('C'),0);assert.deepEqual(await paidSnapshot('A'),lenderBeforeBorrow);
    checks.push('native-global-resource-and-payment-advisory-locks-reject-cross-company-adoption');

    const closedCancellation={scope:contexts.A.scope,operationId:randomUUID(),subscriptionAttemptId:checkout.attempt.attemptId};await closeBeforeDelayedCommand('A',closedCancellation.operationId,()=>store.cancelRenewal(contexts.A.session,closedCancellation));assert.deepEqual(await paidSnapshot('A'),lenderBeforeBorrow);assert.equal(subscriptions.get(subscriptionA).status,'authorized');
    checks.push('native-lock-recovery-tombstone-wins-delayed-cancellation-preserves-paid-owner');
    const cancelCommand={scope:contexts.A.scope,operationId:randomUUID(),subscriptionAttemptId:checkout.attempt.attemptId};
    const canceled=await store.cancelRenewal(contexts.A.session,cancelCommand);assert.equal(canceled.attempt.state,'CANCEL_CONFIRMED');assert.equal(canceled.subscription.status,'ACTIVE');assert.equal(canceled.subscription.entitlement.allowed,true);assert.equal(canceled.attempt.paidPeriod.endsAt,thirdPeriod.endsAt);
    const puts=calls.filter(call=>call.method==='PUT').length;await store.cancelRenewal(contexts.A.session,cancelCommand);assert.equal(calls.filter(call=>call.method==='PUT').length,puts);const canceledRecovery=await recover('A',cancelCommand.operationId);assert.equal(canceledRecovery.subscription.entitlement.allowed,true);assert.equal(canceledRecovery.attempt.paidPeriod.endsAt,thirdPeriod.endsAt);
    await setClock(thirdPeriod.endsAt);const expired=await store.read(contexts.A.session,{scope:contexts.A.scope});assert.equal(expired.subscription.entitlement.reasonCode,'COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED');assert.equal(expired.subscription.trialEndsAt,initialA.trialEndsAt.toISOString());await recover('A',operationA);assert.equal((await row('A')).subscriptionStatus,'CANCELED');
    checks.push('stop-renewal-keeps-paid-month-cancel-operation-recovery-and-exact-UTC-expiry');

    assert.equal(statements.some(sql=>/public\."(Project|Worker|Task|BillingSubscription)"/.test(sql)),false);assert.equal(uncontrolledHttp,0);assert.equal((await row('A')).metadata.preserved,true);assert.equal(JSON.stringify((await pool.query('SELECT metadata FROM "AuditLog"')).rows).includes('verified-synthetic@example.invalid'),false);
    checks.push('no-operational-or-retired-model-no-payer-contact-persistence-no-uncontrolled-HTTP');
  }catch(error){
    error.fixtureCompletedChecks=[...checks];throw error;
  }finally{
    globalThis.fetch=originalFetch;
    try{await closeDisposablePool(pool);}finally{try{if(created){assert.match(database,/^obrasaas_subscription_[a-f0-9]{32}$/);await admin.query(`DROP DATABASE "${database}"`);removed=true;}}finally{await admin.end();}}
  }
  assert.equal(removed,true);
  const proof={status:'PASS',checks,databaseRemoved:removed,realPostgresTransactions:true,fixtureClock:'SIMULATED_UTC_MONTHLY_PERIODS',syntheticProvider:true,providerCalls:calls.length,uncontrolledHttp,production:false,financialAcceptance:false,humanAcceptance:false};
  mkdirSync('.vercel/private/company-subscription-evidence',{recursive:true});writeFileSync('.vercel/private/company-subscription-evidence/postgres.json',JSON.stringify(proof,null,2)+'\n');
  return proof;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await verifyCompanySubscriptionPostgres()));}catch(error){console.error(JSON.stringify({status:'FAIL',code:error instanceof WorkspaceError?error.code:'COMPANY_SUBSCRIPTION_DISPOSABLE_CHECK_FAILED',completedChecks:error.fixtureCompletedChecks??[],production:false,financialAcceptance:false}));process.exitCode=1;}
}
