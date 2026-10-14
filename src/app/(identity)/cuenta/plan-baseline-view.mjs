import {planSourceCurveView} from './plan-source-curve.mjs';

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const candidateKeys=['draftId','draftRevision','decisionReceiptId','sourceSha256','profile','sourceRowCount','selectedRowCount','appliedAt','curve'];
const baselineKeys=[...candidateKeys,'version','id','revision','selectionReceiptId','selectedBy','selectedAt','reason'];
const reasons=value=>typeof value==='string'&&value===value.trim()&&value.length>=8&&value.length<=800&&!/[\u0000-\u001f\u007f<>]/.test(value);
const reject=()=>{throw new Error('No pudimos confirmar la curva de esta obra. Volvé a consultar con tus permisos actuales.');};
const positive=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const canonical=value=>Array.isArray(value)?value.map(canonical):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

function candidate(value,keys){
 if(!exact(value,keys)||!/^plan_draft_[a-f0-9]{64}$/.test(value.draftId||'')||!positive(value.draftRevision)||value.draftRevision<2||!/^plan_receipt_[a-f0-9]{64}$/.test(value.decisionReceiptId||'')||!hash(value.sourceSha256)||!['MONTHLY_RUBROS_CURVE','CYP_PARTIDAS_CURVE'].includes(value.profile)||!Number.isSafeInteger(value.sourceRowCount)||value.sourceRowCount<1||value.sourceRowCount>(value.profile==='CYP_PARTIDAS_CURVE'?200:50)||!Number.isSafeInteger(value.selectedRowCount)||value.selectedRowCount<1||value.selectedRowCount>value.sourceRowCount||!timestamp(value.appliedAt))reject();
 if(!planSourceCurveView(value.curve,{profile:value.profile}))reject();
 return value;
}
export function planBaselineCandidateView(value){return candidate(value,candidateKeys);}
export function planBaselineActiveView(value){
 if(value===null)return null;
 candidate(value,baselineKeys);
 if(value.version!==1||!/^plan_baseline_[a-f0-9]{64}$/.test(value.id||'')||!positive(value.revision)||!/^plan_baseline_receipt_[a-f0-9]{64}$/.test(value.selectionReceiptId||'')||!id(value.selectedBy)||!timestamp(value.selectedAt)||!reasons(value.reason))reject();
 return value;
}
function context(value,reference){
 if(value?.version!==1||!hash(value.scope)||value.scope!==reference?.scope||!id(value.projectId)||value.projectId!==reference?.projectId)reject();
}
export function planBaselineListView(value,reference){
 context(value,reference);
 if(!exact(value,['version','scope','projectId','canSelect','active','candidates','nextCursor'])||value.canSelect!==true||!Array.isArray(value.candidates)||value.candidates.length>10||(value.nextCursor!==null&&(typeof value.nextCursor!=='string'||value.nextCursor.length<1||value.nextCursor.length>1024)))reject();
 planBaselineActiveView(value.active);
 value.candidates.forEach(planBaselineCandidateView);
 if(new Set(value.candidates.map(row=>row.draftId)).size!==value.candidates.length||value.nextCursor!==null&&value.candidates.length!==10)reject();
 return value;
}
export const PLAN_BASELINE_REJECTIONS=Object.freeze(['PLAN_BASELINE_REVISION_CHANGED','PLAN_BASELINE_CANDIDATE_UNAVAILABLE','PLAN_BASELINE_SOURCE_CHANGED']);
export function planBaselineSelectionCommandView(body){
 if(typeof body?.reason!=='string'||body.reason.length>800||/[\u0000-\u001f\u007f<>]/.test(body.reason))reject();
 if(body.expectedBaselineRevision===2147483647)reject();
 if(!exact(body,['action','projectId','scope','operationId','draftId','draftRevision','decisionReceiptId','sourceSha256','expectedBaselineId','expectedBaselineRevision','reason','confirmed'])||body.action!=='SELECT'||!hash(body.scope)||!id(body.projectId)||!uuid(body.operationId?.toLowerCase?.())||!/^plan_draft_[a-f0-9]{64}$/.test(body.draftId||'')||!positive(body.draftRevision)||body.draftRevision<2||!/^plan_receipt_[a-f0-9]{64}$/.test(body.decisionReceiptId||'')||!hash(body.sourceSha256)||body.confirmed!==true||!reasons(body.reason?.trim?.())||(body.expectedBaselineId===null?body.expectedBaselineRevision!==0:!/^plan_baseline_[a-f0-9]{64}$/.test(body.expectedBaselineId||'')||!positive(body.expectedBaselineRevision)))reject();
 return {...body,operationId:body.operationId.toLowerCase(),reason:body.reason.trim()};
}
export function planBaselineOutcome(value,reference){
 context(value,reference);
 if(!exact(value,['version','scope','projectId','action','operationId','inputDigest','state','saved','definitive','replayed','receiptId','phase','baselineEffects','code','baselineSnapshot','active'])||value.action!=='SELECT'||!uuid(value.operationId)||value.operationId!==reference?.operationId||typeof value.replayed!=='boolean')reject();
 planBaselineActiveView(value.active);
 if(value.state==='NOT_OBSERVED'){
  if(value.inputDigest!==null||value.saved!==false||value.definitive!==false||value.receiptId!==null||value.phase!=='UNCONFIRMED'||value.baselineEffects!==null||value.code!==null||value.baselineSnapshot!==null)reject();
  return {state:'NOT_OBSERVED'};
 }
 if(!hash(value.inputDigest)||value.inputDigest!==reference?.inputDigest||!/^plan_baseline_receipt_[a-f0-9]{64}$/.test(value.receiptId||''))reject();
 if(value.state==='REJECTED'){
  if(value.saved!==false||value.definitive!==true||value.phase!=='PRE_SELECTION'||value.baselineEffects!==false||!PLAN_BASELINE_REJECTIONS.includes(value.code)||value.baselineSnapshot!==null)reject();
  return {state:'REJECTED',receiptId:value.receiptId};
 }
 if(value.state!=='RECORDED'||value.saved!==true||value.definitive!==true||value.phase!=='COMMITTED'||value.baselineEffects!==true||value.code!==null)reject();
 const snapshot=planBaselineActiveView(value.baselineSnapshot);
 if(!snapshot||snapshot.selectionReceiptId!==value.receiptId||!value.active||value.active.id!==snapshot.id||value.active.revision<snapshot.revision||value.active.revision===snapshot.revision&&JSON.stringify(canonical(value.active))!==JSON.stringify(canonical(snapshot)))reject();
 return {state:'RECORDED',receiptId:value.receiptId};
}
export async function planBaselineCommandDigest(body){
 body=planBaselineSelectionCommandView(body);
 const tuple=['plan-baseline-selection-v1','SELECT',body.scope,body.projectId,body.operationId.toLowerCase(),body.draftId,body.draftRevision,body.decisionReceiptId,body.sourceSha256,body.expectedBaselineId,body.expectedBaselineRevision,body.reason.trim(),true];
 return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(tuple))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
