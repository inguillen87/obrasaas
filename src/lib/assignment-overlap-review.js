import { readAssignmentReviewLabels } from './assignment-review-labels.js';
import { createHash } from 'node:crypto';
import { assignmentId, normalizeAssignmentPlan, TaskAssignmentError } from './task-assignment-policy.js';
import { analyzeAssignmentOverlap, calendarWindow, OVERLAP_LIMITS, reviewedAssignmentInput } from './assignment-overlap-policy.js';
import { planTaskAssignment } from './task-assignments.js';
const scopeOf = value => ({ organizationId: assignmentId(value?.organizationId), projectId: assignmentId(value?.projectId) });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp = value => value ? new Date(value).toISOString() : null;
export async function reviewAssignmentInTransaction(tx, scope, plan, { excludeAssignmentId = null } = {}) {
  if (excludeAssignmentId !== null) assignmentId(excludeAssignmentId);
  const project = await tx.project.findFirst({ where: { id: scope.projectId, organizationId: scope.organizationId }, select: { id: true } });
  if (!project) throw new TaskAssignmentError('La obra no está disponible.', 'ASSIGNMENT_PROJECT_MISSING', 404);
  const task = await tx.task.findFirst({ where: { id: plan.taskId, projectId: scope.projectId, type: 'TASK', metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true, revision: true } });
  if (!task || task.revision !== plan.expectedTaskRevision) throw new TaskAssignmentError('La actividad cambió. Cerrá y volvé a consultar su versión.', 'ASSIGNMENT_TASK_CHANGED', 409);
  const owner = plan.workerId
    ? await tx.worker.findFirst({ where: { id: plan.workerId, projectId: scope.projectId, active: true }, select: { id: true } })
    : await tx.workTeam.findFirst({ where: { id: plan.teamId, projectId: scope.projectId, status: 'ACTIVE' }, select: { id: true } });
  if (!owner) throw new TaskAssignmentError('El responsable ya no está activo en esta obra.', 'ASSIGNMENT_OWNER_UNAVAILABLE', 409);
  const window = calendarWindow(plan), clauses = [];
  if (Number.isFinite(window.end)) clauses.push({ OR: [{ startsAt: null }, { startsAt: { lt: new Date(window.end) } }] });
  if (Number.isFinite(window.start)) clauses.push({ OR: [{ endsAt: null }, { endsAt: { gte: new Date(window.start) } }] });
  const memberClauses = [];
  if (Number.isFinite(window.end)) memberClauses.push({ startsAt: { lt: new Date(window.end) } });
  if (Number.isFinite(window.start)) memberClauses.push({ OR: [{ endsAt: null }, { endsAt: { gt: new Date(window.start) } }] });
  const memberSelect = { id:true,projectId:true,teamId:true,workerId:true,startsAt:true,endsAt:true,revision:true };
  const membershipQuery = filter => tx.workTeamMember.findMany({ where:{projectId:scope.projectId,AND:memberClauses,...filter},orderBy:{id:'asc'},take:OVERLAP_LIMITS.memberships+1,select:memberSelect });
  const initialMembers = await membershipQuery(plan.workerId ? {workerId:plan.workerId} : {teamId:plan.teamId});
  if(initialMembers.length>OVERLAP_LIMITS.memberships) throw new TaskAssignmentError('La consulta supera el límite de participaciones. No se confirmó la revisión.', 'ASSIGNMENT_REVIEW_TOO_LARGE',503);
  const workerIds = [...new Set([plan.workerId,...initialMembers.map(row=>row.workerId)].filter(Boolean))];
  const memberships = plan.teamId && workerIds.length ? await membershipQuery({workerId:{in:workerIds}}) : initialMembers;
  if(memberships.length>OVERLAP_LIMITS.memberships) throw new TaskAssignmentError('La consulta supera el límite de participaciones. No se confirmó la revisión.', 'ASSIGNMENT_REVIEW_TOO_LARGE',503);
  if(memberships.some(row=>row.projectId!==scope.projectId||!workerIds.includes(row.workerId))) throw new TaskAssignmentError('Las participaciones no corresponden a esta obra.', 'ASSIGNMENT_REVIEW_INCONSISTENT',503);
  const teamIds = [...new Set([plan.teamId,...memberships.map(row=>row.teamId)].filter(Boolean))];
  const rows = await tx.taskAssignment.findMany({ where: { ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}), projectId:scope.projectId,project:{organizationId:scope.organizationId},status:{in:['PLANNED','ACTIVE']},AND:clauses,
      OR:[{workerId:{in:workerIds}},{teamId:{in:teamIds}}] },orderBy:{id:'asc'},take:OVERLAP_LIMITS.assignments+1,
    select:{id:true,projectId:true,taskId:true,workerId:true,teamId:true,startsAt:true,endsAt:true,status:true,revision:true} });
  if(rows.length>OVERLAP_LIMITS.assignments) throw new TaskAssignmentError('Hay demasiadas asignaciones relacionadas. Delimitá el período; no se descartaron registros.', 'ASSIGNMENT_REVIEW_TOO_LARGE',503);
  if(rows.some(row=>row.projectId!==scope.projectId || excludeAssignmentId && row.id===excludeAssignmentId)) throw new TaskAssignmentError('No se confirmó el origen de las asignaciones.', 'ASSIGNMENT_REVIEW_INCONSISTENT',503);
  const labeledRows = await readAssignmentReviewLabels(tx, scope, rows);
  const assignments = labeledRows.map(row => ({ id: row.id, taskId: row.taskId, workerId: row.workerId, teamId: row.teamId, status: row.status,
    revision: row.revision, startsAt: stamp(row.startsAt), endsAt: stamp(row.endsAt), taskTitle: row.task.title,
    ownerLabel: [row.worker?.name, row.team?.name].filter(Boolean).join(' · ') || 'Responsable registrado' }));
  const members = memberships.map(row => ({ id: row.id, teamId: row.teamId, workerId: row.workerId, revision: row.revision, startsAt: stamp(row.startsAt), endsAt: stamp(row.endsAt) }));
  const analyzed = analyzeAssignmentOverlap(plan, assignments, members);
  const version = hash({ algorithm: 'calendar-overlap-v1', scope, plan, assignments, members });
  return { context: scope, plan, version, warnings: analyzed.warnings, summary: analyzed.summary, totalFindings: analyzed.findings.length,
    findings: analyzed.findings.slice(0, OVERLAP_LIMITS.samples), checkedAt: new Date().toISOString(),
    coverage: { assignments: rows.length, memberships: members.length, calendar: 'UTC_DATE_INCLUSIVE', projectOnly: true } };
}
export async function reviewTaskAssignment(prisma, { scope: rawScope, input }) {
  const scope = scopeOf(rawScope), plan = normalizeAssignmentPlan(input);
  return prisma.$transaction(tx => reviewAssignmentInTransaction(tx, scope, plan), { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
export async function planReviewedTaskAssignment(prisma, options) {
  const { raw, review } = reviewedAssignmentInput(options.input), scope = scopeOf(options.scope);
  return planTaskAssignment(prisma, { ...options, scope, input: raw, reviewContext: review, beforeCreate: async (tx, plan) => {
    const actual = await reviewAssignmentInTransaction(tx, scope, plan);
    if (actual.version !== review.version) throw new TaskAssignmentError('La planificación o los integrantes cambiaron. Volvé a revisar las coincidencias; no se creó una asignación.', 'ASSIGNMENT_REVIEW_CHANGED', 409);
    if (actual.warnings && review.reason.length < 8) throw new TaskAssignmentError('Explicá cómo se coordinarán las coincidencias o los datos pendientes, con al menos 8 caracteres.', 'ASSIGNMENT_REVIEW_REASON_REQUIRED', 422);
    return { reviewVersion: actual.version, reviewSummary: actual.summary, coordinationReason: review.reason, reviewAlgorithm: 'calendar-overlap-v1' };
  } });
}
