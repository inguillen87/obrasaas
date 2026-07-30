import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  workerFinancialFingerprint,
} from '../src/lib/worker-financial-data.js';
import {
  getCurrentWorkerPaymentPrivacyNotice,
} from '../src/lib/worker-payment-privacy-notices.js';
import {
  assertWorkerPaymentFlowTerminalReceipt,
  assertWorkerPaymentFlowSessionSecret,
  completeWorkerPaymentFlowSubmission,
  getWorkerPaymentFlowHmacKeyRetirementStatus,
  issueWorkerPaymentFlowSession,
  loadWorkerPaymentFlowDataSession,
  markWorkerPaymentFlowPrivacyPresented,
  markWorkerPaymentFlowSubmissionUncertain,
  readWorkerPaymentFlowSessionSecretRegistry,
  replayExpiredWorkerPaymentFlowSubmission,
  reserveWorkerPaymentFlowSubmission,
  WORKER_PAYMENT_FLOW_MIN_RESERVATION_REMAINING_MS,
  WORKER_PAYMENT_FLOW_SUCCEEDED_REPLAY_GRACE_MS,
  WorkerPaymentFlowSessionError,
  workerPaymentFlowSubmissionOperationKey,
} from '../src/lib/whatsapp/worker-payment-flow-sessions.js';

const NOW = new Date('2026-07-29T12:00:00.000Z');
const FLOW_SECRET = 'test-only-generic-flow-token-secret-32-bytes';
const PAYMENT_SECRET = 'test-only-dedicated-payment-flow-secret-32-bytes';
const ROTATED_PAYMENT_SECRET = 'test-only-rotated-payment-flow-secret-32-bytes';
const ORGANIZATION_ID = 'organization-a';
const PROJECT_ID = 'project-a';
const CONNECTION_ID = 'connection-a';
const WORKER_ID = 'worker-a';
const PERSON_ID = 'person-a';
const CHANNEL_ID = 'channel-a';
const PHONE_NUMBER_ID = '123456789012345';
const RECIPIENT = '+5491112345678';
const DESTINATION_VALUE = '9999999100000000000000';
const RESERVATION_ID = '11111111-1111-4111-8111-111111111111';
const FINGERPRINT_REGISTRY = Object.freeze({
  currentKeyId: 'worker-fingerprint-v1',
  keys: new Map([['worker-fingerprint-v1', Buffer.alloc(32, 17)]]),
});
const NOTICE = getCurrentWorkerPaymentPrivacyNotice();
const FORM = Object.freeze({
  purpose: 'salary',
  destination_type: 'cbu',
  destination_value: DESTINATION_VALUE,
  holder_declaration: true,
  capture_notice_acknowledged: true,
});
const DESTINATION_FINGERPRINT = workerFinancialFingerprint(DESTINATION_VALUE, {
  organizationId: ORGANIZATION_ID,
  valueType: 'CBU',
}, { registry: FINGERPRINT_REGISTRY });

function issueInput(overrides = {}) {
  return {
    organizationId: ORGANIZATION_ID,
    projectId: PROJECT_ID,
    connectionId: CONNECTION_ID,
    workerId: WORKER_ID,
    personId: PERSON_ID,
    channelIdentityId: CHANNEL_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    recipient: RECIPIENT,
    blueprintKey: 'worker-payment-destination',
    flowId: '987654321012345',
    screenId: 'WORKER_PAYMENT_DESTINATION',
    flowType: 'worker_payment_destination',
    sourceExternalId: 'wamid.worker-payment-a',
    notice: {
      version: NOTICE.version,
      contentSha256: NOTICE.contentSha256,
    },
    ...overrides,
  };
}

function matchesWhere(record, where) {
  return Object.entries(where).every(([field, expected]) => {
    const actual = record[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, 'not')) return actual !== expected.not;
      if (Object.hasOwn(expected, 'gt')) {
        return new Date(actual).getTime() > new Date(expected.gt).getTime();
      }
      if (Object.hasOwn(expected, 'lte')) {
        return new Date(actual).getTime() <= new Date(expected.lte).getTime();
      }
    }
    return actual === expected;
  });
}

function applyData(record, data) {
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'increment')) {
      record[field] += value.increment;
    } else {
      record[field] = value;
    }
  }
  record.updatedAt = new Date();
}

