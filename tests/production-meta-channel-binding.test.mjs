import assert from 'node:assert/strict';
import test from 'node:test';
import { OBRASAAS_META_CHANNEL, checkObrasaasMetaBinding } from '../src/lib/meta-channel-binding.mjs';
import { createMetaSender, resolveMetaTransport } from '../src/lib/meta-whatsapp-transport.mjs';
import { validateMetaEnvelope } from '../src/lib/meta-webhook-scope.mjs';

const configured = () => ({
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_META_APP_ID: OBRASAAS_META_CHANNEL.appId,
  META_WABA_ID: OBRASAAS_META_CHANNEL.wabaId,
  META_PHONE_NUMBER_ID: OBRASAAS_META_CHANNEL.phoneNumberId,
  META_WHATSAPP_ACCESS_TOKEN: 'synthetic-private-token-preserved',
  META_APP_SECRET: 'synthetic-app-secret-preserved',
  META_VERIFY_TOKEN: 'synthetic-challenge-preserved',
});

test('production pins exactly the previously verified ObraSaaS app, WABA and test number', () => {
  assert.equal(OBRASAAS_META_CHANNEL.appId, '1665088767899217');
  assert.equal(OBRASAAS_META_CHANNEL.wabaId, '2046153882937995');
  assert.equal(OBRASAAS_META_CHANNEL.phoneNumberId, '1225843560610854');
  assert.equal(OBRASAAS_META_CHANNEL.displayNumber, '+1 555-153-3706');
  assert.ok(Object.isFrozen(OBRASAAS_META_CHANNEL));
  assert.deepEqual(checkObrasaasMetaBinding(configured()), { ok: true, enforced: true });
});

for (const field of ['NEXT_PUBLIC_META_APP_ID', 'META_PHONE_NUMBER_ID', 'META_WABA_ID']) {
  for (const value of ['', '999999999', 'undefined', null]) {
    test(`production rejects ${field}=${value} rather than choosing another asset`, () => {
      const env = { ...configured(), [field]: value }, previous = structuredClone(env);
      assert.deepEqual(checkObrasaasMetaBinding(env), { ok: false, enforced: true, code: 'META_PINNED_ASSET_MISMATCH' });
      assert.deepEqual(env, previous);
    });
  }
}

test('conflicting app aliases fail without selecting either credential context', () => {
  assert.equal(checkObrasaasMetaBinding({ ...configured(), META_APP_ID: '999999999' }).code, 'META_PINNED_CONFIG_CONFLICT');
});
test('conflicting sender aliases fail without changing the number', () => {
  assert.equal(checkObrasaasMetaBinding({ ...configured(), WHATSAPP_PHONE_NUMBER_ID: '999999999' }).code, 'META_PINNED_CONFIG_CONFLICT');
});
test('matching historical aliases remain compatible without changing their values', () => {
  const env = configured();
  env.META_APP_ID = env.NEXT_PUBLIC_META_APP_ID;
  env.WHATSAPP_PHONE_NUMBER_ID = env.META_PHONE_NUMBER_ID;
  const previous = structuredClone(env);
  assert.equal(checkObrasaasMetaBinding(env).ok, true);
  assert.deepEqual(env, previous);
});
test('guard neither reads nor exposes secrets and does not claim token validity', () => {
  const env = configured();
  for (const key of ['META_WHATSAPP_ACCESS_TOKEN', 'META_APP_SECRET', 'META_VERIFY_TOKEN']) {
    Object.defineProperty(env, key, { get() { throw new Error('This guard must not read secrets'); } });
  }
  const result = checkObrasaasMetaBinding(env);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result).sort(), ['enforced', 'ok']);
});
test('checking a binding cannot turn an expired token into a valid one', () => {
  const env = configured(), token = env.META_WHATSAPP_ACCESS_TOKEN;
  checkObrasaasMetaBinding(env);
  assert.equal(env.META_WHATSAPP_ACCESS_TOKEN, token);
  assert.equal(checkObrasaasMetaBinding(env).tokenValid, undefined);
});
test('synthetic non-production fixtures remain explicitly separate', () => {
  for (const VERCEL_ENV of [undefined, 'preview', 'development']) {
    assert.deepEqual(checkObrasaasMetaBinding({ VERCEL_ENV }), { ok: true, enforced: false });
  }
});
test('real sender refuses asset drift before any provider request', async () => {
  let requests = 0;
  const send = createMetaSender({ environment: () => ({ ...configured(), META_WABA_ID: '999999999' }), fetchImpl: async () => { requests++; throw new Error('Must not call'); } });
  const result = await send('5491100001111', 'Synthetic test');
  assert.equal(result.code, 'META_PINNED_ASSET_MISMATCH');
  assert.equal(result.accepted, false);
  assert.equal(requests, 0);
});
test('existing sender resolves the same configured token without rotation or regeneration', () => {
  const env = configured(), previous = structuredClone(env);
  assert.equal(resolveMetaTransport(env).token, env.META_WHATSAPP_ACCESS_TOKEN);
  assert.equal(resolveMetaTransport(env).phoneNumberId, OBRASAAS_META_CHANNEL.phoneNumberId);
  assert.deepEqual(env, previous);
});
test('webhook rejects configuration drift before accepting an event for another account', () => {
  const payload = { object: 'whatsapp_business_account', entry: [{ id: '999999999', changes: [{ field: 'messages', value: { metadata: { phone_number_id: OBRASAAS_META_CHANNEL.phoneNumberId }, statuses: [{ status: 'delivered' }] } }] }] };
  const result = validateMetaEnvelope(payload, { ...configured(), META_WABA_ID: '999999999' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.code, 'META_PINNED_ASSET_MISMATCH');
});
