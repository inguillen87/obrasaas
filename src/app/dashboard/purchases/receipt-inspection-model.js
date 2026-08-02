import {
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  subtractProcurementQuantities,
  sumProcurementQuantities,
} from "../../../lib/procurement-quantity.js";

export const RECEIPT_INSPECTION_QUALITIES = [
  "ACCEPTED",
  "DAMAGED",
  "REJECTED",
  "QUARANTINED",
];

export const RECEIPT_INSPECTION_PAGE_SIZE = 100;

const RECEIPT_LIST_CURSOR_MAX_LENGTH = 2_048;

const MAX_DISPOSITIONS = 2_000;

export class ReceiptInspectionDraftError extends Error {
  constructor(message, code = "RECEIPT_INSPECTION_DRAFT_INVALID") {
    super(message);
    this.name = "ReceiptInspectionDraftError";
    this.code = code;
  }
}

function invalid(message, code) {
  throw new ReceiptInspectionDraftError(message, code);
}

function exactQuantity(value, label, { allowZero = false } = {}) {
  try {
    return parseProcurementQuantity(value, { allowZero });
  } catch {
    return invalid(
      `${label} debe ser un decimal ${allowZero ? "no negativo" : "positivo"} con hasta tres decimales.`,
      "RECEIPT_INSPECTION_QUANTITY_INVALID",
    );
  }
}

function partitionKey(goodsReceiptLineId, allocationId) {
  return `${goodsReceiptLineId}\u0000${allocationId || ""}`;
}

function emptyQualities() {
  return Object.fromEntries(RECEIPT_INSPECTION_QUALITIES.map((quality) => [quality, ""]));
}

export function initialReceiptInspectionPage(receipts, truncated = false) {
  if (!Array.isArray(receipts)) {
    return invalid(
      "La lista inicial de recepciones es inválida.",
      "RECEIPT_INSPECTION_RECEIPT_PAGE_INVALID",
    );
  }
  const posted = receipts.filter((receipt) => receipt?.status === "POSTED");
  const page = posted.slice(0, RECEIPT_INSPECTION_PAGE_SIZE);
  return {
    receipts: page,
    cursor: null,
    nextCursor: null,
    hasMore: truncated === true || posted.length > page.length,
    authoritative: false,
  };
}

export function receiptInspectionReceiptLabel(receipt, orders = []) {
  const fallbackOrder = Array.isArray(orders)
    ? orders.find((candidate) => candidate.id === receipt?.purchaseOrderId)
    : null;
  const orderNumber = receipt?.purchaseOrder?.id === receipt?.purchaseOrderId
    ? receipt.purchaseOrder.number
    : fallbackOrder?.number;
  const receivedAt = receipt?.receivedAt
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" })
      .format(new Date(receipt.receivedAt))
    : "sin fecha";
  return `${orderNumber || "Orden"} · ${receivedAt}`;
}

export function receiptInspectionLineDetail(receipt, orders, purchaseOrderLineId) {
  const receivedLine = receipt?.lines?.find((candidate) => (
    candidate.purchaseOrderLineId === purchaseOrderLineId
  ));
  const authoritativeLine = receivedLine?.purchaseOrderLine?.id === purchaseOrderLineId
    ? receivedLine.purchaseOrderLine
    : null;
  const fallbackOrder = Array.isArray(orders)
    ? orders.find((candidate) => candidate.id === receipt?.purchaseOrderId)
    : null;
  const fallbackLine = fallbackOrder?.lines?.find((candidate) => (
    candidate.id === purchaseOrderLineId
  ));
  return {
    description: authoritativeLine?.description || fallbackLine?.description || "Partida recibida",
    unit: authoritativeLine?.unit || fallbackLine?.unit || "u.",
  };
}

