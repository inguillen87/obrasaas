import {
  MODEL_CAPABILITIES,
  MODEL_DATA_CLASSES,
  MODEL_PRICING_VERSION,
  MODEL_REGISTRY,
  MODEL_ROLLOUT_ROLES,
  MODEL_WORKLOADS,
  listRegisteredModels,
} from "./model-registry.js";

export const AI_DISPATCH_ROUTE_POLICY_VERSION = "ai-dispatch-plan-v1";
export const AI_DISPATCH_PRICING_VERSION = MODEL_PRICING_VERSION;

export const AI_DISPATCH_REASON_CODES = Object.freeze({
  PRIMARY_DEFAULT: "primary_default",
  PRIMARY_EXPLICIT: "primary_explicit",
  ROLLOUT_EXPLICIT: "rollout_explicit",
});

export const AI_DISPATCH_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: "invalid_request",
  UNKNOWN_WORKLOAD: "unknown_workload",
  UNKNOWN_DATA_CLASS: "unknown_data_class",
  INVALID_CAPABILITIES: "invalid_capabilities",
  INVALID_TENANT_POLICY: "invalid_tenant_policy",
  INVALID_ROLLOUT_SNAPSHOT: "invalid_rollout_snapshot",
  INVALID_BUDGET_SNAPSHOT: "invalid_budget_snapshot",
  MODEL_NOT_REGISTERED: "model_not_registered",
  MODEL_NOT_PERMITTED: "model_not_permitted",
  ROLE_NOT_PERMITTED: "role_not_permitted",
  ADAPTER_NOT_PERMITTED: "adapter_not_permitted",
  WORKLOAD_NOT_SUPPORTED: "workload_not_supported",
  CAPABILITY_NOT_SUPPORTED: "capability_not_supported",
  DATA_CLASS_NOT_PERMITTED: "data_class_not_permitted",
  PRICING_UNAVAILABLE: "pricing_unavailable",
  PRICING_VERSION_MISMATCH: "pricing_version_mismatch",
  TENANT_COST_LIMIT_EXCEEDED: "tenant_cost_limit_exceeded",
  BUDGET_EXCEEDED: "budget_exceeded",
  INVALID_USAGE: "invalid_usage",
  COST_OVERFLOW: "cost_overflow",
});

const MAX_USAGE_TOKENS_PER_CATEGORY = 1_000_000_000;
const TOKENS_PER_PRICING_UNIT = 1_000_000n;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export class AiDispatchPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiDispatchPolicyError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new AiDispatchPolicyError(code, message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, code, label) {
  if (!isRecord(value)) fail(code, `${label} must be an object.`);
  return value;
}

function requireUniqueStringArray(value, code, label, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value)
    || (!allowEmpty && value.length === 0)
    || value.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    fail(code, `${label} must be ${allowEmpty ? "an" : "a non-empty"} array of strings.`);
  }
  if (new Set(value).size !== value.length) {
    fail(code, `${label} must not contain duplicates.`);
  }
  return [...value];
}

function requireSafeMicros(value, code, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(code, `${label} must be a non-negative safe integer in micro-USD.`);
  }
  return value;
}

function normalizeTenantPolicy(value) {
  const policy = requireRecord(
    value,
    AI_DISPATCH_ERROR_CODES.INVALID_TENANT_POLICY,
    "tenantPolicy",
  );
  const normalized = {
    allowedModelIds: requireUniqueStringArray(
      policy.allowedModelIds,
      AI_DISPATCH_ERROR_CODES.INVALID_TENANT_POLICY,
      "tenantPolicy.allowedModelIds",
    ),
    allowedAdapterIds: requireUniqueStringArray(
      policy.allowedAdapterIds,
      AI_DISPATCH_ERROR_CODES.INVALID_TENANT_POLICY,
      "tenantPolicy.allowedAdapterIds",
    ),
    allowedRolloutRoles: requireUniqueStringArray(
      policy.allowedRolloutRoles,
      AI_DISPATCH_ERROR_CODES.INVALID_TENANT_POLICY,
      "tenantPolicy.allowedRolloutRoles",
    ),
    allowedDataClasses: requireUniqueStringArray(
      policy.allowedDataClasses,
      AI_DISPATCH_ERROR_CODES.INVALID_TENANT_POLICY,
      "tenantPolicy.allowedDataClasses",
    ),
  };
  if (policy.maxRequestCostMicros != null) {
    normalized.maxRequestCostMicros = requireSafeMicros(
      policy.maxRequestCostMicros,
      AI_DISPATCH_ERROR_CODES.INVALID_TENANT_POLICY,
      "tenantPolicy.maxRequestCostMicros",
    );
  }
  return normalized;
}

