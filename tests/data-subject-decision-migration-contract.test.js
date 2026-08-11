import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [schema, migration] = await Promise.all([
  readFile(new URL('prisma/schema.prisma', root), 'utf8'),
  readFile(new URL(
    'prisma/migrations/20260811160000_data_subject_decision_control_plane/migration.sql',
    root,
  ), 'utf8'),
]);

const models = [
  'DataSubjectRequesterVerificationEvent',
  'DataSubjectLegalAssessmentRevision',
  'DataSubjectLegalHold',
  'DataSubjectLegalHoldEvent',
  'DataSubjectDecisionSet',
  'DataSubjectDecisionItem',
];

const mutations = [
  'obrasaas_data_subject_verification_event_append',
  'obrasaas_data_subject_legal_assessment_append',
  'obrasaas_data_subject_hold_create',
  'obrasaas_data_subject_hold_event_append',
  'obrasaas_data_subject_decision_create',
  'obrasaas_data_subject_decision_decide',
];

const lockingGuards = new Map([
  ['obrasaas_data_subject_verification_event_guard', 1],
  ['obrasaas_data_subject_legal_assessment_guard', 1],
  ['obrasaas_data_subject_legal_hold_guard', 1],
  ['obrasaas_data_subject_legal_hold_event_guard', 2],
  ['obrasaas_data_subject_decision_set_insert_guard', 1],
  ['obrasaas_data_subject_decision_set_lifecycle_guard', 2],
]);

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

function enumBlock(name) {
  const match = new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma enum ${name}.`);
  return match[1];
}

function sqlFunction(name) {
  const start = migration.indexOf(`CREATE FUNCTION "${name}"(`);
  assert.ok(start >= 0, `Missing SQL function ${name}.`);
  const next = migration.indexOf('\nCREATE FUNCTION ', start + 1);
  const trigger = migration.indexOf('\nCREATE TRIGGER ', start + 1);
  const candidates = [next, trigger].filter((value) => value >= 0);
  return migration.slice(start, candidates.length ? Math.min(...candidates) : migration.length);
}

test('PRO-05B.1 stores six tenant-scoped privacy-minimal control-plane entities', () => {
  for (const name of models) {
    const source = model(name);
    assert.match(source, /organizationId\s+String/);
    assert.match(source, /onDelete: Restrict/);
    assert.doesNotMatch(source, /\bJson\b|@db\.Text|@db\.ByteA/);
    assert.doesNotMatch(source, /^\s+(?:document|payload|content|body|email|phone|cuil|cbu|cvu|alias|address|locator)\w*\s+/mi);
  }
  assert.doesNotMatch(schema, /basisEvidenceSha256/);
  assert.match(model('DataSubjectDecisionSet'), /fingerprintKeyId\s+String\s+@db\.VarChar\(100\)/);
  assert.match(model('DataSubjectDecisionSet'), /decisionFingerprintKeyId\s+String\?\s+@db\.VarChar\(100\)/);
  for (const name of [
    'DataSubjectRequesterVerificationEvent',
    'DataSubjectLegalAssessmentRevision',
    'DataSubjectLegalHold',
    'DataSubjectLegalHoldEvent',
  ]) assert.match(model(name), /fingerprintKeyId\s+String\s+@db\.VarChar\(100\)/);
});

test('Prisma request relations preserve the migration RESTRICT update contract', () => {
  const requestForeignKeys = new Map([
    ['DataSubjectRequesterVerificationEvent', 'DataSubjectVerificationEvent_request_fkey'],
    ['DataSubjectLegalAssessmentRevision', 'DataSubjectLegalAssessment_request_fkey'],
    ['DataSubjectLegalHold', 'DataSubjectLegalHold_request_fkey'],
    ['DataSubjectLegalHoldEvent', 'DataSubjectLegalHoldEvent_request_fkey'],
    ['DataSubjectDecisionSet', 'DataSubjectDecisionSet_request_fkey'],
    ['DataSubjectDecisionItem', 'DataSubjectDecisionItem_request_fkey'],
  ]);

  for (const [modelName, constraintName] of requestForeignKeys) {
    const source = model(modelName);
    assert.ok(
      source.includes(
        `onDelete: Restrict, onUpdate: Restrict, map: "${constraintName}"`,
      ),
      `${modelName}.request must match the migration's ON UPDATE/DELETE RESTRICT actions.`,
    );
  }
});

