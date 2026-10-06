import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleDisposableUrl,lifecycleEnvironment,lifecycleSchema,lifecycleTenants,createControlledLifecycleGraph,createControlledLifecycleBlob} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerOutbound,customerJobTransaction,customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,readMetaKycConversation,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createParticipantChannelKycDeposit} from '../src/lib/participant-channel-kyc.mjs';
import {createPrivateImageUploader} from '../src/lib/private-image-upload.mjs';
import {resolveWorkerChannelIdentity,createWorkerChannelStore} from '../src/lib/worker-channel-identity.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';

// Boundary validation occurs before constructing clients. This creates only a
// random disposable database under the already provisioned localhost CI server.
const url=lifecycleDisposableUrl(process.env),database='obrasaas_meta_kyc_'+randomUUID().replaceAll('-','');
assert.match(database,/^obrasaas_meta_kyc_[a-f0-9]{32}$/);
const admin=new Client({connectionString:url.toString()}),environment={...lifecycleEnvironment},tenants=lifecycleTenants.map(t=>({...t,channelId:'kyc-channel-'+t.key,workerId:'kyc-worker-'+t.key,sequence:0,baseTimestamp:Math.floor(Date.now()/1000)-45})),checks=[],graph=createControlledLifecycleGraph(environment),blob=createControlledLifecycleBlob();
let pool,created=false,loseDepositCommit=false,loseDispatchCommit=false,unexpectedNetworkCalls=0,fieldFallbacks=0;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{unexpectedNetworkCalls++;throw new Error('KYC_UNCONTROLLED_NETWORK_REJECTED');};
const query=(sql,args)=>pool.query(sql,args);
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;
 pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8}));await query(lifecycleSchema);
 for(const t of tenants){
  const active=t.key==='b';
  await query(`INSERT INTO "Organization" VALUES($1,$2,$3,'{}')`,[t.organizationId,'Synthetic KYC company '+t.key,t.clerkOrganizationId]);
  await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[t.ownerId,t.ownerUserId,'owner-'+t.key+'@example.invalid']);
  await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['owner-member-'+t.key,t.ownerId,t.organizationId]);
  await query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{}')`,[t.projectId,t.organizationId,'Synthetic KYC project '+t.key]);
  if(active){
   await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,['worker-user-'+t.key,t.workerUserId,t.workerEmail]);
   await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'SITE_MANAGER','org:member','ACTIVE')`,['worker-member-'+t.key,'worker-user-'+t.key,t.organizationId]);
   await query(`INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES($1,$2,$3,'ACTIVE')`,['worker-project-'+t.key,t.projectId,'worker-member-'+t.key]);
  }
  const metadata={siteRegister:{version:1},participant:{version:1,status:active?'ACTIVE':'INVITED',clerkUserId:active?t.workerUserId:null,permissions:{attendance:active,report:active},invitation:{id:'invite_KycFixture'+t.key,state:active?'ACCEPTED':'SENT',expiresAt:new Date(Date.now()+7*86400000).toISOString()},kyc:{version:1,status:'NOT_SUBMITTED'}}};
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
 const provider=createMetaCustomerProvider({environment,fetchImpl:graph.fetchImpl}),uploader=createPrivateImageUploader({get:blob.get,put:blob.put,environment:()=>environment}),deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload:uploader.uploadImageToBlob,environment});
 const bridge=createMetaKycBridge({connect,provider,deposit,environment}),outbound=createMetaKycOutbound({connect,provider,environment}),fieldOutbound=createMetaCustomerOutbound({connect,provider,resolveIdentity:resolveWorkerChannelIdentity,environment});
 const processor=createMetaCustomerProcessor({connect,environment,authorizationCodes:META_KYC_AUTHORIZATION_CODES,dispatch:async context=>{const result=await bridge.execute(context);if(result)return result;fieldFallbacks++;return null;},outbound:{send:(context,reply,{purpose}={})=>purpose==='KYC_CAPTURE'?outbound.send(context,reply):fieldOutbound.send(context,reply),observeStatus:(...args)=>fieldOutbound.observeStatus(...args)}});
 const inbox=createMetaCustomerInbox({connect,environment}),callback=createMetaCustomerCallbackHandlers({inbox,environment,schedule:()=>{}}),[a,b]=tenants;
 const worker=async t=>(await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[t.workerId])).rows[0];
 async function challenge(t){return customerJobTransaction(connect,async client=>{
  const project=(await client.query(`SELECT id,"organizationId" FROM "Project" WHERE id=$1 FOR UPDATE`,[t.projectId])).rows[0],row=await worker(t);
  const member={actorId:t.ownerId,membershipId:'owner-member-'+t.key,organizationId:t.organizationId,role:'ADMIN'};
  return prepareMetaKycChallenge(client,member,project,{workerId:t.workerId,revision:row.revision,operationId:randomUUID()});
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
 const initial=await challenge(a);assert.match(initial.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);assert.equal(initial.codeUnavailable,false);
 const originalAudit=JSON.stringify((await query(`SELECT metadata FROM "AuditLog"`)).rows);assert.ok(!originalAudit.includes(initial.code));assert.equal((await worker(a)).metadata.participant.permissions.attendance,false);
 const baseline=counts();await receive(a,initial.code,{signature:false});assert.deepEqual(counts(),baseline);
 const outsider=await execute(a,initial.code,{from:'5491100009999'});assert.equal(outsider.result.businessApplied,false);assert.equal(outsider.result.replySent,false);assert.deepEqual(counts(),baseline);
 const cross=await execute(b,initial.code);assert.equal(cross.result.businessApplied,false);assert.equal(cross.result.replySent,false);assert.deepEqual(counts(),baseline);
 checks.push('unsigned-wrong-phone-and-cross-tenant-WABA-cannot-start-KYC-or-send');
 await mutate(a,m=>{m.participant.kycChatChallenge.expiresAt=new Date(Date.now()-1000).toISOString();});const expired=await execute(a,initial.code);assert.equal(expired.result.code,'META_KYC_CHALLENGE_EXPIRED');assert.deepEqual(counts(),baseline);
 const revoked=await challenge(a);await query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id=$1`,['owner-member-a']);assert.equal((await execute(a,revoked.code)).result.code,'META_KYC_CHALLENGE_REVOKED');assert.deepEqual(counts(),baseline);await query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id=$1`,['owner-member-a']);
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
 await assert.rejects(channel.command(session,{projectId:b.projectId,scope,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:b.workerId,revision:row.revision}}),{code:'WORKER_CHANNEL_KYC_REVIEW_REQUIRED'});
 checks.push('unchanged-VINCULAR-guard-still-requires-distinct-human-KYC-review-before-channel-binding');
 const durable=JSON.stringify((await query(`SELECT metadata FROM "AuditLog"`)).rows);for(const t of tenants){assert.ok(!durable.includes(t.token));assert.ok(!durable.includes('data:image'));assert.ok(!durable.includes('IDENTIDAD '));}
 assert.equal(unexpectedNetworkCalls,0);assert.deepEqual(graph.unexpected,[]);assert.equal(blob.puts(),4);
 const report={status:'PASS',environment:'disposable-localhost-postgresql-meta-kyc-chat',checks,tenants:2,provider:'strict-controlled-Graph-fetch-only',blob:'controlled-private-byte-store',realProviderCalls:0,unexpectedNetworkCalls,productionDataTouched:false,realMetaAccepted:false,humanAccepted:false};
 mkdirSync('.vercel/meta-kyc-chat-evidence',{recursive:true});writeFileSync('.vercel/meta-kyc-chat-evidence/postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 globalThis.fetch=originalFetch;
 try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}
}
