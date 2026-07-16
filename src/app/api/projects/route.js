import { cookies } from 'next/headers';

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
import {
  ACTIVE_PROJECT_COOKIE,
  PROJECT_CAPACITY_STATUSES,
  ProjectInputError,
  activeProjectCapacity,
  activeProjectCookieOptions,
  isUnconfiguredTenantBootstrapProject,
  isSelectableProjectStatus,
  listOrganizationProjects,
  normalizeProjectInput,
  normalizeProjectPatchInput,
  projectConsumesActiveCapacity,
  serializeProject,
  tenantProjectWhere,
  uniqueProjectSlug,
} from '@/lib/projects';

const MAX_PROJECT_JSON_BYTES = 16 * 1024;
const PROJECT_DETAILS_INCLUDE = {
  snapshot: { select: { updatedAt: true } },
  whatsapp: {
    select: {
      connectionStatus: true,
      displayPhoneNumber: true,
      verifiedBusinessName: true,
    },
  },
  _count: { select: { workers: true, tasks: true, incidents: true } },
};

class ProjectLimitError extends Error {
  constructor(plan, capacity) {
    const unit = capacity.limit === 1 ? 'obra operativa' : 'obras operativas';
    super(`El plan ${plan} admite ${capacity.limit} ${unit}. Finalizá o archivá una obra antes de activar otra.`);
    this.name = 'ProjectLimitError';
    this.code = 'PROJECT_LIMIT_REACHED';
    this.capacity = capacity;
  }
}

class ProjectLifecycleError extends Error {
  constructor(message, { code, status = 409 } = {}) {
    super(message);
    this.name = 'ProjectLifecycleError';
    this.code = code || 'PROJECT_LIFECYCLE_ERROR';
    this.status = status;
  }
}

function projectCapacityWhere(organizationId, excludeProjectId = null) {
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

async function createTenantProject(prisma, access, input) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const bootstrapProject = await transaction.project.findFirst({
          where: {
            organizationId: access.organization.id,
            slug: 'obra-principal',
          },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        });
        if (isUnconfiguredTenantBootstrapProject(bootstrapProject)) {
          const configured = await transaction.project.update({
            where: { id: bootstrapProject.id },
            data: input,
            include: PROJECT_DETAILS_INCLUDE,
          });
          await transaction.auditLog.create({
            data: {
              organizationId: access.organization.id,
              actorId: access.databaseUserId,
              action: 'project.created',
              entityType: 'Project',
              entityId: configured.id,
              metadata: {
                name: configured.name,
                slug: configured.slug,
                configuredBootstrap: true,
              },
            },
          });
          return configured;
        }

        const activeCount = await transaction.project.count({
          where: projectCapacityWhere(access.organization.id),
        });
        const capacity = activeProjectCapacity({
          plan: access.organization.subscriptionPlan,
          activeCount,
        });
        if (!capacity.canCreate) {
          throw new ProjectLimitError(access.organization.subscriptionPlan, capacity);
        }
        const slug = await uniqueProjectSlug(
          transaction,
          access.organization.id,
          input.name,
        );
        const created = await transaction.project.create({
          data: {
            organizationId: access.organization.id,
            slug,
            status: 'ACTIVE',
            ...input,
          },
          include: PROJECT_DETAILS_INCLUDE,
        });
        await transaction.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: 'project.created',
            entityType: 'Project',
            entityId: created.id,
            metadata: { name: created.name, slug: created.slug },
          },
        });
        return created;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof ProjectLimitError) throw error;
      const retryable = error?.code === 'P2034' || error?.code === 'P2002';
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error('Project creation retry loop exhausted.');
}

