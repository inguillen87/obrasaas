import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const verifier = await readFile(
  new URL('scripts/verify-protected-upload-migration.mjs', root),
  'utf8',
);
const migration = await readFile(
  new URL(
    'prisma/migrations/20260726170000_protected_upload_reservations/migration.sql',
    root,
  ),
  'utf8',
);
const build = await readFile(new URL('scripts/vercel-build.mjs', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('protected upload verifier uses an isolated schema-bound TLS connection', () => {
  assert.match(verifier, /PROTECTED_UPLOAD_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /PROTECTED_UPLOAD_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /postgres:', 'postgresql:/);
  assert.match(verifier, /SCHEMA_IDENTIFIER_PATTERN/);
  assert.match(verifier, /conflicting schema parameters/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /must use sslmode=verify-full for a remote PostgreSQL host/);
  assert.match(verifier, /SET LOCAL search_path/);
  assert.match(verifier, /obrasaas-protected-upload-migration-verifier/);
});

test('protected upload verifier catalogs the migration, enums, columns and lifecycle checks', () => {
  assert.match(verifier, /20260726170000_protected_upload_reservations/);
  assert.match(verifier, /FROM "_prisma_migrations"/);
  assert.match(verifier, /JOIN pg_enum/);
  assert.match(verifier, /FROM information_schema\.columns/);
  assert.match(verifier, /ProtectedUploadPurpose:[\s\S]*CASH_RECEIPT[\s\S]*PROGRESS_EVIDENCE/);
  assert.match(verifier, /ProtectedUploadStatus:[\s\S]*UPLOADING[\s\S]*AVAILABLE[\s\S]*CLAIMED[\s\S]*DELETE_PENDING[\s\S]*DELETED/);

  for (const column of [
    'storageProvider',
    'uploadAttemptCount',
    'uploadLeaseExpiresAt',
    'deleteAttemptCount',
    'deleteLeaseExpiresAt',
    'nextDeleteAttemptAt',
    'lastErrorCode',
  ]) {
    assert.match(verifier, new RegExp(`${column}:`));
  }
  for (const constraint of [
    'ProtectedUpload_hashes_check',
    'ProtectedUpload_metadata_check',
    'ProtectedUpload_purpose_media_check',
    'ProtectedUpload_claim_type_check',
    'ProtectedUpload_state_check',
    'ProtectedUpload_state_timestamps_check',
    'CashMovement_request_fingerprint_check',
    'GoodsReceipt_request_fingerprint_check',
    'SupplierInvoice_request_fingerprint_check',
  ]) {
    assert.match(verifier, new RegExp(constraint));
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.match(verifier, /constraint_record\.convalidated/);
});

test('protected upload verifier governs ordered indexes and immediate RESTRICT foreign keys', () => {
  assert.match(verifier, /JOIN pg_index/);
  assert.match(verifier, /indisvalid/);
  assert.match(verifier, /indisready/);
  assert.match(verifier, /indnullsnotdistinct/);
  for (const index of [
    'ProtectedUpload_project_purpose_operation_key',
    'ProtectedUpload_project_purpose_delete_key',
    'ProtectedUpload_actor_project_active_idx',
    'ProtectedUpload_project_active_idx',
    'ProtectedUpload_org_created_idx',
    'ProtectedUpload_expiry_cleanup_idx',
    'ProtectedUpload_delete_cleanup_idx',
    'CashMovement_project_protected_upload_key',
    'GoodsReceipt_project_protected_upload_key',
    'SupplierInvoice_project_protected_upload_key',
    'ProgressEvidence_project_protected_upload_key',
  ]) {
    assert.match(verifier, new RegExp(index));
    assert.match(migration, new RegExp(`"${index}"`));
  }

  assert.match(verifier, /ProtectedUpload_project_scope_fkey:[\s\S]*target: 'Project'[\s\S]*deleteAction: 'r'/);
  assert.match(verifier, /ProtectedUpload_actorId_fkey:[\s\S]*deleteAction: 'r'/);
  assert.match(verifier, /source_attribute\.attname::text/);
  assert.match(verifier, /target_attribute\.attname::text/);
  assert.match(
    migration,
    /CONSTRAINT "ProtectedUpload_project_scope_fkey"[\s\S]*?ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.match(
    migration,
    /CONSTRAINT "ProtectedUpload_actorId_fkey"[\s\S]*?ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  for (const constraint of [
    'CashMovement_protected_upload_fkey',
    'GoodsReceipt_protected_upload_fkey',
    'SupplierInvoice_protected_upload_fkey',
    'ProgressEvidence_protected_upload_fkey',
  ]) {
    assert.match(verifier, new RegExp(`${constraint}:`));
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.ok((verifier.match(/deleteAction: 'r'/g) || []).length >= 6);
  assert.match(verifier, /confupdtype === 'c'/);
  assert.match(verifier, /!foreignKey\.condeferrable && !foreignKey\.condeferred/);
});

test('protected upload verifier runs rollback-only semantic fixtures', () => {
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /SAVEPOINT/);
  assert.match(verifier, /ROLLBACK TO SAVEPOINT/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /(?:await\s+client\.query\(|client\.query\()\s*['"]COMMIT['"]/);
  assert.match(verifier, /ProtectedUpload UPLOADING lease guard/);
  assert.match(verifier, /ProtectedUpload AVAILABLE lifecycle guard/);
  assert.match(verifier, /ProtectedUpload AVAILABLE claim-field guard/);
  assert.match(verifier, /ProtectedUpload AVAILABLE delete-field guard/);
  assert.match(verifier, /ProtectedUpload maximum size guard/);
  assert.match(verifier, /"expiresAt", "createdAt", "updatedAt"/);
  assert.match(verifier, /ProtectedUpload storage-provider binding/);
  assert.match(verifier, /ProtectedUpload cross-tenant project scope/);
  assert.match(verifier, /ProtectedUpload cross-project entity scope/);
  assert.match(verifier, /ProtectedUpload project retention policy/);
  assert.match(verifier, /'23514'/);
  assert.match(verifier, /'23503'/);
  assert.match(verifier, /'23505'/);
  assert.match(verifier, /@invalid\.example/);
});

test('Vercel executes protected upload verification after deploy and before generation', () => {
  assert.equal(
    packageJson.scripts['verify:protected-upload-migration'],
    'node scripts/verify-protected-upload-migration.mjs',
  );
  assert.match(build, /verify-protected-upload-migration\.mjs/);
  assert.match(build, /PROTECTED_UPLOAD_MIGRATION_DATABASE_URL/);
  assert.match(build, /PROTECTED_UPLOAD_MIGRATION_SCHEMA: "public"/);
  const migrate = build.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verifierCall = build.indexOf('[cliPaths.protectedUploadVerifier]');
  const generate = build.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verifierCall > migrate && generate > verifierCall);
});
