const WORKLOADS = Object.freeze({
  VISUAL_PROGRESS: "visual-progress",
  OCR: "ocr",
  TEXT: "text",
});

const ROLLOUT_ROLES = Object.freeze({
  PRIMARY: "primary",
  SHADOW: "shadow",
  CHALLENGER: "challenger",
  SPECIALIST: "specialist",
});

const CAPABILITIES = Object.freeze({
  VISION_INPUT: "vision-input",
  STRUCTURED_OUTPUT: "structured-output",
  REASONING: "reasoning",
  OCR: "ocr",
  LAYOUT_EXTRACTION: "layout-extraction",
  TEXT_GENERATION: "text-generation",
});

const DATA_CLASSES = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
  CONFIDENTIAL: "confidential",
  RESTRICTED: "restricted",
});

export const MODEL_PRICING_VERSION = "2026-07-28";

const OPENAI_DATA_CLASSES = Object.freeze([
  DATA_CLASSES.PUBLIC,
  DATA_CLASSES.INTERNAL,
  DATA_CLASSES.CONFIDENTIAL,
]);

const COMMUNITY_DATA_CLASSES = Object.freeze([
  DATA_CLASSES.PUBLIC,
  DATA_CLASSES.INTERNAL,
]);

const entries = [
  {
    id: "openai:gpt-5.6-sol",
    provider: "openai",
    adapterId: "openai-responses-visual",
    model: "gpt-5.6-sol",
    rolloutRole: ROLLOUT_ROLES.PRIMARY,
    optInRequired: false,
    workloads: [WORKLOADS.VISUAL_PROGRESS],
    capabilities: [
      CAPABILITIES.VISION_INPUT,
      CAPABILITIES.STRUCTURED_OUTPUT,
      CAPABILITIES.REASONING,
    ],
    dataClasses: OPENAI_DATA_CLASSES,
    pricing: {
      version: MODEL_PRICING_VERSION,
      inputMicrosPerMillionTokens: 5_000_000,
      cachedInputMicrosPerMillionTokens: 500_000,
      outputMicrosPerMillionTokens: 30_000_000,
      preDispatchReservationMicros: 250_000,
    },
  },
  {
    id: "openai:gpt-5.6-terra",
    provider: "openai",
    adapterId: "openai-responses-visual",
    model: "gpt-5.6-terra",
    rolloutRole: ROLLOUT_ROLES.SHADOW,
    optInRequired: true,
    workloads: [WORKLOADS.VISUAL_PROGRESS],
    capabilities: [
      CAPABILITIES.VISION_INPUT,
      CAPABILITIES.STRUCTURED_OUTPUT,
      CAPABILITIES.REASONING,
    ],
    dataClasses: OPENAI_DATA_CLASSES,
    pricing: {
      version: MODEL_PRICING_VERSION,
      inputMicrosPerMillionTokens: 2_500_000,
      cachedInputMicrosPerMillionTokens: 250_000,
      outputMicrosPerMillionTokens: 15_000_000,
      preDispatchReservationMicros: 125_000,
    },
  },
  {
    id: "huggingface:qwen3-vl",
    provider: "huggingface",
    adapterId: "huggingface-inference-visual",
    model: "Qwen/Qwen3-VL-32B-Instruct",
    rolloutRole: ROLLOUT_ROLES.SHADOW,
    optInRequired: true,
    workloads: [WORKLOADS.VISUAL_PROGRESS],
    capabilities: [CAPABILITIES.VISION_INPUT, CAPABILITIES.STRUCTURED_OUTPUT],
    dataClasses: COMMUNITY_DATA_CLASSES,
  },
  {
    id: "z-ai:glm-5v-turbo",
    provider: "z-ai",
    adapterId: "zai-chat-visual",
    model: "glm-5v-turbo",
    rolloutRole: ROLLOUT_ROLES.CHALLENGER,
    optInRequired: true,
    workloads: [WORKLOADS.VISUAL_PROGRESS],
    capabilities: [CAPABILITIES.VISION_INPUT, CAPABILITIES.STRUCTURED_OUTPUT],
    dataClasses: COMMUNITY_DATA_CLASSES,
  },
  {
    id: "z-ai:glm-ocr",
    provider: "z-ai",
    adapterId: "zai-layout-ocr",
    model: "glm-ocr",
    rolloutRole: ROLLOUT_ROLES.SPECIALIST,
    optInRequired: true,
    workloads: [WORKLOADS.OCR],
    capabilities: [CAPABILITIES.OCR, CAPABILITIES.LAYOUT_EXTRACTION],
    dataClasses: COMMUNITY_DATA_CLASSES,
  },
  {
    id: "z-ai:glm-5.2",
    provider: "z-ai",
    adapterId: "zai-chat-text-json",
    model: "glm-5.2",
    rolloutRole: ROLLOUT_ROLES.SPECIALIST,
    optInRequired: true,
    workloads: [WORKLOADS.TEXT],
    capabilities: [CAPABILITIES.TEXT_GENERATION, CAPABILITIES.STRUCTURED_OUTPUT],
    dataClasses: COMMUNITY_DATA_CLASSES,
  },
];

export const MODEL_WORKLOADS = WORKLOADS;
export const MODEL_ROLLOUT_ROLES = ROLLOUT_ROLES;
export const MODEL_CAPABILITIES = CAPABILITIES;
export const MODEL_DATA_CLASSES = DATA_CLASSES;

function freezeRegistryEntry(entry) {
  return Object.freeze({
    ...entry,
    workloads: Object.freeze([...entry.workloads]),
    capabilities: Object.freeze([...entry.capabilities]),
    dataClasses: Object.freeze([...entry.dataClasses]),
    ...(entry.pricing ? { pricing: Object.freeze({ ...entry.pricing }) } : {}),
  });
}

export const MODEL_REGISTRY = Object.freeze(
  Object.fromEntries(
    entries.map((entry) => [
      entry.id,
      freezeRegistryEntry(entry),
    ]),
  ),
);

export function listRegisteredModels({ workload } = {}) {
  return Object.values(MODEL_REGISTRY).filter(
    (entry) => !workload || entry.workloads.includes(workload),
  );
}

/**
 * Resolves exactly one model. Shadow and challenger models are registry metadata,
 * never an instruction to fan requests out automatically.
 */
export function resolveRegisteredModel({
  workload,
  modelId,
  allowedRolloutRoles = [ROLLOUT_ROLES.PRIMARY],
  enabledAdapterIds = ["openai-responses-visual"],
} = {}) {
  if (!Object.values(WORKLOADS).includes(workload)) {
    throw new Error(`Unknown model workload: ${String(workload || "missing")}.`);
  }

  const candidates = listRegisteredModels({ workload });
  const selected = modelId
    ? MODEL_REGISTRY[modelId]
    : candidates.find((entry) => entry.rolloutRole === ROLLOUT_ROLES.PRIMARY);

  if (!selected || !selected.workloads.includes(workload)) {
    throw new Error(`No registered model ${modelId ? `for id ${modelId}` : ""} supports ${workload}.`);
  }
  if (!allowedRolloutRoles.includes(selected.rolloutRole)) {
    throw new Error(
      `Model ${selected.id} has rollout role ${selected.rolloutRole}; explicit enablement is required.`,
    );
  }
  if (selected.optInRequired && !enabledAdapterIds.includes(selected.adapterId)) {
    throw new Error(
      `Model ${selected.id} requires explicit adapter ${selected.adapterId}.`,
    );
  }

  return selected;
}

export function resolvePrimaryVisualProgressModel() {
  return resolveRegisteredModel({ workload: WORKLOADS.VISUAL_PROGRESS });
}
