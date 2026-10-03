// Presentation only: every value comes from the authorized tasks already loaded.
const DAY = 86400000;
const statuses = new Set(['BACKLOG', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
const collator = new Intl.Collator('es-AR', {numeric: true, sensitivity: 'base'});
const dateFormatter = new Intl.DateTimeFormat('es-AR', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
export function calendarDay(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
 const stamp = Date.parse(value + 'T00:00:00Z');
 return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}
export function planningState(task) {
 if (!task.startsOn && !task.endsOn) return 'MISSING';
 const start = calendarDay(task.startsOn), end = calendarDay(task.endsOn);
 return start !== null && end !== null && end >= start ? 'VALID' : 'INVALID';
}
export const taskStatus = value => statuses.has(value) ? value : 'UNRECOGNIZED';
export const taskStatusLabel = value => ({BACKLOG: 'Por iniciar', IN_PROGRESS: 'En curso', DONE: 'Finalizada', BLOCKED: 'Bloqueada'}[taskStatus(value)] || 'Estado por revisar');
export const registeredProgress = value => Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
export const formatCalendarDay = value => {
 const stamp = calendarDay(value);
 return stamp === null ? 'Fecha por revisar' : dateFormatter.format(new Date(stamp));
};
const searchable = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim();
const canonicalRevision = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}$/.test(value) && calendarDay(value.slice(0, 10)) !== null;
export function mergeLoadedTasks(current, incoming) {
 // A locally created task can reappear in a later cursor page. A page started
 // before a confirmed change must not replace the newer task with its old
 // snapshot. Fixed-width canonical revisions retain PostgreSQL microseconds.
 const merged = new Map(current.map(task => [task.id, task]));
 for (const task of incoming) {
  const existing = merged.get(task.id);
  if (!existing || canonicalRevision(task.revision) && (!canonicalRevision(existing.revision) || task.revision >= existing.revision)) merged.set(task.id, task);
 }
 return [...merged.values()];
}
export function selectLoadedTasks(tasks, {search = '', status = 'ALL', planning = 'ALL', order = 'REGISTERED'} = {}) {
 const terms = searchable(search).split(/\s+/).filter(Boolean);
 const selected = tasks.filter(task => terms.every(term => searchable(task.title).includes(term)) && (status === 'ALL' || taskStatus(task.status) === status) && (planning === 'ALL' || planningState(task) === planning));
 if (order === 'TITLE_ASC') return selected.sort((a, b) => collator.compare(a.title, b.title));
 if (order === 'START_ASC') return selected.sort((a, b) => {
  const left = planningState(a) === 'VALID' ? calendarDay(a.startsOn) : null;
  const right = planningState(b) === 'VALID' ? calendarDay(b.startsOn) : null;
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
 });
 return selected;
}
export function loadedScheduleOverview(tasks, totalTasks, nextCursor) {
 const loaded = tasks.length;
 const total = Number.isInteger(totalTasks) && totalTasks >= loaded ? totalTasks : null;
 const valid = tasks.filter(task => planningState(task) === 'VALID');
 const range = valid.length ? {start: Math.min(...valid.map(task => calendarDay(task.startsOn))), end: Math.max(...valid.map(task => calendarDay(task.endsOn))) + DAY} : null;
 return {
  loaded, total, partial: Boolean(nextCursor) || total === null || total > loaded,
  inProgress: tasks.filter(task => taskStatus(task.status) === 'IN_PROGRESS').length,
  blocked: tasks.filter(task => taskStatus(task.status) === 'BLOCKED').length,
  done: tasks.filter(task => taskStatus(task.status) === 'DONE').length,
  missingDates: tasks.filter(task => planningState(task) === 'MISSING').length,
  invalidDates: tasks.filter(task => planningState(task) === 'INVALID').length,
  unrecognizedStatus: tasks.filter(task => taskStatus(task.status) === 'UNRECOGNIZED').length,
  invalidProgress: tasks.filter(task => registeredProgress(task.progress) === null).length,
  range,
 };
}
