import { createHash } from 'node:crypto';

import {
  ProcurementQuantityError,
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  subtractProcurementQuantities,
  sumProcurementQuantities,
} from './procurement-quantity.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const INSPECTION_KINDS = new Set(['FINALIZATION', 'CORRECTION', 'REVERSAL']);
const DISPOSITION_QUALITIES = new Set([
  'ACCEPTED',
  'DAMAGED',
  'REJECTED',
  'QUARANTINED',
]);
const MAX_DISPOSITIONS = 2_000;
const MAX_RECEIPT_LINES = 1_000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const CONFLICTING_DATABASE_CODES = new Set([
  'P2002',
  'P2003',
  'P2004',
  'P2010',
  'P2025',
  'P2034',
]);

export class GoodsReceiptInspectionError extends Error {
  constructor(message, code = 'GOODS_RECEIPT_INSPECTION_INVALID', status = 400) {
    super(message);
    this.name = 'GoodsReceiptInspectionError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max = 190, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') {
    throw new GoodsReceiptInspectionError(`${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new GoodsReceiptInspectionError(`${field} es inválido.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId'),
    projectId: text(value?.projectId, 'projectId'),
  };
}

function enumValue(value, field, allowed) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new GoodsReceiptInspectionError(`${field} es inválido.`);
  }
  return value;
}

function exactQuantity(value, field = 'quantity') {
  try {
    const scaled = parseProcurementQuantity(value);
    return { scaled, canonical: formatProcurementQuantity(scaled) };
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptInspectionError(
      `${field} debe ser un texto decimal positivo con hasta tres decimales.`,
      'GOODS_RECEIPT_INSPECTION_QUANTITY_INVALID',
      400,
    );
  }
}

function storedQuantity(value, { allowZero = false } = {}) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  try {
    return parseProcurementQuantity(candidate, { allowZero });
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptInspectionError(
      'Las cantidades persistidas de la recepción, asignación o inspección son inválidas.',
      'GOODS_RECEIPT_INSPECTION_QUANTITY_CORRUPT',
      409,
    );
  }
}

function exactSum(values) {
  try {
    return sumProcurementQuantities(values);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptInspectionError(
      'La suma de cantidades de la inspección excede el límite permitido.',
      'GOODS_RECEIPT_INSPECTION_QUANTITY_CORRUPT',
      409,
    );
  }
}

function exactDifference(total, allocated) {
  try {
    return subtractProcurementQuantities(total, allocated);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptInspectionError(
      'Las asignaciones persistidas superan la cantidad recibida.',
      'GOODS_RECEIPT_INSPECTION_QUANTITY_CORRUPT',
      409,
    );
  }
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function dispositionKey(disposition) {
  return [
    disposition.goodsReceiptLineId,
    disposition.allocationId || '',
    disposition.quality,
  ].join('\u0000');
}

function normalizeDisposition(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GoodsReceiptInspectionError(`dispositions[${index}] debe ser un objeto.`);
  }
  const allowedFields = new Set([
    'goodsReceiptLineId',
    'allocationId',
    'quality',
    'quantity',
  ]);
  if (Object.keys(value).some((field) => !allowedFields.has(field))) {
    throw new GoodsReceiptInspectionError(
      `dispositions[${index}] contiene campos no permitidos.`,
      'GOODS_RECEIPT_INSPECTION_DISPOSITION_FIELDS_INVALID',
      400,
    );
  }
  const quantity = exactQuantity(value.quantity, `dispositions[${index}].quantity`);
  return {
    goodsReceiptLineId: text(
      value.goodsReceiptLineId,
      `dispositions[${index}].goodsReceiptLineId`,
    ),
    allocationId: text(
      value.allocationId,
      `dispositions[${index}].allocationId`,
      190,
      { optional: true },
    ),
    quality: enumValue(
      value.quality,
      `dispositions[${index}].quality`,
      DISPOSITION_QUALITIES,
    ),
    quantity: quantity.canonical,
    quantityScaled: quantity.scaled,
  };
}

