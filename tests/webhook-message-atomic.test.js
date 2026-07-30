import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalFlowTokenSecret = process.env.WHATSAPP_FLOW_TOKEN_SECRET;
const originalOnboardingFlowTokenSecret = process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET;
const originalFingerprintKeyId = process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_ID;
const originalFingerprintKeyRegistry = process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';
process.env.WHATSAPP_FLOW_TOKEN_SECRET = 'unit-test-whatsapp-flow-session-secret';
process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET = 'unit-test-worker-onboarding-flow-secret';
process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_ID = 'webhook-receipt-fingerprint-v1';
process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON = JSON.stringify({
  'webhook-receipt-fingerprint-v1': Buffer.alloc(32, 47).toString('base64'),
});

const {
  applyWebhookMessageAtomically,
  assertExpiredWhatsAppFlowRecoveryResult,
} = await import('../src/lib/db.js');
const {
  issueWhatsAppFlowSession,
  markWhatsAppFlowSessionDeliveryAttempted,
  whatsAppFlowTokenEvidence,
} = await import('../src/lib/whatsapp/flow-sessions.js');
const {
  issueWorkerOnboardingFlowSession,
  markWorkerOnboardingFlowPrivacyPresented,
  markWorkerOnboardingFlowSessionDeliveryAttempted,
  markWorkerOnboardingFlowSessionSubmitted,
  workerOnboardingFlowTokenEvidence,
} = await import('../src/lib/whatsapp/worker-onboarding-flow-sessions.js');
const {
  getCurrentWorkerOnboardingPrivacyNotice,
} = await import('../src/lib/worker-onboarding-privacy-notices.js');
const {
  readWorkerFinancialFingerprintKeyRegistry,
  workerFinancialFingerprint,
} = await import('../src/lib/worker-financial-data.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalFlowTokenSecret === undefined) delete process.env.WHATSAPP_FLOW_TOKEN_SECRET;
  else process.env.WHATSAPP_FLOW_TOKEN_SECRET = originalFlowTokenSecret;
  if (originalOnboardingFlowTokenSecret === undefined) {
    delete process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET;
  } else {
    process.env.WORKER_ONBOARDING_FLOW_TOKEN_SECRET = originalOnboardingFlowTokenSecret;
  }
  if (originalFingerprintKeyId === undefined) delete process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_ID;
  else process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_ID = originalFingerprintKeyId;
  if (originalFingerprintKeyRegistry === undefined) {
    delete process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON;
  } else {
    process.env.WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON = originalFingerprintKeyRegistry;
  }
  delete globalThis.__obraSaasPrisma;
});

function inMemoryFlowSessions(calls) {
  const records = [];
  const delegate = {
    async findUnique({ where }) {
      calls.push(['flow-read', where]);
      if (where.id) {
        return records.find((record) => record.id === where.id) || null;
      }
      const binding = where.projectId_sourceExternalId_blueprintKey;
      return records.find((record) => (
        binding
        && record.projectId === binding.projectId
        && record.sourceExternalId === binding.sourceExternalId
        && record.blueprintKey === binding.blueprintKey
      )) || null;
    },
    async create({ data }) {
      calls.push(['flow-create', data]);
      const record = {
        ...data,
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        providerMessageId: null,
        consumedAt: null,
        consumedExternalId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.push(record);
      return record;
    },
    async updateMany({ where, data }) {
      calls.push(['flow-consume', { where, data }]);
      const matching = records.filter((record) => Object.entries(where).every(([field, expected]) => {
        const actual = record[field];
        if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
          if (Object.hasOwn(expected, 'gt')) return actual > expected.gt;
          if (Object.hasOwn(expected, 'lte')) return actual <= expected.lte;
          if (Object.hasOwn(expected, 'not')) return actual !== expected.not;
        }
        return actual === expected;
      }));
      for (const record of matching) {
        Object.assign(record, data, { updatedAt: new Date() });
      }
      return { count: matching.length };
    },
  };
  return {
    delegate,
    records,
    get record() {
      return records.at(-1) || null;
    },
  };
}

function inMemoryWorkerOnboardingFlowSessions(claim, calls) {
  const records = [];
  const matches = (record, where) => Object.entries(where).every(([field, expected]) => {
    const actual = record[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, 'gt')) return actual > expected.gt;
      if (Object.hasOwn(expected, 'lte')) return actual <= expected.lte;
      if (Object.hasOwn(expected, 'not')) return actual !== expected.not;
    }
    return actual === expected;
  });
  return {
    records,
    claims: [claim],
    sessionDelegate: {
      async findUnique({ where }) {
        calls.push(['onboarding-flow-read', where]);
        if (where.id) return records.find((record) => record.id === where.id) || null;
        const binding = where.projectId_sourceExternalId_blueprintKey;
        return records.find((record) => binding && (
          record.projectId === binding.projectId
          && record.sourceExternalId === binding.sourceExternalId
          && record.blueprintKey === binding.blueprintKey
        )) || null;
      },
      async create({ data }) {
        calls.push(['onboarding-flow-create', data]);
        const record = {
          ...data,
          deliveryAttemptedAt: null,
          deliveryRejectedAt: null,
          sentAt: null,
          providerMessageId: null,
          privacyPresentedAt: null,
          submittedAt: null,
          consumedAt: null,
          consumedExternalId: null,
          updatedAt: data.createdAt,
        };
        records.push(record);
        return record;
      },
      async updateMany({ where, data }) {
        calls.push(['onboarding-flow-update', { where, data }]);
        const matching = records.filter((record) => matches(record, where));
        for (const record of matching) Object.assign(record, data, { updatedAt: new Date() });
        return { count: matching.length };
      },
    },
    claimDelegate: {
      async findFirst({ where }) {
        calls.push(['onboarding-claim-read', where]);
        return [claim].find((record) => matches(record, where)) || null;
      },
    },
  };
}

