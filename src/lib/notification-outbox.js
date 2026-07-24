const CHANNELS = new Set(['IN_APP', 'EMAIL', 'WHATSAPP']);
const MAX_ATTEMPTS = 8;

export class NotificationOutboxError extends Error {
  constructor(message, code = 'NOTIFICATION_OUTBOX_INVALID', status = 400) { super(message); this.name = 'NotificationOutboxError'; this.code = code; this.status = status; }
}

function text(value, field, max) { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new NotificationOutboxError(`${field} inválido.`); return value.trim(); }
function channel(value) { const result = text(value, 'channel', 20).toUpperCase(); if (!CHANNELS.has(result)) throw new NotificationOutboxError('Canal de notificación inválido.'); return result; }

export async function enqueueNotification(prisma, input) {
  const organizationId = text(input.organizationId, 'organizationId', 190); const recipientId = text(input.recipientId, 'recipientId', 190); const eventKey = text(input.eventKey, 'eventKey', 190); const selectedChannel = channel(input.channel); const title = text(input.title, 'title', 220); const body = text(input.body, 'body', 10000);
  if (selectedChannel !== 'IN_APP') {
    const preference = await prisma.notificationPreference.findUnique({ where: { userId_channel: { userId: recipientId, channel: selectedChannel } }, select: { enabled: true } });
    if (preference?.enabled !== true) return null;
  }
  const row = await prisma.notificationDelivery.upsert({ where: { recipientId_channel_eventKey: { recipientId, channel: selectedChannel, eventKey } }, create: { organizationId, projectId: input.projectId || null, recipientId, eventKey, channel: selectedChannel, title, body, payload: input.payload || null }, update: {} });
  return row;
}

export async function claimDueNotifications(prisma, { organizationId, channel: selectedChannel = null, limit = 50, now = new Date(), leaseMinutes = 5 } = {}) {
  const rows = await prisma.notificationDelivery.findMany({ where: { organizationId, ...(selectedChannel ? { channel: selectedChannel } : {}), status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } }, orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }], take: Math.min(Math.max(Number(limit) || 50, 1), 100) });
  const claimed = []; const leasedAt = now; const nextAttemptAt = new Date(now.getTime() + leaseMinutes * 60_000);
  for (const row of rows) { const result = await prisma.notificationDelivery.updateMany({ where: { id: row.id, status: row.status, attempts: row.attempts }, data: { status: 'PROCESSING', leasedAt, attempts: { increment: 1 }, nextAttemptAt } }); if (result.count === 1) claimed.push({ ...row, status: 'PROCESSING', leasedAt, attempts: row.attempts + 1 }); }
  return claimed;
}

export async function markNotificationSent(prisma, { id, now = new Date() }) { return prisma.notificationDelivery.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'SENT', sentAt: now, leasedAt: null, lastError: null } }); }
export async function markNotificationFailed(prisma, { id, error, now = new Date() }) { const row = await prisma.notificationDelivery.findUnique({ where: { id } }); if (!row || row.status !== 'PROCESSING') return { count: 0 }; const terminal = row.attempts >= MAX_ATTEMPTS; const delay = Math.min(60 * 60_000, 2 ** Math.min(row.attempts, 10) * 1_000); return prisma.notificationDelivery.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: terminal ? 'DEAD_LETTER' : 'FAILED', nextAttemptAt: new Date(now.getTime() + delay), leasedAt: null, lastError: String(error?.message || error || 'Unknown notification failure').slice(0, 2_000) } }); }

export async function listUserNotifications(prisma, { organizationId, recipientId, projectId = null, limit = 50 } = {}) { return prisma.notificationDelivery.findMany({ where: { organizationId, recipientId, ...(projectId ? { projectId } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: Math.min(Math.max(Number(limit) || 50, 1), 100), select: { id: true, projectId: true, eventKey: true, channel: true, status: true, title: true, body: true, payload: true, createdAt: true, readAt: true } }); }
export async function markNotificationRead(prisma, { organizationId, recipientId, id, now = new Date() }) { return prisma.notificationDelivery.updateMany({ where: { id, organizationId, recipientId, status: { in: ['SENT', 'FAILED'] } }, data: { status: 'READ', readAt: now } }); }
export async function listNotificationPreferences(prisma, { userId }) { const rows = await prisma.notificationPreference.findMany({ where: { userId }, orderBy: { channel: 'asc' } }); const byChannel = new Map(rows.map((row) => [row.channel, row])); return ['IN_APP', 'EMAIL', 'WHATSAPP'].map((channelName) => ({ channel: channelName, enabled: byChannel.get(channelName)?.enabled ?? channelName === 'IN_APP', quietHours: byChannel.get(channelName)?.quietHours || null })); }
export async function updateNotificationPreference(prisma, { userId, channel: selectedChannel, enabled, quietHours = null }) { const selected = channel(selectedChannel); if (typeof enabled !== 'boolean') throw new NotificationOutboxError('enabled debe ser booleano.'); if (selected === 'IN_APP' && !enabled) throw new NotificationOutboxError('El canal in-app no puede desactivarse.'); return prisma.notificationPreference.upsert({ where: { userId_channel: { userId, channel: selected } }, create: { userId, channel: selected, enabled, quietHours }, update: { enabled, quietHours } }); }

export function notificationOutboxErrorResponse(error) { if (!(error instanceof NotificationOutboxError)) return null; return Response.json({ error: error.message, code: error.code }, { status: error.status }); }
