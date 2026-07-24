import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-nextjs-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const {
  BILLING_PRICING_VERSION,
  BILLING_TERMS_VERSION,
  createBillingHandlers,
  isStripeCheckoutEnabled,
} = await import('../src/app/api/billing/route.js');

function tenantAccess(organization = {}) {
  return {
    databaseUserId: 'user-database-admin',
    email: 'admin@constructora.test',
    isSuperadmin: false,
    orgId: 'org_clerk_tenant',
    tenantRole: 'ADMIN',
    subscription: { canRead: true, canWrite: true },
    organization: {
      id: 'organization-tenant',
      name: 'Constructora Test',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-08-01T12:00:00.000Z'),
      ...organization,
    },
  };
}

function billingRequest(body) {
  return new Request('https://app.obrasaas.test/api/billing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function checkoutBody(overrides = {}) {
  return {
    action: 'checkout',
    plan: 'PRO',
    billingCycle: 'monthly',
    pricingVersion: BILLING_PRICING_VERSION,
    termsAccepted: true,
    termsVersion: BILLING_TERMS_VERSION,
    ...overrides,
  };
}

function harness({
  environment = { STRIPE_CHECKOUT_ENABLED: 'false' },
  organization,
  stripeFactoryError,
} = {}) {
  const effects = [];
  const stripe = {
    billingPortal: {
      sessions: {
        async create(input) {
          effects.push(['portal', input]);
          return { url: 'https://billing.stripe.test/portal' };
        },
      },
    },
    checkout: {
      sessions: {
        async create(input) {
          effects.push(['checkout', input]);
          return { url: 'https://checkout.stripe.test/session' };
        },
      },
    },
    customers: {
      async create(input) {
        effects.push(['customer', input]);
        return { id: 'cus_created' };
      },
    },
  };
  const prisma = {
    organization: {
      async update(input) {
        effects.push(['organization-update', input]);
        return input.data;
      },
    },
  };
  const handlers = createBillingHandlers({
    environment,
    prismaFactory() {
      effects.push(['prisma-factory']);
      return prisma;
    },
    async resolveAccess() {
      return tenantAccess(organization);
    },
    stripeFactory() {
      effects.push(['stripe-factory']);
      if (stripeFactoryError) throw stripeFactoryError;
      return stripe;
    },
  });
  return { effects, handlers };
}

test('Stripe checkout is fail-closed unless the flag is the exact string true', () => {
  for (const value of [undefined, '', 'TRUE', '1', 'yes', true]) {
    assert.equal(isStripeCheckoutEnabled({ STRIPE_CHECKOUT_ENABLED: value }), false);
  }
  assert.equal(isStripeCheckoutEnabled({ STRIPE_CHECKOUT_ENABLED: 'true' }), true);
});

test('billing GET remains available without Stripe and is explicitly non-cacheable', async () => {
  const { effects, handlers } = harness();
  const response = await handlers.GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(payload.plan, 'TRIAL');
  assert.equal(payload.checkout.enabled, false);
  assert.equal(payload.checkout.pricingVersion, BILLING_PRICING_VERSION);
  assert.equal(payload.checkout.termsVersion, BILLING_TERMS_VERSION);
  assert.equal(payload.portalAvailable, false);
  assert.deepEqual(effects, []);
});

test('unknown actions and fields fail before any Stripe or database effect', async () => {
  const invalidBodies = [
    { plan: 'PRO', billingCycle: 'monthly', termsAccepted: true },
    { action: 'upgrade', plan: 'PRO', billingCycle: 'monthly', termsAccepted: true },
    { action: 'portal', amount: 19900 },
    checkoutBody({
      priceId: 'price_client_controlled',
    }),
  ];

  for (const body of invalidBodies) {
    const { effects, handlers } = harness();
    const response = await handlers.POST(billingRequest(body));
    assert.equal(response.status, 400);
    assert.deepEqual(effects, []);
  }
});

test('a valid checkout request is blocked before initializing Stripe or Prisma by default', async () => {
  const { effects, handlers } = harness();
  const response = await handlers.POST(billingRequest(checkoutBody()));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, 'BILLING_CHECKOUT_DISABLED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(effects, []);
});

test('checkout validates plan, billing cycle and explicit consent without side effects', async () => {
  const invalidBodies = [
    {
      body: checkoutBody({ plan: 'ENTERPRISE' }),
      code: 'BILLING_REQUEST_INVALID',
    },
    {
      body: checkoutBody({ billingCycle: 'quarterly' }),
      code: 'BILLING_REQUEST_INVALID',
    },
    {
      body: checkoutBody({ billingCycle: 'annual', termsAccepted: false }),
      code: 'BILLING_CONSENT_REQUIRED',
    },
  ];

  for (const scenario of invalidBodies) {
    const { effects, handlers } = harness({
      environment: { STRIPE_CHECKOUT_ENABLED: 'true' },
    });
    const response = await handlers.POST(billingRequest(scenario.body));
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.code, scenario.code);
    assert.deepEqual(effects, []);
  }
});

