import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WorkerPrivacyChoiceError,
  recordWorkerPaymentCapturePrivacyChoice,
} from '../src/lib/worker-privacy-choices.js';
import { getCurrentWorkerPaymentPrivacyNotice } from '../src/lib/worker-payment-privacy-notices.js';

const NOW = new Date('2026-07-29T15:00:00.000Z');
const NOTICE = getCurrentWorkerPaymentPrivacyNotice();

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && 'in' in expected) {
      return expected.in.includes(row[key]);
    }
    return row[key] === expected;
  });
}

function fixture() {
  const state = {
    organizations: [{
      id: 'org-a',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    }],
    people: [{
      id: 'person-a',
      organizationId: 'org-a',
      status: 'ACTIVE',
      identityStatus: 'VERIFIED',
    }],
    memberships: [{
      id: 'finance-a',
      organizationId: 'org-a',
      userId: 'user-finance',
      tenantRole: 'FINANCE',
      status: 'ACTIVE',
    }],
    channels: [{
      id: 'channel-a',
      organizationId: 'org-a',
      personId: 'person-a',
      provider: 'WHATSAPP',
      status: 'VERIFIED',
      revokedAt: null,
    }],
    choices: [],
    audits: [],
  };
  const transaction = {
    $executeRawUnsafe: async () => 1,
    organization: {
      findUnique: async ({ where }) => state.organizations.find((row) => matches(row, where)) ?? null,
    },
    workerPerson: {
      findFirst: async ({ where }) => state.people.find((row) => matches(row, where)) ?? null,
    },
    tenantMembership: {
      findFirst: async ({ where }) => state.memberships.find((row) => matches(row, where)) ?? null,
    },
    workerChannelIdentity: {
      findFirst: async ({ where }) => state.channels.find((row) => matches(row, where)) ?? null,
    },
    workerPrivacyChoiceEvent: {
      findFirst: async ({ where }) => state.choices.find((row) => matches(row, where)) ?? null,
      create: async ({ data }) => {
        if (state.choices.some((row) => (
          row.organizationId === data.organizationId && row.operationKey === data.operationKey
        ))) throw Object.assign(new Error('unique choice'), { code: 'P2002' });
        const row = structuredClone(data);
        state.choices.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        const row = { id: `audit-${state.audits.length + 1}`, ...structuredClone(data) };
        state.audits.push(row);
        return row;
      },
    },
  };
  return {
    state,
    prisma: {
      $transaction: async (operation) => operation(transaction),
    },
  };
}

function options({
  submittedBy = { type: 'TENANT_MEMBERSHIP', membershipId: 'finance-a' },
  operationKey = 'privacy-choice-operation-a',
  presentedAt = new Date(NOW.getTime() - 1_000),
  overrides = {},
} = {}) {
  return {
    scope: { organizationId: 'org-a' },
    personId: 'person-a',
    paymentPurpose: 'SALARY',
    submittedBy,
    notice: {
      version: NOTICE.version,
      contentSha256: NOTICE.contentSha256,
      presentedAt,
    },
    operationKey,
    now: NOW,
    idFactory: () => `choice-${operationKey}`,
    ...overrides,
  };
}

function expectCode(code) {
  return (error) => error instanceof WorkerPrivacyChoiceError && error.code === code;
}

test('records and exactly replays a privacy-minimal dashboard attestation', async () => {
  const { prisma, state } = fixture();
  const first = await recordWorkerPaymentCapturePrivacyChoice(prisma, options());
  const replay = await recordWorkerPaymentCapturePrivacyChoice(prisma, options());
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(state.choices.length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.choices[0].channel, 'TENANT_DASHBOARD');
  assert.equal(state.choices[0].action, 'ADMIN_ATTESTED');
  const serialized = JSON.stringify({ choice: state.choices[0], audit: state.audits[0] });
  for (const forbidden of ['cuil', 'cbu', 'cvu', 'alias', 'holderName', 'encryptedPayload']) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test('derives worker acknowledgement only from the exact verified WhatsApp channel', async () => {
  const { prisma, state } = fixture();
  const result = await recordWorkerPaymentCapturePrivacyChoice(prisma, options({
    submittedBy: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
    operationKey: 'privacy-choice-whatsapp-a',
  }));
  assert.equal(result.privacyChoiceEvent.channel, 'WHATSAPP_FLOW');
  assert.equal(result.privacyChoiceEvent.action, 'WORKER_ACKNOWLEDGED');
  state.channels[0].status = 'REVOKED';
  await assert.rejects(
    recordWorkerPaymentCapturePrivacyChoice(prisma, options({
      submittedBy: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
      operationKey: 'privacy-choice-whatsapp-revoked',
    })),
    expectCode('WORKER_PRIVACY_CHOICE_ACTOR_FORBIDDEN'),
  );

  state.channels[0].status = 'VERIFIED';
  state.channels[0].revokedAt = NOW;
  await assert.rejects(
    recordWorkerPaymentCapturePrivacyChoice(prisma, options({
      submittedBy: { type: 'WORKER_CHANNEL', channelIdentityId: 'channel-a' },
      operationKey: 'privacy-choice-whatsapp-revoked-at',
    })),
    expectCode('WORKER_PRIVACY_CHOICE_ACTOR_FORBIDDEN'),
  );
});

test('does not append a payment privacy event after identity verification is withdrawn', async () => {
  const { prisma, state } = fixture();
  state.people[0].identityStatus = 'PENDING_REVIEW';
  await assert.rejects(
    recordWorkerPaymentCapturePrivacyChoice(prisma, options({
      operationKey: 'privacy-choice-identity-withdrawn',
    })),
    expectCode('WORKER_PRIVACY_CHOICE_IDENTITY_UNVERIFIED'),
  );
  assert.equal(state.choices.length, 0);
  assert.equal(state.audits.length, 0);
});

test('rejects caller financial fields and unregistered evidence while tolerating a retry clock', async () => {
  const { prisma } = fixture();
  await assert.rejects(
    recordWorkerPaymentCapturePrivacyChoice(prisma, options({ overrides: { cbu: 'not-allowed' } })),
    expectCode('WORKER_PRIVACY_CHOICE_UNKNOWN_FIELDS'),
  );
  const badNotice = options({ operationKey: 'privacy-choice-bad-notice' });
  badNotice.notice.contentSha256 = 'b'.repeat(64);
  await assert.rejects(
    recordWorkerPaymentCapturePrivacyChoice(prisma, badNotice),
    expectCode('WORKER_PRIVACY_CHOICE_INPUT_INVALID'),
  );
  await recordWorkerPaymentCapturePrivacyChoice(prisma, options({
    operationKey: 'privacy-choice-drift',
  }));
  const replay = await recordWorkerPaymentCapturePrivacyChoice(prisma, options({
    operationKey: 'privacy-choice-drift',
    presentedAt: new Date(NOW.getTime() - 2_000),
  }));
  assert.equal(replay.replayed, true);
  assert.equal(
    replay.privacyChoiceEvent.presentedAt,
    new Date(NOW.getTime() - 1_000).toISOString(),
  );
});
