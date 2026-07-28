import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

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

async function pdfFixture(pageCount, { title = null } = {}) {
  const document = await PDFDocument.create();
  if (title) document.setTitle(title);
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([300 + (index % 3), 500 + (index % 5)]);
  }
  return Buffer.from(await document.save({ addDefaultPage: false, useObjectStreams: true }));
}

async function submittedPdfPageCount(dataUrl) {
  const encoded = String(dataUrl || "").split(",", 2)[1];
  const document = await PDFDocument.load(Buffer.from(encoded, "base64"), {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  return document.getPageCount();
}

async function submittedPdfTitle(dataUrl) {
  const encoded = String(dataUrl || "").split(",", 2)[1];
  const document = await PDFDocument.load(Buffer.from(encoded, "base64"), {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  return document.getTitle();
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

test("GLM-OCR requires the provider to report exactly one page for an image", async () => {
  await assert.rejects(
    extractDocumentWithGlmOcr({
      fileBuffer: pngFixture(),
      mimeType: "image/png",
      organizationId: "org_ocr",
      apiKey: "zai_ocr_private",
      fetchImpl: async () => responseJson({
        id: "ocr_image_without_page_count",
        model: "GLM-OCR",
        layout_details: [[]],
      }),
    }),
    (error) => error.code === "OCR_PAGE_COUNT_INVALID",
  );
});

test("GLM-OCR PDF requests follow the internal 30-page chunk policy", async () => {
  const requests = [];
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: await pdfFixture(30),
    mimeType: "application/pdf",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      requests.push({ request, submittedPages: await submittedPdfPageCount(request.file) });
      return responseJson({
        id: "ocr_pdf",
        model: "GLM-OCR",
        md_results: "",
        layout_details: Array.from({ length: 30 }, () => []),
        data_info: { num_pages: 30 },
      });
    },
  });
  assert.equal(requests.length, 1);
  assert.equal(Object.hasOwn(requests[0].request, "start_page_id"), false);
  assert.equal(Object.hasOwn(requests[0].request, "end_page_id"), false);
  assert.equal(requests[0].submittedPages, 30);
  assert.deepEqual(result.pageWindow, {
    startPageId: 1,
    endPageId: 30,
    chunkSize: 30,
    chunkCount: 1,
    chunkingRequiredAbove: 30,
  });
  assert.deepEqual(result.pageWindows, [{ startPageId: 1, endPageId: 30 }]);
  assert.equal(result.layout.length, 30);
});

test("GLM-OCR submits a short PDF as one standalone metadata-free chunk", async () => {
  let request;
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: await pdfFixture(5, { title: "GPS=private-source-metadata" }),
    mimeType: "application/pdf",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return responseJson({
        id: "ocr_pdf_short",
        model: "GLM-OCR",
        md_results: "",
        layout_details: Array.from({ length: 5 }, () => []),
        data_info: { num_pages: 5 },
      });
    },
  });

  assert.equal(Object.hasOwn(request, "start_page_id"), false);
  assert.equal(Object.hasOwn(request, "end_page_id"), false);
  assert.equal(await submittedPdfPageCount(request.file), 5);
  assert.equal(await submittedPdfTitle(request.file), undefined);
  assert.equal(result.pages, 5);
  assert.deepEqual(result.pageWindows, [{ startPageId: 1, endPageId: 5 }]);
  assert.equal(result.layout.length, 5);
});

test("GLM-OCR generates deterministic standalone chunk identities", async () => {
  const source = await pdfFixture(5, { title: "private-source-title" });
  const submittedFiles = [];
  const run = () => extractDocumentWithGlmOcr({
    fileBuffer: source,
    mimeType: "application/pdf",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      submittedFiles.push(request.file);
      return responseJson({
        id: "ocr_pdf_deterministic",
        model: "GLM-OCR",
        layout_details: Array.from({ length: 5 }, () => []),
        data_info: { num_pages: 5 },
      });
    },
  });

  const first = await run();
  const second = await run();
  assert.equal(submittedFiles[0], submittedFiles[1]);
  assert.equal(first.providerChunks[0].submittedSha256, second.providerChunks[0].submittedSha256);
  assert.equal(first.input.inputSha256, second.input.inputSha256);
});

