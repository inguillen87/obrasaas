import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {OBRASAAS_META_CHANNEL,checkObrasaasMetaBinding} from './meta-channel-binding.mjs';
import {resolveMetaTransport} from './meta-whatsapp-transport.mjs';
import {testRecipients} from './meta-test-dispatch.mjs';
import {customerVaultConfigured,decryptCustomerSecret,customerSecretDigest} from './meta-customer-credentials.mjs';
import {META_DEMO_PILOT_PROTOCOL} from './meta-cloud-protocol.mjs';
import {participantRevision} from './participant-policy.mjs';

export const META_DEMO_PILOT_TTL_MS=60*60000;
export const META_DEMO_NOTICE_VERSION='demo-pilot-v1';
export const META_DEMO_NOTICE='Autorizo una prueba de ObraSaaS con mi WhatsApp vinculado y una obra vacía dedicada al piloto DEMO. Los datos y mensajes de esta prueba no certifican identidad civil, biometría, asistencia real, seguros ni avances de una obra real. Puedo revocar la prueba. No se enviarán plantillas ni mensajes proactivos.';
export const META_DEMO_NOTICE_SHA256=digest(META_DEMO_NOTICE);
export const META_DEMO_REVIEW_CODES=Object.freeze(['META_DEMO_PILOT_INACTIVE','META_DEMO_PILOT_MEMBER_REQUIRED','META_DEMO_PILOT_CONSENT_REQUIRED','META_DEMO_PILOT_SCOPE_REJECTED','META_DEMO_PILOT_PROOF_REQUIRED']);
const fail=(code,status=403)=>{throw new WorkspaceError(code,status);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.sort().join('|');
export function metaDemoTransportReadiness(environment=process.env){
 const transport=resolveMetaTransport(environment),bound=checkObrasaasMetaBinding({...environment,VERCEL_ENV:'production'});
 const gates={fixedAssets:bound.ok,testMode:environment.META_CHANNEL_MODE==='test',credential:!transport.error,vault:customerVaultConfigured(environment),signature:typeof environment.META_APP_SECRET==='string'&&environment.META_APP_SECRET.length>=16&&environment.META_APP_SECRET!=='[SENSITIVE]',version:environment.META_GRAPH_API_VERSION==='v25.0',recipients:testRecipients(environment).length>0};
 const ready=Object.values(gates).every(Boolean);
 return {canLaunchMeta:ready,launchCode:ready?'META_DEMO_AUTHORIZATION_AVAILABLE':'META_DEMO_CONFIGURATION_PENDING',appId:OBRASAAS_META_CHANNEL.appId,version:'v25.0',gates,customerSignupVerified:false,customerActivation:false,productionVerified:false};
}
export function demoPilotCommand(input){
 if(!exact(input,['scope','projectId','operationId','action','payload'])||!workspaceId(input.projectId)||!operationId(input.operationId)||!/^[a-f0-9]{64}$/.test(input.scope||''))fail('META_DEMO_INPUT_INVALID',400);
 const p=input.payload,keys=input.action==='PREPARE'?['workerId','revision','noticeVersion','noticeSha256','confirmed','confirmedSandbox']:['REQUEST_CHALLENGE','UNLINK','REVOKE'].includes(input.action)?['workerId','revision']:null;
 if(!keys||!exact(p,keys)||!workspaceId(p.workerId)||typeof p.revision!=='string'||p.revision.length>64)fail('META_DEMO_INPUT_INVALID',400);
 participantRevision(p.revision);
 if(input.action==='PREPARE'&&(p.confirmed!==true||p.confirmedSandbox!==true||p.noticeVersion!==META_DEMO_NOTICE_VERSION||p.noticeSha256!==META_DEMO_NOTICE_SHA256))fail('META_DEMO_PILOT_CONSENT_REQUIRED',400);
 return {...input,operationId:input.operationId.toLowerCase(),payload:{...p}};
}
export function decodeDemoPilotGrant(connection,environment=process.env){
 const d=connection?.metadata?.demoPilot;
 if(d?.version!==1||d.purpose!=='DEMO_PILOT'||!workspaceId(d.grantId)||typeof d.encryptedGrant!=='string')fail('META_DEMO_PILOT_PROOF_REQUIRED',409);
 let grant;try{grant=JSON.parse(decryptCustomerSecret(d.encryptedGrant,{organizationId:connection.organizationId,projectId:connection.projectId,purpose:'demo-pilot-grant',resourceId:d.grantId},environment));}catch{fail('META_DEMO_PILOT_PROOF_REQUIRED',409);}
 if(grant?.version!==1||grant.purpose!=='DEMO_PILOT'||grant.grantId!==d.grantId||grant.organizationId!==connection.organizationId||grant.projectId!==connection.projectId||grant.channelId!==connection.id||grant.appId!==OBRASAAS_META_CHANNEL.appId||grant.wabaId!==OBRASAAS_META_CHANNEL.wabaId||grant.phoneNumberId!==OBRASAAS_META_CHANNEL.phoneNumberId||grant.noticeVersion!==META_DEMO_NOTICE_VERSION||grant.noticeSha256!==META_DEMO_NOTICE_SHA256||!workspaceId(grant.workerId)||!workspaceId(grant.actorId)||!workspaceId(grant.membershipId)||typeof grant.clerkUserId!=='string'||!/^\+[1-9]\d{7,14}$/.test(grant.senderE164||'')||!Number.isFinite(Date.parse(grant.createdAt))||!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=Date.parse(grant.createdAt)||Date.parse(grant.expiresAt)-Date.parse(grant.createdAt)>META_DEMO_PILOT_TTL_MS)fail('META_DEMO_PILOT_PROOF_REQUIRED',409);
 return grant;
}
export function assertDemoPilotConnection(connection,organizationId,projectId,now=Date.now(),{operational=true,allowInactive=false}={},environment=process.env){
 if(!connection||connection.organizationId!==organizationId||connection.projectId!==projectId||connection.phoneNumberId!==OBRASAAS_META_CHANNEL.phoneNumberId||connection.whatsappBusinessId!==OBRASAAS_META_CHANNEL.wabaId||connection.metadata?.credentialFormat!==META_DEMO_PILOT_PROTOCOL.credentialFormat||connection.metadata?.credentialOrganizationId!==organizationId||typeof connection.encryptedAccessToken!=='string')fail('META_DEMO_PILOT_SCOPE_REJECTED');
 const grant=decodeDemoPilotGrant(connection,environment);
 if(!allowInactive&&(connection.enabled!==true||connection.connectionStatus!=='CONNECTED'||connection.metadata.demoPilot.state!=='ACTIVE'||Date.parse(grant.createdAt)>now+60000||Date.parse(grant.expiresAt)<=now))fail('META_DEMO_PILOT_INACTIVE',409);
 if(!allowInactive&&(!metaDemoTransportReadiness(environment).canLaunchMeta||!testRecipients(environment).includes(grant.senderE164.slice(1))))fail('META_DEMO_CONFIGURATION_PENDING',503);
 if(!allowInactive){let token;try{token=decryptCustomerSecret(connection.encryptedAccessToken,{organizationId,projectId,purpose:META_DEMO_PILOT_PROTOCOL.credentialPurpose,resourceId:connection.phoneNumberId},environment);}catch{fail('META_DEMO_PILOT_PROOF_REQUIRED',409);}if(customerSecretDigest(token)!==grant.credentialDigest||customerSecretDigest(resolveMetaTransport(environment).token)!==grant.credentialDigest)fail('META_DEMO_PILOT_INACTIVE',409);}
 void operational;return connection;
}
export function labelDemoPilotReply(reply){
 const label='🧪 DEMO · obra de prueba\n\n';
 if(reply?.type==='text'&&typeof reply.body==='string')return {...reply,body:label+reply.body};
 if(reply?.type==='interactive'&&typeof reply.body==='string')return {...reply,body:label+reply.body};
 fail('META_CUSTOMER_REPLY_INVALID',400);
}
export async function assertDemoPilotResolved(client,resolved,environment=process.env){
 const {connection,member,project,worker}=resolved,now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();
 assertDemoPilotConnection(connection,member.organizationId,project.id,now,{},environment);const grant=decodeDemoPilotGrant(connection,environment),kyc=worker.metadata?.participant?.kyc;
 if(member.role!=='ADMIN'||member.clerkRole!=='org:admin'||member.actorId!==grant.actorId||member.membershipId!==grant.membershipId||member.clerkUserId!==grant.clerkUserId||worker.id!==grant.workerId||worker.phone!==grant.senderE164||kyc?.submissionId!==grant.kycSubmissionId||kyc?.review?.recordedAt!==grant.kycReviewedAt||project.metadata?.demoPilotSandbox?.grantId!==grant.grantId)fail('META_DEMO_PILOT_MEMBER_REQUIRED');
 const receipt=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.demo.pilot.recorded'`,[grant.grantId,member.organizationId,member.actorId,project.id])).rows[0];
 if(receipt?.metadata?.kind!=='PREPARE'||receipt.metadata.grantDigest!==digest(grant)||receipt.metadata.noticeSha256!==META_DEMO_NOTICE_SHA256)fail('META_DEMO_PILOT_CONSENT_REQUIRED');
 return resolved;
}
export async function lockDemoPilotChannel(client,{wabaId,phoneNumberId,projectId=null,payload},environment=process.env,{allowInactive=false}={}){
 if(wabaId!==OBRASAAS_META_CHANNEL.wabaId||phoneNumberId!==OBRASAAS_META_CHANNEL.phoneNumberId)fail('META_DEMO_ASSET_REJECTED');
 const candidates=(await client.query(`SELECT c.id,c."projectId",p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c."phoneNumberId"=$1 AND c."whatsappBusinessId"=$2 AND ($3::text IS NULL OR c."projectId"=$3) AND p.status='ACTIVE' AND c.metadata->'demoPilot'->>'purpose'='DEMO_PILOT'`,[phoneNumberId,wabaId,projectId])).rows;
 if(candidates.length!==1)fail('META_DEMO_PILOT_SCOPE_REJECTED');const candidate=candidates[0];
 const project=(await client.query(`SELECT id,"organizationId",metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[candidate.projectId,candidate.organizationId])).rows[0];
 const channel=(await client.query(`SELECT id,"projectId","whatsappBusinessId","phoneNumberId",enabled,"connectionStatus"::text AS "connectionStatus","encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[candidate.id,candidate.projectId])).rows[0];
 if(!project||!channel)fail('META_DEMO_PILOT_SCOPE_REJECTED');const c={...channel,organizationId:project.organizationId};
 const inactiveAllowed=allowInactive||payload?.type==='message_status',now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();
 assertDemoPilotConnection(c,project.organizationId,project.id,now,{allowInactive:inactiveAllowed},environment);const grant=decodeDemoPilotGrant(c,environment);
 if(project.metadata?.demoPilotSandbox?.grantId!==grant.grantId)fail('META_DEMO_PILOT_SCOPE_REJECTED');
 const audit=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.demo.pilot.recorded'`,[grant.grantId,project.organizationId,grant.actorId,project.id])).rows[0];
 if(audit?.metadata?.kind!=='PREPARE'||audit.metadata.grantDigest!==digest(grant))fail('META_DEMO_PILOT_CONSENT_REQUIRED');
 if(payload?.type==='message'&&payload.value?.from!==grant.senderE164.slice(1))fail('META_DEMO_PILOT_MEMBER_REQUIRED');
 return c;
}
