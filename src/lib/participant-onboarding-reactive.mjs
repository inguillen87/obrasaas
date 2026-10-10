import {randomBytes} from 'node:crypto';
import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {metaCustomerContentDigest as durableDigest} from './meta-customer-callback.mjs';
import {prepareCompanyKycProjects} from './company-channel-kyc.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {resolveParticipantOnboardingAuthority} from './participant-onboarding-authority.mjs';
import {participantOnboardingIntent,participantOnboardingOutboundId,PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256} from './participant-onboarding-policy.mjs';
import {prepareMetaKycChallenge,metaKycOperationId,metaKycChallengeDigest} from './meta-kyc-challenge.mjs';
import {participantReceiptId} from './participant-policy.mjs';
import {customerOutboundId,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';

const fail=(code='EMPLOYEE_INTAKE_CONTEXT_REQUIRED')=>{throw new WorkspaceError(code,409);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const eventId=value=>/^customer_webhook_[a-f0-9]{64}$/.test(value||'');
const ttl=30*60*1000;
const revision=`to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
const unseal=(connection,purpose,id,value,environment)=>{try{return JSON.parse(decryptCustomerSecret(value,{organizationId:connection.organizationId,projectId:connection.projectId,purpose,resourceId:id},environment));}catch{fail('EMPLOYEE_INTAKE_INTEGRITY');}};
function participantAccountState(part){
 if(part?.status==='INVITED'&&!part.clerkUserId&&part.invitation?.state==='SENT')return 'INVITED';
 if(part?.status==='ACTIVE'&&/^user_[A-Za-z0-9]+$/.test(part.clerkUserId||'')&&part.invitation?.state==='ACCEPTED'&&workspaceId(part.acceptanceReceiptId))return 'ACTIVE';
 return null;
}
async function canonicalAuthority(client,intent,options){
 try{return await resolveParticipantOnboardingAuthority(client,intent,options);}catch(error){if(error instanceof WorkspaceError&&(/^(PARTICIPANT_ONBOARDING_|COMPANY_ENTITLEMENT_)/.test(error.code)||error.code==='PARTICIPANT_MANAGE_REQUIRED'))fail('EMPLOYEE_INTAKE_REVOKED');throw error;}
}

// Discovery supplies IDs for lock ordering only. Re-read and authorize after
// these locks; an admitted intake is never a participant principal or session.
export async function prelockReactiveOnboarding(client,connection,state){
 if(state?.status!=='ADMITTED'||!workspaceId(state.admission?.workerId)||!workspaceId(state.admission?.projectId))return null;
 const rows=(await client.query(`SELECT w.id,w."projectId",w.metadata FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w.id=$1 AND w."projectId"=$2 AND p."organizationId"=$3`,[state.admission.workerId,state.admission.projectId,connection.organizationId])).rows;
 if(rows.length!==1)return null;
 const p=rows[0].metadata?.participant,d=p?.onboardingDelivery;
 const reactive=state.reactiveOnboarding;
 if(!['INVITED','ACTIVE'].includes(p?.status)||!d||!(d.state==='WAITING_CONFIGURATION'||d.state==='CANCELED'&&d.code==='PARTICIPANT_ONBOARDING_REACTIVE_HANDOFF'&&reactive?.kind==='KYC_START'))return null;
 if(!participantAccountState(p))fail('EMPLOYEE_INTAKE_INTEGRITY');
 const intent=participantOnboardingIntent(d),policy=connection.metadata?.employeeIntakePolicy;
 if(intent.organizationId!==connection.organizationId||intent.workerId!==rows[0].id||intent.targetProjectId!==rows[0].projectId||!workspaceId(policy?.issuerActorId)||!workspaceId(policy?.issuerMembershipId))fail('EMPLOYEE_INTAKE_INTEGRITY');
 const refs=[{actorId:policy.issuerActorId,membershipId:policy.issuerMembershipId},{actorId:intent.issuerActorId,membershipId:intent.issuerMembershipId}];
 // An accepted participant has a canonical account. Discover its IDs before
 // acquiring sorted journey locks; discovery itself grants no authority.
 if(p.status==='ACTIVE'){
  const own=(await client.query(`SELECT u.id AS "actorId",tm.id AS "membershipId" FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id WHERE u."clerkUserId"=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE'`,[p.clerkUserId,connection.organizationId])).rows;
  if(own.length!==1||!workspaceId(own[0].actorId)||!workspaceId(own[0].membershipId))fail('EMPLOYEE_INTAKE_REVOKED');
  refs.push({...own[0],clerkUserId:p.clerkUserId});
 }
 const members=[];
 for(const ref of [...new Map(refs.map(value=>[value.actorId,value])).values()].sort((a,b)=>a.actorId.localeCompare(b.actorId))){
  const users=(await client.query('SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE id=$1 FOR SHARE',[ref.actorId])).rows;
  const found=(await client.query(`SELECT id AS "membershipId","userId" AS "actorId","organizationId","tenantRole"::text AS role,"clerkRole" FROM public."TenantMembership" WHERE id=$1 AND "userId"=$2 AND "organizationId"=$3 AND status='ACTIVE' FOR SHARE`,[ref.membershipId,ref.actorId,connection.organizationId])).rows;
  if(users.length!==1||found.length!==1||!/^user_[A-Za-z0-9]+$/.test(users[0].clerkUserId||'')||ref.clerkUserId&&users[0].clerkUserId!==ref.clerkUserId)fail('EMPLOYEE_INTAKE_REVOKED');
  members.push({...found[0],clerkUserId:users[0].clerkUserId});
 }
 for(const member of members)await lockPersonWorksiteJourney(client,member);
 const issuer=members.find(member=>member.actorId===intent.issuerActorId&&member.membershipId===intent.issuerMembershipId);
 if(!issuer)fail('EMPLOYEE_INTAKE_REVOKED');
 // Locks sorted A/B before the intake resolver takes its legacy anchor lock.
 await prepareCompanyKycProjects(client,issuer,{projectId:intent.targetProjectId});
 return {intent,admissionDigest:durableDigest(state.admission)};
}

