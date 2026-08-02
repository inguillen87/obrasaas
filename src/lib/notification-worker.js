import {
  claimDueNotifications,
  markNotificationSent,
  recoverExpiredNotificationLeases,
} from './notification-outbox.js';

export async function processInAppNotifications(prisma, {
  maxOrganizations = 20,
  maxPerOrganization = 100,
  now = new Date(),
} = {}) {
  const organizationLimit = Math.min(Math.max(Number(maxOrganizations) || 20, 1), 100);
  const organizations = await prisma.organization.findMany({
    where: {
      notificationDeliveries: {
        some: {
          channel: 'IN_APP',
          status: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
          nextAttemptAt: { lte: now },
        },
      },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: organizationLimit,
  });
  let recovered = 0;
  let claimed = 0;
  let sent = 0;
  for (const organization of organizations) {
    const recovery = await recoverExpiredNotificationLeases(prisma, {
      organizationId: organization.id,
      channel: 'IN_APP',
      now,
    });
    recovered += recovery.inAppDelivered;
    const rows = await claimDueNotifications(prisma, {
      organizationId: organization.id,
      channel: 'IN_APP',
      limit: maxPerOrganization,
      now,
    });
    claimed += rows.length;
    for (const row of rows) {
      const result = await markNotificationSent(prisma, { id: row.id, now });
      if (result.count === 1) sent += 1;
    }
  }
  const healthRows = await prisma.notificationDelivery.groupBy({
    by: ['status', 'channel'],
    where: { channel: 'IN_APP' },
    _count: { _all: true },
  });
  const health = Object.fromEntries(
    healthRows.map((row) => [`${row.channel}:${row.status}`, row._count._all]),
  );
  return {
    organizations: organizations.length,
    recovered,
    claimed,
    sent,
    hasMore: organizations.length === organizationLimit,
    health,
  };
}
