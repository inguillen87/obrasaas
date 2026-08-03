import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listTaskMaterialRequirements,
  parseTaskMaterialRequirementQuery,
  publishTaskMaterialRequirement,
  TaskMaterialRequirementError,
} from '../src/lib/task-material-requirements.js';

const SCOPE = Object.freeze({ organizationId: 'org-a', projectId: 'project-a' });
const TASK_ID = 'task-a';
const ACTOR_ID = 'user-a';

function task(overrides = {}) {
  return {
    id: TASK_ID,
    projectId: SCOPE.projectId,
    code: 'T-010',
    title: 'Levantar pared',
    type: 'TASK',
    status: 'READY',
    revision: 3,
    startsAt: new Date('2026-08-16T00:00:00.000Z'),
    endsAt: new Date('2026-08-20T00:00:00.000Z'),
    metadata: { source: 'canonical-task-v1' },
    ...overrides,
  };
}

function item(id, overrides = {}) {
  return {
    id,
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    code: id.toUpperCase(),
    name: `Material ${id}`,
    baseUnit: 'unidad',
    active: true,
    ...overrides,
  };
}

function fakePrisma({
  tasks = [task()],
  items = [item('item-a'), item('item-b')],
  createRevisionError = null,
} = {}) {
  const state = {
    tasks: [...tasks],
    items: [...items],
    revisions: [],
    lines: [],
    audits: [],
  };
  let revisionSequence = 0;
  let lineSequence = 0;

  function withRelations(revision) {
    if (!revision) return null;
    return {
      ...revision,
      lines: state.lines
        .filter((line) => line.revisionId === revision.id)
        .sort((left, right) => left.itemCodeSnapshot.localeCompare(right.itemCodeSnapshot))
        .map((line) => ({
          ...line,
          inventoryItem: state.items.find((entry) => entry.id === line.inventoryItemId) || null,
        })),
      authoredBy: { id: revision.authoredById, fullName: 'Jefa de obra' },
    };
  }

  function revisionMatches(revision, where = {}) {
    if (where.id && revision.id !== where.id) return false;
    if (where.organizationId && revision.organizationId !== where.organizationId) return false;
    if (where.projectId && revision.projectId !== where.projectId) return false;
    if (where.taskId && revision.taskId !== where.taskId) return false;
    if (where.operationKey && revision.operationKey !== where.operationKey) return false;
    if (where.version?.lt && !(revision.version < where.version.lt)) return false;
    return true;
  }

  const transaction = {
    $executeRawUnsafe: async () => 1,
    project: {
      findFirst: async ({ where }) => (
        where.id === SCOPE.projectId && where.organizationId === SCOPE.organizationId
          ? { id: SCOPE.projectId, organizationId: SCOPE.organizationId, status: 'ACTIVE' }
          : null
      ),
    },
    task: {
      findFirst: async ({ where }) => state.tasks.find((entry) => (
        entry.id === where.id
        && entry.projectId === where.projectId
        && where.project?.organizationId === SCOPE.organizationId
        && entry.metadata?.source === 'canonical-task-v1'
      )) || null,
    },
    inventoryItem: {
      findMany: async ({ where }) => state.items.filter((entry) => (
        entry.organizationId === where.organizationId
        && entry.projectId === where.projectId
        && where.id.in.includes(entry.id)
        && (!Object.hasOwn(where, 'active') || entry.active === where.active)
      )),
    },
    taskMaterialRequirementRevision: {
      findFirst: async ({ where, orderBy }) => {
        const rows = state.revisions.filter((revision) => revisionMatches(revision, where));
        if (orderBy?.version === 'desc') rows.sort((left, right) => right.version - left.version);
        return withRelations(rows[0] || null);
      },
      findMany: async ({ where, orderBy, take }) => {
        const rows = state.revisions.filter((revision) => revisionMatches(revision, where));
        if (orderBy?.version === 'desc') rows.sort((left, right) => right.version - left.version);
        return rows.slice(0, take).map(withRelations);
      },
      create: async ({ data }) => {
        if (createRevisionError) throw createRevisionError;
        revisionSequence += 1;
        const created = {
          id: `revision-${revisionSequence}`,
          ...data,
          createdAt: new Date(`2026-08-02T12:0${revisionSequence}:00.000Z`),
        };
        state.revisions.push(created);
        return created;
      },
      count: async ({ where }) => state.revisions.filter((revision) => (
        revision.organizationId === where.organizationId
        && revision.projectId === where.projectId
        && revision.taskId === where.taskId
      )).length,
    },
    taskMaterialRequirementLine: {
      createMany: async ({ data }) => {
        for (const input of data) {
          lineSequence += 1;
          state.lines.push({
            id: `line-${lineSequence}`,
            ...input,
            createdAt: new Date(`2026-08-02T12:1${lineSequence}:00.000Z`),
          });
        }
        return { count: data.length };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.audits.push(data);
        return data;
      },
    },
  };
  return {
    state,
    prisma: {
      ...transaction,
      $transaction: async (operation) => operation(transaction),
    },
  };
}

