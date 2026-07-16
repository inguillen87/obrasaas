import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  FieldWorkerInputError,
  findFieldWorkerPhoneConflict,
  metadataWithWhatsAppRole,
  normalizeFieldWorkerCreateInput,
  normalizeFieldWorkerPatchInput,
  serializeFieldWorker,
} from '@/lib/field-workers';
import { fieldUserCapacity } from '@/lib/plans';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';

export const runtime = 'nodejs';
const MAX_FIELD_WORKER_REQUEST_BYTES = 16 * 1024;

const WORKER_SELECT = {
  id: true,
  phone: true,
  name: true,
  role: true,
  active: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

class FieldWorkerCapacityError extends Error {
  constructor(capacity) {
    super(`El plan permite hasta ${capacity.limit} personas de campo activas por organización.`);
    this.name = 'FieldWorkerCapacityError';
    this.capacity = capacity;
  }
}

function scopeFromAccess(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

function inputErrorResponse(error) {
  return Response.json({ error: error.message, code: error.code }, { status: 400 });
}

function phoneConflictResponse() {
  return Response.json({
    error: 'Ese teléfono ya está asignado a otra persona de la obra.',
    code: 'PHONE_ALREADY_ASSIGNED',
  }, { status: 409 });
}

function capacityErrorResponse(error) {
  return Response.json({
    error: error.message,
    code: 'FIELD_USER_LIMIT_REACHED',
    limit: error.capacity.limit,
    used: error.capacity.used,
  }, { status: 409 });
}

async function requireFieldWorkerCapacity(prisma, access) {
  const activeCount = await prisma.worker.count({
    where: {
      active: true,
      project: { organizationId: access.organization.id },
    },
  });
  const capacity = fieldUserCapacity({
    plan: access.subscription?.plan || access.organization.subscriptionPlan,
    activeCount,
  });
  if (!capacity.canActivate) throw new FieldWorkerCapacityError(capacity);
  return capacity;
}

async function runFieldWorkerMutation(prisma, operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof FieldWorkerCapacityError) throw error;
      if (error?.code !== 'P2034' || attempt === 3) throw error;
    }
  }
  throw new Error('Field worker mutation retry loop exhausted.');
}

function phoneAuditValue(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : null;
}

function handleKnownError(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof FieldWorkerInputError) return inputErrorResponse(error);
  if (error instanceof FieldWorkerCapacityError) return capacityErrorResponse(error);
  if (error?.code === 'P2002') return phoneConflictResponse();
  return null;
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'tenant:members:read');
    const workers = await getPrisma().worker.findMany({
      where: {
        projectId: access.project.id,
        project: { organizationId: access.organization.id },
      },
      select: WORKER_SELECT,
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
    return Response.json({ workers: workers.map(serializeFieldWorker) });
  } catch (error) {
    const known = handleKnownError(error);
    if (known) return known;
    console.error('Field worker list failed:', error);
    return Response.json({ error: 'No se pudo cargar la cuadrilla.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:field:manage');
    const input = normalizeFieldWorkerCreateInput(await readJsonRequest(request, {
      maxBytes: MAX_FIELD_WORKER_REQUEST_BYTES,
    }));
    const prisma = getPrisma();
    const scope = scopeFromAccess(access);
    if (await findFieldWorkerPhoneConflict(prisma, scope, input.phone)) {
      return phoneConflictResponse();
    }

    const worker = await runFieldWorkerMutation(prisma, async (tx) => {
      await requireFieldWorkerCapacity(tx, access);
      const created = await tx.worker.create({
        data: {
          projectId: scope.projectId,
          name: input.name,
          phone: input.phone,
          role: input.role,
          metadata: metadataWithWhatsAppRole(null, input.whatsappRole),
        },
        select: WORKER_SELECT,
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId,
          action: 'field.worker.created',
          entityType: 'Worker',
          entityId: created.id,
          metadata: {
            projectId: scope.projectId,
            name: created.name,
            phone: phoneAuditValue(created.phone),
            whatsappRole: input.whatsappRole,
          },
        },
      });
      return created;
    });

    return Response.json({ worker: serializeFieldWorker(worker) }, { status: 201 });
  } catch (error) {
    const known = handleKnownError(error);
    if (known) return known;
    console.error('Field worker creation failed:', error);
    return Response.json({ error: 'No se pudo agregar la persona a la obra.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:field:manage');
    const { workerId, data } = normalizeFieldWorkerPatchInput(await readJsonRequest(request, {
      maxBytes: MAX_FIELD_WORKER_REQUEST_BYTES,
    }));
    const prisma = getPrisma();
    const scope = scopeFromAccess(access);
    const current = await prisma.worker.findFirst({
      where: {
        id: workerId,
        projectId: scope.projectId,
        project: { organizationId: scope.organizationId },
      },
      select: WORKER_SELECT,
    });
    if (!current) {
      return Response.json({
        error: 'La persona no pertenece a la obra activa.',
        code: 'WORKER_NOT_FOUND',
      }, { status: 404 });
    }
    const phoneToValidate = data.phone || (data.active === true ? current.phone : null);
    if (
      phoneToValidate
      && await findFieldWorkerPhoneConflict(prisma, scope, phoneToValidate, current.id)
    ) {
      return phoneConflictResponse();
    }

    const updateData = {};
    for (const field of ['name', 'phone', 'role', 'active']) {
      if (Object.hasOwn(data, field)) updateData[field] = data[field];
    }
    if (Object.hasOwn(data, 'whatsappRole')) {
      updateData.metadata = metadataWithWhatsAppRole(current.metadata, data.whatsappRole);
    }

    const worker = await runFieldWorkerMutation(prisma, async (tx) => {
      if (data.active === true && current.active === false) {
        await requireFieldWorkerCapacity(tx, access);
      }
      const updated = await tx.worker.update({
        where: { id: current.id },
        data: updateData,
        select: WORKER_SELECT,
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: access.databaseUserId,
          action: 'field.worker.updated',
          entityType: 'Worker',
          entityId: current.id,
          metadata: {
            projectId: scope.projectId,
            changedFields: Object.keys(data),
            previous: {
              name: current.name,
              phone: phoneAuditValue(current.phone),
              role: current.role,
              whatsappRole: serializeFieldWorker(current).whatsappRole,
              active: current.active,
            },
            next: {
              name: updated.name,
              phone: phoneAuditValue(updated.phone),
              role: updated.role,
              whatsappRole: serializeFieldWorker(updated).whatsappRole,
              active: updated.active,
            },
          },
        },
      });
      return updated;
    });

    return Response.json({ worker: serializeFieldWorker(worker) });
  } catch (error) {
    const known = handleKnownError(error);
    if (known) return known;
    console.error('Field worker update failed:', error);
    return Response.json({ error: 'No se pudo actualizar la persona.' }, { status: 500 });
  }
}
