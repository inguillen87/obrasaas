import { TaskAssignmentError, assignmentId, normalizeAssignmentPlan } from './task-assignment-policy.js';
export const OVERLAP_LIMITS = Object.freeze({ assignments: 1000, memberships: 3000, samples: 8 });
const DAY = 86400000;
const fail = () => { throw new TaskAssignmentError('Hay fechas o referencias que no permiten verificar la planificación.', 'ASSIGNMENT_REVIEW_INCONSISTENT', 503); };
export function calendarWindow(row) {
  const parse = value => {
    if (value == null) return null;
    const date = new Date(value); if (!Number.isFinite(date.getTime())) fail();
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  };
  const start = parse(row.startsAt), end = parse(row.endsAt);
  if (start !== null && end !== null && end < start) fail();
  return { start: start ?? -Infinity, end: end === null ? Infinity : end + DAY, complete: start !== null && end !== null };
}
const intersects = (...ranges) => Math.max(...ranges.map(r => r.start)) < Math.min(...ranges.map(r => r.end));
function participation(row) {
  if (row.startsAt == null) fail();
  const start = new Date(row.startsAt).getTime(), end = row.endsAt == null ? Infinity : new Date(row.endsAt).getTime();
  if (!Number.isFinite(start) || Number.isNaN(end) || end < start) fail();
  return { start, end };
}
function resources(owner, window, members) {
  const result = new Map();
  const add = (key, range, direct = false) => {
    if (!intersects(window,range)) return;
    const item = result.get(key) || { direct:false,ranges:[] };
    item.direct ||= direct;
    item.ranges.push({start:Math.max(window.start,range.start),end:Math.min(window.end,range.end)});
    result.set(key,item);
  };
  if (owner.workerId) add('worker:'+owner.workerId,window,true);
  if (owner.teamId) {
    add('team:'+owner.teamId,window,true);
    for (const member of members) if (member.teamId===owner.teamId) add('worker:'+member.workerId,participation(member));
  }
  for (const item of result.values()) {
    item.ranges.sort((a,b)=>a.start-b.start); const merged=[];
    for (const range of item.ranges) { const last=merged.at(-1); if(last&&range.start<=last.end)last.end=Math.max(last.end,range.end);else merged.push({...range}); }
    item.ranges=merged;
  }
  return result;
}
function overlappingRanges(a,b) {
  let i=0,j=0;
  while(i<a.length&&j<b.length){if(intersects(a[i],b[j]))return true;if(a[i].end<=b[j].end)i++;else j++;}
  return false;
}
export function analyzeAssignmentOverlap(plan, assignments, members) {
  if (assignments.length > OVERLAP_LIMITS.assignments || members.length > OVERLAP_LIMITS.memberships) throw new TaskAssignmentError('La consulta supera el límite de revisión. No se confirmó la disponibilidad.', 'ASSIGNMENT_REVIEW_TOO_LARGE', 503);
  const proposed = calendarWindow(plan), footprint = resources(plan, proposed, members), findings = [];
  for (const row of assignments) {
    if (!['PLANNED','ACTIVE'].includes(row.status)) continue;
    const window = calendarWindow(row); if (!intersects(proposed, window)) continue;
    const other = resources(row, window, members); let direct = false; const shared = new Set();
    for (const [key,a] of footprint) {
      const b=other.get(key); if(!b||!overlappingRanges(a.ranges,b.ranges))continue;
      if(a.direct&&b.direct){direct=true;break;}
      if(key.startsWith('worker:'))shared.add(key);
    }
    if (!direct && !shared.size) continue;
    findings.push({ assignmentId: assignmentId(row.id), taskId: assignmentId(row.taskId), taskTitle: row.taskTitle,
      ownerLabel: row.ownerLabel, status: row.status, kind: direct ? 'DIRECT' : 'SHARED_MEMBER',
      certainty: proposed.complete && window.complete ? 'DATES_OVERLAP' : 'DATES_INCOMPLETE', sharedPeople: shared.size,
      startsOn: Number.isFinite(window.start) ? new Date(window.start).toISOString().slice(0,10) : null,
      endsOn: Number.isFinite(window.end) ? new Date(window.end - DAY).toISOString().slice(0,10) : null,
      overlapFrom: direct && proposed.complete && window.complete ? new Date(Math.max(proposed.start,window.start)).toISOString().slice(0,10) : null,
      overlapTo: direct && proposed.complete && window.complete ? new Date(Math.min(proposed.end,window.end) - DAY).toISOString().slice(0,10) : null });
  }
  const rosterUnverified = Boolean(plan.teamId && ![...footprint.keys()].some(key => key.startsWith('worker:')));
  const summary = { overlaps: findings.filter(row => row.certainty === 'DATES_OVERLAP').length,
    incomplete: findings.filter(row => row.certainty === 'DATES_INCOMPLETE').length, proposedDatesIncomplete: !proposed.complete, rosterUnverified };
  return { summary, warnings: findings.length > 0 || !proposed.complete || rosterUnverified,
    findings: findings.sort((a,b) => a.assignmentId.localeCompare(b.assignmentId)) };
}
export function reviewedAssignmentInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TaskAssignmentError('Solicitud de planificación no válida.');
  const { review, ...raw } = input, plan = normalizeAssignmentPlan(raw);
  if (!review || typeof review !== 'object' || Array.isArray(review) || Object.keys(review).some(key => !['version','acknowledged','reason'].includes(key))
    || typeof review.version !== 'string' || !/^[a-f0-9]{64}$/.test(review.version) || review.acknowledged !== true
    || typeof review.reason !== 'string' || review.reason.trim().length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(review.reason)) {
    throw new TaskAssignmentError('Revisá las coincidencias de planificación antes de confirmar.', 'ASSIGNMENT_REVIEW_REQUIRED', 422);
  }
  return { raw, plan, review: { version: review.version, acknowledged: true, reason: review.reason.trim().replace(/\r\n/g,'\n') } };
}
function reviewDay(value) { return value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value+'T00:00:00.000Z').getTime()) && new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value; }
export function assignmentReviewMatches(value, plan, scope) {
  const summary = value?.summary;
  return Boolean(value?.context?.organizationId === scope.organizationId && value.context.projectId === scope.projectId
    && typeof value.version === 'string' && /^[a-f0-9]{64}$/.test(value.version)
    && ['taskId','expectedTaskRevision','workerId','teamId','startsAt','endsAt'].every(key => value.plan?.[key] === plan[key])
    && summary && ['overlaps','incomplete'].every(key => Number.isSafeInteger(summary[key]) && summary[key] >= 0)
    && typeof summary.proposedDatesIncomplete === 'boolean' && typeof summary.rosterUnverified === 'boolean'
    && typeof value.warnings === 'boolean' && value.warnings === Boolean(summary.overlaps || summary.incomplete || summary.proposedDatesIncomplete || summary.rosterUnverified)
    && Array.isArray(value.findings) && value.findings.length <= OVERLAP_LIMITS.samples
    && value.totalFindings === summary.overlaps + summary.incomplete && value.findings.length === Math.min(value.totalFindings,OVERLAP_LIMITS.samples)
    && new Set(value.findings.map(row => row?.assignmentId)).size === value.findings.length
    && value.findings.every(row => row && typeof row.assignmentId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(row.assignmentId)
      && typeof row.taskId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(row.taskId) && typeof row.taskTitle === 'string' && typeof row.ownerLabel === 'string'
      && ['PLANNED','ACTIVE'].includes(row.status) && ['startsOn','endsOn','overlapFrom','overlapTo'].every(key=>reviewDay(row[key]))
      && Number.isSafeInteger(row.sharedPeople) && row.sharedPeople>=0 && ['DIRECT','SHARED_MEMBER'].includes(row.kind) && ['DATES_OVERLAP','DATES_INCOMPLETE'].includes(row.certainty)));
}
