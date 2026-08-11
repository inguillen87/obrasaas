import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyTaskMaterialReservation,
  createTaskMaterialReservationReadAdapter,
  createTaskMaterialReservationSqlAdapter,
  readTaskMaterialReservationSnapshot,
  TaskMaterialReservationError,
} from '../src/lib/task-material-reservations.js';

const SCOPE = Object.freeze({ organizationId: 'org-a', projectId: 'project-a' });
const TASK_ID = 'task-a';
const ACTOR_ID = 'user-a';

function reserveInput(overrides = {}) {
  return {
    kind: 'RESERVE',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: null,
    reason: 'Reserva completa para iniciar la tarea',
    allocations: [
      { requirementLineId: 'line-b', locationId: 'location-b', quantity: '2.5' },
      { requirementLineId: 'line-a', locationId: 'location-a', quantity: '1' },
      { requirementLineId: 'line-b', locationId: 'location-a', quantity: '3.250' },
    ],
    ...overrides,
  };
}

function resultRow(command, overrides = {}) {
  const reserve = command.kind === 'RESERVE';
  const lineCount = reserve
    ? new Set(command.allocations.map((allocation) => allocation.requirementLineId)).size
    : 2;
  return {
    transaction_id: 'reservation-transaction-a',
    organization_id: command.organizationId,
    project_id: command.projectId,
    task_id: command.taskId,
    requirement_revision_id: command.expectedRequirementRevisionId,
    transaction_type: command.kind,
    transaction_version: command.expectedReservationHeadId ? 2 : 1,
    predecessor_id: command.expectedReservationHeadId,
    actor_id: command.actorId,
    operation_key: command.operationKey,
    request_fingerprint: command.requestFingerprint,
    reason: command.reason,
    occurred_at: new Date('2026-08-10T12:00:00.000Z'),
    required_line_count: lineCount,
    covered_line_count: reserve ? lineCount : 0,
    allocation_count: reserve ? command.allocations.length : 3,
    readiness_state: reserve ? 'AVAILABLE' : 'DEFINED_UNRESERVED',
    available: reserve,
    replayed: false,
    ...overrides,
  };
}

function args(input, operationKey = 'reservation-operation-0001') {
  return {
    scope: SCOPE,
    taskId: TASK_ID,
    actorId: ACTOR_ID,
    operationKey,
    input,
  };
}

