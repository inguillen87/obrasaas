import { clerkClient } from '@clerk/nextjs/server';

import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  parseInvitationInput,
  serializeInvitation,
} from '@/lib/invitations';
import {
  createOfficeInvitationWithinPlan,
  OfficeSeatCheckError,
  OfficeSeatLimitError,
} from '@/lib/plans';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';

const MAX_INVITATION_JSON_BYTES = 8 * 1024;

function redirectUrlForInvitation(request) {
  if (process.env.OBRASAAS_INVITATION_REDIRECT_URL) {
    return process.env.OBRASAAS_INVITATION_REDIRECT_URL;
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return 'https://obrasaas-preview.vercel.app/dashboard';
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return new URL('/dashboard', appUrl).toString();
}

function clerkFailure(error, fallback) {
  const status = Number(error?.status || error?.statusCode || 0);
  const message = error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message;
  if (status >= 400 && status < 500) {
    return Response.json({ error: message || fallback }, { status });
  }
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'tenant:members:manage');
    if (!access.orgId) {
      return Response.json({ error: 'La sesión no tiene una organización Clerk activa.' }, { status: 409 });
    }

    const input = parseInvitationInput(
      await readJsonRequest(request, { maxBytes: MAX_INVITATION_JSON_BYTES }),
      access.email,
    );
    if (input.error) return Response.json({ error: input.error }, { status: 400 });

    const clerk = await clerkClient();
    const prisma = getPrisma();
    const { invitation, capacity } = await createOfficeInvitationWithinPlan({
      prisma,
      organizations: clerk.organizations,
      organizationId: access.orgId,
      plan: access.subscription?.plan || access.organization.subscriptionPlan,
      invitationParams: {
        emailAddress: input.email,
        role: input.clerkRole,
        inviterUserId: access.userId,
        expiresInDays: 7,
        redirectUrl: redirectUrlForInvitation(request),
        publicMetadata: {
          obrasaasTenantRole: input.tenantRole,
        },
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: access.organization.id,
          actorId: access.databaseUserId,
          action: 'tenant.invitation.created',
          entityType: 'ClerkOrganizationInvitation',
          entityId: invitation.id,
          metadata: {
            email: input.email,
            tenantRole: input.tenantRole,
            expiresAt: new Date(invitation.expiresAt).toISOString(),
            officeSeats: {
              plan: capacity.plan,
              limit: capacity.limit,
              usedBeforeInvitation: capacity.used,
            },
          },
        },
      });
    } catch (auditError) {
      // Clerk already created the external invitation. Returning an error here
      // would invite a retry and could create duplicate side effects.
      console.error('Invitation created but audit persistence failed:', auditError);
    }

    return Response.json({ invitation: serializeInvitation(invitation) }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof OfficeSeatLimitError) {
      return Response.json({
        error: `${error.message} Revocá una invitación pendiente, quitá un miembro o cambiá de plan.`,
        code: error.code,
        capacity: error.capacity,
      }, { status: 409 });
    }
    if (error instanceof OfficeSeatCheckError) {
      console.error('Office seat capacity check failed:', error.cause || error);
      return Response.json({
        error: 'No se pudo verificar el cupo en Clerk. No se envió ninguna invitación.',
        code: error.code,
      }, { status: 503 });
    }
    return clerkFailure(error, 'No se pudo enviar la invitación.');
  }
}

export async function DELETE(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'tenant:members:manage');
    if (!access.orgId) {
      return Response.json({ error: 'La sesión no tiene una organización Clerk activa.' }, { status: 409 });
    }

    const body = await readJsonRequest(request, {
      maxBytes: MAX_INVITATION_JSON_BYTES,
    });
    if (
      typeof body.invitationId !== 'string'
      || !/^orginv_[A-Za-z0-9]+$/.test(body.invitationId)
    ) {
      return Response.json({ error: 'Invitación inválida.' }, { status: 400 });
    }

    const clerk = await clerkClient();
    const invitation = await clerk.organizations.revokeOrganizationInvitation({
      organizationId: access.orgId,
      invitationId: body.invitationId,
      requestingUserId: access.userId,
    });

    try {
      await getPrisma().auditLog.create({
        data: {
          organizationId: access.organization.id,
          actorId: access.databaseUserId,
          action: 'tenant.invitation.revoked',
          entityType: 'ClerkOrganizationInvitation',
          entityId: invitation.id,
          metadata: { email: invitation.emailAddress },
        },
      });
    } catch (auditError) {
      console.error('Invitation revoked but audit persistence failed:', auditError);
    }

    return Response.json({ invitation: serializeInvitation(invitation) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    return clerkFailure(error, 'No se pudo revocar la invitación.');
  }
}
