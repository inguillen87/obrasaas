import assert from 'node:assert/strict';
import test from 'node:test';

import nextConfig from '../next.config.mjs';

test('applies the security baseline to every application route', async () => {
  const rules = await nextConfig.headers();

  assert.equal(rules.length, 2);
  assert.equal(rules[0].source, '/:path*');

  const headers = Object.fromEntries(
    rules[0].headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );

  assert.equal(headers['cross-origin-opener-policy'], 'same-origin-allow-popups');
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['strict-transport-security'], 'max-age=63072000; includeSubDomains');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(headers['x-permitted-cross-domain-policies'], 'none');
});

test('the private payment receipt webview overrides navigation and framing policy', async () => {
  const rules = await nextConfig.headers();
  const rule = rules.find(({ source }) => source === '/webview/worker-payment-receipt');
  assert.ok(rule);
  const headers = Object.fromEntries(
    rule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );

  assert.equal(headers['cache-control'], 'private, no-store, max-age=0');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['x-dns-prefetch-control'], 'off');
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(headers['cross-origin-resource-policy'], 'same-origin');
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(headers['permissions-policy'], /geolocation=\(\)/);
});

test('disables sensitive browser capabilities while preserving first-party location', async () => {
  const [rule] = await nextConfig.headers();
  const permissions = rule.headers.find(({ key }) => key === 'Permissions-Policy');

  assert.ok(permissions);
  assert.match(permissions.value, /camera=\(\)/);
  assert.match(permissions.value, /microphone=\(\)/);
  assert.match(permissions.value, /geolocation=\(self\)/);
  assert.match(permissions.value, /browsing-topics=\(\)/);
  assert.doesNotMatch(permissions.value, /\*/);
});
