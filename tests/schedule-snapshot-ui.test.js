import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [page, dashboard, panel, css, planner] = await Promise.all([
  readFile(new URL('src/app/dashboard/page.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/dashboard-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/schedule-snapshots-panel.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/schedule-snapshots-panel.module.css', root), 'utf8'),
  readFile(new URL('src/app/dashboard/gantt-planner.js', root), 'utf8'),
]);

test('dashboard uses canonical task capability from the first task and exact manage permission', () => {
  assert.match(page, /\n\s*canReadCanonicalTasks,/);
  assert.match(page, /canManageCanonicalTasks:\s*hasTenantPermission\(access, 'org:tasks:manage'\)/);
  assert.match(page, /canonicalTasksHasMore:\s*canonicalTasks\.hasMore/);
  assert.match(dashboard, /canonicalMode=\{setup\.canReadCanonicalTasks\}/);
  assert.match(
    dashboard,
    /canManage=\{setup\.canReadCanonicalTasks \? setup\.canManageCanonicalTasks : setup\.canManageProjects\}/,
  );
  assert.doesNotMatch(dashboard, /canonicalMode=\{Boolean\(canonicalTaskCatalog\)\}/);
});

test('contractual schedule panel is API-backed, replay-safe and never claims planned dates as actuals', () => {
  assert.match(panel, /fetch\('\/api\/schedule\/baselines\?limit=25'/);
  assert.match(panel, /fetch\('\/api\/schedule\/forecasts\?limit=25'/);
  assert.match(panel, /fetch\('\/api\/tasks\?limit=5000'/);
  assert.match(panel, /'idempotency-key': operation\.key/);
  assert.match(panel, /buildScheduleObservations\(tasks, observationEntries, \{ asOfDate \}\)/);
  assert.match(panel, /Las fechas reales no se autocompletan con el plan/);
  assert.match(panel, /expectedProjectStateVersion: projectStateVersion\(\)/);
  assert.match(panel, /baselineMatchesVisiblePlan/);
  assert.match(panel, /projectStartMissing = !project\?\.startsAt/);
  assert.match(panel, /href="\/dashboard\/projects">Completá el inicio de la obra/);
  assert.match(panel, /tasks\.length === 0 \|\| missingDateTasks\.length > 0/);
  assert.match(css, /\.readinessWarning/);
  assert.match(css, /@media\(max-width:640px\)/);
});

test('canonical Gantt keeps its relative anchor when a project calendar is not yet set', () => {
  assert.match(dashboard, /const scheduledStartDay = Number\(task\?\.schedule\?\.startDay\)/);
  assert.match(dashboard, /hasRelativeSchedule \? scheduledStartDay - 1 : 0/);
  assert.match(dashboard, /hasRelativeSchedule \? scheduledDurationDays : 1/);
  assert.match(planner, /schedule: \{\s*startDay: alignedStartDay,\s*durationDays:/);
});
