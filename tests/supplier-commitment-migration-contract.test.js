import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const migration = await readFile(new URL(
  '../prisma/migrations/20260801090000_supplier_commitments_and_calendar/migration.sql',
  import.meta.url,
), 'utf8');
const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const worker = await readFile(new URL('../src/lib/supplier-reminder-worker.js', import.meta.url), 'utf8');
const webhookRoute = await readFile(new URL('../src/app/api/webhooks/resend/route.js', import.meta.url), 'utf8');
const cronRoute = await readFile(new URL('../src/app/api/cron/supplier-reminders/route.js', import.meta.url), 'utf8');
const verifierUrl = new URL('../scripts/verify-supplier-commitment-migration.mjs', import.meta.url);
const verifier = await readFile(verifierUrl, 'utf8');

function runVerifierPreflight(environment = {}) {
  const childEnvironment = { ...process.env, ...environment };
  delete childEnvironment.SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL;
  delete childEnvironment.SUPPLIER_COMMITMENT_MIGRATION_SCHEMA;
  Object.assign(childEnvironment, environment);
  return spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    env: childEnvironment,
  });
}

test('supplier commitment migration binds procurement and reminder records to one tenant scope', () => {
  assert.match(migration, /PurchaseOrder_organizationId_projectId_supplierId_id_key/);
  assert.match(migration, /SupplierCommitment_purchaseOrder_fkey[\s\S]*?FOREIGN KEY \("organizationId", "projectId", "supplierId", "purchaseOrderId"\)/);
  assert.match(migration, /SupplierInvoice_order_fkey[\s\S]*?FOREIGN KEY \("organizationId", "projectId", "supplierId", "purchaseOrderId"\)/);
  assert.match(migration, /SupplierCommitmentEvent_commitment_fkey[\s\S]*?FOREIGN KEY \("organizationId", "projectId", "commitmentId"\)/);
  assert.match(migration, /GoodsReceiptLine_orderLine_fkey[\s\S]*?FOREIGN KEY \("projectId", "purchaseOrderId", "purchaseOrderLineId"\)/);
  assert.match(schema, /email\s+String\?\s+@db\.VarChar\(254\)/);
});

