import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { tenantRoleHasPortfolioAccess } from '@/lib/project-access';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';

const MAX_PROJECT_ACCESS_JSON_BYTES = 16 * 1024;
export const MAX_PROJECTS_PER_MEMBERSHIP = 200;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_TRANSACTION_ATTEMPTS = 3;

export class ProjectAccessRouteError extends Error {
  constructor(message, {
    code = 'PROJECT_ACCESS_INVALID',
    status = 400,
    details = null,
  } = {}) {
    super(message);
    this.name = 'ProjectAccessRouteError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizeIdentifier(value, field) {
  if (typeof value !== 'string' || value !== value.trim() || !IDENTIFIER_PATTERN.test(value)) {
    throw new ProjectAccessRouteError(`${field} no es válido.`, {
      code: 'PROJECT_ACCESS_IDENTIFIER_INVALID',
    });
  }
  return value;
}

export function normalizeProjectAccessInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProjectAccessRouteError('La asignación debe ser un objeto JSON.');
  }

  const allowedFields = new Set(['membershipId', 'projectIds', 'expectedProjectIds']);
  const unknownFields = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new ProjectAccessRouteError(
      `Campos no permitidos: ${unknownFields.join(', ')}.`,
      { code: 'PROJECT_ACCESS_UNKNOWN_FIELDS' },
    );
  }

  const membershipId = normalizeIdentifier(input.membershipId, 'membershipId');
  function normalizeProjectIds(value, field) {
    if (!Array.isArray(value)) {
      throw new ProjectAccessRouteError(`${field} debe ser una lista.`, {
        code: 'PROJECT_ACCESS_PROJECTS_INVALID',
      });
    }
    if (value.length > MAX_PROJECTS_PER_MEMBERSHIP) {
      throw new ProjectAccessRouteError(
        `No se pueden declarar más de ${MAX_PROJECTS_PER_MEMBERSHIP} obras por operación.`,
        { code: 'PROJECT_ACCESS_PROJECT_LIMIT' },
      );
    }
    const projectIds = value.map((projectId) => normalizeIdentifier(projectId, 'projectId'));
    if (new Set(projectIds).size !== projectIds.length) {
      throw new ProjectAccessRouteError(`${field} contiene obras duplicadas.`, {
        code: 'PROJECT_ACCESS_DUPLICATE_PROJECT',
      });
    }
    return projectIds.sort((left, right) => left.localeCompare(right, 'en'));
  }

  if (!Object.hasOwn(input, 'expectedProjectIds')) {
    throw new ProjectAccessRouteError('Falta la versión esperada del alcance actual.', {
      code: 'PROJECT_ACCESS_VERSION_REQUIRED',
    });
  }
  if (!Array.isArray(input.projectIds)) {
    throw new ProjectAccessRouteError('projectIds debe ser una lista.', {
      code: 'PROJECT_ACCESS_PROJECTS_INVALID',
    });
  }

  return {
    membershipId,
    projectIds: normalizeProjectIds(input.projectIds, 'projectIds'),
    expectedProjectIds: normalizeProjectIds(
      input.expectedProjectIds,
      'expectedProjectIds',
    ),
  };
}

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });
}

function sortedProjectIds(rows) {
  return rows
    .map((row) => row.projectId)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function projectAccessDiff(previous, next) {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    addedProjectIds: next.filter((projectId) => !previousSet.has(projectId)),
    removedProjectIds: previous.filter((projectId) => !nextSet.has(projectId)),
  };
}

