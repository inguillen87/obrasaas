import { createHash } from 'node:crypto';

import {
  ProcurementQuantityError,
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  sumProcurementQuantities,
} from './procurement-quantity.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const INVENTORY_TRANSACTION_KINDS = new Set(['RECEIPT_PUTAWAY', 'REVERSAL']);
const MAX_ACCEPTED_DISPOSITIONS = 2_000;
const MAX_ACCEPTED_LINES = 1_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const DATABASE_CONFLICT_CODES = new Set([
  'P2002',
  'P2003',
  'P2004',
  'P2010',
  'P2025',
  'P2034',
  '23503',
  '23505',
  '23514',
  '55000',
]);

const TRANSACTION_INCLUDE = {
  entries: { orderBy: { id: 'asc' } },
  reversedBy: {
    select: {
      id: true,
      kind: true,
      purchaseOrderId: true,
      goodsReceiptId: true,
      sourceInspectionId: true,
      reversesTransactionId: true,
      actorId: true,
      reason: true,
      occurredAt: true,
      createdAt: true,
      entries: { orderBy: { id: 'asc' } },
    },
  },
};

export class InventoryTransactionError extends Error {
  constructor(message, code = 'INVENTORY_TRANSACTION_INVALID', status = 400) {
    super(message);
    this.name = 'InventoryTransactionError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max = 190, { optional = false, collapse = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') {
    throw new InventoryTransactionError(`${field} debe ser texto.`);
  }
  const normalized = collapse
    ? value.trim().replace(/\s+/g, ' ')
    : value.trim();
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new InventoryTransactionError(`${field} es inválido.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId'),
    projectId: text(value?.projectId, 'projectId'),
  };
}

function operationKey(value) {
  if (typeof value !== 'string') {
    throw new InventoryTransactionError(
      'Idempotency-Key es obligatorio.',
      'INVENTORY_TRANSACTION_IDEMPOTENCY_KEY_REQUIRED',
      400,
    );
  }
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new InventoryTransactionError(
      'Idempotency-Key debe tener entre 8 y 128 caracteres seguros.',
      'INVENTORY_TRANSACTION_IDEMPOTENCY_KEY_INVALID',
      400,
    );
  }
  return normalized;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function exactObject(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InventoryTransactionError(`${label} debe ser un objeto JSON.`);
  }
  const keys = Object.keys(value);
  if (
    keys.length !== allowedFields.size
    || keys.some((field) => !allowedFields.has(field))
  ) {
    throw new InventoryTransactionError(
      `${label} contiene campos faltantes o no admitidos.`,
      'INVENTORY_TRANSACTION_FIELDS_INVALID',
      400,
    );
  }
}

function normalizeBindings(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACCEPTED_LINES) {
    throw new InventoryTransactionError(
      `bindings debe contener entre 1 y ${MAX_ACCEPTED_LINES} líneas explícitas.`,
      'INVENTORY_PUTAWAY_BINDINGS_INVALID',
      400,
    );
  }
  const seen = new Set();
  const rows = value.map((binding, index) => {
    exactObject(
      binding,
      new Set(['purchaseOrderLineId', 'inventoryItemId']),
      `bindings[${index}]`,
    );
    const row = {
      purchaseOrderLineId: text(
        binding.purchaseOrderLineId,
        `bindings[${index}].purchaseOrderLineId`,
      ),
      inventoryItemId: text(binding.inventoryItemId, `bindings[${index}].inventoryItemId`),
    };
    if (seen.has(row.purchaseOrderLineId)) {
      throw new InventoryTransactionError(
        'Cada línea de compra debe vincularse exactamente una vez.',
        'INVENTORY_PUTAWAY_BINDING_DUPLICATE',
        400,
      );
    }
    seen.add(row.purchaseOrderLineId);
    return row;
  });
  return rows.sort((left, right) => (
    left.purchaseOrderLineId.localeCompare(right.purchaseOrderLineId)
  ));
}

function normalizeCreateInput(input, rawOperationKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InventoryTransactionError('El cuerpo debe ser un objeto JSON.');
  }
  const kind = typeof input.kind === 'string' ? input.kind : '';
  if (!INVENTORY_TRANSACTION_KINDS.has(kind)) {
    throw new InventoryTransactionError(
      'kind admite RECEIPT_PUTAWAY o REVERSAL.',
      'INVENTORY_TRANSACTION_KIND_INVALID',
      400,
    );
  }
  const normalizedOperationKey = operationKey(rawOperationKey);
  if (kind === 'RECEIPT_PUTAWAY') {
    exactObject(input, new Set(['kind', 'sourceInspectionId', 'bindings']), 'El cuerpo');
    const normalized = {
      kind,
      operationKey: normalizedOperationKey,
      sourceInspectionId: text(input.sourceInspectionId, 'sourceInspectionId'),
      bindings: normalizeBindings(input.bindings),
      reason: null,
      reversesTransactionId: null,
    };
    return {
      ...normalized,
      requestFingerprint: fingerprint({
        kind: normalized.kind,
        sourceInspectionId: normalized.sourceInspectionId,
        bindings: normalized.bindings,
      }),
    };
  }

  exactObject(input, new Set(['kind', 'reversesTransactionId', 'reason']), 'El cuerpo');
  const normalized = {
    kind,
    operationKey: normalizedOperationKey,
    sourceInspectionId: null,
    bindings: [],
    reversesTransactionId: text(input.reversesTransactionId, 'reversesTransactionId'),
    reason: text(input.reason, 'reason', 500, { collapse: true }),
  };
  return {
    ...normalized,
    requestFingerprint: fingerprint({
      kind: normalized.kind,
      reversesTransactionId: normalized.reversesTransactionId,
      reason: normalized.reason,
    }),
  };
}

function storedScaled(value, { allowZero = false } = {}) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  try {
    return parseProcurementQuantity(candidate, { allowZero });
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new InventoryTransactionError(
      'El ledger o la inspección contienen una cantidad decimal inválida.',
      'INVENTORY_QUANTITY_CORRUPT',
      409,
    );
  }
}

function canonicalStored(value, { allowZero = false } = {}) {
  return formatProcurementQuantity(storedScaled(value, { allowZero }));
}

function negativeStored(value) {
  return `-${canonicalStored(value)}`;
}

function signedStored(value) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  if (typeof candidate !== 'string') {
    throw new InventoryTransactionError(
      'El ledger contiene una cantidad sin representación decimal.',
      'INVENTORY_QUANTITY_CORRUPT',
      409,
    );
  }
  if (candidate.startsWith('-')) return `-${canonicalStored(candidate.slice(1))}`;
  return canonicalStored(candidate);
}

function serializeEntry(row) {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    locationId: row.locationId,
    purchaseLineBindingId: row.purchaseLineBindingId || null,
    inspectionDispositionId: row.inspectionDispositionId || null,
    reversesEntryId: row.reversesEntryId || null,
    quantityDelta: signedStored(row.quantityDelta),
    item: {
      id: row.inventoryItemId,
      code: row.itemCodeSnapshot,
      name: row.itemNameSnapshot,
      unit: row.unitSnapshot,
    },
    location: {
      id: row.locationId,
      code: row.locationCodeSnapshot,
      name: row.locationNameSnapshot,
    },
    createdAt: row.createdAt?.toISOString?.() || null,
  };
}

function reversalSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    reason: row.reason || null,
    actorId: row.actorId,
    occurredAt: row.occurredAt?.toISOString?.() || null,
  };
}

export function serializeInventoryTransaction(row) {
  return {
    id: row.id,
    kind: row.kind,
    purchaseOrderId: row.purchaseOrderId || null,
    goodsReceiptId: row.goodsReceiptId || null,
    sourceInspectionId: row.sourceInspectionId || null,
    reversesTransactionId: row.reversesTransactionId || null,
    actorId: row.actorId,
    reason: row.reason || null,
    occurredAt: row.occurredAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    reversedBy: reversalSummary(row.reversedBy),
    entries: Array.isArray(row.entries) ? row.entries.map(serializeEntry) : [],
  };
}

function serializeBalance(row) {
  return {
    inventoryItemId: row.inventoryItemId,
    locationId: row.locationId,
    onHand: canonicalStored(row.onHand, { allowZero: true }),
    revision: row.revision,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

async function balancesForRows(prisma, current, rows) {
  const entries = rows.flatMap((row) => row?.entries || []);
  const itemIds = [...new Set(entries.map((entry) => entry.inventoryItemId))];
  const locationIds = [...new Set(entries.map((entry) => entry.locationId))];
  if (!itemIds.length || !locationIds.length) return [];
  const relevantKeys = new Set(entries.map((entry) => (
    `${entry.inventoryItemId}\u0000${entry.locationId}`
  )));
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      inventoryItemId: { in: itemIds },
      locationId: { in: locationIds },
    },
    orderBy: [{ inventoryItemId: 'asc' }, { locationId: 'asc' }],
  });
  return balances
    .filter((row) => relevantKeys.has(`${row.inventoryItemId}\u0000${row.locationId}`))
    .map(serializeBalance);
}

async function findReplay(transaction, current, normalized) {
  const replay = await transaction.inventoryTransaction.findFirst({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      operationKey: normalized.operationKey,
    },
    include: TRANSACTION_INCLUDE,
  });
  if (!replay) return null;
  if (replay.requestFingerprint !== normalized.requestFingerprint) {
    throw new InventoryTransactionError(
      'El Idempotency-Key ya fue usado con otro contenido.',
      'IDEMPOTENCY_REPLAY_MUTATED',
      409,
    );
  }
  return replay;
}

async function inspectionPlan(prisma, current, sourceInspectionId) {
  const inspection = await prisma.goodsReceiptInspection.findFirst({
    where: {
      id: sourceInspectionId,
      organizationId: current.organizationId,
      projectId: current.projectId,
    },
    select: {
      id: true,
      kind: true,
      version: true,
      purchaseOrderId: true,
      goodsReceiptId: true,
      locationId: true,
      locationCodeSnapshot: true,
      locationNameSnapshot: true,
      dispositions: {
        where: { quality: 'ACCEPTED' },
        select: {
          id: true,
          purchaseOrderLineId: true,
          goodsReceiptLineId: true,
          quantity: true,
        },
        orderBy: { id: 'asc' },
        take: MAX_ACCEPTED_DISPOSITIONS + 1,
      },
    },
  });
  if (!inspection) {
    throw new InventoryTransactionError(
      'La inspección no pertenece a la obra activa.',
      'INVENTORY_INSPECTION_NOT_FOUND',
      404,
    );
  }
  if (inspection.dispositions.length > MAX_ACCEPTED_DISPOSITIONS) {
    throw new InventoryTransactionError(
      `La inspección supera el máximo de ${MAX_ACCEPTED_DISPOSITIONS} partidas aceptadas.`,
      'INVENTORY_PUTAWAY_SCOPE_TOO_LARGE',
      409,
    );
  }

  const head = await prisma.goodsReceiptInspection.findFirst({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      goodsReceiptId: inspection.goodsReceiptId,
    },
    select: { id: true },
    orderBy: { version: 'desc' },
  });
  const lineIds = [...new Set(
    inspection.dispositions.map((row) => row.purchaseOrderLineId),
  )].sort((left, right) => left.localeCompare(right));
  if (lineIds.length > MAX_ACCEPTED_LINES) {
    throw new InventoryTransactionError(
      `La inspección supera el máximo de ${MAX_ACCEPTED_LINES} líneas aceptadas.`,
      'INVENTORY_PUTAWAY_SCOPE_TOO_LARGE',
      409,
    );
  }

  const [purchaseLines, bindings] = await Promise.all([
    lineIds.length
      ? prisma.purchaseOrderLine.findMany({
          where: {
            projectId: current.projectId,
            purchaseOrderId: inspection.purchaseOrderId,
            id: { in: lineIds },
          },
          select: { id: true, description: true, unit: true },
          orderBy: { id: 'asc' },
        })
      : [],
    lineIds.length
      ? prisma.purchaseOrderLineInventoryBinding.findMany({
          where: {
            organizationId: current.organizationId,
            projectId: current.projectId,
            purchaseOrderId: inspection.purchaseOrderId,
            purchaseOrderLineId: { in: lineIds },
          },
          include: {
            inventoryItem: {
              select: { id: true, code: true, name: true, baseUnit: true, active: true },
            },
          },
          orderBy: { purchaseOrderLineId: 'asc' },
        })
      : [],
  ]);
  if (purchaseLines.length !== lineIds.length || bindings.length > lineIds.length) {
    throw new InventoryTransactionError(
      'La inspección no coincide con las líneas canónicas de la orden.',
      'INVENTORY_INSPECTION_SCOPE_CORRUPT',
      409,
    );
  }

  const purchaseLineById = new Map(purchaseLines.map((line) => [line.id, line]));
  const bindingByLineId = new Map(bindings.map((binding) => [
    binding.purchaseOrderLineId,
    binding,
  ]));
  if (bindingByLineId.size !== bindings.length) {
    throw new InventoryTransactionError(
      'Hay más de un vínculo de inventario para la misma línea.',
      'INVENTORY_BINDING_CORRUPT',
      409,
    );
  }

  const acceptedByLine = new Map();
  for (const disposition of inspection.dispositions) {
    const rows = acceptedByLine.get(disposition.purchaseOrderLineId) || [];
    rows.push(storedScaled(disposition.quantity));
    acceptedByLine.set(disposition.purchaseOrderLineId, rows);
  }
  const acceptedLines = lineIds.map((purchaseOrderLineId) => {
    const line = purchaseLineById.get(purchaseOrderLineId);
    const binding = bindingByLineId.get(purchaseOrderLineId) || null;
    let acceptedQuantity;
    try {
      acceptedQuantity = formatProcurementQuantity(sumProcurementQuantities(
        acceptedByLine.get(purchaseOrderLineId) || [],
      ));
    } catch (error) {
      if (!(error instanceof ProcurementQuantityError)) throw error;
      throw new InventoryTransactionError(
        'La suma aceptada excede Decimal(14,3).',
        'INVENTORY_QUANTITY_CORRUPT',
        409,
      );
    }
    return {
      purchaseOrderLineId,
      description: line.description,
      unit: line.unit,
      acceptedQuantity,
      binding: binding ? {
        id: binding.id,
        inventoryItem: {
          id: binding.inventoryItem.id,
          code: binding.inventoryItem.code,
          name: binding.inventoryItem.name,
          baseUnit: binding.inventoryItem.baseUnit,
          active: binding.inventoryItem.active,
        },
      } : null,
    };
  });

  return {
    inspection,
    isHead: head?.id === inspection.id,
    purchaseLineById,
    bindingByLineId,
    acceptedLines,
  };
}

async function transactionRowsForInspection(prisma, current, sourceInspectionId) {
  const putaway = await prisma.inventoryTransaction.findFirst({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      sourceInspectionId,
      kind: 'RECEIPT_PUTAWAY',
    },
    include: TRANSACTION_INCLUDE,
  });
  if (!putaway) return [];
  return putaway.reversedBy ? [putaway, putaway.reversedBy] : [putaway];
}

function databaseConflict(error) {
  if (!DATABASE_CONFLICT_CODES.has(error?.code)) return null;
  const rawMessage = [
    error?.message,
    error?.meta?.message,
    error?.meta?.database_error,
  ].filter((value) => typeof value === 'string').join(' ');
  if (rawMessage.includes('TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK')) {
    return new InventoryTransactionError(
      'Parte de este ingreso está reservada para tareas. Liberá primero esas reservas antes de revertir el stock.',
      'INVENTORY_REVERSAL_STOCK_RESERVED',
      409,
    );
  }
  if (/negative|stock negative/i.test(rawMessage)) {
    return new InventoryTransactionError(
      'El material ya fue utilizado o movido y el ingreso no puede revertirse sin dejar stock negativo.',
      'INVENTORY_REVERSAL_STOCK_ALREADY_USED',
      409,
    );
  }
  return new InventoryTransactionError(
    'El inventario cambió concurrentemente o no coincide con la inspección vigente. Recargá antes de reintentar.',
    'INVENTORY_TRANSACTION_CONFLICT',
    409,
  );
}

function validateExplicitBindings(plan, normalized) {
  const acceptedIds = plan.acceptedLines.map((line) => line.purchaseOrderLineId);
  const requestedIds = normalized.bindings.map((binding) => binding.purchaseOrderLineId);
  if (
    acceptedIds.length !== requestedIds.length
    || acceptedIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw new InventoryTransactionError(
      'bindings debe vincular todas y sólo las líneas con cantidad ACEPTADA.',
      'INVENTORY_PUTAWAY_BINDINGS_INCOMPLETE',
      409,
    );
  }
}

async function createReceiptPutaway(transaction, current, actorId, normalized, now) {
  const plan = await inspectionPlan(transaction, current, normalized.sourceInspectionId);
  if (
    !plan.isHead
    || !['FINALIZATION', 'CORRECTION'].includes(plan.inspection.kind)
  ) {
    throw new InventoryTransactionError(
      'El ingreso requiere la finalización o corrección de inspección vigente.',
      'INVENTORY_PUTAWAY_HEAD_CONFLICT',
      409,
    );
  }
  if (!plan.inspection.dispositions.length) {
    throw new InventoryTransactionError(
      'La inspección vigente no tiene cantidades ACEPTADAS para ingresar.',
      'INVENTORY_PUTAWAY_NOTHING_ACCEPTED',
      409,
    );
  }
  validateExplicitBindings(plan, normalized);

  const previous = await transaction.inventoryTransaction.findFirst({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      sourceInspectionId: normalized.sourceInspectionId,
    },
    include: TRANSACTION_INCLUDE,
  });
  if (previous) {
    throw new InventoryTransactionError(
      previous.reversedBy
        ? 'Este ingreso ya fue revertido. Registrá una nueva versión de inspección antes de volver a ingresar.'
        : 'La inspección ya tiene un ingreso de stock registrado.',
      previous.reversedBy
        ? 'INVENTORY_PUTAWAY_NEW_INSPECTION_REQUIRED'
        : 'INVENTORY_PUTAWAY_ALREADY_RECORDED',
      409,
    );
  }

  const requestedItemIds = [...new Set(
    normalized.bindings.map((binding) => binding.inventoryItemId),
  )];
  const items = await transaction.inventoryItem.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      id: { in: requestedItemIds },
      active: true,
    },
    select: { id: true, code: true, name: true, baseUnit: true, active: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  if (itemById.size !== requestedItemIds.length) {
    throw new InventoryTransactionError(
      'Todos los materiales seleccionados deben estar activos y pertenecer a la obra.',
      'INVENTORY_ITEM_SCOPE_INVALID',
      409,
    );
  }

  const location = await transaction.inventoryLocation.findFirst({
    where: {
      id: plan.inspection.locationId,
      organizationId: current.organizationId,
      projectId: current.projectId,
      active: true,
    },
    select: { id: true },
  });
  if (!location) {
    throw new InventoryTransactionError(
      'La ubicación inspeccionada ya no está activa.',
      'INVENTORY_LOCATION_INACTIVE',
      409,
    );
  }

  const requestedByLine = new Map(normalized.bindings.map((binding) => [
    binding.purchaseOrderLineId,
    binding.inventoryItemId,
  ]));
  const bindingByLineId = new Map(plan.bindingByLineId);
  for (const acceptedLine of plan.acceptedLines) {
    const itemId = requestedByLine.get(acceptedLine.purchaseOrderLineId);
    const item = itemById.get(itemId);
    if (item.baseUnit !== acceptedLine.unit) {
      throw new InventoryTransactionError(
        `La unidad del material ${item.code} no coincide exactamente con ${acceptedLine.unit}.`,
        'INVENTORY_ITEM_UNIT_MISMATCH',
        409,
      );
    }
    const existing = bindingByLineId.get(acceptedLine.purchaseOrderLineId);
    if (existing) {
      if (
        existing.inventoryItemId !== item.id
        || existing.unitSnapshot !== acceptedLine.unit
      ) {
        throw new InventoryTransactionError(
          'La línea ya está vinculada de forma inmutable a otro material o unidad.',
          'INVENTORY_BINDING_CONFLICT',
          409,
        );
      }
      continue;
    }

    const bindingFingerprint = fingerprint({
      purchaseOrderId: plan.inspection.purchaseOrderId,
      purchaseOrderLineId: acceptedLine.purchaseOrderLineId,
      inventoryItemId: item.id,
      unitSnapshot: acceptedLine.unit,
    });
    const created = await transaction.purchaseOrderLineInventoryBinding.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        purchaseOrderId: plan.inspection.purchaseOrderId,
        purchaseOrderLineId: acceptedLine.purchaseOrderLineId,
        inventoryItemId: item.id,
        unitSnapshot: acceptedLine.unit,
        operationKey: `inventory-binding:${fingerprint({
          operationKey: normalized.operationKey,
          purchaseOrderLineId: acceptedLine.purchaseOrderLineId,
        })}`,
        requestFingerprint: bindingFingerprint,
        boundById: actorId,
      },
    });
    bindingByLineId.set(acceptedLine.purchaseOrderLineId, created);
  }

  const created = await transaction.inventoryTransaction.create({
    data: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      kind: 'RECEIPT_PUTAWAY',
      purchaseOrderId: plan.inspection.purchaseOrderId,
      goodsReceiptId: plan.inspection.goodsReceiptId,
      sourceInspectionId: plan.inspection.id,
      reversesTransactionId: null,
      operationKey: normalized.operationKey,
      requestFingerprint: normalized.requestFingerprint,
      actorId,
      reason: null,
      occurredAt: now,
      entries: {
        create: plan.inspection.dispositions.map((disposition) => {
          const binding = bindingByLineId.get(disposition.purchaseOrderLineId);
          const item = itemById.get(binding.inventoryItemId);
          return {
            inventoryItemId: item.id,
            locationId: plan.inspection.locationId,
            purchaseLineBindingId: binding.id,
            inspectionDispositionId: disposition.id,
            reversesEntryId: null,
            quantityDelta: canonicalStored(disposition.quantity),
            itemCodeSnapshot: item.code,
            itemNameSnapshot: item.name,
            unitSnapshot: item.baseUnit,
            locationCodeSnapshot: plan.inspection.locationCodeSnapshot,
            locationNameSnapshot: plan.inspection.locationNameSnapshot,
          };
        }),
      },
    },
    include: TRANSACTION_INCLUDE,
  });
  await transaction.auditLog.create({
    data: {
      organizationId: current.organizationId,
      actorId,
      action: 'inventory.receipt_putaway',
      entityType: 'InventoryTransaction',
      entityId: created.id,
      metadata: {
        projectId: current.projectId,
        purchaseOrderId: plan.inspection.purchaseOrderId,
        goodsReceiptId: plan.inspection.goodsReceiptId,
        sourceInspectionId: plan.inspection.id,
        entryCount: created.entries.length,
        lineCount: plan.acceptedLines.length,
        operationKey: normalized.operationKey,
      },
    },
  });
  return created;
}

async function assertReversalBalance(transaction, current, original) {
  const balances = await balancesForRows(transaction, current, [original]);
  const balanceByKey = new Map(balances.map((balance) => [
    `${balance.inventoryItemId}\u0000${balance.locationId}`,
    storedScaled(balance.onHand, { allowZero: true }),
  ]));
  const requiredByKey = new Map();
  for (const entry of original.entries) {
    const key = `${entry.inventoryItemId}\u0000${entry.locationId}`;
    const currentRequired = requiredByKey.get(key) || 0n;
    let nextRequired;
    try {
      nextRequired = sumProcurementQuantities([
        currentRequired,
        storedScaled(entry.quantityDelta),
      ]);
    } catch (error) {
      if (!(error instanceof ProcurementQuantityError)) throw error;
      throw new InventoryTransactionError(
        'La suma del ingreso excede Decimal(14,3).',
        'INVENTORY_QUANTITY_CORRUPT',
        409,
      );
    }
    requiredByKey.set(key, nextRequired);
  }
  for (const [key, required] of requiredByKey) {
    const onHand = balanceByKey.get(key) || 0n;
    if (compareProcurementQuantities(onHand, required) < 0) {
      throw new InventoryTransactionError(
        'El material ya fue utilizado o movido y el ingreso no puede revertirse sin dejar stock negativo.',
        'INVENTORY_REVERSAL_STOCK_ALREADY_USED',
        409,
      );
    }
  }
}

async function createReversal(transaction, current, actorId, normalized, now) {
  const original = await transaction.inventoryTransaction.findFirst({
    where: {
      id: normalized.reversesTransactionId,
      organizationId: current.organizationId,
      projectId: current.projectId,
      kind: 'RECEIPT_PUTAWAY',
    },
    include: TRANSACTION_INCLUDE,
  });
  if (!original) {
    throw new InventoryTransactionError(
      'El ingreso a revertir no pertenece a la obra activa.',
      'INVENTORY_PUTAWAY_NOT_FOUND',
      404,
    );
  }
  if (original.reversedBy) {
    throw new InventoryTransactionError(
      'El ingreso de stock ya tiene una reversión inmutable.',
      'INVENTORY_PUTAWAY_ALREADY_REVERSED',
      409,
    );
  }
  if (!original.entries.length || original.entries.length > MAX_ACCEPTED_DISPOSITIONS) {
    throw new InventoryTransactionError(
      'El ingreso original no tiene un ledger completo y reversible.',
      'INVENTORY_PUTAWAY_LEDGER_CORRUPT',
      409,
    );
  }
  await assertReversalBalance(transaction, current, original);

  const created = await transaction.inventoryTransaction.create({
    data: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      kind: 'REVERSAL',
      purchaseOrderId: null,
      goodsReceiptId: null,
      sourceInspectionId: null,
      reversesTransactionId: original.id,
      operationKey: normalized.operationKey,
      requestFingerprint: normalized.requestFingerprint,
      actorId,
      reason: normalized.reason,
      occurredAt: now,
      entries: {
        create: original.entries.map((entry) => ({
          inventoryItemId: entry.inventoryItemId,
          locationId: entry.locationId,
          purchaseLineBindingId: null,
          inspectionDispositionId: null,
          reversesEntryId: entry.id,
          quantityDelta: negativeStored(entry.quantityDelta),
          itemCodeSnapshot: entry.itemCodeSnapshot,
          itemNameSnapshot: entry.itemNameSnapshot,
          unitSnapshot: entry.unitSnapshot,
          locationCodeSnapshot: entry.locationCodeSnapshot,
          locationNameSnapshot: entry.locationNameSnapshot,
        })),
      },
    },
    include: TRANSACTION_INCLUDE,
  });
  await transaction.auditLog.create({
    data: {
      organizationId: current.organizationId,
      actorId,
      action: 'inventory.receipt_putaway_reversed',
      entityType: 'InventoryTransaction',
      entityId: created.id,
      metadata: {
        projectId: current.projectId,
        reversesTransactionId: original.id,
        sourceInspectionId: original.sourceInspectionId,
        entryCount: created.entries.length,
        reason: normalized.reason,
        operationKey: normalized.operationKey,
      },
    },
  });
  return created;
}

export async function createInventoryTransaction(prisma, {
  scope: rawScope,
  actorId,
  operationKey: rawOperationKey,
  input,
  now = new Date(),
} = {}) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId');
  const normalized = normalizeCreateInput(input, rawOperationKey);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new InventoryTransactionError('now debe ser una fecha válida.');
  }

  try {
    return await runOperationalProjectMutation(prisma, current, async (transaction) => {
      const replay = await findReplay(transaction, current, normalized);
      if (replay) {
        return {
          transaction: serializeInventoryTransaction(replay),
          balances: await balancesForRows(transaction, current, [replay]),
          replayed: true,
        };
      }
      const created = normalized.kind === 'RECEIPT_PUTAWAY'
        ? await createReceiptPutaway(transaction, current, actor, normalized, now)
        : await createReversal(transaction, current, actor, normalized, now);
      return {
        transaction: serializeInventoryTransaction(created),
        balances: await balancesForRows(transaction, current, [created]),
        replayed: false,
      };
    });
  } catch (error) {
    if (
      error instanceof InventoryTransactionError
      || error?.name === 'ProjectWritePolicyError'
    ) throw error;
    throw databaseConflict(error) || error;
  }
}

export async function getReceiptPutawayStatus(prisma, {
  scope: rawScope,
  sourceInspectionId,
} = {}) {
  const current = scope(rawScope);
  const inspectionId = text(sourceInspectionId, 'sourceInspectionId');
  const plan = await inspectionPlan(prisma, current, inspectionId);
  const rows = await transactionRowsForInspection(prisma, current, inspectionId);
  const putaway = rows[0] || null;
  const activePutaway = Boolean(putaway && !putaway.reversedBy);
  return {
    inspection: {
      id: plan.inspection.id,
      kind: plan.inspection.kind,
      version: plan.inspection.version,
      purchaseOrderId: plan.inspection.purchaseOrderId,
      goodsReceiptId: plan.inspection.goodsReceiptId,
      location: {
        id: plan.inspection.locationId,
        code: plan.inspection.locationCodeSnapshot,
        name: plan.inspection.locationNameSnapshot,
      },
      isHead: plan.isHead,
    },
    acceptedDispositionCount: plan.inspection.dispositions.length,
    acceptedLines: plan.acceptedLines,
    transactions: rows.map(serializeInventoryTransaction),
    balances: await balancesForRows(prisma, current, rows),
    activePutaway,
    canPutAway: Boolean(
      plan.isHead
      && ['FINALIZATION', 'CORRECTION'].includes(plan.inspection.kind)
      && plan.inspection.dispositions.length
      && !putaway
    ),
    requiresNewInspectionVersion: Boolean(putaway?.reversedBy),
  };
}

export function inventoryTransactionErrorResponse(error) {
  if (!(error instanceof InventoryTransactionError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
