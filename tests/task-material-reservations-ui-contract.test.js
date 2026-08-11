import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTaskMaterialReleasePayload,
  buildTaskMaterialReservePayload,
  createTaskMaterialReservationDraft,
  TaskMaterialReservationUiError,
  validateTaskMaterialReservationMutationResult,
  validateTaskMaterialReservationSnapshot,
} from '../src/lib/task-material-reservations-ui-contract.js';

function availability(overrides = {}) {
  return {
    inventoryItemId: 'item-a',
    itemCode: 'MAT-001',
    itemName: 'Cemento',
    unit: 'bolsa',
    locationId: 'location-a',
    locationCode: 'DEP-01',
    locationName: 'Depósito principal',
    locationActive: true,
    onHand: '10.000',
    reserved: '2.000',
    available: '8.000',
    onHandRevision: 2,
    reservationRevision: 1,
    updatedAt: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  const value = {
    task: { id: 'task-a', revision: 3 },
    requirementRevision: {
      id: 'revision-a',
      kind: 'MATERIALS_REQUIRED',
      version: 2,
      lineCount: 1,
      taskRevisionSnapshot: 3,
      createdAt: '2026-08-10T11:00:00.000Z',
    },
    reservationHead: {
      id: 'release-old',
      kind: 'RELEASE',
      version: 2,
      predecessorId: 'reserve-old',
      requirementRevisionId: 'revision-old',
      reason: 'Cambio anterior',
      actorId: 'user-a',
      occurredAt: '2026-08-10T11:30:00.000Z',
    },
    readiness: {
      state: 'DEFINED_UNRESERVED',
      available: false,
      requiredLineCount: 1,
      coveredLineCount: 0,
    },
    lineBalances: [{
      requirementLineId: 'line-a',
      inventoryItemId: 'item-a',
      itemCode: 'MAT-001',
      itemName: 'Cemento',
      unit: 'bolsa',
      requiredQuantity: '5.000',
      reservedQuantity: '0.000',
      allocations: [],
      availability: [availability()],
    }],
    availability: [availability()],
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'availability')) {
    value.availability = value.lineBalances.flatMap((line) => line.availability);
  }
  return value;
}

test('validates the current BOM while preserving the global RELEASE head for CAS', () => {
  const value = validateTaskMaterialReservationSnapshot(snapshot(), 'task-a');
  assert.equal(value.readiness.state, 'DEFINED_UNRESERVED');
  assert.equal(value.reservationHead.id, 'release-old');
  const draft = createTaskMaterialReservationDraft(value);
  assert.deepEqual(draft.lines[0].allocations, [{
    locationId: 'location-a',
    quantity: '5.000',
  }]);
  const payload = buildTaskMaterialReservePayload(value, {
    ...draft,
    reason: 'Reserva para iniciar mampostería',
  });
  assert.deepEqual(payload, {
    kind: 'RESERVE',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: 'release-old',
    reason: 'Reserva para iniciar mampostería',
    allocations: [{
      requirementLineId: 'line-a',
      locationId: 'location-a',
      quantity: '5.000',
    }],
  });
});

test('builds an exact split allocation and rejects partial, duplicate or numeric quantities', () => {
  const value = validateTaskMaterialReservationSnapshot(snapshot({
    lineBalances: [{
      ...snapshot().lineBalances[0],
      availability: [
        availability({ available: '3.000', reserved: '7.000' }),
        availability({
          locationId: 'location-b',
          locationCode: 'DEP-02',
          locationName: 'Piso 1',
          onHand: '4.000',
          reserved: '0.000',
          available: '4.000',
        }),
      ],
    }],
  }), 'task-a');
  const baseDraft = {
    reason: 'Cobertura desde dos depósitos',
    lines: [{
      requirementLineId: 'line-a',
      allocations: [
        { locationId: 'location-a', quantity: '2' },
        { locationId: 'location-b', quantity: '3.000' },
      ],
    }],
  };
  assert.deepEqual(
    buildTaskMaterialReservePayload(value, baseDraft).allocations.map((row) => row.quantity),
    ['2.000', '3.000'],
  );
  assert.throws(
    () => buildTaskMaterialReservePayload(value, {
      ...baseDraft,
      lines: [{
        ...baseDraft.lines[0],
        allocations: [{ locationId: 'location-a', quantity: '2.000' }],
      }],
    }),
    (error) => error instanceof TaskMaterialReservationUiError
      && error.code === 'TASK_MATERIAL_RESERVATION_UI_BUNDLE_INCOMPLETE',
  );
  assert.throws(
    () => buildTaskMaterialReservePayload(value, {
      ...baseDraft,
      lines: [{
        ...baseDraft.lines[0],
        allocations: [
          { locationId: 'location-a', quantity: '2.000' },
          { locationId: 'location-a', quantity: '3.000' },
        ],
      }],
    }),
    /sin repetir/,
  );
  assert.throws(
    () => buildTaskMaterialReservePayload(value, {
      ...baseDraft,
      lines: [{
        ...baseDraft.lines[0],
        allocations: [{ locationId: 'location-b', quantity: 5 }],
      }],
    }),
    /Decimal\(14,3\)/,
  );
});

test('fails closed on cross-task snapshots and inconsistent AVAILABLE claims', () => {
  assert.throws(
    () => validateTaskMaterialReservationSnapshot(snapshot(), 'task-attacker'),
    /reserva incompleta/,
  );
  assert.throws(
    () => validateTaskMaterialReservationSnapshot(snapshot({
      readiness: {
        state: 'AVAILABLE',
        available: true,
        requiredLineCount: 1,
        coveredLineCount: 1,
      },
    }), 'task-a'),
    /disponibilidad no coincide/,
  );
  assert.throws(
    () => validateTaskMaterialReservationSnapshot(snapshot({
      lineBalances: [{
        ...snapshot().lineBalances[0],
        availability: [availability({ available: '9.000' })],
      }],
    }), 'task-a'),
    /proyección de stock/,
  );
});

