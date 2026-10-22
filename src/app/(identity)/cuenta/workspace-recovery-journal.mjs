import {createBrowserRecoveryStorage} from './workspace-recovery-storage.mjs';
import {planBaselineCommandDigest,planBaselineOutcome} from './plan-baseline-view.mjs';
import {normalizeDocumentCurve,documentCurveCanonical,planDocumentDraftView,planInvestmentDraftView} from './plan-source-curve.mjs';
import {PRIVATE_BANK_ACTIONS,validatePrivateBankOutcome} from './private-bank-account-format.mjs';
import {purchaseOutcome} from './site-purchase-view.mjs';
import {companyChannelOutcome,COMPANY_CHANNEL_ACTIONS} from './company-channel-view.mjs';
import {ownCompanyNumberOutcome,OWN_COMPANY_ACTIONS} from './own-company-number-view.mjs';
import {ownTemplatesOutcome,OWN_TEMPLATE_ACTIONS} from './own-company-templates-view.mjs';
import {PARTICIPANT_OFFICE_ASSIGN_ACTION,participantOfficeReceiptOutcome,participantOfficePrecommitRejected} from './participant-office-account-view.mjs';

// Receipt references only. Never persist commands, tokens, files, location or messages.
export const RECOVERY_EVENT = 'obrasaas:pending-receipts';
export const WORKSPACE_RECOVERY_PREFIX = 'obrasaas.pending-receipt.v1.';
const prefix = WORKSPACE_RECOVERY_PREFIX;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const existingApiPlanObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const existingApiPlanExact=(value,keys)=>existingApiPlanObject(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const existingApiPlanRevision=value=>Number.isSafeInteger(value)&&value>=1;
const existingApiPlanTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const existingApiPlanInvalid=()=>Object.assign(new Error('No se pudo comprobar el plan del proveedor existente. Conservamos el intento para consultar su recibo.'),{code:'META_CUSTOMER_EXISTING_API_PLAN_RESPONSE_INVALID'});
export const EXISTING_API_PLAN_ACTIONS=Object.freeze(['prepare_existing_api_plan','close_existing_api_plan']);
export const EXISTING_API_PLAN_REJECTION_CODES=Object.freeze(['META_CUSTOMER_PREPARATION_CHANGED','META_CUSTOMER_EXISTING_API_PLAN_ALREADY_PREPARED','META_CUSTOMER_EXISTING_API_PLAN_CHANGED','META_CUSTOMER_EXISTING_API_PLAN_ALREADY_CLOSED','META_CUSTOMER_EXISTING_API_CONNECTION_INCOMPLETE']);
export const existingApiPlanAction=action=>EXISTING_API_PLAN_ACTIONS.includes(action);

// Only identifiers and the expected preparation existingApiPlanRevision enter the shared journal.
export function existingApiPlanCommandReference(body){
 const prepare=body?.action==='prepare_existing_api_plan';
 const keys=['action','operationId','projectId','scope',...(prepare?['preparedRevision','confirmPreserveProvider']:['planId','confirmLocalClosure'])];
 if(!existingApiPlanAction(body?.action)||!existingApiPlanExact(body,keys)||!uuid(body.operationId)||typeof body.projectId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(body.projectId)||typeof body.scope!=='string'||!/^[a-f0-9]{64}$/.test(body.scope)||
   (prepare?!existingApiPlanRevision(body.preparedRevision)||body.confirmPreserveProvider!==true:!uuid(body.planId)||body.confirmLocalClosure!==true))throw existingApiPlanInvalid();
 return {action:body.action,planId:(prepare?body.operationId:body.planId).toLowerCase(),...(prepare?{preparedRevision:body.preparedRevision}:{})};
}

export function existingApiPlanReceiptOutcome(result,reference){
 const r=result?.existingApiPlanReceipt;
 const keys=['action','operationId','projectId','scope','planId','state','saved','receiptId','recordedAt','preparedRevision','providerChanged','remoteMutationDispatched','authorizationGranted','code'];
 if(!reference||!existingApiPlanAction(reference.action)||!existingApiPlanExact(r,keys)||result.scope!==reference.scope||result.projectId!==reference.projectId||r.scope!==reference.scope||r.projectId!==reference.projectId||r.operationId!==reference.operationId||r.action!==reference.action||r.planId!==reference.planId||
   !uuid(r.operationId)||!uuid(r.planId)||r.providerChanged!==false||r.remoteMutationDispatched!==false||r.authorizationGranted!==false)return null;
 if(r.state==='NOT_OBSERVED')return r.saved===false&&r.receiptId===null&&r.recordedAt===null&&r.preparedRevision===null&&r.code===null?{state:'NOT_OBSERVED'}:null;
 if(!/^meta_existing_api_[a-f0-9]{64}$/.test(r.receiptId||'')||!existingApiPlanTimestamp(r.recordedAt)||
   (reference.action==='prepare_existing_api_plan'?r.planId!==r.operationId||r.preparedRevision!==reference.preparedRevision:!(r.preparedRevision===null||existingApiPlanRevision(r.preparedRevision))))return null;
 if(r.state==='RECORDED')return r.saved===true&&existingApiPlanRevision(r.preparedRevision)&&r.code===null?{state:'RECORDED',receiptId:r.receiptId}:null;
 return r.state==='REJECTED'&&r.saved===false&&EXISTING_API_PLAN_REJECTION_CODES.includes(r.code)?{state:'REJECTED',receiptId:r.receiptId,code:r.code}:null;
}

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const channelReferenceValid=(action,connectionId)=>OWN_COMPANY_ACTIONS.includes(action)?(id(connectionId)||action==='CONNECT_OWN_NUMBER'&&connectionId===null):[...COMPANY_CHANNEL_ACTIONS,...OWN_TEMPLATE_ACTIONS].includes(action)&&id(connectionId);
const PROGRESS_TEMPLATE_SEND_KEY='progress_review_notification';
export const FIELD_OVERTIME_RECOVERY_ACTIONS=Object.freeze(['CONFIGURE_OVERTIME','PROPOSE_OVERTIME','DECIDE_OVERTIME']);
const fieldMeasurementAction='CONFIGURE_PROGRESS_MEASUREMENT';
const fieldMeasurementCancelAction='CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION';
export const PARTICIPANT_INTAKE_RECOVERY_ACTIONS=Object.freeze(['CONFIGURE_EMPLOYEE_INTAKE','ADMIT_EMPLOYEE_INTAKE','REJECT_EMPLOYEE_INTAKE']);
const templateSendActionReference=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='proposalId|revision'&&id(value.proposalId)&&typeof value.revision==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision));
const scopeValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
// Inline to preserve the static copy graph of existing recovery harnesses.
// This validates a receipt, never a project name supplied as an access claim.
export function projectCreationReceiptOutcome(value,reference){
 const exact=(row,fields)=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).sort().join('|')===[...fields].sort().join('|');
 if(!value||!scopeValid(value.scope)||value.scope!==reference?.scope||!id(value.projectId)||value.projectId!==reference?.projectId||!uuid(value.operationId)||value.operationId!==value.operationId.toLowerCase()||value.operationId!==reference?.operationId||value.action!=='CREATE_PROJECT')return null;
 const base=['scope','projectId','operationId','action','state','saved','created','definitive'];
 if(value.state==='NOT_OBSERVED')return exact(value,base)&&value.saved===false&&value.created===false&&value.definitive===false?{state:'NOT_OBSERVED'}:null;
 const name=value.newProject?.name;
 if(!exact(value,[...base,'receiptId','replayed','newProject'])||value.state!=='RECORDED'||value.saved!==true||value.created!==true||value.definitive!==true||!/^project_creation_[a-f0-9]{64}$/.test(value.receiptId||'')||typeof value.replayed!=='boolean'||!exact(value.newProject,['id','name','status'])||!id(value.newProject.id)||value.newProject.id===value.projectId||typeof name!=='string'||name.length<2||name.length>120||name!==name.trim().normalize('NFC')||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(name)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(name)||!['PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED'].includes(value.newProject.status))return null;
 return {state:'RECORDED',receiptId:value.receiptId};
}
export function officeReviewReceiptOutcome(value,reference){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.scope!==reference.scope||value.projectId!==reference.projectId||value.operationId!==reference.operationId)return null;
 const exact=fields=>Object.keys(value).sort().join('|')===[...fields].sort().join('|');
 if(value.state==='NOT_OBSERVED')return exact(['scope','projectId','operationId','action','state','saved','definitive'])&&value.action===null&&value.saved===false&&value.definitive===false?{state:'NOT_OBSERVED'}:null;
 if(value.action!==reference.action||typeof value.replayed!=='boolean'||!/^office_review_[a-f0-9]{64}(?:_recorded)?$/.test(value.receiptId||''))return null;
 if(!exact(['scope','projectId','operationId','action','state','saved','definitive','receiptId','replayed',...(value.invitationId!==undefined?['invitationId']:[])]))return null;
 if(value.invitationId!==undefined&&!/^office_invite_[a-f0-9]{32}$/.test(value.invitationId))return null;
 if(value.state==='RECORDED'&&value.saved===true&&value.definitive===true)return {state:'RECORDED',receiptId:value.receiptId};
 if(value.state==='INVITATION_UNCONFIRMED'&&reference.action==='INVITE_AUDITOR'&&value.invitationId&&value.saved===false&&value.definitive===false)return {state:'INVITATION_UNCONFIRMED'};
 return null;
}
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
const planDecisionCodes=Object.freeze(['PLAN_IMPORT_ROWS_LIMIT','PLAN_IMPORT_ROWS_INVALID','PLAN_IMPORT_DATES_INVALID','PLAN_IMPORT_DUPLICATE_ROWS','PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_SCHEDULE_CHANGED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE','PLAN_DOCUMENT_CURVE_INCONSISTENT','PLAN_DOCUMENT_CURVE_VALUES_REQUIRED','PLAN_IMPORT_DOCUMENT_CURVE_INVALID']);
const documentCurveActions=['REVIEW_CURVE','APPLY_CURVE'];
const investmentActions=['REVIEW_INVESTMENT','APPLY_INVESTMENT','REJECT_INVESTMENT'];
const planActions=['EDIT','APPLY','REJECT',...documentCurveActions,...investmentActions];
const measurementImportActions=['REVIEW_MEASUREMENT','APPLY_MEASUREMENT','REJECT_MEASUREMENT'];
const measurementImportRejectCodes=['PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_MEASUREMENT_SOURCE_CHANGED','PLAN_MEASUREMENT_REVIEW_CHANGED','FIELD_REVISION_CHANGED','FIELD_PROGRESS_REVIEW_PENDING','TASK_MEASUREMENT_BASELINE_LOCKED','TASK_MEASUREMENT_STATE_INVALID','PLAN_MEASUREMENT_REPLACEMENT_REQUIRED','PLAN_MEASUREMENT_DEFINITION_CHANGED','PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED','PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED','PLAN_MEASUREMENT_EXCLUSION_REVIEW_REQUIRED','PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED','PLAN_IMPORT_MEASUREMENT_UNIT_INCOMPATIBLE','PLAN_MEASUREMENT_DATES_REQUIRED','WORKSPACE_TASK_UNAVAILABLE'];
const documentCurveConsent='plan-document-monthly-curve-openai-v1';
function investmentReceiptOutcome(entry,result){
 const exact=keys=>Object.keys(result).sort().join('|')===[...keys].sort().join('|');
 if(result.state==='NOT_OBSERVED')return exact(['scope','projectId','definitive','state'])&&result.definitive===false?{state:'NOT_OBSERVED'}:null;
 const common=['scope','projectId','action','operationId','expectedRevision','inputDigest','state','definitive','phase','saved','taskEffects','baselineEffects','taskSnapshots','tasks','recordedAt','replayed','receiptId'];
 if(result.action!==entry.action||result.operationId!==entry.operationId||result.expectedRevision!==entry.expectedRevision||result.inputDigest!==entry.inputDigest||result.definitive!==true||result.taskEffects!==false||result.baselineEffects!==false||!/^plan_receipt_[a-f0-9]{64}$/.test(result.receiptId||'')||typeof result.replayed!=='boolean'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt||'')||!Number.isFinite(Date.parse(result.recordedAt))||new Date(result.recordedAt).toISOString()!==result.recordedAt||!Array.isArray(result.tasks)||result.tasks.length||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length)return null;
 if(result.state==='REJECTED')return exact([...common,'draftId','code'])&&result.draftId===entry.draftId&&result.saved===false&&result.phase==='PRE_DECISION'&&['PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED'].includes(result.code)?{state:'REJECTED',phase:'PRE_DECISION',receiptId:result.receiptId,code:result.code}:null;
 if(!exact([...common,'draft'])||result.state!=='RECORDED'||result.saved!==true||result.phase!=='COMMITTED'||result.draft?.id!==entry.draftId||result.draft.revision!==entry.expectedRevision+1||result.draft.status!==({REVIEW_INVESTMENT:'READY',APPLY_INVESTMENT:'APPLIED',REJECT_INVESTMENT:'REJECTED'})[entry.action])return null;
 try{if(!planInvestmentDraftView(result.draft)||entry.action!=='REJECT_INVESTMENT'&&!result.draft.investmentReviewed)return null;}catch{return null;}
 return {state:'RECORDED',receiptId:result.receiptId};
}
function documentCurveReceiptOutcome(entry,result){
 const exact=keys=>Object.keys(result).sort().join('|')===keys.sort().join('|');
 const common=['scope','projectId','action','operationId','expectedRevision','inputDigest','state','definitive','phase','saved','taskEffects','baselineEffects','taskSnapshots','tasks','recordedAt','replayed','receiptId'];
 if(!['REVIEW_CURVE','APPLY_CURVE','REJECT'].includes(entry.action)||result.action!==entry.action||result.operationId!==entry.operationId||result.expectedRevision!==entry.expectedRevision||result.inputDigest!==entry.inputDigest||result.definitive!==true||result.taskEffects!==false||result.baselineEffects!==false||!/^plan_receipt_[a-f0-9]{64}$/.test(result.receiptId||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt)||!Number.isFinite(Date.parse(result.recordedAt))||new Date(result.recordedAt).toISOString()!==result.recordedAt||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length||!Array.isArray(result.tasks)||result.tasks.length)return null;
 if(result.state==='REJECTED')return exact([...common,'draftId','code'])&&result.saved===false&&result.phase==='PRE_DECISION'&&result.draftId===entry.draftId&&planDecisionCodes.includes(result.code)?{state:'REJECTED',phase:'PRE_DECISION',receiptId:result.receiptId,code:result.code}:null;
 if(!exact([...common,'draft'])||result.state!=='RECORDED'||result.saved!==true||result.phase!=='COMMITTED'||result.draft?.id!==entry.draftId||result.draft.revision!==entry.expectedRevision+1||result.draft.status!==({REVIEW_CURVE:'READY',APPLY_CURVE:'APPLIED',REJECT:'REJECTED'})[entry.action])return null;
 try{const view=planDocumentDraftView(result.draft);if(!view||entry.action!=='REJECT'&&(!view.reviewed||!view.documentReviewed)||entry.action==='APPLY_CURVE'&&view.reviewed.coherence.status==='INCONSISTENT')return null;}catch{return null;}
 return {state:'RECORDED',receiptId:result.receiptId};
}
const planUploadCodes=Object.freeze(['PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE']);
const sha256=async bytes=>[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const canonicalPlanCommand=value=>Array.isArray(value)?value.map(canonicalPlanCommand):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalPlanCommand(value[key])])):value;
export async function planImportCommandDigest(body){
 if(investmentActions.includes(body?.action)){
  const keys=['action','scope','projectId','operationId','draftId','expectedRevision','reason','acknowledgeDifference'];
  if(!body||Object.keys(body).sort().join('|')!==keys.sort().join('|')||!uuid(body.operationId?.toLowerCase?.())||!scopeValid(body.scope)||!id(body.projectId)||!/^plan_draft_[a-f0-9]{64}$/.test(body.draftId||'')||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||body.expectedRevision>=2147483647||typeof body.acknowledgeDifference!=='boolean'||typeof body.reason!=='string'||body.reason.length>800||body.reason.trim().length<8||/[\u0000-\u001f\u007f<>]/.test(body.reason))throw unavailable();
  return sha256(new TextEncoder().encode(JSON.stringify(['plan-investment-curves-decision-v1',canonicalPlanCommand({...body,operationId:body.operationId.toLowerCase(),reason:body.reason.trim()})])));
 }
 if(documentCurveActions.includes(body?.action)||body?.action==='REJECT'&&Object.hasOwn(body,'curve')){
  const keys=['action','draftId','expectedRevision','operationId','projectId','reason','rows','scope','curve'];
  if(!body||Object.keys(body).sort().join('|')!==keys.sort().join('|')||!uuid(body.operationId)||!scopeValid(body.scope)||!id(body.projectId)||!id(body.draftId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||body.expectedRevision>2147483647||body.rows!==null||typeof body.reason!=='string'||body.reason.length>800||body.reason.trim().length<8||/[\u0000-\u001f\u007f<>]/.test(body.reason))throw unavailable();
  const curve=body.action==='REVIEW_CURVE'?normalizeDocumentCurve(body.curve):body.curve===null?null:(()=>{throw unavailable();})();
  const normalized={...body,operationId:body.operationId.toLowerCase(),reason:body.reason.trim(),curve};
  return sha256(new TextEncoder().encode(JSON.stringify(['plan-document-curve-decision-v1','FINANCIAL_MONTHLY_CURVE',documentCurveCanonical(normalized)])));
 }
 const bytes=new TextEncoder().encode(JSON.stringify(['plan-import-command-v1',canonicalPlanCommand({...body,operationId:body.operationId.toLowerCase()})]));
 return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function planImportUploadDigest({scope,projectId,operationId,consent,source}){
 if(consent===documentCurveConsent){
  if(!scopeValid(scope)||!id(projectId)||!uuid(operationId)||!source||!Number.isSafeInteger(source.bytes)||source.bytes<1||source.bytes>3*1024*1024||!['application/pdf','image/png','image/jpeg','image/webp'].includes(source.contentType)||!/^[a-f0-9]{64}$/.test(source.sha256||''))throw unavailable();
  return sha256(new TextEncoder().encode(JSON.stringify(['plan-document-curve-upload-command-v1',{action:'UPLOAD',purpose:'FINANCIAL_MONTHLY_CURVE',consent,operationId:operationId.toLowerCase(),projectId,scope,source:{bytes:source.bytes,contentType:source.contentType,sha256:source.sha256}}])));
 }
 const spreadsheet=['application/vnd.ms-excel.sheet.macroenabled.12','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(source?.contentType);
 if(!scopeValid(scope)||!id(projectId)||!uuid(operationId)||!(spreadsheet?['plan-spreadsheet-monthly-rubros-v1','plan-spreadsheet-cyp-partidas-v2','plan-spreadsheet-monthly-curve-v3','plan-spreadsheet-cyp-curve-v4','plan-spreadsheet-cyp-investment-curves-v1','plan-source-budget-local-v1'].includes(consent):consent==='plan-document-openai-v1')||!source||!Number.isSafeInteger(source.bytes)||source.bytes<1||source.bytes>3*1024*1024||!['application/pdf','image/png','image/jpeg','image/webp','application/vnd.ms-excel.sheet.macroenabled.12','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(source.contentType)||!/^[a-f0-9]{64}$/.test(source.sha256||''))throw unavailable();
 return sha256(new TextEncoder().encode(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent,operationId:operationId.toLowerCase(),projectId,scope,source:{bytes:source.bytes,contentType:source.contentType,sha256:source.sha256}}])));
}
export async function planImportUploadFormDigest(form){
 const file=form?.get?.('file');if(!file||typeof file.arrayBuffer!=='function'||!Number.isSafeInteger(file.size)||file.size<1||file.size>3*1024*1024)throw unavailable();
 const source={bytes:file.size,contentType:String(file.type||'').split(';')[0].toLowerCase().trim(),sha256:await sha256(await file.arrayBuffer())};
 return planImportUploadDigest({scope:form.get('scope'),projectId:form.get('projectId'),operationId:form.get('operationId'),consent:form.get('consent'),source});
}
export async function planMeasurementCommandDigest(body){
 const keys=['action','projectId','scope','operationId','draftId','expectedRevision','sourceSha256','sourceDigest','reviewDigest','reason','rows','destinations','excludedRows'];
 if(!body||Object.keys(body).sort().join('|')!==keys.sort().join('|')||!measurementImportActions.includes(body.action)||!uuid(body.operationId)||!scopeValid(body.scope)||!id(body.projectId)||!id(body.draftId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||body.expectedRevision>=2147483647||!/^[a-f0-9]{64}$/.test(body.sourceSha256||'')||!/^[a-f0-9]{64}$/.test(body.sourceDigest||'')||typeof body.reason!=='string'||body.reason.length>1000||body.reason.trim().length<8||/[\u0000-\u001f\u007f<>]/.test(body.reason))throw unavailable();
 if(body.action==='REVIEW_MEASUREMENT'?(body.reviewDigest!==null||!Array.isArray(body.rows)||!body.rows.length||body.rows.length>500||!Array.isArray(body.destinations)||body.destinations.length!==body.rows.length||!Array.isArray(body.excludedRows)||body.excludedRows.length>200):(body.rows!==null||body.destinations!==null||body.excludedRows!==null||body.action==='APPLY_MEASUREMENT'&&!/^[a-f0-9]{64}$/.test(body.reviewDigest||'')||body.action==='REJECT_MEASUREMENT'&&body.reviewDigest!==null&&!/^[a-f0-9]{64}$/.test(body.reviewDigest||'')))throw unavailable();
 return sha256(new TextEncoder().encode(JSON.stringify(['plan-measurement-command-v1',canonicalPlanCommand({...body,operationId:body.operationId.toLowerCase(),reason:body.reason.trim()})])));
}
export async function planMeasurementUploadFormDigest(form){
 const file=form?.get?.('file'),scope=form?.get?.('scope'),projectId=form?.get?.('projectId'),operationId=form?.get?.('operationId'),consent=form?.get?.('consent');
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isSafeInteger(file.size)||file.size<1||file.size>3*1024*1024||!scopeValid(scope)||!id(projectId)||!uuid(operationId)||[...form.keys()].sort().join('|')!=='consent|file|operationId|projectId|scope')throw unavailable();
 const contentType=String(file.type||'').split(';')[0].toLowerCase().trim(),spreadsheet=['application/vnd.ms-excel.sheet.macroenabled.12','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(contentType);
 if(spreadsheet?consent!=='plan-source-quantities-local-v1':!['application/pdf','image/png','image/jpeg','image/webp'].includes(contentType)||consent!=='plan-source-quantities-openai-v1')throw unavailable();
 const source={bytes:file.size,contentType,sha256:await sha256(await file.arrayBuffer())};
 return sha256(new TextEncoder().encode(JSON.stringify(['plan-measurement-upload-command-v1',{action:'UPLOAD',purpose:'PHYSICAL_TASK_MEASUREMENT',consent,operationId:operationId.toLowerCase(),projectId,scope,source}])));
}
function measurementImportRecoveryOutcome(entry,result){
 if(result.state==='REJECTED'){
  const rejectedKeys=['scope','projectId','operationId','action','draftId','expectedRevision','sourceSha256','sourceDigest','reviewDigest','inputDigest','state','saved','definitive','phase','code','taskEffects','draftEffects','proposalEffects','taskSnapshots','recordedAt','receiptId','replayed'];
  if(Object.keys(result).sort().join('|')!==rejectedKeys.sort().join('|')||result.operationId!==entry.operationId||result.action!==entry.action||result.draftId!==entry.draftId||result.expectedRevision!==entry.expectedRevision||result.sourceSha256!==entry.sourceSha256||result.sourceDigest!==entry.sourceDigest||result.reviewDigest!==entry.reviewDigest||result.inputDigest!==entry.inputDigest||result.saved!==false||result.definitive!==true||result.phase!=='PRE_DECISION'||!measurementImportRejectCodes.includes(result.code)||result.taskEffects!==false||result.draftEffects!==false||result.proposalEffects!==false||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length||!/^plan_measurement_[a-f0-9]{64}$/.test(result.receiptId||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt)||!Number.isFinite(Date.parse(result.recordedAt))||new Date(result.recordedAt).toISOString()!==result.recordedAt)return null;
  return {state:'REJECTED',phase:'PRE_DECISION',code:result.code,receiptId:result.receiptId};
 }
 const keys=['scope','projectId','operationId','action','draftId','expectedRevision','inputDigest','state','saved','definitive','draft','taskSnapshots','taskEffects','recordedAt','receiptId','replayed'];
 if(result.state==='NOT_OBSERVED')return Object.keys(result).sort().join('|')==='definitive|operationId|projectId|saved|scope|state'&&result.operationId===entry.operationId&&result.saved===false&&result.definitive===false?{state:'NOT_OBSERVED'}:null;
 if(Object.keys(result).sort().join('|')!==keys.sort().join('|')||result.operationId!==entry.operationId||result.action!==entry.action||result.draftId!==entry.draftId||result.expectedRevision!==entry.expectedRevision||result.inputDigest!==entry.inputDigest||result.state!=='RECORDED'||result.saved!==true||result.definitive!==true||!/^plan_measurement_[a-f0-9]{64}$/.test(result.receiptId||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!Number.isFinite(Date.parse(result.recordedAt))||!Array.isArray(result.taskSnapshots)||result.taskEffects!==(entry.action==='APPLY_MEASUREMENT'))return null;
 const draft=result.draft,status={REVIEW_MEASUREMENT:'READY',APPLY_MEASUREMENT:'APPLIED',REJECT_MEASUREMENT:'REJECTED'}[entry.action];
 if(draft?.id!==entry.draftId||draft.revision!==entry.expectedRevision+1||draft.status!==status||draft.measurementImport!==true||draft.source?.sha256!==entry.sourceSha256||draft.sourceDigest!==entry.sourceDigest||draft.measurementSource?.sourceSha256!==entry.sourceSha256||draft.measurementSource?.purpose!=='PHYSICAL_TASK_MEASUREMENT')return null;
 if(entry.action!=='APPLY_MEASUREMENT')return result.taskSnapshots.length===0?{state:'RECORDED',receiptId:result.receiptId}:null;
 if(!draft.review?.rows?.length||draft.review.rows.length!==result.taskSnapshots.length)return null;
 const ids=new Set(),rows=new Set();
 for(const snapshot of result.taskSnapshots){const task=snapshot?.task,measurement=task?.measurement,row=draft.review.rows.find(value=>value.sourceRowId===snapshot?.sourceRowId);
  if(!row||ids.has(task?.id)||rows.has(snapshot.sourceRowId)||!id(task?.id)||task.progress!==0||typeof task.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(task.revision)||typeof snapshot.created!=='boolean'||snapshot.taskProgressUnchanged!==true||measurement?.version!=='task-progress-measurement-v1'||measurement.baseline!==row.baseline||measurement.unit!==row.unit||measurement.executed!=='0.0000'||measurement.approvedProposalId!==null||measurement.approvedAt!==null||!id(measurement.definitionId))return null;
  ids.add(task.id);rows.add(snapshot.sourceRowId);
 }
 return {state:'RECORDED',receiptId:result.receiptId};
}
export const RECOVERY_RESOURCES = Object.freeze({
  'project-creation':'Alta de otra obra',
  'office-review':'Acceso de oficina y eventos seleccionados',
  workspace:'Planificación', 'task-creation':'Nueva tarea', 'site-register':'Registro de obra',
  'site-photo':'Fotografía privada', participants:'Participantes e identidad',
  'field-operations':'Operación de campo', 'field-media':'Evidencia privada',
  'site-purchases':'Compra o recepción', 'whatsapp-setup':'Preparación de WhatsApp',
  'meta-onboarding':'Seguimiento de WhatsApp', 'worker-channel':'Mi WhatsApp y autorización de avisos',
  'template-send':'Aviso autorizado por WhatsApp',
  'constructor-crm':'Cliente u oportunidad de la empresa',
  'demo-pilot':'Preparación y vinculación del piloto DEMO',
  'plan-import':'Importación de cronograma',
  'plan-measurement':'Metrado desde una fuente privada',
  'plan-baseline':'Curva prevista de la obra',
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
  if(resource==='project-creation'&&body.action!=='CREATE_PROJECT')throw unavailable();
  if(resource==='office-review'&&body.action==='RECOVER_INVITATION')return null;
  if(resource==='office-review'&&!['INVITE_AUDITOR','REVOKE_AUDITOR','SELECT_EVENT','SHARE_CONNECTION','WITHDRAW_CONNECTION'].includes(body.action))throw unavailable();
  if(resource==='project-preparation'&&!['SAVE_PREPARATION','CANCEL_PENDING_PREPARATION'].includes(body.action))throw unavailable();
  if(resource==='company-onboarding'&&(body.action!=='declare_company_phone'||!id(body.expectedClerkOrganizationId)))throw unavailable();
  if(resource==='site-photo'&&!id(body.reportId))return null;
  const channelAction=body.action==='RECOVER_CONNECT_OWN_NUMBER'&&body.payload?.connectionId===null&&body.payload?.confirmRecovery===true?'CONNECT_OWN_NUMBER':body.action==='RECOVER_OWN_TEMPLATE'&&['SUBMIT_OWN_TEMPLATE','RECOVER_OWN_TEMPLATE'].includes(body.payload?.recoveryOf)?body.payload.recoveryOf:body.action;
  if(resource==='company-channel'&&!channelReferenceValid(channelAction,body.payload?.connectionId))throw unavailable();
  // Invitation reconciliation reads the provider and finalizes the original
  // invitation's receipt; it never creates a second invitation.
  if(resource==='participants'&&body.action==='RECOVER_INVITATION')return null;
  const existingApiPlan=resource==='meta-onboarding'&&existingApiPlanAction(body.action)?existingApiPlanCommandReference(body):null;
  if(resource==='meta-onboarding'&&!existingApiPlan&&(body.action==='cancel'?(!uuid(body.signupId)||body.confirmLocalClosure!==true):body.action==='reconcile'?(!uuid(body.signupId)||!Number.isSafeInteger(body.expectedCompanyPhoneRevision)||body.expectedCompanyPhoneRevision<1||body.confirmCompanyPhoneRevision!==true):(!['review_inbox','process_inbox'].includes(body.action)||!id(body.eventId))))return null;
  const bank=resource==='participants'&&(PRIVATE_BANK_ACTIONS.includes(body.action)||body.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT');
  const bankAction=body.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'?body.payload?.originalAction:body.action;
  if(bank&&(!PRIVATE_BANK_ACTIONS.includes(bankAction)||!id(body.payload?.workerId)))throw unavailable();
  const progress=resource==='template-send'&&body.templateKey===PROGRESS_TEMPLATE_SEND_KEY;
  const overtime=resource==='field-operations'&&FIELD_OVERTIME_RECOVERY_ACTIONS.includes(body.action);
  const measurement=resource==='field-operations'&&[fieldMeasurementAction,fieldMeasurementCancelAction].includes(body.action);
  if(measurement&&!id(body.payload?.taskId))throw unavailable();
  const intake=resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(body.action);
  const officeAccount=resource==='participants'&&body.action===PARTICIPANT_OFFICE_ASSIGN_ACTION;
  const measurementImport=resource==='plan-measurement';
  const plan=(resource==='plan-import'||measurementImport)&&typeof options.body==='string'&&(measurementImport?measurementImportActions:planActions).includes(body.action)&&id(body.draftId)&&Number.isSafeInteger(body.expectedRevision)&&body.expectedRevision>=1;
  const planUpload=(resource==='plan-import'||measurementImport)&&typeof options.body?.get==='function';
  let inputDigest;try{if(resource==='plan-baseline')inputDigest=await planBaselineCommandDigest(body);else if(plan)inputDigest=await (measurementImport?planMeasurementCommandDigest(body):planImportCommandDigest(body));else if(planUpload)inputDigest=await (measurementImport?planMeasurementUploadFormDigest(options.body):planImportUploadFormDigest(options.body));}catch{throw unavailable();}
  if(intake&&(!id(body.payload?.connectionId)||body.action!=='CONFIGURE_EMPLOYEE_INTAKE'&&!/^customer_webhook_[a-f0-9]{64}$/.test(body.payload?.applicationId||'')))throw unavailable();
  if(progress&&(!id(body.workerId)||!templateSendActionReference(body.actionReference)))throw unavailable();
  return {version:1,resource,scope:body.scope,projectId:body.projectId,operationId:body.operationId.toLowerCase(),createdAt:now,
    ...(resource==='project-creation'?{action:'CREATE_PROJECT'}:{}),
    ...(resource==='plan-baseline'?{action:'SELECT',inputDigest}:{}),
    ...(resource==='office-review'?{action:body.action}:{}),
    ...(resource==='site-photo'?{reportId:body.reportId}:{}),
    ...(resource==='company-onboarding'?{action:body.action,expectedClerkOrganizationId:body.expectedClerkOrganizationId}:{}),
    ...(resource==='company-channel'?{action:channelAction,connectionId:body.payload.connectionId}:{}),
    ...(resource==='meta-onboarding'?existingApiPlan||{action:body.action,...(['reconcile','cancel'].includes(body.action)?{signupId:body.signupId}:{eventId:body.eventId})}:{}),
    ...(overtime?{action:body.action}:{}),
    ...(measurement?{action:fieldMeasurementAction,taskId:body.payload.taskId}:{}),
    ...(bank?{action:bankAction,workerId:body.payload.workerId}:{}),
    ...(intake?{action:body.action,connectionId:body.payload.connectionId,...(body.action==='CONFIGURE_EMPLOYEE_INTAKE'?{}:{applicationId:body.payload.applicationId})}:{}),
    ...(officeAccount?{action:PARTICIPANT_OFFICE_ASSIGN_ACTION}:{}),
    ...(progress?{templateKey:PROGRESS_TEMPLATE_SEND_KEY,workerId:body.workerId,actionReference:{proposalId:body.actionReference.proposalId,revision:body.actionReference.revision}}:{}),
    ...(plan?{action:body.action,draftId:body.draftId,expectedRevision:body.expectedRevision,inputDigest,...(measurementImport?{sourceSha256:body.sourceSha256,sourceDigest:body.sourceDigest,reviewDigest:body.reviewDigest}:{} )}:{}),
    ...(planUpload?{action:'UPLOAD',inputDigest}:{}),
    ...(resource==='project-preparation'?{action:'SAVE_PREPARATION'}:{}),
  };
}
function valid(entry) {
  if(!entry||entry.version!==1||!Object.hasOwn(RECOVERY_RESOURCES,entry.resource)||!scopeValid(entry.scope)||!id(entry.projectId)||!uuid(entry.operationId)||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<0)return false;
  const progress=entry.resource==='template-send'&&entry.templateKey===PROGRESS_TEMPLATE_SEND_KEY;
  const measurement=entry.resource==='field-operations'&&entry.action===fieldMeasurementAction;
  const overtime=entry.resource==='field-operations'&&entry.action!==undefined&&!measurement;
  const bank=entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action);
  const intake=entry.resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action);
  const officeAccount=entry.resource==='participants'&&entry.action===PARTICIPANT_OFFICE_ASSIGN_ACTION;
  const measurementImport=entry.resource==='plan-measurement';
  const plan=(entry.resource==='plan-import'||measurementImport)&&entry.action!==undefined;
  const planUpload=plan&&entry.action==='UPLOAD';
  const preparation=entry.resource==='project-preparation';
  const office=entry.resource==='office-review';
  const creation=entry.resource==='project-creation';
  const curveBaseline=entry.resource==='plan-baseline';
  if(curveBaseline&&(entry.action!=='SELECT'||!/^[a-f0-9]{64}$/.test(entry.inputDigest||'')))return false;
  if(creation&&entry.action!=='CREATE_PROJECT')return false;
  if(office&&!['INVITE_AUDITOR','REVOKE_AUDITOR','SELECT_EVENT','SHARE_CONNECTION','WITHDRAW_CONNECTION'].includes(entry.action))return false;
  if(entry.resource==='participants'&&entry.action!==undefined&&!bank&&!intake&&!officeAccount)return false;
  if(preparation&&entry.action!=='SAVE_PREPARATION')return false;
  const fields=['version','resource','scope','projectId','operationId','createdAt',...(entry.resource==='site-photo'?['reportId']:[]),...(entry.resource==='company-onboarding'?['action','expectedClerkOrganizationId']:[]),...(entry.resource==='company-channel'?['action','connectionId']:[]),...(entry.resource==='meta-onboarding'?['action',...(existingApiPlanAction(entry.action)?['planId',...(entry.action==='prepare_existing_api_plan'?['preparedRevision']:[])]:[['reconcile','cancel'].includes(entry.action)?'signupId':'eventId'])]:[]),...(overtime?['action']:[]),...(measurement?['action','taskId']:[]),...(bank?['action','workerId']:[]),...(intake?['action','connectionId',...(entry.action==='CONFIGURE_EMPLOYEE_INTAKE'?[]:['applicationId'])]:[]),...(progress?['templateKey','workerId','actionReference']:[]),...(planUpload?['action','inputDigest']:plan?['action','draftId','expectedRevision','inputDigest',...(measurementImport?['sourceSha256','sourceDigest','reviewDigest']:[])]:[]),...(preparation?['action']:[])];
  if(office)fields.push('action');
  if(officeAccount)fields.push('action');
  if(creation)fields.push('action');
  if(curveBaseline)fields.push('action','inputDigest');
  if(Object.keys(entry).sort().join('|')!==fields.sort().join('|'))return false;
  if(entry.resource==='company-onboarding'&&(entry.action!=='declare_company_phone'||!id(entry.expectedClerkOrganizationId)))return false;
  if(entry.resource==='company-channel'&&!channelReferenceValid(entry.action,entry.connectionId))return false;
  if(progress&&(!id(entry.workerId)||!templateSendActionReference(entry.actionReference)))return false;
  if(planUpload&&!/^[a-f0-9]{64}$/.test(entry.inputDigest||''))return false;
  if(plan&&!planUpload&&(!(measurementImport?measurementImportActions:planActions).includes(entry.action)||!id(entry.draftId)||!Number.isSafeInteger(entry.expectedRevision)||entry.expectedRevision<1||!/^[a-f0-9]{64}$/.test(entry.inputDigest||'')))return false;
  if(measurementImport&&!planUpload&&(!/^[a-f0-9]{64}$/.test(entry.sourceSha256||'')||!/^[a-f0-9]{64}$/.test(entry.sourceDigest||'')||(entry.action==='APPLY_MEASUREMENT'?!/^[a-f0-9]{64}$/.test(entry.reviewDigest||''):entry.reviewDigest!==null&&!/^[a-f0-9]{64}$/.test(entry.reviewDigest||''))))return false;
  if(overtime&&!FIELD_OVERTIME_RECOVERY_ACTIONS.includes(entry.action))return false;
  if(measurement&&!id(entry.taskId))return false;
  if(bank&&(!PRIVATE_BANK_ACTIONS.includes(entry.action)||!id(entry.workerId)))return false;
  if(intake&&(!PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action)||!id(entry.connectionId)||entry.action!=='CONFIGURE_EMPLOYEE_INTAKE'&&!/^customer_webhook_[a-f0-9]{64}$/.test(entry.applicationId||'')))return false;
  return (entry.resource!=='site-photo'||id(entry.reportId))&&(entry.resource!=='meta-onboarding'||(existingApiPlanAction(entry.action)?uuid(entry.planId)&&(entry.action!=='prepare_existing_api_plan'||entry.planId===entry.operationId&&Number.isSafeInteger(entry.preparedRevision)&&entry.preparedRevision>=1):['reconcile','cancel'].includes(entry.action)?uuid(entry.signupId):['review_inbox','process_inbox'].includes(entry.action)&&id(entry.eventId)));
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
    ...(entry.resource==='participants'&&entry.action===PARTICIPANT_OFFICE_ASSIGN_ACTION?{action:entry.action}:{}),
    ...(entry.resource==='company-onboarding'?{action:entry.action,expectedClerkOrganizationId:entry.expectedClerkOrganizationId}:{}),
    ...(entry.resource==='site-photo'?{reportId:entry.reportId}:{}),...(entry.resource==='meta-onboarding'?{action:entry.action,...(existingApiPlanAction(entry.action)?{planId:entry.planId}:['reconcile','cancel'].includes(entry.action)?{signupId:entry.signupId}:{eventId:entry.eventId})}:{})});
}
// Inline, so reference-only recovery fixtures retain their existing copy graph.
// This proof acknowledges a saved configuration, never a percentage or another
// action's receipt. Current and historical task snapshots are checked separately.
function measurementRecoveryOutcome(entry,result){
  if(result.operationId!==undefined&&result.operationId!==entry.operationId||result.action!==undefined&&result.action!==entry.action)return null;
  if(result.state==='NOT_OBSERVED'&&result.definitive===false&&result.saved!==true&&!result.receiptId&&!result.task)return {state:'NOT_OBSERVED'};
  if(result.state==='CANCELLED'){
    if(Object.keys(result).sort().join('|')!=='action|kind|operationId|projectId|receiptId|replayed|saved|scope|state|taskId|taskProgressUnchanged'||result.projectId!==entry.projectId||result.operationId!==entry.operationId||result.action!==entry.action||result.kind!=='MEASUREMENT_CONFIGURATION_CANCELLED'||result.saved!==false||typeof result.replayed!=='boolean'||result.taskId!==entry.taskId||result.taskProgressUnchanged!==true||!/^field_[a-f0-9]{64}$/.test(result.receiptId||''))return null;
    return {state:'CANCELLED',receiptId:result.receiptId};
  }
  if(result.projectId!==entry.projectId||result.operationId!==entry.operationId||result.action!==entry.action||result.kind!=='MEASUREMENT_CONFIGURATION'||result.state!=='RECORDED'||result.saved!==true||!/^field_[a-f0-9]{64}$/.test(result.receiptId||''))return null;
  const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
  const decimal=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(value);
  const snapshot=task=>{
    const value=task?.measurement;
    if(task?.id!==entry.taskId||typeof task.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}$/.test(task.revision)||!Number.isFinite(Date.parse(task.revision+'Z'))||!Number.isInteger(task.progress)||task.progress<0||task.progress>100||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='approvedAt|approvedProposalId|baseline|configuredAt|definitionId|executed|sourceReference|unit|version'||value.version!=='task-progress-measurement-v1'||!id(value.definitionId)||!decimal(value.baseline)||!decimal(value.executed)||!['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT'].includes(value.unit)||typeof value.sourceReference!=='string'||value.sourceReference.trim()!==value.sourceReference||value.sourceReference.length<3||value.sourceReference.length>240||/[\u0000-\u001f\u007f<>]/.test(value.sourceReference)||!timestamp(value.configuredAt))return false;
    const baseline=BigInt(value.baseline.replace('.','')),executed=BigInt(value.executed.replace('.',''));
    if(baseline===0n||executed>baseline||Number(executed*100n/baseline)!==task.progress)return false;
    const empty=value.approvedProposalId===null&&value.approvedAt===null;
    return empty?executed===0n:id(value.approvedProposalId)&&timestamp(value.approvedAt);
  };
  const configured=result.configuredTaskSnapshot||result.task;
  if(!snapshot(configured)||!snapshot(result.task)||result.task.revision<configured.revision)return null;
  return {state:'RECORDED',receiptId:result.receiptId};
}