async function updateProjectAccessAssignments({
  prisma,
  access,
  input,
  hasPortfolioAccess,
}) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          `obrasaas:project-access:${access.organization.id}:${input.membershipId}`,
        );

        const membership = await transaction.tenantMembership.findFirst({
          where: {
            id: input.membershipId,
            organizationId: access.organization.id,
          },
          select: {
            id: true,
            tenantRole: true,
            status: true,
            user: { select: { primaryEmail: true } },
          },
        });
        if (!membership) {
          throw new ProjectAccessRouteError(
            'La membresía no pertenece a este tenant.',
            { code: 'PROJECT_ACCESS_MEMBERSHIP_NOT_FOUND', status: 404 },
          );
        }
        if (membership.status !== 'ACTIVE') {
          throw new ProjectAccessRouteError(
            'Sólo se puede asignar acceso a integrantes activos.',
            { code: 'PROJECT_ACCESS_MEMBERSHIP_INACTIVE', status: 409 },
          );
        }
        if (hasPortfolioAccess(membership.tenantRole)) {
          throw new ProjectAccessRouteError(
            'Este rol tiene acceso efectivo al portfolio completo y no admite asignaciones parciales.',
            { code: 'PROJECT_ACCESS_PORTFOLIO_ROLE', status: 409 },
          );
        }

        const validProjects = input.projectIds.length === 0
          ? []
          : await transaction.project.findMany({
              where: {
                id: { in: input.projectIds },
                organizationId: access.organization.id,
                status: { not: 'ARCHIVED' },
              },
              select: { id: true },
            });
        if (validProjects.length !== input.projectIds.length) {
          throw new ProjectAccessRouteError(
            'Una o más obras no pertenecen al tenant o ya están archivadas.',
            { code: 'PROJECT_ACCESS_PROJECT_NOT_FOUND' },
          );
        }

        const previousRows = await transaction.projectMembership.findMany({
          where: {
            tenantMembershipId: membership.id,
            status: 'ACTIVE',
            project: { status: { not: 'ARCHIVED' } },
          },
          select: { projectId: true },
        });
        const previous = sortedProjectIds(previousRows);
        const next = input.projectIds;
        if (
          previous.length !== input.expectedProjectIds.length
          || previous.some((projectId, index) => projectId !== input.expectedProjectIds[index])
        ) {
          throw new ProjectAccessRouteError(
            'El alcance cambió en otra sesión. Revisá el estado actualizado antes de guardar.',
            {
              code: 'PROJECT_ACCESS_STALE',
              status: 409,
              details: { currentProjectIds: previous },
            },
          );
        }
        const diff = projectAccessDiff(previous, next);
        const changed = diff.addedProjectIds.length > 0 || diff.removedProjectIds.length > 0;

        await transaction.projectMembership.deleteMany({
          where: next.length === 0
            ? {
                tenantMembershipId: membership.id,
                project: { status: { not: 'ARCHIVED' } },
              }
            : {
                tenantMembershipId: membership.id,
                project: { status: { not: 'ARCHIVED' } },
                OR: [
                  { projectId: { notIn: next } },
                  { projectId: { in: next }, status: { not: 'ACTIVE' } },
                ],
              },
        });
        if (next.length > 0) {
          await transaction.projectMembership.createMany({
            data: next.map((projectId) => ({
              projectId,
              tenantMembershipId: membership.id,
              status: 'ACTIVE',
            })),
            skipDuplicates: true,
          });
        }

        await transaction.auditLog.create({
          data: {
            organizationId: access.organization.id,
            actorId: access.databaseUserId,
            action: 'tenant.project_access.updated',
            entityType: 'TenantMembership',
            entityId: membership.id,
            metadata: {
              userEmail: membership.user.primaryEmail,
              tenantRole: membership.tenantRole,
              previous: { projectIds: previous },
              next: { projectIds: next },
              diff,
              changed,
            },
          },
        });

        return {
          membershipId: membership.id,
          tenantRole: membership.tenantRole,
          portfolioAccess: false,
          projectIds: next,
          changed,
        };
      }, {
        isolationLevel: 'Serializable',
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (error?.code !== 'P2034' || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw new Error('Project access transaction retry loop exhausted.');
}

export function createProjectAccessPatchHandler({
  resolveAccess = getPlatformAccess,
  prismaFactory = getPrisma,
  hasPortfolioAccess = tenantRoleHasPortfolioAccess,
} = {}) {
  return async function patchProjectAccess(request) {
    try {
      const access = await resolveAccess();
      requireTenantPermission(access, 'tenant:members:manage');
      const input = normalizeProjectAccessInput(await readJsonRequest(request, {
        maxBytes: MAX_PROJECT_ACCESS_JSON_BYTES,
      }));
      const projectAccess = await updateProjectAccessAssignments({
        prisma: prismaFactory(),
        access,
        input,
        hasPortfolioAccess,
      });
      return json({ projectAccess });
    } catch (error) {
      if (error instanceof AccessError) return accessErrorResponse(error);
      if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
      if (error instanceof ProjectAccessRouteError) {
        return json({
          error: error.message,
          code: error.code,
          ...(error.details || {}),
        }, { status: error.status });
      }
      console.error('Project access update failed:', error);
      return json({ error: 'No se pudo actualizar el acceso a las obras.' }, { status: 500 });
    }
  };
}

export const PATCH = createProjectAccessPatchHandler();
