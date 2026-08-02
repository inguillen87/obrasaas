import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const STATE_KEY = Symbol.for('obrasaas.supplier-reminder-webhook-route-test');
globalThis[STATE_KEY] = {
  configError: null,
  verifyError: null,
  verifyCalls: [],
  applyCalls: [],
};

const mocks = new Map([
  ['@/lib/prisma', 'mock:supplier-reminder-webhook-prisma'],
  ['@/lib/email/resend', 'mock:supplier-reminder-webhook-resend'],
  ['@/lib/supplier-reminder-webhooks', 'mock:supplier-reminder-webhook-helper'],
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
    if (url === 'mock:supplier-reminder-webhook-prisma') {
      return { format: 'module', shortCircuit: true, source: 'export function getPrisma() { return { source: "test" }; }' };
    }
    if (url === 'mock:supplier-reminder-webhook-resend') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for('obrasaas.supplier-reminder-webhook-route-test')];
          export function readResendWebhookConfig() {
            if (state.configError) throw state.configError;
            return { webhookSecrets: ['whsec-test'] };
          }
          export function resendConfigurationErrorResponse(error) {
            return error === state.configError
              ? Response.json({ ok: false, code: 'SUPPLIER_REMINDER_EMAIL_NOT_CONFIGURED' }, { status: 503 })
              : null;
          }
        `,
      };
    }
    if (url === 'mock:supplier-reminder-webhook-helper') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for('obrasaas.supplier-reminder-webhook-route-test')];
          export function verifyResendWebhook(input) {
            state.verifyCalls.push(input);
            if (state.verifyError) throw state.verifyError;
            return { id: 'event-a', event: { type: 'email.delivered', data: { email_id: 'email-a' } } };
          }
          export async function applySupplierReminderWebhook(...args) {
            state.applyCalls.push(args);
            return { matched: true, applied: true };
          }
          export function supplierReminderWebhookErrorResponse(error) {
            return error === state.verifyError
              ? Response.json({ ok: false, code: 'SUPPLIER_REMINDER_WEBHOOK_SIGNATURE_INVALID' }, { status: 401 })
              : null;
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const route = await import('../src/app/api/webhooks/resend/route.js');

function resetState() {
  const state = globalThis[STATE_KEY];
  state.configError = null;
  state.verifyError = null;
  state.verifyCalls = [];
  state.applyCalls = [];
  return state;
}

function requestWithBody(size) {
  return new Request('https://app.test/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'event-a',
      'svix-timestamp': '1785585600',
      'svix-signature': 'v1,test',
    },
    body: 'a'.repeat(size),
  });
}

test('Resend webhook reads at most 256 KiB before signature verification', async () => {
  const state = resetState();
  const accepted = await route.POST(requestWithBody(256 * 1024));
  assert.equal(accepted.status, 200);
  assert.equal(state.verifyCalls.length, 1);
  assert.equal(state.verifyCalls[0].rawBody.length, 256 * 1024);
  assert.equal(state.applyCalls.length, 1);

  const rejected = await route.POST(requestWithBody(256 * 1024 + 1));
  assert.equal(rejected.status, 413);
  assert.equal(state.verifyCalls.length, 1);
  assert.equal(state.applyCalls.length, 1);
});

test('Resend webhook fails closed when signature configuration is absent', async () => {
  const state = resetState();
  state.configError = new Error('missing secret');
  const response = await route.POST(requestWithBody(2));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'SUPPLIER_REMINDER_EMAIL_NOT_CONFIGURED');
  assert.equal(state.verifyCalls.length, 0);
});

test('Resend webhook rejects an invalid signature without touching persistence', async () => {
  const state = resetState();
  state.verifyError = new Error('invalid signature');
  const response = await route.POST(requestWithBody(2));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'SUPPLIER_REMINDER_WEBHOOK_SIGNATURE_INVALID');
  assert.equal(state.applyCalls.length, 0);
});
