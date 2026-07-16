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
  ProjectInputError,
  activeProjectCapacity,
  activeProjectCookieOptions,
  isUnconfiguredTenantBootstrapProject,
  isSelectableProjectStatus,
  listOrganizationProjects,
  normalizeProjectInput,
  serializeProject,
  tenantProjectWhere,
  uniqueProjectSlug,
} from '@/lib/projects';

const MAX_PROJECT_JSON_BYTES = 16 * 1024;

class ProjectLimitError extends Error {
  constructor(plan, capacity) {
    super(`El plan ${plan} admite ${capacity.limit} obra activa. Archivá una obra o cambiá de plan para crear otra.`);
    this.name = 'ProjectLimitError';
    this.code = 'PROJECT_LIMIT_REACHED';
    this.capacity = capacity;
  }
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
            include: {
              snapshot: { select: { updatedAt: true } },
              whatsapp: {
                select: {
                  connectionStatus: true,
                  displayPhoneNumber: true,
                  verifiedBusinessName: true,
                },
              },
              _count: { select: { workers: true, tasks: true, incidents: true } },
            },
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
          where: { organizationId: access.organization.id, status: 'ACTIVE' },
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
          include: {
            snapshot: { select: { updatedAt: true } },
            whatsapp: {
              select: {
                connectionStatus: true,
                displayPhoneNumber: true,
                verifiedBusinessName: true,
              },
            },
            _count: { select: { workers: true, tasks: true, incidents: true } },
          },
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
        where: { organizationId: access.organization.id, status: 'ACTIVE' },
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
