import { getPrisma } from '@/lib/prisma';
import { getStripe, subscriptionDatabaseStatus } from '@/lib/stripe';

export const runtime = 'nodejs';

function subscriptionIdFromInvoice(invoice) {
  const value = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  return typeof value === 'string' ? value : value?.id || null;
}

async function updateBySubscription(prisma, subscriptionId, data) {
  if (!subscriptionId) return;
  await prisma.organization.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data,
  });
}

async function processStripeEvent(event) {
  const prisma = getPrisma();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const organizationId = session.metadata?.organizationId;
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
    if (!organizationId || !subscriptionId) {
      throw new Error('Checkout session is missing organization or subscription metadata.');
    }
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripeSubscriptionId: subscriptionId,
        trialEndsAt: null,
      },
    });
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await updateBySubscription(prisma, subscription.id, {
      subscriptionStatus: subscriptionDatabaseStatus(subscription.status),
    });
    return;
  }

  if (event.type === 'invoice.payment_succeeded') {
    await updateBySubscription(prisma, subscriptionIdFromInvoice(event.data.object), {
      subscriptionStatus: 'ACTIVE',
    });
    return;
  }

  if (event.type === 'invoice.payment_failed') {
    await updateBySubscription(prisma, subscriptionIdFromInvoice(event.data.object), {
      subscriptionStatus: 'PAST_DUE',
    });
  }
}

export async function POST(request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return Response.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook verification failed:', error);
    return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  const prisma = getPrisma();
  const previous = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
  });
  if (previous?.status === 'PROCESSED') return Response.json({ received: true, duplicate: true });

  await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
    update: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    create: {
      provider: 'stripe',
      externalId: event.id,
      eventType: event.type,
      status: 'PROCESSING',
      attempts: 1,
      payload: event,
    },
  });

  try {
    await processStripeEvent(event);
    await prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
    return Response.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook ${event.id} failed:`, error);
    await prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
      data: {
        status: 'FAILED',
        lastError: error instanceof Error ? error.message.slice(0, 2_000) : 'Unknown error',
      },
    });
    return Response.json({ error: 'Stripe webhook processing failed.' }, { status: 500 });
  }
}
