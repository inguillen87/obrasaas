import Link from 'next/link';
import { requireSuperadmin } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { PLAN_CATALOG } from '@/lib/plans';
import styles from './superadmin.module.css';

export const dynamic = 'force-dynamic';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export default async function SuperadminPage() {
  const access = await requireSuperadmin();
  const prisma = getPrisma();
  const allOrganizations = await prisma.organization.findMany({
    where: { clerkOrganizationId: { not: 'system:obrasaas' } },
    include: {
      _count: { select: { memberships: true, projects: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const organizations = allOrganizations.filter(
    (organization) => organization.metadata?.internal !== true,
  );

  const activeTenants = organizations.filter((item) =>
    ['TRIALING', 'ACTIVE'].includes(item.subscriptionStatus),
  );
  const payingTenants = organizations.filter((item) => item.subscriptionStatus === 'ACTIVE');
  const totalMembers = organizations.reduce((sum, item) => sum + item._count.memberships, 0);
  const estimatedMrr = payingTenants.reduce(
    (sum, item) => sum + (PLAN_CATALOG[item.subscriptionPlan]?.priceAnnualMonthly || 0),
    0,
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ObraSaaS Control Plane</p>
          <h1>Administración global</h1>
          <p>Tenants, adopción, suscripciones y salud comercial en una sola consola.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.identity}>{access.email} · Superadmin</span>
          <Link href="/dashboard" className={styles.secondaryButton}>Volver a la operación</Link>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Métricas de plataforma">
        <article>
          <span>Tenants activos</span>
          <strong>{activeTenants.length}</strong>
          <small>{organizations.length} organizaciones creadas</small>
        </article>
        <article>
          <span>Clientes pagos</span>
          <strong>{payingTenants.length}</strong>
          <small>{organizations.filter((item) => item.subscriptionStatus === 'TRIALING').length} en prueba</small>
        </article>
        <article>
          <span>Usuarios de gestión</span>
          <strong>{totalMembers}</strong>
          <small>Miembros sincronizados desde Clerk</small>
        </article>
        <article>
          <span>MRR contractual</span>
          <strong>USD {estimatedMrr.toLocaleString('en-US')}</strong>
          <small>Sin estimar pruebas ni costos variables</small>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>CRM de cuentas</p>
            <h2>Organizaciones y suscripciones</h2>
          </div>
          <span className={styles.liveBadge}><i /> Datos reales de Neon</span>
        </div>

        {organizations.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Todavía no hay tenants externos.</strong>
            <p>Las nuevas altas aparecerán acá al crear su organización en ObraSaaS.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Etapa</th>
                  <th>Plan</th>
                  <th>Equipo</th>
                  <th>Obras</th>
                  <th>Prueba hasta</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td>
                      <strong>{organization.name}</strong>
                      <small>{organization.metadata?.clerkSlug || organization.slug}</small>
                    </td>
                    <td><span className={`${styles.status} ${styles[organization.subscriptionStatus.toLowerCase()]}`}>{organization.subscriptionStatus}</span></td>
                    <td>{PLAN_CATALOG[organization.subscriptionPlan]?.name || organization.subscriptionPlan}</td>
                    <td>{organization._count.memberships}</td>
                    <td>{organization._count.projects}</td>
                    <td>{formatDate(organization.trialEndsAt)}</td>
                    <td>{formatDate(organization.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.guardrail}>
        <div className={styles.guardrailIcon}>01</div>
        <div>
          <h2>Separación de autoridad</h2>
          <p>Solo <strong>{access.email}</strong> puede abrir esta consola. Los administradores de cada tenant gestionan únicamente sus miembros, obras y facturación dentro de su organización activa.</p>
        </div>
      </section>
    </main>
  );
}
