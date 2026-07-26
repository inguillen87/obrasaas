import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationNames = [
  '20260724330000_worker_identity_scope_indexes',
  '20260724330050_worker_identity_channel_scope_index',
  '20260724330100_worker_identity_onboarding_payments',
  '20260724330200_worker_identity_worker_index',
  '20260724330250_worker_identity_worker_scope_index',
  '20260724330300_worker_identity_worker_constraints',
  '20260724330400_worker_identity_validate_worker_constraints',
  '20260724330500_worker_membership_scope_index',
  '20260724330550_worker_person_project_unique_index',
  '20260724330600_worker_sensitive_decision_controls',
  '20260724330700_worker_sensitive_decision_validate',
];
const migrations = migrationNames.map((name) => readFileSync(
  new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
  'utf8',
));
const migrationSql = migrations.join('\n');
const initialMigrationSql = migrations.slice(0, 7).join('\n');
const hardeningSql = migrations[9];
const hardeningValidationSql = migrations[10];

function modelBody(name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('worker identity models persist only encrypted identifiers and tenant-scoped hashes', () => {
  const person = modelBody('WorkerPerson');
  const channel = modelBody('WorkerChannelIdentity');
  const claim = modelBody('WorkerOnboardingClaim');
  const payment = modelBody('WorkerPaymentDestination');

  assert.match(person, /encryptedIdentityPayload\s+String\?/);
  assert.match(person, /cuilFingerprint\s+String\?/);
  assert.match(person, /cuilFingerprintKeyId\s+String\?/);
  assert.doesNotMatch(person, /^\s+(?:cuil|givenNames|familyName|legalName)\s+/m);

  assert.match(channel, /encryptedAddressPayload\s+String/);
  assert.match(channel, /addressFingerprint\s+String/);
  assert.match(channel, /addressFingerprintKeyId\s+String/);
  assert.match(channel, /providerSubjectFingerprintKeyId\s+String\?/);
  assert.doesNotMatch(channel, /^\s+(?:phone|address|providerSubject)\s+/m);

  assert.match(claim, /senderEncryptedPayload\s+String/);
  assert.match(claim, /claimTokenHash\s+String/);
  assert.match(claim, /senderFingerprintKeyId\s+String/);
  assert.match(claim, /claimedCuilFingerprintKeyId\s+String\?/);
  assert.doesNotMatch(claim, /^\s+(?:senderPhone|claimToken|givenNames|familyName|cuil)\s+/m);

  assert.match(payment, /encryptedPayload\s+String/);
  assert.match(payment, /holderCuilFingerprint\s+String/);
  assert.match(payment, /fingerprintKeyId\s+String/);
  assert.match(payment, /holderCuilFingerprintKeyId\s+String/);
  assert.doesNotMatch(payment, /^\s+(?:value|holderName|holderCuil|cbu|cvu|alias)\s+/m);
  assert.match(schema, /enum WorkerPaymentDestinationType \{[\s\S]*?CBU[\s\S]*?CVU[\s\S]*?ALIAS[\s\S]*?\}/);
});

test('migration chain is expand-only and keeps legacy Worker writes compatible', () => {
  assert.doesNotMatch(initialMigrationSql, /\b(?:DROP|RENAME)\b/i);
  assert.doesNotMatch(migrationSql, /ALTER\s+COLUMN[\s\S]*?SET\s+NOT\s+NULL/i);
  assert.match(migrations[0], /CREATE UNIQUE INDEX CONCURRENTLY "Project_organizationId_id_key"/);
  assert.match(migrations[1], /CREATE UNIQUE INDEX CONCURRENTLY "WhatsAppConnection_projectId_id_key"/);
  assert.match(migrations[2], /ADD COLUMN "organizationId" TEXT,\s*ADD COLUMN "personId" TEXT;/);
  assert.match(migrations[3], /CREATE INDEX CONCURRENTLY "Worker_organizationId_personId_idx"/);
  assert.match(migrations[4], /CREATE UNIQUE INDEX CONCURRENTLY "Worker_org_person_project_id_key"/);
  assert.match(migrations[5], /NOT VALID/);
  assert.match(migrations[6], /VALIDATE CONSTRAINT "Worker_organizationId_projectId_fkey"/);
  assert.match(migrations[7], /CREATE UNIQUE INDEX CONCURRENTLY "TenantMembership_organizationId_id_key"/);
  assert.match(migrations[8], /CREATE UNIQUE INDEX CONCURRENTLY "Worker_one_person_per_project_idx"[\s\S]*?WHERE "personId" IS NOT NULL/);
  assert.match(hardeningSql, /ALTER COLUMN "phone" DROP NOT NULL/);
  assert.match(hardeningSql, /Worker_person_scope_restrict_fkey[\s\S]*?ON DELETE RESTRICT[\s\S]*?NOT VALID/);
  assert.match(hardeningValidationSql, /VALIDATE CONSTRAINT "Worker_person_scope_restrict_fkey"[\s\S]*?DROP CONSTRAINT "Worker_organizationId_personId_fkey"[\s\S]*?RENAME CONSTRAINT "Worker_person_scope_restrict_fkey"/);
  for (const migration of [migrations[0], migrations[1], migrations[3], migrations[4]]) {
    assert.equal((migration.match(/CREATE (?:UNIQUE )?INDEX CONCURRENTLY/g) || []).length, 1);
  }
  for (const migration of [migrations[7], migrations[8]]) {
    assert.equal((migration.match(/CREATE (?:UNIQUE )?INDEX CONCURRENTLY/g) || []).length, 1);
  }
});

test('database constraints enforce tenant scope and safe lifecycle slots', () => {
  assert.match(migrationSql, /FOREIGN KEY \("organizationId", "projectId"\) REFERENCES "Project"\("organizationId", "id"\)/);
  assert.match(migrationSql, /FOREIGN KEY \("projectId", "connectionId"\) REFERENCES "WhatsAppConnection"\("projectId", "id"\)/);
  assert.match(migrationSql, /FOREIGN KEY \("organizationId", "personId"\) REFERENCES "WorkerPerson"\("organizationId", "id"\)/);
  assert.match(migrationSql, /FOREIGN KEY \("organizationId", "resolvedPersonId", "resolvedChannelIdentityId"\) REFERENCES "WorkerChannelIdentity"\("organizationId", "personId", "id"\)/);
  assert.match(migrationSql, /FOREIGN KEY \("organizationId", "resolvedPersonId", "projectId", "resolvedWorkerId"\)[\s\S]*?REFERENCES "Worker"\("organizationId", "personId", "projectId", "id"\)/);
  assert.match(migrationSql, /FOREIGN KEY \("organizationId", "personId", "purpose", "previousDestinationId"\) REFERENCES "WorkerPaymentDestination"\("organizationId", "personId", "purpose", "id"\)/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "WorkerOnboardingClaim_openClaimKey_key"/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "WorkerClaim_one_open_per_sender_idx"[\s\S]*?WHERE "status" IN \('PENDING', 'SUBMITTED'\)/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "WorkerPaymentDestination_activeSlot_key"/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "WorkerPayment_one_active_per_purpose_idx"[\s\S]*?WHERE "status" = 'ACTIVE'/);
  assert.match(migrationSql, /"WorkerPerson"\("organizationId", "cuilFingerprintKeyId", "cuilFingerprint"\)/);
  assert.match(migrationSql, /"WorkerChannelIdentity"\("organizationId", "provider", "addressFingerprintKeyId", "addressFingerprint"\)/);
  assert.match(migrationSql, /"WorkerOnboardingClaim"\("projectId", "senderFingerprintKeyId", "senderFingerprint"\)/);
  assert.match(migrationSql, /"WorkerPaymentDestination"\("organizationId", "personId", "purpose", "type", "fingerprintKeyId", "fingerprint"\)/);
  assert.match(migrationSql, /"status" = 'ACTIVE'[\s\S]*?"activeSlot" IS NOT NULL/);
  assert.match(migrationSql, /"status" IN \('EXPIRED', 'CANCELLED'\)[\s\S]*?"openClaimKey" IS NULL/);
});

test('sensitive decisions are tenant-scoped, idempotent, and append-only', () => {
  const membership = modelBody('TenantMembership');
  const ledger = modelBody('WorkerSensitiveDecision');

  assert.match(membership, /@@unique\(\[organizationId, id\], map: "TenantMembership_organizationId_id_key"\)/);
  assert.match(ledger, /actorMembership\s+TenantMembership\s+@relation\("WorkerSensitiveDecisionActor", fields: \[organizationId, actorMembershipId\], references: \[organizationId, id\], onDelete: Restrict/);
  assert.match(ledger, /action\s+WorkerSensitiveDecisionAction/);
  assert.match(ledger, /policyVersion\s+String/);
  assert.match(ledger, /evidenceHash\s+String/);
  assert.match(ledger, /operationKey\s+String/);
  assert.match(ledger, /requestFingerprint\s+String/);
  assert.doesNotMatch(ledger, /^\s+updatedAt\s+/m);
  assert.match(hardeningSql, /WSD_exact_subject_check/);
  assert.match(hardeningSql, /CREATE TRIGGER "WorkerSensitiveDecision_append_only"[\s\S]*?BEFORE UPDATE OR DELETE/);
  assert.match(hardeningSql, /CREATE TRIGGER "WorkerSensitiveDecision_no_truncate"[\s\S]*?BEFORE TRUNCATE/);
  assert.match(hardeningSql, /"WorkerSensitiveDecision"\("organizationId", "operationKey"\)/);
});

test('identity, onboarding, and payment decisions bind tenant memberships and evidence', () => {
  const person = modelBody('WorkerPerson');
  const claim = modelBody('WorkerOnboardingClaim');
  const payment = modelBody('WorkerPaymentDestination');

  assert.match(person, /identityVerifiedByMembershipId\s+String\?/);
  assert.match(person, /identityRejectedByMembershipId\s+String\?/);
  assert.match(person, /identityDecisionEvidenceHash\s+String\?/);
  assert.match(claim, /reviewedByMembershipId\s+String\?/);
  assert.match(claim, /reviewEvidenceHash\s+String\?/);
  assert.match(hardeningSql, /WorkerPerson_identity_decision_actor_check[\s\S]*?identityDecisionEvidenceHash/);
  assert.match(hardeningSql, /WorkerClaim_review_actor_check[\s\S]*?reviewEvidenceHash/);

  for (const field of [
    'submissionSource',
    'submittedByMembershipId',
    'submittedByChannelIdentityId',
    'verifiedByMembershipId',
    'activatedByMembershipId',
    'activatedAt',
    'rejectedByMembershipId',
    'revokedByMembershipId',
  ]) {
    assert.match(payment, new RegExp(`^\\s+${field}\\s+`, 'm'));
  }
  assert.match(hardeningSql, /WorkerPayment_submission_actor_check/);
  assert.match(hardeningSql, /WorkerPayment_decision_actor_check/);
  assert.match(hardeningSql, /WorkerPayment_submission_actor_check[\s\S]*?"submissionSource" IS NOT NULL/);
  assert.match(hardeningSql, /identityDecisionEvidenceHash" IS NOT NULL[\s\S]*?identityDecisionEvidenceHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(hardeningSql, /reviewEvidenceHash" IS NOT NULL[\s\S]*?reviewEvidenceHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(hardeningSql, /WorkerPayment_separation_of_duties_check[\s\S]*?submittedByMembershipId[\s\S]*?verifiedByMembershipId[\s\S]*?activatedByMembershipId/);
  assert.match(hardeningSql, /FOREIGN KEY \("organizationId", "personId", "submittedByChannelIdentityId"\)[\s\S]*?REFERENCES "WorkerChannelIdentity"\("organizationId", "personId", "id"\)/);
});

test('alias resolution persists only an encrypted resolved snapshot and scoped hashes', () => {
  const payment = modelBody('WorkerPaymentDestination');
  assert.match(payment, /resolvedType\s+WorkerPaymentDestinationType\?/);
  assert.match(payment, /resolvedEncryptedPayload\s+String\?/);
  assert.match(payment, /resolvedFingerprint\s+String\?/);
  assert.match(payment, /resolvedFingerprintKeyId\s+String\?/);
  assert.match(payment, /resolvedWrappingKeyId\s+String\?/);
  assert.match(payment, /resolvedRecordVersion\s+Int\?/);
  assert.doesNotMatch(payment, /^\s+resolved(?:Cbu|Cvu|Alias|Value|Holder)\s+/mi);
  assert.match(hardeningSql, /WorkerPayment_alias_resolution_check[\s\S]*?"resolvedType" IN \('CBU', 'CVU'\)[\s\S]*?resolvedEncryptedPayload/);
  for (const field of [
    'resolvedType',
    'resolvedEncryptedPayload',
    'resolvedFingerprint',
    'resolvedFingerprintKeyId',
    'resolvedWrappingKeyId',
    'resolvedRecordVersion',
  ]) {
    assert.match(hardeningSql, new RegExp(`"${field}" IS NOT NULL`));
  }
});

test('Worker bridge supports channel cutover without weakening person scope', () => {
  const worker = modelBody('Worker');
  assert.match(worker, /^\s+phone\s+String\?/m);
  assert.match(worker, /person\s+WorkerPerson\?[\s\S]*?onDelete: Restrict/);
  assert.match(migrations[8], /ON "Worker"\("organizationId", "personId", "projectId"\)[\s\S]*?WHERE "personId" IS NOT NULL/);
  assert.match(hardeningValidationSql, /TO "Worker_organizationId_personId_fkey"/);
});

test('SQL never introduces cleartext columns for worker identity or payment data', () => {
  assert.doesNotMatch(migrationSql, /"(?:cuil|givenNames|familyName|legalName|holderName|holderCuil|senderPhone|claimToken|paymentValue)"\s+/i);
  assert.match(migrationSql, /encryptedIdentityPayload/);
  assert.match(migrationSql, /encryptedAddressPayload/);
  assert.match(migrationSql, /encryptedPayload/);
  assert.match(migrationSql, /~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.doesNotMatch(migrationSql, /~ '\^v1\\\./);
  assert.match(migrationSql, /~ '\^v2\\\.\[A-Za-z0-9_-\]\{16\}\\\.\[A-Za-z0-9_-\]\{22\}\\\.\[A-Za-z0-9_-\]\+\\\.\[A-Za-z0-9_-\]\{16\}\\\.\[A-Za-z0-9_-\]\{22\}\\\.\[A-Za-z0-9_-\]\{43\}\$'/);
  assert.match(migrationSql, /"type" IN \('CBU', 'CVU'\) AND "lastFour" ~ '\^\[0-9\]\{4\}\$'/);
  assert.match(migrationSql, /"type" = 'ALIAS' AND "lastFour" ~ '\^\[a-z0-9.-\]\{1,4\}\$'/);
  assert.match(migrationSql, /operational rewrap\/dual-fingerprint rotation job is intentionally outside/);
});

test('final envelope constraints accept strict v2 and v3 shapes after validated swaps', () => {
  const upgradedEnvelopePattern = /\^v\[23\]\\\.\[A-Za-z0-9_-\]\{16\}\\\.\[A-Za-z0-9_-\]\{22\}\\\.\[A-Za-z0-9_-\]\+\\\.\[A-Za-z0-9_-\]\{16\}\\\.\[A-Za-z0-9_-\]\{22\}\\\.\[A-Za-z0-9_-\]\{43\}\$/g;
  assert.equal((hardeningSql.match(upgradedEnvelopePattern) || []).length, 7);

  const legacyConstraintNames = [
    'WorkerPerson_identity_bundle_check',
    'WorkerChannelIdentity_encrypted_address_check',
    'WorkerChannelIdentity_provider_subject_check',
    'WorkerOnboardingClaim_sender_check',
    'WorkerOnboardingClaim_identity_bundle_check',
    'WorkerPaymentDestination_encrypted_payload_check',
  ];
  for (const constraint of legacyConstraintNames) {
    assert.match(
      hardeningValidationSql,
      new RegExp(`VALIDATE CONSTRAINT "[^"]+_v3_check"[\\s\\S]*?DROP CONSTRAINT "${constraint}"[\\s\\S]*?TO "${constraint}"`),
    );
  }
});
