import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProjectInputError,
  activeProjectCapacity,
  isUnconfiguredTenantBootstrapProject,
  isSelectableProjectStatus,
  normalizeProjectInput,
  normalizeProjectPatchInput,
  projectConsumesActiveCapacity,
  projectSlugBase,
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
