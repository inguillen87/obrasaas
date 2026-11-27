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
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256,participantOnboardingIntent,participantOnboardingPhaseOutboundId,participantOnboardingPhaseState,publicParticipantOnboarding} from '../src/lib/participant-onboarding-policy.mjs';
import {buildCustomerTemplate} from '../src/lib/meta-customer-templates.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerOutbound,customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {createMetaCustomerCallbackHandlers,createMetaCustomerInbox,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {ownCompanyFixture} from '../tests/fixtures/own-company-meta.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant,revokeOwnCompanyRuntimeGrant} from '../src/lib/meta-own-company-policy.mjs';
import {readOwnParticipantOnboardingAuthority} from '../src/lib/participant-onboarding-authority.mjs';
import {digest as ownDigest} from '../src/lib/workspace-policy.mjs';

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
sourceManifest.push({path:'tests/fixtures/own-company-meta.mjs',sha256:sha(readFileSync('tests/fixtures/own-company-meta.mjs'))});
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
const [a,b]=tenants,clerk=createControlledLifecycleClerk(),admin=new Client({connectionString:url.href,connectionTimeoutMillis:5000}),checks=[],assets=new Map(),posts=[],unexpected=[],references=[],controlledAccounts=new Map();
let pool,created=false,schemaRemoved=false,passed=false,networkCalls=0,sequence=0,fault=null;
let ownEvidence=null;
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
const envelope=async(id,phase='IDENTITY_START')=>(await query(`SELECT * FROM "WebhookEvent" WHERE provider='meta-customer-outbound-v1' AND payload->>'workerId'=$1 AND payload->>'onboardingPhase'=$2`,[id,phase])).rows[0]||null;
const challengeCount=async id=>(await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[id])).rows[0].n;
const postsFor=(id,phase='IDENTITY_START')=>posts.filter(p=>p.workerId===id&&p.phase===phase);
const allPostsFor=id=>posts.filter(p=>p.workerId===id);
const mutateWorker=async(id,run)=>{const w=await worker(id),m=structuredClone(w.metadata);run(m,w);await query(`UPDATE "Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[id,JSON.stringify(m)]);};
async function check(name,run){await run();for(const ref of references){const invitation=postsFor(ref.workerId,'ACCOUNT_INVITATION'),identity=postsFor(ref.workerId,'IDENTITY_START');assert.ok(invitation.length<=1);assert.ok(identity.length<=1);assert.equal(allPostsFor(ref.workerId).length,invitation.length+identity.length);if(ref.invitationDelivered)assert.equal(invitation.length,1,'JOIN must never replay the already sent invitation');}checks.push(name);console.log(JSON.stringify({group:checks.length,status:'PASS',name}));}
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
  const connection={id:t.channelId,projectId:t.anchorProjectId,whatsappBusinessId:t.wabaId,phoneNumberId:t.phoneNumberId,metadata},definition=buildCustomerTemplate(connection,'participant_onboarding_v1'),invitationDefinition=buildCustomerTemplate(connection,'participant_invitation'),providerId=t.key==='a'?'140000011':'140000012',invitationProviderId=t.key==='a'?'140000021':'140000022';
  metadata.customerTemplateDrafts={participant_onboarding_v1:{state:'SUBMITTED',providerStatus:'APPROVED',providerCategory:'UTILITY',definition,providerId,observationRevision:1},participant_invitation:{state:'SUBMITTED',providerStatus:'APPROVED',providerCategory:'UTILITY',definition:invitationDefinition,providerId:invitationProviderId,observationRevision:1}};
  await query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6::jsonb)`,[t.channelId,t.anchorProjectId,t.phoneNumberId,t.wabaId,encryptCustomerSecret(t.token,{organizationId:t.organizationId,projectId:t.anchorProjectId,purpose:'access-token',resourceId:t.phoneNumberId},environment),JSON.stringify(metadata)]);
  assets.set(t.key,{...t,definition,providerId,invitationDefinition,invitationProviderId,lookupMode:'approved',sendMode:'accepted',lookups:0,beforeLookup:async()=>{}});
 }
 await query(COMPANY_CHANNEL_SCHEMA_SQL);
 for(const t of tenants){await query(`UPDATE "WhatsAppCompanyChannel" SET mode='COMPANY',revision=2 WHERE "connectionId"=$1`,[t.channelId]);await query(`INSERT INTO "WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) VALUES($1,$2,$3,'ACTIVE')`,[t.channelId,t.organizationId,t.projectId]);}
 const catalog=await connect();try{const fingerprint=await companyChannelCatalogFingerprint(catalog);await catalog.query(`INSERT INTO public."WhatsAppCompanySchema" VALUES(1,1,$1,$2)`,[COMPANY_CHANNEL_SCHEMA_CONTRACT,fingerprint]);assert.equal(await companyChannelSchemaReady(catalog),true);}finally{catalog.release();}
 // Extend only the controlled provider fixture with exact per-invitation accounts;
 // the application identity adapter and canonical JOIN remain real.
 const controlledClient=async()=>{const api=await clerk.client();return {...api,users:{...api.users,getUser:async userId=>{const account=controlledAccounts.get(userId);if(!account)return api.users.getUser(userId);return {id:userId,primaryEmailAddressId:'email_fixture',emailAddresses:[{id:'email_fixture',emailAddress:account.email,verification:{status:'verified'}}]};}},organizations:{...api.organizations,getOrganizationMembershipList:async input=>{const account=controlledAccounts.get(input.userId[0]);if(!account)return api.organizations.getOrganizationMembershipList(input);assert.equal(input.organizationId,account.organizationId);const invitation=clerk.invitations.get(account.invitationId);assert.equal(invitation.status,'accepted');assert.equal(invitation.emailAddress,account.email);return {totalCount:1,data:[{organization:{id:account.organizationId},publicUserData:{userId:input.userId[0]},role:'org:member',publicMetadata:{obrasaasInvitationId:account.invitationId}}]};}}};};
 const workspace=createWorkspaceStore({connect}),identity=createParticipantIdentityProvider({client:controlledClient,environment:()=>environment}),participant=createParticipantStore({workspace,connect,identity,prepareKycChat:prepareMetaKycChallenge,environment});
 const command=async(t,action,payload)=>({scope:(await workspace.list(session(t))).scope,projectId:t.projectId,operationId:randomUUID(),action,payload});
 async function enrol(t,label,{consent=true,email=null,accept=true}={}){
  sequence++;const id='delivery-worker-'+label,phone='+'+(t.key==='a'?'549110001':'549110002')+String(sequence).padStart(4,'0');
  await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata) VALUES($1,$2,$3,$4,'WORKER',$5::jsonb)`,[id,t.projectId,'Synthetic '+label,phone,JSON.stringify({siteRegister:{version:1,job:'WORKER'}})]);
  const input=await command(t,'INVITE',{workerId:id,revision:(await worker(id)).revision,email:email||label+'@example.invalid',...(consent?{whatsAppConsent:consentChoice}:{})});
  const result=await participant.save(session(t),input);assert.equal(result.saved,true);
  const w=await worker(id);assert.equal(w.metadata.participant.invitation.state,'SENT');assert.equal(w.metadata.participant.status,'INVITED');assert.equal(w.metadata.participant.clerkUserId,null);
  if(consent){const d=w.metadata.participant.onboardingDelivery;assert.equal(d.state,'WAITING_CONFIGURATION');assert.equal(d.deliveryVersion,2);assert.equal(d.phase,'ACCOUNT_INVITATION');assert.equal(participantOnboardingPhaseState(d,'IDENTITY_START').state,'WAITING_ACCOUNT_ACCEPTANCE');}
  const ref={workerId:id,projectId:t.projectId,tenant:t,input};references.push(ref);
  if(consent&&accept){assert.equal((await service.process(ref)).state,'SENT');ref.invitationDelivered=true;assert.equal(postsFor(id,'ACCOUNT_INVITATION').length,1);await acceptCurrent(ref);}
  return ref;
 }
 const provider=createMetaCustomerProvider({environment,fetchImpl:async(input,options={})=>{
  try{
   const graphUrl=new URL(input),asset=[...assets.values()].find(t=>options.headers?.Authorization==='Bearer '+t.token);assert.ok(asset,'CONTROLLED_BEARER_REQUIRED');
   assert.equal(graphUrl.protocol,'https:');assert.equal(graphUrl.hostname,'graph.facebook.com');assert.equal(graphUrl.username,'');assert.equal(graphUrl.password,'');assert.equal(graphUrl.port,'');assert.equal(options.redirect,'error');
   assert.equal(graphUrl.searchParams.get('appsecret_proof'),createHmac('sha256',environment.META_APP_SECRET).update(asset.token).digest('hex'));
   if(graphUrl.pathname==='/v25.0/'+asset.wabaId+'/message_templates'){
    assert.equal(options.method,'GET');const name=graphUrl.searchParams.get('name'),invitation=name===asset.invitationDefinition.name;assert.ok(invitation||name===asset.definition.name);const definition=invitation?asset.invitationDefinition:asset.definition,providerId=invitation?asset.invitationProviderId:asset.providerId;asset.lookups++;await asset.beforeLookup(asset);
    return Response.json({data:asset.lookupMode==='missing'?[]:[{...definition,id:providerId,status:asset.lookupMode==='approved'?'APPROVED':asset.lookupMode==='changed'?'APPROVED':'PENDING',category:'UTILITY',...(asset.lookupMode==='changed'?{components:[{type:'BODY',text:'Synthetic unauthorized content {{1}}'}]}:{})}]});
   }
   assert.equal(graphUrl.pathname,'/v25.0/'+asset.phoneNumberId+'/messages');assert.equal(options.method,'POST');const body=JSON.parse(options.body);
   assert.equal(body.messaging_product,'whatsapp');assert.equal(body.type,'template');assert.ok([asset.definition.name,asset.invitationDefinition.name].includes(body.template.name));assert.equal(body.template.language.code,'es_AR');assert.equal(body.context,undefined);
   const e=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[body.biz_opaque_callback_data])).rows[0];assert.ok(e);assert.equal(e.projectId,asset.anchorProjectId);assert.equal(e.outcome.state,'SEND_STARTED');assert.equal(e.attempts,1);
   const w=await worker(e.payload.workerId),phase=e.payload.onboardingPhase,parameters=body.template.components[0].parameters;assert.equal(body.to,w.phone.slice(1));assert.ok(['ACCOUNT_INVITATION','IDENTITY_START'].includes(phase));assert.equal(e.id,participantOnboardingPhaseOutboundId(participantOnboardingIntent(w.metadata.participant.onboardingDelivery),phase));
   if(phase==='ACCOUNT_INVITATION'){assert.equal(body.template.name,asset.invitationDefinition.name);assert.equal(parameters.length,1);assert.equal(parameters[0].text,'Synthetic company '+asset.key);assert.equal(w.metadata.participant.status,'INVITED');assert.equal(w.metadata.participant.clerkUserId,null);assert.equal(w.metadata.participant.kycChatChallenge,undefined);assert.equal(await challengeCount(w.id),0);assert.equal(Object.hasOwn(e.payload,'challengeId'),false);assert.equal(JSON.stringify(body).includes('IDENTIDAD '),false);assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='PREPARE_KYC_CHAT'`,[w.id])).rows[0].n,0);}
   else{assert.equal(body.template.name,asset.definition.name);assert.equal(parameters.length,3);assert.equal(parameters[1].text,'https://obrasaas.com/cuenta?participar='+w.metadata.participant.invitation.id);assert.equal(w.metadata.participant.status,'ACTIVE');assert.equal(w.metadata.participant.invitation.state,'ACCEPTED');assert.equal(w.metadata.participant.kycChatChallenge.analysisConsentVersion,3);assert.equal(w.metadata.participant.kycChatChallenge.participantClerkUserId,w.metadata.participant.clerkUserId);assert.equal(metaKycChallengeDigest(parameters[2].text),w.metadata.participant.kycChatChallenge.codeDigest);assert.equal(postsFor(w.id,'ACCOUNT_INVITATION').length,1);}
   const messageId='wamid.ControlledOnboardingDelivery_'+(posts.length+1);posts.push({workerId:w.id,phase,asset:asset.key,correlationId:e.id,messageId,body});
   if(asset.sendMode==='timeout')throw Error('SYNTHETIC_PROVIDER_ACCEPTED_RESPONSE_LOST');
   if(asset.sendMode==='reject')return Response.json({error:{code:100,message:'Synthetic rejected request'}},{status:400});
   return Response.json({messages:[{id:asset.sendMode==='invalid'?'invalid-provider-ack':messageId}]});
  }catch(error){if(error.message!=='SYNTHETIC_PROVIDER_ACCEPTED_RESPONSE_LOST')unexpected.push({code:'CONTROLLED_GRAPH_ASSERTION_FAILED',message:error.message});throw error;}
 }});
 const make=options=>createParticipantOnboardingDelivery({connect,provider,environment,...options}),service=make();
 async function acceptCurrent(ref){
  const before=await worker(ref.workerId),p=before.metadata.participant,d=p.onboardingDelivery,invitationId=p.invitation.id,userId='user_Delivery'+String(controlledAccounts.size+1);
  assert.equal(p.status,'INVITED');assert.equal(p.kycChatChallenge,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(await envelope(ref.workerId),null);assert.equal(postsFor(ref.workerId).length,0);assert.equal(allPostsFor(ref.workerId).length,1);const invitationEnvelope=await envelope(ref.workerId,'ACCOUNT_INVITATION');assert.equal(invitationEnvelope.outcome.state,'SENT');assert.equal(d.phase,'ACCOUNT_INVITATION');assert.equal(participantOnboardingPhaseState(d,'IDENTITY_START').state,'WAITING_ACCOUNT_ACCEPTANCE');
  controlledAccounts.set(userId,{email:p.invitation.email,organizationId:ref.tenant.clerkOrganizationId,invitationId});clerk.invitations.get(invitationId).status='accepted';const own={authenticated:true,verification:'clerk-production-jwt',userId,organizationId:ref.tenant.clerkOrganizationId,organizationRole:'org:member'},joined=await participant.join(own,{invitationId,operationId:randomUUID()},{accept:true});
  assert.equal(joined.joined,true);assert.deepEqual(joined.onboardingReference,{projectId:ref.projectId,workerId:ref.workerId});const after=await worker(ref.workerId),part=after.metadata.participant;assert.equal(part.status,'ACTIVE');assert.equal(part.clerkUserId,userId);assert.equal(part.invitation.state,'ACCEPTED');assert.equal(part.acceptanceReceiptId,joined.receiptId);assert.equal(part.kycChatChallenge,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(part.onboardingDelivery.phase,'IDENTITY_START');assert.equal(part.onboardingDelivery.state,'WAITING_CONFIGURATION');assert.equal(participantOnboardingPhaseState(part.onboardingDelivery,'ACCOUNT_INVITATION').state,'SENT');assert.equal(participantOnboardingPhaseState(part.onboardingDelivery,'IDENTITY_START').acceptanceReceiptId,joined.receiptId);assert.deepEqual(await envelope(ref.workerId,'ACCOUNT_INVITATION'),invitationEnvelope);assert.equal(allPostsFor(ref.workerId).length,1);ref.userId=userId;ref.acceptanceReceiptId=joined.receiptId;ref.invitationDelivered=true;
 }
 const authority=async(ref,expected=null)=>customerJobTransaction(connect,async client=>{const w=await worker(ref.workerId);return resolveParticipantOnboardingAuthority(client,participantOnboardingIntent(w.metadata.participant.onboardingDelivery),{environment,expected});});
 const assertUnprepared=async ref=>{assert.equal((await worker(ref.workerId)).metadata.participant.kycChatChallenge,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(await envelope(ref.workerId),null);assert.equal(postsFor(ref.workerId).length,0);};
 await check('canonical-INVITE-consent-receipt-does-not-create-account-KYC-or-operational-permission',async()=>{
  const ref=await enrol(a,'intent',{accept:false});const w=await worker(ref.workerId),i=participantOnboardingIntent(w.metadata.participant.onboardingDelivery),r=await authority(ref);
  assert.equal(r.member.actorId,a.ownerId);assert.equal(r.connection.projectId,a.anchorProjectId);assert.equal(r.project.id,a.projectId);assert.equal(r.entitlement.basis,'ACTIVE_PAID_PLAN');assert.equal(i.targetProjectId,a.projectId);
  assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE id=$1 AND action='participant.onboarding.contact_authorized'`,[i.consentReceiptId])).rows[0].n,1);await assertUnprepared(ref);
  assert.deepEqual(w.metadata.participant.permissions,{attendance:false,report:false});assert.equal((await query(`SELECT count(*)::int AS n FROM "TenantMembership"`)).rows[0].n,2);
 });
 let sentRef;
 await check('real-prepare-and-encrypted-anchor-outbox-atomic-success-preserves-target-and-private-navigation',async()=>{
  sentRef=await enrol(a,'sent');const result=await service.process(sentRef);assert.equal(result.state,'SENT');assert.equal(result.providerAccepted,true);assert.equal(result.deliveryConfirmed,false);assert.equal(result.automaticResendAllowed,false);
  const w=await worker(sentRef.workerId),e=await envelope(w.id),challenge=w.metadata.participant.kycChatChallenge;
  assert.equal(challenge.status,'PENDING');assert.equal(challenge.analysisConsentVersion,3);assert.equal(challenge.participantClerkUserId,sentRef.userId);assert.equal(postsFor(w.id,'ACCOUNT_INVITATION').length,1);assert.equal(allPostsFor(w.id).length,2);assert.equal(await challengeCount(w.id),1);assert.equal(e.projectId,a.anchorProjectId);assert.equal(e.payload.targetProjectId,a.projectId);assert.equal(e.attempts,1);
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
 await check('CURRENT-account-acceptance-queues-new-v3-identity-without-pre-JOIN-challenge-or-invitation-rePOST',async()=>{
  const ref=await enrol(a,'accepted',{accept:false}),before=await worker(ref.workerId);assert.equal((await service.process(ref)).state,'SENT');assert.equal(await challengeCount(ref.workerId),0);assert.equal((await worker(ref.workerId)).metadata.participant.kycChatChallenge,undefined);const first=await envelope(ref.workerId,'ACCOUNT_INVITATION');await acceptCurrent(ref);const accepted=await worker(ref.workerId);assert.equal(accepted.metadata.participant.acceptanceReceiptId,ref.acceptanceReceiptId);assert.deepEqual(accepted.metadata.participant.permissions,{attendance:true,report:true});assert.equal(accepted.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal(accepted.metadata.participant.channelIdentity,undefined);assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.account_bound'`,[ref.workerId])).rows[0].n,0);
  assert.equal((await service.process(ref)).state,'SENT');const current=await worker(ref.workerId),challenge=current.metadata.participant.kycChatChallenge;assert.equal(challenge.status,'PENDING');assert.equal(challenge.analysisConsentVersion,3);assert.equal(challenge.participantClerkUserId,ref.userId);assert.equal(await challengeCount(ref.workerId),1);assert.notEqual((await envelope(ref.workerId)).id,first.id);assert.deepEqual(await envelope(ref.workerId,'ACCOUNT_INVITATION'),first);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);assert.equal(postsFor(ref.workerId).length,1);assert.equal(allPostsFor(ref.workerId).length,2);await service.process(ref);assert.equal(allPostsFor(ref.workerId).length,2);assert.equal(before.metadata.participant.status,'INVITED');
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
  const w=await worker(sentRef.workerId),foreignProjection=[structuredClone(w)];foreignProjection[0].metadata.participant.onboardingDelivery.outboundId=participantOnboardingPhaseOutboundId(participantOnboardingIntent(w.metadata.participant.onboardingDelivery),'IDENTITY_START');await customerJobTransaction(connect,c=>readParticipantOnboardingStatuses(c,foreignProjection,b.organizationId,b.projectId));assert.equal(publicParticipantOnboarding(foreignProjection[0].metadata.participant).deliveryConfirmed,false);
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
  const ref=await enrol(b,'closed-provider',{accept:false}),closed=make({provider:{...provider,readiness:()=>({canUseCustomerTransport:false})}});assert.equal((await closed.process(ref)).code,'PARTICIPANT_ONBOARDING_PROVIDER_CLOSED');await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,'ACCOUNT_INVITATION'),null);assert.equal(allPostsFor(ref.workerId).length,0);
 });
 // The unchanged identity failure matrix above runs only after verified JOIN.
 // These first-phase cases separately pin the same dispatch/transaction fences
 // without ever creating a KYC challenge or an accepted account.
 for(const mode of ['reserve-rollback','prepare-crash','concurrent','marker-crash','marker-ack-lost','completion-ack-lost','completion-rollback','revoke-after-prepare','revoke-after-marker','timeout','invalid','reject'])await check('ACCOUNT_INVITATION-'+mode+'-one-parameter-no-challenge-and-bounded-recovery',async()=>{
  const ref=await enrol(b,'invitation-'+mode,{accept:false});let first=true,options={};
  if(['reserve-rollback','marker-ack-lost','completion-ack-lost','completion-rollback'].includes(mode))fault={mode,workerId:ref.workerId};
  if(mode==='prepare-crash')options.afterPrepare=async()=>{if(first){first=false;throw Error('SYNTHETIC_INVITATION_PRE_MARKER_CRASH');}};
  if(mode==='marker-crash')options.afterDispatchMarker=async()=>{throw Error('SYNTHETIC_INVITATION_POST_MARKER_CRASH');};
  if(mode==='revoke-after-prepare')options.afterPrepare=async()=>participant.save(session(b),await command(b,'REVOKE_ONBOARDING_CONTACT',{workerId:ref.workerId,revision:(await worker(ref.workerId)).revision}));
  if(mode==='revoke-after-marker')options.afterDispatchMarker=async()=>participant.save(session(b),await command(b,'REVOKE_ONBOARDING_CONTACT',{workerId:ref.workerId,revision:(await worker(ref.workerId)).revision}));
  const serviceUnderTest=make(options),asset=assets.get('b');if(['timeout','invalid','reject'].includes(mode))asset.sendMode=mode;
  try{
   const results=mode==='concurrent'?await Promise.all([serviceUnderTest.process(ref),serviceUnderTest.process(ref),serviceUnderTest.process(ref)]):[await serviceUnderTest.process(ref)];
   const firstState=mode==='concurrent'?(results.find(result=>result.state==='SENT')||results[0]).state:results[0].state;
   if(mode==='concurrent'){
    // Promise.all preserves call order, not the dispatch-marker winner. A follower may return the
    // committed SEND_STARTED marker or the already completed SENT row; durable state is the evidence.
    assert.equal(results.length,3);
    assert.ok(results.every(result=>['SEND_STARTED','SENT'].includes(result.state)),'CONCURRENT_INVITATION_RESPONSE_STATE_OUT_OF_BOUNDS');
    assert.ok(results.some(result=>result.state==='SENT'),'CONCURRENT_INVITATION_NO_SENT_RESPONSE');
    const durable=await envelope(ref.workerId,'ACCOUNT_INVITATION'),concurrentPosts=postsFor(ref.workerId,'ACCOUNT_INVITATION'),concurrentWorker=await worker(ref.workerId),concurrentPhase=participantOnboardingPhaseState(concurrentWorker.metadata.participant.onboardingDelivery,'ACCOUNT_INVITATION');
    assert.equal(concurrentPosts.length,1);assert.equal(allPostsFor(ref.workerId).length,1);
    assert.equal(durable.outcome.state,'SENT');assert.equal(durable.attempts,1);assert.equal(durable.outcome.messageId,concurrentPosts[0].messageId);assert.equal(concurrentPosts[0].correlationId,durable.id);
    assert.equal(concurrentPhase.state,'SENT');assert.equal(concurrentPhase.outboundId,durable.id);
    const invitationRequest=JSON.parse(decryptCustomerSecret(durable.payload.encryptedPayload,{organizationId:b.organizationId,projectId:b.anchorProjectId,purpose:'outbound',resourceId:durable.id},environment));
    assert.equal(invitationRequest.phase,'ACCOUNT_INVITATION');assert.equal(Object.hasOwn(invitationRequest,'challengeId'),false);assert.equal(invitationRequest.message.bodyParameters.length,1);assert.equal(durable.payload.requestDigest,sha(Buffer.from(JSON.stringify(invitationRequest))));assert.equal(concurrentPosts[0].body.template.components[0].parameters.length,1);
    assert.equal(concurrentWorker.metadata.participant.kycChatChallenge,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(await envelope(ref.workerId),null);assert.deepEqual(concurrentWorker.metadata.participant.permissions,{attendance:false,report:false});
   }
   if(['reserve-rollback','prepare-crash'].includes(mode)){assert.equal(firstState,'BLOCKED');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,0);const pending=await envelope(ref.workerId,'ACCOUNT_INVITATION');if(mode==='reserve-rollback')assert.equal(pending,null);else{assert.equal(pending.outcome.state,'ONBOARDING_PENDING');assert.equal(pending.attempts,0);}assert.equal((await serviceUnderTest.process(ref)).state,'SENT');if(pending)assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).payload.encryptedPayload,pending.payload.encryptedPayload);}
   else{const expected=['marker-crash','marker-ack-lost','completion-rollback','revoke-after-marker'].includes(mode)?'SEND_STARTED':mode==='revoke-after-prepare'?'CANCELED':['timeout','invalid'].includes(mode)?'SEND_UNKNOWN':mode==='reject'?'REJECTED':'SENT';assert.equal(firstState,expected);const beforeCount=postsFor(ref.workerId,'ACCOUNT_INVITATION').length;await service.process(ref);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,beforeCount);}
   const w=await worker(ref.workerId),firstEnvelope=await envelope(ref.workerId,'ACCOUNT_INVITATION');assert.equal(w.metadata.participant.status,'INVITED');assert.equal(w.metadata.participant.clerkUserId,null);assert.equal(w.metadata.participant.kycChatChallenge,undefined);assert.equal(w.metadata.participant.kycChatConversation,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(await envelope(ref.workerId),null);assert.equal(postsFor(ref.workerId).length,0);assert.equal(participantOnboardingPhaseState(w.metadata.participant.onboardingDelivery,'IDENTITY_START').state,mode.startsWith('revoke-')?'CANCELED':'WAITING_ACCOUNT_ACCEPTANCE');assert.equal(firstEnvelope.payload.onboardingPhase,'ACCOUNT_INVITATION');assert.equal(Object.hasOwn(firstEnvelope.payload,'challengeId'),false);assert.equal(firstEnvelope.attempts,mode==='revoke-after-prepare'?0:1);const expectedPosts=['marker-crash','marker-ack-lost','revoke-after-prepare','revoke-after-marker'].includes(mode)?0:1;assert.equal(allPostsFor(ref.workerId).length,expectedPosts);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,expectedPosts);assert.deepEqual(w.metadata.participant.permissions,{attendance:false,report:false});
  }finally{asset.sendMode='accepted';fault=null;}
 });
 await check('recovery-budget-floor-and-public-read-have-no-provider-or-business-side-effects',async()=>{
  const before=posts.length;assert.deepEqual(await service.recover({budgetMs:0}),{checked:0,results:[],deferred:true});assert.equal(posts.length,before);
  const current=await workspace.list(session(a)),view=await participant.read(session(a),{scope:current.scope,projectId:a.projectId});const serialized=JSON.stringify(view);
  for(const secret of ['IDENTIDAD ',a.token,b.token,'encryptedPayload','encryptedAccessToken','codeDigest','issuerAuthorityDigest','onboarding_contact_'])assert.equal(serialized.includes(secret),false,'PUBLIC_ONBOARDING_SECRET: '+secret);
  for(const table of ['Task','AttendanceEntry','OperationalProposal','WhatsAppCompanyEventRoute','WhatsAppCompanyRoute'])assert.equal((await query('SELECT count(*)::int AS n FROM "'+table+'"')).rows[0].n,0);
  assert.equal(networkCalls,0);assert.deepEqual(unexpected,[]);assertStableSource();
 });
 // ===== OWN_COMPANY participant onboarding (append-only extension; every Customer scenario above is untouched) =====
 // Same pool, random schema, lifecycle and controlled Clerk as the Customer matrix. Own rows are seeded HERE, after the last
 // Customer check, because that matrix pins global counts (for example exactly two TenantMemberships). No metadata is copied
 // between catalogs. Graph/Clerk stay synthetic; no DB mutation ever runs inside a Graph callback (it would wait on a row
 // locked by the very transaction that is awaiting the callback).
 const ownBaseline=checks.length,ownHolders=new Set(),ownBarrierEvidence=[],ownConcurrencyEvidence=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  const clockBefore=Date.now(),clockDatabase=(await admin.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime(),clockAfter=Date.now();
  assert.ok(clockDatabase<=clockAfter+1&&clockDatabase>=clockBefore-1000,'OWN_DATABASE_AND_NODE_CLOCK_MUST_AGREE: '+JSON.stringify({clockBefore,clockDatabase,clockAfter,upperPrecisionMs:1}));
  const ownTenants=[['oa','A',1],['ob','B',2]].map(([key,suffix,n])=>({key,organizationId:'own-company-'+key,clerkOrganizationId:'org_Own'+suffix,ownerId:'own-issuer-'+key,ownerUserId:'user_OwnIssuer'+suffix,policyActorId:'own-owner-'+key,policyUserId:'user_OwnOwner'+suffix,anchorProjectId:'own-anchor-'+key,projectId:'own-target-'+key,channelId:'own-channel-'+key,businessId:'2400009'+n+'0',wabaId:'2300009'+n+'0',phoneNumberId:'2200009'+n+'0',displayNumber:'+549110000903'+n,token:'synthetic-own-token-'+key+'-not-real',providerIds:{participant_invitation:'31000'+n+'01',participant_onboarding_v1:'31000'+n+'02'}}));
  const [oa,ob]=ownTenants;
  // The original number owner (policy actor) and the invitation issuer are different ADMIN principals on purpose, so the
  // Own-only original-owner locks are exercised separately from the ordinary issuer locks.
  async function seedOwn(o){
   const time=Date.now(),own=ownCompanyFixture({time,patch:{organizationId:o.organizationId,actorId:o.policyActorId,clerkUserId:o.policyUserId,clerkOrganizationId:o.clerkOrganizationId,projectId:o.anchorProjectId,businessId:o.businessId,wabaId:o.wabaId,phoneNumberId:o.phoneNumberId,expectedPhoneE164:o.displayNumber}});
   // Keep the lifecycle secret/vault/callback trio so the shared signed callback and processor interoperate; only Own policy keys differ.
   const env={...environment,...own.environment,META_APP_SECRET:environment.META_APP_SECRET,META_CUSTOMER_CREDENTIALS_KEY:environment.META_CUSTOMER_CREDENTIALS_KEY,META_CUSTOMER_VERIFY_TOKEN:environment.META_CUSTOMER_VERIFY_TOKEN,META_OWN_COMPANY_ACCESS_TOKEN:o.token};
   own.context={member:{actorId:o.policyActorId,organizationId:o.organizationId,organizationName:'Synthetic company '+o.key,role:'ADMIN'},session:{authenticated:true,verification:'clerk-production-jwt',userId:o.policyUserId,organizationId:o.clerkOrganizationId,organizationRole:'org:admin'},project:{id:o.anchorProjectId,organizationId:o.organizationId,organizationMetadata:{companyPhoneDeclaration:own.declaration}}};
   const adminProvider=createMetaCustomerProvider({environment:env,fetchImpl:own.fetchImpl,now:()=>Date.now()}),capability=createOwnCompanyCapability(own.context,env,Date.now());
   const ownAdmin=await adminProvider.forOwnCapability({capability,token:o.token}),inspection=await ownAdmin.inspect({token:o.token,wabaId:o.wabaId,phoneNumberId:o.phoneNumberId});
   const connection={id:o.channelId,projectId:o.anchorProjectId,organizationId:o.organizationId,phoneNumberId:o.phoneNumberId,whatsappBusinessId:o.wabaId,displayPhoneNumber:o.displayNumber,enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:encryptCustomerSecret(o.token,{organizationId:o.organizationId,projectId:o.anchorProjectId,purpose:'access-token',resourceId:o.phoneNumberId},env),metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:o.organizationId,customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:o.policyActorId},customerVerification:{...inspection,registered:true},companyRoutingVersion:1,declaredCompanyPhone:own.declaration,ownCompany:ownAdmin.ownProvenance(inspection),ownCompanyTemplateDrafts:{}}};
   const operation=randomUUID(),receiptId='company_own_'+ownDigest([o.organizationId,o.policyActorId,o.anchorProjectId,operation]);
   const grant=createOwnCompanyRuntimeGrant({capability,connection,receiptId,operationId:operation,channelRevision:2,providerAuthority:ownAdmin.ownOperationalAuthority(inspection)},env,Date.now());
   connection.metadata.ownCompanyRuntime=grant;
   const definitions={};
   for(const key of ['participant_invitation','participant_onboarding_v1']){const definition=buildCustomerTemplate(connection,key);definitions[key]=definition;connection.metadata.ownCompanyTemplateDrafts[key]={definition,state:'SUBMITTED',providerStatus:'APPROVED',providerCategory:'UTILITY',providerId:o.providerIds[key],observationRevision:1,grantDigest:grant.grantDigest};}
   await query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata,"subscriptionPlan","subscriptionStatus","trialEndsAt") VALUES($1,$2,$3,$4::jsonb,'PRO','ACTIVE',NULL)`,[o.organizationId,'Synthetic company '+o.key,o.clerkOrganizationId,JSON.stringify({companyPhoneDeclaration:own.declaration})]);
   for(const [actorId,clerkUserId] of [[o.policyActorId,o.policyUserId],[o.ownerId,o.ownerUserId]]){
    await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[actorId,clerkUserId,actorId+'@example.invalid']);
    await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['member-'+actorId,actorId,o.organizationId]);
   }
   for(const id of [o.anchorProjectId,o.projectId])await query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{}')`,[id,o.organizationId,'Synthetic '+id]);
   // The legacy-seed trigger creates the owner and anchor assignment rows; promote exactly like the Customer seed does.
   await query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken","displayPhoneNumber",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6,$7::jsonb)`,[o.channelId,o.anchorProjectId,o.phoneNumberId,o.wabaId,connection.encryptedAccessToken,o.displayNumber,JSON.stringify(connection.metadata)]);
   await query(`UPDATE "WhatsAppCompanyChannel" SET mode='COMPANY',revision=2 WHERE "connectionId"=$1`,[o.channelId]);
   await query(`INSERT INTO "WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) VALUES($1,$2,$3,'ACTIVE')`,[o.channelId,o.organizationId,o.projectId]);
   await query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.own.number.recorded','WhatsAppConnection',$4,$5::jsonb)`,[receiptId,o.organizationId,o.policyActorId,o.channelId,JSON.stringify({state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',projectId:o.anchorProjectId,operationId:operation,connectionId:o.channelId,policyDigest:connection.metadata.ownCompany.policyDigest,runtimeGrant:grant})]);
   Object.assign(o,{env,own,grant,receiptId,operation,definition:definitions.participant_onboarding_v1,invitationDefinition:definitions.participant_invitation,seededMetadata:JSON.parse(JSON.stringify(connection.metadata)),ownerMembershipId:'member-'+o.policyActorId,issuerMembershipId:'member-'+o.ownerId});
  }
  // A Graph double per Own company. Reads are allowed to inspect committed rows (MVCC); writes never happen here.
  function ownFetch(o){
   return async(input,options={})=>{
    const graph=o.graph;
    try{
     const url=new URL(input),method=options.method||'GET',route=url.pathname.replace(/^\/v25\.0\//,'');
     assert.equal(url.protocol,'https:');assert.equal(url.hostname,'graph.facebook.com');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.port,'');
     if(route===o.wabaId+'/message_templates'&&method==='GET'){
      assert.equal(options.headers?.Authorization,'Bearer '+o.token);
      const name=url.searchParams.get('name'),invitation=name===o.invitationDefinition.name;assert.ok(invitation||name===o.definition.name);
      const definition=invitation?o.invitationDefinition:o.definition,providerId=o.providerIds[invitation?'participant_invitation':'participant_onboarding_v1'];
      graph.lookups++;await graph.beforeLookup(graph);
      return Response.json({data:graph.lookupMode==='missing'?[]:[{...definition,id:providerId,status:graph.lookupMode==='pending'?'PENDING':'APPROVED',category:'UTILITY',...(graph.lookupMode==='changed'?{components:[{type:'BODY',text:'Synthetic unauthorized content {{1}}'}]}:{})}]});
     }
     if(route===o.phoneNumberId+'/messages'&&method==='POST'){
      assert.equal(options.headers?.Authorization,'Bearer '+o.token);
      const body=JSON.parse(options.body);
      assert.equal(body.messaging_product,'whatsapp');assert.equal(body.type,'template');assert.ok([o.definition.name,o.invitationDefinition.name].includes(body.template.name));assert.equal(body.template.language.code,'es_AR');assert.equal(body.context,undefined);
      const e=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[body.biz_opaque_callback_data])).rows[0];
      assert.ok(e);assert.equal(e.projectId,o.anchorProjectId);assert.equal(e.outcome.state,'SEND_STARTED');assert.equal(e.attempts,1);assert.equal(e.payload.onboardingCatalog,'OWN_COMPANY');
      const w=await worker(e.payload.workerId),phase=e.payload.onboardingPhase,parameters=body.template.components[0].parameters;
      assert.equal(body.to,w.phone.slice(1));assert.ok(['ACCOUNT_INVITATION','IDENTITY_START'].includes(phase));assert.equal(e.id,participantOnboardingPhaseOutboundId(participantOnboardingIntent(w.metadata.participant.onboardingDelivery),phase));
      const sealed=JSON.parse(decryptCustomerSecret(e.payload.encryptedPayload,{organizationId:o.organizationId,projectId:o.anchorProjectId,purpose:'outbound',resourceId:e.id},o.env));
      assert.equal(sealed.version,3);assert.equal(sealed.phase,phase);assert.equal(sealed.ownOnboarding.catalog,'OWN_COMPANY');assert.equal(sealed.ownOnboarding.phase,phase);assert.equal(sealed.ownOnboarding.connectionId,o.channelId);assert.equal(sealed.ownOnboarding.grantDigest,o.grant.grantDigest);assert.equal(e.payload.ownOnboardingDigest,ownDigest(sealed.ownOnboarding));
      if(phase==='ACCOUNT_INVITATION'){assert.equal(body.template.name,o.invitationDefinition.name);assert.equal(parameters.length,1);assert.equal(parameters[0].text,'Synthetic company '+o.key);assert.equal(w.metadata.participant.status,'INVITED');assert.equal(w.metadata.participant.clerkUserId,null);assert.equal(w.metadata.participant.kycChatChallenge,undefined);assert.equal(await challengeCount(w.id),0);assert.equal(Object.hasOwn(e.payload,'challengeId'),false);assert.equal(JSON.stringify(body).includes('IDENTIDAD '),false);assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='PREPARE_KYC_CHAT'`,[w.id])).rows[0].n,0);}
      else{assert.equal(body.template.name,o.definition.name);assert.equal(parameters.length,3);assert.equal(parameters[1].text,'https://obrasaas.com/cuenta?participar='+w.metadata.participant.invitation.id);assert.equal(w.metadata.participant.status,'ACTIVE');assert.equal(w.metadata.participant.invitation.state,'ACCEPTED');assert.equal(w.metadata.participant.kycChatChallenge.analysisConsentVersion,3);assert.equal(w.metadata.participant.kycChatChallenge.participantClerkUserId,w.metadata.participant.clerkUserId);assert.equal(metaKycChallengeDigest(parameters[2].text),w.metadata.participant.kycChatChallenge.codeDigest);assert.equal(postsFor(w.id,'ACCOUNT_INVITATION').length,1);}
      const messageId='wamid.ControlledOwnOnboardingDelivery_'+(posts.length+1);posts.push({workerId:w.id,phase,asset:o.key,catalog:'OWN_COMPANY',correlationId:e.id,messageId,body});
      if(graph.sendMode==='timeout')throw Error('SYNTHETIC_PROVIDER_ACCEPTED_RESPONSE_LOST');
      if(graph.sendMode==='reject')return Response.json({error:{code:100,message:'Synthetic rejected request'}},{status:400});
      return Response.json({messages:[{id:graph.sendMode==='invalid'?'invalid-provider-ack':messageId}]});
     }
     graph.otherRoutes.push(method+' '+route);
     return o.own.fetchImpl(input,options);
    }catch(error){if(error.message!=='SYNTHETIC_PROVIDER_ACCEPTED_RESPONSE_LOST')unexpected.push({code:'CONTROLLED_OWN_GRAPH_ASSERTION_FAILED',message:error.message});throw error;}
   };
  }
  for(const o of ownTenants){
   await seedOwn(o);
   o.graph={lookupMode:'approved',sendMode:'accepted',lookups:0,beforeLookup:async()=>{},otherRoutes:[]};
   o.provider=createMetaCustomerProvider({environment:o.env,fetchImpl:ownFetch(o),now:()=>Date.now()});
   o.service=createParticipantOnboardingDelivery({connect,provider:o.provider,environment:o.env});
  }
  const ownMake=(o,options={})=>createParticipantOnboardingDelivery({connect,provider:o.provider,environment:o.env,...options});
  async function enrolOwn(o,label,{consent=true,accept=true,email=null}={}){
   sequence++;const id='own-worker-'+label,phone='+'+(o.key==='oa'?'549110003':'549110004')+String(sequence).padStart(4,'0');
   await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata) VALUES($1,$2,$3,$4,'WORKER',$5::jsonb)`,[id,o.projectId,'Synthetic '+label,phone,JSON.stringify({siteRegister:{version:1,job:'WORKER'}})]);
   const input=await command(o,'INVITE',{workerId:id,revision:(await worker(id)).revision,email:email||label+'@example.invalid',...(consent?{whatsAppConsent:consentChoice}:{})});
   const result=await participant.save(session(o),input);assert.equal(result.saved,true);
   const w=await worker(id);assert.equal(w.metadata.participant.invitation.state,'SENT');assert.equal(w.metadata.participant.status,'INVITED');assert.equal(w.metadata.participant.clerkUserId,null);
   if(consent){const d=w.metadata.participant.onboardingDelivery;assert.equal(d.state,'WAITING_CONFIGURATION');assert.equal(d.deliveryVersion,2);assert.equal(d.phase,'ACCOUNT_INVITATION');assert.equal(participantOnboardingPhaseState(d,'IDENTITY_START').state,'WAITING_ACCOUNT_ACCEPTANCE');}
   const ref={workerId:id,projectId:o.projectId,tenant:o,input};references.push(ref);
   if(consent&&accept){assert.equal((await o.service.process(ref)).state,'SENT');ref.invitationDelivered=true;assert.equal(postsFor(id,'ACCOUNT_INVITATION').length,1);await acceptCurrent(ref);}
   return ref;
  }
  const ownAuthority=(ref,expected=null,environmentOverride=null)=>customerJobTransaction(connect,async client=>{const w=await worker(ref.workerId);return resolveParticipantOnboardingAuthority(client,participantOnboardingIntent(w.metadata.participant.onboardingDelivery),{environment:environmentOverride||ref.tenant.env,expected});});
  // Decrypts the sealed envelope with its exact AAD and proves every other AAD component is rejected.
  async function assertOwnEnvelope(ref,phase){
   const o=ref.tenant,other=ownTenants.find(t=>t.key!==o.key),e=await envelope(ref.workerId,phase);assert.ok(e);
   assert.equal(e.projectId,o.anchorProjectId);assert.equal(e.payload.organizationId,o.organizationId);assert.equal(e.payload.targetProjectId,o.projectId);assert.equal(e.payload.channelId,o.channelId);assert.equal(e.payload.onboardingCatalog,'OWN_COMPANY');assert.equal(e.payload.onboardingPhase,phase);
   const context={organizationId:o.organizationId,projectId:o.anchorProjectId,purpose:'outbound',resourceId:e.id},request=JSON.parse(decryptCustomerSecret(e.payload.encryptedPayload,context,o.env));
   assert.equal(request.version,3);assert.equal(request.phase,phase);assert.equal(e.payload.ownOnboardingDigest,ownDigest(request.ownOnboarding));assert.equal(e.payload.requestDigest,sha(Buffer.from(JSON.stringify(request))));
   const channel=(await query(`SELECT revision FROM "WhatsAppCompanyChannel" WHERE "connectionId"=$1`,[o.channelId])).rows[0],assignment=(await query(`SELECT revision FROM "WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 AND "projectId"=$2`,[o.channelId,o.projectId])).rows[0];
   assert.deepEqual(request.ownOnboarding,{version:1,catalog:'OWN_COMPANY',phase,connectionId:o.channelId,anchorProjectId:o.anchorProjectId,targetProjectId:o.projectId,wabaId:o.wabaId,phoneNumberId:o.phoneNumberId,grantDigest:o.grant.grantDigest,ownerRevision:channel.revision,assignmentRevision:assignment.revision});
   for(const wrong of [{...context,projectId:o.projectId},{...context,organizationId:other.organizationId},{...context,purpose:'access-token'},{...context,resourceId:e.id+'x'}])assert.throws(()=>decryptCustomerSecret(e.payload.encryptedPayload,wrong,o.env));
   return {e,request};
  }
  // Signed callback helper for Own outbox correlation (shared processor; its vault/secret are the lifecycle ones).
  // Distinct callback fixtures need distinct event identities; recipient changes under the same identity are rejected replays.
  let ownStatusTimestamp=0;
  async function ownStatus(ref,{signed=true,recipient=null,id=null,tenant=ref.tenant,phase='IDENTITY_START',providerStatus='delivered'}={}){
   ownStatusTimestamp=Math.max(Math.floor(Date.now()/1000),ownStatusTimestamp+1);
   const e=await envelope(ref.workerId,phase),sent=postsFor(ref.workerId,phase)[0];
   const value={id:id||sent?.messageId||'wamid.ControlledUnsentStatus_123',status:providerStatus,timestamp:String(ownStatusTimestamp),recipient_id:recipient||(await worker(ref.workerId)).phone.slice(1),biz_opaque_callback_data:e.id};
   const body={object:'whatsapp_business_account',entry:[{id:tenant.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:tenant.phoneNumberId},statuses:[value]}}]}]},bytes=Buffer.from(JSON.stringify(body));
   const response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'content-type':'application/json',...(signed?{'x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex')}:{})},body:bytes}));assert.equal(response.status,signed?200:403);if(!signed)return null;assert.equal((await response.json()).durable,true);
   return processor.process('customer_webhook_'+splitMetaCustomerEvents(body)[0].externalId);
  }
  // Connection mutation helpers: every mutation is restored byte-for-byte in a finally.
  const connectionRow=async o=>(await query(`SELECT enabled,metadata FROM "WhatsAppConnection" WHERE id=$1`,[o.channelId])).rows[0];
  const restoreConnection=(o,snapshot)=>query(`UPDATE "WhatsAppConnection" SET enabled=$2,metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[o.channelId,snapshot.enabled,JSON.stringify(snapshot.metadata)]);
  const mutateConnection=async(o,run,{enabled=null}={})=>{const snapshot=await connectionRow(o),metadata=structuredClone(snapshot.metadata);await run(metadata);await query(`UPDATE "WhatsAppConnection" SET metadata=$2::jsonb,enabled=COALESCE($3::boolean,enabled),"updatedAt"=clock_timestamp() WHERE id=$1`,[o.channelId,JSON.stringify(metadata),enabled]);return snapshot;};
  const revokedGrant=o=>{const operation=randomUUID();return revokeOwnCompanyRuntimeGrant({metadata:{credentialOrganizationId:o.organizationId,ownCompanyRuntime:o.grant}},{member:{role:'ADMIN',organizationId:o.organizationId,actorId:o.policyActorId},projectId:o.anchorProjectId,receiptId:'company_channel_'+ownDigest([o.organizationId,o.policyActorId,o.anchorProjectId,operation]),operationId:operation,now:Date.now()});};
  const setMembershipRole=(membershipId,role)=>query(`UPDATE "TenantMembership" SET "tenantRole"=$2,"updatedAt"=clock_timestamp() WHERE id=$1`,[membershipId,role]);
  // A real second session holds a row lock; blocking is observed in pg_stat_activity/pg_blocking_pids, never inferred from a
  // pending Promise. The holder never waits for anything, so it cannot take part in a lock cycle. Every holder is released
  // in a finally (and again by the block-level safety net) before the schema is dropped.
  async function barrierOpen(sql,args){
   const holder=await pool.connect();ownHolders.add(holder);const barrier={holder,open:false,released:false,pid:null};
   try{await holder.query('BEGIN');barrier.open=true;await holder.query("SET LOCAL lock_timeout='3000ms'");barrier.pid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;await holder.query(rewrite(sql),args);}
   catch(error){await barrierClose(barrier,'rollback');throw error;}
   return barrier;
  }
  async function barrierClose(barrier,mode){
   if(barrier.open){barrier.open=false;try{await barrier.holder.query(mode==='commit'?'COMMIT':'ROLLBACK');}catch(error){if(mode==='commit')throw error;}}
   if(!barrier.released){barrier.released=true;ownHolders.delete(barrier.holder);barrier.holder.release();}
  }
  async function barrierWaitBlocked(barrier,label){
   const deadline=Date.now()+5000;
   for(;;){
    const rows=(await admin.query(`SELECT pid,wait_event_type,wait_event,left(query,100) AS statement FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1::int=ANY(pg_blocking_pids(pid))`,[barrier.pid])).rows;
    if(rows.length){assert.notEqual(rows[0].pid,barrier.pid);const evidence={label,waiters:rows.length,waitEvent:rows[0].wait_event,statement:rows[0].statement};ownBarrierEvidence.push(evidence);return evidence;}
    assert.ok(Date.now()<deadline,'OWN_BARRIER_NO_REAL_ROW_LOCK_WAIT_OBSERVED: '+label);
    await sleep(25);
   }
  }
  async function withRowBarrier({sql,args,release,label},run){
   const barrier=await barrierOpen(sql,args);let running=null,outcome=null,evidence=null;
   try{
    running=run();running.catch(()=>{});
    evidence=await barrierWaitBlocked(barrier,label);
    assert.equal(await Promise.race([running.then(()=>'settled',()=>'settled'),sleep(0).then(()=>'pending')]),'pending','OWN_BARRIER_RUN_SETTLED_WHILE_LOCK_HELD');
    await barrierClose(barrier,release);
    outcome=await running;running=null;
   }finally{
    await barrierClose(barrier,'rollback');
    if(running){try{await running;}catch{}}
   }
   return {outcome,evidence};
  }
  const bothPhases=['ACCOUNT_INVITATION','IDENTITY_START'],phaseTag=phase=>phase==='IDENTITY_START'?'id':'inv';
  await check('OWN-two-disjoint-canonical-companies-seeded-with-own-catalog-separate-from-customer-and-an-uncopyable-authority-witness',async()=>{
   for(const o of ownTenants){
    const row=await connectionRow(o);
    assert.equal(row.enabled,true);assert.deepEqual(row.metadata,o.seededMetadata);assert.equal(Object.hasOwn(row.metadata,'customerTemplateDrafts'),false);
    assert.deepEqual(Object.keys(row.metadata.ownCompanyTemplateDrafts).sort(),['participant_invitation','participant_onboarding_v1']);
    for(const draft of Object.values(row.metadata.ownCompanyTemplateDrafts))assert.equal(draft.grantDigest,o.grant.grantDigest);
    assert.deepEqual((await query(`SELECT mode,revision,"anchorProjectId" FROM "WhatsAppCompanyChannel" WHERE "connectionId"=$1`,[o.channelId])).rows[0],{mode:'COMPANY',revision:2,anchorProjectId:o.anchorProjectId});
    assert.deepEqual((await query(`SELECT "projectId",status FROM "WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 ORDER BY "projectId"`,[o.channelId])).rows,[{projectId:o.anchorProjectId,status:'ACTIVE'},{projectId:o.projectId,status:'ACTIVE'}]);
    const receipt=(await query(`SELECT metadata FROM "AuditLog" WHERE id=$1 AND action='company.own.number.recorded'`,[o.receiptId])).rows;assert.equal(receipt.length,1);assert.equal(receipt[0].metadata.runtimeGrant.grantDigest,o.grant.grantDigest);
   }
   for(const t of [a,b]){const row=(await query(`SELECT metadata FROM "WhatsAppConnection" WHERE id=$1`,[t.channelId])).rows[0];for(const key of ['ownCompany','ownCompanyRuntime','ownCompanyTemplateDrafts'])assert.equal(Object.hasOwn(row.metadata,key),false);assert.equal(Object.hasOwn(row.metadata,'customerTemplateDrafts'),true);}
   assert.notEqual(oa.definition.name,assets.get('a').definition.name);assert.notEqual(oa.definition.name,ob.definition.name);assert.notEqual(oa.grant.grantDigest,ob.grant.grantDigest);
   const ref=await enrolOwn(oa,'seed-witness',{accept:false}),r=await ownAuthority(ref),delivery=(await worker(ref.workerId)).metadata.participant.onboardingDelivery;
   assert.equal(r.company,true);assert.equal(r.member.actorId,oa.ownerId);assert.equal(r.connection.id,oa.channelId);assert.equal(r.connection.projectId,oa.anchorProjectId);assert.equal(r.project.id,oa.projectId);
   const witness=readOwnParticipantOnboardingAuthority(r,'ACCOUNT_INVITATION',{environment:oa.env,now:r.now.getTime()});
   assert.equal(witness.catalog,'OWN_COMPANY');assert.deepEqual(witness.binding,{version:1,catalog:'OWN_COMPANY',phase:'ACCOUNT_INVITATION',connectionId:oa.channelId,anchorProjectId:oa.anchorProjectId,targetProjectId:oa.projectId,wabaId:oa.wabaId,phoneNumberId:oa.phoneNumberId,grantDigest:oa.grant.grantDigest,ownerRevision:2,assignmentRevision:1});
   assert.equal(witness.correlationId,participantOnboardingPhaseOutboundId(participantOnboardingIntent(delivery),'ACCOUNT_INVITATION'));
   assert.throws(()=>readOwnParticipantOnboardingAuthority({...r},'ACCOUNT_INVITATION',{environment:oa.env,now:r.now.getTime()}));
   assert.throws(()=>readOwnParticipantOnboardingAuthority(r,'IDENTITY_START',{environment:oa.env,now:r.now.getTime()}));
   assert.throws(()=>readOwnParticipantOnboardingAuthority(r,'ACCOUNT_INVITATION',{environment,now:r.now.getTime()}));
   await assertUnprepared(ref);
  });
  await check('OWN-customer-service-customer-environment-and-customer-provider-can-neither-authorize-nor-send-for-an-own-channel-worker',async()=>{
   const ref=await enrolOwn(oa,'no-customer-fallback',{accept:false});
   await assert.rejects(ownAuthority(ref,null,environment));
   assert.equal((await service.process(ref)).state,'BLOCKED');
   await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,'ACCOUNT_INVITATION'),null);assert.equal(allPostsFor(ref.workerId).length,0);
   assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION')[0].asset,'oa');
  });
  await check('OWN-ACCOUNT_INVITATION-then-verified-JOIN-then-IDENTITY_START-use-per-phase-v3-envelopes-exact-AAD-and-never-replay',async()=>{
   const ref=await enrolOwn(oa,'happy',{accept:false}),first=await oa.service.process(ref);
   assert.equal(first.state,'SENT');assert.equal(first.providerAccepted,true);assert.equal(first.deliveryConfirmed,false);assert.equal(first.automaticResendAllowed,false);ref.invitationDelivered=true;
   assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);await assertUnprepared(ref);
   const invitation=await assertOwnEnvelope(ref,'ACCOUNT_INVITATION');assert.equal(invitation.request.message.bodyParameters.length,1);assert.equal(Object.hasOwn(invitation.request,'challengeId'),false);
   await oa.service.process(ref);assert.equal(allPostsFor(ref.workerId).length,1);await assertUnprepared(ref);
   await acceptCurrent(ref);
   const second=await oa.service.process(ref);assert.equal(second.state,'SENT');
   const identityPhase=await assertOwnEnvelope(ref,'IDENTITY_START'),w=await worker(ref.workerId),challenge=w.metadata.participant.kycChatChallenge,code=identityPhase.request.message.bodyParameters[2];
   assert.equal(identityPhase.request.challengeId,challenge.id);assert.equal(metaKycChallengeDigest(code),challenge.codeDigest);assert.equal(identityPhase.request.participantClerkUserId,ref.userId);assert.equal(identityPhase.request.acceptanceReceiptId,ref.acceptanceReceiptId);
   assert.notEqual(identityPhase.e.id,invitation.e.id);assert.notEqual(identityPhase.e.payload.ownOnboardingDigest,invitation.e.payload.ownOnboardingDigest);assert.deepEqual(await envelope(ref.workerId,'ACCOUNT_INVITATION'),invitation.e);
   for(const text of [JSON.stringify(w.metadata),JSON.stringify(identityPhase.e),JSON.stringify(second)])assert.equal(text.includes(code),false);
   await oa.service.process(ref);assert.equal(allPostsFor(ref.workerId).length,2);assert.equal(await challengeCount(ref.workerId),1);
  });
  // ---- per-phase fault matrix: the Customer fault wrapper, the real DB and the actual Own services; one POST at most ----
  const ownModes=['reserve-rollback','prepare-crash','concurrent','marker-crash','marker-ack-lost','completion-ack-lost','completion-rollback','revoke-after-prepare','revoke-after-marker','timeout','invalid','reject'];
  const ownFirst={'reserve-rollback':'BLOCKED','prepare-crash':'BLOCKED','concurrent':'SENT','marker-crash':'SEND_STARTED','marker-ack-lost':'SEND_STARTED','completion-ack-lost':'SENT','completion-rollback':'SEND_STARTED','revoke-after-prepare':'CANCELED','revoke-after-marker':'SEND_STARTED','timeout':'SEND_UNKNOWN','invalid':'SEND_UNKNOWN','reject':'REJECTED'};
  const ownOutbox={'reserve-rollback':'SENT','prepare-crash':'SENT','concurrent':'SENT','marker-crash':'SEND_STARTED','marker-ack-lost':'SEND_STARTED','completion-ack-lost':'SENT','completion-rollback':'SEND_STARTED','revoke-after-prepare':'ONBOARDING_PENDING','revoke-after-marker':'SEND_STARTED','timeout':'SEND_UNKNOWN','invalid':'SEND_UNKNOWN','reject':'REJECTED'};
  const ownNoPost=['marker-crash','marker-ack-lost','revoke-after-prepare','revoke-after-marker'],ownResumed=['reserve-rollback','prepare-crash','concurrent'];
  async function ownPhaseCase(o,phase,mode){
   const isIdentity=phase==='IDENTITY_START',ref=await enrolOwn(o,(isIdentity?'pi-':'pa-')+mode,{accept:isIdentity}),graph=o.graph,winners=[],options={};let first=true;
   const permissionsBefore=structuredClone((await worker(ref.workerId)).metadata.participant.permissions);
   if(['reserve-rollback','marker-ack-lost','completion-ack-lost','completion-rollback'].includes(mode))fault={mode,workerId:ref.workerId};
   if(mode==='prepare-crash')options.afterPrepare=async()=>{if(first){first=false;throw Error('SYNTHETIC_OWN_PRE_MARKER_CRASH');}};
   if(mode==='marker-crash')options.afterDispatchMarker=async()=>{throw Error('SYNTHETIC_OWN_POST_MARKER_CRASH');};
   const revoke=async()=>participant.save(session(o),await command(o,'REVOKE_ONBOARDING_CONTACT',{workerId:ref.workerId,revision:(await worker(ref.workerId)).revision}));
   if(mode==='revoke-after-prepare')options.afterPrepare=revoke;
   if(mode==='revoke-after-marker')options.afterDispatchMarker=revoke;
   const svc=ownMake(o,options);if(['timeout','invalid','reject'].includes(mode))graph.sendMode=mode;
   try{
    let results;
    if(mode==='concurrent'){
     // The dispatch-marker winner is identified by its own hook, never by Promise.all position. Followers may report the
     // committed SEND_STARTED marker or the completed SENT row; durable state below is the evidence. Every contender gets a
     // transparent resolver: the same real function, the same arguments, the very object it returned (the Own witness keeps its
     // identity); it only records error.code, by contender index, at the moment it captures and re-throws.
     const authorityFailures=[],tracedAuthority=index=>async(...args)=>{try{return await resolveParticipantOnboardingAuthority(...args);}catch(error){authorityFailures.push({index,code:error?.code});throw error;}};
     const contenders=[0,1,2].map(index=>ownMake(o,{resolveAuthority:tracedAuthority(index),afterDispatchMarker:async()=>{winners.push(index);}}));
     results=await Promise.all(contenders.map(contender=>contender.process(ref)));
     assert.equal(winners.length,1);assert.equal(results.length,3);
     const winner=winners[0],codesOf=index=>authorityFailures.filter(failure=>failure.index===index).map(failure=>failure.code);
     assert.equal(results[winner].state,'SENT');assert.deepEqual(codesOf(winner),[]);
     // IDENTITY_START followers that loaded before the winner prepared the PENDING challenge pin no challenge id in their queue
     // transaction: checkedChallenge throws PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED and block() reports BLOCKED with the default
     // public code (or the already stored SEND_STARTED/SENT state). A BLOCKED follower is accepted only with that exact internal
     // cause. The invitation phase has no challenge: its followers report only the committed marker or SENT and record no failure.
     for(const [index,result] of results.entries()){
      if(index===winner)continue;
      const codes=codesOf(index);
      if(result.state==='BLOCKED'){assert.equal(isIdentity,true,'CONCURRENT_INVITATION_FOLLOWER_BLOCKED');assert.equal(result.code,'PARTICIPANT_ONBOARDING_AUTHORIZATION_REQUIRED');assert.ok(codes.length>=1,'BLOCKED_FOLLOWER_WITHOUT_AUTHORITY_EVIDENCE');}
      else assert.ok(['SEND_STARTED','SENT'].includes(result.state),'CONCURRENT_FOLLOWER_STATE_OUT_OF_BOUNDS: '+result.state);
      assert.ok(codes.every(code=>isIdentity&&code==='PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED'),'UNEXPECTED_AUTHORITY_FAILURE_CAUSE: '+JSON.stringify(codes));
     }
     assert.ok(results.some(result=>result.state==='SENT'));
     ownConcurrencyEvidence.push({phase,winner,contenders:results.map((result,index)=>({index,state:result.state,publicCode:result.code??null,authorityCodes:codesOf(index)}))});
    }else results=[await svc.process(ref)];
    for(const result of results){assert.notEqual(result.automaticResendAllowed,true);assert.notEqual(result.deliveryConfirmed,true);}
    const firstState=mode==='concurrent'?results[winners[0]].state:results[0].state;
    if(['reserve-rollback','prepare-crash'].includes(mode)){
     assert.equal(firstState,'BLOCKED');assert.equal(postsFor(ref.workerId,phase).length,0);
     const pending=await envelope(ref.workerId,phase),challengeBefore=structuredClone((await worker(ref.workerId)).metadata.participant.kycChatChallenge);
     if(mode==='reserve-rollback'){assert.equal(pending,null);assert.equal(challengeBefore,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='PREPARE_KYC_CHAT'`,[ref.workerId])).rows[0].n,0);}
     else{assert.equal(pending.outcome.state,'ONBOARDING_PENDING');assert.equal(pending.attempts,0);assert.equal(await challengeCount(ref.workerId),isIdentity?1:0);}
     assert.equal((await svc.process(ref)).state,'SENT');
     if(pending){assert.equal((await envelope(ref.workerId,phase)).payload.encryptedPayload,pending.payload.encryptedPayload);if(isIdentity)assert.deepEqual((await worker(ref.workerId)).metadata.participant.kycChatChallenge,challengeBefore);}
    }else{
     assert.equal(firstState,ownFirst[mode]);
     const before=postsFor(ref.workerId,phase).length;await o.service.process(ref);assert.equal(postsFor(ref.workerId,phase).length,before);
    }
    const w=await worker(ref.workerId),p=w.metadata.participant,e=await envelope(ref.workerId,phase),expectedPosts=ownNoPost.includes(mode)?0:1,phasePosts=postsFor(ref.workerId,phase);
    assert.ok(e);assert.equal(e.payload.onboardingPhase,phase);assert.equal(e.payload.onboardingCatalog,'OWN_COMPANY');assert.equal(e.outcome.state,ownOutbox[mode]);assert.equal(e.attempts,mode==='revoke-after-prepare'?0:1);
    assert.equal(phasePosts.length,expectedPosts);assert.equal(allPostsFor(ref.workerId).length,expectedPosts+(isIdentity?1:0));
    if(expectedPosts===1){assert.equal(phasePosts[0].correlationId,e.id);assert.equal(phasePosts[0].catalog,'OWN_COMPANY');if(e.outcome.state==='SENT')assert.equal(e.outcome.messageId,phasePosts[0].messageId);}
    const stage=participantOnboardingPhaseState(p.onboardingDelivery,phase);assert.equal(stage.state,ownResumed.includes(mode)?'SENT':ownFirst[mode]);assert.equal(stage.outboundId,e.id);
    if(isIdentity){
     assert.equal(p.status,'ACTIVE');assert.equal(p.invitation.state,'ACCEPTED');assert.equal(Object.hasOwn(e.payload,'challengeId'),true);assert.equal(await challengeCount(ref.workerId),1);assert.equal(p.kycChatChallenge.status,'PENDING');assert.equal(p.kycChatChallenge.id,e.payload.challengeId);assert.equal(p.kyc.status,'NOT_SUBMITTED');assert.equal(p.channelIdentity,undefined);
     assert.equal(participantOnboardingPhaseState(p.onboardingDelivery,'ACCOUNT_INVITATION').state,'SENT');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);
    }else{
     assert.equal(p.status,'INVITED');assert.equal(p.clerkUserId,null);assert.equal(p.kycChatChallenge,undefined);assert.equal(p.kycChatConversation,undefined);assert.equal(await challengeCount(ref.workerId),0);assert.equal(await envelope(ref.workerId),null);assert.equal(postsFor(ref.workerId).length,0);assert.equal(Object.hasOwn(e.payload,'challengeId'),false);
     assert.equal(participantOnboardingPhaseState(p.onboardingDelivery,'IDENTITY_START').state,mode.startsWith('revoke-')?'CANCELED':'WAITING_ACCOUNT_ACCEPTANCE');
    }
    assert.deepEqual(p.permissions,permissionsBefore);
    await assertOwnEnvelope(ref,phase);
   }finally{graph.sendMode='accepted';fault=null;}
  }
  for(const phase of bothPhases)for(const mode of ownModes)await check('OWN-'+phase+'-'+mode+'-real-lifecycle-durable-state-one-POST-and-no-automatic-replay',()=>ownPhaseCase(oa,phase,mode));
  await check('OWN-two-company-concurrent-delivery-keeps-independent-grant-anchor-target-ciphertext-and-AAD',async()=>{
   const refs=[await enrolOwn(oa,'iso-a',{accept:false}),await enrolOwn(ob,'iso-b',{accept:false})];
   await Promise.all(refs.map(ref=>ref.tenant.service.process(ref)));
   for(const ref of refs){const t=ref.tenant,{e,request}=await assertOwnEnvelope(ref,'ACCOUNT_INVITATION');assert.equal(e.outcome.state,'SENT');assert.equal(request.ownOnboarding.grantDigest,t.grant.grantDigest);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION')[0].asset,t.key);}
   const intent=participantOnboardingIntent((await worker(refs[0].workerId)).metadata.participant.onboardingDelivery);
   await assert.rejects(customerJobTransaction(connect,c=>resolveParticipantOnboardingAuthority(c,{...intent,organizationId:ob.organizationId},{environment:oa.env})),{code:'PARTICIPANT_ONBOARDING_PRINCIPAL_REQUIRED'});
   const ea=await envelope(refs[0].workerId,'ACCOUNT_INVITATION');
   assert.throws(()=>decryptCustomerSecret(ea.payload.encryptedPayload,{organizationId:ob.organizationId,projectId:ob.anchorProjectId,purpose:'outbound',resourceId:ea.id},ob.env));
  });
  // ---- signed callback correlation (the existing processor); a template existing or a search result never counts ----
  await check('OWN-signed-exact-status-correlates-only-its-own-phase-while-unsigned-wrong-company-recipient-and-id-do-not',async()=>{
   const ref=await enrolOwn(oa,'status-phases');assert.equal((await oa.service.process(ref)).state,'SENT');
   const both=async()=>({invitation:(await envelope(ref.workerId,'ACCOUNT_INVITATION')).outcome,identity:(await envelope(ref.workerId,'IDENTITY_START')).outcome});
   const before=await both();assert.equal(before.invitation.state,'SENT');assert.equal(before.identity.state,'SENT');
   for(const phase of bothPhases){
    await ownStatus(ref,{phase,signed:false});
    await ownStatus(ref,{phase,tenant:ob}).catch(()=>null);
    await assert.rejects(ownStatus(ref,{phase,recipient:'549119999999'}),{code:'META_CUSTOMER_OUTBOUND_STATUS_CONFLICT'});
    await assert.rejects(ownStatus(ref,{phase,id:'wamid.WrongControlledMessage_1234'}),{code:'META_CUSTOMER_OUTBOUND_STATUS_CONFLICT'});
   }
   assert.deepEqual(await both(),before);
   await ownStatus(ref,{phase:'ACCOUNT_INVITATION'});
   const middle=await both();assert.equal(middle.invitation.state,'STATUS_OBSERVED');assert.equal(middle.invitation.providerStatus,'delivered');assert.deepEqual(middle.identity,before.identity);
   const project=async()=>{const rows=[await worker(ref.workerId)];await customerJobTransaction(connect,c=>readParticipantOnboardingStatuses(c,rows,oa.organizationId,oa.projectId));return publicParticipantOnboarding(rows[0].metadata.participant);};
   let view=await project();assert.equal(view.invitationState,'STATUS_OBSERVED');assert.equal(view.identityState,'SENT');
   await ownStatus(ref,{phase:'IDENTITY_START'});assert.equal((await envelope(ref.workerId,'IDENTITY_START')).outcome.state,'STATUS_OBSERVED');
   view=await project();assert.equal(view.deliveryConfirmed,true);assert.equal(view.automaticResendAllowed,false);
   await oa.service.process(ref);assert.equal(allPostsFor(ref.workerId).length,2);
  });
  await check('OWN-SEND_UNKNOWN-stays-uncertain-without-resend-or-template-search-and-only-a-signed-exact-status-observes-it',async()=>{
   const ref=await enrolOwn(oa,'unknown-status',{accept:false});oa.graph.sendMode='timeout';
   try{assert.equal((await oa.service.process(ref)).state,'SEND_UNKNOWN');}finally{oa.graph.sendMode='accepted';}
   assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);
   const lookups=oa.graph.lookups;await oa.service.process(ref);await oa.service.process(ref);
   assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);assert.equal(oa.graph.lookups,lookups);assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).outcome.state,'SEND_UNKNOWN');
   await ownStatus(ref,{phase:'ACCOUNT_INVITATION',signed:false});await ownStatus(ref,{phase:'ACCOUNT_INVITATION',tenant:ob}).catch(()=>null);
   assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).outcome.state,'SEND_UNKNOWN');
   await ownStatus(ref,{phase:'ACCOUNT_INVITATION'});
   const observed=(await envelope(ref.workerId,'ACCOUNT_INVITATION')).outcome;assert.equal(observed.state,'STATUS_OBSERVED');assert.equal(observed.messageId,postsFor(ref.workerId,'ACCOUNT_INVITATION')[0].messageId);
   assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);
  });
  await check('OWN-signed-status-before-the-dispatch-marker-cannot-consume-or-confirm-an-unsent-envelope',async()=>{
   for(const phase of bothPhases){
    const ref=await enrolOwn(oa,'status-before-'+phaseTag(phase),{accept:phase==='IDENTITY_START'}),svc=ownMake(oa,{afterPrepare:async()=>{throw Error('SYNTHETIC_PAUSE_FOR_STATUS');}});
    await svc.process(ref);assert.equal((await envelope(ref.workerId,phase)).outcome.state,'ONBOARDING_PENDING');
    await ownStatus(ref,{phase});assert.equal((await envelope(ref.workerId,phase)).outcome.state,'ONBOARDING_PENDING');assert.equal(postsFor(ref.workerId,phase).length,0);
   }
  });
  // ---- real revocation / removal of Own authority; no Customer catalog, service or provider may take over ----
  await check('OWN-revoked-runtime-grant-before-prepare-fails-closed-without-envelope-challenge-POST-or-customer-fallback',async()=>{
   for(const phase of bothPhases){
    const ref=await enrolOwn(oa,'grant-before-'+phaseTag(phase),{accept:phase==='IDENTITY_START'}),snapshot=await mutateConnection(oa,metadata=>{metadata.ownCompanyRuntime=revokedGrant(oa);},{enabled:false});
    try{
     await assert.rejects(ownAuthority(ref));assert.equal((await oa.service.process(ref)).state,'BLOCKED');assert.equal((await service.process(ref)).state,'BLOCKED');
     await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,phase),null);assert.equal(postsFor(ref.workerId,phase).length,0);
    }finally{await restoreConnection(oa,snapshot);}
    assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal(postsFor(ref.workerId,phase).length,1);
   }
  });
  await check('OWN-grant-revoked-after-prepare-preserves-the-sealed-envelope-sends-nothing-and-resumes-once-only-after-restoration',async()=>{
   const ref=await enrolOwn(oa,'grant-after-prepare',{accept:false});let snapshot=null;
   const svc=ownMake(oa,{afterPrepare:async()=>{snapshot=await mutateConnection(oa,metadata=>{metadata.ownCompanyRuntime=revokedGrant(oa);},{enabled:false});}});
   try{
    assert.equal((await svc.process(ref)).state,'BLOCKED');
    const pending=await envelope(ref.workerId,'ACCOUNT_INVITATION');assert.equal(pending.outcome.state,'ONBOARDING_PENDING');assert.equal(pending.attempts,0);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,0);
    assert.equal((await oa.service.process(ref)).state,'BLOCKED');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,0);
    await restoreConnection(oa,snapshot);snapshot=null;
    assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).payload.encryptedPayload,pending.payload.encryptedPayload);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);
   }finally{if(snapshot)await restoreConnection(oa,snapshot);}
  });
  await check('OWN-grant-revoked-after-the-durable-marker-never-reopens-the-attempt-and-restoring-it-does-not-resend',async()=>{
   const ref=await enrolOwn(oa,'grant-after-marker',{accept:false});let snapshot=null;
   const svc=ownMake(oa,{afterDispatchMarker:async()=>{snapshot=await mutateConnection(oa,metadata=>{metadata.ownCompanyRuntime=revokedGrant(oa);},{enabled:false});}});
   try{
    assert.equal((await svc.process(ref)).state,'SEND_STARTED');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,0);
    const marker=await envelope(ref.workerId,'ACCOUNT_INVITATION');assert.equal(marker.outcome.state,'SEND_STARTED');assert.equal(marker.attempts,1);
    await restoreConnection(oa,snapshot);snapshot=null;
    await oa.service.process(ref);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,0);assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).outcome.state,'SEND_STARTED');
   }finally{if(snapshot)await restoreConnection(oa,snapshot);}
  });
  await check('OWN-missing-or-mismatched-activation-receipt-fails-closed-before-any-prepare-or-POST',async()=>{
   const ref=await enrolOwn(oa,'receipt-fault',{accept:false}),original=(await query(`SELECT metadata FROM "AuditLog" WHERE id=$1`,[oa.receiptId])).rows[0].metadata;
   const putReceipt=()=>query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.own.number.recorded','WhatsAppConnection',$4,$5::jsonb)`,[oa.receiptId,oa.organizationId,oa.policyActorId,oa.channelId,JSON.stringify(original)]);
   try{
    await query(`DELETE FROM "AuditLog" WHERE id=$1`,[oa.receiptId]);
    await assert.rejects(ownAuthority(ref));assert.equal((await oa.service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);
    await putReceipt();
    await query(`UPDATE "AuditLog" SET metadata=jsonb_set(metadata,'{runtimeGrant,grantDigest}',to_jsonb($2::text)) WHERE id=$1`,[oa.receiptId,'f'.repeat(64)]);
    await assert.rejects(ownAuthority(ref));assert.equal((await oa.service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);
   }finally{await query(`DELETE FROM "AuditLog" WHERE id=$1`,[oa.receiptId]);await putReceipt();}
   assert.equal((await oa.service.process(ref)).state,'SENT');
  });
  await check('OWN-missing-or-stale-own-draft-never-falls-back-to-an-identical-customer-draft-in-either-phase',async()=>{
   for(const phase of bothPhases)for(const variant of ['missing','stale']){
    const key=phase==='ACCOUNT_INVITATION'?'participant_invitation':'participant_onboarding_v1',ref=await enrolOwn(oa,'draft-'+variant+'-'+phaseTag(phase),{accept:phase==='IDENTITY_START'});
    const snapshot=await mutateConnection(oa,metadata=>{const own=metadata.ownCompanyTemplateDrafts[key];metadata.customerTemplateDrafts={...metadata.customerTemplateDrafts,[key]:structuredClone(own)};if(variant==='missing')delete metadata.ownCompanyTemplateDrafts[key];else metadata.ownCompanyTemplateDrafts[key].grantDigest='e'.repeat(64);});
    try{
     const result=await oa.service.process(ref);assert.equal(result.state,'BLOCKED');assert.equal(result.code,'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');
     await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,phase),null);assert.equal(postsFor(ref.workerId,phase).length,0);
    }finally{await restoreConnection(oa,snapshot);}
   }
  });
  await check('OWN-markers-removed-after-reservation-with-identical-customer-drafts-cannot-downgrade-to-the-customer-path',async()=>{
   for(const phase of bothPhases){
    const ref=await enrolOwn(oa,'downgrade-'+phaseTag(phase),{accept:phase==='IDENTITY_START'});let snapshot=null;
    const svc=ownMake(oa,{afterPrepare:async()=>{snapshot=await mutateConnection(oa,metadata=>{metadata.customerTemplateDrafts=structuredClone(metadata.ownCompanyTemplateDrafts);delete metadata.ownCompany;delete metadata.ownCompanyRuntime;});}});
    try{
     assert.equal((await svc.process(ref)).state,'BLOCKED');
     const pending=await envelope(ref.workerId,phase);assert.equal(pending.outcome.state,'ONBOARDING_PENDING');assert.equal(pending.attempts,0);assert.equal(postsFor(ref.workerId,phase).length,0);
     assert.equal((await service.process(ref)).state,'BLOCKED');assert.equal(postsFor(ref.workerId,phase).length,0);assert.equal((await envelope(ref.workerId,phase)).attempts,0);
     await restoreConnection(oa,snapshot);snapshot=null;
     assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal((await envelope(ref.workerId,phase)).payload.encryptedPayload,pending.payload.encryptedPayload);assert.equal(postsFor(ref.workerId,phase).length,1);
    }finally{if(snapshot)await restoreConnection(oa,snapshot);}
   }
  });
  await check('OWN-original-owner-membership-loss-and-issuer-role-loss-fail-closed-before-prepare',async()=>{
   for(const [label,membershipId] of [['owner',oa.ownerMembershipId],['issuer',oa.issuerMembershipId]]){
    const ref=await enrolOwn(oa,'role-loss-'+label,{accept:false});await setMembershipRole(membershipId,'AUDITOR');
    try{await assert.rejects(ownAuthority(ref));assert.equal((await oa.service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,'ACCOUNT_INVITATION'),null);assert.equal(allPostsFor(ref.workerId).length,0);}
    finally{await setMembershipRole(membershipId,'ADMIN');}
    assert.equal((await oa.service.process(ref)).state,'SENT');
   }
  });
  await check('OWN-target-assignment-revoked-fails-closed-without-falling-back-to-the-anchor',async()=>{
   const ref=await enrolOwn(oa,'assignment-revoked',{accept:false});
   await query(`UPDATE "WhatsAppChannelProjectAssignment" SET status='REVOKED',revision=revision+1 WHERE "connectionId"=$1 AND "projectId"=$2`,[oa.channelId,oa.projectId]);
   try{await assert.rejects(ownAuthority(ref));assert.equal((await oa.service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);assert.equal(allPostsFor(ref.workerId).length,0);}
   finally{await query(`UPDATE "WhatsAppChannelProjectAssignment" SET status='ACTIVE',revision=revision+1 WHERE "connectionId"=$1 AND "projectId"=$2`,[oa.channelId,oa.projectId]);}
   assert.equal((await oa.service.process(ref)).state,'SENT');
  });
  await check('OWN-same-phone-in-another-active-worksite-of-the-same-own-channel-is-ambiguous-and-mints-nothing',async()=>{
   const ref=await enrolOwn(oa,'duplicate',{accept:false}),w=await worker(ref.workerId);
   await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata) VALUES('own-duplicate-anchor',$1,'Synthetic duplicate',$2,'WORKER',$3::jsonb)`,[oa.anchorProjectId,w.phone,JSON.stringify(w.metadata)]);
   try{await assert.rejects(ownAuthority(ref),{code:'PARTICIPANT_ONBOARDING_RECIPIENT_AMBIGUOUS'});assert.equal((await oa.service.process(ref)).state,'BLOCKED');await assertUnprepared(ref);}
   finally{await query(`DELETE FROM "Worker" WHERE id='own-duplicate-anchor'`);}
  });
  // ---- Meta template state is observed from the owned account only; any change stops the attempt without a POST ----
  await check('OWN-unapproved-changed-or-missing-remote-template-stops-before-prepare-in-both-phases',async()=>{
   for(const phase of bothPhases)for(const mode of ['pending','changed','missing']){
    const ref=await enrolOwn(oa,'tpl-'+mode+'-'+phaseTag(phase),{accept:phase==='IDENTITY_START'});oa.graph.lookupMode=mode;
    try{assert.equal((await oa.service.process(ref)).code,'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,phase),null);assert.equal(postsFor(ref.workerId,phase).length,0);}
    finally{oa.graph.lookupMode='approved';}
   }
  });
  await check('OWN-remote-template-approval-lost-after-prepare-sends-nothing-preserves-the-sealed-envelope-and-resumes-once',async()=>{
   for(const phase of bothPhases){
    const ref=await enrolOwn(oa,'tpl-after-'+phaseTag(phase),{accept:phase==='IDENTITY_START'}),svc=ownMake(oa,{afterPrepare:async()=>{oa.graph.lookupMode='pending';}});
    let pending=null;
    try{assert.equal((await svc.process(ref)).state,'BLOCKED');assert.equal(postsFor(ref.workerId,phase).length,0);pending=await envelope(ref.workerId,phase);assert.equal(pending.attempts,0);assert.equal(pending.outcome.state,'ONBOARDING_PENDING');}
    finally{oa.graph.lookupMode='approved';}
    assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal((await envelope(ref.workerId,phase)).payload.encryptedPayload,pending.payload.encryptedPayload);assert.equal(postsFor(ref.workerId,phase).length,1);
   }
  });
  await check('OWN-remote-template-definition-changing-immediately-before-the-POST-sends-nothing-and-leaves-SEND_UNKNOWN-without-replay',async()=>{
   for(const phase of bothPhases){
    const ref=await enrolOwn(oa,'tpl-before-post-'+phaseTag(phase),{accept:phase==='IDENTITY_START'});
    // Flip only the lookup that happens after the marker has committed (a plain MVCC read; no DB write inside the callback).
    oa.graph.beforeLookup=async graph=>{const row=(await query(`SELECT outcome->>'state' AS state FROM "WebhookEvent" WHERE provider='meta-customer-outbound-v1' AND payload->>'workerId'=$1 AND payload->>'onboardingPhase'=$2`,[ref.workerId,phase])).rows[0];if(row?.state==='SEND_STARTED')graph.lookupMode='changed';};
    try{
     assert.equal((await oa.service.process(ref)).state,'SEND_UNKNOWN');assert.equal(postsFor(ref.workerId,phase).length,0);
     const e=await envelope(ref.workerId,phase);assert.equal(e.outcome.state,'SEND_UNKNOWN');assert.equal(e.attempts,1);
     await oa.service.process(ref);assert.equal(postsFor(ref.workerId,phase).length,0);assert.equal((await envelope(ref.workerId,phase)).attempts,1);
    }finally{oa.graph.beforeLookup=async()=>{};oa.graph.lookupMode='approved';}
   }
  });
  // ---- real row-lock barriers: an independent session holds the lock; blocking is observed in pg_locks state ----
  const memberLoss=`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR',"updatedAt"=clock_timestamp() WHERE id=$1`;
  await check('OWN-lock-barrier-original-owner-membership-blocks-the-canonical-authority-then-a-committed-loss-denies-before-prepare-or-POST',async()=>{
   const ref=await enrolOwn(oa,'barrier-owner-commit',{accept:false});
   try{
    const {outcome,evidence}=await withRowBarrier({label:'owner-membership-committed-loss',sql:memberLoss,args:[oa.ownerMembershipId],release:'commit'},()=>oa.service.process(ref));
    assert.ok(evidence.waiters>=1);assert.equal(outcome.state,'BLOCKED');await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,'ACCOUNT_INVITATION'),null);assert.equal(allPostsFor(ref.workerId).length,0);
   }finally{await setMembershipRole(oa.ownerMembershipId,'ADMIN');}
   assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);
  });
  await check('OWN-lock-barrier-original-owner-membership-wait-then-rollback-proceeds-and-sends-exactly-once',async()=>{
   const ref=await enrolOwn(oa,'barrier-owner-rollback',{accept:false});
   const {outcome,evidence}=await withRowBarrier({label:'owner-membership-rollback',sql:memberLoss,args:[oa.ownerMembershipId],release:'rollback'},()=>oa.service.process(ref));
   assert.ok(evidence.waiters>=1);assert.equal(outcome.state,'SENT');assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).attempts,1);
   assert.equal((await query(`SELECT "tenantRole"::text AS role FROM "TenantMembership" WHERE id=$1`,[oa.ownerMembershipId])).rows[0].role,'ADMIN');
  });
  await check('OWN-lock-barrier-original-connection-row-blocks-the-canonical-authority-then-a-committed-disable-denies-before-prepare-or-POST',async()=>{
   const ref=await enrolOwn(oa,'barrier-connection',{accept:false}),snapshot=await connectionRow(oa);
   try{
    const {outcome,evidence}=await withRowBarrier({label:'connection-committed-disable',sql:`UPDATE "WhatsAppConnection" SET enabled=false,"updatedAt"=clock_timestamp() WHERE id=$1`,args:[oa.channelId],release:'commit'},()=>oa.service.process(ref));
    assert.ok(evidence.waiters>=1);assert.equal(outcome.state,'BLOCKED');await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,'ACCOUNT_INVITATION'),null);assert.equal(allPostsFor(ref.workerId).length,0);
   }finally{await restoreConnection(oa,snapshot);}
   assert.equal((await oa.service.process(ref)).state,'SENT');
  });
  await check('OWN-lock-barrier-target-assignment-row-blocks-the-canonical-authority-then-a-committed-revocation-denies-before-prepare-or-POST',async()=>{
   const ref=await enrolOwn(oa,'barrier-assignment',{accept:false});
   try{
    const {outcome,evidence}=await withRowBarrier({label:'assignment-committed-revocation',sql:`UPDATE "WhatsAppChannelProjectAssignment" SET status='REVOKED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1 AND "projectId"=$2`,args:[oa.channelId,oa.projectId],release:'commit'},()=>oa.service.process(ref));
    assert.ok(evidence.waiters>=1);assert.equal(outcome.state,'BLOCKED');await assertUnprepared(ref);assert.equal(await envelope(ref.workerId,'ACCOUNT_INVITATION'),null);assert.equal(allPostsFor(ref.workerId).length,0);
   }finally{await query(`UPDATE "WhatsAppChannelProjectAssignment" SET status='ACTIVE',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1 AND "projectId"=$2`,[oa.channelId,oa.projectId]);}
   assert.equal((await oa.service.process(ref)).state,'SENT');
  });
  await check('OWN-lock-barrier-after-prepare-owner-membership-wait-then-committed-loss-preserves-the-sealed-envelope-and-resumes-once-after-restore',async()=>{
   const ref=await enrolOwn(oa,'barrier-mid-flight',{accept:false});let barrier=null,watcher=null,evidence=null,result=null;
   // The hook runs between transactions. The watcher releases the holder as soon as the real wait is observed; the service
   // transaction never waits for anything this test does, so the cycle "holder waits for service" cannot form.
   const svc=ownMake(oa,{afterPrepare:async()=>{barrier=await barrierOpen(memberLoss,[oa.ownerMembershipId]);watcher=(async()=>{try{evidence=await barrierWaitBlocked(barrier,'owner-membership-after-prepare');}finally{await barrierClose(barrier,'commit');}})();watcher.catch(()=>{});}});
   let pending=null;
   try{
    result=await svc.process(ref);await watcher;
    assert.ok(evidence.waiters>=1);assert.equal(result.state,'BLOCKED');
    pending=await envelope(ref.workerId,'ACCOUNT_INVITATION');assert.equal(pending.outcome.state,'ONBOARDING_PENDING');assert.equal(pending.attempts,0);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,0);
   }finally{if(barrier)await barrierClose(barrier,'rollback');await setMembershipRole(oa.ownerMembershipId,'ADMIN');}
   assert.equal((await oa.service.process(ref)).state,'SENT');assert.equal((await envelope(ref.workerId,'ACCOUNT_INVITATION')).payload.encryptedPayload,pending.payload.encryptedPayload);assert.equal(postsFor(ref.workerId,'ACCOUNT_INVITATION').length,1);
  });
  await check('OWN-final-public-read-has-no-secrets-every-authority-row-is-restored-and-no-catalog-was-copied',async()=>{
   for(const o of ownTenants){
    const row=await connectionRow(o);assert.equal(row.enabled,true);assert.deepEqual(row.metadata,o.seededMetadata);assert.equal(Object.hasOwn(row.metadata,'customerTemplateDrafts'),false);
    assert.deepEqual((await query(`SELECT "tenantRole"::text AS role FROM "TenantMembership" WHERE id=ANY($1::text[]) ORDER BY id`,[[o.ownerMembershipId,o.issuerMembershipId]])).rows.map(r=>r.role),['ADMIN','ADMIN']);
    assert.deepEqual((await query(`SELECT status FROM "WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 ORDER BY "projectId"`,[o.channelId])).rows.map(r=>r.status),['ACTIVE','ACTIVE']);
    assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE id=$1`,[o.receiptId])).rows[0].n,1);
   }
   for(const t of [a,b]){const row=(await query(`SELECT metadata FROM "WhatsAppConnection" WHERE id=$1`,[t.channelId])).rows[0];for(const key of ['ownCompany','ownCompanyRuntime','ownCompanyTemplateDrafts'])assert.equal(Object.hasOwn(row.metadata,key),false);}
   assert.equal(ownHolders.size,0);
   const current=await workspace.list(session(oa)),view=await participant.read(session(oa),{scope:current.scope,projectId:oa.projectId}),serialized=JSON.stringify(view);
   for(const secret of ['IDENTIDAD ',oa.token,ob.token,'encryptedPayload','encryptedAccessToken','codeDigest','issuerAuthorityDigest','onboarding_contact_','ownCompanyRuntime','ownOnboarding','grantDigest','tokenDigest'])assert.equal(serialized.includes(secret),false,'PUBLIC_OWN_ONBOARDING_SECRET: '+secret);
   for(const table of ['Task','AttendanceEntry','OperationalProposal','WhatsAppCompanyEventRoute','WhatsAppCompanyRoute'])assert.equal((await query('SELECT count(*)::int AS n FROM "'+table+'"')).rows[0].n,0);
   assert.equal(networkCalls,0);assert.deepEqual(unexpected,[]);assertStableSource();
  });
  const ownPosts=posts.filter(post=>post.catalog==='OWN_COMPANY');
  ownEvidence={ownChecks:checks.slice(ownBaseline),ownCheckCount:checks.length-ownBaseline,companies:ownTenants.length,envelopeVersion:3,controlledOwnProviderPosts:ownPosts.length,controlledOwnProviderPostsByPhase:{ACCOUNT_INVITATION:ownPosts.filter(post=>post.phase==='ACCOUNT_INVITATION').length,IDENTITY_START:ownPosts.filter(post=>post.phase==='IDENTITY_START').length},controlledOwnProviderLookups:ownTenants.reduce((n,o)=>n+o.graph.lookups,0),controlledOwnOtherGraphRoutes:ownTenants.reduce((n,o)=>n+o.graph.otherRoutes.length,0),rowLockBarriers:ownBarrierEvidence,concurrentFollowers:ownConcurrencyEvidence,ownCatalogCopiedToCustomer:false,customerFallbackAllowed:false,realProviderRequests:0,productionDataWritten:false,realMetaAccepted:false,physicalPilotAccepted:false,realCatalogReconciliation:'NOT_ADDRESSED_BY_THIS_SYNTHETIC_RUN'};
 }finally{
  for(const holder of [...ownHolders]){try{await holder.query('ROLLBACK');}catch{}ownHolders.delete(holder);try{holder.release(true);}catch{}}
 }
 passed=true;
}finally{
 try{await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_onboarding_delivery_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');assert.equal((await admin.query('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) AS present',[schema])).rows[0].present,false);schemaRemoved=true;}}finally{try{await admin.end();}finally{globalThis.fetch=originalFetch;}}
}
assert.equal(passed,true);assert.equal(schemaRemoved,true);assert.equal(networkCalls,0);assertStableSource();
const proof={status:'PASS',checkedAt:new Date().toISOString(),environment:'random-schema-existing-disposable-localhost-postgresql',checks,checkCount:checks.length,sourceManifest,harnessSha256,...initialSourceState,databaseCreated:false,schemaRemoved,controlledProviderPosts:posts.length,controlledProviderPostsByPhase:{ACCOUNT_INVITATION:posts.filter(post=>post.phase==='ACCOUNT_INVITATION').length,IDENTITY_START:posts.filter(post=>post.phase==='IDENTITY_START').length},deliveryVersion:2,currentKycConsentVersion:3,controlledProviderLookups:[...assets.values()].reduce((n,t)=>n+t.lookups,0),realProviderRequests:0,unexpectedNetworkCalls:networkCalls,productionDataWritten:false,realClerkLogin:false,realMetaAccepted:false,physicalPilotAccepted:false,coverageBoundary:'real canonical SQL and actual signed callbacks; controlled Clerk/Graph fixtures only'};
assert.ok(ownEvidence);proof.ownOnboarding=ownEvidence;
mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({status:proof.status,groups:proof.checkCount,output,schemaRemoved,realProviderRequests:0,productionDataWritten:false}));
