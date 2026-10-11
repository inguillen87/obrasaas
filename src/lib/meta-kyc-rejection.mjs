import {WorkspaceError,digest} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerJobTransaction,customerOutboundId,customerOutboundResult,reserveCustomerOutbound,completeCustomerOutbound,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {inspectMetaKycRejectionSource,resolveMetaKycRejectionAuthority,metaKycRejectionAuthorityDigest} from './meta-kyc-rejection-policy.mjs';

export const META_KYC_REJECTION_REPLY=Object.freeze({type:'text',body:'No pudimos iniciar la presentación con ese mensaje. Copiá el mensaje completo vigente desde ObraSaaS y envialo desde tu teléfono registrado. Si continúa, pedile al responsable que consulte el intento en tu ficha. Esperá las indicaciones del chat antes de enviar documentos.'});
const receiptId=eventId=>'meta_kyc_rejection_'+digest(['meta-kyc-rejection-v1',eventId]);
const secret=(r,purpose,resourceId)=>({organizationId:r.connection.organizationId,projectId:r.connection.projectId,purpose,resourceId});
const failure=()=>{throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);};
const result=()=>({kind:'KYC_REJECTION',code:'META_KYC_CHALLENGE_REJECTED',identityStatus:'CHANNEL_IDENTITY_UNVERIFIED',reviewState:'REVIEW_REQUIRED',businessApplied:false,replySent:false,reply:META_KYC_REJECTION_REPLY});

