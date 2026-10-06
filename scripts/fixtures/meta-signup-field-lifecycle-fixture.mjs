import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {OBRASAAS_META_CHANNEL} from '../../src/lib/meta-channel-binding.mjs';
import {IDENTITY_INSTANCE,IDENTITY_PUBLIC_KEY} from '../../src/lib/production-identity-config.mjs';

// All credentials, people, numbers and bytes in this fixture are synthetic.
// Nothing falls back to a network provider or a production connection.
export function lifecycleDisposableUrl(environment){
 assert.equal(environment.CUTOVER_TEST_DISPOSABLE,'1','LIFECYCLE_DISPOSABLE_MARKER_REQUIRED');
 assert.ok(!environment.VERCEL&&!environment.VERCEL_ENV,'LIFECYCLE_PRODUCTION_CONTEXT_REJECTED');
 const url=new URL(environment.CUTOVER_TEST_DATABASE_URL||'https://unconfigured.invalid');
 assert.ok(['postgres:','postgresql:'].includes(url.protocol),'LIFECYCLE_DATABASE_PROTOCOL_REJECTED');
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'LIFECYCLE_REMOTE_DATABASE_REJECTED');
 assert.equal(url.pathname,'/obrasaas_cutover_ci','LIFECYCLE_DATABASE_NAME_REJECTED');
 assert.equal(url.search,'','LIFECYCLE_DATABASE_OPTIONS_REJECTED');
 assert.equal(url.hash,'','LIFECYCLE_DATABASE_FRAGMENT_REJECTED');
 return url;
}
export const lifecycleEnvironment={
 NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,
 META_APP_SECRET:'synthetic-lifecycle-meta-secret-no-provider-access',
 META_CONFIG_ID:'1555555555555555',META_GRAPH_API_VERSION:'v25.0',
 META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,73).toString('base64'),
 META_CUSTOMER_VERIFY_TOKEN:'synthetic-lifecycle-callback-verify-token-only',
 META_CUSTOMER_JOB_SECRET:'synthetic-lifecycle-internal-job-secret-only',
 CRON_SECRET:'synthetic-lifecycle-cron-secret-no-production-access',
 META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',
 PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-private-byte-store-only',
 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,
 CLERK_SECRET_KEY:'sk_live_synthetic_lifecycle_fixture_no_provider_access',
 CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,
 NEXT_PUBLIC_APP_URL:'https://obrasaas.com',CLERK_AUTHORIZED_PARTIES:'https://obrasaas.com',
};
export const lifecyclePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2l8AAAAASUVORK5CYII=','base64');
export const lifecycleTenants=[
 {key:'a',organizationId:'company-a',clerkOrganizationId:'org_A',projectId:'project-a',ownerId:'owner-a',ownerUserId:'user_OwnerA',workerUserId:'user_WorkerA',workerEmail:'worker-a@example.invalid',sender:'5491100001111',phoneNumberId:'120000011',wabaId:'130000011',mediaId:'150000011'},
 {key:'b',organizationId:'company-b',clerkOrganizationId:'org_B',projectId:'project-b',ownerId:'owner-b',ownerUserId:'user_OwnerB',workerUserId:'user_WorkerB',workerEmail:'worker-b@example.invalid',sender:'5491100002222',phoneNumberId:'120000012',wabaId:'130000012',mediaId:'150000012'},
].map(tenant=>({...tenant,code:'synthetic-lifecycle-signup-code-'+tenant.key,token:'synthetic-lifecycle-customer-token-'+tenant.key+'-not-real',displayNumber:'+54911000099'+(tenant.key==='a'?'11':'22')}));

