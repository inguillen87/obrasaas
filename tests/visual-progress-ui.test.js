import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(
  new URL('../src/app/dashboard/progress/page.js', import.meta.url),
  'utf8',
);
const clientSource = readFileSync(
  new URL('../src/app/dashboard/progress/progress-client.js', import.meta.url),
  'utf8',
);

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  assert.ok(start >= 0, `${name} should exist`);
  assert.ok(end > start, `${name} should have a bounded source block`);
  return source.slice(start, end);
}

test('Bitácora gates visual progress with tenant setting and both exact permissions', () => {
  assert.match(pageSource, /tenantAiSettingsFromMetadata\(access\.organization\.metadata\)/);
  assert.match(
    pageSource,
    /const canUseVisualProgress = \(\s*canManage\s*&& canReadSourceEvidence\s*&& aiSettings\.visualProgressEnabled\s*\)/,
  );
  assert.match(
    pageSource,
    /const visibleEvidenceIds = journal\.evidence\.map[\s\S]{0,500}canReadSourceEvidence\s*\? listVisualProgressAssessments\(prisma, \{[\s\S]{0,180}evidenceIds: visibleEvidenceIds,[\s\S]{0,100}latestPerEvidence: true,[\s\S]{0,100}: Promise\.resolve\(\{ assessments: \[\] \}\)/,
  );
  assert.match(pageSource, /initialVisualAssessments=\{visualAssessments\.assessments\.map\(visualAssessmentForClient\)\}/);
  assert.match(pageSource, /initialWorkDate=\{localDateKey\(new Date\(\), access\.organization\.timezone\)\}/);
  assert.doesNotMatch(clientSource, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(pageSource, /canUseVisualProgress,/);
});

test('visual assessment DTOs expose UI facts but omit provider internals and hashes', () => {
  const serverProjection = functionSource(pageSource, 'visualAssessmentForClient', 'ProgressPage');
  const clientProjection = functionSource(clientSource, 'visualAssessmentForUi', 'VisualAssessmentCard');
  for (const projection of [serverProjection, clientProjection]) {
    assert.match(projection, /observations/);
    assert.match(projection, /limitations/);
    assert.match(projection, /reviewStatus/);
    assert.doesNotMatch(projection, /baselineHash|provider|model|failureCode|organizationId/);
  }
});

test('analysis uses one stable idempotency key per attempt and polls without resending the image', () => {
  assert.match(
    clientSource,
    /const existingKey = visualAttemptRef\.current\.get\(item\.id\);[\s\S]{0,180}visualAttemptRef\.current\.set\(item\.id, idempotencyKey\)/,
  );
  assert.match(clientSource, /headers: \{ "Idempotency-Key": idempotencyKey \}/);
  assert.match(
    clientSource,
    /method: "POST"[\s\S]{0,900}pollVisualAssessment\(item\.id, assessment\.id\)/,
  );
  assert.match(
    clientSource,
    /async function loadVisualAssessmentsForEvidence\(evidenceId\)[\s\S]{0,260}visual-assessments`/,
  );
  assert.match(clientSource, /visualRequestLocksRef\.current\.has\(item\.id\)/);
  assert.match(clientSource, /se conservará la misma clave para evitar duplicados/);
  assert.match(
    clientSource,
    /async function refreshVisualState\(item\)[\s\S]{0,520}TERMINAL_VISUAL_STATUSES\.has\(current\.status\)[\s\S]{0,100}visualAttemptRef\.current\.delete\(item\.id\)/,
  );
});

test('human review sends expectedRevision and supports approved, corrected, and rejected outcomes', () => {
  assert.match(
    clientSource,
    /method: "PATCH"[\s\S]{0,220}expectedRevision: assessment\.revision/,
  );
  assert.match(clientSource, /<option value="APPROVED">Aprobar lectura<\/option>/);
  assert.match(clientSource, /<option value="CORRECTED">Corregir rango<\/option>/);
  assert.match(clientSource, /<option value="REJECTED">Rechazar lectura<\/option>/);
  assert.match(
    clientSource,
    /const minText = correctedMin\.trim\(\);[\s\S]{0,240}!minText[\s\S]{0,80}!maxText[\s\S]{0,120}!Number\.isSafeInteger\(min\)/,
  );
  assert.match(clientSource, /correctedProgressMin: min, correctedProgressMax: max/);
  assert.match(clientSource, /error\.status === 409/);
});

test('visual results communicate uncertainty, abstention, quality, facts, and limits safely', () => {
  assert.match(clientSource, /Rango orientativo/);
  assert.match(clientSource, /Autoconfianza del modelo \(orientativa, no calibrada\)/);
  assert.match(
    clientSource,
    /\{assessment\.status === "COMPLETED" && \([\s\S]{0,900}Autoconfianza del modelo/,
  );
  assert.doesNotMatch(
    clientSource,
    /\{assessment\.status === "ABSTAINED" && \([\s\S]{0,900}Autoconfianza del modelo/,
  );
  assert.match(clientSource, /Hechos observables/);
  assert.match(clientSource, /Limitaciones/);
  assert.match(clientSource, /Calidad de la evidencia/);
  assert.match(clientSource, /Sin estimación responsable/);
  assert.match(
    clientSource,
    /Orientativo: no certifica avance, no autoriza pagos y no modifica el Gantt\./,
  );
});
