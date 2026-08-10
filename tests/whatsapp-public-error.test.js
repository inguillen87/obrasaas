import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { publicMetaIntegrationFailure } from '../src/lib/whatsapp/public-error.js';

test('provider messages never cross the public Meta error boundary', () => {
  const failure = publicMetaIntegrationFailure({
    code: 'META_190',
    message: 'token secret-value belongs to +5492610000000',
    status: 401,
  });
  const serialized = JSON.stringify(failure);

  assert.deepEqual(failure, {
    code: 'META_190',
    message: 'La credencial de Meta venció o dejó de ser válida. Reconectá la cuenta.',
    status: 401,
  });
  assert.equal(serialized.includes('secret-value'), false);
  assert.equal(serialized.includes('+5492610000000'), false);
});

test('provider validation details become controlled product copy', () => {
  const failure = publicMetaIntegrationFailure({
    code: 'FLOW_JSON_REJECTED',
    message: 'raw validation payload with customer data',
    status: 422,
  });
  assert.equal(failure.code, 'FLOW_JSON_REJECTED');
  assert.match(failure.message, /Meta rechazó la definición/);
  assert.equal(failure.message.includes('customer data'), false);
});

test('invalid codes and statuses fail closed to a bounded generic contract', () => {
  assert.deepEqual(publicMetaIntegrationFailure({
    code: 'bad code with spaces',
    message: 'raw provider text',
    status: 200,
  }), {
    code: 'META_OPERATION_FAILED',
    message: 'Meta rechazó la operación. Revisá la cuenta y volvé a intentarlo.',
    status: 500,
  });
});

test('all Meta integration routes apply the controlled public error boundary', async () => {
  const sources = await Promise.all([
    'embedded-signup',
    'health',
    'flows',
    'templates',
  ].map((route) => readFile(new URL(
    `../src/app/api/integrations/whatsapp/${route}/route.js`,
    import.meta.url,
  ), 'utf8')));

  for (const source of sources) {
    assert.match(source, /publicMetaIntegrationFailure/);
  }
  assert.doesNotMatch(sources[0], /Response\.json\(\{ error: error\.message, code: error\.code \}/);
  assert.doesNotMatch(sources[1], /json\(\{ error: error\.message, code: error\.code \}/);
});
