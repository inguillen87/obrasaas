import {randomUUID} from 'node:crypto';
import {WorkspaceError,workspaceId,digest,portfolioAccess} from './workspace-policy.mjs';
import {cleanMetadata} from './site-register-policy.mjs';
import {canReviewField} from './field-operations-policy.mjs';
import {canDecideOvertime,overtimeConfiguration,fieldOvertimeJourneyCursor,parseFieldOvertimeJourneyCursor} from './field-overtime-policy.mjs';
import {summarizeFieldShift} from './field-shift-summary.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';

const eventColumns='id,"projectId","workerId",metadata';
const unavailable=()=>{throw new WorkspaceError('OVERTIME_SHIFT_UNAVAILABLE',404);};
const proposalDigest=value=>digest([value.proposalRevision,value.proposalReceiptId,value.workerId,value.shiftId,value.closingEventId,value.requestedExtraMs,value.reason,value.submittedBy,value.submittedAt,value.sourceDigest,value.configurationDigest,value.beneficiaryAccessDigest]);
const validDigest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const validReceipt=value=>typeof value==='string'&&/^field_[a-f0-9]{64}$/.test(value);
const validUtc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const validReason=value=>typeof value==='string'&&value===value.trim()&&value.length>=8&&value.length<=1000&&!/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(value);
function validPublicRequest(value){
 if(value?.version!==1||!['PENDING','APPROVED','REJECTED'].includes(value.status)||!Number.isSafeInteger(value.proposalRevision)||value.proposalRevision<=0||value.proposalRevision>=Number.MAX_SAFE_INTEGER||!validReceipt(value.proposalReceiptId)||![value.workerId,value.shiftId,value.closingEventId,value.submittedBy].every(workspaceId)||!Number.isSafeInteger(value.requestedExtraMs)||value.requestedExtraMs<=0||![value.sourceDigest,value.configurationDigest,value.proposalDigest].every(validDigest)||!validReason(value.reason)||!validUtc(value.submittedAt))return false;
 try{const configuration=overtimeConfiguration({metadata:{fieldOperations:{overtimeConfiguration:value.configuration}}});if(configuration.mode!=='MANUAL_REQUEST_ONLY'||configuration.configurationDigest!==value.configurationDigest||value.configuration.configurationDigest!==configuration.configurationDigest)return false;}catch{return false;}
 if(value.status==='PENDING')return value.decision===null;
 const decision=value.decision;
 return decision?.decision===(value.status==='APPROVED'?'APPROVE':'REJECT')&&workspaceId(decision.actorId)&&decision.actorId!==value.submittedBy&&validReceipt(decision.receiptId)&&decision.receiptId!==value.proposalReceiptId&&validReason(decision.reason)&&validUtc(decision.recordedAt)&&Date.parse(decision.recordedAt)>=Date.parse(value.submittedAt)&&[decision.sourceDigest,decision.configurationDigest].every(validDigest)&&(value.status!=='APPROVED'||decision.sourceDigest===value.sourceDigest&&decision.configurationDigest===value.configurationDigest);
}
function validStoredRequest(value){return validPublicRequest(value)&&validDigest(value.beneficiaryAccessDigest)&&proposalDigest(value)===value.proposalDigest;}
function publicRequest(value){return {version:1,status:value.status,proposalRevision:value.proposalRevision,proposalReceiptId:value.proposalReceiptId,proposalDigest:value.proposalDigest,workerId:value.workerId,shiftId:value.shiftId,closingEventId:value.closingEventId,requestedExtraMs:value.requestedExtraMs,reason:value.reason,submittedBy:value.submittedBy,submittedAt:value.submittedAt,sourceDigest:value.sourceDigest,configurationDigest:value.configurationDigest,configuration:overtimeConfiguration({metadata:{fieldOperations:{overtimeConfiguration:value.configuration}}}),decision:value.decision?{decision:value.decision.decision,reason:value.decision.reason,actorId:value.decision.actorId,recordedAt:value.decision.recordedAt,receiptId:value.decision.receiptId,sourceDigest:value.decision.sourceDigest,configurationDigest:value.decision.configurationDigest}:null};}
const publicOvertime=value=>validStoredRequest(value)?publicRequest(value):null;
const anchoredRequest=(value,row,summary)=>validStoredRequest(value)&&value.workerId===row.workerId&&value.closingEventId===row.id&&value.shiftId===summary.shiftId&&value.submittedBy===summary.recordedBy;
function readableConfiguration(project){try{return overtimeConfiguration(project);}catch(error){if(error instanceof WorkspaceError&&error.code==='OVERTIME_CONFIGURATION_INVALID')return {status:'INTEGRITY_REVIEW_REQUIRED',mode:'OFF',configurationDigest:null,timeZone:null};throw error;}}
export function createFieldOvertime({assertWorker}){
 async function close(client,projectId,closingEventId,lock=false){
  const row=(await client.query(`SELECT ${eventColumns} FROM public."AttendanceEntry" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[closingEventId,projectId])).rows[0];
  if(row?.metadata?.fieldOperations?.version!==1||row.metadata.fieldOperations.eventType!=='CHECK_OUT')unavailable();return row;
 }
 async function source(client,projectId,anchor){
  const shiftId=anchor.metadata?.fieldOperations?.shiftId;if(!workspaceId(shiftId))unavailable();
  const rows=(await client.query(`SELECT ${eventColumns} FROM public."AttendanceEntry" WHERE "projectId"=$1 AND "workerId"=$2 AND metadata->'fieldOperations'->>'shiftId'=$3`,[projectId,anchor.workerId,shiftId])).rows;
  const ordered=[...rows].sort((a,b)=>a.metadata?.fieldOperations?.sequence-b.metadata?.fieldOperations?.sequence),first=ordered[0]?.metadata?.fieldOperations;
  const previous=workspaceId(first?.previousEventId)?(await client.query(`SELECT ${eventColumns} FROM public."AttendanceEntry" WHERE id=$1 AND "projectId"=$2 AND "workerId"=$3`,[first.previousEventId,projectId,anchor.workerId])).rows[0]:null;
  return {rows,summary:summarizeFieldShift({events:rows,previousEvent:previous,projectId,workerId:anchor.workerId,shiftId})};
 }
 async function ownRead(client,session,projectId,workerId){
  const row=(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[workerId,projectId])).rows[0],p=row?.metadata?.participant;
  if(!row?.active||p?.version!==1||p.status!=='ACTIVE'||p.clerkUserId!==session.userId||p.kyc?.status!=='APPROVED'||p.permissions?.attendance!==true)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);return row;
 }
 async function overlap(client,member,summary){
  if(!summary.complete)return false;
  const rows=(await client.query(`SELECT ${eventColumns.replace('id,','a.id,').replaceAll('"projectId"','a."projectId"').replaceAll('"workerId"','a."workerId"').replace(',metadata',',a.metadata')} FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId" WHERE p."organizationId"=$1 AND a.metadata->'fieldOperations'->>'recordedBy'=$2 AND a.metadata->'fieldOperations'->>'eventType' IN ('CHECK_IN','CHECK_OUT')`,[member.organizationId,summary.recordedBy])).rows;
  const groups=new Map();for(const row of rows){const e=row.metadata?.fieldOperations,key=JSON.stringify([row.projectId,row.workerId,e?.shiftId]);if(row.projectId===summary.projectId&&row.workerId===summary.workerId&&e?.shiftId===summary.shiftId)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
  const start=Date.parse(summary.startedAt),end=Date.parse(summary.endedAt);
  for(const events of groups.values()){
   const incoming=events.filter(e=>e.eventType==='CHECK_IN'),outgoing=events.filter(e=>e.eventType==='CHECK_OUT');
   if(incoming.length!==1||outgoing.length>1||events.some(e=>typeof e.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.recordedAt)||!Number.isFinite(Date.parse(e.recordedAt))||new Date(e.recordedAt).toISOString()!==e.recordedAt))return true;
   const otherStart=Date.parse(incoming[0].recordedAt),otherEnd=outgoing.length?Date.parse(outgoing[0].recordedAt):Infinity;
   if(otherEnd<otherStart||start<otherEnd&&otherStart<end)return true;
  }return false;
 }
 async function beneficiary(client,member,project,row,actorId,lock=false){
  const own=(await client.query(`SELECT w.id,w.active,w.metadata,to_char(w."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "workerRevision",u.id AS "actorId",tm.id AS "membershipId",tm."tenantRole"::text AS role,to_char(tm."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "membershipRevision" FROM public."Worker" w JOIN public."PlatformUser" u ON u."clerkUserId"=w.metadata->'participant'->>'clerkUserId' JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=$2 WHERE w.id=$1 AND w."projectId"=$3 AND tm.status='ACTIVE' ${lock?'FOR SHARE OF w':''}`,[row.workerId,member.organizationId,project.id])).rows;
  const current=own[0],p=current?.metadata?.participant;
  if(own.length!==1||!current.active||current.actorId!==actorId||p?.version!==1||p.status!=='ACTIVE'||p.kyc?.status!=='APPROVED'||p.permissions?.attendance!==true)throw new WorkspaceError('OVERTIME_BENEFICIARY_ACCESS_CHANGED',409);
  let assignment=null;if(!portfolioAccess(current.role)){const rows=(await client.query(`SELECT id,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status='ACTIVE' ${lock?'FOR SHARE':''}`,[project.id,current.membershipId])).rows;if(rows.length!==1)throw new WorkspaceError('OVERTIME_BENEFICIARY_ACCESS_CHANGED',409);assignment=rows[0];}
  // Canonical participant/role receipts also invalidate the access snapshot.
  // Clock precision cannot revive a revoked/restored proposal when two updates
  // share a timestamp. Receipt IDs remain internal; no KYC payload is read.
  const accessReceipts=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND action='participant.operation.recorded' AND (("entityType"='Worker' AND "entityId"=$2) OR ("entityType"='TenantMembership' AND "entityId"=$3)) ORDER BY id`,[member.organizationId,current.id,current.membershipId])).rows.map(row=>row.id);
  return digest([current.id,current.actorId,current.workerRevision,current.membershipId,current.role,current.membershipRevision,assignment?.id||null,assignment?.revision||null,accessReceipts]);
 }
 return {
  async beforeProject(client,member,command){
   if(member.channelProof)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
   if(command.action==='CONFIGURE_OVERTIME'){if(!canDecideOvertime(member.role))throw new WorkspaceError('OVERTIME_DECISION_PERMISSION_REQUIRED',403);return;}
   if(command.action==='PROPOSE_OVERTIME'){await lockPersonWorksiteJourney(client,member);return;}
   if(!canDecideOvertime(member.role))throw new WorkspaceError('OVERTIME_DECISION_PERMISSION_REQUIRED',403);
   // Target identity/membership and the person lock precede Project, matching
   // canonical revocation/attendance order. Never accept a caller actor ID.
   // A revoked beneficiary may receive an explicit rejection. Approval still
   // requires its ACTIVE membership and unchanged access stamp inside apply.
   const target=(await client.query(`SELECT u.id AS "actorId" FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId" JOIN public."PlatformUser" u ON u.id=a.metadata->'fieldOperations'->>'recordedBy' JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=p."organizationId" WHERE a.id=$1 AND p.id=$2 AND p."organizationId"=$3 FOR SHARE OF u,tm`,[command.payload.closingEventId,command.projectId,member.organizationId])).rows;
   if(target.length!==1)throw new WorkspaceError('OVERTIME_BENEFICIARY_ACCESS_CHANGED',409);
   if(target[0].actorId===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
   await lockPersonWorksiteJourney(client,{...member,actorId:target[0].actorId});
  },
  async journeys(client,member,session,project,ownedIds,{cursor,scope}={}){
   if(member.channelProof)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
   const after=parseFieldOvertimeJourneyCursor(cursor,project.id,scope),reviewer=canReviewField(member.role);
   if(after){const anchor=(await client.query(`SELECT a.id,a."workerId",to_char(a."checkedInAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "sortAt" FROM public."AttendanceEntry" a JOIN public."Worker" w ON w.id=a."workerId" AND w."projectId"=a."projectId" WHERE a.id=$1 AND a."projectId"=$2 AND a.metadata->'fieldOperations'->>'version'='1' AND a.metadata->'fieldOperations'->>'eventType' IN ('CHECK_IN','CHECK_OUT')`,[after.id,project.id])).rows[0];if(!anchor||anchor.sortAt!==after.sortAt||!reviewer&&!ownedIds.includes(anchor.workerId))throw new WorkspaceError('FIELD_QUERY_INVALID');}
   const rows=(await client.query(`SELECT a.id,a."workerId",w.name,a.metadata,to_char(a."checkedInAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "sortAt" FROM public."AttendanceEntry" a JOIN public."Worker" w ON w.id=a."workerId" AND w."projectId"=a."projectId" WHERE a."projectId"=$1 AND ($4::timestamp IS NULL OR (a."checkedInAt",a.id)<($4::timestamp,$5::text)) AND ( $2::boolean OR a."workerId"=ANY($3::text[]) ) AND a.metadata->'fieldOperations'->>'version'='1' AND (a.metadata->'fieldOperations'->>'eventType'='CHECK_OUT' OR a.metadata->'fieldOperations'->>'eventType'='CHECK_IN' AND NOT EXISTS(SELECT 1 FROM public."AttendanceEntry" ending WHERE ending."projectId"=a."projectId" AND ending."workerId"=a."workerId" AND ending.metadata->'fieldOperations'->>'shiftId'=a.metadata->'fieldOperations'->>'shiftId' AND ending.metadata->'fieldOperations'->>'eventType'='CHECK_OUT')) ORDER BY a."checkedInAt" DESC,a.id DESC LIMIT 31`,[project.id,reviewer,ownedIds,after?.sortAt||null,after?.id||null])).rows;
   return {configuration:readableConfiguration(project),journeys:rows.slice(0,30).map(row=>({workerId:row.workerId,workerName:row.name,shiftId:row.metadata.fieldOperations.shiftId,closingEventId:row.metadata.fieldOperations.eventType==='CHECK_OUT'?row.id:null,recordedAt:row.metadata.fieldOperations.recordedAt,overtimeStatus:row.metadata.fieldOperations.overtime?(validStoredRequest(row.metadata.fieldOperations.overtime)?row.metadata.fieldOperations.overtime.status:'INTEGRITY_REVIEW_REQUIRED'):null})),truncated:rows.length>30,hasMore:rows.length>30,nextCursor:rows.length>30?fieldOvertimeJourneyCursor(project.id,scope,rows[29]):null};
  },
  async readShift(client,member,session,project,context){
   if(member.channelProof)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
   const anchor=context.closingEventId?await close(client,project.id,context.closingEventId):(await client.query(`SELECT ${eventColumns} FROM public."AttendanceEntry" WHERE "projectId"=$1 AND metadata->'fieldOperations'->>'shiftId'=$2 AND metadata->'fieldOperations'->>'eventType'='CHECK_IN'`,[project.id,context.shiftId])).rows[0];
   if(!anchor)unavailable();
   const person=canReviewField(member.role)?(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[anchor.workerId,project.id])).rows[0]:await ownRead(client,session,project.id,anchor.workerId);if(!person)unavailable();
   const {summary,rows}=await source(client,project.id,anchor),configuration=readableConfiguration(project),overlapDetected=await overlap(client,member,summary),closing=summary.complete?rows.find(row=>row.id===summary.closingEventId):anchor,stored=closing?.metadata?.fieldOperations?.overtime,request=stored&&anchoredRequest(stored,closing,summary)?publicOvertime(stored):null,overtimeNeedsReview=Boolean(stored&&!request);
   const self=person.active&&person.metadata?.participant?.version===1&&person.metadata?.participant?.clerkUserId===session.userId&&person.metadata?.participant?.status==='ACTIVE'&&person.metadata?.participant?.kyc?.status==='APPROVED'&&person.metadata?.participant?.permissions?.attendance===true&&summary.recordedBy===member.actorId;
   const mayDecide=canDecideOvertime(member.role)&&request?.status==='PENDING'&&request.submittedBy!==member.actorId&&summary.recordedBy!==member.actorId&&person.metadata?.participant?.clerkUserId!==session.userId;
   let beneficiaryAccessChanged=false;if(mayDecide){try{beneficiaryAccessChanged=await beneficiary(client,member,project,closing,summary.recordedBy)!==closing.metadata.fieldOperations.overtime.beneficiaryAccessDigest;}catch(error){if(error instanceof WorkspaceError&&error.code==='OVERTIME_BENEFICIARY_ACCESS_CHANGED')beneficiaryAccessChanged=true;else throw error;}}
   const ready=!overtimeNeedsReview&&summary.complete&&summary.evidenceStatus==='READY'&&!overlapDetected&&configuration.mode==='MANUAL_REQUEST_ONLY';
   const history=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='field.operation.recorded' AND metadata->>'command' IN ('PROPOSE_OVERTIME','DECIDE_OVERTIME') AND metadata->'outcome'->'overtime'->>'closingEventId'=$3 ORDER BY "createdAt",id`,[member.organizationId,project.id,closing?.id||anchor.id])).rows.map(row=>({receiptId:row.id,command:row.metadata.command,overtime:validPublicRequest(row.metadata.outcome.overtime)?publicRequest(row.metadata.outcome.overtime):null,needsReview:!validPublicRequest(row.metadata.outcome.overtime)}));
   return {projectId:project.id,worker:{id:person.id,name:person.name},summary,configuration,overlapDetected,beneficiaryAccessChanged,overtime:request,overtimeNeedsReview,history,canPropose:Boolean(self&&ready&&(!request||request.status==='REJECTED')),canApprove:Boolean(mayDecide&&ready&&!beneficiaryAccessChanged&&request.sourceDigest===summary.sourceDigest&&request.configurationDigest===configuration.configurationDigest),canReject:Boolean(mayDecide&&summary.sourceDigest&&configuration.configurationDigest),events:rows.sort((a,b)=>a.metadata.fieldOperations.sequence-b.metadata.fieldOperations.sequence).map(row=>({id:row.id,eventType:row.metadata.fieldOperations.eventType,recordedAt:row.metadata.fieldOperations.recordedAt,sectorName:row.metadata.fieldOperations.sectorName,verificationStatus:row.metadata.fieldOperations.verificationStatus,review:row.metadata.fieldOperations.review}))};
  },
  async apply({client,member,session,project,command,receiptId,at}){
   if(member.channelProof)throw new WorkspaceError('OVERTIME_WEB_ONLY',403);
   const p=command.payload;
   if(command.action==='CONFIGURE_OVERTIME'){
    if(!canDecideOvertime(member.role))throw new WorkspaceError('OVERTIME_DECISION_PERMISSION_REQUIRED',403);
    const row=(await client.query(`SELECT metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId])).rows[0];
    if(row.revision!==p.revision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
    const {revision:ignored,...contract}=p;void ignored;
    const metadata={...cleanMetadata(row.metadata),fieldOperations:{...cleanMetadata(row.metadata?.fieldOperations),overtimeConfiguration:{...contract,configurationId:'overtimeconfig_'+randomUUID().replaceAll('-',''),configuredBy:member.actorId,configuredAt:at}}};
    await client.query(`UPDATE public."Project" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId,JSON.stringify(metadata)]);
    return {kind:'OVERTIME_CONFIGURATION',configuration:overtimeConfiguration({...project,metadata}),recordedAt:at};
   }
   const row=await close(client,project.id,p.closingEventId,true),current=row.metadata.fieldOperations.overtime;
   if(current&&!validStoredRequest(current))throw new WorkspaceError('OVERTIME_PROPOSAL_CHANGED',409);
   const {summary}=await source(client,project.id,row),configuration=overtimeConfiguration(project);
   if(current&&!anchoredRequest(current,row,summary))throw new WorkspaceError('OVERTIME_PROPOSAL_CHANGED',409);
   if(!summary.complete||!summary.sourceDigest)throw new WorkspaceError('OVERTIME_CHAIN_REVIEW_REQUIRED',409);
   if(p.sourceDigest!==summary.sourceDigest||p.configurationDigest!==configuration.configurationDigest)throw new WorkspaceError('OVERTIME_SOURCE_CHANGED',409);
   let next;
   if(command.action==='PROPOSE_OVERTIME'){
    await assertWorker(client,member,session,project.id,p.workerId,'attendance');
    if(p.workerId!==row.workerId||p.shiftId!==summary.shiftId||summary.recordedBy!==member.actorId)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);
    if(configuration.mode!=='MANUAL_REQUEST_ONLY')throw new WorkspaceError('OVERTIME_NOT_CONFIGURED',409);
    if(summary.evidenceStatus!=='READY')throw new WorkspaceError('OVERTIME_ATTENDANCE_REVIEW_REQUIRED',409);
    if(await overlap(client,member,summary))throw new WorkspaceError('OVERTIME_PERSON_OVERLAP',409);
    if(p.requestedExtraMs>summary.netMs)throw new WorkspaceError('OVERTIME_AMOUNT_EXCEEDS_RECORDED',422);
    if(current&&current.status!=='REJECTED')throw new WorkspaceError('OVERTIME_ALREADY_REQUESTED',409);
    const beneficiaryAccessDigest=await beneficiary(client,member,project,row,summary.recordedBy,true);
    next={version:1,status:'PENDING',proposalRevision:(current?.proposalRevision||0)+1,proposalReceiptId:receiptId,operationId:command.operationId,workerId:row.workerId,shiftId:summary.shiftId,closingEventId:row.id,requestedExtraMs:p.requestedExtraMs,reason:p.reason,submittedBy:member.actorId,submittedAt:at,sourceDigest:summary.sourceDigest,configurationDigest:configuration.configurationDigest,configuration,beneficiaryAccessDigest,decision:null};next.proposalDigest=proposalDigest(next);
   }else{
    if(!canDecideOvertime(member.role))throw new WorkspaceError('OVERTIME_DECISION_PERMISSION_REQUIRED',403);
    if(current?.version!==1||current.status!=='PENDING')throw new WorkspaceError('OVERTIME_ALREADY_REVIEWED',409);
    if(current.proposalReceiptId!==p.proposalReceiptId||current.proposalRevision!==p.proposalRevision||current.proposalDigest!==p.proposalDigest||proposalDigest(current)!==p.proposalDigest)throw new WorkspaceError('OVERTIME_PROPOSAL_CHANGED',409);
    if(current.submittedBy===member.actorId||summary.recordedBy===member.actorId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
    const currentWorker=(await client.query(`SELECT metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[row.workerId,project.id])).rows[0];if(currentWorker?.metadata?.participant?.clerkUserId===session.userId)throw new WorkspaceError('FIELD_MAKER_CHECKER_REQUIRED',403);
    if(p.decision==='APPROVE'){
     if(await beneficiary(client,member,project,row,summary.recordedBy,true)!==current.beneficiaryAccessDigest)throw new WorkspaceError('OVERTIME_BENEFICIARY_ACCESS_CHANGED',409);
     if(configuration.mode!=='MANUAL_REQUEST_ONLY')throw new WorkspaceError('OVERTIME_NOT_CONFIGURED',409);
     if(current.sourceDigest!==summary.sourceDigest||current.configurationDigest!==configuration.configurationDigest)throw new WorkspaceError('OVERTIME_SOURCE_CHANGED',409);
     if(summary.evidenceStatus!=='READY')throw new WorkspaceError('OVERTIME_ATTENDANCE_REVIEW_REQUIRED',409);
     if(await overlap(client,member,summary))throw new WorkspaceError('OVERTIME_PERSON_OVERLAP',409);
     if(!Number.isSafeInteger(current.requestedExtraMs)||current.requestedExtraMs<=0||current.requestedExtraMs>summary.netMs)throw new WorkspaceError('OVERTIME_AMOUNT_EXCEEDS_RECORDED',422);
    }
    next={...current,status:p.decision==='APPROVE'?'APPROVED':'REJECTED',decision:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:at,receiptId,sourceDigest:summary.sourceDigest,configurationDigest:configuration.configurationDigest}};
   }
   if(!validStoredRequest(next))throw new WorkspaceError('OVERTIME_PROPOSAL_CHANGED',409);
   await client.query(`UPDATE public."AttendanceEntry" SET metadata=$3::jsonb WHERE id=$1 AND "projectId"=$2`,[row.id,project.id,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:{...row.metadata.fieldOperations,overtime:next}})]);
   return {kind:command.action==='PROPOSE_OVERTIME'?'OVERTIME_PROPOSAL':'OVERTIME_DECISION',overtime:publicOvertime(next),recordedAt:at,paymentCalculated:false};
  },
  async recover(client,projectId,outcome){const row=await close(client,projectId,outcome.overtime.closingEventId),current=row.metadata.fieldOperations.overtime,original=validPublicRequest(outcome.overtime)?publicRequest(outcome.overtime):null;return {...outcome,overtime:original,currentOvertime:publicOvertime(current),originalOvertime:original,overtimeNeedsReview:Boolean(current&&!validStoredRequest(current))||!original};},
 };
}
