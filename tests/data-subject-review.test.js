import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'mock:data-subject-review-server-only', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:data-subject-review-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const review = await import('../src/lib/data-subject-review.js');

const {
  DataSubjectReviewError,
  appendDataSubjectLegalAssessment,
  appendDataSubjectRequesterVerificationEvent,
  createDataSubjectDecision,
  createDataSubjectReviewReadAdapter,
  createDataSubjectReviewSnapshotAdapter,
  createDataSubjectReviewSqlAdapter,
  dataSubjectDecisionRevisionToken,
  dataSubjectHoldSetRevisionToken,
  dataSubjectReviewErrorResponse,
  dataSubjectReviewOperationKeyHash,
  dataSubjectReviewRevisionTokenMatches,
  decideDataSubjectDecision,
  listDataSubjectRequestsForReview,
  normalizeDataSubjectDecisionInput,
  normalizeDataSubjectDecisionOutcomeInput,
  normalizeDataSubjectLegalAssessmentInput,
  normalizeDataSubjectReviewListQuery,
  normalizeDataSubjectVerificationInput,
  readDataSubjectRequestReview,
  requireDataSubjectReviewIdempotencyKey,
  resolveDataSubjectReviewKeyConfig,
  validateDataSubjectReviewKeyConfig,
} = review;

const KEY = Buffer.alloc(32, 7);
const KEY_ID = 'privacy-review-test-v1';
const ORGANIZATION_ID = 'organization-a';
const REQUEST_ID = 'request-a';
const ACTOR_ID = 'membership-admin-a';
const NOW = new Date('2026-08-11T12:00:00.000Z');
const HASHES = Object.freeze({
  requester: '1'.repeat(64),
  identity: '2'.repeat(64),
  challenge: '3'.repeat(64),
  manifest: '4'.repeat(64),
  holdSet: '5'.repeat(64),
  holdSetChanged: '6'.repeat(64),
  decision: '7'.repeat(64),
  policy: '8'.repeat(64),
  matrix: '9'.repeat(64),
  legal: 'a'.repeat(64),
});

const SCOPE = Object.freeze({
  organizationId: ORGANIZATION_ID,
  actorMembershipId: ACTOR_ID,
});

function selfVerification(overrides = {}) {
  return {
    eventKind: 'VERIFIED',
    expectedHeadEventId: null,
    requesterKind: 'SELF',
    assuranceLevel: 'SUBSTANTIAL',
    verificationMethodCode: 'CANONICAL_WORKER_IDENTITY_PLUS_CHALLENGE',
    verificationPolicyVersion: 'identity-policy-v1',
    requesterEvidenceSha256: HASHES.requester,
    challengeEvidenceSha256: HASHES.challenge,
    validUntil: '2026-08-20T12:00:00.000Z',
    expectedSubjectIdentityRevision: 3,
    ...overrides,
  };
}

function legalAssessment(overrides = {}) {
  return {
    expectedHeadAssessmentId: null,
    jurisdictionCode: 'AR-MZA',
    deadlineMethod: 'REVIEWED_EXPLICIT_DATE',
    dueAt: '2026-09-10T12:00:00.000Z',
    deadlinePolicyVersion: 'deadline-v1',
    deadlinePolicySha256: HASHES.policy,
    retentionMatrixVersion: 'retention-v1',
    retentionMatrixSha256: HASHES.matrix,
    legalReviewEvidenceSha256: HASHES.legal,
    ...overrides,
  };
}

function publicDtoIsPrivacyMinimal(value, forbiddenValues = []) {
  const visit = (current) => {
    if (!current || typeof current !== 'object') return;
    for (const [key, nested] of Object.entries(current)) {
      assert.doesNotMatch(
        key,
        /sha|hmac|hash|fingerprint|actor|owner|source/i,
        `public DTO key ${key} exposes an internal privacy primitive`,
      );
      visit(nested);
    }
  };
  visit(value);
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /[a-f0-9]{64}/i);
  for (const forbidden of forbiddenValues) assert.equal(serialized.includes(forbidden), false);
}

