import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const {
  applyWebhookMessageAtomically,
  claimAutomaticWhatsAppDelivery,
  settleAutomaticWhatsAppDelivery,
} = await import('../src/lib/db.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

const scope = Object.freeze({
  projectId: 'project-automatic-a',
  organizationId: 'organization-automatic-a',
  phoneNumberId: 'phone-automatic-a',
});
const inboundExternalId = 'wamid.automatic-a';
const outboundExternalId = `obrasaas-reply:${inboundExternalId}`;
const preparedAt = '2026-07-28T12:00:01.000Z';
const claimedAt = '2026-07-28T12:00:02.000Z';
const settledAt = '2026-07-28T12:00:03.000Z';

function deliveryJournal(dispatchState, {
  webhookEventId = 'event-automatic-a',
  prepared = null,
  claimed = null,
  settled = null,
  failureCode = null,
  providerStatus = null,
} = {}) {
  return {
    version: 1,
    source: 'automatic-webhook',
    webhookEventId,
    dispatchState,
    ...(prepared ? { preparedAt: prepared } : {}),
    ...(claimed ? { dispatchStartedAt: claimed } : {}),
    ...(settled ? { settledAt: settled } : {}),
    ...(failureCode ? { failureCode } : {}),
    ...(providerStatus ? { providerStatus } : {}),
  };
}

function deliveryStore({
  status = 'prepared',
  metadata = null,
  losePreparedClaim = false,
} = {}) {
  const calls = [];
  const event = {
    id: 'event-automatic-a',
    projectId: scope.projectId,
    provider: 'meta',
    externalId: `project:${scope.projectId}:${inboundExternalId}`,
    eventType: 'message',
    status: 'PROCESSING',
    leaseToken: 'lease-automatic-a',
    appliedAt: new Date('2026-07-28T12:00:00.000Z'),
    outcome: {
      version: 1,
      type: 'message',
      reply: 'Respuesta automática',
      flowPrompt: null,
    },
    payload: {
      version: 1,
      event: {
        provider: 'meta',
        eventType: 'message',
        externalId: inboundExternalId,
        phoneNumberId: scope.phoneNumberId,
        from: '5491112345678',
        timestamp: '2026-07-28T12:00:00.000Z',
      },
      scope: { ...scope },
    },
  };
  const message = {
    id: 'message-automatic-a',
    conversationId: 'conversation-automatic-a',
    externalId: outboundExternalId,
    providerMessageId: null,
    direction: 'OUTBOUND',
    status,
    metadata: metadata ?? {
      sensitivity: 'restricted',
      automaticDelivery: deliveryJournal(status || 'prepared', { prepared: preparedAt }),
    },
    conversation: {
      projectId: scope.projectId,
      channel: 'whatsapp',
      externalId: 'meta:5491112345678',
    },
  };

  function matchesWhere(record, where) {
    return Object.entries(where).every(([field, expected]) => {
      if (field === 'appliedAt' && expected?.not === null) return record.appliedAt != null;
      return record[field] === expected;
    });
  }

  let preparedClaimLost = false;
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', { query, projectId }]);
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        if (
          args.where.id !== scope.projectId
          || args.where.organizationId !== scope.organizationId
        ) return null;
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          whatsapp: { enabled: true, phoneNumberId: scope.phoneNumberId },
        };
      },
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['event', args]);
        return matchesWhere(event, args.where) ? event : null;
      },
    },
    message: {
      async findUnique(args) {
        calls.push(['message-read', args]);
        if (args.where.externalId) {
          return args.where.externalId === message.externalId ? structuredClone(message) : null;
        }
        if (args.where.id) {
          return args.where.id === message.id ? structuredClone(message) : null;
        }
        if (args.where.providerMessageId) {
          return args.where.providerMessageId === message.providerMessageId
            ? { id: message.id }
            : null;
        }
        return null;
      },
      async updateMany(args) {
        calls.push(['message-update', structuredClone(args)]);
        if (
          losePreparedClaim
          && !preparedClaimLost
          && args.where.status === 'prepared'
          && args.data.status === 'sending'
        ) {
          preparedClaimLost = true;
          message.status = 'sending';
          return { count: 0 };
        }
        if (!matchesWhere(message, args.where)) return { count: 0 };
        Object.assign(message, structuredClone(args.data));
        return { count: 1 };
      },
    },
  };
  let transactionCount = 0;
  globalThis.__obraSaasPrisma = {
    async $transaction(callback, options) {
      transactionCount += 1;
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };
  return {
    calls,
    event,
    message,
    get transactionCount() {
      return transactionCount;
    },
  };
}

