import {WorkspaceError,digest} from './workspace-policy.mjs';
import {customerJobTransaction,reserveCustomerOutbound,startPendingCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {buildCustomerTemplate,customerRemoteTemplateMatches,buildParticipantOnboardingMessage,buildParticipantInvitationMessage} from './meta-customer-templates.mjs';
import {metaCustomerTransportReady,metaCustomerScopedTransportReady,customerTemplateMessage} from './meta-customer-provider.mjs';
import {prepareMetaKycChallenge,metaKycOperationId,metaKycChallengeDigest} from './meta-kyc-challenge.mjs';
import {resolveParticipantOnboardingAuthority,readOwnParticipantOnboardingAuthority} from './participant-onboarding-authority.mjs';
import {participantOnboardingIntent,participantOnboardingOutboundId,participantOnboardingPhaseOutboundId,participantOnboardingPhase,participantOnboardingPhaseState,updateParticipantOnboardingPhase,createParticipantOnboardingPhases,publicParticipantOnboarding} from './participant-onboarding-policy.mjs';
import {participantReceiptId} from './participant-policy.mjs';

const key='participant_onboarding_v1';
const recoveryOperationBudgetMs=120000;
const fail=(code='PARTICIPANT_ONBOARDING_CONTEXT_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
const safeCode=error=>error instanceof WorkspaceError&&['PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED','PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED','PARTICIPANT_ONBOARDING_PROVIDER_CLOSED','PARTICIPANT_ONBOARDING_DELIVERY_UNCONFIRMED'].includes(error.code)?error.code:'PARTICIPANT_ONBOARDING_AUTHORIZATION_REQUIRED';
const rowColumns=`w.id,w."projectId",w.phone,w.active,w.metadata,to_char(w."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
async function worker(client,projectId,workerId,{lock=false}={}){return (await client.query(`SELECT ${rowColumns} FROM public."Worker" w WHERE w.id=$1 AND w."projectId"=$2${lock?' FOR UPDATE':''}`,[workerId,projectId])).rows[0];}
async function event(client,id,projectId){return (await client.query(`SELECT id,"projectId",payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];}
const ownMarked=r=>Object.hasOwn(r.connection?.metadata||{},'ownCompany')||Object.hasOwn(r.connection?.metadata||{},'ownCompanyRuntime');
const ownBinding=(r,phase,environment)=>ownMarked(r)?readOwnParticipantOnboardingAuthority(r,phase,{environment,now:r.now.getTime()}).binding:null;
const ownEnvelope=(r,phase,environment)=>{const binding=ownBinding(r,phase,environment);return binding?{version:3,ownOnboarding:binding}:{};};
const ownPayload=request=>request.version===3?{onboardingCatalog:'OWN_COMPANY',ownOnboardingDigest:digest(request.ownOnboarding)}:{};
function approvedTemplate(r,phase=null,environment=process.env){
 const templateKey=phase==='ACCOUNT_INVITATION'?'participant_invitation':key;
 const binding=ownBinding(r,phase,environment),definition=buildCustomerTemplate(r.connection,templateKey),draft=binding?r.connection.metadata?.ownCompanyTemplateDrafts?.[templateKey]:r.connection.metadata?.customerTemplateDrafts?.[templateKey];
 if(binding&&draft?.grantDigest!==binding.grantDigest)fail('PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');
 if(!draft||draft.state!=='SUBMITTED'||draft.providerStatus!=='APPROVED'||draft.providerCategory!=='UTILITY'||draft.definition?.name!==definition.name||draft.definition?.contentSha256!==definition.contentSha256||!/^\d{5,32}$/.test(draft.providerId||'')||!Number.isSafeInteger(draft.observationRevision)||draft.observationRevision<1)fail('PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');
 return {definition,providerId:draft.providerId,stamp:digest(draft)};
}
function credential(r,environment){return decryptCustomerSecret(r.connection.encryptedAccessToken,{organizationId:r.member.organizationId,projectId:r.connection.projectId,purpose:'access-token',resourceId:r.connection.phoneNumberId},environment);}
function assertPhaseAuthority(r,intent,phase){
 const p=r.worker.metadata?.participant,d=p?.onboardingDelivery;
 if(!phase){if(d?.deliveryVersion!==undefined)fail();return;}
 if(participantOnboardingPhase(d)!==phase||digest(participantOnboardingIntent(d))!==digest(intent))fail();
 const stage=participantOnboardingPhaseState(d,phase);
 if(phase==='ACCOUNT_INVITATION'){
  const challenge=p.kycChatChallenge,closed=!challenge||['CANCELLED','CLOSED'].includes(challenge.status)||challenge.status==='COMPLETED'&&p.kyc?.status==='REJECTED';
  if(p.status!=='INVITED'||p.clerkUserId!=null||!closed||p.kycChatConversation!=null)fail();
 }else if(p.status!=='ACTIVE'||p.invitation?.state!=='ACCEPTED'||!/^user_[A-Za-z0-9]+$/.test(p.clerkUserId||'')||stage.acceptanceReceiptId!==p.acceptanceReceiptId||stage.participantClerkUserId!==p.clerkUserId)fail();
}
function decode(row,r,intent,environment,phase=null){
 if(row.payload?.participantOnboarding!==true||row.projectId!==r.connection.projectId||row.payload.organizationId!==intent.organizationId||row.payload.channelId!==r.connection.id||row.payload.targetProjectId!==intent.targetProjectId||row.payload.workerId!==intent.workerId||row.payload.invitationId!==intent.invitationId||row.payload.consentReceiptId!==intent.consentReceiptId)fail();
 let request;try{request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:intent.organizationId,projectId:r.connection.projectId,purpose:'outbound',resourceId:row.id},environment));}catch{fail();}
 if(phase){
  const isOwn=request.version===3||Object.hasOwn(request,'ownOnboarding')||Object.hasOwn(row.payload,'onboardingCatalog')||Object.hasOwn(row.payload,'ownOnboardingDigest');
  const binding=isOwn?ownBinding(r,phase,environment):null;
  if(isOwn?(!binding||request.version!==3||digest(request.ownOnboarding)!==digest(binding)||row.payload.onboardingCatalog!=='OWN_COMPANY'||row.payload.ownOnboardingDigest!==digest(binding)):ownMarked(r))fail();
  const keys=['version','phase','channelPurpose','organizationId','channelId','targetProjectId','workerId','invitationId','consentReceiptId','to','phoneNumberId','wabaId','authorityDigest','expiresAt','template','message',...(isOwn?['ownOnboarding']:[]),...(phase==='IDENTITY_START'?['challengeId','acceptanceReceiptId','participantClerkUserId']:[])];
  if(request.version!==(isOwn?3:2)||request.phase!==phase||row.payload.onboardingPhase!==phase||row.id!==participantOnboardingPhaseOutboundId(intent,phase)||Object.keys(request).sort().join('|')!==keys.sort().join('|'))fail();
 }
 if(!phase&&(ownMarked(r)||request.version!==1||Object.hasOwn(request,'ownOnboarding')||Object.hasOwn(row.payload,'onboardingCatalog')))fail();
 if(digest(request)!==row.payload.requestDigest||request.channelPurpose!=='PARTICIPANT_ONBOARDING'||request.organizationId!==intent.organizationId||request.channelId!==r.connection.id||request.targetProjectId!==intent.targetProjectId||request.workerId!==intent.workerId||request.invitationId!==intent.invitationId||request.consentReceiptId!==intent.consentReceiptId||request.to!==r.worker.phone.slice(1)||request.phoneNumberId!==r.connection.phoneNumberId||request.wabaId!==r.connection.whatsappBusinessId||request.authorityDigest!==r.authorityDigest||request.challengeId!==row.payload.challengeId)fail();
 customerTemplateMessage(request.message);
 if(phase==='ACCOUNT_INVITATION'){
  if(Object.hasOwn(row.payload,'challengeId')||Object.hasOwn(request,'challengeId')||!Number.isFinite(Date.parse(request.expiresAt))||request.expiresAt!==r.worker.metadata.participant.invitation.expiresAt||Date.parse(request.expiresAt)<=r.now.getTime()||digest(request.message)!==digest(buildParticipantInvitationMessage(r.connection,{organizationName:r.member.organizationName||r.project.organizationName})))fail();
  return request;
 }
 if(phase==='IDENTITY_START'&&(request.acceptanceReceiptId!==r.worker.metadata.participant.acceptanceReceiptId||request.participantClerkUserId!==r.worker.metadata.participant.clerkUserId))fail();
 const challenge=r.worker.metadata?.participant?.kycChatChallenge;
 if(challenge?.id!==request.challengeId||challenge.status!=='PENDING'||challenge.codeDigest!==metaKycChallengeDigest(request.message.bodyParameters[2])||challenge.connectionId!==r.connection.id||challenge.senderE164!==r.worker.phone||!Number.isFinite(Date.parse(request.expiresAt))||Date.parse(request.expiresAt)<=r.now.getTime()||challenge.expiresAt!==request.expiresAt)fail();
 return request;
}
async function projectStatus(client,intent,values,phase=null){
 const row=await worker(client,intent.targetProjectId,intent.workerId,{lock:true}),current=row?.metadata?.participant?.onboardingDelivery;
 if(!current||digest(participantOnboardingIntent(current))!==digest(intent))fail();
 const m=structuredClone(row.metadata);m.participant.onboardingDelivery=phase?updateParticipantOnboardingPhase(current,phase,values):{...current,...values};
 await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,row.projectId,JSON.stringify(m)]);
 return publicParticipantOnboarding(m.participant);
}

