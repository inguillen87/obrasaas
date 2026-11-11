import {WorkspaceError} from './workspace-policy.mjs';
import {approvedProgressContext,approvedProgressHistory,approvedProgressPage,APPROVED_PROGRESS_LIMITS} from './approved-progress-curve.mjs';

// One canonical repeatable-read/read-only transaction scans the bounded source.
// No SQL Task progress, names, employees, free text or media enters the DTO.
export const APPROVED_PROGRESS_SOURCE_SQL=`
SELECT 'AUDIT' AS kind,a.id,a."entityId" AS "projectId",a."organizationId" AS "organizationId",a."actorId" AS "actorId",NULL::text AS "proposedByWorkerId",a."entityType" AS "entityType",a.action AS "auditAction",a.metadata,
 NULL::text AS type,NULL::text AS status,NULL::text AS "sourceProvider",NULL::text AS "sourceExternalId",NULL::jsonb AS action,NULL::jsonb AS result
FROM public."AuditLog" a
WHERE a."organizationId"=$1 AND a."entityId"=$2 AND a."entityType"='Project' AND (
 (a.action='field.operation.recorded' AND a.metadata->>'command'='DECIDE_PROGRESS' AND (a.metadata#>>'{outcome,proposal,taskId}'=$3 OR a.metadata#>>'{outcome,task,id}'=$3)) OR
 (a.action='field.execution.applied' AND (a.metadata#>>'{outcome,execution,taskId}'=$3 OR a.metadata#>>'{outcome,task,id}'=$3)))
UNION ALL
SELECT 'PROPOSAL' AS kind,p.id,p."projectId" AS "projectId",NULL::text AS "organizationId",NULL::text AS "actorId",p."proposedByWorkerId",NULL::text AS "entityType",NULL::text AS "auditAction",NULL::jsonb AS metadata,
 p.type::text AS type,p.status::text AS status,p."sourceProvider",p."sourceExternalId",p.action,p.result
FROM public."OperationalProposal" p
WHERE p."projectId"=$2 AND p.type='TASK_PROGRESS' AND p.status='APPLIED' AND p.action->>'taskId'=$3
ORDER BY kind,id LIMIT $4`;

export function createApprovedProgressCurveReader({workspace,canReview}){
 if(typeof workspace?.projectOperation!=='function'||typeof canReview!=='function')throw new TypeError('Canonical workspace and role policy required');
 return async(session,raw)=>{
  const context=approvedProgressContext(raw);
  return workspace.projectOperation(session,context,false,async(client,member,scope,project)=>{
   if(!canReview(member.role))throw new WorkspaceError('APPROVED_PROGRESS_PERMISSION_REQUIRED',403);
   if(scope!==context.scope||project.id!==context.projectId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
   const task=(await client.query('SELECT id FROM public."Task" WHERE id=$1 AND "projectId"=$2',[context.taskId,context.projectId])).rows;
   if(task.length!==1||task[0].id!==context.taskId)throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);
   const rows=(await client.query(APPROVED_PROGRESS_SOURCE_SQL,[member.organizationId,context.projectId,context.taskId,APPROVED_PROGRESS_LIMITS.sourceRows+1])).rows;
   try{return approvedProgressPage(approvedProgressHistory(rows,{...context,organizationId:member.organizationId}),context);}
   catch(error){
    if(!(error instanceof WorkspaceError)||['APPROVED_PROGRESS_CURSOR_INVALID','APPROVED_PROGRESS_SOURCE_CHANGED'].includes(error.code))throw error;
    return {version:1,kind:'APPROVED_PROGRESS_CURVE',scope,projectId:context.projectId,taskId:context.taskId,state:'INCOMPLETE',sourceScanComplete:false,coverage:'RETAINED_ACCOUNT_FIELD_AND_FIELD_EXECUTION_V1_ONLY',beforeFirst:'UNOBSERVED',timeMeaning:'APPROVAL_OR_AUTHORIZED_RECORD_TIME',snapshot:null,offset:0,total:null,rows:[],nextCursor:null,reason:error.code};
   }
  });
 };
}