async function expectReviewError(operation, { code, status }) {
  await assert.rejects(operation, (error) => {
    assert.equal(error instanceof DataSubjectReviewError, true);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

function reviewRow({
  requestId = REQUEST_ID,
  organizationId = ORGANIZATION_ID,
  status = 'DISCOVERED',
  outcome = 'COMPLETE',
  identityStatus = 'VERIFIED',
  holdSetSha256 = HASHES.holdSet,
  withDecision = true,
} = {}) {
  const manifestId = `manifest-${requestId}`;
  const itemId = `item-${requestId}`;
  const verificationId = `verification-${requestId}`;
  const assessmentId = `assessment-${requestId}`;
  return {
    id: requestId,
    organizationId,
    type: 'ACCESS',
    subjectKind: 'WORKER_PERSON',
    status,
    receivedAt: new Date('2026-08-01T12:00:00.000Z'),
    terminalAt: new Date('2026-08-01T12:00:02.000Z'),
    terminalReasonCode: null,
    workerPerson: { recordVersion: 3, identityStatus },
    manifest: {
      id: manifestId,
      organizationId,
      requestId,
      outcome,
      itemCount: 1,
      blockerCount: 0,
      manifestSha256: HASHES.manifest,
      sealedAt: new Date('2026-08-01T12:00:02.000Z'),
      items: [{
        id: itemId,
        ordinal: 0,
        kind: 'RECORD',
        category: 'LABOR',
        resourceType: 'ATTENDANCE_EVENT',
        disposition: 'KEEP_MINIMAL',
        blockerCode: null,
      }],
    },
    requesterVerificationEvents: [{
      id: verificationId,
      sequence: 1,
      predecessorEventId: null,
      kind: 'VERIFIED',
      requesterKind: 'SELF',
      assuranceLevel: 'SUBSTANTIAL',
      verificationMethodCode: 'CANONICAL_WORKER_IDENTITY_PLUS_CHALLENGE',
      verificationPolicyVersion: 'identity-policy-v1',
      requesterFingerprintHmac: HASHES.requester,
      identityEvidenceSha256: HASHES.identity,
      challengeEvidenceSha256: HASHES.challenge,
      subjectIdentityRecordVersion: 3,
      representationMethodCode: null,
      representationEvidenceSha256: null,
      validUntil: new Date('2026-08-20T12:00:00.000Z'),
      representationValidUntil: null,
      revocationReasonCode: null,
      occurredAt: new Date('2026-08-02T12:00:00.000Z'),
    }],
    legalAssessmentRevisions: [{
      id: assessmentId,
      manifestId,
      sequence: 1,
      predecessorAssessmentId: null,
      jurisdictionCode: 'AR-MZA',
      deadlineMethod: 'REVIEWED_EXPLICIT_DATE',
      dueAt: new Date('2026-09-10T12:00:00.000Z'),
      deadlinePolicyVersion: 'deadline-v1',
      deadlinePolicySha256: HASHES.policy,
      retentionMatrixVersion: 'retention-v1',
      retentionMatrixSha256: HASHES.matrix,
      legalReviewEvidenceSha256: HASHES.legal,
      assessedAt: new Date('2026-08-03T12:00:00.000Z'),
    }],
    decisionSets: withDecision ? [{
      id: `decision-${requestId}`,
      manifestId,
      revision: 1,
      predecessorDecisionId: null,
      status: 'PENDING_APPROVAL',
      verificationEventId: verificationId,
      legalAssessmentId: assessmentId,
      manifestSha256: HASHES.manifest,
      holdSetSha256,
      itemCount: 1,
      unresolvedCount: 0,
      activeHoldCount: 0,
      decisionSha256: HASHES.decision,
      preparedByMembershipId: ACTOR_ID,
      decidedByMembershipId: null,
      preparedAt: new Date('2026-08-04T12:00:00.000Z'),
      pendingAt: new Date('2026-08-04T12:00:00.000Z'),
      decidedAt: null,
      items: [{
        discoveryItemId: itemId,
        ordinal: 0,
        action: 'DISCLOSE_CANDIDATE',
        legalBasisCode: 'subject-access',
        retentionPolicyVersion: 'retention-v1',
        retentionRuleCode: 'access-record',
        retentionUntil: null,
      }],
    }] : [],
    // A historical relation must never be traversed by the bounded review reader.
    legalHolds: Array.from({ length: 1_025 }, (_, index) => ({ id: `old-${index}` })),
  };
}

function blockedReviewRow() {
  const row = reviewRow({ status: 'DISCOVERY_BLOCKED', outcome: 'BLOCKED' });
  const record = {
    ...row.manifest.items[0],
    disposition: 'REVIEW_REQUIRED',
    blockerCode: 'LEGAL_CLASSIFICATION_REQUIRED',
  };
  const coverageBlockers = Array.from({ length: 8 }, (_, index) => ({
    id: `coverage-blocker-${index + 1}`,
    ordinal: index + 1,
    kind: 'COVERAGE_BLOCKER',
    category: 'LABOR',
    resourceType: `MISSING_REQUIRED_SOURCE_${index + 1}`,
    disposition: 'REVIEW_REQUIRED',
    blockerCode: `MISSING_REQUIRED_SOURCE_${index + 1}`,
  }));
  row.manifest.itemCount = 9;
  row.manifest.blockerCount = 9;
  row.manifest.items = [record, ...coverageBlockers];
  row.decisionSets[0].itemCount = 9;
  row.decisionSets[0].unresolvedCount = 8;
  row.decisionSets[0].items = [
    row.decisionSets[0].items[0],
    ...coverageBlockers.map((item) => ({
      discoveryItemId: item.id,
      ordinal: item.ordinal,
      action: 'UNRESOLVED',
      legalBasisCode: null,
      retentionPolicyVersion: null,
      retentionRuleCode: null,
      retentionUntil: null,
    })),
  ];
  return row;
}

test('review key configuration is exclusive, bounded and fail closed', () => {
  const encoded = KEY.toString('base64url');
  assert.deepEqual(resolveDataSubjectReviewKeyConfig({
    PRIVACY_REVIEW_FINGERPRINT_SECRET: encoded,
    PRIVACY_REVIEW_FINGERPRINT_KEY_ID: KEY_ID,
  }), { key: KEY, keyId: KEY_ID });
  assert.throws(
    () => resolveDataSubjectReviewKeyConfig({ PRIVACY_REVIEW_FINGERPRINT_SECRET: encoded }),
    { code: 'PRIVACY_REVIEW_UNAVAILABLE', status: 503 },
  );
  assert.throws(
    () => validateDataSubjectReviewKeyConfig({ key: Buffer.alloc(31), keyId: KEY_ID }),
    { code: 'PRIVACY_REVIEW_UNAVAILABLE', status: 503 },
  );
});

test('Idempotency-Key accepts only the exact 8 through 128 character contract', () => {
  const request = (value) => new Request('https://example.test', {
    headers: value === null ? {} : { 'Idempotency-Key': value },
  });
  assert.equal(requireDataSubjectReviewIdempotencyKey(request('a'.repeat(8))), 'a'.repeat(8));
  assert.equal(requireDataSubjectReviewIdempotencyKey(request('a'.repeat(128))), 'a'.repeat(128));
  for (const value of [null, 'a'.repeat(7), 'a'.repeat(129), 'not allowed']) {
    assert.throws(() => requireDataSubjectReviewIdempotencyKey(request(value)), {
      code: 'PRIVACY_REVIEW_IDEMPOTENCY_KEY_INVALID',
      status: 400,
    });
  }
});

test('operation lookup is request-scoped while the request fingerprint is actor-bound', async () => {
  const common = {
    organizationId: ORGANIZATION_ID,
    operationKind: 'REQUESTER_VERIFICATION_EVENT',
    idempotencyKey: 'verification-key-0001',
  };
  const same = dataSubjectReviewOperationKeyHash({ ...common, requestId: REQUEST_ID });
  assert.equal(same, dataSubjectReviewOperationKeyHash({ ...common, requestId: REQUEST_ID }));
  assert.notEqual(same, dataSubjectReviewOperationKeyHash({ ...common, requestId: 'request-b' }));

  const operations = new Map();
  const commands = [];
  let identityReads = 0;
  const sqlAdapter = {
    async appendVerification(command) {
      commands.push({ ...command });
      const prior = operations.get(command.operationKeyHash);
      if (prior && prior !== command.requestFingerprint) throw { code: 'P0509' };
      operations.set(command.operationKeyHash, command.requestFingerprint);
      return [{
        event_id: 'verification-event-a',
        sequence: 1,
        event_kind: 'VERIFIED',
        replayed: Boolean(prior),
        occurred_at: NOW,
      }];
    },
  };
  const readAdapter = {
    async requireAdmin() {},
    async verificationOperation(command) {
      return operations.has(command.operationKeyHash) ? { id: 'verification-event-a' } : null;
    },
    async verifiedWorkerIdentity() {
      identityReads += 1;
      return {
        identityStatus: 'VERIFIED',
        recordVersion: 3,
        identityDecisionEvidenceHash: HASHES.identity,
      };
    },
  };
  const input = {
    scope: SCOPE,
    requestId: REQUEST_ID,
    idempotencyKey: common.idempotencyKey,
    input: selfVerification(),
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  };
  const first = await appendDataSubjectRequesterVerificationEvent(null, input, {
    readAdapter,
    sqlAdapter,
  });
  const replay = await appendDataSubjectRequesterVerificationEvent(null, input, {
    readAdapter,
    sqlAdapter,
  });
  assert.equal(first.verification.sequence, 1);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(commands[0].operationKeyHash, commands[1].operationKeyHash);
  assert.equal(commands[0].requestFingerprint, commands[1].requestFingerprint);
  assert.equal(commands[0].identityEvidenceSha256, HASHES.identity);
  assert.equal(Object.hasOwn(commands[0], 'requesterEvidenceSha256'), false);
  assert.match(commands[0].requesterFingerprintHmac, /^[a-f0-9]{64}$/);
  assert.notEqual(commands[0].requesterFingerprintHmac, HASHES.requester);
  assert.equal(identityReads, 1, 'an exact replay must not be blocked by later identity state');
  publicDtoIsPrivacyMinimal(first, Object.values(HASHES));

  await expectReviewError(
    () => appendDataSubjectRequesterVerificationEvent(null, {
      ...input,
      scope: { ...SCOPE, actorMembershipId: 'membership-admin-b' },
    }, { readAdapter, sqlAdapter }),
    { code: 'PRIVACY_REVIEW_CONFLICT', status: 409 },
  );
  assert.equal(commands[2].operationKeyHash, commands[0].operationKeyHash);
  assert.notEqual(commands[2].requestFingerprint, commands[0].requestFingerprint);

  const commandCount = commands.length;
  await expectReviewError(() => appendDataSubjectRequesterVerificationEvent(null, input, {
    readAdapter: {
      async requireAdmin() {
        throw new DataSubjectReviewError(
          'La membresía fue deshabilitada.',
          'PRIVACY_REVIEW_FORBIDDEN',
          403,
        );
      },
      async verificationOperation() {
        throw new Error('must not read an operation for a disabled actor');
      },
    },
    sqlAdapter,
  }), { code: 'PRIVACY_REVIEW_FORBIDDEN', status: 403 });
  assert.equal(commands.length, commandCount);
});

test('verification input cannot control server HMAC and SELF requires exact identity revision', () => {
  assert.equal(normalizeDataSubjectVerificationInput(selfVerification())
    .subjectIdentityRecordVersion, 3);
  assert.throws(
    () => normalizeDataSubjectVerificationInput(selfVerification({
      requesterFingerprintHmac: HASHES.requester,
    })),
    { code: 'PRIVACY_REVIEW_FIELDS_INVALID', status: 400 },
  );
  assert.throws(
    () => normalizeDataSubjectVerificationInput(selfVerification({
      expectedSubjectIdentityRevision: null,
    })),
    { code: 'PRIVACY_REVIEW_INTEGER_INVALID', status: 400 },
  );
});

test('legal and decision normalizers enforce exact database lengths and nullable record retention', () => {
  assert.equal(normalizeDataSubjectLegalAssessmentInput(legalAssessment({
    jurisdictionCode: 'A'.repeat(16),
  })).jurisdictionCode.length, 16);
  assert.throws(
    () => normalizeDataSubjectLegalAssessmentInput(legalAssessment({
      jurisdictionCode: 'A'.repeat(17),
    })),
    { code: 'PRIVACY_REVIEW_CODE_INVALID', status: 400 },
  );
  assert.throws(
    () => normalizeDataSubjectLegalAssessmentInput(legalAssessment({
      deadlinePolicyVersion: 'A'.repeat(65),
    })),
    { code: 'PRIVACY_REVIEW_CODE_INVALID', status: 400 },
  );

  const holdSetRevisionToken = dataSubjectHoldSetRevisionToken(KEY, {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    manifestId: 'manifest-a',
    holdSetSha256: HASHES.holdSet,
  });
  const normalized = normalizeDataSubjectDecisionInput({
    manifestId: 'manifest-a',
    expectedVerificationEventId: 'verification-a',
    expectedLegalAssessmentId: 'assessment-a',
    holdSetRevisionToken,
    expectedPreviousDecisionId: null,
    items: [
      {
        reviewItemId: 'record-a',
        action: 'DISCLOSE_CANDIDATE',
        legalBasisCode: 'basis-a',
        retentionPolicyVersion: 'retention-v1',
        retentionRuleCode: 'rule-a',
        retentionUntil: null,
      },
      {
        reviewItemId: 'blocker-a',
        action: 'UNRESOLVED',
        legalBasisCode: null,
        retentionPolicyVersion: null,
        retentionRuleCode: null,
        retentionUntil: null,
      },
    ],
  });
  assert.equal(normalized.items.find((item) => item.reviewItemId === 'record-a')
    .retentionUntil, null);
  assert.throws(() => normalizeDataSubjectDecisionInput({
    ...normalized,
    items: [{
      reviewItemId: 'blocker-a',
      action: 'UNRESOLVED',
      legalBasisCode: null,
      retentionPolicyVersion: null,
      retentionRuleCode: null,
      retentionUntil: '2026-09-01T00:00:00.000Z',
    }],
  }), { code: 'PRIVACY_REVIEW_DECISION_RETENTION_INVALID', status: 400 });
});

test('decision outcome is an exact APPROVE/null or REJECT/code discriminated union', () => {
  const token = dataSubjectDecisionRevisionToken(KEY, {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    decisionId: 'decision-a',
    revision: 1,
    status: 'PENDING_APPROVAL',
    decisionSha256: HASHES.decision,
  });
  assert.equal(normalizeDataSubjectDecisionOutcomeInput({
    expectedRevision: 1,
    decisionRevisionToken: token,
    decision: 'APPROVE',
    reasonCode: null,
  }).reasonCode, null);
  assert.equal(normalizeDataSubjectDecisionOutcomeInput({
    expectedRevision: 1,
    decisionRevisionToken: token,
    decision: 'REJECT',
    reasonCode: 'NEEDS_REVIEW',
  }).reasonCode, 'NEEDS_REVIEW');
  for (const body of [
    { decision: 'APPROVE', reasonCode: 'NOT_ALLOWED' },
    { decision: 'REJECT', reasonCode: null },
  ]) {
    assert.throws(() => normalizeDataSubjectDecisionOutcomeInput({
      expectedRevision: 1,
      decisionRevisionToken: token,
      ...body,
    }), { code: 'PRIVACY_REVIEW_DECISION_REASON_INVALID', status: 400 });
  }
});

test('opaque revision tokens reject tampering, staleness and cross-tenant reuse', () => {
  const base = {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    manifestId: 'manifest-a',
    holdSetSha256: HASHES.holdSet,
  };
  const token = dataSubjectHoldSetRevisionToken(KEY, base);
  assert.equal(dataSubjectReviewRevisionTokenMatches(token, token), true);
  assert.equal(dataSubjectReviewRevisionTokenMatches(
    token,
    `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`,
  ), false);
  assert.equal(dataSubjectReviewRevisionTokenMatches(token, dataSubjectHoldSetRevisionToken(KEY, {
    ...base,
    holdSetSha256: HASHES.holdSetChanged,
  })), false);
  assert.equal(dataSubjectReviewRevisionTokenMatches(token, dataSubjectHoldSetRevisionToken(KEY, {
    ...base,
    organizationId: 'organization-b',
  })), false);
  assert.equal(token.includes(HASHES.holdSet), false);
});

test('decision creation covers the sealed manifest and passes raw CAS only server-to-database', async () => {
  const manifest = {
    id: 'manifest-a',
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    outcome: 'BLOCKED',
    itemCount: 2,
    blockerCount: 1,
    manifestSha256: HASHES.manifest,
    items: [
      { id: 'record-a', kind: 'RECORD' },
      { id: 'blocker-a', kind: 'COVERAGE_BLOCKER' },
    ],
  };
  const holdSetRevisionToken = dataSubjectHoldSetRevisionToken(KEY, {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    manifestId: manifest.id,
    holdSetSha256: HASHES.holdSet,
  });
  const input = {
    manifestId: manifest.id,
    expectedVerificationEventId: 'verification-a',
    expectedLegalAssessmentId: 'assessment-a',
    holdSetRevisionToken,
    expectedPreviousDecisionId: null,
    items: [
      {
        reviewItemId: 'record-a',
        action: 'DISCLOSE_CANDIDATE',
        legalBasisCode: 'subject-access',
        retentionPolicyVersion: 'retention-v1',
        retentionRuleCode: 'access-record',
        retentionUntil: null,
      },
      {
        reviewItemId: 'blocker-a',
        action: 'UNRESOLVED',
        legalBasisCode: null,
        retentionPolicyVersion: null,
        retentionRuleCode: null,
        retentionUntil: null,
      },
    ],
  };
  const commands = [];
  let storedOperation = null;
  let currentHoldSet = HASHES.holdSet;
  let preflightReads = 0;
  const readAdapter = {
    async requireAdmin() {},
    async decisionCreationOperation(command) {
      return storedOperation?.operationKeyHash === command.operationKeyHash
        ? {
          manifestSha256: HASHES.manifest,
          holdSetSha256: HASHES.holdSet,
        }
        : null;
    },
    async request() {
      preflightReads += 1;
      return { id: REQUEST_ID, organizationId: ORGANIZATION_ID, type: 'ACCESS', status: 'DISCOVERY_BLOCKED' };
    },
    async manifest() { return manifest; },
  };
  const sqlAdapter = {
    async holdSetSha256() { return [{ hold_set_sha256: currentHoldSet }]; },
    async createDecision(command) {
      commands.push(command);
      const replayed = storedOperation?.operationKeyHash === command.operationKeyHash;
      if (!storedOperation) storedOperation = { operationKeyHash: command.operationKeyHash };
      return [{
        decision_id: 'decision-a',
        revision: 1,
        status: replayed ? 'SEALED_BLOCKED' : 'PENDING_APPROVAL',
        decision_sha256: HASHES.decision,
        hold_set_sha256: HASHES.holdSet,
        replayed,
        prepared_at: NOW,
      }];
    },
  };
  const result = await createDataSubjectDecision(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    idempotencyKey: 'decision-create-0001',
    input,
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  }, { readAdapter, sqlAdapter });
  assert.equal(commands[0].expectedManifestSha256, HASHES.manifest);
  assert.equal(commands[0].expectedHoldSetSha256, HASHES.holdSet);
  assert.equal(result.decision.revision, 1);
  assert.equal(result.decision.status, 'PENDING_APPROVAL');
  assert.match(result.decision.decisionRevisionToken, /^rv1\.[A-Za-z0-9_-]{43}$/);
  publicDtoIsPrivacyMinimal(result, Object.values(HASHES));

  currentHoldSet = HASHES.holdSetChanged;
  const replay = await createDataSubjectDecision(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    idempotencyKey: 'decision-create-0001',
    input,
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  }, { readAdapter, sqlAdapter });
  assert.equal(replay.replayed, true);
  assert.equal(replay.decision.status, 'SEALED_BLOCKED');
  assert.equal(preflightReads, 1, 'exact replay bypasses stale current dependencies');

  await expectReviewError(() => createDataSubjectDecision(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    idempotencyKey: 'decision-invalid-action',
    input: {
      ...input,
      items: input.items.map((item) => (
        item.reviewItemId === 'record-a'
          ? { ...item, action: 'ERASE_CANDIDATE' }
          : item
      )),
    },
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  }, { readAdapter, sqlAdapter }), {
    code: 'PRIVACY_REVIEW_DECISION_ACTION_INVALID',
    status: 400,
  });

  await expectReviewError(() => createDataSubjectDecision(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    idempotencyKey: 'decision-create-0002',
    input: {
      ...input,
      holdSetRevisionToken: dataSubjectHoldSetRevisionToken(KEY, {
        organizationId: 'organization-b',
        requestId: REQUEST_ID,
        manifestId: manifest.id,
        holdSetSha256: HASHES.holdSet,
      }),
    },
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  }, { readAdapter, sqlAdapter }), {
    code: 'PRIVACY_REVIEW_HOLD_SET_STALE',
    status: 409,
  });
  assert.equal(commands.length, 2);
});