test("GLM-OCR exhaustively parses a 65-page PDF through standalone 30-page chunks", async () => {
  const requests = [];
  const totalPages = 65;
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: await pdfFixture(totalPages),
    mimeType: "application/pdf",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      const returnedPages = await submittedPdfPageCount(request.file);
      const returnedStart = requests.reduce((sum, entry) => sum + entry.submittedPages, 0) + 1;
      const returnedEnd = returnedStart + returnedPages - 1;
      requests.push({ request, submittedPages: returnedPages });
      return responseJson({
        id: `ocr_pdf_${returnedStart}_${returnedEnd}`,
        model: "GLM-OCR",
        md_results: `# pages ${returnedStart}-${returnedEnd}`,
        layout_details: Array.from({ length: returnedPages }, (_, index) => [{
          index: 1,
          label: "text",
          bbox_2d: [0, 0, 1, 1],
          content: `page ${returnedStart + index}`,
          width: 640,
          height: 480,
        }]),
        data_info: { num_pages: returnedPages },
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      }, { requestId: `req_${returnedStart}` });
    },
  });

  assert.deepEqual(
    requests.map(({ request, submittedPages }) => [
      Object.hasOwn(request, "start_page_id"),
      Object.hasOwn(request, "end_page_id"),
      submittedPages,
    ]),
    [[false, false, 30], [false, false, 30], [false, false, 5]],
  );
  assert.deepEqual(result.pageWindows, [
    { startPageId: 1, endPageId: 30 },
    { startPageId: 31, endPageId: 60 },
    { startPageId: 61, endPageId: 65 },
  ]);
  assert.deepEqual(result.pageWindow, {
    startPageId: 1,
    endPageId: 65,
    chunkSize: 30,
    chunkCount: 3,
    chunkingRequiredAbove: 30,
  });
  assert.equal(result.layout.length, 65);
  assert.deepEqual(
    result.layout.map((page) => page[0].content),
    Array.from({ length: 65 }, (_, index) => `page ${index + 1}`),
  );
  assert.equal(result.markdown, "# pages 1-30\n\n# pages 31-60\n\n# pages 61-65");
  assert.deepEqual(result.responseIds, ["ocr_pdf_1_30", "ocr_pdf_31_60", "ocr_pdf_61_65"]);
  assert.deepEqual(result.requestIds, ["req_1", "req_31", "req_61"]);
  assert.deepEqual(result.usage, { inputTokens: 30, outputTokens: 6, totalTokens: 36 });
  assert.equal(result.normalization.providerCoverageComplete, true);
  assert.equal(result.normalization.layoutTruncated, false);
  assert.equal(result.normalization.automationEligible, true);
  assert.deepEqual(
    result.providerChunks.map((chunk) => [chunk.sourceStartPage, chunk.sourceEndPage, chunk.providerReportedPages]),
    [[1, 30, 30], [31, 60, 30], [61, 65, 5]],
  );
});

test("GLM-OCR handles the exact 100-page ObraSaaS limit as 30/30/30/10", async () => {
  const submittedPageCounts = [];
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: await pdfFixture(100),
    mimeType: "application/pdf",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      const submittedPages = await submittedPdfPageCount(request.file);
      submittedPageCounts.push(submittedPages);
      return responseJson({
        id: `ocr_pdf_100_${submittedPageCounts.length}`,
        model: "GLM-OCR",
        layout_details: Array.from({ length: submittedPages }, () => []),
        data_info: { num_pages: submittedPages },
      });
    },
  });

  assert.deepEqual(submittedPageCounts, [30, 30, 30, 10]);
  assert.equal(result.pages, 100);
  assert.equal(result.layout.length, 100);
  assert.deepEqual(result.pageWindows, [
    { startPageId: 1, endPageId: 30 },
    { startPageId: 31, endPageId: 60 },
    { startPageId: 61, endPageId: 90 },
    { startPageId: 91, endPageId: 100 },
  ]);
});

test("GLM-OCR rejects source PDFs above the ObraSaaS 100-page limit before fetch", async () => {
  let calls = 0;
  await assert.rejects(
    extractDocumentWithGlmOcr({
      fileBuffer: await pdfFixture(101),
      mimeType: "application/pdf",
      organizationId: "org_ocr",
      apiKey: "zai_ocr_private",
      fetchImpl: async () => {
        calls += 1;
        return responseJson({
          id: "ocr_pdf_too_long",
          model: "GLM-OCR",
          layout_details: [],
          data_info: { num_pages: 101 },
        });
      },
    }),
    (error) => error.code === "OCR_PAGE_LIMIT_EXCEEDED",
  );
  assert.equal(calls, 0);
});

