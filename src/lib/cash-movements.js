import crypto from "node:crypto";
import {
  assertProtectedUploadReplay,
  claimProtectedUpload,
  PROTECTED_UPLOAD_PURPOSE,
  protectedUploadClaimFingerprint,
  publicProtectedAttachment,
} from "./protected-uploads.js";
import { runOperationalProjectMutation } from "./project-write-policy.js";

export const CASH_DUAL_APPROVAL_THRESHOLD = 100000;
export const CASH_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export class CashMovementError extends Error {
  constructor(message, code = "CASH_MOVEMENT_INVALID", status = 400) {
    super(message);
    this.name = "CashMovementError";
    this.code = code;
    this.status = status;
  }
}
function text(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new CashMovementError(`${field} inválido.`);
  return value.trim();
}
function amount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 999999999999)
    throw new CashMovementError("amount inválido.");
  return n;
}
function scope(value) {
  if (!value?.organizationId || !value?.projectId)
    throw new CashMovementError("Alcance incompleto.");
  return value;
}
function fingerprint(input) {
  return crypto
    .createHash("sha256")
    .update(
      [
        input.fundId,
        input.kind,
        Number(input.amount).toFixed(2),
        String(input.category).trim().toLowerCase(),
        String(input.description || "")
          .trim()
          .toLowerCase(),
        String(input.receiptFingerprint || "").trim().toLowerCase(),
      ].join("|"),
    )
    .digest("hex");
}
function serialize(row) {
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
    approvedAt: row.approvedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}
