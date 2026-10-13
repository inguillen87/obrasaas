import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {AsyncLocalStorage} from 'node:async_hooks';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,Pool} from 'pg';
import {parse} from '@babel/parser';
import {WorkspaceError,scopeStamp} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createCompanySubscription} from '../src/lib/company-subscription-store.mjs';
import {createCompanySubscriptionProvider} from '../src/lib/company-subscription-provider.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';

export const COMPANY_SUBSCRIPTION_POSTGRES_PROOF_VERSION='company-subscription-postgres-v2';
export const COMPANY_SUBSCRIPTION_POSTGRES_CHECKS=Object.freeze([
  'closed-commercial-default-read-and-acceptance-zero-provider-and-zero-write',
  'canonical-company-terms-acceptance-exact-server-snapshot-preserves-Organization-and-trial-bytes',
  'native-concurrent-two-instances-same-acceptance-UUID-one-append-only-receipt',
  'tampered-catalog-offer-terms-and-current-authority-cannot-accept-or-borrow-receipt',
  'changed-current-commercial-terms-do-not-authorize-old-accepted-checkout',
  'native-acceptance-COMMIT-lost-ACK-recovery-and-final-ROLLBACK-no-fabricated-receipt',
  'native-company-lock-concurrent-begin-one-durable-reservation-one-synthetic-POST',
  'native-lock-recovery-tombstone-wins-delayed-begin-with-zero-provider-HTTP',
  'accepted-uncertain-create-never-repeats-POST-or-guesses-reference',
  'native-membership-role-revocation-during-account-GET-blocks-POST-fence',
  'signed-current-invoice-actual-payment-native-receipt-and-replay-ledger-exact-once',
  'missed-webhook-GET-recovery-next-month-receipt-monotonic-old-invoice-cannot-shorten',
  'current-refund-revokes-exact-receipt-new-paid-month-reestablishes-coverage',
  'native-global-resource-and-payment-advisory-locks-reject-cross-company-adoption',
  'native-lock-recovery-tombstone-wins-delayed-cancellation-preserves-paid-owner',
  'stop-renewal-keeps-paid-month-cancel-operation-recovery-and-exact-UTC-expiry',
  'native-current-terms-change-during-final-acceptance-SQL-or-COMMIT-blocks-CREATE-preserves-UNKNOWN',
  'no-operational-or-retired-model-no-payer-contact-persistence-no-uncontrolled-HTTP',
]);
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function companySubscriptionOwnedDatabase(value){if(typeof value!=='string'||!/^obrasaas_subscription_[a-f0-9]{32}$/.test(value))throw new WorkspaceError('COMPANY_SUBSCRIPTION_OWNED_DATABASE_REJECTED');return value;}
export function companySubscriptionSourceFiles(root=process.cwd()){
  const files=new Set(['package.json','package-lock.json']);
  function visit(file){
    assert.ok(/^(?:src|scripts|tests)\//.test(file)&&!file.includes('..')&&!file.includes('\\'),'Safe native source path');if(files.has(file))return;files.add(file);
    if(!/\.(?:mjs|js)$/.test(file))return;const imports=[],ast=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'unambiguous',plugins:['jsx']});
    function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);if(node.type==='ImportExpression'){assert.equal(node.source.type,'StringLiteral','No hidden dynamic native source import');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){assert.equal(node.arguments[0]?.type,'StringLiteral','No hidden dynamic native source import');imports.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
    walk(ast.program);for(const item of imports.filter(item=>item.startsWith('.'))){const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),item)),dependency=[base,base+'.mjs',base+'.js',base+'.css',base+'/index.js'].find(candidate=>existsSync(path.join(root,candidate)));assert.ok(dependency,'Every executed native source import resolves');visit(dependency);}
  }
  visit('scripts/verify-company-subscription-postgres.mjs');visit('tests/production-company-subscription-postgres-harness.test.mjs');return [...files].sort();
}
export function companySubscriptionCommittedSource(root=process.cwd(),environment={}){
  const sourceRevision=git(root,'rev-parse','HEAD'),sourceTree=git(root,'rev-parse','HEAD^{tree}');assert.match(sourceRevision,/^[a-f0-9]{40}$/);assert.equal(git(root,'status','--porcelain','--untracked-files=no'),'','Native proof requires committed clean source');
  const exact=environment.CI==='true';if(exact){assert.match(environment.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(sourceRevision,environment.GITHUB_SHA,'Native execution must match the exact event SHA');}
  const sourceManifest=companySubscriptionSourceFiles(root).map(file=>{const bytes=readFileSync(path.join(root,file)),committed=execFileSync('git',['show','HEAD:'+file],{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}),committedBlobOid=git(root,'rev-parse','HEAD:'+file),workingBlobOid=execFileSync('git',['hash-object','--path='+file,'--stdin'],{cwd:root,input:bytes,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();assert.equal(workingBlobOid,committedBlobOid,'Every native source must be committed unchanged');if(exact)assert.equal(sha(bytes),sha(committed),'Every executed CI byte must match its Git blob');return {path:file,sha256:sha(bytes),committedSha256:sha(committed),committedBlobOid};});
  return {sourceRevision,sourceTree,sourceState:exact?'EXACT_CI_SOURCE':'COMMITTED_LOCAL_SOURCE',trackedClean:true,sourceManifest};
}
export function createCompanySubscriptionTransportObserver(){
  const storage=new AsyncLocalStorage();let sequence=0;
  return {
    run:callback=>storage.run({operationId:'synthetic-native-operation-'+(++sequence),clients:[]},callback),
    trackClient(pid){const context=storage.getStore();if(!context)return {acquired(){},released(){}};const client={pid,active:false,writable:false,writableCommits:0,released:false};context.clients.push(client);return {acquired(stage,readOnly=false){if(stage==='BEGIN'){client.active=true;client.writable=!readOnly;}else if(stage==='COMMIT'||stage==='ROLLBACK'){if(stage==='COMMIT'&&client.active&&client.writable)client.writableCommits++;client.active=false;}},released(){client.released=true;}};},
    beforeExternal(){const context=storage.getStore();assert.ok(context?.clients.length,'Actual command context required before synthetic transport');assert.ok(context.clients.some(client=>client.writableCommits>0),'Actual reservation must commit before synthetic transport');assert.ok(context.clients.every(client=>!client.active),'This caller cannot hold an active SQL transaction during external transport');return {operationId:context.operationId,reservationCommitted:true,callerActiveTransactions:0,callerCheckoutCount:context.clients.length};},
  };
}
export function companySubscriptionNativeTap(checks){assert.deepEqual(checks,[...COMPANY_SUBSCRIPTION_POSTGRES_CHECKS]);return ['TAP version 13',...checks.map((check,index)=>'ok '+(index+1)+' - '+check),'1..'+checks.length,'# tests '+checks.length,'# pass '+checks.length,'# fail 0',''].join('\n');}
const sqlState=value=>typeof value==='string'&&/^(?:[0-9]{2}|0[A-Z]|2[A-Z]|3[BDF]|F0|HV|P0|XX)[0-9A-Z]{3}$/.test(value)?value:null;
export function companySubscriptionPostgresFailure(error,{root=process.cwd(),context={}}={}){
  const relativeRoot=(root.startsWith('/')?path.posix.normalize(root):path.resolve(root).replaceAll('\\','/')).replace(/\/$/,'')+'/',locations=[];
  for(const line of typeof error?.stack==='string'?error.stack.split('\n').slice(1,65):[]){
    let normalized=line.replaceAll('\\','/');normalized=normalized.replace(/file:\/\/\/[^\s)]+/g,reference=>{try{const value=new URL(reference.replace(/:\d+:\d+$/,''));if(value.hostname||value.search||value.hash)return '';return decodeURIComponent(value.pathname).replace(/^\/([A-Za-z]:\/)/,'$1')+(reference.match(/:\d+:\d+$/)?.[0]||'');}catch{return '';}});
    const at=normalized.indexOf(relativeRoot);if(at<0)continue;const relative=normalized.slice(at+relativeRoot.length),match=/^(?:src|scripts|tests)\/[A-Za-z0-9_./-]+\.(?:mjs|js):[1-9]\d{0,6}:[1-9]\d{0,6}/.exec(relative);if(match&&!match[0].includes('..'))locations.push(match[0]);
  }
  const completedChecks=Array.isArray(context.completedChecks)?context.completedChecks.filter(check=>COMPANY_SUBSCRIPTION_POSTGRES_CHECKS.includes(check)):[];
  return {version:COMPANY_SUBSCRIPTION_POSTGRES_PROOF_VERSION,status:'FAIL',errorName:['AssertionError','TypeError','WorkspaceError','Error'].includes(error?.name)?error.name:'Error',code:error instanceof WorkspaceError&&/^(?:WORKSPACE|COMPANY_SUBSCRIPTION)_[A-Z_]{1,100}$/.test(error.code||'')?error.code:'COMPANY_SUBSCRIPTION_DISPOSABLE_CHECK_FAILED',sqlCode:sqlState(error?.code)||sqlState(error?.cause?.code)||sqlState(context.sqlCode),locations:[...new Set(locations)].slice(0,8),completedChecks,completedCheckCount:completedChecks.length,cleanup:{poolClosed:context.poolClosed===true,databaseRemoved:context.databaseRemoved===true,adminClosed:context.adminClosed===true,pgStatActivityBeforeDrop:Number.isInteger(context.pgStatActivityBeforeDrop)?context.pgStatActivityBeforeDrop:null},production:false,financialAcceptance:false,humanAcceptance:false};
}
export function assertCompanySubscriptionPostgresProof(proof,nativeTap,source){
  assert.equal(proof.version,COMPANY_SUBSCRIPTION_POSTGRES_PROOF_VERSION);assert.equal(proof.status,'PASS');assert.deepEqual(proof.checks,[...COMPANY_SUBSCRIPTION_POSTGRES_CHECKS]);assert.equal(proof.totalCheckCount,COMPANY_SUBSCRIPTION_POSTGRES_CHECKS.length);assert.equal(nativeTap,companySubscriptionNativeTap(proof.checks));assert.equal(proof.nativeTapSha256,sha(nativeTap));
  for(const key of ['sourceRevision','sourceTree','sourceState','trackedClean','sourceManifest'])assert.deepEqual(proof[key],source[key]);const harness=source.sourceManifest.find(ref=>ref.path==='scripts/verify-company-subscription-postgres.mjs');assert.equal(proof.harnessSha256,harness.sha256);
  assert.ok(proof.engine.versionNum>=170000&&proof.engine.versionNum<180000);assert.equal(proof.realPostgresTransactions,true);assert.equal(proof.databaseRemoved,true);assert.equal(proof.poolClosed,true);assert.deepEqual(proof.cleanup,{poolClosed:true,databaseRemoved:true,adminClosed:true,pgStatActivityBeforeDrop:0});assert.equal(proof.providerTransport,'injected-synthetic-only');assert.equal(proof.syntheticProvider,true);assert.ok(proof.syntheticProviderCalls>0);assert.equal(proof.providerCalls,proof.syntheticProviderCalls);assert.equal(proof.realProviderRequests,null);assert.equal(proof.uncontrolledHttp,0);assert.equal(proof.production,false);assert.equal(proof.financialAcceptance,false);assert.equal(proof.humanAcceptance,false);
  assert.equal(proof.transportObservations.length,proof.syntheticProviderCalls);assert.ok(proof.transportObservations.every(item=>item.reservationCommitted===true&&item.callerActiveTransactions===0&&item.callerCheckoutCount>0));assert.deepEqual(proof.nativeAcceptanceLockObservations,[{differentNativePids:true,sameOrganization:true,sameOperationId:true,waitedForActualOrganizationRowLock:true,appendOnlyReceiptCount:1,bothSettled:true}]);assert.deepEqual(proof.nativeCommitReadbacks,[{mode:'COMMITTED_ACK_LOST',actualReceiptAfterLostAck:true,sameOperationIdRetried:true,receiptCountAfterExplicitRetry:1,providerCalls:0,organizationBytesUnchanged:true},{mode:'ROLLED_BACK_ACK_LOST',actualReceiptAfterLostAck:false,sameOperationIdRetried:true,receiptCountAfterExplicitRetry:1,providerCalls:0,organizationBytesUnchanged:true}]);assert.ok(proof.nativeTransactionTrace.some(item=>item.stage==='COMMIT'&&item.phase==='ACK_LOST'));assert.ok(proof.nativeTransactionTrace.some(item=>item.stage==='ROLLBACK'&&item.phase==='ACK_LOST'));assert.deepEqual(proof.nativeCatalogFenceObservations,['ACCEPTANCE_SQL','FENCE_COMMIT'].map(mode=>({mode,changedAfterActualAwait:true,afterSyntheticAccountGet:true,matchingAcceptanceQueries:2,syntheticCreateRequests:0,durableState:'UNKNOWN',durableResourceAbsent:true,organizationBytesUnchanged:true,explicitReplayCreatedAgain:false})));return proof;
}

// The entire financial transport is synthetic. Only this explicitly marked
// local PostgreSQL fixture may be contacted, created or dropped by the harness.
export function companySubscriptionDisposableUrl(environment={}){
  let url;try{url=new URL(environment.CUTOVER_TEST_DATABASE_URL);}catch{throw new WorkspaceError('COMPANY_SUBSCRIPTION_DISPOSABLE_TARGET_REJECTED');}
  if(environment.CUTOVER_TEST_DISPOSABLE!=='1'||environment.VERCEL||environment.VERCEL_ENV||environment.VERCEL_TARGET||environment.VERCEL_TARGET_ENV||!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname)||!['5432','6549'].includes(url.port)||url.username!=='cutover_test'||url.pathname!=='/obrasaas_cutover_ci'||url.search||url.hash||(url.port==='6549'?url.password!=='':!['','cutover_test'].includes(url.password)))throw new WorkspaceError('COMPANY_SUBSCRIPTION_DISPOSABLE_TARGET_REJECTED');
  return url;
}
const monthLater=value=>{const date=new Date(value),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return date.toISOString();};
const offer={id:'pro-monthly',plan:'PRO',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:'Synthetic final amount',termsVersion:'synthetic-terms-v1',includesAllIn:true,automaticExtras:false};
const catalog={version:1,provider:'MERCADO_PAGO',merchantId:'900001',accountMode:'LIVE',catalogVersion:'synthetic-catalog-v1',offers:[offer]};
const termsText='Términos exclusivamente sintéticos para el ensayo: USD149 mensuales, importe final declarado, servicio agrupado y sin cargos adicionales automáticos. La aceptación no confirma un pago.';
const enterpriseTermsText=termsText.replace('USD149','USD349');
const commercialCatalog={version:1,catalogVersion:catalog.catalogVersion,offers:[{...offer,includedTerms:'Servicio agrupado exclusivamente sintético.',termsText,termsSha256:sha(termsText)},{...offer,id:'enterprise-monthly',plan:'ENTERPRISE',amountMinor:'34900',includedTerms:'Servicio agrupado Enterprise exclusivamente sintético.',termsText:enterpriseTermsText,termsSha256:sha(enterpriseTermsText)}]};
const secret='synthetic-subscription-webhook-secret-only';
const providerConfig={accessToken:'synthetic-subscription-token-only',merchantId:catalog.merchantId,accountMode:'LIVE',currency:'USD',checkoutHost:'www.mercadopago.com.ar',backUrl:'https://example.invalid/billing',notificationUrl:'https://example.invalid/notifications',webhookSecret:secret};

export async function verifyCompanySubscriptionPostgres(environment=process.env){
  const target=companySubscriptionDisposableUrl(environment);
  const root=process.cwd(),source=companySubscriptionCommittedSource(root,environment),database=companySubscriptionOwnedDatabase('obrasaas_subscription_'+randomUUID().replaceAll('-',''));
  const admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000});
  const checks=[],statements=[],calls=[],subscriptions=new Map(),invoices=new Map(),payments=new Map(),transportObserver=createCompanySubscriptionTransportObserver(),transportObservations=[],nativeAcceptanceLockObservations=[],nativeCommitReadbacks=[],nativeTransactionTrace=[],nativeCatalogFenceObservations=[];
  const originalFetch=globalThis.fetch;let uncontrolledHttp=0,created=false,removed=false,pool,poolClosed=false,adminClosed=false,adminConnected=false,cleanupActivityCount=null,engine=null,sequence=10000,uncertainPost=false,reuseSubscription=null,revokeOnAccount=null,paymentReferenceOverride=null,companyLockObserver=null,commitFault=null,activeCommercialCatalog=commercialCatalog;
  let time=Date.now(),failure=null,cleanupFailure=null,nativeSqlCode=null,catalogAwaitRace=null;
  // A deterministic disposable SQL clock allows sequential monthly periods
  // and exact expiry without changing native PostgreSQL transaction/lock rules.
  const sqlInFixture=sql=>sql.replaceAll('clock_timestamp()','public.fixture_clock_timestamp()');
  globalThis.fetch=async()=>{uncontrolledHttp++;throw new Error('COMPANY_SUBSCRIPTION_UNCONTROLLED_HTTP_REJECTED');};
  try{
    await admin.connect();adminConnected=true;const authority=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(authority.db,'obrasaas_cutover_ci');assert.equal(authority.role,'cutover_test');
    await admin.query(`CREATE DATABASE "${database}"`);created=true;const fixtureUrl=new URL(target);fixtureUrl.pathname='/'+database;
    pool=trackDisposablePool(new Pool({connectionString:fixtureUrl.toString(),max:12,connectionTimeoutMillis:5000}));
    engine=(await pool.query(`SELECT current_setting('server_version') AS version,current_setting('server_version_num')::int AS "versionNum"`)).rows[0];assert.ok(engine.versionNum>=170000&&engine.versionNum<180000,'Native proof requires the pinned PostgreSQL17 engine');
    await pool.query(`CREATE TYPE "SubscriptionPlan" AS ENUM('TRIAL','PRO','ENTERPRISE');CREATE TYPE "SubscriptionStatus" AS ENUM('TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED');
      CREATE TABLE fixture_clock(id integer PRIMARY KEY CHECK(id=1),now timestamptz NOT NULL);
      CREATE FUNCTION fixture_clock_timestamp() RETURNS timestamptz LANGUAGE sql STABLE AS 'SELECT now FROM public.fixture_clock WHERE id=1';
      CREATE TABLE "Organization"(id text PRIMARY KEY,name text NOT NULL,"clerkOrganizationId" text UNIQUE,metadata jsonb,"subscriptionPlan" "SubscriptionPlan" NOT NULL,"subscriptionStatus" "SubscriptionStatus" NOT NULL,"trialEndsAt" timestamp,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text UNIQUE);
      CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"userId" text REFERENCES "PlatformUser","organizationId" text REFERENCES "Organization","clerkRole" text NOT NULL,"tenantRole" text NOT NULL,status text NOT NULL);
      CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text NOT NULL,"entityType" text NOT NULL,"entityId" text,metadata jsonb,"createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    await pool.query('INSERT INTO fixture_clock VALUES(1,$1)',[new Date(time)]);
    const contexts={};
    for(const label of ['A','B','C','Unknown','Revoked','Closure','Terms','EnterpriseTerms','TermsConcurrent','TermsTamper','TermsChanged','TermsAck','TermsRollback','TermsRaceSql','TermsRaceCommit','Closed']){
      const organizationId='company-'+label.toLowerCase(),actorId='Owner'+label,membershipId='membership-'+label,session={authenticated:true,verification:'clerk-production-jwt',userId:'user_'+actorId,organizationId:'org_'+label,organizationRole:'org:admin'};
      await pool.query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata,"subscriptionPlan","subscriptionStatus","trialEndsAt") VALUES($1,$2,$3,'{"preserved":true,"financial":{"retained":"synthetic-original"}}','TRIAL','TRIALING',($4::timestamptz AT TIME ZONE 'UTC')+interval '15 days')`,[organizationId,'Synthetic '+label,session.organizationId,new Date(time)]);
      await pool.query('INSERT INTO "PlatformUser" VALUES($1,$2)',[actorId,session.userId]);await pool.query(`INSERT INTO "TenantMembership" VALUES($1,$2,$3,'org:admin','ADMIN','ACTIVE')`,[membershipId,actorId,organizationId]);
      const member={actorId,membershipId,organizationId,role:'ADMIN'};contexts[label]={session,member,scope:scopeStamp(session,member)};
    }
    const changeCatalogDuringNativeAwait=()=>{assert.equal(catalogAwaitRace.changed,false);activeCommercialCatalog={...commercialCatalog,offers:commercialCatalog.offers.map(value=>({...value,termsText:value.termsText+' Cambio durante el await nativo '+catalogAwaitRace.mode+'.',termsSha256:sha(value.termsText+' Cambio durante el await nativo '+catalogAwaitRace.mode+'.')}))};catalogAwaitRace.changed=true;};
    const connect=async()=>{const client=await pool.connect(),observed=transportObserver.trackClient(client.processID);let organizationId=null,termsInserted=false;return {query:async(sql,args=[])=>{
      statements.push(sql);const stage=sql.startsWith('BEGIN')?'BEGIN':sql==='COMMIT'||sql==='ROLLBACK'?sql:null;
      if(sql.startsWith('SELECT id FROM public."Organization"')&&sql.endsWith('FOR UPDATE')){organizationId=args[0];if(companyLockObserver&&organizationId===companyLockObserver.organizationId){companyLockObserver.resolve(client.processID);companyLockObserver=null;}}
      if(sql.startsWith('INSERT INTO public."AuditLog"')&&(sql.includes('company.subscription.offer.accepted')||args.includes('company.subscription.offer.accepted')))termsInserted=true;
      if(stage)nativeTransactionTrace.push({pid:client.processID,stage,phase:'REQUEST',readOnly:stage==='BEGIN'?sql.includes('READ ONLY'):null});
      if(sql==='COMMIT'&&termsInserted&&commitFault?.organizationId===organizationId&&!commitFault.fired){commitFault.fired=true;const actual=commitFault.mode==='COMMITTED_ACK_LOST'?'COMMIT':'ROLLBACK';await client.query(actual);observed.acquired(actual);nativeTransactionTrace.push({pid:client.processID,stage:actual,phase:'ACK_LOST',readOnly:null});throw Error('Synthetic terms transaction acknowledgement lost');}
      let result;try{result=await client.query(sqlInFixture(sql),args);}catch(error){nativeSqlCode=sqlState(error?.code)||nativeSqlCode;throw error;}
      if(catalogAwaitRace?.afterAccount&&!catalogAwaitRace.changed&&organizationId===catalogAwaitRace.organizationId&&args[0]===catalogAwaitRace.receiptId&&args[2]==='company.subscription.offer.accepted'&&sql.startsWith('SELECT id,"entityId",metadata,"actorId","organizationId"')){
        catalogAwaitRace.matchingAcceptanceQueries++;if(catalogAwaitRace.matchingAcceptanceQueries===2&&catalogAwaitRace.mode==='ACCEPTANCE_SQL'){assert.equal(result.rows.length,1);changeCatalogDuringNativeAwait();}
      }
      if(stage){observed.acquired(stage,sql.includes('READ ONLY'));nativeTransactionTrace.push({pid:client.processID,stage,phase:'ACQUIRED',readOnly:stage==='BEGIN'?sql.includes('READ ONLY'):null});}
      if(stage==='COMMIT'&&catalogAwaitRace?.afterAccount&&!catalogAwaitRace.changed&&organizationId===catalogAwaitRace.organizationId&&catalogAwaitRace.matchingAcceptanceQueries===2&&catalogAwaitRace.mode==='FENCE_COMMIT')changeCatalogDuringNativeAwait();return result;
    },release:broken=>{client.release(broken);observed.released();}};};
    const workspace=createWorkspaceStore({connect});
    const row=async label=>(await pool.query(`SELECT *,"trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt" FROM "Organization" WHERE id=$1`,[contexts[label].member.organizationId])).rows[0];
    const setClock=async value=>{time=new Date(value).getTime();assert.ok(Number.isFinite(time));await pool.query('UPDATE fixture_clock SET now=$1 WHERE id=1',[new Date(time)]);};
    const syntheticFetch=async(value,options)=>{
      const url=new URL(value);assert.equal(url.origin,'https://api.mercadopago.com');calls.push({method:options.method,path:url.pathname});
      transportObservations.push({...transportObserver.beforeExternal(),method:options.method,path:url.pathname});
      if(url.pathname==='/users/me'){
        if(revokeOnAccount){await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR' WHERE id=$1`,[revokeOnAccount]);revokeOnAccount=null;}
        if(catalogAwaitRace)catalogAwaitRace.afterAccount=true;
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
    const build=({closed=false}={})=>{
      const actual=createCompanySubscription({workspace,provider,configuration:()=>closed?null:catalog,...(!closed?{commercialCatalog:()=>activeCommercialCatalog}:{}),verifiedPayer:async()=>({email:'verified-synthetic@example.invalid',verified:true}),connect});
      return {...actual,...Object.fromEntries(['begin','recover','cancelRenewal','processVerifiedEvent'].map(method=>[method,(...args)=>transportObserver.run(()=>actual[method](...args))]))};
    },store=build(),acceptedByLabel=new Map();
    const acceptanceInput=async(label,operationId=randomUUID(),targetStore=store,offerId=offer.id)=>{const snapshot=await targetStore.read(contexts[label].session,{scope:contexts[label].scope}),selected=snapshot.commercial.offers.find(value=>value.id===offerId);assert.ok(selected);return {scope:contexts[label].scope,operationId,offerId:selected.id,catalogVersion:snapshot.commercial.catalogVersion,catalogDigest:snapshot.commercial.catalogDigest,offerDigest:selected.offerDigest,termsVersion:selected.termsVersion,termsSha256:selected.termsSha256,accepted:true};};
    const accept=async(label,operationId=randomUUID(),targetStore=store)=>{const command=await acceptanceInput(label,operationId,targetStore),result=await targetStore.acceptOffer(contexts[label].session,command);assert.ok(result.acceptance);acceptedByLabel.set(label,result.acceptance);return {command,result};};
    const input=(label,operationId=randomUUID())=>{const acceptance=acceptedByLabel.get(label);assert.ok(acceptance,'Native checkout requires an authentic accepted receipt');return {scope:contexts[label].scope,operationId,offerId:offer.id,catalogVersion:catalog.catalogVersion,acceptanceReceiptId:acceptance.receiptId,acceptanceDigest:acceptance.acceptanceDigest};};
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

    const organizationBytes=async label=>(await pool.query(`SELECT row_to_json(o)::text AS bytes FROM "Organization" o WHERE id=$1`,[contexts[label].member.organizationId])).rows[0].bytes;
    const acceptanceRows=async label=>(await pool.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM "AuditLog" WHERE "organizationId"=$1 AND action='company.subscription.offer.accepted' ORDER BY id`,[contexts[label].member.organizationId])).rows;
    const financialRows=async label=>(await pool.query(`SELECT id,action,metadata FROM "AuditLog" WHERE "organizationId"=$1 AND action LIKE 'company.subscription.%' AND action<>'company.subscription.offer.accepted' ORDER BY id`,[contexts[label].member.organizationId])).rows;

    const closedStore=build({closed:true}),closedBefore=await organizationBytes('Closed'),closedCalls=calls.length,closedSnapshot=await closedStore.read(contexts.Closed.session,{scope:contexts.Closed.scope}),closedOffer=closedSnapshot.commercial.offers[0];
    assert.equal(closedOffer.canAccept,false);assert.equal(closedOffer.checkoutAvailable,false);
    await assert.rejects(closedStore.acceptOffer(contexts.Closed.session,{scope:contexts.Closed.scope,operationId:randomUUID(),offerId:closedOffer.id,catalogVersion:closedSnapshot.commercial.catalogVersion,catalogDigest:closedSnapshot.commercial.catalogDigest,offerDigest:closedOffer.offerDigest,termsVersion:offer.termsVersion,termsSha256:sha(termsText),accepted:true}),{code:'COMPANY_SUBSCRIPTION_TERMS_PENDING'});
    assert.equal(calls.length,closedCalls);assert.equal((await acceptanceRows('Closed')).length,0);assert.equal((await financialRows('Closed')).length,0);assert.equal(await organizationBytes('Closed'),closedBefore);
    checks.push(COMPANY_SUBSCRIPTION_POSTGRES_CHECKS[0]);

    const beforeTerms=await organizationBytes('Terms'),beforeTermsCalls=calls.length,terms=await accept('Terms'),recordedTerms=await acceptanceRows('Terms');assert.equal(recordedTerms.length,1);assert.equal(recordedTerms[0].id,terms.result.acceptance.receiptId);assert.equal(recordedTerms[0].actorId,contexts.Terms.member.actorId);assert.equal(recordedTerms[0].entityId,contexts.Terms.member.organizationId);assert.equal(recordedTerms[0].metadata.state,'TERMS_ACCEPTED');assert.equal(recordedTerms[0].metadata.acceptanceDigest,terms.result.acceptance.acceptanceDigest);assert.equal(recordedTerms[0].metadata.offer.termsText,termsText);assert.equal(recordedTerms[0].metadata.offer.termsSha256,sha(termsText));assert.equal(recordedTerms[0].metadata.offer.amountMinor,'14900');assert.equal(recordedTerms[0].metadata.offer.currency,'USD');assert.equal(recordedTerms[0].metadata.offer.automaticExtras,false);
    const replayedTerms=await build().acceptOffer(contexts.Terms.session,terms.command);assert.deepEqual(replayedTerms.acceptance,terms.result.acceptance);assert.deepEqual(await acceptanceRows('Terms'),recordedTerms);assert.equal(await organizationBytes('Terms'),beforeTerms);assert.equal((await financialRows('Terms')).length,0);assert.equal(calls.length,beforeTermsCalls);
    const enterpriseBefore=await organizationBytes('EnterpriseTerms'),enterpriseCommand=await acceptanceInput('EnterpriseTerms',randomUUID(),store,'enterprise-monthly'),enterpriseAccepted=await store.acceptOffer(contexts.EnterpriseTerms.session,enterpriseCommand);assert.equal(enterpriseAccepted.acceptance.offer.plan,'ENTERPRISE');assert.equal(enterpriseAccepted.acceptance.offer.amountMinor,'34900');assert.equal(enterpriseAccepted.acceptance.offer.currency,'USD');assert.equal(enterpriseAccepted.acceptance.offer.termsSha256,sha(enterpriseTermsText));assert.equal(enterpriseAccepted.acceptance.current,true);assert.equal(enterpriseAccepted.acceptance.canCheckout,false,'This synthetic financial configuration offers only PRO; accepting terms cannot invent ENTERPRISE provider readiness');assert.equal(await organizationBytes('EnterpriseTerms'),enterpriseBefore);assert.equal((await financialRows('EnterpriseTerms')).length,0);assert.equal(calls.length,beforeTermsCalls);
    checks.push(COMPANY_SUBSCRIPTION_POSTGRES_CHECKS[1]);

    const concurrentTermsCommand=await acceptanceInput('TermsConcurrent'),concurrentOrg=contexts.TermsConcurrent.member.organizationId,locker=await pool.connect(),concurrentBefore=await organizationBytes('TermsConcurrent'),concurrentCalls=calls.length;let acceptanceA,acceptanceB,lockerOpen=false;
    try{
      await locker.query('BEGIN');lockerOpen=true;await locker.query('SELECT id FROM "Organization" WHERE id=$1 FOR UPDATE',[concurrentOrg]);
      const firstWaiter=observeCompanyLock(concurrentOrg);acceptanceA=store.acceptOffer(contexts.TermsConcurrent.session,concurrentTermsCommand);acceptanceA.catch(()=>{});const firstPid=await firstWaiter;await assertNativeLockWait(firstPid);
      const secondWaiter=observeCompanyLock(concurrentOrg);acceptanceB=build().acceptOffer(contexts.TermsConcurrent.session,concurrentTermsCommand);acceptanceB.catch(()=>{});const secondPid=await secondWaiter;await assertNativeLockWait(secondPid);assert.notEqual(firstPid,secondPid);
      await locker.query('COMMIT');lockerOpen=false;const results=await Promise.all([acceptanceA,acceptanceB]);assert.deepEqual(results[0].acceptance,results[1].acceptance);assert.equal((await acceptanceRows('TermsConcurrent')).length,1);assert.equal(await organizationBytes('TermsConcurrent'),concurrentBefore);assert.equal(calls.length,concurrentCalls);nativeAcceptanceLockObservations.push({differentNativePids:true,sameOrganization:true,sameOperationId:true,waitedForActualOrganizationRowLock:true,appendOnlyReceiptCount:1,bothSettled:true});
    }finally{if(lockerOpen)await locker.query('ROLLBACK');locker.release();await Promise.allSettled([acceptanceA,acceptanceB].filter(Boolean));}
    checks.push(COMPANY_SUBSCRIPTION_POSTGRES_CHECKS[2]);

    const tamperBefore=await organizationBytes('TermsTamper'),tamperCommand=await acceptanceInput('TermsTamper'),tamperCalls=calls.length;
    for(const [key,value,code] of [['catalogDigest','f'.repeat(64),'COMPANY_SUBSCRIPTION_CATALOG_CHANGED'],['offerDigest','f'.repeat(64),'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'],['termsSha256','f'.repeat(64),'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'],['termsVersion','foreign-terms-v1','COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'],['catalogVersion','foreign-catalog-v1','COMPANY_SUBSCRIPTION_CATALOG_CHANGED'],['accepted',false,'COMPANY_SUBSCRIPTION_INPUT_INVALID']])await assert.rejects(store.acceptOffer(contexts.TermsTamper.session,{...tamperCommand,[key]:value}),{code});
    assert.equal((await acceptanceRows('TermsTamper')).length,0);await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR' WHERE id=$1`,[contexts.TermsTamper.member.membershipId]);await assert.rejects(store.acceptOffer(contexts.TermsTamper.session,tamperCommand),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE id=$1`,[contexts.TermsTamper.member.membershipId]);
    const tamper=await accept('TermsTamper'),tamperReceipt=(await acceptanceRows('TermsTamper'))[0],changedMetadata=structuredClone(tamperReceipt.metadata);changedMetadata.offer.amountMinor='34900';await pool.query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[tamperReceipt.id,JSON.stringify(changedMetadata)]);await assert.rejects(begin('TermsTamper'),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_INTEGRITY'});await pool.query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[tamperReceipt.id,JSON.stringify(tamperReceipt.metadata)]);
    const otherActor={actorId:'OtherTermsOwner',membershipId:'OtherTermsOwnerMembership',organizationId:contexts.Terms.member.organizationId,role:'ADMIN'},otherSession={...contexts.Terms.session,userId:'user_OtherTermsOwner'};await pool.query(`INSERT INTO "PlatformUser" VALUES($1,$2)`,[otherActor.actorId,otherSession.userId]);await pool.query(`INSERT INTO "TenantMembership" VALUES($1,$2,$3,'org:admin','ADMIN','ACTIVE')`,[otherActor.membershipId,otherActor.actorId,otherActor.organizationId]);
    await assert.rejects(store.begin(otherSession,{...input('Terms'),scope:scopeStamp(otherSession,otherActor)}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED'});await assert.rejects(store.begin(contexts.B.session,{...input('Terms'),scope:contexts.B.scope}),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_REQUIRED'});assert.equal(calls.length,tamperCalls);assert.equal((await attempts('TermsTamper')).length,0);assert.equal((await attempts('Terms')).length,0);assert.equal((await attempts('B')).length,0);assert.equal(await organizationBytes('TermsTamper'),tamperBefore);assert.equal(await organizationBytes('Terms'),beforeTerms);assert.equal(tamper.result.acceptance.current,true);
    checks.push(COMPANY_SUBSCRIPTION_POSTGRES_CHECKS[3]);

    const changedBefore=await organizationBytes('TermsChanged'),changed=await accept('TermsChanged'),changedCalls=calls.length;activeCommercialCatalog={...commercialCatalog,offers:commercialCatalog.offers.map(value=>({...value,termsText:value.termsText+' Cambio sintético vigente.',termsSha256:sha(value.termsText+' Cambio sintético vigente.')}))};
    try{const observed=await store.read(contexts.TermsChanged.session,{scope:contexts.TermsChanged.scope,acceptanceOperationId:changed.command.operationId});assert.equal(observed.acceptance.current,false);assert.equal(observed.acceptance.canCheckout,false);await assert.rejects(begin('TermsChanged'),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'});const changedCommand=await acceptanceInput('TermsChanged');await assert.rejects(store.acceptOffer(contexts.TermsChanged.session,changedCommand),{code:'COMPANY_SUBSCRIPTION_CATALOG_CHANGED'});assert.equal((await acceptanceRows('TermsChanged')).length,1,'A globally accepted catalog version cannot adopt different complete terms');assert.equal(calls.length,changedCalls);assert.equal((await attempts('TermsChanged')).length,0);assert.equal(await organizationBytes('TermsChanged'),changedBefore);}finally{activeCommercialCatalog=commercialCatalog;}
    checks.push(COMPANY_SUBSCRIPTION_POSTGRES_CHECKS[4]);

    for(const [label,mode] of [['TermsAck','COMMITTED_ACK_LOST'],['TermsRollback','ROLLED_BACK_ACK_LOST']]){
      const before=await organizationBytes(label),command=await acceptanceInput(label),beforeCalls=calls.length;commitFault={organizationId:contexts[label].member.organizationId,mode,fired:false};
      await assert.rejects(store.acceptOffer(contexts[label].session,command),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal(commitFault.fired,true);commitFault=null;const recovered=await build().read(contexts[label].session,{scope:contexts[label].scope,acceptanceOperationId:command.operationId}),committed=mode==='COMMITTED_ACK_LOST';assert.equal(Boolean(recovered.acceptance),committed);assert.equal((await acceptanceRows(label)).length,committed?1:0);const retried=await build().acceptOffer(contexts[label].session,command);assert.equal(retried.acceptance.operationId,command.operationId);assert.equal((await acceptanceRows(label)).length,1);if(committed)assert.equal(retried.acceptance.receiptId,recovered.acceptance.receiptId);assert.equal(calls.length,beforeCalls);assert.equal(await organizationBytes(label),before);assert.equal((await financialRows(label)).length,0);nativeCommitReadbacks.push({mode,actualReceiptAfterLostAck:committed,sameOperationIdRetried:true,receiptCountAfterExplicitRetry:1,providerCalls:0,organizationBytesUnchanged:true});
    }
    checks.push(COMPANY_SUBSCRIPTION_POSTGRES_CHECKS[5]);
    for(const label of ['A','B','C','Unknown','Revoked','Closure']){const before=await organizationBytes(label),beforeCalls=calls.length;await accept(label);assert.equal(await organizationBytes(label),before);assert.equal(calls.length,beforeCalls);}

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
    const unknownFinancialBefore=await attempts('Unknown'),unknownOrganizationBefore=await organizationBytes('Unknown'),unknownAcceptanceCalls=calls.length,unknownAccepted=await accept('Unknown');assert.equal(unknownAccepted.result.attempt.state,'UNKNOWN');assert.equal(unknownAccepted.result.attempt.operationId,unknownCommand.operationId);const unknownAcceptanceRead=await build().read(contexts.Unknown.session,{scope:contexts.Unknown.scope,acceptanceOperationId:unknownAccepted.command.operationId});assert.equal(unknownAcceptanceRead.attempt.state,'UNKNOWN');assert.equal(unknownAcceptanceRead.attempt.operationId,unknownCommand.operationId);assert.deepEqual(await attempts('Unknown'),unknownFinancialBefore);assert.equal(await organizationBytes('Unknown'),unknownOrganizationBefore);assert.equal(calls.length,unknownAcceptanceCalls);await assert.rejects(begin('Unknown',input('Unknown')),{code:'COMPANY_SUBSCRIPTION_ATTEMPT_ALREADY_ACTIVE'});assert.equal(calls.length,unknownAcceptanceCalls);
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

    for(const [label,mode] of [['TermsRaceSql','ACCEPTANCE_SQL'],['TermsRaceCommit','FENCE_COMMIT']]){
      await accept(label);const raceCommand=input(label),raceBefore=await organizationBytes(label),raceCalls=calls.length;catalogAwaitRace={mode,organizationId:contexts[label].member.organizationId,receiptId:raceCommand.acceptanceReceiptId,afterAccount:false,matchingAcceptanceQueries:0,changed:false};
      try{
        const raced=await begin(label,raceCommand);assert.equal(catalogAwaitRace.changed,true,'The complete catalog must change only after the actual final native SQL or COMMIT await');assert.equal(catalogAwaitRace.matchingAcceptanceQueries,2);assert.equal(raced.attempt.state,'UNKNOWN');assert.equal(raced.attempt.code,'COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED');assert.equal(raced.attempt.checkoutUrl,null);assert.equal(raced.acceptance.current,false);assert.deepEqual(calls.slice(raceCalls),[{method:'GET',path:'/users/me'}]);const durableRace=await attempts(label);assert.equal(durableRace.length,1);assert.equal(durableRace[0].state,'UNKNOWN');assert.equal(durableRace[0].resourceId,null);assert.equal(durableRace[0].lease,null);assert.equal(await organizationBytes(label),raceBefore);activeCommercialCatalog=commercialCatalog;catalogAwaitRace=null;const replay=await build().begin(contexts[label].session,raceCommand);assert.equal(replay.attempt.state,'UNKNOWN');assert.equal(replay.attempt.operationId,raceCommand.operationId);assert.equal(calls.length,raceCalls+1);nativeCatalogFenceObservations.push({mode,changedAfterActualAwait:true,afterSyntheticAccountGet:true,matchingAcceptanceQueries:2,syntheticCreateRequests:0,durableState:'UNKNOWN',durableResourceAbsent:true,organizationBytesUnchanged:true,explicitReplayCreatedAgain:false});
      }finally{catalogAwaitRace=null;activeCommercialCatalog=commercialCatalog;}
    }
    checks.push('native-current-terms-change-during-final-acceptance-SQL-or-COMMIT-blocks-CREATE-preserves-UNKNOWN');

    assert.equal(statements.some(sql=>/public\."(Project|Worker|Task|BillingSubscription)"/.test(sql)),false);assert.equal(uncontrolledHttp,0);assert.equal((await row('A')).metadata.preserved,true);assert.equal(JSON.stringify((await pool.query('SELECT metadata FROM "AuditLog"')).rows).includes('verified-synthetic@example.invalid'),false);
    checks.push('no-operational-or-retired-model-no-payer-contact-persistence-no-uncontrolled-HTTP');
  }catch(error){
    failure=error;
  }finally{
    globalThis.fetch=originalFetch;
    try{try{await closeDisposablePool(pool);poolClosed=Boolean(pool);}finally{try{if(created){companySubscriptionOwnedDatabase(database);const authority=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(authority.db,'obrasaas_cutover_ci');assert.equal(authority.role,'cutover_test');cleanupActivityCount=(await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].n;assert.equal(cleanupActivityCount,0,'Every owned fixture socket must close before DROP');await admin.query(`DROP DATABASE "${database}"`);removed=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rows.length===0;}}finally{if(adminConnected){await admin.end();adminClosed=true;}}}}catch(error){cleanupFailure=error;}
  }
  if(failure||cleanupFailure){const error=failure||cleanupFailure,context={completedChecks:checks,poolClosed,databaseRemoved:removed,adminClosed,pgStatActivityBeforeDrop:cleanupActivityCount,sqlCode:nativeSqlCode},proof={...companySubscriptionPostgresFailure(error,{root,context}),...source,nativeTransactionTrace,cleanupFailure:cleanupFailure?companySubscriptionPostgresFailure(cleanupFailure,{root,context}):null};mkdirSync('.vercel/private/company-subscription-evidence',{recursive:true});writeFileSync('.vercel/private/company-subscription-evidence/postgres-failure.json',JSON.stringify(proof,null,2)+'\n');error.fixtureFailureProof=proof;throw error;}
  assert.equal(removed,true);assert.equal(poolClosed,true);assert.equal(adminClosed,true);assert.deepEqual(checks,[...COMPANY_SUBSCRIPTION_POSTGRES_CHECKS]);assert.equal(nativeAcceptanceLockObservations.length,1);assert.equal(nativeCommitReadbacks.length,2);assert.equal(transportObservations.length,calls.length);
  const after=companySubscriptionCommittedSource(root,environment);assert.deepEqual(after,source,'Every committed source and raw byte hash must stay exact through native execution');
  const nativeTap=companySubscriptionNativeTap(checks),proof={version:COMPANY_SUBSCRIPTION_POSTGRES_PROOF_VERSION,status:'PASS',recordedAt:new Date().toISOString(),...source,githubRun:{runId:environment.GITHUB_RUN_ID||null,runAttempt:environment.GITHUB_RUN_ATTEMPT||null,job:environment.GITHUB_JOB||null},harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url))),checks,totalCheckCount:checks.length,nativeTapSha256:sha(nativeTap),engine,nativeAcceptanceLockObservations,nativeCommitReadbacks,nativeTransactionTrace,nativeCatalogFenceObservations,transportObservations,databaseRemoved:removed,poolClosed,cleanup:{poolClosed,databaseRemoved:removed,adminClosed,pgStatActivityBeforeDrop:cleanupActivityCount},realPostgresTransactions:true,fixtureClock:'SIMULATED_UTC_MONTHLY_PERIODS',providerTransport:'injected-synthetic-only',syntheticProvider:true,syntheticProviderCalls:calls.length,providerCalls:calls.length,realProviderRequests:null,uncontrolledHttp,production:false,financialAcceptance:false,humanAcceptance:false};assertCompanySubscriptionPostgresProof(proof,nativeTap,source);
  mkdirSync('.vercel/private/company-subscription-evidence',{recursive:true});writeFileSync('.vercel/private/company-subscription-evidence/postgres.json',JSON.stringify(proof,null,2)+'\n');
  writeFileSync('.vercel/private/company-subscription-evidence/native.tap',nativeTap);
  return proof;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const proof=await verifyCompanySubscriptionPostgres();console.log(JSON.stringify({status:proof.status,sourceRevision:proof.sourceRevision,totalCheckCount:proof.totalCheckCount,poolClosed:proof.poolClosed,databaseRemoved:proof.databaseRemoved,syntheticProviderCalls:proof.syntheticProviderCalls,realProviderRequests:proof.realProviderRequests}));}catch(error){const proof=error.fixtureFailureProof||companySubscriptionPostgresFailure(error);mkdirSync('.vercel/private/company-subscription-evidence',{recursive:true});writeFileSync('.vercel/private/company-subscription-evidence/postgres-failure.json',JSON.stringify(proof,null,2)+'\n');console.error(JSON.stringify({status:proof.status,code:proof.code,sqlCode:proof.sqlCode,locations:proof.locations,completedCheckCount:proof.completedCheckCount,cleanup:proof.cleanup}));process.exitCode=1;}
}