function normalizeRolloutSnapshot(value) {
  const snapshot = requireRecord(
    value,
    AI_DISPATCH_ERROR_CODES.INVALID_ROLLOUT_SNAPSHOT,
    "rolloutSnapshot",
  );
  if (
    snapshot.selectedModelId != null
    && (typeof snapshot.selectedModelId !== "string" || !snapshot.selectedModelId.trim())
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.INVALID_ROLLOUT_SNAPSHOT,
      "rolloutSnapshot.selectedModelId must be a non-empty string when provided.",
    );
  }
  return {
    selectedModelId: snapshot.selectedModelId || null,
    enabledModelIds: requireUniqueStringArray(
      snapshot.enabledModelIds,
      AI_DISPATCH_ERROR_CODES.INVALID_ROLLOUT_SNAPSHOT,
      "rolloutSnapshot.enabledModelIds",
    ),
    enabledAdapterIds: requireUniqueStringArray(
      snapshot.enabledAdapterIds,
      AI_DISPATCH_ERROR_CODES.INVALID_ROLLOUT_SNAPSHOT,
      "rolloutSnapshot.enabledAdapterIds",
    ),
    enabledRolloutRoles: requireUniqueStringArray(
      snapshot.enabledRolloutRoles,
      AI_DISPATCH_ERROR_CODES.INVALID_ROLLOUT_SNAPSHOT,
      "rolloutSnapshot.enabledRolloutRoles",
    ),
  };
}

function normalizeBudgetSnapshot(value) {
  const snapshot = requireRecord(
    value,
    AI_DISPATCH_ERROR_CODES.INVALID_BUDGET_SNAPSHOT,
    "budgetSnapshot",
  );
  if (snapshot.pricingVersion !== AI_DISPATCH_PRICING_VERSION) {
    fail(
      AI_DISPATCH_ERROR_CODES.PRICING_VERSION_MISMATCH,
      `Budget pricing version must be ${AI_DISPATCH_PRICING_VERSION}.`,
    );
  }
  return {
    pricingVersion: snapshot.pricingVersion,
    budgetRemainingMicros: requireSafeMicros(
      snapshot.budgetRemainingMicros,
      AI_DISPATCH_ERROR_CODES.INVALID_BUDGET_SNAPSHOT,
      "budgetSnapshot.budgetRemainingMicros",
    ),
  };
}

function selectRegistryModel(workload, selectedModelId) {
  if (selectedModelId) {
    const selected = MODEL_REGISTRY[selectedModelId];
    if (!selected) {
      fail(
        AI_DISPATCH_ERROR_CODES.MODEL_NOT_REGISTERED,
        `Model ${selectedModelId} is not registered.`,
      );
    }
    return selected;
  }

  const primaries = listRegisteredModels({ workload }).filter(
    (entry) => entry.rolloutRole === MODEL_ROLLOUT_ROLES.PRIMARY,
  );
  if (primaries.length !== 1) {
    fail(
      AI_DISPATCH_ERROR_CODES.MODEL_NOT_REGISTERED,
      `Workload ${workload} must have exactly one registered primary model.`,
    );
  }
  return primaries[0];
}

function assertRoutePermission(selected, tenantPolicy, rolloutSnapshot) {
  if (
    !tenantPolicy.allowedModelIds.includes(selected.id)
    || !rolloutSnapshot.enabledModelIds.includes(selected.id)
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.MODEL_NOT_PERMITTED,
      `Model ${selected.id} is not permitted by both tenant policy and rollout snapshot.`,
    );
  }
  if (
    !tenantPolicy.allowedRolloutRoles.includes(selected.rolloutRole)
    || !rolloutSnapshot.enabledRolloutRoles.includes(selected.rolloutRole)
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.ROLE_NOT_PERMITTED,
      `Rollout role ${selected.rolloutRole} is not permitted by both policy snapshots.`,
    );
  }
  if (
    !tenantPolicy.allowedAdapterIds.includes(selected.adapterId)
    || !rolloutSnapshot.enabledAdapterIds.includes(selected.adapterId)
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.ADAPTER_NOT_PERMITTED,
      `Adapter ${selected.adapterId} is not permitted by both policy snapshots.`,
    );
  }
}

