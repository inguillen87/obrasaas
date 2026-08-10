import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  metaProviderCodeFromError,
  metaProviderFailurePresentation,
  normalizeMetaProviderCode,
} from '../src/lib/whatsapp/provider-failure.js';

test('Meta provider codes are bounded numeric evidence, never provider text', () => {
  assert.equal(normalizeMetaProviderCode(131030), 131030);
  assert.equal(normalizeMetaProviderCode('131030'), 131030);
  assert.equal(normalizeMetaProviderCode('131030 recipient +5491112345678'), null);
  assert.equal(normalizeMetaProviderCode(Number.MAX_SAFE_INTEGER), null);

  assert.equal(metaProviderCodeFromError({ providerCode: 131030 }), 131030);
  assert.equal(metaProviderCodeFromError({ code: 'META_131030' }), 131030);
  assert.equal(metaProviderCodeFromError({ code: 'Meta rejected +5491112345678' }), null);
});

test('131030 is actionable only in Meta test environments', () => {
  const preview = metaProviderFailurePresentation({
    providerCode: 131030,
    deliveryStatus: 'failed',
    env: { VERCEL_ENV: 'preview', NODE_ENV: 'production' },
  });
  assert.deepEqual(preview, {
    providerCode: 131030,
    code: 'META_TEST_RECIPIENT_NOT_ENABLED',
    title: 'Destinatario de prueba no habilitado',
    detail: 'Agregá el número a los destinatarios de prueba de Meta y repetí la prueba como un envío nuevo.',
  });

  const production = metaProviderFailurePresentation({
    providerCode: 131030,
    deliveryStatus: 'failed',
    env: { VERCEL_ENV: 'production', NODE_ENV: 'production' },
  });
  assert.equal(production.providerCode, 131030);
  assert.equal(production.code, 'META_PROVIDER_REJECTED');
  assert.equal(production.title, 'Meta rechazó el envío');
  assert.doesNotMatch(JSON.stringify(production), /destinatario de prueba/i);
});

test('Inbox and Activity render only the controlled failure projection', async () => {
  const [inboxSource, activitySource, inboxStyles] = await Promise.all([
    readFile(new URL('../src/app/dashboard/inbox/inbox-client.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/activity/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/inbox/inbox.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(inboxSource, /function DeliveryFailure\(\{ failure \}\)/);
  assert.match(inboxSource, /<code>Meta \{failure\.providerCode\}<\/code>/);
  assert.match(inboxSource, /<DeliveryFailure failure=\{message\.deliveryFailure\} \/>/);
  assert.match(inboxStyles, /\.deliveryFailure\s*\{/);
  assert.match(activitySource, /metaProviderFailurePresentation\(/);
  assert.match(activitySource, /Meta \$\{deliveryFailure\.providerCode\}/);
  assert.doesNotMatch(inboxSource, /error_data/);
});
