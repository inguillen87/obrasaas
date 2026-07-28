const SUPPORTED_CLERK_WEBHOOK_EVENT_TYPES = new Set([
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
const CLERK_INSTANCE_ID_PATTERN = /^ins_[A-Za-z0-9]+$/;

export class ClerkWebhookInstanceError extends Error {
  constructor(message, { code, status }) {
    super(message);
    this.name = 'ClerkWebhookInstanceError';
    this.code = code;
    this.status = status;
  }
}

export function requireExpectedClerkWebhookInstance(payload, {
  expectedInstanceId = process.env.CLERK_EXPECTED_INSTANCE_ID,
} = {}) {
  if (
    typeof expectedInstanceId !== 'string'
    || !CLERK_INSTANCE_ID_PATTERN.test(expectedInstanceId)
  ) {
    throw new ClerkWebhookInstanceError(
      'Clerk webhook instance validation is not configured.',
      { code: 'CLERK_WEBHOOK_INSTANCE_CONFIGURATION_INVALID', status: 503 },
    );
  }
  const instanceId = payload?.instance_id;
  if (typeof instanceId !== 'string' || !CLERK_INSTANCE_ID_PATTERN.test(instanceId)) {
    throw new ClerkWebhookInstanceError(
      'Verified Clerk webhook instance identity is invalid.',
      { code: 'CLERK_WEBHOOK_INSTANCE_INVALID', status: 400 },
    );
  }
  if (instanceId !== expectedInstanceId) {
    throw new ClerkWebhookInstanceError(
      'Verified Clerk webhook belongs to another instance.',
      { code: 'CLERK_WEBHOOK_INSTANCE_MISMATCH', status: 403 },
    );
  }
  return instanceId;
}

export function isSupportedClerkWebhookEvent(eventType) {
  return SUPPORTED_CLERK_WEBHOOK_EVENT_TYPES.has(eventType);
}

export function supportedClerkWebhookEventTypes() {
  return [...SUPPORTED_CLERK_WEBHOOK_EVENT_TYPES];
}
