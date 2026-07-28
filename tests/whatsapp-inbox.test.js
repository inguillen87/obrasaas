import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

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
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
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

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const [
  { AccessError },
  { applyWebhookMessageAtomically, getOperationalMessages },
  { createWhatsAppInboxHandlers },
  { createWhatsAppConversationMessageHandlers },
  { createWhatsAppReadStateHandlers },
  {
    markWhatsAppConversationRead,
    sendManualWhatsAppMessage,
    WhatsAppInboxError,
    whatsAppConversationIdentity,
    whatsAppCustomerCareWindow,
  },
] = await Promise.all([
  import('../src/lib/access.js'),
  import('../src/lib/db.js'),
  import('../src/app/api/whatsapp/inbox/route.js'),
  import('../src/app/api/whatsapp/inbox/[conversationId]/messages/route.js'),
  import('../src/app/api/whatsapp/inbox/[conversationId]/read-state/route.js'),
  import('../src/lib/whatsapp/inbox.js'),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

const NOW = new Date('2026-07-17T18:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1_000;
const CONFIGURED_META_ENV = Object.freeze({
  NEXT_PUBLIC_APP_URL: 'https://preview.obrasaas.test',
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
    orgId: 'org_clerk_a',
    tenantRole: 'ADMIN',
    tenantMembershipId: 'membership-a',
    organization: { id: 'organization-a', name: 'Constructora A' },
    project: { id: 'project-a', organizationId: 'organization-a', name: 'Obra A' },
    subscription: { canRead: true, canWrite: true },
    ...overrides,
  };
}

function conversation(overrides = {}) {
  return {
    id: 'conversation-a',
    projectId: 'project-a',
    channel: 'whatsapp',
    externalId: 'meta:5491111111111',
    displayName: 'Ana',
    metadata: { contactPhone: '5491111111111' },
    createdAt: new Date('2026-07-17T15:00:00.000Z'),
    updatedAt: new Date('2026-07-17T17:30:00.000Z'),
    ...overrides,
  };
}

function message(overrides = {}) {
  return {
    id: 'message-a',
    conversationId: 'conversation-a',
    externalId: 'wamid.inbound-a',
    providerMessageId: 'wamid.inbound-a',
    direction: 'INBOUND',
    kind: 'TEXT',
    body: 'Necesitamos hormigón.',
    mediaUrl: null,
    status: 'received',
    metadata: null,
    sentAt: new Date('2026-07-17T17:30:00.000Z'),
    createdAt: new Date('2026-07-17T17:30:00.000Z'),
    ...overrides,
  };
}

function connection(overrides = {}) {
  return {
    id: 'connection-a',
    projectId: 'project-a',
    phoneNumberId: '123456789012345',
    whatsappBusinessId: '987654321098765',
    displayPhoneNumber: '+54 9 11 5555 0001',
    verifiedBusinessName: 'Constructora A',
    enabled: true,
    connectionStatus: 'CONNECTED',
    encryptedAccessToken: 'must-never-be-exposed',
    encryptedPin: 'must-never-be-exposed-either',
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
    },
    ...overrides,
  };
}

function routePrisma({
  projectVisible = true,
  conversations = [conversation()],
  selectedConversation = conversation(),
  messages = [message()],
  unreadRows = [],
  unreadTotal = 0,
} = {}) {
  const calls = [];
  const prisma = {
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return projectVisible
          ? {
              id: 'project-a',
              organizationId: 'organization-a',
              name: 'Obra A',
              status: 'ACTIVE',
              organization: {
                subscriptionPlan: 'PRO',
                subscriptionStatus: 'ACTIVE',
                trialEndsAt: null,
              },
            }
          : null;
      },
    },
    whatsAppConnection: {
      async findFirst(args) {
        calls.push(['connection', args]);
        return connection();
      },
      async findUnique(args) {
        calls.push(['connection', args]);
        return connection();
      },
    },
    conversation: {
      async findMany(args) {
        calls.push(['conversations', args]);
        return conversations;
      },
      async findFirst(args) {
        calls.push(['conversation', args]);
        return projectVisible
          ? {
              ...selectedConversation,
              ...(args?.select?.messages ? { messages: messages.slice(-1) } : {}),
            }
          : null;
      },
      async findUnique(args) {
        calls.push(['conversation-unique', args]);
        return projectVisible
          ? {
              ...selectedConversation,
              ...(args?.select?.messages ? { messages: messages.slice(-1) } : {}),
            }
          : null;
      },
    },
    message: {
      async findMany(args) {
        calls.push(['messages', args]);
        return messages;
      },
      async findFirst(args) {
        calls.push(['message-first', args]);
        return messages.find((item) => item.direction === 'INBOUND') || null;
      },
      async count(args) {
        calls.push(['message-count', args]);
        return 0;
      },
    },
    async $queryRawUnsafe(statement, ...args) {
      calls.push(['raw', statement, args]);
      return statement.includes('AS "unreadTotal"')
        ? [{ unreadTotal }]
        : unreadRows;
    },
  };
  return { calls, prisma };
}

function readStatePrisma({
  conversationId = 'conversation-a',
  messages = [message()],
} = {}) {
  const calls = [];
  const states = new Map();
  const stateKey = (threadId, actorId) => `${threadId}:${actorId}`;
  const compare = (left, right) => (
    left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id)
  );
  let selectedActorId = null;

  const database = {
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return { id: 'project-a' };
      },
    },
    conversation: {
      async findFirst(args) {
        calls.push(['conversation', args]);
        return args.where.id === conversationId
          ? {
              id: conversationId,
              externalId: 'meta:5491111111111',
              displayName: 'Ana',
              updatedAt: NOW,
            }
          : null;
      },
    },
    message: {
      async findFirst(args) {
        calls.push(['message-first', args]);
        const target = messages.find((item) => (
          item.id === args.where.id
          && item.conversationId === args.where.conversationId
        ));
        if (target?.metadata?.testDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, target.metadata.testDelayMs));
        }
        return target ? { id: target.id, createdAt: target.createdAt } : null;
      },
      async count(args) {
        calls.push(['message-count', args]);
        const state = states.get(stateKey(conversationId, selectedActorId));
        if (!state) return messages.filter((item) => item.direction === 'INBOUND').length;
        return messages.filter((item) => (
          item.direction === 'INBOUND'
          && compare(
            { id: item.id, createdAt: item.createdAt },
            { id: state.lastReadMessageId, createdAt: state.lastReadCreatedAt },
          ) > 0
        )).length;
      },
    },
    conversationReadState: {
      async findUnique(args) {
        selectedActorId = args.where.conversationId_platformUserId.platformUserId;
        const state = states.get(stateKey(
          args.where.conversationId_platformUserId.conversationId,
          selectedActorId,
        ));
        return state ? { ...state } : null;
      },
    },
    async $queryRawUnsafe(statement, ...args) {
      calls.push(['raw', statement, args]);
      if (statement.includes('AS "unreadTotal"')) {
        const actorId = args[0];
        const state = states.get(stateKey(conversationId, actorId));
        const unreadTotal = messages.filter((item) => (
          item.direction === 'INBOUND'
          && (!state || compare(
            { id: item.id, createdAt: item.createdAt },
            { id: state.lastReadMessageId, createdAt: state.lastReadCreatedAt },
          ) > 0)
        )).length;
        return [{ unreadTotal, conversationUnreadCount: unreadTotal }];
      }
      if (!statement.includes('INSERT INTO "ConversationReadState"')) return [];
      const [threadId, actorId, targetId, targetCreatedAt] = args;
      const key = stateKey(threadId, actorId);
      const candidate = {
        lastReadMessageId: targetId,
        lastReadCreatedAt: targetCreatedAt,
      };
      const current = states.get(key);
      if (!current || compare(
        { id: candidate.lastReadMessageId, createdAt: candidate.lastReadCreatedAt },
        { id: current.lastReadMessageId, createdAt: current.lastReadCreatedAt },
      ) > 0) {
        states.set(key, candidate);
      }
      return [{ lastReadMessageId: states.get(key).lastReadMessageId }];
    },
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback(database);
    },
  };
  const prisma = {
    ...database,
    async $queryRawUnsafe(statement, ...args) {
      calls.push(['raw-root', statement, args]);
      if (statement.includes('AS "unreadTotal"')) {
        const actorId = args[0];
        const state = states.get(stateKey(conversationId, actorId));
        const unreadTotal = messages.filter((item) => (
          item.direction === 'INBOUND'
          && (!state || compare(
            { id: item.id, createdAt: item.createdAt },
            { id: state.lastReadMessageId, createdAt: state.lastReadCreatedAt },
          ) > 0)
        )).length;
        return [{ unreadTotal, conversationUnreadCount: unreadTotal }];
      }
      return database.$queryRawUnsafe(statement, ...args);
    },
  };
  return { calls, prisma, states };
}