async function updateTenantProject(prisma, access, input) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const current = await transaction.project.findFirst({
          where: tenantProjectWhere(access.organization.id, input.projectId),
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
            where: {
              organizationId: access.organization.id,
              id: { not: current.id },
              status: 'ACTIVE',
            },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });
          const reviewFallback = activeFallback || await transaction.project.findFirst({
            where: {
              organizationId: access.organization.id,
              id: { not: current.id },
              status: { not: 'ARCHIVED' },
            },
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
          where: { id: current.id },
          data: updateData,
          include: PROJECT_DETAILS_INCLUDE,
        });
        const action = current.status === 'ARCHIVED' && nextStatus !== 'ARCHIVED'
          ? 'project.restored'
          : nextStatus === 'ARCHIVED'
            ? 'project.archived'
            : 'project.updated';
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
      if (error?.code !== 'P2034' || attempt === 3) throw error;
    }
  }
  throw new Error('Project update retry loop exhausted.');
}

async function selectProject(projectId) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, activeProjectCookieOptions());
}

function projectErrorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof ProjectInputError) {
    return Response.json({ error: error.message, code: error.code }, { status: 400 });
  }
  if (error instanceof ProjectLimitError) {
    return Response.json({
      error: error.message,
      code: error.code,
      capacity: error.capacity,
    }, { status: 409 });
  }
  if (error instanceof ProjectLifecycleError) {
    return Response.json({
      error: error.message,
      code: error.code,
    }, { status: error.status });
  }
  throw error;
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:projects:read');
    const prisma = getPrisma();
    const [projects, activeCount] = await Promise.all([
      listOrganizationProjects(prisma, access.organization.id),
      prisma.project.count({
        where: projectCapacityWhere(access.organization.id),
      }),
    ]);
    return Response.json({
      projects,
      activeProjectId: access.project.id,
      capacity: activeProjectCapacity({
        plan: access.organization.subscriptionPlan,
        activeCount,
      }),
    });
  } catch (error) {
    try {
      return projectErrorResponse(error);
    } catch (unexpected) {
      console.error('Project catalog failed:', unexpected);
      return Response.json({ error: 'No pudimos cargar las obras.' }, { status: 500 });
    }
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:projects:manage');
    const input = normalizeProjectInput(
      await readJsonRequest(request, { maxBytes: MAX_PROJECT_JSON_BYTES }),
    );
    const prisma = getPrisma();
    const project = await createTenantProject(prisma, access, input);
    await selectProject(project.id);
    return Response.json({ project: serializeProject(project) }, { status: 201 });
  } catch (error) {
    try {
      return projectErrorResponse(error);
    } catch (unexpected) {
      console.error('Project creation failed:', unexpected);
      return Response.json({ error: 'No pudimos crear la obra.' }, { status: 500 });
    }
  }
}

export async function PATCH(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:projects:manage');
    const input = normalizeProjectPatchInput(
      await readJsonRequest(request, { maxBytes: MAX_PROJECT_JSON_BYTES }),
    );
    const result = await updateTenantProject(getPrisma(), access, input);
    if (result.activeProjectId !== access.project.id) {
      await selectProject(result.activeProjectId);
    }
    return Response.json({
      activeProjectId: result.activeProjectId,
      capacity: result.capacity,
      project: serializeProject(result.project),
    });
  } catch (error) {
    try {
      return projectErrorResponse(error);
    } catch (unexpected) {
      console.error('Project update failed:', unexpected);
      return Response.json({ error: 'No pudimos actualizar la obra.' }, { status: 500 });
    }
  }
}

export async function PUT(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:projects:read');
    const { projectId } = await readJsonRequest(request, {
      maxBytes: MAX_PROJECT_JSON_BYTES,
    });
    if (!projectId) throw new ProjectInputError('Seleccioná una obra válida.');
    const project = await getPrisma().project.findFirst({
      where: tenantProjectWhere(access.organization.id, projectId),
      select: { id: true, status: true },
    });
    if (!project || !isSelectableProjectStatus(project.status)) {
      return Response.json({
        error: 'La obra no existe en este tenant o está archivada.',
        code: 'PROJECT_NOT_SELECTABLE',
      }, { status: 404 });
    }
    await selectProject(project.id);
    return Response.json({ activeProjectId: project.id });
  } catch (error) {
    try {
      return projectErrorResponse(error);
    } catch (unexpected) {
      console.error('Project selection failed:', unexpected);
      return Response.json({ error: 'No pudimos cambiar de obra.' }, { status: 500 });
    }
  }
}
