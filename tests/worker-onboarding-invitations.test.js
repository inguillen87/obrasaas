import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:onboarding-invitation-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:onboarding-invitation-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:onboarding-invitation-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:onboarding-invitation-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:onboarding-invitation-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:onboarding-invitation-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  {
    WorkerOnboardingInvitationError,
    getWorkerOnboardingInvitationState,
    sendWorkerOnboardingInvitation,
  },
  { createWorkerOnboardingInvitationHandlers },
  { getCurrentWorkerOnboardingPrivacyNotice },
  { WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS },
] = await Promise.all([
  import('../src/lib/whatsapp/worker-onboarding-invitations.js'),
  import('../src/app/api/whatsapp/inbox/[conversationId]/worker-onboarding/route.js'),
  import('../src/lib/worker-onboarding-privacy-notices.js'),
  import('../src/lib/whatsapp/channel-health.js'),
]);

const NOW = new Date('2026-07-28T12:00:00.000Z');
const FLOW_SECRET = 'worker-onboarding-flow-secret-for-unit-tests-v1';
const CURRENT_NOTICE = getCurrentWorkerOnboardingPrivacyNotice();
const TRANSIENT_CLAIM_FIELDS = Object.freeze([
  'senderEncryptedPayload',
  'senderFingerprint',
  'senderFingerprintKeyId',
  'senderLastFour',
  'senderWrappingKeyId',
  'senderRecordVersion',
  'claimedIdentityEncryptedPayload',
  'claimedCuilFingerprint',
  'claimedCuilFingerprintKeyId',
  'claimedCuilLastFour',
  'claimedIdentityWrappingKeyId',
  'claimedIdentityRecordVersion',
]);

function assertTransientClaimPurged(claim, expectedAt) {
  for (const field of TRANSIENT_CLAIM_FIELDS) assert.equal(claim[field], null, field);
  assert.equal(new Date(claim.sensitiveDataPurgedAt).getTime(), expectedAt.getTime());
}
const META_ENV = Object.freeze({
  NEXT_PUBLIC_APP_URL: 'https://obrasaas-preview.example.test',
  NEXT_PUBLIC_META_APP_ID: '123456789012345',
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: '234567890123456',
  META_APP_SECRET: 'meta-app-secret',
  META_VERIFY_TOKEN: 'meta-verify-token',
  WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'credentials-key',
  WORKER_ONBOARDING_FLOW_TOKEN_SECRET: FLOW_SECRET,
});

function access(overrides = {}) {
  return {
    organization: { id: 'organization-a' },
    project: { id: 'project-a' },
    tenantMembershipId: 'membership-a',
    databaseUserId: 'user-a',
    tenantRole: 'ADMIN',
    ...overrides,
  };
}

function readiness({ account = {} } = {}) {
  return {
    checks: {
      platform: { configured: true },
      account: {
        linked: true,
        enabled: true,
        tokenStatus: 'VALID',
        scopesVerified: true,
        phoneStatus: 'REGISTERED',
        qualityStatus: 'HEALTHY',
        providerStatus: 'HEALTHY',
        ...account,
      },
      webhook: { subscriptionStatus: 'SUBSCRIBED' },
      flows: {
        configured: true,
        endpointStatus: 'HEALTHY',
        publishedCount: 1,
      },
    },
  };
}

function publishedFlow() {
  return {
    blueprintKey: 'worker-onboarding',
    id: '345678901234567',
    name: 'obrasaas_worker_onboarding',
    screenId: 'WORKER_ONBOARDING',
    flowType: 'worker_onboarding',
    flowAction: 'data_exchange',
  };
}

