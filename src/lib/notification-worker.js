import { claimDueNotifications, markNotificationSent } from './notification-outbox.js';

export async function processInAppNotifications(prisma, { maxOrganizations = 20, maxPerOrganization = 100 } = {}) {
  const organizations = await prisma.organization.findMany({ where: { notificationDeliveries: { some: { channel: 'IN_APP', status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: new Date() } } } }, select: { id: true }, take: maxOrganizations });
  let claimed = 0; let sent = 0;
  for (const organization of organizations) {
    const rows = await claimDueNotifications(prisma, { organizationId: organization.id, channel: 'IN_APP', limit: maxPerOrganization });
    claimed += rows.length;
    for (const row of rows) { const result = await markNotificationSent(prisma, { id: row.id }); if (result.count === 1) sent += 1; }
  }
  return { organizations: organizations.length, claimed, sent, hasMore: organizations.length === maxOrganizations };
}
