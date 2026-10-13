import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerJobTransaction,customerOutboundId,customerOutboundResult,reserveCustomerOutbound,completeCustomerOutbound,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {resolveMetaKycExpiryFeedbackAuthority,metaKycExpiryAuthorityDigest} from './meta-kyc-identity.mjs';
import {lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';

export const META_KYC_EXPIRY_REPLY=Object.freeze({type:'text',body:'La conversación de este intento de identidad venció. No envíes más imágenes con este intento.\n\nConsultá https://obrasaas.com/cuenta y pedile al responsable que revise y cierre el intento; después podrá preparar otro si corresponde.\n\nEste aviso no renueva el código ni habilita permisos.'});
const fail=()=>{throw new WorkspaceError('META_KYC_EXPIRY_FEEDBACK_DENIED',409);};
export const metaKycExpiryReceiptId=eventId=>'meta_kyc_expiry_'+digest(['meta-kyc-expiry-feedback-v1',eventId]);
const aad=(r,purpose,resourceId)=>({organizationId:r.connection.organizationId,projectId:r.connection.projectId,purpose,resourceId});
const result=()=>({kind:'KYC_EXPIRY_FEEDBACK',code:'META_KYC_CHALLENGE_EXPIRED',identityStatus:'LIMITED_KYC_FEEDBACK',reviewState:'OBSERVED',businessApplied:false,replySent:false,reply:META_KYC_EXPIRY_REPLY});

export function createMetaKycExpiryFeedback({connect,provider,environment=process.env,afterReserve=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run),resolve=(client,context)=>resolveMetaKycExpiryFeedbackAuthority(client,context,{environment});
 async function source(client,context){
  if(!/^customer_webhook_[a-f0-9]{64}$/.test(context?.eventId||'')||!workspaceId(context.projectId)||!workspaceId(context.channelId)||!operationId(context.leaseToken)||!/^[a-f0-9]{64}$/.test(context.payloadDigest||''))fail();
  const events=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2`,[context.eventId,context.projectId])).rows,event=events[0];
  if(events.length!==1||event.provider!=='meta-customer-v1'||event.payload?.channelId!==context.channelId||event.payload.payloadDigest!==context.payloadDigest)fail();
  const channels=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p.status='ACTIVE'`,[context.channelId,context.projectId])).rows,connection=channels[0];
  if(channels.length!==1||connection.metadata?.developmentPilot||connection.whatsappBusinessId===OBRASAAS_META_CHANNEL.wabaId||connection.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||connection.metadata?.credentialFormat!=='tenant-aad-v2'||connection.metadata.credentialOrganizationId!==connection.organizationId)fail();
  const payload=decodeSignedCustomerEvent(event,connection,environment),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
  if(payload.type!=='message'||!(now instanceof Date)||!Number.isFinite(now.getTime())||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime())fail();
  return {connection,event,payload,now};
 }
 async function recorded(client,r){
  const id=metaKycExpiryReceiptId(r.event.id),rows=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='WebhookEvent' AND "entityId"=$3 AND action='participant.kyc_chat.expiry_feedback' FOR SHARE`,[id,r.connection.organizationId,r.event.id])).rows;
  if(!rows.length)return null;if(rows.length!==1)fail();const m=rows[0].metadata;
  if(m?.version!==1||m.projectId!==r.connection.projectId||m.channelId!==r.connection.id||m.payloadDigest!==r.event.payload.payloadDigest||m.code!=='META_KYC_CHALLENGE_EXPIRED'||m.replyDigest!==digest(META_KYC_EXPIRY_REPLY)||!/^[a-f0-9]{64}$/.test(m.authorityDigest||''))fail();
  let value;try{value=JSON.parse(decryptCustomerSecret(m.encryptedResult,aad(r,'kyc-expiry-feedback',id),environment));}catch{fail();}
  if(digest(value)!==digest(result()))fail();return {value,metadata:m};
 }
 async function observation(client,r,previous){
  const id=customerOutboundId(r.event.id),rows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR SHARE`,[id,r.connection.projectId])).rows;
  if(rows.length>1)fail();let delivery=null;
  if(rows.length){const out=rows[0];let request;try{request=JSON.parse(decryptCustomerSecret(out.payload.encryptedPayload,aad(r,'outbound',id),environment));}catch{fail();}
   if(out.payload.kycExpiryFeedback!==true||request.channelPurpose!=='KYC_EXPIRY_FEEDBACK'||request.eventId!==r.event.id||request.payloadDigest!==r.event.payload.payloadDigest||request.organizationId!==r.connection.organizationId||request.channelId!==r.connection.id||request.to!==r.payload.value.from||request.replyTo!==r.payload.value.id||digest(request)!==out.payload.requestDigest||digest(request.message)!==digest(META_KYC_EXPIRY_REPLY))fail();delivery=customerOutboundResult(out);
  }
  return {...previous.value,reply:undefined,replySent:delivery?.replySent===true,replyState:delivery?.state||'META_KYC_EXPIRY_FEEDBACK_DENIED'};
 }
 async function inspect(client,context,expected=null){
  const r=await resolve(client,context);if(!r)fail();const authorityDigest=metaKycExpiryAuthorityDigest(client,r,context),previous=await recorded(client,r);
  if(!previous||previous.metadata.authorityDigest!==authorityDigest||expected&&expected!==authorityDigest)fail();return {r,authorityDigest,previous};
 }
 return {
  async feedback(context,{recoverOnly=false,code=null}={}){
   if(!recoverOnly&&code!=='META_KYC_CHALLENGE_EXPIRED')return null;
   return within(async client=>{
    if(recoverOnly){const observed=await source(client,context),previous=await recorded(client,observed);if(!previous)return null;
     try{const current=await inspect(client,context);assertCustomerReplyWindow(current.r.payload,current.r.now.getTime());return previous.value;}catch(error){if(!(error instanceof WorkspaceError))throw error;return observation(client,observed,previous);}
    }
    let r;try{r=await resolve(client,context);}catch(error){if(error instanceof WorkspaceError)return null;throw error;}if(!r)return null;
    const previous=await recorded(client,r);if(previous)return previous.value;
    const existing=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR SHARE`,[customerOutboundId(r.event.id),r.connection.projectId])).rows;if(existing.length)fail();
    const id=metaKycExpiryReceiptId(r.event.id),value=result(),authorityDigest=metaKycExpiryAuthorityDigest(client,r,context);
    const metadata={version:1,projectId:r.connection.projectId,targetProjectId:r.project.id,workerId:r.worker.id,challengeId:r.challenge.id,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,code:'META_KYC_CHALLENGE_EXPIRED',authorityDigest,replyDigest:digest(META_KYC_EXPIRY_REPLY),encryptedResult:encryptCustomerSecret(JSON.stringify(value),aad(r,'kyc-expiry-feedback',id),environment),identityCertified:false,permissionsGranted:false};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.expiry_feedback','WebhookEvent',$4,$5::jsonb)`,[id,r.connection.organizationId,r.issuer.actorId,r.event.id,JSON.stringify(metadata)]);
    await inspect(client,context,authorityDigest);return value;
   });
  },
  async send(context,reply){
   if(digest(reply)!==digest(META_KYC_EXPIRY_REPLY))fail();
   const reserved=await within(async client=>{
    const {r,authorityDigest}=await inspect(client,context),{to,replyTo}=assertCustomerReplyWindow(r.payload,r.now.getTime()),id=customerOutboundId(r.event.id),request={version:1,eventId:r.event.id,payloadDigest:context.payloadDigest,channelId:r.connection.id,organizationId:r.connection.organizationId,to,replyTo,message:META_KYC_EXPIRY_REPLY,channelPurpose:'KYC_EXPIRY_FEEDBACK',authorityDigest};
    const reservation=await reserveCustomerOutbound(client,{id,projectId:r.connection.projectId,organizationId:r.connection.organizationId,actorId:r.issuer.actorId,request,payloadFields:{kycExpiryFeedback:true},environment,now:r.now.getTime()});if(reservation.done)return reservation;
    const token=decryptCustomerSecret(r.connection.encryptedAccessToken,aad(r,'access-token',r.connection.phoneNumberId),environment);return {...reservation,to,replyTo,authorityDigest,token,phoneNumberId:r.connection.phoneNumberId,connection:r.connection};
   });
   if(reserved.done)return reserved.done;await afterReserve();let state='SEND_UNKNOWN',sent=null;
   await within(async client=>{
    const fence=async()=>{const {r}=await inspect(client,context,reserved.authorityDigest);if(r.connection.encryptedAccessToken!==reserved.connection.encryptedAccessToken)fail();assertCustomerReplyWindow(r.payload,r.now.getTime());return r;};
    const current=await fence(),capability=await lockOwnCompanyIssuer(client,current.connection,{environment,now:current.now.getTime()}),own=current.connection.metadata?.ownCompany||Object.hasOwn(current.connection.metadata||{},'ownCompanyRuntime');
    const scoped=own?await provider.forConnection({capability,connection:current.connection,token:reserved.token,beforeExternal:fence}):provider;
    await fence();try{sent=await scoped.sendReply({...reserved,message:META_KYC_EXPIRY_REPLY,correlationId:reserved.id,beforeExternal:fence,finalBeforeExternal:fence});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';else if(error instanceof WorkspaceError&&!['META_CUSTOMER_SEND_UNCONFIRMED','META_CUSTOMER_PROVIDER_UNCONFIRMED'].includes(error.code))throw error;}
    await fence();
   });
   const completed=await within(async client=>{await inspect(client,context,reserved.authorityDigest);return completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:sent?.messageId||null});});const {payload,...publicValue}=completed;void payload;return publicValue;
  },
 };
}
