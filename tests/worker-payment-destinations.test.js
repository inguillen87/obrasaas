import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  WorkerPaymentDestinationError,
  activateWorkerPaymentDestination,
  listWorkerPaymentDestinations,
  rejectWorkerPaymentDestination,
  revokeWorkerPaymentDestination,
  submitWorkerPaymentDestination,
  verifyWorkerPaymentDestination,
} from '../src/lib/worker-payment-destinations.js';
import {
  workerFinancialFingerprint,
} from '../src/lib/worker-financial-data.js';

const TEST_CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const TEST_BANK_BLOCK_ONE_WEIGHTS = [7, 1, 3, 9, 7, 1, 3];
const TEST_BANK_BLOCK_TWO_WEIGHTS = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];

function syntheticModuloCheckDigit(digits, weights) {
  const sum = weights.reduce(
    (total, weight, index) => total + Number(digits[index]) * weight,
    0,
  );
  return (10 - (sum % 10)) % 10;
}

function syntheticCuil(prefix = '20', document = '00000000') {
  const firstTenDigits = `${prefix}${document}`;
  const sum = TEST_CUIT_WEIGHTS.reduce(
    (total, weight, index) => total + Number(firstTenDigits[index]) * weight,
    0,
  );
  const candidate = 11 - (sum % 11);
  const checkDigit = candidate === 11 ? 0 : candidate === 10 ? 9 : candidate;
  return `${firstTenDigits}${checkDigit}`;
}

function syntheticBankKey(firstSevenDigits, accountThirteenDigits) {
  return [
    firstSevenDigits,
    syntheticModuloCheckDigit(firstSevenDigits, TEST_BANK_BLOCK_ONE_WEIGHTS),
    accountThirteenDigits,
    syntheticModuloCheckDigit(accountThirteenDigits, TEST_BANK_BLOCK_TWO_WEIGHTS),
  ].join('');
}

const CUIL = syntheticCuil();
const OTHER_CUIL = syntheticCuil('27', '00000001');
const CBU = syntheticBankKey('9999999', '0000000000000');
const OTHER_CBU = syntheticBankKey('8888888', '0000000000001');
const THIRD_CBU = syntheticBankKey('7777777', '0000000000002');
const CVU = syntheticBankKey('0000001', '0000000000000');
const NOW = new Date('2026-07-25T15:00:00.000Z');

function keyConfiguration({
  kekId = 'kek-current',
  kekEntries = [[kekId, Buffer.alloc(32, 7)]],
  fingerprintId = 'fingerprint-current',
  fingerprintEntries = [[fingerprintId, Buffer.alloc(32, 11)]],
} = {}) {
  return {
    kekRegistry: { currentKeyId: kekId, keys: new Map(kekEntries) },
    fingerprintRegistry: {
      currentKeyId: fingerprintId,
      keys: new Map(fingerprintEntries),
    },
  };
}

function matchesScalar(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('in' in expected && !expected.in.includes(actual)) return false;
    if ('not' in expected && actual === expected.not) return false;
    return true;
  }
  return actual === expected;
}

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'OR') return expected.some((entry) => matchesWhere(row, entry));
    if (field === 'AND') return expected.every((entry) => matchesWhere(row, entry));
    return matchesScalar(row[field], expected);
  });
}

function ordered(rows, orderBy) {
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0];
      if (left[field] === right[field]) continue;
      const comparison = left[field] < right[field] ? -1 : 1;
      return direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
}

function cloneState(value) {
  return structuredClone(value);
}

function applyUpdate(row, data, now) {
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'increment' in value) {
      row[field] = Number(row[field] || 0) + Number(value.increment);
    } else {
      row[field] = value;
    }
  }
  row.updatedAt = new Date(now);
}

