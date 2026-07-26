import { validateVisualProgressAssessment } from "./visual-progress-provider.js";
import { MODEL_REGISTRY, MODEL_WORKLOADS } from "./model-registry.js";

const DEFAULT_WEIGHTS = Object.freeze({
  quality: 0.6,
  abstentionAgreement: 0.15,
  latency: 0.15,
  cost: 0.1,
});

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, quantile) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * ordered.length) - 1);
  return ordered[index];
}

function lowerIsBetter(value, values) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return 1;
  return 1 - (value - minimum) / (maximum - minimum);
}

function validateObservation(value) {
  if (!value || typeof value !== "object") throw new TypeError("Benchmark observation must be an object.");
  for (const key of ["caseId", "registryModelId", "provider", "model"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) {
      throw new TypeError(`Benchmark observation requires ${key}.`);
    }
  }
  const registered = MODEL_REGISTRY[value.registryModelId];
  if (
    !registered
    || registered.provider !== value.provider
    || registered.model !== value.model
    || !registered.workloads.includes(MODEL_WORKLOADS.VISUAL_PROGRESS)
  ) {
    throw new TypeError("Benchmark provider/model identity must match the visual model registry.");
  }
  validateVisualProgressAssessment(value.assessment);
  if (!Number.isFinite(value.qualityScore) || value.qualityScore < 0 || value.qualityScore > 1) {
    throw new RangeError("Benchmark qualityScore must be between 0 and 1.");
  }
  if (!Number.isFinite(value.latencyMs) || value.latencyMs < 0) {
    throw new RangeError("Benchmark latencyMs must be non-negative.");
  }
  if (!Number.isFinite(value.costUsd) || value.costUsd < 0) {
    throw new RangeError("Benchmark costUsd must be non-negative.");
  }
  if (value.expectedAbstention != null && typeof value.expectedAbstention !== "boolean") {
    throw new TypeError("Benchmark expectedAbstention must be boolean when provided.");
  }
  return value;
}

function validateWeights(weights) {
  if (weights != null && (typeof weights !== "object" || Array.isArray(weights))) {
    throw new TypeError("Benchmark weights must be an object.");
  }
  const allowedKeys = new Set(Object.keys(DEFAULT_WEIGHTS));
  const unknownKey = Object.keys(weights || {}).find((key) => !allowedKeys.has(key));
  if (unknownKey) throw new TypeError(`Unknown benchmark weight: ${unknownKey}.`);
  const result = { ...DEFAULT_WEIGHTS, ...weights };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`Benchmark weight ${key} is invalid.`);
  }
  if (Object.values(result).every((value) => value === 0)) {
    throw new RangeError("At least one benchmark weight must be positive.");
  }
  return result;
}

/**
 * Compares previously produced outputs. It is deliberately pure and never
 * invokes a provider or performs model fan-out.
 */
export function compareVisualProviderOutputs(observations, { weights } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new TypeError("At least one benchmark observation is required.");
  }
  const safeObservations = observations.map(validateObservation);
  const scoringWeights = validateWeights(weights);
  const grouped = new Map();
  for (const observation of safeObservations) {
    const current = grouped.get(observation.registryModelId) || [];
    current.push(observation);
    grouped.set(observation.registryModelId, current);
  }

  let expectedCaseIds = null;
  for (const [registryModelId, values] of grouped) {
    const caseIds = values.map((value) => value.caseId).sort();
    if (new Set(caseIds).size !== caseIds.length) {
      throw new TypeError(`Benchmark model ${registryModelId} contains a duplicate case.`);
    }
    expectedCaseIds ||= caseIds;
    if (
      caseIds.length !== expectedCaseIds.length
      || caseIds.some((caseId, index) => caseId !== expectedCaseIds[index])
    ) {
      throw new TypeError("Every benchmark model must cover the same case set.");
    }
  }

  const rows = [...grouped.entries()].map(([registryModelId, values]) => {
    const identities = new Set(values.map((value) => `${value.provider}:${value.model}`));
    if (identities.size !== 1) {
      throw new TypeError(`Benchmark model ${registryModelId} mixes provider identities.`);
    }
    const expectedCases = values.filter((value) => value.expectedAbstention != null);
    return {
      registryModelId,
      provider: values[0].provider,
      model: values[0].model,
      sampleCount: values.length,
      averageQuality: mean(values.map((value) => value.qualityScore)),
      abstentionRate: mean(values.map((value) => (value.assessment.abstained ? 1 : 0))),
      abstentionAgreementRate: expectedCases.length
        ? mean(expectedCases.map((value) => (value.assessment.abstained === value.expectedAbstention ? 1 : 0)))
        : null,
      averageLatencyMs: mean(values.map((value) => value.latencyMs)),
      p95LatencyMs: percentile(values.map((value) => value.latencyMs), 0.95),
      averageCostUsd: mean(values.map((value) => value.costUsd)),
      totalCostUsd: values.reduce((sum, value) => sum + value.costUsd, 0),
    };
  });

  const latencies = rows.map((row) => row.averageLatencyMs);
  const costs = rows.map((row) => row.averageCostUsd);
  const rankings = rows.map((row) => {
    const dimensions = {
      quality: row.averageQuality,
      abstentionAgreement: row.abstentionAgreementRate,
      latency: lowerIsBetter(row.averageLatencyMs, latencies),
      cost: lowerIsBetter(row.averageCostUsd, costs),
    };
    const active = Object.entries(dimensions).filter(([, value]) => value != null);
    const denominator = active.reduce((sum, [key]) => sum + scoringWeights[key], 0);
    const compositeScore = denominator
      ? active.reduce((sum, [key, value]) => sum + value * scoringWeights[key], 0) / denominator
      : 0;
    return { ...row, dimensionScores: dimensions, compositeScore };
  }).sort((left, right) =>
    right.compositeScore - left.compositeScore || left.registryModelId.localeCompare(right.registryModelId),
  );

  return {
    observationCount: safeObservations.length,
    modelCount: rankings.length,
    rankings,
    methodology: {
      weights: scoringWeights,
      qualitySource: "supplied-independent-evaluation",
      costSource: "caller-supplied-with-external-price-evidence-required",
      lowerIsBetter: ["latency", "cost"],
      providerCallsPerformed: 0,
      promotionDecision: "manual-only",
    },
  };
}
