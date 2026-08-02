import { runOperationalProjectMutation } from './project-write-policy.js';
import {
  assertProtectedUploadReplay,
  claimProtectedUpload,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadClaimFingerprint,
  publicProtectedAttachment,
} from './protected-uploads.js';
import {
  ProcurementQuantityError,
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  subtractProcurementQuantities,
  sumProcurementQuantities,
} from './procurement-quantity.js';

const MAX_BALANCE_PURCHASE_ORDERS = 500;

export class GoodsReceiptError extends Error {
  constructor(message, code = 'GOODS_RECEIPT_INVALID', status = 400) {
    super(message);
    this.name = 'GoodsReceiptError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new GoodsReceiptError(`${field} inválido.`);
  }
  return value.trim();
}

function quantity(value) {
  try {
    const scaled = parseProcurementQuantity(value);
    return {
      scaled,
      canonical: formatProcurementQuantity(scaled),
    };
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptError(
      'quantity inválida: debe ser positiva y tener hasta tres decimales.',
      'GOODS_RECEIPT_QUANTITY_INVALID',
      400,
    );
  }
}

function storedQuantity(value, { allowZero = false } = {}) {
  const candidate = typeof value === 'string'
    ? value
    : value?.toString?.();
  try {
    return parseProcurementQuantity(candidate, { allowZero });
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptError(
      'Las cantidades persistidas de la orden o sus recepciones son inválidas.',
      'GOODS_RECEIPT_QUANTITY_CORRUPT',
      409,
    );
  }
}

function lineBalance(line, added = 0n) {
  const ordered = storedQuantity(line.quantity);
  let receivedPosted;
  try {
    receivedPosted = sumProcurementQuantities([
      receivedQuantity(line.receiptLines || []),
      added,
    ]);
  } catch (error) {
    if (error instanceof GoodsReceiptError) throw error;
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptError(
      'La cantidad recibida acumulada supera los límites permitidos.',
      'GOODS_RECEIPT_QUANTITY_CORRUPT',
      409,
    );
  }

  let remainingToReceive;
  try {
    remainingToReceive = subtractProcurementQuantities(ordered, receivedPosted);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptError(
      'Las recepciones persistidas ya superan la cantidad ordenada.',
      'GOODS_RECEIPT_QUANTITY_CORRUPT',
      409,
    );
  }

  return {
    purchaseOrderId: line.purchaseOrderId,
    purchaseOrderLineId: line.id,
    ordered: formatProcurementQuantity(ordered),
    receivedPosted: formatProcurementQuantity(receivedPosted),
    remainingToReceive: formatProcurementQuantity(remainingToReceive),
  };
}

function orderLineBalances(lines, additions = new Map()) {
  return lines.map((line) => lineBalance(line, additions.get(line.id) || 0n));
}

function receivedQuantity(receiptLines) {
  try {
    return sumProcurementQuantities(
      receiptLines.map((line) => storedQuantity(line.quantity)),
    );
  } catch (error) {
    if (error instanceof GoodsReceiptError) throw error;
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new GoodsReceiptError(
      'La cantidad recibida acumulada supera los límites permitidos.',
      'GOODS_RECEIPT_QUANTITY_CORRUPT',
      409,
    );
  }
}

function scope(value) {
  if (!value?.organizationId || !value?.projectId) {
    throw new GoodsReceiptError('Alcance incompleto.');
  }
  return value;
}

export function serializeGoodsReceipt(row) {
  const {
    protectedUploadId: _protectedUploadId,
    requestFingerprint: _requestFingerprint,
    receipt,
    ...publicRow
  } = row;
  return {
    ...publicRow,
    receipt: publicProtectedAttachment(receipt),
    receivedAt: row.receivedAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
    lines: Array.isArray(row.lines)
      ? row.lines.map((line) => ({
          ...line,
          quantity: formatProcurementQuantity(storedQuantity(line.quantity)),
        }))
      : undefined,
  };
}