function normalizeCreateInput(input, operationKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new GoodsReceiptInspectionError('El cuerpo debe ser un objeto JSON.');
  }
  const kind = enumValue(input.kind, 'kind', INSPECTION_KINDS);
  const dispositionsProvided = Object.prototype.hasOwnProperty.call(input, 'dispositions');
  if (kind === 'REVERSAL' && dispositionsProvided) {
    throw new GoodsReceiptInspectionError(
      'REVERSAL no admite dispositions.',
      'GOODS_RECEIPT_INSPECTION_REVERSAL_DISPOSITIONS_FORBIDDEN',
      400,
    );
  }
  if (kind !== 'REVERSAL' && (
    !Array.isArray(input.dispositions)
    || input.dispositions.length === 0
    || input.dispositions.length > MAX_DISPOSITIONS
  )) {
    throw new GoodsReceiptInspectionError(
      `La inspección requiere entre 1 y ${MAX_DISPOSITIONS} disposiciones.`,
      'GOODS_RECEIPT_INSPECTION_DISPOSITIONS_INVALID',
      400,
    );
  }
  if (kind === 'REVERSAL' && input.locationId !== undefined) {
    throw new GoodsReceiptInspectionError(
      'REVERSAL conserva la ubicación previa y no admite locationId.',
      'GOODS_RECEIPT_INSPECTION_REVERSAL_LOCATION_FORBIDDEN',
      400,
    );
  }
  const dispositions = kind === 'REVERSAL'
    ? []
    : input.dispositions.map(normalizeDisposition);
  const keys = dispositions.map(dispositionKey);
  if (new Set(keys).size !== keys.length) {
    throw new GoodsReceiptInspectionError(
      'Una categoría no puede repetirse para la misma línea y asignación.',
      'GOODS_RECEIPT_INSPECTION_DISPOSITION_DUPLICATE',
      400,
    );
  }
  dispositions.sort((left, right) => dispositionKey(left).localeCompare(dispositionKey(right)));
  const normalized = {
    operationKey: text(operationKey, 'Idempotency-Key', 128),
    goodsReceiptId: text(input.goodsReceiptId, 'goodsReceiptId'),
    kind,
    predecessorId: text(input.predecessorId, 'predecessorId', 190, { optional: true }),
    locationId: kind === 'REVERSAL'
      ? null
      : text(input.locationId, 'locationId'),
    reason: text(input.reason, 'reason', 500, { optional: true }),
    dispositions,
  };
  if (['CORRECTION', 'REVERSAL'].includes(kind) && !normalized.reason) {
    throw new GoodsReceiptInspectionError(
      'CORRECTION y REVERSAL requieren un motivo.',
      'GOODS_RECEIPT_INSPECTION_REASON_REQUIRED',
      400,
    );
  }
  if (
    kind !== 'REVERSAL'
    && dispositions.some((disposition) => disposition.quality !== 'ACCEPTED')
    && !normalized.reason
  ) {
    throw new GoodsReceiptInspectionError(
      'Una disposición no aceptada requiere un motivo.',
      'GOODS_RECEIPT_INSPECTION_EXCEPTION_REASON_REQUIRED',
      400,
    );
  }
  return {
    ...normalized,
    requestFingerprint: fingerprint({
      goodsReceiptId: normalized.goodsReceiptId,
      kind: normalized.kind,
      predecessorId: normalized.predecessorId,
      locationId: normalized.locationId,
      reason: normalized.reason,
      dispositions: normalized.dispositions.map((disposition) => ({
        goodsReceiptLineId: disposition.goodsReceiptLineId,
        allocationId: disposition.allocationId,
        quality: disposition.quality,
        quantity: disposition.quantity,
      })),
    }),
  };
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_PAGE_SIZE;
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) {
    throw new GoodsReceiptInspectionError(
      `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
      'GOODS_RECEIPT_INSPECTION_PAGE_INVALID',
      400,
    );
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new GoodsReceiptInspectionError(
      `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
      'GOODS_RECEIPT_INSPECTION_PAGE_INVALID',
      400,
    );
  }
  return parsed;
}

function assertChainTransition(kind, predecessorId, head) {
  if (!head) {
    if (kind !== 'FINALIZATION' || predecessorId) {
      throw new GoodsReceiptInspectionError(
        'La primera inspección debe ser FINALIZATION sin predecessorId.',
        'GOODS_RECEIPT_INSPECTION_CHAIN_CONFLICT',
        409,
      );
    }
    return 1;
  }
  if (predecessorId !== head.id) {
    throw new GoodsReceiptInspectionError(
      'La inspección cambió; usá como predecessorId la versión vigente.',
      'GOODS_RECEIPT_INSPECTION_CHAIN_CONFLICT',
      409,
    );
  }
  const valid = head.kind === 'REVERSAL'
    ? kind === 'FINALIZATION'
    : ['CORRECTION', 'REVERSAL'].includes(kind);
  if (!valid) {
    throw new GoodsReceiptInspectionError(
      'La transición de inspección no es válida.',
      'GOODS_RECEIPT_INSPECTION_CHAIN_CONFLICT',
      409,
    );
  }
  return head.version + 1;
}

