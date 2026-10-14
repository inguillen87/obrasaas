import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeDocumentCurve} from '../../src/lib/plan-import-document-curve.mjs';
import {normalizeDocumentCurveDecision,documentCurveDecisionDigest} from '../../src/lib/plan-import-policy.mjs';
import {normalizePlanBaselineSelection,planBaselineSelectionDigest} from '../../src/lib/plan-baseline-policy.mjs';

export const DOCUMENT_CURVE_UI_FIXTURE_VERSION='synthetic-document-monthly-curve-wire-v1';
export const DOCUMENT_CURVE_UI_PDF=Buffer.from('%PDF-1.4\n% Synthetic monthly finance fixture; no real OCR or business document.\n%%EOF\n');
const sha=value=>createHash('sha256').update(value).digest('hex'),sourceSha256=sha(DOCUMENT_CURVE_UI_PDF),time='2026-10-14T02:30:00.000Z';
const ref=quote=>[{page:1,bbox:[.1,.2,.7,.4],quote}];
const field=(decimalText,rawText=decimalText)=>({rawText,decimalText,evidence:rawText===null?[]:ref(rawText),uncertainty:decimalText===null?'No hay un valor legible en esta fuente sintética.':''});
export function documentCurveUiValue({amountOnly=false,gaps=false,incorrect=false}={}){
 const total='100000000000000000000.000000000004',first='25000000000000000000.000000000001',last='75000000000000000000.000000000003';
 const value={version:1,profile:'DOCUMENT_MONTHLY_CURVE_V1',kind:'PLANNED_MONETARY_INVESTMENT',sourceSha256,currency:{code:null,rawText:null,evidence:[],uncertainty:'El documento sintético no confirma la moneda.'},total:field(total),initialCumulative:field('0'),periods:[
  {ordinal:1,label:'Mes 1',labelEvidence:ref('Mes 1; fuente sintética sin año'),calendarMonth:null,calendarEvidence:[],monthlyAmount:field(incorrect?'25000000000000000000.000000000009':first,first),cumulativeAmount:field(first),monthlyPercentage:field('.25','25%'),cumulativePercentage:field('.25','25%')},
  {ordinal:2,label:'Mes 2',labelEvidence:ref('Mes 2; fuente sintética sin año'),calendarMonth:null,calendarEvidence:[],monthlyAmount:field(last),cumulativeAmount:field(total),monthlyPercentage:field('.75','75%'),cumulativePercentage:field('1','100%')}
 ]};
 if(amountOnly)for(const period of value.periods){period.cumulativeAmount=field(null);period.monthlyPercentage=field(null);period.cumulativePercentage=field(null);}
 if(gaps){value.periods[1].cumulativePercentage=field(null);if(amountOnly)value.periods[1].monthlyAmount=field(null);}
 return normalizeDocumentCurve(value);
}

