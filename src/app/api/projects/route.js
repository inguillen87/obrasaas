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
  PROJECT_DETAILS_INCLUDE,
  ProjectLifecycleError,
  ProjectLimitError,
  projectCapacityWhere,
  updateTenantProject,
} from '@/lib/project-lifecycle';
import {
  ACTIVE_PROJECT_COOKIE,
  ProjectInputError,
  activeProjectCapacity,
  activeProjectCookieOptions,
  attachProjectOperationalCounts,
  isUnconfiguredTenantBootstrapProject,
  isSelectableProjectStatus,
  listOrganizationProjects,
  normalizeProjectInput,
  normalizeProjectPatchInput,
  serializeProject,
  uniqueProjectSlug,
} from '@/lib/projects';
import {
  grantCreatedProjectAccessToActor,
  projectAccessWhere,
} from '@/lib/project-access';
import { synchronizeProjectTaskProjection } from '@/lib/project-tasks';
import { lockProjectTransaction } from '@/lib/project-write-policy';

const MAX_PROJECT_JSON_BYTES = 16 * 1024;

async function createTenantProject(prisma, access, input) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const bootstrapProject = await transaction.project.findFirst({
          where: projectAccessWhere(access, { slug: 'obra-principal' }),
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
          await lockProjectTransaction(transaction, bootstrapProject.id);
          const configured = await transaction.project.update({
            where: { id: bootstrapProject.id },
            data: input,
            include: PROJECT_DETAILS_INCLUDE,
          });
          await grantCreatedProjectAccessToActor(
            transaction,
            access,
            configured.id,
          );
          const snapshot = await transaction.projectSnapshot.findUnique({
            where: { projectId: bootstrapProject.id },
            select: { state: true, version: true },
          });
          await synchronizeProjectTaskProjection(transaction, {
            projectId: bootstrapProject.id,
            nextTasks: snapshot?.state?.tasks,
            projectStartsAt: configured.startsAt,
            stateVersion: snapshot?.version ?? 0,
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
        await grantCreatedProjectAccessToActor(
          transaction,
          access,
          created.id,
        );
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

async function selectProject(projectId) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, activeProjectCookieOptions());
}

async function findAccessibleProjectFallback(prisma, access, excludedProjectId) {
  const activeFallback = await prisma.project.findFirst({
    where: projectAccessWhere(access, {
      id: { not: excludedProjectId },
      status: 'ACTIVE',
    }),
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (activeFallback) return activeFallback;

  return prisma.project.findFirst({
    where: projectAccessWhere(access, {
      id: { not: excludedProjectId },
      status: { not: 'ARCHIVED' },
    }),
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
}

async function serializeMutatedProject(prisma, organizationId, project) {
  try {
    const [projectWithCounts] = await attachProjectOperationalCounts(
      prisma,
      organizationId,
      [project],
    );
    return serializeProject(projectWithCounts);
  } catch (error) {
    console.error('Operational project count refresh failed after a committed mutation:', error);
    return serializeProject(project);
  }
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
      listOrganizationProjects(prisma, access),
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
    const serializedProject = await serializeMutatedProject(
      prisma,
      access.organization.id,
      project,
    );
    return Response.json({ project: serializedProject }, { status: 201 });
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
    const prisma = getPrisma();
    const authorizedProject = await prisma.project.findFirst({
      where: projectAccessWhere(access, { id: input.projectId }),
      select: { id: true },
    });
    if (!authorizedProject) {
      throw new ProjectLifecycleError(
        'La obra no existe o no está asignada a tu cuenta.',
        { code: 'PROJECT_NOT_FOUND', status: 404 },
      );
    }

    let accessibleFallback = null;
    if (input.data.status === 'ARCHIVED' && input.projectId === access.project.id) {
      accessibleFallback = await findAccessibleProjectFallback(
        prisma,
        access,
        input.projectId,
      );
      if (!accessibleFallback) {
        throw new ProjectLifecycleError(
          'No podés archivar tu única obra asignada. Pedí otra asignación antes de continuar.',
          { code: 'PROJECT_LAST_CONTEXT' },
        );
      }
    }

    const result = await updateTenantProject(prisma, access, input);
    if (accessibleFallback) result.activeProjectId = accessibleFallback.id;
    if (result.activeProjectId !== access.project.id) {
      await selectProject(result.activeProjectId);
    }
    const serializedProject = await serializeMutatedProject(
      prisma,
      access.organization.id,
      result.project,
    );
    return Response.json({
      activeProjectId: result.activeProjectId,
      capacity: result.capacity,
      project: serializedProject,
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
      where: projectAccessWhere(access, { id: String(projectId) }),
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
