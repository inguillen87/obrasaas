import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { generateWebviewToken } from '../src/lib/auth.js';
import {
  WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_PURPOSE,
} from '../src/lib/worker-payment-private-receipts.js';
import {
  WORKER_PAYMENT_PRIVATE_RECEIPT_STALE_REPLY,
  materializeWorkerPaymentPrivateReceiptDelivery,
} from '../src/lib/whatsapp/worker-payment-receipt-delivery.js';

const NOW = new Date('2026-07-29T19:00:00.000Z');
const SECRET = 'worker-payment-private-receipt-delivery-secret';
const RECEIPT_ID = '123e4567-e89b-42d3-a456-426614174710';
const SCOPE = Object.freeze({
  organizationId: 'organization-receipt-delivery',
  projectId: 'project-receipt-delivery',
  phoneNumberId: '1225843560610854',
});

function tokenFor(receipt) {
  return generateWebviewToken(receipt.workerId, {
    now: receipt.issuedAt.getTime(),
    ttlSeconds: (receipt.expiresAt.getTime() - receipt.issuedAt.getTime()) / 1_000,
    purpose: WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_PURPOSE,
    scope: receipt.id,
    secret: SECRET,
  });
}

function deliveryStore({
  expiresAt = new Date(NOW.getTime() + (15 * 60 * 1_000)),
  issuedAt = NOW,
  accessCount = 0,
  revokedAt = null,
  resolvedWorkerId = 'worker-receipt-delivery',
  resolvedChannelId = 'channel-receipt-delivery',
} = {}) {
  const calls = [];
  const audits = [];
  const receipt = {
    id: RECEIPT_ID,
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    connectionId: 'connection-receipt-delivery',
    flowSessionId: '123e4567-e89b-42d3-a456-426614174711',
    workerId: 'worker-receipt-delivery',
    personId: 'person-receipt-delivery',
    channelIdentityId: 'channel-receipt-delivery',
    sourceWebhookEventId: 'webhook-receipt-delivery',
    issuedAt,
    expiresAt,
    accessCount,
    revokedAt,
    tokenHash: '',
  };
  receipt.tokenHash = crypto.createHash('sha256').update(tokenFor(receipt)).digest('hex');
  const transaction = {
    workerPaymentPrivateReceipt: {
      async findFirst({ where }) {
        calls.push(['receipt-read', where]);
        return where.id === RECEIPT_ID
          && where.organizationId === SCOPE.organizationId
          && where.projectId === SCOPE.projectId
          && where.sourceWebhookEventId === receipt.sourceWebhookEventId
          ? { ...receipt }
          : null;
      },
    },
    project: {
      async findFirst({ where }) {
        calls.push(['project-read', where]);
        return { id: SCOPE.projectId };
      },
    },
    whatsAppConnection: {
      async findFirst({ where }) {
        calls.push(['connection-read', where]);
        return where.phoneNumberId === SCOPE.phoneNumberId
          ? { id: receipt.connectionId }
          : null;
      },
    },
    auditLog: {
      async create({ data }) {
        calls.push(['audit-create', data.action]);
        audits.push(data);
        return data;
      },
    },
  };
  const prisma = {
    ...transaction,
    async $transaction(operation, options) {
      calls.push(['transaction-start', options]);
      const result = await operation(transaction);
      calls.push(['transaction-commit']);
      return result;
    },
  };
  const deps = {
    clock: () => NOW,
    webviewSecret: SECRET,
    environment: { NEXT_PUBLIC_APP_URL: 'https://pilot.obrasaas.example' },
    async assertSubscription() { calls.push(['subscription-fence']); },
    async resolveWorker(_transaction, scope, recipientPhone) {
      calls.push(['worker-resolve', { scope, recipientPhone }]);
      return {
        status: 'RESOLVED',
        source: 'CANONICAL',
        worker: {
          id: resolvedWorkerId,
          personId: receipt.personId,
          person: { identityStatus: 'VERIFIED' },
        },
        channelIdentityId: resolvedChannelId,
      };
    },
  };
  return { prisma, deps, receipt, calls, audits };
}

function deliveryInput() {
  return {
    descriptor: { version: 1, receiptId: RECEIPT_ID },
    scope: SCOPE,
    recipientPhone: '15551234567',
    eventId: 'webhook-receipt-delivery',
  };
}

test('the private receipt bearer is reconstructed only in memory after durable delivery dispatch', async () => {
  const store = deliveryStore();
  const result = await materializeWorkerPaymentPrivateReceiptDelivery(
    store.prisma,
    deliveryInput(),
    store.deps,
  );

  assert.equal(result.mode, 'LINK');
  const link = result.text.match(
    /https:\/\/pilot\.obrasaas\.example\/webview\/worker-payment-receipt\?[^\s#]+#[^\s]+/,
  )?.[0];
  assert.ok(link);
  const url = new URL(link);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['receipt', 'worker']);
  assert.equal(url.searchParams.has('token'), false);
  assert.match(url.hash, /^#token=.+/);
  assert.match(result.text, /no acredita titularidad, validación bancaria, activación, transferencia ni pago/i);
  assert.equal(JSON.stringify(store.receipt).includes(tokenFor(store.receipt)), false);
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].action, 'worker_payment.private_receipt.link_materialized');
  assert.deepEqual(store.audits[0].metadata.secretPersisted, false);
});

test('an expired receipt produces one safe fallback without reconstructing a bearer', async () => {
  const store = deliveryStore({
    issuedAt: new Date(NOW.getTime() - (16 * 60 * 1_000)),
    expiresAt: new Date(NOW.getTime() - (60 * 1_000)),
  });
  const result = await materializeWorkerPaymentPrivateReceiptDelivery(
    store.prisma,
    deliveryInput(),
    store.deps,
  );

  assert.deepEqual(result, {
    mode: 'FALLBACK',
    reason: 'EXPIRED',
    receiptId: RECEIPT_ID,
    text: WORKER_PAYMENT_PRIVATE_RECEIPT_STALE_REPLY,
  });
  assert.doesNotMatch(result.text, /token=|https?:\/\//i);
  assert.equal(store.audits[0].action, 'worker_payment.private_receipt.link_unavailable');
});

test('delivery fails closed when the current canonical channel no longer matches the receipt', async () => {
  const store = deliveryStore({ resolvedChannelId: 'channel-other' });
  await assert.rejects(
    materializeWorkerPaymentPrivateReceiptDelivery(
      store.prisma,
      deliveryInput(),
      store.deps,
    ),
    (error) => error.code === 'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONTEXT_INVALID',
  );
  assert.equal(store.audits.length, 0);
});

test('the descriptor is bound to the exact webhook event that issued the receipt', async () => {
  const store = deliveryStore();
  await assert.rejects(
    materializeWorkerPaymentPrivateReceiptDelivery(
      store.prisma,
      { ...deliveryInput(), eventId: 'webhook-other' },
      store.deps,
    ),
    (error) => error.code === 'WORKER_PAYMENT_PRIVATE_RECEIPT_DELIVERY_CONTEXT_INVALID',
  );
  assert.equal(store.calls.some(([name]) => name === 'worker-resolve'), false);
});
