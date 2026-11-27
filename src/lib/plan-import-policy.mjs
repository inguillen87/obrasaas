import {createHash} from 'node:crypto';
import {WorkspaceError, workspaceId, operationId, calendarDate, digest} from './workspace-policy.mjs';
import {decodePrivateImage} from './private-image-upload.mjs';
import {PLAN_OOXML_TYPES,PLAN_OOXML_CONSENT,PLAN_CYP_CONSENT,PLAN_MONTHLY_CURVE_CONSENT,PLAN_CYP_CURVE_CONSENT,PLAN_CYP_ROWS,validatePlanOoxml,safePlanOoxmlAnalysis} from './plan-import-ooxml.mjs';
import {DOCUMENT_CURVE_CONSENT,DocumentCurveError,isDocumentCurveConsent,normalizeDocumentCurve,documentCurveCanonical,DOCUMENT_CURVE_PURPOSE} from './plan-import-document-curve.mjs';
import {PLAN_MEASUREMENT_CONSENT,PLAN_MEASUREMENT_DOCUMENT_CONSENT,isPlanMeasurementConsent} from './plan-measurement-source.mjs';
import {PLAN_CYP_INVESTMENT_CONSENT,PLAN_CYP_INVESTMENT_PROFILE,PLAN_CYP_INVESTMENT_PURPOSE,safeCypInvestmentAnalysis} from './plan-import-cyp-curve.mjs';
import {PLAN_BUDGET_SOURCE_CONSENT} from './plan-budget-source.mjs';
import {PLAN_BUDGET_CSV_CONSENT,PLAN_BUDGET_CSV_TYPE,decodePlanBudgetCsvText,extractPlanBudgetCsvSource} from './plan-budget-csv-source.mjs';
export {PLAN_CYP_INVESTMENT_CONSENT,PLAN_CYP_INVESTMENT_PROFILE,PLAN_CYP_INVESTMENT_PURPOSE} from './plan-import-cyp-curve.mjs';
export {isDocumentCurveConsent} from './plan-import-document-curve.mjs';
export const PLAN_IMPORT_DOCUMENT_CURVE_CONSENT=DOCUMENT_CURVE_CONSENT;

