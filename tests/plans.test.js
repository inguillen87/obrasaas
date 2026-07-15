import assert from 'node:assert/strict';
import test from 'node:test';

import { getSubscriptionEntitlements } from '../src/lib/plans.js';

const NOW = new Date('2026-07-14T12:00:00.000Z');

test('an active trial can read and write', () => {
  const access = getSubscriptionEntitlements({
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIALING',
    trialEndsAt: new Date('2026-07-20T12:00:00.000Z'),
  }, NOW);

  assert.equal(access.status, 'TRIALING');
  assert.equal(access.trialDaysRemaining, 6);
  assert.equal(access.canRead, true);
  assert.equal(access.canWrite, true);
});

test('an expired trial becomes read-only', () => {
  const access = getSubscriptionEntitlements({
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIALING',
    trialEndsAt: new Date('2026-07-13T12:00:00.000Z'),
  }, NOW);

  assert.equal(access.status, 'TRIAL_EXPIRED');
  assert.equal(access.trialDaysRemaining, 0);
  assert.equal(access.canRead, true);
  assert.equal(access.canWrite, false);
});

test('active plans work and suspended tenants are blocked', () => {
  assert.deepEqual(
    getSubscriptionEntitlements({
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
    }, NOW),
    {
      plan: 'PRO',
      status: 'ACTIVE',
      trialEndsAt: null,
      trialDaysRemaining: null,
      canRead: true,
      canWrite: true,
    },
  );

  const suspended = getSubscriptionEntitlements({
    subscriptionPlan: 'ENTERPRISE',
    subscriptionStatus: 'SUSPENDED',
  }, NOW);
  assert.equal(suspended.canRead, false);
  assert.equal(suspended.canWrite, false);
});
