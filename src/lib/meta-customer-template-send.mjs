import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {buildCustomerTemplate,customerRemoteTemplateMatches,customerTemplateBlueprint} from './meta-customer-templates.mjs';
import {customerChannelActive,customerJobTransaction,reserveCustomerOutbound,completeCustomerOutbound} from './meta-customer-outbound.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerTemplateMessage} from './meta-customer-provider.mjs';

export const CUSTOMER_MANUAL_TEMPLATE='open_attendance_reminder';
export const customerTemplateSendId=(actorId,projectId,id)=>'customer_outbound_'+digest(['meta-customer-template-send-v1',actorId,projectId,id]);
const inputKeys=['operationId','projectId','scope','templateKey','workerId'];
export function validateCustomerTemplateSend(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!==[...inputKeys].sort().join('|')||!operationId(body.operationId)||!workspaceId(body.projectId)||!workspaceId(body.workerId)||!/^[a-f0-9]{64}$/.test(body.scope||'')||body.templateKey!==CUSTOMER_MANUAL_TEMPLATE)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_INVALID');
 return {...body,operationId:body.operationId.toLowerCase()};
}
const terminal=state=>['SENT','REJECTED','STATUS_OBSERVED'].includes(state);
export function publicCustomerTemplateSend(row,{scope,projectId}){
 if(!row)return {scope,projectId,state:'NOT_OBSERVED',receipt:null,providerAccepted:false,providerStatus:null,deliveryConfirmed:false,saved:false,definitive:false};
 const stored=row.outcome?.state||'SEND_UNKNOWN',state=stored==='SENT'?'ACCEPTED':stored;
 return {scope,projectId,state,receipt:{id:row.id,operationId:row.payload.operationId,workerId:row.payload.workerId,templateKey:row.payload.templateKey},providerAccepted:stored==='SENT'||stored==='STATUS_OBSERVED'&&['sent','delivered','read'].includes(row.outcome.providerStatus),providerStatus:row.outcome?.providerStatus||null,deliveryConfirmed:stored==='STATUS_OBSERVED'&&['delivered','read'].includes(row.outcome.providerStatus),saved:['SENT','STATUS_OBSERVED'].includes(stored),definitive:terminal(stored),code:row.outcome?.code||null};
}
export async function customerOpenAttendance(client,projectId,workerId){
 const row=(await client.query(`SELECT id,"workerId",metadata FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=$2 AND metadata->'fieldOperations'->>'version'='1' ORDER BY (metadata->'fieldOperations'->>'sequence')::int DESC,id DESC LIMIT 1`,[projectId,workerId])).rows[0],value=row?.metadata?.fieldOperations;
 if(!row||value?.version!==1||!['CHECK_IN','BREAK_START','BREAK_END'].includes(value.eventType)||!['WORKING','ON_BREAK'].includes(value.phase)||!Number.isSafeInteger(value.sequence)||value.sequence<1||!workspaceId(value.shiftId)||!workspaceId(value.recordedBy))throw new WorkspaceError('META_CUSTOMER_ATTENDANCE_REMINDER_NOT_APPLICABLE',409);
 return {id:row.id,revision:digest(value)};
}
function approvedDefinition(connection,project){
 const definition=buildCustomerTemplate(connection,CUSTOMER_MANUAL_TEMPLATE),draft=connection.metadata?.customerTemplateDrafts?.[CUSTOMER_MANUAL_TEMPLATE];
 if(project.metadata?.metaSignup?.id!==connection.metadata?.customerSignupId||!draft||draft.state!=='SUBMITTED'||draft.providerStatus!=='APPROVED'||draft.providerCategory!=='UTILITY'||draft.definition?.name!==definition.name||draft.definition?.contentSha256!==definition.contentSha256||!/^\d{5,32}$/.test(draft.providerId||''))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_APPROVAL_REQUIRED',409);
 return {definition,providerId:draft.providerId,observationRevision:draft.observationRevision};
}
function channelClaim(connection,project){
 return digest({id:connection.id,projectId:project.id,phoneNumberId:connection.phoneNumberId,wabaId:connection.whatsappBusinessId,credential:connection.encryptedAccessToken,signupId:connection.metadata.customerSignupId,activation:connection.metadata.customerActivation,verification:connection.metadata.customerVerification,subscribed:connection.metadata.customerSubscribed});
}
function recipientClaim(recipient){return digest({workerId:recipient.worker.id,binding:recipient.channelBinding,consent:recipient.templateConsent,kyc:recipient.worker.metadata.participant.kyc});}
function credential(connection,organizationId,environment){return decryptCustomerSecret(connection.encryptedAccessToken,{organizationId,projectId:connection.projectId,purpose:'access-token',resourceId:connection.phoneNumberId},environment);}

