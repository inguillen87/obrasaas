import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { PLAN_CATALOG } from '@/lib/plans';
import { getStripe } from '@/lib/stripe';

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:sys_billing:read');
    return Response.json({
      plan: access.organization.subscriptionPlan,
      status: access.organization.subscriptionStatus,
      trialEndsAt: access.organization.trialEndsAt,
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('Billing status failed:', error);
    return Response.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:sys_billing:manage', { subscriptionMode: 'read' });
    if (!access.orgId) {
      return Response.json({ error: 'Seleccioná una organización tenant para administrar su plan.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const stripe = getStripe();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    let customerId = access.organization.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: access.email,
        name: access.organization.name,
        metadata: {
          organizationId: access.organization.id,
          clerkOrganizationId: access.orgId,
          product: 'obrasaas',
        },
      });
      customerId = customer.id;
      await getPrisma().organization.update({
        where: { id: access.organization.id },
        data: { stripeCustomerId: customerId },
      });
    }

    if (body.action === 'portal') {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/dashboard`,
      });
      return Response.json({ url: portal.url });
    }

    if (body.plan !== 'PRO') {
      return Response.json({ error: 'Enterprise requiere una implementación comercial asistida.' }, { status: 400 });
    }

    const annual = body.billingCycle === 'annual';
    const pro = PLAN_CATALOG.PRO;
    const amount = annual
      ? pro.priceAnnualMonthly * 12 * 100
      : pro.priceMonthly * 100;
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      allow_promotion_codes: true,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval: annual ? 'year' : 'month' },
          product_data: {
            name: `ObraSaaS ${pro.name}`,
            description: annual
              ? 'Suscripción anual para una organización ObraSaaS.'
              : 'Suscripción mensual para una organización ObraSaaS.',
          },
        },
      }],
      metadata: {
        organizationId: access.organization.id,
        clerkOrganizationId: access.orgId,
        plan: 'PRO',
        billingCycle: annual ? 'annual' : 'monthly',
      },
      subscription_data: {
        metadata: {
          organizationId: access.organization.id,
          clerkOrganizationId: access.orgId,
          plan: 'PRO',
        },
      },
      success_url: `${appUrl}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard?billing=canceled`,
    });
    return Response.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY')) {
      return Response.json(
        { error: 'Stripe todavía no está conectado para esta instalación.', code: 'BILLING_NOT_CONFIGURED' },
        { status: 503 },
      );
    }
    console.error('Billing endpoint error:', error);
    return Response.json({ error: 'Failed to update billing' }, { status: 500 });
  }
}
