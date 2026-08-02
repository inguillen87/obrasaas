import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySupplierReminderWebhook,
  reconcileSupplierReminderWebhooks,
  verifyResendWebhook,
} from '../src/lib/supplier-reminder-webhooks.js';

function event(id, type, createdAt = '2026-08-01T12:00:00.000Z') {
  return {
    id,
    rawBody: JSON.stringify({ type, created_at: createdAt, data: { email_id: 'email-a' } }),
    event: { type, created_at: createdAt, data: { email_id: 'email-a' } },
  };
}

function webhookStore({ status = 'DISPATCHING', providerMessageId = null } = {}) {
  const state = {
    delivery: {
      id: 'delivery-a',
      organizationId: 'organization-a',
      projectId: 'project-a',
      status,
      provider: providerMessageId ? 'resend' : null,
      providerMessageId,
      providerStatusAt: providerMessageId ? new Date('2026-08-01T11:59:00.000Z') : null,
    },
    events: new Map(),
    applications: new Map(),
  };
  const prisma = {
    supplierReminderWebhookEvent: {
      async findUnique({ where }) {
        const row = state.events.get(where.id);
        return row ? { ...row, application: state.applications.get(row.id) || null } : null;
      },
      async create({ data }) {
        const row = { ...data, createdAt: new Date() };
        state.events.set(row.id, row);
        return row;
      },
      async findMany({ where }) {
        return [...state.events.values()]
          .filter((row) => (!where.providerMessageId || row.providerMessageId === where.providerMessageId))
          .filter((row) => where.application !== null || !state.applications.has(row.id))
          .sort((left, right) => left.occurredAt - right.occurredAt || left.id.localeCompare(right.id));
      },
    },
    supplierReminderWebhookApplication: {
      async create({ data }) {
        if (state.applications.has(data.eventId)) throw new Error('duplicate application');
        state.applications.set(data.eventId, { ...data });
        return data;
      },
    },
    supplierReminderDelivery: {
      async findFirst({ where }) {
        if (where.id && where.id !== state.delivery.id) return null;
        if (where.provider && where.provider !== state.delivery.provider) return null;
        if (where.providerMessageId && where.providerMessageId !== state.delivery.providerMessageId) return null;
        return { ...state.delivery };
      },
      async updateMany({ where, data }) {
        if (where.id !== state.delivery.id) return { count: 0 };
        if (!where.status.in.includes(state.delivery.status)) return { count: 0 };
        const occurredAt = data.providerStatusAt;
        if (state.delivery.providerStatusAt && state.delivery.providerStatusAt > occurredAt) return { count: 0 };
        Object.assign(state.delivery, data);
        return { count: 1 };
      },
    },
    async $transaction(callback) { return callback(this); },
  };
  return { prisma, state };
}

test('Resend signature verification accepts the previous secret only during rotation', () => {
  class FakeResend {
    constructor() {
      this.webhooks = {
        verify: ({ webhookSecret }) => {
          if (webhookSecret !== 'whsec_previous') throw new Error('bad signature');
          return { type: 'email.delivered', created_at: '2026-08-01T12:00:00.000Z', data: { email_id: 'email-a' } };
        },
      };
    }
  }
  const verified = verifyResendWebhook({
    rawBody: '{}',
    headers: new Headers({
      'svix-id': 'event-a',
      'svix-timestamp': '1785585600',
      'svix-signature': 'v1,test',
    }),
    webhookSecrets: ['whsec_current', 'whsec_previous'],
    ResendClass: FakeResend,
  });
  assert.equal(verified.id, 'event-a');
  assert.equal(verified.event.type, 'email.delivered');
});

test('an early webhook is persisted and reconciled after the provider id is committed', async () => {
  const store = webhookStore();
  const delivered = event('event-delivered', 'email.delivered');
  const early = await applySupplierReminderWebhook(store.prisma, delivered);
  assert.deepEqual(early, {
    accepted: true,
    persisted: true,
    matched: false,
    applied: false,
    replayed: false,
  });
  assert.equal(store.state.events.size, 1);
  assert.equal(store.state.delivery.status, 'DISPATCHING');

  Object.assign(store.state.delivery, {
    status: 'PROVIDER_ACCEPTED',
    provider: 'resend',
    providerMessageId: 'email-a',
  });
  const reconciled = await reconcileSupplierReminderWebhooks(store.prisma, {
    deliveryId: 'delivery-a',
    providerMessageId: 'email-a',
  });
  assert.deepEqual(reconciled, { matched: true, applied: 1 });
  assert.equal(store.state.delivery.status, 'DELIVERED');
  assert.equal(store.state.applications.get('event-delivered').appliedStatus, 'DELIVERED');
});

test('webhooks are replay-safe, ordered and allow a later bounce to supersede delivery', async () => {
  const store = webhookStore({ status: 'PROVIDER_ACCEPTED', providerMessageId: 'email-a' });
  const delivered = event('event-delivered', 'email.delivered', '2026-08-01T12:02:00.000Z');
  assert.equal((await applySupplierReminderWebhook(store.prisma, delivered)).applied, true);
  assert.equal(store.state.delivery.status, 'DELIVERED');

  const replay = await applySupplierReminderWebhook(store.prisma, delivered);
  assert.equal(replay.replayed, true);
  assert.equal(replay.applied, false);

  const delayedOld = event('event-delayed', 'email.delivery_delayed', '2026-08-01T12:01:00.000Z');
  assert.equal((await applySupplierReminderWebhook(store.prisma, delayedOld)).applied, false);
  assert.equal(store.state.delivery.status, 'DELIVERED');

  const bounced = event('event-bounced', 'email.bounced', '2026-08-01T12:03:00.000Z');
  assert.equal((await applySupplierReminderWebhook(store.prisma, bounced)).applied, true);
  assert.equal(store.state.delivery.status, 'BOUNCED');
});

test('a reused svix id with different content is rejected as an incident', async () => {
  const store = webhookStore({ status: 'PROVIDER_ACCEPTED', providerMessageId: 'email-a' });
  await applySupplierReminderWebhook(store.prisma, event('event-a', 'email.delivered'));
  await assert.rejects(
    applySupplierReminderWebhook(store.prisma, event('event-a', 'email.bounced')),
    (error) => error.code === 'SUPPLIER_REMINDER_WEBHOOK_REPLAY_MISMATCH' && error.status === 409,
  );
});