test('builds a quantity-free RELEASE only for the active current-BOM reservation', () => {
  const current = validateTaskMaterialReservationSnapshot(snapshot({
    reservationHead: {
      id: 'reserve-current',
      kind: 'RESERVE',
      version: 3,
      predecessorId: 'release-old',
      requirementRevisionId: 'revision-a',
      reason: 'Reserva de frente',
      actorId: 'user-a',
      occurredAt: '2026-08-10T12:00:00.000Z',
    },
    readiness: {
      state: 'AVAILABLE',
      available: true,
      requiredLineCount: 1,
      coveredLineCount: 1,
    },
    lineBalances: [{
      ...snapshot().lineBalances[0],
      reservedQuantity: '5.000',
      allocations: [{ id: 'entry-a', locationId: 'location-a', quantity: '5.000' }],
      availability: [availability({ reserved: '5.000', available: '5.000' })],
    }],
  }), 'task-a');
  assert.deepEqual(buildTaskMaterialReleasePayload(current, 'Cambio de secuencia'), {
    kind: 'RELEASE',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: 'reserve-current',
    reason: 'Cambio de secuencia',
  });
  assert.throws(
    () => buildTaskMaterialReleasePayload(
      validateTaskMaterialReservationSnapshot(snapshot(), 'task-a'),
      'No corresponde',
    ),
    /No hay una reserva vigente/,
  );

  const reviewRequired = validateTaskMaterialReservationSnapshot(snapshot({
    reservationHead: {
      ...current.reservationHead,
      id: 'reserve-review-required',
    },
    readiness: {
      ...current.readiness,
      state: 'REVIEW_REQUIRED',
      available: false,
    },
    lineBalances: [{
      ...snapshot().lineBalances[0],
      reservedQuantity: '5.000',
      allocations: [{ id: 'entry-a', locationId: 'location-a', quantity: '5.000' }],
      availability: [availability({ locationActive: false, reserved: '5.000', available: '5.000' })],
    }],
    availability: [availability({ locationActive: false, reserved: '5.000', available: '5.000' })],
  }), 'task-a');
  assert.deepEqual(
    buildTaskMaterialReleasePayload(reviewRequired, 'Liberar ubicación desactivada'),
    {
      kind: 'RELEASE',
      expectedRequirementRevisionId: 'revision-a',
      expectedReservationHeadId: 'reserve-review-required',
      reason: 'Liberar ubicación desactivada',
    },
  );
});

test('validates mutation confirmation and marks old replay readiness non-authoritative', () => {
  const payload = {
    kind: 'RESERVE',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: 'release-old',
    reason: 'Reserva completa',
    allocations: [{
      requirementLineId: 'line-a',
      locationId: 'location-a',
      quantity: '5.000',
    }],
  };
  const result = {
    transaction: {
      id: 'reserve-a',
      taskId: 'task-a',
      requirementRevisionId: 'revision-a',
      kind: 'RESERVE',
      version: 3,
      predecessorId: 'release-old',
      actorId: 'user-a',
      reason: 'Reserva completa',
      occurredAt: '2026-08-10T12:00:00.000Z',
      requiredLineCount: 1,
      coveredLineCount: 0,
      allocationCount: 1,
    },
    readiness: {
      state: 'DEFINED_UNRESERVED',
      available: false,
      requiredLineCount: 1,
      coveredLineCount: 0,
      authoritative: false,
    },
    replayed: true,
  };
  assert.equal(
    validateTaskMaterialReservationMutationResult(result, 'task-a', payload),
    result,
  );
  assert.throws(
    () => validateTaskMaterialReservationMutationResult({
      ...result,
      replayed: false,
    }, 'task-a', payload),
    /confirmación de la reserva/,
  );
  assert.throws(
    () => validateTaskMaterialReservationMutationResult({
      ...result,
      transaction: { ...result.transaction, allocationCount: 2 },
    }, 'task-a', payload),
    /confirmación de la reserva/,
  );
});

test('rejects AVAILABLE without exact allocations or with contradictory stock projections', () => {
  const availableSnapshot = snapshot({
    reservationHead: {
      id: 'reserve-current',
      kind: 'RESERVE',
      version: 3,
      predecessorId: 'release-old',
      requirementRevisionId: 'revision-a',
      reason: 'Reserva de frente',
      actorId: 'user-a',
      occurredAt: '2026-08-10T12:00:00.000Z',
    },
    readiness: {
      state: 'AVAILABLE',
      available: true,
      requiredLineCount: 1,
      coveredLineCount: 1,
    },
    lineBalances: [{
      ...snapshot().lineBalances[0],
      reservedQuantity: '5.000',
      allocations: [{ id: 'entry-a', locationId: 'location-a', quantity: '5.000' }],
      availability: [availability({ reserved: '5.000', available: '5.000' })],
    }],
  });
  assert.equal(
    validateTaskMaterialReservationSnapshot(availableSnapshot, 'task-a').readiness.state,
    'AVAILABLE',
  );
  assert.throws(
    () => validateTaskMaterialReservationSnapshot({
      ...availableSnapshot,
      lineBalances: [{
        ...availableSnapshot.lineBalances[0],
        allocations: [],
      }],
    }, 'task-a'),
    /asignaciones vigentes/,
  );
  assert.throws(
    () => validateTaskMaterialReservationSnapshot({
      ...availableSnapshot,
      availability: [availability({
        reserved: '4.000',
        available: '6.000',
      })],
    }, 'task-a'),
    /proyecciones de stock/,
  );
});
