import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  WorkerOnboardingError,
  decideWorkerOnboardingClaim,
  issueWorkerOnboardingClaim,
  issueWorkerOnboardingClaimWithReservation,
  listWorkerOnboardingClaims,
  submitAuthenticatedWorkerOnboardingClaim,
  submitAuthenticatedWorkerOnboardingFlow,
  submitWorkerOnboardingClaim,
} from '../src/lib/worker-onboarding.js';
import { workerFinancialFingerprint } from '../src/lib/worker-financial-data.js';
import {
  getCurrentWorkerOnboardingPrivacyNotice,
  getWorkerOnboardingPrivacyNotice,
} from '../src/lib/worker-onboarding-privacy-notices.js';

const NOW = new Date('2026-07-25T12:00:00.000Z');
const EXPIRES_AT = new Date('2026-07-25T13:00:00.000Z');
const SCOPE = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
});
const PHONE = '+15551230002';
const PROVIDER_SUBJECT = '15551230002';
const SENDER = Object.freeze({
  address: PHONE,
  providerSubject: PROVIDER_SUBJECT,
});
const CUIL = '20123456786';
const EVIDENCE_HASH = 'a'.repeat(64);
const CURRENT_NOTICE = getCurrentWorkerOnboardingPrivacyNotice();
const CLAIM_SENSITIVE_FIELDS = Object.freeze([
  'senderEncryptedPayload',
  'senderFingerprint',
  'senderFingerprintKeyId',
  'senderLastFour',
  'senderWrappingKeyId',
  'senderRecordVersion',
  'claimedIdentityEncryptedPayload',
  'claimedCuilFingerprint',
  'claimedCuilFingerprintKeyId',
  'claimedCuilLastFour',
  'claimedIdentityWrappingKeyId',
  'claimedIdentityRecordVersion',
]);

function assertClaimSensitiveDataPurged(claim, purgedAt) {
  for (const field of CLAIM_SENSITIVE_FIELDS) assert.equal(claim[field], null, field);
  assert.equal(new Date(claim.sensitiveDataPurgedAt).getTime(), new Date(purgedAt).getTime());
}

function token(byte = 7) {
  return createHash('sha256')
    .update(`worker-onboarding-token-${byte}`)
    .digest('base64url');
}

function identity(overrides = {}) {
  return {
    givenNames: 'Carlos Alberto',
    familyName: 'Perez',
    cuil: CUIL,
    privacyNoticeVersion: CURRENT_NOTICE.version,
    privacyAccepted: true,
    ...overrides,
  };
}

test('onboarding decisions reject revisions outside the PostgreSQL Int range', async () => {
  await assert.rejects(
    decideWorkerOnboardingClaim({}, {
      scope: SCOPE,
      claimId: 'claim-a',
      decidedByMembershipId: 'membership-a',
      decision: 'APPROVE',
      expectedRevision: 2_147_483_648,
      evidenceHash: EVIDENCE_HASH,
      policyVersion: 'worker-onboarding-dashboard-v1',
      idempotencyKey: 'onboarding-int32-boundary',
      now: NOW,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_INPUT_INVALID',
  );
});

function createDependencies() {
  const kekRegistry = {
    currentKeyId: 'kek-current',
    keys: new Map([
      ['kek-current', Buffer.alloc(32, 11)],
      ['kek-old', Buffer.alloc(32, 12)],
    ]),
  };
  const fingerprintRegistry = {
    currentKeyId: 'fp-current',
    keys: new Map([
      ['fp-old', Buffer.alloc(32, 21)],
      ['fp-current', Buffer.alloc(32, 22)],
    ]),
  };
  let randomCounter = 0;
  let idCounter = 0;
  return {
    kekRegistry,
    fingerprintRegistry,
    randomBytes(length) {
      randomCounter += 1;
      return createHash('sha256')
        .update(`worker-onboarding-test-random-${randomCounter}`)
        .digest()
        .subarray(0, length);
    },
    idFactory(kind) {
      idCounter += 1;
      return `${kind}-${idCounter}`;
    },
  };
}

function initialDatabase() {
  return {
    organizations: [{
      id: SCOPE.organizationId,
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    }],
    projects: [{
      id: SCOPE.projectId,
      organizationId: SCOPE.organizationId,
      status: 'ACTIVE',
    }],
    memberships: [
      {
        id: 'membership-director',
        organizationId: SCOPE.organizationId,
        userId: 'user-director',
        tenantRole: 'DIRECTOR',
        status: 'ACTIVE',
      },
      {
        id: 'membership-manager',
        organizationId: SCOPE.organizationId,
        userId: 'user-manager',
        tenantRole: 'SITE_MANAGER',
        status: 'ACTIVE',
      },
      {
        id: 'membership-disabled',
        organizationId: SCOPE.organizationId,
        userId: 'user-disabled',
        tenantRole: 'DIRECTOR',
        status: 'DISABLED',
      },
      {
        id: 'membership-unassigned-manager',
        organizationId: SCOPE.organizationId,
        userId: 'user-unassigned-manager',
        tenantRole: 'SITE_MANAGER',
        status: 'ACTIVE',
      },
    ],
    projectMemberships: [{
      id: 'project-membership-manager',
      projectId: SCOPE.projectId,
      tenantMembershipId: 'membership-manager',
      status: 'ACTIVE',
    }],
    connections: [{
      id: 'connection-a',
      projectId: SCOPE.projectId,
      enabled: true,
      connectionStatus: 'CONNECTED',
    }, {
      id: 'connection-b',
      projectId: SCOPE.projectId,
      enabled: true,
      connectionStatus: 'CONNECTED',
    }],
    claims: [],
    flowSessions: [],
    people: [],
    channels: [],
    workers: [],
    sensitiveDecisions: [],
    audits: [],
    counters: {
      worker: 0,
      decision: 0,
      audit: 0,
    },
  };
}

function scalarMatches(actual, expected) {
  if (expected instanceof Date) {
    return new Date(actual).getTime() === new Date(expected).getTime();
  }
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if (Array.isArray(expected.in)) return expected.in.includes(actual);
    if (Object.hasOwn(expected, 'lte')) {
      return new Date(actual).getTime() <= new Date(expected.lte).getTime();
    }
    if (Object.hasOwn(expected, 'gt')) {
      return new Date(actual).getTime() > new Date(expected.gt).getTime();
    }
    if (Object.hasOwn(expected, 'lt')) {
      if (actual instanceof Date || expected.lt instanceof Date) {
        return new Date(actual).getTime() < new Date(expected.lt).getTime();
      }
      return actual < expected.lt;
    }
  }
  return actual === expected;
}

function rowMatches(row, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'AND') return expected.every((candidate) => rowMatches(row, candidate));
    if (field === 'OR') return expected.some((candidate) => rowMatches(row, candidate));
    if (field === 'project') return true;
    return scalarMatches(row[field], expected);
  });
}

function applyData(row, data) {
  for (const [field, value] of Object.entries(data)) {
    if (
      value
      && typeof value === 'object'
      && !(value instanceof Date)
      && Object.hasOwn(value, 'increment')
    ) {
      row[field] = Number(row[field] || 0) + Number(value.increment);
    } else {
      row[field] = structuredClone(value);
    }
  }
}

