import {WorkspaceError,digest} from './workspace-policy.mjs';
import {lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';
import {beginMetaKycConversation,planMetaKycConversation} from './meta-kyc-conversation.mjs';
import {metaKycOperationId} from './meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,metaKycDispatchReceiptId,metaKycConversationEnvelope,sealMetaKycValue,metaKycExpiryBindingDigest} from './meta-kyc-identity.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {decodePrivateImage,MAX_PRIVATE_IMAGE_BYTES} from './private-image-upload.mjs';
import {companyKycProjectionDigest,fenceCompanyKycAuthority} from './company-channel-kyc.mjs';
import {createEmployeeIntakeBridge} from './meta-employee-intake.mjs';
import {participantOcrNotice,participantBiometricNotice,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION} from './participant-analysis-consent.mjs';
import {participantIdentityUrl} from './participant-kyc-chat-copy.mjs';
import {recordCurrentImageContext,assertCurrentImageBytes} from './meta-kyc-current-image.mjs';
import {captureQualityFeedback} from './capture-quality-policy.mjs';


const text=body=>({type:'text',body});
const replyResult=(reply,extra={})=>({kind:'KYC_CHAT',identityStatus:'LIMITED_KYC_UPLOAD',reviewState:'OBSERVED',businessApplied:false,replySent:false,reply,...extra});
export function createMetaKycBridge({connect,provider,deposit,scheduleAnalysis=()=>{},environment=process.env,resolveAuthority=resolveMetaKycAuthority}){
 const intake=createEmployeeIntakeBridge({connect,environment});
 const within=run=>customerJobTransaction(connect,run),resolve=(client,context,options={})=>resolveAuthority(client,context,{...options,environment});
 async function record(client,r,result,state,transition=null,{preserveConversation=false}={}){
  const current=(await client.query(`SELECT metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id])).rows[0];
  if(current?.metadata?.participant?.kycChatChallenge?.id!==r.challenge.id)throw new WorkspaceError('META_KYC_CHALLENGE_REVOKED',409);
  const challenge={...current.metadata.participant.kycChatChallenge,...transition,messageCount:(current.metadata.participant.kycChatChallenge.messageCount||0)+1};r.challenge=challenge;
  await recordCurrentImageContext(client,r,state,environment);
  const feedbackBindingDigest=transition?.status==='CLAIMED'&&challenge.captureImageSetVersion===2&&!r.companyKyc?await metaKycExpiryBindingDigest(client,r):null;
  const metadata={...current.metadata,participant:{...current.metadata.participant,kycChatChallenge:challenge,kycChatConversation:preserveConversation?current.metadata.participant.kycChatConversation:metaKycConversationEnvelope(r,state,environment)}};
  // Only a technical reply for the same frozen v3 submission preserves its revision.
  const technicalStatus=preserveConversation===true&&r.challenge.analysisConsentVersion===3&&r.state?.step==='FINALIZING'&&result.businessApplied===false;
  if(technicalStatus)await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(metadata)]);
  else await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(metadata)]);
  const id=metaKycDispatchReceiptId(r.event.id);
  await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.dispatched','Worker',$4,$5::jsonb)`,[id,r.project.organizationId,r.member.actorId,r.worker.id,JSON.stringify({version:1,projectId:r.project.id,challengeId:r.challenge.id,payloadDigest:r.event.payload.payloadDigest,...(r.challenge.captureImageSetVersion===2?{captureImageSetVersion:2}:{}),...(feedbackBindingDigest?{feedbackBindingDigest}:{}),replyDigest:digest(result.reply),encryptedResult:sealMetaKycValue(r,'kyc-chat-dispatch',id,result,environment),identityCertified:false,permissionsGranted:false})]);
  await fenceCompanyKycAuthority(client,r,{eventId:r.event.id,projectId:r.connection.projectId,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,leaseToken:r.event.leaseToken},{environment});
  if(feedbackBindingDigest||technicalStatus)await resolveMetaKycAuthority(client,{eventId:r.event.id,projectId:r.connection.projectId,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,leaseToken:r.event.leaseToken},{environment});
  return result;
 }
 async function prepare(context){return within(async client=>{
  const r=await resolve(client,context);if(r.recorded)return {result:r.recorded};
  if(r.challenge.analysisConsentVersion===3&&r.worker.metadata.participant.status!=='ACTIVE')return {result:await record(client,r,replyResult(text('Antes de presentar identidad, aceptá la invitación recibida por correo e ingresá con esa cuenta en '+participantIdentityUrl(r.project.id)+'. Después pedile al responsable un código vigente. Conservamos cualquier intento anterior; no envíes fotos ni repitas la comparación desde este mensaje.')),r.state,null,{preserveConversation:true})};
  if(r.state?.step==='FINALIZING'&&r.state.confirmationEventId===r.event.id){await resolve(client,context,{deposit:true});if(!r.companyKyc)await client.query(`UPDATE public."WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '180 seconds' WHERE id=$1 AND "leaseToken"=$2`,[r.event.id,context.leaseToken]);return {deposit:true};}
  if(['COMPLETED','CANCELLED'].includes(r.challenge.status))throw new WorkspaceError('META_KYC_NOT_APPLICABLE',409);
   if(r.challenge.status==='PENDING'&&r.state)throw new WorkspaceError('META_KYC_CHALLENGE_REJECTED',409);
   const plan=r.challenge.status==='PENDING'?beginMetaKycConversation(r.event.id,{captureImageSetVersion:r.challenge.captureImageSetVersion,analysisConsentVersion:r.challenge.analysisConsentVersion===3?3:2}):planMetaKycConversation({message:r.payload.value,state:r.state,eventId:r.event.id});
  if(plan.checkFacial)return {facialStatus:true};
  if(plan.deposit){
   const metadata={...r.worker.metadata,participant:{...r.worker.metadata.participant,kycChatConversation:metaKycConversationEnvelope(r,plan.state,environment)}};
   await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(metadata)]);
   if(!r.companyKyc)await client.query(`UPDATE public."WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '180 seconds' WHERE id=$1 AND "leaseToken"=$2`,[r.event.id,context.leaseToken]);
   await fenceCompanyKycAuthority(client,r,context,{environment});
   return {deposit:true};
  }
   const transition=plan.cancelled?{status:'CANCELLED',cancelledEventId:r.event.id}:r.challenge.status==='PENDING'?{status:'CLAIMED',analysisConsentVersion:r.challenge.analysisConsentVersion===3?3:2,claimedAt:r.now.toISOString(),claimedEventId:r.event.id}:null;
  return {result:await record(client,r,replyResult(plan.reply),plan.state,transition,{preserveConversation:plan.preserveConversation===true})};
 });}
 async function recordFacialStatus(context,original,outcome){return within(async client=>{
  const r=await resolve(client,context);if(r.recorded)return r.recorded;
  if(r.challenge.analysisConsentVersion!==3||digest(r.state)!==digest(original))throw new WorkspaceError('META_KYC_COMPANY_AUTHORITY_CHANGED',409);
  if(!outcome||outcome.state!=='FACIAL_PRECOMMIT'||outcome.saved!==false||outcome.definitive!==false||!outcome.facial)throw new WorkspaceError('PARTICIPANT_FACIAL_STATUS_UNCONFIRMED',503);
  const phase=outcome.facial.phase;
  if(['PREPARING','READY'].includes(phase)&&r.state.step==='FINALIZING')return record(client,r,replyResult(text('La presentación sigue en curso. Conservamos el mismo intento; no repetimos la comparación ni iniciamos otra presentación. Escribí ESTADO para comprobarla.')),r.state,null,{preserveConversation:true});
  const next={...r.state,step:'FACIAL_RECOVERY',facialRecovery:{operationId:outcome.operationId,...outcome.facial}};delete next.nonce;delete next.choices;
  const plan=planMetaKycConversation({message:{type:'text',text:{body:'CONSULTAR'}},state:next,eventId:r.event.id});
  return record(client,r,replyResult(plan.reply),plan.state);
 });}
 return {executeIntake:context=>intake.execute(context),async execute(context){
  let prepared;try{prepared=await prepare(context);}catch(error){if(error.code==='META_KYC_NOT_APPLICABLE')return null;throw error;}
  if(prepared.result)return prepared.result;
  const authorized=await within(client=>resolve(client,context,{deposit:!prepared.facialStatus})),state=authorized.state;
  // A committed deposit is recovered with current signed authority before I/O.
  let outcome;
  const precommit=state.biometricNoticeVersion===PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION;
  if(precommit){if(typeof deposit.facialStatus!=='function')throw new WorkspaceError('PARTICIPANT_CHANNEL_ADAPTER_INVALID',503);outcome=await deposit.facialStatus(context);if(outcome?.state==='FACIAL_PRECOMMIT')return recordFacialStatus(context,state,outcome);if(prepared.facialStatus&&!outcome)return within(async client=>{const r=await resolve(client,context);if(digest(r.state)!==digest(state))throw new WorkspaceError('META_KYC_COMPANY_AUTHORITY_CHANGED',409);return record(client,r,replyResult(text('Todavía no se confirmó el estado del mismo intento. Conservamos las referencias; no repetimos la comparación. Volvé a consultar ESTADO.')),r.state,null,{preserveConversation:true});});}
  if(!precommit&&state.captureImageSetVersion===2){if(typeof deposit.recover!=='function')throw new WorkspaceError('PARTICIPANT_CHANNEL_ADAPTER_INVALID',503);outcome=await deposit.recover(context);}
  if(!outcome){
  const token=decryptCustomerSecret(authorized.connection.encryptedAccessToken,{organizationId:authorized.project.organizationId,projectId:authorized.companyKyc?authorized.connection.projectId:authorized.project.id,purpose:'access-token',resourceId:authorized.connection.phoneNumberId},environment);
   const ownCompanyCapability=await within(client=>lockOwnCompanyIssuer(client,authorized.connection,{environment}));
   const own=authorized.connection.metadata?.ownCompany||Object.hasOwn(authorized.connection.metadata||{},'ownCompanyRuntime');
   const beforeExternal=authorized.companyKyc||own||state.captureImageSetVersion===2||precommit?()=>within(async client=>{const current=await resolve(client,context,{deposit:true});await lockOwnCompanyIssuer(client,authorized.connection,{environment});if(authorized.connection.encryptedAccessToken!==current.connection.encryptedAccessToken||authorized.companyKyc&&(!current.companyKyc||companyKycProjectionDigest(current.companyKyc)!==companyKycProjectionDigest(authorized.companyKyc))||digest(current.state)!==digest(state))throw new WorkspaceError('META_KYC_COMPANY_AUTHORITY_CHANGED',409);}):undefined;
   const scopedProvider=own?await provider.forConnection({capability:ownCompanyCapability,connection:authorized.connection,token,beforeExternal}):provider;
  const images={};
  try{for(const key of ['front','selfie',...(state.captureImageSetVersion===2?['back']:[])]){
    const reference=state[key],downloaded=await scopedProvider.downloadMedia({token,phoneNumberId:authorized.connection.phoneNumberId,mediaId:reference.mediaId,limit:MAX_PRIVATE_IMAGE_BYTES,...(beforeExternal?{beforeExternal}:{})});
   const contentType=downloaded.contentType?.split(';')[0].trim(),encoded='data:'+contentType+';base64,'+Buffer.from(downloaded.bytes).toString('base64');
   if(contentType!==reference.contentType)throw new WorkspaceError('META_KYC_MEDIA_INTEGRITY',409);decodePrivateImage(encoded,contentType);
   if(authorized.companyKyc)await within(async client=>{const current=await resolve(client,context,{deposit:true});await assertCurrentImageBytes(client,current,reference,downloaded.bytes,environment);});
   images[key]=encoded;
  }}catch(error){
   if(!['META_KYC_MEDIA_INTEGRITY','META_CUSTOMER_MEDIA_INTEGRITY','META_CUSTOMER_MEDIA_REJECTED','META_CUSTOMER_PROVIDER_REJECTED','PRIVATE_IMAGE_INVALID','PRIVATE_IMAGE_TOO_LARGE','PRIVATE_IMAGE_TYPE_MISMATCH'].includes(error.code))throw error;
   return within(async client=>{const r=await resolve(client,context,{deposit:true});if(r.recorded)return r.recorded;return record(client,r,replyResult(text('No pudimos validar las imágenes. No se presentó la identidad. Volvé a enviar el frente del documento como imagen nítida de hasta 2 MB; '+(r.state.captureImageSetVersion===2?'después pediremos el dorso y una selfie nueva.':'después pediremos una selfie nueva.')+' Escribí CANCELAR para terminar.')),{...r.state,step:'FRONT',front:null,selfie:null,...(r.state.captureImageSetVersion===2?{back:null}:{}),confirmationEventId:null});});
  }
   if(beforeExternal)await beforeExternal();
   try{outcome=await deposit.deposit(context,{operationId:metaKycOperationId(context.eventId),noticeVersion:state.noticeVersion,noticeSha256:state.noticeSha256,consent:state.consent,ocrConsent:state.ocrConsent,ocrNoticeVersion:state.ocrNoticeVersion,biometricConsent:state.biometricConsent,biometricNoticeVersion:state.biometricNoticeVersion,...(precommit?{biometricMode:state.biometricMode,...(state.biometricManualFromOperationId?{biometricManualFromOperationId:state.biometricManualFromOperationId}:{})}:{}),...(state.captureImageSetVersion===2?{captureImageSetVersion:2,backConsent:state.backConsent,backNoticeVersion:state.backNoticeVersion,backNoticeSha256:state.backNoticeSha256}:{}),...images});}
   catch(error){
    const feedback=error instanceof WorkspaceError&&[422,503].includes(error.status)?captureQualityFeedback(error.code):null,field=feedback&&({DOCUMENT_FRONT:'front',DOCUMENT_BACK:'back',SELFIE:'selfie'})[feedback.kind];
    if(!feedback||!state[field]||field==='back'&&state.captureImageSetVersion!==2){if(precommit){const status=await deposit.facialStatus(context);if(status?.state==='FACIAL_PRECOMMIT')return recordFacialStatus(context,state,status);}throw error;}
    return within(async client=>{
     const r=await resolve(client,context,{deposit:true});if(r.recorded)return r.recorded;
     if(digest(r.state)!==digest(state))throw new WorkspaceError('META_KYC_COMPANY_AUTHORITY_CHANGED',409);
     const unavailable=error.status===503||feedback.reason==='QUALITY_SERVICE_UNAVAILABLE',next={...r.state,confirmationEventId:null};delete next.nonce;delete next.choices;
     if(unavailable)next.step='CONFIRM';
     else if(field==='front'){next.step='FRONT';next.front=null;next.selfie=null;if(next.captureImageSetVersion===2)next.back=null;}
     else if(field==='back'){next.step='BACK';next.back=null;next.selfie=null;}
     else {next.step='SELFIE';next.selfie=null;}
     const plan=planMetaKycConversation({message:{type:'text',text:{body:'ESTADO'}},state:next,eventId:r.event.id}),message=unavailable?captureQualityFeedback('PARTICIPANT_CAPTURE_'+feedback.kind+'_QUALITY_SERVICE_UNAVAILABLE').message:feedback.message;
     return record(client,r,replyResult({...plan.reply,body:message+'\n\n'+plan.reply.body}),plan.state);
    });
   }
  }
   const completed=await within(async client=>{
   const r=await resolve(client,context,{deposit:!prepared.facialStatus});if(r.recorded)return r.recorded;
   const invited=r.worker.metadata.participant.status==='INVITED',identityUrl=participantIdentityUrl(r.project.id);
    const automatic=(state.ocrConsent&&participantOcrNotice(state.ocrNoticeVersion)?.automatic)||(state.biometricConsent&&participantBiometricNotice(state.biometricNoticeVersion)?.automatic);
   const result=replyResult(text(outcome.superseded?'El recibo original quedó confirmado. Existe una presentación más reciente; consultá su estado vigente en '+identityUrl+'. No habilitamos permisos.':invited?''+(state.captureImageSetVersion===2?'Frente, dorso y selfie':'Documento y selfie')+' presentados en privado. Falta la aceptación verificada de la cuenta antes de la revisión y la vinculación operativa. Aceptá la invitación recibida por correo y continuá en '+identityUrl+'. No habilitamos permisos.':''+(state.captureImageSetVersion===2?'Frente, dorso y selfie':'Documento y selfie')+' presentados en privado. Un responsable debe revisar tu identidad antes de vincular WhatsApp. Consultá el estado en '+identityUrl+'. No habilitamos permisos.'),{businessApplied:true,receiptId:outcome.receiptId||null,reviewState:'RECORDED'});
    if(automatic&&!outcome.superseded)result.reply.body+=' El análisis asistido autorizado se procesará automáticamente. Si el servicio no está disponible, quedará pendiente; no aprueba tu identidad ni concede permisos.';
    return record(client,r,result,r.state,{status:'COMPLETED',completedAt:r.now.toISOString(),completionEventId:r.event.id});

  });
   if(!outcome.superseded&&outcome.submissionId)try{Promise.resolve(scheduleAnalysis({projectId:authorized.project.id,workerId:authorized.worker.id,submissionId:outcome.submissionId})).catch(()=>{});}catch{}
   return completed;
 }};
}
