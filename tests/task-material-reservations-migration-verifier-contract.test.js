import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const verifierUrl = new URL(
  '../scripts/verify-task-material-reservations-migration.mjs',
  import.meta.url,
);
const [verifier, continuousIntegration, vercelBuild] = await Promise.all([
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
]);

test('reservation verifier is dedicated, checksum-bound and rollback-only', () => {
  assert.match(verifier, /TASK_MATERIAL_RESERVATIONS_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /TASK_MATERIAL_RESERVATIONS_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /20260810150000_task_material_reservations/);
  assert.match(verifier, /createHash\('sha256'\)/);
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /await assertRollbackOnlyBehavior\(client\)/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.match(verifier, /if \(transactionOpen\) await client\.query\('ROLLBACK'\)/);
  const rollbackSmoke = verifier.slice(
    verifier.indexOf('async function assertRollbackOnlyBehavior'),
    verifier.indexOf('async function assertTwoConnectionSerialization'),
  );
  assert.doesNotMatch(rollbackSmoke, /COMMIT/);
  assert.doesNotMatch(verifier, /postgres(?:ql)?:\/\/[^'"\s]+/i);
});

test('behavioral smoke covers exact commands, tenancy, replay and lifecycle races', () => {
  for (const marker of [
    'numeric JSON Decimal allocation',
    'Canonical Decimal string did not persist exactly as 6.000',
    'cross-tenant actor denial',
    'reserve replay',
    'mutated reserve replay',
    'release replay',
    'mutated release replay',
    'second task stock overbooking',
    'stock reversal below reserved floor',
    'active reservation project closure',
    'active reservation BOM publication',
    'DONE task reserve',
    'release after task DONE',
    'historical reserve replay after release',
  ]) {
    assert.match(verifier, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(verifier, /obrasaas_task_material_reserve/);
  assert.match(verifier, /obrasaas_task_material_release/);
  assert.match(verifier, /IDEMPOTENCY_REPLAY_MUTATED reservation replay changed/);
  assert.match(verifier, /IDEMPOTENCY_REPLAY_MUTATED release replay changed/);
  assert.match(verifier, /TASK_MATERIAL_RESERVATION_ACTOR_FORBIDDEN/);
  assert.match(verifier, /TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE/);
  assert.match(verifier, /TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK/);
});

test('projection, readiness and reconciliation assertions fail closed', () => {
  assert.match(
    verifier,
    /available\.generation_expression[\s\S]*\.replaceAll\('\"', ''\)[\s\S]*\.replace\(\/\\s\+\/g, ''\)[\s\S]*\.toLowerCase\(\)[\s\S]*\.replaceAll\('operator\(pg_catalog\.-\)', '-'\)/,
  );
  assert.match(verifier, /availableExpression === 'onhand-reserved'/);
  assert.match(verifier, /availableExpression === '\(onhand-reserved\)'/);
  assert.match(verifier, /assertProjectionReconciliation/);
  assert.match(verifier, /reservation_net/);
  assert.match(verifier, /inventory_net/);
  assert.match(verifier, /availability_reserved: '6\.000'/);
  assert.match(verifier, /availability_available: '4\.000'/);
  assert.match(verifier, /inactive location readiness drift/);
  assert.match(verifier, /inactive inventory item readiness drift/);
  assert.match(
    verifier,
    /readiness_state === 'REVIEW_REQUIRED' && resultRow\?\.available === false/,
  );
  assert.match(verifier, /direct InventoryAvailability DML/);
  assert.match(verifier, /direct TaskMaterialReservationBalance DML/);
  assert.match(verifier, /direct TaskMaterialActiveReservation DML/);
  assert.match(verifier, /TRUNCATE \$\{quoteIdentifier\(table\)\} CASCADE/);
  assert.match(verifier, /SET CONSTRAINTS ALL IMMEDIATE/);
  assert.match(verifier, /SAVEPOINT task_material_reservation_verifier_case/);
});

test('two PostgreSQL connections exercise the exact shared lock namespaces', () => {
  assert.match(verifier, /assertTwoConnectionSerialization/);
  assert.match(verifier, /obrasaas-task-material-lock-verifier-a/);
  assert.match(verifier, /obrasaas-task-material-lock-verifier-b/);
  assert.match(verifier, /Promise\.all\(\[first\.connect\(\), second\.connect\(\)\]\)/);
  assert.match(verifier, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(verifier, /pg_try_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(verifier, /task-material-requirement:/);
  assert.match(verifier, /inventory-availability:/);
  assert.match(verifier, /The second connection bypassed reservation serialization/);
  assert.match(verifier, /A reservation advisory lock survived transaction rollback/);
});

test('disposable-only mode runs real TCP races with exact cleanup', () => {
  assert.match(verifier, /TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY/);
  assert.match(verifier, /local && databaseName === 'obrasaas_ci' && schema === 'public'/);
  assert.match(verifier, /assertDisposableConcurrencyRaces/);
  assert.match(verifier, /assertReserveOverbookingRace/);
  assert.match(verifier, /reserve6 versus reserve6 loser/);
  assert.match(verifier, /assertCloseVersusReserveRace/);
  assert.match(verifier, /Project_reservation_close_guard/);
  assert.match(verifier, /TaskMaterialActiveReservation_project_fkey/);
  assert.match(verifier, /assertReserveVersusReversalRace/);
  assert.match(verifier, /reserve6 versus stock reversal minus5 loser/);
  assert.match(verifier, /assertReleaseVersusReversalRace/);
  assert.match(verifier, /release versus stock reversal/);
  assert.match(verifier, /cleanupDisposableFixture/);
  assert.match(verifier, /DISABLE TRIGGER USER/);
  assert.match(verifier, /restoreTriggerModes/);
  assert.match(verifier, /Disposable concurrency fixture cleanup retained rows/);
  assert.match(verifier, /if \(disposableConcurrency\) \{[\s\S]*assertDisposableConcurrencyRaces/);
});

test('CI alone enables disposable races while Vercel forces them off', () => {
  assert.match(
    continuousIntegration,
    /Verify task material reservations on PostgreSQL 17[\s\S]*TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY: "1"[\s\S]*npm run verify:task-material-reservations-migration/,
  );
  assert.match(
    vercelBuild,
    /TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY: "0"/,
  );
  assert.doesNotMatch(vercelBuild, /TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY: "1"/);
});

test('ambient DATABASE_URL cannot authorize the verifier', () => {
  const environment = {
    ...process.env,
    DATABASE_URL: 'postgresql://ambient-user:ambient-secret@localhost/ignored',
  };
  delete environment.TASK_MATERIAL_RESERVATIONS_MIGRATION_DATABASE_URL;
  delete environment.TASK_MATERIAL_RESERVATIONS_MIGRATION_SCHEMA;
  delete environment.TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY;
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is required; DATABASE_URL is intentionally ignored/);
  assert.doesNotMatch(result.stderr, /ambient-secret/);
});

test('disposable mode refuses any database other than local obrasaas_ci/public', () => {
  const environment = {
    ...process.env,
    TASK_MATERIAL_RESERVATIONS_MIGRATION_DATABASE_URL:
      'postgresql://disposable-user:disposable-secret@127.0.0.1:5432/not_ci?schema=public',
    TASK_MATERIAL_RESERVATIONS_MIGRATION_SCHEMA: 'public',
    TASK_MATERIAL_RESERVATIONS_DISPOSABLE_CONCURRENCY: '1',
  };
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restricted to local obrasaas_ci\/public/);
  assert.doesNotMatch(result.stderr, /disposable-secret/);
});