test('checkout rejects missing or stale legal and pricing versions before side effects', async () => {
  const missingTermsVersion = checkoutBody();
  delete missingTermsVersion.termsVersion;
  const missingPricingVersion = checkoutBody();
  delete missingPricingVersion.pricingVersion;
  const invalidBodies = [
    missingTermsVersion,
    missingPricingVersion,
    checkoutBody({ termsVersion: '2026-07-22' }),
    checkoutBody({ pricingVersion: '2026-07-14' }),
  ];

  for (const body of invalidBodies) {
    const { effects, handlers } = harness({
      environment: { STRIPE_CHECKOUT_ENABLED: 'true' },
    });
    const response = await handlers.POST(billingRequest(body));
    const payload = await response.json();
    assert.equal(response.status, 409);
    assert.equal(payload.code, 'BILLING_DISCLOSURE_OUTDATED');
    assert.deepEqual(effects, []);
  }
});

test('the billing portal works with checkout disabled when a Stripe customer exists', async () => {
  const { effects, handlers } = harness({
    environment: {
      NEXT_PUBLIC_APP_URL: 'https://app.obrasaas.test/',
      STRIPE_CHECKOUT_ENABLED: 'false',
    },
    organization: { stripeCustomerId: 'cus_existing' },
  });
  const response = await handlers.POST(billingRequest({ action: 'portal' }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.url, 'https://billing.stripe.test/portal');
  assert.deepEqual(effects, [
    ['stripe-factory'],
    ['portal', {
      customer: 'cus_existing',
      return_url: 'https://app.obrasaas.test/dashboard',
    }],
  ]);
});

test('the billing portal never creates an empty Stripe customer', async () => {
  const { effects, handlers } = harness();
  const response = await handlers.POST(billingRequest({ action: 'portal' }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'BILLING_PORTAL_UNAVAILABLE');
  assert.deepEqual(effects, []);
});

test('an existing Stripe subscription blocks a second checkout before provider effects', async () => {
  const { effects, handlers } = harness({
    environment: { STRIPE_CHECKOUT_ENABLED: 'true' },
    organization: {
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: 'sub_existing',
    },
  });
  const response = await handlers.POST(billingRequest(checkoutBody()));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'BILLING_SUBSCRIPTION_EXISTS');
  assert.deepEqual(effects, []);
});

test('enabled checkout requires exact current versions and owns the charged price on the server', async () => {
  const { effects, handlers } = harness({
    environment: {
      NEXT_PUBLIC_APP_URL: 'https://app.obrasaas.test/',
      STRIPE_CHECKOUT_ENABLED: 'true',
    },
  });
  const response = await handlers.POST(billingRequest(checkoutBody({ billingCycle: 'annual' })));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.url, 'https://checkout.stripe.test/session');
  assert.deepEqual(effects.map(([name]) => name), [
    'stripe-factory',
    'prisma-factory',
    'customer',
    'organization-update',
    'checkout',
  ]);
  const checkout = effects.find(([name]) => name === 'checkout')[1];
  assert.equal(checkout.customer, 'cus_created');
  assert.equal(checkout.line_items[0].price_data.unit_amount, 159 * 12 * 100);
  assert.equal(checkout.line_items[0].price_data.recurring.interval, 'year');
  assert.equal(checkout.metadata.pricingVersion, BILLING_PRICING_VERSION);
  assert.equal(checkout.metadata.termsAccepted, 'true');
  assert.equal(checkout.metadata.termsVersion, BILLING_TERMS_VERSION);
  assert.deepEqual(checkout.subscription_data.metadata, checkout.metadata);
});

test('portal reports missing Stripe configuration without depending on checkout state', async () => {
  const { effects, handlers } = harness({
    organization: { stripeCustomerId: 'cus_existing' },
    stripeFactoryError: new Error('STRIPE_SECRET_KEY is not configured.'),
  });
  const response = await handlers.POST(billingRequest({ action: 'portal' }));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, 'BILLING_NOT_CONFIGURED');
  assert.deepEqual(effects, [['stripe-factory']]);
});
