import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProjectInputError,
  activeProjectCapacity,
  attachProjectOperationalCounts,
  isUnconfiguredTenantBootstrapProject,
  isSelectableProjectStatus,
  normalizeProjectInput,
  normalizeProjectPatchInput,
  listOrganizationProjects,
  projectConsumesActiveCapacity,
  projectSlugBase,
  serializeProject,
  tenantProjectWhere,
} from '../src/lib/projects.js';

test('project names become stable tenant-local slugs', () => {
  assert.equal(projectSlugBase('  Hospital Regional – Córdoba  '), 'hospital-regional-cordoba');
  assert.equal(projectSlugBase('***'), 'obra');
});

test('project input normalizes dates, geofence and optional coordinates', () => {
  const project = normalizeProjectInput({
    name: ' Hospital Regional Norte ',
    address: ' Ruta 9, Córdoba ',
    startsAt: '2026-07-15',
    endsAt: '2027-04-30',
    geofenceMeters: '175',
    latitude: '-31.4201',
    longitude: '-64.1888',
  });
  assert.equal(project.name, 'Hospital Regional Norte');
  assert.equal(project.address, 'Ruta 9, Córdoba');
  assert.equal(project.geofenceMeters, 175);
  assert.equal(project.latitude, -31.4201);
  assert.equal(project.longitude, -64.1888);
  assert.equal(project.startsAt.toISOString(), '2026-07-15T00:00:00.000Z');
});

test('project input rejects unsafe operational ranges', () => {
  assert.throws(
    () => normalizeProjectInput({ name: 'Obra válida', geofenceMeters: 10 }),
    ProjectInputError,
  );
  assert.throws(
    () => normalizeProjectInput({
      name: 'Obra válida',
      startsAt: '2027-01-01',
      endsAt: '2026-01-01',
    }),
    /posterior/,
  );
  assert.throws(
    () => normalizeProjectInput({
      name: 'Obra válida',
      latitude: -34.6,
    }),
    (error) => error.code === 'PROJECT_COORDINATES_INCOMPLETE',
  );
});

test('project patch input is strict, versioned and normalizes the complete editor payload', () => {
  const patch = normalizeProjectPatchInput({
    projectId: ' project-1 ',
    expectedUpdatedAt: '2026-07-16T10:30:00.000Z',
    data: {
      name: ' Hospital Regional Norte ',
      address: '',
      startsAt: '2026-08-01',
      endsAt: '2027-03-31',
      geofenceMeters: '225',
      latitude: '-31.4201',
      longitude: '-64.1888',
      status: 'paused',
    },
  });

  assert.equal(patch.projectId, 'project-1');
  assert.equal(patch.expectedUpdatedAt, '2026-07-16T10:30:00.000Z');
  assert.equal(patch.data.name, 'Hospital Regional Norte');
  assert.equal(patch.data.address, null);
  assert.equal(patch.data.geofenceMeters, 225);
  assert.equal(patch.data.latitude, -31.4201);
  assert.equal(patch.data.longitude, -64.1888);
  assert.equal(patch.data.status, 'PAUSED');
});

test('project patch input rejects stale-unsafe and incomplete payloads', () => {
  assert.throws(
    () => normalizeProjectPatchInput({
      projectId: 'project-1',
      data: { status: 'ACTIVE' },
    }),
    (error) => error.code === 'PROJECT_VERSION_REQUIRED',
  );
  assert.throws(
    () => normalizeProjectPatchInput({
      projectId: 'project-1',
      expectedUpdatedAt: '2026-07-16T10:30:00.000Z',
      data: { latitude: -34.6 },
    }),
    (error) => error.code === 'PROJECT_COORDINATES_INCOMPLETE',
  );
  assert.throws(
    () => normalizeProjectPatchInput({
      projectId: 'project-1',
      expectedUpdatedAt: '2026-07-16T10:30:00.000Z',
      data: { unexpected: true },
    }),
    /no permitido/,
  );
});

test('plan capacity prevents silent project overages', () => {
  assert.deepEqual(activeProjectCapacity({ plan: 'TRIAL', activeCount: 1 }), {
    limit: 1,
    used: 1,
    remaining: 0,
    canCreate: false,
  });
  assert.equal(activeProjectCapacity({ plan: 'PRO', activeCount: 9 }).canCreate, true);
  assert.equal(activeProjectCapacity({ plan: 'ENTERPRISE', activeCount: 500 }).limit, null);
  assert.equal(activeProjectCapacity({ plan: 'UNKNOWN', activeCount: 0 }).canCreate, false);
  assert.equal(projectConsumesActiveCapacity('PLANNING'), true);
  assert.equal(projectConsumesActiveCapacity('ACTIVE'), true);
  assert.equal(projectConsumesActiveCapacity('PAUSED'), true);
  assert.equal(projectConsumesActiveCapacity('COMPLETED'), false);
  assert.equal(projectConsumesActiveCapacity('ARCHIVED'), false);
});

