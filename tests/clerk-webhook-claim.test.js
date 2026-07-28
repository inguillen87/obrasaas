import assert from 'node:assert/strict';
import test from 'node:test';

import {
  claimClerkWebhookEvent,
  clerkWebhookRetryResponse,
  completeClerkWebhookEvent,
  failClerkWebhookEvent,
} from '../src/lib/clerk-webhook-claim.js';

test('an in-progress Clerk delivery returns a retryable non-2xx response', async () => {
  const response = clerkWebhookRetryResponse('Processing in progress');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '5');
  assert.equal(await response.text(), 'Processing in progress');
});

function databaseDouble() {
  let record = null;
  return {
    get record() {
      return record;
    },
    webhookEvent: {
      async createMany({ data }) {
        if (record) return { count: 0 };
        record = { id: 'event-db', ...data[0] };
        return { count: 1 };
      },
      async updateMany({ where, data }) {
        if (!record || record.provider !== where.provider || record.externalId !== where.externalId) {
          return { count: 0 };
        }
        let matches = true;
        if (where.status && typeof where.status === 'string') matches = record.status === where.status;
        if (where.leaseToken) matches = matches && record.leaseToken === where.leaseToken;
        if (where.OR) {
          matches = where.OR.some((condition) => {
            if (condition.status === 'PENDING' || condition.status === 'FAILED') {
              return record.status === condition.status;
            }
            return record.status === 'PROCESSING'
              && record.leaseExpiresAt <= condition.leaseExpiresAt.lte;
          });
        }
        if (!matches) return { count: 0 };
        const next = { ...data };
        if (data.attempts?.increment) {
          next.attempts = record.attempts + data.attempts.increment;
        }
        record = { ...record, ...next };
        return { count: 1 };
      },
      async findUnique() {
        return record ? { ...record } : null;
      },
    },
  };
}

function claim(database, overrides = {}) {
  return claimClerkWebhookEvent(database, {
    eventId: 'svix-event-a',
    eventType: 'user.updated',
    payload: { type: 'user.updated', data: { id: 'user_a' } },
    now: new Date('2026-07-17T23:00:00.000Z'),
    leaseToken: overrides.leaseToken || 'lease-a',
    ...overrides,
  });
}

test('concurrent Clerk webhook delivery has exactly one processing winner', async () => {
  const database = databaseDouble();
  const [first, second] = await Promise.all([
    claim(database, { leaseToken: 'lease-a' }),
    claim(database, { leaseToken: 'lease-b' }),
  ]);
  assert.deepEqual([first.state, second.state].sort(), ['claimed', 'in_progress']);
  assert.equal(database.record.attempts, 1);
});

test('completed Clerk webhook is replayed as processed without another claim', async () => {
  const database = databaseDouble();
  const originalPayload = {
    type: 'user.updated',
    data: {
      id: 'user_a',
      email_addresses: [{ email_address: 'persona@example.com' }],
      first_name: 'Persona',
    },
  };
  const first = await claim(database, { payload: originalPayload });
  assert.deepEqual(database.record.payload, originalPayload);
  assert.equal(await completeClerkWebhookEvent(database, {
    eventId: 'svix-event-a',
    leaseToken: first.leaseToken,
  }), true);
  assert.deepEqual(database.record.payload, { version: 1, redacted: true });
  assert.equal(database.record.provider, 'clerk');
  assert.equal(database.record.externalId, 'svix-event-a');
  assert.equal(database.record.eventType, 'user.updated');
  assert.equal(database.record.status, 'PROCESSED');
  assert.equal(database.record.attempts, 1);
  const replay = await claim(database, { leaseToken: 'lease-b' });
  assert.equal(replay.state, 'processed');
  assert.deepEqual(replay.event.payload, { version: 1, redacted: true });
  assert.equal(database.record.attempts, 1);
});

test('a lost completion lease cannot redact payload needed by the active processor', async () => {
  const database = databaseDouble();
  const originalPayload = {
    type: 'organizationMembership.updated',
    data: { id: 'membership_a', public_user_data: { user_id: 'user_a' } },
  };
  await claim(database, {
    eventType: 'organizationMembership.updated',
    payload: originalPayload,
  });

  assert.equal(await completeClerkWebhookEvent(database, {
    eventId: 'svix-event-a',
    leaseToken: 'lease-lost',
  }), false);
  assert.equal(database.record.status, 'PROCESSING');
  assert.deepEqual(database.record.payload, originalPayload);
});

test('failed and expired Clerk webhook claims can be recovered safely', async () => {
  const database = databaseDouble();
  const first = await claim(database);
  assert.equal(await failClerkWebhookEvent(database, {
    eventId: 'svix-event-a',
    leaseToken: first.leaseToken,
    error: new Error('temporary failure'),
  }), true);
  assert.deepEqual(database.record.payload, {
    type: 'user.updated',
    data: { id: 'user_a' },
  });
  const retry = await claim(database, {
    leaseToken: 'lease-b',
    now: new Date('2026-07-17T23:01:00.000Z'),
  });
  assert.equal(retry.state, 'claimed');
  assert.equal(database.record.attempts, 2);
});