test('expired Flow recovery results cannot mutate state or switch blueprints', () => {
  const expired = { blueprintKey: 'incident-report' };
  assert.doesNotThrow(() => assertExpiredWhatsAppFlowRecoveryResult(expired, {
    stateChanged: false,
    flowPrompt: 'incident-report',
  }));
  assert.doesNotThrow(() => assertExpiredWhatsAppFlowRecoveryResult(expired, {
    stateChanged: false,
    flowPrompt: null,
  }));
  assert.throws(
    () => assertExpiredWhatsAppFlowRecoveryResult(expired, {
      stateChanged: true,
      flowPrompt: 'incident-report',
    }),
    (error) => error.code === 'WEBHOOK_OUTCOME_INVALID',
  );
  assert.throws(
    () => assertExpiredWhatsAppFlowRecoveryResult(expired, {
      stateChanged: false,
      flowPrompt: 'shift-check-in',
    }),
    (error) => error.code === 'WEBHOOK_OUTCOME_INVALID',
  );
});

test('an accepted message can finish draining after its project is paused', async () => {
  const scope = {
    projectId: 'project-paused-after-ingress',
    organizationId: 'organization-a',
    phoneNumberId: 'phone-a',
  };
  const worker = {
    id: 'worker-a',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Capataz autorizado',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: new Date('2026-07-16T12:00:00.000Z'),
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
    project: { organizationId: scope.organizationId },
  };
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['event-read', args]);
        return { id: 'event-a', appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        return { count: 1 };
      },
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'PAUSED',
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: {
            state: { incidents: [], attendance: {}, tasks: {} },
            version: 3,
          },
          whatsapp: { phoneNumberId: scope.phoneNumberId, enabled: true },
        };
      },
    },
    worker: {
      async findMany(args) {
        calls.push(['worker', args]);
        return [worker];
      },
    },
    task: {
      async findMany(args) {
        calls.push(['task-find', args]);
        return [];
      },
      async upsert(args) {
        calls.push(['task-upsert', args]);
        return args.create;
      },
      async deleteMany(args) {
        calls.push(['task-delete', args]);
        return { count: 0 };
      },
    },
    projectSnapshot: {
      async upsert(args) {
        calls.push(['snapshot', args]);
        return args.update;
      },
    },
    conversation: {
      async upsert(args) {
        calls.push(['conversation', args]);
        return { id: 'conversation-a' };
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-a',
    leaseToken: 'lease-a',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.accepted-before-pause',
      phoneNumberId: scope.phoneNumberId,
      from: worker.phone,
    },
    scope,
    apply: async ({ projectSettings, worker: trustedWorker, state }) => {
      assert.equal(projectSettings.id, scope.projectId);
      assert.equal(trustedWorker.id, worker.id);
      state.tasks['task-a'] = {
        name: 'Estructura principal',
        assignee: 'Cuadrilla A',
        progress: 35,
        duration: 3,
        startDay: 2,
      };
      return {
        reply: 'Evento aplicado',
        flowPrompt: null,
        stateChanged: true,
        newMessages: [],
      };
    },
  });

  assert.equal(result.alreadyApplied, false);
  assert.equal(result.outcome.reply, 'Evento aplicado');
  const projectQuery = calls.find(([name]) => name === 'project')[1];
  assert.deepEqual(projectQuery.where, {
    id: scope.projectId,
    organizationId: scope.organizationId,
    status: { in: ['ACTIVE', 'PAUSED'] },
  });
  const taskProjectionRead = calls.find(([name]) => name === 'task-find')[1];
  assert.deepEqual(taskProjectionRead.where, {
    projectId: scope.projectId,
    metadata: { path: ['source'], equals: 'project-snapshot-v1' },
  });
  const taskProjectionWrite = calls.find(([name]) => name === 'task-upsert')[1];
  assert.deepEqual(taskProjectionWrite.where.projectId_externalId, {
    projectId: scope.projectId,
    externalId: 'snapshot:task-a',
  });
  assert.equal(taskProjectionWrite.create.progress, 35);
  assert.equal(taskProjectionWrite.create.metadata.projectStateVersion, 4);
  assert.equal(taskProjectionWrite.create.startsAt.toISOString(), '2026-08-02T00:00:00.000Z');
  assert.equal(taskProjectionWrite.create.endsAt.toISOString(), '2026-08-04T00:00:00.000Z');
  const snapshotWrite = calls.find(([name]) => name === 'snapshot')[1];
  assert.equal(snapshotWrite.update.state.tasks['task-a'].progress, 35);
  assert.deepEqual(snapshotWrite.update.version, { increment: 1 });
  assert.ok(
    calls.findIndex(([name]) => name === 'task-upsert')
      < calls.findIndex(([name]) => name === 'snapshot'),
  );
  assert.ok(
    calls.findIndex(([name]) => name === 'snapshot')
      < calls.findIndex(([name]) => name === 'event-apply'),
  );
  assert.equal(calls.some(([name]) => name === 'event-apply'), true);
});

