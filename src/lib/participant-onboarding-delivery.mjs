import {WorkspaceError,digest} from './workspace-policy.mjs';
import {customerJobTransaction,reserveCustomerOutbound,startPendingCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {buildCustomerTemplate,customerRemoteTemplateMatches,buildParticipantOnboardingMessage} from './meta-customer-templates.mjs';
import {metaCustomerTransportReady,customerTemplateMessage} from './meta-customer-provider.mjs';
import {prepareMetaKycChallenge,metaKycOperationId,metaKycChallengeDigest} from './meta-kyc-challenge.mjs';
import {resolveParticipantOnboardingAuthority} from './participant-onboarding-authority.mjs';
import {participantOnboardingIntent,participantOnboardingOutboundId,publicParticipantOnboarding} from './participant-onboarding-policy.mjs';
import {participantReceiptId} from './participant-policy.mjs';

const key='participant_onboarding_v1';
const recoveryOperationBudgetMs=120000;
const fail=(code='PARTICIPANT_ONBOARDING_CONTEXT_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
const safeCode=error=>error instanceof WorkspaceError&&['PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED','PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED','PARTICIPANT_ONBOARDING_PROVIDER_CLOSED','PARTICIPANT_ONBOARDING_DELIVERY_UNCONFIRMED'].includes(error.code)?error.code:'PARTICIPANT_ONBOARDING_AUTHORIZATION_REQUIRED';
const rowColumns=`w.id,w."projectId",w.phone,w.active,w.metadata,to_char(w."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
async function worker(client,projectId,workerId){return (await client.query(`SELECT ${rowColumns} FROM public."Worker" w WHERE w.id=$1 AND w."projectId"=$2`,[workerId,projectId])).rows[0];}
async function event(client,id,projectId){return (await client.query(`SELECT id,"projectId",payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];}
function approvedTemplate(r){
 const definition=buildCustomerTemplate(r.connection,key),draft=r.connection.metadata?.customerTemplateDrafts?.[key];
 if(!draft||draft.state!=='SUBMITTED'||draft.providerStatus!=='APPROVED'||draft.providerCategory!=='UTILITY'||draft.definition?.name!==definition.name||draft.definition?.contentSha256!==definition.contentSha256||!/^\d{5,32}$/.test(draft.providerId||'')||!Number.isSafeInteger(draft.observationRevision)||draft.observationRevision<1)fail('PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');
 return {definition,providerId:draft.providerId,stamp:digest(draft)};
}
function credential(r,environment){return decryptCustomerSecret(r.connection.encryptedAccessToken,{organizationId:r.member.organizationId,projectId:r.connection.projectId,purpose:'access-token',resourceId:r.connection.phoneNumberId},environment);}
function decode(row,r,intent,environment){
 if(row.payload?.participantOnboarding!==true||row.projectId!==r.connection.projectId||row.payload.organizationId!==intent.organizationId||row.payload.channelId!==r.connection.id||row.payload.targetProjectId!==intent.targetProjectId||row.payload.workerId!==intent.workerId||row.payload.invitationId!==intent.invitationId||row.payload.consentReceiptId!==intent.consentReceiptId)fail();
 let request;try{request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:intent.organizationId,projectId:r.connection.projectId,purpose:'outbound',resourceId:row.id},environment));}catch{fail();}
 if(digest(request)!==row.payload.requestDigest||request.version!==1||request.channelPurpose!=='PARTICIPANT_ONBOARDING'||request.organizationId!==intent.organizationId||request.channelId!==r.connection.id||request.targetProjectId!==intent.targetProjectId||request.workerId!==intent.workerId||request.invitationId!==intent.invitationId||request.consentReceiptId!==intent.consentReceiptId||request.to!==r.worker.phone.slice(1)||request.phoneNumberId!==r.connection.phoneNumberId||request.wabaId!==r.connection.whatsappBusinessId||request.authorityDigest!==r.authorityDigest||request.challengeId!==row.payload.challengeId)fail();
 customerTemplateMessage(request.message);
 const challenge=r.worker.metadata?.participant?.kycChatChallenge;
 if(challenge?.id!==request.challengeId||challenge.status!=='PENDING'||challenge.codeDigest!==metaKycChallengeDigest(request.message.bodyParameters[2])||challenge.connectionId!==r.connection.id||challenge.senderE164!==r.worker.phone||!Number.isFinite(Date.parse(request.expiresAt))||Date.parse(request.expiresAt)<=r.now.getTime()||challenge.expiresAt!==request.expiresAt)fail();
 return request;
}
async function projectStatus(client,intent,values){
 const row=await worker(client,intent.targetProjectId,intent.workerId),current=row?.metadata?.participant?.onboardingDelivery;
 if(!current||digest(participantOnboardingIntent(current))!==digest(intent))fail();
 const m=structuredClone(row.metadata);m.participant.onboardingDelivery={...current,...values};
 await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,row.projectId,JSON.stringify(m)]);
 return publicParticipantOnboarding(m.participant);
}

