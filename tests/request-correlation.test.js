import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRequestCorrelationId, withCorrelationId } from '../src/lib/request-correlation.js';

test('preserva un request id seguro y acotado', () => {
  const request = new Request('https://example.test', { headers: { 'x-request-id': 'obra-123:read' } });
  assert.equal(resolveRequestCorrelationId(request), 'obra-123:read');
});

test('genera un id nuevo ante valores ausentes o inseguros', () => {
  const generated = resolveRequestCorrelationId(new Request('https://example.test'));
  assert.match(generated, /^[0-9a-f-]{36}$/);
  const unsafe = new Request('https://example.test', { headers: { 'x-request-id': '<script>' } });
  assert.notEqual(resolveRequestCorrelationId(unsafe), '<script>');
});

test('adjunta el id sin perder status ni headers', async () => {
  const response = withCorrelationId(new Response('ok', { status: 202 }), 'req-42');
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('x-request-id'), 'req-42');
  assert.equal(await response.text(), 'ok');
});