function inboxRequest(projectId = 'project-a', { limit, cursor } = {}) {
  const params = new URLSearchParams({ projectId });
  if (limit != null) params.set('limit', String(limit));
  if (cursor != null) params.set('cursor', cursor);
  return new Request(`http://localhost/api/whatsapp/inbox?${params}`);
}

function messagesRequest({
  projectId = 'project-a',
  method = 'GET',
  body,
  idempotencyKey,
  limit,
  cursor,
} = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (idempotencyKey !== undefined) headers.set('idempotency-key', idempotencyKey);
  const params = new URLSearchParams({ projectId });
  if (limit != null) params.set('limit', String(limit));
  if (cursor != null) params.set('before', cursor);
  return new Request(
    `http://localhost/api/whatsapp/inbox/conversation-a/messages?${params}`,
    {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}

function readStateRequest({
  projectId = 'project-a',
  conversationId = 'conversation-a',
  body = { projectId, throughMessageId: 'message-a' },
} = {}) {
  return new Request(
    `http://localhost/api/whatsapp/inbox/${conversationId}/read-state?projectId=${projectId}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

function routeContext(conversationId = 'conversation-a') {
  return { params: Promise.resolve({ conversationId }) };
}

function serializedCalls(calls) {
  return JSON.stringify(calls.map(([name, args]) => [name, args]));
}

test('GET inbox stays tenant/project scoped and keeps one thread per WhatsApp contact', async () => {
  const { calls, prisma } = routePrisma({
    conversations: [
      conversation(),
      conversation({
        id: 'conversation-b',
        externalId: 'meta:5491122222222',
        displayName: 'Bruno',
        metadata: { contactPhone: '5491122222222' },
      }),
    ],
  });
  const permissions = [];
  const handlers = createWhatsAppInboxHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission) => permissions.push(permission),
    prismaFactory: () => prisma,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  const response = await handlers.GET(inboxRequest());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.deepEqual(permissions, ['org:conversations:read']);
  assert.equal(payload.project.id, 'project-a');
  assert.equal(payload.connection.operational, true);
  assert.equal(payload.conversations.length, 2);
  assert.equal(payload.conversations[0].phone, '•••• 1111');
  assert.equal(JSON.stringify(payload).includes('5491111111111'), false);
  assert.equal(payload.unreadTotal, 0);
  assert.deepEqual(payload.pageInfo, { hasMore: false, nextCursor: null });
  assert.deepEqual(
    new Set(payload.conversations.map((item) => item.id)),
    new Set(['conversation-a', 'conversation-b']),
  );
  assert.equal(JSON.stringify(payload).includes('must-never-be-exposed'), false);

  const queryEvidence = serializedCalls(calls);
  assert.match(queryEvidence, /project-a/);
  assert.match(queryEvidence, /organization-a/);
  assert.doesNotMatch(queryEvidence, /organization-foreign|project-foreign/);
});

test('GET inbox publishes durable per-user unread counts and a project-wide total', async () => {
  const { calls, prisma } = routePrisma({
    unreadRows: [{ conversationId: 'conversation-a', unreadCount: 3 }],
    unreadTotal: 7,
  });
  const response = await createWhatsAppInboxHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  }).GET(inboxRequest());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.conversations[0].unreadCount, 3);
  assert.equal(payload.unreadTotal, 7);
  const rawSql = calls
    .filter(([name]) => name === 'raw')
    .map(([, statement]) => statement)
    .join('\n');
  assert.match(rawSql, /"platformUserId" = \$1/);
  assert.match(rawSql, /"organizationId" = \$3/);
  assert.match(rawSql, /membership\."id" = \$4/);
  assert.match(rawSql, /project_membership\."createdAt"/);
  assert.match(rawSql, /membership\."createdAt"/);
  assert.match(rawSql, /actor\."createdAt"/);
  assert.match(rawSql, /message\."createdAt"/);
  assert.doesNotMatch(rawSql, /message\."sentAt"/);
});

test('GET inbox fails closed before reading conversations from an inaccessible project', async () => {
  const { calls, prisma } = routePrisma({ projectVisible: false });
  const handlers = createWhatsAppInboxHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const response = await handlers.GET(inboxRequest('project-foreign'));

  assert.ok([403, 404].includes(response.status));
  assert.equal(calls.some(([name]) => name === 'conversations'), false);
  if (calls.length) {
    const queryEvidence = serializedCalls(calls);
    assert.match(queryEvidence, /organization-a|project-foreign/);
  }
});

test('GET messages returns only the scoped conversation and its chronological messages', async () => {
  const rows = [
    message(),
    message({
      id: 'message-b',
      externalId: 'manual:outbound-b',
      providerMessageId: 'wamid.outbound-b',
      direction: 'OUTBOUND',
      body: 'Lo coordinamos.',
      status: 'sent',
      sentAt: new Date('2026-07-17T17:31:00.000Z'),
      createdAt: new Date('2026-07-17T17:31:00.000Z'),
    }),
  ];
  const { calls, prisma } = routePrisma({ messages: rows });
  const permissions = [];
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission) => permissions.push(permission),
    prismaFactory: () => prisma,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  });

  const response = await handlers.GET(messagesRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.deepEqual(permissions, ['org:conversations:read']);
  assert.equal(payload.conversation.id, 'conversation-a');
  assert.equal(payload.conversation.phone, '•••• 1111');
  assert.equal(JSON.stringify(payload).includes('5491111111111'), false);
  assert.deepEqual(payload.messages.map((item) => item.id), ['message-a', 'message-b']);
  assert.equal(JSON.stringify(payload).includes('wamid.outbound-b'), false);
  assert.deepEqual(payload.pageInfo, { hasMore: false, nextCursor: null });
  assert.equal(payload.window.isOpen, true);
  assert.deepEqual(payload.composerCapability, {
    allowed: true,
    code: 'READY',
    reason: null,
  });
  const queryEvidence = serializedCalls(calls);
  assert.match(queryEvidence, /conversation-a/);
  assert.match(queryEvidence, /project-a/);
  assert.doesNotMatch(queryEvidence, /conversation-foreign|project-foreign/);
});

test('GET messages projects server-owned onboarding state for an authorized manager', async () => {
  const { prisma } = routePrisma();
  let onboardingInput = null;
  const response = await createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'DIRECTOR' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    loadOnboardingState: async (input) => {
      onboardingInput = input;
      return {
        state: 'eligible',
        capability: {
          allowed: true,
          code: 'READY',
          reason: 'Puede iniciar el alta segura.',
        },
        invitation: null,
        contact: { status: 'UNASSIGNED' },
      };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  }).GET(messagesRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.onboarding, {
    state: 'eligible',
    reason: 'Puede iniciar el alta segura.',
  });
  assert.equal(onboardingInput.conversationId, 'conversation-a');
  assert.equal(onboardingInput.access.organization.id, 'organization-a');
  assert.equal(onboardingInput.access.project.id, 'project-a');
  assert.equal(onboardingInput.canManage, true);
  assert.equal(JSON.stringify(payload.onboarding).includes('UNASSIGNED'), false);
});

test('GET messages fails contact onboarding closed without hiding the conversation', async () => {
  const { prisma } = routePrisma();
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const response = await createWhatsAppConversationMessageHandlers({
      resolveAccess: async () => access({ tenantRole: 'DIRECTOR' }),
      authorize: () => undefined,
      prismaFactory: () => prisma,
      loadOnboardingState: async () => {
        const error = new Error('sensitive provider detail');
        error.code = 'ONBOARDING_STATE_UNAVAILABLE';
        throw error;
      },
      clock: () => NOW,
    }).GET(messagesRequest(), routeContext());
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.conversation.id, 'conversation-a');
    assert.deepEqual(payload.onboarding, { state: 'closed', reason: '' });
    assert.equal(JSON.stringify(payload).includes('sensitive provider detail'), false);
  } finally {
    console.error = originalError;
  }
});

test('conversation pagination uses a project-bound updatedAt and id keyset cursor', async () => {
  const sharedTime = new Date('2026-07-17T17:45:00.000Z');
  const rows = [
    conversation({ id: 'conversation-c', updatedAt: sharedTime }),
    conversation({ id: 'conversation-b', updatedAt: sharedTime }),
    conversation({ id: 'conversation-a', updatedAt: new Date('2026-07-17T17:44:00.000Z') }),
  ];
  const { calls, prisma } = routePrisma({ conversations: rows });
  const handlers = createWhatsAppInboxHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const firstResponse = await handlers.GET(inboxRequest('project-a', { limit: 2 }));
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.deepEqual(first.conversations.map((item) => item.id), ['conversation-c', 'conversation-b']);
  assert.equal(first.pageInfo.hasMore, true);
  assert.ok(first.pageInfo.nextCursor);

  const secondResponse = await handlers.GET(inboxRequest('project-a', {
    limit: 2,
    cursor: first.pageInfo.nextCursor,
  }));
  assert.equal(secondResponse.status, 200);
  const pageQueries = calls.filter(([name]) => name === 'conversations');
  assert.deepEqual(pageQueries[1][1].where.OR, [
    { updatedAt: { lt: sharedTime } },
    { updatedAt: sharedTime, id: { lt: 'conversation-b' } },
  ]);

  const tampered = `${first.pageInfo.nextCursor.slice(0, -1)}!`;
  const rejected = await handlers.GET(inboxRequest('project-a', { cursor: tampered }));
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, 'INBOX_PAGINATION_INVALID');
});

test('message pagination is stable on local createdAt plus id and bound to the conversation', async () => {
  const sharedTime = new Date('2026-07-17T17:40:00.000Z');
  const rows = [
    message({ id: 'message-c', createdAt: sharedTime, sentAt: new Date('2026-07-10T10:00:00.000Z') }),
    message({ id: 'message-b', createdAt: sharedTime, sentAt: new Date('2026-07-17T17:39:00.000Z') }),
    message({ id: 'message-a', createdAt: new Date('2026-07-17T17:39:00.000Z') }),
  ];
  const { calls, prisma } = routePrisma({ messages: rows });
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const firstResponse = await handlers.GET(
    messagesRequest({ limit: 2 }),
    routeContext('conversation-a'),
  );
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.deepEqual(first.messages.map((item) => item.id), ['message-b', 'message-c']);
  assert.equal(first.pageInfo.hasMore, true);

  const secondResponse = await handlers.GET(
    messagesRequest({ limit: 2, cursor: first.pageInfo.nextCursor }),
    routeContext('conversation-a'),
  );
  assert.equal(secondResponse.status, 200);
  const pageQueries = calls.filter(([name]) => name === 'messages');
  assert.deepEqual(pageQueries[1][1].where.OR, [
    { createdAt: { lt: sharedTime } },
    { createdAt: sharedTime, id: { lt: 'message-b' } },
  ]);

  const wrongConversation = await handlers.GET(
    messagesRequest({ limit: 2, cursor: first.pageInfo.nextCursor }),
    routeContext('conversation-b'),
  );
  assert.equal(wrongConversation.status, 400);
  assert.equal((await wrongConversation.json()).code, 'INBOX_PAGINATION_INVALID');
});

test('PUT read-state advances only the authenticated operator watermark and returns remaining unread', async () => {
  const rows = [
    message({ id: 'message-a', createdAt: new Date('2026-07-17T17:30:00.000Z') }),
    message({ id: 'message-b', createdAt: new Date('2026-07-17T17:31:00.000Z') }),
  ];
  const { calls, prisma, states } = readStatePrisma({ messages: rows });
  const permissions = [];
  const handlers = createWhatsAppReadStateHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission, options) => permissions.push([permission, options]),
    prismaFactory: () => prisma,
  });

  const response = await handlers.PUT(
    readStateRequest({ body: { projectId: 'project-a', throughMessageId: 'message-a' } }),
    routeContext(),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(permissions, [[
    'org:conversations:read',
    { subscriptionMode: 'read' },
  ]]);
  assert.equal(payload.conversationId, 'conversation-a');
  assert.equal(payload.unreadCount, 1);
  assert.equal(payload.unreadTotal, 1);
  assert.equal(states.get('conversation-a:actor-a').lastReadMessageId, 'message-a');
  const insert = calls.find(([name, statement]) => (
    name === 'raw' && statement.includes('INSERT INTO "ConversationReadState"')
  ));
  assert.ok(insert);
  assert.match(insert[1], /ON CONFLICT \("conversationId", "platformUserId"\) DO UPDATE/);
  assert.match(insert[1], /"lastReadCreatedAt"[\s\S]*"lastReadMessageId"/);
  assert.equal(JSON.stringify(calls).includes('organization-foreign'), false);
});

test('read-state fails closed for foreign conversations and rejects client-owned fields', async () => {
  const { calls, prisma } = readStatePrisma();
  const handlers = createWhatsAppReadStateHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
  });

  const extraField = await handlers.PUT(
    readStateRequest({
      body: {
        projectId: 'project-a',
        throughMessageId: 'message-a',
        platformUserId: 'actor-foreign',
      },
    }),
    routeContext(),
  );
  assert.equal(extraField.status, 400);
  assert.equal((await extraField.json()).code, 'INBOX_READ_STATE_INVALID');

  const missingTarget = await handlers.PUT(
    readStateRequest({ body: { projectId: 'project-a' } }),
    routeContext(),
  );
  assert.equal(missingTarget.status, 400);
  assert.equal((await missingTarget.json()).code, 'INBOX_READ_STATE_INVALID');

  const missingProject = await handlers.PUT(
    readStateRequest({ body: { throughMessageId: 'message-a' } }),
    routeContext(),
  );
  assert.equal(missingProject.status, 400);
  assert.equal((await missingProject.json()).code, 'INBOX_READ_STATE_INVALID');

  const foreign = await handlers.PUT(
    readStateRequest({ conversationId: 'conversation-foreign' }),
    routeContext('conversation-foreign'),
  );
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json()).code, 'INBOX_CONVERSATION_NOT_FOUND');
  assert.equal(calls.some(([name, statement]) => (
    name === 'raw' && statement.includes('INSERT INTO "ConversationReadState"')
  )), false);
});

test('concurrent and independent read cursors never regress across tabs or users', async () => {
  const sharedTime = new Date('2026-07-17T17:30:00.000Z');
  const rows = [
    message({
      id: 'message-a',
      createdAt: sharedTime,
      metadata: { testDelayMs: 8 },
    }),
    message({ id: 'message-b', createdAt: sharedTime }),
  ];
  const { prisma, states } = readStatePrisma({ messages: rows });

  await Promise.all([
    markWhatsAppConversationRead({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      throughMessageId: 'message-a',
    }),
    markWhatsAppConversationRead({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      throughMessageId: 'message-b',
    }),
  ]);
  await markWhatsAppConversationRead({
    prisma,
    access: access({ databaseUserId: 'actor-b' }),
    conversationId: 'conversation-a',
    throughMessageId: 'message-a',
  });

  assert.equal(states.get('conversation-a:actor-a').lastReadMessageId, 'message-b');
  assert.equal(states.get('conversation-a:actor-b').lastReadMessageId, 'message-a');
});

test('an inbound recorded after the watermark remains unread even with an older provider timestamp', async () => {
  const rows = [
    message({
      id: 'message-a',
      createdAt: new Date('2026-07-17T17:30:00.000Z'),
      sentAt: new Date('2026-07-17T17:30:00.000Z'),
    }),
    message({
      id: 'message-late',
      createdAt: new Date('2026-07-17T17:31:00.000Z'),
      sentAt: new Date('2026-07-10T09:00:00.000Z'),
    }),
  ];
  const { prisma } = readStatePrisma({ messages: rows });
  const result = await markWhatsAppConversationRead({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    throughMessageId: 'message-a',
  });

  assert.equal(result.unreadCount, 1);
  assert.equal(result.unreadTotal, 1);
});

test('read-state migration is atomic while hot inbox indexes build concurrently', async () => {
  const [migration, indexMigration] = await Promise.all([
    readFile(
      new URL(
        '../prisma/migrations/20260717120000_whatsapp_inbox_read_state/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL(
        '../prisma/migrations/20260717121000_whatsapp_inbox_read_state_indexes/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  ]);

  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(migration, /ADD COLUMN "unreadTrackingStartedAt"/);
  assert.match(migration, /UPDATE "Conversation"[\s\S]*CURRENT_TIMESTAMP/);
  assert.match(migration, /PRIMARY KEY \("conversationId", "platformUserId"\)/);
  assert.doesNotMatch(migration, /CREATE INDEX .*Message_conversationId_createdAt_id_idx/);
  for (const indexName of [
    'Conversation_projectId_channel_updatedAt_id_idx',
    'Message_conversationId_createdAt_id_idx',
    'Message_conversationId_direction_createdAt_id_idx',
  ]) {
    assert.match(indexMigration, new RegExp(`DROP INDEX IF EXISTS "${indexName}"`));
    assert.match(indexMigration, new RegExp(`CREATE INDEX CONCURRENTLY "${indexName}"`));
  }
  assert.doesNotMatch(`${migration}\n${indexMigration}`, /DROP INDEX "Message_conversationId_sentAt_idx"/);
  assert.equal((migration.match(/ON DELETE CASCADE/g) || []).length, 2);
});

test('operational conversation access never exposes clinical text without medical permission', async () => {
  const clinicalText = 'El operario tiene cáncer y adjuntó su certificado médico.';
  const { prisma } = routePrisma({
    messages: [message({ body: clinicalText, metadata: { provider: 'meta' } })],
  });
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'SITE_MANAGER' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const response = await handlers.GET(messagesRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(payload).includes(clinicalText), false);
  assert.match(payload.messages[0].body, /restringid/i);
});

test('conversation readers see operational text but not audio transcripts without source-evidence permission', async () => {
  const transcript = 'La mezcla llegó tarde y faltan tres bolsas del lote cuatro.';
  const operationalText = 'Necesitamos hormigón en el sector norte.';
  const { prisma } = routePrisma({
    messages: [
      message({ body: operationalText }),
      message({
        id: 'message-audio',
        externalId: 'wamid.audio-a',
        kind: 'AUDIO',
        body: transcript,
        metadata: {
          sourceContentRestricted: true,
          transcription: { text: transcript, status: 'completed' },
          media: { kind: 'audio', filename: 'reporte.ogg' },
        },
        sentAt: new Date('2026-07-17T17:31:00.000Z'),
        createdAt: new Date('2026-07-17T17:31:00.000Z'),
      }),
    ],
  });
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'SITE_MANAGER' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const response = await handlers.GET(messagesRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.messages[0].body, operationalText);
  assert.equal(JSON.stringify(payload).includes(transcript), false);
  assert.match(payload.messages[1].body, /evidencia.*restringid/i);
  assert.equal(payload.messages[1].media, null);
});

test('message DTO marks only authorized inbound Meta images as progress-evidence candidates', async () => {
  const imageMetadata = {
    provider: 'meta',
    authorized: true,
    sourceContentRestricted: true,
    workerId: 'worker-a',
    media: { kind: 'image', filename: 'frente.webp', mimeType: 'image/webp' },
  };
  const messages = [
    message({
      id: 'message-image-eligible',
      kind: 'IMAGE',
      body: 'Mampostería del frente a media altura.',
      mediaUrl: 'https://private.blob.vercel-storage.com/tenant-a/frente.webp',
      metadata: imageMetadata,
    }),
    message({
      id: 'message-image-linked',
      kind: 'IMAGE',
      body: 'Foto ya incorporada al avance.',
      metadata: imageMetadata,
      progressEvidenceSource: { id: 'progress-evidence-a' },
      createdAt: new Date('2026-07-17T17:30:30.000Z'),
      sentAt: new Date('2026-07-17T17:30:30.000Z'),
    }),
    message({
      id: 'message-image-unauthorized',
      kind: 'IMAGE',
      metadata: { ...imageMetadata, authorized: false },
      createdAt: new Date('2026-07-17T17:31:00.000Z'),
      sentAt: new Date('2026-07-17T17:31:00.000Z'),
    }),
    message({
      id: 'message-image-quarantined',
      kind: 'IMAGE',
      mediaUrl: 'https://private.blob.vercel-storage.com/tenant-a/quarantine.webp',
      metadata: { ...imageMetadata, quarantined: true },
      createdAt: new Date('2026-07-17T17:32:00.000Z'),
      sentAt: new Date('2026-07-17T17:32:00.000Z'),
    }),
    message({
      id: 'message-image-outbound',
      direction: 'OUTBOUND',
      kind: 'IMAGE',
      metadata: imageMetadata,
      createdAt: new Date('2026-07-17T17:33:00.000Z'),
      sentAt: new Date('2026-07-17T17:33:00.000Z'),
    }),
    message({
      id: 'message-image-medical',
      kind: 'IMAGE',
      metadata: { ...imageMetadata, sensitivity: 'medical' },
      createdAt: new Date('2026-07-17T17:34:00.000Z'),
      sentAt: new Date('2026-07-17T17:34:00.000Z'),
    }),
  ];
  const { prisma } = routePrisma({ messages });

  const authorizedResponse = await createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'DIRECTOR' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  }).GET(messagesRequest(), routeContext());
  const authorizedPayload = await authorizedResponse.json();
  const messageById = new Map(authorizedPayload.messages.map((item) => [item.id, item]));

  assert.equal(messageById.get('message-image-eligible').progressEvidenceEligible, true);
  assert.equal(messageById.get('message-image-eligible').sourceEvidenceViewable, true);
  assert.equal(messageById.get('message-image-eligible').progressEvidenceLinked, false);
  assert.equal(messageById.get('message-image-linked').progressEvidenceEligible, false);
  assert.equal(messageById.get('message-image-linked').progressEvidenceLinked, true);
  assert.equal(messageById.get('message-image-unauthorized').progressEvidenceEligible, false);
  assert.equal(messageById.get('message-image-quarantined').progressEvidenceEligible, false);
  assert.equal(messageById.get('message-image-quarantined').sourceEvidenceViewable, false);
  assert.equal(messageById.get('message-image-outbound').progressEvidenceEligible, false);
  assert.equal(messageById.get('message-image-medical').progressEvidenceEligible, false);
  assert.equal(JSON.stringify(authorizedPayload).includes('private.blob.vercel-storage.com'), false);

  const restrictedResponse = await createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'SITE_MANAGER' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  }).GET(messagesRequest(), routeContext());
  const restrictedPayload = await restrictedResponse.json();
  assert.equal(
    restrictedPayload.messages.every((item) => (
      item.progressEvidenceEligible === false
      && item.progressEvidenceLinked === false
      && item.sourceEvidenceViewable === false
    )),
    true,
  );
});

test('interactive Flow template messages remain visible without exposing binary evidence', async () => {
  const templateBody = 'Completá el reporte para dejar la incidencia trazable en la bitácora.';
  const { prisma } = routePrisma({
    messages: [
      message({
        direction: 'OUTBOUND',
        kind: 'INTERACTIVE',
        body: templateBody,
        status: 'accepted',
        metadata: {
          messageType: 'whatsapp_flow_template',
          blueprintKey: 'incident-report',
        },
      }),
    ],
  });
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'SITE_MANAGER' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const response = await handlers.GET(messagesRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.messages[0].kind, 'interactive');
  assert.equal(payload.messages[0].body, templateBody);
  assert.equal(payload.messages[0].status, 'accepted');
  assert.equal(payload.messages[0].media, null);
});

test('automatic replies prepared for durable delivery remain visible as queued', async () => {
  const { prisma } = routePrisma({
    messages: [
      message({
        direction: 'OUTBOUND',
        externalId: 'obrasaas-reply:wamid.inbound-a',
        providerMessageId: null,
        body: 'Respuesta operativa en cola.',
        status: 'prepared',
      }),
    ],
  });
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access({ tenantRole: 'SITE_MANAGER' }),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    clock: () => NOW,
  });

  const response = await handlers.GET(messagesRequest(), routeContext());
  const payload = await response.json();
  const clientSource = await readFile(
    new URL('../src/app/dashboard/inbox/inbox-client.js', import.meta.url),
    'utf8',
  );

  assert.equal(response.status, 200);
  assert.equal(payload.messages[0].status, 'prepared');
  assert.match(clientSource, /PREPARED: \{[^}]*label: 'En cola'/);
});

test('read and manual-send handlers enforce distinct RBAC permissions before database access', async () => {
  const forbidden = () => {
    throw new AccessError('Permission required.', {
      code: 'PERMISSION_REQUIRED',
      status: 403,
    });
  };
  let prismaCalls = 0;
  const deps = {
    resolveAccess: async () => access({ tenantRole: 'AUDITOR' }),
    authorize: forbidden,
    prismaFactory: () => {
      prismaCalls += 1;
      return routePrisma().prisma;
    },
    sendMessage: async () => assert.fail('A forbidden send must never reach the service.'),
    clock: () => NOW,
  };

  const list = await createWhatsAppInboxHandlers(deps).GET(inboxRequest());
  const send = await createWhatsAppConversationMessageHandlers(deps).POST(
    messagesRequest({
      method: 'POST',
      body: { body: 'Mensaje no autorizado' },
      idempotencyKey: 'manual-message-a',
    }),
    routeContext(),
  );

  assert.equal(list.status, 403);
  assert.equal(send.status, 403);
  assert.equal(prismaCalls, 0);
});

test('POST requires a bounded idempotency key before invoking the send service', async () => {
  const serviceCalls = [];
  const { prisma } = routePrisma();
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    sendMessage: async (input) => {
      serviceCalls.push(input);
      return {
        message: message({ direction: 'OUTBOUND', body: input.body, status: 'accepted' }),
        window: whatsAppCustomerCareWindow(message().sentAt, NOW),
        idempotent: false,
      };
    },
    clock: () => NOW,
  });

  for (const idempotencyKey of [undefined, 'short7', `a${'b'.repeat(128)}`]) {
    const response = await handlers.POST(
      messagesRequest({
        method: 'POST',
        body: { body: 'Confirmamos la entrega.' },
        idempotencyKey,
      }),
      routeContext(),
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'IDEMPOTENCY_KEY_INVALID');
  }
  assert.equal(serviceCalls.length, 0);

  const response = await handlers.POST(
    messagesRequest({
      method: 'POST',
      body: { body: 'Confirmamos la entrega.' },
      idempotencyKey: 'manual-message-a',
    }),
    routeContext(),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.idempotent, false);
  assert.equal(serviceCalls.length, 1);
  assert.equal(serviceCalls[0].conversationId, 'conversation-a');
  assert.equal(serviceCalls[0].idempotencyKey, 'manual-message-a');
  assert.equal(serviceCalls[0].body, 'Confirmamos la entrega.');
});

test('POST exposes Retry-After when the durable send quota is exhausted', async () => {
  const { prisma } = routePrisma();
  const handlers = createWhatsAppConversationMessageHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => prisma,
    sendMessage: async () => {
      throw new WhatsAppInboxError('Esperá antes de volver a enviar.', {
        code: 'WHATSAPP_CONVERSATION_RATE_LIMIT',
        status: 429,
        retryAfterSeconds: 60,
      });
    },
  });

  const response = await handlers.POST(
    messagesRequest({
      method: 'POST',
      body: { projectId: 'project-a', body: 'Mensaje limitado.' },
      idempotencyKey: 'manual-rate-route-a',
    }),
    routeContext(),
  );
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(payload.code, 'WHATSAPP_CONVERSATION_RATE_LIMIT');
});

test('WhatsApp customer-care window closes fail-closed at the exact 24-hour boundary', () => {
  const justInside = whatsAppCustomerCareWindow(
    new Date(NOW.getTime() - DAY_MS + 1),
    NOW,
  );
  const exactBoundary = whatsAppCustomerCareWindow(
    new Date(NOW.getTime() - DAY_MS),
    NOW,
  );
  const outside = whatsAppCustomerCareWindow(
    new Date(NOW.getTime() - DAY_MS - 1),
    NOW,
  );

  assert.equal(justInside.isOpen, true);
  assert.equal(justInside.remainingSeconds, 1);
  assert.equal(exactBoundary.isOpen, false);
  assert.equal(exactBoundary.remainingSeconds, 0);
  assert.equal(outside.isOpen, false);
  assert.equal(outside.remainingSeconds, 0);
  assert.equal(exactBoundary.expiresAt, NOW.toISOString());
});

test('WhatsApp conversation identity is stable per normalized contact and distinct across contacts', () => {
  const formatted = whatsAppConversationIdentity({
    provider: 'meta',
    from: '+54 9 11 1111-1111',
    displayName: '  Ana  ',
  });
  const normalized = whatsAppConversationIdentity({
    provider: 'meta',
    from: '5491111111111',
    displayName: 'Ana actualizada',
  });
  const other = whatsAppConversationIdentity({
    provider: 'meta',
    from: '+54 9 11 2222-2222',
    displayName: 'Bruno',
  });

  assert.deepEqual(formatted, {
    externalId: 'meta:5491111111111',
    phone: '5491111111111',
    displayName: 'Ana',
  });
  assert.equal(normalized.externalId, formatted.externalId);
  assert.notEqual(other.externalId, formatted.externalId);
  assert.throws(() => whatsAppConversationIdentity({
    provider: 'meta',
    from: 'sin-telefono',
  }));
});

function webhookContactTransaction({ phone, eventId }) {
  const calls = [];
  const project = {
    id: 'project-a',
    organizationId: 'organization-a',
    status: 'ACTIVE',
    latitude: -34.6,
    longitude: -58.4,
    geofenceMeters: 120,
    startsAt: new Date('2026-07-01T00:00:00.000Z'),
    organization: {
      timezone: 'America/Argentina/Buenos_Aires',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    },
    snapshot: { state: { incidents: [], attendance: {}, tasks: {} }, version: 1 },
    whatsapp: { phoneNumberId: 'phone-a', enabled: true, metadata: null },
  };
  const worker = {
    id: `worker-${phone}`,
    projectId: project.id,
    phone,
    name: `Persona ${phone.slice(-4)}`,
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: NOW,
    updatedAt: NOW,
    project: { organizationId: project.organizationId },
  };
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    webhookEvent: {
      async findFirst(args) {
        calls.push(['event-read', args]);
        return { id: eventId, appliedAt: null, outcome: null };
      },
      async updateMany(args) {
        calls.push(['event-apply', args]);
        return { count: 1 };
      },
    },
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return project;
      },
    },
    worker: {
      async findMany(args) {
        calls.push(['worker', args]);
        return [worker];
      },
    },
    conversation: {
      async upsert(args) {
        calls.push(['conversation-upsert', args]);
        return {
          id: `conversation-${args.where.projectId_channel_externalId.externalId}`,
          ...args.create,
        };
      },
      async update(args) {
        calls.push(['conversation-update', args]);
        return args.data;
      },
    },
    message: {
      async findUnique(args) {
        calls.push(['message-read', args]);
        return null;
      },
      async create(args) {
        calls.push(['message-create', args]);
        return { id: `stored-${args.data.externalId}`, ...args.data };
      },
    },
  };
  return { calls, transaction };
}

test('real Meta webhooks persist separate tenant conversations for separate contacts', async () => {
  const storedExternalIds = [];
  const storedDisplayNames = [];
  for (const [index, phone] of ['+5491111111111', '+5491122222222'].entries()) {
    const eventId = `event-contact-${index}`;
    const { calls, transaction } = webhookContactTransaction({ phone, eventId });
    globalThis.__obraSaasPrisma = {
      async $transaction(callback) {
        return callback(transaction);
      },
    };

    await applyWebhookMessageAtomically({
      eventId,
      leaseToken: `lease-contact-${index}`,
      event: {
        provider: 'meta',
        eventType: 'message',
        externalId: `wamid.contact-${index}`,
        phoneNumberId: 'phone-a',
        from: phone,
        displayName: index === 0 ? 'Nombre suplantado' : 'Otro perfil no verificado',
        kind: 'text',
        text: 'Reporte de obra',
        timestamp: NOW,
      },
      scope: {
        projectId: 'project-a',
        organizationId: 'organization-a',
        phoneNumberId: 'phone-a',
      },
      apply: async () => ({
        reply: 'Recibido.',
        flowPrompt: null,
        intent: 'GENERAL',
        stateChanged: false,
        newMessages: [
          {
            externalId: `wamid.contact-${index}`,
            sender: 'user',
            kind: 'text',
            text: 'Reporte de obra',
            sentAt: NOW,
          },
          {
            externalId: `obrasaas-reply:wamid.contact-${index}`,
            sender: 'bot',
            kind: 'text',
            text: 'Recibido.',
            sentAt: NOW,
          },
        ],
      }),
    });

    const upsert = calls.find(([name]) => name === 'conversation-upsert');
    assert.ok(upsert, 'The webhook must resolve a durable contact conversation.');
    storedExternalIds.push(
      upsert[1].where.projectId_channel_externalId.externalId,
    );
    storedDisplayNames.push(upsert[1].create.displayName);
  }

  assert.deepEqual(storedExternalIds, [
    'meta:5491111111111',
    'meta:5491122222222',
  ]);
  assert.notEqual(storedExternalIds[0], storedExternalIds[1]);
  assert.equal(storedExternalIds.includes('dashboard-demo'), false);
  assert.deepEqual(storedDisplayNames, ['Persona 1111', 'Persona 2222']);
});

test('operational analytics read Meta threads and never the dashboard simulator thread', async () => {
  const queries = [];
  globalThis.__obraSaasPrisma = {
    project: {
      async findFirst(args) {
        queries.push(['project', args]);
        return {
          id: 'project-a',
          organizationId: 'organization-a',
          organization: { id: 'organization-a' },
          whatsapp: null,
        };
      },
    },
    message: {
      async findMany(args) {
        queries.push(['messages', args]);
        return [message({ body: 'Actividad real de Meta.' })];
      },
    },
  };

  const messages = await getOperationalMessages(access(), {
    includeSourceEvidence: true,
  });

  assert.equal(messages[0].text, 'Actividad real de Meta.');
  const query = queries.find(([name]) => name === 'messages')[1];
  assert.deepEqual(query.where.conversation, {
    projectId: 'project-a',
    channel: 'whatsapp',
    externalId: { startsWith: 'meta:' },
  });
  assert.equal(JSON.stringify(query).includes('dashboard-demo'), false);
});

function manualSendPrisma() {
  const records = new Map();
  const calls = [];
  const inbound = message({ sentAt: new Date('2026-07-17T17:30:00.000Z') });
  const thread = conversation();
  const database = {
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return {
          ...access().project,
          status: 'ACTIVE',
          organization: {
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
        };
      },
    },
    conversation: {
      async findFirst(args) {
        calls.push(['conversation', args]);
        return thread;
      },
      async findUnique(args) {
        calls.push(['conversation-unique', args]);
        return thread;
      },
      async update(args) {
        calls.push(['conversation-update', args]);
        Object.assign(thread, args.data);
        return thread;
      },
    },
    whatsAppConnection: {
      async findUnique(args) {
        calls.push(['connection', args]);
        return connection();
      },
    },
    message: {
      async findFirst(args) {
        calls.push(['message-first', args]);
        if (args?.where?.direction === 'INBOUND') return inbound;
        const externalId = args?.where?.externalId;
        return externalId ? records.get(externalId) || null : null;
      },
      async findUnique(args) {
        calls.push(['message-unique', args]);
        const externalId = args?.where?.externalId;
        if (externalId) return records.get(externalId) || null;
        const providerMessageId = args?.where?.providerMessageId;
        return [...records.values()].find(
          (item) => item.providerMessageId === providerMessageId,
        ) || null;
      },
      async create(args) {
        calls.push(['message-create', args]);
        if (records.has(args.data.externalId)) {
          throw Object.assign(new Error('unique constraint'), {
            code: 'P2002',
            meta: { target: ['externalId'] },
          });
        }
        const created = {
          id: `message-outbound-${records.size + 1}`,
          createdAt: NOW,
          sentAt: NOW,
          ...args.data,
        };
        records.set(created.externalId, created);
        return created;
      },
      async update(args) {
        calls.push(['message-update', args]);
        const current = [...records.values()].find((item) => item.id === args.where.id);
        assert.ok(current, 'The claimed outbound message must exist before provider correlation.');
        Object.assign(current, args.data);
        return current;
      },
      async updateMany(args) {
        calls.push(['message-update-many', args]);
        const current = [...records.values()].find((item) => item.id === args.where.id);
        if (!current) return { count: 0 };
        Object.assign(current, args.data);
        return { count: 1 };
      },
    },
    auditLog: {
      async count(args) {
        calls.push(['audit-count', args]);
        return Number(database.__auditCount || 0);
      },
      async create(args) {
        calls.push(['audit', args]);
        return args.data;
      },
    },
    async $executeRawUnsafe(...args) {
      calls.push(['advisory-lock', args]);
      return 1;
    },
    async $queryRawUnsafe(...args) {
      calls.push(['organization-share-lock', args]);
      return [{ id: 'organization-a' }];
    },
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback(database);
    },
  };
  return { calls, prisma: database, records };
}

test('manual send is durable and idempotent: the same key reaches Meta only once', async () => {
  const { calls, prisma, records } = manualSendPrisma();
  const providerCalls = [];
  const sendText = async (input) => {
    providerCalls.push(input);
    return { messages: [{ id: 'wamid.outbound-manual-a' }] };
  };
  const input = {
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    body: 'Confirmamos la entrega.',
    idempotencyKey: 'manual-message-stable-a',
    sendText,
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  const first = await sendManualWhatsAppMessage(input);
  const retry = await sendManualWhatsAppMessage(input);

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(first.message.id, retry.message.id);
  assert.equal(providerCalls.length, 1);
  assert.equal(records.size, 1);
  assert.equal(
    [...records.values()][0].providerMessageId,
    'wamid.outbound-manual-a',
  );
  assert.ok(calls.some(([name]) => name === 'advisory-lock'));
  assert.ok(calls.some(([name]) => name === 'organization-share-lock'));
  assert.deepEqual(
    calls
      .filter(([name]) => name === 'audit')
      .map(([, args]) => args.data.action),
    ['whatsapp.inbox.send_requested', 'whatsapp.inbox.message_sent'],
  );
});

test('a stale sending claim reconciles to unknown and is never auto-retried', async () => {
  const { calls, prisma, records } = manualSendPrisma();
  let providerCalls = 0;
  const common = {
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    body: 'Mensaje con claim durable.',
    idempotencyKey: 'manual-message-stale-a',
    sendText: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.stale-a' }] };
    },
    env: CONFIGURED_META_ENV,
  };
  await sendManualWhatsAppMessage({ ...common, clock: () => NOW });
  const stored = [...records.values()][0];
  stored.status = 'sending';
  stored.providerMessageId = null;
  stored.sentAt = new Date(NOW.getTime() - 3 * 60_000);

  const retry = await sendManualWhatsAppMessage({ ...common, clock: () => NOW });

  assert.equal(providerCalls, 1);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.message.status, 'unknown');
  assert.ok(calls.some(([, args]) => (
    args?.data?.action === 'whatsapp.inbox.delivery_unknown'
    && args.data.metadata?.failureCode === 'STALE_DISPATCH_CLAIM'
  )));
});

test('manual send reserves a durable per-conversation rate limit before Meta', async () => {
  const { prisma, records } = manualSendPrisma();
  prisma.__auditCount = 10;
  let providerCalls = 0;

  await assert.rejects(
    sendManualWhatsAppMessage({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      body: 'Este envío debe quedar limitado.',
      idempotencyKey: 'manual-message-rate-a',
      sendText: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-exist' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_CONVERSATION_RATE_LIMIT'
      && error?.status === 429
      && error?.retryAfterSeconds === 60,
  );

  assert.equal(providerCalls, 0);
  assert.equal(records.size, 0);
});

test('a project closed after reservation is fenced before the provider call', async () => {
  const { prisma, records } = manualSendPrisma();
  const originalFindProject = prisma.project.findFirst.bind(prisma.project);
  let projectReads = 0;
  prisma.project.findFirst = async (args) => {
    projectReads += 1;
    const project = await originalFindProject(args);
    return projectReads >= 4 ? { ...project, status: 'COMPLETED' } : project;
  };
  let providerCalls = 0;

  await assert.rejects(
    sendManualWhatsAppMessage({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      body: 'No debe salir después del cierre.',
      idempotencyKey: 'manual-message-lifecycle-a',
      sendText: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-exist' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'PROJECT_READ_ONLY' && error?.status === 409,
  );

  assert.equal(providerCalls, 0);
  assert.equal([...records.values()][0].status, 'failed');
});

test('manual text is blocked outside the 24-hour window before calling Meta', async () => {
  const { prisma } = manualSendPrisma();
  prisma.message.findFirst = async (args) => {
    if (args?.where?.direction === 'INBOUND') {
      return message({ sentAt: new Date(NOW.getTime() - DAY_MS) });
    }
    return null;
  };
  let providerCalls = 0;

  await assert.rejects(
    sendManualWhatsAppMessage({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      body: 'Texto libre fuera de ventana.',
      idempotencyKey: 'manual-message-window-a',
      sendText: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-exist' }] };
      },
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_TEMPLATE_REQUIRED' && error?.status === 409,
  );

  assert.equal(providerCalls, 0);
});

test('an explicit Meta rejection is durable and an idempotent retry never sends twice', async () => {
  const { prisma, records } = manualSendPrisma();
  let providerCalls = 0;
  const input = {
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    body: 'Confirmamos la entrega.',
    idempotencyKey: 'manual-message-rejected-a',
    sendText: async () => {
      providerCalls += 1;
      throw Object.assign(new Error('Meta rejected the request.'), {
        code: 'META_131047',
        status: 400,
        ambiguous: false,
      });
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  await assert.rejects(
    sendManualWhatsAppMessage(input),
    (error) => error?.code === 'WHATSAPP_SEND_REJECTED',
  );
  const retry = await sendManualWhatsAppMessage(input);

  assert.equal(providerCalls, 1);
  assert.equal(records.size, 1);
  assert.equal([...records.values()][0].status, 'failed');
  assert.equal(retry.idempotent, true);
  assert.equal(retry.message.status, 'failed');
});

test('an ambiguous Meta transport failure remains unknown and is never auto-retried', async () => {
  const { prisma, records } = manualSendPrisma();
  let providerCalls = 0;
  const input = {
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    body: 'Mensaje con resultado ambiguo.',
    idempotencyKey: 'manual-message-ambiguous-a',
    sendText: async () => {
      providerCalls += 1;
      throw new TypeError('fetch failed');
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  await assert.rejects(
    sendManualWhatsAppMessage(input),
    (error) => error?.code === 'WHATSAPP_DELIVERY_UNKNOWN',
  );
  const retry = await sendManualWhatsAppMessage(input);

  assert.equal(providerCalls, 1);
  assert.equal(records.size, 1);
  assert.equal([...records.values()][0].status, 'unknown');
  assert.equal(retry.idempotent, true);
  assert.equal(retry.message.status, 'unknown');
});

test('an idempotent reconciliation reads a terminal delivery after the channel becomes unavailable', async () => {
  const { prisma, records } = manualSendPrisma();
  let providerCalls = 0;
  const input = {
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    body: 'Mensaje que luego confirma el webhook.',
    idempotencyKey: 'manual-message-reconcile-a',
    sendText: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.reconcile-a' }] };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  await sendManualWhatsAppMessage(input);
  const stored = [...records.values()][0];
  stored.status = 'delivered';
  prisma.project.findFirst = async () => ({
    ...access().project,
    status: 'COMPLETED',
    organization: {
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'CANCELED',
      trialEndsAt: null,
    },
  });
  prisma.whatsAppConnection.findUnique = async () => connection({
    enabled: false,
    connectionStatus: 'DISCONNECTED',
  });
  prisma.message.findFirst = async (args) => (
    args?.where?.direction === 'INBOUND'
      ? message({ sentAt: new Date(NOW.getTime() - 2 * DAY_MS) })
      : null
  );

  const reconciled = await sendManualWhatsAppMessage(input);

  assert.equal(providerCalls, 1);
  assert.equal(reconciled.idempotent, true);
  assert.equal(reconciled.message.status, 'delivered');
  assert.equal(reconciled.window.isOpen, false);
});

test('manual delivery fails before claiming a message when secure Meta config is incomplete', async () => {
  const { prisma, records } = manualSendPrisma();
  let providerCalls = 0;

  await assert.rejects(
    sendManualWhatsAppMessage({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      body: 'Este mensaje no debe salir.',
      idempotencyKey: 'manual-message-config-a',
      sendText: async () => {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-exist' }] };
      },
      clock: () => NOW,
      env: {},
    }),
    (error) => error?.code === 'WHATSAPP_PLATFORM_NOT_READY',
  );

  assert.equal(providerCalls, 0);
  assert.equal(records.size, 0);
});

test('reusing an idempotency key with different text fails instead of returning the old send', async () => {
  const { prisma } = manualSendPrisma();
  let providerCalls = 0;
  const common = {
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'manual-message-payload-a',
    sendText: async () => {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.payload-a' }] };
    },
    clock: () => NOW,
    env: CONFIGURED_META_ENV,
  };

  await sendManualWhatsAppMessage({ ...common, body: 'Primer contenido.' });
  await assert.rejects(
    sendManualWhatsAppMessage({ ...common, body: 'Contenido diferente.' }),
    (error) => error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH' && error?.status === 409,
  );

  assert.equal(providerCalls, 1);
});

test('a local correlation failure after Meta accepts is unknown, never rejected', async () => {
  const { prisma, records } = manualSendPrisma();
  const update = prisma.message.update.bind(prisma.message);
  let correlationFailures = 0;
  prisma.message.update = async (args) => {
    if (args.data.providerMessageId && correlationFailures === 0) {
      correlationFailures += 1;
      throw Object.assign(new Error('local correlation failed'), { code: 'P2028' });
    }
    return update(args);
  };

  await assert.rejects(
    sendManualWhatsAppMessage({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      body: 'Meta aceptará antes del fallo local.',
      idempotencyKey: 'manual-message-correlation-a',
      sendText: async () => ({ messages: [{ id: 'wamid.correlation-a' }] }),
      clock: () => NOW,
      env: CONFIGURED_META_ENV,
    }),
    (error) => error?.code === 'WHATSAPP_DELIVERY_UNKNOWN',
  );

  assert.equal(correlationFailures, 1);
  assert.equal([...records.values()][0].status, 'unknown');
});

test('Inbox composer reconciles UNKNOWN with the same key and preserves the pending body', async () => {
  const clientSource = await readFile(
    new URL('../src/app/dashboard/inbox/inbox-client.js', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(clientSource, /if \(sendResolution === 'UNKNOWN'\) return/);
  assert.match(
    clientSource,
    /const pendingAttempt = reconcileUnknown \? unresolvedSendRef\.current : null;[\s\S]{0,220}pendingAttempt\.body/,
  );
  assert.match(
    clientSource,
    /const idempotencyKey = reconcileUnknown[\s\S]{0,120}pendingAttempt\.idempotencyKey/,
  );
  assert.match(clientSource, /'Idempotency-Key': idempotencyKey/);
  assert.match(clientSource, /unresolvedSendRef\.current = attempt;[\s\S]{0,100}setSendResolution\('UNKNOWN'\)/);
  assert.match(
    clientSource,
    /sendResolution === 'UNKNOWN'[\s\S]{0,300}submitMessage\(\{ reconcileUnknown: true \}\)/,
  );
  assert.match(
    clientSource,
    /UNRESOLVED_SEND_STATES\.has\(reconciled\.status\)[\s\S]{0,360}setSendResolution\('FAILED'\)[\s\S]{0,300}setSendResolution\(''\)/,
  );
  assert.match(clientSource, /current\.trim\(\) === body \? '' : current/);
});
