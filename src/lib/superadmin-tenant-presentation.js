import { getSubscriptionEntitlements } from './plans.js';

export function getSuperadminTenantPresentation(organization, {
  failedWebhooks = 0,
  whatsappConnected = false,
  whatsappRequiresAttention = false,
  now = new Date(),
} = {}) {
  const subscription = getSubscriptionEntitlements(organization, now);
  let health;

  if (
    subscription.status === 'TRIAL_EXPIRED'
    || ['SUSPENDED', 'CANCELED'].includes(subscription.status)
  ) {
    health = 'BLOCKED';
  } else if (subscription.status === 'PAST_DUE' || failedWebhooks > 0) {
    health = 'RISK';
  } else if (
    subscription.status === 'TRIALING'
    && subscription.trialDaysRemaining !== null
    && subscription.trialDaysRemaining <= 3
  ) {
    health = 'ATTENTION';
  } else if (whatsappRequiresAttention) {
    health = 'ATTENTION';
  } else {
    health = whatsappConnected ? 'HEALTHY' : 'ONBOARDING';
  }

  return {
    subscriptionAccessStatus: subscription.status,
    subscriptionCanWrite: subscription.canWrite,
    isOperational: subscription.canWrite,
    health,
  };
}
