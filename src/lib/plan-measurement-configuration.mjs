import {WorkspaceError,workspaceId} from './workspace-policy.mjs';
import {assertMeasurementConfiguration,publicTaskMeasurement} from './task-progress-measurement.js';

// Import adds explicit replacement proof around the existing measurement guard.
// It does not reinterpret an approved quantity or silently overwrite a zero.
export function assertImportedMeasurementConfiguration(task,row,destination){
 let configured;try{configured=assertMeasurementConfiguration(task,{baseline:row.baseline,unit:row.unit});}catch(error){if(error?.name==='TaskProgressMeasurementError')throw new WorkspaceError(error.code,error.status);throw error;}
 const source=task.metadata?.planMeasurementSource,legacy=task.metadata?.planImport;
 if(Object.hasOwn(task.metadata||{},'planMeasurementSource')){
  const keys=['version','purpose','sourceSha256','sourceDigest','sourceRowId','sourceCode','sourceTitle','draftId','reviewDigest','sourceMaker','reviewedBy','appliedBy','appliedAt','reason','association','previousDefinition'];
  if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).sort().join('|')!==keys.sort().join('|')||source.version!==1||source.purpose!=='PHYSICAL_TASK_MEASUREMENT'||![source.sourceSha256,source.sourceDigest,source.reviewDigest].every(value=>/^[a-f0-9]{64}$/.test(value||''))||typeof source.sourceRowId!=='string'||!source.sourceRowId.length||source.sourceCode!==null&&!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(source.sourceCode||'')||typeof source.sourceTitle!=='string'||![source.draftId,source.sourceMaker,source.reviewedBy,source.appliedBy].every(workspaceId)||!['CREATE','EXISTING'].includes(source.association)||typeof source.appliedAt!=='string'||!Number.isFinite(Date.parse(source.appliedAt))||typeof source.reason!=='string'||source.previousDefinition!==null&&(!source.previousDefinition||typeof source.previousDefinition!=='object')||source.sourceCode!==row.code)throw new WorkspaceError('PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED',409);
 }
 if(Object.hasOwn(task.metadata||{},'planImport')){
  if(!legacy||typeof legacy!=='object'||Array.isArray(legacy)||Object.hasOwn(legacy,'code')&&(![1,4].includes(legacy.version)||!['CYP_PARTIDAS','CYP_PARTIDAS_CURVE'].includes(legacy.profile)||typeof legacy.code!=='string'||legacy.code!==row.code))throw new WorkspaceError('PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED',409);
 }
 const definition=publicTaskMeasurement(task),field=task.metadata?.fieldOperations;
 if(field?.quantity||definition?.approvedProposalId)throw new WorkspaceError('TASK_MEASUREMENT_BASELINE_LOCKED',409);
 if(Object.hasOwn(field||{},'measurement')){
  if(!definition||destination.replacement!=='REPLACE_UNSEALED'||destination.expectedDefinitionId!==definition.definitionId||destination.confirmReplacement!==true)throw new WorkspaceError('PLAN_MEASUREMENT_REPLACEMENT_REQUIRED',409);
 }else if(destination.replacement!=='CONFIGURE'||destination.expectedDefinitionId!==null||destination.confirmReplacement!==false)throw new WorkspaceError('PLAN_MEASUREMENT_DEFINITION_CHANGED',409);
 return configured;
}
export async function assertNoPendingImportedProgress(client,projectId,taskId){
 // Expired proposals remain consultable; this import does not resolve them.
 // A pending proposal, including one awaiting expiry reconciliation, blocks.
 const pending=(await client.query(`SELECT id FROM public."OperationalProposal" WHERE "projectId"=$1 AND type='TASK_PROGRESS' AND "sourceProvider"='account-field' AND status='PENDING' AND action->>'fieldOperationsVersion'='1' AND action->>'taskId'=$2 LIMIT 1`,[projectId,taskId])).rows;
 if(pending.length)throw new WorkspaceError('FIELD_PROGRESS_REVIEW_PENDING',409);
}