function createDatabase(initialState, { failDecision = false, failAudit = false } = {}) {
  const state = {
    organizations: [],
    organizationReads: [],
    people: [],
    projects: [],
    workers: [],
    memberships: [],
    channels: [],
    privacyChoices: [],
    destinations: [],
    decisions: [],
    audits: [],
    rawCalls: [],
    transactionOptions: [],
    ...cloneState(initialState),
  };
  let transactionTail = Promise.resolve();
  let sequence = 0;

  function transactionFor(snapshot) {
    return {
      $executeRawUnsafe: async (...args) => {
        snapshot.rawCalls.push(args);
        return 1;
      },
      organization: {
        findUnique: async ({ where }) => {
          snapshot.organizationReads.push(where.id);
          return snapshot.organizations.find((row) => row.id === where.id) ?? null;
        },
      },
      tenantMembership: {
        findFirst: async ({ where }) => snapshot.memberships.find((row) => matchesWhere(row, where)) ?? null,
      },
      workerPerson: {
        findFirst: async ({ where }) => snapshot.people.find((row) => matchesWhere(row, where)) ?? null,
      },
      worker: {
        findFirst: async ({ where }) => snapshot.workers.find((row) => (
          matchesWhere(row, {
            id: where.id,
            organizationId: where.organizationId,
            projectId: where.projectId,
            personId: where.personId,
            active: where.active,
          })
          && snapshot.projects.some((project) => (
            project.id === row.projectId
            && matchesWhere(project, where.project || {})
          ))
        )) ?? null,
      },
      workerChannelIdentity: {
        findFirst: async ({ where }) => snapshot.channels.find((row) => matchesWhere(row, where)) ?? null,
      },
      workerPrivacyChoiceEvent: {
        findFirst: async ({ where }) => {
          const persisted = snapshot.privacyChoices.find((row) => matchesWhere(row, where));
          if (persisted) return persisted;
          const eventId = typeof where.id === 'string' ? where.id : '';
          const match = eventId.match(/^privacy:(membership|channel):([^:]+):/);
          if (!match) return null;
          const channelSubmission = match[1] === 'channel';
          return {
            id: eventId,
            organizationId: where.organizationId,
            personId: where.personId,
            purpose: 'PAYMENT_DESTINATION_CAPTURE',
            paymentPurpose: where.paymentPurpose,
            channel: channelSubmission ? 'WHATSAPP_FLOW' : 'TENANT_DASHBOARD',
            action: channelSubmission ? 'WORKER_ACKNOWLEDGED' : 'ADMIN_ATTESTED',
            actorMembershipId: channelSubmission ? null : match[2],
            channelIdentityId: channelSubmission ? match[2] : null,
            noticeVersion: 'worker-payment-capture-v1',
            noticeContentSha256: '76a909dfb5f5e0ffc6c3f80335ed5097d552647c9be805ebf6ba61afdbd2752b',
            presentedAt: new Date(NOW.getTime() - 1_000),
            decidedAt: new Date(NOW),
          };
        },
      },
      workerPaymentDestination: {
        findFirst: async ({ where, orderBy }) => ordered(
          snapshot.destinations.filter((row) => matchesWhere(row, where)),
          orderBy,
        )[0] ?? null,
        findMany: async ({ where, orderBy }) => ordered(
          snapshot.destinations.filter((row) => matchesWhere(row, where)),
          orderBy,
        ),
        create: async ({ data }) => {
          const duplicate = snapshot.destinations.some((row) => (
            (row.organizationId === data.organizationId
              && row.personId === data.personId
              && row.operationKey === data.operationKey)
            || (row.organizationId === data.organizationId
              && row.personId === data.personId
              && row.purpose === data.purpose
              && row.version === data.version)
            || (data.activeSlot && row.activeSlot === data.activeSlot)
            || (data.privacyChoiceEventId
              && row.privacyChoiceEventId === data.privacyChoiceEventId)
          ));
          if (duplicate) throw Object.assign(new Error('unique destination'), { code: 'P2002' });
          const row = {
            ...data,
            createdAt: new Date(NOW),
            updatedAt: new Date(NOW),
          };
          snapshot.destinations.push(row);
          return row;
        },
        updateMany: async ({ where, data }) => {
          const rows = snapshot.destinations.filter((row) => matchesWhere(row, where));
          if (data.activeSlot) {
            const occupied = snapshot.destinations.some((row) => (
              !rows.includes(row) && row.activeSlot === data.activeSlot
            ));
            if (occupied) throw Object.assign(new Error('unique active slot'), { code: 'P2002' });
          }
          rows.forEach((row) => applyUpdate(row, data, NOW));
          return { count: rows.length };
        },
      },
      workerSensitiveDecision: {
        findFirst: async ({ where }) => snapshot.decisions.find((row) => matchesWhere(row, where)) ?? null,
        create: async ({ data }) => {
          if (failDecision) throw new Error('forced ledger failure');
          if (
            String(data.action).startsWith('PAYMENT_')
            && (
              data.workerPersonId != null
              || data.onboardingClaimId != null
              || data.paymentDestinationId == null
            )
          ) {
            throw Object.assign(new Error('WSD_exact_subject_check'), { code: '23514' });
          }
          if (snapshot.decisions.some((row) => (
            row.organizationId === data.organizationId && row.operationKey === data.operationKey
          ))) {
            throw Object.assign(new Error('unique decision'), { code: 'P2002' });
          }
          const row = { id: `decision-${++sequence}`, ...data, createdAt: new Date(NOW) };
          snapshot.decisions.push(row);
          return row;
        },
      },
      auditLog: {
        create: async ({ data }) => {
          if (failAudit) throw new Error('forced audit failure');
          const row = { id: `audit-${++sequence}`, ...data, createdAt: new Date(NOW) };
          snapshot.audits.push(row);
          return row;
        },
      },
    };
  }

  const prisma = {
    state,
    $transaction: async (operation, options) => {
      let release;
      const previous = transactionTail;
      transactionTail = new Promise((resolve) => { release = resolve; });
      await previous;
      state.transactionOptions.push(options);
      const snapshot = cloneState(state);
      try {
        const result = await operation(transactionFor(snapshot));
        for (const key of [
          'organizations',
          'organizationReads',
          'people',
          'projects',
          'workers',
          'memberships',
          'channels',
          'privacyChoices',
          'destinations',
          'decisions',
          'audits',
          'rawCalls',
        ]) {
          state[key] = snapshot[key];
        }
        release();
        return result;
      } catch (error) {
        release();
        throw error;
      }
    },
  };
  return prisma;
}

function fixture({ configuration = keyConfiguration(), identityStatus = 'VERIFIED', failDecision, failAudit } = {}) {
  const cuilFingerprint = workerFinancialFingerprint(CUIL, {
    organizationId: 'org-a',
    valueType: 'CUIL',
  }, { registry: configuration.fingerprintRegistry });
  const prisma = createDatabase({
    organizations: [
      {
        id: 'org-a',
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      },
      {
        id: 'org-b',
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      },
    ],
    people: [
      {
        id: 'person-a',
        organizationId: 'org-a',
        status: 'ACTIVE',
        identityStatus,
        cuilFingerprint: cuilFingerprint.fingerprint,
        cuilFingerprintKeyId: cuilFingerprint.fingerprintKeyId,
      },
      {
        id: 'person-b',
        organizationId: 'org-b',
        status: 'ACTIVE',
        identityStatus: 'VERIFIED',
      },
    ],
    projects: [
      { id: 'project-a', organizationId: 'org-a', status: 'ACTIVE' },
      { id: 'project-b', organizationId: 'org-b', status: 'ACTIVE' },
    ],
    workers: [
      {
        id: 'worker-a',
        organizationId: 'org-a',
        projectId: 'project-a',
        personId: 'person-a',
        active: true,
      },
      {
        id: 'worker-b',
        organizationId: 'org-b',
        projectId: 'project-b',
        personId: 'person-b',
        active: true,
      },
    ],
    memberships: [
      { id: 'maker', organizationId: 'org-a', userId: 'user-maker', tenantRole: 'ADMIN', status: 'ACTIVE' },
      { id: 'verifier', organizationId: 'org-a', userId: 'user-verifier', tenantRole: 'ADMIN', status: 'ACTIVE' },
      { id: 'activator', organizationId: 'org-a', userId: 'user-activator', tenantRole: 'DIRECTOR', status: 'ACTIVE' },
      { id: 'admin', organizationId: 'org-a', userId: 'user-admin', tenantRole: 'ADMIN', status: 'ACTIVE' },
      { id: 'site-manager', organizationId: 'org-a', userId: 'user-site', tenantRole: 'SITE_MANAGER', status: 'ACTIVE' },
      { id: 'outsider', organizationId: 'org-b', userId: 'user-outsider', tenantRole: 'ADMIN', status: 'ACTIVE' },
      { id: 'disabled', organizationId: 'org-a', userId: 'user-disabled', tenantRole: 'ADMIN', status: 'DISABLED' },
    ],
    channels: [
      {
        id: 'channel-a',
        organizationId: 'org-a',
        personId: 'person-a',
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        revokedAt: null,
      },
      {
        id: 'channel-b',
        organizationId: 'org-b',
        personId: 'person-b',
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        revokedAt: null,
      },
    ],
  }, { failDecision, failAudit });
  return { prisma, configuration };
}

let idSequence = 0;

function submitOptions(configuration, {
  type = 'CBU',
  value = CBU,
  operationKey = `submit-op-${++idSequence}`,
  submitter = { type: 'TENANT_MEMBERSHIP', membershipId: 'maker' },
  overrides = {},
} = {}) {
  const submitterType = submitter.type === 'WORKER_CHANNEL' ? 'channel' : 'membership';
  const submitterId = submitter.channelIdentityId || submitter.membershipId;
  return {
    scope: { organizationId: 'org-a', projectId: 'project-a', workerId: 'worker-a' },
    personId: 'person-a',
    submittedBy: submitter,
    privacyChoice: {
      eventId: `privacy:${submitterType}:${submitterId}:${operationKey}`,
    },
    input: {
      purpose: 'SALARY',
      type,
      value,
      holderName: 'Trabajador de Prueba',
      holderCuil: CUIL,
      operationKey,
    },
    now: NOW,
    keyConfiguration: configuration,
    idFactory: () => `destination-${++idSequence}`,
    ...overrides,
  };
}

