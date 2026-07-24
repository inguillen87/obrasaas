import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { listProjectExecution } from '@/lib/project-execution';
import { getPrisma } from '@/lib/prisma';
import ExecutionClient from './execution-client';
import styles from './execution.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cuadrillas y blockers', description: 'Responsables, equipos y bloqueos trazables por obra.' };

export default async function ExecutionPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  const prisma = getPrisma();
  const [execution, workers, canonicalTasks] = await Promise.all([
    listProjectExecution(prisma, { projectId: access.project.id }),
    prisma.worker.findMany({ where: { projectId: access.project.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
    listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }),
  ]);
  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>Ejecución trazable</span><h1>Cuadrillas, responsables y blockers</h1><p>Una asignación pertenece a una obra y a una versión del plan. Un blocker siempre tiene estado, severidad y dueño verificable.</p></div>
        <div className={styles.context}><strong>{access.project.name}</strong><span>Scope aislado por organización y obra</span></div>
      </header>
      <ExecutionClient
        initialData={execution}
        workers={workers}
        tasks={canonicalTasks.tasks}
        permissions={{ canManage: hasTenantPermission(access, 'org:execution:manage') }}
      />
    </main>
  );
}
