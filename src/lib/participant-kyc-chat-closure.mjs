import {WorkspaceError,workspaceId,operationId,digest,WORKSPACE_ROLES} from './workspace-policy.mjs';
import {participantManager,participantReason,participantRevision,participantReceiptId} from './participant-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {META_KYC_CONVERSATION_TTL_MS} from './meta-kyc-conversation.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';

const fail=(code='PARTICIPANT_KYC_CHAT_INTEGRITY',status=409)=>{throw new WorkspaceError(code,status);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const event=value=>typeof value==='string'&&/^customer_webhook_[a-f0-9]{64}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const stable=value=>Array.isArray(value)?value.map(stable):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>digest(stable(value));
// Opening the project adds identityOnly:false to an admitted membership. Its
// absence is equivalent; every other claim and admission flag remains exact.
const memberFingerprint=value=>fingerprint({...value,identityOnly:value.identityOnly===true});
const statuses=['PENDING','CLAIMED','COMPLETED','CANCELLED','CLOSED'];
const steps=['CONSENT','BACK_CONSENT','BACK','OCR','BIOMETRIC','FRONT','SELFIE','CONFIRM','FINALIZING'];
const submitted=part=>!object(part?.kyc)||part.kyc.version!==1||!['NOT_SUBMITTED','REJECTED'].includes(part.kyc.status)||part.kyc.channelCapture?.challengeId===part.kycChatChallenge?.id;
const prepared=new WeakMap();

function challengeContext(row){
 const p=row?.metadata?.participant,c=p?.kycChatChallenge;
 if(!row?.active||row.metadata?.siteRegister?.version!==1||p?.version!==1||!['INVITED','ACTIVE','REVOKED'].includes(p.status)||!workspaceId(row.projectId)||!workspaceId(row.organizationId)||!object(c)||c.version!==1||!/^kyc_chat_[a-f0-9]{32}$/.test(c.id||'')||!statuses.includes(c.status)||c.organizationId!==row.organizationId||c.projectId!==row.projectId||c.workerId!==row.id||!/^\+[1-9]\d{7,14}$/.test(row.phone||'')||c.senderE164!==row.phone||!hash(c.codeDigest)||!instant(c.createdAt)||!instant(c.expiresAt)||Date.parse(c.expiresAt)<=Date.parse(c.createdAt))fail();
 for(const key of ['workerId','connectionId','issuerActorId','issuerMembershipId'])if(!workspaceId(c[key]))fail();
 if(!/^\d{5,32}$/.test(c.wabaId||'')||!/^\d{5,32}$/.test(c.phoneNumberId||'')||c.participantClerkUserId!==null&&!/^user_[A-Za-z0-9]+$/.test(c.participantClerkUserId||''))fail();
 let anchorProjectId=row.projectId;
 if(c.companyKyc!==undefined){
  const d=c.companyKyc,keys=['version','anchorProjectId','targetProjectId','ownerRevision','assignmentRevision','grantDigest','issuerAuthorityDigest'];
  if(!object(d)||Object.keys(d).sort().join('|')!==keys.sort().join('|')||d.version!==1||!workspaceId(d.anchorProjectId)||d.targetProjectId!==row.projectId||![d.ownerRevision,d.assignmentRevision].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=2147483647)||!hash(d.grantDigest)||!hash(d.issuerAuthorityDigest))fail();
  anchorProjectId=d.anchorProjectId;
 }
 return {part:p,challenge:c,anchorProjectId};
}

