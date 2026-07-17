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
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';
process.env.WHATSAPP_FLOW_TOKEN_SECRET = 'unit-test-whatsapp-flow-session-secret';

const {
  applyWebhookMessageAtomically,
  assertExpiredWhatsAppFlowRecoveryResult,
} = await import('../src/lib/db.js');
const {
  issueWhatsAppFlowSession,
  markWhatsAppFlowSessionDeliveryAttempted,
  whatsAppFlowTokenEvidence,
} = await import('../src/lib/whatsapp/flow-sessions.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalFlowTokenSecret === undefined) delete process.env.WHATSAPP_FLOW_TOKEN_SECRET;
  else process.env.WHATSAPP_FLOW_TOKEN_SECRET = originalFlowTokenSecret;
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