function databaseDouble({
  inboundAt = new Date(NOW.getTime() - 30 * 60 * 1_000),
  inboundMetadata = {},
  resolvedStatus = 'UNKNOWN',
  healthCheckedAt = NOW,
} = {}) {
  const store = {
    project: {
      id: 'project-a',
      organizationId: 'organization-a',
      name: 'Obra A',
      status: 'ACTIVE',
      organization: {
        id: 'organization-a',
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: 'PRO',
        trialEndsAt: null,
      },
    },
    connection: {
      id: 'connection-a',
      projectId: 'project-a',
      phoneNumberId: '456789012345678',
      whatsappBusinessId: '567890123456789',
      enabled: true,
      connectionStatus: 'CONNECTED',
      encryptedAccessToken: 'ciphertext',
      updatedAt: NOW,
      metadata: {
        whatsappFlows: {},
        ...(healthCheckedAt
          ? {
              channelHealth: {
                version: 1,
                checkedAt: new Date(healthCheckedAt).toISOString(),
              },
            }
          : {}),
      },
      flowEndpoint: { id: 'endpoint-a', enabled: true, keys: [] },
    },
    conversation: {
      id: 'conversation-a',
      projectId: 'project-a',
      channel: 'whatsapp',
      externalId: 'meta:5491155551212',
      displayName: 'Contacto sin asignar',
      updatedAt: NOW,
    },
    inbound: {
      id: 'inbound-a',
      externalId: 'wamid.inbound-a',
      direction: 'INBOUND',
      sentAt: inboundAt,
      createdAt: inboundAt,
      metadata: {
        provider: 'meta',
        from: '+5491155551212',
        phoneNumberId: '456789012345678',
        quarantined: true,
        contactStatus: 'UNASSIGNED',
        workerResolution: 'UNKNOWN',
        ...inboundMetadata,
      },
    },
    outbound: [],
    claims: new Map(),
    sessions: new Map(),
    audits: [],
    locks: [],
    providerCalls: [],
    connectionLeaseAcquisitions: 0,
    connectionLeaseReleases: 0,
    connectionLeaseHeld: false,
    claimIssuerCalls: 0,
    sessionCounter: 0,
    messageCounter: 0,
    claimCounter: 0,
    resolvedStatus,
    approvedWorker: null,
  };

  const prisma = {
    async $transaction(callback) {
      return callback(prisma);
    },
    async $executeRawUnsafe(_query, key) {
      store.locks.push(key);
      return 1;
    },
    project: {
      async findFirst(args) {
        if (args.where.id !== store.project.id) return null;
        if (args.where.organizationId !== store.project.organizationId) return null;
        return structuredClone(store.project);
      },
    },
    conversation: {
      async findFirst(args) {
        return args.where.id === store.conversation.id
          && args.where.projectId === store.conversation.projectId
          ? structuredClone(store.conversation)
          : null;
      },
      async update(args) {
        store.conversation = { ...store.conversation, ...args.data };
        return structuredClone(store.conversation);
      },
    },
    whatsAppConnection: {
      async findUnique(args) {
        return args.where.projectId === store.connection.projectId
          ? structuredClone(store.connection)
          : null;
      },
      async findFirst(args) {
        return args.where.id === store.connection.id
          && args.where.projectId === store.connection.projectId
          ? structuredClone(store.connection)
          : null;
      },
    },
    message: {
      async findFirst(args) {
        if (args.where.direction === 'INBOUND') return structuredClone(store.inbound);
        const latest = store.outbound.at(-1) || null;
        return latest ? structuredClone(latest) : null;
      },
      async findUnique(args) {
        const message = args.where.externalId
          ? store.outbound.find((item) => item.externalId === args.where.externalId)
          : store.outbound.find((item) => item.id === args.where.id);
        return message ? structuredClone(message) : null;
      },
      async create(args) {
        const message = {
          id: `message-${++store.messageCounter}`,
          createdAt: args.data.sentAt || NOW,
          providerMessageId: null,
          ...structuredClone(args.data),
        };
        store.outbound.push(message);
        return structuredClone(message);
      },
      async update(args) {
        const index = store.outbound.findIndex((item) => item.id === args.where.id);
        assert.notEqual(index, -1);
        store.outbound[index] = { ...store.outbound[index], ...structuredClone(args.data) };
        return structuredClone(store.outbound[index]);
      },
      async updateMany(args) {
        const index = store.outbound.findIndex((item) => item.id === args.where.id);
        if (index === -1) return { count: 0 };
        store.outbound[index] = { ...store.outbound[index], ...structuredClone(args.data) };
        return { count: 1 };
      },
    },
    workerOnboardingClaim: {
      async findFirst(args) {
        const claim = store.claims.get(args.where.id);
        if (!claim) return null;
        if (args.where.organizationId && args.where.organizationId !== claim.organizationId) return null;
        if (args.where.projectId && args.where.projectId !== claim.projectId) return null;
        return structuredClone(claim);
      },
      async updateMany(args) {
        const claim = store.claims.get(args.where.id);
        if (!claim || (args.where.status && claim.status !== args.where.status)) {
          return { count: 0 };
        }
        const increment = Number(args.data.revision?.increment || 0);
        Object.assign(claim, {
          ...structuredClone(args.data),
          revision: claim.revision + increment,
        });
        return { count: 1 };
      },
    },
    workerOnboardingFlowSession: {
      async findUnique(args) {
        const session = store.sessions.get(args.where.id);
        return session ? structuredClone(session) : null;
      },
    },
    worker: {
      async findFirst(args) {
        const worker = store.approvedWorker;
        return worker
          && args.where.id === worker.id
          && args.where.organizationId === worker.organizationId
          && args.where.projectId === worker.projectId
          && args.where.active === worker.active
          ? { id: worker.id }
          : null;
      },
    },
    auditLog: {
      async count() {
        return 0;
      },
      async create(args) {
        store.audits.push(structuredClone(args.data));
        return structuredClone(args.data);
      },
    },
  };

  const dependencies = {
    env: META_ENV,
    flowSessionSecret: FLOW_SECRET,
    clock: () => new Date(NOW),
    deriveReadiness: readiness,
    resolvePublishedFlow: publishedFlow,
    async resolveWorker() {
      return {
        status: store.resolvedStatus,
        worker: store.resolvedStatus === 'RESOLVED' ? { id: 'worker-a' } : null,
        normalizedPhone: '+5491155551212',
      };
    },
    async claimIssuer(database, input, reserve) {
      store.claimIssuerCalls += 1;
      const claim = {
        id: `claim-${++store.claimCounter}`,
        organizationId: input.scope.organizationId,
        projectId: input.scope.projectId,
        connectionId: input.connectionId,
        senderEncryptedPayload: 'encrypted-sender',
        senderFingerprint: 'a'.repeat(64),
        senderFingerprintKeyId: 'fingerprint-key-v1',
        senderLastFour: '1212',
        senderWrappingKeyId: 'wrapping-key-v1',
        senderRecordVersion: 1,
        claimedIdentityEncryptedPayload: null,
        claimedCuilFingerprint: null,
        claimedCuilFingerprintKeyId: null,
        claimedCuilLastFour: null,
        claimedIdentityWrappingKeyId: null,
        claimedIdentityRecordVersion: null,
        sensitiveDataPurgedAt: null,
        openClaimKey: 'c'.repeat(64),
        status: 'PENDING',
        revision: 0,
        expiresAt: input.expiresAt,
        createdAt: input.now,
      };
      store.claims.set(claim.id, claim);
      const reservation = await reserve(database, {
        claim,
        sender: input.sender,
        scope: input.scope,
        connectionId: input.connectionId,
        expiresAt: input.expiresAt,
        currentTime: input.now,
        replayed: false,
      });
      return { claim: structuredClone(claim), reservation };
    },
    async issueSession(_database, input, options) {
      const session = {
        id: `00000000-0000-4000-8000-${String(++store.sessionCounter).padStart(12, '0')}`,
        ...structuredClone(input),
        expiresAt: new Date(options.now.getTime() + options.ttlMs),
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        submittedAt: null,
      };
      store.sessions.set(session.id, session);
      return { session: structuredClone(session), token: `wofs1.${session.id}.token` };
    },
    async getSessionForDelivery(_database, input) {
      const session = store.sessions.get(input.sessionId);
      assert.ok(session);
      assert.equal(input.claimId, session.claimId);
      return { session: structuredClone(session), token: `wofs1.${session.id}.token` };
    },
    async markDeliveryAttempted(_database, input, options) {
      const session = store.sessions.get(input.sessionId);
      const alreadyAttempted = Boolean(session.deliveryAttemptedAt);
      if (!alreadyAttempted) session.deliveryAttemptedAt = options.now;
      return { session: structuredClone(session), alreadyAttempted };
    },
    async markDeliveryRejected(_database, input, options) {
      const session = store.sessions.get(input.sessionId);
      session.deliveryRejectedAt = options.now;
      return { session: structuredClone(session), alreadyRejected: false };
    },
    async markSessionSent(_database, input, options) {
      const session = store.sessions.get(input.sessionId);
      session.sentAt = options.now;
      session.providerMessageId = input.providerMessageId;
      return { session: structuredClone(session), alreadySent: false };
    },
    async acquireConnectionLease(_database, input) {
      assert.equal(input.connectionId, store.connection.id);
      assert.equal(input.operationKey, 'worker-onboarding-delivery');
      if (input.expectedUpdatedAt.getTime() !== store.connection.updatedAt.getTime()) {
        throw Object.assign(new Error('The connection changed before lease acquisition.'), {
          code: 'WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED',
          status: 409,
        });
      }
      assert.deepEqual(input.expectedConnectionIdentity, {
        phoneNumberId: store.connection.phoneNumberId,
        whatsappBusinessId: store.connection.whatsappBusinessId,
        encryptedAccessToken: store.connection.encryptedAccessToken,
      });
      assert.equal(input.requireActive, true);
      assert.equal(store.connectionLeaseHeld, false);
      store.connectionLeaseAcquisitions += 1;
      store.connectionLeaseHeld = true;
      return {
        lease: { id: '11111111-1111-4111-8111-111111111111' },
        metadata: structuredClone(store.connection.metadata),
      };
    },
    async releaseConnectionLease(_database, input) {
      assert.deepEqual(input, {
        connectionId: store.connection.id,
        leaseId: '11111111-1111-4111-8111-111111111111',
      });
      assert.equal(store.connectionLeaseHeld, true);
      store.connectionLeaseReleases += 1;
      store.connectionLeaseHeld = false;
      return true;
    },
  };

  return { prisma, store, dependencies };
}