function conversation(row,environment){
 const {part,challenge,anchorProjectId}=challengeContext(row),envelope=part.kycChatConversation;
 if(challenge.status==='PENDING'){
  if(envelope!==null&&envelope!==undefined||['claimedAt','claimedEventId','confirmationEventId','completionEventId','completedAt'].some(key=>Object.hasOwn(challenge,key))||challenge.messageCount!==undefined&&challenge.messageCount!==0)fail();
  return null;
 }
 if(challenge.status!=='CLAIMED')fail('PARTICIPANT_KYC_CHAT_NOT_CANCELLABLE');
 if(!object(envelope)||envelope.version!==1||envelope.challengeId!==challenge.id||!event(challenge.claimedEventId)||!instant(challenge.claimedAt)||!event(envelope.lastEventId)||!Number.isSafeInteger(envelope.lastMessageTimestamp)||envelope.lastMessageTimestamp<1||!instant(envelope.expiresAt)||Date.parse(envelope.expiresAt)!==Date.parse(challenge.claimedAt)+META_KYC_CONVERSATION_TTL_MS)fail();
 let state;
 try{state=JSON.parse(decryptCustomerSecret(envelope.encryptedState,{organizationId:row.organizationId,projectId:anchorProjectId,purpose:'kyc-chat-conversation',resourceId:challenge.id},environment));}catch{fail();}
 if(!object(state)||state.version!==1||state.captureImageSetVersion!==challenge.captureImageSetVersion||!steps.includes(state.step)||state.challengeId!==challenge.id||state.lastEventId!==envelope.lastEventId||state.lastMessageTimestamp!==envelope.lastMessageTimestamp||state.expiresAt!==envelope.expiresAt)fail();
 if(state.step==='FINALIZING'||state.confirmationEventId!=null||challenge.confirmationEventId!=null||challenge.completionEventId!=null||challenge.completedAt!=null)fail('PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING');
 return state;
}

// Affordance only: the command below also checks canonical receipts and locks.
// An opaque envelope cannot establish that confirmation has not occurred.
export function publicParticipantKycChat(row,{now,member,canManage=false,environment=process.env}={}){
 const c=row?.metadata?.participant?.kycChatChallenge;if(c===undefined||c===null)return null;
 let blockedCode=null,step=null,recoveryRequired=false,valid=false;
 const clock=now instanceof Date&&Number.isFinite(now.getTime()),known=object(c)&&statuses.includes(c.status);
 try{
  challengeContext(row);if(!clock)fail();valid=true;
  if(submitted(row.metadata.participant))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
  if(!canManage||!participantManager(member?.role)||member.organizationId!==row.organizationId||member.actorId!==c.issuerActorId||member.membershipId!==c.issuerMembershipId)fail('PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED',403);
  if(['PENDING','CLAIMED'].includes(c.status))step=conversation(row,environment)?.step||null;
  else fail('PARTICIPANT_KYC_CHAT_NOT_CANCELLABLE');
 }catch(error){blockedCode=error instanceof WorkspaceError?error.code:'PARTICIPANT_KYC_CHAT_INTEGRITY';recoveryRequired=['PARTICIPANT_KYC_CHAT_INTEGRITY','PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'].includes(blockedCode);if(blockedCode==='PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING')step='FINALIZING';}
 const expiresAt=instant(c?.expiresAt)?c.expiresAt:null,conversationExpiresAt=instant(row?.metadata?.participant?.kycChatConversation?.expiresAt)?row.metadata.participant.kycChatConversation.expiresAt:null;
 return {id:/^kyc_chat_[a-f0-9]{32}$/.test(c?.id||'')?c.id:null,status:known&&valid?c.status:'INVALID',expiresAt,conversationExpiresAt,expired:clock&&expiresAt!==null&&(Date.parse(expiresAt)<=now.getTime()||conversationExpiresAt!==null&&Date.parse(conversationExpiresAt)<=now.getTime()),canPrepare:valid&&canManage&&participantManager(member?.role)&&member.organizationId===row.organizationId&&['INVITED','ACTIVE'].includes(row.metadata.participant.status)&&['CANCELLED','CLOSED'].includes(c.status)&&!submitted(row.metadata.participant),canCancel:valid&&blockedCode===null&&['PENDING','CLAIMED'].includes(c.status),blockedCode,step,recoveryRequired,claimedAt:instant(c?.claimedAt)?c.claimedAt:null,closedAt:instant(c?.cancelledAt)?c.cancelledAt:null};
}

