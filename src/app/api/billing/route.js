import { AccessError, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { PLAN_CATALOG } from '@/lib/plans';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { getStripe } from '@/lib/stripe';

const MAX_BILLING_JSON_BYTES = 8 * 1024;
const BILLING_ACTIONS = new Set(['checkout', 'portal']);
const BILLING_CYCLES = new Set(['annual', 'monthly']);
const PORTAL_FIELDS = new Set(['action']);
const CHECKOUT_FIELDS = new Set([
  'action',
  'billingCycle',
  'plan',
  'pricingVersion',
  'termsAccepted',
  'termsVersion',
]);

export const BILLING_TERMS_VERSION = '2026-07-23';
export const BILLING_PRICING_VERSION = '2026-07-15';

export class BillingRequestError extends Error {
  constructor(message, { code = 'BILLING_REQUEST_INVALID', status = 400 } = {}) {
    super(message);
    this.name = 'BillingRequestError';
    this.code = code;
    this.status = status;
  }
}

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });
}

function billingRequestErrorResponse(error) {
  return json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

function assertPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BillingRequestError('La solicitud de facturación no es válida.');
  }
}

function assertAllowedFields(body, allowedFields) {
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new BillingRequestError('La solicitud contiene campos de facturación no admitidos.');
  }
}

export function normalizeBillingRequest(body) {
  assertPlainObject(body);
  if (!BILLING_ACTIONS.has(body.action)) {
    throw new BillingRequestError('La acción de facturación no es válida.', {
      code: 'BILLING_ACTION_INVALID',
    });
  }

  if (body.action === 'portal') {
    assertAllowedFields(body, PORTAL_FIELDS);
    return { action: 'portal' };
  }

  assertAllowedFields(body, CHECKOUT_FIELDS);
  if (body.plan !== 'PRO') {
    throw new BillingRequestError('Enterprise requiere una implementación comercial asistida.');
  }
  if (!BILLING_CYCLES.has(body.billingCycle)) {
    throw new BillingRequestError('Elegí facturación mensual o anual.');
  }
  if (
    body.termsVersion !== BILLING_TERMS_VERSION
    || body.pricingVersion !== BILLING_PRICING_VERSION
  ) {
    throw new BillingRequestError(
      'Las condiciones o el precio cambiaron. Volvé a revisar la información vigente antes de continuar.',
      { code: 'BILLING_DISCLOSURE_OUTDATED', status: 409 },
    );
  }
  if (body.termsAccepted !== true) {
    throw new BillingRequestError(
      'Debés aceptar expresamente las condiciones de la suscripción antes de continuar.',
      { code: 'BILLING_CONSENT_REQUIRED' },
    );
  }

  return {
    action: 'checkout',
    billingCycle: body.billingCycle,
    plan: 'PRO',
    pricingVersion: BILLING_PRICING_VERSION,
    termsAccepted: true,
    termsVersion: BILLING_TERMS_VERSION,
  };
}

export function isStripeCheckoutEnabled(environment = process.env) {
  return environment.STRIPE_CHECKOUT_ENABLED === 'true';
}

function applicationUrl(environment) {
  return (environment.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function createBillingHandlers({
  environment = process.env,
  prismaFactory = getPrisma,
  resolveAccess = getPlatformAccess,
  stripeFactory = getStripe,
} = {}) {
  async function GET() {
    try {
      const access = await resolveAccess();
      requireTenantPermission(access, 'org:sys_billing:read');
      return json({
        plan: access.organization.subscriptionPlan,
        status: access.organization.subscriptionStatus,
        trialEndsAt: access.organization.trialEndsAt,
        checkout: {
          enabled: isStripeCheckoutEnabled(environment),
          pricingVersion: BILLING_PRICING_VERSION,
          termsVersion: BILLING_TERMS_VERSION,
        },
        portalAvailable: Boolean(access.organization.stripeCustomerId),
      });
    } catch (error) {
      if (error instanceof AccessError) {
        return json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      console.error('Billing status failed:', error);
      return json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }
  }

  async function POST(request) {
    try {
      const access = await resolveAccess();
      requireTenantPermission(access, 'org:sys_billing:manage', { subscriptionMode: 'read' });
      if (!access.orgId) {
        return json(
          { error: 'Seleccioná una organización tenant para administrar su plan.' },
          { status: 400 },
        );
      }

      const input = normalizeBillingRequest(await readJsonRequest(request, {
        maxBytes: MAX_BILLING_JSON_BYTES,
      }));
      const appUrl = applicationUrl(environment);

      if (input.action === 'portal') {
        const customerId = access.organization.stripeCustomerId;
        if (!customerId) {
          return json(
            {
              error: 'La organización todavía no tiene una cuenta de facturación administrable.',
              code: 'BILLING_PORTAL_UNAVAILABLE',
            },
            { status: 409 },
          );
        }
        const portal = await stripeFactory().billingPortal.sessions.create({
          customer: customerId,
          return_url: `${appUrl}/dashboard`,
        });
        return json({ url: portal.url });
      }

      if (!isStripeCheckoutEnabled(environment)) {
        return json(
          {
            error: 'La contratación online todavía no está habilitada. Solicitá un piloto asistido.',
            code: 'BILLING_CHECKOUT_DISABLED',
          },
          { status: 503 },
        );
      }
      if (access.organization.stripeSubscriptionId) {
        return json(
          {
            error: 'La organización ya tiene una suscripción vinculada. Administrala desde el portal.',
            code: 'BILLING_SUBSCRIPTION_EXISTS',
          },
          { status: 409 },
        );
      }

      const stripe = stripeFactory();
      const prisma = prismaFactory();
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
        await prisma.organization.update({
          where: { id: access.organization.id },
          data: { stripeCustomerId: customerId },
        });
      }

      const annual = input.billingCycle === 'annual';
      const pro = PLAN_CATALOG.PRO;
      const amount = annual
        ? pro.priceAnnualMonthly * 12 * 100
        : pro.priceMonthly * 100;
      const checkoutMetadata = {
        organizationId: access.organization.id,
        clerkOrganizationId: access.orgId,
        plan: 'PRO',
        billingCycle: input.billingCycle,
        pricingVersion: BILLING_PRICING_VERSION,
        termsAccepted: 'true',
        termsVersion: BILLING_TERMS_VERSION,
      };
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
        metadata: checkoutMetadata,
        subscription_data: {
          metadata: checkoutMetadata,
        },
        success_url: `${appUrl}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/dashboard?billing=canceled`,
      });
      return json({ url: checkout.url });
    } catch (error) {
      if (error instanceof AccessError) {
        return json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
      if (error instanceof BillingRequestError) return billingRequestErrorResponse(error);
      if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY')) {
        return json(
          {
            error: 'Stripe todavía no está conectado para esta instalación.',
            code: 'BILLING_NOT_CONFIGURED',
          },
          { status: 503 },
        );
      }
      console.error('Billing endpoint error:', error);
      return json({ error: 'Failed to update billing' }, { status: 500 });
    }
  }

  return { GET, POST };
}

const billingHandlers = createBillingHandlers();

export const GET = billingHandlers.GET;
export const POST = billingHandlers.POST;
