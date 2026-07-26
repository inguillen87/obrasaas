import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
const build = await readFile(new URL('scripts/vercel-build.mjs', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

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
  assert.match(verifier, /obrasaas-visual-progress-migration-verifier/);
  assert.doesNotMatch(verifier, /console\.(?:log|error)\([^\n]*connectionString/);
});

test('visual progress verifier catalogs the applied migration, exact enums and critical columns', () => {
  assert.match(verifier, /20260726143000_visual_progress_assessments/);
  assert.match(verifier, /FROM "_prisma_migrations"/);
  assert.match(verifier, /JOIN pg_enum/);
  assert.match(verifier, /FROM information_schema\.columns/);
  assert.match(verifier, /dataType: 'integer', udtName: 'int4', numericPrecision: 32, numericScale: 0/);
  assert.match(verifier, /VisualProgressAssessmentStatus:[\s\S]*PENDING[\s\S]*RUNNING[\s\S]*COMPLETED[\s\S]*ABSTAINED[\s\S]*FAILED/);
  assert.match(verifier, /VisualProgressAssessmentReviewStatus:[\s\S]*PENDING[\s\S]*APPROVED[\s\S]*CORRECTED[\s\S]*REJECTED/);

  for (const column of [
    'operationKeyHash',
    'requestFingerprint',
    'providerModel',
    'inputSha256',
    'baselineHash',
    'leaseExpiresAt',
    'attemptCount',
    'confidence',
    'reviewStatus',
    'correctedProgressMin',
    'correctedProgressMax',
    'revision',
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
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
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
  assert.match(verifier, /status[\s\S]*PENDING[\s\S]*RUNNING[\s\S]*OR[\s\S]*COMPLETED[\s\S]*ABSTAINED[\s\S]*AND[\s\S]*reviewStatus[\s\S]*PENDING/);

  for (const index of [
    'VisualProgressAssessment_project_operation_key',
    'VPA_project_evidence_open_key',
    'VisualProgressAssessment_project_fingerprint_idx',
    'VPA_project_status_lease_idx',
    'VPA_project_task_status_created_idx',
    'VPA_project_evidence_created_idx',
    'VPA_project_review_created_idx',
    'VPA_requester_created_idx',
    'VPA_reviewer_reviewed_idx',
  ]) {
    assert.match(verifier, new RegExp(`${index}:`));
    assert.match(migration, new RegExp(`"${index}"`));
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
  assert.match(verifier, /return value == null \? null : JSON\.stringify\(value\)/);
  assert.match(verifier, /"correctedProgressMax", "createdAt", "updatedAt"/);
  assert.match(verifier, /\$34, \$35, \$35/);
  assert.match(verifier, /overrides\.updatedAt \?\? overrides\.completedAt \?\? new Date\(\)/);
  assert.match(verifier, /'23514'/);
  assert.match(verifier, /'23503'/);
  assert.match(verifier, /'23505'/);
  assert.match(verifier, /@invalid\.example/);
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