export async function listGoodsReceiptLineBalances(
  prisma,
  { organizationId, projectId, purchaseOrderIds },
) {
  const current = scope({ organizationId, projectId });
  if (
    !Array.isArray(purchaseOrderIds)
    || purchaseOrderIds.length > MAX_BALANCE_PURCHASE_ORDERS
    || purchaseOrderIds.some((id) => typeof id !== 'string' || !id)
  ) {
    throw new GoodsReceiptError(
      `Los saldos requieren hasta ${MAX_BALANCE_PURCHASE_ORDERS} órdenes explícitas.`,
      'GOODS_RECEIPT_BALANCE_SCOPE_INVALID',
      400,
    );
  }
  const orderIds = [...new Set(purchaseOrderIds)];
  if (orderIds.length === 0) return [];

  const lines = await prisma.purchaseOrderLine.findMany({
    where: {
      projectId: current.projectId,
      purchaseOrderId: { in: orderIds },
      purchaseOrder: {
        organizationId: current.organizationId,
        status: { in: ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
      },
    },
    select: {
      id: true,
      purchaseOrderId: true,
      quantity: true,
    },
    orderBy: { id: 'asc' },
  });
  if (lines.length === 0) return [];

  const aggregates = await prisma.goodsReceiptLine.groupBy({
    by: ['purchaseOrderLineId'],
    where: {
      projectId: current.projectId,
      purchaseOrderId: { in: orderIds },
      goodsReceipt: {
        organizationId: current.organizationId,
        status: 'POSTED',
      },
    },
    _sum: { quantity: true },
  });
  const receivedByLine = new Map(aggregates.map((aggregate) => [
    aggregate.purchaseOrderLineId,
    aggregate._sum.quantity,
  ]));
  return lines.map((line) => lineBalance({
    ...line,
    receiptLines: receivedByLine.has(line.id)
      ? [{ quantity: receivedByLine.get(line.id) }]
      : [],
  }));
}

export async function createGoodsReceipt(
  prisma,
  { scope: rawScope, actorId, input },
) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId', 190);
  const operationKey = text(input.operationKey, 'operationKey', 190);
  if (input.receipt !== undefined && input.receipt !== null) {
    throw new GoodsReceiptError(
      'El comprobante debe referenciarse únicamente mediante uploadId.',
      'GOODS_RECEIPT_DESCRIPTOR_FORBIDDEN',
    );
  }
  const requested = Array.isArray(input.lines) ? input.lines : [];
  if (!requested.length) throw new GoodsReceiptError('La recepción requiere líneas.');
  const normalizedLines = requested.map((entry) => {
    const normalizedQuantity = quantity(entry.quantity);
    return {
      purchaseOrderLineId: text(entry.purchaseOrderLineId, 'purchaseOrderLineId', 190),
      quantity: normalizedQuantity.canonical,
      quantityScaled: normalizedQuantity.scaled,
    };
  });
  if (new Set(normalizedLines.map((line) => line.purchaseOrderLineId)).size !== normalizedLines.length) {
    throw new GoodsReceiptError(
      'Una línea de la orden no puede repetirse en la misma recepción.',
      'GOODS_RECEIPT_DUPLICATE_LINE',
      400,
    );
  }
  const notes = input.notes ? text(input.notes, 'notes', 500) : null;
  const uploadId = input.uploadId ? text(input.uploadId, 'uploadId', 190) : null;
  const requestFingerprint = protectedUploadClaimFingerprint({
    purchaseOrderId: input.purchaseOrderId,
    notes,
    lines: normalizedLines.map(({ purchaseOrderLineId, quantity: canonicalQuantity }) => ({
      purchaseOrderLineId,
      quantity: canonicalQuantity,
    })),
    uploadId,
  });

  return runOperationalProjectMutation(prisma, current, async (transaction) => {
    const replay = await transaction.goodsReceipt.findFirst({
      where: { projectId: current.projectId, operationKey },
      include: { lines: true },
    });
    if (replay) {
      if (replay.requestFingerprint && replay.requestFingerprint !== requestFingerprint) {
        throw new GoodsReceiptError(
          'La operationKey ya fue usada con otro contenido.',
          'IDEMPOTENCY_REPLAY_MUTATED',
          409,
        );
      }
      if (!replay.requestFingerprint && uploadId) {
        throw new GoodsReceiptError(
          'La operación legacy no admite vincular una carga en el reintento.',
          'IDEMPOTENCY_REPLAY_MUTATED',
          409,
        );
      }
      if (replay.requestFingerprint) {
        await assertProtectedUploadReplay(transaction, {
          scope: current,
          actorId: actor,
          purpose: PROTECTED_UPLOAD_PURPOSE.GOODS,
          uploadId,
          entityId: replay.id,
          entityProtectedUploadId: replay.protectedUploadId,
          claimFingerprint: requestFingerprint,
          entityHasAttachment: Boolean(replay.receipt),
        });
      }
      const replayOrder = await transaction.purchaseOrder.findFirst({
        where: {
          id: replay.purchaseOrderId,
          organizationId: current.organizationId,
          projectId: current.projectId,
        },
        include: {
          lines: {
            include: {
              receiptLines: { where: { goodsReceipt: { status: 'POSTED' } } },
            },
          },
        },
      });
      if (!replayOrder) {
        throw new GoodsReceiptError(
          'La orden de la recepción reintentada ya no está disponible.',
          'GOODS_RECEIPT_ORDER_SCOPE',
          409,
        );
      }
      return {
        receipt: serializeGoodsReceipt(replay),
        replayed: true,
        lineBalances: orderLineBalances(replayOrder.lines),
      };
    }

    const order = await transaction.purchaseOrder.findFirst({
      where: {
        id: input.purchaseOrderId,
        projectId: current.projectId,
        status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
      },
      include: {
        lines: {
          include: {
            receiptLines: { where: { goodsReceipt: { status: 'POSTED' } } },
          },
        },
      },
    });
    if (!order) {
      throw new GoodsReceiptError(
        'Orden no encontrada o no habilitada para recepción.',
        'GOODS_RECEIPT_ORDER_SCOPE',
        409,
      );
    }
    const lines = normalizedLines.map((entry) => {
      const line = order.lines.find(
        (candidate) => candidate.id === entry.purchaseOrderLineId,
      );
      if (!line) {
        throw new GoodsReceiptError(
          'La línea no pertenece a la orden.',
          'GOODS_RECEIPT_LINE_SCOPE',
          409,
        );
      }
      const already = receivedQuantity(line.receiptLines);
      const ordered = storedQuantity(line.quantity);
      let remaining;
      try {
        remaining = subtractProcurementQuantities(ordered, already);
      } catch (error) {
        if (!(error instanceof ProcurementQuantityError)) throw error;
        throw new GoodsReceiptError(
          'Las recepciones persistidas ya superan la cantidad ordenada.',
          'GOODS_RECEIPT_QUANTITY_CORRUPT',
          409,
        );
      }
      if (compareProcurementQuantities(entry.quantityScaled, remaining) > 0) {
        throw new GoodsReceiptError(
          'La recepción supera la cantidad ordenada.',
          'GOODS_RECEIPT_OVER_RECEIVE',
          409,
        );
      }
      return {
        projectId: current.projectId,
        purchaseOrderId: order.id,
        purchaseOrderLineId: line.id,
        quantity: entry.quantity,
      };
    });
    const createRow = (storedReceipt, protectedUploadId = null) => transaction.goodsReceipt.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        purchaseOrderId: order.id,
        operationKey,
        receivedById: actor,
        notes,
        receipt: storedReceipt,
        protectedUploadId,
        requestFingerprint,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    const row = uploadId
      ? await claimProtectedUpload(transaction, {
          scope: current,
          actorId: actor,
          purpose: PROTECTED_UPLOAD_PURPOSE.GOODS,
          uploadId,
          claimFingerprint: requestFingerprint,
          createEntity: (descriptor) => createRow(descriptor, uploadId),
        })
      : await createRow(undefined);

    const addedByLine = new Map(
      normalizedLines.map((line) => [line.purchaseOrderLineId, line.quantityScaled]),
    );
    const lineBalances = orderLineBalances(order.lines, addedByLine);
    const totals = lineBalances.map((balance) => (
      storedQuantity(balance.remainingToReceive, { allowZero: true }) === 0n
    ));
    const nextOrderStatus = totals.every(Boolean) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    const orderUpdated = await transaction.purchaseOrder.updateMany({
      where: {
        id: order.id,
        projectId: current.projectId,
        status: order.status,
        revision: order.revision,
      },
      data: {
        status: nextOrderStatus,
        revision: { increment: 1 },
      },
    });
    if (orderUpdated.count !== 1) {
      throw new GoodsReceiptError(
        'La orden cambió durante la recepción; volvé a cargarla antes de continuar.',
        'GOODS_RECEIPT_ORDER_CONFLICT',
        409,
      );
    }
    await transaction.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: 'goods_receipt.created',
        entityType: 'GoodsReceipt',
        entityId: row.id,
        metadata: {
          projectId: current.projectId,
          purchaseOrderId: order.id,
          operationKey,
        },
      },
    });
    return {
      receipt: serializeGoodsReceipt(row),
      replayed: false,
      lineBalances,
    };
  });
}

export function goodsReceiptErrorResponse(error) {
  if (!(error instanceof GoodsReceiptError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
