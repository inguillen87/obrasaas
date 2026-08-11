import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProjectLifecycleError,
  ProjectLimitError,
  updateTenantProject,
} from '../src/lib/project-lifecycle.js';

const EXPECTED_UPDATED_AT = '2026-07-16T10:30:00.000Z';

function access({
  activeProjectId = 'project-a',
  organizationId = 'organization-a',
  plan = 'PRO',
  tenantMembershipId = null,
  tenantRole = 'ADMIN',
} = {}) {
  return {
    databaseUserId: 'user-a',
    isSuperadmin: false,
    tenantMembershipId,
    tenantRole,
    organization: {
      id: organizationId,
      subscriptionPlan: plan,
    },
    project: { id: activeProjectId },
  };
}

function project(overrides = {}) {
  return {
    id: 'project-a',
    name: 'Hospital Regional',
    status: 'ACTIVE',
    address: 'Ruta 9',
    latitude: -31.4201,
    longitude: -64.1888,
    geofenceMeters: 150,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2027-03-31T00:00:00.000Z'),
    updatedAt: new Date(EXPECTED_UPDATED_AT),
    ...overrides,
  };
}

function patch(data, overrides = {}) {
  return {
    projectId: 'project-a',
    expectedUpdatedAt: EXPECTED_UPDATED_AT,
    data,
    ...overrides,
  };
}

function prismaDouble({
  currentProjects = [project()],
  fallbackProjects = [],
  counts = [1],
  updateErrors = [],
  snapshotState = { tasks: {} },
  snapshotVersion = 0,
  projectedTasks = [],
  canonicalTasks = [],
  activeMaterialReservation = null,
} = {}) {
  const calls = [];
  let currentIndex = 0;
  let fallbackIndex = 0;
  let countIndex = 0;
  let updateIndex = 0;

  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    project: {
      async findFirst(args) {
        calls.push(['findFirst', args]);
        if (args.select?.updatedAt) {
          const selected = currentProjects[currentIndex] ?? currentProjects.at(-1) ?? null;
          currentIndex += 1;
          return selected;
        }
        const selected = fallbackProjects[fallbackIndex] ?? null;
        fallbackIndex += 1;
        return selected;
      },
      async count(args) {
        calls.push(['count', args]);
        const selected = counts[countIndex] ?? counts.at(-1) ?? 0;
        countIndex += 1;
        return selected;
      },
      async update(args) {
        calls.push(['update', args]);
        const error = updateErrors[updateIndex];
        updateIndex += 1;
        if (error) throw error;
        const current = currentProjects[Math.max(0, currentIndex - 1)] || project();
        return {
          ...current,
          ...args.data,
          updatedAt: new Date('2026-07-16T11:00:00.000Z'),
        };
      },
    },
    projectSnapshot: {
      async findUnique(args) {
        calls.push(['snapshot-read', args]);
        return {
          state: structuredClone(snapshotState),
          version: snapshotVersion,
        };
      },
    },
    task: {
      async findMany(args) {
        calls.push(['task-find', args]);
        return structuredClone(
          args.where?.metadata?.equals === 'canonical-task-v1'
            ? canonicalTasks
            : projectedTasks,
        );
      },
      async upsert(args) {
        calls.push(['task-upsert', args]);
        return structuredClone(args.create);
      },
      async deleteMany(args) {
        calls.push(['task-delete', args]);
        return { count: args.where.externalId.in.length };
      },
      async updateMany(args) {
        calls.push(['task-updateMany', args]);
        return { count: 1 };
      },
    },
    projectMembership: {
      async updateMany(args) {
        calls.push(['project-access-reset', args]);
        return { count: 2 };
      },
    },
    taskMaterialActiveReservation: {
      async findFirst(args) {
        calls.push(['active-material-reservation', args]);
        return activeMaterialReservation ? structuredClone(activeMaterialReservation) : null;
      },
    },
    auditLog: {
      async create(args) {
        calls.push(['audit', args]);
        return args.data;
      },
    },
  };
  const prisma = {
    async $transaction(callback, options) {
      calls.push(['transaction', options]);
      return callback(transaction);
    },
  };
  return { calls, prisma };
}

function callsNamed(calls, name) {
  return calls.filter(([callName]) => callName === name);
}

