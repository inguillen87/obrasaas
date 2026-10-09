import {createHmac} from 'node:crypto';
import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {companyChannelSchemaReady,COMPANY_CHANNEL_SCHEMA_CONTRACT} from './company-channel-schema.mjs';
import {decodeWorkerChannelProof,workerChannelCodeDigest,lockParticipantMember,approvedParticipant,signedBinding,assignment,assertWorkerCustomerConnection,resolveWorkerChannelIdentity} from './worker-channel-identity.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerJobTransaction,customerOutboundId} from './meta-customer-outbound.mjs';
import {metaFieldConversationAction,META_FIELD_MEDIA_AUTHORIZATION_VERSION} from './meta-field-conversation.mjs';
import {createMetaFieldBridge,readMetaFieldConversation,validateMetaFieldMediaOrigin} from './meta-field-bridge.mjs';
import {validFieldMediaAnalysisConsent} from './field-media-privacy.mjs';
import {siteText} from './site-register-policy.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';

const fault=(code,status=403)=>{throw new WorkspaceError(code,status);};
const text=body=>({type:'text',body});
const result=(kind,reply,extra={})=>({kind,identityStatus:'CHANNEL_VERIFIED',reviewState:'OBSERVED',businessApplied:false,replySent:false,reply,...extra});
function senderKey(connection,phone,environment){const key=environment.META_CUSTOMER_CREDENTIALS_KEY||environment.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;if(!/^[A-Za-z0-9+/]{43}=$/.test(key||''))fault('META_CUSTOMER_VAULT_UNAVAILABLE',503);return createHmac('sha256',Buffer.from(key,'base64')).update(JSON.stringify(['company-sender-v1',connection.organizationId,connection.id,phone])).digest('hex');}
const cryptContext=(r,purpose,id)=>({organizationId:r.member.organizationId,projectId:r.connection.projectId,purpose,resourceId:id});
const seal=(r,purpose,id,value,env)=>encryptCustomerSecret(JSON.stringify(value),cryptContext(r,purpose,id),env);
const unseal=(r,purpose,id,value,env)=>JSON.parse(decryptCustomerSecret(value,cryptContext(r,purpose,id),env));
function sourceLease(event,context,now){if(event.status!=='PENDING'||event.projectId!==context.projectId||event.payload.channelId!==context.channelId||event.payload.payloadDigest!==context.payloadDigest||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime())fault('META_CUSTOMER_INBOX_LEASE_CHANGED',409);}

