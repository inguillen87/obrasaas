import {WorkspaceError,workspaceId} from './workspace-policy.mjs';
import {fieldTransition} from './field-operations-policy.mjs';
import {normalizeAttendanceClosureCommand,proposeAttendanceClosure,decideAttendanceClosure,validateAttendanceClosureSource,validateAttendanceClosureProposal,validateAttendanceClosureDecision,attendanceClosureAuditDescriptors,correctionDigest,correctionSame,correctionIdentitySame,correctionCopy,correctionExact,correctionUtc} from './attendance-closure-policy.mjs';

// Amendment of private129. No store/HTTP/clock/provider and no grant of access.
// Audit rows and complete sets must be supplied by the future canonical store.
const snapshots=new WeakSet(),projections=new WeakSet();
const fail=(code='ATTENDANCE_CHRONOLOGY_INVALID')=>{throw new WorkspaceError(code,409);};
const id=value=>{if(!workspaceId(value))fail();return value;};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fact=row=>{const {review:ignoredReview,overtime:ignoredOvertime,...event}=row.metadata?.fieldOperations||{};void ignoredReview;void ignoredOvertime;return {id:row.id,projectId:row.projectId,workerId:row.workerId,event};};
const auditColumns=['id','organizationId','actorId','action','entityType','entityId','metadata'];
function auditView(audit){
 if(!audit||auditColumns.some(key=>!Object.hasOwn(audit,key)))fail('ATTENDANCE_AUDIT_INVALID');
 // Commit createdAt when selected, without ordering it against event time:
 // transaction-start createdAt is not the clock_timestamp timestamp.
 const value=Object.fromEntries(auditColumns.map(key=>[key,structuredClone(audit[key])]));
 if(Object.hasOwn(audit,'createdAt')){value.createdAt=audit.createdAt instanceof Date?audit.createdAt.toISOString():audit.createdAt;correctionUtc(value.createdAt);}
 return value;
}
const eventForAudit=row=>({id:row.id,workerId:row.workerId,...row.metadata.fieldOperations});
function withoutAnnotations(event){const {review:ignoredReview,overtime:ignoredOvertime,...value}=event;void ignoredReview;void ignoredOvertime;return value;}
function withoutOvertime(event){const {overtime:ignored,...value}=event;void ignored;return value;}
function assertAudit(audit,row,organizationId,command){
 const a=auditView(audit),e=row.metadata.fieldOperations,m=a.metadata,observed=m?.outcome?.event;
 if(!/^field_[a-f0-9]{64}$/.test(a.id)||a.organizationId!==organizationId||a.action!=='field.operation.recorded'||a.entityType!=='Project'||a.entityId!==row.projectId||m?.version!==1||m.projectId!==row.projectId||m.command!==command||!hash(m.requestDigest)||m.outcome?.kind!==(command==='ATTENDANCE'?'ATTENDANCE':'ATTENDANCE_REVIEW')||!observed||observed.id!==row.id||observed.workerId!==row.workerId)fail('ATTENDANCE_AUDIT_INVALID');
 if(command==='ATTENDANCE'){
  if(a.actorId!==e.recordedBy||observed.review!==null||!correctionSame(withoutAnnotations(observed),withoutAnnotations(eventForAudit(row))))fail('ATTENDANCE_RECORDING_AUDIT_CHANGED');
 }else if(!e.review||a.actorId!==e.review.actorId||a.actorId===e.recordedBy||!correctionSame(withoutOvertime(observed),withoutOvertime(eventForAudit(row))))fail('ATTENDANCE_REVIEW_AUDIT_CHANGED');
 // Original ATTENDANCE/REVIEW_ATTENDANCE receipts lack operationId/action
 // correlation in F418. Never invent one or reverse its one-way receipt hash.
 return a;
}
function validateReview(row,observedAt){
 const e=row.metadata.fieldOperations,review=e.review;
 if(!Object.hasOwn(e,'review'))fail('ATTENDANCE_REVIEW_INVALID');
 if(review===null)return;
 correctionExact(review,['decision','reason','actorId','recordedAt']);
 if(e.verificationStatus!=='REVIEW_REQUIRED'||!['APPROVE','REJECT'].includes(review.decision)||!workspaceId(review.actorId)||review.actorId===e.recordedBy||typeof review.reason!=='string'||review.reason.trim().length<8)fail('ATTENDANCE_REVIEW_INVALID');
 correctionUtc(review.recordedAt);
 if(Date.parse(review.recordedAt)<Date.parse(e.recordedAt)||Date.parse(review.recordedAt)>Date.parse(observedAt))fail('ATTENDANCE_REVIEW_INVALID');
}
function evidenceStatus(rows){
 let status='READY';
 for(const row of rows){const e=row.metadata.fieldOperations;if(e.verificationStatus==='REVIEW_REQUIRED'){if(e.review?.decision==='REJECT')status='REJECTED';else if(!e.review&&status!=='REJECTED')status='PENDING_REVIEW';}}
 return status;
}
function nextIdentity(row,organizationId,beneficiary){const e=row.metadata.fieldOperations;return {organizationId,projectId:row.projectId,workerId:row.workerId,beneficiaryActorId:e.recordedBy,beneficiaryClerkUserId:beneficiary.clerkUserId,id:row.id,shiftId:e.shiftId,sequence:e.sequence,previousEventId:e.previousEventId,recordedAt:e.recordedAt};}
const nextKeys=['organizationId','projectId','workerId','beneficiaryActorId','beneficiaryClerkUserId','id','shiftId','sequence','previousEventId','recordedAt'];
function validateNext(next){
 correctionExact(next,nextKeys);for(const key of ['organizationId','projectId','workerId','beneficiaryActorId','id','shiftId'])id(next[key]);
 if(typeof next.beneficiaryClerkUserId!=='string'||!/^user_[A-Za-z0-9]+$/.test(next.beneficiaryClerkUserId)||!Number.isSafeInteger(next.sequence)||next.sequence<1||next.previousEventId!==null&&!workspaceId(next.previousEventId))fail('ATTENDANCE_CHECKPOINT_INVALID');
 correctionUtc(next.recordedAt);return next;
}
function checkpointValue(prior,next,globalSnapshotDigest){
 return {version:1,kind:'HUMAN_CLOSURE_CHECKPOINT',organizationId:prior.organizationId,beneficiaryActorId:prior.beneficiary.actorId,beneficiaryClerkUserId:prior.beneficiary.clerkUserId,sourceProjectId:prior.projectId,sourceWorkerId:prior.workerId,sourceShiftId:prior.shiftId,sourceLastEventId:prior.lastRealEventId,sourceLastSequence:prior.lastRealSequence,sourceTemporalDigest:prior.temporalDigest,correctionFactId:prior.correction.factId,decisionReceiptId:prior.correction.decisionReceiptId,decisionDigest:prior.correction.decisionDigest,effectiveEndAt:prior.effective.endedAt,approvedAt:prior.correction.approvedAt,target:next,globalSnapshotDigest};
}
function assertUnusedNextEventId(next,journey){
 // This covers identities actually available in the verified projection. The
 // future store must still reject collisions with older/unread marks via its
 // canonical insert/PK; a complete person-state port is not an all-ID registry.
 if(next.id===next.previousEventId||next.id===journey.lastRealEventId||journey.observed.sourceEventIds.includes(next.id))fail('ATTENDANCE_CHECKPOINT_EVENT_ID_REUSED');
}
export function verifyHumanClosureCheckpoint(checkpoint,{prior,next}){
 if(!projections.has(prior)||prior.effective.state!=='HUMAN_CORRECTED_CLOSED'||!prior.correction)fail('ATTENDANCE_CHECKPOINT_UNVERIFIED_CLOSURE');validateNext(next);
 assertUnusedNextEventId(next,prior);
 if(!checkpoint||!hash(checkpoint.globalSnapshotDigest))fail('ATTENDANCE_CHECKPOINT_INVALID');
 const expected=checkpointValue(prior,next,checkpoint.globalSnapshotDigest),{checkpointDigest,...value}=checkpoint;
 if(!hash(checkpointDigest)||correctionDigest(value)!==checkpointDigest||!correctionSame(value,expected)||next.organizationId!==prior.organizationId||next.beneficiaryActorId!==prior.beneficiary.actorId||next.beneficiaryClerkUserId!==prior.beneficiary.clerkUserId||Date.parse(next.recordedAt)<Date.parse(prior.effective.endedAt)||Date.parse(next.recordedAt)<Date.parse(prior.correction.approvedAt))fail('ATTENDANCE_CHECKPOINT_INVALID');
 if(next.shiftId===prior.shiftId||next.projectId===prior.projectId&&next.workerId===prior.workerId&&(next.sequence!==prior.lastRealSequence+1||next.previousEventId!==prior.lastRealEventId))fail('ATTENDANCE_CHECKPOINT_LOCAL_PREDECESSOR_INVALID');
 return true;
}
export function prepareHumanClosureCheckpoint({prior,next,global}){
 if(!projections.has(prior)||prior.effective.state!=='HUMAN_CORRECTED_CLOSED')fail('ATTENDANCE_CHECKPOINT_UNVERIFIED_CLOSURE');validateNext(next);
 // Preserve prior's existing checkpoint rejection before the broader guard.
 // Every other closure is still checked below; no earlier approval is inferred.
 if(Date.parse(next.recordedAt)<Date.parse(prior.effective.endedAt)||Date.parse(next.recordedAt)<Date.parse(prior.correction.approvedAt))fail('ATTENDANCE_CHECKPOINT_INVALID');
 correctionExact(global,['complete','journeys']);if(global.complete!==true||!Array.isArray(global.journeys)||!global.journeys.length||global.journeys.length>10000)fail('ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE');
 const locals=new Set();let found=false,targetLocal=null;const commitments=[];
 for(const journey of global.journeys){
  if(!projections.has(journey)||journey.organizationId!==prior.organizationId||!correctionIdentitySame(journey.beneficiary,prior.beneficiary))fail('ATTENDANCE_GLOBAL_SOURCE_INVALID');
  assertUnusedNextEventId(next,journey);
  const key=journey.projectId+':'+journey.workerId;if(locals.has(key))fail('ATTENDANCE_GLOBAL_SOURCE_INVALID');locals.add(key);
  if(journey.effective.state==='RECORDED_OPEN')fail('ATTENDANCE_PERSON_JOURNEY_OPEN');
  if(Date.parse(journey.effective.endedAt)>Date.parse(next.recordedAt)||journey.correction&&Date.parse(journey.correction.approvedAt)>Date.parse(next.recordedAt))fail('ATTENDANCE_PERSON_CHRONOLOGY_CLOCK');
  if(journey.projectId===prior.projectId&&journey.workerId===prior.workerId&&journey.shiftId===prior.shiftId&&journey.temporalDigest===prior.temporalDigest&&journey.correction?.decisionDigest===prior.correction.decisionDigest)found=true;
  if(journey.projectId===next.projectId&&journey.workerId===next.workerId)targetLocal=journey;
  commitments.push({projectId:journey.projectId,workerId:journey.workerId,shiftId:journey.shiftId,temporalDigest:journey.temporalDigest,state:journey.effective.state,endedAt:journey.effective.endedAt,correctionDecisionDigest:journey.correction?.decisionDigest||null});
 }
 if(!found)fail('ATTENDANCE_GLOBAL_CLOSURE_MISSING');
 if(targetLocal?(next.sequence!==targetLocal.lastRealSequence+1||next.previousEventId!==targetLocal.lastRealEventId||next.shiftId===targetLocal.shiftId):(next.sequence!==1||next.previousEventId!==null))fail('ATTENDANCE_CHECKPOINT_LOCAL_PREDECESSOR_INVALID');
 const value=checkpointValue(prior,next,correctionDigest(commitments.sort((a,b)=>(a.projectId+':'+a.workerId).localeCompare(b.projectId+':'+b.workerId)))),checkpoint=correctionCopy({...value,checkpointDigest:correctionDigest(value)});
 verifyHumanClosureCheckpoint(checkpoint,{prior,next});return checkpoint;
}
function summarize(rows,previousEvent,organizationId,beneficiary,precedingClosure){
 const first=rows[0],start=first.metadata.fieldOperations,predecessor=previousEvent?.metadata?.fieldOperations;
 if(start.eventType!=='CHECK_IN'||start.sequence<1||start.recordedBy!==beneficiary.actorId)fail();
 const checkpoint=start.previousClosureCheckpoint;
 if(checkpoint!==undefined)verifyHumanClosureCheckpoint(checkpoint,{prior:precedingClosure,next:nextIdentity(first,organizationId,beneficiary)});
 if(start.sequence===1){if(start.previousEventId!==null||previousEvent!==null)fail('ATTENDANCE_PREDECESSOR_INVALID');}
 else{
  if(!previousEvent||previousEvent.id!==start.previousEventId||previousEvent.projectId!==first.projectId||previousEvent.workerId!==first.workerId||predecessor?.version!==1||predecessor.sequence!==start.sequence-1||predecessor.recordedBy!==start.recordedBy)fail('ATTENDANCE_PREDECESSOR_INVALID');
  if(predecessor.eventType!=='CHECK_OUT'){
   if(!checkpoint||checkpoint.sourceProjectId!==first.projectId||checkpoint.sourceWorkerId!==first.workerId||checkpoint.sourceShiftId!==predecessor.shiftId||checkpoint.sourceLastEventId!==previousEvent.id||checkpoint.sourceLastSequence!==predecessor.sequence)fail('ATTENDANCE_PREDECESSOR_HUMAN_CLOSURE_REQUIRED');
  }
 }
 let lastAt=previousEvent?Date.parse(predecessor.recordedAt):null,last=null,lastRow=previousEvent,breakAt=null,breakMs=0;const seen=new Set();
 for(let index=0;index<rows.length;index++){
  const row=rows[index],e=row.metadata.fieldOperations;correctionUtc(e.recordedAt);
  if(!workspaceId(row.id)||seen.has(row.id)||row.projectId!==first.projectId||row.workerId!==first.workerId||e.version!==1||e.shiftId!==start.shiftId||e.recordedBy!==start.recordedBy||!Number.isSafeInteger(e.sequence)||e.sequence!==start.sequence+index||e.previousEventId!==(lastRow?.id||null))fail();seen.add(row.id);
  if(index>0&&Object.hasOwn(e,'previousClosureCheckpoint'))fail('ATTENDANCE_CHECKPOINT_INVALID');
  const at=Date.parse(e.recordedAt);if(lastAt!==null&&at<lastAt)fail('ATTENDANCE_CLOCK_DECREASED');
  // First CHECK_IN has its explicit predecessor branch above. No fake CHECK_OUT
  // is passed to the canonical transition helper to make an open mark fit.
  let transition;try{transition=index===0?{phase:'WORKING',closed:false}:fieldTransition(e.eventType,last);}catch{fail('ATTENDANCE_TRANSITION_INVALID');}
  if(e.phase!==transition.phase||transition.closed&&index!==rows.length-1)fail('ATTENDANCE_TRANSITION_INVALID');
  const locationEvent=['CHECK_IN','CHECK_OUT'].includes(e.eventType);
  if(locationEvent?!['VERIFIED','REVIEW_REQUIRED'].includes(e.verificationStatus):e.verificationStatus!=='NOT_REQUIRED')fail('ATTENDANCE_VERIFICATION_INVALID');
  if(e.eventType==='BREAK_START')breakAt=at;if(e.eventType==='BREAK_END'){breakMs+=at-breakAt;breakAt=null;}
  last=e;lastRow=row;lastAt=at;
 }
 const complete=last.eventType==='CHECK_OUT',elapsedMs=lastAt-Date.parse(start.recordedAt),netMs=elapsedMs-breakMs;
 if(![elapsedMs,breakMs,netMs].every(value=>Number.isSafeInteger(value)&&value>=0))fail('ATTENDANCE_DURATION_INVALID');
 return {status:complete?'CLOSED':last.phase==='ON_BREAK'?'ON_BREAK':'OPEN',complete,projectId:first.projectId,workerId:first.workerId,shiftId:start.shiftId,closingEventId:complete?lastRow.id:null,recordedBy:start.recordedBy,startedAt:start.recordedAt,endedAt:complete?last.recordedAt:null,lastRecordedAt:last.recordedAt,elapsedMs,breakMs,netMs,sourceEventIds:rows.map(row=>row.id),sourceDigest:correctionDigest([previousEvent?{...fact(previousEvent),review:previousEvent.metadata.fieldOperations.review}:null,...rows.map(row=>({...fact(row),review:row.metadata.fieldOperations.review}))]),evidenceStatus:evidenceStatus(rows),issues:[],timeSource:'DATABASE_FIELD_RECORDED_AT',durationDefinition:'RECORDED_INTERVALS_EXCLUDING_REGISTERED_BREAKS'};
}
export function readAuditedAttendanceShift(input){
 const {organizationId,projectId,workerId,shiftId,beneficiary,events,previousEvent=null,recordingAudits,reviewAudits,auditSetComplete,observedAt,precedingClosure=null}=input;
 for(const value of [organizationId,projectId,workerId,shiftId,beneficiary?.actorId])id(value);
 if(typeof beneficiary.clerkUserId!=='string'||!/^user_[A-Za-z0-9]+$/.test(beneficiary.clerkUserId)||!hash(beneficiary.accessDigest))fail();correctionUtc(observedAt);
 if(auditSetComplete!==true||!Array.isArray(events)||!events.length||events.length>10000||!Array.isArray(recordingAudits)||!Array.isArray(reviewAudits))fail('ATTENDANCE_AUDIT_SOURCE_INCOMPLETE');
 const rows=structuredClone(events).sort((a,b)=>a.metadata?.fieldOperations?.sequence-b.metadata?.fieldOperations?.sequence),previous=structuredClone(previousEvent),all=previous?[previous,...rows]:rows,recorded=[],reviews=[],auditIds=new Set();
 if(recordingAudits.length!==all.length)fail('ATTENDANCE_RECORDING_AUDIT_CARDINALITY');
 for(const row of all){
  const e=row.metadata?.fieldOperations;if(e?.version!==1||row.projectId!==projectId||row.workerId!==workerId||e.recordedBy!==beneficiary.actorId||row!==previous&&e.shiftId!==shiftId)fail();correctionUtc(e.recordedAt);if(Date.parse(e.recordedAt)>Date.parse(observedAt))fail();validateReview(row,observedAt);
  const original=recordingAudits.filter(a=>a.metadata?.outcome?.event?.id===row.id),review=reviewAudits.filter(a=>a.metadata?.outcome?.event?.id===row.id);
  if(original.length!==1)fail('ATTENDANCE_RECORDING_AUDIT_CARDINALITY');
  const audit=assertAudit(original[0],row,organizationId,'ATTENDANCE');if(auditIds.has(audit.id))fail('ATTENDANCE_AUDIT_DUPLICATE');auditIds.add(audit.id);recorded.push(audit);
  if(review.length!==(e.review===null?0:1))fail('ATTENDANCE_REVIEW_AUDIT_CARDINALITY');
  let reviewAudit=null;if(review.length){reviewAudit=assertAudit(review[0],row,organizationId,'REVIEW_ATTENDANCE');if(auditIds.has(reviewAudit.id))fail('ATTENDANCE_AUDIT_DUPLICATE');auditIds.add(reviewAudit.id);}
  reviews.push({eventId:row.id,review:structuredClone(e.review),audit:reviewAudit});
 }
 if(reviewAudits.length!==reviews.filter(item=>item.audit!==null).length)fail('ATTENDANCE_REVIEW_AUDIT_CARDINALITY');
 const summary=summarize(rows,previous,organizationId,beneficiary,precedingClosure),head=rows.at(-1),lastWork=rows.filter(row=>['CHECK_IN','BREAK_END'].includes(row.metadata.fieldOperations.eventType)).at(-1);
 if(summary.shiftId!==shiftId)fail('ATTENDANCE_SHIFT_MISMATCH');
 const temporal={version:1,organizationId,projectId,workerId,shiftId,beneficiary:{actorId:beneficiary.actorId,clerkUserId:beneficiary.clerkUserId},facts:all.map(fact),recordingAudits:recorded};
 const temporalDigest=correctionDigest(temporal),reviewSnapshotDigest=correctionDigest(reviews);
 const sourceValue={version:1,organizationId,projectId,workerId,shiftId,beneficiary:structuredClone(beneficiary),anchorEventId:rows[0].id,headEventId:head.id,headSequence:head.metadata.fieldOperations.sequence,lastWorkingAt:lastWork.metadata.fieldOperations.recordedAt,recordedSummary:{...summary,chronology:{version:2,temporalDigest,reviewSnapshotDigest}}};
 const source129=summary.status==='ON_BREAK'?null:correctionCopy({...sourceValue,sourceDigest:correctionDigest({...sourceValue,beneficiary:temporal.beneficiary})});if(source129)validateAttendanceClosureSource(source129);
 const snapshot=correctionCopy({version:2,organizationId,projectId,workerId,shiftId,beneficiary:structuredClone(beneficiary),observedAt,temporal,temporalDigest,reviews,reviewSnapshotDigest,summary,source129});snapshots.add(snapshot);return snapshot;
}
function assertSnapshot(snapshot){
 if(!snapshots.has(snapshot))fail('ATTENDANCE_SNAPSHOT_UNVERIFIED');return snapshot;
}
function validateHistoricalSnapshot(snapshot){
 if(snapshot?.version!==2||!hash(snapshot.temporalDigest)||correctionDigest(snapshot.temporal)!==snapshot.temporalDigest||!hash(snapshot.reviewSnapshotDigest)||correctionDigest(snapshot.reviews)!==snapshot.reviewSnapshotDigest)fail('ATTENDANCE_HISTORICAL_SNAPSHOT_INVALID');
 validateAttendanceClosureSource(snapshot.source129);
 const linked=snapshot.source129.recordedSummary?.chronology;
 if(linked?.version!==2||linked.temporalDigest!==snapshot.temporalDigest||linked.reviewSnapshotDigest!==snapshot.reviewSnapshotDigest||snapshot.source129.organizationId!==snapshot.organizationId||snapshot.source129.projectId!==snapshot.projectId||snapshot.source129.workerId!==snapshot.workerId||snapshot.source129.shiftId!==snapshot.shiftId)fail('ATTENDANCE_HISTORICAL_SNAPSHOT_INVALID');
}
export function proposeAuditedAttendanceClosure(command,{context,snapshot,now,otherJourneys}){
 assertSnapshot(snapshot);if(!snapshot.source129)fail('ATTENDANCE_CORRECTION_OPEN_BREAK_UNSUPPORTED');const proposal=proposeAttendanceClosure(command,{context,source:snapshot.source129,now,otherJourneys});
 const value={version:2,proposal,sourceSnapshot:snapshot,temporalDigest:snapshot.temporalDigest};return correctionCopy({...value,envelopeDigest:correctionDigest(value)});
}
function validateProposalEnvelope(envelope){
 correctionExact(envelope,['version','proposal','sourceSnapshot','temporalDigest','envelopeDigest']);const {envelopeDigest,...value}=envelope;
 if(envelope.version!==2||!hash(envelopeDigest)||correctionDigest(value)!==envelopeDigest)fail('ATTENDANCE_PROPOSAL_ENVELOPE_INVALID');validateAttendanceClosureProposal(envelope.proposal);validateHistoricalSnapshot(envelope.sourceSnapshot);
 if(envelope.temporalDigest!==envelope.sourceSnapshot.temporalDigest||envelope.proposal.sourceDigest!==envelope.sourceSnapshot.source129.sourceDigest)fail('ATTENDANCE_PROPOSAL_ENVELOPE_INVALID');return envelope;
}
export function decideAuditedAttendanceClosure(command,{context,snapshot,proposalEnvelope,proposer,now,otherJourneys}){
 assertSnapshot(snapshot);validateProposalEnvelope(proposalEnvelope);
 if(!snapshot.source129)fail('ATTENDANCE_TEMPORAL_SOURCE_CHANGED');
 if(snapshot.temporalDigest!==proposalEnvelope.temporalDigest)fail('ATTENDANCE_TEMPORAL_SOURCE_CHANGED');
 const decision=decideAttendanceClosure(command,{context,source:snapshot.source129,proposal:proposalEnvelope.proposal,proposer,now,otherJourneys});
 const value={version:2,decision,proposalEnvelopeDigest:proposalEnvelope.envelopeDigest,temporalDigest:snapshot.temporalDigest};return correctionCopy({...value,envelopeDigest:correctionDigest(value)});
}
function validateDecisionEnvelope(envelope,proposalEnvelope){
 correctionExact(envelope,['version','decision','proposalEnvelopeDigest','temporalDigest','envelopeDigest']);const {envelopeDigest,...value}=envelope;
 if(envelope.version!==2||!hash(envelopeDigest)||correctionDigest(value)!==envelopeDigest||envelope.proposalEnvelopeDigest!==proposalEnvelope.envelopeDigest||envelope.temporalDigest!==proposalEnvelope.temporalDigest)fail('ATTENDANCE_DECISION_ENVELOPE_INVALID');validateAttendanceClosureDecision(envelope.decision,proposalEnvelope.proposal);return envelope;
}
export function auditedAttendanceClosureDescriptors(proposalEnvelope,decisionEnvelope=null){
 validateProposalEnvelope(proposalEnvelope);if(decisionEnvelope)validateDecisionEnvelope(decisionEnvelope,proposalEnvelope);
 const descriptors=structuredClone(attendanceClosureAuditDescriptors(proposalEnvelope.proposal,decisionEnvelope?.decision||null));
 descriptors.proposalReceipt.metadata.outcome={kind:'ATTENDANCE_CHRONOLOGY_CLOSURE_PROPOSAL',proposalEnvelope};
 if(decisionEnvelope)descriptors.decisionReceipt.metadata.outcome={kind:'ATTENDANCE_CHRONOLOGY_CLOSURE_DECISION',decisionEnvelope};
 if(descriptors.correctionFact)Object.assign(descriptors.correctionFact.metadata,{workerId:proposalEnvelope.proposal.workerId,shiftId:proposalEnvelope.proposal.shiftId,temporalDigest:proposalEnvelope.temporalDigest,proposalEnvelopeDigest:proposalEnvelope.envelopeDigest,decisionEnvelopeDigest:decisionEnvelope.envelopeDigest});
 return correctionCopy(descriptors);
}
function assertReviewEvolution(original,current,approvedAt){
 if(original.reviews.length!==current.reviews.length)fail('ATTENDANCE_REVIEW_HISTORY_INVALID');
 for(const before of original.reviews){const after=current.reviews.find(row=>row.eventId===before.eventId);if(!after)fail('ATTENDANCE_REVIEW_HISTORY_INVALID');
  if(before.review!==null){if(!correctionSame(before,after))fail('ATTENDANCE_EXISTING_REVIEW_REPLACED');}
  else if(after.review!==null&&Date.parse(after.review.recordedAt)<Date.parse(approvedAt))fail('ATTENDANCE_REVIEW_NOT_POST_APPROVAL');
 }
}
export function projectAuditedAttendanceChronology({snapshot,corrections=[]}){
 assertSnapshot(snapshot);if(!Array.isArray(corrections)||corrections.length>1000)fail('ATTENDANCE_CORRECTION_SET_INVALID');
 const summary=snapshot.summary,last=snapshot.temporal.facts.at(-1),value={version:2,organizationId:snapshot.organizationId,projectId:snapshot.projectId,workerId:snapshot.workerId,shiftId:snapshot.shiftId,beneficiary:{actorId:snapshot.beneficiary.actorId,clerkUserId:snapshot.beneficiary.clerkUserId},temporalDigest:snapshot.temporalDigest,currentSourceDigest:snapshot.source129?.sourceDigest||correctionDigest([snapshot.temporalDigest,snapshot.reviewSnapshotDigest,summary]),lastRealEventId:last.id,lastRealSequence:last.event.sequence,rawState:summary.status,observed:summary,evidence:{status:summary.evidenceStatus,reviewSnapshotDigest:snapshot.reviewSnapshotDigest},effective:{state:summary.complete?'RECORDED_CLOSED':'RECORDED_OPEN',endedAt:summary.endedAt,netMs:summary.complete?summary.netMs:null,physicalPresenceConfirmed:false},correction:null,pending:0,rejected:0,paymentCalculated:false,paymentEnabled:false};
 const ids=new Set();let approved=null;
 for(const item of corrections){
  correctionExact(item,['proposalEnvelope','decisionEnvelope','audits']);const {proposalEnvelope,decisionEnvelope,audits}=item;validateProposalEnvelope(proposalEnvelope);
  if(ids.has(proposalEnvelope.proposal.id))fail('ATTENDANCE_CORRECTION_DUPLICATE');ids.add(proposalEnvelope.proposal.id);
  if(!correctionSame(auditedAttendanceClosureDescriptors(proposalEnvelope,decisionEnvelope),audits))fail('ATTENDANCE_CORRECTION_RECEIPT_INTEGRITY');
  if(proposalEnvelope.temporalDigest!==snapshot.temporalDigest){
   // A later genuine mark supersedes an undecided/rejected closure proposal.
   // Keep the sealed receipt; it cannot block or approve the newer chronology.
   // An approved amendment may never be silently dropped this way.
   if(decisionEnvelope?.decision?.decision==='APPROVE')fail('ATTENDANCE_TEMPORAL_SOURCE_CHANGED');
   value.superseded=(value.superseded||0)+1;continue;
  }
  if(!decisionEnvelope){value.pending++;continue;}validateDecisionEnvelope(decisionEnvelope,proposalEnvelope);const d=decisionEnvelope.decision;
  if(d.decision==='REJECT'){value.rejected++;continue;}if(approved)fail('ATTENDANCE_CORRECTION_AMBIGUOUS_APPROVAL');
  assertReviewEvolution(proposalEnvelope.sourceSnapshot,snapshot,d.decidedAt);
  const net=Date.parse(d.effectiveEndAt)-Date.parse(summary.startedAt)-summary.breakMs;
  if(net!==d.effectiveNetMs||net<0||Date.parse(d.effectiveEndAt)>Date.parse(d.decidedAt)||summary.complete&&Date.parse(d.effectiveEndAt)>Date.parse(summary.endedAt))fail('ATTENDANCE_CORRECTION_TIME_OUT_OF_BOUNDS');
  approved={d,factId:audits.correctionFact.id};
 }
 if(approved){const {d,factId}=approved;value.effective={state:'HUMAN_CORRECTED_CLOSED',endedAt:d.effectiveEndAt,netMs:d.effectiveNetMs,physicalPresenceConfirmed:false};value.correction={factId,decisionReceiptId:d.decisionReceiptId,decisionDigest:d.decisionDigest,approvedAt:d.decidedAt,reviewedBy:d.decidedBy.actorId,reason:d.reason};}
 const result=correctionCopy(value);projections.add(result);return result;
}

