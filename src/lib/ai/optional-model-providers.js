import { createHash } from "node:crypto";

import {
  MODEL_ROLLOUT_ROLES,
  MODEL_WORKLOADS,
  resolveRegisteredModel,
} from "./model-registry.js";
import {
  VISUAL_PROGRESS_JSON_SCHEMA,
  VisualProgressProviderError,
  createVisualProgressPrompt,
  validateAndSanitizeVisualImage,
  validateVisualProgressAssessment,
} from "./visual-progress-provider.js";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const ZAI_CHAT_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_OCR_URL = "https://api.z.ai/api/paas/v4/layout_parsing";
const DEFAULT_TIMEOUT_MS = 55_000;
const ZAI_VISION_MAX_BYTES = 5 * 1024 * 1024;
const ZAI_OCR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ZAI_OCR_PDF_MAX_BYTES = 50 * 1024 * 1024;
// The canonical layout_parsing API currently documents a 30-page window.
const MAX_OCR_PAGES = 30;
const MAX_OCR_LAYOUT_ITEMS = 10_000;
const MAX_OCR_LAYOUT_CHARACTERS = 2_000_000;
const MAX_OCR_ITEM_CHARACTERS = 20_000;
const MAX_OCR_MARKDOWN_CHARACTERS = 2_000_000;
const ALLOWED_HF_ROUTES = new Set(["featherless-ai"]);

function fail(code, message, details) {
  throw new VisualProgressProviderError(code, message, details);
}

function boundedString(value, maxLength, { required = false } = {}) {
  const result = String(value || "").trim().slice(0, maxLength);
  if (required && !result) fail("PROVIDER_INPUT_INVALID", "A required provider input is missing.");
  return result;
}

function pseudonymousUserId(organizationId, purpose) {
  const organization = boundedString(organizationId, 300, { required: true });
  return `obs_${createHash("sha256")
    .update(`obrasaas-${purpose}-v1:${organization}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function requestIdFrom(response) {
  return response?.headers?.get?.("x-request-id") || response?.headers?.get?.("request-id") || null;
}

async function fetchProviderJson({
  url,
  apiKey,
  body,
  extraHeaders = {},
  fetchImpl,
  timeoutMs,
  providerName,
}) {
  const controller = new AbortController();
  let timer;
  const request = (async () => {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          ...extraHeaders,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        fail("PROVIDER_TIMEOUT", `${providerName} timed out.`);
      }
      fail("PROVIDER_NETWORK_ERROR", `${providerName} could not be reached.`);
    }
    const requestId = requestIdFrom(response);
    if (!response?.ok) {
      fail("PROVIDER_HTTP_ERROR", `${providerName} failed with HTTP ${response?.status || "unknown"}.`, {
        status: response?.status || null,
        requestId,
      });
    }
    try {
      return { result: await response.json(), requestId };
    } catch {
      if (controller.signal.aborted) fail("PROVIDER_TIMEOUT", `${providerName} timed out.`, { requestId });
      fail("PROVIDER_RESPONSE_INVALID", `${providerName} returned invalid JSON.`, { requestId });
    }
  })();
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new VisualProgressProviderError("PROVIDER_TIMEOUT", `${providerName} timed out.`));
    }, Math.max(1, timeoutMs));
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function optionalHuggingFaceBillingAccount(value) {
  const account = String(value || "").trim();
  if (!account) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(account)) {
    fail("PROVIDER_BILLING_ACCOUNT_INVALID", "Hugging Face billing account is invalid.");
  }
  return account;
}

function normalizeUsage(usage) {
  const integer = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  return {
    inputTokens: integer(usage?.prompt_tokens),
    outputTokens: integer(usage?.completion_tokens),
    totalTokens: integer(usage?.total_tokens),
  };
}

function chatContent(result, providerName) {
  const choice = Array.isArray(result?.choices) ? result.choices[0] : null;
  const finishReason = choice?.finish_reason || null;
  if (["content_filter", "sensitive"].includes(finishReason)) {
    fail("PROVIDER_REFUSAL", `${providerName} refused the request.`);
  }
  if (finishReason && finishReason !== "stop") {
    fail("PROVIDER_INCOMPLETE", `${providerName} returned an incomplete response.`);
  }
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    fail("PROVIDER_RESPONSE_INVALID", `${providerName} returned no output.`);
  }
  return content;
}

function parseVisualAssessment(content, providerName) {
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    fail("PROVIDER_SCHEMA_INVALID", `${providerName} visual output failed schema validation.`);
  }
  return validateVisualProgressAssessment(value);
}

