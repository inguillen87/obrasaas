import assert from 'node:assert/strict';
import test from 'node:test';

import { readResendEmailConfig, sendResendEmail } from '../src/lib/email/resend.js';
import { processSupplierReminders } from '../src/lib/supplier-reminder-worker.js';

const config = {
  apiKey: 're_test',
  from: 'ObraSaaS <operaciones@obrasaas.test>',
  verifiedFromDomain: 'obrasaas.test',
  idempotencyNamespace: 'obrasaas-test',
  webhookSecret: 'whsec_test',
  webhookSecrets: ['whsec_test'],
  replyTo: null,
};
const delivery = {
  id: 'delivery-a',
  eventKey: 'supplier:commitment-a:v0:upcoming',
  providerIdempotencyKey: 'obrasaas-test:supplier:commitment-a:v0:upcoming',
  recipientEmail: 'agenda@proveedor.test',
  subject: 'Recordatorio',
  textBody: 'Texto seguro',
};

test('Resend configuration fails closed unless sending and webhook controls exist', () => {
  assert.throws(() => readResendEmailConfig({}), (error) => error.status === 503);
  assert.deepEqual(readResendEmailConfig({
    SUPPLIER_REMINDER_EMAIL_ENABLED: 'true',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'ObraSaaS <operaciones@obrasaas.test>',
    RESEND_VERIFIED_FROM_DOMAIN: 'obrasaas.test',
    RESEND_IDEMPOTENCY_NAMESPACE: 'obrasaas-test',
    RESEND_WEBHOOK_SECRET: 'whsec_test',
  }), config);
});

test('Resend adapter sends a stable idempotency key and accepts only a provider ID', async () => {
  let request;
  const result = await sendResendEmail({
    config,
    delivery,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ id: 'email-provider-a' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers['Idempotency-Key'], delivery.providerIdempotencyKey);
  assert.equal(request.options.headers.Authorization, 'Bearer re_test');
  assert.deepEqual(result, { outcome: 'accepted', provider: 'resend', providerMessageId: 'email-provider-a' });
});

test('ambiguous provider transport results never become retryable', async () => {
  const result = await sendResendEmail({
    config,
    delivery,
    fetchImpl: async () => { throw new Error('connection reset after write'); },
  });
  assert.deepEqual(result, { outcome: 'uncertain', code: 'RESEND_TRANSPORT_UNCERTAIN' });
});

function workerState({
  endsOn = '2026-08-15',
  supplierEmail = delivery.recipientEmail,
  reminderKind = 'UPCOMING',
  commitmentStatus = 'CONFIRMED',
} = {}) {
  const state = {
    delivery: {
      ...delivery,
      organizationId: 'organization-a',
      projectId: 'project-a',
      commitmentId: 'commitment-a',
      scheduleRevision: 0,
      kind: reminderKind,
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date('2026-08-08T12:00:00.000Z'),
      leasedAt: null,
      project: { id: 'project-a', status: 'ACTIVE' },
      commitment: {
        id: 'commitment-a',
        revision: 0,
        scheduleRevision: 0,
        status: commitmentStatus,
        endsOn: new Date(`${endsOn}T00:00:00.000Z`),
        timezone: 'America/Argentina/Buenos_Aires',
        reminderEnabled: true,
        reminderEmail: delivery.recipientEmail,
        reminderEmailConfirmedAt: new Date('2026-08-01T12:00:00.000Z'),
        reminderEmailConfirmedById: 'admin-a',
        supplier: { id: 'supplier-a', email: supplierEmail, active: true },
      },
    },
  };
  const prisma = {
    supplierReminderDelivery: {
      async updateMany({ where, data }) {
        if (['CLAIMED', 'DISPATCHING'].includes(where.status) && where.leasedAt?.lte) return { count: 0 };
        if (where.id && state.delivery.id !== where.id) return { count: 0 };
        if (where.status && typeof where.status === 'string' && state.delivery.status !== where.status) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          state.delivery[key] = value && typeof value === 'object' && Object.hasOwn(value, 'increment')
            ? Number(state.delivery[key] || 0) + Number(value.increment)
            : value;
        }
        return { count: 1 };
      },
      async findFirst({ where }) {
        return state.delivery.id === where.id && state.delivery.status === where.status ? state.delivery : null;
      },
      async count({ where }) {
        if (where.recipientEmail) return 0;
        return ['PENDING', 'FAILED'].includes(state.delivery.status) ? 1 : 0;
      },
      async groupBy() {
        return [{ status: state.delivery.status, _count: { _all: 1 } }];
      },
    },
    supplierReminderWebhookEvent: {
      async findMany() { return []; },
    },
    async $queryRawUnsafe(_sql, now) {
      if (!['PENDING', 'FAILED'].includes(state.delivery.status)) return [];
      state.delivery.status = 'CLAIMED';
      state.delivery.leasedAt = now;
      return [{ ...state.delivery }];
    },
    async $executeRawUnsafe() { return 1; },
    async $transaction(callback) { return callback(this); },
  };
  return { state, prisma };
}

