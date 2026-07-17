import {
  membershipTransitionRequiresProjectAccessReset,
  resetTenantMembershipProjectAccess,
} from './project-access.js';

export async function persistClerkTenantMembership(prisma, {
  organizationId,
  userId,
  clerkRole,
  tenantRole,
  status,
  eventType,
  currentMembership,
}) {
  return prisma.$transaction(async (transaction) => {
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
  });
}
