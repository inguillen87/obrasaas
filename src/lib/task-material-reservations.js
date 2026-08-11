import { createHash } from 'node:crypto';

import {
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  sumProcurementQuantities,
} from './procurement-quantity.js';

const MAX_ALLOCATIONS = 1_000;
const TASK_MATERIAL_RESERVATION_ERROR = Symbol.for(
  'obrasaas.task-material-reservation-error',
);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const RESERVATION_KINDS = new Set(['RESERVE', 'RELEASE']);
const RESULT_FIELDS = new Set([
  'transaction_id',
  'organization_id',
  'project_id',
  'task_id',
  'requirement_revision_id',
  'transaction_type',
  'transaction_version',
  'predecessor_id',
  'actor_id',
  'operation_key',
  'request_fingerprint',
  'reason',
  'occurred_at',
  'required_line_count',
  'covered_line_count',
  'allocation_count',
  'readiness_state',
  'available',
  'replayed',
]);

const RESERVE_SQL = `
  SELECT *
  FROM "obrasaas_task_material_reserve"(
    $1::text,
    $2::text,
    $3::text,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::text,
    $10::jsonb
  )
`;

const RELEASE_SQL = `
  SELECT *
  FROM "obrasaas_task_material_release"(
    $1::text,
    $2::text,
    $3::text,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::text
  )
`;

const DATABASE_ERROR_MARKERS = Object.freeze([
  {
    marker: 'IDEMPOTENCY_REPLAY_MUTATED',
    code: 'IDEMPOTENCY_REPLAY_MUTATED',
    message: 'La clave de idempotencia ya fue usada con otro contenido.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_REQUIREMENT_HEAD_STALE',
    code: 'TASK_MATERIAL_REQUIREMENT_HEAD_STALE',
    message: 'La revisión de materiales cambió. Actualizá la tarea antes de continuar.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_HEAD_STALE',
    code: 'TASK_MATERIAL_RESERVATION_HEAD_STALE',
    message: 'La reserva cambió. Actualizá la tarea antes de continuar.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK',
    code: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK',
    message: 'No hay stock disponible suficiente para reservar la BOM completa.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE',
    code: 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE',
    message: 'La reserva debe cubrir exactamente todas las líneas de la BOM vigente.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID',
    code: 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID',
    message: 'La reserva vigente no se puede liberar en su estado actual.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY',
    code: 'PROJECT_READ_ONLY',
    message: 'La obra no admite cambios operativos en su estado actual.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE',
    code: 'TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE',
    message: 'La tarea ya no admite nuevas reservas. Actualizá su estado antes de continuar.',
    status: 409,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_ACTOR_FORBIDDEN',
    code: 'TASK_MATERIAL_RESERVATION_FORBIDDEN',
    message: 'No tenés permisos para modificar reservas de esta obra.',
    status: 403,
  },
  {
    marker: 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID',
    code: 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID',
    message: 'La tarea, la BOM o el stock no pertenecen a la obra activa.',
    status: 409,
  },
]);

export class TaskMaterialReservationError extends Error {
  constructor(message, code = 'TASK_MATERIAL_RESERVATION_INVALID', status = 400) {
    super(message);
    this.name = 'TaskMaterialReservationError';
    this.code = code;
    this.status = status;
    this[TASK_MATERIAL_RESERVATION_ERROR] = true;
  }
}

function identifier(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (
    typeof value !== 'string'
    || !value
    || value.length > 190
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TaskMaterialReservationError(`${field} es inválido.`);
  }
  return value;
}

function boundedText(value, field, { minimum = 1, maximum = 500 } = {}) {
  if (typeof value !== 'string') {
    throw new TaskMaterialReservationError(`${field} debe ser texto.`);
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (
    normalized.length < minimum
    || normalized.length > maximum
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new TaskMaterialReservationError(`${field} es inválido.`);
  }
  return normalized;
}

function strictObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TaskMaterialReservationError(`${field} debe ser un objeto.`);
  }
  return value;
}

function exactFields(value, allowed, required, field) {
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.has(key));
  const missing = [...required].find((key) => !Object.hasOwn(value, key));
  if (unknown || missing) {
    throw new TaskMaterialReservationError(
      unknown
        ? `${field}.${unknown} no está permitido.`
        : `${field}.${missing} es obligatorio.`,
      'TASK_MATERIAL_RESERVATION_FIELDS_INVALID',
    );
  }
}