function visualResult({ provider, model, route, result, requestId, assessment, image }) {
  return {
    provider,
    model,
    ...(route ? { providerRoute: route } : {}),
    responseId: typeof result?.id === "string" ? result.id : null,
    requestId: requestId || (typeof result?.request_id === "string" ? result.request_id : null),
    assessment,
    usage: normalizeUsage(result?.usage),
    input: {
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      originalBytes: image.originalBytes,
      safeBytes: image.safeBytes,
      inputSha256: image.inputSha256,
      submittedSha256: image.submittedSha256,
    },
  };
}

function assertExplicitRegistrySelection({ workload, modelId, role, adapterId }) {
  return resolveRegisteredModel({
    workload,
    modelId,
    allowedRolloutRoles: [role],
    enabledAdapterIds: [adapterId],
  });
}

export async function analyzeVisualProgressWithHuggingFace({
  imageBuffer,
  mimeType,
  organizationId,
  taskContext,
  caption,
  apiKey = process.env.HF_TOKEN?.trim(),
  billTo = process.env.HF_BILL_TO?.trim(),
  providerRoute = process.env.HF_QWEN3_VL_PROVIDER?.trim(),
  model = process.env.HF_VISION_MODEL?.trim() || "Qwen/Qwen3-VL-32B-Instruct",
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const selected = assertExplicitRegistrySelection({
    workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
    modelId: "huggingface:qwen3-vl",
    role: MODEL_ROLLOUT_ROLES.SHADOW,
    adapterId: "huggingface-inference-visual",
  });
  if (!apiKey) fail("PROVIDER_NOT_CONFIGURED", "Hugging Face visual analysis is not configured.");
  pseudonymousUserId(organizationId, "hf-visual");
  const route = boundedString(providerRoute, 64, { required: true }).toLowerCase();
  const billingAccount = optionalHuggingFaceBillingAccount(billTo);
  if (!ALLOWED_HF_ROUTES.has(route)) {
    fail("PROVIDER_ROUTE_INVALID", "Hugging Face provider route is not in the governed allowlist.");
  }
  if (model !== selected.model) fail("PROVIDER_MODEL_INVALID", "Hugging Face visual model is not registered.");
  if (typeof fetchImpl !== "function") fail("PROVIDER_NOT_CONFIGURED", "A fetch implementation is required.");

  const image = validateAndSanitizeVisualImage({ buffer: imageBuffer, mimeType });
  const prompt = createVisualProgressPrompt({ taskContext, caption });
  const body = {
    model: `${model}:${route}`,
    stream: false,
    max_tokens: 1_800,
    messages: [
      { role: "system", content: prompt.system },
      {
        role: "user",
        content: [
          { type: "text", text: prompt.user },
          {
            type: "image_url",
            image_url: { url: `data:${image.mimeType};base64,${image.safeBuffer.toString("base64")}` },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "visual_progress_assessment_v1",
        strict: true,
        schema: VISUAL_PROGRESS_JSON_SCHEMA,
      },
    },
  };
  const { result, requestId } = await fetchProviderJson({
    url: HF_CHAT_URL,
    apiKey,
    body,
    extraHeaders: billingAccount ? { "X-HF-Bill-To": billingAccount } : {},
    fetchImpl,
    timeoutMs,
    providerName: "Hugging Face visual analysis",
  });
  const assessment = parseVisualAssessment(chatContent(result, "Hugging Face visual analysis"), "Hugging Face");
  return visualResult({ provider: "huggingface", model, route, result, requestId, assessment, image });
}

export async function analyzeVisualProgressWithZai({
  imageBuffer,
  mimeType,
  organizationId,
  taskContext,
  caption,
  apiKey = process.env.ZAI_API_KEY?.trim(),
  model = process.env.ZAI_VISION_MODEL?.trim() || "glm-5v-turbo",
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const selected = assertExplicitRegistrySelection({
    workload: MODEL_WORKLOADS.VISUAL_PROGRESS,
    modelId: "z-ai:glm-5v-turbo",
    role: MODEL_ROLLOUT_ROLES.CHALLENGER,
    adapterId: "zai-chat-visual",
  });
  if (!apiKey) fail("PROVIDER_NOT_CONFIGURED", "Z.ai visual analysis is not configured.");
  if (model !== selected.model) fail("PROVIDER_MODEL_INVALID", "Z.ai visual model is not registered.");
  if (typeof fetchImpl !== "function") fail("PROVIDER_NOT_CONFIGURED", "A fetch implementation is required.");

  const image = validateAndSanitizeVisualImage({ buffer: imageBuffer, mimeType });
  if (!["image/jpeg", "image/png"].includes(image.mimeType)) {
    fail("IMAGE_TYPE_UNSUPPORTED", "Z.ai visual analysis supports JPEG and PNG images for this adapter.");
  }
  if (image.safeBytes > ZAI_VISION_MAX_BYTES || image.width > 6_000 || image.height > 6_000) {
    fail("IMAGE_PROVIDER_LIMIT_EXCEEDED", "Image exceeds the Z.ai visual input limit.");
  }
  const prompt = createVisualProgressPrompt({ taskContext, caption });
  const body = {
    model,
    user_id: pseudonymousUserId(organizationId, "zai-visual"),
    stream: false,
    thinking: { type: "enabled" },
    max_tokens: 1_800,
    messages: [
      { role: "system", content: `${prompt.system}\nEl objeto debe cumplir este esquema: ${JSON.stringify(VISUAL_PROGRESS_JSON_SCHEMA)}` },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${image.mimeType};base64,${image.safeBuffer.toString("base64")}` },
          },
          { type: "text", text: prompt.user },
        ],
      },
    ],
  };
  const { result, requestId } = await fetchProviderJson({
    url: ZAI_CHAT_URL,
    apiKey,
    body,
    fetchImpl,
    timeoutMs,
    providerName: "Z.ai visual analysis",
  });
  const assessment = parseVisualAssessment(chatContent(result, "Z.ai visual analysis"), "Z.ai");
  return visualResult({ provider: "z-ai", model, result, requestId, assessment, image });
}

function ocrInput({ fileBuffer, mimeType }) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    fail("OCR_FILE_REQUIRED", "A non-empty OCR file is required.");
  }
  const normalizedMime = String(mimeType || "").split(";", 1)[0].trim().toLowerCase();
  if (normalizedMime === "application/pdf") {
    if (fileBuffer.length > ZAI_OCR_PDF_MAX_BYTES) fail("OCR_FILE_TOO_LARGE", "PDF exceeds the Z.ai OCR limit.");
    if (!fileBuffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      fail("OCR_MIME_MISMATCH", "Declared PDF MIME type does not match its binary signature.");
    }
    return { buffer: fileBuffer, mimeType: normalizedMime };
  }
  const image = validateAndSanitizeVisualImage({ buffer: fileBuffer, mimeType: normalizedMime });
  if (!["image/jpeg", "image/png"].includes(image.mimeType)) {
    fail("OCR_TYPE_UNSUPPORTED", "Z.ai OCR supports PDF, JPEG, and PNG inputs.");
  }
  if (image.safeBytes > ZAI_OCR_IMAGE_MAX_BYTES) fail("OCR_FILE_TOO_LARGE", "Image exceeds the Z.ai OCR limit.");
  return { buffer: image.safeBuffer, mimeType: image.mimeType };
}

function normalizeOcrLayout(value) {
  if (!Array.isArray(value)) return [];
  const pages = [];
  let remainingItems = MAX_OCR_LAYOUT_ITEMS;
  let remainingCharacters = MAX_OCR_LAYOUT_CHARACTERS;
  for (const sourcePage of value.slice(0, MAX_OCR_PAGES)) {
    if (remainingItems === 0 || remainingCharacters === 0) break;
    const page = [];
    for (const item of Array.isArray(sourcePage) ? sourcePage : []) {
      if (remainingItems === 0 || remainingCharacters === 0) break;
      const sourceContent = typeof item?.content === "string" ? item.content : "";
      const content = sourceContent.slice(
        0,
        Math.min(MAX_OCR_ITEM_CHARACTERS, remainingCharacters),
      );
      const bbox = Array.isArray(item?.bbox_2d)
        && item.bbox_2d.length === 4
        && item.bbox_2d.every((coordinate) => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1)
        ? [...item.bbox_2d]
        : [];
      page.push({
        index: Number.isInteger(item?.index) && item.index >= 0 ? item.index : null,
        label: ["image", "text", "formula", "table"].includes(item?.label) ? item.label : null,
        bbox,
        content,
        width: Number.isInteger(item?.width) && item.width > 0 ? item.width : null,
        height: Number.isInteger(item?.height) && item.height > 0 ? item.height : null,
      });
      remainingItems -= 1;
      remainingCharacters -= content.length;
    }
    pages.push(page);
  }
  return pages;
}

export async function extractDocumentWithGlmOcr({
  fileBuffer,
  mimeType,
  organizationId,
  apiKey = process.env.ZAI_API_KEY?.trim(),
  model = process.env.ZAI_OCR_MODEL?.trim() || "glm-ocr",
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const selected = assertExplicitRegistrySelection({
    workload: MODEL_WORKLOADS.OCR,
    modelId: "z-ai:glm-ocr",
    role: MODEL_ROLLOUT_ROLES.SPECIALIST,
    adapterId: "zai-layout-ocr",
  });
  if (!apiKey) fail("PROVIDER_NOT_CONFIGURED", "Z.ai OCR is not configured.");
  if (model !== selected.model) fail("PROVIDER_MODEL_INVALID", "Z.ai OCR model is not registered.");
  const input = ocrInput({ fileBuffer, mimeType });
  const inputSha256 = createHash("sha256").update(input.buffer).digest("hex");
  const body = {
    model,
    file: `data:${input.mimeType};base64,${input.buffer.toString("base64")}`,
    return_crop_images: false,
    need_layout_visualization: false,
    user_id: pseudonymousUserId(organizationId, "zai-ocr"),
    ...(input.mimeType === "application/pdf"
      ? { start_page_id: 0, end_page_id: MAX_OCR_PAGES - 1 }
      : {}),
  };
  const { result, requestId } = await fetchProviderJson({
    url: ZAI_OCR_URL,
    apiKey,
    body,
    fetchImpl,
    timeoutMs,
    providerName: "Z.ai OCR",
  });
  if (typeof result?.id !== "string" || typeof result?.model !== "string") {
    fail("PROVIDER_RESPONSE_INVALID", "Z.ai OCR returned an invalid result.", { requestId });
  }
  return {
    provider: "z-ai",
    model,
    responseId: result.id,
    requestId: requestId || (typeof result.request_id === "string" ? result.request_id : null),
    markdown: typeof result.md_results === "string"
      ? result.md_results.slice(0, MAX_OCR_MARKDOWN_CHARACTERS)
      : "",
    layout: normalizeOcrLayout(result.layout_details),
    pages: Number.isInteger(result?.data_info?.num_pages) ? result.data_info.num_pages : null,
    usage: normalizeUsage(result.usage),
    input: { mimeType: input.mimeType, bytes: input.buffer.length, inputSha256 },
    pageWindow: input.mimeType === "application/pdf"
      ? { startPageId: 0, endPageId: MAX_OCR_PAGES - 1, chunkingRequiredAbove: MAX_OCR_PAGES }
      : null,
  };
}

export async function generateJsonWithGlm52(options = {}) {
  const forbiddenInputs = ["imageBuffer", "imageUrl", "file", "fileBuffer", "mimeType"];
  if (forbiddenInputs.some((key) => Object.hasOwn(options, key))) {
    fail("WORKLOAD_MODALITY_MISMATCH", "GLM-5.2 integration accepts text only, never images or files.");
  }
  const {
    systemPrompt,
    userPrompt,
    organizationId,
    outputValidator,
    apiKey = process.env.ZAI_API_KEY?.trim(),
    model = process.env.ZAI_TEXT_MODEL?.trim() || "glm-5.2",
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  if (typeof outputValidator !== "function") {
    fail("PROVIDER_INPUT_INVALID", "Z.ai GLM-5.2 requires a callable output validator.");
  }
  const selected = assertExplicitRegistrySelection({
    workload: MODEL_WORKLOADS.TEXT,
    modelId: "z-ai:glm-5.2",
    role: MODEL_ROLLOUT_ROLES.SPECIALIST,
    adapterId: "zai-chat-text-json",
  });
  if (!apiKey) fail("PROVIDER_NOT_CONFIGURED", "Z.ai GLM-5.2 text integration is not configured.");
  if (model !== selected.model) fail("PROVIDER_MODEL_INVALID", "Z.ai text model is not registered.");
  const system = boundedString(systemPrompt, 12_000, { required: true });
  const user = boundedString(userPrompt, 40_000, { required: true });
  const body = {
    model,
    user_id: pseudonymousUserId(organizationId, "zai-text"),
    stream: false,
    thinking: { type: "disabled" },
    reasoning_effort: "none",
    max_tokens: 4_096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${system}\nRespondé únicamente con un objeto JSON válido.` },
      { role: "user", content: user },
    ],
  };
  const { result, requestId } = await fetchProviderJson({
    url: ZAI_CHAT_URL,
    apiKey,
    body,
    fetchImpl,
    timeoutMs,
    providerName: "Z.ai GLM-5.2 text generation",
  });
  const content = chatContent(result, "Z.ai GLM-5.2 text generation");
  let output;
  try {
    output = JSON.parse(content);
  } catch {
    fail("PROVIDER_SCHEMA_INVALID", "Z.ai GLM-5.2 returned invalid JSON.", { requestId });
  }
  if (!output || Array.isArray(output) || typeof output !== "object") {
    fail("PROVIDER_SCHEMA_INVALID", "Z.ai GLM-5.2 must return a JSON object.", { requestId });
  }
  let applicationOutputValid = false;
  try {
    applicationOutputValid = outputValidator(output) === true;
  } catch {
    applicationOutputValid = false;
  }
  if (!applicationOutputValid) {
    fail("PROVIDER_SCHEMA_INVALID", "Z.ai GLM-5.2 output failed application validation.", { requestId });
  }
  return {
    provider: "z-ai",
    model,
    responseId: typeof result.id === "string" ? result.id : null,
    requestId: requestId || (typeof result.request_id === "string" ? result.request_id : null),
    output,
    usage: normalizeUsage(result.usage),
  };
}
