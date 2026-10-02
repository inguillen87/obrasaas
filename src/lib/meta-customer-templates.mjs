import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {assertTemplateReviewDefinition,TemplateReviewError} from './whatsapp/template-review-policy.js';
const blueprints=Object.freeze({
 participant_invitation:{title:'Invitación a participar',text:'Tenés una invitación para participar en una obra de {{1}}. Abrí tu cuenta de ObraSaaS para consultar la invitación y decidir si querés aceptarla: https://obrasaas.com/cuenta',example:'Constructora de ejemplo'},
 field_evidence_request:{title:'Pedido de información de obra',text:'Tenés un pedido de información pendiente en {{1}}. Abrí tu cuenta de ObraSaaS para consultar el detalle y aportar la evidencia solicitada: https://obrasaas.com/cuenta',example:'Obra de ejemplo'},
 progress_review_notification:{title:'Avance pendiente de revisión',text:'Hay una propuesta de avance pendiente de revisión en {{1}}. Abrí tu cuenta de ObraSaaS para consultar la evidencia y registrar tu decisión: https://obrasaas.com/cuenta',example:'Obra de ejemplo'},
});
export function buildCustomerTemplate(connection,blueprintKey){
 const blueprint=blueprints[blueprintKey];if(!blueprint)throw new WorkspaceError('META_CUSTOMER_TEMPLATE_INVALID');
 const language='es_AR',category='UTILITY',components=[{type:'BODY',text:blueprint.text,example:{body_text:[[blueprint.example]]}}];
 const contentSha256=digest({language,category,components}),binding=digest([connection.id,connection.whatsappBusinessId]).slice(0,10);
 return {blueprintKey,title:blueprint.title,name:`obrasaas_${blueprintKey}_${binding}_${contentSha256.slice(0,10)}`,language,category,components,contentSha256,bodyText:blueprint.text};
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
