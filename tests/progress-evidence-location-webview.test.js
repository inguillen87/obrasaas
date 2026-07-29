import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { after, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const extension = specifier.startsWith("@/generated/") ? ".ts" : ".js";
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = "postgresql://unit-test.invalid/obrasaas";

const root = new URL("../", import.meta.url);
const [pageSource, clientSource, routeSource] = await Promise.all([
  readFile(new URL("src/app/webview/progress-evidence-location/page.js", root), "utf8"),
  readFile(
    new URL(
      "src/app/webview/progress-evidence-location/progress-evidence-location-client.js",
      root,
    ),
    "utf8",
  ),
  readFile(
    new URL("src/app/api/webviews/progress-evidence-location/route.js", root),
    "utf8",
  ),
]);

const [route, captureSessions, locationRateLimit] = await Promise.all([
  import("../src/app/api/webviews/progress-evidence-location/route.js"),
  import("../src/lib/progress-evidence-capture-sessions.js"),
  import("../src/lib/progress-evidence-location-rate-limit.js"),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

function validBody(overrides = {}) {
  return {
    action: "CAPTURE",
    worker: "worker-progress-location-a",
    session: "session-progress-location-a",
    token: "signed-progress-location-token",
    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
    privacyAccepted: true,
    noticeVersion: "progress-location-v1",
    noticeContentSha256: "a".repeat(64),
    latitude: -32.8895,
    longitude: -68.8458,
    accuracyMeters: 12.5,
    capturedAt: "2026-07-29T12:00:00.000Z",
    ...overrides,
  };
}

function validCancelBody(overrides = {}) {
  return {
    action: "CANCEL",
    worker: "worker-progress-location-a",
    session: "session-progress-location-a",
    token: "signed-progress-location-token",
    ...overrides,
  };
}

function validInitBody(overrides = {}) {
  return {
    action: "INIT",
    worker: "worker-progress-location-a",
    session: "session-progress-location-a",
    token: "signed-progress-location-token",
    ...overrides,
  };
}

test("server page accepts only non-sensitive bindings and never sees the bearer or database", () => {
  assert.match(pageSource, /const QUERY_FIELDS = new Set\(\["worker", "session"\]\)/);
  assert.match(pageSource, /keys\.length !== QUERY_FIELDS\.size/);
  assert.match(pageSource, /worker=\{query\.worker\}/);
  assert.match(pageSource, /session=\{query\.session\}/);
  assert.doesNotMatch(
    pageSource,
    /getPrisma|getProgressEvidenceCaptureContext|token|latitude|longitude|accuracyMeters|console\./,
  );
  assert.match(pageSource, /referrer: "no-referrer"/);
});

test("client offers explicit capture or opt-out and keeps retry geolocation in memory only", () => {
  assert.match(clientSource, /navigator\.geolocation\.getCurrentPosition\(/);
  assert.match(clientSource, /enableHighAccuracy: true/);
  assert.match(clientSource, /maximumAge: 0/);
  assert.match(clientSource, /timeout: 15_000/);
  assert.match(clientSource, /Number\(position\?\.timestamp\)/);
  assert.match(clientSource, /new Date\(Date\.now\(\)\)\.toISOString\(\)/);
  assert.match(clientSource, /una sola lectura puntual de ubicación para esta foto/i);
  assert.match(clientSource, /No registra asistencia ni activa rastreo continuo/i);
  assert.match(clientSource, /foto no se descarta:[\s\S]*disponible para revisión manual/i);
  assert.match(clientSource, /const fallbackOperation = useRef\(null\)/);
  assert.match(clientSource, /operationExpiryAt\(operation, expiresAt\) - Date\.now\(\)/);
  assert.match(clientSource, /globalThis\.setTimeout\(\(\) => \{[\s\S]*discardOperation\(\)/);
  assert.match(clientSource, /idempotencyKey: operation\.idempotencyKey/);
  assert.match(clientSource, /action: "CAPTURE"/);
  assert.match(clientSource, /action: "CANCEL"/);
  assert.match(clientSource, /Continuar sin ubicación/);
  assert.match(clientSource, /result\.status !== "CANCELLED"/);
  assert.match(clientSource, /privacyAccepted: operation\.payload\.privacyAccepted/);
  assert.match(clientSource, /noticeContentSha256: operation\.payload\.noticeContentSha256/);
  assert.match(clientSource, /initialized\.status === "LOCATION_CAPTURED"/);
  assert.match(clientSource, /initialized\.status === "CANCELLED"/);
  assert.doesNotMatch(clientSource, /sessionStorage/);
  assert.match(clientSource, /sessionDeadline <= Date\.now\(\)[\s\S]*discardOperation\(\)[\s\S]*Este enlace ya venció/);
  const cancelHandler = clientSource.slice(
    clientSource.indexOf("async function handleCancel()"),
    clientSource.indexOf("const loading = status.type"),
  );
  assert.ok(cancelHandler.indexOf("discardOperation()") >= 0);
  assert.ok(cancelHandler.indexOf("discardOperation()") < cancelHandler.indexOf("await fetch"));
  assert.match(clientSource, /no certifica presencia física[\s\S]*ni impide una manipulación/i);
  assert.match(clientSource, /geolocalización reportada por el dispositivo/i);
  assert.doesNotMatch(clientSource, /\bGPS\b/i);
  assert.match(clientSource, /const API_PATH = "\/api\/webviews\/progress-evidence-location"/);
  assert.match(clientSource, /tokenFromFragment\(fragment\)/);
  assert.match(clientSource, /globalThis\.history\.replaceState\(null, "", safeRequestTarget\)/);
  assert.ok(clientSource.indexOf("history.replaceState") < clientSource.indexOf("await fetch"));
  assert.doesNotMatch(clientSource, /URLSearchParams|window\.location|console\./);
});

test("route is dynamic, Node-only, bounded, no-store and does not depend on Clerk", () => {
  assert.match(routeSource, /export const dynamic = "force-dynamic"/);
  assert.match(routeSource, /export const runtime = "nodejs"/);
  assert.match(routeSource, /readJsonRequest\(request, \{ maxBytes: MAX_REQUEST_BYTES \}\)/);
  assert.match(routeSource, /new URL\(request\.url\)\.searchParams\.size !== 0/);
  assert.match(routeSource, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(routeSource, /const MIN_ACCURACY_METERS = 0\.01/);
  assert.match(routeSource, /const MAX_ACCURACY_METERS = 10_000/);
  assert.match(routeSource, /input\.action === "CANCEL"[\s\S]*cancelProgressEvidenceLocation\([\s\S]*captureProgressEvidenceLocation\(/);
  assert.match(routeSource, /correlationId = randomUUID\(\)/);
  assert.match(routeSource, /correlationId,[\s\S]*idempotencyKey: input\.idempotencyKey/);
  assert.match(routeSource, /"X-Correlation-Id": correlationId/);
  assert.match(routeSource, /reserveProgressEvidenceLocationRequest\(prisma/);
  assert.match(routeSource, /isProgressEvidenceCaptureSessionError\(error\)/);
  assert.match(routeSource, /isProgressEvidenceLocationRateLimitError\(error\)/);
  const signatureIndex = routeSource.indexOf("assertProgressEvidenceCaptureTokenSignature");
  const prismaIndex = routeSource.indexOf("const prisma = getPrisma()", signatureIndex);
  const reservationIndex = routeSource.indexOf("await reserveProgressEvidenceLocationRequest", prismaIndex);
  const serviceIndex = routeSource.indexOf("getProgressEvidenceCaptureContext", reservationIndex);
  assert.ok(signatureIndex >= 0 && signatureIndex < prismaIndex);
  assert.ok(prismaIndex < reservationIndex && reservationIndex < serviceIndex);
  assert.doesNotMatch(routeSource, /@clerk|console\./);
});

test("request parser accepts only the exact discriminated INIT, CAPTURE or CANCEL contract", () => {
  const input = validBody();
  assert.deepEqual(route.parseProgressEvidenceLocationInput(input), input);
  const cancel = validCancelBody();
  assert.deepEqual(route.parseProgressEvidenceLocationInput(cancel), cancel);
  const init = validInitBody();
  assert.deepEqual(route.parseProgressEvidenceLocationInput(init), init);

  for (const invalid of [
    { ...validBody(), extra: "forbidden" },
    (() => {
      const body = validBody();
      delete body.session;
      return body;
    })(),
    validBody({ privacyAccepted: false }),
    validBody({ noticeContentSha256: "not-a-sha256" }),
    validBody({ latitude: "-32.8895" }),
    validBody({ longitude: 181 }),
    validBody({ accuracyMeters: 0 }),
    validBody({ accuracyMeters: 10_000.01 }),
    validBody({ accuracyMeters: Number.POSITIVE_INFINITY }),
    validBody({ capturedAt: "2026-07-29 12:00:00Z" }),
    validBody({ idempotencyKey: "short" }),
    validBody({ action: "UNKNOWN" }),
    validBody({ correlationId: "client-controlled" }),
    validCancelBody({ latitude: -32.8895 }),
    validCancelBody({ privacyAccepted: false }),
    validInitBody({ retryAfterSeconds: 1 }),
  ]) {
    assert.throws(
      () => route.parseProgressEvidenceLocationInput(invalid),
      (error) => error?.status === 400 && typeof error?.code === "string",
    );
  }
});

test("an unsigned bearer fails CPU preflight before Prisma is created", async () => {
  delete globalThis.__obraSaasPrisma;
  const response = await route.POST(new Request(
    "http://localhost/api/webviews/progress-evidence-location",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validInitBody({ token: "unsigned-random-token" })),
    },
  ));
  assert.equal(response.status, 401);
  assert.equal(globalThis.__obraSaasPrisma, undefined);
  const payload = await response.json();
  assert.equal(payload.code, "PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID");
  assert.equal(JSON.stringify(payload).includes("unsigned-random-token"), false);
});

test("route rejects URL coordinates, unknown fields and oversized bodies before capture", async () => {
  const urlResponse = await route.POST(new Request(
    "http://localhost/api/webviews/progress-evidence-location?latitude=-32.8",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody()),
    },
  ));
  assert.equal(urlResponse.status, 400);
  assert.match(urlResponse.headers.get("cache-control"), /no-store/);
  const urlPayload = await urlResponse.json();
  assert.equal(urlPayload.code, "PROGRESS_EVIDENCE_LOCATION_URL_FIELDS_FORBIDDEN");
  assert.equal(JSON.stringify(urlPayload).includes("-32.8"), false);
  const urlCorrelationId = urlResponse.headers.get("x-correlation-id");
  assert.match(urlCorrelationId, /^[0-9a-f-]{36}$/i);

  const unknownFieldResponse = await route.POST(new Request(
    "http://localhost/api/webviews/progress-evidence-location",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validBody(), latitudeInUrl: false }),
    },
  ));
  assert.equal(unknownFieldResponse.status, 400);
  assert.equal(
    (await unknownFieldResponse.json()).code,
    "PROGRESS_EVIDENCE_LOCATION_FIELDS_INVALID",
  );
  assert.match(unknownFieldResponse.headers.get("x-correlation-id"), /^[0-9a-f-]{36}$/i);
  assert.notEqual(unknownFieldResponse.headers.get("x-correlation-id"), urlCorrelationId);

  const oversizedResponse = await route.POST(new Request(
    "http://localhost/api/webviews/progress-evidence-location",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(12 * 1_024 + 1),
      },
      body: "{}",
    },
  ));
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).code, "REQUEST_BODY_TOO_LARGE");
});

