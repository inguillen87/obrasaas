import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(
  new URL(
    'prisma/migrations/20260728080000_ai_dispatch_plan_persistence/migration.sql',
    root,
  ),
  'utf8',
);
const ledgerForeignKeyMigration = await readFile(
  new URL(
    'prisma/migrations/20260728090000_ai_budget_ledger_fk_deferred/migration.sql',
    root,
  ),
  'utf8',
);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

function functionBlock(name) {
  const start = migration.indexOf(`CREATE FUNCTION "${name}"(`);
  assert.notEqual(start, -1, `Missing PostgreSQL helper ${name}.`);
  const end = migration.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `Unterminated PostgreSQL helper ${name}.`);
  return migration.slice(start, end + 4);
}

test('AI dispatch audit snapshot is legacy-compatible, complete and exact', () => {
  const assessment = modelBlock('VisualProgressAssessment');

  for (const [field, prismaType, databaseType] of [
    ['registryModelId', 'String?', '@db.VarChar(190)'],
    ['providerRoute', 'String?', '@db.VarChar(120)'],
    ['routePolicyVersion', 'String?', '@db.VarChar(64)'],
    ['routeReasonCode', 'String?', '@db.VarChar(64)'],
    ['pricingVersion', 'String?', '@db.VarChar(64)'],
    ['budgetCivilDayUtc', 'DateTime?', '@db.Date'],
    ['budgetWorkload', 'String?', '@db.VarChar(64)'],
    ['quotaPolicyVersion', 'String?', '@db.VarChar(64)'],
    ['budgetLimitMicros', 'BigInt?', ''],
    ['budgetReservationMicros', 'BigInt?', ''],
    ['estimateBasis', 'String?', '@db.VarChar(64)'],
    ['providerDispatchStartedAt', 'DateTime?', ''],
    ['providerRequestId', 'String?', '@db.VarChar(190)'],
    ['inputTokens', 'Int?', ''],
    ['outputTokens', 'Int?', ''],
    ['totalTokens', 'Int?', ''],
    ['cachedInputTokens', 'Int?', ''],
    ['estimatedCostMicros', 'BigInt?', ''],
    ['actualCostMicros', 'BigInt?', ''],
  ]) {
    const escapedType = prismaType.replace('?', '\\?');
    const escapedDatabaseType = databaseType.replace(/[().]/g, '\\$&');
    assert.match(
      assessment,
      new RegExp(`${field}\\s+${escapedType}${databaseType ? `\\s+${escapedDatabaseType}` : ''}`),
    );
  }

  assert.match(
    assessment,
    /@@index\(\[projectId, registryModelId, createdAt\], map: "VPA_project_registry_created_idx"\)/,
  );
  assert.match(assessment, /providerResponseId\s+String\?\s+@db.VarChar\(190\)/);
  assert.match(assessment, /providerRequestId\s+String\?\s+@db.VarChar\(190\)/);
  assert.match(migration, /CONSTRAINT "VisualProgressAssessment_dispatch_audit_check" CHECK/);
  assert.match(
    migration,
    /num_nonnulls\([\s\S]*?"registryModelId"[\s\S]*?"actualCostMicros"[\s\S]*?\) = 0/,
  );
  assert.match(migration, /"providerRoute" IS NOT NULL/);
  assert.match(migration, /"estimateBasis" IS NOT NULL/);
  assert.match(migration, /"estimatedCostMicros" IS NOT NULL/);
  assert.match(migration, /"budgetReservationMicros" <= "budgetLimitMicros"/);
  assert.match(migration, /"providerRequestId"[\s\S]*?"providerDispatchStartedAt" IS NOT NULL/);
  assert.match(migration, /"cachedInputTokens" <= "inputTokens"/);
  assert.match(
    migration,
    /"totalTokens"::BIGINT\s*= "inputTokens"::BIGINT \+ "outputTokens"::BIGINT/,
  );
  assert.match(migration, /"actualCostMicros" IS NULL OR "actualCostMicros" >= 0/);
  assert.doesNotMatch(
    migration,
    /"(?:budgetLimitMicros|budgetReservationMicros|estimatedCostMicros|actualCostMicros)"\s+(?:REAL|DOUBLE PRECISION|NUMERIC|DECIMAL)/i,
  );
});

test('unsettled governed evidence has an exact partial unique dispatch fence', () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "VPA_project_evidence_unsettled_dispatch_key"\s+ON "VisualProgressAssessment"\("projectId", "evidenceId"\)\s+WHERE "registryModelId" IS NOT NULL AND "actualCostMicros" IS NULL;/,
  );
  assert.match(
    migration,
    /new operation becomes eligible only[\s\S]*?exact settlement or an explicit zero-cost pre-dispatch release/i,
  );
});

