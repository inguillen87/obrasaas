import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifierUrl = new URL('../scripts/verify-project-certificates-migration.mjs', import.meta.url);
const { configuration } = await import(verifierUrl);
const [verifier, packageJson, workflow, vercelBuild, migration] = await Promise.all([
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
  readFile(new URL(
    '../prisma/migrations/20260812120000_project_certificates_s10_cert/migration.sql',
    import.meta.url,
  ), 'utf8'),
]);

test('S10 verifier requires a dedicated PostgreSQL target and local-only disposable mode', () => {
  const help = spawnSync(process.execPath, [fileURLToPath(verifierUrl), '--help'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://must-not-be-used.invalid/forbidden' },
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /PROJECT_CERTIFICATES_MIGRATION_DATABASE_URL/);
  assert.match(help.stdout, /DATABASE_URL is ignored/);
  assert.match(help.stdout, /local obrasaas_ci\/public/);
  const neon = configuration({
    PROJECT_CERTIFICATES_MIGRATION_DATABASE_URL: 'postgresql://user:secret@ep-example.neon.tech/app?schema=public',
    PROJECT_CERTIFICATES_MIGRATION_SCHEMA: 'public',
    PROJECT_CERTIFICATES_DISPOSABLE_CONCURRENCY: '0',
  });
  assert.equal(new URL(neon.connectionString).searchParams.get('sslmode'), 'verify-full');
  assert.equal(new URL(neon.connectionString).searchParams.has('schema'), false);
  assert.throws(() => configuration({
    PROJECT_CERTIFICATES_MIGRATION_DATABASE_URL: 'postgresql://user:secret@database.example.com/app',
    PROJECT_CERTIFICATES_MIGRATION_SCHEMA: 'public',
  }), /Remote verification requires sslmode=verify-full/);
});

test('S10 verifier checks exact structure, guards, private workers and rollback ABI journey', () => {
  for (const marker of [
    '_prisma_migrations',
    'ProjectCertificateBook',
    'ProjectCertificatePeriodHead',
    'ProjectCertificateVersion',
    'ProjectCertificateLine',
    'ProjectCertificateDeduction',
    'ProjectCertificateDecision',
    'ProjectCertificateOperationReceipt',
    'Task_project_contract_scope_guard',
    'ProjectContractHead_certificate_pointer_fence',
    'Project_project_certificate_archive_guard',
    'TenantMembership_project_certificate_closer_guard',
    'ProjectMembership_project_certificate_closer_delete_guard',
    'obrasaas_project_certificate_read',
    'obrasaas_project_certificate_prepare_worker',
    'obrasaas_project_certificate_decide_worker',
    'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID',
    'REJECT -> reprepare -> APPROVE',
    'NEXT_PERIOD',
    'CORRECTION',
  ]) assert.match(verifier, new RegExp(marker));
  assert.match(verifier, /workers\.every\(\(row\) => row\.public_execute === false\)/);
  assert.match(verifier, /readProjectCertificateSnapshot/);
  assert.match(verifier, /prepareProjectCertificate/);
  assert.match(verifier, /decideProjectCertificate/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.match(migration, /CREATE FUNCTION "obrasaas_project_certificate_prepare"/);
  assert.match(migration, /CREATE FUNCTION "obrasaas_project_certificate_decide"/);
});

test('S10 disposable verifier cannot regress to placeholder races or partial governance', () => {
  for (const helper of [
    'assertDisposableGovernance',
    'assertDisposablePrepareRaces',
    'assertDisposableTwoDecisions',
    'assertDisposableCrossKindKey',
    'assertDisposableApproveVsCutCorrection',
    'assertDisposableApproveVsContractRotation',
    'assertDisposableCorrectionVsNext',
    'assertDisposableActorRevokeVsApprove',
    'assertDisposableCloserRevocations',
    'assertDisposableArchiveVsPending',
  ]) {
    assert.match(verifier, new RegExp(`async function ${helper}\\(`));
    assert.match(verifier, new RegExp(`await ${helper}\\(connectionString, schema\\)`));
  }
  assert.doesNotMatch(verifier, /approveVsCutCorrection\s*:\s*false/);
  assert.doesNotMatch(verifier, /approveVsContractRotation\s*:\s*false/);
  assert.doesNotMatch(verifier, /correctionVsNext\s*:\s*false/);
  assert.doesNotMatch(verifier, /race manifest incomplete:[\s\S]*placeholder/i);

  assert.match(verifier, /for \(const replicationRole of \['origin', 'replica'\]\)/);
  assert.match(verifier, /for \(const table of TABLES\)/);
  for (const operation of ['INSERT INTO', 'UPDATE', 'DELETE FROM', 'TRUNCATE TABLE']) {
    assert.match(verifier, new RegExp(operation));
  }
  assert.match(verifier, /TRUNCATE TABLE \$\{quotedTable\} CASCADE/);
  assert.match(verifier, /ObrasaasProjectCertificatePrepareCommand/);
  assert.match(verifier, /ObrasaasProjectCertificateDecideCommand/);
  assert.match(verifier, /session_replication_role='origin'/);
  assert.match(verifier, /Replica command views\/wrappers mutated S10 facts or receipts/);
  assert.match(verifier, /terminalPayload\.receipt\.operationKind === terminalDecision/);
  assert.match(verifier, /ProjectCertificateDeduction[\s\S]*TaskProgressMeasurementBalance/);
  assert.match(
    verifier,
    /UPDATE "ProjectCertificateBook"[\s\S]*SET "latestApprovedPeriodStart"=NULL,[\s\S]*"latestApprovedCertificateVersionId"=NULL,[\s\S]*"pendingCertificateVersionId"=NULL/,
  );
  assert.match(verifier, /restoredMap\.get\(entry\) === 'A'/);
  assert.match(verifier, /Object\.values\(manifest\)\.every\(Boolean\)/);

  assert.match(migration, /CREATE FUNCTION "obrasaas_project_certificate_approval_is_fresh"/);
  assert.match(migration, /v_approval_fresh := "obrasaas_project_certificate_approval_is_fresh"/);
  assert.match(migration, /p_decision = 'APPROVE' AND NOT "obrasaas_project_certificate_approval_is_fresh"/);
});

test('package, PostgreSQL 17 CI and Vercel rollback-only gate invoke S10 verifier', () => {
  const parsedPackage = JSON.parse(packageJson);
  assert.equal(
    parsedPackage.scripts['verify:project-certificates-migration'],
    'node scripts/verify-project-certificates-migration.mjs',
  );
  assert.match(workflow, /Verify project certificates on PostgreSQL 17/);
  assert.match(workflow, /PROJECT_CERTIFICATES_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(vercelBuild, /PROJECT_CERTIFICATES_VERIFIER_PATH/);
  assert.match(vercelBuild, /projectCertificatesVerifier: PROJECT_CERTIFICATES_VERIFIER_PATH/);
  assert.match(vercelBuild, /PROJECT_CERTIFICATES_DISPOSABLE_CONCURRENCY: "0"/);
  assert.doesNotMatch(vercelBuild, /PROJECT_CERTIFICATES_DISPOSABLE_CONCURRENCY: "1"/);
  assert.match(vercelBuild, /if \(cliPaths\.projectCertificatesVerifier\)/);
});