test('reserves claim, pre-worker session, message and audit before one direct data_exchange send', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  const result = await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-stable-a',
    ...dependencies,
    async sendFlow(input) {
      assert.equal(store.connectionLeaseHeld, true);
      store.providerCalls.push(structuredClone(input));
      assert.equal(store.outbound[0].status, 'sending');
      assert.ok(store.sessions.get(store.outbound[0].metadata.workerOnboardingFlowSessionId)
        .deliveryAttemptedAt);
      return { messages: [{ id: 'wamid.onboarding-a' }] };
    },
  });

  assert.equal(result.idempotent, false);
  assert.equal(result.invitation.status, 'accepted');
  assert.equal(store.providerCalls.length, 1);
  assert.equal(store.connectionLeaseAcquisitions, 1);
  assert.equal(store.connectionLeaseReleases, 1);
  assert.equal(store.connectionLeaseHeld, false);
  assert.equal(store.providerCalls[0].flowAction, 'data_exchange');
  assert.equal(store.providerCalls[0].to, '+5491155551212');
  assert.equal(store.providerCalls[0].scope.organizationId, 'organization-a');
  const reservedSession = [...store.sessions.values()][0];
  assert.equal(reservedSession.noticeVersion, CURRENT_NOTICE.version);
  assert.equal(reservedSession.noticeContentSha256, CURRENT_NOTICE.contentSha256);
  assert.equal(store.outbound[0].providerMessageId, 'wamid.onboarding-a');
  assert.equal(store.audits[0].action, 'worker.onboarding.invitation_requested');
  assert.equal(JSON.stringify(store.outbound[0].metadata).includes('5491155551212'), false);
  assert.equal(JSON.stringify(store.audits).includes('5491155551212'), false);
  assert.equal(JSON.stringify(store.outbound[0]).includes(FLOW_SECRET), false);

  const replay = await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-stable-a',
    ...dependencies,
    flowSessionSecret: '',
    async sendFlow(input) {
      store.providerCalls.push(input);
      throw new Error('An idempotent replay must not call Meta.');
    },
  });
  assert.equal(replay.idempotent, true);
  assert.equal(replay.invitation.status, 'accepted');
  assert.equal(store.providerCalls.length, 1);
  assert.equal(store.claimIssuerCalls, 1);
});

