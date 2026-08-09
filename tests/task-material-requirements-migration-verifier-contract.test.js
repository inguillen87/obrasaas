import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [verifier, packageJson, vercelBuild, continuousIntegration] = await Promise.all([
  readFile(
    new URL('../scripts/verify-task-material-requirements-migration.mjs', import.meta.url),
    'utf8',
  ),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
]);

test('task material requirement verifier is dedicated, checksum-bound and rollback-only', () => {
  assert.match(verifier, /TASK_MATERIAL_REQUIREMENTS_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /TASK_MATERIAL_REQUIREMENTS_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /20260802180000_task_material_requirements/);
  assert.match(verifier, /20260809090000_task_material_requirement_eligibility_not_null/);
  assert.match(verifier, /migration_name" = ANY\(\$1::text\[\]\)/);
  assert.match(verifier, /MIGRATIONS\.join\(', '\)/);
  assert.doesNotMatch(verifier, /\bMIGRATION\b/);
  assert.match(verifier, /applied more than once/);
  assert.match(verifier, /is not applied/);
  assert.match(verifier, /createHash\('sha256'\)/);
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /await assertRollbackOnlySmoke\(client\)/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /await client\.query\('COMMIT'\)/);
});

test('task material requirement verifier covers schema and behavioral guardrails', () => {
  for (const assertion of [
    'assertMigration',
    'assertEnum',
    'assertColumns',
    'assertIndexes',
    'assertConstraints',
    'assertTriggers',
    'assertTriggerFunctions',
  ]) {
    assert.match(verifier, new RegExp(`await ${assertion}\\(client\\)`));
  }
  assert.match(verifier, /ENABLE ALWAYS/);
  assert.match(verifier, /initially_deferred/);
  assert.match(verifier, /incomplete material bundle/);
  assert.match(verifier, /branched requirement revision/);
  assert.match(verifier, /requirement revision mutation/);
  assert.match(verifier, /canonical task type mutation/);
  assert.match(verifier, /canonical task identity mutation/);
  assert.match(verifier, /datetimePrecision: 3/);
  assert.match(verifier, /column_default/);
  assert.match(verifier, /is_generated, generation_expression/);
  assert.match(verifier, /materialRequirementEligible/);
  assert.match(verifier, /generated: 'ALWAYS'/);
  assert.match(verifier, /Task_material_requirement_identity_key/);
  assert.match(verifier, /taskIdentitySnapshot/);
  assert.match(verifier, /defaultDefinition: 'true'/);
  assert.match(verifier, /TaskMaterialRequirementRevision_task_identity_check/);
  assert.match(
    verifier,
    /foreign key \(projectid, taskid, taskidentitysnapshot\)[\s\S]*references task\(projectid, id, materialrequirementeligible\)/,
  );
  assert.match(verifier, /Canonical task did not generate materialRequirementEligible = true/);
  assert.match(verifier, /false canonical task identity snapshot/);
  assert.match(verifier, /old\.type is not distinct from new\.type/);
  assert.match(verifier, /NO_MATERIALS_REQUIRED/);
});

test('package and Vercel build wire the dedicated verifier after migration deploy', () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(
    pkg.scripts['verify:task-material-requirements-migration'],
    'node scripts/verify-task-material-requirements-migration.mjs',
  );
  assert.match(vercelBuild, /TASK_MATERIAL_REQUIREMENTS_VERIFIER_PATH/);
  assert.match(
    vercelBuild,
    /taskMaterialRequirementsVerifier: TASK_MATERIAL_REQUIREMENTS_VERIFIER_PATH/,
  );
  assert.match(
    vercelBuild,
    /TASK_MATERIAL_REQUIREMENTS_MIGRATION_DATABASE_URL:[\s\S]*environment\[plan\.migrationDatabaseEnvironment\]/,
  );
  assert.match(vercelBuild, /TASK_MATERIAL_REQUIREMENTS_MIGRATION_SCHEMA: "public"/);
  const deploy = vercelBuild.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verify = vercelBuild.indexOf('[cliPaths.taskMaterialRequirementsVerifier]');
  const generate = vercelBuild.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(deploy >= 0 && verify > deploy && generate > verify);
  assert.match(
    continuousIntegration,
    /TASK_MATERIAL_REQUIREMENTS_MIGRATION_DATABASE_URL:[\s\S]*TASK_MATERIAL_REQUIREMENTS_MIGRATION_SCHEMA: public[\s\S]*npm run verify:task-material-requirements-migration/,
  );
});
