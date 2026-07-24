import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { getPrisma } from '@/lib/prisma';
import { listExtraWork } from '@/lib/extra-work';
import { listExtraWorkSessions } from '@/lib/extra-work-sessions';
import ExtraWorkClient from './extra-work-client';
import SessionControls from './session-controls';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trabajo extra', description: 'Solicitudes de trabajo extra con aprobación auditable.' };
export default async function ExtraWorkPage() { const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' }); const prisma = getPrisma(); const [data, tasks, workers, sessions] = await Promise.all([listExtraWork(prisma, { projectId: access.project.id }), listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }), prisma.worker.findMany({ where: { projectId: access.project.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }), listExtraWorkSessions(prisma, { projectId: access.project.id })]); return <><ExtraWorkClient initialData={data.requests} tasks={tasks.tasks} workers={workers} canManage={hasTenantPermission(access, 'org:execution:manage')} projectName={access.project.name} /><SessionControls approvedRequests={data.requests.filter((request) => request.status === 'APPROVED')} workers={workers} initialSessions={sessions.sessions} /></>; }