test('an unknown Meta contact is durably quarantined without engine or operational effects', async () => {
  const scope = {
    projectId: 'project-quarantine-a',
    organizationId: 'organization-quarantine-a',
    phoneNumberId: 'phone-quarantine-a',
  };
  const calls = [];
  let storedConversation = null;
  let storedMessage = null;
  let storedOutcome = null;
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['event-read', args]);
        return { id: 'event-quarantine-a', appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        storedOutcome = structuredClone(args.data.outcome);
        return { count: 1 };
      },
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return {
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
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} }, version: 1 },
          whatsapp: { phoneNumberId: scope.phoneNumberId, enabled: true, metadata: null },
        };
      },
    },
    worker: {
      async findMany(args) {
        calls.push(['worker', args]);
        return [];
      },
    },
    conversation: {
      async upsert(args) {
        calls.push(['conversation-upsert', args]);
        storedConversation = {
          id: 'conversation-quarantine-a',
          ...args.create,
        };
        return storedConversation;
      },
      async update(args) {
        calls.push(['conversation-update', args]);
        Object.assign(storedConversation, args.data);
        return storedConversation;
      },
    },
    message: {
      async findUnique(args) {
        calls.push(['message-read', args]);
        return null;
      },
      async create(args) {
        calls.push(['message-create', args]);
        storedMessage = { id: 'message-quarantine-a', ...args.data };
        return storedMessage;
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };
  let engineCalls = 0;

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-quarantine-a',
    leaseToken: 'lease-quarantine-a',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.quarantine-a',
      phoneNumberId: scope.phoneNumberId,
      from: '+54 9 11 5555-1212',
      displayName: 'Nombre provisto por Meta',
      kind: 'text',
      text: 'Hola, necesito informar una novedad.',
      timestamp: new Date('2026-07-17T02:30:00.000Z'),
    },
    scope,
    apply: async () => {
      engineCalls += 1;
      throw new Error('Unknown contacts must never reach the obra engine.');
    },
  });

  assert.equal(result.alreadyApplied, false);
  assert.equal(result.quarantined, true);
  assert.equal(result.outcome.quarantined, true);
  assert.equal(result.outcome.deliverySuppressed, true);
  assert.equal(result.outcome.workerResolution, 'UNKNOWN');
  assert.equal(storedOutcome.quarantined, true);
  assert.equal(engineCalls, 0);
  assert.equal(storedConversation.projectId, scope.projectId);
  assert.equal(storedConversation.channel, 'whatsapp');
  assert.equal(storedConversation.externalId, 'meta:5491155551212');
  assert.equal(storedConversation.displayName, 'Contacto sin asignar');
  assert.equal(storedMessage.conversationId, storedConversation.id);
  assert.equal(storedMessage.externalId, 'wamid.quarantine-a');
  assert.equal(storedMessage.direction, 'INBOUND');
  assert.equal(storedMessage.body, 'Hola, necesito informar una novedad.');
  assert.equal(storedMessage.metadata.quarantined, true);
  assert.equal(storedMessage.metadata.contactStatus, 'UNASSIGNED');
  assert.equal(storedMessage.metadata.automationSuppressed, true);
  assert.equal(calls.some(([name]) => name === 'snapshot'), false);
  assert.equal(calls.some(([name]) => name.startsWith('task-')), false);
  assert.equal(calls.some(([name]) => name.startsWith('flow-')), false);
  assert.ok(
    calls.findIndex(([name]) => name === 'message-create')
      < calls.findIndex(([name]) => name === 'event-apply'),
  );
});

