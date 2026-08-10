import Link from 'next/link';

import { ObraSaasLogo } from '@/app/brand/brand-logo';
import SuperadminConsole from './superadmin-console';
import styles from './superadmin.module.css';
import { requireSuperadmin } from '@/lib/access';
import { PLAN_CATALOG } from '@/lib/plans';
import { resolvePageAccess } from '@/lib/page-access';
import { getPrisma } from '@/lib/prisma';
import { serializeCrmAccount } from '@/lib/superadmin-crm';
import { getSuperadminTenantPresentation } from '@/lib/superadmin-tenant-presentation';
import { isExternalTenant } from '@/lib/superadmin-tenants';
import { deriveWhatsAppChannelPresentation } from '@/lib/whatsapp/channel-presentation';

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

function serializeTenant(organization, now) {
  const activeMemberships = organization.memberships.filter((item) => item.status === 'ACTIVE');
  const primaryContact = activeMemberships.find((item) => item.tenantRole === 'ADMIN')
    || activeMemberships[0]
    || null;
  const activeProjects = organization.projects.filter((project) => project.status === 'ACTIVE').length;
  const whatsappChannels = organization.projects.map((project) => (
    deriveWhatsAppChannelPresentation(project.whatsapp, { now })
  ));
  const connectedChannels = whatsappChannels.filter((channel) => channel.connected).length;
  const attentionChannels = whatsappChannels.filter(
    (channel) => channel.requiresAttention,
  ).length;
  const pendingChannels = whatsappChannels.filter(
    (channel) => channel.state === 'PENDING',
  ).length;
  const disabledChannels = whatsappChannels.filter(
    (channel) => channel.state === 'DISABLED',
  ).length;
  const failedWebhooks = organization.projects.reduce(
    (sum, project) => sum + project._count.webhookEvents,
    0,
  );
  const presentation = getSuperadminTenantPresentation(organization, {
    failedWebhooks,
    whatsappConnected: connectedChannels > 0,
    whatsappRequiresAttention: attentionChannels > 0,
    now,
  });
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
    subscriptionAccessStatus: presentation.subscriptionAccessStatus,
    subscriptionCanWrite: presentation.subscriptionCanWrite,
    isOperational: presentation.isOperational,
    trialEndsAt: organization.trialEndsAt?.toISOString() || null,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    lastActivityAt,
    members: organization._count.memberships,
    activeMembers: activeMemberships.length,
    projects: organization._count.projects,
    activeProjects,
    connectedChannels,
    attentionChannels,
    pendingChannels,
    disabledChannels,
    failedWebhooks,
    health: presentation.health,
    primaryContact: primaryContact ? {
      name: primaryContact.user.fullName,
      email: primaryContact.user.primaryEmail,
      lastSeenAt: primaryContact.user.lastSeenAt.toISOString(),
    } : null,
  };
}

export default async function SuperadminPage() {
  const access = await resolvePageAccess(() => requireSuperadmin());
  const prisma = getPrisma();
  const now = new Date();
  const [organizations, crmAccounts] = await Promise.all([
    prisma.organization.findMany({
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
              lastError: true,
              metadata: true,
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
    }),
    prisma.crmAccount.findMany({
      orderBy: [
        { nextFollowUpAt: 'asc' },
        { updatedAt: 'desc' },
      ],
      take: 500,
    }),
  ]);
  const tenants = organizations
    .filter(isExternalTenant)
    .map((organization) => serializeTenant(organization, now));
  const opportunities = crmAccounts.map(serializeCrmAccount);
  const activeTenants = tenants.filter((item) => item.isOperational);
  const payingTenants = tenants.filter(
    (item) => item.subscriptionStatus === 'ACTIVE' && item.subscriptionCanWrite,
  );
  const estimatedMrr = payingTenants.reduce(
    (sum, item) => sum + (PLAN_CATALOG[item.subscriptionPlan]?.priceAnnualMonthly || 0),
    0,
  );
  const expiringTrials = tenants.filter((item) => {
    const remaining = daysUntil(item.trialEndsAt, now.getTime());
    return item.subscriptionAccessStatus === 'TRIALING'
      && remaining !== null
      && remaining >= 0
      && remaining <= 7;
  }).length;
  const atRisk = tenants.filter((item) => ['RISK', 'BLOCKED', 'ATTENTION'].includes(item.health)).length;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.controlPlaneBrand}>
            <ObraSaasLogo markSize={34} preload />
            <span>Control plane</span>
          </div>
          <h1>Administración global</h1>
          <p>Pipeline, adopción, suscripciones y salud operativa de todos los tenants.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.identity}>{access.email} · Superadmin exclusivo</span>
          <Link href="/presupuesto" className={styles.secondaryButton}>Alcance contractual</Link>
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
          <small>{tenants.filter((item) => item.subscriptionAccessStatus === 'TRIALING').length} en prueba</small>
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

      <SuperadminConsole initialTenants={tenants} initialAccounts={opportunities} />

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
