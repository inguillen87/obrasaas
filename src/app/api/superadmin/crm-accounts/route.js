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
  CrmAccountInputError,
  normalizeCrmAccountInput,
  serializeCrmAccount,
} from '@/lib/superadmin-crm';

const MAX_CRM_ACCOUNT_JSON_BYTES = 32 * 1024;

function inputErrorResponse(error) {
  return Response.json({ error: error.message }, { status: 400 });
}

export async function POST(request) {
  try {
    const access = await requireSuperadmin();
    const body = await readJsonRequest(request, {
      maxBytes: MAX_CRM_ACCOUNT_JSON_BYTES,
    });
    const normalized = normalizeCrmAccountInput(body);
    const prisma = getPrisma();
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.crmAccount.create({ data: normalized.data });
      await tx.auditLog.create({
        data: {
          actorId: access.databaseUserId,
          action: 'platform.crm.account_created',
          entityType: 'CrmAccount',
          entityId: created.id,
          metadata: {
            name: created.name,
            stage: created.stage,
            email: created.email,
          },
        },
      });
      return created;
    });

    return Response.json({ account: serializeCrmAccount(account) }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof CrmAccountInputError) return inputErrorResponse(error);
    console.error('Superadmin CRM account creation failed:', error);
    return Response.json({ error: 'No se pudo crear la oportunidad.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const access = await requireSuperadmin();
    const body = await readJsonRequest(request, {
      maxBytes: MAX_CRM_ACCOUNT_JSON_BYTES,
    });
    if (typeof body.id !== 'string' || !body.id.trim()) {
      return Response.json({ error: 'La oportunidad es obligatoria.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const current = await prisma.crmAccount.findUnique({ where: { id: body.id } });
    if (!current) {
      return Response.json({ error: 'La oportunidad no existe.' }, { status: 404 });
    }
    const normalized = normalizeCrmAccountInput(body, current);
    const account = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmAccount.update({
        where: { id: current.id },
        data: normalized.data,
      });
      await tx.auditLog.create({
        data: {
          actorId: access.databaseUserId,
          action: 'platform.crm.account_updated',
          entityType: 'CrmAccount',
          entityId: current.id,
          metadata: normalized.changes,
        },
      });
      return updated;
    });

    return Response.json({ account: serializeCrmAccount(account) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof CrmAccountInputError) return inputErrorResponse(error);
    console.error('Superadmin CRM account update failed:', error);
    return Response.json({ error: 'No se pudo actualizar la oportunidad.' }, { status: 500 });
  }
}
