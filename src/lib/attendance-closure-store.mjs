import {WorkspaceError,workspaceId,operationId,portfolioAccess} from './workspace-policy.mjs';
import {ATTENDANCE_CLOSURE_ACTIONS,normalizeAttendanceClosureCommand,correctionDigest,correctionSame,correctionExact} from './attendance-closure-policy.mjs';
import {readAuditedAttendanceShift,projectAuditedAttendanceChronology,proposeAuditedAttendanceClosure,decideAuditedAttendanceClosure,auditedAttendanceClosureDescriptors} from './attendance-chronology.mjs';
import {fieldReceiptId} from './field-operations-policy.mjs';
import {canDecideOvertime} from './field-overtime-policy.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {participantAccountBound,participantProjectAdmitted} from './participant-admission.mjs';

// Private integration candidate. No endpoint, DDL, permission grant, location,
// AttendanceEntry write or payment operation is introduced by this adapter.
const KIND='ATTENDANCE_CHRONOLOGY_CLOSURE';
const LIMIT=10000,PROPOSAL_LIMIT=1000;
const unavailable=()=>{throw new WorkspaceError('ATTENDANCE_CLOSURE_UNAVAILABLE',404);};
const invalid=(code='ATTENDANCE_CLOSURE_SOURCE_INVALID')=>{throw new WorkspaceError(code,409);};
const authority=member=>{if(member.channelProof)throw new WorkspaceError('ATTENDANCE_CORRECTION_WEB_ONLY',403);if(!canDecideOvertime(member.role))throw new WorkspaceError('ATTENDANCE_CORRECTION_PERMISSION_REQUIRED',403);};
const iso=value=>value instanceof Date?value.toISOString():value;
const rowKey=row=>JSON.stringify([row.projectId,row.workerId,row.metadata?.fieldOperations?.shiftId]);
const auditColumns='id,"organizationId","actorId",action,"entityType","entityId",metadata';
const eventColumns='a.id,a."projectId",a."workerId",a."checkedInAt",a.metadata';
const plainAudit=row=>Object.fromEntries(['id','organizationId','actorId','action','entityType','entityId','metadata'].map(key=>[key,row[key]]));
export const isAttendanceClosureAction=action=>ATTENDANCE_CLOSURE_ACTIONS.includes(action);

function wrapper(row){
 const w=row?.metadata?.attendanceCorrection;
 if(!w||w.kind!==KIND)unavailable();
 correctionExact(w,['version','kind','proposalEnvelope','decisionEnvelope','resolution']);
 const p=w.proposalEnvelope?.proposal,d=w.decisionEnvelope?.decision;
 if(w.version!==2||row.id!==p?.id||row.projectId!==p?.projectId||w.resolution!==(d?(d.decision==='APPROVE'?'APPROVED':'REJECTED'):'PENDING'))invalid('ATTENDANCE_CLOSURE_WRAPPER_INVALID');
 // This also validates both sealed envelopes without trusting mutable resolution.
 auditedAttendanceClosureDescriptors(w.proposalEnvelope,w.decisionEnvelope);
 return w;
}

