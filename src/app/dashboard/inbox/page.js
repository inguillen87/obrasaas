import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';

import InboxClient from './inbox-client';
import styles from './inbox.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inbox de WhatsApp',
  description: 'Conversaciones operativas de WhatsApp aisladas por obra en ObraSaaS.',
  robots: { index: false, follow: false },
};

export default async function InboxPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:conversations:read');
  const canViewSourceEvidence = hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION);
  const canLinkProgressEvidence = (
    hasTenantPermission(access, 'org:execution:manage')
    && hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION)
  );
  const progressEvidenceTasks = canLinkProgressEvidence
      ? (await listCanonicalTasks(getPrisma(), {
        projectId: access.project.id,
        limit: 500,
      })).tasks.map((task) => ({
        id: task.id,
        code: task.code,
        status: task.status,
        title: task.title,
        type: task.type,
      }))
    : [];

  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>WhatsApp · atención operativa</p>
          <h1>Las conversaciones recientes de la obra, en un solo lugar.</h1>
          <p className={styles.lead}>
            Consultá los mensajes recientes del canal conectado, respondé dentro de la ventana
            permitida por Meta y seguí cada entrega sin mezclar obras ni organizaciones.
          </p>
        </div>

        <aside className={styles.projectContext} aria-label="Contexto activo del inbox">
          <span>Obra activa</span>
          <strong>{access.project.name}</strong>
          <small>{access.organization.name}</small>
        </aside>
      </header>

      <InboxClient
        key={`${access.organization.id}:${access.project.id}`}
        canLinkProgressEvidence={canLinkProgressEvidence}
        canManageIntegrations={hasTenantPermission(access, 'org:integrations:manage')}
        canViewSourceEvidence={canViewSourceEvidence}
        organizationName={access.organization.name}
        projectId={access.project.id}
        projectName={access.project.name}
        progressEvidenceTasks={progressEvidenceTasks}
        timeZone={access.organization.timezone}
      />
    </div>
  );
}