function verificationOptions(configuration, destination, {
  actorMembershipId = 'verifier',
  operationKey = `verify-op-${++idSequence}`,
  serverResolution,
  overrides = {},
} = {}) {
  return {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: destination.id,
    actorMembershipId,
    input: {
      expectedRevision: destination.revision,
      operationKey,
      policyVersion: 'payment-policy-v1',
    },
    trustedVerification: {
      evidence: { check: 'bank-owner-match', result: true },
      verificationProvider: 'TEST_PROVIDER',
      providerReference: `provider-reference-${operationKey}`,
      verifiedHolderCuil: CUIL,
      ...(serverResolution ? { serverResolution } : {}),
    },
    now: NOW,
    keyConfiguration: configuration,
    ...overrides,
  };
}

function activationOptions(destination, {
  actorMembershipId = 'activator',
  operationKey = `activate-op-${++idSequence}`,
  overrides = {},
} = {}) {
  return {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: destination.id,
    actorMembershipId,
    input: {
      expectedRevision: destination.revision,
      operationKey,
      policyVersion: 'payment-policy-v1',
    },
    trustedEvidence: { approvalTicket: `ticket-${operationKey}` },
    now: NOW,
    ...overrides,
  };
}

async function submitAndVerify(prisma, configuration, value, suffix) {
  const submitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { value, operationKey: `submit-${suffix}` }),
  );
  const verified = await verifyWorkerPaymentDestination(
    prisma,
    verificationOptions(configuration, submitted.paymentDestination, {
      operationKey: `verify-${suffix}`,
    }),
  );
  return verified.paymentDestination;
}

function expectCode(code) {
  return (error) => error instanceof WorkerPaymentDestinationError && error.code === code;
}

test('new destinations require one exact registered privacy choice and persist the attested contract', async () => {
  const { prisma, configuration } = fixture();
  const missing = submitOptions(configuration, { operationKey: 'privacy-required-submit' });
  delete missing.privacyChoice;
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, missing),
    expectCode('WORKER_PAYMENT_PRIVACY_CHOICE_REQUIRED'),
  );

  const wrongActor = submitOptions(configuration, { operationKey: 'privacy-wrong-actor-submit' });
  wrongActor.privacyChoice = {
    eventId: 'privacy:membership:verifier:privacy-wrong-actor-submit',
  };
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, wrongActor),
    expectCode('WORKER_PAYMENT_PRIVACY_CHOICE_INVALID'),
  );

  const validOptions = submitOptions(configuration, { operationKey: 'privacy-valid-submit' });
  const created = await submitWorkerPaymentDestination(prisma, validOptions);
  const stored = prisma.state.destinations.find((row) => row.id === created.paymentDestination.id);
  assert.equal(stored.submissionContractVersion, 'ATTESTED_V1');
  assert.equal(stored.privacyChoiceEventId, validOptions.privacyChoice.eventId);
  assert.equal('privacyChoiceEventId' in created.paymentDestination, false);
});

test('a payment-capture privacy choice is single-use across destination operation keys', async () => {
  const { prisma, configuration } = fixture();
  const firstOptions = submitOptions(configuration, { operationKey: 'privacy-one-time-first' });
  await submitWorkerPaymentDestination(prisma, firstOptions);
  const secondOptions = submitOptions(configuration, {
    operationKey: 'privacy-one-time-second',
    value: OTHER_CBU,
    overrides: { privacyChoice: firstOptions.privacyChoice },
  });
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, secondOptions),
    expectCode('WORKER_PAYMENT_PRIVACY_CHOICE_ALREADY_USED'),
  );
});

test('legacy destinations require re-attestation, stay unusable, and cannot advance', async () => {
  const { prisma, configuration } = fixture();
  const submitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'legacy-privacy-guard-submit' }),
  );
  const stored = prisma.state.destinations.find(
    (row) => row.id === submitted.paymentDestination.id,
  );
  stored.submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED';
  stored.privacyChoiceEventId = null;

  const listedPending = await listWorkerPaymentDestinations(prisma, {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    actorMembershipId: 'admin',
  });
  assert.equal(listedPending.paymentDestinations[0].privacyStatus, 'REATTESTATION_REQUIRED');
  assert.equal(listedPending.paymentDestinations[0].paymentUsable, false);

  await assert.rejects(
    verifyWorkerPaymentDestination(
      prisma,
      verificationOptions(configuration, submitted.paymentDestination, {
        operationKey: 'legacy-privacy-guard-verify',
      }),
    ),
    expectCode('WORKER_PAYMENT_REATTESTATION_REQUIRED'),
  );

  const legacyForActivation = prisma.state.destinations.find(
    (row) => row.id === submitted.paymentDestination.id,
  );
  legacyForActivation.status = 'VERIFIED';
  legacyForActivation.verifiedByMembershipId = 'verifier';
  await assert.rejects(
    activateWorkerPaymentDestination(
      prisma,
      activationOptions(submitted.paymentDestination, {
        operationKey: 'legacy-privacy-guard-activate',
      }),
    ),
    expectCode('WORKER_PAYMENT_REATTESTATION_REQUIRED'),
  );

  const legacyForListing = prisma.state.destinations.find(
    (row) => row.id === submitted.paymentDestination.id,
  );
  legacyForListing.status = 'ACTIVE';
  legacyForListing.availableFrom = NOW;
  const listedActive = await listWorkerPaymentDestinations(prisma, {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    actorMembershipId: 'admin',
  });
  assert.equal(listedActive.paymentDestinations[0].status, 'ACTIVE');
  assert.equal(listedActive.paymentDestinations[0].privacyStatus, 'REATTESTATION_REQUIRED');
  assert.equal(listedActive.paymentDestinations[0].paymentUsable, false);

  const revoked = await revokeWorkerPaymentDestination(prisma, {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: submitted.paymentDestination.id,
    actorMembershipId: 'verifier',
    input: {
      expectedRevision: 0,
      operationKey: 'legacy-privacy-guard-revoke',
      policyVersion: 'payment-policy-v1',
      reason: 'Destino heredado retirado antes de una eventual reatestacion.',
    },
    trustedEvidence: { control: 'legacy-privacy-quarantine-v1' },
    now: NOW,
  });
  assert.equal(revoked.paymentDestination.status, 'REVOKED');
  assert.equal(revoked.paymentDestination.privacyStatus, 'REATTESTATION_REQUIRED');
  assert.equal(revoked.paymentDestination.paymentUsable, false);
});

