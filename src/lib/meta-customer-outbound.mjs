import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerReplyMessage} from './meta-customer-provider.mjs';
import {hasMetaCustomerRequiredScopes} from './meta-customer-permissions.mjs';

export const customerOutboundId=eventId=>'customer_outbound_'+digest(['meta-customer-reply-v1',eventId]);
export function customerChannelActive(connection,now=Date.now()){
 const verified=connection?.metadata?.customerVerification,activation=connection?.metadata?.customerActivation;
 return connection?.enabled===true&&connection.connectionStatus==='CONNECTED'&&connection.metadata?.customerSubscribed===true&&activation?.version===1&&activation.state==='ACTIVE'&&typeof activation.actorId==='string'&&verified?.registered===true&&hasMetaCustomerRequiredScopes(verified.scopes)&&(!verified.expiresAt||new Date(verified.expiresAt).getTime()>now+60000);
}
export function assertCustomerReplyWindow(payload,now=Date.now()){
 const value=payload?.value,timestamp=Number(value?.timestamp);
 if(payload?.type!=='message'||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(value?.id||'')||!/^[1-9]\d{7,14}$/.test(value?.from||'')||!/^\d{1,14}$/.test(String(value?.timestamp||''))||!Number.isSafeInteger(timestamp)||timestamp*1000>now+60000||now-timestamp*1000>=24*60*60*1000)throw new WorkspaceError('META_CUSTOMER_REPLY_WINDOW_CLOSED',409);
 return {to:value.from,replyTo:value.id};
}
export async function customerJobTransaction(connect,run){
 const client=await connect();let broken=false;
 try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='8000ms'");const result=await run(client);await client.query('COMMIT');return result;}
 catch(error){try{await client.query('ROLLBACK');}catch{broken=true;}throw error;}
 finally{client.release(broken);}
}
const publicResult=row=>({id:row.id,state:row.outcome?.state||'SEND_UNKNOWN',replySent:['SENT','STATUS_OBSERVED'].includes(row.outcome?.state)&&!['failed','deleted'].includes(row.outcome?.providerStatus),messageId:row.outcome?.messageId||null,providerStatus:row.outcome?.providerStatus||null,replayed:true});
export function createMetaCustomerOutbound({connect,resolveIdentity,provider,environment=process.env,now=()=>Date.now(),afterReserve=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run);
 async function reserve(context,reply){
  customerReplyMessage(reply);
  return within(async client=>{
   // Canonical resolver owns U/TM -> Project -> PM -> Worker -> Channel ->
   // Event locking and revalidates signed evidence, participation and KYC.
   const resolved=await resolveIdentity(client,{eventId:context.eventId,permission:null,claimChallenge:false,environment});
   const {project,connection,event,member}=resolved,payload=resolved.proof?.payload||resolved.proof?.message||resolved.proof;
   if(resolved.kind!=='CHANNEL_VERIFIED'||project.id!==context.projectId||connection.id!==context.channelId||event.payload.payloadDigest!==context.payloadDigest||event.leaseToken!==context.leaseToken||event.status!=='PENDING'||new Date(event.leaseExpiresAt).getTime()<=now())throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
   if(!customerChannelActive(connection,now()))throw new WorkspaceError('META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED',409);
   const {to,replyTo}=assertCustomerReplyWindow(payload,now()),id=customerOutboundId(event.id),request={version:1,eventId:event.id,payloadDigest:context.payloadDigest,channelId:connection.id,organizationId:member.organizationId,to,replyTo,message:reply},requestDigest=digest(request);
   const previous=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,project.id])).rows[0];
   if(previous){if(previous.payload?.requestDigest!==requestDigest)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONFLICT',409);return {done:publicResult(previous)};}
   const encryptedPayload=encryptCustomerSecret(JSON.stringify(request),{organizationId:member.organizationId,projectId:project.id,purpose:'outbound',resourceId:id},environment),leaseToken=randomUUID();
   await client.query(`INSERT INTO public."WebhookEvent"(id,"projectId",provider,"externalId","eventType",status,payload,outcome,"leaseToken","leaseExpiresAt",attempts,"updatedAt") VALUES($1,$2,'meta-customer-outbound-v1',$1,'reply','PENDING',$3::jsonb,$4::jsonb,$5,$6,1,clock_timestamp())`,[id,project.id,JSON.stringify({version:1,channelId:connection.id,organizationId:member.organizationId,eventId:event.id,requestDigest,encryptedPayload}),JSON.stringify({version:1,state:'SEND_STARTED',reservedAt:new Date(now()).toISOString(),actorId:member.actorId}),leaseToken,new Date(now()+60000)]);
   const token=decryptCustomerSecret(connection.encryptedAccessToken,{organizationId:member.organizationId,projectId:project.id,purpose:'access-token',resourceId:connection.phoneNumberId},environment);
   return {id,leaseToken,token,phoneNumberId:connection.phoneNumberId,to,replyTo,requestDigest};
  });
 }
 return {
  async send(context,reply){
   const reserved=await reserve(context,reply);if(reserved.done)return reserved.done;
   // No retry may send an existing reservation, including after this hook,
   // a crashed worker, a timed-out POST or a lost database commit response.
   await afterReserve();await reserve(context,reply);let state='SEND_UNKNOWN',result=null;
   try{result=await provider.sendReply({...reserved,message:reply,correlationId:reserved.id});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}
   return within(async client=>{
    const row=(await client.query(`SELECT id,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[reserved.id,context.projectId])).rows[0];
    if(!row)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_UNCONFIRMED',503);
    if(row.outcome?.state==='STATUS_OBSERVED')return publicResult(row);
    const updated=await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$4::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3`,[reserved.id,context.projectId,reserved.leaseToken,JSON.stringify({...row.outcome,state,messageId:result?.messageId||null,completedAt:new Date(now()).toISOString()})]);
    if(updated.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
    return {id:reserved.id,state,replySent:state==='SENT',messageId:result?.messageId||null,replayed:false};
   });
  },
  async result({eventId,projectId,channelId}){
   return within(async client=>{const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3`,[customerOutboundId(eventId),projectId,channelId])).rows[0];return row?publicResult(row):{state:'NOT_OBSERVED',replySent:false,definitive:false};});
  },
  async observeStatus(client,{event,payload,channel}){
   const value=payload?.value,id=value?.biz_opaque_callback_data;
   if(payload?.type!=='message_status'||event.payload.signatureVerified!==true||!/^customer_outbound_[a-f0-9]{64}$/.test(id||''))return {correlated:false};
   const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3 FOR UPDATE`,[id,event.projectId,channel.id])).rows[0];if(!row)return {correlated:false};
   const request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:channel.organizationId,projectId:event.projectId,purpose:'outbound',resourceId:id},environment));
   if(digest(request)!==row.payload.requestDigest||request.channelId!==channel.id||request.organizationId!==channel.organizationId||value.recipient_id!==request.to||row.outcome?.messageId&&row.outcome.messageId!==value.id)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_STATUS_CONFLICT',409);
   const previous=row.outcome?.providerStatus,order={sent:1,delivered:2,read:3,failed:4,deleted:5};
   if(previous&&(order[previous]||0)>(order[value.status]||0))return {correlated:true};
   await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$3::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[id,event.projectId,JSON.stringify({...row.outcome,state:'STATUS_OBSERVED',messageId:value.id,providerStatus:value.status,statusEventId:event.id,statusObservedAt:new Date(now()).toISOString()})]);return {correlated:true};
  },
 };
}
