import { auth, clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getPrisma } from '@/lib/prisma';
import { getSubscriptionEntitlements } from '@/lib/plans';
import { roleForClerkMembership, roleHasPermission } from '@/lib/tenant-roles';
import { acceptedInvitationRole } from '@/lib/invitations';
import {
  clerkOrganizationIsInternal,
  databaseOrganizationIsInternal,
  mergeClerkOrganizationMetadata,
} from '@/lib/organization-policy';
import {
  ACTIVE_PROJECT_COOKIE,
  isSelectableProjectStatus,
  tenantProjectWhere,
} from '@/lib/projects';
import {
  isSuperadminEmail,
  SUPERADMIN_EMAIL,
  systemRoleForVerifiedEmail,
} from '@/lib/platform-identity';

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

function primaryVerifiedEmail(user) {
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  const candidate = primary || user.emailAddresses[0];
  if (!candidate || candidate.verification?.status !== 'verified') return null;
  return candidate.emailAddress.trim().toLowerCase();
}

function tenantDatabaseSlug(clerkOrganizationId) {
  return `tenant-${clerkOrganizationId.replace(/^org_/, '').toLowerCase()}`;
}

async function ensureInternalOrganization(prisma) {
  const externalId = 'system:obrasaas';
  const existing = await prisma.organization.findUnique({
    where: { clerkOrganizationId: externalId },
  });
  if (existing) return existing;

  const legacy = await prisma.organization.findUnique({ where: { slug: 'demo' } });
  if (legacy && !legacy.clerkOrganizationId) {
    return prisma.organization.update({
      where: { id: legacy.id },
      data: {
        clerkOrganizationId: externalId,
        name: 'ObraSaaS Operaciones',
        slug: 'obrasaas-internal',
        subscriptionPlan: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      },
    });
  }

  return prisma.organization.create({
    data: {
      clerkOrganizationId: externalId,
      name: 'ObraSaaS Operaciones',
      slug: 'obrasaas-internal',
      subscriptionPlan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
    },
  });
}

async function ensureTenantOrganization({ prisma, clerk, orgId, orgSlug }) {
  const clerkOrganization = await clerk.organizations.getOrganization({
    organizationId: orgId,
  });
  const existing = await prisma.organization.findUnique({
    where: { clerkOrganizationId: orgId },
  });
  const internalClerkOrgId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null;
  const internal = clerkOrganizationIsInternal(
    clerkOrganization,
    existing?.metadata,
    internalClerkOrgId,
  );
  const metadata = mergeClerkOrganizationMetadata(
    existing?.metadata,
    clerkOrganization,
    orgSlug,
    internalClerkOrgId,
  );
  const organizationName = internal ? 'ObraSaaS Operaciones' : clerkOrganization.name;

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        name: organizationName,
        metadata,
        ...(internal ? {
          subscriptionPlan: 'ENTERPRISE',
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
        } : {}),
      },
    });
  }

  return prisma.organization.create({
    data: {
      clerkOrganizationId: orgId,
      name: organizationName,
      slug: tenantDatabaseSlug(orgId),
      subscriptionPlan: internal ? 'ENTERPRISE' : 'TRIAL',
      subscriptionStatus: internal ? 'ACTIVE' : 'TRIALING',
      trialEndsAt: internal
        ? null
        : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1_000),
      metadata,
    },
  });
}

async function ensureDefaultProject(prisma, organization) {
  const activeProject = await prisma.project.findFirst({
    where: { organizationId: organization.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (activeProject) return activeProject;

  const existingProject = await prisma.project.findFirst({
    where: {
      organizationId: organization.id,
      status: { not: 'ARCHIVED' },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existingProject) return existingProject;

  const internal = databaseOrganizationIsInternal(organization);
  const projectSlug = internal
    ? process.env.OBRASAAS_PROJECT_SLUG || 'palermo'
    : 'obra-principal';

  return prisma.project.create({
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
}

async function resolveActiveProject(prisma, organization) {
  const selectedProjectId = (await cookies()).get(ACTIVE_PROJECT_COOKIE)?.value || null;
  if (selectedProjectId) {
    const selectedProject = await prisma.project.findFirst({
      where: tenantProjectWhere(organization.id, selectedProjectId),
    });
    if (selectedProject && isSelectableProjectStatus(selectedProject.status)) {
      return selectedProject;
    }
  }
  return ensureDefaultProject(prisma, organization);
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
  const email = primaryVerifiedEmail(clerkUser);
  if (!email) {
    throw new AccessError('A verified primary email is required.', {
      code: 'EMAIL_NOT_VERIFIED',
      status: 403,
    });
  }

  const isSuperadmin = isSuperadminEmail(email);
  const systemRole = systemRoleForVerifiedEmail(email);
  const prisma = getPrisma();
  const user = await prisma.platformUser.upsert({
    where: { clerkUserId: session.userId },
    update: {
      primaryEmail: email,
      fullName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      avatarUrl: clerkUser.imageUrl || null,
      systemRole,
      lastSeenAt: new Date(),
    },
    create: {
      clerkUserId: session.userId,
      primaryEmail: email,
      fullName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      avatarUrl: clerkUser.imageUrl || null,
      systemRole,
    },
  });

  let organization = null;
  let project = null;
  let membership = null;
  if (session.orgId) {
    organization = await ensureTenantOrganization({
      prisma,
      clerk,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
    });
    const currentMembership = await prisma.tenantMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });
    let invitedTenantRole = null;
    if (!currentMembership && session.orgRole !== 'org:admin') {
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
    const resolvedClerkRole = session.orgRole || 'org:member';
    membership = await prisma.tenantMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: {
        clerkRole: resolvedClerkRole,
        tenantRole: roleForClerkMembership(
          resolvedClerkRole,
          currentMembership?.tenantRole,
        ),
        status: 'ACTIVE',
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        clerkRole: resolvedClerkRole,
        tenantRole: roleForClerkMembership(resolvedClerkRole, invitedTenantRole),
      },
    });
  } else if (isSuperadmin) {
    organization = await ensureInternalOrganization(prisma);
  }

  if (organization) project = await resolveActiveProject(prisma, organization);

  const subscription = organization
    ? getSubscriptionEntitlements(organization)
    : null;

  return {
    userId: session.userId,
    databaseUserId: user.id,
    email,
    isSuperadmin,
    systemRole,
    orgId: session.orgId || null,
    orgSlug: session.orgSlug || null,
    orgRole: session.orgRole || null,
    tenantRole: isSuperadmin ? 'SUPERADMIN' : membership?.tenantRole || null,
    organization,
    project,
    subscription,
  };
});

export async function getPlatformAccess({ requireOrganization = true } = {}) {
  const access = await resolvePlatformAccess();
  if (requireOrganization && !access.organization) {
    throw new AccessError('An active organization is required.', {
      code: 'ORGANIZATION_REQUIRED',
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
  if (access.isSuperadmin) return true;
  return Boolean(access.orgId && roleHasPermission(access.tenantRole, permission));
}

export function requireTenantPermission(access, permission, { subscriptionMode } = {}) {
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