test('daily budget aggregate admits conservatively but preserves truthful overruns', () => {
  const ledger = modelBlock('AiDailyBudgetLedger');

  assert.match(
    ledger,
    /organization\s+Organization\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(ledger, /civilDayUtc\s+DateTime\s+@db.Date/);
  assert.match(ledger, /workload\s+String\s+@db.VarChar\(64\)/);
  assert.match(ledger, /quotaPolicyVersion\s+String\s+@db.VarChar\(64\)/);
  for (const field of ['budgetLimitMicros', 'reservedMicros', 'settledMicros', 'requestCount']) {
    assert.match(ledger, new RegExp(`${field}\\s+BigInt`));
  }
  assert.match(
    ledger,
    /@@id\(\[organizationId, civilDayUtc, workload\], map: "AiDailyBudgetLedger_pkey"\)/,
  );

  assert.match(migration, /CREATE TABLE "AiDailyBudgetLedger"/);
  assert.match(migration, /CONSTRAINT "AiDailyBudgetLedger_counters_check" CHECK/);
  assert.match(migration, /"reservedMicros" >= 0/);
  assert.match(migration, /"settledMicros" >= 0/);
  assert.doesNotMatch(
    migration,
    /CONSTRAINT "AiDailyBudgetLedger_counters_check" CHECK \([\s\S]*?"settledMicros"\s*<=\s*"budgetLimitMicros"/,
  );
  assert.doesNotMatch(
    migration,
    /CONSTRAINT "AiDailyBudgetLedger_counters_check" CHECK \([\s\S]*?"reservedMicros"\s*\+\s*"settledMicros"\s*<=/,
  );
});

test('durable reservation binds admission and settlement to one assessment', () => {
  const reservation = modelBlock('AiDispatchBudgetReservation');

  assert.match(schema, /enum AiDispatchBudgetReservationStatus \{[\s\S]*?RESERVED[\s\S]*?SETTLED[\s\S]*?RELEASED/);
  assert.match(reservation, /assessmentId\s+String\s+@id/);
  assert.match(reservation, /actualMicros\s+BigInt\?/);
  assert.match(reservation, /status\s+AiDispatchBudgetReservationStatus\s+@default\(RESERVED\)/);
  assert.match(schema, /enum AiDispatchSettlementBasis \{[\s\S]*?PRE_DISPATCH_RELEASE[\s\S]*?RESPONSE_USAGE[\s\S]*?RECONCILED_USAGE[\s\S]*?PROVIDER_BILLING[\s\S]*?CONFIRMED_NO_CHARGE/);
  assert.match(reservation, /settlementBasis\s+AiDispatchSettlementBasis\?/);
  assert.match(reservation, /settlementOperationKeyHash\s+String\?\s+@db\.Char\(64\)/);
  assert.match(reservation, /settlementEvidenceSha256\s+String\?\s+@db\.Char\(64\)/);
  assert.match(reservation, /settledBy\s+PlatformUser\?[\s\S]*?onDelete: Restrict/);
  assert.match(
    reservation,
    /@@unique\(\[organizationId, settlementOperationKeyHash\], map: "AiDispatchBudgetReservation_org_settlement_operation_key"\)/,
  );
  assert.match(
    reservation,
    /dailyLedger\s+AiDailyBudgetLedger\s+@relation\([\s\S]*?onDelete: NoAction/,
  );
  assert.match(migration, /CREATE TABLE "AiDispatchBudgetReservation"/);
  assert.match(migration, /CONSTRAINT "AiDispatchBudgetReservation_state_check" CHECK/);
  assert.match(
    migration,
    /CONSTRAINT "AiDispatchBudgetReservation_daily_ledger_fkey"[\s\S]*?ON DELETE NO ACTION ON UPDATE CASCADE/,
  );
  assert.match(
    ledgerForeignKeyMigration,
    /ALTER TABLE "AiDispatchBudgetReservation"\s+ALTER CONSTRAINT "AiDispatchBudgetReservation_daily_ledger_fkey"\s+DEFERRABLE INITIALLY DEFERRED;/,
  );
  assert.doesNotMatch(ledgerForeignKeyMigration, /DROP CONSTRAINT|ON DELETE CASCADE/i);
  assert.match(
    migration,
    /CONSTRAINT "AiDispatchBudgetReservation_assessment_scope_fkey"[\s\S]*?ON DELETE CASCADE ON UPDATE CASCADE/,
  );
});

test('database helpers are assessment-keyed, idempotent and settle actual cost without a quota cap', () => {
  const reserve = functionBlock('obrasaas_ai_daily_budget_reserve');
  const settle = functionBlock('obrasaas_ai_daily_budget_settle');

  assert.match(
    reserve,
    /p_assessment_id TEXT,[\s\S]*?p_civil_day_utc DATE,[\s\S]*?p_reserve_micros BIGINT/,
  );
  assert.match(
    settle,
    /p_assessment_id TEXT,\s*p_actual_micros BIGINT,\s*p_settlement_basis "public"\."AiDispatchSettlementBasis",\s*p_settlement_operation_key_hash TEXT,\s*p_settlement_evidence_sha256 TEXT,\s*p_settled_by_id TEXT/,
  );
  assert.doesNotMatch(settle, /p_reserved_micros/);
  for (const block of [reserve, settle]) {
    assert.match(block, /RETURNS "public"\."AiDispatchBudgetReservation"/);
    assert.match(block, /pg_advisory_xact_lock\(hashtextextended\(/);
    assert.match(block, /SECURITY INVOKER[\s\S]*?SET search_path = pg_catalog/);
    assert.doesNotMatch(block, /SECURITY DEFINER/);
  }

  assert.match(reserve, /SELECT \*[\s\S]*?FROM "public"\."AiDispatchBudgetReservation"[\s\S]*?FOR UPDATE/);
  assert.match(reserve, /IF FOUND THEN[\s\S]*?RETURN existing_reservation/);
  assert.match(reserve, /CONSTRAINT = 'AiDispatchBudgetReservation_replay_mismatch'/);
  assert.match(reserve, /ON CONFLICT ON CONSTRAINT "AiDailyBudgetLedger_pkey" DO UPDATE/);
  assert.match(
    reserve,
    /ledger\."settledMicros"\s*<= ledger\."budgetLimitMicros" - p_reserve_micros/,
  );
  assert.match(
    reserve,
    /ledger\."reservedMicros"\s*<= ledger\."budgetLimitMicros" - p_reserve_micros - ledger\."settledMicros"/,
  );
  assert.match(reserve, /CONSTRAINT = 'AiDailyBudgetLedger_budget_exceeded'/);

  assert.match(settle, /CONSTRAINT = 'AiDispatchBudgetReservation_settlement_replay_mismatch'/);
  assert.match(settle, /actor\."systemRole" = 'SUPERADMIN'[\s\S]*?FOR SHARE OF actor/);
  assert.doesNotMatch(settle, /JOIN "public"\."TenantMembership"/);
  assert.match(settle, /CONSTRAINT = 'AiDispatchBudgetReservation_response_receipt_guard'/);
  assert.match(settle, /CONSTRAINT = 'AiDispatchBudgetReservation_manual_receipt_guard'/);
  assert.match(settle, /CONSTRAINT = 'AiDispatchBudgetReservation_unsupported_settlement_basis'/);
  assert.match(settle, /"settlementBasis" = p_settlement_basis/);
  assert.match(settle, /"settlementOperationKeyHash" = p_settlement_operation_key_hash/);
  assert.match(settle, /"settlementEvidenceSha256" = p_settlement_evidence_sha256/);
  assert.match(settle, /obrasaas\.ai_settlement_assessment/);
  assert.match(reserve, /operation_now := clock_timestamp\(\)/);
  assert.match(settle, /operation_now := clock_timestamp\(\)/);
  assert.match(
    settle,
    /pg_advisory_xact_lock[\s\S]*?FROM "public"\."AiDispatchBudgetReservation"[\s\S]*?FOR UPDATE[\s\S]*?AI assessment reservation no longer matches its budget snapshot/,
  );
  assert.match(
    settle,
    /"reservedMicros" = ledger\."reservedMicros"\s*- existing_reservation\."reservedMicros"/,
  );
  assert.match(settle, /"settledMicros" = ledger\."settledMicros" \+ p_actual_micros/);
  assert.match(settle, /SET "actualCostMicros" = p_actual_micros/);
  assert.doesNotMatch(
    settle,
    /"settledMicros"\s*\+\s*p_actual_micros\s*<=\s*(?:ledger\.)?"budgetLimitMicros"/,
  );
  assert.doesNotMatch(
    settle,
    /p_actual_micros\s*<=\s*(?:ledger\.)?"budgetLimitMicros"/,
  );
  assert.ok(
    settle.indexOf('UPDATE "public"."AiDispatchBudgetReservation"')
      < settle.indexOf('UPDATE "public"."VisualProgressAssessment"'),
    'Durable terminal reservation must precede the assessment cost CAS.',
  );
});

test('normalized provider result receipt is immutable, scoped and recoverable', () => {
  const receipt = modelBlock('VisualProgressProviderResultReceipt');

  assert.match(receipt, /assessmentId\s+String\s+@id/);
  assert.match(receipt, /receiptSha256\s+String\s+@db\.Char\(64\)/);
  assert.match(receipt, /inputSha256\s+String\s+@db\.Char\(64\)/);
  assert.match(receipt, /submittedSha256\s+String\s+@db\.Char\(64\)/);
  assert.match(receipt, /confidence\s+Decimal\s+@db\.Decimal\(5, 4\)/);
  assert.match(receipt, /cacheWriteTokens\s+Int\?/);
  assert.match(receipt, /appliedAt\s+DateTime\?/);
  assert.match(
    receipt,
    /@@unique\(\[organizationId, receiptSha256\], map: "VPRR_org_receipt_sha_key"\)/,
  );

  for (const constraint of [
    'VPRR_identity_check',
    'VPRR_dimensions_check',
    'VPRR_result_check',
    'VPRR_json_shape_check',
    'VPRR_usage_check',
    'VPRR_lifecycle_check',
    'VPRR_content_immutable',
    'VPRR_projection_guard',
    'VPRR_settlement_projection_guard',
    'VPRR_assessment_retention_guard',
  ]) {
    assert.match(migration, new RegExp(constraint));
  }
  assert.match(migration, /CREATE INDEX "VPRR_project_pending_received_idx"[\s\S]*?WHERE "appliedAt" IS NULL/);
  assert.match(migration, /CREATE TRIGGER "VPRR_write_once"\s+BEFORE INSERT OR UPDATE/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER "VPRR_assessment_retention"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(
    functionBlock('obrasaas_visual_progress_receipt_retention'),
    /FROM "public"\."Organization"/,
  );
});

test('ledger, reservation and governed assessment reject out-of-band persistence', () => {
  const ledgerGuard = functionBlock('obrasaas_ai_budget_ledger_write_guard');
  const reservationGuard = functionBlock('obrasaas_ai_budget_reservation_write_once');
  const assessmentGuard = functionBlock('obrasaas_ai_assessment_budget_reservation_required');

  assert.match(migration, /CREATE TRIGGER "AiDailyBudgetLedger_write_guard"\s+BEFORE INSERT OR UPDATE/);
  assert.match(ledgerGuard, /AiDailyBudgetLedger_transition_guard/);
  assert.match(ledgerGuard, /old\."reservedMicros"::NUMERIC \+ marker_reserved_delta/i);
  assert.match(ledgerGuard, /old\."settledMicros"::NUMERIC \+ marker_settled_delta/i);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER "AiDailyBudgetLedger_organization_retention"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /AiDailyBudgetLedger_organization_retention_guard/);

  assert.match(migration, /CREATE TRIGGER "AiDispatchBudgetReservation_write_once"\s+BEFORE INSERT OR UPDATE/);
  assert.match(reservationGuard, /AiDispatchBudgetReservation_insert_guard/);
  assert.match(reservationGuard, /AiDispatchBudgetReservation_transition_guard/);
  assert.match(reservationGuard, /obrasaas\.ai_settlement_assessment/);
  assert.match(
    functionBlock('obrasaas_ai_budget_reservation_retention'),
    /FROM "public"\."Organization"/,
  );

  assert.match(
    migration,
    /CREATE CONSTRAINT TRIGGER "VisualProgressAssessment_budget_reservation_required"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/,
  );
  assert.match(assessmentGuard, /AiDispatchBudgetReservation/);
  assert.match(assessmentGuard, /AiDailyBudgetLedger/);
  assert.match(assessmentGuard, /VisualProgressAssessment_budget_reservation_required/);
});

test('dispatch audit evidence is write-once and actual cost requires terminal settlement', () => {
  const audit = functionBlock('obrasaas_ai_dispatch_audit_write_once');
  assert.match(
    migration,
    /CREATE TRIGGER "VisualProgressAssessment_ai_dispatch_write_once"\s+BEFORE INSERT OR UPDATE ON "VisualProgressAssessment"/,
  );
  assert.match(audit, /SECURITY INVOKER[\s\S]*?SET search_path = pg_catalog/);
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
    assert.match(audit, new RegExp(invariantName));
  }
  assert.match(
    audit,
    /FROM "public"\."AiDispatchBudgetReservation"[\s\S]*?"actualMicros" IS NOT DISTINCT FROM NEW\."actualCostMicros"[\s\S]*?"status" IN \('SETTLED', 'RELEASED'\)/,
  );
  assert.match(audit, /current_setting\('obrasaas\.ai_settlement_assessment', true\)/);
  assert.match(
    audit,
    /NEW\."providerDispatchStartedAt" IS NOT NULL[\s\S]*?"status" = 'RESERVED'[\s\S]*?"reservedMicros" IS NOT DISTINCT FROM NEW\."budgetReservationMicros"[\s\S]*?FOR KEY SHARE[\s\S]*?AiDispatchAudit_dispatch_reservation_required/,
  );
});