export function recoveryResult(entry, result) {
  if(!valid(entry)||result?.scope!==entry.scope)return null;
  if(result.projectId!==undefined&&result.projectId!==entry.projectId)return null;
  if(entry.resource==='participants'&&result?.state==='FACIAL_PRECOMMIT')return facialPrecommitOutcome(entry,result);
  if(entry.resource==='field-operations'&&entry.action===fieldMeasurementAction)return measurementRecoveryOutcome(entry,result);
  if(entry.resource==='office-review')return officeReviewReceiptOutcome(result,entry);
  if(entry.resource==='project-creation')return projectCreationReceiptOutcome(result,entry);
  if(entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action)){try{validatePrivateBankOutcome(result,entry);return {state:result.state,...(result.receipt?{receiptId:result.receipt.id}:{})};}catch{return null;}}
  if(entry.resource==='participants'&&entry.action===PARTICIPANT_OFFICE_ASSIGN_ACTION)return participantOfficeReceiptOutcome(result,entry);
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
  if(entry.resource==='company-channel'){try{(OWN_COMPANY_ACTIONS.includes(entry.action)?ownCompanyNumberOutcome:OWN_TEMPLATE_ACTIONS.includes(entry.action)?ownTemplatesOutcome:companyChannelOutcome)(result,entry);return result.state==='RECORDED'||result.state==='REJECTED'?{state:result.state,receiptId:result.receiptId}:{state:result.state};}catch{return null;}}
  if(entry.resource==='plan-baseline'){try{return planBaselineOutcome(result,entry);}catch{return null;}}
  if(entry.resource==='project-preparation')return projectPreparationReceiptOutcome(result,entry);
  if(entry.resource==='plan-measurement'&&entry.action!=='UPLOAD')return measurementImportRecoveryOutcome(entry,result);
  if(entry.resource==='plan-import'||entry.resource==='plan-measurement'&&entry.action==='UPLOAD') {
    if(result.projectId!==entry.projectId)return null;
    if(investmentActions.includes(entry.action))return investmentReceiptOutcome(entry,result);
    // A usage reservation is a separate durable observation. Expiring the
    // source-processing lease never proves that its external effect or cost
    // was absent. Keep the original reference for readonly recovery.
    const usage=result.draft?.usage;
    if(result.draft&&Object.hasOwn(result.draft,'usage')&&(!usage||typeof usage!=='object'||Array.isArray(usage)||Object.keys(usage).sort().join('|')!=='coverageState|receiptId|state|version'||usage.version!==1||!/^organization_usage_[a-f0-9]{64}$/.test(usage.receiptId||'')||!['RESERVED','DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED'].includes(usage.state)||!['TRIAL_CURRENT','PAID_PERIOD_OBSERVED','EXPIRED','UNCONFIRMED'].includes(usage.coverageState)))return null;
    const usagePending=usage&&['RESERVED','DISPATCHED','UNKNOWN'].includes(usage.state);
    if(documentCurveActions.includes(entry.action)||entry.action==='REJECT'&&Object.hasOwn(result,'baselineEffects')){
      if(result.state==='NOT_OBSERVED'&&result.definitive===false&&!result.draft&&!result.receiptId)return {state:'NOT_OBSERVED'};
      const outcome=documentCurveReceiptOutcome(entry,result);
      return outcome?.state==='RECORDED'&&usagePending?{state:'PROCESSING'}:outcome;
    }
    if(result.state==='REJECTED'&&result.proof==='AUDITED_UPLOAD'){
      if(Object.keys(result).sort().join('|')!=='action|code|definitive|inputDigest|operationId|phase|projectId|proof|receiptId|recordedAt|replayed|reservationStarted|saved|scope|state|taskEffects|taskSnapshots|tasks'||entry.action!=='UPLOAD'||result.action!=='UPLOAD'||result.operationId!==entry.operationId||result.inputDigest!==entry.inputDigest||!/^[a-f0-9]{64}$/.test(result.inputDigest||'')||result.saved!==false||result.definitive!==true||result.reservationStarted!==false||result.taskEffects!==false||result.phase!=='PRE_RESERVATION'||!planUploadCodes.includes(result.code)||!/^plan_receipt_[a-f0-9]{64}$/.test(result.receiptId||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt)||!Number.isFinite(Date.parse(result.recordedAt))||new Date(result.recordedAt).toISOString()!==result.recordedAt||!Array.isArray(result.tasks)||result.tasks.length||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length)return null;
      return {state:'REJECTED',phase:'PRE_RESERVATION',proof:'AUDITED_UPLOAD',receiptId:result.receiptId,code:result.code};
    }
    if(result.state==='REJECTED'&&result.phase==='PRE_DECISION'){
      if(Object.keys(result).sort().join('|')!=='action|code|definitive|draftId|expectedRevision|inputDigest|operationId|phase|projectId|receiptId|recordedAt|replayed|saved|scope|state|taskEffects|taskSnapshots|tasks'||result.operationId!==entry.operationId||result.saved!==false||result.definitive!==true||result.taskEffects!==false||!planDecisionCodes.includes(result.code)||!/^plan_receipt_[a-f0-9]{64}$/.test(result.receiptId||'')||!planActions.includes(result.action)||!id(result.draftId)||!Number.isSafeInteger(result.expectedRevision)||result.expectedRevision<1||!/^[a-f0-9]{64}$/.test(result.inputDigest||'')||typeof result.replayed!=='boolean'||typeof result.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt)||!Number.isFinite(Date.parse(result.recordedAt))||!Array.isArray(result.tasks)||result.tasks.length||!Array.isArray(result.taskSnapshots)||result.taskSnapshots.length||entry.action!==undefined&&(result.action!==entry.action||result.draftId!==entry.draftId||result.expectedRevision!==entry.expectedRevision||result.inputDigest!==entry.inputDigest))return null;
      return {state:'REJECTED',phase:'PRE_DECISION',receiptId:result.receiptId,code:result.code};
    }
    if(result.state==='EXPIRED'){
      const draft=result.draft,expiry=draft?.processingExpiresAt;
      if(Object.keys(result).sort().join('|')!=='definitive|draft|operationId|projectId|saved|scope|state'||result.operationId!==entry.operationId||result.saved!==false||result.definitive!==true||!id(draft?.id)||!Number.isSafeInteger(draft.revision)||draft.revision<1||!Array.isArray(draft.rows)||!['UPLOADING','PROCESSING'].includes(draft.status)||draft.processingExpired!==true||typeof expiry!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString()!==expiry||Date.parse(expiry)>Date.now())return null;
      return usagePending?{state:'PROCESSING'}:{state:'EXPIRED',draftId:draft.id};
    }
    if(result.state==='REJECTED'&&result.operationId===entry.operationId&&result.definitive===true&&result.saved===false&&result.reservationStarted===false&&result.phase==='PRE_RESERVATION'&&['PLAN_IMPORT_FILE_INVALID','PLAN_IMPORT_FILE_TOO_LARGE'].includes(result.code)&&Object.keys(result).sort().join('|')==='code|definitive|operationId|phase|projectId|reservationStarted|saved|scope|state')return {state:'REJECTED',code:result.code};
    if(result.state==='NOT_OBSERVED'&&result.definitive===false&&!result.draft&&!result.receiptId)return {state:'NOT_OBSERVED'};
    const draft=result.draft;
    if(!(result.state==='RECORDED'||result.saved===true)||!id(draft?.id)||!Number.isSafeInteger(draft.revision)||draft.revision<1||!Array.isArray(draft.rows)||!['UPLOADING','PROCESSING','READY','FAILED','APPLIED','REJECTED'].includes(draft.status))return null;
    if(usagePending)return {state:'PROCESSING'};
    if(result.receiptId!==undefined){
      if(result.saved!==true||!id(result.receiptId)||!planActions.includes(result.action)||draft.status!==({EDIT:'READY',APPLY:'APPLIED',REJECT:'REJECTED',REVIEW_CURVE:'READY',APPLY_CURVE:'APPLIED'})[result.action]||!Array.isArray(result.tasks))return null;
      if(documentCurveActions.includes(result.action)){try{if(!planDocumentDraftView(draft)||result.tasks.length||result.action==='APPLY_CURVE'&&draft.documentReviewed!==true)return null;}catch{return null;}}
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
  if(entry.resource==='meta-onboarding'&&existingApiPlanAction(entry.action))return existingApiPlanReceiptOutcome(result,entry);
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
const sameScheduleEntry=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key]===b[key]);
// Ephemeral only: bind the exact in-flight schedule command to its own ticket.
// Persisted references remain unchanged and never contain dates or reasons.
async function rejectedScheduleIdentity(url,options,entry){
  if(url!=='/api/identity/workspace'||options?.method!=='POST'||entry?.resource!=='workspace'||typeof options.body!=='string')return null;
  let body;try{body=JSON.parse(options.body);}catch{return null;}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!=='endsOn|expectedRevision|operationId|projectId|reason|scope|startsOn|taskId'||body.scope!==entry.scope||body.projectId!==entry.projectId||!uuid(body.operationId)||body.operationId.toLowerCase()!==entry.operationId||!id(body.taskId)||typeof body.expectedRevision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(body.expectedRevision)||typeof body.startsOn!=='string'||typeof body.endsOn!=='string'||typeof body.reason!=='string')return null;
  let inputDigest;try{inputDigest=await sha256(new TextEncoder().encode(JSON.stringify(['schedule-rejection-command-v1',entry.scope,entry.projectId,entry.operationId,body.taskId,body.expectedRevision,body.startsOn,body.endsOn,body.reason])));}catch{throw unavailable();}
  return {inputDigest};
}
// An attendance retry may release only its original in-memory command after
// the current transport captured its exact definitive revision rejection.
// Neither QR nor coordinates enter persistent recovery storage.
async function rejectedAttendanceIdentity(url,options,entry){
  if(url!=='/api/identity/field-operations'||options?.method!=='POST'||entry?.resource!=='field-operations'||typeof options.body!=='string')return null;
  let body;try{body=JSON.parse(options.body);}catch{return null;}
  const p=body?.payload;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!=='action|operationId|payload|projectId|scope'||body.action!=='ATTENDANCE'||body.scope!==entry.scope||body.projectId!==entry.projectId||!uuid(body.operationId)||body.operationId.toLowerCase()!==entry.operationId||!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join('|')!=='eventType|expectedEventId|location|qrToken|sectorId|workerId'||!['CHECK_IN','BREAK_START','BREAK_END','CHECK_OUT'].includes(p.eventType)||!id(p.workerId)||!id(p.sectorId)||p.expectedEventId!==null&&!id(p.expectedEventId)||p.qrToken!==null&&!/^[a-f0-9]{64}$/.test(p.qrToken))return null;
  const point=p.location;
  if(point!==null&&(!point||typeof point!=='object'||Array.isArray(point)||Object.keys(point).sort().join('|')!=='accuracy|capturedAt|latitude|longitude|noticeVersion'||![point.latitude,point.longitude,point.accuracy].every(value=>typeof value==='number'&&Number.isFinite(value))||typeof point.capturedAt!=='string'||point.noticeVersion!=='field-location-v1'))return null;
  let inputDigest;try{inputDigest=await sha256(new TextEncoder().encode(JSON.stringify(['attendance-rejection-command-v1',entry.scope,entry.projectId,entry.operationId,p.workerId,p.eventType,p.expectedEventId,p.sectorId,p.qrToken,point===null?null:[point.latitude,point.longitude,point.accuracy,point.capturedAt,point.noticeVersion]])));}catch{throw unavailable();}
  return {inputDigest};
}
// A current company-phone rejection binds only a newly reserved command.
// No number, command digest or expected revision enters persistent references.
async function rejectedCompanyPhoneIdentity(url,options,entry){
  if(url!=='/api/identity/company-onboarding'||options?.method!=='POST'||entry?.resource!=='company-onboarding'||typeof options.body!=='string')return null;
  let body;try{body=JSON.parse(options.body);}catch{return null;}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!=='action|companyPhone|confirmDeclaration|expectedClerkOrganizationId|expectedRevision|operationId|projectId|scope'||body.action!=='declare_company_phone'||body.action!==entry.action||body.scope!==entry.scope||body.projectId!==entry.projectId||!uuid(body.operationId)||body.operationId.toLowerCase()!==entry.operationId||body.expectedClerkOrganizationId!==entry.expectedClerkOrganizationId||!id(body.expectedClerkOrganizationId)||typeof body.companyPhone!=='string'||!/^\+[1-9]\d{7,14}$/.test(body.companyPhone)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||body.expectedRevision>=Number.MAX_SAFE_INTEGER||body.confirmDeclaration!==true)return null;
  let inputDigest;try{inputDigest=await sha256(new TextEncoder().encode(JSON.stringify(['company-phone-rejection-command-v1',body.action,entry.scope,entry.projectId,entry.operationId,body.expectedClerkOrganizationId,body.expectedRevision,body.companyPhone,body.confirmDeclaration])));}catch{throw unavailable();}
  return {inputDigest};
}
// Inline so the shared journal's copied browser graph stays unchanged. Only
// this pre-storage image gate has this exact response and closed reason set.
const captureQualityRejectionReasons=new Set(['DOCUMENT_FRAME_UNCONFIRMED','DOCUMENT_OUT_OF_FRAME','DOCUMENT_TOO_SMALL','DOCUMENT_PORTRAIT_UNCONFIRMED','FACE_OUT_OF_FRAME','FACE_TOO_SMALL','IMAGE_BLURRED','IMAGE_DECODE_FAILED','IMAGE_LOW_CONTRAST','IMAGE_TOO_BRIGHT','IMAGE_TOO_DARK','IMAGE_TOO_SMALL','QUALITY_SERVICE_UNAVAILABLE','SINGLE_FACE_REQUIRED']);
const captureQualityRejectionCode=value=>typeof value==='string'&&['DOCUMENT_FRONT','DOCUMENT_BACK','SELFIE'].some(kind=>{const prefix='PARTICIPANT_CAPTURE_'+kind+'_',reason=value.slice(prefix.length);return value.startsWith(prefix)&&captureQualityRejectionReasons.has(reason)&&(reason!=='DOCUMENT_PORTRAIT_UNCONFIRMED'||kind==='DOCUMENT_FRONT');});
const captureQualityObservationActive=observation=>{try{return Boolean(observation?.signal&&!observation.signal.aborted&&typeof observation.isActive==='function'&&observation.isActive()===true);}catch{return false;}};
async function rejectedCaptureQualityIdentity(url,options,entry){
  if(url!=='/api/identity/participants'||options?.method!=='POST'||entry?.resource!=='participants'||typeof options.body!=='string')return null;
  let body;try{body=JSON.parse(options.body);}catch{return null;}
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const ocr=['ocrConsent','ocrNoticeVersion'].some(key=>Object.hasOwn(body,key)),biometric=['biometricConsent','biometricNoticeVersion'].some(key=>Object.hasOwn(body,key)),back=['back','backConsent','backNoticeVersion','backNoticeSha256'].some(key=>Object.hasOwn(body,key));
  const precommit=body.biometricNoticeVersion==='participant-private-biometric-v3',manualFrom=precommit&&Object.hasOwn(body,'biometricManualFromOperationId');
  const keys=['operationId','projectId','scope','workerId','revision','noticeVersion','consent','front','selfie',...(ocr?['ocrConsent','ocrNoticeVersion']:[]),...(biometric?['biometricConsent','biometricNoticeVersion']:[]),...(back?['back','backConsent','backNoticeVersion','backNoticeSha256']:[]),...(precommit?['biometricMode',...(manualFrom?['biometricManualFromOperationId']:[])]:[])];
  const image=value=>typeof value==='string'&&value.length>0&&value.length<=Math.ceil(2*1024*1024/3)*4+64;
  if(!existingApiPlanExact(body,keys)||body.scope!==entry.scope||body.projectId!==entry.projectId||!uuid(body.operationId)||body.operationId.toLowerCase()!==entry.operationId||!id(body.workerId)||typeof body.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(body.revision)||body.noticeVersion!=='participant-kyc-v1'||body.consent!==true||!image(body.front)||!image(body.selfie)||ocr&&(typeof body.ocrConsent!=='boolean'||!['participant-external-ocr-v1','participant-external-ocr-v2'].includes(body.ocrNoticeVersion))||biometric&&(typeof body.biometricConsent!=='boolean'||!['participant-private-biometric-v1','participant-private-biometric-v2','participant-private-biometric-v3'].includes(body.biometricNoticeVersion))||back&&(!image(body.back)||body.backConsent!==true||body.backNoticeVersion!=='participant-kyc-document-back-v1'||!scopeValid(body.backNoticeSha256)))return null;
  if(precommit&&(!['ASSISTED','MANUAL'].includes(body.biometricMode)||body.biometricConsent!==(body.biometricMode==='ASSISTED')||manualFrom&&(body.biometricMode!=='MANUAL'||!uuid(body.biometricManualFromOperationId)||body.biometricManualFromOperationId.toLowerCase()===body.operationId.toLowerCase())))return null;
  let inputDigest;try{inputDigest=await sha256(new TextEncoder().encode(JSON.stringify([precommit?'participant-capture-quality-rejection-v2':'participant-capture-quality-rejection-v1',canonicalPlanCommand(body)])));}catch{throw unavailable();}
  return {inputDigest};
}

