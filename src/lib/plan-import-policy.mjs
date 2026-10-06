import {createHash} from 'node:crypto';
import {WorkspaceError, workspaceId, operationId, calendarDate, digest} from './workspace-policy.mjs';
import {decodePrivateImage} from './private-image-upload.mjs';

export const PLAN_IMPORT_LIMIT=3*1024*1024;
export const PLAN_IMPORT_ROWS=50;
export const PLAN_IMPORT_CONSENT='plan-document-openai-v1';
export const canImportPlan=role=>['ADMIN','DIRECTOR','SITE_MANAGER'].includes(role);
export const canApprovePlan=role=>['ADMIN','DIRECTOR'].includes(role);
const fail=(code='PLAN_IMPORT_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
// Only this parser can attest that source validation failed before attach.
// A caller-controlled field or an error from the store cannot forge the marker.
const sourceRejections=new WeakMap();
export const planImportSourceRejection=error=>sourceRejections.get(error)||null;
export function planContext(input) {
 if(!input||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))fail();
 return {projectId:input.projectId,scope:input.scope};
}
export function planText(value,max=160,min=1) {
 if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u001f\u007f<>]/.test(value))fail('PLAN_IMPORT_ROWS_INVALID');
 return value.trim();
}
export function decodePlanSource(bytes,contentType) {
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PLAN_IMPORT_LIMIT)fail('PLAN_IMPORT_FILE_TOO_LARGE',413);
 const b=Buffer.from(bytes),mime=String(contentType||'').split(';')[0].toLowerCase().trim();
 if(mime==='application/pdf') {
  if(!/^%PDF-1\.[0-7]|^%PDF-2\.0/.test(b.subarray(0,10).toString('ascii'))||!b.subarray(Math.max(0,b.length-2048)).includes(Buffer.from('%%EOF')))fail('PLAN_IMPORT_FILE_INVALID');
  return {bytes:b,contentType:mime,extension:'pdf',sha256:createHash('sha256').update(b).digest('hex')};
 }
 try {const image=decodePrivateImage(b.toString('base64'),mime);return {...image,sha256:image.digest};}catch{fail('PLAN_IMPORT_FILE_INVALID');}
}
export function normalizePlanRows(rows,{complete=false}={}) {
 if(!Array.isArray(rows)||!rows.length||rows.length>PLAN_IMPORT_ROWS)fail('PLAN_IMPORT_ROWS_LIMIT');
 const normalized=rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join('|')!=='endsOn|evidence|startsOn|title|uncertainty')fail('PLAN_IMPORT_ROWS_INVALID');
  const title=planText(row.title),evidence=planText(row.evidence,500),uncertainty=row.uncertainty===''?'':planText(row.uncertainty,500);
  const dates=[row.startsOn,row.endsOn].map(v=>v===null||v===''?null:calendarDate(v)?v:fail('PLAN_IMPORT_DATES_INVALID'));
  if(dates.every(Boolean)&&dates[1]<dates[0])fail('PLAN_IMPORT_DATES_INVALID');
  if(complete&&(!dates.every(Boolean)||uncertainty))fail('PLAN_IMPORT_REVIEW_REQUIRED',409);
  if(!complete&&!dates.every(Boolean)&&!uncertainty)fail('PLAN_IMPORT_ROWS_INVALID');
  return {title,startsOn:dates[0],endsOn:dates[1],evidence,uncertainty};
 });
 const keys=normalized.map(r=>[r.title.toLocaleLowerCase('es-AR'),r.startsOn,r.endsOn].join('|'));
 if(new Set(keys).size!==keys.length)fail('PLAN_IMPORT_DUPLICATE_ROWS');
 return normalized;
}
export function normalizePlanDecision(input) {
 const keys=['action','draftId','expectedRevision','operationId','projectId','reason','rows','scope'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!==keys.sort().join('|')||!operationId(input.operationId)||!workspaceId(input.draftId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||!['EDIT','APPLY','REJECT'].includes(input.action))fail();
 planContext(input);
 const rows=input.action==='REJECT'?(input.rows===null?null:fail()):normalizePlanRows(input.rows,{complete:input.action==='APPLY'});
 return {...input,operationId:input.operationId.toLowerCase(),reason:planText(input.reason,800,8),rows};
}
export function planDecisionDigest(input) {
 return digest(['plan-import-decision-v1',input.projectId,input.scope,input.operationId,input.draftId,input.expectedRevision,input.action,input.reason,input.rows===null?null:input.rows.map(row=>[row.title,row.startsOn,row.endsOn,row.evidence,row.uncertainty])]);
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
  if(!operationId(input.operationId)||input.consent!==PLAN_IMPORT_CONSENT)fail('PLAN_IMPORT_CONSENT_REQUIRED');planContext(input);
  const bytes=new Uint8Array(await file.arrayBuffer());let source;
  try{source=decodePlanSource(bytes,file.type);}catch(error){
   if(error instanceof WorkspaceError&&['PLAN_IMPORT_FILE_INVALID','PLAN_IMPORT_FILE_TOO_LARGE'].includes(error.code))sourceRejections.set(error,{scope:input.scope,projectId:input.projectId,operationId:input.operationId.toLowerCase()});
   throw error;
  }
  return {...input,source};
 }catch(error){if(error instanceof WorkspaceError)throw error;fail();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
