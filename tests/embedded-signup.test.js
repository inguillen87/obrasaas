import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeEmbeddedSignup,
  createAppSecretProof,
  isMetaAppSubscribed,
  isValidMetaResourceId,
  isValidRegistrationPin,
  mergeWhatsAppConnectionMetadata,
  missingRequiredMetaScopes,
  verifyConnectedWhatsAppAccount,
  whatsAppConnectionIdentityChanged,
} from '../src/lib/whatsapp/embedded-signup.js';

test('Embedded Signup validates Meta resource IDs and six-digit PINs', () => {
  assert.equal(isValidMetaResourceId('1556998679107747'), true);
  assert.equal(isValidMetaResourceId('other-app'), false);
  assert.equal(isValidRegistrationPin('731902'), true);
  assert.equal(isValidRegistrationPin('12345'), false);
});

test('appsecret proof is deterministic and token-bound', () => {
  const proof = createAppSecretProof('tenant-token', 'app-secret');
  assert.equal(proof.length, 64);
  assert.notEqual(proof, createAppSecretProof('other-token', 'app-secret'));
});

test('Meta readiness requires both operational scopes and recognizes nested subscriptions', () => {
  assert.deepEqual(missingRequiredMetaScopes(['whatsapp_business_management']), [
    'whatsapp_business_messaging',
  ]);
  assert.deepEqual(missingRequiredMetaScopes([
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ]), []);
  assert.equal(isMetaAppSubscribed({
    data: [{ whatsapp_business_api_data: { id: '1665088767899217' } }],
  }, '1665088767899217'), true);
  assert.equal(isMetaAppSubscribed({ data: [{ id: 'other-app' }] }, '1665088767899217'), false);
});

test('Embedded Signup refresh preserves Flow and endpoint provisioning metadata', () => {
  const identity = {
    phoneNumberId: '987654321',
    whatsappBusinessId: '123456789',
  };
  const existing = {
    whatsappFlows: { 'incident-report': { id: '12345', status: 'PUBLISHED' } },
    whatsappFlowDrafts: { 'incident-report': { id: '67890', status: 'DRAFT' } },
    whatsappFlowEndpoint: { id: 'endpoint-a', keyFingerprint: 'abc' },
    tokenType: 'old',
  };
  const identityChanged = whatsAppConnectionIdentityChanged(identity, { ...identity });
  assert.equal(identityChanged, false);
  assert.deepEqual(mergeWhatsAppConnectionMetadata(existing, {
    tokenType: 'bearer',
    scopes: ['whatsapp_business_management'],
  }, { identityChanged }), {
    ...existing,
    tokenType: 'bearer',
    scopes: ['whatsapp_business_management'],
  });
});

test('Embedded Signup identity changes clear every Flow binding and stale provisioning lease', () => {
  const previousIdentity = {
    phoneNumberId: '987654321',
    whatsappBusinessId: '123456789',
  };
  const nextIdentity = {
    phoneNumberId: '987654322',
    whatsappBusinessId: '123456780',
  };
  const identityChanged = whatsAppConnectionIdentityChanged(previousIdentity, nextIdentity);
  assert.equal(identityChanged, true);
  assert.equal(whatsAppConnectionIdentityChanged(null, nextIdentity), false);

  const merged = mergeWhatsAppConnectionMetadata({
    whatsappFlows: { 'incident-report': { id: '12345', status: 'PUBLISHED' } },
    whatsappFlowDrafts: { 'incident-report': { id: '67890', status: 'DRAFT' } },
    whatsappFlowEndpoint: { id: 'endpoint-a', keyFingerprint: 'abc' },
    whatsappFlowProvisioningLease: { id: 'stale-lease' },
    unrelated: { preserved: true },
  }, {
    tokenType: 'bearer',
    whatsappFlows: { attacker: { id: '99999' } },
  }, { identityChanged });

  for (const key of [
    'whatsappFlows',
    'whatsappFlowDrafts',
    'whatsappFlowEndpoint',
    'whatsappFlowProvisioningLease',
  ]) {
    assert.equal(Object.hasOwn(merged, key), false);
  }
  assert.equal(merged.unrelated.preserved, true);
  assert.equal(merged.tokenType, 'bearer');
});

