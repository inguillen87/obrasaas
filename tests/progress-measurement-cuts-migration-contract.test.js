import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [schema, migration] = await Promise.all([
  readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
  readFile(
    new URL(
      '../prisma/migrations/20260811180000_progress_measurement_cuts/migration.sql',
      import.meta.url,
    ),
    'utf8',
  ),
]);

test('S9.2 persists one immutable technical-cut ledger with explicit missing lines', () => {
  assert.match(schema, /enum ProgressMeasurementCutLineState \{\s+MEASURED\s+MISSING\s+\}/);
  for (const model of [
    'ProjectProgressMeasurementCutHead',
    'ProjectProgressMeasurementCut',
    'ProjectProgressMeasurementCutLine',
  ]) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.match(schema, /baseQuantity\s+Decimal\?\s+@db\.Decimal\(18, 4\)/);
  assert.match(schema, /periodQuantity\s+Decimal\?\s+@db\.Decimal\(18, 4\)/);
  assert.match(schema, /cumulativeQuantity\s+Decimal\?\s+@db\.Decimal\(18, 4\)/);
  assert.doesNotMatch(schema, /ProjectProgressMeasurementCut[\s\S]{0,800}\bFloat\b/);
  assert.match(migration, /PPMCutLine_source_shape_check[\s\S]*?"state" = 'MEASURED'/);
  assert.match(migration, /PPMCutLine_source_shape_check[\s\S]*?"state" = 'MISSING'/);
  assert.match(migration, /count\(\*\) FILTER \(WHERE line_state = 'MISSING'\)/);
});

test('S9.2 structurally binds cut, period, task and approved S9.1 evidence to one tenant', () => {
  for (const constraint of [
    'PPMCutHead_project_scope_fkey',
    'PPMCut_head_scope_fkey',
    'PPMCut_predecessor_scope_fkey',
    'PPMCut_sealer_membership_fkey',
    'PPMCutLine_cut_scope_fkey',
    'PPMCutLine_cut_head_period_fkey',
    'PPMCutLine_task_scope_fkey',
    'PPMCutLine_measurement_head_scope_fkey',
    'PPMCutLine_measurement_scope_fkey',
    'PPMCutLine_decision_scope_fkey',
    'PPMCutHead_current_cut_scope_fkey',
  ]) assert.match(migration, new RegExp(constraint));
  assert.match(
    migration,
    /PPMCutLine_decision_scope_fkey[\s\S]{0,500}"approvedDecisionSnapshot"[\s\S]{0,300}"decision"/,
  );
  assert.match(migration, /"approvedDecisionSnapshot" = 'APPROVED'/);
  assert.match(migration, /PPMCutHead_exact_current_cut_key/);
  assert.match(migration, /PPMCutLine_cut_task_key/);
});

test('S9.2 derives a closed civil-fortnight candidate server-side and never truncates it', () => {
  assert.match(migration, /PPMCutHead_civil_fortnight_check/);
  assert.match(migration, /p_period_end >= v_tenant_today/);
  assert.match(migration, /t\."metadata" ->> 'source' = 'canonical-task-v1'/);
  assert.match(migration, /v_task_count > 5000/);
  assert.match(migration, /PROGRESS_MEASUREMENT_CUT_TOO_LARGE/);
  assert.match(migration, /PROGRESS_MEASUREMENT_CUT_REVIEW_PENDING/);
  assert.match(migration, /PROGRESS_MEASUREMENT_CUT_EMPTY/);
  assert.match(migration, /PROGRESS_MEASUREMENT_CUT_CANDIDATE_STALE/);
  assert.match(migration, /PROGRESS_MEASUREMENT_CUT_NO_CHANGE/);
  assert.match(migration, /to_char\(p_period_start, 'YYYY-MM-DD'\)/);
  assert.match(migration, /CURRENT_TIMESTAMP AT TIME ZONE o\."timezone"/);
});

test('S9.2 facts are append-only and only the governed command trigger can write them', () => {
  for (const trigger of [
    'ProjectProgressMeasurementCut_append_only',
    'ProjectProgressMeasurementCut_no_truncate',
    'ProjectProgressMeasurementCutLine_append_only',
    'ProjectProgressMeasurementCutLine_no_truncate',
    'ProjectProgressMeasurementCutHead_projection_guard',
    'ProjectProgressMeasurementCutHead_no_truncate',
  ]) assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  assert.match(migration, /ObrasaasProgressMeasurementCutSealCommand_governed_insert/);
  assert.match(migration, /INSTEAD OF INSERT ON "ObrasaasProgressMeasurementCutSealCommand"/);
  assert.doesNotMatch(
    migration,
    /ENABLE ALWAYS TRIGGER "ObrasaasProgressMeasurementCutSealCommand_governed_insert"/,
  );
  assert.doesNotMatch(schema, /view ObrasaasProgressMeasurementCutSealCommand/);
  assert.match(migration, /pg_catalog\.pg_trigger_depth\(\) <> 1/);
  assert.match(migration, /pg_catalog\.pg_trigger_depth\(\) <> 2/);
  assert.match(migration, /seal worker requires the governed command trigger/);
  assert.match(
    migration,
    /INSERT INTO "ObrasaasProgressMeasurementCutSealCommand" AS command/,
  );
  assert.doesNotMatch(migration, /PG_CONTEXT/);
  assert.match(migration, /direct progress measurement cut projection writes are forbidden/);
  assert.match(migration, /direct progress measurement cut ledger writes are forbidden/);
});

test('S9.2 read and seal share one canonical builder without mutating execution or money', () => {
  for (const helper of [
    'obrasaas_progress_measurement_cut_build_candidate',
    'obrasaas_progress_measurement_cut_read',
    'obrasaas_progress_measurement_cut_result',
    'obrasaas_progress_measurement_cut_seal',
    'obrasaas_progress_measurement_cut_seal_worker',
    'obrasaas_progress_measurement_cut_seal_command',
  ]) assert.match(migration, new RegExp(`CREATE FUNCTION "${helper}"`));
  assert.match(migration, /read requires an active authorized tenant membership/);
  assert.match(migration, /seal requires an active administrator or director membership/);
  assert.match(migration, /progress-measurement-cut:seal:/);
  assert.match(migration, /progress-measurement-cut:scope:/);
  assert.match(migration, /v_sealed_at TIMESTAMP\(3\) := \(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'\)/);
  assert.doesNotMatch(migration, /UPDATE\s+"Task"\s+SET\s+"progress"/i);
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE)\s+"(?:Budget|Certificate|Payment)/i);
});