async function admittedWorker(client,r,pref){
 const a=r.state?.admission,rows=(await client.query(`SELECT id,"projectId",phone,active,metadata,${revision} FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[pref.intent.workerId,pref.intent.targetProjectId])).rows;
 const worker=rows[0],part=worker?.metadata?.participant;
 const accountState=participantAccountState(part),permissions=part?.permissions;
 if(rows.length!==1||r.state.status!=='ADMITTED'||r.state.consent!==true||a?.version!==1||a.applicationId!==r.anchor.id||a.workerId!==worker.id||a.projectId!==worker.projectId||durableDigest(a)!==pref.admissionDigest||durableDigest(worker.metadata?.employeeIntakeAdmission)!==pref.admissionDigest||!worker.active||worker.phone!==r.sender||part?.version!==1||!accountState||part.invitation.email!==a.email||part.kyc?.version!==1||part.kyc.status!=='NOT_SUBMITTED'||part.kyc.channelCapture||part.kyc.submissionId||!object(permissions)||Object.keys(permissions).sort().join('|')!=='attendance|report'||typeof permissions.attendance!=='boolean'||typeof permissions.report!=='boolean'||accountState==='INVITED'&&(permissions.attendance!==false||permissions.report!==false))fail('EMPLOYEE_INTAKE_INTEGRITY');
 const found=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='WebhookEvent' AND "entityId"=$4 AND action='participant.operation.recorded' FOR SHARE`,[a.receiptId,r.connection.organizationId,a.actorId,r.anchor.id])).rows;
 const m=found[0]?.metadata;
 if(found.length!==1||m?.version!==1||m.kind!=='ADMIT_EMPLOYEE_INTAKE'||m.projectId!==worker.projectId||m.connectionId!==r.connection.id||m.applicationId!==r.anchor.id||m.workerId!==worker.id||m.personReceiptId!==a.personReceiptId||m.permissionsGranted!==false||m.approvedPermissionsDigest!==durableDigest(a.permissions)||Object.keys(a.permissions||{}).sort().join('|')!=='attendance|report'||typeof a.permissions.attendance!=='boolean'||typeof a.permissions.report!=='boolean')fail('EMPLOYEE_INTAKE_INTEGRITY');
 if(durableDigest(participantOnboardingIntent(part.onboardingDelivery))!==durableDigest(pref.intent))fail();
 return worker;
}