function trustedScope(value) {
  return {
    organizationId: identifier(value?.organizationId, 'organizationId'),
    projectId: identifier(value?.projectId, 'projectId'),
  };
}

function operationKey(value) {
  if (typeof value !== 'string') {
    throw new TaskMaterialReservationError(
      'Idempotency-Key es obligatorio.',
      'TASK_MATERIAL_RESERVATION_IDEMPOTENCY_REQUIRED',
    );
  }
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new TaskMaterialReservationError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'TASK_MATERIAL_RESERVATION_IDEMPOTENCY_INVALID',
    );
  }
  return normalized;
}

function normalizeAllocation(rawAllocation, index) {
  const allocation = strictObject(rawAllocation, `allocations[${index}]`);
  exactFields(
    allocation,
    new Set(['requirementLineId', 'locationId', 'quantity']),
    new Set(['requirementLineId', 'locationId', 'quantity']),
    `allocations[${index}]`,
  );
  let quantity;
  try {
    quantity = formatProcurementQuantity(parseProcurementQuantity(allocation.quantity));
  } catch {
    throw new TaskMaterialReservationError(
      `allocations[${index}].quantity debe ser texto Decimal(14,3) positivo.`,
      'TASK_MATERIAL_RESERVATION_QUANTITY_INVALID',
    );
  }
  return {
    requirementLineId: identifier(
      allocation.requirementLineId,
      `allocations[${index}].requirementLineId`,
    ),
    locationId: identifier(allocation.locationId, `allocations[${index}].locationId`),
    quantity,
  };
}

function assertAllocationTotals(allocations) {
  const perLine = new Map();
  for (const allocation of allocations) {
    const quantities = perLine.get(allocation.requirementLineId) || [];
    quantities.push(parseProcurementQuantity(allocation.quantity));
    perLine.set(allocation.requirementLineId, quantities);
  }
  try {
    for (const quantities of perLine.values()) sumProcurementQuantities(quantities);
  } catch {
    throw new TaskMaterialReservationError(
      'La cantidad total de una línea supera Decimal(14,3).',
      'TASK_MATERIAL_RESERVATION_QUANTITY_INVALID',
    );
  }
}

function normalizeInput(input, rawOperationKey, taskId) {
  const body = strictObject(input, 'body');
  const kind = typeof body.kind === 'string' ? body.kind : '';
  if (!RESERVATION_KINDS.has(kind)) {
    throw new TaskMaterialReservationError(
      'kind debe ser RESERVE o RELEASE.',
      'TASK_MATERIAL_RESERVATION_KIND_INVALID',
    );
  }
  const allowed = kind === 'RESERVE'
    ? new Set([
        'kind',
        'expectedRequirementRevisionId',
        'expectedReservationHeadId',
        'reason',
        'allocations',
      ])
    : new Set([
        'kind',
        'expectedRequirementRevisionId',
        'expectedReservationHeadId',
        'reason',
      ]);
  exactFields(body, allowed, allowed, 'body');

  let allocations = [];
  if (kind === 'RESERVE') {
    if (
      !Array.isArray(body.allocations)
      || body.allocations.length < 1
      || body.allocations.length > MAX_ALLOCATIONS
    ) {
      throw new TaskMaterialReservationError(
        `allocations debe incluir entre 1 y ${MAX_ALLOCATIONS} asignaciones.`,
        'TASK_MATERIAL_RESERVATION_ALLOCATIONS_INVALID',
      );
    }
    allocations = body.allocations.map(normalizeAllocation)
      .sort((left, right) => (
        left.requirementLineId.localeCompare(right.requirementLineId)
        || left.locationId.localeCompare(right.locationId)
      ));
    const allocationKeys = allocations.map(
      (allocation) => `${allocation.requirementLineId}\u0000${allocation.locationId}`,
    );
    if (new Set(allocationKeys).size !== allocationKeys.length) {
      throw new TaskMaterialReservationError(
        'Cada par línea/ubicación puede aparecer una sola vez.',
        'TASK_MATERIAL_RESERVATION_ALLOCATION_DUPLICATE',
      );
    }
    assertAllocationTotals(allocations);
  }

  const expectedReservationHeadId = identifier(
    body.expectedReservationHeadId,
    'expectedReservationHeadId',
    { nullable: kind === 'RESERVE' },
  );
  const normalized = {
    kind,
    operationKey: operationKey(rawOperationKey),
    expectedRequirementRevisionId: identifier(
      body.expectedRequirementRevisionId,
      'expectedRequirementRevisionId',
    ),
    expectedReservationHeadId,
    reason: boundedText(body.reason, 'reason', { minimum: 3, maximum: 500 }),
    allocations,
  };
  return {
    ...normalized,
    requestFingerprint: createHash('sha256').update(JSON.stringify({
      taskId,
      kind: normalized.kind,
      expectedRequirementRevisionId: normalized.expectedRequirementRevisionId,
      expectedReservationHeadId: normalized.expectedReservationHeadId,
      reason: normalized.reason,
      allocations: normalized.allocations,
    })).digest('hex'),
  };
}

