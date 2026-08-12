import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [schema, migration] = await Promise.all([
  readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
  readFile(
    new URL(
      '../prisma/migrations/20260811200000_project_contract_authority_sov/migration.sql',
      import.meta.url,
    ),
    'utf8',
  ),
]);

test('S9.3 persists independent authority and immutable full-SOV ledgers', () => {
  for (const model of [
    'ProjectContractHead',
    'ProjectContractAuthorityVersion',
    'ProjectContractAuthorityDecision',
    'ProjectContractVersion',
    'ProjectContractLine',
    'ProjectContractDecision',
  ]) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.match(schema, /enum ProjectContractLineState \{\s+VALUED\s+NO_CLAIM\s+\}/);
  assert.match(schema, /contractAmountMinor\s+BigInt\?/);
  assert.match(schema, /totalContractAmountMinor\s+BigInt/);
  assert.doesNotMatch(schema, /ProjectContract(?:Version|Line)[\s\S]{0,1000}\bFloat\b/);
  assert.doesNotMatch(migration, /unitPrice|grossAmount|retentionAmount|netAmount/i);
  assert.match(migration, /ProjectContractLine_shape_check[\s\S]*?'VALUED'/);
  assert.match(migration, /ProjectContractLine_shape_check[\s\S]*?'NO_CLAIM'/);
  assert.match(migration, /PROJECT_CONTRACT_TASK_COVERAGE_INVALID/);
  assert.match(migration, /at least one task must be VALUED/);
});

test('S9.3 freezes exact money, policy and civil contract terms without implicit defaults', () => {
  assert.match(migration, /"currencyCode" IN \('ARS', 'USD'\)/);
  assert.match(migration, /"currencyMinorUnits" = 2/);
  assert.match(migration, /CERT_RETENTION_HALF_UP_V1/);
  assert.match(migration, /"adjustmentPolicyVersion" = 'NONE'/);
  assert.match(migration, /PROJECT_CONTRACT_CURRENCY_IMMUTABLE/);
  assert.match(migration, /sum\(contract_amount_minor::NUMERIC\)/);
  assert.match(migration, /9223372036854775807/);
  assert.match(migration, /"effectiveFrom" DATE NOT NULL/);
  assert.doesNotMatch(
    migration,
    /"(?:currencyCode|currencyMinorUnits|retentionBps|roundingPolicyVersion|adjustmentPolicyVersion|effectiveFrom)"[^\n]*DEFAULT/,
  );
});

test('S9.3 authority and SOV use assigned maker-checker actors and project scope', () => {
  assert.match(migration, /PROJECT_CONTRACT_AUTHORITY_BOOTSTRAP_FORBIDDEN/);
  assert.match(migration, /PROJECT_CONTRACT_AUTHORITY_ROTATION_FORBIDDEN/);
  assert.match(migration, /PROJECT_CONTRACT_AUTHORITY_REPLACEMENT_REQUIRED/);
  assert.match(migration, /current ACTIVE registrar may prepare rotation/);
  assert.match(migration, /expected certifier checker must differ from maker/);
  assert.match(migration, /exact ACTIVE finance authority must differ from preparer/);
  assert.match(migration, /tm\."tenantRole" IN \('ADMIN', 'DIRECTOR', 'FINANCE', 'AUDITOR'\)/);
  assert.match(migration, /tm\."tenantRole"::TEXT = p_tenant_role/);
  assert.match(migration, /pm\."status" = 'ACTIVE'/);
  assert.match(migration, /p\."status" <> 'ARCHIVED'/);
});

