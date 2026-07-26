import { runOperationalProjectMutation } from "./project-write-policy.js";
import {
  assertProtectedUploadReplay,
  claimProtectedUpload,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadClaimFingerprint,
  publicProtectedAttachment,
} from "./protected-uploads.js";
export class SupplierInvoiceError extends Error {
  constructor(message, code = "SUPPLIER_INVOICE_INVALID", status = 400) {
    super(message);
    this.name = "SupplierInvoiceError";
    this.code = code;
    this.status = status;
  }
}
function text(v, f, max) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new SupplierInvoiceError(`${f} inválido.`);
  return v.trim();
}
function amount(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 999999999999)
    throw new SupplierInvoiceError("amount inválido.");
  return n;
}
function dueDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new SupplierInvoiceError("Fecha de vencimiento inválida.");
  return parsed;
}
function scope(v) {
  if (!v?.organizationId || !v?.projectId)
    throw new SupplierInvoiceError("Alcance incompleto.");
  return v;
}
export function serializeSupplierInvoice(row) {
  const {
    protectedUploadId: _protectedUploadId,
    requestFingerprint: _requestFingerprint,
    receipt,
    ...publicRow
  } = row;
  return {
    ...publicRow,
    receipt: publicProtectedAttachment(receipt),
    amount: row.amount?.toString?.() ?? null,
    dueAt: row.dueAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}
async function threeWayMatch(tx, invoice) {
  if (!invoice.purchaseOrderId) return;
  const order = await tx.purchaseOrder.findFirst({
    where: {
      id: invoice.purchaseOrderId,
      projectId: invoice.projectId,
      organizationId: invoice.organizationId,
    },
    select: {
      currency: true,
      lines: {
        select: {
          unitPrice: true,
          receiptLines: {
            where: { goodsReceipt: { status: "POSTED" } },
            select: { quantity: true },
          },
        },
      },
    },
  });
  if (!order)
    throw new SupplierInvoiceError(
      "La orden vinculada no existe.",
      "SUPPLIER_INVOICE_ORDER_MISSING",
      409,
    );
  const receivedValue = order.lines.reduce(
    (total, line) =>
      total +
      Number(line.unitPrice) *
        line.receiptLines.reduce(
          (sum, receiptLine) => sum + Number(receiptLine.quantity),
          0,
        ),
    0,
  );
  const prior = await tx.supplierInvoice.aggregate({
    where: {
      purchaseOrderId: invoice.purchaseOrderId,
      projectId: invoice.projectId,
      status: { in: ["APPROVED", "PAID"] },
      id: { not: invoice.id },
    },
    _sum: { amount: true },
  });
  const summary = computeMatchSummary(
    receivedValue,
    Number(prior._sum.amount || 0),
    Number(invoice.amount),
    invoice.currency,
  );
  if (!summary.matched)
    throw new SupplierInvoiceError(
      `La factura supera el valor efectivamente recibido (${receivedValue.toFixed(2)} ${invoice.currency}).`,
      "SUPPLIER_INVOICE_RECEIPT_MISMATCH",
      409,
    );
}
export function computeMatchSummary(
  receivedValue,
  committedValue,
  invoiceAmount,
  currency = "ARS",
) {
  const received = Number(receivedValue);
  const committed = Number(committedValue);
  const amountValue = Number(invoiceAmount);
  const availableValue = Math.max(0, received - committed);
  return {
    matched: amountValue <= availableValue + 0.005,
    receivedValue: received,
    committedValue: committed,
    availableValue,
    invoiceAmount: amountValue,
    currency,
  };
}
export async function supplierInvoiceMatch(
  prisma,
  { organizationId, projectId, invoiceId },
) {
  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, organizationId, projectId },
    select: { id: true, amount: true, currency: true, purchaseOrderId: true },
  });
  if (!invoice)
    throw new SupplierInvoiceError(
      "Factura no encontrada.",
      "SUPPLIER_INVOICE_NOT_FOUND",
      404,
    );
  if (!invoice.purchaseOrderId)
    return {
      matched: true,
      receivedValue: null,
      committedValue: null,
      availableValue: null,
      reason: "Sin orden vinculada.",
    };
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: invoice.purchaseOrderId, organizationId, projectId },
    select: {
      lines: {
        select: {
          unitPrice: true,
          receiptLines: {
            where: { goodsReceipt: { status: "POSTED" } },
            select: { quantity: true },
          },
        },
      },
    },
  });
  if (!order)
    throw new SupplierInvoiceError(
      "La orden vinculada no existe.",
      "SUPPLIER_INVOICE_ORDER_MISSING",
      409,
    );
  const receivedValue = order.lines.reduce(
    (total, line) =>
      total +
      Number(line.unitPrice) *
        line.receiptLines.reduce((sum, item) => sum + Number(item.quantity), 0),
    0,
  );
  const committed = await prisma.supplierInvoice.aggregate({
    where: {
      purchaseOrderId: invoice.purchaseOrderId,
      projectId,
      status: { in: ["APPROVED", "PAID"] },
      id: { not: invoice.id },
    },
    _sum: { amount: true },
  });
  const committedValue = Number(committed._sum.amount || 0);
  return computeMatchSummary(
    receivedValue,
    committedValue,
    Number(invoice.amount),
    invoice.currency,
  );
}
export async function listSupplierInvoices(
  prisma,
  { organizationId, projectId, status },
) {
  const rows = await prisma.supplierInvoice.findMany({
    where: { organizationId, projectId, ...(status ? { status } : {}) },
    include: { supplier: { select: { id: true, legalName: true } } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  return {
    invoices: rows.map(serializeSupplierInvoice),
  };
}
export async function createSupplierInvoice(
  prisma,
  { scope: rawScope, actorId, input },
) {
  const current = scope(rawScope);
  const actor = text(actorId, "actorId", 190);
  const operationKey = text(input.operationKey, "operationKey", 190);
  const invoiceNumber = text(input.invoiceNumber, "invoiceNumber", 96);
  const currency = text(input.currency || "ARS", "currency", 3).toUpperCase();
  const dueAt = dueDate(input.dueAt);
  const normalizedAmount = amount(input.amount);
  if (input.receipt !== undefined && input.receipt !== null) {
    throw new SupplierInvoiceError(
      "El comprobante debe referenciarse únicamente mediante uploadId.",
      "SUPPLIER_INVOICE_DESCRIPTOR_FORBIDDEN",
    );
  }
  const uploadId = input.uploadId ? text(input.uploadId, "uploadId", 190) : null;
  const requestFingerprint = protectedUploadClaimFingerprint({
    supplierId: input.supplierId,
    purchaseOrderId: input.purchaseOrderId || null,
    invoiceNumber,
    currency,
    amount: normalizedAmount.toFixed(2),
    dueAt: dueAt?.toISOString() || null,
    uploadId,
  });
  return runOperationalProjectMutation(prisma, current, async (tx) => {
    const replay = await tx.supplierInvoice.findFirst({
      where: { projectId: current.projectId, operationKey },
      include: { supplier: { select: { id: true, legalName: true } } },
    });
    if (replay) {
      if (replay.requestFingerprint && replay.requestFingerprint !== requestFingerprint) {
        throw new SupplierInvoiceError(
          "La operationKey ya fue usada con otro contenido.",
          "IDEMPOTENCY_REPLAY_MUTATED",
          409,
        );
      }
      if (!replay.requestFingerprint && uploadId) {
        throw new SupplierInvoiceError(
          "La operación legacy no admite vincular una carga en el reintento.",
          "IDEMPOTENCY_REPLAY_MUTATED",
          409,
        );
      }
      if (replay.requestFingerprint) {
        await assertProtectedUploadReplay(tx, {
          scope: current,
          actorId: actor,
          purpose: PROTECTED_UPLOAD_PURPOSE.SUPPLIER,
          uploadId,
          entityId: replay.id,
          entityProtectedUploadId: replay.protectedUploadId,
          claimFingerprint: requestFingerprint,
          entityHasAttachment: Boolean(replay.receipt),
        });
      }
      return { invoice: serializeSupplierInvoice(replay), replayed: true };
    }
    const supplier = await tx.supplier.findFirst({
      where: {
        id: input.supplierId,
        organizationId: current.organizationId,
        active: true,
      },
    });
    if (!supplier)
      throw new SupplierInvoiceError(
        "Proveedor inválido o inactivo.",
        "SUPPLIER_INVOICE_SUPPLIER_SCOPE",
        409,
      );
    if (input.purchaseOrderId) {
      const order = await tx.purchaseOrder.findFirst({
        where: {
          id: input.purchaseOrderId,
          projectId: current.projectId,
          supplierId: supplier.id,
          organizationId: current.organizationId,
          status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"] },
        },
        select: { currency: true, total: true },
      });
      if (!order)
        throw new SupplierInvoiceError(
          "La orden no pertenece a la obra o al proveedor.",
          "SUPPLIER_INVOICE_ORDER_SCOPE",
          409,
        );
      if (order.currency !== currency)
        throw new SupplierInvoiceError(
          "La moneda de la factura no coincide con la orden.",
          "SUPPLIER_INVOICE_CURRENCY_MISMATCH",
          409,
        );
      if (normalizedAmount > Number(order.total))
        throw new SupplierInvoiceError(
          "La factura supera el total de la orden.",
          "SUPPLIER_INVOICE_AMOUNT_EXCEEDED",
          409,
        );
    }
    const createRow = (storedReceipt, protectedUploadId = null) => tx.supplierInvoice.create({
      data: {
        organizationId: current.organizationId,
        projectId: current.projectId,
        supplierId: supplier.id,
        purchaseOrderId: input.purchaseOrderId || null,
        operationKey,
        invoiceNumber,
        currency,
        amount: normalizedAmount,
        dueAt,
        receipt: storedReceipt,
        protectedUploadId,
        requestFingerprint,
      },
      include: { supplier: { select: { id: true, legalName: true } } },
    });
    const row = uploadId
      ? await claimProtectedUpload(tx, {
          scope: current,
          actorId: actor,
          purpose: PROTECTED_UPLOAD_PURPOSE.SUPPLIER,
          uploadId,
          claimFingerprint: requestFingerprint,
          createEntity: (descriptor) => createRow(descriptor, uploadId),
        })
      : await createRow(undefined);
    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: "supplier_invoice.created",
        entityType: "SupplierInvoice",
        entityId: row.id,
        metadata: {
          projectId: current.projectId,
          supplierId: supplier.id,
          invoiceNumber,
          amount: Number(row.amount),
        },
      },
    });
    return { invoice: serializeSupplierInvoice(row), replayed: false };
  });
}

