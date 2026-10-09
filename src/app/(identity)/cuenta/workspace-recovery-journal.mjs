import {createBrowserRecoveryStorage} from './workspace-recovery-storage.mjs';
import {PRIVATE_BANK_ACTIONS,validatePrivateBankOutcome} from './private-bank-account-format.mjs';
import {purchaseOutcome} from './site-purchase-view.mjs';
import {companyChannelOutcome,COMPANY_CHANNEL_ACTIONS} from './company-channel-view.mjs';
import {ownCompanyNumberOutcome,OWN_COMPANY_ACTIONS} from './own-company-number-view.mjs';

// Receipt references only. Never persist commands, tokens, files, location or messages.
export const RECOVERY_EVENT = 'obrasaas:pending-receipts';
export const WORKSPACE_RECOVERY_PREFIX = 'obrasaas.pending-receipt.v1.';
const prefix = WORKSPACE_RECOVERY_PREFIX;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const channelReferenceValid=(action,connectionId)=>OWN_COMPANY_ACTIONS.includes(action)?(id(connectionId)||action==='CONNECT_OWN_NUMBER'&&connectionId===null):COMPANY_CHANNEL_ACTIONS.includes(action)&&id(connectionId);
const PROGRESS_TEMPLATE_SEND_KEY='progress_review_notification';
export const FIELD_OVERTIME_RECOVERY_ACTIONS=Object.freeze(['CONFIGURE_OVERTIME','PROPOSE_OVERTIME','DECIDE_OVERTIME']);
export const PARTICIPANT_INTAKE_RECOVERY_ACTIONS=Object.freeze(['CONFIGURE_EMPLOYEE_INTAKE','ADMIT_EMPLOYEE_INTAKE','REJECT_EMPLOYEE_INTAKE']);
const templateSendActionReference=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='proposalId|revision'&&id(value.proposalId)&&typeof value.revision==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision));
const scopeValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const PROJECT_PREPARATION_SNAPSHOT_KEYS=Object.freeze(['scope','projectId','canManage','revision','detailsDigest','name','clientName','address','teams','slots','startStatus','declarationOnly']);
export function projectPreparationReceiptOutcome(value,reference){
 const exact=fields=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...fields].sort().join('|');
 if(!scopeValid(value?.scope)||value.scope!==reference?.scope||value.projectId!==reference?.projectId||!id(value.projectId)||value.operationId!==reference?.operationId||!uuid(value.operationId)||value.action!=='SAVE_PREPARATION')return null;
 if(value.state==='NOT_OBSERVED')return exact(['scope','projectId','operationId','action','state','saved','definitive'])&&value.saved===false&&value.definitive===false?{state:'NOT_OBSERVED'}:null;
 if(value.state==='CANCELLED')return exact(['scope','projectId','operationId','action','state','saved','definitive','receiptId','projectUpdated'])&&value.saved===false&&value.definitive===true&&value.projectUpdated===false&&/^project_preparation_[a-f0-9]{64}$/.test(value.receiptId||'')?{state:'CANCELLED',receiptId:value.receiptId}:null;
 const fields=['state','saved','replayed','receiptId','operationId','action','savedRevision','savedPreparationIsCurrent'];
 if(!exact([...PROJECT_PREPARATION_SNAPSHOT_KEYS,...fields])||value.state!=='RECORDED'||value.saved!==true||typeof value.replayed!=='boolean'||!/^project_preparation_[a-f0-9]{64}$/.test(value.receiptId||'')||!Number.isSafeInteger(value.revision)||value.revision<1||value.revision>2147483647||!Number.isSafeInteger(value.savedRevision)||value.savedRevision<1||value.savedRevision>value.revision||typeof value.savedPreparationIsCurrent!=='boolean'||value.savedPreparationIsCurrent!==(value.savedRevision===value.revision)||value.canManage!==true||!scopeValid(value.detailsDigest)||typeof value.name!=='string'||typeof value.clientName!=='string'||typeof value.address!=='string'||!Array.isArray(value.teams)||value.teams.length>20||!Array.isArray(value.slots)||value.slots.length>50||value.startStatus!=='TO_CONFIRM'||value.declarationOnly!==true)return null;
 return {state:'RECORDED',receiptId:value.receiptId};
}
const planDecisionCodes=Object.freeze(['PLAN_IMPORT_ROWS_LIMIT','PLAN_IMPORT_ROWS_INVALID','PLAN_IMPORT_DATES_INVALID','PLAN_IMPORT_DUPLICATE_ROWS','PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_SCHEDULE_CHANGED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE']);
const planUploadCodes=Object.freeze(['PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE']);
const sha256=async bytes=>[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const canonicalPlanCommand=value=>Array.isArray(value)?value.map(canonicalPlanCommand):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalPlanCommand(value[key])])):value;
export async function planImportCommandDigest(body){
 const bytes=new TextEncoder().encode(JSON.stringify(['plan-import-command-v1',canonicalPlanCommand({...body,operationId:body.operationId.toLowerCase()})]));
 return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function planImportUploadDigest({scope,projectId,operationId,consent,source}){
 const spreadsheet=['application/vnd.ms-excel.sheet.macroenabled.12','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(source?.contentType);
 if(!scopeValid(scope)||!id(projectId)||!uuid(operationId)||!(spreadsheet?['plan-spreadsheet-monthly-rubros-v1','plan-spreadsheet-cyp-partidas-v2'].includes(consent):consent==='plan-document-openai-v1')||!source||!Number.isSafeInteger(source.bytes)||source.bytes<1||source.bytes>3*1024*1024||!['application/pdf','image/png','image/jpeg','image/webp','application/vnd.ms-excel.sheet.macroenabled.12','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(source.contentType)||!/^[a-f0-9]{64}$/.test(source.sha256||''))throw unavailable();
 return sha256(new TextEncoder().encode(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent,operationId:operationId.toLowerCase(),projectId,scope,source:{bytes:source.bytes,contentType:source.contentType,sha256:source.sha256}}])));
}
export async function planImportUploadFormDigest(form){
 const file=form?.get?.('file');if(!file||typeof file.arrayBuffer!=='function'||!Number.isSafeInteger(file.size)||file.size<1||file.size>3*1024*1024)throw unavailable();
 const source={bytes:file.size,contentType:String(file.type||'').split(';')[0].toLowerCase().trim(),sha256:await sha256(await file.arrayBuffer())};
 return planImportUploadDigest({scope:form.get('scope'),projectId:form.get('projectId'),operationId:form.get('operationId'),consent:form.get('consent'),source});
}
export const RECOVERY_RESOURCES = Object.freeze({
  workspace:'Planificación', 'task-creation':'Nueva tarea', 'site-register':'Registro de obra',
  'site-photo':'Fotografía privada', participants:'Participantes e identidad',
  'field-operations':'Operación de campo', 'field-media':'Evidencia privada',
  'site-purchases':'Compra o recepción', 'whatsapp-setup':'Preparación de WhatsApp',
  'meta-onboarding':'Seguimiento de WhatsApp', 'worker-channel':'Mi WhatsApp y autorización de avisos',
  'template-send':'Aviso autorizado por WhatsApp',
  'constructor-crm':'Cliente u oportunidad de la empresa',
  'demo-pilot':'Preparación y vinculación del piloto DEMO',
  'plan-import':'Importación de cronograma',
  'project-preparation':'Preparación de la obra',
  'company-channel':'Canal de la empresa y obras',
  'company-onboarding':'Número declarado de la empresa',
});
const failure = (code, message) => Object.assign(new Error(message), {code,status:409,requestDispatched:false});
const unavailable = () => failure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE','No se pudo conservar la referencia del intento en este navegador. Habilitá el almacenamiento y volvé a intentar; la operación no se envió.');
function resourceOf(url) {
  if(typeof url!=='string') return null;
  const found = /^\/api\/identity\/([a-z-]+)(?:\?.*)?$/.exec(url);
  return found && Object.hasOwn(RECOVERY_RESOURCES,found[1]) ? found[1] : null;
}
async function reference(url, options, now) {
  if(options?.method?.toUpperCase()!=='POST')return null;
  const resource=resourceOf(url);if(!resource||url.includes('?'))return null;
  let body;
  if(typeof options.body==='string'){try{body=JSON.parse(options.body);}catch{return null;}}
  else if(typeof options.body?.get==='function') body=Object.fromEntries(['operationId','projectId','scope','action','reportId','eventId'].map(key=>[key,options.body.get(key)]));
  if(!body||!uuid(body.operationId)||!id(body.projectId)||!scopeValid(body.scope))return null;
  if(resource==='project-preparation'&&!['SAVE_PREPARATION','CANCEL_PENDING_PREPARATION'].includes(body.action))throw unavailable();
  if(resource==='company-onboarding'&&(body.action!=='declare_company_phone'||!id(body.expectedClerkOrganizationId)))throw unavailable();
  if(resource==='site-photo'&&!id(body.reportId))return null;
  const channelAction=body.action==='RECOVER_CONNECT_OWN_NUMBER'&&body.payload?.connectionId===null&&body.payload?.confirmRecovery===true?'CONNECT_OWN_NUMBER':body.action;
  if(resource==='company-channel'&&!channelReferenceValid(channelAction,body.payload?.connectionId))throw unavailable();
  // Invitation reconciliation reads the provider and finalizes the original
  // invitation's receipt; it never creates a second invitation.
  if(resource==='participants'&&body.action==='RECOVER_INVITATION')return null;
  if(resource==='meta-onboarding'&&(body.action==='cancel'?(!uuid(body.signupId)||body.confirmLocalClosure!==true):body.action==='reconcile'?(!uuid(body.signupId)||!Number.isSafeInteger(body.expectedCompanyPhoneRevision)||body.expectedCompanyPhoneRevision<1||body.confirmCompanyPhoneRevision!==true):(!['review_inbox','process_inbox'].includes(body.action)||!id(body.eventId))))return null;
  const bank=resource==='participants'&&(PRIVATE_BANK_ACTIONS.includes(body.action)||body.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT');
  const bankAction=body.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'?body.payload?.originalAction:body.action;
  if(bank&&(!PRIVATE_BANK_ACTIONS.includes(bankAction)||!id(body.payload?.workerId)))throw unavailable();
  const progress=resource==='template-send'&&body.templateKey===PROGRESS_TEMPLATE_SEND_KEY;
  const overtime=resource==='field-operations'&&FIELD_OVERTIME_RECOVERY_ACTIONS.includes(body.action);
  const intake=resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(body.action);
  const plan=resource==='plan-import'&&typeof options.body==='string'&&['EDIT','APPLY','REJECT'].includes(body.action)&&id(body.draftId)&&Number.isSafeInteger(body.expectedRevision)&&body.expectedRevision>=1;
  const planUpload=resource==='plan-import'&&typeof options.body?.get==='function';
  let inputDigest;try{if(plan)inputDigest=await planImportCommandDigest(body);else if(planUpload)inputDigest=await planImportUploadFormDigest(options.body);}catch{throw unavailable();}
  if(intake&&(!id(body.payload?.connectionId)||body.action!=='CONFIGURE_EMPLOYEE_INTAKE'&&!/^customer_webhook_[a-f0-9]{64}$/.test(body.payload?.applicationId||'')))throw unavailable();
  if(progress&&(!id(body.workerId)||!templateSendActionReference(body.actionReference)))throw unavailable();
  return {version:1,resource,scope:body.scope,projectId:body.projectId,operationId:body.operationId.toLowerCase(),createdAt:now,
    ...(resource==='site-photo'?{reportId:body.reportId}:{}),
    ...(resource==='company-onboarding'?{action:body.action,expectedClerkOrganizationId:body.expectedClerkOrganizationId}:{}),
    ...(resource==='company-channel'?{action:channelAction,connectionId:body.payload.connectionId}:{}),
    ...(resource==='meta-onboarding'?{action:body.action,...(['reconcile','cancel'].includes(body.action)?{signupId:body.signupId}:{eventId:body.eventId})}:{}),
    ...(overtime?{action:body.action}:{}),
    ...(bank?{action:bankAction,workerId:body.payload.workerId}:{}),
    ...(intake?{action:body.action,connectionId:body.payload.connectionId,...(body.action==='CONFIGURE_EMPLOYEE_INTAKE'?{}:{applicationId:body.payload.applicationId})}:{}),
    ...(progress?{templateKey:PROGRESS_TEMPLATE_SEND_KEY,workerId:body.workerId,actionReference:{proposalId:body.actionReference.proposalId,revision:body.actionReference.revision}}:{}),
    ...(plan?{action:body.action,draftId:body.draftId,expectedRevision:body.expectedRevision,inputDigest}:{}),
    ...(planUpload?{action:'UPLOAD',inputDigest}:{}),
    ...(resource==='project-preparation'?{action:'SAVE_PREPARATION'}:{}),
  };
}
function valid(entry) {
  if(!entry||entry.version!==1||!Object.hasOwn(RECOVERY_RESOURCES,entry.resource)||!scopeValid(entry.scope)||!id(entry.projectId)||!uuid(entry.operationId)||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<0)return false;
  const progress=entry.resource==='template-send'&&entry.templateKey===PROGRESS_TEMPLATE_SEND_KEY;
  const overtime=entry.resource==='field-operations'&&entry.action!==undefined;
  const bank=entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action);
  const intake=entry.resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action);
  const plan=entry.resource==='plan-import'&&entry.action!==undefined;
  const planUpload=plan&&entry.action==='UPLOAD';
  const preparation=entry.resource==='project-preparation';
  if(entry.resource==='participants'&&entry.action!==undefined&&!bank&&!intake)return false;
  if(preparation&&entry.action!=='SAVE_PREPARATION')return false;
  const fields=['version','resource','scope','projectId','operationId','createdAt',...(entry.resource==='site-photo'?['reportId']:[]),...(entry.resource==='company-onboarding'?['action','expectedClerkOrganizationId']:[]),...(entry.resource==='company-channel'?['action','connectionId']:[]),...(entry.resource==='meta-onboarding'?['action',['reconcile','cancel'].includes(entry.action)?'signupId':'eventId']:[]),...(overtime?['action']:[]),...(bank?['action','workerId']:[]),...(intake?['action','connectionId',...(entry.action==='CONFIGURE_EMPLOYEE_INTAKE'?[]:['applicationId'])]:[]),...(progress?['templateKey','workerId','actionReference']:[]),...(planUpload?['action','inputDigest']:plan?['action','draftId','expectedRevision','inputDigest']:[]),...(preparation?['action']:[])];
  if(Object.keys(entry).sort().join('|')!==fields.sort().join('|'))return false;
  if(entry.resource==='company-onboarding'&&(entry.action!=='declare_company_phone'||!id(entry.expectedClerkOrganizationId)))return false;
  if(entry.resource==='company-channel'&&!channelReferenceValid(entry.action,entry.connectionId))return false;
  if(progress&&(!id(entry.workerId)||!templateSendActionReference(entry.actionReference)))return false;
  if(planUpload&&!/^[a-f0-9]{64}$/.test(entry.inputDigest||''))return false;
  if(plan&&!planUpload&&(!['EDIT','APPLY','REJECT'].includes(entry.action)||!id(entry.draftId)||!Number.isSafeInteger(entry.expectedRevision)||entry.expectedRevision<1||!/^[a-f0-9]{64}$/.test(entry.inputDigest||'')))return false;
  if(overtime&&!FIELD_OVERTIME_RECOVERY_ACTIONS.includes(entry.action))return false;
  if(bank&&(!PRIVATE_BANK_ACTIONS.includes(entry.action)||!id(entry.workerId)))return false;
  if(intake&&(!PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action)||!id(entry.connectionId)||entry.action!=='CONFIGURE_EMPLOYEE_INTAKE'&&!/^customer_webhook_[a-f0-9]{64}$/.test(entry.applicationId||'')))return false;
  return (entry.resource!=='site-photo'||id(entry.reportId))&&(entry.resource!=='meta-onboarding'||(['reconcile','cancel'].includes(entry.action)?uuid(entry.signupId):['review_inbox','process_inbox'].includes(entry.action)&&id(entry.eventId)));
}
const keyOf=entry=>prefix+entry.scope+'.'+entry.resource+'.'+entry.operationId;
export function validateWorkspaceRecoveryStoredEntry(key,raw) {
  let entry;
  try {
    if(typeof key!=='string'||typeof raw!=='string'||raw.length>2048)throw unavailable();
    entry=JSON.parse(raw);
    if(!valid(entry)||key!==keyOf(entry))throw unavailable();
  } catch { throw unavailable(); }
  return entry;
}
export function recoveryQuery(entry) {
  if(!valid(entry))throw new TypeError('Invalid receipt reference');
  return '/api/identity/'+entry.resource+'?'+new URLSearchParams({projectId:entry.projectId,scope:entry.scope,operationId:entry.operationId,
    ...(entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action)?{detail:'private-bank-account',workerId:entry.workerId,action:entry.action}:{}),
    ...(entry.resource==='company-onboarding'?{action:entry.action,expectedClerkOrganizationId:entry.expectedClerkOrganizationId}:{}),
    ...(entry.resource==='site-photo'?{reportId:entry.reportId}:{}),...(entry.resource==='meta-onboarding'?{action:entry.action,...(['reconcile','cancel'].includes(entry.action)?{signupId:entry.signupId}:{eventId:entry.eventId})}:{})});
}
export function recoveryResult(entry, result) {
  if(!valid(entry)||result?.scope!==entry.scope)return null;
  if(result.projectId!==undefined&&result.projectId!==entry.projectId)return null;
  if(entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action)){try{validatePrivateBankOutcome(result,entry);return {state:result.state,...(result.receipt?{receiptId:result.receipt.id}:{})};}catch{return null;}}
  if(entry.resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action)){
    const exact=result.projectId===entry.projectId&&result.operationId===entry.operationId&&result.action===entry.action&&result.connectionId===entry.connectionId&&result.applicationId===(entry.applicationId||null)&&/^participant_[a-f0-9]{64}$/.test(result.receiptId||'')&&result.permissionsGranted===false;
    if(exact&&result.state==='RECORDED'&&result.saved===true)return {state:'RECORDED',receiptId:result.receiptId};
    if(exact&&result.state==='REJECTED'&&result.saved===false&&result.definitive===true&&result.phase==='PRE_RECORD'&&result.code==='EMPLOYEE_INTAKE_REVISION_CHANGED'&&!result.workerId&&!result.personReceiptId)return {state:'REJECTED',receiptId:result.receiptId};
    if(result.state==='NOT_OBSERVED'&&result.definitive===false&&result.saved!==true&&!result.receiptId&&!result.receipt)return {state:'NOT_OBSERVED'};return null;
  }
  if(entry.resource==='company-onboarding'){
    if(result.projectId!==entry.projectId||result.operationId!==entry.operationId||result.action!==entry.action||result.expectedClerkOrganizationId!==entry.expectedClerkOrganizationId)return null;
    if(result.state==='RECORDED'&&result.saved===true&&/^company_phone_[a-f0-9]{64}$/.test(result.receipt?.id||'')&&Number.isSafeInteger(result.receipt.savedRevision)&&result.receipt.savedRevision>=1&&typeof result.savedDeclarationIsCurrent==='boolean'&&id(result.organizationId)&&result.currentCompany?.organizationId===result.organizationId&&result.currentCompany?.expectedClerkOrganizationId===entry.expectedClerkOrganizationId)return {state:'RECORDED',receiptId:result.receipt.id};
    if(result.state==='NOT_OBSERVED'&&result.definitive===false&&result.saved!==true&&!result.receipt)return {state:'NOT_OBSERVED'};return null;
  }
  if(entry.resource==='field-operations' &&FIELD_OVERTIME_RECOVERY_ACTIONS.includes(entry.action)){
    if(result.projectId!==entry.projectId||result.operationId!==entry.operationId)return null;
    if(result.state==='RECORDED'&&result.saved===true&&result.action===entry.action&&/^field_[a-f0-9]{64}$/.test(result.receiptId||''))return {state:'RECORDED',receiptId:result.receiptId};
    if(result.state==='NOT_OBSERVED'&&result.definitive===false&&result.saved!==true&&!result.receiptId&&!result.overtime&&(result.action===undefined||result.action===entry.action))return {state:'NOT_OBSERVED'};
    return null;
  }
  if(entry.resource==='company-channel'){try{(OWN_COMPANY_ACTIONS.includes(entry.action)?ownCompanyNumberOutcome:companyChannelOutcome)(result,entry);return result.state==='RECORDED'||result.state==='REJECTED'?{state:result.state,receiptId:result.receiptId}:{state:result.state};}catch{return null;}}
  if(entry.resource==='project-preparation')return projectPreparationReceiptOutcome(result,entry);
  if(entry.resource==='plan-import') {
    if(result.projectId!==entry.projectId)return null;
    if(result.state==='REJECTED'&&result.proof==='AUDITED_UPLOAD'){
      if(Object.keys(result).sort().join('|')!=='action|code|definitive|inputDigest|operationId|phase|projectId|proof|receiptId|recordedAt|replayed|reservationStarted|saved|scope|state|taskEffects|taskSnapshots|tasks'||entry.action!=='UPLOAD'||result.action!=='UPLOAD'||result.operationId!==entry.operationId||result.inputDigest!==entry.inputDigest||!/^[a-f0-9]{64}$/.test(result.inputDigest||'')||result.saved!==false||result.definitive!==true||result.reservationStarted!==false||result.taskEffects!==false||result.phase!=='PRE_RESERVATION'||!planUploadCodes.includes(result.code)||!/^plan_receipt_[a-f0-9]{64}$/.test(result.receiptId||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt)||!Number.isFinite(Date.parse(result.recordedAt))||new Date(result.recordedAt).toISOString()!==result.recordedAt||!Array.isArray(result.tasks)||result.tasks.length||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length)return null;
      return {state:'REJECTED',phase:'PRE_RESERVATION',proof:'AUDITED_UPLOAD',receiptId:result.receiptId,code:result.code};
    }
    if(result.state==='REJECTED'&&result.phase==='PRE_DECISION'){
      if(Object.keys(result).sort().join('|')!=='action|code|definitive|draftId|expectedRevision|inputDigest|operationId|phase|projectId|receiptId|recordedAt|replayed|saved|scope|state|taskEffects|taskSnapshots|tasks'||result.operationId!==entry.operationId||result.saved!==false||result.definitive!==true||result.taskEffects!==false||!planDecisionCodes.includes(result.code)||!/^plan_receipt_[a-f0-9]{64}$/.test(result.receiptId||'')||!['EDIT','APPLY','REJECT'].includes(result.action)||!id(result.draftId)||!Number.isSafeInteger(result.expectedRevision)||result.expectedRevision<1||!/^[a-f0-9]{64}$/.test(result.inputDigest||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt)||!Number.isFinite(Date.parse(result.recordedAt))||!Array.isArray(result.tasks)||result.tasks.length||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length||entry.action!==undefined&&(result.action!==entry.action||result.draftId!==entry.draftId||result.expectedRevision!==entry.expectedRevision||result.inputDigest!==entry.inputDigest))return null;
      return {state:'REJECTED',phase:'PRE_DECISION',receiptId:result.receiptId,code:result.code};
    }
    if(result.state==='EXPIRED'){
      const draft=result.draft,expiry=draft?.processingExpiresAt;
      if(Object.keys(result).sort().join('|')!=='definitive|draft|operationId|projectId|saved|scope|state'||result.operationId!==entry.operationId||result.saved!==false||result.definitive!==true||!id(draft?.id)||!Number.isSafeInteger(draft.revision)||draft.revision<1||!Array.isArray(draft.rows)||!['UPLOADING','PROCESSING'].includes(draft.status)||draft.processingExpired!==true||typeof expiry!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString()!==expiry||Date.parse(expiry)>Date.now())return null;
      return {state:'EXPIRED',draftId:draft.id};
    }
    if(result.state==='REJECTED'&&result.operationId===entry.operationId&&result.definitive===true&&result.saved===false&&result.reservationStarted===false&&result.phase==='PRE_RESERVATION'&&['PLAN_IMPORT_FILE_INVALID','PLAN_IMPORT_FILE_TOO_LARGE'].includes(result.code)&&Object.keys(result).sort().join('|')==='code|definitive|operationId|phase|projectId|reservationStarted|saved|scope|state')return {state:'REJECTED',code:result.code};
    if(result.state==='NOT_OBSERVED'&&result.definitive===false&&!result.draft&&!result.receiptId)return {state:'NOT_OBSERVED'};
    const draft=result.draft;
    if(!(result.state==='RECORDED'||result.saved===true)||!id(draft?.id)||!Number.isSafeInteger(draft.revision)||draft.revision<1||!Array.isArray(draft.rows)||!['UPLOADING','PROCESSING','READY','FAILED','APPLIED','REJECTED'].includes(draft.status))return null;
    if(result.receiptId!==undefined){
      if(result.saved!==true||!id(result.receiptId)||!['EDIT','APPLY','REJECT'].includes(result.action)||draft.status!==({EDIT:'READY',APPLY:'APPLIED',REJECT:'REJECTED'})[result.action]||!Array.isArray(result.tasks))return null;
      return {state:'RECORDED',receiptId:result.receiptId};
    }
    return ['UPLOADING','PROCESSING'].includes(draft.status)?{state:'PROCESSING'}:{state:'RECORDED',draftId:draft.id};
  }
  if(entry.resource==='demo-pilot') {
    if(result.projectId!==entry.projectId)return null;
    if(result.state==='NOT_OBSERVED'&&result.saved===false&&result.definitive===false&&!result.receipt)return {state:'NOT_OBSERVED'};
    const receipt=result.receipt;
    if(result.state==='RECORDED'&&result.saved===true&&result.identityCertified===false&&result.productionVerified===false&&id(receipt?.id)&&receipt.operationId===entry.operationId&&id(receipt.workerId)&&id(receipt.channelId)&&['PREPARE','REQUEST_CHALLENGE','UNLINK','REVOKE'].includes(receipt.action))return {state:'RECORDED',receiptId:receipt.id};
    return null;
  }
  if(entry.resource==='site-purchases'){
    try{purchaseOutcome(result,entry);return result.state==='RECORDED'?{state:'RECORDED',receiptId:result.receiptId}:{state:'NOT_OBSERVED'};}catch{return null;}
  }
  if(entry.resource==='constructor-crm'){
    if(result.projectId!==entry.projectId)return null;
    if(result.state==='NOT_OBSERVED'&&result.saved===false&&result.definitive===false&&!result.receipt)return {state:'NOT_OBSERVED'};
    const receipt=result.receipt;
    if(result.state==='RECORDED'&&result.saved===true&&result.definitive===true&&id(receipt?.id)&&receipt.operationId===entry.operationId&&id(receipt.accountId)&&['CREATE','UPDATE'].includes(receipt.action)&&Number.isSafeInteger(receipt.revision)&&receipt.revision>=1&&(!result.record||result.record.id===receipt.accountId&&result.record.revision>=receipt.revision))return {state:'RECORDED',receiptId:receipt.id};
    return null;
  }
  if(entry.resource==='template-send') {
    const receipt=result.receipt;
    if(entry.templateKey===PROGRESS_TEMPLATE_SEND_KEY){
      if(result.projectId!==entry.projectId||typeof result.definitive!=='boolean'||typeof result.providerAccepted!=='boolean'||typeof result.deliveryConfirmed!=='boolean')return null;
      if(result.state==='NOT_OBSERVED'&&result.definitive===false&&!result.saved&&!result.providerAccepted&&!result.deliveryConfirmed&&!receipt)return {state:'NOT_OBSERVED'};
      if(receipt?.operationId!==entry.operationId||receipt.workerId!==entry.workerId||typeof receipt.id!=='string'||!receipt.id||receipt.templateKey!==entry.templateKey||!templateSendActionReference(receipt.actionReference)||receipt.actionReference.proposalId!==entry.actionReference.proposalId||receipt.actionReference.revision!==entry.actionReference.revision)return null;
      if(['SEND_STARTED','SEND_UNKNOWN'].includes(result.state)&&result.definitive===false&&!result.saved&&!result.deliveryConfirmed)return {state:'PROCESSING'};
      if(result.state==='REJECTED'&&result.definitive===true&&!result.saved&&!result.providerAccepted&&!result.deliveryConfirmed)return {state:'REJECTED',receiptId:receipt.id};
      if(result.state==='ACCEPTED'&&result.definitive===true&&result.saved===true&&result.providerAccepted===true&&result.deliveryConfirmed===false)return {state:'ACCEPTED',receiptId:receipt.id};
      if(result.state==='STATUS_OBSERVED'&&result.definitive===true&&result.saved===true&&['sent','delivered','read','failed','deleted'].includes(result.providerStatus)&&result.deliveryConfirmed===['delivered','read'].includes(result.providerStatus))return {state:'STATUS_OBSERVED',receiptId:receipt.id};
      return null;
    }
    if(result.state==='NOT_OBSERVED'&&result.definitive===false)return {state:'NOT_OBSERVED'};
    if(receipt?.operationId!==entry.operationId||typeof receipt.id!=='string'||!receipt.id||receipt.templateKey!=='open_attendance_reminder')return null;
    if(['SEND_STARTED','SEND_UNKNOWN'].includes(result.state)&&result.definitive===false)return {state:'PROCESSING'};
    if(result.state==='REJECTED'&&result.definitive===true&&result.providerAccepted===false&&result.deliveryConfirmed===false)return {state:'REJECTED',receiptId:receipt.id};
    if(result.state==='ACCEPTED'&&result.definitive===true&&result.saved===true&&result.providerAccepted===true&&result.deliveryConfirmed===false)return {state:'ACCEPTED',receiptId:receipt.id};
    if(result.state==='STATUS_OBSERVED'&&result.definitive===true&&result.saved===true&&['sent','delivered','read','failed','deleted'].includes(result.providerStatus)&&result.deliveryConfirmed===['delivered','read'].includes(result.providerStatus))return {state:'STATUS_OBSERVED',receiptId:receipt.id};
    return null;
  }
  if(entry.resource==='meta-onboarding'&&entry.action==='cancel'){
    const r=result.localModeClosure;if(r===null)return {state:'NOT_OBSERVED'};
    const fields=['action','operationId','signupId','projectId','scope','state','saved','receiptId','phase','code','closedAt','remoteAuthorizationRevoked','remoteMutationDispatched'];
    if(!r||Object.keys(r).sort().join('|')!==fields.sort().join('|')||r.action!=='cancel'||r.operationId!==entry.operationId||r.signupId!==entry.signupId||r.projectId!==entry.projectId||r.scope!==entry.scope||r.state!=='RECORDED'||r.saved!==true||!/^meta_mode_closure_[a-f0-9]{64}$/.test(r.receiptId||'')||r.phase!=='BEFORE_BINDING'||!['META_CUSTOMER_DEDICATED_PHONE_REQUIRED','META_CUSTOMER_EXISTING_API_REVIEW_REQUIRED'].includes(r.code)||typeof r.closedAt!=='string'||!Number.isFinite(Date.parse(r.closedAt))||r.remoteAuthorizationRevoked!==false||r.remoteMutationDispatched!==false)return null;
    return {state:'RECORDED',receiptId:r.receiptId};
  }
  if(entry.resource==='meta-onboarding'&&entry.action==='reconcile'){
    const receipt=result.receipt;if(receipt?.action!=='reconcile'||receipt.operationId!==entry.operationId||receipt.signupId!==entry.signupId||receipt.projectId!==entry.projectId||receipt.scope!==entry.scope)return null;
    if(receipt.state==='RECORDED'&&receipt.saved===true&&/^meta_company_phone_[a-f0-9]{64}$/.test(receipt.receiptId||'')&&Number.isSafeInteger(receipt.expectedCompanyPhoneRevision)&&receipt.expectedCompanyPhoneRevision>=1)return {state:'RECORDED',receiptId:receipt.receiptId};
    if(receipt.state==='REJECTED'){
      if(receipt.phase==='BEFORE_BINDING'){
        const fields=['action','operationId','signupId','projectId','scope','state','saved','definitive','receiptId','phase','code','expectedCompanyPhoneRevision'];
        if(Object.keys(receipt).sort().join('|')!==fields.sort().join('|')||receipt.saved!==false||receipt.definitive!==true||!['META_CUSTOMER_DEDICATED_PHONE_REQUIRED','META_CUSTOMER_EXISTING_API_REVIEW_REQUIRED'].includes(receipt.code)||!/^meta_company_phone_[a-f0-9]{64}$/.test(receipt.receiptId||'')||!Number.isSafeInteger(receipt.expectedCompanyPhoneRevision)||receipt.expectedCompanyPhoneRevision<1)return null;
        return {state:'REJECTED',receiptId:receipt.receiptId,phase:receipt.phase,code:receipt.code};
      }
      const fields=['action','operationId','signupId','projectId','scope','state','saved','definitive','receiptId','phase','code','expectedCompanyPhoneRevision','observedCompanyPhoneRevision','effectiveCompanyPhoneRevision'];
      if(Object.keys(receipt).sort().join('|')!==fields.sort().join('|')||receipt.saved!==false||receipt.definitive!==true||receipt.phase!=='BEFORE_PROVIDER'||receipt.code!=='META_CUSTOMER_COMPANY_PHONE_CHANGED'||!/^meta_company_phone_[a-f0-9]{64}$/.test(receipt.receiptId||'')||['expectedCompanyPhoneRevision','observedCompanyPhoneRevision','effectiveCompanyPhoneRevision'].some(key=>!Number.isSafeInteger(receipt[key])||receipt[key]<1)||receipt.expectedCompanyPhoneRevision===receipt.observedCompanyPhoneRevision&&receipt.expectedCompanyPhoneRevision>receipt.effectiveCompanyPhoneRevision)return null;
      return {state:'REJECTED',receiptId:receipt.receiptId};
    }
    if(receipt.state==='NOT_OBSERVED'&&receipt.definitive===false&&!receipt.saved&&!receipt.receiptId)return {state:'NOT_OBSERVED'};return null;
  }
  if(entry.resource==='meta-onboarding') {
    const receipt=result.receipt;
    if(receipt?.operationId!==entry.operationId||receipt.eventId!==entry.eventId||receipt.action!==entry.action)return null;
    if(entry.action==='review_inbox'&&receipt.state==='RECORDED'&&receipt.actorOperationVerified===true&&typeof receipt.receiptId==='string'&&receipt.receiptId)return {state:'RECORDED',receiptId:receipt.receiptId};
    if(entry.action==='process_inbox'&&receipt.state==='EVENT_PROCESSED'&&receipt.eventStatus==='PROCESSED'&&receipt.actorOperationVerified===false)return {state:'EVENT_PROCESSED',receiptId:receipt.businessReceiptId||null};
    return receipt.state==='NOT_OBSERVED'?{state:'NOT_OBSERVED'}:null;
  }
  const receiptId=result.receiptId||result.receipt?.id;
  if(result.state==='RECORDED'&&typeof receiptId==='string'&&receiptId&&(result.saved===true||result.created===true))return {state:'RECORDED',receiptId};
  if(entry.resource==='participants'&&result.state==='INVITATION_UNCONFIRMED'&&result.participant?.status==='REVOKED')return {state:'PARTICIPATION_REVOKED'};
  return ['NOT_OBSERVED','PROCESSING','INVITATION_UNCONFIRMED'].includes(result.state)?{state:result.state}:null;
}
export function createWorkspaceRecoveryJournal({getStorage,withStorage,now=Date.now,notify=()=>{},withLock}) {
  // getStorage is retained only for controlled in-memory tests. The browser uses
  // one transactional adapter; receipt policy remains in this factory.
  const storageOperation=withStorage||((mode,scope,callback,signal)=>{
    if(signal?.aborted)throw new DOMException('La consulta se canceló.','AbortError');
    const value=getStorage?.();if(!value)throw unavailable();return callback(value);
  });
  async function access(mode,scope,callback,signal) {
    try { return await storageOperation(mode,scope,callback,signal); }
    catch(error) {
      if(error?.name==='AbortError'||error?.requestDispatched===false&&['WORKSPACE_RECOVERY_REQUIRED','WORKSPACE_RECOVERY_CONFLICT','WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'].includes(error.code))throw error;
      throw unavailable();
    }
  }
  function readEntries(s,scope) {
    const entries=[];
    for(let i=0;i<s.length;i++){
      const key=s.key(i);if(!key?.startsWith(prefix+scope+'.'))continue;
      const entry=validateWorkspaceRecoveryStoredEntry(key,s.getItem(key));
      if(entry.scope!==scope)throw unavailable();
      entries.push(entry);if(entries.length>64)throw unavailable();
    }
    return entries.sort((a,b)=>a.createdAt-b.createdAt||a.operationId.localeCompare(b.operationId));
  }
  async function list(scope) {
    if(!scopeValid(scope))return [];
    return access('readonly',scope,s=>readEntries(s,scope));
  }
  async function remove(entry) {
    try {
      const removed=await access('readwrite',entry.scope,s=>{
        const key=keyOf(entry),raw=s.getItem(key);if(raw===null)return false;
        const stored=validateWorkspaceRecoveryStoredEntry(key,raw);
        if(!Object.keys(entry).every(field=>field==='actionReference'?entry[field]?.proposalId===stored[field]?.proposalId&&entry[field]?.revision===stored[field]?.revision:entry[field]===stored[field]))return false;
        s.removeItem(key);return true;
      });
      if(removed)notify();return removed;
    } catch { return false; }
  }
  const api = {
    list,
    async migratePlanImportAttempt(scope,projectId,legacyStorage) {
      if(!scopeValid(scope)||!id(projectId))throw unavailable();
      const key='obrasaas-plan-attempt-v1:'+scope+':'+projectId;
      let raw,value;
      try {
        raw=legacyStorage.getItem(key);if(raw===null)return;
        if(typeof raw!=='string'||raw.length>2048)throw unavailable();
        value=JSON.parse(raw);
        if(!value||Object.keys(value).sort().join('|')!=='kind|operationId|projectId|scope'||value.scope!==scope||value.projectId!==projectId||!uuid(value.operationId)||!['UPLOAD','DECISION'].includes(value.kind))throw unavailable();
      }catch{throw unavailable();}
      // Adopt only the old receipt reference; never dispatch its operation.
      // A different committed attempt keeps the legacy reference untouched.
      await api.prepare('/api/identity/plan-import',{method:'POST',body:JSON.stringify({scope,projectId,operationId:value.operationId})},{notifyConflict:false});
      try{if(legacyStorage.getItem(key)===raw)legacyStorage.removeItem(key);}catch{/* The committed canonical reference remains available. */}
    },
    async prepare(url, options, {notifyConflict=true} = {}) {
      const entry=await reference(url,options,now());if(!entry)return null;
      const reserve=()=>access('readwrite',entry.scope,s=>{
      if(options.signal?.aborted)throw Object.assign(new DOMException('La consulta se canceló.','AbortError'),{requestDispatched:false});
      const current=readEntries(s,entry.scope),existing=current.find(row=>keyOf(row)===keyOf(entry));
      if(existing){if(existing.projectId!==entry.projectId||existing.reportId!==entry.reportId||existing.eventId!==entry.eventId||existing.action!==entry.action||existing.draftId!==entry.draftId||existing.expectedRevision!==entry.expectedRevision||existing.inputDigest!==entry.inputDigest||existing.connectionId!==entry.connectionId||existing.expectedClerkOrganizationId!==entry.expectedClerkOrganizationId||existing.signupId!==entry.signupId||existing.templateKey!==entry.templateKey||existing.workerId!==entry.workerId||existing.actionReference?.proposalId!==entry.actionReference?.proposalId||existing.actionReference?.revision!==entry.actionReference?.revision)throw failure('WORKSPACE_RECOVERY_CONFLICT','Este identificador corresponde a otro intento. Comprobá el recibo antes de continuar.');return {entry:existing,existed:true};}
      const pending=current.find(row=>row.resource===entry.resource&&(['company-channel','company-onboarding'].includes(entry.resource)||row.projectId===entry.projectId)&&(entry.resource!=='meta-onboarding'||entry.action==='reconcile'||row.eventId===entry.eventId));
      let resolution=false;
      if(entry.resource==='participants'&&typeof options.body==='string'){try{resolution=JSON.parse(options.body).action==='REVOKE';}catch{ /* The server rejects malformed commands. */ }}
      if(pending&&!resolution)throw failure('WORKSPACE_RECOVERY_REQUIRED','Hay un envío anterior sin confirmar en este módulo. Comprobá su recibo en Operaciones por comprobar antes de iniciar otro.');
      if(current.length>=64)throw unavailable();
      s.setItem(keyOf(entry),JSON.stringify(entry));if(s.getItem(keyOf(entry))!==JSON.stringify(entry))throw unavailable();
      return {entry,existed:false};
      },options.signal);
      // The native lock spans the complete read/check/write transaction. The
      // browser adapter resolves only after commit, before token acquisition.
      let ticket;
      try { ticket=withLock?await withLock('obrasaas-receipt:'+entry.scope,options.signal,reserve):await reserve(); }
      catch(error) {
        // The transaction has aborted, but it observed an existing committed
        // attempt. Refresh this tab even when cross-tab broadcasts are absent.
        if(error?.code==='WORKSPACE_RECOVERY_REQUIRED'&&notifyConflict)notify();
        throw Object.assign(error,{requestDispatched:false});
      }
      if(!ticket.existed)notify();return ticket;
    },
    async settle(ticket, result, error) {
      if(!ticket)return;
      if(error){
        const rejected=ticket.entry.resource==='plan-import'&&recoveryResult(ticket.entry,error.result)?.state==='REJECTED'&&error.code===error.result.code&&error.status===({PLAN_IMPORT_FILE_INVALID:400,PLAN_IMPORT_FILE_TOO_LARGE:413})[error.code];
        if(!ticket.existed&&(error.requestDispatched===false||rejected||!['plan-import','company-channel','company-onboarding'].includes(ticket.entry.resource)&&!(ticket.entry.resource==='participants'&&(PRIVATE_BANK_ACTIONS.includes(ticket.entry.action)||PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(ticket.entry.action)))&&!(ticket.entry.resource==='meta-onboarding'&&ticket.entry.action==='reconcile')&&error.status>=400&&error.status<500))await remove(ticket.entry);return;
      }
      const entry=ticket.entry;
      if(entry.resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action)){if(['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      // A general Meta snapshot is not a receipt for this operation.
      if(entry.resource==='meta-onboarding'){if(['reconcile','cancel'].includes(entry.action)&&['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='template-send'){if(['ACCEPTED','STATUS_OBSERVED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='site-purchases'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='project-preparation'){if(['RECORDED','CANCELLED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='constructor-crm'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action)){if(['RECORDED','REJECTED','CANCELLED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='company-onboarding'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='company-channel'){if(['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='plan-import'){const outcome=recoveryResult(entry,result);if(outcome?.state==='RECORDED'||outcome?.state==='REJECTED'&&(outcome.phase==='PRE_DECISION'||outcome.proof==='AUDITED_UPLOAD'||!ticket.existed))await remove(entry);return;}
      if(entry.resource==='field-operations'&&FIELD_OVERTIME_RECOVERY_ACTIONS.includes(entry.action)){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(result?.scope===entry.scope&&(result.projectId===undefined||result.projectId===entry.projectId)&&(result.saved===true||result.created===true)&&(result.receiptId||result.receipt?.id))await remove(entry);
    },
    async observe(url, result) {
      const resource=resourceOf(url);if(!resource||!url.includes('?'))return;
      const params=new URLSearchParams(url.slice(url.indexOf('?')+1));
      const scope=params.get('scope'),operationId=params.get('operationId');if(!scopeValid(scope)||!uuid(operationId))return;
      const entry=(await list(scope)).find(row=>row.resource===resource&&row.operationId===operationId.toLowerCase());
      if(!entry||params.get('projectId')!==entry.projectId)return;
      if(entry.resource==='company-onboarding'&&(params.get('expectedClerkOrganizationId')!==entry.expectedClerkOrganizationId||params.get('action')!==entry.action))return;
      if(entry.resource==='meta-onboarding'&&['reconcile','cancel'].includes(entry.action)&&(params.get('action')!==entry.action||params.get('signupId')!==entry.signupId))return;
      const outcome=recoveryResult(entry,result);
      // A pre-reservation POST rejection cannot settle an earlier attempt via GET.
      if(entry.resource==='plan-import'&&outcome?.state==='REJECTED'&&outcome.phase!=='PRE_DECISION'&&outcome.proof!=='AUDITED_UPLOAD')return;
      if(['RECORDED','EXPIRED','EVENT_PROCESSED','PARTICIPATION_REVOKED','ACCEPTED','STATUS_OBSERVED','REJECTED','CANCELLED'].includes(outcome?.state))await remove(entry);
    },
  };
  return api;
}
export const browserRecoveryJournal=createWorkspaceRecoveryJournal({
  withStorage:createBrowserRecoveryStorage({prefix,validateStored:validateWorkspaceRecoveryStoredEntry}),
  notify:()=>{
    globalThis.window?.dispatchEvent(new Event(RECOVERY_EVENT));
    if(globalThis.window&&typeof globalThis.BroadcastChannel==='function'){
      // Invalidation only: never include scope, identifiers or receipt bodies.
      try { const channel=new BroadcastChannel(RECOVERY_EVENT);channel.postMessage({version:1,type:'invalidate'});channel.close(); }
      catch { /* Focus and same-window invalidation still refresh committed state. */ }
    }
  },
  withLock:(name,signal,reserve)=>{
    const locks=globalThis.navigator?.locks;
    if(!locks?.request)throw failure('WORKSPACE_RECOVERY_LOCK_UNAVAILABLE','Este navegador no permite conservar el intento de forma segura entre pestañas. Abrí ObraSaaS en un navegador actualizado; la operación no se envió.');
    return locks.request(name,{mode:'exclusive',...(signal?{signal}:{})},reserve);
  },
});