function databaseErrorText(error) {
  return [
    error?.code,
    error?.message,
    error?.meta?.code,
    error?.meta?.message,
    error?.meta?.database_error,
  ].filter((value) => typeof value === 'string').join(' ');
}

function safeDatabaseError(error) {
  const text = databaseErrorText(error);
  const matched = DATABASE_ERROR_MARKERS.find(({ marker }) => text.includes(marker));
  if (matched) {
    return new TaskMaterialReservationError(matched.message, matched.code, matched.status);
  }
  if (['P2002', 'P2003', 'P2004', 'P2034', '23503', '23505', '23514'].includes(error?.code)) {
    return new TaskMaterialReservationError(
      'La reserva cambió o dejó de ser válida. Actualizá la tarea antes de continuar.',
      'TASK_MATERIAL_RESERVATION_WRITE_CONFLICT',
      409,
    );
  }
  return new TaskMaterialReservationError(
    'El servicio de reservas no está disponible temporalmente.',
    'TASK_MATERIAL_RESERVATION_UNAVAILABLE',
    503,
  );
}

function contractError() {
  return new TaskMaterialReservationError(
    'El servicio de reservas devolvió una respuesta inválida.',
    'TASK_MATERIAL_RESERVATION_CONTRACT_INVALID',
    503,
  );
}

function integer(value, { minimum = 0 } = {}) {
  return Number.isSafeInteger(value) && value >= minimum ? value : null;
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function storedQuantity(value, field) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  try {
    return formatProcurementQuantity(parseProcurementQuantity(candidate, { allowZero: true }));
  } catch {
    throw new TaskMaterialReservationError(
      `${field} no respeta Decimal(14,3).`,
      'TASK_MATERIAL_RESERVATION_PROJECTION_CORRUPT',
      409,
    );
  }
}

function positiveStoredQuantity(value, field) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  try {
    return formatProcurementQuantity(parseProcurementQuantity(candidate));
  } catch {
    throw new TaskMaterialReservationError(
      `${field} no respeta Decimal(14,3).`,
      'TASK_MATERIAL_RESERVATION_PROJECTION_CORRUPT',
      409,
    );
  }
}

function serializeReservationHead(head) {
  if (!head) return null;
  const occurredAt = iso(head.occurredAt);
  if (
    typeof head.id !== 'string'
    || !RESERVATION_KINDS.has(head.transactionType)
    || integer(head.version, { minimum: 1 }) === null
    || !occurredAt
  ) throw contractError();
  return {
    id: head.id,
    kind: head.transactionType,
    version: head.version,
    predecessorId: head.predecessorId || null,
    requirementRevisionId: head.requirementRevisionId,
    reason: head.reason,
    actorId: head.actorId,
    occurredAt,
  };
}