export const lifecycleSchema=`
 CREATE TYPE "TenantRole" AS ENUM('ADMIN','DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR');
 CREATE TYPE "MembershipStatus" AS ENUM('ACTIVE','INVITED','DISABLED');
 CREATE TYPE "SystemRole" AS ENUM('TENANT_USER');
 CREATE TYPE "IncidentSeverity" AS ENUM('INFO','LOW','MEDIUM','HIGH','CRITICAL');
 CREATE TYPE "AttendanceStatus" AS ENUM('PRESENT','OUTSIDE_GEOFENCE','EXCUSED','ABSENT','PENDING_GEO');
 CREATE TYPE "TaskStatus" AS ENUM('BACKLOG','READY','IN_PROGRESS','BLOCKED','DONE');
 CREATE TYPE "OperationalProposalType" AS ENUM('TASK_PROGRESS','DELAY_REPORT','CRITICAL_INCIDENT');
 CREATE TYPE "OperationalProposalStatus" AS ENUM('PENDING','APPLIED','REJECTED','EXPIRED','INVALIDATED');
 CREATE TYPE "WhatsAppConnectionStatus" AS ENUM('PENDING','CONNECTED','ERROR','DISABLED');
 CREATE TYPE "WebhookStatus" AS ENUM('PENDING','PROCESSED','FAILED');
 CREATE TABLE "Organization"(id text PRIMARY KEY,name text,"clerkOrganizationId" text UNIQUE,metadata jsonb);
 CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text UNIQUE,"primaryEmail" text UNIQUE NOT NULL,"fullName" text,"systemRole" "SystemRole" DEFAULT 'TENANT_USER',"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"userId" text REFERENCES "PlatformUser","organizationId" text REFERENCES "Organization","tenantRole" "TenantRole","clerkRole" text,status "MembershipStatus","updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,UNIQUE("organizationId","userId"));
 CREATE TABLE "Project"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text,status text,metadata jsonb,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "ProjectMembership"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status "MembershipStatus","updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,UNIQUE("projectId","tenantMembershipId"));
 CREATE TABLE "Worker"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",name text,phone text,role text,active boolean DEFAULT true,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,UNIQUE("projectId",phone));
 CREATE TABLE "WhatsAppConnection"(id text PRIMARY KEY,"projectId" text UNIQUE REFERENCES "Project",enabled boolean,"connectionStatus" "WhatsAppConnectionStatus","phoneNumberId" text UNIQUE,"whatsappBusinessId" text,"encryptedAccessToken" text,"encryptedPin" text,"displayPhoneNumber" text,"verifiedBusinessName" text,metadata jsonb,"lastVerifiedAt" timestamp,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "WebhookEvent"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",provider text,"externalId" text,"eventType" text,status "WebhookStatus" DEFAULT 'PENDING',attempts integer DEFAULT 0,payload jsonb,outcome jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,"processedAt" timestamp,"appliedAt" timestamp,"lastError" text,"leaseToken" text,"leaseExpiresAt" timestamp,UNIQUE(provider,"externalId"));
 CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text,"entityType" text,"entityId" text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "Task"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text,status "TaskStatus",progress int,"startsAt" timestamp,"endsAt" timestamp,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "Incident"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","externalId" text,title text,description text,severity "IncidentSeverity" DEFAULT 'INFO',status text DEFAULT 'open',reporter text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "AttendanceEntry"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","workerId" text REFERENCES "Worker",status "AttendanceStatus",latitude numeric,longitude numeric,"distanceMeters" int,source text,"checkedInAt" timestamp DEFAULT CURRENT_TIMESTAMP,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "OperationalProposal"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","proposedByWorkerId" text REFERENCES "Worker","resolvedByWorkerId" text,"sourceProvider" varchar(32),"sourceExternalId" varchar(190),"resolverProvider" varchar(32),"resolverExternalId" varchar(190),"confirmationCode" varchar(12),type "OperationalProposalType",status "OperationalProposalStatus" DEFAULT 'PENDING',summary varchar(240),action jsonb,precondition jsonb,result jsonb,"classifierVersion" varchar(64),"transcriptSha256" char(64),"expiresAt" timestamp,"resolvedAt" timestamp,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp);
 CREATE UNIQUE INDEX ON "OperationalProposal"("projectId","sourceProvider","sourceExternalId");
 CREATE UNIQUE INDEX ON "OperationalProposal"("projectId","resolverProvider","resolverExternalId");
 CREATE UNIQUE INDEX ON "OperationalProposal"("projectId","confirmationCode");
`;