test('worker fences an ambiguous send in UNCERTAIN and never sends it again automatically', async () => {
  const store = workerState();
  let sends = 0;
  const sendEmail = async () => {
    sends += 1;
    return { outcome: 'uncertain', code: 'RESEND_TRANSPORT_UNCERTAIN' };
  };
  const first = await processSupplierReminders(store.prisma, {
    config,
    now: new Date('2026-08-08T12:00:00.000Z'),
    sendEmail,
  });
  assert.equal(first.uncertain, 1);
  assert.equal(store.state.delivery.status, 'UNCERTAIN');
  const second = await processSupplierReminders(store.prisma, {
    config,
    now: new Date('2026-08-08T12:10:00.000Z'),
    sendEmail,
  });
  assert.equal(second.claimed, 0);
  assert.equal(sends, 1);
});

test('worker cancels a reminder after the commitment window has expired', async () => {
  const store = workerState({ endsOn: '2026-08-07' });
  let sends = 0;
  const result = await processSupplierReminders(store.prisma, {
    config,
    now: new Date('2026-08-08T12:00:00.000Z'),
    sendEmail: async () => { sends += 1; return { outcome: 'accepted' }; },
  });
  assert.equal(result.cancelled, 1);
  assert.equal(store.state.delivery.status, 'CANCELLED');
  assert.equal(store.state.delivery.lastError, 'REMINDER_FENCE_STALE');
  assert.equal(sends, 0);
});

test('worker requires reconfirmation after the supplier email changes', async () => {
  const store = workerState({ supplierEmail: 'nueva-agenda@proveedor.test' });
  let sends = 0;
  const result = await processSupplierReminders(store.prisma, {
    config,
    now: new Date('2026-08-08T12:00:00.000Z'),
    sendEmail: async () => { sends += 1; return { outcome: 'accepted' }; },
  });
  assert.equal(result.cancelled, 1);
  assert.equal(store.state.delivery.status, 'CANCELLED');
  assert.equal(sends, 0);
});

test('worker can deliver an immediate cancellation correction for a cancelled commitment', async () => {
  const store = workerState({
    endsOn: '2026-08-07',
    reminderKind: 'CANCELLED',
    commitmentStatus: 'CANCELLED',
  });
  let sends = 0;
  const result = await processSupplierReminders(store.prisma, {
    config,
    now: new Date('2026-08-08T12:00:00.000Z'),
    sendEmail: async () => {
      sends += 1;
      return { outcome: 'accepted', provider: 'resend', providerMessageId: 'email-cancelled-a' };
    },
  });
  assert.equal(result.providerAccepted, 1);
  assert.equal(store.state.delivery.status, 'PROVIDER_ACCEPTED');
  assert.equal(sends, 1);
});
