import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return { url: 'mock:meta-webhook-next-server', shortCircuit: true };
    }
    if (specifier === '@/lib/db') {
      return { url: 'mock:meta-webhook-db', shortCircuit: true };
    }
    if (specifier === '@/lib/whatsapp/meta') {
      return { url: 'mock:meta-webhook-meta', shortCircuit: true };
    }
    if (specifier === '@/lib/whatsapp/webhook-worker') {
      return { url: 'mock:meta-webhook-worker', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:meta-webhook-next-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export function after() {}',
      };
    }
    if (url === 'mock:meta-webhook-db') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function storeMetaWebhookBatch() {
            globalThis.__metaWebhookStoreCalls += 1;
            return {
              accepted: 0,
              duplicate: 0,
              unknownConnections: 0,
              projectIds: [],
            };
          }
        `,
      };
    }
    if (url === 'mock:meta-webhook-meta') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function normalizeMetaWebhook() { return []; }
          export function verifyMetaSignature() { return true; }
          export function verifyMetaSubscription() { return { valid: false }; }
        `,
      };
    }
    if (url === 'mock:meta-webhook-worker') {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export async function drainProjectWebhookEvents() {}',
      };
    }
    return nextLoad(url, context);
  },
});

const { POST } = await import('../src/app/api/webhooks/whatsapp/route.js');
const { META_WEBHOOK_MAX_BODY_BYTES } = await import(
  '../src/lib/whatsapp/webhook-ingress.js'
);

function jsonBodyAtSize(size) {
  const prefix = '{"entry":[],"padding":"';
  const suffix = '"}';
  const paddingLength = size - Buffer.byteLength(prefix) - Buffer.byteLength(suffix);
  assert.ok(paddingLength >= 0);
  const body = `${prefix}${'a'.repeat(paddingLength)}${suffix}`;
  assert.equal(Buffer.byteLength(body), size);
  return body;
}

test('Meta webhook route accepts 3 MiB exactly and rejects the next byte before persistence', async () => {
  const previousSecret = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = 'test-only-meta-secret';
  globalThis.__metaWebhookStoreCalls = 0;

  try {
    const accepted = await POST(new Request('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
      },
      body: jsonBodyAtSize(META_WEBHOOK_MAX_BODY_BYTES),
    }));
    assert.equal(accepted.status, 200);
    assert.equal(globalThis.__metaWebhookStoreCalls, 1);

    const rejected = await POST(new Request('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
      },
      body: jsonBodyAtSize(META_WEBHOOK_MAX_BODY_BYTES + 1),
    }));
    assert.equal(rejected.status, 413);
    assert.equal(globalThis.__metaWebhookStoreCalls, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
    delete globalThis.__metaWebhookStoreCalls;
  }
});
