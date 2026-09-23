import { notFound } from 'next/navigation';
import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { listProjectExecution } from '@/lib/project-execution';
import { getPrisma } from '@/lib/prisma';
import { assignmentAgendaToday } from '@/lib/assignment-agenda';
import ExecutionClient from './execution-client';
import styles from './execution.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cuadrillas y restricciones', description: 'Responsables, equipos y bloqueos trazables por obra.' };

export default async function ExecutionPage({ searchParams }) {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  const params = await searchParams;
  const focusedBlockerId = params?.blockerId ?? null;
  const focusedTaskId = params?.taskId ?? null;
  if (focusedTaskId !== null && (typeof focusedTaskId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(focusedTaskId) || focusedBlockerId)) notFound();
  if (focusedTaskId) requireTenantPermission(access, 'org:tasks:read', { subscriptionMode: 'read' });
  if (focusedBlockerId !== null && (typeof focusedBlockerId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(focusedBlockerId))) notFound();
  const prisma = getPrisma();
  const [execution, workers, canonicalTasks] = await Promise.all([
    listProjectExecution(prisma, { projectId: access.project.id, taskId: focusedTaskId }).catch(error => { if (error.code === 'PROJECT_EXECUTION_TASK_NOT_FOUND') notFound(); throw error; }),
    prisma.worker.findMany({ where: { projectId: access.project.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
    listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }),
  ]);
  if (focusedBlockerId && !execution.blockers.some(row => row.id === focusedBlockerId)) notFound();
  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>Ejecución trazable</span><h1>Cuadrillas, responsables y restricciones</h1><p>Una asignación pertenece a una obra y a una versión del plan. Cada restricción tiene una prioridad, un responsable y una resolución documentada.</p></div>
        <div className={styles.context}><strong>{access.project.name}</strong><span>Información de esta empresa y obra</span></div>
      </header>
      <ExecutionClient key={access.organization.id + ":" + access.project.id + ":" + access.databaseUserId + ":" + (focusedTaskId || focusedBlockerId || "all")}
        organizationId={access.organization.id} projectId={access.project.id} focusedBlockerId={focusedBlockerId} focusedTask={execution.focusedTask || null}
        timeZone={access.organization.timezone || null} agendaDay={assignmentAgendaToday(access.organization.timezone, new Date())}
        initialData={execution}
        workers={workers}
        tasks={execution.focusedTask ? [execution.focusedTask] : canonicalTasks.tasks}
        permissions={{ canManage: hasTenantPermission(access, 'org:execution:manage'), canReadTasks: hasTenantPermission(access, 'org:tasks:read') }}
      />
    </main>
  );
}