function readSnapshot(overrides = {}) {
  const requirementHead = {
    id: 'revision-a',
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    taskId: TASK_ID,
    taskIdentitySnapshot: true,
    taskRevisionSnapshot: 3,
    kind: 'MATERIALS_REQUIRED',
    version: 1,
    lineCount: 2,
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
    task: null,
    lines: [
      {
        id: 'line-a',
        inventoryItemId: 'item-a',
        requiredQuantity: { toString: () => '2.5' },
        itemCodeSnapshot: 'CEM',
        itemNameSnapshot: 'Cemento',
        unitSnapshot: 'bolsa',
        inventoryItem: { active: true },
      },
      {
        id: 'line-b',
        inventoryItemId: 'item-b',
        requiredQuantity: '4.000',
        itemCodeSnapshot: 'ARE',
        itemNameSnapshot: 'Arena',
        unitSnapshot: 'm3',
        inventoryItem: { active: true },
      },
    ],
  };
  const task = {
    id: TASK_ID,
    projectId: SCOPE.projectId,
    revision: 3,
    project: { organizationId: SCOPE.organizationId },
  };
  requirementHead.task = task;
  return {
    task,
    requirementHead,
    reservationHead: {
      id: 'reservation-a',
      organizationId: SCOPE.organizationId,
      projectId: SCOPE.projectId,
      taskId: TASK_ID,
      requirementRevisionId: 'revision-a',
      transactionType: 'RESERVE',
      version: 1,
      predecessorId: null,
      actorId: ACTOR_ID,
      reason: 'Reserva completa',
      occurredAt: new Date('2026-08-10T12:00:00.000Z'),
      entries: [
        {
          id: 'entry-a',
          requirementLineId: 'line-a',
          inventoryItemId: 'item-a',
          locationId: 'location-a',
          quantityDelta: '2.500',
        },
        {
          id: 'entry-b',
          requirementLineId: 'line-b',
          inventoryItemId: 'item-b',
          locationId: 'location-a',
          quantityDelta: '4.000',
        },
      ],
    },
    balances: [
      {
        organizationId: SCOPE.organizationId,
        projectId: SCOPE.projectId,
        taskId: TASK_ID,
        requirementRevisionId: 'revision-a',
        requirementLineId: 'line-a',
        inventoryItemId: 'item-a',
        requiredQuantity: '2.500',
        reservedQuantity: '2.500',
      },
      {
        organizationId: SCOPE.organizationId,
        projectId: SCOPE.projectId,
        taskId: TASK_ID,
        requirementRevisionId: 'revision-a',
        requirementLineId: 'line-b',
        inventoryItemId: 'item-b',
        requiredQuantity: '4.000',
        reservedQuantity: '4.000',
      },
    ],
    availability: [
      {
        organizationId: SCOPE.organizationId,
        projectId: SCOPE.projectId,
        inventoryItemId: 'item-a',
        locationId: 'location-a',
        onHand: '10.000',
        reserved: '2.500',
        available: '7.500',
        onHandRevision: 1,
        reservationRevision: 1,
        updatedAt: new Date('2026-08-10T12:00:00.000Z'),
        inventoryBalance: {
          organizationId: SCOPE.organizationId,
          projectId: SCOPE.projectId,
          inventoryItemId: 'item-a',
          locationId: 'location-a',
          onHand: '10.000',
          revision: 1,
          inventoryItem: {
            code: 'CEM', name: 'Cemento', baseUnit: 'bolsa',
          },
          location: { code: 'PAÑOL', name: 'Pañol central', active: true },
        },
      },
      {
        organizationId: SCOPE.organizationId,
        projectId: SCOPE.projectId,
        inventoryItemId: 'item-b',
        locationId: 'location-a',
        onHand: '6.000',
        reserved: '4.000',
        available: '2.000',
        onHandRevision: 1,
        reservationRevision: 1,
        updatedAt: new Date('2026-08-10T12:00:00.000Z'),
        inventoryBalance: {
          organizationId: SCOPE.organizationId,
          projectId: SCOPE.projectId,
          inventoryItemId: 'item-b',
          locationId: 'location-a',
          onHand: '6.000',
          revision: 1,
          inventoryItem: {
            code: 'ARE', name: 'Arena', baseUnit: 'm3',
          },
          location: { code: 'PAÑOL', name: 'Pañol central', active: true },
        },
      },
    ],
    ...overrides,
  };
}

test('normalizes exact Decimal strings, sorts allocations and accepts only full AVAILABLE coverage', async () => {
  let command;
  const result = await applyTaskMaterialReservation(null, args(reserveInput()), {
    sqlAdapter: {
      execute: async (value) => {
        command = value;
        return [resultRow(value)];
      },
    },
  });

  assert.deepEqual(command.allocations, [
    { requirementLineId: 'line-a', locationId: 'location-a', quantity: '1.000' },
    { requirementLineId: 'line-b', locationId: 'location-a', quantity: '3.250' },
    { requirementLineId: 'line-b', locationId: 'location-b', quantity: '2.500' },
  ]);
  assert.match(command.requestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.transaction.kind, 'RESERVE');
  assert.equal(result.transaction.coveredLineCount, 2);
  assert.deepEqual(result.readiness, {
    state: 'AVAILABLE',
    available: true,
    requiredLineCount: 2,
    coveredLineCount: 2,
    authoritative: true,
  });
  assert.equal(Object.hasOwn(result.transaction, 'operationKey'), false);
  assert.equal(Object.hasOwn(result.transaction, 'requestFingerprint'), false);
});

test('release is quantity-free and must mirror the exact current reservation head', async () => {
  let command;
  const input = {
    kind: 'RELEASE',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: 'reservation-transaction-a',
    reason: 'Cambio de secuencia aprobado',
  };
  const result = await applyTaskMaterialReservation(null, args(
    input,
    'reservation-operation-0002',
  ), {
    sqlAdapter: {
      execute: async (value) => {
        command = value;
        return [resultRow(value)];
      },
    },
  });

  assert.deepEqual(command.allocations, []);
  assert.equal(command.expectedReservationHeadId, 'reservation-transaction-a');
  assert.deepEqual(result.readiness, {
    state: 'DEFINED_UNRESERVED',
    available: false,
    requiredLineCount: 2,
    coveredLineCount: 0,
    authoritative: true,
  });

  await assert.rejects(
    applyTaskMaterialReservation(null, args({ ...input, expectedReservationHeadId: null }), {
      sqlAdapter: { execute: async () => assert.fail('SQL must not run') },
    }),
    (error) => error instanceof TaskMaterialReservationError
      && error.code === 'TASK_MATERIAL_RESERVATION_INVALID',
  );
});

