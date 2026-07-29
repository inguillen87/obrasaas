import {
  AI_DISPATCH_CAPABILITIES,
  AI_DISPATCH_DATA_CLASSES,
  AI_DISPATCH_PRICING_VERSION,
  planAiDispatch,
} from "./dispatch-policy.js";
import {
  MODEL_REGISTRY,
  MODEL_ROLLOUT_ROLES,
  MODEL_WORKLOADS,
  resolvePrimaryVisualProgressModel,
} from "./model-registry.js";

export const AI_VISUAL_DAILY_BUDGET_ENV = "AI_VISUAL_DAILY_BUDGET_MICROS";
export const AI_VISUAL_QUOTA_POLICY_VERSION = "ai-visual-daily-budget-v1";

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export class AiVisualDispatchConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiVisualDispatchConfigurationError";
    this.code = code;
  }
}

function configurationError(code, message) {
  throw new AiVisualDispatchConfigurationError(code, message);
}

export function safeMicrosNumber(value, field) {
  let normalized;
  if (typeof value === "bigint") {
    normalized = value;
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    normalized = BigInt(value);
  } else if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value.trim())) {
    normalized = BigInt(value.trim());
  } else {
    configurationError("AI_BUDGET_INVALID", `${field} must be an integer micro-USD amount.`);
  }
  if (normalized < 0n || normalized > MAX_SAFE_INTEGER_BIGINT) {
    configurationError("AI_BUDGET_INVALID", `${field} is outside the supported micro-USD range.`);
  }
  return Number(normalized);
}

export function resolveVisualProgressDailyBudgetMicros(
  value = process.env[AI_VISUAL_DAILY_BUDGET_ENV],
) {
  if (value == null || (typeof value === "string" && !value.trim())) {
    configurationError(
      "AI_BUDGET_NOT_CONFIGURED",
      `${AI_VISUAL_DAILY_BUDGET_ENV} must be configured before visual dispatch.`,
    );
  }
  const budget = safeMicrosNumber(value, AI_VISUAL_DAILY_BUDGET_ENV);
  if (budget <= 0) {
    configurationError("AI_BUDGET_INVALID", `${AI_VISUAL_DAILY_BUDGET_ENV} must be greater than zero.`);
  }
  return budget;
}

export function utcCivilDay(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    configurationError("AI_BUDGET_DAY_INVALID", "AI budget civil day is invalid.");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function readVisualProgressBudgetSnapshot(prisma, {
  organizationId,
  civilDayUtc,
  budgetLimitMicros,
  quotaPolicyVersion = AI_VISUAL_QUOTA_POLICY_VERSION,
} = {}) {
  if (!prisma?.aiDailyBudgetLedger?.findUnique) {
    configurationError("AI_BUDGET_LEDGER_UNAVAILABLE", "AI budget ledger is unavailable.");
  }
  const limit = resolveVisualProgressDailyBudgetMicros(budgetLimitMicros);
  const day = utcCivilDay(civilDayUtc);
  const row = await prisma.aiDailyBudgetLedger.findUnique({
    where: {
      organizationId_civilDayUtc_workload: {
        organizationId,
        civilDayUtc: day,
        workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
      },
    },
    select: {
      quotaPolicyVersion: true,
      budgetLimitMicros: true,
      reservedMicros: true,
      settledMicros: true,
    },
  });
  if (!row) {
    return {
      pricingVersion: AI_DISPATCH_PRICING_VERSION,
      budgetRemainingMicros: limit,
    };
  }
  const storedLimit = safeMicrosNumber(row.budgetLimitMicros, "ledger.budgetLimitMicros");
  const reserved = safeMicrosNumber(row.reservedMicros, "ledger.reservedMicros");
  const settled = safeMicrosNumber(row.settledMicros, "ledger.settledMicros");
  if (row.quotaPolicyVersion !== quotaPolicyVersion || storedLimit !== limit) {
    configurationError(
      "AI_BUDGET_POLICY_CHANGED",
      "AI budget policy cannot change within an active UTC civil day.",
    );
  }
  return {
    pricingVersion: AI_DISPATCH_PRICING_VERSION,
    budgetRemainingMicros: Math.max(0, limit - Math.min(limit, settled) - reserved),
  };
}

export function planVisualProgressDispatch({
  requestedModelId = null,
  allowedRolloutRoles = [MODEL_ROLLOUT_ROLES.PRIMARY],
  budgetRemainingMicros,
  maxRequestCostMicros = null,
} = {}) {
  const primary = resolvePrimaryVisualProgressModel();
  const selectedModelId = requestedModelId || null;
  const selected = (selectedModelId && MODEL_REGISTRY[selectedModelId]) || primary;
  const remaining = safeMicrosNumber(budgetRemainingMicros, "budgetRemainingMicros");
  const requestLimit = maxRequestCostMicros == null
    ? null
    : safeMicrosNumber(maxRequestCostMicros, "maxRequestCostMicros");

  return planAiDispatch({
    workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
    dataClass: AI_DISPATCH_DATA_CLASSES.CONFIDENTIAL,
    requiredCapabilities: [
      AI_DISPATCH_CAPABILITIES.VISION_INPUT,
      AI_DISPATCH_CAPABILITIES.STRUCTURED_OUTPUT,
      AI_DISPATCH_CAPABILITIES.REASONING,
    ],
    tenantPolicy: {
      allowedModelIds: [selectedModelId || primary.id],
      allowedAdapterIds: [selected.adapterId],
      allowedRolloutRoles,
      allowedDataClasses: [AI_DISPATCH_DATA_CLASSES.CONFIDENTIAL],
      ...(requestLimit == null ? {} : { maxRequestCostMicros: requestLimit }),
    },
    rolloutSnapshot: {
      selectedModelId,
      enabledModelIds: [selectedModelId || primary.id],
      enabledAdapterIds: [selected.adapterId],
      enabledRolloutRoles: allowedRolloutRoles,
    },
    budgetSnapshot: {
      pricingVersion: AI_DISPATCH_PRICING_VERSION,
      budgetRemainingMicros: remaining,
    },
  });
}