async function unusedDelivery(client,r,worker,intent){
 const d=worker.metadata.participant.onboardingDelivery;
 if(d.state!=='WAITING_CONFIGURATION'||d.outboundId!==null||d.challengeId!==undefined&&d.challengeId!==null||worker.metadata.participant.kycChatChallenge||worker.metadata.participant.kycChatConversation)fail();
 const rows=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE provider='meta-customer-outbound-v1' AND (id=$1 OR (payload->>'organizationId'=$2 AND payload->>'workerId'=$3 AND payload->>'invitationId'=$4 AND payload->>'consentReceiptId'=$5)) LIMIT 1`,[participantOnboardingOutboundId(intent),intent.organizationId,worker.id,intent.invitationId,intent.consentReceiptId])).rows;
 if(rows.length)fail();
 assertCustomerReplyWindow(r.payload,r.now.getTime());
}

export async function reactiveOnboardingAuthority(client,r,pref,{environment=process.env,proof=null}={}){
 if(!pref)return null;
 const worker=await admittedWorker(client,r,pref);
 if(proof){
  if(proof.version!==1||proof.kind!=='KYC_START'||!eventId(proof.eventId)||proof.applicationId!==r.anchor.id||proof.admissionReceiptId!==r.state.admission.receiptId||durableDigest(proof.intent)!==durableDigest(pref.intent)||worker.metadata.participant.onboardingDelivery.state!=='CANCELED'||worker.metadata.participant.onboardingDelivery.code!=='PARTICIPANT_ONBOARDING_REACTIVE_HANDOFF'||worker.metadata.participant.onboardingDelivery.reactiveReceiptId!==proof.handoffReceiptId)fail();
 }else await unusedDelivery(client,r,worker,pref.intent);
 const authority=await canonicalAuthority(client,pref.intent,{environment,expected:proof?{authorityDigest:proof.authorityDigest,challengeId:proof.challengeId}:null});
 if(authority.connection.id!==r.connection.id||authority.connection.projectId!==r.project.id||authority.worker.id!==worker.id||authority.worker.phone!==r.sender||authority.connection.metadata?.developmentPilot)fail('EMPLOYEE_INTAKE_REVOKED');
 const org=(await client.query(`SELECT "trialEndsAt" FROM public."Organization" WHERE id=$1 FOR SHARE`,[pref.intent.organizationId])).rows;
 if(org.length!==1)fail('EMPLOYEE_INTAKE_REVOKED');
 // Invitation expiry limits a pending acceptance. An already accepted account
 // retains the same short reply window, entitlement and challenge fences.
 authority.reactiveExpiresAt=Math.min(authority.now.getTime()+ttl,authority.worker.metadata.participant.status==='INVITED'?Date.parse(authority.worker.metadata.participant.invitation.expiresAt):Infinity,authority.entitlement.basis==='CURRENT_TRIAL'?new Date(org[0].trialEndsAt).getTime():Infinity);
 if(!Number.isFinite(authority.reactiveExpiresAt)||authority.reactiveExpiresAt<=authority.now.getTime())fail('EMPLOYEE_INTAKE_REVOKED');
 return authority;
}

function offer(authority,r){
 const expiresAt=new Date(authority.reactiveExpiresAt).toISOString();
 const proof={version:1,kind:'PRESENT_IDENTITY',eventId:r.event.id,applicationId:r.anchor.id,nonce:randomBytes(20).toString('hex'),expiresAt,intent:participantOnboardingIntent(authority.worker.metadata.participant.onboardingDelivery),authorityDigest:authority.authorityDigest,admissionReceiptId:r.state.admission.receiptId};
 const acceptance=authority.worker.metadata.participant.status==='ACTIVE'?'Tu cuenta ya está vinculada;':'Aceptá también la invitación recibida por correo;';
 return {state:{...r.state,reactiveOnboarding:proof},reactiveOnboarding:proof,reply:{type:'interactive',body:'Tu ficha está registrada. Podés enviar tu documento y una selfie nueva desde este chat. Te pediremos autorización antes de recibirlos. '+acceptance+' la empresa debe revisar tu identidad para habilitarte.',button:'Continuar',sections:[{title:'Alta en la empresa',rows:[{id:'intake-kyc:'+proof.nonce,title:'Presentar identidad'}]}]}};
}

// The two buttons are reactive replies to signed customer messages. No
// template, account acceptance, grant, activation or KYC decision is produced.
export async function planReactiveOnboarding(client,r,pref,{environment=process.env,promptConfirmed=false}={}){
 if(!pref)return null;
 const choice=r.payload.value.interactive?.list_reply?.id||r.payload.value.interactive?.button_reply?.id;
 const previous=r.state.reactiveOnboarding;
 if(previous?.kind==='KYC_START')return null;
 const text=r.payload.value.type==='text'?r.payload.value.text?.body?.trim().toLocaleUpperCase('es'):null;
 if(!choice?.startsWith('intake-kyc:')&&!['HOLA','ESTADO','MENU','MENÚ'].includes(text))return null;
 const authority=await reactiveOnboardingAuthority(client,r,pref,{environment});
 if(!choice?.startsWith('intake-kyc:'))return offer(authority,r);
 if(!promptConfirmed||previous?.kind!=='PRESENT_IDENTITY'||choice!=='intake-kyc:'+previous.nonce||previous.eventId!==r.state.lastEventId||previous.applicationId!==r.anchor.id||previous.authorityDigest!==authority.authorityDigest||durableDigest(previous.intent)!==durableDigest(pref.intent)||!Number.isFinite(Date.parse(previous.expiresAt))||Date.parse(previous.expiresAt)<=authority.now.getTime())fail();
 const operationId=metaKycOperationId(r.event.id),prepared=await prepareMetaKycChallenge(client,authority.member,authority.project,{workerId:authority.worker.id,revision:authority.worker.revision,operationId});
 if(!prepared.code||prepared.codeUnavailable||!metaKycChallengeDigest(prepared.code))fail();
 const exteriorId=participantReceiptId(authority.member.actorId,authority.project.id,operationId),handoffId='reactive_onboarding_'+digest(['reactive-onboarding-v1',r.event.id]);
 const proof={version:1,kind:'KYC_START',eventId:r.event.id,applicationId:r.anchor.id,nonce:randomBytes(20).toString('hex'),expiresAt:new Date(Math.min(Date.parse(previous.expiresAt),authority.reactiveExpiresAt,Date.parse(prepared.expiresAt))).toISOString(),intent:pref.intent,authorityDigest:authority.authorityDigest,admissionReceiptId:r.state.admission.receiptId,challengeId:null,challengeReceiptId:prepared.receiptId,exteriorReceiptId:exteriorId,handoffReceiptId:handoffId,code:prepared.code};
 const rows=(await client.query(`SELECT metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[authority.worker.id,authority.project.id])).rows;
 const metadata=structuredClone(rows[0]?.metadata),part=metadata?.participant,challenge=part?.kycChatChallenge;
 if(rows.length!==1||!challenge||challenge.status!=='PENDING'||challenge.codeDigest!==metaKycChallengeDigest(prepared.code)||challenge.expiresAt!==prepared.expiresAt)fail();
 proof.challengeId=challenge.id;
 const receipt={version:1,projectId:authority.project.id,kind:'PREPARE_KYC_CHAT',requestDigest:digest({source:'REACTIVE_HANDOFF',eventId:r.event.id,applicationId:r.anchor.id,intent:pref.intent}),challengeReceiptId:prepared.receiptId,expiresAt:prepared.expiresAt,source:'REACTIVE_HANDOFF',sourceEventId:r.event.id,identityCertified:false,permissionsGranted:false};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[exteriorId,pref.intent.organizationId,pref.intent.issuerActorId,part.onboardingDelivery.workerId,JSON.stringify(receipt)]);
 part.onboardingDelivery={...part.onboardingDelivery,state:'CANCELED',code:'PARTICIPANT_ONBOARDING_REACTIVE_HANDOFF',nextCheckAt:null,reactiveReceiptId:handoffId,reactiveSourceEventId:r.event.id};
 await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[authority.worker.id,authority.project.id,JSON.stringify(metadata)]);
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.onboarding.reactive_handoff','Worker',$4,$5::jsonb)`,[handoffId,pref.intent.organizationId,pref.intent.issuerActorId,authority.worker.id,JSON.stringify({version:1,sourceEventId:r.event.id,applicationId:r.anchor.id,projectId:authority.project.id,connectionId:r.connection.id,invitationId:pref.intent.invitationId,consentReceiptId:pref.intent.consentReceiptId,challengeId:challenge.id,challengeReceiptId:prepared.receiptId,exteriorReceiptId:exteriorId,authorityDigest:authority.authorityDigest,beforeState:'WAITING_CONFIGURATION',afterState:'CANCELED',reason:'REACTIVE_HANDOFF',identityCertified:false,permissionsGranted:false})]);
 await canonicalAuthority(client,pref.intent,{environment,expected:{authorityDigest:authority.authorityDigest,challengeId:challenge.id}});
 const acceptance=part.status==='ACTIVE'?'Tu cuenta ya está vinculada; la presentación queda pendiente de revisión.':'Todavía falta aceptar tu cuenta mediante la invitación; no habilitamos permisos.';
 return {state:{...r.state,reactiveOnboarding:proof},reactiveOnboarding:proof,reply:{type:'interactive',body:'La presentación privada está preparada. Elegí Iniciar identidad para leer y aceptar los avisos antes de enviar imágenes. '+acceptance,button:'Continuar',sections:[{title:'Identidad privada',rows:[{id:'kyc-start:'+proof.nonce,title:'Iniciar identidad'}]}]}};
}

