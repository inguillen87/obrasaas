import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {buildCustomerTemplate,customerRemoteTemplateMatches,customerTemplateBlueprint} from './meta-customer-templates.mjs';
import {customerChannelActive,customerJobTransaction,reserveCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerTemplateMessage,metaCustomerTransportReady} from './meta-customer-provider.mjs';
import {canApproveProgress} from './field-operations-policy.mjs';
import {assertProgressContinuity} from './field-operations-store.mjs';

export const CUSTOMER_MANUAL_TEMPLATE='open_attendance_reminder';
export const CUSTOMER_PROGRESS_TEMPLATE='progress_review_notification';
export const customerTemplateSendKey=key=>[CUSTOMER_MANUAL_TEMPLATE,CUSTOMER_PROGRESS_TEMPLATE].includes(key);
export const customerTemplateSendId=(actorId,projectId,id)=>'customer_outbound_'+digest(['meta-customer-template-send-v1',actorId,projectId,id]);
export const customerProgressNoticeSubjectKey=({organizationId,projectId,workerId,actionReference})=>digest(['meta-customer-progress-notice-v1',organizationId,projectId,CUSTOMER_PROGRESS_TEMPLATE,workerId,actionReference.proposalId,actionReference.revision]);
const inputKeys=['operationId','projectId','scope','templateKey','workerId'];
export function validateCustomerTemplateSend(body){
 const keys=body?.templateKey===CUSTOMER_PROGRESS_TEMPLATE?[...inputKeys,'actionReference']:inputKeys;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!==[...keys].sort().join('|')||!operationId(body.operationId)||!workspaceId(body.projectId)||!workspaceId(body.workerId)||!/^[a-f0-9]{64}$/.test(body.scope||'')||!customerTemplateSendKey(body.templateKey))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_INVALID');
 if(body.templateKey===CUSTOMER_PROGRESS_TEMPLATE){const ref=body.actionReference;if(!ref||typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).sort().join('|')!=='proposalId|revision'||!workspaceId(ref.proposalId)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(ref.revision||''))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_INVALID');}
 return {...body,operationId:body.operationId.toLowerCase(),...(body.templateKey===CUSTOMER_PROGRESS_TEMPLATE?{actionReference:{...body.actionReference}}:{})};
}
const terminal=state=>['SENT','REJECTED','STATUS_OBSERVED'].includes(state);
export function publicCustomerTemplateSend(row,{scope,projectId}){
 if(!row)return {scope,projectId,state:'NOT_OBSERVED',receipt:null,providerAccepted:false,providerStatus:null,deliveryConfirmed:false,saved:false,definitive:false};
 const stored=row.outcome?.state||'SEND_UNKNOWN',state=stored==='SENT'?'ACCEPTED':stored;
 return {scope,projectId,state,receipt:{id:row.id,operationId:row.payload.operationId,workerId:row.payload.workerId,templateKey:row.payload.templateKey,...(row.payload.templateKey===CUSTOMER_PROGRESS_TEMPLATE?{actionReference:row.payload.actionReference}:{})},providerAccepted:stored==='SENT'||stored==='STATUS_OBSERVED'&&['sent','delivered','read'].includes(row.outcome.providerStatus),providerStatus:row.outcome?.providerStatus||null,deliveryConfirmed:stored==='STATUS_OBSERVED'&&['delivered','read'].includes(row.outcome.providerStatus),saved:['SENT','STATUS_OBSERVED'].includes(stored),definitive:terminal(stored),code:row.outcome?.code||null};
}
export async function customerOpenAttendance(client,projectId,workerId){
 const row=(await client.query(`SELECT id,"workerId",metadata FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=$2 AND metadata->'fieldOperations'->>'version'='1' ORDER BY (metadata->'fieldOperations'->>'sequence')::int DESC,id DESC LIMIT 1`,[projectId,workerId])).rows[0],value=row?.metadata?.fieldOperations;
 if(!row||value?.version!==1||!['CHECK_IN','BREAK_START','BREAK_END'].includes(value.eventType)||!['WORKING','ON_BREAK'].includes(value.phase)||!Number.isSafeInteger(value.sequence)||value.sequence<1||!workspaceId(value.shiftId)||!workspaceId(value.recordedBy))throw new WorkspaceError('META_CUSTOMER_ATTENDANCE_REMINDER_NOT_APPLICABLE',409);
 return {id:row.id,revision:digest(value)};
}
export async function customerProgressReviewSubject(client,projectId,reference,recipientMember){
 // Read-only snapshots share the business facts. Writable callers additionally
 // supply the canonical recipient membership and enforce maker/checker here.
 if(recipientMember!==undefined&&!canApproveProgress(recipientMember?.role))throw new WorkspaceError('FIELD_PROGRESS_PERMISSION_REQUIRED',403);
 const row=(await client.query(`SELECT id,summary,status::text AS status,action,precondition,"proposedByWorkerId","expiresAt",("expiresAt"<=clock_timestamp()) AS expired,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."OperationalProposal" WHERE id=$1 AND "projectId"=$2 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field'`,[reference.proposalId,projectId])).rows[0],action=row?.action;
 if(!row||action?.fieldOperationsVersion!==1||!workspaceId(action.taskId)||!workspaceId(action.submittedBy)||!workspaceId(action.workerId)||row.proposedByWorkerId!==action.workerId)throw new WorkspaceError('FIELD_PROPOSAL_UNAVAILABLE',404);
 if(row.revision!==reference.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
 if(row.status==='EXPIRED'||row.status==='PENDING'&&(row.expired===true||!row.expiresAt||!Number.isFinite(new Date(row.expiresAt).getTime())))throw new WorkspaceError('FIELD_PROPOSAL_EXPIRED',409);
 if(row.status!=='PENDING')throw new WorkspaceError('FIELD_ALREADY_REVIEWED',409);
 if(recipientMember&&action.submittedBy===recipientMember.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
 const task=(await client.query(`SELECT id,title,progress,status::text AS status,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Task" WHERE id=$1 AND "projectId"=$2`,[action.taskId,projectId])).rows[0];
 if(!task)throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);
 if(task.revision!==row.precondition?.taskRevision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
 assertProgressContinuity(task,action);
 if(!Array.isArray(action.evidenceIds)||!action.evidenceIds.length||action.evidenceIds.length>10||new Set(action.evidenceIds).size!==action.evidenceIds.length||action.evidenceIds.some(id=>!workspaceId(id)))throw new WorkspaceError('FIELD_PROPOSAL_UNAVAILABLE',404);
 const evidenceRows=(await client.query(`SELECT id,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Incident" WHERE "projectId"=$1 AND id=ANY($2::text[])`,[projectId,action.evidenceIds])).rows,evidenceClaims=[];
 for(const id of [...action.evidenceIds].sort()){
  const evidence=evidenceRows.find(row=>row.id===id),value=evidence?.metadata?.fieldOperations;
  if(value?.version!==1||value.kind!=='EVIDENCE')throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);
  if(value.taskId!==action.taskId||value.review?.decision!=='APPROVE')throw new WorkspaceError('FIELD_EVIDENCE_NOT_APPROVED',409);
  evidenceClaims.push({id:evidence.id,revision:evidence.revision,contentDigest:digest(value)});
 }
 return {kind:'PROGRESS_REVIEW',proposalId:row.id,revision:row.revision,taskId:task.id,submittedBy:action.submittedBy,proposalDigest:digest({action,precondition:row.precondition,proposedByWorkerId:row.proposedByWorkerId,expiresAt:row.expiresAt}),taskDigest:digest(task),evidenceClaims};
}
function approvedDefinition(connection,project,key){
 const definition=buildCustomerTemplate(connection,key),draft=connection.metadata?.customerTemplateDrafts?.[key];
 if(project.metadata?.metaSignup?.id!==connection.metadata?.customerSignupId||!draft||draft.state!=='SUBMITTED'||draft.providerStatus!=='APPROVED'||draft.providerCategory!=='UTILITY'||draft.definition?.name!==definition.name||draft.definition?.contentSha256!==definition.contentSha256||!/^\d{5,32}$/.test(draft.providerId||''))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_APPROVAL_REQUIRED',409);
 return {definition,providerId:draft.providerId,observationRevision:draft.observationRevision};
}
function channelClaim(connection,project){
 return digest({id:connection.id,projectId:project.id,phoneNumberId:connection.phoneNumberId,wabaId:connection.whatsappBusinessId,credential:connection.encryptedAccessToken,signupId:connection.metadata.customerSignupId,activation:connection.metadata.customerActivation,verification:connection.metadata.customerVerification,subscribed:connection.metadata.customerSubscribed});
}
function recipientClaim(recipient){return digest({workerId:recipient.worker.id,binding:recipient.channelBinding,consent:recipient.templateConsent,kyc:recipient.worker.metadata.participant.kyc,member:recipient.member});}
function credential(connection,organizationId,environment){return decryptCustomerSecret(connection.encryptedAccessToken,{organizationId,projectId:connection.projectId,purpose:'access-token',resourceId:connection.phoneNumberId},environment);}

export function createMetaCustomerTemplateSend({workspace,connect,resolveRecipient,provider,environment=process.env,now=()=>Date.now(),afterReserve=async()=>{},afterLookup=async()=>{}}){
 if(typeof resolveRecipient!=='function'||typeof connect!=='function')throw new TypeError('Canonical recipient resolver and connection required');
 const within=(session,context,writable,run,before)=>workspace.integrationProject(session,context,writable,run,before);
 const existing=async(client,id,projectId,actorId,organizationId,lock=false)=>(await client.query(`SELECT id,payload,outcome,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'organizationId'=$3 AND outcome->>'actorId'=$4 ${lock?'FOR UPDATE':''}`,[id,projectId,organizationId,actorId])).rows[0]||null;
 const subjectConflict=state=>['SEND_STARTED','SEND_UNKNOWN'].includes(state)?'META_CUSTOMER_TEMPLATE_SEND_PENDING':['SENT','STATUS_OBSERVED'].includes(state)?'META_CUSTOMER_TEMPLATE_SUBJECT_ALREADY_NOTIFIED':null;
 const subjectNotification=async(client,projectId,organizationId,key)=>(await client.query(`SELECT outcome->>'state' AS state FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'organizationId'=$2 AND payload->>'templateKey'=$3 AND payload->>'subjectKey'=$4 AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED') ORDER BY CASE WHEN outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN') THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE`,[projectId,organizationId,CUSTOMER_PROGRESS_TEMPLATE,key])).rows[0]||null;
 async function complete(claim,state,messageId=null,code=null){
  return customerJobTransaction(connect,async client=>{
   await completeCustomerOutbound(client,{...claim,state,messageId,now:now(),outcomeFields:{code}});
   return existing(client,claim.id,claim.projectId,claim.actorId,claim.organizationId);
  });
 }
 return {
  async read(session,context){
   const key=context.templateKey??CUSTOMER_MANUAL_TEMPLATE;
   if(!customerTemplateSendKey(key))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_INVALID');
   return within(session,context,false,async(client,member,scope,project)=>{
    if(context.operationId){if(!operationId(context.operationId))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_INVALID');return publicCustomerTemplateSend(await existing(client,customerTemplateSendId(member.actorId,project.id,context.operationId.toLowerCase()),project.id,member.actorId,member.organizationId),{scope,projectId:project.id});}
    const connections=(await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId","encryptedAccessToken",enabled,"connectionStatus",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id])).rows;
    const connection=connections.length===1?connections[0]:null;
    const readiness=provider.readiness();
    let approved=null;try{if(metaCustomerTransportReady(readiness)&&connection&&customerChannelActive(connection,now())){const current=approvedDefinition(connection,project,key);customerTemplateMessage({name:current.definition.name,language:current.definition.language,bodyParameters:[project.name]});approved=current;}}catch(error){if(!(error instanceof WorkspaceError))throw error;}
    const definition=customerTemplateBlueprint(key),progress=key===CUSTOMER_PROGRESS_TEMPLATE;
    const workers=progress?(await client.query(`SELECT w.id,w.name FROM public."Worker" w WHERE w."projectId"=$1 AND w.active=true AND w.metadata->'participant'->>'status'='ACTIVE' AND EXISTS(SELECT 1 FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id WHERE u."clerkUserId"=w.metadata->'participant'->>'clerkUserId' AND tm."organizationId"=$2 AND tm.status='ACTIVE' AND tm."tenantRole" IN ('ADMIN','DIRECTOR')) ORDER BY w.name,w.id LIMIT 21`,[project.id,member.organizationId])).rows:(await client.query(`SELECT id,name FROM public."Worker" WHERE "projectId"=$1 AND active=true AND metadata->'participant'->>'status'='ACTIVE' ORDER BY name,id LIMIT 21`,[project.id])).rows;
    const proposalRows=progress?(await client.query(`SELECT id,summary,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND "expiresAt">clock_timestamp() AND action->>'fieldOperationsVersion'='1' ORDER BY "createdAt" DESC,id DESC LIMIT 21`,[project.id])).rows:[],proposals=[],subjects=new Map();
    for(const row of proposalRows.slice(0,20)){
     const reference={proposalId:row.id,revision:row.revision};
     try{subjects.set(row.id,await customerProgressReviewSubject(client,project.id,reference));proposals.push({...reference,title:row.summary,eligibleWorkerIds:[]});}catch(error){if(!(error instanceof WorkspaceError))throw error;}
    }
    const subjectKeys=progress?proposals.flatMap(proposal=>workers.slice(0,20).map(worker=>customerProgressNoticeSubjectKey({organizationId:member.organizationId,projectId:project.id,workerId:worker.id,actionReference:{proposalId:proposal.proposalId,revision:proposal.revision}}))):[];
    const notified=subjectKeys.length?(await client.query(`SELECT payload->>'subjectKey' AS key,outcome->>'state' AS state FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'organizationId'=$2 AND payload->>'templateKey'=$3 AND payload->>'subjectKey'=ANY($4::text[]) AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED')`,[project.id,member.organizationId,CUSTOMER_PROGRESS_TEMPLATE,subjectKeys])).rows:[];
    const records=[];
    for(const worker of workers.slice(0,20)){
     let reasonCode=null,recipient;
     try{recipient=await resolveRecipient(client,{organizationId:member.organizationId,projectId:project.id,workerId:worker.id,permission:progress?null:'attendance',environment,lock:false});if(progress){if(!canApproveProgress(recipient.member.role))throw new WorkspaceError('FIELD_PROGRESS_PERMISSION_REQUIRED',403);}else await customerOpenAttendance(client,project.id,worker.id);if(!metaCustomerTransportReady(readiness))reasonCode=readiness.launchCode;else if(!approved)reasonCode='META_CUSTOMER_TEMPLATE_APPROVAL_REQUIRED';}catch(error){if(!(error instanceof WorkspaceError))throw error;reasonCode=error.code;}
     const pending=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'workerId'=$2 AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN') LIMIT 1`,[project.id,worker.id])).rows[0];
     if(pending)reasonCode='META_CUSTOMER_TEMPLATE_SEND_PENDING';
     if(progress&&reasonCode===null){
      let ineligibleCode='META_CUSTOMER_PROGRESS_REVIEW_NOT_APPLICABLE',eligible=false;
      for(const proposal of proposals){
       const subject=subjects.get(proposal.proposalId);if(!subject)continue;
       if(subject.submittedBy===recipient.member.actorId){ineligibleCode='FIELD_MAKER_CHECKER_REQUIRED';continue;}
       const subjectKey=customerProgressNoticeSubjectKey({organizationId:member.organizationId,projectId:project.id,workerId:worker.id,actionReference:{proposalId:proposal.proposalId,revision:proposal.revision}}),prior=notified.filter(row=>row.key===subjectKey),conflict=prior.find(row=>['SEND_STARTED','SEND_UNKNOWN'].includes(row.state))||prior[0];
       if(conflict){ineligibleCode=subjectConflict(conflict.state);continue;}
       proposal.eligibleWorkerIds.push(worker.id);eligible=true;
      }
      if(!eligible)reasonCode=ineligibleCode;
     }
     records.push({workerId:worker.id,name:worker.name,eligible:reasonCode===null,reasonCode});
    }
    const recentRows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'organizationId'=$2 AND outcome->>'actorId'=$3 AND payload->>'templateKey'=$4 ORDER BY "createdAt" DESC,id DESC LIMIT 20`,[project.id,member.organizationId,member.actorId,key])).rows;
    const canSend=!!approved&&records.some(row=>row.eligible);
    return {scope,projectId:project.id,projectName:project.name,canSend,template:{key,title:definition.title,bodyText:definition.bodyText.replace('{{1}}',project.name),providerStatus:approved?'APPROVED':null,canSend},records,recent:recentRows.map(row=>publicCustomerTemplateSend(row,{scope,projectId:project.id})),...(progress?{proposals}:{}),truncated:workers.length>20||proposalRows.length>20};
   });
  },
  async send(session,raw){
   const body=validateCustomerTemplateSend(raw),bodyDigest=digest(body),progress=body.templateKey===CUSTOMER_PROGRESS_TEMPLATE;let recipient,previous;
   const claim=await within(session,body,true,async(client,member,scope,project)=>{
    const id=customerTemplateSendId(member.actorId,project.id,body.operationId),prior=await existing(client,id,project.id,member.actorId,member.organizationId,true);
    if(prior){if(prior.payload.bodyDigest!==bodyDigest)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_CONFLICT',409);return {done:publicCustomerTemplateSend(prior,{scope,projectId:project.id})};}
    const readiness=provider.readiness();if(!metaCustomerTransportReady(readiness))throw new WorkspaceError('META_CUSTOMER_CONFIGURATION_PENDING',503);
    const connection=recipient.connection;
    if(recipient.kind!=='TEMPLATE_RECIPIENT_VERIFIED'||recipient.worker.id!==body.workerId||recipient.project.id!==project.id||connection.projectId!==project.id||!customerChannelActive(connection,now()))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_RECIPIENT_REQUIRED',403);
    const business=progress?await customerProgressReviewSubject(client,project.id,body.actionReference,recipient.member):await customerOpenAttendance(client,project.id,body.workerId),approved=approvedDefinition(connection,project,body.templateKey);
    const subjectKey=progress?customerProgressNoticeSubjectKey({organizationId:member.organizationId,projectId:project.id,workerId:body.workerId,actionReference:body.actionReference}):null;
    if(progress){const notified=await subjectNotification(client,project.id,member.organizationId,subjectKey);if(notified)throw new WorkspaceError(subjectConflict(notified.state),409);}
    const pending=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'workerId'=$2 AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN') LIMIT 1 FOR UPDATE`,[project.id,body.workerId])).rows[0];
    if(pending)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_PENDING',409);
    const message={name:approved.definition.name,language:approved.definition.language,bodyParameters:[project.name]};customerTemplateMessage(message);
    const referenceFields=progress?{subjectKey,actionReference:body.actionReference}:{};
    const request={version:1,purpose:'worksite-operational-templates',operationId:body.operationId,bodyDigest,channelId:connection.id,organizationId:member.organizationId,to:recipient.worker.phone.slice(1),message,...(progress?{subject:business,...referenceFields}:{attendance:business}),channelClaim:channelClaim(connection,project),recipientClaim:recipientClaim(recipient),templateClaim:digest(approved)};
    const reservation=await reserveCustomerOutbound(client,{id,projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,request,eventType:'template',payloadFields:{operationId:body.operationId,bodyDigest,workerId:body.workerId,templateKey:body.templateKey,...referenceFields},environment,now:now()});
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.template_send.reserved','WebhookEvent',$4,$5::jsonb)`,['meta_template_send_'+digest([id]),member.organizationId,member.actorId,id,JSON.stringify({version:1,projectId:project.id,operationId:body.operationId,workerId:body.workerId,templateKey:body.templateKey,outboundId:id,requestDigest:reservation.requestDigest,...(progress?{...referenceFields,subjectDigest:digest(business)}:{attendanceId:business.id,attendanceRevision:business.revision})})]);
    return {...reservation,projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,scope,request,approved,token:credential(connection,member.organizationId,environment),phoneNumberId:connection.phoneNumberId,wabaId:connection.whatsappBusinessId};
   },async(client,member)=>{
    previous=await existing(client,customerTemplateSendId(member.actorId,body.projectId,body.operationId),body.projectId,member.actorId,member.organizationId);
    if(!previous)recipient=await resolveRecipient(client,{organizationId:member.organizationId,projectId:body.projectId,workerId:body.workerId,permission:progress?null:'attendance',environment});
   });
   if(claim.done)return claim.done;
   await afterReserve();
   let remote;
   try{remote=await provider.findTemplate({token:claim.token,wabaId:claim.wabaId,name:claim.approved.definition.name});if(!customerRemoteTemplateMatches(remote,claim.approved.definition)||String(remote.id)!==claim.approved.providerId||remote.status!=='APPROVED'||remote.category!=='UTILITY')throw new WorkspaceError('META_CUSTOMER_TEMPLATE_APPROVAL_REQUIRED',409);}
   catch(error){const row=await complete(claim,'REJECTED',null,error instanceof WorkspaceError?error.code:'META_CUSTOMER_TEMPLATE_APPROVAL_UNCONFIRMED');return publicCustomerTemplateSend(row,{scope:claim.scope,projectId:claim.projectId});}
   await afterLookup();
   try{
    await within(session,body,true,async(client,member,_scope,project)=>{
     const row=await existing(client,claim.id,project.id,member.actorId,member.organizationId,true);
     if(row?.leaseToken!==claim.leaseToken||row.outcome?.state!=='SEND_STARTED'||new Date(row.leaseExpiresAt).getTime()<=now())throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
     const connection=recipient.connection,business=progress?await customerProgressReviewSubject(client,project.id,body.actionReference,recipient.member):await customerOpenAttendance(client,project.id,body.workerId),approved=approvedDefinition(connection,project,body.templateKey);
     if(!metaCustomerTransportReady(provider.readiness()))throw new WorkspaceError('META_CUSTOMER_CONFIGURATION_PENDING',503);
     if(channelClaim(connection,project)!==claim.request.channelClaim||recipientClaim(recipient)!==claim.request.recipientClaim||digest(approved)!==claim.request.templateClaim||digest(business)!==digest(progress?claim.request.subject:claim.request.attendance)||project.name!==claim.request.message.bodyParameters[0])throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_STATE_CHANGED',409);
     const updated=await client.query(`UPDATE public."WebhookEvent" SET outcome=outcome||$4::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3`,[claim.id,project.id,claim.leaseToken,JSON.stringify({dispatchStartedAt:new Date(now()).toISOString()})]);
     if(updated.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
    },async(client,member)=>{recipient=await resolveRecipient(client,{organizationId:member.organizationId,projectId:body.projectId,workerId:body.workerId,permission:progress?null:'attendance',environment});});
   }catch(error){
    // A failed COMMIT acknowledgement may hide a committed dispatch marker.
    // No provider POST follows; canonical GET retains this durable uncertainty.
    if(!(error instanceof WorkspaceError)||error.status>=500)throw error;
    const row=await complete(claim,'REJECTED',null,error.code);return publicCustomerTemplateSend(row,{scope:claim.scope,projectId:claim.projectId});
   }
   let state='SEND_UNKNOWN',messageId=null,code=null;
   try{const sent=await provider.sendTemplate({token:claim.token,phoneNumberId:claim.phoneNumberId,to:claim.request.to,message:claim.request.message,correlationId:claim.id});if(!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(sent?.messageId||''))throw new WorkspaceError('META_CUSTOMER_SEND_UNCONFIRMED',503);messageId=sent.messageId;state='SENT';}
   catch(error){code=error instanceof WorkspaceError?error.code:'META_CUSTOMER_SEND_UNCONFIRMED';if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}
   const row=await complete(claim,state,messageId,code);return publicCustomerTemplateSend(row,{scope:claim.scope,projectId:claim.projectId});
  },
 };
}
