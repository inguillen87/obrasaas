import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerReplyMessage} from './meta-customer-provider.mjs';
import {hasMetaCustomerRequiredScopes} from './meta-customer-permissions.mjs';
import {META_CUSTOMER_PROTOCOL,resolveMetaCloudProtocol} from './meta-cloud-protocol.mjs';
import {customerLifecycleRecovery} from './meta-customer-coexistence.mjs';
import {assertDevelopmentPilotAttendance} from './meta-development-pilot-policy.mjs';

export const customerOutboundId=eventId=>'customer_outbound_'+digest(['meta-customer-reply-v1',eventId]);
export function customerChannelActive(connection,now=Date.now(),{pilotAttendance=false,environment=process.env}={}){
 if(connection?.metadata?.developmentPilot){if(!pilotAttendance)return false;try{assertDevelopmentPilotAttendance(connection,environment,now);}catch{return false;}}
 const verified=connection?.metadata?.customerVerification,activation=connection?.metadata?.customerActivation;
 const recovery=customerLifecycleRecovery(connection);if(recovery&&recovery.state!=='RESTORED')return false;
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
export const customerOutboundResult=row=>({id:row.id,state:row.outcome?.state||'SEND_UNKNOWN',replySent:['SENT','STATUS_OBSERVED'].includes(row.outcome?.state)&&!['failed','deleted'].includes(row.outcome?.providerStatus),messageId:row.outcome?.messageId||null,providerStatus:row.outcome?.providerStatus||null,replayed:true});
const publicResult=customerOutboundResult;
// Authenticated compositions supply already locked, canonical recipient state.
// Both replies and manual templates share this durable reservation/status lane.
export async function reserveCustomerOutbound(client,{id,projectId,organizationId,actorId,request,eventType='reply',payloadFields={},environment=process.env,now=Date.now(),deferred=false}){
 if(!/^customer_outbound_[a-f0-9]{64}$/.test(id)||!['reply','template'].includes(eventType)||request.channelId!==payloadFields.channelId&&payloadFields.channelId!==undefined||request.organizationId!==organizationId)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 const requestDigest=digest(request),previous=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];
 if(previous){if(previous.payload?.requestDigest!==requestDigest)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONFLICT',409);return {done:publicResult(previous)};}
 if(deferred&&(eventType!=='template'||request.channelPurpose!=='PARTICIPANT_ONBOARDING'||payloadFields.participantOnboarding!==true))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 const encryptedPayload=encryptCustomerSecret(JSON.stringify(request),{organizationId,projectId,purpose:'outbound',resourceId:id},environment),leaseToken=deferred?null:randomUUID();
 await client.query(`INSERT INTO public."WebhookEvent"(id,"projectId",provider,"externalId","eventType",status,payload,outcome,"leaseToken","leaseExpiresAt",attempts,"updatedAt") VALUES($1,$2,'meta-customer-outbound-v1',$1,$3,'PENDING',$4::jsonb,$5::jsonb,$6,$7,1,clock_timestamp())`,[id,projectId,eventType,JSON.stringify({...payloadFields,version:1,channelId:request.channelId,organizationId,...(request.eventId?{eventId:request.eventId}:{}),requestDigest,encryptedPayload}),JSON.stringify({version:1,state:'SEND_STARTED',reservedAt:new Date(now).toISOString(),actorId}),leaseToken,new Date(now+60000)]);
 if(deferred)await client.query(`UPDATE public."WebhookEvent" SET outcome=$3::jsonb,"leaseToken"=NULL,"leaseExpiresAt"=NULL,attempts=0 WHERE id=$1 AND "projectId"=$2`,[id,projectId,JSON.stringify({version:1,state:'ONBOARDING_PENDING',preparedAt:new Date(now).toISOString(),actorId})]);
 return {id,leaseToken,requestDigest};
}
// The marker commits before the only permitted POST. An existing marker is
// deliberately never leased again, even when its lease or HTTP request expires.
export async function startPendingCustomerOutbound(client,{id,projectId,requestDigest,now=Date.now()}){
 const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];
 if(!row||row.payload?.requestDigest!==requestDigest||row.payload.participantOnboarding!==true)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 if(row.outcome?.state!=='ONBOARDING_PENDING')return {done:publicResult(row)};
 const leaseToken=randomUUID();
 await client.query(`UPDATE public."WebhookEvent" SET outcome=$3::jsonb,"leaseToken"=$4,"leaseExpiresAt"=$5,attempts=attempts+1,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[id,projectId,JSON.stringify({...row.outcome,state:'SEND_STARTED',reservedAt:new Date(now).toISOString()}),leaseToken,new Date(now+60000)]);
 return {id,projectId,leaseToken,requestDigest};
}
export async function completeCustomerOutbound(client,{id,projectId,leaseToken,state,messageId=null,now=Date.now(),outcomeFields={}}){
 if(!['SENT','SEND_UNKNOWN','REJECTED'].includes(state))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];
 if(!row)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_UNCONFIRMED',503);
 if(row.outcome?.state==='STATUS_OBSERVED')return {...publicResult(row),payload:row.payload};
 const updated=await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$4::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3`,[id,projectId,leaseToken,JSON.stringify({...row.outcome,...outcomeFields,state,messageId,completedAt:new Date(now).toISOString()})]);
 if(updated.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
 return {id,state,replySent:state==='SENT',messageId,replayed:false,payload:row.payload};
}
export function createMetaCustomerOutbound({connect,resolveIdentity,provider,environment=process.env,now=()=>Date.now(),afterReserve=async()=>{},protocol=META_CUSTOMER_PROTOCOL,channelActive=customerChannelActive,sourceContext=false}){
 resolveMetaCloudProtocol(protocol);
 const within=run=>customerJobTransaction(connect,run);
 async function reserve(context,reply){
  customerReplyMessage(reply);
  return within(async client=>{
   // Canonical resolver owns U/TM -> Project -> PM -> Worker -> Channel ->
   // Event locking and revalidates signed evidence, participation and KYC.
   const resolved=await resolveIdentity(client,{eventId:context.eventId,permission:null,claimChallenge:false,environment});
   const {project,connection,event,member}=resolved,payload=resolved.proof?.payload||resolved.proof?.message||resolved.proof;
   if(resolved.kind!=='CHANNEL_VERIFIED'||(sourceContext?event.projectId:project.id)!==context.projectId||connection.id!==context.channelId||event.payload.payloadDigest!==context.payloadDigest||event.leaseToken!==context.leaseToken||event.status!=='PENDING'||new Date(event.leaseExpiresAt).getTime()<=now())throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
   if(!channelActive(connection,now(),{pilotAttendance:Boolean(resolved.developmentPilotCapability),environment}))throw new WorkspaceError('META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED',409);
   const {to,replyTo}=assertCustomerReplyWindow(payload,now()),id=customerOutboundId(event.id),request={version:1,eventId:event.id,payloadDigest:context.payloadDigest,channelId:connection.id,organizationId:member.organizationId,to,replyTo,message:reply,...(protocol!==META_CUSTOMER_PROTOCOL?{channelPurpose:protocol.purpose}:{}),...(sourceContext?{targetProjectId:resolved.companyProjection?.projectId||null,sourceRouteId:resolved.companyProjection?.sourceEventId}: {})};
   const reservation=await reserveCustomerOutbound(client,{id,projectId:sourceContext?event.projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,request,environment,now:now()});if(reservation.done)return reservation;
   const token=decryptCustomerSecret(connection.encryptedAccessToken,{organizationId:member.organizationId,projectId:sourceContext?connection.projectId:project.id,purpose:protocol.credentialPurpose,resourceId:connection.phoneNumberId},environment);
   return {...reservation,token,phoneNumberId:connection.phoneNumberId,to,replyTo,connection,developmentPilotCapability:resolved.developmentPilotCapability};
  });
 }
 return {
  async send(context,reply){
   const reserved=await reserve(context,reply);if(reserved.done)return reserved.done;
   // No retry may send an existing reservation, including after this hook,
   // a crashed worker, a timed-out POST or a lost database commit response.
   await afterReserve();let scopedProvider=provider;
   if(reserved.connection?.metadata?.developmentPilot)scopedProvider=await provider.forConnection({capability:reserved.developmentPilotCapability,connection:reserved.connection,token:reserved.token});
   await reserve(context,reply);let state='SEND_UNKNOWN',result=null;
   try{result=await scopedProvider.sendReply({...reserved,message:reply,correlationId:reserved.id});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}
   const completed=await within(client=>completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:result?.messageId||null,now:now()}));
   const {payload:privatePayload,...resultPublic}=completed;void privatePayload;return resultPublic;
  },
  async result({eventId,projectId,channelId}){
   return within(async client=>{const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3`,[customerOutboundId(eventId),projectId,channelId])).rows[0];return row?publicResult(row):{state:'NOT_OBSERVED',replySent:false,definitive:false};});
  },
  async observeStatus(client,{event,payload,channel}){
   const value=payload?.value,id=value?.biz_opaque_callback_data;
   if(payload?.type!=='message_status'||event.payload.signatureVerified!==true||!/^customer_outbound_[a-f0-9]{64}$/.test(id||''))return {correlated:false};
   const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3 FOR UPDATE`,[id,event.projectId,channel.id])).rows[0];if(!row)return {correlated:false};
   if(row.payload?.participantOnboarding===true&&!['SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED'].includes(row.outcome?.state))return {correlated:false};
   const request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:channel.organizationId,projectId:event.projectId,purpose:'outbound',resourceId:id},environment));
   if(digest(request)!==row.payload.requestDigest||request.channelId!==channel.id||request.organizationId!==channel.organizationId||value.recipient_id!==request.to||row.outcome?.messageId&&row.outcome.messageId!==value.id)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_STATUS_CONFLICT',409);
   const previous=row.outcome?.providerStatus,order={sent:1,delivered:2,read:3,failed:4,deleted:5};
   if(previous&&(order[previous]||0)>(order[value.status]||0))return {correlated:true};
   await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$3::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[id,event.projectId,JSON.stringify({...row.outcome,state:'STATUS_OBSERVED',messageId:value.id,providerStatus:value.status,statusEventId:event.id,statusObservedAt:new Date(now()).toISOString()})]);return {correlated:true};
  },
 };
}