export function receiptInspectionPageFromResponse(result, cursor = null) {
  if (
    !result
    || !Array.isArray(result.receipts)
    || result.receipts.length > RECEIPT_INSPECTION_PAGE_SIZE
    || typeof result.hasMore !== "boolean"
  ) {
    return invalid(
      "El servidor devolvió una página de recepciones inválida.",
      "RECEIPT_INSPECTION_RECEIPT_PAGE_INVALID",
    );
  }
  const ids = new Set();
  for (const receipt of result.receipts) {
    if (
      !receipt?.id
      || ids.has(receipt.id)
      || receipt.status !== "POSTED"
      || !receipt.purchaseOrderId
      || receipt.purchaseOrder?.id !== receipt.purchaseOrderId
      || typeof receipt.purchaseOrder.number !== "string"
      || receipt.purchaseOrder.number.length === 0
      || !Array.isArray(receipt.lines)
      || receipt.lines.length === 0
      || receipt.lines.some((line) => (
        !line?.id
        || !line.purchaseOrderLineId
        || line.purchaseOrderLine?.id !== line.purchaseOrderLineId
        || typeof line.purchaseOrderLine.description !== "string"
        || line.purchaseOrderLine.description.length === 0
        || typeof line.purchaseOrderLine.unit !== "string"
        || line.purchaseOrderLine.unit.length === 0
      ))
    ) {
      return invalid(
        "El servidor devolvió una recepción repetida, incompleta, sin contexto de orden o fuera de estado POSTED.",
        "RECEIPT_INSPECTION_RECEIPT_PAGE_INVALID",
      );
    }
    ids.add(receipt.id);
  }
  const nextCursor = result.nextCursor ?? null;
  if (
    (result.hasMore && (
      result.receipts.length === 0
      || typeof nextCursor !== "string"
      || nextCursor.length === 0
      || nextCursor.length > RECEIPT_LIST_CURSOR_MAX_LENGTH
      || nextCursor === cursor
    ))
    || (!result.hasMore && nextCursor !== null)
    || (cursor != null && (typeof cursor !== "string" || cursor.length === 0))
  ) {
    return invalid(
      "El servidor devolvió una continuidad de recepciones inválida.",
      "RECEIPT_INSPECTION_RECEIPT_CURSOR_INVALID",
    );
  }
  return {
    receipts: result.receipts,
    cursor,
    nextCursor,
    hasMore: result.hasMore,
    authoritative: true,
  };
}

export function deriveReceiptInspectionPartitions(receipt, allocations) {
  if (
    !receipt?.id
    || !Array.isArray(receipt.lines)
    || receipt.lines.length === 0
    || receipt.lines.length > 1_000
  ) {
    return invalid(
      "La recepción no contiene líneas inspeccionables.",
      "RECEIPT_INSPECTION_LINES_MISSING",
    );
  }
  if (!Array.isArray(allocations)) {
    return invalid(
      "La respuesta de conciliación es inválida.",
      "RECEIPT_INSPECTION_ALLOCATIONS_INVALID",
    );
  }

  const lineIds = new Set(receipt.lines.map((line) => line.id));
  if (lineIds.has(undefined) || lineIds.has(null) || lineIds.size !== receipt.lines.length) {
    return invalid(
      "Las líneas de la recepción tienen identificadores repetidos o inválidos.",
      "RECEIPT_INSPECTION_LINE_DUPLICATE",
    );
  }
  const receiptAllocations = allocations.filter((allocation) => (
    allocation?.goodsReceiptId === receipt.id
  ));
  if (receiptAllocations.some((allocation) => !lineIds.has(allocation.goodsReceiptLineId))) {
    return invalid(
      "Una asignación recibida no pertenece a las líneas visibles del remito.",
      "RECEIPT_INSPECTION_ALLOCATION_SCOPE_INVALID",
    );
  }
  const allocationIds = new Set();
  for (const allocation of receiptAllocations) {
    if (!allocation.id || allocationIds.has(allocation.id)) {
      return invalid(
        "El historial de asignaciones contiene identificadores repetidos o inválidos.",
        "RECEIPT_INSPECTION_ALLOCATION_DUPLICATE",
      );
    }
    allocationIds.add(allocation.id);
  }

  const partitions = [];
  for (const line of receipt.lines) {
    if (!line?.id) {
      return invalid(
        "Una línea recibida no tiene identificador.",
        "RECEIPT_INSPECTION_LINE_INVALID",
      );
    }
    const lineQuantityScaled = exactQuantity(line.quantity, "La cantidad recibida");
    const matching = receiptAllocations.filter((allocation) => (
      allocation.goodsReceiptLineId === line.id
    ));
    if (matching.some((allocation) => (
      allocation.purchaseOrderLineId !== line.purchaseOrderLineId
    ))) {
      return invalid(
        "Una asignación no coincide con la partida de la orden recibida.",
        "RECEIPT_INSPECTION_ALLOCATION_LINE_MISMATCH",
      );
    }
    const allocationQuantities = matching.map((allocation) => (
      exactQuantity(allocation.quantity, "La cantidad conciliada")
    ));
    const allocatedScaled = sumProcurementQuantities(allocationQuantities);
    if (compareProcurementQuantities(allocatedScaled, lineQuantityScaled) > 0) {
      return invalid(
        "Las asignaciones superan la cantidad recibida. La inspección se bloqueó para no ocultar una inconsistencia.",
        "RECEIPT_INSPECTION_ALLOCATION_OVERFLOW",
      );
    }

    matching.forEach((allocation, index) => {
      const quantityScaled = allocationQuantities[index];
      partitions.push({
        key: partitionKey(line.id, allocation.id),
        goodsReceiptLineId: line.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        allocationId: allocation.id,
        supplierCommitmentId: allocation.supplierCommitmentId,
        quantity: formatProcurementQuantity(quantityScaled),
        quantityScaled,
        unallocated: false,
      });
    });

    const unallocatedScaled = subtractProcurementQuantities(
      lineQuantityScaled,
      allocatedScaled,
    );
    if (compareProcurementQuantities(unallocatedScaled, 0n) > 0) {
      partitions.push({
        key: partitionKey(line.id, null),
        goodsReceiptLineId: line.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        allocationId: null,
        supplierCommitmentId: null,
        quantity: formatProcurementQuantity(unallocatedScaled),
        quantityScaled: unallocatedScaled,
        unallocated: true,
      });
    }
  }

  return {
    partitions,
    hasUnallocated: partitions.some((partition) => partition.unallocated),
  };
}

