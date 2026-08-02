import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const STATE_KEY = Symbol.for('obrasaas.supplier-reminder-cron-route-test');
globalThis[STATE_KEY] = {
  calls: [],
  error: null,
  result: {
    recoveredClaims: 1,
    recoveredUncertain: 0,
    reconciledWebhooks: 2,
    claimed: 1,
    providerAccepted: 1,
    retryableFailed: 0,
    deadLetter: 0,
    uncertain: 0,
    conflict: 0,
    cancelled: 0,
    hasMore: false,
    health: { DELIVERED: 3 },
  },
};

const mocks = new Map([
  ['@/lib/prisma', 'mock:supplier-reminder-cron-prisma'],
  ['@/lib/email/resend', 'mock:supplier-reminder-cron-resend'],
  ['@/lib/supplier-reminder-worker', 'mock:supplier-reminder-cron-worker'],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks.has(specifier)) return { url: mocks.get(specifier), shortCircuit: true };
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.js`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:supplier-reminder-cron-prisma') {
      return { format: 'module', shortCircuit: true, source: 'export function getPrisma() { return { source: "test" }; }' };
    }
    if (url === 'mock:supplier-reminder-cron-resend') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function readResendEmailConfig() { return { apiKey: 'redacted' }; }
          export function resendConfigurationErrorResponse() { return null; }
        `,
      };
    }
    if (url === 'mock:supplier-reminder-cron-worker') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for('obrasaas.supplier-reminder-cron-route-test')];
          export async function processSupplierReminders(...args) {
            state.calls.push(args);
            if (state.error) throw state.error;
            return state.result;
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const route = await import('../src/app/api/cron/supplier-reminders/route.js');

function withCronSecret(context, value) {
  const previous = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  context.after(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });
}

function resetState() {
  const state = globalThis[STATE_KEY];
  state.calls = [];
  state.error = null;
  state.result = {
    recoveredClaims: 1,
    recoveredUncertain: 0,
    reconciledWebhooks: 2,
    claimed: 1,
    providerAccepted: 1,
    retryableFailed: 0,
    deadLetter: 0,
    uncertain: 0,
    conflict: 0,
    cancelled: 0,
    hasMore: false,
    health: { DELIVERED: 3 },
  };
  return state;
}

test('supplier reminder cron fails closed without CRON_SECRET', async (context) => {
  withCronSecret(context, undefined);
  const state = resetState();
  const response = await route.GET(new Request('https://app.test/api/cron/supplier-reminders'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'SUPPLIER_REMINDER_CRON_NOT_CONFIGURED');
  assert.equal(state.calls.length, 0);
});

test('supplier reminder cron rejects malformed and incorrect bearer credentials', async (context) => {
  withCronSecret(context, 'cron-secret');
  const state = resetState();
  for (const authorization of [null, 'cron-secret', 'Bearer wrong', 'Bearer cron-secret-extra']) {
    const response = await route.GET(new Request('https://app.test/api/cron/supplier-reminders', {
      headers: authorization ? { authorization } : {},
    }));
    assert.equal(response.status, 401);
  }
  assert.equal(state.calls.length, 0);
});

test('supplier reminder cron uses a bounded batch and returns only safe metrics', async (context) => {
  withCronSecret(context, 'cron-secret');
  const state = resetState();
  const response = await route.GET(new Request('https://app.test/api/cron/supplier-reminders', {
    headers: { authorization: 'Bearer cron-secret' },
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'healthy');
  assert.equal(body.providerAccepted, 1);
  assert.equal(body.reconciledWebhooks, 2);
  assert.equal(Object.hasOwn(body, 'apiKey'), false);
  assert.equal(state.calls[0][1].limit, 4);
});

test('supplier reminder cron surfaces delivery incidents as degraded without PII', async (context) => {
  withCronSecret(context, 'cron-secret');
  const state = resetState();
  state.result.health = { BOUNCED: 1 };
  const response = await route.GET(new Request('https://app.test/api/cron/supplier-reminders', {
    headers: { authorization: 'Bearer cron-secret' },
  }));
  const body = await response.json();
  assert.equal(body.status, 'degraded');
  assert.equal(body.code, 'SUPPLIER_REMINDER_DELIVERY_INCIDENT');
  assert.equal(body.terminalDeliveryIssues, 1);
});

test('supplier reminder cron sanitizes unexpected worker failures', async (context) => {
  withCronSecret(context, 'cron-secret');
  const state = resetState();
  state.error = new Error('agenda@proveedor.test secret provider detail');
  const originalError = console.error;
  console.error = () => {};
  context.after(() => { console.error = originalError; });
  const response = await route.GET(new Request('https://app.test/api/cron/supplier-reminders', {
    headers: { authorization: 'Bearer cron-secret' },
  }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    ok: false,
    status: 'failed',
    code: 'SUPPLIER_REMINDER_WORKER_FAILED',
  });
});
