import { MODEL_WORKLOADS } from "./model-registry.js";
import {
  AI_VISUAL_QUOTA_POLICY_VERSION,
  resolveVisualProgressDailyBudgetMicros,
  safeMicrosNumber,
  utcCivilDay,
} from "./visual-progress-dispatch.js";

const KNOWN_CONSTRAINT_CODES = Object.freeze({
  AiDailyBudgetLedger_budget_exceeded: ["AI_DAILY_BUDGET_EXCEEDED", 429],
  AiDispatchBudgetReservation_replay_mismatch: ["AI_BUDGET_RESERVATION_CONFLICT", 409],
  AiDispatchBudgetReservation_settlement_replay_mismatch: ["AI_BUDGET_SETTLEMENT_CONFLICT", 409],
  AiDispatchBudgetReservation_missing_reservation: ["AI_BUDGET_RESERVATION_MISSING", 409],
  AiDispatchBudgetReservation_pre_dispatch_release_guard: ["AI_BUDGET_SETTLEMENT_PROVENANCE_INVALID", 409],
  AiDispatchBudgetReservation_response_receipt_guard: ["AI_BUDGET_SETTLEMENT_RECEIPT_INVALID", 409],
  AiDispatchBudgetReservation_manual_receipt_guard: ["AI_BUDGET_SETTLEMENT_RECEIPT_INVALID", 409],
  AiDispatchBudgetReservation_unsupported_settlement_basis: ["AI_BUDGET_SETTLEMENT_BASIS_UNSUPPORTED", 409],
  AiDispatchBudgetReservation_no_charge_guard: ["AI_BUDGET_SETTLEMENT_PROVENANCE_INVALID", 409],
  AiDispatchBudgetReservation_settlement_actor_guard: ["AI_BUDGET_SETTLEMENT_ACTOR_FORBIDDEN", 403],
  AiDispatchBudgetReservation_reserve_input_guard: ["AI_BUDGET_INPUT_INVALID", 400],
  AiDispatchBudgetReservation_settle_input_guard: ["AI_BUDGET_INPUT_INVALID", 400],
  AiDispatchBudgetReservation_assessment_scope_fkey: ["AI_BUDGET_RESERVATION_MISSING", 409],
  AiDispatchBudgetReservation_assessment_budget_guard: ["AI_BUDGET_RESERVATION_CONFLICT", 409],
  AiDispatchBudgetReservation_started_without_reservation: ["AI_BUDGET_RESERVATION_CONFLICT", 409],
  AiDispatchBudgetReservation_dispatch_start_guard: ["AI_BUDGET_SETTLEMENT_PROVENANCE_INVALID", 409],
  AiDispatchBudgetReservation_assessment_cost_guard: ["AI_BUDGET_SETTLEMENT_CONFLICT", 409],
  AiDispatchBudgetReservation_settlement_guard: ["AI_BUDGET_SETTLEMENT_CONFLICT", 409],
});

export const AI_SETTLEMENT_BASES = Object.freeze({
  PRE_DISPATCH_RELEASE: "PRE_DISPATCH_RELEASE",
  RESPONSE_USAGE: "RESPONSE_USAGE",
  RECONCILED_USAGE: "RECONCILED_USAGE",
  PROVIDER_BILLING: "PROVIDER_BILLING",
  CONFIRMED_NO_CHARGE: "CONFIRMED_NO_CHARGE",
});

const AUTOMATED_SETTLEMENT_BASES = new Set([
  AI_SETTLEMENT_BASES.PRE_DISPATCH_RELEASE,
  AI_SETTLEMENT_BASES.RESPONSE_USAGE,
]);
const MANUAL_SETTLEMENT_BASES = new Set([
  AI_SETTLEMENT_BASES.PROVIDER_BILLING,
  AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE,
]);

export class AiBudgetLedgerError extends Error {
  constructor(code, message, { status = 503 } = {}) {
    super(message);
    this.name = "AiBudgetLedgerError";
    this.code = code;
    this.status = status;
  }
}

function requiredIdentifier(value, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 190) {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_INPUT_INVALID",
      `${field} is required for AI budget accounting.`,
      { status: 400 },
    );
  }
  return normalized;
}

function microsBigInt(value, field) {
  return BigInt(safeMicrosNumber(value, field));
}

function requiredSha256(value, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_INPUT_INVALID",
      `${field} must be a lowercase SHA-256 digest.`,
      { status: 400 },
    );
  }
  return normalized;
}

function normalizedSettlementBasis(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!AUTOMATED_SETTLEMENT_BASES.has(normalized) && !MANUAL_SETTLEMENT_BASES.has(normalized)) {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_INPUT_INVALID",
      "settlementBasis is not supported.",
      { status: 400 },
    );
  }
  return normalized;
}

function safeConstraintName(cause) {
  const candidates = [
    cause?.meta?.constraint,
    cause?.meta?.database_error,
    cause?.meta?.message,
    cause?.message,
  ];
  const known = Object.keys(KNOWN_CONSTRAINT_CODES);
  return known.find((constraint) => candidates.some(
    (candidate) => typeof candidate === "string" && candidate.includes(constraint),
  )) || null;
}

function mapLedgerFailure(cause, operation) {
  if (cause instanceof AiBudgetLedgerError) return cause;
  const constraint = safeConstraintName(cause);
  if (constraint) {
    const [code, status] = KNOWN_CONSTRAINT_CODES[constraint];
    return new AiBudgetLedgerError(
      code,
      operation === "reserve"
        ? "AI daily budget admission was rejected."
        : "AI budget settlement conflicted with its durable reservation.",
      { status },
    );
  }
  return new AiBudgetLedgerError(
    operation === "reserve" ? "AI_BUDGET_RESERVATION_FAILED" : "AI_BUDGET_SETTLEMENT_FAILED",
    operation === "reserve"
      ? "AI budget admission is temporarily unavailable."
      : "AI budget settlement is temporarily unavailable.",
  );
}

