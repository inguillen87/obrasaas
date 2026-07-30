import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(new URL(
  'prisma/migrations/20260729130000_worker_payment_privacy_choices/migration.sql',
  root,
), 'utf8');
const validation = await readFile(new URL(
  'prisma/migrations/20260729131000_worker_payment_privacy_choices_validate/migration.sql',
  root,
), 'utf8');
const sessionMigration = await readFile(new URL(
  'prisma/migrations/20260729132000_worker_payment_flow_sessions/migration.sql',
  root,
), 'utf8');

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('privacy choices are typed append-only evidence without financial identifiers', () => {
  const choice = model('WorkerPrivacyChoiceEvent');
  assert.match(schema, /enum WorkerPrivacyChoicePurpose\s*\{\s*PAYMENT_DESTINATION_CAPTURE\s*\}/);
  assert.match(schema, /enum WorkerPrivacyChoiceChannel[\s\S]*TENANT_DASHBOARD[\s\S]*WHATSAPP_FLOW/);
  assert.match(schema, /enum WorkerPrivacyChoiceAction[\s\S]*ADMIN_ATTESTED[\s\S]*WORKER_ACKNOWLEDGED/);
  for (const field of [
    'organizationId',
    'personId',
    'purpose',
    'paymentPurpose',
    'channel',
    'action',
    'noticeVersion',
    'noticeContentSha256',
    'presentedAt',
    'decidedAt',
    'operationKey',
    'requestFingerprint',
  ]) {
    assert.match(choice, new RegExp(`^\\s+${field}\\s+`, 'm'));
  }
  assert.doesNotMatch(choice, /^\s+(?:cuil|cbu|cvu|alias|holderName|financialValue)\s+/mi);
  assert.doesNotMatch(choice, /^\s+updatedAt\s+/m);

  assert.match(migration, /CREATE TRIGGER "WorkerPrivacyChoiceEvent_append_only"[\s\S]*BEFORE UPDATE OR DELETE/);
  assert.match(migration, /CREATE TRIGGER "WorkerPrivacyChoiceEvent_authorize_insert"[\s\S]*BEFORE INSERT/);
  assert.match(migration, /NEW\."decidedAt" := observed_at[\s\S]*NEW\."createdAt" := observed_at/);
  assert.match(migration, /"identityStatus" = ''VERIFIED''/);
  assert.match(migration, /"tenantRole" IN \(''ADMIN'', ''FINANCE''\)/);
  assert.match(migration, /"provider" = ''WHATSAPP''[\s\S]*"status" = ''VERIFIED''[\s\S]*"revokedAt" IS NULL/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPrivacyChoiceEvent_authorize_insert"/);
  assert.match(migration, /CREATE TRIGGER "WorkerPrivacyChoiceEvent_no_truncate"[\s\S]*BEFORE TRUNCATE/);
  assert.match(migration, /ERRCODE = '55000'/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPrivacyChoiceEvent_append_only"/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPrivacyChoiceEvent_no_truncate"/);
});

test('destinations preserve rollout-compatible legacy provenance and validate attested evidence', () => {
  const destination = model('WorkerPaymentDestination');
  assert.match(destination, /submissionContractVersion\s+WorkerPaymentSubmissionContractVersion\s+@default\(LEGACY_REATTESTATION_REQUIRED\)/);
  assert.match(destination, /privacyChoiceEventId\s+String\?\s+@unique/);
  assert.match(destination, /fields: \[organizationId, personId, purpose, privacyChoiceEventId\][\s\S]*references: \[organizationId, personId, paymentPurpose, id\]/);

  assert.match(migration, /ADD COLUMN "submissionContractVersion"[\s\S]*NOT NULL DEFAULT 'LEGACY_REATTESTATION_REQUIRED'/);
  assert.match(migration, /Expand-compatible rollout:[\s\S]*previous instance has drained/);
  assert.doesNotMatch(migration, /TG_OP = 'INSERT'[\s\S]*New worker payment destinations require an attested privacy choice/);
  assert.match(migration, /WorkerPayment_privacy_choice_scope_fkey[\s\S]*REFERENCES "WorkerPrivacyChoiceEvent"\("organizationId", "personId", "paymentPurpose", "id"\)/);
  assert.match(migration, /choice_record\."actorMembershipId" = NEW\."submittedByMembershipId"/);
  assert.match(migration, /choice_record\."channelIdentityId" = NEW\."submittedByChannelIdentityId"/);
});

test('legacy rows cannot become usable and destination mutation stays governed', () => {
  assert.match(migration, /NEW\."submissionContractVersion" = 'LEGACY_REATTESTATION_REQUIRED'[\s\S]*NEW\."status" IN \('VERIFIED', 'ACTIVE'\)[\s\S]*ERRCODE = '55000'/);
  assert.doesNotMatch(migration, /NEW\."status" IN \('VERIFIED', 'ACTIVE', 'SUPERSEDED'\)/);
  assert.match(migration, /OLD\."status" = NEW\."status"[\s\S]*OLD\."status" IN \('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE'\)/);
  assert.match(migration, /OLD\."status" = 'ACTIVE'[\s\S]*choice_record\."channel" <> 'WHATSAPP_FLOW'/);
  assert.doesNotMatch(validation, /WorkerPayment_attested_state_check/);

  assert.match(migration, /CREATE TRIGGER "WorkerPayment_destination_guard"[\s\S]*BEFORE UPDATE/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPayment_destination_guard"/);
  assert.match(migration, /OLD\."status" = 'PENDING_VERIFICATION' AND NEW\."status" = 'VERIFIED'/);
  assert.match(migration, /OLD\."status" = 'VERIFIED' AND NEW\."status" = 'ACTIVE'/);
  assert.match(migration, /OLD\."status" = 'ACTIVE' AND NEW\."status" = 'SUPERSEDED'/);
  assert.match(migration, /Worker payment destination immutable fields changed/);
  assert.match(migration, /CREATE TRIGGER "WorkerPaymentDestination_no_delete"[\s\S]*BEFORE DELETE/);
  assert.match(migration, /CREATE TRIGGER "WorkerPaymentDestination_no_truncate"[\s\S]*BEFORE TRUNCATE/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPaymentDestination_no_delete"/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPaymentDestination_no_truncate"/);
  assert.match(migration, /cannot be deleted or truncated; revoke it instead/);
  for (const segment of [1, 2, 3, 4]) {
    assert.match(
      migration,
      new RegExp(`split_part\\(OLD\\."encryptedPayload", '\\.', ${segment}\\) <> split_part\\(NEW\\."encryptedPayload", '\\.', ${segment}\\)`),
    );
  }
});

test('payment Flow companions can only be inserted in the unopened initial state', () => {
  assert.match(
    sessionMigration,
    /TG_OP = 'INSERT'[\s\S]*NEW\."submissionStatus" IS DISTINCT FROM 'OPEN'[\s\S]*NEW\."privacyPresentedAt" IS NOT NULL[\s\S]*NEW\."revision" <> 0[\s\S]*ERRCODE = '55000'/,
  );
  assert.match(
    sessionMigration,
    /CREATE TRIGGER "WorkerPaymentFlowSession_scope_guard"[\s\S]*BEFORE INSERT OR UPDATE/,
  );
  assert.match(
    sessionMigration,
    /ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_scope_guard"/,
  );
  assert.match(
    sessionMigration,
    /JOIN %1\$I\."Project" project[\s\S]*project\."status" = ''ACTIVE''/,
  );
  assert.match(
    sessionMigration,
    /observed_at := statement_timestamp\(\)[\s\S]*observed_at >= base_session\."expiresAt"[\s\S]*NEW\."privacyPresentedAt" := observed_at/,
  );
  assert.match(
    sessionMigration,
    /observed_at \+ INTERVAL '1 minute' >= base_session\."expiresAt"[\s\S]*worker payment Flow reservation requires a safe live delivery window/,
  );
});
