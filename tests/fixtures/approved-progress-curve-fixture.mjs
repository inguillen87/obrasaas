// Synthetic rows reproducing the two canonical persisted writer formats.
// Public measurement snapshots come from the unchanged actual measurement helper.
import {createHash} from 'node:crypto';
import {TASK_MEASUREMENT_VERSION,publicTaskMeasurement,deriveTaskMeasurement} from '../../src/lib/task-progress-measurement.js';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const context={organizationId:'org_curve',projectId:'project_curve',taskId:'task_curve',scope:'c'.repeat(64)};
export const clone=value=>structuredClone(value);
// The real writers JSON.stringify their snapshots before PostgreSQL jsonb.
// Reproduce that wire boundary so adversarial mutations target decoded rows,
// rather than frozen helper results or shared JavaScript object aliases.
export function sourcePair(options={}){return JSON.parse(JSON.stringify(makeSourcePair(options)));}
function makeSourcePair({kind='HUMAN',index=1,executed='25.0000',previous='0.0000',baseline='100.0000',unit='M2',definitionId='measurement_curve',at='2026-10-20T13:00:00.000Z',legacy=false}={}){
 const proposalId=kind==='HUMAN'?'proposal_curve_'+index:'execution_progress_'+digest('execution_curve_'+index),workerId='worker_curve',actor='reporter_curve',reviewer='reviewer_curve',executionId='execution_curve_'+index;
 const definition={version:TASK_MEASUREMENT_VERSION,definitionId,baseline,unit,sourceReference:'Synthetic reviewed quantity',configuredBy:reviewer,configuredAt:new Date(Date.parse(at)-86400000).toISOString()};
 const initialProgress=Number(BigInt(previous.replace('.',''))*100n/BigInt(baseline.replace('.',''))),initial={id:context.taskId,title:'Synthetic task',progress:initialProgress,status:'IN_PROGRESS',metadata:{fieldOperations:{version:1,measurement:definition,...(previous!=='0.0000'?{approvedProposalId:'proposal_previous',approvedAt:'2026-10-19T13:00:00.000Z',quantity:{executed:previous,baseline,unit}}:{})}}};
 const measured=deriveTaskMeasurement(initial,{mode:'CUMULATIVE',quantity:executed});
 const internal={id:context.taskId,title:'Synthetic task',status:'IN_PROGRESS',progress:measured.progress,revision:at.replace('.000Z','.'+String(index).padStart(6,'0')),metadata:{fieldOperations:{version:1,measurement:definition,quantity:{executed,baseline,unit},approvedProposalId:proposalId,approvedAt:at}}};
 const snapshot={id:internal.id,title:internal.title,status:internal.status,progress:internal.progress,revision:internal.revision,...(!legacy?{measurement:publicTaskMeasurement(internal)}:{})};
 if(kind==='HUMAN'){
  const action={workerId,taskId:context.taskId,fieldOperationsVersion:1,progress:measured.progress,quantity:legacy?null:executed,baseline:legacy?null:baseline,unit:legacy?null:unit,reason:'Private synthetic note',evidenceIds:['evidence_curve'],submittedBy:actor,submittedAt:'2026-10-20T12:00:00.000Z',...(!legacy?{measurement:measured}:{})};
  const result={decision:'APPROVE',reason:'Private synthetic review',actorId:reviewer,recordedAt:at,task:snapshot,taskUpdated:true};
  const publicProposal={id:proposalId,workerId,taskId:context.taskId,status:'APPLIED',progress:action.progress,quantity:action.quantity,baseline:action.baseline,unit:action.unit,evidenceIds:action.evidenceIds,...(!legacy?{measurement:measured}:{}),result};
  return [{kind:'AUDIT',id:'field_'+digest(index),projectId:context.projectId,organizationId:context.organizationId,actorId:reviewer,entityType:'Project',auditAction:'field.operation.recorded',metadata:{version:1,projectId:context.projectId,command:'DECIDE_PROGRESS',requestDigest:digest(['human',index]),outcome:{kind:'PROGRESS_DECISION',proposal:publicProposal,task:snapshot}}},{kind:'PROPOSAL',id:proposalId,projectId:context.projectId,type:'TASK_PROGRESS',status:'APPLIED',sourceProvider:'account-field',sourceExternalId:digest(['human',index]),proposedByWorkerId:workerId,action,result:{fieldOperations:result}}];
 }
 const action={fieldExecutionVersion:1,taskId:context.taskId,measurement:measured,evidenceIds:['evidence_curve'],submittedBy:actor,mandateId:'mandate_curve',authorizedBy:reviewer};
 const execution={version:1,id:executionId,reportId:'report_curve_'+index,workerId,taskId:context.taskId,sectorId:'sector_curve',mandateId:'mandate_curve',authorizedBy:reviewer,executedBy:actor,recordedAt:at,receiptId:'field_'+digest(['wrapper',index]),measurement:measured};
 return [{kind:'AUDIT',id:executionId,projectId:context.projectId,organizationId:context.organizationId,actorId:actor,entityType:'Project',auditAction:'field.execution.applied',metadata:{version:1,organizationId:context.organizationId,projectId:context.projectId,workerId,actorId:actor,requestDigest:digest(['execution',index]),outcome:{kind:'EXECUTION_APPLIED',execution,executionReplay:false,effectsApplied:true,stockChanged:true,taskUpdated:true,task:snapshot}}},{kind:'PROPOSAL',id:proposalId,projectId:context.projectId,type:'TASK_PROGRESS',status:'APPLIED',sourceProvider:'field-execution-v1',sourceExternalId:executionId,proposedByWorkerId:workerId,action,result:{authorization:{mandateId:'mandate_curve',issuedBy:reviewer},taskUpdated:true}}];
}
