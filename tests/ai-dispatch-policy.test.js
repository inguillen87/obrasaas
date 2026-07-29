import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_DISPATCH_CAPABILITIES,
  AI_DISPATCH_DATA_CLASSES,
  AI_DISPATCH_ERROR_CODES,
  AI_DISPATCH_PRICING_VERSION,
  AI_DISPATCH_REASON_CODES,
  AI_DISPATCH_ROUTE_POLICY_VERSION,
  AiDispatchPolicyError,
  calculateDispatchCostMicros,
  planAiDispatch,
} from "../src/lib/ai/dispatch-policy.js";
import {
  MODEL_ROLLOUT_ROLES,
  MODEL_WORKLOADS,
} from "../src/lib/ai/model-registry.js";

function primaryRequest(overrides = {}) {
  return {
    workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
    dataClass: AI_DISPATCH_DATA_CLASSES.CONFIDENTIAL,
    requiredCapabilities: [
      AI_DISPATCH_CAPABILITIES.VISION_INPUT,
      AI_DISPATCH_CAPABILITIES.STRUCTURED_OUTPUT,
    ],
    tenantPolicy: {
      allowedModelIds: ["openai:gpt-5.6-sol"],
      allowedAdapterIds: ["openai-responses-visual"],
      allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.PRIMARY],
      allowedDataClasses: [AI_DISPATCH_DATA_CLASSES.CONFIDENTIAL],
      ...overrides.tenantPolicy,
    },
    rolloutSnapshot: {
      selectedModelId: null,
      enabledModelIds: ["openai:gpt-5.6-sol"],
      enabledAdapterIds: ["openai-responses-visual"],
      enabledRolloutRoles: [MODEL_ROLLOUT_ROLES.PRIMARY],
      ...overrides.rolloutSnapshot,
    },
    budgetSnapshot: {
      pricingVersion: AI_DISPATCH_PRICING_VERSION,
      budgetRemainingMicros: 500_000,
      ...overrides.budgetSnapshot,
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([key]) => !["tenantPolicy", "rolloutSnapshot", "budgetSnapshot"].includes(key),
      ),
    ),
  };
}

function terraRequest(overrides = {}) {
  return primaryRequest({
    tenantPolicy: {
      allowedModelIds: ["openai:gpt-5.6-terra"],
      allowedAdapterIds: ["openai-responses-visual"],
      allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.SHADOW],
      allowedDataClasses: [AI_DISPATCH_DATA_CLASSES.CONFIDENTIAL],
      ...overrides.tenantPolicy,
    },
    rolloutSnapshot: {
      selectedModelId: "openai:gpt-5.6-terra",
      enabledModelIds: ["openai:gpt-5.6-terra"],
      enabledAdapterIds: ["openai-responses-visual"],
      enabledRolloutRoles: [MODEL_ROLLOUT_ROLES.SHADOW],
      ...overrides.rolloutSnapshot,
    },
    budgetSnapshot: overrides.budgetSnapshot,
    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([key]) => !["tenantPolicy", "rolloutSnapshot", "budgetSnapshot"].includes(key),
      ),
    ),
  });
}

function assertPolicyError(code, operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof AiDispatchPolicyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("default planning selects exactly one Sol route before bytes with a bounded reservation", () => {
  const request = primaryRequest();
  const first = planAiDispatch(request);
  const second = planAiDispatch(request);

  assert.deepEqual(first, second);
  assert.deepEqual(first.selected, {
    registryModelId: "openai:gpt-5.6-sol",
    model: "gpt-5.6-sol",
    provider: "openai",
    adapterId: "openai-responses-visual",
    rolloutRole: "primary",
  });
  assert.equal(first.routePolicyVersion, AI_DISPATCH_ROUTE_POLICY_VERSION);
  assert.equal(first.pricingVersion, "2026-07-28");
  assert.equal(first.routeReasonCode, AI_DISPATCH_REASON_CODES.PRIMARY_DEFAULT);
  assert.equal(first.estimateBasis, "pre-byte-conservative-cap");
  assert.equal(first.estimatedCostMicros, 250_000);
  assert.equal(first.budgetReservationMicros, 250_000);
  assert.equal(first.budgetRemainingAfterReservationMicros, 250_000);
  assert.equal(Object.hasOwn(first, "fallback"), false);
  assert.equal(Object.hasOwn(first, "candidates"), false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.selected), true);
});

