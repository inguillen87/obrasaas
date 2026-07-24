import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { getPrisma } from '@/lib/prisma';
import { processInAppNotifications } from '@/lib/notification-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request) { const secret = process.env.CRON_SECRET; if (!secret) return Response.json({ error: 'Notification cron is not configured' }, { status: 503 }); if (!isAuthorizedCronRequest(request.headers.get('authorization'), secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 }); try { return Response.json({ ok: true, ...(await processInAppNotifications(getPrisma())) }, { headers: { 'Cache-Control': 'private, no-store' } }); } catch (error) { return Response.json({ ok: false, error: 'Notification worker failed', code: 'NOTIFICATION_WORKER_FAILED' }, { status: 500 }); } }