function command(member,projectId,input){
 const p=input?.payload||input;
 if(member?.identityOnly===true)fail('PARTICIPANT_KYC_REVIEW_REQUIRED',403);
 if(!participantManager(member?.role)||!workspaceId(member.actorId)||!workspaceId(member.membershipId)||!workspaceId(member.organizationId))fail('PARTICIPANT_MANAGE_REQUIRED',403);
 if(!workspaceId(projectId)||!workspaceId(p?.workerId)||!operationId(input?.operationId)||!/^kyc_chat_[a-f0-9]{32}$/.test(p?.challengeId||''))fail('PARTICIPANT_INPUT_INVALID',400);
 participantRevision(p.revision);const reason=participantReason(p.reason),key=participantReceiptId(member.actorId,projectId,input.operationId),value={workerId:p.workerId,revision:p.revision,challengeId:p.challengeId,reason};
 return {...value,closureReceiptId:key,receiptId:key+'_kyc_closed',requestDigest:digest(['participant-kyc-chat-closure-v1',member.organizationId,member.actorId,projectId,value])};
}
async function principal(client,organizationId,{actorId=null,membershipId=null,clerkUserId=null},lock=true){
 const users=(await client.query('SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE '+(actorId?'id=$1':'"clerkUserId"=$1')+(lock?' FOR SHARE':''),[actorId||clerkUserId])).rows;
 if(users.length!==1||!/^user_[A-Za-z0-9]+$/.test(users[0].clerkUserId||''))fail('PARTICIPANT_ACCESS_REQUIRED',403);
 const members=(await client.query('SELECT id AS "membershipId","userId" AS "actorId","organizationId","tenantRole"::text AS role,"clerkRole" FROM public."TenantMembership" WHERE "userId"=$1 AND "organizationId"=$2 AND status=\'ACTIVE\''+(membershipId?' AND id=$3':'')+(lock?' FOR SHARE':''),membershipId?[users[0].id,organizationId,membershipId]:[users[0].id,organizationId])).rows;
 if(members.length!==1||!Object.hasOwn(WORKSPACE_ROLES,members[0].role)||members[0].clerkRole==='obrasaas:internal')fail('PARTICIPANT_ACCESS_REQUIRED',403);
 return {...members[0],clerkUserId:users[0].clerkUserId};
}
const workerColumns='w.id,w."projectId",p."organizationId",w.phone,w.active,w.metadata,to_char(w."updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.US\') AS revision';
async function worker(client,member,projectId,workerId,lock=false){
 const rows=(await client.query('SELECT '+workerColumns+' FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w.id=$1 AND w."projectId"=$2 AND p."organizationId"=$3'+(lock?' FOR UPDATE OF w':''),[workerId,projectId,member.organizationId])).rows;
 if(rows.length!==1)fail('PARTICIPANT_ACCESS_REQUIRED',403);return rows[0];
}
function sameIssuer(row,member){const {challenge}=challengeContext(row);if(challenge.issuerActorId!==member.actorId||challenge.issuerMembershipId!==member.membershipId||row.organizationId!==member.organizationId)fail('PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED',403);}

