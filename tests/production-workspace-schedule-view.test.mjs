import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay, formatCalendarDay, loadedScheduleOverview, mergeLoadedTasks, planningState, refreshLoadedTasks, registeredProgress, scheduleCalendar, scheduledBar, selectLoadedTasks, taskStatusLabel, updateLoadedTask} from '../src/app/(identity)/cuenta/schedule-workbench.mjs';

const task = (id, extra = {}) => ({id, title: 'Tarea ' + id, status: 'BACKLOG', progress: 0, startsOn: null, endsOn: null, revision: '2026-10-02T22:00:00.000001', ...extra});
const tasks = [task('c', {title: 'Mampostería · sector norte', status: 'IN_PROGRESS', progress: 37, startsOn: '2026-10-07', endsOn: '2026-10-15'}), task('a', {title: 'Acopio de materiales', status: 'BLOCKED'}), task('b', {title: 'Hormigón', status: 'DONE', progress: 100, startsOn: '2026-10-01', endsOn: '2026-10-03'}), task('d', {startsOn: '2026-10-05', endsOn: '2026-10-01', progress: 101, status: 'unknown'})];

test('an incomplete page never becomes an overall project summary', () => {
 const overview = loadedScheduleOverview(tasks, 104, 'next-id');
 assert.equal(overview.partial, true); assert.equal(overview.loaded, 4); assert.equal(overview.total, 104);
 assert.equal(overview.inProgress, 1); assert.equal(overview.blocked, 1); assert.equal(overview.done, 1);
 assert.equal(overview.missingDates, 1); assert.equal(overview.invalidDates, 1);
 assert.equal(overview.unrecognizedStatus, 1); assert.equal(overview.invalidProgress, 1);
 assert.equal(overview.range.start, calendarDay('2026-10-01')); assert.equal(overview.range.end, calendarDay('2026-10-16'));
 assert.equal(loadedScheduleOverview(tasks, 4, null).partial, false);
 for (const total of [null, -1, 3, '4', NaN]) {
  assert.equal(loadedScheduleOverview(tasks, total, null).partial, true);
  assert.equal(loadedScheduleOverview(tasks, total, null).total, null);
 }
 assert.equal(loadedScheduleOverview(tasks, 4, 'more').partial, true);
});
test('real dates are UTC date-only and impossible, incomplete or reversed dates are flagged', () => {
 assert.notEqual(calendarDay('2028-02-29'), null);
 for (const value of ['2026-02-29', '2026-13-01', '2026-10-00', '2026-1-01', '2026-10-01T00:00:00Z', null, '']) assert.equal(calendarDay(value), null);
 assert.equal(planningState(task('none')), 'MISSING');
 assert.equal(planningState(task('one', {startsOn: '2026-10-01'})), 'INVALID');
 assert.equal(planningState(tasks[3]), 'INVALID');
 assert.equal(planningState(task('leap', {startsOn: '2028-02-29', endsOn: '2028-02-29'})), 'VALID');
 assert.match(formatCalendarDay('2026-10-01'), /1.*oct.*2026/);
 assert.equal(formatCalendarDay('2026-02-29'), 'Fecha por revisar');
});
test('accent-insensitive combined filters preserve the authorized source order and task values', () => {
 const snapshot = structuredClone(tasks);
 assert.deepEqual(selectLoadedTasks(tasks, {search: '  MAMPOSTERIA norte ', status: 'IN_PROGRESS', planning: 'VALID'}).map(row => row.id), ['c']);
 assert.deepEqual(selectLoadedTasks(tasks, {status: 'UNRECOGNIZED', planning: 'INVALID'}).map(row => row.id), ['d']);
 assert.deepEqual(selectLoadedTasks(tasks, {search: 'no coincidencias'}), []);
 assert.deepEqual(selectLoadedTasks(tasks, {planning: 'MISSING'}).map(row => row.id), ['a']);
 assert.deepEqual(selectLoadedTasks(tasks).map(row => row.id), ['c', 'a', 'b', 'd']);
 assert.deepEqual(tasks, snapshot);
});
test('sort by planned start puts incomplete dates last without inventing a start', () => {
 const snapshot = structuredClone(tasks);
 assert.deepEqual(selectLoadedTasks(tasks, {order: 'START_ASC'}).map(row => row.id), ['b', 'c', 'a', 'd']);
 assert.deepEqual(selectLoadedTasks(tasks, {order: 'TITLE_ASC'}).map(row => row.id), ['a', 'b', 'c', 'd']);
 assert.deepEqual(tasks, snapshot);
});
test('cursor pages that repeat a locally inserted task do not inflate loaded counts', () => {
 const original = [task('a'), task('new')], incoming = [task('new', {progress: 10}), task('b')];
 const merged = mergeLoadedTasks(original, incoming);
 assert.deepEqual(merged.map(row => row.id), ['a', 'new', 'b']);
 assert.equal(merged[1].progress, 10);
 assert.equal(loadedScheduleOverview(merged, 3, null).partial, false);
 assert.equal(original[1].progress, 0); assert.equal(incoming.length, 2);
});
test('invalid progress is unavailable rather than zero or a normalized approval', () => {
 for (const value of [-1, 101, 37.5, '37', null, NaN]) assert.equal(registeredProgress(value), null);
 for (const value of [0, 37, 100]) assert.equal(registeredProgress(value), value);
 assert.equal(taskStatusLabel('toString'), 'Estado por revisar');
 assert.equal(taskStatusLabel('DONE'), 'Finalizada');
 assert.equal(loadedScheduleOverview([], 0, null).range, null);
});
test('a late cursor snapshot cannot roll back a confirmed task, including microsecond revisions', () => {
 const confirmed = task('same', {revision: '2026-10-02T22:00:00.000002', progress: 70});
 const stale = task('same', {revision: '2026-10-02T22:00:00.000001', progress: 10});
 assert.equal(mergeLoadedTasks([confirmed], [stale])[0], confirmed);
 for (const revision of [undefined, null, '2026-10-02T22:00:00.999', '2026-10-02T22:00:00.999999Z', '2026-02-29T22:00:00.999999']) assert.equal(mergeLoadedTasks([confirmed], [{...stale, revision}])[0], confirmed);
 const later = {...confirmed, revision: '2026-10-02T22:00:00.000003', progress: 80};
 assert.equal(mergeLoadedTasks([confirmed], [later])[0], later);
});

