import {WorkspaceError,digest} from './workspace-policy.mjs';
import {createFieldOperations,publicFieldEvidence} from './field-operations-store.mjs';
import {createFieldMedia,decodeFieldMedia} from './field-media.mjs';
import {planMetaFieldConversation,META_FIELD_MEDIA_AUTHORIZATION_VERSION,validMetaFieldMediaReferenceContext,metaFieldMediaAuthorizationValid} from './meta-field-conversation.mjs';
import {resolveWorkerChannelIdentity,decodeWorkerChannelProof} from './worker-channel-identity.mjs';
import {META_CUSTOMER_PROTOCOL,resolveMetaCloudProtocol} from './meta-cloud-protocol.mjs';
import {decryptCustomerSecret,encryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';
import {validFieldMediaAnalysisConsent,FIELD_VIDEO_PRIVACY_NOTICE_VERSION,fieldVideoAudioAnalysisAllowed} from './field-media-privacy.mjs';
import {voiceTranscriptForEvidence} from './voice-progress-draft.mjs';
import {assertDevelopmentPilotCommit,assertDevelopmentPilotAdapter} from './meta-development-pilot-policy.mjs';
import {siteText} from './site-register-policy.mjs';

export function metaFieldOperationId(eventId,purpose){const h=digest(['meta-field-operation-v1',eventId,purpose]);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
const receiptId=eventId=>'meta_field_'+digest(['meta-field-dispatch-v1',eventId]);
const permissionFor=action=>action==='ATTENDANCE'?'attendance':'report';
const safeErrors=new Set(['INVENTORY_QUANTITY_INVALID','INVENTORY_CATALOG_CHANGED','INVENTORY_MATERIAL_UNAVAILABLE','SITE_INPUT_INVALID','SITE_QUANTITY_INVALID','FIELD_QUANTITY_INVALID','FIELD_QUANTITY_PROGRESS_MISMATCH','FIELD_PROGRESS_REGRESSION','FIELD_PROGRESS_REVIEW_PENDING','FIELD_BASELINE_CHANGED','FIELD_REVISION_CHANGED','WORKSPACE_TASK_UNAVAILABLE','FIELD_SECTOR_UNAVAILABLE','ATTENDANCE_REVISION_CHANGED','ATTENDANCE_PERSON_JOURNEY_OPEN','ATTENDANCE_SHIFT_ALREADY_OPEN','ATTENDANCE_SHIFT_NOT_OPEN','ATTENDANCE_BREAK_ALREADY_OPEN','ATTENDANCE_BREAK_NOT_OPEN','ATTENDANCE_BREAK_OPEN','ATTENDANCE_LOCATION_STALE','ATTENDANCE_LOCATION_INVALID','FIELD_EVIDENCE_NOT_APPROVED']);
const explanation=code=>({ATTENDANCE_PERSON_JOURNEY_OPEN:'Tenés una jornada pendiente de cierre. Contactá al responsable.',ATTENDANCE_SHIFT_ALREADY_OPEN:'Ya tenés una jornada abierta.',ATTENDANCE_SHIFT_NOT_OPEN:'Primero registrá una entrada.',ATTENDANCE_BREAK_ALREADY_OPEN:'Tu pausa ya está abierta.',ATTENDANCE_BREAK_NOT_OPEN:'No hay una pausa abierta.',ATTENDANCE_BREAK_OPEN:'Cerrá la pausa antes de registrar la salida.',ATTENDANCE_LOCATION_STALE:'La ubicación venció. Volvé a empezar y compartí una ubicación actual.',FIELD_PROGRESS_REVIEW_PENDING:'Esta tarea ya tiene una propuesta pendiente.',FIELD_EVIDENCE_NOT_APPROVED:'La evidencia requiere revisión del responsable.',FIELD_PROGRESS_REGRESSION:'El avance propuesto no puede ser menor al ya aprobado.'}[code]||'Revisá los datos y el estado actual de la obra antes de volver a intentar.');
const text=body=>({type:'text',body});
export const metaFieldMediaContextDigest=r=>digest(['meta-field-media-context-v2',r.member.organizationId,r.member.actorId,r.member.membershipId,r.member.clerkUserId,r.project.id,r.worker.id,r.channelBinding.id,r.connection.id,r.connection.projectId,r.connection.phoneNumberId,r.connection.whatsappBusinessId,r.sourceProjectId||r.event.projectId,r.companyProjection?{projectId:r.companyProjection.projectId,workerId:r.companyProjection.workerId,actorId:r.companyProjection.actorId,membershipId:r.companyProjection.membershipId,assignmentRevision:r.companyProjection.assignmentRevision,bindingId:r.companyProjection.bindingId,routeId:r.companyProjection.routeId,routeEpoch:r.companyProjection.routeEpoch}:null]);
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

// Transport adapter, not a second field engine. The internal resolver supplies
// the canonical actor after checking signed proof, binding, KYC and assignment.
// It never creates a Clerk session or weakens the web authentication verifier.
export function createMetaFieldBridge({connect,environment=process.env,resolveIdentity=resolveWorkerChannelIdentity,provider,put,get,analyzer,protocol=META_CUSTOMER_PROTOCOL,attendanceOnly=false}){
 resolveMetaCloudProtocol(protocol);
 const within=run=>customerJobTransaction(connect,run);
 const seal=(r,purpose,resourceId,value)=>encryptCustomerSecret(JSON.stringify(value),{organizationId:r.member.organizationId,projectId:r.project.id,purpose,resourceId},environment);
 function unseal(r,purpose,resourceId,value){try{return JSON.parse(decryptCustomerSecret(value,{organizationId:r.member.organizationId,projectId:r.project.id,purpose,resourceId},environment));}catch{throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);}}
 const conversation=r=>readMetaFieldConversation(r,environment);
 function conversationEnvelope(r,state){if(!state)return null;const value={...state,version:1,lastEventId:r.event.id,lastMessageTimestamp:r.proof.value.timestamp,lastReceivedAt:new Date(r.event.createdAt).toISOString(),expiresAt:new Date(r.now.getTime()+15*60000).toISOString(),bindingId:r.channelBinding.id};return {version:1,lastEventId:value.lastEventId,lastMessageTimestamp:value.lastMessageTimestamp,lastReceivedAt:value.lastReceivedAt,expiresAt:value.expiresAt,bindingId:value.bindingId,encryptedState:seal(r,'field-conversation',r.worker.id,value)};}
 async function resolve(client,context,permission=null){
  const r=await resolveIdentity(client,{eventId:context.eventId,permission,claimChallenge:true,environment});
  const {event,project,connection}=r,now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  const expiresAt=new Date(event.leaseExpiresAt).getTime();
  if(event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(expiresAt)||expiresAt<=now.getTime()||(r.sourceProjectId||project.id)!==context.projectId||connection.id!==context.channelId||event.payload.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  return {...r,now,scope:digest(['meta-field-v1',event.id,event.payload.payloadDigest,r.worker.id,connection.id])};
 }
 async function commitFence(client,r){
  await assertDevelopmentPilotCommit(client,r.connection,environment);
  if(r.companyProjection&&(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.event.leaseToken])).rows.length!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
 }
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
   await commitFence(client,r);
   const value=await callback(client,member,r.scope,r.project);
   await commitFence(client,r);
   return value;
  }};
  return {session,service:createFieldOperations({workspace})};
 }
 async function saved(client,r){const row=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.field.dispatched'`,[receiptId(r.event.id),r.member.organizationId,r.member.actorId,r.worker.id])).rows[0];if(!row)return null;if(row.metadata?.payloadDigest!==r.event.payload.payloadDigest||row.metadata.channelBindingId!==r.channelBinding.id)throw new WorkspaceError('META_CHANNEL_RECEIPT_INTEGRITY',409);return unseal(r,'field-dispatch',receiptId(r.event.id),row.metadata.encryptedResult);}
 async function record(client,r,result,state,{onlyIfCurrent=false,preserveConversation=false}={}){
  await assertDevelopmentPilotCommit(client,r.connection,environment);
  const current=(await client.query(`SELECT metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id])).rows[0];
  const writesConversation=!preserveConversation&&(!onlyIfCurrent||current.metadata?.fieldChannelConversation?.lastEventId===r.event.id);
  if(writesConversation&&r.companyProjection&&state&&state.purpose!=='MENU'&&result.reply?.type==='text'){
   const instruction='\nPara continuar, mantené presionado este mensaje, elegí Responder y enviá el dato, la ubicación o el archivo desde esa respuesta. Para cancelar, respondé a este mismo mensaje con CANCELAR.';
   result={...result,reply:{...result.reply,body:result.reply.body.slice(0,4096-instruction.length)+instruction}};
  }
  if(writesConversation)await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.worker.id,r.project.id,JSON.stringify({...current.metadata,fieldChannelConversation:conversationEnvelope(r,state)})]);
  await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'meta.field.dispatched','Worker',$4,$5::jsonb)`,[receiptId(r.event.id),r.member.organizationId,r.member.actorId,r.worker.id,JSON.stringify({version:1,projectId:r.project.id,channelId:r.connection.id,channelBindingId:r.channelBinding.id,eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,businessApplied:result.businessApplied,kind:result.kind,receiptId:result.receiptId||null,encryptedResult:seal(r,'field-dispatch',receiptId(r.event.id),result)})]);
  if(r.companyProjection||r.connection.metadata?.developmentPilot){const fenced=await client.query(`UPDATE public."WebhookEvent" SET "appliedAt"=CASE WHEN $3::boolean THEN clock_timestamp() ELSE "appliedAt" END WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,[r.event.id,r.event.leaseToken,result.businessApplied===true]);if(fenced.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);}
  await assertDevelopmentPilotCommit(client,r.connection,environment);
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
  return {media,state,token,phoneNumberId:r.connection.phoneNumberId,userId:r.member.clerkUserId,scope:r.scope,workerId:r.worker.id,projectId:r.project.id,corporate:Boolean(r.companyProjection),identityDigest:mediaIdentity(r)};
 }
 async function prepare(client,context){
  const type=(await client.query(`SELECT "eventType" FROM public."WebhookEvent" WHERE id=$1 AND provider=$2`,[context.eventId,protocol.provider])).rows[0];if(type?.eventType!=='message')return null;
  const r=await resolve(client,context),previous=await saved(client,r);if(previous)return {done:previous};
  if(r.kind==='CHANNEL_BOUND')return {done:await record(client,r,result(r,'CHANNEL_BOUND',text('Tu canal quedó vinculado a esta participación. Escribí MENU para continuar cuando el responsable active la conexión de la empresa.')),null)};
  const key='meta_field_media_'+digest(r.event.id),previousMedia=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.field.media.prepared'`,[key,r.member.organizationId,r.member.actorId,r.worker.id])).rows[0];
  // A later conversation must not erase a durable upload already requested by
  // this message. Recovery uses its recorded input and preserves the new draft.
  if(previousMedia){if(previousMedia.metadata.projectId!==r.project.id||previousMedia.metadata.eventId!==r.event.id||previousMedia.metadata.payloadDigest!==r.event.payload.payloadDigest||previousMedia.metadata.channelBindingId!==r.channelBinding.id)throw new WorkspaceError('META_CHANNEL_MEDIA_CONTEXT_CHANGED',409);const input=unseal(r,'field-media-prepared',key,previousMedia.metadata.encryptedInput);return prepareMedia(client,r,input.media,input.state);}
  const state=conversation(r),messageAt=Number(r.proof.value.timestamp)*1000;
  const stale=state&&(Number(r.proof.value.timestamp)<Number(state.lastMessageTimestamp)||Number(r.proof.value.timestamp)===Number(state.lastMessageTimestamp)&&new Date(r.event.createdAt).getTime()<Date.parse(state.lastReceivedAt));
  if(stale||!Number.isSafeInteger(messageAt)||messageAt>r.now.getTime()+60000||r.now.getTime()-messageAt>=86400000)return {done:await record(client,r,result(r,'STALE_CONVERSATION',text('Este mensaje pertenece a un paso anterior. Conservamos el borrador más reciente. Escribí MENU para empezar de nuevo.'),{code:'META_CHANNEL_STALE_MESSAGE'}),state,{onlyIfCurrent:true})};
  const {session,service}=operations(client,r),data=await service.read(session,{projectId:r.project.id,scope:r.scope}),tasks=(await client.query(`SELECT id,title,progress,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Task" WHERE "projectId"=$1 ORDER BY "createdAt",id LIMIT 101`,[r.project.id])).rows;
  const latest=data.attendance.filter(e=>e.workerId===r.worker.id).sort((a,b)=>b.sequence-a.sequence)[0]||null;
  const limited=attendanceOnly||Boolean(r.connection.metadata?.developmentPilot),facts={projectName:r.project.name,workerId:r.worker.id,permissions:limited?{attendance:r.worker.metadata.participant.permissions.attendance,report:false}:r.worker.metadata.participant.permissions,attendanceOnly:limited,tasks,sectors:data.sectors,evidence:data.evidence,proposals:data.proposals,inventory:data.inventory,latest,mediaReferenceContext:{eventId:r.event.id,payloadDigest:r.event.payload.payloadDigest,contextDigest:metaFieldMediaContextDigest(r),sourceProjectId:r.sourceProjectId||r.event.projectId}};
  let plan;
  try{plan=planMetaFieldConversation({message:r.proof.value,state,eventId:r.event.id,facts,now:r.now});}
  catch(error){if(!safeErrors.has(error.code))throw error;return {done:await record(client,r,result(r,'INPUT_REVIEW',text(explanation(error.code)+' Escribí CANCELAR para volver al menú.'),{code:error.code}),state)};}
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
   try{const outcome=await service.save(session,{projectId:r.project.id,scope:r.scope,operationId:metaFieldOperationId(r.event.id,plan.command.action),...plan.command});
    const reply=text(outcome.kind==='ATTENDANCE'?(attendanceOnly?'Fichaje guardado en '+r.project.name+'. ':'Fichaje guardado. ')+(outcome.event.verificationStatus==='REVIEW_REQUIRED'?'Quedó pendiente de revisión humana.':'Podés consultar el recibo en Mi cuenta.'):outcome.kind==='INCIDENT_REPORT'?'Incidencia guardada para seguimiento del responsable.':outcome.kind==='MATERIAL_REQUEST'?'Pedido de material guardado. La compra todavía requiere autorización.':outcome.kind==='CONSUMPTION_PROPOSAL'?'Consumo propuesto para revisión. El stock conserva su saldo hasta que otro responsable autorizado lo apruebe.':'Propuesta de avance guardada. La tarea conservará su avance hasta una decisión autorizada.');
    return {done:await record(client,r,result(r,outcome.kind,reply,{businessApplied:true,receiptId:outcome.receiptId,reviewState:'RECORDED'}),plan.state)};
   }catch(error){if(!safeErrors.has(error.code))throw error;await client.query('ROLLBACK TO SAVEPOINT meta_field_command');return {done:await record(client,r,result(r,'INPUT_REVIEW',text(explanation(error.code)+' Escribí MENU para continuar.'),{code:error.code}),null)};}
  }
  // Corporate status is a canonical ledger read. Its receipt cannot replace
  // the active prompt or discard a draft that still requires explicit cancel.
  return {done:await record(client,r,result(r,'CONVERSATION',plan.reply),plan.state,{preserveConversation:plan.preserveConversation===true||((limited||Boolean(r.companyProjection))&&r.proof.value.type==='text'&&r.proof.value.text?.body?.trim().toUpperCase()==='ESTADO')})};
 }
 return {async execute(context){
  const prepared=await within(client=>prepare(client,context));if(!prepared)return null;if(prepared.done)return prepared.done;
  if(!provider||!put||!get||!analyzer)throw new WorkspaceError('META_CHANNEL_MEDIA_NOT_CONFIGURED',503);
  // No locks span provider I/O. Re-resolve the signed source, assignment,
  // individual KYC and binding immediately before each corporate external call.
  const beforeExternal=async()=>{if(prepared.corporate||prepared.media.sourceOrigin)await within(async client=>{const r=await resolve(client,context,'report');assertPrepared(r,prepared);assertDevelopmentPilotAdapter(r.connection,'media');await requireMediaOrigin(client,r,prepared.media,prepared.state);await commitFence(client,r);});};
  const external=fn=>async(...args)=>{await beforeExternal();return fn(...args);};
  let media;
  try{await beforeExternal();const downloaded=await provider.downloadMedia({token:prepared.token,phoneNumberId:prepared.phoneNumberId,mediaId:prepared.media.mediaId,limit:prepared.media.kind==='image'?2*1024*1024:3*1024*1024,...(prepared.corporate||prepared.media.sourceOrigin?{beforeExternal}:{})});
   media=decodeFieldMedia(downloaded.bytes,downloaded.contentType);if(downloaded.contentType.split(';')[0].trim()!==String(prepared.media.contentType).split(';')[0].trim()||media.kind!==prepared.media.kind)throw new WorkspaceError('META_CHANNEL_MEDIA_INTEGRITY',409);
   }catch(error){if(recoverableMediaContext(error))return closeMediaContext(context,prepared,error);if(!['META_CUSTOMER_MEDIA_INVALID','META_CUSTOMER_MEDIA_REJECTED','META_CUSTOMER_MEDIA_INTEGRITY','META_CHANNEL_MEDIA_INTEGRITY','FIELD_MEDIA_INVALID','FIELD_MEDIA_TOO_LARGE'].includes(error.code))throw error;
   return within(async client=>{const r=await resolve(client,context,'report'),prior=await saved(client,r);if(prior)return prior;return record(client,r,result(r,'MEDIA_REVIEW_REQUIRED',text('No pudimos guardar este archivo con su tamaño o formato actual. Prepará una foto de hasta 2 MiB o audio/video de hasta 3 MiB desde la web, o enviá otro archivo. Tu tarea conserva su avance.'),{code:error.code}),prepared.state,{onlyIfCurrent:true});});
  }
   const session={userId:prepared.userId},workspace={projectOperation:async(s,input,writable,callback)=>within(async client=>{const r=await resolve(client,context,'report');assertPrepared(r,prepared);if(s!==session||s.userId!==r.member.clerkUserId||input.projectId!==r.project.id||input.scope!==r.scope||prepared.workerId!==r.worker.id)throw new WorkspaceError('META_CHANNEL_CONTEXT_CHANGED',409);await requireMediaOrigin(client,r,prepared.media,prepared.state);await commitFence(client,r);const value=await callback(client,{...r.member,role:'AUDITOR',channelProof:{provider:protocol.provider,eventId:r.event.id,channelId:r.connection.id,payloadDigest:r.event.payload.payloadDigest,bindingId:r.channelBinding.id}},r.scope,r.project);await commitFence(client,r);return value;})};
  const guardedAnalyzer=Object.fromEntries(['analyzePhoto','analyzeVideo','transcribeAudio'].map(name=>[name,external((...args)=>analyzer[name](...args))]));
  const fieldOps=createFieldOperations({workspace}),service=createFieldMedia({operations:fieldOps,put:external(put),get:external(get),analyzer:guardedAnalyzer,environment:()=>environment});
  const base={projectId:prepared.projectId,scope:prepared.scope};let attached;
  try{attached=await service.attach(session,{...base,operationId:metaFieldOperationId(context.eventId,'MEDIA_ATTACH'),workerId:prepared.workerId,taskId:prepared.media.taskId,sectorId:prepared.media.sectorId,caption:prepared.media.caption,media});}
   catch(error){if(!recoverableMediaContext(error))throw error;return closeMediaContext(context,prepared,error);}
  let processed=attached;
  const consent=prepared.media.analysisConsent,analysisAllowed=validFieldMediaAnalysisConsent(consent)&&consent.allowed===true;
  if(analysisAllowed)try{processed=await service.process(session,{...base,operationId:metaFieldOperationId(context.eventId,'MEDIA_PROCESS'),evidenceId:attached.evidence.id,revision:attached.evidence.revision,analysisConsent:consent});}
  catch(error){if(!['FIELD_ALREADY_REVIEWED','FIELD_MEDIA_ALREADY_PROCESSED'].includes(error.code))throw error;processed={...attached,evidence:publicFieldEvidence(await workspace.projectOperation(session,base,false,client=>fieldOps.readEvidence(client,prepared.projectId,attached.evidence.id)))};}
  return within(async client=>{const r=await resolve(client,context,'report'),prior=await saved(client,r);if(prior)return prior;
   return record(client,r,result(r,'EVIDENCE',text('Evidencia guardada en privado. '+(processed.evidence.review?'El archivo ya tiene una revisión humana registrada; consultala desde la web.':!analysisAllowed?'No se envió a OpenAI. El responsable puede revisarlo manualmente desde la web.':media.kind==='video'&&consent.noticeVersion===FIELD_VIDEO_PRIVACY_NOTICE_VERSION?metaFieldVideoResultText(processed.evidence,consent):processed.evidence.processing.status==='FAILED_RETRYABLE'?'El procesamiento necesita otro intento desde la web.':media.kind==='video'?'Se analizaron cuatro cuadros sin audio. El responsable debe revisar el video original antes de aprobar avances.':media.kind==='audio'&&processed.evidence.processing.result?.progressDraft?'Se preparó un borrador desde la transcripción. Otra persona debe revisar y aprobar el audio en la web. Después, escribí AVANCE para revisar el borrador y completar la medición acumulada.':'El responsable debe revisar el archivo antes de aprobar avances.')+' Escribí MENU para continuar.'),{businessApplied:true,receiptId:attached.receiptId,reviewState:'RECORDED'}),null,{onlyIfCurrent:true});});
 }};
}