function validateCompletePartition(receipt, dispositions) {
  if (!Array.isArray(receipt.lines) || receipt.lines.length > MAX_RECEIPT_LINES) {
    throw new GoodsReceiptInspectionError(
      `La recepción supera el máximo de ${MAX_RECEIPT_LINES} líneas inspeccionables.`,
      'GOODS_RECEIPT_INSPECTION_SCOPE_TOO_LARGE',
      409,
    );
  }
  const lineById = new Map(receipt.lines.map((line) => [line.id, line]));
  const dispositionByLine = new Map();
  for (const disposition of dispositions) {
    if (!lineById.has(disposition.goodsReceiptLineId)) {
      throw new GoodsReceiptInspectionError(
        'Una disposición no pertenece a la recepción activa.',
        'GOODS_RECEIPT_INSPECTION_LINE_SCOPE',
        409,
      );
    }
    const rows = dispositionByLine.get(disposition.goodsReceiptLineId) || [];
    rows.push(disposition);
    dispositionByLine.set(disposition.goodsReceiptLineId, rows);
  }

  for (const line of receipt.lines) {
    const lineQuantity = storedQuantity(line.quantity);
    const lineDispositions = dispositionByLine.get(line.id) || [];
    const allocations = Array.isArray(line.commitmentAllocations)
      ? line.commitmentAllocations
      : [];
    const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
    const allocatedTotal = exactSum(
      allocations.map((allocation) => storedQuantity(allocation.quantity)),
    );
    const expectedUnallocated = exactDifference(lineQuantity, allocatedTotal);

    for (const disposition of lineDispositions) {
      if (disposition.allocationId && !allocationById.has(disposition.allocationId)) {
        throw new GoodsReceiptInspectionError(
          'Una disposición referencia una asignación ajena a la línea recibida.',
          'GOODS_RECEIPT_INSPECTION_ALLOCATION_SCOPE',
          409,
        );
      }
    }

    const lineTotal = exactSum(lineDispositions.map((row) => row.quantityScaled));
    if (compareProcurementQuantities(lineTotal, lineQuantity) !== 0) {
      throw new GoodsReceiptInspectionError(
        'Las disposiciones deben particionar exactamente cada línea recibida.',
        'GOODS_RECEIPT_INSPECTION_LINE_PARTITION_INVALID',
        409,
      );
    }

    for (const allocation of allocations) {
      const assigned = exactSum(lineDispositions
        .filter((row) => row.allocationId === allocation.id)
        .map((row) => row.quantityScaled));
      if (compareProcurementQuantities(assigned, storedQuantity(allocation.quantity)) !== 0) {
        throw new GoodsReceiptInspectionError(
          'Las disposiciones deben particionar exactamente cada asignación conciliada.',
          'GOODS_RECEIPT_INSPECTION_ALLOCATION_PARTITION_INVALID',
          409,
        );
      }
    }

    const unallocated = exactSum(lineDispositions
      .filter((row) => row.allocationId === null)
      .map((row) => row.quantityScaled));
    if (compareProcurementQuantities(unallocated, expectedUnallocated) !== 0) {
      throw new GoodsReceiptInspectionError(
        'La partición sin asignación no coincide con el saldo recibido pendiente de conciliación.',
        'GOODS_RECEIPT_INSPECTION_UNALLOCATED_PARTITION_INVALID',
        409,
      );
    }
  }
}

