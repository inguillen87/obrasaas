import { TaskAssignmentError } from './task-assignment-policy.js';
import { OVERLAP_LIMITS } from './assignment-overlap-policy.js';

// Prisma's query relation strategy can dispatch relation queries concurrently.
// This reader batches each label type and awaits it on the existing transaction.
export async function readAssignmentReviewLabels(tx, scope, assignments) {
  const fail = () => { throw new TaskAssignmentError('No se confirmó el origen de las etiquetas de planificación.', 'ASSIGNMENT_REVIEW_INCONSISTENT', 503); };
  if (!Array.isArray(assignments) || assignments.length > OVERLAP_LIMITS.assignments
    || assignments.some(row => !row || row.projectId !== scope.projectId || !row.taskId)) fail();
  async function labels(model, field, textField) {
    const ids = [...new Set(assignments.map(row => row[field]).filter(Boolean))];
    if (!ids.length) return new Map();
    const records = await model.findMany({ where: { projectId: scope.projectId, id: { in: ids } },
      select: { id: true, projectId: true, [textField]: true }, take: ids.length });
    if (!Array.isArray(records) || records.length !== ids.length
      || new Set(records.map(row => row?.id)).size !== ids.length
      || records.some(row => !row || row.projectId !== scope.projectId || !ids.includes(row.id) || typeof row[textField] !== 'string')) fail();
    return new Map(records.map(row => [row.id, { [textField]: row[textField] }]));
  }
  const tasks = await labels(tx.task, 'taskId', 'title');
  const workers = await labels(tx.worker, 'workerId', 'name');
  const teams = await labels(tx.workTeam, 'teamId', 'name');
  return assignments.map(row => ({ ...row, task: tasks.get(row.taskId),
    worker: row.workerId ? workers.get(row.workerId) : null, team: row.teamId ? teams.get(row.teamId) : null }));
}