// One participant lifecycle intent, then the existing encrypted customer outbox.
// The only retryable phase precedes its committed SEND_STARTED marker.
export function createParticipantOnboardingDelivery({connect,provider,environment=process.env,resolveAuthority=resolveParticipantOnboardingAuthority,prepareChallenge=prepareMetaKycChallenge,afterPrepare=async()=>{},afterDispatchMarker=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run);
 const transport=(r,phase)=>{if(r&&ownMarked(r)){ownBinding(r,phase,environment);if(typeof provider.forOwnParticipantOnboarding!=='function')fail('PARTICIPANT_ONBOARDING_PROVIDER_CLOSED',503);}else if(!metaCustomerTransportReady(provider.readiness()))fail('PARTICIPANT_ONBOARDING_PROVIDER_CLOSED',503);};
 async function transportFor(r,phase,intent,template,{client=null,envelope=null}={}){
  if(!ownMarked(r)){if(envelope?.version===3||envelope?.ownOnboarding)fail();transport(r,phase);return provider;}
  transport(r,phase);
  const challenge=r.worker.metadata?.participant?.kycChatChallenge,expected={authorityDigest:r.authorityDigest,...(challenge?.status==='PENDING'?{challengeId:challenge.id}:{})};
  const fresh=async c=>{const next=await resolveAuthority(c,intent,{environment,expected});assertPhaseAuthority(next,intent,phase);const observed=approvedTemplate(next,phase,environment);if(observed.stamp!==template.stamp||digest(ownBinding(next,phase,environment))!==digest(ownBinding(r,phase,environment)))fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');return next;};
  const scoped=await provider.forOwnParticipantOnboarding({authority:r,phase,token:credential(r,environment),beforeExternal:()=>client?fresh(client):within(fresh),envelope});
  if(!metaCustomerScopedTransportReady(scoped.readiness()))fail('PARTICIPANT_ONBOARDING_PROVIDER_CLOSED',503);return scoped;
 }
 async function remoteApproval(r,template,phase,intent,options={}){
  const scoped=await transportFor(r,phase,intent,template,options),remote=await scoped.findTemplate({token:credential(r,environment),wabaId:r.connection.whatsappBusinessId,name:template.definition.name});
  if(!customerRemoteTemplateMatches(remote,template.definition)||String(remote.id)!==template.providerId||remote.status!=='APPROVED'||remote.category!=='UTILITY')fail('PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');
 }
 async function load(reference){return within(async client=>{
  const row=await worker(client,reference.projectId,reference.workerId),current=row?.metadata?.participant?.onboardingDelivery;
  if(!current)return null;const intent=participantOnboardingIntent(current);if(intent.targetProjectId!==row.projectId||intent.workerId!==row.id)fail();return {intent,current,participant:row.metadata.participant};
 });}
 async function block(intent,error,phase=null){return within(async client=>{
  // No anchor/channel lock is acquired in this status-only transaction.
  const rows=(await client.query(`SELECT ${rowColumns} FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w.id=$1 AND w."projectId"=$2 AND p."organizationId"=$3 FOR UPDATE OF w`,[intent.workerId,intent.targetProjectId,intent.organizationId])).rows;
  const delivery=rows[0]?.metadata?.participant?.onboardingDelivery,current=phase&&delivery?.deliveryVersion===2?participantOnboardingPhaseState(delivery,phase):delivery;
  if(!current||digest(participantOnboardingIntent(delivery))!==digest(intent))return {state:'BLOCKED',code:'PARTICIPANT_ONBOARDING_CONTEXT_CHANGED'};
  if(['SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED','CANCELED','REJECTED'].includes(current.state))return publicParticipantOnboarding(rows[0].metadata.participant);
  const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  return projectStatus(client,intent,{state:'BLOCKED',code:safeCode(error),nextCheckAt:new Date(now.getTime()+60000).toISOString()},phase);
 });}
 return {
  async process(reference){
   const loaded=await load(reference);if(!loaded)return {state:'NOT_REQUESTED'};
   const {intent}=loaded;let current=loaded.current,phase=participantOnboardingPhase(current);
   if(['CANCELED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED'].includes(current.state))return publicParticipantOnboarding(loaded.participant);
   try{
    const inspect=await within(async client=>{
     let inspectedPhase=phase,inspectedCurrent=current;
     let r=await resolveAuthority(client,intent,{environment,expected:current.challengeId?{authorityDigest:current.authorityDigest,challengeId:current.challengeId}:null});
     if(!ownMarked(r)||inspectedPhase)transport(r,inspectedPhase);
     // An older, never-prepared request may adopt invitation-only delivery after
     // all canonical authority has been locked. Existing envelopes/challenges and
     // every dispatch marker keep their exact v1 path and are never retagged.
     if(!inspectedPhase&&r.worker.metadata.participant.status==='INVITED'&&['WAITING_CONFIGURATION','BLOCKED'].includes(current.state)&&!current.outboundId&&!current.challengeId&&!r.worker.metadata.participant.kycChatChallenge&&!r.worker.metadata.participant.kycChatConversation){
      // The v1 marker is global, even if the current corporate anchor changed.
      // A former anchor must never hide an accepted/uncertain prior attempt.
      const old=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[participantOnboardingOutboundId(intent)])).rows[0];
      if(!old){const m=structuredClone(r.worker.metadata);m.participant.onboardingDelivery=createParticipantOnboardingPhases(m.participant.onboardingDelivery,m.participant,r.now.toISOString());await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.worker.projectId,JSON.stringify(m)]);r.worker.metadata=m;inspectedCurrent=m.participant.onboardingDelivery;inspectedPhase=participantOnboardingPhase(inspectedCurrent);if(ownMarked(r))r=await resolveAuthority(client,intent,{environment});}
     }
     transport(r,inspectedPhase);
     assertPhaseAuthority(r,intent,inspectedPhase);const template=approvedTemplate(r,inspectedPhase,environment);
     const id=inspectedPhase?participantOnboardingPhaseOutboundId(intent,inspectedPhase):participantOnboardingOutboundId(intent),stored=await event(client,id,r.connection.projectId);
     if(stored&&stored.outcome?.state!=='ONBOARDING_PENDING')return {done:await projectStatus(client,intent,{state:stored.outcome?.state||'SEND_UNKNOWN',providerStatus:stored.outcome?.providerStatus||null,nextCheckAt:null},inspectedPhase),phase:inspectedPhase,current:inspectedCurrent};
     if(stored)decode(stored,r,intent,environment,inspectedPhase);
     return {r,template,id,phase:inspectedPhase,current:inspectedCurrent};
    });phase=inspect.phase;current=inspect.current;if(inspect.done)return inspect.done;
    await remoteApproval(inspect.r,inspect.template,phase,intent);
    const queued=await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:inspect.r.authorityDigest,...(current.challengeId?{challengeId:current.challengeId}:{})}});assertPhaseAuthority(r,intent,phase);const template=approvedTemplate(r,phase,environment);
     if(template.stamp!==inspect.template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');
     const stored=await event(client,inspect.id,r.connection.projectId);
     if(stored){if(stored.outcome?.state!=='ONBOARDING_PENDING')return {done:await projectStatus(client,intent,{state:stored.outcome?.state||'SEND_UNKNOWN',providerStatus:stored.outcome?.providerStatus||null,nextCheckAt:null},phase)};return {id:stored.id,request:decode(stored,r,intent,environment,phase),template};}
     if(phase==='ACCOUNT_INVITATION'){
      const message=buildParticipantInvitationMessage(r.connection,{organizationName:r.member.organizationName||r.project.organizationName}),request={version:2,...ownEnvelope(r,phase,environment),phase,channelPurpose:'PARTICIPANT_ONBOARDING',organizationId:intent.organizationId,channelId:r.connection.id,targetProjectId:intent.targetProjectId,workerId:intent.workerId,invitationId:intent.invitationId,consentReceiptId:intent.consentReceiptId,to:r.worker.phone.slice(1),phoneNumberId:r.connection.phoneNumberId,wabaId:r.connection.whatsappBusinessId,authorityDigest:r.authorityDigest,expiresAt:r.worker.metadata.participant.invitation.expiresAt,template:{providerId:template.providerId,stamp:template.stamp,contentSha256:template.definition.contentSha256},message};
      await reserveCustomerOutbound(client,{id:inspect.id,projectId:r.connection.projectId,organizationId:intent.organizationId,actorId:intent.issuerActorId,request,eventType:'template',deferred:true,payloadFields:{participantOnboarding:true,onboardingPhase:phase,...ownPayload(request),targetProjectId:intent.targetProjectId,workerId:intent.workerId,invitationId:intent.invitationId,consentReceiptId:intent.consentReceiptId},environment,now:r.now.getTime()});
      const final=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:r.authorityDigest}});assertPhaseAuthority(final,intent,phase);
      await projectStatus(client,intent,{state:'PENDING',outboundId:inspect.id,anchorProjectId:r.connection.projectId,authorityDigest:r.authorityDigest,code:null,nextCheckAt:null},phase);return {id:inspect.id,request,template};
     }
     const operationId=metaKycOperationId(inspect.id),prepared=await prepareChallenge(client,r.member,r.project,{workerId:r.worker.id,revision:r.worker.revision,operationId},{environment});
     if(!prepared.code||prepared.codeUnavailable)fail();
     const updated=await worker(client,intent.targetProjectId,intent.workerId),challenge=updated?.metadata?.participant?.kycChatChallenge;
     if(!challenge||challenge.status!=='PENDING'||challenge.codeDigest!==metaKycChallengeDigest(prepared.code))fail();
     // Own witnesses describe exact Worker bytes. Preparing the challenge
     // changes those bytes, so resolve again before binding the new envelope.
     const preparedAuthority=ownMarked(r)?await resolveAuthority(client,intent,{environment,expected:{authorityDigest:r.authorityDigest,challengeId:challenge.id}}):r;
     if(approvedTemplate(preparedAuthority,phase,environment).stamp!==template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');
     // Keep the canonical exterior receipt that account acceptance requires.
     // This receipt, the challenge and its encrypted outbox commit together.
     if(!/^meta_kyc_challenge_[a-f0-9]{64}$/.test(prepared.receiptId||'')||prepared.expiresAt!==challenge.expiresAt)fail();
     const requestDigest=digest({action:'PREPARE_KYC_CHAT',source:'PARTICIPANT_ONBOARDING',projectId:intent.targetProjectId,workerId:intent.workerId,revision:r.worker.revision,operationId,outboundId:inspect.id});
     await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[participantReceiptId(intent.issuerActorId,intent.targetProjectId,operationId),intent.organizationId,intent.issuerActorId,intent.workerId,JSON.stringify({version:1,projectId:intent.targetProjectId,requestDigest,kind:'PREPARE_KYC_CHAT',challengeReceiptId:prepared.receiptId,expiresAt:challenge.expiresAt,source:'PARTICIPANT_ONBOARDING',outboundId:inspect.id,identityCertified:false,permissionsGranted:false})]);
     const message=buildParticipantOnboardingMessage(r.connection,{organizationName:r.member.organizationName||r.project.organizationName,invitationId:intent.invitationId,code:prepared.code});
     const request={version:phase?2:1,...ownEnvelope(preparedAuthority,phase,environment),...(phase?{phase,acceptanceReceiptId:r.worker.metadata.participant.acceptanceReceiptId,participantClerkUserId:r.worker.metadata.participant.clerkUserId}:{}),channelPurpose:'PARTICIPANT_ONBOARDING',organizationId:intent.organizationId,channelId:r.connection.id,targetProjectId:intent.targetProjectId,workerId:intent.workerId,invitationId:intent.invitationId,consentReceiptId:intent.consentReceiptId,to:r.worker.phone.slice(1),phoneNumberId:r.connection.phoneNumberId,wabaId:r.connection.whatsappBusinessId,authorityDigest:r.authorityDigest,challengeId:challenge.id,expiresAt:challenge.expiresAt,template:{providerId:template.providerId,stamp:template.stamp,contentSha256:template.definition.contentSha256},message};
     await reserveCustomerOutbound(client,{id:inspect.id,projectId:r.connection.projectId,organizationId:intent.organizationId,actorId:intent.issuerActorId,request,eventType:'template',deferred:true,payloadFields:{participantOnboarding:true,...(phase?{onboardingPhase:phase}:{}),...ownPayload(request),targetProjectId:intent.targetProjectId,workerId:intent.workerId,invitationId:intent.invitationId,consentReceiptId:intent.consentReceiptId,challengeId:challenge.id},environment,now:r.now.getTime()});
     const final=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:r.authorityDigest,challengeId:challenge.id}});assertPhaseAuthority(final,intent,phase);
     await projectStatus(client,intent,{state:'PENDING',outboundId:inspect.id,anchorProjectId:r.connection.projectId,challengeId:challenge.id,authorityDigest:r.authorityDigest,code:null,nextCheckAt:null},phase);
     return {id:inspect.id,request,template};
    });if(queued.done)return queued.done;
    await afterPrepare();
    // Refresh Meta's exact owned definition before marking the attempt.
    const before=await within(async client=>{const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:queued.request.authorityDigest,...(queued.request.challengeId?{challengeId:queued.request.challengeId}:{})}});assertPhaseAuthority(r,intent,phase);const template=approvedTemplate(r,phase,environment);if(template.stamp!==queued.request.template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');return {r,template};});
    await remoteApproval(before.r,before.template,phase,intent);
    const started=await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:queued.request.authorityDigest,...(queued.request.challengeId?{challengeId:queued.request.challengeId}:{})}});assertPhaseAuthority(r,intent,phase);const stored=await event(client,queued.id,r.connection.projectId),request=decode(stored,r,intent,environment,phase);
     if(approvedTemplate(r,phase,environment).stamp!==request.template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');
     if(ownMarked(r))await remoteApproval(r,approvedTemplate(r,phase,environment),phase,intent,{client});
     transport(r,phase);const reservation=await startPendingCustomerOutbound(client,{id:stored.id,projectId:r.connection.projectId,requestDigest:stored.payload.requestDigest,now:r.now.getTime()});
     if(reservation.done)return {done:await projectStatus(client,intent,{state:reservation.done.state,providerStatus:reservation.done.providerStatus,nextCheckAt:null},phase)};
     await projectStatus(client,intent,{state:'SEND_STARTED',code:null,nextCheckAt:null},phase);return reservation;
    });if(started.done)return started.done;
    await afterDispatchMarker();
    return await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:queued.request.authorityDigest,...(queued.request.challengeId?{challengeId:queued.request.challengeId}:{})}});assertPhaseAuthority(r,intent,phase);const stored=await event(client,queued.id,r.connection.projectId),request=decode(stored,r,intent,environment,phase);
     if(stored.outcome?.state!=='SEND_STARTED'||approvedTemplate(r,phase,environment).stamp!==request.template.stamp)fail();
     transport(r,phase);let state='SEND_UNKNOWN',result=null;
     const final=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:request.authorityDigest,...(request.challengeId?{challengeId:request.challengeId}:{})}});assertPhaseAuthority(final,intent,phase);
     const scoped=await transportFor(final,phase,intent,approvedTemplate(final,phase,environment),{client,envelope:request});
     try{result=await scoped.sendTemplate({token:credential(final,environment),phoneNumberId:final.connection.phoneNumberId,to:request.to,message:request.message,correlationId:stored.id});if(!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(result?.messageId||''))fail('PARTICIPANT_ONBOARDING_DELIVERY_UNCONFIRMED',503);state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';else result=null;}
     const completed=await completeCustomerOutbound(client,{...started,state,messageId:result?.messageId||null,now:r.now.getTime()});
     return projectStatus(client,intent,{state:completed.state,providerStatus:completed.providerStatus||null,code:null,nextCheckAt:null},phase);
    });
   }catch(error){return block(intent,error,phase);}
  },
  async recover({limit=3,budgetMs=210000}={}){
   if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isInteger(budgetMs)||budgetMs<0||budgetMs>240000)fail('PARTICIPANT_ONBOARDING_INPUT_INVALID',400);
   if(budgetMs<recoveryOperationBudgetMs)return {checked:0,results:[],deferred:true};
   const refs=await within(async client=>(await client.query(`SELECT w.id AS "workerId",w."projectId" AS "projectId" FROM public."Worker" w WHERE w.active=true AND w.metadata->'participant'->'invitation'->>'state' IN ('SENT','ACCEPTED') AND w.metadata->'participant'->'onboardingDelivery'->>'state' IN ('WAITING_CONFIGURATION','BLOCKED','PENDING') AND (w.metadata->'participant'->'onboardingDelivery'->>'nextCheckAt' IS NULL OR w.metadata->'participant'->'onboardingDelivery'->>'nextCheckAt'<=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY w."updatedAt",w.id LIMIT $1`,[limit])).rows);
   const started=Date.now(),results=[];for(const ref of refs){if(Date.now()-started>budgetMs-recoveryOperationBudgetMs)break;results.push(await this.process(ref));}return {durable:true,checked:results.length,results};
  },
 };
}

