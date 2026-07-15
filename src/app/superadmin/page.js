import Link from 'next/link';

import SuperadminConsole from './superadmin-console';
import styles from './superadmin.module.css';
import { requireSuperadmin } from '@/lib/access';
import { PLAN_CATALOG } from '@/lib/plans';
import { getPrisma } from '@/lib/prisma';
import { isExternalTenant } from '@/lib/superadmin-tenants';

export const dynamic = 'force-dynamic';

function latestDate(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function daysUntil(value, now = Date.now()) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - now) / (24 * 60 * 60 * 1_000));
}

function tenantHealth(organization, failedWebhooks, whatsappConnected) {
  if (['SUSPENDED', 'CANCELED'].includes(organization.subscriptionStatus)) return 'BLOCKED';
  if (organization.subscriptionStatus === 'PAST_DUE' || failedWebhooks > 0) return 'RISK';
  const remainingTrialDays = daysUntil(organization.trialEndsAt);
  if (
    organization.subscriptionStatus === 'TRIALING'
    && remainingTrialDays !== null
    && remainingTrialDays <= 3
  ) {
    return 'ATTENTION';
  }
  return whatsappConnected ? 'HEALTHY' : 'ONBOARDING';
}

function serializeTenant(organization) {
  const activeMemberships = organization.memberships.filter((item) => item.status === 'ACTIVE');
  const primaryContact = activeMemberships.find((item) => item.tenantRole === 'ADMIN')
    || activeMemberships[0]
    || null;
  const activeProjects = organization.projects.filter((project) => project.status === 'ACTIVE').length;
  const connectedChannels = organization.projects.filter(
    (project) => project.whatsapp?.enabled && project.whatsapp.connectionStatus === 'CONNECTED',
  ).length;
  const failedWebhooks = organization.projects.reduce(
    (sum, project) => sum + project._count.webhookEvents,
    0,
  );
  const lastActivityAt = latestDate([
    organization.updatedAt,
    organization.auditLogs[0]?.createdAt,
    ...activeMemberships.map((item) => item.user.lastSeenAt),
    ...organization.projects.map((project) => project.updatedAt),
  ]);

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.metadata?.clerkSlug || organization.slug,
    country: organization.country,
    timezone: organization.timezone,
    subscriptionPlan: organization.subscriptionPlan,
    subscriptionStatus: organization.subscriptionStatus,
    trialEndsAt: organization.trialEndsAt?.toISOString() || null,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    lastActivityAt,
    members: organization._count.memberships,
    activeMembers: activeMemberships.length,
    projects: organization._count.projects,
    activeProjects,
    connectedChannels,
    failedWebhooks,
    health: tenantHealth(organization, failedWebhooks, connectedChannels > 0),
    primaryContact: primaryContact ? {
      name: primaryContact.user.fullName,
      email: primaryContact.user.primaryEmail,
      lastSeenAt: primaryContact.user.lastSeenAt.toISOString(),
    } : null,
  };
}

export default async function SuperadminPage() {
  const access = await requireSuperadmin();
  const organizations = await getPrisma().organization.findMany({
    include: {
      _count: { select: { memberships: true, projects: true } },
      memberships: {
        select: {
          status: true,
          tenantRole: true,
          user: {
            select: {
              fullName: true,
              primaryEmail: true,
              lastSeenAt: true,
            },
          },
        },
      },
      projects: {
        select: {
          status: true,
          updatedAt: true,
          whatsapp: {
            select: {
              enabled: true,
              connectionStatus: true,
            },
          },
          _count: {
            select: {
              webhookEvents: { where: { status: 'FAILED' } },
            },
          },
        },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  const tenants = organizations.filter(isExternalTenant).map(serializeTenant);
  const activeTenants = tenants.filter((item) => ['TRIALING', 'ACTIVE'].includes(item.subscriptionStatus));
  const payingTenants = tenants.filter((item) => item.subscriptionStatus === 'ACTIVE');
  const estimatedMrr = payingTenants.reduce(
    (sum, item) => sum + (PLAN_CATALOG[item.subscriptionPlan]?.priceAnnualMonthly || 0),
    0,
  );
  const expiringTrials = tenants.filter((item) => {
    const remaining = daysUntil(item.trialEndsAt);
    return item.subscriptionStatus === 'TRIALING' && remaining !== null && remaining >= 0 && remaining <= 7;
  }).length;
  const atRisk = tenants.filter((item) => ['RISK', 'BLOCKED', 'ATTENTION'].includes(item.health)).length;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ObraSaaS Control Plane</p>
          <h1>Administración global</h1>
          <p>Pipeline, adopción, suscripciones y salud operativa de todos los tenants.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.identity}>{access.email} · Superadmin exclusivo</span>
          <Link href="/dashboard" className={styles.secondaryButton}>Volver a la operación</Link>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Métricas de plataforma">
        <article>
          <span>Tenants operativos</span>
          <strong>{activeTenants.length}</strong>
          <small>{tenants.length} organizaciones externas</small>
        </article>
        <article>
          <span>Clientes pagos</span>
          <strong>{payingTenants.length}</strong>
          <small>{tenants.filter((item) => item.subscriptionStatus === 'TRIALING').length} en prueba</small>
        </article>
        <article>
          <span>Trials por vencer</span>
          <strong>{expiringTrials}</strong>
          <small>Próximos 7 días</small>
        </article>
        <article>
          <span>Requieren atención</span>
          <strong>{atRisk}</strong>
          <small>Cobranza, salud o vencimiento</small>
        </article>
        <article>
          <span>MRR contractual</span>
          <strong>USD {estimatedMrr.toLocaleString('en-US')}</strong>
          <small>Sin pruebas ni costos variables</small>
        </article>
      </section>

      <SuperadminConsole initialTenants={tenants} />

      <section className={styles.guardrail}>
        <div className={styles.guardrailIcon}>01</div>
        <div>
          <h2>Autoridad separada y auditable</h2>
          <p>Solo <strong>{access.email}</strong> administra el portfolio global. Cada cambio de plan, estado o prueba se registra con actor, tenant, valores anteriores y valores nuevos.</p>
        </div>
      </section>
    </main>
  );
}