export async function listCashFunds(prisma, { projectId }) {
  const rows = await prisma.cashFund.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { movements: true } } },
  });
  return {
    funds: rows.map((row) => ({
      ...row,
      movementCount: row._count.movements,
      _count: undefined,
    })),
  };
}
export async function createCashFund(
  prisma,
  { scope: rawScope, actorId, input },
) {
  const current = scope(rawScope);
  const actor = text(actorId, "actorId", 190);
  const name = text(input.name, "name", 160);
  const currency = text(input.currency, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    throw new CashMovementError("currency invalida.");
  const custodianId = text(input.custodianId || actor, "custodianId", 190);
  return runOperationalProjectMutation(prisma, current, async (tx) => {
    const custodian = await tx.tenantMembership.findFirst({
      where: {
        userId: custodianId,
        organizationId: current.organizationId,
        status: "ACTIVE",
        projectMemberships: {
          some: {
            projectId: current.projectId,
            status: "ACTIVE",
          },
        },
      },
      select: { userId: true },
    });
    if (!custodian)
      throw new CashMovementError(
        "El custodio no pertenece a la obra.",
        "CASH_CUSTODIAN_SCOPE",
        409,
      );
    const row = await tx.cashFund.create({
      data: { projectId: current.projectId, name, currency, custodianId },
    });
    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: "cash_fund.created",
        entityType: "CashFund",
        entityId: row.id,
        metadata: { projectId: current.projectId, name, currency, custodianId },
      },
    });
    return { fund: row };
  });
}
export async function listCashMovements(prisma, { projectId, fundId }) {
  const rows = await prisma.cashMovement.findMany({
    where: { projectId, ...(fundId ? { fundId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return { movements: rows.map(serialize) };
}
export async function createCashMovement(
  prisma,
  { scope: rawScope, actorId, input },
) {
  const current = scope(rawScope);
  const actor = text(actorId, "actorId", 190);
  const key = text(input.idempotencyKey, "idempotencyKey", 190);
  const kind = input.kind;
  if (!["FUNDING", "EXPENSE", "REIMBURSEMENT", "ADJUSTMENT"].includes(kind))
    throw new CashMovementError("kind invalido.");
  const normalizedAmount = amount(input.amount);
  const normalizedCategory = text(input.category, "category", 96);
  if (input.receipt !== undefined && input.receipt !== null) {
    throw new CashMovementError(
      "El comprobante debe referenciarse únicamente mediante uploadId.",
      "CASH_RECEIPT_DESCRIPTOR_FORBIDDEN",
    );
  }
  const normalizedDescription = input.description
    ? text(input.description, "description", 500)
    : null;
  const uploadId = input.uploadId ? text(input.uploadId, "uploadId", 190) : null;
  const requestFingerprint = protectedUploadClaimFingerprint({
    fundId: input.fundId,
    kind,
    amount: normalizedAmount.toFixed(2),
    category: normalizedCategory,
    description: normalizedDescription,
    externalRef: String(input.externalRef || "").trim(),
    uploadId,
  });
  return runOperationalProjectMutation(prisma, current, async (tx) => {
    const replay = await tx.cashMovement.findFirst({
      where: { projectId: current.projectId, idempotencyKey: key },
    });
    if (replay) {
      if (replay.requestFingerprint && replay.requestFingerprint !== requestFingerprint) {
        throw new CashMovementError(
          "La Idempotency-Key ya fue usada con otro contenido.",
          "IDEMPOTENCY_REPLAY_MUTATED",
          409,
        );
      }
      if (!replay.requestFingerprint && uploadId) {
        throw new CashMovementError(
          "La operación legacy no admite vincular una carga en el reintento.",
          "IDEMPOTENCY_REPLAY_MUTATED",
          409,
        );
      }
      if (replay.requestFingerprint) {
        await assertProtectedUploadReplay(tx, {
          scope: current,
          actorId: actor,
          purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
          uploadId,
          entityId: replay.id,
          entityProtectedUploadId: replay.protectedUploadId,
          claimFingerprint: requestFingerprint,
          entityHasAttachment: Boolean(replay.receipt),
        });
      }
      return { movement: serialize(replay), replayed: true };
    }
    const upload = uploadId
      ? await tx.protectedUpload.findFirst({
          where: {
            id: uploadId,
            projectId: current.projectId,
            actorId: actor,
            purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
            status: "AVAILABLE",
          },
          select: { sha256: true },
        })
      : null;
    const hash = fingerprint({
      fundId: input.fundId,
      kind,
      amount: normalizedAmount,
      category: normalizedCategory,
      description: normalizedDescription,
      receiptFingerprint: upload?.sha256 || (uploadId ? `upload:${uploadId}` : ""),
    });
    const duplicate = await tx.cashMovement.findFirst({
      where: {
        projectId: current.projectId,
        fingerprint: hash,
        status: {
          in: ["PENDING_APPROVAL", "PARTIALLY_APPROVED", "APPROVED"],
        },
        createdAt: { gte: new Date(Date.now() - CASH_DUPLICATE_WINDOW_MS) },
      },
    });
    if (duplicate)
      throw new CashMovementError(
        "Ya existe un movimiento reciente con el mismo contenido y comprobante.",
        "CASH_MOVEMENT_DUPLICATE",
        409,
      );
    const fund = await tx.cashFund.findFirst({
      where: {
        id: input.fundId,
        projectId: current.projectId,
        status: "ACTIVE",
      },
    });
    if (!fund)
      throw new CashMovementError(
        "El fondo no pertenece a la obra o está cerrado.",
        "CASH_FUND_SCOPE",
        409,
      );
    const createRow = (storedReceipt, protectedUploadId = null) => tx.cashMovement.create({
      data: {
        projectId: current.projectId,
        fundId: fund.id,
        idempotencyKey: key,
        fingerprint: hash,
        kind,
        amount: normalizedAmount,
        category: normalizedCategory,
        description: normalizedDescription,
        receipt: storedReceipt,
        protectedUploadId,
        requestFingerprint,
        status: "PENDING_APPROVAL",
      },
    });
    const row = uploadId
      ? await claimProtectedUpload(tx, {
          scope: current,
          actorId: actor,
          purpose: PROTECTED_UPLOAD_PURPOSE.CASH,
          uploadId,
          claimFingerprint: requestFingerprint,
          createEntity: (descriptor) => createRow(descriptor, uploadId),
        })
      : await createRow(undefined);
    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: "cash_movement.created",
        entityType: "CashMovement",
        entityId: row.id,
        metadata: {
          projectId: current.projectId,
          fundId: fund.id,
          kind,
          idempotencyKey: key,
        },
      },
    });
    return { movement: serialize(row), replayed: false };
  });
}
export async function decideCashMovement(
  prisma,
  { scope: rawScope, actorId, id, expectedRevision, status },
) {
  const current = scope(rawScope);
  const actor = text(actorId, "actorId", 190);
  const movementId = text(id, "id", 190);
  const revision = Number(expectedRevision);
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !["APPROVED", "REJECTED"].includes(status)
  )
    throw new CashMovementError("Decisión inválida.");
  return runOperationalProjectMutation(prisma, current, async (tx) => {
    const movement = await tx.cashMovement.findFirst({
      where: {
        id: movementId,
        projectId: current.projectId,
        revision,
        status: { in: ["PENDING_APPROVAL", "PARTIALLY_APPROVED"] },
      },
      select: {
        id: true,
        amount: true,
        status: true,
        firstApproverId: true,
      },
    });
    if (!movement) {
      throw new CashMovementError(
        "El movimiento cambió o ya fue decidido.",
        "CASH_MOVEMENT_CONFLICT",
        409,
      );
    }

    let nextStatus;
    let approvalStage;
    let decisionData;
    if (status === "REJECTED") {
      nextStatus = "REJECTED";
      approvalStage = "rejected";
      decisionData = {
        status: nextStatus,
        approvedAt: null,
        revision: { increment: 1 },
      };
    } else if (movement.status === "PARTIALLY_APPROVED") {
      if (!movement.firstApproverId) {
        throw new CashMovementError(
          "La primera aprobación no tiene un responsable válido.",
          "CASH_FIRST_APPROVER_MISSING",
          409,
        );
      }
      if (movement.firstApproverId === actor) {
        throw new CashMovementError(
          "La segunda aprobación debe realizarla una persona distinta.",
          "CASH_SECOND_APPROVER_MUST_DIFFER",
          409,
        );
      }
      nextStatus = "APPROVED";
      approvalStage = "second";
      decisionData = {
        status: nextStatus,
        secondApproverId: actor,
        approvedAt: new Date(),
        revision: { increment: 1 },
      };
    } else if (Number(movement.amount) >= CASH_DUAL_APPROVAL_THRESHOLD) {
      nextStatus = "PARTIALLY_APPROVED";
      approvalStage = "first";
      decisionData = {
        status: nextStatus,
        firstApproverId: actor,
        secondApproverId: null,
        approvedAt: null,
        revision: { increment: 1 },
      };
    } else {
      nextStatus = "APPROVED";
      approvalStage = "single";
      decisionData = {
        status: nextStatus,
        firstApproverId: actor,
        secondApproverId: null,
        approvedAt: new Date(),
        revision: { increment: 1 },
      };
    }

    const result = await tx.cashMovement.updateMany({
      where: {
        id: movementId,
        projectId: current.projectId,
        revision,
        status: movement.status,
        ...(movement.status === "PARTIALLY_APPROVED"
          ? { firstApproverId: movement.firstApproverId }
          : {}),
      },
      data: decisionData,
    });
    if (result.count !== 1)
      throw new CashMovementError(
        "El movimiento cambió o ya fue decidido.",
        "CASH_MOVEMENT_CONFLICT",
        409,
      );
    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: actor,
        action: "cash_movement.decided",
        entityType: "CashMovement",
        entityId: movementId,
        metadata: {
          projectId: current.projectId,
          requestedStatus: status,
          status: nextStatus,
          approvalStage,
          dualApprovalThreshold: CASH_DUAL_APPROVAL_THRESHOLD,
          revision: revision + 1,
        },
      },
    });
    return {
      status: nextStatus,
      revision: revision + 1,
      approvalStage,
      firstApproverId:
        decisionData.firstApproverId ?? movement.firstApproverId ?? null,
      secondApproverId: decisionData.secondApproverId ?? null,
    };
  });
}
export async function cashBalance(prisma, { projectId, fundId }) {
  const rows = await prisma.cashMovement.findMany({
    where: { projectId, fundId, status: "APPROVED" },
    select: { kind: true, amount: true },
  });
  return {
    balance: rows.reduce(
      (total, row) =>
        total +
        (["FUNDING", "REIMBURSEMENT"].includes(row.kind)
          ? Number(row.amount)
          : -Number(row.amount)),
      0,
    ),
  };
}
export function cashMovementErrorResponse(error) {
  if (!(error instanceof CashMovementError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}
