import 'server-only';
import Stripe from 'stripe';

let stripeClient;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  stripeClient ||= new Stripe(process.env.STRIPE_SECRET_KEY, {
    appInfo: { name: 'ObraSaaS', version: '0.1.0' },
  });
  return stripeClient;
}

export function subscriptionDatabaseStatus(status) {
  if (status === 'active' || status === 'trialing') return 'ACTIVE';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'PAST_DUE';
  if (status === 'canceled' || status === 'incomplete_expired') return 'CANCELED';
  return 'SUSPENDED';
}

