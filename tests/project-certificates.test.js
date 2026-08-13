import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideProjectCertificate,
  normalizeProjectCertificateDecision,
  normalizeProjectCertificatePrepare,
  normalizeProjectCertificateReadQuery,
  prepareProjectCertificate,
  ProjectCertificateError,
  PROJECT_CERTIFICATE_BLOCKER_CODES,
  readProjectCertificateSnapshot,
  requireProjectCertificateRouteMembership,
} from '../src/lib/project-certificates.js';

const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const ACTOR = 'membership-site-manager';
const HASH = 'a'.repeat(64);
const OPERATION_KEY = 'certificate-operation-0001';
const PERIOD = Object.freeze({ start: '2026-01-01', end: '2026-01-15' });

function source() {
  return {
    cutId: 'cut-a',
    cutCandidateDigest: HASH,
    cutIntegrityDigest: HASH,
    contractHeadId: 'contract-head-a',
    contractVersionId: 'contract-a',
    contractDigest: HASH,
    authorityVersionId: 'authority-a',
    authorityDigest: HASH,
  };
}

function terms() {
  return {
    currencyCode: 'ARS',
    currencyMinorUnits: 2,
    retentionBps: 500,
    contractRoundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1',
    certificateGrossPolicyVersion: 'CERT_CUMULATIVE_GROSS_HALF_UP_V1',
    certificateRetentionPolicyVersion: 'CERT_CUMULATIVE_RETENTION_HALF_UP_V1',
    adjustmentPolicyVersion: 'NONE',
  };
}

function totals({ certificate = false } = {}) {
  return {
    previousApprovedCumulativeGrossMinor: '0',
    cumulativeGrossMinor: '3125000',
    certificateIncrementGrossMinor: '3125000',
    previousApprovedCumulativeRetentionMinor: '0',
    cumulativeRetentionMinor: '156250',
    certificateIncrementRetentionMinor: '156250',
    ...(certificate ? {
      certificateIncrementDeductionsMinor: '0',
      certificateIncrementNetMinor: '2968750',
    } : {}),
  };
}

function candidateLine({ integrity = false } = {}) {
  return {
    ordinal: 1,
    state: 'VALUED',
    cutState: 'MEASURED',
    taskId: 'task-a',
    taskCode: 'T-001',
    taskTitle: 'Excavación',
    taskRevision: 3,
    cutLineId: 'cut-line-a',
    cutLineDigest: HASH,
    contractLineId: 'contract-line-a',
    contractLineDigest: HASH,
    unitCode: 'M3',
    baseQuantity: '100.0000',
    periodQuantity: '25.0000',
    cumulativeQuantity: '25.0000',
    technicalCumulativeOriginPeriodStart: PERIOD.start,
    previousApprovedCumulativeGrossMinor: '0',
    cumulativeGrossMinor: '3125000',
    certificateIncrementGrossMinor: '3125000',
    noClaimReason: null,
    ...(integrity ? { integrityDigest: HASH } : {}),
  };
}

function decision(overrides = {}) {
  return {
    id: 'decision-a',
    decision: 'APPROVED',
    reason: 'Conformidad contractual verificada.',
    decidedByMembershipId: 'membership-director',
    decidedAt: '2026-08-12T12:00:00.000Z',
    ...overrides,
  };
}

function deduction(overrides = {}) {
  return {
    ordinal: 1,
    code: 'ADVANCE_RECOVERY',
    reason: 'Recupero contractual verificado.',
    amountMinor: '1',
    integrityDigest: HASH,
    ...overrides,
  };
}

function certificate({ approved = false, full = false, actor = ACTOR, period = PERIOD, ...overrides } = {}) {
  return {
    id: 'certificate-a',
    projectSequence: '1',
    periodVersion: 1,
    predecessorId: null,
    supersedesApprovedVersionId: null,
    previousApprovedCertificateVersionId: null,
    period,
    coverageFrom: PERIOD.start,
    coverageThrough: PERIOD.end,
    source: source(),
    terms: terms(),
    preparedByMembershipId: actor,
    preparedAt: '2026-08-12T11:00:00.000Z',
    lineCount: 1,
    valuedLineCount: 1,
    noClaimLineCount: 0,
    deductionCount: 0,
    totals: totals({ certificate: true }),
    candidateDigest: HASH,
    integrityDigest: HASH,
    decision: approved ? decision() : null,
    ...(full ? { lines: [candidateLine({ integrity: true })], deductions: [] } : {}),
    ...overrides,
  };
}

