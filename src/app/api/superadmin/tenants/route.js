import {
  AccessError,
  accessErrorResponse,
  requireSuperadmin,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  TenantSubscriptionUpdateError,
  isExternalTenant,
  normalizeTenantSubscriptionUpdate,
} from '@/lib/superadmin-tenants';

const MAX_TENANT_UPDATE_JSON_BYTES = 8 * 1024;

export async function PATCH(request) {
  try {
    const access = await requireSuperadmin();
    const body = await readJsonRequest(request, {
      maxBytes: MAX_TENANT_UPDATE_JSON_BYTES,
    });
    if (typeof body.organizationId !== 'string' || !body.organizationId.trim()) {
      return Response.json({ error: 'La organización es obligatoria.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const organization = await prisma.organization.findUnique({
      where: { id: body.organizationId },
    });
    if (!isExternalTenant(organization)) {
      return Response.json({ error: 'El tenant no existe o es una organización interna.' }, { status: 404 });
    }

    const normalized = normalizeTenantSubscriptionUpdate(body, organization);
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id: organization.id },
        data: normalized.data,
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: access.databaseUserId,
          action: 'platform.tenant.subscription_updated',
          entityType: 'Organization',
          entityId: organization.id,
          metadata: normalized.changes,
        },
      });
      return result;
    });

    return Response.json({
      tenant: {
        id: updated.id,
        subscriptionPlan: updated.subscriptionPlan,
        subscriptionStatus: updated.subscriptionStatus,
        trialEndsAt: updated.trialEndsAt?.toISOString() || null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof TenantSubscriptionUpdateError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Superadmin tenant update failed:', error);
    return Response.json({ error: 'No se pudo actualizar el tenant.' }, { status: 500 });
  }
}
