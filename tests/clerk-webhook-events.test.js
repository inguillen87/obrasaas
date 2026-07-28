import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ClerkWebhookInstanceError,
  isSupportedClerkWebhookEvent,
  requireExpectedClerkWebhookInstance,
  supportedClerkWebhookEventTypes,
} from '../src/lib/clerk-webhook-events.js';

test('Clerk webhook allowlist contains only identity and tenancy synchronization events', () => {
  assert.deepEqual(supportedClerkWebhookEventTypes(), [
    'user.created',
    'user.updated',
    'user.deleted',
    'organization.created',
    'organization.updated',
    'organization.deleted',
    'organizationMembership.created',
    'organizationMembership.updated',
    'organizationMembership.deleted',
  ]);
  assert.equal(isSupportedClerkWebhookEvent('organizationMembership.deleted'), true);
  assert.equal(isSupportedClerkWebhookEvent('session.created'), false);
  assert.equal(isSupportedClerkWebhookEvent(undefined), false);
});

test('Clerk webhook instance fence requires one exact configured signed instance', () => {
  assert.equal(requireExpectedClerkWebhookInstance(
    { instance_id: 'ins_Development123' },
    { expectedInstanceId: 'ins_Development123' },
  ), 'ins_Development123');

  const rejected = [
    [{ instance_id: 'ins_Development123' }, { expectedInstanceId: null }, 503,
      'CLERK_WEBHOOK_INSTANCE_CONFIGURATION_INVALID'],
    [{}, { expectedInstanceId: 'ins_Development123' }, 400,
      'CLERK_WEBHOOK_INSTANCE_INVALID'],
    [{ instance_id: 'ins_Production123' }, { expectedInstanceId: 'ins_Development123' }, 403,
      'CLERK_WEBHOOK_INSTANCE_MISMATCH'],
  ];
  for (const [payload, options, status, code] of rejected) {
    assert.throws(
      () => requireExpectedClerkWebhookInstance(payload, options),
      (error) => error instanceof ClerkWebhookInstanceError
        && error.status === status
        && error.code === code,
    );
  }
});