test('a delayed full readback retains newer approvals while using only the returned page membership and order', () => {
 const before = task('same', {revision: '2026-10-02T22:00:00.000001', progress: 37, startsOn: '2026-10-02', endsOn: '2026-10-04'});
 const current = updateLoadedTask([before, task('previous-page')], {id: 'same', revision: '2026-10-02T22:00:00.000002', progress: 50, status: 'IN_PROGRESS'});
 const incoming = [task('new-first'), before];
 const refreshed = refreshLoadedTasks(current, incoming);
 assert.deepEqual(refreshed.map(row => row.id), ['new-first', 'same']);
 assert.equal(refreshed[1], current[0]); assert.equal(refreshed[1].progress, 50);
 assert.equal(refreshed[1].startsOn, before.startsOn); assert.equal(refreshed[1].endsOn, before.endsOn);
 assert.equal(before.progress, 37); assert.equal(incoming[1], before);
});

test('a delayed partial decision callback cannot undo a newer GET and never inserts tasks outside the loaded page', () => {
 const current = [task('same', {revision: '2026-10-02T22:00:00.000002', progress: 70, startsOn: '2026-10-02', endsOn: '2026-10-04'})];
 for (const revision of ['2026-10-02T22:00:00.000001', undefined, '2026-10-02T22:00:00.999', '2026-02-29T22:00:00.999999']) {
  assert.equal(updateLoadedTask(current, {id: 'same', revision, progress: 50})[0], current[0]);
 }
 assert.deepEqual(updateLoadedTask(current, task('outside')), current);
 const updated = updateLoadedTask(current, {id: 'same', revision: '2026-10-02T22:00:00.000003', progress: 80});
 assert.equal(updated[0].progress, 80); assert.equal(updated[0].startsOn, current[0].startsOn); assert.equal(updated[0].endsOn, current[0].endsOn);
 assert.equal(current[0].progress, 70);
});

