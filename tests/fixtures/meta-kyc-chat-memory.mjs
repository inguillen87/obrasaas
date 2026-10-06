import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {digest} from '../../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../../src/lib/meta-customer-callback.mjs';
import {metaKycChallengeDigest} from '../../src/lib/meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,readMetaKycConversation} from '../../src/lib/meta-kyc-identity.mjs';
import {createMetaKycBridge} from '../../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../../src/lib/meta-kyc-outbound.mjs';
import {createParticipantChannelKycDeposit} from '../../src/lib/participant-channel-kyc.mjs';
import {createPrivateImageUploader} from '../../src/lib/private-image-upload.mjs';
import {lifecycleEnvironment,lifecyclePng,createControlledLifecycleBlob} from '../../scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs';

// A transaction/SQL adapter fixture for focal units. PostgreSQL behavior is
// covered separately by verify-meta-kyc-chat-postgres.mjs in disposable CI.
export function kycMemoryFixture({active=false}={}){
 const environment={...lifecycleEnvironment},now=new Date(),code='IDENTIDAD '+Buffer.alloc(32,48).toString('base64url');
 const project={id:'project-a',organizationId:'company-a',name:'Synthetic project',metadata:{}},issuer={membershipId:'manager-member',actorId:'manager-a',organizationId:project.organizationId,role:'ADMIN'};
 const member={membershipId:'worker-member',actorId:'worker-user-a',clerkUserId:'user_WorkerA',organizationId:project.organizationId,role:'EMPLOYEE'};
 const challenge={version:1,id:'kyc_chat_fixture',status:'PENDING',codeDigest:metaKycChallengeDigest(code),organizationId:project.organizationId,projectId:project.id,workerId:'worker-a',senderE164:'+5491100001111',connectionId:'connection-a',wabaId:'130000011',phoneNumberId:'120000011',issuerActorId:issuer.actorId,issuerMembershipId:issuer.membershipId,participantClerkUserId:active?member.clerkUserId:null,invitationId:'invite_fixture',createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+86400000).toISOString()};
 const worker={id:'worker-a',projectId:project.id,phone:challenge.senderE164,active:true,revision:'r1',metadata:{siteRegister:{version:1},participant:{version:1,status:active?'ACTIVE':'INVITED',clerkUserId:active?member.clerkUserId:null,permissions:{attendance:active,report:active},invitation:{id:challenge.invitationId,state:active?'ACCEPTED':'SENT',expiresAt:new Date(now.getTime()+7*86400000).toISOString()},kycChatChallenge:challenge,kyc:{status:'NOT_SUBMITTED'}}}};
 const connection={id:challenge.connectionId,projectId:project.id,organizationId:project.organizationId,whatsappBusinessId:challenge.wabaId,phoneNumberId:challenge.phoneNumberId,enabled:true,connectionStatus:'CONNECTED',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:project.organizationId,customerActivation:{version:1,state:'ACTIVE',actorId:issuer.actorId},customerSubscribed:true,customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}}};
 connection.encryptedAccessToken=encryptCustomerSecret('synthetic-kyc-channel-token',{organizationId:project.organizationId,projectId:project.id,purpose:'access-token',resourceId:connection.phoneNumberId},environment);
 const audits=new Map(),events=new Map(),outbounds=new Map(),blob=createControlledLifecycleBlob(),controls={issuerActive:true,workerMembershipActive:true,projectAssignmentActive:true,projectActive:true,loseDepositCommit:false,loseDispatchCommit:false,badMedia:false,transientMedia:false,downloads:0,sends:0};let counter=0,revision=1;
 const query=async(sql,args=[])=>{
  const result=rows=>({rows:structuredClone(rows),rowCount:rows.length});
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL')||sql==='ROLLBACK'||sql.startsWith('SELECT pg_advisory'))return result([]);
  if(sql==='COMMIT'){
   if(controls.loseDepositCommit&&[...audits.values()].some(x=>x.action==='participant.operation.recorded')){controls.loseDepositCommit=false;throw new Error('SYNTHETIC_COMMITTED_DEPOSIT_RESPONSE_LOST');}
   if(controls.loseDispatchCommit&&audits.has('meta_kyc_dispatch_'+digest(['meta-kyc-dispatch-v1',current?.eventId]))){controls.loseDispatchCommit=false;throw new Error('SYNTHETIC_COMMITTED_DISPATCH_RESPONSE_LOST');}
   return result([]);
  }
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
  if(sql.startsWith('SELECT w.id')){
   const c=worker.metadata.participant.kycChatChallenge;
   return result(worker.projectId===args[0]&&project.organizationId===args[1]&&worker.phone===args[2]&&c.connectionId===args[3]&&(args.length===5?c.codeDigest===args[4]:['CLAIMED','COMPLETED','CANCELLED'].includes(c.status))?[worker]:[]);
  }
  if(sql.includes('FROM public."PlatformUser"'))return result(args[0]===issuer.actorId?[{id:issuer.actorId,clerkUserId:'user_ManagerA'}]:args[0]===member.clerkUserId?[{id:member.actorId,clerkUserId:member.clerkUserId}]:[]);
  if(sql.includes('FROM public."TenantMembership"'))return result(args[0]===issuer.membershipId||args[0]===issuer.actorId?controls.issuerActive?[issuer]:[]:controls.workerMembershipActive?[member]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return result(controls.projectAssignmentActive?[{id:'project-member'}]:[]);
  if(sql.includes('FROM public."Project"'))return result(controls.projectActive&&args[0]===project.id?[project]:[]);
  if(sql.includes('JOIN public."Project"')&&sql.includes('public."WhatsAppConnection"'))return result(controls.projectActive&&args[0]===connection.id&&args[1]===project.id?[connection]:[]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return result(sql.includes('WHERE "projectId"=$1')?args[0]===project.id?[connection]:[]:args[0]===connection.id&&args[1]===project.id?[connection]:[]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."WebhookEvent"'))return result([events.get(args[0])||outbounds.get(args[0])].filter(Boolean));
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker"'))return result(args[0]===worker.id&&args[1]===worker.projectId?[worker]:[]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."AuditLog"'))return result([audits.get(args[0])].filter(Boolean));
  if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[0],worker.id);worker.metadata=JSON.parse(args[2]);worker.revision='r'+(++revision);return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!audits.has(args[0]));audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],entityId:args[3],entityType:'Worker',action:/'(participant\.[a-z_.]+)'/.exec(sql)[1],metadata:JSON.parse(args[4])});return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO public."WebhookEvent"')){outbounds.set(args[0],{id:args[0],projectId:args[1],payload:JSON.parse(args[3]),outcome:JSON.parse(args[4]),leaseToken:args[5]});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WebhookEvent"')){
   if(sql.includes('180 seconds'))events.get(args[0]).leaseExpiresAt=new Date(now.getTime()+180000);
   else {const row=outbounds.get(args[0]);assert.equal(row.leaseToken,args[2]);row.outcome=JSON.parse(args[3]);row.leaseToken=null;}
   return {rows:[],rowCount:1};
  }
  throw new Error('UNCONTROLLED_UNIT_SQL: '+sql);
 };
 const connect=async()=>({query,release:()=>{}}),uploader=createPrivateImageUploader({get:blob.get,put:blob.put,environment:()=>environment});
 const provider={downloadMedia:async()=>{controls.downloads++;if(controls.transientMedia){controls.transientMedia=false;throw new Error('SYNTHETIC_TRANSIENT_MEDIA');}return {contentType:'image/png',bytes:controls.badMedia?Buffer.from('invalid image'):lifecyclePng};},sendReply:async()=>{controls.sends++;return {messageId:'wamid.SyntheticKycReply_'+controls.sends};}};
 const deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload:uploader.uploadImageToBlob,environment}),bridge=createMetaKycBridge({connect,provider,deposit,environment}),outbound=createMetaKycOutbound({connect,provider,environment});
 let current=null;
 const receive=(message,{sender=challenge.senderE164.slice(1),timestamp,proof=true}={})=>{
  counter++;const eventId='customer_webhook_'+digest(['fixture-event',counter]),value={id:'wamid.SyntheticKycMessage_'+counter,from:sender,timestamp:String(timestamp??Math.floor(now.getTime()/1000)+counter),...(typeof message==='string'?{type:'text',text:{body:message}}:message)},payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value},payloadDigest=metaCustomerContentDigest(payload),aad={organizationId:project.organizationId,projectId:project.id,resourceId:eventId};
  const event={id:eventId,projectId:project.id,status:'PENDING',provider:'meta-customer-v1',leaseToken:randomUUID(),leaseExpiresAt:new Date(now.getTime()+60000),createdAt:new Date(now),payload:{channelId:connection.id,organizationId:project.organizationId,payloadDigest,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},environment),encryptedProof:proof?encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',purpose:'CUSTOMER',appId:environment.NEXT_PUBLIC_META_APP_ID,payloadDigest,organizationId:project.organizationId,channelId:connection.id}),{...aad,purpose:'webhook-proof'},environment):null}};
  events.set(eventId,event);current={eventId,projectId:project.id,channelId:connection.id,payloadDigest,leaseToken:event.leaseToken};return current;
 };
 const state=()=>readMetaKycConversation({project,worker,challenge:worker.metadata.participant.kycChatChallenge},environment);
 const execute=async message=>{const context=receive(message),result=await bridge.execute(context);if(result?.reply)await outbound.send(context,result.reply);return {context,result};};
 const choose=async title=>{const s=state(),index=s.choices.findIndex(row=>row.title===title);assert.ok(index>=0,title);return execute({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':'+index}}});};
 const image=()=>execute({type:'image',image:{id:'150000011',mime_type:'image/png'}});
 const toConfirmation=async()=>{await execute(code);await choose('Autorizar imágenes');await choose('Sin lectura asistida');await choose('Sin comparación facial');await image();await image();};
 return {environment,now,code,project,issuer,member,worker,connection,audits,events,outbounds,blob,controls,query,connect,bridge,outbound,deposit,receive,state,execute,choose,image,toConfirmation};
}
