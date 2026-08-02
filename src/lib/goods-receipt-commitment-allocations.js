import { createHash } from 'node:crypto';

import {
  ProcurementQuantityError,
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  subtractProcurementQuantities,
} from './procurement-quantity.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const MAX_BALANCE_LINES_PER_ORDER = 1_000;
const CONFLICTING_DATABASE_CODES = new Set([
  'P2002',
  'P2003',
  'P2004',
  'P2010',
  'P2025',
  'P2034',
]);

export class GoodsReceiptCommitmentAllocationError extends Error {
  constructor(
    message,
    code = 'GOODS_RECEIPT_COMMITMENT_ALLOCATION_INVALID',
    status = 400,
  ) {
    super(message);
    this.name = 'GoodsReceiptCommitmentAllocationError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max = 190) {
  if (typeof value !== 'string') {
    throw new GoodsReceiptCommitmentAllocationError(`${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new GoodsReceiptCommitmentAllocationError(`${field} es inválido.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId'),
    projectId: text(value?.projectId, 'projectId'),
  };
}

function inputQuantity(value) {
  try {
    const scaled = parseProcurementQuantity(value);
    return { scaled, canonical: formatProcurementQuantity(scaled) };
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptCommitmentAllocationError(
      'quantity debe ser un texto decimal positivo con hasta tres decimales.',
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_QUANTITY_INVALID',
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
    throw new GoodsReceiptCommitmentAllocationError(
      'Las cantidades persistidas de recepciones, compromisos o asignaciones son inválidas.',
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_QUANTITY_CORRUPT',
      409,
    );
  }
}

function aggregateQuantity(aggregate) {
  const value = aggregate?._sum?.quantity;
  return value === null || value === undefined
    ? 0n
    : storedQuantity(value, { allowZero: true });
}

function remainingQuantity(total, allocated) {
  try {
    return subtractProcurementQuantities(total, allocated);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptCommitmentAllocationError(
      'Las asignaciones persistidas superan la cantidad documentada.',
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_QUANTITY_CORRUPT',
      409,
    );
  }
}

function receiptAllocationStatus(allocated, remaining) {
  if (allocated === 0n) return 'UNALLOCATED';
  if (remaining === 0n) return 'FULLY_ALLOCATED';
  return 'PARTIALLY_ALLOCATED';
}

function commitmentReceiptStatus(allocated, remaining) {
  if (allocated === 0n) return 'NOT_RECEIVED';
  if (remaining === 0n) return 'FULLY_RECEIVED';
  return 'PARTIALLY_RECEIVED';
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeCreateInput(input, operationKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new GoodsReceiptCommitmentAllocationError('El cuerpo debe ser un objeto JSON.');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'operationKey')) {
    throw new GoodsReceiptCommitmentAllocationError(
      'operationKey debe enviarse únicamente en el encabezado Idempotency-Key.',
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_IDEMPOTENCY_BODY_FORBIDDEN',
      400,
    );
  }
  const normalizedQuantity = inputQuantity(input.quantity);
  const normalized = {
    operationKey: text(operationKey, 'Idempotency-Key', 128),
    goodsReceiptLineId: text(input.goodsReceiptLineId, 'goodsReceiptLineId'),
    supplierCommitmentId: text(input.supplierCommitmentId, 'supplierCommitmentId'),
    quantity: normalizedQuantity.canonical,
    quantityScaled: normalizedQuantity.scaled,
  };
  return {
    ...normalized,
    requestFingerprint: fingerprint({
      goodsReceiptLineId: normalized.goodsReceiptLineId,
      supplierCommitmentId: normalized.supplierCommitmentId,
      quantity: normalized.quantity,
    }),
  };
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_PAGE_SIZE;
  if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) {
    throw new GoodsReceiptCommitmentAllocationError(
      `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_PAGE_INVALID',
      400,
    );
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new GoodsReceiptCommitmentAllocationError(
      `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_PAGE_INVALID',
      400,
    );
  }
  return parsed;
}

export function serializeGoodsReceiptCommitmentAllocation(row) {
  return {
    id: row.id,
    projectId: row.projectId,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    goodsReceiptId: row.goodsReceiptId,
    goodsReceiptLineId: row.goodsReceiptLineId,
    supplierCommitmentId: row.supplierCommitmentId,
    quantity: formatProcurementQuantity(storedQuantity(row.quantity)),
    createdAt: row.createdAt?.toISOString?.() || null,
  };
}

async function loadAllocationContext(transaction, current, {
  goodsReceiptLineId,
  supplierCommitmentId,
  requireAllocatable,
}) {
  const receiptLine = await transaction.goodsReceiptLine.findFirst({
    where: {
      id: goodsReceiptLineId,
      projectId: current.projectId,
      goodsReceipt: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        ...(requireAllocatable ? { status: 'POSTED' } : {}),
      },
    },
    select: {
      id: true,
      projectId: true,
      purchaseOrderId: true,
      purchaseOrderLineId: true,
      quantity: true,
      goodsReceiptId: true,
      goodsReceipt: {
        select: {
          status: true,
          receivedAt: true,
        },
      },
    },
  });
  if (!receiptLine) {
    throw new GoodsReceiptCommitmentAllocationError(
      'La línea de recepción no existe, no está contabilizada o no pertenece a la obra activa.',
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_RECEIPT_SCOPE',
      409,
    );
  }