test('an exact pending legacy destination is re-attested in place and replays without another audit', async () => {
  const { prisma, configuration } = fixture();
  const submitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'legacy-in-place-original' }),
  );
  const stored = prisma.state.destinations.find(
    (row) => row.id === submitted.paymentDestination.id,
  );
  stored.submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED';
  stored.privacyChoiceEventId = null;
  const originalAuditCount = prisma.state.audits.length;
  const reattestation = submitOptions(configuration, {
    operationKey: 'legacy-in-place-reattest',
  });

  const result = await submitWorkerPaymentDestination(prisma, reattestation);

  assert.equal(result.paymentDestination.id, submitted.paymentDestination.id);
  assert.equal(result.paymentDestination.revision, 1);
  assert.equal(result.paymentDestination.privacyStatus, 'ATTESTED');
  assert.equal(result.paymentDestination.paymentUsable, false);
  assert.equal(result.replayed, false);
  assert.equal(result.reattested, true);
  assert.equal(prisma.state.destinations.length, 1);
  const reattestedStored = prisma.state.destinations.find(
    (row) => row.id === submitted.paymentDestination.id,
  );
  assert.equal(reattestedStored.submissionContractVersion, 'ATTESTED_V1');
  assert.equal(reattestedStored.privacyChoiceEventId, reattestation.privacyChoice.eventId);
  assert.equal(prisma.state.audits.length, originalAuditCount + 1);
  assert.equal(
    prisma.state.audits.at(-1).action,
    'worker.payment_destination.privacy_reattested',
  );

  const replay = await submitWorkerPaymentDestination(prisma, reattestation);
  assert.equal(replay.paymentDestination.id, submitted.paymentDestination.id);
  assert.equal(replay.replayed, true);
  assert.equal(replay.reattested, false);
  assert.equal(prisma.state.destinations.length, 1);
  assert.equal(prisma.state.audits.length, originalAuditCount + 1);
});

test('a Flow re-attestation atomically replaces legacy submission provenance with the reserved worker channel', async () => {
  const { prisma, configuration } = fixture();
  const original = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'legacy-flow-original' }),
  );
  const stored = prisma.state.destinations.find(
    (row) => row.id === original.paymentDestination.id,
  );
  const originalOperationKey = stored.operationKey;
  const originalRequestFingerprint = stored.requestFingerprint;
  stored.submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED';
  stored.privacyChoiceEventId = null;

  const reservationId = '423e4567-e89b-42d3-a456-426614174000';
  const result = await submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
    operationKey: 'legacy-flow-reattest',
    submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
    overrides: {
      flowSubmission: {
        reservationId,
        fingerprintKeyId: 'payment-flow-v1',
        fingerprintHmac: 'a'.repeat(64),
      },
    },
  }));

  const reattestedStored = prisma.state.destinations.find(
    (row) => row.id === original.paymentDestination.id,
  );
  assert.equal(result.reattested, true);
  assert.equal(reattestedStored.submissionContractVersion, 'ATTESTED_V1');
  assert.equal(reattestedStored.submissionSource, 'WORKER_CHANNEL');
  assert.equal(reattestedStored.submittedByMembershipId, null);
  assert.equal(reattestedStored.submittedByChannelIdentityId, 'channel-a');
  assert.deepEqual(reattestedStored.submittedAt, NOW);
  assert.notEqual(reattestedStored.operationKey, originalOperationKey);
  assert.match(reattestedStored.operationKey, /^wp:submit:[0-9a-f]{64}$/);
  assert.notEqual(reattestedStored.requestFingerprint, originalRequestFingerprint);
  assert.equal(reattestedStored.flowSubmissionReservationId, reservationId);
  assert.equal(reattestedStored.flowSubmissionFingerprintKeyId, 'payment-flow-v1');
  assert.equal(reattestedStored.flowSubmissionFingerprintHmac, 'a'.repeat(64));
});

test('an active legacy destination requires acknowledgement from the verified worker channel', async () => {
  const { prisma, configuration } = fixture();
  const submitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'legacy-active-original' }),
  );
  const stored = prisma.state.destinations.find(
    (row) => row.id === submitted.paymentDestination.id,
  );
  stored.submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED';
  stored.privacyChoiceEventId = null;
  stored.status = 'ACTIVE';
  stored.availableFrom = NOW;

  await assert.rejects(
    submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
      operationKey: 'legacy-active-admin-reattest',
    })),
    expectCode('WORKER_PAYMENT_REATTESTATION_REQUIRED'),
  );

  const workerReattestation = submitOptions(configuration, {
    operationKey: 'legacy-active-worker-reattest',
    submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
  });
  const result = await submitWorkerPaymentDestination(prisma, workerReattestation);

  assert.equal(result.paymentDestination.id, submitted.paymentDestination.id);
  assert.equal(result.paymentDestination.status, 'ACTIVE');
  assert.equal(result.paymentDestination.privacyStatus, 'ATTESTED');
  assert.equal(result.paymentDestination.paymentUsable, true);
  assert.equal(result.reattested, true);
  assert.equal(stored.submissionSource, 'TENANT_MEMBERSHIP');
  assert.equal(stored.submittedByMembershipId, 'maker');
  assert.equal(prisma.state.audits.at(-1).actorId, null);
});

test('terminal legacy destinations cannot be reopened through privacy re-attestation', async () => {
  for (const status of ['REJECTED', 'REVOKED', 'SUPERSEDED']) {
    const { prisma, configuration } = fixture();
    const submitted = await submitWorkerPaymentDestination(
      prisma,
      submitOptions(configuration, { operationKey: `legacy-terminal-original-${status}` }),
    );
    const stored = prisma.state.destinations.find(
      (row) => row.id === submitted.paymentDestination.id,
    );
    stored.submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED';
    stored.privacyChoiceEventId = null;
    stored.status = status;

    await assert.rejects(
      submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
        operationKey: `legacy-terminal-reattest-${status}`,
        submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
      })),
      expectCode('WORKER_PAYMENT_REATTESTATION_REQUIRED'),
    );
    assert.equal(stored.submissionContractVersion, 'LEGACY_REATTESTATION_REQUIRED');
    assert.equal(stored.privacyChoiceEventId, null);
  }
});