test('rejects unknown fields, JSON numbers and duplicate line/location allocations before SQL', async () => {
  let calls = 0;
  const sqlAdapter = { execute: async () => { calls += 1; } };
  await assert.rejects(
    applyTaskMaterialReservation(null, args(reserveInput({ attackerProjectId: 'project-b' })), {
      sqlAdapter,
    }),
    (error) => error.code === 'TASK_MATERIAL_RESERVATION_FIELDS_INVALID',
  );
  await assert.rejects(
    applyTaskMaterialReservation(null, args(reserveInput({
      allocations: [{ requirementLineId: 'line-a', locationId: 'location-a', quantity: 1 }],
    })), { sqlAdapter }),
    (error) => error.code === 'TASK_MATERIAL_RESERVATION_QUANTITY_INVALID',
  );
  await assert.rejects(
    applyTaskMaterialReservation(null, args(reserveInput({
      allocations: [
        { requirementLineId: 'line-a', locationId: 'location-a', quantity: '1.000' },
        { requirementLineId: 'line-a', locationId: 'location-a', quantity: '2.000' },
      ],
    })), { sqlAdapter }),
    (error) => error.code === 'TASK_MATERIAL_RESERVATION_ALLOCATION_DUPLICATE',
  );
  await assert.rejects(
    applyTaskMaterialReservation(null, args({
      kind: 'RELEASE',
      expectedRequirementRevisionId: 'revision-a',
      expectedReservationHeadId: 'reservation-a',
      reason: 'Liberación autorizada',
      allocations: [],
    }), { sqlAdapter }),
    (error) => error.code === 'TASK_MATERIAL_RESERVATION_FIELDS_INVALID',
  );
  assert.equal(calls, 0);
});

test('fails closed when SQL crosses tenant scope or claims partial availability', async () => {
  for (const rowOverride of [
    { organization_id: 'org-attacker' },
    { covered_line_count: 1 },
    { readiness_state: 'DEFINED_UNRESERVED', available: false },
    { extra_field: 'schema-drift' },
  ]) {
    await assert.rejects(
      applyTaskMaterialReservation(null, args(reserveInput()), {
        sqlAdapter: {
          execute: async (command) => [resultRow(command, rowOverride)],
        },
      }),
      (error) => error instanceof TaskMaterialReservationError
        && error.code === 'TASK_MATERIAL_RESERVATION_CONTRACT_INVALID'
        && error.status === 503,
    );
  }
});

test('maps governed SQL markers to safe conflicts without leaking database details', async () => {
  await assert.rejects(
    applyTaskMaterialReservation(null, args(reserveInput()), {
      sqlAdapter: {
        execute: async () => {
          const error = new Error(
            'postgres secret: TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK internal-row-data',
          );
          error.code = 'P2010';
          throw error;
        },
      },
    }),
    (error) => error instanceof TaskMaterialReservationError
      && error.code === 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK'
      && error.status === 409
      && !error.message.includes('internal-row-data'),
  );
});

test('maps a completed or non-canonical task reserve guard to a safe conflict', async () => {
  await assert.rejects(
    applyTaskMaterialReservation(null, args(reserveInput()), {
      sqlAdapter: {
        execute: async () => {
          const error = new Error(
            'sensitive task row TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE internal-status',
          );
          error.code = 'P2010';
          throw error;
        },
      },
    }),
    (error) => error instanceof TaskMaterialReservationError
      && error.code === 'TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE'
      && error.status === 409
      && !error.message.includes('internal-status'),
  );
});

test('an old idempotent replay marks its revision-scoped readiness as non-authoritative', async () => {
  const result = await applyTaskMaterialReservation(null, args(reserveInput()), {
    sqlAdapter: {
      execute: async (command) => [resultRow(command, {
        covered_line_count: 0,
        readiness_state: 'DEFINED_UNRESERVED',
        available: false,
        replayed: true,
      })],
    },
  });
  assert.equal(result.replayed, true);
  assert.deepEqual(result.readiness, {
    state: 'DEFINED_UNRESERVED',
    available: false,
    requiredLineCount: 2,
    coveredLineCount: 0,
    authoritative: false,
  });
});