function publishInput(overrides = {}) {
  return {
    expectedActiveRevisionId: null,
    kind: 'MATERIALS_REQUIRED',
    reason: 'Plan inicial de materiales',
    lines: [
      { inventoryItemId: 'item-b', quantity: '2.5', notes: 'Cara exterior' },
      { inventoryItemId: 'item-a', quantity: '10.000' },
    ],
    ...overrides,
  };
}

test('publishes an exact immutable snapshot, sorts lines and never claims AVAILABLE', async () => {
  const store = fakePrisma();
  const result = await publishTaskMaterialRequirement(store.prisma, {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey: 'bom-operation-0001',
    input: publishInput(),
  });

  assert.equal(result.replayed, false);
  assert.equal(result.revision.version, 1);
  assert.equal(store.state.revisions[0].taskIdentitySnapshot, true);
  assert.equal(result.revision.taskSnapshot.revision, 3);
  assert.deepEqual(
    result.revision.lines.map((line) => [line.inventoryItemId, line.requiredQuantity]),
    [['item-a', '10.000'], ['item-b', '2.500']],
  );
  assert.deepEqual(result.readiness, {
    state: 'DEFINED_UNRESERVED',
    label: 'BOM v1 sin reserva',
    available: false,
  });
  assert.equal(store.state.audits[0].action, 'task_material_requirement.published');
  assert.equal(store.state.audits[0].metadata.lineCount, 2);

  store.state.lines[0].requiredQuantity = { toString: () => '10' };
  const refreshed = await listTaskMaterialRequirements(store.prisma, {
    scope: SCOPE,
    taskId: TASK_ID,
  });
  assert.equal(refreshed.head.lines[0].requiredQuantity, '10.000');
});

test('replays the same operation before CAS and rejects a mutated replay', async () => {
  const store = fakePrisma();
  const args = {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey: 'bom-operation-0002',
    input: publishInput(),
  };
  const first = await publishTaskMaterialRequirement(store.prisma, args);
  const replay = await publishTaskMaterialRequirement(store.prisma, args);
  assert.equal(replay.replayed, true);
  assert.equal(replay.revision.id, first.revision.id);
  assert.equal(store.state.revisions.length, 1);

  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      ...args,
      input: publishInput({ reason: 'Otro contenido' }),
    }),
    (error) => error instanceof TaskMaterialRequirementError
      && error.code === 'IDEMPOTENCY_REPLAY_MUTATED'
      && error.status === 409,
  );
});

test('requires the exact current head and supports explicit no-material revisions', async () => {
  const store = fakePrisma();
  const first = await publishTaskMaterialRequirement(store.prisma, {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey: 'bom-operation-0003',
    input: publishInput(),
  });
  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      scope: SCOPE,
      taskId: TASK_ID,
      actorId: ACTOR_ID,
      operationKey: 'bom-operation-0004',
      input: publishInput({ expectedActiveRevisionId: null }),
    }),
    (error) => error.code === 'TASK_MATERIAL_REQUIREMENT_HEAD_STALE',
  );
  const cleared = await publishTaskMaterialRequirement(store.prisma, {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey: 'bom-operation-0005',
    input: {
      expectedActiveRevisionId: first.revision.id,
      kind: 'NO_MATERIALS_REQUIRED',
      reason: 'Cambio de alcance aprobado',
      lines: [],
    },
  });
  assert.equal(cleared.revision.version, 2);
  assert.equal(cleared.revision.predecessorId, first.revision.id);
  assert.equal(cleared.readiness.state, 'NOT_REQUIRED');
  assert.equal(cleared.readiness.available, false);
});

