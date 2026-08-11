import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifierUrl = new URL('../scripts/verify-progress-measurement-cuts-migration.mjs', import.meta.url);
const [verifier, packageJson, workflow, vercelBuild] = await Promise.all([
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
]);

test('S9.2 verifier requires a dedicated PostgreSQL target and local-only disposable mode', () => {
  const help = spawnSync(process.execPath, [fileURLToPath(verifierUrl), '--help'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://must-not-be-used.invalid/forbidden' },
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /PROGRESS_MEASUREMENT_CUTS_MIGRATION_DATABASE_URL/);
  assert.match(help.stdout, /DATABASE_URL is ignored/);
  assert.match(help.stdout, /local obrasaas_ci\/public/);
  assert.match(verifier, /sslmode", "verify-full"/);
  assert.match(verifier, /disposableValue === "0" \|\| disposableValue === "1"/);
  assert.match(verifier, /local && databaseName === "obrasaas_ci" && schema === "public"/);
});

test('S9.2 verifier checks the deployed ledger, structures, functions and ALWAYS guards', () => {
  assert.match(verifier, /_prisma_migrations/);
  assert.match(verifier, /result\.rows\[0\]\.checksum === sha256\(source\)/);
  assert.match(verifier, /ProjectProgressMeasurementCutHead/);
  assert.match(verifier, /ProjectProgressMeasurementCutLine/);
  assert.match(verifier, /obrasaas_progress_measurement_cut_build_candidate/);
  assert.match(verifier, /obrasaas_progress_measurement_cut_read/);
  assert.match(verifier, /obrasaas_progress_measurement_cut_seal/);
  assert.match(verifier, /row\.tgenabled === "A"/);
  assert.match(verifier, /commandTrigger\.rows\[0\]\.relkind === "v"/);
  assert.match(verifier, /commandTrigger\.rows\[0\]\.tgenabled === "O"/);
  assert.match(verifier, /p_expected_candidate_sha256 text/);
  assert.match(verifier, /unnest\(con\.conkey\) WITH ORDINALITY/);
  assert.match(verifier, /unnest\(con\.confkey\) WITH ORDINALITY/);
  assert.equal((verifier.match(/\)::TEXT\[\] AS (?:local|referenced)_columns/g) ?? []).length, 2);
  assert.match(verifier, /decisionScope\.local_columns/);
  assert.match(verifier, /decisionScope\.referenced_columns/);
  assert.doesNotMatch(verifier, /\.definition\.includes\('\"decision\"'\)/);
});

test('S9.2 verifier exercises immutable receipts, missing lines and anti-forgery inside rollback', () => {
  assert.match(verifier, /Candidate must include every canonical task/);
  assert.match(verifier, /MEASURED/);
  assert.match(verifier, /MISSING/);
  assert.match(verifier, /Candidate hash depends on TimeZone\/DateStyle/);
  assert.match(verifier, /Late replay leaked the live head\/candidate projection/);
  assert.match(verifier, /Correction rewrote historical cut lines/);
  assert.match(verifier, /Cut mutated Task\.progress/);
  assert.match(verifier, /Technical seal created financial state/);
  assert.match(verifier, /set_config\('obrasaas\.progress_measurement_cut_write_scope'/);
  assert.match(verifier, /direct progress measurement cut ledger writes are forbidden/);
  assert.match(verifier, /direct progress measurement cut projection writes are forbidden/);
  assert.match(verifier, /seal worker requires the governed command trigger/);
  assert.match(verifier, /ObrasaasProgressMeasurementCutSealCommand/);
  assert.match(verifier, /session_replication_role = 'replica'/);
  assert.match(verifier, /Replica mode skipped the command trigger but still mutated Cut\/Line\/Head/);
  assert.match(verifier, /await client\.query\("ROLLBACK"\)/);
  assert.match(verifier, /await assertRolledBack/);
  assert.doesNotMatch(verifier, /DISABLE TRIGGER USER/);
  assert.match(
    verifier,
    /await client\.query\("COMMIT"\);[\s\S]{0,800}tgenabled[\s\S]{0,400}row\.tgenabled === "A"/,
  );
});

test('S9.2 wiring runs committed races only in CI and rollback-only verification in Vercel', () => {
  const parsedPackage = JSON.parse(packageJson);
  assert.equal(
    parsedPackage.scripts['verify:progress-measurement-cuts-migration'],
    'node scripts/verify-progress-measurement-cuts-migration.mjs',
  );
  assert.match(workflow, /Verify fortnight progress measurement cuts on PostgreSQL 17/);
  assert.match(workflow, /PROGRESS_MEASUREMENT_CUTS_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(workflow, /npm run verify:progress-measurement-cuts-migration/);
  assert.match(vercelBuild, /PROGRESS_MEASUREMENT_CUTS_VERIFIER_PATH/);
  assert.match(vercelBuild, /progressMeasurementCutsVerifier: PROGRESS_MEASUREMENT_CUTS_VERIFIER_PATH/);
  assert.match(vercelBuild, /PROGRESS_MEASUREMENT_CUTS_DISPOSABLE_CONCURRENCY: "0"/);
  assert.doesNotMatch(vercelBuild, /PROGRESS_MEASUREMENT_CUTS_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(vercelBuild, /if \(cliPaths\.progressMeasurementCutsVerifier\)/);
});

test('S9.2 correction race releases the S9.1 head lock before awaiting the seal', () => {
  const block = verifier.match(
    /async function assertDisposableCorrectionOrdering[\s\S]*?\n}\n\nasync function runDisposableArchive/,
  )?.[0] ?? '';
  const started = block.indexOf('const sealOutcomePromise = sealClient.query');
  const observed = block.indexOf('wait_event_type === "Lock"');
  const committed = block.indexOf('await correction.query("COMMIT")');
  const awaited = block.indexOf('await sealOutcomePromise');
  assert.ok(
    started >= 0 && started < observed && observed < committed && committed < awaited,
    'correction-vs-seal must observe the lock, commit correction, then await seal',
  );
  assert.doesNotMatch(block, /await runDisposableSeal/);
});
