import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleDisposableUrl,lifecycleEnvironment,lifecycleSchema,lifecycleTenants,lifecyclePng,createControlledLifecycleGraph,createControlledLifecycleClerk,createControlledLifecycleBlob} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createCustomerWhatsAppSetup} from '../src/lib/customer-whatsapp-setup.mjs';
import {createSiteRegister} from '../src/lib/site-register-store.mjs';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createPrivateImageUploader} from '../src/lib/private-image-upload.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {createFieldMedia} from '../src/lib/field-media.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerOnboarding} from '../src/lib/meta-customer-onboarding.mjs';
import {createMetaCustomerHandlers} from '../src/lib/meta-customer-http.mjs';
import {decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createWorkerChannelStore,resolveWorkerChannelIdentity} from '../src/lib/worker-channel-identity.mjs';
import {createWorkerChannelHandlers} from '../src/lib/worker-channel-http.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaFieldBridge} from '../src/lib/meta-field-bridge.mjs';
import {createMetaCustomerOutbound,customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {createMetaCustomerProcessor,createMetaCustomerJobHandlers,signMetaCustomerJob} from '../src/lib/meta-customer-processing.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createParticipantChannelKycDeposit} from '../src/lib/participant-channel-kyc.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';

// Check the explicitly disposable target before constructing a client or engine.
const url=lifecycleDisposableUrl(process.env),database='obrasaas_meta_lifecycle_'+randomUUID().replaceAll('-','');
assert.match(database,/^obrasaas_meta_lifecycle_[a-f0-9]{32}$/);
const admin=new Client({connectionString:url.toString()}),environment={...lifecycleEnvironment},checks=[];
const graph=createControlledLifecycleGraph(environment),clerk=createControlledLifecycleClerk(),blob=createControlledLifecycleBlob();
let pool,created=false,failBridgeAudit=false,loseBridgeCommit=false,analyses=0,unexpectedNetworkCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{unexpectedNetworkCalls++;throw new Error('LIFECYCLE_UNCONTROLLED_NETWORK_REJECTED');};
// These web identities are an explicit controlled verifier fixture, not JWTs
// issued by Clerk or an authority used by the channel bridge.
const owner=tenant=>({authenticated:true,verification:'clerk-production-jwt',userId:tenant.ownerUserId,organizationId:tenant.clerkOrganizationId,organizationRole:'org:admin'});
const person=tenant=>({...owner(tenant),userId:tenant.workerUserId,organizationRole:'org:member'});
const post=(endpoint,body)=>new Request('https://obrasaas.com'+endpoint,{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify(body)});
const query=(sql,args)=>(pool.query(sql,args));
const scheduled=[];
// Two complete, deterministic 1px PNG files: each new capture has different
// bytes, rather than changing only a media ID around the rejected image.
function capturePng(rgb){
 const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,...rgb]))),chunk('IEND',Buffer.alloc(0))]);
}
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;
 pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8}));
 await query(lifecycleSchema);
 for(const tenant of lifecycleTenants){
  await query(`INSERT INTO "Organization" VALUES($1,$2,$3,'{}');`,[tenant.organizationId,'Synthetic company '+tenant.key,tenant.clerkOrganizationId]);
  await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3);`,[tenant.ownerId,tenant.ownerUserId,'owner-'+tenant.key+'@example.invalid']);
  await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['owner-member-'+tenant.key,tenant.ownerId,tenant.organizationId]);
  await query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{"retained":true}')`,[tenant.projectId,tenant.organizationId,'Obra sintética '+tenant.key.toUpperCase()]);
  await query(`INSERT INTO "Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata) VALUES($1,$2,$3,'BACKLOG',0,'2026-10-01','2026-10-10','{}')`,['task-'+tenant.key,tenant.projectId,'Tarea sintética '+tenant.key.toUpperCase()]);
 }
 const connect=async()=>{
  const client=await pool.connect();let bridgeWritten=false;
  return {release:broken=>client.release(broken),query:async(sql,args)=>{
   const dispatchAudit=sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'meta.field.dispatched'");
   if(dispatchAudit&&failBridgeAudit)throw new Error('SYNTHETIC_LIFECYCLE_AUDIT_FAILURE');
   const result=await client.query(sql,args);if(dispatchAudit)bridgeWritten=true;
   if(sql==='COMMIT'&&bridgeWritten&&loseBridgeCommit){loseBridgeCommit=false;throw new Error('SYNTHETIC_LIFECYCLE_COMMIT_ACK_LOST');}
   return result;
  }};
 };
 const workspace=createWorkspaceStore({connect}),setup=createCustomerWhatsAppSetup({workspace}),roster=createSiteRegister({workspace});
 const identity=createParticipantIdentityProvider({client:clerk.client,environment:()=>environment});
 const upload=createPrivateImageUploader({get:blob.get,put:blob.put,environment:()=>environment});
 const participants=createParticipantStore({workspace,connect,identity,upload:upload.uploadImageToBlob,get:blob.get,prepareKycChat:prepareMetaKycChallenge});
 const channel=createWorkerChannelStore({workspace}),operations=createFieldOperations({workspace});
 const analyzer={analyzePhoto:async()=>{analyses++;return {success:true,status:'ANALYZED_UNREVIEWED',aiAnalysis:'Controlled synthetic analysis; human review required.',requiresHumanReview:true};},transcribeAudio:async()=>({success:false,code:'SYNTHETIC_AUDIO_NOT_REQUESTED'})};
 const media=createFieldMedia({operations,get:blob.get,put:blob.put,analyzer,environment:()=>environment});
 const provider=createMetaCustomerProvider({environment,fetchImpl:graph.fetchImpl});
 const runtime=()=>{
  const bridge=createMetaFieldBridge({connect,environment,provider,get:blob.get,put:blob.put,analyzer});
  const outbound=createMetaCustomerOutbound({connect,resolveIdentity:resolveWorkerChannelIdentity,provider,environment});
  const deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload:upload.uploadImageToBlob,environment});
  const kycBridge=createMetaKycBridge({connect,provider,deposit,environment}),kycOutbound=createMetaKycOutbound({connect,provider,environment});
  const processor=createMetaCustomerProcessor({connect,dispatch:async context=>(await kycBridge.execute(context))||bridge.execute(context),authorizationCodes:META_KYC_AUTHORIZATION_CODES,outbound:{send:(context,reply,{purpose}={})=>purpose==='KYC_CAPTURE'?kycOutbound.send(context,reply):outbound.send(context,reply),observeStatus:(...args)=>outbound.observeStatus(...args)},environment});
  return {bridge,outbound,processor};
 };
 let engines=runtime();
 const onboarding=createMetaCustomerOnboarding({workspace,provider,processor:{process:id=>engines.processor.process(id)},environment});
 for(const tenant of lifecycleTenants){
  tenant.owner=owner(tenant);tenant.person=person(tenant);
  tenant.ownerContext={projectId:tenant.projectId,scope:(await workspace.list(tenant.owner)).scope};
  tenant.command=(action,extra={})=>({...tenant.ownerContext,operationId:randomUUID(),action,...extra});
  tenant.web=createMetaCustomerHandlers({verify:async()=>tenant.owner,service:onboarding});
 }
 const [a,b]=lifecycleTenants;
 const invoke=async(tenant,body)=>{const response=await tenant.web.POST(post('/api/identity/meta-onboarding',body));const result=await response.json();assert.equal(response.status,200,result.code);assert.match(response.headers.get('cache-control'),/no-store/);return result;};
 for(const tenant of lifecycleTenants){
  const before=await setup.read(tenant.owner,tenant.ownerContext);
  await setup.save(tenant.owner,{...tenant.ownerContext,operationId:randomUUID(),profile:{assistantName:'Asistente sintético '+tenant.key,numberMode:'DEDICATED',initialProjectId:tenant.projectId,useCases:['FIELD_REPORTS','MATERIAL_REQUESTS','SCHEDULE_QUERIES'],expectedRevision:before.profile.revision,confirmOwnership:true}});
  tenant.start=await invoke(tenant,tenant.command('begin',{preparedRevision:1}));assert.equal(tenant.start.signup.state,'PREPARED');assert.ok(tenant.start.stateToken);
  assert.equal(tenant.start.acceptance.roundTrip,'NOT_VERIFIED');assert.equal(tenant.start.readiness.humanAcceptance,'NOT_VERIFIED');
 }
 checks.push('controlled-web-session-canonical-dedicated-preparation-and-signup-do-not-grant-acceptance');
 graph.setBeforeRequest(async(asset,endpoint,body)=>{
  if(endpoint===asset.phoneNumberId+'/register'){
   const stored=(await query(`SELECT metadata->'metaSignup' AS signup FROM "Project" WHERE id=$1`,[asset.projectId])).rows[0].signup;
   const connection=(await query(`SELECT "encryptedPin" FROM "WhatsAppConnection" WHERE "projectId"=$1`,[asset.projectId])).rows[0];
   assert.equal(stored.state,'REGISTRATION_STARTED');assert.ok(connection.encryptedPin.startsWith('v2.'));assert.ok(!JSON.stringify(stored).includes(body.pin));
  }
  if(endpoint===asset.phoneNumberId+'/messages'){
   const reserved=(await query(`SELECT payload,outcome FROM "WebhookEvent" WHERE id=$1 AND "projectId"=$2`,[body.biz_opaque_callback_data,asset.projectId])).rows[0];
   assert.equal(reserved.outcome.state,'SEND_STARTED');assert.ok(reserved.payload.encryptedPayload.startsWith('v2.'));assert.ok(!JSON.stringify(reserved).includes(asset.sender));
  }
 });
 const complete=tenant=>tenant.command('complete',{signupId:tenant.start.signup.id,stateToken:tenant.start.stateToken,code:tenant.code,wabaId:tenant.wabaId,phoneNumberId:tenant.phoneNumberId});
 const aComplete=complete(a);await Promise.all([invoke(a,aComplete),invoke(a,aComplete)]);
 assert.equal(graph.assets.get('a').exchanges,1);assert.equal(graph.assets.get('a').subscriptions,1);
 const cross=await b.web.POST(post('/api/identity/meta-onboarding',{...complete(b),wabaId:a.wabaId,phoneNumberId:a.phoneNumberId}));assert.equal(cross.status,409);assert.equal((await cross.json()).code,'META_CUSTOMER_ASSET_ALREADY_BOUND');
 const demo=await b.web.POST(post('/api/identity/meta-onboarding',{...complete(b),wabaId:OBRASAAS_META_CHANNEL.wabaId,phoneNumberId:OBRASAAS_META_CHANNEL.phoneNumberId}));assert.equal(demo.status,403);assert.equal((await demo.json()).code,'META_CUSTOMER_DEMO_ASSET_REJECTED');assert.equal(graph.assets.get('b').exchanges,0);
 await invoke(b,complete(b));
 checks.push('two-tenants-have-one-exchange-each-and-demo-or-other-tenant-assets-are-rejected-before-provider');
 for(const tenant of lifecycleTenants){
  const connection=(await query(`SELECT * FROM "WhatsAppConnection" WHERE "projectId"=$1`,[tenant.projectId])).rows[0];tenant.channelId=connection.id;
  assert.equal(connection.enabled,false);assert.equal(connection.connectionStatus,'PENDING');
  assert.equal(decryptCustomerSecret(connection.encryptedAccessToken,{organizationId:tenant.organizationId,projectId:tenant.projectId,purpose:'access-token',resourceId:tenant.phoneNumberId},environment),tenant.token);
  assert.throws(()=>decryptCustomerSecret(connection.encryptedAccessToken,{organizationId:tenant===a?b.organizationId:a.organizationId,projectId:tenant.projectId,purpose:'access-token',resourceId:tenant.phoneNumberId},environment),{code:'META_CUSTOMER_CREDENTIAL_SCOPE_REJECTED'});
  assert.equal((await onboarding.read(tenant.owner,tenant.ownerContext)).signup.state,'REGISTRATION_REQUIRED');
 }
 graph.assets.get('a').registerResponseLost=true;
 const aRegistration=a.command('register_number',{signupId:a.start.signup.id,pin:'731902',confirmRegistration:true});
 const aRegistered=await invoke(a,aRegistration);assert.equal(aRegistered.signup.state,'LINKED_PENDING_ACCEPTANCE');assert.equal(aRegistered.connection.enabled,false);
 await invoke(a,aRegistration);assert.equal(graph.assets.get('a').registrations,1);a.expectedRegistrations=1;
 checks.push('real-Graph-adapter-escrows-tenant-AAD-credential-and-PIN-before-one-register-and-recovers-lost-response-readonly');
 graph.assets.get('b').registerRejectedOnce=true;
 const bRejected=b.command('register_number',{signupId:b.start.signup.id,pin:'731902',confirmRegistration:true});
 const rejected=await invoke(b,bRejected);assert.equal(rejected.signup.state,'REGISTRATION_REJECTED');assert.equal(rejected.signup.canRegister,true);assert.equal(rejected.signup.canRetryRegistration,true);assert.equal(rejected.connection.enabled,false);
 await invoke(b,bRejected);assert.equal(graph.assets.get('b').registrations,1);
 const conflicting=await b.web.POST(post('/api/identity/meta-onboarding',{...bRejected,pin:'731903'}));assert.equal(conflicting.status,409);assert.equal((await conflicting.json()).code,'META_CUSTOMER_OPERATION_CONFLICT');
 const noConsent=await b.web.POST(post('/api/identity/meta-onboarding',b.command('register_number',{signupId:b.start.signup.id,pin:'731903',confirmRegistration:false})));assert.equal(noConsent.status,400);assert.equal((await noConsent.json()).code,'META_CUSTOMER_REGISTRATION_INPUT_INVALID');assert.equal(graph.assets.get('b').registrations,1);
 checks.push('definitive-register-rejection-preserves-UUID-replay-and-requires-new-explicit-consent-and-PIN-without-automatic-retry');
 graph.assets.get('b').registerPendingOnce=true;
 const bUncertain=b.command('register_number',{signupId:b.start.signup.id,pin:'731903',confirmRegistration:true});
 const uncertain=await invoke(b,bUncertain);assert.equal(uncertain.signup.state,'REGISTRATION_UNKNOWN');assert.equal(uncertain.signup.canRegister,false);assert.equal(uncertain.signup.canRetryRegistration,false);assert.equal(uncertain.connection.enabled,false);
 await invoke(b,bUncertain);assert.equal(graph.assets.get('b').registrations,2);
 const forbiddenRetry=await b.web.POST(post('/api/identity/meta-onboarding',b.command('register_number',{signupId:b.start.signup.id,pin:'731904',confirmRegistration:true})));assert.equal(forbiddenRetry.status,409);assert.equal((await forbiddenRetry.json()).code,'META_CUSTOMER_REGISTRATION_UNAVAILABLE');assert.equal(graph.assets.get('b').registrations,2);
 // This models eventual provider observation only; no canonical database status is changed by the fixture.
 graph.assets.get('b').registered=true;
 const observed=await invoke(b,b.command('reconcile',{signupId:b.start.signup.id}));assert.equal(observed.signup.state,'LINKED_PENDING_ACCEPTANCE');assert.equal(observed.connection.enabled,false);assert.equal(graph.assets.get('b').registrations,2);b.expectedRegistrations=2;
 const attemptState=(await query(`SELECT metadata->'metaSignup' AS signup FROM "Project" WHERE id=$1`,[b.projectId])).rows[0].signup;
 assert.equal(attemptState.registrationAttempts.length,2);assert.equal(attemptState.registrationAttempts[0].operationId,bRejected.operationId);assert.equal(attemptState.registrationAttempts[0].state,'REJECTED');assert.equal(attemptState.registrationAttempts[1].operationId,bUncertain.operationId);assert.equal(attemptState.registrationAttempts[1].state,'REGISTERED');
 for(const attempt of attemptState.registrationAttempts){assert.equal(attempt.pinDigestScheme,'hmac-sha256-v1');assert.match(attempt.pinDigest,/^[a-f0-9]{64}$/);}
 for(const pin of ['731902','731903','731904'])assert.ok(!JSON.stringify(attemptState).includes(pin));
 checks.push('UNKNOWN-register-blocks-new-POST-and-recovers-readonly-with-versioned-tenant-bound-PIN-attempt-history-before-activation');
 for(const tenant of lifecycleTenants){
  const added=await roster.save(tenant.owner,{...tenant.ownerContext,operationId:randomUUID(),action:'ADD_PERSON',payload:{name:'Participante sintético '+tenant.key,phone:'+'+tenant.sender,job:'WORKER'}});tenant.workerId=added.person.id;
  const first=(await participants.read(tenant.owner,tenant.ownerContext)).records.find(row=>row.id===tenant.workerId);
  const invited=await participants.save(tenant.owner,{...tenant.ownerContext,operationId:randomUUID(),action:'INVITE',payload:{workerId:tenant.workerId,revision:first.revision,email:tenant.workerEmail}});
  clerk.invitations.get(invited.participant.invitation.id).status='accepted';
  const joined=await participants.join(tenant.person,{invitationId:invited.participant.invitation.id,operationId:randomUUID()},{accept:true});assert.equal(joined.joined,true);
  tenant.personContext={projectId:tenant.projectId,scope:(await workspace.list(tenant.person)).scope};
  tenant.channelWeb=createWorkerChannelHandlers({verify:async()=>tenant.person,store:channel});
  const own=(await participants.read(tenant.person,tenant.personContext)).records[0];
  const unavailable=await channel.read(tenant.person,tenant.personContext);assert.equal(unavailable.records[0].eligible,false);
  const kyc=await participants.submitKyc(tenant.person,{...tenant.personContext,operationId:randomUUID(),workerId:tenant.workerId,revision:own.revision,noticeVersion:'participant-kyc-v1',consent:true,front:lifecyclePng.toString('base64'),selfie:lifecyclePng.toString('base64')});assert.equal(kyc.participant.kyc.status,'PENDING_REVIEW');
  for(const image of kyc.participant.kyc.images)assert.deepEqual((await participants.downloadKyc(tenant.owner,{...tenant.ownerContext,workerId:tenant.workerId,imageId:image.id})).bytes,lifecyclePng);
  const review={...tenant.ownerContext,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:tenant.workerId,revision:kyc.participant.revision,submissionId:kyc.participant.kyc.submissionId,decision:tenant===b?'REJECTED':'APPROVED',reason:tenant===b?'Controlled human reviewer requests a new document and selfie capture.':'Controlled distinct reviewer checked both synthetic private images.'}};
  const reviewed=await participants.save(tenant.owner,review);assert.equal(reviewed.participant.kyc.status,review.payload.decision);
  tenant.initialReview=review;
  if(tenant===b){tenant.rejectedReview=review;tenant.rejectedSubmissionId=kyc.participant.kyc.submissionId;}
  await operations.save(tenant.owner,{...tenant.ownerContext,operationId:randomUUID(),action:'CONFIGURE_SITE',payload:{revision:(await operations.read(tenant.owner,tenant.ownerContext)).projectRevision,sectors:[{id:'sector-'+tenant.key,name:'Sector sintético '+tenant.key.toUpperCase(),latitude:0,longitude:0,radius:100}]}});
 }
 assert.equal(clerk.sent(),2);assert.equal(blob.puts(),4);
 checks.push('actual-roster-invitation-accepted-provider-membership-private-KYC-and-distinct-canonical-review-approve-A-and-reject-B');
 await assert.rejects(onboarding.command(b.owner,{...a.command('activate_channel',{confirmActivation:true}),scope:b.ownerContext.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 for(const tenant of lifecycleTenants){
  const activation=tenant.command('activate_channel',{confirmActivation:true});const current=await invoke(tenant,activation);
  assert.equal(current.activation.operational,true);assert.equal(current.connection.enabled,true);assert.equal(current.connection.storedStatus,'CONNECTED');assert.equal(current.activation.roundTrip,'NOT_VERIFIED');
  await invoke(tenant,activation);assert.equal(graph.assets.get(tenant.key).registrations,tenant.expectedRegistrations);
  assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "organizationId"=$1 AND action='integration.whatsapp.customer.activated'`,[tenant.organizationId])).rows[0].n,1);
 }
 checks.push('explicit-owner-activation-uses-fresh-actual-provider-app-WA2-registration-and-subscription-without-human-acceptance');
 const inbox=createMetaCustomerInbox({connect,environment}),callback=createMetaCustomerCallbackHandlers({inbox,environment,schedule:ids=>{scheduled.push(...ids);}});
 // Monotonic seconds keep KYC choices ordered while staying inside VINCULAR's
 // real challenge clock window (30s past tolerance, 60s future tolerance).
 const messageEpoch=Math.floor(Date.now()/1000)-10,messageSequence=new Map();
 async function receive(tenant,message,{signature=true,from=tenant.sender}={}){
  const sequence=(messageSequence.get(tenant.key)||0)+1;messageSequence.set(tenant.key,sequence);
  const value={id:'wamid.SyntheticLifecycle_'+randomUUID().replaceAll('-',''),from,timestamp:String(messageEpoch+sequence),...(typeof message==='string'?{type:'text',text:{body:message}}:message)};
  const payload={object:'whatsapp_business_account',entry:[{id:tenant.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:tenant.phoneNumberId},messages:[value]}}]}]};
  const wire=JSON.stringify(payload),headers={'Content-Type':'application/json',...(signature?{'x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(wire).digest('hex')}:{})};
  const response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers,body:wire}));
  if(!signature){assert.equal(response.status,403);return null;}
  assert.equal(response.status,200);const ack=await response.json();assert.equal(ack.durable,true);assert.equal(ack.applied,false);
  const eventId='customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId;
  const event=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[eventId])).rows[0];assert.equal(event.status,'PENDING');assert.equal(event.payload.channelId,tenant.channelId);assert.equal(event.payload.organizationId,tenant.organizationId);assert.ok(event.payload.encryptedProof.startsWith('v2.'));assert.equal(event.leaseToken,null);
  return {eventId,wire,headers};
 }
 const execute=async(tenant,message)=>{const input=await receive(tenant,message),result=await engines.processor.process(input.eventId);return {...input,result,reply:graph.messages.get(customerOutboundId(input.eventId))?.body};};
 const choose=async(tenant,step,title)=>{assert.equal(step.reply?.type,'interactive');const row=step.reply.interactive.action.sections.flatMap(section=>section.rows).find(item=>item.title===title);assert.ok(row,'Missing controlled provider choice '+title);return execute(tenant,{type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});};
 async function requestChallenge(tenant){
  const own=(await channel.read(tenant.person,tenant.personContext)).records[0];
  const body={...tenant.personContext,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:tenant.workerId,revision:own.revision}};
  const response=await tenant.channelWeb.POST(post('/api/identity/worker-channel',body));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const value=await response.json();assert.match(value.code,/^VINCULAR [A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify((await query(`SELECT metadata FROM "Worker" WHERE id=$1`,[tenant.workerId])).rows[0]).includes(value.code));
  return value.code;
 }
 const workerKyc=async tenant=>(await query(`SELECT metadata->'participant'->'kyc' AS kyc FROM "Worker" WHERE id=$1 AND "projectId"=$2`,[tenant.workerId,tenant.projectId])).rows[0].kyc;
 const transportCounts=()=>({puts:blob.puts(),sends:lifecycleTenants.reduce((sum,tenant)=>sum+graph.assets.get(tenant.key).sends,0),downloads:lifecycleTenants.reduce((sum,tenant)=>sum+graph.assets.get(tenant.key).downloads,0)});
 const deniedChallenge=async tenant=>{const own=(await channel.read(tenant.person,tenant.personContext)).records[0];assert.equal(own.eligible,false);await assert.rejects(channel.command(tenant.person,{...tenant.personContext,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:tenant.workerId,revision:own.revision}}),{code:'WORKER_CHANNEL_KYC_REVIEW_REQUIRED'});};
 const rejectedKyc=await workerKyc(b),beforeKyc=transportCounts();assert.equal(rejectedKyc.status,'REJECTED');assert.equal(rejectedKyc.review.actorId,b.ownerId);
 const rejectedSubmission=(await query(`SELECT "actorId" FROM "AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND metadata->>'submissionId'=$3`,[b.organizationId,b.workerId,b.rejectedSubmissionId])).rows;assert.equal(rejectedSubmission.length,1);assert.notEqual(rejectedSubmission[0].actorId,rejectedKyc.review.actorId);
 await deniedChallenge(b);const rejectedMenu=await execute(b,'MENU');assert.equal(rejectedMenu.result.businessApplied,false);assert.equal(rejectedMenu.result.replySent,false);assert.deepEqual(transportCounts(),beforeKyc);
 const rejectedRecord=(await participants.read(b.owner,b.ownerContext)).records.find(row=>row.id===b.workerId),prepareCommand={...b.ownerContext,operationId:randomUUID(),action:'PREPARE_KYC_CHAT',payload:{workerId:b.workerId,revision:rejectedRecord.revision}};
 const preparedKyc=await participants.save(b.owner,prepareCommand);assert.match(preparedKyc.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);assert.equal(preparedKyc.codeUnavailable,false);
 const preparedReplay=await participants.save(b.owner,prepareCommand);assert.equal(preparedReplay.codeUnavailable,true);assert.equal(preparedReplay.code,undefined);assert.equal(preparedReplay.receiptId,preparedKyc.receiptId);
 await receive(b,preparedKyc.code,{signature:false});const crossedKyc=await execute(a,preparedKyc.code);assert.equal(crossedKyc.result.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(crossedKyc.result.businessApplied,false);assert.equal(crossedKyc.result.replySent,false);assert.deepEqual(transportCounts(),beforeKyc);
 const freshFront=capturePng([31,97,157]),freshSelfie=capturePng([191,61,83]),freshFrontId='1666666666666611',freshSelfieId='1666666666666612';
 const imageHash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.notEqual(imageHash(freshFront),imageHash(freshSelfie));for(const bytes of [freshFront,freshSelfie])assert.notEqual(imageHash(bytes),imageHash(lifecyclePng));
 graph.addMedia(b.key,freshFrontId,freshFront);graph.addMedia(b.key,freshSelfieId,freshSelfie);
 let kycStep=await execute(b,preparedKyc.code);assert.equal(kycStep.result.kind,'KYC_CHAT');assert.equal(kycStep.result.identity.status,'LIMITED_KYC_UPLOAD');assert.equal(kycStep.result.businessApplied,false);
 kycStep=await choose(b,kycStep,'Autorizar imágenes');kycStep=await choose(b,kycStep,'Sin lectura asistida');kycStep=await choose(b,kycStep,'Sin comparación facial');
 kycStep=await execute(b,{type:'image',image:{id:freshFrontId,mime_type:'image/png'}});kycStep=await execute(b,{type:'image',image:{id:freshSelfieId,mime_type:'image/png'}});assert.equal(blob.puts(),beforeKyc.puts);assert.equal(graph.assets.get('b').downloads,0);
 const submittedKyc=await choose(b,kycStep,'Guardar identidad');assert.equal(submittedKyc.result.kind,'KYC_CHAT');assert.equal(submittedKyc.result.businessApplied,true);assert.equal(submittedKyc.result.replySent,true);assert.equal(blob.puts(),beforeKyc.puts+2);assert.equal(graph.assets.get('b').downloads,2);
 const freshKyc=await workerKyc(b);assert.equal(freshKyc.status,'PENDING_REVIEW');assert.notEqual(freshKyc.submissionId,b.rejectedSubmissionId);assert.notEqual(freshKyc.contentHash,rejectedKyc.contentHash);assert.equal(freshKyc.images.length,2);assert.equal(freshKyc.review,undefined);assert.equal(freshKyc.ocrConsent.allowed,false);assert.equal(freshKyc.biometricConsent.allowed,false);assert.equal(freshKyc.channelCapture.kind,'META_KYC_CHAT');
 for(const [imageId,bytes] of [['document-front',freshFront],['selfie',freshSelfie]]){const image=freshKyc.images.find(value=>value.id===imageId);assert.equal(image.sha256,imageHash(bytes));assert.ok(!rejectedKyc.images.some(old=>old.url===image.url));assert.deepEqual((await participants.downloadKyc(b.owner,{...b.ownerContext,workerId:b.workerId,imageId})).bytes,bytes);}
 await assert.rejects(participants.downloadKyc(a.owner,{...b.ownerContext,scope:a.ownerContext.scope,workerId:b.workerId,imageId:'document-front'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 const freshSubmission=(await query(`SELECT "actorId",metadata FROM "AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND metadata->>'submissionId'=$3`,[b.organizationId,b.workerId,freshKyc.submissionId])).rows;assert.equal(freshSubmission.length,1);assert.equal(freshSubmission[0].actorId,rejectedSubmission[0].actorId);assert.equal(freshSubmission[0].metadata.permissionsGranted,false);assert.equal(freshSubmission[0].metadata.whatsAppAccessGranted,false);
 const afterCapture=transportCounts(),captureReplay=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:submittedKyc.headers,body:submittedKyc.wire}));assert.equal(captureReplay.status,200);assert.equal((await captureReplay.json()).durable,true);assert.equal((await engines.processor.process(submittedKyc.eventId)).done,true);assert.deepEqual(transportCounts(),afterCapture);
 const spentKyc=await execute(b,preparedKyc.code);assert.equal(spentKyc.result.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(spentKyc.result.replySent,false);assert.deepEqual(transportCounts(),afterCapture);
 const staleReview=await participants.save(b.owner,b.rejectedReview);assert.equal(staleReview.replayed,true);assert.equal(staleReview.participant.kyc.status,'PENDING_REVIEW');assert.equal(staleReview.participant.kyc.submissionId,freshKyc.submissionId);await deniedChallenge(b);
 const pendingRecord=(await participants.read(b.owner,b.ownerContext)).records.find(row=>row.id===b.workerId);
 await assert.rejects(participants.save(b.owner,{...b.ownerContext,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:b.workerId,revision:pendingRecord.revision,submissionId:b.rejectedSubmissionId,decision:'APPROVED',reason:'A previous rejected submission cannot approve this new capture.'}}),{code:'PARTICIPANT_KYC_NOT_PENDING'});
 const approveKyc={...b.ownerContext,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:b.workerId,revision:pendingRecord.revision,submissionId:freshKyc.submissionId,decision:'APPROVED',reason:'Controlled distinct human reviewer read both newly captured synthetic PNG files.'}};
 await assert.rejects(participants.save(a.owner,{...approveKyc,scope:a.ownerContext.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});const approvedKyc=await participants.save(b.owner,approveKyc);assert.equal(approvedKyc.participant.kyc.status,'APPROVED');assert.notEqual((await workerKyc(b)).review.actorId,freshSubmission[0].actorId);
 const beforeBinding=transportCounts(),approvedMenu=await execute(b,'MENU');assert.equal(approvedMenu.result.code,'WORKER_CHANNEL_BINDING_REQUIRED');assert.equal(approvedMenu.result.businessApplied,false);assert.equal(approvedMenu.result.replySent,false);assert.deepEqual(transportCounts(),beforeBinding);
 checks.push('canonical-distinct-review-rejection-requires-new-WhatsApp-challenge-and-two-new-private-PNGs-before-a-new-human-approval');
 checks.push('KYC-HMAC-cross-tenant-spent-challenge-and-receipt-replay-have-no-duplicate-media-or-permissions-and-old-submission-cannot-approve-new-capture');
 checks.push('new-approved-WhatsApp-KYC-still-requires-a-fresh-single-use-VINCULAR-binding-before-field-access');
 const aCode=await requestChallenge(a),bCode=await requestChallenge(b),beforeUnsigned=(await query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n;
 await receive(a,aCode,{signature:false});assert.equal((await query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n,beforeUnsigned);
 const crossed=await execute(a,bCode);assert.equal(crossed.result.businessApplied,false);assert.equal(crossed.result.code,'WORKER_CHANNEL_CHALLENGE_REJECTED');assert.equal(graph.assets.get('a').sends,0);
 for(const [tenant,code] of [[a,aCode],[b,bCode]]){
  const sendsBeforeBinding=graph.assets.get(tenant.key).sends;
  const bound=await execute(tenant,code);assert.equal(bound.result.kind,'CHANNEL_BOUND',JSON.stringify({tenant:tenant.key,result:bound.result}));assert.equal(bound.result.replySent,true);tenant.bindingEvent=bound.eventId;
  const state=(await query(`SELECT metadata->'participant'->'channelIdentity' AS identity FROM "Worker" WHERE id=$1`,[tenant.workerId])).rows[0].identity;assert.equal(state.binding.status,'VERIFIED');assert.equal(state.binding.proofEventId,bound.eventId);assert.equal(state.challenge.status,'CONSUMED');
  assert.equal(state.binding.kycSubmissionId,(await workerKyc(tenant)).submissionId);if(tenant===b)assert.notEqual(state.binding.kycSubmissionId,b.rejectedSubmissionId);
  const replay=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:bound.headers,body:bound.wire}));assert.equal(replay.status,200);assert.equal((await replay.json()).durable,true);assert.equal((await query(`SELECT count(*)::int AS n FROM "WebhookEvent" WHERE id=$1`,[bound.eventId])).rows[0].n,1);assert.equal((await engines.processor.process(bound.eventId)).done,true);assert.equal(graph.assets.get(tenant.key).sends,sendsBeforeBinding+1);
  assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action='worker.channel.identity.recorded' AND "entityId"=$1 AND metadata->>'kind'='CHANNEL_BOUND'`,[tenant.workerId])).rows[0].n,1);
 }
 checks.push('HTTP-owner-only-code-HMAC-ACK-before-dispatch-and-real-resolver-bind-once-with-unsigned-and-cross-tenant-code-rejection');
 const menuA=await execute(a,'MENU'),menuB=await execute(b,'MENU');assert.equal(menuA.reply.type,'interactive');assert.equal(menuB.reply.type,'interactive');assert.equal(menuA.result.replyState,'SENT');assert.equal(menuB.result.replyState,'SENT');
 assert.ok(menuA.reply.interactive.body.text.includes('Obra sintética A'));assert.ok(!JSON.stringify(menuA.reply).includes('Obra sintética B'));
 checks.push('both-activated-signup-credentials-flow-through-real-canonical-worker-bridge-processor-and-real-outbound-adapter');
 async function delivery(tenant,eventId,status='delivered',{recipient=tenant.sender}={}){
  const outgoing=graph.messages.get(customerOutboundId(eventId));assert.ok(outgoing);
  const payload={object:'whatsapp_business_account',entry:[{id:tenant.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:tenant.phoneNumberId},statuses:[{id:outgoing.id,status,timestamp:String(Math.floor(Date.now()/1000)),recipient_id:recipient,biz_opaque_callback_data:customerOutboundId(eventId)}]}}]}]};
  const bytes=JSON.stringify(payload),response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex')},body:bytes}));assert.equal(response.status,200);
  const id='customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId;await engines.processor.process(id);return id;
 }
 const sendsA=graph.assets.get('a').sends;await delivery(a,menuA.eventId);await delivery(a,menuA.eventId,'read');
 const status=await engines.outbound.result({eventId:menuA.eventId,projectId:a.projectId,channelId:a.channelId});assert.equal(status.providerStatus,'read');assert.equal(status.replySent,true);assert.equal(graph.assets.get('a').sends,sendsA);
 const aView=await onboarding.read(a.owner,a.ownerContext),bView=await onboarding.read(b.owner,b.ownerContext);assert.equal(aView.inbox.items.find(item=>item.id===menuA.eventId).providerReplyStatus,'read');assert.ok(!bView.inbox.items.some(item=>item.id===menuA.eventId));assert.equal(aView.acceptance.roundTrip,'NOT_VERIFIED');
 checks.push('signed-delivery-read-correlate-to-real-encrypted-reservation-private-tenant-status-with-no-resend-or-human-acceptance');
 let step=await execute(a,'INCIDENCIA');step=await choose(a,step,'Tarea sintética A');await choose(a,step,'Sector sintético A');await execute(a,'Incidencia sintética del circuito completo');step=await execute(a,'Detalle privado sintético para comprobar persistencia y recuperación.');
 // Priority is a list choice, so an arbitrary text cannot bypass its nonce.
 const arbitraryPriority=await execute(a,'baja');assert.equal(arbitraryPriority.reply.type,'text');step=await choose(a,step,'Baja');
 const confirmRow=step.reply.interactive.action.sections.flatMap(section=>section.rows).find(row=>row.title==='Guardar');assert.ok(confirmRow);
 const incident=await receive(a,{type:'interactive',interactive:{type:'list_reply',list_reply:{id:confirmRow.id,title:confirmRow.title}}});
 const incidentCount=async()=>(await query(`SELECT count(*)::int AS n FROM "Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'type'='ISSUE'`,[a.projectId])).rows[0].n;
 const beforeIncident=await incidentCount(),beforeIncidentSends=graph.assets.get('a').sends;
 failBridgeAudit=true;await assert.rejects(engines.processor.process(incident.eventId),/SYNTHETIC_LIFECYCLE_AUDIT_FAILURE/);failBridgeAudit=false;assert.equal(await incidentCount(),beforeIncident);assert.equal(graph.assets.get('a').sends,beforeIncidentSends);
 loseBridgeCommit=true;await assert.rejects(engines.processor.process(incident.eventId),/SYNTHETIC_LIFECYCLE_COMMIT_ACK_LOST/);assert.equal(await incidentCount(),beforeIncident+1);assert.equal(graph.assets.get('a').sends,beforeIncidentSends);
 engines=runtime();const recovered=await engines.processor.process(incident.eventId);assert.equal(recovered.kind,'INCIDENT_REPORT');assert.equal(recovered.replySent,true);assert.equal(await incidentCount(),beforeIncident+1);assert.equal(graph.assets.get('a').sends,beforeIncidentSends+1);
 await engines.processor.process(incident.eventId);assert.equal(graph.assets.get('a').sends,beforeIncidentSends+1);
 const actual=(await operations.read(a.owner,a.ownerContext)).incidents[0];assert.equal(actual.workerId,a.workerId);assert.equal((await operations.read(b.owner,b.ownerContext)).incidents.length,0);
 checks.push('real-canonical-incident-rollback-and-committed-response-loss-recover-after-runtime-recreation-with-one-effect-and-one-reply');
 graph.assets.get('b').sendResponseLost=true;const unknown=await execute(b,'ESTADO');assert.equal(unknown.result.replyState,'SEND_UNKNOWN');assert.equal(unknown.result.replySent,false);const unknownSends=graph.assets.get('b').sends;
 engines=runtime();await engines.processor.process(unknown.eventId);assert.equal(graph.assets.get('b').sends,unknownSends);await delivery(b,unknown.eventId);assert.equal((await engines.outbound.result({eventId:unknown.eventId,projectId:b.projectId,channelId:b.channelId})).providerStatus,'delivered');assert.equal(graph.assets.get('b').sends,unknownSends);
 checks.push('uncertain-real-outbound-POST-persists-across-runtime-recreation-and-signed-status-recovers-without-retransmission');
 step=await execute(a,'EVIDENCIA');step=await choose(a,step,'Tarea sintética A');step=await choose(a,step,'Sector sintético A');await choose(a,step,'Analizar y guardar');const photo=await execute(a,{type:'image',image:{id:a.mediaId,mime_type:'image/png',caption:'Caption privada sintética del circuito signup completo.'}});
 assert.equal(photo.result.kind,'EVIDENCE');assert.equal(photo.result.businessApplied,true);assert.equal(photo.result.replySent,true);assert.equal(graph.assets.get('a').downloads,1);assert.equal(analyses,1);
 const evidence=(await operations.read(a.owner,a.ownerContext)).evidence[0];assert.equal(evidence.processing.status,'ANALYZED_UNREVIEWED');assert.deepEqual((await media.download(a.owner,{...a.ownerContext,evidenceId:evidence.id})).bytes,lifecyclePng);
 await operations.save(a.owner,{...a.ownerContext,operationId:randomUUID(),action:'REVIEW_EVIDENCE',payload:{evidenceId:evidence.id,revision:evidence.revision,decision:'APPROVE',reason:'Controlled distinct reviewer checked the synthetic private evidence.'}});
  step=await execute(a,'AVANCE');step=await choose(a,step,'Tarea sintética A');await choose(a,step,'Sector sintético A');step=await execute(a,'25%');step=await choose(a,step,evidence.title);step=await execute(a,'Medición sintética revisada para el recorrido de punta a punta.');const proposalResult=await choose(a,step,'Guardar');assert.equal(proposalResult.result.kind,'PROGRESS_PROPOSAL');assert.equal((await workspace.read(a.owner,a.ownerContext)).tasks[0].progress,0);
 const proposal=(await operations.read(a.owner,a.ownerContext)).proposals[0];await operations.save(a.owner,{...a.ownerContext,operationId:randomUUID(),action:'DECIDE_PROGRESS',payload:{proposalId:proposal.id,revision:proposal.revision,decision:'APPROVE',reason:'Controlled authorized web reviewer approved the synthetic measured progress.'}});assert.equal((await workspace.read(a.owner,a.ownerContext)).tasks[0].progress,25);assert.equal((await workspace.read(b.owner,b.ownerContext)).tasks[0].progress,0);
 checks.push('signup-customer-media-lookup-private-Blob-readback-analysis-and-channel-proposal-reach-real-authorized-web-Gantt-approval');
 const pending=await receive(a,'MENU');assert.equal((await query(`SELECT status FROM "WebhookEvent" WHERE id=$1`,[pending.eventId])).rows[0].status,'PENDING');engines=runtime();
 const jobBody=JSON.stringify({version:1,eventIds:[pending.eventId]}),timestamp=String(Date.now()),job=createMetaCustomerJobHandlers({processor:engines.processor,environment});
 const recoveredJob=await job.POST(new Request('https://obrasaas.com/api/meta/customer-process',{method:'POST',headers:{'Content-Type':'application/json','x-obrasaas-job-time':timestamp,'x-obrasaas-job-signature':'sha256='+signMetaCustomerJob(jobBody,timestamp,environment)},body:jobBody}));assert.equal(recoveredJob.status,200);const jobResult=await recoveredJob.json();assert.equal(jobResult.checked,1);assert.equal(jobResult.results[0].processed,true);assert.equal(jobResult.results[0].replySent,true);const pendingSends=graph.assets.get('a').sends;
 const repeats=await Promise.all([engines.processor.process(pending.eventId),engines.processor.process(pending.eventId)]);assert.ok(repeats.every(value=>value.done));assert.equal(graph.assets.get('a').sends,pendingSends);
 checks.push('committed-inbox-survives-runtime-recreation-and-signed-recovery-job-finishes-one-real-outbound-before-concurrent-replay');
 const revokedInput=await receive(a,'MENU'),beforeRevokedSends=graph.assets.get('a').sends,record=(await participants.read(a.owner,a.ownerContext)).records.find(row=>row.id===a.workerId);
 await participants.save(a.owner,{...a.ownerContext,operationId:randomUUID(),action:'REVOKE',payload:{workerId:a.workerId,revision:record.revision,reason:'Controlled revocation after callback ACK and before worker dispatch.'}});
 const denied=await engines.processor.process(revokedInput.eventId);assert.equal(denied.businessApplied,false);assert.equal(denied.replySent,false);assert.equal(graph.assets.get('a').sends,beforeRevokedSends);
 const revoked=(await participants.read(a.owner,a.ownerContext)).records.find(row=>row.id===a.workerId);await participants.save(a.owner,{...a.ownerContext,operationId:randomUUID(),action:'RESTORE_ACCESS',payload:{workerId:a.workerId,revision:revoked.revision,reason:'Controlled restoration does not restore the previous channel proof.'}});
 const approvedReceiptReplay=await participants.save(a.owner,a.initialReview);assert.equal(approvedReceiptReplay.replayed,true);assert.equal(approvedReceiptReplay.participant.kyc.status,'APPROVED');assert.equal((await query(`SELECT metadata->'participant'->'channelIdentity'->'binding'->>'status' AS status FROM "Worker" WHERE id=$1`,[a.workerId])).rows[0].status,'REVOKED');
 const noBinding=await execute(a,'MENU');assert.equal(noBinding.result.code,'WORKER_CHANNEL_BINDING_REQUIRED');assert.equal(noBinding.result.replySent,false);assert.equal(graph.assets.get('a').sends,beforeRevokedSends);const newCode=await requestChallenge(a);const rebound=await execute(a,newCode);assert.equal(rebound.result.kind,'CHANNEL_BOUND');assert.equal(rebound.result.replySent,true);assert.notEqual(rebound.eventId,a.bindingEvent);
 assert.equal((await engines.processor.process(revokedInput.eventId)).done,true);assert.equal(graph.assets.get('a').sends,beforeRevokedSends+1);
 checks.push('canonical-revocation-after-ACK-blocks-effect-and-send-old-APPROVED-receipt-does-not-restore-access-and-restoration-requires-a-new-single-use-channel-proof');
 const privateState=JSON.stringify((await query(`SELECT metadata FROM "AuditLog" WHERE action LIKE 'meta.field.%' OR action LIKE 'worker.channel.%'`)).rows);
 for(const content of [aCode,bCode,preparedKyc.code,'Caption privada sintética del circuito signup completo.','Detalle privado sintético para comprobar persistencia y recuperación.'])assert.ok(!privateState.includes(content));
 for(const tenant of lifecycleTenants){
  const view=await onboarding.read(tenant.owner,tenant.ownerContext);assert.equal(view.acceptance.roundTrip,'NOT_VERIFIED');assert.equal(view.acceptance.fieldJourney,'NOT_VERIFIED');assert.equal(view.activation.fieldJourney,'NOT_VERIFIED');assert.ok(!JSON.stringify(view).includes(tenant.token));
  const bound=(await query(`SELECT metadata->'participant'->'channelIdentity'->'binding' AS binding FROM "Worker" WHERE id=$1`,[tenant.workerId])).rows[0].binding;assert.equal(bound.organizationId,tenant.organizationId);assert.equal(bound.connectionId,tenant.channelId);
 }
 assert.equal(unexpectedNetworkCalls,0);assert.deepEqual(graph.unexpected,[]);assert.ok(scheduled.length>0);
 checks.push('private-content-stays-ciphertext-and-synthetic-transport-results-never-promote-real-Meta-or-human-acceptance');
 const report={status:'PASS',environment:'local-disposable-postgresql-full-canonical-signup-field-lifecycle',checks,checkCount:checks.length,canonicalServices:['workspace','customer-setup','onboarding','provider-adapter','participant-invitation-and-KYC','limited-WhatsApp-KYC-challenge-bridge-deposit-outbound','worker-channel-resolver','signed-callback','field-bridge','field-operations','field-media','processor','outbound','delivery-status'],tenants:2,kycRecapture:{rejectedSubmissions:1,newPrivateImages:2,distinctNewImageBytes:true,newCanonicalReviewRequired:true,newChannelBindingRequired:true},provider:'strict-controlled-Graph-fetch-only',clerk:'controlled-Backend-API-provider-only',webIdentity:'controlled-verifier-not-real-Clerk-JWT',blob:'controlled-private-byte-store',analyzer:'controlled-synthetic-image-only',realProviderCalls:0,unexpectedNetworkCalls,productionDataTouched:false,realNumberRegistered:false,realMetaAccepted:false,humanAccepted:false};
 mkdirSync('.vercel/meta-signup-field-lifecycle-evidence',{recursive:true});writeFileSync('.vercel/meta-signup-field-lifecycle-evidence/postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 globalThis.fetch=originalFetch;
 try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}
}
