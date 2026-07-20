import { auth, clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getPrisma } from '@/lib/prisma';
import { getSubscriptionEntitlements } from '@/lib/plans';
import { roleHasPermission } from '@/lib/tenant-roles';
import { acceptedInvitationRole } from '@/lib/invitations';
import {
  databaseOrganizationIsInternal,
} from '@/lib/organization-policy';
import { syncClerkOrganization } from '@/lib/clerk-organization-sync';
import {
  ACTIVE_PROJECT_COOKIE,
  isSelectableProjectStatus,
} from '@/lib/projects';
import {
  accessHasPortfolioProjectAccess,
  grantCreatedProjectAccessToActor,
  membershipTransitionRequiresProjectAccessReset,
  projectAccessWhere,
  resetTenantMembershipProjectAccess,
} from '@/lib/project-access';
import {
  isSuperadminEmail,
  SUPERADMIN_EMAIL,
} from '@/lib/platform-identity';
import {
  ClerkVerifiedEmailRequiredError,
  syncPlatformUserFromClerk,
} from '@/lib/clerk-user-sync';
import { disableDeletedClerkTenantMembership } from '@/lib/clerk-membership-sync';
import {
  getCurrentClerkOrganizationMembership,
  resolveClerkTenantRole,
} from '@/lib/clerk-membership-state';
import {
  ensureInternalOrganization,
  internalOrganizationMembershipAllowed,
  internalOrganizationClerkContext,
  platformOrganizationMode,
} from '@/lib/internal-organization';
import { withClerkIdentitySyncLock } from '@/lib/clerk-identity-lock';

export { SUPERADMIN_EMAIL };

const TRIAL_DAYS = 14;

export class AccessError extends Error {
  constructor(message, { code = 'FORBIDDEN', status = 403 } = {}) {
    super(message);
    this.name = 'AccessError';
    this.code = code;
    this.status = status;
  }
}

async function ensureTenantOrganization({ prisma, clerk, orgId, orgSlug }) {
  const clerkOrganization = await clerk.organizations.getOrganization({
    organizationId: orgId,
  });
  return syncClerkOrganization(prisma, {
    organization: clerkOrganization,
    orgSlug,
    trialDays: TRIAL_DAYS,
  });
}

async function ensureDefaultProject(prisma, access) {
  const { organization } = access;
  const activeProject = await prisma.project.findFirst({
    where: projectAccessWhere(access, { status: 'ACTIVE' }),
    orderBy: { createdAt: 'asc' },
  });
  if (activeProject) return activeProject;

  const existingProject = await prisma.project.findFirst({
    where: projectAccessWhere(access, { status: { not: 'ARCHIVED' } }),
    orderBy: { createdAt: 'asc' },
  });
  if (existingProject) return existingProject;

  if (!accessHasPortfolioProjectAccess(access)) return null;

  const internal = databaseOrganizationIsInternal(organization);
  const projectSlug = internal
    ? process.env.OBRASAAS_PROJECT_SLUG || 'palermo'
    : 'obra-principal';

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: internal ? 'Obra Palermo' : 'Obra principal',
      slug: projectSlug,
      address: internal ? 'Argentina' : null,
      latitude: internal ? Number(process.env.PROJECT_LATITUDE || -34.5886) : null,
      longitude: internal ? Number(process.env.PROJECT_LONGITUDE || -58.4302) : null,
      geofenceMeters: Number(process.env.PROJECT_GEOFENCE_METERS || 100),
    },
  });
  await grantCreatedProjectAccessToActor(prisma, access, project.id);
  return project;
}

export async function resolveActiveProject(
  prisma,
  access,
  { selectedProjectId: selectedProjectIdOverride } = {},
) {
  const selectedProjectId = selectedProjectIdOverride === undefined
    ? (await cookies()).get(ACTIVE_PROJECT_COOKIE)?.value || null
    : selectedProjectIdOverride;
  if (selectedProjectId) {
    const selectedProject = await prisma.project.findFirst({
      where: projectAccessWhere(access, { id: selectedProjectId }),
    });
    if (selectedProject && isSelectableProjectStatus(selectedProject.status)) {
      return selectedProject;
    }
  }

  const activeProject = await prisma.project.findFirst({
    where: projectAccessWhere(access, { status: 'ACTIVE' }),
    orderBy: { createdAt: 'asc' },
  });
  if (activeProject) return activeProject;

  const reviewProject = await prisma.project.findFirst({
    where: projectAccessWhere(access, { status: { not: 'ARCHIVED' } }),
    orderBy: { createdAt: 'asc' },
  });
  if (reviewProject) return reviewProject;

  if (!accessHasPortfolioProjectAccess(access)) return null;
  return ensureDefaultProject(prisma, access);
}

