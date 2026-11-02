import {attendanceClosureSource,proposeAttendanceClosure,decideAttendanceClosure,attendanceClosureAuditDescriptors,correctionLocalInstant} from '../../src/lib/attendance-closure-policy.mjs';
import {scopeStamp} from '../../src/lib/workspace-policy.mjs';

export const organizationId='org_synthetic',projectId='project_synthetic',workerId='worker_synthetic',shiftId='shift_synthetic';
export const clone=value=>structuredClone(value);
export const ids={proposal:'11111111-1111-4111-8111-111111111111',decision:'22222222-2222-4222-8222-222222222222',otherProposal:'33333333-3333-4333-8333-333333333333',otherDecision:'44444444-4444-4444-8444-444444444444'};
export const beneficiary={actorId:'actor_beneficiary',clerkUserId:'user_Beneficiary',accessDigest:'b'.repeat(64)};
export function context(actorId='actor_maker',clerkUserId='user_Maker',role='ADMIN'){
 const member={organizationId,actorId,clerkUserId,role,membershipId:'membership_'+actorId};
 const scope=scopeStamp({userId:clerkUserId,organizationId:'org_Synthetic',organizationRole:role==='ADMIN'?'org:admin':'org:member'},member);
 return {member,actorAccessDigest:'c'.repeat(64),scope,projectId};
}
export const scope=context().scope;
export const reviewer=context('actor_reviewer','user_Reviewer','DIRECTOR');
export const proposer={actorId:'actor_maker',clerkUserId:'user_Maker',role:'ADMIN',accessDigest:'c'.repeat(64)};
export const otherJourneys={complete:true,rows:[]};
export function events({closed=false,breaks=false,onBreak=false,verification='VERIFIED',review=null}={}){
 const rows=[];
 const append=(eventType,recordedAt)=>{const previous=rows.at(-1);rows.push({id:'mark_'+(rows.length+1),projectId,workerId,metadata:{fieldOperations:{version:1,eventType,phase:eventType==='BREAK_START'?'ON_BREAK':'WORKING',shiftId,sequence:rows.length+1,previousEventId:previous?.id||null,recordedBy:beneficiary.actorId,recordedAt,verificationStatus:['CHECK_IN','CHECK_OUT'].includes(eventType)?verification:'NOT_REQUIRED',review:['CHECK_IN','CHECK_OUT'].includes(eventType)?clone(review):null}}});};
 append('CHECK_IN','2026-10-26T11:00:00.000Z');
 if(breaks||onBreak)append('BREAK_START','2026-10-26T15:00:00.000Z');
 if(breaks)append('BREAK_END','2026-10-26T16:00:00.000Z');
 if(closed)append('CHECK_OUT','2026-10-27T11:00:00.000Z');
 return rows;
}
export const sourceFor=(rows=events(),person=beneficiary)=>attendanceClosureSource({organizationId,projectId,workerId,shiftId,beneficiary:person,events:rows});
export function proposalCommand(source=sourceFor(),end='2026-10-26T20:00:00.000Z',operationId=ids.proposal,actor=context()){
 const zone='America/Argentina/Buenos_Aires';
 return {operationId,projectId,scope:actor.scope,action:'PROPOSE_ATTENDANCE_CLOSURE',payload:{workerId,shiftId,anchorEventId:source.anchorEventId,expectedHeadEventId:source.headEventId,sourceDigest:source.sourceDigest,effectiveEndAt:end,effectiveLocalEnd:correctionLocalInstant(end,zone),effectiveTimeZone:zone,reason:'Salida omitida; horario declarado por el responsable.'}};
}
export const proposalFor=(source=sourceFor(),command=proposalCommand(source),actor=context())=>proposeAttendanceClosure(command,{context:actor,source,now:'2026-10-27T11:00:00.000Z',otherJourneys});
export const decisionCommand=(proposal,decision='APPROVE',operationId=ids.decision,actor=reviewer)=>({operationId,projectId,scope:actor.scope,action:'DECIDE_ATTENDANCE_CLOSURE',payload:{proposalId:proposal.id,proposalRevision:proposal.revision,proposalDigest:proposal.proposalDigest,sourceDigest:proposal.sourceDigest,decision,reason:'Revisión independiente de la hora efectiva declarada.'}});
export const decisionFor=(source,proposal,command=decisionCommand(proposal),actor=reviewer)=>decideAttendanceClosure(command,{context:actor,source,proposal,proposer,now:'2026-10-27T12:00:00.000Z',otherJourneys});
export function approved(source=sourceFor()){
 const proposal=proposalFor(source),decision=decisionFor(source,proposal);return {proposal,decision,audits:attendanceClosureAuditDescriptors(proposal,decision)};
}