test('maker-checker approval and rejection use opaque decision CAS without exposing hashes', async () => {
  const decisionRevisionToken = dataSubjectDecisionRevisionToken(KEY, {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    decisionId: 'decision-a',
    revision: 1,
    status: 'PENDING_APPROVAL',
    decisionSha256: HASHES.decision,
  });
  const commands = [];
  const readAdapter = {
    async requireAdmin() {},
    async decisionOutcomeOperation() { return null; },
    async decision() {
      return {
        id: 'decision-a',
        organizationId: ORGANIZATION_ID,
        requestId: REQUEST_ID,
        revision: 1,
        status: 'PENDING_APPROVAL',
        decisionSha256: HASHES.decision,
      };
    },
  };
  const sqlAdapter = {
    async decide(command) {
      commands.push(command);
      return [{
        decision_id: 'decision-a',
        revision: 1,
        status: command.decision === 'APPROVE' ? 'SEALED_BLOCKED' : 'REJECTED',
        decision_sha256: HASHES.decision,
        hold_set_sha256: HASHES.holdSet,
        replayed: false,
        decided_at: NOW,
      }];
    },
  };
  for (const [index, outcome] of [
    ['APPROVE', null],
    ['REJECT', 'LEGAL_REVIEW_REQUIRED'],
  ].entries()) {
    const [decision, reasonCode] = outcome;
    const result = await decideDataSubjectDecision(null, {
      scope: SCOPE,
      requestId: REQUEST_ID,
      decisionId: 'decision-a',
      idempotencyKey: `decision-outcome-000${index + 1}`,
      input: {
        expectedRevision: 1,
        decisionRevisionToken,
        decision,
        reasonCode,
      },
      fingerprintKey: KEY,
      fingerprintKeyId: KEY_ID,
    }, { readAdapter, sqlAdapter });
    assert.equal(commands[index].expectedDecisionSha256, HASHES.decision);
    assert.equal(commands[index].reasonCode, reasonCode);
    assert.equal(result.decision.status, decision === 'APPROVE' ? 'SEALED_BLOCKED' : 'REJECTED');
    publicDtoIsPrivacyMinimal(result, Object.values(HASHES));
  }
  const crossTenantToken = dataSubjectDecisionRevisionToken(KEY, {
    organizationId: 'organization-b',
    requestId: REQUEST_ID,
    decisionId: 'decision-a',
    revision: 1,
    status: 'PENDING_APPROVAL',
    decisionSha256: HASHES.decision,
  });
  await expectReviewError(() => decideDataSubjectDecision(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    decisionId: 'decision-a',
    idempotencyKey: 'decision-cross-tenant-token',
    input: {
      expectedRevision: 1,
      decisionRevisionToken: crossTenantToken,
      decision: 'APPROVE',
      reasonCode: null,
    },
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  }, { readAdapter, sqlAdapter }), {
    code: 'PRIVACY_REVIEW_DECISION_STALE',
    status: 409,
  });
  assert.equal(commands.length, 2);
});

