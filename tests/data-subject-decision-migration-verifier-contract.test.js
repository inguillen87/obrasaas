import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const verifierUrl = new URL('../scripts/verify-data-subject-decision-migration.mjs', import.meta.url);
const [verifier, packageJson, ci, vercel] = await Promise.all([
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
]);

test('verifier is dedicated, PostgreSQL-17, checksum-bound and rollback-only by default', () => {
  assert.match(verifier, /DATA_SUBJECT_DECISION_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /DATA_SUBJECT_DECISION_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /server_version_num/);
  assert.match(verifier, />= 170000/);
  assert.match(verifier, /20260811160000_data_subject_decision_control_plane/);
  assert.match(verifier, /createHash\('sha256'\)/);
  const rollback = verifier.slice(
    verifier.indexOf('async function assertRollbackOnlyBehavior'),
    verifier.indexOf('async function cleanupDisposableFixture'),
  );
  assert.match(rollback, /await client\.query\('BEGIN'\)/);
  assert.match(rollback, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(rollback, /COMMIT/);
});

test('catalog and smoke cover no-store, RBAC, replay, chain one and immutable controls', () => {
  for (const marker of [
    'Verification response leaked evidence or key identifiers',
    'SELF verification sequence one failed',
    'replay after actor disable',
    'cross-tenant replay',
    'legal assessment sequence one failed',
    'terminalStatus',
    'one review-required record plus eight coverage blockers',
    'hold CREATED sequence one failed',
    'decision exact replay failed',
    'maker-checker same administrator',
    'direct terminal evidence update',
    'direct PRO-05B TRUNCATE CASCADE',
    'transient DRAFTING commit guard',
  ]) assert.match(verifier, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verifier, /tgenabled === 'A'/);
  assert.match(verifier, /tgdeferrable && row\.tginitdeferred/);
  assert.match(verifier, /data_type IN \('json', 'jsonb', 'bytea'\)/);
  assert.match(verifier, /Every PRO-05B foreign key must use ON DELETE RESTRICT/);
});

test('catalog accepts PostgreSQL deparsing BETWEEN without weakening the ordinal bound', () => {
  assert.match(verifier, /ordinal between 0 and 1023/);
  assert.match(verifier, /ordinal >= 0 and ordinal <= 1023/);
  assert.doesNotMatch(
    verifier,
    /checkMap\.get\('DataSubjectDecisionItem_ordinal_check'\)\?\.includes\('between 0 and 1023'\)/,
  );
});

test('TRUNCATE behavior flushes deferred events before testing the governed trigger', () => {
  const truncateProbe = verifier.indexOf(
    `client.query('TRUNCATE "DataSubjectRequesterVerificationEvent" CASCADE')`,
  );
  const constraintFlush = verifier.lastIndexOf(
    `await client.query('SET CONSTRAINTS ALL IMMEDIATE')`,
    truncateProbe,
  );
  assert.ok(truncateProbe > 0);
  assert.ok(constraintFlush > 0 && constraintFlush < truncateProbe);
  assert.match(
    verifier.slice(constraintFlush, truncateProbe + 100),
    /SET CONSTRAINTS ALL DEFERRED/,
  );
});

test('disposable mode is local-only and proves approval waits for hold, revocation and actor disable', () => {
  assert.match(verifier, /DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY/);
  assert.match(verifier, /local && databaseName === 'obrasaas_ci' && schema === 'public'/);
  assert.match(verifier, /assertApprovalWaitsForRevocation/);
  assert.match(verifier, /assertApprovalWaitsForHoldRevision/);
  assert.match(verifier, /assertDirectApprovalWaitsForActorDisable/);
  assert.match(verifier, /wait_event_type === 'Lock'/);
  assert.match(verifier, /approval versus revocation did not fail stale after waiting/);
  assert.match(verifier, /approval versus hold review did not fail stale after waiting/);
  assert.match(verifier, /direct approval did not fail closed after the checker membership was disabled/);
  assert.match(verifier, /failed direct approval changed the pending decision/);
  assert.match(verifier, /cleanupDisposableFixture/);
  assert.match(verifier, /Disposable concurrency fixture cleanup retained rows/);
});

test('package, CI and Vercel wire the fail-closed gate with races disabled off CI', () => {
  assert.match(packageJson, /"verify:data-subject-decision-migration":\s*"node scripts\/verify-data-subject-decision-migration\.mjs"/);
  assert.match(
    ci,
    /Verify data subject decision control plane on PostgreSQL 17[\s\S]*DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY: "1"[\s\S]*npm run verify:data-subject-decision-migration/,
  );
  assert.match(vercel, /DATA_SUBJECT_DECISION_VERIFIER_PATH/);
  assert.match(vercel, /DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY: "0"/);
  assert.doesNotMatch(vercel, /DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY: "1"/);
});

test('ambient DATABASE_URL cannot authorize the verifier', () => {
  const environment = { ...process.env, DATABASE_URL: 'postgresql://ambient:secret@localhost/ignored' };
  delete environment.DATA_SUBJECT_DECISION_MIGRATION_DATABASE_URL;
  delete environment.DATA_SUBJECT_DECISION_MIGRATION_SCHEMA;
  delete environment.DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY;
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is required; DATABASE_URL is intentionally ignored/);
  assert.doesNotMatch(result.stderr, /ambient:secret/);
});

test('disposable mode refuses any database other than local obrasaas_ci/public', () => {
  const environment = {
    ...process.env,
    DATA_SUBJECT_DECISION_MIGRATION_DATABASE_URL:
      'postgresql://disposable:secret@127.0.0.1:5432/not_ci?schema=public',
    DATA_SUBJECT_DECISION_MIGRATION_SCHEMA: 'public',
    DATA_SUBJECT_DECISION_DISPOSABLE_CONCURRENCY: '1',
  };
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restricted to local obrasaas_ci\/public/);
  assert.doesNotMatch(result.stderr, /disposable:secret/);
});
