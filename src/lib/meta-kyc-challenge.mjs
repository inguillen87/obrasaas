import {randomBytes,randomUUID} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {customerChannelActive} from './meta-customer-outbound.mjs';
import {prepareCompanyKycProjects,preparedCompanyKycChallenge,fencePreparedCompanyKycChallenge} from './company-channel-kyc.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';

export const META_KYC_CHALLENGE_TTL_MS=24*60*60*1000;
export const metaKycChallengeDigest=code=>typeof code==='string'&&/^IDENTIDAD [A-Za-z0-9_-]{43}$/.test(code)?digest(['meta-kyc-challenge-v1',code]):null;
export const metaKycOperationId=eventId=>{const h=digest(['meta-kyc-deposit-v1',eventId]);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};

// Called ONLY inside the canonical manager-authorized participant transaction.
// No delivery, account creation, operational permission or KYC approval occurs.
export async function prepareMetaKycChallenge(client,member,project,input){
 if(!['ADMIN','DIRECTOR'].includes(member?.role)||!workspaceId(member.actorId)||!workspaceId(member.membershipId)||!workspaceId(member.organizationId))fail('PARTICIPANT_MANAGE_REQUIRED',403);
 if(!workspaceId(project?.id)||project.organizationId!==undefined&&project.organizationId!==member.organizationId||!workspaceId(input?.workerId)||!operationId(input.operationId)||typeof input.revision!=='string')fail('META_KYC_CHALLENGE_INPUT_INVALID',400);
 const canonicalProject=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[project.id,member.organizationId])).rows;
 if(canonicalProject.length!==1)fail('WORKSPACE_PROJECT_UNAVAILABLE',404);
 const key='meta_kyc_challenge_'+digest([member.actorId,project.id,input.operationId]),requestDigest=digest([project.id,input.workerId,input.revision]);
 const previous=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.kyc_chat.prepared'`,[key,member.organizationId,member.actorId])).rows[0];
 if(previous){if(previous.metadata.requestDigest!==requestDigest)fail('PARTICIPANT_OPERATION_CONFLICT');return {saved:true,kind:'PREPARE_KYC_CHAT',receiptId:key,codeUnavailable:true,expiresAt:previous.metadata.expiresAt};}
 const row=(await client.query(`SELECT id,"projectId",phone,active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[input.workerId,project.id])).rows[0];
 if(!row?.active||row.metadata?.siteRegister?.version!==1||!['INVITED','ACTIVE'].includes(row.metadata?.participant?.status)||row.revision!==input.revision||!/^\+[1-9]\d{7,14}$/.test(row.phone||''))fail('META_KYC_CHALLENGE_PARTICIPANT_REQUIRED');
 if(['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM','APPROVED'].includes(row.metadata.participant.kyc?.status))fail('PARTICIPANT_KYC_ALREADY_SUBMITTED');
 // A new UUID or elapsed TTL must not erase a started private capture. Its
 // original issuer must explicitly close the draft and preserve its archive.
 if(['PENDING','CLAIMED'].includes(row.metadata.participant.kycChatChallenge?.status))fail('PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED');
 const duplicate=(await client.query(`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND phone=$2 AND active=true AND id<>$3 AND metadata->'participant'->>'status' IN ('INVITED','ACTIVE') LIMIT 1`,[project.id,row.phone,row.id])).rows;
 if(duplicate.length)fail('META_KYC_CHALLENGE_AMBIGUOUS');
 const corporate=await preparedCompanyKycChallenge(client,member,project.id,row);
 const channels=corporate?[corporate.channel]:(await client.query(`SELECT id,"projectId","whatsappBusinessId","phoneNumberId","connectionStatus"::text AS "connectionStatus",enabled,metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 FOR SHARE`,[project.id])).rows;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,channel=channels[0];
 if(row.metadata.participant.status==='INVITED'&&(row.metadata.participant.invitation?.state!=='SENT'||!row.metadata.participant.invitation.id||!Number.isFinite(Date.parse(row.metadata.participant.invitation.expiresAt))||Date.parse(row.metadata.participant.invitation.expiresAt)<=now.getTime()))fail('META_KYC_CHALLENGE_PARTICIPANT_REQUIRED');
 if(channels.length!==1||!customerChannelActive(channel,now.getTime())||channel.whatsappBusinessId===OBRASAAS_META_CHANNEL.wabaId||channel.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||channel.metadata?.credentialOrganizationId!==member.organizationId)fail('WORKER_CHANNEL_CUSTOMER_CONNECTION_REQUIRED',403);
 const expiresAt=new Date(Math.min(now.getTime()+META_KYC_CHALLENGE_TTL_MS,row.metadata.participant.status==='INVITED'?Date.parse(row.metadata.participant.invitation.expiresAt):Infinity)).toISOString();
 const code='IDENTIDAD '+randomBytes(32).toString('base64url'),challenge={version:1,id:'kyc_chat_'+randomUUID().replaceAll('-',''),status:'PENDING',codeDigest:metaKycChallengeDigest(code),organizationId:member.organizationId,projectId:project.id,workerId:row.id,senderE164:row.phone,connectionId:channel.id,wabaId:channel.whatsappBusinessId,phoneNumberId:channel.phoneNumberId,issuerActorId:member.actorId,issuerMembershipId:member.membershipId,participantClerkUserId:row.metadata.participant.clerkUserId||null,invitationId:row.metadata.participant.invitation?.id||null,createdAt:now.toISOString(),expiresAt,...(corporate?{companyKyc:corporate.descriptor}:{})};
 const metadata={...row.metadata,participant:{...row.metadata.participant,kycChatChallenge:challenge,kycChatConversation:null}};
 await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,project.id,JSON.stringify(metadata)]);
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc_chat.prepared','Worker',$4,$5::jsonb)`,[key,member.organizationId,member.actorId,row.id,JSON.stringify({version:1,projectId:project.id,requestDigest,challengeId:challenge.id,expiresAt:challenge.expiresAt,identityCertified:false,permissionsGranted:false})]);
 await fencePreparedCompanyKycChallenge(client,member,project.id);
 return {saved:true,kind:'PREPARE_KYC_CHAT',receiptId:key,code,codeUnavailable:false,expiresAt:challenge.expiresAt};
}

Object.defineProperties(prepareMetaKycChallenge,{beforeProject:{value:prepareCompanyKycProjects},afterWrite:{value:fencePreparedCompanyKycChallenge}});
