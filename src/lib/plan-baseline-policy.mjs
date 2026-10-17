import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {normalizePlanRows,validatePlanSourceRows,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,normalizeDocumentCurveDecision,documentCurveDecisionDigest,validatePlanInvestmentReceipt,planInvestmentCurveDigest} from './plan-import-policy.mjs';
import {safePlanOoxmlAnalysis,PLAN_OOXML_TYPES} from './plan-import-ooxml.mjs';
import {DOCUMENT_CURVE_CONSENT,DOCUMENT_CURVE_PROFILE,DOCUMENT_CURVE_PURPOSE,DOCUMENT_CURVE_INCONSISTENT_CODE,normalizeDocumentCurve,hasDocumentCurveSeriesValue} from './plan-import-document-curve.mjs';
import {safeCypInvestmentAnalysis,PLAN_CYP_INVESTMENT_CONSENT,PLAN_CYP_INVESTMENT_PROFILE,PLAN_CYP_INVESTMENT_PURPOSE} from './plan-import-cyp-curve.mjs';

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
export const planDocumentCurveDigest=curve=>digest(['plan-document-reviewed-curve-v1',planBaselineCanonical(curve)]);
// A single uploaded image cannot attest evidence on another page. PDF page
// counts are deliberately unknown here; page coordinates are never invented.
export function planDocumentCurvePagesMatch(curve,contentType){
 if(!String(contentType).startsWith('image/'))return true;
 const evidence=[...curve.currency.evidence,...curve.total.evidence,...curve.initialCumulative.evidence];
 for(const period of curve.periods){evidence.push(...period.labelEvidence,...period.calendarEvidence);for(const key of ['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'])evidence.push(...period[key].evidence);}
 return evidence.every(value=>value.page===1);
}
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
 if(m?.sourcePurpose===PLAN_CYP_INVESTMENT_PURPOSE||m?.consent?.version===PLAN_CYP_INVESTMENT_CONSENT||m?.analysis?.spreadsheet?.version===5)return appliedInvestmentCurveCandidate(row,projectId,organizationId);
 if(m?.consent?.version===DOCUMENT_CURVE_CONSENT||m?.analysis?.documentCurve?.profile===DOCUMENT_CURVE_PROFILE)return appliedDocumentCurveCandidate(row,projectId,organizationId);
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

// The immutable document decision has a separate request fingerprint. This
// validator is shared by recovery and baseline selection; old receipts keep
// their original decoder and do not acquire document fields or zero-task rules.
export function validatePlanDocumentReceipt(row,{organizationId,projectId,actorId}){
 const reject=()=>{throw new WorkspaceError('PLAN_IMPORT_RECEIPT_INTEGRITY',503);};
 try{
  const m=row?.metadata,o=m?.outcome,request=normalizeDocumentCurveDecision(m?.request);
  const keys=['version','purpose','organizationId','projectId','actorId','operationId','sourceSha256','sourceConsent','requestDigest','inputDigest','request','sourceCurveDigest','reviewReceiptId','reviewedCurveDigest','outcome'];
  if(!planBaselineExact(m,keys)||m.version!==2||m.purpose!==DOCUMENT_CURVE_PURPOSE||m.organizationId!==organizationId||m.projectId!==projectId||m.actorId!==actorId||row.organizationId!==organizationId||row.entityId!==projectId||row.actorId!==actorId||row.action!=='plan.import.decision'||row.id!=='plan_receipt_'+digest([actorId,projectId,request.operationId])||request.projectId!==projectId||m.operationId!==request.operationId||m.sourceConsent!==DOCUMENT_CURVE_CONSENT||!sha(m.sourceSha256)||!sha(m.sourceCurveDigest)||m.inputDigest!==documentCurveDecisionDigest(request)||m.requestDigest!==m.inputDigest||!planBaselineTimestamp(o?.recordedAt)||o.action!==request.action||o.operationId!==request.operationId||o.expectedRevision!==request.expectedRevision||o.inputDigest!==m.inputDigest||o.definitive!==true||o.taskEffects!==false||o.baselineEffects!==false||!Array.isArray(o.taskSnapshots)||o.taskSnapshots.length)reject();
  if(m.reviewReceiptId!==null&&!id(m.reviewReceiptId,'plan_receipt_')||m.reviewedCurveDigest!==null&&!sha(m.reviewedCurveDigest))reject();
  if(o.state==='REJECTED'){
   const rejectedKeys=['action','operationId','draftId','expectedRevision','inputDigest','state','definitive','phase','saved','taskEffects','baselineEffects','code','taskSnapshots','recordedAt'];
   if(!planBaselineExact(o,rejectedKeys)||o.saved!==false||o.phase!=='PRE_DECISION'||o.draftId!==request.draftId||!['PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED',DOCUMENT_CURVE_INCONSISTENT_CODE,'PLAN_DOCUMENT_CURVE_VALUES_REQUIRED'].includes(o.code))reject();
   return {replayed:true,receiptId:row.id,...structuredClone(o),tasks:[]};
  }
  const recordedKeys=['action','operationId','expectedRevision','inputDigest','state','definitive','phase','saved','taskEffects','baselineEffects','draft','taskSnapshots','recordedAt'],d=o.draft;
  if(!planBaselineExact(o,recordedKeys)||o.state!=='RECORDED'||o.saved!==true||o.phase!=='COMMITTED'||!d||d.id!==request.draftId||d.revision!==request.expectedRevision+1||d.status!==({REVIEW_CURVE:'READY',APPLY_CURVE:'APPLIED',REJECT:'REJECTED'})[request.action]||d.source?.sha256!==m.sourceSha256||!['application/pdf','image/png','image/jpeg','image/webp'].includes(d.source?.contentType)||!Number.isSafeInteger(d.source?.bytes)||d.source.bytes<1||d.source.bytes>3*1024*1024||d.existingTaskCount!==null||d.financialSource!==true||d.sourceAvailable!==true||!Array.isArray(d.rows)||d.rows.length||typeof d.documentReviewed!=='boolean')reject();
  const original=normalizeDocumentCurve(d.documentCurve,{sourceSha256:m.sourceSha256}),reviewed=d.reviewedCurve===null?null:normalizeDocumentCurve(d.reviewedCurve,{sourceSha256:m.sourceSha256});
  if(!planDocumentCurvePagesMatch(original,d.source.contentType)||reviewed&&!planDocumentCurvePagesMatch(reviewed,d.source.contentType)||planDocumentCurveDigest(original)!==m.sourceCurveDigest||(reviewed?planDocumentCurveDigest(reviewed):null)!==m.reviewedCurveDigest||d.documentReviewed!==(reviewed!==null))reject();
  if(request.action==='REVIEW_CURVE'&&(!reviewed||m.reviewReceiptId!==row.id||!planBaselineSame(reviewed,request.curve)))reject();
  if(request.action==='APPLY_CURVE'&&(!reviewed||!m.reviewReceiptId||reviewed.coherence.status==='INCONSISTENT'||!hasDocumentCurveSeriesValue(reviewed)))reject();
  if(request.action!=='REVIEW_CURVE'&&!planBaselineSame(d.decision,{action:request.action,actorId,reason:request.reason,recordedAt:o.recordedAt,receiptId:row.id}))reject();
  return {replayed:true,receiptId:row.id,...structuredClone(o),tasks:[]};
 }catch{reject();}
}