test('frozen enums expose review candidates but no executable disposition', () => {
  for (const value of [
    'PENDING_APPROVAL', 'SEALED_BLOCKED', 'REJECTED', 'DISCLOSE_CANDIDATE',
    'CORRECT_CANDIDATE', 'RESTRICT_CANDIDATE', 'PORTABILITY_CANDIDATE',
    'ERASE_CANDIDATE', 'CRYPTO_ERASE_CANDIDATE', 'PSEUDONYMIZE_CANDIDATE',
    'KEEP_WITH_BASIS', 'WITHHOLD_WITH_BASIS', 'NO_CHANGE_WITH_BASIS', 'UNRESOLVED',
  ]) assert.match(schema, new RegExp(`\\b${value}\\b`));
  const decisionEnums = `${enumBlock('DataSubjectDecisionStatus')}\n${enumBlock('DataSubjectDecisionAction')}`;
  assert.doesNotMatch(decisionEnums, /\b(?:EXECUTED|DISPATCHED|EXPORTED|DELETED)\b/);
});

test('six mutation functions lock the request then authorize ADMIN before replay', () => {
  for (const name of mutations) {
    const source = sqlFunction(name);
    assert.match(source, /LANGUAGE plpgsql[\s\S]*VOLATILE[\s\S]*SECURITY INVOKER/);
    const requestLock = source.indexOf('FROM "DataSubjectRequest"');
    const forUpdate = source.indexOf('FOR UPDATE', requestLock);
    const adminLock = source.indexOf('FROM "TenantMembership"', forUpdate);
    const forShare = source.indexOf('FOR SHARE', adminLock);
    const replayLookup = [
      source.indexOf('"operationKeyHash" = p_operation_key_hash', forShare),
      source.indexOf('"decisionOperationKeyHash" = p_operation_key_hash', forShare),
    ].filter((value) => value >= 0).sort((left, right) => left - right)[0] ?? -1;
    assert.ok(requestLock >= 0 && forUpdate > requestLock, `${name} lacks request FOR UPDATE.`);
    assert.ok(adminLock > forUpdate && forShare > adminLock, `${name} lacks active ADMIN FOR SHARE.`);
    assert.ok(replayLookup > forShare, `${name} authorizes after replay.`);
    assert.match(source, /ERRCODE = 'P0503'/);
  }
});