test('a pre-worker receipt consumes only its sender-bound session and remains quarantined on mismatch or replay', async () => {
  const scope = {
    projectId: 'project-onboarding-receipt',
    organizationId: 'organization-onboarding-receipt',
    phoneNumberId: '123456789012345',
  };
  const connectionId = 'connection-onboarding-receipt';
  const senderAddress = '+5491155551212';
  const fingerprintRegistry = readWorkerFinancialFingerprintKeyRegistry();
  const senderFingerprint = workerFinancialFingerprint(senderAddress, {
    organizationId: scope.organizationId,
    valueType: 'WHATSAPP_E164',
  }, { registry: fingerprintRegistry });
  const calls = [];
  const claim = {
    id: 'claim-onboarding-receipt',
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    connectionId,
    senderFingerprint: senderFingerprint.fingerprint,
    senderFingerprintKeyId: senderFingerprint.fingerprintKeyId,
    senderRecordVersion: 1,
    claimTokenHash: 'd'.repeat(64),
    status: 'PENDING',
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  };
  const onboardingStore = inMemoryWorkerOnboardingFlowSessions(claim, calls);
  const issuedAt = new Date();
  const privacyNotice = getCurrentWorkerOnboardingPrivacyNotice();
  const issued = await issueWorkerOnboardingFlowSession({
    workerOnboardingFlowSession: onboardingStore.sessionDelegate,
    workerOnboardingClaim: onboardingStore.claimDelegate,
  }, {
    claimId: claim.id,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    connectionId,
    phoneNumberId: scope.phoneNumberId,
    blueprintKey: 'worker-onboarding',
    flowId: '987654321012345',
    screenId: 'WORKER_ONBOARDING',
    flowType: 'worker_onboarding',
    sourceExternalId: 'obrasaas-worker-onboarding:receipt-test',
    noticeVersion: privacyNotice.version,
    noticeContentSha256: privacyNotice.contentSha256,
  }, { now: issuedAt });
  await markWorkerOnboardingFlowSessionDeliveryAttempted({
    workerOnboardingFlowSession: onboardingStore.sessionDelegate,
    workerOnboardingClaim: onboardingStore.claimDelegate,
  }, { sessionId: issued.session.id }, { now: issuedAt });
  await markWorkerOnboardingFlowPrivacyPresented({
    workerOnboardingFlowSession: onboardingStore.sessionDelegate,
    workerOnboardingClaim: onboardingStore.claimDelegate,
  }, {
    token: issued.token,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    connectionId,
    phoneNumberId: scope.phoneNumberId,
  }, { now: issuedAt });
  claim.status = 'SUBMITTED';
  await markWorkerOnboardingFlowSessionSubmitted({
    workerOnboardingFlowSession: onboardingStore.sessionDelegate,
    workerOnboardingClaim: onboardingStore.claimDelegate,
  }, {
    sessionId: issued.session.id,
    claimId: claim.id,
  }, { now: issuedAt });

  const messages = [];
  const conversations = new Map();
  const outcomes = [];
  const transaction = {
    async $executeRawUnsafe() {
      calls.push(['lock']);
    },
    webhookEvent: {
      async findFirst({ where }) {
        calls.push(['event-read', where.id]);
        return { id: where.id, appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args.where.id]);
        outcomes.push(structuredClone(args.data.outcome));
        return { count: 1 };
      },
    },
    project: {
      async findFirst() {
        return {
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
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} }, version: 1 },
          whatsapp: {
            id: connectionId,
            phoneNumberId: scope.phoneNumberId,
            enabled: true,
            metadata: null,
          },
        };
      },
    },
    worker: {
      async findMany() {
        return [];
      },
    },
    conversation: {
      async upsert({ where, create, update }) {
        const key = JSON.stringify(where.projectId_channel_externalId);
        const current = conversations.get(key);
        if (current) {
          Object.assign(current, update);
          return current;
        }
        const created = { id: `conversation-${conversations.size + 1}`, ...create };
        conversations.set(key, created);
        return created;
      },
      async update({ where, data }) {
        const conversation = [...conversations.values()].find((item) => item.id === where.id);
        Object.assign(conversation, data);
        return conversation;
      },
    },
    message: {
      async findUnique({ where }) {
        return messages.find((message) => message.externalId === where.externalId) || null;
      },
      async create({ data }) {
        const message = { id: `message-${messages.length + 1}`, ...data };
        messages.push(message);
        return message;
      },
      async update({ where, data }) {
        const message = messages.find((item) => item.id === where.id);
        Object.assign(message, data);
        return message;
      },
    },
    workerOnboardingFlowSession: onboardingStore.sessionDelegate,
    workerOnboardingClaim: onboardingStore.claimDelegate,
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback) {
      return callback(transaction);
    },
  };
  const validEvidence = workerOnboardingFlowTokenEvidence(issued.token);
  const receiptResponse = {
    flow_type: 'worker_onboarding',
    claim_ref: claim.id,
    submission_status: 'submitted',
  };
  let engineCalls = 0;
  const processReceipt = (suffix, { from = senderAddress, flowToken = validEvidence } = {}) => (
    applyWebhookMessageAtomically({
      eventId: `event-${suffix}`,
      leaseToken: `lease-${suffix}`,
      event: {
        provider: 'meta',
        eventType: 'message',
        externalId: `wamid.${suffix}`,
        phoneNumberId: scope.phoneNumberId,
        from,
        displayName: 'Nombre de Meta que no debe duplicarse',
        kind: 'interactive',
        text: 'Alta enviada',
        interactive: {
          type: 'flow',
          flowToken,
          response: receiptResponse,
        },
      },
      scope,
      apply: async () => {
        engineCalls += 1;
        throw new Error('A pre-worker receipt must never reach the obra engine.');
      },
    })
  );

  const finalTokenCharacter = issued.token.slice(-1);
  const tamperedToken = `${issued.token.slice(0, -1)}${finalTokenCharacter === 'A' ? 'B' : 'A'}`;
  const missing = await processReceipt('onboarding-token-missing', { flowToken: null });
  assert.equal(missing.quarantined, true);
  assert.equal(onboardingStore.records[0].consumedAt, null);
  assert.equal(messages.at(-1).metadata.workerOnboardingReceipt, 'UNVERIFIED');

  const tampered = await processReceipt('onboarding-token-tampered', {
    flowToken: workerOnboardingFlowTokenEvidence(tamperedToken),
  });
  assert.equal(tampered.quarantined, true);
  assert.equal(onboardingStore.records[0].consumedAt, null);
  assert.equal(messages.at(-1).metadata.workerOnboardingReceipt, 'UNVERIFIED');

  const mismatch = await processReceipt('onboarding-sender-mismatch', {
    from: '+5491155559999',
  });
  assert.equal(mismatch.quarantined, true);
  assert.equal(onboardingStore.records[0].consumedAt, null);
  assert.equal(messages.at(-1).metadata.workerOnboardingReceipt, 'UNVERIFIED');

  const valid = await processReceipt('onboarding-valid');
  assert.equal(valid.quarantined, true);
  assert.equal(onboardingStore.records[0].consumedExternalId, 'wamid.onboarding-valid');
  assert.ok(onboardingStore.records[0].consumedAt instanceof Date);
  assert.equal(messages.at(-1).metadata.workerOnboardingReceipt, 'VERIFIED');
  assert.equal(Object.hasOwn(messages.at(-1).metadata, 'from'), false);
  assert.equal(Object.hasOwn(messages.at(-1).metadata, 'providerDisplayName'), false);

  claim.status = 'APPROVED';
  claim.sensitiveDataPurgedAt = new Date();
  claim.senderFingerprint = null;
  claim.senderFingerprintKeyId = null;
  claim.senderRecordVersion = null;
  const retired = await processReceipt('onboarding-retired');
  assert.equal(retired.quarantined, true);
  assert.equal(messages.at(-1).metadata.workerOnboardingReceipt, 'UNVERIFIED');
  assert.equal(
    onboardingStore.records[0].consumedExternalId,
    'wamid.onboarding-valid',
  );
  assert.equal(JSON.stringify(messages.at(-1).metadata).includes(senderAddress), false);

  const replay = await processReceipt('onboarding-replay');
  assert.equal(replay.quarantined, true);
  assert.equal(onboardingStore.records[0].consumedExternalId, 'wamid.onboarding-valid');
  assert.equal(messages.at(-1).metadata.workerOnboardingReceipt, 'UNVERIFIED');
  assert.equal(engineCalls, 0);
  assert.equal(outcomes.every((outcome) => outcome.deliverySuppressed === true), true);
});

