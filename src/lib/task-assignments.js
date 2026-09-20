import { createHash } from 'node:crypto';
import { assignmentId, normalizeAssignmentPlan, normalizeAssignmentDecision, ASSIGNMENT_TRANSITIONS, TaskAssignmentError } from './task-assignment-policy.js';
import { createTaskAssignmentInTransaction } from './project-execution.js';
import { runOperationalProjectMutation, isOperationalProjectWriteStatus } from './project-write-policy.js';
import { subscriptionAllowsWrites } from './plans.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ACTION = 'execution.task.assignment.created';
const SELECT = { id:true,projectId:true,taskId:true,workerId:true,teamId:true,status:true,startsAt:true,endsAt:true,revision:true };
const iso = value => value ? new Date(value).toISOString() : null;
const publicRow = row => ({ ...row, startsAt:iso(row.startsAt), endsAt:iso(row.endsAt) });
const scopeOf = scope => ({ organizationId:assignmentId(scope?.organizationId),projectId:assignmentId(scope?.projectId) });
async function scopedProject(tx, scope, write = false) {
  const project = await tx.project.findFirst({ where:{id:scope.projectId,organizationId:scope.organizationId},select:{id:true,status:true,organization:true} });
  if (!project) throw new TaskAssignmentError('La obra no está disponible.','ASSIGNMENT_PROJECT_MISSING',404);
  if (write && !subscriptionAllowsWrites(project.organization,new Date())) throw new TaskAssignmentError('La empresa no admite nuevas escrituras.','ASSIGNMENT_READ_ONLY',402);
  return project;
}
async function taskIn(tx, scope, taskId) {
  const task = await tx.task.findFirst({where:{id:taskId,projectId:scope.projectId,type:'TASK',metadata:{path:['source'],equals:'canonical-task-v1'}},select:{id:true,title:true,type:true,revision:true}});
  if (!task) throw new TaskAssignmentError('La actividad no está disponible en esta obra.','ASSIGNMENT_TASK_MISSING',404);
  return task;
}
async function responsibleIn(tx, scope, plan) {
  const worker = plan.workerId ? await tx.worker.findFirst({where:{id:plan.workerId,projectId:scope.projectId,active:true},select:{id:true}}) : null;
  const team = plan.teamId ? await tx.workTeam.findFirst({where:{id:plan.teamId,projectId:scope.projectId,status:'ACTIVE'},select:{id:true}}) : null;
  if (plan.workerId && !worker || plan.teamId && !team || !plan.workerId && !plan.teamId) throw new TaskAssignmentError('La persona o cuadrilla ya no está activa en esta obra.','ASSIGNMENT_OWNER_UNAVAILABLE',409);
}
export async function prepareTaskAssignment(prisma,{scope:rawScope,taskId}) {
  const scope=scopeOf(rawScope);assignmentId(taskId);
  return prisma.$transaction(async tx=>{
    const project=await scopedProject(tx,scope),task=await taskIn(tx,scope,taskId);
    const [workers,teams]=await Promise.all([
      tx.worker.findMany({where:{projectId:scope.projectId,active:true},orderBy:[{name:'asc'},{id:'asc'}],take:101,select:{id:true,name:true}}),
      tx.workTeam.findMany({where:{projectId:scope.projectId,status:'ACTIVE'},orderBy:[{name:'asc'},{id:'asc'}],take:101,select:{id:true,name:true}}),
    ]);
    return {context:scope,task,canCreate:isOperationalProjectWriteStatus(project.status)&&subscriptionAllowsWrites(project.organization,new Date()),
      owners:{workers:workers.slice(0,100),teams:teams.slice(0,100),truncated:workers.length>100||teams.length>100}};
  },{isolationLevel:'RepeatableRead',timeout:10000});
}
export async function planTaskAssignment(prisma,{scope:rawScope,actorId,operationKey,input,beforeCreate=null,reviewContext=null}) {
  const scope=scopeOf(rawScope);assignmentId(actorId);const plan=normalizeAssignmentPlan(input);
  if(typeof operationKey!=='string'||!/^[A-Za-z0-9_-]{16,96}$/.test(operationKey))throw new TaskAssignmentError('La solicitud necesita una referencia de intento válida.');
  const key=digest(['assignment-plan-v1',scope,actorId,operationKey]),id='assignment_'+key,auditId='assignment_request_'+key,fingerprint=digest(reviewContext ? ['reviewed-plan-v1',plan,reviewContext] : plan);
  return runOperationalProjectMutation(prisma,scope,async tx=>{
    await scopedProject(tx,scope,true);
    const [existing,receipt]=await Promise.all([
      tx.taskAssignment.findFirst({where:{id,projectId:scope.projectId},select:SELECT}),
      tx.auditLog.findFirst({where:{id:auditId,organizationId:scope.organizationId,actorId,entityType:'TaskAssignment',entityId:id,action:ACTION}}),
    ]);
    if(existing||receipt){
      if(!receipt||receipt.metadata?.projectId!==scope.projectId||receipt.metadata?.requestFingerprint!==fingerprint)throw new TaskAssignmentError('El intento ya tiene otro contenido o requiere revisión de integridad.','ASSIGNMENT_ATTEMPT_CONFLICT',409);
      if(!existing)throw new TaskAssignmentError('La asignación de este intento ya no está disponible. No se recreó.','ASSIGNMENT_GONE',410);
      return {context:scope,assignment:publicRow(existing),replayed:true};
    }
    const task=await taskIn(tx,scope,plan.taskId);
    if(task.revision!==plan.expectedTaskRevision)throw new TaskAssignmentError('La actividad cambió. Volvé a consultarla antes de asignar.','ASSIGNMENT_TASK_CHANGED',409);
    await responsibleIn(tx,scope,plan);
    const duplicate=await tx.taskAssignment.findFirst({where:{projectId:scope.projectId,taskId:plan.taskId,workerId:plan.workerId,teamId:plan.teamId,
      startsAt:plan.startsAt?new Date(plan.startsAt):null,endsAt:plan.endsAt?new Date(plan.endsAt):null,status:{in:['PLANNED','ACTIVE']}},select:{id:true}});
    if(duplicate)throw new TaskAssignmentError('Ya existe una asignación pendiente o en curso para esa actividad, responsable y fechas. Revisá el listado.','ASSIGNMENT_DUPLICATE',409);
    const reviewedMetadata=beforeCreate ? await beforeCreate(tx,plan) : {};
    const created=await createTaskAssignmentInTransaction(tx,{scope,actorId,recordId:id,auditId,
      requestMetadata:{requestFingerprint:fingerprint,taskRevision:task.revision,source:'assignment-planner-v1',...reviewedMetadata},input:{...plan,status:'PLANNED'}});
    return {context:scope,assignment:created.assignment,replayed:false};
  });
}
async function readIn(tx,scope,id) {
  const row=await tx.taskAssignment.findFirst({where:{id,projectId:scope.projectId},select:SELECT});
  if(!row)throw new TaskAssignmentError('La asignación no está disponible en esta obra.','ASSIGNMENT_NOT_FOUND',404);
  const decision=await tx.auditLog.findFirst({where:{organizationId:scope.organizationId,entityType:'TaskAssignment',entityId:id,action:'execution.task.assignment.status_changed',metadata:{path:['projectId'],equals:scope.projectId}},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{metadata:true,createdAt:true}});
  const meta=decision?.metadata;
  const lastDecision=meta?.revision===row.revision&&meta?.status===row.status?{note:meta.note,status:meta.status,revision:meta.revision,at:iso(decision.createdAt)}:null;
  return {...publicRow(row),lastDecision};
}
export async function getTaskAssignment(prisma,{scope:rawScope,assignmentId:id}) {
  const scope=scopeOf(rawScope);assignmentId(id);
  return prisma.$transaction(async tx=>{await scopedProject(tx,scope);return {context:scope,assignment:await readIn(tx,scope,id)};},{isolationLevel:'RepeatableRead',timeout:10000});
}
export async function decideTaskAssignment(prisma,{scope:rawScope,actorId,assignmentId:id,input}) {
  const scope=scopeOf(rawScope);assignmentId(actorId);assignmentId(id);const decision=normalizeAssignmentDecision(input);
  return runOperationalProjectMutation(prisma,scope,async tx=>{
    await scopedProject(tx,scope,true);const row=await readIn(tx,scope,id);
    if(row.revision!==decision.expectedRevision)throw new TaskAssignmentError('La asignación cambió. Consultá su estado antes de repetir la decisión.','ASSIGNMENT_REVISION_CONFLICT',409);
    if(!ASSIGNMENT_TRANSITIONS[row.status]?.includes(decision.status))throw new TaskAssignmentError('Este estado no admite la transición solicitada. Los registros finalizados no se reabren por este circuito.','ASSIGNMENT_TRANSITION_INVALID',409);
    if(decision.status==='ACTIVE'){await taskIn(tx,scope,row.taskId);await responsibleIn(tx,scope,row);}
    const result=await tx.taskAssignment.updateMany({where:{id,projectId:scope.projectId,revision:decision.expectedRevision,status:row.status},data:{status:decision.status,revision:{increment:1}}});
    if(result.count!==1)throw new TaskAssignmentError('La versión ya no coincide. Consultá el estado.','ASSIGNMENT_REVISION_CONFLICT',409);
    await tx.auditLog.create({data:{organizationId:scope.organizationId,actorId,entityType:'TaskAssignment',entityId:id,action:'execution.task.assignment.status_changed',
      metadata:{projectId:scope.projectId,taskId:row.taskId,previousStatus:row.status,status:decision.status,revision:row.revision+1,note:decision.note}}});
    return {context:scope,assignment:await readIn(tx,scope,id)};
  });
}