test('S9.3 binds SOV to approved authority and fences mutable source observations safely', () => {
  assert.match(migration, /ProjectContractVersion_authority_scope_fkey/);
  assert.match(migration, /d\."decision" = 'APPROVED'/);
  assert.match(migration, /pendingVersionId/);
  assert.match(migration, /PROJECT_CONTRACT_AUTHORITY_BLOCKED_BY_PENDING_CONTRACT/);
  assert.match(migration, /PROJECT_CONTRACT_BLOCKED_BY_PENDING_AUTHORITY/);
  assert.match(migration, /technicalBasisStatusAtPrepare/);
  assert.match(migration, /'UNESTABLISHED' ELSE 'MATCHED'/);
  assert.match(migration, /'MISMATCHED'/);
  assert.match(migration, /CONTRACT_TECHNICAL_BASIS_MISMATCH/);
  assert.match(migration, /p_organization_id \|\| ':' \|\| p_project_id \|\| ':' \|\| v_task_id/);
  assert.doesNotMatch(migration, /FOREIGN KEY[^;]*TaskProgressMeasurementBalance/is);
  assert.doesNotMatch(migration, /UPDATE\s+"Task"\s+SET\s+"progress"/i);
});

test('S9.3 serializes canonical task scope membership changes with first contract activation', () => {
  assert.match(migration, /CREATE TRIGGER "Task_project_contract_scope_guard"/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "Task_project_contract_scope_guard"/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF "type", "metadata" ON "Task"/);
  assert.match(migration, /PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL/);
  assert.match(migration, /TG_OP = 'UPDATE' AND v_was_canonical = v_is_canonical/);
  assert.doesNotMatch(migration, /IF NOT v_is_canonical OR v_was_canonical THEN/);
  const scopeLock = /'project-contract:scope:' \|\| [^\n]+ \|\| ':' \|\| [^\n]+/g;
  assert.ok((migration.match(scopeLock) ?? []).length >= 5,
    'task guard and contract commands must share the project advisory lock');
  assert.match(migration, /v_organization_id \|\| ':' \|\| NEW\."projectId" \|\| ':' \|\| NEW\."id"/);
  assert.match(migration, /d\."decision" = 'APPROVED'/);
});

test('S9.3 facts are append-only behind governed commands with digest, CAS and replay', () => {
  for (const trigger of [
    'ProjectContractAuthorityVersion_append_only',
    'ProjectContractAuthorityDecision_append_only',
    'ProjectContractVersion_append_only',
    'ProjectContractLine_append_only',
    'ProjectContractDecision_append_only',
    'ProjectContractHead_projection_guard',
  ]) assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  for (const command of [
    'ObrasaasProjectContractAuthorityPrepareCommand',
    'ObrasaasProjectContractAuthorityDecideCommand',
    'ObrasaasProjectContractPrepareCommand',
    'ObrasaasProjectContractDecideCommand',
  ]) assert.match(migration, new RegExp(`CREATE VIEW "${command}"`));
  assert.match(migration, /pg_catalog\.pg_trigger_depth\(\) <> 1/);
  assert.match(migration, /pg_catalog\.pg_trigger_depth\(\) <> 2/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /obrasaas_project_contract_authority_prepare_replay/);
  assert.match(migration, /obrasaas_project_contract_prepare_replay/);
  assert.match(migration, /Replay lookup is intentionally independent from the live candidate/);
  assert.match(migration, /HEAD_STALE/);
  assert.match(migration, /CANDIDATE_STALE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION "obrasaas_project_contract_prepare_worker"/);
});

test('S9.3 public candidate, decision and read paths control missing scoped targets', () => {
  assert.match(migration, /PROJECT_CONTRACT_SCOPE_INVALID: scoped contract authority target was not found/);
  assert.match(migration, /PROJECT_CONTRACT_SCOPE_INVALID: scoped contract version target was not found/);
  assert.match(migration, /PROJECT_CONTRACT_SCOPE_INVALID: active tenant-scoped project was not found/);
  assert.equal(
    (migration.match(/INTO STRICT/g) ?? []).length,
    5,
    'STRICT lookups must remain limited to four governed-command results and the internal Task project lookup',
  );
});

test('S9.3 does not create certificate, invoice, budget, adjustment or payment state', () => {
  const forbiddenWrites = /(?:INSERT INTO|UPDATE)\s+"(?:SupplierInvoice|BudgetLine|CashMovement|Payment|Certificate)/i;
  assert.doesNotMatch(migration, forbiddenWrites);
  assert.doesNotMatch(schema, /model ProjectContract(?:Certificate|Payment|Adjustment)/);
  assert.match(migration, /adjustmentPolicyVersion/);
  assert.match(migration, /'NONE'/);
});
