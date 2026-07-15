import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProjectInputError,
  activeProjectCapacity,
  isSelectableProjectStatus,
  normalizeProjectInput,
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
