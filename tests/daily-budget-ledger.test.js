import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_SETTLEMENT_BASES,
  AiBudgetLedgerError,
  reserveAiVisualBudget,
  settleAiVisualBudget,
} from "../src/lib/ai/daily-budget-ledger.js";

function reservation(overrides = {}) {
  return {
    assessmentId: "assessment-a",
    organizationId: "organization-a",
    projectId: "project-a",
    civilDayUtc: new Date("2026-07-28T00:00:00.000Z"),
    workload: "visual-progress",
    quotaPolicyVersion: "ai-visual-daily-budget-v1",
    budgetLimitMicros: 1_000_000n,
    reservedMicros: 250_000n,
    actualMicros: null,
    status: "RESERVED",
    settlementBasis: null,
    settlementOperationKeyHash: null,
    settlementEvidenceSha256: null,
    settledById: null,
    ...overrides,
  };
}

test("budget helpers bind SQL calls to one assessment and preserve bigint values as strings", async () => {
  const calls = [];
  const prisma = {
    async $queryRaw(strings, ...values) {
      calls.push({ sql: strings.join("?"), values });
      return [calls.length === 1
        ? reservation()
        : reservation({
          actualMicros: 320_000n,
          status: "SETTLED",
          settlementBasis: AI_SETTLEMENT_BASES.RESPONSE_USAGE,
          settlementOperationKeyHash: "a".repeat(64),
          settlementEvidenceSha256: "b".repeat(64),
        })];
    },
  };
  const reserved = await reserveAiVisualBudget(prisma, {
    assessmentId: "assessment-a",
    civilDayUtc: new Date("2026-07-28T20:00:00.000Z"),
    budgetLimitMicros: 1_000_000,
    reservationMicros: 250_000,
  });
  const settled = await settleAiVisualBudget(prisma, {
    assessmentId: "assessment-a",
    actualCostMicros: 320_000,
    settlementBasis: AI_SETTLEMENT_BASES.RESPONSE_USAGE,
    settlementOperationKeyHash: "a".repeat(64),
    settlementEvidenceSha256: "b".repeat(64),
  });

  assert.match(calls[0].sql, /obrasaas_ai_daily_budget_reserve/);
  assert.match(calls[1].sql, /obrasaas_ai_daily_budget_settle/);
  assert.equal(calls[0].values[0], "assessment-a");
  assert.equal(calls[0].values.at(-1), 250_000n);
  assert.equal(calls[1].values[0], "assessment-a");
  assert.equal(calls[1].values[1], 320_000n);
  assert.equal(calls[1].values[2], AI_SETTLEMENT_BASES.RESPONSE_USAGE);
  assert.equal(calls[1].values[3], "a".repeat(64));
  assert.equal(calls[1].values[4], "b".repeat(64));
  assert.equal(calls[1].values[5], null);
  assert.equal(reserved.reservedMicros, "250000");
  assert.equal(settled.actualMicros, "320000");
  assert.equal(settled.settlementBasis, AI_SETTLEMENT_BASES.RESPONSE_USAGE);
  assert.equal(settled.settlementOperationKeyHash, "a".repeat(64));
});

test("manual settlement provenance requires an actor and exact hashes", async () => {
  const prisma = { $queryRaw: async () => [] };
  await assert.rejects(
    settleAiVisualBudget(prisma, {
      assessmentId: "assessment-a",
      actualCostMicros: 1,
      settlementBasis: AI_SETTLEMENT_BASES.RECONCILED_USAGE,
      settlementOperationKeyHash: "a".repeat(64),
      settlementEvidenceSha256: "b".repeat(64),
      settledById: "actor-a",
    }),
    (error) => error instanceof AiBudgetLedgerError
      && error.code === "AI_BUDGET_INPUT_INVALID"
      && error.status === 400,
  );
  await assert.rejects(
    settleAiVisualBudget(prisma, {
      assessmentId: "assessment-a",
      actualCostMicros: 0,
      settlementBasis: AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE,
      settlementOperationKeyHash: "a".repeat(64),
      settlementEvidenceSha256: "b".repeat(64),
    }),
    (error) => error instanceof AiBudgetLedgerError
      && error.code === "AI_BUDGET_INPUT_INVALID"
      && error.status === 400,
  );
  await assert.rejects(
    settleAiVisualBudget(prisma, {
      assessmentId: "assessment-a",
      actualCostMicros: 1,
      settlementBasis: AI_SETTLEMENT_BASES.RESPONSE_USAGE,
      settlementOperationKeyHash: "not-a-hash",
      settlementEvidenceSha256: "b".repeat(64),
    }),
    (error) => error instanceof AiBudgetLedgerError
      && error.code === "AI_BUDGET_INPUT_INVALID",
  );
});

test("budget helper maps a known admission constraint without leaking database text", async () => {
  const prisma = {
    async $queryRaw() {
      const cause = new Error("private database details");
      cause.meta = { constraint: "AiDailyBudgetLedger_budget_exceeded" };
      throw cause;
    },
  };
  await assert.rejects(
    reserveAiVisualBudget(prisma, {
      assessmentId: "assessment-a",
      civilDayUtc: new Date("2026-07-28T00:00:00.000Z"),
      budgetLimitMicros: 1_000_000,
      reservationMicros: 250_000,
    }),
    (error) => (
      error instanceof AiBudgetLedgerError
      && error.code === "AI_DAILY_BUDGET_EXCEEDED"
      && error.status === 429
      && !error.message.includes("private")
    ),
  );
});

test("budget helper maps a rejected manual settlement actor to forbidden", async () => {
  const prisma = {
    async $queryRaw() {
      const cause = new Error("private database details");
      cause.meta = {
        constraint: "AiDispatchBudgetReservation_settlement_actor_guard",
      };
      throw cause;
    },
  };
  await assert.rejects(
    settleAiVisualBudget(prisma, {
      assessmentId: "assessment-a",
      actualCostMicros: 0,
      settlementBasis: AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE,
      settlementOperationKeyHash: "a".repeat(64),
      settlementEvidenceSha256: "b".repeat(64),
      settledById: "actor-a",
    }),
    (error) => (
      error instanceof AiBudgetLedgerError
      && error.code === "AI_BUDGET_SETTLEMENT_ACTOR_FORBIDDEN"
      && error.status === 403
      && !error.message.includes("private")
    ),
  );
});

test("budget helper maps database input and stale settlement guards to stable API errors", async () => {
  for (const [constraint, expectedCode, expectedStatus] of [
    ["AiDispatchBudgetReservation_settle_input_guard", "AI_BUDGET_INPUT_INVALID", 400],
    ["AiDispatchBudgetReservation_dispatch_start_guard", "AI_BUDGET_SETTLEMENT_PROVENANCE_INVALID", 409],
    ["AiDispatchBudgetReservation_settlement_guard", "AI_BUDGET_SETTLEMENT_CONFLICT", 409],
  ]) {
    const prisma = {
      async $queryRaw() {
        const cause = new Error("private database details");
        cause.meta = { constraint };
        throw cause;
      },
    };
    await assert.rejects(
      settleAiVisualBudget(prisma, {
        assessmentId: "assessment-a",
        actualCostMicros: 0,
        settlementBasis: AI_SETTLEMENT_BASES.CONFIRMED_NO_CHARGE,
        settlementOperationKeyHash: "a".repeat(64),
        settlementEvidenceSha256: "b".repeat(64),
        settledById: "superadmin-a",
      }),
      (error) => error instanceof AiBudgetLedgerError
        && error.code === expectedCode
        && error.status === expectedStatus
        && !error.message.includes("private"),
    );
  }
});
