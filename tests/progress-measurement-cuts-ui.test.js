import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [page, client, panel, state, css] = await Promise.all([
  readFile(new URL('src/app/dashboard/measurements/page.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/measurements-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/fortnight-cut-panel.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/progress-measurement-cuts-state.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/measurements.module.css', root), 'utf8'),
]);

test('the server page reads one minimal project-period snapshot with explicit cut permissions', () => {
  assert.match(page, /requireTenantPermission\(access, 'org:measurement-cuts:read'/);
  assert.match(page, /hasTenantPermission\(access, 'org:measurement-cuts:seal'\)/);
  assert.match(page, /latestClosedFortnightDate\(tenantToday\)/);
  assert.match(page, /normalizeProgressMeasurementCutQuery\(new URLSearchParams\(\{/);
  assert.match(page, /readProgressMeasurementCutSnapshot\(prisma, \{/);
  assert.match(page, /initialCutSnapshot=\{initialCutSnapshot\}/);
  assert.match(page, /permissions=\{\{ canPrepare, canApprove, canReadCuts, canSeal \}\}/);
  assert.match(page, /initialView === 'cut'[\s\S]{0,500}readProgressMeasurementCutSnapshot/);
  assert.match(page, /: Promise\.resolve\(null\)/);
  assert.doesNotMatch(page, /<MeasurementsClient[\s\S]{0,500}actorMembershipId=/);
});

test('semantic tabs stay mounted so an uncertain idempotent attempt survives navigation', () => {
  assert.match(client, /role="tablist"/);
  assert.match(client, /role="tab"/);
  assert.match(client, /aria-selected=\{activeView === 'tasks'\}/);
  assert.match(client, /aria-selected=\{activeView === 'cut'\}/);
  assert.match(client, /hidden=\{activeView !== 'tasks'\}/);
  assert.match(client, /hidden=\{activeView !== 'cut'\}/);
  assert.match(client, /active=\{activeView === 'cut'\}/);
  assert.doesNotMatch(client, /activeView === 'tasks' \? \(/);
  assert.match(css, /\.measurementTabPanel\[hidden\] \{[\s\S]*display: none/);
  assert.match(client, /ArrowLeft/);
  assert.match(client, /ArrowRight/);
});

test('the cut defaults to the latest closed fortnight and refreshes through scoped GETs', () => {
  assert.match(panel, /latestClosedFortnightDate\(tenantToday\)/);
  assert.match(panel, /max=\{latestClosedDate\}/);
  assert.match(panel, /if \(!active\) \{/);
  assert.match(panel, /setLoadState\(inactiveProgressMeasurementCutLoadState\(snapshotRef\.current\)\)/);
  assert.match(panel, /snapshotRef\.current\?\.requestedPeriod\?\.start === periodStart/);
  assert.match(panel, /new URLSearchParams\(\{ periodDate: periodStart \}\)/);
  assert.match(panel, /\/api\/progress-measurement-cuts\?\$\{query\.toString\(\)\}/);
  assert.match(panel, /const requestSequence = requestSequenceRef\.current \+ 1/);
  assert.match(panel, /snapshotRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(panel, /const controller = new AbortController\(\)/);
  assert.match(panel, /shouldApplyProgressMeasurementCutSnapshot\(\{/);
  assert.match(panel, /selectedPeriodRef\.current !== periodStart/);
  assert.match(panel, /mountedRef\.current = false/);
});

test('seal uses candidate CAS, one stable key, strict 2xx validation, then authoritative GET', () => {
  assert.match(state, /expectedHeadCutId/);
  assert.match(state, /expectedCandidateToken/);
  assert.match(state, /candidate\?\.token/);
  assert.match(panel, /'Idempotency-Key': attempt\.operationKey/);
  assert.match(panel, /body: JSON\.stringify\(attempt\.body\)/);
  assert.match(panel, /result\.cut\.previousCutId !== attempt\.expectedHeadCutId/);
  assert.match(panel, /result\.cut\.candidateToken !== attempt\.expectedCandidateToken/);
  assert.match(panel, /result\.executionAllowed !== false/);
  assert.match(panel, /progressMeasurementCutSnapshotIsUsable\(incoming/);
  assert.match(state, /value\.executionAllowed !== false/);
  assert.match(panel, /await loadSnapshot\(\{ periodStart: attempt\.periodDate, preserveNotice: true \}\)/);
  assert.doesNotMatch(panel, /setSnapshot\(result/);
});

test('ambiguous POSTs reconcile first and never manufacture a new operation key', () => {
  assert.match(panel, /uncertainProgressMeasurementCutAttempt\(attempt\)/);
  assert.match(panel, /No hubo reintento automático/);
  assert.match(panel, /progressMeasurementCutSnapshotConfirmsAttempt\(incoming, attempt\)/);
  assert.match(panel, /Otra composición avanzó la cabecera/);
  assert.match(panel, /Consultar recibo con misma clave/);
  assert.match(state, /snapshot\.latestCut\.previousCutId === \(attempt\.expectedHeadCutId \|\| null\)/);
  assert.match(state, /snapshot\.latestCut\.candidateToken === attempt\.expectedCandidateToken/);
  const sealStart = panel.indexOf('async function performSeal');
  const submitStart = panel.indexOf('async function sealCut');
  assert.doesNotMatch(panel.slice(sealStart, submitStart), /AbortController|signal:/);
});

test('candidate comparison exposes missing work as absence and exact per-line quantities', () => {
  assert.match(panel, /Sin medición aprobada; no equivale a cero/);
  assert.match(panel, /nunca se convierten en cantidad cero/);
  assert.match(panel, /Tareas canónicas/);
  assert.match(panel, /Con medición/);
  assert.match(panel, /Sin medición/);
  assert.match(panel, /Candidato derivado ahora/);
  assert.match(panel, /Último corte sellado/);
  assert.match(panel, /baselineQuantity/);
  assert.match(panel, /executedQuantity/);
  assert.match(panel, /cumulativeQuantity/);
  assert.match(panel, /exactMeasurementSummary/);
  assert.doesNotMatch(panel, /parseFloat|parseInt/);
  assert.match(state, /REVIEW_REQUIRED/);
  assert.match(state, /SHA256_PATTERN\.test\(left\.snapshotToken\)/);
  assert.match(state, /SHA256_PATTERN\.test\(right\.snapshotToken\)/);
  assert.match(state, /left\.snapshotToken === right\.snapshotToken/);
});

test('the surface stays technical, private in meaning, accessible, timezone-safe, and mobile', () => {
  assert.match(panel, /no es certificado, precio, cuenta por pagar ni pago/);
  assert.match(panel, /No hay estado contractual optimista/);
  assert.doesNotMatch(panel, /fetch\([^\n]*(certificates|payables|budgets|tasks)/i);
  assert.doesNotMatch(panel, /method: '(PUT|PATCH|DELETE)'/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /aria-labelledby="cut-comparison-heading"/);
  assert.match(panel, /<caption>/);
  assert.match(panel, /scope="col"/);
  assert.match(panel, /scope="row"/);
  assert.match(panel, /dateTimeFormatter\(organizationTimeZone\)/);
  assert.match(panel, /timeZone,/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.cutSummaryGrid \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /\.cutTableScroller \{[\s\S]*overflow-x: auto/);
});
