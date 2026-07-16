import Link from 'next/link';

import ProjectsClient from './projects-client';
import styles from './projects.module.css';
import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { PLAN_CATALOG } from '@/lib/plans';
import { getPrisma } from '@/lib/prisma';
import {
  activeProjectCapacity,
  isUnconfiguredTenantBootstrapProject,
  listOrganizationProjects,
} from '@/lib/projects';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Obras y portfolio | ObraSaaS',
  robots: { index: false, follow: false },
};

export default async function ProjectsPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:projects:read');
  const prisma = getPrisma();
  const [projects, activeCount] = await Promise.all([
    listOrganizationProjects(prisma, access.organization.id),
    prisma.project.count({
      where: { organizationId: access.organization.id, status: 'ACTIVE' },
    }),
  ]);
  const plan = PLAN_CATALOG[access.organization.subscriptionPlan];
  const configuringBootstrap = projects.some((project) => (
    project.id === access.project.id && isUnconfiguredTenantBootstrapProject(project)
  ));

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.back}>← Volver al dashboard</Link>
          <p className={styles.eyebrow}>Portfolio operativo</p>
          <h1>Todas las obras, un contexto a la vez.</h1>
          <p>
            {access.organization.name} · cambiá de obra sin cruzar tareas, conversaciones,
            evidencias ni credenciales.
          </p>
        </div>
        <div className={styles.planBadge}>
          <span>Plan actual</span>
          <strong>{plan?.name || access.organization.subscriptionPlan}</strong>
        </div>
      </header>

      <ProjectsClient
        activeProjectId={access.project.id}
        canManage={hasTenantPermission(access, 'org:projects:manage')}
        capacity={activeProjectCapacity({
          plan: access.organization.subscriptionPlan,
          activeCount: Math.max(0, activeCount - (configuringBootstrap ? 1 : 0)),
        })}
        configuringBootstrap={configuringBootstrap}
        initialProjects={projects}
        planName={plan?.name || access.organization.subscriptionPlan}
        timezone={access.organization.timezone}
      />
    </main>
  );
}
