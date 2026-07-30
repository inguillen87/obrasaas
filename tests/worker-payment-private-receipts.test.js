import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION,
  buildWorkerPaymentPrivateReceiptLink,
  issueWorkerPaymentPrivateReceiptInTransaction,
  readWorkerPaymentPrivateReceipt,
  reconstructWorkerPaymentPrivateReceiptToken,
  workerPaymentPrivateReceiptContentSha256,
  workerPaymentPrivateReceiptDto,
} from '../src/lib/worker-payment-private-receipts.js';

const NOW = new Date('2026-07-29T18:00:00.000Z');
const SECRET = 'worker-payment-private-receipt-test-secret-2026';
const RECEIPT_ID = '123e4567-e89b-42d3-a456-426614174700';
const FLOW_SESSION_ID = '123e4567-e89b-42d3-a456-426614174701';

const INPUT = Object.freeze({
  organizationId: 'organization-receipt-a',
  projectId: 'project-receipt-a',
  connectionId: 'connection-receipt-a',
  flowSessionId: FLOW_SESSION_ID,
  workerId: 'worker-receipt-a',
  personId: 'person-receipt-a',
  channelIdentityId: 'channel-receipt-a',
  sourceWebhookEventId: 'webhook-receipt-a',
  consumedExternalId: 'wamid.receipt-terminal-a',
});

function issueStore({ requested = true, destinationType = 'CBU' } = {}) {
  let receipt = null;
  let createCalls = 0;
  const companion = {
    flowSessionId: FLOW_SESSION_ID,
    organizationId: INPUT.organizationId,
    projectId: INPUT.projectId,
    connectionId: INPUT.connectionId,
    workerId: INPUT.workerId,
    personId: INPUT.personId,
    channelIdentityId: INPUT.channelIdentityId,
    submissionStatus: 'SUCCEEDED',
    submissionReservationId: '123e4567-e89b-42d3-a456-426614174702',
    destinationId: 'destination-receipt-a',
    paymentPurpose: 'SALARY',
    submittedAt: new Date('2026-07-29T17:59:30.000Z'),
    receiptDeliveryRequested: requested,
  };
  const prisma = {
    workerPaymentFlowSession: {
      async findUnique({ where }) {
        assert.deepEqual(where, { flowSessionId: FLOW_SESSION_ID });
        return companion;
      },
    },
    whatsAppFlowSession: {
      async findFirst({ where }) {
        return where.id === FLOW_SESSION_ID
          && where.consumedExternalId === INPUT.consumedExternalId
          ? { id: FLOW_SESSION_ID, consumedAt: NOW }
          : null;
      },
    },
    workerPaymentDestination: {
      async findFirst({ where }) {
        assert.equal(where.flowSubmissionReservationId, companion.submissionReservationId);
        return {
          id: companion.destinationId,
          organizationId: INPUT.organizationId,
          personId: INPUT.personId,
          purpose: 'SALARY',
          type: destinationType,
          lastFour: destinationType === 'ALIAS' ? 'a-ab' : '1234',
          flowSubmissionReservationId: companion.submissionReservationId,
        };
      },
    },
    webhookEvent: {
      async findFirst({ where }) {
        return where.id === INPUT.sourceWebhookEventId
          ? { id: where.id, projectId: INPUT.projectId, status: 'PROCESSING', appliedAt: null }
          : null;
      },
    },
    project: { async findFirst() { return { id: INPUT.projectId }; } },
    whatsAppConnection: { async findFirst() { return { id: INPUT.connectionId }; } },
    worker: { async findFirst() { return { id: INPUT.workerId }; } },
    workerPerson: { async findFirst() { return { id: INPUT.personId }; } },
    workerChannelIdentity: { async findFirst() { return { id: INPUT.channelIdentityId }; } },
    workerPaymentPrivateReceipt: {
      async findUnique() { return receipt; },
      async findFirst() { return receipt; },
      async create({ data }) {
        createCalls += 1;
        receipt = { ...data, firstAccessedAt: null, lastAccessedAt: null, revokedAt: null };
        return receipt;
      },
      async updateMany() { return { count: 1 }; },
    },
  };
  return {
    prisma,
    companion,
    get receipt() { return receipt; },
    get createCalls() { return createCalls; },
  };
}