test('a quarantined Meta contact remains quarantined when its applied outcome is retried', async () => {
  const scope = {
    projectId: 'project-quarantine-retry',
    organizationId: 'organization-quarantine-retry',
    phoneNumberId: 'phone-quarantine-retry',
  };
  const storedOutcome = {
    version: 1,
    type: 'message',
    reply: 'Mensaje conservado para revisión sin automatización.',
    flowPrompt: null,
    quarantined: true,
    contactStatus: 'UNASSIGNED',
    workerResolution: 'UNKNOWN',
    deliverySuppressed: true,
  };
  const transaction = {
    $executeRawUnsafe: async () => undefined,
    webhookEvent: {
      findFirst: async () => ({
        id: 'event-quarantine-retry',
        appliedAt: new Date('2026-07-17T02:30:00.000Z'),
        outcome: storedOutcome,
      }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  globalThis.__obraSaasPrisma = {
    $transaction: async (callback) => callback(transaction),
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-quarantine-retry',
    leaseToken: 'lease-quarantine-retry',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.quarantine-retry',
      phoneNumberId: scope.phoneNumberId,
      from: '+5491155551313',
    },
    scope,
    apply: async () => assert.fail('an applied quarantine must not run the engine'),
  });

  assert.equal(result.alreadyApplied, true);
  assert.equal(result.quarantined, true);
  assert.equal(result.outcome.quarantined, true);
  assert.equal(result.outcome.deliverySuppressed, true);
});

test('a published Flow session is issued in the same transaction and only its UUID enters the outcome', async () => {
  const scope = {
    projectId: 'project-flow-outbound',
    organizationId: 'organization-flow-outbound',
    phoneNumberId: '123456789012345',
  };
  const worker = {
    id: 'worker-flow-outbound',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Capataz Flow',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { organizationId: scope.organizationId },
  };
  const calls = [];
  const flowStore = inMemoryFlowSessions(calls);
  const transaction = {
    async $executeRawUnsafe() {
      calls.push(['lock']);
    },
    webhookEvent: {
      async findFirst() {
        calls.push(['event-read']);
        return { id: 'event-flow-outbound', appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        return { count: 1 };
      },
    },
    project: {
      async findFirst() {
        calls.push(['project']);
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'ACTIVE',
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} } },
          whatsapp: {
            phoneNumberId: scope.phoneNumberId,
            enabled: true,
            metadata: {
              whatsappFlows: {
                'incident-report': {
                  id: '987654321012345',
                  name: 'ObraSaaS | Incidencia de obra',
                  status: 'PUBLISHED',
                },
              },
            },
          },
        };
      },
    },
    worker: {
      async findMany() {
        calls.push(['worker']);
        return [worker];
      },
    },
    conversation: {
      async upsert() {
        calls.push(['conversation']);
        return { id: 'conversation-flow-outbound' };
      },
    },
    whatsAppFlowSession: flowStore.delegate,
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback) {
      return callback(transaction);
    },
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-flow-outbound',
    leaseToken: 'lease-flow-outbound',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.flow-outbound',
      phoneNumberId: scope.phoneNumberId,
      from: worker.phone,
      kind: 'text',
      text: 'incidencia',
    },
    scope,
    apply: async ({ flowSession }) => {
      calls.push(['engine']);
      assert.equal(flowSession, null);
      return {
        reply: 'Abrí el formulario seguro.',
        flowPrompt: 'incident-report',
        stateChanged: false,
        newMessages: [],
      };
    },
  });

  assert.match(
    result.outcome.flowSessionId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(result.outcome.flowSessionId, flowStore.record.id);
  assert.equal(flowStore.record.recipientPhone, '5491112345678');
  assert.equal(flowStore.record.sourceExternalId, 'wamid.flow-outbound');
  assert.match(flowStore.record.tokenSha256, /^[0-9a-f]{64}$/);
  const incidentLifetimeMs = (
    flowStore.record.expiresAt.getTime()
    - flowStore.record.createdAt.getTime()
  );
  assert.ok(incidentLifetimeMs <= 4 * 60 * 60 * 1_000);
  assert.ok(incidentLifetimeMs > (4 * 60 * 60 * 1_000) - 1_000);
  assert.equal('token' in flowStore.record, false);
  assert.equal(JSON.stringify(result.outcome).includes('ofs1.'), false);
  assert.ok(
    calls.findIndex(([name]) => name === 'flow-create')
      < calls.findIndex(([name]) => name === 'event-apply'),
  );
});