function serializeAvailability(row) {
  const inventoryBalance = row?.inventoryBalance;
  const inventoryItem = inventoryBalance?.inventoryItem;
  const location = inventoryBalance?.location;
  const onHand = storedQuantity(row.onHand, 'availability.onHand');
  const reserved = storedQuantity(row.reserved, 'availability.reserved');
  const available = storedQuantity(row.available, 'availability.available');
  const onHandRevision = integer(row.onHandRevision);
  const balanceRevision = integer(inventoryBalance?.revision);
  const reservationRevision = integer(row.reservationRevision);
  const updatedAt = iso(row.updatedAt);
  if (
    !inventoryBalance
    || !inventoryItem
    || !location
    || inventoryBalance.organizationId !== row.organizationId
    || inventoryBalance.projectId !== row.projectId
    || inventoryBalance.inventoryItemId !== row.inventoryItemId
    || inventoryBalance.locationId !== row.locationId
    || storedQuantity(inventoryBalance.onHand, 'inventoryBalance.onHand') !== onHand
    || balanceRevision === null
    || balanceRevision !== onHandRevision
    || typeof inventoryItem.code !== 'string'
    || typeof inventoryItem.name !== 'string'
    || typeof inventoryItem.baseUnit !== 'string'
    || typeof location.code !== 'string'
    || typeof location.name !== 'string'
    || onHandRevision === null
    || reservationRevision === null
    || !updatedAt
    || parseProcurementQuantity(onHand, { allowZero: true })
      - parseProcurementQuantity(reserved, { allowZero: true })
      !== parseProcurementQuantity(available, { allowZero: true })
  ) throw contractError();
  return {
    inventoryItemId: row.inventoryItemId,
    itemCode: inventoryItem.code,
    itemName: inventoryItem.name,
    unit: inventoryItem.baseUnit,
    locationId: row.locationId,
    locationCode: location.code,
    locationName: location.name,
    locationActive: location.active === true,
    onHand,
    reserved,
    available,
    onHandRevision,
    reservationRevision,
    updatedAt,
  };
}

function activeReservationEntriesValid(
  reservationHead,
  lines,
  balanceByLine,
  availabilityRows,
) {
  if (reservationHead?.transactionType !== 'RESERVE' || !Array.isArray(reservationHead.entries)) {
    return false;
  }
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const availabilityByKey = new Map(availabilityRows.map((row) => [
    `${row.inventoryItemId}\u0000${row.locationId}`,
    row,
  ]));
  const entryKeys = new Set();
  const quantitiesByLine = new Map();
  try {
    for (const entry of reservationHead.entries) {
      const line = lineById.get(entry.requirementLineId);
      const key = `${entry.requirementLineId}\u0000${entry.locationId}`;
      const availability = availabilityByKey.get(
        `${entry.inventoryItemId}\u0000${entry.locationId}`,
      );
      const entryQuantity = parseProcurementQuantity(
        typeof entry.quantityDelta === 'string'
          ? entry.quantityDelta
          : entry.quantityDelta?.toString?.(),
      );
      if (
        !line
        || entry.inventoryItemId !== line.inventoryItemId
        || entryKeys.has(key)
        || !availability
        || availability.locationActive !== true
        || compareProcurementQuantities(
          parseProcurementQuantity(availability.reserved, { allowZero: true }),
          entryQuantity,
        ) < 0
      ) return false;
      entryKeys.add(key);
      const quantities = quantitiesByLine.get(line.id) || [];
      quantities.push(entryQuantity);
      quantitiesByLine.set(line.id, quantities);
    }
    return lines.every((line) => {
      const quantities = quantitiesByLine.get(line.id);
      const balance = balanceByLine.get(line.id);
      return quantities?.length > 0
        && balance
        && formatProcurementQuantity(sumProcurementQuantities(quantities))
          === storedQuantity(balance.reservedQuantity, 'lineBalance.reservedQuantity');
    });
  } catch {
    return false;
  }
}