async function recordedClosure(client,member,row,p,input){
 const exterior=(await client.query('SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=\'participant.operation.recorded\'',[p.closureReceiptId,member.organizationId])).rows;
 if(exterior.length===0)return null;
 const outer=exterior[0];
 if(exterior.length!==1||outer.actorId!==member.actorId||outer.entityType!=='Worker'||outer.entityId!==row.id||outer.metadata?.version!==1||outer.metadata.projectId!==row.projectId||outer.metadata.kind!=='CANCEL_KYC_CHAT'||outer.metadata.challengeId!==p.challengeId||outer.metadata.closureReceiptId!==p.receiptId||outer.metadata.requestDigest!==digest(input))fail('PARTICIPANT_OPERATION_CONFLICT');
 const extras=(await client.query('SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=\'participant.kyc_chat.closed\'',[p.receiptId,member.organizationId])).rows;
 const a=extras[0],m=a?.metadata,c=m?.challenge;
 if(extras.length!==1||a.actorId!==member.actorId||a.entityType!=='Worker'||a.entityId!==row.id||m?.version!==1||m.projectId!==row.projectId||m.requestDigest!==p.requestDigest||m.closureReceiptId!==p.closureReceiptId||m.challengeId!==p.challengeId||c?.id!==p.challengeId||!['PENDING','CLAIMED'].includes(c.status)||c.issuerActorId!==member.actorId||c.issuerMembershipId!==member.membershipId||c.organizationId!==member.organizationId||c.projectId!==row.projectId||c.workerId!==row.id||m.beforeChallengeDigest!==fingerprint(c)||!instant(m.recordedAt)||m.afterChallengeDigest!==fingerprint({...c,status:'CANCELLED',cancelledAt:m.recordedAt,cancelledBy:member.actorId,closureReceiptId:p.closureReceiptId}))fail('PARTICIPANT_RECEIPT_INVALID');
 const archivedRow={...row,phone:c.senderE164,metadata:{...row.metadata,participant:{...row.metadata.participant,kycChatChallenge:c,kycChatConversation:m.conversation}}};
 const original=challengeContext(archivedRow);if(original.anchorProjectId!==m.anchorProjectId)fail('PARTICIPANT_RECEIPT_INVALID');
 return {receipt:a,anchorProjectId:m.anchorProjectId};
}

// The root participant transaction invokes this before its Project lock. It
// must not lock B and then discover A, or acquire an own principal after B.
async function beforeProject(client,member,input){
 prepared.delete(client);const p=command(member,input?.projectId,input),row=await worker(client,member,input.projectId,p.workerId),recorded=await recordedClosure(client,member,row,p,input);
 let part,anchorProjectId;
 if(recorded){
  part=row.metadata?.participant;
  if(!row.active||row.metadata?.siteRegister?.version!==1||part?.version!==1||!['INVITED','ACTIVE','REVOKED'].includes(part.status)||!/^\+[1-9]\d{7,14}$/.test(row.phone||''))fail('PARTICIPANT_ACCESS_REQUIRED',403);
  // A fresh canonical invitation replaces the active participant challenge.
  // Only the original immutable receipt may bypass its absence; any present
  // challenge is still validated before its current anchor can be locked.
  anchorProjectId=part.kycChatChallenge==null?null:challengeContext(row).anchorProjectId;
 }else{
  const current=challengeContext(row);part=current.part;anchorProjectId=current.anchorProjectId;
  sameIssuer(row,member);if(current.challenge.id!==p.challengeId)fail('PARTICIPANT_KYC_CHAT_INTEGRITY');
 }
 const discovered=part.status==='ACTIVE'||part.status==='REVOKED'&&part.clerkUserId?await principal(client,member.organizationId,{clerkUserId:part.clerkUserId},false):null;
 const identities=[{actorId:member.actorId,membershipId:member.membershipId},...(discovered?[{actorId:discovered.actorId,membershipId:discovered.membershipId}]:[])].sort((a,b)=>a.actorId.localeCompare(b.actorId));
 let issuer,own;
 for(const identity of identities){const current=await principal(client,member.organizationId,identity);if(identity.actorId===member.actorId)issuer=current;if(discovered&&identity.actorId===discovered.actorId)own=current;}
 if(!issuer||!participantManager(issuer.role)||issuer.role!==member.role||issuer.membershipId!==member.membershipId)fail('PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED',403);
 if(discovered&&(!own||own.clerkUserId!==part.clerkUserId||own.membershipId!==discovered.membershipId))fail('PARTICIPANT_ACCESS_REQUIRED',403);
 for(const identity of [...new Map([issuer,own].filter(Boolean).map(value=>[value.actorId,value])).values()].sort((a,b)=>a.actorId.localeCompare(b.actorId)))await lockPersonWorksiteJourney(client,identity);
 for(const id of [...new Set([anchorProjectId,input.projectId,...(recorded?[recorded.anchorProjectId]:[])].filter(Boolean))].sort()){
  const rows=(await client.query('SELECT id,status::text AS status FROM public."Project" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE',[id,member.organizationId])).rows;
  if(rows.length!==1||id===input.projectId&&rows[0].status!=='ACTIVE')fail('WORKSPACE_PROJECT_UNAVAILABLE',404);
 }
 prepared.set(client,{member:{...member},command:p,projectId:input.projectId,row,issuer,own,anchorProjectId,recorded,outerRequestDigest:digest(input),workerFingerprint:fingerprint([row.phone,row.revision,row.metadata.participant])});
}

