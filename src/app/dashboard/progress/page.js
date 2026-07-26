import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import { listProgressJournal } from '@/lib/progress-journal';
import ProgressClient from './progress-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bitácora de avance', description: 'Registro diario y evidencia revisable por tarea.' };

export default async function ProgressPage() {
  const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  const prisma = getPrisma();
  const [journal, tasks, workers] = await Promise.all([
    listProgressJournal(prisma, { projectId: access.project.id, includeSourceEvidence: hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION) }),
    listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }),
    prisma.worker.findMany({ where: { projectId: access.project.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return <ProgressClient initialData={journal} tasks={tasks.tasks} workers={workers} permissions={{ canManage: hasTenantPermission(access, 'org:execution:manage') }} projectName={access.project.name} />;
}