function selected(row, select) {
  if (!row) return null;
  if (!select) return structuredClone(row);
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, include]) => include === true)
      .map(([field]) => [field, structuredClone(row[field])]),
  );
}

function createFakePrisma(seed = initialDatabase()) {
  let database = structuredClone(seed);
  const calls = [];
  const controls = {
    failAuditAction: null,
    failExpiredClaimCas: false,
    failFlowSessionSubmit: false,
    injectDecisionUniqueRace: false,
    injectIssueUniqueRace: null,
  };

  function makeClient(getTarget) {
    return {
      async $executeRawUnsafe(statement, key) {
        calls.push(['lock', statement, key]);
        return 1;
      },
      organization: {
        async findUnique({ where, select }) {
          return selected(
            getTarget().organizations.find((row) => row.id === where.id) || null,
            select,
          );
        },
      },
      project: {
        async findFirst({ where, select }) {
          return selected(
            getTarget().projects.find((row) => rowMatches(row, where)) || null,
            select,
          );
        },
      },
      tenantMembership: {
        async findFirst({ where, select }) {
          return selected(
            getTarget().memberships.find((row) => rowMatches(row, where)) || null,
            select,
          );
        },
      },
      projectMembership: {
        async findFirst({ where, select }) {
          return selected(
            getTarget().projectMemberships.find((row) => rowMatches(row, where)) || null,
            select,
          );
        },
      },
      whatsAppConnection: {
        async findFirst({ where, select }) {
          const row = getTarget().connections.find((candidate) => rowMatches(candidate, where));
          return selected(row || null, select);
        },
      },
      workerOnboardingClaim: {
        async findFirst({ where, select }) {
          const row = getTarget().claims.find((candidate) => rowMatches(candidate, where));
          return selected(row || null, select);
        },
        async findMany({ where, take, orderBy, select } = {}) {
          const target = getTarget();
          let rows = target.claims.filter((row) => rowMatches(row, where));
          if (orderBy) {
            rows = rows.sort((left, right) => {
              const created = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
              return created || right.id.localeCompare(left.id);
            });
          }
          if (take) rows = rows.slice(0, take);
          return rows.map((row) => {
            const result = selected(row, select);
            if (select?.flowSession) {
              const flowSession = target.flowSessions.find((candidate) => candidate.claimId === row.id);
              result.flowSession = selected(flowSession || null, select.flowSession.select);
            }
            return result;
          });
        },
        async create({ data }) {
          const target = getTarget();
          if (
            target.claims.some((row) => row.claimTokenHash === data.claimTokenHash)
            || target.claims.some((row) => (
              row.connectionId === data.connectionId && row.operationKey === data.operationKey
            ))
            || target.claims.some((row) => row.openClaimKey && row.openClaimKey === data.openClaimKey)
          ) {
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }
          const row = {
            claimedIdentityEncryptedPayload: null,
            claimedCuilFingerprint: null,
            claimedCuilFingerprintKeyId: null,
            claimedCuilLastFour: null,
            claimedIdentityWrappingKeyId: null,
            claimedIdentityRecordVersion: null,
            sensitiveDataPurgedAt: null,
            privacyNoticeVersion: null,
            privacyAcceptedAt: null,
            submittedAt: null,
            reviewedAt: null,
            reviewedById: null,
            reviewedByMembershipId: null,
            reviewEvidenceHash: null,
            rejectionReason: null,
            resolvedPersonId: null,
            resolvedChannelIdentityId: null,
            resolvedWorkerId: null,
            updatedAt: data.createdAt,
            ...structuredClone(data),
          };
          if (typeof controls.injectIssueUniqueRace === 'function') {
            const mutateConcurrentState = controls.injectIssueUniqueRace;
            controls.injectIssueUniqueRace = null;
            target.claims.push(row);
            database = structuredClone(target);
            mutateConcurrentState(database);
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }
          target.claims.push(row);
          return structuredClone(row);
        },
        async updateMany({ where, data }) {
          if (controls.failExpiredClaimCas && data.status === 'EXPIRED') {
            controls.failExpiredClaimCas = false;
            return { count: 0 };
          }
          const rows = getTarget().claims.filter((row) => rowMatches(row, where));
          rows.forEach((row) => applyData(row, data));
          return { count: rows.length };
        },
      },
      workerOnboardingFlowSession: {
        async findFirst({ where, select }) {
          const row = getTarget().flowSessions.find((candidate) => rowMatches(candidate, where));
          return selected(row || null, select);
        },
        async updateMany({ where, data }) {
          if (controls.failFlowSessionSubmit) return { count: 0 };
          const rows = getTarget().flowSessions.filter((row) => rowMatches(row, where));
          rows.forEach((row) => applyData(row, data));
          return { count: rows.length };
        },
      },
      workerPerson: {
        async findMany({ where, take }) {
          return getTarget().people
            .filter((row) => rowMatches(row, where))
            .slice(0, take || undefined)
            .map((row) => structuredClone(row));
        },
        async create({ data }) {
          const row = {
            identityVerifiedAt: null,
            identityVerifiedById: null,
            identityVerifiedByMembershipId: null,
            identityRejectedAt: null,
            identityRejectedById: null,
            identityRejectedByMembershipId: null,
            identityDecisionEvidenceHash: null,
            identityRejectionReason: null,
            createdAt: NOW,
            updatedAt: NOW,
            ...structuredClone(data),
          };
          getTarget().people.push(row);
          return structuredClone(row);
        },
        async updateMany({ where, data }) {
          const rows = getTarget().people.filter((row) => rowMatches(row, where));
          rows.forEach((row) => applyData(row, data));
          return { count: rows.length };
        },
      },
      workerChannelIdentity: {
        async findMany({ where, take }) {
          return getTarget().channels
            .filter((row) => rowMatches(row, where))
            .slice(0, take || undefined)
            .map((row) => structuredClone(row));
        },
        async create({ data }) {
          const row = {
            revokedAt: null,
            createdAt: NOW,
            updatedAt: NOW,
            ...structuredClone(data),
          };
          getTarget().channels.push(row);
          return structuredClone(row);
        },
        async updateMany({ where, data }) {
          const rows = getTarget().channels.filter((row) => rowMatches(row, where));
          rows.forEach((row) => applyData(row, data));
          return { count: rows.length };
        },
      },
      worker: {
        async findMany({ where, select }) {
          const project = getTarget().projects.find((row) => row.id === where.projectId);
          if (project?.organizationId !== where.project?.organizationId) return [];
          return getTarget().workers
            .filter((row) => row.projectId === where.projectId)
            .map((row) => selected(row, select));
        },
        async create({ data }) {
          const target = getTarget();
          target.counters.worker += 1;
          const row = {
            id: `worker-${target.counters.worker}`,
            role: null,
            createdAt: NOW,
            updatedAt: NOW,
            ...structuredClone(data),
          };
          target.workers.push(row);
          return structuredClone(row);
        },
        async updateMany({ where, data }) {
          const rows = getTarget().workers.filter((row) => rowMatches(row, where));
          rows.forEach((row) => applyData(row, data));
          return { count: rows.length };
        },
      },
      workerSensitiveDecision: {
        async findFirst({ where }) {
          return structuredClone(
            getTarget().sensitiveDecisions.find((row) => rowMatches(row, where)) || null,
          );
        },
        async create({ data }) {
          const target = getTarget();
          if (target.sensitiveDecisions.some((row) => (
            row.organizationId === data.organizationId && row.operationKey === data.operationKey
          ))) {
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }
          target.counters.decision += 1;
          const row = {
            id: `sensitive-decision-${target.counters.decision}`,
            workerPersonId: null,
            paymentDestinationId: null,
            ...structuredClone(data),
          };
          if (controls.injectDecisionUniqueRace) {
            controls.injectDecisionUniqueRace = false;
            target.sensitiveDecisions.push(row);
            database = structuredClone(target);
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }
          target.sensitiveDecisions.push(row);
          return structuredClone(row);
        },
      },
      auditLog: {
        async create({ data }) {
          if (controls.failAuditAction === data.action) throw new Error('audit unavailable');
          const target = getTarget();
          target.counters.audit += 1;
          const row = {
            id: `audit-${target.counters.audit}`,
            ...structuredClone(data),
          };
          target.audits.push(row);
          return structuredClone(row);
        },
      },
    };
  }

  const root = makeClient(() => database);
  root.$transaction = async (operation, options) => {
    calls.push(['transaction', options]);
    const draft = structuredClone(database);
    const result = await operation(makeClient(() => draft));
    database = draft;
    return result;
  };
  return {
    prisma: root,
    calls,
    controls,
    state: () => structuredClone(database),
    mutate(operation) {
      operation(database);
    },
  };
}