test('full readbacks accept later canonical rows and equal revisions without retaining rows omitted by the server', () => {
 const current = [task('same', {revision: '2026-10-02T22:00:00.000002', progress: 50}), task('omitted')];
 const later = task('same', {revision: '2026-10-02T22:00:00.000003', progress: 70});
 assert.deepEqual(refreshLoadedTasks(current, [later]), [later]);
 const equal = {...current[0], startsOn: '2026-10-02', endsOn: '2026-10-04'};
 assert.equal(refreshLoadedTasks(current, [equal])[0], equal);
 assert.equal(updateLoadedTask(current, {id: 'same', revision: current[0].revision, progress: 50})[0].progress, 50);
 assert.deepEqual(refreshLoadedTasks(current, []), []);
});

test('a complete approved task carries current planning dates past a delayed earlier planning reply', () => {
 const original = task('same', {revision: '2026-10-02T22:00:00.000001', progress: 37, startsOn: '2026-10-01', endsOn: '2026-10-05'});
 const planned = {...original, revision: '2026-10-02T22:00:00.000002', startsOn: '2026-10-07', endsOn: '2026-10-15'};
 const approved = {...planned, revision: '2026-10-02T22:00:00.000003', progress: 50};
 const afterApproval = updateLoadedTask([original], approved), afterDelayedPlanning = updateLoadedTask(afterApproval, planned);
 assert.deepEqual(afterDelayedPlanning[0], approved); assert.equal(afterDelayedPlanning[0], afterApproval[0]);
 assert.equal(original.startsOn, '2026-10-01'); assert.equal(planned.progress, 37);
});

