import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {EXECUTION_ACTIONS,normalizeExecutionPayload,executionFactDigest} from './field-execution-policy.mjs';
import {inventoryCatalog,assertInventoryCatalog,inventoryMaterial,changeInventoryBalance,saveInventoryCatalog,recordInventoryMovement,inventoryQuantity} from './material-inventory.mjs';
import {parseProcurementQuantity,formatProcurementQuantity} from './procurement-quantity.js';
import {parseProgressMeasurementQuantity,formatProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {publicTaskMeasurement,deriveTaskMeasurement} from './task-progress-measurement.js';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {participantAccountBound,participantProjectAdmitted} from './participant-admission.mjs';

const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const manages=member=>['ADMIN','DIRECTOR'].includes(member.role)&&!member.channelProof;
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const authorityFences=new WeakMap();
const assertOne=result=>{if(result.rowCount!==1)fail('FIELD_EXECUTION_WRITE_CONFLICT');return result;};
const clock=async client=>(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
export const executionMandateId=(organizationId,projectId,actorId,operationId)=>'execution_mandate_'+digest([organizationId,projectId,actorId,operationId]);
export const fieldExecutionId=(organizationId,projectId,workerId,reportId)=>'field_execution_'+digest(['field-execution-v1',organizationId,projectId,workerId,reportId]);
export const executionLineReceiptId=(executionId,lineId)=>'execution_line_'+digest(['field-execution-line-v1',executionId,lineId]);
const mandateCommitment=m=>digest(['field-execution-mandate-v1',m.organizationId,m.projectId,m.issuedBy,m.issuerMembershipId,m.reporterActorId,m.reporterClerkUserId,m.request]);
function checkedMandate(row,organizationId,projectId){
 const m=row?.metadata;
 if(!m||m.version!==1||m.kind!=='EXECUTION_MANDATE'||row.organizationId!==organizationId||row.entityId!==projectId||row.actorId!==m.issuedBy||m.organizationId!==organizationId||m.projectId!==projectId||!workspaceId(m.issuedBy)||!workspaceId(m.issuerMembershipId)||!workspaceId(m.reporterActorId)||m.issuedBy===m.reporterActorId||typeof m.reporterClerkUserId!=='string'||!['ACTIVE','REVOKED'].includes(m.state)||m.revision!==(m.state==='ACTIVE'?1:2)||!timestamp(m.issuedAt))fail('FIELD_EXECUTION_MANDATE_INTEGRITY');
 let request;try{request=normalizeExecutionPayload('ISSUE_EXECUTION_MANDATE',m.request);}catch{fail('FIELD_EXECUTION_MANDATE_INTEGRITY');}
 const result={...m,request};
 if(m.authorizationDigest!==mandateCommitment(result)||!Array.isArray(m.used)||m.used.length!==request.materials.length||!timestamp(request.validUntil)||Date.parse(request.validUntil)<=Date.parse(m.issuedAt))fail('FIELD_EXECUTION_MANDATE_INTEGRITY');
 for(let i=0;i<m.used.length;i++){const row=m.used[i],limit=request.materials[i];if(row.materialId!==limit.materialId||inventoryQuantity(row.quantity,{allowZero:true})!==row.quantity||parseProcurementQuantity(row.quantity,{allowZero:true})>parseProcurementQuantity(limit.limit))fail('FIELD_EXECUTION_MANDATE_INTEGRITY');}
 try{if(formatProgressMeasurementQuantity(m.progressUsed)!==m.progressUsed||request.progress&&parseProgressMeasurementQuantity(m.progressUsed)>parseProgressMeasurementQuantity(request.progress.limit)||!request.progress&&m.progressUsed!=='0.0000')fail('FIELD_EXECUTION_MANDATE_INTEGRITY');}catch{fail('FIELD_EXECUTION_MANDATE_INTEGRITY');}
 return result;
}
async function mandateRow(client,organizationId,projectId,id,lock=false){
 const rows=(await client.query(`SELECT id,"organizationId","actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Project' AND "entityId"=$3 AND action='field.execution.mandate'${lock?' FOR UPDATE':''}`,[id,organizationId,projectId])).rows;
 if(rows.length!==1)fail('FIELD_EXECUTION_MANDATE_UNAVAILABLE',404);
 return {row:rows[0],mandate:checkedMandate(rows[0],organizationId,projectId)};
}
async function executionRow(client,organizationId,projectId,id){
 const rows=(await client.query(`SELECT id,"organizationId","actorId","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Project' AND "entityId"=$3 AND action='field.execution.applied'`,[id,organizationId,projectId])).rows;
 if(rows.length>1)fail('FIELD_EXECUTION_INTEGRITY');return rows[0]||null;
}
async function reporter(client,member,projectId,workerId,lock=false){
 const rows=(await client.query(`SELECT w.id,w.active,w.metadata,u.id AS "actorId",u."clerkUserId",tm.id AS "membershipId" FROM public."Worker" w JOIN public."PlatformUser" u ON u."clerkUserId"=w.metadata->'participant'->>'clerkUserId' JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=$2 AND tm.status='ACTIVE' JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=tm.id AND pm."projectId"=w."projectId" AND pm.status='ACTIVE' WHERE w.id=$1 AND w."projectId"=$3 AND w.active=true AND w.metadata->'participant'->>'version'='1' AND w.metadata->'participant'->>'status'='ACTIVE' AND w.metadata->'participant'->'permissions'->>'report'='true'${lock?' FOR SHARE OF w,u,tm,pm':' FOR SHARE OF u,tm'}`,[workerId,member.organizationId,projectId])).rows;
 if(rows.length!==1)fail('FIELD_EXECUTION_REPORTER_UNAVAILABLE',403);return rows[0];
}
async function issuer(client,member,projectId,m,afterProject=false,previouslyBound=false){
 const rows=(await client.query(`SELECT u.id AS "actorId",u."clerkUserId",tm.id AS "membershipId",tm."tenantRole"::text AS role,tm."clerkRole",tm."organizationId",EXISTS(SELECT 1 FROM public."AuditLog" a WHERE a."organizationId"=tm."organizationId" AND a."actorId"=u.id AND a.action='office.review.accepted' AND a.metadata->>'membershipId'=tm.id) AS "officeReviewOnly" FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id WHERE u.id=$1 AND tm.id=$2 AND tm."organizationId"=$3 AND tm.status='ACTIVE' AND tm."tenantRole"::text IN ('ADMIN','DIRECTOR') FOR SHARE OF u,tm`,[m.issuedBy,m.issuerMembershipId,member.organizationId])).rows;
 const current=rows[0];if(rows.length!==1||current.officeReviewOnly===true||current.actorId===m.reporterActorId)fail('FIELD_EXECUTION_ISSUER_UNAVAILABLE',403);
 current.participantBound=await participantAccountBound(client,current)||previouslyBound;
 if(current.participantBound){
  const assigned=(await client.query(`SELECT id FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status='ACTIVE'${afterProject?' FOR SHARE':''}`,[projectId,current.membershipId])).rows;
  if(assigned.length!==1)fail('FIELD_EXECUTION_ISSUER_UNAVAILABLE',403);
 }
 if(!await participantProjectAdmitted(client,current,projectId,{lock:afterProject}))fail('FIELD_EXECUTION_ISSUER_UNAVAILABLE',403);
 return current;
}
// Membership locks precede the Project lock, matching canonical revocation.
// A private client-bound marker prevents compositions that omit this hook from
// manufacturing a standing authorization after acquiring locks out of order.
export async function beforeExecutionProject(client,member,command){
 authorityFences.delete(client);const p=command.payload;
 if(command.action==='ISSUE_EXECUTION_MANDATE'){
  if(!manages(member))fail('FIELD_EXECUTION_MANAGE_REQUIRED',403);
  // An already committed request is recovered by the canonical field receipt;
  // it must not require a new grant after the reporter has been revoked.
  if((await client.query(`SELECT id FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='field.operation.recorded'`,['field_'+digest([member.actorId,command.projectId,command.operationId]),member.organizationId,member.actorId])).rows.length)return;
  const target=await reporter(client,member,command.projectId,p.workerId);
  if(target.actorId===member.actorId)fail('FIELD_MAKER_CHECKER_REQUIRED',403);
  authorityFences.set(client,{operationId:command.operationId,workerId:p.workerId,targetActorId:target.actorId});return;
 }
 if(command.action==='REVOKE_EXECUTION_MANDATE'){if(!manages(member))fail('FIELD_EXECUTION_MANAGE_REQUIRED',403);return;}
 if(command.action!=='REPORT_EXECUTION')fail('FIELD_EXECUTION_ACTION_INVALID',400);
 const id=fieldExecutionId(member.organizationId,command.projectId,p.workerId,p.reportId);
 if(await executionRow(client,member.organizationId,command.projectId,id))return;
 const {mandate:m}=await mandateRow(client,member.organizationId,command.projectId,p.mandateId);
 const currentIssuer=await issuer(client,member,command.projectId,m);
 authorityFences.set(client,{operationId:command.operationId,mandateId:p.mandateId,issuedBy:m.issuedBy,authorizationDigest:m.authorizationDigest,participantBound:currentIssuer.participantBound});
}
function publicMandate(id,m){return {id,version:1,revision:m.revision,state:m.state,issuedBy:m.issuedBy,reporterActorId:m.reporterActorId,workerId:m.request.workerId,taskId:m.request.taskId,sectorId:m.request.sectorId,catalogHash:m.request.catalogHash,issuedAt:m.issuedAt,validUntil:m.request.validUntil,materials:m.request.materials.map((row,i)=>({...row,used:m.used[i].quantity})),progress:m.request.progress?{...m.request.progress,used:m.progressUsed}:null,revocation:m.revocation};}
async function readReporter(client,member,session,projectId,workerId){
 // The canonical read-only Project transaction supplies one authorized snapshot.
 // Do not call the writable participant port: its FOR SHARE is illegal here.
 const rows=(await client.query(`SELECT id,active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'version'='1' AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'permissions'->>'report'='true'`,[workerId,projectId,session.userId])).rows;
 if(rows.length!==1)fail('FIELD_PARTICIPANT_REQUIRED',403);
 await assertApprovedParticipantKyc(client,{...rows[0],projectId},{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
}
const measurementCall=fn=>{try{return fn();}catch(e){if(e?.name==='TaskProgressMeasurementError')fail(e.code,e.status);throw e;}};
export function createFieldExecution({assertWorker,assertTask,assertEvidence,publicTask}){
 async function apply({client,member,session,project,command,receiptId,at}){
  if(!EXECUTION_ACTIONS.includes(command.action))fail('FIELD_EXECUTION_ACTION_INVALID',400);
  const p=command.payload,fence=authorityFences.get(client);authorityFences.delete(client);
  if(command.action==='ISSUE_EXECUTION_MANDATE'){
   if(!manages(member))fail('FIELD_EXECUTION_MANAGE_REQUIRED',403);
   if(fence?.operationId!==command.operationId||fence.workerId!==p.workerId)fail('FIELD_EXECUTION_AUTHORITY_FENCE_REQUIRED',403);
   const target=await reporter(client,member,project.id,p.workerId,true);
   if(target.actorId===member.actorId||target.actorId!==fence.targetActorId)fail('FIELD_MAKER_CHECKER_REQUIRED',403);
   await assertApprovedParticipantKyc(client,{...target,projectId:project.id},{organizationId:member.organizationId,actorId:target.actorId,clerkUserId:target.clerkUserId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
   const task=await assertTask(client,project.id,p.taskId,true);if(task.revision!==p.taskRevision)fail('FIELD_REVISION_CHANGED');
   if(!project.metadata?.fieldOperations?.sectors?.some(s=>s.id===p.sectorId))fail('FIELD_SECTOR_UNAVAILABLE',404);
   const stock=inventoryCatalog(project);assertInventoryCatalog(stock,p.catalogHash);for(const row of p.materials)if(inventoryMaterial(stock,row.materialId).unit!==row.unit)fail('INVENTORY_UNIT_MISMATCH');
   at=await clock(client);
   if(Date.parse(p.validUntil)<=Date.parse(at)||Date.parse(p.validUntil)-Date.parse(at)>30*86400000)fail('FIELD_EXECUTION_VALIDITY_INVALID',400);
   if(p.progress){const measured=measurementCall(()=>publicTaskMeasurement(task));if(!measured||['definitionId','baseline','unit'].some(k=>measured[k]!==p.progress[k]))fail('FIELD_MEASUREMENT_CHANGED');}
   const m={version:1,kind:'EXECUTION_MANDATE',organizationId:member.organizationId,projectId:project.id,issuedBy:member.actorId,issuerMembershipId:member.membershipId,reporterActorId:target.actorId,reporterClerkUserId:target.clerkUserId,request:p,revision:1,state:'ACTIVE',issuedAt:at,used:p.materials.map(row=>({materialId:row.materialId,quantity:'0.000'})),progressUsed:'0.0000',revocation:null};m.authorizationDigest=mandateCommitment(m);
   const id=executionMandateId(member.organizationId,project.id,member.actorId,command.operationId);
   assertOne(await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.execution.mandate','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,project.id,JSON.stringify(m)]));
   return {kind:'EXECUTION_MANDATE_ISSUED',mandate:publicMandate(id,m),stockChanged:false,taskUpdated:false};
  }
  if(command.action==='REVOKE_EXECUTION_MANDATE'){
   if(!manages(member))fail('FIELD_EXECUTION_MANAGE_REQUIRED',403);const {row,mandate:m}=await mandateRow(client,member.organizationId,project.id,p.mandateId,true);
   if(m.revision!==p.revision)fail('FIELD_EXECUTION_MANDATE_CHANGED');if(m.state!=='ACTIVE')fail('FIELD_EXECUTION_MANDATE_REVOKED');
   const next={...m,state:'REVOKED',revision:2,revocation:{actorId:member.actorId,reason:p.reason,recordedAt:at,receiptId}};
   assertOne(await client.query(`UPDATE public."AuditLog" SET metadata=$4::jsonb WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='field.execution.mandate'`,[row.id,member.organizationId,project.id,JSON.stringify(next)]));
   return {kind:'EXECUTION_MANDATE_REVOKED',mandate:publicMandate(row.id,next),stockChanged:false,taskUpdated:false};
  }
  await assertWorker(client,member,session,project.id,p.workerId,'report');
  const id=fieldExecutionId(member.organizationId,project.id,p.workerId,p.reportId),requestDigest=executionFactDigest(p),existing=await executionRow(client,member.organizationId,project.id,id);
  if(existing){const e=existing.metadata;if(e?.version!==1||e.projectId!==project.id||e.organizationId!==member.organizationId||e.workerId!==p.workerId||e.actorId!==member.actorId||e.requestDigest!==requestDigest||e.outcome?.execution?.id!==id)fail('FIELD_EXECUTION_REPORT_CONFLICT');const snapshot=e.outcome,current=snapshot.task?publicTask(await assertTask(client,project.id,snapshot.task.id)):null;return {...snapshot,executionReplay:true,effectsApplied:false,stockChanged:false,taskUpdated:false,...(current?{task:current,executionTaskSnapshot:snapshot.task}:{})};}
  const {row,mandate:m}=await mandateRow(client,member.organizationId,project.id,p.mandateId,true);
  if(fence?.operationId!==command.operationId||fence.mandateId!==p.mandateId||fence.issuedBy!==m.issuedBy||fence.authorizationDigest!==m.authorizationDigest)fail('FIELD_EXECUTION_AUTHORITY_FENCE_REQUIRED',403);
  await issuer(client,member,project.id,m,true,fence.participantBound);
  if(m.state!=='ACTIVE')fail('FIELD_EXECUTION_MANDATE_REVOKED');if(m.revision!==p.mandateRevision)fail('FIELD_EXECUTION_MANDATE_CHANGED');
  if(member.actorId===m.issuedBy||member.actorId!==m.reporterActorId||session.userId!==m.reporterClerkUserId||['workerId','taskId','sectorId','catalogHash'].some(k=>p[k]!==m.request[k]))fail('FIELD_EXECUTION_MANDATE_SCOPE',403);
  if(!project.metadata?.fieldOperations?.sectors?.some(s=>s.id===p.sectorId))fail('FIELD_SECTOR_UNAVAILABLE',404);
  const current=await assertTask(client,project.id,p.taskId,true);if(current.revision!==p.taskRevision)fail('FIELD_REVISION_CHANGED');
  const stock=inventoryCatalog(project);assertInventoryCatalog(stock,p.catalogHash);const totals=new Map();
  for(const line of p.lines){const material=inventoryMaterial(stock,line.materialId),allowed=m.request.materials.find(r=>r.materialId===line.materialId);if(!allowed||allowed.unit!==line.unit||material.unit!==line.unit)fail('FIELD_EXECUTION_MATERIAL_SCOPE',403);totals.set(line.materialId,(totals.get(line.materialId)||0n)+parseProcurementQuantity(line.quantity));}
  const used=structuredClone(m.used);for(const [materialId,total]of totals){const cap=m.request.materials.find(r=>r.materialId===materialId),usage=used.find(r=>r.materialId===materialId),next=parseProcurementQuantity(usage.quantity,{allowZero:true})+total;if(total>parseProcurementQuantity(cap.maxPerReport)||next>parseProcurementQuantity(cap.limit))fail('FIELD_EXECUTION_ALLOWANCE_EXCEEDED');usage.quantity=formatProcurementQuantity(next);changeInventoryBalance(inventoryMaterial(stock,materialId),formatProcurementQuantity(total),'OUT');}
  for(const evidenceId of p.evidenceIds){const e=(await assertEvidence(client,project.id,evidenceId)).metadata.fieldOperations;if(e.workerId!==p.workerId||e.taskId!==p.taskId||e.sectorId!==p.sectorId||e.recordedBy!==member.actorId||e.review?.decision==='REJECT'||p.progress&&e.review?.decision!=='APPROVE')fail('FIELD_EVIDENCE_NOT_APPROVED');}
  let measured=null,progressUsed=m.progressUsed,taskResult=null;
  if(p.progress){if(!m.request.progress||['definitionId','baseline','unit'].some(k=>p.progress[k]!==m.request.progress[k]))fail('FIELD_EXECUTION_PROGRESS_SCOPE',403);const definition=measurementCall(()=>publicTaskMeasurement(current));if(!definition||['definitionId','baseline','unit'].some(k=>definition[k]!==p.progress[k]))fail('FIELD_MEASUREMENT_CHANGED');measured=measurementCall(()=>deriveTaskMeasurement(current,{mode:p.progress.mode,quantity:p.progress.quantity}));const delta=parseProgressMeasurementQuantity(measured.delta),next=parseProgressMeasurementQuantity(m.progressUsed)+delta;if(delta>parseProgressMeasurementQuantity(m.request.progress.maxPerReport)||next>parseProgressMeasurementQuantity(m.request.progress.limit))fail('FIELD_EXECUTION_ALLOWANCE_EXCEEDED');progressUsed=formatProgressMeasurementQuantity(next);}
  // All effects below share the caller's canonical Project transaction. No
  // provider I/O, guessed opening stock or identity substitution occurs here.
  at=await clock(client);
  if(Date.parse(m.request.validUntil)<=Date.parse(at))fail('FIELD_EXECUTION_MANDATE_EXPIRED');
  await saveInventoryCatalog(client,member,project,stock);
  const movements=[],balances=new Map();for(const line of p.lines){const material=inventoryMaterial(stock,line.materialId);if(!balances.has(line.materialId)){const final=material.balance;balances.set(line.materialId,formatProcurementQuantity(parseProcurementQuantity(final,{allowZero:true})+totals.get(line.materialId)));}const balanceBefore=balances.get(line.materialId),balanceAfter=formatProcurementQuantity(parseProcurementQuantity(balanceBefore,{allowZero:true})-parseProcurementQuantity(line.quantity));balances.set(line.materialId,balanceAfter);movements.push(await recordInventoryMovement(client,member,project,executionLineReceiptId(id,line.lineId),{kind:'CONSUMPTION',direction:'OUT',materialId:line.materialId,unit:material.unit,quantity:line.quantity,balanceBefore,balanceAfter,executionId:id,lineId:line.lineId,reportId:p.reportId,executionReceiptId:receiptId,mandateId:row.id,authorizationDigest:m.authorizationDigest,authorizedBy:m.issuedBy,submittedBy:member.actorId,catalogHash:p.catalogHash,reason:p.reason,recordedAt:at}));}
  if(measured){
   const proposalId='execution_progress_'+digest(id),metadata={...current.metadata,fieldOperations:{...current.metadata?.fieldOperations,version:1,approvedProposalId:proposalId,approvedBy:m.issuedBy,approvedAt:at,quantity:{executed:measured.executed,baseline:measured.baseline,unit:measured.unit},executionAuthorization:{version:1,executionId:id,mandateId:row.id,authorizationDigest:m.authorizationDigest,issuedBy:m.issuedBy,executedBy:member.actorId}}};
   assertOne(await client.query(`INSERT INTO public."OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId","confirmationCode",type,status,summary,action,precondition,result,"classifierVersion","transcriptSha256","expiresAt","resolvedAt","updatedAt") VALUES($1,$2,$3,'field-execution-v1',$4,$5,'TASK_PROGRESS','APPLIED',$6,$7::jsonb,$8::jsonb,$9::jsonb,'standing-mandate-v1',$10,clock_timestamp(),clock_timestamp(),clock_timestamp())`,[proposalId,project.id,p.workerId,id,digest(id).slice(0,10).toUpperCase(),current.title+' · '+measured.progress+'%',JSON.stringify({fieldExecutionVersion:1,taskId:p.taskId,measurement:measured,evidenceIds:p.evidenceIds,submittedBy:member.actorId,mandateId:row.id,authorizedBy:m.issuedBy}),JSON.stringify({taskRevision:current.revision}),JSON.stringify({authorization:{mandateId:row.id,issuedBy:m.issuedBy},taskUpdated:true}),digest(p.reason)]));
   assertOne(await client.query(`UPDATE public."Task" SET progress=$3,status=$4::"TaskStatus",metadata=$5::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[current.id,project.id,measured.progress,current.status==='BLOCKED'?'BLOCKED':measured.progress===100?'DONE':measured.progress>0?'IN_PROGRESS':'BACKLOG',JSON.stringify(metadata)]));
   taskResult=publicTask(await assertTask(client,project.id,current.id));
  }
  const nextMandate={...m,used,progressUsed};assertOne(await client.query(`UPDATE public."AuditLog" SET metadata=$4::jsonb WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='field.execution.mandate'`,[row.id,member.organizationId,project.id,JSON.stringify(nextMandate)]));
  const outcome={kind:'EXECUTION_APPLIED',execution:{version:1,id,reportId:p.reportId,workerId:p.workerId,taskId:p.taskId,sectorId:p.sectorId,mandateId:row.id,mandateRevision:m.revision,validUntil:m.request.validUntil,authorizedBy:m.issuedBy,executedBy:member.actorId,recordedAt:at,receiptId,movements,measurement:measured},executionReplay:false,effectsApplied:true,stockChanged:true,taskUpdated:Boolean(taskResult),task:taskResult};
  assertOne(await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.execution.applied','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,project.id,JSON.stringify({version:1,organizationId:member.organizationId,projectId:project.id,workerId:p.workerId,actorId:member.actorId,requestDigest,outcome})]));return outcome;
 }
 return {apply,async finalize(client,outcome){const until=outcome.kind==='EXECUTION_MANDATE_ISSUED'?outcome.mandate.validUntil:outcome.kind==='EXECUTION_APPLIED'&&outcome.effectsApplied?outcome.execution.validUntil:null;if(until&&Date.parse(until)<=Date.parse(await clock(client)))fail('FIELD_EXECUTION_MANDATE_EXPIRED');},async readMandate(client,member,session,project,id){const {mandate:m}=await mandateRow(client,member.organizationId,project.id,id);if(!manages(member))await readReporter(client,member,session,project.id,m.request.workerId);if(!manages(member)&&member.actorId!==m.reporterActorId)fail('FIELD_EXECUTION_MANDATE_SCOPE',403);return publicMandate(id,m);}};
}
