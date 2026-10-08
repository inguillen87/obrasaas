import { randomUUID, randomBytes } from 'node:crypto';
import { WorkspaceError, workspaceId, operationId, digest } from './workspace-policy.mjs';
import { cleanMetadata } from './site-register-policy.mjs';
import { normalizeFieldCommand, fieldTransition, evaluateFieldLocation, fieldReceiptId, canReviewField, canApproveProgress } from './field-operations-policy.mjs';
import { insertSiteReport, publicSiteReport } from './site-register-store.mjs';
import { META_DEMO_PILOT_PROTOCOL } from './meta-cloud-protocol.mjs';
import { compareProgressMeasurementQuantities } from './progress-measurement-quantity.js';
import {MATERIAL_INVENTORY_ACTIONS,applyInventoryFieldAction,readInventory,readConsumption,readStockAdjustment,lockStockAdjustmentProposer} from './material-inventory.mjs';
import {lockPersonWorksiteJourney,assertPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {OVERTIME_ACTIONS,canDecideOvertime} from './field-overtime-policy.mjs';
import {createFieldOvertime} from './field-overtime-store.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';

const revision = name => `to_char(${name},'YYYY-MM-DD"T"HH24:MI:SS.US')`;
const newId = prefix => prefix+'_'+randomUUID().replaceAll('-','');
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
  taskId:row.action.taskId,workerId:row.proposedByWorkerId,progress:row.action.progress,quantity:row.action.quantity,baseline:row.action.baseline,unit:row.action.unit,reason:row.action.reason,evidenceIds:row.action.evidenceIds,
  result:row.result?.fieldOperations||null});
