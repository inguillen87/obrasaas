import { clerkClient } from '@clerk/nextjs/server';

import TeamClient from './team-client';
import FieldWorkersClient from './field-workers-client';
import styles from './team.module.css';
import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { serializeFieldWorker } from '@/lib/field-workers';
import { PLAN_CATALOG } from '@/lib/plans';
import {
  projectAccessWhere,
  tenantRoleHasPortfolioAccess,
} from '@/lib/project-access';
import { TENANT_ROLES } from '@/lib/tenant-roles';
import { serializeInvitation } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'tenant:members:read');
  const canManage = hasTenantPermission(access, 'tenant:members:manage');
  const canManageField = hasTenantPermission(access, 'org:field:manage');
  const prisma = getPrisma();
  const [memberships, invitationResult, workers, projects] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: { organizationId: access.organization.id },
      include: {
        user: true,
        projectMemberships: {
          where: {
            status: 'ACTIVE',
            project: { status: { not: 'ARCHIVED' } },
          },
          select: { projectId: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    }),
    canManage && access.orgId
      ? clerkClient().then((clerk) => clerk.organizations.getOrganizationInvitationList({
        organizationId: access.orgId,
        status: ['pending'],
        limit: 100,
      }))
      : Promise.resolve({ data: [] }),
    prisma.worker.findMany({
      where: {
        projectId: access.project.id,
        project: { organizationId: access.organization.id },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: {
        person: {
          select: {
            channelIdentities: {
              where: { provider: 'WHATSAPP' },
              orderBy: { id: 'asc' },
              select: {
                id: true,
                provider: true,
                status: true,
                addressLastFour: true,
                verifiedAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: projectAccessWhere(access, {
        status: { not: 'ARCHIVED' },
      }),
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const plan = PLAN_CATALOG[access.organization.subscriptionPlan];
  const canViewFullProjectCatalog = access.isSuperadmin
    || canManage
    || tenantRoleHasPortfolioAccess(access.tenantRole);
  const currentMembership = memberships.find((membership) => (
    membership.userId === access.databaseUserId
  ));
  const visibleProjectIds = canViewFullProjectCatalog
    ? null
    : new Set(
        currentMembership?.projectMemberships.map(({ projectId }) => projectId) || [],
      );
  const visibleProjects = visibleProjectIds
    ? projects.filter((project) => visibleProjectIds.has(project.id))
    : projects;
  const catalogProjectIds = new Set(visibleProjects.map((project) => project.id));

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Gobierno del tenant</p>
          <h1>Equipo y permisos</h1>
          <p>
            {access.organization.name} · cada persona accede solo a lo que su función necesita.
          </p>
        </div>
        <div className={styles.identity}>
          <span>{access.email}</span>
          <strong>{access.isSuperadmin ? 'Superadmin' : TENANT_ROLES[access.tenantRole]?.label}</strong>
        </div>
      </header>

      <section className={styles.roleGrid} aria-label="Matriz de roles">
        {Object.values(TENANT_ROLES).map((role) => (
          <article key={role.key}>
            <span>{role.label}</span>
            <p>{role.description}</p>
          </article>
        ))}
      </section>

      <TeamClient
        canManage={canManage}
        initialInvitations={invitationResult.data.map(serializeInvitation)}
        initialMemberships={memberships.map((membership) => ({
          id: membership.id,
          clerkRole: membership.clerkRole,
          tenantRole: membership.tenantRole,
          status: membership.status,
          portfolioAccess: tenantRoleHasPortfolioAccess(membership.tenantRole),
          projectIds: membership.projectMemberships
            .map(({ projectId }) => projectId)
            .filter((projectId) => catalogProjectIds.has(projectId)),
          user: {
            name: membership.user.fullName,
            email: membership.user.primaryEmail,
            avatarUrl: membership.user.avatarUrl,
          },
        }))}
        officeUserLimit={plan?.limits.officeUsers || 0}
        projects={visibleProjects}
        roles={Object.values(TENANT_ROLES).map((role) => ({
          ...role,
          portfolioAccess: tenantRoleHasPortfolioAccess(role.key),
        }))}
      />

      <FieldWorkersClient
        canManage={canManageField}
        projectName={access.project.name}
        initialWorkers={workers.map(serializeFieldWorker)}
      />
    </div>
  );
}