/** Only protocol-shaped synthetic responses. No SQL, OCR, auth or provider call. */
export function createDocumentCurveUiScenario({scope='a'.repeat(64),projectId='project_synthetic',canApprove=true,mode='NORMAL'}={}){
 const draftId='plan_draft_'+sha('document-ui:'+projectId+':'+scope),receipts=new Map(),trace=[];
 let current=null,active=null,uploaded=null;
 const clone=value=>structuredClone(value),denied=()=>({status:403,value:{code:'PLAN_IMPORT_PERMISSION_REQUIRED',saved:false}});
 function publicDraft(){return current?clone(current):null;}
 function sourceCandidate(){return {draftId,draftRevision:current.revision,decisionReceiptId:current.decision.receiptId,sourceSha256,profile:'DOCUMENT_MONTHLY_CURVE_V1',sourceRowCount:0,selectedRowCount:0,appliedAt:current.decision.recordedAt,curve:clone(current.reviewedCurve),sourceKind:'DOCUMENT',presentation:'DOCUMENT_MONTHLY_CURVE'};}
 const list=()=>({scope,projectId,canApprove,drafts:current&&(!current.financialSource||canApprove)?[publicDraft()]:[],truncated:false});
 function recorded(body){
  const id='plan_receipt_'+sha('document-ui:'+body.operationId),inputDigest=documentCurveDecisionDigest(body);
  current={...current,revision:current.revision+1,status:body.action==='APPLY_CURVE'?'APPLIED':body.action==='REJECT'?'REJECTED':'READY',...(body.action==='REVIEW_CURVE'?{reviewedCurve:clone(body.curve),documentReviewed:true}:{}),decision:{receiptId:id,action:body.action,actorId:'actor_synthetic',recordedAt:time}};
  const value={scope,projectId,replayed:false,receiptId:id,action:body.action,operationId:body.operationId,expectedRevision:body.expectedRevision,inputDigest,state:'RECORDED',definitive:true,phase:'COMMITTED',saved:true,taskEffects:false,baselineEffects:false,draft:publicDraft(),taskSnapshots:[],tasks:[],recordedAt:time};
  receipts.set(body.operationId,clone(value));return value;
 }
 async function handle(url,options={}){
  const target=new URL(url,'http://synthetic.invalid'),method=options.method||'GET',record={path:target.pathname,method,operationId:target.searchParams.get('operationId'),action:null};trace.push(record);
  if(method==='GET'){
   assert.equal(target.searchParams.get('scope'),scope);assert.equal(target.searchParams.get('projectId'),projectId);
   if(target.pathname==='/api/identity/plan-import'){
    const op=target.searchParams.get('operationId');if(op){record.operationId=op;const saved=receipts.get(op);if(saved){if(saved.draft?.financialSource&&!canApprove)return denied();return {status:200,value:{...clone(saved),replayed:true}};}return {status:200,value:{scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false}};}
    if(target.searchParams.has('draftId')){assert.equal(target.searchParams.get('draftId'),draftId);if(current?.financialSource&&!canApprove)return denied();return {status:200,value:{scope,projectId,draft:publicDraft()}};}
    return {status:200,value:list()};
   }
   assert.equal(target.pathname,'/api/identity/plan-baseline');if(!canApprove)return denied();const op=target.searchParams.get('operationId');if(op)return {status:200,value:receipts.has(op)?{...clone(receipts.get(op)),replayed:true}:{version:1,scope,projectId,action:'SELECT',operationId:op,inputDigest:null,state:'NOT_OBSERVED',saved:false,definitive:false,replayed:false,receiptId:null,phase:'UNCONFIRMED',baselineEffects:null,code:null,baselineSnapshot:null,active:clone(active)}};
   return {status:200,value:{version:1,scope,projectId,canSelect:true,active:clone(active),candidates:current?.status==='APPLIED'?[sourceCandidate()]:[],nextCursor:null}};
  }
  assert.equal(method,'POST');
  if(options.body instanceof FormData){
   assert.equal(target.pathname,'/api/identity/plan-import');const form=options.body,op=form.get('operationId');record.operationId=op;record.action='UPLOAD';assert.equal(form.get('scope'),scope);assert.equal(form.get('projectId'),projectId);assert.equal(uploaded,null,'New paid upload is forbidden after an admitted attempt');
   const finance=form.get('consent')==='plan-document-monthly-curve-openai-v1';if(finance&&!canApprove)return denied();assert.ok(finance||form.get('consent')==='plan-document-openai-v1');uploaded=op;
   current={id:draftId,revision:1,status:mode==='UNKNOWN'?'FAILED':'READY',existingTaskCount:finance?null:0,source:{contentType:'application/pdf',bytes:DOCUMENT_CURVE_UI_PDF.length,sha256:sourceSha256},rows:finance?[]:[{title:'Tarea sintética',startsOn:null,endsOn:null,evidence:'Página sintética 1',uncertainty:'Fechas por revisar'}],warnings:[],failure:mode==='UNKNOWN'?'AI_REQUEST_UNCONFIRMED':null,createdAt:time,updatedAt:time,processingExpired:false,decision:null,sourceAvailable:true,...(finance?{financialSource:true,documentCurve:mode==='UNKNOWN'?null:documentCurveUiValue({amountOnly:['AMOUNTS','AMOUNT_GAPS'].includes(mode),gaps:['GAPS','AMOUNT_GAPS'].includes(mode),incorrect:mode==='INCORRECT'}),reviewedCurve:null,documentReviewed:false}:{}),...(mode==='UNKNOWN'?{usage:{version:1,receiptId:'organization_usage_'+sha(op),state:'UNKNOWN',coverageState:'TRIAL_CURRENT'}}:{})};
   const value={scope,projectId,state:'RECORDED',saved:true,replayed:false,draft:publicDraft()};receipts.set(op,clone(value));return {status:200,value};
  }
  const body=typeof options.body==='string'?JSON.parse(options.body):options.body;record.operationId=body.operationId;record.action=body.action;
  if(receipts.has(body.operationId))return {status:200,value:{...clone(receipts.get(body.operationId)),replayed:true}};
  if(!canApprove)return denied();assert.equal(body.scope,scope);assert.equal(body.projectId,projectId);
  if(target.pathname==='/api/identity/plan-import'){
   const normalized=normalizeDocumentCurveDecision(body);assert.equal(normalized.draftId,draftId);assert.equal(normalized.expectedRevision,current.revision);assert.equal(normalized.rows,null);
   if(normalized.action==='REVIEW_CURVE')assert.equal(normalized.curve.sourceSha256,sourceSha256);
   if(normalized.action==='APPLY_CURVE'){assert.equal(current.documentReviewed,true);assert.notEqual(current.reviewedCurve.coherence.status,'INCONSISTENT');assert.ok(current.reviewedCurve.periods.some(p=>['monthlyAmount','cumulativeAmount','monthlyPercentage','cumulativePercentage'].some(key=>p[key].decimalText!==null)));}
   return {status:200,value:recorded(normalized)};
  }
  assert.equal(target.pathname,'/api/identity/plan-baseline');const normalized=normalizePlanBaselineSelection(body);assert.equal(current.status,'APPLIED');const candidate=sourceCandidate();for(const key of ['draftId','draftRevision','decisionReceiptId','sourceSha256'])assert.equal(normalized[key],candidate[key]);assert.equal(normalized.expectedBaselineId,active?.id??null);assert.equal(normalized.expectedBaselineRevision,active?.revision??0);
  active={...candidate,version:1,id:'plan_baseline_'+sha(scope+projectId),revision:(active?.revision??0)+1,selectionReceiptId:'plan_baseline_receipt_'+sha(body.operationId),selectedBy:'actor_synthetic',selectedAt:time,reason:normalized.reason};
  const result={version:1,scope,projectId,action:'SELECT',operationId:normalized.operationId,inputDigest:planBaselineSelectionDigest(normalized),state:'RECORDED',saved:true,definitive:true,replayed:false,receiptId:active.selectionReceiptId,phase:'COMMITTED',baselineEffects:true,code:null,baselineSnapshot:clone(active),active:clone(active)};receipts.set(body.operationId,clone(result));return {status:200,value:result};
 }
 return {handle,trace,publicDraft,active:()=>clone(active),setPermission:value=>{canApprove=value;},sourceSha256};
}