// Participant reads use the outbox as the source for delivery/ACK status. The
// projection contains no phone, code, ciphertext, token, or permission grant.
export async function readParticipantOnboardingStatuses(client,records,organizationId,projectId){
 for(const row of records){const delivery=row.metadata?.participant?.onboardingDelivery;if(!delivery)continue;
  const selected=participantOnboardingPhase(delivery),phases=selected?['ACCOUNT_INVITATION','IDENTITY_START']:[null];
  for(const phase of phases){const current=phase?participantOnboardingPhaseState(row.metadata.participant.onboardingDelivery,phase):row.metadata.participant.onboardingDelivery;if(!current?.outboundId)continue;
   const found=(await client.query(`SELECT id,"projectId",payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[current.outboundId,current.anchorProjectId])).rows[0];
   if(!found||found.payload?.participantOnboarding!==true||found.payload.organizationId!==organizationId||found.payload.targetProjectId!==projectId||found.payload.workerId!==row.id||found.payload.invitationId!==delivery.invitationId||found.payload.consentReceiptId!==delivery.consentReceiptId||phase&&(found.payload.onboardingPhase!==phase||found.id!==participantOnboardingPhaseOutboundId(participantOnboardingIntent(delivery),phase)))continue;
   if(current.state==='CANCELED'&&found.outcome?.state==='ONBOARDING_PENDING')continue;
   row.metadata=structuredClone(row.metadata);const values={state:found.outcome?.state==='ONBOARDING_PENDING'?'PENDING':found.outcome?.state||'SEND_UNKNOWN',providerStatus:found.outcome?.providerStatus||null};
   row.metadata.participant.onboardingDelivery=phase?updateParticipantOnboardingPhase(row.metadata.participant.onboardingDelivery,phase,values):{...current,...values};
  }
 }
}