const resolvePlatformAccess = cache(async () => {
  const session = await auth();
  if (!session.userId) {
    throw new AccessError('Authentication required.', {
      code: 'UNAUTHENTICATED',
      status: 401,
    });
  }

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(session.userId);
  const prisma = getPrisma();
  let user;
  try {
    user = await syncPlatformUserFromClerk(prisma, clerkUser, { touchLastSeenAt: true });
  } catch (error) {
    if (error instanceof ClerkVerifiedEmailRequiredError) {
      throw new AccessError('A verified primary email is required.', {
        code: 'EMAIL_NOT_VERIFIED',
        status: 403,
      });
    }
    throw error;
  }
  const email = user.primaryEmail;
  const isSuperadmin = isSuperadminEmail(email);
  const systemRole = user.systemRole;

  let organization = null;
  let project = null;
  let membership = null;
  const organizationMode = platformOrganizationMode({
    isSuperadmin,
    sessionOrganizationId: session.orgId,
    internalClerkOrganizationId: process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null,
  });
  if (organizationMode === 'forbidden') {
    throw new AccessError('The internal ObraSaaS workspace is reserved for the canonical superadmin.', {
      code: 'INTERNAL_ORGANIZATION_FORBIDDEN',
      status: 403,
    });
  }
  if (organizationMode === 'internal') {
    organization = await ensureInternalOrganization(prisma);
  } else if (organizationMode === 'tenant') {
    organization = await ensureTenantOrganization({
      prisma,
      clerk,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
    });
    if (!internalOrganizationMembershipAllowed(organization, email)) {
      throw new AccessError('The internal ObraSaaS workspace is reserved for the canonical superadmin.', {
        code: 'INTERNAL_ORGANIZATION_FORBIDDEN',
        status: 403,
      });
    }
    const currentMembership = await prisma.tenantMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });
    const currentClerkMembership = await getCurrentClerkOrganizationMembership(
      clerk.organizations,
      {
        organizationId: session.orgId,
        userId: session.userId,
      },
    );
    if (!currentClerkMembership) {
      await disableDeletedClerkTenantMembership(prisma, {
        clerkOrganizationId: session.orgId,
        clerkUserId: session.userId,
        eventType: 'session.membership_missing',
      });
      throw new AccessError('The active Clerk organization membership no longer exists.', {
        code: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
        status: 403,
      });
    }
    const startsNewLifecycle = !currentMembership || currentMembership.status !== 'ACTIVE';
    let invitedTenantRole = null;
    if (startsNewLifecycle && currentClerkMembership.role !== 'org:admin') {
      try {
        const acceptedInvitations = await clerk.organizations.getOrganizationInvitationList({
          organizationId: session.orgId,
          status: ['accepted'],
          limit: 100,
        });
        invitedTenantRole = acceptedInvitationRole(acceptedInvitations.data, email);
      } catch (error) {
        console.error('Accepted Clerk invitation lookup failed; using least privilege:', error);
      }
    }
    const resolvedClerkRole = currentClerkMembership.role || 'org:member';
    membership = await withClerkIdentitySyncLock(prisma, async (database) => {
      const [boundOrganization, boundUser, lockedCurrentMembership] = await Promise.all([
        database.organization.findUnique({
          where: { id: organization.id },
          select: { clerkOrganizationId: true },
        }),
        database.platformUser.findUnique({
          where: { id: user.id },
          select: { clerkUserId: true },
        }),
        database.tenantMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: user.id,
            },
          },
        }),
      ]);
      if (
        boundOrganization?.clerkOrganizationId !== session.orgId
        || boundUser?.clerkUserId !== session.userId
      ) {
        throw new AccessError('Clerk identity changed while resolving the active organization.', {
          code: 'CLERK_IDENTITY_STALE',
          status: 409,
        });
      }
      const resolvedTenantRole = resolveClerkTenantRole({
        clerkRole: resolvedClerkRole,
        databaseMembership: lockedCurrentMembership,
        clerkMembership: currentClerkMembership,
        invitedTenantRole,
      });
      const resolvedMembership = await database.tenantMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        update: {
          clerkRole: resolvedClerkRole,
          tenantRole: resolvedTenantRole,
          status: 'ACTIVE',
        },
        create: {
          organizationId: organization.id,
          userId: user.id,
          clerkRole: resolvedClerkRole,
          tenantRole: resolvedTenantRole,
        },
      });
      const resetProjectAccess = lockedCurrentMembership && (
        membershipTransitionRequiresProjectAccessReset({
          previousTenantRole: lockedCurrentMembership.tenantRole,
          nextTenantRole: resolvedTenantRole,
          previousStatus: lockedCurrentMembership.status,
          nextStatus: 'ACTIVE',
        })
      );
      if (resetProjectAccess) {
        const reset = await resetTenantMembershipProjectAccess(
          database,
          resolvedMembership.id,
        );
        await database.auditLog.create({
          data: {
            organizationId: organization.id,
            actorId: user.id,
            action: 'tenant.membership.project_access_reset',
            entityType: 'TenantMembership',
            entityId: resolvedMembership.id,
            metadata: {
              source: 'session_membership_sync',
              previousRole: lockedCurrentMembership.tenantRole,
              nextRole: resolvedTenantRole,
              previousStatus: lockedCurrentMembership.status,
              nextStatus: 'ACTIVE',
              resetProjectAccessCount: reset.count,
            },
          },
        });
      }
      return resolvedMembership;
    });
  }

  const tenantRole = isSuperadmin ? 'SUPERADMIN' : membership?.tenantRole || null;
  if (organization) {
    project = await resolveActiveProject(prisma, {
      isSuperadmin,
      tenantRole,
      tenantMembershipId: membership?.id || null,
      organization,
    });
  }

  const subscription = organization
    ? getSubscriptionEntitlements(organization)
    : null;

  const internalClerkContext = isSuperadmin
    ? internalOrganizationClerkContext(organization)
    : null;
  const effectiveClerkOrganizationId = isSuperadmin
    ? internalClerkContext.orgId
    : session.orgId || null;
  const effectiveClerkOrganizationSlug = isSuperadmin
    ? internalClerkContext.orgSlug
    : session.orgSlug || null;

  return {
    userId: session.userId,
    databaseUserId: user.id,
    email,
    isSuperadmin,
    systemRole,
    orgId: effectiveClerkOrganizationId,
    orgSlug: effectiveClerkOrganizationSlug,
    orgRole: isSuperadmin ? internalClerkContext.orgRole : session.orgRole || null,
    tenantRole,
    tenantMembershipId: membership?.id || null,
    organization,
    project,
    subscription,
  };
});