test('an opted-in terminal Flow emits one privacy-minimal receipt without persisting its bearer', async () => {
  const store = issueStore();
  const result = await issueWorkerPaymentPrivateReceiptInTransaction(
    store.prisma,
    INPUT,
    {
      now: NOW,
      idFactory: () => RECEIPT_ID,
      webviewSecret: SECRET,
    },
  );

  assert.deepEqual(result.descriptor, { version: 1, receiptId: RECEIPT_ID });
  assert.equal(result.replayed, false);
  assert.equal(store.createCalls, 1);
  assert.equal(store.receipt.contentVersion, WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION);
  assert.match(store.receipt.contentSha256, /^[a-f0-9]{64}$/);
  assert.match(store.receipt.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(store.receipt.destinationLastFour, '1234');
  assert.equal(store.receipt.receivedAt.toISOString(), '2026-07-29T17:59:30.000Z');

  const bearer = reconstructWorkerPaymentPrivateReceiptToken(store.receipt, {
    webviewSecret: SECRET,
  });
  assert.equal(JSON.stringify(store.receipt).includes(bearer), false);
  const link = buildWorkerPaymentPrivateReceiptLink(
    { receipt: store.receipt, token: bearer },
    {},
    { resolveWhatsAppPublicAppUrl: () => 'https://pilot.obrasaas.example' },
  );
  const url = new URL(link);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['receipt', 'worker']);
  assert.equal(url.searchParams.get('worker'), INPUT.workerId);
  assert.equal(url.searchParams.get('receipt'), RECEIPT_ID);
  assert.equal(url.searchParams.has('token'), false);
  assert.match(url.hash, /^#token=.+/);
});

test('legacy or declined sessions remain compatible and create no private receipt', async () => {
  const store = issueStore({ requested: false });
  const result = await issueWorkerPaymentPrivateReceiptInTransaction(
    store.prisma,
    INPUT,
    { now: NOW, idFactory: () => RECEIPT_ID, webviewSecret: SECRET },
  );
  assert.equal(result, null);
  assert.equal(store.createCalls, 0);
});

test('the public receipt DTO never exposes an alias fragment or internal binding', async () => {
  const store = issueStore({ destinationType: 'ALIAS' });
  await issueWorkerPaymentPrivateReceiptInTransaction(
    store.prisma,
    INPUT,
    { now: NOW, idFactory: () => RECEIPT_ID, webviewSecret: SECRET },
  );
  const dto = workerPaymentPrivateReceiptDto(store.receipt);
  assert.deepEqual(dto, {
    reference: RECEIPT_ID,
    receivedAt: '2026-07-29T17:59:30.000Z',
    issuedAt: NOW.toISOString(),
    paymentPurpose: 'SALARY',
    destinationType: 'ALIAS',
    maskedReference: null,
    status: 'RECEIVED_FOR_REVIEW',
    integritySha256: store.receipt.contentSha256,
  });
  const serialized = JSON.stringify(dto);
  for (const restricted of [
    INPUT.organizationId,
    INPUT.projectId,
    INPUT.personId,
    INPUT.channelIdentityId,
    'destination-receipt-a',
    'a-ab',
  ]) {
    assert.equal(serialized.includes(restricted), false, restricted);
  }
  const alternateAliasReceipt = {
    ...store.receipt,
    destinationLastFour: 'z.z-',
  };
  assert.equal(
    workerPaymentPrivateReceiptContentSha256(alternateAliasReceipt),
    store.receipt.contentSha256,
    'the public content hash must not commit to a hidden alias fragment',
  );
  assert.throws(
    () => workerPaymentPrivateReceiptDto({
      ...store.receipt,
      contentSha256: 'f'.repeat(64),
    }),
    (error) => error.code === 'WORKER_PAYMENT_PRIVATE_RECEIPT_CONFIGURATION_INVALID',
  );
});

test('receipt access verifies the HMAC before the first database lookup and consumes one bounded access', async () => {
  const issued = issueStore();
  await issueWorkerPaymentPrivateReceiptInTransaction(
    issued.prisma,
    INPUT,
    { now: NOW, idFactory: () => RECEIPT_ID, webviewSecret: SECRET },
  );
  const receipt = issued.receipt;
  const token = reconstructWorkerPaymentPrivateReceiptToken(receipt, { webviewSecret: SECRET });
  let receiptReads = 0;
  const accessStore = {
    workerPaymentPrivateReceipt: {
      async findUnique() { return receipt; },
      async create() { return receipt; },
      async findFirst() {
        receiptReads += 1;
        return { ...receipt };
      },
      async updateMany({ where, data }) {
        assert.equal(where.accessCount, 0);
        assert.equal(data.accessCount.increment, 1);
        receipt.accessCount += 1;
        receipt.firstAccessedAt = data.firstAccessedAt;
        receipt.lastAccessedAt = data.lastAccessedAt;
        return { count: 1 };
      },
    },
    project: { async findFirst() { return { id: INPUT.projectId }; } },
    whatsAppConnection: { async findFirst() { return { id: INPUT.connectionId }; } },
    worker: { async findFirst() { return { id: INPUT.workerId }; } },
    workerPerson: { async findFirst() { return { id: INPUT.personId }; } },
    workerChannelIdentity: { async findFirst() { return { id: INPUT.channelIdentityId }; } },
    async $transaction(operation) { return operation(accessStore); },
  };

  await assert.rejects(
    readWorkerPaymentPrivateReceipt(accessStore, {
      workerId: INPUT.workerId,
      receiptId: RECEIPT_ID,
      token: `${token.slice(0, -1)}x`,
    }, { now: new Date(NOW.getTime() + 30_000), webviewSecret: SECRET }),
    (error) => error.code === 'WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_INVALID',
  );
  assert.equal(receiptReads, 0, 'invalid HMAC must fail before persistence');

  const result = await readWorkerPaymentPrivateReceipt(accessStore, {
    workerId: INPUT.workerId,
    receiptId: RECEIPT_ID,
    token,
  }, { now: new Date(NOW.getTime() + 30_000), webviewSecret: SECRET });
  assert.equal(receiptReads, 1);
  assert.equal(result.receipt.maskedReference, '•••• 1234');
  assert.equal(result.remainingAccesses, 4);
  assert.equal(receipt.accessCount, 1);
  assert.equal(receipt.firstAccessedAt.toISOString(), '2026-07-29T18:00:30.000Z');
});
