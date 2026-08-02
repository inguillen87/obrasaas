const CHANNELS = new Set(['IN_APP', 'EMAIL', 'WHATSAPP']);
const PORTFOLIO_ROLES = new Set(['ADMIN', 'DIRECTOR']);
const MAX_ATTEMPTS = 8;
const EXPIRED_EXTERNAL_LEASE_ERROR = 'Notification dispatch lease expired after the provider boundary; manual reconciliation is required.';

export class NotificationOutboxError extends Error {
  constructor(message, code = 'NOTIFICATION_OUTBOX_INVALID', status = 400) {
    super(message);
    this.name = 'NotificationOutboxError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new NotificationOutboxError(`${field} inválido.`);
  }
  return value.trim();
}

function optionalText(value, field, max) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, max);
}

function channel(value) {
  const result = text(value, 'channel', 20).toUpperCase();
  if (!CHANNELS.has(result)) {
    throw new NotificationOutboxError('Canal de notificación inválido.');
  }
  return result;
}

function trustedDate(value, field = 'now') {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw new NotificationOutboxError(`${field} inválido.`);
  }
  return result;
}

async function requireRecipientScope(prisma, { organizationId, projectId, recipientId }) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { organizationId, userId: recipientId, status: 'ACTIVE' },
    select: {
      id: true,
      tenantRole: true,
      ...(projectId ? {
        projectMemberships: {
          where: { projectId, status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      } : {}),
    },
  });
  if (!membership) {
    throw new NotificationOutboxError(
      'El destinatario no pertenece activamente a la organización.',
      'NOTIFICATION_RECIPIENT_SCOPE',
      409,
    );
  }
  if (!projectId) return membership;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true },
  });
  if (!project) {
    throw new NotificationOutboxError(
      'La obra no pertenece a la organización de la notificación.',
      'NOTIFICATION_PROJECT_SCOPE',
      409,
    );
  }
  if (!PORTFOLIO_ROLES.has(membership.tenantRole) && membership.projectMemberships?.length !== 1) {
    throw new NotificationOutboxError(
      'El destinatario no tiene acceso activo a la obra.',
      'NOTIFICATION_PROJECT_RECIPIENT_SCOPE',
      409,
    );
  }
  return membership;
}

export async function enqueueNotification(prisma, input) {
  const organizationId = text(input.organizationId, 'organizationId', 190);
  const projectId = optionalText(input.projectId, 'projectId', 190);
  const recipientId = text(input.recipientId, 'recipientId', 190);
  const eventKey = text(input.eventKey, 'eventKey', 190);
  const selectedChannel = channel(input.channel);
  const title = text(input.title, 'title', 220);
  const body = text(input.body, 'body', 10_000);
  const now = trustedDate(input.now ?? new Date());

  await requireRecipientScope(prisma, { organizationId, projectId, recipientId });

  if (selectedChannel !== 'IN_APP') {
    const preference = await prisma.notificationPreference.findUnique({
      where: { userId_channel: { userId: recipientId, channel: selectedChannel } },
      select: { enabled: true },
    });
    if (preference?.enabled !== true) return null;
  }

  const inApp = selectedChannel === 'IN_APP';
  return prisma.notificationDelivery.upsert({
    where: {
      organizationId_recipientId_channel_eventKey: {
        organizationId,
        recipientId,
        channel: selectedChannel,
        eventKey,
      },
    },
    create: {
      organizationId,
      projectId,
      recipientId,
      eventKey,
      channel: selectedChannel,
      status: inApp ? 'SENT' : 'PENDING',
      title,
      body,
      payload: input.payload || null,
      nextAttemptAt: now,
      sentAt: inApp ? now : null,
    },
    update: {},
  });
}

export async function recoverExpiredNotificationLeases(prisma, {
  organizationId: rawOrganizationId,
  channel: rawChannel = null,
  now: rawNow = new Date(),
} = {}) {
  const organizationId = text(rawOrganizationId, 'organizationId', 190);
  const selectedChannel = rawChannel ? channel(rawChannel) : null;
  const now = trustedDate(rawNow);
  const baseWhere = {
    organizationId,
    status: 'PROCESSING',
    nextAttemptAt: { lte: now },
  };
  let inAppDelivered = 0;
  let externalQuarantined = 0;

  if (!selectedChannel || selectedChannel === 'IN_APP') {
    const result = await prisma.notificationDelivery.updateMany({
      where: { ...baseWhere, channel: 'IN_APP' },
      data: { status: 'SENT', sentAt: now, leasedAt: null, lastError: null },
    });
    inAppDelivered = result.count;
  }

  if (!selectedChannel || selectedChannel !== 'IN_APP') {
    const externalChannels = selectedChannel ? selectedChannel : { in: ['EMAIL', 'WHATSAPP'] };
    const result = await prisma.notificationDelivery.updateMany({
      where: { ...baseWhere, channel: externalChannels },
      data: {
        status: 'DEAD_LETTER',
        leasedAt: null,
        lastError: EXPIRED_EXTERNAL_LEASE_ERROR,
      },
    });
    externalQuarantined = result.count;
  }

  return {
    inAppDelivered,
    externalQuarantined,
    total: inAppDelivered + externalQuarantined,
  };
}

