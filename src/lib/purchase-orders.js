import { createHash } from 'node:crypto';

import { runOperationalProjectMutation } from './project-write-policy.js';

export class PurchaseOrderError extends Error {
  constructor(message, code = 'PURCHASE_ORDER_INVALID', status = 400) {
    super(message);
    this.name = 'PurchaseOrderError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new PurchaseOrderError(`${field} inválido.`);
  }
  return value.trim();
}

function decimal(value, field, min, scale) {
  const normalized = Number(value);
  const factor = 10 ** scale;
  if (
    !Number.isFinite(normalized)
    || normalized < min
    || normalized > 999999999999
    || Math.abs(normalized * factor - Math.round(normalized * factor)) > 1e-6
  ) {
    throw new PurchaseOrderError(`${field} inválido.`);
  }
  return normalized;
}

function currency(value) {
  const normalized = text(value, 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new PurchaseOrderError('currency inválida.');
  }
  return normalized;
}

function scope(value) {
  if (!value?.organizationId || !value?.projectId) {
    throw new PurchaseOrderError('Alcance incompleto.');
  }
  return value;
}

function serialize(row) {
  return {
    ...row,
    total: row.total?.toString?.() ?? null,
    lines: row.lines?.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
    })),
  };
}

function canonicalLine(line) {
  return {
    budgetLineId: line.budgetLineId || null,
    costCode: line.costCode || null,
    description: line.description,
    quantity: Number(line.quantity).toFixed(3),
    unit: line.unit,
    unitPrice: Number(line.unitPrice).toFixed(2),
  };
}

function canonicalLines(lines) {
  return lines
    .map(canonicalLine)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function requestFingerprint({ supplierId, number, currency: currencyCode, lines }) {
  return createHash('sha256').update(JSON.stringify({
    supplierId,
    number,
    currency: currencyCode,
    lines: canonicalLines(lines),
  })).digest('hex');
}

export async function listPurchaseOrders(prisma, { organizationId, projectId }) {
  const rows = await prisma.purchaseOrder.findMany({
    where: { organizationId, projectId },
    include: {
      lines: true,
      supplier: { select: { id: true, legalName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return { purchaseOrders: rows.map(serialize) };
}

export async function createPurchaseOrder(
  prisma,
  { scope: rawScope, actorId, input },
) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId', 190);
  const operationKey = text(input.operationKey, 'operationKey', 190);
  const supplierId = text(input.supplierId, 'supplierId', 190);
  const numberValue = text(input.number, 'number', 64);
  const requestedCurrency = input.currency ? currency(input.currency) : null;
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (!lines.length) {
    throw new PurchaseOrderError('La orden requiere al menos una línea.');
  }
  const normalized = lines.map((line) => ({
    description: text(line.description, 'description', 220),
    unit: text(line.unit, 'unit', 32),
    quantity: decimal(line.quantity, 'quantity', 0.001, 3),
    unitPrice: decimal(line.unitPrice, 'unitPrice', 0, 2),
    costCode: line.costCode ? text(line.costCode, 'costCode', 96) : null,
    budgetLineId: line.budgetLineId
      ? text(line.budgetLineId, 'budgetLineId', 190)
      : null,
  }));
  const total = normalized.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );

  return runOperationalProjectMutation(prisma, current, async (transaction) => {
    const replay = await transaction.purchaseOrder.findFirst({
      where: { projectId: current.projectId, operationKey },
      include: {
        lines: true,
        supplier: { select: { id: true, legalName: true } },
      },
    });
    if (replay) {
      const expected = requestFingerprint({
        supplierId,
        number: numberValue,
        currency: requestedCurrency || replay.currency,
        lines: normalized,
      });
      const stored = requestFingerprint({
        supplierId: replay.supplierId,
        number: replay.number,
        currency: replay.currency,
        lines: replay.lines,
      });
      if (expected !== stored) {
        throw new PurchaseOrderError(
          'La operationKey ya fue usada con otro contenido.',
          'IDEMPOTENCY_REPLAY_MUTATED',
          409,
        );
      }
      return { purchaseOrder: serialize(replay), replayed: true };
    }

    for (const line of normalized.filter((entry) => entry.budgetLineId)) {
      const budgetLine = await transaction.budgetLine.findFirst({
        where: { id: line.budgetLineId, projectId: current.projectId },
      });
      if (!budgetLine) {
        throw new PurchaseOrderError(
          'La línea presupuestaria no pertenece a la obra.',
          'PURCHASE_BUDGET_LINE_SCOPE',
          409,
        );
      }
    }

    const supplier = await transaction.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: current.organizationId,
        active: true,
      },
    });
    if (!supplier) {
      throw new PurchaseOrderError(
        'Proveedor inválido o inactivo.',
        'PURCHASE_SUPPLIER_SCOPE',
        409,
      );
    }
    const currencyCode = requestedCurrency || currency(supplier.currency);
    const row = await transaction.purchaseOrder.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        supplierId: supplier.id,
        operationKey,
        number: numberValue,
        currency: currencyCode,
        total,
        lines: {
          create: normalized.map((line) => ({
            ...line,
            projectId: current.projectId,
          })),
        },
      },
      include: {
        lines: true,
        supplier: { select: { id: true, legalName: true } },
      },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: 'purchase_order.created',
        entityType: 'PurchaseOrder',
        entityId: row.id,
        metadata: {
          projectId: current.projectId,
          supplierId: supplier.id,
          operationKey,
          total,
        },
      },
    });
    return { purchaseOrder: serialize(row), replayed: false };
  });
}

export async function decidePurchaseOrder(
  prisma,
  { scope: rawScope, actorId, id, expectedRevision, status },
) {
  const current = scope(rawScope);
  const actor = text(actorId, 'actorId', 190);
  const revision = Number(expectedRevision);
  if (
    !Number.isSafeInteger(revision)
    || revision < 0
    || !['SUBMITTED', 'APPROVED', 'CANCELLED'].includes(status)
  ) {
    throw new PurchaseOrderError('Decisión inválida.');
  }
  return runOperationalProjectMutation(prisma, current, async (transaction) => {
    const order = await transaction.purchaseOrder.findFirst({
      where: {
        id,
        organizationId: current.organizationId,
        projectId: current.projectId,
        revision,
        status: { in: ['DRAFT', 'SUBMITTED'] },
      },
      include: { lines: true },
    });
    if (!order) {
      throw new PurchaseOrderError(
        'La orden cambió o ya fue decidida.',
        'PURCHASE_ORDER_CONFLICT',
        409,
      );
    }
    if (
      status === 'APPROVED'
      && order.lines.some((line) => !line.budgetLineId)
    ) {
      throw new PurchaseOrderError(
        'Todas las líneas deben vincularse a presupuesto antes de aprobar.',
        'PURCHASE_BUDGET_LINK_REQUIRED',
        409,
      );
    }
    const result = await transaction.purchaseOrder.updateMany({
      where: {
        id,
        organizationId: current.organizationId,
        projectId: current.projectId,
        revision,
        status: { in: ['DRAFT', 'SUBMITTED'] },
      },
      data: { status, revision: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new PurchaseOrderError(
        'La orden cambió o ya fue decidida.',
        'PURCHASE_ORDER_CONFLICT',
        409,
      );
    }
    await transaction.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: 'purchase_order.decided',
        entityType: 'PurchaseOrder',
        entityId: id,
        metadata: {
          projectId: current.projectId,
          status,
          revision: revision + 1,
        },
      },
    });
    return { status, revision: revision + 1 };
  });
}

export function purchaseOrderErrorResponse(error) {
  if (!(error instanceof PurchaseOrderError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
