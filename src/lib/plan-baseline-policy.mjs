import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {normalizePlanRows,validatePlanSourceRows,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT} from './plan-import-policy.mjs';
import {safePlanOoxmlAnalysis,PLAN_OOXML_TYPES} from './plan-import-ooxml.mjs';

export const PLAN_BASELINE_VERSION=1;
export const PLAN_BASELINE_PAGE_SIZE=10;
export const PLAN_BASELINE_REJECTIONS=Object.freeze(['PLAN_BASELINE_REVISION_CHANGED','PLAN_BASELINE_CANDIDATE_UNAVAILABLE','PLAN_BASELINE_SOURCE_CHANGED']);
export const planBaselineExact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));
const fail=(code='PLAN_BASELINE_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=(value,prefix)=>typeof value==='string'&&new RegExp('^'+prefix+'[a-f0-9]{64}$').test(value);
export const planBaselineTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export const planBaselineCanonical=value=>Array.isArray(value)?value.map(planBaselineCanonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,planBaselineCanonical(value[key])])):value;
export const planBaselineSame=(a,b)=>JSON.stringify(planBaselineCanonical(a))===JSON.stringify(planBaselineCanonical(b));
export const planBaselineId=(organizationId,projectId)=>'plan_baseline_'+digest(['plan-baseline-active-v1',organizationId,projectId]);
export const planBaselineReceiptId=(actorId,projectId,key)=>'plan_baseline_receipt_'+digest(['plan-baseline-selection-receipt-v1',actorId,projectId,key.toLowerCase()]);

export function planBaselineContext(value){
 if(!value||!workspaceId(value.projectId)||!sha(value.scope))fail();
 return {projectId:value.projectId,scope:value.scope};
}
export function normalizePlanBaselineSelection(value){
 const keys=['action','projectId','scope','operationId','draftId','draftRevision','decisionReceiptId','sourceSha256','expectedBaselineId','expectedBaselineRevision','reason','confirmed'];
 if(!planBaselineExact(value,keys)||value.action!=='SELECT'||!operationId(value.operationId)||!id(value.draftId,'plan_draft_')||!id(value.decisionReceiptId,'plan_receipt_')||!sha(value.sourceSha256)||!Number.isSafeInteger(value.draftRevision)||value.draftRevision<2||value.draftRevision>2147483647||value.confirmed!==true||typeof value.reason!=='string'||value.reason.length>800||value.reason.trim().length<8||/[\u0000-\u001f\u007f<>]/.test(value.reason))fail();
 planBaselineContext(value);
 if(!Number.isSafeInteger(value.expectedBaselineRevision)||value.expectedBaselineRevision<0||value.expectedBaselineRevision>=2147483647||(value.expectedBaselineRevision===0?value.expectedBaselineId!==null:!id(value.expectedBaselineId,'plan_baseline_')))fail();
 return {...value,operationId:value.operationId.toLowerCase(),reason:value.reason.trim()};
}
export function planBaselineSelectionDigest(value){
 const v=normalizePlanBaselineSelection(value);
 return digest(['plan-baseline-selection-v1','SELECT',v.scope,v.projectId,v.operationId,v.draftId,v.draftRevision,v.decisionReceiptId,v.sourceSha256,v.expectedBaselineId,v.expectedBaselineRevision,v.reason,true]);
}
// This cursor binds a seek position to the authorized scope/project. It is not
// an access credential; the store also revalidates the referenced candidate.
export function planBaselineCursor(context,draftId){
 planBaselineContext(context);if(!id(draftId,'plan_draft_'))fail();
 return 'plan_baseline_page_'+digest(['plan-baseline-page-v1',context.scope,context.projectId,draftId])+'.'+Buffer.from(draftId).toString('base64url');
}
export function parsePlanBaselineCursor(value,context){
 if(typeof value!=='string'||value.length>220||!/^plan_baseline_page_[a-f0-9]{64}\.[A-Za-z0-9_-]+$/.test(value))fail('PLAN_BASELINE_CURSOR_INVALID');
 const draftId=Buffer.from(value.split('.')[1],'base64url').toString('utf8');
 if(!id(draftId,'plan_draft_')||planBaselineCursor(context,draftId)!==value)fail('PLAN_BASELINE_CURSOR_INVALID');
 return draftId;
}

