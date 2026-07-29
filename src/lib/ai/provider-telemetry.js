function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizedCachedInputTokens(usage, detailKeys, inputTokens) {
  const reported = [];
  for (const detailKey of detailKeys) {
    if (!Object.hasOwn(usage, detailKey) || usage[detailKey] == null) continue;
    const details = usage[detailKey];
    if (!isRecord(details)) return { valid: false, value: null };
    if (!Object.hasOwn(details, "cached_tokens") || details.cached_tokens == null) continue;
    const value = nonNegativeSafeInteger(details.cached_tokens);
    if (value == null || value > inputTokens) return { valid: false, value: null };
    reported.push(value);
  }
  if (reported.some((value) => value !== reported[0])) return { valid: false, value: null };
  return { valid: true, value: reported.length > 0 ? reported[0] : null };
}

function normalizedExplicitResponsesCacheTelemetry(usage, inputTokens) {
  if (!Object.hasOwn(usage, "input_tokens_details")) {
    return { valid: false, cachedInputTokens: null, cacheWriteTokens: null };
  }
  const details = usage.input_tokens_details;
  if (!isRecord(details)) {
    return { valid: false, cachedInputTokens: null, cacheWriteTokens: null };
  }
  const cachedInputTokens = nonNegativeSafeInteger(details.cached_tokens);
  const cacheWriteTokens = nonNegativeSafeInteger(details.cache_write_tokens);
  if (
    cachedInputTokens == null
    || cachedInputTokens > inputTokens
    || cacheWriteTokens == null
    || cacheWriteTokens !== 0
  ) {
    return { valid: false, cachedInputTokens: null, cacheWriteTokens: null };
  }
  return { valid: true, cachedInputTokens, cacheWriteTokens };
}

function normalizeTokenUsage(usage, { inputKey, outputKey, detailKeys }) {
  if (!isRecord(usage)) return null;
  const inputTokens = nonNegativeSafeInteger(usage[inputKey]);
  const outputTokens = nonNegativeSafeInteger(usage[outputKey]);
  const totalTokens = nonNegativeSafeInteger(usage.total_tokens);
  if (inputTokens == null || outputTokens == null || totalTokens == null) return null;
  if (inputTokens > Number.MAX_SAFE_INTEGER - outputTokens) return null;
  if (totalTokens !== inputTokens + outputTokens) return null;

  const cached = normalizedCachedInputTokens(usage, detailKeys, inputTokens);
  if (!cached.valid) return null;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens: cached.value,
  };
}

export function normalizeResponsesUsage(usage) {
  const normalized = normalizeTokenUsage(usage, {
    inputKey: "input_tokens",
    outputKey: "output_tokens",
    detailKeys: [],
  });
  if (!normalized) return null;
  const cache = normalizedExplicitResponsesCacheTelemetry(usage, normalized.inputTokens);
  if (!cache.valid) return null;
  return {
    ...normalized,
    cachedInputTokens: cache.cachedInputTokens,
    cacheWriteTokens: cache.cacheWriteTokens,
  };
}

export function normalizeChatCompletionsUsage(usage) {
  return normalizeTokenUsage(usage, {
    inputKey: "prompt_tokens",
    outputKey: "completion_tokens",
    detailKeys: ["prompt_tokens_details", "input_tokens_details"],
  });
}

/**
 * Copies only an explicit USD total reported by the provider. Pricing remains
 * outside adapters because model rates, tiers, cache writes and discounts are
 * mutable billing policy rather than response normalization.
 */
export function normalizeProviderReportedCostUsd(payload) {
  if (!isRecord(payload)) return null;
  const usage = isRecord(payload.usage) ? payload.usage : null;
  const candidates = [
    usage && Object.hasOwn(usage, "cost_usd") ? usage.cost_usd : undefined,
    Object.hasOwn(payload, "cost_usd") ? payload.cost_usd : undefined,
  ].filter((value) => value !== undefined && value !== null);
  if (candidates.length === 0) return null;
  if (candidates.some((value) => (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > Number.MAX_SAFE_INTEGER
  ))) return null;
  if (candidates.some((value) => value !== candidates[0])) return null;
  return Object.is(candidates[0], -0) ? 0 : candidates[0];
}