test('an exact approval replay reaches the database replay after the decision is sealed', async () => {
  const decisionRevisionToken = dataSubjectDecisionRevisionToken(KEY, {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    decisionId: 'decision-a',
    revision: 1,
    status: 'PENDING_APPROVAL',
    decisionSha256: HASHES.decision,
  });
  let storedOperationKey = null;
  let currentReads = 0;
  const readAdapter = {
    async requireAdmin() {},
    async decisionOutcomeOperation(command) {
      return storedOperationKey === command.operationKeyHash
        ? { decisionSha256: HASHES.decision }
        : null;
    },
    async decision() {
      currentReads += 1;
      return {
        id: 'decision-a',
        organizationId: ORGANIZATION_ID,
        requestId: REQUEST_ID,
        revision: 1,
        status: 'PENDING_APPROVAL',
        decisionSha256: HASHES.decision,
      };
    },
  };
  const sqlAdapter = {
    async decide(command) {
      const replayed = storedOperationKey === command.operationKeyHash;
      storedOperationKey ||= command.operationKeyHash;
      return [{
        decision_id: 'decision-a',
        revision: 1,
        status: 'SEALED_BLOCKED',
        decision_sha256: HASHES.decision,
        hold_set_sha256: HASHES.holdSet,
        replayed,
        decided_at: NOW,
      }];
    },
  };
  const command = {
    scope: SCOPE,
    requestId: REQUEST_ID,
    decisionId: 'decision-a',
    idempotencyKey: 'decision-approval-replay',
    input: {
      expectedRevision: 1,
      decisionRevisionToken,
      decision: 'APPROVE',
      reasonCode: null,
    },
    fingerprintKey: KEY,
    fingerprintKeyId: KEY_ID,
  };
  const first = await decideDataSubjectDecision(null, command, { readAdapter, sqlAdapter });
  const replay = await decideDataSubjectDecision(null, command, { readAdapter, sqlAdapter });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.decision.status, 'SEALED_BLOCKED');
  assert.equal(currentReads, 1);
});

