import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationUrl = new URL(
  '../prisma/migrations/20260802160000_goods_receipt_inspection_exceptions/migration.sql',
  import.meta.url,
);
const verifierUrl = new URL(
  '../scripts/verify-goods-receipt-inspection-migration.mjs',
  import.meta.url,
);
const [schema, migration, verifier, vercelBuild, packageJson] = await Promise.all([
  readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
  readFile(migrationUrl, 'utf8'),
  readFile(verifierUrl, 'utf8'),
  readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
]);

function model(name) {
  return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] || '';
}

test('Prisma exposes exact versioned receipt inspection, disposition, location and closure contracts', () => {
  assert.match(schema, /enum GoodsReceiptInspectionKind \{\s+FINALIZATION\s+CORRECTION\s+REVERSAL\s+\}/);
  assert.match(schema, /enum GoodsReceiptDispositionQuality \{\s+ACCEPTED\s+DAMAGED\s+REJECTED\s+QUARANTINED\s+\}/);
  assert.match(schema, /enum SupplierCommitmentLineClosureKind \{\s+FINAL_DELIVERY\s+REVERSAL\s+\}/);

  const location = model('InventoryLocation');
  assert.match(location, /code\s+String\s+@db\.VarChar\(32\)/);
  assert.match(location, /active\s+Boolean\s+@default\(true\)/);
  assert.match(location, /revision\s+Int\s+@default\(0\)/);
  assert.match(location, /project\s+Project\s+@relation\(fields: \[organizationId, projectId\], references: \[organizationId, id\][^\n]*map: "InventoryLocation_project_fkey"/);

  const inspection = model('GoodsReceiptInspection');
  for (const field of [
    'organizationId', 'projectId', 'purchaseOrderId', 'goodsReceiptId', 'kind',
    'version', 'operationKey', 'requestFingerprint', 'inspectedById', 'locationId',
    'locationCodeSnapshot', 'locationNameSnapshot', 'inspectedAt', 'createdAt',
  ]) {
    assert.match(inspection, new RegExp(`\\s${field}\\s+`));
  }
  assert.match(inspection, /predecessorId\s+String\?/);
  assert.match(inspection, /reason\s+String\?/);
  assert.match(inspection, /locationCodeSnapshot\s+String\s+@db\.VarChar\(32\)/);
  assert.match(inspection, /locationNameSnapshot\s+String\s+@db\.VarChar\(160\)/);
  assert.match(inspection, /inspectedBy\s+PlatformUser\s+@relation\("GoodsReceiptInspector"/);
  assert.match(inspection, /project\s+Project\s+@relation\([^\n]*map: "GoodsReceiptInspection_project_fkey"/);
  assert.match(inspection, /@@unique\(\[projectId, goodsReceiptId, version\]/);
  assert.doesNotMatch(inspection, /\bJson\b|evidence|metadata/i);

  const disposition = model('GoodsReceiptInspectionDisposition');
  assert.match(disposition, /allocationId\s+String\?/);
  assert.match(disposition, /quality\s+GoodsReceiptDispositionQuality/);
  assert.match(disposition, /quantity\s+Decimal\s+@db\.Decimal\(14, 3\)/);
  assert.match(
    disposition,
    /allocation\s+GoodsReceiptCommitmentAllocation\?\s+@relation\(fields: \[organizationId, projectId, purchaseOrderId, purchaseOrderLineId, goodsReceiptId, goodsReceiptLineId, allocationId\]/,
  );

  const closure = model('SupplierCommitmentLineClosure');
  assert.match(closure, /acceptedQuantity\s+Decimal\?\s+@db\.Decimal\(14, 3\)/);
  assert.match(closure, /shortageQuantity\s+Decimal\?\s+@db\.Decimal\(14, 3\)/);
  assert.match(closure, /closedBy\s+PlatformUser\s+@relation\("SupplierCommitmentLineClosureActor"/);
  assert.match(closure, /project\s+Project\s+@relation\([^\n]*map: "SupplierCommitmentLineClosure_project_fkey"/);
  assert.match(closure, /@@unique\(\[projectId, supplierCommitmentId, purchaseOrderLineId, version\]/);
  assert.doesNotMatch(closure, /\bJson\b|evidence|metadata/i);

  const receipt = model('GoodsReceipt');
  assert.match(receipt, /receivedById\s+String\?/);
  assert.match(receipt, /receivedBy\s+PlatformUser\?\s+@relation\("GoodsReceiptReceiver"/);
  assert.match(receipt, /@@index\(\[receivedById, receivedAt\], map: "GoodsReceipt_receivedById_receivedAt_idx"\)/);
});

test('migration is additive, exact, tenant-scoped and contains no inferred legacy backfill', () => {
  assert.match(migration, /"code" VARCHAR\(32\) NOT NULL/);
  assert.match(migration, /InventoryLocation_code_check[\s\S]*?"code" = btrim\("code"\)[\s\S]*?"code" = upper\("code"\)[\s\S]*?\^\[A-Z0-9\]/);
  assert.match(migration, /InventoryLocation_name_check[\s\S]*?"name" = btrim\("name"\)/);
  assert.match(migration, /"quantity" DECIMAL\(14,3\) NOT NULL/);
  assert.match(migration, /"acceptedQuantity" DECIMAL\(14,3\)/);
  assert.match(migration, /"shortageQuantity" DECIMAL\(14,3\)/);
  for (const constraint of [
    'GRInspection_GoodsReceiptLine_finite_check',
    'GRInspection_GRCAllocation_finite_check',
    'GRInspection_SupplierCommitmentLine_finite_check',
    'GRInspectionDisposition_quantity_positive_check',
    'SupplierCommitmentLineClosure_finite_check',
  ]) {
    assert.match(migration, new RegExp(`${constraint}[\\s\\S]*?<> 'NaN'::numeric`));
  }
  assert.match(
    migration,
    /GRInspectionDisposition_allocation_fkey[\s\S]*?FOREIGN KEY \(\s*"organizationId",\s*"projectId",\s*"purchaseOrderId",\s*"purchaseOrderLineId",\s*"goodsReceiptId",\s*"goodsReceiptLineId",\s*"allocationId"\s*\)/,
  );
  assert.doesNotMatch(migration, /INSERT INTO\s+"GoodsReceiptInspection"[\s\S]*?SELECT/i);
  assert.doesNotMatch(migration, /INSERT INTO\s+"SupplierCommitmentLineClosure"[\s\S]*?SELECT/i);
  assert.doesNotMatch(migration, /ProjectSnapshot|stockpiles|\bAVAILABLE\b/);
});

test('inspection state machine is linear, server-attributed and reversal preserves historical locations', () => {
  assert.match(migration, /pg_advisory_xact_lock\([\s\S]*?hashtextextended\(NEW\."projectId", 0\)/);
  assert.match(migration, /First GoodsReceiptInspection must be FINALIZATION version 1/);
  assert.match(migration, /NEW\."version" <> previous_version \+ 1/);
  assert.match(migration, /NEW\."predecessorId" IS DISTINCT FROM previous_id/);
  assert.match(migration, /NEW\."kind" <> 'REVERSAL' AND NOT location_active/);
  assert.match(migration, /finalization or correction requires an active location/);
  assert.match(migration, /TenantMembership[\s\S]*?NEW\."inspectedById"/);
  assert.match(migration, /GoodsReceipt receivedById is immutable once attributed/);
  assert.match(migration, /GoodsReceipt receiver is not an active tenant member/);
  assert.match(migration, /reversal must preserve the historical location snapshot/);
  assert.match(migration, /GoodsReceiptInspection location snapshot must match the active location/);
  assert.match(migration, /InventoryLocation active limit of 100 reached for project/);
  assert.match(migration, /InventoryLocation tenant and project scope are immutable/);
  assert.match(migration, /obrasaas_numeric_quantity_finite_guard/);
  assert.equal(
    [...migration.matchAll(/ENABLE ALWAYS TRIGGER "[^"]+_00_finite_guard"/g)].length,
    5,
  );
});

test('deferred snapshot guard enforces complete receipt, allocation and unallocated partitions', () => {
  assert.match(migration, /jsonb_extract_path_text\([\s\S]*?to_jsonb\(NEW\)[\s\S]*?'inspectionId'/);
  assert.doesNotMatch(migration, /ELSE NEW\."inspectionId"/);
  for (const trigger of [
    'GoodsReceiptInspection_snapshot_guard',
    'GoodsReceiptInspectionDisposition_snapshot_guard',
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE CONSTRAINT TRIGGER "${trigger}"[\\s\\S]*?DEFERRABLE INITIALLY DEFERRED`),
    );
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
  assert.match(migration, /Inspection dispositions must exactly partition every receipt line/);
  assert.match(migration, /Inspection dispositions must exactly partition every receipt allocation/);
  assert.match(migration, /Unallocated dispositions must equal the receipt quantity not assigned to commitments/);
  assert.match(migration, /An inspection with quality exceptions requires reason/);
  assert.match(migration, /REVERSAL inspection cannot contain dispositions/);
  assert.match(migration, /closure must be reversed before adding inspection dispositions/);
});

test('final delivery closure derives exact inspected quantities and reversals reopen every mutation guard', () => {
  assert.match(migration, /First SupplierCommitmentLineClosure must be FINAL_DELIVERY version 1/);
  assert.match(migration, /FINAL_DELIVERY requires an active inspection for every posted allocation/);
  assert.match(migration, /disposition\."quality" = ''ACCEPTED''/);
  assert.match(migration, /shortage_quantity := commitment_quantity - accepted_quantity/);
  assert.match(migration, /quantities do not match effective accepted inspections/);
  assert.match(migration, /shortage requires reason/);
  assert.match(
    migration,
    /obrasaas_closed_supplier_commitment_line_guard[\s\S]*?ORDER BY closure\."version" DESC[\s\S]*?latest_closure_kind = 'FINAL_DELIVERY'/,
  );
  assert.match(migration, /frozen by active inspection/);
  assert.match(migration, /frozen by final delivery closure/);
  assert.match(migration, /inspection must be reversed before voiding receipt/);
  assert.match(migration, /Inspected GoodsReceipt source document is immutable/);
  assert.match(migration, /OLD\."status" = 'VOIDED'[\s\S]*?NEW\."status" = 'VOIDED'/);
  assert.match(migration, /Voided GoodsReceiptLine is immutable/);
  assert.match(
    migration,
    /CREATE TRIGGER "GoodsReceiptLine_inspection_guard"\s+BEFORE INSERT OR UPDATE OR DELETE/,
  );

  for (const trigger of [
    'GoodsReceiptInspection_append_only',
    'GoodsReceiptInspection_no_truncate',
    'GoodsReceiptInspectionDisposition_append_only',
    'GoodsReceiptInspectionDisposition_no_truncate',
    'SupplierCommitmentLineClosure_append_only',
    'SupplierCommitmentLineClosure_no_truncate',
    'GRCAllocation_inspection_guard',
    'SupplierCommitmentLine_closure_guard',
  ]) {
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
});

test('dedicated verifier is checksum-bound, rollback-only and proves version and reversal semantics', () => {
  assert.match(verifier, /GOODS_RECEIPT_INSPECTION_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /GOODS_RECEIPT_INSPECTION_MIGRATION_SCHEMA/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /expectedMigrationChecksum/);
  assert.match(verifier, /final delivery with uninspected posted allocation/);
  assert.match(verifier, /deferred allocation partition mismatch/);
  assert.match(verifier, /Initial closure must be version 1/);
  assert.match(verifier, /Initial inspection must be version 1/);
  assert.match(verifier, /Inspection correction must advance the chain to version 2/);
  assert.match(verifier, /chain to version 2/);
  assert.match(verifier, /chain to version 3/);
  assert.match(verifier, /non-canonical inventory location code/);
  assert.match(verifier, /receipt server attribution immutability/);
  assert.match(verifier, /combined receipt void and document mutation/);
  assert.match(verifier, /voided receipt document mutation/);
  assert.match(verifier, /voided receipt deletion/);
  assert.match(verifier, /voided receipt line insertion/);
  assert.match(verifier, /voided receipt line update/);
  assert.match(verifier, /voided receipt line deletion/);
  assert.match(verifier, /one hundred first active inventory location/);
  assert.match(verifier, /reactivation beyond inventory location limit/);
  assert.match(verifier, /receipt line insert after inspection history/);
  assert.match(verifier, /inspected receipt document mutation/);
  assert.match(verifier, /inspection reversal location mutation/);
  assert.match(verifier, /same transaction closure before inspection dispositions/);
  assert.match(verifier, /NUMERIC NaN rejection/g);
  assert.match(verifier, /closure UPDATE append-only smoke/);
  assert.match(verifier, /closure TRUNCATE append-only smoke/);
  assert.match(verifier, /commitment line update before closure reversal/);
  assert.match(verifier, /UPDATE "InventoryLocation" SET "active" = false/);
  assert.match(verifier, /assertTwoConnectionAdvisorySerialization/);
  assert.match(verifier, /obrasaas-inspection-lock-verifier-a/);
  assert.match(verifier, /obrasaas-inspection-lock-verifier-b/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /client\.query\('COMMIT'\)/);
});

test('verifier refuses ambient DATABASE_URL and requires its dedicated connection', () => {
  const environment = {
    ...process.env,
    DATABASE_URL: 'postgresql://ambient:secret@localhost/ignored',
  };
  delete environment.GOODS_RECEIPT_INSPECTION_MIGRATION_DATABASE_URL;
  delete environment.GOODS_RECEIPT_INSPECTION_MIGRATION_SCHEMA;
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is required; DATABASE_URL is intentionally ignored/);
});

test('protected Vercel build verifies inspection after allocations and before generate', () => {
  const migrate = vercelBuild.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const allocation = vercelBuild.indexOf('[cliPaths.goodsReceiptCommitmentAllocationVerifier]');
  const inspection = vercelBuild.indexOf('[cliPaths.goodsReceiptInspectionVerifier]');
  const generate = vercelBuild.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && allocation > migrate && inspection > allocation && generate > inspection);
  assert.match(vercelBuild, /GOODS_RECEIPT_INSPECTION_MIGRATION_DATABASE_URL/);
  assert.match(vercelBuild, /GOODS_RECEIPT_INSPECTION_MIGRATION_SCHEMA: "public"/);
  assert.equal(
    packageJson.scripts['verify:goods-receipt-inspection-migration'],
    'node scripts/verify-goods-receipt-inspection-migration.mjs',
  );
});
