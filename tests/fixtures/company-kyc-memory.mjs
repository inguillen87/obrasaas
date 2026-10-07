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

// Synthetic SQL/transaction fixture. It exercises the actual signed resolver,
// planner, envelopes, deposit and outbound. It does not emulate PG lock races.
export async function companyKycMemoryFixture({active=false,grantLifetimeMs=null}={}){
 const f=kycMemoryFixture({active}),anchor={...f.project,id:'project-a'},target=f.project;
 target.id='project-b';f.worker.projectId=target.id;
 f.issuer.clerkUserId='user_ManagerA';f.issuer.clerkRole='org:admin';f.issuer.revision='2026-10-06T00:00:00.000000';f.issuer.userRevision=f.issuer.revision;
 f.member.role='AUDITOR';f.member.clerkRole='org:member';f.member.revision=f.issuer.revision;f.member.userRevision=f.issuer.revision;
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
  if(sql.includes('FROM public."PlatformUser"')){
   const user=[f.issuer,f.member].find(p=>p.actorId===args[0]||p.clerkUserId===args[0]);
   return rows(user?[{id:user.actorId,clerkUserId:user.clerkUserId,revision:user.userRevision}]:[]);
  }
  if(sql.includes('FROM public."TenantMembership"')){
   const member=[f.issuer,f.member].find(p=>p.actorId===args[0]&&p.organizationId===args[1]&&(args[2]===undefined||p.membershipId===args[2]));
   return rows(member&&(member===f.issuer?f.controls.issuerActive:f.controls.workerMembershipActive)?[{membershipId:member.membershipId,actorId:member.actorId,organizationId:member.organizationId,role:member.role,clerkRole:member.clerkRole,revision:member.revision}]:[]);
  }
  if(sql.includes('FROM public."ProjectMembership"'))return rows(f.controls.projectAssignmentActive?[{id:'pm-b',revision:f.issuer.revision}]:[]);
  if(sql.startsWith('SELECT w.id,w.metadata')){assert.deepEqual(args,[target.organizationId,f.worker.phone,f.connection.id]);return rows(control.competingChallenges);}
  if(sql.startsWith('SELECT w.id')){const c=f.worker.metadata.participant.kycChatChallenge;return rows(control.assignment&&f.worker.active&&args[0]===f.connection.id&&args[1]===target.organizationId&&args[2]===f.worker.phone&&c&&(args.length===5?args[3]===f.worker.id&&args[4]===target.id:args[3]===c.codeDigest)?[f.worker]:[]);}
  if(sql.includes('FROM public."Project"'))return rows(f.controls.projectActive?[anchor,target].filter(p=>p.id===args[0]&&p.organizationId===args[1]):[]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return rows(args[0]===f.connection.id&&args[1]===anchor.id?[f.connection]:[]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."AuditLog"')){
   if(sql.startsWith('SELECT id FROM'))return rows(control.trail.map(id=>({id})));
   if(sql.includes("metadata->>'kind'='INVITATION_SENT'"))return rows([...f.audits.values()].filter(a=>a.metadata.kind==='INVITATION_SENT'&&a.entityId===args[1]&&a.metadata.invitationId===args[2]));
   return rows([f.audits.get(args[0])].filter(Boolean));
  }
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."WebhookEvent"')){
   const selection=sql.slice(7,sql.indexOf(' FROM ')).trim(),selected=selection==='*'?null:selection.split(',').map(column=>column.match(/ AS ([A-Za-z][A-Za-z0-9]*)$/)?.[1]||column.replaceAll('"',''));
   const values=sql.includes("outcome->>'messageId'")?[...f.outbounds.values()].filter(e=>e.projectId===args[0]&&e.payload.channelId===args[1]&&e.outcome.messageId===args[2]):[f.events.get(args[0])||f.outbounds.get(args[0])].filter(Boolean);
   return rows(values.map(event=>selected?Object.fromEntries(selected.map(field=>[field,field==='now'?new Date(f.now):event[field]])):event));
  }
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker"')&&sql.includes('kycChatChallenge'))return rows([f.worker]);
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
  return query(sql,args);
 }};};
 let code=null,counter=0,lastReplyId=null;
 const prepareClient={query};
 await prepareMetaKycChallenge.beforeProject(prepareClient,f.issuer,{projectId:target.id});
 code=(await prepareMetaKycChallenge(prepareClient,f.issuer,target,{workerId:f.worker.id,revision:f.worker.revision,operationId:randomUUID()})).code;
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
 const toConfirmation=async()=>{await execute(code);await choose('Autorizar imágenes');await choose('Sin lectura asistida');await choose('Sin comparación facial');await image();await image();};
 return {...f,anchor,target,owner,code,control,query,connect,provider,upload,deposit,bridge,outbound,receive,state,execute,choose,image,toConfirmation};
}
