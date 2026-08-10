import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getSuperadminTenantPresentation } from '../src/lib/superadmin-tenant-presentation.js';
import { whatsappTenantSummary } from '../src/app/superadmin/whatsapp-tenant-summary.js';

const NOW = new Date('2026-08-10T12:00:00.000Z');

function organization(overrides = {}) {
  return {
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
    ...overrides,
  };
}

test('expired trials are blocked and never classified as operational', () => {
  const presentation = getSuperadminTenantPresentation(
    organization({
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-08-09T23:59:59.999Z'),
    }),
    { whatsappConnected: true, now: NOW },
  );

  assert.deepEqual(presentation, {
    subscriptionAccessStatus: 'TRIAL_EXPIRED',
    subscriptionCanWrite: false,
    isOperational: false,
    health: 'BLOCKED',
  });
});

test('writable subscriptions retain their operational health classification', () => {
  assert.deepEqual(
    getSuperadminTenantPresentation(organization(), { now: NOW }),
    {
      subscriptionAccessStatus: 'ACTIVE',
      subscriptionCanWrite: true,
      isOperational: true,
      health: 'ONBOARDING',
    },
  );

  const expiringTrial = getSuperadminTenantPresentation(
    organization({
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-08-12T23:59:59.999Z'),
    }),
    { now: NOW },
  );
  assert.equal(expiringTrial.isOperational, true);
  assert.equal(expiringTrial.health, 'ATTENTION');
});

test('a writable tenant with an unhealthy linked channel requires attention', () => {
  const presentation = getSuperadminTenantPresentation(
    organization(),
    { whatsappRequiresAttention: true, now: NOW },
  );
  assert.equal(presentation.isOperational, true);
  assert.equal(presentation.health, 'ATTENTION');
});

test('WhatsApp tenant summaries preserve pending, disabled and mixed channel states', () => {
  assert.equal(whatsappTenantSummary({}), 'Sin conectar');
  assert.equal(whatsappTenantSummary({ pendingChannels: 1 }), '1 pendiente');
  assert.equal(whatsappTenantSummary({ disabledChannels: 2 }), '2 desactivados');
  assert.equal(whatsappTenantSummary({
    connectedChannels: 1,
    attentionChannels: 2,
    pendingChannels: 1,
    disabledChannels: 1,
  }), '1 verificado · 2 en atención · 1 pendiente · 1 desactivado');
});

test('superadmin UI consumes the derived status for metrics, filtering, and display', () => {
  const pageSource = readFileSync(
    new URL('../src/app/superadmin/page.js', import.meta.url),
    'utf8',
  );
  const clientSource = readFileSync(
    new URL('../src/app/superadmin/superadmin-console.js', import.meta.url),
    'utf8',
  );

  assert.match(pageSource, /activeTenants = tenants\.filter\(\(item\) => item\.isOperational\)/);
  assert.match(pageSource, /subscriptionAccessStatus === 'TRIALING'/);
  assert.match(clientSource, /TRIAL_EXPIRED: 'Prueba vencida'/);
  assert.match(clientSource, /tenantAccessStatus\(tenant\)/);
  assert.match(clientSource, /Object\.entries\(EDITABLE_STATUS_LABELS\)/);
});