function issueArgs(dependencies, overrides = {}) {
  return {
    scope: SCOPE,
    connectionId: 'connection-a',
    sender: SENDER,
    claimToken: token(),
    expiresAt: EXPIRES_AT,
    issuedByMembershipId: 'membership-director',
    idempotencyKey: 'issue-request-001',
    now: NOW,
    dependencies,
    ...overrides,
  };
}

async function issuedAndSubmitted(database, dependencies, overrides = {}) {
  const issued = await issueWorkerOnboardingClaim(
    database.prisma,
    issueArgs(dependencies, overrides.issue),
  );
  const submitted = await submitWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    connectionId: 'connection-a',
    sender: SENDER,
    claimToken: token(),
    identity: identity(overrides.identity),
    now: new Date(NOW.getTime() + 60_000),
    dependencies,
    ...overrides.submit,
  });
  const submittedAt = new Date(submitted.submittedAt);
  database.mutate((state) => {
    state.flowSessions.push({
      id: `flow-session-${submitted.id}`,
      claimId: submitted.id,
      organizationId: SCOPE.organizationId,
      projectId: SCOPE.projectId,
      connectionId: 'connection-a',
      phoneNumberId: '123456789012345',
      blueprintKey: 'worker-onboarding',
      flowId: '887654321012345',
      screenId: 'WORKER_ONBOARDING',
      flowType: 'worker_onboarding',
      sourceExternalId: `obrasaas-worker-onboarding:${submitted.id}`,
      tokenSha256: 'b'.repeat(64),
      noticeVersion: CURRENT_NOTICE.version,
      noticeContentSha256: CURRENT_NOTICE.contentSha256,
      expiresAt: new Date(EXPIRES_AT),
      deliveryAttemptedAt: new Date(NOW.getTime() + 30_000),
      deliveryRejectedAt: null,
      sentAt: new Date(NOW.getTime() + 35_000),
      privacyPresentedAt: new Date(NOW.getTime() + 45_000),
      submittedAt,
      consumedAt: new Date(submittedAt.getTime() + 1_000),
      consumedExternalId: `wamid.receipt-${submitted.id}`,
      createdAt: NOW,
      updatedAt: new Date(submittedAt.getTime() + 1_000),
      ...structuredClone(overrides.flowSession || {}),
    });
  });
  return { issued, submitted };
}

function seedPendingFlowSession(database, claimId, overrides = {}) {
  const session = {
    id: `flow-session-${claimId}`,
    claimId,
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    connectionId: 'connection-a',
    phoneNumberId: '123456789012345',
    blueprintKey: 'worker-onboarding',
    flowId: '887654321012345',
    screenId: 'WORKER_ONBOARDING',
    flowType: 'worker_onboarding',
    sourceExternalId: `obrasaas-worker-onboarding:${claimId}`,
    tokenSha256: 'c'.repeat(64),
    noticeVersion: CURRENT_NOTICE.version,
    noticeContentSha256: CURRENT_NOTICE.contentSha256,
    expiresAt: new Date(EXPIRES_AT),
    deliveryAttemptedAt: new Date(NOW.getTime() + 30_000),
    deliveryRejectedAt: null,
    sentAt: new Date(NOW.getTime() + 35_000),
    privacyPresentedAt: new Date(NOW.getTime() + 45_000),
    submittedAt: null,
    consumedAt: null,
    consumedExternalId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...structuredClone(overrides),
  };
  database.mutate((state) => state.flowSessions.push(session));
  return session;
}

test('issue is an exact replay, rejects changed payload, and never returns the bearer token', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const first = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const replay = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const lateReplay = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
    now: new Date(EXPIRES_AT.getTime() - 60_000),
  }));

  assert.equal(first.status, 'PENDING');
  assert.equal(replay.id, first.id);
  assert.equal(replay.replayed, true);
  assert.equal(lateReplay.replayed, true);
  assert.equal(database.state().claims.length, 1);
  assert.doesNotMatch(JSON.stringify(first), new RegExp(token()));
  assert.equal(Object.hasOwn(first, 'claimToken'), false);

  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      claimToken: 'A'.repeat(43),
      idempotencyKey: 'issue-weak-token-001',
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_TOKEN_INVALID',
  );
  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      sender: PHONE,
      idempotencyKey: 'issue-string-sender-001',
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_INPUT_INVALID',
  );

  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      expiresAt: new Date(EXPIRES_AT.getTime() + 60_000),
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
  );
  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      sender: {
        address: PHONE,
        providerSubject: '15551230004',
      },
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
  );
});

test('a P2002 issue race revalidates membership and connection before any reservation', async (t) => {
  for (const candidate of [
    {
      name: 'membership revoked',
      mutate(state) {
        state.memberships.find((row) => row.id === 'membership-director').status = 'DISABLED';
      },
      expectedCode: 'WORKER_ONBOARDING_FORBIDDEN',
    },
    {
      name: 'connection revoked',
      mutate(state) {
        state.connections.find((row) => row.id === 'connection-a').enabled = false;
      },
      expectedCode: 'WORKER_ONBOARDING_SCOPE_INVALID',
    },
  ]) {
    await t.test(candidate.name, async () => {
      const database = createFakePrisma();
      const dependencies = createDependencies();
      database.controls.injectIssueUniqueRace = candidate.mutate;
      let reservations = 0;

      await assert.rejects(
        issueWorkerOnboardingClaimWithReservation(
          database.prisma,
          issueArgs(dependencies, {
            idempotencyKey: `issue-race-${candidate.name.replace(/\s+/g, '-')}`,
          }),
          async () => {
            reservations += 1;
            return { reserved: true };
          },
        ),
        (error) => error instanceof WorkerOnboardingError
          && error.code === candidate.expectedCode,
      );

      assert.equal(reservations, 0);
      assert.equal(database.state().claims.length, 1);
      assert.equal(database.state().audits.length, 0);
    });
  }
});

