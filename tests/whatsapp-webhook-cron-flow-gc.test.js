import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const TEST_STATE = Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test");
globalThis[TEST_STATE] = {
  gcCalls: [],
  projectIds: ["project-1"],
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
            const error = new Error("simulated Flow request GC outage");
            error.code = "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE";
            error.status = 503;
            throw error;
          }
        `,
      };
    }
    if (url === "mock:webhook-worker") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          export async function drainProjectWebhookEvents() {
            return { completed: 2, failed: 1, blocked: false };
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { GET } = await import("../src/app/api/cron/webhooks/route.js");

test("webhook recovery cron remains successful when Flow request GC fails", async (context) => {
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-test-secret";
  context.after(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });
  const errorLog = context.mock.method(console, "error", () => {});

  const response = await GET(new Request("https://obrasaas.vercel.app/api/cron/webhooks", {
    headers: { authorization: "Bearer cron-test-secret" },
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    ok: true,
    projects: 1,
    completed: 2,
    failed: 1,
    blocked: 0,
    flowRequestGc: {
      scannedEndpoints: 0,
      failedEndpoints: 1,
      deletedCount: 0,
      hasMore: false,
    },
  });
  assert.equal(globalThis[TEST_STATE].gcCalls.length, 1);
  assert.deepEqual(globalThis[TEST_STATE].gcCalls[0][0], { source: "cron-test" });
  assert.deepEqual(globalThis[TEST_STATE].gcCalls[0][1], {
    maxEndpoints: 2,
    batchSize: 250,
  });
  assert.equal(errorLog.mock.callCount(), 1);
});