test('remote health preflight fails closed before reserving or sending', async (t) => {
  await t.test('missing remote evidence', async () => {
    const { prisma, store, dependencies } = databaseDouble({ healthCheckedAt: null });
    const state = await getWorkerOnboardingInvitationState({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      ...dependencies,
    });
    assert.equal(state.capability.code, 'WHATSAPP_REMOTE_HEALTH_EVIDENCE_REQUIRED');

    await assert.rejects(
      sendWorkerOnboardingInvitation({
        prisma,
        access: access(),
        conversationId: 'conversation-a',
        idempotencyKey: 'onboarding-no-health-a',
        ...dependencies,
        sendFlow: async () => assert.fail('Missing evidence must not call Meta.'),
      }),
      (error) => (
        error.code === 'WHATSAPP_REMOTE_HEALTH_EVIDENCE_REQUIRED'
        && error.status === 409
      ),
    );
    assert.equal(store.claimIssuerCalls, 0);
    assert.equal(store.claims.size, 0);
    assert.equal(store.sessions.size, 0);
    assert.equal(store.outbound.length, 0);
    assert.equal(store.audits.length, 0);
  });

  await t.test('stale remote evidence', async () => {
    const { prisma, store, dependencies } = databaseDouble({
      healthCheckedAt: new Date(NOW.getTime() - WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS - 1),
    });
    const state = await getWorkerOnboardingInvitationState({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      ...dependencies,
    });
    assert.equal(state.capability.code, 'WHATSAPP_REMOTE_HEALTH_EVIDENCE_STALE');
    assert.match(state.capability.reason, /Meta desde Integraciones/);

    await assert.rejects(
      sendWorkerOnboardingInvitation({
        prisma,
        access: access(),
        conversationId: 'conversation-a',
        idempotencyKey: 'onboarding-stale-health-a',
        ...dependencies,
        sendFlow: async () => assert.fail('Stale evidence must not call Meta.'),
      }),
      (error) => (
        error.code === 'WHATSAPP_REMOTE_HEALTH_EVIDENCE_STALE'
        && error.status === 409
      ),
    );
    assert.equal(store.claimIssuerCalls, 0);
    assert.equal(store.claims.size, 0);
    assert.equal(store.sessions.size, 0);
    assert.equal(store.outbound.length, 0);
    assert.equal(store.audits.length, 0);
  });

  await t.test('fresh but degraded provider evidence', async () => {
    const { prisma, store, dependencies } = databaseDouble();
    const degradedDependencies = {
      ...dependencies,
      deriveReadiness: () => readiness({ account: { providerStatus: 'DEGRADED' } }),
    };
    const state = await getWorkerOnboardingInvitationState({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      ...degradedDependencies,
    });
    assert.equal(state.capability.code, 'WHATSAPP_CONNECTION_NOT_OPERATIONAL');

    await assert.rejects(
      sendWorkerOnboardingInvitation({
        prisma,
        access: access(),
        conversationId: 'conversation-a',
        idempotencyKey: 'onboarding-degraded-health-a',
        ...degradedDependencies,
        sendFlow: async () => assert.fail('Degraded evidence must not call Meta.'),
      }),
      (error) => (
        error.code === 'WHATSAPP_CONNECTION_NOT_OPERATIONAL'
        && error.status === 409
      ),
    );
    assert.equal(store.claimIssuerCalls, 0);
    assert.equal(store.claims.size, 0);
    assert.equal(store.sessions.size, 0);
    assert.equal(store.outbound.length, 0);
    assert.equal(store.audits.length, 0);
  });
});