test('Embedded Signup exchanges code, validates ownership, subscribes, and registers', async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = '1665088767899217';
  process.env.META_APP_SECRET = 'unit-test-secret';
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, search: parsed.search, method: options.method || 'GET', body: options.body });
    if (parsed.pathname.endsWith('/oauth/access_token')) {
      return Response.json({ access_token: 'tenant-token', token_type: 'bearer' });
    }
    if (parsed.pathname.endsWith('/debug_token')) {
      return Response.json({ data: {
        is_valid: true,
        app_id: '1665088767899217',
        scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
      } });
    }
    if (parsed.pathname.endsWith('/123456789/phone_numbers')) {
      return Response.json({ data: [{
        id: '987654321',
        display_phone_number: '+54 9 11 5555 5555',
        verified_name: 'Constructora Sur',
        quality_rating: 'GREEN',
        code_verification_status: 'VERIFIED',
        status: 'CONNECTED',
      }] });
    }
    if (parsed.pathname.endsWith('/123456789/subscribed_apps') && (options.method || 'GET') === 'GET') {
      return Response.json({ data: [{
        whatsapp_business_api_data: { id: '1665088767899217', name: 'ObraSaaS' },
      }] });
    }
    return Response.json({ success: true });
  };

  try {
    const result = await completeEmbeddedSignup({
      code: 'short-lived-code',
      whatsappBusinessId: '123456789',
      phoneNumberId: '987654321',
      registrationPin: '731902',
      fetchImpl,
    });
    assert.equal(result.accessToken, 'tenant-token');
    assert.equal(result.verifiedBusinessName, 'Constructora Sur');
    assert.equal(result.subscribed, true);
    assert.equal(result.phoneStatus, 'CONNECTED');
    assert.match(calls[2].search, /limit=100/);
    assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
      ['/v25.0/oauth/access_token', 'GET'],
      ['/v25.0/debug_token', 'GET'],
      ['/v25.0/123456789/phone_numbers', 'GET'],
      ['/v25.0/123456789/subscribed_apps', 'POST'],
      ['/v25.0/123456789/subscribed_apps', 'GET'],
      ['/v25.0/987654321/register', 'POST'],
      ['/v25.0/123456789/phone_numbers', 'GET'],
    ]);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test('Embedded Signup rejects a token that cannot send WhatsApp messages', async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = '1665088767899217';
  process.env.META_APP_SECRET = 'unit-test-secret';
  try {
    await assert.rejects(completeEmbeddedSignup({
      code: 'short-lived-code',
      whatsappBusinessId: '123456789',
      phoneNumberId: '987654321',
      registrationPin: '731902',
      fetchImpl: async (url) => {
        const path = new URL(url).pathname;
        if (path.endsWith('/oauth/access_token')) return Response.json({ access_token: 'tenant-token' });
        return Response.json({ data: {
          is_valid: true,
          app_id: '1665088767899217',
          scopes: ['whatsapp_business_management'],
        } });
      },
    }), (error) => error.code === 'META_SCOPES_INCOMPLETE' && error.status === 403);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test('connected account verification is read-only and fails closed when the app is unsubscribed', async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = '1665088767899217';
  process.env.META_APP_SECRET = 'unit-test-secret';
  const methods = [];
  try {
    await assert.rejects(verifyConnectedWhatsAppAccount({
      accessToken: 'tenant-token',
      whatsappBusinessId: '123456789',
      phoneNumberId: '987654321',
      fetchImpl: async (url, options = {}) => {
        const path = new URL(url).pathname;
        methods.push(options.method || 'GET');
        if (path.endsWith('/debug_token')) return Response.json({ data: {
          is_valid: true,
          app_id: '1665088767899217',
          scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
        } });
        if (path.endsWith('/phone_numbers')) return Response.json({ data: [{ id: '987654321' }] });
        return Response.json({ data: [] });
      },
    }), (error) => error.code === 'META_APP_NOT_SUBSCRIBED' && error.status === 409);
    assert.deepEqual(methods, ['GET', 'GET', 'GET']);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});
