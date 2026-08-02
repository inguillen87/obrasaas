import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationUrl = new URL(
  '../prisma/migrations/20260802150000_goods_receipt_commitment_allocation/migration.sql',
  import.meta.url,
);
const verifierUrl = new URL(
  '../scripts/verify-goods-receipt-commitment-allocation-migration.mjs',
  import.meta.url,
);
const [schema, migration, verifier, vercelBuild] = await Promise.all([
  readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
  readFile(migrationUrl, 'utf8'),
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
]);
const allocationModel = schema.match(
  /model GoodsReceiptCommitmentAllocation \{[\s\S]*?\n\}/,
)?.[0] || '';

test('Prisma exposes an explicit exact allocation ledger with tenant-scoped composite relations', () => {
  assert.match(schema, /model GoodsReceiptCommitmentAllocation \{/);
  for (const field of [
    'organizationId',
    'projectId',
    'purchaseOrderId',
    'purchaseOrderLineId',
    'goodsReceiptId',
    'goodsReceiptLineId',
    'supplierCommitmentId',
    'operationKey',
    'requestFingerprint',
    'createdById',
    'createdAt',
  ]) {
    assert.match(schema, new RegExp(`\\s${field}\\s+`));
  }
  assert.match(schema, /quantity\s+Decimal\s+@db\.Decimal\(14, 3\)/);
  assert.match(schema, /@@unique\(\[projectId, id\], map: "GRCAllocation_project_id_key"\)/);
  assert.match(schema, /@@unique\(\[projectId, operationKey\], map: "GRCAllocation_project_operation_key"\)/);
  assert.match(
    schema,
    /supplierCommitment\s+SupplierCommitment\s+@relation\(fields: \[organizationId, projectId, purchaseOrderId, supplierCommitmentId\], references: \[organizationId, projectId, purchaseOrderId, id\]/,
  );
  assert.match(
    schema,
    /goodsReceiptLine\s+GoodsReceiptLine\s+@relation\(fields: \[projectId, purchaseOrderId, goodsReceiptId, purchaseOrderLineId, goodsReceiptLineId\]/,
  );
  assert.doesNotMatch(allocationModel, /organization\s+Organization\s+@relation/);
});

test('migration is append-only, exact, idempotent and contains no inferred historical backfill', () => {
  assert.match(migration, /"quantity" DECIMAL\(14,3\) NOT NULL/);
  assert.match(migration, /GRCAllocation_quantity_positive_check[\s\S]*?"quantity" > 0/);
  assert.match(migration, /GRCAllocation_operation_key_check[\s\S]*?BETWEEN 1 AND 128/);
  assert.match(
    migration,
    /GRCAllocation_request_fingerprint_check[\s\S]*?\^\[0-9a-f\]\{64\}\$/,
  );
  assert.match(
    migration,
    /GRCAllocation_project_operation_key[\s\S]*?\("projectId", "operationKey"\)/,
  );
  assert.doesNotMatch(
    migration,
    /INSERT INTO\s+"GoodsReceiptCommitmentAllocation"[\s\S]*?SELECT/i,
  );
  assert.doesNotMatch(
    migration,
    /UNIQUE[^;]*(?:goodsReceiptLineId[^;]*supplierCommitmentId|supplierCommitmentId[^;]*goodsReceiptLineId)/i,
  );
  for (const trigger of [
    'GoodsReceiptCommitmentAllocation_insert_guard',
    'GoodsReceiptCommitmentAllocation_append_only',
    'GoodsReceiptCommitmentAllocation_no_truncate',
    'GoodsReceipt_status_transition_guard',
    'GoodsReceiptLine_allocation_guard',
    'SupplierCommitmentLine_allocation_guard',
  ]) {
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
});

test('insert guard serializes by project and enforces both active exact quantity ceilings', () => {
  assert.match(
    migration,
    /pg_advisory_xact_lock\([\s\S]*?hashtextextended\(NEW\."projectId", 0\)/,
  );
  assert.match(migration, /receipt_status <> 'POSTED'/);
  assert.match(migration, /commitment_kind <> 'MATERIAL_DELIVERY'/);
  assert.match(migration, /commitment_status = 'CANCELLED'/);
  assert.match(
    migration,
    /receipt_allocated \+ NEW\."quantity" > receipt_line_quantity/,
  );
  assert.match(
    migration,
    /commitment_allocated \+ NEW\."quantity" > commitment_line_quantity/,
  );
  assert.match(
    migration,
    /JOIN %I\."GoodsReceipt" AS receipt[\s\S]*?receipt\."status" = ''POSTED''/,
  );
  assert.match(migration, /Allocated GoodsReceiptLine identity and quantity are immutable/);
  assert.match(migration, /Allocated SupplierCommitmentLine identity and quantity are immutable/);
  assert.match(migration, /GoodsReceipt status transition is invalid/);
  assert.equal(
    migration.match(/hashtextextended\((?:NEW|OLD)\."projectId", 0\)/g)?.length,
    4,
  );
});

test('verifier is dedicated, checksum-bound, rollback-only and exercises scoped failure plus two connections', () => {
  assert.match(verifier, /GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_SCHEMA/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /expectedMigrationChecksum/);
  assert.match(verifier, /cross-tenant allocation/);
  assert.match(verifier, /receipt line excess by 0\.001/);
  assert.match(verifier, /allocation UPDATE append-only smoke/);
  assert.match(verifier, /allocation TRUNCATE append-only smoke/);
  assert.match(verifier, /VOIDED receipt reactivation/);
  assert.match(verifier, /assertTwoConnectionAdvisorySerialization/);
  assert.match(verifier, /obrasaas-allocation-lock-verifier-a/);
  assert.match(verifier, /obrasaas-allocation-lock-verifier-b/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /client\.query\('COMMIT'\)/);
});

test('verifier refuses ambient DATABASE_URL and requires a dedicated schema', () => {
  const environment = {
    ...process.env,
    DATABASE_URL: 'postgresql://ambient:secret@localhost/ignored',
  };
  delete environment.GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_DATABASE_URL;
  delete environment.GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_SCHEMA;
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is required; DATABASE_URL is intentionally ignored/);
});

test('protected Vercel build runs the allocation verifier after migrate and before generate', () => {
  const migrate = vercelBuild.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verify = vercelBuild.indexOf('[cliPaths.goodsReceiptCommitmentAllocationVerifier]');
  const generate = vercelBuild.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verify > migrate && generate > verify);
  assert.match(
    vercelBuild,
    /GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_DATABASE_URL/,
  );
  assert.match(
    vercelBuild,
    /GOODS_RECEIPT_COMMITMENT_ALLOCATION_MIGRATION_SCHEMA: "public"/,
  );
});