// A technical manual closure is not a saved KYC receipt. Only an observed,
// bounded HTTP response may release its old browser reference.
const facialManualClosedResults=new WeakMap();
function facialPrecommitOutcome(entry,result){
 const base=['scope','projectId','operationId','state','saved','definitive','facial'];
 if(entry?.resource!=='participants'||entry.action!==undefined||!existingApiPlanExact(result,base)||result.scope!==entry.scope||result.projectId!==entry.projectId||result.operationId!==entry.operationId||result.state!=='FACIAL_PRECOMMIT'||result.saved!==false||result.definitive!==false)return null;
 const f=result.facial,phases=['PREPARING','MODEL_UNKNOWN','PERSISTENCE_UNKNOWN','READY','REJECTED','CLOSED_MANUAL'],closed=f?.phase==='CLOSED_MANUAL';
 if(!phases.includes(f?.phase)||!existingApiPlanExact(f,['phase','canContinueManual','privateObjectsMayExist',...(closed?['closedReceiptId','successorOperationId']:[])])||typeof f.canContinueManual!=='boolean'||typeof f.privateObjectsMayExist!=='boolean')return null;
 if(closed&&(f.canContinueManual!==false||!/^participant_facial_[a-f0-9]{64}$/.test(f.closedReceiptId)||!uuid(f.successorOperationId)||f.successorOperationId!==f.successorOperationId.toLowerCase()||f.successorOperationId===entry.operationId))return null;
 return {state:'FACIAL_PRECOMMIT',...f};
}
function facialLookupReference(url,options){
 if(typeof url!=='string'||!url.startsWith('/api/identity/participants?')||options?.body!==undefined||options?.method!==undefined&&options.method!=='GET')return null;
 const params=new URLSearchParams(url.slice(url.indexOf('?')+1)),keys=['scope','projectId','operationId'];
 if(params.size!==3||[...params.keys()].some(key=>!keys.includes(key)||params.getAll(key).length!==1)||!scopeValid(params.get('scope'))||!id(params.get('projectId'))||!uuid(params.get('operationId'))||params.get('operationId')!==params.get('operationId').toLowerCase()||url.includes('#'))return null;
 return {scope:params.get('scope'),projectId:params.get('projectId'),operationId:params.get('operationId')};
}
function manualFacialResolution(options,qualityIdentity){
 if(!qualityIdentity||options?.method!=='POST'||typeof options.body!=='string')return null;
 try{const body=JSON.parse(options.body);return body.biometricNoticeVersion==='participant-private-biometric-v3'&&body.biometricMode==='MANUAL'&&body.biometricConsent===false&&uuid(body.biometricManualFromOperationId)?body.biometricManualFromOperationId.toLowerCase():null;}catch{return null;}
}
async function facialClosedHttpBody(prepared,url,options,response,observation){
 if(url!==prepared.url||!facialLookupReference(url,options)||!captureQualityObservationActive(observation)||response?.status!==200||response.redirected===true||response.headers?.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')return null;
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>4096))return null;
 try{if(response.url){if(!globalThis.location)return null;const target=new URL(url,globalThis.location.origin),actual=new URL(response.url);if(actual.href!==target.href||actual.origin!==globalThis.location.origin)return null;}}catch{return null;}
 let reader,onAbort;
 try{
  reader=response.clone().body?.getReader();if(!reader)return null;
  const {signal}=observation;let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
  onAbort=()=>{rejectAbort(new DOMException('La consulta se canceló.','AbortError'));void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)return null;
  const decoder=new TextDecoder('utf-8',{fatal:true});let text='',bytes=0;
  for(;;){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;if(!(part.value instanceof Uint8Array))return null;bytes+=part.value.byteLength;if(bytes>4096)return null;text+=decoder.decode(part.value,{stream:true});}
  text+=decoder.decode();const body=JSON.parse(text),current=facialLookupReference(url,options),outcome=facialPrecommitOutcome(prepared.entry,body);
  if(!captureQualityObservationActive(observation)||!current||current.scope!==prepared.entry.scope||current.projectId!==prepared.entry.projectId||current.operationId!==prepared.entry.operationId||outcome?.phase!=='CLOSED_MANUAL')return null;
  return {digest:await sha256(new TextEncoder().encode(JSON.stringify(canonicalPlanCommand(body)))),outcome,observation:{signal:observation.signal,isActive:observation.isActive}};
 }catch{return null;}
 finally{if(onAbort)observation.signal?.removeEventListener('abort',onAbort);if(reader){void reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}}
}
export async function wasFacialManualReferenceClosed(value,context){
 try{
  const proof=value&&typeof value==='object'?facialManualClosedResults.get(value):null;
  if(!proof||!existingApiPlanExact(context,['scope','projectId','operationId','successorOperationId'])||!captureQualityObservationActive(proof.observation)||context.scope!==proof.entry.scope||context.projectId!==proof.entry.projectId||context.operationId!==proof.entry.operationId||context.successorOperationId!==proof.successorOperationId||facialPrecommitOutcome(proof.entry,value)?.phase!=='CLOSED_MANUAL')return false;
  return await sha256(new TextEncoder().encode(JSON.stringify(canonicalPlanCommand(value))))===proof.digest;
 }catch{return false;}
}

