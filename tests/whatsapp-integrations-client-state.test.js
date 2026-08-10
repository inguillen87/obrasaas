import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  whatsappConnectionActive,
  whatsappConnectionIdentity,
  whatsappConnectionLinked,
  whatsappGraphAccessReady,
  whatsappGraphAccessRejected,
  whatsappReconnectRequired,
} from '../src/app/dashboard/integrations/channel-client-state.js';

function connection(overrides = {}) {
  return {
    linked: true,
    enabled: true,
    connectionStatus: 'CONNECTED',
    phoneNumberId: 'phone-test',
    whatsappBusinessId: 'waba-test',
    ...overrides,
  };
}

function health(overrides = {}) {
  return {
    checks: {
      account: {
        phoneStatus: 'REGISTERED',
        providerStatus: 'HEALTHY',
        scopesVerified: true,
        tokenStatus: 'VALID',
      },
    },
    actions: [],
    ...overrides,
  };
}

test('a linked and verified account can use Graph without claiming traffic is operational', () => {
  const linked = connection();
  assert.equal(whatsappConnectionLinked(linked), true);
  assert.equal(whatsappConnectionIdentity(linked), 'waba-test');
  assert.equal(whatsappConnectionActive(linked), true);
  assert.equal(whatsappGraphAccessReady(linked, health()), true);
  assert.equal(whatsappReconnectRequired(linked, health()), false);
});

test('an expired token overrides a raw CONNECTED row and offers explicit reconnection', () => {
  const expired = health({
    checks: {
      account: {
        phoneStatus: 'REGISTERED',
        providerStatus: 'HEALTHY',
        scopesVerified: true,
        tokenStatus: 'EXPIRED',
      },
    },
    actions: [{ code: 'RECONNECT_ACCOUNT' }],
  });

  assert.equal(whatsappConnectionActive(connection()), true);
  assert.equal(whatsappGraphAccessReady(connection(), expired), false);
  assert.equal(whatsappReconnectRequired(connection(), expired), true);
});

test('unknown provider facts fail closed without inventing a reconnection reason', () => {
  assert.equal(whatsappGraphAccessReady(connection(), {}), false);
  assert.equal(whatsappReconnectRequired(connection(), {}), false);
  assert.equal(whatsappConnectionLinked({ linked: false, whatsappBusinessId: 'waba-test' }), false);
  assert.equal(whatsappConnectionIdentity({
    linked: false,
    whatsappBusinessId: 'waba-test',
  }), null);
});

test('disabled and errored linked accounts require reconnection and cannot call Graph', () => {
  for (const candidate of [
    connection({ enabled: false, connectionStatus: 'DISABLED' }),
    connection({ connectionStatus: 'ERROR' }),
  ]) {
    assert.equal(whatsappConnectionLinked(candidate), true);
    assert.equal(whatsappConnectionActive(candidate), false);
    assert.equal(whatsappGraphAccessReady(candidate, health()), false);
    assert.equal(whatsappReconnectRequired(candidate, health()), true);
  }
});

test('phone registration and webhook subscription blockers expose the repair path', () => {
  for (const actionCode of ['REGISTER_PHONE', 'SUBSCRIBE_WEBHOOK']) {
    const blocked = health({
      actions: [{ code: actionCode }],
    });
    assert.equal(whatsappReconnectRequired(connection(), blocked), true);
  }
});

test('authoritative Graph access rejections fail closed without matching unrelated provider errors', () => {
  for (const code of [
    'META_190',
    'META_PILOT_TOKEN_EXPIRED',
    'META_TOKEN_APP_MISMATCH',
    'WHATSAPP_GRAPH_RECONNECT_REQUIRED',
    'WHATSAPP_GRAPH_VERIFICATION_REQUIRED',
    'WHATSAPP_NOT_CONNECTED',
  ]) {
    assert.equal(whatsappGraphAccessRejected(code), true);
  }
  assert.equal(whatsappGraphAccessRejected('META_131030'), false);
  assert.equal(whatsappGraphAccessRejected(''), false);
});

test('missing scopes, phone registration or provider health block Graph access', () => {
  const accountPatches = [
    { scopesVerified: false },
    { phoneStatus: 'UNREGISTERED' },
    { providerStatus: 'DEGRADED' },
  ];
  for (const accountPatch of accountPatches) {
    const candidate = health({
      checks: {
        account: {
          phoneStatus: 'REGISTERED',
          providerStatus: 'HEALTHY',
          scopesVerified: true,
          tokenStatus: 'VALID',
          ...accountPatch,
        },
      },
    });
    assert.equal(whatsappGraphAccessReady(connection(), candidate), false);
  }
});

test('the integrations UI wires provider calls and reconnect controls to verified health', async () => {
  const [client, page, embeddedSignup] = await Promise.all([
    readFile(new URL(
      '../src/app/dashboard/integrations/integrations-client.js',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL(
      '../src/app/dashboard/integrations/page.js',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL(
      '../src/app/api/integrations/whatsapp/embedded-signup/route.js',
      import.meta.url,
    ), 'utf8'),
  ]);

  assert.match(client, /whatsappGraphAccessReady\(initialConnection, initialHealth\)/);
  assert.match(client, /if \(!graphReady\) return undefined;/);
  assert.match(client, /!graphReady\s+\|\| pending\s+\|\| healthPending/);
  assert.match(client, /linked \? 'Reconectar con Meta' : 'Conectar con Meta'/);
  assert.match(client, /href="#pilot-import-title"/);
  assert.match(client, /const presentedFlowCatalog = graphReady/);
  assert.match(client, /const presentedTemplateCatalog = graphReady/);
  assert.match(client, /const presentedFlowNotice = graphReady/);
  assert.match(client, /const presentedTemplateNotice = graphReady/);
  assert.match(client, /remoteChannelEpochRef\.current \+= 1/);
  assert.match(client, /\[connectionIdentity, graphReady\]/);
  assert.match(client, /throw integrationResponseError\(payload/);
  assert.match(client, /whatsappGraphAccessRejected\(error\?\.code\)/);
  assert.match(client, /synchronizeChannelHealth\(\{ method: 'POST' \}\)/);
  assert.match(client, /handleGraphAccessFailureEvent\(error\)/);
  assert.match(client, /if \(handleGraphAccessFailure\(error\)\) return;/);
  assert.match(client, /const remoteVerificationUnavailable = linked && !graphReady/);
  assert.match(client, /Estado Meta no verificado/);
  assert.match(client, /verificationUnavailable: remoteVerificationUnavailable/);
  assert.ok(
    client.indexOf('setChannelHealth(null)')
      < client.indexOf('setConnection(payload.connection)'),
    'reconnection must invalidate previous health before exposing the new connection',
  );
  assert.doesNotMatch(client, /payload\.data\?\.error_message/);
  assert.doesNotMatch(client, /connection\?\.lastError/);
  assert.match(page, /pilotImportEnabled=\{pilotPanelEnabled\}/);
  assert.match(page, /linked: Boolean\(connection\.phoneNumberId && connection\.whatsappBusinessId\)/);
  assert.match(embeddedSignup, /linked: Boolean\(connection\.phoneNumberId && connection\.whatsappBusinessId\)/);
  assert.doesNotMatch(page, /lastError: connection\.lastError/);
  assert.doesNotMatch(page, /tokenLastFour: connection\.tokenLastFour/);
  assert.doesNotMatch(embeddedSignup, /lastError: connection\.lastError/);
  assert.doesNotMatch(embeddedSignup, /tokenLastFour: connection\.tokenLastFour/);
});