function claimInput(overrides = {}) {
  return {
    eventId: 'event-automatic-a',
    leaseToken: 'lease-automatic-a',
    inboundExternalId,
    scope,
    ...overrides,
  };
}

test('automatic webhook replies are persisted as prepared without lease or recipient data in the journal', async () => {
  const worker = {
    id: 'worker-automatic-a',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Operario autorizado',
    role: 'Albañil',
    active: true,
    personId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { organizationId: scope.organizationId },
    person: null,
  };
  let storedOutbound = null;
  const transaction = {
    $executeRawUnsafe: async () => undefined,
    webhookEvent: {
      findFirst: async () => ({ id: 'event-automatic-a', appliedAt: null, outcome: null }),
      updateMany: async () => ({ count: 1 }),
    },
    project: {
      findFirst: async () => ({
        id: scope.projectId,
        organizationId: scope.organizationId,
        status: 'ACTIVE',
        latitude: null,
        longitude: null,
        geofenceMeters: 100,
        startsAt: null,
        organization: {
          timezone: 'America/Argentina/Buenos_Aires',
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
        },
        snapshot: { state: { tasks: {}, incidents: [], attendance: {} }, version: 1 },
        whatsapp: { enabled: true, phoneNumberId: scope.phoneNumberId, metadata: null },
      }),
    },
    worker: { findMany: async () => [worker] },
    conversation: {
      upsert: async () => ({ id: 'conversation-automatic-a' }),
      update: async () => ({}),
    },
    message: {
      findUnique: async () => null,
      async create({ data }) {
        if (data.direction === 'OUTBOUND') storedOutbound = structuredClone(data);
        return { id: `message-${data.direction.toLowerCase()}`, ...data };
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    $transaction: async (callback) => callback(transaction),
  };

  await applyWebhookMessageAtomically({
    eventId: 'event-automatic-a',
    leaseToken: 'lease-automatic-a',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: inboundExternalId,
      phoneNumberId: scope.phoneNumberId,
      from: worker.phone,
    },
    scope,
    apply: async () => ({
      reply: 'Respuesta automática',
      flowPrompt: null,
      stateChanged: false,
      newMessages: [
        {
          externalId: inboundExternalId,
          sender: 'user',
          kind: 'text',
          text: 'Hola',
        },
        {
          externalId: outboundExternalId,
          sender: 'bot',
          kind: 'text',
          text: 'Respuesta automática',
          metadata: { sensitivity: 'restricted' },
        },
      ],
    }),
  });

  assert.equal(storedOutbound.status, 'prepared');
  assert.equal(storedOutbound.metadata.sensitivity, 'restricted');
  assert.deepEqual(
    {
      ...storedOutbound.metadata.automaticDelivery,
      preparedAt: '<valid-iso>',
    },
    {
      ...deliveryJournal('prepared'),
      preparedAt: '<valid-iso>',
    },
  );
  assert.equal(
    new Date(storedOutbound.metadata.automaticDelivery.preparedAt).toISOString(),
    storedOutbound.metadata.automaticDelivery.preparedAt,
  );
  assert.equal(JSON.stringify(storedOutbound.metadata).includes('lease-automatic-a'), false);
  assert.equal(JSON.stringify(storedOutbound.metadata).includes(worker.phone), false);
});

test('claim and accepted settlement form two short CAS transactions and preserve safe metadata', async () => {
  const store = deliveryStore();

  const claimed = await claimAutomaticWhatsAppDelivery(claimInput({ now: claimedAt }));

  assert.equal(claimed.dispatch, true);
  assert.equal(claimed.state, 'sending');
  assert.equal(store.message.status, 'sending');
  assert.equal(store.message.metadata.sensitivity, 'restricted');
  assert.deepEqual(store.message.metadata.automaticDelivery, deliveryJournal('sending', {
    prepared: preparedAt,
    claimed: claimedAt,
  }));
  assert.equal(JSON.stringify(store.message.metadata).includes(claimed.claim.leaseToken), false);
  assert.equal(store.transactionCount, 1);

  const settled = await settleAutomaticWhatsAppDelivery({
    claim: claimed.claim,
    state: 'accepted',
    providerMessageId: 'wamid.provider-automatic-a',
    now: settledAt,
  });

  assert.deepEqual(settled, { settled: true, state: 'accepted' });
  assert.equal(store.transactionCount, 2);
  assert.equal(store.message.status, 'accepted');
  assert.equal(store.message.providerMessageId, 'wamid.provider-automatic-a');
  assert.equal(store.message.metadata.sensitivity, 'restricted');
  assert.deepEqual(store.message.metadata.automaticDelivery, deliveryJournal('accepted', {
    prepared: preparedAt,
    claimed: claimedAt,
    settled: settledAt,
  }));

  const replay = await claimAutomaticWhatsAppDelivery(claimInput());
  assert.deepEqual(replay, {
    dispatch: false,
    state: 'accepted',
    reason: 'already_dispatched',
    providerMessageId: 'wamid.provider-automatic-a',
  });
});

for (const legacyStatus of ['sending', null]) {
  test(`re-encountered ${legacyStatus ?? 'null'} delivery becomes unknown and cannot dispatch`, async () => {
    const store = deliveryStore({
      status: legacyStatus,
      metadata: { legacy: true },
    });

    const result = await claimAutomaticWhatsAppDelivery(claimInput({ now: settledAt }));

    assert.equal(result.dispatch, false);
    assert.equal(result.state, 'unknown');
    assert.equal(result.reason, 'STALE_DISPATCH_CLAIM');
    assert.equal(store.message.status, 'unknown');
    assert.equal(store.message.metadata.legacy, true);
    assert.deepEqual(store.message.metadata.automaticDelivery, deliveryJournal('unknown', {
      settled: settledAt,
      failureCode: 'STALE_DISPATCH_CLAIM',
    }));

    const replay = await claimAutomaticWhatsAppDelivery(claimInput());
    assert.deepEqual(replay, {
      dispatch: false,
      state: 'unknown',
      reason: 'terminal',
    });
  });
}

test('a recovered webhook lease retires an unresolved sending claim without dispatching again', async () => {
  const store = deliveryStore();
  const first = await claimAutomaticWhatsAppDelivery(claimInput({ now: claimedAt }));
  assert.equal(first.dispatch, true);

  store.event.leaseToken = 'lease-automatic-recovered';
  const recovered = await claimAutomaticWhatsAppDelivery(claimInput({
    leaseToken: 'lease-automatic-recovered',
    now: settledAt,
  }));

  assert.deepEqual(recovered, {
    dispatch: false,
    state: 'unknown',
    reason: 'STALE_DISPATCH_CLAIM',
  });
  assert.equal(store.message.status, 'unknown');
  assert.deepEqual(store.message.metadata.automaticDelivery, deliveryJournal('unknown', {
    prepared: preparedAt,
    claimed: claimedAt,
    settled: settledAt,
    failureCode: 'STALE_DISPATCH_CLAIM',
  }));
});

test('only the prepared-to-sending CAS winner may dispatch', async () => {
  const store = deliveryStore({ losePreparedClaim: true });

  const losingClaim = await claimAutomaticWhatsAppDelivery(claimInput({ now: claimedAt }));

  assert.deepEqual(losingClaim, {
    dispatch: false,
    state: 'unknown',
    reason: 'CLAIM_CONFLICT',
  });
  assert.equal(store.message.status, 'sending');
  assert.equal(
    store.calls.filter(([name]) => name === 'message-update').length,
    1,
  );
});

test('a malformed prepared journal is retired as unknown instead of dispatched', async () => {
  const store = deliveryStore({
    metadata: {
      sensitivity: 'restricted',
      automaticDelivery: deliveryJournal('prepared', {
        webhookEventId: 'different-event',
        prepared: preparedAt,
      }),
    },
  });

  const result = await claimAutomaticWhatsAppDelivery(claimInput({ now: settledAt }));

  assert.deepEqual(result, {
    dispatch: false,
    state: 'unknown',
    reason: 'STALE_DISPATCH_CLAIM',
  });
  assert.equal(store.message.status, 'unknown');
  assert.equal(store.message.metadata.sensitivity, 'restricted');
  assert.deepEqual(store.message.metadata.automaticDelivery, deliveryJournal('unknown', {
    prepared: preparedAt,
    settled: settledAt,
    failureCode: 'STALE_DISPATCH_CLAIM',
  }));
});

for (const confirmedState of ['accepted', 'sent', 'delivered', 'read']) {
  test(`${confirmedState} automatic delivery is replay-safe and returns its provider correlation`, async () => {
    const store = deliveryStore({ status: confirmedState });
    store.message.providerMessageId = `wamid.provider-${confirmedState}`;

    const result = await claimAutomaticWhatsAppDelivery(claimInput());

    assert.deepEqual(result, {
      dispatch: false,
      state: confirmedState,
      reason: 'already_dispatched',
      providerMessageId: `wamid.provider-${confirmedState}`,
    });
    assert.equal(
      store.calls.some(([name]) => name === 'message-update'),
      false,
    );
  });
}

for (const terminalState of ['failed', 'unknown']) {
  test(`${terminalState} settlement is terminal and never binds a provider message ID`, async () => {
    const store = deliveryStore();
    const claimed = await claimAutomaticWhatsAppDelivery(claimInput({ now: claimedAt }));
    const failureEvidence = terminalState === 'failed'
      ? { failureCode: 'META_HTTP_REJECTED', providerStatus: 400 }
      : { failureCode: 'META_TRANSPORT_AMBIGUOUS' };

    await assert.rejects(
      settleAutomaticWhatsAppDelivery({
        claim: claimed.claim,
        state: terminalState,
        providerMessageId: 'must-not-be-accepted',
      }),
      (error) => error.code === 'WEBHOOK_PAYLOAD_INVALID',
    );
    assert.equal(store.message.status, 'sending');
    assert.equal(store.message.providerMessageId, null);

    await assert.rejects(
      settleAutomaticWhatsAppDelivery({
        claim: claimed.claim,
        state: terminalState,
        failureCode: 'Meta rechazó el teléfono +5491112345678',
      }),
      (error) => error.code === 'WEBHOOK_PAYLOAD_INVALID',
    );
    assert.equal(store.message.status, 'sending');

    const settled = await settleAutomaticWhatsAppDelivery({
      claim: claimed.claim,
      state: terminalState,
      now: settledAt,
      ...failureEvidence,
    });
    assert.deepEqual(settled, { settled: true, state: terminalState });
    assert.equal(store.message.status, terminalState);
    assert.equal(store.message.providerMessageId, null);
    assert.deepEqual(store.message.metadata.automaticDelivery, deliveryJournal(terminalState, {
      prepared: preparedAt,
      claimed: claimedAt,
      settled: settledAt,
      ...failureEvidence,
    }));

    const replay = await claimAutomaticWhatsAppDelivery(claimInput());
    assert.equal(replay.dispatch, false);
    assert.equal(replay.state, terminalState);
    assert.equal(replay.reason, 'terminal');
  });
}

test('claim validates the exact applied webhook lease and tenant connection scope', async () => {
  deliveryStore();
  await assert.rejects(
    claimAutomaticWhatsAppDelivery(claimInput({ leaseToken: 'stale-lease' })),
    (error) => error.code === 'WEBHOOK_LEASE_LOST',
  );

  deliveryStore();
  await assert.rejects(
    claimAutomaticWhatsAppDelivery(claimInput({
      scope: { ...scope, phoneNumberId: 'another-phone' },
    })),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );

  const wrongContact = deliveryStore();
  wrongContact.message.conversation.externalId = 'meta:5491199999999';
  await assert.rejects(
    claimAutomaticWhatsAppDelivery(claimInput()),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );
});

test('settlement revalidates the opaque claim tenant scope before changing the journal', async () => {
  const store = deliveryStore();
  const claimed = await claimAutomaticWhatsAppDelivery(claimInput({ now: claimedAt }));

  await assert.rejects(
    settleAutomaticWhatsAppDelivery({
      claim: { ...claimed.claim, phoneNumberId: 'tampered-phone' },
      state: 'accepted',
      providerMessageId: 'wamid.provider-tampered',
      now: settledAt,
    }),
    (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
  );
  assert.equal(store.message.status, 'sending');
  assert.equal(store.message.providerMessageId, null);
});
