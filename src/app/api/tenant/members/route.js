import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  acquireClerkRuntimeIdentityLocks,
  clerkIdentityRuntimeLockKeys,
  withClerkIdentitySyncLock,
} from '@/lib/clerk-identity-lock';
import {
  membershipTransitionRequiresProjectAccessReset,
  resetTenantMembershipProjectAccess,
} from '@/lib/project-access';
import { getSubscriptionEntitlements } from '@/lib/plans';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { isTenantRole } from '@/lib/tenant-roles';

const MAX_MEMBERSHIP_JSON_BYTES = 8 * 1024;

function serializeMembership(membership) {
  return {
    id: membership.id,
    clerkRole: membership.clerkRole,
    tenantRole: membership.tenantRole,
    status: membership.status,
    user: {
      name: membership.user.fullName,
      email: membership.user.primaryEmail,
      avatarUrl: membership.user.avatarUrl,
    },
    updatedAt: membership.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'tenant:members:read');
    const memberships = await getPrisma().tenantMembership.findMany({
      where: { organizationId: access.organization.id },
      include: { user: true },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return Response.json({
      canManage: access.isSuperadmin
        || access.tenantRole === 'ADMIN',
      memberships: memberships.map(serializeMembership),
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error('Member list failed:', error);
    return Response.json({ error: 'No se pudo cargar el equipo.' }, { status: 500 });
  }
}

export async function patchTenantMemberRole(
  request,
  {
    resolveAccess = getPlatformAccess,
    prismaFactory = getPrisma,
  } = {},
) {
  try {
    const access = await resolveAccess();
    requireTenantPermission(access, 'tenant:members:manage');
    const body = await readJsonRequest(request, {
      maxBytes: MAX_MEMBERSHIP_JSON_BYTES,
    });
    if (!body.membershipId || !isTenantRole(body.tenantRole)) {
      return Response.json({ error: 'Membresía o rol inválido.' }, { status: 400 });
    }

    const prisma = prismaFactory();
    const updateResult = await withClerkIdentitySyncLock(
      prisma,
      async (tx) => {
        const targetIdentity = await tx.tenantMembership.findFirst({
          where: {
            id: body.membershipId,
            organizationId: access.organization.id,
          },
          select: {
            user: { select: { clerkUserId: true } },
          },
        });
        if (!targetIdentity) return { state: 'not_found' };
        if (!targetIdentity.user?.clerkUserId) {
          throw new AccessError('The target Clerk user identity is unavailable.', {
            code: 'CLERK_IDENTITY_STALE',
            status: 409,
          });
        }

        await acquireClerkRuntimeIdentityLocks(
          tx,
          clerkIdentityRuntimeLockKeys({
            clerkOrganizationId: access.orgId,
            clerkUserId: targetIdentity.user.clerkUserId,
          }),
        );
        await tx.$queryRawUnsafe(
          `SELECT "id"
           FROM "TenantMembership"
           WHERE "organizationId" = $1
             AND ("id" = $2 OR "userId" = $3)
           ORDER BY "id"
           FOR NO KEY UPDATE`,
          access.organization.id,
          body.membershipId,
          access.databaseUserId,
        );

        const boundOrganization = await tx.organization.findUnique({
          where: { id: access.organization.id },
          select: {
            clerkOrganizationId: true,
            metadata: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        });
        const actorMembership = await tx.tenantMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: access.organization.id,
              userId: access.databaseUserId,
            },
          },
        });
        const membership = await tx.tenantMembership.findFirst({
          where: {
            id: body.membershipId,
            organizationId: access.organization.id,
          },
          include: { user: true },
        });

        if (boundOrganization?.clerkOrganizationId !== access.orgId) {
          throw new AccessError('Clerk organization identity changed before the role update.', {
            code: 'CLERK_IDENTITY_STALE',
            status: 409,
          });
        }
        if (!membership) return { state: 'not_found' };
        if (membership.user.clerkUserId !== targetIdentity.user.clerkUserId) {
          throw new AccessError('Clerk user identity changed before the role update.', {
            code: 'CLERK_IDENTITY_STALE',
            status: 409,
          });
        }

        const lockedAccess = {
          ...access,
          organization: { ...access.organization, ...boundOrganization },
          subscription: getSubscriptionEntitlements(boundOrganization),
          tenantMembershipId: actorMembership?.id || null,
          tenantRole: actorMembership?.status === 'ACTIVE'
            ? actorMembership.tenantRole
            : null,
        };
        requireTenantPermission(lockedAccess, 'tenant:members:manage');

        if (membership.status !== 'ACTIVE') {
          return {
            state: 'conflict',
            error: 'La membresía debe estar activa para cambiar su rol.',
          };
        }
        if (membership.clerkRole === 'org:admin' && body.tenantRole !== 'ADMIN') {
          return {
            state: 'conflict',
            error: 'Primero quitá el rol Admin en Clerk Organizations para aplicar un rol operativo.',
          };
        }
        if (membership.clerkRole !== 'org:admin' && body.tenantRole === 'ADMIN') {
          return {
            state: 'conflict',
            error: 'El rol Administrador requiere que la persona sea Admin de la organización en Clerk.',
          };
        }

        const result = await tx.tenantMembership.update({
          where: { id: membership.id },
          data: { tenantRole: body.tenantRole },
          include: { user: true },
        });
        const projectAccessResetApplied = membershipTransitionRequiresProjectAccessReset({
          previousTenantRole: membership.tenantRole,
          nextTenantRole: result.tenantRole,
          previousStatus: membership.status,
          nextStatus: result.status,
        });
        let resetProjectAccessCount = 0;
        if (projectAccessResetApplied) {
          const reset = await resetTenantMembershipProjectAccess(tx, membership.id);
          resetProjectAccessCount = reset.count;
        }
        await tx.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: 'tenant.membership.role_updated',
            entityType: 'TenantMembership',
            entityId: membership.id,
            metadata: {
              userEmail: membership.user.primaryEmail,
              previousRole: membership.tenantRole,
              nextRole: body.tenantRole,
              resetProjectAccessCount,
            },
          },
        });
        return {
          state: 'updated',
          membership: result,
          projectAccessResetApplied,
        };
      },
      {
        identityKeys: clerkIdentityRuntimeLockKeys({
          clerkOrganizationId: access.orgId,
        }),
      },
    );

    if (updateResult.state === 'not_found') {
      return Response.json({ error: 'La membresía no pertenece a este tenant.' }, { status: 404 });
    }
    if (updateResult.state === 'conflict') {
      return Response.json({ error: updateResult.error }, { status: 409 });
    }

    return Response.json({
      membership: {
        ...serializeMembership(updateResult.membership),
        ...(updateResult.projectAccessResetApplied ? { projectIds: [] } : {}),
      },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    console.error('Member role update failed:', error);
    return Response.json({ error: 'No se pudo actualizar el rol.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  return patchTenantMemberRole(request);
}
