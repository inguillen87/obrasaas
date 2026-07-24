import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const TEST_STATE = Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test");
globalThis[TEST_STATE] = {
  gcCalls: [],
  projectIds: ["project-1"],
  drainResult: { completed: 2, failed: 0, blocked: false },
  gcResult: {
    scannedEndpoints: 1,
    failedEndpoints: 0,
    deletedCount: 3,
    hasMore: false,
  },
  gcError: null,
};

const mockModules = new Map([
  ["@/lib/cron-auth", "mock:cron-auth"],
  ["@/lib/db", "mock:db"],
  ["@/lib/prisma", "mock:prisma"],
  ["@/lib/whatsapp/flow-endpoint-requests", "mock:flow-endpoint-requests"],
  ["@/lib/whatsapp/webhook-worker", "mock:webhook-worker"],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mockUrl = mockModules.get(specifier);
    if (mockUrl) return { url: mockUrl, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const sourcePath = new URL(`../src/${specifier.slice(2)}.js`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "mock:cron-auth") {
      return {
        format: "module",
        shortCircuit: true,
        source: "export function isAuthorizedCronRequest() { return true; }",
      };
    }
    if (url === "mock:db") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test")];
          export async function listDueWebhookProjectIds() { return state.projectIds; }
        `,
      };
    }
    if (url === "mock:prisma") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const prisma = { source: "cron-test" };
          export function getPrisma() { return prisma; }
        `,
      };
    }
    if (url === "mock:flow-endpoint-requests") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test")];
          export async function garbageCollectWhatsAppFlowEndpointRequestBacklog(...args) {
            state.gcCalls.push(args);
            if (state.gcError) throw state.gcError;
            return state.gcResult;
          }
        `,
      };
    }
    if (url === "mock:webhook-worker") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test")];
          export async function drainProjectWebhookEvents() {
            return state.drainResult;
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { GET } = await import("../src/app/api/cron/webhooks/route.js");

test("webhook recovery cron distinguishes accepted runs from healthy work", async (context) => {
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-test-secret";
  context.after(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });
  const errorLog = context.mock.method(console, "error", () => {});
  const state = globalThis[TEST_STATE];
  const request = new Request("https://obrasaas.vercel.app/api/cron/webhooks", {
    headers: { authorization: "Bearer cron-test-secret" },
  });
  const scenarios = [
    {
      name: "healthy",
      drainResult: { completed: 2, failed: 0, blocked: false },
      gcResult: { scannedEndpoints: 1, failedEndpoints: 0, deletedCount: 3, hasMore: true },
      expected: { workHealthy: true, status: "healthy", reasons: [] },
    },
    {
      name: "terminal webhook failure",
      drainResult: { completed: 2, failed: 1, blocked: false },
      gcResult: { scannedEndpoints: 1, failedEndpoints: 0, deletedCount: 0, hasMore: false },
      expected: { workHealthy: false, status: "degraded", reasons: ["WEBHOOK_EVENTS_FAILED"] },
    },
    {
      name: "blocked project",
      drainResult: { completed: 0, failed: 0, blocked: true },
      gcResult: { scannedEndpoints: 0, failedEndpoints: 0, deletedCount: 0, hasMore: false },
      expected: { workHealthy: false, status: "degraded", reasons: ["WEBHOOK_PROJECTS_BLOCKED"] },
    },
    {
      name: "reported GC failure",
      drainResult: { completed: 1, failed: 0, blocked: false },
      gcResult: { scannedEndpoints: 1, failedEndpoints: 1, deletedCount: 0, hasMore: false },
      expected: { workHealthy: false, status: "degraded", reasons: ["FLOW_REQUEST_GC_FAILED"] },
    },
  ];

  for (const scenario of scenarios) {
    state.gcCalls = [];
    state.drainResult = scenario.drainResult;
    state.gcResult = scenario.gcResult;
    state.gcError = null;
    const response = await GET(request.clone());
    const body = await response.json();
    assert.equal(response.status, 200, scenario.name);
    assert.equal(body.ok, true, scenario.name);
    assert.deepEqual({
      workHealthy: body.workHealthy,
      status: body.status,
      reasons: body.reasons,
    }, scenario.expected, scenario.name);
    assert.deepEqual(body.flowRequestGc, scenario.gcResult, scenario.name);
    assert.equal(state.gcCalls.length, 1, scenario.name);
  }

  const gcError = new Error("simulated Flow request GC outage");
  gcError.code = "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE";
  gcError.status = 503;
  state.gcCalls = [];
  state.drainResult = { completed: 2, failed: 1, blocked: true };
  state.gcError = gcError;
  const degradedResponse = await GET(request.clone());
  const degradedBody = await degradedResponse.json();
  assert.equal(degradedResponse.status, 200);
  assert.deepEqual(degradedBody.reasons, [
    "WEBHOOK_EVENTS_FAILED",
    "WEBHOOK_PROJECTS_BLOCKED",
    "FLOW_REQUEST_GC_FAILED",
  ]);
  assert.equal(degradedBody.flowRequestGc.failedEndpoints, 1);
  assert.deepEqual(state.gcCalls[0][0], { source: "cron-test" });
  assert.deepEqual(state.gcCalls[0][1], { maxEndpoints: 2, batchSize: 250 });
  assert.equal(errorLog.mock.callCount(), 1);
});
