import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {participantKycInitialChannelCapture,participantKycImageSet} from './participant-kyc-image-set.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {companyKycGrantDigest,companyKycProjectionId,companyKycProjectionSource,companyKycSecretContext} from './company-channel-kyc.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {metaKycChallengeDigest} from './meta-kyc-challenge.mjs';

const fail=()=>{throw new WorkspaceError('PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED',409);};
const eventId=value=>/^customer_webhook_[a-f0-9]{64}$/.test(value||'');
const receiptId=value=>/^participant_[a-f0-9]{64}$/.test(value||'');
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));

// Only the common canonical onboarding authority calls this reader after
// principal/project/worker/channel locks. It grants no capture or field access.
// The completed source keeps its historical actor; adoption proves the current
// account separately. No image bytes, provider call or database mutation occurs.
export async function readCurrentReactiveKyc(client,{intent,member,own,project,worker,connection,origin,environment}){
 const p=worker.metadata.participant,k=p.kyc,c=p.kycChatChallenge,initial=participantKycInitialChannelCapture(k?.channelCapture),d=c?.companyKyc;
 // Restoring access preserves old KYC/challenge metadata. It is not a new
 // reactive handoff generation. Do not infer receipt order from createdAt:
 // canonical concurrent transactions can share an earlier start timestamp.
 // This minimal reader conservatively excludes any revoked/restored Worker.
 const retired=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Worker' AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind' IN ('REVOKE','RESTORE_ACCESS') LIMIT 1 FOR SHARE`,[intent.organizationId,worker.id])).rows;
 if(retired.length)fail();
 if(!connection.company||connection.company.mode!=='COMPANY'||origin?.version!==1||origin.kind!=='KYC_START'||origin.intent?.workerId!==worker.id||origin.intent.targetProjectId!==project.id||digest(origin.intent)!==digest(intent)||!eventId(origin.eventId)||!eventId(origin.applicationId)||!workspaceId(origin.admissionReceiptId)||!workspaceId(origin.handoffReceiptId)||!workspaceId(origin.challengeReceiptId)||!workspaceId(origin.exteriorReceiptId)||!metaKycChallengeDigest(origin.code)||c?.version!==1||c.status!=='COMPLETED'||c.id!==origin.challengeId||c.codeDigest!==metaKycChallengeDigest(origin.code)||c.organizationId!==member.organizationId||c.projectId!==project.id||c.workerId!==worker.id||c.senderE164!==worker.phone||c.connectionId!==connection.id||c.wabaId!==connection.whatsappBusinessId||c.phoneNumberId!==connection.phoneNumberId||c.issuerActorId!==member.actorId||c.issuerMembershipId!==member.membershipId||c.captureImageSetVersion!==2||!eventId(c.completionEventId)||!timestamp(c.completedAt)||!timestamp(c.expiresAt)||Date.parse(c.completedAt)>Date.parse(c.expiresAt)||d?.version!==1||d.anchorProjectId!==connection.projectId||d.targetProjectId!==project.id||d.ownerRevision!==connection.company.revision||d.assignmentRevision!==connection.company.assignmentRevision||d.grantDigest!==companyKycGrantDigest(connection)||k?.version!==1||k.captureImageSetVersion!==2||!['PENDING_ACCOUNT_CLAIM','PENDING_REVIEW','REJECTED','APPROVED'].includes(k.status)||!workspaceId(k.submissionId)||!timestamp(k.submittedAt)||!initial||initial.challengeId!==c.id||!receiptId(initial.receiptId)||!participantKycImageSet(k,{strictLegacy:true}))fail();
 const originalOwn=initial.accountClaimRequired===false;
 if(originalOwn?(p.status!=='ACTIVE'||!own||initial.capturedParticipantClerkUserId!==own.clerkUserId||c.participantClerkUserId!==own.clerkUserId||initial.invitationId!==null):(initial.invitationId!==intent.invitationId||c.invitationId!==intent.invitationId||c.participantClerkUserId!==null))fail();
 const captureActor=originalOwn?own.actorId:member.actorId;
 const captures=(await client.query(`SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded' AND "entityType"='Worker' AND "entityId"=$4 FOR SHARE`,[initial.receiptId,intent.organizationId,captureActor,worker.id])).rows;
 const capture=captures[0],m=capture?.metadata;
 if(captures.length!==1||capture.actorId!==captureActor||capture.entityType!=='Worker'||capture.entityId!==worker.id||m?.version!==1||m.kind!=='KYC_SUBMITTED'||m.projectId!==project.id||m.submissionId!==k.submissionId||m.contentHash!==k.contentHash||m.status!==(originalOwn?'PENDING_REVIEW':'PENDING_ACCOUNT_CLAIM')||digest(m.channelCapture)!==digest(initial)||m.identityCertified!==false||m.permissionsGranted!==false||m.whatsAppAccessGranted!==false||!participantKycImageSet(k,{strictLegacy:true,receipt:m,projectId:project.id}))fail();
 if(p.status==='INVITED'){
  if(own||originalOwn||k.status!=='PENDING_ACCOUNT_CLAIM'||digest(k.channelCapture)!==digest(initial)||k.review!==undefined)fail();
 }else{
  if(!own||p.clerkUserId!==own.clerkUserId||k.status==='PENDING_ACCOUNT_CLAIM')fail();
  if(!originalOwn){
   const claimed=k.channelCapture;
   if(claimed.accountClaimRequired!==false||claimed.claimedActorId!==own.actorId||claimed.claimedClerkUserId!==own.clerkUserId||claimed.acceptanceReceiptId!==p.acceptanceReceiptId||!timestamp(claimed.claimedAt))fail();
   const rows=(await client.query(`SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.kyc_chat.adopted' AND "entityType"='Worker' AND "entityId"=$4 FOR SHARE`,[p.acceptanceReceiptId+'_kyc',intent.organizationId,own.actorId,worker.id])).rows,a=rows[0]?.metadata;
   if(rows.length!==1||rows[0].actorId!==own.actorId||rows[0].entityType!=='Worker'||rows[0].entityId!==worker.id||a?.version!==1||a.projectId!==project.id||a.submissionId!==k.submissionId||a.contentHash!==k.contentHash||a.captureReceiptId!==initial.receiptId||a.acceptanceReceiptId!==p.acceptanceReceiptId||a.identityCertified!==false||a.permissionsGranted!==false||a.whatsAppAccessGranted!==false)fail();
  }else if(digest(k.channelCapture)!==digest(initial))fail();
 }
 const prepared=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='Worker' AND "entityId"=$4 AND action='participant.kyc_chat.prepared' FOR SHARE`,[origin.challengeReceiptId,intent.organizationId,member.actorId,worker.id])).rows,pm=prepared[0]?.metadata;
 if(prepared.length!==1||pm?.version!==1||pm.projectId!==project.id||pm.challengeId!==c.id||pm.expiresAt!==c.expiresAt||pm.captureImageSetVersion!==2||!/^[a-f0-9]{64}$/.test(pm.requestDigest||''))fail();
 const events=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND "eventType"='message' FOR SHARE`,[c.completionEventId,connection.projectId])).rows;
 if(events.length!==1)fail();const sourceEvent=events[0],payload=decodeSignedCustomerEvent(sourceEvent,connection,environment);
 if(payload.type!=='message'||payload.value.type!=='interactive'||'+'+payload.value.from!==worker.phone)fail();
 const projections=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.projected' FOR SHARE`,[companyKycProjectionId(c.completionEventId),intent.organizationId,worker.id])).rows;
 if(projections.length!==1||projections[0].actorId!==captureActor||projections[0].entityId!==worker.id)fail();
 const projection=companyKycProjectionSource(projections[0].metadata,{sourceEventId:sourceEvent.id,payloadDigest:sourceEvent.payload.payloadDigest,organizationId:intent.organizationId,connectionId:connection.id,anchorProjectId:connection.projectId,targetProjectId:project.id,workerId:worker.id,challengeId:c.id,ownerRevision:connection.company.revision,assignmentRevision:connection.company.assignmentRevision,grantDigest:companyKycGrantDigest(connection),issuerActorId:member.actorId,issuerMembershipId:member.membershipId,participantActorId:originalOwn?own.actorId:null,participantMembershipId:originalOwn?own.membershipId:null,participantClerkUserId:originalOwn?own.clerkUserId:null});
 const source={kind:'META_KYC_CHAT',eventId:sourceEvent.id,payloadDigest:sourceEvent.payload.payloadDigest,challengeId:c.id,connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,senderE164:worker.phone,companyKyc:projection};
 if(initial.sourceDigest!==digest(source))fail();
 const dispatchId='meta_kyc_dispatch_'+digest(['meta-kyc-dispatch-v1',sourceEvent.id]),dispatches=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='Worker' AND "entityId"=$4 AND action='participant.kyc_chat.dispatched' FOR SHARE`,[dispatchId,intent.organizationId,captureActor,worker.id])).rows,dm=dispatches[0]?.metadata;
 if(dispatches.length!==1||dm?.version!==1||dm.projectId!==project.id||dm.challengeId!==c.id||dm.payloadDigest!==sourceEvent.payload.payloadDigest||dm.captureImageSetVersion!==2||dm.identityCertified!==false||dm.permissionsGranted!==false)fail();
 let completed;try{completed=JSON.parse(decryptCustomerSecret(dm.encryptedResult,companyKycSecretContext(projection,'kyc-chat-dispatch',dispatchId),environment));}catch{fail();}
 if(completed?.kind!=='KYC_CHAT'||completed.identityStatus!=='LIMITED_KYC_UPLOAD'||completed.businessApplied!==true||completed.receiptId!==initial.receiptId||completed.reviewState!=='RECORDED'||dm.replyDigest!==digest(completed.reply))fail();
 let reviewReceiptId=null;
 if(k.status==='PENDING_REVIEW'&&k.review!==undefined)fail();
 if(['APPROVED','REJECTED'].includes(k.status)){
  if(!own||k.review?.decision!==k.status||!workspaceId(k.review.actorId)||k.review.actorId===own.actorId||!timestamp(k.review.recordedAt))fail();
  const reviews=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.operation.recorded' AND metadata->>'projectId'=$4 AND metadata->>'kind'='REVIEW_KYC' AND metadata->>'submissionId'=$5 AND metadata->>'decision'=$6 FOR SHARE`,[intent.organizationId,k.review.actorId,worker.id,project.id,k.submissionId,k.status])).rows;
  if(reviews.length!==1||reviews[0].metadata?.version!==1||reviews[0].metadata.reason!==k.review.reason)fail();reviewReceiptId=reviews[0].id;
  if(k.status==='APPROVED')await assertApprovedParticipantKyc(client,worker,own);
 }
 // This is internal authority data, never a public DTO. Including the exact
 // current presentation and review invalidates queued replies after a change.
 return {status:k.status,submissionId:k.submissionId,captureReceiptId:initial.receiptId,sourceDigest:initial.sourceDigest,challengeId:c.id,completionEventId:sourceEvent.id,acceptanceReceiptId:p.acceptanceReceiptId||null,adoptedAt:k.channelCapture.claimedAt||null,reviewReceiptId,reviewedAt:k.review?.recordedAt||null,submittedAt:k.submittedAt,completedAt:c.completedAt};
}
