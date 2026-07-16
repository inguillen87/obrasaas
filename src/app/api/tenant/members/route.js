import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
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

export async function PATCH(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'tenant:members:manage');
    const body = await readJsonRequest(request, {
      maxBytes: MAX_MEMBERSHIP_JSON_BYTES,
    });
    if (!body.membershipId || !isTenantRole(body.tenantRole)) {
      return Response.json({ error: 'Membresía o rol inválido.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const membership = await prisma.tenantMembership.findFirst({
      where: {
        id: body.membershipId,
        organizationId: access.organization.id,
      },
      include: { user: true },
    });
    if (!membership) {
      return Response.json({ error: 'La membresía no pertenece a este tenant.' }, { status: 404 });
    }
    if (membership.clerkRole === 'org:admin' && body.tenantRole !== 'ADMIN') {
      return Response.json({
        error: 'Primero quitá el rol Admin en Clerk Organizations para aplicar un rol operativo.',
      }, { status: 409 });
    }
    if (membership.clerkRole !== 'org:admin' && body.tenantRole === 'ADMIN') {
      return Response.json({
        error: 'El rol Administrador requiere que la persona sea Admin de la organización en Clerk.',
      }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.tenantMembership.update({
        where: { id: membership.id },
        data: { tenantRole: body.tenantRole },
        include: { user: true },
      });
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
          },
        },
      });
      return result;
    });

    return Response.json({ membership: serializeMembership(updated) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    console.error('Member role update failed:', error);
    return Response.json({ error: 'No se pudo actualizar el rol.' }, { status: 500 });
  }
}
