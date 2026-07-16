import Link from 'next/link';

import ApprovalsClient from './approvals-client';
import styles from './approvals.module.css';
import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { OPERATIONAL_PROPOSAL_READ_PERMISSION } from '@/lib/operational-proposal-inbox';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Aprobaciones operativas',
  description: 'Bandeja de decisiones operativas verificables de ObraSaaS.',
  robots: { index: false, follow: false },
};

export default async function ApprovalsPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, OPERATIONAL_PROPOSAL_READ_PERMISSION);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.back}>
            <span aria-hidden="true">←</span> Volver al centro operativo
          </Link>
          <p className={styles.eyebrow}>Control humano · cambios trazables</p>
          <h1>Decidir con contexto, antes de tocar la obra.</h1>
          <p className={styles.lead}>
            Revisá propuestas generadas desde el campo, entendé su efecto real y aprobá
            o rechazá con una confirmación explícita. Ningún cambio se aplica desde esta
            bandeja sin una respuesta válida del servidor.
          </p>
        </div>

        <aside className={styles.trustCard} aria-label="Garantías de la bandeja">
          <span className={styles.liveSignal}><i aria-hidden="true" /> Perímetro verificado</span>
          <strong>Tenant + obra aislados</strong>
          <small>Decisiones con idempotencia, auditoría y control de concurrencia.</small>
        </aside>
      </header>

      <ApprovalsClient />
    </main>
  );
}