  const commitmentLine = await transaction.supplierCommitmentLine.findFirst({
    where: {
      commitmentId: supplierCommitmentId,
      projectId: current.projectId,
      purchaseOrderId: receiptLine.purchaseOrderId,
      purchaseOrderLineId: receiptLine.purchaseOrderLineId,
      commitment: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        purchaseOrderId: receiptLine.purchaseOrderId,
        ...(requireAllocatable ? {
          kind: 'MATERIAL_DELIVERY',
          status: { not: 'CANCELLED' },
        } : {}),
      },
    },
    select: {
      commitmentId: true,
      projectId: true,
      purchaseOrderId: true,
      purchaseOrderLineId: true,
      quantity: true,
      commitment: {
        select: {
          status: true,
          title: true,
          supplier: { select: { legalName: true } },
        },
      },
    },
  });
  if (!commitmentLine) {
    throw new GoodsReceiptCommitmentAllocationError(
      'El compromiso no es una entrega material activa de la misma orden y partida.',
      'GOODS_RECEIPT_COMMITMENT_ALLOCATION_COMMITMENT_SCOPE',
      409,
    );
  }
  return { receiptLine, commitmentLine };
}

async function deriveSingleBalances(transaction, current, context) {
  const { receiptLine, commitmentLine } = context;
  const [receiptAggregate, commitmentAggregate] = await Promise.all([
    transaction.goodsReceiptCommitmentAllocation.aggregate({
      where: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        goodsReceiptLineId: receiptLine.id,
      },
      _sum: { quantity: true },
    }),
    transaction.goodsReceiptCommitmentAllocation.aggregate({
      where: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        supplierCommitmentId: commitmentLine.commitmentId,
        purchaseOrderLineId: commitmentLine.purchaseOrderLineId,
        goodsReceipt: { status: 'POSTED' },
      },
      _sum: { quantity: true },
    }),
  ]);
  const received = storedQuantity(receiptLine.quantity);
  const receiptAllocated = aggregateQuantity(receiptAggregate);
  const committed = storedQuantity(commitmentLine.quantity);
  const commitmentAllocated = aggregateQuantity(commitmentAggregate);
  const receiptRemaining = remainingQuantity(received, receiptAllocated);
  const commitmentRemaining = remainingQuantity(committed, commitmentAllocated);

  return {
    receiptLine: {
      goodsReceiptId: receiptLine.goodsReceiptId,
      goodsReceiptLineId: receiptLine.id,
      purchaseOrderId: receiptLine.purchaseOrderId,
      purchaseOrderLineId: receiptLine.purchaseOrderLineId,
      receivedQuantity: formatProcurementQuantity(received),
      allocatedQuantity: formatProcurementQuantity(receiptAllocated),
      remainingQuantity: formatProcurementQuantity(receiptRemaining),
      status: receiptAllocationStatus(receiptAllocated, receiptRemaining),
      receiptStatus: receiptLine.goodsReceipt?.status || null,
      receivedAt: receiptLine.goodsReceipt?.receivedAt?.toISOString?.() || null,
    },
    commitmentLine: {
      supplierCommitmentId: commitmentLine.commitmentId,
      purchaseOrderId: commitmentLine.purchaseOrderId,
      purchaseOrderLineId: commitmentLine.purchaseOrderLineId,
      committedQuantity: formatProcurementQuantity(committed),
      allocatedQuantity: formatProcurementQuantity(commitmentAllocated),
      remainingQuantity: formatProcurementQuantity(commitmentRemaining),
      status: commitmentReceiptStatus(commitmentAllocated, commitmentRemaining),
      commitmentStatus: commitmentLine.commitment?.status || null,
      title: commitmentLine.commitment?.title || null,
      supplierLabel: commitmentLine.commitment?.supplier?.legalName || null,
    },
  };
}

