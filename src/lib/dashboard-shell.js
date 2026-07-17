import 'server-only';

import { cache } from 'react';

import { getPlatformAccess, hasTenantPermission } from '@/lib/access';
import { requireDashboardShellReadAccess } from '@/lib/dashboard-shell-access';
import { PLAN_CATALOG } from '@/lib/plans';
import { getPrisma } from '@/lib/prisma';
import { TENANT_ROLES } from '@/lib/tenant-roles';

const PROJECT_SWITCHER_LIMIT = 50;

function serializeProjectOption(project) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
  };
}

export const getDashboardShellModel = cache(async () => {
  const access = await getPlatformAccess({ requireOrganization: false });
  if (!access.organization || !access.project) return null;
  requireDashboardShellReadAccess(access);

  const canReadApprovals = hasTenantPermission(
    access,
    'org:operational-proposals:read',
  );
  const prisma = getPrisma();
  const [projectRows, pendingApprovalCount, whatsapp] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId: access.organization.id,
        status: { not: 'ARCHIVED' },
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      take: PROJECT_SWITCHER_LIMIT + 1,
      select: { id: true, name: true, status: true },
    }),
    canReadApprovals
      ? prisma.operationalProposal.count({
          where: {
            projectId: access.project.id,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        })
      : Promise.resolve(0),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
      select: { enabled: true, connectionStatus: true },
    }),
  ]);

  const visibleProjects = projectRows.slice(0, PROJECT_SWITCHER_LIMIT);
  if (!visibleProjects.some((project) => project.id === access.project.id)) {
    visibleProjects.unshift({
      id: access.project.id,
      name: access.project.name,
      status: access.project.status,
    });
  }

  return {
    identity: {
      email: access.email,
      isSuperadmin: access.isSuperadmin,
      orgRole: access.orgRole,
      tenantRole: access.tenantRole,
      tenantRoleLabel: access.isSuperadmin
        ? 'Superadmin'
        : TENANT_ROLES[access.tenantRole]?.label || 'Miembro',
    },
    organization: {
      name: access.organization.name,
      plan: access.organization.subscriptionPlan,
      planLabel: PLAN_CATALOG[access.organization.subscriptionPlan]?.name
        || access.organization.subscriptionPlan,
      subscriptionStatus: access.organization.subscriptionStatus,
    },
    project: {
      id: access.project.id,
      name: access.project.name,
      address: access.project.address,
      status: access.project.status,
    },
    projects: visibleProjects.map(serializeProjectOption),
    hasMoreProjects: projectRows.length > PROJECT_SWITCHER_LIMIT,
    pendingApprovalCount,
    whatsappConnected: Boolean(
      whatsapp?.enabled && whatsapp.connectionStatus === 'CONNECTED',
    ),
    permissions: {
      canReadApprovals,
      canReadReports: hasTenantPermission(access, 'org:reports:read'),
      canReadTeam: hasTenantPermission(access, 'tenant:members:read'),
      canManageIntegrations: hasTenantPermission(access, 'org:integrations:manage'),
      canManageProjects: hasTenantPermission(access, 'org:projects:manage'),
    },
  };
});
