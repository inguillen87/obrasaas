// POST /api/billing/webhook — Mercado Pago IPN & Webhook listener
import { getAppState, saveAppState } from '@/lib/db';
import { paymentClient } from '@/lib/mercadopago';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || searchParams.get('topic');
    const paymentId = searchParams.get('data.id') || searchParams.get('id');

    if (type === 'payment' && paymentId) {
      const state = await getAppState();
      let paymentInfo = null;

      try {
        paymentInfo = await paymentClient.get({ id: paymentId });
      } catch (e) {
        console.warn('Could not fetch MP payment details:', e.message);
      }

      if (paymentInfo && paymentInfo.status === 'approved') {
        const extRef = paymentInfo.external_reference || '';
        let targetPlan = 'professional';
        if (extRef.includes('starter')) targetPlan = 'starter';
        if (extRef.includes('enterprise')) targetPlan = 'enterprise';

        state.subscription = {
          plan: targetPlan,
          status: 'active',
          lastPaymentId: paymentId,
          amountPaid: paymentInfo.transaction_amount,
          currency: paymentInfo.currency_id,
          updatedAt: new Date().toISOString()
        };

        state.auditLedger = appendAuditTransaction(state.auditLedger, {
          action: "PAGO_SUSCRIPCION_MERCADOPAGO",
          actor: "MercadoPago Webhook",
          details: { plan: targetPlan, paymentId, amount: paymentInfo.transaction_amount }
        });

        await saveAppState(state);
      }
    }

    return Response.json({ received: true, status: 'processed' });
  } catch (err) {
    console.error('Mercado Pago Webhook error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