test('one open claim is enforced per project and sender across WhatsApp connections', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const claimA = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const connectionBRequest = issueArgs(dependencies, {
    connectionId: 'connection-b',
    claimToken: token(8),
    idempotencyKey: 'issue-connection-b-001',
    expiresAt: new Date('2026-07-25T14:00:00.000Z'),
    now: new Date(NOW.getTime() + 60_000),
  });

  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, connectionBRequest),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_CONFLICT',
  );
  assert.equal(database.state().claims.length, 1);
  assert.equal(database.state().claims[0].connectionId, 'connection-a');

  const claimB = await issueWorkerOnboardingClaim(database.prisma, {
    ...connectionBRequest,
    now: new Date(EXPIRES_AT.getTime() + 1),
  });
  const state = database.state();
  assert.equal(claimB.connectionId, 'connection-b');
  assert.equal(state.claims.length, 2);
  assert.equal(state.claims.find((claim) => claim.id === claimA.id).status, 'EXPIRED');
  assert.equal(state.claims.find((claim) => claim.id === claimA.id).openClaimKey, null);
  assert.equal(state.claims.find((claim) => claim.id === claimB.id).status, 'PENDING');
  assert.ok(state.claims.find((claim) => claim.id === claimB.id).openClaimKey);
});

test('issuing a replacement expires and purges each stale claim with a PII-free audit', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  const before = database.state().claims[0];
  const purgedAt = new Date(EXPIRES_AT.getTime() + 1);

  await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
    claimToken: token(8),
    idempotencyKey: 'issue-after-expiry-purge',
    now: purgedAt,
    expiresAt: new Date('2026-07-25T14:00:00.000Z'),
  }));

  const state = database.state();
  const expired = state.claims.find((claim) => claim.id === submitted.id);
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.openClaimKey, null);
  assertClaimSensitiveDataPurged(expired, purgedAt);
  assert.equal(expired.claimTokenHash, before.claimTokenHash);
  assert.equal(expired.operationKey, before.operationKey);
  assert.equal(expired.requestFingerprint, before.requestFingerprint);
  assert.equal(expired.privacyNoticeVersion, before.privacyNoticeVersion);
  assert.equal(expired.privacyNoticeContentSha256, before.privacyNoticeContentSha256);
  assert.equal(
    new Date(expired.privacyAcceptedAt).getTime(),
    new Date(before.privacyAcceptedAt).getTime(),
  );

  const expiryAudit = state.audits.find((audit) => (
    audit.action === 'worker.onboarding.expired' && audit.entityId === submitted.id
  ));
  assert.deepEqual(Object.keys(expiryAudit.metadata).sort(), [
    'projectId',
    'retentionState',
    'revision',
    'status',
  ]);
  assert.equal(expiryAudit.metadata.retentionState, 'PURGED');
  const serializedAudit = JSON.stringify(expiryAudit);
  for (const sensitiveValue of [PHONE, PROVIDER_SUBJECT, CUIL, token(), before.senderEncryptedPayload]) {
    assert.equal(serializedAudit.includes(sensitiveValue), false);
  }

  const expiredList = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'EXPIRED',
    now: purgedAt,
    dependencies,
  });
  const listed = expiredList.items.find((claim) => claim.id === submitted.id);
  assert.equal(listed.sender, null);
  assert.equal(listed.identity, null);
  assert.deepEqual(listed.retention, {
    state: 'PURGED',
    purgedAt: purgedAt.toISOString(),
  });
});

test('opportunistic expiry fails closed and rolls back issuance when its purge CAS loses', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  await issuedAndSubmitted(database, dependencies);
  const before = database.state();
  database.controls.failExpiredClaimCas = true;

  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      claimToken: token(8),
      idempotencyKey: 'issue-expiry-purge-cas-lost',
      now: new Date(EXPIRES_AT.getTime() + 1),
      expiresAt: new Date('2026-07-25T14:00:00.000Z'),
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_CONCURRENT_MODIFICATION',
  );

  assert.deepEqual(database.state(), before);
});

