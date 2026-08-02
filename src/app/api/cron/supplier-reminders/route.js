import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { readResendEmailConfig, resendConfigurationErrorResponse } from '@/lib/email/resend';
import { getPrisma } from '@/lib/prisma';
import { processSupplierReminders } from '@/lib/supplier-reminder-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

function safeMetrics(result) {
  const count = (value) => Math.max(0, Math.trunc(Number(value) || 0));
  const health = result?.health && typeof result.health === 'object' ? result.health : {};
  const terminalDeliveryIssues = ['BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED']
    .reduce((sum, status) => sum + count(health[status]), 0);
  return {
    recoveredClaims: count(result?.recoveredClaims),
    recoveredUncertain: count(result?.recoveredUncertain),
    reconciledWebhooks: count(result?.reconciledWebhooks),
    claimed: count(result?.claimed),
    providerAccepted: count(result?.providerAccepted),
    retryableFailed: count(result?.retryableFailed),
    deadLetter: count(result?.deadLetter),
    uncertain: count(result?.uncertain),
    conflict: count(result?.conflict),
    cancelled: count(result?.cancelled),
    hasMore: result?.hasMore === true,
    terminalDeliveryIssues,
    health,
  };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ ok: false, status: 'unavailable', code: 'SUPPLIER_REMINDER_CRON_NOT_CONFIGURED' }, 503);
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), secret)) {
    return json({ ok: false, status: 'unauthorized', code: 'UNAUTHORIZED' }, 401);
  }
  let config;
  try {
    config = readResendEmailConfig();
  } catch (error) {
    const response = resendConfigurationErrorResponse(error);
    if (response) {
      response.headers.set('Cache-Control', 'private, no-store, max-age=0');
      return response;
    }
    throw error;
  }
  try {
    const metrics = safeMetrics(await processSupplierReminders(getPrisma(), { config, limit: 4 }));
    const degraded = metrics.hasMore
      || metrics.uncertain > 0
      || metrics.conflict > 0
      || metrics.deadLetter > 0
      || metrics.terminalDeliveryIssues > 0;
    return json({
      ok: true,
      status: degraded ? 'degraded' : 'healthy',
      ...(degraded ? { code: metrics.uncertain > 0
        ? 'SUPPLIER_REMINDER_UNCERTAIN'
        : metrics.conflict > 0
          ? 'SUPPLIER_REMINDER_IDEMPOTENCY_CONFLICT'
          : metrics.deadLetter > 0
            ? 'SUPPLIER_REMINDER_DEAD_LETTER'
            : metrics.terminalDeliveryIssues > 0
              ? 'SUPPLIER_REMINDER_DELIVERY_INCIDENT'
            : 'SUPPLIER_REMINDER_BACKLOG' } : {}),
      ...metrics,
    });
  } catch {
    console.error('Supplier reminder worker failed');
    return json({ ok: false, status: 'failed', code: 'SUPPLIER_REMINDER_WORKER_FAILED' }, 500);
  }
}
