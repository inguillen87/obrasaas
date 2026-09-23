import { assignmentId, TaskAssignmentError } from './task-assignment-policy.js';

// Call only after scope/plan validation. Mutations must hold the project lock.
// Exact duplicates are different from overlaps that can be explicitly coordinated.
export async function assertAssignmentPeriodUnique(tx, scope, plan, excludeAssignmentId = null) {
  assignmentId(scope.organizationId);
  const projectId = assignmentId(scope.projectId);
  const taskId = assignmentId(plan.taskId);
  if (excludeAssignmentId !== null) assignmentId(excludeAssignmentId);
  const duplicate = await tx.taskAssignment.findFirst({
    where: {
      projectId, taskId, workerId: plan.workerId, teamId: plan.teamId,
      startsAt: plan.startsAt ? new Date(plan.startsAt) : null,
      endsAt: plan.endsAt ? new Date(plan.endsAt) : null,
      status: { in: ['PLANNED', 'ACTIVE'] },
      ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new TaskAssignmentError(
    'Ya existe una asignación pendiente o en curso para esa actividad, responsable y fechas. Ajustá el período o revisá la asignación existente.',
    'ASSIGNMENT_DUPLICATE', 409,
  );
}