test('legacy re-attestation requires the exact presented identifier and persisted holder', async () => {
  const { prisma, configuration } = fixture();
  const aliasSubmitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, {
      type: 'ALIAS',
      value: 'legacy.exact.alias',
      operationKey: 'legacy-exact-alias-submit',
    }),
  );
  const aliasVerified = await verifyWorkerPaymentDestination(
    prisma,
    verificationOptions(configuration, aliasSubmitted.paymentDestination, {
      operationKey: 'legacy-exact-alias-verify',
      serverResolution: { type: 'CVU', value: CVU },
    }),
  );
  let stored = prisma.state.destinations.find(
    (row) => row.id === aliasVerified.paymentDestination.id,
  );
  stored.submissionContractVersion = 'LEGACY_REATTESTATION_REQUIRED';
  stored.privacyChoiceEventId = null;

  await assert.rejects(
    submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
      type: 'CVU',
      value: CVU,
      operationKey: 'legacy-canonical-is-not-exact',
    })),
    expectCode('WORKER_PAYMENT_DUPLICATE'),
  );
  stored = prisma.state.destinations.find((row) => row.id === aliasVerified.paymentDestination.id);
  assert.equal(stored.submissionContractVersion, 'LEGACY_REATTESTATION_REQUIRED');
  assert.equal(stored.privacyChoiceEventId, null);

  stored.holderCuilFingerprint = workerFinancialFingerprint(OTHER_CUIL, {
    organizationId: 'org-a',
    valueType: 'CUIL',
  }, { registry: configuration.fingerprintRegistry }).fingerprint;
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
      type: 'ALIAS',
      value: 'legacy.exact.alias',
      operationKey: 'legacy-holder-does-not-match',
    })),
    expectCode('WORKER_PAYMENT_HOLDER_MISMATCH'),
  );
  assert.equal(stored.submissionContractVersion, 'LEGACY_REATTESTATION_REQUIRED');
  assert.equal(stored.privacyChoiceEventId, null);
});

test('tenant/person scoping and active actor checks fail closed', async () => {
  const { prisma, configuration } = fixture();

  await assert.rejects(
    listWorkerPaymentDestinations(prisma, {
      scope: { organizationId: 'org-a' },
      personId: 'person-a',
      actorMembershipId: 'outsider',
    }),
    expectCode('WORKER_PAYMENT_ACTOR_FORBIDDEN'),
  );
  const channelSubmission = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, {
      value: OTHER_CBU,
      operationKey: 'verified-channel-submit',
      submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
    }),
  );
  assert.equal(channelSubmission.paymentDestination.status, 'PENDING_VERIFICATION');
  assert.equal(prisma.state.destinations[0].submissionSource, 'WORKER_CHANNEL');
  assert.equal(prisma.state.destinations[0].submittedByChannelIdentityId, 'channel-a');
  assert.equal(prisma.state.audits[0].actorId, null);
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
      submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-b' },
    })),
    expectCode('WORKER_PAYMENT_ACTOR_FORBIDDEN'),
  );
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
      submitter: { type: 'TENANT_MEMBERSHIP', membershipId: 'activator' },
    })),
    expectCode('WORKER_PAYMENT_ACTOR_FORBIDDEN'),
  );
  await assert.rejects(
    listWorkerPaymentDestinations(prisma, {
      scope: { organizationId: 'org-a' },
      personId: 'person-a',
      actorMembershipId: 'disabled',
    }),
    expectCode('WORKER_PAYMENT_ACTOR_FORBIDDEN'),
  );

  const unverified = fixture({ identityStatus: 'PENDING_REVIEW' });
  await assert.rejects(
    submitWorkerPaymentDestination(
      unverified.prisma,
      submitOptions(unverified.configuration, { operationKey: 'identity-no-longer-verified' }),
    ),
    expectCode('WORKER_PAYMENT_IDENTITY_UNVERIFIED'),
  );

  const revokedChannel = fixture();
  revokedChannel.prisma.state.channels[0].revokedAt = NOW;
  await assert.rejects(
    submitWorkerPaymentDestination(
      revokedChannel.prisma,
      submitOptions(revokedChannel.configuration, {
        operationKey: 'revoked-whatsapp-channel-submit',
        submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
      }),
    ),
    expectCode('WORKER_PAYMENT_ACTOR_FORBIDDEN'),
  );
});

test('submission revalidates the exact active project-worker bridge inside the transaction', async () => {
  const inactiveWorker = fixture();
  inactiveWorker.prisma.state.workers[0].active = false;
  await assert.rejects(
    submitWorkerPaymentDestination(
      inactiveWorker.prisma,
      submitOptions(inactiveWorker.configuration, { operationKey: 'inactive-worker-submit' }),
    ),
    expectCode('WORKER_PAYMENT_SCOPE_FORBIDDEN'),
  );

  const inactiveProject = fixture();
  inactiveProject.prisma.state.projects[0].status = 'ARCHIVED';
  await assert.rejects(
    submitWorkerPaymentDestination(
      inactiveProject.prisma,
      submitOptions(inactiveProject.configuration, { operationKey: 'inactive-project-submit' }),
    ),
    expectCode('WORKER_PAYMENT_SCOPE_FORBIDDEN'),
  );
});

test('subscription is revalidated inside mutations before channel replay or state changes', async () => {
  const { prisma, configuration } = fixture();
  const operationKey = 'channel-subscription-replay';
  const channelOptions = submitOptions(configuration, {
    operationKey,
    submitter: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
  });
  const submitted = await submitWorkerPaymentDestination(prisma, channelOptions);
  assert.deepEqual(prisma.state.organizationReads, ['org-a']);

  prisma.state.organizations[0].subscriptionStatus = 'SUSPENDED';
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, channelOptions),
    (error) => error?.code === 'SUBSCRIPTION_READ_ONLY' && error?.status === 402,
  );
  assert.equal(prisma.state.destinations.length, 1);
  assert.equal(prisma.state.audits.length, 1);

  await assert.rejects(
    verifyWorkerPaymentDestination(
      prisma,
      verificationOptions(configuration, submitted.paymentDestination, {
        operationKey: 'blocked-verification',
      }),
    ),
    (error) => error?.code === 'SUBSCRIPTION_READ_ONLY',
  );
  assert.equal(prisma.state.destinations[0].status, 'PENDING_VERIFICATION');
});

