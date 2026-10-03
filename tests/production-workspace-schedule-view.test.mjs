import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay, formatCalendarDay, loadedScheduleOverview, mergeLoadedTasks, planningState, registeredProgress, selectLoadedTasks, taskStatusLabel} from '../src/app/(identity)/cuenta/schedule-workbench.mjs';

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