function candidate() {
  return {
    period: PERIOD,
    mode: 'FIRST',
    expectedBookRevision: 0,
    expectedPeriodHeadRevision: 0,
    expectedCurrentApprovedVersionId: null,
    coverageFrom: PERIOD.start,
    coverageThrough: PERIOD.end,
    previousApprovedCertificateVersionId: null,
    supersedesApprovedVersionId: null,
    source: source(),
    terms: terms(),
    lineCount: 1,
    valuedLineCount: 1,
    noClaimLineCount: 0,
    totals: totals(),
    lines: [candidateLine()],
  };
}

function capabilities() {
  return {
    read: { allowed: true, reasonCode: null },
    prepare: {
      allowed: true,
      reasonCode: null,
      expectedActorMembershipId: ACTOR,
    },
    approve: {
      allowed: false,
      reasonCode: 'CERT_PENDING_REQUIRED',
      expectedActorMembershipId: null,
      targetId: null,
    },
    reject: {
      allowed: false,
      reasonCode: 'CERT_PENDING_REQUIRED',
      expectedActorMembershipId: null,
      targetId: null,
    },
    cancel: {
      allowed: false,
      reasonCode: 'CERT_PENDING_REQUIRED',
      expectedActorMembershipId: null,
      targetId: null,
    },
  };
}

function readPayload(overrides = {}) {
  return {
    book: null,
    periodHead: null,
    currentApprovedCertificate: null,
    pendingCertificate: null,
    history: [],
    readiness: {
      state: 'READY', mode: 'FIRST', blockingReasons: [], candidateReady: true,
    },
    candidate: candidate(),
    capabilities: capabilities(),
    ...overrides,
  };
}

function receipt(operationKind = 'PREPARE', overrides = {}) {
  const revisionAfter = operationKind === 'PREPARE' ? 1 : 2;
  return {
    operationReceiptId: 'receipt-a',
    operationKind,
    certificateVersionId: 'certificate-a',
    decisionId: operationKind === 'PREPARE' ? null : 'decision-a',
    actorMembershipId: operationKind === 'PREPARE' ? ACTOR : 'membership-director',
    bookRevisionAfter: revisionAfter,
    periodHeadRevisionAfter: revisionAfter,
    replayed: false,
    ...overrides,
  };
}

function preparePayload(overrides = {}) {
  return {
    receipt: receipt(),
    certificate: certificate(),
    decision: null,
    book: {
      id: 'book-a',
      revision: 1,
      pinnedContractHeadId: null,
      pinnedContractVersionId: null,
      pinnedAuthorityVersionId: null,
      latestApprovedPeriodStart: null,
      latestApprovedCertificateVersionId: null,
      pendingCertificateVersionId: 'certificate-a',
    },
    periodHead: {
      id: 'period-head-a', revision: 1, currentApprovedVersionId: null,
      latestVersionId: 'certificate-a',
    },
    ...overrides,
  };
}

function decisionPayload(operationKind = 'APPROVE', overrides = {}) {
  const persisted = { APPROVE: 'APPROVED', REJECT: 'REJECTED', CANCEL: 'CANCELLED' }[operationKind];
  const decided = decision({ decision: persisted });
  return {
    receipt: receipt(operationKind),
    certificate: { ...certificate({ approved: true }), decision: decided },
    decision: decided,
    book: {
      id: 'book-a',
      revision: 2,
      pinnedContractHeadId: 'contract-head-a',
      pinnedContractVersionId: 'contract-a',
      pinnedAuthorityVersionId: 'authority-a',
      latestApprovedPeriodStart: operationKind === 'APPROVE' ? PERIOD.start : null,
      latestApprovedCertificateVersionId: operationKind === 'APPROVE' ? 'certificate-a' : null,
      pendingCertificateVersionId: null,
    },
    periodHead: {
      id: 'period-head-a',
      revision: 2,
      currentApprovedVersionId: operationKind === 'APPROVE' ? 'certificate-a' : null,
      latestVersionId: 'certificate-a',
    },
    ...overrides,
  };
}