test("error responses fail closed without reflecting messages or coordinates", async () => {
  const correlationId = "123e4567-e89b-42d3-a456-426614174000";
  const unknown = route.progressEvidenceLocationErrorResponse(Object.assign(
    new Error("raw latitude=-32.8895 longitude=-68.8458 secret-token"),
    { status: 418, code: "UNSAFE_ERROR" },
  ), { correlationId });
  assert.equal(unknown.status, 500);
  assert.match(unknown.headers.get("cache-control"), /no-store/);
  assert.equal(unknown.headers.get("x-correlation-id"), correlationId);
  const unknownBody = await unknown.json();
  assert.equal(unknownBody.code, "PROGRESS_EVIDENCE_LOCATION_CAPTURE_FAILED");
  assert.equal(JSON.stringify(unknownBody).includes("-32.8895"), false);
  assert.equal(JSON.stringify(unknownBody).includes("secret-token"), false);

  const typed = route.progressEvidenceLocationErrorResponse(
    new captureSessions.ProgressEvidenceCaptureSessionError(
      "latitude=-32.8895",
      "PROGRESS_EVIDENCE_CAPTURE_EXPIRED",
      410,
      { latitude: -32.8895 },
    ),
    { correlationId },
  );
  assert.equal(typed.status, 410);
  const typedBody = await typed.json();
  assert.equal(typedBody.code, "PROGRESS_EVIDENCE_CAPTURE_EXPIRED");
  assert.equal(JSON.stringify(typedBody).includes("-32.8895"), false);

  const spoofedTypedError = route.progressEvidenceLocationErrorResponse({
    status: 410,
    code: "PROGRESS_EVIDENCE_CAPTURE_EXPIRED",
    message: "latitude=-32.8895",
  });
  assert.equal(spoofedTypedError.status, 500);
  const spoofedBody = await spoofedTypedError.json();
  assert.equal(spoofedBody.code, "PROGRESS_EVIDENCE_LOCATION_CAPTURE_FAILED");
  assert.equal(JSON.stringify(spoofedBody).includes("-32.8895"), false);

  const limited = route.progressEvidenceLocationErrorResponse(
    new locationRateLimit.ProgressEvidenceLocationRateLimitError(
      "secret-token latitude=-32.8895",
      {
        code: "PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT",
        status: 429,
        retryAfterSeconds: 17,
      },
    ),
    { correlationId },
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "17");
  assert.equal(limited.headers.get("x-correlation-id"), correlationId);
  assert.match(limited.headers.get("cache-control"), /no-store/);
  const limitedBody = await limited.json();
  assert.equal(limitedBody.code, "PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT");
  assert.equal(JSON.stringify(limitedBody).includes("secret-token"), false);
  assert.equal(JSON.stringify(limitedBody).includes("-32.8895"), false);

  const unavailable = route.progressEvidenceLocationErrorResponse(
    new locationRateLimit.ProgressEvidenceLocationRateLimitError(
      "database detail must not escape",
      {
        code: "PROGRESS_EVIDENCE_LOCATION_RATE_LIMIT_UNAVAILABLE",
        status: 503,
        retryAfterSeconds: 2,
      },
    ),
    { correlationId },
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("retry-after"), "2");
  assert.equal(
    JSON.stringify(await unavailable.json()).includes("database detail"),
    false,
  );

  const spoofedLimit = route.progressEvidenceLocationErrorResponse({
    name: "ProgressEvidenceLocationRateLimitError",
    status: 429,
    code: "PROGRESS_EVIDENCE_LOCATION_SESSION_RATE_LIMIT",
    retryAfterSeconds: 1,
  }, { correlationId });
  assert.equal(spoofedLimit.status, 500);
  assert.equal(spoofedLimit.headers.get("retry-after"), null);
  assert.equal(
    (await spoofedLimit.json()).code,
    "PROGRESS_EVIDENCE_LOCATION_CAPTURE_FAILED",
  );
});

test("safe CAPTURE and CANCEL responses carry only their server correlation contract", async () => {
  const correlationId = "123e4567-e89b-42d3-a456-426614174000";
  const captured = route.successfulProgressEvidenceLocationResponse("CAPTURE", {
    session: { status: "LOCATION_CAPTURED", locationVerification: "REVIEW_REQUIRED" },
    replayed: false,
  }, { correlationId });
  assert.equal(captured.headers.get("x-correlation-id"), correlationId);
  assert.deepEqual(await captured.json(), {
    success: true,
    action: "CAPTURE",
    outcome: "RECORDED",
    status: "LOCATION_CAPTURED",
    locationVerification: "REVIEW_REQUIRED",
  });

  const cancelled = route.successfulProgressEvidenceLocationResponse("CANCEL", {
    session: { status: "CANCELLED", locationVerification: null },
    replayed: true,
  }, { correlationId });
  assert.equal(cancelled.headers.get("x-correlation-id"), correlationId);
  assert.deepEqual(await cancelled.json(), {
    success: true,
    action: "CANCEL",
    outcome: "REPLAYED",
    status: "CANCELLED",
  });
});
