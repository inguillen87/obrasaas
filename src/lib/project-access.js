const PORTFOLIO_TENANT_ROLES = new Set(['ADMIN', 'DIRECTOR']);

export class ProjectAccessScopeError extends Error {
  constructor(message, code = 'PROJECT_ACCESS_SCOPE_INVALID') {
    super(message);
    this.name = 'ProjectAccessScopeError';
    this.code = code;
  }
}

export function tenantRoleHasPortfolioAccess(tenantRole) {
  return PORTFOLIO_TENANT_ROLES.has(tenantRole);
}

export function accessHasPortfolioProjectAccess(access) {
  return Boolean(
    access?.isSuperadmin || tenantRoleHasPortfolioAccess(access?.tenantRole),
  );
}

export function membershipTransitionRequiresProjectAccessReset({
  previousTenantRole,
  nextTenantRole,
  previousStatus,
  nextStatus,
}) {
  const crossesRoleBoundary = (
    tenantRoleHasPortfolioAccess(previousTenantRole)
    !== tenantRoleHasPortfolioAccess(nextTenantRole)
  );
  const activeDisabledBoundary = new Set([previousStatus, nextStatus]);
  const crossesStatusBoundary = (
    previousStatus !== nextStatus
    && activeDisabledBoundary.has('ACTIVE')
    && activeDisabledBoundary.has('DISABLED')
  );
  return crossesRoleBoundary || crossesStatusBoundary;
}

function projectAccessOrganizationId(access) {
  const organizationId = access?.organization?.id;
  if (!organizationId) {
    throw new ProjectAccessScopeError(
      'An organization is required to resolve project access.',
      'PROJECT_ACCESS_ORGANIZATION_REQUIRED',
    );
  }
  return organizationId;
}

export function projectAccessWhere(access, where = {}) {
  const organizationId = projectAccessOrganizationId(access);
  const scopedWhere = { ...where, organizationId };
  if (accessHasPortfolioProjectAccess(access)) return scopedWhere;

  const tenantMembershipId = access?.tenantMembershipId;
  if (!tenantMembershipId) {
    throw new ProjectAccessScopeError(
      'An active tenant membership is required to resolve project access.',
      'PROJECT_ACCESS_MEMBERSHIP_REQUIRED',
    );
  }

  return {
    ...scopedWhere,
    projectMemberships: {
      some: {
        tenantMembershipId,
        status: 'ACTIVE',
        tenantMembership: {
          organizationId,
          status: 'ACTIVE',
        },
      },
    },
  };
}

export async function resetTenantMembershipProjectAccess(
  prisma,
  tenantMembershipId,
) {
  if (!tenantMembershipId) {
    throw new ProjectAccessScopeError(
      'A tenant membership is required to reset project access.',
    );
  }
  return prisma.projectMembership.updateMany({
    where: {
      tenantMembershipId,
      status: 'ACTIVE',
    },
    data: { status: 'DISABLED' },
  });
}

export async function grantCreatedProjectAccessToActor(prisma, access, projectId) {
  if (!projectId) {
    throw new ProjectAccessScopeError(
      'A project is required to grant creator access.',
    );
  }
  if (accessHasPortfolioProjectAccess(access)) return null;

  const organizationId = projectAccessOrganizationId(access);
  const tenantMembershipId = access?.tenantMembershipId;
  if (!tenantMembershipId) {
    throw new ProjectAccessScopeError(
      'An active tenant membership is required to grant creator access.',
      'PROJECT_ACCESS_MEMBERSHIP_REQUIRED',
    );
  }

  return prisma.projectMembership.upsert({
    where: {
      projectId_tenantMembershipId: {
        projectId,
        tenantMembershipId,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      projectId,
      tenantMembershipId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });
}