test('submission requires the same scoped sender and is idempotent only for the exact identity', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const input = {
    scope: SCOPE,
    connectionId: 'connection-a',
    sender: SENDER,
    claimToken: token(),
    identity: identity(),
    now: new Date(NOW.getTime() + 60_000),
    dependencies,
  };
  const first = await submitWorkerOnboardingClaim(database.prisma, input);
  const replay = await submitWorkerOnboardingClaim(database.prisma, {
    ...input,
    now: new Date(NOW.getTime() + 120_000),
  });
  assert.equal(first.status, 'SUBMITTED');
  assert.equal(replay.replayed, true);
  assert.equal(database.state().claims[0].revision, 1);
  assert.equal(
    database.state().claims[0].privacyNoticeContentSha256,
    CURRENT_NOTICE.contentSha256,
  );

  await assert.rejects(
    submitWorkerOnboardingClaim(database.prisma, {
      ...input,
      sender: PHONE,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_INPUT_INVALID',
  );

  await assert.rejects(
    submitWorkerOnboardingClaim(database.prisma, {
      ...input,
      identity: identity({ familyName: 'Pereyra' }),
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
  );
  await assert.rejects(
    submitWorkerOnboardingClaim(database.prisma, {
      ...input,
      sender: {
        address: PHONE,
        providerSubject: '15551230004',
      },
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_FORBIDDEN',
  );
  await assert.rejects(
    submitWorkerOnboardingClaim(database.prisma, {
      ...input,
      now: new Date(EXPIRES_AT.getTime() + 1),
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_EXPIRED'
      && error.status === 410,
  );
});

test('a trusted pre-worker Flow session submits by exact claim scope without exposing its bearer token', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const issued = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const input = {
    scope: SCOPE,
    connectionId: 'connection-a',
    claimId: issued.id,
    identity: identity(),
    now: new Date(NOW.getTime() + 60_000),
    dependencies,
  };

  const submitted = await submitAuthenticatedWorkerOnboardingClaim(database.prisma, input);
  const replay = await submitAuthenticatedWorkerOnboardingClaim(database.prisma, {
    ...input,
    now: new Date(NOW.getTime() + 120_000),
  });

  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(replay.replayed, true);
  assert.equal(database.state().claims[0].revision, 1);
  assert.equal(JSON.stringify({ submitted, replay }).includes(PHONE), false);
  assert.equal(JSON.stringify({ submitted, replay }).includes(CUIL), false);
  assert.equal(JSON.stringify({ submitted, replay }).includes(token()), false);

  await assert.rejects(
    submitAuthenticatedWorkerOnboardingClaim(database.prisma, {
      ...input,
      scope: { ...SCOPE, organizationId: 'organization-b' },
    }),
    (error) => error?.code === 'PROJECT_WRITE_SCOPE_INVALID',
  );
  await assert.rejects(
    submitAuthenticatedWorkerOnboardingClaim(database.prisma, {
      ...input,
      connectionId: 'connection-b',
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_NOT_FOUND',
  );
  await assert.rejects(
    submitAuthenticatedWorkerOnboardingClaim(database.prisma, {
      ...input,
      identity: identity({ familyName: 'Pereyra' }),
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
  );
});

test('authenticated Flow submission commits claim and session together and replays exactly', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const issued = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const session = seedPendingFlowSession(database, issued.id);
  const input = {
    scope: SCOPE,
    connectionId: session.connectionId,
    phoneNumberId: session.phoneNumberId,
    claimId: issued.id,
    sessionId: session.id,
    flowId: session.flowId,
    tokenSha256: session.tokenSha256,
    identity: identity(),
    now: new Date(NOW.getTime() + 60_000),
    dependencies,
  };

  const submitted = await submitAuthenticatedWorkerOnboardingFlow(database.prisma, input);
  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(database.state().claims[0].status, 'SUBMITTED');
  assert.equal(database.state().claims[0].privacyNoticeVersion, CURRENT_NOTICE.version);
  assert.equal(
    database.state().claims[0].privacyNoticeContentSha256,
    CURRENT_NOTICE.contentSha256,
  );
  assert.equal(
    new Date(database.state().flowSessions[0].submittedAt).getTime(),
    input.now.getTime(),
  );

  const replay = await submitAuthenticatedWorkerOnboardingFlow(database.prisma, input);
  assert.equal(replay.status, 'SUBMITTED');
  assert.equal(replay.replayed, true);
  assert.equal(
    database.state().audits.filter((audit) => audit.action === 'worker.onboarding.claim_submitted').length,
    1,
  );
});

test('authenticated Flow submission requires INIT and persists the session-pinned notice after rotation', async () => {
  const legacyNotice = getWorkerOnboardingPrivacyNotice('worker-privacy-v1');
  assert.notEqual(legacyNotice.version, CURRENT_NOTICE.version);

  const withoutInit = createFakePrisma();
  const withoutInitDependencies = createDependencies();
  const withoutInitClaim = await issueWorkerOnboardingClaim(
    withoutInit.prisma,
    issueArgs(withoutInitDependencies),
  );
  const unpresented = seedPendingFlowSession(withoutInit, withoutInitClaim.id, {
    privacyPresentedAt: null,
  });
  await assert.rejects(
    submitAuthenticatedWorkerOnboardingFlow(withoutInit.prisma, {
      scope: SCOPE,
      connectionId: unpresented.connectionId,
      phoneNumberId: unpresented.phoneNumberId,
      claimId: withoutInitClaim.id,
      sessionId: unpresented.id,
      flowId: unpresented.flowId,
      tokenSha256: unpresented.tokenSha256,
      identity: identity(),
      now: new Date(NOW.getTime() + 60_000),
      dependencies: withoutInitDependencies,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_FLOW_SESSION_INVALID',
  );
  assert.equal(withoutInit.state().claims[0].status, 'PENDING');

  const rotated = createFakePrisma();
  const rotatedDependencies = createDependencies();
  const rotatedClaim = await issueWorkerOnboardingClaim(
    rotated.prisma,
    issueArgs(rotatedDependencies),
  );
  const pinned = seedPendingFlowSession(rotated, rotatedClaim.id, {
    noticeVersion: legacyNotice.version,
    noticeContentSha256: legacyNotice.contentSha256,
  });
  const submitted = await submitAuthenticatedWorkerOnboardingFlow(rotated.prisma, {
    scope: SCOPE,
    connectionId: pinned.connectionId,
    phoneNumberId: pinned.phoneNumberId,
    claimId: rotatedClaim.id,
    sessionId: pinned.id,
    flowId: pinned.flowId,
    tokenSha256: pinned.tokenSha256,
    // Deliberately different: this value is never trusted by the atomic boundary.
    identity: identity({ privacyNoticeVersion: CURRENT_NOTICE.version }),
    now: new Date(NOW.getTime() + 60_000),
    dependencies: rotatedDependencies,
  });
  assert.equal(submitted.identity.privacyNoticeVersion, legacyNotice.version);
  assert.equal(rotated.state().claims[0].privacyNoticeVersion, legacyNotice.version);
  assert.equal(
    rotated.state().claims[0].privacyNoticeContentSha256,
    legacyNotice.contentSha256,
  );
});

test('authenticated Flow submission rolls back the claim when the session CAS loses', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const issued = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const session = seedPendingFlowSession(database, issued.id);
  database.controls.failFlowSessionSubmit = true;

  await assert.rejects(
    submitAuthenticatedWorkerOnboardingFlow(database.prisma, {
      scope: SCOPE,
      connectionId: session.connectionId,
      phoneNumberId: session.phoneNumberId,
      claimId: issued.id,
      sessionId: session.id,
      flowId: session.flowId,
      tokenSha256: session.tokenSha256,
      identity: identity(),
      now: new Date(NOW.getTime() + 60_000),
      dependencies,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_FLOW_SESSION_INVALID',
  );
  assert.equal(database.state().claims[0].status, 'PENDING');
  assert.equal(database.state().flowSessions[0].submittedAt, null);
  assert.equal(
    database.state().audits.some((audit) => audit.action === 'worker.onboarding.claim_submitted'),
    false,
  );
});

test('authenticated Flow submission rejects a concurrently rejected delivery before claim mutation', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const issued = await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies));
  const session = seedPendingFlowSession(database, issued.id, {
    deliveryRejectedAt: new Date(NOW.getTime() + 45_000),
  });

  await assert.rejects(
    submitAuthenticatedWorkerOnboardingFlow(database.prisma, {
      scope: SCOPE,
      connectionId: session.connectionId,
      phoneNumberId: session.phoneNumberId,
      claimId: issued.id,
      sessionId: session.id,
      flowId: session.flowId,
      tokenSha256: session.tokenSha256,
      identity: identity(),
      now: new Date(NOW.getTime() + 60_000),
      dependencies,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_FLOW_SESSION_INVALID',
  );
  assert.equal(database.state().claims[0].status, 'PENDING');
  assert.equal(database.state().audits.length, 1);
});

test('cross-tenant and inactive membership attempts fail closed', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      scope: { organizationId: 'organization-b', projectId: SCOPE.projectId },
    })),
    (error) => error?.code === 'PROJECT_WRITE_SCOPE_INVALID',
  );
  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      issuedByMembershipId: 'membership-disabled',
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_FORBIDDEN',
  );
  await assert.rejects(
    issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
      issuedByMembershipId: 'membership-unassigned-manager',
      idempotencyKey: 'issue-unassigned-001',
    })),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_FORBIDDEN',
  );
  assert.equal(database.state().claims.length, 0);
});

test('approval requires the exact terminal WhatsApp receipt while rejection remains available', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies, {
    flowSession: { consumedAt: null, consumedExternalId: null },
  });
  const decisionInput = {
    scope: SCOPE,
    claimId: submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVE',
    expectedRevision: submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-receipt-required',
    now: new Date(NOW.getTime() + 180_000),
    dependencies,
  };

  await assert.rejects(
    decideWorkerOnboardingClaim(database.prisma, decisionInput),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_TERMINAL_RECEIPT_REQUIRED',
  );
  assert.equal(database.state().claims[0].status, 'SUBMITTED');
  assert.equal(database.state().people.length, 0);

  database.mutate((state) => {
    state.flowSessions[0].consumedAt = new Date(NOW.getTime() + 120_000);
    state.flowSessions[0].consumedExternalId = 'wamid.receipt-confirmed';
  });
  const approved = await decideWorkerOnboardingClaim(database.prisma, decisionInput);
  assert.equal(approved.status, 'APPROVED');

  const rejectedDatabase = createFakePrisma();
  const rejectedDependencies = createDependencies();
  const rejectedSubmission = await issuedAndSubmitted(
    rejectedDatabase,
    rejectedDependencies,
    { flowSession: { consumedAt: null, consumedExternalId: null } },
  );
  const rejectedBeforeDecision = rejectedDatabase.state().claims[0];
  const rejected = await decideWorkerOnboardingClaim(rejectedDatabase.prisma, {
    ...decisionInput,
    claimId: rejectedSubmission.submitted.id,
    decision: 'REJECT',
    rejectionReason: 'No se completo la verificacion terminal.',
    idempotencyKey: 'decision-receipt-reject-cleanup',
    dependencies: rejectedDependencies,
  });
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.sender, null);
  assert.equal(rejected.identity, null);
  assert.deepEqual(rejected.retention, {
    state: 'PURGED',
    purgedAt: decisionInput.now.toISOString(),
  });
  const rejectedClaim = rejectedDatabase.state().claims[0];
  assertClaimSensitiveDataPurged(rejectedClaim, decisionInput.now);
  assert.equal(rejectedClaim.claimTokenHash, rejectedBeforeDecision.claimTokenHash);
  assert.equal(rejectedClaim.privacyNoticeVersion, rejectedBeforeDecision.privacyNoticeVersion);
  assert.equal(
    rejectedClaim.privacyNoticeContentSha256,
    rejectedBeforeDecision.privacyNoticeContentSha256,
  );
  assert.equal(rejectedClaim.rejectionReason, 'No se completo la verificacion terminal.');
});