export function latestReceiptInspection(inspections) {
  if (!Array.isArray(inspections) || inspections.length === 0) return null;
  const versions = new Set();
  const ordered = [];
  for (const inspection of inspections) {
    if (
      !inspection?.id
      || !Number.isSafeInteger(inspection.version)
      || inspection.version < 1
      || versions.has(inspection.version)
    ) {
      return invalid(
        "La cadena de inspecciones recibida es inconsistente.",
        "RECEIPT_INSPECTION_CHAIN_INVALID",
      );
    }
    versions.add(inspection.version);
    ordered.push(inspection);
  }
  ordered.sort((left, right) => left.version - right.version);
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const predecessor = ordered[index - 1] || null;
    const transitionIsValid = predecessor?.kind === "REVERSAL"
      ? current.kind === "FINALIZATION"
      : ["CORRECTION", "REVERSAL"].includes(current.kind);
    if (
      current.version !== index + 1
      || (index === 0 && (current.kind !== "FINALIZATION" || current.predecessorId))
      || (index > 0 && (
        current.predecessorId !== predecessor.id
        || !transitionIsValid
      ))
    ) {
      return invalid(
        "La cadena de inspecciones tiene una versión o transición incompleta.",
        "RECEIPT_INSPECTION_CHAIN_GAP",
      );
    }
  }
  return ordered[ordered.length - 1];
}

export function emptyReceiptInspectionDraft(partitions) {
  return Object.fromEntries(partitions.map((partition) => [
    partition.key,
    emptyQualities(),
  ]));
}

export function acceptedReceiptInspectionDraft(partitions) {
  return Object.fromEntries(partitions.map((partition) => [
    partition.key,
    {
      ...emptyQualities(),
      ACCEPTED: partition.quantity,
    },
  ]));
}

export function receiptInspectionDraftFromHead(partitions, head) {
  if (!head || head.kind === "REVERSAL") return emptyReceiptInspectionDraft(partitions);
  if (!Array.isArray(head.dispositions)) {
    return invalid(
      "La versión vigente no incluye su partición de cantidades.",
      "RECEIPT_INSPECTION_HEAD_INCOMPLETE",
    );
  }

  const draft = emptyReceiptInspectionDraft(partitions);
  const partitionByKey = new Map(partitions.map((partition) => [partition.key, partition]));
  const seen = new Set();
  for (const disposition of head.dispositions) {
    const key = partitionKey(disposition.goodsReceiptLineId, disposition.allocationId);
    const partition = partitionByKey.get(key);
    const dispositionKey = `${key}\u0000${disposition.quality}`;
    if (
      !partition
      || !RECEIPT_INSPECTION_QUALITIES.includes(disposition.quality)
      || seen.has(dispositionKey)
    ) {
      return invalid(
        "La versión vigente contiene una disposición incompatible con la conciliación actual.",
        "RECEIPT_INSPECTION_HEAD_PARTITION_INVALID",
      );
    }
    seen.add(dispositionKey);
    const quantityScaled = exactQuantity(disposition.quantity, "La cantidad inspeccionada");
    draft[partition.key][disposition.quality] = formatProcurementQuantity(quantityScaled);
  }

  validateDraftPartitions(partitions, draft);
  return draft;
}

