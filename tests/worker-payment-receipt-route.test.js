import assert from "node:assert/strict";
import crypto from "node:crypto";
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
const originalWebviewSecret = process.env.WEBVIEW_TOKEN_SECRET;
process.env.DATABASE_URL = "postgresql://unit-test.invalid/obrasaas";
process.env.WEBVIEW_TOKEN_SECRET = "worker-payment-private-receipt-route-test-secret";

const [{ generateWebviewToken }, receiptModule, route] = await Promise.all([
  import("../src/lib/auth.js"),
  import("../src/lib/worker-payment-private-receipts.js"),
  import("../src/app/api/webviews/worker-payment-receipt/route.js"),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalWebviewSecret === undefined) delete process.env.WEBVIEW_TOKEN_SECRET;
  else process.env.WEBVIEW_TOKEN_SECRET = originalWebviewSecret;
  delete globalThis.__obraSaasPrisma;
});

const RECEIPT_ID = "123e4567-e89b-42d3-a456-426614174720";
const WORKER_ID = "worker-payment-receipt-route";

function validBody(overrides = {}) {
  return {
    action: "INIT",
    worker: WORKER_ID,
    receipt: RECEIPT_ID,
    token: "signed-token-placeholder",
    ...overrides,
  };
}

function activeReceiptStore() {
  const issuedAt = new Date(Math.floor((Date.now() - 30_000) / 1_000) * 1_000);
  const expiresAt = new Date(issuedAt.getTime() + (15 * 60 * 1_000));
  const token = generateWebviewToken(WORKER_ID, {
    now: issuedAt.getTime(),
    ttlSeconds: 15 * 60,
    purpose: receiptModule.WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_PURPOSE,
    scope: RECEIPT_ID,
  });
  const receipt = {
    id: RECEIPT_ID,
    organizationId: "organization-payment-receipt-route",
    projectId: "project-payment-receipt-route",
    connectionId: "connection-payment-receipt-route",
    flowSessionId: "123e4567-e89b-42d3-a456-426614174721",
    workerId: WORKER_ID,
    personId: "person-payment-receipt-route",
    channelIdentityId: "channel-payment-receipt-route",
    destinationId: "destination-payment-receipt-route",
    sourceWebhookEventId: "webhook-payment-receipt-route",
    paymentPurpose: "SALARY",
    destinationType: "CBU",
    destinationLastFour: "1234",
    receivedAt: new Date(issuedAt.getTime() - 15_000),
    contentVersion: receiptModule.WORKER_PAYMENT_PRIVATE_RECEIPT_CONTENT_VERSION,
    contentSha256: "",
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    issuedAt,
    expiresAt,
    accessCount: 0,
    firstAccessedAt: null,
    lastAccessedAt: null,
    revokedAt: null,
  };
  receipt.contentSha256 = receiptModule.workerPaymentPrivateReceiptContentSha256(receipt);
  const prisma = {
    workerPaymentPrivateReceipt: {
      async findUnique() { return receipt; },
      async create() { return receipt; },
      async findFirst({ where }) {
        return where.id === receipt.id && where.workerId === receipt.workerId
          ? { ...receipt }
          : null;
      },
      async updateMany({ where, data }) {
        if (where.accessCount !== receipt.accessCount) return { count: 0 };
        receipt.accessCount += 1;
        receipt.firstAccessedAt ||= data.firstAccessedAt;
        receipt.lastAccessedAt = data.lastAccessedAt;
        return { count: 1 };
      },
    },
    project: { async findFirst() { return { id: receipt.projectId }; } },
    whatsAppConnection: { async findFirst() { return { id: receipt.connectionId }; } },
    worker: { async findFirst() { return { id: receipt.workerId }; } },
    workerPerson: { async findFirst() { return { id: receipt.personId }; } },
    workerChannelIdentity: { async findFirst() { return { id: receipt.channelIdentityId }; } },
    async $transaction(operation) { return operation(prisma); },
  };
  return { prisma, receipt, token };
}