export function createMetaKycRejection({connect,provider,environment=process.env,afterReserve=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run),resolve=(client,context)=>resolveMetaKycRejectionAuthority(client,context,{environment});
 async function recorded(client,r,{observation=false}={}){
  if(!observation)metaKycRejectionAuthorityDigest(r);
  const id=receiptId(r.event.id),rows=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='WebhookEvent' AND "entityId"=$3 AND action='participant.kyc_chat.rejected' FOR SHARE`,[id,r.connection.organizationId,r.event.id])).rows;
  if(!rows.length)return null;if(rows.length!==1)failure();const m=rows[0].metadata;
  if(m?.version!==1||m.projectId!==r.connection.projectId||m.channelId!==r.connection.id||m.payloadDigest!==r.event.payload.payloadDigest||m.code!=='META_KYC_CHALLENGE_REJECTED'||m.replyDigest!==digest(META_KYC_REJECTION_REPLY))failure();
  let value;try{value=JSON.parse(decryptCustomerSecret(m.encryptedResult,secret(r,'kyc-rejection',id),environment));}catch{failure();}
  if(digest(value)!==digest(result()))failure();return value;
 }
 async function closedDelivery(client,source,previous){
  const r={connection:source.raw,event:source.initial[0]},id=customerOutboundId(r.event.id),rows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3 AND payload->>'organizationId'=$4`,[id,r.connection.projectId,r.connection.id,r.connection.organizationId])).rows;
  if(rows.length>1)failure();let delivery=null;
  if(rows.length){const row=rows[0];let request;try{request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,secret(r,'outbound',id),environment));}catch{failure();}
   if(row.payload.kycRejection!==true||digest(request)!==row.payload.requestDigest||request.version!==1||request.eventId!==r.event.id||request.payloadDigest!==r.event.payload.payloadDigest||request.channelId!==r.connection.id||request.organizationId!==r.connection.organizationId||request.channelPurpose!=='KYC_REJECTION'||request.to!==source.first.value.from||request.replyTo!==source.first.value.id||digest(request.message)!==digest(META_KYC_REJECTION_REPLY))failure();delivery=customerOutboundResult(row);
  }
  // Terminal observation only: no reply capability, reservation or provider I/O.
  return {...previous,reply:undefined,replySent:delivery?.replySent===true,replyState:delivery?.state||'META_CUSTOMER_REPLY_WINDOW_CLOSED',replyWindowClosed:true};
 }
 return {
  async rejection(context,{recoverOnly=false,code=null}={}){
   if(!recoverOnly&&code!=='META_KYC_CHALLENGE_REJECTED')return null;
   // Recovery may observe a previous fixed dispatch before any capture retry.
   try{return await within(async client=>{
    if(recoverOnly){const source=await inspectMetaKycRejectionSource(client,context,{environment,replyWindow:false});if(!source)return null;const previous=await recorded(client,{connection:source.raw,event:source.initial[0]},{observation:true});if(!previous)return null;if(source.replyWindowClosed)return closedDelivery(client,source,previous);}
    const r=await resolve(client,context);if(!r)return null;const previous=await recorded(client,r);if(previous)return previous;if(recoverOnly)return null;
    const value=result(),id=receiptId(r.event.id),metadata={version:1,projectId:r.connection.projectId,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,code:'META_KYC_CHALLENGE_REJECTED',replyDigest:digest(value.reply),encryptedResult:encryptCustomerSecret(JSON.stringify(value),secret(r,'kyc-rejection',id),environment),identityCertified:false,permissionsGranted:false};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.rejected','WebhookEvent',$4,$5::jsonb)`,[id,r.connection.organizationId,r.issuer.actorId,r.event.id,JSON.stringify(metadata)]);return value;
   });}catch(error){if(!recoverOnly&&['META_CUSTOMER_REPLY_WINDOW_CLOSED','META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED','META_OWN_COMPANY_UNAVAILABLE','META_OWN_COMPANY_OWNER_UNVERIFIED'].includes(error.code))return null;throw error;}
  },
  async send(context,reply){
   if(digest(reply)!==digest(META_KYC_REJECTION_REPLY))failure();
   async function inspect(client){const r=await resolve(client,context);if(!r||!await recorded(client,r))failure();return r;}
   const reserved=await within(async client=>{
    const r=await inspect(client),{to,replyTo}=assertCustomerReplyWindow(r.payload,r.now.getTime()),id=customerOutboundId(r.event.id),request={version:1,eventId:r.event.id,payloadDigest:context.payloadDigest,channelId:r.connection.id,organizationId:r.connection.organizationId,to,replyTo,message:META_KYC_REJECTION_REPLY,channelPurpose:'KYC_REJECTION'};
    const reservation=await reserveCustomerOutbound(client,{id,projectId:r.connection.projectId,organizationId:r.connection.organizationId,actorId:r.issuer.actorId,request,payloadFields:{kycRejection:true},environment,now:r.now.getTime()});if(reservation.done)return reservation;
    const token=decryptCustomerSecret(r.connection.encryptedAccessToken,secret(r,'access-token',r.connection.phoneNumberId),environment);
    return {...reservation,token,to,replyTo,phoneNumberId:r.connection.phoneNumberId,connection:r.connection,capability:r.ownCompanyCapability,authorityDigest:metaKycRejectionAuthorityDigest(r)};
   });
   if(reserved.done)return reserved.done;await afterReserve();
   let state='SEND_UNKNOWN',sent=null;
   // Revalidation and OWN provider awaits share one canonical lock client.
   await within(async client=>{
    const fence=async()=>{const current=await inspect(client);if(metaKycRejectionAuthorityDigest(current)!==reserved.authorityDigest||current.connection.encryptedAccessToken!==reserved.connection.encryptedAccessToken)failure();return current;};
    await fence();
    const own=reserved.connection.metadata?.ownCompany||Object.hasOwn(reserved.connection.metadata||{},'ownCompanyRuntime');
    const scoped=own?await provider.forConnection({capability:reserved.capability,connection:reserved.connection,token:reserved.token,beforeExternal:fence}):provider;
    await fence();try{sent=await scoped.sendReply({...reserved,message:META_KYC_REJECTION_REPLY,correlationId:reserved.id,beforeExternal:fence});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';else if(error instanceof WorkspaceError&&error.code!=='META_CUSTOMER_SEND_UNCONFIRMED')throw error;}
   });
   const completed=await within(client=>completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:sent?.messageId||null}));const {payload,...publicValue}=completed;void payload;return publicValue;
  },
 };
}