// Proof of an existing media reservation only. Disabled memberships/assignments
// cannot grant access here: an explicit retry re-enters the normal resolver.
// In particular neither the current selector nor a corporate phone picks B.
export async function companyPreparedMediaRecovery(client,context,{environment=process.env}={}){
 try{
  const event=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,[context.eventId,context.projectId])).rows[0];
  if(!event||event.eventType!=='message'||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||event.payload?.channelId!==context.channelId||event.payload?.payloadDigest!==context.payloadDigest)return false;
  const connection=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3`,[context.channelId,context.projectId,event.payload.organizationId])).rows[0];
  if(!connection||connection.metadata?.developmentPilot)return false;
  const proof=decodeWorkerChannelProof(event,connection,environment),asset=proof.value?.[proof.value?.type];
  if(proof.companyRouting?.mode!=='COMPANY'||proof.companyRouting.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT||!(['image','audio','video'].includes(proof.value.type)&&/^\d{5,32}$/.test(asset?.id||'')&&typeof asset.mime_type==='string'||proof.value.type==='interactive')||typeof proof.value.context?.id!=='string'||!await companyChannelSchemaReady(client))return false;
  const owner=(await client.query(`SELECT "anchorProjectId" FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2`,[connection.id,connection.organizationId])).rows[0];
  const projection=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[event.id])).rows[0];
  if(owner?.anchorProjectId!==connection.projectId||projection?.kind!=='FIELD'||projection.sourceEventId!==event.id||projection.payloadDigest!==context.payloadDigest||projection.connectionId!==connection.id||projection.organizationId!==connection.organizationId||!workspaceId(projection.routeId)||!Number.isInteger(projection.routeEpoch)||projection.routeEpoch<1||!Number.isInteger(projection.assignmentRevision)||projection.assignmentRevision<1)return false;
  const worker=(await client.query(`SELECT w.*,u.id AS "actorId",u."clerkUserId",tm.id AS "membershipId",tm."organizationId"
   FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" JOIN public."PlatformUser" u ON u."clerkUserId"=w.metadata->'participant'->>'clerkUserId'
   JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=p."organizationId"
   JOIN public."ProjectMembership" pm ON pm."projectId"=p.id AND pm."tenantMembershipId"=tm.id
   JOIN public."WhatsAppChannelProjectAssignment" a ON a."projectId"=p.id AND a."organizationId"=p."organizationId" AND a."connectionId"=$5
   WHERE w.id=$1 AND w."projectId"=$2 AND tm.id=$3 AND u.id=$4 AND p."organizationId"=$6`,[projection.workerId,projection.projectId,projection.membershipId,projection.actorId,connection.id,connection.organizationId])).rows[0];
  if(!worker||worker.organizationId!==projection.organizationId||worker.phone!==proof.senderE164)return false;
  const member={actorId:worker.actorId,membershipId:worker.membershipId,organizationId:worker.organizationId,clerkUserId:worker.clerkUserId};
  const binding=await signedBinding(client,worker,member,connection,environment);
  if(binding.id!==projection.bindingId)return false;
  const key='meta_field_media_'+digest(event.id),prepared=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND "entityType"='Worker' AND action='meta.field.media.prepared'`,[key,member.organizationId,member.actorId,worker.id])).rows[0]?.metadata;
  if(prepared?.version!==1||prepared.projectId!==projection.projectId||prepared.eventId!==event.id||prepared.payloadDigest!==context.payloadDigest||prepared.channelBindingId!==projection.bindingId)return false;
  const {media,state}=JSON.parse(decryptCustomerSecret(prepared.encryptedInput,{organizationId:member.organizationId,projectId:projection.projectId,purpose:'field-media-prepared',resourceId:key},environment));
  if(state?.version!==1||state.purpose!=='MEDIA'||state.bindingId!==binding.id||!workspaceId(state.taskId)||!workspaceId(state.sectorId)||!workspaceId(state.analysisConsentEventId)||!validFieldMediaAnalysisConsent(state.analysisConsent)||media?.taskId!==state.taskId||media.sectorId!==state.sectorId||media.analysisConsentEventId!==state.analysisConsentEventId||!validFieldMediaAnalysisConsent(media.analysisConsent)||digest(media.analysisConsent)!==digest(state.analysisConsent))return false;
  if(state.mediaAuthorizationVersion===META_FIELD_MEDIA_AUTHORIZATION_VERSION){
   const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
   const r={member,project:{id:projection.projectId},worker,connection,event,proof,sourceProjectId:event.projectId,companyProjection:projection,channelBinding:binding,now};
   if(proof.value.type!=='interactive'||!await validateMetaFieldMediaOrigin(client,r,media,state,{environment,now}))return false;
  }else if(state.mediaAuthorizationVersion!==undefined||state.step!=='MEDIA'||media.kind!==proof.value.type||media.mediaId!==asset?.id||media.contentType!==asset?.mime_type||media.caption!==siteText(asset?.caption||'Evidencia enviada desde el canal verificado.',1000,1,true)||media.sourceOrigin!==undefined)return false;
  const prompt=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[state.lastEventId])).rows[0];
  if(prompt?.kind!=='FIELD'||prompt.organizationId!==projection.organizationId||prompt.connectionId!==projection.connectionId||['routeId','routeEpoch','projectId','workerId','actorId','membershipId','assignmentRevision','bindingId'].some(key=>prompt[key]!==projection[key]))return false;
  const outbound=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[customerOutboundId(state.lastEventId),connection.projectId])).rows[0];
  if(!['SENT','STATUS_OBSERVED'].includes(outbound?.outcome?.state)||['failed','deleted'].includes(outbound.outcome.providerStatus)||outbound.outcome.messageId!==proof.value.context.id)return false;
  const request=JSON.parse(decryptCustomerSecret(outbound.payload.encryptedPayload,{organizationId:member.organizationId,projectId:connection.projectId,purpose:'outbound',resourceId:outbound.id},environment));
  return digest(request)===outbound.payload.requestDigest&&request.eventId===state.lastEventId&&request.payloadDigest===prompt.payloadDigest&&request.organizationId===member.organizationId&&request.channelId===connection.id&&request.targetProjectId===projection.projectId&&request.sourceRouteId===state.lastEventId&&request.to===proof.value.from;
 }catch(error){if(error instanceof WorkspaceError||error instanceof SyntaxError||error instanceof TypeError)return false;throw error;}
}

