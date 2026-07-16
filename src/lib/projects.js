import { PLAN_CATALOG } from './plans.js';

export const ACTIVE_PROJECT_COOKIE = 'obrasaas_active_project';

export const PROJECT_STATUSES = Object.freeze([
  'PLANNING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
]);
export const PROJECT_CAPACITY_STATUSES = Object.freeze([
  'PLANNING',
  'ACTIVE',
  'PAUSED',
]);

const PROJECT_STATUS_SET = new Set(PROJECT_STATUSES);
const PROJECT_CAPACITY_STATUS_SET = new Set(PROJECT_CAPACITY_STATUSES);
const PROJECT_PATCH_FIELDS = new Set([
  'name',
  'address',
  'startsAt',
  'endsAt',
  'geofenceMeters',
  'latitude',
  'longitude',
  'status',
]);

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

  const latitude = optionalCoordinate(input.latitude, 'La latitud', -90, 90);
  const longitude = optionalCoordinate(input.longitude, 'La longitud', -180, 180);
  if ((latitude == null) !== (longitude == null)) {
    throw new ProjectInputError(
      'La geocerca necesita latitud y longitud juntas.',
      'PROJECT_COORDINATES_INCOMPLETE',
    );
  }

  return {
    name,
    address,
    startsAt,
    endsAt,
    geofenceMeters,
    latitude,
    longitude,
  };
}

export function normalizeProjectPatchInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProjectInputError('La actualización de la obra no es válida.');
  }
  const unknownEnvelopeFields = Object.keys(input).filter(
    (field) => !['projectId', 'expectedUpdatedAt', 'data'].includes(field),
  );
  if (unknownEnvelopeFields.length > 0) {
    throw new ProjectInputError(`Campo no permitido: ${unknownEnvelopeFields[0]}.`);
  }

  const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : '';
  if (!projectId) {
    throw new ProjectInputError('Seleccioná una obra válida.');
  }
  const expectedDate = new Date(input.expectedUpdatedAt);
  if (
    typeof input.expectedUpdatedAt !== 'string'
    || !input.expectedUpdatedAt.trim()
    || Number.isNaN(expectedDate.getTime())
  ) {
    throw new ProjectInputError(
      'La versión de la obra es obligatoria para evitar sobrescribir cambios.',
      'PROJECT_VERSION_REQUIRED',
    );
  }

  if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) {
    throw new ProjectInputError('Los cambios de la obra son obligatorios.');
  }
  const unknownFields = Object.keys(input.data).filter(
    (field) => !PROJECT_PATCH_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    throw new ProjectInputError(`Campo de obra no permitido: ${unknownFields[0]}.`);
  }

  const data = {};
  if (Object.hasOwn(input.data, 'name')) {
    data.name = cleanText(input.data.name, { field: 'El nombre', min: 3, max: 80 });
  }
  if (Object.hasOwn(input.data, 'address')) {
    data.address = input.data.address
      ? cleanText(input.data.address, { field: 'La dirección', max: 180 })
      : null;
  }

  const hasStartsAt = Object.hasOwn(input.data, 'startsAt');
  const hasEndsAt = Object.hasOwn(input.data, 'endsAt');
  if (hasStartsAt !== hasEndsAt) {
    throw new ProjectInputError(
      'Para actualizar el cronograma enviá inicio y final prevista juntos.',
      'PROJECT_DATES_INCOMPLETE',
    );
  }
  if (hasStartsAt) {
    data.startsAt = optionalDate(input.data.startsAt, 'La fecha de inicio');
    data.endsAt = optionalDate(input.data.endsAt, 'La fecha de finalización');
    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
      throw new ProjectInputError('La fecha de finalización debe ser posterior al inicio.');
    }
  }

  if (Object.hasOwn(input.data, 'geofenceMeters')) {
    const geofenceMeters = Number(input.data.geofenceMeters);
    if (!Number.isInteger(geofenceMeters) || geofenceMeters < 25 || geofenceMeters > 5_000) {
      throw new ProjectInputError('La geocerca debe estar entre 25 y 5000 metros.');
    }
    data.geofenceMeters = geofenceMeters;
  }

  const hasLatitude = Object.hasOwn(input.data, 'latitude');
  const hasLongitude = Object.hasOwn(input.data, 'longitude');
  if (hasLatitude !== hasLongitude) {
    throw new ProjectInputError(
      'Para actualizar la geocerca enviá latitud y longitud juntas.',
      'PROJECT_COORDINATES_INCOMPLETE',
    );
  }
  if (hasLatitude) {
    data.latitude = optionalCoordinate(input.data.latitude, 'La latitud', -90, 90);
    data.longitude = optionalCoordinate(input.data.longitude, 'La longitud', -180, 180);
    if ((data.latitude == null) !== (data.longitude == null)) {
      throw new ProjectInputError(
        'Para activar la geocerca necesitás latitud y longitud.',
        'PROJECT_COORDINATES_INCOMPLETE',
      );
    }
  }

  if (Object.hasOwn(input.data, 'status')) {
    const status = String(input.data.status || '').trim().toUpperCase();
    if (!PROJECT_STATUS_SET.has(status)) {
      throw new ProjectInputError('El estado operativo de la obra no es válido.');
    }
    data.status = status;
  }
  if (Object.keys(data).length === 0) {
    throw new ProjectInputError('Agregá al menos un cambio para guardar.');
  }

  return {
    projectId,
    expectedUpdatedAt: expectedDate.toISOString(),
    data,
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

export function projectConsumesActiveCapacity(status) {
  return PROJECT_CAPACITY_STATUS_SET.has(status);
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
  return PROJECT_STATUS_SET.has(status) && status !== 'ARCHIVED';
}

export function tenantProjectWhere(organizationId, projectId) {
  if (!organizationId || !projectId) {
    throw new ProjectInputError('La obra y la organización son obligatorias.');
  }
  return { id: String(projectId), organizationId: String(organizationId) };
}

export function serializeProject(project) {
  const operationalCounts = project.operationalCounts;
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
      tasks: operationalCounts?.tasks ?? project._count?.tasks ?? 0,
      incidents: operationalCounts?.incidents ?? project._count?.incidents ?? 0,
    },
  };
}

