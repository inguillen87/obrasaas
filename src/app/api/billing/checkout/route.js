// POST /api/billing/checkout — Creates Mercado Pago Subscription Preference
import { createCheckoutPreference, PLAN_CONFIGS } from '@/lib/mercadopago';
import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { planId = 'professional', userEmail } = body;

    const state = await getAppState();
    const tenantSlug = state.projectConfig?.tenantSlug || 'demo';
    const email = userEmail || state.projectConfig?.directorEmail || 'marcelo@obrasaas.app';

    const preference = await createCheckoutPreference({
      planId,
      tenantSlug,
      userEmail: email
    });

    return Response.json(preference);
  } catch (err) {
    console.error('Billing checkout error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    plans: PLAN_CONFIGS,
    currencies: ['ARS', 'USD'],
    provider: 'Mercado Pago Checkout Pro'
  });
}
