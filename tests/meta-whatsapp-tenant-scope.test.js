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

const ENV_KEYS = [
  "DATABASE_URL",
  "META_ACCESS_TOKEN",
  "META_APP_SECRET",
  "META_GRAPH_API_VERSION",
  "META_PHONE_NUMBER_ID",
  "WHATSAPP_CREDENTIALS_ENCRYPTION_KEY",
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

process.env.DATABASE_URL = "postgresql://unit-test.invalid/obrasaas";
process.env.META_ACCESS_TOKEN = "legacy-global-token-must-not-be-used";
process.env.META_APP_SECRET = "meta-app-secret";
process.env.META_GRAPH_API_VERSION = "v25.0";
process.env.META_PHONE_NUMBER_ID = "123456789012345";
process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const [{ encryptCredential }, { sendWhatsAppText }] = await Promise.all([
  import("../src/lib/credentials.js"),
  import("../src/lib/whatsapp/meta.js"),
]);

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete globalThis.__obraSaasPrisma;
});

function prismaForConnections(connections, onQuery = () => {}) {
  return {
    whatsAppConnection: {
      async findFirst(query) {
        onQuery(query);
        const { where } = query;
        return connections.find((connection) => (
          connection.phoneNumberId === where.phoneNumberId
          && connection.projectId === where.projectId
          && connection.enabled === where.enabled
          && connection.connectionStatus === where.connectionStatus
          && Boolean(connection.encryptedAccessToken)
          && connection.project.organizationId === where.project.organizationId
        )) || null;
      },
    },
  };
}

test("disabled and reassigned tenant phone connections fail before any Meta fetch", async () => {
  const requestedPhoneNumberId = "123456789012345";
  const scope = { organizationId: "organization-a", projectId: "project-a" };
  const scenarios = [
    {
      name: "disabled",
      connections: [{
        phoneNumberId: requestedPhoneNumberId,
        projectId: scope.projectId,
        project: { organizationId: scope.organizationId },
        enabled: false,
        connectionStatus: "CONNECTED",
        encryptedAccessToken: "disabled-token-must-not-be-decrypted",
      }],
    },
    {
      name: "reassigned",
      connections: [{
        phoneNumberId: requestedPhoneNumberId,
        projectId: "project-b",
        project: { organizationId: "organization-b" },
        enabled: true,
        connectionStatus: "CONNECTED",
        encryptedAccessToken: "foreign-token-must-not-be-decrypted",
      }],
    },
  ];

  for (const scenario of scenarios) {
    let fetchCalls = 0;
    let queryCalls = 0;
    globalThis.__obraSaasPrisma = prismaForConnections(scenario.connections, ({ where }) => {
      queryCalls += 1;
      assert.deepEqual(where, {
        phoneNumberId: requestedPhoneNumberId,
        projectId: scope.projectId,
        enabled: true,
        connectionStatus: "CONNECTED",
        encryptedAccessToken: { not: null },
        project: { organizationId: scope.organizationId },
      });
    });

    await assert.rejects(
      sendWhatsAppText({
        to: "5491112345678",
        text: `blocked-${scenario.name}`,
        phoneNumberId: requestedPhoneNumberId,
        scope,
        fetchImpl: async () => {
          fetchCalls += 1;
          return Response.json({ messages: [{ id: "must-not-send" }] });
        },
      }),
      /No active WhatsApp credential exists for this tenant project/,
    );

    assert.equal(queryCalls, 1, `${scenario.name} must perform one scoped credential lookup`);
    assert.equal(fetchCalls, 0, `${scenario.name} must not call Meta`);
  }
});

test("an active exact-scope tenant connection sends with its tenant credential", async () => {
  const requestedPhoneNumberId = "123456789012345";
  const scope = { organizationId: "organization-a", projectId: "project-a" };
  globalThis.__obraSaasPrisma = prismaForConnections([{
    phoneNumberId: requestedPhoneNumberId,
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    enabled: true,
    connectionStatus: "CONNECTED",
    encryptedAccessToken: encryptCredential("tenant-access-token"),
  }]);

  let request = null;
  const result = await sendWhatsAppText({
    to: "5491112345678",
    text: "Mensaje permitido",
    phoneNumberId: requestedPhoneNumberId,
    scope,
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return Response.json({ messages: [{ id: "wamid.tenant-scope" }] });
    },
  });

  assert.equal(result.messages[0].id, "wamid.tenant-scope");
  assert.equal(request.options.headers.Authorization, "Bearer tenant-access-token");
  assert.equal(request.url.pathname, `/v25.0/${requestedPhoneNumberId}/messages`);
  assert.equal(
    request.url.searchParams.get("appsecret_proof"),
    crypto.createHmac("sha256", "meta-app-secret").update("tenant-access-token").digest("hex"),
  );
});