test('the first real project configures the empty tenant bootstrap instead of consuming a second seat', () => {
  assert.equal(isUnconfiguredTenantBootstrapProject({
    name: 'Obra principal',
    slug: 'obra-principal',
    status: 'ACTIVE',
    address: null,
    latitude: null,
    longitude: null,
  }), true);
  assert.equal(isUnconfiguredTenantBootstrapProject({
    name: 'Obra principal',
    slug: 'obra-principal',
    status: 'ACTIVE',
    address: 'Calle 1',
    latitude: -34.6,
    longitude: -58.4,
  }), false);
});

test('archived projects cannot become an active session context', () => {
  assert.equal(isSelectableProjectStatus('ACTIVE'), true);
  assert.equal(isSelectableProjectStatus('PAUSED'), true);
  assert.equal(isSelectableProjectStatus('ARCHIVED'), false);
  assert.equal(isSelectableProjectStatus('UNKNOWN'), false);
});

test('project selection always carries the active tenant boundary', () => {
  assert.deepEqual(tenantProjectWhere('org-database-id', 'project-id'), {
    id: 'project-id',
    organizationId: 'org-database-id',
  });
  assert.throws(() => tenantProjectWhere('', 'project-id'), ProjectInputError);
});

test('portfolio counts use the canonical task projection and operational incident snapshot', () => {
  const serialized = serializeProject({
    id: 'project-a',
    name: 'Hospital Regional',
    slug: 'hospital-regional',
    status: 'ACTIVE',
    address: null,
    latitude: null,
    longitude: null,
    geofenceMeters: 100,
    startsAt: null,
    endsAt: null,
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
    updatedAt: new Date('2026-07-16T11:00:00.000Z'),
    snapshot: { updatedAt: new Date('2026-07-16T12:00:00.000Z') },
    operationalCounts: { tasks: 2, incidents: 1 },
    whatsapp: null,
    _count: { workers: 4, tasks: 0, incidents: 0 },
  });

  assert.deepEqual(serialized.counts, {
    workers: 4,
    tasks: 2,
    incidents: 1,
  });
  assert.equal(serialized.lastActivityAt, '2026-07-16T12:00:00.000Z');
  assert.equal(Object.hasOwn(serialized, 'snapshot'), false);
});

test('portfolio count projection never hydrates the complete snapshot JSON', async () => {
  const calls = [];
  const project = {
    id: 'project-a',
    name: 'Hospital Regional',
    slug: 'hospital-regional',
    status: 'ACTIVE',
    address: null,
    latitude: null,
    longitude: null,
    geofenceMeters: 100,
    startsAt: null,
    endsAt: null,
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
    updatedAt: new Date('2026-07-16T11:00:00.000Z'),
    snapshot: { updatedAt: new Date('2026-07-16T12:00:00.000Z') },
    whatsapp: null,
    _count: { workers: 4 },
  };
  const prisma = {
    project: {
      async findMany(args) {
        calls.push(['findMany', args]);
        return [project];
      },
    },
    async $queryRawUnsafe(query, organizationId, projectId) {
      calls.push(['counts', query, organizationId, projectId]);
      return [{ projectId: 'project-a', tasks: 2, incidents: 1 }];
    },
  };

  const projects = await listOrganizationProjects(prisma, 'organization-a');

  assert.equal(calls[0][1].select.snapshot.select.state, undefined);
  assert.deepEqual(calls[0][1].select.snapshot.select, { updatedAt: true });
  assert.match(calls[1][1], /FROM "Task" AS task/);
  assert.match(calls[1][1], /task\."projectId" = project\."id"/);
  assert.match(calls[1][1], /task\."metadata"->>'source' = 'project-snapshot-v1'/);
  assert.doesNotMatch(calls[1][1], /jsonb_object_keys/);
  assert.match(calls[1][1], /project\."organizationId" = \$1/);
  assert.equal(calls[1][2], 'organization-a');
  assert.equal(calls[1][3], 'project-a');
  assert.deepEqual(projects[0].counts, { workers: 4, tasks: 2, incidents: 1 });
});

test('single-project count projection stays tenant and project scoped', async () => {
  const calls = [];
  const prisma = {
    async $queryRawUnsafe(query, organizationId, projectId) {
      calls.push([query, organizationId, projectId]);
      return [{ projectId, tasks: 7, incidents: 3 }];
    },
  };
  const [project] = await attachProjectOperationalCounts(
    prisma,
    'organization-a',
    [{ id: 'project-a' }],
  );

  assert.equal(calls[0][1], 'organization-a');
  assert.equal(calls[0][2], 'project-a');
  assert.deepEqual(project.operationalCounts, { tasks: 7, incidents: 3 });
});