export function createControlledLifecycleGraph(environment=lifecycleEnvironment){
 const assets=new Map(lifecycleTenants.map(tenant=>[tenant.key,{...tenant,registered:false,subscribed:false,subscriptionOverride:null,exchanges:0,registrations:0,subscriptions:0,sends:0,downloads:0,registerResponseLost:false,registerRejectedOnce:false,registerPendingOnce:false,sendResponseLost:false}]));
 const media=new Map(lifecycleTenants.map(tenant=>[tenant.mediaId,{assetKey:tenant.key,bytes:lifecyclePng,pathname:'/whatsapp_business/attachments/synthetic-'+tenant.key+'.png'}]));
 function addMedia(assetKey,mediaId,bytes){
  assert.ok(assets.has(assetKey));assert.match(mediaId,/^\d+$/);assert.ok(!media.has(mediaId));assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>8&&bytes.length<=2*1024*1024);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  media.set(mediaId,{assetKey,bytes:Buffer.from(bytes),pathname:'/whatsapp_business/attachments/synthetic-'+assetKey+'-'+mediaId+'.png'});
 }
 const messages=new Map(),unexpected=[];
 let beforeRequest=async()=>{};
 async function fetchImpl(input,options={}){
  const url=new URL(input),method=options.method||'GET';
  try{
   assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.port,'');assert.equal(options.redirect,'error');
   const bearer=options.headers?.Authorization;
   if(url.hostname==='lookaside.fbsbx.com'){
    const selected=[...media.values()].find(value=>url.pathname===value.pathname),asset=assets.get(selected?.assetKey);
    assert.ok(asset);assert.equal(bearer,'Bearer '+asset.token);assert.equal(method,'GET');asset.downloads++;
    return new Response(selected.bytes,{headers:{'Content-Type':'image/png','Content-Length':String(selected.bytes.length)}});
   }
   assert.equal(url.hostname,'graph.facebook.com');assert.ok(url.pathname.startsWith('/v25.0/'));
   const endpoint=url.pathname.slice('/v25.0/'.length),body=options.body?JSON.parse(options.body):null;
   if(endpoint==='oauth/access_token'){
    assert.equal(method,'GET');assert.equal(url.searchParams.get('client_id'),environment.NEXT_PUBLIC_META_APP_ID);assert.equal(url.searchParams.get('client_secret'),environment.META_APP_SECRET);
    const asset=[...assets.values()].find(value=>value.code===url.searchParams.get('code'));assert.ok(asset);asset.exchanges++;
    await beforeRequest(asset,'exchange',body);return Response.json({access_token:asset.token});
   }
   if(endpoint==='debug_token'){
    assert.equal(bearer,'Bearer '+environment.NEXT_PUBLIC_META_APP_ID+'|'+environment.META_APP_SECRET);
    const asset=[...assets.values()].find(value=>value.token===url.searchParams.get('input_token'));assert.ok(asset);
    return Response.json({data:{is_valid:true,app_id:environment.NEXT_PUBLIC_META_APP_ID,expires_at:0,scopes:['whatsapp_business_management','whatsapp_business_messaging'],granular_scopes:[{scope:'whatsapp_business_management',target_ids:[asset.wabaId]}]}});
   }
   const asset=[...assets.values()].find(value=>bearer==='Bearer '+value.token);assert.ok(asset);
   assert.equal(url.searchParams.get('appsecret_proof'),createHmac('sha256',environment.META_APP_SECRET).update(asset.token).digest('hex'));
   await beforeRequest(asset,endpoint,body);
   if(endpoint===asset.wabaId+'/phone_numbers'&&method==='GET')return Response.json({data:[{id:asset.phoneNumberId,display_phone_number:asset.displayNumber,verified_name:'Synthetic company '+asset.key,code_verification_status:'VERIFIED',status:asset.registered?'CONNECTED':'PENDING'}]});
   if(endpoint===asset.wabaId+'/subscribed_apps'){
    if(method==='POST'){assert.equal(body.override_callback_uri,'https://obrasaas.com/api/meta/customer-callback');assert.equal(body.verify_token,environment.META_CUSTOMER_VERIFY_TOKEN);asset.subscribed=true;asset.subscriptionOverride=body.override_callback_uri;asset.subscriptions++;return Response.json({success:true});}
    assert.equal(method,'GET');return Response.json({data:asset.subscribed?[{whatsapp_business_api_data:{id:environment.NEXT_PUBLIC_META_APP_ID},override_callback_uri:asset.subscriptionOverride}]:[]});
   }
   if(endpoint===asset.phoneNumberId+'/register'&&method==='POST'){
    assert.equal(body.messaging_product,'whatsapp');assert.match(body.pin,/^\d{6}$/);asset.registrations++;
    if(asset.registerRejectedOnce){asset.registerRejectedOnce=false;return Response.json({error:{code:100,message:'Synthetic invalid PIN'}},{status:400});}
    if(asset.registerPendingOnce){asset.registerPendingOnce=false;return Response.json({error:{code:2,message:'Synthetic temporarily unconfirmed registration'}},{status:503});}
    asset.registered=true;
    if(asset.registerResponseLost){asset.registerResponseLost=false;throw new Error('SYNTHETIC_REGISTER_RESPONSE_LOST');}
    return Response.json({success:true});
   }
   if(endpoint===asset.phoneNumberId+'/messages'&&method==='POST'){
    assert.equal(body.messaging_product,'whatsapp');assert.equal(body.to,asset.sender);assert.match(body.biz_opaque_callback_data,/^customer_outbound_[a-f0-9]{64}$/);assert.match(body.context.message_id,/^wamid\./);asset.sends++;
    const message={asset:asset.key,body,id:'wamid.SyntheticLifecycleReply_'+asset.key+'_'+asset.sends};messages.set(body.biz_opaque_callback_data,message);
    if(asset.sendResponseLost){asset.sendResponseLost=false;throw new Error('SYNTHETIC_SEND_RESPONSE_LOST');}
    return Response.json({messages:[{id:message.id}]});
   }
   if(media.has(endpoint)&&method==='GET'){
    const selected=media.get(endpoint);assert.equal(selected.assetKey,asset.key);
    assert.equal(url.searchParams.get('phone_number_id'),asset.phoneNumberId);
    return Response.json({id:endpoint,url:'https://lookaside.fbsbx.com'+selected.pathname,mime_type:'image/png',file_size:selected.bytes.length,sha256:createHash('sha256').update(selected.bytes).digest('hex')});
   }
   throw new Error('LIFECYCLE_GRAPH_ENDPOINT_NOT_CONTROLLED');
  }catch(error){if(!/^SYNTHETIC_(REGISTER|SEND)_RESPONSE_LOST$/.test(error.message))unexpected.push('LIFECYCLE_GRAPH_REQUEST_REJECTED');throw error;}
 }
 return {fetchImpl,assets,messages,unexpected,addMedia,setBeforeRequest:callback=>{beforeRequest=callback;}};
}