test('rejects JSON numbers, duplicate items, empty implicit BOMs and inactive scope', async () => {
  const store = fakePrisma({ items: [item('item-a', { active: false })] });
  const base = {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
  };
  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      ...base,
      operationKey: 'bom-operation-0006',
      input: publishInput({ lines: [{ inventoryItemId: 'item-a', quantity: 1 }] }),
    }),
    (error) => error.code === 'TASK_MATERIAL_REQUIREMENT_QUANTITY_INVALID',
  );
  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      ...base,
      operationKey: 'bom-operation-0007',
      input: publishInput({
        lines: [
          { inventoryItemId: 'item-a', quantity: '1.000' },
          { inventoryItemId: 'item-a', quantity: '2.000' },
        ],
      }),
    }),
    (error) => error.code === 'TASK_MATERIAL_REQUIREMENT_ITEM_DUPLICATE',
  );
  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      ...base,
      operationKey: 'bom-operation-0008',
      input: publishInput({ lines: [] }),
    }),
    (error) => error.code === 'TASK_MATERIAL_REQUIREMENT_MODE_SHAPE_INVALID',
  );
  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      ...base,
      operationKey: 'bom-operation-0009',
      input: publishInput({ lines: [{ inventoryItemId: 'item-a', quantity: '1.000' }] }),
    }),
    (error) => error.code === 'TASK_MATERIAL_REQUIREMENT_ITEM_SCOPE_INVALID',
  );
});

test('history uses a scope-bound keyset cursor while head remains authoritative', async () => {
  const store = fakePrisma();
  const first = await publishTaskMaterialRequirement(store.prisma, {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey: 'bom-operation-0010',
    input: publishInput(),
  });
  await publishTaskMaterialRequirement(store.prisma, {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey: 'bom-operation-0011',
    input: {
      expectedActiveRevisionId: first.revision.id,
      kind: 'NO_MATERIALS_REQUIRED',
      reason: 'Revisión dos',
      lines: [],
    },
  });

  const firstQuery = parseTaskMaterialRequirementQuery(
    `https://obrasaas.test/api/tasks/${TASK_ID}/material-requirements?limit=1`,
    SCOPE,
    TASK_ID,
  );
  const pageOne = await listTaskMaterialRequirements(store.prisma, firstQuery);
  assert.equal(pageOne.head.version, 2);
  assert.equal(pageOne.history[0].version, 2);
  assert.equal(pageOne.hasMore, true);
  assert.ok(pageOne.nextCursor);

  const secondQuery = parseTaskMaterialRequirementQuery(
    `https://obrasaas.test/api/tasks/${TASK_ID}/material-requirements?limit=1&cursor=${pageOne.nextCursor}`,
    SCOPE,
    TASK_ID,
  );
  const pageTwo = await listTaskMaterialRequirements(store.prisma, secondQuery);
  assert.equal(pageTwo.head.version, 2);
  assert.equal(pageTwo.history[0].version, 1);
  assert.equal(pageTwo.hasMore, false);

  assert.throws(
    () => parseTaskMaterialRequirementQuery(
      `https://obrasaas.test/api/tasks/${TASK_ID}/material-requirements?cursor=${pageOne.nextCursor}`,
      { ...SCOPE, projectId: 'project-b' },
      TASK_ID,
    ),
    (error) => error.code === 'TASK_MATERIAL_REQUIREMENT_CURSOR_INVALID',
  );
});

test('read path binds the canonical task to the trusted organization and project', async () => {
  const store = fakePrisma();
  await assert.rejects(
    listTaskMaterialRequirements(store.prisma, {
      scope: { organizationId: 'org-b', projectId: SCOPE.projectId },
      taskId: TASK_ID,
    }),
    (error) => error instanceof TaskMaterialRequirementError
      && error.code === 'TASK_MATERIAL_REQUIREMENT_TASK_NOT_FOUND'
      && error.status === 404,
  );
});

test('Prisma-wrapped database guards become a safe conflict instead of a 500', async () => {
  const databaseError = Object.assign(new Error('trigger rejected the insert'), { code: 'P2004' });
  const store = fakePrisma({ createRevisionError: databaseError });
  await assert.rejects(
    publishTaskMaterialRequirement(store.prisma, {
      scope: SCOPE,
      taskId: TASK_ID,
      actorId: ACTOR_ID,
      operationKey: 'bom-operation-0012',
      input: publishInput(),
    }),
    (error) => error instanceof TaskMaterialRequirementError
      && error.code === 'TASK_MATERIAL_REQUIREMENT_WRITE_CONFLICT'
      && error.status === 409,
  );
});