async function localAuthority(client,r,row){
 sameIssuer(row,r.member);const {part:p,challenge:c,anchorProjectId}=challengeContext(row);
 if(c.id!==r.command.challengeId||anchorProjectId!==r.anchorProjectId)fail();
 const connection=(await client.query('SELECT id,"projectId","whatsappBusinessId","phoneNumberId",metadata FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 FOR SHARE',[c.connectionId,anchorProjectId])).rows;
 if(connection.length!==1||connection[0].whatsappBusinessId!==c.wabaId||connection[0].phoneNumberId!==c.phoneNumberId||connection[0].metadata?.credentialOrganizationId!==row.organizationId)fail();
 const revoked=p.status==='REVOKED';
 if(revoked){
  if(p.permissions?.attendance!==false||p.permissions?.report!==false||c.invitationId!==null&&p.invitation?.state!=='REVOKED')fail();
  const lifecycle=(await client.query('SELECT id,"actorId","entityType","entityId",metadata,"createdAt" FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"=\'Worker\' AND "entityId"=$2 AND action=\'participant.operation.recorded\' AND metadata->>\'kind\' IN (\'REVOKE\',\'RESTORE_ACCESS\',\'EXISTING_ACCOUNT_ASSIGNED\',\'INVITATION_ACCEPTED\',\'INVITATION_SENT\') ORDER BY "createdAt" DESC,id DESC LIMIT 1',[row.organizationId,row.id])).rows;
  const latest=lifecycle[0];if(lifecycle.length!==1||!workspaceId(latest.id)||!workspaceId(latest.actorId)||latest.metadata?.version!==1||latest.metadata.projectId!==row.projectId||latest.metadata.kind!=='REVOKE'||!hash(latest.metadata.requestDigest)||!(latest.createdAt instanceof Date)||!Number.isFinite(latest.createdAt.getTime()))fail();
 }
 if(p.status==='INVITED'||revoked&&!p.clerkUserId){
  if(p.clerkUserId||c.participantClerkUserId!==null||p.invitation?.state!==(revoked?'REVOKED':'SENT')||p.invitation.id!==c.invitationId)fail('PARTICIPANT_ACCESS_REQUIRED',403);
 }else{
  if(!r.own||p.clerkUserId!==r.own.clerkUserId||c.participantClerkUserId!==null&&c.participantClerkUserId!==r.own.clerkUserId)fail('PARTICIPANT_ACCESS_REQUIRED',403);
  const assignments=(await client.query('SELECT id,status::text AS status FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 FOR SHARE',[row.projectId,r.own.membershipId])).rows;
  if(assignments.length!==1||assignments[0].status!=='ACTIVE'&&(!revoked||assignments[0].status!=='DISABLED'))fail('PARTICIPANT_ACCESS_REQUIRED',403);
  // An invitation-bound capture can only survive the identity change as an
  // explicit stop, backed by the actual own canonical Clerk JOIN receipt.
  if(c.invitationId!==null){
   const i=p.invitation;if(i?.state!==(revoked?'REVOKED':'ACCEPTED')||i.id!==c.invitationId||!workspaceId(p.acceptanceReceiptId)||typeof i.email!=='string')fail();
   const accepted=(await client.query('SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action=\'participant.operation.recorded\' AND "entityType"=\'Worker\' AND "entityId"=$2 AND metadata->>\'kind\'=\'INVITATION_ACCEPTED\' AND metadata->>\'invitationId\'=$3',[row.organizationId,row.id,c.invitationId])).rows;
   if(accepted.length!==1||accepted[0].id!==p.acceptanceReceiptId||accepted[0].actorId!==r.own.actorId||accepted[0].metadata?.version!==1||accepted[0].metadata.projectId!==row.projectId||accepted[0].metadata.requestDigest!==digest([row.id,i.id,r.own.clerkUserId,i.email]))fail();
  }else if(c.participantClerkUserId!==r.own.clerkUserId)fail();
 }
 if(c.invitationId!==null){
  if(!/^invite_[a-f0-9]{32}$/.test(c.invitationId)||!/^orginv_[A-Za-z0-9]+$/.test(p.invitation?.providerId||''))fail();
  const invitations=(await client.query('SELECT id,"actorId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action=\'participant.operation.recorded\' AND "entityType"=\'Worker\' AND "entityId"=$2 AND metadata->>\'kind\'=\'INVITATION_SENT\' AND metadata->>\'invitationId\'=$3',[row.organizationId,row.id,c.invitationId])).rows;
  if(invitations.length!==1||invitations[0].metadata.projectId!==row.projectId||invitations[0].metadata.providerId!==p.invitation.providerId)fail();
 }
 const issued=(await client.query('SELECT id,"actorId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"=\'Worker\' AND "entityId"=$3 AND action=\'participant.kyc_chat.prepared\' AND metadata->>\'challengeId\'=$4',[row.organizationId,c.issuerActorId,row.id,c.id])).rows;
 if(issued.length!==1||issued[0].metadata.version!==1||issued[0].metadata.projectId!==row.projectId||issued[0].metadata.expiresAt!==c.expiresAt||!hash(issued[0].metadata.requestDigest))fail();
 const exterior=(await client.query('SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"=\'Worker\' AND "entityId"=$3 AND action=\'participant.operation.recorded\' AND metadata->>\'kind\'=\'PREPARE_KYC_CHAT\' AND metadata->>\'challengeReceiptId\'=$4',[row.organizationId,c.issuerActorId,row.id,issued[0].id])).rows;
 if(exterior.length!==1||exterior[0].metadata.version!==1||exterior[0].metadata.projectId!==row.projectId||exterior[0].metadata.expiresAt!==c.expiresAt||!hash(exterior[0].metadata.requestDigest))fail();
}

