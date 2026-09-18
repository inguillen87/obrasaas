import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { resolvePageAccess } from '@/lib/page-access';
import { getPrisma } from '@/lib/prisma';
import { localDateKey } from '@/lib/zoned-time';
import { deriveWhatsAppChannelPresentation } from '@/lib/whatsapp/channel-presentation';
import FieldClient from './field-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campo móvil', robots: { index: false, follow: false } };
export default async function FieldPage() {
  const access = await resolvePageAccess(async () => {
    const current = await getPlatformAccess();
    requireTenantPermission(current, 'org:execution:read', { subscriptionMode: 'read' });
    return current;
  });
  const prisma = getPrisma();
  const [workers, tasks, connection] = await Promise.all([
    prisma.worker.count({ where: { projectId: access.project.id, active: true } }),
    prisma.task.count({ where: { projectId: access.project.id, metadata: { path: ['source'], equals: 'canonical-task-v1' } } }),
    prisma.whatsAppConnection.findUnique({ where: { projectId: access.project.id }, select: { enabled: true, connectionStatus: true, lastVerifiedAt: true, metadata: true } }),
  ]);
  const channel = deriveWhatsAppChannelPresentation(connection);
  return <FieldClient key={access.organization.id + ':' + access.project.id + ':' + access.databaseUserId}
    project={{ id: access.project.id, name: access.project.name, organization: access.organization.name, status: access.project.status }}
    workDate={localDateKey(new Date(), access.organization.timezone)} counts={{ workers, tasks }}
    channel={{ label: channel.label, summary: channel.summary }} permissions={{
      write: hasTenantPermission(access, 'org:execution:manage') && ['ACTIVE', 'PLANNING', 'PAUSED'].includes(access.project.status),
      integrations: hasTenantPermission(access, 'org:integrations:manage'),
      tasks: hasTenantPermission(access, 'org:tasks:manage'), inbox: hasTenantPermission(access, 'org:conversations:read'),
    }} />;
}