test('submission is encrypted, minimal, strict, and exactly idempotent', async () => {
  const { prisma, configuration } = fixture();
  const operationKey = 'stable-submit-operation';
  const options = submitOptions(configuration, { operationKey });
  const first = await submitWorkerPaymentDestination(prisma, options);
  const replay = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey }),
  );

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.paymentDestination, first.paymentDestination);
  assert.equal(prisma.state.destinations.length, 1);
  assert.equal(prisma.state.destinations[0].canonicalType, 'CBU');
  assert.equal(
    prisma.state.destinations[0].canonicalFingerprint,
    prisma.state.destinations[0].fingerprint,
  );
  assert.equal(
    prisma.state.destinations[0].canonicalFingerprintKeyId,
    prisma.state.destinations[0].fingerprintKeyId,
  );
  assert.equal(first.paymentDestination.maskedValue.endsWith(CBU.slice(-4)), true);
  assert.equal('encryptedPayload' in first.paymentDestination, false);
  assert.equal('holderName' in first.paymentDestination, false);
  const persistence = JSON.stringify({
    destinations: prisma.state.destinations,
    audits: prisma.state.audits,
  });
  assert.equal(persistence.includes(CBU), false);
  assert.equal(persistence.includes(CUIL), false);
  assert.equal(persistence.includes('Trabajador de Prueba'), false);
  assert.equal(prisma.state.audits[0].metadata.maskedValue, first.paymentDestination.maskedValue);
  assert.equal(prisma.state.transactionOptions.every((entry) => entry.isolationLevel === 'Serializable'), true);
  assert.match(prisma.state.rawCalls[0][0], /pg_advisory_xact_lock/);

  await assert.rejects(
    submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
      operationKey,
      value: OTHER_CBU,
    })),
    expectCode('WORKER_PAYMENT_IDEMPOTENCY_CONFLICT'),
  );
  const changedPurpose = submitOptions(configuration, { operationKey, value: OTHER_CBU });
  changedPurpose.input.purpose = 'REIMBURSEMENT';
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, changedPurpose),
    expectCode('WORKER_PAYMENT_IDEMPOTENCY_CONFLICT'),
  );
  const unknown = submitOptions(configuration);
  unknown.input.plaintextAccount = CBU;
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, unknown),
    expectCode('WORKER_PAYMENT_UNKNOWN_FIELDS'),
  );
  const wrongHolder = submitOptions(configuration);
  wrongHolder.input.holderCuil = OTHER_CUIL;
  await assert.rejects(
    submitWorkerPaymentDestination(prisma, wrongHolder),
    expectCode('WORKER_PAYMENT_HOLDER_MISMATCH'),
  );
});

test('fingerprint rotation checks all active keys and increments immutable versions', async () => {
  const oldId = 'fingerprint-old';
  const newId = 'fingerprint-new';
  const oldKey = Buffer.alloc(32, 21);
  const newKey = Buffer.alloc(32, 22);
  const original = keyConfiguration({
    fingerprintId: oldId,
    fingerprintEntries: [[oldId, oldKey]],
  });
  const { prisma } = fixture({ configuration: original });
  const first = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(original, { operationKey: 'rotation-first' }),
  );
  const rotated = keyConfiguration({
    fingerprintId: newId,
    fingerprintEntries: [[newId, newKey], [oldId, oldKey]],
  });

  await assert.rejects(
    submitWorkerPaymentDestination(
      prisma,
      submitOptions(rotated, { operationKey: 'rotation-duplicate' }),
    ),
    expectCode('WORKER_PAYMENT_DUPLICATE'),
  );
  const second = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(rotated, { value: OTHER_CBU, operationKey: 'rotation-second' }),
  );
  assert.equal(first.paymentDestination.version, 1);
  assert.equal(second.paymentDestination.version, 2);
  assert.equal(prisma.state.destinations[1].previousDestinationId, prisma.state.destinations[0].id);
  assert.equal(prisma.state.destinations[1].fingerprintKeyId, newId);
});

test('canonical identity blocks alias-to-direct and direct-to-alias duplicates after revocation', async () => {
  const oldId = 'canonical-old';
  const newId = 'canonical-new';
  const oldKey = Buffer.alloc(32, 31);
  const newKey = Buffer.alloc(32, 32);
  const oldConfiguration = keyConfiguration({
    fingerprintId: oldId,
    fingerprintEntries: [[oldId, oldKey]],
  });
  const aliasFirst = fixture({ configuration: oldConfiguration });
  const aliasSubmitted = await submitWorkerPaymentDestination(
    aliasFirst.prisma,
    submitOptions(oldConfiguration, {
      type: 'ALIAS',
      value: 'canonical.alias.one',
      operationKey: 'canonical-alias-first-submit',
    }),
  );
  const aliasVerified = await verifyWorkerPaymentDestination(
    aliasFirst.prisma,
    verificationOptions(oldConfiguration, aliasSubmitted.paymentDestination, {
      operationKey: 'canonical-alias-first-verify',
      serverResolution: { type: 'CVU', value: CVU },
    }),
  );
  await revokeWorkerPaymentDestination(aliasFirst.prisma, {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: aliasVerified.paymentDestination.id,
    actorMembershipId: 'admin',
    input: {
      expectedRevision: aliasVerified.paymentDestination.revision,
      operationKey: 'canonical-alias-first-revoke',
      policyVersion: 'payment-policy-v1',
      reason: 'Rotacion controlada de cuenta.',
    },
    trustedEvidence: { ticket: 'canonical-alias-first' },
    now: NOW,
  });
  const rotatedConfiguration = keyConfiguration({
    fingerprintId: newId,
    fingerprintEntries: [[newId, newKey], [oldId, oldKey]],
  });
  await assert.rejects(
    submitWorkerPaymentDestination(
      aliasFirst.prisma,
      submitOptions(rotatedConfiguration, {
        type: 'CVU',
        value: CVU,
        operationKey: 'canonical-direct-after-alias',
      }),
    ),
    expectCode('WORKER_PAYMENT_DUPLICATE'),
  );

  const directFirst = fixture();
  const directSubmitted = await submitWorkerPaymentDestination(
    directFirst.prisma,
    submitOptions(directFirst.configuration, {
      value: CBU,
      operationKey: 'canonical-direct-first-submit',
    }),
  );
  const directVerified = await verifyWorkerPaymentDestination(
    directFirst.prisma,
    verificationOptions(directFirst.configuration, directSubmitted.paymentDestination, {
      operationKey: 'canonical-direct-first-verify',
    }),
  );
  await revokeWorkerPaymentDestination(directFirst.prisma, {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: directVerified.paymentDestination.id,
    actorMembershipId: 'admin',
    input: {
      expectedRevision: directVerified.paymentDestination.revision,
      operationKey: 'canonical-direct-first-revoke',
      policyVersion: 'payment-policy-v1',
      reason: 'Cuenta reemplazada por alias.',
    },
    trustedEvidence: { ticket: 'canonical-direct-first' },
    now: NOW,
  });
  const secondAlias = await submitWorkerPaymentDestination(
    directFirst.prisma,
    submitOptions(directFirst.configuration, {
      type: 'ALIAS',
      value: 'canonical.alias.two',
      operationKey: 'canonical-alias-after-direct-submit',
    }),
  );
  await assert.rejects(
    verifyWorkerPaymentDestination(
      directFirst.prisma,
      verificationOptions(directFirst.configuration, secondAlias.paymentDestination, {
        operationKey: 'canonical-alias-after-direct-verify',
        serverResolution: { type: 'CBU', value: CBU },
      }),
    ),
    expectCode('WORKER_PAYMENT_DUPLICATE'),
  );
});