export function createFieldOperations({workspace,assertParticipant}) {
  const overtime=createFieldOvertime({assertWorker:worker});
  const correlated=action=>MATERIAL_INVENTORY_ACTIONS.includes(action)||OVERTIME_ACTIONS.includes(action);
  const run=(session,context,writable,callback)=>workspace.projectOperation(session,context,writable,callback,writable&&context.action==='ATTENDANCE'?lockPersonWorksiteJourney:writable&&OVERTIME_ACTIONS.includes(context.action)?(client,member)=>overtime.beforeProject(client,member,context):writable&&context.action==='DECIDE_STOCK_ADJUSTMENT'&&context.payload?.decision==='APPROVE'?async(client,member)=>{if(!canApproveProgress(member.role))throw new WorkspaceError('INVENTORY_MANAGE_REQUIRED',403);if(member.channelProof)throw new WorkspaceError('INVENTORY_ADJUSTMENT_WEB_ONLY',403);if(!await prior(client,member,fieldReceiptId(member.actorId,context.projectId,context.operationId)))await lockStockAdjustmentProposer(client,member,context.projectId,context.payload.proposalId);}:undefined);
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
    const row=(await client.query(`SELECT id,title,progress,status::text AS status,metadata,${revision('"updatedAt"')} AS revision FROM public."Task" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0];
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
    if(['CONFIGURE_OVERTIME','DECIDE_OVERTIME'].includes(action)&&!canDecideOvertime(member.role))throw new WorkspaceError('OVERTIME_DECISION_PERMISSION_REQUIRED',403);
    if(['PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'].includes(action)&&member.channelProof)throw new WorkspaceError('INVENTORY_ADJUSTMENT_WEB_ONLY',403);
    if(['CONFIGURE_SITE','DECIDE_PROGRESS','ADD_MATERIAL','DECIDE_CONSUMPTION','REVERSE_CONSUMPTION','PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'].includes(action)&&!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
    if(['REVIEW_ATTENDANCE','REVIEW_EVIDENCE'].includes(action)&&!canReviewField(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
    if(['ATTENDANCE','PROPOSE_PROGRESS','REPORT_INCIDENT','REQUEST_MATERIAL','PROPOSE_CONSUMPTION','PROPOSE_OVERTIME'].includes(action)){
      const workerId=receipt.metadata.outcome.event?.workerId||receipt.metadata.outcome.proposal?.workerId||receipt.metadata.outcome.report?.workerId||receipt.metadata.outcome.consumption?.workerId||receipt.metadata.outcome.overtime?.workerId,permission=['ATTENDANCE','PROPOSE_OVERTIME'].includes(action)?'attendance':'report';
      // The project lock serializes writable replay against participant changes.
      // Read-only recovery keeps its snapshot without trying to lock the worker.
      const owned=(await client.query(`SELECT id,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'version'='1' AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'kyc'->>'status'='APPROVED' AND metadata->'participant'->'permissions'->>$4='true'`,[workerId,projectId,session.userId,permission])).rows;
      if(owned.length!==1)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);
      await assertApprovedParticipantKyc(client,{...owned[0],projectId},{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
    }
  }
  async function recoveredOutcome(client,projectId,receipt) {
    const outcome=receipt.metadata.outcome;
    if(outcome.overtime)return overtime.recover(client,projectId,outcome);
    if(outcome.consumption?.id)return {...outcome,consumption:(await readConsumption(client,projectId,outcome.consumption.id)).consumption};
    if(outcome.adjustment?.id)return {...outcome,adjustment:(await readStockAdjustment(client,projectId,outcome.adjustment.id)).adjustment};
    if(outcome.report?.id){const row=(await client.query(`SELECT id,title,description,severity::text AS severity,metadata,${revision('"updatedAt"')} AS revision,${revision('"createdAt"')} AS "createdAt" FROM public."Incident" WHERE id=$1 AND "projectId"=$2`,[outcome.report.id,projectId])).rows[0];if(!row)throw new WorkspaceError('SITE_REPORT_UNAVAILABLE',404);return {...outcome,report:publicSiteReport(row)};}
    const currentProposal=outcome.proposal?.id?publicProposal(await proposal(client,projectId,outcome.proposal.id)):null;
    if(outcome.kind==='PROGRESS_DECISION'&&outcome.task){
      const current=await task(client,projectId,outcome.task.id);delete current.metadata;
      return {...outcome,...(currentProposal?{proposal:currentProposal}:{}),task:current,decisionTaskSnapshot:outcome.task};
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
    return {saved:true,replayed:false,receiptId:id,...(Object.keys(correlation).length?{...correlation,state:'RECORDED'}:{}),...outcome};
  }
  function config(project) {
    const c=project.metadata?.fieldOperations;
    if(c?.version!==1||!Array.isArray(c.sectors))throw new WorkspaceError('FIELD_SITE_NOT_CONFIGURED',409);return c;
  }
  const latest=async(client,projectId,workerId)=>(await client.query(`SELECT id,"workerId",metadata,${revision('"checkedInAt"')} AS "recordedAt" FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=$2 AND metadata->'fieldOperations'->>'version'='1' ORDER BY (metadata->'fieldOperations'->>'sequence')::int DESC,id DESC LIMIT 1`,[projectId,workerId])).rows[0]||null;
  return {
    shift(session,context){return run(session,context,false,async(client,member,scope,project)=>({scope,...await overtime.readShift(client,member,session,project,context)}));},
    reviewPage(session,context) {
      const {reviewSection,reviewFilter,afterReview=null,reviewId=null,reviewAccessStamp:expectedAccess}=context;
      if(!['EVIDENCE','PROGRESS'].includes(reviewSection)||!['PENDING','ALL'].includes(reviewFilter)||[afterReview,reviewId].some(value=>value!==null&&!workspaceId(value))||afterReview&&reviewId||reviewId&&reviewFilter!=='ALL'||(afterReview||reviewId||expectedAccess!==undefined)&&!/^[a-f0-9]{64}$/.test(expectedAccess||''))throw new WorkspaceError('FIELD_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const access=await reviewAccess(client,member,session,context.projectId,scope),{reviewAccessStamp}=access;
        if(expectedAccess!==undefined&&expectedAccess!==reviewAccessStamp)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
        const reviewer=canReviewField(member.role),owned=access.owned.map(row=>row.id);
        const media=reviewSection==='EVIDENCE',table=media?'public."Incident"':'public."OperationalProposal"';
        const kind=media?`metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE'`:`type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND action->>'fieldOperationsVersion'='1'`;
        const owner=media?`metadata->'fieldOperations'->>'workerId'`:`"proposedByWorkerId"`;
        const visible=`"projectId"=$1 AND ${kind} AND ($2::boolean OR ${owner}=ANY($3::text[]))`,values=[context.projectId,reviewer,owned];
        // A cursor is a canonical row reference, not a trusted client timestamp.
        // It remains usable when its decision changes between page requests.
        if(afterReview||reviewId){const found=(await client.query(`SELECT id FROM ${table} WHERE ${visible} AND id=$4`,[...values,afterReview||reviewId])).rows;if(found.length!==1)throw new WorkspaceError('FIELD_REVIEW_CURSOR_UNAVAILABLE',404);}
        // Page rows, display status and total share the transaction's DB clock.
        const pending=media?`(metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb)`:`status='PENDING' AND "expiresAt">transaction_timestamp()`;
        const filtered=visible+(reviewFilter==='PENDING'?` AND ${pending}`:'');
        const selection=media?`id,title,description,metadata,clock_timestamp() AS "readAt",${revision('"updatedAt"')} AS revision`:`id,summary,status::text AS status,action,result,"proposedByWorkerId","expiresAt",("expiresAt"<=transaction_timestamp()) AS expired,${revision('"updatedAt"')} AS revision`;
        const rows=(await client.query(`SELECT ${selection} FROM ${table} WHERE ${filtered} AND ($4::text IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM ${table} WHERE "projectId"=$1 AND id=$4)) AND ($5::text IS NULL OR id=$5) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[...values,afterReview,reviewId])).rows;
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
    async read(session,context) {
      return run(session,context,false,async(client,member,scope,project)=>{
        if(member.channelProof&&context.journeyCursor!==undefined)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        const reviewer=canReviewField(member.role),workers=(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE "projectId"=$1 AND active=true ORDER BY id LIMIT 101`,[context.projectId])).rows;
        const access=await reviewAccess(client,member,session,context.projectId,scope),owned=access.owned.slice(0,101);
        const ids=reviewer?workers.map(w=>w.id):owned.map(w=>w.id);
        const events=(await client.query(`SELECT id,"workerId",metadata,${revision('"checkedInAt"')} AS "recordedAt" FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=ANY($2::text[]) AND metadata->'fieldOperations'->>'version'='1' ORDER BY "checkedInAt" DESC,id DESC LIMIT 101`,[context.projectId,ids])).rows;
        const media=(await client.query(`SELECT id,title,description,metadata,clock_timestamp() AS "readAt",${revision('"updatedAt"')} AS revision FROM public."Incident" WHERE "projectId"=$1 AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND ($2::boolean OR metadata->'fieldOperations'->>'workerId'=ANY($3::text[])) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[context.projectId,reviewer,ids])).rows;
        const proposals=(await client.query(`SELECT id,summary,status::text AS status,action,result,"proposedByWorkerId","expiresAt",("expiresAt"<=clock_timestamp()) AS expired,${revision('"updatedAt"')} AS revision FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND action->>'fieldOperationsVersion'='1' AND ($2::boolean OR "proposedByWorkerId"=ANY($3::text[])) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[context.projectId,reviewer,ids])).rows;
        const reports=(await client.query(`SELECT id,title,description,severity::text AS severity,metadata,${revision('"updatedAt"')} AS revision,${revision('"createdAt"')} AS "createdAt" FROM public."Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'version'='1' AND metadata->'siteRegister'->>'type' IN ('ISSUE','MATERIAL_REQUEST') AND ($2::boolean OR metadata->'siteRegister'->>'workerId'=ANY($3::text[])) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[context.projectId,reviewer,ids])).rows;
        const projectRevision=(await client.query(`SELECT ${revision('"updatedAt"')} AS revision FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[context.projectId,member.organizationId])).rows[0].revision;
        return {scope,projectId:context.projectId,reviewAccessStamp:access.reviewAccessStamp,projectRevision,canConfigure:canApproveProgress(member.role),canReview:reviewer,canApproveProgress:canApproveProgress(member.role),
          ...(canApproveProgress(member.role)?{configurationRevision:project.metadata?.fieldOperations?.configRevision||null}:{}),
          selfWorkers:owned.map(w=>({id:w.id,name:w.name,canReport:w.metadata.participant.permissions?.report===true,canAttendance:w.metadata.participant.permissions?.attendance===true})),workers:(reviewer?workers:owned).map(w=>({id:w.id,name:w.name})),
          sectors:project.metadata?.fieldOperations?.sectors?.map(s=>({id:s.id,name:s.name,latitude:s.latitude,longitude:s.longitude,radius:s.radius}))||[],
          inventory:await readInventory(client,member,project,{workerIds:owned.map(w=>w.id),reviewer:canApproveProgress(member.role)}),
          ...(member.channelProof?{}:{overtime:await overtime.journeys(client,member,session,project,owned.filter(w=>w.metadata.participant.permissions?.attendance===true).map(w=>w.id),{cursor:context.journeyCursor,scope})}),
          attendance:events.slice(0,100).map(publicEvent),evidence:media.slice(0,100).map(publicFieldEvidence),proposals:proposals.slice(0,100).map(publicProposal),incidents:reports.slice(0,100).filter(r=>r.metadata.siteRegister.type==='ISSUE').map(publicSiteReport),materialRequests:reports.slice(0,100).filter(r=>r.metadata.siteRegister.type==='MATERIAL_REQUEST').map(publicSiteReport),truncated:events.length>100||media.length>100||proposals.length>100||reports.length>100||workers.length>100};
      });
    },
    async save(session,body) {
      const command=normalizeFieldCommand(body),p=command.payload,requestDigest=digest(command);
      return run(session,command,true,async(client,member,scope,project)=>{
        if(member.channelProof&&OVERTIME_ACTIONS.includes(command.action))throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        const id=fieldReceiptId(member.actorId,command.projectId,command.operationId),previous=await prior(client,member,id);
        if(previous){if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);await recoveryPermission(client,member,session,command.projectId,previous);return {scope,saved:true,replayed:true,receiptId:id,...(correlated(command.action)?{projectId:command.projectId,operationId:command.operationId,action:command.action,state:'RECORDED'}:{}),...await recoveredOutcome(client,command.projectId,previous)};}
        const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
        let outcome;
        if(OVERTIME_ACTIONS.includes(command.action)){
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
          if(e.processing?.status==='RUNNING')throw new WorkspaceError('FIELD_MEDIA_PROCESSING',409);
          if(e.recordedBy===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
          const next={...e,review:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:now.toISOString()}};
          await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,status=$4,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:next}),p.decision==='APPROVE'?'resolved':'rejected']);
          outcome={kind:'EVIDENCE_REVIEW',evidence:publicFieldEvidence(await evidence(client,command.projectId,row.id))};
        }else if(command.action==='PROPOSE_PROGRESS') {
          await worker(client,member,session,command.projectId,p.workerId);
          const current=await task(client,command.projectId,p.taskId,true);
          if(current.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
          assertProgressContinuity(current,p);
          for(const eid of p.evidenceIds){const e=await evidence(client,command.projectId,eid);if(e.metadata.fieldOperations.taskId!==p.taskId||e.metadata.fieldOperations.review?.decision!=='APPROVE')throw new WorkspaceError('FIELD_EVIDENCE_NOT_APPROVED',409);}
          await expireProgress(client,member,command,p.taskId);
          const pending=(await client.query(`SELECT id FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND action->>'fieldOperationsVersion'='1' AND action->>'taskId'=$2 LIMIT 1`,[command.projectId,p.taskId])).rows;
          if(pending.length)throw new WorkspaceError('FIELD_PROGRESS_REVIEW_PENDING',409);
          const proposalId=newId('proposal'),action={...p,fieldOperationsVersion:1,submittedBy:member.actorId,submittedAt:now.toISOString()};
          await client.query(`INSERT INTO public."OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId","confirmationCode",type,status,summary,action,precondition,"classifierVersion","transcriptSha256","expiresAt","updatedAt") VALUES($1,$2,$3,'account-field',$4,$5,'TASK_PROGRESS','PENDING',$6,$7::jsonb,$8::jsonb,'human-field-v1',$9,clock_timestamp()+interval '7 days',clock_timestamp())`,[proposalId,command.projectId,p.workerId,digest([member.actorId,command.operationId]),randomBytes(5).toString('hex').toUpperCase(),current.title+' · '+p.progress+'%',JSON.stringify(action),JSON.stringify({taskRevision:current.revision,progress:current.progress}),digest(p.reason)]);
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
            assertProgressContinuity(current,a);
            for(const eid of a.evidenceIds){const e=await evidence(client,command.projectId,eid);if(e.metadata.fieldOperations.taskId!==a.taskId||e.metadata.fieldOperations.review?.decision!=='APPROVE')throw new WorkspaceError('FIELD_EVIDENCE_NOT_APPROVED',409);}
            const metadata={...cleanMetadata(current.metadata),fieldOperations:{version:1,approvedProposalId:row.id,approvedBy:member.actorId,approvedAt:now.toISOString(),...(a.quantity!==null?{quantity:{executed:a.quantity,baseline:a.baseline,unit:a.unit}}:{})}};
            await client.query(`UPDATE public."Task" SET progress=$3,status=$4::"TaskStatus",metadata=$5::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[current.id,command.projectId,a.progress,current.status==='BLOCKED'?'BLOCKED':a.progress===100?'DONE':a.progress>0?'IN_PROGRESS':'BACKLOG',JSON.stringify(metadata)]);
            updated=await task(client,command.projectId,current.id);delete updated.metadata;
          }
          const result={fieldOperations:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:now.toISOString(),task:updated,taskUpdated:Boolean(updated)}};
          await client.query(`UPDATE public."OperationalProposal" SET status=$3::"OperationalProposalStatus",result=$4::jsonb,"resolverProvider"='account-field',"resolverExternalId"=$5,"resolvedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,p.decision==='APPROVE'?'APPLIED':'REJECTED',JSON.stringify(result),digest([member.actorId,command.operationId])]);
          outcome={kind:'PROGRESS_DECISION',proposal:publicProposal(await proposal(client,command.projectId,row.id)),task:updated};
        }
        return {scope,...await record(client,member,command,outcome,requestDigest)};
      });
    },
    status(session,context) {
      if(!operationId(context.operationId))throw new WorkspaceError('FIELD_INPUT_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const row=await prior(client,member,fieldReceiptId(member.actorId,context.projectId,context.operationId));
        if(member.channelProof&&OVERTIME_ACTIONS.includes(row?.metadata?.command))throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
        if(row)await recoveryPermission(client,member,session,context.projectId,row);
        return row?{scope,state:'RECORDED',saved:true,replayed:true,receiptId:row.id,...(correlated(row.metadata.command)?{projectId:context.projectId,operationId:context.operationId,action:row.metadata.command}:{}),...await recoveredOutcome(client,context.projectId,row)}:{scope,projectId:context.projectId,operationId:context.operationId,state:'NOT_OBSERVED',definitive:false};
      });
    },
    inventoryHistory(session,context){return run(session,context,false,async(client,member,scope,project)=>{const reviewer=canApproveProgress(member.role);if((context.afterMovement||context.afterAdjustment||context.adjustmentId)&&!reviewer)throw new WorkspaceError('INVENTORY_MANAGE_REQUIRED',403);const owned=reviewer?[]:(await client.query(`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND active=true AND metadata->'participant'->>'version'='1' AND metadata->'participant'->>'clerkUserId'=$2 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'kyc'->>'status'='APPROVED' ORDER BY id LIMIT 101`,[project.id,session.userId])).rows.map(w=>w.id);return {scope,projectId:project.id,inventory:await readInventory(client,member,project,{reviewer,workerIds:owned,after:context.afterMovement,afterConsumption:context.afterConsumption,consumptionId:context.consumptionId,afterAdjustment:context.afterAdjustment,adjustmentId:context.adjustmentId})};});},
    // Media provider I/O is performed outside transactions. Every callback still
    // enters the same verified project transaction and rechecks actor/permissions.
    mediaTransaction:run,assertWorker:worker,readEvidence:evidence,readTask:task,
  };
}
