import { randomUUID, randomBytes } from 'node:crypto';
import { WorkspaceError, workspaceId, operationId, digest } from './workspace-policy.mjs';
import { cleanMetadata } from './site-register-policy.mjs';
import { normalizeFieldCommand, fieldTransition, evaluateFieldLocation, fieldReceiptId, canReviewField, canApproveProgress } from './field-operations-policy.mjs';
import { insertSiteReport, publicSiteReport } from './site-register-store.mjs';
import { META_DEMO_PILOT_PROTOCOL } from './meta-cloud-protocol.mjs';
import { compareProgressMeasurementQuantities } from './progress-measurement-quantity.js';
import {MATERIAL_INVENTORY_ACTIONS,MATERIAL_CATALOG_LIMIT,inventoryCatalog,inventoryCatalogHash,applyInventoryFieldAction,readInventory,readOwnConsumptions,readConsumption,readStockAdjustment,lockStockAdjustmentProposer} from './material-inventory.mjs';
import {lockPersonWorksiteJourney,assertPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {OVERTIME_ACTIONS,canDecideOvertime} from './field-overtime-policy.mjs';
import {createFieldOvertime} from './field-overtime-store.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {TASK_MEASUREMENT_VERSION,publicTaskMeasurement,deriveTaskMeasurement,assertMeasurementConfiguration} from './task-progress-measurement.js';
import {readOwnFieldReports} from './field-report-feedback.mjs';
import {readFieldHoursReport} from './field-hours-report.mjs';
import {createApprovedProgressCurveReader} from './approved-progress-curve-store.mjs';
import {EXECUTION_ACTIONS} from './field-execution-policy.mjs';
import {createFieldExecution,beforeExecutionProject} from './field-execution-store.mjs';

const revision = name => `to_char(${name},'YYYY-MM-DD"T"HH24:MI:SS.US')`;
const newId = prefix => prefix+'_'+randomUUID().replaceAll('-','');
const publicMeasuredTask=row=>{const {metadata,...task}=row,measurement=publicTaskMeasurement(row);return {...task,...(measurement?{measurement}:{})};};
const measurementGuard=callback=>{try{return callback();}catch(error){if(error?.name==='TaskProgressMeasurementError')throw new WorkspaceError(error.code,error.status);throw error;}};
export function assertMeasuredProposalSnapshot(current,action){
  const expected=measurementGuard(()=>deriveTaskMeasurement(current,{mode:action.measurement.mode,quantity:action.measurement.reported}));
  // PostgreSQL jsonb does not preserve object key order. Check the exact fact
  // set and each scalar; receipt digests keep their existing immutable format.
  if(Object.keys(expected).sort().join('|')!==Object.keys(action.measurement).sort().join('|')||!Object.keys(expected).every(key=>action.measurement[key]===expected[key])||action.progress!==expected.progress||action.quantity!==expected.executed||action.baseline!==expected.baseline||action.unit!==expected.unit)throw new WorkspaceError('FIELD_MEASUREMENT_CHANGED',409);
}
const measurementConfigurationAction='CONFIGURE_PROGRESS_MEASUREMENT',measurementCancellationAction='CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION';
const measurementCancelled=receipt=>receipt?.metadata?.outcome?.kind==='MEASUREMENT_CONFIGURATION_CANCELLED';
function cancelledMeasurementOutcome(receipt,{projectId,operationId:operation,taskId},scope,replayed=true){
  const metadata=receipt.metadata,outcome=metadata?.outcome,key=operation.toLowerCase();
  if(metadata?.version!==1||metadata.projectId!==projectId||metadata.command!==measurementConfigurationAction||metadata.action!==measurementConfigurationAction||metadata.operationId!==key||metadata.requestDigest!==null||outcome?.kind!=='MEASUREMENT_CONFIGURATION_CANCELLED'||!workspaceId(outcome.taskId)||taskId!==undefined&&outcome.taskId!==taskId||outcome.taskProgressUnchanged!==true)throw new WorkspaceError('FIELD_RECEIPT_INTEGRITY',409);
  return {scope,projectId,operationId:key,action:measurementConfigurationAction,state:'CANCELLED',saved:false,replayed,receiptId:receipt.id,kind:'MEASUREMENT_CONFIGURATION_CANCELLED',taskId:outcome.taskId,taskProgressUnchanged:true};
}
export function assertProgressContinuity(current, proposed) {
  if(proposed.progress<current.progress)throw new WorkspaceError('FIELD_PROGRESS_REGRESSION',409);
  const approved=current.metadata?.fieldOperations?.quantity;
  if(!approved)return;
  if(approved.baseline!==proposed.baseline||approved.unit!==proposed.unit)throw new WorkspaceError('FIELD_BASELINE_CHANGED',409);
  let comparison;
  try{comparison=compareProgressMeasurementQuantities(proposed.quantity,approved.executed);}catch{throw new WorkspaceError('FIELD_QUANTITY_INVALID');}
  if(comparison<0)throw new WorkspaceError('FIELD_PROGRESS_REGRESSION',409);
}
export function publicFieldEvidence(row) {
  const e=row.metadata?.fieldOperations;
  const raw=e.processing||{status:'NOT_REQUESTED'},processing={status:raw.status};
  for(const key of ['code','result','humanReviewRequired','analysisConsent','startedAt','expiresAt','completedAt'])if(Object.hasOwn(raw,key))processing[key]=raw[key];
  if(raw.usage?.version===2&&Array.isArray(raw.usage.stages)||raw.usageHoldCode)processing.providerPending=Boolean(raw.usageHoldCode||['RUNNING','MANUAL_REVIEW_REQUIRED','FAILED_RETRYABLE'].includes(raw.status)&&raw.usage.stages.some(item=>['DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED'].includes(item?.usage?.state)));
  if(raw.status==='RUNNING'){
    const expires=Date.parse(raw.expiresAt),observed=row.readAt instanceof Date?row.readAt.getTime():NaN;
    processing.leaseExpired=Number.isFinite(expires)&&Number.isFinite(observed)&&expires<=observed;
  }
  return {id:row.id,title:row.title,taskId:e.taskId,workerId:e.workerId,caption:row.description||'',sectorId:e.sectorId,
    status:e.review?.decision==='APPROVE'?'APPROVED':e.review?.decision==='REJECT'?'REJECTED':'PENDING',revision:row.revision,
    capturedAt:e.capturedAt,media:{kind:e.media.kind,contentType:e.media.contentType,bytes:e.media.bytes,sha256:e.media.sha256},
    processing,review:e.review?{decision:e.review.decision,reason:e.review.reason,recordedAt:e.review.recordedAt}:null};
}
const publicEvent=row=>({id:row.id,workerId:row.workerId,recordedAt:row.recordedAt,...row.metadata.fieldOperations});
const publicProposal=row=>({id:row.id,summary:row.summary,status:row.status==='PENDING'&&row.expired===true?'EXPIRED':row.status,statusStored:row.status,expiresAt:row.expiresAt?.toISOString()||null,revision:row.revision,
  taskId:row.action.taskId,workerId:row.proposedByWorkerId,progress:row.action.progress,quantity:row.action.quantity,baseline:row.action.baseline,unit:row.action.unit,...(row.action.measurement?{measurement:row.action.measurement}:{}),reason:row.action.reason,evidenceIds:row.action.evidenceIds,
  result:row.result?.fieldOperations||null});
export function createFieldOperations({workspace,assertParticipant,usage=null}) {
  if(usage!==null&&typeof usage.resourceProjection!=='function')throw new TypeError('Explicit field review usage port required');
  const overtime=createFieldOvertime({assertWorker:worker});
  const progressCurve=createApprovedProgressCurveReader({workspace,canReview:canReviewField});
  const execution=createFieldExecution({assertWorker:worker,assertTask:(...args)=>task(...args),assertEvidence:(...args)=>evidence(...args),publicTask:publicMeasuredTask});
  const correlated=action=>EXECUTION_ACTIONS.includes(action)||MATERIAL_INVENTORY_ACTIONS.includes(action)||OVERTIME_ACTIONS.includes(action)||action==='CONFIGURE_PROGRESS_MEASUREMENT';
  const run=(session,context,writable,callback)=>workspace.projectOperation(session,context,writable,callback,writable&&EXECUTION_ACTIONS.includes(context.action)?(client,member)=>beforeExecutionProject(client,member,context):writable&&context.action==='ATTENDANCE'?lockPersonWorksiteJourney:writable&&OVERTIME_ACTIONS.includes(context.action)?(client,member)=>overtime.beforeProject(client,member,context):writable&&context.action==='DECIDE_STOCK_ADJUSTMENT'&&context.payload?.decision==='APPROVE'?async(client,member)=>{if(!canApproveProgress(member.role))throw new WorkspaceError('INVENTORY_MANAGE_REQUIRED',403);if(member.channelProof)throw new WorkspaceError('INVENTORY_ADJUSTMENT_WEB_ONLY',403);if(!await prior(client,member,fieldReceiptId(member.actorId,context.projectId,context.operationId)))await lockStockAdjustmentProposer(client,member,context.projectId,context.payload.proposalId);}:undefined);
  async function reviewAccess(client,member,session,projectId,scope) {
    const owned=(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE "projectId"=$1 AND active=true AND metadata->'participant'->>'version'='1' AND metadata->'participant'->>'clerkUserId'=$2 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'kyc'->>'status'='APPROVED' ORDER BY id`,[projectId,session.userId])).rows;
    const reviewAccessStamp=digest(['field-review-access-v1',scope,projectId,canReviewField(member.role),canApproveProgress(member.role),owned.map(w=>[w.id,w.metadata.participant.permissions?.report===true,w.metadata.participant.permissions?.attendance===true])]);
    return {owned,reviewAccessStamp};
  }
  async function worker(client,member,session,projectId,workerId,permission='report') {
    if(!workspaceId(workerId))throw new WorkspaceError('FIELD_WORKER_REQUIRED');
    if(typeof assertParticipant==='function')return assertParticipant(client,member,session,projectId,workerId,{permission,requireKyc:true});
    const row=(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[workerId,projectId])).rows[0],p=row?.metadata?.participant;
    if(!row?.active||p?.version!==1||p.status!=='ACTIVE'||p.clerkUserId!==session.userId||p.permissions?.[permission]!==true)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);
    await assertApprovedParticipantKyc(client,{...row,projectId},{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
    return row;
  }
  const evidence=async(client,projectId,id,lock=false)=>{
    const row=(await client.query(`SELECT id,title,description,metadata,clock_timestamp() AS "readAt",${revision('"updatedAt"')} AS revision FROM public."Incident" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0];
    if(row?.metadata?.fieldOperations?.version!==1||row.metadata.fieldOperations.kind!=='EVIDENCE')throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);return row;
  };
  const task=async(client,projectId,id,lock=false)=>{
    const row=(await client.query(`SELECT id,title,progress,status::text AS status,metadata,to_char("startsAt",'YYYY-MM-DD') AS "startsOn",to_char("endsAt",'YYYY-MM-DD') AS "endsOn",${revision('"updatedAt"')} AS revision FROM public."Task" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0];
    if(!row)throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);return row;
  };
  const proposal=async(client,projectId,id,lock=false)=>{
    const row=(await client.query(`SELECT id,summary,status::text AS status,action,precondition,result,"proposedByWorkerId","expiresAt",("expiresAt"<=clock_timestamp()) AS expired,${revision('"updatedAt"')} AS revision FROM public."OperationalProposal" WHERE id=$1 AND "projectId"=$2 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0];
    if(row?.action?.fieldOperationsVersion!==1)throw new WorkspaceError('FIELD_PROPOSAL_UNAVAILABLE',404);return row;
  };
  const prior=async(client,member,id)=>(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='field.operation.recorded'`,[id,member.organizationId,member.actorId])).rows[0];
  async function recoveryPermission(client,member,session,projectId,receipt) {
    if(receipt.metadata?.projectId!==projectId)throw new WorkspaceError('FIELD_RECEIPT_INTEGRITY',409);
    const action=receipt.metadata.command;
    if(['ISSUE_EXECUTION_MANDATE','REVOKE_EXECUTION_MANDATE'].includes(action)&&(!canApproveProgress(member.role)||member.channelProof))throw new WorkspaceError('FIELD_EXECUTION_MANAGE_REQUIRED',403);
    if(['CONFIGURE_OVERTIME','DECIDE_OVERTIME'].includes(action)&&!canDecideOvertime(member.role))throw new WorkspaceError('OVERTIME_DECISION_PERMISSION_REQUIRED',403);
    if(['PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'].includes(action)&&member.channelProof)throw new WorkspaceError('INVENTORY_ADJUSTMENT_WEB_ONLY',403);
    if(action==='CONFIGURE_PROGRESS_MEASUREMENT'&&member.channelProof)throw new WorkspaceError('FIELD_MEASUREMENT_WEB_ONLY',403);
    if(['CONFIGURE_SITE','CONFIGURE_PROGRESS_MEASUREMENT','DECIDE_PROGRESS','ADD_MATERIAL','DECIDE_CONSUMPTION','REVERSE_CONSUMPTION','PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'].includes(action)&&!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
    if(['REVIEW_ATTENDANCE','REVIEW_EVIDENCE'].includes(action)&&!canReviewField(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
    if(['REPORT_EXECUTION','ATTENDANCE','PROPOSE_PROGRESS','REPORT_INCIDENT','REQUEST_MATERIAL','PROPOSE_CONSUMPTION','PROPOSE_OVERTIME'].includes(action)){
      const workerId=receipt.metadata.outcome.execution?.workerId||receipt.metadata.outcome.event?.workerId||receipt.metadata.outcome.proposal?.workerId||receipt.metadata.outcome.report?.workerId||receipt.metadata.outcome.consumption?.workerId||receipt.metadata.outcome.overtime?.workerId,permission=['ATTENDANCE','PROPOSE_OVERTIME'].includes(action)?'attendance':'report';
      // The project lock serializes writable replay against participant changes.
      // Read-only recovery keeps its snapshot without trying to lock the worker.
      const owned=(await client.query(`SELECT id,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'version'='1' AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'kyc'->>'status'='APPROVED' AND metadata->'participant'->'permissions'->>$4='true'`,[workerId,projectId,session.userId,permission])).rows;
      if(owned.length!==1)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);
      await assertApprovedParticipantKyc(client,{...owned[0],projectId},{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
    }
  }
  async function recoveredOutcome(client,projectId,receipt) {
    const outcome=receipt.metadata.outcome;
    if(outcome.kind==='EXECUTION_APPLIED')return {...outcome,executionReplay:true,effectsApplied:false,stockChanged:false,taskUpdated:false,...(outcome.task?{executionTaskSnapshot:outcome.task,task:publicMeasuredTask(await task(client,projectId,outcome.task.id))}:{})};
    if(outcome.overtime)return overtime.recover(client,projectId,outcome);
    if(outcome.consumption?.id)return {...outcome,recordedConsumptionSnapshot:outcome.consumption,consumption:(await readConsumption(client,projectId,outcome.consumption.id)).consumption};
    if(outcome.adjustment?.id)return {...outcome,adjustment:(await readStockAdjustment(client,projectId,outcome.adjustment.id)).adjustment};
    if(outcome.report?.id){const row=(await client.query(`SELECT id,title,description,severity::text AS severity,metadata,${revision('"updatedAt"')} AS revision,${revision('"createdAt"')} AS "createdAt" FROM public."Incident" WHERE id=$1 AND "projectId"=$2`,[outcome.report.id,projectId])).rows[0];if(!row)throw new WorkspaceError('SITE_REPORT_UNAVAILABLE',404);return {...outcome,report:publicSiteReport(row)};}
    const currentProposal=outcome.proposal?.id?publicProposal(await proposal(client,projectId,outcome.proposal.id)):null;
    if(['PROGRESS_DECISION','MEASUREMENT_CONFIGURATION'].includes(outcome.kind)&&outcome.task){
      const current=publicMeasuredTask(await task(client,projectId,outcome.task.id));
      return {...outcome,...(currentProposal?{proposal:currentProposal}:{}),task:current,...(outcome.kind==='PROGRESS_DECISION'?{decisionTaskSnapshot:outcome.task}:{configuredTaskSnapshot:outcome.task})};
    }
    return currentProposal?{...outcome,proposal:currentProposal}:outcome;
  }
  async function expireProgress(client,member,command,taskId) {
    const expired=(await client.query(`SELECT id,"expiresAt" FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND action->>'fieldOperationsVersion'='1' AND action->>'taskId'=$2 AND "expiresAt"<=clock_timestamp() ORDER BY id FOR UPDATE`,[command.projectId,taskId])).rows;
    for(const row of expired){
      const recordedAt=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
      const reason='La propuesta venció sin una decisión autorizada. El avance de la tarea se conserva.';
      const result={fieldOperations:{decision:'EXPIRED',reason,actorId:member.actorId,recordedAt,task:null,taskUpdated:false,expiryPolicy:'field-progress-seven-days-v1'}};
      await client.query(`UPDATE public."OperationalProposal" SET status='EXPIRED',result=$3::jsonb,"resolverProvider"='account-field-expiry',"resolverExternalId"=$4,"resolvedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND status='PENDING'`,[row.id,command.projectId,JSON.stringify(result),digest([command.projectId,row.id,'field-progress-expiry-v1'])]);
      await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.progress.expired','OperationalProposal',$4,$5::jsonb)`,['field_expiry_'+digest([command.projectId,row.id]),member.organizationId,member.actorId,row.id,JSON.stringify({version:1,projectId:command.projectId,taskId,proposalId:row.id,before:'PENDING',after:'EXPIRED',expiresAt:row.expiresAt.toISOString(),recordedAt,triggerOperationId:command.operationId,expiryPolicy:'field-progress-seven-days-v1',taskUpdated:false})]);
    }
  }
  async function record(client,member,command,outcome,requestDigest) {
    const id=fieldReceiptId(member.actorId,command.projectId,command.operationId);
    const correlation=correlated(command.action)?{projectId:command.projectId,operationId:command.operationId,action:command.action}:{};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.operation.recorded','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,command.projectId,JSON.stringify({version:1,projectId:command.projectId,command:command.action,requestDigest,...correlation,...(member.channelProof?{channelProof:member.channelProof}:{}),outcome})]);
    return {saved:true,replayed:false,receiptId:id,...(Object.keys(correlation).length?{...correlation,state:'RECORDED'}:{}),...(EXECUTION_ACTIONS.includes(command.action)?{requestDigest}:{}),...outcome};
  }
  function config(project) {
    const c=project.metadata?.fieldOperations;
    if(c?.version!==1||!Array.isArray(c.sectors))throw new WorkspaceError('FIELD_SITE_NOT_CONFIGURED',409);return c;
  }
  const latest=async(client,projectId,workerId)=>(await client.query(`SELECT id,"workerId",metadata,${revision('"checkedInAt"')} AS "recordedAt" FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=$2 AND metadata->'fieldOperations'->>'version'='1' ORDER BY (metadata->'fieldOperations'->>'sequence')::int DESC,id DESC LIMIT 1`,[projectId,workerId])).rows[0]||null;
  async function ownAttendanceHeads(client,member,projectId,owned){
    const ids=owned.filter(row=>row.metadata.participant.permissions?.attendance===true).map(row=>row.id);
    // Same version predicate and per-worker order as latest(), without the
    // history window. One read remains inside the canonical project snapshot.
    const rows=ids.length?(await client.query(`SELECT DISTINCT ON ("workerId") id,"workerId",metadata FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=ANY($2::text[]) AND metadata->'fieldOperations'->>'version'='1' ORDER BY "workerId",(metadata->'fieldOperations'->>'sequence')::int DESC,id DESC`,[projectId,ids])).rows:[];
    return ids.map(workerId=>{
      const matches=rows.filter(row=>row.workerId===workerId),row=matches[0],event=row?.metadata?.fieldOperations;
      if(!matches.length)return {workerId,status:'EMPTY',head:null};
      const phase={CHECK_IN:'WORKING',BREAK_START:'ON_BREAK',BREAK_END:'WORKING',CHECK_OUT:'WORKING'};
      // A reassigned person's previous author is not this account's history.
      // Unknown or malformed state is never interpreted as a fresh check-in.
      if(matches.length!==1||!workspaceId(row.id)||event?.version!==1||event.recordedBy!==member.actorId||!Object.hasOwn(phase,event.eventType)||phase[event.eventType]!==event.phase||!Number.isSafeInteger(event.sequence)||event.sequence<1||typeof event.recordedAt!=='string'||!Number.isFinite(Date.parse(event.recordedAt))||new Date(event.recordedAt).toISOString()!==event.recordedAt)return {workerId,status:'UNAVAILABLE',head:null};
      return {workerId,status:'CURRENT',head:{id:row.id,eventType:event.eventType,phase:event.phase,sequence:event.sequence,recordedAt:event.recordedAt}};
    });
  }
  return {
    progressCurve,
    shift(session,context){return run(session,context,false,async(client,member,scope,project)=>({scope,...await overtime.readShift(client,member,session,project,context)}));},
    reviewPage(session,context) {
      const {reviewSection,reviewFilter,afterReview=null,reviewId=null,reviewAccessStamp:expectedAccess}=context;
      if(!['EVIDENCE','PROGRESS','ATTENDANCE'].includes(reviewSection)||!['PENDING','ALL'].includes(reviewFilter)||[afterReview,reviewId].some(value=>value!==null&&!workspaceId(value))||afterReview&&reviewId||reviewId&&reviewFilter!=='ALL'||(afterReview||reviewId||expectedAccess!==undefined)&&!/^[a-f0-9]{64}$/.test(expectedAccess||''))throw new WorkspaceError('FIELD_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const access=await reviewAccess(client,member,session,context.projectId,scope),{reviewAccessStamp}=access;
        if(expectedAccess!==undefined&&expectedAccess!==reviewAccessStamp)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
        const reviewer=canReviewField(member.role),attendance=reviewSection==='ATTENDANCE',owned=access.owned.filter(row=>row.metadata.participant.permissions?.[attendance?'attendance':'report']===true).map(row=>row.id);
        if(attendance){
          // Review the canonical ledger independently of the recent history and
          // worker display windows. Names share this read-only project snapshot.
          const visible=`a."projectId"=$1 AND a.metadata->'fieldOperations'->>'version'='1' AND ($2::boolean OR (a."workerId"=ANY($3::text[]) AND a.metadata->'fieldOperations'->>'recordedBy'=$4))`,values=[context.projectId,reviewer,owned,member.actorId];
          // Validate against ALL visible events, so a decision does not retire a
          // cursor before the next pending page or a directed readback.
          if(afterReview||reviewId){const found=(await client.query(`SELECT a.id FROM public."AttendanceEntry" a WHERE ${visible} AND a.id=$5`,[...values,afterReview||reviewId])).rows;if(found.length!==1)throw new WorkspaceError('FIELD_REVIEW_CURSOR_UNAVAILABLE',404);}
          const pending=`a.metadata->'fieldOperations'->>'verificationStatus'='REVIEW_REQUIRED' AND (a.metadata->'fieldOperations'->'review' IS NULL OR a.metadata->'fieldOperations'->'review'='null'::jsonb)`,filtered=visible+(reviewFilter==='PENDING'?` AND ${pending}`:'');
          const rows=(await client.query(`SELECT a.id,a."workerId",a.metadata,${revision('a."checkedInAt"')} AS "recordedAt",w.name AS "workerName" FROM public."AttendanceEntry" a LEFT JOIN public."Worker" w ON w.id=a."workerId" AND w."projectId"=a."projectId" WHERE ${filtered} AND ($5::text IS NULL OR (a."checkedInAt",a.id)<(SELECT "checkedInAt",id FROM public."AttendanceEntry" WHERE "projectId"=$1 AND id=$5)) AND ($6::text IS NULL OR a.id=$6) ORDER BY a."checkedInAt" DESC,a.id DESC LIMIT 101`,[...values,afterReview,reviewId])).rows;
          const total=reviewId?rows.length:(await client.query(`SELECT count(*)::int AS total FROM public."AttendanceEntry" a WHERE ${filtered}`,values)).rows[0].total;
          return {scope,projectId:context.projectId,reviewAccessStamp,reviewSection,reviewFilter,afterReview,reviewId,records:rows.slice(0,100).map(row=>({...publicEvent(row),workerName:row.workerName||null})),total,nextCursor:rows.length>100?rows[99].id:null,canReview:reviewer,canApproveProgress:canApproveProgress(member.role)};
        }
        const media=reviewSection==='EVIDENCE',table=media?'public."Incident"':'public."OperationalProposal"';
        const kind=media?`metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE'`:`type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND action->>'fieldOperationsVersion'='1'`;
        const owner=media?`metadata->'fieldOperations'->>'workerId'`:`"proposedByWorkerId"`;
        const author=media?`metadata->'fieldOperations'->>'recordedBy'`:`action->>'submittedBy'`;
        const visible=`"projectId"=$1 AND ${kind} AND ($2::boolean OR (${owner}=ANY($3::text[]) AND ${author}=$4))`,values=[context.projectId,reviewer,owned,member.actorId];
        // A cursor is a canonical row reference, not a trusted client timestamp.
        // It remains usable when its decision changes between page requests.
        if(afterReview||reviewId){const found=(await client.query(`SELECT id FROM ${table} WHERE ${visible} AND id=$5`,[...values,afterReview||reviewId])).rows;if(found.length!==1)throw new WorkspaceError('FIELD_REVIEW_CURSOR_UNAVAILABLE',404);}
        // Page rows, display status and total share the transaction's DB clock.
        const pending=media?`(metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb)`:`status='PENDING' AND "expiresAt">transaction_timestamp()`;
        const filtered=visible+(reviewFilter==='PENDING'?` AND ${pending}`:'');
        const selection=media?`id,title,description,metadata,clock_timestamp() AS "readAt",${revision('"updatedAt"')} AS revision`:`id,summary,status::text AS status,action,result,"proposedByWorkerId","expiresAt",("expiresAt"<=transaction_timestamp()) AS expired,${revision('"updatedAt"')} AS revision`;
        const rows=(await client.query(`SELECT ${selection} FROM ${table} WHERE ${filtered} AND ($5::text IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM ${table} WHERE "projectId"=$1 AND id=$5)) AND ($6::text IS NULL OR id=$6) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[...values,afterReview,reviewId])).rows;
        const total=reviewId?rows.length:(await client.query(`SELECT count(*)::int AS total FROM ${table} WHERE ${filtered}`,values)).rows[0].total;
        return {scope,projectId:context.projectId,reviewAccessStamp,reviewSection,reviewFilter,afterReview,reviewId,records:rows.slice(0,100).map(media?publicFieldEvidence:publicProposal),total,nextCursor:rows.length>100?rows[99].id:null,canReview:reviewer,canApproveProgress:canApproveProgress(member.role)};
      });
    },
    async proposalEvidence(session,context) {
      if(!workspaceId(context.proposalId))throw new WorkspaceError('FIELD_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PROGRESS_PERMISSION_REQUIRED',403);
        const row=await proposal(client,context.projectId,context.proposalId),a=row.action;
        if(!workspaceId(a.taskId)||!Array.isArray(a.evidenceIds)||!a.evidenceIds.length||a.evidenceIds.length>10||new Set(a.evidenceIds).size!==a.evidenceIds.length||a.evidenceIds.some(id=>!workspaceId(id)))throw new WorkspaceError('FIELD_PROPOSAL_UNAVAILABLE',404);
        const linked=[];
        for(const id of a.evidenceIds){
          const record=await evidence(client,context.projectId,id);
          if(record.metadata.fieldOperations.taskId!==a.taskId)throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);
          linked.push(publicFieldEvidence(record));
        }
        return {scope,projectId:context.projectId,proposalId:row.id,proposalRevision:row.revision,evidence:linked};
      });
    },
    async recoveryMaterialCatalog(session,context) {
      if(!workspaceId(context.workerId))throw new WorkspaceError('FIELD_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope,project)=>{
        if(!member.channelProof)throw new WorkspaceError('FIELD_QUERY_INVALID');
        const access=await reviewAccess(client,member,session,context.projectId,scope),owned=access.owned.slice(0,101),inventoryOwned=owned.filter(row=>row.metadata.participant.permissions?.report===true);
        if(!inventoryOwned.some(row=>row.id===context.workerId))throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);
        // Keep every KYC check made by the complete field read, including other
        // owned report participants. A narrower result cannot hide bad proofs.
        for(const row of inventoryOwned)await assertApprovedParticipantKyc(client,{...row,projectId:project.id},{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
        const current=(await client.query(`SELECT id,metadata,${revision('"updatedAt"')} AS revision FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[context.projectId,member.organizationId])).rows;
        if(current.length!==1||current[0].id!==project.id)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
        const catalog=inventoryCatalog(current[0]);
        return {scope,projectId:project.id,projectRevision:current[0].revision,inventory:{version:1,catalogVersion:catalog.catalogVersion,catalogHash:inventoryCatalogHash(catalog),catalogLimit:MATERIAL_CATALOG_LIMIT,materials:catalog.materials}};
      });
    },
    hoursReport(session,context) {
      return run(session,context,false,async(client,member,scope,project)=>{
        if(member.channelProof)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        // Reuse the existing decision predicate and canonical project admission.
        // No identity exception, field-user bypass or new authorization engine.
        if(!canDecideOvertime(member.role))throw new WorkspaceError('FIELD_HOURS_PERMISSION_REQUIRED',403);
        return readFieldHoursReport(client,{project,scope,period:context.period});
      });
    },
    async read(session,context) {
      return run(session,context,false,async(client,member,scope,project)=>{
        if(member.channelProof&&context.journeyCursor!==undefined)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        const reviewer=canReviewField(member.role),workers=(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE "projectId"=$1 AND active=true ORDER BY id LIMIT 101`,[context.projectId])).rows;
        const access=await reviewAccess(client,member,session,context.projectId,scope),owned=access.owned.slice(0,101);
        const selfAttendanceHeads=await ownAttendanceHeads(client,member,context.projectId,owned);
        const ids=reviewer?workers.map(w=>w.id):owned.filter(w=>w.metadata.participant.permissions?.report===true).map(w=>w.id),attendanceIds=reviewer?ids:owned.filter(w=>w.metadata.participant.permissions?.attendance===true).map(w=>w.id);
        const events=(await client.query(`SELECT id,"workerId",metadata,${revision('"checkedInAt"')} AS "recordedAt" FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=ANY($2::text[]) AND metadata->'fieldOperations'->>'version'='1' AND ($3::boolean OR metadata->'fieldOperations'->>'recordedBy'=$4) ORDER BY "checkedInAt" DESC,id DESC LIMIT 101`,[context.projectId,attendanceIds,reviewer,member.actorId])).rows;
        const media=(await client.query(`SELECT id,title,description,metadata,clock_timestamp() AS "readAt",${revision('"updatedAt"')} AS revision FROM public."Incident" WHERE "projectId"=$1 AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND ($2::boolean OR (metadata->'fieldOperations'->>'workerId'=ANY($3::text[]) AND metadata->'fieldOperations'->>'recordedBy'=$4)) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[context.projectId,reviewer,ids,member.actorId])).rows;
        const proposals=(await client.query(`SELECT id,summary,status::text AS status,action,result,"proposedByWorkerId","expiresAt",("expiresAt"<=clock_timestamp()) AS expired,${revision('"updatedAt"')} AS revision FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND action->>'fieldOperationsVersion'='1' AND ($2::boolean OR ("proposedByWorkerId"=ANY($3::text[]) AND action->>'submittedBy'=$4)) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[context.projectId,reviewer,ids,member.actorId])).rows;
        const reports=(await client.query(`SELECT id,title,description,severity::text AS severity,metadata,${revision('"updatedAt"')} AS revision,${revision('"createdAt"')} AS "createdAt" FROM public."Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'version'='1' AND metadata->'siteRegister'->>'type' IN ('ISSUE','MATERIAL_REQUEST') AND ($2::boolean OR (metadata->'siteRegister'->>'workerId'=ANY($3::text[]) AND metadata->'siteRegister'->>'submittedBy'=$4)) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[context.projectId,reviewer,ids,member.actorId])).rows;
        const inventoryOwned=owned.filter(w=>w.metadata.participant.permissions?.report===true);
        if(!canApproveProgress(member.role))for(const row of inventoryOwned)await assertApprovedParticipantKyc(client,{...row,projectId:project.id},{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
        const projectRevision=(await client.query(`SELECT ${revision('"updatedAt"')} AS revision FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[context.projectId,member.organizationId])).rows[0].revision;
        return {scope,projectId:context.projectId,reviewAccessStamp:access.reviewAccessStamp,projectRevision,canConfigure:canApproveProgress(member.role),canReview:reviewer,canApproveProgress:canApproveProgress(member.role),
          ...(canApproveProgress(member.role)?{configurationRevision:project.metadata?.fieldOperations?.configRevision||null}:{}),
          selfWorkers:owned.map(w=>({id:w.id,name:w.name,canReport:w.metadata.participant.permissions?.report===true,canAttendance:w.metadata.participant.permissions?.attendance===true})),selfAttendanceHeads,workers:(reviewer?workers:owned).map(w=>({id:w.id,name:w.name})),
          sectors:project.metadata?.fieldOperations?.sectors?.map(s=>({id:s.id,name:s.name,latitude:s.latitude,longitude:s.longitude,radius:s.radius}))||[],
          inventory:await readInventory(client,member,project,{workerIds:inventoryOwned.map(w=>w.id),reviewer:canApproveProgress(member.role)}),
          ...(member.channelProof?{}:{overtime:await overtime.journeys(client,member,session,project,owned.filter(w=>w.metadata.participant.permissions?.attendance===true).map(w=>w.id),{cursor:context.journeyCursor,scope})}),
          attendance:events.slice(0,100).map(publicEvent),evidence:media.slice(0,100).map(publicFieldEvidence),proposals:proposals.slice(0,100).map(publicProposal),incidents:reports.slice(0,100).filter(r=>r.metadata.siteRegister.type==='ISSUE').map(publicSiteReport),materialRequests:reports.slice(0,100).filter(r=>r.metadata.siteRegister.type==='MATERIAL_REQUEST').map(publicSiteReport),truncated:events.length>100||media.length>100||proposals.length>100||reports.length>100||workers.length>100};
      });
    },
    async save(session,body) {
      const command=normalizeFieldCommand(body),p=command.payload,requestDigest=digest(command);
      return run(session,command,true,async(client,member,scope,project)=>{
        if(member.channelProof&&OVERTIME_ACTIONS.includes(command.action))throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        const id=fieldReceiptId(member.actorId,command.projectId,command.operationId),previous=await prior(client,member,id);
        if(previous){
          if(measurementCancelled(previous)){
            if(![measurementConfigurationAction,measurementCancellationAction].includes(command.action)||previous.metadata.outcome.taskId!==p.taskId)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);
            await recoveryPermission(client,member,session,command.projectId,previous);
            return cancelledMeasurementOutcome(previous,{...command,taskId:p.taskId},scope);
          }
          if(command.action===measurementCancellationAction){
            if(previous.metadata.command!==measurementConfigurationAction||previous.metadata.outcome?.kind!=='MEASUREMENT_CONFIGURATION'||previous.metadata.outcome.task?.id!==p.taskId)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);
            await recoveryPermission(client,member,session,command.projectId,previous);
            return {scope,saved:true,replayed:true,receiptId:id,projectId:command.projectId,operationId:command.operationId,action:measurementConfigurationAction,state:'RECORDED',...await recoveredOutcome(client,command.projectId,previous)};
          }
          if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);await recoveryPermission(client,member,session,command.projectId,previous);return {scope,saved:true,replayed:true,receiptId:id,...(correlated(command.action)?{projectId:command.projectId,operationId:command.operationId,action:command.action,state:'RECORDED'}:{}),...(EXECUTION_ACTIONS.includes(command.action)?{requestDigest}:{}),...await recoveredOutcome(client,command.projectId,previous)};
        }
        const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
        let outcome;
        if(command.action===measurementCancellationAction){
          if(member.channelProof)throw new WorkspaceError('FIELD_MEASUREMENT_WEB_ONLY',403);
          if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PROGRESS_PERMISSION_REQUIRED',403);
          await task(client,command.projectId,p.taskId,true);
          const outcome={kind:'MEASUREMENT_CONFIGURATION_CANCELLED',taskId:p.taskId,taskProgressUnchanged:true};
          const metadata={version:1,projectId:command.projectId,operationId:command.operationId,action:measurementConfigurationAction,command:measurementConfigurationAction,requestDigest:null,outcome};
          await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.operation.recorded','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,command.projectId,JSON.stringify(metadata)]);
          return cancelledMeasurementOutcome({id,metadata},{...command,taskId:p.taskId},scope,false);
        }else if(EXECUTION_ACTIONS.includes(command.action)){
          outcome=await execution.apply({client,member,session,project,command,receiptId:id,at:now.toISOString()});
        }else if(OVERTIME_ACTIONS.includes(command.action)){
          outcome=await overtime.apply({client,member,session,project,command,receiptId:id,at:now.toISOString()});
        }else if(MATERIAL_INVENTORY_ACTIONS.includes(command.action)){
          outcome=await applyInventoryFieldAction({client,member,session,project,command,receiptId:id,at:now.toISOString(),assertWorker:worker,assertTask:task});
        }else if(command.action==='CONFIGURE_SITE') {
          if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
          const row=(await client.query(`SELECT metadata,${revision('"updatedAt"')} AS revision FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[command.projectId,member.organizationId])).rows[0];
          if(row.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
          const tokens=p.sectors.map(s=>({...s,token:randomBytes(32).toString('hex')})),configRevision=newId('config');
          const sectors=tokens.map(({token,...s})=>({...s,qrHash:digest([command.projectId,s.id,configRevision,token])}));
          await client.query(`UPDATE public."Project" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[command.projectId,member.organizationId,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:{...cleanMetadata(row.metadata?.fieldOperations),version:1,configRevision,sectors,configuredBy:member.actorId,configuredAt:now.toISOString()}})]);
          outcome={kind:'CONFIGURATION',qrTokens:tokens.map(s=>({sectorId:s.id,token:s.token})),recordedAt:now.toISOString()};
        }else if(command.action==='ATTENDANCE') {
          await worker(client,member,session,command.projectId,p.workerId,'attendance');
          await assertPersonWorksiteJourney(client,member,command.projectId,p.workerId,p.eventType);
          const selected=config(project),sector=selected.sectors.find(s=>s.id===p.sectorId);if(!sector)throw new WorkspaceError('FIELD_SECTOR_UNAVAILABLE',404);
          const previousEvent=await latest(client,command.projectId,p.workerId),last=previousEvent?.metadata.fieldOperations;
          if((previousEvent?.id||null)!==p.expectedEventId)throw new WorkspaceError('ATTENDANCE_REVISION_CHANGED',409);
          const transition=fieldTransition(p.eventType,last),qrValid=p.qrToken!==null&&digest([command.projectId,p.sectorId,selected.configRevision,p.qrToken])===sector.qrHash;
          if(p.qrToken!==null&&!qrValid)throw new WorkspaceError('FIELD_QR_INVALID',422);
          const needsLocation=['CHECK_IN','CHECK_OUT'].includes(p.eventType),location=needsLocation?evaluateFieldLocation(p.location,sector,now):null;
          if(!needsLocation&&p.location!==null)throw new WorkspaceError('FIELD_INPUT_INVALID');
          const verification=needsLocation?(location.verificationStatus==='VERIFIED'&&qrValid?'VERIFIED':'REVIEW_REQUIRED'):'NOT_REQUIRED';
          const eventId=newId('attendance'),details={version:1,eventType:p.eventType,phase:transition.phase,shiftId:p.eventType==='CHECK_IN'?newId('shift'):last.shiftId,sequence:(last?.sequence||0)+1,previousEventId:previousEvent?.id||null,sectorId:p.sectorId,sectorName:sector.name,configRevision:selected.configRevision,qrStatus:qrValid?'MATCHED':'NOT_PROVIDED',verificationStatus:verification,location,recordedBy:member.actorId,recordedAt:now.toISOString(),source:member.channelProof?.provider===META_DEMO_PILOT_PROTOCOL.provider?'meta-demo-pilot':member.channelProof?'meta-customer':'account',review:null};
          await client.query(`INSERT INTO public."AttendanceEntry"(id,"projectId","workerId",status,latitude,longitude,"distanceMeters",source,"checkedInAt",metadata) VALUES($1,$2,$3,$4::"AttendanceStatus",$5,$6,$7,'account-field',clock_timestamp(),$8::jsonb)`,[eventId,command.projectId,p.workerId,verification==='REVIEW_REQUIRED'?'OUTSIDE_GEOFENCE':'PRESENT',location?.latitude??null,location?.longitude??null,location?.distanceMeters??null,JSON.stringify({fieldOperations:details})]);
          outcome={kind:'ATTENDANCE',event:{id:eventId,workerId:p.workerId,...details}};
        }else if(['REPORT_INCIDENT','REQUEST_MATERIAL'].includes(command.action)) {
          await worker(client,member,session,command.projectId,p.workerId);
          const sector=config(project).sectors.find(s=>s.id===p.sectorId);if(!sector)throw new WorkspaceError('FIELD_SECTOR_UNAVAILABLE',404);
          if(p.taskId!==null)await task(client,command.projectId,p.taskId);
          for(const eid of p.evidenceIds){const row=await evidence(client,command.projectId,eid),e=row.metadata.fieldOperations;if(e.workerId!==p.workerId||e.taskId!==p.taskId||e.review?.decision==='REJECT')throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);}
          const incident=command.action==='REPORT_INCIDENT',row=await insertSiteReport(client,{id:newId('incident'),projectId:command.projectId,actorId:member.actorId,type:incident?'ISSUE':'MATERIAL_REQUEST',title:incident?p.title:p.name,description:incident?p.description:p.reason,severity:incident?p.severity:'INFO',sector:sector.name,material:incident?null:p.name,quantity:incident?null:p.quantity,unit:incident?null:p.unit,origin:member.channelProof?.provider===META_DEMO_PILOT_PROTOCOL.provider?'participant-whatsapp-demo':member.channelProof?'participant-whatsapp':'participant-field',workerId:p.workerId,taskId:p.taskId,evidenceIds:p.evidenceIds});
          outcome={kind:incident?'INCIDENT_REPORT':'MATERIAL_REQUEST',report:publicSiteReport(row),purchaseAuthorized:false,stockChanged:false};
        }else if(command.action==='REVIEW_ATTENDANCE') {
          if(!canReviewField(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
          const row=(await client.query(`SELECT id,metadata,"workerId" FROM public."AttendanceEntry" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[p.eventId,command.projectId])).rows[0],e=row?.metadata?.fieldOperations;
          if(e?.version!==1)throw new WorkspaceError('FIELD_ATTENDANCE_UNAVAILABLE',404);
          if(e.verificationStatus!=='REVIEW_REQUIRED'||e.review)throw new WorkspaceError('FIELD_ALREADY_REVIEWED',409);
          if(e.recordedBy===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
          const next={...e,review:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:now.toISOString()}};
          await client.query(`UPDATE public."AttendanceEntry" SET metadata=$3::jsonb WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:next})]);
          outcome={kind:'ATTENDANCE_REVIEW',event:{id:row.id,workerId:row.workerId,...next}};
        }else if(command.action==='REVIEW_EVIDENCE') {
          if(!canReviewField(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
          const row=await evidence(client,command.projectId,p.evidenceId,true),e=row.metadata.fieldOperations;
          if(row.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
          if(e.review)throw new WorkspaceError('FIELD_ALREADY_REVIEWED',409);
          if(e.processing?.status==='RUNNING'){
            const processing=e.processing,expiresAt=Date.parse(processing.expiresAt),stages=processing.usage?.version===2&&Array.isArray(processing.usage.stages)?processing.usage.stages:[];
            if(!usage||!Number.isFinite(expiresAt)||expiresAt>now.getTime()||!stages.length)throw new WorkspaceError('FIELD_MEDIA_PROCESSING',409);
            if(e.recordedBy===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
            let dispatched=false;
            for(const stage of stages){const proof=await usage.resourceProjection(client,member,{receiptId:stage?.usage?.receiptId,resourceType:'Incident',resourceId:row.id,projectId:command.projectId});if(['DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED'].includes(proof.state))dispatched=true;}
            if(!dispatched)throw new WorkspaceError('FIELD_MEDIA_PROCESSING',409);
          }
          if(e.recordedBy===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
          const next={...e,review:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:now.toISOString()}};
          await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,status=$4,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:next}),p.decision==='APPROVE'?'resolved':'rejected']);
          outcome={kind:'EVIDENCE_REVIEW',evidence:publicFieldEvidence(await evidence(client,command.projectId,row.id))};
        }else if(command.action==='CONFIGURE_PROGRESS_MEASUREMENT') {
          if(member.channelProof)throw new WorkspaceError('FIELD_MEASUREMENT_WEB_ONLY',403);
          if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PROGRESS_PERMISSION_REQUIRED',403);
          const current=await task(client,command.projectId,p.taskId,true);
          if(current.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
          const configured=measurementGuard(()=>assertMeasurementConfiguration(current,{baseline:p.baseline,unit:p.unit}));
          await expireProgress(client,member,command,p.taskId);
          const pending=(await client.query(`SELECT id FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND action->>'fieldOperationsVersion'='1' AND action->>'taskId'=$2 LIMIT 1`,[command.projectId,p.taskId])).rows;
          if(pending.length)throw new WorkspaceError('FIELD_PROGRESS_REVIEW_PENDING',409);
          const measurement={version:TASK_MEASUREMENT_VERSION,definitionId:newId('measurement'),baseline:configured.baseline,unit:configured.unit,sourceReference:p.sourceReference,configuredBy:member.actorId,configuredAt:now.toISOString()};
          const metadata={...cleanMetadata(current.metadata),fieldOperations:{...cleanMetadata(current.metadata?.fieldOperations),version:1,measurement}};
          await client.query(`UPDATE public."Task" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[current.id,command.projectId,JSON.stringify(metadata)]);
          outcome={kind:'MEASUREMENT_CONFIGURATION',task:publicMeasuredTask(await task(client,command.projectId,current.id)),sourceReference:p.sourceReference,reason:p.reason,recordedAt:now.toISOString(),taskProgressUnchanged:true};
        }else if(command.action==='PROPOSE_PROGRESS') {
          await worker(client,member,session,command.projectId,p.workerId);
          const current=await task(client,command.projectId,p.taskId,true);
          if(current.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
          const derived=p.measurement?measurementGuard(()=>deriveTaskMeasurement(current,p.measurement)):null;
          if(!derived&&current.metadata?.fieldOperations?.measurement)throw new WorkspaceError('FIELD_MEASUREMENT_REQUIRED',409);
          const measured=derived?{...p,progress:derived.progress,quantity:derived.executed,baseline:derived.baseline,unit:derived.unit,measurement:derived}:p;
          assertProgressContinuity(current,measured);
          for(const eid of p.evidenceIds){const e=await evidence(client,command.projectId,eid);if(e.metadata.fieldOperations.taskId!==p.taskId||e.metadata.fieldOperations.review?.decision!=='APPROVE')throw new WorkspaceError('FIELD_EVIDENCE_NOT_APPROVED',409);}
          await expireProgress(client,member,command,p.taskId);
          const pending=(await client.query(`SELECT id FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND action->>'fieldOperationsVersion'='1' AND action->>'taskId'=$2 LIMIT 1`,[command.projectId,p.taskId])).rows;
          if(pending.length)throw new WorkspaceError('FIELD_PROGRESS_REVIEW_PENDING',409);
          const proposalId=newId('proposal'),action={...measured,fieldOperationsVersion:1,submittedBy:member.actorId,submittedAt:now.toISOString()};
          await client.query(`INSERT INTO public."OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId","confirmationCode",type,status,summary,action,precondition,"classifierVersion","transcriptSha256","expiresAt","updatedAt") VALUES($1,$2,$3,'account-field',$4,$5,'TASK_PROGRESS','PENDING',$6,$7::jsonb,$8::jsonb,'human-field-v1',$9,clock_timestamp()+interval '7 days',clock_timestamp())`,[proposalId,command.projectId,p.workerId,digest([member.actorId,command.operationId]),randomBytes(5).toString('hex').toUpperCase(),current.title+' · '+measured.progress+'%',JSON.stringify(action),JSON.stringify({taskRevision:current.revision,progress:current.progress}),digest(p.reason)]);
          outcome={kind:'PROGRESS_PROPOSAL',proposal:publicProposal(await proposal(client,command.projectId,proposalId)),taskUnchanged:true};
        }else {
          if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PROGRESS_PERMISSION_REQUIRED',403);
          const row=await proposal(client,command.projectId,p.proposalId,true),a=row.action;
          if(row.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
          if(row.status==='EXPIRED'||row.status==='PENDING'&&row.expired)throw new WorkspaceError('FIELD_PROPOSAL_EXPIRED',409);
          if(row.status!=='PENDING')throw new WorkspaceError('FIELD_ALREADY_REVIEWED',409);
          if(a.submittedBy===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
          let updated=null;
          if(p.decision==='APPROVE') {
            const current=await task(client,command.projectId,a.taskId,true);
            if(current.revision!==row.precondition?.taskRevision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
            if(a.measurement){
              assertMeasuredProposalSnapshot(current,a);
            }else if(current.metadata?.fieldOperations?.measurement)throw new WorkspaceError('FIELD_MEASUREMENT_REQUIRED',409);
            assertProgressContinuity(current,a);
            for(const eid of a.evidenceIds){const e=await evidence(client,command.projectId,eid);if(e.metadata.fieldOperations.taskId!==a.taskId||e.metadata.fieldOperations.review?.decision!=='APPROVE')throw new WorkspaceError('FIELD_EVIDENCE_NOT_APPROVED',409);}
            const metadata={...cleanMetadata(current.metadata),fieldOperations:{...cleanMetadata(current.metadata?.fieldOperations),version:1,approvedProposalId:row.id,approvedBy:member.actorId,approvedAt:now.toISOString(),...(a.quantity!==null?{quantity:{executed:a.quantity,baseline:a.baseline,unit:a.unit}}:{})}};
            await client.query(`UPDATE public."Task" SET progress=$3,status=$4::"TaskStatus",metadata=$5::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[current.id,command.projectId,a.progress,current.status==='BLOCKED'?'BLOCKED':a.progress===100?'DONE':a.progress>0?'IN_PROGRESS':'BACKLOG',JSON.stringify(metadata)]);
            updated=publicMeasuredTask(await task(client,command.projectId,current.id));
          }
          const result={fieldOperations:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:now.toISOString(),task:updated,taskUpdated:Boolean(updated)}};
          await client.query(`UPDATE public."OperationalProposal" SET status=$3::"OperationalProposalStatus",result=$4::jsonb,"resolverProvider"='account-field',"resolverExternalId"=$5,"resolvedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,p.decision==='APPROVE'?'APPLIED':'REJECTED',JSON.stringify(result),digest([member.actorId,command.operationId])]);
          outcome={kind:'PROGRESS_DECISION',proposal:publicProposal(await proposal(client,command.projectId,row.id)),task:updated};
        }
        const recorded=await record(client,member,command,outcome,requestDigest);
        if(EXECUTION_ACTIONS.includes(command.action))await execution.finalize(client,outcome);
        return {scope,...recorded};
      });
    },
    status(session,context) {
      if(!operationId(context.operationId))throw new WorkspaceError('FIELD_INPUT_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const row=await prior(client,member,fieldReceiptId(member.actorId,context.projectId,context.operationId));
        if(member.channelProof&&OVERTIME_ACTIONS.includes(row?.metadata?.command))throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        if(row)await recoveryPermission(client,member,session,context.projectId,row);
        if(measurementCancelled(row))return cancelledMeasurementOutcome(row,context,scope);
        return row?{scope,state:'RECORDED',saved:true,replayed:true,receiptId:row.id,...(correlated(row.metadata.command)?{projectId:context.projectId,operationId:context.operationId,action:row.metadata.command}:{}),...(EXECUTION_ACTIONS.includes(row.metadata.command)?{requestDigest:row.metadata.requestDigest}:{}),...await recoveredOutcome(client,context.projectId,row)}:{scope,projectId:context.projectId,operationId:context.operationId,state:'NOT_OBSERVED',definitive:false};
      });
    },
    ownConsumptions(session,context){return run(session,context,true,async(client,member,scope,project)=>{await worker(client,member,session,project.id,context.workerId,'report');return {scope,projectId:project.id,workerId:context.workerId,...await readOwnConsumptions(client,member,project,{workerId:context.workerId,afterConsumption:context.afterConsumption??null,consumptionId:context.consumptionId??null})};});},
    ownReports(session,context){return run(session,context,true,async(client,member,scope,project)=>{await worker(client,member,session,project.id,context.workerId,'report');return {scope,projectId:project.id,workerId:context.workerId,...await readOwnFieldReports(client,member,project,{workerId:context.workerId,section:context.section,afterReport:context.afterReport??null,reportId:context.reportId??null})};});},
    inventoryHistory(session,context){return run(session,context,context.inventoryFilter===undefined,async(client,member,scope,project)=>{const reviewer=canApproveProgress(member.role);if((context.inventoryFilter!==undefined||context.afterMovement||context.afterAdjustment||context.adjustmentId)&&!reviewer)throw new WorkspaceError('INVENTORY_MANAGE_REQUIRED',403);const owned=reviewer?[]:(await reviewAccess(client,member,session,project.id,scope)).owned.filter(w=>w.metadata.participant.permissions?.report===true);for(const row of owned)await worker(client,member,session,project.id,row.id,'report');return {scope,projectId:project.id,inventory:await readInventory(client,member,project,{reviewer,workerIds:owned.map(w=>w.id),after:context.afterMovement,afterConsumption:context.afterConsumption,consumptionId:context.consumptionId,afterAdjustment:context.afterAdjustment,adjustmentId:context.adjustmentId,inventoryFilter:context.inventoryFilter})};});},
    executionMandate(session,context){return run(session,context,false,async(client,member,scope,project)=>({scope,projectId:project.id,readOnly:true,mandate:await execution.readMandate(client,member,session,project,context.executionMandateId)}));},
    executionView(session,context){return run(session,context,false,(client,member,scope,project)=>execution.readView(client,member,session,project,scope));},
    // Media provider I/O is performed outside transactions. Every callback still
    // enters the same verified project transaction and rechecks actor/permissions.
    // Media's organization reservation must precede the canonical project lock.
    // Its schemas do not admit the business action commands handled by run.
    mediaTransaction:(session,context,writable,callback,beforeProject)=>workspace.projectOperation(session,context,writable,callback,beforeProject),assertWorker:worker,readEvidence:evidence,readTask:task,
  };
}
