import Link from 'next/link';

import { TENANT_ROLES } from '@/lib/tenant-roles';

import styles from './project-access-required.module.css';

export default function ProjectAccessRequired({ access }) {
  const roleLabel = TENANT_ROLES[access.tenantRole]?.label || 'Integrante';

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="project-access-title">
        <div className={styles.statusRow}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Acceso pendiente</span>
        </div>
        <p className={styles.eyebrow}>Gobierno por obra</p>
        <h1 id="project-access-title">Todavía no tenés una obra asignada</h1>
        <p className={styles.lead}>
          Tu cuenta está activa en <strong>{access.organization.name}</strong> como{' '}
          <strong>{roleLabel}</strong>, pero un administrador debe definir tu alcance operativo.
          No mostramos información de otras obras mientras ese permiso no exista.
        </p>

        <div className={styles.detailGrid}>
          <article>
            <span>1</span>
            <div>
              <strong>Pedí la asignación</strong>
              <p>Un administrador puede habilitarte desde Equipo y permisos.</p>
            </div>
          </article>
          <article>
            <span>2</span>
            <div>
              <strong>Volvé a comprobar</strong>
              <p>El nuevo alcance se aplicará en tu siguiente carga de la plataforma.</p>
            </div>
          </article>
        </div>

        <div className={styles.actions}>
          <Link className={styles.primaryAction} href="/dashboard">
            Comprobar acceso
          </Link>
          <Link className={styles.secondaryAction} href="/session-tasks/choose-organization">
            Cambiar organización
          </Link>
        </div>

        <p className={styles.identity}>{access.email}</p>
      </section>
    </main>
  );
}
