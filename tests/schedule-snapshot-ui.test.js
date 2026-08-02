import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [page, dashboard, panel, css, planner, gantt] = await Promise.all([
  readFile(new URL('src/app/dashboard/page.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/dashboard-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/schedule-snapshots-panel.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/schedule-snapshots-panel.module.css', root), 'utf8'),
  readFile(new URL('src/app/dashboard/gantt-planner.js', root), 'utf8'),
  readFile(new URL('src/lib/gantt.js', root), 'utf8'),
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

test('dashboard accepts one safe reviewed-evidence pair and rejects duplicate or malformed query ids', () => {
  assert.match(
    page,
    /const canUseReviewedEvidence = \(\s*canManageCanonicalTasks\s*&& canReadSourceEvidence\s*&& hasTenantPermission\(access, 'org:execution:manage'\)\s*\)/,
  );
  assert.match(page, /canUseReviewedEvidence,/);

  assert.match(
    dashboard,
    /function safeReviewedEvidenceResourceId\(value\)[\s\S]{0,260}typeof value === 'string' \? value\.trim\(\) : ''/,
  );
  assert.match(dashboard, /normalized\.length <= 190/);
  assert.match(dashboard, /!\/\[\\u0000-\\u001f\\u007f\]\/\.test\(normalized\)/);
  assert.match(dashboard, /const evidenceIds = searchParams\.getAll\('evidenceId'\)/);
  assert.match(dashboard, /const assessmentIds = searchParams\.getAll\('assessmentId'\)/);
  assert.match(
    dashboard,
    /if \(evidenceIds\.length !== 1 \|\| assessmentIds\.length !== 1\) return null/,
  );
  assert.match(
    dashboard,
    /return evidenceId && assessmentId \? \{ evidenceId, assessmentId \} : null/,
  );
  assert.match(dashboard, /canUseReviewedEvidence=\{setup\.canUseReviewedEvidence\}/);
  assert.match(dashboard, /reviewedEvidenceSelection=\{reviewedEvidenceSelection\}/);
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

test('reviewed evidence requires an exact review plus a human integer and rationale without midpoint autofill', () => {
  assert.match(
    panel,
    /assessment\.status !== 'COMPLETED'[\s\S]{0,100}!\['APPROVED', 'CORRECTED'\]\.includes\(assessment\.reviewStatus\)/,
  );
  assert.match(panel, /assessment\.evidenceId !== selection\.evidenceId/);
  assert.match(panel, /const taskId = typeof assessment\.taskId === 'string' \? assessment\.taskId\.trim\(\) : ''/);
  assert.match(panel, /Number\.isSafeInteger\(revision\)/);
  assert.match(panel, /rangeMin < 0[\s\S]{0,80}rangeMax > 100[\s\S]{0,80}rangeMin > rangeMax/);
  assert.match(panel, /const \[reviewedProgressInput, setReviewedProgressInput\] = useState\(null\)/);
  assert.match(panel, /const \[reviewedRationaleInput, setReviewedRationaleInput\] = useState\(null\)/);
  assert.match(panel, /const reviewedPoint = \/\^\\d\+\$\/\.test\(reviewedProgressPercent\.trim\(\)\)/);
  assert.match(panel, /reviewedPoint >= reviewedAssessment\.rangeMin/);
  assert.match(panel, /reviewedPoint <= reviewedAssessment\.rangeMax/);
  assert.match(panel, /reviewedRationale\.trim\(\)\.length > 0/);
  assert.match(panel, /reviewedRationale\.trim\(\)\.length <= MAX_RATIONALE_LENGTH/);
  assert.match(panel, /No elegimos promedio ni completamos este valor automáticamente/);
  assert.doesNotMatch(
    panel,
    /\(\s*reviewedAssessment\.rangeMin\s*\+\s*reviewedAssessment\.rangeMax\s*\)\s*\/\s*2/,
  );

  assert.match(
    panel,
    /reviewedEvidence = \{\s*taskId: reviewedAssessment\.taskId,\s*assessmentId: reviewedAssessment\.assessmentId,\s*expectedAssessmentRevision: reviewedAssessment\.expectedAssessmentRevision,\s*progressPercent: reviewedPoint,\s*rationale,\s*\}/,
  );
  assert.match(
    panel,
    /buildScheduleObservations\(tasks, observationEntries, \{ asOfDate, reviewedEvidence \}\)/,
  );
  assert.match(panel, /No certifica obra, no autoriza pagos y no modifica la tarea ni la baseline/);
});

test('latest forecast detail renders a capped accessible baseline-versus-forecast overlay', () => {
  assert.match(panel, /const FORECAST_COMPARISON_LIMIT = 50/);
  assert.match(panel, /const latestForecastId = typeof forecastRows\[0\]\?\.id === 'string'/);
  assert.match(
    panel,
    /`\/api\/schedule\/forecasts\/\$\{encodeURIComponent\(latestForecastId\)\}`/,
  );
  assert.match(panel, /detailPayload\?\.forecast\?\.id !== latestForecastId/);
  assert.match(panel, /const rows = ordered\.slice\(0, FORECAST_COMPARISON_LIMIT\)/);
  assert.match(panel, /baselineBar: comparisonBar\(task\.baselineStart, task\.baselineFinish, minimum, span\)/);
  assert.match(panel, /forecastBar: comparisonBar\(task\.forecastStart, task\.forecastFinish, minimum, span\)/);
  assert.match(panel, /className=\{styles\.baselineBar\}/);
  assert.match(panel, /className=\{styles\.forecastBar\}/);
  assert.match(panel, /role="img"/);
  assert.match(panel, /Comparación de sólo lectura/);
  assert.match(panel, /no reescriben el plan vigente ni constituyen certificación/);
  assert.match(panel, /Se muestran las \{comparison\.rows\.length\} tareas con mayor desvío absoluto/);
  assert.match(css, /\.baselineBar/);
  assert.match(css, /\.forecastBar/);
  assert.match(css, /\.forecastComparison/);
});

test('canonical Gantt keeps its relative anchor when a project calendar is not yet set', () => {
  assert.match(dashboard, /import \{ canonicalTasksToGanttCatalog \} from '@\/lib\/gantt'/);
  assert.match(dashboard, /canonicalTasksToGanttCatalog\(canonicalTasks, platformAccess\.project\.startsAt\)/);
  assert.match(gantt, /const scheduledStartDay = Number\(task\?\.schedule\?\.startDay\)/);
  assert.match(gantt, /hasRelativeSchedule \? scheduledStartDay - 1 : 0/);
  assert.match(gantt, /hasRelativeSchedule \? scheduledDurationDays : 1/);
  assert.match(planner, /schedule: \{\s*startDay: alignedStartDay,\s*durationDays:/);
});
