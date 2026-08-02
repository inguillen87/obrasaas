import { createHash } from 'node:crypto';

import {
  ProcurementQuantityError,
  formatProcurementQuantity,
  parseProcurementQuantity,
  subtractProcurementQuantities,
  sumProcurementQuantities,
} from './procurement-quantity.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const CLOSURE_KINDS = new Set(['FINAL_DELIVERY', 'REVERSAL']);
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_ALLOCATIONS_PER_LINE = 1_000;
const CONFLICTING_DATABASE_CODES = new Set([
  'P2002',
  'P2003',
  'P2004',
  'P2010',
  'P2025',
  'P2034',
]);

export class SupplierCommitmentLineClosureError extends Error {
  constructor(message, code = 'SUPPLIER_COMMITMENT_LINE_CLOSURE_INVALID', status = 400) {
    super(message);
    this.name = 'SupplierCommitmentLineClosureError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field, max = 190, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') {
    throw new SupplierCommitmentLineClosureError(`${field} debe ser texto.`);
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new SupplierCommitmentLineClosureError(`${field} es inválido.`);
  }
  return normalized;
}

function scope(value) {
  return {
    organizationId: text(value?.organizationId, 'organizationId'),
    projectId: text(value?.projectId, 'projectId'),
  };
}

function storedQuantity(value, { allowZero = false } = {}) {
  const candidate = typeof value === 'string' ? value : value?.toString?.();
  try {
    return parseProcurementQuantity(candidate, { allowZero });
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new SupplierCommitmentLineClosureError(
      'Las cantidades persistidas del compromiso o de sus inspecciones son inválidas.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_QUANTITY_CORRUPT',
      409,
    );
  }
}

function exactSum(values) {
  try {
    return sumProcurementQuantities(values);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new SupplierCommitmentLineClosureError(
      'La suma aceptada supera el límite exacto permitido.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_QUANTITY_CORRUPT',
      409,
    );
  }
}

function exactDifference(total, accepted) {
  try {
    return subtractProcurementQuantities(total, accepted);
  } catch (error) {
    if (!(error instanceof ProcurementQuantityError)) throw error;
    throw new SupplierCommitmentLineClosureError(
      'La cantidad aceptada supera la cantidad comprometida.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_QUANTITY_CORRUPT',
      409,
    );
  }
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeCreateInput(input, operationKey) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SupplierCommitmentLineClosureError('El cuerpo debe ser un objeto JSON.');
  }
  if (typeof input.kind !== 'string' || !CLOSURE_KINDS.has(input.kind)) {
    throw new SupplierCommitmentLineClosureError('kind es inválido.');
  }
  const normalized = {
    operationKey: text(operationKey, 'Idempotency-Key', 128),
    supplierCommitmentId: text(input.supplierCommitmentId, 'supplierCommitmentId'),
    purchaseOrderLineId: text(input.purchaseOrderLineId, 'purchaseOrderLineId'),
    kind: input.kind,
    predecessorId: text(input.predecessorId, 'predecessorId', 190, { optional: true }),
    reason: text(input.reason, 'reason', 500, { optional: true }),
  };
  if (normalized.kind === 'REVERSAL' && !normalized.reason) {
    throw new SupplierCommitmentLineClosureError(
      'REVERSAL requiere un motivo.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_REASON_REQUIRED',
      400,
    );
  }
  return {
    ...normalized,
    requestFingerprint: fingerprint({
      supplierCommitmentId: normalized.supplierCommitmentId,
      purchaseOrderLineId: normalized.purchaseOrderLineId,
      kind: normalized.kind,
      predecessorId: normalized.predecessorId,
      reason: normalized.reason,
    }),
  };
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_PAGE_SIZE;
  if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) {
    throw new SupplierCommitmentLineClosureError(
      `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_PAGE_INVALID',
      400,
    );
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new SupplierCommitmentLineClosureError(
      `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_PAGE_INVALID',
      400,
    );
  }
  return parsed;
}

function assertChainTransition(kind, predecessorId, head) {
  if (!head) {
    if (kind !== 'FINAL_DELIVERY' || predecessorId) {
      throw new SupplierCommitmentLineClosureError(
        'El primer evento de cierre debe ser FINAL_DELIVERY sin predecessorId.',
        'SUPPLIER_COMMITMENT_LINE_CLOSURE_CHAIN_CONFLICT',
        409,
      );
    }
    return 1;
  }
  if (predecessorId !== head.id) {
    throw new SupplierCommitmentLineClosureError(
      'El cierre cambió; usá como predecessorId la versión vigente.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_CHAIN_CONFLICT',
      409,
    );
  }
  const valid = head.kind === 'FINAL_DELIVERY'
    ? kind === 'REVERSAL'
    : kind === 'FINAL_DELIVERY';
  if (!valid) {
    throw new SupplierCommitmentLineClosureError(
      'La transición del cierre no es válida.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_CHAIN_CONFLICT',
      409,
    );
  }
  return head.version + 1;
}