const PROJECT_OPERATIONAL_COUNTS_SQL = `
  SELECT
    project."id" AS "projectId",
    CASE
      WHEN jsonb_typeof(snapshot."state"->'tasks') = 'object'
        THEN (
          SELECT count(*)
          FROM jsonb_object_keys(snapshot."state"->'tasks')
        )
      ELSE 0
    END::integer AS "tasks",
    CASE
      WHEN jsonb_typeof(snapshot."state"->'incidents') = 'array'
        THEN jsonb_array_length(snapshot."state"->'incidents')
      ELSE 0
    END::integer AS "incidents"
  FROM "Project" AS project
  LEFT JOIN "ProjectSnapshot" AS snapshot
    ON snapshot."projectId" = project."id"
  WHERE project."organizationId" = $1
    AND ($2::text IS NULL OR project."id" = $2)
`;

export async function attachProjectOperationalCounts(
  prisma,
  organizationId,
  projects,
) {
  if (!organizationId || !Array.isArray(projects) || projects.length === 0) return projects;
  const onlyProjectId = projects.length === 1 ? projects[0].id : null;
  const rows = await prisma.$queryRawUnsafe(
    PROJECT_OPERATIONAL_COUNTS_SQL,
    organizationId,
    onlyProjectId,
  );
  const countsByProject = new Map(
    rows.map((row) => [
      row.projectId,
      {
        tasks: Number(row.tasks) || 0,
        incidents: Number(row.incidents) || 0,
      },
    ]),
  );
  return projects.map((project) => ({
    ...project,
    operationalCounts: countsByProject.get(project.id) || { tasks: 0, incidents: 0 },
  }));
}

export async function listOrganizationProjects(prisma, organizationId) {
  const projects = await prisma.project.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      address: true,
      latitude: true,
      longitude: true,
      geofenceMeters: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      updatedAt: true,
      snapshot: { select: { updatedAt: true } },
      whatsapp: {
        select: {
          connectionStatus: true,
          displayPhoneNumber: true,
          verifiedBusinessName: true,
        },
      },
      _count: { select: { workers: true } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });
  const countedProjects = await attachProjectOperationalCounts(
    prisma,
    organizationId,
    projects,
  );
  return countedProjects.map(serializeProject);
}