// The web administrator may request recovery of this original B event only.
// READ ONLY observations take no locks. The command invokes lock:true through
// integrationProject.beforeProject, then the processor checks authority again.
export async function companyPreparedMediaRecoveryAuthorized(client,admin,{eventId,projectId,environment=process.env,lock=false}={}){
 if(admin?.role!=='ADMIN'||!workspaceId(admin.organizationId)||!workspaceId(projectId)||typeof lock!=='boolean')return false;
 const event=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND provider='meta-customer-v1'`,[eventId])).rows[0],clock=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(!event||event.status!=='PENDING'||event.lastError!=='META_CUSTOMER_PREPARED_MEDIA_AUTHORIZATION_REQUIRED'||event.payload?.organizationId!==admin.organizationId||event.leaseToken&&(!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)>clock.getTime()))return false;
 const projection=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[event.id])).rows[0];
 if(projection?.kind!=='FIELD'||projection.organizationId!==admin.organizationId||projection.projectId!==projectId||!await companyPreparedMediaRecovery(client,{eventId:event.id,projectId:event.projectId,channelId:event.payload.channelId,payloadDigest:event.payload.payloadDigest,leaseToken:event.leaseToken},{environment}))return false;
 const outbound=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[customerOutboundId(event.id),event.projectId])).rows[0];
 if(outbound){
  if(!['SENT','STATUS_OBSERVED','REJECTED'].includes(outbound.outcome?.state))return false;
  try{const sent=JSON.parse(decryptCustomerSecret(outbound.payload.encryptedPayload,{organizationId:admin.organizationId,projectId:event.projectId,purpose:'outbound',resourceId:outbound.id},environment));if(digest(sent)!==outbound.payload.requestDigest||sent.eventId!==event.id||sent.payloadDigest!==event.payload.payloadDigest||sent.organizationId!==admin.organizationId||sent.channelId!==projection.connectionId||sent.targetProjectId!==projectId||sent.sourceRouteId!==event.id)return false;}catch{return false;}
 }
 try{
  if(lock){const resolved=await resolveWorkerChannelIdentity(client,{eventId,permission:'report',companyRouting:true,environment});return resolved.companyProjection?.projectId===projectId&&resolved.member.organizationId===admin.organizationId;}
  const worker=(await client.query(`SELECT *,metadata->'participant'->>'clerkUserId' AS "clerkUserId" FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[projection.workerId,projectId])).rows[0];if(!worker)return false;
  const member=await lockParticipantMember(client,{actorId:projection.actorId,membershipId:projection.membershipId,organizationId:projection.organizationId,clerkUserId:worker.clerkUserId},false);
  const project=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE'`,[projectId,admin.organizationId])).rows[0];if(!project)return false;
  await assignment(client,member,projectId,false);await approvedParticipant(client,worker,member,{permission:'report'});
  const connection=await companyConnectionForProject(client,admin.organizationId,projectId,false);
  if(connection?.id!==projection.connectionId||connection.company.mode!=='COMPANY'||connection.company.assignmentRevision!==projection.assignmentRevision)return false;
  assertWorkerCustomerConnection(connection,admin.organizationId,projectId,clock.getTime(),{operational:true,environment});
  return (await signedBinding(client,worker,member,connection,environment)).id===projection.bindingId;
 }catch(error){if(error instanceof WorkspaceError)return false;throw error;}
}

