import {createHash} from 'node:crypto';
import {WorkspaceError, workspaceId, operationId, calendarDate, digest} from './workspace-policy.mjs';
import {decodePrivateImage} from './private-image-upload.mjs';
import {PLAN_OOXML_TYPES,PLAN_OOXML_CONSENT,PLAN_CYP_CONSENT,PLAN_MONTHLY_CURVE_CONSENT,PLAN_CYP_CURVE_CONSENT,PLAN_CYP_ROWS,validatePlanOoxml,safePlanOoxmlAnalysis} from './plan-import-ooxml.mjs';

export const PLAN_IMPORT_LIMIT=3*1024*1024;
export const PLAN_IMPORT_ROWS=50;
export const PLAN_IMPORT_TEXT_LIMITS=Object.freeze({title:160,evidence:500,uncertainty:500,warnings:500});
export const PLAN_IMPORT_CONSENT='plan-document-openai-v1';
export const PLAN_IMPORT_SPREADSHEET_CONSENT=PLAN_OOXML_CONSENT;
export const PLAN_IMPORT_CYP_CONSENT=PLAN_CYP_CONSENT;
export const PLAN_IMPORT_MONTHLY_CURVE_CONSENT=PLAN_MONTHLY_CURVE_CONSENT;
export const PLAN_IMPORT_CYP_CURVE_CONSENT=PLAN_CYP_CURVE_CONSENT;
export const planSourceConsent=contentType=>PLAN_OOXML_TYPES[contentType]?PLAN_IMPORT_SPREADSHEET_CONSENT:PLAN_IMPORT_CONSENT;
export const isPlanSourceConsent=(contentType,consent)=>PLAN_OOXML_TYPES[contentType]?[PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT].includes(consent):consent===PLAN_IMPORT_CONSENT;
export const canImportPlan=role=>['ADMIN','DIRECTOR','SITE_MANAGER'].includes(role);
export const canApprovePlan=role=>['ADMIN','DIRECTOR'].includes(role);
const fail=(code='PLAN_IMPORT_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
// Only this parser can attest that source validation failed before attach.
// A caller-controlled field or an error from the store cannot forge the marker.
const sourceRejections=new WeakMap();
export const planImportSourceRejection=error=>sourceRejections.get(error)||null;
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
export async function boundedPlanMultipart(request) {
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
  if(!operationId(input.operationId)||![PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT].includes(input.consent))fail('PLAN_IMPORT_CONSENT_REQUIRED');planContext(input);
  const bytes=new Uint8Array(await file.arrayBuffer());let source;
  try{source=decodePlanSource(bytes,file.type);if(!isPlanSourceConsent(source.contentType,input.consent))fail('PLAN_IMPORT_CONSENT_REQUIRED');if(PLAN_OOXML_TYPES[source.contentType])await validatePlanOoxml(source.bytes,source.contentType);}catch(error){
   if(error instanceof WorkspaceError&&['PLAN_IMPORT_FILE_INVALID','PLAN_IMPORT_FILE_TOO_LARGE'].includes(error.code))sourceRejections.set(error,{scope:input.scope,projectId:input.projectId,operationId:input.operationId.toLowerCase()});
   throw error;
  }
  return {...input,source};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