test('alias verification requires trusted server resolution and three distinct humans', async () => {
  const { prisma, configuration } = fixture();
  const submitted = await submitWorkerPaymentDestination(prisma, submitOptions(configuration, {
    type: 'ALIAS',
    value: 'obra.prueba.alias',
    operationKey: 'alias-submit-operation',
  }));
  const baseCiphertext = prisma.state.destinations[0].encryptedPayload;
  const baseWrappingKeyId = prisma.state.destinations[0].wrappingKeyId;
  assert.equal(prisma.state.destinations[0].canonicalType, null);

  await assert.rejects(
    verifyWorkerPaymentDestination(
      prisma,
      verificationOptions(configuration, submitted.paymentDestination, {
        actorMembershipId: 'maker',
        serverResolution: { type: 'CVU', value: CVU },
      }),
    ),
    expectCode('WORKER_PAYMENT_SEPARATION_REQUIRED'),
  );
  await assert.rejects(
    verifyWorkerPaymentDestination(
      prisma,
      verificationOptions(configuration, submitted.paymentDestination),
    ),
    expectCode('WORKER_PAYMENT_ALIAS_RESOLUTION_REQUIRED'),
  );
  const wrongProviderHolder = verificationOptions(configuration, submitted.paymentDestination, {
    operationKey: 'alias-wrong-provider-holder',
    serverResolution: { type: 'CVU', value: CVU },
  });
  wrongProviderHolder.trustedVerification.verifiedHolderCuil = OTHER_CUIL;
  await assert.rejects(
    verifyWorkerPaymentDestination(prisma, wrongProviderHolder),
    expectCode('WORKER_PAYMENT_HOLDER_MISMATCH'),
  );
  const unsafeBody = verificationOptions(configuration, submitted.paymentDestination, {
    serverResolution: { type: 'CVU', value: CVU },
  });
  unsafeBody.input.evidence = unsafeBody.trustedVerification.evidence;
  await assert.rejects(
    verifyWorkerPaymentDestination(prisma, unsafeBody),
    expectCode('WORKER_PAYMENT_UNKNOWN_FIELDS'),
  );

  const verifyOptions = verificationOptions(configuration, submitted.paymentDestination, {
    operationKey: 'alias-verify-operation',
    serverResolution: { type: 'CVU', value: CVU },
  });
  const verified = await verifyWorkerPaymentDestination(prisma, verifyOptions);
  const verifyReplay = await verifyWorkerPaymentDestination(prisma, verifyOptions);
  assert.equal(verifyReplay.replayed, true);
  const changedVerifiedHolder = {
    ...verifyOptions,
    trustedVerification: {
      ...verifyOptions.trustedVerification,
      verifiedHolderCuil: OTHER_CUIL,
    },
  };
  await assert.rejects(
    verifyWorkerPaymentDestination(prisma, changedVerifiedHolder),
    expectCode('WORKER_PAYMENT_IDEMPOTENCY_CONFLICT'),
  );
  const stored = prisma.state.destinations[0];
  assert.equal(verified.paymentDestination.status, 'VERIFIED');
  assert.equal(stored.resolvedType, 'CVU');
  assert.equal(stored.canonicalType, 'CVU');
  assert.equal(stored.canonicalFingerprint, stored.resolvedFingerprint);
  assert.equal(stored.canonicalFingerprintKeyId, stored.resolvedFingerprintKeyId);
  assert.equal(stored.resolvedEncryptedPayload.includes(CVU), false);
  assert.equal(stored.encryptedPayload, baseCiphertext);
  assert.equal(stored.wrappingKeyId, baseWrappingKeyId);
  assert.equal(stored.resolvedWrappingKeyId, configuration.kekRegistry.currentKeyId);
  assert.match(stored.providerReferenceHash, /^[a-f0-9]{64}$/);
  assert.match(stored.verificationEvidenceHash, /^[a-f0-9]{64}$/);

  await assert.rejects(
    activateWorkerPaymentDestination(
      prisma,
      activationOptions(verified.paymentDestination, { actorMembershipId: 'verifier' }),
    ),
    expectCode('WORKER_PAYMENT_SEPARATION_REQUIRED'),
  );
  await assert.rejects(
    activateWorkerPaymentDestination(
      prisma,
      activationOptions(verified.paymentDestination, { actorMembershipId: 'maker' }),
    ),
    expectCode('WORKER_PAYMENT_SEPARATION_REQUIRED'),
  );
  const activated = await activateWorkerPaymentDestination(
    prisma,
    activationOptions(verified.paymentDestination, { operationKey: 'alias-activate-operation' }),
  );
  assert.equal(activated.paymentDestination.status, 'ACTIVE');
  assert.deepEqual(
    prisma.state.decisions.map((row) => row.action),
    ['PAYMENT_VERIFIED', 'PAYMENT_ACTIVATED'],
  );
  assert.equal(
    prisma.state.decisions.every((row) => (
      !Object.hasOwn(row, 'workerPersonId')
      && !Object.hasOwn(row, 'onboardingClaimId')
      && typeof row.paymentDestinationId === 'string'
    )),
    true,
  );
  const persisted = JSON.stringify(prisma.state);
  assert.equal(persisted.includes('obra.prueba.alias'), false);
  assert.equal(persisted.includes(CVU), false);
  assert.equal(persisted.includes(CUIL), false);
});

test('stale CAS is rejected and list fails closed on invalid persisted currency', async () => {
  const { prisma, configuration } = fixture();
  const submitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'stale-submit-operation' }),
  );
  await assert.rejects(
    verifyWorkerPaymentDestination(prisma, verificationOptions(
      configuration,
      { ...submitted.paymentDestination, revision: 99 },
      { operationKey: 'stale-verify-operation' },
    )),
    expectCode('WORKER_PAYMENT_REVISION_STALE'),
  );
  const outOfRangeRevision = verificationOptions(configuration, submitted.paymentDestination, {
    operationKey: 'overflow-verify-operation',
  });
  outOfRangeRevision.input.expectedRevision = 2_147_483_648;
  await assert.rejects(
    verifyWorkerPaymentDestination(prisma, outOfRangeRevision),
    expectCode('WORKER_PAYMENT_INPUT_INVALID'),
  );
  for (const invalidRevision of [false, null, '0']) {
    const coercedRevision = verificationOptions(configuration, submitted.paymentDestination, {
      operationKey: `coerced-revision-${String(invalidRevision)}`,
    });
    coercedRevision.input.expectedRevision = invalidRevision;
    await assert.rejects(
      verifyWorkerPaymentDestination(prisma, coercedRevision),
      expectCode('WORKER_PAYMENT_INPUT_INVALID'),
    );
  }
  prisma.state.destinations[0].currency = 'USD';
  await assert.rejects(
    listWorkerPaymentDestinations(prisma, {
      scope: { organizationId: 'org-a' },
      personId: 'person-a',
      actorMembershipId: 'admin',
    }),
    expectCode('WORKER_PAYMENT_CONFIGURATION_INVALID'),
  );
});