function assertPricing(selected, pricingVersion) {
  const pricing = selected.pricing;
  if (!pricing) {
    fail(
      AI_DISPATCH_ERROR_CODES.PRICING_UNAVAILABLE,
      `Model ${selected.id} has no approved dispatch pricing.`,
    );
  }
  if (pricing.version !== pricingVersion) {
    fail(
      AI_DISPATCH_ERROR_CODES.PRICING_VERSION_MISMATCH,
      `Model ${selected.id} pricing is not approved for ${pricingVersion}.`,
    );
  }
  for (const key of [
    "inputMicrosPerMillionTokens",
    "cachedInputMicrosPerMillionTokens",
    "outputMicrosPerMillionTokens",
    "preDispatchReservationMicros",
  ]) {
    requireSafeMicros(
      pricing[key],
      AI_DISPATCH_ERROR_CODES.PRICING_UNAVAILABLE,
      `model pricing ${key}`,
    );
  }
  return pricing;
}

/**
 * Produces one provider route from policy metadata before any request bytes are
 * read. It never calls a provider and intentionally exposes no fallback route.
 */
export function planAiDispatch(input) {
  const request = requireRecord(
    input,
    AI_DISPATCH_ERROR_CODES.INVALID_REQUEST,
    "AI dispatch request",
  );
  const workload = request.workload;
  if (!Object.values(MODEL_WORKLOADS).includes(workload)) {
    fail(AI_DISPATCH_ERROR_CODES.UNKNOWN_WORKLOAD, `Unknown workload: ${String(workload)}.`);
  }
  const dataClass = request.dataClass;
  if (!Object.values(MODEL_DATA_CLASSES).includes(dataClass)) {
    fail(AI_DISPATCH_ERROR_CODES.UNKNOWN_DATA_CLASS, `Unknown data class: ${String(dataClass)}.`);
  }
  const requiredCapabilities = requireUniqueStringArray(
    request.requiredCapabilities,
    AI_DISPATCH_ERROR_CODES.INVALID_CAPABILITIES,
    "requiredCapabilities",
    { allowEmpty: true },
  );
  const tenantPolicy = normalizeTenantPolicy(request.tenantPolicy);
  const rolloutSnapshot = normalizeRolloutSnapshot(request.rolloutSnapshot);
  const budgetSnapshot = normalizeBudgetSnapshot(request.budgetSnapshot);
  const selected = selectRegistryModel(workload, rolloutSnapshot.selectedModelId);

  if (!selected.workloads.includes(workload)) {
    fail(
      AI_DISPATCH_ERROR_CODES.WORKLOAD_NOT_SUPPORTED,
      `Model ${selected.id} does not support workload ${workload}.`,
    );
  }
  assertRoutePermission(selected, tenantPolicy, rolloutSnapshot);
  if (!tenantPolicy.allowedDataClasses.includes(dataClass) || !selected.dataClasses.includes(dataClass)) {
    fail(
      AI_DISPATCH_ERROR_CODES.DATA_CLASS_NOT_PERMITTED,
      `Data class ${dataClass} is not permitted for model ${selected.id}.`,
    );
  }
  const missingCapability = requiredCapabilities.find(
    (capability) => !selected.capabilities.includes(capability),
  );
  if (missingCapability) {
    fail(
      AI_DISPATCH_ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
      `Model ${selected.id} does not support capability ${missingCapability}.`,
    );
  }

  const pricing = assertPricing(selected, budgetSnapshot.pricingVersion);
  const budgetReservationMicros = pricing.preDispatchReservationMicros;
  if (
    tenantPolicy.maxRequestCostMicros != null
    && budgetReservationMicros > tenantPolicy.maxRequestCostMicros
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.TENANT_COST_LIMIT_EXCEEDED,
      `Route reservation exceeds the tenant per-request cost limit.`,
    );
  }
  if (budgetSnapshot.budgetRemainingMicros < budgetReservationMicros) {
    fail(
      AI_DISPATCH_ERROR_CODES.BUDGET_EXCEEDED,
      `Route reservation exceeds the remaining AI budget.`,
    );
  }

  const explicitSelection = Boolean(rolloutSnapshot.selectedModelId);
  const routeReasonCode = !explicitSelection
    ? AI_DISPATCH_REASON_CODES.PRIMARY_DEFAULT
    : selected.rolloutRole === MODEL_ROLLOUT_ROLES.PRIMARY
      ? AI_DISPATCH_REASON_CODES.PRIMARY_EXPLICIT
      : AI_DISPATCH_REASON_CODES.ROLLOUT_EXPLICIT;

  return Object.freeze({
    routePolicyVersion: AI_DISPATCH_ROUTE_POLICY_VERSION,
    pricingVersion: budgetSnapshot.pricingVersion,
    routeReasonCode,
    workload,
    dataClass,
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    selected: Object.freeze({
      registryModelId: selected.id,
      model: selected.model,
      provider: selected.provider,
      adapterId: selected.adapterId,
      rolloutRole: selected.rolloutRole,
    }),
    estimateBasis: "pre-byte-conservative-cap",
    estimatedCostMicros: budgetReservationMicros,
    budgetReservationMicros,
    budgetRemainingAfterReservationMicros:
      budgetSnapshot.budgetRemainingMicros - budgetReservationMicros,
  });
}

