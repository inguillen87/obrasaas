import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [page, client, state, css, shell, shellModel] = await Promise.all([
  readFile(new URL('src/app/dashboard/measurements/page.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/measurements-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/progress-measurements-state.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/measurements/measurements.module.css', root), 'utf8'),
  readFile(new URL('src/app/dashboard/dashboard-shell.js', root), 'utf8'),
  readFile(new URL('src/lib/dashboard-shell.js', root), 'utf8'),
]);

test('the server page requires explicit measurement read access and sends a minimized DTO', () => {
  assert.match(page, /requireTenantPermission\(access, 'org:measurements:read'/);
  assert.match(page, /hasTenantPermission\(access, 'org:measurements:prepare'\)/);
  assert.match(page, /hasTenantPermission\(access, 'org:measurements:approve'\)/);
  assert.match(page, /Boolean\(actorMembershipId\)[\s\S]*org:measurements:prepare/);
  assert.match(page, /if \(!access\.tenantMembershipId\)/);
  assert.match(page, /code: 'TENANT_MEMBERSHIP_REQUIRED'/);
  assert.match(page, /Promise\.all\(\[/);
  assert.match(page, /readTaskProgressMeasurementSnapshot\(prisma/);
  assert.match(page, /actorMembershipId,/);
  assert.match(page, /status: 'APPROVED'/);
  assert.match(page, /select: \{ id: true, taskId: true, capturedAt: true \}/);
  assert.doesNotMatch(page, /media: true|latitude: true|longitude: true|caption: true/);
  assert.doesNotMatch(page, /<MeasurementsClient[\s\S]{0,300}actorMembershipId=/);
});

test('task and evidence catalogs fail closed rather than silently truncating writes', () => {
  assert.match(page, /take: CATALOG_LIMIT \+ 1/);
  assert.match(page, /visibleTaskRows\.some\(\(task\) => task\.id === initialTask\.id\)/);
  assert.match(page, /visibleTaskRows\.unshift\(initialTask\)/);
  assert.match(page, /tasks=\{visibleTaskRows\}/);
  assert.match(page, /tasksTruncated=\{taskRows\.length > CATALOG_LIMIT\}/);
  assert.match(page, /approvedEvidenceTruncated=\{evidenceRows\.length > CATALOG_LIMIT\}/);
  assert.match(client, /const preparationFailClosed = tasksTruncated \|\| approvedEvidenceTruncated/);
  assert.match(client, /preparar nuevas mediciones quedó bloqueado para no operar sobre datos parciales/);
});

test('a task-wide pending review blocks makers and opens its blocking fortnight', () => {
  assert.match(client, /snapshot\?\.readiness\?\.reviewPending === true/);
  assert.match(client, /&& !preparationBlockedByPending/);
  assert.match(client, /Ya existe una propuesta pendiente para esta tarea/);
  assert.match(client, /snapshot\.readiness\.blockingPeriod\?\.label/);
  assert.match(client, /Abrir quincena pendiente/);
  assert.match(client, /snapshot\.readiness\.pendingIsRequestedPeriod/);
});

test('the proposal uses one stable idempotent POST and GET reconciliation', () => {
  assert.match(client, /submitBusyRef\.current/);
  assert.match(client, /if \(submitBusyRef\.current \|\| mutationBusyRef\.current\) return/);
  assert.match(client, /'Idempotency-Key': attempt\.operationKey/);
  assert.match(client, /body: JSON\.stringify\(attempt\.body\)/);
  assert.match(client, /uncertainProgressMeasurementAttempt\(attempt\)/);
  assert.match(client, /No se reintentó automáticamente/);
  assert.match(client, /Conciliar ahora/);
  assert.match(client, /Reenviar misma propuesta/);
  assert.match(client, /await loadSnapshot\(\{[\s\S]{0,120}periodDate: attempt\.body\.periodDate,[\s\S]{0,120}taskId: attempt\.taskId/);
  assert.doesNotMatch(client, /catch \(error\) \{[\s\S]{0,350}performSubmit\(attempt\)/);
});

test('review is checker-only, CASes the authoritative head revision, and is also idempotent', () => {
  assert.match(client, /measurement\.preparedBy\?\.isCurrentActor === true/);
  assert.match(client, /Separación maker-checker/);
  assert.match(client, /head\?\.pendingMeasurementId !== measurement\.id/);
  assert.match(client, /head\.revision < 1/);
  assert.match(client, /reviewAttempt\(measurement, input, head\.revision\)/);
  assert.match(client, /expectedRevision,/);
  assert.match(client, /progress-measurement-review-\$\{newUuid\(\)\}/);
  assert.match(client, /\/api\/progress-measurements\/\$\{encodeURIComponent\(attempt\.measurementId\)\}\/review/);
  assert.match(client, /La decisión quedó incierta/);
});

test('network races are aborted or discarded without aborting ambiguous POSTs', () => {
  assert.match(client, /const requestSequence = requestSequenceRef\.current \+ 1/);
  assert.match(client, /snapshotRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(client, /const controller = new AbortController\(\)/);
  assert.match(client, /shouldApplyMeasurementSnapshot\(\{/);
  assert.match(client, /selectedTaskRef\.current !== taskId/);
  assert.match(client, /selectedPeriodRef\.current !== requestPeriodStart/);
  assert.match(client, /periodDate: requestPeriodStart/);
  assert.match(client, /query = new URLSearchParams\(\{[\s\S]{0,120}periodDate: requestPeriodStart/);
  assert.match(client, /mountedRef\.current = false/);
  assert.match(client, /if \(!mountedRef\.current\) return/);
  const submitStart = client.indexOf('async function performSubmit');
  const reviewStart = client.indexOf('async function performReview');
  const submitBlock = client.slice(submitStart, reviewStart);
  assert.doesNotMatch(submitBlock, /AbortController|signal:/);
});

test('the UI exposes exact quantities, civil fortnights, evidence, and an append-only timeline', () => {
  assert.match(client, /type="date"/);
  assert.match(client, /inputMode="decimal"/);
  assert.match(client, /pattern="\(\?:0\|\[1-9\]\[0-9\]\{0,13\}\)\(\?:\[\.\]\[0-9\]\{1,4\}\)\?"/);
  assert.match(client, /Cantidad base/);
  assert.match(client, /Cantidad ejecutada en el período/);
  assert.match(client, /Fundamento técnico/);
  assert.match(client, /Evidencia aprobada · 1 a 10/);
  assert.match(client, /Base técnica/);
  assert.match(client, /Aprobado/);
  assert.match(client, /Restante/);
  assert.match(client, /Avance derivado/);
  assert.match(client, /Línea de tiempo de propuesta y decisión/);
  assert.match(client, /Historial inmutable/);
  assert.match(state, /expectedHeadId: snapshot\?\.head\?\.latestMeasurementId \|\| null/);
  assert.match(state, /snapshot\?\.requestedPeriod\?\.start !== period\.start/);
});

test('the surface never claims or calls certification, payment, Gantt, or task progress mutations', () => {
  assert.match(client, /No certifica pagos ni cambia Gantt, presupuesto o Task\.progress/);
  assert.match(client, /no modifica Gantt ni pagos/);
  assert.doesNotMatch(client, /fetch\([^\n]*(tasks|budgets|payables|certificates)/i);
  assert.doesNotMatch(client, /method: '(PUT|PATCH|DELETE)'/);
  assert.doesNotMatch(state, /parseFloat|parseInt/);
});

test('navigation, accessibility, and mobile layout expose the measurement vertical professionally', () => {
  assert.match(shell, /href: '\/dashboard\/measurements'/);
  assert.match(shell, /permission: 'canReadMeasurements'/);
  assert.match(shellModel, /canReadMeasurements: hasTenantPermission\(access, 'org:measurements:read'\)/);
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /role="alert"/);
  assert.match(client, /aria-label="Línea de tiempo de propuesta y decisión"/);
  assert.match(client, /aria-labelledby="measurement-history-heading"/);
  assert.match(page, /organizationTimeZone=\{access\.organization\.timezone\}/);
  assert.match(client, /timeZone,/);
  assert.match(client, /dateTimeFormatter\(organizationTimeZone\)/);
  assert.doesNotMatch(client, /DATE_TIME_FORMATTER/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.workspace \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /\.uncertainActions,[\s\S]*width: 100%/);
});
