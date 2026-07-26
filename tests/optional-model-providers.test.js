import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeVisualProgressWithHuggingFace,
  analyzeVisualProgressWithZai,
  extractDocumentWithGlmOcr,
  generateJsonWithGlm52,
} from "../src/lib/ai/optional-model-providers.js";

function pngChunk(type, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function pngFixture() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(640, 0);
  ihdr.writeUInt32BE(480, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", Buffer.from("GPS=private")),
    pngChunk("IDAT", Buffer.from([1, 2, 3])),
    pngChunk("IEND"),
  ]);
}

function assessment(overrides = {}) {
  return {
    schemaVersion: 1,
    abstained: false,
    abstentionReason: null,
    summary: "Se observa mampostería parcialmente ejecutada.",
    elementType: "mampostería",
    progressMin: 35,
    progressMax: 50,
    confidence: 0.74,
    facts: ["Hay hiladas construidas y un tramo superior abierto."],
    quality: { overall: "good", angle: "good", lighting: "good", occlusion: "none" },
    limitations: ["Una sola toma no permite medir toda la superficie."],
    ...overrides,
  };
}

function responseJson(result, { status = 200, requestId = "req_safe" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "x-request-id" ? requestId : null) },
    json: async () => result,
  };
}

test("Hugging Face adapter pins one explicit provider and normalizes a strict visual result", async () => {
  let request;
  const result = await analyzeVisualProgressWithHuggingFace({
    imageBuffer: pngFixture(),
    mimeType: "image/png",
    organizationId: "org_private",
    taskContext: { task: "Muro norte" },
    caption: "avance del día",
    apiKey: "hf_private_token",
    billTo: "obrasaas-evals",
    providerRoute: "featherless-ai",
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return responseJson({
        id: "hf_response",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(assessment()) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });
    },
  });

  assert.equal(request.url, "https://router.huggingface.co/v1/chat/completions");
  assert.equal(request.init.headers["X-HF-Bill-To"], "obrasaas-evals");
  assert.equal(request.body.model, "Qwen/Qwen3-VL-32B-Instruct:featherless-ai");
  assert.equal(request.body.model.includes(":fastest"), false);
  assert.equal(Object.hasOwn(request.body, "store"), false);
  assert.equal(request.body.response_format.type, "json_schema");
  assert.equal(request.body.response_format.json_schema.strict, true);
  const imageUrl = request.body.messages[1].content.find((part) => part.type === "image_url").image_url.url;
  assert.match(imageUrl, /^data:image\/png;base64,/);
  assert.equal(Buffer.from(imageUrl.split(",")[1], "base64").includes(Buffer.from("GPS=private")), false);
  assert.equal(result.providerRoute, "featherless-ai");
  assert.deepEqual(result.assessment, assessment());
  assert.deepEqual(result.usage, { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
});

test("Hugging Face adapter rejects automatic routing policies before fetch", async () => {
  let calls = 0;
  for (const providerRoute of [undefined, "auto", "fastest", "preferred", "cheapest", "some-provider"]) {
    await assert.rejects(
      analyzeVisualProgressWithHuggingFace({
        imageBuffer: pngFixture(),
        mimeType: "image/png",
        organizationId: "org_1",
        apiKey: "hf_test",
        providerRoute,
        fetchImpl: async () => {
          calls += 1;
        },
      }),
      (error) => ["PROVIDER_INPUT_INVALID", "PROVIDER_ROUTE_INVALID"].includes(error.code),
    );
  }
  assert.equal(calls, 0);
  await assert.rejects(
    analyzeVisualProgressWithHuggingFace({
      imageBuffer: pngFixture(),
      mimeType: "image/png",
      organizationId: "",
      apiKey: "hf_test",
      providerRoute: "featherless-ai",
      fetchImpl: async () => {
        calls += 1;
      },
    }),
    (error) => error.code === "PROVIDER_INPUT_INVALID",
  );
  assert.equal(calls, 0);
  await assert.rejects(
    analyzeVisualProgressWithHuggingFace({
      imageBuffer: pngFixture(),
      mimeType: "image/png",
      organizationId: "org_1",
      apiKey: "hf_test",
      billTo: "invalid billing/account",
      providerRoute: "featherless-ai",
      fetchImpl: async () => {
        calls += 1;
      },
    }),
    (error) => error.code === "PROVIDER_BILLING_ACCOUNT_INVALID",
  );
  assert.equal(calls, 0);
});

test("Z.ai GLM-5V adapter uses image-only model semantics and validates normalized output", async () => {
  let request;
  const result = await analyzeVisualProgressWithZai({
    imageBuffer: pngFixture(),
    mimeType: "image/png",
    organizationId: "tenant-do-not-send",
    taskContext: { task: "Muro norte" },
    apiKey: "zai_private_token",
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return responseJson({
        id: "zai_visual",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(assessment()) } }],
      });
    },
  });
  assert.equal(request.url, "https://api.z.ai/api/paas/v4/chat/completions");
  assert.equal(request.body.model, "glm-5v-turbo");
  assert.equal(Object.hasOwn(request.body, "response_format"), false);
  assert.equal(Object.hasOwn(request.body, "store"), false);
  assert.match(request.body.user_id, /^obs_[a-f0-9]{32}$/);
  assert.equal(request.body.user_id.includes("tenant-do-not-send"), false);
  assert.ok(request.body.messages[1].content.some((part) => part.type === "image_url"));
  assert.deepEqual(result.assessment, assessment());
});