test('commitment revisions and provider evidence are immutable and fail closed in PostgreSQL', () => {
  for (const trigger of [
    'SupplierCommitment_revision_guard',
    'SupplierCommitment_event_guard',
    'SupplierCommitmentEvent_append_only',
    'SupplierReminderDelivery_transition_guard',
    'SupplierReminderDelivery_no_delete',
    'SupplierReminderDelivery_no_truncate',
    'SupplierReminderWebhookEvent_append_only',
    'SupplierReminderWebhookApplication_append_only',
  ]) {
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
  assert.match(migration, /event\."nextState" = \$5/);
  assert.match(migration, /event\."previousState" IS NOT DISTINCT FROM \$6/);
  assert.match(migration, /SupplierCommitment status transition is invalid/);
  assert.match(migration, /IF NOT \(\(OLD\."status" = 'PENDING'/);
  assert.doesNotMatch(migration, /'PROCESSING'/);
});

test('civil task dates and two-phase dispatch are explicit contracts', () => {
  assert.match(migration, /Task_canonical_startsAt_civil_check/);
  assert.match(migration, /Task_canonical_endsAt_civil_check/);
  assert.match(worker, /FOR UPDATE SKIP LOCKED/);
  assert.match(worker, /"status" = 'CLAIMED'/);
  assert.match(worker, /status: 'DISPATCHING'/);
  assert.match(worker, /lockProjectTransaction\(transaction, claim\.projectId\)/);
  assert.match(worker, /commitment\.scheduleRevision === row\.scheduleRevision/);
  assert.match(worker, /reconcileSupplierReminderWebhooks/);
});

test('public provider routes keep independent authentication and bounded signed ingress', () => {
  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /isAuthorizedCronRequest/);
  assert.match(cronRoute, /limit: 4/);
  assert.match(webhookRoute, /readLimitedRequestBytes/);
  assert.match(webhookRoute, /maxBytes: 256 \* 1024/);
  assert.match(webhookRoute, /verifyResendWebhook/);
  assert.match(webhookRoute, /Cache-Control.*no-store/s);
});

test('migration verifier requires a dedicated, explicitly scoped and TLS-verified database', () => {
  assert.match(verifier, /SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /SUPPLIER_COMMITMENT_MIGRATION_SCHEMA/);
  assert.match(verifier, /does not match the schema declared in the database URL/);
  assert.match(verifier, /\[A-Za-z_\]\[A-Za-z0-9_\$\]\{0,62\}/);
  assert.match(verifier, /hostname\.endsWith\('\.neon\.tech'\)/);
  assert.match(verifier, /searchParams\.set\('sslmode', 'verify-full'\)/);
  assert.match(verifier, /must use sslmode=verify-full for a remote PostgreSQL host/);

  const ignoredFallback = runVerifierPreflight({
    DATABASE_URL: 'postgresql://ignored.invalid/unsafe',
  });
  assert.notEqual(ignoredFallback.status, 0);
  assert.match(ignoredFallback.stderr, /DATABASE_URL is intentionally ignored/);

  const missingSchema = runVerifierPreflight({
    SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL: 'postgresql://user:secret@localhost/database',
  });
  assert.notEqual(missingSchema.status, 0);
  assert.match(missingSchema.stderr, /Declare SUPPLIER_COMMITMENT_MIGRATION_SCHEMA/);

  const schemaMismatch = runVerifierPreflight({
    SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL: 'postgresql://user:secret@localhost/database?schema=tenant_a',
    SUPPLIER_COMMITMENT_MIGRATION_SCHEMA: 'tenant_b',
  });
  assert.notEqual(schemaMismatch.status, 0);
  assert.match(schemaMismatch.stderr, /does not match the schema declared in the database URL/);

  const unsafeSchema = runVerifierPreflight({
    SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL: 'postgresql://user:secret@localhost/database?schema=tenant-a',
  });
  assert.notEqual(unsafeSchema.status, 0);
  assert.match(unsafeSchema.stderr, /safe PostgreSQL identifier/);

  const weakRemoteTls = runVerifierPreflight({
    SUPPLIER_COMMITMENT_MIGRATION_DATABASE_URL: 'postgresql://user:secret@database.example.com/database?schema=public&sslmode=require',
  });
  assert.notEqual(weakRemoteTls.status, 0);
  assert.match(weakRemoteTls.stderr, /must use sslmode=verify-full/);
});

test('migration verifier governs the exact applied contract and rollback-only append-only smoke', () => {
  assert.match(verifier, /expectedMigrationChecksum/);
  assert.match(verifier, /does not match the repository checksum/);
  for (const table of [
    'SupplierCommitment',
    'SupplierCommitmentLine',
    'SupplierCommitmentTaskLink',
    'SupplierCommitmentEvent',
    'SupplierReminderDelivery',
    'SupplierReminderWebhookEvent',
    'SupplierReminderWebhookApplication',
  ]) {
    assert.match(verifier, new RegExp(`'${table}'`));
  }
  for (const trigger of [
    'SupplierCommitment_revision_guard',
    'SupplierCommitment_event_guard',
    'SupplierCommitmentEvent_append_only',
    'SupplierCommitmentEvent_no_truncate',
    'SupplierReminderWebhookEvent_append_only',
    'SupplierReminderWebhookEvent_no_truncate',
    'SupplierReminderWebhookApplication_append_only',
    'SupplierReminderWebhookApplication_no_truncate',
    'SupplierReminderDelivery_no_delete',
    'SupplierReminderDelivery_no_truncate',
    'SupplierReminderDelivery_transition_guard',
  ]) {
    assert.match(verifier, new RegExp(`${trigger}`));
  }
  assert.match(verifier, /trigger\.tgenabled === 'A'/);
  assert.match(verifier, /assertForeignKeys\(client\)/);
  assert.match(verifier, /assertChecks\(client\)/);
  assert.match(verifier, /assertTriggerFunctions\(client\)/);
  assert.match(verifier, /search_path=pg_catalog/);
  assert.match(verifier, /assertRollbackOnlySmoke\(client\)/);
  assert.match(verifier, /SAVEPOINT supplier_commitment_verifier_case/);
  assert.match(verifier, /TRUNCATE TABLE \"SupplierReminderWebhookEvent\" CASCADE/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
});

test('supplier verifier remains composable with additive triggers from later migrations', () => {
  assert.match(verifier, /trigger_record\.tgname = ANY\(\$1::text\[\]\)/);
  assert.match(verifier, /\[names\]/);
  assert.doesNotMatch(
    verifier,
    /relation_record\.relname = ANY\(\$1::text\[\]\)[\s\S]*?\[TABLES\]/,
  );
});
