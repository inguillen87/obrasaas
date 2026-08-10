import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

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

const { MetaIntegrationError } = await import('../src/lib/whatsapp/embedded-signup.js');
const { createWhatsAppHealthHandlers } = await import(
  '../src/app/api/integrations/whatsapp/health/route.js'
);

const NOW = new Date('2026-07-17T18:00:00.000Z');
const ACCESS = Object.freeze({
  databaseUserId: 'actor-a',
  organization: { id: 'organization-a' },
  project: { id: 'project-a' },
});
const PUBLIC_HEALTH = Object.freeze({
  readiness: {
    state: 'WEBHOOK_PENDING',
    label: 'Prueba operativa pendiente',
    checks: { account: { tokenStatus: 'VALID' } },
  },
  diagnostics: {
    checkedAt: NOW.toISOString(),
    pendingEvents: 0,
    failedEvents: 0,
  },
});

function connection(overrides = {}) {
  return {
    id: 'connection-a',
    phoneNumberId: '123456789',
    whatsappBusinessId: '987654321',
    encryptedAccessToken: 'encrypted-token',
    enabled: true,
    connectionStatus: 'CONNECTED',
    updatedAt: new Date('2026-07-17T17:59:00.000Z'),
    ...overrides,
  };
}

function handlerDeps(overrides = {}) {
  const commits = [];
  const audits = [];
  const prisma = {
    whatsAppConnection: {
      async findUnique() {
        return connection();
      },
    },
  };
  const dependencies = {
    resolveAccess: async () => ACCESS,
    authorize: () => undefined,
    prismaFactory: () => prisma,
    decrypt: (value) => {
      assert.equal(value, 'encrypted-token');
      return 'plain-token';
    },
    verifyRemote: async ({ accessToken, whatsappBusinessId, phoneNumberId }) => {
      assert.deepEqual({ accessToken, whatsappBusinessId, phoneNumberId }, {
        accessToken: 'plain-token',
        whatsappBusinessId: '987654321',
        phoneNumberId: '123456789',
      });
      return {
        expiresAt: 0,
        scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
        subscribed: true,
        phoneStatus: 'CONNECTED',
        verificationStatus: 'VERIFIED',
        qualityRating: 'GREEN',
        displayPhoneNumber: '+54 9 11 5555 5555',
        verifiedBusinessName: 'Constructora Sur',
      };
    },
    loadHealth: async (_prisma, options) => {
      assert.equal(options.projectId, 'project-a');
      return PUBLIC_HEALTH;
    },
    acquireLease: async (_prisma, options) => {
      assert.equal(options.connectionId, 'connection-a');
      assert.equal(options.operationKey, 'health_verify');
      assert.equal(options.expectedConnectionIdentity.encryptedAccessToken, 'encrypted-token');
      return {
        lease: { id: 'cc6b7bd1-51a3-4fc2-a593-ed241220b922' },
        connectionIdentity: {
          phoneNumberId: '123456789',
          whatsappBusinessId: '987654321',
          encryptedAccessTokenSha256: 'a'.repeat(64),
        },
      };
    },
    commitLease: async (_prisma, options) => {
      const data = options.buildConnectionData({ metadata: { preserved: true } });
      commits.push(data);
      if (options.createAuditLog) {
        await options.createAuditLog({
          auditLog: {
            async create(args) {
              audits.push(args.data);
              return args.data;
            },
          },
        });
      }
      return { data };
    },
    releaseLease: async () => true,
    clock: () => NOW,
    ...overrides,
  };
  return { audits, commits, dependencies, prisma };
}

test('GET exposes a private tenant-scoped, credential-free health projection', async () => {
  const projectIds = [];
  const { dependencies } = handlerDeps({
    loadHealth: async (_prisma, options) => {
      projectIds.push(options.projectId);
      return PUBLIC_HEALTH;
    },
  });
  const response = await createWhatsAppHealthHandlers(dependencies).GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.deepEqual(projectIds, ['project-a']);
  assert.deepEqual(payload, {
    health: PUBLIC_HEALTH.readiness,
    diagnostics: PUBLIC_HEALTH.diagnostics,
  });
  assert.equal(JSON.stringify(payload).includes('plain-token'), false);
  assert.equal(JSON.stringify(payload).includes('encrypted-token'), false);
});