test('raw SQL adapter uses fixed function names and positional parameters', async () => {
  const calls = [];
  const adapter = createTaskMaterialReservationSqlAdapter({
    $queryRawUnsafe: async (...values) => {
      calls.push(values);
      return [];
    },
  });
  const reserveCommand = {
    organizationId: 'org-a',
    projectId: 'project-a',
    taskId: 'task-a',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: null,
    actorId: 'user-a',
    operationKey: 'reservation-operation-0003',
    requestFingerprint: 'a'.repeat(64),
    reason: "No interpolar ' OR TRUE --",
    kind: 'RESERVE',
    allocations: [{ requirementLineId: 'line-a', locationId: 'location-a', quantity: '1.000' }],
  };
  await adapter.execute(reserveCommand);
  await adapter.execute({
    ...reserveCommand,
    kind: 'RELEASE',
    expectedReservationHeadId: 'reservation-a',
    allocations: [],
  });

  assert.match(calls[0][0], /obrasaas_task_material_reserve/);
  assert.match(calls[1][0], /obrasaas_task_material_release/);
  assert.equal(calls[0][0].includes(reserveCommand.reason), false);
  assert.equal(calls[0][9], reserveCommand.reason);
  assert.equal(calls[0][10], JSON.stringify(reserveCommand.allocations));
  assert.equal(calls[1].length, 10);
});

test('GET snapshot exposes authoritative line/location coverage and exact availability strings', async () => {
  let command;
  const result = await readTaskMaterialReservationSnapshot(null, {
    scope: SCOPE,
    taskId: TASK_ID,
  }, {
    readAdapter: {
      read: async (value) => {
        command = value;
        return readSnapshot();
      },
    },
  });

  assert.deepEqual(command, { ...SCOPE, taskId: TASK_ID });
  assert.equal(result.requirementRevision.id, 'revision-a');
  assert.equal(result.reservationHead.id, 'reservation-a');
  assert.deepEqual(result.readiness, {
    state: 'AVAILABLE',
    available: true,
    requiredLineCount: 2,
    coveredLineCount: 2,
  });
  assert.deepEqual(result.lineBalances[0].allocations, [
    { id: 'entry-a', locationId: 'location-a', quantity: '2.500' },
  ]);
  assert.deepEqual(result.lineBalances[0].availability, [{
    inventoryItemId: 'item-a',
    itemCode: 'CEM',
    itemName: 'Cemento',
    unit: 'bolsa',
    locationId: 'location-a',
    locationCode: 'PAÑOL',
    locationName: 'Pañol central',
    locationActive: true,
    onHand: '10.000',
    reserved: '2.500',
    available: '7.500',
    onHandRevision: 1,
    reservationRevision: 1,
    updatedAt: '2026-08-10T12:00:00.000Z',
  }]);
});

test('GET snapshot never reports AVAILABLE for partial or released balances', async () => {
  const partial = readSnapshot();
  partial.balances[1].reservedQuantity = '3.000';
  const partialResult = await readTaskMaterialReservationSnapshot(null, {
    scope: SCOPE,
    taskId: TASK_ID,
  }, { readAdapter: { read: async () => partial } });
  assert.deepEqual(partialResult.readiness, {
    state: 'REVIEW_REQUIRED',
    available: false,
    requiredLineCount: 2,
    coveredLineCount: 1,
  });

  const released = readSnapshot();
  released.reservationHead = {
    ...released.reservationHead,
    id: 'release-a',
    transactionType: 'RELEASE',
    version: 2,
    predecessorId: 'reservation-a',
    entries: [{ quantityDelta: '-2.500' }],
  };
  for (const balance of released.balances) balance.reservedQuantity = '0';
  const releasedResult = await readTaskMaterialReservationSnapshot(null, {
    scope: SCOPE,
    taskId: TASK_ID,
  }, { readAdapter: { read: async () => released } });
  assert.equal(releasedResult.readiness.state, 'DEFINED_UNRESERVED');
  assert.equal(releasedResult.readiness.available, false);
  assert.deepEqual(releasedResult.lineBalances.flatMap((line) => line.allocations), []);
});

test('GET fails readiness closed for an inactive reserved location', async () => {
  const inactive = readSnapshot();
  inactive.availability[0].inventoryBalance.location.active = false;
  const result = await readTaskMaterialReservationSnapshot(null, {
    scope: SCOPE,
    taskId: TASK_ID,
  }, { readAdapter: { read: async () => inactive } });

  assert.deepEqual(result.readiness, {
    state: 'REVIEW_REQUIRED',
    available: false,
    requiredLineCount: 2,
    coveredLineCount: 2,
  });
});