test('a concurrent local health degradation loses the lease CAS before the delivery attempt', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  let providerCalls = 0;

  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-health-race-a',
      ...dependencies,
      async acquireConnectionLease(...args) {
        store.connection.metadata.channelHealth.providerStatus = 'DEGRADED';
        store.connection.updatedAt = new Date(store.connection.updatedAt.getTime() + 1);
        return dependencies.acquireConnectionLease(...args);
      },
      async sendFlow() {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-send-after-health-race' }] };
      },
    }),
    (error) => (
      error.code === 'WORKER_ONBOARDING_INVITATION_PREPARATION_FAILED'
      && error.status === 409
    ),
  );

  assert.equal(providerCalls, 0);
  assert.equal(store.connectionLeaseAcquisitions, 0);
  assert.equal(store.connectionLeaseHeld, false);
  assert.equal([...store.sessions.values()][0].deliveryAttemptedAt, null);
  assert.equal(store.connection.metadata.channelHealth.providerStatus, 'DEGRADED');
  assert.equal(store.outbound[0].status, 'failed');
});

test('missing WAMID is unknown, preserves the open claim, and is never auto-retried', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  let providerCalls = 0;
  const send = () => sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-unknown-a',
    ...dependencies,
    async sendFlow() {
      providerCalls += 1;
      return {};
    },
  });

  await assert.rejects(send(), (error) => (
    error instanceof WorkerOnboardingInvitationError
    && error.code === 'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN'
    && error.status === 502
  ));
  assert.equal(store.outbound[0].status, 'unknown');
  assert.equal([...store.claims.values()][0].status, 'PENDING');
  assert.equal(providerCalls, 1);

  store.connection.metadata.channelHealth.checkedAt = new Date(
    NOW.getTime() - WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS - 1,
  ).toISOString();
  const replay = await send();
  assert.equal(replay.idempotent, true);
  assert.equal(replay.invitation.status, 'unknown');
  assert.equal(providerCalls, 1);

  store.connection.metadata.channelHealth.checkedAt = NOW.toISOString();
  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-new-key-a',
      ...dependencies,
      async sendFlow() {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-send' }] };
      },
    }),
    (error) => error.code === 'WORKER_ONBOARDING_INVITATION_DELIVERY_UNRESOLVED',
  );
  assert.equal(providerCalls, 1);
});