test('approval atomically creates a pending civil identity, verified channel, null-phone bridge, decision and safe audit', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  const claimBeforeDecision = database.state().claims[0];
  const claimCiphertext = claimBeforeDecision.claimedIdentityEncryptedPayload;
  const decisionAt = new Date(NOW.getTime() + 180_000);

  const approved = await decideWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    claimId: submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVE',
    expectedRevision: submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-request-001',
    now: decisionAt,
    dependencies,
  });
  const state = database.state();
  const purgedClaim = state.claims[0];
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.sender, null);
  assert.equal(approved.identity, null);
  assert.deepEqual(approved.retention, {
    state: 'PURGED',
    purgedAt: decisionAt.toISOString(),
  });
  assertClaimSensitiveDataPurged(purgedClaim, decisionAt);
  assert.equal(purgedClaim.claimTokenHash, claimBeforeDecision.claimTokenHash);
  assert.equal(purgedClaim.operationKey, claimBeforeDecision.operationKey);
  assert.equal(purgedClaim.requestFingerprint, claimBeforeDecision.requestFingerprint);
  assert.equal(purgedClaim.privacyNoticeVersion, claimBeforeDecision.privacyNoticeVersion);
  assert.equal(
    purgedClaim.privacyNoticeContentSha256,
    claimBeforeDecision.privacyNoticeContentSha256,
  );
  assert.equal(
    new Date(purgedClaim.privacyAcceptedAt).getTime(),
    new Date(claimBeforeDecision.privacyAcceptedAt).getTime(),
  );
  assert.equal(state.people.length, 1);
  assert.equal(state.people[0].identityStatus, 'PENDING_REVIEW');
  assert.notEqual(state.people[0].encryptedIdentityPayload, claimCiphertext);
  assert.equal(state.channels.length, 1);
  assert.equal(state.channels[0].status, 'VERIFIED');
  assert.equal(state.workers.length, 1);
  assert.equal(state.workers[0].phone, null);
  assert.equal(state.sensitiveDecisions.length, 1);
  assert.equal(state.sensitiveDecisions[0].action, 'ONBOARDING_APPROVED');

  const decisionAudit = state.audits.find((audit) => audit.action === 'worker.onboarding.approved');
  assert.deepEqual(Object.keys(decisionAudit.metadata).sort(), [
    'decisionId',
    'projectId',
    'revision',
    'status',
  ]);
  const exposed = JSON.stringify({ approved, audits: state.audits });
  for (const secret of [PHONE, CUIL, token(), EVIDENCE_HASH, claimCiphertext]) {
    assert.equal(exposed.includes(secret), false);
  }
  assert.equal(exposed.includes('Carlos Alberto'), false);

  for (const retiredOperation of [
    () => issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies)),
    () => submitWorkerOnboardingClaim(database.prisma, {
      scope: SCOPE,
      connectionId: 'connection-a',
      sender: SENDER,
      claimToken: token(),
      identity: identity(),
      now: new Date(NOW.getTime() + 200_000),
      dependencies,
    }),
    () => submitAuthenticatedWorkerOnboardingClaim(database.prisma, {
      scope: SCOPE,
      connectionId: 'connection-a',
      claimId: submitted.id,
      identity: identity(),
      now: new Date(NOW.getTime() + 200_000),
      dependencies,
    }),
  ]) {
    await assert.rejects(
      retiredOperation(),
      (error) => error instanceof WorkerOnboardingError
        && error.code === 'WORKER_ONBOARDING_RETIRED'
        && error.status === 410,
    );
  }

  dependencies.kekRegistry.keys.clear();
  dependencies.fingerprintRegistry.keys.clear();
  const replay = await decideWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    claimId: submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVED',
    expectedRevision: submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-request-001',
    now: new Date(NOW.getTime() + 240_000),
    dependencies,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.sender, null);
  assert.equal(replay.identity, null);
  assert.deepEqual(replay.retention, approved.retention);
  assert.equal(database.state().sensitiveDecisions.length, 1);

  await assert.rejects(
    decideWorkerOnboardingClaim(database.prisma, {
      scope: SCOPE,
      claimId: submitted.id,
      decidedByMembershipId: 'membership-director',
      decision: 'REJECT',
      expectedRevision: submitted.revision,
      evidenceHash: EVIDENCE_HASH,
      policyVersion: 'onboarding-policy-v1',
      rejectionReason: 'Datos inconsistentes',
      idempotencyKey: 'decision-request-001',
      now: new Date(NOW.getTime() + 240_000),
      dependencies,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_IDEMPOTENCY_CONFLICT',
  );
});

test('decision ledger, domain state and resolution all roll back when the audit write fails', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  const before = database.state();
  database.controls.failAuditAction = 'worker.onboarding.approved';

  await assert.rejects(
    decideWorkerOnboardingClaim(database.prisma, {
      scope: SCOPE,
      claimId: submitted.id,
      decidedByMembershipId: 'membership-director',
      decision: 'APPROVE',
      expectedRevision: submitted.revision,
      evidenceHash: EVIDENCE_HASH,
      policyVersion: 'onboarding-policy-v1',
      idempotencyKey: 'decision-request-atomic',
      now: new Date(NOW.getTime() + 180_000),
      dependencies,
    }),
    /audit unavailable/,
  );
  const after = database.state();
  assert.equal(after.claims[0].status, 'SUBMITTED');
  assert.equal(after.claims[0].revision, before.claims[0].revision);
  assert.deepEqual(after.people, before.people);
  assert.deepEqual(after.channels, before.channels);
  assert.deepEqual(after.workers, before.workers);
  assert.deepEqual(after.sensitiveDecisions, before.sensitiveDecisions);
});

