import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  CLERK_WEBHOOK_MAX_BODY_BYTES,
  claimClerkWebhookEvent,
  clerkWebhookRetryResponse,
  completeClerkWebhookEvent,
  createClerkWebhookBodyEvidence,
  failClerkWebhookEvent,
} from '../src/lib/clerk-webhook-claim.js';

const SIGNING_SECRET = `whsec_${'a'.repeat(48)}`;
const EVIDENCE_SECRET = `evidence_${'d'.repeat(48)}`;
const EVIDENCE_KEY_ID = 'clerk-webhook-evidence-v1';
const EVIDENCE_DOMAIN = 'obrasaas:clerk-webhook:verified-body:v1';

function bodyEvidence({
  rawBody = new TextEncoder().encode('{"type":"user.updated","data":{"id":"user_a"}}'),
  instanceId = 'ins_Development123',
  eventId = 'svix-event-a',
  eventType = 'user.updated',
  evidenceSecret = EVIDENCE_SECRET,
  evidenceKeyId = EVIDENCE_KEY_ID,
  signingSecret = SIGNING_SECRET,
} = {}) {
  return createClerkWebhookBodyEvidence(rawBody, {
    instanceId,
    eventId,
    eventType,
    evidenceSecret,
    evidenceKeyId,
    signingSecret,
  });
}

function redactedPayload(evidence) {
  return { version: 1, redacted: true, bodyEvidence: evidence };
}

test('an in-progress Clerk delivery returns a retryable non-2xx response', async () => {
  const response = clerkWebhookRetryResponse('Processing in progress');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '5');
  assert.equal(await response.text(), 'Processing in progress');
});

test('verified Clerk body evidence is domain-separated, envelope-bound and contains no source data', () => {
  const rawBody = new TextEncoder().encode(
    '{\r\n  "type": "user.updated", "email": "persona@example.com"\r\n}\r\n',
  );
  const evidence = bodyEvidence({ rawBody });
  const expectedDigest = createHmac('sha256', EVIDENCE_SECRET)
    .update(`${EVIDENCE_DOMAIN}\0`, 'utf8')
    .update(`${EVIDENCE_KEY_ID}\0ins_Development123\0svix-event-a\0user.updated\0`, 'utf8')
    .update(rawBody)
    .digest('hex');

  assert.deepEqual(evidence, {
    version: 1,
    algorithm: 'hmac-sha256',
    domain: EVIDENCE_DOMAIN,
    keyId: EVIDENCE_KEY_ID,
    instanceId: 'ins_Development123',
    digest: expectedDigest,
  });
  assert.notEqual(bodyEvidence({ rawBody, instanceId: 'ins_Production123' }).digest, evidence.digest);
  assert.notEqual(bodyEvidence({ rawBody, eventId: 'svix-event-b' }).digest, evidence.digest);
  assert.notEqual(bodyEvidence({
    rawBody: new TextEncoder().encode(
      '{"type":"user.updated","email":"persona@example.com"}',
    ),
  }).digest, evidence.digest);
  assert.notEqual(bodyEvidence({
    rawBody,
    evidenceSecret: `evidence_${'c'.repeat(48)}`,
  }).digest, evidence.digest);
  assert.notEqual(bodyEvidence({
    rawBody,
    evidenceKeyId: 'clerk-webhook-evidence-v2',
  }).digest, evidence.digest);
  assert.equal(JSON.stringify(evidence).includes('persona@example.com'), false);
  assert.equal(JSON.stringify(evidence).includes(EVIDENCE_SECRET), false);
  assert.equal(JSON.stringify(evidence).includes(SIGNING_SECRET), false);
  assert.throws(
    () => bodyEvidence({ rawBody: new Uint8Array(CLERK_WEBHOOK_MAX_BODY_BYTES + 1) }),
    /bounded Clerk webhook body bytes/,
  );
  assert.throws(
    () => bodyEvidence({ evidenceSecret: SIGNING_SECRET }),
    /Independent Clerk webhook evidence key configuration/,
  );
  assert.throws(
    () => bodyEvidence({ evidenceKeyId: 'unversioned-key' }),
    /Independent Clerk webhook evidence key configuration/,
  );
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
  const rawBody = new TextEncoder().encode(JSON.stringify(originalPayload));
  const evidence = bodyEvidence({ rawBody });
  const first = await claim(database, { payload: originalPayload });
  assert.deepEqual(database.record.payload, originalPayload);
  assert.equal(await completeClerkWebhookEvent(database, {
    eventId: 'svix-event-a',
    leaseToken: first.leaseToken,
    bodyEvidence: evidence,
  }), true);
  assert.deepEqual(database.record.payload, redactedPayload(evidence));
  assert.equal(database.record.provider, 'clerk');
  assert.equal(database.record.externalId, 'svix-event-a');
  assert.equal(database.record.eventType, 'user.updated');
  assert.equal(database.record.status, 'PROCESSED');
  assert.equal(database.record.attempts, 1);
  const replay = await claim(database, { leaseToken: 'lease-b' });
  assert.equal(replay.state, 'processed');
  assert.deepEqual(replay.event.payload, redactedPayload(evidence));
  assert.equal(database.record.attempts, 1);
});

test('completion rejects malformed body evidence without mutating the retry payload', async () => {
  const database = databaseDouble();
  await claim(database);

  const validEvidence = bodyEvidence();
  const invalidEvidence = [
    null,
    { ...validEvidence, digest: 'not-a-sha256' },
    { ...validEvidence, domain: 'another-domain' },
    { ...validEvidence, rawBody: 'must never be persisted' },
  ];
  for (const candidate of invalidEvidence) {
    await assert.rejects(
      completeClerkWebhookEvent(database, {
        eventId: 'svix-event-a',
        leaseToken: 'lease-a',
        bodyEvidence: candidate,
      }),
      /Valid Clerk webhook body evidence/,
    );
  }
  assert.equal(database.record.status, 'PROCESSING');
  assert.deepEqual(database.record.payload, {
    type: 'user.updated',
    data: { id: 'user_a' },
  });
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
    bodyEvidence: bodyEvidence({
      rawBody: new TextEncoder().encode(JSON.stringify(originalPayload)),
      eventType: 'organizationMembership.updated',
    }),
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
