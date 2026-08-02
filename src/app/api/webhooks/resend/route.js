import { readResendWebhookConfig, resendConfigurationErrorResponse } from '@/lib/email/resend';
import { getPrisma } from '@/lib/prisma';
import {
  decodeUtf8RequestBytes,
  readLimitedRequestBytes,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  applySupplierReminderWebhook,
  supplierReminderWebhookErrorResponse,
  verifyResendWebhook,
} from '@/lib/supplier-reminder-webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function POST(request) {
  try {
    const { webhookSecrets } = readResendWebhookConfig();
    const rawBody = decodeUtf8RequestBytes(await readLimitedRequestBytes(request, {
      maxBytes: 256 * 1024,
    }));
    const verified = verifyResendWebhook({ rawBody, headers: request.headers, webhookSecrets });
    const result = await applySupplierReminderWebhook(getPrisma(), { ...verified, rawBody });
    return json({ ok: true, matched: result.matched, applied: result.applied });
  } catch (error) {
    const known = supplierReminderWebhookErrorResponse(error)
      || resendConfigurationErrorResponse(error)
      || requestBodyErrorResponse(error);
    if (known) {
      known.headers.set('Cache-Control', 'private, no-store, max-age=0');
      return known;
    }
    console.error('Supplier reminder webhook failed');
    return json({ ok: false, code: 'SUPPLIER_REMINDER_WEBHOOK_FAILED' }, 500);
  }
}