export function createControlledLifecycleClerk(){
 const invitations=new Map();let sent=0;
 const client={organizations:{
  createOrganizationInvitation:async input=>{sent++;const row={id:'orginv_Lifecycle'+sent,organizationId:input.organizationId,emailAddress:input.emailAddress,role:input.role,status:'pending',expiresAt:Date.now()+7*86400000,publicMetadata:input.publicMetadata};invitations.set(input.publicMetadata.obrasaasInvitationId,row);return row;},
  getOrganizationInvitationList:async({organizationId})=>{const data=[...invitations.values()].filter(row=>row.organizationId===organizationId);return {data,totalCount:data.length};},
  getOrganizationMembershipList:async({organizationId,userId})=>{const tenant=lifecycleTenants.find(value=>value.clerkOrganizationId===organizationId&&[value.workerUserId,value.ownerUserId].includes(userId[0]));assert.ok(tenant);const row=[...invitations.values()].find(value=>value.organizationId===organizationId&&value.emailAddress===tenant.workerEmail);return {totalCount:1,data:[{organization:{id:organizationId},publicUserData:{userId:userId[0]},role:userId[0]===tenant.ownerUserId?'org:admin':'org:member',publicMetadata:{obrasaasInvitationId:row?.publicMetadata.obrasaasInvitationId}}]};},
 },users:{getUser:async userId=>{const tenant=lifecycleTenants.find(value=>value.workerUserId===userId);assert.ok(tenant);return {id:userId,primaryEmailAddressId:'email_fixture',emailAddresses:[{id:'email_fixture',emailAddress:tenant.workerEmail,verification:{status:'verified'}}]};}}};
 return {client:async()=>client,invitations,sent:()=>sent};
}
export function createControlledLifecycleBlob(){
 const objects=new Map();let puts=0;
 const get=async pathname=>{const item=objects.get(pathname);return item?{statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname,size:item.bytes.length,contentType:item.contentType},stream:new ReadableStream({start(controller){controller.enqueue(item.bytes);controller.close();}})}:null;};
 const put=async(pathname,bytes,options)=>{assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);assert.ok(!objects.has(pathname));puts++;objects.set(pathname,{bytes:Buffer.from(bytes),contentType:options.contentType});return {url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname};};
 return {get,put,objects,puts:()=>puts};
}
