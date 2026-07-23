import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-nextjs-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    return nextLoad(url, context);
  },
});

const [
  {
    getProactiveWhatsAppFlowCatalog,
    sendProactiveWhatsAppFlowTemplate,
  },
  { buildOwnedWhatsAppFlowTemplate },
  { createWhatsAppProactiveFlowHandlers },
] = await Promise.all([
  import('../src/lib/whatsapp/proactive-flows.js'),
  import('../src/lib/whatsapp/templates.js'),
  import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js'),
]);

const NOW = new Date('2026-07-23T12:00:00.000Z');
const FLOW_SECRET = 'whatsapp-flow-test-secret-with-at-least-32-bytes';
const CONFIGURED_META_ENV = Object.freeze({
  NEXT_PUBLIC_META_APP_ID: 'app-a',
  META_APP_SECRET: 'secret-a',
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: 'config-a',
  META_VERIFY_TOKEN: 'verify-a',
  WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'encryption-a',
});

function access(overrides = {}) {
  return {
    databaseUserId: 'actor-a',
    isSuperadmin: false,
    orgId: 'org-a',
    tenantRole: 'ADMIN',
    subscription: { canRead: true, canWrite: true },
    organization: { id: 'organization-a', name: 'Constructora A' },
    project: { id: 'project-a', organizationId: 'organization-a', name: 'Obra A' },
    ...overrides,
  };
}

function matchesWhere(record, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    const actual = record[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, 'not')) return actual !== expected.not;
      if (Object.hasOwn(expected, 'gt')) {
        return new Date(actual).getTime() > new Date(expected.gt).getTime();
      }
      if (Object.hasOwn(expected, 'lte')) {
        return new Date(actual).getTime() <= new Date(expected.lte).getTime();
      }
      if (Object.hasOwn(expected, 'in')) return expected.in.includes(actual);
    }
    return actual === expected;
  });
}

