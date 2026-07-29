import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProviderReportedCostUsd,
  normalizeResponsesUsage,
} from "../src/lib/ai/provider-telemetry.js";

test("Responses telemetry requires explicit-cache counters and rejects cache writes", () => {
  const base = {
    input_tokens: 120,
    output_tokens: 30,
    total_tokens: 150,
  };
  assert.deepEqual(normalizeResponsesUsage({
    ...base,
    input_tokens_details: { cached_tokens: 40, cache_write_tokens: 0 },
  }), {
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    cachedInputTokens: 40,
    cacheWriteTokens: 0,
  });

  const invalidDetails = [
    undefined,
    null,
    {},
    { cached_tokens: 40 },
    { cache_write_tokens: 0 },
    { cached_tokens: -1, cache_write_tokens: 0 },
    { cached_tokens: 1.5, cache_write_tokens: 0 },
    { cached_tokens: 121, cache_write_tokens: 0 },
    { cached_tokens: 40, cache_write_tokens: -1 },
    { cached_tokens: 40, cache_write_tokens: 0.5 },
    { cached_tokens: 40, cache_write_tokens: 1 },
  ];
  for (const details of invalidDetails) {
    assert.equal(normalizeResponsesUsage({
      ...base,
      ...(details === undefined ? {} : { input_tokens_details: details }),
    }), null);
  }
});

test("provider cost telemetry accepts only an explicitly USD-denominated field", () => {
  assert.equal(normalizeProviderReportedCostUsd({ usage: { cost_usd: 0.0042 } }), 0.0042);
  assert.equal(normalizeProviderReportedCostUsd({ cost_usd: 0.0042 }), 0.0042);
  assert.equal(normalizeProviderReportedCostUsd({ usage: { cost: 0.0042 } }), null);
  assert.equal(normalizeProviderReportedCostUsd({ cost: 0.0042 }), null);
  assert.equal(normalizeProviderReportedCostUsd({ usage: { cost_usd: 0.0042 }, cost_usd: 0.005 }), null);
});
