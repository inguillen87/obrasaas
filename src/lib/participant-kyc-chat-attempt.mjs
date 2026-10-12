import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {metaKycChallengeDigest} from './meta-kyc-challenge.mjs';
import {customerOutboundId} from './meta-customer-outbound.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {metaKycDispatchReceiptId} from './meta-kyc-identity.mjs';
import {META_KYC_REJECTION_REPLY} from './meta-kyc-rejection.mjs';
import {companyKycProjectionContract,companyKycProjectionDigest,companyKycProjectionId} from './company-channel-kyc.mjs';

const reasons=new Set(['SENDER_MISMATCH','CODE_FORMAT','CODE_MISMATCH','PREPARATION_RECEIPT_UNCONFIRMED','CHALLENGE_REJECTED','SAME_SECOND_UNCONFIRMED','OTHER_RESULT']);
const unavailable=state=>({version:1,state});
const deliveryStates=new Set(['NOT_OBSERVED','RESERVED','SEND_UNKNOWN','API_ACCEPTED','DELIVERED','READ','API_REJECTED','FAILED','WINDOW_CLOSED','UNAVAILABLE']);
const undatedDeliveryStates=new Set(['NOT_OBSERVED','WINDOW_CLOSED','UNAVAILABLE']);
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const messageId=value=>typeof value==='string'&&/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(value);
const signedEventId=value=>typeof value==='string'&&/^customer_webhook_[a-f0-9]{64}$/.test(value);
const delivery=(state,recordedAt=null)=>({version:1,state,recordedAt});
function publicReplyDelivery(value){
 if(value?.version!==1||!deliveryStates.has(value.state)||(undatedDeliveryStates.has(value.state)?value.recordedAt!==null:!instant(value.recordedAt)))throw new WorkspaceError('PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE',503);
 return delivery(value.state,value.recordedAt);
}
// The existing canonical participant transaction authorizes this observation.
// Outbound summaries alone never prove a reply's subject or signed delivery.
async function readReplyDelivery({client,member,projectId,row,channel,found,ambiguous,environment}){
 if(ambiguous)return delivery('UNAVAILABLE');
 try{
  const clocks=(await client.query('SELECT clock_timestamp() AS now')).rows,now=clocks[0]?.now;
  if(clocks.length!==1||!(now instanceof Date)||!Number.isFinite(now.getTime())||found.timestamp*1000>now.getTime()+60000)return delivery('UNAVAILABLE');
  const id=customerOutboundId(found.event.id),values=[id,channel.projectId,member.organizationId,channel.id];
  const rows=(await client.query(`SELECT id,"projectId",provider,"eventType",status::text AS status,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'organizationId'=$3 AND payload->>'channelId'=$4 LIMIT 2`,values)).rows;
  if(!rows.length){
   const closed=found.event.status==='PROCESSED'&&(found.event.outcome?.replyWindowClosed===true||found.event.outcome?.replyState==='META_CUSTOMER_REPLY_WINDOW_CLOSED')&&now.getTime()-found.timestamp*1000>=86400000;
   return delivery(closed?'WINDOW_CLOSED':'NOT_OBSERVED');
  }
  if(rows.length!==1)return delivery('UNAVAILABLE');
  const out=rows[0],stored=out.payload,outcome=out.outcome,aad={organizationId:member.organizationId,projectId:channel.projectId};
  if(out.id!==id||out.projectId!==channel.projectId||out.provider!=='meta-customer-outbound-v1'||out.eventType!=='reply'||stored?.version!==1||stored.organizationId!==member.organizationId||stored.channelId!==channel.id||stored.eventId!==found.event.id||outcome?.version!==1||!workspaceId(outcome.actorId)||!instant(outcome.reservedAt)||Date.parse(outcome.reservedAt)>now.getTime()+60000||Date.parse(outcome.reservedAt)+60000<found.timestamp*1000)return delivery('UNAVAILABLE');
  const request=JSON.parse(decryptCustomerSecret(stored.encryptedPayload,{...aad,purpose:'outbound',resourceId:id},environment));
  if(!request||Array.isArray(request)||request.version!==1||digest(request)!==stored.requestDigest||request.eventId!==found.event.id||request.payloadDigest!==found.event.payload.payloadDigest||request.channelId!==channel.id||request.organizationId!==member.organizationId||request.to!==found.message.from||request.replyTo!==found.message.id||!request.message||!['KYC_CAPTURE','KYC_REJECTION'].includes(request.channelPurpose))return delivery('UNAVAILABLE');
  const rejection=request.channelPurpose==='KYC_REJECTION';
  if(rejection?stored.kycRejection!==true||stored.kycCapture===true||digest(request.message)!==digest(META_KYC_REJECTION_REPLY):stored.kycCapture!==true||stored.kycRejection===true||stored.challengeId!==row.metadata.participant.kycChatChallenge.id||request.challengeId!==stored.challengeId)return delivery('UNAVAILABLE');
  const auditId=rejection?'meta_kyc_rejection_'+digest(['meta-kyc-rejection-v1',found.event.id]):metaKycDispatchReceiptId(found.event.id),action=rejection?'participant.kyc_chat.rejected':'participant.kyc_chat.dispatched',entityType=rejection?'WebhookEvent':'Worker',entityId=rejection?found.event.id:row.id;
  const receipts=(await client.query(`SELECT id,"organizationId","actorId","entityType","entityId",action,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"=$3 AND "entityId"=$4 AND action=$5 LIMIT 2`,[auditId,member.organizationId,entityType,entityId,action])).rows;
  if(receipts.length!==1)return delivery('UNAVAILABLE');
  const audit=receipts[0],receipt=audit.metadata;
  if(audit.id!==auditId||audit.organizationId!==member.organizationId||audit.actorId!==outcome.actorId||audit.entityType!==entityType||audit.entityId!==entityId||audit.action!==action||receipt?.version!==1||receipt.projectId!==(rejection?channel.projectId:projectId)||receipt.payloadDigest!==found.event.payload.payloadDigest||receipt.replyDigest!==digest(request.message)||rejection&&(receipt.channelId!==channel.id||receipt.code!=='META_KYC_CHALLENGE_REJECTED')||!rejection&&receipt.challengeId!==request.challengeId)return delivery('UNAVAILABLE');
  const recorded=JSON.parse(decryptCustomerSecret(receipt.encryptedResult,{...aad,purpose:rejection?'kyc-rejection':'kyc-chat-dispatch',resourceId:auditId},environment));
  if(recorded?.kind!==(rejection?'KYC_REJECTION':'KYC_CHAT')||recorded.identityStatus!==(rejection?'CHANNEL_IDENTITY_UNVERIFIED':'LIMITED_KYC_UPLOAD')||digest(recorded.reply)!==receipt.replyDigest||rejection&&(recorded.code!=='META_KYC_CHALLENGE_REJECTED'||recorded.businessApplied!==false))return delivery('UNAVAILABLE');
  const challenge=row.metadata.participant.kycChatChallenge;
  if(!rejection&&challenge.companyKyc){
   const projections=(await client.query(`SELECT id,"organizationId","actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.projected' LIMIT 2`,[companyKycProjectionId(found.event.id),member.organizationId,row.id])).rows;
   if(projections.length!==1)return delivery('UNAVAILABLE');
   const projected=projections[0],projection=companyKycProjectionContract(projected.metadata,{sourceEventId:found.event.id,payloadDigest:found.event.payload.payloadDigest,organizationId:member.organizationId,connectionId:channel.id,anchorProjectId:channel.projectId,targetProjectId:projectId,workerId:row.id,challengeId:challenge.id});
   if(projected.id!==companyKycProjectionId(found.event.id)||projected.organizationId!==member.organizationId||projected.entityType!=='Worker'||projected.entityId!==row.id||projected.actorId!==(projection.participantActorId||projection.issuerActorId)||projected.actorId!==outcome.actorId||request.targetProjectId!==projectId||request.companyKycDigest!==companyKycProjectionDigest(projection))return delivery('UNAVAILABLE');
  }else if(!rejection&&(request.targetProjectId!==undefined||request.companyKycDigest!==undefined))return delivery('UNAVAILABLE');
  if(outcome.state==='STATUS_OBSERVED'){
   if(out.status!=='PROCESSED'||!signedEventId(outcome.statusEventId)||!messageId(outcome.messageId)||!instant(outcome.statusObservedAt)||Date.parse(outcome.statusObservedAt)<Date.parse(outcome.reservedAt)||Date.parse(outcome.statusObservedAt)>now.getTime()+60000)return delivery('UNAVAILABLE');
   const statuses=(await client.query(`SELECT id,"projectId",provider,"eventType",status::text AS status,payload FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND "eventType"='message_status' AND payload->>'organizationId'=$3 AND payload->>'channelId'=$4 LIMIT 2`,[outcome.statusEventId,channel.projectId,member.organizationId,channel.id])).rows;
   if(statuses.length!==1)return delivery('UNAVAILABLE');
   const event=statuses[0];if(event.id!==outcome.statusEventId||event.projectId!==channel.projectId||event.provider!=='meta-customer-v1'||event.eventType!=='message_status'||!['PENDING','PROCESSED'].includes(event.status))return delivery('UNAVAILABLE');
   const signed=decodeSignedCustomerEvent(event,channel,environment),value=signed.value,timestamp=Number(value?.timestamp);
   if(signed.type!=='message_status'||signed.field!=='messages'||value?.biz_opaque_callback_data!==id||value.id!==outcome.messageId||value.recipient_id!==request.to||value.status!==outcome.providerStatus||!['sent','delivered','read','failed','deleted'].includes(value.status)||!/^\d{1,14}$/.test(String(value.timestamp))||!Number.isSafeInteger(timestamp)||timestamp<found.timestamp||timestamp*1000+60000<Date.parse(outcome.reservedAt)||timestamp*1000>now.getTime()+60000)return delivery('UNAVAILABLE');
   return delivery({sent:'API_ACCEPTED',delivered:'DELIVERED',read:'READ',failed:'FAILED',deleted:'FAILED'}[value.status],value.status==='sent'?outcome.statusObservedAt:new Date(timestamp*1000).toISOString());
  }
  if(outcome.providerStatus!==undefined&&outcome.providerStatus!==null||outcome.statusEventId!==undefined)return delivery('UNAVAILABLE');
  if(outcome.state==='SEND_STARTED')return out.status==='PENDING'&&!outcome.messageId?delivery('RESERVED',outcome.reservedAt):delivery('UNAVAILABLE');
  if(out.status!=='PROCESSED'||!instant(outcome.completedAt)||Date.parse(outcome.completedAt)<Date.parse(outcome.reservedAt)||Date.parse(outcome.completedAt)>now.getTime()+60000)return delivery('UNAVAILABLE');
  if(outcome.state==='SENT'&&messageId(outcome.messageId))return delivery('API_ACCEPTED',outcome.completedAt);
  if(outcome.state==='SEND_UNKNOWN'&&!outcome.messageId)return delivery('SEND_UNKNOWN',outcome.completedAt);
  if(outcome.state==='REJECTED'&&!outcome.messageId)return delivery('API_REJECTED',outcome.completedAt);
  return delivery('UNAVAILABLE');
 }catch{return delivery('UNAVAILABLE');}
}
// The injected reader cannot extend the public response with private material.
export function publicParticipantKycChatAttempt(value){
 if(value?.version!==1||!['OBSERVED','NOT_OBSERVED','UNAVAILABLE'].includes(value.state))throw new WorkspaceError('PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE',503);
 if(value.state!=='OBSERVED')return unavailable(value.state);
 if(!['PENDING','PROCESSED'].includes(value.processingState)||!reasons.has(value.reason)||!Number.isFinite(Date.parse(value.receivedAt))||!['codeSyntax','codeMatch','senderMatch','preparationReceiptMatch','rejected','sameSecond'].every(key=>typeof value[key]==='boolean'))throw new WorkspaceError('PARTICIPANT_KYC_ATTEMPT_UNAVAILABLE',503);
 return {version:1,state:'OBSERVED',receivedAt:new Date(value.receivedAt).toISOString(),processingState:value.processingState,rejected:value.rejected,reason:value.reason,codeSyntax:value.codeSyntax,codeMatch:value.codeMatch,senderMatch:value.senderMatch,preparationReceiptMatch:value.preparationReceiptMatch,sameSecond:value.sameSecond,...(Object.hasOwn(value,'replyDelivery')?{replyDelivery:publicReplyDelivery(value.replyDelivery)}:{})};
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
   matches.push({event,message,timestamp,codeSyntax:codeDigest!==null,codeMatch,senderMatch,sameSecond:timestamp===Math.floor(created/1000)});
  }
  // Signed seconds determine presentation; a tie is explicitly inconclusive.
  matches.sort((a,b)=>b.timestamp-a.timestamp);
  if(!matches.length)return unavailable('NOT_OBSERVED');
  const found=matches[0],audits=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.prepared' AND metadata->>'challengeId'=$4 LIMIT 2`,[member.organizationId,c.issuerActorId,row.id,c.id])).rows;
  const receipt=audits[0]?.metadata,preparationReceiptMatch=c.captureImageSetVersion===2&&audits.length===1&&receipt?.version===1&&receipt.projectId===projectId&&receipt.captureImageSetVersion===2&&receipt.expiresAt===c.expiresAt&&/^[a-f0-9]{64}$/.test(receipt.requestDigest||'');
  const rejected=found.event.outcome?.code==='META_KYC_CHALLENGE_REJECTED';
  const ambiguous=found.sameSecond&&!found.codeMatch||matches.length>1&&matches[1].timestamp===found.timestamp;
  const reason=ambiguous?'SAME_SECOND_UNCONFIRMED':!rejected?'OTHER_RESULT':!found.senderMatch?'SENDER_MISMATCH':!found.codeSyntax?'CODE_FORMAT':!found.codeMatch?'CODE_MISMATCH':!preparationReceiptMatch?'PREPARATION_RECEIPT_UNCONFIRMED':'CHALLENGE_REJECTED';
  const replyDelivery=await readReplyDelivery({client,member,projectId,row,channel,found,ambiguous,environment});
  return publicParticipantKycChatAttempt({version:1,state:'OBSERVED',receivedAt:new Date(found.timestamp*1000).toISOString(),processingState:found.event.status,rejected,reason,codeSyntax:found.codeSyntax,codeMatch:found.codeMatch,senderMatch:found.senderMatch,preparationReceiptMatch,sameSecond:ambiguous,replyDelivery});
 };
}
export const readParticipantKycChatAttempt=createParticipantKycChatAttemptReader();