function requireUsageTokens(value, label) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_USAGE_TOKENS_PER_CATEGORY
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
      `${label} must be a non-negative safe integer no greater than ${MAX_USAGE_TOKENS_PER_CATEGORY}.`,
    );
  }
  return value;
}

/**
 * Reconciles a completed dispatch against the same versioned registry prices.
 * Cached input is a subset of total input and is charged at its discounted rate.
 */
export function calculateDispatchCostMicros(plan, usage) {
  const dispatchPlan = requireRecord(
    plan,
    AI_DISPATCH_ERROR_CODES.INVALID_REQUEST,
    "dispatch plan",
  );
  if (dispatchPlan.routePolicyVersion !== AI_DISPATCH_ROUTE_POLICY_VERSION) {
    fail(AI_DISPATCH_ERROR_CODES.INVALID_REQUEST, "Dispatch route policy version is invalid.");
  }
  if (dispatchPlan.pricingVersion !== AI_DISPATCH_PRICING_VERSION) {
    fail(
      AI_DISPATCH_ERROR_CODES.PRICING_VERSION_MISMATCH,
      "Dispatch plan pricing version is stale or unknown.",
    );
  }
  const selectedPlan = requireRecord(
    dispatchPlan.selected,
    AI_DISPATCH_ERROR_CODES.INVALID_REQUEST,
    "dispatch plan selected route",
  );
  const selected = MODEL_REGISTRY[selectedPlan.registryModelId];
  if (
    !selected
    || selected.model !== selectedPlan.model
    || selected.provider !== selectedPlan.provider
    || selected.adapterId !== selectedPlan.adapterId
    || selected.rolloutRole !== selectedPlan.rolloutRole
  ) {
    fail(
      AI_DISPATCH_ERROR_CODES.MODEL_NOT_REGISTERED,
      "Dispatch plan route identity does not match the current registry.",
    );
  }
  const pricing = assertPricing(selected, dispatchPlan.pricingVersion);
  const observedUsage = requireRecord(
    usage,
    AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
    "usage",
  );
  const inputTokens = requireUsageTokens(observedUsage.inputTokens, "usage.inputTokens");
  const cachedInputTokens = requireUsageTokens(
    observedUsage.cachedInputTokens ?? 0,
    "usage.cachedInputTokens",
  );
  const cacheWriteTokens = requireUsageTokens(
    observedUsage.cacheWriteTokens,
    "usage.cacheWriteTokens",
  );
  const outputTokens = requireUsageTokens(observedUsage.outputTokens, "usage.outputTokens");
  if (cachedInputTokens > inputTokens) {
    fail(
      AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
      "usage.cachedInputTokens cannot exceed usage.inputTokens.",
    );
  }
  if (cacheWriteTokens !== 0) {
    fail(
      AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
      "usage.cacheWriteTokens must be zero for the explicit no-breakpoint cache policy.",
    );
  }

  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const costNumerator =
    BigInt(uncachedInputTokens) * BigInt(pricing.inputMicrosPerMillionTokens)
    + BigInt(cachedInputTokens) * BigInt(pricing.cachedInputMicrosPerMillionTokens)
    + BigInt(outputTokens) * BigInt(pricing.outputMicrosPerMillionTokens);
  const roundedMicros = (costNumerator + TOKENS_PER_PRICING_UNIT - 1n)
    / TOKENS_PER_PRICING_UNIT;
  if (roundedMicros > MAX_SAFE_INTEGER_BIGINT) {
    fail(
      AI_DISPATCH_ERROR_CODES.COST_OVERFLOW,
      "Calculated dispatch cost cannot be represented as a safe integer.",
    );
  }
  return Number(roundedMicros);
}

export {
  MODEL_CAPABILITIES as AI_DISPATCH_CAPABILITIES,
  MODEL_DATA_CLASSES as AI_DISPATCH_DATA_CLASSES,
};
