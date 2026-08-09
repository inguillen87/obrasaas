import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scopedIdentityMigrationPath = new URL(
  '../prisma/migrations/20260809093000_purchase_order_line_scoped_identity/migration.sql',
  import.meta.url,
);
const projectOwnershipMigrationPath = new URL(
  '../prisma/migrations/20260809093100_task_assignment_project_ownership/migration.sql',
  import.meta.url,
);
const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const verifierPath = new URL('../scripts/verify-project-execution-migration.mjs', import.meta.url);
const [scopedIdentityMigration, projectOwnershipMigration, schema, verifier] = await Promise.all([
  readFile(scopedIdentityMigrationPath, 'utf8'),
  readFile(projectOwnershipMigrationPath, 'utf8'),
  readFile(schemaPath, 'utf8'),
  readFile(verifierPath, 'utf8'),
]);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[0];
}

test('schema retains scoped purchase-line identity and cascading assignment ownership', () => {
  const purchaseOrderLine = modelBlock('PurchaseOrderLine');
  assert.match(purchaseOrderLine, /@@unique\(\[projectId, id\]\)/);

  const taskAssignment = modelBlock('TaskAssignment');
  assert.match(
    taskAssignment,
    /project\s+Project\s+@relation\(fields: \[projectId\], references: \[id\], onDelete: Cascade\)/,
  );
});

test('migration builds the scoped purchase-line key online with the Prisma name', () => {
  assert.match(scopedIdentityMigration, /SET lock_timeout = '5s';/);
  assert.match(
    scopedIdentityMigration,
    /CREATE UNIQUE INDEX CONCURRENTLY "PurchaseOrderLine_projectId_id_key"\s+ON "PurchaseOrderLine"\("projectId", "id"\);/,
  );
  assert.equal(
    (scopedIdentityMigration.match(/CREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY/gi) || []).length,
    1,
  );
  assert.doesNotMatch(scopedIdentityMigration, /CREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS/i);
  assert.doesNotMatch(scopedIdentityMigration, /DROP\s+INDEX/i);
  assert.doesNotMatch(scopedIdentityMigration, /^\s*(?:BEGIN|COMMIT)\s*;/im);
  assert.match(scopedIdentityMigration, /RESET lock_timeout;/);
  assert.doesNotMatch(scopedIdentityMigration, /TaskAssignment_projectId_fkey/);
});

test('migration expands then validates cascading project ownership without blocking the initial scan', () => {
  assert.match(projectOwnershipMigration, /SET lock_timeout = '5s';/);
  assert.match(
    projectOwnershipMigration,
    /ADD CONSTRAINT "TaskAssignment_projectId_fkey"[\s\S]*?FOREIGN KEY \("projectId"\)[\s\S]*?REFERENCES "Project"\("id"\)[\s\S]*?ON DELETE CASCADE ON UPDATE CASCADE[\s\S]*?NOT VALID;/,
  );
  assert.match(
    projectOwnershipMigration,
    /ALTER TABLE "TaskAssignment"\s+VALIDATE CONSTRAINT "TaskAssignment_projectId_fkey";/,
  );
  assert.doesNotMatch(
    projectOwnershipMigration,
    /TaskAssignment_projectId_fkey[\s\S]*?ON DELETE RESTRICT/,
  );
  assert.doesNotMatch(projectOwnershipMigration, /^\s*(?:BEGIN|COMMIT)\s*;/im);
  assert.doesNotMatch(projectOwnershipMigration, /CREATE\s+(?:UNIQUE\s+)?INDEX/i);

  const addForeignKey = projectOwnershipMigration.indexOf('ADD CONSTRAINT "TaskAssignment_projectId_fkey"');
  const validateForeignKey = projectOwnershipMigration.indexOf('VALIDATE CONSTRAINT "TaskAssignment_projectId_fkey"');
  const resetLockTimeout = projectOwnershipMigration.indexOf('RESET lock_timeout');
  assert.ok(addForeignKey >= 0);
  assert.ok(validateForeignKey > addForeignKey);
  assert.ok(resetLockTimeout > validateForeignKey);
});

test('runtime verifier normalizes PostgreSQL catalog name arrays to text arrays', () => {
  assert.equal(
    (verifier.match(/\)::text\[\]\s+AS\s+(?:columns|"childColumns"|"parentColumns")/g) || []).length,
    3,
  );
  assert.match(verifier, /assert\.deepEqual\([\s\S]*?\['projectId', 'id'\]/);
  assert.match(verifier, /assert\.deepEqual\(projectForeignKey\.childColumns, \['projectId'\]\)/);
  assert.match(verifier, /assert\.deepEqual\(projectForeignKey\.parentColumns, \['id'\]\)/);
});