test("Terra is selected only by one explicit shadow route and reserves its conservative cap", () => {
  const plan = planAiDispatch(terraRequest());
  assert.equal(plan.selected.registryModelId, "openai:gpt-5.6-terra");
  assert.equal(plan.selected.model, "gpt-5.6-terra");
  assert.equal(plan.selected.rolloutRole, MODEL_ROLLOUT_ROLES.SHADOW);
  assert.equal(plan.routeReasonCode, AI_DISPATCH_REASON_CODES.ROLLOUT_EXPLICIT);
  assert.equal(plan.estimatedCostMicros, 125_000);
  assert.equal(plan.budgetReservationMicros, 125_000);
});

test("Terra fails closed unless tenant and rollout snapshots permit its model, role, and adapter", () => {
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.MODEL_NOT_PERMITTED,
    () => planAiDispatch(terraRequest({
      tenantPolicy: { allowedModelIds: ["openai:gpt-5.6-sol"] },
    })),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.ROLE_NOT_PERMITTED,
    () => planAiDispatch(terraRequest({
      tenantPolicy: { allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.PRIMARY] },
    })),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.ADAPTER_NOT_PERMITTED,
    () => planAiDispatch(terraRequest({
      rolloutSnapshot: { enabledAdapterIds: ["some-other-adapter"] },
    })),
  );
});

test("an explicit disallowed or unknown model never falls back to Sol", () => {
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.MODEL_NOT_REGISTERED,
    () => planAiDispatch(primaryRequest({
      rolloutSnapshot: { selectedModelId: "openai:not-a-model" },
    })),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.MODEL_NOT_PERMITTED,
    () => planAiDispatch(primaryRequest({
      rolloutSnapshot: {
        selectedModelId: "openai:gpt-5.6-terra",
        enabledModelIds: ["openai:gpt-5.6-sol"],
      },
    })),
  );
});

test("data classification and required capabilities are enforced before pricing", () => {
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.DATA_CLASS_NOT_PERMITTED,
    () => planAiDispatch(primaryRequest({
      dataClass: AI_DISPATCH_DATA_CLASSES.RESTRICTED,
      tenantPolicy: {
        allowedDataClasses: [AI_DISPATCH_DATA_CLASSES.RESTRICTED],
      },
    })),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
    () => planAiDispatch(primaryRequest({
      requiredCapabilities: [AI_DISPATCH_CAPABILITIES.OCR],
    })),
  );
});

test("stale pricing, a tenant limit, or insufficient remaining budget blocks dispatch", () => {
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.PRICING_VERSION_MISMATCH,
    () => planAiDispatch(primaryRequest({
      budgetSnapshot: { pricingVersion: "stale" },
    })),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.TENANT_COST_LIMIT_EXCEEDED,
    () => planAiDispatch(primaryRequest({
      tenantPolicy: { maxRequestCostMicros: 249_999 },
    })),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.BUDGET_EXCEEDED,
    () => planAiDispatch(primaryRequest({
      budgetSnapshot: { budgetRemainingMicros: 249_999 },
    })),
  );
});

test("actual-cost reconciliation uses versioned rates and discounts only cached input", () => {
  const sol = planAiDispatch(primaryRequest());
  assert.equal(calculateDispatchCostMicros(sol, {
    inputTokens: 1_000_000,
    cachedInputTokens: 200_000,
    cacheWriteTokens: 0,
    outputTokens: 100_000,
  }), 7_100_000);

  const terra = planAiDispatch(terraRequest());
  assert.equal(calculateDispatchCostMicros(terra, {
    inputTokens: 1_000_000,
    cachedInputTokens: 200_000,
    cacheWriteTokens: 0,
    outputTokens: 100_000,
  }), 3_550_000);
  assert.equal(calculateDispatchCostMicros(terra, {
    inputTokens: 1,
    cachedInputTokens: 1,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }), 1);
});

test("actual-cost reconciliation rejects malformed usage and tampered plan identity", () => {
  const plan = planAiDispatch(primaryRequest());
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
    () => calculateDispatchCostMicros(plan, {
      inputTokens: 10,
      cachedInputTokens: 11,
      cacheWriteTokens: 0,
      outputTokens: 0,
    }),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
    () => calculateDispatchCostMicros(plan, {
      inputTokens: 10,
      cachedInputTokens: 0,
      cacheWriteTokens: 1,
      outputTokens: 0,
    }),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
    () => calculateDispatchCostMicros(plan, {
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 0,
    }),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.INVALID_USAGE,
    () => calculateDispatchCostMicros(plan, {
      inputTokens: 1.5,
      outputTokens: 0,
    }),
  );
  assertPolicyError(
    AI_DISPATCH_ERROR_CODES.MODEL_NOT_REGISTERED,
    () => calculateDispatchCostMicros({
      ...plan,
      selected: { ...plan.selected, model: "different-model" },
    }, {
      inputTokens: 0,
      outputTokens: 0,
    }),
  );
});