// Only projections built and audited in this module can supply effective time.
// Keep the original observed summary, event identity and correction basis visible.
export function verifiedEffectiveAttendanceSummary(projection){
 if(!projections.has(projection))fail('ATTENDANCE_PROJECTION_UNVERIFIED');
 const observed=projection.observed,closed=projection.effective.state!=='RECORDED_OPEN',human=projection.effective.state==='HUMAN_CORRECTED_CLOSED';
 return {...observed,status:closed?'CLOSED':observed.status,complete:closed,endedAt:projection.effective.endedAt,elapsedMs:closed?Date.parse(projection.effective.endedAt)-Date.parse(observed.startedAt):observed.elapsedMs,netMs:closed?projection.effective.netMs:observed.netMs,closingEventId:closed?projection.lastRealEventId:null,sourceDigest:correctionDigest([projection.temporalDigest,projection.currentSourceDigest,projection.effective,projection.correction?.decisionDigest||null]),closureBasis:human?'HUMAN_APPROVED':closed?'RECORDED_CHECK_OUT':null,observed,correction:projection.correction};
}
export function verifiedAttendanceTransition(action,last,projection){
 if(projection!==null&&!projections.has(projection))fail('ATTENDANCE_PROJECTION_UNVERIFIED');
 if(projection?.effective.state==='HUMAN_CORRECTED_CLOSED'){
  if(action!=='CHECK_IN')throw new WorkspaceError('ATTENDANCE_SHIFT_NOT_OPEN',409);
  if(!last||last.sequence!==projection.lastRealSequence||last.shiftId!==projection.shiftId)fail('ATTENDANCE_REVISION_CHANGED');
  return {phase:'WORKING',closed:false};
 }
 return fieldTransition(action,last);
}