test('SQL adapter uses only the six frozen parameterized functions and never opens a transaction', async () => {
  const calls = [];
  const prisma = {
    async $queryRawUnsafe(statement, ...parameters) {
      calls.push({ statement, parameters });
      return [];
    },
    $transaction() { throw new Error('mutation adapter must not start a transaction'); },
  };
  const adapter = createDataSubjectReviewSqlAdapter(prisma);
  const command = {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    actorMembershipId: ACTOR_ID,
    operationKeyHash: HASHES.policy,
    requestFingerprint: HASHES.matrix,
    fingerprintKeyId: KEY_ID,
    eventKind: 'VERIFIED',
    expectedHeadEventId: null,
    requesterKind: 'SELF',
    assuranceLevel: 'SUBSTANTIAL',
    verificationMethodCode: 'METHOD',
    verificationPolicyVersion: 'POLICY',
    requesterFingerprintHmac: HASHES.requester,
    identityEvidenceSha256: HASHES.identity,
    challengeEvidenceSha256: HASHES.challenge,
    subjectIdentityRecordVersion: 3,
    representationMethodCode: null,
    representationEvidenceSha256: null,
    validUntil: NOW.toISOString(),
    representationValidUntil: null,
    revocationReasonCode: null,
    expectedHeadAssessmentId: null,
    jurisdictionCode: 'AR',
    deadlineMethod: 'REVIEWED_EXPLICIT_DATE',
    dueAt: NOW.toISOString(),
    deadlinePolicyVersion: 'deadline-v1',
    deadlinePolicySha256: HASHES.policy,
    retentionMatrixVersion: 'retention-v1',
    retentionMatrixSha256: HASHES.matrix,
    legalReviewEvidenceSha256: HASHES.legal,
    manifestId: 'manifest-a',
    expectedManifestSha256: HASHES.manifest,
    scopeKind: 'CATEGORY',
    discoveryItemId: null,
    category: 'LABOR',
    basisCode: 'basis',
    policyVersion: 'policy',
    evidenceSha256: HASHES.legal,
    reviewDueAt: NOW.toISOString(),
    holdId: 'hold-a',
    expectedHeadEventIdForHold: 'hold-event-a',
    releaseReasonCode: null,
    releaseEvidenceSha256: null,
    expectedVerificationEventId: 'verification-a',
    expectedLegalAssessmentId: 'assessment-a',
    expectedHoldSetSha256: HASHES.holdSet,
    expectedPreviousDecisionId: null,
    items: [],
    decisionId: 'decision-a',
    expectedDecisionSha256: HASHES.decision,
    decision: 'APPROVE',
    reasonCode: null,
  };
  await adapter.appendVerification(command);
  await adapter.appendLegalAssessment(command);
  await adapter.createHold(command);
  await adapter.appendHoldEvent({ ...command, expectedHeadEventId: 'hold-event-a', eventKind: 'REVIEWED' });
  await adapter.createDecision(command);
  await adapter.decide(command);
  assert.deepEqual(calls.map(({ statement }) => (
    statement.match(/obrasaas_data_subject_[a-z_]+/)?.[0]
  )), [
    'obrasaas_data_subject_verification_event_append',
    'obrasaas_data_subject_legal_assessment_append',
    'obrasaas_data_subject_hold_create',
    'obrasaas_data_subject_hold_event_append',
    'obrasaas_data_subject_decision_create',
    'obrasaas_data_subject_decision_decide',
  ]);
  assert.deepEqual(calls.map(({ parameters }) => parameters.length), [21, 15, 16, 16, 13, 10]);
  assert.equal(calls.every(({ statement }) => !statement.includes(command.organizationId)), true);
});

