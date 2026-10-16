import {WorkspaceError,workspaceId,operationId,calendarDate,digest} from './workspace-policy.mjs';
import {planContext,planText} from './plan-import-policy.mjs';

export const PLAN_MEASUREMENT_ACTIONS=Object.freeze(['REVIEW_MEASUREMENT','APPLY_MEASUREMENT','REJECT_MEASUREMENT']);
export const PLAN_MEASUREMENT_PRE_DECISION_CODES=Object.freeze(['PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_MEASUREMENT_SOURCE_CHANGED','PLAN_MEASUREMENT_REVIEW_CHANGED','FIELD_REVISION_CHANGED','FIELD_PROGRESS_REVIEW_PENDING','TASK_MEASUREMENT_BASELINE_LOCKED','TASK_MEASUREMENT_STATE_INVALID','PLAN_MEASUREMENT_REPLACEMENT_REQUIRED','PLAN_MEASUREMENT_DEFINITION_CHANGED','PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED','PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED','PLAN_MEASUREMENT_EXCLUSION_REVIEW_REQUIRED','PLAN_IMPORT_MEASUREMENT_REVIEW_REQUIRED','PLAN_IMPORT_MEASUREMENT_UNIT_INCOMPATIBLE','PLAN_MEASUREMENT_DATES_REQUIRED','WORKSPACE_TASK_UNAVAILABLE']);
const fail=(code='PLAN_MEASUREMENT_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
export const measurementCanonical=value=>Array.isArray(value)?value.map(measurementCanonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,measurementCanonical(value[key])])):value;
export const planMeasurementCommandDigest=input=>digest(['plan-measurement-command-v1',measurementCanonical({...input,operationId:input.operationId.toLowerCase()})]);
export const planMeasurementUploadDigest=(input,source)=>digest(['plan-measurement-upload-command-v1',{action:'UPLOAD',purpose:'PHYSICAL_TASK_MEASUREMENT',consent:input.consent,operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,source:{bytes:source.bytes.length,contentType:source.contentType,sha256:source.sha256}}]);
export function normalizePlanMeasurementCommand(input){
 const keys=['action','projectId','scope','operationId','draftId','expectedRevision','sourceSha256','sourceDigest','reviewDigest','reason','rows','destinations','excludedRows'];
 if(!exact(input,keys)||!PLAN_MEASUREMENT_ACTIONS.includes(input.action)||!operationId(input.operationId)||!workspaceId(input.draftId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||input.expectedRevision>=2147483647||!hash(input.sourceSha256)||!hash(input.sourceDigest))fail();
 planContext(input);
 if(input.action==='REVIEW_MEASUREMENT'){
  if(input.reviewDigest!==null||!Array.isArray(input.rows)||!input.rows.length||input.rows.length>500||!Array.isArray(input.destinations)||input.destinations.length!==input.rows.length||!Array.isArray(input.excludedRows)||input.excludedRows.length>200)fail();
 }else if(input.rows!==null||input.destinations!==null||input.excludedRows!==null||(input.action==='APPLY_MEASUREMENT'?!hash(input.reviewDigest):input.reviewDigest!==null&&!hash(input.reviewDigest)))fail();
 return {...input,operationId:input.operationId.toLowerCase(),reason:planText(input.reason,1000,8)};
}
export function normalizePlanMeasurementExclusions(source,rows,excluded){
 const omitted=source.rows.filter(row=>!rows.some(value=>value.sourceRowId===row.sourceRowId)),seen=new Set();
 if(!Array.isArray(excluded)||excluded.length!==omitted.length)fail('PLAN_MEASUREMENT_EXCLUSION_REVIEW_REQUIRED',409);
 for(const item of excluded){if(!exact(item,['sourceRowId','reason'])||!omitted.some(row=>row.sourceRowId===item.sourceRowId)||seen.has(item.sourceRowId))fail('PLAN_MEASUREMENT_EXCLUSION_REVIEW_REQUIRED',409);seen.add(item.sourceRowId);planText(item.reason,1000,8);}
 return omitted.map(row=>({sourceRowId:row.sourceRowId,reason:planText(excluded.find(item=>item.sourceRowId===row.sourceRowId).reason,1000,8)}));
}
export function normalizePlanMeasurementDestinations(rows,destinations,{source,sourceDigest}={}){
 const sourceIds=new Set(rows.map(row=>row.sourceRowId)),seen=new Set(),tasks=new Set();
 if(!Array.isArray(destinations)||destinations.length!==rows.length)fail();
 const normalized=destinations.map(value=>{
  if(!value||!sourceIds.has(value.sourceRowId)||seen.has(value.sourceRowId))fail();seen.add(value.sourceRowId);
  if(value.mode==='CREATE'){
   if(!exact(value,['sourceRowId','mode','title','startsOn','endsOn'])||!calendarDate(value.startsOn)||!calendarDate(value.endsOn)||value.endsOn<value.startsOn)fail('PLAN_MEASUREMENT_DATES_REQUIRED');
   return {...value,title:planText(value.title,160)};
  }
  const row=rows.find(row=>row.sourceRowId===value.sourceRowId);
  const document=Object.hasOwn(value,'documentAssociation'),keys=['sourceRowId','mode','taskId','revision','sourceCode','confirmIdentity','replacement','expectedDefinitionId','confirmReplacement'];
  if(value.mode!=='EXISTING'||!exact(value,document?[...keys,'documentAssociation']:keys)||!workspaceId(value.taskId)||!revision(value.revision)||value.confirmIdentity!==true||!['CONFIGURE','REPLACE_UNSEALED'].includes(value.replacement)||!['string','object'].includes(typeof value.expectedDefinitionId)||value.expectedDefinitionId!==null&&!workspaceId(value.expectedDefinitionId)||typeof value.confirmReplacement!=='boolean'||tasks.has(value.taskId))fail();
  if(document){
   const proof=value.documentAssociation,original=source?.rows?.find(item=>item.sourceRowId===row.sourceRowId);
   if(source?.format!=='DOCUMENT'||row.code!==null||original?.code!==null||value.sourceCode!==null||!exact(proof,['version','mode','sourceSha256','sourceDigest','sourceRowId','taskId','taskRevision','confirmed'])||proof.version!==1||proof.mode!=='DOCUMENT_ROW'||proof.confirmed!==true||!hash(source.sourceSha256)||!hash(sourceDigest)||proof.sourceSha256!==source.sourceSha256||proof.sourceDigest!==sourceDigest||proof.sourceRowId!==row.sourceRowId||proof.taskId!==value.taskId||proof.taskRevision!==value.revision)fail('PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED');
  }else if(typeof row.code!=='string'||!row.code.length||value.sourceCode!==row.code)fail('PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED');
  if(value.replacement==='CONFIGURE'&&(value.expectedDefinitionId!==null||value.confirmReplacement!==false)||value.replacement==='REPLACE_UNSEALED'&&(!workspaceId(value.expectedDefinitionId)||value.confirmReplacement!==true))fail('PLAN_MEASUREMENT_REPLACEMENT_REQUIRED');
  tasks.add(value.taskId);return {...value,...(document?{documentAssociation:{...value.documentAssociation}}:{})};
 });
 return rows.map(row=>normalized.find(value=>value.sourceRowId===row.sourceRowId));
}