async function deriveAcceptedQuantity(transaction, current, line) {
  const allocations = await transaction.goodsReceiptCommitmentAllocation.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      purchaseOrderId: line.purchaseOrderId,
      purchaseOrderLineId: line.purchaseOrderLineId,
      supplierCommitmentId: line.commitmentId,
      goodsReceipt: { status: 'POSTED' },
    },
    select: {
      id: true,
      goodsReceiptId: true,
      quantity: true,
    },
    orderBy: { id: 'asc' },
    take: MAX_ALLOCATIONS_PER_LINE + 1,
  });
  if (allocations.length > MAX_ALLOCATIONS_PER_LINE) {
    throw new SupplierCommitmentLineClosureError(
      `La línea supera ${MAX_ALLOCATIONS_PER_LINE} asignaciones y requiere conciliación asistida.`,
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_SCOPE_TOO_LARGE',
      409,
    );
  }
  if (!allocations.length) return 0n;
  const allocationIds = allocations.map((allocation) => allocation.id);
  const receiptIds = [...new Set(allocations.map((allocation) => allocation.goodsReceiptId))];
  const heads = await transaction.goodsReceiptInspection.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      purchaseOrderId: line.purchaseOrderId,
      goodsReceiptId: { in: receiptIds },
      successor: { is: null },
    },
    select: {
      goodsReceiptId: true,
      kind: true,
      dispositions: {
        where: {
          quality: 'ACCEPTED',
          allocationId: { in: allocationIds },
        },
        select: { allocationId: true, quantity: true },
      },
    },
  });
  const headByReceipt = new Map();
  for (const head of heads) {
    if (headByReceipt.has(head.goodsReceiptId)) {
      throw new SupplierCommitmentLineClosureError(
        'La cadena vigente de inspecciones es inconsistente.',
        'SUPPLIER_COMMITMENT_LINE_CLOSURE_INSPECTION_CORRUPT',
        409,
      );
    }
    headByReceipt.set(head.goodsReceiptId, head);
  }
  if (receiptIds.some((receiptId) => {
    const head = headByReceipt.get(receiptId);
    return !head || head.kind === 'REVERSAL';
  })) {
    throw new SupplierCommitmentLineClosureError(
      'Cada entrega documentada requiere una inspección activa antes del cierre final.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_INSPECTION_REQUIRED',
      409,
    );
  }
  return exactSum(heads
    .flatMap((head) => head.dispositions)
    .map((disposition) => storedQuantity(disposition.quantity)));
}

export function serializeSupplierCommitmentLineClosure(row) {
  return {
    id: row.id,
    projectId: row.projectId,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderLineId: row.purchaseOrderLineId,
    supplierCommitmentId: row.supplierCommitmentId,
    kind: row.kind,
    version: row.version,
    predecessorId: row.predecessorId || null,
    closedById: row.closedById,
    acceptedQuantity: row.acceptedQuantity === null || row.acceptedQuantity === undefined
      ? null
      : formatProcurementQuantity(storedQuantity(row.acceptedQuantity, { allowZero: true })),
    shortageQuantity: row.shortageQuantity === null || row.shortageQuantity === undefined
      ? null
      : formatProcurementQuantity(storedQuantity(row.shortageQuantity, { allowZero: true })),
    reason: row.reason || null,
    createdAt: row.createdAt?.toISOString?.() || null,
  };
}

function databaseConflict(error) {
  if (!CONFLICTING_DATABASE_CODES.has(error?.code)) return null;
  return new SupplierCommitmentLineClosureError(
    'El cierre entró en conflicto con el estado vigente. Recargá antes de reintentar.',
    'SUPPLIER_COMMITMENT_LINE_CLOSURE_CONFLICT',
    409,
  );
}