test('database SQLSTATE mapping is fixed, redacted and requires whole-operation retry', async () => {
  const expected = [
    ['P0500', 400, 'PRIVACY_REVIEW_INVALID'],
    ['P0503', 403, 'PRIVACY_REVIEW_FORBIDDEN'],
    ['P0504', 404, 'PRIVACY_REVIEW_NOT_FOUND'],
    ['P0509', 409, 'PRIVACY_REVIEW_CONFLICT'],
    ['40001', 503, 'PRIVACY_REVIEW_RETRY_REQUIRED'],
    ['40P01', 503, 'PRIVACY_REVIEW_RETRY_REQUIRED'],
    ['55P03', 503, 'PRIVACY_REVIEW_RETRY_REQUIRED'],
  ];
  for (const [databaseCode, status, code] of expected) {
    let calls = 0;
    let caught;
    try {
      await appendDataSubjectLegalAssessment(null, {
        scope: SCOPE,
        requestId: REQUEST_ID,
        idempotencyKey: `assessment-${databaseCode}-key`,
        input: legalAssessment(),
        fingerprintKey: KEY,
        fingerprintKeyId: KEY_ID,
      }, {
        sqlAdapter: {
          async appendLegalAssessment() {
            calls += 1;
            throw {
              code: 'P2010',
              meta: { driverAdapterError: { cause: { originalCode: databaseCode } } },
              message: `sensitive SQL detail ${HASHES.identity}`,
            };
          },
        },
      });
    } catch (error) {
      caught = error;
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      const response = dataSubjectReviewErrorResponse(error);
      assert.equal(response.status, status);
      assert.equal((await response.text()).includes(HASHES.identity), false);
      assert.equal(response.headers.get('retry-after'), status === 503 ? '3' : null);
    }
    assert.ok(caught);
    assert.equal(calls, 1, 'ambiguous mutation errors must never be retried automatically');
  }
});