test('direct DML locks every actor, owner, preparer and checker membership', () => {
  for (const [name, expectedLocks] of lockingGuards) {
    const source = sqlFunction(name);
    const membershipLocks = source.match(
      /SELECT TRUE FROM %I\."TenantMembership"[\s\S]*?FOR SHARE/g,
    ) || [];
    const nullSafeChecks = source.match(/IS DISTINCT FROM TRUE/g) || [];
    assert.equal(
      membershipLocks.length,
      expectedLocks,
      `${name} must lock every qualifying membership FOR SHARE.`,
    );
    assert.ok(
      nullSafeChecks.length >= expectedLocks,
      `${name} must reject an absent membership without a NULL bypass.`,
    );
    assert.doesNotMatch(
      source,
      /SELECT EXISTS \([\s\S]*?%I\."TenantMembership"/,
      `${name} must not authorize from a non-locking membership snapshot.`,
    );
  }
});

test('chains start at one and stale heads fail closed', () => {
  for (const constraint of [
    'DataSubjectVerificationEvent_sequence_check',
    'DataSubjectLegalAssessment_sequence_check',
    'DataSubjectLegalHoldEvent_sequence_check',
    'DataSubjectDecisionSet_revision_check',
  ]) assert.match(migration, new RegExp(`${constraint}[\\s\\S]{0,180}>= 1`));
  assert.match(migration, /COALESCE\(v_head_sequence, 0\) \+ 1/);
  assert.match(migration, /COALESCE\(v_prior_revision, 0\) \+ 1/);
  assert.match(migration, /privacy verification head is stale/);
  assert.match(migration, /privacy legal assessment head is stale/);
  assert.match(migration, /privacy hold event head is stale/);
  assert.match(migration, /privacy decision head is stale/);
});

test('SELF verification is a DB-revalidated identity snapshot at create and approval', () => {
  assert.match(migration, /CANONICAL_WORKER_IDENTITY_PLUS_CHALLENGE/);
  assert.match(migration, /NEW\."subjectIdentityRecordVersion" IS DISTINCT FROM worker_record_version/);
  assert.match(migration, /NEW\."identityEvidenceSha256"::TEXT IS DISTINCT FROM worker_evidence_sha256/);
  assert.match(migration, /p_subject_identity_record_version IS NULL OR p_subject_identity_record_version < 1/);
  const lifecycle = sqlFunction('obrasaas_data_subject_decision_set_lifecycle_guard');
  assert.ok((lifecycle.match(/self requester identity changed after verification/g) || []).length >= 2);
  assert.match(lifecycle, /identityStatus"::TEXT, "recordVersion", "identityDecisionEvidenceHash"::TEXT/);
});

test('coverage is exact, bounded and permits zero blockers without making a legal decision', () => {
  const lifecycle = sqlFunction('obrasaas_data_subject_decision_set_lifecycle_guard');
  assert.match(migration, /"itemCount" BETWEEN 1 AND 1024/);
  assert.match(migration, /jsonb_array_length\(p_items\)/);
  assert.match(migration, /v_item_count NOT BETWEEN 1 AND 1024/);
  assert.match(lifecycle, /actual_item_count <> expected_item_count/);
  assert.match(lifecycle, /actual_unresolved_count <> expected_unresolved_count/);
  assert.match(
    lifecycle,
    /DataSubjectDiscoveryItem" source_item[\s\S]*source_item\."kind" = ''COVERAGE_BLOCKER''/,
  );
  assert.doesNotMatch(lifecycle, /m\."blockerCount"/);
  assert.doesNotMatch(lifecycle, /actual_unresolved_count < 1/);
  assert.match(migration, /coverage blockers must remain exactly UNRESOLVED/);
  assert.match(migration, /record decisions require a proposed action and policy codes/);
  assert.match(migration, /"retentionUntil" TIMESTAMPTZ\(3\)/);
  assert.doesNotMatch(migration, /"retentionUntil" IS NOT NULL/);
});

test('request-type matrix is an allowlist and decision SHA is database-owned', () => {
  for (const requestType of ['ACCESS', 'CORRECTION', 'ERASURE', 'RESTRICTION', 'PORTABILITY', 'OBJECTION']) {
    assert.match(migration, new RegExp(`request_type = '${requestType}'`));
  }
  assert.match(migration, /proposed action is outside the request-type vocabulary/);
  assert.match(migration, /obrasaas:data-subject-active-holds:v1/);
  assert.match(migration, /obrasaas:data-subject-decision:v1/);
  assert.match(migration, /NEW\."decisionSha256" := calculated_decision_sha256/);
  assert.match(migration, /NEW\."holdSetSha256" := current_hold_set_sha256/);
  assert.doesNotMatch(sqlFunction('obrasaas_data_subject_decision_create'), /p_decision_sha256/);
});

test('maker-checker and sealed evidence cannot be bypassed by direct DML', () => {
  assert.match(migration, /NEW\."decidedByMembershipId" = NEW\."preparedByMembershipId"/);
  for (const field of [
    'manifestSha256', 'holdSetSha256', 'itemCount', 'unresolvedCount',
    'activeHoldCount', 'decisionSha256', 'pendingAt',
  ]) assert.match(migration, new RegExp(`OLD\\."${field}" IS DISTINCT FROM NEW\\."${field}"`));
  assert.match(migration, /transient privacy decision draft cannot reach commit/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  for (const trigger of [
    'DataSubjectVerificationEvent_append_only', 'DataSubjectLegalAssessment_append_only',
    'DataSubjectLegalHold_append_only', 'DataSubjectLegalHoldEvent_append_only',
    'DataSubjectDecisionSet_no_delete', 'DataSubjectDecisionItem_append_only',
  ]) assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  const noTruncate = migration.match(/ENABLE ALWAYS TRIGGER "DataSubject\w+_no_truncate"/g) || [];
  assert.equal(noTruncate.length, 6);
});

test('migration is additive, atomic and contains no execution or source-record mutation', () => {
  assert.match(migration, /^-- PRO-05B\.1[\s\S]*\nBEGIN;/);
  assert.match(migration, /SET LOCAL lock_timeout = '5s';/);
  assert.match(migration, /SET LOCAL statement_timeout = '30s';/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|TYPE|COLUMN)\b/i);
  assert.doesNotMatch(migration, /\b(?:DELETE|UPDATE)\s+(?:FROM\s+)?"(?:WorkerPerson|PlatformUser|TenantMembership|DataSubjectDiscoveryItem|DataSubjectDiscoveryManifest|DataSubjectRequest)"/i);
  assert.doesNotMatch(migration, /\b(?:CALL|PERFORM)\s+\w*(?:dispatch|export|erase|delete)\w*/i);
});