export async function cancelParticipantKycChat(client,member,project,input,{environment=process.env}={}){
 const p=command(member,project?.id,input),r=prepared.get(client);
 if(!r||r.projectId!==project.id||project.organizationId!==undefined&&project.organizationId!==member.organizationId||r.command.requestDigest!==p.requestDigest||memberFingerprint(r.member)!==memberFingerprint(member))fail('WORKSPACE_CONTEXT_CHANGED');
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[p.closureReceiptId]);
 const row=await worker(client,member,project.id,p.workerId,true);
 if(r.recorded){
  if(fingerprint([row.phone,row.revision,row.metadata.participant])!==r.workerFingerprint)fail('PARTICIPANT_REVISION_CHANGED');
  r.replayed=true;return {saved:true,replayed:true,kind:'CANCEL_KYC_CHAT',receiptId:p.receiptId,closureReceiptId:p.closureReceiptId,challengeId:p.challengeId};
 }
 await localAuthority(client,r,row);
 if(submitted(row.metadata.participant))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
 const prior=(await client.query('SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=\'participant.kyc_chat.closed\'',[p.receiptId,member.organizationId])).rows;
 if(prior.length){
  // Both receipts and the Worker were committed atomically. An orphan inner
  // audit is an integrity failure, not permission to manufacture the exterior.
  fail('PARTICIPANT_RECEIPT_INVALID');
 }
 if(row.revision!==p.revision||fingerprint([row.phone,row.revision,row.metadata.participant])!==r.workerFingerprint)fail('PARTICIPANT_REVISION_CHANGED');
 const c=row.metadata.participant.kycChatChallenge,state=conversation(row,environment);
 const sources=(await client.query('SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"=\'Worker\' AND "entityId"=$2 AND ((action=\'participant.operation.recorded\' AND metadata->>\'kind\'=\'KYC_SUBMITTED\' AND (metadata->\'channelCapture\'->>\'challengeId\'=$3 OR metadata->>\'challengeId\'=$3)) OR ($4::boolean AND action IN (\'participant.kyc_chat.projected\',\'participant.kyc_chat.dispatched\') AND metadata->>\'challengeId\'=$3)) LIMIT 1',[member.organizationId,row.id,c.id,c.status==='PENDING'])).rows;
 if(sources.length)fail('PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING');
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail();
 const updated={...c,status:'CANCELLED',cancelledAt:now.toISOString(),cancelledBy:member.actorId,closureReceiptId:p.closureReceiptId};
 const archive={version:1,projectId:project.id,anchorProjectId:r.anchorProjectId,requestDigest:p.requestDigest,closureReceiptId:p.closureReceiptId,challengeId:c.id,reason:p.reason,previousStatus:c.status,step:state?.step||null,challenge:structuredClone(c),conversation:structuredClone(row.metadata.participant.kycChatConversation??null),beforeChallengeDigest:fingerprint(c),afterChallengeDigest:fingerprint(updated),recordedAt:now.toISOString(),identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false,providerCalls:0};
 await client.query('INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,\'participant.kyc_chat.closed\',\'Worker\',$4,$5::jsonb)',[p.receiptId,member.organizationId,member.actorId,row.id,JSON.stringify(archive)]);
 const metadata={...row.metadata,participant:{...row.metadata.participant,kycChatChallenge:updated,kycChatConversation:null}};
 const changed=await client.query('UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 RETURNING id',[row.id,project.id,JSON.stringify(metadata)]);if(changed.rows.length!==1)fail();
 r.updated=updated;
 return {saved:true,replayed:false,kind:'CANCEL_KYC_CHAT',receiptId:p.receiptId,closureReceiptId:p.closureReceiptId,challengeId:p.challengeId};
}