function validateDraftPartitions(partitions, draft) {
  const dispositions = [];
  for (const partition of partitions) {
    const qualities = draft?.[partition.key] || {};
    const quantities = [];
    for (const quality of RECEIPT_INSPECTION_QUALITIES) {
      const raw = typeof qualities[quality] === "string" ? qualities[quality].trim() : "";
      const quantityScaled = raw === ""
        ? 0n
        : exactQuantity(raw, `La cantidad ${quality.toLowerCase()}`, { allowZero: true });
      quantities.push(quantityScaled);
      if (compareProcurementQuantities(quantityScaled, 0n) > 0) {
        dispositions.push({
          goodsReceiptLineId: partition.goodsReceiptLineId,
          allocationId: partition.allocationId,
          quality,
          quantity: formatProcurementQuantity(quantityScaled),
        });
      }
    }
    const partitionTotal = sumProcurementQuantities(quantities);
    if (compareProcurementQuantities(partitionTotal, partition.quantityScaled) !== 0) {
      return invalid(
        `La partición ${partition.quantity} debe distribuirse exactamente entre las cuatro categorías.`,
        "RECEIPT_INSPECTION_PARTITION_TOTAL_INVALID",
      );
    }
  }
  if (dispositions.length === 0 || dispositions.length > MAX_DISPOSITIONS) {
    return invalid(
      "La inspección supera el límite seguro de disposiciones.",
      "RECEIPT_INSPECTION_DISPOSITION_LIMIT",
    );
  }
  return dispositions;
}

export function buildReceiptInspectionSubmission({
  receipt,
  partitions,
  draft,
  head,
  locationId,
  reason,
}) {
  if (!receipt?.id) {
    return invalid("Seleccioná una recepción POSTED.", "RECEIPT_INSPECTION_RECEIPT_REQUIRED");
  }
  if (typeof locationId !== "string" || !locationId.trim()) {
    return invalid(
      "Seleccioná una ubicación activa para la inspección.",
      "RECEIPT_INSPECTION_LOCATION_REQUIRED",
    );
  }
  const kind = head && head.kind !== "REVERSAL" ? "CORRECTION" : "FINALIZATION";
  const dispositions = validateDraftPartitions(partitions, draft);
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  const hasException = dispositions.some((disposition) => disposition.quality !== "ACCEPTED");
  if ((kind === "CORRECTION" || hasException) && !normalizedReason) {
    return invalid(
      kind === "CORRECTION"
        ? "Toda corrección requiere un motivo auditable."
        : "Indicá el motivo del daño, rechazo o cuarentena.",
      "RECEIPT_INSPECTION_REASON_REQUIRED",
    );
  }

  return {
    goodsReceiptId: receipt.id,
    kind,
    ...(head ? { predecessorId: head.id } : {}),
    locationId: locationId.trim(),
    ...(normalizedReason ? { reason: normalizedReason } : {}),
    dispositions,
  };
}

export function buildReceiptInspectionReversal({ receipt, head, reason }) {
  if (!receipt?.id || !head || head.kind === "REVERSAL") {
    return invalid(
      "No existe una inspección vigente para revertir.",
      "RECEIPT_INSPECTION_REVERSAL_UNAVAILABLE",
    );
  }
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  if (!normalizedReason) {
    return invalid(
      "La reversión requiere un motivo auditable.",
      "RECEIPT_INSPECTION_REVERSAL_REASON_REQUIRED",
    );
  }
  return {
    goodsReceiptId: receipt.id,
    kind: "REVERSAL",
    predecessorId: head.id,
    reason: normalizedReason,
  };
}