test("GLM-OCR fails closed when a provider window omits a PDF page", async () => {
  let calls = 0;
  await assert.rejects(
    extractDocumentWithGlmOcr({
      fileBuffer: await pdfFixture(40),
      mimeType: "application/pdf",
      organizationId: "org_ocr",
      apiKey: "zai_ocr_private",
      fetchImpl: async () => {
        calls += 1;
        return responseJson({
          id: "ocr_pdf_incomplete",
          model: "GLM-OCR",
          layout_details: Array.from({ length: 29 }, () => []),
          data_info: { num_pages: 40 },
        });
      },
    }),
    (error) => error.code === "OCR_PAGE_WINDOW_INCOMPLETE",
  );
  assert.equal(calls, 1);
});

test("GLM-OCR fails closed when a provider reports the wrong standalone chunk page count", async () => {
  let calls = 0;
  await assert.rejects(
    extractDocumentWithGlmOcr({
      fileBuffer: await pdfFixture(60),
      mimeType: "application/pdf",
      organizationId: "org_ocr",
      apiKey: "zai_ocr_private",
      fetchImpl: async (_url, init) => {
        calls += 1;
        const request = JSON.parse(init.body);
        const submittedPages = await submittedPdfPageCount(request.file);
        return responseJson({
          id: `ocr_pdf_changed_${calls}`,
          model: "GLM-OCR",
          layout_details: Array.from({ length: submittedPages }, () => []),
          data_info: { num_pages: calls === 1 ? submittedPages : submittedPages - 1 },
        });
      },
    }),
    (error) => error.code === "OCR_PAGE_COUNT_MISMATCH",
  );
  assert.equal(calls, 2);
});

test("GLM-OCR rejects a model identity change between standalone PDF chunks", async () => {
  let calls = 0;
  await assert.rejects(
    extractDocumentWithGlmOcr({
      fileBuffer: await pdfFixture(31),
      mimeType: "application/pdf",
      organizationId: "org_ocr",
      apiKey: "zai_ocr_private",
      fetchImpl: async (_url, init) => {
        calls += 1;
        const request = JSON.parse(init.body);
        const submittedPages = await submittedPdfPageCount(request.file);
        return responseJson({
          id: `ocr_pdf_model_${calls}`,
          model: calls === 1 ? "GLM-OCR" : "another-model",
          layout_details: Array.from({ length: submittedPages }, () => []),
          data_info: { num_pages: submittedPages },
        });
      },
    }),
    (error) => error.code === "PROVIDER_RESPONSE_INVALID",
  );
  assert.equal(calls, 2);
});

test("GLM-OCR marks structurally degraded provider items as ineligible for automation", async () => {
  const result = await extractDocumentWithGlmOcr({
    fileBuffer: pngFixture(),
    mimeType: "image/png",
    organizationId: "org_ocr",
    apiKey: "zai_ocr_private",
    fetchImpl: async () => responseJson({
      id: "ocr_degraded_item",
      model: "GLM-OCR",
      md_results: "visible text",
      layout_details: [[{
        index: -1,
        label: "unexpected",
        bbox_2d: [-1, 0, 2, 1],
        content: "visible text",
        width: -10,
        height: 0,
      }]],
      data_info: { num_pages: 1 },
    }),
  });

  assert.equal(result.normalization.layoutTruncated, false);
  assert.equal(result.normalization.droppedItems, 0);
  assert.equal(result.normalization.degradedItems, 1);
  assert.equal(result.normalization.automationEligible, false);
  assert.deepEqual(result.layout[0][0], {
    index: null,
    label: null,
    bbox: [],
    content: "visible text",
    width: null,
    height: null,
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
  const layoutDetails = [Array.from({ length: 10_001 }, () => ({ ...item }))];
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
      data_info: { num_pages: 1 },
    }),
  });
  const returnedItems = result.layout.flat();
  assert.ok(result.layout.length <= 1);
  assert.ok(returnedItems.length <= 10_000);
  assert.ok(returnedItems.reduce((sum, entry) => sum + entry.content.length, 0) <= 2_000_000);
  assert.equal(result.markdown.length, 2_000_000);
  assert.deepEqual(returnedItems[0].bbox, []);
  assert.equal(result.normalization.layoutTruncated, true);
  assert.equal(result.normalization.truncatedFromPageId, 1);
  assert.equal(result.normalization.markdownTruncated, true);
  assert.equal(result.normalization.automationEligible, false);
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
