import {correctionDigest,correctionLocalInstant} from '../../src/lib/attendance-closure-policy.mjs';
import {readAuditedAttendanceShift,proposeAuditedAttendanceClosure,decideAuditedAttendanceClosure,auditedAttendanceClosureDescriptors,projectAuditedAttendanceChronology} from '../../src/lib/attendance-chronology.mjs';
import {events,context,reviewer,proposer,beneficiary,organizationId,projectId,workerId,shiftId,ids} from './attendance-effective-legacy.fixture.mjs';
export {context,reviewer,proposer,beneficiary,organizationId,projectId,workerId,shiftId,ids};
export const clone=value=>structuredClone(value);
export function recordingAudit(row,org=organizationId){
 const original={id:row.id,workerId:row.workerId,...clone(row.metadata.fieldOperations),review:null};delete original.overtime;
 return {id:'field_'+correctionDigest(['recorded',row.projectId,row.id]),organizationId:org,actorId:original.recordedBy,action:'field.operation.recorded',entityType:'Project',entityId:row.projectId,createdAt:new Date(Date.parse(original.recordedAt)-1000).toISOString(),metadata:{version:1,projectId:row.projectId,command:'ATTENDANCE',requestDigest:correctionDigest(['original request',row.id]),outcome:{kind:'ATTENDANCE',event:original}}};
}
export function reviewAudit(row,org=organizationId){
 const event={id:row.id,workerId:row.workerId,...clone(row.metadata.fieldOperations)};
 return {id:'field_'+correctionDigest(['reviewed',row.id,event.review]),organizationId:org,actorId:event.review.actorId,action:'field.operation.recorded',entityType:'Project',entityId:row.projectId,createdAt:new Date(Date.parse(event.review.recordedAt)-1000).toISOString(),metadata:{version:1,projectId:row.projectId,command:'REVIEW_ATTENDANCE',requestDigest:correctionDigest(['review request',row.id,event.review]),outcome:{kind:'ATTENDANCE_REVIEW',event}}};
}
export function auditedInput({closed=false,breaks=false,onBreak=false}={}){
 const rows=events({closed,breaks,onBreak,verification:'REVIEW_REQUIRED'}).map(row=>{
  row.checkedInAt=new Date(Date.parse(row.metadata.fieldOperations.recordedAt)+3).toISOString();
  Object.assign(row.metadata.fieldOperations,{sectorId:'sector_synthetic',sectorName:'Synthetic sector',configRevision:'config_synthetic',qrStatus:'NOT_PROVIDED',source:'account',location:['CHECK_IN','CHECK_OUT'].includes(row.metadata.fieldOperations.eventType)?{latitude:0,longitude:0,accuracyMeters:null,distanceMeters:0,geofenceRadiusMeters:100,locationCapturedAt:row.metadata.fieldOperations.recordedAt,noticeVersion:'field-location-v1'}:null});return row;
 });
 return {organizationId,projectId,workerId,shiftId,beneficiary:clone(beneficiary),events:rows,previousEvent:null,recordingAudits:rows.map(row=>recordingAudit(row)),reviewAudits:[],auditSetComplete:true,observedAt:'2026-10-27T14:00:00.000Z'};
}
export function withReview(input,{decision='REJECT',recordedAt='2026-10-27T15:00:00.000Z',eventId=input.events[0].id}={}){
 const next=clone(input),row=[...(next.previousEvent?[next.previousEvent]:[]),...next.events].find(item=>item.id===eventId);
 row.metadata.fieldOperations.review={decision,reason:'Revisión humana de ubicación registrada.',actorId:'actor_locationReviewer',recordedAt};
 next.reviewAudits=next.reviewAudits.filter(a=>a.metadata.outcome.event.id!==eventId);next.reviewAudits.push(reviewAudit(row));next.observedAt='2026-10-27T18:00:00.000Z';return next;
}
export function proposalCommand(snapshot,operationId=ids.proposal){
 const s=snapshot.source129,end='2026-10-26T20:00:00.000Z',zone='America/Argentina/Buenos_Aires';
 return {operationId,projectId:snapshot.projectId,scope:context().scope,action:'PROPOSE_ATTENDANCE_CLOSURE',payload:{workerId:snapshot.workerId,shiftId:snapshot.shiftId,anchorEventId:s.anchorEventId,expectedHeadEventId:s.headEventId,sourceDigest:s.sourceDigest,effectiveEndAt:end,effectiveLocalEnd:correctionLocalInstant(end,zone),effectiveTimeZone:zone,reason:'Salida efectiva declarada para revisión humana.'}};
}
export function decisionCommand(proposalEnvelope,decision='APPROVE',operationId=ids.decision){const p=proposalEnvelope.proposal;return {operationId,projectId:p.projectId,scope:reviewer.scope,action:'DECIDE_ATTENDANCE_CLOSURE',payload:{proposalId:p.id,proposalRevision:p.revision,proposalDigest:p.proposalDigest,sourceDigest:p.sourceDigest,decision,reason:'Revisión independiente de marcas y hora efectiva.'}};}
export function approved(input=auditedInput()){
 const snapshot=readAuditedAttendanceShift(input),otherJourneys={complete:true,rows:[]};
 const proposalEnvelope=proposeAuditedAttendanceClosure(proposalCommand(snapshot),{context:context(),snapshot,now:'2026-10-27T14:00:00.000Z',otherJourneys});
 const decisionEnvelope=decideAuditedAttendanceClosure(decisionCommand(proposalEnvelope),{context:reviewer,snapshot,proposalEnvelope,proposer,now:'2026-10-27T14:30:00.000Z',otherJourneys});
 const bundle={proposalEnvelope,decisionEnvelope,audits:auditedAttendanceClosureDescriptors(proposalEnvelope,decisionEnvelope)};
 return {snapshot,bundle,projection:projectAuditedAttendanceChronology({snapshot,corrections:[bundle]})};
}
export function nextEvent(prior,{otherProject=false}={}){
 return {organizationId,projectId:otherProject?'project_other':prior.projectId,workerId:otherProject?'worker_other':prior.workerId,beneficiaryActorId:beneficiary.actorId,beneficiaryClerkUserId:beneficiary.clerkUserId,id:'mark_next',shiftId:'shift_next',sequence:otherProject?1:prior.lastRealSequence+1,previousEventId:otherProject?null:prior.lastRealEventId,recordedAt:'2026-10-27T17:00:00.000Z'};
}
export function successorInput(oldInput,prior,next,checkpoint){
 const last=clone(oldInput.events.at(-1)),row=clone(oldInput.events[0]);row.id=next.id;row.projectId=next.projectId;row.workerId=next.workerId;row.checkedInAt='2026-10-27T17:00:00.003Z';
 Object.assign(row.metadata.fieldOperations,{eventType:'CHECK_IN',phase:'WORKING',shiftId:next.shiftId,sequence:next.sequence,previousEventId:next.previousEventId,recordedAt:next.recordedAt,previousClosureCheckpoint:checkpoint,review:null});
 const same=next.projectId===oldInput.projectId&&next.workerId===oldInput.workerId;
 return {organizationId,projectId:next.projectId,workerId:next.workerId,shiftId:next.shiftId,beneficiary:clone(beneficiary),events:[row],previousEvent:same?last:null,recordingAudits:[...(same?[oldInput.recordingAudits.at(-1)]:[]),recordingAudit(row)],reviewAudits:same?oldInput.reviewAudits.filter(a=>a.metadata.outcome.event.id===last.id):[],auditSetComplete:true,observedAt:'2026-10-27T18:00:00.000Z',precedingClosure:prior};
}
