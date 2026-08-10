import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'mock:server-only', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:server-only') {
      return { format: 'module', shortCircuit: true, source: 'export {};' };
    }
    return nextLoad(url, context);
  },
});

const {
  inspectStoredWhatsAppGraphAccess,
  requireGraphReadyWhatsAppConnection,
} = await import('../src/lib/whatsapp/graph-access.js');
const { buildWhatsAppChannelHealthMetadata } = await import(
  '../src/lib/whatsapp/channel-health.js'
);

const NOW = new Date('2026-08-10T20:00:00.000Z');
const ENV = Object.freeze({
  META_APP_SECRET: 'meta-secret',
  WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'encryption-secret',
});

function connection(expiresAt = 0) {
  return {
    enabled: true,
    connectionStatus: 'CONNECTED',
    encryptedAccessToken: 'ciphertext',
    phoneNumberId: 'phone-a',
    whatsappBusinessId: 'waba-a',
    lastError: null,
    metadata: buildWhatsAppChannelHealthMetadata({}, {
      expiresAt,
      scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
      subscribed: true,
      phoneStatus: 'CONNECTED',
      verificationStatus: 'VERIFIED',
      qualityRating: 'GREEN',
    }, { now: NOW }),
  };
}

test('stored Graph access is ready only for a current verified credential', () => {
  assert.deepEqual(inspectStoredWhatsAppGraphAccess(connection(), {
    env: ENV,
    now: NOW,
  }), { ready: true, code: null });
});

test('an expired raw CONNECTED row fails with a stable reconnect code', async () => {
  const expired = connection(
    Math.floor(new Date('2026-08-10T19:59:59.000Z').getTime() / 1_000),
  );
  assert.deepEqual(inspectStoredWhatsAppGraphAccess(expired, {
    env: ENV,
    now: NOW,
  }), { ready: false, code: 'WHATSAPP_GRAPH_RECONNECT_REQUIRED' });

  const queries = [];
  const prisma = {
    whatsAppConnection: {
      async findUnique(args) {
        queries.push(args);
        return expired;
      },
    },
  };
  await assert.rejects(
    requireGraphReadyWhatsAppConnection(prisma, 'project-a', { env: ENV, now: NOW }),
    (error) => {
      assert.equal(error.code, 'WHATSAPP_GRAPH_RECONNECT_REQUIRED');
      assert.equal(error.status, 409);
      assert.equal(JSON.stringify(error).includes('ciphertext'), false);
      return true;
    },
  );
  assert.deepEqual(queries, [{ where: { projectId: 'project-a' } }]);
});

test('missing server cryptographic configuration fails before Graph use', () => {
  assert.deepEqual(inspectStoredWhatsAppGraphAccess(connection(), {
    env: {},
    now: NOW,
  }), { ready: false, code: 'WHATSAPP_GRAPH_CONFIGURATION_REQUIRED' });
});

test('Flow and template routes gate stored health before decrypt, lease or provider calls', async () => {
  const [flows, templates] = await Promise.all([
    readFile(new URL(
      '../src/app/api/integrations/whatsapp/flows/route.js',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL(
      '../src/app/api/integrations/whatsapp/templates/route.js',
      import.meta.url,
    ), 'utf8'),
  ]);

  for (const source of [flows, templates]) {
    assert.match(source, /requireGraphReadyWhatsAppConnection/);
    assert.match(source, /WhatsAppGraphAccessError/);
  }
  for (const source of [flows, templates]) {
    const getStart = source.indexOf('export async function GET');
    const postStart = source.indexOf('export async function POST');
    const handlers = [source.slice(getStart, postStart), source.slice(postStart)];
    for (const handler of handlers) {
      const gateIndex = handler.indexOf('requireGraphReadyWhatsAppConnection');
      const decryptIndex = handler.indexOf('decryptCredential');
      assert.ok(gateIndex >= 0);
      assert.ok(decryptIndex >= 0);
      assert.ok(gateIndex < decryptIndex);
      const leaseIndexes = [
        handler.indexOf('acquireWhatsAppConnectionLease'),
        handler.indexOf('acquireWhatsAppFlowProvisioningLease'),
      ].filter((index) => index >= 0);
      for (const leaseIndex of leaseIndexes) assert.ok(gateIndex < leaseIndex);
    }
  }
});