test('same key recovers a stale untouched reservation but never before the stale fence', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  let current = new Date(NOW);
  await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-crash-recovery-a',
    ...dependencies,
    clock: () => new Date(current),
    sendFlow: async () => ({ messages: [{ id: 'wamid.seed-recovery-a' }] }),
  });
  const message = store.outbound[0];
  const session = [...store.sessions.values()][0];
  message.status = 'sending';
  message.providerMessageId = null;
  session.deliveryAttemptedAt = null;
  session.deliveryRejectedAt = null;
  session.sentAt = null;
  session.providerMessageId = null;
  let recoveryProviderCalls = 0;

  current = new Date(NOW.getTime() + 60_000);
  const recentReplay = await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-crash-recovery-a',
    ...dependencies,
    clock: () => new Date(current),
    async sendFlow() {
      recoveryProviderCalls += 1;
      return { messages: [{ id: 'must-not-send-before-stale' }] };
    },
  });
  assert.equal(recentReplay.idempotent, true);
  assert.equal(recentReplay.invitation.status, 'sending');
  assert.equal(recoveryProviderCalls, 0);

  current = new Date(NOW.getTime() + 3 * 60_000);
  store.connection.metadata.channelHealth.checkedAt = new Date(
    current.getTime() - WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS - 1,
  ).toISOString();
  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-crash-recovery-a',
      ...dependencies,
      clock: () => new Date(current),
      sendFlow: async () => {
        recoveryProviderCalls += 1;
        return { messages: [{ id: 'must-not-send-with-stale-health' }] };
      },
    }),
    (error) => error.code === 'WHATSAPP_REMOTE_HEALTH_EVIDENCE_STALE',
  );
  assert.equal(recoveryProviderCalls, 0);
  assert.equal(session.deliveryAttemptedAt, null);

  store.connection.metadata.channelHealth.checkedAt = current.toISOString();
  const recovered = await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-crash-recovery-a',
    ...dependencies,
    clock: () => new Date(current),
    async sendFlow(input) {
      recoveryProviderCalls += 1;
      store.providerCalls.push(structuredClone(input));
      return { messages: [{ id: 'wamid.recovered-a' }] };
    },
  });
  assert.equal(recovered.idempotent, true);
  assert.equal(recovered.invitation.status, 'accepted');
  assert.equal(recoveryProviderCalls, 1);
  assert.equal(store.claimIssuerCalls, 1);
  assert.ok(session.deliveryAttemptedAt);
  assert.equal(session.providerMessageId, 'wamid.recovered-a');
});

test('an untouched expired reservation is reconciled and requires a new operation', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-expired-a',
    ...dependencies,
    sendFlow: async () => ({ messages: [{ id: 'wamid.seed-expired-a' }] }),
  });
  const message = store.outbound[0];
  const claim = [...store.claims.values()][0];
  const session = [...store.sessions.values()][0];
  message.status = 'sending';
  message.providerMessageId = null;
  session.deliveryAttemptedAt = null;
  session.deliveryRejectedAt = null;
  session.sentAt = null;
  session.providerMessageId = null;
  claim.status = 'PENDING';
  let providerCalls = 0;
  const afterExpiry = new Date(NOW.getTime() + 61 * 60_000);
  store.connection.metadata.channelHealth.checkedAt = afterExpiry.toISOString();

  const expiredState = await getWorkerOnboardingInvitationState({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    ...dependencies,
    clock: () => new Date(afterExpiry),
  });
  assert.equal(expiredState.state, 'eligible');
  assert.equal(expiredState.capability.code, 'READY');

  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-expired-a',
      ...dependencies,
      clock: () => new Date(afterExpiry),
      async sendFlow() {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-send-expired' }] };
      },
    }),
    (error) => (
      error.code === 'WORKER_ONBOARDING_INVITATION_EXPIRED'
      && error.status === 410
    ),
  );
  assert.equal(providerCalls, 0);
  assert.equal(claim.status, 'EXPIRED');
  assert.equal(claim.openClaimKey, null);
  assertTransientClaimPurged(claim, afterExpiry);
  assert.equal(store.outbound[0].status, 'failed');
  assert.equal(
    store.outbound[0].metadata.failureCode,
    'WORKER_ONBOARDING_INVITATION_EXPIRED',
  );

  const replacement = await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-expired-replacement-a',
    ...dependencies,
    clock: () => new Date(afterExpiry),
    async sendFlow() {
      providerCalls += 1;
      return { messages: [{ id: 'wamid.expired-replacement-a' }] };
    },
  });
  assert.equal(replacement.invitation.status, 'accepted');
  assert.equal(providerCalls, 1);
  assert.equal(store.claimIssuerCalls, 2);
});

test('definitive Meta rejection fences the session and cancels the claim so GET becomes eligible', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-rejected-a',
      ...dependencies,
      async sendFlow() {
        throw Object.assign(new Error('Meta rejected'), {
          code: 'META_FLOW_REJECTED',
          status: 400,
        });
      },
    }),
    (error) => (
      error.code === 'WORKER_ONBOARDING_INVITATION_DELIVERY_REJECTED'
      && error.status === 502
    ),
  );

  const claim = [...store.claims.values()][0];
  const session = [...store.sessions.values()][0];
  assert.equal(store.connectionLeaseAcquisitions, 1);
  assert.equal(store.connectionLeaseReleases, 1);
  assert.equal(store.connectionLeaseHeld, false);
  assert.equal(store.outbound[0].status, 'failed');
  assert.equal(claim.status, 'CANCELLED');
  assert.equal(claim.openClaimKey, null);
  assert.equal(claim.revision, 1);
  assertTransientClaimPurged(claim, NOW);
  assert.ok(session.deliveryRejectedAt);

  const state = await getWorkerOnboardingInvitationState({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    ...dependencies,
  });
  assert.equal(state.state, 'eligible');
  assert.equal(state.capability.code, 'READY');
  assert.equal(state.invitation.claimStatus, 'CANCELLED');
});

