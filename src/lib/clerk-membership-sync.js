import {
  membershipTransitionRequiresProjectAccessReset,
  resetTenantMembershipProjectAccess,
} from './project-access.js';
import {
  canUseClerkIdentitySyncLock,
  isClerkIdentityTransaction,
  withClerkIdentitySyncLock,
} from './clerk-identity-lock.js';

export async function persistClerkTenantMembership(prisma, input) {
  if (canUseClerkIdentitySyncLock(prisma)) {
    return withClerkIdentitySyncLock(
      prisma,
      (transaction) => persistClerkTenantMembership(transaction, input),
    );
  }
  const {
  organizationId,
  userId,
  clerkRole,
  tenantRole,
  status,
  eventType,
  currentMembership,
    expectedClerkOrganizationId = null,
    expectedClerkUserId = null,
  } = input;
  const synchronize = async (transaction) => {
    if (expectedClerkOrganizationId || expectedClerkUserId) {
      const [organization, user] = await Promise.all([
        transaction.organization.findUnique({
          where: { id: organizationId },
          select: { clerkOrganizationId: true },
        }),
        transaction.platformUser.findUnique({
          where: { id: userId },
          select: { clerkUserId: true },
        }),
      ]);
      if (
        (expectedClerkOrganizationId
          && organization?.clerkOrganizationId !== expectedClerkOrganizationId)
        || (expectedClerkUserId && user?.clerkUserId !== expectedClerkUserId)
      ) {
        throw new Error('Clerk membership identity changed before persistence.');
      }
    }

    const syncedMembership = await transaction.tenantMembership.upsert({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      update: {
        clerkRole,
        tenantRole,
        status,
      },
      create: {
        organizationId,
        userId,
        clerkRole,
        tenantRole,
        status,
      },
    });

    const projectAccessResetApplied = Boolean(
      currentMembership && membershipTransitionRequiresProjectAccessReset({
        previousTenantRole: currentMembership.tenantRole,
        nextTenantRole: syncedMembership.tenantRole,
        previousStatus: currentMembership.status,
        nextStatus: syncedMembership.status,
      }),
    );
    if (!projectAccessResetApplied) {
      return { membership: syncedMembership, projectAccessResetApplied, resetCount: 0 };
    }

    const reset = await resetTenantMembershipProjectAccess(
      transaction,
      syncedMembership.id,
    );
    await transaction.auditLog.create({
      data: {
        organizationId,
        action: 'tenant.project_access.reset_by_membership_sync',
        entityType: 'TenantMembership',
        entityId: syncedMembership.id,
        metadata: {
          clerkEventType: eventType,
          previousTenantRole: currentMembership.tenantRole,
          nextTenantRole: syncedMembership.tenantRole,
          previousStatus: currentMembership.status,
          nextStatus: syncedMembership.status,
          resetProjectAccessCount: reset.count,
        },
      },
    });

    return {
      membership: syncedMembership,
      projectAccessResetApplied,
      resetCount: reset.count,
    };
  };
  return typeof prisma.$transaction === 'function' && !isClerkIdentityTransaction(prisma)
    ? prisma.$transaction(synchronize)
    : synchronize(prisma);
}

export async function disableDeletedClerkTenantMembership(prisma, {
  clerkOrganizationId,
  clerkUserId,
  eventType = 'organizationMembership.deleted',
}) {
  if (canUseClerkIdentitySyncLock(prisma)) {
    return withClerkIdentitySyncLock(
      prisma,
      (transaction) => disableDeletedClerkTenantMembership(transaction, {
        clerkOrganizationId,
        clerkUserId,
        eventType,
      }),
    );
  }
  if (!clerkOrganizationId || !clerkUserId) {
    throw new Error('Clerk organization and user IDs are required for membership deletion.');
  }

  const [organization, user] = await Promise.all([
    prisma.organization.findUnique({
      where: { clerkOrganizationId },
      select: { id: true },
    }),
    prisma.platformUser.findUnique({
      where: { clerkUserId },
      select: { id: true },
    }),
  ]);
  if (!organization || !user) return { found: false, changed: false };

  const currentMembership = await prisma.tenantMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
  });
  if (!currentMembership) return { found: false, changed: false };
  if (currentMembership.status === 'DISABLED') return { found: true, changed: false };

  await persistClerkTenantMembership(prisma, {
    organizationId: organization.id,
    userId: user.id,
    clerkRole: currentMembership.clerkRole,
    tenantRole: currentMembership.tenantRole,
    status: 'DISABLED',
    eventType,
    currentMembership,
  });
  return { found: true, changed: true };
}
