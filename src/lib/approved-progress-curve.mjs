import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {parseProgressMeasurementQuantity,formatProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {MEASUREMENT_UNITS,publicTaskMeasurement} from './task-progress-measurement.js';

export const APPROVED_PROGRESS_CURVE_VERSION=1;
export const APPROVED_PROGRESS_LIMITS=Object.freeze({sourceRows:10000,pageSize:100});
export const approvedProgressUtc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const stable=value=>Array.isArray(value)?value.map(stable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const fail=(code='APPROVED_PROGRESS_HISTORY_INCOMPLETE',status=409)=>{throw new WorkspaceError(code,status);};
const demand=(value,code)=>{if(!value)fail(code);};
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
const quantity=(value,positive=false)=>{try{const parsed=parseProgressMeasurementQuantity(value,{allowZero:!positive});demand(formatProgressMeasurementQuantity(parsed)===value);return parsed;}catch{fail();}};
function measured(action,snapshot,proposalId,at){
 demand(Number.isInteger(action.progress)&&action.progress>=0&&action.progress<=100&&snapshot.progress===action.progress);
 let m=null;
 if(action.quantity!==null||action.baseline!==null||action.unit!==null){
  const executed=quantity(action.quantity),baseline=quantity(action.baseline,true);
  demand(executed<=baseline&&MEASUREMENT_UNITS.includes(action.unit)&&Number(executed*100n/baseline)===action.progress);
  m={definitionId:null,executed:action.quantity,baseline:action.baseline,unit:action.unit};
 }
 if(action.measurement){
  const v=action.measurement,previous=quantity(v.previous),delta=quantity(v.delta),executed=quantity(v.executed),reported=quantity(v.reported,v.mode==='DELTA');
  demand(m&&workspaceId(v.definitionId)&&['DELTA','CUMULATIVE'].includes(v.mode)&&previous+delta===executed&&(v.mode==='DELTA'?previous+reported===executed:reported===executed)&&v.baseline===m.baseline&&v.unit===m.unit&&v.executed===m.executed&&v.progress===action.progress);
  m.definitionId=v.definitionId;
  let projected;try{projected=publicTaskMeasurement(snapshot);}catch{fail();}
  demand(projected&&projected.definitionId===v.definitionId&&projected.executed===m.executed&&projected.baseline===m.baseline&&projected.unit===m.unit&&projected.approvedProposalId===proposalId&&projected.approvedAt===at&&Date.parse(projected.configuredAt)<=Date.parse(at));
 }else demand(!snapshot.measurement);
 return m;
}
function pointBase(snapshot,proposalId,at,context){
 demand(snapshot?.id===context.taskId&&workspaceId(proposalId)&&approvedProgressUtc(at)&&revision(snapshot.revision));
 return {id:proposalId,at,snapshotRevision:snapshot.revision};
}
function human(audit,proposal,context){
 const o=audit.metadata.outcome,p=o.proposal,r=proposal.result?.fieldOperations,a=proposal.action;
 demand(audit.metadata.command==='DECIDE_PROGRESS'&&o.kind==='PROGRESS_DECISION'&&p?.status==='APPLIED'&&p.result?.decision==='APPROVE');
 demand(/^field_[a-f0-9]{64}$/.test(audit.id)&&workspaceId(r?.actorId)&&audit.actorId===r.actorId&&workspaceId(a?.submittedBy)&&a.submittedBy!==r.actorId&&workspaceId(proposal.proposedByWorkerId)&&p.workerId===proposal.proposedByWorkerId&&a.workerId===proposal.proposedByWorkerId);
 demand(proposal.sourceProvider==='account-field'&&a?.fieldOperationsVersion===1&&a.taskId===context.taskId&&r?.decision==='APPROVE'&&r.taskUpdated===true&&same(o.task,r.task)&&same(p.result,r));
 demand(p.taskId===a.taskId&&['progress','quantity','baseline','unit'].every(k=>p[k]===a[k])&&same(p.measurement,a.measurement)&&same(p.evidenceIds,a.evidenceIds)&&Array.isArray(a.evidenceIds)&&a.evidenceIds.length>0&&new Set(a.evidenceIds).size===a.evidenceIds.length);
 const base=pointBase(o.task,proposal.id,r.recordedAt,context),measurement=measured(a,o.task,proposal.id,base.at);
 return {...base,origin:'HUMAN_APPROVAL',timeMeaning:'APPROVED_AT',progress:a.progress,measurement,receiptId:audit.id,executionId:null};
}
function execution(audit,proposal,context){
 const o=audit.metadata.outcome,x=o.execution,a=proposal.action,r=proposal.result;
 demand(o.kind==='EXECUTION_APPLIED'&&o.effectsApplied===true&&o.taskUpdated===true&&x?.version===1&&x.taskId===context.taskId&&workspaceId(x.id)&&workspaceId(x.mandateId)&&x.measurement);
 demand(workspaceId(x.executedBy)&&workspaceId(x.authorizedBy)&&x.authorizedBy!==x.executedBy&&audit.actorId===x.executedBy&&audit.metadata.actorId===x.executedBy&&a?.submittedBy===x.executedBy&&workspaceId(x.workerId)&&proposal.proposedByWorkerId===x.workerId&&audit.metadata.workerId===x.workerId&&audit.metadata.organizationId===context.organizationId);
 demand(audit.id===x.id&&proposal.sourceProvider==='field-execution-v1'&&proposal.sourceExternalId===x.id&&proposal.id==='execution_progress_'+digest(x.id)&&a?.fieldExecutionVersion===1&&a.taskId===context.taskId&&a.mandateId===x.mandateId&&a.authorizedBy===x.authorizedBy&&r?.taskUpdated===true&&r.authorization?.mandateId===x.mandateId&&r.authorization.issuedBy===x.authorizedBy&&same(a.measurement,x.measurement));
 const base=pointBase(o.task,proposal.id,x.recordedAt,context),v=x.measurement;
 const measurement=measured({progress:v.progress,quantity:v.executed,baseline:v.baseline,unit:v.unit,measurement:v},o.task,proposal.id,base.at);
 return {...base,origin:'AUTHORIZED_EXECUTION',timeMeaning:'AUTHORIZED_RECORDED_AT',progress:v.progress,measurement,receiptId:audit.id,executionId:x.id};
}

// Read only the two actual persisted writers. Receipts and proposals are a pair,
// not independent progress observations. Current Task is deliberately absent.
export function approvedProgressHistory(rows,context){
 demand(Array.isArray(rows)&&rows.length<=APPROVED_PROGRESS_LIMITS.sourceRows,'APPROVED_PROGRESS_SOURCE_LIMIT');
 const audits=[],proposals=new Map(),seen=new Map();
 for(const row of rows){
  demand(plain(row)&&workspaceId(row.id)&&row.projectId===context.projectId);
  const key=row.kind+':'+row.id;
  if(seen.has(key)){demand(same(seen.get(key),row));continue;}seen.set(key,row);
  if(row.kind==='PROPOSAL'){
   demand(row.type==='TASK_PROGRESS'&&row.status==='APPLIED'&&row.action?.taskId===context.taskId&&['account-field','field-execution-v1'].includes(row.sourceProvider),'APPROVED_PROGRESS_UNSUPPORTED_SOURCE');
   proposals.set(row.id,row);
  }else{
   demand(row.kind==='AUDIT'&&workspaceId(row.actorId)&&row.organizationId===context.organizationId&&row.entityType==='Project'&&row.metadata?.version===1&&row.metadata.projectId===context.projectId&&/^[a-f0-9]{64}$/.test(row.metadata.requestDigest||''));
   const o=row.metadata.outcome;
   if(row.auditAction==='field.operation.recorded'){
    demand(row.metadata.command==='DECIDE_PROGRESS'&&o?.kind==='PROGRESS_DECISION'&&o.proposal?.taskId===context.taskId);
    if(o.proposal.status==='REJECTED'&&o.proposal.result?.decision==='REJECT'&&o.task===null&&o.proposal.result.taskUpdated===false)continue;
    demand(o.proposal.status==='APPLIED'&&o.proposal.result?.decision==='APPROVE');
   }else{
    demand(row.auditAction==='field.execution.applied'&&o?.kind==='EXECUTION_APPLIED'&&o.execution?.taskId===context.taskId);
    if(o.taskUpdated===false&&o.task===null&&o.execution.measurement===null)continue;
   }
   audits.push(row);
  }
 }
 const used=new Set(),points=[];
 for(const row of audits){
  const o=row.metadata.outcome,id=row.auditAction==='field.operation.recorded'?o.proposal.id:'execution_progress_'+digest(o.execution.id),proposal=proposals.get(id);
  demand(proposal&&!used.has(id));used.add(id);
  points.push(row.auditAction==='field.operation.recorded'?human(row,proposal,context):execution(row,proposal,context));
 }
 demand(used.size===proposals.size);
 points.sort((a,b)=>a.at.localeCompare(b.at)||a.snapshotRevision.localeCompare(b.snapshotRevision)||a.id.localeCompare(b.id));
 let previous=null,segment=-1;
 for(const point of points){
  if(previous)demand(point.at!==previous.at||point.snapshotRevision!==previous.snapshotRevision);
  const signature=JSON.stringify(point.measurement&&[point.measurement.definitionId,point.measurement.baseline,point.measurement.unit]);
  if(previous&&signature===previous.signature){
   demand(point.progress>=previous.progress);
   if(point.measurement)demand(quantity(point.measurement.executed)>=quantity(previous.measurement.executed));
  }
  if(!previous||signature!==previous.signature)segment++;
  point.segment=segment;previous={...point,signature};
 }
 return {points,snapshot:digest(['approved-progress-curve-v1',context.organizationId,context.projectId,context.taskId,points])};
}

export function approvedProgressContext(input){
 const allowed=['projectId','scope','taskId',...(input?.cursor!==undefined?['cursor']:[])];
 if(!plain(input)||Object.keys(input).sort().join('|')!==allowed.sort().join('|')||!workspaceId(input.projectId)||!workspaceId(input.taskId)||!/^[a-f0-9]{64}$/.test(input.scope||'')||input.cursor!==undefined&&(typeof input.cursor!=='string'||input.cursor.length<1||input.cursor.length>1200))fail('APPROVED_PROGRESS_QUERY_INVALID',400);
 return {...input};
}
export function approvedProgressPage(history,context){
 let offset=0;
 if(context.cursor!==undefined){
  let cursor;try{cursor=JSON.parse(Buffer.from(context.cursor,'base64url').toString('utf8'));}catch{fail('APPROVED_PROGRESS_CURSOR_INVALID',400);}
  demand(plain(cursor)&&Object.keys(cursor).sort().join('|')==='offset|projectId|scope|snapshot|taskId'&&cursor.scope===context.scope&&cursor.projectId===context.projectId&&cursor.taskId===context.taskId&&Number.isSafeInteger(cursor.offset)&&cursor.offset>0&&cursor.offset%APPROVED_PROGRESS_LIMITS.pageSize===0&&cursor.offset<history.points.length,'APPROVED_PROGRESS_CURSOR_INVALID');
  demand(cursor.snapshot===history.snapshot,'APPROVED_PROGRESS_SOURCE_CHANGED');offset=cursor.offset;
 }
 const rows=history.points.slice(offset,offset+APPROVED_PROGRESS_LIMITS.pageSize),nextOffset=offset+rows.length;
 const nextCursor=nextOffset<history.points.length?Buffer.from(JSON.stringify({scope:context.scope,projectId:context.projectId,taskId:context.taskId,snapshot:history.snapshot,offset:nextOffset})).toString('base64url'):null;
 return {version:APPROVED_PROGRESS_CURVE_VERSION,kind:'APPROVED_PROGRESS_CURVE',scope:context.scope,projectId:context.projectId,taskId:context.taskId,state:'CONFIRMED',sourceScanComplete:true,coverage:'RETAINED_ACCOUNT_FIELD_AND_FIELD_EXECUTION_V1_ONLY',beforeFirst:'UNOBSERVED',timeMeaning:'APPROVAL_OR_AUTHORIZED_RECORD_TIME',snapshot:history.snapshot,offset,total:history.points.length,rows,nextCursor};
}