function fakeAdapterPrisma(results) {
  const state = { calls: [], transactionOptions: [] };
  const database = {
    async $queryRawUnsafe(sql, ...args) {
      state.calls.push({ sql, args });
      const result = results[state.calls.length - 1];
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return {
    state,
    prisma: {
      $queryRawUnsafe: database.$queryRawUnsafe,
      async $transaction(operation, options) {
        state.transactionOptions.push(options);
        return operation(database);
      },
    },
  };
}

test('query accepts exactly one canonical periodDate and derives the civil fortnight', () => {
  assert.deepEqual(
    normalizeProjectCertificateReadQuery(new URLSearchParams('periodDate=2026-01-03')),
    { period: PERIOD },
  );
  for (const query of ['', 'periodDate=2026-01-03&periodDate=2026-01-04', 'periodDate=2026-1-3', 'tenant=attacker']) {
    assert.throws(
      () => normalizeProjectCertificateReadQuery(new URLSearchParams(query)),
      ProjectCertificateError,
    );
  }
});

test('prepare input is exact, ordered and supports only positive signed-BIGINT deductions', () => {
  const normalized = normalizeProjectCertificatePrepare({
    periodDate: '2026-01-03',
    expectedBookRevision: 0,
    expectedPeriodHeadRevision: 0,
    expectedCurrentApprovedVersionId: null,
    deductions: [{ code: 'ANTICIPO', reason: 'Descuento contractual.', amountMinor: '1' }],
  }, OPERATION_KEY);
  assert.deepEqual(normalized.period, PERIOD);
  assert.equal(normalized.deductions[0].amountMinor, '1');
  for (const amountMinor of [0, '0', '01', '1.0', '9223372036854775808']) {
    assert.throws(() => normalizeProjectCertificatePrepare({
      periodDate: '2026-01-03', expectedBookRevision: 0,
      expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null,
      deductions: [{ code: 'A', reason: 'Razón.', amountMinor }],
    }, OPERATION_KEY), ProjectCertificateError);
  }
  assert.throws(() => normalizeProjectCertificatePrepare({
    periodDate: '2026-01-03', expectedBookRevision: 0,
    expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null,
    deductions: [
      { code: 'A', reason: 'Razón A.', amountMinor: '1' },
      { code: 'A', reason: 'Razón B.', amountMinor: '2' },
    ],
  }, OPERATION_KEY), (error) => error.code === 'PROJECT_CERTIFICATE_DEDUCTIONS_INVALID');
});

test('decision input accepts only wire commands and exact CAS/digest fields', () => {
  const normalized = normalizeProjectCertificateDecision({
    expectedBookRevision: 1,
    expectedPeriodHeadRevision: 1,
    expectedCertificateDigest: HASH,
    decision: 'APPROVE',
    reason: 'Conformidad contractual.',
  }, OPERATION_KEY);
  assert.equal(normalized.decision, 'APPROVE');
  for (const decisionName of ['APPROVED', 'REJECTED', 'CANCELLED', 'approve']) {
    assert.throws(() => normalizeProjectCertificateDecision({
      ...normalized, decision: decisionName, operationKey: undefined,
    }, OPERATION_KEY), ProjectCertificateError);
  }
});

test('read adapter uses exact ABI and returns only the frozen public snapshot', async () => {
  const store = fakeAdapterPrisma([[{ payload: readPayload() }]]);
  const result = await readProjectCertificateSnapshot(store.prisma, {
    scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
  });
  assert.equal(result.organizationId, SCOPE.organizationId);
  assert.equal(result.requestedPeriod.start, PERIOD.start);
  assert.equal(result.historyLimit, 20);
  assert.equal(result.candidate.lines[0].cumulativeGrossMinor, '3125000');
  assert.equal(result.executionAllowed, false);
  assert.deepEqual(store.state.transactionOptions, [{ isolationLevel: 'ReadCommitted' }]);
  assert.match(store.state.calls[0].sql, /obrasaas_project_certificate_read/);
  assert.deepEqual(store.state.calls[0].args, [
    SCOPE.organizationId, SCOPE.projectId, PERIOD.start, ACTOR,
  ]);
});

test('rich read DTO keeps full current/pending facts and bounded requested-period summaries', async () => {
  const approved = certificate({
    approved: true,
    full: true,
    id: 'certificate-approved',
  });
  const pending = certificate({
    full: true,
    id: 'certificate-pending',
    projectSequence: '2',
    periodVersion: 2,
    predecessorId: 'certificate-approved',
    supersedesApprovedVersionId: 'certificate-approved',
  });
  const historyApproved = certificate({
    approved: true,
    id: 'certificate-approved',
  });
  const historyPending = certificate({
    id: 'certificate-pending',
    projectSequence: '2',
    periodVersion: 2,
    predecessorId: 'certificate-approved',
    supersedesApprovedVersionId: 'certificate-approved',
  });
  const payload = readPayload({
    book: {
      id: 'book-a', revision: 2,
      pinnedContractHeadId: 'contract-head-a',
      pinnedContractVersionId: 'contract-a',
      pinnedAuthorityVersionId: 'authority-a',
      latestApprovedPeriodStart: PERIOD.start,
      latestApprovedCertificateVersionId: 'certificate-approved',
      pendingCertificateVersionId: 'certificate-pending',
    },
    periodHead: {
      id: 'period-head-a', revision: 2,
      currentApprovedVersionId: 'certificate-approved',
      latestVersionId: 'certificate-pending',
    },
    currentApprovedCertificate: approved,
    pendingCertificate: pending,
    history: [historyPending, historyApproved],
    readiness: {
      state: 'REVIEW_PENDING', mode: null,
      blockingReasons: ['CERT_PENDING_REVIEW'], candidateReady: false,
    },
    candidate: null,
    capabilities: {
      read: { allowed: true, reasonCode: null },
      prepare: {
        allowed: false, reasonCode: 'CERT_NOT_READY', expectedActorMembershipId: ACTOR,
      },
      approve: {
        allowed: false, reasonCode: 'CERT_CERTIFIER_REQUIRED',
        expectedActorMembershipId: 'membership-director', targetId: 'certificate-pending',
      },
      reject: {
        allowed: false, reasonCode: 'CERT_CERTIFIER_REQUIRED',
        expectedActorMembershipId: 'membership-director', targetId: 'certificate-pending',
      },
      cancel: {
        allowed: false, reasonCode: 'CERT_CANCEL_NOT_ORPHANED',
        expectedActorMembershipId: 'membership-admin', targetId: 'certificate-pending',
      },
    },
  });
  const result = await readProjectCertificateSnapshot(null, {
    scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
  }, { sqlAdapter: { read: async () => [{ payload }] } });
  assert.equal(result.currentApprovedCertificate.id, 'certificate-approved');
  assert.equal(result.currentApprovedCertificate.lines.length, 1);
  assert.equal(result.pendingCertificate.id, 'certificate-pending');
  assert.equal(result.history.length, 2);
  assert.equal(result.history[0].lines, undefined);
  assert.equal(result.capabilities.approve.targetId, 'certificate-pending');
});

test('read DTO rejects unknown blockers, non-canonical ordering and invalid readiness/candidate pairs', async () => {
  const blocked = (blockingReasons) => readPayload({
    readiness: { state: 'BLOCKED', mode: null, blockingReasons, candidateReady: false },
    candidate: null,
    capabilities: {
      ...capabilities(),
      prepare: { allowed: false, reasonCode: 'CERT_NOT_READY', expectedActorMembershipId: ACTOR },
    },
  });
  for (const payload of [
    blocked(['UNKNOWN']),
    blocked(['CERT_TECHNICAL_CUT_STALE', 'CERT_AUTHORITY_REQUIRED']),
    readPayload({ candidate: null }),
    { ...readPayload(), current: null, pending: null },
  ]) {
    await assert.rejects(
      readProjectCertificateSnapshot(null, {
        scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
      }, { sqlAdapter: { read: async () => [{ payload }] } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
    );
  }
  assert.equal(PROJECT_CERTIFICATE_BLOCKER_CODES[0], 'CERT_PENDING_REVIEW');
});

test('read DTO represents an unchanged approved period as UP_TO_DATE without a candidate or blocker', async () => {
  const current = certificate({ approved: true, full: true });
  const payload = readPayload({
    book: {
      id: 'book-a', revision: 2,
      pinnedContractHeadId: 'contract-head-a',
      pinnedContractVersionId: 'contract-a',
      pinnedAuthorityVersionId: 'authority-a',
      latestApprovedPeriodStart: PERIOD.start,
      latestApprovedCertificateVersionId: current.id,
      pendingCertificateVersionId: null,
    },
    periodHead: {
      id: 'period-head-a', revision: 2,
      currentApprovedVersionId: current.id,
      latestVersionId: current.id,
    },
    currentApprovedCertificate: current,
    history: [certificate({ approved: true })],
    readiness: {
      state: 'UP_TO_DATE', mode: null, blockingReasons: [], candidateReady: false,
    },
    candidate: null,
    capabilities: {
      ...capabilities(),
      prepare: { allowed: false, reasonCode: 'CERT_NOT_READY', expectedActorMembershipId: null },
    },
  });
  const result = await readProjectCertificateSnapshot(null, {
    scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
  }, { sqlAdapter: { read: async () => [{ payload }] } });
  assert.deepEqual(result.readiness, {
    state: 'UP_TO_DATE', mode: null, blockingReasons: [], candidateReady: false,
  });
  assert.equal(result.currentApprovedCertificate.id, current.id);

  for (const readiness of [
    { state: 'UP_TO_DATE', mode: 'CORRECTION', blockingReasons: [], candidateReady: false },
    { state: 'UP_TO_DATE', mode: null, blockingReasons: ['CERT_TECHNICAL_CUT_STALE'], candidateReady: false },
    { state: 'UP_TO_DATE', mode: null, blockingReasons: [], candidateReady: true },
  ]) {
    await assert.rejects(
      readProjectCertificateSnapshot(null, {
        scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
      }, { sqlAdapter: { read: async () => [{ payload: readPayload({ readiness, candidate: null }) }] } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
    );
  }
  await assert.rejects(
    readProjectCertificateSnapshot(null, {
      scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
    }, { sqlAdapter: { read: async () => [{ payload: readPayload({
      readiness: { state: 'UP_TO_DATE', mode: null, blockingReasons: [], candidateReady: false },
      candidate: null,
      capabilities: {
        ...capabilities(),
        prepare: { allowed: false, reasonCode: 'CERT_NOT_READY', expectedActorMembershipId: null },
      },
    }) }] } }),
    (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
  );
});

test('certificate DTO rejects nested execution flags and keeps executionAllowed only at roots', async () => {
  await assert.rejects(
    prepareProjectCertificate(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: OPERATION_KEY,
      input: {
        periodDate: PERIOD.start, expectedBookRevision: 0,
        expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
      },
    }, { sqlAdapter: { prepare: async () => [{
      payload: preparePayload({
        certificate: { ...certificate(), executionAllowed: false },
      }),
    }] } }),
    (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
  );
});

test('full certificate DTO validates persisted deduction ordinals as one-based', async () => {
  const current = certificate({
    approved: true,
    full: true,
    deductionCount: 1,
    deductions: [deduction()],
    totals: {
      ...totals({ certificate: true }),
      certificateIncrementDeductionsMinor: '1',
      certificateIncrementNetMinor: '2968749',
    },
  });
  const snapshot = readPayload({
    book: {
      id: 'book-a',
      revision: 2,
      pinnedContractHeadId: 'contract-head-a',
      pinnedContractVersionId: 'contract-a',
      pinnedAuthorityVersionId: 'authority-a',
      latestApprovedPeriodStart: PERIOD.start,
      latestApprovedCertificateVersionId: current.id,
      pendingCertificateVersionId: null,
    },
    periodHead: {
      id: 'period-head-a',
      revision: 2,
      currentApprovedVersionId: current.id,
      latestVersionId: current.id,
    },
    currentApprovedCertificate: current,
    history: [certificate({ approved: true, deductionCount: 1, totals: current.totals })],
    readiness: {
      state: 'BLOCKED', mode: null,
      blockingReasons: ['CERT_TECHNICAL_CUT_STALE'], candidateReady: false,
    },
    candidate: null,
    capabilities: {
      ...capabilities(),
      prepare: { allowed: false, reasonCode: 'CERT_NOT_READY', expectedActorMembershipId: null },
    },
  });

  const result = await readProjectCertificateSnapshot(null, {
    scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
  }, { sqlAdapter: { read: async () => [{ payload: snapshot }] } });
  assert.equal(result.currentApprovedCertificate.deductions[0].ordinal, 1);
  assert.equal(result.currentApprovedCertificate.deductions[0].amountMinor, '1');
});

test('certificate projectSequence remains a canonical lossless signed-BIGINT string', async () => {
  const lossless = '9223372036854775807';
  const result = await prepareProjectCertificate(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: {
      periodDate: PERIOD.start, expectedBookRevision: 0,
      expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
    },
  }, { sqlAdapter: { prepare: async () => [{
    payload: preparePayload({ certificate: certificate({ projectSequence: lossless }) }),
  }] } });
  assert.equal(result.certificate.projectSequence, lossless);
  for (const projectSequence of [1, '01', '0', '9223372036854775808']) {
    await assert.rejects(
      prepareProjectCertificate(null, {
        scope: SCOPE,
        actorMembershipId: ACTOR,
        operationKey: OPERATION_KEY,
        input: {
          periodDate: PERIOD.start, expectedBookRevision: 0,
          expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
        },
      }, { sqlAdapter: { prepare: async () => [{
        payload: preparePayload({ certificate: certificate({ projectSequence }) }),
      }] } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
    );
  }
});

test('prepare uses frozen 10-argument ABI, binds maker/period and serializes zero amounts safely', async () => {
  const store = fakeAdapterPrisma([[{ payload: preparePayload() }]]);
  const result = await prepareProjectCertificate(store.prisma, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: {
      periodDate: PERIOD.start,
      expectedBookRevision: 0,
      expectedPeriodHeadRevision: 0,
      expectedCurrentApprovedVersionId: null,
      deductions: [],
    },
  });
  assert.equal(result.certificate.totals.previousApprovedCumulativeGrossMinor, '0');
  assert.equal(result.book.pendingCertificateVersionId, 'certificate-a');
  assert.deepEqual(Object.keys(result.receipt), [
    'operationReceiptId', 'operationKind', 'certificateVersionId', 'decisionId',
    'actorMembershipId', 'bookRevisionAfter', 'periodHeadRevisionAfter', 'replayed',
  ]);
  assert.equal(result.receipt.actorMembershipId, ACTOR);
  assert.equal(result.receipt.replayed, false);
  assert.equal(Object.hasOwn(result, 'replayed'), false);
  assert.equal(store.state.calls[0].args.length, 10);
  assert.match(store.state.calls[0].args[8], /^[a-f0-9]{64}$/);
  assert.deepEqual(store.state.transactionOptions, [{ isolationLevel: 'ReadCommitted' }]);
});

test('decision uses frozen 11-argument ABI and binds target, actor and wire-to-ledger state', async () => {
  const store = fakeAdapterPrisma([[{ payload: decisionPayload() }]]);
  const result = await decideProjectCertificate(store.prisma, {
    scope: SCOPE,
    actorMembershipId: 'membership-director',
    certificateVersionId: 'certificate-a',
    operationKey: 'certificate-operation-0002',
    input: {
      expectedBookRevision: 1,
      expectedPeriodHeadRevision: 1,
      expectedCertificateDigest: HASH,
      decision: 'APPROVE',
      reason: 'Conformidad contractual verificada.',
    },
  });
  assert.equal(result.decision.decision, 'APPROVED');
  assert.equal(result.certificate.id, 'certificate-a');
  assert.equal(result.receipt.operationKind, 'APPROVE');
  assert.equal(result.receipt.actorMembershipId, 'membership-director');
  assert.equal(Object.hasOwn(result, 'replayed'), false);
  assert.equal(store.state.calls[0].args.length, 11);
  assert.equal(store.state.calls[0].args[2], 'certificate-a');
  assert.equal(store.state.calls[0].args[6], 'APPROVE');

  await assert.rejects(
    decideProjectCertificate(null, {
      scope: SCOPE,
      actorMembershipId: 'membership-director',
      certificateVersionId: 'certificate-a',
      operationKey: 'certificate-operation-0002',
      input: {
        expectedBookRevision: 1,
        expectedPeriodHeadRevision: 1,
        expectedCertificateDigest: HASH,
        decision: 'APPROVE',
        reason: 'Conformidad contractual verificada.',
      },
    }, { sqlAdapter: { decide: async () => {
      const mismatchedDecision = decision({ decision: 'REJECTED' });
      return [{
        payload: decisionPayload('APPROVE', {
          decision: mismatchedDecision,
          certificate: {
            ...certificate({ approved: true }),
            decision: mismatchedDecision,
          },
        }),
      }];
    } } }),
    (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
  );
});

test('mutation serializer rejects a replay receipt for another actor, target or prepare period', async () => {
  for (const payload of [
    preparePayload({ receipt: receipt('PREPARE', { actorMembershipId: 'membership-attacker' }) }),
    preparePayload({ certificate: certificate({ period: { start: '2026-01-16', end: '2026-01-31' } }) }),
  ]) {
    await assert.rejects(
      prepareProjectCertificate(null, {
        scope: SCOPE,
        actorMembershipId: ACTOR,
        operationKey: OPERATION_KEY,
        input: {
          periodDate: PERIOD.start, expectedBookRevision: 0,
          expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null,
          deductions: [],
        },
      }, { sqlAdapter: { prepare: async () => [{ payload }] } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
    );
  }
  await assert.rejects(
    decideProjectCertificate(null, {
      scope: SCOPE,
      actorMembershipId: 'membership-director',
      certificateVersionId: 'certificate-a',
      operationKey: 'certificate-operation-0002',
      input: {
        expectedBookRevision: 1, expectedPeriodHeadRevision: 1,
        expectedCertificateDigest: HASH, decision: 'APPROVE', reason: 'Conforme.',
      },
    }, { sqlAdapter: { decide: async () => [{
      payload: decisionPayload('APPROVE', {
        receipt: receipt('APPROVE', { certificateVersionId: 'certificate-other' }),
      }),
    }] } }),
    (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID',
  );
});

test('invalid JSON/string/null payloads fail as one opaque persistence contract error', async () => {
  for (const payload of ['{bad json', 'null', '[]', null]) {
    await assert.rejects(
      readProjectCertificateSnapshot(null, {
        scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
      }, { sqlAdapter: { read: async () => [{ payload }] } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID'
        && error.status === 500,
    );
  }
  for (const rows of [[], [null], [{ payload: readPayload(), extra: true }]]) {
    await assert.rejects(
      readProjectCertificateSnapshot(null, {
        scope: SCOPE, actorMembershipId: ACTOR, query: { period: PERIOD },
      }, { sqlAdapter: { read: async () => rows } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_PERSISTENCE_CONTRACT_INVALID'
        && error.status === 500,
    );
  }
});

test('database errors map to opaque stable public failures', async () => {
  await assert.rejects(
    prepareProjectCertificate(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: OPERATION_KEY,
      input: {
        periodDate: PERIOD.start, expectedBookRevision: 0,
        expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
      },
    }, { sqlAdapter: { prepare: async () => { throw new Error('PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT private payload'); } } }),
    (error) => error.code === 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT'
      && error.status === 409
      && !error.message.includes('private payload'),
  );
  await assert.rejects(
    prepareProjectCertificate(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: OPERATION_KEY,
      input: {
        periodDate: PERIOD.start, expectedBookRevision: 0,
        expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
      },
    }, { sqlAdapter: { prepare: async () => {
      throw new Error('PROJECT_CERTIFICATE_PREPARER_REQUIRED membership-secret');
    } } }),
    (error) => error.code === 'PROJECT_CERTIFICATE_FORBIDDEN'
      && error.status === 403
      && !error.message.includes('membership-secret'),
  );
  for (const conflict of [
    Object.assign(new Error('Transaction failed due to a write conflict or a deadlock.'), {
      code: 'P2034',
    }),
    Object.assign(new Error('Raw query failed.'), {
      code: 'P2010',
      meta: { code: '40001' },
    }),
  ]) {
    await assert.rejects(
      prepareProjectCertificate(null, {
        scope: SCOPE,
        actorMembershipId: ACTOR,
        operationKey: OPERATION_KEY,
        input: {
          periodDate: PERIOD.start, expectedBookRevision: 0,
          expectedPeriodHeadRevision: 0, expectedCurrentApprovedVersionId: null, deductions: [],
        },
      }, { sqlAdapter: { prepare: async () => { throw conflict; } } }),
      (error) => error.code === 'PROJECT_CERTIFICATE_CONFLICT'
        && error.status === 409
        && !error.message.includes('write conflict')
        && !error.message.includes('Raw query'),
    );
  }
});

test('route membership guard requires active membership in exact tenant and non-archived project', async () => {
  const calls = [];
  const prisma = {
    projectMembership: {
      async findFirst(query) { calls.push(query); return { id: 'project-membership-a' }; },
    },
  };
  assert.equal(await requireProjectCertificateRouteMembership(prisma, {
    scope: SCOPE, actorMembershipId: ACTOR,
  }), ACTOR);
  assert.deepEqual(calls[0].where, {
    projectId: SCOPE.projectId,
    tenantMembershipId: ACTOR,
    status: 'ACTIVE',
    tenantMembership: { organizationId: SCOPE.organizationId, status: 'ACTIVE' },
    project: { organizationId: SCOPE.organizationId, status: { not: 'ARCHIVED' } },
  });
});
