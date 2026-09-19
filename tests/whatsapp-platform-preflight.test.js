import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectWhatsAppPlatformPrerequisites, verifyWhatsAppPlatform } from '../src/lib/whatsapp/platform-preflight.js';
const env = { NEXT_PUBLIC_META_APP_ID: '1234567890123456', META_APP_SECRET: 'test-secret-never-expose', META_VERIFY_TOKEN: 'test-verify-never-expose', WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'), META_GRAPH_API_VERSION: 'v23.0', VERCEL_ENV: 'preview', NEXT_PUBLIC_APP_URL: 'https://obrasaas-preview.vercel.app' };
const callback = env.NEXT_PUBLIC_APP_URL + '/api/webhooks/whatsapp';
const subscription = changes => ({ data: [{ object: 'whatsapp_business_account', callback_url: callback, active: true, fields: [{ name: 'messages' }], ...changes }] });
function fetcher(replies) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => { calls.push({ url, options }); const value = replies[calls.length - 1]; if (value instanceof Error) throw value; return value instanceof Response ? value : Response.json(value); } };
}
test('present values never assert credential authenticity or channel operation', () => {
  const result = inspectWhatsAppPlatformPrerequisites(env);
  assert.equal(result.find(row => row.key === 'appSecret').status, 'PRESENT_UNVERIFIED');
  assert.ok(!JSON.stringify(result).includes(env.META_APP_SECRET));
});
test('verified app and callback remain configuration evidence, not traffic proof', async () => {
  const fixture = fetcher([{ id: env.NEXT_PUBLIC_META_APP_ID }, subscription()]);
  const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl });
  assert.equal(result.authentication.status, 'VERIFIED'); assert.equal(result.webhook.status, 'VERIFIED');
  assert.equal(result.provesOperationalTraffic, false); assert.equal(result.messagesSent, false); assert.equal(result.writesToMeta, false); assert.equal(result.requests, 2);
  assert.ok(fixture.calls.every(call => call.options.method === 'GET' && call.options.redirect === 'error' && call.options.cache === 'no-store'));
  for (const call of fixture.calls) { assert.equal(new URL(call.url).origin, 'https://graph.facebook.com'); assert.ok(!call.url.includes(env.META_APP_SECRET)); }
  assert.ok(!JSON.stringify(result).includes(env.META_VERIFY_TOKEN));
});
for (const missing of ['NEXT_PUBLIC_META_APP_ID','META_APP_SECRET','META_GRAPH_API_VERSION']) test('invalid prerequisite avoids network: ' + missing, async () => {
  const config = { ...env, [missing]: missing === 'META_GRAPH_API_VERSION' ? 'bad/version' : '' };
  const fixture = fetcher([]); const result = await verifyWhatsAppPlatform({ env: config, fetchImpl: fixture.fetchImpl });
  assert.equal(result.authentication.code, 'PREREQUISITE_MISSING'); assert.equal(fixture.calls.length, 0);
});
test('provider rejection of app secret does not invalidate a different WhatsApp token or disclose the provider payload', async () => {
  const fixture = fetcher([Response.json({ error: { code: 190, message: 'private-token-provider-error' } }, { status: 401 })]);
  const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl });
  assert.equal(result.authentication.code, 'APP_CREDENTIAL_REJECTED'); assert.equal(result.webhook.status, 'NOT_CHECKED'); assert.equal(fixture.calls.length, 1);
  assert.ok(!JSON.stringify(result).includes('private-token-provider-error')); assert.ok(!JSON.stringify(result).includes(env.META_APP_SECRET));
});
test('identity mismatch stops before reading another app subscription', async () => {
  const fixture = fetcher([{ id: '123456789' }, subscription()]);
  const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl }); assert.equal(result.authentication.code, 'APP_ID_MISMATCH'); assert.equal(fixture.calls.length, 1);
});
for (const [changes, code] of [[{ callback_url: 'https://other.example/callback' }, 'CALLBACK_MISMATCH'], [{ active: false }, 'WEBHOOK_INACTIVE'], [{ fields: [] }, 'MESSAGES_FIELD_MISSING']]) test('callback classification: ' + code, async () => {
  const fixture = fetcher([{ id: env.NEXT_PUBLIC_META_APP_ID }, subscription(changes)]);
  const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl }); assert.equal(result.authentication.status, 'VERIFIED'); assert.equal(result.webhook.code, code); assert.ok(!JSON.stringify(result).includes('other.example'));
});
test('empty subscription list and incomplete pagination are distinct', async () => {
  for (const [payload,code] of [[{ data: [] }, 'WEBHOOK_NOT_REGISTERED'], [{ data: [], paging: { next: 'https://not-trusted.test/' } }, 'SUBSCRIPTIONS_TRUNCATED']]) {
    const fixture = fetcher([{ id: env.NEXT_PUBLIC_META_APP_ID }, payload]); const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl });
    assert.equal(result.webhook.code, code); assert.equal(fixture.calls.length, 2);
  }
});
test('unsafe preview origin stops callback comparison but not the independent app-auth result', async () => {
  const fixture = fetcher([{ id: env.NEXT_PUBLIC_META_APP_ID }]);
  const result = await verifyWhatsAppPlatform({ env: { ...env, NEXT_PUBLIC_APP_URL: 'https://obrasaas.vercel.app' }, fetchImpl: fixture.fetchImpl });
  assert.equal(result.authentication.status, 'VERIFIED'); assert.equal(result.webhook.code, 'PUBLIC_ORIGIN_INVALID'); assert.equal(fixture.calls.length, 1);
});
for (const [reply, code] of [[new Response('bad-json'), 'INVALID_RESPONSE'], [new Response('x'.repeat(65537)), 'RESPONSE_TOO_LARGE'], [new Response('{}', { status: 302, headers: { Location: 'https://untrusted.test' } }), 'REDIRECT_BLOCKED'], [Response.json({ error: { code: 4 } }, { status: 429 }), 'META_RATE_LIMIT']]) test('provider response is bounded and sanitized: ' + code, async () => {
  const fixture = fetcher([reply]); const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl });
  assert.equal(result.authentication.code, code); assert.equal(result.requests, 1);
});
test('second-call failure preserves already verified app authentication', async () => {
  const fixture = fetcher([{ id: env.NEXT_PUBLIC_META_APP_ID }, Response.json({ error: { message: env.META_APP_SECRET } }, { status: 403 })]);
  const result = await verifyWhatsAppPlatform({ env, fetchImpl: fixture.fetchImpl }); assert.equal(result.authentication.status, 'VERIFIED'); assert.equal(result.webhook.code, 'META_PERMISSION_DENIED'); assert.ok(!JSON.stringify(result).includes(env.META_APP_SECRET));
});
test('one total timeout cancels the read without retries or raw exception exposure', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => { calls++; return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('secret-from-network')), { once: true })); };
  const result = await verifyWhatsAppPlatform({ env, fetchImpl, timeoutMs: 100 }); assert.equal(result.authentication.code, 'META_TIMEOUT'); assert.equal(calls, 1); assert.ok(!JSON.stringify(result).includes('secret-from-network'));
});
test('configuration is captured before asynchronous I/O', async () => {
  const config = { ...env }; const calls = [];
  const fetchImpl = async (url, options) => { calls.push(options.headers.Authorization); config.META_APP_SECRET = 'changed-secret'; return calls.length === 1 ? Response.json({ id: env.NEXT_PUBLIC_META_APP_ID }) : Response.json(subscription()); };
  const result = await verifyWhatsAppPlatform({ env: config, fetchImpl }); assert.equal(result.authentication.status, 'VERIFIED'); assert.equal(calls[0], calls[1]);
});
test('local encryption format is checked but key material never returned', () => {
  const invalid = inspectWhatsAppPlatformPrerequisites({ ...env, WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'bad-key' });
  assert.equal(invalid.find(row => row.key === 'encryption').status, 'MISSING_OR_INVALID');
});
