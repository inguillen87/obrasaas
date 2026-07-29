import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const verifier = await readFile(
  new URL('scripts/verify-visual-progress-migration.mjs', root),
  'utf8',
);
const migration = await readFile(
  new URL(
    'prisma/migrations/20260726143000_visual_progress_assessments/migration.sql',
    root,
  ),
  'utf8',
);
const dispatchMigration = await readFile(
  new URL(
    'prisma/migrations/20260728080000_ai_dispatch_plan_persistence/migration.sql',
    root,
  ),
  'utf8',
);
const build = await readFile(new URL('scripts/vercel-build.mjs', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('visual progress verifier rejects non-public AI dispatch schemas before connecting', () => {
  const verifierPath = fileURLToPath(
    new URL('scripts/verify-visual-progress-migration.mjs', root),
  );
  const result = spawnSync(process.execPath, [verifierPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      VISUAL_PROGRESS_MIGRATION_DATABASE_URL:
        'postgresql://verifier:verifier@127.0.0.1:1/obrasaas?schema=tenant_test',
      VISUAL_PROGRESS_MIGRATION_SCHEMA: 'tenant_test',
    },
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /AI Dispatch Plan v1 is schema-qualified to public/);
  assert.doesNotMatch(output, /ECONNREFUSED|connect ECONNREFUSED/);
});

test('visual progress verifier uses an isolated schema-bound TLS connection', () => {
  assert.match(verifier, /VISUAL_PROGRESS_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /VISUAL_PROGRESS_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /postgres:', 'postgresql:/);
  assert.match(verifier, /SCHEMA_IDENTIFIER_PATTERN/);
  assert.match(verifier, /conflicting schema parameters/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /must use sslmode=verify-full for a remote PostgreSQL host/);
  assert.match(verifier, /SET LOCAL search_path/);
  assert.match(verifier, /AI_DISPATCH_MIGRATION_SCHEMA = 'public'/);
  assert.match(verifier, /AI Dispatch Plan v1 is schema-qualified/);
  assert.match(verifier, /SCHEMA_ENV.*must be/);
  assert.match(verifier, /obrasaas-visual-progress-migration-verifier/);
  assert.doesNotMatch(verifier, /console\.(?:log|error)\([^\n]*connectionString/);
});

test('visual progress verifier catalogs the applied migration, exact enums and critical columns', () => {
  assert.match(verifier, /20260726143000_visual_progress_assessments/);
  assert.match(verifier, /20260728080000_ai_dispatch_plan_persistence/);
  assert.match(verifier, /FROM "_prisma_migrations"/);
  assert.match(verifier, /JOIN pg_enum/);
  assert.match(verifier, /FROM information_schema\.columns/);
  assert.match(verifier, /dataType: 'integer', udtName: 'int4', numericPrecision: 32, numericScale: 0/);
  assert.match(verifier, /VisualProgressAssessmentStatus:[\s\S]*PENDING[\s\S]*RUNNING[\s\S]*COMPLETED[\s\S]*ABSTAINED[\s\S]*FAILED/);
  assert.match(verifier, /VisualProgressAssessmentReviewStatus:[\s\S]*PENDING[\s\S]*APPROVED[\s\S]*CORRECTED[\s\S]*REJECTED/);
  assert.match(verifier, /AiDispatchBudgetReservationStatus:[\s\S]*RESERVED[\s\S]*SETTLED[\s\S]*RELEASED/);
  assert.match(verifier, /AiDispatchSettlementBasis:[\s\S]*PRE_DISPATCH_RELEASE[\s\S]*RESPONSE_USAGE[\s\S]*RECONCILED_USAGE[\s\S]*PROVIDER_BILLING[\s\S]*CONFIRMED_NO_CHARGE/);

  for (const column of [
    'operationKeyHash',
    'requestFingerprint',
    'providerModel',
    'registryModelId',
    'providerRoute',
    'routePolicyVersion',
    'routeReasonCode',
    'pricingVersion',
    'budgetCivilDayUtc',
    'budgetWorkload',
    'quotaPolicyVersion',
    'budgetLimitMicros',
    'budgetReservationMicros',
    'estimateBasis',
    'providerDispatchStartedAt',
    'providerResponseId',
    'providerRequestId',
    'inputSha256',
    'baselineHash',
    'leaseExpiresAt',
    'attemptCount',
    'confidence',
    'reviewStatus',
    'correctedProgressMin',
    'correctedProgressMax',
    'revision',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'cachedInputTokens',
    'estimatedCostMicros',
    'actualCostMicros',
  ]) {
    assert.match(verifier, new RegExp(`${column}:`));
  }
});

test('visual progress verifier requires every lifecycle and review check to be validated', () => {
  for (const constraint of [
    'VisualProgressAssessment_hashes_check',
    'VisualProgressAssessment_versions_check',
    'VisualProgressAssessment_lease_state_check',
    'VisualProgressAssessment_provider_identity_check',
    'VisualProgressAssessment_dispatch_audit_check',
    'VisualProgressAssessment_element_type_check',
    'VisualProgressAssessment_progress_range_check',
    'VisualProgressAssessment_confidence_check',
    'VisualProgressAssessment_json_shape_check',
    'VisualProgressAssessment_failure_code_check',
    'VisualProgressAssessment_result_state_check',
    'VisualProgressAssessment_review_state_check',
    'VisualProgressAssessment_timestamps_check',
  ]) {
    assert.match(verifier, new RegExp(`${constraint}:`));
    assert.match(
      constraint === 'VisualProgressAssessment_dispatch_audit_check'
        ? dispatchMigration
        : migration,
      new RegExp(`CONSTRAINT "${constraint}"`),
    );
  }
  assert.match(verifier, /constraint_record\.convalidated/);
  assert.match(verifier, /check\.convalidated === true/);
  assert.match(verifier, /progressMin >= 0/);
  assert.match(verifier, /progressMax <= 100/);
  assert.match(verifier, /confidence >= 0/);
  assert.match(verifier, /correctedProgressMin >= 0/);
  assert.match(verifier, /correctedProgressMax <= 100/);
});

test('visual progress verifier governs all indexes and the exact open-evidence predicate', () => {
  assert.match(verifier, /JOIN pg_index/);
  assert.match(verifier, /indisvalid/);
  assert.match(verifier, /indisready/);
  assert.match(verifier, /indnullsnotdistinct/);
  assert.match(verifier, /pg_get_expr\(index_state\.indpred/);
  assert.match(verifier, /normalizePredicate\(index\.predicate\) === expected\.predicate/);
  assert.match(verifier, /VPA_project_evidence_open_key:[\s\S]*unique: true[\s\S]*predicate: OPEN_PREDICATE/);
  assert.match(verifier, /VPA_project_evidence_unsettled_dispatch_key:[\s\S]*unique: true[\s\S]*predicate: UNSETTLED_DISPATCH_PREDICATE/);
  assert.match(verifier, /registryModelId[\s\S]*IS NOT NULL[\s\S]*actualCostMicros[\s\S]*IS NULL/);
  assert.match(verifier, /status[\s\S]*PENDING[\s\S]*RUNNING[\s\S]*OR[\s\S]*COMPLETED[\s\S]*ABSTAINED[\s\S]*AND[\s\S]*reviewStatus[\s\S]*PENDING/);

  for (const index of [
    'VisualProgressAssessment_project_operation_key',
    'VPA_project_evidence_open_key',
    'VisualProgressAssessment_project_fingerprint_idx',
    'VPA_project_registry_created_idx',
    'VPA_project_evidence_unsettled_dispatch_key',
    'VPA_project_status_lease_idx',
    'VPA_project_task_status_created_idx',
    'VPA_project_evidence_created_idx',
    'VPA_project_review_created_idx',
    'VPA_requester_created_idx',
    'VPA_reviewer_reviewed_idx',
  ]) {
    assert.match(verifier, new RegExp(`${index}:`));
    assert.match(
      [
        'VPA_project_registry_created_idx',
        'VPA_project_evidence_unsettled_dispatch_key',
      ].includes(index) ? dispatchMigration : migration,
      new RegExp(`"${index}"`),
    );
  }
});

test('visual progress verifier requires scoped immediate foreign keys', () => {
  assert.match(verifier, /VisualProgressAssessment_project_task_fkey:[\s\S]*target: 'Task'[\s\S]*columns: \['projectId', 'taskId'\][\s\S]*deleteAction: 'r'/);
  assert.match(verifier, /VisualProgressAssessment_project_evidence_fkey:[\s\S]*target: 'ProgressEvidence'[\s\S]*columns: \['projectId', 'evidenceId'\][\s\S]*deleteAction: 'r'/);
  assert.match(verifier, /VisualProgressAssessment_projectId_fkey:[\s\S]*target: 'Project'[\s\S]*deleteAction: 'c'/);
  assert.match(verifier, /VisualProgressAssessment_requestedById_fkey:[\s\S]*deleteAction: 'r'/);
  assert.match(verifier, /VisualProgressAssessment_reviewedById_fkey:[\s\S]*deleteAction: 'r'/);
  assert.match(verifier, /foreignKey\.contype === 'f' && foreignKey\.convalidated/);
  assert.match(verifier, /!foreignKey\.condeferrable && !foreignKey\.condeferred/);
  assert.match(verifier, /foreignKey\.confupdtype === 'c'/);
  assert.match(verifier, /source_attribute\.attname::text/);
  assert.match(verifier, /target_attribute\.attname::text/);
});

test('visual progress verifier smoke is semantic and rollback-only', () => {
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /SAVEPOINT/);
  assert.match(verifier, /ROLLBACK TO SAVEPOINT/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /(?:await\s+client\.query\(|client\.query\()\s*['"]COMMIT['"]/);
  assert.match(verifier, /VisualProgressAssessment hash guard/);
  assert.match(verifier, /VisualProgressAssessment RUNNING lease guard/);
  assert.match(verifier, /VisualProgressAssessment completed result guard/);
  assert.match(verifier, /VisualProgressAssessment open evidence uniqueness/);
  assert.match(verifier, /VisualProgressAssessment unresolved review uniqueness/);
  assert.match(verifier, /VisualProgressAssessment cross-project task scope/);
  assert.match(verifier, /VisualProgressAssessment cross-project evidence scope/);
  assert.match(verifier, /VisualProgressAssessment requester retention policy/);
  assert.match(verifier, /VisualProgressAssessment orphan usage telemetry guard/);
  assert.match(verifier, /VisualProgressAssessment governed provider route guard/);
  assert.match(verifier, /VisualProgressAssessment pre-reservation dispatch guard/);
  assert.match(verifier, /VisualProgressAssessment token accounting guard/);
  assert.match(verifier, /VisualProgressAssessment usage immutability guard/);
  assert.match(verifier, /VisualProgressAssessment provider correlation immutability guard/);
  assert.match(verifier, /VisualProgressAssessment durable settlement requirement/);
  assert.match(verifier, /VisualProgressAssessment actual cost immutability guard/);
  assert.match(verifier, /VisualProgressAssessment unsettled governed evidence fence/);
  assert.match(verifier, /Settled evidence did not release its governed dispatch fence/);
  assert.match(verifier, /AI assessment reservation replay identity guard/);
  assert.match(verifier, /AI assessment settlement provenance replay guard/);
  assert.match(verifier, /AI settlement dispatch-start guard/);
  assert.match(verifier, /AI post-overrun admission guard/);
  assert.match(verifier, /Normalized visual provider receipt complete-usage guard/);
  assert.match(verifier, /Normalized visual provider receipt content immutability guard/);
  assert.match(verifier, /Normalized visual provider receipt retention guard/);
  assert.match(verifier, /AI reservation direct terminal-transition guard/);
  assert.match(verifier, /AI reservation direct insert guard/);
  assert.match(verifier, /AI daily budget direct update guard/);
  assert.match(verifier, /Governed assessment deferred reservation requirement/);
  assert.match(verifier, /Governed assessment tenant-lifetime retention guard/);
  assert.match(verifier, /Governed project tenant-lifetime retention guard/);
  assert.match(verifier, /transaction-local capability markers leaked/);
  assert.match(verifier, /AI reservation ledger retention policy/);
  assert.match(verifier, /AI daily budget direct insert guard/);
  assert.match(verifier, /Tenant cascade did not delete the governed AI budget graph/);
  assert.match(verifier, /return value == null \? null : JSON\.stringify\(value\)/);
  assert.match(verifier, /"correctedProgressMax", "createdAt", "updatedAt"/);
  assert.match(verifier, /\$34, \$35, \$35/);
  assert.match(verifier, /overrides\.updatedAt \?\? overrides\.completedAt \?\? new Date\(\)/);
  assert.match(verifier, /'23514'/);
  assert.match(verifier, /'23503'/);
  assert.match(verifier, /'23505'/);
  assert.match(verifier, /@invalid\.example/);
});

test('visual progress verifier governs the exact daily budget aggregate and invoker helpers', () => {
  assert.match(verifier, /AiDailyBudgetLedger/);
  for (const column of [
    'civilDayUtc',
    'workload',
    'quotaPolicyVersion',
    'budgetLimitMicros',
    'reservedMicros',
    'settledMicros',
    'requestCount',
  ]) {
    assert.match(verifier, new RegExp(`${column}:`));
  }
  for (const constraint of [
    'AiDailyBudgetLedger_identity_check',
    'AiDailyBudgetLedger_counters_check',
    'AiDailyBudgetLedger_timestamps_check',
  ]) {
    assert.match(verifier, new RegExp(`${constraint}:`));
    assert.match(dispatchMigration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  for (const index of [
    'AiDailyBudgetLedger_pkey',
    'AiDailyBudgetLedger_day_workload_idx',
    'AiDailyBudgetLedger_org_updated_idx',
  ]) {
    assert.match(verifier, new RegExp(`${index}:`));
    assert.match(dispatchMigration, new RegExp(`"${index}"`));
  }
  assert.match(verifier, /AiDailyBudgetLedger_organizationId_fkey/);
  assert.match(verifier, /obrasaas_ai_daily_budget_reserve/);
  assert.match(verifier, /obrasaas_ai_daily_budget_settle/);
  assert.match(verifier, /pg_advisory_xact_lock/);
  assert.match(verifier, /hashtextextended/);
  assert.match(verifier, /procedure\.prosecdef === false/);
  assert.match(verifier, /search_path=pg_catalog/);
  assert.match(verifier, /await assertBudgetFunctions\(client\)/);
  assert.match(verifier, /await assertDispatchAuditTrigger\(client\)/);
  assert.match(verifier, /await assertPersistenceTriggers\(client\)/);
  assert.match(verifier, /AiDailyBudgetLedger_write_guard/);
  assert.match(verifier, /AiDailyBudgetLedger_organization_retention/);
  assert.match(verifier, /AiDailyBudgetLedger_transition_guard/);
});

test('visual progress verifier requires the enabled write-once AI dispatch trigger', () => {
  assert.match(verifier, /VisualProgressAssessment_ai_dispatch_write_once/);
  assert.match(verifier, /obrasaas_ai_dispatch_audit_write_once/);
  assert.match(verifier, /FROM pg_trigger AS trigger_record/);
  assert.match(verifier, /trigger\.tgenabled === 'O'/);
  assert.match(verifier, /trigger\.tgisinternal === false/);
  assert.match(verifier, /before insert or update/);
  assert.match(dispatchMigration, /CREATE TRIGGER "VisualProgressAssessment_ai_dispatch_write_once"/);
  for (const invariantName of [
    'AiDispatchAudit_core_immutable',
    'AiDispatchAudit_dispatch_start_immutable',
    'AiDispatchAudit_dispatch_reservation_required',
    'AiDispatchAudit_request_id_immutable',
    'AiDispatchAudit_response_id_immutable',
    'AiDispatchAudit_usage_immutable',
    'AiDispatchAudit_actual_cost_immutable',
    'AiDispatchAudit_settlement_required',
  ]) {
    assert.match(verifier, new RegExp(invariantName));
    assert.match(dispatchMigration, new RegExp(invariantName));
  }
});

test('visual progress verifier governs durable reservation identity and exact helper signatures', () => {
  assert.match(verifier, /AiDispatchBudgetReservation/);
  for (const column of [
    'assessmentId',
    'organizationId',
    'projectId',
    'civilDayUtc',
    'workload',
    'quotaPolicyVersion',
    'budgetLimitMicros',
    'reservedMicros',
    'actualMicros',
    'status',
    'settlementBasis',
    'settlementOperationKeyHash',
    'settlementEvidenceSha256',
    'settledById',
    'reservedAt',
    'settledAt',
  ]) {
    assert.match(verifier, new RegExp(`${column}:`));
  }
  for (const constraint of [
    'AiDispatchBudgetReservation_identity_check',
    'AiDispatchBudgetReservation_state_check',
    'AiDispatchBudgetReservation_timestamps_check',
  ]) {
    assert.match(verifier, new RegExp(`${constraint}:`));
    assert.match(dispatchMigration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  for (const index of [
    'AiDispatchBudgetReservation_pkey',
    'AiDispatchBudgetReservation_project_assessment_key',
    'AiDispatchBudgetReservation_org_settlement_operation_key',
    'AiDispatchBudgetReservation_ledger_status_idx',
    'AiDispatchBudgetReservation_org_status_updated_idx',
    'AiDispatchBudgetReservation_settled_by_idx',
  ]) {
    assert.match(verifier, new RegExp(`${index}:`));
    assert.match(dispatchMigration, new RegExp(`"${index}"`));
  }
  assert.match(verifier, /AiDispatchBudgetReservation_project_scope_fkey:[\s\S]*deleteAction: 'c'/);
  assert.match(verifier, /AiDispatchBudgetReservation_assessment_scope_fkey:[\s\S]*deleteAction: 'c'/);
  assert.match(verifier, /AiDispatchBudgetReservation_daily_ledger_fkey:[\s\S]*deleteAction: 'a'/);
  assert.match(verifier, /AiDispatchBudgetReservation_settledById_fkey:[\s\S]*deleteAction: 'r'/);
  assert.match(dispatchMigration, /AiDispatchBudgetReservation_daily_ledger_fkey[\s\S]*ON DELETE NO ACTION/);
  assert.match(verifier, /identityArguments\.includes\('p_assessment_id text'\)/);
  assert.match(verifier, /identityArguments\.includes\('p_actual_micros bigint'\)/);
  assert.match(verifier, /identityArguments\.includes\('p_settlement_basis'\)/);
  assert.match(verifier, /identityArguments\.includes\('p_settlement_operation_key_hash text'\)/);
  assert.match(verifier, /identityArguments\.includes\('p_settlement_evidence_sha256 text'\)/);
  assert.match(verifier, /identityArguments\.includes\('p_settled_by_id text'\)/);
  assert.match(verifier, /!identityArguments\.includes\('p_reserved_micros'\)/);
  assert.match(verifier, /result_type\)\.includes\('AiDispatchBudgetReservation'\)/);
  assert.match(verifier, /await assertReservationColumns\(client\)/);
  assert.match(verifier, /await assertReservationForeignKeys\(client\)/);
  assert.match(verifier, /AiDispatchBudgetReservation_insert_guard/);
  assert.match(verifier, /VisualProgressAssessment_budget_reservation_required/);
});

test('visual progress verifier governs normalized provider receipts end to end', () => {
  assert.match(verifier, /VisualProgressProviderResultReceipt/);
  for (const column of [
    'receiptSha256',
    'submittedSha256',
    'abstentionReason',
    'cacheWriteTokens',
    'receivedAt',
    'appliedAt',
  ]) {
    assert.match(verifier, new RegExp(`${column}:`));
  }
  for (const constraint of [
    'VPRR_identity_check',
    'VPRR_dimensions_check',
    'VPRR_result_check',
    'VPRR_json_shape_check',
    'VPRR_usage_check',
    'VPRR_lifecycle_check',
  ]) {
    assert.match(verifier, new RegExp(`${constraint}:`));
    assert.match(dispatchMigration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  for (const index of [
    'VPRR_project_assessment_key',
    'VPRR_org_receipt_sha_key',
    'VPRR_org_received_idx',
    'VPRR_project_received_idx',
    'VPRR_project_pending_received_idx',
  ]) {
    assert.match(verifier, new RegExp(`${index}:`));
    assert.match(dispatchMigration, new RegExp(`"${index}"`));
  }
  assert.match(verifier, /VPRR_project_scope_fkey/);
  assert.match(verifier, /VPRR_assessment_scope_fkey/);
  assert.match(verifier, /VPRR_write_once/);
  assert.match(verifier, /VPRR_assessment_retention/);
  assert.match(verifier, /await assertReceiptColumns\(client\)/);
  assert.match(verifier, /await assertReceiptChecks\(client\)/);
  assert.match(verifier, /await assertReceiptIndexes\(client\)/);
  assert.match(verifier, /await assertReceiptForeignKeys\(client\)/);
});

test('Vercel runs visual progress verification after deploy and before generation', () => {
  assert.equal(
    packageJson.scripts['verify:visual-progress-migration'],
    'node scripts/verify-visual-progress-migration.mjs',
  );
  assert.match(build, /verify-visual-progress-migration\.mjs/);
  assert.match(build, /VISUAL_PROGRESS_MIGRATION_DATABASE_URL/);
  assert.match(build, /VISUAL_PROGRESS_MIGRATION_SCHEMA: "public"/);
  const migrate = build.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verifierCall = build.indexOf('[cliPaths.visualProgressVerifier]');
  const generate = build.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verifierCall > migrate && generate > verifierCall);
});
