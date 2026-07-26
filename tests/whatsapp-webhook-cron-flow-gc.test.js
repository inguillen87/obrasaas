import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

const TEST_STATE = Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test");
globalThis[TEST_STATE] = {
  callOrder: [],
  attendanceExpiryCalls: [],
  attendanceExpiryResult: {
    scannedEntries: 0,
    processedProjects: 0,
    failedProjects: 0,
    expiredCount: 0,
    reconciledProjections: 0,
    hasMore: false,
    backlogCheckFailed: false,
    failureCodes: [],
    cutoff: "2026-07-23T10:00:00.000Z",
  },
  attendanceExpiryError: null,
  attendanceAutomationCalls: [],
  attendanceAutomationResult: {
    eligibleProjects: 1,
    processedProjects: 1,
    failedProjects: 0,
    hasMore: false,
    totals: {
      materialized: 1,
      evaluated: 1,
      shiftsMarkedPendingClose: 0,
      alertsOpened: 0,
      alertsResolved: 0,
    },
    failureCodes: [],
  },
  attendanceAutomationError: null,
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
  ["@/lib/attendance-control", "mock:attendance-control"],
  ["@/lib/attendance-expiry", "mock:attendance-expiry"],
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
    if (url === "mock:attendance-control") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test")];
          export async function runAttendanceAutomationBatch(...args) {
            state.callOrder.push("attendance-automation");
            state.attendanceAutomationCalls.push(args);
            if (state.attendanceAutomationError) throw state.attendanceAutomationError;
            return state.attendanceAutomationResult;
          }
        `,
      };
    }
    if (url === "mock:attendance-expiry") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for("obrasaas.whatsapp-webhook-cron-flow-gc-test")];
          export async function expireStalePendingAttendanceBatch(...args) {
            state.callOrder.push("attendance-expiry");
            state.attendanceExpiryCalls.push(args);
            if (state.attendanceExpiryError) throw state.attendanceExpiryError;
            return state.attendanceExpiryResult;
          }
        `,
      };
    }
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
          export async function listDueWebhookProjectIds() {
            state.callOrder.push("list-webhooks");
            return state.projectIds;
          }
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
            state.callOrder.push("flow-gc");
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
            state.callOrder.push("drain-webhooks");
            return state.drainResult;
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { GET } = await import("../src/app/api/cron/webhooks/route.js");

test("vercel config schedules exactly one per-minute webhook recovery cron", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const webhookRecoveryCrons = config.crons.filter(
    (cron) => cron.path === "/api/cron/webhooks",
  );

  assert.deepEqual(webhookRecoveryCrons, [{
    path: "/api/cron/webhooks",
    schedule: "* * * * *",
  }]);
  assert.equal(webhookRecoveryCrons[0].schedule.trim().split(/\s+/).length, 5);
});

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
    state.callOrder = [];
    state.attendanceExpiryCalls = [];
    state.attendanceAutomationCalls = [];
    state.attendanceAutomationError = null;
    state.attendanceExpiryError = null;
    state.attendanceExpiryResult = {
      scannedEntries: 0,
      processedProjects: 0,
      failedProjects: 0,
      expiredCount: 0,
      reconciledProjections: 0,
      hasMore: false,
      backlogCheckFailed: false,
      failureCodes: [],
      cutoff: "2026-07-23T10:00:00.000Z",
    };
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
    assert.equal(state.attendanceExpiryCalls.length, 1, scenario.name);
    assert.equal(state.attendanceAutomationCalls.length, 1, scenario.name);
    assert.deepEqual(state.attendanceExpiryCalls[0][0], { source: "cron-test" });
    assert.deepEqual(state.attendanceExpiryCalls[0][1], { maxEntries: 100 });
    assert.deepEqual(state.attendanceAutomationCalls[0][0], { source: "cron-test" });
    assert.deepEqual(state.attendanceAutomationCalls[0][1], { maxProjects: 4 });
    assert.equal(state.callOrder[0], "attendance-expiry", scenario.name);
    assert.equal(state.callOrder[1], "attendance-automation", scenario.name);
  }

  state.callOrder = [];
  state.gcCalls = [];
  state.attendanceExpiryCalls = [];
  state.drainResult = { completed: 1, failed: 0, blocked: false };
  state.gcResult = { scannedEndpoints: 0, failedEndpoints: 0, deletedCount: 0, hasMore: false };
  state.gcError = null;
  state.attendanceExpiryResult = {
    scannedEntries: 100,
    processedProjects: 2,
    failedProjects: 1,
    expiredCount: 99,
    reconciledProjections: 98,
    hasMore: true,
    backlogCheckFailed: false,
    failureCodes: ["P2034"],
    cutoff: "2026-07-23T10:00:00.000Z",
  };
  const attendanceDegradedResponse = await GET(request.clone());
  const attendanceDegradedBody = await attendanceDegradedResponse.json();
  assert.deepEqual(attendanceDegradedBody.reasons, [
    "ATTENDANCE_EXPIRY_FAILED",
    "ATTENDANCE_EXPIRY_BACKLOG",
  ]);
  assert.equal(attendanceDegradedBody.attendanceExpiry.expiredCount, 99);

  const gcError = new Error("simulated Flow request GC outage");
  gcError.code = "WHATSAPP_FLOW_ENDPOINT_REQUEST_PERSISTENCE_UNAVAILABLE";
  gcError.status = 503;
  state.gcCalls = [];
  state.attendanceExpiryResult = {
    scannedEntries: 0,
    processedProjects: 0,
    failedProjects: 0,
    expiredCount: 0,
    reconciledProjections: 0,
    hasMore: false,
    backlogCheckFailed: false,
    failureCodes: [],
    cutoff: "2026-07-23T10:00:00.000Z",
  };
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

  const expiryError = new Error("simulated attendance expiry outage");
  expiryError.code = "P1001";
  state.callOrder = [];
  state.drainResult = { completed: 1, failed: 0, blocked: false };
  state.gcError = null;
  state.gcResult = { scannedEndpoints: 0, failedEndpoints: 0, deletedCount: 0, hasMore: false };
  state.attendanceExpiryError = expiryError;
  const expiryFailureResponse = await GET(request.clone());
  const expiryFailureBody = await expiryFailureResponse.json();
  assert.equal(expiryFailureResponse.status, 200);
  assert.deepEqual(expiryFailureBody.reasons, [
    "ATTENDANCE_EXPIRY_FAILED",
    "ATTENDANCE_EXPIRY_BACKLOG",
  ]);
  assert.equal(expiryFailureBody.attendanceExpiry.backlogCheckFailed, true);
  assert.deepEqual(expiryFailureBody.attendanceExpiry.failureCodes, ["P1001"]);
  assert.equal(state.callOrder[0], "attendance-expiry");
  assert.equal(errorLog.mock.callCount(), 2);
});
