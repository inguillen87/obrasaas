// Presentation only: every value comes from the authorized tasks already loaded.
const DAY = 86400000;
const statuses = new Set(['BACKLOG', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
const collator = new Intl.Collator('es-AR', {numeric: true, sensitivity: 'base'});
const dateFormatter = new Intl.DateTimeFormat('es-AR', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const shortDayFormatter = new Intl.DateTimeFormat('es-AR', {day: 'numeric', month: 'short', timeZone: 'UTC'});
const monthFormatter = new Intl.DateTimeFormat('es-AR', {month: 'short', year: 'numeric', timeZone: 'UTC'});
const calendarScales = {DAYS: {limit: 28, pixelsPerDay: 44}, WEEKS: {limit: 12, pixelsPerDay: 14}, MONTHS: {limit: 12, pixelsPerDay: 4}};
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
const acceptsTaskRevision = (existing, incoming) => canonicalRevision(incoming.revision) && (!canonicalRevision(existing.revision) || incoming.revision >= existing.revision);
export function mergeLoadedTasks(current, incoming) {
 // A locally created task can reappear in a later cursor page. A page started
 // before a confirmed change must not replace the newer task with its old
 // snapshot. Fixed-width canonical revisions retain PostgreSQL microseconds.
 const merged = new Map(current.map(task => [task.id, task]));
 for (const task of incoming) {
  const existing = merged.get(task.id);
  if (!existing || acceptsTaskRevision(existing, task)) merged.set(task.id, task);
 }
 return [...merged.values()];
}
export function refreshLoadedTasks(current, incoming) {
 // A full readback owns the page membership and order. Only a newer revision
 // of a task on that page survives a response captured before its approval.
 const existing = new Map(current.map(task => [task.id, task]));
 return incoming.map(task => {
  const previous = existing.get(task.id);
  return previous && !acceptsTaskRevision(previous, task) ? previous : task;
 });
}
export function updateLoadedTask(current, incoming) {
 // New task replies include planning dates; legacy callbacks may omit them.
 // Merge a current revision into an already loaded task without adding cursor rows.
 return current.map(task => task.id === incoming.id && acceptsTaskRevision(task, incoming) ? {...task, ...incoming} : task);
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
 const overview = {
  loaded, total, partial: Boolean(nextCursor) || total === null || total > loaded,
  inProgress: 0, blocked: 0, done: 0, missingDates: 0, invalidDates: 0, unrecognizedStatus: 0, invalidProgress: 0, range: null,
 };
 // One pass also avoids spreading a potentially long, paginated task list.
 for (const task of tasks) {
  const status = taskStatus(task.status), planning = planningState(task);
  if (status === 'IN_PROGRESS') overview.inProgress++;
  if (status === 'BLOCKED') overview.blocked++;
  if (status === 'DONE') overview.done++;
  if (status === 'UNRECOGNIZED') overview.unrecognizedStatus++;
  if (registeredProgress(task.progress) === null) overview.invalidProgress++;
  if (planning === 'MISSING') overview.missingDates++;
  else if (planning === 'INVALID') overview.invalidDates++;
  else {
   const start = calendarDay(task.startsOn), end = calendarDay(task.endsOn) + DAY;
   overview.range = overview.range ? {start: Math.min(overview.range.start, start), end: Math.max(overview.range.end, end)} : {start, end};
  }
 }
 return overview;
}

// End is exclusive throughout the calendar. A task's last planned day is
// included by adding exactly one UTC day, never a guessed time or duration.
export function scheduleCalendar(range, requestedScale = 'WEEKS', requestedPage = 0) {
 if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start % DAY || range.end % DAY || range.end <= range.start || !Number.isFinite(new Date(range.start).getTime()) || !Number.isFinite(new Date(range.end).getTime())) return null;
 const scale = Object.hasOwn(calendarScales, requestedScale) ? requestedScale : 'WEEKS';
 const {limit, pixelsPerDay} = calendarScales[scale];
 const first = new Date(range.start);
 if (scale === 'WEEKS') first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
 if (scale === 'MONTHS') first.setUTCDate(1);
 const last = new Date(range.end - DAY);
 const totalPeriods = scale === 'MONTHS' ? (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1 : Math.ceil((range.end - first.getTime()) / (scale === 'WEEKS' ? 7 * DAY : DAY));
 const pages = Math.ceil(totalPeriods / limit);
 const page = Math.max(0, Math.min(pages - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
 const count = Math.min(limit, totalPeriods - page * limit);
 const periodStart = index => {
  if (scale !== 'MONTHS') return first.getTime() + index * (scale === 'WEEKS' ? 7 * DAY : DAY);
  const date = new Date(first); date.setUTCMonth(first.getUTCMonth() + index); return date.getTime();
 };
 const start = periodStart(page * limit), end = periodStart(page * limit + count);
 // The loop is bounded by 28 cells regardless of the total calendar span.
 const cells = Array.from({length: count}, (_, index) => {
  const from = periodStart(page * limit + index), to = periodStart(page * limit + index + 1);
  const date = new Date(from);
  return {start: from, end: to, startsOn: date.toISOString().slice(0, 10), label: scale === 'MONTHS' ? monthFormatter.format(date) : shortDayFormatter.format(date), description: scale === 'WEEKS' ? `Semana del ${dateFormatter.format(date)} al ${dateFormatter.format(new Date(to - DAY))}` : scale === 'MONTHS' ? monthFormatter.format(date) : dateFormatter.format(date), left: (from - start) / (end - start) * 100, width: (to - from) / (end - start) * 100};
 });
 return {scale, page, pages, totalPeriods, start, end, startsOn: new Date(start).toISOString().slice(0, 10), endsOn: new Date(end - DAY).toISOString().slice(0, 10), width: (end - start) / DAY * pixelsPerDay, cells};
}
export function scheduledBar(task, calendar) {
 if (!calendar || planningState(task) !== 'VALID') return null;
 const plannedStart = calendarDay(task.startsOn), plannedEnd = calendarDay(task.endsOn) + DAY;
 const start = Math.max(plannedStart, calendar.start), end = Math.min(plannedEnd, calendar.end);
 if (end <= start) return null;
 return {left: (start - calendar.start) / (calendar.end - calendar.start) * 100, width: (end - start) / (calendar.end - calendar.start) * 100, continuesBefore: plannedStart < calendar.start, continuesAfter: plannedEnd > calendar.end};
}
