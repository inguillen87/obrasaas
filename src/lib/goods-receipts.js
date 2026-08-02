import { runOperationalProjectMutation } from './project-write-policy.js';
import {
  assertProtectedUploadReplay,
  claimProtectedUpload,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadClaimFingerprint,
  publicProtectedAttachment,
} from './protected-uploads.js';

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
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 999999999) {
    throw new GoodsReceiptError('quantity inválida.');
  }
  return number;
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
          quantity: line.quantity?.toString?.() ?? null,
        }))
      : undefined,
  };
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
  const normalizedLines = requested.map((entry) => ({
    purchaseOrderLineId: text(entry.purchaseOrderLineId, 'purchaseOrderLineId', 190),
    quantity: quantity(entry.quantity),
  }));
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
    lines: normalizedLines,
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
      return { receipt: serializeGoodsReceipt(replay), replayed: true };
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
      const already = line.receiptLines.reduce(
        (sum, receiptLine) => sum + Number(receiptLine.quantity),
        0,
      );
      if (already + entry.quantity > Number(line.quantity)) {
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

    const totals = order.lines.map((line) => {
      const receivedBefore = line.receiptLines.reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
      );
      const added = lines.find(
        (item) => item.purchaseOrderLineId === line.id,
      )?.quantity || 0;
      return receivedBefore + added >= Number(line.quantity);
    });
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
    return { receipt: serializeGoodsReceipt(row), replayed: false };
  });
}

export function goodsReceiptErrorResponse(error) {
  if (!(error instanceof GoodsReceiptError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
