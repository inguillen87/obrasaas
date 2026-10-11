import {WorkspaceError} from './workspace-policy.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {metaKycChallengeDigest} from './meta-kyc-challenge.mjs';

const reasons=new Set(['SENDER_MISMATCH','CODE_FORMAT','CODE_MISMATCH','PREPARATION_RECEIPT_UNCONFIRMED','CHALLENGE_REJECTED','SAME_SECOND_UNCONFIRMED','OTHER_RESULT']);
const unavailable=state=>({version:1,state});
// The injected reader cannot extend the public response with private material.
export function publicParticipantKycChatAttempt(value){
 if(value?.version!==1||!['OBSERVED','NOT_OBSERVED','UNAVAILABLE'].includes(value.state))throw new WorkspaceError('PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE',503);
 if(value.state!=='OBSERVED')return unavailable(value.state);
 if(!['PENDING','PROCESSED'].includes(value.processingState)||!reasons.has(value.reason)||!Number.isFinite(Date.parse(value.receivedAt))||!['codeSyntax','codeMatch','senderMatch','preparationReceiptMatch','rejected','sameSecond'].every(key=>typeof value[key]==='boolean'))throw new WorkspaceError('PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE',503);
 return {version:1,state:'OBSERVED',receivedAt:new Date(value.receivedAt).toISOString(),processingState:value.processingState,rejected:value.rejected,reason:value.reason,codeSyntax:value.codeSyntax,codeMatch:value.codeMatch,senderMatch:value.senderMatch,preparationReceiptMatch:value.preparationReceiptMatch,sameSecond:value.sameSecond};
}

// Called only after the participant store has checked current project access
// and manager authority or canonical ownership. No resolver, provider or write.
export function createParticipantKycChatAttemptReader({resolveConnection=companyConnectionForProject}={}){
 return async function read({client,member,projectId,row,environment=process.env}){
  const p=row.metadata?.participant,c=p?.kycChatChallenge,created=Date.parse(c?.createdAt);
  if(!row.active||p?.version!==1||!['INVITED','ACTIVE'].includes(p.status)||c?.version!==1||c.organizationId!==member.organizationId||c.projectId!==projectId||c.workerId!==row.id||c.senderE164!==row.phone||!/^\+[1-9]\d{7,14}$/.test(row.phone||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(c.createdAt||'')||!Number.isFinite(created)||!/^[a-f0-9]{64}$/.test(c.codeDigest||''))return unavailable('UNAVAILABLE');
  let channel=await resolveConnection(client,member.organizationId,projectId);
  if(c.companyKyc){
   if(c.companyKyc.version!==1||c.companyKyc.targetProjectId!==projectId||!channel||channel.company?.mode!=='COMPANY'||channel.projectId!==c.companyKyc.anchorProjectId||channel.company.targetProjectId!==projectId)return unavailable('UNAVAILABLE');
  }else{
   if(channel)return unavailable('UNAVAILABLE');
   channel=(await client.query(`SELECT c.id,c."projectId",c."whatsappBusinessId",c."phoneNumberId",c.metadata,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3 AND p.status='ACTIVE'`,[c.connectionId,projectId,member.organizationId])).rows[0];
  }
  if(!channel||channel.id!==c.connectionId||channel.organizationId!==member.organizationId||channel.whatsappBusinessId!==c.wabaId||channel.phoneNumberId!==c.phoneNumberId||channel.metadata?.credentialOrganizationId!==member.organizationId)return unavailable('UNAVAILABLE');
  const events=(await client.query(`SELECT id,"projectId",provider,status::text AS status,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND "eventType"='message' AND payload->>'organizationId'=$2 AND payload->>'channelId'=$3 ORDER BY "createdAt" DESC,id DESC LIMIT 20`,[channel.projectId,member.organizationId,channel.id])).rows;
  if(events.length>20)return unavailable('UNAVAILABLE');
  const matches=[];
  for(const event of events){
   let payload;try{payload=decodeSignedCustomerEvent(event,channel,environment);}catch{return unavailable('UNAVAILABLE');}
   const message=payload.value,text=message?.type==='text'&&typeof message.text?.body==='string'?message.text.body.trim():null;
   // A registered sender's unrelated field/bank messages are never KYC attempts.
   if(payload.type!=='message'||text===null||!/^IDENTIDAD(?:\s|$)/i.test(text))continue;
   const timestamp=Number(message.timestamp);
   if(!/^\d{1,14}$/.test(String(message.timestamp))||!Number.isSafeInteger(timestamp)||timestamp<Math.floor(created/1000)||timestamp*1000>8640000000000000||!/^\d{8,15}$/.test(message.from||''))continue;
   const codeDigest=metaKycChallengeDigest(text),codeMatch=codeDigest!==null&&codeDigest===c.codeDigest,senderMatch='+'+message.from===row.phone;
   if(!codeMatch&&!senderMatch)continue;
   if(!['PENDING','PROCESSED'].includes(event.status))return unavailable('UNAVAILABLE');
   matches.push({event,timestamp,codeSyntax:codeDigest!==null,codeMatch,senderMatch,sameSecond:timestamp===Math.floor(created/1000)});
  }
  // Signed seconds determine presentation; a tie is explicitly inconclusive.
  matches.sort((a,b)=>b.timestamp-a.timestamp);
  if(!matches.length)return unavailable('NOT_OBSERVED');
  const found=matches[0],audits=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.prepared' AND metadata->>'challengeId'=$4 LIMIT 2`,[member.organizationId,c.issuerActorId,row.id,c.id])).rows;
  const receipt=audits[0]?.metadata,preparationReceiptMatch=c.captureImageSetVersion===2&&audits.length===1&&receipt?.version===1&&receipt.projectId===projectId&&receipt.captureImageSetVersion===2&&receipt.expiresAt===c.expiresAt&&/^[a-f0-9]{64}$/.test(receipt.requestDigest||'');
  const rejected=found.event.outcome?.code==='META_KYC_CHALLENGE_REJECTED';
  const ambiguous=found.sameSecond&&!found.codeMatch||matches.length>1&&matches[1].timestamp===found.timestamp;
  const reason=ambiguous?'SAME_SECOND_UNCONFIRMED':!rejected?'OTHER_RESULT':!found.senderMatch?'SENDER_MISMATCH':!found.codeSyntax?'CODE_FORMAT':!found.codeMatch?'CODE_MISMATCH':!preparationReceiptMatch?'PREPARATION_RECEIPT_UNCONFIRMED':'CHALLENGE_REJECTED';
  return publicParticipantKycChatAttempt({version:1,state:'OBSERVED',receivedAt:new Date(found.timestamp*1000).toISOString(),processingState:found.event.status,rejected,reason,codeSyntax:found.codeSyntax,codeMatch:found.codeMatch,senderMatch:found.senderMatch,preparationReceiptMatch,sameSecond:ambiguous});
 };
}
export const readParticipantKycChatAttempt=createParticipantKycChatAttemptReader();