test('read adapter revalidates active ADMIN membership and filters list to terminal manifests', async () => {
  const calls = {};
  const prisma = {
    tenantMembership: {
      async findFirst(query) {
        calls.membership = query;
        return null;
      },
    },
    dataSubjectDiscoveryManifest: { async findFirst() { return null; } },
    dataSubjectRequest: {
      async findFirst() { return null; },
      async findMany(query) {
        calls.list = query;
        return [];
      },
    },
    dataSubjectRequesterVerificationEvent: {
      async findFirst(query) { calls.verificationOperation = query; return null; },
    },
    dataSubjectDecisionSet: {
      async findFirst(query) {
        if (query.where.operationKeyHash) calls.decisionCreationOperation = query;
        else calls.decisionOutcomeOperation = query;
        return null;
      },
    },
  };
  const adapter = createDataSubjectReviewReadAdapter(prisma);
  await expectReviewError(() => adapter.requireAdmin(SCOPE), {
    code: 'PRIVACY_REVIEW_FORBIDDEN',
    status: 403,
  });
  assert.deepEqual(calls.membership.where, {
    id: ACTOR_ID,
    organizationId: ORGANIZATION_ID,
    tenantRole: 'ADMIN',
    status: 'ACTIVE',
  });
  await adapter.list({ organizationId: ORGANIZATION_ID, cursor: null, limit: 50 });
  assert.deepEqual(calls.list.where.status, { in: ['DISCOVERED', 'DISCOVERY_BLOCKED'] });
  assert.deepEqual(calls.list.where.manifest, { isNot: null });
  assert.equal(JSON.stringify(calls.list.select).includes('legalHolds'), false);
  const operation = {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    operationKeyHash: HASHES.policy,
  };
  await adapter.verificationOperation(operation);
  await adapter.decisionCreationOperation(operation);
  await adapter.decisionOutcomeOperation(operation);
  assert.deepEqual(calls.verificationOperation.where, operation);
  assert.deepEqual(calls.decisionCreationOperation.where, operation);
  assert.deepEqual(calls.decisionOutcomeOperation.where, {
    organizationId: ORGANIZATION_ID,
    requestId: REQUEST_ID,
    decisionOperationKeyHash: HASHES.policy,
  });
});

test('review list is cursor bounded, ignores released history and marks changed hold sets stale', async () => {
  const first = reviewRow();
  const second = reviewRow({ requestId: 'request-b', withDecision: false });
  second.receivedAt = new Date('2026-07-31T12:00:00.000Z');
  const readAdapter = {
    async requireAdmin() {},
    async list() { return [first, second]; },
  };
  const sqlAdapter = {
    async activeHolds() { return []; },
    async holdSetSha256() { return [{ hold_set_sha256: HASHES.holdSetChanged }]; },
    async manifestCounts() {
      return [{ item_count: 1, blocker_count: 0, coverage_blocker_count: 0 }];
    },
  };
  const result = await listDataSubjectRequestsForReview(null, {
    scope: SCOPE,
    query: { cursor: null, limit: 1 },
    fingerprintKey: KEY,
  }, { readAdapter, sqlAdapter, observedAt: NOW });
  assert.equal(result.pageSize, 1);
  assert.equal(result.requests[0].reviewState, 'STALE');
  assert.match(result.nextCursor, /^pc1\./);
  publicDtoIsPrivacyMinimal(result, [...Object.values(HASHES), ACTOR_ID]);

  const parsed = normalizeDataSubjectReviewListQuery(new Request(
    `https://example.test/api/tenant/privacy/requests?limit=50&cursor=${result.nextCursor}`,
  ), { organizationId: ORGANIZATION_ID, fingerprintKey: KEY });
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.cursor.id, REQUEST_ID);
  assert.throws(() => normalizeDataSubjectReviewListQuery(new Request(
    `https://example.test/api/tenant/privacy/requests?cursor=${result.nextCursor}`,
  ), { organizationId: 'organization-b', fingerprintKey: KEY }), {
    code: 'PRIVACY_REVIEW_CURSOR_INVALID',
    status: 400,
  });
  for (const query of ['limit=51', 'limit=0', 'extra=1', 'limit=1&limit=2']) {
    assert.throws(() => normalizeDataSubjectReviewListQuery(new Request(
      `https://example.test/api/tenant/privacy/requests?${query}`,
    ), { organizationId: ORGANIZATION_ID, fingerprintKey: KEY }), {
      code: 'PRIVACY_REVIEW_QUERY_INVALID',
      status: 400,
    });
  }
});

test('list fails closed on inconsistent terminal manifest even before a decision exists', async () => {
  const corrupt = reviewRow({ withDecision: false });
  corrupt.manifest.manifestSha256 = null;
  await expectReviewError(() => listDataSubjectRequestsForReview(null, {
    scope: SCOPE,
    query: { cursor: null, limit: 25 },
    fingerprintKey: KEY,
  }, {
    readAdapter: {
      async requireAdmin() {},
      async list() { return [corrupt]; },
    },
    sqlAdapter: {
      async activeHolds() { return []; },
      async manifestCounts() {
        return [{ item_count: 1, blocker_count: 0, coverage_blocker_count: 0 }];
      },
    },
    observedAt: NOW,
  }), { code: 'PRIVACY_REVIEW_MANIFEST_INCONSISTENT', status: 409 });
});

