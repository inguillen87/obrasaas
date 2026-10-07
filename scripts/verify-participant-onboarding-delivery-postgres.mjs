import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {Client,Pool} from 'pg';
import {lifecycleDisposableUrl,lifecycleEnvironment,lifecycleSchema,lifecycleTenants,createControlledLifecycleClerk} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {COMPANY_CHANNEL_SCHEMA_SQL,COMPANY_CHANNEL_SCHEMA_CONTRACT,companyChannelCatalogFingerprint,companyChannelSchemaReady} from '../src/lib/company-channel-schema.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {prepareMetaKycChallenge,metaKycChallengeDigest} from '../src/lib/meta-kyc-challenge.mjs';
import {resolveParticipantOnboardingAuthority} from '../src/lib/participant-onboarding-authority.mjs';
import {createParticipantOnboardingDelivery,readParticipantOnboardingStatuses} from '../src/lib/participant-onboarding-delivery.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256,participantOnboardingIntent,participantOnboardingOutboundId,publicParticipantOnboarding} from '../src/lib/participant-onboarding-policy.mjs';
import {buildCustomerTemplate} from '../src/lib/meta-customer-templates.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerOutbound,customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {createMetaCustomerCallbackHandlers,createMetaCustomerInbox,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';

// Actual canonical SQL, an existing explicitly disposable localhost DB, and a
// random schema only. All people, credentials and Graph responses are fixtures.
// This harness never creates a database or contacts Clerk/Meta/Neon/Blob.
const url=lifecycleDisposableUrl(process.env);
assert.ok(!process.env.TARGET);
assert.ok(['5432','6549'].includes(url.port));assert.equal(url.username,'cutover_test');
assert.ok(url.port==='6549'?url.password==='':['','cutover_test'].includes(url.password));
assert.ok(process.env.CUTOVER_TEST_DATABASE_DISPOSABLE===undefined||process.env.CUTOVER_TEST_DATABASE_DISPOSABLE==='1');
const schema='obrasaas_onboarding_delivery_'+randomUUID().replaceAll('-',''),quoted='"'+schema+'"';
assert.match(schema,/^obrasaas_onboarding_delivery_[a-f0-9]{32}$/);
const rewrite=sql=>{
 let value=sql.replace(/\bpublic\./g,quoted+'.').replaceAll("'public'::regnamespace","'"+schema+"'::regnamespace").replaceAll("table_schema='public'","table_schema='"+schema+"'");
 if(value.includes('FROM pg_trigger WHERE tgname=ANY'))value=value.replace('AND NOT tgisinternal','AND NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace=\''+schema+'\'::regnamespace)');
 return value;
};
const output=process.env.ONBOARDING_DELIVERY_PROOF_FILE||'.vercel/participant-onboarding-delivery-evidence/postgres.json';
assert.match(output,/^\.vercel\/participant-onboarding-delivery-evidence\/(?:postgres|pg-[a-z0-9-]{1,100})\.json$/);
assert.equal(existsSync(output),false,'PRESERVE_EXISTING_ONBOARDING_DELIVERY_PROOF');
const root=process.cwd(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?sources(relative+'/'+e.name):[relative+'/'+e.name]);
const sourceManifest=[...sources('src/lib'),'scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/disposable-postgres-cleanup.mjs'].map(file=>({path:file,sha256:sha(readFileSync(file))}));
const harnessSha256=sha(readFileSync(new URL(import.meta.url)));
function sourceState(){
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const trackedClean=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim()==='';
 if(process.env.CI==='true'){assert.equal(sourceRevision,process.env.GITHUB_SHA);assert.equal(trackedClean,true);}
 return {sourceRevision,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'WORK_IN_PROGRESS',trackedClean};
}
const initialSourceState=sourceState();
function assertStableSource(){for(const source of sourceManifest)assert.equal(sha(readFileSync(source.path)),source.sha256,'ONBOARDING_SOURCE_CHANGED_DURING_RUN: '+source.path);assert.equal(sha(readFileSync(new URL(import.meta.url))),harnessSha256);assert.deepEqual(sourceState(),initialSourceState);}
const environment={...lifecycleEnvironment},tenants=lifecycleTenants.map(t=>({...t,anchorProjectId:'delivery-anchor-'+t.key,projectId:'delivery-target-'+t.key,channelId:'delivery-channel-'+t.key}));
const [a,b]=tenants,clerk=createControlledLifecycleClerk(),admin=new Client({connectionString:url.href,connectionTimeoutMillis:5000}),checks=[],assets=new Map(),posts=[],unexpected=[];
let pool,created=false,schemaRemoved=false,passed=false,networkCalls=0,sequence=0,fault=null;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('ONBOARDING_UNCONTROLLED_NETWORK_REJECTED');};
const query=(sql,args=[])=>pool.query(rewrite(sql),args);
// Faults execute against real transactions. ACK loss happens after COMMIT;
// commit rejection happens before it, preserving the older dispatch marker.
const connect=async()=>{const c=await pool.connect();let stage=null,finalAuthorityClock=false;return {release:bad=>c.release(bad),query:async(sql,args=[])=>{
 if(fault?.mode==='reserve-rollback'&&sql.startsWith('INSERT INTO public."WebhookEvent"')&&JSON.parse(args[3]).workerId===fault.workerId){fault=null;throw Error('SYNTHETIC_OUTBOX_INSERT_ROLLBACK');}
 if(sql.startsWith('UPDATE public."WebhookEvent" SET outcome=$3')&&JSON.parse(args[2]).state==='SEND_STARTED')stage='marker';
 if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\',outcome=$4'))stage='completion';
 if(fault?.mode==='authority-expiry-clock'&&sql.startsWith('SELECT id FROM public."AuditLog"')&&sql.includes('ORDER BY id LIMIT 1001')&&args[1]===fault.workerId)finalAuthorityClock=true;
 if(sql==='SELECT clock_timestamp() AS now'&&finalAuthorityClock&&fault?.mode==='authority-expiry-clock'){fault=null;await c.query('SELECT pg_sleep(0.35)');}
 if(sql==='COMMIT'&&stage==='completion'&&fault?.mode==='completion-rollback'){fault=null;throw Error('SYNTHETIC_COMPLETION_COMMIT_REJECTED');}
 const result=await c.query(rewrite(sql),args);
 if(sql==='COMMIT'&&fault?.mode===stage+'-ack-lost'){fault=null;throw Error('SYNTHETIC_COMMITTED_ACK_LOST');}
 return result;
}};};
const session=t=>({authenticated:true,verification:'clerk-production-jwt',userId:t.ownerUserId,organizationId:t.clerkOrganizationId,organizationRole:'org:admin'});
const consentChoice={confirmed:true,noticeVersion:PARTICIPANT_ONBOARDING_NOTICE_VERSION,noticeSha256:PARTICIPANT_ONBOARDING_NOTICE_SHA256};
const worker=async id=>(await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[id])).rows[0];
const envelope=async id=>(await query(`SELECT * FROM "WebhookEvent" WHERE provider='meta-customer-outbound-v1' AND payload->>'workerId'=$1`,[id])).rows[0]||null;
const challengeCount=async id=>(await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[id])).rows[0].n;
const postsFor=id=>posts.filter(p=>p.workerId===id);
const mutateWorker=async(id,run)=>{const w=await worker(id),m=structuredClone(w.metadata);run(m,w);await query(`UPDATE "Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[id,JSON.stringify(m)]);};
async function check(name,run){await run();checks.push(name);console.log(JSON.stringify({group:checks.length,status:'PASS',name}));}
try{
 assertStableSource();await admin.connect();
 const boundary=(await admin.query('SELECT current_database() AS database,session_user AS actor')).rows[0];assert.equal(boundary.database,'obrasaas_cutover_ci');assert.equal(boundary.actor,'cutover_test');
 await admin.query('CREATE SCHEMA '+quoted);created=true;
 pool=trackDisposablePool(new Pool({connectionString:url.href,max:8,options:'-c search_path='+schema}));await query(lifecycleSchema);
 await query(`CREATE TYPE "SubscriptionPlan" AS ENUM('TRIAL','PRO','ENTERPRISE');CREATE TYPE "SubscriptionStatus" AS ENUM('TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED');ALTER TABLE "Organization" ADD COLUMN "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'PRO',ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE'`);
 for(const t of tenants){
  await query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata,"subscriptionPlan","subscriptionStatus","trialEndsAt") VALUES($1,$2,$3,'{}','PRO','ACTIVE',NULL)`,[t.organizationId,'Synthetic company '+t.key,t.clerkOrganizationId]);
  await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[t.ownerId,t.ownerUserId,'owner-'+t.key+'@example.invalid']);
  await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['owner-member-'+t.key,t.ownerId,t.organizationId]);
  for(const id of [t.anchorProjectId,t.projectId])await query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{}')`,[id,t.organizationId,'Synthetic '+id]);
  const metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:t.organizationId,customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:t.ownerId},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null},companyRoutingVersion:1};
  const definition=buildCustomerTemplate({id:t.channelId,projectId:t.anchorProjectId,whatsappBusinessId:t.wabaId,phoneNumberId:t.phoneNumberId,metadata},'participant_onboarding_v1'),providerId=t.key==='a'?'140000011':'140000012';
  metadata.customerTemplateDrafts={participant_onboarding_v1:{state:'SUBMITTED',providerStatus:'APPROVED',providerCategory:'UTILITY',definition,providerId,observationRevision:1}};
  await query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6::jsonb)`,[t.channelId,t.anchorProjectId,t.phoneNumberId,t.wabaId,encryptCustomerSecret(t.token,{organizationId:t.organizationId,projectId:t.anchorProjectId,purpose:'access-token',resourceId:t.phoneNumberId},environment),JSON.stringify(metadata)]);
  assets.set(t.key,{...t,definition,providerId,lookupMode:'approved',sendMode:'accepted',lookups:0,beforeLookup:async()=>{}});
 }
 await query(COMPANY_CHANNEL_SCHEMA_SQL);
 for(const t of tenants){await query(`UPDATE "WhatsAppCompanyChannel" SET mode='COMPANY',revision=2 WHERE "connectionId"=$1`,[t.channelId]);await query(`INSERT INTO "WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) VALUES($1,$2,$3,'ACTIVE')`,[t.channelId,t.organizationId,t.projectId]);}
 const catalog=await connect();try{const fingerprint=await companyChannelCatalogFingerprint(catalog);await catalog.query(`INSERT INTO public."WhatsAppCompanySchema" VALUES(1,1,$1,$2)`,[COMPANY_CHANNEL_SCHEMA_CONTRACT,fingerprint]);assert.equal(await companyChannelSchemaReady(catalog),true);}finally{catalog.release();}
 const workspace=createWorkspaceStore({connect}),identity=createParticipantIdentityProvider({client:clerk.client,environment:()=>environment}),participant=createParticipantStore({workspace,connect,identity,prepareKycChat:prepareMetaKycChallenge,environment});
 const command=async(t,action,payload)=>({scope:(await workspace.list(session(t))).scope,projectId:t.projectId,operationId:randomUUID(),action,payload});
 async function enrol(t,label,{consent=true,email=null}={}){
  sequence++;const id='delivery-worker-'+label,phone='+'+(t.key==='a'?'549110001':'549110002')+String(sequence).padStart(4,'0');
  await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata) VALUES($1,$2,$3,$4,'WORKER',$5::jsonb)`,[id,t.projectId,'Synthetic '+label,phone,JSON.stringify({siteRegister:{version:1,job:'WORKER'}})]);
  const input=await command(t,'INVITE',{workerId:id,revision:(await worker(id)).revision,email:email||label+'@example.invalid',...(consent?{whatsAppConsent:consentChoice}:{})});
  const result=await participant.save(session(t),input);assert.equal(result.saved,true);
  const w=await worker(id);assert.equal(w.metadata.participant.invitation.state,'SENT');assert.equal(w.metadata.participant.status,'INVITED');assert.equal(w.metadata.participant.clerkUserId,null);
  if(consent)assert.equal(w.metadata.participant.onboardingDelivery.state,'WAITING_CONFIGURATION');
  return {workerId:id,projectId:t.projectId,tenant:t,input};
 }
 const provider=createMetaCustomerProvider({environment,fetchImpl:async(input,options={})=>{
  try{
   const graphUrl=new URL(input),asset=[...assets.values()].find(t=>options.headers?.Authorization==='Bearer '+t.token);assert.ok(asset,'CONTROLLED_BEARER_REQUIRED');
   assert.equal(graphUrl.protocol,'https:');assert.equal(graphUrl.hostname,'graph.facebook.com');assert.equal(graphUrl.username,'');assert.equal(graphUrl.password,'');assert.equal(graphUrl.port,'');assert.equal(options.redirect,'error');
   assert.equal(graphUrl.searchParams.get('appsecret_proof'),createHmac('sha256',environment.META_APP_SECRET).update(asset.token).digest('hex'));
   if(graphUrl.pathname==='/v25.0/'+asset.wabaId+'/message_templates'){
    assert.equal(options.method,'GET');assert.equal(graphUrl.searchParams.get('name'),asset.definition.name);asset.lookups++;await asset.beforeLookup(asset);
    return Response.json({data:asset.lookupMode==='missing'?[]:[{...asset.definition,id:asset.providerId,status:asset.lookupMode==='approved'?'APPROVED':asset.lookupMode==='changed'?'APPROVED':'PENDING',category:'UTILITY',...(asset.lookupMode==='changed'?{components:[{type:'BODY',text:'Synthetic unauthorized content {{1}}'}]}:{})}]});
   }
   assert.equal(graphUrl.pathname,'/v25.0/'+asset.phoneNumberId+'/messages');assert.equal(options.method,'POST');const body=JSON.parse(options.body);
   assert.equal(body.messaging_product,'whatsapp');assert.equal(body.type,'template');assert.equal(body.template.name,asset.definition.name);assert.equal(body.template.language.code,'es_AR');assert.equal(body.context,undefined);
   const e=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[body.biz_opaque_callback_data])).rows[0];assert.ok(e);assert.equal(e.projectId,asset.anchorProjectId);assert.equal(e.outcome.state,'SEND_STARTED');assert.equal(e.attempts,1);
   const w=await worker(e.payload.workerId);assert.equal(body.to,w.phone.slice(1));assert.equal(body.template.components[0].parameters[1].text,'https://obrasaas.com/cuenta?participar='+w.metadata.participant.invitation.id);assert.equal(metaKycChallengeDigest(body.template.components[0].parameters[2].text),w.metadata.participant.kycChatChallenge.codeDigest);
   const messageId='wamid.ControlledOnboardingDelivery_'+(posts.length+1);posts.push({workerId:w.id,asset:asset.key,correlationId:e.id,messageId,body});
   if(asset.sendMode==='timeout')throw Error('SYNTHETIC_PROVIDER_ACCEPTED_RESPONSE_LOST');
   if(asset.sendMode==='reject')return Response.json({error:{code:100,message:'Synthetic rejected request'}},{status:400});
   return Response.json({messages:[{id:asset.sendMode==='invalid'?'invalid-provider-ack':messageId}]});
  }catch(error){if(error.message!=='SYNTHETIC_PROVIDER_ACCEPTED_RESPONSE_LOST')unexpected.push({code:'CONTROLLED_GRAPH_ASSERTION_FAILED',message:error.message});throw error;}
 }});
 const make=options=>createParticipantOnboardingDelivery({connect,provider,environment,...options}),service=make();
 const authority=async(ref,expected=null)=>customerJobTransaction(connect,async client=>{const w=await worker(ref.workerId);return resolveParticipantOnboardingAuthority(client,participantOnboardingIntent(w.metadata.participant.onboardingDelivery),{environment,expected});});
 const assertUnprepared=async ref=>{assert.equal((await worker(ref.workerId)).metadata.participant.kycChatChallenge,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(await envelope(ref.workerId),null);assert.equal(postsFor(ref.workerId).length,0);};
 await check('canonical-INVITE-consent-receipt-does-not-create-account-KYC-or-operational-permission',async()=>{
  const ref=await enrol(a,'intent');const w=await worker(ref.workerId),i=participantOnboardingIntent(w.metadata.participant.onboardingDelivery),r=await authority(ref);
  assert.equal(r.member.actorId,a.ownerId);assert.equal(r.connection.projectId,a.anchorProjectId);assert.equal(r.project.id,a.projectId);assert.equal(r.entitlement.basis,'ACTIVE_PAID_PLAN');assert.equal(i.targetProjectId,a.projectId);
  assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE id=$1 AND action='participant.onboarding.contact_authorized'`,[i.consentReceiptId])).rows[0].n,1);await assertUnprepared(ref);
  assert.deepEqual(w.metadata.participant.permissions,{attendance:false,report:false});assert.equal((await query(`SELECT count(*)::int AS n FROM "TenantMembership"`)).rows[0].n,2);
 });
 let sentRef;
 await check('real-prepare-and-encrypted-anchor-outbox-atomic-success-preserves-target-and-private-navigation',async()=>{
  sentRef=await enrol(a,'sent');const result=await service.process(sentRef);assert.equal(result.state,'SENT');assert.equal(result.providerAccepted,true);assert.equal(result.deliveryConfirmed,false);assert.equal(result.automaticResendAllowed,false);
  const w=await worker(sentRef.workerId),e=await envelope(w.id),challenge=w.metadata.participant.kycChatChallenge;
  assert.equal(challenge.status,'PENDING');assert.equal(await challengeCount(w.id),1);assert.equal(e.projectId,a.anchorProjectId);assert.equal(e.payload.targetProjectId,a.projectId);assert.equal(e.attempts,1);
  const request=JSON.parse(decryptCustomerSecret(e.payload.encryptedPayload,{organizationId:a.organizationId,projectId:a.anchorProjectId,purpose:'outbound',resourceId:e.id},environment));
  assert.equal(request.challengeId,challenge.id);assert.equal(metaKycChallengeDigest(request.message.bodyParameters[2]),challenge.codeDigest);assert.equal(e.payload.requestDigest,sha(Buffer.from(JSON.stringify(request))));
  assert.throws(()=>decryptCustomerSecret(e.payload.encryptedPayload,{organizationId:a.organizationId,projectId:a.projectId,purpose:'outbound',resourceId:e.id},environment));
  assert.throws(()=>decryptCustomerSecret(e.payload.encryptedPayload,{organizationId:b.organizationId,projectId:a.anchorProjectId,purpose:'outbound',resourceId:e.id},environment));
  for(const value of [JSON.stringify(w.metadata),JSON.stringify(e),JSON.stringify(result)])assert.equal(value.includes(request.message.bodyParameters[2]),false);
  const exterior=(await query(`SELECT metadata FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.operation.recorded' AND metadata->>'kind'='PREPARE_KYC_CHAT'`,[w.id])).rows;assert.equal(exterior.length,1);assert.equal(exterior[0].metadata.expiresAt,challenge.expiresAt);
  await service.process(sentRef);assert.equal(postsFor(w.id).length,1);assert.equal(await challengeCount(w.id),1);
 });
 await check('outbox-insert-failure-rolls-back-real-challenge-and-both-receipts-before-safe-retry',async()=>{
  const ref=await enrol(a,'rollback');fault={mode:'reserve-rollback',workerId:ref.workerId};assert.equal((await service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);
  assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='PREPARE_KYC_CHAT'`,[ref.workerId])).rows[0].n,0);
  assert.equal((await service.process(ref)).state,'SENT');assert.equal(postsFor(ref.workerId).length,1);assert.equal(await challengeCount(ref.workerId),1);
 });
 await check('predispatch-crash-reuses-one-real-PENDING-challenge-and-same-sealed-envelope',async()=>{
  const ref=await enrol(a,'prepare-crash');let first=true;const s=make({afterPrepare:async()=>{if(first){first=false;throw Error('SYNTHETIC_CRASH_BEFORE_MARKER');}}});
  assert.equal((await s.process(ref)).state,'BLOCKED');const initial=await envelope(ref.workerId),c=structuredClone((await worker(ref.workerId)).metadata.participant.kycChatChallenge);
  assert.equal(initial.outcome.state,'ONBOARDING_PENDING');assert.equal(initial.attempts,0);assert.equal(postsFor(ref.workerId).length,0);
  assert.equal((await s.process(ref)).state,'SENT');assert.equal((await envelope(ref.workerId)).payload.encryptedPayload,initial.payload.encryptedPayload);assert.deepEqual((await worker(ref.workerId)).metadata.participant.kycChatChallenge,c);assert.equal(await challengeCount(ref.workerId),1);assert.equal(postsFor(ref.workerId).length,1);
 });
 await check('three-concurrent-canonical-processors-commit-one-challenge-envelope-and-provider-POST',async()=>{
  const ref=await enrol(a,'concurrent');await Promise.all([service.process(ref),service.process(ref),service.process(ref)]);
  assert.equal(await challengeCount(ref.workerId),1);assert.equal(postsFor(ref.workerId).length,1);assert.equal((await envelope(ref.workerId)).outcome.state,'SENT');assert.equal((await envelope(ref.workerId)).attempts,1);
 });
 await check('crash-after-committed-SEND_STARTED-marker-is-never-automatically-submitted',async()=>{
  const ref=await enrol(a,'marker-crash'),s=make({afterDispatchMarker:async()=>{throw Error('SYNTHETIC_CRASH_AFTER_MARKER');}});
  assert.equal((await s.process(ref)).state,'SEND_STARTED');assert.equal((await envelope(ref.workerId)).outcome.state,'SEND_STARTED');await service.process(ref);assert.equal(postsFor(ref.workerId).length,0);assert.equal((await envelope(ref.workerId)).attempts,1);
 });
 await check('lost-real-marker-COMMIT-ACK-retains-attempt-and-prevents-first-or-duplicate-POST',async()=>{
  const ref=await enrol(a,'marker-ack');fault={mode:'marker-ack-lost'};assert.equal((await service.process(ref)).state,'SEND_STARTED');await service.process(ref);assert.equal(postsFor(ref.workerId).length,0);assert.equal((await envelope(ref.workerId)).attempts,1);
 });
 for(const [mode,state] of [['timeout','SEND_UNKNOWN'],['invalid','SEND_UNKNOWN'],['reject','REJECTED']])await check('controlled-provider-'+mode+'-never-implies-delivery-or-automatic-resend',async()=>{
  const ref=await enrol(a,'provider-'+mode);assets.get('a').sendMode=mode;try{const r=await service.process(ref);assert.equal(r.state,state);assert.equal(r.providerAccepted,false);assert.equal(r.deliveryConfirmed,false);await service.process(ref);assert.equal(postsFor(ref.workerId).length,1);assert.equal((await envelope(ref.workerId)).attempts,1);}finally{assets.get('a').sendMode='accepted';}
 });
 await check('lost-completion-COMMIT-ACK-recovers-the-committed-SENT-row-without-rePOST',async()=>{
  const ref=await enrol(a,'completion-ack');fault={mode:'completion-ack-lost'};assert.equal((await service.process(ref)).state,'SENT');await service.process(ref);assert.equal(postsFor(ref.workerId).length,1);assert.equal((await envelope(ref.workerId)).outcome.state,'SENT');
 });
 await check('completion-commit-rejection-after-provider-acceptance-retains-uncertain-marker-and-no-rePOST',async()=>{
  const ref=await enrol(a,'completion-rollback');fault={mode:'completion-rollback'};assert.equal((await service.process(ref)).state,'SEND_STARTED');assert.equal((await envelope(ref.workerId)).outcome.state,'SEND_STARTED');await service.process(ref);assert.equal(postsFor(ref.workerId).length,1);
 });
 await check('manager-contact-revocation-after-prepare-cancels-pending-job-and-preserves-original-challenge',async()=>{
  const ref=await enrol(a,'consent-revoke'),s=make({afterPrepare:async()=>participant.save(session(a),await command(a,'REVOKE_ONBOARDING_CONTACT',{workerId:ref.workerId,revision:(await worker(ref.workerId)).revision}))});
  assert.equal((await s.process(ref)).state,'CANCELED');const c=structuredClone((await worker(ref.workerId)).metadata.participant.kycChatChallenge);assert.equal((await envelope(ref.workerId)).outcome.state,'ONBOARDING_PENDING');await service.process(ref);assert.equal(postsFor(ref.workerId).length,0);assert.deepEqual((await worker(ref.workerId)).metadata.participant.kycChatChallenge,c);
 });
 await check('contact-revocation-after-marker-stops-POST-and-never-reopens-committed-attempt',async()=>{
  const ref=await enrol(a,'post-marker-revoke'),s=make({afterDispatchMarker:async()=>participant.save(session(a),await command(a,'REVOKE_ONBOARDING_CONTACT',{workerId:ref.workerId,revision:(await worker(ref.workerId)).revision}))});
  assert.equal((await s.process(ref)).state,'SEND_STARTED');await service.process(ref);assert.equal(postsFor(ref.workerId).length,0);assert.equal((await envelope(ref.workerId)).outcome.state,'SEND_STARTED');
 });
 await check('consent-receipt-tampering-and-missing-INVITATION_SENT-proof-fail-canonical-authority',async()=>{
  const ref=await enrol(a,'receipt-tamper'),w=await worker(ref.workerId),i=participantOnboardingIntent(w.metadata.participant.onboardingDelivery);
  const receipt=(await query(`SELECT metadata FROM "AuditLog" WHERE id=$1`,[i.consentReceiptId])).rows[0];await query(`UPDATE "AuditLog" SET metadata=jsonb_set(metadata,'{projectId}',to_jsonb($2::text)) WHERE id=$1`,[i.consentReceiptId,b.projectId]);
  await assert.rejects(authority(ref),{code:'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'});assert.equal((await service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);
  await query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[i.consentReceiptId,JSON.stringify(receipt.metadata)]);
  const sent=(await query(`DELETE FROM "AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='INVITATION_SENT' RETURNING *`,[ref.workerId])).rows[0];assert.ok(sent);await assert.rejects(authority(ref),{code:'PARTICIPANT_ONBOARDING_INVITATION_REQUIRED'});await assertUnprepared(ref);
 });
 await check('expired-trial-and-commercial-suspension-block-before-any-challenge-or-envelope',async()=>{
  const ref=await enrol(a,'expired-trial');await query(`UPDATE "Organization" SET "subscriptionPlan"='TRIAL',"subscriptionStatus"='TRIALING',"trialEndsAt"=clock_timestamp()-interval '1 minute' WHERE id=$1`,[a.organizationId]);
  await assert.rejects(authority(ref),{code:'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'});assert.equal((await service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);
  await query(`UPDATE "Organization" SET "subscriptionPlan"='PRO',"subscriptionStatus"='SUSPENDED' WHERE id=$1`,[a.organizationId]);await assert.rejects(authority(ref),{code:'COMPANY_ENTITLEMENT_SUSPENDED'});await assertUnprepared(ref);
  await query(`UPDATE "Organization" SET "subscriptionPlan"='PRO',"subscriptionStatus"='ACTIVE',"trialEndsAt"=NULL WHERE id=$1`,[a.organizationId]);assert.equal((await service.process(ref)).state,'SENT');
 });
 await check('current-trial-admits-onboarding-but-expiry-between-prepare-and-send-blocks-with-sealed-queue-preserved',async()=>{
  await query(`UPDATE "Organization" SET "subscriptionPlan"='TRIAL',"subscriptionStatus"='TRIALING',"trialEndsAt"=clock_timestamp()+interval '1 day' WHERE id=$1`,[a.organizationId]);const ref=await enrol(a,'trial-transition');assert.equal((await authority(ref)).entitlement.basis,'CURRENT_TRIAL');
  const s=make({afterPrepare:async()=>query(`UPDATE "Organization" SET "trialEndsAt"=clock_timestamp()-interval '1 minute' WHERE id=$1`,[a.organizationId])});assert.equal((await s.process(ref)).state,'BLOCKED');assert.equal(postsFor(ref.workerId).length,0);assert.equal((await envelope(ref.workerId)).outcome.state,'ONBOARDING_PENDING');assert.equal(await challengeCount(ref.workerId),1);
  await query(`UPDATE "Organization" SET "subscriptionPlan"='PRO',"subscriptionStatus"='ACTIVE',"trialEndsAt"=NULL WHERE id=$1`,[a.organizationId]);
 });
 await check('trial-expiring-during-locked-authority-reads-is-denied-by-the-final-real-DB-clock',async()=>{
  const ref=await enrol(a,'trial-final-clock');await query(`UPDATE "Organization" SET "subscriptionPlan"='TRIAL',"subscriptionStatus"='TRIALING',"trialEndsAt"=clock_timestamp()+interval '200 milliseconds' WHERE id=$1`,[a.organizationId]);fault={mode:'authority-expiry-clock',workerId:ref.workerId};
  await assert.rejects(authority(ref),{code:'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'});assert.equal(fault,null);await assertUnprepared(ref);await query(`UPDATE "Organization" SET "subscriptionPlan"='PRO',"subscriptionStatus"='ACTIVE',"trialEndsAt"=NULL WHERE id=$1`,[a.organizationId]);
 });
 await check('unapproved-or-changed-owned-remote-template-stops-before-prepare',async()=>{
  for(const mode of ['pending','changed','missing']){const ref=await enrol(a,'template-'+mode);assets.get('a').lookupMode=mode;try{assert.equal((await service.process(ref)).code,'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');await assertUnprepared(ref);}finally{assets.get('a').lookupMode='approved';}}
 });
 await check('template-approval-revoked-after-prepare-blocks-POST-with-original-code-and-zero-attempts',async()=>{
  const ref=await enrol(a,'template-after'),s=make({afterPrepare:async()=>{assets.get('a').lookupMode='pending';}});try{assert.equal((await s.process(ref)).state,'BLOCKED');assert.equal(postsFor(ref.workerId).length,0);assert.equal((await envelope(ref.workerId)).attempts,0);assert.equal(await challengeCount(ref.workerId),1);}finally{assets.get('a').lookupMode='approved';}
 });
 await check('channel-grant-revocation-after-prepare-preserves-sealed-queue-and-stops-provider-submission',async()=>{
  const ref=await enrol(a,'channel-revoked'),s=make({afterPrepare:async()=>query(`UPDATE "WhatsAppConnection" SET enabled=false WHERE id=$1`,[a.channelId])});try{assert.equal((await s.process(ref)).state,'BLOCKED');assert.equal((await envelope(ref.workerId)).attempts,0);assert.equal(postsFor(ref.workerId).length,0);assert.equal(await challengeCount(ref.workerId),1);}finally{await query(`UPDATE "WhatsAppConnection" SET enabled=true WHERE id=$1`,[a.channelId]);}
 });
 await check('expired-original-PENDING-code-is-never-replaced-by-an-automatic-recovery',async()=>{
  const ref=await enrol(a,'challenge-expired'),s=make({afterPrepare:async()=>{await mutateWorker(ref.workerId,m=>{m.participant.kycChatChallenge.expiresAt=new Date(Date.now()-60000).toISOString();});const expiresAt=(await worker(ref.workerId)).metadata.participant.kycChatChallenge.expiresAt;await query(`UPDATE "AuditLog" SET metadata=jsonb_set(metadata,'{expiresAt}',to_jsonb($2::text)) WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[ref.workerId,expiresAt]);}});
  assert.equal((await s.process(ref)).state,'BLOCKED');const original=(await envelope(ref.workerId)).payload.encryptedPayload;await service.process(ref);assert.equal((await envelope(ref.workerId)).payload.encryptedPayload,original);assert.equal(postsFor(ref.workerId).length,0);assert.equal(await challengeCount(ref.workerId),1);
 });
 await check('issuer-role-loss-and-revoked-target-assignment-stop-canonical-authority-without-anchor-fallback',async()=>{
  const ref=await enrol(a,'authority-loss');await query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR' WHERE id=$1`,['owner-member-a']);await assert.rejects(authority(ref),{code:'PARTICIPANT_MANAGE_REQUIRED'});await assertUnprepared(ref);await query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE id=$1`,['owner-member-a']);
  await query(`UPDATE "WhatsAppChannelProjectAssignment" SET status='REVOKED',revision=revision+1 WHERE "connectionId"=$1 AND "projectId"=$2`,[a.channelId,a.projectId]);await assert.rejects(authority(ref));assert.equal((await service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);await query(`UPDATE "WhatsAppChannelProjectAssignment" SET status='ACTIVE',revision=revision+1 WHERE "connectionId"=$1 AND "projectId"=$2`,[a.channelId,a.projectId]);
 });
 await check('two-company-concurrent-delivery-keeps-independent-issuer-channel-target-code-and-ciphertext-AAD',async()=>{
  const refs=[await enrol(a,'isolation-a'),await enrol(b,'isolation-b')];await Promise.all(refs.map(ref=>service.process(ref)));
  for(const ref of refs){const w=await worker(ref.workerId),e=await envelope(ref.workerId),t=ref.tenant;assert.equal(e.outcome.state,'SENT');assert.equal(e.projectId,t.anchorProjectId);assert.equal(e.payload.organizationId,t.organizationId);assert.equal(e.payload.targetProjectId,t.projectId);assert.equal(postsFor(ref.workerId).length,1);assert.equal(postsFor(ref.workerId)[0].asset,t.key);}
  const intent=participantOnboardingIntent((await worker(refs[0].workerId)).metadata.participant.onboardingDelivery);await assert.rejects(customerJobTransaction(connect,c=>resolveParticipantOnboardingAuthority(c,{...intent,organizationId:b.organizationId},{environment})),{code:'PARTICIPANT_ONBOARDING_PRINCIPAL_REQUIRED'});
  assert.notEqual((await worker(refs[0].workerId)).metadata.participant.kycChatChallenge.codeDigest,(await worker(refs[1].workerId)).metadata.participant.kycChatChallenge.codeDigest);
 });
 await check('same-phone-in-another-active-company-worksite-is-ambiguous-and-cannot-mint-a-challenge',async()=>{
  const ref=await enrol(a,'duplicate'),w=await worker(ref.workerId);await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata) VALUES('delivery-duplicate-anchor',$1,'Synthetic duplicate',$2,'WORKER',$3::jsonb)`,[a.anchorProjectId,w.phone,JSON.stringify(w.metadata)]);await assert.rejects(authority(ref),{code:'PARTICIPANT_ONBOARDING_RECIPIENT_AMBIGUOUS'});assert.equal((await service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);await query(`DELETE FROM "Worker" WHERE id='delivery-duplicate-anchor'`);
 });
 await check('canonical-Clerk-invitation-acceptance-binds-untouched-PENDING-challenge-and-records-exterior-receipt',async()=>{
  const ref=await enrol(a,'accepted',{email:a.workerEmail});assert.equal((await service.process(ref)).state,'SENT');const before=await worker(ref.workerId),c=structuredClone(before.metadata.participant.kycChatChallenge),invitationId=before.metadata.participant.invitation.id;
  clerk.invitations.get(invitationId).status='accepted';const own={authenticated:true,verification:'clerk-production-jwt',userId:a.workerUserId,organizationId:a.clerkOrganizationId,organizationRole:'org:member'};
  const joined=await participant.join(own,{invitationId,operationId:randomUUID()},{accept:true});assert.equal(joined.saved,true);const after=await worker(ref.workerId),bound=after.metadata.participant.kycChatChallenge;
  assert.equal(after.metadata.participant.status,'ACTIVE');assert.equal(after.metadata.participant.invitation.state,'ACCEPTED');assert.equal(after.metadata.participant.clerkUserId,a.workerUserId);assert.equal(bound.status,'PENDING');assert.equal(bound.id,c.id);assert.equal(bound.codeDigest,c.codeDigest);assert.equal(bound.expiresAt,c.expiresAt);assert.equal(bound.participantClerkUserId,a.workerUserId);
  // This direct roster fixture uses the canonical JOIN permission defaults;
  // WhatsApp delivery itself left all invitation permissions false above.
  assert.deepEqual(after.metadata.participant.permissions,{attendance:true,report:true});assert.equal(after.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal(after.metadata.participant.channelIdentity,undefined);
  assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.account_bound'`,[ref.workerId])).rows[0].n,1);assert.equal((await query(`SELECT count(*)::int AS n FROM "ProjectMembership" pm JOIN "TenantMembership" tm ON tm.id=pm."tenantMembershipId" WHERE pm."projectId"=$1 AND tm."organizationId"=$2 AND tm."clerkRole"='org:member'`,[a.projectId,a.organizationId])).rows[0].n,1);await service.process(ref);assert.equal(postsFor(ref.workerId).length,1);
 });
 const outbound=createMetaCustomerOutbound({connect,resolveIdentity:async()=>{throw Error('STATUS_MUST_NOT_GRANT_PARTICIPANT_AUTHORITY');},provider,environment}),processor=createMetaCustomerProcessor({connect,environment,dispatch:async()=>null,outbound}),callback=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect,environment}),environment,schedule:()=>{}});
 async function status(ref,{signed=true,recipient=null,id=null,assetKey=ref.tenant.key,status='delivered'}={}){
  const asset=assets.get(assetKey),e=await envelope(ref.workerId),sent=postsFor(ref.workerId)[0];const value={id:id||sent?.messageId||'wamid.ControlledUnsentStatus_123',status,timestamp:String(Math.floor(Date.now()/1000)),recipient_id:recipient||(await worker(ref.workerId)).phone.slice(1),biz_opaque_callback_data:e.id};
  const body={object:'whatsapp_business_account',entry:[{id:asset.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:asset.phoneNumberId},statuses:[value]}}]}]},bytes=Buffer.from(JSON.stringify(body));
  const response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'content-type':'application/json',...(signed?{'x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex')}:{})},body:bytes}));assert.equal(response.status,signed?200:403);if(!signed)return null;assert.equal((await response.json()).durable,true);
  return processor.process('customer_webhook_'+splitMetaCustomerEvents(body)[0].externalId);
 }
 await check('unsigned-and-cross-company-statuses-cannot-confirm-delivery-or-project-foreign-outbox',async()=>{
  await status(sentRef,{signed:false});assert.equal((await envelope(sentRef.workerId)).outcome.state,'SENT');await status(sentRef,{assetKey:'b'});assert.equal((await envelope(sentRef.workerId)).outcome.state,'SENT');
  const w=await worker(sentRef.workerId),foreignProjection=[structuredClone(w)];foreignProjection[0].metadata.participant.onboardingDelivery.outboundId=participantOnboardingOutboundId(participantOnboardingIntent(w.metadata.participant.onboardingDelivery));await customerJobTransaction(connect,c=>readParticipantOnboardingStatuses(c,foreignProjection,b.organizationId,b.projectId));assert.equal(publicParticipantOnboarding(foreignProjection[0].metadata.participant).deliveryConfirmed,false);
 });
 await check('signed-owned-delivery-status-is-correlated-in-real-outbox-and-safely-projected-to-target-only',async()=>{
  await status(sentRef);assert.equal((await envelope(sentRef.workerId)).outcome.state,'STATUS_OBSERVED');assert.equal((await envelope(sentRef.workerId)).outcome.providerStatus,'delivered');
  const rows=[await worker(sentRef.workerId)];await customerJobTransaction(connect,c=>readParticipantOnboardingStatuses(c,rows,a.organizationId,a.projectId));const view=publicParticipantOnboarding(rows[0].metadata.participant);assert.equal(view.deliveryConfirmed,true);assert.equal(view.providerAccepted,true);assert.equal(view.automaticResendAllowed,false);await service.process(sentRef);assert.equal(postsFor(sentRef.workerId).length,1);
 });
 await check('signed-status-before-dispatch-marker-cannot-consume-or-confirm-unsent-envelope',async()=>{
  const ref=await enrol(a,'status-before'),s=make({afterPrepare:async()=>{throw Error('SYNTHETIC_PAUSE_FOR_STATUS');}});await s.process(ref);assert.equal((await envelope(ref.workerId)).outcome.state,'ONBOARDING_PENDING');await status(ref);assert.equal((await envelope(ref.workerId)).outcome.state,'ONBOARDING_PENDING');assert.equal(postsFor(ref.workerId).length,0);
 });
 await check('no-consent-and-closed-transport-create-neither-KYC-challenge-nor-outbox',async()=>{
  const noConsent=await enrol(b,'without-consent',{consent:false});assert.equal((await service.process(noConsent)).state,'NOT_REQUESTED');await assertUnprepared(noConsent);
  const ref=await enrol(b,'closed-provider'),closed=make({provider:{...provider,readiness:()=>({canUseCustomerTransport:false})}});assert.equal((await closed.process(ref)).code,'PARTICIPANT_ONBOARDING_PROVIDER_CLOSED');await assertUnprepared(ref);
 });
 await check('recovery-budget-floor-and-public-read-have-no-provider-or-business-side-effects',async()=>{
  const before=posts.length;assert.deepEqual(await service.recover({budgetMs:0}),{checked:0,results:[],deferred:true});assert.equal(posts.length,before);
  const current=await workspace.list(session(a)),view=await participant.read(session(a),{scope:current.scope,projectId:a.projectId});const serialized=JSON.stringify(view);
  for(const secret of ['IDENTIDAD ',a.token,b.token,'encryptedPayload','encryptedAccessToken','codeDigest','issuerAuthorityDigest','onboarding_contact_'])assert.equal(serialized.includes(secret),false,'PUBLIC_ONBOARDING_SECRET: '+secret);
  for(const table of ['Task','AttendanceEntry','OperationalProposal','WhatsAppCompanyEventRoute','WhatsAppCompanyRoute'])assert.equal((await query('SELECT count(*)::int AS n FROM "'+table+'"')).rows[0].n,0);
  assert.equal(networkCalls,0);assert.deepEqual(unexpected,[]);assertStableSource();
 });
 passed=true;
}finally{
 try{await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_onboarding_delivery_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');assert.equal((await admin.query('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) AS present',[schema])).rows[0].present,false);schemaRemoved=true;}}finally{try{await admin.end();}finally{globalThis.fetch=originalFetch;}}
}
assert.equal(passed,true);assert.equal(schemaRemoved,true);assert.equal(networkCalls,0);assertStableSource();
const proof={status:'PASS',checkedAt:new Date().toISOString(),environment:'random-schema-existing-disposable-localhost-postgresql',checks,checkCount:checks.length,sourceManifest,harnessSha256,...initialSourceState,databaseCreated:false,schemaRemoved,controlledProviderPosts:posts.length,controlledProviderLookups:[...assets.values()].reduce((n,t)=>n+t.lookups,0),realProviderRequests:0,unexpectedNetworkCalls:networkCalls,productionDataWritten:false,realClerkLogin:false,realMetaAccepted:false,physicalPilotAccepted:false,coverageBoundary:'real canonical SQL and actual signed callbacks; controlled Clerk/Graph fixtures only'};
mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({status:proof.status,groups:proof.checkCount,output,schemaRemoved,realProviderRequests:0,productionDataWritten:false}));