test('decision revisions require a real non-negative Prisma int without coercion', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  for (const invalidRevision of [false, null, '0', 0.5, 2_147_483_648]) {
    await assert.rejects(
      decideWorkerOnboardingClaim(database.prisma, {
        scope: SCOPE,
        claimId: submitted.id,
        decidedByMembershipId: 'membership-director',
        decision: 'APPROVE',
        expectedRevision: invalidRevision,
        evidenceHash: EVIDENCE_HASH,
        policyVersion: 'onboarding-policy-v1',
        idempotencyKey: 'decision-invalid-revision',
        now: new Date(NOW.getTime() + 180_000),
        dependencies,
      }),
      (error) => error instanceof WorkerOnboardingError
        && error.code === 'WORKER_ONBOARDING_INPUT_INVALID',
    );
  }
  assert.equal(database.state().claims[0].status, 'SUBMITTED');
  assert.equal(database.state().sensitiveDecisions.length, 0);
});

test('a concurrent decision unique race re-reads the exact ledger and returns one replay', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  database.controls.injectDecisionUniqueRace = true;
  const result = await decideWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    claimId: submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVE',
    expectedRevision: submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-concurrent-race',
    now: new Date(NOW.getTime() + 180_000),
    dependencies,
  });
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.replayed, true);
  assert.equal(database.state().sensitiveDecisions.length, 1);
  assert.equal(database.state().claims[0].status, 'APPROVED');
});

test('submission replay and approval remain safe across retained fingerprint and KEK rotation', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  const storedClaimKeyId = database.state().claims[0].claimedCuilFingerprintKeyId;
  dependencies.fingerprintRegistry.keys.set('fp-next', Buffer.alloc(32, 23));
  dependencies.fingerprintRegistry.currentKeyId = 'fp-next';
  dependencies.kekRegistry.keys.set('kek-next', Buffer.alloc(32, 13));
  dependencies.kekRegistry.currentKeyId = 'kek-next';

  const replay = await submitWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    connectionId: 'connection-a',
    sender: SENDER,
    claimToken: token(),
    identity: identity(),
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  assert.equal(replay.replayed, true);
  assert.equal(database.state().claims[0].claimedCuilFingerprintKeyId, storedClaimKeyId);

  const approved = await decideWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    claimId: submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVE',
    expectedRevision: submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-after-rotation',
    now: new Date(NOW.getTime() + 180_000),
    dependencies,
  });
  const state = database.state();
  assert.equal(approved.status, 'APPROVED');
  assert.equal(state.people[0].cuilFingerprintKeyId, 'fp-next');
  assert.equal(state.people[0].wrappingKeyId, 'kek-next');
  assert.equal(state.channels[0].addressFingerprintKeyId, 'fp-next');
  assert.equal(state.channels[0].wrappingKeyId, 'kek-next');
});

test('approval rejects multi-key ambiguity and safely adopts one unlinked legacy phone', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  const current = workerFinancialFingerprint(CUIL, {
    organizationId: SCOPE.organizationId,
    valueType: 'CUIL',
  }, {
    registry: dependencies.fingerprintRegistry,
    keyId: 'fp-current',
  });
  const old = workerFinancialFingerprint(CUIL, {
    organizationId: SCOPE.organizationId,
    valueType: 'CUIL',
  }, {
    registry: dependencies.fingerprintRegistry,
    keyId: 'fp-old',
  });
  database.mutate((state) => {
    state.people.push(
      {
        id: 'ambiguous-person-current',
        organizationId: SCOPE.organizationId,
        status: 'ACTIVE',
        identityStatus: 'PENDING_REVIEW',
        cuilFingerprint: current.fingerprint,
        cuilFingerprintKeyId: current.fingerprintKeyId,
      },
      {
        id: 'ambiguous-person-old',
        organizationId: SCOPE.organizationId,
        status: 'ACTIVE',
        identityStatus: 'PENDING_REVIEW',
        cuilFingerprint: old.fingerprint,
        cuilFingerprintKeyId: old.fingerprintKeyId,
      },
    );
  });
  await assert.rejects(
    decideWorkerOnboardingClaim(database.prisma, {
      scope: SCOPE,
      claimId: submitted.id,
      decidedByMembershipId: 'membership-director',
      decision: 'APPROVE',
      expectedRevision: submitted.revision,
      evidenceHash: EVIDENCE_HASH,
      policyVersion: 'onboarding-policy-v1',
      idempotencyKey: 'decision-rotation-conflict',
      now: new Date(NOW.getTime() + 180_000),
      dependencies,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_IDENTITY_CONFLICT',
  );
  assert.equal(database.state().claims[0].status, 'SUBMITTED');
  assert.equal(database.state().sensitiveDecisions.length, 0);

  const legacyDatabase = createFakePrisma();
  const legacyDependencies = createDependencies();
  const legacySubmission = await issuedAndSubmitted(legacyDatabase, legacyDependencies);
  legacyDatabase.mutate((state) => {
    state.workers.push({
      id: 'legacy-worker',
      organizationId: null,
      projectId: SCOPE.projectId,
      personId: null,
      phone: PHONE,
      name: 'Legacy',
      active: true,
      metadata: null,
    });
  });
  const adopted = await decideWorkerOnboardingClaim(legacyDatabase.prisma, {
    scope: SCOPE,
    claimId: legacySubmission.submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVE',
    expectedRevision: legacySubmission.submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-legacy-adoption',
    now: new Date(NOW.getTime() + 180_000),
    dependencies: legacyDependencies,
  });
  const legacyState = legacyDatabase.state();
  assert.equal(adopted.status, 'APPROVED');
  assert.equal(legacyState.people.length, 1);
  assert.equal(legacyState.channels.length, 1);
  assert.equal(legacyState.workers.length, 1);
  assert.equal(legacyState.workers[0].id, 'legacy-worker');
  assert.equal(legacyState.workers[0].organizationId, SCOPE.organizationId);
  assert.equal(legacyState.workers[0].personId, legacyState.people[0].id);
  assert.equal(legacyState.workers[0].phone, null);
  assert.equal(legacyState.sensitiveDecisions.length, 1);
});

test('approval rejects a WhatsApp channel already bound to another person and rolls back', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies);
  const addressFingerprint = workerFinancialFingerprint(PHONE, {
    organizationId: SCOPE.organizationId,
    valueType: 'WHATSAPP_E164',
  }, { registry: dependencies.fingerprintRegistry });
  const subjectFingerprint = workerFinancialFingerprint(PROVIDER_SUBJECT, {
    organizationId: SCOPE.organizationId,
    valueType: 'WHATSAPP_PROVIDER_SUBJECT',
  }, { registry: dependencies.fingerprintRegistry });
  database.mutate((state) => {
    state.channels.push({
      id: 'conflicting-channel',
      organizationId: SCOPE.organizationId,
      personId: 'different-person',
      provider: 'WHATSAPP',
      status: 'VERIFIED',
      addressFingerprint: addressFingerprint.fingerprint,
      addressFingerprintKeyId: addressFingerprint.fingerprintKeyId,
      providerSubjectFingerprint: subjectFingerprint.fingerprint,
      providerSubjectFingerprintKeyId: subjectFingerprint.fingerprintKeyId,
      revision: 0,
    });
  });
  await assert.rejects(
    decideWorkerOnboardingClaim(database.prisma, {
      scope: SCOPE,
      claimId: submitted.id,
      decidedByMembershipId: 'membership-director',
      decision: 'APPROVE',
      expectedRevision: submitted.revision,
      evidenceHash: EVIDENCE_HASH,
      policyVersion: 'onboarding-policy-v1',
      idempotencyKey: 'decision-channel-conflict',
      now: new Date(NOW.getTime() + 180_000),
      dependencies,
    }),
    (error) => error instanceof WorkerOnboardingError
      && error.code === 'WORKER_ONBOARDING_CHANNEL_CONFLICT',
  );
  const state = database.state();
  assert.equal(state.claims[0].status, 'SUBMITTED');
  assert.equal(state.people.length, 0);
  assert.equal(state.channels.length, 1);
  assert.equal(state.workers.length, 0);
  assert.equal(state.sensitiveDecisions.length, 0);
});

