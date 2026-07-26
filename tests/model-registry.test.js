import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_REGISTRY,
  MODEL_ROLLOUT_ROLES,
  MODEL_WORKLOADS,
  listRegisteredModels,
  resolvePrimaryVisualProgressModel,
  resolveRegisteredModel,
} from "../src/lib/ai/model-registry.js";

test("the visual registry has one primary and does not make shadow/challenger eligible by default", () => {
  const models = listRegisteredModels({ workload: MODEL_WORKLOADS.VISUAL_PROGRESS });
  assert.deepEqual(
    models.map(({ id, rolloutRole }) => ({ id, rolloutRole })),
    [
      { id: "openai:gpt-5.6-sol", rolloutRole: "primary" },
      { id: "huggingface:qwen3-vl", rolloutRole: "shadow" },
      { id: "z-ai:glm-5v-turbo", rolloutRole: "challenger" },
    ],
  );
  assert.equal(resolvePrimaryVisualProgressModel().id, "openai:gpt-5.6-sol");
  assert.throws(
    () =>
      resolveRegisteredModel({
        workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
        modelId: "huggingface:qwen3-vl",
      }),
    /explicit enablement/,
  );
});

test("a non-primary visual model requires an explicit single-model rollout decision", () => {
  assert.throws(
    () => resolveRegisteredModel({
      workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
      modelId: "z-ai:glm-5v-turbo",
      allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.CHALLENGER],
    }),
    /requires explicit adapter zai-chat-visual/,
  );
  const selected = resolveRegisteredModel({
    workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
    modelId: "z-ai:glm-5v-turbo",
    allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.CHALLENGER],
    enabledAdapterIds: ["zai-chat-visual"],
  });
  assert.equal(selected.id, "z-ai:glm-5v-turbo");
  assert.equal(selected.adapterId, "zai-chat-visual");
});

test("GLM-OCR is OCR-only and GLM-5.2 is text-only", () => {
  assert.deepEqual(MODEL_REGISTRY["z-ai:glm-ocr"].workloads, [MODEL_WORKLOADS.OCR]);
  assert.deepEqual(MODEL_REGISTRY["z-ai:glm-5.2"].workloads, [MODEL_WORKLOADS.TEXT]);
  assert.throws(
    () =>
      resolveRegisteredModel({
        workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
        modelId: "z-ai:glm-5.2",
        allowedRolloutRoles: [MODEL_ROLLOUT_ROLES.SPECIALIST],
      }),
    /supports visual-progress/,
  );
});
