import {
  PROJECT_CAPACITY_STATUSES,
  ProjectInputError,
  activeProjectCapacity,
  projectConsumesActiveCapacity,
} from './projects.js';
import { reprojectCanonicalTaskSchedules } from './canonical-tasks.js';
import { projectAccessWhere } from './project-access.js';
import { synchronizeProjectTaskProjection } from './project-tasks.js';
import { lockProjectTransaction } from './project-write-policy.js';

export const PROJECT_DETAILS_INCLUDE = {
  snapshot: { select: { updatedAt: true } },
  whatsapp: {
    select: {
      enabled: true,
      connectionStatus: true,
      displayPhoneNumber: true,
      lastError: true,
      metadata: true,
      verifiedBusinessName: true,
    },
  },
  _count: { select: { workers: true, tasks: true, incidents: true } },
};

export class ProjectLimitError extends Error {
  constructor(plan, capacity) {
    const unit = capacity.limit === 1 ? 'obra operativa' : 'obras operativas';
    super(`El plan ${plan} admite ${capacity.limit} ${unit}. Finalizá o archivá una obra antes de activar otra.`);
    this.name = 'ProjectLimitError';
    this.code = 'PROJECT_LIMIT_REACHED';
    this.capacity = capacity;
  }
}

export class ProjectLifecycleError extends Error {
  constructor(message, { code, status = 409 } = {}) {
    super(message);
    this.name = 'ProjectLifecycleError';
    this.code = code || 'PROJECT_LIFECYCLE_ERROR';
    this.status = status;
  }
}

export function projectCapacityWhere(organizationId, excludeProjectId = null) {
  return {
    organizationId,
    status: { in: PROJECT_CAPACITY_STATUSES },
    ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
  };
}

