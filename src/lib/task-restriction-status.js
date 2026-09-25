const STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']);
const PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const ISO = value => value == null ? null : new Date(value).toISOString();
// The caller provides the transaction shared with the task snapshot.
export async function readTaskRestrictionStatus(tx, { organizationId, projectId, taskIds, now = new Date() }) {
  if (![organizationId, projectId].every(value => typeof value === 'string' && ID.test(value))) throw new Error('Invalid restriction scope');
  const at = new Date(now);
  if (!Number.isFinite(at.getTime())) throw new Error('Invalid restriction observation time');
  if (!Array.isArray(taskIds) || taskIds.length > 50 || !taskIds.every(id => typeof id === 'string' && ID.test(id)) || new Set(taskIds).size !== taskIds.length) throw new Error('Unbounded restriction scope');
  const result = new Map(taskIds.map(id => [id, { active: 0, open: 0, inProgress: 0, critical: 0, high: 0, resolved: 0, cancelled: 0, earliestDueAt: null, overdue: false, updatedAt: null }]));
  if (!taskIds.length) return result;
  const groups = await tx.projectBlocker.groupBy({ by: ['taskId', 'status', 'severity'],
    where: { projectId, project: { organizationId }, taskId: { in: taskIds } },
    _count: { _all: true }, _min: { dueAt: true }, _max: { updatedAt: true },
    orderBy: [{ taskId: 'asc' }, { status: 'asc' }, { severity: 'asc' }] });
  for (const group of groups) {
    const row = result.get(group.taskId), count = group._count?._all;
    if (!row || !STATUSES.has(group.status) || !PRIORITIES.has(group.severity) || !Number.isSafeInteger(count) || count < 0) throw new Error('Inconsistent restriction aggregation');
    const active = group.status === 'OPEN' || group.status === 'IN_PROGRESS';
    const stateKey = { OPEN: 'open', IN_PROGRESS: 'inProgress', RESOLVED: 'resolved', CANCELLED: 'cancelled' }[group.status];
    row[stateKey] += count;
    if (active) {
      row.active += count;
      if (group.severity === 'CRITICAL') row.critical += count;
      if (group.severity === 'HIGH') row.high += count;
    }
    const due = active && count > 0 ? ISO(group._min?.dueAt) : null;
    if (due && (!row.earliestDueAt || due < row.earliestDueAt)) row.earliestDueAt = due;
    const updated = ISO(group._max?.updatedAt);
    if (updated && (!row.updatedAt || updated > row.updatedAt)) row.updatedAt = updated;
    row.overdue = Boolean(row.earliestDueAt && row.earliestDueAt < at.toISOString());
  }
  return result;
}
