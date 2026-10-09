import {WorkspaceError,digest} from './workspace-policy.mjs';
import {customerJobTransaction,customerOutboundId,assertCustomerReplyWindow,reserveCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {resolveMetaKycAuthority} from './meta-kyc-identity.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {companyKycProjectionDigest,fenceCompanyKycAuthority} from './company-channel-kyc.mjs';
import {resolveEmployeeIntakeAuthority,hasEmployeeIntakeOutboundAuthority,employeeIntakeOutboundDeadline,fenceEmployeeIntakeOutboundAuthority,releaseEmployeeIntakeOutboundAuthority} from './meta-employee-intake.mjs';
import {lockOwnCompanyIssuer,ownCompanyCapabilityKind,ownCompanyTransportPolicy,fenceOwnCompanyRuntime,compactOwnCompanyRuntimeFence,restrictOwnCompanyRuntimeCapability} from './meta-own-company-policy.mjs';

// Shares the canonical reservation/delivery lane, with a narrower fixed-prompt
// authority. The supplied reply must equal a sealed KYC dispatch receipt.
export function createMetaKycOutbound({connect,provider,environment=process.env,resolveAuthority=resolveMetaKycAuthority,resolveIntake=resolveEmployeeIntakeAuthority,afterReserve=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run);
 const inspect=async(client,context,reply,purpose)=>{
  const intake=purpose==='EMPLOYEE_INTAKE';
  const r=await (intake?resolveIntake:resolveAuthority)(client,context,{outbound:true,environment});
  if(r?.kind!==(intake?'LIMITED_PARTICIPANT_INTAKE':'LIMITED_KYC_UPLOAD')||!r.recorded?.reply||digest(r.recorded.reply)!==digest(reply))throw new WorkspaceError(intake?'EMPLOYEE_INTAKE_INTEGRITY':'META_KYC_CHALLENGE_REJECTED',409);
   r.ownCompanyCapability=await lockOwnCompanyIssuer(client,r.connection,{environment,now:r.now.getTime()});return r;
 };
 return {async send(context,reply,{purpose='KYC_CAPTURE'}={}){
  if(!['KYC_CAPTURE','EMPLOYEE_INTAKE'].includes(purpose))throw new WorkspaceError('META_KYC_CHALLENGE_REJECTED',409);
  const reserved=await within(async client=>{
   const r=await inspect(client,context,reply,purpose),{to,replyTo}=assertCustomerReplyWindow(r.payload,r.now.getTime()),id=customerOutboundId(r.event.id);
   const intake=purpose==='EMPLOYEE_INTAKE',identity=intake?{applicationId:r.anchor.id}:{challengeId:r.challenge.id};
   const request={version:1,eventId:r.event.id,payloadDigest:context.payloadDigest,channelId:r.connection.id,organizationId:r.project.organizationId,to,replyTo,message:reply,channelPurpose:purpose,...identity,...(r.recorded?.reactiveOnboarding?{reactiveOnboarding:r.recorded.reactiveOnboarding}:{}),...(r.companyKyc?{targetProjectId:r.project.id,companyKycDigest:companyKycProjectionDigest(r.companyKyc)}:{})};
   const reservation=await reserveCustomerOutbound(client,{id,projectId:r.connection.projectId,organizationId:r.project.organizationId,actorId:r.member.actorId,request,payloadFields:{...(intake?{employeeIntake:true}:{kycCapture:true}),...identity},environment,now:r.now.getTime()});if(reservation.done){releaseEmployeeIntakeOutboundAuthority(r);return reservation;}
   await fenceCompanyKycAuthority(client,r,context);
   const token=decryptCustomerSecret(r.connection.encryptedAccessToken,{organizationId:r.project.organizationId,projectId:r.companyKyc?r.connection.projectId:r.project.id,purpose:'access-token',resourceId:r.connection.phoneNumberId},environment);
   releaseEmployeeIntakeOutboundAuthority(r);return {...reservation,corporate:Boolean(r.companyKyc),token,phoneNumberId:r.connection.phoneNumberId,connection:r.connection,ownCompanyCapability:r.ownCompanyCapability,to,replyTo};
  });
  if(reserved.done)return reserved.done;
  await afterReserve();
  const runtime=ownCompanyCapabilityKind(reserved.ownCompanyCapability)==='RUNTIME';
  const scope=async(client,locked=null)=>{
   const compact=runtime&&purpose==='EMPLOYEE_INTAKE'&&hasEmployeeIntakeOutboundAuthority(client,locked);
   const notAfter=compact?employeeIntakeOutboundDeadline(client,locked):null;
   const beforeExternal=runtime?async()=>{if(compact){const time=await fenceEmployeeIntakeOutboundAuthority(client,locked,context);return compactOwnCompanyRuntimeFence(client,reserved.connection,{environment,now:time.getTime(),notAfter});}const current=await inspect(client,context,reply,purpose);try{assertCustomerReplyWindow(current.payload,current.now.getTime());await fenceCompanyKycAuthority(client,current,context);return await fenceOwnCompanyRuntime(client,reserved.connection,{environment,now:current.now.getTime()});}finally{releaseEmployeeIntakeOutboundAuthority(current);}}:undefined;
   // A fresh capability is accepted only after the complete current resolver
   // and forConnection's exact comparison with the original grant/credential.
   const capability=locked?.ownCompanyCapability||reserved.ownCompanyCapability;
   return reserved.connection?.metadata?.ownCompany||Object.hasOwn(reserved.connection?.metadata||{},'ownCompanyRuntime')?provider.forConnection({capability:compact?restrictOwnCompanyRuntimeCapability(capability,notAfter):capability,connection:reserved.connection,token:reserved.token,...(beforeExternal?{beforeExternal}:{})}):provider;
  };
  const scopedProvider=runtime?null:await scope();
  let state='SEND_UNKNOWN',result=null;
  const send=async scoped=>{try{result=await scoped.sendReply({...reserved,message:reply,correlationId:reserved.id});state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}};
  // The runtime provider's fresh fence shares the canonical resolver client.
  // Opening another transaction here would wait on our own Project UPDATE.
  if(runtime||purpose==='EMPLOYEE_INTAKE'||reserved.corporate)await within(async client=>{const r=await inspect(client,context,reply,purpose);try{await send(runtime?await scope(client,r):scopedProvider);await fenceCompanyKycAuthority(client,r,context);}finally{releaseEmployeeIntakeOutboundAuthority(r);}});
  else {await within(client=>inspect(client,context,reply,purpose));await send(scopedProvider);}
  const completed=await within(async client=>{const r=purpose==='EMPLOYEE_INTAKE'||reserved.corporate?await inspect(client,context,reply,purpose):null;try{const completedResult=await completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:result?.messageId||null});if(r){await fenceCompanyKycAuthority(client,r,context);if(runtime&&hasEmployeeIntakeOutboundAuthority(client,r)){const time=await fenceEmployeeIntakeOutboundAuthority(client,r,context);ownCompanyTransportPolicy(r.ownCompanyCapability,environment,time.getTime());}}return completedResult;}finally{if(r)releaseEmployeeIntakeOutboundAuthority(r);}});
  const {payload,...publicResult}=completed;void payload;return publicResult;
 }};
}
