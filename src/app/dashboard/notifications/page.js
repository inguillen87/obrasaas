import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { listUserNotifications } from '@/lib/notification-outbox';
import NotificationsClient from './notifications-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notificaciones', description: 'Alertas operativas de la obra.' };
export default async function NotificationsPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const rows = await listUserNotifications(getPrisma(), { organizationId: access.organization.id, recipientId: access.databaseUserId, projectId: access.project.id, limit: 100 }); return <NotificationsClient initialNotifications={rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() || null }))} projectName={access.project.name} />; }