export async function getPlatformAccess({
  requireOrganization = true,
  requireProject = requireOrganization,
} = {}) {
  const access = await resolvePlatformAccess();
  if (requireOrganization && !access.organization) {
    throw new AccessError('An active organization is required.', {
      code: 'ORGANIZATION_REQUIRED',
      status: 403,
    });
  }
  if (requireProject && !access.project) {
    throw new AccessError('No tenés una obra activa asignada.', {
      code: 'PROJECT_ACCESS_REQUIRED',
      status: 403,
    });
  }
  return access;
}

export async function requireSuperadmin() {
  const access = await getPlatformAccess({ requireOrganization: false });
  if (!access.isSuperadmin) {
    throw new AccessError('Superadmin access required.', {
      code: 'SUPERADMIN_REQUIRED',
      status: 403,
    });
  }
  return access;
}

export function hasTenantPermission(access, permission) {
  if (
    permission === 'tenant:members:manage'
    && databaseOrganizationIsInternal(access?.organization)
  ) {
    return false;
  }
  if (access.isSuperadmin) return true;
  return Boolean(access.orgId && roleHasPermission(access.tenantRole, permission));
}

export function requireTenantPermission(access, permission, { subscriptionMode } = {}) {
  if (
    permission === 'tenant:members:manage'
    && databaseOrganizationIsInternal(access?.organization)
  ) {
    throw new AccessError('Internal workspace memberships cannot be managed from tenant controls.', {
      code: 'INTERNAL_ORGANIZATION_MEMBERSHIP_FORBIDDEN',
      status: 403,
    });
  }
  if (!hasTenantPermission(access, permission)) {
    throw new AccessError(`Permission ${permission} is required.`, {
      code: 'PERMISSION_REQUIRED',
      status: 403,
    });
  }

  if (!access.isSuperadmin && access.subscription) {
    const mode = subscriptionMode
      || (permission.endsWith(':manage') ? 'write' : 'read');
    if (mode === 'read' && !access.subscription.canRead) {
      throw new AccessError('La organización está suspendida.', {
        code: 'SUBSCRIPTION_SUSPENDED',
        status: 403,
      });
    }
    if (mode === 'write' && !access.subscription.canWrite) {
      throw new AccessError(
        'La organización está en modo lectura. El plan debe activarse para realizar cambios.',
        { code: 'SUBSCRIPTION_READ_ONLY', status: 402 },
      );
    }
  }
  return access;
}

export function accessErrorResponse(error) {
  if (error instanceof AccessError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  throw error;
}