test('approved scoped claim remains authorized when the privacy-minimal receipt has no sender metadata', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-approved-a',
    ...dependencies,
    sendFlow: async () => ({ messages: [{ id: 'wamid.approved-a' }] }),
  });
  const claim = [...store.claims.values()][0];
  claim.status = 'APPROVED';
  claim.resolvedWorkerId = 'worker-approved-a';
  store.approvedWorker = {
    id: 'worker-approved-a',
    organizationId: 'organization-a',
    projectId: 'project-a',
    active: true,
  };
  store.inbound = {
    ...store.inbound,
    id: 'privacy-minimal-receipt-a',
    metadata: { provider: 'meta', receiptType: 'worker_onboarding_submitted' },
  };

  const state = await getWorkerOnboardingInvitationState({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    ...dependencies,
  });
  assert.equal(state.state, 'authorized');
  assert.equal(state.capability.code, 'WORKER_ONBOARDING_CONTACT_ALREADY_AUTHORIZED');
  assert.equal(JSON.stringify(state).includes('5491155551212'), false);
});

test('cross-bound session correlation is conflict and never a valid idempotent replay', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  await sendWorkerOnboardingInvitation({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    idempotencyKey: 'onboarding-binding-a',
    ...dependencies,
    sendFlow: async () => ({ messages: [{ id: 'wamid.binding-a' }] }),
  });
  const session = [...store.sessions.values()][0];
  session.connectionId = 'connection-cross-tenant';

  const state = await getWorkerOnboardingInvitationState({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    ...dependencies,
  });
  assert.equal(state.state, 'conflict');
  assert.equal(state.capability.code, 'WORKER_ONBOARDING_INVITATION_STATE_CORRUPT');
  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-binding-a',
      ...dependencies,
      sendFlow: async () => assert.fail('A corrupt replay must not call Meta.'),
    }),
    (error) => error.code === 'WORKER_ONBOARDING_INVITATION_STATE_CORRUPT',
  );
});

test('pre-provider scope failure closes the claim under a retry-safe preparation code', async () => {
  const { prisma, store, dependencies } = databaseDouble();
  let providerCalls = 0;
  await assert.rejects(
    sendWorkerOnboardingInvitation({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      idempotencyKey: 'onboarding-preparation-a',
      ...dependencies,
      getSessionForDelivery: async () => {
        throw new WorkerOnboardingInvitationError('Scope changed.', {
          code: 'WORKER_ONBOARDING_INVITATION_SCOPE_CHANGED',
          status: 409,
        });
      },
      async sendFlow() {
        providerCalls += 1;
        return { messages: [{ id: 'must-not-send' }] };
      },
    }),
    (error) => (
      error.code === 'WORKER_ONBOARDING_INVITATION_PREPARATION_FAILED'
      && error.status === 409
    ),
  );
  assert.equal(providerCalls, 0);
  assert.equal(store.outbound[0].status, 'failed');
  const claim = [...store.claims.values()][0];
  assert.equal(claim.status, 'CANCELLED');
  assertTransientClaimPurged(claim, NOW);
});

test('state closes outside 24h and reports authorized or conflict without exposing a phone', async (t) => {
  await t.test('closed window', async () => {
    const { prisma, dependencies } = databaseDouble({
      inboundAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1_000),
    });
    const state = await getWorkerOnboardingInvitationState({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      ...dependencies,
    });
    assert.equal(state.state, 'closed');
    assert.equal(state.capability.code, 'WHATSAPP_CUSTOMER_SERVICE_WINDOW_CLOSED');
    assert.equal(JSON.stringify(state).includes('5491155551212'), false);
  });

  await t.test('authorized', async () => {
    const { prisma, dependencies } = databaseDouble({ resolvedStatus: 'RESOLVED' });
    const state = await getWorkerOnboardingInvitationState({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      ...dependencies,
    });
    assert.equal(state.state, 'authorized');
    assert.equal(state.capability.code, 'WORKER_ONBOARDING_CONTACT_ALREADY_AUTHORIZED');
  });

  await t.test('ambiguous', async () => {
    const { prisma, dependencies } = databaseDouble({ resolvedStatus: 'AMBIGUOUS' });
    const state = await getWorkerOnboardingInvitationState({
      prisma,
      access: access(),
      conversationId: 'conversation-a',
      canManage: true,
      ...dependencies,
    });
    assert.equal(state.state, 'conflict');
    assert.equal(state.capability.code, 'WORKER_ONBOARDING_CONTACT_IDENTITY_CONFLICT');
  });
});