function databaseConflict(error) {
  if (!CONFLICTING_DATABASE_CODES.has(error?.code)) return null;
  return new GoodsReceiptCommitmentAllocationError(
    'La asignación entró en conflicto con el saldo vigente. Recargá los datos antes de reintentar.',
    'GOODS_RECEIPT_COMMITMENT_ALLOCATION_CONFLICT',
    409,
  );
}

export async function createGoodsReceiptCommitmentAllocation(prisma, {
  scope: rawScope,
  actorId,
  operationKey,
  input,
} = {}) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId');
  const normalized = normalizeCreateInput(input, operationKey);

  try {
    return await runOperationalProjectMutation(prisma, current, async (transaction) => {
      const replay = await transaction.goodsReceiptCommitmentAllocation.findFirst({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          operationKey: normalized.operationKey,
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== normalized.requestFingerprint) {
          throw new GoodsReceiptCommitmentAllocationError(
            'El Idempotency-Key ya fue usado con otro contenido.',
            'IDEMPOTENCY_REPLAY_MUTATED',
            409,
          );
        }
        const replayContext = await loadAllocationContext(transaction, current, {
          goodsReceiptLineId: replay.goodsReceiptLineId,
          supplierCommitmentId: replay.supplierCommitmentId,
          requireAllocatable: false,
        });
        return {
          allocation: serializeGoodsReceiptCommitmentAllocation(replay),
          replayed: true,
          balances: await deriveSingleBalances(transaction, current, replayContext),
        };
      }

      const context = await loadAllocationContext(transaction, current, {
        goodsReceiptLineId: normalized.goodsReceiptLineId,
        supplierCommitmentId: normalized.supplierCommitmentId,
        requireAllocatable: true,
      });
      const before = await deriveSingleBalances(transaction, current, context);
      const receiptRemaining = storedQuantity(
        before.receiptLine.remainingQuantity,
        { allowZero: true },
      );
      const commitmentRemaining = storedQuantity(
        before.commitmentLine.remainingQuantity,
        { allowZero: true },
      );
      if (compareProcurementQuantities(normalized.quantityScaled, receiptRemaining) > 0) {
        throw new GoodsReceiptCommitmentAllocationError(
          'La asignación supera el saldo sin asignar de la línea de recepción.',
          'GOODS_RECEIPT_COMMITMENT_ALLOCATION_RECEIPT_EXCEEDED',
          409,
        );
      }
      if (compareProcurementQuantities(normalized.quantityScaled, commitmentRemaining) > 0) {
        throw new GoodsReceiptCommitmentAllocationError(
          'La asignación supera el saldo pendiente de la línea comprometida.',
          'GOODS_RECEIPT_COMMITMENT_ALLOCATION_COMMITMENT_EXCEEDED',
          409,
        );
      }

      const row = await transaction.goodsReceiptCommitmentAllocation.create({
        data: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          purchaseOrderId: context.receiptLine.purchaseOrderId,
          purchaseOrderLineId: context.receiptLine.purchaseOrderLineId,
          goodsReceiptId: context.receiptLine.goodsReceiptId,
          goodsReceiptLineId: context.receiptLine.id,
          supplierCommitmentId: context.commitmentLine.commitmentId,
          quantity: normalized.quantity,
          operationKey: normalized.operationKey,
          requestFingerprint: normalized.requestFingerprint,
          createdById: actor,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: current.organizationId,
          actorId: actor,
          action: 'goods_receipt_commitment_allocation.created',
          entityType: 'GoodsReceiptCommitmentAllocation',
          entityId: row.id,
          metadata: {
            projectId: current.projectId,
            purchaseOrderId: row.purchaseOrderId,
            purchaseOrderLineId: row.purchaseOrderLineId,
            goodsReceiptId: row.goodsReceiptId,
            goodsReceiptLineId: row.goodsReceiptLineId,
            supplierCommitmentId: row.supplierCommitmentId,
            quantity: normalized.quantity,
            operationKey: normalized.operationKey,
          },
        },
      });
      return {
        allocation: serializeGoodsReceiptCommitmentAllocation(row),
        replayed: false,
        balances: await deriveSingleBalances(transaction, current, context),
      };
    });
  } catch (error) {
    if (
      error instanceof GoodsReceiptCommitmentAllocationError
      || error?.name === 'ProjectWritePolicyError'
    ) throw error;
    throw databaseConflict(error) || error;
  }
}

