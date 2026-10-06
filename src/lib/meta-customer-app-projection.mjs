import {WorkspaceError,digest} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {lockMetaCustomerInboxChannel,metaCustomerContentDigest} from './meta-customer-callback.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';

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
 if(payload.field==='account_update')return {records:[],lifecycle:typeof v.event==='string'&&/^[A-Za-z_]{1,80}$/.test(v.event)?v.event.toLowerCase():null};
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
export function createMetaCustomerAppProjection({connect,environment=process.env,now=()=>Date.now()}){
 return {async execute(context){return customerJobTransaction(connect,async client=>{
  const candidate=(await client.query(`SELECT "whatsappBusinessId","phoneNumberId" FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2`,[context.channelId,context.projectId])).rows[0];
  if(!candidate)throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);
  const c=await lockMetaCustomerInboxChannel(client,{wabaId:candidate.whatsappBusinessId,phoneNumberId:candidate.phoneNumberId,projectId:context.projectId,writable:true});
  const event=(await client.query(`SELECT id,"projectId",provider,payload,status::text AS status,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' FOR UPDATE`,[context.eventId,context.projectId])).rows[0];
  if(!event||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||Date.parse(event.leaseExpiresAt)<=now()||event.payload.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  const payload=decodeSignedCustomerEvent(event,c,environment),parsed=customerAppRecords(payload);
  if(!parsed)return null;
  if(parsed.lifecycle){
   const lifecycle={event:parsed.lifecycle,sourceEventId:event.id,observedAt:new Date(now()).toISOString()},disconnected=['partner_removed','account_disconnected','account_offboarded'].includes(parsed.lifecycle);
   await client.query(`UPDATE public."WhatsAppConnection" SET metadata=metadata||$3::jsonb,enabled=CASE WHEN $4 THEN false ELSE enabled END,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[c.id,c.projectId,JSON.stringify({customerLifecycle:lifecycle,...(c.metadata.coexistence?{coexistence:{...c.metadata.coexistence,lifecycle}}:{})}),disconnected]);
   return {kind:'CUSTOMER_ACCOUNT_LIFECYCLE',reviewState:'OBSERVED',businessApplied:false,replySent:false,identityStatus:'NOT_APPLICABLE'};
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
 });}};
}