export function decodeReactiveStart(row,source,connection,message,environment){
 const choice=message.interactive?.list_reply?.id||message.interactive?.button_reply?.id;
 const request=unseal(connection,'outbound',row.id,row.payload?.encryptedPayload,environment),dispatch=source.payload?.employeeIntakeDispatch;
 const result=unseal(connection,'employee-intake-dispatch',source.id,dispatch?.encryptedResult,environment),proof=result?.reactiveOnboarding;
 if(!/^kyc-start:[a-f0-9]{40}$/.test(choice||'')||row.id!==customerOutboundId(source.id)||!['SENT','STATUS_OBSERVED'].includes(row.outcome?.state)||['failed','deleted'].includes(row.outcome?.providerStatus)||row.outcome.messageId!==message.context?.id||request.version!==1||request.channelPurpose!=='EMPLOYEE_INTAKE'||request.eventId!==source.id||request.channelId!==connection.id||request.organizationId!==connection.organizationId||request.to!==message.from||request.payloadDigest!==source.payload.payloadDigest||digest(request)!==row.payload.requestDigest||dispatch.version!==1||dispatch.applicationId!==proof?.applicationId||dispatch.replyDigest!==digest(result.reply)||digest(result.reply)!==digest(request.message)||result.kind!=='EMPLOYEE_INTAKE'||result.identityStatus!=='LIMITED_PARTICIPANT_INTAKE'||proof?.version!==1||proof.kind!=='KYC_START'||proof.eventId!==source.id||choice!=='kyc-start:'+proof.nonce||durableDigest(request.reactiveOnboarding)!==durableDigest(proof)||!request.message.sections?.flatMap(section=>section.rows||[]).some(row=>row.id===choice)||!metaKycChallengeDigest(proof.code))fail();
 return proof;
}

