import {workspaceId,digest} from './workspace-policy.mjs';
import {fieldTransition} from './field-operations-policy.mjs';

const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const facts=row=>{const {overtime:ignored,...event}=row.metadata?.fieldOperations||{};void ignored;return {id:row.id,projectId:row.projectId,workerId:row.workerId,event:stable(event)};};
export function summarizeFieldShift({events,previousEvent=null,projectId,workerId,shiftId}){
 const fail=code=>({status:'INTEGRITY_REVIEW_REQUIRED',complete:false,elapsedMs:null,breakMs:null,netMs:null,sourceDigest:null,sourceEventIds:[],issues:[code],evidenceStatus:'BLOCKED'});
 if(![projectId,workerId,shiftId].every(workspaceId)||!Array.isArray(events)||!events.length)return fail('CHAIN_MISSING');
 const rows=[...events].sort((a,b)=>a.metadata?.fieldOperations?.sequence-b.metadata?.fieldOperations?.sequence||String(a.id).localeCompare(String(b.id)));
 const first=rows[0],start=first.metadata?.fieldOperations;
 if(!start||start.eventType!=='CHECK_IN'||!Number.isSafeInteger(start.sequence)||start.sequence<1||!workspaceId(start.recordedBy))return fail('CHAIN_START_INVALID');
 const predecessor=previousEvent?.metadata?.fieldOperations;
 if(start.sequence===1?start.previousEventId!==null:!previousEvent||previousEvent.id!==start.previousEventId||previousEvent.projectId!==projectId||previousEvent.workerId!==workerId||predecessor?.version!==1||predecessor.sequence!==start.sequence-1||predecessor.eventType!=='CHECK_OUT'||!utc(predecessor.recordedAt))return fail('CHAIN_PREDECESSOR_INVALID');
 let last=predecessor||null,lastRow=previousEvent,lastAt=predecessor?Date.parse(predecessor.recordedAt):null,breakAt=null,breakMs=0,evidenceStatus='READY';
 const ids=new Set();
 for(let index=0;index<rows.length;index++){
  const row=rows[index],event=row.metadata?.fieldOperations;
  if(!workspaceId(row.id)||ids.has(row.id)||row.projectId!==projectId||row.workerId!==workerId||event?.version!==1||event.shiftId!==shiftId||event.recordedBy!==start.recordedBy||!Number.isSafeInteger(event.sequence)||event.sequence!==start.sequence+index||event.previousEventId!==(lastRow?.id||null)||!utc(event.recordedAt))return fail('CHAIN_REFERENCE_INVALID');
  ids.add(row.id);const at=Date.parse(event.recordedAt);
  if(lastAt!==null&&at<lastAt)return fail('CLOCK_DECREASED');
  let transition;try{transition=fieldTransition(event.eventType,last);}catch{return fail('CHAIN_TRANSITION_INVALID');}
  if(event.phase!==transition.phase||transition.closed&&index!==rows.length-1)return fail('CHAIN_PHASE_INVALID');
  const locationEvent=['CHECK_IN','CHECK_OUT'].includes(event.eventType);
  if(locationEvent?!['VERIFIED','REVIEW_REQUIRED'].includes(event.verificationStatus):event.verificationStatus!=='NOT_REQUIRED')return fail('CHAIN_VERIFICATION_INVALID');
  if(event.verificationStatus==='REVIEW_REQUIRED'){
   if(event.review!==null&&(!event.review||!['APPROVE','REJECT'].includes(event.review.decision)||!workspaceId(event.review.actorId)||event.review.actorId===event.recordedBy||!utc(event.review.recordedAt)))return fail('CHAIN_REVIEW_INVALID');
   if(event.review?.decision==='REJECT')evidenceStatus='REJECTED';else if(!event.review&&evidenceStatus!=='REJECTED')evidenceStatus='PENDING_REVIEW';
  }
  if(event.eventType==='BREAK_START')breakAt=at;
  if(event.eventType==='BREAK_END'){breakMs+=at-breakAt;breakAt=null;if(!Number.isSafeInteger(breakMs))return fail('DURATION_UNSAFE');}
  last=event;lastRow=row;lastAt=at;
 }
 const closed=last.eventType==='CHECK_OUT',elapsedMs=lastAt-Date.parse(start.recordedAt),netMs=elapsedMs-breakMs;
 if(![elapsedMs,breakMs,netMs].every(value=>Number.isSafeInteger(value)&&value>=0))return fail('DURATION_UNSAFE');
 return {status:closed?'CLOSED':last.phase==='ON_BREAK'?'ON_BREAK':'OPEN',complete:closed,projectId,workerId,shiftId,closingEventId:closed?lastRow.id:null,recordedBy:start.recordedBy,startedAt:start.recordedAt,endedAt:closed?last.recordedAt:null,lastRecordedAt:last.recordedAt,elapsedMs,breakMs,netMs,sourceEventIds:rows.map(row=>row.id),sourceDigest:digest([facts(previousEvent||{id:null,projectId,workerId,metadata:null}),...rows.map(facts)]),evidenceStatus,issues:[],timeSource:'DATABASE_FIELD_RECORDED_AT',durationDefinition:'RECORDED_INTERVALS_EXCLUDING_REGISTERED_BREAKS'};
}