test('a Meta Flow reply is consumed before engine effects and reaches the engine as trusted state', async () => {
  const scope = {
    projectId: 'project-flow-inbound',
    organizationId: 'organization-flow-inbound',
    phoneNumberId: '123456789012345',
  };
  const worker = {
    id: 'worker-flow-inbound',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Jefe Flow',
    role: 'Jefe de obra',
    active: true,
    metadata: { whatsappRole: 'SITE_MANAGER' },
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { organizationId: scope.organizationId },
  };
  const calls = [];
  const flowStore = inMemoryFlowSessions(calls);
  const issued = await issueWhatsAppFlowSession({
    whatsAppFlowSession: flowStore.delegate,
  }, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    workerId: worker.id,
    phoneNumberId: scope.phoneNumberId,
    recipientPhone: worker.phone,
    blueprintKey: 'incident-report',
    flowId: '987654321012345',
    screenId: 'INCIDENT_REPORT',
    flowType: 'incident',
    sourceExternalId: 'wamid.flow-prompt',
  });
  await markWhatsAppFlowSessionDeliveryAttempted(
    { whatsAppFlowSession: flowStore.delegate },
    { sessionId: issued.session.id },
    { now: new Date('2026-07-16T12:00:00.000Z') },
  );
  calls.length = 0;

  const transaction = {
    async $executeRawUnsafe() {
      calls.push(['lock']);
    },
    webhookEvent: {
      async findFirst() {
        calls.push(['event-read']);
        return { id: 'event-flow-inbound', appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        return { count: 1 };
      },
    },
    project: {
      async findFirst() {
        calls.push(['project']);
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'ACTIVE',
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} } },
          whatsapp: {
            phoneNumberId: scope.phoneNumberId,
            enabled: true,
            metadata: {},
          },
        };
      },
    },
    worker: {
      async findMany() {
        calls.push(['worker']);
        return [worker];
      },
    },
    conversation: {
      async upsert() {
        calls.push(['conversation']);
        return { id: 'conversation-flow-inbound' };
      },
    },
    whatsAppFlowSession: flowStore.delegate,
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback) {
      return callback(transaction);
    },
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-flow-inbound',
    leaseToken: 'lease-flow-inbound',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.flow-reply',
      phoneNumberId: scope.phoneNumberId,
      from: worker.phone,
      kind: 'interactive',
      interactive: {
        type: 'flow',
        flowToken: whatsAppFlowTokenEvidence(issued.token),
        response: {
          flow_type: 'incident',
          severity: 'high',
          area: 'PB',
          description: 'Pérdida de agua',
        },
      },
    },
    scope,
    apply: async ({ flowSession }) => {
      calls.push(['engine']);
      assert.equal(flowSession.id, issued.session.id);
      assert.equal(flowSession.blueprintKey, 'incident-report');
      assert.equal(flowSession.flowType, 'incident');
      return {
        reply: 'Incidencia registrada.',
        flowPrompt: null,
        stateChanged: false,
        newMessages: [],
      };
    },
  });

  assert.equal(result.outcome.flowSessionId, undefined);
  assert.equal(flowStore.record.consumedExternalId, 'wamid.flow-reply');
  assert.ok(flowStore.record.consumedAt instanceof Date);
  assert.ok(
    calls.findIndex(([name]) => name === 'flow-consume')
      < calls.findIndex(([name]) => name === 'engine'),
  );
  assert.ok(
    calls.findIndex(([name]) => name === 'engine')
      < calls.findIndex(([name]) => name === 'event-apply'),
  );
});

