import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifierPath = new URL('../scripts/verify-progress-measurements-migration.mjs', import.meta.url);
const [verifier, packageJson, workflow, vercelBuild] = await Promise.all([
  readFile(verifierPath, 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
]);

test('progress measurement verifier exposes safe dedicated configuration', () => {
  const help = spawnSync(process.execPath, [fileURLToPath(verifierPath), '--help'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://must-not-be-used.invalid/forbidden' },
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /PROGRESS_MEASUREMENTS_MIGRATION_DATABASE_URL/);
  assert.match(help.stdout, /DATABASE_URL is ignored/);
  assert.match(help.stdout, /local obrasaas_ci\/public/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /disposableValue === '0' \|\| disposableValue === '1'/);
  assert.match(verifier, /local && databaseName === 'obrasaas_ci' && schema === 'public'/);
});

test('progress measurement verifier checks deployed schema and Prisma checksum', () => {
  assert.match(verifier, /_prisma_migrations/);
  assert.match(verifier, /result\.rows\[0\]\.checksum === sha256\(source\)/);
  assert.match(verifier, /ProgressMeasurementUnitCode/);
  assert.match(verifier, /numeric_precision === 18 && column\?\.numeric_scale === 4/);
  assert.match(verifier, /TPMHead_project_eligibility_fkey/);
  assert.match(verifier, /TPMHead_task_identity_fkey/);
  assert.match(verifier, /t\.tgenabled/);
  assert.match(verifier, /row\.tgenabled === 'A'/);
  assert.match(verifier, /submit\?\.pronargs === 15/);
  assert.match(verifier, /review\?\.pronargs === 9/);
});

test('progress measurement verifier exercises governed lifecycle inside rollback', () => {
  for (const marker of [
    'PROGRESS_MEASUREMENT_IDEMPOTENCY_CONFLICT',
    'PROGRESS_MEASUREMENT_ACTOR_FORBIDDEN',
    'PROGRESS_MEASUREMENT_PROJECT_PENDING',
    'PROGRESS_MEASUREMENT_TASK_IDENTITY_IMMUTABLE',
    'PROGRESS_MEASUREMENT_OVER_BASELINE',
    'PROGRESS_MEASUREMENT_PERIOD_CONFLICT',
    'PROGRESS_MEASUREMENT_FUTURE_PERIOD',
    'PROGRESS_MEASUREMENT_TASK_TYPE_INVALID',
  ]) assert.match(verifier, new RegExp(marker));
  assert.match(verifier, /Rejection mutated approved balance/);
  assert.match(verifier, /Correction must replace the latest contribution/);
  assert.match(verifier, /Late submit replay leaked the live decision\/head\/balance projection/);
  assert.match(verifier, /Late review replay leaked the corrected live projection/);
  assert.match(verifier, /Governed measurement functions mutated Task\.progress/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\);[\s\S]{0,200}await assertRolledBack/);
});

test('committed concurrency is local-only and covers all structural races with exact cleanup', () => {
  assert.match(verifier, /Concurrent submit must have exactly one winner/);
  assert.match(verifier, /Concurrent exact submit created divergent measurements/);
  assert.match(verifier, /Concurrent exact review did not converge to approval/);
  assert.match(verifier, /Mutated same-key loser was not an idempotency conflict/);
  assert.match(verifier, /close-versus-submit/);
  assert.match(verifier, /task-identity-versus-submit/);
  assert.match(verifier, /structural FK fence/);
  assert.match(verifier, /DISABLE TRIGGER USER/);
  assert.match(verifier, /ENABLE ALWAYS TRIGGER/);
  assert.match(verifier, /cleanupDisposableFixture/);
  assert.match(verifier, /await assertRolledBack\(raceProbe/);
});

test('package, PostgreSQL 17 CI and Vercel rollback-only gate invoke the verifier', () => {
  const parsedPackage = JSON.parse(packageJson);
  assert.equal(
    parsedPackage.scripts['verify:progress-measurements-migration'],
    'node scripts/verify-progress-measurements-migration.mjs',
  );
  assert.match(workflow, /Verify quantitative progress measurements on PostgreSQL 17/);
  assert.match(workflow, /PROGRESS_MEASUREMENTS_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(vercelBuild, /progressMeasurementsVerifier: PROGRESS_MEASUREMENTS_VERIFIER_PATH/);
  assert.match(vercelBuild, /PROGRESS_MEASUREMENTS_DISPOSABLE_CONCURRENCY: "0"/);
  assert.match(vercelBuild, /if \(cliPaths\.progressMeasurementsVerifier\)/);
});
