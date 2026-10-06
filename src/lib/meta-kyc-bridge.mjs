import {WorkspaceError,digest} from './workspace-policy.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';
import {beginMetaKycConversation,planMetaKycConversation} from './meta-kyc-conversation.mjs';
import {metaKycOperationId} from './meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,metaKycDispatchReceiptId,metaKycConversationEnvelope,sealMetaKycValue} from './meta-kyc-identity.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {decodePrivateImage,MAX_PRIVATE_IMAGE_BYTES} from './private-image-upload.mjs';

const text=body=>({type:'text',body});
const replyResult=(reply,extra={})=>({kind:'KYC_CHAT',identityStatus:'LIMITED_KYC_UPLOAD',reviewState:'OBSERVED',businessApplied:false,replySent:false,reply,...extra});
export function createMetaKycBridge({connect,provider,deposit,environment=process.env,resolveAuthority=resolveMetaKycAuthority}){
 const within=run=>customerJobTransaction(connect,run),resolve=(client,context,options={})=>resolveAuthority(client,context,{...options,environment});
 async function record(client,r,result,state,transition=null,{preserveConversation=false}={}){
  const current=(await client.query(`SELECT metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id])).rows[0];
  if(current?.metadata?.participant?.kycChatChallenge?.id!==r.challenge.id)throw new WorkspaceError('META_KYC_CHALLENGE_REVOKED',409);
  const challenge={...current.metadata.participant.kycChatChallenge,...transition,messageCount:(current.metadata.participant.kycChatChallenge.messageCount||0)+1};r.challenge=challenge;
  const metadata={...current.metadata,participant:{...current.metadata.participant,kycChatChallenge:challenge,kycChatConversation:preserveConversation?current.metadata.participant.kycChatConversation:metaKycConversationEnvelope(r,state,environment)}};
  await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(metadata)]);
  const id=metaKycDispatchReceiptId(r.event.id);
  await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.dispatched','Worker',$4,$5::jsonb)`,[id,r.project.organizationId,r.member.actorId,r.worker.id,JSON.stringify({version:1,projectId:r.project.id,challengeId:r.challenge.id,payloadDigest:r.event.payload.payloadDigest,replyDigest:digest(result.reply),encryptedResult:sealMetaKycValue(r,'kyc-chat-dispatch',id,result,environment),identityCertified:false,permissionsGranted:false})]);
  return result;
 }
 async function prepare(context){return within(async client=>{
  const r=await resolve(client,context);if(r.recorded)return {result:r.recorded};
  if(r.state?.step==='FINALIZING'&&r.state.confirmationEventId===r.event.id){await resolve(client,context,{deposit:true});await client.query(`UPDATE public."WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '180 seconds' WHERE id=$1 AND "leaseToken"=$2`,[r.event.id,context.leaseToken]);return {deposit:true};}
  if(['COMPLETED','CANCELLED'].includes(r.challenge.status))throw new WorkspaceError('META_KYC_NOT_APPLICABLE',409);
  const plan=r.challenge.status==='PENDING'?beginMetaKycConversation(r.event.id):planMetaKycConversation({message:r.payload.value,state:r.state,eventId:r.event.id});
  if(plan.deposit){
   const metadata={...r.worker.metadata,participant:{...r.worker.metadata.participant,kycChatConversation:metaKycConversationEnvelope(r,plan.state,environment)}};
   await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(metadata)]);
   await client.query(`UPDATE public."WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '180 seconds' WHERE id=$1 AND "leaseToken"=$2`,[r.event.id,context.leaseToken]);
   return {deposit:true};
  }
  const transition=plan.cancelled?{status:'CANCELLED',cancelledEventId:r.event.id}:r.challenge.status==='PENDING'?{status:'CLAIMED',claimedAt:r.now.toISOString(),claimedEventId:r.event.id}:null;
  return {result:await record(client,r,replyResult(plan.reply),plan.state,transition,{preserveConversation:plan.preserveConversation===true})};
 });}
 return {async execute(context){
  let prepared;try{prepared=await prepare(context);}catch(error){if(error.code==='META_KYC_NOT_APPLICABLE')return null;throw error;}
  if(prepared.result)return prepared.result;
  const authorized=await within(client=>resolve(client,context,{deposit:true})),state=authorized.state;
  const token=decryptCustomerSecret(authorized.connection.encryptedAccessToken,{organizationId:authorized.project.organizationId,projectId:authorized.project.id,purpose:'access-token',resourceId:authorized.connection.phoneNumberId},environment);
  const images={};
  try{for(const key of ['front','selfie']){
   const reference=state[key],downloaded=await provider.downloadMedia({token,phoneNumberId:authorized.connection.phoneNumberId,mediaId:reference.mediaId,limit:MAX_PRIVATE_IMAGE_BYTES});
   const contentType=downloaded.contentType?.split(';')[0].trim(),encoded='data:'+contentType+';base64,'+Buffer.from(downloaded.bytes).toString('base64');
   if(contentType!==reference.contentType)throw new WorkspaceError('META_KYC_MEDIA_INTEGRITY',409);decodePrivateImage(encoded,contentType);images[key]=encoded;
  }}catch(error){
   if(!['META_KYC_MEDIA_INTEGRITY','META_CUSTOMER_MEDIA_REJECTED','META_CUSTOMER_PROVIDER_REJECTED','PRIVATE_IMAGE_INVALID','PRIVATE_IMAGE_TOO_LARGE','PRIVATE_IMAGE_TYPE_MISMATCH'].includes(error.code))throw error;
   return within(async client=>{const r=await resolve(client,context,{deposit:true});if(r.recorded)return r.recorded;return record(client,r,replyResult(text('No pudimos validar las imágenes. No se presentó la identidad. Volvé a enviar el frente del documento como imagen nítida de hasta 2 MB; después pediremos una selfie nueva. Escribí CANCELAR para terminar.')),{...r.state,step:'FRONT',front:null,selfie:null,confirmationEventId:null});});
  }
  const outcome=await deposit.deposit(context,{operationId:metaKycOperationId(context.eventId),noticeVersion:state.noticeVersion,noticeSha256:state.noticeSha256,consent:state.consent,ocrConsent:state.ocrConsent,ocrNoticeVersion:state.ocrNoticeVersion,biometricConsent:state.biometricConsent,biometricNoticeVersion:state.biometricNoticeVersion,...images});
  return within(async client=>{
   const r=await resolve(client,context,{deposit:true});if(r.recorded)return r.recorded;
   const invited=r.worker.metadata.participant.status==='INVITED';
   const result=replyResult(text(invited?'Documento y selfie presentados en privado. Falta la aceptación verificada de la cuenta antes de la revisión y la vinculación operativa. No habilitamos permisos.':'Documento y selfie presentados en privado. Un responsable debe revisar tu identidad antes de vincular WhatsApp. No habilitamos permisos.'),{businessApplied:true,receiptId:outcome.receiptId||null,reviewState:'RECORDED'});
   return record(client,r,result,r.state,{status:'COMPLETED',completedAt:r.now.toISOString(),completionEventId:r.event.id});
  });
 }};
}