test('detail serializer is privacy-minimal, revision-aware and bounded after 1025 released holds', async () => {
  const row = reviewRow();
  const readAdapter = {
    async requireAdmin() {},
    async review() { return row; },
  };
  const sqlAdapter = {
    async holdSetSha256() { return [{ hold_set_sha256: HASHES.holdSet }]; },
    async activeHolds() { return []; },
  };
  const result = await readDataSubjectRequestReview(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    fingerprintKey: KEY,
  }, { readAdapter, sqlAdapter, observedAt: NOW });
  assert.equal(result.reviewState, 'APPROVAL_PENDING');
  assert.equal(result.request.subjectIdentityRevision, 3);
  assert.equal(result.reviewItems[0].recordType, 'ATTENDANCE_EVENT');
  assert.equal(result.holds.length, 0);
  assert.equal(result.decision.revision, 1);
  publicDtoIsPrivacyMinimal(result, [...Object.values(HASHES), ACTOR_ID]);

  row.workerPerson.identityStatus = 'REVOKED';
  const staleIdentity = await readDataSubjectRequestReview(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    fingerprintKey: KEY,
  }, { readAdapter, sqlAdapter, observedAt: NOW });
  assert.equal(staleIdentity.reviewState, 'STALE');

  const absent = {
    ...readAdapter,
    async review() { return null; },
  };
  await expectReviewError(() => readDataSubjectRequestReview(null, {
    scope: SCOPE,
    requestId: 'foreign-or-absent-request',
    fingerprintKey: KEY,
  }, { readAdapter: absent, sqlAdapter, observedAt: NOW }), {
    code: 'PRIVACY_REVIEW_NOT_FOUND',
    status: 404,
  });
});

test('canonical blocker counts keep review-required records separate from coverage gaps', async () => {
  const row = blockedReviewRow();
  const sqlAdapter = {
    async holdSetSha256() { return [{ hold_set_sha256: HASHES.holdSet }]; },
    async activeHolds() { return []; },
    async manifestCounts() {
      return [{ item_count: 9, blocker_count: 9, coverage_blocker_count: 8 }];
    },
  };
  const list = await listDataSubjectRequestsForReview(null, {
    scope: SCOPE,
    query: { cursor: null, limit: 25 },
    fingerprintKey: KEY,
  }, {
    readAdapter: {
      async requireAdmin() {},
      async list() { return [row]; },
    },
    sqlAdapter,
    observedAt: NOW,
  });
  assert.equal(list.requests[0].discovery.itemCount, 9);
  assert.equal(list.requests[0].discovery.blockerCount, 9);
  assert.equal(list.requests[0].discovery.coverageBlockerCount, 8);
  assert.equal(list.requests[0].decision.status, 'PENDING_APPROVAL');

  const detail = await readDataSubjectRequestReview(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    fingerprintKey: KEY,
  }, {
    readAdapter: {
      async requireAdmin() {},
      async review() { return row; },
    },
    sqlAdapter,
    observedAt: NOW,
  });
  assert.equal(detail.discovery.blockerCount, 9);
  assert.equal(detail.discovery.coverageBlockerCount, 8);
  assert.equal(detail.reviewItems.length, 9);
  assert.equal(detail.decision.unresolvedCount, 8);
  assert.equal(detail.reviewState, 'APPROVAL_PENDING');
  publicDtoIsPrivacyMinimal(detail, [...Object.values(HASHES), ACTOR_ID]);
});

test('decision chain validates revision rather than event sequence', async () => {
  const row = reviewRow();
  row.decisionSets = [{
    ...row.decisionSets[0],
    id: 'decision-2',
    revision: 2,
    predecessorDecisionId: row.decisionSets[0].id,
  }, row.decisionSets[0]];
  const result = await readDataSubjectRequestReview(null, {
    scope: SCOPE,
    requestId: REQUEST_ID,
    fingerprintKey: KEY,
  }, {
    readAdapter: {
      async requireAdmin() {},
      async review() { return row; },
    },
    sqlAdapter: {
      async holdSetSha256() { return [{ hold_set_sha256: HASHES.holdSet }]; },
      async activeHolds() { return []; },
    },
    observedAt: NOW,
  });
  assert.equal(result.decision.revision, 2);
});

test('GET snapshots are one read-only RepeatableRead transaction with no retry', async () => {
  const calls = [];
  const transaction = {
    tenantMembership: { async findFirst() { return null; } },
    dataSubjectDiscoveryManifest: { async findFirst() { return null; } },
    dataSubjectRequest: { async findFirst() { return null; } },
    async $queryRawUnsafe() { return []; },
    async $executeRawUnsafe(statement) { calls.push(statement); return 0; },
  };
  const prisma = {
    async $transaction(operation, options) {
      calls.push(options);
      return operation(transaction);
    },
  };
  const snapshot = createDataSubjectReviewSnapshotAdapter(prisma);
  const result = await snapshot.read(({ readAdapter, sqlAdapter }) => ({
    hasRead: Boolean(readAdapter),
    hasSql: Boolean(sqlAdapter),
  }));
  assert.deepEqual(result, { hasRead: true, hasSql: true });
  assert.deepEqual(calls[0], {
    isolationLevel: 'RepeatableRead',
    maxWait: 5_000,
    timeout: 20_000,
  });
  assert.equal(calls[1], 'SET TRANSACTION READ ONLY');
});

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
  }))).flat();
}

test('PRO-05B.1 source stays real UTF-8 and contains no mojibake markers', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const files = [
    path.join(root, 'src/lib/data-subject-review.js'),
    path.join(root, 'src/lib/data-subject-review-routes.js'),
    ...await javascriptFiles(path.join(root, 'src/app/api/tenant/privacy/requests')),
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\u00c3|\u00c2|\ufffd/, `${file} contains mojibake`);
  }
});