export function appliedPlanBaselineCandidate(row,projectId,organizationId){
 const m=row?.metadata,r=row?.decisionMetadata,o=r?.outcome,d=o?.draft;
 if(!row||row.organizationId!==organizationId||row.entityId!==projectId||m?.projectId!==projectId||m?.status!=='APPLIED'||![3,4].includes(m?.analysis?.spreadsheet?.version))fail('PLAN_BASELINE_CANDIDATE_UNAVAILABLE',409);
 try{
  const spreadsheet=safePlanOoxmlAnalysis(m.analysis.spreadsheet),consent=spreadsheet?.version===4?PLAN_IMPORT_CYP_CURVE_CONSENT:PLAN_IMPORT_MONTHLY_CURVE_CONSENT;
  if(!id(row.id,'plan_draft_')||m.version!==1||!Number.isSafeInteger(m.revision)||m.revision<2||m.revision>2147483647||m.analysis.provider!=='local-ooxml'||m.analysis.reviewed!==true||!spreadsheet||m.consent?.version!==consent||m.sourceConfirmed!==true||!PLAN_OOXML_TYPES[m.source?.contentType]||!Number.isSafeInteger(m.source?.bytes)||m.source.bytes<1||m.source.bytes>3*1024*1024||!sha(m.source?.sha256)||m.decision?.action!=='APPLY'||!workspaceId(m.decision.actorId)||!planBaselineTimestamp(m.decision.recordedAt))throw Error('Source');
  const rows=normalizePlanRows(m.rows,{complete:true});validatePlanSourceRows(rows,spreadsheet,m.extractedRows,{complete:true});
  const {reviewed,...receiptSpreadsheet}=d?.spreadsheet||{};
  if(!id(row.decisionId,'plan_receipt_')||row.decisionId!==m.decision.receiptId||row.decisionOrganizationId!==organizationId||row.decisionEntityId!==projectId||row.decisionActorId!==m.decision.actorId||r?.version!==1||r.projectId!==projectId||!sha(r.requestDigest)||!sha(r.inputDigest)||r.sourceSha256!==m.source.sha256||r.sourceConsent!==consent||o?.action!=='APPLY'||o.recordedAt!==m.decision.recordedAt||d?.id!==row.id||d.status!=='APPLIED'||d.revision!==m.revision||!planBaselineSame(d.decision,m.decision)||!planBaselineSame(d.source,{contentType:m.source.contentType,bytes:m.source.bytes,sha256:m.source.sha256})||!planBaselineSame(d.rows,rows)||reviewed!==true||!planBaselineSame(receiptSpreadsheet,spreadsheet)||!Array.isArray(o.taskSnapshots)||o.taskSnapshots.length!==rows.length||new Set(o.taskSnapshots.map(t=>t.id)).size!==rows.length||o.taskSnapshots.some((t,i)=>!workspaceId(t.id)||t.title!==rows[i].title||t.startsOn!==rows[i].startsOn||t.endsOn!==rows[i].endsOn||t.status!=='BACKLOG'||t.progress!==0))throw Error('Receipt');
  return {draftId:row.id,draftRevision:m.revision,decisionReceiptId:row.decisionId,sourceSha256:m.source.sha256,profile:spreadsheet.profile,sourceRowCount:spreadsheet.rowCount,selectedRowCount:rows.length,appliedAt:o.recordedAt,curve:structuredClone(spreadsheet.curve)};
 }catch{fail('PLAN_BASELINE_SOURCE_CHANGED',409);}
}
