import {WorkspaceError,workspaceId,calendarDate,digest} from './workspace-policy.mjs';
import {validOvertimeTimeZone} from './field-overtime-policy.mjs';
import {readEffectivePersonAttendance,effectiveJourney,effectiveHoursFact} from './attendance-effective-store.mjs';
import {summarizeFieldShift} from './field-shift-summary.mjs';

// Read projection of AttendanceEntry, never another attendance ledger. One
// canonical read-only transaction reads the whole bounded source, not UI pages.
export const FIELD_HOURS_LIMITS=Object.freeze({ledgerEvents:10000,shifts:200,days:31,csvBytes:3*1024*1024});
const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const eventFacts=row=>{const {overtime:ignored,...event}=row.metadata.fieldOperations;void ignored;return {...event,id:row.id,workerId:row.workerId};};
export function fieldHoursPeriod(input){
 const keys=['fromDate','untilDate','timeZone'];
 if(!input||Object.keys(input).sort().join('|')!==keys.sort().join('|')||!calendarDate(input.fromDate)||!calendarDate(input.untilDate)||input.fromDate>=input.untilDate||!validOvertimeTimeZone(input.timeZone))throw new WorkspaceError('FIELD_HOURS_PERIOD_INVALID',422);
 const days=(Date.parse(input.untilDate+'T00:00:00.000Z')-Date.parse(input.fromDate+'T00:00:00.000Z'))/86400000;
 if(days>FIELD_HOURS_LIMITS.days)throw new WorkspaceError('FIELD_HOURS_PERIOD_TOO_LONG',422);
 return {...input,selection:'SHIFT_CHECK_IN_RECORDED_AT_LOCAL_DATE',untilExclusive:true,allocation:'WHOLE_SHIFT_NOT_SPLIT_AT_PERIOD_BOUNDARIES'};
}
const dateInZone=(instant,formatter)=>{const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
const safeSum=(rows,key)=>{let sum=0;for(const row of rows){sum+=row[key];if(!Number.isSafeInteger(sum))throw new WorkspaceError('FIELD_HOURS_DURATION_UNSAFE',409);}return sum;};
function originalEvent(row){const event=eventFacts(row);delete event.review;return event;}
function matchingAudit(audit,row,projectId,command){
 const m=audit.metadata,e=row.metadata.fieldOperations,o=m?.outcome;
 if(!/^field_[a-f0-9]{64}$/.test(audit.id||'')||audit.entityType!=='Project'||audit.entityId!==projectId||m?.version!==1||m.projectId!==projectId||m.command!==command||!/^[a-f0-9]{64}$/.test(m.requestDigest||'')||o?.kind!==(command==='ATTENDANCE'?'ATTENDANCE':'ATTENDANCE_REVIEW'))return false;
 const expected=eventFacts(row),observed=o.event;if(!observed||observed.id!==row.id||observed.workerId!==row.workerId)return false;
 const {overtime:ignored,...withoutOvertime}=observed;void ignored;
 if(command==='ATTENDANCE'){
  if(observed.review!==null||audit.actorId!==e.recordedBy)return false;
  delete withoutOvertime.review;return digest(stable(withoutOvertime))===digest(stable(originalEvent(row)));
 }
 return e.review&&audit.actorId===e.review.actorId&&audit.actorId!==e.recordedBy&&digest(stable(withoutOvertime))===digest(stable(expected));
}
function incomplete(base,code,details={}){
 return {...base,state:'INCOMPLETE',complete:false,exportable:false,reportDigest:null,rows:[],totals:null,completeness:{ledgerComplete:false,selectionComplete:false,reason:code,...details}};
}
export async function readFieldHoursReport(client,{project,scope,period:rawPeriod}){
 const period=fieldHoursPeriod(rawPeriod),clock=(await client.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "generatedAt"`)).rows[0];
 const base={version:1,kind:'FIELD_HOURS_REPORT',projectId:project.id,scope,projectName:project.name,period,generatedAt:clock.generatedAt,timeSource:'DATABASE_FIELD_RECORDED_AT',durationDefinition:'RECORDED_INTERVALS_EXCLUDING_REGISTERED_BREAKS',salaryCalculated:false,paymentEnabled:false};
 const source=(await client.query(`SELECT id,"projectId","workerId",metadata FROM public."AttendanceEntry" WHERE "projectId"=$1 ORDER BY id LIMIT $2`,[project.id,FIELD_HOURS_LIMITS.ledgerEvents+1])).rows;
 if(source.length>FIELD_HOURS_LIMITS.ledgerEvents)return incomplete(base,'PROJECT_LEDGER_LIMIT',{limit:FIELD_HOURS_LIMITS.ledgerEvents});
 const unsupported=source.filter(row=>row.metadata?.fieldOperations?.version!==1);
 if(unsupported.length)return incomplete(base,'UNSUPPORTED_LEDGER_RECORDS',{unsupportedCount:unsupported.length});
 const groups=new Map(),byId=new Map();
 for(const row of source){
  const e=row.metadata.fieldOperations;
  if(row.projectId!==project.id||!workspaceId(row.id)||!workspaceId(row.workerId)||!workspaceId(e.shiftId)||!utc(e.recordedAt)||byId.has(row.id))return incomplete(base,'UNLOCATABLE_LEDGER_RECORD');
  byId.set(row.id,row);const key=JSON.stringify([row.workerId,e.shiftId]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
 }
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:period.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}),selected=[];
 for(const rows of groups.values()){
  const starts=rows.filter(row=>row.metadata.fieldOperations.eventType==='CHECK_IN');
  // An orphan cannot be assigned to a period; never silently omit it.
  if(starts.length!==1)return incomplete(base,'SHIFT_ANCHOR_INTEGRITY_REQUIRED');
  const localDate=dateInZone(starts[0].metadata.fieldOperations.recordedAt,formatter);
  if(localDate>=period.fromDate&&localDate<period.untilDate)selected.push({rows,start:starts[0],localDate});
 }
 if(selected.length>FIELD_HOURS_LIMITS.shifts)return incomplete(base,'PERIOD_SHIFT_LIMIT',{limit:FIELD_HOURS_LIMITS.shifts,selectedAtLeast:selected.length});
 selected.sort((a,b)=>a.start.metadata.fieldOperations.recordedAt.localeCompare(b.start.metadata.fieldOperations.recordedAt)||a.start.id.localeCompare(b.start.id));
 const eventIds=selected.flatMap(group=>group.rows.map(row=>row.id)),workerIds=[...new Set(selected.map(group=>group.start.workerId))];
 const workers=workerIds.length?(await client.query(`SELECT id,name,active FROM public."Worker" WHERE "projectId"=$1 AND id=ANY($2::text[]) ORDER BY id`,[project.id,workerIds])).rows:[],workerMap=new Map(workers.map(worker=>[worker.id,worker]));
 const audits=eventIds.length?(await client.query(`SELECT id,"actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=(SELECT "organizationId" FROM public."Project" WHERE id=$1) AND "entityType"='Project' AND "entityId"=$1 AND action='field.operation.recorded' AND metadata->>'command' IN ('ATTENDANCE','REVIEW_ATTENDANCE') AND metadata->'outcome'->'event'->>'id'=ANY($2::text[]) ORDER BY id LIMIT $3`,[project.id,eventIds,eventIds.length*2+1])).rows:[];
 if(audits.length>eventIds.length*2)return incomplete(base,'SOURCE_AUDIT_CARDINALITY_REQUIRED');
 const auditsByEvent=new Map();for(const audit of audits){const id=audit.metadata?.outcome?.event?.id;if(!auditsByEvent.has(id))auditsByEvent.set(id,[]);auditsByEvent.get(id).push(audit);}
 const workerSet=[...new Set(selected.map(group=>group.start.workerId))],shiftSet=[...new Set(selected.map(group=>group.start.metadata.fieldOperations.shiftId))];
 const correctionRows=selected.length?(await client.query(`SELECT i.id,i.metadata FROM public."Incident" i WHERE i."projectId"=$1 AND i.metadata ? 'attendanceCorrection' AND i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->>'workerId'=ANY($2::text[]) AND i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->>'shiftId'=ANY($3::text[]) LIMIT 1001`,[project.id,workerSet,shiftSet])).rows:[];
 const factRows=selected.length?(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Project' AND "entityId"=$2 AND action='field.attendance.corrected' AND (metadata->>'workerId'=ANY($3::text[]) AND metadata->>'shiftId'=ANY($4::text[]) OR jsonb_typeof(metadata->'workerId') IS DISTINCT FROM 'string' OR jsonb_typeof(metadata->'shiftId') IS DISTINCT FROM 'string' OR metadata->>'workerId' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$' OR metadata->>'shiftId' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$') LIMIT 1001`,[project.organizationId,project.id,workerSet,shiftSet])).rows:[];
 const ambiguous=correctionRows.length>1000||factRows.length>1000||factRows.some(row=>!workspaceId(row.metadata?.workerId)||!workspaceId(row.metadata?.shiftId)),needed=new Set();
 const keyOf=(workerId,shiftId)=>JSON.stringify([workerId,shiftId]);
 for(const row of correctionRows){const p=row.metadata?.attendanceCorrection?.proposalEnvelope?.proposal;if(p)needed.add(keyOf(p.workerId,p.shiftId));}
 for(const row of factRows)needed.add(keyOf(row.metadata?.workerId,row.metadata?.shiftId));
 const ledgers=new Map();
 for(const group of selected){const e=group.start.metadata.fieldOperations,key=keyOf(group.start.workerId,e.shiftId);if(!ambiguous&&!needed.has(key)&&!Object.hasOwn(e,'previousClosureCheckpoint'))continue;
  if(ambiguous){ledgers.set(key,{error:'UNLOCATABLE_CORRECTION_SOURCE'});continue;}
  try{ledgers.set(key,{ledger:await readEffectivePersonAttendance(client,{organizationId:project.organizationId,actorId:e.recordedBy,observedAt:clock.generatedAt,journeyKeys:[{projectId:project.id,workerId:group.start.workerId,shiftId:e.shiftId}]})});}
  catch(error){if(error instanceof WorkspaceError&&[403,404,409].includes(error.status))ledgers.set(key,{error:error.code});else throw error;}
 }
 const unconfirmed=code=>({state:'UNCONFIRMED',closed:false,endedAt:null,netMs:null,basis:null,sourceDigest:null,decisionReceiptId:null,reviewedBy:null,approvedAt:null,physicalPresenceConfirmed:false,paymentEnabled:false,code});
 const rows=selected.map(group=>{
  const e=group.start.metadata.fieldOperations,previousEvent=byId.get(e.previousEventId)||null;
  const audited=ledgers.get(keyOf(group.start.workerId,e.shiftId));let journey=null,sourceError=audited?.error||null;
  if(audited?.ledger){try{const candidate=effectiveJourney(audited.ledger,project.id,group.start.workerId,e.shiftId),actual=candidate.snapshot.temporal.facts.filter(row=>row.event.shiftId===e.shiftId).map(row=>row.id).sort(),expected=group.rows.map(row=>row.id).sort();if(actual.length!==expected.length||actual.some((id,i)=>id!==expected[i]))sourceError='ATTENDANCE_SOURCE_SET_MISMATCH';else journey=candidate;}catch(error){if(error instanceof WorkspaceError&&[404,409].includes(error.status))sourceError=error.code;else throw error;}}
  const raw=summarizeFieldShift({events:group.rows,previousEvent,projectId:project.id,workerId:group.start.workerId,shiftId:e.shiftId}),summary=journey&&Object.hasOwn(e,'previousClosureCheckpoint')?journey.snapshot.summary:raw;
  const events=group.rows.sort((a,b)=>a.metadata.fieldOperations.sequence-b.metadata.fieldOperations.sequence||a.id.localeCompare(b.id)).map(row=>{
   const current=row.metadata.fieldOperations,candidates=auditsByEvent.get(row.id)||[],recorded=candidates.filter(audit=>matchingAudit(audit,row,project.id,'ATTENDANCE')),reviewed=current.review?candidates.filter(audit=>matchingAudit(audit,row,project.id,'REVIEW_ATTENDANCE')):[];
   return {id:row.id,eventType:['CHECK_IN','CHECK_OUT','BREAK_START','BREAK_END'].includes(current.eventType)?current.eventType:'UNRECOGNIZED',recordedAt:current.recordedAt,verificationStatus:['VERIFIED','REVIEW_REQUIRED','NOT_REQUIRED'].includes(current.verificationStatus)?current.verificationStatus:'UNRECOGNIZED',review:current.review?{decision:['APPROVE','REJECT'].includes(current.review.decision)?current.review.decision:'UNRECOGNIZED',actorId:workspaceId(current.review.actorId)?current.review.actorId:null,recordedAt:utc(current.review.recordedAt)?current.review.recordedAt:null}:null,recordingReceiptId:recorded.length===1?recorded[0].id:null,reviewReceiptId:reviewed.length===1?reviewed[0].id:null,auditConfirmed:recorded.length===1&&(!current.review||reviewed.length===1)};
  });
  const worker=workerMap.get(group.start.workerId),auditConfirmed=events.every(event=>event.auditConfirmed),integrity=summary.status!=='INTEGRITY_REVIEW_REQUIRED';
  const effective=sourceError?unconfirmed(sourceError):journey&&integrity?effectiveHoursFact(journey.projection):!integrity?unconfirmed('CHAIN_INTEGRITY_REQUIRED'):!auditConfirmed?unconfirmed('SOURCE_AUDIT_UNCONFIRMED'):{state:summary.complete?'RECORDED_CLOSED':'RECORDED_OPEN',closed:summary.complete,endedAt:summary.endedAt,netMs:summary.complete?summary.netMs:null,basis:summary.complete?'RECORDED_CHECK_OUT':null,sourceDigest:digest([summary.sourceDigest,events.map(row=>[row.recordingReceiptId,row.reviewReceiptId])]),decisionReceiptId:null,reviewedBy:null,approvedAt:null,physicalPresenceConfirmed:false,paymentEnabled:false};
  return {effective,workerId:group.start.workerId,workerCurrentName:worker?.name||null,workerCurrentlyActive:worker?.active??null,recordedBy:summary.recordedBy||(workspaceId(e.recordedBy)?e.recordedBy:null),shiftId:e.shiftId,checkInEventId:group.start.id,localStartDate:group.localDate,startedAt:summary.startedAt||e.recordedAt,endedAt:summary.endedAt||null,lastRecordedAt:summary.lastRecordedAt||null,durationScope:summary.complete?'FULL_CLOSED_SHIFT':summary.status==='INTEGRITY_REVIEW_REQUIRED'?'UNCONFIRMED':'RECORDED_INTERVALS_ONLY_OPEN_SHIFT',status:summary.status,complete:summary.complete,evidenceStatus:summary.evidenceStatus,auditStatus:auditConfirmed?'CONFIRMED':'REVIEW_REQUIRED',elapsedMs:summary.elapsedMs,breakMs:summary.breakMs,netMs:summary.netMs,sourceDigest:summary.sourceDigest,sourceEventIds:group.rows.map(row=>row.id),previousEventId:previousEvent?.id||null,issues:summary.issues,events,readyForOperationalReview:integrity&&summary.complete&&summary.evidenceStatus==='READY'&&auditConfirmed&&Boolean(worker)};
 });
 const closed=rows.filter(row=>row.complete&&row.status==='CLOSED'),ready=closed.filter(row=>row.readyForOperationalReview);
 const effectiveClosed=rows.filter(row=>row.effective.closed),effectiveReady=effectiveClosed.filter(row=>row.evidenceStatus==='READY'&&row.auditStatus==='CONFIRMED');
 const effectiveTotalsComplete=rows.every(row=>row.effective.state!=='UNCONFIRMED');
 const totals={effectiveTotalsComplete,effectiveUnconfirmedShifts:rows.filter(row=>row.effective.state==='UNCONFIRMED').length,humanCorrectedShifts:effectiveClosed.filter(row=>row.effective.basis==='HUMAN_APPROVED').length,closedEffectiveNetMs:effectiveTotalsComplete?safeSum(effectiveClosed.map(row=>({netMs:row.effective.netMs})),'netMs'):null,closedEffectiveEvidenceReadyNetMs:effectiveTotalsComplete?safeSum(effectiveReady.map(row=>({netMs:row.effective.netMs})),'netMs'):null,shifts:rows.length,closed:closed.length,open:rows.filter(row=>!row.effective.closed&&['OPEN','ON_BREAK'].includes(row.status)).length,integrityReview:rows.filter(row=>row.status==='INTEGRITY_REVIEW_REQUIRED').length,pendingAttendanceReview:rows.filter(row=>row.evidenceStatus==='PENDING_REVIEW').length,rejectedAttendance:rows.filter(row=>row.evidenceStatus==='REJECTED').length,auditReview:rows.filter(row=>row.auditStatus!=='CONFIRMED').length,closedElapsedMs:safeSum(closed,'elapsedMs'),closedBreakMs:safeSum(closed,'breakMs'),closedObservedNetMs:safeSum(closed,'netMs'),closedEvidenceReadyNetMs:safeSum(ready,'netMs')};
 const completeness={ledgerComplete:true,selectionComplete:true,pagination:'NOT_PAGINATED_SINGLE_READ_SNAPSHOT',ledgerEvents:source.length,periodShifts:rows.length,closedShiftsOnlyInTotals:true};
 const reportDigest=digest(stable([1,project.id,scope,period,rows,totals,completeness]));
 return {...base,state:'COMPLETE',complete:true,exportable:true,completeness,reportDigest,rows,totals};
}
const csvCell=value=>{
 let text=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);
 text=text.replace(/\u0000/g,'');if(/^[\s\u0001-\u001f]*[=+@-]/u.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
};
export function fieldHoursCsv(report,expectedDigest){
 if(report.complete!==true||report.exportable!==true||!report.completeness?.ledgerComplete||!report.completeness?.selectionComplete)throw new WorkspaceError('FIELD_HOURS_INCOMPLETE',409);
 if(!/^[a-f0-9]{64}$/.test(expectedDigest||'')||expectedDigest!==report.reportDigest)throw new WorkspaceError('FIELD_HOURS_SOURCE_CHANGED',409);
 const columns=['report_digest','generated_at_utc','selection','allocation','from_local_date','until_local_date_exclusive','time_zone','project_id','worker_id','worker_current_name','recorded_by_actor_id','shift_id','local_start_date','started_at_utc','ended_at_utc','observed_through_at_utc','duration_scope','shift_status','attendance_evidence_status','audit_status','ready_for_operational_review','elapsed_ms','registered_break_ms','observed_net_ms','source_digest','source_event_ids_json','predecessor_event_id','event_reviews_and_receipts_json','integrity_issues_json','effective_state','effective_end_at_utc','effective_net_ms','effective_basis','effective_source_digest','closure_decision_receipt_id','closure_reviewed_by','closure_approved_at_utc','salary_calculated','payment_enabled'];
 const lines=[columns.map(csvCell).join(',')];
 // Empty selections retain their period context, never a fictional zero shift.
 const values=report.rows.length?report.rows:[null];
 for(const row of values)lines.push([report.reportDigest,report.generatedAt,report.period.selection,report.period.allocation,report.period.fromDate,report.period.untilDate,report.period.timeZone,report.projectId,row?.workerId,row?.workerCurrentName,row?.recordedBy,row?.shiftId,row?.localStartDate,row?.startedAt,row?.endedAt,row?.lastRecordedAt,row?.durationScope,row?.status||'NO_SHIFTS_IN_SELECTION',row?.evidenceStatus,row?.auditStatus,row?.readyForOperationalReview??false,row?.elapsedMs,row?.breakMs,row?.netMs,row?.sourceDigest,row?.sourceEventIds||[],row?.previousEventId,row?.events||[],row?.issues||[],row?.effective?.state,row?.effective?.endedAt,row?.effective?.netMs,row?.effective?.basis,row?.effective?.sourceDigest,row?.effective?.decisionReceiptId,row?.effective?.reviewedBy,row?.effective?.approvedAt,false,false].map(csvCell).join(','));
 const csv='\uFEFF'+lines.join('\r\n')+'\r\n';if(Buffer.byteLength(csv,'utf8')>FIELD_HOURS_LIMITS.csvBytes)throw new WorkspaceError('FIELD_HOURS_EXPORT_TOO_LARGE',413);
 return {csv,filename:`jornadas-${report.period.fromDate}-${report.period.untilDate}-hasta-exclusivo.csv`,digest:report.reportDigest};
}