function comparableProjectValue(field, value) {
  if (value == null) return null;
  if (field === 'startsAt' || field === 'endsAt') {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
  if (field === 'latitude' || field === 'longitude' || field === 'geofenceMeters') {
    return Number(value);
  }
  return value;
}

function changedProjectData(current, data) {
  const changed = {};
  for (const [field, value] of Object.entries(data)) {
    if (comparableProjectValue(field, current[field]) !== comparableProjectValue(field, value)) {
      changed[field] = value;
    }
  }
  return changed;
}

function projectLifecycleAuditAction(currentStatus, nextStatus) {
  if (currentStatus !== 'ARCHIVED' && nextStatus === 'ARCHIVED') {
    return 'project.archived';
  }
  if (currentStatus === 'ARCHIVED' && nextStatus !== 'ARCHIVED') {
    return 'project.restored';
  }
  return 'project.updated';
}

function closesProject(status) {
  return status === 'COMPLETED' || status === 'ARCHIVED';
}

function activeMaterialReservationError() {
  return new ProjectLifecycleError(
    'La obra tiene materiales reservados. Liberá todas las reservas activas antes de finalizarla o archivarla.',
    { code: 'PROJECT_ACTIVE_MATERIAL_RESERVATIONS', status: 409 },
  );
}

function databaseErrorText(error) {
  return [
    error?.message,
    error?.meta?.message,
    error?.meta?.database_error,
  ].filter((value) => typeof value === 'string').join(' ');
}

export async function updateTenantProject(prisma, access, input) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await lockProjectTransaction(transaction, input.projectId);

        const current = await transaction.project.findFirst({
          where: projectAccessWhere(access, { id: input.projectId }),
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            latitude: true,
            longitude: true,
            geofenceMeters: true,
            startsAt: true,
            endsAt: true,
            updatedAt: true,
          },
        });
        if (!current) {
          throw new ProjectLifecycleError('La obra no existe dentro de esta organización.', {
            code: 'PROJECT_NOT_FOUND',
            status: 404,
          });
        }
        if (current.updatedAt.toISOString() !== input.expectedUpdatedAt) {
          throw new ProjectLifecycleError(
            'La obra cambió desde que abriste el editor. Recargá el portfolio antes de guardar.',
            { code: 'PROJECT_VERSION_CONFLICT' },
          );
        }

        const updateData = changedProjectData(current, input.data);
        const changedFields = Object.keys(updateData);
        if (changedFields.length === 0) {
          throw new ProjectLifecycleError('No hay cambios nuevos para guardar.', {
            code: 'PROJECT_NO_CHANGES',
            status: 400,
          });
        }

        const nextStatus = updateData.status || current.status;
        if (!closesProject(current.status) && closesProject(nextStatus)) {
          const activeReservation = await transaction.taskMaterialActiveReservation.findFirst({
            where: {
              organizationId: access.organization.id,
              projectId: current.id,
            },
            select: { taskId: true },
          });
          if (activeReservation) throw activeMaterialReservationError();
        }
        if (
          projectConsumesActiveCapacity(nextStatus)
          && !projectConsumesActiveCapacity(current.status)
        ) {
          const used = await transaction.project.count({
            where: projectCapacityWhere(access.organization.id, current.id),
          });
          const capacity = activeProjectCapacity({
            plan: access.organization.subscriptionPlan,
            activeCount: used,
          });
          if (!capacity.canCreate) {
            throw new ProjectLimitError(access.organization.subscriptionPlan, capacity);
          }
        }

        let activeProjectId = access.project.id;
        if (nextStatus === 'ARCHIVED' && current.id === access.project.id) {
          const activeFallback = await transaction.project.findFirst({
            where: projectAccessWhere(access, {
              id: { not: current.id },
              status: 'ACTIVE',
            }),
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });
          const reviewFallback = activeFallback || await transaction.project.findFirst({
            where: projectAccessWhere(access, {
              id: { not: current.id },
              status: { not: 'ARCHIVED' },
            }),
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });
          if (!reviewFallback) {
            throw new ProjectLifecycleError(
              'No podés archivar el único contexto disponible. Creá otra obra o conservá esta como finalizada.',
              { code: 'PROJECT_LAST_CONTEXT' },
            );
          }
          activeProjectId = reviewFallback.id;
        }

        const updated = await transaction.project.update({
          where: projectAccessWhere(access, { id: current.id }),
          data: updateData,
          include: PROJECT_DETAILS_INCLUDE,
        });
        let resetProjectAccessCount = 0;
        if (current.status !== 'ARCHIVED' && nextStatus === 'ARCHIVED') {
          const reset = await transaction.projectMembership.updateMany({
            where: {
              projectId: current.id,
              status: 'ACTIVE',
            },
            data: { status: 'DISABLED' },
          });
          resetProjectAccessCount = reset.count;
        }
        let canonicalScheduleReprojectedCount = 0;
        if (changedFields.includes('startsAt')) {
          const snapshot = await transaction.projectSnapshot.findUnique({
            where: { projectId: current.id },
            select: { state: true, version: true },
          });
          await synchronizeProjectTaskProjection(transaction, {
            projectId: current.id,
            nextTasks: snapshot?.state?.tasks,
            projectStartsAt: updated.startsAt,
            stateVersion: snapshot?.version ?? 0,
          });
          canonicalScheduleReprojectedCount = await reprojectCanonicalTaskSchedules(transaction, {
            projectId: current.id,
            projectStartsAt: updated.startsAt,
          });
        }
        const action = projectLifecycleAuditAction(current.status, nextStatus);
        await transaction.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action,
            entityType: 'Project',
            entityId: updated.id,
            metadata: {
              changedFields,
              previousStatus: current.status,
              nextStatus,
              resetProjectAccessCount,
              canonicalScheduleReprojectedCount,
            },
          },
        });
        const used = await transaction.project.count({
          where: projectCapacityWhere(access.organization.id),
        });
        return {
          activeProjectId,
          capacity: activeProjectCapacity({
            plan: access.organization.subscriptionPlan,
            activeCount: used,
          }),
          project: updated,
        };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (
        error instanceof ProjectLimitError
        || error instanceof ProjectLifecycleError
        || error instanceof ProjectInputError
      ) {
        throw error;
      }
      if (databaseErrorText(error).includes('TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY')) {
        throw activeMaterialReservationError();
      }
      if (error?.code !== 'P2034' || attempt === 3) throw error;
    }
  }
  throw new Error('Project update retry loop exhausted.');
}