test('list projects fail-closed WhatsApp readiness and only the worker resolution anchor', async () => {
  const preparedDatabase = createFakePrisma();
  const preparedDependencies = createDependencies();
  const prepared = await issueWorkerOnboardingClaim(
    preparedDatabase.prisma,
    issueArgs(preparedDependencies),
  );
  let preparedList = await listWorkerOnboardingClaims(preparedDatabase.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'PENDING',
    now: new Date(NOW.getTime() + 120_000),
    dependencies: preparedDependencies,
  });
  assert.equal(preparedList.items[0].verification.state, 'PREPARED');
  assert.equal(preparedList.items[0].reviewReady, false);

  seedPendingFlowSession(preparedDatabase, prepared.id);
  preparedList = await listWorkerOnboardingClaims(preparedDatabase.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'PENDING',
    now: new Date(NOW.getTime() + 120_000),
    dependencies: preparedDependencies,
  });
  assert.equal(preparedList.items[0].verification.state, 'AWAITING_SUBMISSION');
  preparedDatabase.mutate((state) => {
    state.flowSessions[0].deliveryRejectedAt = new Date(NOW.getTime() + 50_000);
  });
  preparedList = await listWorkerOnboardingClaims(preparedDatabase.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'PENDING',
    now: new Date(NOW.getTime() + 120_000),
    dependencies: preparedDependencies,
  });
  assert.equal(preparedList.items[0].verification.state, 'REJECTED');
  assert.equal(preparedList.items[0].reviewReady, false);

  const database = createFakePrisma();
  const dependencies = createDependencies();
  const { submitted } = await issuedAndSubmitted(database, dependencies, {
    flowSession: { consumedAt: null, consumedExternalId: null },
  });
  let list = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'SUBMITTED',
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  assert.equal(list.items[0].verification.state, 'AWAITING_RECEIPT');
  assert.equal(list.items[0].verification.verifiedAt, null);
  assert.equal(list.items[0].reviewReady, false);

  database.mutate((state) => {
    state.flowSessions[0].consumedAt = new Date(NOW.getTime() + 120_000);
    state.flowSessions[0].consumedExternalId = 'wamid.receipt-confirmed';
    state.flowSessions[0].noticeContentSha256 = 'f'.repeat(64);
  });
  list = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'SUBMITTED',
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  assert.equal(list.items[0].verification.state, 'AWAITING_RECEIPT');
  assert.equal(list.items[0].verification.verifiedAt, null);
  assert.equal(list.items[0].reviewReady, false);

  database.mutate((state) => {
    state.flowSessions[0].noticeContentSha256 = CURRENT_NOTICE.contentSha256;
  });
  list = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'SUBMITTED',
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  const readyItem = list.items[0];
  assert.equal(readyItem.verification.state, 'VERIFIED');
  assert.equal(readyItem.verification.verifiedAt, new Date(NOW.getTime() + 120_000).toISOString());
  assert.equal(readyItem.reviewReady, true);
  for (const field of ['organizationId', 'projectId', 'connectionId', 'personId', 'channelIdentityId']) {
    assert.equal(Object.hasOwn(readyItem, field), false);
  }
  const serializedReadyItem = JSON.stringify(readyItem);
  for (const internalValue of [
    `flow-session-${submitted.id}`,
    '123456789012345',
    '887654321012345',
    'wamid.receipt-confirmed',
  ]) {
    assert.equal(serializedReadyItem.includes(internalValue), false);
  }

  await decideWorkerOnboardingClaim(database.prisma, {
    scope: SCOPE,
    claimId: submitted.id,
    decidedByMembershipId: 'membership-director',
    decision: 'APPROVE',
    expectedRevision: submitted.revision,
    evidenceHash: EVIDENCE_HASH,
    policyVersion: 'onboarding-policy-v1',
    idempotencyKey: 'decision-list-minimal-resolution',
    now: new Date(NOW.getTime() + 180_000),
    dependencies,
  });
  const approvedList = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    status: 'APPROVED',
    now: new Date(NOW.getTime() + 240_000),
    dependencies,
  });
  assert.equal(approvedList.items[0].reviewReady, false);
  assert.deepEqual(
    approvedList.items[0].resolution,
    { workerId: database.state().workers[0].id },
  );
});

test('list is cursor bounded, resolves effective expiry and exposes legal name only to an authorized reviewer', async () => {
  const database = createFakePrisma();
  const dependencies = createDependencies();
  await issuedAndSubmitted(database, dependencies);
  const claims = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-manager',
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  assert.equal(claims.items.length, 1);
  assert.equal(claims.items[0].status, 'SUBMITTED');
  assert.equal(claims.items[0].identity.legalName, 'Carlos Alberto Perez');
  assert.equal(claims.items[0].verification.state, 'VERIFIED');
  assert.equal(claims.items[0].reviewReady, true);
  assert.equal(claims.nextCursor, null);
  const serialized = JSON.stringify(claims);
  assert.equal(serialized.includes(PHONE), false);
  assert.equal(serialized.includes(CUIL), false);
  assert.equal(serialized.includes(token()), false);
  assert.equal(serialized.includes('encrypted'), false);
  assert.equal(serialized.includes('Fingerprint'), false);

  await issueWorkerOnboardingClaim(database.prisma, issueArgs(dependencies, {
    sender: {
      address: '+15551230003',
      providerSubject: '15551230003',
    },
    claimToken: token(8),
    idempotencyKey: 'issue-request-002',
  }));
  const firstPage = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-director',
    limit: 1,
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  assert.equal(firstPage.items.length, 1);
  assert.ok(firstPage.nextCursor);
  const secondPage = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-director',
    limit: 1,
    cursor: firstPage.nextCursor,
    now: new Date(NOW.getTime() + 120_000),
    dependencies,
  });
  assert.equal(secondPage.items.length, 1);
  assert.notEqual(secondPage.items[0].id, firstPage.items[0].id);

  const expired = await listWorkerOnboardingClaims(database.prisma, {
    scope: SCOPE,
    requestedByMembershipId: 'membership-director',
    status: 'EXPIRED',
    now: new Date(EXPIRES_AT.getTime() + 1),
    dependencies,
  });
  assert.equal(expired.items.length, 2);
  assert.ok(expired.items.every((claim) => claim.status === 'EXPIRED'));
  assert.ok(expired.items.every((claim) => claim.sender === null));
  assert.ok(expired.items.every((claim) => claim.identity === null));
  assert.ok(expired.items.every((claim) => (
    claim.retention.state === 'PENDING_PURGE'
    && claim.retention.purgedAt === null
  )));
});