test('lifecycle updates lock first and retain the tenant boundary on both read and write', async () => {
  const { calls, prisma } = prismaDouble();
  const result = await updateTenantProject(
    prisma,
    access(),
    patch({ name: 'Hospital Regional Norte' }),
  );

  assert.deepEqual(calls.map(([name]) => name), [
    'transaction',
    'lock',
    'findFirst',
    'update',
    'audit',
    'count',
  ]);
  assert.deepEqual(calls[0][1], { isolationLevel: 'Serializable' });
  assert.match(calls[1][1], /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.equal(calls[1][2], 'project-a');
  assert.deepEqual(calls[2][1].where, {
    id: 'project-a',
    organizationId: 'organization-a',
  });
  assert.deepEqual(calls[3][1].where, {
    id: 'project-a',
    organizationId: 'organization-a',
  });
  assert.equal(calls[4][1].data.action, 'project.updated');
  assert.equal(calls[4][1].data.actorId, 'user-a');
  assert.deepEqual(calls[4][1].data.metadata.changedFields, ['name']);
  assert.equal(result.project.name, 'Hospital Regional Norte');
});

test('restricted lifecycle reads and writes require the actor project assignment', async () => {
  const { calls, prisma } = prismaDouble();
  await updateTenantProject(
    prisma,
    access({
      tenantRole: 'SITE_MANAGER',
      tenantMembershipId: 'membership-a',
    }),
    patch({ name: 'Hospital Regional Norte' }),
  );

  const expectedScope = {
    id: 'project-a',
    organizationId: 'organization-a',
    projectMemberships: {
      some: {
        tenantMembershipId: 'membership-a',
        status: 'ACTIVE',
        tenantMembership: {
          organizationId: 'organization-a',
          status: 'ACTIVE',
        },
      },
    },
  };
  assert.deepEqual(callsNamed(calls, 'findFirst')[0][1].where, expectedScope);
  assert.deepEqual(callsNamed(calls, 'update')[0][1].where, expectedScope);
});

test('changing the project start date reprojects legacy snapshot task dates inside the lifecycle transaction', async () => {
  const { calls, prisma } = prismaDouble({
    snapshotState: {
      tasks: {
        'task-a': {
          name: 'Estructura principal',
          assignee: 'Cuadrilla A',
          progress: 40,
          duration: 3,
          startDay: 2,
        },
      },
    },
    snapshotVersion: 7,
  });

  await updateTenantProject(
    prisma,
    access(),
    patch({ startsAt: new Date('2026-08-05T00:00:00.000Z') }),
  );

  assert.deepEqual(calls.map(([name]) => name), [
    'transaction',
    'lock',
    'findFirst',
    'update',
    'snapshot-read',
    'task-find',
    'task-upsert',
    'task-find',
    'audit',
    'count',
  ]);
  assert.deepEqual(callsNamed(calls, 'snapshot-read')[0][1], {
    where: { projectId: 'project-a' },
    select: { state: true, version: true },
  });
  const projectionRead = callsNamed(calls, 'task-find')[0][1];
  assert.deepEqual(projectionRead.where, {
    projectId: 'project-a',
    metadata: { path: ['source'], equals: 'project-snapshot-v1' },
  });
  const projectionWrite = callsNamed(calls, 'task-upsert')[0][1];
  assert.deepEqual(projectionWrite.where.projectId_externalId, {
    projectId: 'project-a',
    externalId: 'snapshot:task-a',
  });
  assert.equal(projectionWrite.create.metadata.projectStateVersion, 7);
  assert.equal(projectionWrite.create.startsAt.toISOString(), '2026-08-06T00:00:00.000Z');
  assert.equal(projectionWrite.create.endsAt.toISOString(), '2026-08-08T00:00:00.000Z');
});

test('changing the project start date rehydrates anchored canonical task dates atomically', async () => {
  const { calls, prisma } = prismaDouble({
    canonicalTasks: [{
      id: 'canonical-a',
      revision: 4,
      startsAt: null,
      endsAt: null,
      metadata: {
        schemaVersion: 1,
        source: 'canonical-task-v1',
        schedule: {
          schemaVersion: 1,
          anchor: 'PROJECT_START',
          startDay: 2,
          durationDays: 3,
        },
      },
    }],
  });

  await updateTenantProject(
    prisma,
    access(),
    patch({ startsAt: new Date('2026-08-05T00:00:00.000Z') }),
  );

  const canonicalWrite = callsNamed(calls, 'task-updateMany')[0][1];
  assert.deepEqual(canonicalWrite.where, {
    id: 'canonical-a',
    projectId: 'project-a',
    revision: 4,
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  });
  assert.equal(canonicalWrite.data.startsAt.toISOString(), '2026-08-06T00:00:00.000Z');
  assert.equal(canonicalWrite.data.endsAt.toISOString(), '2026-08-08T00:00:00.000Z');
  assert.deepEqual(canonicalWrite.data.revision, { increment: 1 });
  assert.equal(callsNamed(calls, 'audit')[0][1].data.metadata.canonicalScheduleReprojectedCount, 1);
});

test('a stale lifecycle version conflicts after the locked tenant read and before writes', async () => {
  const { calls, prisma } = prismaDouble({
    currentProjects: [project({
      updatedAt: new Date('2026-07-16T10:31:00.000Z'),
    })],
  });

  await assert.rejects(
    updateTenantProject(prisma, access(), patch({ status: 'PAUSED' })),
    (error) => (
      error instanceof ProjectLifecycleError
      && error.code === 'PROJECT_VERSION_CONFLICT'
      && error.status === 409
    ),
  );

  assert.deepEqual(calls.map(([name]) => name), ['transaction', 'lock', 'findFirst']);
  assert.equal(callsNamed(calls, 'update').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('a project outside the authenticated tenant is indistinguishable from a missing project', async () => {
  const { calls, prisma } = prismaDouble({ currentProjects: [null] });

  await assert.rejects(
    updateTenantProject(
      prisma,
      access({ organizationId: 'organization-authenticated' }),
      patch({ name: 'Intento fuera del tenant' }),
    ),
    (error) => (
      error instanceof ProjectLifecycleError
      && error.code === 'PROJECT_NOT_FOUND'
      && error.status === 404
    ),
  );

  assert.deepEqual(callsNamed(calls, 'findFirst')[0][1].where, {
    id: 'project-a',
    organizationId: 'organization-authenticated',
  });
  assert.equal(callsNamed(calls, 'update').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('a serializable retry locks and re-reads the version instead of replaying a stale write', async () => {
  const retryable = Object.assign(new Error('serialization conflict'), { code: 'P2034' });
  const { calls, prisma } = prismaDouble({
    currentProjects: [
      project(),
      project({ updatedAt: new Date('2026-07-16T10:31:00.000Z') }),
    ],
    updateErrors: [retryable],
  });

  await assert.rejects(
    updateTenantProject(
      prisma,
      access(),
      patch({ name: 'Hospital Regional Norte' }),
    ),
    (error) => error.code === 'PROJECT_VERSION_CONFLICT',
  );

  assert.equal(callsNamed(calls, 'transaction').length, 2);
  assert.equal(callsNamed(calls, 'lock').length, 2);
  assert.equal(callsNamed(calls, 'findFirst').length, 2);
  assert.equal(callsNamed(calls, 'update').length, 1);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('archiving the selected project prefers the latest active tenant fallback', async () => {
  const { calls, prisma } = prismaDouble({
    fallbackProjects: [{ id: 'project-active-fallback' }],
    counts: [0],
  });

  const result = await updateTenantProject(
    prisma,
    access(),
    patch({ status: 'ARCHIVED' }),
  );

  assert.equal(result.activeProjectId, 'project-active-fallback');
  const reads = callsNamed(calls, 'findFirst');
  assert.equal(reads.length, 2);
  assert.deepEqual(reads[1][1], {
    where: {
      organizationId: 'organization-a',
      id: { not: 'project-a' },
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  assert.equal(callsNamed(calls, 'audit')[0][1].data.action, 'project.archived');
  assert.deepEqual(callsNamed(calls, 'project-access-reset')[0][1], {
    where: { projectId: 'project-a', status: 'ACTIVE' },
    data: { status: 'DISABLED' },
  });
  assert.equal(
    callsNamed(calls, 'audit')[0][1].data.metadata.resetProjectAccessCount,
    2,
  );
});

test('finalizing or archiving is refused while any task has an active material reservation', async () => {
  for (const status of ['COMPLETED', 'ARCHIVED']) {
    const { calls, prisma } = prismaDouble({
      activeMaterialReservation: { taskId: 'task-with-reservation' },
    });
    await assert.rejects(
      updateTenantProject(prisma, access(), patch({ status })),
      (error) => (
        error instanceof ProjectLifecycleError
        && error.code === 'PROJECT_ACTIVE_MATERIAL_RESERVATIONS'
        && error.status === 409
      ),
    );
    assert.deepEqual(callsNamed(calls, 'active-material-reservation')[0][1], {
      where: {
        organizationId: 'organization-a',
        projectId: 'project-a',
      },
      select: { taskId: true },
    });
    assert.equal(callsNamed(calls, 'update').length, 0);
    assert.equal(callsNamed(calls, 'audit').length, 0);
  }
});

test('the structural project-close guard is surfaced as a safe 409 conflict', async () => {
  const databaseError = Object.assign(new Error('constraint failed'), {
    code: 'P2004',
    meta: {
      database_error: 'TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY active reservation exists',
    },
  });
  const { calls, prisma } = prismaDouble({
    fallbackProjects: [{ id: 'project-active-fallback' }],
    updateErrors: [databaseError],
  });

  await assert.rejects(
    updateTenantProject(prisma, access(), patch({ status: 'ARCHIVED' })),
    (error) => (
      error instanceof ProjectLifecycleError
      && error.code === 'PROJECT_ACTIVE_MATERIAL_RESERVATIONS'
      && error.status === 409
      && !error.message.includes('active reservation exists')
    ),
  );
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('archive fallback uses the latest non-archived tenant context when none is active', async () => {
  const { calls, prisma } = prismaDouble({
    fallbackProjects: [null, { id: 'project-completed-fallback' }],
    counts: [0],
  });

  const result = await updateTenantProject(
    prisma,
    access(),
    patch({ status: 'ARCHIVED' }),
  );

  assert.equal(result.activeProjectId, 'project-completed-fallback');
  const reads = callsNamed(calls, 'findFirst');
  assert.equal(reads.length, 3);
  assert.deepEqual(reads[2][1], {
    where: {
      organizationId: 'organization-a',
      id: { not: 'project-a' },
      status: { not: 'ARCHIVED' },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
});

test('archiving the last tenant context is refused without project or audit writes', async () => {
  const { calls, prisma } = prismaDouble({
    fallbackProjects: [null, null],
  });

  await assert.rejects(
    updateTenantProject(prisma, access(), patch({ status: 'ARCHIVED' })),
    (error) => (
      error instanceof ProjectLifecycleError
      && error.code === 'PROJECT_LAST_CONTEXT'
    ),
  );

  assert.equal(callsNamed(calls, 'update').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
  assert.equal(callsNamed(calls, 'count').length, 0);
});

test('restoring an archived project into an operational status enforces plan capacity', async () => {
  const { calls, prisma } = prismaDouble({
    currentProjects: [project({ status: 'ARCHIVED' })],
    counts: [1],
  });

  await assert.rejects(
    updateTenantProject(
      prisma,
      access({ activeProjectId: 'project-other', plan: 'TRIAL' }),
      patch({ status: 'ACTIVE' }),
    ),
    (error) => (
      error instanceof ProjectLimitError
      && error.code === 'PROJECT_LIMIT_REACHED'
      && error.capacity.used === 1
      && error.capacity.limit === 1
    ),
  );

  assert.deepEqual(callsNamed(calls, 'count')[0][1].where, {
    organizationId: 'organization-a',
    status: { in: ['PLANNING', 'ACTIVE', 'PAUSED'] },
    id: { not: 'project-a' },
  });
  assert.equal(callsNamed(calls, 'update').length, 0);
  assert.equal(callsNamed(calls, 'audit').length, 0);
});

test('audit actions describe only real archive and restore transitions', async () => {
  const archivedEdit = prismaDouble({
    currentProjects: [project({ status: 'ARCHIVED' })],
    counts: [0],
  });
  await updateTenantProject(
    archivedEdit.prisma,
    access({ activeProjectId: 'project-other' }),
    patch({ name: 'Hospital Regional Histórico' }),
  );
  assert.equal(
    callsNamed(archivedEdit.calls, 'audit')[0][1].data.action,
    'project.updated',
  );

  const restore = prismaDouble({
    currentProjects: [project({ status: 'ARCHIVED' })],
    counts: [0],
  });
  await updateTenantProject(
    restore.prisma,
    access({ activeProjectId: 'project-other' }),
    patch({ status: 'COMPLETED' }),
  );
  assert.equal(
    callsNamed(restore.calls, 'audit')[0][1].data.action,
    'project.restored',
  );
});
