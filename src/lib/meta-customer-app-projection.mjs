import {WorkspaceError,digest} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {lockMetaCustomerInboxChannel,metaCustomerContentDigest} from './meta-customer-callback.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';
import {metaCustomerTransportReady} from './meta-customer-provider.mjs';
import {hasMetaCustomerRequiredScopes} from './meta-customer-permissions.mjs';
import {readProjectWorkspaceProfile} from './whatsapp/project-workspace-profile.js';
import {customerLifecycleRecovery} from './meta-customer-coexistence.mjs';

export const META_APP_PROJECTION_PROVIDER='meta-customer-app-source-v1';
export const META_APP_PROJECTION_PURPOSE='business-app-source';
const fields=new Set(['history','smb_app_state_sync','smb_message_echoes','account_update']);
const phone=value=>typeof value==='string'&&/^[1-9]\d{7,14}$/.test(value);
const messageId=value=>typeof value==='string'&&/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(value);
const timestamp=value=>typeof value==='string'&&/^\d{1,14}$/.test(value);
const reject=()=>{throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_INVALID',422);};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

// Partition only after the raw Meta HMAC is verified by the ingress. Every
// fragment retains its immutable source chunk digest and bounded checkpoint.
export function splitCustomerAppChange(field,value){
 if(!fields.has(field))return null;
 if(field==='account_update')return [{value}];
 if(field==='smb_app_state_sync'){
  if(!Array.isArray(value.state_sync)||!value.state_sync.length||value.state_sync.length>10000)reject();
  const parts=[];for(let i=0;i<value.state_sync.length;i+=25)parts.push({value:{state_sync:value.state_sync.slice(i,i+25)}});return parts;
 }
 if(field==='smb_message_echoes'){
  if(!Array.isArray(value.message_echoes)||!value.message_echoes.length||value.message_echoes.length>200)reject();
  return value.message_echoes.map(item=>({value:{message_echoes:[item]}}));
 }
 if(Array.isArray(value.messages))return value.messages.map(item=>({value:{messages:[item]}}));
 if(!Array.isArray(value.history)||!value.history.length||value.history.length>3)reject();
 return value.history.flatMap(chunk=>{
  if(Array.isArray(chunk.errors))return [{value:{history:[chunk]}}];
  const m=chunk.metadata;
  if(!object(m)||![0,1,2].includes(m.phase)||!Number.isInteger(m.chunk_order)||m.chunk_order<0||m.chunk_order>100000||!Number.isInteger(m.progress)||m.progress<0||m.progress>100||!Array.isArray(chunk.threads)||chunk.threads.length>10000)reject();
  const messages=chunk.threads.flatMap(thread=>{
   if(!phone(thread.id)||!Array.isArray(thread.messages)||thread.messages.length>10000)reject();
   return thread.messages.map(message=>({threadId:thread.id,message}));
  });
  if(messages.length>10000)reject();
  const fragments=[];
  for(let i=0;i<messages.length;i+=25){const rows=messages.slice(i,i+25);fragments.push({history:[{metadata:m,threads:rows.map(row=>({id:row.threadId,messages:[row.message]}))}]});}
  if(!fragments.length)fragments.push({history:[{metadata:m,threads:[]}]});
  const chunkDigest=metaCustomerContentDigest(chunk);
  return fragments.map((part,index)=>({value:part,checkpoint:{chunkDigest,phase:m.phase,chunkOrder:m.chunk_order,progress:m.progress,part:index,total:fragments.length}}));
 });
}
export function customerAppRecords(payload){
 const v=payload.value;
 if(!fields.has(payload.field)||!object(v))return null;
 if(payload.field==='account_update')return {records:[],lifecycle:typeof v.event==='string'&&/^[A-Za-z_]{1,80}$/.test(v.event)?v.event.toLowerCase():null,disconnectionReason:typeof v.disconnection_info?.reason==='string'&&/^[A-Z_]{1,80}$/.test(v.disconnection_info.reason)?v.disconnection_info.reason:null,disconnectionInitiatedBy:['USER','SYSTEM'].includes(v.disconnection_info?.initiated_by)?v.disconnection_info.initiated_by:null};
 const records=[];
 if(payload.field==='smb_app_state_sync'){
  for(const row of v.state_sync||[]){
   if(row.type!=='contact'||!['add','remove'].includes(row.action)||!phone(row.contact?.phone_number)||!timestamp(row.metadata?.timestamp)||['full_name','first_name'].some(key=>row.contact[key]!==undefined&&(typeof row.contact[key]!=='string'||row.contact[key].length>300)))reject();
   records.push({kind:'contact',key:digest([row.contact.phone_number,row.metadata.timestamp,row.action]),timestamp:row.metadata.timestamp,data:row});
  }
 }else{
  const history=v.history||[],declined=history.some(row=>row.errors?.some(error=>error.code===2593109));
  if(declined)return {records:[],declined:true};
  const messages=payload.field==='smb_message_echoes'?v.message_echoes||[]:v.messages||history.flatMap(chunk=>(chunk.threads||[]).flatMap(thread=>(thread.messages||[]).map(message=>({...message,sourceThreadId:thread.id}))));
  for(const message of messages){
   if(!messageId(message.id)||!phone(message.from)||!timestamp(message.timestamp)||typeof message.type!=='string'||message.type.length>50||message.to!==undefined&&!phone(message.to))reject();
   records.push({kind:'message',key:digest([message.id,message.type]),timestamp:message.timestamp,data:message});
  }
 }
 return {records,checkpoint:payload.checkpoint||null};
}
export async function decodeCustomerAppProjection(client,row,member,project,connection,environment){
 if(row.provider!==META_APP_PROJECTION_PROVIDER||row.payload?.channelId!==connection.id||row.payload.organizationId!==member.organizationId)throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_PROOF_REQUIRED',409);
 const context={organizationId:member.organizationId,projectId:project.id,purpose:META_APP_PROJECTION_PURPOSE,resourceId:row.id};
 let value;try{value=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,context,environment));}catch{throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_PROOF_REQUIRED',409);}
 const source=(await client.query(`SELECT id,"projectId",provider,payload FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,[row.payload.sourceEventId,project.id])).rows[0];
 if(!source||source.payload?.payloadDigest!==row.payload.sourcePayloadDigest||value.sourceEventId!==source.id||value.sourcePayloadDigest!==source.payload.payloadDigest||metaCustomerContentDigest(value)!==row.payload.payloadDigest)throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_PROOF_REQUIRED',409);
 const original=decodeSignedCustomerEvent(source,{...connection,organizationId:member.organizationId,projectId:project.id},environment);
 if(!customerAppRecords(original)?.records.some(record=>metaCustomerContentDigest(record)===metaCustomerContentDigest(value.record)))throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_PROOF_REQUIRED',409);
 return value;
}
const lifecycleOutcome=(code=null,reviewState='OBSERVED')=>({kind:'CUSTOMER_ACCOUNT_LIFECYCLE',reviewState,businessApplied:false,replySent:false,identityStatus:'NOT_APPLICABLE',...(code?{code}:{})});
const reconnectTerminal=new Set(['RESTORED','KEPT_DISABLED','MANUAL_REVIEW_REQUIRED']);
export function createMetaCustomerAppProjection({connect,provider,environment=process.env,now=()=>Date.now()}){
 const locked=(context,run)=>customerJobTransaction(connect,async client=>{
  const candidate=(await client.query(`SELECT "whatsappBusinessId","phoneNumberId" FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2`,[context.channelId,context.projectId])).rows[0];
  if(!candidate)throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);
  const c=await lockMetaCustomerInboxChannel(client,{wabaId:candidate.whatsappBusinessId,phoneNumberId:candidate.phoneNumberId,projectId:context.projectId,writable:true});
  const event=(await client.query(`SELECT id,"projectId",provider,payload,status::text AS status,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' FOR UPDATE`,[context.eventId,context.projectId])).rows[0];
  if(!event||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||Date.parse(event.leaseExpiresAt)<=now()||event.payload.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  const payload=decodeSignedCustomerEvent(event,c,environment);return run(client,c,event,payload);
 });
 const save=async(client,c,metadata,enabled=c.enabled)=>{const result=await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$3::jsonb,enabled=$4,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[c.id,c.projectId,JSON.stringify(metadata),enabled]);if(result.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_RECONNECTION_CHANGED',409);};
 const profile=async(client,c)=>{const p=(await client.query(`SELECT p.id,p.metadata,o.metadata AS "organizationMetadata" FROM public."Project" p JOIN public."Organization" o ON o.id=p."organizationId" WHERE p.id=$1 AND p."organizationId"=$2 AND p.status='ACTIVE'`,[c.projectId,c.organizationId])).rows[0];return p?readProjectWorkspaceProfile(p.metadata,p.organizationMetadata,p.id).profile:null;};
 return {async execute(context){const claimed=await locked(context,async(client,c,event,payload)=>{
  const parsed=customerAppRecords(payload);
  if(!parsed)return null;
  if(parsed.lifecycle){
   const prior=c.metadata.customerLifecycle,s=c.metadata.coexistence,previousRecovery=customerLifecycleRecovery(c);
   // Signed entry.time distinguishes repeated device-change cycles. Older
   // callbacks cannot undo a later lifecycle already observed on this channel.
   if(payload.providerTimestamp&&prior?.providerTimestamp&&Number(payload.providerTimestamp)<Number(prior.providerTimestamp))return lifecycleOutcome('META_CUSTOMER_LIFECYCLE_STALE');
   if(payload.providerTimestamp&&prior?.providerTimestamp&&payload.providerTimestamp===prior.providerTimestamp&&prior.sourceEventId!==event.id){
    const recovery={...previousRecovery,version:1,state:'MANUAL_REVIEW_REQUIRED',automatic:false,authorizationSignupId:c.metadata.customerSignupId||null,previouslyEnabled:previousRecovery?.previouslyEnabled??c.enabled===true,pausedAt:previousRecovery?.pausedAt||new Date(now()).toISOString(),reason:parsed.disconnectionReason||previousRecovery?.reason||null,initiatedBy:parsed.disconnectionInitiatedBy||previousRecovery?.initiatedBy||null,lastCode:'META_CUSTOMER_LIFECYCLE_ORDER_UNCONFIRMED'};
    await save(client,c,{customerLifecycle:{...prior,authorizationSignupId:c.metadata.customerSignupId||null,recovery}},false);
    return lifecycleOutcome('META_CUSTOMER_LIFECYCLE_ORDER_UNCONFIRMED','REVIEW_REQUIRED');
   }
   const lifecycle=prior?.sourceEventId===event.id?prior:{event:parsed.lifecycle,sourceEventId:event.id,observedAt:new Date(now()).toISOString(),providerTimestamp:payload.providerTimestamp||null,authorizationSignupId:c.metadata.customerSignupId||null,reason:parsed.disconnectionReason,initiatedBy:parsed.disconnectionInitiatedBy,...(previousRecovery?{recovery:previousRecovery}:{})};
   const disconnected=['partner_removed','account_disconnected','account_offboarded'].includes(parsed.lifecycle);
   if(disconnected){
    let recovery=previousRecovery;
     const pending=recovery&&!['RESTORED','KEPT_DISABLED'].includes(recovery.state)&&recovery.authorizationSignupId===c.metadata.customerSignupId;
     const automatic=Boolean(s)&&parsed.lifecycle==='account_offboarded'&&(!pending||recovery.automatic!==false)&&Boolean(payload.providerTimestamp);
     recovery={...(pending?recovery:{version:1,previouslyEnabled:c.enabled===true,activationDigest:digest(c.metadata.customerActivation||null),authorizationSignupId:c.metadata.customerSignupId||null,pausedAt:lifecycle.observedAt,pauseEventId:event.id,pauseTimestamp:payload.providerTimestamp||null}),state:automatic?'PAUSED':'MANUAL_REVIEW_REQUIRED',automatic,reason:lifecycle.reason||recovery?.reason||null,initiatedBy:lifecycle.initiatedBy||recovery?.initiatedBy||null,lastCode:parsed.lifecycle==='account_offboarded'&&!payload.providerTimestamp?'META_CUSTOMER_LIFECYCLE_ORDER_UNCONFIRMED':null};
    await save(client,c,{customerLifecycle:{...lifecycle,recovery}},false);
    return lifecycleOutcome();
   }
   if(parsed.lifecycle!=='account_reconnected'||!s){await save(client,c,{customerLifecycle:lifecycle});return lifecycleOutcome(previousRecovery&&!['RESTORED','KEPT_DISABLED'].includes(previousRecovery.state)?'META_CUSTOMER_RECONNECTION_PAUSE_REQUIRED':null,previousRecovery&&!['RESTORED','KEPT_DISABLED'].includes(previousRecovery.state)?'REVIEW_REQUIRED':'OBSERVED');}
   const recovery=previousRecovery;
   if(recovery?.reconnectEventId===event.id&&reconnectTerminal.has(recovery.state))return lifecycleOutcome(recovery.lastCode,recovery.state==='MANUAL_REVIEW_REQUIRED'?'REVIEW_REQUIRED':'OBSERVED');
   if(recovery&&['RESTORED','KEPT_DISABLED'].includes(recovery.state)){
    await save(client,c,{customerLifecycle:lifecycle});
    return lifecycleOutcome('META_CUSTOMER_RECONNECTION_ALREADY_RECOVERED');
   }
   // Reconnection is not permission to accept a newly linked tenant or reverse
   // partner removal. Only this channel's preceding offboard pause can recover.
   if(recovery?.automatic!==true||!recovery.pauseEventId||!recovery.pauseTimestamp||!payload.providerTimestamp||Number(payload.providerTimestamp)<=Number(recovery.pauseTimestamp)){
    await save(client,c,{customerLifecycle:{...lifecycle,recovery:{...recovery,version:1,state:'MANUAL_REVIEW_REQUIRED',automatic:false,authorizationSignupId:c.metadata.customerSignupId||null,reconnectEventId:event.id,reconnectedAt:lifecycle.observedAt,lastCode:'META_CUSTOMER_RECONNECTION_PAUSE_REQUIRED'}}},false);
    return lifecycleOutcome('META_CUSTOMER_RECONNECTION_PAUSE_REQUIRED','REVIEW_REQUIRED');
   }
   const prepared=await profile(client,c),ready=provider&&metaCustomerTransportReady(provider.readiness());
   if(!ready||!prepared?.configured||prepared.numberMode!=='BUSINESS_APP'||s.verified!==true||!Number.isFinite(Date.parse(s.verifiedAt))){
    await save(client,c,{customerLifecycle:{...lifecycle,recovery:{...recovery,state:'REVIEW_REQUIRED',reconnectEventId:event.id,reconnectedAt:lifecycle.observedAt,leaseToken:context.leaseToken,lastCode:'META_CUSTOMER_RECONNECTION_PREPARATION_REQUIRED'}}});
    return {reconnect:true,preparationError:true};
   }
   const token=decryptCustomerSecret(c.encryptedAccessToken,{organizationId:c.organizationId,projectId:c.projectId,purpose:'access-token',resourceId:c.phoneNumberId},environment);
   const verifying={...recovery,state:'VERIFYING',reconnectEventId:event.id,reconnectedAt:lifecycle.observedAt,leaseToken:context.leaseToken,lastCode:null};
   await save(client,c,{customerLifecycle:{...lifecycle,recovery:verifying}});
   return {reconnect:true,channel:c,token,profileDigest:digest(prepared),recoveryDigest:metaCustomerContentDigest(verifying),grantDigest:digest([s.verified,s.verifiedAt,c.metadata.customerSignupId])};
  }
  let s=c.metadata.coexistence;
  if(!s?.verified)return {kind:'COEXISTENCE_SOURCE_REVIEW',reviewState:'REVIEW_REQUIRED',businessApplied:false,replySent:false};
  if(['history','smb_app_state_sync'].includes(payload.field)&&s.importConsent?.[payload.field==='history'?'history':'contacts']!==true)return {kind:'COEXISTENCE_NOT_SELECTED',reviewState:'OBSERVED',businessApplied:false,replySent:false};
  let inserted=0;
  for(const record of parsed.records){
   const externalId=digest([c.id,record.kind,record.key,payload.field]),id='meta_app_source_'+externalId;
   const data={version:1,source:'WHATSAPP_BUSINESS_APP',field:payload.field,record,sourceEventId:event.id,sourcePayloadDigest:event.payload.payloadDigest};
   const payloadDigest=metaCustomerContentDigest(data),encryptedPayload=encryptCustomerSecret(JSON.stringify(data),{organizationId:c.organizationId,projectId:c.projectId,purpose:META_APP_PROJECTION_PURPOSE,resourceId:id},environment);
   const stored={version:1,channelId:c.id,organizationId:c.organizationId,sourceEventId:event.id,sourcePayloadDigest:event.payload.payloadDigest,payloadDigest,encryptedPayload};
   const result=await client.query(`INSERT INTO public."WebhookEvent" (id,"projectId",provider,"externalId","eventType",status,payload,outcome,"processedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,'PROCESSED',$6::jsonb,$7::jsonb,clock_timestamp(),clock_timestamp()) ON CONFLICT (provider,"externalId") DO NOTHING`,[id,c.projectId,META_APP_PROJECTION_PROVIDER,externalId,'app_'+record.kind,JSON.stringify(stored),JSON.stringify({version:1,kind:'PRIVATE_APP_SOURCE',businessApplied:false,replySent:false})]);
   if(result.rowCount===1)inserted++;
   else{
    const previous=(await client.query(`SELECT payload FROM public."WebhookEvent" WHERE provider=$1 AND "externalId"=$2 AND "projectId"=$3`,[META_APP_PROJECTION_PROVIDER,externalId,c.projectId])).rows[0];
    if(!previous||previous.payload.channelId!==c.id)throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_CONFLICT',409);
    const prior=JSON.parse(decryptCustomerSecret(previous.payload.encryptedPayload,{organizationId:c.organizationId,projectId:c.projectId,purpose:META_APP_PROJECTION_PURPOSE,resourceId:id},environment));
    if(metaCustomerContentDigest(prior.record)!==metaCustomerContentDigest(record)||prior.field!==payload.field)throw new WorkspaceError('META_CUSTOMER_APP_SOURCE_CONFLICT',409);
   }
  }
  const observedAt=new Date(now()).toISOString(),kind=payload.field==='smb_app_state_sync'?'contacts':payload.field==='history'?'history':null;
  if(kind){const step=s[kind]||{},progress=Math.max(step.progress||0,parsed.checkpoint?.progress||0);s={...s,[kind]:{...step,state:parsed.declined?'DECLINED':progress===100?'PROVIDER_COMPLETE_OBSERVED':'RECEIVING',observedAt,records:(step.records||0)+inserted,...(parsed.checkpoint?{progress,lastCheckpoint:{...parsed.checkpoint,sourceEventId:event.id}}:{})}};}
  else if(payload.field==='smb_message_echoes')s={...s,echoes:(s.echoes||0)+inserted,lastEchoAt:observedAt};
  await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[c.id,c.projectId,JSON.stringify({coexistence:s})]);
  return {kind:'COEXISTENCE_SOURCE',reviewState:'OBSERVED',businessApplied:false,replySent:false,receiptId:'meta_app_receipt_'+digest([event.id,event.payload.payloadDigest]),identityStatus:'NOT_APPLICABLE'};
 });
 if(!claimed?.reconnect)return claimed;
 try{
  if(claimed.preparationError)throw new WorkspaceError('META_CUSTOMER_RECONNECTION_PREPARATION_REQUIRED',409);
  // Existing provider methods perform only GETs: debug_token, owned phone
  // capabilities and subscribed_apps. No signup/register/history POST occurs.
  const c=claimed.channel,verified=await provider.inspect({token:claimed.token,wabaId:c.whatsappBusinessId,phoneNumberId:c.phoneNumberId,numberMode:'BUSINESS_APP'});
  if(verified.phoneNumberId!==c.phoneNumberId||verified.isOnBizApp!==true||verified.platformType!=='CLOUD_API'||verified.registered!==true||!hasMetaCustomerRequiredScopes(verified.scopes)||verified.expiresAt&&(!Number.isFinite(Date.parse(verified.expiresAt))||Date.parse(verified.expiresAt)<=now()+60000))throw new WorkspaceError('META_CUSTOMER_RECONNECTION_PROVIDER_EVIDENCE_REQUIRED',409);
  if(await provider.inspectSubscription({token:claimed.token,wabaId:c.whatsappBusinessId})!==true)throw new WorkspaceError('META_CUSTOMER_SUBSCRIPTION_UNCONFIRMED',409);
  return await locked(context,async(client,current,event,payload)=>{
   const s=current.metadata.coexistence,recovery=customerLifecycleRecovery(current);
   if(payload.value?.event!=='ACCOUNT_RECONNECTED'||current.id!==c.id||current.phoneNumberId!==c.phoneNumberId||current.whatsappBusinessId!==c.whatsappBusinessId||current.encryptedAccessToken!==c.encryptedAccessToken||current.metadata.customerLifecycle?.sourceEventId!==event.id||metaCustomerContentDigest(recovery)!==claimed.recoveryDigest||digest([s.verified,s.verifiedAt,current.metadata.customerSignupId])!==claimed.grantDigest||digest(await profile(client,current))!==claimed.profileDigest||!metaCustomerTransportReady(provider.readiness()))throw new WorkspaceError('META_CUSTOMER_RECONNECTION_CHANGED',409);
   const unchangedActivation=digest(current.metadata.customerActivation||null)===recovery.activationDigest,wasAccepted=current.metadata.customerActivation?.version===1&&current.metadata.customerActivation.state==='ACTIVE'&&typeof current.metadata.customerActivation.actorId==='string';
   const restore=recovery.previouslyEnabled===true&&unchangedActivation&&wasAccepted;
   const state=restore?'RESTORED':current.enabled?'MANUAL_REVIEW_REQUIRED':'KEPT_DISABLED',lastCode=restore?null:unchangedActivation?null:'META_CUSTOMER_RECONNECTION_MANUAL_OVERRIDE';
   const settled={...recovery,state,verifiedAt:new Date(now()).toISOString(),leaseToken:null,lastCode};
   await save(client,current,{customerSubscribed:true,customerVerification:verified,customerLifecycle:{...current.metadata.customerLifecycle,recovery:settled}},restore?true:current.enabled);
   return lifecycleOutcome(lastCode,state==='MANUAL_REVIEW_REQUIRED'?'REVIEW_REQUIRED':'OBSERVED');
  });
 }catch(error){
  await locked(context,async(client,c,event)=>{const recovery=customerLifecycleRecovery(c);if(c.metadata.customerLifecycle?.sourceEventId===event.id&&recovery?.reconnectEventId===event.id&&recovery.leaseToken===context.leaseToken)await save(client,c,{customerLifecycle:{...c.metadata.customerLifecycle,recovery:{...recovery,state:'REVIEW_REQUIRED',leaseToken:null,lastCode:error instanceof WorkspaceError?error.code:'META_CUSTOMER_RECONNECTION_UNCONFIRMED'}}});}).catch(()=>{});
  throw error;
 }
 }};
}