function snapshotReadiness({
  requirementHead,
  reservationHead,
  lines,
  balances,
  availability,
}) {
  if (!requirementHead) {
    return reservationHead
      ? { state: 'REVIEW_REQUIRED', available: false, requiredLineCount: 0, coveredLineCount: 0 }
      : { state: 'NOT_DEFINED', available: false, requiredLineCount: 0, coveredLineCount: 0 };
  }
  const reservationBelongsToHead = reservationHead?.requirementRevisionId === requirementHead.id;
  if (reservationHead?.transactionType === 'RESERVE' && !reservationBelongsToHead) {
    return {
      state: 'REVIEW_REQUIRED',
      available: false,
      requiredLineCount: lines.length,
      coveredLineCount: 0,
    };
  }
  if (requirementHead.kind === 'NO_MATERIALS_REQUIRED') {
    return { state: 'NOT_REQUIRED', available: false, requiredLineCount: 0, coveredLineCount: 0 };
  }
  const currentReservationHead = reservationBelongsToHead ? reservationHead : null;
  const requiredLineCount = lines.length;
  const balanceByLine = new Map(balances.map((balance) => [balance.requirementLineId, balance]));
  const coverageValid = balances.length === requiredLineCount
    && balanceByLine.size === requiredLineCount
    && lines.every((line) => {
      const balance = balanceByLine.get(line.id);
      return balance
        && balance.inventoryItemId === line.inventoryItemId
        && storedQuantity(balance.requiredQuantity, 'lineBalance.requiredQuantity')
          === storedQuantity(line.requiredQuantity, 'requirementLine.requiredQuantity');
    });
  const coveredLineCount = coverageValid
    ? lines.filter((line) => {
        const balance = balanceByLine.get(line.id);
        return storedQuantity(balance.reservedQuantity, 'lineBalance.reservedQuantity')
          === storedQuantity(line.requiredQuantity, 'requirementLine.requiredQuantity');
      }).length
    : 0;
  const reviewRequired = (
    requirementHead.taskIdentitySnapshot !== true
    || requirementHead.taskRevisionSnapshot !== requirementHead.task?.revision
    || requirementHead.lineCount !== requiredLineCount
    || lines.some((line) => line.inventoryItem?.active !== true)
    || !coverageValid
    || (!currentReservationHead && balances.some(
      (balance) => storedQuantity(balance.reservedQuantity, 'lineBalance.reservedQuantity') !== '0.000',
    ))
    || (currentReservationHead?.transactionType === 'RESERVE'
      && coveredLineCount !== requiredLineCount)
    || (currentReservationHead?.transactionType === 'RESERVE'
      && !activeReservationEntriesValid(
        currentReservationHead,
        lines,
        balanceByLine,
        availability,
      ))
    || (currentReservationHead?.transactionType === 'RELEASE' && balances.some(
      (balance) => storedQuantity(balance.reservedQuantity, 'lineBalance.reservedQuantity') !== '0.000',
    ))
  );
  if (reviewRequired) {
    return { state: 'REVIEW_REQUIRED', available: false, requiredLineCount, coveredLineCount };
  }
  if (currentReservationHead?.transactionType === 'RESERVE' && requiredLineCount > 0) {
    return { state: 'AVAILABLE', available: true, requiredLineCount, coveredLineCount };
  }
  return { state: 'DEFINED_UNRESERVED', available: false, requiredLineCount, coveredLineCount };
}