function receiptLineBalance(row, aggregate) {
  const received = storedQuantity(row.quantity);
  const allocated = aggregateQuantity(aggregate);
  const remaining = remainingQuantity(received, allocated);
  return {
    goodsReceiptId: row.goodsReceiptId,
    goodsReceiptLineId: row.id,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    receivedQuantity: formatProcurementQuantity(received),
    allocatedQuantity: formatProcurementQuantity(allocated),
    remainingQuantity: formatProcurementQuantity(remaining),
    status: receiptAllocationStatus(allocated, remaining),
    receiptStatus: row.goodsReceipt?.status || null,
    receivedAt: row.goodsReceipt?.receivedAt?.toISOString?.() || null,
  };
}

function commitmentLineBalance(row, aggregate) {
  const committed = storedQuantity(row.quantity);
  const allocated = aggregateQuantity(aggregate);
  const remaining = remainingQuantity(committed, allocated);
  return {
    supplierCommitmentId: row.commitmentId,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    committedQuantity: formatProcurementQuantity(committed),
    allocatedQuantity: formatProcurementQuantity(allocated),
    remainingQuantity: formatProcurementQuantity(remaining),
    status: commitmentReceiptStatus(allocated, remaining),
    commitmentStatus: row.commitment?.status || null,
    title: row.commitment?.title || null,
    supplierLabel: row.commitment?.supplier?.legalName || null,
  };
}