export async function claimDueNotifications(prisma, {
  organizationId: rawOrganizationId,
  channel: rawChannel = null,
  limit = 50,
  now: rawNow = new Date(),
  leaseMinutes = 5,
} = {}) {
  const organizationId = text(rawOrganizationId, 'organizationId', 190);
  const selectedChannel = rawChannel ? channel(rawChannel) : null;
  const now = trustedDate(rawNow);
  const rows = await prisma.notificationDelivery.findMany({
    where: {
      organizationId,
      ...(selectedChannel ? { channel: selectedChannel } : {}),
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(Math.max(Number(limit) || 50, 1), 100),
  });
  const claimed = [];
  const leasedAt = now;
  const nextAttemptAt = new Date(now.getTime() + leaseMinutes * 60_000);
  for (const row of rows) {
    const result = await prisma.notificationDelivery.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: {
        status: 'PROCESSING',
        leasedAt,
        attempts: { increment: 1 },
        nextAttemptAt,
      },
    });
    if (result.count === 1) {
      claimed.push({
        ...row,
        status: 'PROCESSING',
        leasedAt,
        attempts: row.attempts + 1,
      });
    }
  }
  return claimed;
}

export async function markNotificationSent(prisma, { id, now = new Date() }) {
  return prisma.notificationDelivery.updateMany({
    where: { id, status: 'PROCESSING' },
    data: { status: 'SENT', sentAt: now, leasedAt: null, lastError: null },
  });
}

export async function markNotificationFailed(prisma, { id, error, now = new Date() }) {
  const row = await prisma.notificationDelivery.findUnique({ where: { id } });
  if (!row || row.status !== 'PROCESSING') return { count: 0 };
  const terminal = row.attempts >= MAX_ATTEMPTS;
  const delay = Math.min(60 * 60_000, 2 ** Math.min(row.attempts, 10) * 1_000);
  return prisma.notificationDelivery.updateMany({
    where: { id, status: 'PROCESSING' },
    data: {
      status: terminal ? 'DEAD_LETTER' : 'FAILED',
      nextAttemptAt: new Date(now.getTime() + delay),
      leasedAt: null,
      lastError: String(error?.message || error || 'Unknown notification failure').slice(0, 2_000),
    },
  });
}

export async function listUserNotifications(prisma, {
  organizationId: rawOrganizationId,
  recipientId: rawRecipientId,
  projectId: rawProjectId = null,
  limit = 50,
} = {}) {
  const organizationId = text(rawOrganizationId, 'organizationId', 190);
  const recipientId = text(rawRecipientId, 'recipientId', 190);
  const projectId = optionalText(rawProjectId, 'projectId', 190);
  return prisma.notificationDelivery.findMany({
    where: { organizationId, recipientId, ...(projectId ? { projectId } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(Number(limit) || 50, 1), 100),
    select: {
      id: true,
      projectId: true,
      eventKey: true,
      channel: true,
      status: true,
      title: true,
      body: true,
      payload: true,
      createdAt: true,
      readAt: true,
    },
  });
}

export async function markNotificationRead(prisma, {
  organizationId: rawOrganizationId,
  recipientId: rawRecipientId,
  id: rawId,
  now: rawNow = new Date(),
} = {}) {
  const organizationId = text(rawOrganizationId, 'organizationId', 190);
  const recipientId = text(rawRecipientId, 'recipientId', 190);
  const id = text(rawId, 'id', 190);
  const now = trustedDate(rawNow);
  const scope = {
    id,
    organizationId,
    recipientId,
    channel: 'IN_APP',
    status: 'SENT',
  };
  const current = await prisma.notificationDelivery.findFirst({
    where: scope,
    select: { readAt: true },
  });
  if (!current) {
    throw new NotificationOutboxError(
      'La notificación no existe dentro del alcance activo.',
      'NOTIFICATION_NOT_FOUND',
      404,
    );
  }
  if (current.readAt) {
    return { marked: true, replayed: true, readAt: current.readAt };
  }

  const mutation = await prisma.notificationDelivery.updateMany({
    where: { ...scope, readAt: null },
    data: { readAt: now },
  });
  const persisted = await prisma.notificationDelivery.findFirst({
    where: scope,
    select: { readAt: true },
  });
  if (!persisted?.readAt) {
    throw new NotificationOutboxError(
      'La lectura cambió concurrentemente; recargá antes de continuar.',
      'NOTIFICATION_READ_CONFLICT',
      409,
    );
  }
  return {
    marked: true,
    replayed: mutation.count !== 1,
    readAt: persisted.readAt,
  };
}

export async function listNotificationPreferences(prisma, { userId }) {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    orderBy: { channel: 'asc' },
  });
  const byChannel = new Map(rows.map((row) => [row.channel, row]));
  return ['IN_APP', 'EMAIL', 'WHATSAPP'].map((channelName) => ({
    channel: channelName,
    enabled: byChannel.get(channelName)?.enabled ?? channelName === 'IN_APP',
    quietHours: byChannel.get(channelName)?.quietHours || null,
  }));
}

export async function updateNotificationPreference(prisma, {
  userId,
  channel: selectedChannel,
  enabled,
  quietHours = null,
}) {
  const selected = channel(selectedChannel);
  if (typeof enabled !== 'boolean') {
    throw new NotificationOutboxError('enabled debe ser booleano.');
  }
  if (selected === 'IN_APP' && !enabled) {
    throw new NotificationOutboxError('El canal in-app no puede desactivarse.');
  }
  return prisma.notificationPreference.upsert({
    where: { userId_channel: { userId, channel: selected } },
    create: { userId, channel: selected, enabled, quietHours },
    update: { enabled, quietHours },
  });
}

export function notificationOutboxErrorResponse(error) {
  if (!(error instanceof NotificationOutboxError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
