import {createHmac} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId as validOperationId} from './workspace-policy.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {metaCustomerContentDigest as durableDigest} from './meta-customer-callback.mjs';
import {customerChannelActive,customerJobTransaction,customerOutboundId,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from './company-channel-schema.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {beginEmployeeIntakeConversation,planEmployeeIntakeConversation,META_KYC_CONVERSATION_TTL_MS,EMPLOYEE_INTAKE_NOTICE_VERSION,EMPLOYEE_INTAKE_NOTICE} from './meta-kyc-conversation.mjs';
import {SITE_ROLES} from './site-register-policy.mjs';
import {createSiteRegister} from './site-register-store.mjs';
import {participantReceiptId} from './participant-policy.mjs';
import {META_CUSTOMER_PROTOCOL} from './meta-cloud-protocol.mjs';
import {companyKycProjectionContract,companyKycProjectionId,companyKycProjectionDigest} from './company-channel-kyc.mjs';
import {prelockReactiveOnboarding,planReactiveOnboarding,reactiveOnboardingAuthority,decodeReactiveStart,authorizeReactiveKycStart} from './participant-onboarding-reactive.mjs';
import {assertEmployeeIntakeChannelContinuity} from './employee-intake-channel-continuity.mjs';

export const EMPLOYEE_INTAKE_ACTIONS=Object.freeze(['CONFIGURE_EMPLOYEE_INTAKE','ADMIT_EMPLOYEE_INTAKE','REJECT_EMPLOYEE_INTAKE']);
export const EMPLOYEE_INTAKE_AUTHORIZATION_CODES=Object.freeze(['EMPLOYEE_INTAKE_DISABLED','EMPLOYEE_INTAKE_REVOKED','EMPLOYEE_INTAKE_EXPIRED','EMPLOYEE_INTAKE_INTEGRITY','EMPLOYEE_INTAKE_MESSAGE_OUT_OF_ORDER','EMPLOYEE_INTAKE_CONTEXT_REQUIRED']);
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const eventId=value=>/^customer_webhook_[a-f0-9]{64}$/.test(value||'');
const namespace='employeeIntake';
const outboundAuthorities=new WeakMap();
const context=(connection,purpose,resourceId)=>({organizationId:connection.organizationId,projectId:connection.projectId,purpose,resourceId});
const seal=(connection,purpose,id,value,environment)=>encryptCustomerSecret(JSON.stringify(value),context(connection,purpose,id),environment);
function unseal(connection,purpose,id,value,environment){try{return JSON.parse(decryptCustomerSecret(value,context(connection,purpose,id),environment));}catch{fail('EMPLOYEE_INTAKE_INTEGRITY');}}
const grant=connection=>digest([connection.id,connection.projectId,connection.whatsappBusinessId,connection.phoneNumberId,connection.encryptedAccessToken,connection.metadata?.credentialOrganizationId,connection.metadata?.customerSignupId]);
function senderKey(connection,sender,environment){const key=environment.META_CUSTOMER_CREDENTIALS_KEY||environment.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;if(!/^[A-Za-z0-9+/]{43}=$/.test(key||''))fail('META_CUSTOMER_VAULT_UNAVAILABLE',503);return createHmac('sha256',Buffer.from(key,'base64')).update(JSON.stringify(['employee-intake-sender-v1',connection.organizationId,connection.id,sender])).digest('hex');}
async function issuerTrail(client,organizationId,membershipId){return durableDigest((await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='TenantMembership' AND "entityId"=$2 AND action='participant.operation.recorded' ORDER BY id`,[organizationId,membershipId])).rows);}
function readState(anchor,connection,environment){
 const envelope=anchor.payload?.[namespace];if(!envelope||envelope.version!==1||envelope.applicationId!==anchor.id||envelope.organizationId!==connection.organizationId||envelope.connectionId!==connection.id||!Number.isSafeInteger(envelope.revision)||envelope.revision<1||!/^([a-f0-9]{64})$/.test(envelope.senderKey||''))fail('EMPLOYEE_INTAKE_INTEGRITY');
 const state=unseal(connection,'employee-intake',anchor.id,envelope.encryptedState,environment);
 if(state.applicationId!==anchor.id||state.organizationId!==connection.organizationId||state.connectionId!==connection.id||state.revision!==envelope.revision||state.senderKey!==envelope.senderKey||state.status!==envelope.status||state.step!==state.status||!['NAME','JOB','EMAIL','CONFIRM','WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(state.status)||!/^\+[1-9]\d{7,14}$/.test(state.sender||'')||state.lastEventId!==envelope.lastEventId||!eventId(state.lastEventId)||state.noticeVersion!==EMPLOYEE_INTAKE_NOTICE_VERSION||state.noticeSha256!==digest(EMPLOYEE_INTAKE_NOTICE)||!Number.isFinite(Date.parse(state.expiresAt)))fail('EMPLOYEE_INTAKE_INTEGRITY');return state;
}
async function writeState(client,anchor,connection,state,environment){
 const envelope={version:1,applicationId:anchor.id,organizationId:connection.organizationId,connectionId:connection.id,senderKey:state.senderKey,revision:state.revision,status:state.status,lastEventId:state.lastEventId,encryptedState:seal(connection,'employee-intake',anchor.id,state,environment)};
 const updated=await client.query(`UPDATE public."WebhookEvent" SET payload=jsonb_set(payload,'{employeeIntake}',$2::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$3 AND provider='meta-customer-v1'`,[anchor.id,JSON.stringify(envelope),connection.projectId]);if(updated.rowCount!==1)fail('EMPLOYEE_INTAKE_INTEGRITY');anchor.payload={...anchor.payload,[namespace]:envelope};
}
async function currentPolicy(client,connection,now,{enabled=true,expected=null,lock=true,environment=process.env}={}){
 const p=connection.metadata?.employeeIntakePolicy;
 if(!p||p.version!==1||typeof p.enabled!=='boolean'||!Number.isSafeInteger(p.revision)||p.revision<1)fail('EMPLOYEE_INTAKE_DISABLED');
 if(enabled&&p.enabled!==true)fail('EMPLOYEE_INTAKE_DISABLED');
 if(connection.metadata?.developmentPilot||connection.company?.mode!=='COMPANY'||!customerChannelActive(connection,now.getTime(),{environment})||p.grantDigest!==grant(connection))fail('EMPLOYEE_INTAKE_REVOKED');
 await lockOwnCompanyIssuer(client,connection,{environment,now:now.getTime(),lock});
 const issued=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='WhatsAppConnection' AND "entityId"=$4 AND action='participant.operation.recorded' ${lock?'FOR SHARE':''}`,[p.receiptId,connection.organizationId,p.issuerActorId,connection.id])).rows[0];
 if(issued?.metadata?.kind!=='CONFIGURE_EMPLOYEE_INTAKE'||issued.metadata.intakePolicyDigest!==durableDigest(p))fail('EMPLOYEE_INTAKE_REVOKED');
 const issuer=(await client.query(`SELECT u.id AS "actorId",tm.id AS "membershipId",tm."tenantRole"::text AS role,to_char(tm."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id WHERE u.id=$1 AND tm.id=$2 AND tm."organizationId"=$3 AND tm.status='ACTIVE' ${lock?'FOR SHARE OF u,tm':''}`,[p.issuerActorId,p.issuerMembershipId,connection.organizationId])).rows[0];
 if(!issuer||issuer.role!=='ADMIN'||issuer.revision!==p.issuerRevision||await issuerTrail(client,connection.organizationId,issuer.membershipId)!==p.issuerTrail||expected&&expected!==durableDigest(p))fail('EMPLOYEE_INTAKE_REVOKED');
 await assertEmployeeIntakeChannelContinuity(client,connection,p,{lock});return {policy:p,issuer};
}

async function isCompanyKycReplyIntent(client,connection,message,environment){
 const choice=message.interactive?.list_reply?.id||message.interactive?.button_reply?.id;
 // This discriminates routing only. The KYC resolver validates the encrypted
 // reactive source, current invitation/consent, SENT context and nonce.
 if(typeof choice==='string'&&choice.startsWith('kyc-start:'))return true;
 const invalid=()=>{if(typeof choice==='string'&&choice.startsWith('kyc:'))fail('META_KYC_COMPANY_CONTEXT_REQUIRED');return false;};
 const replyId=message.context?.id;if(typeof replyId!=='string'||!replyId)return invalid();
 const rows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$2 AND outcome->>'messageId'=$3`,[connection.projectId,connection.id,replyId])).rows;
 if(rows.length!==1)return invalid();
 const row=rows[0];let prepared;
 try{prepared=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,context(connection,'outbound',row.id),environment));}catch{fail('EMPLOYEE_INTAKE_INTEGRITY');}
 if(!prepared||typeof prepared!=='object'||Array.isArray(prepared))fail('EMPLOYEE_INTAKE_INTEGRITY');
 if(prepared.channelPurpose!=='KYC_CAPTURE')return invalid();
 if(prepared.version!==1||!eventId(prepared.eventId)||row.id!==customerOutboundId(prepared.eventId)||digest(prepared)!==row.payload.requestDigest||prepared.organizationId!==connection.organizationId||prepared.channelId!==connection.id||prepared.to!==message.from||!['SENT','STATUS_OBSERVED'].includes(row.outcome?.state)||['failed','deleted'].includes(row.outcome?.providerStatus)||row.outcome.messageId!==replyId)fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
 const projected=(await client.query(`SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.kyc_chat.projected' AND "entityType"='Worker'`,[companyKycProjectionId(prepared.eventId),connection.organizationId])).rows;
 if(projected.length!==1)fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
 const projection=companyKycProjectionContract(projected[0].metadata,{sourceEventId:prepared.eventId,organizationId:connection.organizationId,connectionId:connection.id,anchorProjectId:connection.projectId});
 if(projected[0].actorId!==(projection.participantActorId||projection.issuerActorId)||projected[0].entityId!==projection.workerId||prepared.companyKycDigest!==companyKycProjectionDigest(projection)||prepared.targetProjectId!==projection.targetProjectId||prepared.challengeId!==projection.challengeId||prepared.payloadDigest!==projection.payloadDigest)fail('META_KYC_COMPANY_CONTEXT_REQUIRED');
 // Read-only routing intent, never authority. The following KYC bridge must
 // revalidate the signed source, principals, grant, assignment, nonce and lease
 // before writing its own projection. This classifier performs no mutation.
 return true;
}

// Limited signed intake authority: never a participant, Clerk actor or FIELD route.
export async function resolveEmployeeIntakeAuthority(client,request,{environment=process.env,outbound=false}={}){
 if(!eventId(request?.eventId))fail('EMPLOYEE_INTAKE_INTEGRITY');
 const initial=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1`,[request.eventId])).rows[0];
 if(!initial||initial.provider!=='meta-customer-v1'||initial.eventType!=='message')return null;
 const raw=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p.status='ACTIVE'`,[initial.payload?.channelId,initial.projectId])).rows[0];
 if(!raw)fail('EMPLOYEE_INTAKE_REVOKED');await lockOwnCompanyIssuer(client,raw,{environment});const payload=decodeSignedCustomerEvent(initial,raw,environment);if(payload.type!=='message')return null;
 const signed=JSON.parse(decryptCustomerSecret(initial.payload.encryptedProof,context(raw,META_CUSTOMER_PROTOCOL.proofPurpose,initial.id),environment));
 if(!signed.companyRouting){if(raw.metadata?.companyRoutingVersion===1)fail('EMPLOYEE_INTAKE_REVOKED');return null;}
 const message=payload.value,sender='+'+message.from,key=senderKey(raw,sender,environment);
 const anchors=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->'employeeIntake'->>'connectionId'=$2 AND payload->'employeeIntake'->>'senderKey'=$3 AND payload->'employeeIntake'->>'status' NOT IN ('CANCELLED','REJECTED') ORDER BY "createdAt",id LIMIT 2`,[raw.projectId,raw.id,key])).rows;
 const hello=message.type==='text'&&message.text?.body?.trim().toUpperCase()==='HOLA';
 // A challenge or binding command is its own discriminated authority. A prior
 // limited request never captures those commands or private image messages.
 const command=message.type==='text'?message.text?.body?.trim().toUpperCase():'';
 if(!initial.payload.employeeIntakeDispatch&&(message.type==='image'||/^(IDENTIDAD|VINCULAR)(?:\s|$)/.test(command)))return null;
 if(!initial.payload.employeeIntakeDispatch&&await isCompanyKycReplyIntent(client,raw,message,environment))return null;
 if(!hello&&!anchors.length&&!initial.payload.employeeIntakeDispatch)return null;
 // This lookup grants no authority. Every new message from a linked sender
 // must reach FIELD's complete identity/assignment/permission resolver, even
 // when its old intake anchor is ADMITTED or the opt-in is now OFF.
 if(!initial.payload.employeeIntakeDispatch){const bound=(await client.query(`SELECT w.id FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE p."organizationId"=$1 AND w.active=true AND w.phone=$2 AND w.metadata->'participant'->'channelIdentity'->'binding'->>'status'='VERIFIED' AND w.metadata->'participant'->'channelIdentity'->'binding'->>'connectionId'=$3 LIMIT 1`,[raw.organizationId,sender,raw.id])).rows;if(bound.length)return null;}
 if(anchors.length>1)fail('EMPLOYEE_INTAKE_INTEGRITY');
 const proof=initial.payload.companyRouting;
 // Routing metadata is also independently present inside the encrypted signed proof.
 if(!signed.companyRouting||signed.companyRouting.mode!=='COMPANY'||signed.companyRouting.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT||proof&&durableDigest(proof)!==durableDigest(signed.companyRouting))fail('EMPLOYEE_INTAKE_REVOKED');
 const member0=raw.metadata?.employeeIntakePolicy;
 if(!member0)fail('EMPLOYEE_INTAKE_DISABLED');
 const reactivePref=currentAnchorState(raw,anchors,environment);
 const reactive=await prelockReactiveOnboarding(client,raw,reactivePref);
 // Lock issuer before project/channel/event, matching canonical principal order.
 const pre=(await client.query(`SELECT tm.id FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm.id=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' FOR SHARE OF u,tm`,[member0.issuerMembershipId,raw.organizationId])).rows;if(pre.length!==1)fail('EMPLOYEE_INTAKE_REVOKED');
 const project=(await client.query(`SELECT id,name,"organizationId" FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[raw.projectId,raw.organizationId])).rows[0];if(!project)fail('EMPLOYEE_INTAKE_REVOKED');
 const connection=await companyConnectionForProject(client,raw.organizationId,raw.projectId,true),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(!connection||connection.id!==raw.id||connection.company.mode!=='COMPANY'||connection.metadata?.developmentPilot||signed.companyRouting.revision!==connection.company.revision)fail('EMPLOYEE_INTAKE_REVOKED');
 const {policy,issuer}=await currentPolicy(client,connection,now,{environment});
 const event=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[request.eventId,project.id])).rows[0];
 if(!event||event.status!=='PENDING'||event.leaseToken!==request.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime()||event.projectId!==request.projectId||event.payload?.channelId!==request.channelId||event.payload.payloadDigest!==request.payloadDigest)fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
 const finalPayload=decodeSignedCustomerEvent(event,connection,environment);assertCustomerReplyWindow(finalPayload,now.getTime());if(digest(finalPayload)!==digest(payload))fail('EMPLOYEE_INTAKE_INTEGRITY');
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['employee-intake:'+connection.organizationId+':'+connection.id+':'+key]);
 const currentAnchors=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->'employeeIntake'->>'connectionId'=$2 AND payload->'employeeIntake'->>'senderKey'=$3 AND payload->'employeeIntake'->>'status' NOT IN ('CANCELLED','REJECTED') ORDER BY "createdAt",id LIMIT 2 FOR UPDATE`,[raw.projectId,raw.id,key])).rows;if(currentAnchors.length>1)fail('EMPLOYEE_INTAKE_INTEGRITY');
 const anchorId=event.payload.employeeIntakeDispatch?.applicationId||currentAnchors[0]?.id||event.id;
 let anchor=anchorId===event.id?event:(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[anchorId,project.id])).rows[0];if(!anchor)fail('EMPLOYEE_INTAKE_INTEGRITY');
 let state=anchor.payload.employeeIntake?readState(anchor,connection,environment):null;
 // A human HOLA may restart only an incomplete expired/stale draft. The
 // original signed envelope and encrypted draft stay on their original event.
 if(state&&!event.payload.employeeIntakeDispatch&&hello&&['NAME','JOB','EMAIL','CONFIRM'].includes(state.status)&&(Date.parse(state.expiresAt)<=now.getTime()||state.policyDigest!==durableDigest(policy))){
  if(state.sender!==sender||state.senderKey!==key)fail('EMPLOYEE_INTAKE_INTEGRITY');
  await writeState(client,anchor,connection,{...state,revision:state.revision+1,step:'CANCELLED',status:'CANCELLED',cancelReason:Date.parse(state.expiresAt)<=now.getTime()?'EXPIRED':'POLICY_CHANGED'},environment);anchor=event;state=null;
 }
 if(state&&(state.sender!==sender||state.senderKey!==key||state.policyDigest!==durableDigest(policy)))fail('EMPLOYEE_INTAKE_REVOKED');
 const r={kind:'LIMITED_PARTICIPANT_INTAKE',member:{...issuer,organizationId:connection.organizationId},project,connection,event,anchor,payload:finalPayload,now,state,sender,key,policy,reactive};
 const dispatch=event.payload.employeeIntakeDispatch;
 if(dispatch){if(dispatch.version!==1||dispatch.payloadDigest!==request.payloadDigest||dispatch.policyDigest!==durableDigest(policy)||dispatch.applicationId!==anchor.id)fail('EMPLOYEE_INTAKE_INTEGRITY');r.recorded=unseal(connection,'employee-intake-dispatch',event.id,dispatch.encryptedResult,environment);if(r.recorded.kind!=='EMPLOYEE_INTAKE'||r.recorded.identityStatus!=='LIMITED_PARTICIPANT_INTAKE'||digest(r.recorded.reply)!==dispatch.replyDigest)fail('EMPLOYEE_INTAKE_INTEGRITY');}
 // Meta timestamps have second precision. Equal seconds are legitimate when
 // the exact prompt is cited. Later plain NAME/EMAIL drafts have a separate
 // confirmed-outbox time fence; consent and authority never use that fallback.
 if(state&&!r.recorded&&state.lastEventId!==event.id&&Number(message.timestamp)<state.lastMessageTimestamp)fail('EMPLOYEE_INTAKE_MESSAGE_OUT_OF_ORDER');
 if(state&&!['WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(state.status)&&Date.parse(state.expiresAt)<=now.getTime())fail('EMPLOYEE_INTAKE_EXPIRED');
 if(!r.recorded&&state?.messageCount>=40)fail('EMPLOYEE_INTAKE_EXPIRED');
 if(outbound&&(!r.recorded||state?.lastEventId!==event.id))fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 if(r.recorded?.reactiveOnboarding){const p=r.recorded.reactiveOnboarding,a=await reactiveOnboardingAuthority(client,r,reactive,{environment,proof:p.kind==='KYC_START'?p:null});if(!a||p.authorityDigest!==a.authorityDigest||p.eventId!==event.id||p.applicationId!==anchor.id||durableDigest(state.reactiveOnboarding)!==durableDigest(p)||Date.parse(p.expiresAt)<=a.now.getTime())fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');}
 if(outbound&&!r.recorded.reactiveOnboarding){
  const transactionId=(await client.query('SELECT pg_current_xact_id()::text AS "intakeTransactionId"')).rows[0]?.intakeTransactionId;
  if(typeof transactionId!=='string'||!/^\d{1,20}$/.test(transactionId))fail('EMPLOYEE_INTAKE_INTEGRITY');
  const notAfter=Math.min(Date.parse(event.leaseExpiresAt),Number(finalPayload.value.timestamp)*1000+24*3600000,state&&!['WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(state.status)?Date.parse(state.expiresAt):Infinity);
  outboundAuthorities.set(r,{client,transactionId,notAfter,requestDigest:durableDigest(request),channelDigest:outboundChannelDigest(connection),eventPayloadDigest:durableDigest(event.payload),anchorPayloadDigest:durableDigest(anchor.payload),policyDigest:durableDigest(policy),replyDigest:durableDigest(r.recorded.reply)});
 }
 return r;
}
function outboundChannelDigest(c){return durableDigest({id:c.id,projectId:c.projectId,organizationId:c.organizationId,phoneNumberId:c.phoneNumberId,whatsappBusinessId:c.whatsappBusinessId,enabled:c.enabled,connectionStatus:c.connectionStatus,encryptedAccessToken:c.encryptedAccessToken,displayPhoneNumber:c.displayPhoneNumber,metadata:c.metadata,company:c.company});}
export const hasEmployeeIntakeOutboundAuthority=(client,r)=>outboundAuthorities.get(r)?.client===client;
export function employeeIntakeOutboundDeadline(client,r){const proof=outboundAuthorities.get(r);if(!proof||proof.client!==client||!Number.isSafeInteger(proof.notAfter))fail('EMPLOYEE_INTAKE_INTEGRITY');return proof.notAfter;}
export const releaseEmployeeIntakeOutboundAuthority=r=>outboundAuthorities.delete(r);
// The complete signed/nonce/authority resolver already owns the canonical
// locks. Recheck its exact current rows and clock without repeating discovery,
// schema catalog queries, decryption or the full planner on every Graph await.
export async function fenceEmployeeIntakeOutboundAuthority(client,r,request){
 const proof=outboundAuthorities.get(r);
 if(!proof||proof.client!==client||proof.requestDigest!==durableDigest(request)||proof.policyDigest!==durableDigest(r.policy)||proof.replyDigest!==durableDigest(r.recorded?.reply)||proof.channelDigest!==outboundChannelDigest(r.connection))fail('EMPLOYEE_INTAKE_INTEGRITY');
 const rows=(await client.query(`SELECT e.*,clock_timestamp() AS "intakeNow",pg_current_xact_id()::text AS "intakeTransactionId",anchor.payload AS "intakeAnchorPayload",to_jsonb(c) AS "intakeConnection",cc."connectionId" AS "intakeOwnerConnectionId",cc."anchorProjectId" AS "intakeAnchorProjectId",cc.mode AS "intakeMode",cc.revision AS "intakeOwnerRevision",assignment.revision AS "intakeAssignmentRevision",tm."tenantRole"::text AS "intakeIssuerRole",to_char(tm."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "intakeIssuerRevision",receipt.metadata AS "intakePolicyReceipt",COALESCE((SELECT jsonb_agg(jsonb_build_object('id',trail.id,'metadata',trail.metadata) ORDER BY trail.id) FROM public."AuditLog" trail WHERE trail."organizationId"=$5 AND trail."entityType"='TenantMembership' AND trail."entityId"=$6 AND trail.action='participant.operation.recorded'),'[]'::jsonb) AS "intakeIssuerTrail"
  FROM public."WebhookEvent" e JOIN public."WebhookEvent" anchor ON anchor.id=$4 AND anchor."projectId"=e."projectId"
  JOIN public."WhatsAppConnection" c ON c.id=$3 AND c."projectId"=e."projectId" JOIN public."Project" p ON p.id=c."projectId" AND p."organizationId"=$5 AND p.status='ACTIVE'
  JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."organizationId"=$5 AND cc.mode='COMPANY'
  JOIN public."WhatsAppChannelProjectAssignment" assignment ON assignment."connectionId"=c.id AND assignment."organizationId"=$5 AND assignment."projectId"=p.id AND assignment.status='ACTIVE'
  JOIN public."TenantMembership" tm ON tm.id=$6 AND tm."organizationId"=$5 AND tm."userId"=$7 AND tm.status='ACTIVE' JOIN public."PlatformUser" u ON u.id=tm."userId"
  JOIN public."AuditLog" receipt ON receipt.id=$8 AND receipt."organizationId"=$5 AND receipt."actorId"=u.id AND receipt."entityType"='WhatsAppConnection' AND receipt."entityId"=c.id AND receipt.action='participant.operation.recorded'
  WHERE e.id=$1 AND e."projectId"=$2 AND e.provider='meta-customer-v1' AND e."eventType"='message' FOR UPDATE OF e,anchor FOR SHARE OF c,p,cc,assignment,tm,u,receipt`,[r.event.id,r.connection.projectId,r.connection.id,r.anchor.id,r.connection.organizationId,r.policy.issuerMembershipId,r.policy.issuerActorId,r.policy.receiptId])).rows;
 if(rows.length!==1)fail('EMPLOYEE_INTAKE_REVOKED');const row=rows[0],now=row.intakeNow;
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||row.intakeTransactionId!==proof.transactionId)fail('EMPLOYEE_INTAKE_INTEGRITY');
 if(row.status!=='PENDING'||row.leaseToken!==request.leaseToken||!Number.isFinite(Date.parse(row.leaseExpiresAt))||Date.parse(row.leaseExpiresAt)<=now.getTime()||row.projectId!==request.projectId||row.payload?.channelId!==request.channelId||row.payload.payloadDigest!==request.payloadDigest)fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
 const current={...row.intakeConnection,organizationId:r.connection.organizationId,company:{connectionId:row.intakeOwnerConnectionId,anchorProjectId:row.intakeAnchorProjectId,mode:row.intakeMode,revision:row.intakeOwnerRevision,assignmentRevision:row.intakeAssignmentRevision,targetProjectId:r.project.id,organizationId:r.connection.organizationId}};
 if(outboundChannelDigest(current)!==proof.channelDigest||durableDigest(row.payload)!==proof.eventPayloadDigest||durableDigest(row.intakeAnchorPayload)!==proof.anchorPayloadDigest||row.intakeIssuerRole!=='ADMIN'||row.intakeIssuerRevision!==r.policy.issuerRevision||row.intakePolicyReceipt?.kind!=='CONFIGURE_EMPLOYEE_INTAKE'||row.intakePolicyReceipt.intakePolicyDigest!==proof.policyDigest||durableDigest(row.intakeIssuerTrail)!==r.policy.issuerTrail)fail('EMPLOYEE_INTAKE_REVOKED');
 if(r.state&&!['WAITING_RESPONSIBLE','ADMITTED','REJECTED','CANCELLED'].includes(r.state.status)&&Date.parse(r.state.expiresAt)<=now.getTime())fail('EMPLOYEE_INTAKE_EXPIRED');assertCustomerReplyWindow(r.payload,now.getTime());return now;
}
function currentAnchorState(connection,anchors,environment){return anchors.length===1?readState(anchors[0],connection,environment):null;}

export async function resolveReactiveKycStart(client,initial,connection,payload,{environment=process.env}={}){
 const message=payload.value,choice=message?.interactive?.list_reply?.id||message?.interactive?.button_reply?.id;
 if(typeof choice!=='string'||!choice.startsWith('kyc-start:'))return null;
 if(!/^kyc-start:[a-f0-9]{40}$/.test(choice)||!message.context?.id)fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 const rows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$2 AND outcome->>'messageId'=$3`,[connection.projectId,connection.id,message.context.id])).rows;
 if(rows.length!==1)fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 const request=unseal(connection,'outbound',rows[0].id,rows[0].payload?.encryptedPayload,environment);
 if(!eventId(request?.eventId))fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 const sources=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,[request.eventId,connection.projectId])).rows;
 if(sources.length!==1||sources[0].payload.channelId!==connection.id)fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 const source=sources[0],signed=decodeSignedCustomerEvent(source,connection,environment);
 if(signed.type!=='message'||signed.value.from!==message.from)fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 const proof=decodeReactiveStart(rows[0],source,connection,message,environment);
 const anchors=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,[proof.applicationId,connection.projectId])).rows;
 if(anchors.length!==1)fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');
 const discovered=readState(anchors[0],connection,environment),pref=await prelockReactiveOnboarding(client,connection,discovered);
 const current=await companyConnectionForProject(client,connection.organizationId,proof.intent.targetProjectId,true),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(!current||current.id!==connection.id||current.projectId!==connection.projectId||current.metadata?.developmentPilot)fail('EMPLOYEE_INTAKE_REVOKED');
 const locked=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[proof.applicationId,connection.projectId])).rows;
 if(locked.length!==1)fail('EMPLOYEE_INTAKE_INTEGRITY');
 const state=readState(locked[0],current,environment),policy=await currentPolicy(client,current,now,{environment});
 if(state.sender!=='+'+message.from||state.policyDigest!==durableDigest(policy.policy)||source.payload.employeeIntakeDispatch.policyDigest!==durableDigest(policy.policy))fail('EMPLOYEE_INTAKE_REVOKED');
 assertCustomerReplyWindow(payload,now.getTime());
 return authorizeReactiveKycStart(client,{state,anchor:locked[0],project:{id:current.projectId,organizationId:current.organizationId},connection:current,sender:'+'+message.from,event:initial,payload,now},pref,proof,{environment});
}
function freshDraftText(r,previous,environment){
 const message=r.payload.value;
 // A later plain message can fill only an unverified name/email draft. It is
 // never evidence of consent, a role, identity, account ownership or access.
 // A supplied but incorrect/malformed context must not fall back to time.
 if(!['NAME','EMAIL'].includes(r.state?.step)||message.type!=='text'||Object.hasOwn(message,'context'))return false;
 if(!['SENT','STATUS_OBSERVED'].includes(previous?.outcome?.state)||['failed','deleted'].includes(previous?.outcome?.providerStatus)||typeof previous?.outcome?.messageId!=='string'||!previous.outcome.messageId)return false;
 const timestamp=Number(message.timestamp),lastTimestamp=r.state.lastMessageTimestamp,completedAt=Date.parse(previous.outcome.completedAt);
 // Meta timestamps have second precision. Ambiguous same-second messages and
 // status-only receipts without a confirmed send time still require Responder.
 if(!Number.isSafeInteger(timestamp)||!Number.isSafeInteger(lastTimestamp)||typeof previous.outcome.completedAt!=='string'||!Number.isFinite(completedAt)||timestamp<=lastTimestamp||timestamp<=Math.floor(completedAt/1000))return false;
 const expectedId=customerOutboundId(r.state.lastEventId),p=previous.payload;
 if(previous.id!==expectedId||p?.version!==1||p.eventId!==r.state.lastEventId||p.channelId!==r.connection.id||p.organizationId!==r.connection.organizationId||p.applicationId!==r.anchor.id||p.employeeIntake!==true)return false;
 const prepared=unseal(r.connection,'outbound',previous.id,p.encryptedPayload,environment);
 if(!prepared||typeof prepared!=='object'||Array.isArray(prepared)||digest(prepared)!==p.requestDigest)fail('EMPLOYEE_INTAKE_INTEGRITY');
 return prepared.version===1&&prepared.eventId===r.state.lastEventId&&prepared.channelPurpose==='EMPLOYEE_INTAKE'&&prepared.applicationId===r.anchor.id&&prepared.organizationId===r.connection.organizationId&&prepared.channelId===r.connection.id&&prepared.to===message.from;
}
export function createEmployeeIntakeBridge({connect,environment=process.env,resolveAuthority=resolveEmployeeIntakeAuthority}){
 return {async execute(request){return customerJobTransaction(connect,async client=>{
  const r=await resolveAuthority(client,request,{environment});if(!r)return null;if(r.recorded)return r.recorded;
  let promptConfirmed=false,draftTextConfirmed=false;
  if(r.state){const previous=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[customerOutboundId(r.state.lastEventId),r.project.id])).rows[0];promptConfirmed=['SENT','STATUS_OBSERVED'].includes(previous?.outcome?.state)&&!['failed','deleted'].includes(previous?.outcome?.providerStatus)&&typeof previous?.outcome?.messageId==='string'&&r.payload.value.context?.id===previous.outcome.messageId;draftTextConfirmed=freshDraftText(r,previous,environment);}
  const reactivePlan=await planReactiveOnboarding(client,r,r.reactive,{environment,promptConfirmed});
  const plan=reactivePlan||(r.state?planEmployeeIntakeConversation({message:r.payload.value,state:r.state,eventId:r.event.id,promptConfirmed,draftTextConfirmed}):beginEmployeeIntakeConversation(r.event.id));
  const state={...plan.state,applicationId:r.anchor.id,organizationId:r.connection.organizationId,connectionId:r.connection.id,sender:r.sender,senderKey:r.key,policyDigest:durableDigest(r.policy),revision:(r.state?.revision||0)+1,status:plan.state.step,lastEventId:r.event.id,lastMessageTimestamp:Number(r.payload.value.timestamp),messageCount:(r.state?.messageCount||0)+1,expiresAt:r.state?.expiresAt||new Date(r.now.getTime()+META_KYC_CONVERSATION_TTL_MS).toISOString(),createdAt:r.state?.createdAt||r.now.toISOString(),...(plan.state.consent===true?{submittedAt:r.state?.submittedAt||r.now.toISOString()}: {})};
  await writeState(client,r.anchor,r.connection,state,environment);
  const result={kind:'EMPLOYEE_INTAKE',identityStatus:'LIMITED_PARTICIPANT_INTAKE',reviewState:'OBSERVED',businessApplied:false,replySent:false,reply:plan.reply,...(plan.reactiveOnboarding?{reactiveOnboarding:plan.reactiveOnboarding}:{})};
  const dispatch={version:1,applicationId:r.anchor.id,payloadDigest:r.event.payload.payloadDigest,policyDigest:durableDigest(r.policy),replyDigest:digest(result.reply),encryptedResult:seal(r.connection,'employee-intake-dispatch',r.event.id,result,environment)};
  const updated=await client.query(`UPDATE public."WebhookEvent" SET payload=jsonb_set(payload,'{employeeIntakeDispatch}',$2::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1 AND "leaseToken"=$3 AND status='PENDING' AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,JSON.stringify(dispatch),request.leaseToken]);if(updated.rowCount!==1)fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
  // The locked policy is unchanged, but its grant/reply window and the source
  // lease may expire during SQL. Fence the completed draft and dispatch in this
  // same transaction with a fresh DB clock before the caller may commit.
  if(plan.reactiveOnboarding){r.state=state;const a=await reactiveOnboardingAuthority(client,r,r.reactive,{environment,proof:plan.reactiveOnboarding.kind==='KYC_START'?plan.reactiveOnboarding:null});if(!a||a.authorityDigest!==plan.reactiveOnboarding.authorityDigest||Date.parse(plan.reactiveOnboarding.expiresAt)<=a.now.getTime())fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');}
  const policyNow=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  await currentPolicy(client,r.connection,policyNow,{expected:durableDigest(r.policy),environment});
  const fenced=(await client.query(`SELECT id,clock_timestamp() AS now FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3 AND status='PENDING' AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.project.id,request.leaseToken])).rows;if(fenced.length!==1||!(fenced[0].now instanceof Date)||!Number.isFinite(fenced[0].now.getTime()))fail('META_CUSTOMER_INBOX_LEASE_CHANGED');
  // No await follows this last DB clock: expiry during policy reads must also
  // roll back the private draft and dispatch before the transaction can commit.
  if(!customerChannelActive(r.connection,fenced[0].now.getTime(),{environment}))fail('EMPLOYEE_INTAKE_REVOKED');if(plan.reactiveOnboarding&&Date.parse(plan.reactiveOnboarding.expiresAt)<=fenced[0].now.getTime())fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');assertCustomerReplyWindow(r.payload,fenced[0].now.getTime());return result;
 });}};
}

export async function readEmployeeIntake(client,member,projectId,environment=process.env,after=null,focus=null){
 if(focus!==null&&(!focus||typeof focus!=='object'||Array.isArray(focus)||Object.keys(focus).sort().join('|')!=='intakeId|workerId'||!workspaceId(focus.workerId)||!eventId(focus.intakeId)||after!==null))fail('PARTICIPANT_INPUT_INVALID',400);
 if(member.role!=='ADMIN'){if(focus)fail('PARTICIPANT_INVITE_REQUIRED',403);return null;}
 const connection=await companyConnectionForProject(client,member.organizationId,projectId);if(!connection||connection.company.mode!=='COMPANY'||connection.metadata?.developmentPilot){if(focus)fail('PARTICIPANT_INTAKE_UNAVAILABLE',404);return {available:false,records:[],nextCursor:null};}
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,policy=connection.metadata?.employeeIntakePolicy;
 let authorityReady=true;try{await lockOwnCompanyIssuer(client,connection,{environment,now:now.getTime(),lock:false});}catch(error){if(!(error instanceof WorkspaceError)||error.code!=='META_OWN_COMPANY_UNAVAILABLE')throw error;authorityReady=false;}
 let enabled=false;if(authorityReady)try{await currentPolicy(client,connection,now,{lock:false,environment});enabled=true;}catch(error){if(!(error instanceof WorkspaceError)||!['EMPLOYEE_INTAKE_DISABLED','EMPLOYEE_INTAKE_REVOKED'].includes(error.code))throw error;}
 if(after){const found=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND payload->'employeeIntake'->>'connectionId'=$3`,[after,connection.projectId,connection.id])).rows;if(found.length!==1)fail('EMPLOYEE_INTAKE_CONTEXT_REQUIRED');}
 // Exact continuity reads do not depend on the first inbox page. The current
 // organization/project assignment supplies the channel and its credential AAD.
 const rows=(await client.query(focus?`SELECT * FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->'employeeIntake'->>'connectionId'=$2 AND id=$3 AND payload->'employeeIntake'->>'status'='ADMITTED' LIMIT 2`:`SELECT * FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-v1' AND payload->'employeeIntake'->>'connectionId'=$2 AND payload->'employeeIntake'->>'status' IN ('WAITING_RESPONSIBLE','ADMITTED') AND ($3::text IS NULL OR id>$3) ORDER BY id LIMIT 101`,[connection.projectId,connection.id,focus?focus.intakeId:after])).rows;
 if(focus&&(rows.length!==1||rows[0].id!==focus.intakeId))fail('PARTICIPANT_INTAKE_UNAVAILABLE',404);
 const records=rows.slice(0,100).map(row=>{const s=readState(row,connection,environment);if(s.consent!==true||!s.name||!Object.hasOwn(SITE_ROLES,s.job)||typeof s.email!=='string'||!Number.isFinite(Date.parse(s.submittedAt)))fail('EMPLOYEE_INTAKE_INTEGRITY');if(focus&&(s.status!=='ADMITTED'||s.admission?.version!==1||s.admission.applicationId!==focus.intakeId||s.admission.workerId!==focus.workerId||s.admission.projectId!==projectId))fail('PARTICIPANT_INTAKE_UNAVAILABLE',404);return {id:row.id,revision:s.revision,status:s.status,name:s.name,job:s.job,jobLabel:SITE_ROLES[s.job],email:s.email,phone:s.sender,submittedAt:s.submittedAt,workerId:s.admission?.workerId||null,destinationProjectId:s.admission?.projectId||null,permissions:s.admission?.permissions||null,receiptId:s.admission?.receiptId||null};});
 return {available:authorityReady&&customerChannelActive(connection,now.getTime(),{environment}),connectionId:connection.id,revision:policy?.revision||0,enabled,canConfigure:member.role==='ADMIN',roles:SITE_ROLES,notice:{version:EMPLOYEE_INTAKE_NOTICE_VERSION,text:EMPLOYEE_INTAKE_NOTICE},records,nextCursor:rows.length>100?rows[99].id:null};
}
export function employeeIntakeOutcome(found,scope,operationId){
 const m=found?.metadata;if(!m||m.version!==1||!EMPLOYEE_INTAKE_ACTIONS.includes(m.kind)||!workspaceId(m.projectId)||!workspaceId(m.connectionId)||!validOperationId(operationId)||m.operationId!==operationId.toLowerCase()||!/^participant_[a-f0-9]{64}$/.test(found.id||'')||m.permissionsGranted!==false||m.kind!=='CONFIGURE_EMPLOYEE_INTAKE'&&!eventId(m.applicationId)||m.state!==undefined&&m.state!=='REJECTED'||m.state==='REJECTED'&&(m.code!=='EMPLOYEE_INTAKE_REVISION_CHANGED'||m.workerId||m.personReceiptId))fail('EMPLOYEE_INTAKE_INTEGRITY');
 return {scope,projectId:m.projectId,operationId:operationId.toLowerCase(),action:m.kind,applicationId:m.applicationId||null,connectionId:m.connectionId,saved:m.state!=='REJECTED',state:m.state||'RECORDED',receiptId:found.id,workerId:m.workerId||null,personReceiptId:m.personReceiptId||null,permissionsGranted:false,...(m.state==='REJECTED'?{code:m.code,phase:'PRE_RECORD',definitive:true}: {})};
}
export async function saveEmployeeIntake(client,member,scope,project,session,input,environment=process.env){
 if(member.role!=='ADMIN'||session.organizationRole!=='org:admin')fail('PARTICIPANT_INVITE_REQUIRED',403);
  const key=participantReceiptId(member.actorId,input.projectId,input.operationId),fingerprint=durableDigest(input);
 const prior=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded'`,[key,member.organizationId,member.actorId])).rows[0];
 if(prior){if(prior.metadata.requestDigest!==fingerprint||prior.metadata.kind!==input.action)fail('PARTICIPANT_OPERATION_CONFLICT');return employeeIntakeOutcome(prior,scope,input.operationId);}
 const connection=await companyConnectionForProject(client,member.organizationId,project.id,true),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(!connection||connection.id!==input.payload.connectionId||connection.company.mode!=='COMPANY'||connection.metadata?.developmentPilot||!customerChannelActive(connection,now.getTime(),{environment}))fail('EMPLOYEE_INTAKE_REVOKED');
 await lockOwnCompanyIssuer(client,connection,{environment,now:now.getTime()});
 const p=input.payload;let workerId=null,personReceiptId=null,intakePolicyDigest=null,approvedPermissionsDigest=null;
 const rejectStale=async()=>{const details={version:1,kind:input.action,projectId:project.id,operationId:input.operationId,requestDigest:fingerprint,applicationId:p.applicationId||null,connectionId:connection.id,state:'REJECTED',code:'EMPLOYEE_INTAKE_REVISION_CHANGED',permissionsGranted:false};await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded',$4,$5,$6::jsonb)`,[key,member.organizationId,member.actorId,input.action==='CONFIGURE_EMPLOYEE_INTAKE'?'WhatsAppConnection':'WebhookEvent',p.applicationId||connection.id,JSON.stringify(details)]);return employeeIntakeOutcome({id:key,metadata:details},scope,input.operationId);};
 if(input.action==='CONFIGURE_EMPLOYEE_INTAKE'){
  const current=connection.metadata?.employeeIntakePolicy;if((current?.revision||0)!==p.expectedRevision)return rejectStale();
  const issuer=(await client.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."TenantMembership" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' AND "tenantRole"='ADMIN' FOR SHARE`,[member.membershipId,member.organizationId])).rows[0];if(!issuer)fail('EMPLOYEE_INTAKE_REVOKED');
  const policy={version:1,enabled:p.enabled,revision:p.expectedRevision+1,issuerActorId:member.actorId,issuerMembershipId:member.membershipId,issuerRevision:issuer.revision,issuerTrail:await issuerTrail(client,member.organizationId,member.membershipId),ownerRevision:connection.company.revision,grantDigest:grant(connection),receiptId:key,configuredAt:now.toISOString()};
  intakePolicyDigest=durableDigest(policy);
  await client.query(`UPDATE public."WhatsAppConnection" SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{employeeIntakePolicy}',$2::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1`,[connection.id,JSON.stringify(policy)]);
 }else{
  const policy=input.action==='ADMIT_EMPLOYEE_INTAKE'?(await currentPolicy(client,connection,now,{environment})).policy:connection.metadata?.employeeIntakePolicy;
  const anchor=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' FOR UPDATE`,[p.applicationId,connection.projectId])).rows[0];if(!anchor)fail('EMPLOYEE_INTAKE_INTEGRITY');const state=readState(anchor,connection,environment);
  if(state.revision!==p.expectedRevision||state.status!=='WAITING_RESPONSIBLE'||state.consent!==true)return rejectStale();
  if(input.action==='ADMIT_EMPLOYEE_INTAKE'&&state.policyDigest!==durableDigest(policy))return rejectStale();
  if(input.action==='ADMIT_EMPLOYEE_INTAKE'){
   const register=createSiteRegister({workspace:{integrationProject:async(_session,_context,_writable,run)=>run(client,member,scope,project)}});
   const person=await register.save(session,{operationId:input.operationId,projectId:project.id,scope,action:'ADD_PERSON',payload:{name:state.name,phone:state.sender,job:p.job}});workerId=person.person.id;personReceiptId=person.receiptId;
   const admission={version:1,applicationId:anchor.id,projectId:project.id,workerId,actorId:member.actorId,receiptId:key,personReceiptId,permissions:p.permissions,email:state.email,approvedAt:now.toISOString()};
   approvedPermissionsDigest=durableDigest(p.permissions);
   await client.query(`UPDATE public."Worker" SET metadata=jsonb_set(metadata,'{employeeIntakeAdmission}',$3::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[workerId,project.id,JSON.stringify(admission)]);state.admission=admission;state.step='ADMITTED';state.status='ADMITTED';
  }else{state.step='REJECTED';state.status='REJECTED';state.decision={actorId:member.actorId,receiptId:key,reason:p.reason,recordedAt:now.toISOString()};}
  state.revision++;await writeState(client,anchor,connection,state,environment);
 }
 const details={version:1,kind:input.action,projectId:project.id,operationId:input.operationId,requestDigest:fingerprint,applicationId:p.applicationId||null,connectionId:connection.id,workerId,personReceiptId,intakePolicyDigest,approvedPermissionsDigest,permissionsGranted:false};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded',$4,$5,$6::jsonb)`,[key,member.organizationId,member.actorId,input.action==='CONFIGURE_EMPLOYEE_INTAKE'?'WhatsAppConnection':'WebhookEvent',p.applicationId||connection.id,JSON.stringify(details)]);return employeeIntakeOutcome({id:key,metadata:details},scope,input.operationId);
}
export async function employeeIntakeAcceptedPermissions(client,row,{organizationId,projectId}={}){
 const a=row.metadata?.employeeIntakeAdmission;if(!a)return {attendance:true,report:true};
 if(!workspaceId(organizationId)||!workspaceId(projectId)||a.version!==1||a.projectId!==projectId||a.workerId!==row.id||typeof a.permissions?.attendance!=='boolean'||typeof a.permissions?.report!=='boolean'||Object.keys(a.permissions).sort().join('|')!=='attendance|report')fail('EMPLOYEE_INTAKE_INTEGRITY');
 const found=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='WebhookEvent' AND "entityId"=$4 AND action='participant.operation.recorded'`,[a.receiptId,organizationId,a.actorId,a.applicationId])).rows[0];
 if(found?.metadata?.kind!=='ADMIT_EMPLOYEE_INTAKE'||found.metadata.workerId!==row.id||found.metadata.projectId!==projectId||found.metadata.personReceiptId!==a.personReceiptId||found.metadata.approvedPermissionsDigest!==durableDigest(a.permissions))fail('EMPLOYEE_INTAKE_INTEGRITY');return {...a.permissions};
}