export function createMetaCustomerTemplateSend({workspace,connect,resolveRecipient,provider,environment=process.env,now=()=>Date.now(),afterReserve=async()=>{},afterLookup=async()=>{}}){
 if(typeof resolveRecipient!=='function'||typeof connect!=='function')throw new TypeError('Canonical recipient resolver and connection required');
 const within=(session,context,writable,run,before)=>workspace.integrationProject(session,context,writable,run,before);
 const existing=async(client,id,projectId,actorId,organizationId,lock=false)=>(await client.query(`SELECT id,payload,outcome,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'organizationId'=$3 AND outcome->>'actorId'=$4 ${lock?'FOR UPDATE':''}`,[id,projectId,organizationId,actorId])).rows[0]||null;
 async function complete(claim,state,messageId=null,code=null){
  return customerJobTransaction(connect,async client=>{
   await completeCustomerOutbound(client,{...claim,state,messageId,now:now(),outcomeFields:{code}});
   return existing(client,claim.id,claim.projectId,claim.actorId,claim.organizationId);
  });
 }
 return {
  async read(session,context){
   return within(session,context,false,async(client,member,scope,project)=>{
    if(context.operationId){if(!operationId(context.operationId))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_INVALID');return publicCustomerTemplateSend(await existing(client,customerTemplateSendId(member.actorId,project.id,context.operationId.toLowerCase()),project.id,member.actorId,member.organizationId),{scope,projectId:project.id});}
    const connections=(await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId","encryptedAccessToken",enabled,"connectionStatus",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id])).rows;
    const connection=connections.length===1?connections[0]:null;
    const readiness=provider.readiness();
    let approved=null;try{if(readiness.canLaunchMeta&&connection&&customerChannelActive(connection,now())){const current=approvedDefinition(connection,project);customerTemplateMessage({name:current.definition.name,language:current.definition.language,bodyParameters:[project.name]});approved=current;}}catch(error){if(!(error instanceof WorkspaceError))throw error;}
    const definition=customerTemplateBlueprint(CUSTOMER_MANUAL_TEMPLATE);
    const workers=(await client.query(`SELECT id,name FROM public."Worker" WHERE "projectId"=$1 AND active=true AND metadata->'participant'->>'status'='ACTIVE' ORDER BY name,id LIMIT 21`,[project.id])).rows;
    const records=[];
    for(const worker of workers.slice(0,20)){
     let reasonCode=null;
     try{await resolveRecipient(client,{organizationId:member.organizationId,projectId:project.id,workerId:worker.id,permission:'attendance',environment,lock:false});await customerOpenAttendance(client,project.id,worker.id);if(!readiness.canLaunchMeta)reasonCode=readiness.launchCode;else if(!approved)reasonCode='META_CUSTOMER_TEMPLATE_APPROVAL_REQUIRED';}catch(error){if(!(error instanceof WorkspaceError))throw error;reasonCode=error.code;}
     const pending=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'workerId'=$2 AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN') LIMIT 1`,[project.id,worker.id])).rows[0];
     if(pending)reasonCode='META_CUSTOMER_TEMPLATE_SEND_PENDING';
     records.push({workerId:worker.id,name:worker.name,eligible:reasonCode===null,reasonCode});
    }
    const recentRows=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'organizationId'=$2 AND outcome->>'actorId'=$3 ORDER BY "createdAt" DESC,id DESC LIMIT 20`,[project.id,member.organizationId,member.actorId])).rows;
    const canSend=!!approved&&records.some(row=>row.eligible);
    return {scope,projectId:project.id,projectName:project.name,canSend,template:{key:CUSTOMER_MANUAL_TEMPLATE,title:definition.title,bodyText:definition.bodyText.replace('{{1}}',project.name),providerStatus:approved?'APPROVED':null,canSend},records,recent:recentRows.map(row=>publicCustomerTemplateSend(row,{scope,projectId:project.id})),truncated:workers.length>20};
   });
  },
  async send(session,raw){
   const body=validateCustomerTemplateSend(raw),bodyDigest=digest(body);let recipient,previous;
   const claim=await within(session,body,true,async(client,member,scope,project)=>{
    const id=customerTemplateSendId(member.actorId,project.id,body.operationId),prior=await existing(client,id,project.id,member.actorId,member.organizationId,true);
    if(prior){if(prior.payload.bodyDigest!==bodyDigest)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_CONFLICT',409);return {done:publicCustomerTemplateSend(prior,{scope,projectId:project.id})};}
    const readiness=provider.readiness();if(!readiness.canLaunchMeta)throw new WorkspaceError('META_CUSTOMER_CONFIGURATION_PENDING',503);
    const connection=recipient.connection;
    if(recipient.kind!=='TEMPLATE_RECIPIENT_VERIFIED'||recipient.worker.id!==body.workerId||recipient.project.id!==project.id||connection.projectId!==project.id||!customerChannelActive(connection,now()))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_RECIPIENT_REQUIRED',403);
    const attendance=await customerOpenAttendance(client,project.id,body.workerId),approved=approvedDefinition(connection,project);
    const pending=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND "eventType"='template' AND payload->>'workerId'=$2 AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN') LIMIT 1 FOR UPDATE`,[project.id,body.workerId])).rows[0];
    if(pending)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_PENDING',409);
    const message={name:approved.definition.name,language:approved.definition.language,bodyParameters:[project.name]};customerTemplateMessage(message);
    const request={version:1,purpose:'worksite-operational-templates',operationId:body.operationId,bodyDigest,channelId:connection.id,organizationId:member.organizationId,to:recipient.worker.phone.slice(1),message,attendance,channelClaim:channelClaim(connection,project),recipientClaim:recipientClaim(recipient),templateClaim:digest(approved)};
    const reservation=await reserveCustomerOutbound(client,{id,projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,request,eventType:'template',payloadFields:{operationId:body.operationId,bodyDigest,workerId:body.workerId,templateKey:body.templateKey},environment,now:now()});
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.template_send.reserved','WebhookEvent',$4,$5::jsonb)`,['meta_template_send_'+digest([id]),member.organizationId,member.actorId,id,JSON.stringify({version:1,projectId:project.id,operationId:body.operationId,workerId:body.workerId,templateKey:body.templateKey,outboundId:id,requestDigest:reservation.requestDigest,attendanceId:attendance.id,attendanceRevision:attendance.revision})]);
    return {...reservation,projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,scope,request,approved,token:credential(connection,member.organizationId,environment),phoneNumberId:connection.phoneNumberId,wabaId:connection.whatsappBusinessId};
   },async(client,member)=>{
    previous=await existing(client,customerTemplateSendId(member.actorId,body.projectId,body.operationId),body.projectId,member.actorId,member.organizationId);
    if(!previous)recipient=await resolveRecipient(client,{organizationId:member.organizationId,projectId:body.projectId,workerId:body.workerId,permission:'attendance',environment});
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
     const connection=recipient.connection,attendance=await customerOpenAttendance(client,project.id,body.workerId),approved=approvedDefinition(connection,project);
     if(channelClaim(connection,project)!==claim.request.channelClaim||recipientClaim(recipient)!==claim.request.recipientClaim||digest(approved)!==claim.request.templateClaim||digest(attendance)!==digest(claim.request.attendance)||project.name!==claim.request.message.bodyParameters[0])throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SEND_STATE_CHANGED',409);
     const updated=await client.query(`UPDATE public."WebhookEvent" SET outcome=outcome||$4::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3`,[claim.id,project.id,claim.leaseToken,JSON.stringify({dispatchStartedAt:new Date(now()).toISOString()})]);
     if(updated.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
    },async(client,member)=>{recipient=await resolveRecipient(client,{organizationId:member.organizationId,projectId:body.projectId,workerId:body.workerId,permission:'attendance',environment});});
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