// Identity is discovered from account-owned, independently bound Workers. A
// corporate phone never identifies the author. No second inbound event exists.
export async function resolveCompanyEnvelope(client,{eventId,environment=process.env,context=null}){
 const initial=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1`,[eventId])).rows[0];if(!initial||initial.provider!=='meta-customer-v1'||initial.eventType!=='message')return null;
 const raw=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3`,[initial.payload?.channelId,initial.projectId,initial.payload?.organizationId])).rows[0];if(!raw)fault('WORKER_CHANNEL_SIGNED_PROOF_REQUIRED');
 const proof0=decodeWorkerChannelProof(initial,raw,environment),code=workerChannelCodeDigest(proof0.value.type==='text'?proof0.value.text?.body:null),ready=await companyChannelSchemaReady(client);
 if(!ready){if(proof0.companyRouting||raw.metadata?.companyRoutingVersion===1)fault('COMPANY_CHANNEL_CATALOG_REQUIRED',409);return null;}
 const owner0=(await client.query(`SELECT * FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 AND "anchorProjectId"=$3`,[raw.id,raw.organizationId,raw.projectId])).rows[0];
 const prior0=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[eventId])).rows[0];
 if(!proof0.companyRouting&&!prior0&&!(code&&owner0?.mode==='PREPARED'))return null;
 if(!owner0||!['PREPARED','COMPANY'].includes(owner0.mode))fault('COMPANY_CHANNEL_SUSPENDED');
 if(proof0.companyRouting&&(proof0.companyRouting.mode!=='COMPANY'||proof0.companyRouting.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT))fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 const found=(await client.query(`SELECT w.*,u.id AS "actorId",u."clerkUserId",tm.id AS "membershipId",tm."organizationId",a.revision AS "assignmentRevision",p.name AS "projectName"
  FROM public."WhatsAppChannelProjectAssignment" a JOIN public."Project" p ON p.id=a."projectId" AND p."organizationId"=a."organizationId"
  JOIN public."Worker" w ON w."projectId"=p.id JOIN public."PlatformUser" u ON u."clerkUserId"=w.metadata->'participant'->>'clerkUserId'
  JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=p."organizationId"
  WHERE a."connectionId"=$1 AND a."organizationId"=$2 AND a.status='ACTIVE' AND p.status='ACTIVE' AND w.active=true AND w.phone=$3
   AND (${code?"w.metadata->'participant'->'channelIdentity'->'challenge'->>'codeDigest'=$4":"w.metadata->'participant'->'channelIdentity'->'binding'->>'status'='VERIFIED' AND w.metadata->'participant'->'channelIdentity'->'binding'->>'connectionId'=$1"}) ORDER BY w."projectId",w.id LIMIT 101`,code?[raw.id,raw.organizationId,proof0.senderE164,code]:[raw.id,raw.organizationId,proof0.senderE164])).rows;
 const candidates=prior0?.kind==='FIELD'||prior0?.kind==='BINDING'?found.filter(w=>w.id===prior0.workerId&&w.actorId===prior0.actorId&&w.membershipId===prior0.membershipId):found;
 if(candidates.length===0||candidates.length>100||new Set(candidates.map(w=>w.actorId)).size!==1||new Set(candidates.map(w=>w.membershipId)).size!==1||code&&candidates.length!==1)fault(code?'WORKER_CHANNEL_CHALLENGE_REJECTED':'WORKER_CHANNEL_BINDING_REQUIRED',code?409:403);
 const member=await lockParticipantMember(client,candidates[0]);await lockPersonWorksiteJourney(client,member);
 const projects=new Map();for(const id of [...new Set([raw.projectId,...candidates.map(w=>w.projectId)])].sort()){const p=(await client.query(`SELECT id,name,"organizationId",status::text AS status,metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE`,[id,member.organizationId])).rows[0];if(!p||id!==raw.projectId&&p.status!=='ACTIVE')fault('COMPANY_CHANNEL_CONTEXT_CHANGED',409);projects.set(id,p);}
 const workers=[];for(const candidate of candidates){await assignment(client,member,candidate.projectId,true);const w=(await client.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[candidate.id,candidate.projectId])).rows[0];try{await approvedParticipant(client,w,member,{permission:null});workers.push({...w,assignmentRevision:candidate.assignmentRevision,projectName:projects.get(candidate.projectId).name});}catch(error){if(!(error instanceof WorkspaceError)||prior0||code)throw error;}}
 if(!workers.length)fault('WORKER_CHANNEL_BINDING_REQUIRED');
 const connection=(await client.query(`SELECT * FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[raw.id,raw.projectId])).rows[0];connection.organizationId=member.organizationId;assertWorkerCustomerConnection(connection,member.organizationId,connection.projectId,Date.now(),{operational:!code});
 const owner=(await client.query(`SELECT * FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 FOR SHARE`,[connection.id,member.organizationId])).rows[0];if(owner?.anchorProjectId!==connection.projectId||owner.mode!==owner0.mode||owner.revision!==owner0.revision)fault('COMPANY_CHANNEL_CONTEXT_CHANGED',409);
 for(const w of workers){const a=(await client.query(`SELECT revision FROM public."WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 AND "organizationId"=$2 AND "projectId"=$3 AND status='ACTIVE' FOR SHARE`,[connection.id,member.organizationId,w.projectId])).rows[0];if(a?.revision!==w.assignmentRevision)fault('COMPANY_CHANNEL_CONTEXT_CHANGED',409);if(!code)w.channelBinding=await signedBinding(client,w,member,connection,environment,{lockProof:true});}
 const senderHmac=senderKey(connection,proof0.senderE164,environment),routeId='company_route_'+digest([member.organizationId,connection.id,senderHmac]),route=(await client.query(`SELECT * FROM public."WhatsAppCompanyRoute" WHERE id=$1 FOR UPDATE`,[routeId])).rows[0];
 if(route&&(route.actorId!==member.actorId||route.membershipId!==member.membershipId))fault('COMPANY_CHANNEL_IDENTITY_AMBIGUOUS');
 const event=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[eventId,connection.projectId])).rows[0],proof=decodeWorkerChannelProof(event,connection,environment),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(context)sourceLease(event,context,now);if(event.payload.payloadDigest!==initial.payload.payloadDigest||proof.senderE164!==proof0.senderE164)fault('WORKER_CHANNEL_PROOF_INTEGRITY',409);
 const projection=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1 FOR UPDATE`,[eventId])).rows[0];if(projection&&(projection.payloadDigest!==event.payload.payloadDigest||projection.connectionId!==connection.id||projection.organizationId!==member.organizationId||projection.actorId!==member.actorId||projection.membershipId!==member.membershipId))fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 return {member,projects,workers,connection,owner,route,routeId,senderHmac,event,proof,projection,now,code};
}
async function reserve(client,r,kind,worker=null){
 if(r.projection)return r.projection;
 const bindingId=worker&&(kind==='BINDING'?worker.metadata.participant.channelIdentity.challenge.id:worker.channelBinding.id);
 await client.query(`INSERT INTO public."WhatsAppCompanyEventRoute"("sourceEventId","payloadDigest","organizationId","connectionId",kind,"routeId","routeEpoch","actorId","membershipId","projectId","workerId","assignmentRevision","bindingId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[r.event.id,r.event.payload.payloadDigest,r.member.organizationId,r.connection.id,kind,r.route?.id||null,r.route?.epoch||null,r.member.actorId,r.member.membershipId,worker?.projectId||null,worker?.id||null,worker?.assignmentRevision||null,bindingId]);
 return {...r.projection,sourceEventId:r.event.id,kind,projectId:worker?.projectId||null,workerId:worker?.id||null};
}
async function recordResult(client,r,value,env){await client.query(`UPDATE public."WhatsAppCompanyEventRoute" SET "encryptedResult"=$2 WHERE "sourceEventId"=$1 AND "payloadDigest"=$3`,[r.event.id,seal(r,'company-source-result',r.event.id,value,env),r.event.payload.payloadDigest]);return value;}
async function writeRoute(client,r,state,worker,env,{advance=false}={}){
 const epoch=(r.route?.epoch||1)+(advance&&r.route?1:0);
 await client.query(`INSERT INTO public."WhatsAppCompanyRoute"(id,"organizationId","connectionId","senderHmac","actorId","membershipId",epoch,"projectId","workerId","assignmentRevision","bindingId","encryptedState") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET epoch=EXCLUDED.epoch,"projectId"=EXCLUDED."projectId","workerId"=EXCLUDED."workerId","assignmentRevision"=EXCLUDED."assignmentRevision","bindingId"=EXCLUDED."bindingId","encryptedState"=EXCLUDED."encryptedState","updatedAt"=clock_timestamp()`,[r.routeId,r.member.organizationId,r.connection.id,r.senderHmac,r.member.actorId,r.member.membershipId,epoch,worker?.projectId||null,worker?.id||null,worker?.assignmentRevision||null,worker?.channelBinding?.id||null,seal(r,'company-route',r.routeId,{...state,epoch},env)]);
}
function menu(r,eventId,offset=0){const choices=r.workers.slice(offset,offset+8).map(w=>({value:w.id,title:w.projectName,assignmentRevision:w.assignmentRevision,bindingId:w.channelBinding.id}));if(offset>0)choices.push({value:'PREVIOUS',title:'Obras anteriores'});if(offset+8<r.workers.length)choices.push({value:'NEXT',title:'Más obras'});const nonce=digest([eventId,r.routeId,(r.route?.epoch||0)+1,choices]).slice(0,20);return {state:{phase:'MENU',nonce,choices,offset,expiresAt:new Date(r.now.getTime()+300000).toISOString()},reply:{type:'interactive',body:'Elegí la obra autorizada. Después confirmá el destino; cambiar de obra no cierra una jornada.',button:'Elegir obra',sections:[{title:'Obras',rows:choices.map((c,i)=>({id:'empresa:'+nonce+':'+i,title:c.title.slice(0,24)}))}]}};}
async function selector(client,r,env){
 if(r.projection?.encryptedResult)return {done:unseal(r,'company-source-result',r.event.id,r.projection.encryptedResult,env)};
 if(r.projection?.kind==='FIELD'||r.projection?.kind==='BINDING')return {delegate:true};
 if(r.code){await reserve(client,r,'BINDING',r.workers[0]);return {delegate:true};}
 if(r.owner.mode!=='COMPANY'||r.proof.companyRouting?.mode!=='COMPANY')fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 const body=r.proof.value.type==='text'?r.proof.value.text?.body?.trim().toUpperCase():null,state=r.route?unseal(r,'company-route',r.routeId,r.route.encryptedState,env):null,active=state&&Date.parse(state.expiresAt)>r.now.getTime(),selected=r.route&&r.workers.find(w=>w.id===r.route.workerId&&w.projectId===r.route.projectId&&w.assignmentRevision===r.route.assignmentRevision&&w.channelBinding.id===r.route.bindingId);
 const id=r.proof.value.type==='interactive'?(r.proof.value.interactive?.list_reply?.id||r.proof.value.interactive?.button_reply?.id):null;
 const match=/^empresa:([a-f0-9]{20}):(\d{1,2})$/.exec(id||'');
 const fieldState=selected?readMetaFieldConversation({...r,worker:selected,project:r.projects.get(selected.projectId),channelBinding:selected.channelBinding},env):null;
 const activeField=fieldState&&Date.parse(fieldState.expiresAt)>r.now.getTime()?fieldState:null;
 const promptSource=async()=>{
  if(!activeField)return false;
  const source=(await client.query(`SELECT "routeId","routeEpoch","workerId","projectId","bindingId","actorId","membershipId" FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1 AND "organizationId"=$2 AND "connectionId"=$3 AND kind='FIELD'`,[activeField.lastEventId,r.member.organizationId,r.connection.id])).rows[0];
  return Boolean(source&&source.routeId===r.routeId&&source.routeEpoch===r.route.epoch&&source.workerId===selected.id&&source.projectId===selected.projectId&&source.bindingId===selected.channelBinding.id&&source.actorId===r.member.actorId&&source.membershipId===r.member.membershipId);
 };
 const promptContext=async()=>{
  if(typeof r.proof.value.context?.id!=='string'||!(await promptSource()))return false;
  const outbound=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[customerOutboundId(activeField.lastEventId),r.connection.projectId])).rows[0];
  if(!outbound?.outcome?.messageId||r.proof.value.context.id!==outbound.outcome.messageId)return false;
  const request=unseal(r,'outbound',outbound.id,outbound.payload.encryptedPayload,env);return digest(request)===outbound.payload.requestDigest&&request.organizationId===r.member.organizationId&&request.channelId===r.connection.id&&request.targetProjectId===selected.projectId&&request.sourceRouteId===activeField.lastEventId;
 };
 const emit=async(value,newState=null,worker=selected,advance=false)=>{await reserve(client,r,'SELECTION');if(newState)await writeRoute(client,r,newState,worker,env,{advance});return {done:await recordResult(client,r,value,env)};};
 if(body==='OBRA'||body==='CAMBIAR OBRA'||!selected&&!match){
  if(selected){const pending=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppCompanyEventRoute" er JOIN public."WebhookEvent" e ON e.id=er."sourceEventId" WHERE er."routeId"=$1 AND er.kind='FIELD' AND e.status='PENDING') AS pending`,[r.routeId])).rows[0].pending;if(pending)return emit(result('WORKSITE_PENDING',text('Hay una operación pendiente. Consultá su recibo antes de cambiar de obra.')));if(activeField&&activeField.purpose!=='MENU')return emit(result('WORKSITE_DRAFT_PENDING',text('Conservamos el borrador de la obra actual. Respondé al mensaje de ese paso con CANCELAR para descartarlo explícitamente y después CAMBIAR OBRA.')));}
  const next=menu(r,r.event.id);return emit(result('WORKSITE_SELECTION',next.reply),next.state,null,true);
 }
 if(match){
  if(!active||match[1]!==state.nonce||!state.choices?.[Number(match[2])])return emit(result('STALE_WORKSITE_SELECTION',text('Esta selección venció o cambió. Escribí OBRA para elegir y confirmar nuevamente.')));
  const choice=state.choices[Number(match[2])];
  if(choice.value==='NEXT'||choice.value==='PREVIOUS'){const next=menu(r,r.event.id,Math.max(0,state.offset+(choice.value==='NEXT'?8:-8)));return emit(result('WORKSITE_SELECTION',next.reply),next.state,null,true);}
  const worker=r.workers.find(w=>w.id===choice.value&&w.assignmentRevision===choice.assignmentRevision&&w.channelBinding.id===choice.bindingId);if(!worker)return emit(result('STALE_WORKSITE_SELECTION',text('La autorización de esa obra cambió. Escribí OBRA para renovar la selección.')));
  if(state.phase==='CONFIRM'){const next={phase:'SELECTED',expiresAt:new Date(r.now.getTime()+900000).toISOString()};return emit(result('WORKSITE_SELECTED',text('Obra confirmada: '+worker.projectName+'. Escribí MENU para ver las operaciones que permite tu participación. Las evidencias y propuestas requieren revisión humana. KYC, Flow y avisos proactivos no están habilitados en este canal.')),next,worker,true);}
  const nonce=digest([r.event.id,r.routeId,state.epoch,worker.id,worker.assignmentRevision,worker.channelBinding.id,'confirm']).slice(0,20),next={phase:'CONFIRM',nonce,choices:[{...choice}],expiresAt:new Date(r.now.getTime()+300000).toISOString()};return emit(result('WORKSITE_CONFIRM', {type:'interactive',body:'¿Confirmar la obra '+worker.projectName+'? La jornada y los recibos conservarán este destino.',button:'Confirmar obra',sections:[{title:'Destino',rows:[{id:'empresa:'+nonce+':0',title:'Confirmar obra'}]}]}),next,null);
 }
 if(body==='CANCELAR'&&selected){if(activeField&&!(await promptContext()))return emit(result('WORKSITE_INPUT_CONTEXT_REQUIRED',text('Respondé al mensaje del paso actual con CANCELAR. Conservamos el borrador y no cambiamos la obra.')));await client.query(`UPDATE public."Worker" SET metadata=metadata-'fieldChannelConversation',"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[selected.id,selected.projectId]);return emit(result('WORKSITE_DRAFT_CANCELLED',text('Borrador cancelado en '+selected.projectName+'. La jornada y los recibos se conservan. Escribí CAMBIAR OBRA para elegir otro destino.')));}
 // A live draft keeps its already confirmed destination only while its durable
 // prompt still belongs to the same route epoch, person, worksite and binding.
 // Every new input must also pass the current prompt/nonce checks below. This
 // does not renew an expired menu or permit selecting another worksite.
 const continuingDraft=selected&&state?.phase==='SELECTED'&&Number.isFinite(Date.parse(state.expiresAt))&&['ATTENDANCE','MEDIA','INCIDENT','MATERIAL','CONSUMPTION','PROGRESS'].includes(activeField?.purpose)&&await promptSource();
 if(!selected||state?.phase!=='SELECTED'||!active&&!continuingDraft)return emit(result('WORKSITE_SELECTION_REQUIRED',text('Elegí y confirmá una obra vigente. Escribí OBRA.')));
 if(!active&&continuingDraft&&metaFieldConversationAction(body)&&body!=='ESTADO')return emit(result('WORKSITE_DRAFT_PENDING',text('Conservamos el borrador de '+selected.projectName+'. Respondé al mensaje de ese paso para continuar, o con CANCELAR para descartarlo. Para otra operación, elegí y confirmá nuevamente la obra.')));
 if(activeField&&activeField.purpose!=='MENU'&&['MENU','AYUDA','HOLA'].includes(body))return emit(result('WORKSITE_DRAFT_PENDING',text('Conservamos el borrador de '+selected.projectName+'. Respondé al mensaje del paso actual para continuar, o con CANCELAR para descartarlo explícitamente. ESTADO permite consultar la jornada sin borrar este paso.')));
 if(['document','nfm_reply'].includes(r.proof.value.type)||r.proof.value.interactive?.nfm_reply||['KYC','VERIFICAR'].includes(body))return emit(result('COMPANY_ADAPTER_DISABLED',text('KYC y Flow requieren los pasos habilitados en Mi cuenta. Este canal no recibe documentos de identidad ni datos bancarios. Escribí MENU para ver tus operaciones autorizadas.')));
 // Free input/location must reply to the durable prompt; an uncorrelated late
 // message cannot be assigned by phone, current selection or provider time.
 if(!['MENU','AYUDA','ESTADO','HOLA'].includes(body)){
  const fieldChoice=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(id||'');
  if(id?(!fieldChoice||fieldChoice[1]!==activeField?.nonce||!activeField?.choices?.[Number(fieldChoice[2])]||!(await promptSource())):!(await promptContext()))return emit(result('WORKSITE_INPUT_CONTEXT_REQUIRED',text('Escribí MENU y elegí una acción vigente de la obra confirmada, o respondé al mensaje de su paso actual. Conservamos el borrador y no aplicamos operaciones.')));
 }
 await reserve(client,r,'FIELD',selected);return {delegate:true};
}
export function createCompanyChannelBridge({connect,environment=process.env,provider,put,get,analyzer}){
 const within=run=>customerJobTransaction(connect,run),field=createMetaFieldBridge({connect,environment,provider,put,get,analyzer,resolveIdentity:(client,options)=>resolveWorkerChannelIdentity(client,{...options,companyRouting:true})});
 return {async execute(context){const prepared=await within(async client=>{const r=await resolveCompanyEnvelope(client,{eventId:context.eventId,environment,context});return r?selector(client,r,environment):null;});if(!prepared)return null;if(prepared.done)return prepared.done;const value=await field.execute(context);await within(async client=>{const r=await resolveCompanyEnvelope(client,{eventId:context.eventId,environment,context});if(!r)fault('COMPANY_CHANNEL_SOURCE_REQUIRED');await recordResult(client,r,value,environment);});return value;}};
}
export async function resolveCompanyOutboundIdentity(client,options){
 const projection=(await client.query(`SELECT kind FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[options.eventId])).rows[0];if(projection?.kind==='FIELD'||projection?.kind==='BINDING')return resolveWorkerChannelIdentity(client,{...options,companyRouting:true});
 const r=await resolveCompanyEnvelope(client,options);if(!r)fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 if(!r.projection?.encryptedResult)fault('COMPANY_CHANNEL_SOURCE_REQUIRED');return {kind:'CHANNEL_VERIFIED',member:r.member,project:r.projects.get(r.connection.projectId),connection:r.connection,event:r.event,proof:r.proof,sourceProjectId:r.connection.projectId,companyProjection:r.projection};
}