function serializeReadSnapshot(snapshot, command) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw contractError();
  if (!snapshot.task) {
    throw new TaskMaterialReservationError(
      'No se encontró la tarea en la obra activa.',
      'TASK_MATERIAL_RESERVATION_TASK_NOT_FOUND',
      404,
    );
  }
  if (
    snapshot.task.id !== command.taskId
    || snapshot.task.projectId !== command.projectId
    || snapshot.task.project?.organizationId !== command.organizationId
  ) throw contractError();

  const requirementHead = snapshot.requirementHead || null;
  const lines = Array.isArray(requirementHead?.lines) ? requirementHead.lines : [];
  const balances = Array.isArray(snapshot.balances) ? snapshot.balances : [];
  const availability = (Array.isArray(snapshot.availability) ? snapshot.availability : [])
    .map(serializeAvailability)
    .sort((left, right) => (
      left.itemCode.localeCompare(right.itemCode)
      || left.locationCode.localeCompare(right.locationCode)
      || left.locationId.localeCompare(right.locationId)
    ));
  const reservationHead = snapshot.reservationHead || null;
  const inventoryItemIds = new Set(lines.map((line) => line.inventoryItemId));
  if (
    (requirementHead && (
      requirementHead.organizationId !== command.organizationId
      || requirementHead.projectId !== command.projectId
      || requirementHead.taskId !== command.taskId
      || !['MATERIALS_REQUIRED', 'NO_MATERIALS_REQUIRED'].includes(requirementHead.kind)
    ))
    || (reservationHead && (
      reservationHead.organizationId !== command.organizationId
      || reservationHead.projectId !== command.projectId
      || reservationHead.taskId !== command.taskId
    ))
    || balances.some((balance) => (
      balance.organizationId !== command.organizationId
      || balance.projectId !== command.projectId
      || balance.taskId !== command.taskId
      || balance.requirementRevisionId !== requirementHead?.id
    ))
    || snapshot.availability?.some?.((row) => (
      row.organizationId !== command.organizationId
      || row.projectId !== command.projectId
      || !inventoryItemIds.has(row.inventoryItemId)
    ))
  ) throw contractError();

  const readiness = snapshotReadiness({
    requirementHead,
    reservationHead,
    lines,
    balances,
    availability,
  });
  const balanceByLine = new Map(balances.map((balance) => [balance.requirementLineId, balance]));
  const activeEntries = reservationHead?.transactionType === 'RESERVE'
    && reservationHead.requirementRevisionId === requirementHead?.id
    ? (Array.isArray(reservationHead.entries) ? reservationHead.entries : [])
    : [];
  const lineBalances = lines.map((line) => {
    const balance = balanceByLine.get(line.id);
    const allocations = activeEntries
      .filter((entry) => entry.requirementLineId === line.id)
      .map((entry) => ({
        id: entry.id,
        locationId: entry.locationId,
        quantity: positiveStoredQuantity(entry.quantityDelta, 'reservationEntry.quantityDelta'),
      }))
      .sort((left, right) => left.locationId.localeCompare(right.locationId));
    return {
      requirementLineId: line.id,
      inventoryItemId: line.inventoryItemId,
      itemCode: line.itemCodeSnapshot,
      itemName: line.itemNameSnapshot,
      unit: line.unitSnapshot,
      requiredQuantity: storedQuantity(line.requiredQuantity, 'requirementLine.requiredQuantity'),
      reservedQuantity: balance
        ? storedQuantity(balance.reservedQuantity, 'lineBalance.reservedQuantity')
        : '0.000',
      allocations,
      availability: availability.filter((row) => row.inventoryItemId === line.inventoryItemId),
    };
  });
  return {
    task: {
      id: snapshot.task.id,
      revision: snapshot.task.revision,
    },
    requirementRevision: requirementHead ? {
      id: requirementHead.id,
      kind: requirementHead.kind,
      version: requirementHead.version,
      lineCount: requirementHead.lineCount,
      taskRevisionSnapshot: requirementHead.taskRevisionSnapshot,
      createdAt: iso(requirementHead.createdAt),
    } : null,
    reservationHead: serializeReservationHead(reservationHead),
    readiness,
    lineBalances,
    availability,
  };
}

