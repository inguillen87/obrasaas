import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(new URL(
  'prisma/migrations/20260729133000_worker_payment_flow_reconciliation/migration.sql',
  root,
), 'utf8');

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('reconciliation schema retains opaque operation and database-owned outcome evidence', () => {
  const session = model('WorkerPaymentFlowSession');
  const destination = model('WorkerPaymentDestination');

  assert.match(
    schema,
    /enum WorkerPaymentFlowReconciliationMethod\s*\{\s*OPERATION_PROVENANCE_V1\s*\}/,
  );
  assert.match(session, /expectedPrivacyOperationKey\s+String\?\s+@db\.VarChar\(190\)/);
  assert.match(session, /expectedDestinationOperationKey\s+String\?\s+@db\.VarChar\(190\)/);
  assert.match(session, /expectedDestinationType\s+WorkerPaymentDestinationType\?/);
  assert.match(session, /expectedDestinationFingerprintKeyId\s+String\?\s+@db\.VarChar\(100\)/);
  assert.match(session, /expectedDestinationFingerprint\s+String\?\s+@db\.Char\(64\)/);
  assert.match(session, /submissionReconciledAt\s+DateTime\?/);
  assert.match(
    session,
    /reconciliationMethod\s+WorkerPaymentFlowReconciliationMethod\?/,
  );
  assert.match(destination, /flowSubmissionReservationId\s+String\?\s+@unique\s+@db\.Uuid/);
  assert.match(destination, /flowSubmissionFingerprintKeyId\s+String\?\s+@db\.VarChar\(64\)/);
  assert.match(destination, /flowSubmissionFingerprintHmac\s+String\?\s+@db\.Char\(64\)/);
  assert.match(
    destination,
    /@relation\("WorkerPaymentFlowReservation", fields: \[flowSubmissionReservationId\], references: \[submissionReservationId\], onDelete: Restrict, onUpdate: Cascade/,
  );

  for (const forbidden of ['destinationValue', 'holderCuil', 'cbu', 'cvu', 'alias']) {
    assert.doesNotMatch(session, new RegExp(`^\\s+${forbidden}\\s+`, 'mi'));
  }
});

test('migration refuses an unsafe partial rollout and makes reservation proof one-to-one', () => {
  assert.match(migration, /^BEGIN;/);
  assert.match(
    migration,
    /WHERE "submissionStatus" <> 'OPEN'[\s\S]*worker payment Flow reconciliation requires an unopened H4 dataset[\s\S]*ERRCODE = '55000'/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "WorkerPaymentDestination_flowSubmissionReservationId_key"[\s\S]*"flowSubmissionReservationId"/,
  );
  assert.match(
    migration,
    /CONSTRAINT "WorkerPayment_flow_reservation_fkey"[\s\S]*REFERENCES "WorkerPaymentFlowSession"\("submissionReservationId"\)[\s\S]*ON DELETE RESTRICT ON UPDATE CASCADE/,
  );
  assert.match(
    migration,
    /CONSTRAINT "WorkerPayment_flow_provenance_shape_check"[\s\S]*"flowSubmissionFingerprintKeyId" ~ '\^\[A-Za-z0-9\][\s\S]*"flowSubmissionFingerprintHmac" ~ '\^\[0-9a-f\]\{64\}\$'[\s\S]*"submissionSource" = 'WORKER_CHANNEL'/,
  );
  assert.match(migration, /COMMIT;\s*$/);
});

test('every reserved state pins purpose and exact operation keys without relaxing normal success', () => {
  for (const status of ['PROCESSING', 'SUCCEEDED', 'UNCERTAIN']) {
    const branch = new RegExp(
      `"submissionStatus" = '${status}'([\\s\\S]*?)(?=\\n\\s*\\)\\n\\s*OR|\\n\\s*\\)\\n\\s*\\);)`,
    ).exec(migration)?.[1] || '';
    assert.match(branch, /"paymentPurpose" IS NOT NULL/, status);
    assert.match(branch, /"expectedPrivacyOperationKey" ~ '\^wpc:\[0-9a-f\]\{64\}\$'/, status);
    assert.match(
      branch,
      /"expectedDestinationOperationKey" ~ '\^wp:submit:\[0-9a-f\]\{64\}\$'/,
      status,
    );
  }

  assert.match(
    migration,
    /"submissionStatus" = 'SUCCEEDED'[\s\S]*"submissionUncertainAt" IS NULL[\s\S]*"submissionReconciledAt" IS NULL[\s\S]*"reconciliationMethod" IS NULL/,
  );
  assert.match(
    migration,
    /"submissionStatus" = 'SUCCEEDED'[\s\S]*"submissionUncertainAt" IS NOT NULL[\s\S]*"submissionReconciledAt" >= "submissionUncertainAt"[\s\S]*"reconciliationMethod" = 'OPERATION_PROVENANCE_V1'/,
  );
});

test('destination provenance is admitted only from the exact locked PROCESSING companion', () => {
  assert.match(
    migration,
    /CREATE TRIGGER "WorkerPaymentDestination_flow_provenance_guard"[\s\S]*BEFORE INSERT OR UPDATE/,
  );
  assert.match(
    migration,
    /ENABLE ALWAYS TRIGGER "WorkerPaymentDestination_flow_provenance_guard"/,
  );
  assert.match(migration, /FOR KEY SHARE OF payment_session, choice/);
  assert.match(migration, /flow_provenance\.session_status IS DISTINCT FROM 'PROCESSING'/);
  assert.match(
    migration,
    /session_fingerprint_key_id IS DISTINCT FROM NEW\."flowSubmissionFingerprintKeyId"/,
  );
  assert.match(
    migration,
    /session_fingerprint_hmac IS DISTINCT FROM NEW\."flowSubmissionFingerprintHmac"/,
  );
  assert.match(
    migration,
    /session_destination_type IS DISTINCT FROM NEW\."type"::text[\s\S]*session_destination_fingerprint_key_id IS DISTINCT FROM NEW\."fingerprintKeyId"[\s\S]*session_destination_fingerprint IS DISTINCT FROM NEW\."fingerprint"/,
  );
  assert.match(
    migration,
    /session_destination_operation_key IS DISTINCT FROM NEW\."operationKey"/,
  );
  assert.match(
    migration,
    /session_privacy_operation_key IS DISTINCT FROM flow_provenance\.privacy_operation_key/,
  );
  assert.match(migration, /worker payment destination Flow provenance is immutable/);
  assert.match(
    migration,
    /flow_provenance_added :=[\s\S]*'flowSubmissionReservationId'[\s\S]*'flowSubmissionFingerprintKeyId'[\s\S]*'flowSubmissionFingerprintHmac'/,
  );
});

test('UNCERTAIN can only reconcile to exact SUCCEEDED provenance and keeps its uncertainty history', () => {
  assert.match(
    migration,
    /OLD\."submissionStatus" = 'UNCERTAIN'[\s\S]*NEW\."submissionStatus" = 'SUCCEEDED'[\s\S]*NEW\."submissionUncertainAt" IS NOT DISTINCT FROM OLD\."submissionUncertainAt"/,
  );
  assert.match(
    migration,
    /NEW\."submissionReconciledAt" := statement_timestamp\(\)[\s\S]*NEW\."reconciliationMethod" := 'OPERATION_PROVENANCE_V1'/,
  );
  assert.match(
    migration,
    /ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_00_reconciliation_clock"/,
  );
  for (const exactProof of [
    'destination_operation_key IS DISTINCT FROM NEW."expectedDestinationOperationKey"',
    'destination_type IS DISTINCT FROM NEW."expectedDestinationType"::text',
    'destination_value_fingerprint_key_id IS DISTINCT FROM NEW."expectedDestinationFingerprintKeyId"',
    'destination_value_fingerprint IS DISTINCT FROM NEW."expectedDestinationFingerprint"',
    'destination_reservation_id IS DISTINCT FROM NEW."submissionReservationId"',
    'destination_fingerprint_key_id IS DISTINCT FROM NEW."submissionFingerprintKeyId"',
    'destination_fingerprint_hmac IS DISTINCT FROM NEW."submissionFingerprintHmac"',
    'privacy_operation_key IS DISTINCT FROM NEW."expectedPrivacyOperationKey"',
    'privacy_channel_identity_id IS DISTINCT FROM NEW."channelIdentityId"',
    'privacy_decided_at IS DISTINCT FROM NEW."submittedAt"',
  ]) {
    assert.ok(migration.includes(exactProof), exactProof);
  }
  assert.doesNotMatch(migration, /success_provenance\.destination_status NOT IN/);
  assert.match(
    migration,
    /CREATE INDEX "WorkerPaymentFlowSession_uncertain_reconcile_idx"[\s\S]*"submissionStatus", "submissionUncertainAt", "flowSessionId"/,
  );
  assert.doesNotMatch(migration, /OLD\."submissionStatus" = 'UNCERTAIN'[\s\S]{0,180}NEW\."submissionStatus" = 'PROCESSING'/);
});
