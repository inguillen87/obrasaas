import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(new URL(
  'prisma/migrations/20260729134000_worker_payment_private_receipts/migration.sql',
  root,
), 'utf8');

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

function createdTableColumns(tableName) {
  const start = migration.indexOf(`CREATE TABLE "${tableName}" (`);
  const end = migration.indexOf('\n  CONSTRAINT ', start);
  assert.notEqual(start, -1, `Missing SQL table ${tableName}.`);
  assert.notEqual(end, -1, `Missing SQL constraints for ${tableName}.`);
  return [...migration.slice(start, end).matchAll(/^\s+"([A-Za-z][A-Za-z0-9]+)"\s+/gm)]
    .map((match) => match[1]);
}

test('private receipt schema is privacy-minimal and exactly tenant/subject scoped', () => {
  const session = model('WorkerPaymentFlowSession');
  const receipt = model('WorkerPaymentPrivateReceipt');

  assert.match(session, /receiptDeliveryRequested\s+Boolean\s+@default\(false\)/);
  assert.match(session, /privateReceipt\s+WorkerPaymentPrivateReceipt\?/);
  assert.match(receipt, /^\s+id\s+String\s+@id\s+@db\.Uuid/m);
  assert.match(receipt, /flowSessionId\s+String\s+@unique\s+@db\.Uuid/);
  assert.match(
    receipt,
    /flowSession\s+WorkerPaymentFlowSession\s+@relation\(fields: \[flowSessionId\], references: \[flowSessionId\], onDelete: Restrict/,
  );
  assert.match(
    receipt,
    /worker\s+Worker\s+@relation\("WorkerPaymentPrivateReceiptWorker", fields: \[organizationId, personId, projectId, workerId\], references: \[organizationId, personId, projectId, id\], onDelete: Restrict/,
  );
  assert.match(
    receipt,
    /destination\s+WorkerPaymentDestination\s+@relation\(fields: \[organizationId, personId, paymentPurpose, destinationId\], references: \[organizationId, personId, purpose, id\], onDelete: Restrict/,
  );
  assert.match(
    receipt,
    /sourceWebhookEvent\s+WebhookEvent\s+@relation\(fields: \[projectId, sourceWebhookEventId\], references: \[projectId, id\], onDelete: Restrict/,
  );
  for (const field of [
    'organizationId',
    'projectId',
    'connectionId',
    'flowSessionId',
    'workerId',
    'personId',
    'channelIdentityId',
    'paymentPurpose',
    'destinationId',
    'sourceWebhookEventId',
    'destinationType',
    'destinationLastFour',
    'receivedAt',
    'contentVersion',
    'contentSha256',
    'tokenHash',
    'issuedAt',
    'expiresAt',
    'accessCount',
    'firstAccessedAt',
    'lastAccessedAt',
    'revokedAt',
  ]) {
    assert.match(receipt, new RegExp(`^\\s+${field}\\s+`, 'm'), field);
  }
  for (const forbidden of [
    'encryptedPayload',
    'financialValue',
    'destinationValue',
    'holderName',
    'holderCuil',
    'cuil',
    'cbu',
    'cvu',
    'alias',
    'rawToken',
    'providerPayload',
  ]) {
    assert.doesNotMatch(receipt, new RegExp(`^\\s+${forbidden}\\s+`, 'mi'));
  }
});

test('migration persists only the safe receipt allowlist and fixes a 15 minute capability TTL', () => {
  assert.match(migration, /^BEGIN;/);
  assert.match(
    migration,
    /worker payment private receipt migration requires an unopened H4 dataset[\s\S]*ERRCODE = '55000'/,
  );
  assert.match(
    migration,
    /ADD COLUMN "receiptDeliveryRequested" BOOLEAN NOT NULL DEFAULT false/,
  );

  assert.deepEqual(createdTableColumns('WorkerPaymentPrivateReceipt'), [
    'id',
    'contentVersion',
    'organizationId',
    'projectId',
    'connectionId',
    'flowSessionId',
    'workerId',
    'personId',
    'channelIdentityId',
    'paymentPurpose',
    'destinationId',
    'sourceWebhookEventId',
    'destinationType',
    'destinationLastFour',
    'receivedAt',
    'contentSha256',
    'tokenHash',
    'issuedAt',
    'expiresAt',
    'accessCount',
    'firstAccessedAt',
    'lastAccessedAt',
    'revokedAt',
  ]);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "WorkerPaymentPrivateReceipt_flowSessionId_key"[\s\S]*\("flowSessionId"\)/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "WorkerPaymentPrivateReceipt_tokenHash_key"[\s\S]*\("tokenHash"\)/,
  );
  assert.match(
    migration,
    /"expiresAt" = "issuedAt" \+ INTERVAL '15 minutes'/,
  );
  assert.match(migration, /"contentSha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"tokenHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(
    migration,
    /"destinationType"::text IN \('CBU', 'CVU'\)[\s\S]*"destinationLastFour" ~ '\^\[0-9\]\{4\}\$'/,
  );
  assert.match(
    migration,
    /"destinationType"::text = 'ALIAS'[\s\S]*"destinationLastFour" ~ '\^\[a-z0-9\.\-\]\{4\}\$'/,
  );
  assert.match(
    migration,
    /"accessCount" = 0[\s\S]*"firstAccessedAt" IS NULL[\s\S]*"lastAccessedAt" IS NULL/,
  );
  assert.match(
    migration,
    /"accessCount" > 0[\s\S]*"firstAccessedAt" >= "issuedAt"[\s\S]*"lastAccessedAt" < "expiresAt"/,
  );
});

test('receipt insert requires one exact SUCCEEDED companion, consumed base, destination and webhook', () => {
  assert.match(
    migration,
    /CREATE TRIGGER "WorkerPaymentPrivateReceipt_insert_guard"[\s\S]*BEFORE INSERT ON "WorkerPaymentPrivateReceipt"/,
  );
  assert.match(
    migration,
    /FROM %1\$I\."WorkerPaymentFlowSession" payment_session[\s\S]*JOIN %1\$I\."WhatsAppFlowSession" base_session[\s\S]*JOIN %1\$I\."WorkerPaymentDestination" destination[\s\S]*JOIN %1\$I\."WebhookEvent" webhook_event/,
  );
  assert.match(
    migration,
    /FOR KEY SHARE OF payment_session, base_session, destination, webhook_event/,
  );
  for (const proof of [
    "provenance.submission_status IS DISTINCT FROM 'SUCCEEDED'",
    'provenance.receipt_delivery_requested IS DISTINCT FROM true',
    'provenance.organization_id IS DISTINCT FROM NEW."organizationId"',
    'provenance.project_id IS DISTINCT FROM NEW."projectId"',
    'provenance.connection_id IS DISTINCT FROM NEW."connectionId"',
    'provenance.worker_id IS DISTINCT FROM NEW."workerId"',
    'provenance.person_id IS DISTINCT FROM NEW."personId"',
    'provenance.channel_identity_id IS DISTINCT FROM NEW."channelIdentityId"',
    'provenance.destination_id IS DISTINCT FROM NEW."destinationId"',
    'provenance.submitted_at IS DISTINCT FROM NEW."receivedAt"',
    'provenance.base_consumed_at IS NULL',
    'provenance.destination_type IS DISTINCT FROM NEW."destinationType"::text',
    'provenance.destination_last_four IS DISTINCT FROM NEW."destinationLastFour"',
    'provenance.webhook_event_id IS DISTINCT FROM NEW."sourceWebhookEventId"',
    "provenance.webhook_provider IS DISTINCT FROM 'meta'",
    "provenance.webhook_event_type IS DISTINCT FROM 'message'",
    "provenance.webhook_status IS DISTINCT FROM 'PROCESSING'",
    "provenance.webhook_external_id IS DISTINCT FROM",
    "'project:' || NEW.\"projectId\" || ':' || provenance.base_consumed_external_id",
    'provenance.webhook_applied_at IS NOT NULL',
    "octet_length('obrasaas:worker-payment-private-receipt-content:v1')",
    "sha256(convert_to(content_commitment, 'UTF8'))",
    'NEW."contentSha256" IS DISTINCT FROM expected_content_sha256',
    'worker payment private receipt content hash is invalid',
  ]) {
    assert.ok(migration.includes(proof), proof);
  }
  assert.match(
    migration,
    /observed_at := statement_timestamp\(\)[\s\S]*NEW\."expiresAt" IS DISTINCT FROM NEW\."issuedAt" \+ INTERVAL '15 minutes'/,
  );
});

test('an OPEN to OPEN update cannot change receiptDeliveryRequested', () => {
  const guard = /CREATE OR REPLACE FUNCTION enforce_worker_payment_receipt_request\(\)([\s\S]*?)\n\$\$;/.exec(
    migration,
  )?.[1] || '';
  assert.match(
    guard,
    /OLD\."receiptDeliveryRequested"[\s\S]*IS DISTINCT FROM NEW\."receiptDeliveryRequested"/,
  );
  assert.match(
    guard,
    /AND NOT \([\s\S]*OLD\."submissionStatus" = 'OPEN'[\s\S]*AND NEW\."submissionStatus" = 'PROCESSING'[\s\S]*\)/,
  );
  assert.match(
    guard,
    /worker payment receipt delivery choice is immutable after reservation[\s\S]*ERRCODE = '55000'/,
  );
  assert.doesNotMatch(
    guard,
    /OLD\."submissionStatus" IN \('PROCESSING', 'SUCCEEDED', 'UNCERTAIN'\)/,
  );
});

test('receipt choice, access, revocation and removal remain database-governed', () => {
  assert.match(
    migration,
    /TG_OP = 'INSERT' AND NEW\."receiptDeliveryRequested" IS DISTINCT FROM false/,
  );
  assert.match(
    migration,
    /OLD\."receiptDeliveryRequested"[\s\S]*IS DISTINCT FROM NEW\."receiptDeliveryRequested"[\s\S]*AND NOT \([\s\S]*OLD\."submissionStatus" = 'OPEN'[\s\S]*NEW\."submissionStatus" = 'PROCESSING'[\s\S]*\)/,
  );
  assert.match(
    migration,
    /NEW\."accessCount" = OLD\."accessCount" \+ 1[\s\S]*OLD\."revokedAt" IS NOT NULL[\s\S]*OLD\."accessCount" >= 5[\s\S]*observed_at >= OLD\."expiresAt"[\s\S]*NEW\."firstAccessedAt" := COALESCE\(OLD\."firstAccessedAt", observed_at\)[\s\S]*NEW\."lastAccessedAt" := observed_at/,
  );
  assert.match(
    migration,
    /OLD\."revokedAt" IS NULL[\s\S]*NEW\."revokedAt" IS NOT NULL[\s\S]*NEW\."revokedAt" := observed_at/,
  );
  assert.match(
    migration,
    /WorkerPaymentPrivateReceipt_no_delete[\s\S]*BEFORE DELETE/,
  );
  assert.match(
    migration,
    /WorkerPaymentPrivateReceipt_no_truncate[\s\S]*BEFORE TRUNCATE/,
  );
  for (const trigger of [
    'WorkerPaymentFlowSession_receipt_request_guard',
    'WorkerPaymentPrivateReceipt_insert_guard',
    'WorkerPaymentPrivateReceipt_lifecycle_guard',
    'WorkerPaymentPrivateReceipt_no_delete',
    'WorkerPaymentPrivateReceipt_no_truncate',
  ]) {
    assert.match(
      migration,
      new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`),
      trigger,
    );
  }
  assert.match(migration, /COMMIT;\s*$/);
});