export async function assertReactiveStartConsent(client,worker,connection,proof,now){
 const p=worker.metadata?.participant,c=p?.onboardingConsent,d=p?.onboardingDelivery;
 if(!object(c)||c.version!==1||c.status!=='GRANTED'||c.purpose!=='PARTICIPANT_ONBOARDING'||c.invitationId!==proof.intent.invitationId||c.senderE164!==worker.phone||c.issuerActorId!==proof.intent.issuerActorId||c.issuerMembershipId!==proof.intent.issuerMembershipId||c.receiptId!==proof.intent.consentReceiptId||c.noticeVersion!==PARTICIPANT_ONBOARDING_NOTICE_VERSION||c.noticeSha256!==PARTICIPANT_ONBOARDING_NOTICE_SHA256||!Number.isFinite(Date.parse(c.recordedAt))||Date.parse(c.recordedAt)>now.getTime()||d?.state!=='CANCELED'||d.code!=='PARTICIPANT_ONBOARDING_REACTIVE_HANDOFF'||d.reactiveReceiptId!==proof.handoffReceiptId||d.reactiveSourceEventId!==proof.eventId||durableDigest(participantOnboardingIntent(d))!==durableDigest(proof.intent))fail();
 const rows=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='Worker' AND "entityId"=$4 AND action='participant.onboarding.reactive_handoff' FOR SHARE`,[proof.handoffReceiptId,proof.intent.organizationId,proof.intent.issuerActorId,worker.id])).rows,m=rows[0]?.metadata;
 if(rows.length!==1||m?.version!==1||m.sourceEventId!==proof.eventId||m.applicationId!==proof.applicationId||m.projectId!==worker.projectId||m.connectionId!==connection.id||m.invitationId!==proof.intent.invitationId||m.consentReceiptId!==proof.intent.consentReceiptId||m.challengeId!==proof.challengeId||m.challengeReceiptId!==proof.challengeReceiptId||m.exteriorReceiptId!==proof.exteriorReceiptId||m.authorityDigest!==proof.authorityDigest||m.beforeState!=='WAITING_CONFIGURATION'||m.afterState!=='CANCELED'||m.reason!=='REACTIVE_HANDOFF'||m.identityCertified!==false||m.permissionsGranted!==false)fail();
 const consentRows=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='Worker' AND "entityId"=$4 AND action='participant.onboarding.contact_authorized' FOR SHARE`,[c.receiptId,proof.intent.organizationId,c.issuerActorId,worker.id])).rows;
 if(consentRows.length!==1||durableDigest(consentRows[0].metadata)!==durableDigest({...c,organizationId:proof.intent.organizationId,projectId:worker.projectId}))fail();
}