// One participant lifecycle intent, then the existing encrypted customer outbox.
// The only retryable phase precedes its committed SEND_STARTED marker.
export function createParticipantOnboardingDelivery({connect,provider,environment=process.env,resolveAuthority=resolveParticipantOnboardingAuthority,prepareChallenge=prepareMetaKycChallenge,afterPrepare=async()=>{},afterDispatchMarker=async()=>{}}){
 const within=run=>customerJobTransaction(connect,run);
 const transport=()=>{if(!metaCustomerTransportReady(provider.readiness()))fail('PARTICIPANT_ONBOARDING_PROVIDER_CLOSED',503);};
 async function remoteApproval(r,template){
  transport();const remote=await provider.findTemplate({token:credential(r,environment),wabaId:r.connection.whatsappBusinessId,name:template.definition.name});
  if(!customerRemoteTemplateMatches(remote,template.definition)||String(remote.id)!==template.providerId||remote.status!=='APPROVED'||remote.category!=='UTILITY')fail('PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');
 }
 async function load(reference){return within(async client=>{
  const row=await worker(client,reference.projectId,reference.workerId),current=row?.metadata?.participant?.onboardingDelivery;
  if(!current)return null;const intent=participantOnboardingIntent(current);if(intent.targetProjectId!==row.projectId||intent.workerId!==row.id)fail();return {intent,current,participant:row.metadata.participant};
 });}
 async function block(intent,error){return within(async client=>{
  // No anchor/channel lock is acquired in this status-only transaction.
  const rows=(await client.query(`SELECT ${rowColumns} FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w.id=$1 AND w."projectId"=$2 AND p."organizationId"=$3 FOR UPDATE OF w`,[intent.workerId,intent.targetProjectId,intent.organizationId])).rows;
  const current=rows[0]?.metadata?.participant?.onboardingDelivery;
  if(!current||digest(participantOnboardingIntent(current))!==digest(intent))return {state:'BLOCKED',code:'PARTICIPANT_ONBOARDING_CONTEXT_CHANGED'};
  if(['SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED','CANCELED','REJECTED'].includes(current.state))return publicParticipantOnboarding(rows[0].metadata.participant);
  const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  return projectStatus(client,intent,{state:'BLOCKED',code:safeCode(error),nextCheckAt:new Date(now.getTime()+60000).toISOString()});
 });}
 return {
  async process(reference){
   const loaded=await load(reference);if(!loaded)return {state:'NOT_REQUESTED'};
   const {intent,current}=loaded;
   if(['CANCELED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED'].includes(current.state))return publicParticipantOnboarding(loaded.participant);
   try{
    transport();
    const inspect=await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:current.challengeId?{authorityDigest:current.authorityDigest,challengeId:current.challengeId}:null}),template=approvedTemplate(r);
     const id=participantOnboardingOutboundId(intent),stored=await event(client,id,r.connection.projectId);
     if(stored&&stored.outcome?.state!=='ONBOARDING_PENDING')return {done:await projectStatus(client,intent,{state:stored.outcome?.state||'SEND_UNKNOWN',providerStatus:stored.outcome?.providerStatus||null,nextCheckAt:null})};
     if(stored)decode(stored,r,intent,environment);
     return {r,template,id};
    });if(inspect.done)return inspect.done;
    await remoteApproval(inspect.r,inspect.template);
    const queued=await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:inspect.r.authorityDigest,...(current.challengeId?{challengeId:current.challengeId}:{})}}),template=approvedTemplate(r);
     if(template.stamp!==inspect.template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');
     const stored=await event(client,inspect.id,r.connection.projectId);
     if(stored){if(stored.outcome?.state!=='ONBOARDING_PENDING')return {done:await projectStatus(client,intent,{state:stored.outcome?.state||'SEND_UNKNOWN',providerStatus:stored.outcome?.providerStatus||null,nextCheckAt:null})};return {id:stored.id,request:decode(stored,r,intent,environment),template};}
     const operationId=metaKycOperationId(inspect.id),prepared=await prepareChallenge(client,r.member,r.project,{workerId:r.worker.id,revision:r.worker.revision,operationId});
     if(!prepared.code||prepared.codeUnavailable)fail();
     const updated=await worker(client,intent.targetProjectId,intent.workerId),challenge=updated?.metadata?.participant?.kycChatChallenge;
     if(!challenge||challenge.status!=='PENDING'||challenge.codeDigest!==metaKycChallengeDigest(prepared.code))fail();
     // Keep the canonical exterior receipt that account acceptance requires.
     // This receipt, the challenge and its encrypted outbox commit together.
     if(!/^meta_kyc_challenge_[a-f0-9]{64}$/.test(prepared.receiptId||'')||prepared.expiresAt!==challenge.expiresAt)fail();
     const requestDigest=digest({action:'PREPARE_KYC_CHAT',source:'PARTICIPANT_ONBOARDING',projectId:intent.targetProjectId,workerId:intent.workerId,revision:r.worker.revision,operationId,outboundId:inspect.id});
     await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[participantReceiptId(intent.issuerActorId,intent.targetProjectId,operationId),intent.organizationId,intent.issuerActorId,intent.workerId,JSON.stringify({version:1,projectId:intent.targetProjectId,requestDigest,kind:'PREPARE_KYC_CHAT',challengeReceiptId:prepared.receiptId,expiresAt:challenge.expiresAt,source:'PARTICIPANT_ONBOARDING',outboundId:inspect.id,identityCertified:false,permissionsGranted:false})]);
     const message=buildParticipantOnboardingMessage(r.connection,{organizationName:r.member.organizationName||r.project.organizationName,invitationId:intent.invitationId,code:prepared.code});
     const request={version:1,channelPurpose:'PARTICIPANT_ONBOARDING',organizationId:intent.organizationId,channelId:r.connection.id,targetProjectId:intent.targetProjectId,workerId:intent.workerId,invitationId:intent.invitationId,consentReceiptId:intent.consentReceiptId,to:r.worker.phone.slice(1),phoneNumberId:r.connection.phoneNumberId,wabaId:r.connection.whatsappBusinessId,authorityDigest:r.authorityDigest,challengeId:challenge.id,expiresAt:challenge.expiresAt,template:{providerId:template.providerId,stamp:template.stamp,contentSha256:template.definition.contentSha256},message};
     await reserveCustomerOutbound(client,{id:inspect.id,projectId:r.connection.projectId,organizationId:intent.organizationId,actorId:intent.issuerActorId,request,eventType:'template',deferred:true,payloadFields:{participantOnboarding:true,targetProjectId:intent.targetProjectId,workerId:intent.workerId,invitationId:intent.invitationId,consentReceiptId:intent.consentReceiptId,challengeId:challenge.id},environment,now:r.now.getTime()});
     await resolveAuthority(client,intent,{environment,expected:{authorityDigest:r.authorityDigest,challengeId:challenge.id}});
     await projectStatus(client,intent,{state:'PENDING',outboundId:inspect.id,anchorProjectId:r.connection.projectId,challengeId:challenge.id,authorityDigest:r.authorityDigest,code:null,nextCheckAt:null});
     return {id:inspect.id,request,template};
    });if(queued.done)return queued.done;
    await afterPrepare();
    // Refresh Meta's exact owned definition before marking the attempt.
    const before=await within(async client=>{const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:queued.request.authorityDigest,challengeId:queued.request.challengeId}}),template=approvedTemplate(r);if(template.stamp!==queued.request.template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');return {r,template};});
    await remoteApproval(before.r,before.template);
    const started=await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:queued.request.authorityDigest,challengeId:queued.request.challengeId}}),stored=await event(client,queued.id,r.connection.projectId),request=decode(stored,r,intent,environment);
     if(approvedTemplate(r).stamp!==request.template.stamp)fail('PARTICIPANT_ONBOARDING_TEMPLATE_CHANGED');
     transport();const reservation=await startPendingCustomerOutbound(client,{id:stored.id,projectId:r.connection.projectId,requestDigest:stored.payload.requestDigest,now:r.now.getTime()});
     if(reservation.done)return {done:await projectStatus(client,intent,{state:reservation.done.state,providerStatus:reservation.done.providerStatus,nextCheckAt:null})};
     await projectStatus(client,intent,{state:'SEND_STARTED',code:null,nextCheckAt:null});return reservation;
    });if(started.done)return started.done;
    await afterDispatchMarker();
    return await within(async client=>{
     const r=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:queued.request.authorityDigest,challengeId:queued.request.challengeId}}),stored=await event(client,queued.id,r.connection.projectId),request=decode(stored,r,intent,environment);
     if(stored.outcome?.state!=='SEND_STARTED'||approvedTemplate(r).stamp!==request.template.stamp)fail();
     transport();let state='SEND_UNKNOWN',result=null;
     const final=await resolveAuthority(client,intent,{environment,expected:{authorityDigest:request.authorityDigest,challengeId:request.challengeId}});
     try{result=await provider.sendTemplate({token:credential(final,environment),phoneNumberId:final.connection.phoneNumberId,to:request.to,message:request.message,correlationId:stored.id});if(!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(result?.messageId||''))fail('PARTICIPANT_ONBOARDING_DELIVERY_UNCONFIRMED',503);state='SENT';}catch(error){if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';else result=null;}
     const completed=await completeCustomerOutbound(client,{...started,state,messageId:result?.messageId||null,now:r.now.getTime()});
     return projectStatus(client,intent,{state:completed.state,providerStatus:completed.providerStatus||null,code:null,nextCheckAt:null});
    });
   }catch(error){return block(intent,error);}
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
 for(const row of records){const current=row.metadata?.participant?.onboardingDelivery;if(!current?.outboundId)continue;
  const found=(await client.query(`SELECT id,"projectId",payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[current.outboundId,current.anchorProjectId])).rows[0];
  if(!found||found.payload?.participantOnboarding!==true||found.payload.organizationId!==organizationId||found.payload.targetProjectId!==projectId||found.payload.workerId!==row.id||found.payload.invitationId!==current.invitationId||found.payload.consentReceiptId!==current.consentReceiptId)continue;
  if(current.state==='CANCELED'&&found.outcome?.state==='ONBOARDING_PENDING')continue;
  row.metadata=structuredClone(row.metadata);row.metadata.participant.onboardingDelivery={...current,state:found.outcome?.state==='ONBOARDING_PENDING'?'PENDING':found.outcome?.state||'SEND_UNKNOWN',providerStatus:found.outcome?.providerStatus||null};
 }
}