export async function createSupplierCommitmentLineClosure(prisma, {
  scope: rawScope,
  actorId,
  operationKey,
  input,
} = {}) {
  const current = scope(rawScope);
  const closerId = text(actorId, 'actorId');
  const normalized = normalizeCreateInput(input, operationKey);

  try {
    return await runOperationalProjectMutation(prisma, current, async (transaction) => {
      const replay = await transaction.supplierCommitmentLineClosure.findFirst({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          operationKey: normalized.operationKey,
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== normalized.requestFingerprint) {
          throw new SupplierCommitmentLineClosureError(
            'El Idempotency-Key ya fue usado con otro contenido.',
            'IDEMPOTENCY_REPLAY_MUTATED',
            409,
          );
        }
        return { closure: serializeSupplierCommitmentLineClosure(replay), replayed: true };
      }

      const line = await transaction.supplierCommitmentLine.findFirst({
        where: {
          commitmentId: normalized.supplierCommitmentId,
          purchaseOrderLineId: normalized.purchaseOrderLineId,
          projectId: current.projectId,
          commitment: {
            organizationId: current.organizationId,
            projectId: current.projectId,
          },
        },
        select: {
          commitmentId: true,
          projectId: true,
          purchaseOrderId: true,
          purchaseOrderLineId: true,
          quantity: true,
          commitment: { select: { kind: true, status: true } },
        },
      });
      if (!line) {
        throw new SupplierCommitmentLineClosureError(
          'La línea comprometida no pertenece a la obra activa.',
          'SUPPLIER_COMMITMENT_LINE_CLOSURE_SCOPE',
          409,
        );
      }
      if (
        normalized.kind === 'FINAL_DELIVERY'
        && (
          line.commitment.kind !== 'MATERIAL_DELIVERY'
          || line.commitment.status === 'CANCELLED'
        )
      ) {
        throw new SupplierCommitmentLineClosureError(
          'Sólo una entrega material no cancelada puede cerrarse.',
          'SUPPLIER_COMMITMENT_LINE_CLOSURE_COMMITMENT_INVALID',
          409,
        );
      }

      const head = await transaction.supplierCommitmentLineClosure.findFirst({
        where: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          purchaseOrderId: line.purchaseOrderId,
          supplierCommitmentId: line.commitmentId,
          purchaseOrderLineId: line.purchaseOrderLineId,
        },
        orderBy: { version: 'desc' },
        select: { id: true, kind: true, version: true },
      });
      const version = assertChainTransition(normalized.kind, normalized.predecessorId, head);

      let acceptedQuantity = null;
      let shortageQuantity = null;
      if (normalized.kind === 'FINAL_DELIVERY') {
        const committed = storedQuantity(line.quantity);
        const accepted = await deriveAcceptedQuantity(transaction, current, line);
        const shortage = exactDifference(committed, accepted);
        acceptedQuantity = formatProcurementQuantity(accepted);
        shortageQuantity = formatProcurementQuantity(shortage);
        if (shortage > 0n && !normalized.reason) {
          throw new SupplierCommitmentLineClosureError(
            'Un cierre con faltante requiere un motivo.',
            'SUPPLIER_COMMITMENT_LINE_CLOSURE_SHORTAGE_REASON_REQUIRED',
            400,
          );
        }
      }

      const created = await transaction.supplierCommitmentLineClosure.create({
        data: {
          organizationId: current.organizationId,
          projectId: current.projectId,
          purchaseOrderId: line.purchaseOrderId,
          purchaseOrderLineId: line.purchaseOrderLineId,
          supplierCommitmentId: line.commitmentId,
          kind: normalized.kind,
          version,
          predecessorId: normalized.predecessorId,
          operationKey: normalized.operationKey,
          requestFingerprint: normalized.requestFingerprint,
          closedById: closerId,
          acceptedQuantity,
          shortageQuantity,
          reason: normalized.reason,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: current.organizationId,
          actorId: closerId,
          action: normalized.kind === 'FINAL_DELIVERY'
            ? 'supplier_commitment_line.closed'
            : 'supplier_commitment_line.reopened',
          entityType: 'SupplierCommitmentLineClosure',
          entityId: created.id,
          metadata: {
            projectId: current.projectId,
            purchaseOrderId: line.purchaseOrderId,
            supplierCommitmentId: line.commitmentId,
            purchaseOrderLineId: line.purchaseOrderLineId,
            version,
            acceptedQuantity,
            shortageQuantity,
          },
        },
      });
      return { closure: serializeSupplierCommitmentLineClosure(created), replayed: false };
    });
  } catch (error) {
    if (
      error instanceof SupplierCommitmentLineClosureError
      || error?.name === 'ProjectWritePolicyError'
    ) throw error;
    throw databaseConflict(error) || error;
  }
}

export async function listSupplierCommitmentLineClosures(prisma, {
  organizationId,
  projectId,
  purchaseOrderId,
  supplierCommitmentId,
  purchaseOrderLineId,
  cursor,
  limit,
} = {}) {
  const current = scope({ organizationId, projectId });
  const orderId = text(purchaseOrderId, 'purchaseOrderId');
  const commitmentId = text(
    supplierCommitmentId,
    'supplierCommitmentId',
    190,
    { optional: true },
  );
  const orderLineId = text(
    purchaseOrderLineId,
    'purchaseOrderLineId',
    190,
    { optional: true },
  );
  if (Boolean(commitmentId) !== Boolean(orderLineId)) {
    throw new SupplierCommitmentLineClosureError(
      'supplierCommitmentId y purchaseOrderLineId deben enviarse juntos.',
      'SUPPLIER_COMMITMENT_LINE_CLOSURE_QUERY_SCOPE_INVALID',
      400,
    );
  }
  const afterId = text(cursor, 'cursor', 190, { optional: true });
  const take = normalizeLimit(limit);
  const rows = await prisma.supplierCommitmentLineClosure.findMany({
    where: {
      organizationId: current.organizationId,
      projectId: current.projectId,
      purchaseOrderId: orderId,
      ...(commitmentId ? {
        supplierCommitmentId: commitmentId,
        purchaseOrderLineId: orderLineId,
      } : {}),
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { id: 'asc' },
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take).map(serializeSupplierCommitmentLineClosure);
  return {
    closures: page,
    hasMore,
    nextCursor: hasMore && page.length ? page[page.length - 1].id : null,
  };
}

export function supplierCommitmentLineClosureErrorResponse(error) {
  if (!(error instanceof SupplierCommitmentLineClosureError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