export async function authorizeReactiveKycStart(client,r,pref,proof,{environment=process.env}={}){
 if(!pref||proof?.kind!=='KYC_START'||durableDigest(r.state.reactiveOnboarding)!==durableDigest(proof)||!Number.isFinite(Date.parse(proof.expiresAt))||Date.parse(proof.expiresAt)<=r.now.getTime())fail();
 const worker=await admittedWorker(client,r,pref),challenge=worker.metadata.participant.kycChatChallenge;
 await assertReactiveStartConsent(client,worker,r.connection,proof,r.now);
 if(challenge?.id!==proof.challengeId||challenge.codeDigest!==metaKycChallengeDigest(proof.code)||challenge.issuerActorId!==proof.intent.issuerActorId||challenge.issuerMembershipId!==proof.intent.issuerMembershipId||challenge.organizationId!==proof.intent.organizationId||challenge.workerId!==worker.id||challenge.projectId!==worker.projectId||challenge.connectionId!==r.connection.id||challenge.wabaId!==r.connection.whatsappBusinessId||challenge.phoneNumberId!==r.connection.phoneNumberId||challenge.senderE164!==r.sender)fail();
 if(challenge.status==='PENDING')await reactiveOnboardingAuthority(client,r,pref,{environment,proof});
 else if(challenge.status!=='CLAIMED'||challenge.claimedEventId!==r.event.id)fail();
 const rows=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='Worker' AND "entityId"=$4 AND action='participant.operation.recorded' FOR SHARE`,[proof.exteriorReceiptId,proof.intent.organizationId,proof.intent.issuerActorId,worker.id])).rows,m=rows[0]?.metadata;
 if(rows.length!==1||m?.version!==1||m.kind!=='PREPARE_KYC_CHAT'||m.projectId!==worker.projectId||m.challengeReceiptId!==proof.challengeReceiptId||m.expiresAt!==challenge.expiresAt||m.source!=='REACTIVE_HANDOFF'||m.sourceEventId!==proof.eventId||m.identityCertified!==false||m.permissionsGranted!==false)fail();
 return {codeDigest:challenge.codeDigest,challengeId:challenge.id,workerId:worker.id,targetProjectId:worker.projectId,expiresAt:proof.expiresAt};
}
