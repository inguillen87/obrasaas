import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {kycMemoryFixture} from './meta-kyc-chat-memory.mjs';
import {digest} from '../../src/lib/workspace-policy.mjs';
import {metaCustomerContentDigest} from '../../src/lib/meta-customer-callback.mjs';
import {encryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../../src/lib/company-channel-schema.mjs';
import {prepareMetaKycChallenge} from '../../src/lib/meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,readMetaKycConversation} from '../../src/lib/meta-kyc-identity.mjs';
import {createMetaKycBridge} from '../../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../../src/lib/meta-kyc-outbound.mjs';
import {createParticipantChannelKycDeposit,createParticipantChannelKycUploader} from '../../src/lib/participant-channel-kyc.mjs';
import {lifecyclePng} from '../../scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {createParticipantStore} from '../../src/lib/participant-store.mjs';
import {participantReceiptId} from '../../src/lib/participant-policy.mjs';

// Synthetic SQL/transaction fixture. It exercises the actual signed resolver,
// planner, envelopes, deposit and outbound. It does not emulate PG lock races.
export async function companyKycMemoryFixture({active=false,grantLifetimeMs=null,captureImageSetVersion}={}){
 const f=kycMemoryFixture({active}),anchor={...f.project,id:'project-a'},target=f.project;
 target.id='project-b';f.worker.projectId=target.id;
 f.issuer.clerkUserId='user_ManagerA';f.issuer.clerkRole='org:admin';f.issuer.revision='2026-10-06T00:00:00.000000';f.issuer.userRevision=f.issuer.revision;
 f.member.role='AUDITOR';f.member.clerkRole='org:member';f.member.revision=f.issuer.revision;f.member.userRevision=f.issuer.revision;
 const invitationId='invite_'+'a'.repeat(32),email='synthetic-acceptance@example.invalid',clerkOrganizationId='org_Synthetic';
 f.worker.metadata.participant.invitation.id=invitationId;f.worker.metadata.participant.invitation.email=email;
 f.worker.metadata.participant.invitation.providerId='orginv_Synthetic';
 f.audits.set('invite_receipt',{id:'invite_receipt',entityType:'Worker',entityId:f.worker.id,organizationId:target.organizationId,actorId:f.issuer.actorId,action:'participant.operation.recorded',metadata:{projectId:target.id,kind:'INVITATION_SENT',invitationId:f.worker.metadata.participant.invitation.id,providerId:'orginv_Synthetic'}});
 delete f.worker.metadata.participant.kycChatChallenge;
 if(grantLifetimeMs!==null)f.connection.metadata.customerVerification.expiresAt=new Date(f.now.getTime()+grantLifetimeMs).toISOString();
 f.connection.projectId=anchor.id;f.connection.metadata.companyRoutingVersion=1;
 const owner={connectionId:f.connection.id,anchorProjectId:anchor.id,mode:'COMPANY',revision:2,assignmentRevision:3};
 const control={schema:true,assignment:true,owner:true,promptState:'SENT',graph:0,cdn:0,hook:null,trail:[],sql:[],rollbacks:0,competingChallenges:[]};
 const rows=value=>({rows:structuredClone(value),rowCount:value.length});
 const catalogFingerprint=digest({columns:[],keys:[],indexes:[],triggers:[]});
 const query=async(sql,args=[])=>{
  control.sql.push(sql);if(control.hook)await control.hook(sql,args);
  if(sql.includes('to_regclass'))return rows([{present:control.schema}]);
  if(sql.includes('information_schema.columns'))return sql.includes("column_name='catalogFingerprint'")?rows([{count:1}]):rows([]);
  if(sql.includes('FROM public."WhatsAppCompanySchema"'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint}]);
  if(sql.startsWith('SELECT conname,convalidated'))return rows(args[0].map(conname=>({conname,convalidated:true})));
  if(sql.includes('pg_get_indexdef'))return rows([]);
  if(sql.startsWith('SELECT c.relname,i.indisvalid'))return rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  if(sql.startsWith('SELECT tgname'))return rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  if(sql.includes('FROM pg_constraint')||sql.includes('FROM pg_index')||sql.includes('FROM pg_trigger'))return rows([]);
  if(sql.includes('FROM public."WhatsAppCompanyChannel"')){
   if(!control.owner||!control.assignment)return rows([]);
   if(sql.includes('cc.revision=$3')&&(args[2]!==owner.revision||args[4]!==owner.assignmentRevision||args[5]!==owner.mode))return rows([]);
   return rows([owner]);
  }
  if(sql.includes('FROM public."WhatsAppCompanyEventRoute"'))return rows([]);
  if(sql.includes('FROM public."Organization"'))return rows([{id:target.organizationId,metadata:{}}]);
  if(sql.startsWith('SELECT w.id,w.name,w.active')&&sql.includes("invitation'->>'id'")){const result={...f.worker,name:'Synthetic invited person',organizationId:target.organizationId,projectName:'Synthetic B',organizationName:'Synthetic company',clerkOrganizationId};delete result.phone;return rows(f.controls.projectActive&&args[0]===clerkOrganizationId&&args[1]===invitationId?[result]:[]);}
  if(sql.includes('FROM public."PlatformUser"')){
   if(sql.includes('lower("primaryEmail")'))return rows([{id:f.member.actorId,clerkUserId:f.member.clerkUserId}]);
   const user=[f.issuer,f.member].find(p=>p.actorId===args[0]||p.clerkUserId===args[0]);
   return rows(user?[{id:user.actorId,clerkUserId:user.clerkUserId,revision:user.userRevision}]:[]);
  }
  if(sql.includes('FROM public."TenantMembership"')){
   if(sql.includes('JOIN public."PlatformUser"'))return rows(f.controls.workerMembershipActive&&f.controls.projectAssignmentActive?[{id:f.member.membershipId,membershipId:f.member.membershipId,actorId:f.member.actorId}]:[]);
   if(sql.includes('WHERE "organizationId"=$1'))return rows(args[0]===target.organizationId&&args[1]===f.member.actorId?[{id:f.member.membershipId,status:f.controls.workerMembershipActive?'ACTIVE':'DISABLED',role:f.member.role}]:[]);
   if(sql.startsWith('SELECT id FROM'))return rows(args[0]===f.member.actorId&&args[1]===target.organizationId&&f.controls.workerMembershipActive?[{id:f.member.membershipId}]:[]);
   const member=[f.issuer,f.member].find(p=>p.actorId===args[0]&&p.organizationId===args[1]&&(args[2]===undefined||p.membershipId===args[2]));
   return rows(member&&(member===f.issuer?f.controls.issuerActive:f.controls.workerMembershipActive)?[{membershipId:member.membershipId,actorId:member.actorId,organizationId:member.organizationId,role:member.role,clerkRole:member.clerkRole,revision:member.revision}]:[]);
  }
  if(sql.includes('FROM public."ProjectMembership"'))return rows(sql.startsWith('SELECT id,status')?[{id:'pm-b',status:f.controls.projectAssignmentActive?'ACTIVE':'DISABLED',revision:f.issuer.revision}]:f.controls.projectAssignmentActive?[{id:'pm-b',status:'ACTIVE',revision:f.issuer.revision}]:[]);
  if(sql.startsWith('SELECT w.id,w.metadata')){assert.deepEqual(args,[target.organizationId,f.worker.phone,f.connection.id]);return rows(control.competingChallenges);}
  if(sql.startsWith('SELECT w.id')){const c=f.worker.metadata.participant.kycChatChallenge;return rows(control.assignment&&f.worker.active&&args[0]===f.connection.id&&args[1]===target.organizationId&&args[2]===f.worker.phone&&c&&(args.length===5?args[3]===f.worker.id&&args[4]===target.id:args[3]===c.codeDigest)?[f.worker]:[]);}
  if(sql.includes('FROM public."Project"'))return rows(f.controls.projectActive?[anchor,target].filter(p=>p.id===args[0]&&p.organizationId===args[1]):[]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return rows(args[0]===f.connection.id&&args[1]===anchor.id?[f.connection]:[]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."AuditLog"')){
   const all=[...f.audits.values()];
   if(sql.endsWith('LIMIT 1'))return rows(all.filter(a=>a.organizationId===args[0]&&a.entityId===args[1]&&((['participant.kyc_chat.projected','participant.kyc_chat.dispatched'].includes(a.action)&&a.metadata.challengeId===args[2])||(a.metadata.kind==='KYC_SUBMITTED'&&a.metadata.channelCapture?.challengeId===args[2]))).slice(0,1));
   if(sql.startsWith('SELECT id FROM'))return rows([...new Set([...all.filter(a=>a.organizationId===args[0]&&a.action==='participant.operation.recorded'&&a.entityId===args[1]&&['REVOKE','RESTORE_ACCESS','EXISTING_ACCOUNT_ASSIGNED','INVITATION_ACCEPTED','INVITATION_SENT'].includes(a.metadata.kind)).map(a=>a.id),...control.trail])].sort().map(id=>({id})));
   if(sql.includes("metadata->>'kind'='INVITATION_SENT'"))return rows([...f.audits.values()].filter(a=>a.metadata.kind==='INVITATION_SENT'&&a.entityId===args[1]&&a.metadata.invitationId===args[2]));
   if(sql.includes("action='participant.kyc_chat.prepared'")&&sql.includes("metadata->>'challengeId'=$4"))return rows(all.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityId===args[2]&&a.action==='participant.kyc_chat.prepared'&&a.metadata.challengeId===args[3]));
   if(sql.includes("metadata->>'challengeReceiptId'=$4"))return rows(all.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityId===args[2]&&a.metadata.kind==='PREPARE_KYC_CHAT'&&a.metadata.challengeReceiptId===args[3]));
   return rows([f.audits.get(args[0])].filter(Boolean));
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')&&args.length===6){assert.ok(!f.audits.has(args[0]));f.audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],action:'participant.operation.recorded',entityType:args[3],entityId:args[4],metadata:JSON.parse(args[5])});return rows([]);}
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."WebhookEvent"')){
   const selection=sql.slice(7,sql.indexOf(' FROM ')).trim(),selected=selection==='*'?null:selection.split(',').map(column=>column.match(/ AS ([A-Za-z][A-Za-z0-9]*)$/)?.[1]||column.replaceAll('"',''));
   const values=sql.includes("outcome->>'messageId'")?[...f.outbounds.values()].filter(e=>e.projectId===args[0]&&e.payload.channelId===args[1]&&e.outcome.messageId===args[2]):[f.events.get(args[0])||f.outbounds.get(args[0])].filter(Boolean);
   return rows(values.map(event=>selected?Object.fromEntries(selected.map(field=>[field,field==='now'?new Date(f.now):event[field]])):event));
  }
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker"')&&sql.includes('kycChatChallenge'))return rows([f.worker]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker"')&&sql.includes('id<>$2'))return rows([]);
  if(sql.startsWith('SELECT id,')&&sql.includes('FROM public."Worker" WHERE id=$1')&&sql.includes(' AS revision')){
   const result=await f.query(sql,args),selected=sql.slice(0,sql.indexOf(' FROM ')),fields=['id','phone','active','metadata','revision'];
   if(selected.includes('"projectId"'))fields.splice(1,0,'projectId');
   return rows(result.rows.map(worker=>Object.fromEntries(fields.map(field=>[field,worker[field]]))));
  }
  return f.query(sql,args);
 };
 const connect=async()=>{let snapshot=null;return {release:()=>{},query:async(sql,args)=>{
  if(sql==='BEGIN'||sql.startsWith('BEGIN ISOLATION'))snapshot=structuredClone({worker:f.worker,audits:[...f.audits],events:[...f.events],outbounds:[...f.outbounds]});
  if(sql==='ROLLBACK'&&snapshot){control.rollbacks++;Object.assign(f.worker,snapshot.worker);for(const [map,key] of [[f.audits,'audits'],[f.events,'events'],[f.outbounds,'outbounds']]){map.clear();for(const [id,value]of snapshot[key])map.set(id,value);}}
  const value=await query(sql,args);if(sql==='COMMIT'){snapshot=null;if(control.loseDepositCommit&&[...f.audits.values()].some(a=>a.metadata.kind==='KYC_SUBMITTED')){control.loseDepositCommit=false;throw new Error('SYNTHETIC_DEPOSIT_COMMITTED_ACK_LOST');}if(control.loseJoinCommit&&[...f.audits.values()].some(a=>a.action==='participant.kyc_chat.account_bound')){control.loseJoinCommit=false;throw new Error('SYNTHETIC_ACCEPTANCE_COMMITTED_ACK_LOST');}}return value;
 }};};
 let code=null,counter=0,lastReplyId=null;
 const prepareClient={query};
 await prepareMetaKycChallenge.beforeProject(prepareClient,f.issuer,{projectId:target.id});
 const prepareOperationId=randomUUID(),prepared=await prepareMetaKycChallenge(prepareClient,f.issuer,target,{workerId:f.worker.id,revision:f.worker.revision,operationId:prepareOperationId});code=prepared.code;
 // Default fixture represents an already-issued legacy capture. New issuance is tested with explicit schema2.
 if(captureImageSetVersion!==2){delete f.worker.metadata.participant.kycChatChallenge.captureImageSetVersion;delete f.audits.get(prepared.receiptId).metadata.captureImageSetVersion;}
 const exteriorId=participantReceiptId(f.issuer.actorId,target.id,prepareOperationId);
 f.audits.set(exteriorId,{id:exteriorId,organizationId:target.organizationId,actorId:f.issuer.actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:f.worker.id,metadata:{version:1,projectId:target.id,kind:'PREPARE_KYC_CHAT',requestDigest:digest(['fixture-PREPARE_KYC_CHAT',prepareOperationId,target.id,f.worker.id]),challengeReceiptId:prepared.receiptId,expiresAt:prepared.expiresAt}});
 const provider={downloadMedia:async({beforeExternal})=>{await beforeExternal();control.graph++;if(control.afterGraph)await control.afterGraph();await beforeExternal();control.cdn++;return {contentType:'image/png',bytes:lifecyclePng};},sendReply:async()=>{f.controls.sends++;if(control.afterSend)await control.afterSend();return {messageId:'wamid.CorporateKycReply_'+f.controls.sends};}};
 const upload=createParticipantChannelKycUploader({put:f.blob.put,get:f.blob.get,environment:()=>f.environment});
 const deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload,environment:f.environment});
 const bridge=createMetaKycBridge({connect,provider,deposit,environment:f.environment}),outbound=createMetaKycOutbound({connect,provider,environment:f.environment});
 const receive=(message,{sender=f.worker.phone.slice(1),contextId=lastReplyId,company=true}={})=>{
  counter++;const id='customer_webhook_'+digest(['company-kyc-fixture',counter]),value={id:'wamid.CorporateKycMessage_'+counter,from:sender,timestamp:String(Math.floor(f.now.getTime()/1000)+counter),...(typeof message==='string'?{type:'text',text:{body:message}}:message),...(contextId?{context:{id:contextId}}:{})};
  const payload={wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId,field:'messages',type:'message',value},payloadDigest=metaCustomerContentDigest(payload),marker={mode:'COMPANY',revision:2,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT},aad={organizationId:target.organizationId,projectId:anchor.id,resourceId:id};
  const event={id,projectId:anchor.id,eventType:'message',externalId:digest([payload.wabaId,payload.phoneNumberId,'message',value.id]),status:'PENDING',provider:'meta-customer-v1',leaseToken:randomUUID(),leaseExpiresAt:new Date(f.now.getTime()+60000),createdAt:new Date(f.now),payload:{version:1,channelId:f.connection.id,organizationId:target.organizationId,payloadDigest,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',...(company?{companyRouting:marker}:{}),encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},f.environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',purpose:'CUSTOMER',appId:f.environment.NEXT_PUBLIC_META_APP_ID,payloadDigest,organizationId:target.organizationId,channelId:f.connection.id,...(company?{companyRouting:marker}:{})}),{...aad,purpose:'webhook-proof'},f.environment)}};
  f.events.set(id,event);return {eventId:id,projectId:anchor.id,channelId:f.connection.id,payloadDigest,leaseToken:event.leaseToken};
 };
 const state=()=>readMetaKycConversation({project:target,worker:f.worker,challenge:f.worker.metadata.participant.kycChatChallenge,companyKyc:[...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected').at(-1)?.metadata},f.environment);
 const execute=async(message,options)=>{const context=receive(message,options),result=await bridge.execute(context);if(result?.reply){await outbound.send(context,result.reply);lastReplyId=[...f.outbounds.values()].at(-1)?.outcome.messageId;}return {context,result};};
 const choose=async title=>{const s=state(),index=s.choices.findIndex(row=>row.title===title);assert.ok(index>=0,title);return execute({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':'+index}}});};
 const image=()=>execute({type:'image',image:{id:'150000011',mime_type:'image/png'}});
 const toConfirmation=async()=>{await execute(code);await choose('Autorizar imágenes');if(captureImageSetVersion===2)await choose('Autorizar dorso');await choose('Sin lectura asistida');await choose('Sin comparación facial');await image();await image();if(captureImageSetVersion===2)await image();};
 const identityCalls={verifiedEmail:0,findInvitation:0,verifyMembership:0},session={authenticated:true,verification:'clerk-production-jwt',userId:f.member.clerkUserId,organizationId:clerkOrganizationId,organizationRole:'org:member'},identity={
  verifiedEmail:async userId=>{identityCalls.verifiedEmail++;assert.equal(userId,session.userId);return email;},
  findInvitation:async value=>{identityCalls.findInvitation++;assert.deepEqual(value,{organizationId:clerkOrganizationId,invitationId});return {id:'orginv_Synthetic',email,role:'org:member',state:'accepted',expiresAt:f.worker.metadata.participant.invitation.expiresAt,invitationId};},
  verifyMembership:async value=>{identityCalls.verifyMembership++;assert.deepEqual(value,{userId:session.userId,organizationId:clerkOrganizationId,invitationId});return {role:'org:member'};}
 };
 const participant=createParticipantStore({workspace:{},connect,identity,environment:f.environment}),join=(operationId=randomUUID())=>participant.join(session,{invitationId,operationId},{accept:true});
 return {...f,anchor,target,owner,code,control,query,connect,provider,upload,deposit,bridge,outbound,receive,state,execute,choose,image,toConfirmation,participant,join,session,identityCalls};
}
