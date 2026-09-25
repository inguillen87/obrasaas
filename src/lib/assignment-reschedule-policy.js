import { assignmentId, assignmentRecordMatches, normalizeAssignmentPlan, TaskAssignmentError } from './task-assignment-policy.js';
import { assignmentReviewMatches } from './assignment-overlap-policy.js';
const HEX = /^[a-f0-9]{64}$/;
const date = value => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new TaskAssignmentError('Usá una fecha de calendario válida.');
  const iso = value + 'T00:00:00.000Z';
  if (!Number.isFinite(new Date(iso).getTime()) || new Date(iso).toISOString() !== iso) throw new TaskAssignmentError('La fecha indicada no existe.');
  return iso;
};
export function normalizeReschedule(input, commit = false) {
  const allowed = ['expectedRevision','startsOn','endsOn', ...(commit ? ['reviewVersion','note','confirmed'] : [])];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
    || !Object.hasOwn(input,'startsOn') || !Object.hasOwn(input,'endsOn')) throw new TaskAssignmentError('La reprogramación requiere revisión y fechas explícitas.');
  const startsAt = date(input.startsOn), endsAt = date(input.endsOn);
  if (endsAt && (!startsAt || endsAt < startsAt)) throw new TaskAssignmentError('El fin requiere un inicio anterior o del mismo día.');
  const normalized = { expectedRevision: input.expectedRevision, startsAt, endsAt };
  if (commit) {
    if (input.confirmed !== true || typeof input.reviewVersion !== 'string' || !HEX.test(input.reviewVersion)) throw new TaskAssignmentError('Revisá las coincidencias y confirmá el cambio antes de guardar.');
    if (typeof input.note !== 'string' || input.note.trim().length < 8 || input.note.trim().length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(input.note)) throw new TaskAssignmentError('Explicá el motivo y la coordinación en entre 8 y 1.000 caracteres.');
    Object.assign(normalized, { reviewVersion: input.reviewVersion, note: input.note.trim().replace(/\r\n/g,'\n') });
  }
  return normalized;
}
export function reschedulePlan(snapshot, normalized) {
  const row = snapshot.assignment;
  return normalizeAssignmentPlan({ taskId: row.taskId, expectedTaskRevision: snapshot.task.revision,
    ownerKind: row.workerId ? 'WORKER' : 'TEAM', ownerId: row.workerId || row.teamId,
    startsOn: normalized.startsAt?.slice(0,10) || '', endsOn: normalized.endsAt?.slice(0,10) || '' });
}
const periodValue = value => value === null || typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function rescheduleSnapshotMatches(body, scope, id) {
  const row = body?.assignment;
  return Boolean(body?.context?.organizationId === scope.organizationId && body.context.projectId === scope.projectId
    && assignmentRecordMatches(row, scope.projectId) && row.id === id
    && body.task?.id === row.taskId && typeof body.task.title === 'string' && Number.isSafeInteger(body.task.revision) && body.task.revision >= 0
    && typeof body.ownerLabel === 'string' && typeof body.writable === 'boolean'
    && (row.workerId === null || typeof row.workerId === 'string') && (row.teamId === null || typeof row.teamId === 'string')
    && (row.startsAt === null || typeof row.startsAt === 'string') && (row.endsAt === null || typeof row.endsAt === 'string'));
}
export function rescheduleSupported(row) {
  return Boolean(row?.status === 'PLANNED' && Boolean(row.workerId) !== Boolean(row.teamId)
    && periodValue(row.startsAt) && periodValue(row.endsAt) && (!row.endsAt || row.startsAt && row.startsAt <= row.endsAt));
}
export function rescheduleReviewMatches(body, snapshot, command, scope) {
  try {
    const normalized = normalizeReschedule(command), before = body?.before;
    const row = snapshot.assignment;
    return Boolean(body?.context?.organizationId === scope.organizationId && body.context.projectId === scope.projectId
      && body.assignmentId === row.id && before?.revision === row.revision && normalized.expectedRevision === row.revision
      && before.startsAt === row.startsAt && before.endsAt === row.endsAt
      && body.proposed?.startsAt === normalized.startsAt && body.proposed.endsAt === normalized.endsAt
      && typeof body.version === 'string' && HEX.test(body.version)
      && assignmentReviewMatches(body.overlap, reschedulePlan(snapshot, normalized), scope));
  } catch { return false; }
}
export function rescheduleReceiptMatches(body, snapshot, input, scope) {
  try {
    const command = normalizeReschedule(input,true), row = body?.assignment, receipt = body?.lastReschedule;
    return Boolean(rescheduleSnapshotMatches(body,scope,snapshot.assignment.id)
      && row.status === 'PLANNED' && row.revision === command.expectedRevision + 1
      && row.workerId === snapshot.assignment.workerId && row.teamId === snapshot.assignment.teamId
      && row.taskId === snapshot.assignment.taskId && row.startsAt === command.startsAt && row.endsAt === command.endsAt
      && receipt?.previousRevision === command.expectedRevision && receipt.revision === row.revision
      && receipt.previousStartsAt === snapshot.assignment.startsAt && receipt.previousEndsAt === snapshot.assignment.endsAt
      && receipt.reviewVersion === command.reviewVersion && receipt.note === command.note);
  } catch { return false; }
}
export function rescheduleScope(value) { return { organizationId: assignmentId(value?.organizationId), projectId: assignmentId(value?.projectId) }; }
