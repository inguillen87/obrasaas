import { createHash } from 'node:crypto';

import {
  calculateProcurementOrderTotal,
  formatProcurementMoney,
  parseProcurementMoney,
  ProcurementMoneyError,
} from './procurement-money.js';
import {
  formatProcurementQuantity,
  parseProcurementQuantity,
  ProcurementQuantityError,
} from './procurement-quantity.js';
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

function quantity(value) {
  try {
    const scaled = parseProcurementQuantity(value);
    return { scaled, canonical: formatProcurementQuantity(scaled) };
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new PurchaseOrderError(
      'quantity inválida: debe enviarse como texto positivo con hasta tres decimales.',
      'PURCHASE_ORDER_QUANTITY_INVALID',
    );
  }
}

function unitPrice(value) {
  try {
    const scaled = parseProcurementMoney(value, { allowZero: true });
    return { scaled, canonical: formatProcurementMoney(scaled) };
  } catch (error) {
    if (!(error instanceof ProcurementMoneyError)) throw error;
    throw new PurchaseOrderError(
      'unitPrice inválido: debe enviarse como texto no negativo con hasta dos decimales.',
      'PURCHASE_ORDER_UNIT_PRICE_INVALID',
    );
  }
}

function storedDecimalText(value, field) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  if (typeof candidate !== 'string') {
    throw new PurchaseOrderError(
      `${field} persistido inválido.`,
      'PURCHASE_ORDER_DECIMAL_CORRUPT',
      409,
    );
  }
  return candidate;
}

function storedQuantity(value) {
  try {
    return formatProcurementQuantity(
      parseProcurementQuantity(storedDecimalText(value, 'quantity')),
    );
  } catch (error) {
    if (error instanceof PurchaseOrderError) throw error;
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new PurchaseOrderError(
      'quantity persistido inválido.',
      'PURCHASE_ORDER_DECIMAL_CORRUPT',
      409,
    );
  }
}

function storedMoney(value, field) {
  try {
    return formatProcurementMoney(
      parseProcurementMoney(storedDecimalText(value, field), { allowZero: true }),
    );
  } catch (error) {
    if (error instanceof PurchaseOrderError) throw error;
    if (!(error instanceof ProcurementMoneyError)) throw error;
    throw new PurchaseOrderError(
      `${field} persistido inválido.`,
      'PURCHASE_ORDER_DECIMAL_CORRUPT',
      409,
    );
  }
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
    total: storedMoney(row.total, 'total'),
    lines: row.lines?.map((line) => ({
      ...line,
      quantity: storedQuantity(line.quantity),
      unitPrice: storedMoney(line.unitPrice, 'unitPrice'),
    })),
  };
}

function canonicalLine(line) {
  return {
    budgetLineId: line.budgetLineId || null,
    costCode: line.costCode || null,
    description: line.description,
    quantity: storedQuantity(line.quantity),
    unit: line.unit,
    unitPrice: storedMoney(line.unitPrice, 'unitPrice'),
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
  const calculationLines = lines.map((line) => {
    const normalizedQuantity = quantity(line.quantity);
    const normalizedUnitPrice = unitPrice(line.unitPrice);
    return {
      description: text(line.description, 'description', 220),
      unit: text(line.unit, 'unit', 32),
      quantity: normalizedQuantity.canonical,
      quantityScaled: normalizedQuantity.scaled,
      unitPrice: normalizedUnitPrice.canonical,
      unitPriceScaled: normalizedUnitPrice.scaled,
      costCode: line.costCode ? text(line.costCode, 'costCode', 96) : null,
      budgetLineId: line.budgetLineId
        ? text(line.budgetLineId, 'budgetLineId', 190)
        : null,
    };
  });
  let total;
  try {
    total = formatProcurementMoney(calculateProcurementOrderTotal(calculationLines));
  } catch (error) {
    if (!(error instanceof ProcurementMoneyError)) throw error;
    throw new PurchaseOrderError(
      'El total de la orden supera el máximo permitido para Decimal(14,2).',
      'PURCHASE_ORDER_TOTAL_OVERFLOW',
    );
  }
  const normalized = calculationLines.map(({
    quantityScaled: _quantityScaled,
    unitPriceScaled: _unitPriceScaled,
    ...line
  }) => line);

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
