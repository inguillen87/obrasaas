import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TenantSubscriptionUpdateError,
  isExternalTenant,
  normalizeTenantSubscriptionUpdate,
} from '../src/lib/superadmin-tenants.js';

const now = new Date('2026-07-15T12:00:00.000Z');
const currentTrial = {
  subscriptionPlan: 'TRIAL',
  subscriptionStatus: 'TRIALING',
  trialEndsAt: new Date('2026-07-20T23:59:59.999Z'),
};

test('superadmin can activate a paid tenant with an auditable diff', () => {
  const update = normalizeTenantSubscriptionUpdate({
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'ACTIVE',
  }, currentTrial, now);

  assert.equal(update.data.subscriptionPlan, 'PRO');
  assert.equal(update.data.subscriptionStatus, 'ACTIVE');
  assert.deepEqual(update.changes.subscriptionPlan, { from: 'TRIAL', to: 'PRO' });
  assert.deepEqual(update.changes.subscriptionStatus, { from: 'TRIALING', to: 'ACTIVE' });
});

test('trial extensions require a future ISO date', () => {
  const update = normalizeTenantSubscriptionUpdate({ trialEndsAt: '2026-07-29' }, currentTrial, now);
  assert.equal(update.data.trialEndsAt.toISOString(), '2026-07-29T23:59:59.999Z');

  assert.throws(
    () => normalizeTenantSubscriptionUpdate({ trialEndsAt: '2026-07-14' }, currentTrial, now),
    TenantSubscriptionUpdateError,
  );
  assert.throws(
    () => normalizeTenantSubscriptionUpdate({ trialEndsAt: '15/07/2026' }, currentTrial, now),
    TenantSubscriptionUpdateError,
  );
});

test('invalid plan and status combinations fail closed', () => {
  assert.throws(
    () => normalizeTenantSubscriptionUpdate({ subscriptionStatus: 'ACTIVE' }, currentTrial, now),
    /requieren Pro o Enterprise/,
  );
  assert.throws(
    () => normalizeTenantSubscriptionUpdate({ subscriptionPlan: 'ENTERPRISE' }, currentTrial, now),
    /prueba debe usar el plan Trial/,
  );
  assert.throws(
    () => normalizeTenantSubscriptionUpdate({ subscriptionPlan: 'FREE' }, currentTrial, now),
    /no existe/,
  );
});

test('internal organizations can never be managed as tenants', () => {
  assert.equal(isExternalTenant({ clerkOrganizationId: 'org_customer', metadata: {} }), true);
  assert.equal(isExternalTenant({ clerkOrganizationId: 'system:obrasaas', metadata: {} }), false);
  assert.equal(isExternalTenant({ clerkOrganizationId: 'org_internal', metadata: { internal: true } }), false);
});
