// Read-only projection of the records already authorized and loaded for one worksite.
const OPEN = new Set(['PLANNED', 'ACTIVE']);
export const AGENDA_BUCKETS = Object.freeze(['all', 'overdue', 'onDate', 'upcoming', 'review']);
export const AGENDA_LABELS = Object.freeze({
  all: 'Todas las asignaciones', overdue: 'Fin previsto vencido',
  onDate: 'Previstas para la fecha', upcoming: 'Próximos inicios', review: 'Completar o revisar fechas',
});
export function validAgendaDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftAgendaDay(day, count) {
  if (!validAgendaDay(day) || !Number.isSafeInteger(count) || Math.abs(count) > 366) return null;
  const result = new Date(new Date(day + 'T00:00:00.000Z').getTime() + count * 86400000);
  const shifted = result.toISOString().slice(0, 10);
  return validAgendaDay(shifted) ? shifted : null;
}
export function assignmentAgendaToday(timeZone, instant) {
  // No browser/UTC fallback: a missing tenant zone must not produce a false "today".
  if (typeof timeZone !== 'string' || !timeZone.trim() || timeZone !== timeZone.trim() || /^[+-]/.test(timeZone)) return null;
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const day = `${values.year}-${values.month}-${values.day}`;
    return validAgendaDay(day) ? day : null;
  } catch { return null; }
}
function periodDay(value) {
  if (value === null || value === undefined || value === '') return { kind: 'missing', day: null };
  // These planning dates are civil days encoded at UTC midnight, not local instants.
  if (typeof value !== 'string') return { kind: 'invalid', day: null };
  const day = value.slice(0, 10);
  const canonical = value === day || value === day + 'T00:00:00.000Z';
  return canonical && validAgendaDay(day) ? { kind: 'valid', day } : { kind: 'invalid', day: null };
}
export function buildAssignmentAgenda(assignments, { projectId, day } = {}) {
  if (!Array.isArray(assignments) || typeof projectId !== 'string' || !projectId) {
    throw new TypeError('La agenda requiere un listado y la obra autorizada.');
  }
  const rows = assignments.filter(row => row && row.projectId === projectId && typeof row.id === 'string');
  const usableDay = validAgendaDay(day), horizon = usableDay ? shiftAgendaDay(day, 7) : null;
  const buckets = { all: [...rows], overdue: [], onDate: [], upcoming: [], review: [] };
  let open = 0, incomplete = 0, invalid = 0;
  for (const row of rows) {
    if (!OPEN.has(row.status)) continue;
    open++;
    const start = periodDay(row.startsAt), end = periodDay(row.endsAt);
    const malformed = start.kind === 'invalid' || end.kind === 'invalid'
      || start.kind === 'missing' && end.kind === 'valid'
      || start.kind === 'valid' && end.kind === 'valid' && end.day < start.day;
    if (malformed) { invalid++; buckets.review.push(row); continue; }
    if (start.kind === 'missing' || end.kind === 'missing') { incomplete++; buckets.review.push(row); continue; }
    if (!usableDay) continue;
    if (end.day < day) buckets.overdue.push(row);
    else if (start.day <= day) buckets.onDate.push(row);
    else if (horizon && start.day <= horizon) buckets.upcoming.push(row);
  }
  const compare = field => (a, b) => String(a[field]).localeCompare(String(b[field])) || a.id.localeCompare(b.id);
  buckets.overdue.sort(compare('endsAt'));
  buckets.onDate.sort(compare('endsAt'));
  buckets.upcoming.sort(compare('startsAt'));
  return { buckets, counts: Object.fromEntries(AGENDA_BUCKETS.map(key => [key, buckets[key].length])),
    open, incomplete, invalid, day: usableDay ? day : null, horizon };
}
function searchText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
export function selectAgendaRows(agenda, { bucket = 'all', status = 'all', query = '', tasks = [], workers = [], teams = [] } = {}) {
  if (!AGENDA_BUCKETS.includes(bucket) || !['all', 'open', 'closed'].includes(status)) return [];
  const taskNames = new Map(tasks.map(row => [row.id, `${row.code || ''} ${row.title || ''}`]));
  const workerNames = new Map(workers.map(row => [row.id, row.name]));
  const teamNames = new Map(teams.map(row => [row.id, row.name]));
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return agenda.buckets[bucket].filter(row => {
    if (status === 'open' && !OPEN.has(row.status)) return false;
    if (status === 'closed' && !['ENDED', 'CANCELLED'].includes(row.status)) return false;
    const haystack = searchText([taskNames.get(row.taskId), workerNames.get(row.workerId), teamNames.get(row.teamId)].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}