test('an expired payment nfm_reply consumes only the exact SUCCEEDED companion receipt', async () => {
  const scope = {
    projectId: 'project-payment-flow-inbound',
    organizationId: 'organization-payment-flow-inbound',
    phoneNumberId: '123456789012345',
  };
  const worker = {
    id: 'worker-payment-flow-inbound',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Operario Cobro',
    role: 'Albañil',
    active: true,
    metadata: { whatsappRole: 'WORKER' },
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { organizationId: scope.organizationId },
  };
  const calls = [];
  const flowStore = inMemoryFlowSessions(calls);
  const historicalNow = new Date('2026-01-01T00:00:00.000Z');
  const issued = await issueWhatsAppFlowSession({
    whatsAppFlowSession: flowStore.delegate,
  }, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    workerId: worker.id,
    phoneNumberId: scope.phoneNumberId,
    recipientPhone: worker.phone,
    blueprintKey: 'worker-payment-destination',
    flowId: '987654321012399',
    screenId: 'WORKER_PAYMENT_DESTINATION',
    flowType: 'worker_payment_destination',
    sourceExternalId: 'wamid.payment-flow-prompt',
  }, {
    now: historicalNow,
    ttlMs: 60_000,
  });
  await markWhatsAppFlowSessionDeliveryAttempted(
    { whatsAppFlowSession: flowStore.delegate },
    { sessionId: issued.session.id },
    { now: new Date(historicalNow.getTime() + 1_000) },
  );
  assert.ok(issued.session.expiresAt.getTime() < Date.now());
  const companion = {
    flowSessionId: issued.session.id,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    connectionId: 'connection-payment-a',
    workerId: worker.id,
    personId: 'person-payment-a',
    channelIdentityId: 'channel-payment-a',
    noticeVersion: 'worker-payment-capture-v1',
    noticeContentSha256: 'a'.repeat(64),
    expiresAt: issued.session.expiresAt,
    privacyPresentedAt: new Date(),
    submissionStatus: 'SUCCEEDED',
    submissionFingerprintHmac: 'b'.repeat(64),
    submissionReservationId: '11111111-1111-4111-8111-111111111111',
    submissionReservedAt: new Date(),
    paymentPurpose: 'SALARY',
    privacyChoiceEventId: 'privacy-payment-a',
    destinationId: 'destination-payment-a',
    submittedAt: new Date(),
    submissionUncertainAt: null,
    revision: 3,
  };
  let engineCalls = 0;
  const transaction = {
    async $executeRawUnsafe() {},
    webhookEvent: {
      async findFirst() {
        return { id: 'event-payment-flow', appliedAt: null, outcome: null };
      },
      async updateMany() { return { count: 1 }; },
    },
    project: {
      async findFirst() {
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'ACTIVE',
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} } },
          whatsapp: {
            id: companion.connectionId,
            phoneNumberId: scope.phoneNumberId,
            enabled: true,
            metadata: {},
          },
        };
      },
    },
    worker: { async findMany() { return [worker]; } },
    conversation: { async upsert() { return { id: 'conversation-payment-flow' }; } },
    whatsAppFlowSession: flowStore.delegate,
    workerPaymentFlowSession: {
      async findUnique() { return structuredClone(companion); },
      async create() { throw new Error('not used'); },
      async updateMany() { throw new Error('not used'); },
    },
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback) { return callback(transaction); },
  };
  const event = (destinationRef, externalId) => ({
    provider: 'meta',
    eventType: 'message',
    externalId,
    phoneNumberId: scope.phoneNumberId,
    from: worker.phone,
    kind: 'interactive',
    interactive: {
      type: 'flow',
      flowToken: whatsAppFlowTokenEvidence(issued.token),
      response: {
        flow_type: 'worker_payment_destination',
        destination_ref: destinationRef,
        submission_status: 'received',
      },
    },
  });
  const apply = async ({ flowSession }) => {
    engineCalls += 1;
    assert.equal(flowSession.id, issued.session.id);
    return {
      reply: 'Destino recibido.',
      flowPrompt: null,
      stateChanged: false,
      newMessages: [],
    };
  };

  await assert.rejects(
    applyWebhookMessageAtomically({
      eventId: 'event-payment-flow-mismatch',
      leaseToken: 'lease-payment-flow-mismatch',
      event: event('destination-payment-forged', 'wamid.payment-flow-mismatch'),
      scope,
      apply,
    }),
    (error) => error.code === 'WHATSAPP_FLOW_SESSION_INVALID',
  );
  assert.equal(flowStore.record.consumedAt, null);
  assert.equal(engineCalls, 0);

  await applyWebhookMessageAtomically({
    eventId: 'event-payment-flow-exact',
    leaseToken: 'lease-payment-flow-exact',
    event: event(companion.destinationId, 'wamid.payment-flow-exact'),
    scope,
    apply,
  });
  assert.equal(flowStore.record.consumedExternalId, 'wamid.payment-flow-exact');
  assert.equal(engineCalls, 1);
});

test('an expired authenticated Flow reply is atomically consumed and replaced without applying its payload', async () => {
  const scope = {
    projectId: 'project-flow-expired',
    organizationId: 'organization-flow-expired',
    phoneNumberId: '123456789012345',
  };
  const worker = {
    id: 'worker-flow-expired',
    projectId: scope.projectId,
    phone: '+5491112345678',
    name: 'Capataz Flow vencido',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { organizationId: scope.organizationId },
  };
  const calls = [];
  const flowStore = inMemoryFlowSessions(calls);
  const issued = await issueWhatsAppFlowSession({
    whatsAppFlowSession: flowStore.delegate,
  }, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    workerId: worker.id,
    phoneNumberId: scope.phoneNumberId,
    recipientPhone: worker.phone,
    blueprintKey: 'incident-report',
    flowId: '987654321012345',
    screenId: 'INCIDENT_REPORT',
    flowType: 'incident',
    sourceExternalId: 'wamid.flow-expired-prompt',
  }, {
    now: new Date('2000-01-01T00:00:00.000Z'),
    ttlMs: 60_000,
  });
  await markWhatsAppFlowSessionDeliveryAttempted(
    { whatsAppFlowSession: flowStore.delegate },
    { sessionId: issued.session.id },
    { now: new Date('2000-01-01T00:00:01.000Z') },
  );
  calls.length = 0;

  const transaction = {
    async $executeRawUnsafe() {
      calls.push(['lock']);
    },
    webhookEvent: {
      async findFirst() {
        calls.push(['event-read']);
        return { id: 'event-flow-expired', appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        return { count: 1 };
      },
    },
    project: {
      async findFirst() {
        calls.push(['project']);
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          status: 'ACTIVE',
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} } },
          whatsapp: {
            phoneNumberId: scope.phoneNumberId,
            enabled: true,
            metadata: {
              whatsappFlows: {
                'incident-report': {
                  id: '987654321012345',
                  name: 'ObraSaaS | Incidencia de obra',
                  status: 'PUBLISHED',
                },
              },
            },
          },
        };
      },
    },
    worker: {
      async findMany() {
        calls.push(['worker']);
        return [worker];
      },
    },
    conversation: {
      async upsert() {
        calls.push(['conversation']);
        return { id: 'conversation-flow-expired' };
      },
    },
    whatsAppFlowSession: flowStore.delegate,
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback) {
      return callback(transaction);
    },
  };

  const result = await applyWebhookMessageAtomically({
    eventId: 'event-flow-expired',
    leaseToken: 'lease-flow-expired',
    event: {
      provider: 'meta',
      eventType: 'message',
      externalId: 'wamid.flow-expired-reply',
      phoneNumberId: scope.phoneNumberId,
      from: worker.phone,
      kind: 'interactive',
      interactive: {
        type: 'flow',
        flowToken: whatsAppFlowTokenEvidence(issued.token),
        response: {
          flow_type: 'incident',
          severity: 'critical',
          area: 'No aplicar',
          description: 'El payload expirado no debe generar efectos.',
        },
      },
    },
    scope,
    apply: async ({
      flowSession,
      expiredFlowSession,
      expiredFlowCanReissue,
    }) => {
      calls.push(['engine']);
      assert.equal(flowSession, null);
      assert.equal(expiredFlowSession.id, issued.session.id);
      assert.equal(expiredFlowCanReissue, true);
      return {
        reply: 'El formulario venció. Te preparo uno nuevo.',
        flowPrompt: 'incident-report',
        stateChanged: false,
        newMessages: [],
      };
    },
  });

  assert.equal(flowStore.records.length, 2);
  const [expired, replacement] = flowStore.records;
  assert.equal(expired.consumedExternalId, 'wamid.flow-expired-reply');
  assert.ok(expired.consumedAt instanceof Date);
  assert.notEqual(replacement.id, expired.id);
  assert.equal(replacement.sourceExternalId, 'wamid.flow-expired-reply');
  assert.equal(result.outcome.flowSessionId, replacement.id);
  assert.ok(
    calls.findIndex(([name]) => name === 'flow-consume')
      < calls.findIndex(([name]) => name === 'engine'),
  );
  assert.ok(
    calls.findIndex(([name]) => name === 'engine')
      < calls.findLastIndex(([name]) => name === 'flow-create'),
  );
});