function flowSessionDelegate(records) {
  function find(where) {
    if (where.id) return records.find((record) => record.id === where.id) || null;
    const composite = where.projectId_sourceExternalId_blueprintKey;
    return composite
      ? records.find((record) => (
          record.projectId === composite.projectId
          && record.sourceExternalId === composite.sourceExternalId
          && record.blueprintKey === composite.blueprintKey
        )) || null
      : null;
  }
  return {
    async findUnique({ where }) {
      const record = find(where);
      return record ? { ...record } : null;
    },
    async create({ data }) {
      const duplicate = find({
        projectId_sourceExternalId_blueprintKey: {
          projectId: data.projectId,
          sourceExternalId: data.sourceExternalId,
          blueprintKey: data.blueprintKey,
        },
      });
      if (duplicate) throw Object.assign(new Error('unique'), { code: 'P2002' });
      const record = {
        ...data,
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        providerMessageId: null,
        consumedAt: null,
        consumedExternalId: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      records.push(record);
      return { ...record };
    },
    async updateMany({ where, data }) {
      const matching = records.filter((record) => matchesWhere(record, where));
      for (const record of matching) Object.assign(record, data, { updatedAt: NOW });
      return { count: matching.length };
    },
  };
}

function createDatabase({
  inbound = true,
  worker = true,
  templateStatus = 'APPROVED',
  inboundAt = new Date('2026-07-22T18:00:00.000Z'),
} = {}) {
  const calls = [];
  const messages = [];
  const sessions = [];
  const audits = [];
  const project = {
    id: 'project-a',
    organizationId: 'organization-a',
    name: 'Obra A',
    status: 'ACTIVE',
    organization: {
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    },
  };
  const conversation = {
    id: 'conversation-a',
    projectId: 'project-a',
    externalId: 'meta:5491111111111',
    displayName: 'Ana',
    updatedAt: inboundAt,
  };
  const connection = {
    id: 'connection-a',
    projectId: 'project-a',
    phoneNumberId: '123456789012345',
    whatsappBusinessId: '987654321098765',
    enabled: true,
    connectionStatus: 'CONNECTED',
    encryptedAccessToken: 'encrypted-token-value',
    lastError: null,
    metadata: {
      channelHealth: {
        tokenStatus: 'VALID',
        scopes: [
          'whatsapp_business_management',
          'whatsapp_business_messaging',
        ],
        phoneStatus: 'REGISTERED',
        subscriptionStatus: 'SUBSCRIBED',
        qualityStatus: 'HEALTHY',
        providerStatus: 'HEALTHY',
      },
      whatsappFlows: {
        'incident-report': {
          id: '111111111111111',
          name: 'ObraSaaS | Incidencia de obra',
          status: 'PUBLISHED',
          dataExchange: false,
        },
      },
    },
  };
  const definition = buildOwnedWhatsAppFlowTemplate({
    connection,
    blueprintKey: 'incident-report',
  });
  const template = {
    id: 'template-local-a',
    connectionId: connection.id,
    whatsappBusinessId: connection.whatsappBusinessId,
    blueprintKey: definition.blueprintKey,
    providerTemplateId: '222222222222222',
    name: definition.name,
    language: definition.language,
    category: definition.category,
    status: templateStatus,
    contentSha256: definition.contentSha256,
    flowId: definition.flowId,
    screenId: definition.screenId,
    bodyText: definition.bodyText,
    buttonText: definition.buttonText,
    rejectionReason: null,
    submittedAt: NOW,
    lastSyncedAt: NOW,
    statusChangedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const workerRow = {
    id: 'worker-a',
    projectId: 'project-a',
    phone: '+5491111111111',
    name: 'Ana Rojas',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: NOW,
    updatedAt: NOW,
    project: { organizationId: 'organization-a' },
  };
  const inboundMessage = inbound
    ? {
        id: 'inbound-a',
        conversationId: conversation.id,
        externalId: 'wamid.inbound-a',
        direction: 'INBOUND',
        sentAt: inboundAt,
        createdAt: inboundAt,
      }
    : null;

  const database = {
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return args.where.id === project.id
          && args.where.organizationId === project.organizationId
          ? { ...project }
          : null;
      },
    },
    conversation: {
      async findFirst(args) {
        calls.push(['conversation', args]);
        return args.where.id === conversation.id
          && args.where.projectId === conversation.projectId
          && args.where.project?.organizationId === project.organizationId
          ? { ...conversation }
          : null;
      },
      async update({ where, data }) {
        assert.equal(where.id, conversation.id);
        Object.assign(conversation, data);
        return { ...conversation };
      },
    },
    whatsAppConnection: {
      async findUnique(args) {
        calls.push(['connection', args]);
        return args.where.projectId === project.id ? structuredClone(connection) : null;
      },
    },
    worker: {
      async findMany(args) {
        calls.push(['workers', args]);
        return worker ? [{ ...workerRow }] : [];
      },
    },
    whatsAppFlowTemplate: {
      async findMany() {
        return [{ ...template }];
      },
      async findFirst({ where }) {
        return matchesWhere(template, where) ? { ...template } : null;
      },
    },
    whatsAppFlowSession: flowSessionDelegate(sessions),
    message: {
      async findFirst(args) {
        calls.push(['message-first', args]);
        return args.where.direction === 'INBOUND' ? inboundMessage : null;
      },
      async findUnique({ where }) {
        if (where.externalId) {
          return messages.find((message) => message.externalId === where.externalId) || null;
        }
        return null;
      },
      async create({ data }) {
        if (messages.some((message) => message.externalId === data.externalId)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const created = {
          id: `outbound-${messages.length + 1}`,
          createdAt: NOW,
          ...data,
        };
        messages.push(created);
        return { ...created };
      },
      async update({ where, data }) {
        const target = messages.find((message) => message.id === where.id);
        assert.ok(target);
        Object.assign(target, data);
        return { ...target };
      },
      async updateMany({ where, data }) {
        const matching = messages.filter((message) => matchesWhere(message, where));
        for (const message of matching) Object.assign(message, data);
        return { count: matching.length };
      },
    },
    auditLog: {
      async count() {
        return 0;
      },
      async create({ data }) {
        audits.push(data);
        return data;
      },
    },
    async $executeRawUnsafe(...args) {
      calls.push(['execute', args]);
      return 1;
    },
    async $queryRawUnsafe(...args) {
      calls.push(['query', args]);
      return [{ id: project.organizationId }];
    },
    async $transaction(callback) {
      return callback(database);
    },
  };
  return {
    prisma: database,
    calls,
    messages,
    sessions,
    audits,
    template,
  };
}

test('catalog only enables the exact approved owned template for a resolved worker', async () => {
  const store = createDatabase();
  const result = await getProactiveWhatsAppFlowCatalog({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  assert.deepEqual(result.capability, { allowed: true, code: 'READY', reason: null });
  assert.equal(result.recipient.name, 'Ana Rojas');
  assert.equal(result.catalog.find((item) => item.key === 'incident-report').canSend, true);
  assert.equal(result.catalog.find((item) => item.key === 'shift-check-in').canSend, false);
});

test('proactive Flow send is durable and an idempotent retry reaches Meta once', async () => {
  const store = createDatabase();
  const providerCalls = [];
  const input = {
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-send-stable-a',
    sendTemplate: async (payload) => {
      providerCalls.push(payload);
      return { messages: [{ id: 'wamid.flow-template-a' }] };
    },
    flowSessionSecret: FLOW_SECRET,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  const first = await sendProactiveWhatsAppFlowTemplate(input);
  const retry = await sendProactiveWhatsAppFlowTemplate(input);

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls[0].templateName, store.template.name);
  assert.equal(store.messages[0].status, 'accepted');
  assert.equal(store.messages[0].providerMessageId, 'wamid.flow-template-a');
  assert.equal(store.sessions[0].deliveryAttemptedAt instanceof Date, true);
  assert.equal(store.sessions[0].sentAt instanceof Date, true);
  assert.deepEqual(
    store.audits.map((entry) => entry.action),
    [
      'whatsapp.inbox.flow_template_send_requested',
      'whatsapp.inbox.flow_template_sent',
    ],
  );
});

test('approved template send works after the free-text 24-hour window closes', async () => {
  const store = createDatabase({
    inboundAt: new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1_000),
  });
  let providerCalls = 0;

  const result = await sendProactiveWhatsAppFlowTemplate({
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-send-window-a',
    sendTemplate: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.flow-window-a' }] };
    },
    flowSessionSecret: FLOW_SECRET,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  assert.equal(result.message.status, 'accepted');
  assert.equal(providerCalls, 1);
});

test('cold outreach and unapproved templates fail closed before provider delivery', async () => {
  for (const store of [
    createDatabase({ inbound: false }),
    createDatabase({ templateStatus: 'PENDING' }),
  ]) {
    let providerCalls = 0;
    await assert.rejects(
      sendProactiveWhatsAppFlowTemplate({
        prisma: store.prisma,
        access: access(),
        conversationId: 'conversation-a',
        blueprintKey: 'incident-report',
        idempotencyKey: `flow-send-blocked-${store.template.status}`,
        sendTemplate: async () => {
          providerCalls += 1;
          return { messages: [{ id: 'must-not-exist' }] };
        },
        flowSessionSecret: FLOW_SECRET,
        clock: () => NOW,
        env: CONFIGURED_META_ENV,
      }),
      (error) => [
        'WHATSAPP_PRIOR_INBOUND_REQUIRED',
        'WHATSAPP_FLOW_TEMPLATE_NOT_APPROVED',
      ].includes(error?.code),
    );
    assert.equal(providerCalls, 0);
    assert.equal(store.messages.length, 0);
  }
});

test('ambiguous provider failure becomes unknown and is never auto-retried', async () => {
  const store = createDatabase();
  let providerCalls = 0;
  const input = {
    prisma: store.prisma,
    access: access(),
    conversationId: 'conversation-a',
    blueprintKey: 'incident-report',
    idempotencyKey: 'flow-send-ambiguous-a',
    sendTemplate: async () => {
      providerCalls += 1;
      throw Object.assign(new Error('timeout'), {
        code: 'META_FLOW_TEMPLATE_DELIVERY_RETRYABLE',
      });
    },
    flowSessionSecret: FLOW_SECRET,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  await assert.rejects(
    sendProactiveWhatsAppFlowTemplate(input),
    (error) => error?.code === 'WHATSAPP_FLOW_TEMPLATE_DELIVERY_UNKNOWN',
  );
  const retry = await sendProactiveWhatsAppFlowTemplate(input);

  assert.equal(providerCalls, 1);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.message.status, 'unknown');
  assert.equal(store.sessions[0].deliveryAttemptedAt instanceof Date, true);
  assert.equal(store.sessions[0].sentAt, null);
});

test('conversation lookup remains tenant and project scoped', async () => {
  const store = createDatabase();
  await assert.rejects(
    getProactiveWhatsAppFlowCatalog({
      prisma: store.prisma,
      access: access({
        organization: { id: 'organization-b' },
        project: { id: 'project-b', organizationId: 'organization-b' },
      }),
      conversationId: 'conversation-a',
      canManage: true,
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'INBOX_CONVERSATION_NOT_FOUND' && error?.status === 404,
  );
});

function routeContext(conversationId = 'conversation-a') {
  return { params: Promise.resolve({ conversationId }) };
}

function routeRequest({
  method = 'GET',
  projectId = 'project-a',
  body,
  idempotencyKey,
} = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
  return new Request(
    `http://localhost/api/whatsapp/inbox/conversation-a/proactive-flows?projectId=${projectId}`,
    {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}

function routeProjectPrisma() {
  return {
    project: {
      async findFirst({ where }) {
        return where.id === 'project-a' && where.organizationId === 'organization-a'
          ? { id: 'project-a' }
          : null;
      },
    },
  };
}

test('proactive Flow route authorizes reads and forwards only trusted scope', async () => {
  const permissions = [];
  const calls = [];
  const handlers = createWhatsAppProactiveFlowHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission) => permissions.push(permission),
    prismaFactory: routeProjectPrisma,
    loadCatalog: async (input) => {
      calls.push(input);
      return { capability: { allowed: true, code: 'READY', reason: null }, catalog: [] };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  const response = await handlers.GET(routeRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.deepEqual(permissions, ['org:conversations:read']);
  assert.equal(calls[0].conversationId, 'conversation-a');
  assert.equal(calls[0].access.organization.id, 'organization-a');
  assert.equal(calls[0].canManage, true);
  assert.equal(payload.capability.code, 'READY');
});

test('proactive Flow route validates project, body fields, and idempotency before dispatch', async () => {
  const sends = [];
  const handlers = createWhatsAppProactiveFlowHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: routeProjectPrisma,
    sendFlow: async (input) => {
      sends.push(input);
      return { message: { id: 'outbound-a', status: 'accepted' } };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });
  const valid = await handlers.POST(routeRequest({
    method: 'POST',
    idempotencyKey: 'flow-route-stable-a',
    body: { projectId: 'project-a', blueprintKey: 'incident-report' },
  }), routeContext());
  assert.equal(valid.status, 200);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].idempotencyKey, 'flow-route-stable-a');
  assert.equal(sends[0].blueprintKey, 'incident-report');

  const unknownField = await handlers.POST(routeRequest({
    method: 'POST',
    idempotencyKey: 'flow-route-invalid-a',
    body: {
      projectId: 'project-a',
      blueprintKey: 'incident-report',
      workerId: 'attacker-selected-worker',
    },
  }), routeContext());
  assert.equal(unknownField.status, 400);

  const mismatchedProject = await handlers.POST(routeRequest({
    method: 'POST',
    idempotencyKey: 'flow-route-invalid-b',
    body: { projectId: 'project-b', blueprintKey: 'incident-report' },
  }), routeContext());
  assert.equal(mismatchedProject.status, 403);
  assert.equal(sends.length, 1);
});