function assertResultContract(rows, command) {
  if (!Array.isArray(rows) || rows.length !== 1) throw contractError();
  const row = rows[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw contractError();
  if (
    Object.keys(row).length !== RESULT_FIELDS.size
    || Object.keys(row).some((key) => !RESULT_FIELDS.has(key))
    || [...RESULT_FIELDS].some((key) => !Object.hasOwn(row, key))
  ) throw contractError();

  const transactionVersion = integer(row.transaction_version, { minimum: 1 });
  const requiredLineCount = integer(row.required_line_count, { minimum: 1 });
  const coveredLineCount = integer(row.covered_line_count);
  const allocationCount = integer(row.allocation_count);
  const occurredAt = iso(row.occurred_at);
  const readinessConsistent = (
    (row.readiness_state === 'AVAILABLE'
      && row.available === true
      && coveredLineCount === requiredLineCount)
    || (row.readiness_state === 'DEFINED_UNRESERVED'
      && row.available === false
      && coveredLineCount === 0)
    || (row.readiness_state === 'REVIEW_REQUIRED' && row.available === false)
  );
  if (
    typeof row.transaction_id !== 'string'
    || !row.transaction_id
    || row.organization_id !== command.organizationId
    || row.project_id !== command.projectId
    || row.task_id !== command.taskId
    || row.requirement_revision_id !== command.expectedRequirementRevisionId
    || row.transaction_type !== command.kind
    || transactionVersion === null
    || row.predecessor_id !== command.expectedReservationHeadId
    || row.actor_id !== command.actorId
    || row.operation_key !== command.operationKey
    || row.request_fingerprint !== command.requestFingerprint
    || row.reason !== command.reason
    || occurredAt === null
    || requiredLineCount === null
    || coveredLineCount === null
    || allocationCount === null
    || typeof row.replayed !== 'boolean'
    || !readinessConsistent
    || (command.kind === 'RESERVE' && allocationCount !== command.allocations.length)
    || (!row.replayed && command.kind === 'RESERVE' && (
      row.readiness_state !== 'AVAILABLE'
      || allocationCount < requiredLineCount
    ))
    || (!row.replayed && command.kind === 'RELEASE'
      && row.readiness_state !== 'DEFINED_UNRESERVED')
  ) throw contractError();
  return {
    transaction: {
      id: row.transaction_id,
      taskId: row.task_id,
      requirementRevisionId: row.requirement_revision_id,
      kind: row.transaction_type,
      version: transactionVersion,
      predecessorId: row.predecessor_id,
      actorId: row.actor_id,
      reason: row.reason,
      occurredAt,
      requiredLineCount,
      coveredLineCount,
      allocationCount,
    },
    readiness: {
      state: row.readiness_state,
      available: row.available,
      requiredLineCount,
      coveredLineCount,
      authoritative: row.replayed === false,
    },
    replayed: row.replayed,
  };
}

/**
 * Raw SQL boundary for the migration-owned reservation commands.
 *
 * The two governed functions must return exactly the columns in RESULT_FIELDS.
 * They own tenant/task/BOM/actor validation, deterministic lock ordering,
 * InventoryAvailability and per-line balance updates, append-only ledger writes,
 * complete-BOM equality, exact mirror release and idempotent replay. User values
 * are always positional parameters; function names and SQL text are constants.
 */
export function createTaskMaterialReservationSqlAdapter(prisma) {
  if (!prisma || typeof prisma.$queryRawUnsafe !== 'function') {
    throw new TaskMaterialReservationError(
      'El adaptador SQL de reservas no está disponible.',
      'TASK_MATERIAL_RESERVATION_UNAVAILABLE',
      503,
    );
  }
  return Object.freeze({
    async execute(command) {
      if (command.kind === 'RESERVE') {
        return prisma.$queryRawUnsafe(
          RESERVE_SQL,
          command.organizationId,
          command.projectId,
          command.taskId,
          command.expectedRequirementRevisionId,
          command.expectedReservationHeadId,
          command.actorId,
          command.operationKey,
          command.requestFingerprint,
          command.reason,
          JSON.stringify(command.allocations),
        );
      }
      if (command.kind === 'RELEASE') {
        return prisma.$queryRawUnsafe(
          RELEASE_SQL,
          command.organizationId,
          command.projectId,
          command.taskId,
          command.expectedRequirementRevisionId,
          command.expectedReservationHeadId,
          command.actorId,
          command.operationKey,
          command.requestFingerprint,
          command.reason,
        );
      }
      throw contractError();
    },
  });
}

/**
 * Creates one internally consistent, tenant-scoped reservation snapshot.
 * Keeping these Prisma reads behind this adapter lets route/domain tests inject
 * deterministic snapshots while Production uses one REPEATABLE READ view.
 */
export function createTaskMaterialReservationReadAdapter(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw new TaskMaterialReservationError(
      'El adaptador de lectura de reservas no está disponible.',
      'TASK_MATERIAL_RESERVATION_UNAVAILABLE',
      503,
    );
  }
  return Object.freeze({
    async read(command) {
      return prisma.$transaction(async (transaction) => {
        const task = await transaction.task.findFirst({
          where: {
            id: command.taskId,
            projectId: command.projectId,
            materialRequirementEligible: true,
            project: { organizationId: command.organizationId },
          },
          select: {
            id: true,
            projectId: true,
            revision: true,
            project: { select: { organizationId: true } },
          },
        });
        if (!task) {
          return {
            task: null,
            requirementHead: null,
            reservationHead: null,
            balances: [],
            availability: [],
          };
        }
        const requirementHead = await transaction.taskMaterialRequirementRevision.findFirst({
          where: {
            organizationId: command.organizationId,
            projectId: command.projectId,
            taskId: command.taskId,
          },
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            organizationId: true,
            projectId: true,
            taskId: true,
            taskIdentitySnapshot: true,
            taskRevisionSnapshot: true,
            kind: true,
            version: true,
            lineCount: true,
            createdAt: true,
            lines: {
              select: {
                id: true,
                inventoryItemId: true,
                requiredQuantity: true,
                itemCodeSnapshot: true,
                itemNameSnapshot: true,
                unitSnapshot: true,
                inventoryItem: { select: { active: true } },
              },
              orderBy: [{ itemCodeSnapshot: 'asc' }, { id: 'asc' }],
            },
          },
        });
        const reservationHead = await transaction.taskMaterialReservationTransaction.findFirst({
          where: {
            organizationId: command.organizationId,
            projectId: command.projectId,
            taskId: command.taskId,
          },
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            organizationId: true,
            projectId: true,
            taskId: true,
            requirementRevisionId: true,
            transactionType: true,
            version: true,
            predecessorId: true,
            actorId: true,
            reason: true,
            occurredAt: true,
            entries: {
              select: {
                id: true,
                requirementLineId: true,
                inventoryItemId: true,
                locationId: true,
                quantityDelta: true,
              },
              orderBy: [{ requirementLineId: 'asc' }, { locationId: 'asc' }, { id: 'asc' }],
            },
          },
        });
        if (!requirementHead || requirementHead.kind === 'NO_MATERIALS_REQUIRED') {
          return {
            task,
            requirementHead: requirementHead ? { ...requirementHead, task } : null,
            reservationHead,
            balances: [],
            availability: [],
          };
        }
        const balances = await transaction.taskMaterialReservationBalance.findMany({
          where: {
            organizationId: command.organizationId,
            projectId: command.projectId,
            taskId: command.taskId,
            requirementRevisionId: requirementHead.id,
          },
          orderBy: [{ requirementLineId: 'asc' }],
          select: {
            organizationId: true,
            projectId: true,
            taskId: true,
            requirementRevisionId: true,
            requirementLineId: true,
            inventoryItemId: true,
            requiredQuantity: true,
            reservedQuantity: true,
            revision: true,
            updatedAt: true,
          },
        });
        const inventoryItemIds = [...new Set(
          requirementHead.lines.map((line) => line.inventoryItemId),
        )];
        const availability = inventoryItemIds.length === 0
          ? []
          : await transaction.inventoryAvailability.findMany({
              where: {
                organizationId: command.organizationId,
                projectId: command.projectId,
                inventoryItemId: { in: inventoryItemIds },
              },
              orderBy: [
                { inventoryItemId: 'asc' },
                { locationId: 'asc' },
              ],
              include: {
                inventoryBalance: {
                  include: {
                    inventoryItem: true,
                    location: true,
                  },
                },
              },
            });
        return {
          task,
          requirementHead: { ...requirementHead, task },
          reservationHead,
          balances,
          availability,
        };
      }, {
        isolationLevel: 'RepeatableRead',
        maxWait: 5_000,
        timeout: 10_000,
      });
    },
  });
}

