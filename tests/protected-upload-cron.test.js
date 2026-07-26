import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

const TEST_STATE = Symbol.for("obrasaas.protected-upload-cron-test");
globalThis[TEST_STATE] = {
  calls: [],
  error: null,
  results: null,
  result: {
    expiredReserved: 2,
    scanned: 3,
    deleted: 3,
    failed: 0,
    hasMore: false,
  },
};

const mockModules = new Map([
  ["@/lib/prisma", "mock:protected-upload-cron-prisma"],
  ["@/lib/protected-uploads", "mock:protected-upload-cron-helper"],
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
    if (url === "mock:protected-upload-cron-prisma") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const prisma = { source: "protected-upload-cron-test" };
          export function getPrisma() { return prisma; }
        `,
      };
    }
    if (url === "mock:protected-upload-cron-helper") {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          const state = globalThis[Symbol.for("obrasaas.protected-upload-cron-test")];
          export async function cleanupProtectedUploads(...args) {
            state.calls.push(args);
            if (state.error) throw state.error;
            if (Array.isArray(state.results) && state.results.length > 0) {
              return state.results.shift();
            }
            return state.result;
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const route = await import("../src/app/api/cron/protected-uploads/route.js");
const AUTHORIZED_REQUEST = new Request(
  "https://obrasaas.vercel.app/api/cron/protected-uploads",
  { headers: { authorization: "Bearer protected-upload-cron-secret" } },
);

function useCronSecret(context, value) {
  const originalSecret = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  context.after(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });
}

function resetState() {
  const state = globalThis[TEST_STATE];
  state.calls = [];
  state.error = null;
  state.results = null;
  state.result = {
    expiredReserved: 2,
    scanned: 3,
    deleted: 3,
    failed: 0,
    hasMore: false,
  };
  return state;
}

test("protected upload cron declares the intended server runtime contract", () => {
  assert.equal(route.runtime, "nodejs");
  assert.equal(route.dynamic, "force-dynamic");
  assert.equal(route.maxDuration, 60);
});

test("protected upload cron fails closed when CRON_SECRET is absent", async (context) => {
  useCronSecret(context, undefined);
  const state = resetState();

  const response = await route.GET(AUTHORIZED_REQUEST.clone());

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(await response.json(), {
    ok: false,
    status: "unavailable",
    code: "PROTECTED_UPLOAD_GC_NOT_CONFIGURED",
  });
  assert.equal(state.calls.length, 0);
});

test("protected upload cron uses the real bearer verifier", async (context) => {
  useCronSecret(context, "protected-upload-cron-secret");
  const state = resetState();
  const requests = [
    new Request(AUTHORIZED_REQUEST.url),
    new Request(AUTHORIZED_REQUEST.url, {
      headers: { authorization: "protected-upload-cron-secret" },
    }),
    new Request(AUTHORIZED_REQUEST.url, {
      headers: { authorization: "Bearer protected-upload-cron-secret-suffix" },
    }),
  ];

  for (const request of requests) {
    const response = await route.GET(request);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      status: "unauthorized",
      code: "UNAUTHORIZED",
    });
  }
  assert.equal(state.calls.length, 0);
});

test("protected upload cron calls the bounded cleanup helper and exposes only safe metrics", async (context) => {
  useCronSecret(context, "protected-upload-cron-secret");
  const state = resetState();
  state.result = {
    expiredReserved: 2.9,
    scanned: 3,
    deleted: 3,
    failed: 0,
    hasMore: false,
    storagePath: "must-not-leak",
    id: "must-not-leak",
  };

  const response = await route.GET(AUTHORIZED_REQUEST.clone());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(body, {
    ok: true,
    status: "healthy",
    expiredReserved: 2,
    scanned: 3,
    deleted: 3,
    failed: 0,
    hasMore: false,
  });
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0][0], { source: "protected-upload-cron-test" });
  assert.equal(state.calls[0][1].limit, 100);
  assert.ok(state.calls[0][1].deadlineAt instanceof Date);
  const remainingBudget = state.calls[0][1].deadlineAt.getTime() - Date.now();
  assert.ok(remainingBudget > 40_000 && remainingBudget <= 45_000);
  assert.equal(JSON.stringify(body).includes("must-not-leak"), false);
});

test("protected upload cron reports bounded backlog as HTTP 200 degraded", async (context) => {
  useCronSecret(context, "protected-upload-cron-secret");
  const state = resetState();
  state.result.hasMore = true;
  state.results = [
    { ...state.result },
    { expiredReserved: 0, scanned: 0, deleted: 0, failed: 0, hasMore: true },
  ];

  const response = await route.GET(AUTHORIZED_REQUEST.clone());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    status: "degraded",
    code: "PROTECTED_UPLOAD_GC_BACKLOG",
    expiredReserved: 2,
    scanned: 3,
    deleted: 3,
    failed: 0,
    hasMore: true,
  });
  assert.equal(state.calls.length, 2);
});

test("protected upload cron drains eligible backlog across bounded batches", async (context) => {
  useCronSecret(context, "protected-upload-cron-secret");
  const state = resetState();
  state.results = [
    { expiredReserved: 100, scanned: 100, deleted: 100, failed: 0, hasMore: true },
    { expiredReserved: 37, scanned: 37, deleted: 37, failed: 0, hasMore: false },
  ];

  const response = await route.GET(AUTHORIZED_REQUEST.clone());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    status: "healthy",
    expiredReserved: 137,
    scanned: 137,
    deleted: 137,
    failed: 0,
    hasMore: false,
  });
  assert.equal(state.calls.length, 2);
  assert.equal(state.calls[0][1].deadlineAt.getTime(), state.calls[1][1].deadlineAt.getTime());
});

test("protected upload cron surfaces partial deletion failures as a safe 503", async (context) => {
  useCronSecret(context, "protected-upload-cron-secret");
  const state = resetState();
  state.result.failed = 1;
  state.result.storagePath = "must-not-leak";

  const response = await route.GET(AUTHORIZED_REQUEST.clone());
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body, {
    ok: false,
    status: "degraded",
    code: "PROTECTED_UPLOAD_GC_PARTIAL_FAILURE",
    expiredReserved: 2,
    scanned: 3,
    deleted: 3,
    failed: 1,
    hasMore: false,
  });
  assert.equal(JSON.stringify(body).includes("must-not-leak"), false);
});

test("protected upload cron sanitizes thrown errors in responses and logs", async (context) => {
  useCronSecret(context, "protected-upload-cron-secret");
  const state = resetState();
  state.error = new Error("provider/private/path and database-id must never leak");
  const errorLog = context.mock.method(console, "error", () => {});

  const response = await route.GET(AUTHORIZED_REQUEST.clone());
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    ok: false,
    status: "failed",
    code: "PROTECTED_UPLOAD_GC_FAILED",
  });
  assert.deepEqual(errorLog.mock.calls[0].arguments, ["Protected upload cleanup failed"]);
  assert.equal(JSON.stringify(body).includes("private/path"), false);
});

test("vercel config schedules exactly one daily protected upload cron", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const protectedUploadCrons = config.crons.filter(
    (cron) => cron.path === "/api/cron/protected-uploads",
  );

  assert.deepEqual(protectedUploadCrons, [{
    path: "/api/cron/protected-uploads",
    schedule: "17 3 * * *",
  }]);
  assert.equal(protectedUploadCrons[0].schedule.trim().split(/\s+/).length, 5);
});
