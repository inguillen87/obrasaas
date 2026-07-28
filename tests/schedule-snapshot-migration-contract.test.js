import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(
  new URL(
    'prisma/migrations/20260726190000_schedule_baseline_forecast_snapshots/migration.sql',
    root,
  ),
  'utf8',
);
const requestFingerprintMigration = await readFile(
  new URL(
    'prisma/migrations/20260728040000_schedule_snapshot_request_fingerprints/migration.sql',
    root,
  ),
  'utf8',
);
const verifier = await readFile(
  new URL('scripts/verify-schedule-snapshot-migration.mjs', root),
  'utf8',
);
const build = await readFile(new URL('scripts/vercel-build.mjs', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('Prisma models immutable baseline, dependency and reproducible forecast snapshots', () => {
  assert.match(schema, /enum ScheduleBaselineStatus\s*\{\s*ACTIVE\s*SUPERSEDED\s*\}/);
  assert.match(schema, /enum ScheduleCalendarPolicy\s*\{\s*CIVIL_CALENDAR_DAYS_V1\s*\}/);
  assert.match(schema, /enum ScheduleProgressSource[\s\S]*CANONICAL_TASK[\s\S]*MANUAL_OVERRIDE[\s\S]*REVIEWED_EVIDENCE/);

  const baseline = model('ScheduleBaseline');
  assert.match(baseline, /organizationId\s+String/);
  assert.match(baseline, /projectId\s+String/);
  assert.match(baseline, /operationKeyHash\s+String\s+@db\.Char\(64\)/);
  assert.match(baseline, /sourcePlanHash\s+String\s+@db\.Char\(64\)/);
  assert.match(baseline, /contentHash\s+String\s+@db\.Char\(64\)/);
  assert.match(baseline, /supersededById\s+String\?/);
  assert.match(baseline, /supersessionHash\s+String\?\s+@db\.Char\(64\)/);
  assert.match(baseline, /requestFingerprint\s+String\s+@db\.Char\(64\)/);
  assert.match(baseline, /@@unique\(\[organizationId, projectId, version\]/);
  assert.match(baseline, /@@unique\(\[organizationId, projectId, operationKeyHash\]/);

  const baselineTask = model('ScheduleBaselineTask');
  for (const field of ['plannedStart', 'plannedFinish']) {
    assert.match(baselineTask, new RegExp(`${field}\\s+DateTime\\s+@db\\.Date`));
  }
  assert.match(baselineTask, /sourceTaskRevision\s+Int/);

  const forecastRun = model('ScheduleForecastRun');
  assert.match(forecastRun, /inputHash\s+String\s+@db\.Char\(64\)/);
  assert.match(forecastRun, /resultHash\s+String\s+@db\.Char\(64\)/);
  assert.match(forecastRun, /topologicalOrder\s+Json/);
  assert.match(forecastRun, /scenarioRevision\s+Int\?/);
  assert.match(forecastRun, /scenarioInputHash\s+String\?\s+@db\.Char\(64\)/);
  assert.match(forecastRun, /requestFingerprint\s+String\s+@db\.Char\(64\)/);

  const forecastTask = model('ScheduleForecastTask');
  for (const field of [
    'actualStart',
    'actualFinish',
    'baselineStart',
    'baselineFinish',
    'forecastStart',
    'forecastFinish',
  ]) {
    assert.match(forecastTask, new RegExp(`${field}\\s+DateTime\\??\\s+@db\\.Date`));
  }
  assert.match(forecastTask, /observedTaskRevision\s+Int/);
  assert.match(forecastTask, /remainingDurationDays\s+Int\?/);
  assert.match(forecastTask, /driver\s+Json/);
  assert.match(forecastTask, /relationshipConstraints\s+Json/);
});

test('legacy ReplanScenario remains unaltered while forecast reruns retain scenario revisions', () => {
  const scenario = model('ReplanScenario');
  assert.match(scenario, /forecastRuns\s+ScheduleForecastRun\[\]/);
  assert.doesNotMatch(migration, /ALTER TABLE "ReplanScenario"/);
  assert.match(migration, /"scenarioId" TEXT,/);
  assert.match(migration, /"scenarioRevision" INTEGER,/);
  assert.match(migration, /"scenarioInputHash" CHAR\(64\),/);
  assert.match(migration, /ScheduleForecastRun_project_scenario_created_idx/);
  assert.doesNotMatch(migration, /UNIQUE INDEX "ScheduleForecastRun_project_scenario/);
  assert.match(migration, /"scenarioId" IS NULL[\s\S]*"scenarioRevision" IS NULL[\s\S]*"scenarioInputHash" IS NULL/);
});

test('baseline publication is scoped, idempotent, bounded and atomically rebaselineable', () => {
  assert.match(migration, /ScheduleBaseline_project_scope_fkey[\s\S]*\("organizationId", "projectId"\)[\s\S]*Project"\("organizationId", "id"\)/);
  assert.match(migration, /"taskCount" BETWEEN 1 AND 5000/);
  assert.match(migration, /"dependencyCount" BETWEEN 0 AND 100000/);
  assert.match(migration, /max_predecessor_edges > 100/);
  assert.match(migration, /max_successor_edges > 100/);
  assert.match(migration, /ScheduleBaseline_scope_operation_key/);
  assert.match(migration, /ScheduleBaseline_one_active_per_project_key[\s\S]*WHERE "status" = 'ACTIVE'/);
  assert.match(migration, /ScheduleBaseline_scope_superseded_by_key/);
  assert.match(migration, /ScheduleBaseline_scope_supersession_hash_key/);
  assert.match(migration, /ScheduleBaseline_superseded_by_scope_fkey[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /obrasaas_schedule_baseline_lifecycle_guard[\s\S]*ACTIVE[\s\S]*SUPERSEDED[\s\S]*to_jsonb\(OLD\)[\s\S]*to_jsonb\(NEW\)/);
  assert.match(migration, /ScheduleBaseline_supersession_integrity[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /successor_version <= NEW\."version"/);
  assert.match(migration, /successor_status <> 'ACTIVE'/);
});

test('aggregate seals are concurrency-safe and cannot be shadowed through search_path', () => {
  for (const functionName of [
    'obrasaas_schedule_baseline_child_before_seal',
    'obrasaas_schedule_baseline_seal',
    'obrasaas_schedule_forecast_child_before_seal',
    'obrasaas_schedule_forecast_seal',
    'obrasaas_schedule_baseline_lifecycle_guard',
    'obrasaas_schedule_baseline_supersession_integrity',
    'obrasaas_schedule_snapshot_append_only',
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE FUNCTION "${functionName}"\\([\\s\\S]*?SET search_path = pg_catalog`),
    );
  }
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*schedule-baseline:/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*schedule-forecast:/);
  assert.match(migration, /format\([\s\S]*%I\."ScheduleBaseline"[\s\S]*TG_TABLE_SCHEMA/);
  assert.match(migration, /format\([\s\S]*%I\."ScheduleForecastTask"[\s\S]*TG_TABLE_SCHEMA/);
  assert.doesNotMatch(migration, /\bIF (?:NOT )?FOUND\b/);
});

test('same-baseline foreign keys and seals govern complete forecast inputs and outputs', () => {
  for (const constraint of [
    'ScheduleBaselineTask_baseline_scope_fkey',
    'ScheduleBaselineTask_parent_scope_fkey',
    'ScheduleBaselineDependency_predecessor_scope_fkey',
    'ScheduleBaselineDependency_successor_scope_fkey',
    'ScheduleForecastTask_run_baseline_scope_fkey',
    'ScheduleForecastTask_baseline_task_scope_fkey',
  ]) {
    assert.match(migration, new RegExp(`"${constraint}"`));
  }
  assert.match(migration, /NEW\."observedTaskRevision" < baseline_revision/);
  assert.match(migration, /NEW\."baselineStart" <> baseline_start/);
  assert.match(migration, /partial_finish_violation_count/);
  assert.match(migration, /expected_task_count <> NEW\."taskCount"/);
  assert.match(migration, /relationship_constraint_count <> expected_dependency_count/);
  assert.match(migration, /relationship_explanation_violation_count <> 0/);
  assert.match(migration, /topology_distinct_count <> NEW\."taskCount"/);
  assert.match(migration, /topology_order_violation_count <> 0/);
  assert.match(migration, /expected_baseline_start <> NEW\."baselineStartDate"/);
  assert.match(migration, /actual_forecast_finish <> NEW\."forecastFinishDate"/);
});

test('all snapshot rows reject delete, truncate and content updates', () => {
  for (const table of [
    'ScheduleBaseline',
    'ScheduleBaselineTask',
    'ScheduleBaselineDependency',
    'ScheduleForecastRun',
    'ScheduleForecastTask',
  ]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER "${table}_append_only"[\\s\\S]*?BEFORE UPDATE OR DELETE`));
    assert.match(migration, new RegExp(`CREATE TRIGGER "${table}_no_truncate"[\\s\\S]*?BEFORE TRUNCATE`));
  }
  assert.match(migration, /ERRCODE = '55000'/);
  assert.match(migration, /ScheduleBaseline content is append-only/);
});

test('semantic verifier is dedicated, schema-bound, TLS-hardened and rollback-only', () => {
  assert.doesNotMatch(verifier, /\bconst\s+JSON\s*=/);
  assert.match(verifier, /const JSONB = Object\.freeze/);
  assert.match(verifier, /JSON\.stringify\(overrides\.driver\)/);
  assert.match(verifier, /SCHEDULE_SNAPSHOT_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /SCHEDULE_SNAPSHOT_MIGRATION_SCHEMA/);
  assert.match(verifier, /20260728040000_schedule_snapshot_request_fingerprints/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /conflicting schema parameters/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /SET LOCAL search_path/);
  assert.match(verifier, /FROM "_prisma_migrations"/);
  assert.match(verifier, /FROM information_schema\.columns/);
  assert.match(verifier, /JOIN pg_index/);
  assert.match(verifier, /FROM pg_constraint/);
  assert.match(verifier, /FROM pg_trigger/);
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /SAVEPOINT/);
  assert.match(verifier, /ROLLBACK TO SAVEPOINT/);
  assert.match(verifier, /TRUNCATE TABLE .* CASCADE/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /client\.query\(['"]COMMIT['"]\)/);
  for (const smoke of [
    'Atomic rebaseline',
    'one-active uniqueness',
    'operation idempotency',
    'cross-project scope guard',
    'cross-baseline scope guard',
    'dependency order guard',
    'exact dependency explanation guard',
    'UPDATE immutability',
    'DELETE immutability',
    'TRUNCATE immutability',
  ]) {
    assert.match(verifier, new RegExp(smoke));
  }
  assert.match(verifier, /'23503'/);
  assert.match(verifier, /'23505'/);
  assert.match(verifier, /'23514'/);
  assert.match(verifier, /'55000'/);
});

test('additive request fingerprints preserve applied migration history and fail closed for new writes', () => {
  assert.match(requestFingerprintMigration, /ALTER TABLE "ScheduleBaseline"[\s\S]*ADD COLUMN "requestFingerprint" CHAR\(64\) NOT NULL/);
  assert.match(requestFingerprintMigration, /ALTER TABLE "ScheduleForecastRun"[\s\S]*ADD COLUMN "requestFingerprint" CHAR\(64\) NOT NULL/);
  assert.match(requestFingerprintMigration, /DEFAULT repeat\('0', 64\)/);
  assert.match(requestFingerprintMigration, /ALTER COLUMN "requestFingerprint" DROP DEFAULT/g);
  assert.match(requestFingerprintMigration, /ScheduleBaseline_request_fingerprint_check/);
  assert.match(requestFingerprintMigration, /ScheduleForecastRun_request_fingerprint_check/);
  assert.doesNotMatch(requestFingerprintMigration, /UPDATE\s+"Schedule(?:Baseline|ForecastRun)"/);
});

test('Vercel gates preview and production after deploy and before generation', () => {
  assert.equal(
    packageJson.scripts['verify:schedule-snapshot-migration'],
    'node scripts/verify-schedule-snapshot-migration.mjs',
  );
  assert.match(build, /verify-schedule-snapshot-migration\.mjs/);
  assert.match(build, /SCHEDULE_SNAPSHOT_MIGRATION_DATABASE_URL/);
  assert.match(build, /SCHEDULE_SNAPSHOT_MIGRATION_SCHEMA: "public"/);
  const migrate = build.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verify = build.indexOf('[cliPaths.scheduleSnapshotVerifier]');
  const generate = build.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verify > migrate && generate > verify);
});