async function afterWrite(client,member,input){
 const r=prepared.get(client);if(!r?.updated&&!r?.recorded)fail('PARTICIPANT_KYC_CHAT_INTEGRITY');
 const p=command(member,r.projectId,input);if(p.requestDigest!==r.command.requestDigest||memberFingerprint(member)!==memberFingerprint(r.member))fail('WORKSPACE_CONTEXT_CHANGED');
 const receipts=(await client.query('SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=\'participant.operation.recorded\'',[p.closureReceiptId,member.organizationId])).rows;
 if(receipts.length!==1||receipts[0].actorId!==member.actorId||receipts[0].entityType!=='Worker'||receipts[0].entityId!==p.workerId||receipts[0].metadata?.version!==1||receipts[0].metadata.projectId!==r.projectId||receipts[0].metadata.kind!=='CANCEL_KYC_CHAT'||receipts[0].metadata.closureReceiptId!==p.receiptId||receipts[0].metadata.challengeId!==p.challengeId||receipts[0].metadata.requestDigest!==r.outerRequestDigest)fail('PARTICIPANT_RECEIPT_INVALID');
 const rows=(await client.query('SELECT metadata,clock_timestamp() AS now FROM public."Worker" WHERE id=$1 AND "projectId"=$2',[p.workerId,r.projectId])).rows;
 // All principal/project/Worker locks remain held. The clock is fetched after
 // the extra audit, Worker update and root receipt; no await follows this fence.
 const row=rows[0],now=row?.now,c=row?.metadata?.participant?.kycChatChallenge;
 if(rows.length!==1||!(now instanceof Date)||!Number.isFinite(now.getTime()))fail();
 if(!r.recorded&&(c?.status!=='CANCELLED'||c.id!==p.challengeId||c.closureReceiptId!==p.closureReceiptId||fingerprint(c)!==fingerprint(r.updated)||row.metadata.participant.kycChatConversation!==null||submitted(row.metadata.participant)))fail();
 prepared.delete(client);
}
Object.defineProperties(cancelParticipantKycChat,{beforeProject:{value:beforeProject},afterWrite:{value:afterWrite}});
