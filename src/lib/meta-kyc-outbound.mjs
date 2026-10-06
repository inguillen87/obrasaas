import {WorkspaceError,digest} from './workspace-policy.mjs';
import {customerJobTransaction,customerOutboundId,assertCustomerReplyWindow,reserveCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {resolveMetaKycAuthority} from './meta-kyc-identity.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';

// Shares the canonical reservation/delivery lane, with a narrower fixed-prompt
// authority. The supplied reply must equal a sealed KYC dispatch receipt.
export function createMetaKycOutbound({connect,provider,environment=process.env,resolveAuthority=resolveMetaKycAuthority,afterReserve=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run);
 const inspect=async(client,context,reply)=>{
  const r=await resolveAuthority(client,context,{outbound:true,environment});
  if(r.kind!=='LIMITED_KYC_UPLOAD'||!r.recorded?.reply||digest(r.recorded.reply)!==digest(reply))throw new WorkspaceError('META_KYC_CHALLENGE_REJECTED',409);
  return r;
 };
 return {async send(context,reply){
  const reserved=await within(async client=>{
   const r=await inspect(client,context,reply),{to,replyTo}=assertCustomerReplyWindow(r.payload,r.now.getTime()),id=customerOutboundId(r.event.id);
   const request={version:1,eventId:r.event.id,payloadDigest:context.payloadDigest,channelId:r.connection.id,organizationId:r.project.organizationId,to,replyTo,message:reply,channelPurpose:'KYC_CAPTURE',challengeId:r.challenge.id};
   const reservation=await reserveCustomerOutbound(client,{id,projectId:r.project.id,organizationId:r.project.organizationId,actorId:r.member.actorId,request,payloadFields:{kycCapture:true,challengeId:r.challenge.id},environment,now:r.now.getTime()});if(reservation.done)return reservation;
   const token=decryptCustomerSecret(r.connection.encryptedAccessToken,{organizationId:r.project.organizationId,projectId:r.project.id,purpose:'access-token',resourceId:r.connection.phoneNumberId},environment);
   return {...reservation,token,phoneNumberId:r.connection.phoneNumberId,to,replyTo};
  });
  if(reserved.done)return reserved.done;
  await afterReserve();await within(client=>inspect(client,context,reply));
  let state='SEND_UNKNOWN',result=null;
  try{result=await provider.sendReply({...reserved,message:reply,correlationId:reserved.id});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}
  const completed=await within(client=>completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:result?.messageId||null}));
  const {payload,...publicResult}=completed;void payload;return publicResult;
 }};
}