test('GET rejects InventoryAvailability drift from its physical balance', async () => {
  for (const mutate of [
    (value) => { value.availability[0].inventoryBalance.onHand = '11.000'; },
    (value) => { value.availability[0].inventoryBalance.revision = 2; },
  ]) {
    const drifted = readSnapshot();
    mutate(drifted);
    await assert.rejects(
      readTaskMaterialReservationSnapshot(null, {
        scope: SCOPE,
        taskId: TASK_ID,
      }, { readAdapter: { read: async () => drifted } }),
      (error) => error.code === 'TASK_MATERIAL_RESERVATION_CONTRACT_INVALID',
    );
  }
});

test('GET exposes the global RELEASE head needed to reserve a newer BOM revision', async () => {
  const newer = readSnapshot();
  newer.requirementHead.id = 'revision-b';
  newer.requirementHead.version = 2;
  newer.requirementHead.taskRevisionSnapshot = 3;
  newer.reservationHead = {
    ...newer.reservationHead,
    id: 'release-a',
    transactionType: 'RELEASE',
    version: 2,
    predecessorId: 'reservation-a',
    requirementRevisionId: 'revision-a',
    entries: [],
  };
  for (const balance of newer.balances) {
    balance.requirementRevisionId = 'revision-b';
    balance.reservedQuantity = '0.000';
  }
  const result = await readTaskMaterialReservationSnapshot(null, {
    scope: SCOPE,
    taskId: TASK_ID,
  }, { readAdapter: { read: async () => newer } });

  assert.equal(result.requirementRevision.id, 'revision-b');
  assert.equal(result.reservationHead.id, 'release-a');
  assert.equal(result.reservationHead.requirementRevisionId, 'revision-a');
  assert.equal(result.readiness.state, 'DEFINED_UNRESERVED');
  assert.deepEqual(result.lineBalances.flatMap((line) => line.allocations), []);
});

test('GET snapshot is tenant-bound and a missing task is a safe 404', async () => {
  await assert.rejects(
    readTaskMaterialReservationSnapshot(null, { scope: SCOPE, taskId: TASK_ID }, {
      readAdapter: {
        read: async () => readSnapshot({
          task: {
            id: TASK_ID,
            projectId: SCOPE.projectId,
            revision: 3,
            project: { organizationId: 'org-attacker' },
          },
        }),
      },
    }),
    (error) => error.code === 'TASK_MATERIAL_RESERVATION_CONTRACT_INVALID'
      && error.status === 503,
  );
  await assert.rejects(
    readTaskMaterialReservationSnapshot(null, { scope: SCOPE, taskId: TASK_ID }, {
      readAdapter: {
        read: async () => ({
          task: null,
          requirementHead: null,
          reservationHead: null,
          balances: [],
          availability: [],
        }),
      },
    }),
    (error) => error.code === 'TASK_MATERIAL_RESERVATION_TASK_NOT_FOUND'
      && error.status === 404,
  );
});

test('default GET adapter uses one RepeatableRead transaction and tenant-scoped selectors', async () => {
  const calls = [];
  const transaction = {
    task: {
      findFirst: async (query) => {
        calls.push(['task', query]);
        return {
          id: TASK_ID,
          projectId: SCOPE.projectId,
          revision: 3,
          project: { organizationId: SCOPE.organizationId },
        };
      },
    },
    taskMaterialRequirementRevision: {
      findFirst: async (query) => {
        calls.push(['revision', query]);
        return null;
      },
    },
    taskMaterialReservationTransaction: {
      findFirst: async (query) => {
        calls.push(['reservation', query]);
        return null;
      },
    },
  };
  let transactionOptions;
  const adapter = createTaskMaterialReservationReadAdapter({
    $transaction: async (operation, options) => {
      transactionOptions = options;
      return operation(transaction);
    },
  });
  const snapshot = await adapter.read({ ...SCOPE, taskId: TASK_ID });

  assert.equal(snapshot.task.id, TASK_ID);
  assert.deepEqual(transactionOptions, {
    isolationLevel: 'RepeatableRead',
    maxWait: 5_000,
    timeout: 10_000,
  });
  assert.equal(calls[0][1].where.project.organizationId, SCOPE.organizationId);
  assert.equal(calls[1][1].where.organizationId, SCOPE.organizationId);
  assert.equal(calls[1][1].where.projectId, SCOPE.projectId);
  assert.equal(calls[1][1].where.taskId, TASK_ID);
  assert.equal(calls[2][1].where.organizationId, SCOPE.organizationId);
  assert.equal(calls[2][1].where.projectId, SCOPE.projectId);
  assert.equal(calls[2][1].where.taskId, TASK_ID);
  assert.equal(Object.hasOwn(calls[2][1].where, 'requirementRevisionId'), false);
});
