import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {createFieldOperations,publicFieldEvidence} from './field-operations-store.mjs';
import {createFieldMedia,decodeFieldMedia} from './field-media.mjs';
import {planMetaFieldConversation,metaFieldRecoveryCatalogRead,metaFieldRecoveryCatalogPlan,metaFieldPlanDisclosure,metaFieldPurposeDisclosure,metaFieldMenuDisclosure,metaFieldConversationAction,metaFieldConsumptionAcknowledgement,META_FIELD_MEDIA_AUTHORIZATION_VERSION,validMetaFieldMediaReferenceContext,metaFieldMediaAuthorizationValid} from './meta-field-conversation.mjs';
import {resolveWorkerChannelIdentity,decodeWorkerChannelProof,approvedParticipant,refreshLockedWorkerChannelIdentity,releaseLockedWorkerChannelIdentity,resolveCompanyFieldDispatchIdentity} from './worker-channel-identity.mjs';
import {META_CUSTOMER_PROTOCOL,resolveMetaCloudProtocol} from './meta-cloud-protocol.mjs';
import {decryptCustomerSecret,encryptCustomerSecret,customerContextCommitment} from './meta-customer-credentials.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';
import {validFieldMediaAnalysisConsent,FIELD_VIDEO_PRIVACY_NOTICE_VERSION,fieldVideoAudioAnalysisAllowed} from './field-media-privacy.mjs';
import {voiceTranscriptForEvidence} from './voice-progress-draft.mjs';
import {assertDevelopmentPilotCommit,assertDevelopmentPilotAdapter} from './meta-development-pilot-policy.mjs';
import {lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {siteText} from './site-register-policy.mjs';
import {createMetaPlanImportTransport} from './meta-plan-import-transport.mjs';
import {metaPlanImportContextDigest,metaPlanImportPromptMatches} from './meta-plan-import-origin.mjs';
import {canImportPlan} from './plan-import-policy.mjs';
import {publicTaskMeasurement} from './task-progress-measurement.js';

export function metaFieldOperationId(eventId,purpose){const h=digest(['meta-field-operation-v1',eventId,purpose]);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
const receiptId=eventId=>'meta_field_'+digest(['meta-field-dispatch-v1',eventId]);
const permissionFor=action=>action==='ATTENDANCE'?'attendance':'report';
const safeErrors=new Set(['INVENTORY_QUANTITY_INVALID','INVENTORY_CATALOG_CHANGED','INVENTORY_MATERIAL_UNAVAILABLE','SITE_INPUT_INVALID','SITE_QUANTITY_INVALID','FIELD_QUANTITY_INVALID','FIELD_QUANTITY_PROGRESS_MISMATCH','FIELD_PROGRESS_REGRESSION','FIELD_PROGRESS_REVIEW_PENDING','FIELD_BASELINE_CHANGED','FIELD_REVISION_CHANGED','WORKSPACE_TASK_UNAVAILABLE','FIELD_SECTOR_UNAVAILABLE','ATTENDANCE_REVISION_CHANGED','ATTENDANCE_PERSON_JOURNEY_OPEN','ATTENDANCE_SHIFT_ALREADY_OPEN','ATTENDANCE_SHIFT_NOT_OPEN','ATTENDANCE_BREAK_ALREADY_OPEN','ATTENDANCE_BREAK_NOT_OPEN','ATTENDANCE_BREAK_OPEN','ATTENDANCE_LOCATION_STALE','ATTENDANCE_LOCATION_INVALID','FIELD_EVIDENCE_NOT_APPROVED','FIELD_EVIDENCE_UNAVAILABLE']);
for(const code of ['FIELD_MEASUREMENT_REQUIRED','FIELD_MEASUREMENT_CHANGED','TASK_MEASUREMENT_INVALID','TASK_MEASUREMENT_NOT_CONFIGURED','TASK_MEASUREMENT_STATE_INVALID','TASK_MEASUREMENT_PROGRESS_MISMATCH','TASK_MEASUREMENT_EXCEEDS_BASELINE','TASK_MEASUREMENT_REGRESSION'])safeErrors.add(code);
safeErrors.add('INVENTORY_CURSOR_UNAVAILABLE');
const explanation=code=>({ATTENDANCE_PERSON_JOURNEY_OPEN:'Tenés una jornada pendiente de cierre. Contactá al responsable.',ATTENDANCE_SHIFT_ALREADY_OPEN:'Ya tenés una jornada abierta.',ATTENDANCE_SHIFT_NOT_OPEN:'Primero registrá una entrada.',ATTENDANCE_BREAK_ALREADY_OPEN:'Tu pausa ya está abierta.',ATTENDANCE_BREAK_NOT_OPEN:'No hay una pausa abierta.',ATTENDANCE_BREAK_OPEN:'Cerrá la pausa antes de registrar la salida.',ATTENDANCE_LOCATION_STALE:'La ubicación venció. Volvé a empezar y compartí una ubicación actual.',FIELD_PROGRESS_REVIEW_PENDING:'Esta tarea ya tiene una propuesta pendiente.',FIELD_EVIDENCE_NOT_APPROVED:'La evidencia requiere revisión del responsable.',FIELD_PROGRESS_REGRESSION:'El avance propuesto no puede ser menor al ya aprobado.'}[code]||'Revisá los datos y el estado actual de la obra antes de volver a intentar.');
const text=body=>({type:'text',body});
export const metaFieldMediaContextDigest=r=>digest(['meta-field-media-context-v2',r.member.organizationId,r.member.actorId,r.member.membershipId,r.member.clerkUserId,r.project.id,r.worker.id,r.channelBinding.id,r.connection.id,r.connection.projectId,r.connection.phoneNumberId,r.connection.whatsappBusinessId,r.sourceProjectId||r.event.projectId,r.companyProjection?{projectId:r.companyProjection.projectId,workerId:r.companyProjection.workerId,actorId:r.companyProjection.actorId,membershipId:r.companyProjection.membershipId,assignmentRevision:r.companyProjection.assignmentRevision,bindingId:r.companyProjection.bindingId,routeId:r.companyProjection.routeId,routeEpoch:r.companyProjection.routeEpoch}:null]);
const consumptionContext=r=>digest(['meta-field-consumption-recovery-v1',metaFieldMediaContextDigest(r)]);
const recoveryExpired='META_CHANNEL_CONSUMPTION_RECOVERY_EXPIRED';
const progressDraftExpired='META_CHANNEL_PROGRESS_DRAFT_EXPIRED';
const progressDraftExpiryBody='Venció el plazo del borrador de avance. No guardamos una propuesta ni cambiamos la tarea. Escribí AVANCE para revisar la tarea y preparar una medición nueva.';
const recoveryCancelled='CONSUMPTION_RECOVERY_CANCELLED';
const consumptionRecoveryExpiryBody='Venció el plazo del borrador de consumo. Conservamos los datos y el rechazo anterior; no guardamos otra propuesta ni descontamos stock. Escribí CANCELAR para descartarlo y empezar otro consumo.';
const consumptionRecoveryExpiryMessage=r=>text((r.companyProjection?'Obra: '+r.project.name+'\n':'')+consumptionRecoveryExpiryBody);
const canonicalFieldResolvers=new WeakSet([resolveWorkerChannelIdentity]);
// Only this factory can brand the corporate wrapper. A caller-supplied resolver
// never opts into the compact lock-preserving guard through a boolean flag.
export function createCompanyMetaFieldIdentityResolver(){const resolve=(client,options)=>resolveWorkerChannelIdentity(client,{...options,companyRouting:true});canonicalFieldResolvers.add(resolve);return resolve;}
// Integrity of an already signed, privately referenced file. This read-only
// validator grants no access: callers must resolve current authority separately.
export async function inspectMetaFieldMediaOrigin(client,r,media,state,{environment=process.env,now=r.now,protocol=META_CUSTOMER_PROTOCOL}={}){
 try{
  const ref=media?.sourceOrigin;
  if(state?.version!==1||state.purpose!=='MEDIA'||state.step!=='MEDIA_AUTHORIZED'||state.mediaAuthorizationVersion!==META_FIELD_MEDIA_AUTHORIZATION_VERSION||!ref||digest(state.pendingFile)!==digest(ref)||media.taskId!==ref.taskId||media.sectorId!==ref.sectorId||media.mediaId!==ref.mediaId||media.contentType!==ref.contentType||media.caption!==ref.caption||media.kind!==ref.kind||media.analysisConsentEventId!==state.analysisConsentEventId||state.analysisConsentEventId!==r.event.id||!metaFieldMediaAuthorizationValid(r.proof.value,media,state)||digest(media.analysisConsent)!==digest(state.analysisConsent))return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  const facts={mediaReferenceContext:{contextDigest:metaFieldMediaContextDigest(r),sourceProjectId:r.sourceProjectId||r.event.projectId}};
  if(!validMetaFieldMediaReferenceContext(ref,{state,facts,now}))return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  const origin=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider=$3`,[ref.eventId,ref.sourceProjectId,protocol.provider])).rows[0];
  if(!origin||origin.payload?.payloadDigest!==ref.payloadDigest)return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  const signed=decodeWorkerChannelProof(origin,r.connection,environment,protocol),asset=signed.value?.[signed.value?.type];
  if(signed.senderE164!==r.proof.senderE164||signed.value.type!==ref.kind||asset?.id!==ref.mediaId||asset.mime_type!==ref.contentType||siteText(asset.caption||'Evidencia enviada desde el canal verificado.',1000,1,true)!==ref.caption)return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  if(r.companyProjection){
   if(signed.companyRouting?.mode!=='COMPANY')return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
   const projection=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[ref.eventId])).rows[0];
   if(projection?.kind!=='FIELD'||projection.sourceEventId!==ref.eventId||projection.payloadDigest!==ref.payloadDigest||['organizationId','connectionId','projectId','workerId','actorId','membershipId','assignmentRevision','bindingId','routeId','routeEpoch'].some(key=>projection[key]!==r.companyProjection[key]))return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  }else if(signed.companyRouting?.mode==='COMPANY')return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  const observed=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND "entityType"='Worker' AND action='meta.field.dispatched'`,[receiptId(ref.eventId),r.member.organizationId,r.member.actorId,r.worker.id])).rows[0]?.metadata;
  if(!(observed?.version===1&&observed.projectId===r.project.id&&observed.channelId===r.connection.id&&observed.channelBindingId===r.channelBinding.id&&observed.eventId===ref.eventId&&observed.payloadDigest===ref.payloadDigest&&observed.kind==='CONVERSATION'&&observed.businessApplied===false))return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  // Classify current target changes only after the signed original, immutable
  // projection, prompt nonce, consent, TTL and durable receipt prove integrity.
  const project=(await client.query(`SELECT id,metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE'`,[r.project.id,r.member.organizationId])).rows[0];
  if(!project)return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};
  const task=(await client.query(`SELECT id,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Task" WHERE id=$1 AND "projectId"=$2`,[ref.taskId,r.project.id])).rows[0];
  if(!task)return {valid:false,code:'WORKSPACE_TASK_UNAVAILABLE'};
  if(task.revision!==ref.taskRevision)return {valid:false,code:'FIELD_REVISION_CHANGED'};
  const sectors=project.metadata?.fieldOperations?.version===1&&Array.isArray(project.metadata.fieldOperations.sectors)?project.metadata.fieldOperations.sectors:[];
  if(!sectors.some(sector=>sector.id===ref.sectorId))return {valid:false,code:'FIELD_SECTOR_UNAVAILABLE'};
  return {valid:true,code:null};
 }catch(error){if(error instanceof WorkspaceError||error instanceof SyntaxError||error instanceof TypeError||error instanceof RangeError)return {valid:false,code:'META_CHANNEL_MEDIA_CONTEXT_CHANGED'};throw error;}
}
export async function validateMetaFieldMediaOrigin(client,r,media,state,options={}){return (await inspectMetaFieldMediaOrigin(client,r,media,state,options)).valid;}
export function metaFieldVideoResultText(evidence,consent){
 const result=evidence?.processing?.result,visualConfirmed=result?.visual?.status==='ANALYZED_UNREVIEWED'&&result.sampling?.frameCount===4;
 const visual=visualConfirmed?'Se analizaron cuatro cuadros del video.':'El análisis de los cuadros no quedó confirmado.';
 let audio='No autorizaste transcribir su audio.';
 if(fieldVideoAudioAnalysisAllowed(consent)){
  const status=result?.videoAudio?.version==='field-video-audio-result-v1'?result.videoAudio.status:null;
  if(status==='TRANSCRIBED_UNREVIEWED'&&voiceTranscriptForEvidence(evidence))audio='La transcripción del audio quedó guardada para revisión. No verifica identidad ni registra asistencia.'+(result.progressDraft?' Después de que otro responsable apruebe la evidencia, escribí AVANCE para revisar el borrador y completar tu medición acumulada.':'');
  else if(status==='NO_AUDIO_TRACK')audio='No se encontró una pista de audio; no se envió audio para transcripción.';
  else if(status==='DIGITAL_SILENCE')audio='La extracción informó silencio digital; no se transcribió el audio.';
  else audio='La transcripción no quedó confirmada. El original sigue disponible para revisión en la web.';
 }
 return visual+' '+audio+' Otro responsable autorizado debe revisar el video original en la web antes de aprobar avances. La tarea conserva su avance.';
}
export function readMetaFieldConversation(r,environment=process.env){
 const envelope=r.worker.metadata.fieldChannelConversation;if(!envelope)return null;if(envelope.version!==1||envelope.bindingId!==r.channelBinding.id)return null;
 let value;try{value=JSON.parse(decryptCustomerSecret(envelope.encryptedState,{organizationId:r.member.organizationId,projectId:r.project.id,purpose:'field-conversation',resourceId:r.worker.id},environment));}catch{throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);}
 if(value.bindingId!==envelope.bindingId||value.lastEventId!==envelope.lastEventId||value.expiresAt!==envelope.expiresAt||value.lastMessageTimestamp!==envelope.lastMessageTimestamp||value.lastReceivedAt!==envelope.lastReceivedAt)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);return value;
}
const replyAuthorityPermissions=Object.freeze({REPORT:['report'],ATTENDANCE:['attendance'],MIXED:['attendance','report'],MENU:[],WITHDRAWAL:[],GENERIC:[],PLAN_IMPORT:[]});
const replyAuthorityKeys=['version','source','eventId','payloadDigest','organizationId','projectId','actorId','membershipId','workerId','bindingId','contextDigest','disclosure','requiredPermissions','replyDigest'];
// JSONB may reorder object keys. Every authenticated/digested authority uses
// this explicit field order, including the original immutable recovery header.
const replyAuthorityValues=authority=>replyAuthorityKeys.map(key=>[key,authority[key]]);
export const metaFieldReplyAuthorityDigest=authority=>digest(replyAuthorityValues(authority));
const replyAuthorityCommitment=(r,authority,kind,recoveryContext=null,recoveryDeadline=null,environment=process.env)=>customerContextCommitment(JSON.stringify([replyAuthorityValues(authority),kind,recoveryContext,recoveryDeadline]),{organizationId:r.member.organizationId,projectId:r.project.id,purpose:'field-reply-authority',resourceId:receiptId(r.event.id)},environment);
const reportReplyKinds=new Set(['CONSUMPTION_PROPOSAL','CONSUMPTION_READ','CONSUMPTION_RECOVERY','FIELD_REPORT_READ','PROGRESS_PROPOSAL','INCIDENT_REPORT','MATERIAL_REQUEST','EVIDENCE','MEDIA_REVIEW_REQUIRED','MEDIA_CONTEXT_REVIEW']);
const genericReplyKinds=new Set(['CHANNEL_BOUND','STALE_CONVERSATION']);
const companyReplyKinds=new Set(['WORKSITE_SELECTION','STALE_WORKSITE_SELECTION','WORKSITE_SELECTED','WORKSITE_CONFIRM','WORKSITE_PENDING','WORKSITE_DRAFT_PENDING','WORKSITE_INPUT_CONTEXT_REQUIRED','WORKSITE_SELECTION_REQUIRED','COMPANY_ADAPTER_DISABLED','WORKSITE_DRAFT_CANCELLED']);
function canonicalReplyDisclosure(result){if(result.kind==='INPUT_REVIEW')return typeof result.code==='string'&&result.code.startsWith('ATTENDANCE_')?'ATTENDANCE':'GENERIC';if(result.kind===recoveryCancelled)return 'WITHDRAWAL';if(result.kind==='CONSUMPTION_RECOVERY'&&result.code===recoveryExpired)return 'GENERIC';if(result.kind==='ATTENDANCE')return 'ATTENDANCE';if(reportReplyKinds.has(result.kind))return 'REPORT';if(genericReplyKinds.has(result.kind))return 'GENERIC';if(['PLAN_IMPORT_CONTEXT_REQUIRED','PLAN_IMPORT_REFERENCE_EXPIRED','PLAN_IMPORT_SOURCE_REVIEW','PLAN_IMPORT_DRAFT'].includes(result.kind))return 'PLAN_IMPORT';throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);}
const replyContext=r=>r.worker?metaFieldMediaContextDigest(r):digest(['company-selection-reply-v1',r.member.organizationId,r.member.actorId,r.member.membershipId,r.member.clerkUserId,r.connection.id,r.event.projectId,...['sourceEventId','payloadDigest','organizationId','connectionId','kind','routeId','routeEpoch','actorId','membershipId','projectId','workerId','assignmentRevision','bindingId'].map(key=>r.companyProjection?.[key]??null)]);
function replyAuthorityContext(r){return {eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,organizationId:r.member.organizationId,projectId:r.project.id,actorId:r.member.actorId,membershipId:r.member.membershipId,workerId:r.worker?.id||null,bindingId:r.channelBinding?.id||null,contextDigest:replyContext(r)};}
// Only the durable canonical writers call this function. The outbound API never
// consumes authority supplied in send options or in an inbound message.
export function createMetaFieldReplyAuthority(r,disclosure,reply,{company=false}={}){
 if(!Object.hasOwn(replyAuthorityPermissions,disclosure)||!reply)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 return {version:1,source:company?'CANONICAL_COMPANY_RECEIPT':'CANONICAL_FIELD_RECEIPT',...replyAuthorityContext(r),disclosure,requiredPermissions:[...replyAuthorityPermissions[disclosure]],replyDigest:digest(reply)};
}
export function validateMetaFieldReplyAuthority(r,authority,{company=false}={}){
 if(!authority||Array.isArray(authority)||Object.keys(authority).sort().join('|')!==replyAuthorityKeys.slice().sort().join('|')||authority.version!==1||authority.source!==(company?'CANONICAL_COMPANY_RECEIPT':'CANONICAL_FIELD_RECEIPT')||!Object.hasOwn(replyAuthorityPermissions,authority.disclosure)||digest(authority.requiredPermissions)!==digest(replyAuthorityPermissions[authority.disclosure])||!/^[a-f0-9]{64}$/.test(authority.replyDigest||'')||Object.entries(replyAuthorityContext(r)).some(([key,value])=>authority[key]!==value)||company&&!['MENU','WITHDRAWAL','GENERIC'].includes(authority.disclosure))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 return authority;
}
function requireReplyPermissions(r,disclosure){
 if(!Object.hasOwn(replyAuthorityPermissions,disclosure))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 if(replyAuthorityPermissions[disclosure].some(permission=>r.worker?.metadata?.participant?.permissions?.[permission]!==true)||disclosure==='PLAN_IMPORT'&&!canImportPlan(r.member.role))throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
}
function legacyReceiptDisclosure(r,metadata,environment){
 if(metadata.kind==='CONVERSATION'||metadata.kind==='INPUT_REVIEW'){
  const envelope=r.worker.metadata?.fieldChannelConversation;
  // Old headers do not expose purpose. Only the exact current source may use
  // the existing conversation reader for classification; never retag it.
  if(envelope?.lastEventId!==r.event.id||envelope.bindingId!==r.channelBinding.id)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  const state=readMetaFieldConversation(r,environment);
  // A historical journey error can return MENU while its cached reply still
  // reveals attendance. Only the signed source command resolves that ambiguity;
  // an interactive choice no longer has its original menu after the transition.
  if(state?.purpose==='MENU'){
   const action=r.proof.value.type==='text'?metaFieldConversationAction(r.proof.value.text?.body):null;
   const base=['ATTEND_IN','ATTEND_PAUSE','ATTEND_RESUME','ATTEND_OUT'].includes(action)?'ATTENDANCE':action==='MENU'?'MENU':null,disclosure=metaFieldMenuDisclosure(state.choices,base);
   if(!disclosure)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
   return disclosure;
  }
  const disclosure=state?.step==='OWN_CONSUMPTION_STATUS'?'MIXED':metaFieldPurposeDisclosure(state?.purpose);
  if(!disclosure)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);return disclosure;
 }
 // Old ESTADO receipts can contain both the journey and a consumption summary.
 if(metadata.kind==='CONSUMPTION_READ'&&r.proof.value.type==='text'&&metaFieldConversationAction(r.proof.value.text?.body)==='STATUS')return 'MIXED';
 return canonicalReplyDisclosure({kind:metadata.kind});
}
async function authorizeFieldReceipt(client,r,metadata,{environment=process.env,reply=null,canonicalParticipant=false}={}){
 if(metadata?.version!==1||metadata.projectId!==r.project.id||metadata.channelId!==r.connection.id||metadata.channelBindingId!==r.channelBinding.id||metadata.eventId!==r.event.id||metadata.payloadDigest!==r.event.payload.payloadDigest)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 if(Object.hasOwn(metadata,'replyAuthority')!==Object.hasOwn(metadata,'replyAuthorityCommitment'))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 const authority=Object.hasOwn(metadata,'replyAuthority')?validateMetaFieldReplyAuthority(r,metadata.replyAuthority):null;
 if(authority&&metadata.replyAuthorityCommitment!==replyAuthorityCommitment(r,authority,metadata.kind,metadata.consumptionRecoveryContext||null,metadata.consumptionRecoveryDeadline||null,environment))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 // Expiry feedback is a separate, exact canonical observation. It never
 // decrypts an expired private draft or the old cached dispatch and never
 // replaces the original descriptor, receipt or acknowledgement.
 if(reply&&metadata.kind==='CONSUMPTION_RECOVERY'&&metadata.consumptionRecoveryContext===consumptionContext(r)&&typeof metadata.consumptionRecoveryDeadline==='string'&&Number.isFinite(Date.parse(metadata.consumptionRecoveryDeadline))){
  const clock=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if(Date.parse(metadata.consumptionRecoveryDeadline)<=clock.getTime()){
   const current={...r,now:clock},recovery=inspectMetaFieldConsumptionRecovery(current);
   if(!recovery||recovery.header.deadline!==metadata.consumptionRecoveryDeadline||recovery.header.contextDigest!==metadata.consumptionRecoveryContext||r.event.status!=='PENDING'||!Number.isFinite(Date.parse(r.event.leaseExpiresAt))||Date.parse(r.event.leaseExpiresAt)<=clock.getTime())throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
   if(canonicalParticipant)await approvedParticipant(client,r.worker,r.member);
   const fresh=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
   if(Date.parse(metadata.consumptionRecoveryDeadline)>fresh.getTime()||Date.parse(r.event.leaseExpiresAt)<=fresh.getTime())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
   const expected=consumptionRecoveryExpiryMessage(r);if(digest(reply)!==digest(expected))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
   const authorityDigest=digest(['meta-field-consumption-expiry-feedback-v1',authority?metaFieldReplyAuthorityDigest(authority):[metadata.eventId,metadata.payloadDigest,metadata.projectId,metadata.channelId,metadata.channelBindingId,metadata.kind],metadata.consumptionRecoveryContext,metadata.consumptionRecoveryDeadline,digest(expected)]);
   return {authorityDigest,disclosure:'GENERIC',derivedExpiryFeedback:true};
  }
 }
 const disclosure=authority?.disclosure||legacyReceiptDisclosure(r,metadata,environment);
 requireReplyPermissions(r,disclosure);
 // The resolver already proved signed source, personal KYC and binding. Reuse
 // its canonical participant helper for the specific live outbound capability.
 if(canonicalParticipant)for(const permission of replyAuthorityPermissions[disclosure])await approvedParticipant(client,r.worker,r.member,{permission});
 let value;try{value=JSON.parse(decryptCustomerSecret(metadata.encryptedResult,{organizationId:r.member.organizationId,projectId:r.project.id,purpose:'field-dispatch',resourceId:receiptId(r.event.id)},environment));}catch{throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);}
 if(value?.kind!==metadata.kind||value.workerId!==r.worker.id||!value.reply||authority&&digest(value.reply)!==authority.replyDigest||reply&&digest(value.reply)!==digest(reply))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 return {result:value,authorityDigest:authority?metaFieldReplyAuthorityDigest(authority):null,disclosure,recoveryDeadline:metadata.kind==='CONSUMPTION_RECOVERY'?metadata.consumptionRecoveryDeadline:null};
}
// Preserve the corporate result cache in the field transaction that already
// owns its immutable projection, participant and source locks. No later router
// resolution is needed merely to duplicate this already authorized result.
export async function writeMetaFieldCompanyResult(client,r,value,environment=process.env){
 const p=r.companyProjection;if(!p)return value;
 if(!['FIELD','BINDING'].includes(p.kind)||p.sourceEventId!==r.event.id||p.payloadDigest!==r.event.payload.payloadDigest||p.organizationId!==r.member.organizationId||p.connectionId!==r.connection.id||p.projectId!==r.project.id||p.workerId!==r.worker.id||p.actorId!==r.member.actorId||p.membershipId!==r.member.membershipId||p.assignmentRevision!==r.connection.company?.assignmentRevision||p.bindingId!==(p.kind==='FIELD'?r.channelBinding.id:r.worker.metadata?.participant?.channelIdentity?.challenge?.id)||(r.sourceProjectId||r.event.projectId)!==r.connection.projectId)throw new WorkspaceError('COMPANY_CHANNEL_CONTEXT_CHANGED',409);
 const aad={organizationId:r.member.organizationId,projectId:r.connection.projectId,purpose:'company-source-result',resourceId:r.event.id};
 if(p.encryptedResult){let previous;try{previous=JSON.parse(decryptCustomerSecret(p.encryptedResult,aad,environment));}catch{throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);}if(digest(previous)!==digest(value))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);return value;}
 const encrypted=encryptCustomerSecret(JSON.stringify(value),aad,environment);
 const written=await client.query(`UPDATE public."WhatsAppCompanyEventRoute" SET "encryptedResult"=$2 WHERE "sourceEventId"=$1 AND "payloadDigest"=$3 AND "organizationId"=$4 AND "connectionId"=$5 AND kind=$6 AND "routeId" IS NOT DISTINCT FROM $7::text AND "routeEpoch" IS NOT DISTINCT FROM $8::integer AND "actorId"=$9 AND "membershipId"=$10 AND "projectId"=$11 AND "workerId"=$12 AND "assignmentRevision"=$13 AND "bindingId"=$14 AND "encryptedResult" IS NULL AND EXISTS(SELECT 1 FROM public."WebhookEvent" source WHERE source.id=$1 AND source."projectId"=$15 AND source.status='PENDING' AND source."leaseToken"=$16 AND source."leaseExpiresAt">clock_timestamp() AND source.payload->>'payloadDigest'=$3 AND source.payload->>'channelId'=$5 AND source.payload->>'organizationId'=$4)`,[r.event.id,encrypted,p.payloadDigest,p.organizationId,p.connectionId,p.kind,p.routeId,p.routeEpoch,p.actorId,p.membershipId,p.projectId,p.workerId,p.assignmentRevision,p.bindingId,r.event.projectId,r.event.leaseToken]);
 if(written.rowCount!==1)throw new WorkspaceError('COMPANY_CHANNEL_CONTEXT_CHANGED',409);
 return value;
}
export async function readMetaFieldOutboundAuthority(client,r,reply,{environment=process.env}={}){
 if(!r.worker){
  const value=r.companyResult;
  if(!r.companyProjection||!companyReplyKinds.has(value?.kind)||!value.reply||digest(value.reply)!==digest(reply))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  const authority=Object.hasOwn(value,'replyAuthority')?validateMetaFieldReplyAuthority(r,value.replyAuthority,{company:true}):null;
  if(authority&&digest(value.reply)!==authority.replyDigest)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  return {authorityDigest:authority?metaFieldReplyAuthorityDigest(authority):null,disclosure:authority?.disclosure||'GENERIC'};
 }
 const metadata=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.field.dispatched'`,[receiptId(r.event.id),r.member.organizationId,r.member.actorId,r.worker.id])).rows[0]?.metadata;
 return authorizeFieldReceipt(client,r,metadata,{environment,reply,canonicalParticipant:true});
}
// Clear recovery/prompt integrity only. Authority still comes from the signed
// canonical resolver; this helper never decrypts a draft or grants a role.
export function inspectMetaFieldConsumptionRecovery(r){
 const header=r.worker.metadata?.fieldConsumptionRecovery;if(!header)return null;
 if(header.version!==1||typeof header.id!=='string'||!header.id||header.contextDigest!==consumptionContext(r)||header.bindingId!==r.channelBinding.id||!Number.isFinite(Date.parse(header.deadline)))throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
 const prompt=r.worker.metadata.fieldChannelConversation;
 if(prompt?.version!==1||prompt.bindingId!==r.channelBinding.id||prompt.expiresAt!==header.deadline||!Number.isFinite(Date.parse(prompt.lastReceivedAt))||!Number.isSafeInteger(Number(prompt.lastMessageTimestamp)))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
 const messageAt=Number(r.proof.value.timestamp)*1000,fresh=Number.isSafeInteger(messageAt)&&messageAt<=r.now.getTime()+60000&&r.now.getTime()-messageAt<86400000&&(Number(r.proof.value.timestamp)>Number(prompt.lastMessageTimestamp)||Number(r.proof.value.timestamp)===Number(prompt.lastMessageTimestamp)&&new Date(r.event.createdAt).getTime()>=Date.parse(prompt.lastReceivedAt));
 return {header,prompt,fresh};
}