const range = (start, lastDay) => ({start: calendarDay(start), end: calendarDay(lastDay) + 86400000});
test('day zoom includes the leap day and both planned endpoints on a shared UTC axis', () => {
 const calendar = scheduleCalendar(range('2028-02-28', '2028-03-02'), 'DAYS');
 assert.deepEqual(calendar.cells.map(cell => cell.startsOn), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']);
 assert.equal(calendar.width, 4 * 44); assert.equal(calendar.pages, 1);
 assert.deepEqual(calendar.cells.map(cell => cell.width), [25, 25, 25, 25]);
 const leap = task('leap', {startsOn: '2028-02-29', endsOn: '2028-02-29', progress: 37});
 assert.deepEqual(scheduledBar(leap, calendar), {left: 25, width: 25, continuesBefore: false, continuesAfter: false});
 const full = task('full', {startsOn: '2028-02-28', endsOn: '2028-03-02'});
 assert.equal(scheduledBar(full, calendar).width, 100);
 assert.equal(scheduleCalendar(range('2026-02-28', '2026-03-01'), 'DAYS').cells.length, 2);
});
test('week zoom starts on Monday, including a week crossing the year boundary', () => {
 const calendar = scheduleCalendar(range('2026-12-31', '2027-01-02'), 'WEEKS');
 assert.equal(calendar.startsOn, '2026-12-28'); assert.equal(calendar.endsOn, '2027-01-03');
 assert.equal(calendar.cells.length, 1); assert.equal(calendar.width, 7 * 14);
 assert.match(calendar.cells[0].description, /2026.*2027/);
 const bar = scheduledBar(task('year', {startsOn: '2026-12-31', endsOn: '2027-01-02'}), calendar);
 assert.equal(bar.left, 3 / 7 * 100); assert.equal(bar.width, 3 / 7 * 100);
});
test('month zoom uses real month lengths rather than equal ordinal slices', () => {
 const calendar = scheduleCalendar(range('2028-01-31', '2028-03-01'), 'MONTHS');
 assert.deepEqual(calendar.cells.map(cell => cell.startsOn), ['2028-01-01', '2028-02-01', '2028-03-01']);
 assert.deepEqual(calendar.cells.map(cell => (cell.end - cell.start) / 86400000), [31, 29, 31]);
 assert.equal(calendar.width, 91 * 4);
 assert.equal(calendar.cells[1].width, 29 / 91 * 100);
 const bar = scheduledBar(task('months', {startsOn: '2028-01-31', endsOn: '2028-03-01'}), calendar);
 assert.equal(bar.left, 30 / 91 * 100); assert.equal(bar.width, 31 / 91 * 100);
 assert.deepEqual(scheduleCalendar(range('2026-12-31', '2027-01-01'), 'MONTHS').cells.map(cell => cell.startsOn), ['2026-12-01', '2027-01-01']);
});
test('long calendar spans have bounded windows that can reach every planned day', () => {
 const long = range('2000-01-01', '2100-12-31');
 for (const [scale, limit] of [['DAYS', 28], ['WEEKS', 12], ['MONTHS', 12]]) {
  const first = scheduleCalendar(long, scale), last = scheduleCalendar(long, scale, Number.MAX_SAFE_INTEGER);
  assert.ok(first.pages > 1); assert.equal(first.cells.length, limit); assert.ok(last.cells.length <= limit);
  assert.equal(last.page, last.pages - 1); assert.ok(last.end >= long.end);
  assert.equal(scheduleCalendar(long, scale, -1).page, 0);
  assert.equal(scheduleCalendar(long, scale, NaN).page, 0);
  const before = scheduleCalendar(long, scale, last.page - 1);
  assert.equal(before.end, last.start);
  const spanning = scheduledBar(task('span', {startsOn: '2000-01-01', endsOn: '2100-12-31'}), first);
  assert.equal(spanning.continuesBefore, false); assert.equal(spanning.continuesAfter, true);
  const finalDay = scheduledBar(task('last-day', {startsOn: '2100-12-31', endsOn: '2100-12-31'}), last);
  assert.ok(finalDay && finalDay.width > 0);
 }
 assert.equal(scheduleCalendar(long, 'toString').scale, 'WEEKS');
});
test('missing, impossible, reversed and out-of-window dates never acquire a planned bar', () => {
 const calendar = scheduleCalendar(range('2026-10-01', '2026-10-28'), 'DAYS');
 for (const row of [task('missing'), task('incomplete', {startsOn: '2026-10-02'}), task('impossible', {startsOn: '2026-02-29', endsOn: '2026-10-02'}), task('reversed', {startsOn: '2026-10-03', endsOn: '2026-10-02'}), task('outside', {startsOn: '2026-11-01', endsOn: '2026-11-02'})]) assert.equal(scheduledBar(row, calendar), null);
 for (const value of [null, {}, {start: NaN, end: 0}, {start: 2, end: 3}, {start: calendar.end, end: calendar.start}, {start: calendar.start, end: calendar.start}]) assert.equal(scheduleCalendar(value), null);
 assert.equal(scheduledBar(tasks[0], null), null);
 const crossing = scheduledBar(task('crossing', {startsOn: '2026-09-30', endsOn: '2026-10-29'}), calendar);
 assert.deepEqual(crossing, {left: 0, width: 100, continuesBefore: true, continuesAfter: true});
});
test('a large partial loaded set supplies dates without inventing overall progress or mutating tasks', () => {
 const loaded = Array.from({length: 240}, (_, index) => task(String(index), {startsOn: '2028-01-31', endsOn: '2028-03-01', progress: index % 101}));
 const snapshot = structuredClone(loaded), overview = loadedScheduleOverview(loaded, 300, 'more');
 const calendar = scheduleCalendar(overview.range, 'MONTHS');
 assert.equal(overview.partial, true); assert.equal(overview.loaded, 240); assert.equal(overview.total, 300);
 assert.equal(Object.hasOwn(overview, 'progress'), false);
 const filtered = selectLoadedTasks(loaded, {search: 'Tarea 23'});
 for (const row of filtered) assert.equal(scheduledBar(row, calendar).width, 31 / 91 * 100);
 assert.deepEqual(loaded, snapshot);
 const changed = {...loaded[0], progress: 90};
 assert.deepEqual(scheduledBar(changed, calendar), scheduledBar(loaded[0], calendar));
 assert.equal(loaded[0].progress, 0);
});