test('a subscription blocked after ingress fails terminally before engine effects', async () => {
  const scope = {
    projectId: 'project-subscription-blocked',
    organizationId: 'organization-subscription-blocked',
    phoneNumberId: 'phone-subscription-blocked',
  };
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['event-read', args]);
        return { id: 'event-subscription-blocked', appliedAt: null, outcome: null };
      },
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return {
          id: scope.projectId,
          organizationId: scope.organizationId,
          latitude: -34.6037,
          longitude: -58.3816,
          geofenceMeters: 100,
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'CANCELED',
            trialEndsAt: null,
          },
          snapshot: { state: { incidents: [], attendance: {}, tasks: {} } },
          whatsapp: { phoneNumberId: scope.phoneNumberId, enabled: true },
        };
      },
    },
    worker: {
      async findMany() {
        assert.fail('blocked subscriptions must fail before resolving a worker');
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };
  let applied = false;

  await assert.rejects(
    applyWebhookMessageAtomically({
      eventId: 'event-subscription-blocked',
      leaseToken: 'lease-subscription-blocked',
      event: {
        provider: 'meta',
        eventType: 'message',
        externalId: 'wamid.subscription-blocked',
        phoneNumberId: scope.phoneNumberId,
        from: '+5491112345678',
      },
      scope,
      apply: async () => {
        applied = true;
        return null;
      },
    }),
    (error) => error.code === 'WEBHOOK_SUBSCRIPTION_BLOCKED',
  );

  assert.equal(applied, false);
  assert.deepEqual(
    calls.map(([name]) => name),
    ['transaction', 'lock', 'event-read', 'project'],
  );
});

for (const terminalStatus of ['COMPLETED', 'ARCHIVED']) {
  test(`an accepted message cannot mutate a project after it becomes ${terminalStatus.toLowerCase()}`, async () => {
    const scope = {
      projectId: `project-${terminalStatus.toLowerCase()}`,
      organizationId: 'organization-a',
      phoneNumberId: 'phone-a',
    };
    const calls = [];
    const transaction = {
      async $executeRawUnsafe(query, projectId) {
        calls.push(['lock', query, projectId]);
      },
      webhookEvent: {
        async findFirst(args) {
          calls.push(['event-read', args]);
          return { id: 'event-terminal', appliedAt: null, outcome: null };
        },
      },
      project: {
        async findFirst(args) {
          calls.push(['project', args]);
          return args.where.status.in.includes(terminalStatus)
            ? {
                id: scope.projectId,
                organizationId: scope.organizationId,
                status: terminalStatus,
              }
            : null;
        },
      },
    };
    globalThis.__obraSaasPrisma = {
      async $transaction(callback) {
        return callback(transaction);
      },
    };

    await assert.rejects(
      applyWebhookMessageAtomically({
        eventId: 'event-terminal',
        leaseToken: 'lease-terminal',
        event: {
          provider: 'meta',
          eventType: 'message',
          externalId: `wamid.${terminalStatus.toLowerCase()}`,
          phoneNumberId: scope.phoneNumberId,
          from: '+5491112345678',
        },
        scope,
        apply: async () => {
          throw new Error('The engine must not run for a terminal project.');
        },
      }),
      (error) => error.code === 'WEBHOOK_MESSAGE_SCOPE_MISMATCH',
    );

    const projectQuery = calls.find(([name]) => name === 'project')[1];
    assert.deepEqual(projectQuery.where.status, { in: ['ACTIVE', 'PAUSED'] });
    assert.equal(calls.some(([name]) => name === 'event-apply'), false);
  });
}
