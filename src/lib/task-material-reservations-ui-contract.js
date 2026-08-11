import {
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  sumProcurementQuantities,
} from './procurement-quantity.js';

const READINESS_STATES = new Set([
  'NOT_DEFINED',
  'NOT_REQUIRED',
  'DEFINED_UNRESERVED',
  'AVAILABLE',
  'REVIEW_REQUIRED',
]);

export class TaskMaterialReservationUiError extends Error {
  constructor(message, code = 'TASK_MATERIAL_RESERVATION_UI_INVALID') {
    super(message);
    this.name = 'TaskMaterialReservationUiError';
    this.code = code;
  }
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function exactQuantity(value, { allowZero = false } = {}) {
  try {
    return formatProcurementQuantity(parseProcurementQuantity(value, { allowZero }));
  } catch {
    throw new TaskMaterialReservationUiError(
      'Una cantidad no respeta Decimal(14,3).',
      'TASK_MATERIAL_RESERVATION_UI_QUANTITY_INVALID',
    );
  }
}

function validateAvailability(value, inventoryItemId) {
  const row = record(value);
  if (
    !row
    || !nonEmptyString(row.inventoryItemId)
    || row.inventoryItemId !== inventoryItemId
    || !nonEmptyString(row.itemCode)
    || !nonEmptyString(row.itemName)
    || !nonEmptyString(row.unit)
    || !nonEmptyString(row.locationId)
    || !nonEmptyString(row.locationCode)
    || !nonEmptyString(row.locationName)
    || typeof row.locationActive !== 'boolean'
    || !Number.isSafeInteger(row.onHandRevision)
    || row.onHandRevision < 0
    || !Number.isSafeInteger(row.reservationRevision)
    || row.reservationRevision < 0
    || !nonEmptyString(row.updatedAt)
  ) {
    throw new TaskMaterialReservationUiError(
      'La disponibilidad por ubicación está incompleta.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  const onHand = exactQuantity(row.onHand, { allowZero: true });
  const reserved = exactQuantity(row.reserved, { allowZero: true });
  const available = exactQuantity(row.available, { allowZero: true });
  if (
    parseProcurementQuantity(onHand, { allowZero: true })
      - parseProcurementQuantity(reserved, { allowZero: true })
      !== parseProcurementQuantity(available, { allowZero: true })
  ) {
    throw new TaskMaterialReservationUiError(
      'La proyección de stock disponible no cierra.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  return { ...row, onHand, reserved, available };
}

function availabilityKey(row) {
  return `${row.inventoryItemId}\u0000${row.locationId}`;
}

function availabilityFingerprint(row) {
  return JSON.stringify([
    row.inventoryItemId,
    row.itemCode,
    row.itemName,
    row.unit,
    row.locationId,
    row.locationCode,
    row.locationName,
    row.locationActive,
    row.onHand,
    row.reserved,
    row.available,
    row.onHandRevision,
    row.reservationRevision,
    row.updatedAt,
  ]);
}

function validateLine(value) {
  const line = record(value);
  if (
    !line
    || !nonEmptyString(line.requirementLineId)
    || !nonEmptyString(line.inventoryItemId)
    || !nonEmptyString(line.itemCode)
    || !nonEmptyString(line.itemName)
    || !nonEmptyString(line.unit)
    || !Array.isArray(line.allocations)
    || !Array.isArray(line.availability)
  ) {
    throw new TaskMaterialReservationUiError(
      'Una línea de la reserva está incompleta.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  const requiredQuantity = exactQuantity(line.requiredQuantity);
  const reservedQuantity = exactQuantity(line.reservedQuantity, { allowZero: true });
  const locations = new Set();
  const availability = line.availability.map((row) => {
    const normalized = validateAvailability(row, line.inventoryItemId);
    if (locations.has(normalized.locationId)) {
      throw new TaskMaterialReservationUiError(
        'La disponibilidad repite una ubicación.',
        'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
      );
    }
    locations.add(normalized.locationId);
    return normalized;
  });
  const allocationLocations = new Set();
  const allocationIds = new Set();
  const availabilityByLocation = new Map(
    availability.map((row) => [row.locationId, row]),
  );
  const allocations = line.allocations.map((value) => {
    const allocation = record(value);
    if (
      !allocation
      || !nonEmptyString(allocation.id)
      || !nonEmptyString(allocation.locationId)
      || allocationIds.has(allocation.id)
      || allocationLocations.has(allocation.locationId)
      || !availabilityByLocation.has(allocation.locationId)
    ) {
      throw new TaskMaterialReservationUiError(
        'Una asignación vigente está incompleta.',
        'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
      );
    }
    allocationIds.add(allocation.id);
    allocationLocations.add(allocation.locationId);
    return { ...allocation, quantity: exactQuantity(allocation.quantity) };
  });
  const allocatedQuantity = formatProcurementQuantity(sumProcurementQuantities(
    allocations.map((allocation) => parseProcurementQuantity(allocation.quantity)),
  ));
  if (allocatedQuantity !== reservedQuantity) {
    throw new TaskMaterialReservationUiError(
      'Las asignaciones vigentes no coinciden con el saldo reservado.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  return {
    ...line,
    requiredQuantity,
    reservedQuantity,
    allocations,
    availability,
  };
}

function validateHead(value) {
  if (value === null) return null;
  const head = record(value);
  if (
    !head
    || !nonEmptyString(head.id)
    || !['RESERVE', 'RELEASE'].includes(head.kind)
    || !Number.isSafeInteger(head.version)
    || head.version < 1
    || (head.predecessorId !== null && !nonEmptyString(head.predecessorId))
    || !nonEmptyString(head.requirementRevisionId)
    || !nonEmptyString(head.reason)
    || !nonEmptyString(head.occurredAt)
  ) {
    throw new TaskMaterialReservationUiError(
      'El head de reservas está incompleto.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  return head;
}

export function validateTaskMaterialReservationSnapshot(value, taskId) {
  const snapshot = record(value);
  const task = record(snapshot?.task);
  const requirementRevision = snapshot?.requirementRevision === null
    ? null
    : record(snapshot?.requirementRevision);
  const readiness = record(snapshot?.readiness);
  if (
    !snapshot
    || !task
    || task.id !== taskId
    || !Number.isSafeInteger(task.revision)
    || task.revision < 0
    || !readiness
    || !READINESS_STATES.has(readiness.state)
    || typeof readiness.available !== 'boolean'
    || !Number.isSafeInteger(readiness.requiredLineCount)
    || readiness.requiredLineCount < 0
    || !Number.isSafeInteger(readiness.coveredLineCount)
    || readiness.coveredLineCount < 0
    || readiness.coveredLineCount > readiness.requiredLineCount
    || !Array.isArray(snapshot.lineBalances)
    || !Array.isArray(snapshot.availability)
  ) {
    throw new TaskMaterialReservationUiError(
      'El servidor devolvió una reserva incompleta.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }

  const reservationHead = validateHead(snapshot.reservationHead);
  const lineBalances = snapshot.lineBalances.map(validateLine);
  const availability = snapshot.availability.map((value) => {
    const row = record(value);
    return validateAvailability(row, row?.inventoryItemId);
  });
  const lineIds = new Set(lineBalances.map((line) => line.requirementLineId));
  const itemIds = new Set(lineBalances.map((line) => line.inventoryItemId));
  if (lineIds.size !== lineBalances.length || itemIds.size !== lineBalances.length) {
    throw new TaskMaterialReservationUiError(
      'La BOM repite líneas o materiales.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  const allocationIds = new Set();
  for (const line of lineBalances) {
    for (const allocation of line.allocations) {
      if (allocationIds.has(allocation.id)) {
        throw new TaskMaterialReservationUiError(
          'La reserva repite una asignación vigente.',
          'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
        );
      }
      allocationIds.add(allocation.id);
    }
  }
  const topLevelAvailability = new Map();
  for (const row of availability) {
    const key = availabilityKey(row);
    if (topLevelAvailability.has(key)) {
      throw new TaskMaterialReservationUiError(
        'La disponibilidad global repite una ubicación.',
        'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
      );
    }
    topLevelAvailability.set(key, availabilityFingerprint(row));
  }
  const lineAvailability = new Map();
  for (const line of lineBalances) {
    for (const row of line.availability) {
      const key = availabilityKey(row);
      if (lineAvailability.has(key)) {
        throw new TaskMaterialReservationUiError(
          'La cobertura repite una proyección de stock.',
          'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
        );
      }
      lineAvailability.set(key, availabilityFingerprint(row));
    }
  }
  if (
    topLevelAvailability.size !== lineAvailability.size
    || [...lineAvailability].some(([key, fingerprint]) => (
      topLevelAvailability.get(key) !== fingerprint
    ))
  ) {
    throw new TaskMaterialReservationUiError(
      'Las proyecciones de stock del servidor se contradicen.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }
  const availabilityRowsByKey = new Map(
    availability.map((row) => [availabilityKey(row), row]),
  );
  const allocatedByAvailabilityKey = new Map();
  for (const line of lineBalances) {
    for (const allocation of line.allocations) {
      const key = `${line.inventoryItemId}\u0000${allocation.locationId}`;
      const quantities = allocatedByAvailabilityKey.get(key) || [];
      quantities.push(parseProcurementQuantity(allocation.quantity));
      allocatedByAvailabilityKey.set(key, quantities);
    }
  }
  for (const [key, quantities] of allocatedByAvailabilityKey) {
    const row = availabilityRowsByKey.get(key);
    if (
      !row
      || compareProcurementQuantities(
        sumProcurementQuantities(quantities),
        parseProcurementQuantity(row.reserved, { allowZero: true }),
      ) > 0
    ) {
      throw new TaskMaterialReservationUiError(
        'Una asignación vigente supera el saldo reservado de su ubicación.',
        'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
      );
    }
  }
  if (requirementRevision) {
    if (
      !nonEmptyString(requirementRevision.id)
      || !['MATERIALS_REQUIRED', 'NO_MATERIALS_REQUIRED'].includes(requirementRevision.kind)
      || !Number.isSafeInteger(requirementRevision.version)
      || requirementRevision.version < 1
      || !Number.isSafeInteger(requirementRevision.lineCount)
      || requirementRevision.lineCount < 0
      || requirementRevision.lineCount !== lineBalances.length
      || !Number.isSafeInteger(requirementRevision.taskRevisionSnapshot)
      || !nonEmptyString(requirementRevision.createdAt)
    ) {
      throw new TaskMaterialReservationUiError(
        'La revisión de materiales no coincide con sus líneas.',
        'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
      );
    }
  } else if (lineBalances.length !== 0) {
    throw new TaskMaterialReservationUiError(
      'Hay cobertura sin una revisión de materiales.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }

  const currentReservation = reservationHead?.requirementRevisionId === requirementRevision?.id
    ? reservationHead
    : null;
  const exactCoveredLines = lineBalances.filter(
    (line) => line.requiredQuantity === line.reservedQuantity,
  ).length;
  const allReleased = lineBalances.every((line) => line.reservedQuantity === '0.000');
  const allAllocationsUseActiveLocations = lineBalances.every((line) => (
    line.allocations.every((allocation) => line.availability.some((row) => (
      row.locationId === allocation.locationId && row.locationActive
    )))
  ));
  const readinessValid = (
    (readiness.state === 'NOT_DEFINED'
      && requirementRevision === null
      && !reservationHead
      && lineBalances.length === 0
      && readiness.available === false)
    || (readiness.state === 'NOT_REQUIRED'
      && requirementRevision?.kind === 'NO_MATERIALS_REQUIRED'
      && lineBalances.length === 0
      && readiness.available === false)
    || (readiness.state === 'DEFINED_UNRESERVED'
      && requirementRevision?.kind === 'MATERIALS_REQUIRED'
      && currentReservation?.kind !== 'RESERVE'
      && allReleased
      && readiness.available === false
      && readiness.coveredLineCount === 0)
    || (readiness.state === 'AVAILABLE'
      && requirementRevision?.kind === 'MATERIALS_REQUIRED'
      && currentReservation?.kind === 'RESERVE'
      && exactCoveredLines === lineBalances.length
      && allAllocationsUseActiveLocations
      && lineBalances.length > 0
      && readiness.available === true
      && readiness.coveredLineCount === lineBalances.length)
    || (readiness.state === 'REVIEW_REQUIRED' && readiness.available === false)
  );
  if (
    !readinessValid
    || readiness.requiredLineCount !== lineBalances.length
    || (readiness.state !== 'REVIEW_REQUIRED' && readiness.coveredLineCount !== exactCoveredLines)
  ) {
    throw new TaskMaterialReservationUiError(
      'El estado de disponibilidad no coincide con la cobertura real.',
      'TASK_MATERIAL_RESERVATION_UI_CONTRACT_INVALID',
    );
  }

  return {
    ...snapshot,
    task,
    requirementRevision,
    reservationHead,
    readiness,
    lineBalances,
    availability,
  };
}

export function createTaskMaterialReservationDraft(snapshot) {
  return {
    reason: '',
    lines: snapshot.lineBalances.map((line) => {
      const eligible = line.availability.filter((row) => (
        row.locationActive
        && compareProcurementQuantities(
          parseProcurementQuantity(row.available, { allowZero: true }),
          0n,
        ) > 0
      ));
      const enough = eligible.filter((row) => compareProcurementQuantities(
        parseProcurementQuantity(row.available, { allowZero: true }),
        parseProcurementQuantity(line.requiredQuantity),
      ) >= 0);
      return {
        requirementLineId: line.requirementLineId,
        allocations: [{
          locationId: enough.length === 1 ? enough[0].locationId : '',
          quantity: line.requiredQuantity,
        }],
      };
    }),
  };
}

function normalizedReason(value) {
  if (typeof value !== 'string') {
    throw new TaskMaterialReservationUiError('Indicá el motivo de la operación.');
  }
  const reason = value.trim().replace(/\s+/g, ' ');
  if (reason.length < 3 || reason.length > 500 || /[\u0000-\u001f\u007f]/.test(reason)) {
    throw new TaskMaterialReservationUiError(
      'El motivo debe tener entre 3 y 500 caracteres.',
    );
  }
  return reason;
}

export function buildTaskMaterialReservePayload(snapshot, draft) {
  if (
    snapshot.readiness.state !== 'DEFINED_UNRESERVED'
    || snapshot.requirementRevision?.kind !== 'MATERIALS_REQUIRED'
    || snapshot.lineBalances.length === 0
  ) {
    throw new TaskMaterialReservationUiError(
      'La BOM vigente no está lista para reservar.',
      'TASK_MATERIAL_RESERVATION_UI_STATE_INVALID',
    );
  }
  const reason = normalizedReason(draft?.reason);
  if (!Array.isArray(draft?.lines) || draft.lines.length !== snapshot.lineBalances.length) {
    throw new TaskMaterialReservationUiError('La asignación no cubre toda la BOM.');
  }
  const draftByLine = new Map(draft.lines.map((line) => [line.requirementLineId, line]));
  if (draftByLine.size !== snapshot.lineBalances.length) {
    throw new TaskMaterialReservationUiError('La asignación repite una línea.');
  }

  const allocations = [];
  for (const line of snapshot.lineBalances) {
    const draftLine = draftByLine.get(line.requirementLineId);
    if (!draftLine || !Array.isArray(draftLine.allocations) || draftLine.allocations.length < 1) {
      throw new TaskMaterialReservationUiError(`Asigná al menos una ubicación para ${line.itemCode}.`);
    }
    const availableByLocation = new Map(line.availability.map((row) => [row.locationId, row]));
    const seenLocations = new Set();
    const lineQuantities = [];
    for (const draftAllocation of draftLine.allocations) {
      const locationId = draftAllocation?.locationId;
      const availability = availableByLocation.get(locationId);
      if (!availability?.locationActive || seenLocations.has(locationId)) {
        throw new TaskMaterialReservationUiError(
          `Elegí ubicaciones activas y sin repetir para ${line.itemCode}.`,
        );
      }
      seenLocations.add(locationId);
      const quantity = exactQuantity(draftAllocation.quantity);
      const scaled = parseProcurementQuantity(quantity);
      if (compareProcurementQuantities(
        scaled,
        parseProcurementQuantity(availability.available, { allowZero: true }),
      ) > 0) {
        throw new TaskMaterialReservationUiError(
          `${line.itemCode} supera el disponible en ${availability.locationCode}.`,
          'TASK_MATERIAL_RESERVATION_UI_INSUFFICIENT_STOCK',
        );
      }
      lineQuantities.push(scaled);
      allocations.push({
        requirementLineId: line.requirementLineId,
        locationId,
        quantity,
      });
    }
    if (
      formatProcurementQuantity(sumProcurementQuantities(lineQuantities))
      !== line.requiredQuantity
    ) {
      throw new TaskMaterialReservationUiError(
        `${line.itemCode} debe sumar exactamente ${line.requiredQuantity} ${line.unit}.`,
        'TASK_MATERIAL_RESERVATION_UI_BUNDLE_INCOMPLETE',
      );
    }
  }
  return {
    kind: 'RESERVE',
    expectedRequirementRevisionId: snapshot.requirementRevision.id,
    expectedReservationHeadId: snapshot.reservationHead?.id || null,
    reason,
    allocations: allocations.sort((left, right) => (
      left.requirementLineId.localeCompare(right.requirementLineId)
      || left.locationId.localeCompare(right.locationId)
    )),
  };
}

export function buildTaskMaterialReleasePayload(snapshot, reasonValue) {
  if (
    snapshot.requirementRevision?.kind !== 'MATERIALS_REQUIRED'
    || snapshot.reservationHead?.kind !== 'RESERVE'
    || snapshot.reservationHead.requirementRevisionId !== snapshot.requirementRevision.id
  ) {
    throw new TaskMaterialReservationUiError(
      'No hay una reserva vigente para liberar.',
      'TASK_MATERIAL_RESERVATION_UI_STATE_INVALID',
    );
  }
  return {
    kind: 'RELEASE',
    expectedRequirementRevisionId: snapshot.requirementRevision.id,
    expectedReservationHeadId: snapshot.reservationHead.id,
    reason: normalizedReason(reasonValue),
  };
}

export function validateTaskMaterialReservationMutationResult(value, taskId, payload) {
  const result = record(value);
  const transaction = record(result?.transaction);
  const readiness = record(result?.readiness);
  if (
    !result
    || !transaction
    || !readiness
    || typeof result.replayed !== 'boolean'
    || !nonEmptyString(transaction.id)
    || transaction.taskId !== taskId
    || transaction.requirementRevisionId !== payload.expectedRequirementRevisionId
    || transaction.kind !== payload.kind
    || !Number.isSafeInteger(transaction.version)
    || transaction.version < 1
    || transaction.predecessorId !== payload.expectedReservationHeadId
    || transaction.reason !== payload.reason
    || !nonEmptyString(transaction.occurredAt)
    || !Number.isSafeInteger(transaction.requiredLineCount)
    || transaction.requiredLineCount < 1
    || !Number.isSafeInteger(transaction.coveredLineCount)
    || transaction.coveredLineCount < 0
    || !Number.isSafeInteger(transaction.allocationCount)
    || transaction.allocationCount < 1
    || (payload.kind === 'RESERVE'
      && transaction.allocationCount !== payload.allocations?.length)
    || !['DEFINED_UNRESERVED', 'AVAILABLE', 'REVIEW_REQUIRED'].includes(readiness.state)
    || typeof readiness.available !== 'boolean'
    || typeof readiness.authoritative !== 'boolean'
    || readiness.authoritative !== !result.replayed
    || readiness.requiredLineCount !== transaction.requiredLineCount
    || readiness.coveredLineCount !== transaction.coveredLineCount
    || (readiness.state === 'AVAILABLE' && (
      readiness.available !== true
      || readiness.coveredLineCount !== readiness.requiredLineCount
    ))
    || (readiness.state !== 'AVAILABLE' && readiness.available !== false)
    || (!result.replayed && payload.kind === 'RESERVE' && readiness.state !== 'AVAILABLE')
    || (!result.replayed && payload.kind === 'RELEASE'
      && readiness.state !== 'DEFINED_UNRESERVED')
    || Object.hasOwn(transaction, 'operationKey')
    || Object.hasOwn(transaction, 'requestFingerprint')
  ) {
    throw new TaskMaterialReservationUiError(
      'La confirmación de la reserva no coincide con la operación solicitada.',
      'TASK_MATERIAL_RESERVATION_UI_CONFIRMATION_INVALID',
    );
  }
  return result;
}