function appliedDocumentCurveCandidate(row,projectId,organizationId){
 try{
  const m=row.metadata,original=normalizeDocumentCurve(m.analysis?.documentCurve,{sourceSha256:m.source?.sha256}),reviewed=normalizeDocumentCurve(m.reviewedCurve,{sourceSha256:m.source?.sha256}),review=m.documentReview;
  if(!planDocumentCurvePagesMatch(original,m.source.contentType)||!planDocumentCurvePagesMatch(reviewed,m.source.contentType)||row.organizationId!==organizationId||row.entityId!==projectId||m.version!==1||m.projectId!==projectId||m.status!=='APPLIED'||m.sourcePurpose!==DOCUMENT_CURVE_PURPOSE||m.consent?.version!==DOCUMENT_CURVE_CONSENT||m.analysis?.provider!=='openai'||m.analysis.reviewed!==true||m.sourceConfirmed!==true||m.baseline!==null||m.existingTaskCount!==null||!Array.isArray(m.rows)||m.rows.length||!Array.isArray(m.extractedRows)||m.extractedRows.length||m.decision?.action!=='APPLY_CURVE'||m.decision.receiptId!==row.decisionId||!planBaselineExact(review,['receiptId','actorId','recordedAt','revision','sourceCurveDigest','reviewedCurveDigest'])||m.revision!==review.revision+1||!workspaceId(review.actorId)||review.sourceCurveDigest!==planDocumentCurveDigest(original)||review.reviewedCurveDigest!==planDocumentCurveDigest(reviewed))throw Error('Document source');
  const applied=validatePlanDocumentReceipt({id:row.decisionId,organizationId:row.decisionOrganizationId,entityId:row.decisionEntityId,actorId:row.decisionActorId,action:'plan.import.decision',metadata:row.decisionMetadata},{organizationId,projectId,actorId:m.decision.actorId});
  const confirmed=validatePlanDocumentReceipt(row.reviewReceipt,{organizationId,projectId,actorId:review.actorId});
  if(applied.action!=='APPLY_CURVE'||applied.draft.revision!==m.revision||applied.draft.documentReviewed!==true||!planBaselineSame(applied.draft.documentCurve,original)||!planBaselineSame(applied.draft.reviewedCurve,reviewed)||!planBaselineSame(applied.draft.decision,m.decision)||row.decisionMetadata.reviewReceiptId!==review.receiptId||confirmed.action!=='REVIEW_CURVE'||confirmed.receiptId!==review.receiptId||confirmed.recordedAt!==review.recordedAt||confirmed.draft.revision!==review.revision||!planBaselineSame(confirmed.draft.documentCurve,original)||!planBaselineSame(confirmed.draft.reviewedCurve,reviewed)||!planBaselineSame(applied.draft.source,{contentType:m.source.contentType,bytes:m.source.bytes,sha256:m.source.sha256}))throw Error('Document receipt');
  return {draftId:row.id,draftRevision:m.revision,decisionReceiptId:row.decisionId,sourceSha256:m.source.sha256,profile:DOCUMENT_CURVE_PROFILE,sourceRowCount:0,selectedRowCount:0,appliedAt:applied.recordedAt,curve:reviewed,sourceKind:'DOCUMENT',presentation:'DOCUMENT_MONTHLY_CURVE'};
 }catch{fail('PLAN_BASELINE_SOURCE_CHANGED',409);}
}