test("tenant credential expiry fails closed at and after the exact boundary", async () => {
  const requestedPhoneNumberId = "123456789012345";
  const scope = { organizationId: "organization-a", projectId: "project-a" };
  const now = new Date("2026-07-26T12:00:00.000Z");
  const expiryBoundary = Math.floor(now.getTime() / 1_000);
  const scenarios = [
    { name: "exact boundary", expiresAt: expiryBoundary },
    { name: "already expired", expiresAt: expiryBoundary - 1 },
  ];

  for (const scenario of scenarios) {
    let fetchCalls = 0;
    globalThis.__obraSaasPrisma = prismaForConnections([{
      phoneNumberId: requestedPhoneNumberId,
      projectId: scope.projectId,
      project: { organizationId: scope.organizationId },
      enabled: true,
      connectionStatus: "CONNECTED",
      encryptedAccessToken: "expired-token-must-not-be-decrypted",
      metadata: { channelHealth: { expiresAt: scenario.expiresAt } },
    }]);

    await assert.rejects(
      sendWhatsAppText({
        to: "5491112345678",
        text: `blocked-${scenario.name}`,
        phoneNumberId: requestedPhoneNumberId,
        scope,
        now,
        fetchImpl: async () => {
          fetchCalls += 1;
          return Response.json({ messages: [{ id: "must-not-send" }] });
        },
      }),
      (error) => error?.code === "META_CREDENTIAL_EXPIRED"
        && /credential has expired/.test(error.message),
      scenario.name,
    );
    assert.equal(fetchCalls, 0, `${scenario.name} must fail before calling Meta`);
  }
});

test("tenant credential remains usable while its persisted expiry is in the future", async () => {
  const requestedPhoneNumberId = "123456789012345";
  const scope = { organizationId: "organization-a", projectId: "project-a" };
  const now = new Date("2026-07-26T12:00:00.000Z");
  globalThis.__obraSaasPrisma = prismaForConnections([{
    phoneNumberId: requestedPhoneNumberId,
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    enabled: true,
    connectionStatus: "CONNECTED",
    encryptedAccessToken: encryptCredential("future-tenant-token"),
    metadata: {
      channelHealth: { expiresAt: Math.floor(now.getTime() / 1_000) + 1 },
    },
  }]);

  let request = null;
  const result = await sendWhatsAppText({
    to: "5491112345678",
    text: "Credential still current",
    phoneNumberId: requestedPhoneNumberId,
    scope,
    now,
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return Response.json({ messages: [{ id: "wamid.current-credential" }] });
    },
  });

  assert.equal(result.messages[0].id, "wamid.current-credential");
  assert.equal(request.options.headers.Authorization, "Bearer future-tenant-token");
});

test("global Meta credentials remain available only when no phone ID is requested", async () => {
  globalThis.__obraSaasPrisma = {
    whatsAppConnection: {
      findFirst: async () => assert.fail("legacy global delivery must not query a tenant connection"),
    },
  };
  let request = null;

  await sendWhatsAppText({
    to: "5491112345678",
    text: "Legacy control",
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return Response.json({ messages: [{ id: "wamid.legacy" }] });
    },
  });

  assert.equal(request.options.headers.Authorization, "Bearer legacy-global-token-must-not-be-used");
  assert.equal(request.url.pathname, "/v25.0/123456789012345/messages");
});

test("Meta text failures never retain provider-reflected content or transport causes", async () => {
  const requestedPhoneNumberId = "123456789012345";
  const scope = { organizationId: "organization-a", projectId: "project-a" };
  globalThis.__obraSaasPrisma = prismaForConnections([{
    phoneNumberId: requestedPhoneNumberId,
    projectId: scope.projectId,
    project: { organizationId: scope.organizationId },
    enabled: true,
    connectionStatus: "CONNECTED",
    encryptedAccessToken: encryptCredential("tenant-access-token"),
  }]);
  const sensitiveEcho = "token=one-time-link-must-not-reach-errors";

  await assert.rejects(
    sendWhatsAppText({
      to: "15551234567",
      text: `private ${sensitiveEcho}`,
      phoneNumberId: requestedPhoneNumberId,
      scope,
      fetchImpl: async () => Response.json(
        { error: { code: 131000, message: `reflected ${sensitiveEcho}` } },
        { status: 400 },
      ),
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.providerCode, 131000);
      assert.equal(error.cause, undefined);
      assert.equal(error.message, "Meta send failed (400).");
      assert.equal(String(error.stack).includes(sensitiveEcho), false);
      return true;
    },
  );

  await assert.rejects(
    sendWhatsAppText({
      to: "15551234567",
      text: `private ${sensitiveEcho}`,
      phoneNumberId: requestedPhoneNumberId,
      scope,
      fetchImpl: async () => {
        throw new Error(`transport reflected ${sensitiveEcho}`);
      },
    }),
    (error) => {
      assert.equal(error.ambiguous, true);
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes(sensitiveEcho), false);
      return true;
    },
  );
});