// Transport adapter, not a second field engine. The internal resolver supplies
// the canonical actor after checking signed proof, binding, KYC and assignment.
// It never creates a Clerk session or weakens the web authentication verifier.
export function createMetaFieldBridge({connect,environment=process.env,resolveIdentity=resolveWorkerChannelIdentity,provider,put,get,analyzer,planAnalyzer,usage=null,protocol=META_CUSTOMER_PROTOCOL,attendanceOnly=false}){
 resolveMetaCloudProtocol(protocol);
 const lockedResolutions=new WeakMap();
 const within=run=>customerJobTransaction(connect,async client=>{
  const resolutions=new Set();lockedResolutions.set(client,resolutions);
  try{return await run(client);}finally{for(const resolved of resolutions)releaseLockedWorkerChannelIdentity(resolved);lockedResolutions.delete(client);}
 });
 const seal=(r,purpose,resourceId,value)=>encryptCustomerSecret(JSON.stringify(value),{organizationId:r.member.organizationId,projectId:r.project.id,purpose,resourceId},environment);
 function unseal(r,purpose,resourceId,value){try{return JSON.parse(decryptCustomerSecret(value,{organizationId:r.member.organizationId,projectId:r.project.id,purpose,resourceId},environment));}catch{throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);}}
 const conversation=r=>readMetaFieldConversation(r,environment);
 function progressEvidenceDeadline(r,state){
  if(!state||!Object.hasOwn(state,'progressEvidenceWait'))return null;
  const fixed=state.progressEvidenceWait,header=r.worker.metadata?.fieldChannelConversation;
  if(state.purpose!=='PROGRESS'||!['PROGRESS_EVIDENCE_WAIT','PROGRESS_EVIDENCE','REASON','CONFIRM'].includes(state.step)||!fixed||typeof fixed!=='object'||Array.isArray(fixed)||Object.keys(fixed).sort().join('|')!=='deadline|version'||fixed.version!==1||typeof fixed.deadline!=='string'||!Number.isFinite(Date.parse(fixed.deadline))||new Date(fixed.deadline).toISOString()!==fixed.deadline||fixed.deadline!==state.expiresAt||header?.version!==1||header.bindingId!==r.channelBinding.id||header.expiresAt!==fixed.deadline)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  return fixed.deadline;
 }
 function conversationEnvelope(r,state){
  if(!state)return null;
  const fixed=state.consumptionRecovery,progressDeadline=progressEvidenceDeadline(r,state);
  if(fixed&&(fixed.version!==1||fixed.contextDigest!==r.principalDigest||!Number.isFinite(Date.parse(fixed.deadline))||fixed.deadline!==state.expiresAt))throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  const value={...state,version:1,lastEventId:r.event.id,lastMessageTimestamp:r.proof.value.timestamp,lastReceivedAt:new Date(r.event.createdAt).toISOString(),expiresAt:fixed?fixed.deadline:progressDeadline||new Date(r.now.getTime()+15*60000).toISOString(),bindingId:r.channelBinding.id};
  return {version:1,lastEventId:value.lastEventId,lastMessageTimestamp:value.lastMessageTimestamp,lastReceivedAt:value.lastReceivedAt,expiresAt:value.expiresAt,bindingId:value.bindingId,encryptedState:seal(r,'field-conversation',r.worker.id,value)};
 }
 async function resolve(client,context,permission=null,beforeProject){
  const r=await resolveIdentity(client,{eventId:context.eventId,permission,claimChallenge:true,environment,...(beforeProject?{beforeProject}:{})});
  if(canonicalFieldResolvers.has(resolveIdentity))lockedResolutions.get(client)?.add(r);
  return scopedIdentity(r,context,(await client.query('SELECT clock_timestamp() AS now')).rows[0].now);
 }
 function scopedIdentity(r,context,now){
  const {event,project,connection}=r;
  const expiresAt=new Date(event.leaseExpiresAt).getTime();
  if(event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(expiresAt)||expiresAt<=now.getTime()||(r.sourceProjectId||project.id)!==context.projectId||connection.id!==context.channelId||event.payload.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  return {...r,now,principalDigest:consumptionContext(r),scope:digest(['meta-field-v1',event.id,event.payload.payloadDigest,r.worker.id,connection.id])};
 }
 async function commitFence(client,r){
  await assertDevelopmentPilotCommit(client,r.connection,environment);
  if(r.companyProjection&&(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.event.leaseToken])).rows.length!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
 }
 // Reuse the signed canonical resolver, including its lock order, after awaits.
 // Recovery never renews either the source lease or the original draft deadline.
 async function recoveryFence(client,r,deadline,{allowExpired=false,withdrawal=false}={}){
  let current;const canonical=canonicalFieldResolvers.has(resolveIdentity);
  if(canonical){
   // The complete signed resolver already acquired the canonical locks. This
   // helper freshly reads principals/Worker/KYC, then source+lease+clock in a
   // second SQL statement after any new proof-lock wait. Its opaque XID-bound
   // source never substitutes for a permission or crosses a transaction.
   await assertDevelopmentPilotCommit(client,r.connection,environment);
   const refreshed=await refreshLockedWorkerChannelIdentity(client,r,{permission:withdrawal?null:'report',environment});
   current={...refreshed,principalDigest:consumptionContext(refreshed)};
  }else current=await resolve(client,{eventId:r.event.id,projectId:r.sourceProjectId||r.event.projectId,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,leaseToken:r.event.leaseToken},withdrawal?null:'report');
  if(current.principalDigest!==r.principalDigest||!withdrawal&&current.worker.metadata?.participant?.permissions?.report!==true)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  let observed=current.now;if(!canonical){await commitFence(client,current);observed=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;}r.now=observed;
  if(current.event.status!=='PENDING'||!Number.isFinite(new Date(current.event.leaseExpiresAt).getTime())||new Date(current.event.leaseExpiresAt).getTime()<=observed.getTime())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  if(!allowExpired&&(!Number.isFinite(Date.parse(deadline))||Date.parse(deadline)<=observed.getTime()))throw new WorkspaceError(recoveryExpired,409);
  return current;
 }
 async function progressEvidenceFence(client,r,state){
  const deadline=progressEvidenceDeadline(r,state);if(!deadline)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  try{await recoveryFence(client,r,deadline);}catch(error){if(error.code===recoveryExpired)throw new WorkspaceError(progressDraftExpired,409);throw error;}
 }
 function recoveryHeader(r){
  return inspectMetaFieldConsumptionRecovery(r)?.header||null;
 }
 async function readRecovery(client,r){
  const envelope=recoveryHeader(r);if(!envelope)return null;
  await recoveryFence(client,r,envelope.deadline,{allowExpired:true});
  if(Date.parse(envelope.deadline)<=r.now.getTime())return {version:1,id:envelope.id,contextDigest:envelope.contextDigest,deadline:envelope.deadline,expired:true};
  const value=unseal(r,'field-consumption-recovery',r.worker.id,envelope.encryptedState);
  if(value.version!==1||value.id!==envelope.id||value.contextDigest!==envelope.contextDigest||value.deadline!==envelope.deadline||!value.suggestion||typeof value.suggestion.quantity!=='string'||typeof value.suggestion.reason!=='string')throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  return value;
 }
 function catalogRecovery(r,state,previous){
  const error={code:'INVENTORY_CATALOG_CHANGED',eventId:r.event.id,receiptId:receiptId(r.event.id)},origin=previous?.origin||{lastEventId:state.lastEventId,lastMessageTimestamp:state.lastMessageTimestamp,lastReceivedAt:state.lastReceivedAt,nonce:state.nonce,bindingId:state.bindingId};
  return {version:1,id:previous?.id||digest([r.principalDigest,origin,state.expiresAt]),contextDigest:r.principalDigest,deadline:previous?.deadline||state.expiresAt,origin,suggestion:{materialId:state.materialId,name:state.name,unit:state.unit,quantity:state.quantity,reason:state.reason,taskId:state.taskId,sectorId:state.sectorId},firstError:previous?.firstError||error,lastError:error};
 }
 const expiryReply=r=>result(r,'CONSUMPTION_RECOVERY',text(consumptionRecoveryExpiryBody),{code:recoveryExpired});
 const resultForProgressExpiry=r=>result(r,'INPUT_REVIEW',text(progressDraftExpiryBody),{code:progressDraftExpired});
 // The credential remains anchored to the physical connection; business input
 // stays on the immutable event projection. Neither uses the current selector.
 const mediaIdentity=r=>digest([r.member.organizationId,r.member.actorId,r.member.membershipId,r.member.clerkUserId,r.project.id,r.worker.id,r.channelBinding.id,r.connection.id,r.connection.projectId,r.connection.phoneNumberId,r.connection.whatsappBusinessId,r.connection.encryptedAccessToken,r.sourceProjectId||r.project.id,r.event.id,r.event.payload.payloadDigest,r.companyProjection?{projectId:r.companyProjection.projectId,workerId:r.companyProjection.workerId,assignmentRevision:r.companyProjection.assignmentRevision,bindingId:r.companyProjection.bindingId,routeId:r.companyProjection.routeId,routeEpoch:r.companyProjection.routeEpoch}:null]);
 function assertPrepared(r,prepared){if(mediaIdentity(r)!==prepared.identityDigest||r.project.id!==prepared.projectId||r.scope!==prepared.scope||Boolean(r.companyProjection)!==prepared.corporate)throw new WorkspaceError('META_CHANNEL_MEDIA_CONTEXT_CHANGED',409);}
 function operations(client,r){
  const session={userId:r.member.clerkUserId},member={...r.member,role:'AUDITOR',channelProof:{provider:protocol.provider,eventId:r.event.id,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,bindingId:r.channelBinding.id}};
  const workspace={projectOperation:async(s,input,writable,callback)=>{
   if(s!==session||input.projectId!==r.project.id||input.scope!==r.scope)throw new WorkspaceError('META_CHANNEL_CONTEXT_CHANGED',409);
   // Channel actions have participant permissions even when the same human
   // holds an office role. Review and approval are restricted to the web UI.
   // Each canonical recovery guard ends with its own fresh source/lease/clock.
   // Custom guards retain the original independent commit fences.
   const canonicalRecovery=canonicalFieldResolvers.has(resolveIdentity)&&typeof r.recoveryGuard==='function';
   if(!canonicalRecovery)await commitFence(client,r);
   if(r.recoveryGuard)await r.recoveryGuard();
   const value=await callback(client,member,r.scope,r.project);
   if(r.recoveryGuard)await r.recoveryGuard();
   if(!canonicalRecovery)await commitFence(client,r);
   return value;
  }};
  return {session,service:createFieldOperations({workspace})};
 }
 async function saved(client,r){const row=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.field.dispatched'`,[receiptId(r.event.id),r.member.organizationId,r.member.actorId,r.worker.id])).rows[0];if(!row)return null;if(row.metadata?.payloadDigest!==r.event.payload.payloadDigest||row.metadata.channelBindingId!==r.channelBinding.id)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);if(row.metadata.kind==='CONSUMPTION_RECOVERY'&&Number.isFinite(Date.parse(row.metadata.consumptionRecoveryDeadline))&&Date.parse(row.metadata.consumptionRecoveryDeadline)<=r.now.getTime()){const expired=await authorizeFieldReceipt(client,r,row.metadata,{environment,reply:consumptionRecoveryExpiryMessage(r)});if(expired.derivedExpiryFeedback)return expiryReply(r);}if(['CONSUMPTION_PROPOSAL','CONSUMPTION_READ','CONSUMPTION_RECOVERY','FIELD_REPORT_READ'].includes(row.metadata.kind)&&(attendanceOnly||r.connection.metadata?.developmentPilot||r.worker.metadata?.participant?.permissions?.report!==true))throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);if(row.metadata.kind==='CONSUMPTION_RECOVERY'||row.metadata.kind===recoveryCancelled||row.metadata.consumptionRecoveryContext!==undefined){if(row.metadata.consumptionRecoveryContext!==r.principalDigest)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);try{await recoveryFence(client,r,row.metadata.consumptionRecoveryDeadline,{allowExpired:row.metadata.kind!=='CONSUMPTION_RECOVERY',withdrawal:row.metadata.kind===recoveryCancelled});}catch(error){if(error.code!==recoveryExpired)throw error;return expiryReply(r);}}const value=(await authorizeFieldReceipt(client,r,row.metadata,{environment})).result;if(canonicalFieldResolvers.has(resolveIdentity))await writeMetaFieldCompanyResult(client,r,value,environment);await commitFence(client,r);return value;}
 async function record(client,r,result,state,{onlyIfCurrent=false,preserveConversation=false,recovery=null,recoveryUpdate=null,allowRecoveryExpired=false,allowProgressExpired=false,withdrawalSnapshot=null,disclosure=null}={}){
  const progressPending=!allowProgressExpired&&(typeof r.progressEvidenceGuard==='function'||Boolean(state?.progressEvidenceWait&&!preserveConversation));
  const progressFence=async()=>{if(progressPending)await (r.progressEvidenceGuard?r.progressEvidenceGuard():progressEvidenceFence(client,r,state));};
  const withdrawal=result.kind===recoveryCancelled&&typeof withdrawalSnapshot==='string';
  const beforeWrite=async()=>{const current=await recoveryFence(client,r,recovery.deadline,{allowExpired:allowRecoveryExpired,withdrawal});if(withdrawal&&withdrawalSnapshot!==digest([current.worker.metadata?.fieldConsumptionRecovery,current.worker.metadata?.fieldChannelConversation]))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);};
  if(recovery)await client.query('SAVEPOINT meta_field_recovery_record');
  if(progressPending)await client.query('SAVEPOINT meta_field_progress_record');
  try{
  await progressFence();
  if(recovery)await beforeWrite();
  await assertDevelopmentPilotCommit(client,r.connection,environment);
  const current=(await client.query(`SELECT metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id])).rows[0];
  if(recovery)await beforeWrite();
  if(withdrawal&&withdrawalSnapshot!==digest([current.metadata?.fieldConsumptionRecovery,current.metadata?.fieldChannelConversation]))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  const writesConversation=!preserveConversation&&(!onlyIfCurrent||current.metadata?.fieldChannelConversation?.lastEventId===r.event.id);
  if(writesConversation&&r.companyProjection&&state&&state.purpose!=='MENU'&&result.reply?.type==='text'){
   const instruction='\nPara continuar, mantené presionado este mensaje, elegí Responder y enviá el dato, la ubicación o el archivo desde esa respuesta. Para cancelar, respondé a este mismo mensaje con CANCELAR.';
   result={...result,reply:{...result.reply,body:result.reply.body.slice(0,4096-instruction.length)+instruction}};
  }
  await progressFence();
  if(writesConversation||recoveryUpdate){const metadata={...current.metadata};if(writesConversation){metadata.fieldChannelConversation=conversationEnvelope(r,state);if(!state||state.purpose!=='CONSUMPTION')delete metadata.fieldConsumptionRecovery;}if(recoveryUpdate)metadata.fieldConsumptionRecovery={version:1,id:recoveryUpdate.id,contextDigest:recoveryUpdate.contextDigest,deadline:recoveryUpdate.deadline,bindingId:r.channelBinding.id,encryptedState:seal(r,'field-consumption-recovery',r.worker.id,recoveryUpdate)};await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify(metadata)]);}
  if(recovery)await recoveryFence(client,r,recovery.deadline,{allowExpired:allowRecoveryExpired,withdrawal});
  const replyAuthority=createMetaFieldReplyAuthority(r,disclosure||canonicalReplyDisclosure(result),result.reply);
  await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'meta.field.dispatched','Worker',$4,$5::jsonb)`,[receiptId(r.event.id),r.member.organizationId,r.member.actorId,r.worker.id,JSON.stringify({version:1,projectId:r.project.id,channelId:r.connection.id,channelBindingId:r.channelBinding.id,eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,businessApplied:result.businessApplied,kind:result.kind,receiptId:result.receiptId||null,replyAuthority,replyAuthorityCommitment:replyAuthorityCommitment(r,replyAuthority,result.kind,recovery?.contextDigest||null,recovery?.deadline||null,environment),...(recovery?{consumptionRecoveryContext:recovery.contextDigest,consumptionRecoveryDeadline:recovery.deadline}:{}),encryptedResult:seal(r,'field-dispatch',receiptId(r.event.id),result)})]);
  if(recovery)await recoveryFence(client,r,recovery.deadline,{allowExpired:allowRecoveryExpired,withdrawal});
  if(r.companyProjection||r.connection.metadata?.developmentPilot){const fenced=await client.query(`UPDATE public."WebhookEvent" SET "appliedAt"=CASE WHEN $3::boolean THEN clock_timestamp() ELSE "appliedAt" END WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.event.leaseToken,result.businessApplied===true]);if(fenced.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);}
  if(canonicalFieldResolvers.has(resolveIdentity))await writeMetaFieldCompanyResult(client,r,result,environment);if(r.companyProjection&&(!recovery||!canonicalFieldResolvers.has(resolveIdentity)))await commitFence(client,r);
  await assertDevelopmentPilotCommit(client,r.connection,environment);
  if(recovery)await recoveryFence(client,r,recovery.deadline,{allowExpired:allowRecoveryExpired,withdrawal});
  await progressFence();
  }catch(error){if(progressPending&&error.code===progressDraftExpired){await client.query('ROLLBACK TO SAVEPOINT meta_field_progress_record');if(result.businessApplied)throw error;return record(client,r,resultForProgressExpiry(r),state,{preserveConversation:true,allowProgressExpired:true});}if(!recovery||error.code!==recoveryExpired||allowRecoveryExpired)throw error;await client.query('ROLLBACK TO SAVEPOINT meta_field_recovery_record');if(result.businessApplied)throw error;return record(client,r,expiryReply(r),state,{preserveConversation:true,recovery,recoveryUpdate,allowRecoveryExpired:true});}
  return result;
 }
 const result=(r,kind,reply,extra={})=>({kind,identityStatus:'CHANNEL_VERIFIED',workerId:r.worker.id,reviewState:'OBSERVED',businessApplied:false,replySent:false,reply:attendanceOnly||r.companyProjection?{...reply,body:('Obra: '+r.project.name+'\n'+reply.body).slice(0,reply.type==='interactive'?1024:4096)}:reply,...extra});
 const mediaContextCodes=new Set(['FIELD_SECTOR_UNAVAILABLE','WORKSPACE_TASK_UNAVAILABLE','FIELD_REVISION_CHANGED']);
 const recoverableMediaContext=error=>error instanceof WorkspaceError&&mediaContextCodes.has(error.code);
 const mediaContextResult=(r,code)=>result(r,'MEDIA_CONTEXT_REVIEW',text('Cambió la tarea o el sector durante la carga. No registramos esta evidencia. Escribí EVIDENCIA y elegí nuevamente la tarea y el sector actuales.'),{code});
 async function requireMediaOrigin(client,r,media,state){if(!media.sourceOrigin)return;const checked=await inspectMetaFieldMediaOrigin(client,r,media,{...state,version:1},{environment,now:r.now,protocol});if(!checked.valid)throw new WorkspaceError(checked.code,409);}
 async function recordMediaContext(client,r,code){
  await commitFence(client,r);
  const lease=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.event.leaseToken])).rows;
  if(lease.length!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  return record(client,r,mediaContextResult(r,code),null,{onlyIfCurrent:true});
 }
 async function closeMediaContext(context,prepared,error){return within(async client=>{
  const r=await resolve(client,context,'report');assertPrepared(r,prepared);const prior=await saved(client,r);if(prior)return prior;
  try{await requireMediaOrigin(client,r,prepared.media,prepared.state);}catch(current){if(!recoverableMediaContext(current))throw current;}
  return recordMediaContext(client,r,error.code);
 });}
 async function prepareMedia(client,r,media,state){
  assertDevelopmentPilotAdapter(r.connection,'media');
  if(r.worker.metadata.participant.permissions.report!==true)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  try{await requireMediaOrigin(client,r,media,state);}catch(error){if(!recoverableMediaContext(error))throw error;return {done:await recordMediaContext(client,r,error.code)};}
  const renewed=await client.query(`UPDATE public."WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '180 seconds' WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.event.leaseToken]);
  if(renewed.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  const token=decryptCustomerSecret(r.connection.encryptedAccessToken,{organizationId:r.member.organizationId,projectId:r.connection.projectId,purpose:protocol.credentialPurpose,resourceId:r.connection.phoneNumberId},environment);
  return {media,state,token,phoneNumberId:r.connection.phoneNumberId,connection:r.connection,ownCompanyCapability:r.ownCompanyCapability,userId:r.member.clerkUserId,scope:r.scope,workerId:r.worker.id,projectId:r.project.id,corporate:Boolean(r.companyProjection),identityDigest:mediaIdentity(r)};
 }
 async function prepare(client,context){
  const type=(await client.query(`SELECT "eventType" FROM public."WebhookEvent" WHERE id=$1 AND provider=$2`,[context.eventId,protocol.provider])).rows[0];if(type?.eventType!=='message')return null;
  return prepareResolved(client,await resolve(client,context));
 }
 async function prepareResolved(client,r){
  const previous=await saved(client,r);if(previous)return {done:previous};
  if(r.kind==='CHANNEL_BOUND')return {done:await record(client,r,result(r,'CHANNEL_BOUND',text('Tu canal quedó vinculado a esta participación. Escribí MENU para continuar cuando el responsable active la conexión de la empresa.')),null)};
  if(plans.configured&&canImportPlan(r.member.role)){const previousPlan=await plans.recover(client,r);if(previousPlan)return previousPlan;}
  const key='meta_field_media_'+digest(r.event.id),previousMedia=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.field.media.prepared'`,[key,r.member.organizationId,r.member.actorId,r.worker.id])).rows[0];
  // A later conversation must not erase a durable upload already requested by
  // this message. Recovery uses its recorded input and preserves the new draft.
  if(previousMedia){if(previousMedia.metadata.projectId!==r.project.id||previousMedia.metadata.eventId!==r.event.id||previousMedia.metadata.payloadDigest!==r.event.payload.payloadDigest||previousMedia.metadata.channelBindingId!==r.channelBinding.id)throw new WorkspaceError('META_CHANNEL_MEDIA_CONTEXT_CHANGED',409);const input=unseal(r,'field-media-prepared',key,previousMedia.metadata.encryptedInput);return prepareMedia(client,r,input.media,input.state);}
  const cancelling=r.proof.value.type==='text'&&r.proof.value.text?.body?.trim().toUpperCase()==='CANCELAR',messageAt=Number(r.proof.value.timestamp)*1000;
  // Withdrawal uses only the principal-bound clear headers. Revoking report
  // permission must not trap an otherwise authorized attendance participant,
  // and neither private draft is decrypted merely to discard it.
  if(cancelling&&r.worker.metadata?.fieldConsumptionRecovery){
   const {header,prompt,fresh}=inspectMetaFieldConsumptionRecovery(r);
   if(fresh)return {done:await record(client,r,result(r,recoveryCancelled,text('Borrador de consumo descartado. Conservamos el recibo del rechazo anterior; no guardamos otra propuesta ni descontamos stock. Escribí MENU para continuar.')),null,{recovery:header,allowRecoveryExpired:true,withdrawalSnapshot:digest([header,prompt])})};
  }
  const recovery=await readRecovery(client,r);
  if(recovery?.expired)return {done:await record(client,r,expiryReply(r),null,{preserveConversation:true,recovery,allowRecoveryExpired:true})};
  const state=conversation(r);
  if(state&&Object.hasOwn(state,'progressEvidenceWait'))progressEvidenceDeadline(r,state);
  if(state?.consumptionRecovery&&(!recovery||state.consumptionRecovery.id!==recovery.id||state.consumptionRecovery.contextDigest!==recovery.contextDigest||state.consumptionRecovery.deadline!==recovery.deadline||state.expiresAt!==recovery.deadline))throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  if(recovery&&state&&!state.consumptionRecovery&&['lastEventId','lastMessageTimestamp','lastReceivedAt','nonce','bindingId'].some(key=>state[key]!==recovery.origin?.[key]))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  if(recovery){if(!state||state.purpose!=='CONSUMPTION')throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);r.recoveryGuard=()=>recoveryFence(client,r,recovery.deadline,{allowExpired:cancelling});if(!cancelling&&Date.parse(recovery.deadline)<=r.now.getTime())return {done:await record(client,r,expiryReply(r),state,{preserveConversation:true,recovery,allowRecoveryExpired:true})};}
  const stale=state&&(Number(r.proof.value.timestamp)<Number(state.lastMessageTimestamp)||Number(r.proof.value.timestamp)===Number(state.lastMessageTimestamp)&&new Date(r.event.createdAt).getTime()<Date.parse(state.lastReceivedAt));
  if(stale||!Number.isSafeInteger(messageAt)||messageAt>r.now.getTime()+60000||r.now.getTime()-messageAt>=86400000)return {done:await record(client,r,result(r,recovery?'CONSUMPTION_RECOVERY':'STALE_CONVERSATION',text('Este mensaje pertenece a un paso anterior. Conservamos el borrador más reciente. '+(recovery?'Respondé al mensaje vigente para continuar.':'Escribí MENU para empezar de nuevo.')),{code:'META_CHANNEL_STALE_MESSAGE'}),state,{onlyIfCurrent:true,preserveConversation:Boolean(recovery),recovery})};
  const limited=attendanceOnly||Boolean(r.connection.metadata?.developmentPilot),catalogOnly=r.worker.metadata.participant.permissions.report===true&&metaFieldRecoveryCatalogRead({message:r.proof.value,state,recovery,now:r.now,attendanceOnly:limited});
  const {session,service}=operations(client,r);let data;try{data=catalogOnly?await service.recoveryMaterialCatalog(session,{projectId:r.project.id,scope:r.scope,workerId:r.worker.id}):await service.read(session,{projectId:r.project.id,scope:r.scope});}catch(error){if(!recovery||error.code!==recoveryExpired)throw error;return {done:await record(client,r,expiryReply(r),state,{preserveConversation:true,recovery,allowRecoveryExpired:true})};}
  const action=r.proof.value.type==='text'?metaFieldConversationAction(r.proof.value.text?.body):null;
  const activeState=state?.version===1&&Date.parse(state.expiresAt)>r.now.getTime()&&(!action||r.proof.value.text?.body?.trim().toUpperCase()==='HOLA'&&state.purpose!=='MENU')?state:null;
  const progressWithdrawal=Boolean(activeState?.purpose==='PROGRESS'&&activeState.progressEvidenceWait&&selectedChoice(activeState,r.proof.value)==='CANCEL');
  const replyPrefix=attendanceOnly||r.companyProjection?'Obra: '+r.project.name+'\n':'',facts={projectName:r.project.name,projectId:limited?null:r.project.id,replyBodyLimit:Math.max(0,1024-replyPrefix.length),workerId:r.worker.id,permissions:limited?{attendance:r.worker.metadata.participant.permissions.attendance,report:false}:r.worker.metadata.participant.permissions,attendanceOnly:limited,inventory:data.inventory,...(!catalogOnly?{sectors:data.sectors,evidence:data.evidence,proposals:data.proposals,latest:data.attendance.filter(e=>e.workerId===r.worker.id).sort((a,b)=>b.sequence-a.sequence)[0]||null}:{}),mediaReferenceContext:{eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,contextDigest:metaFieldMediaContextDigest(r),sourceProjectId:r.sourceProjectId||r.event.projectId},planImportRole:plans.configured&&!limited?r.member.role:null,planImportReferenceContext:{eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,contextDigest:metaPlanImportContextDigest(r),sourceProjectId:r.sourceProjectId||r.event.projectId}};
  if(recovery)facts.consumptionRecovery=recovery;
  if(state?.purpose==='PLAN_IMPORT'&&Date.parse(state.expiresAt)>r.now.getTime()&&action!=='TASKS'&&!['HOLA','ESTADO','MENU','AYUDA'].includes(r.proof.value.text?.body?.trim().toUpperCase())&&!await metaPlanImportPromptMatches(client,r,state,environment))return {done:await record(client,r,result(r,'PLAN_IMPORT_CONTEXT_REQUIRED',text('Respondé al mensaje vigente del cronograma para enviar el archivo o elegir su autorización. Conservamos el paso y no guardamos ni analizamos archivos.')),state,{preserveConversation:true})};
  let plan;
  try{
   const selected=selectedChoice(activeState,r.proof.value),consumptionAction=['STATUS','OWN_CONSUMPTIONS'].includes(action)||activeState?.step==='MENU'&&selected==='STATUS'||activeState?.purpose==='OWN_CONSUMPTIONS'&&selected&&selected!=='MENU';
   if(facts.permissions.report===true&&consumptionAction){let afterConsumption=null,consumptionId=null;
    if(activeState?.purpose==='OWN_CONSUMPTIONS'&&!action){
     if(selected==='NEXT_CONSUMPTIONS'){if(!workspaceId(activeState.nextConsumptionCursor))throw new WorkspaceError('INVENTORY_CURSOR_UNAVAILABLE',404);afterConsumption=activeState.nextConsumptionCursor;}
     else if(selected==='BACK_CONSUMPTIONS')afterConsumption=activeState.consumptionAfter??null;
     else if(activeState.step==='OWN_CONSUMPTION_LIST'&&!['FIRST_CONSUMPTIONS','OWN_CONSUMPTIONS'].includes(selected)){consumptionId=selected;}
    }
    facts.ownConsumptions=await service.ownConsumptions(session,{projectId:r.project.id,scope:r.scope,workerId:r.worker.id,afterConsumption,consumptionId});
   }
   const ownPurposes=['OWN_EVIDENCE','OWN_PROGRESS'],ownReads=['OWN_CONSUMPTIONS',...ownPurposes],businessDraft=state?.version===1&&Date.parse(state.expiresAt)>r.now.getTime()&&!['MENU',...ownReads].includes(state.purpose);
   const reportPurpose=ownPurposes.includes(action)?action:ownPurposes.includes(selected)&&ownReads.includes(activeState?.purpose)?selected:ownPurposes.includes(activeState?.purpose)&&selected&&selected!=='MENU'?activeState.purpose:null;
   if(facts.permissions.report===true&&reportPurpose&&!businessDraft){let afterReport=null,reportId=null;
    if(activeState?.purpose===reportPurpose&&!action&&!ownPurposes.includes(selected)){
     if(selected==='NEXT_REPORTS'){if(!workspaceId(activeState.nextReportCursor))throw new WorkspaceError('FIELD_REPORT_CURSOR_UNAVAILABLE',404);afterReport=activeState.nextReportCursor;}
     else if(selected==='FIRST_REPORTS')afterReport=null;
     else if(activeState.step==='OWN_REPORT_LIST'){reportId=selected;}
    }
    facts.ownReports=await service.ownReports(session,{projectId:r.project.id,scope:r.scope,workerId:r.worker.id,section:reportPurpose==='OWN_EVIDENCE'?'EVIDENCE':'PROGRESS',afterReport,reportId});
   }
   if(!catalogOnly){if(progressWithdrawal||limited&&(action==='TASKS'||activeState?.purpose==='TASKS'))facts.tasks=[];
   else Object.assign(facts,await readMetaFieldTaskCatalog(client,{projectId:r.project.id,state:activeState||{purpose:action},message:r.proof.value}));}
   if(!progressWithdrawal&&facts.permissions.report===true&&activeState?.purpose==='PROGRESS'&&activeState.taskId)Object.assign(facts,await readMetaFieldEvidenceCatalog(client,{organizationId:r.member.organizationId,projectId:r.project.id,workerId:r.worker.id,actorId:r.member.actorId,state:activeState,message:r.proof.value,tasks:facts.tasks}));
   if(recovery)await recoveryFence(client,r,recovery.deadline,{allowExpired:cancelling});
   plan=planMetaFieldConversation({message:r.proof.value,state,eventId:r.event.id,facts,now:r.now});
   // Only this exact canonical planner branch is satisfied by the narrow read.
   // Future branches must request their own facts, never receive fake feeds.
   if(catalogOnly&&(!metaFieldRecoveryCatalogPlan(plan)||metaFieldPlanDisclosure(plan)!=='REPORT'||plan.command||plan.media||plan.planImport||plan.reportRead||plan.consumptionRead||plan.state?.purpose!=='CONSUMPTION'))throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
  }
  catch(error){
   if(recovery&&error.code===recoveryExpired)return {done:await record(client,r,expiryReply(r),state,{preserveConversation:true,recovery,allowRecoveryExpired:true})};
   if(['FIELD_REPORT_CURSOR_UNAVAILABLE','FIELD_REPORT_UNAVAILABLE','FIELD_REPORT_INTEGRITY','FIELD_REPORT_QUERY_INVALID'].includes(error.code))return {done:await record(client,r,result(r,'FIELD_REPORT_READ',text('No se pudo confirmar ese informe con tu acceso vigente. Conservamos el paso. Escribí EVIDENCIAS o AVANCES para consultar una lista actual; la consulta no cambia la tarea.'),{code:'FIELD_REPORT_READ_UNAVAILABLE'}),state,{preserveConversation:true})};
   if(!safeErrors.has(error.code))throw error;return {done:await record(client,r,result(r,recovery?'CONSUMPTION_RECOVERY':'INPUT_REVIEW',text(explanation(error.code)+' Escribí CANCELAR para volver al menú.'),{code:error.code}),state,{preserveConversation:Boolean(recovery)||Boolean(state?.progressEvidenceWait),recovery})};}
  if(plan.planImport)return plans.prepare(client,r,plan.planImport,{...plan.state,version:1});
  if(plan.media){
   assertDevelopmentPilotAdapter(r.connection,'media');
   if(facts.permissions.report!==true)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
   await requireMediaOrigin(client,r,plan.media,plan.state);
   await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'meta.field.media.prepared','Worker',$4,$5::jsonb)`,[key,r.member.organizationId,r.member.actorId,r.worker.id,JSON.stringify({version:1,projectId:r.project.id,eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,channelBindingId:r.channelBinding.id,encryptedInput:seal(r,'field-media-prepared',key,{media:plan.media,state:plan.state})})]);
   await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify({...r.worker.metadata,fieldChannelConversation:conversationEnvelope(r,plan.state)})]);
   return prepareMedia(client,r,plan.media,plan.state);
  }
  if(plan.command){
   assertDevelopmentPilotAdapter(r.connection,plan.command.action==='ATTENDANCE'?'attendance':'progress');
   const required=permissionFor(plan.command.action);if(facts.permissions[required]!==true)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
   // A failed command must not leave partial effects before its friendly error.
   await client.query('SAVEPOINT meta_field_command');
   if(state?.progressEvidenceWait&&plan.command.action==='PROPOSE_PROGRESS'){r.progressEvidenceGuard=()=>progressEvidenceFence(client,r,state);r.recoveryGuard=r.progressEvidenceGuard;}
   try{const outcome=await service.save(session,{projectId:r.project.id,scope:r.scope,operationId:metaFieldOperationId(r.event.id,plan.command.action),...plan.command});
    const reply=text(outcome.kind==='ATTENDANCE'?(attendanceOnly?'Fichaje guardado en '+r.project.name+'. ':'Fichaje guardado. ')+(outcome.event.verificationStatus==='REVIEW_REQUIRED'?'Quedó pendiente de revisión humana.':'Podés consultar el recibo en Mi cuenta.'):outcome.kind==='INCIDENT_REPORT'?'Incidencia guardada para seguimiento del responsable.':outcome.kind==='MATERIAL_REQUEST'?'Pedido de material guardado. La compra todavía requiere autorización.':outcome.kind==='CONSUMPTION_PROPOSAL'?metaFieldConsumptionAcknowledgement(outcome,r.project.name):'Propuesta de avance guardada. La tarea conservará su avance hasta una decisión autorizada.');
    return {done:await record(client,r,result(r,outcome.kind,reply,{businessApplied:true,receiptId:outcome.receiptId,reviewState:'RECORDED'}),plan.state,{recovery})};
   }catch(error){
    if(error.code===progressDraftExpired){await client.query('ROLLBACK TO SAVEPOINT meta_field_command');return {done:await record(client,r,resultForProgressExpiry(r),state,{preserveConversation:true,allowProgressExpired:true})};}
    if(recovery&&error.code===recoveryExpired){await client.query('ROLLBACK TO SAVEPOINT meta_field_command');return {done:await record(client,r,expiryReply(r),state,{preserveConversation:true,recovery,allowRecoveryExpired:true})};}
    if(!safeErrors.has(error.code))throw error;await client.query('ROLLBACK TO SAVEPOINT meta_field_command');
    if(error.code==='INVENTORY_CATALOG_CHANGED'&&plan.command.action==='PROPOSE_CONSUMPTION'&&state?.purpose==='CONSUMPTION'&&state.step==='CONFIRM'){
     const retained=catalogRecovery(r,state,recovery);return {done:await record(client,r,result(r,'CONSUMPTION_RECOVERY',text('El catálogo cambió. Conservamos tu material, cantidad, motivo y plazo; no guardamos una propuesta ni descontamos stock. Respondé al mensaje original con CONSUMO para volver a elegir el material y confirmar cantidad y motivo, o CANCELAR para descartarlo.'),{code:error.code}),state,{preserveConversation:true,recovery:retained,recoveryUpdate:retained})};
    }
    const retainedProgress=Boolean(state?.progressEvidenceWait);
    return {done:await record(client,r,result(r,recovery?'CONSUMPTION_RECOVERY':'INPUT_REVIEW',text(explanation(error.code)+(retainedProgress?' Conservamos la medición y el plazo original. Respondé al paso vigente para volver a comprobar o con CANCELAR para descartar el borrador.':' Escribí MENU para continuar.')),{code:error.code}),recovery||retainedProgress?state:null,{preserveConversation:Boolean(recovery)||retainedProgress,recovery})};
   }
  }
  // Corporate status is a canonical ledger read. Its receipt cannot replace
  // the active prompt or discard a draft that still requires explicit cancel.
  const cancelledRecovery=Boolean(recovery&&plan.state===null&&state?.step==='CONFIRM'&&selectedChoice(state,r.proof.value)==='CANCEL');
  return {done:await record(client,r,result(r,cancelledRecovery?recoveryCancelled:recovery?'CONSUMPTION_RECOVERY':plan.reportRead?'FIELD_REPORT_READ':plan.consumptionRead?'CONSUMPTION_READ':'CONVERSATION',plan.reply),plan.state,{disclosure:metaFieldPlanDisclosure(plan),recovery,allowRecoveryExpired:cancelling||cancelledRecovery,preserveConversation:plan.preserveConversation===true||Boolean(recovery&&plan.state===state)||((limited||Boolean(r.companyProjection))&&state&& !['MENU','OWN_CONSUMPTIONS','OWN_EVIDENCE','OWN_PROGRESS'].includes(state.purpose)&&r.proof.value.type==='text'&&r.proof.value.text?.body?.trim().toUpperCase()==='ESTADO')})};
 }
 const plans=createMetaPlanImportTransport({within,resolve,saved,record,result,seal,unseal,commitFence,operationIdFor:metaFieldOperationId,environment,protocol,provider,put,get,analyzer:planAnalyzer,usage,writePending:async(client,r,state)=>{await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify({...r.worker.metadata,fieldChannelConversation:conversationEnvelope(r,state)})]);}});
 const api={async executeCompany(context){
  if(!canonicalFieldResolvers.has(resolveIdentity)||protocol!==META_CUSTOMER_PROTOCOL)throw new TypeError('Canonical company FIELD composition is required');
  const prepared=await within(async client=>{
   const dispatch=await resolveCompanyFieldDispatchIdentity(client,{eventId:context.eventId,context,environment});
   if(!dispatch?.resolved)return dispatch?.prepared||null;
   lockedResolutions.get(client).add(dispatch.resolved);
   const value=await prepareResolved(client,scopedIdentity(dispatch.resolved,context,dispatch.resolved.now));
   // This composition is only a text catalog recovery. External media/plan I/O
   // and every other operation retain their ordinary separate transactions.
   if(!value?.done)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);
   return value;
  });
  if(!prepared)return null;if(prepared.done)return prepared.done;
  return api.execute(context);
 },async execute(context){
  const prepared=await within(client=>prepare(client,context));if(!prepared)return null;if(prepared.done)return prepared.done;
  if(prepared.planning)return plans.execute(context,prepared);
  if(!provider||!put||!get||!analyzer)throw new WorkspaceError('META_CHANNEL_MEDIA_NOT_CONFIGURED',503);
  // No locks span provider I/O. Re-resolve the signed source, assignment,
  // individual KYC and binding immediately before each corporate external call.
  const own=prepared.connection?.metadata?.ownCompany||Object.hasOwn(prepared.connection?.metadata||{},'ownCompanyRuntime');
  const beforeExternal=async()=>{if(prepared.corporate||prepared.media.sourceOrigin||own)await within(async client=>{const r=await resolve(client,context,'report');assertPrepared(r,prepared);if(own)await lockOwnCompanyIssuer(client,prepared.connection,{environment});assertDevelopmentPilotAdapter(r.connection,'media');await requireMediaOrigin(client,r,prepared.media,prepared.state);await commitFence(client,r);});};
  const external=fn=>async(...args)=>{await beforeExternal();return fn(...args);};
  let media;
   const scopedProvider=own?await provider.forConnection({capability:prepared.ownCompanyCapability,connection:prepared.connection,token:prepared.token,beforeExternal}):provider;
   try{await beforeExternal();const downloaded=await scopedProvider.downloadMedia({token:prepared.token,phoneNumberId:prepared.phoneNumberId,mediaId:prepared.media.mediaId,limit:prepared.media.kind==='image'?2*1024*1024:3*1024*1024,...(prepared.corporate||prepared.media.sourceOrigin?{beforeExternal}:{})});
   media=decodeFieldMedia(downloaded.bytes,downloaded.contentType);if(downloaded.contentType.split(';')[0].trim()!==String(prepared.media.contentType).split(';')[0].trim()||media.kind!==prepared.media.kind)throw new WorkspaceError('META_CHANNEL_MEDIA_INTEGRITY',409);
   }catch(error){if(recoverableMediaContext(error))return closeMediaContext(context,prepared,error);if(!['META_CUSTOMER_MEDIA_INVALID','META_CUSTOMER_MEDIA_REJECTED','META_CUSTOMER_MEDIA_INTEGRITY','META_CHANNEL_MEDIA_INTEGRITY','FIELD_MEDIA_INVALID','FIELD_MEDIA_TOO_LARGE'].includes(error.code))throw error;
   return within(async client=>{const r=await resolve(client,context,'report'),prior=await saved(client,r);if(prior)return prior;return record(client,r,result(r,'MEDIA_REVIEW_REQUIRED',text('No pudimos guardar este archivo con su tamaño o formato actual. Prepará una foto de hasta 2 MiB o audio/video de hasta 3 MiB desde la web, o enviá otro archivo. Tu tarea conserva su avance.'),{code:error.code}),prepared.state,{onlyIfCurrent:true});});
  }
   const session={userId:prepared.userId},workspace={projectOperation:async(s,input,writable,callback,beforeProject)=>within(async client=>{const r=await resolve(client,context,'report',beforeProject);assertPrepared(r,prepared);if(s!==session||s.userId!==r.member.clerkUserId||input.projectId!==r.project.id||input.scope!==r.scope||prepared.workerId!==r.worker.id)throw new WorkspaceError('META_CHANNEL_CONTEXT_CHANGED',409);await requireMediaOrigin(client,r,prepared.media,prepared.state);await commitFence(client,r);const value=await callback(client,{...r.member,role:'AUDITOR',channelProof:{provider:protocol.provider,eventId:r.event.id,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,bindingId:r.channelBinding.id}},r.scope,r.project);await commitFence(client,r);return value;})};
  const guardedAnalyzer=Object.fromEntries(['analyzePhoto','analyzeVideo','transcribeAudio'].map(name=>[name,external((...args)=>analyzer[name](...args))]));
  const fieldOps=createFieldOperations({workspace,usage}),service=createFieldMedia({operations:fieldOps,put:external(put),get:external(get),analyzer:guardedAnalyzer,usage,environment:()=>environment});
  const base={projectId:prepared.projectId,scope:prepared.scope};let attached;
  try{attached=await service.attach(session,{...base,operationId:metaFieldOperationId(context.eventId,'MEDIA_ATTACH'),workerId:prepared.workerId,taskId:prepared.media.taskId,sectorId:prepared.media.sectorId,caption:prepared.media.caption,media});}
   catch(error){if(!recoverableMediaContext(error))throw error;return closeMediaContext(context,prepared,error);}
  let processed=attached;
  const consent=prepared.media.analysisConsent,analysisAllowed=validFieldMediaAnalysisConsent(consent)&&consent.allowed===true;
  if(analysisAllowed)try{processed=await service.process(session,{...base,operationId:metaFieldOperationId(context.eventId,'MEDIA_PROCESS'),evidenceId:attached.evidence.id,revision:attached.evidence.revision,analysisConsent:consent});}
  catch(error){if(!['FIELD_ALREADY_REVIEWED','FIELD_MEDIA_ALREADY_PROCESSED'].includes(error.code))throw error;processed={...attached,evidence:publicFieldEvidence(await workspace.projectOperation(session,base,false,client=>fieldOps.readEvidence(client,prepared.projectId,attached.evidence.id)))};}
  return within(async client=>{const r=await resolve(client,context,'report'),prior=await saved(client,r);if(prior)return prior;
   return record(client,r,result(r,'EVIDENCE',text('Evidencia guardada en privado. '+(processed.evidence.review?'El archivo ya tiene una revisión humana registrada; consultala desde la web.':!analysisAllowed?'No se envió a OpenAI. El responsable puede revisarlo manualmente desde la web.':processed.state==='PROVIDER_PENDING'?(processed.code==='ORGANIZATION_USAGE_COVERAGE_EXPIRED'?'Venció la cobertura de la empresa y se detuvo el envío de nuevas copias. El responsable puede revisar el original manualmente desde la web.':'El análisis quedó pendiente de confirmar. Consultá su estado desde la web antes de intentar otro envío; el original conserva la revisión manual.'):media.kind==='video'&&consent.noticeVersion===FIELD_VIDEO_PRIVACY_NOTICE_VERSION?metaFieldVideoResultText(processed.evidence,consent):processed.evidence.processing.status==='FAILED_RETRYABLE'?'El procesamiento necesita otro intento desde la web.':media.kind==='video'?'Se analizaron cuatro cuadros sin audio. El responsable debe revisar el video original antes de aprobar avances.':media.kind==='audio'&&processed.evidence.processing.result?.progressDraft?'Se preparó un borrador desde la transcripción. Otra persona debe revisar y aprobar el audio en la web. Después, escribí AVANCE para revisar el borrador y completar la medición acumulada.':'El responsable debe revisar el archivo antes de aprobar avances.')+' Escribí MENU para continuar.'),{businessApplied:true,receiptId:attached.receiptId,reviewState:'RECORDED'}),null,{onlyIfCurrent:true});});
 }};
 return api;
}


const optionalPurposes=new Set(['INCIDENT','MATERIAL','CONSUMPTION']);
const taskColumns=`id,title,status::text AS status,progress,metadata,to_char("startsAt",'YYYY-MM-DD') AS "startsOn",to_char("endsAt",'YYYY-MM-DD') AS "endsOn",to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision,to_char("createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt"`;
const unavailable=()=>{throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);};
function validCursor(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='createdAt|id'||!workspaceId(value.id)||typeof value.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.createdAt)||value.createdAt.startsWith('0000-'))return false;
 const parsed=new Date(value.createdAt+'Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===value.createdAt.slice(0,19);
}
function selectedChoice(state,message){
 const selection=message?.type==='interactive'?(message.interactive?.type==='list_reply'?message.interactive.list_reply?.id:message.interactive?.type==='button_reply'?message.interactive.button_reply?.id:null):null;
 const match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(selection||'');
 return match&&match[1]===state?.nonce&&Array.isArray(state?.choices)?state.choices[Number(match[2])]?.value:null;
}
const cursor=row=>({id:row.id,createdAt:row.createdAt});
const publicTask=row=>{const {id,title,progress,revision}=row,measurement=publicTaskMeasurement(row);return {id,title,progress,revision,status:row.status??null,startsOn:row.startsOn??null,endsOn:row.endsOn??null,...(measurement?{measurement}:{})};};

// Identity, live permissions and conversation TTL are checked by the signed
// bridge before this bounded catalog read. A cursor never grants project access.
export async function readMetaFieldTaskCatalog(client,{projectId,state,message}){
 if(!workspaceId(projectId))unavailable();
 const choice=selectedChoice(state,message),purpose=state?.step==='MENU'?choice||state.purpose:state?.purpose,size=optionalPurposes.has(purpose)?7:8,taskState=state?.step==='TASK',page=taskState?state.taskPage:null;
 let anchor=null,direction='FIRST';
 if(page){
  if(typeof page.hasPrevious!=='boolean'||typeof page.hasNext!=='boolean')unavailable();
  const empty=page.first===null&&page.last===null&&!page.hasPrevious&&!page.hasNext;
  if(!empty&&(!validCursor(page.first)||!validCursor(page.last)))unavailable();
  if(!empty){
   const owned=(await client.query(`SELECT id,to_char("createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt" FROM public."Task" WHERE "projectId"=$1 AND id=ANY($2::text[])`,[projectId,[page.first.id,page.last.id]])).rows;
   if(![page.first,page.last].every(value=>owned.some(row=>row.id===value.id&&row.createdAt===value.createdAt)))unavailable();
   direction=choice==='NEXT_TASKS'?'AFTER':choice==='PREVIOUS_TASKS'?'BEFORE':'INCLUSIVE';
   anchor=direction==='AFTER'?page.last:page.first;
  }
 }
 const predicate=direction==='FIRST'?'':` AND ("createdAt",id) ${direction==='AFTER'?'>':direction==='BEFORE'?'<':'>='} ($2::timestamp,$3::text)`;
 const parameters=anchor?[projectId,anchor.createdAt,anchor.id,size+1]:[projectId,size+1],limit=anchor?'$4':'$2';
 const found=(await client.query(`SELECT ${taskColumns} FROM public."Task" WHERE "projectId"=$1${predicate} ORDER BY "createdAt" ${direction==='BEFORE'?'DESC':'ASC'},id ${direction==='BEFORE'?'DESC':'ASC'} LIMIT ${limit}`,parameters)).rows;
 const rows=found.slice(0,size);if(direction==='BEFORE')rows.reverse();
 let taskPage={first:null,last:null,hasPrevious:false,hasNext:false};
 if(rows.length){
  const first=cursor(rows[0]),last=cursor(rows.at(-1)),bounds=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."Task" WHERE "projectId"=$1 AND ("createdAt",id)<($2::timestamp,$3::text)) AS "hasPrevious",EXISTS(SELECT 1 FROM public."Task" WHERE "projectId"=$1 AND ("createdAt",id)>($4::timestamp,$5::text)) AS "hasNext"`,[projectId,first.createdAt,first.id,last.createdAt,last.id])).rows[0];
  taskPage={first,last,hasPrevious:bounds.hasPrevious,hasNext:bounds.hasNext};
 }
 const tasks=rows.map(publicTask);
 const selected=taskState?choice:null,selectedIds=[state?.taskId,...(selected&&!['NONE','NEXT_TASKS','PREVIOUS_TASKS'].includes(selected)?[selected]:[])].filter(value=>value!==undefined&&value!==null);
 for(const selectedId of new Set(selectedIds)){
  if(!workspaceId(selectedId))unavailable();
  if(!tasks.some(task=>task.id===selectedId)){
   const current=(await client.query(`SELECT ${taskColumns} FROM public."Task" WHERE "projectId"=$1 AND id=$2`,[projectId,selectedId])).rows[0];
   if(current)tasks.push(publicTask(current));
  }
 }
 return {tasks,taskPage};
}

// Internal signed-bridge catalog, called only after live identity, binding, TTL,
// report permission and canonical task reads. IDs are row references, not grants.
// Web review pagination and the general 100-row activity feed keep their contracts.
export async function readMetaFieldEvidenceCatalog(client,{organizationId,projectId,workerId,actorId,state,message,tasks}){
 const unavailable=()=>{throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);};
 if([organizationId,projectId,workerId,actorId,state?.taskId].some(value=>!workspaceId(value))||!tasks?.some(task=>task.id===state.taskId)||state.evidenceIds!==undefined&&!Array.isArray(state.evidenceIds))unavailable();
 const choice=selectedChoice(state,message),voice=state.step==='VOICE_EVIDENCE'||state.step==='PROGRESS_SOURCE'&&choice==='VOICE',size=voice?7:8;
 const paging=['VOICE_EVIDENCE','PROGRESS_EVIDENCE'].includes(state.step),page=paging?state.evidencePage:null;
 const field=`i.metadata->'fieldOperations'`,from=`public."Incident" i JOIN public."Project" p ON p.id=i."projectId" JOIN public."Task" t ON t."projectId"=i."projectId" AND t.id=$2`;
 const visible=`i."projectId"=$1 AND p."organizationId"=$5 AND ${field}->>'version'='1' AND ${field}->>'kind'='EVIDENCE' AND ${field}->>'taskId'=$2 AND ${field}->>'workerId'=$3 AND ${field}->>'recordedBy'=$4`;
 const approved=visible+` AND ${field}->'review'->>'decision'='APPROVE'`,values=[projectId,state.taskId,workerId,actorId,organizationId];
 let anchor=null,direction='FIRST';
 if(page){
  if(typeof page.hasPrevious!=='boolean'||typeof page.hasNext!=='boolean'||(page.first===null)!==(page.last===null)||page.first===null&&(page.hasPrevious||page.hasNext)||page.first!==null&&(!workspaceId(page.first)||!workspaceId(page.last)))unavailable();
  if(page.first!==null){
   // An anchor still belongs to the same task/author/tenant if its review changed.
   const anchors=(await client.query(`SELECT i.id FROM ${from} WHERE ${visible} AND i.id=ANY($6::text[])`,[...values,[page.first,page.last]])).rows;
   if(![page.first,page.last].every(id=>anchors.some(row=>row.id===id)))unavailable();
   direction=choice==='NEXT_EVIDENCE'?'AFTER':choice==='PREVIOUS_EVIDENCE'?'BEFORE':'INCLUSIVE';anchor=direction==='AFTER'?page.last:page.first;
  }
 }
 const reference=`(SELECT "createdAt",id FROM public."Incident" WHERE "projectId"=$1 AND id=$6)`;
 const predicate=anchor?` AND (i."createdAt",i.id) ${direction==='AFTER'?'<':direction==='BEFORE'?'>':'<='} ${reference}`:'';
 const columns=`i.id,i.title,i.description,i.metadata,clock_timestamp() AS "readAt",to_char(i."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
 const found=(await client.query(`SELECT ${columns} FROM ${from} WHERE ${approved}${predicate} ORDER BY i."createdAt" ${direction==='BEFORE'?'ASC':'DESC'},i.id ${direction==='BEFORE'?'ASC':'DESC'} LIMIT ${size+1}`,anchor?[...values,anchor]:values)).rows;
 const rows=found.slice(0,size);if(direction==='BEFORE')rows.reverse();
 let evidencePage={first:null,last:null,hasPrevious:false,hasNext:false};
 const first=rows[0]?.id||anchor,last=rows.at(-1)?.id||anchor;
 if(first){
  const bounds=(await client.query(`SELECT EXISTS(SELECT 1 FROM ${from} WHERE ${approved} AND (i."createdAt",i.id)>(SELECT "createdAt",id FROM public."Incident" WHERE "projectId"=$1 AND id=$6)) AS "hasPrevious",EXISTS(SELECT 1 FROM ${from} WHERE ${approved} AND (i."createdAt",i.id)<(SELECT "createdAt",id FROM public."Incident" WHERE "projectId"=$1 AND id=$7)) AS "hasNext"`,[...values,first,last])).rows[0];
  evidencePage={first,last,hasPrevious:bounds.hasPrevious,hasNext:bounds.hasNext};
 }
 const pagedEvidence=rows.map(publicFieldEvidence),evidence=pagedEvidence.slice();
 // Re-read selections and retained voice/progress links independently of the
 // page. SHARE locks keep that attribution/review current through final command
 // persistence in this transaction; the canonical save and commit fence still run.
 const selected=paging&&choice&&!['NEXT_EVIDENCE','PREVIOUS_EVIDENCE','RECHECK_EVIDENCE','CANCEL','MANUAL'].includes(choice)?[choice]:[];
 const retained=[...(state.evidenceIds||[]),state.sourceVoice?.evidenceId,state.voiceCandidate?.evidenceId,...selected].filter(value=>value!==undefined&&value!==null);
 if(retained.length>12||retained.some(value=>!workspaceId(value)))unavailable();
 for(const id of new Set(retained)){
  const row=(await client.query(`SELECT ${columns} FROM ${from} WHERE ${approved} AND i.id=$6 FOR SHARE OF i`,[...values,id])).rows[0];
  const index=evidence.findIndex(value=>value.id===id);if(index!==-1)evidence.splice(index,1);
  if(row)evidence.push(publicFieldEvidence(row));
 }
 return {evidence,pagedEvidence,evidencePage};
}