function createStore({
  channelOverrides = {},
  contextOverrides = {},
  databaseNow = NOW,
} = {}) {
  const baseRecords = [];
  const companionRecords = [];
  let destination = null;
  let observedAt = new Date(databaseNow);
  const addressFingerprint = workerFinancialFingerprint(RECIPIENT, {
    organizationId: ORGANIZATION_ID,
    valueType: 'WHATSAPP_E164',
  }, { registry: FINGERPRINT_REGISTRY });
  const providerFingerprint = workerFinancialFingerprint(RECIPIENT.slice(1), {
    organizationId: ORGANIZATION_ID,
    valueType: 'WHATSAPP_PROVIDER_SUBJECT',
  }, { registry: FINGERPRINT_REGISTRY });

  function findBase(where) {
    if (where.id) return baseRecords.find((row) => row.id === where.id) || null;
    const composite = where.projectId_sourceExternalId_blueprintKey;
    if (!composite) return null;
    return baseRecords.find((row) => (
      row.projectId === composite.projectId
      && row.sourceExternalId === composite.sourceExternalId
      && row.blueprintKey === composite.blueprintKey
    )) || null;
  }

  const whatsAppFlowSession = {
    async findUnique({ where }) {
      const row = findBase(where);
      return row ? { ...row } : null;
    },
    async create({ data }) {
      if (findBase({
        projectId_sourceExternalId_blueprintKey: {
          projectId: data.projectId,
          sourceExternalId: data.sourceExternalId,
          blueprintKey: data.blueprintKey,
        },
      })) {
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const row = {
        ...data,
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        providerMessageId: null,
        consumedAt: null,
        consumedExternalId: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      baseRecords.push(row);
      return { ...row };
    },
    async updateMany({ where, data }) {
      const rows = baseRecords.filter((row) => matchesWhere(row, where));
      rows.forEach((row) => applyData(row, data));
      return { count: rows.length };
    },
  };

  const workerPaymentFlowSession = {
    async findUnique({ where }) {
      const row = companionRecords.find(
        (candidate) => candidate.flowSessionId === where.flowSessionId,
      );
      return row ? structuredClone(row) : null;
    },
    async create({ data }) {
      if (companionRecords.some((row) => row.flowSessionId === data.flowSessionId)) {
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const row = {
        ...data,
        privacyPresentedAt: null,
        submissionStatus: 'OPEN',
        submissionFingerprintKeyId: null,
        submissionFingerprintHmac: null,
        submissionReservationId: null,
        submissionReservedAt: null,
        paymentPurpose: null,
        privacyChoiceEventId: null,
        destinationId: null,
        submittedAt: null,
        submissionUncertainAt: null,
        revision: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      companionRecords.push(row);
      return structuredClone(row);
    },
    async updateMany({ where, data }) {
      const rows = companionRecords.filter((row) => matchesWhere(row, where));
      rows.forEach((row) => applyData(row, data));
      return { count: rows.length };
    },
  };

  const project = {
    async findFirst() {
      return {
        id: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        status: 'ACTIVE',
        organization: {
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
        },
        ...contextOverrides.project,
      };
    },
  };
  const whatsAppConnection = {
    async findFirst() {
      return {
        id: CONNECTION_ID,
        projectId: PROJECT_ID,
        phoneNumberId: PHONE_NUMBER_ID,
        enabled: true,
        connectionStatus: 'CONNECTED',
        ...contextOverrides.connection,
      };
    },
  };
  const worker = {
    async findFirst() {
      return {
        id: WORKER_ID,
        organizationId: ORGANIZATION_ID,
        projectId: PROJECT_ID,
        personId: PERSON_ID,
        active: true,
        ...contextOverrides.worker,
      };
    },
  };
  const workerPerson = {
    async findFirst() {
      return {
        id: PERSON_ID,
        organizationId: ORGANIZATION_ID,
        status: 'ACTIVE',
        identityStatus: 'VERIFIED',
        ...contextOverrides.person,
      };
    },
  };
  const workerChannelIdentity = {
    async findFirst() {
      return {
        id: CHANNEL_ID,
        organizationId: ORGANIZATION_ID,
        personId: PERSON_ID,
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        revokedAt: null,
        addressFingerprintKeyId: addressFingerprint.fingerprintKeyId,
        addressFingerprint: addressFingerprint.fingerprint,
        providerSubjectFingerprintKeyId: providerFingerprint.fingerprintKeyId,
        providerSubjectFingerprint: providerFingerprint.fingerprint,
        ...channelOverrides,
      };
    },
  };
  const workerPaymentDestination = {
    async findFirst() {
      return destination ? structuredClone(destination) : null;
    },
  };

  const prisma = {
    whatsAppFlowSession,
    workerPaymentFlowSession,
    project,
    whatsAppConnection,
    worker,
    workerPerson,
    workerChannelIdentity,
    workerPaymentDestination,
    async $queryRawUnsafe(sql) {
      assert.match(String(sql), /SELECT statement_timestamp\(\) AS "observedAt"/);
      return [{ observedAt: new Date(observedAt) }];
    },
    async $transaction(operation) {
      return operation(prisma);
    },
  };

  return {
    prisma,
    baseRecords,
    companionRecords,
    setDestination(value) {
      destination = value;
    },
    setDatabaseNow(value) {
      observedAt = new Date(value);
    },
  };
}

async function issue(store, overrides = {}) {
  return issueWorkerPaymentFlowSession(store.prisma, issueInput(overrides), {
    flowTokenSecret: FLOW_SECRET,
    now: NOW,
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });
}

function endpointScope(flowSessionId) {
  return {
    flowSessionId,
    organizationId: ORGANIZATION_ID,
    projectId: PROJECT_ID,
    connectionId: CONNECTION_ID,
    phoneNumberId: PHONE_NUMBER_ID,
  };
}

async function prepare(store) {
  const issued = await issue(store);
  store.baseRecords[0].deliveryAttemptedAt = new Date(NOW.getTime() + 1_000);
  store.baseRecords[0].sentAt = new Date(NOW.getTime() + 2_000);
  const scope = endpointScope(issued.session.id);
  await markWorkerPaymentFlowPrivacyPresented(store.prisma, scope, {
    now: new Date(NOW.getTime() + 3_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });
  return { issued, scope };
}

async function prepareSucceededReplay(store) {
  const { issued, scope } = await prepare(store);
  await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  const companion = store.companionRecords[0];
  const submittedAt = new Date(issued.session.expiresAt.getTime() + 1);
  Object.assign(companion, {
    submissionStatus: 'SUCCEEDED',
    paymentPurpose: 'SALARY',
    privacyChoiceEventId: 'privacy-event-replay',
    destinationId: 'destination-replay',
    submittedAt,
    revision: companion.revision + 1,
  });
  return { issued, scope, submittedAt };
}

function assertSessionError(code) {
  return (error) => {
    assert.equal(error instanceof WorkerPaymentFlowSessionError, true);
    assert.equal(error.code, code);
    return true;
  };
}

test('the terminal HMAC secret is required, independent, and at least 32 bytes', () => {
  assert.throws(
    () => assertWorkerPaymentFlowSessionSecret(''),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_SECRET_REQUIRED'),
  );
  assert.throws(
    () => assertWorkerPaymentFlowSessionSecret('replace-with-payment-flow-secret-of-32-bytes'),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID'),
  );
  assert.equal(assertWorkerPaymentFlowSessionSecret(PAYMENT_SECRET), PAYMENT_SECRET);
  const registry = readWorkerPaymentFlowSessionSecretRegistry({
    activeKeyId: 'payment-flow-v2',
    keyringJson: JSON.stringify({
      'payment-flow-v1': PAYMENT_SECRET,
      'payment-flow-v2': ROTATED_PAYMENT_SECRET,
    }),
    legacySecret: '',
  });
  assert.equal(registry.activeKeyId, 'payment-flow-v2');
  assert.deepEqual([...registry.keys.keys()], ['payment-flow-v1', 'payment-flow-v2']);
  assert.throws(
    () => readWorkerPaymentFlowSessionSecretRegistry({
      activeKeyId: 'duplicate-v2',
      keyringJson: JSON.stringify({
        'duplicate-v1': PAYMENT_SECRET,
        'duplicate-v2': PAYMENT_SECRET,
      }),
      legacySecret: '',
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_SECRET_INVALID'),
  );
});

test('issuance atomically reuses the generic token and pins one exact verified companion', async () => {
  const store = createStore();
  const first = await issue(store);
  const replay = await issue(store);

  assert.equal(first.session.kind, 'worker_payment');
  assert.equal(replay.session.id, first.session.id);
  assert.equal(replay.token, first.token);
  assert.equal(replay.replayed, true);
  assert.equal(store.baseRecords.length, 1);
  assert.equal(store.companionRecords.length, 1);
  assert.deepEqual(first.paymentSession, {
    flowSessionId: first.session.id,
    organizationId: ORGANIZATION_ID,
    projectId: PROJECT_ID,
    connectionId: CONNECTION_ID,
    workerId: WORKER_ID,
    personId: PERSON_ID,
    channelIdentityId: CHANNEL_ID,
    noticeVersion: NOTICE.version,
    noticeContentSha256: NOTICE.contentSha256,
    expiresAt: new Date(NOW.getTime() + 30 * 60 * 1_000).toISOString(),
    privacyPresentedAt: null,
    submissionStatus: 'OPEN',
    revision: 0,
  });
  assert.equal(JSON.stringify(store.companionRecords).includes(first.token), false);
});

test('issuance retries the whole serializable unit after a companion uniqueness race', async () => {
  const store = createStore();
  const originalCreate = store.prisma.workerPaymentFlowSession.create;
  let firstCreate = true;
  let transactionAttempts = 0;
  const originalTransaction = store.prisma.$transaction;
  store.prisma.$transaction = async (...args) => {
    transactionAttempts += 1;
    return originalTransaction(...args);
  };
  store.prisma.workerPaymentFlowSession.create = async (args) => {
    if (!firstCreate) return originalCreate(args);
    firstCreate = false;
    await originalCreate(args);
    throw Object.assign(new Error('companion unique race'), { code: 'P2002' });
  };

  const result = await issue(store);
  assert.equal(result.replayed, true);
  assert.equal(transactionAttempts, 2);
  assert.equal(store.baseRecords.length, 1);
  assert.equal(store.companionRecords.length, 1);
});

test('a base-session P2002 retries without reading through the aborted transaction', async () => {
  const store = createStore();
  const originalCreate = store.prisma.whatsAppFlowSession.create;
  const originalFindUnique = store.prisma.whatsAppFlowSession.findUnique;
  const originalTransaction = store.prisma.$transaction;
  let firstCreate = true;
  let transactionAborted = false;
  let transactionAttempts = 0;
  let readsAfterAbort = 0;
  store.prisma.$transaction = async (...args) => {
    transactionAttempts += 1;
    transactionAborted = false;
    return originalTransaction(...args);
  };
  store.prisma.whatsAppFlowSession.findUnique = async (args) => {
    if (transactionAborted) {
      readsAfterAbort += 1;
      throw Object.assign(new Error('transaction is aborted'), { code: 'P2028' });
    }
    return originalFindUnique(args);
  };
  store.prisma.whatsAppFlowSession.create = async (args) => {
    if (!firstCreate) return originalCreate(args);
    firstCreate = false;
    await originalCreate(args);
    transactionAborted = true;
    throw Object.assign(new Error('base unique race'), { code: 'P2002' });
  };

  const result = await issue(store);
  assert.equal(result.replayed, false);
  assert.equal(transactionAttempts, 2);
  assert.equal(readsAfterAbort, 0);
  assert.equal(store.baseRecords.length, 1);
  assert.equal(store.companionRecords.length, 1);
});

test('issuance rejects a recipient that is not the selected verified channel', async () => {
  const wrong = workerFinancialFingerprint('+5491199999999', {
    organizationId: ORGANIZATION_ID,
    valueType: 'WHATSAPP_E164',
  }, { registry: FINGERPRINT_REGISTRY });
  const store = createStore({
    channelOverrides: {
      addressFingerprintKeyId: wrong.fingerprintKeyId,
      addressFingerprint: wrong.fingerprint,
    },
  });
  await assert.rejects(
    issue(store),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CHANNEL_UNVERIFIED'),
  );
  assert.equal(store.baseRecords.length, 0);
  assert.equal(store.companionRecords.length, 0);
});

test('the specialized issuer never creates a session longer than its 30-minute privacy contract', async () => {
  const store = createStore();
  await assert.rejects(
    issueWorkerPaymentFlowSession(store.prisma, issueInput(), {
      flowTokenSecret: FLOW_SECRET,
      now: NOW,
      ttlMs: 30 * 60 * 1_000 + 1,
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_INPUT_INVALID'),
  );
  assert.equal(store.baseRecords.length, 0);
  assert.equal(store.companionRecords.length, 0);
});

test('Data Endpoint loading preserves the generic UUID and INIT pins notice once', async () => {
  const store = createStore();
  const issued = await issue(store);
  store.baseRecords[0].deliveryAttemptedAt = new Date(NOW.getTime() + 1_000);
  const scope = endpointScope(issued.session.id);

  const loaded = await loadWorkerPaymentFlowDataSession(store.prisma, scope, {
    now: new Date(NOW.getTime() + 2_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });
  assert.equal(loaded.session.id, issued.session.id);
  assert.equal(loaded.session.kind, 'worker_payment');
  assert.equal(loaded.notice.contentSha256, NOTICE.contentSha256);

  const first = await markWorkerPaymentFlowPrivacyPresented(store.prisma, scope, {
    now: new Date(NOW.getTime() + 3_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });
  const replay = await markWorkerPaymentFlowPrivacyPresented(store.prisma, scope, {
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.paymentSession.privacyPresentedAt, first.paymentSession.privacyPresentedAt);
});

test('terminal webhook receipts fail closed until the exact payment companion succeeds', async () => {
  const store = createStore();
  const issued = await issue(store);
  await assert.rejects(
    assertWorkerPaymentFlowTerminalReceipt(store.prisma, {
      session: store.baseRecords[0],
      connectionId: CONNECTION_ID,
      response: {
        flow_type: 'worker_payment_destination',
        destination_ref: 'destination-a',
        submission_status: 'received',
      },
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_INVALID'),
  );
  assert.equal(issued.paymentSession.submissionStatus, 'OPEN');
});

test('INIT cannot claim that the notice was presented before delivery was attempted', async () => {
  const store = createStore();
  const issued = await issue(store);
  store.baseRecords[0].deliveryAttemptedAt = new Date(NOW.getTime() + 5_000);

  await assert.rejects(
    markWorkerPaymentFlowPrivacyPresented(store.prisma, endpointScope(issued.session.id), {
      now: new Date(NOW.getTime() + 4_000),
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_INVALID'),
  );
  assert.equal(store.companionRecords[0].privacyPresentedAt, null);
});

test('INIT fails closed after channel revocation or subscription loss', async () => {
  const channelState = {};
  const subscription = {
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
  };
  const store = createStore({
    channelOverrides: channelState,
    contextOverrides: { project: { organization: subscription } },
  });
  const issued = await issue(store);
  store.baseRecords[0].deliveryAttemptedAt = new Date(NOW.getTime() + 1_000);
  const scope = endpointScope(issued.session.id);

  channelState.revokedAt = new Date(NOW.getTime() + 1_500);
  await assert.rejects(
    markWorkerPaymentFlowPrivacyPresented(store.prisma, scope, {
      now: new Date(NOW.getTime() + 2_000),
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CHANNEL_UNVERIFIED'),
  );
  channelState.revokedAt = null;
  subscription.subscriptionStatus = 'CANCELED';
  await assert.rejects(
    markWorkerPaymentFlowPrivacyPresented(store.prisma, scope, {
      now: new Date(NOW.getTime() + 2_500),
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_SUBSCRIPTION_BLOCKED'),
  );
  assert.equal(store.companionRecords[0].privacyPresentedAt, null);
});

test('reserve stores only a keyed HMAC and exposes explicit idempotent reconciliation', async () => {
  const store = createStore();
  const { scope } = await prepare(store);
  const first = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  const reconcile = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 5_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });

  assert.deepEqual(first, {
    state: 'reserved',
    reservationId: RESERVATION_ID,
    operationKey: workerPaymentFlowSubmissionOperationKey(scope.flowSessionId, RESERVATION_ID),
    paymentPurpose: 'SALARY',
    replayed: false,
  });
  assert.equal(reconcile.state, 'reconcile');
  assert.equal(reconcile.operationKey, first.operationKey);
  assert.equal(reconcile.reservationId, first.reservationId);
  const stored = store.companionRecords[0];
  assert.match(stored.submissionFingerprintHmac, /^[a-f0-9]{64}$/);
  assert.equal(stored.expectedDestinationType, 'CBU');
  assert.equal(
    stored.expectedDestinationFingerprintKeyId,
    DESTINATION_FINGERPRINT.fingerprintKeyId,
  );
  assert.equal(stored.expectedDestinationFingerprint, DESTINATION_FINGERPRINT.fingerprint);
  assert.equal(JSON.stringify(stored).includes(DESTINATION_VALUE), false);
  assert.notEqual(
    stored.submissionFingerprintHmac,
    crypto.createHash('sha256').update(DESTINATION_VALUE).digest('hex'),
  );

  await assert.rejects(
    reserveWorkerPaymentFlowSubmission(store.prisma, scope, {
      ...FORM,
      destination_value: 'alias.prueba',
      destination_type: 'alias',
    }, {
      secret: PAYMENT_SECRET,
      now: new Date(NOW.getTime() + 6_000),
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CONFLICT'),
  );
});

test('reserve requires more than the one-minute confirmation safety window', async () => {
  const store = createStore();
  const { scope } = await prepare(store);
  const reservedAt = new Date(NOW.getTime() + 4_000);
  const unsafeExpiry = new Date(
    reservedAt.getTime() + WORKER_PAYMENT_FLOW_MIN_RESERVATION_REMAINING_MS,
  );
  store.baseRecords[0].expiresAt = unsafeExpiry;
  store.companionRecords[0].expiresAt = unsafeExpiry;

  await assert.rejects(
    reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
      secret: PAYMENT_SECRET,
      now: reservedAt,
      fingerprintRegistry: FINGERPRINT_REGISTRY,
      idFactory: () => RESERVATION_ID,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_EXPIRED'),
  );
  assert.equal(store.companionRecords[0].submissionStatus, 'OPEN');

  const safeExpiry = new Date(unsafeExpiry.getTime() + 1);
  store.baseRecords[0].expiresAt = safeExpiry;
  store.companionRecords[0].expiresAt = safeExpiry;
  const result = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: reservedAt,
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  assert.equal(result.state, 'reserved');
});

test('a retained HMAC key ID preserves reconciliation and uncertainty fencing during rotation', async () => {
  const store = createStore();
  const { scope } = await prepare(store);
  const initialRegistry = {
    activeKeyId: 'payment-flow-v1',
    keys: { 'payment-flow-v1': PAYMENT_SECRET },
  };
  const reserved = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secretRegistry: initialRegistry,
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  const rotatedRegistry = {
    activeKeyId: 'payment-flow-v2',
    keys: {
      'payment-flow-v1': PAYMENT_SECRET,
      'payment-flow-v2': ROTATED_PAYMENT_SECRET,
    },
  };
  const reconcile = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secretRegistry: rotatedRegistry,
    now: new Date(NOW.getTime() + 5_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });
  const fenced = await markWorkerPaymentFlowSubmissionUncertain(
    store.prisma,
    scope,
    FORM,
    { reservationId: reserved.reservationId },
    {
      secretRegistry: rotatedRegistry,
      now: new Date(NOW.getTime() + 6_000),
    },
  );
  assert.equal(reconcile.state, 'reconcile');
  assert.equal(fenced.state, 'uncertain');
  assert.equal(store.companionRecords[0].submissionFingerprintKeyId, 'payment-flow-v1');
});

test('HMAC retirement is blocked through the 24-hour replay grace and every PROCESSING reconciliation', async () => {
  const calls = [];
  const prisma = {
    async $queryRawUnsafe(...query) {
      calls.push(query);
      return [{ blockingSessions: 2n }];
    },
  };
  const status = await getWorkerPaymentFlowHmacKeyRetirementStatus(
    prisma,
    'payment-flow-v1',
  );
  assert.deepEqual(status, {
    keyId: 'payment-flow-v1',
    retirable: false,
    blockingSessions: 2,
  });
  assert.match(
    calls[0][0],
    /"expiresAt" \+ INTERVAL '24 hours' > statement_timestamp\(\)/,
  );
  assert.match(calls[0][0], /"submissionStatus" = 'PROCESSING'/);
  assert.equal(calls[0][1], 'payment-flow-v1');
  assert.equal(calls[0].length, 2);
});

test('an exact SUCCEEDED submission replays inside the DB-authoritative 24-hour grace', async () => {
  assert.equal(
    WORKER_PAYMENT_FLOW_SUCCEEDED_REPLAY_GRACE_MS,
    24 * 60 * 60 * 1_000,
  );
  const store = createStore();
  const { issued, scope, submittedAt } = await prepareSucceededReplay(store);
  const expiresAt = new Date(issued.session.expiresAt);
  store.setDatabaseNow(new Date(
    expiresAt.getTime() + WORKER_PAYMENT_FLOW_SUCCEEDED_REPLAY_GRACE_MS - 1,
  ));

  const replay = await replayExpiredWorkerPaymentFlowSubmission(
    store.prisma,
    scope,
    FORM,
    {
      secret: PAYMENT_SECRET,
      fingerprintRegistry: FINGERPRINT_REGISTRY,
      // Deliberately outside the grace. PostgreSQL's observed clock above is
      // authoritative; a caller-controlled host clock must not decide replay.
      now: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1_000),
    },
  );

  assert.equal(replay.replayed, true);
  assert.equal(replay.session.id, issued.session.id);
  assert.equal(replay.paymentSession.submissionStatus, 'SUCCEEDED');
  assert.deepEqual(replay.receipt, {
    flow_type: 'worker_payment_destination',
    destination_ref: 'destination-replay',
    submission_status: 'received',
    submitted_at: submittedAt.toISOString(),
  });
  assert.equal(JSON.stringify(replay).includes(DESTINATION_VALUE), false);

  await assert.rejects(
    replayExpiredWorkerPaymentFlowSubmission(store.prisma, scope, {
      ...FORM,
      destination_type: 'alias',
      destination_value: 'otro.alias',
    }, {
      secret: PAYMENT_SECRET,
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CONFLICT'),
  );
});

test('the expired SUCCEEDED replay grace rejects its exact DB-clock boundary', async () => {
  const store = createStore();
  const { issued, scope } = await prepareSucceededReplay(store);
  store.setDatabaseNow(new Date(
    new Date(issued.session.expiresAt).getTime()
      + WORKER_PAYMENT_FLOW_SUCCEEDED_REPLAY_GRACE_MS,
  ));

  await assert.rejects(
    replayExpiredWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
      secret: PAYMENT_SECRET,
      fingerprintRegistry: FINGERPRINT_REGISTRY,
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_EXPIRED'),
  );
});

test('expired replay never opens or reconciles non-SUCCEEDED payment states', async (t) => {
  for (const state of ['OPEN', 'PROCESSING', 'UNCERTAIN']) {
    await t.test(state, async () => {
      const store = createStore();
      const { issued, scope } = await prepare(store);
      if (state !== 'OPEN') {
        await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
          secret: PAYMENT_SECRET,
          now: new Date(NOW.getTime() + 4_000),
          fingerprintRegistry: FINGERPRINT_REGISTRY,
          idFactory: () => RESERVATION_ID,
        });
      }
      if (state === 'UNCERTAIN') {
        store.companionRecords[0].submissionStatus = 'UNCERTAIN';
        store.companionRecords[0].submissionUncertainAt = new Date(NOW.getTime() + 5_000);
        store.companionRecords[0].revision += 1;
      }
      store.setDatabaseNow(new Date(new Date(issued.session.expiresAt).getTime() + 1));

      await assert.rejects(
        replayExpiredWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
          secret: PAYMENT_SECRET,
          fingerprintRegistry: FINGERPRINT_REGISTRY,
        }),
        assertSessionError('WORKER_PAYMENT_FLOW_SESSION_INVALID'),
      );
      assert.equal(store.companionRecords[0].submissionStatus, state);
    });
  }
});

test('expired SUCCEEDED replay remains fail-closed after revocation, delivery rejection, or consumption', async (t) => {
  const cases = [
    {
      name: 'channel revoked',
      expectedCode: 'WORKER_PAYMENT_FLOW_SESSION_CHANNEL_UNVERIFIED',
      setup(store, channelOverrides) {
        channelOverrides.revokedAt = new Date(NOW.getTime() + 6_000);
      },
    },
    {
      name: 'delivery rejected',
      expectedCode: 'WORKER_PAYMENT_FLOW_SESSION_INVALID',
      setup(store) {
        store.baseRecords[0].deliveryRejectedAt = new Date(NOW.getTime() + 6_000);
      },
    },
    {
      name: 'session consumed',
      expectedCode: 'WORKER_PAYMENT_FLOW_SESSION_INVALID',
      setup(store) {
        store.baseRecords[0].consumedAt = new Date(NOW.getTime() + 6_000);
      },
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const channelOverrides = {};
      const store = createStore({ channelOverrides });
      const { issued, scope } = await prepareSucceededReplay(store);
      scenario.setup(store, channelOverrides);
      store.setDatabaseNow(new Date(new Date(issued.session.expiresAt).getTime() + 1));

      await assert.rejects(
        replayExpiredWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
          secret: PAYMENT_SECRET,
          fingerprintRegistry: FINGERPRINT_REGISTRY,
        }),
        assertSessionError(scenario.expectedCode),
      );
      assert.equal(store.companionRecords[0].submissionStatus, 'SUCCEEDED');
    });
  }
});

test('completion uses the live reservation boundary and replays the same allowlisted receipt', async () => {
  const store = createStore();
  const { issued, scope } = await prepare(store);
  const reserved = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  const companion = store.companionRecords[0];
  // The user submission was accepted by OPEN -> PROCESSING before expiry. A
  // database decision committed just after the transport TTL remains the exact
  // idempotent outcome and must not strand the already-created destination.
  const submittedAt = new Date(issued.session.expiresAt.getTime() + 1);
  const persistedDestination = {
    id: 'destination-a',
    organizationId: ORGANIZATION_ID,
    personId: PERSON_ID,
    purpose: 'SALARY',
    status: 'PENDING_VERIFICATION',
    type: 'CBU',
    fingerprint: DESTINATION_FINGERPRINT.fingerprint,
    fingerprintKeyId: DESTINATION_FINGERPRINT.fingerprintKeyId,
    submissionSource: 'WORKER_CHANNEL',
    submittedByMembershipId: null,
    submittedByChannelIdentityId: CHANNEL_ID,
    submissionContractVersion: 'ATTESTED_V1',
    operationKey: companion.expectedDestinationOperationKey,
    flowSubmissionReservationId: reserved.flowSubmission.reservationId,
    flowSubmissionFingerprintKeyId: reserved.flowSubmission.fingerprintKeyId,
    flowSubmissionFingerprintHmac: reserved.flowSubmission.fingerprintHmac,
    privacyChoiceEventId: 'privacy-event-a',
    submittedAt,
    privacyChoiceEvent: {
      id: 'privacy-event-a',
      organizationId: ORGANIZATION_ID,
      personId: PERSON_ID,
      purpose: 'PAYMENT_DESTINATION_CAPTURE',
      paymentPurpose: 'SALARY',
      channel: 'WHATSAPP_FLOW',
      action: 'WORKER_ACKNOWLEDGED',
      channelIdentityId: CHANNEL_ID,
      noticeVersion: NOTICE.version,
      noticeContentSha256: NOTICE.contentSha256,
      presentedAt: companion.privacyPresentedAt,
      decidedAt: submittedAt,
    },
  };

  store.setDestination({ ...persistedDestination, fingerprint: 'f'.repeat(64) });
  await assert.rejects(
    completeWorkerPaymentFlowSubmission(
      store.prisma,
      scope,
      FORM,
      { reservationId: reserved.reservationId, destinationId: 'destination-a' },
      { secret: PAYMENT_SECRET, fingerprintRegistry: FINGERPRINT_REGISTRY },
    ),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CONFLICT'),
  );
  assert.equal(store.companionRecords[0].submissionStatus, 'PROCESSING');
  store.setDestination(persistedDestination);

  const first = await completeWorkerPaymentFlowSubmission(
    store.prisma,
    scope,
    FORM,
    { reservationId: reserved.reservationId, destinationId: 'destination-a' },
    { secret: PAYMENT_SECRET, fingerprintRegistry: FINGERPRINT_REGISTRY },
  );
  const replay = await completeWorkerPaymentFlowSubmission(
    store.prisma,
    scope,
    FORM,
    { reservationId: reserved.reservationId, destinationId: 'destination-a' },
    { secret: PAYMENT_SECRET, fingerprintRegistry: FINGERPRINT_REGISTRY },
  );
  await assert.rejects(
    completeWorkerPaymentFlowSubmission(
      store.prisma,
      scope,
      FORM,
      {
        reservationId: '22222222-2222-4222-8222-222222222222',
        destinationId: 'destination-a',
      },
      { secret: PAYMENT_SECRET, fingerprintRegistry: FINGERPRINT_REGISTRY },
    ),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CONFLICT'),
  );
  await assert.rejects(
    markWorkerPaymentFlowSubmissionUncertain(
      store.prisma,
      scope,
      FORM,
      { reservationId: '22222222-2222-4222-8222-222222222222' },
      { secret: PAYMENT_SECRET, now: new Date(NOW.getTime() + 7_000) },
    ),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_CONFLICT'),
  );
  const uncertainReplay = await markWorkerPaymentFlowSubmissionUncertain(
    store.prisma,
    scope,
    FORM,
    { reservationId: reserved.reservationId },
    { secret: PAYMENT_SECRET, now: new Date(NOW.getTime() + 7_000) },
  );

  assert.equal(first.session.id, issued.session.id);
  assert.deepEqual(first.receipt, {
    flow_type: 'worker_payment_destination',
    destination_ref: 'destination-a',
    submission_status: 'received',
    submitted_at: submittedAt.toISOString(),
  });
  assert.equal(first.replayed, false);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(replay.replayed, true);
  assert.equal(uncertainReplay.state, 'replay');
  assert.deepEqual(uncertainReplay.receipt, first.receipt);
  assert.equal(store.companionRecords[0].privacyChoiceEventId, 'privacy-event-a');
  assert.equal(store.companionRecords[0].destinationId, 'destination-a');
  const terminal = await assertWorkerPaymentFlowTerminalReceipt(store.prisma, {
    session: store.baseRecords[0],
    connectionId: CONNECTION_ID,
    response: {
      flow_type: 'worker_payment_destination',
      destination_ref: 'destination-a',
      submission_status: 'received',
    },
  });
  assert.equal(terminal.receipt.destination_ref, 'destination-a');
  await assert.rejects(
    assertWorkerPaymentFlowTerminalReceipt(store.prisma, {
      session: store.baseRecords[0],
      connectionId: CONNECTION_ID,
      response: {
        flow_type: 'worker_payment_destination',
        destination_ref: 'destination-b',
        submission_status: 'received',
      },
    }),
    assertSessionError('WORKER_PAYMENT_FLOW_SESSION_INVALID'),
  );
});

test('completion accepts an in-place legacy re-attestation using the new privacy decision time', async () => {
  const store = createStore();
  const { scope } = await prepare(store);
  const reserved = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  const companion = store.companionRecords[0];
  const privacyDecidedAt = new Date(NOW.getTime() + 5_000);
  store.setDestination({
    id: 'legacy-destination-a',
    organizationId: ORGANIZATION_ID,
    personId: PERSON_ID,
    purpose: 'SALARY',
    status: 'ACTIVE',
    type: 'CBU',
    fingerprint: DESTINATION_FINGERPRINT.fingerprint,
    fingerprintKeyId: DESTINATION_FINGERPRINT.fingerprintKeyId,
    submissionSource: 'TENANT_MEMBERSHIP',
    submittedByChannelIdentityId: null,
    submissionContractVersion: 'ATTESTED_V1',
    privacyChoiceEventId: 'privacy-event-legacy-a',
    submittedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1_000),
    privacyChoiceEvent: {
      id: 'privacy-event-legacy-a',
      organizationId: ORGANIZATION_ID,
      personId: PERSON_ID,
      purpose: 'PAYMENT_DESTINATION_CAPTURE',
      paymentPurpose: 'SALARY',
      channel: 'WHATSAPP_FLOW',
      action: 'WORKER_ACKNOWLEDGED',
      channelIdentityId: CHANNEL_ID,
      noticeVersion: NOTICE.version,
      noticeContentSha256: NOTICE.contentSha256,
      presentedAt: companion.privacyPresentedAt,
      decidedAt: privacyDecidedAt,
    },
  });

  const completed = await completeWorkerPaymentFlowSubmission(
    store.prisma,
    scope,
    FORM,
    { reservationId: reserved.reservationId, destinationId: 'legacy-destination-a' },
    { secret: PAYMENT_SECRET, fingerprintRegistry: FINGERPRINT_REGISTRY },
  );

  assert.equal(completed.receipt.destination_ref, 'legacy-destination-a');
  assert.equal(completed.receipt.submitted_at, privacyDecidedAt.toISOString());
  assert.equal(store.companionRecords[0].submittedAt.toISOString(), privacyDecidedAt.toISOString());
});

test('an ambiguous outcome is irreversible and never becomes an automatic retry', async () => {
  const store = createStore();
  const { scope } = await prepare(store);
  const reserved = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 4_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
    idFactory: () => RESERVATION_ID,
  });
  const first = await markWorkerPaymentFlowSubmissionUncertain(
    store.prisma,
    scope,
    FORM,
    { reservationId: reserved.reservationId },
    { secret: PAYMENT_SECRET, now: new Date(NOW.getTime() + 5_000) },
  );
  const replay = await reserveWorkerPaymentFlowSubmission(store.prisma, scope, FORM, {
    secret: PAYMENT_SECRET,
    now: new Date(NOW.getTime() + 6_000),
    fingerprintRegistry: FINGERPRINT_REGISTRY,
  });

  assert.deepEqual(first.state, 'uncertain');
  assert.deepEqual(replay, { state: 'uncertain', replayed: true });
  assert.equal(store.companionRecords[0].submissionStatus, 'UNCERTAIN');
  assert.equal(store.companionRecords[0].destinationId, null);
});

test('schema and migration enforce one-to-one binding, versioned HMAC shape, and no reset from uncertainty', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const migration = readFileSync(new URL(
    '../prisma/migrations/20260729132000_worker_payment_flow_sessions/migration.sql',
    import.meta.url,
  ), 'utf8');
  const model = schema.match(/model WorkerPaymentFlowSession \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(model, /flowSessionId\s+String\s+@id\s+@db\.Uuid/);
  assert.match(model, /submissionFingerprintKeyId\s+String\?\s+@db\.VarChar\(64\)/);
  assert.match(model, /submissionFingerprintHmac\s+String\?\s+@db\.Char\(64\)/);
  assert.match(model, /submissionStatus\s+WorkerPaymentFlowSubmissionStatus/);
  assert.match(
    model,
    /@@index\(\[submissionFingerprintKeyId, submissionStatus, expiresAt\], map: "WorkerPaymentFlowSession_hmac_key_status_expiry_idx"\)/,
  );
  assert.match(migration, /"submissionFingerprintHmac" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"submissionFingerprintKeyId" ~ '\^\[A-Za-z0-9\]/);
  assert.match(
    migration,
    /CREATE INDEX "WorkerPaymentFlowSession_hmac_key_status_expiry_idx"[\s\S]*"submissionFingerprintKeyId", "submissionStatus", "expiresAt"/,
  );
  assert.match(migration, /OLD\."submissionStatus" = 'PROCESSING'[\s\S]*?'SUCCEEDED', 'UNCERTAIN'/);
  assert.match(
    migration,
    /NEW\."submissionFingerprintKeyId" IS NOT DISTINCT FROM OLD\."submissionFingerprintKeyId"/,
  );
  assert.doesNotMatch(migration, /UNCERTAIN'[\s\S]{0,160}OPEN/);
  assert.match(migration, /worker payment Flow base claims cannot change/);
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /worker payment Flow success provenance is invalid/);
  assert.match(migration, /privacy presentation requires a live delivered session/);
  assert.match(migration, /observed_at < base_session\."deliveryAttemptedAt"/);
  assert.match(migration, /NEW\."privacyPresentedAt" := observed_at/);
  assert.match(migration, /NEW\."submissionReservedAt" := observed_at/);
  assert.match(migration, /NEW\."submissionUncertainAt" := observed_at/);
  assert.match(migration, /project\."status" = ''ACTIVE''/);
  assert.match(migration, /success_provenance\.destination_privacy_choice_id IS DISTINCT FROM NEW\."privacyChoiceEventId"/);
  assert.match(migration, /success_provenance\.privacy_channel_identity_id IS DISTINCT FROM NEW\."channelIdentityId"/);
  assert.match(migration, /success_provenance\.privacy_decided_at IS DISTINCT FROM NEW\."submittedAt"/);
  assert.doesNotMatch(migration, /privacy_decided_at >= OLD\."expiresAt"/);
  assert.match(
    migration,
    /observed_at \+ INTERVAL '1 minute' >= base_session\."expiresAt"[\s\S]*worker payment Flow reservation requires a safe live delivery window/,
  );
  assert.match(migration, /ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.equal((migration.match(/SET search_path = pg_catalog/g) || []).length, 4);
  assert.match(migration, /CREATE TRIGGER "WorkerPaymentFlowSession_no_delete"[\s\S]*BEFORE DELETE/);
  assert.match(migration, /CREATE TRIGGER "WorkerPaymentFlowSession_no_truncate"[\s\S]*BEFORE TRUNCATE/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_transition_guard"/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER "WhatsAppFlowSession_worker_payment_binding_guard"/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.doesNotMatch(model, /destinationValue|destination_value|holderName|holderCuil|cbu|cvu|alias/i);
});
