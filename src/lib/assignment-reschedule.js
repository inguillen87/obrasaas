import { createHash } from 'node:crypto';
import { assertAssignmentPeriodUnique } from './assignment-period-uniqueness.js';
import { assignmentId, TaskAssignmentError } from './task-assignment-policy.js';
import { normalizeReschedule, reschedulePlan, rescheduleScope, rescheduleSupported } from './assignment-reschedule-policy.js';
import { reviewAssignmentInTransaction } from './assignment-overlap-review.js';
import { runOperationalProjectMutation, isOperationalProjectWriteStatus } from './project-write-policy.js';
import { subscriptionAllowsWrites } from './plans.js';
const ACTION = 'execution.task.assignment.rescheduled';
const SELECT = { id:true,projectId:true,taskId:true,workerId:true,teamId:true,status:true,revision:true,startsAt:true,endsAt:true };
const stamp = value => value ? new Date(value).toISOString() : null;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function snapshotIn(tx,scope,id) {
  const project = await tx.project.findFirst({where:{id:scope.projectId,organizationId:scope.organizationId},select:{id:true,status:true,organization:true}});
  if (!project) throw new TaskAssignmentError('La obra no está disponible.','ASSIGNMENT_PROJECT_MISSING',404);
  const row = await tx.taskAssignment.findFirst({where:{id,projectId:scope.projectId},select:SELECT});
  if (!row) throw new TaskAssignmentError('La asignación no está disponible en esta obra.','ASSIGNMENT_NOT_FOUND',404);
  const task = await tx.task.findFirst({where:{id:row.taskId,projectId:scope.projectId,type:'TASK',metadata:{path:['source'],equals:'canonical-task-v1'}},select:{id:true,title:true,revision:true}});
  if (!task) throw new TaskAssignmentError('La actividad no está disponible para este circuito.','ASSIGNMENT_TASK_MISSING',404);
  // Sequential queries preserve the single transaction connection's contract.
  const worker = row.workerId ? await tx.worker.findFirst({where:{id:row.workerId,projectId:scope.projectId},select:{name:true,active:true}}) : null;
  const team = row.teamId ? await tx.workTeam.findFirst({where:{id:row.teamId,projectId:scope.projectId},select:{name:true,status:true}}) : null;
  const assignment = {...row,startsAt:stamp(row.startsAt),endsAt:stamp(row.endsAt)};
  const receipt = await tx.auditLog.findFirst({where:{organizationId:scope.organizationId,entityType:'TaskAssignment',entityId:id,action:ACTION,
    metadata:{path:['projectId'],equals:scope.projectId}},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{metadata:true,createdAt:true}});
  const meta = receipt?.metadata;
  const matches = Number.isSafeInteger(meta?.revision) && meta.revision <= row.revision && meta.startsAt === assignment.startsAt && meta.endsAt === assignment.endsAt && typeof meta.note === 'string';
  return {context:scope,assignment,task,ownerLabel:[worker?.name,team?.name].filter(Boolean).join(' · ') || 'Responsable no disponible',
    writable:isOperationalProjectWriteStatus(project.status) && subscriptionAllowsWrites(project.organization,new Date()) && rescheduleSupported(assignment)
      && (row.workerId ? worker?.active === true : team?.status === 'ACTIVE'),
    lastReschedule:matches ? {previousRevision:meta.previousRevision,revision:meta.revision,previousStartsAt:meta.previousStartsAt,previousEndsAt:meta.previousEndsAt,
      reviewVersion:meta.reviewVersion,note:meta.note,at:stamp(receipt.createdAt)} : null};
}
function assertChange(snapshot,command) {
  const row = snapshot.assignment;
  if (!snapshot.writable) throw new TaskAssignmentError('Sólo se reprograman asignaciones planificadas, con un responsable activo y fechas de calendario compatibles, en una obra habilitada.','ASSIGNMENT_REPLAN_UNAVAILABLE',409);
  if (row.revision !== command.expectedRevision) throw new TaskAssignmentError('La asignación cambió. Consultá su versión antes de volver a revisar fechas.','ASSIGNMENT_REPLAN_STALE',409);
  if (row.startsAt === command.startsAt && row.endsAt === command.endsAt) throw new TaskAssignmentError('Las fechas propuestas son iguales a las actuales. No hace falta guardar otra decisión.','ASSIGNMENT_REPLAN_UNCHANGED',422);
}
async function reviewIn(tx,scope,id,command) {
  const snapshot = await snapshotIn(tx,scope,id); assertChange(snapshot,command);
  const plan = reschedulePlan(snapshot,command);
  await assertAssignmentPeriodUnique(tx,scope,plan,snapshot.assignment.id);
  // The ID comes from a scoped row, never from an arbitrary exclusion in input.
  const overlap = await reviewAssignmentInTransaction(tx,scope,plan,{excludeAssignmentId:snapshot.assignment.id});
  const before = {revision:snapshot.assignment.revision,startsAt:snapshot.assignment.startsAt,endsAt:snapshot.assignment.endsAt};
  const proposed = {startsAt:command.startsAt,endsAt:command.endsAt};
  return {context:scope,assignmentId:id,before,proposed,overlap,
    version:hash({algorithm:'assignment-reschedule-v1',scope,id,before,proposed,overlapVersion:overlap.version}),snapshot};
}
export async function getAssignmentReschedule(prisma,{scope:rawScope,assignmentId:id}) {
  const scope = rescheduleScope(rawScope); assignmentId(id);
  return prisma.$transaction(tx=>snapshotIn(tx,scope,id),{isolationLevel:'RepeatableRead',timeout:10000});
}
export async function reviewAssignmentReschedule(prisma,{scope:rawScope,assignmentId:id,input}) {
  const scope = rescheduleScope(rawScope); assignmentId(id); const command = normalizeReschedule(input);
  return prisma.$transaction(async tx=>{const result=await reviewIn(tx,scope,id,command);delete result.snapshot;return result;},{isolationLevel:'RepeatableRead',timeout:10000});
}
export async function commitAssignmentReschedule(prisma,{scope:rawScope,assignmentId:id,actorId,input}) {
  const scope = rescheduleScope(rawScope); assignmentId(id); assignmentId(actorId); const command = normalizeReschedule(input,true);
  return runOperationalProjectMutation(prisma,scope,async tx=>{
    const actual = await reviewIn(tx,scope,id,command);
    if (actual.version !== command.reviewVersion) throw new TaskAssignmentError('Cambiaron las asignaciones, integrantes o actividad desde la revisión. Revisá otra vez; no se guardaron fechas.','ASSIGNMENT_REPLAN_REVIEW_CHANGED',409);
    const before = actual.snapshot.assignment;
    const saved = await tx.taskAssignment.updateMany({where:{id,projectId:scope.projectId,status:'PLANNED',revision:command.expectedRevision},
      data:{startsAt:command.startsAt?new Date(command.startsAt):null,endsAt:command.endsAt?new Date(command.endsAt):null,revision:{increment:1}}});
    if (saved.count !== 1) throw new TaskAssignmentError('Otra operación modificó la asignación. Consultá su estado.','ASSIGNMENT_REPLAN_STALE',409);
    await tx.auditLog.create({data:{organizationId:scope.organizationId,actorId,entityType:'TaskAssignment',entityId:id,action:ACTION,
      metadata:{projectId:scope.projectId,taskId:before.taskId,previousRevision:before.revision,revision:before.revision+1,previousStartsAt:before.startsAt,previousEndsAt:before.endsAt,
        startsAt:command.startsAt,endsAt:command.endsAt,reviewVersion:actual.version,overlapSummary:actual.overlap.summary,note:command.note}}});
    return snapshotIn(tx,scope,id);
  });
}