function normalizedReservation(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_RESPONSE_INVALID",
      "AI budget accounting returned an invalid reservation.",
    );
  }
  return {
    assessmentId: requiredIdentifier(row.assessmentId, "assessmentId"),
    organizationId: requiredIdentifier(row.organizationId, "organizationId"),
    projectId: requiredIdentifier(row.projectId, "projectId"),
    civilDayUtc: utcCivilDay(row.civilDayUtc),
    workload: requiredIdentifier(row.workload, "workload"),
    quotaPolicyVersion: requiredIdentifier(row.quotaPolicyVersion, "quotaPolicyVersion"),
    budgetLimitMicros: String(safeMicrosNumber(row.budgetLimitMicros, "budgetLimitMicros")),
    reservedMicros: String(safeMicrosNumber(row.reservedMicros, "reservedMicros")),
    actualMicros: row.actualMicros == null
      ? null
      : String(safeMicrosNumber(row.actualMicros, "actualMicros")),
    status: String(row.status || ""),
    settlementBasis: row.settlementBasis == null ? null : String(row.settlementBasis),
    settlementOperationKeyHash: row.settlementOperationKeyHash == null
      ? null
      : requiredSha256(row.settlementOperationKeyHash, "settlementOperationKeyHash"),
    settlementEvidenceSha256: row.settlementEvidenceSha256 == null
      ? null
      : requiredSha256(row.settlementEvidenceSha256, "settlementEvidenceSha256"),
    settledById: row.settledById == null
      ? null
      : requiredIdentifier(row.settledById, "settledById"),
  };
}

export async function reserveAiVisualBudget(prisma, {
  assessmentId,
  civilDayUtc,
  budgetLimitMicros,
  reservationMicros,
  quotaPolicyVersion = AI_VISUAL_QUOTA_POLICY_VERSION,
} = {}) {
  if (typeof prisma?.$queryRaw !== "function") {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_LEDGER_UNAVAILABLE",
      "AI budget ledger is unavailable.",
    );
  }
  const normalizedAssessmentId = requiredIdentifier(assessmentId, "assessmentId");
  const day = utcCivilDay(civilDayUtc);
  const limit = microsBigInt(resolveVisualProgressDailyBudgetMicros(budgetLimitMicros), "budgetLimitMicros");
  const reservation = microsBigInt(reservationMicros, "reservationMicros");
  try {
    const rows = await prisma.$queryRaw`
      SELECT *
        FROM "obrasaas_ai_daily_budget_reserve"(
          ${normalizedAssessmentId}::TEXT,
          ${day}::DATE,
          ${MODEL_WORKLOADS.VISUAL_PROGRESS}::TEXT,
          ${quotaPolicyVersion}::TEXT,
          ${limit}::BIGINT,
          ${reservation}::BIGINT
        )
    `;
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new AiBudgetLedgerError(
        "AI_BUDGET_RESPONSE_INVALID",
        "AI budget admission did not return one durable reservation.",
      );
    }
    return normalizedReservation(rows[0]);
  } catch (cause) {
    throw mapLedgerFailure(cause, "reserve");
  }
}

export async function settleAiVisualBudget(prisma, {
  assessmentId,
  actualCostMicros,
  settlementBasis,
  settlementOperationKeyHash,
  settlementEvidenceSha256,
  settledById = null,
} = {}) {
  if (typeof prisma?.$queryRaw !== "function") {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_LEDGER_UNAVAILABLE",
      "AI budget ledger is unavailable.",
    );
  }
  const normalizedAssessmentId = requiredIdentifier(assessmentId, "assessmentId");
  const actual = microsBigInt(actualCostMicros, "actualCostMicros");
  const basis = normalizedSettlementBasis(settlementBasis);
  const operationKeyHash = requiredSha256(
    settlementOperationKeyHash,
    "settlementOperationKeyHash",
  );
  const evidenceSha256 = requiredSha256(
    settlementEvidenceSha256,
    "settlementEvidenceSha256",
  );
  const actorId = settledById == null ? null : requiredIdentifier(settledById, "settledById");
  if (AUTOMATED_SETTLEMENT_BASES.has(basis) && actorId != null) {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_INPUT_INVALID",
      "Automated settlement must not impersonate a platform actor.",
      { status: 400 },
    );
  }
  if (MANUAL_SETTLEMENT_BASES.has(basis) && actorId == null) {
    throw new AiBudgetLedgerError(
      "AI_BUDGET_INPUT_INVALID",
      "Manual settlement requires a platform actor.",
      { status: 400 },
    );
  }
  try {
    const rows = await prisma.$queryRaw`
      SELECT *
        FROM "obrasaas_ai_daily_budget_settle"(
          ${normalizedAssessmentId}::TEXT,
          ${actual}::BIGINT,
          ${basis}::"AiDispatchSettlementBasis",
          ${operationKeyHash}::TEXT,
          ${evidenceSha256}::TEXT,
          ${actorId}::TEXT
        )
    `;
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new AiBudgetLedgerError(
        "AI_BUDGET_RESPONSE_INVALID",
        "AI budget settlement did not return one durable reservation.",
      );
    }
    return normalizedReservation(rows[0]);
  } catch (cause) {
    throw mapLedgerFailure(cause, "settle");
  }
}