const companyPhoneRejectedErrors=new WeakMap();
const captureQualityRejectedErrors=new WeakMap();
export async function wasCaptureQualityRejected(error,url,options){
  const proof=error&&typeof error==='object'?captureQualityRejectedErrors.get(error):null;if(!proof||error.status!==proof.status||error.code!==proof.code)return false;
  try{const body=options?.body,method=options?.method,current=await rejectedCaptureQualityIdentity(url,options,proof.entry);return Boolean(current&&current.inputDigest===proof.identity.inputDigest&&options?.body===body&&options?.method===method&&error.status===proof.status&&error.code===proof.code);}catch{return false;}
}
export async function wasCompanyPhoneRevisionRejected(error,url,options){
  const proof=error&&typeof error==='object'?companyPhoneRejectedErrors.get(error):null;if(!proof)return false;
  try{const current=await rejectedCompanyPhoneIdentity(url,options,proof.entry);return Boolean(current&&current.inputDigest===proof.identity.inputDigest);}catch{return false;}
}
export function createWorkspaceRecoveryJournal({getStorage,withStorage,now=Date.now,notify=()=>{},withLock}) {
  const scheduleTickets=new WeakMap(),scheduleReferences=new Map(),attendanceTickets=new WeakMap(),attendanceReferences=new Map();
  const companyPhoneTickets=new WeakMap(),captureQualityTickets=new WeakMap(),facialLookupTickets=new WeakMap(),facialSubmissionTickets=new WeakMap();
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
  async function remove(entry,observation) {
    try {
      if(observation&&(observation.signal?.aborted||!observation.isActive()))return false;
      const removed=await access('readwrite',entry.scope,s=>{
        const key=keyOf(entry),raw=s.getItem(key);if(raw===null)return false;
        const stored=validateWorkspaceRecoveryStoredEntry(key,raw);
        if(!Object.keys(entry).every(field=>field==='actionReference'?entry[field]?.proposalId===stored[field]?.proposalId&&entry[field]?.revision===stored[field]?.revision:entry[field]===stored[field]))return false;
        if(observation&&(observation.signal?.aborted||!observation.isActive()))return false;
        s.removeItem(key);return true;
      },observation?.signal);
      if(removed){scheduleReferences.delete(keyOf(entry));attendanceReferences.delete(keyOf(entry));notify();}return removed;
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
      const lookup=facialLookupReference(url,options);
      if(lookup){const entry=(await list(lookup.scope)).find(row=>row.resource==='participants'&&row.action===undefined&&row.projectId===lookup.projectId&&row.operationId===lookup.operationId);if(!entry)return null;const ticket={entry,existed:true};facialLookupTickets.set(ticket,{entry:{...entry},url,observed:null});return ticket;}
      const entry=await reference(url,options,now());if(!entry)return null;
      const scheduleIdentity=await rejectedScheduleIdentity(url,options,entry),attendanceIdentity=await rejectedAttendanceIdentity(url,options,entry);
      const companyPhoneIdentity=await rejectedCompanyPhoneIdentity(url,options,entry);
      const captureQualityIdentity=await rejectedCaptureQualityIdentity(url,options,entry);
      const reserve=()=>access('readwrite',entry.scope,s=>{
      if(options.signal?.aborted)throw Object.assign(new DOMException('La consulta se canceló.','AbortError'),{requestDispatched:false});
      const current=readEntries(s,entry.scope),existing=current.find(row=>keyOf(row)===keyOf(entry));
      if(existing){if(existing.projectId!==entry.projectId||existing.taskId!==entry.taskId||existing.reportId!==entry.reportId||existing.eventId!==entry.eventId||existing.action!==entry.action||existing.draftId!==entry.draftId||existing.expectedRevision!==entry.expectedRevision||existing.inputDigest!==entry.inputDigest||existing.connectionId!==entry.connectionId||existing.expectedClerkOrganizationId!==entry.expectedClerkOrganizationId||existing.signupId!==entry.signupId||existing.planId!==entry.planId||existing.preparedRevision!==entry.preparedRevision||existing.templateKey!==entry.templateKey||existing.workerId!==entry.workerId||existing.actionReference?.proposalId!==entry.actionReference?.proposalId||existing.actionReference?.revision!==entry.actionReference?.revision)throw failure('WORKSPACE_RECOVERY_CONFLICT','Este identificador corresponde a otro intento. Comprobá el recibo antes de continuar.');return {entry:existing,existed:true};}
      const pending=current.find(row=>row.resource===entry.resource&&(['company-channel','company-onboarding','project-creation'].includes(entry.resource)||row.projectId===entry.projectId)&&(entry.resource!=='meta-onboarding'||existingApiPlanAction(entry.action)||existingApiPlanAction(row.action)||entry.action==='reconcile'||row.eventId===entry.eventId));
      let resolution=false;
      if(entry.resource==='participants'&&typeof options.body==='string'){try{resolution=JSON.parse(options.body).action==='REVOKE';}catch{ /* The server rejects malformed commands. */ }}
      const manualFrom=manualFacialResolution(options,captureQualityIdentity),manualResolution=pending?.resource==='participants'&&pending.action===undefined&&pending.projectId===entry.projectId&&pending.operationId===manualFrom&&manualFrom!==entry.operationId;
      if(pending&&!resolution&&!manualResolution)throw failure('WORKSPACE_RECOVERY_REQUIRED','Hay un envío anterior sin confirmar en este módulo. Comprobá su recibo en Operaciones por comprobar antes de iniciar otro.');
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
      if(scheduleIdentity){
        const key=keyOf(ticket.entry);let original=scheduleReferences.get(key);
        if(!ticket.existed){original={entry:{...ticket.entry},identity:scheduleIdentity};scheduleReferences.set(key,original);}
        if(original&&sameScheduleEntry(ticket.entry,original.entry)&&original.identity.inputDigest===scheduleIdentity.inputDigest)scheduleTickets.set(ticket,{...original,rejected:false});
      }
      if(attendanceIdentity){
        const key=keyOf(ticket.entry);let original=attendanceReferences.get(key);
        if(!ticket.existed){original={entry:{...ticket.entry},identity:attendanceIdentity};attendanceReferences.set(key,original);}
        if(original&&sameScheduleEntry(ticket.entry,original.entry)&&original.identity.inputDigest===attendanceIdentity.inputDigest)attendanceTickets.set(ticket,{...original,rejected:false});
      }
      if(companyPhoneIdentity&&!ticket.existed)companyPhoneTickets.set(ticket,{entry:{...ticket.entry},identity:companyPhoneIdentity,rejected:false});
      if(captureQualityIdentity&&!ticket.existed)captureQualityTickets.set(ticket,{entry:{...ticket.entry},identity:captureQualityIdentity});
      if(captureQualityIdentity&&JSON.parse(options.body).biometricNoticeVersion==='participant-private-biometric-v3')facialSubmissionTickets.set(ticket,true);
      if(!ticket.existed)notify();return ticket;
    },
    async captureResponse(ticket,url,options,response,observation={}){
      const facial=facialLookupTickets.get(ticket);if(facial){facial.observed=await facialClosedHttpBody(facial,url,options,response,observation);return;}
      const quality=captureQualityTickets.get(ticket);
      if(quality){
        const {signal,isActive}=observation;let reader,onAbort;
        try{
          if(!captureQualityObservationActive(observation)||![422,503].includes(response?.status)||response.redirected===true||response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')return;
          if(response.url){const received=new URL(response.url);if(!globalThis.location||received.origin!==globalThis.location.origin||received.pathname!==url||received.search||received.hash)return;}
          const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>4096))return;
          const current=await rejectedCaptureQualityIdentity(url,options,quality.entry);if(!current||current.inputDigest!==quality.identity.inputDigest||!captureQualityObservationActive(observation))return;
          reader=response.clone().body?.getReader();if(!reader)return;
          let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
          onAbort=()=>{rejectAbort(new DOMException('La consulta se canceló.','AbortError'));reader.cancel().catch(()=>{});response.body?.cancel().catch(()=>{});};
          signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted){reader.cancel().catch(()=>{});response.body?.cancel().catch(()=>{});return;}
          const decoder=new TextDecoder('utf-8',{fatal:true});let text='',bytes=0;
          while(true){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;if(!(part.value instanceof Uint8Array))return;bytes+=part.value.byteLength;if(bytes>4096)return;text+=decoder.decode(part.value,{stream:true});}
          text+=decoder.decode();const body=JSON.parse(text),after=await rejectedCaptureQualityIdentity(url,options,quality.entry);
          if(!captureQualityObservationActive(observation)||!after||after.inputDigest!==quality.identity.inputDigest||!existingApiPlanExact(body,['saved','identityCertified','code'])||body.saved!==false||body.identityCertified!==false||!captureQualityRejectionCode(body.code))return;
          quality.rejected={status:response.status,code:body.code};quality.observation={signal,isActive};quality.request={url,options};
        }catch{/* An unreadable or interrupted response cannot release a capture. */}
        finally{if(onAbort)signal?.removeEventListener('abort',onAbort);if(reader){reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}}
        return;
      }
      const {signal,isActive=()=>true}=observation;
      const companyPhone=companyPhoneTickets.has(ticket),prepared=companyPhoneTickets.get(ticket)||scheduleTickets.get(ticket)||attendanceTickets.get(ticket),attendance=attendanceTickets.has(ticket);
      if(companyPhone){
        if(!signal||typeof observation.isActive!=='function'||response?.redirected===true||response?.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')return;
        try{if(response.url){const received=new URL(response.url);if(!globalThis.location||received.origin!==globalThis.location.origin||received.pathname!==url||received.search||received.hash)return;}}catch{return;}
      }
      if(!prepared||response?.status!==409||!response.headers.get('content-type')?.includes('application/json')||signal?.aborted||!isActive())return;
      let reader,onAbort;
      try{
        const current=await (companyPhone?rejectedCompanyPhoneIdentity:attendance?rejectedAttendanceIdentity:rejectedScheduleIdentity)(url,options,prepared.entry);
        if(!current||current.inputDigest!==prepared.identity.inputDigest||signal?.aborted||!isActive())return;
        reader=response.clone().body?.getReader();if(!reader)return;
        let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
        onAbort=()=>{rejectAbort(new DOMException('La consulta se canceló.','AbortError'));reader.cancel().catch(()=>{});response.body?.cancel().catch(()=>{});};
        signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted){reader.cancel().catch(()=>{});response.body?.cancel().catch(()=>{});return;}
        const decoder=new TextDecoder('utf-8',{fatal:true});let text='',bytes=0;
        while(true){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096)return;text+=decoder.decode(part.value,{stream:true});}
        text+=decoder.decode();const body=JSON.parse(text);
        if(companyPhone){
          if(!signal?.aborted&&isActive()&&body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).sort().join('|')==='code|created'&&body.created===false&&body.code==='COMPANY_PHONE_CONFLICT'){prepared.rejected=true;prepared.observation={signal,isActive};}
        }else if(!signal?.aborted&&isActive()&&body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).sort().join('|')==='code|saved'&&body.saved===false&&body.code===(attendance?'ATTENDANCE_REVISION_CHANGED':'SCHEDULE_REVISION_CHANGED'))prepared.rejected=true;
      }catch{/* An unreadable, oversized or interrupted response supplies no proof. */}
      finally{if(onAbort)signal?.removeEventListener('abort',onAbort);if(reader){reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}}
    },
    async settle(ticket, result, error) {
      if(!ticket)return;
      const facial=facialLookupTickets.get(ticket);facialLookupTickets.delete(ticket);
      if(facial){
        const observed=facial.observed,outcome=facialPrecommitOutcome(facial.entry,result);
        if(!error&&observed&&outcome?.phase==='CLOSED_MANUAL'&&captureQualityObservationActive(observed.observation)){
          let digest;try{digest=await sha256(new TextEncoder().encode(JSON.stringify(canonicalPlanCommand(result))));}catch{return;}
          if(digest===observed.digest&&captureQualityObservationActive(observed.observation)&&await remove(facial.entry,observed.observation)&&captureQualityObservationActive(observed.observation))facialManualClosedResults.set(result,{entry:facial.entry,digest,successorOperationId:outcome.successorOperationId,observation:observed.observation});
        }
        return;
      }
      const schedule=scheduleTickets.get(ticket),attendance=attendanceTickets.get(ticket);scheduleTickets.delete(ticket);attendanceTickets.delete(ticket);
      const companyPhone=companyPhoneTickets.get(ticket);companyPhoneTickets.delete(ticket);
      const captureQuality=captureQualityTickets.get(ticket);captureQualityTickets.delete(ticket);
      const facialSubmission=facialSubmissionTickets.get(ticket);facialSubmissionTickets.delete(ticket);
      if(error){
        if(captureQuality?.rejected&&!ticket.existed&&ticket.entry.resource==='participants'&&sameScheduleEntry(ticket.entry,captureQuality.entry)&&error.status===captureQuality.rejected.status&&error.code===captureQuality.rejected.code&&error.requestDispatched!==false&&captureQualityObservationActive(captureQuality.observation)){
          let current;try{current=await rejectedCaptureQualityIdentity(captureQuality.request.url,captureQuality.request.options,captureQuality.entry);}catch{}
          if(current?.inputDigest===captureQuality.identity.inputDigest&&captureQualityObservationActive(captureQuality.observation)&&await remove(captureQuality.entry,captureQuality.observation)&&captureQualityObservationActive(captureQuality.observation))captureQualityRejectedErrors.set(error,{entry:captureQuality.entry,identity:captureQuality.identity,status:error.status,code:error.code});return;
        }
        // A facial uncertainty or authority code after dispatch cannot release
        // a v3 reference. Its durable stage must be reconciled independently.
        if(facialSubmission&&error.requestDispatched!==false)return;
        // A capture code alone is not proof that no image was committed. Do
        // not let the general 4xx cleanup bypass the exact observed envelope.
        if(captureQuality&&error.requestDispatched!==false&&(error.status===422||error.status===503||typeof error.code==='string'&&(error.code.startsWith('PARTICIPANT_CAPTURE_')||error.code==='PARTICIPANT_OPERATION_UNCONFIRMED')))return;
        if(ticket.entry.resource==='field-operations'&&ticket.entry.action===fieldMeasurementAction){if(!ticket.existed&&(error.requestDispatched===false||error.definitiveConfigurationRejection===true))await remove(ticket.entry);return;}
        if(companyPhone?.rejected===true&&!ticket.existed&&ticket.entry.resource==='company-onboarding'&&sameScheduleEntry(ticket.entry,companyPhone.entry)&&error.status===409&&error.code==='COMPANY_PHONE_CONFLICT'&&error.requestDispatched!==false&&!companyPhone.observation.signal?.aborted&&companyPhone.observation.isActive()){
          if(await remove(companyPhone.entry,companyPhone.observation)&&!companyPhone.observation.signal?.aborted&&companyPhone.observation.isActive())companyPhoneRejectedErrors.set(error,{entry:companyPhone.entry,identity:companyPhone.identity});return;
        }
        if(attendance?.rejected===true&&ticket.entry.resource==='field-operations'&&sameScheduleEntry(ticket.entry,attendance.entry)&&error.status===409&&error.code==='ATTENDANCE_REVISION_CHANGED'&&error.attendanceRevisionRejected===true&&error.requestDispatched!==false){await remove(attendance.entry);return;}
        if(schedule?.rejected===true&&ticket.entry.resource==='workspace'&&sameScheduleEntry(ticket.entry,schedule.entry)&&error.status===409&&error.code==='SCHEDULE_REVISION_CHANGED'&&error.scheduleRevisionRejected===true&&error.requestDispatched!==false){await remove(schedule.entry);return;}
        if(ticket.entry.resource==='participants'&&ticket.entry.action===PARTICIPANT_OFFICE_ASSIGN_ACTION){if(!ticket.existed&&(error.requestDispatched===false||participantOfficePrecommitRejected(error)))await remove(ticket.entry);return;}
        if(ticket.entry.resource==='plan-baseline'&&error.requestDispatched!==false){if(recoveryResult(ticket.entry,error.result)?.state==='REJECTED')await remove(ticket.entry);return;}
        if(ticket.entry.resource==='plan-measurement'&&ticket.entry.action!=='UPLOAD'&&error.requestDispatched!==false){if(error.status===409&&error.code===error.result?.code&&recoveryResult(ticket.entry,error.result)?.state==='REJECTED')await remove(ticket.entry);return;}
        if(ticket.entry.resource==='meta-onboarding'&&existingApiPlanAction(ticket.entry.action)){if(!ticket.existed&&error.requestDispatched===false)await remove(ticket.entry);return;}
        if(['office-review','project-creation'].includes(ticket.entry.resource)&&error.requestDispatched!==false)return;
        const rejected=['plan-import','plan-measurement'].includes(ticket.entry.resource)&&recoveryResult(ticket.entry,error.result)?.state==='REJECTED'&&error.code===error.result.code&&error.status===({PLAN_IMPORT_FILE_INVALID:400,PLAN_IMPORT_FILE_TOO_LARGE:413})[error.code];
        if(!ticket.existed&&(error.requestDispatched===false||rejected||!['plan-import','plan-measurement','company-channel','company-onboarding'].includes(ticket.entry.resource)&&!(ticket.entry.resource==='participants'&&(PRIVATE_BANK_ACTIONS.includes(ticket.entry.action)||PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(ticket.entry.action)))&&!(ticket.entry.resource==='meta-onboarding'&&ticket.entry.action==='reconcile')&&error.status>=400&&error.status<500))await remove(ticket.entry);return;
      }
      const entry=ticket.entry;
      if(entry.resource==='plan-baseline'){if(['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(['office-review','project-creation'].includes(entry.resource)){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='participants'&&PARTICIPANT_INTAKE_RECOVERY_ACTIONS.includes(entry.action)){if(['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='participants'&&entry.action===PARTICIPANT_OFFICE_ASSIGN_ACTION){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      // A general Meta snapshot is not a receipt for this operation.
      if(entry.resource==='meta-onboarding'){if((existingApiPlanAction(entry.action)||['reconcile','cancel'].includes(entry.action))&&['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='template-send'){if(['ACCEPTED','STATUS_OBSERVED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='site-purchases'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='project-preparation'){if(['RECORDED','CANCELLED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='constructor-crm'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='participants'&&PRIVATE_BANK_ACTIONS.includes(entry.action)){if(['RECORDED','REJECTED','CANCELLED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='company-onboarding'){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='company-channel'){if(['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='plan-measurement'&&entry.action!=='UPLOAD'){if(['RECORDED','REJECTED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(entry.resource==='plan-import'||entry.resource==='plan-measurement'&&entry.action==='UPLOAD'){const outcome=recoveryResult(entry,result);if(outcome?.state==='RECORDED'||outcome?.state==='REJECTED'&&(outcome.phase==='PRE_DECISION'||outcome.proof==='AUDITED_UPLOAD'||!ticket.existed))await remove(entry);return;}
      if(entry.resource==='field-operations'&&FIELD_OVERTIME_RECOVERY_ACTIONS.includes(entry.action)){if(recoveryResult(entry,result)?.state==='RECORDED')await remove(entry);return;}
      if(entry.resource==='field-operations'&&entry.action===fieldMeasurementAction){if(['RECORDED','CANCELLED'].includes(recoveryResult(entry,result)?.state))await remove(entry);return;}
      if(result?.scope===entry.scope&&(result.projectId===undefined||result.projectId===entry.projectId)&&(result.saved===true||result.created===true)&&(result.receiptId||result.receipt?.id))await remove(entry);
    },
    async observe(url, result) {
      const resource=resourceOf(url);if(!resource||!url.includes('?'))return;
      const params=new URLSearchParams(url.slice(url.indexOf('?')+1));
      const scope=params.get('scope'),operationId=params.get('operationId');if(!scopeValid(scope)||!uuid(operationId))return;
      const entry=(await list(scope)).find(row=>row.resource===resource&&row.operationId===operationId.toLowerCase());
      if(!entry||params.get('projectId')!==entry.projectId)return;
      if(entry.resource==='company-onboarding'&&(params.get('expectedClerkOrganizationId')!==entry.expectedClerkOrganizationId||params.get('action')!==entry.action))return;
      if(entry.resource==='participants'&&entry.action===PARTICIPANT_OFFICE_ASSIGN_ACTION&&params.get('action')!==entry.action)return;
      if(entry.resource==='meta-onboarding'&&['reconcile','cancel'].includes(entry.action)&&(params.get('action')!==entry.action||params.get('signupId')!==entry.signupId))return;
      if(entry.resource==='meta-onboarding'&&existingApiPlanAction(entry.action)&&(params.size!==5||[...params.keys()].some(key=>!['projectId','scope','operationId','action','planId'].includes(key)||params.getAll(key).length!==1)||params.get('action')!==entry.action||params.get('planId')!==entry.planId))return;
      const outcome=recoveryResult(entry,result);
      // A pre-reservation POST rejection cannot settle an earlier attempt via GET.
      if(['plan-import','plan-measurement'].includes(entry.resource)&&outcome?.state==='REJECTED'&&outcome.phase!=='PRE_DECISION'&&outcome.proof!=='AUDITED_UPLOAD')return;
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
