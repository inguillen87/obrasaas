import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL(
  '../prisma/migrations/20260802180000_task_material_requirements/migration.sql',
  import.meta.url,
);
const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);

const [migration, schema] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(schemaPath, 'utf8'),
]);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[0];
}

test('schema exposes immutable task requirement revisions with exact material lines', () => {
  assert.match(
    schema,
    /enum TaskMaterialRequirementKind \{[\s\S]*MATERIALS_REQUIRED[\s\S]*NO_MATERIALS_REQUIRED/,
  );
  const revision = modelBlock('TaskMaterialRequirementRevision');
  assert.match(revision, /taskIdentitySnapshot\s+Boolean\s+@default\(true\)/);
  assert.match(revision, /lineCount\s+Int/);
  assert.match(revision, /taskRevisionSnapshot\s+Int/);
  assert.match(revision, /predecessor\s+TaskMaterialRequirementRevision\?/);
  assert.match(revision, /operationKey\s+String\s+@db\.VarChar\(190\)/);
  assert.match(revision, /requestFingerprint\s+String\s+@db\.Char\(64\)/);
  assert.match(revision, /@@unique\(\[projectId, taskId, version\]/);
  assert.match(revision, /@@unique\(\[organizationId, projectId, taskId, predecessorId\]/);
  assert.match(
    revision,
    /fields: \[projectId, taskId, taskIdentitySnapshot\][\s\S]*references: \[projectId, id, materialRequirementEligible\]/,
  );

  const task = modelBlock('Task');
  assert.match(task, /materialRequirementEligible\s+Boolean\s+@default\(dbgenerated\(\)\)/);
  assert.match(
    task,
    /@@unique\(\[projectId, id, materialRequirementEligible\], map: "Task_material_requirement_identity_key"\)/,
  );

  const line = modelBlock('TaskMaterialRequirementLine');
  assert.match(line, /requiredQuantity\s+Decimal\s+@db\.Decimal\(14, 3\)/);
  assert.match(line, /unitSnapshot\s+String\s+@db\.VarChar\(32\)/);
  assert.match(
    line,
    /fields: \[organizationId, projectId, inventoryItemId, unitSnapshot\][\s\S]*references: \[organizationId, projectId, id, baseUnit\]/,
  );
  assert.match(line, /@@unique\(\[projectId, revisionId, inventoryItemId\]/);
});

test('migration prevents ambiguous empty BOMs, branches, mutation and inferred backfill', () => {
  for (const table of [
    'TaskMaterialRequirementRevision',
    'TaskMaterialRequirementLine',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(migration, /"kind" = 'MATERIALS_REQUIRED'[\s\S]*"lineCount" BETWEEN 1 AND 200/);
  assert.match(migration, /"kind" = 'NO_MATERIALS_REQUIRED'[\s\S]*"lineCount" = 0/);
  assert.match(migration, /"requiredQuantity" > 0::numeric[\s\S]*<> 'NaN'::numeric/);
  assert.match(migration, /TaskMaterialRequirementRevision_root_key[\s\S]*WHERE "predecessorId" IS NULL/);
  assert.match(
    migration,
    /ADD COLUMN "materialRequirementEligible" BOOLEAN[\s\S]*GENERATED ALWAYS AS[\s\S]*"type" = 'TASK'[\s\S]*"metadata"->>'source'[\s\S]*STORED/,
  );
  assert.match(
    migration,
    /Task_material_requirement_identity_key"[\s\S]*"projectId", "id", "materialRequirementEligible"/,
  );
  assert.match(
    migration,
    /TaskMaterialRequirementRevision_task_identity_check"[\s\S]*"taskIdentitySnapshot" IS TRUE/,
  );
  assert.match(
    migration,
    /TaskMaterialRequirementRevision_task_fkey"[\s\S]*FOREIGN KEY \("projectId", "taskId", "taskIdentitySnapshot"\)[\s\S]*REFERENCES "Task"\("projectId", "id", "materialRequirementEligible"\)[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/,
  );
  assert.match(migration, /must extend the current head by one version/);
  assert.match(migration, /bundle must match its declared mode and line count exactly/);
  assert.match(migration, /item snapshot is not authoritative/);
  assert.match(migration, /Task with material requirement history cannot be deleted or lose canonical identity/);
  assert.match(migration, /deliberately does not infer requirements/);
  assert.doesNotMatch(migration, /INSERT INTO "TaskMaterialRequirement(?:Revision|Line)"[\s\S]*SELECT/i);
});

test('historical tables and task identity guards are always enabled', () => {
  const triggers = [
    'TaskMaterialRequirementRevision_insert_guard',
    'TaskMaterialRequirementRevision_append_only',
    'TaskMaterialRequirementRevision_no_truncate',
    'TaskMaterialRequirementRevision_snapshot_guard',
    'TaskMaterialRequirementLine_insert_guard',
    'TaskMaterialRequirementLine_append_only',
    'TaskMaterialRequirementLine_no_truncate',
    'TaskMaterialRequirementLine_snapshot_guard',
    'Task_material_requirement_update_guard',
    'Task_material_requirement_delete_guard',
  ];
  for (const trigger of triggers) {
    assert.match(migration, new RegExp(`CREATE (?:CONSTRAINT )?TRIGGER "${trigger}"`));
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
  assert.match(
    migration,
    /TaskMaterialRequirementRevision_snapshot_guard"[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
  );
  assert.match(
    migration,
    /TaskMaterialRequirementLine_snapshot_guard"[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
  );
});
