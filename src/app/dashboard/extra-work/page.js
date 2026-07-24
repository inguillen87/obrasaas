import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { getPrisma } from '@/lib/prisma';
import { listExtraWork } from '@/lib/extra-work';
import ExtraWorkClient from './extra-work-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trabajo extra', description: 'Solicitudes de trabajo extra con aprobación auditable.' };
export default async function ExtraWorkPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const [data, tasks, workers] = await Promise.all([listExtraWork(prisma, { projectId: access.project.id }), listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }), prisma.worker.findMany({ where: { projectId: access.project.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })]); return <ExtraWorkClient initialData={data.requests} tasks={tasks.tasks} workers={workers} canManage={hasTenantPermission(access, 'org:execution:manage')} projectName={access.project.name} />; }
