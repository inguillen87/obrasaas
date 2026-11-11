import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {readAttendanceClosureLedger} from './attendance-closure-store.mjs';
import {verifiedEffectiveAttendanceSummary,prepareHumanClosureCheckpoint} from './attendance-chronology.mjs';

// Every consumer receives the same audited chronology from its canonical
// transaction. Neither UI event pages nor a caller's claimed close can replace it.
export async function readEffectivePersonAttendance(client,{organizationId,actorId,observedAt,journeyKeys=null}){
 const at=observedAt||(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
 return readAttendanceClosureLedger(client,{organizationId,actorId,observedAt:at,allowEmpty:true,journeyKeys});
}
export function latestEffectiveJourneys(ledger){
 if(ledger?.complete!==true||ledger.selectionOnly===true||!Array.isArray(ledger.journeys))throw new WorkspaceError('ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE',409);
 const heads=new Map();
 for(const journey of ledger.journeys){
  // This rejects cloned/fabricated projections, even if their digest matches.
  verifiedEffectiveAttendanceSummary(journey.projection);
  const p=journey.projection,key=JSON.stringify([p.projectId,p.workerId]),old=heads.get(key);
  if(old?.projection.lastRealSequence===p.lastRealSequence)throw new WorkspaceError('ATTENDANCE_GLOBAL_SOURCE_INVALID',409);
  if(!old||old.projection.lastRealSequence<p.lastRealSequence)heads.set(key,journey);
 }
 return [...heads.values()];
}
export function effectiveJourney(ledger,projectId,workerId,shiftId){
 const found=ledger.byKey.get(JSON.stringify([projectId,workerId,shiftId]));
 if(!found)throw new WorkspaceError('ATTENDANCE_CLOSURE_UNAVAILABLE',404);
 verifiedEffectiveAttendanceSummary(found.projection);return found;
}
export function assertEffectivePersonJourney(ledger,{projectId,workerId,eventType,at}){
 const heads=latestEffectiveJourneys(ledger),open=heads.filter(j=>j.projection.effective.state==='RECORDED_OPEN');
 if(open.some(j=>j.projection.projectId!==projectId||j.projection.workerId!==workerId)||open.length>1)throw new WorkspaceError('ATTENDANCE_PERSON_JOURNEY_OPEN',409);
 if(eventType==='CHECK_IN'&&open.length)throw new WorkspaceError('ATTENDANCE_SHIFT_ALREADY_OPEN',409);
 for(const {projection:p} of heads)if(p.effective.state!=='RECORDED_OPEN'&&(Date.parse(p.effective.endedAt)>Date.parse(at)||p.correction&&Date.parse(p.correction.approvedAt)>Date.parse(at)))throw new WorkspaceError('ATTENDANCE_PERSON_CHRONOLOGY_CLOCK',409);
 return heads;
}
export function nextClosureCheckpoint(ledger,next){
 const heads=latestEffectiveJourneys(ledger),local=heads.find(j=>j.projection.projectId===next.projectId&&j.projection.workerId===next.workerId),human=heads.filter(j=>j.projection.effective.state==='HUMAN_CORRECTED_CLOSED');
 // The local corrected predecessor takes priority. Other worksites remain part
// of the sealed complete person snapshot used to rule out overlap.
 const prior=local?.projection.effective.state==='HUMAN_CORRECTED_CLOSED'?local:human.sort((a,b)=>b.projection.correction.approvedAt.localeCompare(a.projection.correction.approvedAt)||b.projection.lastRealEventId.localeCompare(a.projection.lastRealEventId))[0];
 return prior?prepareHumanClosureCheckpoint({prior:prior.projection,next,global:{complete:true,journeys:heads.map(j=>j.projection)}}):null;
}
// Scope discovery contains no approval. A returned marker merely requires the
// caller to verify the exact selected chronology before displaying an override.
export async function readScopedAttendanceAnnotations(client,{organizationId,projectId,shifts}){
 const workers=[...new Set(shifts.map(row=>row.workerId))],ids=[...new Set(shifts.map(row=>row.shiftId))],keys=new Set();
 if(!shifts.length)return {keys,ambiguous:false};
 const corrections=(await client.query(`SELECT i.id,i.metadata FROM public."Incident" i WHERE i."projectId"=$1 AND i.metadata ? 'attendanceCorrection' AND i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->>'workerId'=ANY($2::text[]) AND i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->>'shiftId'=ANY($3::text[]) LIMIT 1001`,[projectId,workers,ids])).rows;
 const facts=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Project' AND "entityId"=$2 AND action='field.attendance.corrected' AND (metadata->>'workerId'=ANY($3::text[]) AND metadata->>'shiftId'=ANY($4::text[]) OR jsonb_typeof(metadata->'workerId') IS DISTINCT FROM 'string' OR jsonb_typeof(metadata->'shiftId') IS DISTINCT FROM 'string' OR metadata->>'workerId' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$' OR metadata->>'shiftId' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$') LIMIT 1001`,[organizationId,projectId,workers,ids])).rows;
 for(const row of corrections){const p=row.metadata?.attendanceCorrection?.proposalEnvelope?.proposal;if(p)keys.add(JSON.stringify([p.workerId,p.shiftId]));}
 for(const row of facts)keys.add(JSON.stringify([row.metadata?.workerId,row.metadata?.shiftId]));
 return {keys,ambiguous:corrections.length>1000||facts.length>1000||facts.some(row=>!workspaceId(row.metadata?.workerId)||!workspaceId(row.metadata?.shiftId))};
}
export function effectiveHead(row,ledger){
 const e=row.metadata.fieldOperations,j=effectiveJourney(ledger,row.projectId,row.workerId,e.shiftId),p=j.projection;
 if(p.lastRealEventId!==row.id||p.lastRealSequence!==e.sequence)throw new WorkspaceError('ATTENDANCE_REVISION_CHANGED',409);
 return {id:row.id,eventType:e.eventType,phase:e.phase,sequence:e.sequence,recordedAt:e.recordedAt,effectiveClosed:p.effective.state!=='RECORDED_OPEN',closureBasis:p.effective.state==='HUMAN_CORRECTED_CLOSED'?'HUMAN_APPROVED':p.effective.state==='RECORDED_CLOSED'?'RECORDED_CHECK_OUT':null,effectiveEndedAt:p.effective.endedAt,closureReceiptId:p.correction?.decisionReceiptId||null};
}
export function effectiveOverlap(ledger,selected){
 const p=selected.projection;if(p.effective.state==='RECORDED_OPEN')return false;
 return ledger.journeys.some(({projection:other})=>other!==p&&Date.parse(p.observed.startedAt)<(other.effective.endedAt?Date.parse(other.effective.endedAt):Infinity)&&Date.parse(other.observed.startedAt)<Date.parse(p.effective.endedAt));
}
export function effectiveHoursFact(projection){
 const summary=verifiedEffectiveAttendanceSummary(projection);
 return {state:projection.effective.state,closed:summary.complete,endedAt:summary.endedAt,netMs:summary.complete?summary.netMs:null,basis:summary.closureBasis,sourceDigest:summary.sourceDigest,decisionReceiptId:projection.correction?.decisionReceiptId||null,reviewedBy:projection.correction?.reviewedBy||null,approvedAt:projection.correction?.approvedAt||null,physicalPresenceConfirmed:false,paymentEnabled:false};
}
export const effectiveHoursDigest=facts=>digest(facts);
