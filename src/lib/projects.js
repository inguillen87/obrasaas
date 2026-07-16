import { PLAN_CATALOG } from './plans.js';

export const ACTIVE_PROJECT_COOKIE = 'obrasaas_active_project';

const PROJECT_STATUSES = new Set(['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);

export class ProjectInputError extends Error {
  constructor(message, code = 'INVALID_PROJECT') {
    super(message);
    this.name = 'ProjectInputError';
    this.code = code;
  }
}

function cleanText(value, { field, min = 0, max }) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (text.length < min) {
    throw new ProjectInputError(`${field} debe tener al menos ${min} caracteres.`);
  }
  if (text.length > max) {
    throw new ProjectInputError(`${field} no puede superar ${max} caracteres.`);
  }
  return text;
}

function optionalDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ProjectInputError(`${field} no es una fecha válida.`);
  }
  return date;
}

function optionalCoordinate(value, field, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ProjectInputError(`${field} debe estar entre ${min} y ${max}.`);
  }
  return number;
}

export function normalizeProjectInput(input = {}) {
  const name = cleanText(input.name, { field: 'El nombre', min: 3, max: 80 });
  const address = input.address
    ? cleanText(input.address, { field: 'La dirección', max: 180 })
    : null;
  const startsAt = optionalDate(input.startsAt, 'La fecha de inicio');
  const endsAt = optionalDate(input.endsAt, 'La fecha de finalización');
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ProjectInputError('La fecha de finalización debe ser posterior al inicio.');
  }

  const geofenceMeters = input.geofenceMeters === '' || input.geofenceMeters == null
    ? 100
    : Number(input.geofenceMeters);
  if (!Number.isInteger(geofenceMeters) || geofenceMeters < 25 || geofenceMeters > 5_000) {
    throw new ProjectInputError('La geocerca debe estar entre 25 y 5000 metros.');
  }

  return {
    name,
    address,
    startsAt,
    endsAt,
    geofenceMeters,
    latitude: optionalCoordinate(input.latitude, 'La latitud', -90, 90),
    longitude: optionalCoordinate(input.longitude, 'La longitud', -180, 180),
  };
}

export function projectSlugBase(value) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54);
  return slug || 'obra';
}

export async function uniqueProjectSlug(prisma, organizationId, name) {
  const base = projectSlugBase(name);
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug: candidate } },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new ProjectInputError('No pudimos generar un identificador único para la obra.');
}

export function activeProjectLimit(plan) {
  if (!PLAN_CATALOG[plan]) return 0;
  return PLAN_CATALOG[plan].limits.activeProjects;
}

export function activeProjectCapacity({ plan, activeCount }) {
  const limit = activeProjectLimit(plan);
  return {
    limit,
    used: activeCount,
    remaining: limit == null ? null : Math.max(0, limit - activeCount),
    canCreate: limit == null || activeCount < limit,
  };
}

export function isUnconfiguredTenantBootstrapProject(project) {
  return Boolean(
    project
    && project.status === 'ACTIVE'
    && project.name === 'Obra principal'
    && project.slug === 'obra-principal'
    && project.address == null
    && project.latitude == null
    && project.longitude == null,
  );
}

export function activeProjectCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    priority: 'high',
  };
}

export function isSelectableProjectStatus(status) {
  return PROJECT_STATUSES.has(status) && status !== 'ARCHIVED';
}

export function tenantProjectWhere(organizationId, projectId) {
  if (!organizationId || !projectId) {
    throw new ProjectInputError('La obra y la organización son obligatorias.');
  }
  return { id: String(projectId), organizationId: String(organizationId) };
}

export function serializeProject(project) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    address: project.address,
    latitude: project.latitude == null ? null : Number(project.latitude),
    longitude: project.longitude == null ? null : Number(project.longitude),
    geofenceMeters: project.geofenceMeters,
    startsAt: project.startsAt?.toISOString() || null,
    endsAt: project.endsAt?.toISOString() || null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastActivityAt: project.snapshot?.updatedAt?.toISOString() || null,
    whatsapp: project.whatsapp
      ? {
          status: project.whatsapp.connectionStatus,
          displayPhoneNumber: project.whatsapp.displayPhoneNumber,
          verifiedBusinessName: project.whatsapp.verifiedBusinessName,
        }
      : null,
    counts: {
      workers: project._count?.workers || 0,
      tasks: project._count?.tasks || 0,
      incidents: project._count?.incidents || 0,
    },
  };
}

export async function listOrganizationProjects(prisma, organizationId) {
  const projects = await prisma.project.findMany({
    where: { organizationId },
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
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });
  return projects.map(serializeProject);
}