test('immutable versioning fails closed before PostgreSQL Int overflow', async () => {
  const { prisma, configuration } = fixture();
  await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'version-max-first' }),
  );
  prisma.state.destinations[0].version = 2_147_483_647;
  await assert.rejects(
    submitWorkerPaymentDestination(
      prisma,
      submitOptions(configuration, {
        value: OTHER_CBU,
        operationKey: 'version-overflow-second',
      }),
    ),
    expectCode('WORKER_PAYMENT_CONFIGURATION_INVALID'),
  );
  assert.equal(prisma.state.destinations.length, 1);
});

test('provider holder must match both the person and the persisted submitted holder', async () => {
  const { prisma, configuration } = fixture();
  const submitted = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'persisted-holder-submit' }),
  );
  const inconsistentHolder = workerFinancialFingerprint(OTHER_CUIL, {
    organizationId: 'org-a',
    valueType: 'CUIL',
  }, { registry: configuration.fingerprintRegistry });
  prisma.state.destinations[0].holderCuilFingerprint = inconsistentHolder.fingerprint;
  prisma.state.destinations[0].holderCuilFingerprintKeyId = inconsistentHolder.fingerprintKeyId;

  await assert.rejects(
    verifyWorkerPaymentDestination(
      prisma,
      verificationOptions(configuration, submitted.paymentDestination, {
        operationKey: 'persisted-holder-verify',
      }),
    ),
    expectCode('WORKER_PAYMENT_HOLDER_MISMATCH'),
  );
  assert.equal(prisma.state.destinations[0].status, 'PENDING_VERIFICATION');
});

test('concurrent activations keep one active destination and supersede the prior one', async () => {
  const { prisma, configuration } = fixture();
  const first = await submitAndVerify(prisma, configuration, CBU, 'race-one');
  const second = await submitAndVerify(prisma, configuration, OTHER_CBU, 'race-two');

  await Promise.all([
    activateWorkerPaymentDestination(
      prisma,
      activationOptions(first, { actorMembershipId: 'activator', operationKey: 'race-activate-one' }),
    ),
    activateWorkerPaymentDestination(
      prisma,
      activationOptions(second, { actorMembershipId: 'admin', operationKey: 'race-activate-two' }),
    ),
  ]);
  const active = prisma.state.destinations.filter((row) => row.status === 'ACTIVE');
  const superseded = prisma.state.destinations.filter((row) => row.status === 'SUPERSEDED');
  assert.equal(active.length, 1);
  assert.equal(superseded.length, 1);
  assert.equal(active[0].activeSlot.length, 64);
  assert.equal(superseded[0].activeSlot, null);
});

test('ledger and audit failures roll back status, active slot, decisions, and audits', async () => {
  const ledgerFixture = fixture({ failDecision: true });
  const submitted = await submitWorkerPaymentDestination(
    ledgerFixture.prisma,
    submitOptions(ledgerFixture.configuration, { operationKey: 'rollback-ledger-submit' }),
  );
  await assert.rejects(
    verifyWorkerPaymentDestination(
      ledgerFixture.prisma,
      verificationOptions(ledgerFixture.configuration, submitted.paymentDestination, {
        operationKey: 'rollback-ledger-verify',
      }),
    ),
    /forced ledger failure/,
  );
  assert.equal(ledgerFixture.prisma.state.destinations[0].status, 'PENDING_VERIFICATION');
  assert.equal(ledgerFixture.prisma.state.destinations[0].revision, 0);
  assert.equal(ledgerFixture.prisma.state.decisions.length, 0);
  assert.equal(ledgerFixture.prisma.state.audits.length, 1);

  const auditFixture = fixture();
  const verified = await submitAndVerify(
    auditFixture.prisma,
    auditFixture.configuration,
    THIRD_CBU,
    'rollback-audit',
  );
  const auditsBefore = auditFixture.prisma.state.audits.length;
  const decisionsBefore = auditFixture.prisma.state.decisions.length;
  const failing = createDatabase(auditFixture.prisma.state, { failAudit: true });
  await assert.rejects(
    activateWorkerPaymentDestination(
      failing,
      activationOptions(verified, { operationKey: 'rollback-audit-activate' }),
    ),
    /forced audit failure/,
  );
  assert.equal(failing.state.destinations.find((row) => row.id === verified.id).status, 'VERIFIED');
  assert.equal(failing.state.destinations.find((row) => row.id === verified.id).activeSlot, null);
  assert.equal(failing.state.decisions.length, decisionsBefore);
  assert.equal(failing.state.audits.length, auditsBefore);
});

test('reject and revoke are tenant-scoped, idempotent decisions', async () => {
  const { prisma, configuration } = fixture();
  const first = await submitWorkerPaymentDestination(
    prisma,
    submitOptions(configuration, { operationKey: 'reject-submit-operation' }),
  );
  const rejectOptions = {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: first.paymentDestination.id,
    actorMembershipId: 'verifier',
    input: {
      expectedRevision: 0,
      operationKey: 'reject-decision-operation',
      policyVersion: 'payment-policy-v1',
      reason: 'La evidencia bancaria no coincide.',
    },
    trustedEvidence: { reviewTicket: 'review-1' },
    now: NOW,
  };
  const rejected = await rejectWorkerPaymentDestination(prisma, rejectOptions);
  const replay = await rejectWorkerPaymentDestination(prisma, rejectOptions);
  assert.equal(rejected.paymentDestination.status, 'REJECTED');
  assert.equal(replay.replayed, true);

  const verified = await submitAndVerify(prisma, configuration, OTHER_CBU, 'revoke');
  const active = await activateWorkerPaymentDestination(
    prisma,
    activationOptions(verified, {
      actorMembershipId: 'admin',
      operationKey: 'revoke-activate',
    }),
  );
  await assert.rejects(
    revokeWorkerPaymentDestination(prisma, {
      scope: { organizationId: 'org-a' },
      personId: 'person-a',
      purpose: 'SALARY',
      destinationId: active.paymentDestination.id,
      actorMembershipId: 'admin',
      input: {
        expectedRevision: active.paymentDestination.revision,
        operationKey: 'same-activator-revoke',
        policyVersion: 'payment-policy-v1',
        reason: 'Intento del mismo activador.',
      },
      trustedEvidence: { incident: 'same-actor-control' },
      now: NOW,
    }),
    expectCode('WORKER_PAYMENT_SEPARATION_REQUIRED'),
  );
  const revoked = await revokeWorkerPaymentDestination(prisma, {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    purpose: 'SALARY',
    destinationId: active.paymentDestination.id,
    actorMembershipId: 'verifier',
    input: {
      expectedRevision: active.paymentDestination.revision,
      operationKey: 'revoke-decision-operation',
      policyVersion: 'payment-policy-v1',
      reason: 'Cuenta informada como cerrada.',
    },
    trustedEvidence: { incident: 'bank-account-closed' },
    now: NOW,
  });
  assert.equal(revoked.paymentDestination.status, 'REVOKED');
  assert.equal(prisma.state.destinations.find((row) => row.id === active.paymentDestination.id).activeSlot, null);
});
