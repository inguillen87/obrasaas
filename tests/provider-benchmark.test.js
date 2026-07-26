import assert from "node:assert/strict";
import test from "node:test";

import { compareVisualProviderOutputs } from "../src/lib/ai/provider-benchmark.js";

function assessment({ abstained = false } = {}) {
  return {
    schemaVersion: 1,
    abstained,
    abstentionReason: abstained ? "insufficient_context" : null,
    summary: abstained ? "La toma no alcanza para estimar." : "Se observa avance parcial.",
    elementType: abstained ? null : "mampostería",
    progressMin: abstained ? null : 30,
    progressMax: abstained ? null : 45,
    confidence: abstained ? 0.15 : 0.7,
    facts: abstained ? [] : ["Hay sectores ejecutados y sectores abiertos."],
    quality: {
      overall: abstained ? "insufficient" : "good",
      angle: abstained ? "insufficient" : "good",
      lighting: "good",
      occlusion: abstained ? "severe" : "none",
    },
    limitations: ["Evaluación basada en una sola imagen."],
  };
}

function observation(overrides = {}) {
  return {
    caseId: "case-1",
    registryModelId: "openai:gpt-5.6-sol",
    provider: "openai",
    model: "gpt-5.6-sol",
    assessment: assessment(),
    qualityScore: 0.9,
    expectedAbstention: false,
    latencyMs: 1_000,
    costUsd: 0.03,
    ...overrides,
  };
}

test("benchmark compares supplied outputs without invoking providers", () => {
  const calls = { value: 0 };
  const observations = [
    observation(),
    observation({
      caseId: "case-2",
      assessment: assessment({ abstained: true }),
      qualityScore: 0.8,
      expectedAbstention: true,
      latencyMs: 1_200,
      costUsd: 0.04,
    }),
    observation({
      registryModelId: "huggingface:qwen3-vl",
      provider: "huggingface",
      model: "Qwen/Qwen3-VL-32B-Instruct",
      qualityScore: 0.6,
      latencyMs: 800,
      costUsd: 0.01,
    }),
    observation({
      caseId: "case-2",
      registryModelId: "huggingface:qwen3-vl",
      provider: "huggingface",
      model: "Qwen/Qwen3-VL-32B-Instruct",
      assessment: assessment(),
      qualityScore: 0.3,
      expectedAbstention: true,
      latencyMs: 900,
      costUsd: 0.01,
    }),
  ];
  Object.defineProperty(observations, "providerCall", {
    get() {
      calls.value += 1;
      return null;
    },
  });

  const result = compareVisualProviderOutputs(observations);
  assert.equal(calls.value, 0);
  assert.equal(result.observationCount, 4);
  assert.equal(result.modelCount, 2);
  assert.equal(result.methodology.providerCallsPerformed, 0);
  assert.equal(result.rankings[0].registryModelId, "openai:gpt-5.6-sol");
  assert.ok(Math.abs(result.rankings[0].averageQuality - 0.85) < Number.EPSILON * 2);
  assert.equal(result.rankings[0].abstentionRate, 0.5);
  assert.equal(result.rankings[0].abstentionAgreementRate, 1);
  assert.equal(result.rankings[0].p95LatencyMs, 1_200);
  assert.equal(result.rankings[0].totalCostUsd, 0.07);
});

test("benchmark reports abstention without pretending agreement when ground truth is absent", () => {
  const result = compareVisualProviderOutputs([
    observation({ expectedAbstention: undefined, assessment: assessment({ abstained: true }) }),
  ]);
  assert.equal(result.rankings[0].abstentionRate, 1);
  assert.equal(result.rankings[0].abstentionAgreementRate, null);
  assert.equal(result.rankings[0].dimensionScores.abstentionAgreement, null);
});

test("benchmark rejects unvalidated or economically incomplete observations", () => {
  assert.throws(
    () => compareVisualProviderOutputs([observation({ qualityScore: 2 })]),
    /qualityScore/,
  );
  assert.throws(
    () => compareVisualProviderOutputs([observation({ costUsd: null })]),
    /costUsd/,
  );
  assert.throws(
    () => compareVisualProviderOutputs([observation({ provider: "huggingface" })]),
    /must match the visual model registry/,
  );
  assert.throws(
    () => compareVisualProviderOutputs([observation({ assessment: { abstained: false } })]),
    (error) => error.code === "PROVIDER_SCHEMA_INVALID",
  );
  assert.throws(
    () => compareVisualProviderOutputs([
      observation(),
      observation({
        caseId: "case-2",
        registryModelId: "huggingface:qwen3-vl",
        provider: "huggingface",
        model: "Qwen/Qwen3-VL-32B-Instruct",
      }),
    ]),
    /same case set/,
  );
  assert.throws(
    () => compareVisualProviderOutputs([observation()], {
      weights: { quality: 1, inventedMetric: 10 },
    }),
    /Unknown benchmark weight: inventedMetric/,
  );
});
