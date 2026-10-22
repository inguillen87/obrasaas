import {syntheticCaptureQuality} from './lib/synthetic-capture-quality.mjs';
import assert from 'node:assert/strict';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleDisposableUrl,lifecycleEnvironment,lifecycleSchema,lifecycleTenants,lifecyclePng,createControlledLifecycleGraph,createControlledLifecycleBlob,createControlledLifecycleClerk} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerOutbound,customerJobTransaction,customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,readMetaKycConversation,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createMetaKycExpiryFeedback,metaKycExpiryReceiptId,META_KYC_EXPIRY_REPLY} from '../src/lib/meta-kyc-expiry-feedback.mjs';
import {verifyKycContextFeedbackNative} from './lib/kyc-context-feedback-native.mjs';
import {createParticipantChannelKycDeposit,createParticipantChannelKycUploader} from '../src/lib/participant-channel-kyc.mjs';
import {participantKycImageSet,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from '../src/lib/participant-kyc-image-set.mjs';
import {assertApprovedParticipantKyc} from '../src/lib/participant-approved-identity.mjs';
import {resolveWorkerChannelIdentity,createWorkerChannelStore} from '../src/lib/worker-channel-identity.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {assertParticipantPreanalysisSource} from '../src/lib/participant-kyc-preanalysis-policy.mjs';

// Boundary validation occurs before constructing clients. This creates only a
// random disposable database under the already provisioned localhost CI server.
const url=lifecycleDisposableUrl(process.env),database='obrasaas_meta_kyc_'+randomUUID().replaceAll('-','');
assert.match(database,/^obrasaas_meta_kyc_[a-f0-9]{32}$/);
const admin=new Client({connectionString:url.toString()}),environment={...lifecycleEnvironment},tenants=lifecycleTenants.map(t=>({...t,channelId:'kyc-channel-'+t.key,workerId:'kyc-worker-'+t.key,invitationId:'invite_'+t.key.repeat(32),providerInvitationId:'orginv_KycFixture'+t.key,sequence:0,baseTimestamp:Math.floor(Date.now()/1000)-45})),checks=[],graph=createControlledLifecycleGraph(environment),blob=createControlledLifecycleBlob(),clerk=createControlledLifecycleClerk();
let expiryFeedbackNative=null,contextFeedbackNative=null,nativeReport=null,poolClosed=false,databaseRemoved=false,adminClosed=false,ownConnectionsClosed=false;const ownedPids=new Set();
let pool,created=false,loseDepositCommit=false,loseDispatchCommit=false,unexpectedNetworkCalls=0,fieldFallbacks=0;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{unexpectedNetworkCalls++;throw new Error('KYC_UNCONTROLLED_NETWORK_REJECTED');};
const query=(sql,args)=>pool.query(sql,args);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),root=process.cwd(),sources=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.isDirectory()?sources(relative+'/'+entry.name):[relative+'/'+entry.name]);
const sourceManifest=[...sources('src/lib'),'scripts/lib/synthetic-capture-quality.mjs','src/app/(identity)/cuenta/private-bank-account-format.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/kyc-context-feedback-native.mjs'].map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))})),harnessSha256=sha(readFileSync(new URL(import.meta.url)));
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;
 pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8}));pool.on('connect',client=>ownedPids.add(client.processID));await query(lifecycleSchema);
 for(const t of tenants){
  const active=t.key==='b';
  await query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata) VALUES($1,$2,$3,'{}')`,[t.organizationId,'Synthetic KYC company '+t.key,t.clerkOrganizationId]);
  await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[t.ownerId,t.ownerUserId,'owner-'+t.key+'@example.invalid']);
  await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['owner-member-'+t.key,t.ownerId,t.organizationId]);
  await query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{}')`,[t.projectId,t.organizationId,'Synthetic KYC project '+t.key]);
  // Existing synthetic accounts avoid creating an identity during acceptance.
  {
   await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,['worker-user-'+t.key,t.workerUserId,t.workerEmail]);
   await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,$4,'org:member','ACTIVE')`,['worker-member-'+t.key,'worker-user-'+t.key,t.organizationId,active?'SITE_MANAGER':'AUDITOR']);
   await query(`INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES($1,$2,$3,'ACTIVE')`,['worker-project-'+t.key,t.projectId,'worker-member-'+t.key]);
  }
  const expiresAt=Date.now()+7*86400000;clerk.invitations.set(t.invitationId,{id:t.providerInvitationId,organizationId:t.clerkOrganizationId,emailAddress:t.workerEmail,role:'org:member',status:active?'accepted':'pending',expiresAt,publicMetadata:{obrasaasInvitationId:t.invitationId}});
  const metadata={siteRegister:{version:1},participant:{version:1,status:active?'ACTIVE':'INVITED',clerkUserId:active?t.workerUserId:null,permissions:{attendance:active,report:active},invitation:{id:t.invitationId,state:active?'ACCEPTED':'SENT',expiresAt:new Date(expiresAt).toISOString(),email:t.workerEmail,providerId:t.providerInvitationId},kyc:{version:1,status:'NOT_SUBMITTED'}}};
  await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,active,metadata) VALUES($1,$2,$3,$4,'WORKER',true,$5::jsonb)`,[t.workerId,t.projectId,'Synthetic KYC participant '+t.key,'+'+t.sender,JSON.stringify(metadata)]);
  const channelMetadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:t.organizationId,customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:t.ownerId},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}},encrypted=encryptCustomerSecret(t.token,{organizationId:t.organizationId,projectId:t.projectId,purpose:'access-token',resourceId:t.phoneNumberId},environment);
  await query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6::jsonb)`,[t.channelId,t.projectId,t.phoneNumberId,t.wabaId,encrypted,JSON.stringify(channelMetadata)]);
  graph.assets.get(t.key).registered=true;graph.assets.get(t.key).subscribed=true;
 }
 const connect=async()=>{
  const client=await pool.connect();let depositWritten=false,dispatchWritten=false;
  return {release:broken=>client.release(broken),query:async(sql,args)=>{
   const result=await client.query(sql,args);
   if(sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'participant.operation.recorded'"))depositWritten=true;
   if(sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'participant.kyc_chat.dispatched'"))dispatchWritten=true;
   if(sql==='COMMIT'&&depositWritten&&loseDepositCommit){loseDepositCommit=false;throw new Error('SYNTHETIC_KYC_DEPOSIT_COMMIT_ACK_LOST');}
   if(sql==='COMMIT'&&dispatchWritten&&loseDispatchCommit){loseDispatchCommit=false;throw new Error('SYNTHETIC_KYC_DISPATCH_COMMIT_ACK_LOST');}
   return result;
  }};
 };
 const provider=createMetaCustomerProvider({environment,fetchImpl:graph.fetchImpl}),upload=createParticipantChannelKycUploader({get:blob.get,put:blob.put,environment:()=>environment}),deposit=createParticipantChannelKycDeposit({assessCaptureQuality:syntheticCaptureQuality,connect,resolveAuthority:resolveMetaKycAuthority,upload,environment});
 const bridge=createMetaKycBridge({connect,provider,deposit,environment}),outbound=createMetaKycOutbound({connect,provider,environment}),fieldOutbound=createMetaCustomerOutbound({connect,provider,resolveIdentity:resolveWorkerChannelIdentity,environment});
 const processor=createMetaCustomerProcessor({connect,environment,authorizationCodes:META_KYC_AUTHORIZATION_CODES,dispatch:async context=>{const result=await bridge.execute(context);if(result)return result;fieldFallbacks++;return null;},outbound:{send:(context,reply,{purpose}={})=>purpose==='KYC_CAPTURE'?outbound.send(context,reply):fieldOutbound.send(context,reply),observeStatus:(...args)=>fieldOutbound.observeStatus(...args)}});
 const inbox=createMetaCustomerInbox({connect,environment}),callback=createMetaCustomerCallbackHandlers({inbox,environment,schedule:()=>{}}),[a,b]=tenants;
 const worker=async t=>(await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[t.workerId])).rows[0];
 async function challenge(t,{captureImageSetVersion}={}){return customerJobTransaction(connect,async client=>{
  const project=(await client.query(`SELECT id,"organizationId" FROM "Project" WHERE id=$1 FOR UPDATE`,[t.projectId])).rows[0],row=await worker(t);
  const member={actorId:t.ownerId,membershipId:'owner-member-'+t.key,organizationId:t.organizationId,role:'ADMIN'};
  const prepared=await prepareMetaKycChallenge(client,member,project,{workerId:t.workerId,revision:row.revision,operationId:randomUUID()});
  if(captureImageSetVersion!==2){
   // Reconstruct a coherently issued pre-schema2 challenge for every original
   // two-image group. This fixture mutation is never a production option.
   await client.query(`UPDATE public."Worker" SET metadata=jsonb_set(metadata,'{participant,kycChatChallenge}',(metadata#>'{participant,kycChatChallenge}')-'captureImageSetVersion') WHERE id=$1`,[t.workerId]);
   await client.query(`UPDATE public."AuditLog" SET metadata=metadata-'captureImageSetVersion' WHERE id=$1 AND action='participant.kyc_chat.prepared'`,[prepared.receiptId]);
  }
  return prepared;
 });}
 const mutate=async(t,change)=>{const row=await worker(t);change(row.metadata);await query(`UPDATE "Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[t.workerId,JSON.stringify(row.metadata)]);};
 async function receive(t,message,{signature=true,from=t.sender,timestamp,wabaId=t.wabaId,phoneNumberId=t.phoneNumberId}={}){
  t.sequence++;const value={id:'wamid.SyntheticKycCi_'+randomUUID().replaceAll('-',''),from,timestamp:String(timestamp??t.baseTimestamp+t.sequence),...(typeof message==='string'?{type:'text',text:{body:message}}:message)},payload={object:'whatsapp_business_account',entry:[{id:wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:phoneNumberId},messages:[value]}}]}]},wire=JSON.stringify(payload),headers={'Content-Type':'application/json',...(signature?{'x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(wire).digest('hex')}:{})};
  const response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers,body:wire}));if(!signature){assert.equal(response.status,403);return null;}assert.equal(response.status,200);assert.equal((await response.json()).durable,true);
  return {eventId:'customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId,wire,headers};
 }
 async function execute(t,message,options){const input=await receive(t,message,options),result=await processor.process(input.eventId);return {...input,result,reply:graph.messages.get(customerOutboundId(input.eventId))?.body};}
 const choose=async(t,last,title)=>{const row=last.reply?.interactive?.action.sections.flatMap(x=>x.rows).find(x=>x.title===title);assert.ok(row,'Missing KYC choice '+title);return execute(t,{type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});};
 const counts=()=>({puts:blob.puts(),sends:tenants.reduce((n,t)=>n+graph.assets.get(t.key).sends,0),downloads:tenants.reduce((n,t)=>n+graph.assets.get(t.key).downloads,0)});
 const assertPendingPreserved=async t=>{
  const beforeWorker=await worker(t),beforeAudits=(await query(`SELECT * FROM "AuditLog" ORDER BY id`)).rows,beforeCounts=counts(),beforeNetwork=unexpectedNetworkCalls;
  await assert.rejects(challenge(t),{code:'PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED'});
  assert.deepEqual(await worker(t),beforeWorker);assert.deepEqual((await query(`SELECT * FROM "AuditLog" ORDER BY id`)).rows,beforeAudits);assert.deepEqual(counts(),beforeCounts);assert.equal(unexpectedNetworkCalls,beforeNetwork);assert.deepEqual(graph.unexpected,[]);
 };
 const resetIndependentPendingFixture=async t=>{
  const p=(await worker(t)).metadata.participant;assert.equal(p.kycChatChallenge.status,'PENDING');assert.equal(p.kyc.status,'NOT_SUBMITTED');assert.equal(p.kycChatConversation,null);assert.equal(p.kycChatChallenge.claimedEventId,undefined);assert.equal(p.kycChatChallenge.claimedAt,undefined);
  // Independent negative fixtures only, NOT a production cancellation. This
  // verifier calls prepare directly without canonical outer PREPARE receipts;
  // the integrated closure verifier tests real cancellation and archival.
  await mutate(t,m=>{delete m.participant.kycChatChallenge;});
 };
 const initial=await challenge(a);assert.match(initial.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);assert.equal(initial.codeUnavailable,false);
 const originalAudit=JSON.stringify((await query(`SELECT metadata FROM "AuditLog"`)).rows);assert.ok(!originalAudit.includes(initial.code));assert.equal((await worker(a)).metadata.participant.permissions.attendance,false);
 const baseline=counts();await receive(a,initial.code,{signature:false});assert.deepEqual(counts(),baseline);
 const outsider=await execute(a,initial.code,{from:'5491100009999'});assert.equal(outsider.result.businessApplied,false);assert.equal(outsider.result.replySent,false);assert.deepEqual(counts(),baseline);
 const cross=await execute(b,initial.code);assert.equal(cross.result.businessApplied,false);assert.equal(cross.result.replySent,false);assert.deepEqual(counts(),baseline);
 checks.push('unsigned-wrong-phone-and-cross-tenant-WABA-cannot-start-KYC-or-send');
 await mutate(a,m=>{m.participant.kycChatChallenge.expiresAt=new Date(Date.now()-1000).toISOString();});const expired=await execute(a,initial.code);assert.equal(expired.result.code,'META_KYC_CHALLENGE_EXPIRED');assert.deepEqual(counts(),baseline);await assertPendingPreserved(a);await resetIndependentPendingFixture(a);
 const revoked=await challenge(a);await query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id=$1`,['owner-member-a']);assert.equal((await execute(a,revoked.code)).result.code,'META_KYC_CHALLENGE_REVOKED');assert.deepEqual(counts(),baseline);await assertPendingPreserved(a);await query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id=$1`,['owner-member-a']);await assertPendingPreserved(a);await resetIndependentPendingFixture(a);
 checks.push('expired-and-revoked-challenge-have-zero-result-media-download-Blob-upload-and-send');
 const cancelledCode=await challenge(a),started=await execute(a,cancelledCode.code),lastTs=readMetaKycConversation({project:{id:a.projectId,organizationId:a.organizationId},worker:await worker(a),challenge:(await worker(a)).metadata.participant.kycChatChallenge},environment).lastMessageTimestamp;
 const stale=await execute(a,'ESTADO',{timestamp:lastTs});assert.equal(stale.result.code,'META_KYC_MESSAGE_OUT_OF_ORDER');assert.equal((await worker(a)).metadata.participant.kyc.status,'NOT_SUBMITTED');
 const cancelled=await execute(a,'CANCELAR');assert.equal(cancelled.result.kind,'KYC_CHAT');assert.equal((await worker(a)).metadata.participant.kycChatChallenge.status,'CANCELLED');assert.equal((await execute(a,cancelledCode.code)).result.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(blob.puts(),0);void started;
 const closedMetadata=JSON.stringify((await worker(a)).metadata),beforeFallback=fieldFallbacks;await execute(a,'VINCULAR existing-guarded-code');await execute(a,{type:'image',image:{id:a.mediaId,mime_type:'image/png'}});assert.equal(fieldFallbacks,beforeFallback+2);assert.equal(JSON.stringify((await worker(a)).metadata),closedMetadata);
 checks.push('out-of-order-and-cancel-produce-no-upload-and-cancelled-session-restores-field-routing');
 for(const t of tenants){
  const prepared=await challenge(t),before=counts();let last=await execute(t,prepared.code);last=await choose(t,last,'Autorizar imágenes');last=await choose(t,last,t===a?'Sin lectura asistida':'Con lectura asistida');last=await choose(t,last,t===a?'Sin comparación facial':'Con comparación facial');
  last=await execute(t,{type:'image',image:{id:t.mediaId,mime_type:'image/png'}});last=await execute(t,{type:'image',image:{id:t.mediaId,mime_type:'image/png'}});assert.equal(counts().downloads,before.downloads);assert.equal(counts().puts,before.puts);
  const row=last.reply.interactive.action.sections[0].rows.find(x=>x.title==='Guardar identidad'),confirm=await receive(t,{type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});
  if(t===a){loseDepositCommit=true;await assert.rejects(processor.process(confirm.eventId),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});assert.equal(blob.puts(),before.puts+2);assert.equal((await worker(t)).metadata.participant.kyc.status,'PENDING_ACCOUNT_CLAIM');assert.equal((await query(`SELECT status::text FROM "WebhookEvent" WHERE id=$1`,[confirm.eventId])).rows[0].status,'PENDING');const frozen=JSON.stringify((await worker(t)).metadata.participant.kycChatConversation),pending=await execute(t,'CANCELAR');assert.match(pending.reply.text.body,/confirmación ya fue recibida/);assert.equal(JSON.stringify((await worker(t)).metadata.participant.kycChatConversation),frozen);assert.equal(blob.puts(),before.puts+2);}
  else {loseDispatchCommit=true;await assert.rejects(processor.process(confirm.eventId),/SYNTHETIC_KYC_DISPATCH_COMMIT_ACK_LOST/);assert.equal(blob.puts(),before.puts+2);}
  const completed=await processor.process(confirm.eventId);assert.equal(completed.businessApplied,true);assert.equal(completed.replySent,true);assert.equal(blob.puts(),before.puts+2);
  const p=(await worker(t)).metadata.participant;assert.equal(p.status,t===a?'INVITED':'ACTIVE');assert.equal(p.clerkUserId,t===a?null:t.workerUserId);assert.equal(p.kyc.status,t===a?'PENDING_ACCOUNT_CLAIM':'PENDING_REVIEW');assert.equal(p.kyc.ocrConsent.allowed,t===b);assert.equal(p.kyc.biometricConsent.allowed,t===b);assert.equal(p.kyc.images.length,2);assert.equal(p.kycChatChallenge.status,'COMPLETED');assert.equal(p.channelIdentity?.binding,undefined);assert.deepEqual(p.permissions,{attendance:t===b,report:t===b});
  const submissions=(await query(`SELECT "actorId",metadata FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED'`,[t.workerId])).rows;assert.equal(submissions.length,1);assert.equal(submissions[0].actorId,t===a?t.ownerId:'worker-user-b');assert.equal(submissions[0].metadata.permissionsGranted,false);
  const stable=counts();assert.equal((await processor.process(confirm.eventId)).done,true);assert.deepEqual(counts(),stable);
  const stateBefore=JSON.stringify((await worker(t)).metadata),fallbackCount=fieldFallbacks;for(const message of ['VINCULAR subsequent-field-code','REPORTAR avance',{type:'image',image:{id:t.mediaId,mime_type:'image/png'}}])await execute(t,message);assert.equal(fieldFallbacks,fallbackCount+3);assert.equal(JSON.stringify((await worker(t)).metadata),stateBefore);assert.equal(counts().puts,stable.puts);
 }
 checks.push('INVITED-and-real-linked-ACTIVE-capture-both-private-images-with-pinned-consent-and-optional-OCR-before-human-review');
 checks.push('lost-deposit-and-lost-dispatch-commit-responses-recover-one-canonical-submission-and-exactly-two-private-uploads');
 checks.push('new-cancel-after-confirmation-preserves-the-original-recoverable-confirmation-and-does-not-falsely-cancel-saved-images');
 checks.push('completed-capture-restores-VINCULAR-text-and-image-field-routing-without-KYC-mutations');
 const workspace=createWorkspaceStore({connect}),channel=createWorkerChannelStore({workspace}),session={authenticated:true,verification:'clerk-production-jwt',userId:b.workerUserId,organizationId:b.clerkOrganizationId,organizationRole:'org:member'},scope=(await workspace.list(session)).scope,row=await worker(b);
 await assert.rejects(channel.command(session,{projectId:b.projectId,scope,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:b.workerId,revision:row.revision}}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 checks.push('unchanged-VINCULAR-guard-still-requires-distinct-human-KYC-review-before-channel-binding');
 const participant=createParticipantStore({assessCaptureQuality:syntheticCaptureQuality,workspace,connect,identity:createParticipantIdentityProvider({client:clerk.client,environment:()=>environment})}),ownSession={...session,userId:a.workerUserId,organizationId:a.clerkOrganizationId},ownScope=(await workspace.list(ownSession)).scope,capture=(await query(`SELECT * FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED'`,[a.workerId])).rows[0],origin=JSON.stringify(capture);
 await assert.rejects(channel.command(ownSession,{projectId:a.projectId,scope:ownScope,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:a.workerId,revision:(await worker(a)).revision}}),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});
 clerk.invitations.get(a.invitationId).status='accepted';const accepted=await participant.join(ownSession,{invitationId:a.invitationId,operationId:randomUUID()},{accept:true});assert.equal(accepted.joined,true);
 const adopted=(await worker(a)).metadata.participant;assert.equal(adopted.status,'ACTIVE');assert.equal(adopted.clerkUserId,a.workerUserId);assert.equal(adopted.kyc.status,'PENDING_REVIEW');assert.equal(adopted.kyc.channelCapture.claimedActorId,'worker-user-a');assert.equal(adopted.kyc.channelCapture.acceptanceReceiptId,accepted.receiptId);
 assert.equal((await query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE id=$1 AND action='participant.kyc_chat.adopted'`,[accepted.receiptId+'_kyc'])).rows[0].count,1);assert.equal(JSON.stringify((await query(`SELECT * FROM "AuditLog" WHERE id=$1`,[capture.id])).rows[0]),origin);assert.equal(clerk.sent(),0);
 assert.equal((await participant.join(ownSession,{invitationId:a.invitationId})).joined,true);
 await assert.rejects(channel.command(ownSession,{projectId:a.projectId,scope:ownScope,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:a.workerId,revision:(await worker(a)).revision}}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 checks.push('signed-INVITED-capture-is-adopted-only-through-canonical-Clerk-acceptance-with-original-issuer-audit-immutable');
 await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('kyc-reviewer-a','user_KycReviewerA','reviewer-a@example.invalid')`);await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('kyc-reviewer-member-a','kyc-reviewer-a',$1,'DIRECTOR','org:member','ACTIVE')`,[a.organizationId]);
 const reviewerSession={...ownSession,userId:'user_KycReviewerA'},reviewScope=(await workspace.list(reviewerSession)).scope,beforeReview=await worker(a),reviewInput={projectId:a.projectId,scope:reviewScope,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:a.workerId,revision:beforeReview.revision,submissionId:beforeReview.metadata.participant.kyc.submissionId,decision:'APPROVED',reason:'Synthetic separate responsible manual review'}};
 await assert.rejects(participant.save(ownSession,{...reviewInput,scope:ownScope}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 const reviewed=await participant.save(reviewerSession,reviewInput);assert.equal(reviewed.saved,true);assert.equal((await worker(a)).metadata.participant.kyc.review.actorId,'kyc-reviewer-a');assert.equal(JSON.stringify((await query(`SELECT * FROM "AuditLog" WHERE id=$1`,[capture.id])).rows[0]),origin);
 const request=async()=>channel.command(ownSession,{projectId:a.projectId,scope:ownScope,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:a.workerId,revision:(await worker(a)).revision}});
 // Corrupt only disposable fixture receipts; each denial must leave Worker and
 // channel audits unchanged, then restore the canonical evidence exactly.
 for(const [id,change] of [[accepted.receiptId,m=>{m.requestDigest=digest(['wrong-individual']);}],[accepted.receiptId+'_kyc',m=>{m.projectId=b.projectId;}],[capture.id,m=>{m.contentHash='f'.repeat(64);}]] ){
  const prior=(await query(`SELECT metadata FROM "AuditLog" WHERE id=$1`,[id])).rows[0].metadata,changed=structuredClone(prior);change(changed);await query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[id,JSON.stringify(changed)]);const stable=JSON.stringify((await worker(a)).metadata);await assert.rejects(request(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(JSON.stringify((await worker(a)).metadata),stable);await query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[id,JSON.stringify(prior)]);
 }
 const duplicate='participant_'+digest(randomUUID());await query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[duplicate,capture.organizationId,capture.actorId,capture.action,capture.entityType,capture.entityId,JSON.stringify(capture.metadata)]);await assert.rejects(request(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});await query(`DELETE FROM "AuditLog" WHERE id=$1`,[duplicate]);
 await query(`UPDATE "ProjectMembership" SET status='DISABLED' WHERE id='worker-project-a'`);await assert.rejects(request(),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});await query(`UPDATE "ProjectMembership" SET status='ACTIVE' WHERE id='worker-project-a'`);
 await query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='worker-member-a'`);await assert.rejects(request(),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});await query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='worker-member-a'`);
 const adoptionRow=(await query(`DELETE FROM "AuditLog" WHERE id=$1 RETURNING *`,[accepted.receiptId+'_kyc'])).rows[0];await assert.rejects(request(),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});await query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,[adoptionRow.id,adoptionRow.organizationId,adoptionRow.actorId,adoptionRow.action,adoptionRow.entityType,adoptionRow.entityId,JSON.stringify(adoptionRow.metadata),adoptionRow.createdAt]);
 checks.push('adopted-binding-denies-missing-and-stale-receipts-duplicate-submission-wrong-individual-and-current-assignment-or-membership-revocation');
 const preChallenge=await worker(a),challengeInput={projectId:a.projectId,scope:ownScope,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:a.workerId,revision:preChallenge.revision}},bindingChallenge=await channel.command(ownSession,challengeInput);assert.match(bindingChallenge.code,/^VINCULAR [A-Za-z0-9_-]{43}$/);assert.equal(bindingChallenge.saved,true);assert.equal((await channel.command(ownSession,challengeInput)).replayed,true);
 const wrongTenant=await receive(b,bindingChallenge.code,{timestamp:Math.floor(Date.now()/1000)});await assert.rejects(customerJobTransaction(connect,client=>resolveWorkerChannelIdentity(client,{eventId:wrongTenant.eventId,claimChallenge:true,environment})),{code:'WORKER_CHANNEL_CHALLENGE_REJECTED'});
 const signedBinding=await receive(a,bindingChallenge.code,{timestamp:Math.floor(Date.now()/1000)}),binding=await customerJobTransaction(connect,client=>resolveWorkerChannelIdentity(client,{eventId:signedBinding.eventId,claimChallenge:true,environment}));assert.equal(binding.kind,'CHANNEL_BOUND');assert.equal(binding.member.actorId,'worker-user-a');assert.equal(binding.channelBinding.kycSubmissionId,adopted.kyc.submissionId);assert.equal(binding.channelBinding.proofEventId,signedBinding.eventId);
 assert.equal((await customerJobTransaction(connect,client=>resolveWorkerChannelIdentity(client,{eventId:signedBinding.eventId,claimChallenge:true,environment}))).replayed,true);assert.equal((await query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE "entityId"=$1 AND action='worker.channel.identity.recorded' AND metadata->>'kind'='CHANNEL_BOUND'`,[a.workerId])).rows[0].count,1);assert.equal(JSON.stringify((await query(`SELECT * FROM "AuditLog" WHERE id=$1`,[capture.id])).rows[0]),origin);
 const revokeRow=await worker(a);await participant.save(reviewerSession,{projectId:a.projectId,scope:reviewScope,operationId:randomUUID(),action:'REVOKE',payload:{workerId:a.workerId,revision:revokeRow.revision,reason:'Synthetic post-binding participation revocation'}});await assert.rejects(customerJobTransaction(connect,client=>resolveWorkerChannelIdentity(client,{eventId:signedBinding.eventId,claimChallenge:true,environment})),{code:'WORKER_CHANNEL_CHALLENGE_REJECTED'});assert.equal((await worker(a)).metadata.participant.channelIdentity.binding.status,'REVOKED');
 checks.push('distinct-human-review-then-own-VINCULAR-signed-binding-replays-once-cross-tenant-denies-and-canonical-revocation-stops-old-proof');
 // Additive schema2 group: a distinct synthetic active person, same signed
 // callback/processor/store, and three distinguishable private byte objects.
 const three={...b,workerId:'kyc-worker-three',sender:'5491100000003',sequence:0,baseTimestamp:Math.floor(Date.now()/1000)-30},threeBytes={front:Buffer.concat([lifecyclePng,Buffer.from('synthetic-front')]),back:Buffer.concat([lifecyclePng,Buffer.from('synthetic-back')]),selfie:Buffer.concat([lifecyclePng,Buffer.from('synthetic-selfie')])},threeMedia={front:'150000101',back:'150000102',selfie:'150000103'};
 graph.assets.get(b.key).sender=three.sender;for(const kind of Object.keys(threeMedia))graph.addMedia(b.key,threeMedia[kind],threeBytes[kind]);
 await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,active,metadata) VALUES($1,$2,'Synthetic WhatsApp three-image person',$3,'WORKER',true,$4::jsonb)`,[three.workerId,three.projectId,'+'+three.sender,JSON.stringify({siteRegister:{version:1},participant:{version:1,status:'ACTIVE',clerkUserId:b.workerUserId,permissions:{attendance:false,report:false},kyc:{version:1,status:'NOT_SUBMITTED'}}})]);
 const prepared3=await challenge(three,{captureImageSetVersion:2}),preparedProof=(await query(`SELECT metadata FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.kyc_chat.prepared'`,[three.workerId])).rows;assert.equal(prepared3.captureImageSetVersion,2);assert.equal(preparedProof.length,1);assert.equal(preparedProof[0].metadata.captureImageSetVersion,2);
 const before3=counts();let last3=await execute(three,prepared3.code);last3=await choose(three,last3,'Autorizar imágenes');assert.match(last3.reply.interactive.body.text,/dorso/);const noticeCounts=counts();last3=await execute(three,{type:'image',image:{id:threeMedia.back,mime_type:'image/png'}});assert.deepEqual(counts().puts,noticeCounts.puts);assert.deepEqual(counts().downloads,noticeCounts.downloads);last3=await choose(three,last3,'Autorizar dorso');last3=await choose(three,last3,'Con lectura asistida');last3=await choose(three,last3,'Con comparación facial');
 for(const kind of ['front','back','selfie'])last3=await execute(three,{type:'image',image:{id:threeMedia[kind],mime_type:'image/png'}});assert.equal(counts().downloads,before3.downloads);assert.equal(counts().puts,before3.puts);
 const choice3=last3.reply.interactive.action.sections[0].rows.find(row=>row.title==='Guardar identidad'),confirm3=await receive(three,{type:'interactive',interactive:{type:'list_reply',list_reply:choice3}});loseDepositCommit=true;await assert.rejects(processor.process(confirm3.eventId),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});assert.equal(counts().puts,before3.puts+3);assert.equal(counts().downloads,before3.downloads+3);const savedCounts=counts(),receipt3=(await query(`SELECT * FROM "AuditLog" WHERE "entityId"=$1 AND metadata->>'kind'='KYC_SUBMITTED'`,[three.workerId])).rows;assert.equal(receipt3.length,1);const capture3=receipt3[0],capture3Origin=JSON.stringify(capture3),k3=(await worker(three)).metadata.participant.kyc;
 assert.equal(participantKycImageSet(k3,{receipt:capture3.metadata,projectId:three.projectId}),true);assert.equal(k3.documentBackConsent.noticeVersion,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION);assert.equal(k3.documentBackConsent.noticeSha256,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256);assert.equal(k3.documentBackConsent.recordedAt,k3.submittedAt);assert.equal(k3.captureImageSetVersion,2);assert.deepEqual(k3.images.map(image=>image.id),['document-front','selfie','document-back']);assert.equal(k3.processing.automatic,true);assert.equal(k3.processing.status,'QUEUED');assert.deepEqual(k3.processing.stages,{ocr:{state:'PENDING'},biometric:{state:'PENDING'}});assert.equal(k3.processing.queuedAt,k3.submittedAt);assert.deepEqual(k3.processing.issueCodes,[]);assert.equal(k3.processing.requiresHumanReview,true);assert.equal(k3.processing.identityVerified,false);assert.deepEqual(assertParticipantPreanalysisSource(k3,k3.processing.auto,capture3,{organizationId:b.organizationId,projectId:three.projectId,workerId:three.workerId}),{ocr:true,biometric:true});assert.equal(k3.status,'PENDING_REVIEW');assert.equal(capture3.metadata.identityCertified,false);assert.equal(unexpectedNetworkCalls,0);assert.equal(k3.review,undefined);assert.equal(capture3.metadata.permissionsGranted,false);assert.equal(capture3.metadata.whatsAppAccessGranted,false);
 const originalReceipt=structuredClone(capture3.metadata);delete capture3.metadata.documentBackConsentRecorded;await query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[capture3.id,JSON.stringify(capture3.metadata)]);await assert.rejects(processor.process(confirm3.eventId));assert.equal(counts().downloads,savedCounts.downloads);assert.equal(counts().puts,savedCounts.puts);await query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[capture3.id,JSON.stringify(originalReceipt)]);
 graph.setBeforeRequest(async(_asset,endpoint)=>{assert.ok(!Object.values(threeMedia).includes(endpoint),'Recovery attempted a second Graph media fetch');});const recovered3=await processor.process(confirm3.eventId);graph.setBeforeRequest(async()=>{});assert.equal(recovered3.businessApplied,true);assert.equal(recovered3.replySent,true);assert.equal(counts().downloads,savedCounts.downloads);assert.equal(counts().puts,savedCounts.puts);const afterRecovery=counts();assert.equal((await processor.process(confirm3.eventId)).done,true);assert.deepEqual(counts(),afterRecovery);
 checks.push('schema2-separate-dorso-consent-three-signed-images-and-pinned-durable-receipt-before-human-review');checks.push('schema2-incomplete-receipt-denies-then-lost-ACK-recovers-before-Graph-CDN-Blob-with-exactly-three-uploads');
 const own3={...session},scope3=(await workspace.list(own3)).scope,manager3={...own3,userId:b.ownerUserId,organizationRole:'org:admin'},managerScope3=(await workspace.list(manager3)).scope,privateReads=[],analysisInputs=[],biometricInputs=[],actual3=createParticipantStore({assessCaptureQuality:syntheticCaptureQuality,workspace,connect,environment,get:async(pathname,options)=>{privateReads.push(pathname);return blob.get(pathname,options);},analyzer:{analyzeDni:async input=>{analysisInputs.push(Buffer.from(input.base64,'base64'));return {success:false,code:'AI_RESPONSE_UNCONFIRMED'};}},assessBiometrics:async input=>{biometricInputs.push(input);return {success:false,code:'BIOMETRIC_RESULT_UNCONFIRMED'};}});
 const downloadContext3={projectId:three.projectId,scope:scope3,workerId:three.workerId,imageId:'document-back'};assert.deepEqual((await actual3.downloadKyc(own3,downloadContext3)).bytes,threeBytes.back);
 const processingRow3=await worker(three),processingAudit3=(await query(`SELECT * FROM "AuditLog" WHERE "entityId"=$1 ORDER BY id`,[three.workerId])).rows,processingCounts3=counts(),processingPrivateReads3=privateReads.length,processingNetwork3=unexpectedNetworkCalls;
 await assert.rejects(actual3.save(manager3,{projectId:three.projectId,scope:managerScope3,operationId:randomUUID(),action:'PROCESS_KYC',payload:{workerId:three.workerId,revision:processingRow3.revision,submissionId:k3.submissionId}}),{code:'PARTICIPANT_ANALYSIS_AUTOMATIC'});
 assert.deepEqual(await worker(three),processingRow3);assert.deepEqual((await query(`SELECT * FROM "AuditLog" WHERE "entityId"=$1 ORDER BY id`,[three.workerId])).rows,processingAudit3);assert.deepEqual(counts(),processingCounts3);assert.equal(privateReads.length,processingPrivateReads3);assert.equal(unexpectedNetworkCalls,processingNetwork3);assert.deepEqual(analysisInputs,[]);assert.deepEqual(biometricInputs,[]);assert.equal((await worker(three)).metadata.participant.kyc.status,'PENDING_REVIEW');
 const review3row=await worker(three),review3={projectId:three.projectId,scope:managerScope3,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId:three.workerId,revision:review3row.revision,submissionId:k3.submissionId,decision:'APPROVED',reason:'Synthetic distinct human review of all three private images'}};await assert.rejects(actual3.save(own3,{...review3,scope:scope3}));await actual3.save(manager3,review3);
 const approved3=await worker(three),approvedMember3={actorId:'worker-user-b',clerkUserId:b.workerUserId,organizationId:b.organizationId};assert.equal((await assertApprovedParticipantKyc({query},approved3,approvedMember3)).status,'ACTIVE');await query(`UPDATE "AuditLog" SET metadata=metadata-'documentBackConsentRecorded' WHERE id=$1`,[capture3.id]);await assert.rejects(assertApprovedParticipantKyc({query},approved3,approvedMember3),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});const beforeDeniedRead=privateReads.length;await assert.rejects(actual3.downloadKyc(own3,downloadContext3),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(privateReads.length,beforeDeniedRead);await query(`UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[capture3.id,JSON.stringify(originalReceipt)]);
 checks.push('schema2-private-back-download-preserves-automatic-consent-queue-and-manual-processing-is-denied-without-analysis-or-approval');checks.push('schema2-distinct-human-review-approved-identity-and-download-require-the-original-complete-receipt');
 const revoke3row=await worker(three);await actual3.save(manager3,{projectId:three.projectId,scope:managerScope3,operationId:randomUUID(),action:'REVOKE',payload:{workerId:three.workerId,revision:revoke3row.revision,reason:'Synthetic three-image participation revocation'}});await assert.rejects(actual3.downloadKyc(own3,downloadContext3),{code:'PARTICIPANT_ACCESS_REQUIRED'});await assert.rejects(assertApprovedParticipantKyc({query},await worker(three),approvedMember3),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(privateReads.length,beforeDeniedRead);assert.equal(JSON.stringify((await query(`SELECT * FROM "AuditLog" WHERE id=$1`,[capture3.id])).rows[0]),capture3Origin);checks.push('schema2-canonical-revocation-blocks-private-dorso-and-approved-proof-with-original-receipt-immutable');
 // These fixtures are issued through the real preparer/bridge/outbound at a
 // controlled SQL clock 31 minutes in the past. Continuation uses the actual
 // PostgreSQL clock; no prepared receipt, claim or conversation is rewritten.
 const expiryBase=b,expiryKind='PROJECT',expiryNativeSql=sql=>sql;
 let expiryClockOffset=0,expiryCommitMode=null,expiryGate=null,expiryTracing=false;
 const expiryPids=[];
 const expiryConnect=async()=>{
  const client=await pool.connect();let written=false;
  return {release:broken=>client.release(broken),query:async(sql,args=[])=>{
   if(sql==='BEGIN'&&expiryTracing)expiryPids.push(client.processID);
   if(sql==='COMMIT'&&written&&expiryCommitMode==='ROLLBACK'){expiryCommitMode=null;throw Error('SYNTHETIC_EXPIRY_COMMIT_REJECTED_BEFORE_APPLY');}
   if(sql==='COMMIT'&&written&&expiryGate&&!expiryGate.pid){expiryGate.pid=client.processID;await expiryGate.promise;}
   const clockSql=expiryClockOffset?sql.replaceAll('clock_timestamp()',"(clock_timestamp()-interval '31 minutes')"):sql;
   const value=await client.query(expiryNativeSql(clockSql),args);
   if(sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'participant.kyc_chat.expiry_feedback'"))written=true;
   if(sql==='COMMIT'&&written&&expiryCommitMode==='LOST_ACK'){expiryCommitMode=null;throw Error('SYNTHETIC_EXPIRY_COMMIT_APPLIED_ACK_LOST');}
   return value;
  }};
 };
 const expiryAdapter=createMetaKycExpiryFeedback({connect:expiryConnect,provider,environment}),expiryBridge=createMetaKycBridge({connect:expiryConnect,provider,deposit,environment}),expiryCaptureOutbound=createMetaKycOutbound({connect:expiryConnect,provider,environment});
 const expiryProcessor=createMetaCustomerProcessor({connect:expiryConnect,environment,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_EXPIRY_FEEDBACK_DENIED'],expiredKyc:expiryAdapter.feedback,dispatch:context=>expiryBridge.execute(context),outbound:{send:(context,reply,{purpose})=>purpose==='KYC_EXPIRY_FEEDBACK'?expiryAdapter.send(context,reply):expiryCaptureOutbound.send(context,reply)}});
 const expiryCallback=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect:expiryConnect,environment}),environment,schedule:()=>{}});
 const expiryWorker=async t=>(await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[t.workerId])).rows[0];
 const expiryCount=async(context,receiptId)=>(await query(`SELECT (SELECT count(*)::int FROM "AuditLog" WHERE id=$1 AND action='participant.kyc_chat.expiry_feedback') AS receipts,(SELECT count(*)::int FROM "WebhookEvent" WHERE id=$2 AND provider='meta-customer-outbound-v1') AS outbounds`,[receiptId,customerOutboundId(context.eventId)])).rows[0];
 async function expiryReceive(t,message,contextId=null){
  const value={id:'wamid.NativeExpiry_'+randomUUID().replaceAll('-',''),from:t.sender,timestamp:String(Math.floor((Date.now()+expiryClockOffset)/1000)),...(typeof message==='string'?{type:'text',text:{body:message}}:message),...(contextId?{context:{id:contextId}}:{})},wire={object:'whatsapp_business_account',entry:[{id:t.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:t.phoneNumberId},messages:[value]}}]}]},body=JSON.stringify(wire);
  const response=await expiryCallback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(body).digest('hex')},body}));
  assert.equal(response.status,200);assert.equal((await response.json()).durable,true);return 'customer_webhook_'+splitMetaCustomerEvents(wire)[0].externalId;
 }
 async function expiryFixture(index,{advance=false}={}){
  const t={...expiryBase,workerId:'native-expiry-'+expiryKind.toLowerCase()+'-'+index,sender:'549119900'+String(index).padStart(4,'0'),workerUserId:'user_NativeExpiry'+expiryKind+index},actor=t.workerId+'-actor',membership=t.workerId+'-member';
  await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[actor,t.workerUserId,t.workerId+'@example.invalid']);
  await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'AUDITOR','org:member','ACTIVE')`,[membership,actor,t.organizationId]);
  await query(`INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES($1,$2,$3,'ACTIVE')`,[t.workerId+'-pm',t.projectId,membership]);
  await query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,active,metadata) VALUES($1,$2,'Synthetic native expiry person',$3,'WORKER',true,$4::jsonb)`,[t.workerId,t.projectId,'+'+t.sender,JSON.stringify({siteRegister:{version:1},participant:{version:1,status:'ACTIVE',clerkUserId:t.workerUserId,permissions:{attendance:false,report:false},kyc:{version:1,status:'NOT_SUBMITTED'}}})]);
  graph.assets.get(t.key).sender=t.sender;expiryClockOffset=-31*60000;
  let prepared,promptEvent;
  try{
   prepared=await customerJobTransaction(expiryConnect,async client=>{const member={actorId:t.ownerId,membershipId:'owner-member-'+t.key,organizationId:t.organizationId,role:'ADMIN'},input={projectId:t.projectId,workerId:t.workerId,revision:(await expiryWorker(t)).revision,operationId:randomUUID()};await prepareMetaKycChallenge.beforeProject(client,member,input);return prepareMetaKycChallenge(client,member,{id:t.projectId,organizationId:t.organizationId},input,{environment});});
   assert.equal(prepared.captureImageSetVersion,2);promptEvent=await expiryReceive(t,prepared.code);assert.equal((await expiryProcessor.process(promptEvent)).replySent,true);
   if(advance){
    const original=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[customerOutboundId(promptEvent)])).rows[0],row=await expiryWorker(t),c=row.metadata.participant.kycChatChallenge,s=JSON.parse(decryptCustomerSecret(row.metadata.participant.kycChatConversation.encryptedState,{organizationId:t.organizationId,projectId:c.companyKyc?.anchorProjectId||t.projectId,purpose:'kyc-chat-conversation',resourceId:c.id},environment));
    expiryClockOffset=-31*60000+2000;const next=await expiryReceive(t,{type:'interactive',interactive:{type:'list_reply',list_reply:{id:'kyc:'+s.nonce+':0'}}},original.outcome.messageId);assert.equal((await expiryProcessor.process(next)).replySent,true);
   }
  }finally{expiryClockOffset=0;}
  const prompt=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[customerOutboundId(promptEvent)])).rows[0];assert.equal(prompt.outcome.state,'SENT');
  const before=await expiryWorker(t),challenge=before.metadata.participant.kycChatChallenge,state=JSON.parse(decryptCustomerSecret(before.metadata.participant.kycChatConversation.encryptedState,{organizationId:t.organizationId,projectId:challenge.companyKyc?.anchorProjectId||t.projectId,purpose:'kyc-chat-conversation',resourceId:challenge.id},environment));
  assert.equal(before.metadata.participant.kycChatChallenge.status,'CLAIMED');assert.equal(state.step,advance?'BACK_CONSENT':'CONSENT');assert.ok(Date.parse(state.expiresAt)<Date.now());
  const eventId=await expiryReceive(t,{type:'image',image:{id:t.mediaId,mime_type:'image/png'}},prompt.outcome.messageId),leaseToken=randomUUID();
  await query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,"leaseExpiresAt"=clock_timestamp()+interval '1 minute',attempts=1 WHERE id=$1 AND status='PENDING'`,[eventId,leaseToken]);
  const event=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[eventId])).rows[0],context={eventId,projectId:t.anchorProjectId||t.projectId,channelId:t.channelId,payloadDigest:event.payload.payloadDigest,leaseToken};
  return {t,context,before,receiptId:metaKycExpiryReceiptId(eventId),prompt};
 }
 const expiryStats=()=>({puts:blob.puts(),downloads:graph.assets.get(expiryBase.key).downloads,sends:graph.assets.get(expiryBase.key).sends});
 const expiryEvidence={kind:expiryKind,postgresExecuted:true,controlledIssuanceClockOffsetMs:-31*60000,continuationClock:'actual-PostgreSQL-clock',preparedClaimPromptBytesRewritten:false,cases:[],provider:'real-adapter-controlled-Graph-fetch',realProviderCalls:0};
 const waitExpiry=async predicate=>{const deadline=Date.now()+6000;while(Date.now()<deadline){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('NATIVE_EXPIRY_LOCK_PROBE_TIMEOUT');};
 const originalExpirySender=graph.assets.get(expiryBase.key).sender;
 try{
  const t=await expiryFixture(1),baseline=expiryStats();expiryTracing=true;expiryPids.length=0;
  let release;const promise=new Promise(resolve=>{release=resolve;});expiryGate={pid:null,promise,release};
  let firstError;const first=expiryAdapter.feedback(t.context,{code:'META_KYC_CHALLENGE_EXPIRED'});first.catch(error=>{firstError=error;});let second,lock;
  try{
   await waitExpiry(()=>{if(firstError)throw firstError;return expiryGate.pid;});assert.deepEqual(await expiryCount(t.context,t.receiptId),{receipts:0,outbounds:0});
   second=expiryAdapter.feedback(t.context,{code:'META_KYC_CHALLENGE_EXPIRED'});second.catch(()=>{});
   lock=await waitExpiry(async()=>{const rows=(await query(`SELECT pid,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND pid=ANY($1::int[])`,[expiryPids])).rows;return rows.find(row=>row.pid!==expiryGate.pid&&row.wait_event_type==='Lock'&&row.blockers.includes(expiryGate.pid));});
  }finally{release();}
  const receipts=await Promise.all([first,second]);expiryGate=null;expiryTracing=false;assert.equal(new Set(expiryPids).size>=2,true);assert.deepEqual(receipts[0],receipts[1]);assert.deepEqual(await expiryCount(t.context,t.receiptId),{receipts:1,outbounds:0});assert.deepEqual(expiryStats(),baseline);
  const sent=await Promise.all(receipts.map(receipt=>expiryAdapter.send(t.context,receipt.reply)));assert.equal(sent.filter(value=>value.replayed===false).length,1);assert.equal(sent.filter(value=>value.replayed===true).length,1);assert.deepEqual(await expiryCount(t.context,t.receiptId),{receipts:1,outbounds:1});assert.deepEqual(expiryStats(),{...baseline,sends:baseline.sends+1});assert.deepEqual(await expiryWorker(t.t),t.before);
  const recorded=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[customerOutboundId(t.context.eventId)])).rows[0];assert.deepEqual(await expiryAdapter.feedback(t.context,{recoverOnly:true}),receipts[0]);assert.equal((await expiryAdapter.send(t.context,receipts[0].reply)).replayed,true);assert.deepEqual((await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[recorded.id])).rows[0],recorded);assert.equal(expiryStats().sends,baseline.sends+1);
  expiryEvidence.cases.push({name:'native-row-lock-concurrent-receipt-single-outbox-and-HTTP',distinctBackendPids:[...new Set(expiryPids)],blockedPid:lock.pid,blockers:lock.blockers,uncommittedReceiptInvisible:true,receiptCount:1,outboxCount:1,httpTransfers:1,workerBytesUnchanged:true,mediaAndDepositDelta:0});
  checks.push('PROJECT-schema2-expired-SENT-prompt-native-row-lock-race-one-receipt-outbox-HTTP-no-media-or-Worker-change');
  const commits=[];
  for(const [index,mode]of [[2,'LOST_ACK'],[3,'ROLLBACK']]){
   const t=await expiryFixture(index),baseline=expiryStats();expiryCommitMode=mode;await assert.rejects(expiryAdapter.feedback(t.context,{code:'META_KYC_CHALLENGE_EXPIRED'}),new RegExp(mode==='LOST_ACK'?'COMMIT_APPLIED_ACK_LOST':'COMMIT_REJECTED_BEFORE_APPLY'));
   assert.deepEqual(await expiryWorker(t.t),t.before);assert.deepEqual(expiryStats(),baseline);assert.deepEqual(await expiryCount(t.context,t.receiptId),{receipts:mode==='LOST_ACK'?1:0,outbounds:0});
   const recovered=await expiryAdapter.feedback(t.context,{recoverOnly:true});assert.equal(recovered?.kind||null,mode==='LOST_ACK'?'KYC_EXPIRY_FEEDBACK':null);
   const receipt=await expiryAdapter.feedback(t.context,{code:'META_KYC_CHALLENGE_EXPIRED'});assert.deepEqual(receipt.reply,META_KYC_EXPIRY_REPLY);if(mode==='LOST_ACK')graph.assets.get(expiryBase.key).sendResponseLost=true;
   const sent=await expiryAdapter.send(t.context,receipt.reply);assert.equal(sent.state,mode==='LOST_ACK'?'SEND_UNKNOWN':'SENT');assert.equal((await expiryAdapter.send(t.context,receipt.reply)).replayed,true);assert.deepEqual(await expiryCount(t.context,t.receiptId),{receipts:1,outbounds:1});assert.deepEqual(expiryStats(),{...baseline,sends:baseline.sends+1});assert.deepEqual(await expiryWorker(t.t),t.before);
   commits.push({mode,actualCommitApplied:mode==='LOST_ACK',realRollback:mode==='ROLLBACK',recoveryReturnedReceipt:mode==='LOST_ACK',sendState:sent.state,httpTransfers:1,workerBytesUnchanged:true,mediaAndDepositDelta:0});
  }
  expiryEvidence.cases.push({name:'actual-COMMIT-ACK-loss-versus-ROLLBACK-and-unknown-wire-recovery',outcomes:commits});checks.push('PROJECT-expiry-native-COMMIT-applied-ACK-loss-vs-ROLLBACK-recovery-unknown-HTTP-never-retransmitted');
  const revoked=await expiryFixture(4),baselineRevoked=expiryStats(),receipt=await expiryAdapter.feedback(revoked.context,{code:'META_KYC_CHALLENGE_EXPIRED'});
  const denied=createMetaKycExpiryFeedback({connect:expiryConnect,provider,environment,afterReserve:()=>query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id=$1`,['owner-member-'+expiryBase.key])});
  try{await assert.rejects(denied.send(revoked.context,receipt.reply));const observed=await denied.feedback(revoked.context,{recoverOnly:true});assert.equal(observed.reply,undefined);assert.equal(observed.replyState,'SEND_STARTED');assert.deepEqual(expiryStats(),baselineRevoked);assert.deepEqual(await expiryWorker(revoked.t),revoked.before);assert.deepEqual(await expiryCount(revoked.context,revoked.receiptId),{receipts:1,outbounds:1});}
  finally{await query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id=$1`,['owner-member-'+expiryBase.key]);}
  expiryEvidence.cases.push({name:'current-native-issuer-revocation-after-reservation-no-HTTP',receiptCount:1,outboxCount:1,httpTransfers:0,workerBytesUnchanged:true,mediaAndDepositDelta:0});checks.push('PROJECT-expiry-native-current-issuer-revocation-after-reserve-retains-marker-with-zero-HTTP-or-media');
  contextFeedbackNative=await verifyKycContextFeedbackNative({query,connect:expiryConnect,provider,environment,fixture:expiryFixture,receive:expiryReceive,readWorker:expiryWorker,stats:expiryStats,kind:expiryKind,checks});
 }finally{expiryGate?.release?.();expiryClockOffset=0;expiryTracing=false;graph.assets.get(expiryBase.key).sender=originalExpirySender;}
 expiryFeedbackNative=expiryEvidence;

 const durable=JSON.stringify((await query(`SELECT metadata FROM "AuditLog"`)).rows);for(const t of tenants){assert.ok(!durable.includes(t.token));assert.ok(!durable.includes('data:image'));assert.ok(!durable.includes('IDENTIDAD '));}
 assert.equal(unexpectedNetworkCalls,0);assert.deepEqual(graph.unexpected,[]);assert.equal(blob.puts(),7);for(const source of sourceManifest)assert.equal(sha(readFileSync(path.join(root,source.path))),source.sha256);assert.equal(sha(readFileSync(new URL(import.meta.url))),harnessSha256);
 const report={status:'PASS',expiryFeedbackNative,contextFeedbackNative,environment:'disposable-localhost-postgresql-meta-kyc-chat',checks,sourceManifest,harnessSha256,tenants:2,provider:'strict-controlled-Graph-fetch-only',blob:'controlled-private-byte-store',realProviderCalls:0,unexpectedNetworkCalls,productionDataTouched:false,realMetaAccepted:false,humanAccepted:false};
 nativeReport=report;
}finally{
 globalThis.fetch=originalFetch;
 try{await closeDisposablePool(pool);poolClosed=true;assert.equal((await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid=ANY($1::int[])',[[...ownedPids]])).rows[0].count,0);ownConnectionsClosed=true;if(created){await admin.query(`DROP DATABASE "${database}"`);assert.equal((await admin.query('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=$1) AS present',[database])).rows[0].present,false);databaseRemoved=true;}}finally{await admin.end();adminClosed=true;}
}

assert.ok(nativeReport&&poolClosed&&databaseRemoved&&adminClosed&&ownConnectionsClosed);Object.assign(nativeReport,{poolClosed,databaseRemoved,adminClosed,ownConnectionsClosed});
mkdirSync('.vercel/meta-kyc-chat-evidence',{recursive:true});writeFileSync('.vercel/meta-kyc-chat-evidence/postgres.json',JSON.stringify(nativeReport,null,2));console.log(JSON.stringify(nativeReport));
