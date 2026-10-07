import {WorkspaceError,digest} from './workspace-policy.mjs';
import {customerJobTransaction,customerOutboundId,assertCustomerReplyWindow,reserveCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {resolveMetaKycAuthority} from './meta-kyc-identity.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {resolveEmployeeIntakeAuthority} from './meta-employee-intake.mjs';

// Shares the canonical reservation/delivery lane, with a narrower fixed-prompt
// authority. The supplied reply must equal a sealed KYC dispatch receipt.
export function createMetaKycOutbound({connect,provider,environment=process.env,resolveAuthority=resolveMetaKycAuthority,resolveIntake=resolveEmployeeIntakeAuthority,afterReserve=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run);
 const inspect=async(client,context,reply,purpose)=>{
  const intake=purpose==='EMPLOYEE_INTAKE';
  const r=await (intake?resolveIntake:resolveAuthority)(client,context,{outbound:true,environment});
  if(r?.kind!==(intake?'LIMITED_PARTICIPANT_INTAKE':'LIMITED_KYC_UPLOAD')||!r.recorded?.reply||digest(r.recorded.reply)!==digest(reply))throw new WorkspaceError(intake?'EMPLOYEE_INTAKE_INTEGRITY':'META_KYC_CHALLENGE_REJECTED',409);
  return r;
 };
 return {async send(context,reply,{purpose='KYC_CAPTURE'}={}){
  if(!['KYC_CAPTURE','EMPLOYEE_INTAKE'].includes(purpose))throw new WorkspaceError('META_KYC_CHALLENGE_REJECTED',409);
  const reserved=await within(async client=>{
   const r=await inspect(client,context,reply,purpose),{to,replyTo}=assertCustomerReplyWindow(r.payload,r.now.getTime()),id=customerOutboundId(r.event.id);
   const intake=purpose==='EMPLOYEE_INTAKE',identity=intake?{applicationId:r.anchor.id}:{challengeId:r.challenge.id};
   const request={version:1,eventId:r.event.id,payloadDigest:context.payloadDigest,channelId:r.connection.id,organizationId:r.project.organizationId,to,replyTo,message:reply,channelPurpose:purpose,...identity};
   const reservation=await reserveCustomerOutbound(client,{id,projectId:r.connection.projectId,organizationId:r.project.organizationId,actorId:r.member.actorId,request,payloadFields:{...(intake?{employeeIntake:true}:{kycCapture:true}),...identity},environment,now:r.now.getTime()});if(reservation.done)return reservation;
   const token=decryptCustomerSecret(r.connection.encryptedAccessToken,{organizationId:r.project.organizationId,projectId:r.project.id,purpose:'access-token',resourceId:r.connection.phoneNumberId},environment);
   return {...reservation,token,phoneNumberId:r.connection.phoneNumberId,to,replyTo};
  });
  if(reserved.done)return reserved.done;
  await afterReserve();
  let state='SEND_UNKNOWN',result=null;
  const send=async()=>{try{result=await provider.sendReply({...reserved,message:reply,correlationId:reserved.id});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}};
  if(purpose==='EMPLOYEE_INTAKE')await within(async client=>{await inspect(client,context,reply,purpose);await send();});
  else {await within(client=>inspect(client,context,reply,purpose));await send();}
  const completed=await within(async client=>{if(purpose==='EMPLOYEE_INTAKE')await inspect(client,context,reply,purpose);return completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:result?.messageId||null});});
  const {payload,...publicResult}=completed;void payload;return publicResult;
 }};
}