export const PLAN_IMPORT_LIMIT=3*1024*1024;
export const PLAN_IMPORT_ROWS=50;
export const PLAN_IMPORT_TEXT_LIMITS=Object.freeze({title:160,evidence:500,uncertainty:500,warnings:500});
export const PLAN_IMPORT_CONSENT='plan-document-openai-v1';
export const PLAN_IMPORT_SPREADSHEET_CONSENT=PLAN_OOXML_CONSENT;
export const PLAN_IMPORT_CYP_CONSENT=PLAN_CYP_CONSENT;
export const PLAN_IMPORT_MONTHLY_CURVE_CONSENT=PLAN_MONTHLY_CURVE_CONSENT;
export const PLAN_IMPORT_CYP_CURVE_CONSENT=PLAN_CYP_CURVE_CONSENT;
export const planSourceConsent=contentType=>contentType===PLAN_BUDGET_CSV_TYPE?PLAN_BUDGET_CSV_CONSENT:PLAN_OOXML_TYPES[contentType]?PLAN_IMPORT_SPREADSHEET_CONSENT:PLAN_IMPORT_CONSENT;
export const isPlanSourceConsent=(contentType,consent)=>contentType===PLAN_BUDGET_CSV_TYPE?consent===PLAN_BUDGET_CSV_CONSENT:isPlanMeasurementConsent(consent,contentType)||(PLAN_OOXML_TYPES[contentType]?[PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_CYP_INVESTMENT_CONSENT,PLAN_BUDGET_SOURCE_CONSENT].includes(consent):consent===PLAN_IMPORT_CONSENT||isDocumentCurveConsent(consent));
export const canImportPlan=role=>['ADMIN','DIRECTOR','SITE_MANAGER'].includes(role);
export const canApprovePlan=role=>['ADMIN','DIRECTOR'].includes(role);
const fail=(code='PLAN_IMPORT_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
// Only this parser can attest that source validation failed before attach.
// A caller-controlled field or an error from the store cannot forge the marker.
const sourceRejections=new WeakMap();
export const planImportSourceRejection=error=>sourceRejections.get(error)||null;
const csvSourceRejectionCodes=new Set(['PLAN_IMPORT_BUDGET_CSV_INVALID','PLAN_IMPORT_BUDGET_CSV_ENCODING_INVALID','PLAN_IMPORT_BUDGET_CSV_HEADERS_INVALID','PLAN_IMPORT_BUDGET_CSV_COLUMNS_INVALID','PLAN_IMPORT_BUDGET_CSV_QUOTES_INVALID','PLAN_IMPORT_BUDGET_CSV_ROW_INCOMPLETE','PLAN_IMPORT_BUDGET_CSV_ROWS_LIMIT','PLAN_IMPORT_BUDGET_CSV_DUPLICATE_CODES','PLAN_IMPORT_BUDGET_SOURCE_TOO_LARGE']);
function rememberSourceRejection(error,input,source){
 if(!(error instanceof WorkspaceError))return;
 const csv=input.consent===PLAN_BUDGET_CSV_CONSENT&&source?.contentType===PLAN_BUDGET_CSV_TYPE&&csvSourceRejectionCodes.has(error.code);
 if(!csv&&!['PLAN_IMPORT_FILE_INVALID','PLAN_IMPORT_FILE_TOO_LARGE'].includes(error.code))return;
 const rejection={scope:input.scope,projectId:input.projectId,operationId:input.operationId.toLowerCase()};
 // This is a live parser rejection, not a durable SQL receipt. Binding the
 // original byte hash also works when those bytes are not valid UTF-8.
 if(csv){rejection.action='UPLOAD';rejection.inputDigest=digest(['plan-import-upload-command-v1',{action:'UPLOAD',consent:input.consent,operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,source:{bytes:source.bytes.length,contentType:source.contentType,sha256:createHash('sha256').update(source.bytes).digest('hex')}}]);}
 sourceRejections.set(error,rejection);
}
export async function validatePlanSourceWorkbook(source,context){
 try{if(PLAN_OOXML_TYPES[source.contentType])await validatePlanOoxml(source.bytes,source.contentType);else if(source.contentType===PLAN_BUDGET_CSV_TYPE)extractPlanBudgetCsvSource(source.bytes,source.contentType,{sourceSha256:source.sha256});}
 catch(error){rememberSourceRejection(error,context,source);throw error;}
}
const rowRejections=new WeakMap();
const rowViolations=new Set(['ROW_COUNT','ROW_KEYS','TEXT_TYPE','TEXT_REQUIRED','TEXT_LIMIT','CONTROL_CHARACTERS','DATE_FORMAT','DATE_ORDER','MISSING_DATE_UNCERTAINTY','REVIEW_REQUIRED','DUPLICATE_ROWS']);
const rowFields=new Set(['ROWS','ROW','TEXT','TITLE','EVIDENCE','UNCERTAINTY','STARTS_ON','ENDS_ON','DATES']);
export const planImportRowRejection=error=>rowRejections.get(error)||null;
export function safePlanImportDiagnostic(value) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='field|rowCount|violation'||!rowViolations.has(value.violation)||!rowFields.has(value.field)||!Number.isSafeInteger(value.rowCount)||value.rowCount<0||value.rowCount>192*1024)return null;
 return {violation:value.violation,field:value.field,rowCount:value.rowCount};
}
const rejectRows=(violation,field='ROW',code='PLAN_IMPORT_ROWS_INVALID',status=400)=>{
 const error=new WorkspaceError(code,status);rowRejections.set(error,Object.freeze({violation,field}));throw error;
};
export function planContext(input) {
 if(!input||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))fail();
 return {projectId:input.projectId,scope:input.scope};
}
export function planText(value,max=PLAN_IMPORT_TEXT_LIMITS.title,min=1) {
 if(typeof value!=='string')rejectRows('TEXT_TYPE','TEXT');
 if(value.trim().length<min)rejectRows('TEXT_REQUIRED','TEXT');
 if(value.length>max)rejectRows('TEXT_LIMIT','TEXT');
 if(/[\u0000-\u001f\u007f<>]/.test(value))rejectRows('CONTROL_CHARACTERS','TEXT');
 return value.trim();
}
const rowText=(value,max,field)=>{
 try{return planText(value,max);}catch(error){const diagnostic=planImportRowRejection(error);if(diagnostic)rowRejections.set(error,Object.freeze({...diagnostic,field}));throw error;}
};
export function decodePlanSource(bytes,contentType) {
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PLAN_IMPORT_LIMIT)fail('PLAN_IMPORT_FILE_TOO_LARGE',413);
 const b=Buffer.from(bytes),mime=String(contentType||'').split(';')[0].toLowerCase().trim();
 if(mime===PLAN_BUDGET_CSV_TYPE){decodePlanBudgetCsvText(b);return {bytes:b,contentType:mime,extension:'csv',sha256:createHash('sha256').update(b).digest('hex')};}
 if(PLAN_OOXML_TYPES[mime]) {
  if(b.length<22||b.readUInt32LE(0)!==0x04034b50||!b.subarray(Math.max(0,b.length-65557)).includes(Buffer.from([0x50,0x4b,0x05,0x06])))fail('PLAN_IMPORT_FILE_INVALID');
  return {bytes:b,contentType:mime,extension:PLAN_OOXML_TYPES[mime],sha256:createHash('sha256').update(b).digest('hex')};
 }
 if(mime==='application/pdf') {
  if(!/^%PDF-1\.[0-7]|^%PDF-2\.0/.test(b.subarray(0,10).toString('ascii'))||!b.subarray(Math.max(0,b.length-2048)).includes(Buffer.from('%%EOF')))fail('PLAN_IMPORT_FILE_INVALID');
  return {bytes:b,contentType:mime,extension:'pdf',sha256:createHash('sha256').update(b).digest('hex')};
 }
 try {const image=decodePrivateImage(b.toString('base64'),mime);return {...image,sha256:image.digest};}catch{fail('PLAN_IMPORT_FILE_INVALID');}
}
export function normalizePlanRows(rows,{complete=false}={}) {
 const cyp=Array.isArray(rows)&&Object.hasOwn(rows[0]||{},'code');
 const monthlyCurve=Array.isArray(rows)&&Object.hasOwn(rows[0]||{},'sourceRowId');
 if(!Array.isArray(rows)||!rows.length||rows.length>(cyp?PLAN_CYP_ROWS:PLAN_IMPORT_ROWS))rejectRows('ROW_COUNT','ROWS','PLAN_IMPORT_ROWS_LIMIT');
 const normalized=rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join('|')!==(cyp?'code|endsOn|evidence|parentCode|sourceIssueReviewed|startsOn|title|uncertainty':monthlyCurve?'endsOn|evidence|sourceRowId|startsOn|title|uncertainty':'endsOn|evidence|startsOn|title|uncertainty'))rejectRows('ROW_KEYS');
  if(cyp&&(!/^[AB]\.1\.\d{1,3}\.\d{1,3}$/.test(row.code||'')||row.parentCode!==row.code.slice(0,row.code.lastIndexOf('.'))||typeof row.sourceIssueReviewed!=='boolean'))rejectRows('ROW_KEYS');
  if(monthlyCurve&&!/^Plan y curva Meses!A[1-9]\d{0,5}$/.test(row.sourceRowId||''))rejectRows('ROW_KEYS');
  const title=rowText(row.title,cyp&&!complete?500:PLAN_IMPORT_TEXT_LIMITS.title,'TITLE'),evidence=rowText(row.evidence,PLAN_IMPORT_TEXT_LIMITS.evidence,'EVIDENCE'),uncertainty=row.uncertainty===''?'':rowText(row.uncertainty,PLAN_IMPORT_TEXT_LIMITS.uncertainty,'UNCERTAINTY');
  const dates=[row.startsOn,row.endsOn].map((value,index)=>value===null||value===''?null:calendarDate(value)?value:rejectRows('DATE_FORMAT',index===0?'STARTS_ON':'ENDS_ON','PLAN_IMPORT_DATES_INVALID'));
  if(dates.every(Boolean)&&dates[1]<dates[0])rejectRows('DATE_ORDER','DATES','PLAN_IMPORT_DATES_INVALID');
  if(complete&&(!dates.every(Boolean)||uncertainty))rejectRows('REVIEW_REQUIRED','DATES','PLAN_IMPORT_REVIEW_REQUIRED',409);
  if(!complete&&!dates.every(Boolean)&&!uncertainty)rejectRows('MISSING_DATE_UNCERTAINTY','UNCERTAINTY');
  return {...(cyp?{code:row.code,parentCode:row.parentCode,sourceIssueReviewed:row.sourceIssueReviewed}:monthlyCurve?{sourceRowId:row.sourceRowId}:{}),title,startsOn:dates[0],endsOn:dates[1],evidence,uncertainty};
 });
 const keys=normalized.map(r=>cyp?r.code:monthlyCurve?r.sourceRowId:[r.title.toLocaleLowerCase('es-AR'),r.startsOn,r.endsOn].join('|'));
 if(new Set(keys).size!==keys.length)rejectRows('DUPLICATE_ROWS','ROWS','PLAN_IMPORT_DUPLICATE_ROWS');
 return normalized;
}
export function normalizePlanDecision(input) {
 const keys=['action','draftId','expectedRevision','operationId','projectId','reason','rows','scope'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!==keys.sort().join('|')||!operationId(input.operationId)||!workspaceId(input.draftId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||!['EDIT','APPLY','REJECT'].includes(input.action))fail();
 planContext(input);
 const rows=input.action==='REJECT'?(input.rows===null?null:fail()):normalizePlanRows(input.rows,{complete:input.action==='APPLY'});
 return {...input,operationId:input.operationId.toLowerCase(),reason:planText(input.reason,800,8),rows};
}
// Match every retained partida to the immutable extraction. EDIT may shorten its
// title, add calendar dates or explicitly exclude it, but cannot relabel a code.
export function validatePlanSourceRows(rows,analysis,original,{complete=false}={}) {
 if(analysis?.version===3){
  const safe=safePlanOoxmlAnalysis(analysis);
  if(!safe||!Array.isArray(original)||original.length!==safe.rowCount)fail('PLAN_IMPORT_REVIEW_REQUIRED',409);
  const originals=new Map(original.map(row=>[row.sourceRowId,row])),items=new Map(safe.items.map(item=>[item.sourceRowId,item]));
  if(originals.size!==original.length||items.size!==safe.rowCount)fail('PLAN_IMPORT_REVIEW_REQUIRED',409);
  for(const row of rows){const source=originals.get(row.sourceRowId),item=items.get(row.sourceRowId);
   if(!source||!item||Object.hasOwn(row,'code')||row.evidence!==source.evidence||source.title!==item.sourceTitle.trim())fail('PLAN_IMPORT_ROWS_INVALID');
  }
  return rows;
 }
 const cyp=[2,4].includes(analysis?.version);
 if(!cyp){if(rows.some(row=>Object.hasOwn(row,'code')||Object.hasOwn(row,'sourceRowId'))||rows.length>PLAN_IMPORT_ROWS)fail('PLAN_IMPORT_ROWS_INVALID');return rows;}
 const safe=safePlanOoxmlAnalysis(analysis);
 if(!safe||!Array.isArray(original)||original.length!==safe.rowCount)fail('PLAN_IMPORT_REVIEW_REQUIRED',409);
 const originals=new Map(original.map(row=>[row.code,row])),items=new Map(safe.items.map(item=>[item.code,item]));
 for(const row of rows){const source=originals.get(row.code),item=items.get(row.code);
  if(!source||!item||row.parentCode!==source.parentCode||row.parentCode!==item.parentCode||row.evidence!==source.evidence||source.title!==item.sourceTitle)fail('PLAN_IMPORT_ROWS_INVALID');
  if(complete&&(item.missingUnit||item.missingQuantity)&&row.sourceIssueReviewed!==true)fail('PLAN_IMPORT_REVIEW_REQUIRED',409);
 }
 return rows;
}
export function planDecisionDigest(input) {
 return digest(['plan-import-decision-v1',input.projectId,input.scope,input.operationId,input.draftId,input.expectedRevision,input.action,input.reason,input.rows===null?null:input.rows.map(row=>[row.title,row.startsOn,row.endsOn,row.evidence,row.uncertainty,...(Object.hasOwn(row,'code')?[row.code,row.parentCode,row.sourceIssueReviewed]:Object.hasOwn(row,'sourceRowId')?[row.sourceRowId]:[])])]);
}
// A document review cannot reuse a task decision or its historical fingerprint.
export function normalizeDocumentCurveDecision(input){
 const keys=['action','draftId','expectedRevision','operationId','projectId','reason','rows','scope','curve'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!==keys.sort().join('|')||!operationId(input.operationId)||!workspaceId(input.draftId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||input.expectedRevision>2147483647||!['REVIEW_CURVE','APPLY_CURVE','REJECT'].includes(input.action)||input.rows!==null)fail();
 planContext(input);let curve=null;
 if(input.action==='REVIEW_CURVE'){try{curve=normalizeDocumentCurve(input.curve);}catch(error){if(error instanceof DocumentCurveError)fail(error.code,error.status);throw error;}}
 else if(input.curve!==null)fail();
 return {...input,operationId:input.operationId.toLowerCase(),reason:planText(input.reason,800,8),curve};
}
export function documentCurveDecisionDigest(input){
 return digest(['plan-document-curve-decision-v1',DOCUMENT_CURVE_PURPOSE,documentCurveCanonical(normalizeDocumentCurveDecision(input))]);
}
export function documentCurveUploadDigest(input){
 planContext(input);const source=input.source;
 if(!operationId(input.operationId)||!isDocumentCurveConsent(input.consent)||!source||!Number.isSafeInteger(source.bytes)||source.bytes<1||source.bytes>PLAN_IMPORT_LIMIT||!['application/pdf','image/png','image/jpeg','image/webp'].includes(source.contentType)||!/^[a-f0-9]{64}$/.test(source.sha256||''))fail('PLAN_IMPORT_INPUT_INVALID');
 return digest(['plan-document-curve-upload-command-v1',{action:'UPLOAD',purpose:DOCUMENT_CURVE_PURPOSE,consent:input.consent,operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,source:{bytes:source.bytes,contentType:source.contentType,sha256:source.sha256}}]);
}
const investmentExact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));
const investmentCanonical=value=>Array.isArray(value)?value.map(investmentCanonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,investmentCanonical(value[key])])):value;
const investmentSame=(a,b)=>JSON.stringify(investmentCanonical(a))===JSON.stringify(investmentCanonical(b));
const investmentTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function normalizePlanInvestmentDecision(input){
 const keys=['action','scope','projectId','operationId','draftId','expectedRevision','reason','acknowledgeDifference'];
 if(!investmentExact(input,keys)||!['REVIEW_INVESTMENT','APPLY_INVESTMENT','REJECT_INVESTMENT'].includes(input.action)||!operationId(input.operationId)||!/^plan_draft_[a-f0-9]{64}$/.test(input.draftId||'')||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||input.expectedRevision>=2147483647||typeof input.acknowledgeDifference!=='boolean'||typeof input.reason!=='string'||input.reason.length>800||input.reason.trim().length<8||/[\u0000-\u001f\u007f<>]/.test(input.reason))fail();
 planContext(input);return {...input,operationId:input.operationId.toLowerCase(),reason:input.reason.trim()};
}
export const planInvestmentDecisionDigest=input=>digest(['plan-investment-curves-decision-v1',investmentCanonical(normalizePlanInvestmentDecision(input))]);
export function planInvestmentCurveDigest(value){
 const source=value&&typeof value==='object'?{...value}:value;if(source)delete source.reviewed;
 const safe=safeCypInvestmentAnalysis(source);if(!safe)fail('PLAN_IMPORT_RECEIPT_INTEGRITY',503);
 return digest(['plan-investment-curves-source-v1',investmentCanonical(safe)]);
}
// This decoder is shared by exact recovery and baseline admission. The v3
// receipt cannot be interpreted as an old task or document decision.
export function validatePlanInvestmentReceipt(row,{organizationId,projectId,actorId}){
 const reject=()=>fail('PLAN_IMPORT_RECEIPT_INTEGRITY',503);
 try{
  const m=row?.metadata,request=normalizePlanInvestmentDecision(m?.request),o=m?.outcome;
  const keys=['version','purpose','organizationId','projectId','actorId','operationId','sourceSha256','sourceConsent','requestDigest','inputDigest','request','sourceCurveDigest','reviewReceiptId','outcome'];
  if(!investmentExact(m,keys)||m.version!==3||m.purpose!==PLAN_CYP_INVESTMENT_PURPOSE||m.organizationId!==organizationId||m.projectId!==projectId||m.actorId!==actorId||row.organizationId!==organizationId||row.entityId!==projectId||row.actorId!==actorId||row.action!=='plan.import.decision'||!workspaceId(actorId)||row.id!=='plan_receipt_'+digest([actorId,projectId,request.operationId])||request.projectId!==projectId||m.operationId!==request.operationId||m.sourceConsent!==PLAN_CYP_INVESTMENT_CONSENT||!/^[a-f0-9]{64}$/.test(m.sourceSha256||'')||!/^[a-f0-9]{64}$/.test(m.sourceCurveDigest||'')||m.inputDigest!==planInvestmentDecisionDigest(request)||m.requestDigest!==m.inputDigest||!investmentTimestamp(o?.recordedAt)||o.action!==request.action||o.operationId!==request.operationId||o.expectedRevision!==request.expectedRevision||o.inputDigest!==m.inputDigest||o.definitive!==true||o.taskEffects!==false||o.baselineEffects!==false||!Array.isArray(o.taskSnapshots)||o.taskSnapshots.length)reject();
  if(!investmentSame(m.request,request))reject();
  const common=['action','operationId','expectedRevision','inputDigest','state','definitive','phase','saved','taskEffects','baselineEffects','taskSnapshots','recordedAt'];
  if(m.reviewReceiptId!==null&&!/^plan_receipt_[a-f0-9]{64}$/.test(m.reviewReceiptId||''))reject();
  if(o.state==='REJECTED'){
   if(!investmentExact(o,[...common,'draftId','code'])||o.saved!==false||o.phase!=='PRE_DECISION'||o.draftId!==request.draftId||!['PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED'].includes(o.code))reject();
   return {receiptId:row.id,...structuredClone(o),replayed:true,tasks:[]};
  }
  const d=o.draft,{reviewed,...spreadsheet}=d?.spreadsheet||{},source=safeCypInvestmentAnalysis(spreadsheet);
  if(!investmentExact(o,[...common,'draft'])||o.state!=='RECORDED'||o.saved!==true||o.phase!=='COMMITTED'||!source||d.id!==request.draftId||d.revision!==request.expectedRevision+1||d.status!==({REVIEW_INVESTMENT:'READY',APPLY_INVESTMENT:'APPLIED',REJECT_INVESTMENT:'REJECTED'})[request.action]||d.existingTaskCount!==null||d.financialSource!==true||d.sourceAvailable!==true||!investmentExact(d.source,['contentType','bytes','sha256'])||!PLAN_OOXML_TYPES[d.source.contentType]||!Number.isSafeInteger(d.source.bytes)||d.source.bytes<1||d.source.bytes>PLAN_IMPORT_LIMIT||d.source.sha256!==m.sourceSha256||source.sourceSha256!==m.sourceSha256||planInvestmentCurveDigest(source)!==m.sourceCurveDigest||!Array.isArray(d.rows)||d.rows.length||typeof d.investmentReviewed!=='boolean'||typeof d.differenceAcknowledged!=='boolean'||reviewed!==d.investmentReviewed)reject();
  if(request.action==='REVIEW_INVESTMENT'){
   if(d.decision!==null||d.investmentReviewed!==true||m.reviewReceiptId!==row.id||d.differenceAcknowledged!==request.acknowledgeDifference||source.comparison.status==='DIFFERENT'&&!d.differenceAcknowledged)reject();
  }else if(!investmentSame(d.decision,{action:request.action,actorId,reason:request.reason,recordedAt:o.recordedAt,receiptId:row.id}))reject();
  if(request.action==='APPLY_INVESTMENT'&&(!d.investmentReviewed||!m.reviewReceiptId||d.differenceAcknowledged!==request.acknowledgeDifference||source.comparison.status==='DIFFERENT'&&!d.differenceAcknowledged))reject();
  return {receiptId:row.id,...structuredClone(o),replayed:true,tasks:[]};
 }catch{reject();}
}
export async function boundedPlanMultipart(request,{validateWorkbook=true}={}) {
 const mime=request.headers.get('content-type'),limit=PLAN_IMPORT_LIMIT+65536,length=request.headers.get('content-length');
 if(!mime?.startsWith('multipart/form-data;')||request.headers.has('content-encoding'))fail();
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))fail('PLAN_IMPORT_FILE_TOO_LARGE',413);
 const reader=request.body?.getReader();if(!reader)fail();let size=0;const chunks=[];
 try {
  while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit)fail('PLAN_IMPORT_FILE_TOO_LARGE',413);chunks.push(Buffer.from(item.value));}
  const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':mime}}).formData(),keys=['operationId','projectId','scope','consent','file'];
  if([...form.keys()].sort().join('|')!==keys.sort().join('|'))fail();
  const file=form.get('file');if(!file||typeof file==='string')fail();
  const input=Object.fromEntries(keys.filter(k=>k!=='file').map(k=>[k,form.get(k)]));
  if(!operationId(input.operationId)||![PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_CYP_INVESTMENT_CONSENT,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT,PLAN_MEASUREMENT_CONSENT,PLAN_MEASUREMENT_DOCUMENT_CONSENT,PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_CSV_CONSENT].includes(input.consent))fail('PLAN_IMPORT_CONSENT_REQUIRED');planContext(input);
  const bytes=new Uint8Array(await file.arrayBuffer());let source;
  try{source=decodePlanSource(bytes,file.type);if(!isPlanSourceConsent(source.contentType,input.consent))fail('PLAN_IMPORT_CONSENT_REQUIRED');if(validateWorkbook&&PLAN_OOXML_TYPES[source.contentType])await validatePlanOoxml(source.bytes,source.contentType);}catch(error){
   rememberSourceRejection(error,input,{bytes,contentType:String(file.type||'').split(';')[0].toLowerCase().trim()});
   throw error;
  }
  return {...input,source};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