test('readiness requires the dedicated pre-worker HMAC secret, not the operational Flow key', async () => {
  const { prisma, dependencies } = databaseDouble();
  const withoutExplicitSecret = { ...dependencies };
  delete withoutExplicitSecret.flowSessionSecret;
  const state = await getWorkerOnboardingInvitationState({
    prisma,
    access: access(),
    conversationId: 'conversation-a',
    canManage: true,
    ...withoutExplicitSecret,
    env: {
      ...META_ENV,
      WORKER_ONBOARDING_FLOW_TOKEN_SECRET: undefined,
      WHATSAPP_FLOW_TOKEN_SECRET: FLOW_SECRET,
    },
  });
  assert.equal(state.state, 'closed');
  assert.equal(state.capability.code, 'WORKER_ONBOARDING_FLOW_TOKEN_SECRET_REQUIRED');
});

function routeRequest({ method = 'GET', query = 'projectId=project-a', key, body } = {}) {
  const headers = {};
  if (key) headers['idempotency-key'] = key;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`https://obrasaas.example.test/api/whatsapp/inbox/conversation-a/worker-onboarding?${query}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function routeContext() {
  return { params: Promise.resolve({ conversationId: 'conversation-a' }) };
}

test('route accepts bodyless POST, derives scope server-side, and rejects client identity fields', async () => {
  const permissions = [];
  const sends = [];
  const prisma = {
    project: {
      async findFirst(args) {
        return args.where.id === 'project-a'
          && args.where.organizationId === 'organization-a'
          ? { id: 'project-a' }
          : null;
      },
    },
  };
  const handlers = createWorkerOnboardingInvitationHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission, options) => permissions.push([permission, options]),
    prismaFactory: () => prisma,
    resolveCorrelationId: () => 'correlation-a',
    sendInvitation: async (input) => {
      sends.push(input);
      return { conversationId: input.conversationId, idempotent: false };
    },
    loadState: async () => ({ state: 'eligible' }),
    clock: () => NOW,
    env: META_ENV,
  });

  const sent = await handlers.POST(routeRequest({
    method: 'POST',
    key: 'onboarding-route-a',
  }), routeContext());
  assert.equal(sent.status, 200);
  assert.equal(sent.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(sent.headers.get('x-request-id'), 'correlation-a');
  assert.equal(sends.length, 1);
  assert.equal(sends[0].conversationId, 'conversation-a');
  assert.equal(sends[0].idempotencyKey, 'onboarding-route-a');
  assert.equal(sends[0].access.organization.id, 'organization-a');
  assert.equal(Object.hasOwn(sends[0], 'phone'), false);
  assert.equal(Object.hasOwn(sends[0], 'token'), false);

  const injected = await handlers.POST(routeRequest({
    method: 'POST',
    key: 'onboarding-route-b',
    body: { phone: '+5491111111111' },
  }), routeContext());
  assert.equal(injected.status, 400);
  assert.equal((await injected.json()).code, 'WORKER_ONBOARDING_INVITATION_BODY_NOT_EMPTY');
  assert.equal(sends.length, 1);

  const emptyJson = await handlers.POST(routeRequest({
    method: 'POST',
    key: 'onboarding-route-empty',
    body: {},
  }), routeContext());
  assert.equal(emptyJson.status, 200);
  assert.equal(sends.length, 2);

  const mismatched = await handlers.POST(routeRequest({
    method: 'POST',
    query: 'projectId=project-b',
    key: 'onboarding-route-c',
  }), routeContext());
  assert.equal(mismatched.status, 403);
  assert.equal(sends.length, 2);
  assert.deepEqual(permissions.map(([permission]) => permission), [
    'org:workers:onboarding:manage',
    'org:workers:onboarding:manage',
    'org:workers:onboarding:manage',
    'org:workers:onboarding:manage',
  ]);
});

test('route GET uses awaited params, exact active project and no-store state response', async () => {
  const loads = [];
  const handlers = createWorkerOnboardingInvitationHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => ({
      project: { findFirst: async () => ({ id: 'project-a' }) },
    }),
    resolveCorrelationId: () => 'correlation-get-a',
    loadState: async (input) => {
      loads.push(input);
      return { state: 'eligible', capability: { allowed: true, code: 'READY' } };
    },
    clock: () => NOW,
    env: META_ENV,
  });
  const response = await handlers.GET(routeRequest(), routeContext());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal((await response.json()).state, 'eligible');
  assert.equal(loads.length, 1);
  assert.equal(loads[0].conversationId, 'conversation-a');
});
