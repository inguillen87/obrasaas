import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifierUrl = new URL('../scripts/verify-project-contract-migration.mjs', import.meta.url);
const [verifier, packageJson, workflow, vercelBuild, migration] = await Promise.all([
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
  readFile(new URL(
    '../prisma/migrations/20260811200000_project_contract_authority_sov/migration.sql',
    import.meta.url,
  ), 'utf8'),
]);

test('S9.3 verifier requires a dedicated PostgreSQL target and local-only disposable mode', () => {
  const help = spawnSync(process.execPath, [fileURLToPath(verifierUrl), '--help'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://must-not-be-used.invalid/forbidden' },
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /PROJECT_CONTRACT_MIGRATION_DATABASE_URL/);
  assert.match(help.stdout, /DATABASE_URL is ignored/);
  assert.match(help.stdout, /local obrasaas_ci\/public/);
  assert.match(verifier, /sslmode.*verify-full/);
  assert.match(verifier, /disposableValue === '0' \|\| disposableValue === '1'/);
  assert.match(verifier, /local && databaseName === 'obrasaas_ci' && schema === 'public'/);
});

test('S9.3 verifier checks the deployed checksum, governed surface and exact money', () => {
  assert.match(verifier, /_prisma_migrations/);
  assert.match(verifier, /checksum === sha256\(await readFile\(migrationPath, 'utf8'\)\)/);
  for (const marker of [
    'ProjectContractHead',
    'ProjectContractAuthorityVersion',
    'ProjectContractAuthorityDecision',
    'ProjectContractVersion',
    'ProjectContractLine',
    'ProjectContractDecision',
    'obrasaas_project_contract_authority_candidate',
    'obrasaas_project_contract_authority_prepare_replay',
    'obrasaas_project_contract_sov_candidate',
    'obrasaas_project_contract_prepare_replay',
    'obrasaas_project_contract_read',
  ]) assert.match(verifier, new RegExp(marker));
  assert.match(verifier, /total_contract_amount_minor.*'123456'/s);
  assert.match(verifier, /9223372036854770000/);
  assert.match(verifier, /workers\.every\(\(row\) => row\.public_execute === false\)/);
  assert.match(verifier, /row\.tgenabled === 'A'/);
});

test('S9.3 verifier covers rollback, immutable replay, role denial and committed races', () => {
  assert.match(verifier, /Authority replay did not return the immutable receipt/);
  assert.match(verifier, /SOV replay did not return the immutable receipt/);
  assert.match(verifier, /Replay-first authority helper lost an approved immutable receipt/);
  assert.match(verifier, /Replay-first SOV helper lost its receipt after the canonical task set changed/);
  assert.match(verifier, /Replay-first helpers lost historical receipts after authority rotation/);
  assert.match(verifier, /PROJECT_CONTRACT_AUTHORITY_IDEMPOTENCY_CONFLICT/);
  assert.match(verifier, /PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT/);
  assert.match(verifier, /PROJECT_CONTRACT_READ_FORBIDDEN/);
  assert.match(verifier, /read_missing_scoped_project/);
  assert.match(verifier, /candidate_missing_head/);
  assert.match(verifier, /authority_decision_missing_pending_target/);
  assert.match(verifier, /contract_decision_missing_pending_target/);
  assert.match(verifier, /PROJECT_CONTRACT_SCOPE_INVALID/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.match(verifier, /Concurrent exact authority replay created divergent versions/);
  assert.match(verifier, /Concurrent exact SOV replay created divergent versions/);
  assert.match(verifier, /Concurrent finance decisions did not select exactly one winner/);
  assert.match(verifier, /PROJECT_CONTRACT_TASK_SCOPE_CHANGE_REQUIRES_CHANGE_CONTROL/);
  assert.match(verifier, /canonical_task_demotion_after_approval/);
  assert.match(verifier, /Approved full-SOV canonical task scope changed despite its change-control fence/);
  assert.match(verifier, /assertDisposableTaskScopeActivationRace\(connectionString, schema, 'insert'\)/);
  assert.match(verifier, /assertDisposableTaskScopeActivationRace\(connectionString, schema, 'demote'\)/);
  assert.match(verifier, /Contract activation versus canonical task \$\{mutationKind\} did not select exactly one winner/);
  assert.match(verifier, /did not linearize around the shared scope lock/);
  assert.match(verifier, /PROJECT_CONTRACT_HEAD_STALE/);
});

test('S9.3 disposable cleanup is exact and restores every named trigger', () => {
  assert.doesNotMatch(verifier, /DISABLE TRIGGER USER/);
  assert.doesNotMatch(verifier, /session_replication_role = replica/);
  assert.match(verifier, /ProjectContractHead_projection_guard/);
  assert.match(verifier, /ProjectContractLine_no_truncate/);
  assert.match(verifier, /Task_project_contract_scope_guard/);
  assert.match(verifier, /DISABLE TRIGGER \$\{quoteIdentifier\(triggerName\)\}/);
  assert.match(verifier, /ENABLE ALWAYS TRIGGER \$\{quoteIdentifier\(triggerName\)\}/);
  assert.match(verifier, /Disposable cleanup did not restore every S9\.3 trigger as ENABLE ALWAYS/);
  assert.match(verifier, /Object\.values\(residue\.rows\[0\]\)\.every/);
});

test('S9.3 read is single-source, bounded and DB-derives catalog and capabilities', () => {
  assert.equal(
    (migration.match(/CREATE(?: OR REPLACE)? FUNCTION "obrasaas_project_contract_read"/g) ?? []).length,
    1,
  );
  assert.match(migration, /'historyLimit', 20/);
  assert.match(migration, /'authorityHistory'/);
  assert.match(migration, /'contractHistory'/);
  assert.match(migration, /'canonicalTasks'/);
  assert.match(migration, /'capabilities'/);
  assert.match(migration, /'proposeAuthority'/);
  assert.match(migration, /'decideContract'/);
  assert.match(migration, /'reasonCode'/);
  assert.match(migration, /LIMIT 20/);
});

test('package, PostgreSQL 17 CI and Vercel rollback-only gate invoke S9.3 verifier', () => {
  const parsedPackage = JSON.parse(packageJson);
  assert.equal(
    parsedPackage.scripts['verify:project-contract-migration'],
    'node scripts/verify-project-contract-migration.mjs',
  );
  assert.match(workflow, /Verify project contract authority and SOV on PostgreSQL 17/);
  assert.match(workflow, /PROJECT_CONTRACT_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(vercelBuild, /PROJECT_CONTRACT_VERIFIER_PATH/);
  assert.match(vercelBuild, /projectContractVerifier: PROJECT_CONTRACT_VERIFIER_PATH/);
  assert.match(vercelBuild, /PROJECT_CONTRACT_DISPOSABLE_CONCURRENCY: "0"/);
  assert.doesNotMatch(vercelBuild, /PROJECT_CONTRACT_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(vercelBuild, /if \(cliPaths\.projectContractVerifier\)/);
});