export async function listGoodsReceiptCommitmentAllocations(prisma, {
  organizationId,
  projectId,
  purchaseOrderId,
  cursor,
  limit,
} = {}) {
  const current = scope({ organizationId, projectId });
  const orderId = text(purchaseOrderId, 'purchaseOrderId');
  const afterId = cursor ? text(cursor, 'cursor') : null;
  const take = normalizeLimit(limit);

  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.goodsReceiptCommitmentAllocation.findMany({
      where: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        purchaseOrderId: orderId,
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: take + 1,
    });
    const hasMore = rows.length > take;
    const pageRows = rows.slice(0, take);

    const [receiptLines, commitmentLines] = await Promise.all([
      transaction.goodsReceiptLine.findMany({
        where: {
          projectId: current.projectId,
          purchaseOrderId: orderId,
          goodsReceipt: {
            organizationId: current.organizationId,
            projectId: current.projectId,
            status: 'POSTED',
          },
        },
        select: {
          id: true,
          goodsReceiptId: true,
          purchaseOrderId: true,
          purchaseOrderLineId: true,
          quantity: true,
          goodsReceipt: {
            select: {
              status: true,
              receivedAt: true,
            },
          },
        },
        orderBy: { id: 'asc' },
        take: MAX_BALANCE_LINES_PER_ORDER + 1,
      }),
      transaction.supplierCommitmentLine.findMany({
        where: {
          projectId: current.projectId,
          purchaseOrderId: orderId,
          commitment: {
            organizationId: current.organizationId,
            projectId: current.projectId,
            kind: 'MATERIAL_DELIVERY',
          },
        },
        select: {
          commitmentId: true,
          purchaseOrderId: true,
          purchaseOrderLineId: true,
          quantity: true,
          commitment: {
            select: {
              status: true,
              title: true,
              supplier: {
                select: { legalName: true },
              },
            },
          },
        },
        orderBy: [
          { commitmentId: 'asc' },
          { purchaseOrderLineId: 'asc' },
        ],
        take: MAX_BALANCE_LINES_PER_ORDER + 1,
      }),
    ]);

    if (
      receiptLines.length > MAX_BALANCE_LINES_PER_ORDER
      || commitmentLines.length > MAX_BALANCE_LINES_PER_ORDER
    ) {
      throw new GoodsReceiptCommitmentAllocationError(
        'La orden supera el máximo de líneas que puede conciliarse en una sola consulta.',
        'GOODS_RECEIPT_COMMITMENT_ALLOCATION_BALANCE_SCOPE_TOO_LARGE',
        409,
      );
    }

    const [receiptAggregates, commitmentAggregates] = await Promise.all([
      transaction.goodsReceiptCommitmentAllocation.groupBy({
        by: ['goodsReceiptLineId'],
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          purchaseOrderId: orderId,
          goodsReceiptLineId: { in: receiptLines.map((line) => line.id) },
          goodsReceipt: { status: 'POSTED' },
        },
        _sum: { quantity: true },
      }),
      transaction.goodsReceiptCommitmentAllocation.groupBy({
        by: ['supplierCommitmentId', 'purchaseOrderLineId'],
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          purchaseOrderId: orderId,
          goodsReceipt: { status: 'POSTED' },
        },
        _sum: { quantity: true },
      }),
    ]);

    const receiptAggregateById = new Map(
      receiptAggregates.map((aggregate) => [aggregate.goodsReceiptLineId, aggregate]),
    );
    const commitmentAggregateByKey = new Map(
      commitmentAggregates.map((aggregate) => [
        `${aggregate.supplierCommitmentId}\u0000${aggregate.purchaseOrderLineId}`,
        aggregate,
      ]),
    );
    const serialized = pageRows.map(serializeGoodsReceiptCommitmentAllocation);
    return {
      allocations: serialized,
      receiptLineBalances: receiptLines.map((row) => receiptLineBalance(
        row,
        receiptAggregateById.get(row.id),
      )),
      commitmentLineBalances: commitmentLines.map((row) => commitmentLineBalance(
        row,
        commitmentAggregateByKey.get(`${row.commitmentId}\u0000${row.purchaseOrderLineId}`),
      )),
      hasMore,
      nextCursor: hasMore && serialized.length
        ? serialized[serialized.length - 1].id
        : null,
    };
  }, { isolationLevel: 'RepeatableRead' });
}

export function goodsReceiptCommitmentAllocationErrorResponse(error) {
  if (!(error instanceof GoodsReceiptCommitmentAllocationError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