test("GLM-OCR stays on layout parsing workload and returns a bounded normalized document", async () => {
  let request;
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: pngFixture(),
    mimeType: "image/png",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return responseJson({
        id: "ocr_task",
        model: "GLM-OCR",
        md_results: "# Remito\nHormigón H21",
        layout_details: [[{
          index: 1,
          label: "text",
          bbox_2d: [0.1, 0.1, 0.5, 0.2],
          content: "Hormigón H21",
          width: 640,
          height: 480,
        }]],
        data_info: { num_pages: 1 },
        request_id: "zai_req_ocr",
      });
    },
  });
  assert.equal(request.url, "https://api.z.ai/api/paas/v4/layout_parsing");
  assert.equal(request.body.model, "glm-ocr");
  assert.equal(request.body.return_crop_images, false);
  assert.equal(request.body.need_layout_visualization, false);
  assert.equal(Object.hasOwn(request.body, "store"), false);
  assert.match(request.body.file, /^data:image\/png;base64,/);
  assert.equal(result.markdown, "# Remito\nHormigón H21");
  assert.equal(result.layout[0][0].label, "text");
  assert.equal(result.pages, 1);
});

test("GLM-OCR PDF requests are explicitly bounded to the canonical 30-page window", async () => {
  let request;
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: Buffer.from("%PDF-1.7\nminimal test fixture"),
    mimeType: "application/pdf",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return responseJson({
        id: "ocr_pdf",
        model: "GLM-OCR",
        md_results: "",
        layout_details: [],
        data_info: { num_pages: 30 },
      });
    },
  });
  assert.equal(request.start_page_id, 0);
  assert.equal(request.end_page_id, 29);
  assert.deepEqual(result.pageWindow, {
    startPageId: 0,
    endPageId: 29,
    chunkingRequiredAbove: 30,
  });
});

test("GLM-OCR normalization enforces global page, item, character, and bbox budgets", async () => {
  const item = {
    index: 1,
    label: "text",
    bbox_2d: [-1, 0, 2, 1],
    content: "x".repeat(250),
    width: 640,
    height: 480,
  };
  const layoutDetails = Array.from({ length: 101 }, () =>
    Array.from({ length: 101 }, () => ({ ...item })),
  );
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: pngFixture(),
    mimeType: "image/png",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async () => responseJson({
      id: "ocr_adversarial",
      model: "GLM-OCR",
      md_results: "m".repeat(2_000_050),
      layout_details: layoutDetails,
    }),
  });
  const returnedItems = result.layout.flat();
  assert.ok(result.layout.length <= 30);
  assert.ok(returnedItems.length <= 10_000);
  assert.ok(returnedItems.reduce((sum, entry) => sum + entry.content.length, 0) <= 2_000_000);
  assert.equal(result.markdown.length, 2_000_000);
  assert.deepEqual(returnedItems[0].bbox, []);
});

