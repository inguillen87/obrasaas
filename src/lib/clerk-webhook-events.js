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

export function isSupportedClerkWebhookEvent(eventType) {
  return SUPPORTED_CLERK_WEBHOOK_EVENT_TYPES.has(eventType);
}

export function supportedClerkWebhookEventTypes() {
  return [...SUPPORTED_CLERK_WEBHOOK_EVENT_TYPES];
}