// A financial-only spreadsheet needs both immutable decisions. Its original
// monthly and weekly values stay together; SELECT never imports physical rows.
function appliedInvestmentCurveCandidate(row,projectId,organizationId){
 try{
  const m=row.metadata,source=safeCypInvestmentAnalysis(m.analysis?.spreadsheet),review=m.investmentReview;
  if(row.organizationId!==organizationId||row.entityId!==projectId||!id(row.id,'plan_draft_')||m.version!==1||m.projectId!==projectId||m.status!=='APPLIED'||m.sourcePurpose!==PLAN_CYP_INVESTMENT_PURPOSE||m.consent?.version!==PLAN_CYP_INVESTMENT_CONSENT||m.analysis?.provider!=='local-ooxml'||m.analysis.reviewed!==true||!source||source.sourceSha256!==m.source?.sha256||m.sourceConfirmed!==true||m.baseline!==null||m.existingTaskCount!==null||!Array.isArray(m.rows)||m.rows.length||!Array.isArray(m.extractedRows)||m.extractedRows.length||m.decision?.action!=='APPLY_INVESTMENT'||m.decision.receiptId!==row.decisionId||!planBaselineExact(review,['receiptId','actorId','recordedAt','revision','sourceCurveDigest','acknowledgeDifference','reason'])||!id(review.receiptId,'plan_receipt_')||!workspaceId(review.actorId)||!planBaselineTimestamp(review.recordedAt)||!Number.isSafeInteger(review.revision)||review.revision<2||m.revision!==review.revision+1||review.sourceCurveDigest!==planInvestmentCurveDigest(source)||typeof review.acknowledgeDifference!=='boolean'||source.comparison.status==='DIFFERENT'&&!review.acknowledgeDifference)throw Error('Investment source');
  const applied=validatePlanInvestmentReceipt({id:row.decisionId,organizationId:row.decisionOrganizationId,entityId:row.decisionEntityId,actorId:row.decisionActorId,action:'plan.import.decision',metadata:row.decisionMetadata},{organizationId,projectId,actorId:m.decision.actorId});
  const confirmed=validatePlanInvestmentReceipt(row.reviewReceipt,{organizationId,projectId,actorId:review.actorId});
  const spreadsheetOf=draft=>{const {reviewed,...value}=draft?.spreadsheet||{};if(reviewed!==true)throw Error('Investment review');return safeCypInvestmentAnalysis(value);};
  const sameSource=draft=>planBaselineSame(draft.source,{contentType:m.source.contentType,bytes:m.source.bytes,sha256:m.source.sha256})&&planBaselineSame(spreadsheetOf(draft),source)&&draft.investmentReviewed===true&&draft.differenceAcknowledged===review.acknowledgeDifference;
  if(applied.action!=='APPLY_INVESTMENT'||applied.draft.revision!==m.revision||!sameSource(applied.draft)||!planBaselineSame(applied.draft.decision,m.decision)||row.decisionMetadata.sourceCurveDigest!==review.sourceCurveDigest||row.decisionMetadata.reviewReceiptId!==review.receiptId||confirmed.action!=='REVIEW_INVESTMENT'||confirmed.receiptId!==review.receiptId||confirmed.recordedAt!==review.recordedAt||confirmed.draft.revision!==review.revision||!sameSource(confirmed.draft)||row.reviewReceipt.metadata.sourceCurveDigest!==review.sourceCurveDigest||row.reviewReceipt.metadata.request.reason!==review.reason||row.reviewReceipt.metadata.request.acknowledgeDifference!==review.acknowledgeDifference)throw Error('Investment receipt');
  return {draftId:row.id,draftRevision:m.revision,decisionReceiptId:row.decisionId,sourceSha256:m.source.sha256,profile:PLAN_CYP_INVESTMENT_PROFILE,sourceRowCount:0,selectedRowCount:0,appliedAt:applied.recordedAt,curve:source,sourceKind:'SPREADSHEET',presentation:'CYP_INVESTMENT_CURVES'};
 }catch{fail('PLAN_BASELINE_SOURCE_CHANGED',409);}
}