async function actorAccess(client,organizationId,projectId,actorId,{lock=false,requireAdmitted=true}={}){
 const rows=(await client.query(`SELECT u.id AS "actorId",u."clerkUserId",m.id AS "membershipId",m.status::text AS "membershipStatus",m."tenantRole"::text AS role,m."clerkRole",to_char(m."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "membershipRevision" FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id AND m."organizationId"=$2 WHERE u.id=$1 ${lock?'FOR SHARE OF u,m':''}`,[actorId,organizationId])).rows;
 if(rows.length!==1||!workspaceId(rows[0].actorId)||!/^user_[A-Za-z0-9]+$/.test(rows[0].clerkUserId||''))invalid('ATTENDANCE_CLOSURE_IDENTITY_UNAVAILABLE');
 const member={...rows[0],organizationId};
 member.participantBound=await participantAccountBound(client,member);
 const assignments=(await client.query(`SELECT id,status::text AS status,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 ORDER BY id LIMIT 10001 ${lock?'FOR SHARE':''}`,[projectId,member.membershipId])).rows;
 const linked=(await client.query(`SELECT w.id,w.active,w.metadata,to_char(w."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" w WHERE w."projectId"=$1 AND w.metadata->'participant'->>'clerkUserId'=$2 ORDER BY w.id LIMIT 10001 ${lock?'FOR SHARE OF w':''}`,[projectId,member.clerkUserId])).rows;
 const receipts=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND action='participant.operation.recorded' AND (("entityType"='TenantMembership' AND "entityId"=$2) OR ("entityType"='Worker' AND "entityId"=ANY($3::text[]))) ORDER BY id LIMIT 10001`,[organizationId,member.membershipId,linked.map(row=>row.id)])).rows;
 if([assignments,linked,receipts].some(rows=>rows.length>LIMIT))invalid('ATTENDANCE_CLOSURE_ACCESS_SOURCE_INCOMPLETE');
 member.accessDigest=correctionDigest({actorId:member.actorId,clerkUserId:member.clerkUserId,membershipId:member.membershipId,status:member.membershipStatus,role:member.role,clerkRole:member.clerkRole,revision:member.membershipRevision,participantBound:member.participantBound,assignments,linked,receipts});
 if(requireAdmitted){
  if(member.membershipStatus!=='ACTIVE'||(!portfolioAccess(member.role)||member.participantBound)&&assignments.filter(row=>row.status==='ACTIVE').length!==1||!await participantProjectAdmitted(client,member,projectId,{lock}))throw new WorkspaceError('ATTENDANCE_CLOSURE_ACCESS_CHANGED',403);
 }
 return member;
}

async function beneficiary(client,organizationId,projectId,workerId,actorId,{lock=false,requireCurrent=false}={}){
 // Lookup the original PlatformUser directly. A current Worker reassignment
 // cannot rewrite the stable identity attributed to original recording audits.
 const person=await actorAccess(client,organizationId,projectId,actorId,{lock,requireAdmitted:requireCurrent});
 const rows=(await client.query(`SELECT id,"projectId",active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR SHARE':''}`,[workerId,projectId])).rows;
 if(rows.length!==1)unavailable();
 const row=rows[0],p=row.metadata?.participant;
 const accessDigest=correctionDigest([person.accessDigest,row.id,row.revision,row.active,row.metadata]);
 if(requireCurrent){
  if(!row.active||p?.version!==1||p.status!=='ACTIVE'||p.clerkUserId!==person.clerkUserId||p.permissions?.attendance!==true)throw new WorkspaceError('ATTENDANCE_CLOSURE_BENEFICIARY_ACCESS_CHANGED',409);
  // Pure flags are insufficient: this canonical reader checks review/submission
  // receipts, using the resolved identity, never a fabricated beneficiary session.
  await assertApprovedParticipantKyc(client,row,person,{code:'ATTENDANCE_CLOSURE_KYC_REQUIRED'});
 }
 return {actorId:person.actorId,clerkUserId:person.clerkUserId,accessDigest};
}

async function target(client,organizationId,projectId,command){
 if(command.action==='PROPOSE_ATTENDANCE_CLOSURE'){
  const rows=(await client.query(`SELECT a.id,a."projectId",a."workerId",a.metadata FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId" WHERE a.id=$1 AND a."projectId"=$2 AND p."organizationId"=$3`,[command.payload.anchorEventId,projectId,organizationId])).rows;
  const row=rows[0],e=row?.metadata?.fieldOperations;
  if(rows.length!==1||e?.version!==1||e.eventType!=='CHECK_IN'||row.workerId!==command.payload.workerId||e.shiftId!==command.payload.shiftId||!workspaceId(e.recordedBy))unavailable();
  return {workerId:row.workerId,shiftId:e.shiftId,actorId:e.recordedBy};
 }
 const rows=(await client.query(`SELECT i.id,i."projectId",i.metadata FROM public."Incident" i JOIN public."Project" p ON p.id=i."projectId" WHERE i.id=$1 AND i."projectId"=$2 AND p."organizationId"=$3`,[command.payload.proposalId,projectId,organizationId])).rows;
 if(rows.length!==1)unavailable();const p=wrapper(rows[0]).proposalEnvelope.proposal;
 if(p.organizationId!==organizationId)unavailable();return {workerId:p.workerId,shiftId:p.shiftId,actorId:p.beneficiary.actorId};
}

