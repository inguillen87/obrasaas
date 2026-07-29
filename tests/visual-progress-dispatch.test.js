import assert from "node:assert/strict";
import test from "node:test";

import { MODEL_ROLLOUT_ROLES } from "../src/lib/ai/model-registry.js";
import {
  AI_VISUAL_QUOTA_POLICY_VERSION,
  AiVisualDispatchConfigurationError,
  planVisualProgressDispatch,
  readVisualProgressBudgetSnapshot,
  resolveVisualProgressDailyBudgetMicros,
  utcCivilDay,
} from "../src/lib/ai/visual-progress-dispatch.js";

test("visual AI budget configuration is explicit and integer micro-USD only", () => {
  for (const value of [undefined, "", "1.5", -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => resolveVisualProgressDailyBudgetMicros(value),
      (error) => error instanceof AiVisualDispatchConfigurationError,
    );
  }
  assert.equal(resolveVisualProgressDailyBudgetMicros("1000000"), 1_000_000);
});

test("budget snapshots preserve overrun truth and stop new admission", async () => {
  const day = utcCivilDay("2026-07-28T23:59:59.000Z");
  const prisma = {
    aiDailyBudgetLedger: {
      async findUnique() {
        return {
          quotaPolicyVersion: AI_VISUAL_QUOTA_POLICY_VERSION,
          budgetLimitMicros: 1_000_000n,
          reservedMicros: 0n,
          settledMicros: 1_250_000n,
        };
      },
    },
  };
  const snapshot = await readVisualProgressBudgetSnapshot(prisma, {
    organizationId: "org-a",
    civilDayUtc: day,
    budgetLimitMicros: 1_000_000,
  });
  assert.equal(snapshot.budgetRemainingMicros, 0);
});

test("budget snapshots fail closed when a policy changes during the UTC day", async () => {
  const prisma = {
    aiDailyBudgetLedger: {
      async findUnique() {
        return {
          quotaPolicyVersion: "stale-policy",
          budgetLimitMicros: 1_000_000n,
          reservedMicros: 0n,
          settledMicros: 0n,
        };
      },
    },
  };
  await assert.rejects(
    readVisualProgressBudgetSnapshot(prisma, {
      organizationId: "org-a",
      civilDayUtc: new Date("2026-07-28T12:00:00.000Z"),
      budgetLimitMicros: 1_000_000,
    }),
    (error) => error.code === "AI_BUDGET_POLICY_CHANGED",
  );
});

test("visual dispatch remains Sol by default and Terra requires an explicit shadow role", () => {
  const primary = planVisualProgressDispatch({ budgetRemainingMicros: 1_000_000 });
  assert.equal(primary.selected.registryModelId, "openai:gpt-5.6-sol");
  assert.equal(primary.routeReasonCode, "primary_default");

  assert.throws(
    () => planVisualProgressDispatch({
      requestedModelId: "openai:gpt-5.6-terra",
      budgetRemainingMicros: 1_000_000,
    }),
    (error) => error.code === "role_not_permitted",
  );
  const shadow = planVisualProgressDispatch({
    requestedModelId: "openai:gpt-5.6-terra",
    allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.SHADOW],
    budgetRemainingMicros: 1_000_000,
  });
  assert.equal(shadow.selected.registryModelId, "openai:gpt-5.6-terra");
  assert.equal(shadow.routeReasonCode, "rollout_explicit");
});
