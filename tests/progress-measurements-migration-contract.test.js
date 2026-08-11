import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../prisma/migrations/20260811170000_progress_measurements/migration.sql',
  import.meta.url,
);

const [schema, migration] = await Promise.all([
  readFile(schemaPath, 'utf8'),
  readFile(migrationPath, 'utf8'),
]);

test('S9.1 schema publishes a separate decimal quantitative ledger', () => {
  for (const model of [
    'TaskProgressMeasurementHead',
    'TaskProgressMeasurement',
    'TaskProgressMeasurementEvidence',
    'TaskProgressMeasurementDecision',
    'TaskProgressMeasurementBalance',
  ]) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.match(schema, /enum ProgressMeasurementUnitCode \{[\s\S]*M2[\s\S]*M3[\s\S]*LOT/);
  assert.match(schema, /enum ProgressMeasurementMethod \{[\s\S]*DIRECT_COUNT[\s\S]*OTHER_REVIEWED/);
  assert.match(schema, /baseQuantity\s+Decimal\s+@db\.Decimal\(18, 4\)/);
  assert.match(schema, /periodQuantity\s+Decimal\s+@db\.Decimal\(18, 4\)/);
  assert.match(schema, /approvedCumulativeQuantity\s+Decimal\s+@db\.Decimal\(18, 4\)/);
  assert.match(schema, /approvedCumulativeQuantityAtSubmit\s+Decimal\s+@db\.Decimal\(18, 4\)/);
  assert.match(schema, /approvedCumulativeQuantityAfterDecision\s+Decimal\s+@db\.Decimal\(18, 4\)/);
  assert.doesNotMatch(schema, /TaskProgressMeasurement[\s\S]{0,400}\bFloat\b/);
});

test('S9.1 heads structurally preserve tenant scope, canonical task identity, and project eligibility', () => {
  assert.match(schema, /progressMeasurementEligible\s+Boolean\s+@default\(dbgenerated\(\)\)/);
  assert.match(schema, /projectProgressMeasurementEligibleSnapshot\s+Boolean\?\s+@default\(dbgenerated\(\)\)/);
  assert.match(schema, /taskIdentitySnapshot\s+Boolean\s+@default\(true\)/);
  assert.match(schema, /TPMHead_project_eligibility_fkey/);
  assert.match(schema, /references: \[organizationId, id, progressMeasurementEligible\]/);
  assert.match(schema, /TPMHead_task_identity_fkey/);
  assert.match(schema, /references: \[projectId, id, materialRequirementEligible\]/);
  assert.match(migration, /Project_progress_measurement_eligibility_key/);
  assert.match(migration, /TPMHead_project_eligibility_fkey[\s\S]{0,350}ON UPDATE RESTRICT/);
  assert.match(migration, /TPMHead_task_identity_fkey[\s\S]{0,350}ON UPDATE RESTRICT/);
  for (const constraint of [
    'TPM_head_scope_fkey',
    'TPM_predecessor_scope_fkey',
    'TPMHead_head_measurement_scope_fkey',
    'TPMBalance_last_measurement_scope_fkey',
  ]) assert.match(migration, new RegExp(constraint));
});

test('S9.1 SQL freezes civil periods, positive quantity, canonical source and tenant-local future fence', () => {
  assert.match(migration, /TPMHead_civil_fortnight_check/);
  assert.match(migration, /"periodQuantity" > 0/);
  assert.match(migration, /p_period_quantity <= 0/);
  assert.match(migration, /v_project_status NOT IN \('PLANNING', 'ACTIVE', 'PAUSED'\)/);
  assert.match(migration, /v_task_type IS DISTINCT FROM 'TASK'/);
  assert.match(migration, /v_task_source IS DISTINCT FROM 'canonical-task-v1'/);
  assert.match(migration, /CURRENT_TIMESTAMP AT TIME ZONE o\."timezone"/);
  assert.match(migration, /PROGRESS_MEASUREMENT_FUTURE_PERIOD/);
  assert.match(migration, /TPMHead_one_pending_per_task_key[\s\S]{0,180}pendingMeasurementId/);
});

test('S9.1 governed functions preserve the frozen contract and controlled result shape', () => {
  assert.match(
    migration,
    /CREATE FUNCTION "obrasaas_progress_measurement_submit"\([\s\S]*?p_actor_membership_id TEXT\s*\)[\s\S]*?RETURNS TABLE\(/,
  );
  assert.match(
    migration,
    /CREATE FUNCTION "obrasaas_progress_measurement_review"\([\s\S]*?p_expected_head_revision INTEGER[\s\S]*?p_actor_membership_id TEXT\s*\)[\s\S]*?RETURNS TABLE\(/,
  );
  assert.match(migration, /p_operation_kind = 'SUBMIT'[\s\S]{0,100}THEN 'PENDING'/);
  assert.match(migration, /m\."approvedCumulativeQuantityAtSubmit"/);
  assert.match(migration, /d\."approvedCumulativeQuantityAfterDecision"/);
  assert.match(migration, /m\."balanceRevisionAtSubmit" ELSE d\."balanceRevisionAfterDecision"/);
  assert.match(migration, /tm\."tenantRole" IN \('ADMIN', 'DIRECTOR', 'SITE_MANAGER'\)/);
  assert.match(migration, /tm\."tenantRole" IN \('ADMIN', 'DIRECTOR'\)/);
  assert.match(migration, /maker and checker memberships must be different/);
  assert.match(migration, /progress-measurement:submit:[\s\S]{0,160}v_operation_hash/);
  assert.match(migration, /progress-measurement:review:[\s\S]{0,160}v_operation_hash/);
  assert.match(migration, /v_balance\."approvedCumulativeQuantity"\s*- v_prior_period_quantity \+ p_period_quantity/);
  assert.doesNotMatch(migration, /UPDATE\s+"Task"\s+SET\s+"progress"/i);
  assert.doesNotMatch(migration, /UPDATE\s+"(?:Certificate|Certification|Payment)/i);
});

test('S9.1 facts are append-only and projections are guarded even in replica mode', () => {
  for (const trigger of [
    'TaskProgressMeasurement_append_only',
    'TaskProgressMeasurementEvidence_append_only',
    'TaskProgressMeasurementDecision_append_only',
    'TaskProgressMeasurementHead_projection_guard',
    'TaskProgressMeasurementBalance_projection_guard',
    'Task_progress_measurement_identity_guard',
    'Project_progress_measurement_closure_guard',
  ]) {
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
  assert.match(migration, /TaskProgressMeasurement_no_truncate/);
  assert.match(migration, /TaskProgressMeasurementEvidence_no_truncate/);
  assert.match(migration, /TaskProgressMeasurementDecision_no_truncate/);
  assert.match(migration, /PROGRESS_MEASUREMENT_PROJECT_PENDING/);
  assert.match(migration, /PROGRESS_MEASUREMENT_TASK_IDENTITY_IMMUTABLE/);
});
