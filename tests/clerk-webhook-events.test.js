import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSupportedClerkWebhookEvent,
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