export async function readTaskMaterialReservationSnapshot(prisma, {
  scope,
  taskId: rawTaskId,
}, { readAdapter = null } = {}) {
  const normalizedScope = trustedScope(scope);
  const taskId = identifier(rawTaskId, 'taskId');
  const command = Object.freeze({
    organizationId: normalizedScope.organizationId,
    projectId: normalizedScope.projectId,
    taskId,
  });
  const adapter = readAdapter || createTaskMaterialReservationReadAdapter(prisma);
  if (!adapter || typeof adapter.read !== 'function') throw contractError();
  try {
    return serializeReadSnapshot(await adapter.read(command), command);
  } catch (error) {
    if (error instanceof TaskMaterialReservationError) throw error;
    throw safeDatabaseError(error);
  }
}

export async function applyTaskMaterialReservation(prisma, {
  scope,
  taskId: rawTaskId,
  actorId: rawActorId,
  operationKey: rawOperationKey,
  input,
}, { sqlAdapter = null } = {}) {
  const normalizedScope = trustedScope(scope);
  const taskId = identifier(rawTaskId, 'taskId');
  const actorId = identifier(rawActorId, 'actorId');
  const normalized = normalizeInput(input, rawOperationKey, taskId);
  const command = Object.freeze({
    organizationId: normalizedScope.organizationId,
    projectId: normalizedScope.projectId,
    taskId,
    actorId,
    ...normalized,
  });
  const adapter = sqlAdapter || createTaskMaterialReservationSqlAdapter(prisma);
  if (!adapter || typeof adapter.execute !== 'function') throw contractError();
  try {
    return assertResultContract(await adapter.execute(command), command);
  } catch (error) {
    if (error instanceof TaskMaterialReservationError) throw error;
    throw safeDatabaseError(error);
  }
}

export function taskMaterialReservationErrorResponse(error) {
  if (
    !(error instanceof TaskMaterialReservationError)
    && error?.[TASK_MATERIAL_RESERVATION_ERROR] !== true
  ) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
