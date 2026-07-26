import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migrationPath = new URL(
  'prisma/migrations/20260726170000_protected_upload_reservations/migration.sql',
  root,
);
const migration = await readFile(migrationPath, 'utf8');

test('ProtectedUpload migration is ordered after visual assessment and enforces lifecycle invariants', async () => {
  const migrations = (await readdir(new URL('prisma/migrations/', root)))
    .filter((name) => /^\d+_/.test(name))
    .sort();
  assert.ok(
    migrations.indexOf('20260726170000_protected_upload_reservations')
      > migrations.indexOf('20260726143000_visual_progress_assessments'),
  );
  assert.match(migration, /CREATE TYPE "ProtectedUploadPurpose"/);
  assert.match(migration, /CREATE TYPE "ProtectedUploadStatus"/);
  assert.match(migration, /'UPLOADING',\s*'AVAILABLE',\s*'CLAIMED',\s*'DELETE_PENDING',\s*'DELETED'/);
  assert.match(migration, /CONSTRAINT "ProtectedUpload_state_check" CHECK/);
  assert.match(migration, /CONSTRAINT "ProtectedUpload_purpose_media_check" CHECK/);
  assert.match(migration, /CONSTRAINT "ProtectedUpload_claim_type_check" CHECK/);
  assert.match(migration, /"operationKeyHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"claimFingerprint" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /ProtectedUpload_project_purpose_operation_key/);
  assert.match(migration, /ProtectedUpload_project_purpose_delete_key/);
  assert.match(migration, /"storageProvider" VARCHAR\(32\) NOT NULL/);
  assert.match(migration, /"uploadAttemptCount" INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /"uploadLeaseExpiresAt" TIMESTAMP\(3\)/);
  assert.match(migration, /"deleteAttemptCount" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"deleteLeaseExpiresAt" TIMESTAMP\(3\)/);
  assert.match(migration, /"nextDeleteAttemptAt" TIMESTAMP\(3\)/);
  assert.match(migration, /"size" BETWEEN 1 AND 4194304/);
  assert.match(migration, /ProtectedUpload_expiry_cleanup_idx/);
  assert.match(migration, /ProtectedUpload_delete_cleanup_idx/);
  assert.match(migration, /ProtectedUpload_project_active_idx/);
  assert.match(migration, /ProtectedUpload_org_created_idx/);
  assert.match(migration, /ProtectedUpload_project_scope_fkey[\s\S]*?ON DELETE RESTRICT/);
});

test('all four business entities retain a durable optional reservation FK for legacy compatibility', () => {
  for (const model of ['CashMovement', 'GoodsReceipt', 'SupplierInvoice', 'ProgressEvidence']) {
    assert.match(schema, new RegExp(`model ${model} \\{[\\s\\S]*?protectedUploadId\\s+String\\?`));
  }
  for (const constraint of [
    'CashMovement_protected_upload_fkey',
    'GoodsReceipt_protected_upload_fkey',
    'SupplierInvoice_protected_upload_fkey',
    'ProgressEvidence_protected_upload_fkey',
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.match(migration, /ALTER TABLE "CashMovement"[\s\S]*?"requestFingerprint" CHAR\(64\)/);
  assert.match(migration, /ALTER TABLE "GoodsReceipt"[\s\S]*?"requestFingerprint" CHAR\(64\)/);
  assert.match(migration, /ALTER TABLE "SupplierInvoice"[\s\S]*?"requestFingerprint" CHAR\(64\)/);
});

test('upload routes expose only uploadId and require idempotency for POST and DELETE', async () => {
  const routes = [
    'src/app/api/cash-movements/receipt/route.js',
    'src/app/api/goods-receipts/evidence/route.js',
    'src/app/api/supplier-invoices/evidence/route.js',
    'src/app/api/progress/upload/route.js',
  ];
  for (const route of routes) {
    const source = await readFile(new URL(route, root), 'utf8');
    assert.match(source, /normalizeProtectedUploadIdempotencyKey\([\s\S]{0,100}Idempotency-Key/);
    assert.match(source, /stageProtectedUpload/);
    assert.match(source, /MAX_PROTECTED_UPLOAD_BYTES/);
    assert.match(source, /return json\(\{ uploadId: result\.uploadId \}/);
    assert.match(source, /const uploadId = .*\?\.uploadId/);
    assert.match(source, /deleteProtectedUpload/);
    assert.match(source, /idempotencyKey: request\.headers\.get\('Idempotency-Key'\)/);
    assert.doesNotMatch(source, /return json\(\{ (?:receipt|media):/);
    assert.doesNotMatch(source, /body\?\.(?:receipt|media)|\.storage\)/);
  }
});

test('dashboard clients persist one complete upload attempt and never mint a key per submit', async () => {
  const clients = [
    'src/app/dashboard/cash/cash-client.js',
    'src/app/dashboard/purchases/receipt-client.js',
    'src/app/dashboard/payables/payables-client.js',
    'src/app/dashboard/progress/progress-client.js',
  ];
  for (const client of clients) {
    const source = await readFile(new URL(client, root), 'utf8');
    assert.match(source, /useRef\(null\)/);
    assert.match(source, /protectedUploadAttemptForPayload/);
    assert.match(source, /rememberProtectedUploadId/);
    assert.match(source, /attempt\.operationKey/);
    assert.match(source, /attempt\.uploadId/);
    assert.match(source, /discardProtectedUploadAttempt/);
    assert.match(source, /isTerminalProtectedUploadClientError/);
    assert.doesNotMatch(source, /const operationKey = crypto\.randomUUID\(\)/);
    assert.doesNotMatch(source, /receipt: uploaded|media: uploaded|JSON\.stringify\(\{ (?:receipt|media):/);
  }
});

test('the shared client attempt contract rotates only after cleanup or real payload change', async () => {
  const source = await readFile(new URL('src/lib/protected-upload-policy.js', root), 'utf8');
  assert.match(source, /if \(current\?\.payloadKey === payloadKey\) return current/);
  assert.match(source, /if \(current\?\.uploadId\)[\s\S]*?discardProtectedUploadAttempt/);
  assert.match(source, /attempt\.uploadId = uploadId\.trim\(\)/);
  assert.match(source, /'Idempotency-Key': attempt\.deleteKey/);
  assert.match(source, /MAX_PROTECTED_UPLOAD_BYTES = 4 \* 1024 \* 1024/);
});

test('WhatsApp evidence remains on its separately authorized ingestion path', async () => {
  const source = await readFile(
    new URL('src/lib/whatsapp/progress-evidence.js', root),
    'utf8',
  );
  assert.match(source, /sourceMessageId/);
  assert.match(source, /function validateSourceMessage/);
  assert.match(source, /metadata\.authorized !== true/);
  assert.doesNotMatch(source, /ProtectedUpload|protectedUploadId|claimProtectedUpload/);
});

test('dashboard progress attachment delivery is permissioned, project-scoped and descriptor-free', async () => {
  const route = await readFile(
    new URL('src/app/api/progress/[recordId]/attachment/route.js', root),
    'utf8',
  );
  const journal = await readFile(new URL('src/lib/progress-journal.js', root), 'utf8');
  assert.match(route, /requireTenantPermission\(access, 'org:execution:read'/);
  assert.match(route, /requireTenantPermission\(access, SOURCE_EVIDENCE_PERMISSION/);
  assert.match(route, /projectId: access\.project\.id/);
  assert.match(route, /sourceMessageId: null/);
  assert.match(route, /isDashboardProgressMediaForProject\(evidence\.media, access\.project\.id\)/);
  assert.match(route, /readProtectedFile\(evidence\.media\.storage\)/);
  assert.match(route, /progressEvidenceFileResponse/);
  assert.doesNotMatch(route, /Response\.json\([^)]*(?:media|storage)/);
  assert.match(journal, /`\/api\/progress\/\$\{encodeURIComponent\(item\.id\)\}\/attachment`/);
});