test("receipt route parser accepts only the exact INIT or PDF contract", () => {
  assert.deepEqual(route.parseWorkerPaymentReceiptInput(validBody()), validBody());
  assert.deepEqual(
    route.parseWorkerPaymentReceiptInput(validBody({ action: "PDF" })),
    validBody({ action: "PDF" }),
  );
  for (const invalid of [
    { ...validBody(), extra: true },
    { ...validBody(), action: "DELETE" },
    { ...validBody(), receipt: "not-a-uuid" },
    { ...validBody(), token: " token" },
    (() => {
      const body = validBody();
      delete body.worker;
      return body;
    })(),
  ]) {
    assert.throws(
      () => route.parseWorkerPaymentReceiptInput(invalid),
      (error) => error.status === 400 && /^WORKER_PAYMENT_PRIVATE_RECEIPT_/.test(error.code),
    );
  }
});

test("an invalid bearer fails CPU preflight before Prisma is created", async () => {
  delete globalThis.__obraSaasPrisma;
  const response = await route.POST(new Request(
    "http://localhost/api/webviews/worker-payment-receipt",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody({ token: "unsigned-random-token" })),
    },
  ));
  assert.equal(response.status, 401);
  assert.equal(globalThis.__obraSaasPrisma, undefined);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const payload = await response.json();
  assert.equal(payload.code, "WORKER_PAYMENT_PRIVATE_RECEIPT_TOKEN_INVALID");
  assert.equal(JSON.stringify(payload).includes("unsigned-random-token"), false);
});

test("INIT returns only the safe receipt DTO with no-store security headers", async () => {
  const store = activeReceiptStore();
  globalThis.__obraSaasPrisma = store.prisma;
  const response = await route.POST(new Request(
    "http://localhost/api/webviews/worker-payment-receipt",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody({ token: store.token })),
    },
  ));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("x-correlation-id"), /^[0-9a-f-]{36}$/i);
  const payload = await response.json();
  assert.deepEqual(payload, {
    success: true,
    action: "INIT",
    receipt: {
      reference: RECEIPT_ID,
      receivedAt: store.receipt.receivedAt.toISOString(),
      issuedAt: store.receipt.issuedAt.toISOString(),
      paymentPurpose: "SALARY",
      destinationType: "CBU",
      maskedReference: "•••• 1234",
      status: "RECEIVED_FOR_REVIEW",
      integritySha256: store.receipt.contentSha256,
    },
  });
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(store.token), false);
  assert.equal(serialized.includes(store.receipt.personId), false);
  assert.equal(store.receipt.accessCount, 1);
});

test("PDF is generated dynamically without exposing the bearer or a full account value", async () => {
  const store = activeReceiptStore();
  globalThis.__obraSaasPrisma = store.prisma;
  const response = await route.POST(new Request(
    "http://localhost/api/webviews/worker-payment-receipt",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody({ action: "PDF", token: store.token })),
    },
  ));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition"), /^attachment; filename="constancia-recepcion-/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(new TextDecoder("ascii").decode(bytes.subarray(0, 5)), "%PDF-");
  const binary = Buffer.from(bytes).toString("latin1");
  assert.equal(binary.includes(store.token), false);
  assert.equal(binary.includes("0000000000000000000000"), false);
  assert.equal(store.receipt.accessCount, 1);
});

test("query fields and oversized bodies fail closed without reflecting secrets", async () => {
  const queryResponse = await route.POST(new Request(
    "http://localhost/api/webviews/worker-payment-receipt?token=must-not-reflect",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody()),
    },
  ));
  assert.equal(queryResponse.status, 400);
  assert.equal(
    (await queryResponse.json()).code,
    "WORKER_PAYMENT_PRIVATE_RECEIPT_URL_FIELDS_FORBIDDEN",
  );

  const oversized = await route.POST(new Request(
    "http://localhost/api/webviews/worker-payment-receipt",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String((12 * 1_024) + 1),
      },
      body: "{}",
    },
  ));
  assert.equal(oversized.status, 413);
  const body = await oversized.json();
  assert.equal(body.code, "WORKER_PAYMENT_PRIVATE_RECEIPT_REQUEST_INVALID");
  assert.equal(JSON.stringify(body).includes("must-not-reflect"), false);
});