async function assertNoActiveCommitmentLineClosure(transaction, current, receipt) {
  const keys = [];
  const seen = new Set();
  for (const line of receipt.lines || []) {
    for (const allocation of line.commitmentAllocations || []) {
      const key = `${allocation.supplierCommitmentId}\u0000${allocation.purchaseOrderLineId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push({
        supplierCommitmentId: allocation.supplierCommitmentId,
        purchaseOrderLineId: allocation.purchaseOrderLineId,
      });
    }
  }
  if (!keys.length) return;
  const activeClosures = await transaction.supplierCommitmentLineClosure.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      purchaseOrderId: receipt.purchaseOrderId,
      kind: 'FINAL_DELIVERY',
      successor: { is: null },
      OR: keys,
    },
    select: { id: true },
    take: 1,
  });
  if (activeClosures.length) {
    throw new GoodsReceiptInspectionError(
      'Revertí primero el cierre de la línea comprometida antes de cambiar su inspección.',
      'GOODS_RECEIPT_INSPECTION_COMMITMENT_LINE_CLOSED',
      409,
    );
  }
}

export function serializeGoodsReceiptInspection(row) {
  return {
    id: row.id,
    projectId: row.projectId,
    purchaseOrderId: row.purchaseOrderId,
    goodsReceiptId: row.goodsReceiptId,
    kind: row.kind,
    version: row.version,
    predecessorId: row.predecessorId || null,
    inspectedById: row.inspectedById,
    locationId: row.locationId,
    location: {
      id: row.locationId,
      code: row.locationCodeSnapshot,
      name: row.locationNameSnapshot,
    },
    reason: row.reason || null,
    inspectedAt: row.inspectedAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    dispositions: Array.isArray(row.dispositions)
      ? row.dispositions.map((disposition) => ({
          id: disposition.id,
          purchaseOrderLineId: disposition.purchaseOrderLineId,
          goodsReceiptLineId: disposition.goodsReceiptLineId,
          allocationId: disposition.allocationId || null,
          quality: disposition.quality,
          quantity: formatProcurementQuantity(storedQuantity(disposition.quantity)),
        }))
      : undefined,
  };
}

function databaseConflict(error) {
  if (!CONFLICTING_DATABASE_CODES.has(error?.code)) return null;
  return new GoodsReceiptInspectionError(
    'La inspección entró en conflicto con el estado vigente. Recargá antes de reintentar.',
    'GOODS_RECEIPT_INSPECTION_CONFLICT',
    409,
  );
}

export async function createGoodsReceiptInspection(prisma, {
  scope: rawScope,
  actorId,
  operationKey,
  input,
  now = new Date(),
} = {}) {
  const current = scope(rawScope);
  const inspectorId = text(actorId, 'actorId');
  const normalized = normalizeCreateInput(input, operationKey);

  try {
    return await runOperationalProjectMutation(prisma, current, async (transaction) => {
      const replay = await transaction.goodsReceiptInspection.findFirst({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          operationKey: normalized.operationKey,
        },
        include: { dispositions: { orderBy: { id: 'asc' } } },
      });
      if (replay) {
        if (replay.requestFingerprint !== normalized.requestFingerprint) {
          throw new GoodsReceiptInspectionError(
            'El Idempotency-Key ya fue usado con otro contenido.',
            'IDEMPOTENCY_REPLAY_MUTATED',
            409,
          );
        }
        return { inspection: serializeGoodsReceiptInspection(replay), replayed: true };
      }

      const receipt = await transaction.goodsReceipt.findFirst({
        where: {
          id: normalized.goodsReceiptId,
          organizationId: current.organizationId,
          projectId: current.projectId,
        },
        select: {
          id: true,
          organizationId: true,
          projectId: true,
          purchaseOrderId: true,
          status: true,
          lines: {
            select: {
              id: true,
              purchaseOrderLineId: true,
              quantity: true,
              commitmentAllocations: {
                select: {
                  id: true,
                  supplierCommitmentId: true,
                  purchaseOrderLineId: true,
                  quantity: true,
                },
                orderBy: { id: 'asc' },
              },
            },
            orderBy: { id: 'asc' },
            take: MAX_RECEIPT_LINES + 1,
          },
        },
      });
      if (!receipt) {
        throw new GoodsReceiptInspectionError(
          'La recepción no pertenece a la obra activa.',
          'GOODS_RECEIPT_INSPECTION_RECEIPT_SCOPE',
          409,
        );
      }
      if (normalized.kind !== 'REVERSAL' && receipt.status !== 'POSTED') {
        throw new GoodsReceiptInspectionError(
          'Sólo una recepción POSTED puede finalizarse o corregirse.',
          'GOODS_RECEIPT_INSPECTION_RECEIPT_NOT_POSTED',
          409,
        );
      }

      const head = await transaction.goodsReceiptInspection.findFirst({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          goodsReceiptId: receipt.id,
        },
        orderBy: { version: 'desc' },
        select: {
          id: true,
          kind: true,
          version: true,
          locationId: true,
          locationCodeSnapshot: true,
          locationNameSnapshot: true,
        },
      });
      const version = assertChainTransition(normalized.kind, normalized.predecessorId, head);
      await assertNoActiveCommitmentLineClosure(transaction, current, receipt);

      let locationId = normalized.locationId;
      let locationCodeSnapshot;
      let locationNameSnapshot;
      if (normalized.kind === 'REVERSAL') {
        locationId = head.locationId;
        locationCodeSnapshot = head.locationCodeSnapshot;
        locationNameSnapshot = head.locationNameSnapshot;
      } else {
        const location = await transaction.inventoryLocation.findFirst({
          where: {
            id: normalized.locationId,
            organizationId: current.organizationId,
            projectId: current.projectId,
            active: true,
          },
          select: { id: true, code: true, name: true },
        });
        if (!location) {
          throw new GoodsReceiptInspectionError(
            'La ubicación de inspección no pertenece a la obra activa.',
            'GOODS_RECEIPT_INSPECTION_LOCATION_SCOPE',
            409,
          );
        }
        locationCodeSnapshot = location.code;
        locationNameSnapshot = location.name;
        validateCompletePartition(receipt, normalized.dispositions);
      }

      const dispositionByLine = new Map(receipt.lines.map((line) => [
        line.id,
        line.purchaseOrderLineId,
      ]));
      const created = await transaction.goodsReceiptInspection.create({
        data: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          purchaseOrderId: receipt.purchaseOrderId,
          goodsReceiptId: receipt.id,
          kind: normalized.kind,
          version,
          predecessorId: normalized.predecessorId,
          operationKey: normalized.operationKey,
          requestFingerprint: normalized.requestFingerprint,
          inspectedById: inspectorId,
          locationId,
          locationCodeSnapshot,
          locationNameSnapshot,
          reason: normalized.reason,
          inspectedAt: now,
          dispositions: normalized.kind === 'REVERSAL'
            ? undefined
            : {
                create: normalized.dispositions.map((disposition) => ({
                  organizationId: current.organizationId,
                  projectId: current.projectId,
                  purchaseOrderId: receipt.purchaseOrderId,
                  purchaseOrderLineId: dispositionByLine.get(disposition.goodsReceiptLineId),
                  goodsReceiptId: receipt.id,
                  goodsReceiptLineId: disposition.goodsReceiptLineId,
                  allocationId: disposition.allocationId,
                  quality: disposition.quality,
                  quantity: disposition.quantity,
                })),
              },
        },
        include: { dispositions: { orderBy: { id: 'asc' } } },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: current.organizationId,
          actorId: inspectorId,
          action: `goods_receipt_inspection.${normalized.kind.toLowerCase()}`,
          entityType: 'GoodsReceiptInspection',
          entityId: created.id,
          metadata: {
            projectId: current.projectId,
            purchaseOrderId: receipt.purchaseOrderId,
            goodsReceiptId: receipt.id,
            version,
            locationId,
            locationCodeSnapshot,
            locationNameSnapshot,
            dispositionCount: normalized.dispositions.length,
          },
        },
      });
      return { inspection: serializeGoodsReceiptInspection(created), replayed: false };
    });
  } catch (error) {
    if (
      error instanceof GoodsReceiptInspectionError
      || error?.name === 'ProjectWritePolicyError'
    ) throw error;
    throw databaseConflict(error) || error;
  }
}

export async function listGoodsReceiptInspections(prisma, {
  organizationId,
  projectId,
  purchaseOrderId,
  goodsReceiptId,
  cursor,
  limit,
} = {}) {
  const current = scope({ organizationId, projectId });
  const orderId = text(purchaseOrderId, 'purchaseOrderId', 190, { optional: true });
  const receiptId = text(goodsReceiptId, 'goodsReceiptId', 190, { optional: true });
  if (Boolean(orderId) === Boolean(receiptId)) {
    throw new GoodsReceiptInspectionError(
      'La consulta requiere exactamente purchaseOrderId o goodsReceiptId.',
      'GOODS_RECEIPT_INSPECTION_QUERY_SCOPE_INVALID',
      400,
    );
  }
  const afterId = text(cursor, 'cursor', 190, { optional: true });
  const take = normalizeLimit(limit);
  const rows = await prisma.goodsReceiptInspection.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      ...(orderId ? { purchaseOrderId: orderId } : { goodsReceiptId: receiptId }),
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    include: { dispositions: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take).map(serializeGoodsReceiptInspection);
  return {
    inspections: page,
    hasMore,
    nextCursor: hasMore && page.length ? page[page.length - 1].id : null,
  };
}

export function goodsReceiptInspectionErrorResponse(error) {
  if (!(error instanceof GoodsReceiptInspectionError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