export async function readAttendanceClosureLedger(client,{organizationId,actorId,observedAt,allowEmpty=false,journeyKeys=null}){
 // All retained journeys, not a paginated UI subset. The +1 guard fails closed
 // before a completeness claim. Original source rows and audits stay unchanged.
 const selected=journeyKeys!==null;
 if(selected&&(!Array.isArray(journeyKeys)||!journeyKeys.length||journeyKeys.length>1000||journeyKeys.some(key=>!key||Object.keys(key).sort().join('|')!=='projectId|shiftId|workerId'||![key.projectId,key.workerId,key.shiftId].every(workspaceId))))invalid('ATTENDANCE_SELECTION_INVALID');
 const scopedSql=`WITH RECURSIVE retained_keys AS (
   SELECT "projectId","workerId","shiftId" FROM jsonb_to_recordset($3::jsonb) AS seed("projectId" text,"workerId" text,"shiftId" text)
   UNION
   SELECT a.metadata->'fieldOperations'->'previousClosureCheckpoint'->>'sourceProjectId',a.metadata->'fieldOperations'->'previousClosureCheckpoint'->>'sourceWorkerId',a.metadata->'fieldOperations'->'previousClosureCheckpoint'->>'sourceShiftId'
   FROM retained_keys k JOIN public."AttendanceEntry" a ON a."projectId"=k."projectId" AND a."workerId"=k."workerId" AND a.metadata->'fieldOperations'->>'shiftId'=k."shiftId"
   JOIN public."Project" p ON p.id=a."projectId"
   WHERE p."organizationId"=$1 AND a.metadata->'fieldOperations'->>'recordedBy'=$2 AND a.metadata->'fieldOperations'->>'eventType'='CHECK_IN' AND a.metadata->'fieldOperations' ? 'previousClosureCheckpoint'
  ) SELECT ${eventColumns} FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId"
  WHERE p."organizationId"=$1 AND a.metadata->'fieldOperations'->>'recordedBy'=$2 AND EXISTS(SELECT 1 FROM retained_keys k WHERE k."projectId"=a."projectId" AND k."workerId"=a."workerId" AND k."shiftId"=a.metadata->'fieldOperations'->>'shiftId')
  ORDER BY a."projectId",a."workerId",(a.metadata->'fieldOperations'->>'sequence')::int,a.id LIMIT 10001`;
 const events=(await client.query(selected?scopedSql:`SELECT ${eventColumns} FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId" WHERE p."organizationId"=$1 AND a.metadata->'fieldOperations'->>'recordedBy'=$2 ORDER BY a."projectId",a."workerId",(a.metadata->'fieldOperations'->>'sequence')::int,a.id LIMIT 10001`,selected?[organizationId,actorId,JSON.stringify(journeyKeys)]:[organizationId,actorId])).rows;
 if(!events.length){if(allowEmpty===true)return {complete:true,selectionOnly:selected,journeys:[],byKey:new Map()};unavailable();}if(events.length>LIMIT)invalid('ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE');
 const groups=new Map(),byId=new Map();
 for(const row of events){if(byId.has(row.id))invalid();byId.set(row.id,row);const key=rowKey(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 // An actor-filtered chronology must never certify an apparent subset of
 // a retained source. This covers every dependency group, including checkpoint
 // ancestors, inside the same canonical transaction snapshot.
 const completeKeys=[...groups.keys()].map(key=>{const [projectId,workerId,shiftId]=JSON.parse(key);return {projectId,workerId,shiftId};});
 const unlocatable=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Project' AND "entityId"=ANY($2::text[]) AND action='field.attendance.corrected' AND (jsonb_typeof(metadata->'workerId') IS DISTINCT FROM 'string' OR jsonb_typeof(metadata->'shiftId') IS DISTINCT FROM 'string' OR metadata->>'workerId' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$' OR metadata->>'shiftId' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$') LIMIT 1`,[organizationId,[...new Set(completeKeys.map(key=>key.projectId))]])).rows;
 if(unlocatable.length)invalid('ATTENDANCE_CORRECTION_SCOPE_UNLOCATABLE');
 const fullSource=(await client.query(`SELECT ${eventColumns} FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId" WHERE p."organizationId"=$1 AND EXISTS(SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS k("projectId" text,"workerId" text,"shiftId" text) WHERE k."projectId"=a."projectId" AND k."workerId"=a."workerId" AND k."shiftId"=a.metadata->'fieldOperations'->>'shiftId') ORDER BY a.id LIMIT 10001`,[organizationId,JSON.stringify(completeKeys)])).rows;
 if(fullSource.length>LIMIT)invalid('ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE');
 if(fullSource.length!==events.length||new Set(fullSource.map(row=>row.id)).size!==events.length||fullSource.some(row=>!byId.has(row.id)||row.metadata?.fieldOperations?.recordedBy!==actorId))invalid('ATTENDANCE_SOURCE_SET_MISMATCH');
 const missing=[...new Set([...groups.values()].map(rows=>rows[0].metadata?.fieldOperations?.previousEventId).filter(id=>id&&!byId.has(id)))];
 if(missing.length){const predecessors=(await client.query(`SELECT ${eventColumns} FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId" WHERE p."organizationId"=$1 AND a.id=ANY($2::text[]) LIMIT 10001`,[organizationId,missing])).rows;if(predecessors.length!==missing.length)invalid('ATTENDANCE_PREDECESSOR_INVALID');for(const row of predecessors){if(byId.has(row.id))invalid();byId.set(row.id,row);}}
 if(byId.size>LIMIT)invalid('ATTENDANCE_GLOBAL_SOURCE_INCOMPLETE');
 const recording=(await client.query(`SELECT ${auditColumns},"createdAt" FROM public."AuditLog" WHERE "organizationId"=$1 AND action='field.operation.recorded' AND metadata->>'command' IN ('ATTENDANCE','REVIEW_ATTENDANCE') AND metadata->'outcome'->'event'->>'id'=ANY($2::text[]) LIMIT 20001`,[organizationId,[...byId.keys()]])).rows.map(row=>({...row,createdAt:iso(row.createdAt)}));
 if(recording.length>LIMIT*2)invalid('ATTENDANCE_AUDIT_SOURCE_INCOMPLETE');
 const retained=selected?[...groups.keys()].map(key=>{const [projectId,workerId,shiftId]=JSON.parse(key);return {projectId,workerId,shiftId};}):null;
 const incidents=(await client.query(`SELECT i.id,i."projectId",i.metadata FROM public."Incident" i JOIN public."Project" p ON p.id=i."projectId" WHERE p."organizationId"=$1 AND i.metadata->'attendanceCorrection'->>'kind'='ATTENDANCE_CHRONOLOGY_CLOSURE' AND i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->'beneficiary'->>'actorId'=$2 AND ($3::jsonb IS NULL OR EXISTS(SELECT 1 FROM jsonb_to_recordset($3::jsonb) AS k("projectId" text,"workerId" text,"shiftId" text) WHERE k."projectId"=i."projectId" AND k."workerId"=i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->>'workerId' AND k."shiftId"=i.metadata->'attendanceCorrection'->'proposalEnvelope'->'proposal'->>'shiftId')) LIMIT 1001`,[organizationId,actorId,retained?JSON.stringify(retained):null])).rows;
 if(incidents.length>PROPOSAL_LIMIT)invalid('ATTENDANCE_CORRECTION_SET_INVALID');
 const bundles=[],expectedIds=new Set();
 for(const row of incidents){const w=wrapper(row),p=w.proposalEnvelope.proposal,d=w.decisionEnvelope?.decision;
  if(p.organizationId!==organizationId||p.beneficiary.actorId!==actorId||Date.parse(p.submittedAt)>Date.parse(observedAt)||d&&Date.parse(d.decidedAt)>Date.parse(observedAt))invalid();
  const audits=auditedAttendanceClosureDescriptors(w.proposalEnvelope,w.decisionEnvelope);
  for(const a of Object.values(audits).filter(Boolean)){if(expectedIds.has(a.id))invalid('ATTENDANCE_CORRECTION_RECEIPT_INTEGRITY');expectedIds.add(a.id);}
  bundles.push({proposalEnvelope:w.proposalEnvelope,decisionEnvelope:w.decisionEnvelope,audits});
 }
 const receipts=(await client.query(`SELECT ${auditColumns} FROM public."AuditLog" WHERE "organizationId"=$1 AND (id=ANY($2::text[]) OR (action='field.attendance.corrected' AND metadata->>'beneficiaryActorId'=$3 OR action='field.operation.recorded' AND (metadata->'outcome'->'proposalEnvelope'->'proposal'->'beneficiary'->>'actorId'=$3 OR metadata->'outcome'->'decisionEnvelope'->'decision'->'beneficiary'->>'actorId'=$3)) AND ($4::jsonb IS NULL OR EXISTS(SELECT 1 FROM jsonb_to_recordset($4::jsonb) AS k("projectId" text,"workerId" text,"shiftId" text) WHERE k."projectId"=metadata->>'projectId' AND k."workerId"=COALESCE(metadata->>'workerId',metadata->'outcome'->'proposalEnvelope'->'proposal'->>'workerId',metadata->'outcome'->'decisionEnvelope'->'decision'->>'workerId') AND k."shiftId"=COALESCE(metadata->>'shiftId',metadata->'outcome'->'proposalEnvelope'->'proposal'->>'shiftId',metadata->'outcome'->'decisionEnvelope'->'decision'->>'shiftId')))) LIMIT 3001`,[organizationId,[...expectedIds],actorId,retained?JSON.stringify(retained):null])).rows;
 if(receipts.length!==expectedIds.size||receipts.length>PROPOSAL_LIMIT*3)invalid('ATTENDANCE_CORRECTION_RECEIPT_INTEGRITY');
 const receiptMap=new Map();for(const a of receipts){if(!expectedIds.has(a.id)||receiptMap.has(a.id))invalid('ATTENDANCE_CORRECTION_RECEIPT_INTEGRITY');receiptMap.set(a.id,a);}
 for(const bundle of bundles)for(const expected of Object.values(bundle.audits).filter(Boolean))if(!correctionSame(expected,plainAudit(receiptMap.get(expected.id)||{})))invalid('ATTENDANCE_CORRECTION_RECEIPT_INTEGRITY');
 const cache=new Map(),visiting=new Set();
 async function resolve(key){
  if(cache.has(key))return cache.get(key);if(visiting.has(key))invalid('ATTENDANCE_CHECKPOINT_CYCLE');visiting.add(key);
  const rows=groups.get(key);if(!rows)invalid('ATTENDANCE_CHECKPOINT_SOURCE_MISSING');const first=rows[0],e=first.metadata?.fieldOperations,checkpoint=e?.previousClosureCheckpoint;
  const person=await beneficiary(client,organizationId,first.projectId,first.workerId,actorId);
  let precedingClosure=null;if(checkpoint){const prior=await resolve(JSON.stringify([checkpoint.sourceProjectId,checkpoint.sourceWorkerId,checkpoint.sourceShiftId]));precedingClosure=prior.projection;}
  const previousEvent=e.previousEventId?byId.get(e.previousEventId):null;if(e.previousEventId&&!previousEvent)invalid('ATTENDANCE_PREDECESSOR_INVALID');
  const allIds=new Set([...rows.map(row=>row.id),...(previousEvent?[previousEvent.id]:[])]);
  const relevant=recording.filter(a=>allIds.has(a.metadata?.outcome?.event?.id));
  const snapshot=readAuditedAttendanceShift({organizationId,projectId:first.projectId,workerId:first.workerId,shiftId:e.shiftId,beneficiary:person,events:rows,previousEvent,recordingAudits:relevant.filter(a=>a.metadata.command==='ATTENDANCE'),reviewAudits:relevant.filter(a=>a.metadata.command==='REVIEW_ATTENDANCE'),auditSetComplete:true,observedAt,precedingClosure});
  const corrections=bundles.filter(b=>b.proposalEnvelope.proposal.projectId===first.projectId&&b.proposalEnvelope.proposal.workerId===first.workerId&&b.proposalEnvelope.proposal.shiftId===e.shiftId);
  const result={snapshot,projection:projectAuditedAttendanceChronology({snapshot,corrections}),corrections};cache.set(key,result);visiting.delete(key);return result;
 }
 for(const key of groups.keys())await resolve(key);
 if(bundles.some(b=>!groups.has(JSON.stringify([b.proposalEnvelope.proposal.projectId,b.proposalEnvelope.proposal.workerId,b.proposalEnvelope.proposal.shiftId]))))invalid('ATTENDANCE_CORRECTION_ORPHAN');
 return {complete:true,selectionOnly:selected,journeys:[...cache.values()],byKey:cache};
}

const selectedJourney=(ledger,projectId,workerId,shiftId)=>{const selected=ledger.byKey.get(JSON.stringify([projectId,workerId,shiftId]));if(!selected)unavailable();return selected;};
const others=(ledger,selected)=>({complete:ledger.complete,rows:ledger.journeys.filter(j=>j!==selected).map(j=>({projectId:j.projection.projectId,workerId:j.projection.workerId,shiftId:j.projection.shiftId,beneficiaryActorId:j.projection.beneficiary.actorId,startedAt:j.projection.observed.startedAt,effectiveEndedAt:j.projection.effective.endedAt}))});
const outcome=w=>({kind:w.decisionEnvelope?'ATTENDANCE_CHRONOLOGY_CLOSURE_DECISION':'ATTENDANCE_CHRONOLOGY_CLOSURE_PROPOSAL',...(w.decisionEnvelope?{decisionEnvelope:w.decisionEnvelope}:{proposalEnvelope:w.proposalEnvelope})});
async function insertAudit(client,a){await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[a.id,a.organizationId,a.actorId,a.action,a.entityType,a.entityId,JSON.stringify(a.metadata)]);}
async function receipt(client,member,projectId,key){const rows=(await client.query(`SELECT ${auditColumns} FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityType"='Project' AND "entityId"=$4 AND action='field.operation.recorded'`,[fieldReceiptId(member.actorId,projectId,key),member.organizationId,member.actorId,projectId])).rows;if(rows.length>1)invalid('FIELD_RECEIPT_INTEGRITY');return rows[0]||null;}
const reply=(scope,command,receiptId,value,replayed)=>({scope,projectId:command.projectId,operationId:command.operationId,action:command.action,requestDigest:correctionDigest(command),state:'RECORDED',saved:true,replayed,receiptId,...value});

export function createAttendanceClosures({workspace}){
 if(typeof workspace?.projectOperation!=='function')throw new TypeError('Canonical workspace transaction required');
 async function current(client,member,projectId,{lock=false}={}){authority(member);const actor=await actorAccess(client,member.organizationId,projectId,member.actorId,{lock});if(actor.clerkUserId!==member.clerkUserId||actor.role!==member.role||actor.membershipId!==member.membershipId)throw new WorkspaceError('ATTENDANCE_CLOSURE_ACCESS_CHANGED',403);return actor;}
 async function beforeProject(client,member,command){
  authority(member);const t=await target(client,member.organizationId,command.projectId,command);
  // Resolve original identity/membership under SHARE before acquiring person,
  // then Project. The acting administrator's lock is not a substitute.
  await actorAccess(client,member.organizationId,command.projectId,t.actorId,{lock:true});
  await lockPersonWorksiteJourney(client,{organizationId:member.organizationId,actorId:t.actorId});
 }
 async function recovered(client,member,scope,projectId,key,row){
  if(!isAttendanceClosureAction(row.metadata?.command))invalid('FIELD_RECEIPT_INTEGRITY');
  await current(client,member,projectId);
  const value=row.metadata.outcome,envelope=value?.proposalEnvelope||value?.decisionEnvelope;
  const p=value?.proposalEnvelope?.proposal,d=value?.decisionEnvelope?.decision;
  if(!envelope||row.metadata.operationId!==key||row.metadata.projectId!==projectId||row.metadata.action!==row.metadata.command||!/^field_[a-f0-9]{64}$/.test(row.id))invalid('FIELD_RECEIPT_INTEGRITY');
  const proposalId=p?.id||d?.proposalId,incidents=(await client.query(`SELECT id,"projectId",metadata FROM public."Incident" WHERE id=$1 AND "projectId"=$2`,[proposalId,projectId])).rows;
  if(incidents.length!==1)unavailable();const w=wrapper(incidents[0]),proposal=w.proposalEnvelope.proposal;
  await beneficiary(client,member.organizationId,projectId,proposal.workerId,proposal.beneficiary.actorId,{requireCurrent:true});
  const at=iso((await client.query('SELECT clock_timestamp() AS now')).rows[0].now);
  await readAttendanceClosureLedger(client,{organizationId:member.organizationId,actorId:proposal.beneficiary.actorId,observedAt:at});
  const expected=auditedAttendanceClosureDescriptors(w.proposalEnvelope,w.decisionEnvelope)[p?'proposalReceipt':'decisionReceipt'];
  if(!expected||!correctionSame(expected,plainAudit(row)))invalid('FIELD_RECEIPT_INTEGRITY');
  return {scope,projectId,operationId:key,action:row.metadata.command,requestDigest:row.metadata.requestDigest,state:'RECORDED',saved:true,replayed:true,receiptId:row.id,...value};
 }
 return {
  beforeProject,
  async save(session,input){
   const command=normalizeAttendanceClosureCommand(input);
   return workspace.projectOperation(session,command,true,async(client,member,scope,project)=>{
    const actor=await current(client,member,project.id,{lock:true}),id=fieldReceiptId(member.actorId,project.id,command.operationId),prior=await receipt(client,member,project.id,command.operationId);
    if(prior){if(prior.metadata.requestDigest!==correctionDigest(command)||prior.metadata.command!==command.action)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);return recovered(client,member,scope,project.id,command.operationId,prior);}
    const t=await target(client,member.organizationId,project.id,command),person=await beneficiary(client,member.organizationId,project.id,t.workerId,t.actorId,{lock:true,requireCurrent:true});
    const at=iso((await client.query('SELECT clock_timestamp() AS now')).rows[0].now),ledger=await readAttendanceClosureLedger(client,{organizationId:member.organizationId,actorId:t.actorId,observedAt:at}),selected=selectedJourney(ledger,project.id,t.workerId,t.shiftId);
    if(selected.snapshot.beneficiary.accessDigest!==person.accessDigest)invalid('ATTENDANCE_CLOSURE_BENEFICIARY_ACCESS_CHANGED');
    const context={member,scope,projectId:project.id,actorAccessDigest:actor.accessDigest};
    let w,audits;
    if(command.action==='PROPOSE_ATTENDANCE_CLOSURE'){
     if(selected.projection.pending||selected.projection.correction)invalid('ATTENDANCE_CLOSURE_ALREADY_PROPOSED');
     const proposalEnvelope=proposeAuditedAttendanceClosure(command,{context,snapshot:selected.snapshot,now:at,otherJourneys:others(ledger,selected)});
     w={version:2,kind:KIND,proposalEnvelope,decisionEnvelope:null,resolution:'PENDING'};audits=auditedAttendanceClosureDescriptors(proposalEnvelope);
     await client.query(`INSERT INTO public."Incident"(id,"projectId",title,description,severity,status,reporter,metadata,"updatedAt") VALUES($1,$2,'Revisión de cierre de jornada','Hora efectiva presentada para revisión independiente.','INFO','open',$3,$4::jsonb,clock_timestamp())`,[proposalEnvelope.proposal.id,project.id,member.actorId,JSON.stringify({attendanceCorrection:w})]);
     await insertAudit(client,audits.proposalReceipt);
    }else{
     const rows=(await client.query(`SELECT id,"projectId",metadata FROM public."Incident" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[command.payload.proposalId,project.id])).rows;
     if(rows.length!==1)unavailable();const stored=wrapper(rows[0]);if(stored.resolution!=='PENDING')invalid('ATTENDANCE_CLOSURE_ALREADY_DECIDED');
     const p=stored.proposalEnvelope.proposal,proposer=await actorAccess(client,member.organizationId,project.id,p.submittedBy.actorId,{lock:true});
     const decisionEnvelope=decideAuditedAttendanceClosure(command,{context,snapshot:selected.snapshot,proposalEnvelope:stored.proposalEnvelope,proposer,now:at,otherJourneys:others(ledger,selected)});
     w={...stored,decisionEnvelope,resolution:decisionEnvelope.decision.decision==='APPROVE'?'APPROVED':'REJECTED'};audits=auditedAttendanceClosureDescriptors(stored.proposalEnvelope,decisionEnvelope);
     // Only the wrapper gains a decision. The sealed proposal remains PENDING
     // and byte-equivalent; no attendance mark is inserted or changed.
     const changed=await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[p.id,project.id,JSON.stringify({...rows[0].metadata,attendanceCorrection:w})]);
     if(changed.rowCount!==1)invalid('ATTENDANCE_CLOSURE_WRAPPER_CHANGED');
     await insertAudit(client,audits.decisionReceipt);if(audits.correctionFact)await insertAudit(client,audits.correctionFact);
    }
    // projectOperation returns this value only after its canonical COMMIT.
    return reply(scope,command,id,outcome(w),false);
   },(client,member)=>beforeProject(client,member,command));
  },
  async read(session,context){
   if(![context.workerId,context.shiftId].every(workspaceId))throw new WorkspaceError('FIELD_QUERY_INVALID');
   return workspace.projectOperation(session,context,false,async(client,member,scope,project)=>{
    await current(client,member,project.id);const anchors=(await client.query(`SELECT a.id,a.metadata FROM public."AttendanceEntry" a WHERE a."projectId"=$1 AND a."workerId"=$2 AND a.metadata->'fieldOperations'->>'shiftId'=$3 AND a.metadata->'fieldOperations'->>'eventType'='CHECK_IN' LIMIT 2`,[project.id,context.workerId,context.shiftId])).rows;
    if(anchors.length!==1)unavailable();const actorId=anchors[0].metadata?.fieldOperations?.recordedBy;if(!workspaceId(actorId))invalid();
    const at=iso((await client.query('SELECT clock_timestamp() AS now')).rows[0].now),ledger=await readAttendanceClosureLedger(client,{organizationId:member.organizationId,actorId,observedAt:at,journeyKeys:[{projectId:project.id,workerId:context.workerId,shiftId:context.shiftId}]}),selected=selectedJourney(ledger,project.id,context.workerId,context.shiftId);
    let beneficiaryCurrent=true;try{await beneficiary(client,member.organizationId,project.id,context.workerId,actorId,{requireCurrent:true});}catch(error){if(error instanceof WorkspaceError&&[403,404,409].includes(error.status))beneficiaryCurrent=false;else throw error;}
    const decisions=[];
    for(const bundle of selected.corrections){const p=bundle.proposalEnvelope.proposal,currentSource=bundle.proposalEnvelope.temporalDigest===selected.snapshot.temporalDigest;
     const independent=![p.submittedBy.actorId,p.beneficiary.actorId].includes(member.actorId)&&![p.submittedBy.clerkUserId,p.beneficiary.clerkUserId].includes(member.clerkUserId);
     let proposerCurrent=true;try{const actor=await actorAccess(client,member.organizationId,project.id,p.submittedBy.actorId);proposerCurrent=canDecideOvertime(actor.role)&&actor.clerkUserId===p.submittedBy.clerkUserId&&actor.accessDigest===p.submittedBy.accessDigest;}catch(error){if(error instanceof WorkspaceError&&[403,404,409].includes(error.status))proposerCurrent=false;else throw error;}
     decisions.push({proposalId:p.id,canDecide:currentSource&&!bundle.decisionEnvelope&&independent&&beneficiaryCurrent&&proposerCurrent});
    }
    const capabilities={canPropose:beneficiaryCurrent&&Boolean(selected.snapshot.source129)&&selected.projection.pending===0&&!selected.projection.correction,decisions};
    return {scope,projectId:project.id,readOnly:true,observedAt:at,capabilities,chronology:selected.projection,source:selected.snapshot.source129,proposals:selected.corrections.map(b=>({proposalEnvelope:b.proposalEnvelope,decisionEnvelope:b.decisionEnvelope,currentSource:b.proposalEnvelope.temporalDigest===selected.snapshot.temporalDigest,state:b.proposalEnvelope.temporalDigest!==selected.snapshot.temporalDigest?'SUPERSEDED':b.decisionEnvelope?b.decisionEnvelope.decision.decision==='APPROVE'?'APPROVED':'REJECTED':'PENDING'})),paymentCalculated:false,paymentEnabled:false};
   });
  },
  async recoverWithin(client,member,scope,context,row){return recovered(client,member,scope,context.projectId,context.operationId,row);},
  async status(session,context){
   if(!operationId(context.operationId))throw new WorkspaceError('FIELD_INPUT_INVALID');
   return workspace.projectOperation(session,context,false,async(client,member,scope,project)=>{await current(client,member,project.id);const row=await receipt(client,member,project.id,context.operationId);return row?recovered(client,member,scope,project.id,context.operationId,row):{scope,projectId:project.id,operationId:context.operationId,state:'NOT_OBSERVED',definitive:false};});
  },
 };
}