test("GLM-5.2 adapter is text/JSON-only and never accepts an image modality", async () => {
  let calls = 0;
  await assert.rejects(
    generateJsonWithGlm52({
      systemPrompt: "Extraé datos.",
      userPrompt: "Texto",
      organizationId: "org_text",
      imageBuffer: pngFixture(),
      apiKey: "zai_text_private",
      fetchImpl: async () => {
        calls += 1;
      },
    }),
    (error) => error.code === "WORKLOAD_MODALITY_MISMATCH",
  );
  assert.equal(calls, 0);

  let request;
  const result = await generateJsonWithGlm52({
    systemPrompt: "Clasificá el texto administrativo.",
    userPrompt: "Factura pendiente de revisión.",
    organizationId: "org_text",
    outputValidator: (output) => output.kind === "invoice",
    apiKey: "zai_text_private",
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return responseJson({
        id: "text_response",
        choices: [{ finish_reason: "stop", message: { content: '{"kind":"invoice"}' } }],
      });
    },
  });
  assert.equal(request.body.model, "glm-5.2");
  assert.equal(request.body.response_format.type, "json_object");
  assert.deepEqual(request.body.thinking, { type: "disabled" });
  assert.equal(request.body.reasoning_effort, "none");
  assert.equal(typeof request.body.messages[1].content, "string");
  assert.equal(JSON.stringify(request.body).includes("image_url"), false);
  assert.equal(Object.hasOwn(request.body, "store"), false);
  assert.deepEqual(result.output, { kind: "invoice" });

  await assert.rejects(
    generateJsonWithGlm52({
      systemPrompt: "Clasificá.",
      userPrompt: "Texto",
      organizationId: "org_text",
      apiKey: "zai_text_private",
      fetchImpl: async () => { throw new Error("must not matter"); },
    }),
    (error) => error.code === "PROVIDER_INPUT_INVALID",
  );
  await assert.rejects(
    generateJsonWithGlm52({
      systemPrompt: "Clasificá.",
      userPrompt: "Texto",
      organizationId: "org_text",
      outputValidator: "not-callable",
      apiKey: "zai_text_private",
      fetchImpl: async () => { throw new Error("must not matter"); },
    }),
    (error) => error.code === "PROVIDER_INPUT_INVALID",
  );
  await assert.rejects(
    generateJsonWithGlm52({
      systemPrompt: "Clasificá.",
      userPrompt: "Texto",
      organizationId: "org_text",
      outputValidator: () => { throw new Error("private validator detail"); },
      apiKey: "zai_text_private",
      fetchImpl: async () => responseJson({
        choices: [{ finish_reason: "stop", message: { content: '{"kind":"invoice"}' } }],
      }),
    }),
    (error) => error.code === "PROVIDER_SCHEMA_INVALID" && !error.message.includes("private validator detail"),
  );
});

test("optional adapters cover response-body timeout and never leak credentials or raw errors", async () => {
  await assert.rejects(
    analyzeVisualProgressWithHuggingFace({
      imageBuffer: pngFixture(),
      mimeType: "image/png",
      organizationId: "org_1",
      apiKey: "hf_must_not_leak",
      providerRoute: "featherless-ai",
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) => ({
        ok: true,
        status: 200,
        headers: { get: () => "req_body" },
        json: () => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("hf_must_not_leak raw")), { once: true });
        }),
      }),
    }),
    (error) => {
      assert.equal(error.code, "PROVIDER_TIMEOUT");
      assert.equal(error.message.includes("hf_must_not_leak"), false);
      return true;
    },
  );
});