export async function decideSupplierInvoice(
  prisma,
  { scope: rawScope, actorId, id, expectedRevision, status },
) {
  const current = scope(rawScope);
  const actor = text(actorId, "actorId", 190);
  const revision = Number(expectedRevision);
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !["APPROVED", "PAID", "VOIDED"].includes(status)
  )
    throw new SupplierInvoiceError("Decisión inválida.");
  return runOperationalProjectMutation(prisma, current, async (tx) => {
    const invoice = await tx.supplierInvoice.findFirst({
      where: {
        id,
        organizationId: current.organizationId,
        projectId: current.projectId,
        revision,
      },
    });
    if (!invoice)
      throw new SupplierInvoiceError(
        "La factura cambió o no existe.",
        "SUPPLIER_INVOICE_CONFLICT",
        409,
      );
    const valid =
      (status === "APPROVED" && invoice.status === "RECEIVED") ||
      (status === "PAID" && invoice.status === "APPROVED") ||
      (status === "VOIDED" && invoice.status !== "PAID");
    if (!valid)
      throw new SupplierInvoiceError(
        "Transición de factura inválida.",
        "SUPPLIER_INVOICE_TRANSITION",
        409,
      );
    if (status === "APPROVED" || status === "PAID")
      await threeWayMatch(tx, invoice);
    const result = await tx.supplierInvoice.updateMany({
      where: {
        id,
        projectId: current.projectId,
        revision,
        status: invoice.status,
      },
      data: { status, revision: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new SupplierInvoiceError(
        "La factura cambió o ya fue decidida.",
        "SUPPLIER_INVOICE_CONFLICT",
        409,
      );
    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: "supplier_invoice.decided",
        entityType: "SupplierInvoice",
        entityId: id,
        metadata: { status, revision: revision + 1 },
      },
    });
    return { status, revision: revision + 1 };
  });
}
export function supplierInvoiceErrorResponse(error) {
  if (!(error instanceof SupplierInvoiceError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
