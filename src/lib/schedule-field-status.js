import { createHash } from 'node:crypto';
import { readTaskRestrictionStatus } from './task-restriction-status.js';
import { normalizeProgressMeasurementQuantity, progressMeasurementPercent, compareProgressMeasurementQuantities } from './progress-measurement-quantity.js';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export const FIELD_STATUS_PAGE_SIZE = 50;
export class ScheduleFieldStatusError extends Error {
  constructor(message, code = 'FIELD_STATUS_INVALID', status = 400) { super(message); this.code = code; this.status = status; }
}
function identifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new ScheduleFieldStatusError('El identificador de contexto no es válido.');
  return value;
}
export function fieldStatusQuery(params) {
  for (const key of params.keys()) if (!['taskId', 'after'].includes(key) || params.getAll(key).length !== 1) throw new ScheduleFieldStatusError('Consulta no admitida.');
  if (params.has('taskId') && params.has('after')) throw new ScheduleFieldStatusError('No combines tarea con paginación.');
  return { taskId: params.has('taskId') ? identifier(params.get('taskId')) : null, after: params.has('after') ? identifier(params.get('after')) : null };
}
const iso = value => value ? new Date(value).toISOString() : null;
function counts(groups, taskId) {
  const result = { total: 0, approved: 0, pending: 0, rejected: 0, updatedAt: null };
  for (const row of groups.filter(item => item.taskId === taskId)) {
    const count = row._count._all; result.total += count;
    if (row.status === 'APPROVED') result.approved += count;
    else if (row.status === 'REJECTED') result.rejected += count;
    else result.pending += count;
    const date = iso(row._max.updatedAt);
    if (date && (!result.updatedAt || date > result.updatedAt)) result.updatedAt = date;
  }
  return result;
}
function measuredBalance(balance) {
  if (!balance) return null;
  const baseline = normalizeProgressMeasurementQuantity(balance.baseQuantity.toString(), { allowZero: false });
  const completed = normalizeProgressMeasurementQuantity(balance.approvedCumulativeQuantity.toString());
  if (compareProgressMeasurementQuantities(completed, baseline) > 0) throw new ScheduleFieldStatusError('La medición requiere conciliación.', 'FIELD_STATUS_INCONSISTENT', 503);
  return { percent: progressMeasurementPercent(completed, baseline), baseline, completed, unit: balance.unitCode, revision: balance.revision, updatedAt: iso(balance.updatedAt), measurementId: balance.lastApprovedMeasurementId };
}
export async function readScheduleFieldStatus(prisma, { scope, query = {}, canReadMeasurements = false, now = new Date() }) {
  const organizationId = identifier(scope?.organizationId), projectId = identifier(scope?.projectId);
  const taskId = query.taskId ? identifier(query.taskId) : null;
  const after = query.after ? identifier(query.after) : null;
  if (taskId && after) throw new ScheduleFieldStatusError('Consulta incompatible.');
  return prisma.$transaction(async tx => {
    const project = await tx.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true, name: true } });
    if (!project) throw new ScheduleFieldStatusError('Obra no disponible.', 'FIELD_STATUS_NOT_FOUND', 404);
    const tasks = await tx.task.findMany({ where: { projectId, metadata: { path: ['source'], equals: 'canonical-task-v1' }, ...(taskId ? { id: taskId } : after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' }, take: FIELD_STATUS_PAGE_SIZE + 1, select: { id: true, title: true, type: true, progress: true, revision: true, startsAt: true, endsAt: true, updatedAt: true } });
    if (taskId && tasks.length === 0) throw new ScheduleFieldStatusError('Tarea no disponible en esta obra.', 'FIELD_STATUS_NOT_FOUND', 404);
    const visible = tasks.slice(0, FIELD_STATUS_PAGE_SIZE), taskIds = visible.map(row => row.id);
    const where = { projectId, taskId: { in: taskIds } };
    const [evidence, logs, balances, unassignedParts] = await Promise.all([
      taskIds.length ? tx.progressEvidence.groupBy({ by: ['taskId', 'status'], where, _count: { _all: true }, _max: { updatedAt: true } }) : [],
      taskIds.length ? tx.dailyLog.groupBy({ by: ['taskId', 'status'], where, _count: { _all: true }, _max: { updatedAt: true } }) : [],
      canReadMeasurements && taskIds.length ? tx.taskProgressMeasurementBalance.findMany({ where: { ...where, organizationId }, select: { taskId: true, baseQuantity: true, approvedCumulativeQuantity: true, unitCode: true, revision: true, updatedAt: true, lastApprovedMeasurementId: true } }) : [],
      tx.dailyLog.count({ where: { projectId, taskId: null } }),
    ]);
    const restrictions = await readTaskRestrictionStatus(tx, { organizationId, projectId, taskIds, now });
    const assignmentGroups = taskIds.length ? await tx.taskAssignment.groupBy({ by: ['taskId','status'], where: { ...where, project: { organizationId } }, _count: { _all: true } }) : [];
    const assignments = new Map(taskIds.map(id => [id, { planned: 0, active: 0, ended: 0, cancelled: 0 }]));
    for (const group of assignmentGroups) {
      const key = { PLANNED:'planned',ACTIVE:'active',ENDED:'ended',CANCELLED:'cancelled' }[group.status];
      if (!assignments.has(group.taskId) || !key || !Number.isSafeInteger(group._count?._all) || group._count._all < 0) throw new ScheduleFieldStatusError('No se pudo confirmar el resumen de asignaciones.', 'FIELD_STATUS_INCONSISTENT', 503);
      assignments.get(group.taskId)[key] += group._count._all;
    }
    const payload = { organizationId, projectId, projectName: project.name, canReadMeasurements, unassignedParts,
      tasks: visible.map(task => ({ id: task.id, title: task.title, type: task.type, operationalProgress: task.progress, revision: task.revision,
        startsAt: iso(task.startsAt), endsAt: iso(task.endsAt), updatedAt: iso(task.updatedAt),
        evidence: counts(evidence, task.id), reports: counts(logs, task.id), restrictions: restrictions.get(task.id), assignments: assignments.get(task.id),
        measured: canReadMeasurements ? measuredBalance(balances.find(row => row.taskId === task.id)) : null })),
      page: { limit: FIELD_STATUS_PAGE_SIZE, hasMore: tasks.length > FIELD_STATUS_PAGE_SIZE, nextAfter: tasks.length > FIELD_STATUS_PAGE_SIZE ? visible.at(-1).id : null },
    };
    return { ...payload, version: createHash('sha256').update(JSON.stringify(payload)).digest('hex'), checkedAt: new Date().toISOString() };
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