test('POST verifies Meta remotely, commits a safe snapshot and audits the tenant mutation', async () => {
  const { audits, commits, dependencies } = handlerDeps();
  const response = await createWhatsAppHealthHandlers(dependencies).POST(new Request(
    'http://localhost/api/integrations/whatsapp/health',
    { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } },
  ));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].connectionStatus, 'CONNECTED');
  assert.equal(commits[0].metadata.preserved, true);
  assert.equal(commits[0].metadata.channelHealth.subscriptionStatus, 'SUBSCRIBED');
  assert.equal(commits[0].metadata.channelHealth.tokenStatus, 'VALID');
  assert.equal(audits[0].organizationId, 'organization-a');
  assert.equal(audits[0].metadata.projectId, 'project-a');
  assert.equal(audits[0].ipAddress, '203.0.113.10');
  assert.equal(JSON.stringify({ payload, commits, audits }).includes('plain-token'), false);
  assert.equal(JSON.stringify({ payload, commits, audits }).includes('encrypted-token'), false);
});

test('POST persists an unsubscribed provider state and returns the refreshed degraded model', async () => {
  const degraded = {
    readiness: { state: 'DEGRADED', nextAction: { code: 'SUBSCRIBE_WEBHOOK' } },
    diagnostics: PUBLIC_HEALTH.diagnostics,
  };
  const { audits, commits, dependencies } = handlerDeps({
    verifyRemote: async () => {
      throw new MetaIntegrationError('Meta no confirmó la suscripción.', {
        code: 'META_APP_NOT_SUBSCRIBED',
        status: 409,
      });
    },
    loadHealth: async () => degraded,
  });
  const response = await createWhatsAppHealthHandlers(dependencies).POST(new Request(
    'http://localhost/api/integrations/whatsapp/health',
    { method: 'POST' },
  ));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'META_APP_NOT_SUBSCRIBED');
  assert.equal(payload.health.state, 'DEGRADED');
  assert.equal(commits[0].metadata.channelHealth.subscriptionStatus, 'UNSUBSCRIBED');
  assert.equal(commits[0].metadata.channelHealth.providerStatus, 'DEGRADED');
  assert.equal(commits[0].lastError, 'META_APP_NOT_SUBSCRIBED');
  assert.equal(audits[0].action, 'integration.whatsapp.verification_failed');
});

test('POST redacts raw Meta credential failures in persistence and response', async () => {
  const rawProviderMessage = 'token secret-value belongs to +5492610000000';
  const { audits, commits, dependencies } = handlerDeps({
    verifyRemote: async () => {
      throw new MetaIntegrationError(rawProviderMessage, {
        code: 'META_190',
        status: 401,
      });
    },
    loadHealth: async () => ({
      readiness: { state: 'DEGRADED' },
      diagnostics: PUBLIC_HEALTH.diagnostics,
    }),
  });
  const response = await createWhatsAppHealthHandlers(dependencies).POST(new Request(
    'http://localhost/api/integrations/whatsapp/health',
    { method: 'POST' },
  ));
  const payload = await response.json();
  const serialized = JSON.stringify({ payload, commits, audits });

  assert.equal(response.status, 401);
  assert.equal(payload.code, 'META_190');
  assert.match(payload.error, /credencial de Meta venció/i);
  assert.equal(commits[0].lastError, 'META_190');
  assert.equal(commits[0].connectionStatus, 'ERROR');
  assert.equal(audits[0].metadata.code, 'META_190');
  assert.equal(serialized.includes('secret-value'), false);
  assert.equal(serialized.includes('+5492610000000'), false);
});

test('POST rejects missing or cross-tenant connection state before decrypting credentials', async () => {
  let decrypted = false;
  const { dependencies, prisma } = handlerDeps({
    decrypt: () => {
      decrypted = true;
      return 'unexpected';
    },
  });
  prisma.whatsAppConnection.findUnique = async (args) => {
    assert.deepEqual(args.where, { projectId: 'project-a' });
    return null;
  };

  const response = await createWhatsAppHealthHandlers(dependencies).POST(new Request(
    'http://localhost/api/integrations/whatsapp/health',
    { method: 'POST' },
  ));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'WHATSAPP_ACCOUNT_NOT_LINKED');
  assert.equal(decrypted, false);
});
