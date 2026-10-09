import {WorkspaceError,operationId,digest,workspaceId} from './workspace-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {assertTemplateReviewDefinition,TemplateReviewError} from './whatsapp/template-review-policy.mjs';
const blueprints=Object.freeze({
 open_attendance_reminder:{title:'Recordatorio de jornada abierta',text:'Tu jornada en {{1}} sigue abierta. Cuando termines, registrá la salida en ObraSaaS: https://obrasaas.com/cuenta',example:'Obra de ejemplo'},
 participant_invitation:{title:'Invitación a participar',text:'Tenés una invitación para participar en una obra de {{1}}. Abrí tu cuenta de ObraSaaS para consultar la invitación y decidir si querés aceptarla: https://obrasaas.com/cuenta',example:'Constructora de ejemplo'},
 participant_onboarding_v1:{title:'Invitación y presentación de identidad',text:'{{1}} te invita a su equipo en ObraSaaS. Aceptá la invitación que recibiste por correo electrónico y entrá a tu cuenta: {{2}}. Para presentar tu documento y selfie, copiá y enviá {{3}} en este chat. Un responsable revisará tu identidad antes de habilitar tu acceso a la obra.',examples:['Constructora de ejemplo','https://obrasaas.com/cuenta?participar=invite_00000000000000000000000000000000','IDENTIDAD AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']},
 field_evidence_request:{title:'Pedido de información de obra',text:'Tenés un pedido de información pendiente en {{1}}. Abrí tu cuenta de ObraSaaS para consultar el detalle y aportar la evidencia solicitada: https://obrasaas.com/cuenta',example:'Obra de ejemplo'},
 progress_review_notification:{title:'Avance pendiente de revisión',text:'Hay una propuesta de avance pendiente de revisión en {{1}}. Abrí tu cuenta de ObraSaaS para consultar la evidencia y registrar tu decisión: https://obrasaas.com/cuenta',example:'Obra de ejemplo'},
});
export function customerTemplateBlueprint(key){if(!Object.hasOwn(blueprints,key))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');const value=blueprints[key];return {title:value.title,bodyText:value.text};}
export function buildCustomerTemplate(connection,blueprintKey){
 if(!Object.hasOwn(blueprints,blueprintKey))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');const blueprint=blueprints[blueprintKey];
 const language='es_AR',category='UTILITY',components=[{type:'BODY',text:blueprint.text,example:{body_text:[blueprint.examples?[...blueprint.examples]:[blueprint.example]]}}];
 const contentSha256=digest({language,category,components}),binding=digest([connection.id,connection.whatsappBusinessId]).slice(0,10);
 return {blueprintKey,title:blueprint.title,name:`obrasaas_${blueprintKey}_${binding}_${contentSha256.slice(0,10)}`,language,category,components,contentSha256,bodyText:blueprint.text};
}
// Produces only the owned, versioned onboarding message. It does not establish
// template approval, contact consent, delivery, KYC or operational permission.
export function buildParticipantOnboardingMessage(connection,input){
 if(!workspaceId(connection?.id)||/\s/.test(connection.id)||typeof connection.whatsappBusinessId!=='string'||!/^[1-9]\d{4,31}$/.test(connection.whatsappBusinessId)||/\D/.test(connection.whatsappBusinessId)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!=='code|invitationId|organizationName'||typeof input.organizationName!=='string'||!input.organizationName.trim()||input.organizationName.length>160||/[\u0000-\u001f\u007f<>]/.test(input.organizationName)||typeof input.invitationId!=='string'||input.invitationId.length!==39||!/^invite_[a-f0-9]{32}$/.test(input.invitationId)||typeof input.code!=='string'||input.code.length!==53||!/^IDENTIDAD [A-Za-z0-9_-]{43}$/.test(input.code))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_MESSAGE_INVALID');
 const definition=buildCustomerTemplate(connection,'participant_onboarding_v1');
 return {name:definition.name,language:definition.language,bodyParameters:[input.organizationName,'https://obrasaas.com/cuenta?participar='+input.invitationId,input.code]};
}
export function customerRemoteTemplateMatches(remote,definition){
 if(!remote||remote.name!==definition.name||remote.language?.replace('-','_')!==definition.language||!/^\d{5,32}$/.test(String(remote.id)))return false;
 if(!Array.isArray(remote.components)||remote.components.length!==1||String(remote.components[0].type).toUpperCase()!=='BODY'||remote.components[0].text?.trim()!==definition.bodyText)return false;
 return /^[A-Z_]{2,40}$/.test(remote.status||'')&&/^[A-Z_]{2,40}$/.test(remote.category||'');
}
const publicDraft=draft=>({blueprintKey:draft.definition.blueprintKey,title:draft.definition.title,name:draft.definition.name,contentSha256:draft.definition.contentSha256,bodyText:draft.definition.bodyText,language:draft.definition.language,category:draft.definition.category,state:draft.state,providerId:draft.providerId||null,providerStatus:draft.providerStatus||null,providerCategory:draft.providerCategory||null,lastConfirmedObservation:draft.lastConfirmedObservation||null,updatedAt:draft.updatedAt,lastCode:draft.lastCode||null,
 canSubmit:draft.state==='DRAFT',canRecover:['SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].includes(draft.state),canSend:false});
export function publicCustomerTemplateWorkbench(connection){return {options:Object.entries(blueprints).map(([key,value])=>({key,title:value.title})),drafts:Object.values(connection?.metadata?.customerTemplateDrafts||{}).map(publicDraft),sendingAccepted:false};}
export function createMetaCustomerTemplates({workspace,provider,environment=process.env,now=()=>Date.now()}){
 const within=(session,context,writable,run)=>workspace.integrationProject(session,context,writable,run);
 async function connection(client,member,project,lock){
  const result=await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 ${lock?'FOR UPDATE':''}`,[project.id]);
  const row=result.rows[0];if(result.rows.length!==1||row.metadata?.credentialFormat!=='tenant-aad-v2'||row.metadata?.credentialOrganizationId!==member.organizationId)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_CONNECTION_REQUIRED',409);return row;
 }
 function credential(row,member){return decryptCustomerSecret(row.encryptedAccessToken,{organizationId:member.organizationId,projectId:row.projectId,purpose:'access-token',resourceId:row.phoneNumberId},environment);}
 function observed(draft){return draft.lastConfirmedObservation||(draft.providerStatus?{providerId:draft.providerId||null,status:draft.providerStatus,category:draft.providerCategory||null,recordedAt:draft.updatedAt,source:'PREVIOUSLY_RECORDED'}:null);}
 function assertClaim(row,project,current,claim,body){
  if(row.id!==claim.row.id||row.phoneNumberId!==claim.row.phoneNumberId||row.whatsappBusinessId!==claim.row.whatsappBusinessId||row.encryptedAccessToken!==claim.row.encryptedAccessToken||project.metadata?.metaSignup?.id!==body.signupId||row.metadata.customerSignupId!==body.signupId||!current||current.observationRevision!==claim.observationRevision||current.observationOperationId!==body.operationId||current.definition.name!==claim.definition.name||current.definition.contentSha256!==claim.definition.contentSha256)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_STATE_CHANGED',409);
 }
 async function save(client,member,row,draft,body){
  const drafts={...(row.metadata.customerTemplateDrafts||{}),[draft.definition.blueprintKey]:{...draft,updatedAt:new Date(now()).toISOString()}};
  const written=await client.query(`UPDATE public."WhatsAppConnection" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,row.projectId,JSON.stringify({...row.metadata,customerTemplateDrafts:drafts})]);if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_WRITE_UNCONFIRMED',503);
  const receipt='meta_template_'+digest([row.projectId,member.actorId,body.operationId,draft.state]);
  await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'integration.whatsapp.customer_template','WhatsAppConnection',$4,$5::jsonb) ON CONFLICT(id) DO NOTHING`,[receipt,member.organizationId,member.actorId,row.id,JSON.stringify({version:1,projectId:row.projectId,wabaId:row.whatsappBusinessId,blueprintKey:draft.definition.blueprintKey,contentSha256:draft.definition.contentSha256,state:draft.state,providerId:draft.providerId||null,requestDigest:digest(body)})]);
  row.metadata={...row.metadata,customerTemplateDrafts:drafts};return drafts[draft.definition.blueprintKey];
 }
 return {async command(session,body){
  const base=['action','operationId','projectId','scope','signupId'],fields=body?.action==='submit_template'?[...base,'review']:[...base,'blueprintKey'];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!==fields.sort().join('|')||!operationId(body.operationId))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');
  const key=body.action==='submit_template'?body.review?.blueprintKey:body.blueprintKey;
  if(!Object.hasOwn(blueprints,key)||!['prepare_template','submit_template','recover_template'].includes(body.action))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');
  const claim=await within(session,body,true,async(client,member,_scope,project)=>{
   const receiptIds=['DRAFT','SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].map(state=>'meta_template_'+digest([project.id,member.actorId,body.operationId,state]));
   const receipts=await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=ANY($1::text[]) AND "organizationId"=$2 AND "actorId"=$3 AND action='integration.whatsapp.customer_template'`,[receiptIds,member.organizationId,member.actorId]);
   if(receipts.rows.some(row=>row.metadata.requestDigest!==digest(body)))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_OPERATION_CONFLICT',409);
   const row=await connection(client,member,project,true);
   if(project.metadata?.metaSignup?.id!==body.signupId||row.metadata.customerSignupId!==body.signupId)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SCOPE_REJECTED',409);
   const definition=buildCustomerTemplate(row,key),current=row.metadata.customerTemplateDrafts?.[key];
   if(body.action==='prepare_template'){
    if(current){if(current.definition.contentSha256!==definition.contentSha256)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_VERSION_REVIEW',409);return {replayed:true,row};}
    await save(client,member,row,{definition,state:'DRAFT',preparedBy:member.actorId,createdAt:new Date(now()).toISOString()},body);return {replayed:true,row};
   }
   if(!current||current.definition.contentSha256!==definition.contentSha256||current.definition.name!==definition.name)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_VERSION_REVIEW',409);
   if(body.action==='submit_template'){
    try{assertTemplateReviewDefinition(body.review,definition);}catch(error){if(error instanceof TemplateReviewError)throw new WorkspaceError(error.code,error.status);throw error;}
    if(current.state!=='DRAFT')return {replayed:true,row};
   }else if(!['SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].includes(current.state))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_RECOVERY_UNAVAILABLE',409);
   const revision=current.observationRevision??0;if(!Number.isSafeInteger(revision)||revision<0||revision>=Number.MAX_SAFE_INTEGER)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_VERSION_REVIEW',409);
   const observationRevision=revision+1;
   await save(client,member,row,{...current,state:body.action==='submit_template'?'SUBMISSION_STARTED':'SUBMISSION_UNKNOWN',...(body.action==='submit_template'?{submissionOperationId:body.operationId}:{}),observationRevision,observationOperationId:body.operationId,lastCode:null,lastConfirmedObservation:observed(current),providerStatus:null,providerCategory:null},body);
   return {row,definition,observationRevision,token:credential(row,member),canCreate:body.action==='submit_template'};
  });
  if(claim.replayed)return {workbench:publicCustomerTemplateWorkbench(claim.row)};
  let remote,code=null;
  try{
   remote=await provider.findTemplate({token:claim.token,wabaId:claim.row.whatsappBusinessId,name:claim.definition.name});
   if(remote&&!customerRemoteTemplateMatches(remote,claim.definition))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_OWNERSHIP_CONFLICT',409);
   if(!remote&&claim.canCreate){
    await within(session,body,true,async(client,member,_scope,project)=>{
     const row=await connection(client,member,project,true),current=row.metadata.customerTemplateDrafts?.[key];
     assertClaim(row,project,current,claim,body);
     if(current.state!=='SUBMISSION_STARTED'||current.submissionOperationId!==body.operationId)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_STATE_CHANGED',409);
     await save(client,member,row,{...current,remoteMutationAuthorizedAt:new Date(now()).toISOString()},body);
    });
    await provider.createTemplate({token:claim.token,wabaId:claim.row.whatsappBusinessId,definition:claim.definition});remote=await provider.findTemplate({token:claim.token,wabaId:claim.row.whatsappBusinessId,name:claim.definition.name});
   }
   if(!remote||!customerRemoteTemplateMatches(remote,claim.definition))throw new WorkspaceError('META_CUSTOMER_TEMPLATE_SUBMISSION_UNCONFIRMED',503);
  }catch(error){code=error instanceof WorkspaceError?error.code:'META_CUSTOMER_TEMPLATE_SUBMISSION_UNCONFIRMED';}
  return within(session,body,true,async(client,member,_scope,project)=>{
   const row=await connection(client,member,project,true),current=row.metadata.customerTemplateDrafts?.[key];
   assertClaim(row,project,current,claim,body);
   await save(client,member,row,{...current,state:code?'SUBMISSION_UNKNOWN':'SUBMITTED',lastCode:code,providerId:code?current.providerId:String(remote.id),providerStatus:code?null:remote.status,providerCategory:code?null:remote.category,lastConfirmedObservation:code?current.lastConfirmedObservation:{providerId:String(remote.id),status:remote.status,category:remote.category,recordedAt:new Date(now()).toISOString(),source:'PROVIDER_READBACK'}},body);
   return {workbench:publicCustomerTemplateWorkbench(row)};
  });
 }};
}
